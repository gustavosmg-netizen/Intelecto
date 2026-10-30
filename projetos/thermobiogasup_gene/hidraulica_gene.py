"""Memória hidráulica da cascata Gen E com polpa de 8% ST (plástico de Bingham).

Calcula, para os 3 casos de reologia (otimista/central/pessimista):
- saídas por gravidade selada: nível máximo do reator acima da crista, carga para romper a
  tensão de escoamento no fecho hídrico, folga até a crista, fecho em mbar, declividades;
- recalques: altura manométrica das bombas P-101 (no tie-in), P-201, P-301 e da purga;
- perfis de linha de energia (LE) e linha piezométrica (LP) dos três trens.
Unidades: m, m³/h, mbar. Cotas referidas à base comum z = 0 (premissa S5).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".claude/skills/modelagem-3d-engenharia/scripts"))
from hidraulica import reologia as rg  # noqa: E402

G = 9.81
Q_PROJ = 6.0          # m³/h: vazão máxima das PCP 2–6 m³/h (alimentação = descarga por gravidade)
Q_MAX = 20.0          # m³/h: Q_máx de retirada da RES-001 §5.6 (verificação de folga)
P_GAS_OP = 3.5        # mbar: operação máxima do espaço de gás (RES-001 Cascata B)
P_ENV = 15.0          # mbar: envelope requerido à Fibrais
# Hooper (2-K): K = K1/Re + K∞ (1 + 1/D[pol])
HOOPER = {"curva90": (800, 0.25), "curva45": (500, 0.15), "gaveta": (300, 0.10),
          "retencao": (1500, 1.50), "te": (1000, 0.60), "reducao": (160, 0.50),
          "junta_desmontagem": (100, 0.05), "entrada": (160, 0.50), "saida": (0, 1.00)}


def _k(nome: str, re: float, D: float) -> float:
    k1, kinf = HOOPER[nome]
    return k1 / max(re, 1.0) + kinf * (1 + 1 / (D / 0.0254))


def _segmentos_retos(ln, s_a, s_b):
    for el in ln.elementos:
        if el[0] == "reto":
            a, b = max(el[4], s_a), min(el[5], s_b)
            if b > a:
                yield el, a, b


def perda(ln, s_a: float, s_b: float, Q: float, f: rg.Bingham, extra_k=()) -> dict:
    """Perda de carga (m de polpa) entre s_a e s_b de uma linha cheia."""
    D = ln.tubo.di / 1000
    L = (s_b - s_a) / 1000
    p = rg.perda_tubo(Q, D, L, f)
    hv = p["v"] ** 2 / (2 * G)
    ks = list(extra_k)
    for el in ln.elementos:
        if el[0] == "curva" and s_a <= el[7] < s_b:
            ks.append("curva90" if el[6] > 60 else "curva45")
    for c in ln.componentes:
        if s_a <= c.s0 < s_b and c.tipo in HOOPER:
            ks.append(c.tipo)
    hk = sum(_k(k, p["Re_B"], D) for k in ks) * hv
    return {"hf": p["hf"], "hk": hk, "h": p["hf"] + hk, "v": p["v"], "Re_B": p["Re_B"],
            "laminar": p["laminar"], "partida": rg.carga_partida(D, L, f), "L": L}


def y_critico(Q_m3h: float, D: float) -> float:
    """Profundidade crítica (m) num tubo circular (newtoniano; aproximação da lâmina na crista)."""
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


def _s_do_te(m, ln, ramal_tag):
    """Abscissa (mm) do centro do tê do ramal `ramal_tag` na linha `ln` (do traçado)."""
    t = next(t for t in m.tes[ln.tag] if t["ramal"] == ramal_tag)
    return t["s"] + t["L"] / 2


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


def saida(m, tag: str, Q: float, f: rg.Bingham, lsh: float, p_gas_m: float = 0.0) -> dict:
    """Saída por gravidade selada do reator `tag`. p_gas_m: pressão do espaço de gás em m de
    polpa (0 = partida, conservador; ela ajuda a empurrar a polpa pelo U)."""
    sp, tr = m.linhas[f"{tag}-SP"], m.linhas[f"{tag}-TR"]
    D = tr.tubo.di / 1000
    s_te = _s_do_te(m, sp, tr.tag)
    z_c = tr.vertices[0].Z / 1000
    crista = z_c - D / 2
    yc = y_critico(Q, D)
    # lado do reator (cheio): pescoço + toco do registro + standpipe até o tê
    lado = perda(sp, 0, s_te, Q, f, extra_k=("entrada", "te"))
    lado_part = lado["partida"] + rg.carga_partida(D, 0.13, f)
    # toco horizontal do tê até a descida: lâmina sobre trecho horizontal curto
    toco = (tr.elementos[0][5] - tr.elementos[0][4]) / 1000 if tr.elementos[0][0] == "reto" else 0
    h_toco = rg.declividade_minima_livre(D, f) * toco
    h_lado = max(lado_part, lado["h"]) + h_toco
    nivel_max = crista + yc + h_lado
    # declividades dos trechos de escoamento livre (do tê até o ramo descendente do U)
    s_min = rg.declividade_minima_livre(D, f)
    fecho = tr.spec["fecho"]
    z_fundo, z_saida = fecho["z_fundo"] / 1000, fecho["z_saida"] / 1000
    decl = []
    for el in tr.elementos:
        if el[0] != "reto":
            continue
        A, B = el[1], el[2]
        dz, dh = (A.Z - B.Z) / 1000, math.hypot(B.X - A.X, B.Y - A.Y) / 1000
        if A.Z / 1000 <= z_saida + 0.01:
            break                                   # chegou ao fecho hídrico
        if dh > 0.05 and el[4] > 1:                 # ignora o toco do tê (tratado acima)
            decl.append(dz / dh)
    # fecho: superfície livre no ramo de gás sobe até romper a tensão de escoamento
    s_fundo = next(el[4] for el in tr.elementos if el[0] == "reto"
                   and abs(el[1].Z / 1000 - z_fundo) < 0.01)
    cad = _cadeia(tr)
    s_fim = tr.comprimento                          # mm
    ult = tr.elementos[-1]
    if ult[0] == "reto" and ult[3].Z < -0.99:       # queda vertical final no bocal de topo:
        s_fim = ult[4]                              # escoa em queda livre, não conta como cheio
    z_surf = z_saida + yc
    for _ in range(60):
        # chainage onde o eixo cruza z_surf descendo (antes do fundo do U)
        s_surf = 0.0
        for (s0, z0), (s1, z1) in zip(cad, cad[1:]):
            if s1 * 1000 > s_fundo + 1:
                break
            if z0 >= z_surf >= z1 and z0 != z1:
                s_surf = s0 + (z0 - z_surf) / (z0 - z1) * (s1 - s0)
        s_surf = max(s_surf, cad[1][0])
        pr = perda(tr, s_surf * 1000, s_fim, Q, f, extra_k=("saida",))
        h_b = max(pr["partida"], pr["h"])
        novo = max(z_saida + yc + h_b - p_gas_m, z_saida + yc)
        if abs(novo - z_surf) < 1e-4:
            break
        z_surf = novo
    # se o U pede carga acima da crista, o ramo descendente afoga e o nível do reator sobe junto
    nivel_max = max(crista + yc, z_surf) + h_lado
    selo_mm = (z_saida - D / 2 - (z_fundo + D / 2)) * 1000
    rho = f.rho
    return {"tag": tag, "Q": Q, "caso": f.nome, "crista": crista, "y_c": yc, "h_lado": h_lado,
            "nivel_max": nivel_max, "lsh": lsh, "folga_lsh": lsh - nivel_max,
            "decl_min": min(decl) if decl else None, "s_min": s_min,
            "z_surf_fecho": z_surf, "folga_crista": crista - z_surf, "h_fecho": z_surf - z_saida,
            "selo_mm": selo_mm, "selo_mbar": selo_mm / 1000 * rho * G / 100,
            "z_saida": z_saida, "z_fundo": z_fundo, "s_surf": s_surf, "L_fecho": pr["L"],
            "v": lado["v"], "s_fim": s_fim / 1000, "s_te": s_te / 1000, "p_gas_m": p_gas_m}


def recalque(m, trechos, Q, f, z_fonte, z_destino, p_destino_mbar=0.0) -> dict:
    """Altura manométrica: trechos = [(linha, s_a, s_b, extra_k)] em série (sucção+recalque)."""
    h = 0.0
    det = []
    for ln, s_a, s_b, ek in trechos:
        r = perda(m.linhas[ln], s_a, s_b, Q, f, extra_k=ek)
        h += r["h"]
        det.append((ln, r))
    est = z_destino - z_fonte + p_destino_mbar * 100 / (f.rho * G)
    return {"estatica": est, "atrito": h, "AMT": est + h, "det": det,
            "bar": (est + h) * f.rho * G / 1e5}


P_ATM_KPA = 101.3       # nível do mar (premissa; altitude do sítio é LACUNA de S5)
P_VAP_KPA = 5.6         # água a 35 °C (mesofílico)


def trens(m, nv):
    """Trens bombeados: sucção e recalque como [(linha, s_a, s_b, perdas localizadas)]."""
    def comp(t):
        return m.linhas[t].comprimento

    al0, al1, al2 = m.linhas["R-101-AL"], m.linhas["R-201-AL"], m.linhas["R-202-AL"]
    l3, ls = m.linhas["L-301R"], m.linhas["L-301S"]
    suc201 = [("L-201S", 0, comp("L-201S"), ("entrada",))]
    suc301 = [("L-301S", 0, comp("L-301S"), ("entrada",))]
    crista_alca = {t: nv[t]["LSHH"] / 1000 + 1.0 for t in ("R-101", "R-201", "R-202")}
    zb201 = m.portas["P-201.succao"].ponto.Z / 1000
    zb301 = m.portas["P-301.succao"].ponto.Z / 1000
    ls_te = _s_do_te(m, ls, "R-201-PG")
    l2s_te = _s_do_te(m, m.linhas["L-201S"], "R-101-PG")
    return {
        "P-101 → R-101": {
            "suc": [], "rec": [("R-101-AL", 0, _s_do_te(m, al0, "R-101-DL"), ())],
            "z_fonte": 1.20, "z_bomba": 1.20, "z_dest": crista_alca["R-101"], "p_dest": P_GAS_OP,
            "fonte": "tie-in da P-101 a +1,20 (pressão a fornecer pela Ilha 1)",
            "destino": "crista da alça do R-101 (respiro ao gás)", "reator": "R-101"},
        "P-201 → R-201": {
            "suc": suc201, "rec": [("R-201-AL", 0, _s_do_te(m, al1, "R-201-DL"), ())],
            "z_fonte": nv["TQ-201"]["LSLL"] / 1000, "z_bomba": zb201,
            "z_dest": crista_alca["R-201"], "p_dest": P_GAS_OP, "fonte": "TQ-201 no LSLL",
            "destino": "crista da alça do R-201", "reator": "R-201"},
        "P-201 → R-202": {
            "suc": suc201, "rec": [("R-201-AL", 0, _s_do_te(m, al1, "R-202-AL"), ("te",)),
                                   ("R-202-AL", 0, _s_do_te(m, al2, "R-202-DL"), ())],
            "z_fonte": nv["TQ-201"]["LSLL"] / 1000, "z_bomba": zb201,
            "z_dest": crista_alca["R-202"], "p_dest": P_GAS_OP, "fonte": "TQ-201 no LSLL",
            "destino": "crista da alça do R-202", "reator": "R-202"},
        "P-301 → TQ-301 (recirculação)": {
            "suc": suc301, "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["TQ-301"]["LSL"] / 1000, "z_bomba": zb301,
            "z_dest": max(v.Z for v in l3.vertices) / 1000, "p_dest": 0.0,
            "fonte": "TQ-301 no LSL", "destino": "ponto alto da L-301R (descarga livre)"},
        "P-301 → TQ-201 (RL-05)": {
            "suc": suc301, "rec": [("L-301R", 0, _s_do_te(m, l3, "L-RL05"), ("te",)),
                                   ("L-RL05", 0, comp("L-RL05"), ("saida",))],
            "z_fonte": nv["TQ-301"]["LSL"] / 1000, "z_bomba": zb301,
            "z_dest": max(v.Z for v in m.linhas["L-RL05"].vertices) / 1000, "p_dest": 0.0,
            "fonte": "TQ-301 no LSL", "destino": "ponto alto da L-RL05 (descarga livre)"},
        "Purga R-201 → P-301": {
            "suc": [("R-201-PG", 0, comp("R-201-PG"), ("entrada", "te")),
                    ("L-301S", ls_te, comp("L-301S"), ())],
            "rec": [("L-301R", 0, comp("L-301R"), ("saida",))],
            "z_fonte": nv["R-201"]["crista"] / 1000, "p_fonte": P_GAS_OP, "z_bomba": zb301,
            "z_dest": max(v.Z for v in l3.vertices) / 1000, "p_dest": 0.0,
            "fonte": "R-201 na crista", "destino": "TQ-301 / expedição"},
        "Purga R-101 → P-201": {
            "suc": [("R-101-PG", 0, comp("R-101-PG"), ("entrada", "te")),
                    ("L-201S", l2s_te, comp("L-201S"), ())],
            "rec": [("R-201-AL", 0, _s_do_te(m, al1, "R-201-DL"), ())],
            "z_fonte": nv["R-101"]["crista"] / 1000, "p_fonte": P_GAS_OP, "z_bomba": zb201,
            "z_dest": crista_alca["R-201"], "p_dest": P_GAS_OP,
            "fonte": "R-101 na crista", "destino": "R-201 (ou expedição)"},
    }


def bombeado(m, tr, Q, f) -> dict:
    """AMT, pressão e NPSH disponível de um trem bombeado (m de polpa)."""
    mca = 100 / (f.rho * G)                                   # m de polpa por mbar
    suc = [(t, perda(m.linhas[t[0]], t[1], t[2], Q, f, extra_k=t[3])) for t in tr["suc"]]
    rec = [(t, perda(m.linhas[t[0]], t[1], t[2], Q, f, extra_k=t[3])) for t in tr["rec"]]
    h_s = sum(r["h"] for _, r in suc)
    h_r = sum(r["h"] for _, r in rec)
    p_f = tr.get("p_fonte", 0.0) * mca
    hgl_suc = tr["z_fonte"] + p_f - h_s                       # LP na sucção da bomba
    hgl_rec = tr["z_dest"] + tr["p_dest"] * mca + h_r         # LP no recalque da bomba
    amt = hgl_rec - hgl_suc
    patm = P_ATM_KPA * 1000 / (f.rho * G)
    npsh = patm + hgl_suc - tr["z_bomba"] - P_VAP_KPA * 1000 / (f.rho * G)
    return {"h_suc": h_s, "h_rec": h_r, "hgl_suc": hgl_suc, "hgl_rec": hgl_rec, "AMT": amt,
            "bar": amt * f.rho * G / 1e5, "p_succao_m": hgl_suc - tr["z_bomba"],
            "p_recalque_bar": (hgl_rec - tr["z_bomba"]) * f.rho * G / 1e5,
            "NPSHd": npsh if tr["suc"] else None, "suc": suc, "rec": rec}


def tq201(nv, Di=1.8, z_fundo=0.45, Q=Q_PROJ) -> dict:
    A = math.pi * Di ** 2 / 4
    vol = {k: (v / 1000 - z_fundo) * A for k, v in nv["TQ-201"].items()}
    return {"A": A, "vol": vol, "util": vol["LSH"] - vol["LSL"],
            "TDH_min_LSH": vol["LSH"] / Q * 60,
            "pulmao_LSH_LSHH_min": (vol["LSHH"] - vol["LSH"]) / Q * 60,
            "pulmao_LSHH_EXT_min": (vol["extravasor"] - vol["LSHH"]) / Q * 60}


def calcular(m, nv):
    out = {"saida": {}, "bomb": {}}
    for f in rg.CASOS_8ST:
        for Q in (Q_PROJ, Q_MAX):
            for tag in ("R-101", "R-201", "R-202"):
                out["saida"][(tag, f.nome, Q)] = saida(m, tag, Q, f, nv[tag]["LSH"] / 1000)
        for nome, tr in trens(m, nv).items():
            out["bomb"][(nome, f.nome)] = bombeado(m, tr, Q_PROJ, f)
    out["tq201"] = tq201(nv)
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
    for (t, rr) in r["rec"]:
        hv = rr["v"] ** 2 / (2 * G)
        for s, z, lp in _trecho_perfil(m, t[0], t[1], t[2], hgl, rr["h"]):
            out.append((s0 + s, z, lp, lp + hv, None))
        hgl -= rr["h"]
        s0 += (t[2] - t[1]) / 1000
    return out, r


def perfil_gravidade(m, tag, Q, f, nv_dest):
    """Reator → N-SAI → standpipe → crista → descida livre → U → descarga no tanque."""
    mca = 100 / (f.rho * G)
    pg = P_GAS_OP * mca
    r = saida(m, tag, Q, f, 99, p_gas_m=pg)
    sp, tr = m.linhas[f"{tag}-SP"], m.linhas[f"{tag}-TR"]
    hv = r["v"] ** 2 / (2 * G)
    r_tub = tr.tubo.di / 2000
    out = [(0.0, r["nivel_max"], r["nivel_max"] + pg, r["nivel_max"] + pg, "reator")]
    hgl_te = max(r["crista"] + r["y_c"], r["z_surf_fecho"]) + pg
    for s, z, lp in _trecho_perfil(m, sp.tag, 0, r["s_te"] * 1000, r["nivel_max"] + pg,
                                   r["nivel_max"] + pg - hgl_te):
        out.append((s, z, lp, lp + hv, None))
    s0 = r["s_te"]
    for s, z in _cadeia(tr):
        if s <= r["s_surf"]:                                  # lâmina livre (ventilada ao gás)
            lp = max(z - r_tub + r["y_c"], r["z_surf_fecho"]) + pg   # lâmina sobre a geratriz
        elif s <= r["s_fim"] + 1e-9:                          # U cheio até a crista de saída
            k = (s - r["s_surf"]) / max(r["s_fim"] - r["s_surf"], 1e-9)
            lp = r["z_surf_fecho"] + pg - k * (r["z_surf_fecho"] + pg - (r["z_saida"] + r["y_c"]))
        else:                                                 # queda livre (atmosfera)
            lp = z
        out.append((s0 + s, z, lp, lp + hv, None))
    s_end = s0 + _cadeia(tr)[-1][0]
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
                pts, r = perfil_gravidade(m, chave, Q, f, nv[dq][cota] / 1000)
                titulo = f"{chave} → {dq}: saída por gravidade selada"
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
                    if p[4] == "bomba":
                        ax.annotate("bomba", (p[0], p[2]), textcoords="offset points",
                                    xytext=(4, 4), fontsize=8, color="#52514e")
            if titulo:
                ax.set_title(titulo, fontsize=10, loc="left")
        ax.plot([p[0] for p in eixo if p[4] is None], [p[1] for p in eixo if p[4] is None],
                color="#8a8984", lw=4, alpha=0.45, label="eixo do tubo")
        if tipo == "grav":
            for k, est in (("crista", ":"), ("LSH", "--"), ("LSHH", "-.")):
                z = nv[chave][k] / 1000
                ax.axhline(z, color="#52514e", lw=0.7, ls=est)
                ax.text(0.2, z + 0.03, f"{k} {chave} {z:.2f}", fontsize=7, color="#52514e")
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
    w("Situação: **PROPOSTA DE TRABALHO**, não liberada. Falta o Crivo A–F por revisor "
      "independente (CLAUDE.md do projeto). Cotas na base comum z = 0 (premissa a confirmar "
      "em S5). Sem valores monetários.\n")
    w("## 1. Premissas\n")
    w(f"- Vazão de projeto das saídas por gravidade: **{Q_PROJ:.0f} m³/h**. É a vazão máxima "
      "das PCP de alimentação (2–6 m³/h), e em regime o que entra é o que sai. "
      f"{Q_MAX:.0f} m³/h (Q_máx de retirada) aparece só como verificação de folga: retiradas "
      "são bombeadas, não saem pelo transbordo.")
    w("- Reologia: plástico de Bingham. Escoamento cheio por Buckingham–Reiner (laminar) e "
      "Darby–Mun–Boger (transição/turbulento). Partida: 4·τy·L/(ρ·g·D). Lâmina livre: "
      "S ≥ τy/(ρ·g·0,304·D). Perdas localizadas pelo 2-K de Hooper com Re de Bingham.")
    w("- Três casos (HIPÓTESE até a reometria da polpa real, **LAC-041**):\n")
    w("| caso | τy (Pa) | μp (Pa·s) | ρ (kg/m³) |\n|---|---|---|---|")
    for f in rg.CASOS_8ST:
        w(f"| {f.nome} | {f.tau_y:.0f} | {_f(f.mu_p)} | {f.rho:.0f} |")
    w(f"\n- Espaço de gás: operação +1,5 a +{_f(P_GAS_OP, 1)} mbar; nas verificações de nível "
      "foi usado 0 mbar (partida, conservador, porque a pressão do gás ajuda a empurrar a "
      "polpa pelo U).")
    w(f"- NPSH: P_atm {P_ATM_KPA} kPa (nível do mar; a altitude é lacuna de S5) e P_vapor "
      f"{P_VAP_KPA} kPa (35 °C).\n")
    w("## 2. Saídas por gravidade (N-SAI DN150 → standpipe → crista → descida a 45° → U)\n")
    w("Leitura: *nível máx.* é o nível que o reator atinge para escoar Q. Ele soma a crista, a "
      "lâmina crítica, a carga do lado do reator e, se o U pedir mais carga que a crista "
      "oferece, o afogamento do ramo descendente. A *folga na crista* é a crista menos a "
      "superfície no ramo descendente do U: se for negativa, o U afoga a crista e o nível "
      "sobe junto. O selo é medido do topo interno do fundo do U ao fundo interno da saída.\n")
    w("| reator | caso | Q (m³/h) | nível máx. (m) | folga até LSH (m) | folga na crista (m) "
      "| carga no U (m) | tubo cheio (m) | decl. mín. livre (m/m) | decl. adotada | selo (mm / mbar) |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    for (tag, caso, Q), r in res["saida"].items():
        alerta = " ⚠" if r["folga_lsh"] < 0.10 or r["folga_crista"] < 0.05 else ""
        w(f"| {tag} | {caso} | {Q:.0f} | {_f(r['nivel_max'])} | {_f(r['folga_lsh'])}{alerta} | "
          f"{_f(r['folga_crista'])} | {_f(r['h_fecho'])} | {_f(r['L_fecho'], 1)} | "
          f"{_f(r['s_min'], 3)} | {_f(r['decl_min'])} | {r['selo_mm']:.0f} / "
          f"{_f(r['selo_mbar'], 0)} |")
    w("\nConclusões das saídas:\n")
    w("1. **A saída por gravidade de polpa a 8% ST funciona** na vazão de projeto nos três "
      "casos de reologia. Isso vale para este arranjo: crista no nível, descidas a 45° "
      "(S = 1,0, contra o mínimo de 0,23 no caso pessimista) e só o U e a saída curta "
      "trabalhando cheios.")
    w("2. O trecho crítico é o **U do R-101 → TQ-201**. Nele cabe menos desnível entre a "
      "crista (+3,50) e a entrada do TQ-201 (+2,26). No caso pessimista sobram poucos "
      "centímetros na crista. O nível do reator continua abaixo do LSH, então a margem "
      "depende da reometria (LAC-041). Contingência, se τy > 100 Pa: U em DE200 (a carga "
      "cai cerca de 20%) ou rebaixar a entrada do TQ-201.")
    w("3. **Selo de 330 mm de polpa** (≈ 33 mbar). É 2,7× a abertura do dispositivo de "
      "emergência (+12 mbar), 4× o vácuo de projeto (−8 mbar) e passa os ≥ 250 mm da RES-001 "
      "LQ-04. A proposta citava 500 mmCA, mas com τy alto um U mais fundo pede tanto tubo "
      "cheio que a polpa afoga a crista do R-101. **Divergência a validar com o "
      "responsável de processo.**")
    w("4. Q = 20 m³/h por gravidade só ocorreria com alimentação de 20 m³/h, que as PCP não "
      "entregam. No caso pessimista a esse fluxo o LSH seria atingido: o sistema falha para o "
      "lado seguro (alarme e corte da alimentação), sem sobrepressão.\n")
    w("## 3. Trens bombeados (Q = 6 m³/h)\n")
    w("| trem | caso | perda sucção (m) | perda recalque (m) | AMT (m) | AMT (bar) | "
      "p. sucção no flange (m) | NPSHd (m) |")
    w("|---|---|---|---|---|---|---|---|")
    for (nome, caso), r in res["bomb"].items():
        w(f"| {nome} | {caso} | {_f(r['h_suc'])} | {_f(r['h_rec'])} | {_f(r['AMT'])} | "
          f"{_f(r['bar'])} | {_f(r['p_succao_m'])} | {_f(r['NPSHd'])} |")
    pior = max(res["bomb"].items(), key=lambda kv: kv[1]["bar"])
    w(f"\n- Maior AMT: **{pior[0][0]}** no caso {pior[0][1]}: {_f(pior[1]['bar'])} bar. "
      "Especificar as PCP P-201 e P-301 para ≥ 4 bar (2 estágios) cobre o caso pessimista "
      "com folga. A pressão da P-101 no tie-in sai da tabela (trem P-101 → R-101).")
    w("- A sucção é sempre positiva nos tanques. Nas purgas, a sucção depende do nível do "
      "reator: PSL na sucção e intertravamento de proteção contra marcha a seco (VC-11).")
    t = res["tq201"]
    w("\n## 4. TQ-201 (neutralização), Ø1,80 m, fundo a +0,45\n")
    w("| nível | cota (m) | volume (m³) |\n|---|---|---|")
    for k, v in nv["TQ-201"].items():
        w(f"| {k} | {_f(v / 1000)} | {_f(t['vol'][k])} |")
    w(f"\n- Volume útil LSL→LSH {_f(t['util'])} m³. Detenção até o LSH a 6 m³/h: "
      f"{_f(t['TDH_min_LSH'], 0)} min (neutralização de pH: 10–30 min usuais).")
    w(f"- Pulmão LSH→LSHH {_f(t['pulmao_LSH_LSHH_min'], 1)} min; LSHH→extravasor "
      f"{_f(t['pulmao_LSHH_EXT_min'], 1)} min, para o intertravamento cortar a P-101 antes "
      "de transbordar.")
    w("- O extravasor DN150 por lâmina livre comporta a vazão máxima de entrada com folga, "
      "e a soleira de entrada fica a ≥ 3·DI acima dele (air gap).\n")
    w("## 5. Linhas de energia e piezométricas\n")
    w(f"![LE e LP]({figura})\n")
    w("- No escoamento livre (descidas) a LP coincide com a superfície da polpa e a LE "
      "fica v²/2g acima. As velocidades são de 0,1 a 0,4 m/s, então v²/2g fica abaixo de "
      "1 cm e as duas linhas se sobrepõem na escala do gráfico.")
    w("- A LP sobe na bomba (AMT) e cai com o atrito. Nas alças, ela termina na crista "
      "ventilada ao gás do reator, que quebra o sifão.")
    w("- O salto do gás (+3,5 mbar ≈ 3,5 cm) aparece na LP do lado do reator e se desfaz na "
      "saída do U, que descarrega à pressão atmosférica.\n")
    w("## 6. Lacunas abertas por este cálculo\n")
    w("- **LAC-041**: reometria da polpa real (τy, μp a 35 °C, 6–9% ST). Ela fecha a "
      "margem do U do R-101.")
    w("- Altitude do sítio (NPSH) e confirmação da base comum z = 0 (S5).")
    open(arquivo_md, "w").write("\n".join(L) + "\n")


if __name__ == "__main__":
    import os
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    import planta_gene as pg
    saida_dir = os.path.join(os.path.dirname(__file__), "saida")
    os.makedirs(saida_dir, exist_ok=True)
    m, tq, _ = pg.construir_modelo(solidos=False)
    res = calcular(m, pg.NIVEL)
    grafico(m, pg.NIVEL, os.path.join(saida_dir, "LE_LP_gene.png"))
    memoria(m, pg.NIVEL, res, os.path.join(saida_dir, "MEMORIA_HIDRAULICA.md"), "LE_LP_gene.png")
    print("ok")
