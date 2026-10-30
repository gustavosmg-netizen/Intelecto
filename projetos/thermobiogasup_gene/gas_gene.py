"""Memória do sistema de biogás (Gen E rev. 4) e matriz de causa e efeito.

Arquitetura (pedido do cliente): os reatores só EMPURRAM gás para um gasômetro de pressão
quase nula (GH-1). A retirada do GH-1 acontece só pela linha exclusiva de saída, com a ENTRADA
daquele gasômetro fechada e anti-retorno: por isso há dois (GH-1A e GH-1B) alternando
recebimento e transferência. Os sopradores S-501 nunca enxergam o coletor dos reatores. O GH-2
(dupla membrana, pressão de consumo) alimenta o flare e os consumidores.
Perdas de gás por Darcy–Weisbach (Swamee–Jain, PEAD ε = 0,007 mm) + K das singularidades.
"""
from __future__ import annotations

import math

R_U = 8.314
T_GAS = 308.0               # K (35 °C)
P_ATM = 91.3e3              # Pa, sítio de referência (LAC-027)
M_GAS = 0.6 * 16.04 + 0.4 * 44.01    # g/mol, 60 % CH₄ / 40 % CO₂
RHO = P_ATM * M_GAS / 1000 / (R_U * T_GAS)
MU = 1.3e-5                 # Pa·s
FATOR_REAL = (T_GAS / 273.15) * (101.325e3 / P_ATM)   # Nm³ → m³ reais no sítio
# Produção (RES-001): pico da planta ≈ 27 Nm³/h (SP-02); por reator, pico com térmico (SP-01)
PICO = {"R-101": 4.5, "R-201": 11.5, "R-202": 11.5, "planta": 27.0}
P_GH1 = (0.5, 2.0)          # mbar: faixa-alvo da bolsa de membrana simples (LAC-050)
P_GH2 = 25.0                # mbar: pressão típica de dupla membrana para consumidores (LAC-050)
V_GH1 = 60.0                # m³ úteis por bolsa
Q_SOPR = 60.0               # m³/h por soprador (A opera, B reserva)
DP_FA = 2.0                 # mbar no corta-chamas à vazão nominal (catálogo típico; LAC-051)
K = {"curva90": 0.30, "curva45": 0.20, "gaveta": 0.15, "borboleta": 0.50, "retencao": 2.0,
     "te_ramal": 1.0, "te_passagem": 0.3, "reducao": 0.3, "entrada": 0.5, "saida": 1.0,
     "pote": 3.0, "esfera": 0.1}


def _f_darcy(re, D, eps=7e-6):
    if re < 2300:
        return 64 / max(re, 1)
    return 0.25 / math.log10(eps / (3.7 * D) + 5.74 / re ** 0.9) ** 2


def dp_linha(m, tag, Q_m3h, s_a=0.0, s_b=None, extra=()):
    """Perda (mbar) de gás na linha `tag` entre s_a e s_b (mm), vazão real Q (m³/h)."""
    ln = m.linhas[tag]
    s_b = ln.comprimento if s_b is None else s_b
    D = ln.tubo.di / 1000
    A = math.pi * D ** 2 / 4
    v = Q_m3h / 3600 / A
    re = RHO * v * D / MU
    L = (s_b - s_a) / 1000
    dp = _f_darcy(re, D) * L / D * RHO * v ** 2 / 2
    ks = list(extra)
    for el in ln.elementos:
        if el[0] == "curva" and s_a <= el[7] < s_b:
            ks.append("curva90" if el[6] > 60 else "curva45")
    fa = 0.0
    for c in ln.componentes:
        if s_a <= c.s0 < s_b:
            if c.tipo == "corta_chamas":
                fa += DP_FA * (Q_m3h / Q_SOPR) ** 2
            elif c.tipo in K:
                ks.append(c.tipo)
    for t in getattr(m, "tes", {}).get(tag, []):
        if s_a <= t["s"] < s_b:
            ks.append("te_passagem")
    dp += sum(K[k] for k in ks) * RHO * v ** 2 / 2
    return dp / 100 + fa, v


def _s_te(m, run, ramal):
    t = next(t for t in m.tes[run] if t["ramal"] == ramal)
    return t["s"] + t["L"] / 2


