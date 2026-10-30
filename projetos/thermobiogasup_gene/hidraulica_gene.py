"""Memória hidráulica da cascata Gen E com polpa de 8% ST (plástico de Bingham).

Calcula, para os 3 casos de reologia (otimista/central/pessimista):
- saídas por gravidade no nível: subida do nível do reator sobre a soleira do N-SAI, descidas
  com lâmina livre, copo de selagem interno (tubo mergulhado + ânulo + borda), folga entre a
  superfície interna do copo e a soleira, fecho em mbar;
- alças de entrada pressurizadas (ventosa na crista ligada ao gás) e demais recalques: AMT,
  pressão na crista, sucção e NPSH;
- perfis de linha de energia (LE) e linha piezométrica (LP) de todos os trens.

Perdas localizadas pelo 2-K de Hooper, K = K1/Re + K∞(1 + 1/D[pol]), com o Re de Metzner–Reed
(Re_MR = 8ρv²/τw) no termo laminar: em polpa com tensão de escoamento ele vale ≈ 1, e cada
curva custa K1·τw/(16ρg) — da ordem de 0,5 m numa curva de 90° com τy = 100 Pa. Usar o Re de
Bingham (μp) subestimaria essas perdas em ~75×.
Unidades: m, m³/h, mbar. Cotas na base comum z = 0 (premissa de S5).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".claude/skills/modelagem-3d-engenharia/scripts"))
from hidraulica import reologia as rg  # noqa: E402

G = 9.81
Q_PROJ = 6.0          # m³/h: vazão máxima das PCP 2–6 m³/h (alimentação = descarga por gravidade)
Q_MAX = 20.0          # m³/h: Q_máx de retirada da RES-001 §5.6 (só verificação de folga)
P_GAS_OP = 3.5        # mbar: operação máxima do espaço de gás (RES-001, cascata B)
P_ATM_KPA = 91.3      # sítio de referência Congonhas/MG (RES-001 §5.5, LAC-027), ≈ 870 m
P_VAP_KPA = 5.6       # água a 35 °C (mesofílico)
TURNO_POTE = 0.30     # m: caminho equivalente da virada de 180° no fundo do copo (estimativa)
# Hooper (1981): (K1, K∞). Tê: flangeado usado como curva (ramal) e passagem direta.
HOOPER = {"curva90": (800, 0.25), "curva45": (500, 0.15), "gaveta": (300, 0.10),
          "retencao": (1500, 1.50), "te_ramal": (800, 0.80), "te_passagem": (150, 0.05),
          "reducao": (160, 0.50), "junta_desmontagem": (100, 0.05), "ventosa": (150, 0.05),
          "entrada": (160, 0.50), "saida": (0, 1.00)}


def _k(nome: str, re_mr: float, D: float) -> float:
    k1, kinf = HOOPER[nome]
    return k1 / max(re_mr, 1e-6) + kinf * (1 + 1 / (D / 0.0254))


def _tubos(ln):
    """[(s_ini_mm, di_m)] ao longo da linha (reduções/ampliações incluídas)."""
    return [(s, t.di / 1000) for s, t in sorted(ln.tubos_por_s, key=lambda x: x[0])]


def _di_em(ln, s):
    d = None
    for s0, di in _tubos(ln):
        if s >= s0 - 1e-6:
            d = di
    return d


def perda(m, ln, s_a: float, s_b: float, Q: float, f: rg.Bingham, extra_k=()) -> dict:
    """Perda de carga (m de polpa) entre s_a e s_b (mm) de uma linha que escoa cheia."""
    cortes = sorted({s_a, s_b} | {s for s, _ in _tubos(ln) if s_a < s < s_b})
    hf = part = 0.0
    v_max = 0.0
    re_mr_min = 1e9
    for a, b in zip(cortes, cortes[1:]):
        D = _di_em(ln, (a + b) / 2)
        p = rg.perda_tubo(Q, D, (b - a) / 1000, f)
        hf += p["hf"]
        part += rg.carga_partida(D, (b - a) / 1000, f)
        v_max = max(v_max, p["v"])
    ks = [(k, s_a) for k in extra_k]
    for el in ln.elementos:
        if el[0] == "curva" and s_a <= el[7] < s_b:
            ks.append(("curva90" if el[6] > 60 else "curva45", el[7]))
    for c in ln.componentes:
        if s_a <= c.s0 < s_b and c.tipo in HOOPER:
            ks.append((c.tipo, c.s0))
    for t in getattr(m, "tes", {}).get(ln.tag, []):
        if s_a <= t["s"] < s_b:
            ks.append(("te_passagem", t["s"]))
    hk = 0.0
    for nome, s in ks:
        D = _di_em(ln, s)
        p = rg.perda_tubo(Q, D, 1.0, f)
        re_mr = 8 * f.rho * p["v"] ** 2 / p["tau_w"]
        re_mr_min = min(re_mr_min, re_mr)
        hk += _k(nome, re_mr, D) * p["v"] ** 2 / (2 * G)
    return {"hf": hf, "hk": hk, "h": hf + hk, "v": v_max, "partida": part,
            "L": (s_b - s_a) / 1000, "n_sing": len(ks), "Re_MR": re_mr_min}


def y_critico(Q_m3h: float, D: float) -> float:
    """Profundidade crítica (m) num tubo circular (newtoniano; lâmina na soleira)."""
    Q = Q_m3h / 3600
    lo, hi = 1e-4, D * 0.999
    for _ in range(100):
        y = (lo + hi) / 2
        th = 2 * math.acos(1 - 2 * y / D)
        A = D ** 2 / 8 * (th - math.sin(th))
        T = D * math.sin(th / 2)
        if Q ** 2 * T / (G * A ** 3) > 1:
            lo = y
        else:
            hi = y
    return (lo + hi) / 2


def _cadeia(ln):
    """Abscissa (m, a mesma s dos elementos, com arcos) e cota do eixo (m) ao longo da linha."""
    out = []
    for el in ln.elementos:
        if el[0] == "reto":
            out += [(el[4] / 1000, el[1].Z / 1000), (el[5] / 1000, el[2].Z / 1000)]
        else:
            out += [(el[7] / 1000, el[1].Z / 1000), ((el[7] + el[8]) / 2000, el[2].Z / 1000),
                    (el[8] / 1000, el[3].Z / 1000)]
    return out


def _s_do_te(m, ln, ramal_tag):
    t = next(t for t in m.tes[ln.tag] if t["ramal"] == ramal_tag)
    return t["s"] + t["L"] / 2


def _s_reto(ln, i):
    el = [e for e in ln.elementos if e[0] == "reto"][i]
    return (el[4] + el[5]) / 2


def _declividades(ln):
    """sen θ dos trechos retos descendentes (lâmina livre)."""
    out = []
    for el in ln.elementos:
        if el[0] == "reto":
            d = el[3]
            if d.Z < -0.05 and abs(d.Z) < 0.99:
                out.append(-d.Z)
    return out


def _horizontal_inicial(ln):
    """Comprimento (m) do trecho reto inicial horizontal (bocal → início da descida)."""
    el = ln.elementos[0]
    return (el[5] - el[4]) / 1000 if el[0] == "reto" and abs(el[3].Z) < 0.05 else 0.0


def _soleira_livre(Q, D, L_h, f, componentes=()):
    """Subida da lâmina numa soleira seguida de trecho horizontal curto: crítica + partida de
    tubo cheio no horizontal (conservador) + entrada e componentes (Hooper com Re_MR)."""
    yc = y_critico(Q, D)
    p = rg.perda_tubo(Q, D, 1.0, f)
    re_mr = 8 * f.rho * p["v"] ** 2 / p["tau_w"]
    hk = sum(_k(k, re_mr, D) for k in ("entrada",) + tuple(componentes)) * p["v"] ** 2 / (2 * G)
    return yc + rg.carga_partida(D, L_h, f) + hk, yc


def saida(m, tag: str, Q: float, f: rg.Bingham, nv: dict, p_gas_m: float = 0.0) -> dict:
    """Saída por gravidade no nível → descida livre → copo de selagem interno no tanque de
    destino (no chão). p_gas_m: pressão do gás em m de polpa (0 = partida, conservador)."""
    sai = m.linhas[f"{tag}-SAI"]
    cp = m.copos[sai.spec["copo"]]
    D = sai.tubo.di / 1000
    crista = nv[tag]["crista"] / 1000
    h_boc, yc = _soleira_livre(Q, D, _horizontal_inicial(sai) + 0.13, f, ("gaveta",))
    z_w, z_dip = cp["z_vertedor"] / 1000, cp["z_dip"] / 1000
    Dp, de_dip, d_dip = cp["Di"] / 1000, cp["de_dip"] / 1000, cp["di_dip"] / 1000
    # borda do copo = vertedor circular: carga de vertedor + película mínima de Bingham
    h_w = (Q / 3600 / (1.84 * math.pi * Dp)) ** (2 / 3) + 2 * f.tau_y / (f.rho * G)
    Dh = Dp - de_dip
    h_ann = rg.carga_partida(Dh, (z_w - z_dip) + TURNO_POTE, f)
    z_cotov = cp["z_topo_dip"] / 1000 - d_dip / 2 if cp["lateral"] else 1e9
    z_in = z_w + h_w
    for _ in range(80):
        L_dip = max(z_in - z_dip, 0.0)
        p = rg.perda_tubo(Q, d_dip, L_dip, f)
        re_mr = 8 * f.rho * p["v"] ** 2 / p["tau_w"]
        ks = ("saida", "curva90") if z_in > z_cotov else ("saida",)   # curva interna afogada
        h_dip = max(p["hf"], rg.carga_partida(d_dip, L_dip, f)) + \
            sum(_k(k, re_mr, d_dip) for k in ks) * p["v"] ** 2 / (2 * G)
        novo = max(z_w + h_w + h_dip + h_ann - p_gas_m, z_w + h_w)
        if abs(novo - z_in) < 1e-5:
            break
        z_in = novo
    nivel = max(crista + h_boc, z_in + h_boc)          # se o copo afogar a soleira, o nível sobe
    s_min = rg.declividade_minima_livre(D, f)
    decl = _declividades(sai)
    selo_mm = (z_w - z_dip) * 1000
    return {"tag": tag, "Q": Q, "caso": f.nome, "crista": crista, "y_c": yc, "h_bocal": h_boc,
            "nivel_max": nivel, "folga_lsh": nv[tag]["LSH"] / 1000 - nivel,
            "z_w": z_w, "h_w": h_w, "z_in": z_in, "folga_crista": crista - z_in,
            "h_pote": z_in - z_w, "h_dip": h_dip, "h_ann": h_ann, "z_dip": z_dip,
            "decl_min": min(decl) if decl else None, "s_min": s_min,
            "selo_mm": selo_mm, "selo_mbar": selo_mm / 1000 * f.rho * G / 100,
            "p_gas_m": p_gas_m, "copo": sai.spec["copo"], "tanque": cp["tanque"]}


def purga_gravidade(m, tag: str, Q: float, f: rg.Bingham, nv: dict) -> dict:
    """Purga do reator por gravidade à CS-301: carga disponível (soleira do reator − LSHH da
    caixa) contra a perda para escoar Q (partida incluída)."""
    ln = m.linhas[f"{tag}-PG"]
    r = perda(m, ln, 0, ln.comprimento, Q, f, extra_k=("entrada", "saida"))
    disp = nv[tag]["crista"] / 1000 - nv["CS-301"]["LSHH"] / 1000
    nec = max(r["h"], r["partida"])
    return {"disp": disp, "nec": nec, "folga": disp - nec, "L": r["L"], "v": r["v"]}


# --- Trens bombeados ---------------------------------------------------------------------------

def trens(m, nv):
    """Trens: sucção e recalque como [(linha, s_a, s_b, singulares extras)] (s em mm).
    'imersao': (cota da boca do tubo de imersão, cota do furo quebra-sifão) da alimentação
    pelo tampo: abaixo do nível o tubo trabalha cheio."""
    def comp(t):
        return m.linhas[t].comprimento

    al0, al1, al2 = m.linhas["R-101-AL"], m.linhas["R-201-AL"], m.linhas["R-202-AL"]
    l3, ls, l3n = m.linhas["L-301R"], m.linhas["L-301S"], m.linhas["L-301N3"]
    suc201 = [("L-101S", 0, comp("L-101S"), ("entrada",))]
    suc301 = [("L-301S", 0, comp("L-301S"), ("entrada",))]
    zb201 = m.portas["P-201.succao"].ponto.Z / 1000
    zb301 = m.portas["P-301.succao"].ponto.Z / 1000
    s_te202 = _s_do_te(m, al1, "R-202-AL")

    def crista(ln_tag):
        ln = m.linhas[ln_tag]
        el = [e for e in ln.elementos if e[0] == "reto"][ln.spec["crista"]]
        return el[1].Z / 1000

    def imersao(ln, tag):
        z_out = ln.spec["imersao"][0] / 1000
        return (z_out, m.equipamentos[tag]["obj"].z_tampo / 1000 - 0.25)

    def topo(t):
        return max(v.Z for v in m.linhas[t].vertices) / 1000

    s_n3_201 = _s_do_te(m, l3n, "R-201-PG")
    s_s_n3 = _s_do_te(m, ls, "L-301N3")
    return {
        "P-101 → R-101": {
            "suc": [], "rec": [("R-101-AL", 0, comp("R-101-AL"), ())],
            "crista": ("R-101-AL", _s_reto(al0, al0.spec["crista"]), crista("R-101-AL")),
            "z_fonte": 1.20, "z_bomba": 1.20, "z_dest": nv["R-101"]["LSHH"] / 1000,
            "p_dest": P_GAS_OP, "fonte": "tie-in da P-101 a +1,20 (pressão a fornecer pela Ilha 1)",
            "destino": "R-101 no LSHH"},
        "P-201 → R-201": {
            "suc": suc201, "rec": [("R-201-AL", 0, comp("R-201-AL"), ())],
            "crista": ("R-201-AL", _s_reto(al1, al1.spec["crista"]), crista("R-201-AL")),
            "imersao": imersao(al1, "R-201"),
            "z_fonte": nv["R-101"]["LSL"] / 1000, "z_bomba": zb201,
            "z_dest": nv["R-201"]["LSHH"] / 1000, "p_dest": P_GAS_OP,
            "fonte": "R-101 no LSL", "destino": "R-201 no LSHH"},
        "P-201 → R-202": {
            "suc": suc201, "rec": [("R-201-AL", 0, s_te202, ()),
                                   ("R-202-AL", 0, comp("R-202-AL"), ("te_ramal",))],
            "crista": ("R-202-AL", _s_reto(al2, al2.spec["crista"]), crista("R-202-AL")),
            "imersao": imersao(al2, "R-202"),
            "z_fonte": nv["R-101"]["LSL"] / 1000, "z_bomba": zb201,
            "z_dest": nv["R-202"]["LSHH"] / 1000, "p_dest": P_GAS_OP,
            "fonte": "R-101 no LSL", "destino": "R-202 no LSHH"},
        "P-301 → TQ-301 (transferência)": {
            "suc": suc301, "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["CS-301"]["LSLL"] / 1000, "z_bomba": zb301,
            "z_dest": topo("L-301R"), "p_dest": 0.0,
            "fonte": "CS-301 no LSLL", "destino": "ponto alto da L-301R (descarga livre no TQ-301)"},
        "P-301 → sucção da P-201 (RL-05)": {
            "suc": suc301, "rec": [("L-301R", 0, _s_do_te(m, l3, "L-RL05"), ()),
                                   ("L-RL05", 0, comp("L-RL05"), ("te_ramal",))],
            "z_fonte": nv["CS-301"]["LSLL"] / 1000, "z_bomba": zb301,
            "z_dest": max(topo("L-RL05"), nv["R-101"]["LSH"] / 1000), "p_dest": 0.0,
            "fonte": "CS-301 no LSLL", "destino": "sucção da P-201 (≈ nível do R-101)"},
        "P-301 ← TQ-301 (recirculação/expedição)": {
            "suc": [("L-301N3", 0, comp("L-301N3"), ("entrada",)),
                    ("L-301S", s_s_n3, comp("L-301S"), ("te_ramal",))],
            "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["TQ-301"]["LSL"] / 1000, "z_bomba": zb301,
            "z_dest": topo("L-301R"), "p_dest": 0.0,
            "fonte": "TQ-301 no LSL (pelo N3)", "destino": "TQ-301 (recirculação)"},
        "Purga R-201 → P-301 → TQ-301": {
            "suc": [("R-201-PG", 0, comp("R-201-PG"), ("entrada",)),
                    ("L-301N3", s_n3_201, comp("L-301N3"), ("te_ramal",)),
                    ("L-301S", s_s_n3, comp("L-301S"), ("te_ramal",))],
            "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["R-201"]["crista"] / 1000 - 0.5, "p_fonte": 0.0, "z_bomba": zb301,
            "z_dest": topo("L-301R"), "p_dest": 0.0,
            "fonte": "R-201 0,5 m abaixo da soleira", "destino": "TQ-301"},
        "Purga R-202 → P-301 → TQ-301": {
            "suc": [("R-202-PG", 0, comp("R-202-PG"), ("entrada",)),
                    ("R-201-PG", _s_do_te(m, m.linhas["R-201-PG"], "R-202-PG"),
                     comp("R-201-PG"), ("te_ramal",)),
                    ("L-301N3", s_n3_201, comp("L-301N3"), ("te_ramal",)),
                    ("L-301S", s_s_n3, comp("L-301S"), ("te_ramal",))],
            "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["R-202"]["crista"] / 1000 - 0.5, "p_fonte": 0.0, "z_bomba": zb301,
            "z_dest": topo("L-301R"), "p_dest": 0.0,
            "fonte": "R-202 0,5 m abaixo da soleira", "destino": "TQ-301"},
    }


def bombeado(m, tr, Q, f) -> dict:
    """AMT, pressões, NPSH disponível e pressão na crista da alça (m de polpa)."""
    mca = 100 / (f.rho * G)                                   # m de polpa por mbar
    suc = [(t, perda(m, m.linhas[t[0]], t[1], t[2], Q, f, extra_k=t[3])) for t in tr["suc"]]
    rec = [(t, perda(m, m.linhas[t[0]], t[1], t[2], Q, f, extra_k=t[3])) for t in tr["rec"]]
    h_s = sum(r["h"] for _, r in suc)
    h_r = sum(r["h"] for _, r in rec)
    p_f = tr.get("p_fonte", 0.0) * mca
    pd = tr["p_dest"] * mca
    hgl_suc = tr["z_fonte"] + p_f - h_s
    h_im = z_surf_im = None
    if "imersao" in tr:                   # tubo de imersão DE160 cheio abaixo do nível
        z_out, z_furo = tr["imersao"]
        D = 0.1412
        L_im = max(tr["z_dest"] - z_out, 0.0)
        p = rg.perda_tubo(Q, D, L_im, f)
        re_mr = 8 * f.rho * p["v"] ** 2 / p["tau_w"]
        h_im = max(p["hf"], rg.carga_partida(D, L_im, f)) + \
            _k("saida", re_mr, D) * p["v"] ** 2 / (2 * G)
        z_surf_im = tr["z_dest"] + h_im
        tr = {**tr, "z_dest": z_surf_im, "folga_furo": z_furo - z_surf_im}
    hgl_rec = tr["z_dest"] + pd + h_r
    p_crista = None
    if "crista" in tr:                    # alça: a ventosa garante LP ≥ crista + gás na crista
        ln_c, s_c, z_c = tr["crista"]
        antes = depois = 0.0
        for (t, r) in rec:
            if t[0] != ln_c:
                antes += r["h"]
                continue
            r1 = perda(m, m.linhas[t[0]], t[1], s_c, Q, f)
            antes += r1["h"]
            depois += r["h"] - r1["h"]
        hgl_c = max(tr["z_dest"] + pd + depois, z_c + pd)
        p_crista = hgl_c - z_c
        hgl_rec = hgl_c + antes
    amt = hgl_rec - hgl_suc
    patm = P_ATM_KPA * 1000 / (f.rho * G)
    npsh = patm + hgl_suc - tr["z_bomba"] - P_VAP_KPA * 1000 / (f.rho * G)
    return {"h_suc": h_s, "h_rec": h_r, "hgl_suc": hgl_suc, "hgl_rec": hgl_rec, "AMT": amt,
            "bar": amt * f.rho * G / 1e5,
            "p_succao_m": hgl_suc - tr["z_bomba"] if tr["suc"] else None,
            "p_recalque_bar": (hgl_rec - tr["z_bomba"]) * f.rho * G / 1e5,
            "p_crista_m": p_crista, "NPSHd": npsh if tr["suc"] else None,
            "h_imersao": h_im, "folga_furo": tr.get("folga_furo"),
            "suc": suc, "rec": rec}


def residuo_pos_trip(m, nv, res, tq) -> dict:
    """Volume que ainda chega à CS-301 depois do corte da alimentação (o reator escoa até a
    soleira), contra o volume entre o LSHH e o extravasor da caixa."""
    out = {}
    for tag in ("R-201", "R-202"):
        A = math.pi * (tq[tag].Di / 1000) ** 2 / 4
        r = res["saida"][(tag, "otimista", Q_PROJ)]   # pior caso: τy alto retém volume em repouso
        out[tag] = {"dest": "CS-301", "vol_m3": (r["nivel_max"] - r["crista"]) * A}
    cs = tq["CS-301"]
    Ac = math.pi * (cs.Di / 1000) ** 2 / 4
    out["CS-301"] = (nv["CS-301"]["extravasor"] - nv["CS-301"]["LSHH"]) / 1000 * Ac
    r1 = tq["R-101"]
    A1 = math.pi * (r1.Di / 1000) ** 2 / 4
    out["R-101"] = {"pulmao_m3": (nv["R-101"]["op"] - nv["R-101"]["LSL"]) / 1000 * A1,
                    "A": A1}
    return out


def calcular(m, nv, tq=None):
    out = {"saida": {}, "bomb": {}}
    for f in rg.CASOS_8ST:
        for Q in (Q_PROJ, Q_MAX):
            for tag in ("R-201", "R-202"):
                out["saida"][(tag, f.nome, Q)] = saida(m, tag, Q, f, nv)
        for nome, tr in trens(m, nv).items():
            out["bomb"][(nome, f.nome)] = bombeado(m, tr, Q_PROJ, f)
    # sem limite físico, a purga por gravidade passaria de 100 m³/h (por isso foi descartada)
    out["purga_grav"] = {(t, f.nome): purga_gravidade(m, t, Q_PROJ, f, nv)
                         for t in ("R-201", "R-202") for f in rg.CASOS_8ST}
    if tq is not None:
        out["residuo"] = residuo_pos_trip(m, nv, out, tq)
    return out


# --- Perfis de LE / LP ------------------------------------------------------------------------

def _trecho_perfil(m, ln, s_a, s_b, hgl_a, h):
    """(s, z_eixo, LP) ao longo de [s_a, s_b] (mm) com LP caindo linearmente de hgl_a."""
    cad = _cadeia(m.linhas[ln])
    a, b = s_a / 1000, s_b / 1000
    pts = []
    for (s0, z0), (s1, z1) in zip(cad, cad[1:]):
        for s in (s0, s1):
            if a - 1e-9 <= s <= b + 1e-9:
                pts.append((s, z0 if s == s0 else z1))
        for s in (a, b):
            if s0 < s < s1:
                pts.append((s, z0 + (z1 - z0) * (s - s0) / (s1 - s0)))
    pts = sorted(set(pts))
    L = max(b - a, 1e-9)
    return [(s - a, z, hgl_a - h * (s - a) / L) for s, z in pts]


def perfil_bombeado(m, tr, Q, f):
    r = bombeado(m, tr, Q, f)
    mca = 100 / (f.rho * G)
    out, s0 = [], 0.0
    hgl = tr["z_fonte"] + tr.get("p_fonte", 0.0) * mca
    out.append((0.0, tr["z_fonte"], hgl, hgl, "fonte"))
    for (t, rr) in r["suc"]:
        hv = rr["v"] ** 2 / (2 * G)
        for s, z, lp in _trecho_perfil(m, t[0], t[1], t[2], hgl, rr["h"]):
            out.append((s0 + s, z, lp, lp + hv, None))
        hgl -= rr["h"]
        s0 += (t[2] - t[1]) / 1000
    hgl = r["hgl_rec"]
    out.append((s0, tr["z_bomba"], hgl, hgl, "bomba"))
    cr = tr.get("crista")
    for (t, rr) in r["rec"]:
        hv = rr["v"] ** 2 / (2 * G)
        if cr and t[0] == cr[0]:
            # até a crista: perdas do trecho; da crista ao reator: LP vai de LP_crista ao
            # nível do reator + gás (descida pressurizada ou livre, com a ventosa)
            h1 = perda(m, m.linhas[t[0]], t[1], cr[1], Q, f)["h"]
            pts = _trecho_perfil(m, t[0], t[1], cr[1], hgl, h1)
            hgl_c = hgl - h1
            fim = tr["z_dest"] + tr["p_dest"] * mca
            pts2 = _trecho_perfil(m, t[0], cr[1], t[2], hgl_c, hgl_c - fim)
            L1 = (cr[1] - t[1]) / 1000
            for s, z, lp in pts + [(L1 + a, b, c) for a, b, c in pts2]:
                out.append((s0 + s, z, lp, lp + hv, None))
            hgl = fim
        else:
            for s, z, lp in _trecho_perfil(m, t[0], t[1], t[2], hgl, rr["h"]):
                out.append((s0 + s, z, lp, lp + hv, None))
            hgl -= rr["h"]
        s0 += (t[2] - t[1]) / 1000
    return out, r


def perfil_gravidade(m, tag, Q, f, nv, nv_dest):
    """Reator → N-SAI → descida livre → tubo mergulhado do copo → borda do copo → tanque."""
    mca = 100 / (f.rho * G)
    pg = P_GAS_OP * mca
    r = saida(m, tag, Q, f, nv, p_gas_m=pg)
    sai = m.linhas[f"{tag}-SAI"]
    cp = m.copos[sai.spec["copo"]]
    rt = sai.tubo.di / 2000
    out = [(0.0, r["nivel_max"], r["nivel_max"] + pg, r["nivel_max"] + pg, "reator")]
    cad = _cadeia(sai)
    s_h = _horizontal_inicial(sai)
    for s, z in cad:
        if s <= s_h:                                          # soleira + horizontal curto
            lp = r["nivel_max"] + pg - (r["h_bocal"] - r["y_c"]) * s / max(s_h, 1e-6)
        else:                                                 # lâmina livre até o copo
            lp = max(z - rt + r["y_c"], r["z_in"]) + pg
        out.append((s, z, lp, lp, None))
    s0 = cad[-1][0]
    z_top = cp["z_topo_dip"] / 1000
    s0 += (cad[-1][1] - z_top) if cad[-1][1] > z_top else 0.25
    out.append((s0, z_top, max(z_top, r["z_in"]) + pg, max(z_top, r["z_in"]) + pg, None))
    # dentro do copo: tubo mergulhado até o fundo, sobe pelo ânulo até a borda
    lp_fundo = r["z_w"] + r["h_w"] + r["h_ann"]
    s_in = s0 + max(z_top - r["z_in"], 0)
    out.append((s_in, r["z_in"], r["z_in"] + pg, r["z_in"] + pg, None))
    s_dip = s0 + (z_top - r["z_dip"])
    out.append((s_dip, r["z_dip"], lp_fundo, lp_fundo, None))
    s_w = s_dip + (r["z_w"] - r["z_dip"]) + TURNO_POTE
    out.append((s_w, r["z_w"], r["z_w"] + r["h_w"], r["z_w"] + r["h_w"], "copo"))
    out.append((s_w + 0.4, nv_dest, nv_dest, nv_dest, "destino"))
    return out, r


# --- Gráfico e memória ------------------------------------------------------------------------

COR = {"otimista": "#1baf7a", "central": "#2a78d6", "pessimista": "#eb6834"}
TRACO = {"otimista": ":", "central": "--", "pessimista": "-"}
DESTINO_GRAV = {"R-201": ("CS-301", "LSH"), "R-202": ("CS-301", "LSH")}


def grafico(m, nv, arquivo, Q=Q_PROJ):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    trs = {k: v for k, v in trens(m, nv).items() if not k.startswith("Purga")}
    paineis = [("grav", t) for t in ("R-201", "R-202")] + [("bomb", k) for k in trs]
    fig, axs = plt.subplots(4, 2, figsize=(15, 17), constrained_layout=True)
    for ax, (tipo, chave) in zip(axs.flat, paineis):
        eixo = None
        for f in rg.CASOS_8ST:
            if tipo == "grav":
                dq, cota = DESTINO_GRAV[chave]
                pts, r = perfil_gravidade(m, chave, Q, f, nv, nv[dq][cota] / 1000)
                titulo = f"{chave} → CP-{chave[2:]} no {dq} (chão): saída por gravidade"
            else:
                pts, r = perfil_bombeado(m, trs[chave], Q, f)
                titulo = f"{chave}  (AMT pessimista {r['AMT']:.1f} m)" \
                    if f.nome == "pessimista" else None
            s = [p[0] for p in pts]
            if eixo is None:
                eixo = pts
            ax.plot(s, [p[2] for p in pts], TRACO[f.nome], color=COR[f.nome], lw=2,
                    label=f"LP {f.nome} (τy {f.tau_y:.0f} Pa)")
            if f.nome == "pessimista":
                ax.plot(s, [p[3] for p in pts], "-", color=COR[f.nome], lw=0.8, alpha=0.6,
                        label="LE pessimista (LP + v²/2g)")
                for p in pts:
                    if p[4] in ("bomba", "copo"):
                        ax.annotate(p[4], (p[0], p[2]), textcoords="offset points",
                                    xytext=(4, 4), fontsize=8, color="#52514e")
            if titulo:
                ax.set_title(titulo, fontsize=10, loc="left")
        ax.plot([p[0] for p in eixo if p[4] is None], [p[1] for p in eixo if p[4] is None],
                color="#8a8984", lw=4, alpha=0.45, label="eixo do tubo")
        if tipo == "grav":
            for k, est in (("crista", ":"), ("LSH", "--"), ("LSHH", "-.")):
                z = nv[chave][k] / 1000
                ax.axhline(z, color="#52514e", lw=0.7, ls=est)
                ax.text(0.05, z + 0.03, f"{'soleira' if k == 'crista' else k} {chave} {z:.2f}",
                        fontsize=7, color="#52514e")
        ax.grid(alpha=0.25)
        ax.set_xlabel("desenvolvimento ao longo da linha (m)", fontsize=8)
        ax.set_ylabel("cota (m, base z = 0)", fontsize=8)
        ax.tick_params(labelsize=8)
    axs.flat[0].legend(fontsize=7, loc="lower left")
    fig.suptitle(f"Linhas de energia (LE) e piezométricas (LP) — polpa 8% ST, Q = {Q:.0f} m³/h "
                 f"(LP em m de polpa manométrica; gás a +{P_GAS_OP} mbar)", fontsize=12)
    fig.savefig(arquivo, dpi=110)
    plt.close(fig)


def _f(x, n=2):
    return "—" if x is None else f"{x:.{n}f}".replace(".", ",")


def memoria(m, nv, res, arquivo_md, figura):
    L = []
    w = L.append
    w("# Memória hidráulica — Gen E rev. 5, polpa de 8% ST (documento de trabalho)\n")
    w("Situação: **PROPOSTA DE TRABALHO, NÃO LIBERADA.** Revisão 5: planta enxuta, sem tanque "
      "de neutralização, alinhada à F02 Rev. B (C1) do chat de fluxogramas. Precisa do Crivo "
      "A–F independente. Cotas na base comum z = 0 (premissa de S5). Sem valores monetários.\n")
    w("## 1. Premissas e método\n")
    w(f"- **Vazão de projeto: {Q_PROJ:.0f} m³/h** (máximo das PCP; pulsos). A linha de "
      f"{Q_MAX:.0f} m³/h nas saídas só mostra folga.")
    w("- **Reologia:** plástico de Bingham.")
    w("  - Tubo cheio: Buckingham–Reiner e Darby–Mun–Boger.")
    w("  - Partida: 4·τy·L/(ρ·g·D).")
    w("  - Lâmina livre: sen θ ≥ τy/(ρ·g·0,304·D).")
    w("  - Singulares pelo 2-K de Hooper com o Re de Metzner–Reed.")
    w("- **Três casos de reologia**, hipótese até a reometria (LAC-041):\n")
    w("| caso | τy (Pa) | μp (Pa·s) | ρ (kg/m³) |\n|---|---|---|---|")
    for f in rg.CASOS_8ST:
        w(f"| {f.nome} | {f.tau_y:.0f} | {_f(f.mu_p)} | {f.rho:.0f} |")
    w(f"\n- **Espaço de gás:** ≈ 0 a +2 mbar (ligado à bolsa GH-1 que recebe). Nas "
      f"verificações de nível usei 0 mbar e no gráfico +{_f(P_GAS_OP, 1)} mbar.")
    w(f"- **NPSH:** P_atm {_f(P_ATM_KPA, 1)} kPa (Congonhas/MG, ≈ 870 m; LAC-027) e "
      f"P_vapor {_f(P_VAP_KPA, 1)} kPa.\n")
    w("## 2. Arranjo da rev. 5\n")
    w("**R-101 (acidogênico).**")
    w("- Recebe da P-101 pelo tampo, em **descarga direta** no N1, sem tubo de imersão. A "
      "saída é pelo fundo, então não há curto-circuito, e o quebra-sifão é inerente.")
    w("- Sai pelo fundo (N2-135) para a P-201. O nível é variável, com controle por LT, e não "
      "há saída por transbordo.")
    rr = res.get("residuo", {})
    if "R-101" in rr:
        w(f"- Pulmão entre LSL (+{_f(nv['R-101']['LSL'] / 1000)}) e o nível de operação "
          f"(+{_f(nv['R-101']['op'] / 1000)}): ≈ {_f(rr['R-101']['pulmao_m3'], 1)} m³. Isso "
          "cobre o pulmão que o TQ-201 fazia (≈ 1 m³).")
    w("\n**Neutralização em linha, sem TQ-201:**")
    w("- **Na sucção da P-201** entra o retorno alcalino do digestato (RL-05). A mistura "
      "acontece na própria PCP.")
    w("- **Na descarga** entra a dosagem de NaOH ou bicarbonato (DOS-201), antes do misturador "
      "estático MX-201.")
    w("- **Medição:** pH/ORP em linha (AIT-201) na entrada dos metanogênicos e pH/ORP no copo "
      "de saída de cada metanogênico (AIT-212/222 na CS-301). O AIC-201 comanda a dosadora "
      "e a razão do RL-05.")
    w("- **Por que funciona sem tanque:** cada pulso tem ≈ 0,6 m³, cerca de 0,7% do volume de "
      "um metanogênico de 85 m³. O reator dilui e tampona o pulso, e a dosagem em linha "
      "corrige o pH antes da entrada.")
    w("- **Riscos registrados:**")
    w("  - falha da dosagem durante um pulso: o pulso é intertravado com o pH em linha dentro "
      "da faixa;")
    w("  - item FINEP \"tanques de neutralização\" (LAC-054).")
    w("\n**Alimentação dos R-201/202 pelo tampo com tubo de imersão** (C1 da F02 Rev. B):")
    w("- Pulsos alternados pela XV-211 e pela XV-221, com volume por pulso no FQIT-201.")
    w("- Quebra-sifão passivo pelo furo do tubo no espaço de gás, sem ventosa em lodo.")
    w("- **Boca do tubo de imersão a +6,1 m.** A imersão fica limitada a ≈ 2,25 m abaixo do "
      "LSHH, para que, mesmo com τy = 100 Pa, a polpa dentro do tubo não suba até o furo "
      "quebra-sifão (+9,05).")
    w("  - Com isso a entrada fica 1,4 m abaixo do N.A. O curto-circuito até o N-SAI é "
      "controlado pelo pulso pequeno e pelo intertravamento com o misturador.")
    w("  - Ensaio de traçador na partida (LAC-047).")
    w("\n**Saídas dos R-201/202 sem mudança:** bocal N-SAI no nível, respiro de equalização, "
      "descida livre e copos de selagem na CS-301 no chão. A saída por coluna a partir do N2 "
      "(C1) não foi adotada: deixa ≈ 7 m de tubo cheio de polpa e, com τy alto, o nível "
      "passaria do tampo.")
    w("\n**Purgas dos R-201/202 pela P-301:**")
    w("- Manifold de sucção com chave presa, uma sucção por vez: CS-301, N3 do TQ-301, purga "
      "do R-201 ou purga do R-202.")
    w("- A vazão fica limitada pela bomba, e a purga só abre com reposição de gás pela bolsa "
      "GH-1 que recebe.\n")
    w("## 3. Saídas por gravidade (R-201/202 → copos na CS-301)\n")
    w("| reator | caso | Q (m³/h) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) "
      "| carga no copo (m) | folga na soleira (m) | sen θ mín. exigido | sen θ adotado | selo (mm / mbar) |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    for (tag, caso, Q), r in res["saida"].items():
        alerta = " ⚠" if r["folga_lsh"] < 0.10 or r["folga_crista"] < 0.20 else ""
        w(f"| {tag} | {caso} | {Q:.0f} | {_f(r['h_bocal'])} | {_f(r['nivel_max'])} | "
          f"{_f(r['folga_lsh'])}{alerta} | {_f(r['h_pote'])} | {_f(r['folga_crista'])} | "
          f"{_f(r['s_min'], 3)} | {_f(r['decl_min'])} | {r['selo_mm']:.0f} / "
          f"{_f(r['selo_mbar'], 0)} |")
    if rr:
        w(f"\n- **Volume que ainda chega à CS-301 depois de um corte** (um reator por vez): "
          f"{_f(max(rr['R-201']['vol_m3'], rr['R-202']['vol_m3']))} m³, contra "
          f"{_f(rr['CS-301'])} m³ entre LSHH e extravasor.")
    w("\n## 4. Trens bombeados (Q = 6 m³/h)\n")
    w("A coluna **folga no furo** é a cota do furo quebra-sifão menos a superfície da polpa "
      "dentro do tubo de imersão. Precisa ser positiva: a polpa não pode subir até o furo e "
      "derramar por ele no espaço de gás.\n")
    w("| trem | caso | perda sucção (m) | perda recalque (m) | AMT (m) | AMT (bar) | "
      "pressão na crista (m) | folga no furo (m) | p. sucção no flange (m) | NPSHd (m) |")
    w("|---|---|---|---|---|---|---|---|---|---|")
    for (nome, caso), r in res["bomb"].items():
        w(f"| {nome} | {caso} | {_f(r['h_suc'])} | {_f(r['h_rec'])} | {_f(r['AMT'])} | "
          f"{_f(r['bar'])} | {_f(r['p_crista_m'])} | {_f(r['folga_furo'])} | "
          f"{_f(r['p_succao_m'])} | {_f(r['NPSHd'])} |")
    pior = max(res["bomb"].items(), key=lambda kv: kv[1]["bar"])
    neg = [(k, r) for k, r in res["bomb"].items() if r["p_succao_m"] is not None]
    nmin = min(neg, key=lambda kv: kv[1]["NPSHd"])
    furo = [(k, r) for k, r in res["bomb"].items() if r["folga_furo"] is not None]
    fmin = min(furo, key=lambda kv: kv[1]["folga_furo"])
    w("\nLeitura da tabela:\n")
    w(f"- **Maior AMT:** {pior[0][0]} ({pior[0][1]}), {_f(pior[1]['bar'])} bar.")
    w("  - PCP de ≥ 2 estágios.")
    w("  - PSV com retorno, PSHH e PSL.")
    w(f"- **Menor NPSHd:** {_f(nmin[1]['NPSHd'])} m ({nmin[0][0]}, {nmin[0][1]}). "
      "Especificar NPSHr ≤ 3 m.")
    w(f"- **Menor folga no furo do tubo de imersão:** {_f(fmin[1]['folga_furo'])} m "
      f"({fmin[0][0]}, {fmin[0][1]}).")
    w("- **AMT negativa nas purgas:** com τy baixo a AMT fica negativa e a P-301 trabalha como "
      "freio volumétrico.")
    w("  - Inversor com frenagem.")
    w("  - A XV de purga abre só com a bomba em marcha e fecha com ela.\n")
    w("## 5. Linhas de energia e piezométricas\n")
    w(f"![LE e LP]({figura})\n")
    w("- **Lâmina livre:** a LP é a superfície da polpa.")
    w("- **No copo:** a LP cai pelo tubo mergulhado e pelo ânulo.")
    w("- **Alimentação pelo tampo:** a LP fica no mínimo na crista da travessia mais o gás. "
      "O furo do tubo de imersão admite gás quando ela cai abaixo disso.")
    w("- **Velocidade:** v²/2g < 1 cm, então a LE se sobrepõe à LP.\n")
    w("## 6. Lacunas\n")
    w("Ver `LACUNAS_PROPOSTAS.md`. As que decidem esta memória:")
    w("- LAC-041: reometria.")
    w("- LAC-046: selo de 330 mm.")
    w("- LAC-047: tubo de imersão e estruturas (Fibrais).")
    w("- LAC-054: FINEP e tanque de neutralização.")
    w("- LAC-055: dados de alcalinidade e AGV para a dosagem.")
    open(arquivo_md, "w").write("\n".join(L) + "\n")


if __name__ == "__main__":
    import os
    sys.path.insert(0, os.path.dirname(__file__))
    import planta_gene as pg
    saida_dir = os.path.join(os.path.dirname(__file__), "saida")
    os.makedirs(saida_dir, exist_ok=True)
    m, tq, _ = pg.construir_modelo(solidos=False)
    res = calcular(m, pg.NIVEL, tq)
    grafico(m, pg.NIVEL, os.path.join(saida_dir, "LE_LP_gene.png"))
    memoria(m, pg.NIVEL, res, os.path.join(saida_dir, "MEMORIA_HIDRAULICA.md"), "LE_LP_gene.png")
    print("ok")
