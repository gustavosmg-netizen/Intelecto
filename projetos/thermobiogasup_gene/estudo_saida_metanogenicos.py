"""Estudo da saída dos metanogênicos (R-201/R-202 → digestato) — rev. 6 em estudo.

Compara duas alternativas para o trecho que o cliente achou "embolado" na rev. 5 (descidas a
uma caixa comum vedada, CS-301, e respiro do tampo ligado ao tubo de saída):

  A′  selo hídrico mantido, compacto: CS-301 entre os reatores, respiro por bocal de costado
      logo acima do N-SAI, descidas curtas; P-301 transfere ao TQ-301 (aberto, como hoje).
  B   TQ-301 fechado e integrado ao envelope de gás: descida livre e curta de cada reator ao
      N1 do TQ-301, sem selo, sem caixa, sem respiro; o próprio tubo de saída equaliza o gás.

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
A_REATOR = math.pi * 3.8 ** 2 / 4
R_TQ, A_TQ = 3000 / 2, math.pi * 3.0 ** 2 / 4
Z_TAMPO_TQ = 2140 + 2400           # TQ-301: fundo do cilindro +2,14; costado 2,40
Z_N1_TQ = 4660                     # face dos N1 do tampo do TQ-301 (315A-25)
R_N1_TQ = 1250
PROJ = 200                         # projeção do N-SAI
D_SAI = 0.1412                     # DE160 SDR17 (di)
Z_SAI = NIVEL["R-201"]["crista"] + 76
Q_PULSO = hg.Q_PROJ                # 6 m³/h (P-201)
RESIDUO_REATOR = 0.71              # m³ por reator após corte (MEMORIA_HIDRAULICA §3)
BN_CRIT = 0.143                    # Bingham crítico de aprisionamento de bolha esférica
# (Tsamopoulos et al., 2008)


def _az(o, d):
    return math.degrees(math.atan2(d[0] - o[0], d[1] - o[1])) % 360


def _ponto(o, az, r):
    a = math.radians(az)
    return o[0] + r * math.sin(a), o[1] + r * math.cos(a)


def geometria_b():
    """Linha de saída da alternativa B: N-SAI → 0,4 m horizontal (faca + tê de lavagem) →
    rampa → curva → vertical curta (0,35 m) no N1 do tampo do TQ-301."""
    out = {}
    tq = C["TQ-301"]
    for tag, az_n1 in (("R-201", 270), ("R-202", 90)):
        n1 = _ponto(tq, az_n1, R_N1_TQ)
        az = _az(C[tag], n1)
        p0 = _ponto(C[tag], az, R_REATOR + PROJ)
        Lh_total = math.hypot(n1[0] - p0[0], n1[1] - p0[1])
        L_horiz = 400.0
        z_vert = Z_N1_TQ + 350 + 300                # topo da vertical (curva de 0,3 m de raio)
        dz = Z_SAI - z_vert
        dx = Lh_total - L_horiz - 300               # 0,3 m consumidos pela curva final
        sen = dz / math.hypot(dz, dx)
        L = L_horiz + math.hypot(dz, dx) + 650
        out[tag] = {"n1": f"N1-{az_n1}", "az_sai": az, "Lh": Lh_total / 1000, "dz": dz / 1000,
                    "sen": sen, "theta": math.degrees(math.asin(sen)), "L": L / 1000,
                    "p0": p0, "n1_xy": n1, "curvas": 2}
    return out


def geometria_a():
    """Alternativa A′: CS-301 ao sul do vão entre R-201 e R-202, copos sob o tampo; respiro
    por bocal DN80 de costado a +8,9 m (acima do LSHH 8,35 e abaixo do topo do costado 9,3)."""
    cs = (14750, -2900)
    copos = {"R-201": (cs[0] - 450, cs[1] + 350), "R-202": (cs[0] + 450, cs[1] + 350)}
    out = {"cs": cs, "copos": copos}
    for tag in ("R-201", "R-202"):
        az = _az(C[tag], copos[tag])
        p0 = _ponto(C[tag], az, R_REATOR + PROJ)
        Lh = math.hypot(copos[tag][0] - p0[0], copos[tag][1] - p0[1])
        z_cs = 150 + 1650 + 300                     # tampo da CS-301 + bocal
        dz = Z_SAI - z_cs
        out[tag] = {"az_sai": az, "Lh": Lh / 1000, "dz": dz / 1000, "p0": p0,
                    "L": (Lh + dz) / 1000, "rs": (8900 - Z_SAI) / 1000 + 0.3}
    out["cs_tq"] = math.hypot(C["TQ-301"][0] - cs[0], C["TQ-301"][1] - cs[1]) / 1000
    folga = math.hypot(C["R-201"][0] - cs[0], C["R-201"][1] - cs[1]) / 1000 - 1.912 - 1.01
    out["folga_reator"] = folga
    return out


def bingham(gb):
    lin = []
    for f in rg.CASOS_8ST:
        h_sol, yc = hg._soleira_livre(Q_PULSO, D_SAI, 0.40 + 0.13, f, ("gaveta",))
        s_min = rg.declividade_minima_livre(D_SAI, f)
        r_crit = f.tau_y / (BN_CRIT * f.rho * G)
        lin.append({"caso": f.nome, "tau_y": f.tau_y, "h_sol": h_sol, "nivel": 7.5 + h_sol,
                    "folga_lsh": NIVEL["R-201"]["LSH"] / 1000 - 7.5 - h_sol,
                    "s_min": s_min, "sen_b": min(v["sen"] for v in gb.values()),
                    "r_crit_cm": r_crit * 100,
                    "selo_espuma": {e: SELO_MIN / 1000 * (1 - e) * RHO * G / 100
                                    for e in (0.0, 0.2, 0.5, 0.8)}})
    return lin


def niveis_tq_b():
    """No B os dois reatores escoam ao TQ-301 depois de um corte: o LSHH tem de deixar volume
    para os dois resíduos antes do extravasor selado."""
    nv = NIVEL["TQ-301"]
    vol_atual = (nv["extravasor"] - nv["LSHH"]) / 1000 * A_TQ
    precisa = 2 * RESIDUO_REATOR
    lshh_max = nv["extravasor"] / 1000 - precisa / A_TQ
    return {"vol_atual": vol_atual, "precisa": precisa, "lshh_max": lshh_max,
            "lshh_prop": math.floor((lshh_max - 0.05) * 20) / 20,
            "util_atual": (nv["LSH"] - nv["LSL"]) / 1000 * A_TQ}


def contracorrente(gb):
    """Gás deslocado pelo enchimento do TQ-301 sobe pelos tubos de saída (contracorrente à
    lâmina): velocidade do gás na seção livre de um tubo, com a vazão de pulso inteira."""
    A = math.pi * D_SAI ** 2 / 4 * 0.85           # ≥ 85% da seção livre (lâmina rasa)
    v = Q_PULSO / 3600 / A
    dp = 0.5 * 1.0 * v ** 2 * (0.02 * 6 / D_SAI + 2.5) / 100      # mbar, ar ~ biogás
    return {"v_gas": v, "dp_mbar": dp}


# --- figura ---------------------------------------------------------------------------------
def figura(ga, gb, arquivo):
    fig, ax = plt.subplots(1, 3, figsize=(17, 6.2), gridspec_kw={"width_ratios": [1, 1, 1.15]})
    for a, titulo in ((ax[0], "A′ — selo compacto (planta)"), (ax[1], "B — TQ-301 fechado (planta)")):
        for tag in ("R-201", "R-202"):
            a.add_patch(Circle(C[tag], 1912, fill=False, lw=1.6))
            a.text(*C[tag], tag, ha="center", va="center", fontsize=10, weight="bold")
        a.add_patch(Circle(C["TQ-301"], R_TQ, fill=False, lw=1.6))
        a.text(C["TQ-301"][0], C["TQ-301"][1] - 300, "TQ-301", ha="center", fontsize=10,
               weight="bold")
        a.set_xlim(9000, 20500), a.set_ylim(-8200, 2400), a.set_aspect("equal")
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
    tq = C["TQ-301"]
    a.plot([cs[0], cs[0] - 900, cs[0] - 900, tq[0] - 1250], [cs[1] - 1010, cs[1] - 1010 - 300,
           tq[1], tq[1]], color="#8a5a00", lw=2, ls="--")
    a.add_patch(Rectangle((cs[0] - 1200, cs[1] - 1700), 600, 400, color="#8a5a00", alpha=.6))
    a.text(cs[0] - 1250, cs[1] - 1950, "P-301", fontsize=8, ha="right")
    a.text(9200, 1900, "■ respiro DN80 no costado (+8,9)\n— descida ao copo  - - P-301 → TQ-301",
           fontsize=8, va="top")
    # B
    a = ax[1]
    for tag in ("R-201", "R-202"):
        g = gb[tag]
        a.plot([g["p0"][0], g["n1_xy"][0]], [g["p0"][1], g["n1_xy"][1]], color="#eb6834", lw=3)
        a.plot(*g["n1_xy"], "o", color="#1baf7a", ms=7)
        a.annotate(f"{g['n1']}\nθ = {g['theta']:.0f}°", g["n1_xy"], xytext=(-32 if g["n1"] == "N1-270" else 32, 4),
                   textcoords="offset points", ha="center", fontsize=8,
                   bbox=dict(fc="white", ec="none", alpha=.8))
    a.plot(tq[0], tq[1] - 900, "^", color="#2a78d6", ms=9)
    a.text(tq[0], tq[1] - 2000,  "A7 → PVRV + corta-chamas", fontsize=8, ha="center")
    a.text(9200, 1900, "— descida livre (gás em contracorrente)\n● chegada pelo N1 existente",
           fontsize=8, va="top")
    # perfil B
    a = ax[2]
    g = gb["R-201"]
    xs = [0, 0.4, 0.4 + (g["Lh"] - 0.7), g["Lh"]]
    zs = [Z_SAI / 1000, Z_SAI / 1000, (Z_N1_TQ + 650) / 1000, (Z_N1_TQ + 650) / 1000]
    a.plot(xs, zs, color="#eb6834", lw=3, label="B: N-SAI → N1 do TQ-301")
    a.plot([g["Lh"], g["Lh"]], [(Z_N1_TQ + 650) / 1000, Z_N1_TQ / 1000], color="#eb6834", lw=3)
    a.axhline(7.5, color="#2a78d6", ls=":", lw=1)
    a.text(0.05, 7.55, "soleira/crista R-201 +7,50", fontsize=8, color="#2a78d6")
    a.axhline(8.03, color="#eb6834", ls=":", lw=1)
    a.text(0.05, 8.08, "nível máx. pessimista +8,03 (τy 100 Pa, 6 m³/h)", fontsize=8,
           color="#eb6834")
    nv = NIVEL["TQ-301"]
    for k, cor in (("LSH", "#1baf7a"), ("extravasor", "#555")):
        a.axhline(nv[k] / 1000, color=cor, ls="--", lw=1, xmin=.62)
        a.text(g["Lh"] + 0.1, nv[k] / 1000 + 0.05, f"TQ-301 {k} +{nv[k] / 1000:.2f}",
               fontsize=8, color=cor)
    a.add_patch(Rectangle((g["Lh"] - 0.25, 2.14), 3.0, 2.4, fill=False, lw=1.4))
    a.text(g["Lh"] + 1.25, 2.4, "TQ-301", ha="center", fontsize=9, weight="bold")
    a.set_xlim(-0.3, g["Lh"] + 3.0), a.set_ylim(0, 9)
    a.set_xlabel("distância horizontal desde o N-SAI (m)"), a.set_ylabel("cota (m)")
    a.set_title(f"B — perfil R-201 → TQ-301 (sen θ = {g['sen']:.2f} ≥ 0,23 exigido)",
                fontsize=11)
    a.grid(alpha=.25), a.legend(loc="lower left", fontsize=8)
    fig.tight_layout()
    fig.savefig(arquivo, dpi=130)
    plt.close(fig)


def _f(x, n=2):
    return f"{x:.{n}f}".replace(".", ",")


# --- documentos -----------------------------------------------------------------------------
def estudo(ga, gb, bg, tqb, cc):
    L = []
    w = L.append
    w("# Estudo da saída dos metanogênicos — A′ (selo compacto) × B (TQ-301 fechado ao gás)\n")
    w("Situação: **DOCUMENTO DE TRABALHO**, sujeito ao Crivo A–F. Indicadores físicos, sem "
      "valores monetários. Base: modelo rev. 5 (`planta_gene.py`, `MEMORIA_HIDRAULICA.md`) e "
      "a nota técnica `NOTA_TECNICA_BIFASICO.md`. Figura: `ESTUDO_SAIDA_METANOGENICOS.png`.\n")
    w("## 1. O que está embolado na rev. 5\n")
    w("Cada metanogênico tem duas linhas até a CS-301:\n")
    w("- a saída SAI DE160, do N-SAI no nível até um copo de selagem dentro da CS-301 (≈ 6 m "
      "de queda);")
    w("- o respiro RS DE90, do tubo de saída até um N1 do tampo, que equaliza o gás do tubo "
      "quando a polpa afoga o N-SAI.\n")
    w("A CS-301 fica a ≈ 5 m dos reatores. Ela pede FCA-301, extravasor, dreno, 4 chaves de "
      "nível e a P-301 em operação contínua, que transfere tudo ao TQ-301, aberto. O selo "
      "separa dois espaços de gás e, por isso, exige uma caixa, dois copos e dois respiros.\n")
    w("## 2. As duas alternativas\n")
    w("| | **A′ — selo compacto** | **B — TQ-301 fechado ao gás** |")
    w("|---|---|---|")
    w(f"| Princípio | selo hídrico de {SELO_MIN:.0f} mm (≈ 33 mbar) entre reator e caixa | "
      "reatores e TQ-301 formam um só espaço de gás; não há o que selar |")
    w(f"| Saída | N-SAI → descida quase vertical a um copo na CS-301; ≈ "
      f"{_f(ga['R-201']['Lh'], 1)} m na horizontal e {_f(ga['R-201']['dz'], 1)} m de queda | "
      f"N-SAI → rampa a {gb['R-201']['theta']:.0f}° → N1 existente do TQ-301; "
      f"{_f(gb['R-201']['Lh'], 1)} m na horizontal, {_f(gb['R-201']['dz'], 1)} m de queda, "
      "2 curvas |")
    w(f"| Respiro do tubo de saída | bocal novo DN80 no costado a +8,9 m, logo acima do "
      f"N-SAI; ≈ {_f(ga['R-201']['rs'], 1)} m de tubo | dispensado: o tubo de saída, "
      "parcialmente cheio, é o próprio caminho do gás |")
    w(f"| Caixa | CS-301 ao sul do vão entre os reatores, a ≈ {_f(ga['cs_tq'], 1)} m do "
      f"TQ-301; folga até cada reator ≈ {_f(ga['folga_reator'], 1)} m | não existe |")
    w("| Bomba | P-301 contínua (CS-301 → TQ-301), mais purgas, RL-05 e expedição | P-301 "
      "só para purgas, RL-05 e expedição; sem transferência contínua |")
    w("| TQ-301 | aberto: respiro A7 com chapéu chinês | fechado: A7 vira válvula de "
      "pressão e vácuo (PVRV) com corta-chamas; M1 com tampa estanque; extravasor com selo "
      "de emergência; N1-270 e N1-90, hoje tamponados, viram chegadas |")
    w("| pH/ORP na saída | nos copos (AIT-212/222) | no reator, por porta da A4 multitomada "
      "com haste retrátil; em CSTR o pH do reator é o da saída |")
    w("| Gás do digestato | arrastado e residual vão à atmosfera (FCA-301 e A7) | "
      "recuperado no GH-1 |")
    w("| Bocais novos Fibrais (R-201/202) | 2× N-SAI DN150 e 2× RS DN80 de costado | 2× "
      "N-SAI DN150 |")
    w("| Fibrais no TQ-301 | nenhum | envelope de pressão e vácuo, tampa M1, PVRV no A7 e "
      "carga das chegadas no tampo (LAC-057) |\n")
    w("## 3. Hidráulica com polpa de Bingham (6 m³/h de pulso)\n")
    w("| caso | τy (Pa) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) | "
      "sen θ mín. exigido | sen θ B | raio de bolha retida (cm) |")
    w("|---|---|---|---|---|---|---|---|")
    for r in bg:
        w(f"| {r['caso']} | {r['tau_y']:.0f} | {_f(r['h_sol'])} | {_f(r['nivel'])} | "
          f"{_f(r['folga_lsh'])} | {_f(r['s_min'], 3)} | {_f(r['sen_b'])} | "
          f"{_f(r['r_crit_cm'], 1)} |")
    w("\n- **Subida na soleira:** igual nas duas alternativas, porque o N-SAI é o mesmo. O "
      "que muda é o que vem depois.")
    w("- **A′:** o copo cobra 0,27 m de carga (pessimista) e deixa 5,7 m de folga na soleira, "
      "como na rev. 5. A margem é grande, mas a polpa fica parada no copo entre os pulsos.")
    w(f"- **B:** descarga livre no espaço de gás do TQ-301. A rampa tem sen θ = "
      f"{_f(bg[0]['sen_b'])}, {_f(bg[0]['sen_b'] / bg[2]['s_min'], 1)}× o mínimo pessimista (0,231), então o tubo esvazia depois "
      "de cada pulso e não guarda polpa parada.")
    w(f"- **Gás em contracorrente (B):** o enchimento do TQ-301 desloca gás para cima pelo "
      f"tubo de saída. Com a vazão de pulso inteira num só tubo, a velocidade fica em "
      f"{_f(cc['v_gas'], 2)} m/s e a perda em {_f(cc['dp_mbar'], 3)} mbar. Não há "
      "inundação nem arraste de lâmina.")
    w(f"- **Corte da alimentação (B):** os dois reatores escoam ao TQ-301 até a soleira, "
      f"cerca de {_f(tqb['precisa'])} m³ no caso que escoa mais (otimista). Entre o LSHH "
      f"(+3,85) e o extravasor (+4,00) cabem só {_f(tqb['vol_atual'])} m³. Por isso o LSHH "
      f"desce para +{_f(tqb['lshh_prop'])}, com o LSH logo abaixo, e o volume útil cai "
      f"≈ {_f((3.85 - tqb['lshh_prop']) * A_TQ, 1)} m³.\n")
    w("## 4. Sólidos, espuma e gás\n")
    w("| aspecto | A′ | B |")
    w("|---|---|---|")
    w("| Bolhas retidas na polpa | com τy ≥ 30 Pa, bolhas de até 2–7 cm de raio não sobem; "
      "o gás desce com a polpa, solta-se no ânulo do copo e vai ao FCA-301 ou ao TQ-301 "
      "aberto | solta-se no espaço de gás do TQ-301, que é recuperado |")
    w("| Espuma | o N-SAI no nível puxa a espuma primeiro. Espuma no copo vale pouco como "
      "selo: com 50% de gás, os 330 mm dão ≈ 17 mbar; com 80%, ≈ 7 mbar, abaixo dos "
      "+12 mbar do dispositivo de emergência | a espuma fica no envelope fechado; risco "
      "de chegar ao PVRV do A7 (LSHH e sonda de espuma) |")
    w("| Sedimentação | ânulo do copo a ≈ 7 mm/s no pulso, parado entre pulsos: areia e "
      "crosta no fundo do copo (folga de 200 mm) e na CS-301 | só o fundo cônico do "
      "TQ-301, que já é ponto de dreno (N3) |")
    w("| Limpeza | copos dentro da CS-301 fechada: espaço confinado com H₂S, ou bicos de "
      "lavagem | tê de lavagem no início da rampa; rampa autolimpante |")
    w("| Emissões de CH₄ | gás arrastado e dissolvido, mais a produção residual no TQ-301 "
      "aberto | recuperadas |\n")
    w("## 5. Segurança e a regra de retiradas do cliente\n")
    w("**A′:**")
    w("- O selo isola o reator: retirar do TQ-301 não mexe no gás do reator.")
    w("- Perda de selo ocorre por evaporação, espuma ou nível baixo nos copos; o AIT nos "
      "copos e o LSLL da CS-301 vigiam.")
    w("- A CS-301 é um espaço com biogás arrastado (zona classificada) ventilado para a "
      "atmosfera.\n")
    w("**B:**")
    w("- O TQ-301 entra no envelope (+0,5 a 2,2 mbar normal; emergência +12/−5 mbar). Ver "
      "LAC-057.")
    w("- A expedição e o RL-05 tiram polpa de um espaço de gás. Valem as mesmas regras das "
      "purgas:")
    w("  - só pela P-301, com vazão limitada pela bomba;")
    w("  - permissivo de volume na bolsa GH-1 que está recebendo (≥ volume retirado + "
      "10 m³) e de pressão ≥ −0,5 mbar;")
    w("  - nenhum caminhão a vácuo nem tampa aberta.")
    w("- Para manter o TQ-301 é preciso fechar V-201SAI e V-202SAI, o que para a "
      "alimentação. A emergência é a purga pela P-301 ao caminhão, com a mesma reposição "
      "de gás.")
    w("- A entrada de ar é o risco principal. Barreiras:")
    w("  - tampa M1 estanque;")
    w("  - amostragem por válvula dupla;")
    w("  - O₂ no AT-501.\n")
    w("## 6. Indicadores físicos do trecho (estimativa de estudo, antes de modelar)\n")
    w("| indicador | rev. 5 | A′ | B |")
    w("|---|---|---|---|")
    for r in (("vasos", "CS-301 + TQ-301", "CS-301 + TQ-301", "TQ-301"),
              ("copos de selagem", "2", "2", "0"),
              ("linhas de respiro RS", "2 (ao tampo)", "2 (curtas, costado)", "0"),
              ("filtro de carvão", "FCA-301", "FCA-301", "0 (PVRV no A7)"),
              ("chaves de nível dedicadas", "4 (CS-301)", "4 (CS-301)", "0 (só o TQ-301)"),
              ("transferência contínua", "P-301", "P-301", "não"),
              ("bocais novos nos reatores existentes", "2 DN150", "2 DN150 + 2 DN80", "2 DN150"),
              ("bocais novos no TQ-301", "2 (N-EXT, N-LSHH)", "2", "2 (+ PVRV no A7)"),
              ("pontos onde a polpa fica parada", "2 copos + caixa", "2 copos + caixa",
               "fundo do TQ-301"),
              ("gás do digestato", "emitido", "emitido", "recuperado")):
        w("| " + " | ".join(r) + " |")
    w("\n## 7. Recomendação técnica\n")
    w("**B é a mais simples e a mais limpa hidraulicamente**:")
    w("- uma rampa curta por reator, que se esvazia sozinha;")
    w("- nenhuma polpa parada fora do TQ-301;")
    w("- espuma e bolhas retidas ficam dentro do envelope de gás, sem emissão;")
    w("- saem do projeto uma caixa, dois copos, dois respiros, um filtro e a transferência "
      "contínua.\n")
    w("Ela depende de uma condição: **a Fibrais confirmar que o TQ-301 suporta o envelope de "
      "gás (LAC-057)**. Se não suportar, a A′ resolve o \"embolado\" com menos risco de "
      "projeto. Mas a A′ mantém o ponto fraco do selo com espuma e as emissões do digestato.\n")
    w("## 8. Lacunas novas\n")
    for lac, txt in LACUNAS:
        w(f"- **{lac}:** {txt}")
    return "\n".join(L) + "\n"


LACUNAS = (
    ("LAC-057", "TQ-301 (315A-25) fechado ao gás: pressão e vácuo admissíveis (alvo ≥ +15/"
                "−6 mbar com o PVRV acima da emergência dos reatores), estanqueidade da tampa "
                "M1, troca do chapéu chinês do A7 por PVRV com corta-chamas, carga das duas "
                "chegadas DE160 nos N1-90/N1-270 e defletor interno anti-espuma — Fibrais."),
    ("LAC-058", "Digestato dos R-201/202: retenção de gás (densidade da amostra fresca × "
                "desgaseificada), CH₄ dissolvido e potencial de metano residual na temperatura "
                "de armazenamento — laboratório (fecha o balanço de emissões da A′)."),
    ("LAC-059", "Potencial de espuma da polpa dos metanogênicos (ensaio de aeração "
                "padronizado), para dimensionar sonda de espuma e defletor — laboratório."),
    ("LAC-060", "Só na A′: dois bocais DN80 de costado a +8,9 m nos R-201/202 (respiro do "
                "tubo de saída) — Fibrais."),
)


def nota(bg):
    L = []
    w = L.append
    w("# Nota técnica — escoamento bifásico na saída dos metanogênicos\n")
    w("Polpa de 8% ST (plástico de Bingham) com biogás. Situação: **DOCUMENTO DE TRABALHO**. "
      "Reologia em hipótese (τy 5/30/100 Pa; LAC da reometria aberta) e números do modelo "
      "rev. 5.\n")
    w("## 1. A polpa guarda o gás\n")
    w("- **Critério de aprisionamento.** Uma bolha esférica fica presa num fluido com tensão "
      "de escoamento quando o número de Bingham Bn = τy/(ρ·g·R) passa de ≈ 0,143 "
      "(Tsamopoulos et al., 2008; Deoclecio et al., 2021). O raio limite é R = τy/(0,143·ρ·g):\n")
    w("| caso | τy (Pa) | bolhas retidas até R (cm) |")
    w("|---|---|---|")
    for r in bg:
        w(f"| {r['caso']} | {r['tau_y']:.0f} | {_f(r['r_crit_cm'], 1)} |")
    w("\n- **Consequência.** Do caso central em diante, praticamente todas as bolhas formadas "
      "na massa (milimétricas) ficam presas na polpa em repouso e só saem com cisalhamento. "
      "Isso acontece no misturador e na queda, e também quando a polpa escoa e deixa de ser "
      "sólida. A polpa que transborda pelo N-SAI leva gás retido.")
    w("- **CH₄ dissolvido.** Há também metano dissolvido acima da saturação no digestato, "
      "medido em ≈ 6,8% de supersaturação (Tauber et al., 2019).")
    w("- **Quantidade.** Em volume de gás por dia, o arraste é pequeno diante da produção "
      "(pico da planta ≈ 27 Nm³/h). Com 1–5% v/v de gás retido, cada m³ de digestato leva "
      "10–50 L de biogás. O valor real é a LAC-058.\n")
    w("## 2. O peso maior está no armazenamento\n")
    w("- **Medições de campo.** A estocagem aberta de digestato emite de ≈ 2,4% a 12% da "
      "produção de CH₄ da planta (Baldé et al., 2016; Vergote et al., 2020; Knoll et al., "
      "2026).")
    w("- **Estocagem estanque.** Em 33 plantas, a estocagem estanque reduziu as emissões "
      "totais de 6,2% para 2,7% da produção (Wechselberger et al., 2024).")
    w("- **Consequência para o projeto.** Fechar o TQ-301 (alternativa B) ataca a maior "
      "parcela. Melhorar o selo (A′) não mexe nela.\n")
    w("## 3. Espuma\n")
    w("- **Causas.** A espuma em digestores aparece após choques de carga, com acúmulo de "
      "ácidos graxos, AGV, amônia e proteínas tensoativas (Ganidi et al., 2009; He et al., "
      "2017; Yang et al., 2021; Krohn et al., 2025).")
    w("- **Efeitos.** Leva a perfil de sólidos invertido, com mais sólidos no topo (Pagilla "
      "et al., 1997).")
    w("- **No projeto.** O N-SAI no nível é o primeiro ponto a receber essa camada:")
    w("  - **A′:** espuma no copo derruba o fecho. Com fração de gás ε, o fecho vale "
      "330·(1−ε) mm:\n")
    w("| fração de gás no copo | 0% | 20% | 50% | 80% |")
    w("|---|---|---|---|---|")
    s = bg[0]["selo_espuma"]
    w("| fecho (mbar) | " + " | ".join(_f(s[e], 0) for e in (0.0, 0.2, 0.5, 0.8)) + " |")
    w("\n  - **B:** a espuma fica dentro do envelope de gás. É preciso uma sonda de espuma no "
      "TQ-301 para proteger o PVRV e a linha de gás.")
    w("- **Monitoramento.** O potencial de espuma é monitorável por ensaio de aeração "
      "padronizado (Jiang et al., 2018), base da LAC-059.\n")
    w("## 4. Sedimentação e pulsos\n")
    w("- **Pulsos.** A alimentação é por pulsos de 6 m³/h. Entre eles a saída para, e no "
      "caso pessimista a polpa é sólida abaixo de τy.")
    w("- **Onde a polpa fica parada:**")
    w("  - **A′:** copo, ânulo e fundo da CS-301, onde areia e crosta se acumulam.")
    w("  - **B:** só uma lâmina que escorre na rampa até esvaziar, porque sen θ = 0,54, 2,3× o "
      "mínimo pessimista.")
    w("- **Por que a rampa e não um tubo cheio.** A polpa para num tubo parcialmente cheio "
      "quando sen θ < τy/(ρ·g·0,304·D). Para o DE160, isso é 0,012 / 0,069 / 0,231 nos "
      "três casos. Um tubo cheio exigiria a carga de partida 4τyL/(ρgD), da ordem de 0,28 m "
      "por metro no caso pessimista. Por isso as soluções com U ou coluna cheia foram "
      "descartadas.\n")
    w("## 5. Regras de projeto que saem desta nota\n")
    w("1. **Saída:** sempre por transbordo no nível (N-SAI), com lâmina livre e sen θ ≥ 2× "
      "o mínimo pessimista. Nada de trecho cheio, sifão ou U na saída.")
    w("2. **Gás arrastado:** soltá-lo dentro de um espaço de gás recuperado, nunca num "
      "espaço ventilado à atmosfera.")
    w("3. **Selo hídrico em polpa que espuma:** não é barreira confiável. Se usado, precisa "
      "de vigilância de nível e de densidade.")
    w("4. **Tê de lavagem:** um no início de cada rampa, com água de serviço, para a partida "
      "e as paradas longas.\n")
    w("## Referências (Consensus)\n")
    for ref in REFS:
        w(f"- {ref}")
    return "\n".join(L) + "\n"


REFS = (
    "[Steady bubble rise and deformation in Newtonian and viscoplastic fluids and conditions for bubble entrapment](https://consensus.app/papers/details/9575558e90fd5ceb80df73560964e533/?utm_source=claude_desktop) Tsamopoulos, J. et al. (2008). J. Fluid Mech.",
    "[Bubble entrapment condition in Bingham materials](https://consensus.app/papers/details/07bb1b72620a566cb526e01576495c05/?utm_source=claude_desktop) Deoclecio, L. H. et al. (2021). J. Non-Newton. Fluid Mech.",
    "[Quantifying methane emissions from anaerobic digesters.](https://consensus.app/papers/details/c5a4d1d586255f0287f82ae80debf1d3/?utm_source=claude_desktop) Tauber, J. et al. (2019). Water Sci. Technol.",
    "[Methane emissions from digestate at an agricultural biogas plant.](https://consensus.app/papers/details/e7a6e428b5a6509a83193b128af3baa8/?utm_source=claude_desktop) Baldé, H. et al. (2016). Bioresour. Technol.",
    "[Monitoring methane and nitrous oxide emissions from digestate storage following manure mono-digestion](https://consensus.app/papers/details/078ca65745b75c1e8c2c2f699d9afe61/?utm_source=claude_desktop) Vergote, T. et al. (2020). Biosyst. Eng.",
    "[Novel monitoring approach for seasonally resolved continuous methane emission measurements from open digestate storage](https://consensus.app/papers/details/0dce95970afe5be0afe41eed1dc234c1/?utm_source=claude_desktop) Knoll, L. et al. (2026). Biomass Futures.",
    "[Assessment of whole-site methane emissions from anaerobic digestion plants](https://consensus.app/papers/details/b56aa31a79af5c5d921d862be7b7941e/?utm_source=claude_desktop) Wechselberger, V. et al. (2024). Waste Manage.",
    "[Anaerobic digestion foaming causes--a review.](https://consensus.app/papers/details/8579605ab48e51cb906cbdc6f632eccc/?utm_source=claude_desktop) Ganidi, N. et al. (2009). Bioresour. Technol.",
    "[Investigation of foaming causes in three mesophilic food waste digesters](https://consensus.app/papers/details/10f706911d0e5a15912b6a90b88f12d3/?utm_source=claude_desktop) He, Q.-M. et al. (2017). Sci. Rep.",
    "[Foaming mechanisms and control strategies during the anaerobic digestion of organic waste](https://consensus.app/papers/details/c76d73a7c5e25b1096ce5a731abe9f19/?utm_source=claude_desktop) Yang, P. et al. (2021). Sci. Total Environ.",
    "[Microbial population shifts during disturbance induced foaming](https://consensus.app/papers/details/4bed29195d795913b094dbb4f22418ea/?utm_source=claude_desktop) Krohn, C. et al. (2025). Water Res.",
    "[Causes and effects of foaming in anaerobic sludge digesters](https://consensus.app/papers/details/5b3305f374005a39b4a899939ac812da/?utm_source=claude_desktop) Pagilla, K. et al. (1997). Water Sci. Technol.",
    "[Monitoring foaming potential in anaerobic digesters.](https://consensus.app/papers/details/014cc6f0d14e51859202452c84ec82d4/?utm_source=claude_desktop) Jiang, C. et al. (2018). Waste Manage.",
)


def main():
    ga, gb = geometria_a(), geometria_b()
    bg, tqb, cc = bingham(gb), niveis_tq_b(), contracorrente(gb)
    figura(ga, gb, SAIDA / "ESTUDO_SAIDA_METANOGENICOS.png")
    (SAIDA / "ESTUDO_SAIDA_METANOGENICOS.md").write_text(estudo(ga, gb, bg, tqb, cc),
                                                          encoding="utf-8")
    (SAIDA / "NOTA_TECNICA_BIFASICO.md").write_text(nota(bg), encoding="utf-8")
    for t in ("R-201", "R-202"):
        print(t, {k: (round(v, 3) if isinstance(v, float) else v) for k, v in gb[t].items()
                  if k not in ("p0", "n1_xy")})
    print("A′", {t: ga[t]["Lh"] for t in ("R-201", "R-202")}, ga["cs_tq"], ga["folga_reator"])
    print(tqb, cc)
    for r in bg:
        print(r["caso"], round(r["h_sol"], 3), round(r["s_min"], 3), round(r["r_crit_cm"], 2))


if __name__ == "__main__":
    main()