def calcular(m):
    fr = FATOR_REAL
    out = {"rho": RHO, "fator": fr}
    Qp = PICO["planta"] * fr
    col = m.linhas["COL-501"]
    s_b = _s_te(m, "COL-501", "COL-501B")
    s_101 = _s_te(m, "COL-501", "PC-101-COL")
    s_201 = _s_te(m, "COL-501", "PC-201-COL")
    rec = {}
    for gh in ("GH-1A", "GH-1B"):
        for t in ("R-101", "R-201", "R-202"):
            q = PICO[t] * fr
            dp = dp_linha(m, f"{t}-GAS", q, extra=("entrada",))[0]
            dp += K["pote"] * RHO * (q / 3600 / (math.pi * 0.0972 ** 2 / 4)) ** 2 / 2 / 100
            if t == "R-202":
                s0 = 0.0
            else:
                dp += dp_linha(m, f"PC-{t[2:]}-COL", q, extra=("te_ramal",))[0]
                s0 = s_101 if t == "R-101" else s_201
            if gh == "GH-1A":
                dp += dp_linha(m, "COL-501", Qp, s0, col.comprimento, extra=("saida",))[0]
            else:
                if s0 > s_b:        # o tê do GH-1B fica a montante: gás volta pelo coletor
                    dp += dp_linha(m, "COL-501", Qp, s_b, s0)[0]
                else:
                    dp += dp_linha(m, "COL-501", Qp, s0, s_b)[0]
                dp += dp_linha(m, "COL-501B", Qp, extra=("te_ramal", "saida"))[0]
            rec[(gh, t)] = {"dp": dp, "p_min": P_GH1[0] + dp, "p_max": P_GH1[1] + dp}
    out["reatores"] = rec
    # transferência GH-1 → S-501 → GH-2 e GH-2 → flare
    q = Q_SOPR
    dpa = dp_linha(m, "TR-501", q, extra=("entrada",))[0]
    dpb = dp_linha(m, "TR-501B", q, extra=("entrada", "te_ramal"))[0] + dp_linha(
        m, "TR-501", q, _s_te(m, "TR-501", "TR-501B"))[0]
    dp2 = dp_linha(m, "TR-502", q, extra=("saida",))[0]
    out["transf"] = {"dp_succao_A": dpa, "dp_succao_B": dpb, "dp_descarga": dp2,
                     "dp_soprador": P_GH2 + max(dpa, dpb) + dp2 - P_GH1[0]}
    dps = out["transf"]["dp_soprador"]
    out["transf"]["kW_hid"] = q / 3600 * dps * 100 / 1000
    out["transf"]["kW_eixo"] = out["transf"]["kW_hid"] / 0.40
    out["ciclo"] = {"enchimento_h": V_GH1 / Qp, "transferencia_h": V_GH1 / (Q_SOPR - 0),
                    "uso_soprador": Qp / Q_SOPR}
    out["flare"] = {"dp_GS501_60": dp_linha(m, "GS-501", 60.0, extra=("saida",))[0],
                    "Q_proj": max(Q_SOPR, Qp) * 1.0}
    return out


def _f(x, n=2):
    return f"{x:.{n}f}".replace(".", ",")


