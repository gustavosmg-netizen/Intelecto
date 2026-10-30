"""Spec da F01 Gen E - recepção, pré-tratamento térmico e diluição (Ilha 1)."""
from _comum import folha, noz, salvar

E, V, I, L, C, D = [], [], [], [], [], []


def eq(id, sym, x, y, desc, dados=None, semtag=False, **kw):
    item = dict(id=id, symbol=sym, x=x, y=y, desc=desc, **({"dados": dados} if dados else {}), **kw)
    if not semtag:
        item["tag"] = id
    E.append(item)


def va(id, sym, x, y, desc=None, **kw):
    V.append(dict(id=id, symbol=sym, x=x, y=y, tag=id, **({"desc": desc} if desc else {}), **kw))


def ins(tag, x, y, tipo="plc"):
    I.append(dict(id=tag, type=tipo, location="field", x=x, y=y, tag=tag))


def ln(a, b, num, cls="process_major", **kw):
    L.append({"from": a, "to": b, "class": cls, "number": num, **kw})


# --- recepção (S01) ---
eq("BAL-101", "horizontal_vessel", 112, 505, "BALANÇA DE RECEPÇÃO", aparencia="balanca",
   params={"width": 14, "height": 6, "nozzles": noz(("N1", "left", 0.5), ("N2", "right", 0.5))})
eq("SIL-101", "hopper", 165, 515, "SILO / MOEGA DE RECEPÇÃO", params={"width": 12, "height": 15})
eq("ES-101", "horizontal_vessel", 240, 470, "ESTEIRA DE ALIMENTAÇÃO", aparencia="esteira",
   params={"width": 22, "height": 6, "nozzles": noz(("N1", "left", 0.5), ("N2", "right", 0.5))})
eq("TRI-101", "horizontal_vessel", 330, 482, "TRITURADOR DE DOIS EIXOS", ["Rubrica FINEP: Triturador (1)"],
   aparencia="triturador", params={"width": 15, "height": 14, "nozzles": noz(("N1", "top", 0.5), ("N2", "bottom", 0.5))})
va("DV-101", "three_way", 330, 428, "DIVISOR 70/30", actuator="motor", rotation=270)
# --- pré-tratamento térmico (S03/S04) ---
eq("TA-101", "filter", 98, 150, "TRATAMENTO DE ÁGUA DA CALDEIRA", ["Rubrica FINEP (1)"])
eq("CL-101", "fired_heater", 162, 158, "CALDEIRA", ["Caldemax flamotubular, 800 kgv/h",
   "PMTA 8,0 / trab. 7,0 kgf/cm2 - GLP", "Usada (2002); NR-13 (LAC-004)"], aparencia="caldeira")
eq("AC-101", "horizontal_vessel", 110, 270, "ACUMULADOR DE VAPOR", ["Vaso NR-13"],
   params={"width": 26, "height": 10, "nozzles": noz(("N1", "left", 0.5), ("N2", "right", 0.5), ("N3", "top", 0.5))})
eq("EV-101", "vertical_vessel", 255, 300, "REATOR DE EXPLOSÃO A VAPOR", ["6,5 bar(g) / 168 °C (proposta)",
   "Batelada, 30% da carga (LAC-003)", "Vaso NR-13"],
   params={"width": 14, "height": 24, "nozzles": noz(("N1", "top", 0.3), ("N2", "top", 0.75), ("N3", "left", 0.7),
                                                     ("N4", "bottom", 0.5))})
eq("TQ-103", "vertical_vessel", 335, 165, "VASO FLASH", ["Descompressão pós-explosão"],
   params={"width": 14, "height": 24, "nozzles": noz(("N1", "top", 0.3), ("N2", "top", 0.8), ("N3", "right", 0.25))})
