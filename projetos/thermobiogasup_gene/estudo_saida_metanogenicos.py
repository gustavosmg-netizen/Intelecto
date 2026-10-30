"""Estudo da saída dos metanogênicos (R-201/R-202 → digestato) — rev. 6 em estudo.

Compara duas alternativas para o trecho que o cliente achou "embolado" na rev. 5 (descidas a
uma caixa comum vedada, CS-301, e respiro do tampo ligado ao tubo de saída):

  A′  selo hídrico mantido, compacto: CS-301 entre os reatores, descidas curtas; respiro por
      bocal novo de costado (A′1) ou pelo N1-225 existente (A′2); P-301 transfere ao TQ-301,
      que continua aberto.
  B   TQ-301 fechado e integrado ao envelope de gás: rampa livre e curta de cada reator ao N1
      do TQ-301, sem copos nem caixa; linha de equalização LE-301 do TQ-301 ao coletor de gás
      (o N-SAI trabalha afogado no pulso e não deixa o gás voltar pelo tubo de saída).

Também escreve a nota técnica do escoamento bifásico (polpa de Bingham + biogás).
Geometria e níveis vêm de planta_gene.py; reologia dos 3 casos da skill (CASOS_8ST).
Uso: python estudo_saida_metanogenicos.py
"""
from __future__ import annotations

import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Circle, Rectangle  # noqa: E402

import hidraulica_gene as hg  # noqa: E402
from hidraulica_gene import rg  # noqa: E402
from planta_gene import C, NIVEL, SELO_MIN  # noqa: E402

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI / "saida"
G = 9.81
RHO = 1030.0

# --- geometria (mm) -------------------------------------------------------------------------
R_REATOR = 3800 / 2 + 12           # R-201/202: Di 3800, t 12
R_TQ, A_TQ = 3000 / 2, math.pi * 3.0 ** 2 / 4
Z_N1_TQ = 4660                     # face dos N1 do tampo do TQ-301 (315A-25)
R_N1_TQ = 1250
PROJ = 200                         # projeção do N-SAI
D_SAI = 0.1412                     # DE160 SDR17 (di)
Z_SAI = NIVEL["R-201"]["crista"] + 76
L_HORIZ = 534.0                    # trecho horizontal do N-SAI (faca + tê de lavagem): o mesmo
# da rev. 5 (_horizontal_inicial de R-201-SAI), para a subida na soleira ser a mesma
Q_PULSO = hg.Q_PROJ                # 6 m³/h (P-201)
RESIDUO_REATOR = 0.71              # m³ por reator após corte (MEMORIA_HIDRAULICA §3)
BN_CRIT = 0.143                    # Bingham crítico de aprisionamento de bolha esférica
# (Tsamopoulos et al., 2008)
# linha de equalização LE-301 (TQ-301 → pote PC-301 → COL-501): comprimento de ESTUDO, a
# confirmar no traçado; DE110 SDR17
L_LE, D_LE = 25.0, 0.0968
P_PVRV = 15.0                      # mbar: alvo do PVRV do TQ-301 (LAC-057), acima da emergência
SELO_EXT = 450.0                   # mm: selo de emergência do extravasor do TQ-301 (SO-301)
AZ_REV5 = {"R-201": 182, "R-202": 230}   # azimutes do N-SAI na rev. 5 (BOCAIS_FIBRAIS)


def _az(o, d):
    return math.degrees(math.atan2(d[0] - o[0], d[1] - o[1])) % 360


def _ponto(o, az, r):
    a = math.radians(az)
    return o[0] + r * math.sin(a), o[1] + r * math.cos(a)


def geometria_b():
    """Linha de saída da alternativa B: N-SAI → trecho horizontal (faca + tê de lavagem) →
    rampa → curva → vertical curta no N1 do tampo do TQ-301."""
    out = {}
    tq = C["TQ-301"]
    for tag, az_n1 in (("R-201", 270), ("R-202", 90)):
        n1 = _ponto(tq, az_n1, R_N1_TQ)
        az = _az(C[tag], n1)
        p0 = _ponto(C[tag], az, R_REATOR + PROJ)
        Lh_total = math.hypot(n1[0] - p0[0], n1[1] - p0[1])
        z_vert = Z_N1_TQ + 350 + 300                # topo da vertical (curva de 0,3 m de raio)
        dz = Z_SAI - z_vert
        dx = Lh_total - L_HORIZ - 300               # 0,3 m consumidos pela curva final
        sen = dz / math.hypot(dz, dx)
        L = L_HORIZ + math.hypot(dz, dx) + 650
        out[tag] = {"n1": f"N1-{az_n1}", "az_sai": az, "Lh": Lh_total / 1000, "dz": dz / 1000,
                    "sen": sen, "theta": math.degrees(math.asin(sen)), "L": L / 1000,
                    "p0": p0, "n1_xy": n1, "z_vert": z_vert / 1000}
    return out


def geometria_a():
    """Alternativa A′: CS-301 (Ø 2,0 m, tampo ≈ +2,1, como na rev. 5) ao sul do vão entre
    R-201 e R-202 — posição de ESTUDO; copos sob o tampo."""
    cs = (14750, -2600)
    copos = {"R-201": (cs[0] - 450, cs[1] + 350), "R-202": (cs[0] + 450, cs[1] + 350)}
    out = {"cs": cs, "copos": copos}
    for tag in ("R-201", "R-202"):
        az = _az(C[tag], copos[tag])
        p0 = _ponto(C[tag], az, R_REATOR + PROJ)
        Lh = math.hypot(copos[tag][0] - p0[0], copos[tag][1] - p0[1])
        dz = Z_SAI - (150 + 1650 + 300)             # tampo da CS-301 + bocal
        out[tag] = {"az_sai": az, "Lh": Lh / 1000, "dz": dz / 1000, "p0": p0,
                    "rs1": (8900 - Z_SAI) / 1000 + 0.3}
    out["folga_tq"] = math.hypot(C["TQ-301"][0] - cs[0], C["TQ-301"][1] - cs[1]) / 1000 \
        - R_TQ / 1000 - 1.01
    out["folga_reator"] = math.hypot(C["R-201"][0] - cs[0], C["R-201"][1] - cs[1]) / 1000 \
        - R_REATOR / 1000 - 1.01
    return out