def memoria(m, res, arquivo):
    L = []
    w = L.append
    w("# Memória do sistema de biogás — Gen E rev. 4 (documento de trabalho)\n")
    w("Situação: **PROPOSTA DE TRABALHO, NÃO LIBERADA**, sujeita ao Crivo A–F independente. "
      "Pressões em mbar manométricos no sítio de referência (Congonhas/MG, ≈ 870 m). Sem "
      "valores monetários.\n")
    w("## 1. Arquitetura e regras de operação\n")
    w("O sistema tem dois níveis de pressão, e os reatores ficam praticamente sem pressão "
      "positiva ou negativa:\n")
    w("1. **Reatores → GH-1 (gasômetro de membrana simples, ≈ 0 a +2 mbar).**")
    w("   - Cada reator sai pelo N3 com registro LO e ZSC, desce a um pote de condensado no "
      "chão e entra no coletor COL-501, que vai aos dois gasômetros GH-1A e GH-1B.")
    w("   - O coletor **não tem retenção**: o reator respira com o GH-1 que está recebendo, "
      "para entregar gás e também para receber de volta quando esfria ou quando se retira "
      "líquido.")
    w("2. **Alternância GH-1A / GH-1B.** Em cada instante uma bolsa **RECEBE** (entrada "
      "aberta, saída fechada) e a outra **TRANSFERE** (entrada fechada, saída aberta).")
    w("   - A saída é uma linha exclusiva, com XV falha-fecha e **retenção anti-retorno**, até "
      "os sopradores S-501.")
    w("   - A saída de uma bolsa só abre com a entrada dela comprovadamente fechada (ZSC) e a "
      "entrada da outra comprovadamente aberta (ZSO).")
    w("   - **Entrada de uma bolsa só abre** com a saída dela fechada (ZSC) e o S-501 parado.")
    w("   - **Saídas:** válvula de bloqueio estanque (classe VI) + retenção de sede macia. "
      "Elas fecham em **qualquer** parada do S-501 e em toda falha de sequência (posição não "
      "confirmada no tempo).")
    w("   - **Entradas são falha-abre** e as saídas falha-fecha: na perda de ar ou de energia, "
      "as duas bolsas passam a receber e nenhuma transfere. Assim o reator sempre tem para "
      "onde empurrar o gás e nada aspira o coletor.")
    w("   - **Bolsa que recebe cheia (LSHH) com a outra ainda transferindo:**")
    w("     1. parte o S-501B (ou ambos), porque a transferência já é mais rápida que o "
      "enchimento;")
    w("     2. se a bolsa que recebe chegar ao LAHH, a transferência para, as saídas fecham e as "
      "duas bolsas passam a receber;")
    w("     3. o excesso sai pelo alívio conduzido do GH-1, a ≤ +5 mbar.")
    w("3. **S-501 → GH-2 (dupla membrana, pressão de consumo) → flare e consumidores.**")
    w("   - Os sopradores só aspiram a bolsa que está transferindo. **Nenhum soprador aspira o "
      "coletor dos reatores.**")
    w("   - Camada mecânica (RES-001 D-RES-12): a válvula autoatuada PCV-501 mantém a "
      "pressão a montante, na bolsa, em ≈ +0,3 mbar.")
    w("   - Trips hardwired do S-501: LSLL de qualquer bolsa, PSLL medido na bolsa "
      "(≤ +0,5 mbar), PALL de qualquer reator, TSHH dos corta-chamas e O₂ alto. O PSLL "
      "de sucção, a −5 mbar, protege só o soprador.")
    w("   - O by-pass BYP-501 (descarga dos sopradores direto ao flare) serve para manutenção "
      "do GH-2 e fica fechado com chave presa.")
    w("4. **Retiradas de líquido, pela mesma lógica.** Purga ou esgotamento de um reator só "
      "acontece com ele ligado ao GH-1 que recebe (V-xGAS aberta, ZSO), com esse gasômetro "
      "≥ 70% (RES-001 §5.6) e sem transferência ativa daquela bolsa. O gás da bolsa repõe o "
      "volume retirado "
      "e o reator não entra em vácuo.\n")
    w("## 2. Propriedades e vazões\n")
    w(f"- **Biogás** 60% CH₄ / 40% CO₂: ρ = {_f(res['rho'], 3)} kg/m³ no sítio a 35 °C. "
      f"Fator Nm³ → m³ reais: {_f(res['fator'], 3)}.")
    w(f"- **Pico de produção** (RES-001): planta {PICO['planta']} Nm³/h; R-201 e R-202 "
      f"{PICO['R-201']} Nm³/h cada; R-101 {PICO['R-101']} Nm³/h (térmico incluso).\n")
    w("## 3. Pressão nos reatores (coletor ao GH-1 que recebe, vazão de pico)\n")
    w("| recebendo | reator | perda até o GH-1 (mbar) | pressão no reator (mbar) |")
    w("|---|---|---|---|")
    for (gh, t), r in res["reatores"].items():
        w(f"| {gh} | {t} | {_f(r['dp'], 3)} | {_f(r['p_min'])} a {_f(r['p_max'])} |")
    pmax = max(r["p_max"] for r in res["reatores"].values())
    w(f"\n- **Pressão máxima nos reatores:** {_f(pmax)} mbar. Fica abaixo do PAH (+5), do selo "
      "hidráulico (+8) e do envelope (+15).")
    w("- **No resfriamento** (VC-01, até ≈ 2,7 Nm³/h de volta), o reator fica no máximo "
      "décimos de mbar abaixo do GH-1: sem vácuo enquanto a bolsa que recebe não estiver "
      "vazia (alarme LSL e trip LSLL).")
    w("- **Alívio próprio do GH-1** (selo d'água) entre +3 e +4 mbar: é o mais baixo do "
      "sistema, abaixo do selo dos reatores.")
    w("  - É **conduzido a uma chaminé fora do abrigo**, com capacidade ≥ 27 Nm³/h a "
      "≤ +5 mbar (SP-02).")
    w("  - É o último recurso quando os sopradores ou o flare faltam. S-501, flare e "
      "intertravamentos ficam em energia de emergência.\n")
    t = res["transf"]
    c = res["ciclo"]
    w("## 4. Transferência GH-1 → GH-2\n")
    w(f"- **Sopradores S-501A/B:** {Q_SOPR:.0f} m³/h cada (A opera, B reserva), "
      f"Δp ≈ {_f(t['dp_soprador'], 1)} mbar.")
    w(f"  - O Δp soma GH-2 a {P_GH2:.0f} mbar, a sucção ({_f(max(t['dp_succao_A'], t['dp_succao_B']), 2)} "
      f"mbar, com o corta-chamas FA-501) e a descarga ({_f(t['dp_descarga'], 2)} mbar).")
    w(f"  - Potência no eixo ≈ {_f(t['kW_eixo'], 2)} kW: soprador de canal lateral ATEX de "
      "0,55–0,75 kW.")
    w(f"- **Ciclo de uma bolsa de {V_GH1:.0f} m³:** enche em ≈ {_f(c['enchimento_h'], 1)} h no "
      f"pico e esvazia em ≈ {_f(c['transferencia_h'], 1)} h.")
    w(f"  - A transferência termina antes de a outra encher: o soprador trabalha "
      f"≈ {_f(100 * c['uso_soprador'], 0)}% do tempo.")
    w("- **GH-2 (≈ 180 m³):** pulmão dos consumidores. O volume final depende da LAC-052.\n")
    f = res["flare"]
    w("## 5. Flare\n")
    w(f"- **Capacidade de projeto ≥ {_f(f['Q_proj'], 0)} m³/h:** é a vazão do soprador, "
      "porque o by-pass do GH-2 pode mandar a descarga inteira ao flare.")
    w(f"  - Perda GH-2 → flare a 60 m³/h: {_f(f['dp_GS501_60'], 2)} mbar, mais o corta-chamas.")
    w("- **Skid do flare:** bloqueio duplo, ignição piloto, detector de chama e corta-chamas "
      "de detonação FA-502. O consumidor tem o seu próprio corta-chamas, FA-503.")
    w("- **Tie-in dos consumidores:** duas retenções e PSHH no coletor (SP-09: refluxo do "
      "SK-501).")
    w("- **Grupo de gás IIC** em todo o sistema (corta-chamas, sopradores, gasômetros, "
      "analisador e detectores), porque o coletor comum recebe o gás do R-101, que tem H₂ "
      "(D-RES-10).")
    w("- **Distâncias de segurança** entre flare, gasômetros e consumidores a confirmar "
      "(LAC-051). No modelo, o flare fica ≈ 14 m do GH-2.\n")
    w("## 6. Condensado e material\n")
    w("- **Ramais dos reatores:** sobem do N3 e caem 1% de volta ao reator. Descem na "
      "vertical a potes de condensado no chão (PC-101/201/202), com dreno em selo hidráulico "
      "≥ 2× a pressão máxima da linha.")
    w("- **Coletor e linhas de transferência:** pontos baixos nas entradas dos GH-1 e antes do "
      "S-501, com potes de dreno. Os drenos têm selo ≥ 250 mm de água, maior que +15/−8 mbar "
      "com margem, e controle de nível, para não virarem o alívio mais baixo nem admitirem ar.")
    w("- **Material:** linhas aéreas de gás em inox 304L/316L, ou PEAD só enterrado com "
      "proteção UV nas transições. O modelo desenha PEAD por simplicidade (LAC-051).\n")
    w("## 7. Fornecedor dos gasômetros\n")
    w("- **Plaslonas:** não encontrei catálogo técnico em fonte aberta. Pedir a ficha técnica "
      "(LAC-050).")
    w("- **Referência de mercado:** gasômetros de membrana operam de −1 a +5 mbar e os de "
      "dupla membrana com ventilador de suporte de 20 a 50 mbar. A faixa-alvo do GH-1 "
      "(≈ 0 a +2 mbar) e a do GH-2 (15–30 mbar) cabem nesses produtos.")
    w("- **Dados a pedir:** volume útil, pressão de operação e de alívio, medição de volume, "
      "material e resistência UV/H₂S, ventilador de suporte (GH-2), certificação de área "
      "classificada e garantia de estanqueidade.")
    open(arquivo, "w").write("\n".join(L) + "\n")