eq("CD-101", "shell_tube_hx", 405, 250, "CONDENSADOR DO FLASH", rotulo={"x": 392, "y": 268, "alinh": "R"})
eq("CH-101", "drain_vent", 162, 192, "CHAMINÉ", rotation=180)
eq("RS-151", "drain_vent", 130, 318, None, rotation=180, semtag=True)
eq("RS-152", "drain_vent", 282, 364, None, rotation=180, semtag=True)
va("HV-151", "gate", 160, 270, actuator="hand")
va("XV-152", "ball", 195, 270, "VAPOR P/ EV-101", actuator="piston", fail="FC")
va("XV-153", "ball", 255, 240, "DESCOMPRESSÃO RÁPIDA", actuator="piston", fail="FC", rotation=270)
va("PSV-151", "relief", 110, 306)
va("PSV-152", "relief", 262, 352)
# --- diluição (S02) ---
eq("TQ-101", "tank", 600, 330, "TANQUE DE DILUIÇÃO E HOMOGENEIZAÇÃO",
   ["Fibrais 315C-25: Øint 3,00 x Hcil 2,60 m + cone 0,80 m", "N1 4x6\" +3,82 | N2 4x6\" +1,61 | dreno 6\" +0,50",
    "70% frio + 30% pós-flash: T <= 35-38 °C"],
   params={"width": 45, "height": 55, "roof": "flat",
           "nozzles": noz(("N1", "top", 0.2), ("N2", "left", 0.8), ("N3", "left", 0.65), ("N4", "left", 0.5),
                          ("N5", "bottom", 0.5))})
eq("AG-101", "agitator", 600, 385, "MISTURADOR", ["Fibrais: 3 CV / 45 rpm, AISI 304"])
eq("MAC-101", "strainer_y", 600, 245, "MACERADOR EM LINHA", ["A VERIFICAR (LAC-016)"], aparencia="macerador",
   rotation=270)
eq("P-101", "pd_pump", 680, 200, "ALIMENTAÇÃO R-101", ["Rubrica FINEP: Bombas (4)"])
eq("P-102", "pd_pump", 680, 150, "BY-PASS R-101 / MANIFOLD", ["Rotas RL-03 e RL-07"])
va("VR-101", "check", 712, 200)
va("HV-102", "gate", 742, 200, actuator="hand")
va("VR-102", "check", 712, 150)
va("HV-103", "gate", 742, 150, actuator="hand")
# instrumentos
for t, x, y in (("PIT-151", 60, 300), ("PIT-152", 305, 315), ("TIT-152", 305, 285), ("PIT-153", 375, 126),
                ("LIT-101", 682, 368), ("TIT-101", 682, 338), ("LSLL-101", 682, 308), ("FIT-101", 772, 228),
                ("FIT-102", 372, 452)):
    ins(t, x, y)
# linhas de processo
ln("BAL-101.N2", "SIL-101.N1", "SOL-1001", "process_minor", route=[[140, 505], [140, 555], [165, 555]])
ln("SIL-101.N2", "ES-101.N1", "SOL-1002", "process_minor", route=[[165, 470]])
ln("ES-101.N2", "TRI-101.N1", "SOL-1003", "process_minor", route=[[285, 470], [285, 520], [330, 520]])
ln("TRI-101.N2", "DV-101.in", "SOL-1004", "process_minor")
ln("DV-101.out", "TQ-101.N1", "SOL-1005", "process_minor", route=[[330, 410], [573, 410]])
ln("DV-101.branch", "EV-101.N1", "SOL-1006", "process_minor", route=[[295, 428], [295, 392], [249.4, 392]])
ln("TA-101.out", "CL-101.in", "AT-1201", "utility")
ln("CL-101.out", "AC-101.N1", "VP-1301", route=[[190, 162], [190, 220], [62, 220], [62, 270]])
ln("CL-101.flue", "CH-101.in", "GC-1302", "process_minor", label=False)
ln("AC-101.N2", "HV-151.in", "VP-1302"); ln("HV-151.out", "XV-152.in", "VP-1302")
ln("XV-152.out", "EV-101.N3", "VP-1302")
ln("AC-101.N3", "PSV-151.in", "VP-1303", label=False); ln("PSV-151.out", "RS-151.in", "ALIV-1304", "utility", label=False)
ln("EV-101.N2", "PSV-152.in", "VP-1305", label=False); ln("PSV-152.out", "RS-152.in", "ALIV-1306", "utility", label=False)
ln("EV-101.N4", "XV-153.in", "LODO-1101"); ln("XV-153.out", "TQ-103.N1", "LODO-1101", route=[[255, 215], [329.4, 215]])
ln("TQ-103.N2", "CD-101.shell_in", "CD-1307", "utility", route=[[343.4, 280], [397, 280]])
ln("TQ-103.N3", "TQ-101.N2", "LODO-1102", route=[[470, 153], [470, 363]])
ln("TQ-101.N5", "MAC-101.in", "LODO-1103")
ln("MAC-101.out", "P-101.in", "LODO-1103", route=[[600, 200]])
ln("P-101.out", "VR-101.in", "LODO-1104"); ln("VR-101.out", "HV-102.in", "LODO-1104")
ln("P-102.out", "VR-102.in", "LODO-1105"); ln("VR-102.out", "HV-103.in", "LODO-1105")