def bingham(gb):
    lin = []
    topo_sai = Z_SAI / 1000 + D_SAI / 2
    sen_b = min(v["sen"] for v in gb.values())
    for f in rg.CASOS_8ST:
        h_sol, _ = hg._soleira_livre(Q_PULSO, D_SAI, L_HORIZ / 1000 + 0.13, f, ("gaveta",))
        nivel = 7.5 + h_sol
        lin.append({"caso": f.nome, "tau_y": f.tau_y, "h_sol": h_sol, "nivel": nivel,
                    "folga_lsh": NIVEL["R-201"]["LSH"] / 1000 - nivel,
                    "afogado": nivel > topo_sai, "s_min": rg.declividade_minima_livre(D_SAI, f),
                    "sen_b": sen_b, "r_crit_cm": f.tau_y / (BN_CRIT * f.rho * G) * 100,
                    "lamina_mm": f.tau_y / (f.rho * G * sen_b) * 1000,
                    "selo_espuma": {e: SELO_MIN / 1000 * (1 - e) * RHO * G / 100
                                    for e in (0.0, 0.2, 0.5, 0.8)}})
    return lin, topo_sai


def niveis_tq_b():
    """No B os dois reatores escoam ao TQ-301 depois de um corte: o LSHH tem de deixar volume
    para os dois resíduos abaixo do extravasor selado."""
    nv = NIVEL["TQ-301"]
    vol_atual = (nv["extravasor"] - nv["LSHH"]) / 1000 * A_TQ
    precisa = 2 * RESIDUO_REATOR
    lshh_max = nv["extravasor"] / 1000 - precisa / A_TQ
    lshh = math.floor((lshh_max - 0.05) * 20) / 20
    return {"vol_atual": vol_atual, "precisa": precisa, "lshh_max": lshh_max, "lshh_prop": lshh,
            "faixa_lsh_lshh": (lshh - nv["LSH"] / 1000) * A_TQ}


def equalizacao():
    """LE-301: perda de gás para o pulso (6 m³/h) somado à expedição pela P-301 (6 m³/h)."""
    Q = 2 * Q_PULSO
    v = Q / 3600 / (math.pi * D_LE ** 2 / 4)
    rho, mu = 0.97, 1.3e-5
    re = rho * v * D_LE / mu
    f = 64 / re if re < 2300 else 0.316 / re ** 0.25
    dp = (f * L_LE / D_LE + 3.0) * rho * v ** 2 / 2 / 100       # mbar (+ pote e curvas)
    return {"Q": Q, "v": v, "dp": dp}


def selo_extravasor():
    h_min = P_PVRV * 100 / (RHO * G) * 1000                     # mm de polpa para o PVRV
    return {"h_min": h_min, "h_esp50": SELO_EXT * 0.5,
            "mbar": SELO_EXT / 1000 * RHO * G / 100,
            "mbar_esp50": SELO_EXT / 1000 * 0.5 * RHO * G / 100}