MATRIZ = [
    # (iniciador, ajuste, ação, tipo)
    ("LSHH de reator (R-101/201/202)", "+4,35 / +8,35 m", "Para a alimentação daquele reator "
     "(P-101 ou P-201, com a XV de alternância); alarme", "SIF / hardwired"),
    ("LSH de reator", "+4,20 / +8,20 m", "Alarme (saída obstruída?)", "alarme"),
    ("PAH / PAHH do reator", "+5 / +6 mbar", "PAHH: para a alimentação; parte S-501B e "
     "abre a XV-FL; último recurso: alívio conduzido do GH-1", "SIF a definir no HAZOP"),
    ("PALL do reator", "0 mbar", "Fecha as XV de purga e a XV-101S, para P-201, P-301 em "
     "purga e "
     "o S-501, e fecha as saídas dos GH-1", "hardwired"),
    ("ZSC da V-xSAI / V-xRS ou da V-xGAS fechada", "—", "Bloqueia a alimentação do reator "
     "(saída ou gás isolados)", "permissivo"),
    ("LSLL do R-101", "+2,40 m", "Para a P-201 e fecha a XV-101S (não esvazia o acidogênico)",
     "SIF"),
    ("LSL do R-101", "+2,80 m", "Bloqueia novo pulso da P-201", "permissivo"),
    ("pH em linha fora da faixa (AIT-201)", "a definir (≈ 6,5–7,5)", "Interrompe o pulso "
     "(fecha XV-211/221, para a P-201); alarme", "CLP"),
    ("pH/ORP na saída de um metanogênico (AIT-212/222)", "a definir", "Alarme; reduz a carga "
     "daquele reator (menos pulsos)", "CLP"),
    ("Falha da dosadora DOS-201 (sem vazão)", "—", "Interrompe o pulso", "CLP"),
    ("XV-RL05 (retorno alcalino à sucção da P-201)", "—", "Só abre com a P-201 em marcha, "
     "com vazão em razão (FIT)", "intertravamento"),
    ("Misturador do reator de destino parado", "—", "Bloqueia o pulso para aquele reator "
     "(curto-circuito)", "permissivo"),
    ("LSLL da CS-301", "+0,70 m", "Para a P-301", "hardwired"),
    ("LSHH da CS-301", "+1,10 m", "Para a P-201 e a P-301 em purga e fecha as XV de purga",
     "hardwired"),
    ("LSHH do TQ-301", "+3,85 m", "Para a P-301 na transferência (a CS-301 sobe até o LSHH "
     "e corta a P-201)", "hardwired"),
    ("PSHH na descarga das PCP", "abaixo da classe do PEAD", "Trip da bomba (a PSV alivia "
     "antes de qualquer válvula)", "hardwired"),
    ("PSL na sucção das PCP", "—", "Trip da bomba (marcha a seco)", "hardwired"),
    ("Permissivo de purga (P-301) e de retirada do R-101 (P-201)", "—", "V-xGAS aberta (ZSO), bolsa que recebe "
     "≥ 70%, destino < LSH, nenhuma outra retirada; a XV abre só com a bomba em marcha e "
     "fecha com ela", "permissivo"),
    ("Permissivo de entrada de uma bolsa GH-1", "—", "Saída da mesma bolsa fechada (ZSC) e "
     "S-501 parado", "intertravamento"),
    ("Permissivo de saída de uma bolsa GH-1", "—", "Entrada da mesma bolsa fechada (ZSC), "
     "entrada da outra aberta (ZSO) e bolsa ≥ LSL", "intertravamento"),
    ("Parada do S-501 (qualquer causa)", "—", "Fecha as duas saídas dos GH-1", "hardwired"),
    ("Falha de sequência (ZSO/ZSC não confirmado)", "10 s", "Para o S-501, fecha as saídas, "
     "abre as duas entradas, alarme", "hardwired"),
    ("LSHH da bolsa que recebe com a outra transferindo", "90%", "Parte o S-501B", "CLP"),
    ("LAHH da bolsa que recebe", "95%", "Para a transferência, fecha as saídas, abre as duas "
     "entradas; excesso pelo alívio conduzido", "hardwired"),
    ("LSLL de qualquer bolsa GH-1", "10%", "Fecha a saída dela e para o S-501", "hardwired"),
    ("PSLL na bolsa que transfere", "≤ +0,5 mbar", "Para o S-501 (a PCV-501 já estrangula "
     "a ≈ +0,3 mbar)", "hardwired"),
    ("PSLL na sucção do S-501", "−5 mbar", "Para o S-501 (proteção da máquina)", "hardwired"),
    ("Falha do S-501A", "—", "Partida automática do S-501B", "CLP"),
    ("TSHH nos corta-chamas FA-501/502/503", "chama retida", "Para o S-501 / fecha a XV-FL / "
     "isola o tie-in", "hardwired"),
    ("LSHH do GH-2", "90%", "Abre a XV-FL (flare); com o flare indisponível, para o S-501",
     "CLP"),
    ("LSLL do GH-2", "10%", "Corta os consumidores (tie-in) e o flare", "hardwired"),
    ("PSHH no coletor do tie-in", "> pressão do GH-2 + margem", "Isola o tie-in (refluxo do "
     "SK-501, SP-09)", "hardwired"),
    ("O₂ no biogás (AT-501)", "> 1% alarme / > 2% trip", "Trip: para o S-501, o flare e as "
     "retiradas de líquido (entrada de ar)", "hardwired"),
    ("Detector de chama do flare", "falha", "Fecha a XV-FL; o GH-2 acumula", "do skid"),
    ("Detectores fixos CH₄ / H₂S", "10–20% LIE / 10 ppm", "Alarme e trip local "
     "(sopradores, flare)", "hardwired"),
    ("Falta de energia", "—", "XV de entrada abrem, de saída fecham, PCP param; S-501, "
     "flare e CLP de segurança em energia de emergência", "projeto"),
]


