"""Spec da F02 Gen E - cascata anaeróbia, neutralização e biofertilizante (Ilha 2)."""
from _comum import folha, noz, salvar

E, V, I, L, C, D = [], [], [], [], [], []
SIMB, TXT, CON, SIN, COT, SEM_ROTULO, LIN = [], [], [], [], [], [], []


def eq(id, sym, x, y, desc, dados=None, semtag=False, **kw):
    item = dict(id=id, symbol=sym, x=x, y=y, desc=desc, **({"dados": dados} if dados else {}), **kw)
    if not semtag:
        item["tag"] = id
    E.append(item)


def va(id, sym, x, y, desc=None, **kw):
    V.append(dict(id=id, symbol=sym, x=x, y=y, tag=id, **({"desc": desc} if desc else {}), **kw))


def ins(tag, x, y):
    I.append(dict(id=tag, type="plc", location="field", x=x, y=y, tag=tag))


def ln(a, b, num, cls="process_major", **kw):
    L.append({"from": a, "to": b, "class": cls, "number": num, **kw})


def con(id, d, x, y, tag, lk, ref, cls, num, **kw):
    C.append(dict(id=id, direction=d, x=x, y=y, tag=tag, link=lk,
                  **{("to" if d == "in" else "from"): ref, "class": cls, "number": num}, **kw))


Y0 = 150  # base dos tanques (cota 0 do desenho)


def reator(tag, cx, w, h, dados, num, n2, nivel, nivel_txt):
    """Reator PRFV com bocais: topo (gás, selo, N2), costado (N2-A entrada, N2-B saída), fundo (N2-C, N2-D)."""
    W, H = 2 * w, 2 * h
    cy = Y0 + H / 2
    # fundo e tampo planos (as-built Fibrais): tanque de teto plano
    eq(tag, "tank", cx, cy, dados[0], dados[1:], rotulo={"x": cx, "y": Y0 + H * nivel - 5, "alinh": "C"},
       params={"width": w, "height": h, "roof": "flat", "nozzles": noz(("NF", "top", 0.06), ("NG", "top", 0.18), ("NS", "top", 0.32),
                                                      ("NN", "top", 0.66), ("NQ", "top", 0.95), ("NB", "right", 0.03),
                                                      ("NC", "bottom", 0.2), ("ND", "bottom", 0.8))})
    x0, top = cx - W / 2, Y0 + H
    xg, xs, xn, xm = x0 + 0.18 * W, x0 + 0.32 * W, x0 + 0.66 * W, x0 + 0.78 * W
    xf, xq = x0 + 0.06 * W, x0 + 0.95 * W
    # tubo de imersão interno (alimentação pelo tampo até ~1/3 da altura; furo quebra-sifão no espaço de gás)
    LIN.append({"pontos": [[xf, top], [xf, Y0 + H / 3]], "servico": "INTERNO", "seta": False})
    TXT.append({"texto": "TUBO DE IMERSÃO", "x": xf + 1.5, "y": Y0 + H / 3 + 2, "altura": 1.8})
    k = tag.split("-")[1]  # 101 / 201 / 202
    lp = {"101": "11", "201": "21", "202": "22"}[k]
    # agitador vertical de topo
    E.append(dict(id=f"AG-R{k}", symbol="agitator", x=cx, y=top))  # TAG nos dados do reator (topo denso)
    # gás: isolamento travado aberto
    va(f"HV-{lp}5", "gate", xg, top + 26, "LO", actuator="hand", rotation=90)
    ln(f"{tag}.NG", f"HV-{lp}5.in", f"BRUTO-{num}1", "utility", label=False)
    # selo hidráulico e respiro
    eq(f"SH-{k}", "vertical_vessel", xs, top + 44, None, rotulo={"x": xs, "y": top + 100, "alinh": "C"},
       params={"width": 8, "height": 14, "nozzles": noz(("N1", "bottom", 0.5), ("N2", "top", 0.5))})
    eq(f"RS-{k}", "drain_vent", xs, top + 78, None, rotation=180, semtag=True)
    ln(f"{tag}.NS", f"SH-{k}.N1", f"ALIV-{num}2", "utility", label=False)
    ln(f"SH-{k}.N2", f"RS-{k}.in", f"ALIV-{num}3", "utility", label=False)
    # N2 de partida/purga: conector + válvula travada fechada
    va(f"HV-{lp}7", "gate", xn, top + 40, "LC", actuator="hand", rotation=270)
    ln(f"HV-{lp}7.out", f"{tag}.NN", f"N2-{num}4", "utility", label=False)
    con(f"N2{k}", "in", xn + 30, top + 124, "N2", "PARTIDA/PURGA", f"HV-{lp}7.in", "utility", f"N2-{num}4",
        rotation=180)
    # alívio de emergência bidirecional na M2 (símbolo da casa)
    SIMB.append({"simbolo": "emergencia", "x": xm, "y": top + 6 + 12, "tag": f"PVSV-{lp}1",
                 "rotulo": {"x": xm + 6, "y": top + 26, "alinh": "L"}})
    # drenos: amostragem (N2-C) e expurgo travado com chave presa (N2-D)
    xc, xd = x0 + 0.2 * W, x0 + 0.8 * W
    va(f"HV-{lp}3", "gate", xc, Y0 - 16, "AMOSTRA", actuator="hand", rotation=270, scale=0.6)
    va(f"HV-{lp}4", "gate", xd, Y0 - 16, "LC / KL", actuator="hand", rotation=270, scale=0.6)
    ln(f"{tag}.NC", f"HV-{lp}3.in", f"LODO-{num}5", label=False)
    ln(f"{tag}.ND", f"HV-{lp}4.in", f"LODO-{num}6", label=False)
    C.append(dict(id=f"EC{k}", direction="out", x=xd, y=Y0 - 30, tag=f"EC-{k}", rotation=270, scale=0.5,
                  **{"from": f"HV-{lp}4.out", "class": "process_major", "number": f"LODO-{num}6"}))
    SEM_ROTULO.append(f"LODO-{num}6")
    SIMB.append({"simbolo": "amostragem", "x": xc, "y": Y0 - 27, "rotation": 180})
    COT.append({"x0": x0 + 3, "x1": x0 + W - 3, "y": Y0 + H * nivel, "texto": f"N.A. {nivel_txt} m"})
    return x0, top, xg, xn, xf, xq