# --- figura ---------------------------------------------------------------------------------
def figura(ga, gb, tqb, arquivo):
    fig, ax = plt.subplots(1, 3, figsize=(17, 6.6), gridspec_kw={"width_ratios": [1, 1, 1.15]})
    tq = C["TQ-301"]
    for a, titulo in ((ax[0], "A′ — selo compacto (planta)"),
                      (ax[1], "B — TQ-301 fechado ao gás (planta)")):
        for tag in ("R-201", "R-202"):
            a.add_patch(Circle(C[tag], 1912, fill=False, lw=1.6))
            a.text(*C[tag], tag, ha="center", va="center", fontsize=10, weight="bold")
        a.add_patch(Circle(tq, R_TQ, fill=False, lw=1.6))
        a.text(tq[0], tq[1] - 300, "TQ-301", ha="center", fontsize=10, weight="bold")
        a.set_xlim(9000, 20500), a.set_ylim(-9800, 2400), a.set_aspect("equal")
        a.set_title(titulo, fontsize=11), a.grid(alpha=.25)
        a.set_xlabel("x (mm)")
    # A′
    a = ax[0]
    cs = ga["cs"]
    a.add_patch(Circle(cs, 1010, fill=False, lw=1.4, color="#555"))
    a.text(cs[0], cs[1] - 450, "CS-301", ha="center", fontsize=9)
    for tag in ("R-201", "R-202"):
        p0, cp = ga[tag]["p0"], ga["copos"][tag]
        a.plot([p0[0], cp[0]], [p0[1], cp[1]], color="#eb6834", lw=3)
        a.add_patch(Circle(cp, 280, fill=False, color="#eb6834", lw=1))
        a.plot(*p0, "s", color="#2a78d6", ms=6)
    a.plot([cs[0] - 1010, cs[0] - 1500, cs[0] - 1500, tq[0] - 1250],
           [cs[1], cs[1], tq[1], tq[1]], color="#8a5a00", lw=2, ls="--")
    a.add_patch(Rectangle((cs[0] - 1800, cs[1] - 1500), 600, 400, color="#8a5a00", alpha=.6))
    a.text(cs[0] - 1900, cs[1] - 1350, "P-301", fontsize=8, ha="right")
    a.text(9200, -8900, "■ N-SAI (respiro logo acima: bocal novo a +8,9 ou N1-225)\n"
           "— descida ao copo na CS-301    - - P-301 → TQ-301 (aberto)", fontsize=8, va="top")
    # B
    a = ax[1]
    for tag in ("R-201", "R-202"):
        g = gb[tag]
        a.plot([g["p0"][0], g["n1_xy"][0]], [g["p0"][1], g["n1_xy"][1]], color="#eb6834", lw=3)
        a.plot(*g["p0"], "s", color="#2a78d6", ms=6)
        a.plot(*g["n1_xy"], "o", color="#1baf7a", ms=7)
        a.annotate(f"{g['n1']}\nθ = {g['theta']:.0f}°", g["n1_xy"],
                   xytext=(-32 if g["n1"] == "N1-270" else 32, 4), textcoords="offset points",
                   ha="center", fontsize=8, bbox=dict(fc="white", ec="none", alpha=.8))
    a.plot([tq[0], tq[0], 20500], [tq[1], tq[1] + 2600, tq[1] + 2600], color="#2a78d6", lw=2,
           ls="--")
    a.text(17200, tq[1] + 2750, "LE-301 → PC-301 → COL-501", fontsize=8, color="#2a78d6")
    a.plot(tq[0] + 900, tq[1] - 700, "^", color="#2a78d6", ms=9)
    a.text(tq[0], tq[1] - 1600, "A7 → PVRV + corta-chamas;  M1 → tampa nova com\n"
           "bocais (LE-301 e retorno da P-301)", fontsize=8, ha="center", va="top")
    a.text(9200, -8900, "— rampa livre (N-SAI afogado no pulso)    ● chegada pelo N1\n"
           "- - equalização de gás ao coletor", fontsize=8, va="top")
    # perfil B
    a = ax[2]
    g = gb["R-201"]
    h0 = L_HORIZ / 1000
    xs = [0, h0, g["Lh"] - 0.3, g["Lh"], g["Lh"]]
    zs = [Z_SAI / 1000, Z_SAI / 1000, g["z_vert"] + 0.12, g["z_vert"] - 0.3, Z_N1_TQ / 1000]
    a.plot(xs, zs, color="#eb6834", lw=3, label="B: N-SAI → N1-270 do TQ-301")
    a.axhline(7.5, color="#2a78d6", ls=":", lw=1)
    a.text(1.6, 7.33, "soleira R-201 +7,50", fontsize=8, color="#2a78d6")
    a.axhline(8.03, color="#eb6834", ls=":", lw=1)
    a.text(1.6, 8.1, "nível máx. pessimista +8,03 (τy 100 Pa, 6 m³/h): N-SAI afogado",
           fontsize=8, color="#eb6834")
    nv = NIVEL["TQ-301"]
    for nome, z, cor in (("extravasor selado", nv["extravasor"] / 1000, "#555"),
                         ("LSHH proposto", tqb["lshh_prop"], "#c0392b"),
                         ("LSH", nv["LSH"] / 1000, "#1baf7a")):
        a.plot([g["Lh"] - 0.25, g["Lh"] + 2.75], [z, z], color=cor, ls="--", lw=1)
        a.text(g["Lh"] + 2.8, z + {"LSH": -0.12, "LSHH proposto": 0.06}.get(nome, 0.12), f"{nome} +{_f(z)}",
               fontsize=8, color=cor, va="center")
    a.add_patch(Rectangle((g["Lh"] - 0.25, 2.14), 3.0, 2.4, fill=False, lw=1.4))
    a.text(g["Lh"] + 1.25, 2.4, "TQ-301", ha="center", fontsize=9, weight="bold")
    a.set_xlim(-0.3, g["Lh"] + 5.2), a.set_ylim(0, 9)
    a.set_xlabel("distância horizontal desde o N-SAI (m)"), a.set_ylabel("cota (m)")
    a.set_title(f"B — perfil R-201 → TQ-301 (sen θ = {_f(g['sen'])} ≥ 0,23 exigido)",
                fontsize=11)
    a.grid(alpha=.25), a.legend(loc="lower left", fontsize=8)
    fig.tight_layout()
    fig.savefig(arquivo, dpi=130)
    plt.close(fig)


def _f(x, n=2):
    return f"{x:.{n}f}".replace(".", ",")