def con(id, d, x, y, tag, lk, ref, cls, num, **kw):
    C.append(dict(id=id, direction=d, x=x, y=y, tag=tag, link=lk,
                  **{("to" if d == "in" else "from"): ref, "class": cls, "number": num}, **kw))


con("BL-RES", "in", 45, 505, "BL-RES", "RESÍDUO 2 t/d", "BAL-101.N1", "process_minor", "SOL-1000")
con("BL-01", "in", 497, 346.5, "BL-01", "ÁGUA DE REDE", "TQ-101.N3", "utility", "AGUA-1201")
con("BL-02", "in", 45, 150, "BL-02", "ÁGUA P/ CALDEIRA", "TA-101.in", "utility", "AGUA-1202")
con("F02A", "in", 497, 330, "F02", "RL-05 RETORNO P-301", "TQ-101.N4", "process_major", "LODO-1106")
con("F02B", "out", 800, 200, "F02", "P/ R-101", "HV-102.out", "process_major", "LODO-1104")
con("F02C", "out", 800, 150, "F02", "RL-03/RL-07", "HV-103.out", "process_major", "LODO-1105")
con("DR-1", "out", 445, 222, "DRENO", "CONDENSADO", "CD-101.shell_out", "utility", "CD-1308")
D.append({"from": [600, 200], "to": "P-102.in", "route": [[600, 150]], "class": "process_major", "number": "LODO-1103"})

casa = {
    "areas": [
        {"titulo": "RECEPÇÃO, PESAGEM E TRITURAÇÃO (S01)", "x0": 25, "y0": 438, "x1": 455, "y1": 578},
        {"titulo": "PRÉ-TRATAMENTO TÉRMICO - EXPLOSÃO A VAPOR, CALDEIRA E ÁGUA (S03/S04) - ILHA 1",
         "x0": 25, "y0": 90, "x1": 455, "y1": 432},
        {"titulo": "DILUIÇÃO E HOMOGENEIZAÇÃO - TQ-101 (S02)", "x0": 462, "y0": 90, "x1": 826, "y1": 578},
    ],
    "quadros": [{
        "titulo": "BASE DE PROCESSO DE REFERÊNCIA (A RECALCULAR NA S1)",
        "x": 500, "y": 562, "altura": 2.2,
        "colunas": [["GRANDEZA", 120], ["VALOR DE REFERÊNCIA", 105], ["SITUAÇÃO", 95]],
        "linhas": [["Resíduo (base úmida)", "2.000 kg/d; ST 24,5%; SV 89% ST", "LAC-002"],
                   ["Diluição", "~7,22 m3/d a 8% ST", "recalcular c/ fração térmica"],
                   ["Fração p/ explosão a vapor (DV-101)", "30% (hipótese)", "LAC-003"],
                   ["EV-101 (explosão a vapor)", "6,5 bar(g) / 168 °C", "proposta Gen E"],
                   ["CL-101 (pressão de trabalho / PMTA)", "7,0 / 8,0 kgf/cm2", "as-built (LAC-004)"],
                   ["TQ-101 após têmpera (RL-02)", "<= 35-38 °C", "proposta Gen E"],
                   ["Biogás bruto (meta)", "~306 Nm3/d", "retrocálculo; BMP"]],
        "fonte": "Fonte: Bases e Critérios REV00 §3-4; Matriz S01-S04."}],
    "linhas": [
        {"pontos": [[152, 108], [152, 144]], "numero": "GLP-1401", "rotulo": False},
        {"pontos": [[172, 108], [172, 144]], "numero": "TRAT-1402", "rotulo": False},
    ],
    "textos": [
        {"texto": "TRIP P-101/P-102", "x": 704, "y": 262, "altura": 2.2},
        {"texto": "BL-03 GLP", "x": 152, "y": 102, "altura": 2.5, "alinh": "R"},
        {"texto": "F03 BIOGÁS / TAIL-GAS (S22)", "x": 174, "y": 102, "altura": 2.5},
        {"texto": "ÁGUA DE RESFRIAMENTO DO CD-101 NA S1 (LAC-003)", "x": 372, "y": 300, "altura": 2.2},
        {"texto": "RL-02: TRANSFERÊNCIA TQ-103 > TQ-101 (MEIO NA S1)", "x": 474, "y": 140, "altura": 2.2},
    ],
    "conexoes": [
        {"de": "PIT-151", "ate": [84, 276]}, {"de": "PIT-152", "ate": [269, 315]}, {"de": "TIT-152", "ate": [269, 285]},
        {"de": "PIT-153", "ate": [349, 146]}, {"de": "LIT-101", "ate": [645, 368]}, {"de": "TIT-101", "ate": [645, 338]},
        {"de": "LSLL-101", "ate": [645, 308]}, {"de": "FIT-101", "ate": [772, 200]}, {"de": "FIT-102", "ate": [330, 452]},
    ],
    "sinais": [
        {"de": "LSLL-101", "ate": [690, 208], "via": [[700, 308]]},
    ],
}

