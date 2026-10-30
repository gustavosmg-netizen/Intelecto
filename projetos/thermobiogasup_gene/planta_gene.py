"""ThermoBiogasUp · Gen E rev. 5 — R-101 → P-201 (neutralização em linha) → R-201/202 → CS-301 →
TQ-301 (mm, z = 0 na base).

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
from hidraulica import gas, montagem, normas, prfv  # noqa: E402
from hidraulica.prfv import Bocal, TanquePRFV, direcao  # noqa: E402

PROJETO = "ThermoBiogasUp · Gen E · cascata de reatores e tanques a jusante"

# --- Níveis de projeto (mm) --------------------------------------------------------------
# R-201/202: N.A. = soleira do N-SAI (crista; LAC-005/LAC-006); LSH/LSHH acima do nível máximo
# com τy pessimista. R-101: nível VARIÁVEL (retirada pela P-201 com controle de nível; não há
# saída por transbordo nem tanque de neutralização na rev. 5).
NIVEL = {
    "R-101": {"LSLL": 2400, "LSL": 2800, "op": 3500, "LSH": 4200, "LSHH": 4350},
    "R-201": {"crista": 7500, "LSH": 8200, "LSHH": 8350},
    "R-202": {"crista": 7500, "LSH": 8200, "LSHH": 8350},
    # caixa de selagem e coleta do digestato, no chão (fundo interno a +0,15)
    "CS-301": {"LSLL": 700, "LSL": 800, "LSH": 1000, "LSHH": 1100, "extravasor": 1360,
               "copo": 1500},
    "TQ-301": {"LSL": 1200, "LSH": 3600, "LSHH": 3850, "extravasor": 4000},
}
SELO_MIN = 330.0          # mm de polpa no copo de selagem (≈ 33 mbar): 2,7× a abertura do dispositivo
                          # de emergência (+12 mbar) e 4× o envelope de vácuo (−8 mbar R-201/202;
                          # −6 mbar R-101, emergência −4/−5); RES-001 LQ-04 pede ≥ 250 mm
TOPO_ALIM = 900.0         # linha de alimentação cruza o tampo a +0,9 m e desce ao N1 (tubo de imersão)
S_DESC = 0.40             # declividade mínima de projeto das descidas livres (as adotadas ficam ≥ 0,64)


N2_USO = {"retirada": "retirada pelo fundo à P-201 (bomba volumétrica; LC + XV falha-fecha; "
                      "só com o reator ligado à bolsa GH-1 que recebe)",
          "purga": "purga de lodo pela P-301 (manifold com chave presa; LC + XV falha-fecha; "
                   "vazão ≤ deslocamento da bomba ≪ Q_máx)"}


def reator(tag, desenho, centro, Di, Hcil, t, r_n1, elev_n1, elev_m2, az_sai, az_lshh, n2,
           n1_reserva=None, sai=True):
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
                   "respiro 8\" PVC chapéu chinês → flange 8\" Classe 150 + flange cego "
                   "multitomada (abrir só na purga OP-02); tomadas independentes PSLL/PAHH "
                   "(LAC-048)", az=180, raio=r_n1, elev=elev_n1,
                   origem=desenho))
    if sai:
        b.append(Bocal("N-SAI", 150, "costado", "novo",
                       "saída por gravidade no nível: soleira interna do bocal = N.A. "
                       f"(+{nv['crista'] / 1000:.2f}); segue ao copo de selagem no tanque do chão",
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
C = {"R-101": (0, 0), "R-201": (11500, 0), "R-202": (18000, 0),
     "TQ-301": (14750, -6000), "CS-301": (11800, -5200)}
# bocais de chegada dos reatores no tampo da CS-301 (copos internos sob eles)
CS_E = {"R-201": (C["CS-301"][0] - 450, C["CS-301"][1] + 350),
        "R-202": (C["CS-301"][0] + 450, C["CS-301"][1] + 350)}
R_N1 = {"R-101": 1000, "R-201": 1300}
TQ301_N1 = {az: (C["TQ-301"][0] + 1250 * direcao(az).X, C["TQ-301"][1] + 1250 * direcao(az).Y)
            for az in (0, 90, 180, 270)}


def montar_tanques(m):
    tq = {}
    tq["R-101"] = reator("R-101", "315E-25", C["R-101"], 3200, 4700, 7, R_N1["R-101"],
                         4850, 4870, az_sai=90, az_lshh=65, n2={135: "retirada"},
                         n1_reserva=45, sai=False)
    az201 = round(az_para(C["R-201"], CS_E["R-201"]) * 2) / 2
    az202 = round(az_para(C["R-202"], CS_E["R-202"]) * 2) / 2
    tq["R-201"] = reator("R-201", "315D-25", C["R-201"], 3800, 9300, 12, R_N1["R-201"],
                         9450, 9470, az_sai=az201, az_lshh=110, n2={135: "purga"})
    tq["R-202"] = reator("R-202", "315D-25", C["R-202"], 3800, 9300, 12, R_N1["R-201"],
                         9450, 9470, az_sai=az202, az_lshh=250, n2={135: "purga"})
    nv = NIVEL["TQ-301"]
    b301 = []
    for az, est, serv in ((0, "tamponar", "sem uso: flange cego (reserva para respiro tratado, "
                                          "LAC-049)"),
                          (90, "tamponar", "sem uso: flange cego"),
                          (180, "usar", "LT-301 (radar)"),
                          (270, "usar", "chegada do digestato pela P-301 (descarga livre)")):
        b301.append(Bocal(f"N1-{az}", 150, "tampo", est, serv, az=az, raio=1250, elev=4660,
                          origem="315A-25"))
    for az in (0, 90, 180, 270):
        b301.append(Bocal(f"N2-{az}", 150, "costado", "tamponar", "sem uso: flange cego PRFV",
                          az=az, elev=2480, origem="315A-25"))
    b301 += [
        Bocal("N3", 150, "fundo", "usar", "dreno do cone; sucção alternativa da P-301 "
              "(recirculação/expedição)", elev=500,
              origem="315A-25"),
        Bocal("M1", 600, "tampo", "tamponar", "boca de visita: tampa cega", raio=0, elev=4680,
              proj=140, origem="315A-25"),
        Bocal("N-EXT", 150, "costado", "novo", "extravasor livre (sem válvula)", az=200,
              elev=nv["extravasor"] + 76, origem="novo (CSTR)", soleira=nv["extravasor"]),
        Bocal("N-LSHH", 50, "costado", "novo", "LSHH garfo (trip da P-301)", az=160,
              elev=nv["LSHH"], origem="novo (CSTR)"),
    ]
    tq["TQ-301"] = TanquePRFV("TQ-301", "315A-25", C["TQ-301"], 3000, 2140, 2400, t=10,
                              fundo="conico", h_cone=1500, pes=[20, 110, 200, 290],
                              tampo="atmosferico", bocais=b301, escada_az=225, niveis=nv)
    nv = NIVEL["CS-301"]
    zt = 150 + 1650
    import math as _m
    b_cs = [Bocal(f"N-E{t[2:]}", 150, "tampo", "novo", f"chegada do {t}: tubo mergulhado do "
                  f"copo CP-{t[2:]}", az=az_para(C["CS-301"], CS_E[t]),
                  raio=_m.hypot(CS_E[t][0] - C["CS-301"][0], CS_E[t][1] - C["CS-301"][1]),
                  elev=zt + 150, origem="novo (CSTR)") for t in ("R-201", "R-202")]
    b_cs += [
        Bocal("N-SUC", 150, "costado", "novo", "sucção da P-301 (quebra-vórtice)", az=270,
              elev=450, origem="novo (CSTR)"),
        Bocal("N-EXT", 150, "costado", "novo", "extravasor livre à contenção", az=180,
              elev=nv["extravasor"] + 76, origem="novo (CSTR)", soleira=nv["extravasor"]),
        Bocal("N-DRE", 50, "costado", "novo", "dreno de fundo com registro", az=200, elev=250,
              origem="novo (CSTR)"),
        Bocal("N-BYP", 100, "costado", "tamponar", "by-pass da P-301: engate rápido para "
              "bomba móvel (cego com engate)", az=160, elev=450, origem="novo (CSTR)"),
        Bocal("N-LT", 80, "tampo", "novo", "LT-301C (radar)", az=180, raio=600, elev=zt + 150,
              origem="novo (CSTR)"),
        Bocal("N-RESP", 100, "tampo", "novo", "respiro ao FCA-301", az=270, raio=600,
              elev=zt + 150, origem="novo (CSTR)"),
        Bocal("N-LSLL", 50, "costado", "novo", "LSLL garfo (trip da P-301)", az=240,
              elev=nv["LSLL"], origem="novo (CSTR)"),
        Bocal("N-LSHH", 50, "costado", "novo", "LSHH garfo (trip P-201 e purgas)", az=120,
              elev=nv["LSHH"], origem="novo (CSTR)"),
    ]
    b_cs += [Bocal(f"N-AT{t[2:]}", 50, "tampo", "novo", f"pH/ORP da saída do {t} (sonda no "
                   f"copo CP-{t[2:]})", az=az_para(C["CS-301"], (CS_E[t][0], CS_E[t][1] + 225)),
                   raio=_m.hypot(CS_E[t][0] - C["CS-301"][0], CS_E[t][1] + 225 - C["CS-301"][1]),
                   elev=zt + 150, origem="novo (CSTR)") for t in ("R-201", "R-202")]
    tq["CS-301"] = TanquePRFV("CS-301", "novo (CSTR)", C["CS-301"], 2000, 150, 1650, t=10,
                              tampo="fechado", bocais=b_cs, escada_az=None, guarda_corpo=False,
                              niveis=nv)
    for t_ in tq.values():
        prfv.construir(m, t_)
    # copos de selagem internos (fecho hídrico independente do nível da caixa)
    for t in ("R-201", "R-202"):
        prfv.copo_selagem(m, f"CP-{t[2:]}", tq["CS-301"], CS_E[t], NIVEL["CS-301"]["copo"],
                          SELO_MIN, zt, Di=560)
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
    t3 = tq["TQ-301"]
    prfv.instrumento(m, t3, "N1-180", "LT", "radar")
    prfv.instrumento(m, t3, "N-LSHH", "LSHH", "garfo")
    cs = tq["CS-301"]
    prfv.instrumento(m, cs, "N-LT", "LT", "radar")
    prfv.instrumento(m, cs, "N-LSLL", "LSLL", "garfo")
    prfv.instrumento(m, cs, "N-LSHH", "LSHH", "garfo")
    for t in ("R-201", "R-202"):
        prfv.instrumento(m, cs, f"N-AT{t[2:]}", "AIT", "ph",
                         comprimento=cs.bocal(f"N-AT{t[2:]}").elev - 1250)


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


def _sobre_tampo(m, tq, tag, de_xy, n1, dz=1300):
    """Pontos do respiro: sobe acima do guarda-corpo (tampo + 1,30 m), cruza com 1 % de queda
    para o reator e desce no N1 (sem ponto baixo: o condensado volta ao reator, SP-13)."""
    Pn1, _ = P(m, f"{tag}.{n1.tag}")
    top = V(de_xy.X, de_xy.Y, tq[tag].z_tampo + dz)
    dist = math.hypot(Pn1.X - top.X, Pn1.Y - top.Y)
    return [xyz(top), xyz(V(Pn1.X, Pn1.Y, top.Z - 0.01 * dist))]


def _plano(v):
    return V(v.X, v.Y, 0)


def saida(m, tq, L, tag, dest_porta, copo):
    """Saída por gravidade no nível: N-SAI (soleira = N.A.) → registro LO (faca) → tê do
    respiro de equalização (ao gás, por um N1) → descida com lâmina livre → bocal do tanque
    de destino no chão → tubo mergulhado no COPO DE SELAGEM INTERNO (borda acima do nível
    máximo do tanque: o fecho não depende do nível) → transborda no tanque."""
    F, n = P(m, f"{tag}.N-SAI")
    D, nD = P(m, dest_porta)
    A = F + n * 600
    if abs(nD.Z) > 0.9:                               # bocal de tampo: chega na vertical
        d = (_plano(D) - _plano(A)).length
        zB = max(A.Z - d, D.Z + 500)                  # 45° até onde der, depois vertical
        pts = [xyz(A), xyz(V(D.X, D.Y, zB))]
    else:                                             # bocal de costado: entra na horizontal
        pts = [xyz(A), xyz(D + nD * 400)]
    L.append({**PEAD, "tag": f"{tag}-SAI", "servico": "esgoto", "regime": "selada", "de": 160,
              "raio_curva": 1.0, "suportes": False, "origem": f"{tag}.N-SAI",
              "pontos": pts, "destino": dest_porta, "copo": copo, "lamina_livre": True,
              "curvas_sob_medida": True,
              "componentes": [{"tipo": "gaveta", "tag": f"V-{tag[2:]}SAI", "distancia": 60,
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "LO (faca), ZSC; chave presa com V-xRS"}]})
    # respiro de equalização: a geratriz superior da descida fica sempre ligada ao gás, mesmo
    # com o N-SAI afogado (τy alto) — sem ele a descida enche e sifona o reator até o bocal
    n1 = _n1_livre(tq, tag, tq[tag].bocal("N-SAI").az, f"{tag}-RS")
    Pt = F + n * 420
    L.append({**PEAD, "tag": f"{tag}-RS", "servico": "ar", "regime": "ventilacao", "de": 90,
              "suportes": False, "fechada": True,
              "origem": {"te": f"{tag}-SAI", "ponto": xyz(Pt), "direcao": [0, 0, 1]},
              "pontos": _sobre_tampo(m, tq, tag, Pt, n1), "destino": f"{tag}.{n1.tag}",
              "componentes": [{"tipo": "gaveta", "tag": f"V-{tag[2:]}RS", "distancia": "fim",
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "LO; mesma chave presa da V-xSAI"},
                              {"tipo": "reducao", "tag": f"A-{tag[2:]}RS", "de2": 160,
                               "distancia": "fim"}]})


def _sobe_ao_n1(m, tq, tag, az_sobe, n1):
    """Ponto de subida fora do reator (estrutura própria) e topo da travessia do tampo."""
    r = tq[tag]
    # 12° fora do eixo do N1: a travessia passa entre os montantes do guarda-corpo (15° + 30k)
    Rp = V(*C[tag], 0) + direcao(az_sobe - 12) * (r.R + r.t + 600)
    Pn, _ = P(m, f"{tag}.{n1.tag}")
    z_top = r.z_tampo + TOPO_ALIM
    return Rp, Pn, z_top


def alimentacao(m, tq, L):
    """Alimentação pelo TAMPO com tubo de imersão (C1, F02 Rev. B): uma só subida por reator,
    quebra-sifão passivo pelo furo do tubo no espaço de gás (sem ventosa em lodo)."""
    # R-101: P-101 (Ilha 1) pelo tie-in a oeste
    n1 = _n1_livre(tq, "R-101", 225, "R-101-AL")
    Rp, Pn, zt = _sobe_ao_n1(m, tq, "R-101", 225, n1)
    prfv.tubo_imersao(m, tq["R-101"], n1.tag, 1200, tq["R-101"].z_tampo - 250)
    L.append({**PEAD, "tag": "R-101-AL", "servico": "esgoto", "regime": "pressao", "de": 90,
              "raio_curva": 2.0, "vazao_ls": round(6 / 3.6, 2), "suportes": False,
              "origem": {"ponto": [-6500, round(Rp.Y, 1), 1200], "direcao": [1, 0, 0],
                         "descricao": "descarga da P-101 (Ilha 1)"},
              "pontos": [xyz(V(Rp.X, Rp.Y, 1200)), xyz(V(Rp.X, Rp.Y, zt)), xyz(V(Pn.X, Pn.Y, zt))],
              "destino": f"R-101.{n1.tag}", "crista": 2, "imersao": (1200, n1.tag),
              "ponto_alto": "quebra-sifão pelo furo do tubo de imersão (espaço de gás)",
              "componentes": [{"tipo": "retencao", "tag": "V-101RT", "distancia": 300,
                               "rotulo": "Válvula de retenção de esfera flangeada"},
                              {"tipo": "gaveta", "tag": "V-101BQ",
                               "rotulo": "Válvula guilhotina (faca) flangeada"},
                              {"tipo": "junta_desmontagem", "tag": "JD-101"},
                              {"tipo": "reducao", "tag": "A-101ENT", "de2": 160, "distancia": "fim"},
                              {"tipo": "gaveta", "tag": "V-101ENT", "distancia": "fim",
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "LO, no tampo (isolamento do reator)"}]})
    # P-201: retira do R-101 pelo fundo; NaOH/bicarbonato em linha + misturador estático + pH/ORP
    prfv.bomba_pcp(m, "P-201", (2600, -3000, -150), 0, 150, 80)
    F, n = P(m, "R-101.N2-135")
    a = F + n * 600
    Sp, _ = P(m, "P-201.succao")
    L.append({**PEAD, "tag": "L-101S", "servico": "esgoto", "regime": "pressao", "de": 160,
              "raio_curva": 1.0, "suportes": False, "origem": "R-101.N2-135",
              "curvas_sob_medida": True, "pontos": [xyz(a), xyz(V(Sp.X, a.Y, a.Z))],
              "destino": "P-201.succao",
              "componentes": [{"tipo": "gaveta", "tag": "V-101S", "distancia": 60,
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "LO; isolamento do R-101"},
                              {"tipo": "gaveta", "tag": "XV-101S",
                               "rotulo": "Válvula guilhotina (faca) flangeada, atuada falha-fecha",
                               "nota": "abre só com a P-201 em marcha e o R-101 ligado à bolsa "
                                       "GH-1 que recebe"}]})
    R, _ = P(m, "P-201.recalque")
    y_h, z_h = -3000, 1200
    n1a = _n1_livre(tq, "R-201", 135, "R-201-AL")
    Rp1, Pn1, zt1 = _sobe_ao_n1(m, tq, "R-201", 135, n1a)
    prfv.tubo_imersao(m, tq["R-201"], n1a.tag, 2500, tq["R-201"].z_tampo - 250)
    x_dos, x_te = 6800, 10200
    L.append({**PEAD, "tag": "R-201-AL", "servico": "esgoto", "regime": "pressao", "de": 90,
              "raio_curva": 2.0, "vazao_ls": round(6 / 3.6, 2), "suportes": False,
              "origem": "P-201.recalque",
              "pontos": [xyz(V(R.X + 1300, R.Y, R.Z)), xyz(V(R.X + 1300, y_h, z_h)),
                         xyz(V(Rp1.X, y_h, z_h)), xyz(V(Rp1.X, Rp1.Y, z_h)),
                         xyz(V(Rp1.X, Rp1.Y, zt1)), xyz(V(Pn1.X, Pn1.Y, zt1))],
              "destino": f"R-201.{n1a.tag}", "crista": 5, "imersao": (2500, n1a.tag),
              "ponto_alto": "quebra-sifão pelo furo do tubo de imersão (espaço de gás)",
              "componentes": [{"tipo": "retencao", "tag": "V-201RT", "distancia": 150,
                               "rotulo": "Válvula de retenção de esfera flangeada"},
                              {"tipo": "gaveta", "tag": "V-201BQ",
                               "rotulo": "Válvula guilhotina (faca) flangeada"},
                              {"tipo": "junta_desmontagem", "tag": "JD-201"},
                              {"tipo": "misturador_estatico", "tag": "MX-201",
                               "distancia": {"trecho": 2, "pos": "inicio", "offset": 1600},
                               "rotulo": "Misturador estático em linha (neutralização)"},
                              {"tipo": "medidor", "tag": "AIT-201",
                               "rotulo": "pH/ORP em linha na entrada dos metanogênicos (AIC-201 "
                                         "comanda a dosagem)"},
                              {"tipo": "medidor", "tag": "FQIT-201",
                               "rotulo": "Medidor eletromagnético de vazão com totalizador "
                                         "(volume por pulso)"},
                              {"tipo": "gaveta", "tag": "XV-211",
                               "distancia": {"trecho": 2, "pos": "fim", "offset": -300},
                               "rotulo": "Válvula guilhotina (faca) atuada falha-fecha (pulso "
                                         "ao R-201)",
                               "nota": "intertravada com XV-221: pulsos alternados"},
                              {"tipo": "reducao", "tag": "A-201ENT", "de2": 160, "distancia": "fim"},
                              {"tipo": "gaveta", "tag": "V-201ENT", "distancia": "fim",
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "LO, no tampo"}]})
    # dosagem do alcalinizante antes do misturador estático
    prfv.skid_dosagem(m, "DOS-201", (x_dos - 1900, -1700), "DOS-201.recalque")
    Dd, _ = P(m, "DOS-201.recalque")
    L.append({**PEAD, "tag": "L-DOS201", "servico": "quimico", "regime": "pressao", "de": 32,
              "suportes": False, "cor": "servico", "nao_newtoniano": False,
              "origem": "DOS-201.recalque",
              "pontos": [xyz(V(x_dos, Dd.Y, Dd.Z)), xyz(V(x_dos, Dd.Y, z_h))],
              "destino": {"te": "R-201-AL", "ponto": [x_dos, y_h, z_h], "direcao": [0, 1, 0]},
              "ponto_alto": "injeção pressurizada pela dosadora (respiro no skid)",
              "componentes": [{"tipo": "retencao", "tag": "V-DOSRT", "distancia": 150,
                               "rotulo": "Válvula de retenção de injeção (química)"},
                              {"tipo": "gaveta", "tag": "V-DOS",
                               "rotulo": "Válvula de bloqueio da injeção"},
                              {"tipo": "junta_desmontagem", "tag": "JD-DOS"}]})
    # R-202: ramal depois da medição, pulso pela XV-221
    n1b = _n1_livre(tq, "R-202", 135, "R-202-AL")
    Rp2, Pn2, zt2 = _sobe_ao_n1(m, tq, "R-202", 135, n1b)
    prfv.tubo_imersao(m, tq["R-202"], n1b.tag, 2500, tq["R-202"].z_tampo - 250)
    L.append({**PEAD, "tag": "R-202-AL", "servico": "esgoto", "regime": "pressao", "de": 90,
              "raio_curva": 2.0, "suportes": False,
              "origem": {"te": "R-201-AL", "ponto": [x_te, y_h, z_h], "direcao": [0, -1, 0]},
              "pontos": [xyz(V(x_te, -3750, z_h)), xyz(V(Rp2.X, -3750, z_h)),
                         xyz(V(Rp2.X, Rp2.Y, z_h)), xyz(V(Rp2.X, Rp2.Y, zt2)),
                         xyz(V(Pn2.X, Pn2.Y, zt2))],
              "destino": f"R-202.{n1b.tag}", "crista": 4, "imersao": (2500, n1b.tag),
              "ponto_alto": "quebra-sifão pelo furo do tubo de imersão (espaço de gás)",
              "componentes": [{"tipo": "gaveta", "tag": "XV-221",
                               "distancia": {"trecho": 1, "pos": "inicio", "offset": 200},
                               "rotulo": "Válvula guilhotina (faca) atuada falha-fecha (pulso "
                                         "ao R-202)",
                               "nota": "intertravada com XV-211: pulsos alternados"},
                              {"tipo": "reducao", "tag": "A-202ENT", "de2": 160, "distancia": "fim"},
                              {"tipo": "gaveta", "tag": "V-202ENT", "distancia": "fim",
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "LO, no tampo"}]})


def linhas(m, tq):
    L = []
    saida(m, tq, L, "R-201", "CS-301.N-E201", "CP-201")
    saida(m, tq, L, "R-202", "CS-301.N-E202", "CP-202")

    alimentacao(m, tq, L)

    # --- P-301 junto à CS-301 (caixa no chão): transfere o digestato ao TQ-301 (armazenamento),
    # faz o retorno alcalino RL-05 e a expedição; sucção alternativa do N3 do TQ-301 por chave
    prfv.bomba_pcp(m, "P-301", (9590, C["CS-301"][1], 0), 270, 150, 100)
    L.append({**PEAD, "tag": "L-301S", "servico": "lodo", "regime": "pressao", "de": 160,
              "suportes": False, "origem": "CS-301.N-SUC", "pontos": [],
              "destino": "P-301.succao",
              "componentes": [{"tipo": "gaveta", "tag": "V-301S", "distancia": 60,
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "chave presa com V-301N3 (uma sucção por vez)"}]})
    N3, _ = P(m, "TQ-301.N3")
    Ss, _ = P(m, "P-301.succao")
    x_t3 = Ss.X + 250                              # tê depois da V-301S (s ≈ 450 mm)
    L.append({**PEAD, "tag": "L-301N3", "servico": "lodo", "regime": "pressao", "de": 160,
              "raio_curva": 1.0, "suportes": False, "origem": "TQ-301.N3",
              "ponto_alto": "tê na sucção (respiro manual na carcaça da P-301)",
              "pontos": [xyz(V(N3.X, N3.Y, 100)), xyz(V(N3.X, -6900, 100)),
                         xyz(V(x_t3, -6900, 100)), xyz(V(x_t3, -6900, Ss.Z))],
              "destino": {"te": "L-301S", "ponto": [round(x_t3, 1), round(Ss.Y, 1),
                                                     round(Ss.Z, 1)]},
              "componentes": [{"tipo": "gaveta", "tag": "V-301N3",
                               "distancia": {"trecho": 2, "pos": "inicio", "offset": 250},
                               "rotulo": "Válvula guilhotina (faca) flangeada",
                               "nota": "LC; chave presa com V-301S"}]})
    # purgas dos metanogênicos pela P-301 (bomba volumétrica: limite físico de vazão), entrando
    # no manifold de sucção pela linha do N3 do TQ-301; chave presa: uma sucção por vez
    for t, y_run, x_run in (("R-201", -2700, 13000), ("R-202", -3250, None)):
        Fq, nq = P(m, f"{t}.N2-135")
        a = Fq + nq * 900
        comps = [{"tipo": "gaveta", "tag": f"V-{t[2:]}PG", "distancia": 60,
                  "rotulo": "Válvula guilhotina (faca) flangeada",
                  "nota": "LC; chave presa única V-201PG × V-202PG × V-301S × V-301N3"},
                 {"tipo": "gaveta", "tag": f"XV-{t[2:]}PG",
                  "rotulo": "Válvula guilhotina (faca) flangeada, atuada falha-fecha",
                  "nota": "abre só com a P-301 em marcha e os permissivos de retirada"}]
        if t == "R-201":
            L.append({**PEAD, "tag": "R-201-PG", "servico": "lodo", "regime": "pressao",
                      "de": 160, "raio_curva": 1.0, "suportes": False, "origem": "R-201.N2-135",
                      "curvas_sob_medida": True,
                      "ponto_alto": "linha cheia pelo próprio reator; dreno e lavagem",
                      "pontos": [xyz(a), xyz(V(a.X, y_run, a.Z)), xyz(V(x_run, y_run, a.Z)),
                                 xyz(V(x_run, -6300, a.Z)), xyz(V(x_run, -6550, 100))],
                      "destino": {"te": "L-301N3", "ponto": [x_run, -6900, 100],
                                  "direcao": [0, 1, 0]},
                      "componentes": comps})
        else:
            L.append({**PEAD, "tag": "R-202-PG", "servico": "lodo", "regime": "pressao",
                      "de": 160, "raio_curva": 1.0, "suportes": False, "origem": "R-202.N2-135",
                      "ponto_alto": "linha cheia pelo próprio reator; dreno e lavagem",
                      "pontos": [xyz(a), xyz(V(a.X, y_run, a.Z)), xyz(V(13600, y_run, a.Z))],
                      "destino": {"te": "R-201-PG", "ponto": [13000, y_run, round(a.Z, 1)],
                                  "direcao": [1, 0, 0]},
                      "componentes": comps})
    R3, n3 = P(m, "P-301.recalque")
    y_r = R3.Y - 570
    x_r = 13500                                    # sobe a oeste do TQ-301 até o N1-270
    z_top = tq["TQ-301"].z_tampo + 1300
    L.append({**PEAD, "tag": "L-301R", "servico": "lodo", "regime": "pressao", "de": 110,
              "suportes": False, "origem": "P-301.recalque",
              "pontos": [xyz(V(R3.X, y_r, R3.Z)), xyz(V(x_r, y_r, R3.Z)),
                         xyz(V(x_r, y_r, z_top)), xyz(V(x_r, C["TQ-301"][1], z_top))],
              "destino": "TQ-301.N1-270",
              "componentes": [{"tipo": "retencao", "tag": "V-301RT",
                               "distancia": {"trecho": 1, "pos": "inicio", "offset": 150},
                               "rotulo": "Válvula de retenção de esfera flangeada"},
                              {"tipo": "gaveta", "tag": "V-301BQ",
                               "rotulo": "Válvula guilhotina (faca) flangeada"},
                              {"tipo": "junta_desmontagem", "tag": "JD-301"},
                              {"tipo": "ventosa", "tag": "VQ-301", "dn_ramal": 50,
                               "distancia": {"trecho": 3, "pos": "inicio", "offset": 150},
                               "rotulo": "Tê + ventosa de esgoto (corpo longo), quebra-vácuo a ar"},
                              {"tipo": "reducao", "tag": "R-301RD", "de2": 160, "distancia": "fim"}]})
    Fr, nr = P(m, "R-101.N2-135")
    y_rl = round((Fr + nr * 600).Y, 1)              # trecho reto da L-101S
    x_rl = 2100
    L.append({**PEAD, "tag": "L-RL05", "servico": "lodo", "regime": "pressao", "de": 90,
              "suportes": False, "ponto_alto": "tê na sucção da P-201",
              "origem": {"te": "L-301R", "ponto": [x_r, round(y_r, 1), 2600], "direcao": [-1, 0, 0]},
              "pontos": [xyz(V(x_rl, y_r, 2600)), xyz(V(x_rl, -2100, 2600)),
                         xyz(V(x_rl, -2100, 300))],
              "destino": {"te": "L-101S", "ponto": [x_rl, y_rl, 300], "direcao": [0, -1, 0]},
              "componentes": [{"tipo": "gaveta", "tag": "XV-RL05", "distancia": 400,
                               "rotulo": "Válvula guilhotina (faca) flangeada, atuada com FIT",
                               "nota": "retorno alcalino (RL-05) à sucção da P-201: só com a "
                                       "P-201 em marcha, vazão em razão com a dela"}]})
    L.append({**PEAD, "tag": "L-EXP", "servico": "lodo", "regime": "pressao", "de": 110,
              "suportes": False,
              "origem": {"te": "L-301R", "ponto": [x_r, round(y_r, 1), 1100], "direcao": [1, 0, 0]},
              "pontos": [], "destino": {"ponto": [x_r + 1200, round(y_r, 1), 1100],
                                        "descricao": "expedição (engate rápido de caminhão)"},
              "componentes": [{"tipo": "gaveta", "tag": "V-EXP", "distancia": "fim"}]})

    # --- extravasores livres e dreno (sem válvula no extravasor)
    for tq_tag, nome in (("TQ-301", "N-EXT"), ("CS-301", "N-EXT")):
        E, ne = P(m, f"{tq_tag}.{nome}")
        a = E + ne * 350
        L.append({**PEAD, "tag": f"L-{tq_tag.replace('TQ-', '').replace('-', '')}EX", "servico": "lodo", "regime": "selada",
                  "de": 160, "suportes": False, "origem": f"{tq_tag}.{nome}",
                  "pontos": [xyz(a)], "destino": {"ponto": [round(a.X, 1), round(a.Y, 1), 150],
                                                  "descricao": "caixa de contenção (LAC-044)"},
                  "transbordo": True})
    E, ne = P(m, "CS-301.N-DRE")
    a = E + ne * 500
    L.append({**PEAD, "tag": "L-CS301DR", "servico": "lodo", "regime": "pressao", "de": 63,
              "suportes": False, "origem": "CS-301.N-DRE", "pontos": [],
              "destino": {"ponto": [round(a.X, 1), round(a.Y, 1), round(a.Z, 1)],
                          "descricao": "dreno para a contenção"},
              "componentes": [{"tipo": "gaveta", "tag": "V-CSDR", "distancia": 60}]})
    # --- respiro da CS-301 (pode carregar biogás arrastado pelos copos) ao FCA-301
    prfv.filtro_carvao(m, "FCA-301", (10350, -4200), "FCA-301.entrada")
    Rr, _ = P(m, "CS-301.N-RESP")
    Fc, _ = P(m, "FCA-301.entrada")
    L.append({**PEAD, "tag": "L-CS301RP", "servico": "ar", "regime": "ventilacao", "de": 110,
              "suportes": False, "fechada": True, "origem": "CS-301.N-RESP",
              "pontos": [xyz(V(Rr.X, Rr.Y, 2600)), xyz(V(Fc.X - 400, Rr.Y, 2600)),
                         xyz(V(Fc.X - 400, Fc.Y, 2600)), xyz(V(Fc.X - 400, Fc.Y, Fc.Z))],
              "destino": "FCA-301.entrada"})

    sistema_gas(m, tq, L)
    return L


GASES = {"material": "pead", "pn": normas.CLASSE_ANSI, "servico": "biogas", "cor": "servico",
         "regime": "ventilacao", "fechada": True, "suportes": False}


def sistema_gas(m, tq, L):
    """Biogás em dois níveis de pressão.
    Reatores → potes de condensado → coletor → GH-1A / GH-1B (membrana simples, ≈ 0 a +2 mbar):
    uma bolsa RECEBE (entrada aberta, saída fechada) enquanto a outra TRANSFERE (entrada
    fechada, saída aberta, anti-retorno) pelos sopradores S-501 ao GH-2 (dupla membrana); do
    GH-2 seguem o flare e os consumidores. Nenhum soprador aspira o coletor dos reatores."""
    # potes de condensado no pé de cada descida e coletor ao GH-1
    pc = {"R-101": (3500, 3100), "R-201": (11500, 3500), "R-202": (18000, 3500)}
    for t, xy in pc.items():
        gas.pote_condensado(m, f"PC-{t[2:]}", xy, 1200, dn=100, az_saida=0)
    gas.gasometro_membrana(m, "GH-1A", (5000, 11000), 60)
    gas.gasometro_membrana(m, "GH-1B", (15500, 11000), 60)
    gas.soprador_skid(m, "S-501", (25000, 15400))
    gas.gasometro_dupla_membrana(m, "GH-2", (28500, 21500), 8000)
    gas.flare(m, "FL-501", (46000, 27500))
    gas.analisador(m, "AT-501", (9000, 5400))
    for t in ("R-101", "R-201", "R-202"):
        Gp, _ = P(m, f"{t}.N3-0")
        z_g = tq[t].z_tampo + 1700
        x, y = pc[t]
        cai = 0.01                                     # 1 % de volta ao reator (condensado)
        pts = [xyz(V(Gp.X, Gp.Y, z_g))]
        if abs(x - Gp.X) > 1:
            pts.append(xyz(V(x, Gp.Y, z_g + cai * abs(x - Gp.X))))
        pts.append(xyz(V(x, y, z_g + cai * (abs(x - Gp.X) + abs(y - Gp.Y)))))
        L.append({**GASES, "tag": f"{t}-GAS", "de": 63, "origem": f"{t}.N3-0", "pontos": pts,
                  "destino": f"PC-{t[2:]}.E",
                  "componentes": [{"tipo": "gaveta", "tag": f"V-{t[2:]}GAS", "distancia": 200,
                                   "rotulo": "Válvula esfera/gaveta LO com ZSC (ramal de gás)",
                                   "nota": "LO + ZSC (permissivo de retirada)"},
                                  {"tipo": "reducao", "tag": f"A-{t[2:]}GAS", "de2": 110,
                                   "distancia": "fim"}]})
    E1, _ = P(m, "GH-1A.E")
    E2, _ = P(m, "GH-1B.E")
    S2, _ = P(m, "PC-202.S")
    y_c, z_c = 4600, 800
    L.append({**GASES, "tag": "COL-501", "de": 110, "origem": "PC-202.S",
              "pontos": [xyz(V(S2.X, y_c, z_c)), xyz(V(E1.X, y_c, z_c))],
              "destino": "GH-1A.E",
              "componentes": [{"tipo": "borboleta", "tag": "XV-GH1A-E",
                               "distancia": {"trecho": 2, "pos": "meio"},
                               "rotulo": "Válvula borboleta atuada falha-ABRE (entrada GH-1A)",
                               "nota": "nunca as duas entradas fechadas; abre antes de a outra fechar"}]})
    L.append({**GASES, "tag": "COL-501B", "de": 110,
              "origem": {"te": "COL-501", "ponto": [E2.X, y_c, z_c], "direcao": [0, 1, 0]},
              "pontos": [], "destino": "GH-1B.E",
              "componentes": [{"tipo": "borboleta", "tag": "XV-GH1B-E", "distancia": 600,
                               "rotulo": "Válvula borboleta atuada falha-ABRE (entrada GH-1B)"}]})
    for t in ("R-101", "R-201"):
        Sx, _ = P(m, f"PC-{t[2:]}.S")
        L.append({**GASES, "tag": f"PC-{t[2:]}-COL", "de": 110, "origem": f"PC-{t[2:]}.S",
                  "pontos": [], "destino": {"te": "COL-501", "ponto": [Sx.X, y_c, z_c],
                                          "direcao": [0, -1, 0]}})
    # transferência GH-1 → S-501 → GH-2 (linhas exclusivas de retirada, com anti-retorno)
    Sa, _ = P(m, "GH-1A.S")
    Sb, _ = P(m, "GH-1B.S")
    Ssu, _ = P(m, "S-501.S")
    y_t, z_t = 15400, 700
    L.append({**GASES, "tag": "TR-501", "de": 110, "origem": "GH-1A.S",
              "pontos": [xyz(V(Sa.X, y_t, z_t)), xyz(V(Ssu.X - 1400, y_t, z_t))],
              "destino": "S-501.S",
              "componentes": [{"tipo": "borboleta", "tag": "XV-GH1A-S",
                               "distancia": {"trecho": 0, "pos": "meio"},
                               "rotulo": "Válvula borboleta atuada falha-FECHA (saída GH-1A)",
                               "nota": "só abre com XV-GH1A-E fechada (ZSC) e XV-GH1B-E aberta"},
                              {"tipo": "retencao", "tag": "V-GH1A-RT",
                               "distancia": {"trecho": 1, "pos": "inicio", "offset": 200},
                               "rotulo": "Válvula de retenção (anti-retorno) de gás"},
                              {"tipo": "borboleta", "tag": "PCV-501", "distancia": "fim",
                               "rotulo": "Válvula autoatuada mantenedora de pressão a montante "
                                         "(≈ +0,3 mbar na bolsa; mecânica, sem energia)"},
                              {"tipo": "corta_chamas", "tag": "FA-501", "distancia": "fim"},
                              {"tipo": "gaveta", "tag": "V-501S", "distancia": "fim"}]})
    L.append({**GASES, "tag": "TR-501B", "de": 110, "origem": "GH-1B.S",
              "pontos": [], "destino": {"te": "TR-501", "ponto": [Sb.X, y_t, z_t], "direcao": [0, -1, 0]},
              "componentes": [{"tipo": "borboleta", "tag": "XV-GH1B-S", "distancia": 300,
                               "rotulo": "Válvula borboleta atuada falha-FECHA (saída GH-1B)"},
                              {"tipo": "retencao", "tag": "V-GH1B-RT",
                               "rotulo": "Válvula de retenção (anti-retorno) de gás"}]})
    Sd, _ = P(m, "S-501.D")
    E3, _ = P(m, "GH-2.E")
    L.append({**GASES, "tag": "TR-502", "de": 110, "origem": "S-501.D",
              "pontos": [xyz(V(E3.X, Sd.Y, Sd.Z))], "destino": "GH-2.E",
              "componentes": [{"tipo": "retencao", "tag": "V-502RT", "distancia": 150,
                               "rotulo": "Válvula de retenção (anti-retorno) de gás"},
                              {"tipo": "gaveta", "tag": "V-502"}]})
    S3, _ = P(m, "GH-2.S")
    Fe, _ = P(m, "FL-501.E")
    L.append({**GASES, "tag": "GS-501", "de": 110, "origem": "GH-2.S",
              "pontos": [xyz(V(S3.X, Fe.Y, Fe.Z))], "destino": "FL-501.E",
              "componentes": [{"tipo": "gaveta", "tag": "V-GH2S", "distancia": 150},
                              {"tipo": "borboleta", "tag": "XV-FL", "distancia": "fim",
                               "rotulo": "Válvula borboleta atuada falha-FECHA (flare)"},
                              {"tipo": "corta_chamas", "tag": "FA-502", "distancia": "fim"}]})
    L.append({**GASES, "tag": "TI-501", "de": 110,
              "origem": {"te": "GS-501", "ponto": [36000, Fe.Y, Fe.Z], "direcao": [0, 1, 0]},
              "pontos": [], "destino": {"ponto": [36000, Fe.Y + 1600, Fe.Z],
                                        "descricao": "tie-in dos consumidores (SK-501, GE-601, "
                                                     "caldeira)"},
              "componentes": [{"tipo": "retencao", "tag": "V-TI-RT", "distancia": 200},
                              {"tipo": "retencao", "tag": "V-TI-RT2",
                               "rotulo": "Segunda retenção de gás (SP-09: refluxo do SK-501)"},
                              {"tipo": "corta_chamas", "tag": "FA-503"},
                              {"tipo": "gaveta", "tag": "V-TI", "distancia": "fim"}]})
    # by-pass do GH-2 (manutenção): descarga dos sopradores direto ao flare, com chave presa
    L.append({**GASES, "tag": "BYP-501", "de": 110,
              "origem": {"te": "TR-502", "ponto": [round(Sd.X + 900, 1), Sd.Y, Sd.Z],
                         "direcao": [0, -1, 0]},
              "pontos": [xyz(V(Sd.X + 900, Sd.Y - 900, Sd.Z)), xyz(V(34000, Sd.Y - 900, Sd.Z))],
              "destino": {"te": "GS-501", "ponto": [34000, Fe.Y, Fe.Z]},
              "componentes": [{"tipo": "gaveta", "tag": "V-BYP501",
                               "distancia": {"trecho": 1, "pos": "inicio", "offset": 300},
                               "nota": "LC com chave presa: só com o GH-2 isolado"}]})


def selo_e_lt(m, tq):
    """Os dois N1 que sobram em cada reator recebem o selo hidráulico e o radar de nível."""
    for tag in ("R-101", "R-201", "R-202"):
        livres = [b for b in tq[tag].bocais if b.tag.startswith("N1-") and not b.ligacao
                  and b.estado == "usar"]
        prfv.selo_hidraulico(m, tq[tag], livres[0].tag, "SH")
        prfv.instrumento(m, tq[tag], livres[1].tag, "LT", "radar")


def seguranca(m):
    """Itens de proteção e monitoramento sem geometria própria (vão à lista de materiais)."""
    for b in ("P-201", "P-301"):
        m.item("PSV (ou disco de ruptura) com retorno à origem, antes de qualquer válvula",
               f"descarga da {b} (PCP); ajuste abaixo da classe do PEAD SDR17", "un", 1)
        m.item("PSHH com trip da bomba + PSL na sucção (marcha a seco) + inversor", b, "cj", 1)
        m.item("Rotor/estator sobressalente em almoxarifado (reserva da PCP)", b, "cj", 1)
    m.item("Intertravamento por chave presa (uma sucção por vez na P-301: V-301S × V-301N3 × "
           "V-201PG × V-202PG)", "P-301", "cj", 1)
    m.item("Intertravamento XV-211 × XV-221 (pulsos alternados, nunca as duas abertas)",
           "alimentação R-201/202", "cj", 1)
    for t in ("R-201", "R-202"):
        m.item("Intertravamento por chave presa (V-xSAI × V-xRS: isolamento da saída)", t, "cj", 1)
    for t in ("R-101", "R-201", "R-202"):
        m.item("Chave de posição ZSC na V-xGAS e nas válvulas de isolamento (permissivos)", t,
               "cj", 1)
        m.item("Transmissor de temperatura TIT por reator (sem aquecimento, D5)", t, "un", 1)
    m.item("Bomba PCP móvel de reserva sobre skid com mangotes (engate N-BYP da CS-301; "
           "mobilização ≤ 30 min)", "reserva da P-301 e da P-201", "cj", 1)
    m.item("Conexões de lavagem com água (engate rápido) nas linhas de purga e de retirada",
           "R-201/202-PG, L-101S", "un", 3)
    m.item("Skid de sopradores de canal lateral ATEX IIC (A opera, B reserva com partida "
           "automática), 60 m³/h × ≈ 30 mbar", "S-501", "cj", 1)
    m.item("Alívio conduzido de cada GH-1 a chaminé fora do abrigo (≥ 27 Nm³/h a ≤ +5 mbar)",
           "GH-1A/B", "un", 2)
    m.item("Potes de dreno de condensado com selo ≥ 250 mm e controle de nível", "pontos baixos "
           "do COL-501 (entradas dos GH-1) e da TR-501 (antes do S-501)", "un", 3)
    m.item("Energia de emergência (UPS/gerador) para S-501, flare e intertravamentos", "gás",
           "cj", 1)
    m.item("Estrutura metálica leve de apoio (subidas de alimentação ao tampo, rack a +1,2 m e "
           "descidas SAI; sem carga horizontal no PRFV)", "ver LAC-047", "cj", 1)
    m.item("Lógica de alternância GH-1A/GH-1B (entradas falha-abre, saídas falha-fecha, "
           "ZSO/ZSC em todas as XV)", "CLP + intertravamento hardwired", "cj", 1)
    m.item("PSLL na bolsa que transfere (≤ +0,5 mbar), PSLL de sucção (−5 mbar) e TSHH nos "
           "corta-chamas", "S-501", "cj", 1)
    m.item("PSHH no coletor junto ao tie-in (SP-09)", "TI-501", "un", 1)
    for loc in ("abrigo GH-1A/B", "skid S-501", "GH-2", "CS-301", "P-201/DOS-201", "flare"):
        m.item("Detector de gás CH₄ (%LIE) e H₂S fixo", loc, "un", 1)


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