# --- documentos -----------------------------------------------------------------------------
def estudo(ga, gb, bg, topo, tqb, eq, se):
    pess = bg[2]
    razao = pess["sen_b"] / pess["s_min"]
    L = []
    w = L.append
    w("# Estudo da saída dos metanogênicos — A′ (selo compacto) × B (TQ-301 fechado ao gás)\n")
    w("Situação: **DOCUMENTO DE TRABALHO**, revisado pelo Crivo A–F independente e corrigido. "
      "Indicadores físicos, sem valores monetários. Base:")
    w("- o modelo rev. 5 (`planta_gene.py`, `MEMORIA_HIDRAULICA.md`);")
    w("- a nota técnica `NOTA_TECNICA_BIFASICO.md`;")
    w("- a figura `ESTUDO_SAIDA_METANOGENICOS.png`.\n")
    w("Posições, comprimentos e cotas marcados **(estudo)** são de arranjo preliminar e serão "
      "fechados na modelagem 3D da alternativa escolhida.\n")
    w("## 1. O que está embolado na rev. 5\n")
    w("Cada metanogênico tem duas linhas até a CS-301:\n")
    w("- a saída SAI DE160, do N-SAI no nível até um copo de selagem dentro da CS-301 (≈ 6 m "
      "de queda);")
    w("- o respiro RS DE90, do tubo de saída até o N1-225 do tampo.\n")
    w(f"O respiro existe porque o N-SAI trabalha **afogado** durante o pulso. A geratriz "
      f"superior interna do bocal fica a +{_f(topo, 3)}, e o nível chega a "
      f"+{_f(bg[1]['nivel'])} no caso central e a +{_f(pess['nivel'])} no pessimista. Com "
      "o bocal afogado, o gás do tubo de saída não volta ao reator pelo próprio bocal.\n")
    w("A CS-301 fica a ≈ 5 m dos reatores e pede:")
    w("- o FCA-301;")
    w("- extravasor e dreno;")
    w("- 4 chaves de nível;")
    w("- a P-301 em operação contínua, que transfere tudo ao TQ-301, aberto.\n")
    w("## 2. As duas alternativas\n")
    w("| | **A′ — selo compacto** | **B — TQ-301 fechado ao gás** |")
    w("|---|---|---|")
    w(f"| Princípio | selo hídrico de {SELO_MIN:.0f} mm (≈ 33 mbar) entre reator e caixa | "
      "reatores e TQ-301 formam um só espaço de gás; a saída não precisa de selo |")
    w(f"| Saída | N-SAI → descida quase vertical a um copo na CS-301: ≈ "
      f"{_f(ga['R-201']['Lh'], 1)} m na horizontal e {_f(ga['R-201']['dz'], 1)} m de queda "
      f"(estudo) | N-SAI → rampa a {gb['R-201']['theta']:.0f}° → N1 do TQ-301: "
      f"{_f(gb['R-201']['Lh'], 1)} m na horizontal, {_f(gb['R-201']['dz'], 1)} m de queda, "
      "2 curvas |")
    w(f"| Gás do tubo de saída | respiro curto por bocal novo DN80 de costado a +8,9 m, ≈ "
      f"{_f(ga['R-201']['rs1'], 1)} m (**A′1**), ou pelo N1-225 existente, longo como na "
      "rev. 5 (**A′2**) | o tubo descarrega no espaço de gás do TQ-301, que se equaliza "
      f"pela linha dedicada **LE-301** DE110 (≈ {L_LE:.0f} m, estudo) até o COL-501, com "
      "pote de condensado PC-301 |")
    w(f"| Caixa | CS-301 ao sul do vão entre os reatores (estudo). Folga ≈ "
      f"{_f(ga['folga_reator'], 1)} m até cada reator e ≈ {_f(ga['folga_tq'], 1)} m até o "
      "TQ-301 | não existe |")
    w("| Bomba | P-301 contínua (CS-301 → TQ-301), mais purgas, RL-05 e expedição | P-301 "
      "só para purgas, RL-05 e expedição; sem transferência contínua |")
    w(f"| TQ-301 | aberto: respiro A7 com chapéu chinês | fechado:<br>"
      f"• A7 com PVRV e corta-chamas;<br>"
      f"• M1 com tampa nova, estanque, com bocais para a LE-301 e o retorno da P-301;<br>"
      f"• extravasor com selo de emergência SO-301 de {SELO_EXT:.0f} mm;<br>"
      f"• N1-270 (sai da P-301) e N1-90 (hoje tamponado) passam a receber as rampas |")
    w("| pH/ORP na saída | nos copos (AIT-212/222), como na rev. 5 | bocal novo DN50 no "
      "costado de cada reator, abaixo da soleira, com haste retrátil (LAC-061). Em CSTR o pH "
      "do reator é o da saída. O A4 fica reservado (LAC-038/048) |")
    w("| Gás do digestato | arrastado e residual vão à atmosfera (FCA-301 e A7; LAC-049) | "
      "recuperado no GH-1 |")
    w("| Bocais novos nos R-201/202 | 2× N-SAI DN150 (+ 2× DN80 na A′1) | 2× N-SAI DN150 + "
      "2× DN50 |")
    w("| Fibrais no TQ-301 | nenhum | envelope, tampa M1 com bocais, PVRV no A7 e carga "
      "das chegadas (LAC-057) |\n")
    w("**Azimutes do N-SAI.** Mudam em relação à rev. 5:\n")
    w("| reator | rev. 5 | A′ | B |")
    w("|---|---|---|---|")
    for t in ("R-201", "R-202"):
        w(f"| {t} | {AZ_REV5[t]}° | {ga[t]['az_sai']:.0f}° | {gb[t]['az_sai']:.0f}° |")
    w("\nA alternativa adotada gera uma revisão do BOCAIS_FIBRAIS.\n")
    w("## 3. Hidráulica com polpa de Bingham (6 m³/h de pulso)\n")
    w("| caso | τy (Pa) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) | N-SAI "
      "afogado? | sen θ mín. exigido | sen θ B | raio hidráulico da lâmina parada na rampa B (mm) |")
    w("|---|---|---|---|---|---|---|---|---|")
    for r in bg:
        w(f"| {r['caso']} | {r['tau_y']:.0f} | {_f(r['h_sol'])} | {_f(r['nivel'])} | "
          f"{_f(r['folga_lsh'])} | {'sim' if r['afogado'] else 'não'} | "
          f"{_f(r['s_min'], 3)} | {_f(r['sen_b'])} | {_f(r['lamina_mm'], 0)} |")
    w("\n**Subida na soleira.** É igual nas duas alternativas e igual à rev. 5, porque o "
      "N-SAI e o trecho horizontal (faca + tê de lavagem) são os mesmos.\n")
    w("**A′.** O copo cobra 0,27 m de carga (pessimista) e deixa 5,7 m de folga na soleira, "
      "como na rev. 5. A margem é grande, mas a polpa fica parada no copo entre os pulsos.\n")
    w(f"**B.** A rampa tem sen θ = {_f(pess['sen_b'])}, {_f(razao, 1)}× o mínimo "
      "pessimista.")
    w("- Ela não esvazia de todo: uma polpa de Bingham para quando a tensão na parede cai "
      "abaixo de τy.")
    w(f"- Fica uma lâmina de raio hidráulico ≈ τy/(ρ·g·sen θ), de ≈ "
      f"{_f(pess['lamina_mm'], 0)} mm no caso pessimista (meia-lua de ≈ 1/4 do diâmetro).")
    w("- O trecho horizontal do N-SAI retém alguns litros.")
    w("- O tê de lavagem no início da rampa limpa as duas coisas nas paradas longas.\n")
    w(f"**Gás no B.** O enchimento do TQ-301 por um pulso (6 m³/h) e a expedição pela P-301 "
      f"(6 m³/h, máximo das PCP adotado na MEMORIA_HIDRAULICA) trocam gás com o coletor pela LE-301. Com {_f(eq['Q'], 0)} m³/h, a "
      f"velocidade é {_f(eq['v'], 2)} m/s e a perda {_f(eq['dp'], 3)} mbar, desprezível "
      "diante do permissivo de −0,5 mbar.\n")
    w(f"**Corte da alimentação (B).** Os dois reatores escoam ao TQ-301 até a soleira, ≈ "
      f"{_f(tqb['precisa'])} m³ no caso que mais escoa (otimista). Entre o LSHH atual (+3,85) "
      f"e o extravasor (+4,00) cabem {_f(tqb['vol_atual'])} m³.")
    w(f"- O LSHH desce para +{_f(tqb['lshh_prop'])} e o N-LSHH, bocal novo, é posicionado "
      "nessa cota.")
    w("- O volume útil (LSL–LSH) não muda.")
    w(f"- A faixa entre LSH e LSHH cai para {_f(tqb['faixa_lsh_lshh'], 2)} m³.\n")
    w("## 4. Sólidos, espuma e gás\n")
    w("| aspecto | A′ | B |")
    w("|---|---|---|")
    w("| Bolhas retidas na polpa | com τy ≥ 30 Pa, bolhas de até 2–7 cm de raio não sobem; "
      "o gás desce com a polpa, solta-se no ânulo do copo e vai ao FCA-301 ou ao TQ-301 "
      "aberto | solta-se no espaço de gás do TQ-301, que é recuperado |")
    w("| Espuma | o N-SAI no nível puxa a espuma primeiro. No copo, a espuma vale pouco "
      "como selo: com 50% de gás os 330 mm dão ≈ 17 mbar; com 80%, ≈ 7 mbar, abaixo do "
      "dispositivo de emergência | a espuma fica no envelope fechado. Riscos: chegar ao "
      "PVRV ou à LE-301 (sonda de espuma no TQ-301, LAC-059) e enfraquecer o selo SO-301 "
      "(dimensionado com 50% de espuma) |")
    w("| Sedimentação | ânulo do copo a ≈ 7 mm/s no pulso e parado entre pulsos: areia e "
      "crosta no fundo do copo (folga de 200 mm) e na CS-301 | fundo cônico do TQ-301, "
      "que já é ponto de dreno (N3); lâmina residual na rampa |")
    w("| Limpeza | copos dentro da CS-301 fechada: espaço confinado com H₂S, ou bicos de "
      "lavagem | tê de lavagem no início da rampa |")
    w("| Emissões de CH₄ | gás arrastado e dissolvido, mais a produção residual no TQ-301 "
      "aberto | recuperadas; o tamanho do ganho depende da LAC-058 |\n")
    w("## 5. Segurança e a regra de retiradas do cliente\n")
    w("### A′\n")
    w("- O selo isola o reator: retirar do TQ-301 não mexe no gás do reator.")
    w("- O selo pode se perder por evaporação, espuma ou nível baixo nos copos. O AIT nos "
      "copos e o LSLL da CS-301 vigiam.")
    w("- A CS-301 recebe biogás arrastado: é zona classificada e ventila à atmosfera pelo "
      "FCA-301.\n")
    w("### B\n")
    w("**1. Envelope.** O TQ-301 passa a operar como os reatores: +0,5 a 2,2 mbar normal e "
      "vácuo até o permissivo de −0,5 mbar.")
    w("- O dispositivo de emergência dos reatores aparece como +12 mbar no modelo e +8 mbar "
      "(selo hidráulico) na MEMORIA_GAS. Essa divergência vem de antes deste estudo e é "
      "harmonizada na LAC-057.")
    w(f"- O PVRV do TQ-301 fica acima da emergência (alvo +{P_PVRV:.0f} mbar).")
    w("- A capacidade do PVRV cobre:")
    w("  - a entrada de 2 pulsos;")
    w("  - a P-301;")
    w("  - o caso fogo (ISO 28300);")
    w("  - no vácuo, a vazão de expedição.\n")
    w(f"**2. Extravasor selado SO-301.** Fica normalmente seco, com selo de água de "
      f"{SELO_EXT:.0f} mm e chave de nível baixo.")
    w(f"- O PVRV pede pelo menos {_f(se['h_min'], 0)} mm.")
    w(f"- Com 50% de espuma, os {SELO_EXT:.0f} mm valem {_f(se['mbar_esp50'], 0)} mbar, "
      f"ainda acima dos {P_PVRV:.0f} mbar.")
    w("- É o único selo de polpa da B e é de emergência. As barreiras primárias são o LSHH "
      "(trip da P-201) e o LSH.\n")
    w("**3. Retiradas do TQ-301 (expedição, RL-05).** Seguem a regra do cliente para "
      "retiradas, a mesma das purgas:")
    w("- só pela P-301, com vazão limitada pela bomba;")
    w("- reposição de gás pela LE-301 a partir da bolsa GH-1 que está recebendo;")
    w("- permissivo de volume na bolsa ≥ volume retirado + 10 m³ e de pressão ≥ −0,5 mbar;")
    w("- nenhum caminhão a vácuo e nenhuma tampa aberta.\n")
    w("O RL-05 contínuo precisa entrar nesse permissivo: a MATRIZ hoje não admite outra "
      "retirada simultânea, e isso será harmonizado na adoção.\n")
    w("**4. Entrada de ar.** É o risco principal. Barreiras:")
    w("- tampa M1 estanque;")
    w("- amostragem por válvula dupla;")
    w("- O₂ no AT-501;")
    w("- inertização com N₂ e purga antes de abrir o TQ-301 para manutenção.\n")
    w("**5. Zona classificada.** O interior do TQ-301 é zona 0, e há zonas em torno do PVRV "
      "e do ponto de expedição (LAC-009).\n")
    w("**6. Materiais.** O H₂S ataca os metálicos internos do TQ-301 (escada, parafusos, "
      "suportes): material resistente (LAC-057).\n")
    w("**7. Condensado.** O gás termofílico condensa no TQ-301, mais frio. O condensado "
      "volta ao digestato, e a LE-301 desce até o PC-301.\n")
    w("**8. Manutenção do TQ-301.** Fechar V-201SAI e V-202SAI para a alimentação. A "
      "emergência é a purga pela P-301 ao caminhão, com a mesma reposição de gás.\n")
    w("## 6. Indicadores físicos do trecho (estimativa de estudo, antes de modelar)\n")
    w("| indicador | rev. 5 | A′1 / A′2 | B |")
    w("|---|---|---|---|")
    for r in (("vasos", "CS-301 + TQ-301", "CS-301 + TQ-301", "TQ-301 + pote PC-301"),
              ("copos de selagem (operação)", "2", "2", "0"),
              ("selos de emergência", "0", "0", "1 (SO-301, normalmente seco)"),
              ("linhas de gás do trecho", "2 RS ao tampo", "2 RS curtas / 2 RS ao tampo",
               "1 (LE-301)"),
              ("filtro de carvão", "FCA-301", "FCA-301", "0 (PVRV no A7)"),
              ("chaves de nível da CS-301", "4", "4", "0"),
              ("transferência contínua", "P-301", "P-301", "não"),
              ("bocais novos nos reatores existentes", "2 DN150", "2 DN150 + 2 DN80 / 2 DN150",
               "2 DN150 + 2 DN50"),
              ("intervenções no TQ-301", "N-EXT, N-LSHH", "N-EXT, N-LSHH",
               "N-EXT, N-LSHH, tampa M1 com bocais, PVRV no A7"),
              ("pontos onde a polpa fica parada", "2 copos + caixa", "2 copos + caixa",
               "fundo do TQ-301 + lâmina nas rampas"),
              ("gás do digestato", "emitido", "emitido", "recuperado")):
        w("| " + " | ".join(r) + " |")
    w("\n## 7. Recomendação técnica\n")
    w("**B continua a mais simples e a mais limpa hidraulicamente**, mesmo com a LE-301 e o "
      "SO-301:")
    w("- uma rampa curta por reator;")
    w("- nenhuma caixa nem copo em operação;")
    w("- espuma e bolhas retidas dentro do envelope de gás;")
    w("- saem uma caixa, dois copos, dois respiros, o filtro e a transferência contínua; "
      "entram uma linha de gás, um pote e um selo de emergência.\n")
    w("**Condição:** a Fibrais confirmar que o TQ-301 suporta o envelope (LAC-057).\n")
    w("Se não suportar, a **A′** resolve o \"embolado\" com menos risco de projeto:")
    w("- **A′1:** respiro curto, mas com bocal novo de costado (LAC-060);")
    w("- **A′2:** sem bocal novo, mas mantém a linha ao tampo.\n")
    w("Nas duas variantes ficam o ponto fraco do selo com espuma e as emissões do "
      "digestato.\n")
    w("## 8. Lacunas novas\n")
    for lac, txt in LACUNAS:
        w(f"- **{lac}:** {txt}")
    return "\n".join(L) + "\n"