notas = [
    "1. EMISSÃO PRELIMINAR (T.E. A): a S3 (P&ID executivo) do Projeto Executivo Gen E não foi iniciada e a S1 está bloqueada no Gate 0. "
    "As premissas D1-D6 estão [A VERIFICAR] (CLAUDE.md §4). Não usar para construção.",
    "2. Diâmetros das linhas não indicados: dependem do memorial de cálculo da S1 (LAC-003/006). Numeração de linha: SERVIÇO-SEQUENCIAL.",
    "3. CL-101 Caldemax 800 kgv/h, PMTA 8,0 kgf/cm², usada (2002); propriedade e compra indefinidas (LAC-004); "
    "inspeção extraordinária NR-13 após mudança de local. Dual-fuel biogás/tail-gas proposto (S22, LAC-021).",
    "4. EV-101 a 6,5 bar(g)/168 °C sobre 30% da carga (fração: LAC-003). CL-101, AC-101 e EV-101 sob NR-13. "
    "Severidade log R0 e margem de pressão caldeira > EV-101 a verificar na S1.",
    "5. DV-101: 70% direto ao TQ-101 e 30% ao EV-101. RL-01 (by-pass térmico) = 100% direto com o EV-101 fora. "
    "RL-02: têmpera pós-flash no TQ-101 (T <= 35-38 °C, TIT-101 com alarme alto).",
    "6. MAC-101 (macerador úmido em linha) não consta na Relação de Itens FINEP (LAC-016). Balança, esteira, triturador e "
    "caldeira com símbolo da casa; sólidos sem tubulação.",
    "7. P-101/P-102: rubrica FINEP 'Bombas (4) - recirculação de digestato e purga de lodo'. RL-03 (by-pass do R-101) e "
    "RL-07 (manifold P-102 <> P-201) seguem na F02. LSLL-101 desarma P-101/P-102.",
]

spec = {"folha": folha("FLUXOGRAMA DE ENGENHARIA - RECEPÇÃO, PRÉ-TRATAMENTO TÉRMICO E DILUIÇÃO",
                       "TBU-GENE-PID-F01", "2/3", "ILHA 1 - TERMOQUÍMICA"),
        "sheet": {"layer_set": "pid", "sheet_size": "A1", "scale": 1.0, "intent": "ThermoBiogasUp Gen E F01"},
        "equipment": E, "valves": V, "instruments": I, "lines": L, "connectors": C, "derivacoes": D,
        "casa": casa, "notas": notas}
salvar("F01.json", spec)
print(len(E), len(V), len(I), len(L), len(C))