# --- R-101 (estágio ácido) ---
x0, top101, xg101, xn101, xf101, xq101 = reator("R-101", 120, 30, 38, ["REATOR ACIDOGÊNICO", "PRFV - Fibrais 315E-25",
                                  "Øint 3,20 x Hcil 4,70 m", "Misturador AG-R101", "Gás com H2 (IIC)"], "21", "-4/-5 mbar no R-101",
                                  3.5 / 4.7, "+3,50")
# alimentação pelo tampo (N1-A): válvula falha-fechada no solo, subida externa e tubo de imersão
va("XV-111", "ball", 64, 120, "ALIM. R-101", actuator="piston", fail="FC", rotation=90)
con("F01A", "in", 34, 94, "F01", "DE P-101", "XV-111.in", "process_major", "LODO-2101")
ln("XV-111.out", "R-101.NF", "LODO-2101", route=[[64, top101 + 14], [xf101, top101 + 14]])
# saída nivelada (coluna externa a partir do N2) -> TQ-201 fechado e equalizado: sem sifão U
eq("TQ-201", "tank", 235, Y0 + 18, "TANQUE DE NEUTRALIZAÇÃO", ["Fechado, equalizado c/ R-101 (IIC)", "2,5-3,6 m3 (LAC-010)"],
   rotulo={"x": 229, "y": 143, "alinh": "R"},
   params={"width": 24, "height": 18, "roof": "flat",
           "nozzles": noz(("N1", "top", 0.3), ("N3", "top", 0.65), ("N2", "top", 0.88), ("N4", "right", 0.75),
                          ("N5", "bottom", 0.5))})