LACUNAS = (
    ("LAC-057", "TQ-301 (315A-25) fechado ao gás, a confirmar com a Fibrais:\n"
                "  - pressão e vácuo admissíveis (alvo ≥ +15/−6 mbar, com o PVRV acima da "
                "emergência dos reatores);\n"
                "  - harmonizar a emergência dos reatores (+12 mbar no modelo × +8 mbar na "
                "MEMORIA_GAS);\n"
                "  - estanqueidade e tampa nova da M1 com bocais (LAC-029);\n"
                "  - PVRV com corta-chamas no A7, dimensionado pela ISO 28300;\n"
                "  - carga das duas chegadas DE160 nos N1-90 e N1-270;\n"
                "  - material dos metálicos internos (H₂S);\n"
                "  - envelope garantido (LAC-031)."),
    ("LAC-058", "Digestato dos R-201/202, por laboratório:\n"
                "  - retenção de gás (densidade da amostra fresca × desgaseificada; a faixa de "
                "1–5% v/v usada no estudo é hipótese);\n"
                "  - CH₄ dissolvido;\n"
                "  - potencial de metano residual na temperatura e no tempo de residência do "
                "TQ-301.\n"
                "  Fecha o balanço de emissões e completa a LAC-049."),
    ("LAC-059", "Potencial de espuma da polpa dos metanogênicos, por ensaio de aeração "
                "padronizado em laboratório. Dimensiona a sonda de espuma do TQ-301, o "
                "defletor e o selo SO-301."),
    ("LAC-060", "Só na A′1: dois bocais DN80 de costado a +8,9 m nos R-201/202, respiro do "
                "tubo de saída (Fibrais)."),
    ("LAC-061", "Só na B: dois bocais DN50 de costado abaixo da soleira nos R-201/202 para "
                "pH/ORP com haste retrátil (Fibrais)."),
)