def matriz(arquivo):
    L = ["# Matriz de causa e efeito e monitoramento — Gen E rev. 4 (documento de trabalho)\n",
         "Base: RES-001 §5.6 e as regras do cliente (retiradas só por linha exclusiva, com "
         "anti-retorno e a fonte em recebimento). Os ajustes são propostas, a confirmar no "
         "HAZOP/LOPA. As SIF exigem sensores independentes dos de controle (LAC-048).\n",
         "| iniciador | ajuste | ação | tipo |", "|---|---|---|---|"]
    L += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in MATRIZ]
    L += ["\n## Monitoramento contínuo (supervisório)\n",
          "| grandeza | onde | para quê |", "|---|---|---|",
          "| Nível (radar) | R-101/201/202, CS-301, TQ-301 | Controle das PCP (inversor), "
          "balanço de massa, detecção de saída obstruída |",
          "| Pressão do espaço de gás (PT) | cada reator | Envelope ±, PAH/PAL; tendência de "
          "obstrução de ramal |",
          "| Volume das bolsas (LT) | GH-1A/B, GH-2 | Alternância, produção de biogás (ΔV/Δt) |",
          "| Vazão de gás (FT) | descarga S-501, tie-in, flare | Produção, consumo, queima |",
          "| CH₄/CO₂/O₂/H₂S (AT-501) | coletor COL-501 | Qualidade, entrada de ar, "
          "dessulfurização |",
          "| pH/ORP em linha (AIT-201) | entrada dos metanogênicos | Dosagem (DOS-201) e "
          "razão do RL-05 |",
          "| pH/ORP (AIT-212/222) | copo de saída de cada metanogênico na CS-301 | "
          "Estabilidade da metanogênese |",
          "| Vazão de lodo (FIT) | purgas, P-201, P-301 | Q ≤ Q_máx; balanço de sólidos |",
          "| Corrente e pressão das PCP | P-201, P-301 | Desgaste do estator, entupimento |",
          "| ΔP e temperatura dos corta-chamas | FA-501/502/503 | Entupimento e chama retida |",
          "| ZSO/ZSC de todas as XV e válvulas de bloqueio | gás e líquidos | Permissivos e "
          "sequências |",
          "| Temperatura (TT) | reatores | Estabilidade mesofílica |"]
    with open(arquivo, "w") as fh:
        fh.write("\n".join(L) + "\n")