ln("R-101.NB", "TQ-201.N1", "LODO-2102", route=[[164, 152.3], [164, 206.6], [225.4, 206.6]])
# quebra-sifão da coluna (N1-D) e equalização do TQ-201 com o espaço de gás do R-101 (LO, sem bloqueio)
D.append({"from": "R-101.NQ", "to": [164, 206.6], "route": [[xq101, top101 + 14], [164, top101 + 14]],
          "class": "utility", "number": "ACID-2111"})
D.append({"from": "TQ-201.N3", "to": [164, 225], "route": [[242.2, 225]],
          "class": "utility", "number": "ACID-2112"})
SEM_ROTULO.append("ACID-2112")
eq("AG-200", "agitator", 235, Y0 + 36, None, rotulo={"x": 229, "y": Y0 + 52, "alinh": "R"})
eq("DOS-201", "pd_pump", 290, 242, "ALCALINIZANTE", ["Rubrica FINEP: dosadora (4)"], rotation=180,
   rotulo={"x": 290, "y": 268, "alinh": "C"})
ln("DOS-201.out", "TQ-201.N2", "QUIM-2104", "utility", route=[[253.24, 242]])
con("BL-04", "in", 330, 242, "BL-04", "ALCALINIZANTE", "DOS-201.in", "utility", "QUIM-2104", rotation=180)
eq("P-201", "pd_pump", 320, 108, "TRANSFERÊNCIA", ["Q <= 20 m3/h (proposta)"], rotulo={"x": 320, "y": 140, "alinh": "C"})
ln("TQ-201.N5", "P-201.in", "LODO-2105", route=[[235, 108]])
va("VR-201", "check", 350, 108)
ln("P-201.out", "VR-201.in", "LODO-2106")
# --- R-201 / R-202 (estágio metanogênico) ---
x201, top201, xg201, xn201, xf201, xq201 = reator("R-201", 420, 32, 75, ["REATOR METANOGÊNICO 1", "PRFV - Fibrais 315D-25",
                                    "Øint 3,80 x Hcil 9,30 m", "Misturador AG-R201", "Nível: LAC-005"], "22", "+12/-6 mbar",
                                    7.5 / 9.3, "+7,50")
x202, top202, xg202, xn202, xf202, xq202 = reator("R-202", 580, 32, 75, ["REATOR METANOGÊNICO 2", "PRFV - Fibrais 315D-25",
                                    "Øint 3,80 x Hcil 9,30 m", "Misturador AG-R202", "Nível: LAC-005"], "23", "+12/-6 mbar",
                                    7.5 / 9.3, "+7,50")
# pulsos alternados: uma XV falha-fechada por ramal; volume por pulso no FQIT-201
va("XV-211", "ball", 364, 128, "PULSO R-201", actuator="piston", fail="FC", rotation=90,
   rotulo={"x": 370, "y": 133, "alinh": "L"})
va("XV-221", "ball", 524, 128, "PULSO R-202", actuator="piston", fail="FC", rotation=90,
   rotulo={"x": 530, "y": 133, "alinh": "L"})
ln("VR-201.out", "XV-221.in", "LODO-2106", route=[[524, 108]])
ln("XV-211.out", "R-201.NF", "LODO-2107", route=[[364, top201 + 14], [xf201, top201 + 14]])
ln("XV-221.out", "R-202.NF", "LODO-2108", route=[[524, top202 + 14], [xf202, top202 + 14]])
D.append({"from": [364, 108], "to": "XV-211.in", "class": "process_major", "number": "LODO-2107"})
# RL-07: manifold P-102 <> P-201
va("HV-202", "gate", 332, 143, "RL-07", actuator="hand")
con("F01B", "in", 292, 143, "F01", "DE P-102", "HV-202.in", "process_major", "LODO-2109")
D.append({"from": "HV-202.out", "to": [384, 108], "route": [[384, 143]], "class": "process_major", "number": "LODO-2109"})
# --- TQ-301 e P-301 ---
eq("TQ-301", "tank", 740, Y0 + 42, "TANQUE DE BIOFERTILIZANTE",
   ["Fibrais 315A-25", "Øint 3,00 x Hcil 2,40 + cone 1,50 m", "N1 4x6\" +4,66 | N2 4x6\" +2,48", "Rubrica: LAC-012"],
   params={"width": 26, "height": 42, "roof": "flat",
           "nozzles": noz(("N1", "left", 0.81), ("N1B", "left", 0.93), ("N3", "top", 0.5), ("N4", "bottom", 0.5))},
   rotulo={"x": 772, "y": 290, "alinh": "L"})