def nota(bg):
    L = []
    w = L.append
    w("# Nota técnica — escoamento bifásico na saída dos metanogênicos\n")
    w("Polpa de 8% ST (plástico de Bingham) com biogás. Situação: **DOCUMENTO DE TRABALHO**, "
      "revisado pelo Crivo A–F. Reologia em hipótese (τy 5/30/100 Pa) até a reometria "
      "(LAC-041). Números do modelo rev. 5.\n")
    w("## 1. A polpa guarda o gás\n")
    w("**Critério de aprisionamento.** Uma bolha esférica fica presa num fluido com tensão de "
      "escoamento quando Bn = τy/(ρ·g·R) passa de ≈ 0,143 (Tsamopoulos et al., 2008; "
      "Deoclecio et al., 2021). O raio limite é R = τy/(0,143·ρ·g):\n")
    w("| caso | τy (Pa) | bolhas retidas até R (cm) |")
    w("|---|---|---|")
    for r in bg:
        w(f"| {r['caso']} | {r['tau_y']:.0f} | {_f(r['r_crit_cm'], 1)} |")
    w("\n**Consequência.** Do caso central em diante, quase todas as bolhas formadas na massa "
      "(milimétricas) ficam presas na polpa em repouso. Elas só saem com cisalhamento: no "
      "misturador, na queda e no escoamento, quando a polpa deixa de se comportar como "
      "sólido. A polpa que transborda pelo N-SAI leva gás retido.\n")
    w("**CH₄ dissolvido.** Em digestores de ETE, Tauber et al. (2019) mediram o metano "
      "dissolvido no digestato acima da concentração de equilíbrio com o biogás. Para "
      "polpa agroindustrial esse valor é LAC-058.\n")
    w("**Quantidade.** Em volume, o arraste é pequeno diante da produção da planta (pico ≈ "
      "27 Nm³/h). Na hipótese de 1–5% v/v de gás retido, cada m³ de digestato leva "
      "10–50 L de biogás. O valor real é LAC-058.\n")
    w("## 2. Armazenamento do digestato\n")
    w("**Medições de campo.** A estocagem aberta de digestato emite parcela relevante do CH₄ "
      "da planta:")
    w("- Baldé et al. (2016) e Vergote et al. (2020) mediram em tanques agrícolas de longa "
      "retenção;")
    w("- Knoll et al. (2026) acompanharam ao longo das estações uma estocagem aberta.")
    w("- A faixa citada nesses trabalhos vai de alguns porcento a ≈ 12% da produção, com o "
      "extremo alto no verão e em longa retenção.\n")
    w("**Estocagem estanque.** Num levantamento de plantas, as que tinham estocagem estanque "
      "emitiram 2,7% da produção, contra 6,2% das que não tinham (Wechselberger et al., "
      "2024).\n")
    w("**Para o projeto.** O TQ-301 é um pulmão curto, com ≈ 17 m³ úteis. A parcela que "
      "fechar o TQ-301 (alternativa B) recupera depende do potencial residual na temperatura "
      "e no tempo de residência dele (LAC-058). A melhoria do selo (A′) não mexe nessa "
      "parcela.\n")
    w("## 3. Espuma\n")
    w("**Causas.** A espuma em digestores aparece após choques de carga, com acúmulo de "
      "ácidos graxos, AGV, amônia e proteínas tensoativas (Ganidi et al., 2009; He et al., "
      "2017; Yang et al., 2021; Krohn et al., 2025). Ela leva a um perfil de sólidos "
      "invertido, com mais sólidos no topo (Pagilla et al., 1997).\n")
    w("**No projeto.** O N-SAI no nível é o primeiro ponto a receber essa camada.\n")
    w("**A′.** A espuma no copo derruba o fecho. Com fração de gás ε, o fecho vale "
      "330·(1−ε) mm:\n")
    w("| fração de gás no copo | 0% | 20% | 50% | 80% |")
    w("|---|---|---|---|---|")
    s = bg[0]["selo_espuma"]
    w("| fecho (mbar) | " + " | ".join(_f(s[e], 0) for e in (0.0, 0.2, 0.5, 0.8)) + " |")
    w("\n**B.** A espuma fica dentro do envelope de gás. É preciso uma sonda de espuma no "
      "TQ-301 para proteger o PVRV e a LE-301. O único selo, SO-301 (emergência), é "
      "dimensionado com 50% de espuma.\n")
    w("**Ensaio.** O potencial de espuma é monitorável por ensaio de aeração padronizado "
      "(Jiang et al., 2018), base da LAC-059.\n")
    w("## 4. Sedimentação e pulsos\n")
    w("A alimentação é por pulsos de 6 m³/h. Entre eles a saída para, e no caso pessimista "
      "a polpa se comporta como sólido abaixo de τy.\n")
    w("**Onde a polpa fica parada:**")
    w("- **A′:** copo, ânulo e fundo da CS-301, onde se acumulam areia e crosta.")
    pess = bg[2]
    w(f"- **B:** fundo do TQ-301 e uma lâmina na rampa, de raio hidráulico τy/(ρ·g·sen θ) ≈ "
      f"{_f(pess['lamina_mm'], 0)} mm no caso pessimista; o tê de lavagem a remove.\n")
    w("**Por que rampa e não tubo cheio.** A polpa para num tubo parcialmente cheio quando "
      "sen θ < τy/(ρ·g·0,304·D). Para o DE160, isso dá 0,012 / 0,069 / 0,231 nos três "
      "casos. Um tubo cheio exige a carga de partida 4τyL/(ρgD), ≈ 0,28 m por metro no "
      "caso pessimista. Por isso as soluções com U ou coluna cheia foram descartadas.\n")
    w("## 5. Regras de projeto que saem desta nota\n")
    w("1. **Saída.** Por transbordo no nível (N-SAI), com lâmina livre e sen θ ≥ 2× o "
      "mínimo pessimista. Nada de trecho cheio, sifão ou U.")
    w("2. **Bocal afogado.** O N-SAI trabalha afogado no pulso. O espaço de gás a jusante "
      "precisa de caminho próprio de equalização: o respiro RS na A′ ou a LE-301 na B.")
    w("3. **Gás arrastado.** Soltá-lo num espaço de gás recuperado, não num espaço ventilado "
      "à atmosfera.")
    w("4. **Selo em polpa que espuma.** Não serve como barreira de operação. Se for usado, "
      "precisa de vigilância de nível e de densidade. Como barreira de emergência, deve ser "
      "dimensionado com espuma.")
    w("5. **Lavagem.** Prever um tê de lavagem no início de cada rampa, com água de serviço, "
      "para a partida e as paradas longas.\n")
    w("## Referências (Consensus)\n")
    for ref in REFS:
        w(f"- {ref}")
    return "\n".join(L) + "\n"


