"""Memória hidráulica da cascata Gen E com polpa de 8% ST (plástico de Bingham).

Calcula, para os 3 casos de reologia (otimista/central/pessimista):
- saídas por gravidade no nível: subida do nível do reator sobre a soleira do N-SAI, descidas
  com lâmina livre, pote de selagem (tubo mergulhado + ânulo + vertedor), folga entre a
  superfície interna do pote e a soleira, fecho em mbar;
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
TURNO_POTE = 0.30     # m: caminho equivalente da virada de 180° no fundo do pote (estimativa)
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
    """Saída por gravidade no nível → pote de selagem → destino. p_gas_m: pressão do gás em m
    de polpa (0 = partida, conservador: o gás ajuda a empurrar a polpa pelo pote)."""
    sai, trb = m.linhas[f"{tag}-SAI"], m.linhas[f"{tag}-TRB"]
    pote = m.equipamentos[sai.spec["pote"]]["pote"]
    D = sai.tubo.di / 1000
    crista = nv[tag]["crista"] / 1000
    h_boc, yc = _soleira_livre(Q, D, _horizontal_inicial(sai) + 0.13, f, ("gaveta",))
    z_w, z_dip = pote["z_vertedor"] / 1000, pote["z_dip"] / 1000
    Dp, de_dip, d_dip = pote["Di"] / 1000, pote["de_dip"] / 1000, pote["di_dip"] / 1000
    h_w, _ = _soleira_livre(Q, D, _horizontal_inicial(trb) + 0.13, f)
    Dh = Dp - de_dip
    h_ann = rg.carga_partida(Dh, (z_w - z_dip) + TURNO_POTE, f)
    z_in = z_w + h_w
    for _ in range(80):
        L_dip = max(z_in - z_dip, 0.0)
        p = rg.perda_tubo(Q, d_dip, L_dip, f)
        re_mr = 8 * f.rho * p["v"] ** 2 / p["tau_w"]
        h_dip = max(p["hf"], rg.carga_partida(d_dip, L_dip, f)) + \
            _k("saida", re_mr, d_dip) * p["v"] ** 2 / (2 * G)
        novo = max(z_w + h_w + h_dip + h_ann - p_gas_m, z_w + h_w)
        if abs(novo - z_in) < 1e-5:
            break
        z_in = novo
    nivel = max(crista + h_boc, z_in + h_boc)          # se o pote afogar a soleira, o nível sobe
    s_min = rg.declividade_minima_livre(D, f)
    decl = _declividades(sai) + _declividades(trb)
    selo_mm = (z_w - z_dip) * 1000
    return {"tag": tag, "Q": Q, "caso": f.nome, "crista": crista, "y_c": yc, "h_bocal": h_boc,
            "nivel_max": nivel, "folga_lsh": nv[tag]["LSH"] / 1000 - nivel,
            "z_w": z_w, "h_w": h_w, "z_in": z_in, "folga_crista": crista - z_in,
            "h_pote": z_in - z_w, "h_dip": h_dip, "h_ann": h_ann, "z_dip": z_dip,
            "decl_min": min(decl) if decl else None, "s_min": s_min,
            "selo_mm": selo_mm, "selo_mbar": selo_mm / 1000 * f.rho * G / 100,
            "p_gas_m": p_gas_m}


# --- Trens bombeados ---------------------------------------------------------------------------

def trens(m, nv):
    """Trens: sucção e recalque como [(linha, s_a, s_b, singulares extras)] (s em mm)."""
    def comp(t):
        return m.linhas[t].comprimento

    al0, al1, al2 = m.linhas["R-101-AL"], m.linhas["R-201-AL"], m.linhas["R-202-AL"]
    l3, ls = m.linhas["L-301R"], m.linhas["L-301S"]
    suc201 = [("L-201S", 0, comp("L-201S"), ("entrada",))]
    suc301 = [("L-301S", 0, comp("L-301S"), ("entrada",))]
    zb201 = m.portas["P-201.succao"].ponto.Z / 1000
    zb301 = m.portas["P-301.succao"].ponto.Z / 1000
    s_te202 = _s_do_te(m, al1, "R-202-AL")

    def crista(ln_tag):
        ln = m.linhas[ln_tag]
        i = ln.spec["crista"]
        el = [e for e in ln.elementos if e[0] == "reto"][i]
        return el[1].Z / 1000

    return {
        "P-101 → R-101": {
            "suc": [], "rec": [("R-101-AL", 0, comp("R-101-AL"), ("saida",))],
            "crista": ("R-101-AL", _s_reto(al0, al0.spec["crista"]), crista("R-101-AL")),
            "z_fonte": 1.20, "z_bomba": 1.20, "z_dest": nv["R-101"]["LSHH"] / 1000,
            "p_dest": P_GAS_OP, "fonte": "tie-in da P-101 a +1,20 (pressão a fornecer pela Ilha 1)",
            "destino": "R-101 no LSHH"},
        "P-201 → R-201": {
            "suc": suc201, "rec": [("R-201-AL", 0, comp("R-201-AL"), ("saida",))],
            "crista": ("R-201-AL", _s_reto(al1, al1.spec["crista"]), crista("R-201-AL")),
            "z_fonte": nv["TQ-201"]["LSLL"] / 1000, "z_bomba": zb201,
            "z_dest": nv["R-201"]["LSHH"] / 1000, "p_dest": P_GAS_OP,
            "fonte": "TQ-201 no LSLL", "destino": "R-201 no LSHH"},
        "P-201 → R-202": {
            "suc": suc201, "rec": [("R-201-AL", 0, s_te202, ()),
                                   ("R-202-AL", 0, comp("R-202-AL"), ("te_ramal", "saida"))],
            "crista": ("R-202-AL", _s_reto(al2, al2.spec["crista"]), crista("R-202-AL")),
            "z_fonte": nv["TQ-201"]["LSLL"] / 1000, "z_bomba": zb201,
            "z_dest": nv["R-202"]["LSHH"] / 1000, "p_dest": P_GAS_OP,
            "fonte": "TQ-201 no LSLL", "destino": "R-202 no LSHH"},
        "P-301 → TQ-301 (recirculação)": {
            "suc": suc301, "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["TQ-301"]["LSL"] / 1000, "z_bomba": zb301,
            "z_dest": max(v.Z for v in l3.vertices) / 1000, "p_dest": 0.0,
            "fonte": "TQ-301 no LSL", "destino": "ponto alto da L-301R (descarga livre)"},
        "P-301 → TQ-201 (RL-05)": {
            "suc": suc301, "rec": [("L-301R", 0, _s_do_te(m, l3, "L-RL05"), ()),
                                   ("L-RL05", 0, comp("L-RL05"), ("te_ramal", "saida"))],
            "z_fonte": nv["TQ-301"]["LSL"] / 1000, "z_bomba": zb301,
            "z_dest": max(v.Z for v in m.linhas["L-RL05"].vertices) / 1000, "p_dest": 0.0,
            "fonte": "TQ-301 no LSL", "destino": "ponto alto da L-RL05 (descarga livre)"},
        "Purga R-201 → P-301": {
            "suc": [("R-201-PG", 0, comp("R-201-PG"), ("entrada", "te_ramal")),
                    ("L-301S", _s_do_te(m, ls, "R-201-PG"), comp("L-301S"), ())],
            "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["R-201"]["crista"] / 1000, "p_fonte": P_GAS_OP, "z_bomba": zb301,
            "z_dest": max(v.Z for v in l3.vertices) / 1000, "p_dest": 0.0,
            "fonte": "R-201 na soleira", "destino": "TQ-301 / expedição"},
        "Purga R-101 → P-201": {
            "suc": [("R-101-PG", 0, comp("R-101-PG"), ("entrada", "te_ramal")),
                    ("L-201S", _s_do_te(m, m.linhas["L-201S"], "R-101-PG"), comp("L-201S"), ())],
            "rec": [("R-201-AL", 0, comp("R-201-AL"), ("saida",))],
            "crista": ("R-201-AL", _s_reto(al1, al1.spec["crista"]), crista("R-201-AL")),
            "z_fonte": nv["R-101"]["crista"] / 1000, "p_fonte": P_GAS_OP, "z_bomba": zb201,
            "z_dest": nv["R-201"]["LSHH"] / 1000, "p_dest": P_GAS_OP,
            "fonte": "R-101 na soleira", "destino": "R-201 (ou expedição)"},
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
            "suc": suc, "rec": rec}


def tq201(nv, Di=1.8, z_fundo=0.45, Q=Q_PROJ) -> dict:
    A = math.pi * Di ** 2 / 4
    vol = {k: (v / 1000 - z_fundo) * A for k, v in nv["TQ-201"].items()}
    return {"A": A, "vol": vol, "util": vol["LSH"] - vol["LSL"],
            "TDH_min_LSH": vol["LSH"] / Q * 60,
            "pulmao_LSH_LSHH_min": (vol["LSHH"] - vol["LSH"]) / Q * 60,
            "vol_LSHH_EXT": vol["extravasor"] - vol["LSHH"]}


def residuo_pos_trip(m, nv, res, tq) -> dict:
    """Volume que ainda chega aos tanques depois do trip da alimentação (o reator escoa até a
    soleira), contra o volume entre o LSHH e o extravasor do tanque de destino."""
    out = {}
    for tag, dest in (("R-101", "TQ-201"), ("R-201", "TQ-301"), ("R-202", "TQ-301")):
        A = math.pi * (tq[tag].Di / 1000) ** 2 / 4
        r = res["saida"][(tag, "otimista", Q_PROJ)]   # pior caso: τy alto retém volume em repouso
        out[tag] = {"dest": dest, "vol_m3": (r["nivel_max"] - r["crista"]) * A}
    t3 = tq["TQ-301"]
    A3 = math.pi * (t3.Di / 1000) ** 2 / 4
    out["TQ-301"] = (nv["TQ-301"]["extravasor"] - nv["TQ-301"]["LSHH"]) / 1000 * A3
    out["TQ-201"] = res["tq201"]["vol_LSHH_EXT"]
    return out


def calcular(m, nv, tq=None):
    out = {"saida": {}, "bomb": {}}
    for f in rg.CASOS_8ST:
        for Q in (Q_PROJ, Q_MAX):
            for tag in ("R-101", "R-201", "R-202"):
                out["saida"][(tag, f.nome, Q)] = saida(m, tag, Q, f, nv)
        for nome, tr in trens(m, nv).items():
            out["bomb"][(nome, f.nome)] = bombeado(m, tr, Q_PROJ, f)
    out["tq201"] = tq201(nv)
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
    """Reator → N-SAI → descida livre → pote (tubo mergulhado, ânulo, vertedor) → destino."""
    mca = 100 / (f.rho * G)
    pg = P_GAS_OP * mca
    r = saida(m, tag, Q, f, nv, p_gas_m=pg)
    sai, trb = m.linhas[f"{tag}-SAI"], m.linhas[f"{tag}-TRB"]
    rt = sai.tubo.di / 2000
    out = [(0.0, r["nivel_max"], r["nivel_max"] + pg, r["nivel_max"] + pg, "reator")]
    cad = _cadeia(sai)
    s_h = _horizontal_inicial(sai)
    for s, z in cad:
        if s <= s_h:                                          # soleira + horizontal curto
            lp = r["nivel_max"] + pg - (r["h_bocal"] - r["y_c"]) * s / max(s_h, 1e-6)
        else:                                                 # lâmina livre até a sup. do pote
            lp = max(z - rt + r["y_c"], r["z_in"]) + pg
        out.append((s, z, lp, lp, None))
    s0 = cad[-1][0]
    z_top = cad[-1][1]
    # dentro do pote: tubo mergulhado até o fundo, sobe pelo ânulo até o vertedor
    z_in_lp = r["z_in"] + pg
    lp_fundo = r["z_w"] + r["h_w"] + r["h_ann"]
    s_in = s0 + max(z_top - r["z_in"], 0)
    out.append((s_in, r["z_in"], z_in_lp, z_in_lp, None))
    s_dip = s0 + (z_top - r["z_dip"])
    out.append((s_dip, r["z_dip"], lp_fundo, lp_fundo, None))
    s_w = s_dip + (r["z_w"] - r["z_dip"]) + TURNO_POTE
    out.append((s_w, r["z_w"], r["z_w"] + r["h_w"], r["z_w"] + r["h_w"], "pote"))
    for s, z in _cadeia(trb):
        lp = z - rt + r["y_c"] if s > 0 else r["z_w"] + r["y_c"]
        out.append((s_w + s, z, lp, lp, None))
    s_end = s_w + _cadeia(trb)[-1][0]
    out.append((s_end + 0.3, nv_dest, nv_dest, nv_dest, "destino"))
    return out, r


# --- Gráfico e memória ------------------------------------------------------------------------

COR = {"otimista": "#1baf7a", "central": "#2a78d6", "pessimista": "#eb6834"}
TRACO = {"otimista": ":", "central": "--", "pessimista": "-"}
DESTINO_GRAV = {"R-101": ("TQ-201", "LSH"), "R-201": ("TQ-301", "LSH"),
                "R-202": ("TQ-301", "LSH")}


def grafico(m, nv, arquivo, Q=Q_PROJ):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    trs = {k: v for k, v in trens(m, nv).items() if not k.startswith("Purga")}
    paineis = [("grav", t) for t in ("R-101", "R-201", "R-202")] + [("bomb", k) for k in trs]
    fig, axs = plt.subplots(4, 2, figsize=(15, 17), constrained_layout=True)
    for ax, (tipo, chave) in zip(axs.flat, paineis):
        eixo = None
        for f in rg.CASOS_8ST:
            if tipo == "grav":
                dq, cota = DESTINO_GRAV[chave]
                pts, r = perfil_gravidade(m, chave, Q, f, nv, nv[dq][cota] / 1000)
                titulo = f"{chave} → PS-{chave[2:]} → {dq}: saída por gravidade no nível"
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
                    if p[4] in ("bomba", "pote"):
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
    w("# Memória hidráulica — cascata Gen E com polpa de 8% ST (documento de trabalho)\n")
    w("Situação: **PROPOSTA DE TRABALHO, NÃO LIBERADA.** Revisão 2, depois do Crivo A–F "
      "independente (rodada 1 com 3 bloqueantes, tratados aqui). Falta a rodada 2 do Crivo. "
      "Cotas na base comum z = 0 (premissa de S5). Sem valores monetários.\n")
    w("## 1. Premissas e método\n")
    w(f"- **Vazão de projeto das saídas: {Q_PROJ:.0f} m³/h.** É a vazão máxima das PCP de "
      "alimentação (2–6 m³/h); em regime, o que entra sai. A verificação a "
      f"{Q_MAX:.0f} m³/h só mostra folga, porque retiradas são bombeadas.")
    w("- **Reologia:** plástico de Bingham.")
    w("  - Tubo cheio: Buckingham–Reiner e Darby–Mun–Boger.")
    w("  - Partida: 4·τy·L/(ρ·g·D).")
    w("  - Lâmina livre: sen θ ≥ τy/(ρ·g·0,304·D).")
    w("  - **Singulares pelo 2-K de Hooper com o Re de Metzner–Reed** (8ρv²/τw), não com "
      "o Re de Bingham. Em polpa com τy cada curva de 90° custa K1·τw/(16ρg): da ordem de "
      "0,5 m com 100 Pa, quase independente do diâmetro.")
    w("  - Consequência de projeto: **nenhuma curva cheia nas saídas por gravidade.** Bocal "
      "no nível, descidas livres e pote de selagem com tubo mergulhado reto.")
    w("- **Três casos de reologia.** São HIPÓTESE até a reometria da polpa real "
      "(LAC-041, proposta):\n")
    w("| caso | τy (Pa) | μp (Pa·s) | ρ (kg/m³) |\n|---|---|---|---|")
    for f in rg.CASOS_8ST:
        w(f"| {f.nome} | {f.tau_y:.0f} | {_f(f.mu_p)} | {f.rho:.0f} |")
    w(f"\n- **Espaço de gás:** opera de +1,5 a +{_f(P_GAS_OP, 1)} mbar. As verificações de "
      "nível usam 0 mbar (partida, conservador), e o gráfico usa a operação.")
    w(f"- **NPSH:** P_atm {P_ATM_KPA} kPa no sítio de referência (Congonhas/MG, ≈ 870 m; "
      f"RES-001 §5.5, a confirmar na LAC-027) e P_vapor {P_VAP_KPA} kPa (35 °C).")
    w(f"- **Pote de selagem, virada de 180° no fundo:** modelada como {TURNO_POTE:.2f} m de "
      "caminho equivalente no ânulo. É estimativa de engenharia, a confirmar na reometria "
      "ou em ensaio de bancada (LAC-041).\n")
    w("## 2. Saídas por gravidade (N-SAI no nível → descida livre → pote de selagem → destino)\n")
    w("Arranjo de cada saída:")
    w("- **N-SAI:** bocal novo DN150 com a soleira interna no N.A. de projeto (a mesma cota "
      "da tabela de níveis).")
    w("- **Descida:** registro LO (faca), depois descida com lâmina livre, com sen θ de "
      "0,31 a 0,50 (mínimo exigido no caso pessimista: 0,23).")
    w("- **Pote de selagem:** ao chegar, a descida vira tubo mergulhado DE160 até 330 mm "
      "abaixo da soleira do vertedor do pote. O pote transborda por lâmina livre ao destino.")
    w("- **Quebra-sifão: respiro de equalização R-xxx-RS (DE90).** Ele sai da geratriz superior "
      "da descida, logo depois do registro LO, e vai a um N1 do tampo. O bocal no nível sozinho "
      "não basta. Com τy alto, o nível sobe acima do topo do N-SAI (0,2 a 0,5 m na soleira), em "
      "operação e também em repouso, e o bocal fica afogado.")
    w("  - Sem respiro, o bolsão de gás da descida se dissolve ou é arrastado pela polpa, a "
      "descida enche e sifona o reator até o topo do bocal. Isso retira 2,6 a 3,8 m³ de um "
      "reator fechado e cria vácuo.")
    w("  - Com o respiro, a descida fica sempre à pressão do gás e nada abaixo da soleira escoa "
      "por gravidade. O fecho hídrico é a superfície interna do pote.\n")
    w("Colunas da tabela:")
    w("- **Subida na soleira:** lâmina crítica + partida no trecho horizontal + entrada + "
      "registro.")
    w("- **Carga no pote:** superfície interna menos a soleira do vertedor. Soma a lâmina do "
      "vertedor, o tubo mergulhado (atrito + saída) e o ânulo (partida).")
    w("- **Folga na soleira:** soleira do N-SAI menos a superfície interna do pote. Se for "
      "negativa, o pote afoga a saída e o nível do reator sobe junto.\n")
    w("| reator | caso | Q (m³/h) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) "
      "| carga no pote (m) | folga na soleira (m) | sen θ mín. exigido | sen θ adotado | selo (mm / mbar) |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    for (tag, caso, Q), r in res["saida"].items():
        alerta = " ⚠" if r["folga_lsh"] < 0.10 or r["folga_crista"] < 0.20 else ""
        w(f"| {tag} | {caso} | {Q:.0f} | {_f(r['h_bocal'])} | {_f(r['nivel_max'])} | "
          f"{_f(r['folga_lsh'])}{alerta} | {_f(r['h_pote'])} | {_f(r['folga_crista'])} | "
          f"{_f(r['s_min'], 3)} | {_f(r['decl_min'])} | {r['selo_mm']:.0f} / "
          f"{_f(r['selo_mbar'], 0)} |")
    piores = {t: min((r for (tt, _, Q), r in res["saida"].items() if tt == t and Q == Q_PROJ),
                     key=lambda r: r["folga_crista"]) for t in ("R-101", "R-201", "R-202")}
    w("\nConclusões das saídas:\n")
    w(f"1. A saída por gravidade de polpa a 8% ST funciona a {Q_PROJ:.0f} m³/h nos três casos "
      "de reologia, com este arranjo.")
    w("   - Menor folga entre a superfície do pote e a soleira: " + "; ".join(
        f"{t} {_f(r['folga_crista'])} m ({r['caso']})" for t, r in piores.items()) + ".")
    w("   - O nível máximo fica abaixo do LSH em todos os casos.")
    w("   - **Divergência do arranjo anterior:** o U de fecho e o standpipe submerso foram "
      "abandonados. Com τy alto, as curvas cheias deles faziam o nível passar do LSHH.")
    w("2. **Selo de 330 mm de polpa (≈ 33 mbar).** É 2,7× a abertura da emergência "
      "(+12 mbar) e 4× o envelope de vácuo dos R-201/202 (−8 mbar). O R-101 tem envelope "
      "de −6 mbar e emergência de −4/−5. Também passa os ≥ 250 mm da RES-001 LQ-04.")
    w("   - Sob +12 mbar, a superfície interna do pote desce 0,12 m e o tubo mergulhado "
      "continua 0,21 m afogado.")
    w("   - A proposta citava 500 mmCA: **divergência a validar pelo responsável de "
      "processo.**")
    w("3. Q = 20 m³/h por gravidade não ocorre, porque as PCP não entregam essa vazão. A "
      "linha aparece só como folga.")
    w("4. **Arraste de biogás pelo selo.** Bolhas retidas na polpa (τy de 30–100 Pa) podem "
      "passar pelo tubo mergulhado ao ânulo do pote e seguir pela linha de transbordo aos "
      "tanques atmosféricos.")
    w("   - Os respiros do TQ-201 (FCA-201) e do TQ-301 (A7, sem tratamento) passam a receber "
      "CH₄/H₂S.")
    w("   - Estimar a vazão arrastada e tratá-la na classificação de área e no tratamento dos "
      "respiros (LAC-049).\n")
    w("## 3. Alças de entrada e demais trens bombeados (Q = 6 m³/h)\n")
    w("Funcionamento das alças:")
    w("- As alças são pressurizadas, com crista em LSHH + 1,0 m.")
    w("- Uma ventosa de esgoto (corpo longo) fica na crista e descarrega no espaço de gás do "
      "reator por um N1.")
    w("- **Com τy baixo:** a descida perde pouco, a crista fica sob a pressão do gás e a "
      "ventosa admite gás (não ar). A descida trabalha livre.")
    w("- **Com τy alto:** a PCP pressuriza a descida em DE160 até o N2.")
    w("- Em qualquer caso a crista acima do nível impede o sifonamento do reator de volta pela "
      "alça.")
    w("- A alimentação dos R-201/R-202 é **alternada** pelas V-201AL e V-202BQ atuadas, "
      "intertravadas para nunca ficarem abertas juntas: não há rateio em paralelo.")
    w("  - O ramal parado (até ≈ 34 m no R-202-AL) envelhece e ganha τy. Alternar com "
      "frequência e lavar com água antes de longas paradas. A AMT pessimista já cobre a "
      "partida com τy = 100 Pa.")
    w("- **Ventosa com τy baixo:** a ventosa da crista cicla (descida livre). Especificar "
      "ventosa de esgoto de corpo longo, com manutenção programada, e ZSC/inspeção no plano "
      "de manutenção.\n")
    w("| trem | caso | perda sucção (m) | perda recalque (m) | AMT (m) | AMT (bar) | "
      "pressão na crista (m) | p. sucção no flange (m) | NPSHd (m) |")
    w("|---|---|---|---|---|---|---|---|---|")
    for (nome, caso), r in res["bomb"].items():
        w(f"| {nome} | {caso} | {_f(r['h_suc'])} | {_f(r['h_rec'])} | {_f(r['AMT'])} | "
          f"{_f(r['bar'])} | {_f(r['p_crista_m'])} | {_f(r['p_succao_m'])} | "
          f"{_f(r['NPSHd'])} |")
    pior = max(res["bomb"].items(), key=lambda kv: kv[1]["bar"])
    w("\nLeitura da tabela:\n")
    w(f"- **Maior AMT:** {pior[0][0]}, caso {pior[0][1]}, com {_f(pior[1]['bar'])} bar.")
    w("  - Especificar as PCP P-201 e P-301 com ≥ 2 estágios.")
    w("  - **PSV (ou disco de ruptura com retorno) e PSHH com trip na descarga, antes de "
      "qualquer válvula** (RES-001 VC-10/LQ-01). A PCP fechada contra uma válvula passa da "
      "classe do PEAD SDR17.")
    w("- **Pressão na crista:** igual à do gás nos casos de τy baixo, quando a ventosa abre; "
      "positiva quando a descida é pressurizada.")
    neg = [(k, r) for k, r in res["bomb"].items() if r["p_succao_m"] is not None]
    pmin = min(neg, key=lambda kv: kv[1]["p_succao_m"])
    nmin = min(neg, key=lambda kv: kv[1]["NPSHd"])
    w(f"- **Pressão na sucção:** fica negativa com τy alto. O pior caso é {pmin[0][0]}, "
      f"{pmin[0][1]}, com {_f(pmin[1]['p_succao_m'])} m. O menor NPSH disponível é "
      f"{_f(nmin[1]['NPSHd'])} m ({nmin[0][0]}, {nmin[0][1]}).")
    w("  - Especificar PCP com NPSHr ≤ 3 m.")
    w("  - Sucção toda em PEAD soldado e selo mecânico com flush, porque a sucção em vácuo "
      "admite ar por juntas e selo, e a ventosa leva esse ar ao espaço de gás.")
    w("  - A sucção da P-201 é reta, sem curvas, com a bomba alinhada ao N-SUC.")
    w("  - Nas purgas, a sucção depende do nível do reator: PSL na sucção.")
    w("- **Purgas:** registro LC + XV falha-fecha no N2, e chave presa entre V-xPG e a sucção "
      "do tanque (V-201S / V-301S).")
    w("  - A chave é única para V-201PG/V-202PG: um reator por vez, sem interligar os dois "
      "pelo fundo.")
    w("  - Na purga dos R-201/202 pela P-301, a crista da L-301R fica acima do LSHH dos "
      "reatores e tem ventosa (quebra-vácuo a ar, lado atmosférico). Com a PCP parada ou "
      "gasta, o reator não sifona pela bomba: a AMT da purga é positiva.")
    w("  - A XV abre só com os permissivos da RES-001 §5.6: PALL, ZSC do gás, LSL do reator, "
      "LSHH do destino e PSL da sucção. Ela fecha no trip da bomba.")
    t = res["tq201"]
    w("\n## 4. TQ-201 (neutralização): Ø1,80 m, fundo a +0,45, sucção a +0,70\n")
    w("| nível | cota (m) | volume (m³) |\n|---|---|---|")
    for k, v in nv["TQ-201"].items():
        w(f"| {k} | {_f(v / 1000)} | {_f(t['vol'][k])} |")
    w(f"\n- **Volume útil** LSL→LSH: {_f(t['util'])} m³. Detenção até o LSH a 6 m³/h: "
      f"{_f(t['TDH_min_LSH'], 0)} min (neutralização: 10–30 min usuais).")
    w(f"- **Submergência da sucção (HI 9.8):** o LSLL fica ≥ 0,15 m acima do topo do bocal "
      f"N-SUC. O pulmão LSH→LSHH é de {_f(t['pulmao_LSH_LSHH_min'], 1)} min.")
    if "residuo" in res:
        rr = res["residuo"]
        w("- **Volume que ainda chega depois do trip** (o reator escoa até a soleira, caso "
          "otimista), contra o volume LSHH→extravasor:")
        w(f"  - R-101 → TQ-201: {_f(rr['R-101']['vol_m3'])} m³ contra {_f(rr['TQ-201'])} m³;")
        w(f"  - R-201 ou R-202 → TQ-301 (alimentação alternada: um reator por vez): "
          f"{_f(max(rr['R-201']['vol_m3'], rr['R-202']['vol_m3']))} m³ contra "
          f"{_f(rr['TQ-301'])} m³.")
        w("  - O caso otimista é o pior, porque com τy alto parte do volume fica retida no "
          "reator em repouso.")
        w("  - Com o extravasor do TQ-201 a +1,85 m, os dois volumes cabem e o extravasor não "
          "opera num trip normal.")
        w("  - O LSHH do TQ-201 também corta a P-301 (RL-05).")
    w("\n## 5. Linhas de energia e piezométricas\n")
    w(f"![LE e LP]({figura})\n")
    w("- **Lâmina livre:** a LP coincide com a superfície da polpa.")
    w("- **No pote:** a LP cai pelo tubo mergulhado e pelo ânulo até o vertedor.")
    w("- **Velocidade:** de 0,1 a 0,4 m/s, então v²/2g < 1 cm e a LE se sobrepõe à LP.")
    w("- **Bombas:** a LP sobe na bomba (AMT) e cai com o atrito.")
    w("- **Alças:** a LP fica no mínimo na crista mais o gás, porque a ventosa admite gás "
      "quando cai abaixo disso.\n")
    w("## 6. Lacunas\n")
    w("As lacunas propostas (LAC-041 a LAC-049) estão em `LACUNAS_PROPOSTAS.md`. As que "
      "decidem este cálculo:")
    w("- **LAC-041:** reometria da polpa e ensaio do pote.")
    w("- **LAC-027/045:** sítio e base z = 0.")
    w("- **LAC-046:** selo de 330 mm.")
    w("- **LAC-049:** biogás arrastado aos respiros dos tanques atmosféricos.")
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