eq("RS-301", "drain_vent", 740, Y0 + 84 + 18, None, rotation=180, semtag=True)
ln("TQ-301.N3", "RS-301.in", "ALIV-2401", "utility", label=False)
# saídas niveladas + sifão U (gravidade)
ln("R-202.NB", "TQ-301.N1", "LODO-2402", route=[[624, 154.5], [624, 270.9], [632, 270.9], [632, 252], [642, 252],
                                                 [642, 262], [660, 262], [660, 218.04]])
ln("R-201.NB", "TQ-301.N1B", "LODO-2403", route=[[464, 154.5], [464, 270.9], [472, 270.9], [472, 252], [482, 252],
                                                  [482, 412], [690, 412], [690, 228.12]])
for tag, xq, xs_, top, n in (("R-201", xq201, 464, top201, "2241"), ("R-202", xq202, 624, top202, "2242")):
    D.append({"from": f"{tag}.NQ", "to": [xs_, 270.9], "route": [[xq, top + 14], [xs_, top + 14]],
              "class": "utility", "number": f"BRUTO-{n}"})
    SEM_ROTULO.append(f"BRUTO-{n}")
eq("P-301", "pd_pump", 705, 108, "EXPEDIÇÃO / RL-05", ["Rubrica FINEP: Bombas (4)"], rotation=180,
   rotulo={"x": 705, "y": 140, "alinh": "C"})
ln("TQ-301.N4", "P-301.in", "LODO-2404", route=[[740, 108]])
va("HV-303", "gate", 665, 108, "RL-05", actuator="hand", rotation=180)
ln("P-301.out", "HV-303.in", "LODO-2405", label=False)
ln("HV-303.out", "TQ-201.N4", "LODO-2406", route=[[645, 108], [645, 94], [272, 94], [272, 177]])
con("BL-05", "out", 800, 92, "BL-05", "BIOFERTILIZANTE", "P-301.out", "process_major", "LODO-2407")
va("HV-304", "gate", 230, 94, "RL-05", actuator="hand", rotation=180)
con("F01C", "out", 180, 94, "F01", "P/ TQ-101", "HV-304.out", "process_major", "LODO-2408", rotation=180)
D.append({"from": [272, 94], "to": "HV-304.in", "class": "process_major", "number": "LODO-2408"})
# --- gás ---
con("G1", "out", 800, 505, "F03", "GAS-01 (IIC)", "HV-115.out", "utility", "BRUTO-2211")
D.append({"from": "HV-215.out", "to": [xg201, 505], "class": "utility", "number": "BRUTO-2221"})
D.append({"from": "HV-225.out", "to": [xg202, 505], "class": "utility", "number": "BRUTO-2231"})
va("HV-116", "gate", 135, 485, "RG-01 / LC", actuator="hand")
con("G2", "out", 190, 485, "F03", "RG-01 GÁS ÁCIDO", "HV-116.out", "utility", "ACID-2241")
D.append({"from": [xg101, 485], "to": "HV-116.in", "class": "utility", "number": "ACID-2241"})
# instrumentos
for t, x, y in (("PIT-111", 66, 300), ("LIT-111", 178, 286), ("AIT-111", 120, 126), ("TIT-111", 150, 112),
                ("AIC-201", 300, 194), ("LIT-201", 300, 168), ("FQIT-201", 495, 126),
                ("PIT-211", 370, 368), ("LIT-211", 505, 352), ("TIT-211", 505, 322),
                ("PIT-221", 530, 372), ("LIT-221", 652, 352), ("TIT-221", 652, 322),
                ("LIT-301", 790, 200)):
    ins(t, x, y)