_U = "https://consensus.app/papers/details/{}/"
REFS = tuple(f"[{t}]({_U.format(h)}) {a}" for t, h, a in (
    ("Steady bubble rise and deformation in Newtonian and viscoplastic fluids and conditions "
     "for bubble entrapment", "9575558e90fd5ceb80df73560964e533",
     "Tsamopoulos, J. et al. (2008). J. Fluid Mech."),
    ("Bubble entrapment condition in Bingham materials", "07bb1b72620a566cb526e01576495c05",
     "Deoclecio, L. H. et al. (2021). J. Non-Newton. Fluid Mech."),
    ("Quantifying methane emissions from anaerobic digesters", "c5a4d1d586255f0287f82ae80debf1d3",
     "Tauber, J. et al. (2019). Water Sci. Technol."),
    ("Methane emissions from digestate at an agricultural biogas plant",
     "e7a6e428b5a6509a83193b128af3baa8", "Baldé, H. et al. (2016). Bioresour. Technol."),
    ("Monitoring methane and nitrous oxide emissions from digestate storage following manure "
     "mono-digestion", "078ca65745b75c1e8c2c2f699d9afe61",
     "Vergote, T. et al. (2020). Biosyst. Eng."),
    ("Novel monitoring approach for seasonally resolved continuous methane emission "
     "measurements from open digestate storage", "0dce95970afe5be0afe41eed1dc234c1",
     "Knoll, L. et al. (2026). Biomass Futures."),
    ("Assessment of whole-site methane emissions from anaerobic digestion plants",
     "b56aa31a79af5c5d921d862be7b7941e", "Wechselberger, V. et al. (2024). Waste Manage."),
    ("Anaerobic digestion foaming causes — a review", "8579605ab48e51cb906cbdc6f632eccc",
     "Ganidi, N. et al. (2009). Bioresour. Technol."),
    ("Investigation of foaming causes in three mesophilic food waste digesters",
     "10f706911d0e5a15912b6a90b88f12d3", "He, Q.-M. et al. (2017). Sci. Rep."),
    ("Foaming mechanisms and control strategies during the anaerobic digestion of organic "
     "waste", "c76d73a7c5e25b1096ce5a731abe9f19", "Yang, P. et al. (2021). Sci. Total Environ."),
    ("Microbial population shifts during disturbance induced foaming",
     "4bed29195d795913b094dbb4f22418ea", "Krohn, C. et al. (2025). Water Res."),
    ("Causes and effects of foaming in anaerobic sludge digesters",
     "5b3305f374005a39b4a899939ac812da", "Pagilla, K. et al. (1997). Water Sci. Technol."),
    ("Monitoring foaming potential in anaerobic digesters", "014cc6f0d14e51859202452c84ec82d4",
     "Jiang, C. et al. (2018). Waste Manage."),
))


def main():
    ga, gb = geometria_a(), geometria_b()
    (bg, topo), tqb = bingham(gb), niveis_tq_b()
    eq, se = equalizacao(), selo_extravasor()
    figura(ga, gb, tqb, SAIDA / "ESTUDO_SAIDA_METANOGENICOS.png")
    (SAIDA / "ESTUDO_SAIDA_METANOGENICOS.md").write_text(estudo(ga, gb, bg, topo, tqb, eq, se),
                                                          encoding="utf-8")
    (SAIDA / "NOTA_TECNICA_BIFASICO.md").write_text(nota(bg), encoding="utf-8")
    for r in bg:
        print(r["caso"], round(r["h_sol"], 3), round(r["nivel"], 3), r["afogado"],
              round(r["lamina_mm"], 1))
    print("topo", topo, tqb, eq, se, ga["folga_reator"], ga["folga_tq"])


if __name__ == "__main__":
    main()
