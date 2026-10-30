"""ThermoBiogasUp · Gen E — cascata R-101 → TQ-201 → R-201/202 → TQ-301 (mm, z = 0 na base).

Fonte única do modelo: tanques Fibrais com os bocais do as-built (315A/D/E-25), estado de
cada bocal (usar / tamponar / converter / novo), linhas, dispositivos e instrumentos.
Gera: STEP, GLB, tabela de bocais para a Fibrais, verificação, memória hidráulica e o perfil
das linhas de energia e piezométrica.

Premissas de locação [A VERIFICAR na S5] e lacunas: ver `LACUNAS` no fim do arquivo.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / ".claude/skills/modelagem-3d-engenharia/scripts"))

from build123d import Cone, Pos, Vector  # noqa: E402

from hidraulica import geometria as g  # noqa: E402
from hidraulica import montagem, normas, prfv  # noqa: E402
from hidraulica.prfv import Bocal, TanquePRFV, direcao  # noqa: E402

PROJETO = "ThermoBiogasUp · Gen E · cascata de reatores e tanques a jusante"

# --- Níveis de projeto (mm) --------------------------------------------------------------
# N.A. de projeto = cota da soleira do bocal de saída N-SAI (crista; LAC-005/LAC-006). LSH/LSHH
# ficam acima do nível máximo de operação calculado com τy pessimista (hidraulica_gene.py).
NIVEL = {
    "R-101": {"crista": 3500, "LSH": 4200, "LSHH": 4350},
    "R-201": {"crista": 7500, "LSH": 8200, "LSHH": 8350},
    "R-202": {"crista": 7500, "LSH": 8200, "LSHH": 8350},
    "TQ-201": {"LSLL": 920, "LSL": 1070, "LSH": 1450, "LSHH": 1600, "extravasor": 1750,
               "entrada": 2210},
    "TQ-301": {"LSL": 1200, "LSH": 3600, "LSHH": 3850, "extravasor": 4000},
}
SELO_MIN = 330.0          # mm de polpa no pote de selagem (≈ 33 mbar): 2,7× a abertura do dispositivo
                          # de emergência (+12 mbar) e 4× o envelope de vácuo (−8 mbar R-201/202;
                          # −6 mbar R-101, emergência −4/−5); RES-001 LQ-04 pede ≥ 250 mm
CRISTA_CARGA = 1000.0     # alça de entrada: crista ≥ LSHH + folga
S_DESC = 0.40             # declividade das descidas com lâmina livre (sen θ = 0,37 > 0,23 de τy 100 Pa)


N2_USO = {"entrada": "entrada da alimentação pelo fundo (alça externa com ventosa ligada ao gás)",
          "purga": "purga de lodo/esgotamento por bomba (LC + XV falha-fecha, intertravamento "
                   "por chave com a sucção do tanque; Q ≤ Q_máx RES-001 §5.6)"}


def reator(tag, desenho, centro, Di, Hcil, t, r_n1, elev_n1, elev_m2, az_sai, az_lshh, n2,
           n1_reserva=45):
    """Reator Fibrais (fundo/tampo planos) com a tabela de bocais do as-built.
    n2: {azimute: 'entrada' | 'purga'}; os demais N2 são tamponados."""
    nv = NIVEL[tag]
    b = []
    for az in (45, 135, 225, 315):
        if az == n1_reserva:
            b.append(Bocal(f"N1-{az}", 150, "tampo", "tamponar",
                           "reserva: transbordo dedicado (LAC-038) ou tomada independente "
                           "PSLL/PAHH (RES-001 §5.6)", az=az, raio=r_n1, elev=elev_n1,
                           origem=desenho))
        else:
            b.append(Bocal(f"N1-{az}", 150, "tampo", "usar", "", az=az, raio=r_n1,
                           elev=elev_n1, origem=desenho))
    for az in (45, 135, 225, 315):
        if az in n2:
            b.append(Bocal(f"N2-{az}", 150, "costado", "usar", N2_USO[n2[az]], az=az, elev=300,
                           origem=desenho))
        else:
            b.append(Bocal(f"N2-{az}", 150, "costado", "tamponar",
                           "sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05)",
                           az=az, elev=300, origem=desenho))
    b.append(Bocal("N3-0", 50, "tampo", "usar", "saída de biogás ao coletor comum", az=0,
                   raio=450, elev=elev_n1, origem=desenho,
                   nota="posição radial no tampo a conferir no as-built (LAC-043)"))
    b.append(Bocal("N3-180", 50, "tampo", "usar", "PT/PSLL/PAHH do espaço de gás", az=180,
                   raio=450, elev=elev_n1, origem=desenho, nota="idem LAC-043"))
    b.append(Bocal("M1", 600, "costado", "tamponar",
                   "boca de visita inferior: tampa cega estanque a gás (LAC-029)", az=90,
                   elev=700, proj=140, origem=desenho))
    b.append(Bocal("M2", 800, "tampo", "usar", "dispositivo de emergência bidirecional",
                   az=0, raio=r_n1, elev=elev_m2, proj=140, origem=desenho))
    b.append(Bocal("A4", 200, "tampo", "converter",
                   "respiro 8\" PVC chapéu chinês → flange 8\" ANSI 150# + flange cego "
                   "(abrir só na purga OP-02)", az=180, raio=r_n1, elev=elev_n1,
                   origem=desenho))
    b.append(Bocal("N-SAI", 150, "costado", "novo",
                   "saída por gravidade no nível: soleira interna do bocal = N.A. "
                   f"(+{nv['crista'] / 1000:.2f}); segue ao pote de selagem",
                   az=az_sai, elev=nv["crista"] + 76, origem="novo (CSTR)",
                   soleira=nv["crista"]))
    b.append(Bocal("N-LSHH", 50, "costado", "novo", "chave de nível muito alto (garfo "
                   "vibratório, sensor dedicado à SIF)", az=az_lshh, elev=nv["LSHH"],
                   origem="novo (CSTR)"))
    return TanquePRFV(tag, desenho, centro, Di, 0.0, Hcil, t=t, bocais=b, escada_az=270,
                      chicanas=4, niveis=nv, gas=True)


def az_para(origem_xy, destino_xy) -> float:
    dx, dy = destino_xy[0] - origem_xy[0], destino_xy[1] - origem_xy[1]
    return math.degrees(math.atan2(dx, dy)) % 360


# --- Locação (premissa, base comum z = 0) -------------------------------------------------
C = {"R-101": (0, 0), "TQ-201": (5000, 0), "R-201": (11500, 0), "R-202": (18000, 0),
     "TQ-301": (14750, -6000)}
R_N1 = {"R-101": 1000, "R-201": 1300}
TQ301_N1 = {az: (C["TQ-301"][0] + 1250 * direcao(az).X, C["TQ-301"][1] + 1250 * direcao(az).Y)
            for az in (0, 90, 180, 270)}


def montar_tanques(m):
    tq = {}
    tq["R-101"] = reator("R-101", "315E-25", C["R-101"], 3200, 4700, 7, R_N1["R-101"],
                         4850, 4870, az_sai=90, az_lshh=65, n2={225: "entrada", 135: "purga"})
    az201 = round(az_para(C["R-201"], TQ301_N1[0]) * 2) / 2
    az202 = round(az_para(C["R-202"], TQ301_N1[90]) * 2) / 2
    tq["R-201"] = reator("R-201", "315D-25", C["R-201"], 3800, 9300, 12, R_N1["R-201"],
                         9450, 9470, az_sai=az201, az_lshh=110, n2={225: "entrada", 135: "purga"})
    tq["R-202"] = reator("R-202", "315D-25", C["R-202"], 3800, 9300, 12, R_N1["R-201"],
                         9450, 9470, az_sai=az202, az_lshh=250, n2={315: "entrada", 135: "purga"})
    nv = NIVEL["TQ-201"]
    z0 = 450                                       # pedestal: bomba P-201 afogada
    tq["TQ-201"] = TanquePRFV(
        "TQ-201", "novo (CSTR) — LAC-010", C["TQ-201"], 1800, z0, 2300, t=8, tampo="atmosferico",
        escada_az=None, guarda_corpo=False, niveis=nv, bocais=[
            Bocal("N-ENT", 150, "costado", "novo", "entrada do R-101 (descarga livre acima do "
                  "extravasor)", az=270, elev=nv["entrada"] + 76, origem="novo (CSTR)",
                  soleira=nv["entrada"]),
            Bocal("N-SUC", 100, "costado", "novo", "sucção da P-201 com quebra-vórtice", az=180,
                  elev=z0 + 250, origem="novo (CSTR)",
                  nota="eixo a 250 mm do fundo: Fibrais confirma a distância mínima à junta "
                       "fundo-costado"),
            Bocal("N-EXT", 150, "costado", "novo", "extravasor livre (sem válvula)", az=30,
                  elev=nv["extravasor"] + 76, origem="novo (CSTR)", soleira=nv["extravasor"]),
            Bocal("N-DRE", 50, "costado", "novo", "dreno de fundo com registro", az=135,
                  elev=z0 + 200, origem="novo (CSTR)", nota="idem N-SUC"),
            Bocal("N-LSLL", 50, "costado", "novo", "LSLL garfo (trip P-201)", az=225,
                  elev=nv["LSLL"], origem="novo (CSTR)"),
            Bocal("N-LSHH", 50, "costado", "novo", "LSHH garfo (trip P-101)", az=315,
                  elev=nv["LSHH"], origem="novo (CSTR)"),
            Bocal("N-RESP", 150, "tampo", "novo", "respiro ao FCA-201", az=0, raio=550,
                  elev=z0 + 2300 + 150, origem="novo (CSTR)"),
            Bocal("N-AG", 200, "tampo", "novo", "agitador AG-200", az=0, raio=0,
                  elev=z0 + 2300 + 150, origem="novo (CSTR)"),
            Bocal("N-LT", 80, "tampo", "novo", "LT-201 (radar)", az=120, raio=550,
                  elev=z0 + 2300 + 150, origem="novo (CSTR)"),
            Bocal("N-PH", 50, "tampo", "novo", "pHIT/ORP-201 (sonda de imersão)", az=180,
                  raio=550, elev=z0 + 2300 + 150, origem="novo (CSTR)"),
            Bocal("N-DOS", 25, "tampo", "novo", "injeção de NaOH (DOS-201)", az=60, raio=550,
                  elev=z0 + 2300 + 150, origem="novo (CSTR)"),
            Bocal("N-BL", 80, "tampo", "novo", "boia LSL (para a P-201)", az=240, raio=550,
                  elev=z0 + 2300 + 150, origem="novo (CSTR)"),
            Bocal("N-BH", 80, "tampo", "novo", "boia LSH (parte a P-201)", az=300, raio=550,
                  elev=z0 + 2300 + 150, origem="novo (CSTR)"),
            Bocal("N-RL05", 80, "tampo", "novo", "retorno alcalino RL-05 (P-301)", az=270,
                  raio=550, elev=z0 + 2300 + 150, origem="novo (CSTR)"),
        ])
    nv = NIVEL["TQ-301"]
    b301 = []
    for az, serv in ((0, "chegada do R-201 (descarga livre)"),
                     (90, "chegada do R-202 (descarga livre)"),
                     (180, "LT-301 (radar)"),
                     (270, "retorno da P-301 (recirculação/purga de lodo dos reatores)")):
        b301.append(Bocal(f"N1-{az}", 150, "tampo", "usar", serv, az=az, raio=1250, elev=4660,
                          origem="315A-25"))
    for az in (0, 90, 180, 270):
        b301.append(Bocal(f"N2-{az}", 150, "costado", "tamponar", "sem uso: flange cego PRFV",
                          az=az, elev=2480, origem="315A-25"))
    b301 += [
        Bocal("N3", 150, "fundo", "usar", "dreno do cone e sucção da P-301", elev=500,
              origem="315A-25"),
        Bocal("M1", 600, "tampo", "tamponar", "boca de visita: tampa cega", raio=0, elev=4680,
              proj=140, origem="315A-25"),
        Bocal("N-EXT", 150, "costado", "novo", "extravasor livre (sem válvula)", az=200,
              elev=nv["extravasor"] + 76, origem="novo (CSTR)", soleira=nv["extravasor"]),
        Bocal("N-LSHH", 50, "costado", "novo", "LSHH garfo (trip P-201 e purga)", az=160,
              elev=nv["LSHH"], origem="novo (CSTR)"),
    ]
    tq["TQ-301"] = TanquePRFV("TQ-301", "315A-25", C["TQ-301"], 3000, 2140, 2400, t=10,
                              fundo="conico", h_cone=1500, pes=[20, 110, 200, 290],
                              tampo="atmosferico", bocais=b301, escada_az=225, niveis=nv)
    for t_ in tq.values():
        prfv.construir(m, t_)
    # respiro A7 12" existente do TQ-301 (chapéu chinês, atmosférico)
    x, y = C["TQ-301"]
    d = direcao(135) * 1000
    m.add("A7-RESP-TQ-301", Pos(x + d.X, y + d.Y, 4540) * g.tubo_reto(324, 300, 350),
          prfv.COR["usar"])
    m.add("A7-RESP-TQ-301", Pos(x + d.X, y + d.Y, 4900) * Cone(260, 30, 140, align=g.BASE),
          prfv.COR["usar"])
    return tq


def dispositivos(m, tq):
    """Selo, emergência, instrumentos e agitadores sobre os bocais que não recebem tubulação."""
    for tag in ("R-101", "R-201", "R-202"):
        r = tq[tag]
        prfv.emergencia_m2(m, r, "M2", "EMG")
        prfv.instrumento(m, r, "N3-180", "PT", "pt")
        prfv.instrumento(m, r, "N-LSHH", "LSHH", "garfo")
        prfv.agitador_topo(m, r, f"AG-{tag.replace('-', '')}",
                           pot_cv={"R-101": 10, "R-201": 15, "R-202": 15}[tag])
    t2 = tq["TQ-201"]
    prfv.instrumento(m, t2, "N-LT", "LT", "radar")
    prfv.instrumento(m, t2, "N-LSLL", "LSLL", "garfo")
    prfv.instrumento(m, t2, "N-LSHH", "LSHH", "garfo")
    zf = t2.bocal("N-BL").elev
    prfv.instrumento(m, t2, "N-BL", "LSL", "boia", comprimento=zf - NIVEL["TQ-201"]["LSL"])
    prfv.instrumento(m, t2, "N-BH", "LSH", "boia", comprimento=zf - NIVEL["TQ-201"]["LSH"])
    prfv.instrumento(m, t2, "N-PH", "PHIT", "ph", comprimento=zf - 900)
    prfv.instrumento(m, t2, "N-DOS", "DOS", "pt")
    # agitador AG-200 (envelope) no bocal central
    m.portas.pop("TQ-201.N-AG")
    t2.bocal("N-AG").ligacao = "AG-200"
    x, y = C["TQ-201"]
    m.add("AG-200-TQ-201", Pos(x, y, t2.bocal("N-AG").elev) * g.tubo_reto(300, 0.1, 380),
          prfv.COR["motor"])
    m.add("AG-200-TQ-201", Pos(x, y, 600) * g.tubo_reto(60, 0.1, t2.bocal("N-AG").elev - 600),
          (0.55, 0.57, 0.60, 1))
    t3 = tq["TQ-301"]
    prfv.instrumento(m, t3, "N1-180", "LT", "radar")
    prfv.instrumento(m, t3, "N-LSHH", "LSHH", "garfo")


# --- Linhas --------------------------------------------------------------------------------

def P(m, nome):
    p = m.portas[nome]
    return p.ponto, p.direcao


def xyz(v):
    return [round(v.X, 1), round(v.Y, 1), round(v.Z, 1)]


V = Vector
PEAD = {"material": "pead", "pn": normas.CLASSE_ANSI, "nao_newtoniano": True}


def _n1_livre(tq, tag, perto_az, uso):
    """N1 livre mais próximo de um azimute; marca a ligação."""
    r = tq[tag]
    b = min((b for b in r.bocais if b.tag.startswith("N1-") and b.estado == "usar"
             and not b.ligacao), key=lambda b: abs(((b.az - perto_az) + 180) % 360 - 180))
    b.ligacao = uso
    return b


def _sobre_tampo(m, tq, tag, de_xy, n1):
    """Pontos do respiro: sobe acima do guarda-corpo (tampo + 1,30 m), cruza com 1 % de queda
    para o reator e desce no N1 (sem ponto baixo: o condensado volta ao reator, SP-13)."""
    Pn1, _ = P(m, f"{tag}.{n1.tag}")
    top = V(de_xy.X, de_xy.Y, tq[tag].z_tampo + 1300)
    dist = math.hypot(Pn1.X - top.X, Pn1.Y - top.Y)
    return [xyz(top), xyz(V(Pn1.X, Pn1.Y, top.Z - 0.01 * dist))]


def _plano(v):
    return V(v.X, v.Y, 0)


def saida(m, tq, L, tag, dest_porta, pote_xy, z_rail=None, s_desc=S_DESC):
    """Saída por gravidade no nível: N-SAI (soleira = N.A.) → registro LO → descida com lâmina
    livre (S ≥ S_DESC) → pote de selagem com tubo mergulhado (fecho de SELO_MIN) → vertedor
    → descida livre → destino (bocal de tampo com queda vertical ou bocal de costado).
    O espaço de gás do reator chega pela própria descida até a superfície interna do pote: o
    quebra-sifão é o próprio bocal no nível (nada abaixo da soleira escoa por gravidade)."""
    F, n = P(m, f"{tag}.N-SAI")
    D, nD = P(m, dest_porta)
    pote = f"PS-{tag[2:]}"
    A = F + n * 400                                   # registro LO (faca) + curva
    Pc = V(pote_xy[0], pote_xy[1], 0)
    u2 = _plano(D - Pc).normalized()
    Rp = 400 / 2 + 10 + 120                           # face do vertedor a partir do eixo do pote
    d1 = (_plano(A) - Pc).length
    if abs(nD.Z) > 0.9:                               # destino no tampo: chega por cima
        E = V(D.X, D.Y, 0)
        d2 = (E - (Pc + u2 * (Rp + 300))).length
        z_w_min = max(z_rail, D.Z + 400) - 76 + s_desc * d2
    else:                                             # destino no costado: entra na horizontal
        E = _plano(D + nD * 400)
        d2 = (E - (Pc + u2 * (Rp + 300))).length
        z_w_min = D.Z - 76 + s_desc * d2
    z_w_max = F.Z - s_desc * d1 - 700
    assert z_w_min <= z_w_max, (tag, z_w_min, z_w_max)
    z_w = round(min(z_w_min + 50, (z_w_min + z_w_max) / 2), -1)
    az_s = math.degrees(math.atan2(u2.X, u2.Y)) % 360
    prfv.pote_selagem(m, pote, pote_xy, z_w, SELO_MIN, az_s)
    T, _ = P(m, f"{pote}.N-ENT")
    L.append({**PEAD, "tag": f"{tag}-SAI", "servico": "esgoto", "regime": "selada", "de": 160,
              "raio_curva": 1.0, "suportes": False, "origem": f"{tag}.N-SAI",
              "pontos": [xyz(A), xyz(V(T.X, T.Y, z_w + 700))], "destino": f"{pote}.N-ENT",
              "pote": pote, "lamina_livre": True, "curvas_sob_medida": True,
              "componentes": [{"tipo": "gaveta", "tag": f"V-{tag[2:]}SAI", "distancia": 60,
                               "nota": "LO (faca); fechar só com o pote cheio"}]})
    G, ng = P(m, f"{pote}.N-SAI")
    G1 = G + ng * 300
    if abs(nD.Z) > 0.9:
        z_arr = G.Z - s_desc * (_plano(G1) - E).length
        pts = [xyz(G1), xyz(V(D.X, D.Y, round(z_arr)))]
    else:
        pts = [xyz(G1), xyz(D + nD * 400)]
    L.append({**PEAD, "tag": f"{tag}-TRB", "servico": "esgoto", "regime": "selada", "de": 160,
              "raio_curva": 1.0, "suportes": False, "origem": f"{pote}.N-SAI",
              "pontos": pts, "destino": dest_porta, "lamina_livre": True, "transbordo": True,
              "curvas_sob_medida": True})


def alca(m, tq, L, tag, n2, de_lin):
    """Alça de entrada pressurizada: sobe ao lado do reator até acima do LSHH; na crista uma
    ventosa de esgoto descarrega no espaço de gás (por um N1) e admite gás se a crista ficar
    abaixo da pressão do gás: quebra o sifão sem admitir ar. Desce em DE160 até o N2."""
    F, n = P(m, f"{tag}.{n2}")
    z_crista = NIVEL[tag]["LSHH"] + CRISTA_CARGA
    tg = V(n.Y, -n.X, 0)
    pe = F + n * 1400
    sobe = pe + tg * 700
    n1 = _n1_livre(tq, tag, tq[tag].bocal(n2).az, f"{tag}-VQ")
    return sobe, z_crista, pe, F, n1, tg


def _vq(m, tq, L, tag, sobe, pe, z_crista, n1):
    """Linha de gás da ventosa da crista ao N1 (fechada: sem pescoço de ganso)."""
    meio = (sobe + pe) * 0.5
    L.append({**PEAD, "tag": f"{tag}-VQ", "servico": "ar", "regime": "ventilacao", "de": 63,
              "suportes": False, "fechada": True,
              "origem": {"ponto": [round(meio.X, 1), round(meio.Y, 1), z_crista + 450],
                         "direcao": [0, 0, 1], "descricao": f"saída da ventosa VQ-{tag[2:]}"},
              "pontos": _sobre_tampo(m, tq, tag, meio, n1), "destino": f"{tag}.{n1.tag}"})


def _fim_alca(tag, i_crista):
    """Ventosa na crista, ampliação 90→160 no início da descida, gaveta faca DN150 no N2."""
    return [{"tipo": "ventosa", "tag": f"VQ-{tag[2:]}", "dn_ramal": 50,
             "distancia": {"trecho": i_crista, "pos": "meio"},
             "nota": "ventosa de esgoto (corpo longo); descarga conduzida ao gás do reator"},
            {"tipo": "reducao", "tag": f"A-{tag[2:]}DL", "de2": 160,
             "distancia": {"trecho": i_crista + 1, "pos": "inicio", "offset": 30}},
            {"tipo": "gaveta", "tag": f"V-{tag[2:]}ENT", "distancia": "fim",
             "nota": "faca DN150 colada ao N2 (VC-06)"}]


def linhas(m, tq):
    L = []
    F, n = P(m, "R-101.N-SAI")
    saida(m, tq, L, "R-101", "TQ-201.N-ENT", (F.X + n.X * 900, F.Y + n.Y * 900))
    z_rail = tq["TQ-301"].z_tampo + 1300            # acima do guarda-corpo do TQ-301
    for tag, n1 in (("R-201", "N1-0"), ("R-202", "N1-90")):
        D, _ = P(m, f"TQ-301.{n1}")
        F, _ = P(m, f"{tag}.N-SAI")
        u = _plano(F - D).normalized()
        saida(m, tq, L, tag, f"TQ-301.{n1}", (D.X + u.X * 1950, D.Y + u.Y * 1950), z_rail,
              s_desc=0.33 if tag == "R-202" else S_DESC)   # R-202 é o mais distante do TQ-301

    # --- R-101: alimentação pela P-101 (Ilha 1), tie-in a oeste a +1,20 m
    sobe, zc, pe, F, n1, tg = alca(m, tq, L, "R-101", "N2-225", 90)
    L.append({**PEAD, "tag": "R-101-AL", "servico": "esgoto", "regime": "pressao", "de": 90,
              "raio_curva": 2.0, "vazao_ls": round(6 / 3.6, 2), "suportes": True, "z_piso": 0,
              "origem": {"ponto": [-6500, round(sobe.Y, 1), 1200], "direcao": [1, 0, 0],
                         "descricao": "descarga da P-101 (Ilha 1)"},
              "pontos": [xyz(V(sobe.X, sobe.Y, 1200)), xyz(V(sobe.X, sobe.Y, zc)),
                         xyz(V(pe.X, pe.Y, zc)), xyz(V(pe.X, pe.Y, F.Z))],
              "destino": "R-101.N2-225", "crista": 2,
              "componentes": [{"tipo": "retencao", "tag": "V-101RT", "distancia": 300},
                              {"tipo": "gaveta", "tag": "V-101BQ"},
                              {"tipo": "junta_desmontagem", "tag": "JD-101"}]
              + _fim_alca("R-101", 2)})
    _vq(m, tq, L, "R-101", sobe, pe, zc, n1)

    # --- P-201: TQ-201 → R-201 e R-202 (alimentação ALTERNADA por V-201AL / V-202BQ atuadas).
    # Eixo da bomba na cota do bocal de sucção: sucção reta e afogada (LSLL acima do eixo).
    S, _ = P(m, "TQ-201.N-SUC")
    prfv.bomba_pcp(m, "P-201", (C["TQ-201"][0] - 1500, -2900, S.Z - 450), 0, 100, 80)
    Ps, _ = P(m, "P-201.succao")
    y_s = S.Y - 600
    L.append({**PEAD, "tag": "L-201S", "servico": "esgoto", "regime": "pressao", "de": 110,
              "suportes": False, "origem": "TQ-201.N-SUC",
              "pontos": [xyz(V(S.X, y_s, S.Z)), xyz(V(Ps.X, y_s, S.Z))],
              "destino": "P-201.succao",
              "componentes": [{"tipo": "gaveta", "tag": "V-201S", "distancia": 60,
                               "nota": "intertravada por chave com V-101PG"}]})
    R, _ = P(m, "P-201.recalque")
    s1, zc1, pe1, F1, n11, tg1 = alca(m, tq, L, "R-201", "N2-225", 80)
    x_te = s1.X - 500
    L.append({**PEAD, "tag": "R-201-AL", "servico": "esgoto", "regime": "pressao", "de": 90,
              "raio_curva": 2.0, "vazao_ls": round(6 / 3.6, 2), "suportes": True, "z_piso": 0,
              "origem": "P-201.recalque",
              "pontos": [xyz(V(s1.X, R.Y, R.Z)), xyz(V(s1.X, s1.Y, R.Z)),
                         xyz(V(s1.X, s1.Y, zc1)), xyz(V(pe1.X, pe1.Y, zc1)),
                         xyz(V(pe1.X, pe1.Y, F1.Z))],
              "destino": "R-201.N2-225", "crista": 3,
              "componentes": [{"tipo": "retencao", "tag": "V-201RT", "distancia": 120},
                              {"tipo": "gaveta", "tag": "V-201BQ"},
                              {"tipo": "junta_desmontagem", "tag": "JD-201"},
                              {"tipo": "gaveta", "tag": "V-201AL",
                               "distancia": {"trecho": 0, "pos": "fim", "offset": -40},
                               "nota": "atuada: alterna a alimentação R-201 / R-202"}]
              + _fim_alca("R-201", 3)})
    _vq(m, tq, L, "R-201", s1, pe1, zc1, n11)
    s2, zc2, pe2, F2, n12, tg2 = alca(m, tq, L, "R-202", "N2-315", 80)
    L.append({**PEAD, "tag": "R-202-AL", "servico": "esgoto", "regime": "pressao", "de": 90,
              "raio_curva": 2.0, "suportes": True, "z_piso": 0,
              "origem": {"te": "R-201-AL", "ponto": [round(x_te, 1), round(R.Y, 1), round(R.Z, 1)],
                         "direcao": [0, -1, 0]},
              "pontos": [xyz(V(x_te, -3750, R.Z)), xyz(V(x_te, -3750, 1200)),
                         xyz(V(14750, -3750, 1200)), xyz(V(14750, s2.Y, 1200)),
                         xyz(V(s2.X, s2.Y, 1200)), xyz(V(s2.X, s2.Y, zc2)),
                         xyz(V(pe2.X, pe2.Y, zc2)), xyz(V(pe2.X, pe2.Y, F2.Z))],
              "destino": "R-202.N2-315", "crista": 6,
              "componentes": [{"tipo": "gaveta", "tag": "V-202BQ",
                               "distancia": {"trecho": 2, "pos": "inicio", "offset": 150},
                               "nota": "atuada: alterna a alimentação R-201 / R-202"}]
              + _fim_alca("R-202", 6)})
    _vq(m, tq, L, "R-202", s2, pe2, zc2, n12)

    # --- purga do R-101 pela P-201 (tê na sucção, chegando de cima), registro LC no bocal
    Fp, np_ = P(m, "R-101.N2-135")
    a = Fp + np_ * 900
    x_tp = (S.X + Ps.X) / 2
    L.append({**PEAD, "tag": "R-101-PG", "servico": "lodo", "regime": "pressao", "de": 160,
              "ponto_alto": "respiro manual DN25 no ponto alto (enchimento e drenagem)",
              "suportes": False, "origem": "R-101.N2-135",
              "pontos": [xyz(a), xyz(V(a.X, a.Y, 1300)), xyz(V(a.X, -2450, 1300)),
                         xyz(V(x_tp, -2450, 1300)), xyz(V(x_tp, y_s, 1300))],
              "destino": {"te": "L-201S", "ponto": [round(x_tp, 1), round(y_s, 1), round(S.Z, 1)]},
              "componentes": [{"tipo": "gaveta", "tag": "V-101PG", "distancia": 60,
                               "nota": "LC (travada fechada); chave presa com a sucção do tanque"},
                              {"tipo": "gaveta", "tag": "XV-101PG",
                               "nota": "atuada falha-fecha: abre só com permissivos RES-001 §5.6"},
                              {"tipo": "reducao", "tag": "R-101PG", "de2": 110, "distancia": "fim"}]})

    # --- P-301: sucção do N3 do TQ-301 e purga dos R-201/202; recalque ao TQ-301, RL-05 e expedição
    prfv.bomba_pcp(m, "P-301", (17800, -7300, 0), 90, 150, 100)
    N3, _ = P(m, "TQ-301.N3")
    Ps3, _ = P(m, "P-301.succao")
    z_s3 = 160
    L.append({**PEAD, "tag": "L-301S", "servico": "lodo", "regime": "pressao", "de": 160,
              "suportes": False, "origem": "TQ-301.N3", "raio_curva": 1.0,
              "ponto_alto": "flange de sucção da P-301 (respiro manual na carcaça)",
              "pontos": [xyz(V(N3.X, N3.Y, z_s3)), xyz(V(Ps3.X - 720, N3.Y, z_s3)),
                         xyz(V(Ps3.X - 720, Ps3.Y, z_s3)),
                         xyz(V(Ps3.X - 720 + (Ps3.Z - z_s3), Ps3.Y, Ps3.Z))],
              "destino": "P-301.succao",
              "componentes": [{"tipo": "gaveta", "tag": "V-301S", "distancia": 450,
                               "nota": "intertravada por chave com V-201PG/V-202PG"}]})
    x_col = 15700
    Fq, nq = P(m, "R-201.N2-135")
    a = Fq + nq * 900
    L.append({**PEAD, "tag": "R-201-PG", "servico": "lodo", "regime": "pressao", "de": 160,
              "ponto_alto": "respiro manual DN25 no ponto alto (enchimento e drenagem)",
              "suportes": False, "origem": "R-201.N2-135",
              "pontos": [xyz(a), xyz(V(a.X, a.Y, 900)), xyz(V(x_col, a.Y, 900)),
                         xyz(V(x_col, N3.Y, 900))],
              "destino": {"te": "L-301S", "ponto": [x_col, round(N3.Y, 1), z_s3]},
              "componentes": [{"tipo": "gaveta", "tag": "V-201PG", "distancia": 60,
                               "nota": "LC (travada fechada); chave presa com a sucção do tanque"},
                              {"tipo": "gaveta", "tag": "XV-201PG",
                               "nota": "atuada falha-fecha: abre só com permissivos RES-001 §5.6"}]})
    Fq, nq = P(m, "R-202.N2-135")
    a = Fq + nq * 900
    L.append({**PEAD, "tag": "R-202-PG", "servico": "lodo", "regime": "pressao", "de": 160,
              "ponto_alto": "respiro manual DN25 no ponto alto (enchimento e drenagem)",
              "suportes": False, "origem": "R-202.N2-135",
              "pontos": [xyz(a), xyz(V(a.X, a.Y, 900)), xyz(V(a.X, -3000, 900)),
                         xyz(V(x_col + 900, -3000, 900))],
              "destino": {"te": "R-201-PG", "ponto": [x_col, -3000, 900]},
              "componentes": [{"tipo": "gaveta", "tag": "V-202PG", "distancia": 60,
                               "nota": "LC (travada fechada); chave presa com a sucção do tanque"},
                              {"tipo": "gaveta", "tag": "XV-202PG",
                               "nota": "atuada falha-fecha: abre só com permissivos RES-001 §5.6"}]})
    R3, _ = P(m, "P-301.recalque")
    y_r = -3600                                    # passa entre os potes PS-201 e PS-202
    z_top = tq["TQ-301"].z_tampo + 1550             # acima do ramal de chegada do R-201
    L.append({**PEAD, "tag": "L-301R", "servico": "lodo", "regime": "pressao", "de": 110,
              "suportes": False, "origem": "P-301.recalque",
              "ponto_alto": "descarga livre no TQ-301 (drena para o tanque ao parar)",
              "pontos": [xyz(V(R3.X, y_r, R3.Z)), xyz(V(R3.X, y_r, z_top)),
                         xyz(V(13500, y_r, z_top)), xyz(V(13500, -6000, z_top))],
              "destino": "TQ-301.N1-270",
              "componentes": [{"tipo": "retencao", "tag": "V-301RT", "distancia": 120},
                              {"tipo": "gaveta", "tag": "V-301BQ"},
                              {"tipo": "junta_desmontagem", "tag": "JD-301"},
                              {"tipo": "reducao", "tag": "R-301RS", "de2": 160, "distancia": "fim"}]})
    Rl, _ = P(m, "TQ-201.N-RL05")
    L.append({**PEAD, "tag": "L-RL05", "servico": "lodo", "regime": "pressao", "de": 90,                 # DN80: mínimo prático p/ polpa (entupimento)
              "suportes": False, "ponto_alto": "descarga livre no TQ-201",
              "origem": {"te": "L-301R", "ponto": [round(R3.X, 1), y_r, 2600], "direcao": [-1, 0, 0]},
              "pontos": [xyz(V(8200, y_r, 2600)), xyz(V(8200, 2100, 2600)),
                         xyz(V(8200, 2100, 3500)), xyz(V(Rl.X, 2100, 3500)),
                         xyz(V(Rl.X, Rl.Y, 3500))],
              "destino": "TQ-201.N-RL05",
              "componentes": [{"tipo": "gaveta", "tag": "V-RL05", "distancia": 400}]})
    L.append({**PEAD, "tag": "L-EXP", "servico": "lodo", "regime": "pressao", "de": 110,
              "suportes": False,
              "origem": {"te": "L-301R", "ponto": [round(R3.X, 1), y_r, 1100], "direcao": [1, 0, 0]},
              "pontos": [], "destino": {"ponto": [R3.X + 1500, y_r, 1100],
                                        "descricao": "expedição (engate rápido de caminhão)"},
              "componentes": [{"tipo": "gaveta", "tag": "V-EXP", "distancia": "fim"}]})

    # --- extravasores livres e dreno (sem válvula no extravasor)
    for tq_tag, nome in (("TQ-201", "N-EXT"), ("TQ-301", "N-EXT")):
        E, ne = P(m, f"{tq_tag}.{nome}")
        a = E + ne * 450
        L.append({**PEAD, "tag": f"L-{tq_tag[3:]}EX", "servico": "lodo", "regime": "selada",
                  "de": 160, "suportes": False, "origem": f"{tq_tag}.{nome}",
                  "pontos": [xyz(a)], "destino": {"ponto": [round(a.X, 1), round(a.Y, 1), 150],
                                                  "descricao": "caixa de contenção (LAC-044)"},
                  "transbordo": True})
    E, ne = P(m, "TQ-201.N-DRE")
    a = E + ne * 500
    L.append({**PEAD, "tag": "L-201DR", "servico": "lodo", "regime": "pressao", "de": 63,
              "suportes": False, "origem": "TQ-201.N-DRE", "pontos": [],
              "destino": {"ponto": [round(a.X, 1), round(a.Y, 1), round(a.Z, 1)],
                          "descricao": "dreno para a contenção"},
              "componentes": [{"tipo": "gaveta", "tag": "V-201DR", "distancia": 60}]})

    # --- respiro do TQ-201 ao FCA-201
    prfv.filtro_carvao(m, "FCA-201", (4600, 1700), "FCA-201.entrada")
    Rr, _ = P(m, "TQ-201.N-RESP")
    Fc, _ = P(m, "FCA-201.entrada")
    L.append({**PEAD, "tag": "L-201RP", "servico": "ar", "regime": "ventilacao", "de": 160,
              "suportes": False, "origem": "TQ-201.N-RESP",
              "pontos": [xyz(V(Rr.X, Rr.Y, 3200)), xyz(V(Fc.X - 600, Rr.Y, 3200)),
                         xyz(V(Fc.X - 600, Fc.Y, 3200)), xyz(V(Fc.X - 600, Fc.Y, Fc.Z))],
              "nota": "respiro drena de volta ao TQ-201 até o ponto alto; o trecho que desce "
                      "ao FCA-201 drena para o filtro (prever dreno no FCA)",
              "destino": "FCA-201.entrada"})

    # --- biogás: N3-0 sobe acima dos dispositivos e segue ao coletor comum (tie-in)
    for tag in ("R-101", "R-201", "R-202"):
        Gp, _ = P(m, f"{tag}.N3-0")
        z_g = tq[tag].z_tampo + 1700
        x_out = C[tag][0] + tq[tag].R + 1200
        L.append({**PEAD, "tag": f"{tag}-GAS", "servico": "ar", "regime": "ventilacao", "de": 63,
                  "suportes": False, "origem": f"{tag}.N3-0",
                  "fechada": True,
                  "pontos": [xyz(V(Gp.X, Gp.Y, z_g))],          # cai 1 % de volta ao reator
                  "destino": {"ponto": [x_out, round(Gp.Y, 1), round(z_g + 0.01 * (x_out - Gp.X))],
                              "descricao": "coletor comum de biogás (S3)"},
                  "componentes": [{"tipo": "gaveta", "tag": f"V-{tag[2:]}GAS", "distancia": 200,
                                   "nota": "LO"}]})
    return L


def selo_e_lt(m, tq):
    """Os dois N1 que sobram em cada reator recebem o selo hidráulico e o radar de nível."""
    for tag in ("R-101", "R-201", "R-202"):
        livres = [b for b in tq[tag].bocais if b.tag.startswith("N1-") and not b.ligacao
                  and b.estado == "usar"]
        prfv.selo_hidraulico(m, tq[tag], livres[0].tag, "SH")
        prfv.instrumento(m, tq[tag], livres[1].tag, "LT", "radar")


def seguranca(m):
    """Itens de proteção que não têm geometria própria no modelo (vão à lista de materiais)."""
    for b in ("P-201", "P-301"):
        m.item("PSV (ou disco de ruptura) com retorno à sucção, antes de qualquer válvula",
               f"descarga da {b} (PCP); ajuste abaixo da classe do PEAD SDR17", "un", 1)
        m.item("PSHH com trip da bomba + PSL na sucção (marcha a seco)", b, "cj", 1)
    m.item("Intertravamento por chave presa (V-101PG × V-201S)", "purga do R-101", "cj", 1)
    m.item("Intertravamento por chave presa (V-201PG/V-202PG × V-301S)", "purgas R-201/202",
           "cj", 1)
    for t in ("R-101", "R-201", "R-202"):
        m.item("Atuador falha-fecha para XV de purga (faca DN150)", f"XV-{t[2:]}PG", "un", 1)


def construir_modelo(solidos: bool = True):
    """solidos=False só traça as linhas (rápido): basta para a memória hidráulica."""
    m = montagem.Modelo({"projeto": PROJETO}, piso=0)
    tq = montar_tanques(m)
    dispositivos(m, tq)
    specs = linhas(m, tq)
    selo_e_lt(m, tq)
    seguranca(m)
    lin = [montagem.preparar_linha(m, s) for s in specs]
    for ln in lin:
        m.linhas[ln.tag] = ln
    tes: dict = {}
    for ln in lin:                       # ordem do arquivo: o tronco vem antes dos ramais
        montagem.tracar_linha(m, ln, tes)
    m.tes = tes
    if not solidos:
        return m, tq, specs
    for ln in lin:
        montagem.construir_linha(m, ln, tes.get(ln.tag, []))
    return m, tq, specs


if __name__ == "__main__":
    m, tq, L = construir_modelo()
    print(len(m.portas), "portas;", len(L), "linhas;", len(m.pecas), "grupos")