CON += [{"de": "PIT-111", "ate": [90, 226]}, {"de": "LIT-111", "ate": [150, 226]}, {"de": "AIT-111", "ate": [120, 144]},
        {"de": "AIC-201", "ate": [259, 180]}, {"de": "LIT-201", "ate": [259, 168]}, {"de": "FQIT-201", "ate": [495, 108]},
        {"de": "TIT-111", "ate": [150, 144]}, {"de": "TIT-211", "ate": [452, 322]}, {"de": "TIT-221", "ate": [612, 322]},
        {"de": "PIT-211", "ate": [388, 300]}, {"de": "LIT-211", "ate": [452, 300]},
        {"de": "PIT-221", "ate": [548, 300]}, {"de": "LIT-221", "ate": [612, 300]},
        {"de": "LIT-301", "ate": [766, 200]}]
SIN += [{"de": "AIC-201", "ate": [298, 236], "via": [[312, 194], [312, 236]]}]
TXT += [
    {"texto": "EQUALIZAÇÃO DE GÁS TQ-201 / R-101 (LO)", "x": 168, "y": 228, "altura": 1.9},
    {"texto": "SAÍDA NIVELADA", "x": 167, "y": 190, "altura": 1.9},
    {"texto": "SIFÃO U", "x": 477, "y": 244, "altura": 2.2, "alinh": "C"},
    {"texto": "SIFÃO U", "x": 637, "y": 244, "altura": 2.2, "alinh": "C"},
    {"texto": "COLETOR COMUM DE GÁS - GRUPO IIC (LAC-037)", "x": 300, "y": 529, "altura": 2.5},
]
casa = {
    "areas": [
        {"titulo": "ESTÁGIO ÁCIDO (R-101) E NEUTRALIZAÇÃO (TQ-201) - S05/S09", "x0": 25, "y0": 84, "x1": 340, "y1": 578},
        {"titulo": "ESTÁGIO METANOGÊNICO (R-201 / R-202) - S06/S07/S08", "x0": 346, "y0": 84, "x1": 672, "y1": 578},
        {"titulo": "BIOFERTILIZANTE (TQ-301) - S10/S11", "x0": 678, "y0": 84, "x1": 826, "y1": 578},
    ],
    "simbolos": SIMB, "textos": TXT, "linhas": LIN, "conexoes": CON, "sinais": SIN, "cotas": COT, "sem_rotulo": SEM_ROTULO,
    "quadros": [{
        "titulo": "SET POINTS DE PRESSÃO - CASCATA B (RES-001 REV03, PROPOSTA - AGUARDA RT)",
        "x": 108, "y": 468, "altura": 2.0,
        "colunas": [["ITEM", 150], ["mbar", 72]],
        "linhas": [["Gasômetro GAS-01 (F03) / alívio próprio", "+1,5 a +3 / +4"],
                   ["Operação dos reatores", "+1,5 a +3,5"],
                   ["PAH / PAHH (PIT-x11)", "+5 / +6"],
                   ["PAL / PALL - desliga sopradores e retirada (hardwired)", "+1 / 0"],
                   ["Selo hidráulico SH (vazão plena)", "+8/-3 (+10/-4,5)"],
                   ["Emergência bidirecional PVSV na M2", "+12/-6 (R-101: -4/-5)"],
                   ["Envelope requerido à Fibrais", "+15/-8 (R-101: -6)"],
                   ["Ensaio de estanqueidade", "+6"]],
        "fonte": "Fonte: RES-001 REV03 §8; Bases REV00 critério 10. LAC-031/032/033."},
        {"titulo": "ALOCAÇÃO DE BOCAIS POR REATOR (C1)", "x": 698, "y": 568, "altura": 1.8,
         "colunas": [["BOCAL", 17], ["USO", 111]],  # abaixo do título da área
         "linhas": [["N1-A", "Alimentação c/ tubo de imersão (furo quebra-sifão no gás)"],
                    ["N1-B", "Selo hidráulico SH (+8/-3)"],
                    ["N1-C", "N2 de partida/purga (LC)"],
                    ["N1-D", "Quebra-sifão da coluna de saída / equalização"],
                    ["N2-A", "Saída nivelada (coluna externa)"],
                    ["N2-B / D", "Amostragem / expurgo LC + chave presa"],
                    ["N2-C", "Reserva: retirada por bomba (LAC-039)"],
                    ["N3 2x2\"", "Gás ao coletor / transbordo (LAC-038)"],
                    ["M2 / A4", "Emergência bidirecional / A4 TAMPONAR"]]}],
}
notas = [
    "1. EMISSÃO PRELIMINAR (T.E. A): a S3 (P&ID executivo) da Gen E não foi iniciada e a S1 está bloqueada no Gate 0; "
    "premissas D1-D6 [A VERIFICAR] (CLAUDE.md §4). Diâmetros das linhas pela S1. Não usar para construção.",
    "2. Cascata B (RES-001 REV03, aguarda RT - LAC-033), em mbar: operação +1,5 a +3,5; PIT-x11 com PAH/PAHH +5/+6, PAL +1 e "
    "PALL 0 hardwired (desliga sopradores e retirada); selo SH +8/-3; emergência bidirecional na M2 +12/-6 (R-101 -4/-5); "
    "envelope requerido à Fibrais +15/-8 (R-101 -6). Sem PVRV.",
    "3. Topo de todos os reatores em grupo IIC (coletor comum, LAC-037). Isolamentos do gás travados abertos (LO), sem bloqueio "
    "automático entre reator e alívio. RG-01: desvio do gás ácido do R-101 (LC).",
    "4. Configuração C1 (PARECER_F02): alimentação pelo tampo (N1-A) com tubo de imersão e furo quebra-sifão no espaço de gás, "
    "sem alça nem retenção na entrada; saída nivelada por coluna externa a partir do N2 (+0,30 m) com quebra-sifão ao espaço de gás "
    "(N1-D); N.A. +3,50 / +7,50 m (LAC-005/006). 2ª cascata por gravidade ao TQ-301 com sifão U 500 mmCA, dreno e lavagem (LAC-011).",
    "5. Retirada por bomba admitida com Q máx. 20 m3/h por reator (proposta), permissivos, trips hardwired e chave presa (KL) nos "
    "expurgos N2-D (RES-001 REV03 §5.6). N2 só na partida e na purga pós-evento (LC). N2-C/N2-D ficam no costado (+0,30 m).",
    "6. TQ-201 de neutralização FECHADO e equalizado com o R-101 (LO, grupo IIC): sem stripping de H2S no solo (LAC-009). "
    "AIC-201 (pHIC-201) comanda a DOS-201. P-201 em pulsos alternados (XV-211/XV-221 falha-fechada, FQIT-201), só com o "
    "misturador do reator de destino em operação. RL-05: retorno alcalino TQ-301 > TQ-201/TQ-101 pela P-301.",
    "7. Misturadores verticais de topo (D1) com VFD, selo duplo e motor Ex db IIC T3: potência e flambagem do tampo a verificar "
    "(LAC-007/008/028); a Fibrais mantém 15/10 CV (reunião de 29/10/2026).",
]
F = folha("FLUXOGRAMA DE ENGENHARIA - CASCATA ANAERÓBIA, NEUTRALIZAÇÃO E BIOFERTILIZANTE",
          "TBU-GENE-PID-F02", "3/3", "ILHA 2 - DIGESTÃO")
F["revisao"] = "B"
F["revisoes"].append(["B", "A", "CONFIGURAÇÃO C1 (PARECER_F02)", "IA", "-", "-", "30/10/26"])
F["documentos"].append("PARECER_F02 (30/10/2026) - configuração C1")
spec = {"folha": F,
        "sheet": {"layer_set": "pid", "sheet_size": "A1", "scale": 1.0, "intent": "ThermoBiogasUp Gen E F02"},
        "equipment": E, "valves": V, "instruments": I, "lines": L, "connectors": C, "derivacoes": D,
        "casa": casa, "notas": notas}
salvar("F02.json", spec)
print(len(E), len(V), len(I), len(L), len(C), len(D))
