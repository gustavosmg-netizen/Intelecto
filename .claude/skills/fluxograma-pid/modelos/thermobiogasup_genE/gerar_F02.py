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


def reator(tag, cx, w, h, dados, num, n2, nivel, nivel_txt, coluna=True):
    """Reator PRFV com bocais: topo (gás, selo, N2), costado (N2-A entrada, N2-B saída), fundo (N2-C, N2-D)."""
    W, H = 2 * w, 2 * h
    cy = Y0 + H / 2
    # fundo e tampo planos (as-built Fibrais): tanque de teto plano
    eq(tag, "tank", cx, cy, dados[0], dados[1:], rotulo={"x": cx, "y": Y0 + H * nivel - 5, "alinh": "C"},
       params={"width": w, "height": h, "roof": "flat", "nozzles": noz(
           ("NF", "top", 0.06), ("NG", "top", 0.18), ("NS", "top", 0.32), ("NN", "top", 0.66), ("NB", "right", 0.03),
           ("NC", "bottom", 0.2), ("ND", "bottom", 0.8),
           *((("NQ", "top", 0.95),) if coluna else (("NE", "bottom", 0.5),)))})
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
                                  3.5 / 4.7, "+3,50 (LIC)", coluna=False)
# alimentação pelo tampo (N1-A): válvula falha-fechada no solo, subida externa e tubo de imersão
va("XV-111", "ball", 64, 120, "ALIM. R-101", actuator="piston", fail="FC", rotation=90)
con("F01A", "in", 34, 94, "F01", "DE P-101", "XV-111.in", "process_major", "LODO-2101")
ln("XV-111.out", "R-101.NF", "LODO-2101", route=[[64, top101 + 14], [xf101, top101 + 14]])
# transferência DIRETA (sem TQ-201): P-201 aspira do R-101 pelo N2-A; o gás deslocado no metanogênico
# volta ao R-101 pelo coletor comum (transferência neutra em gás)
eq("P-201", "pd_pump", 225, 108, "TRANSFERÊNCIA DIRETA", ["Q <= 20 m3/h (proposta)", "Reserva: P-102 (RL-07)"],
   rotulo={"x": 225, "y": 131, "alinh": "C"})
ln("R-101.NB", "P-201.in", "LODO-2105", route=[[176, 152.3], [176, 108]])
va("VR-201", "check", 255, 108)
ln("P-201.out", "VR-201.in", "LODO-2106")
eq("MS-201", "filter", 302, 108, "MISTURADOR ESTÁTICO", aparencia="misturador_estatico",
   rotulo={"x": 302, "y": 100, "alinh": "C"})
ln("VR-201.out", "MS-201.in", "LODO-2106")
# neutralização em linha, sob demanda: dosagem a montante do misturador estático (sem tanque)
eq("DOS-201", "pd_pump", 258, 145, "ALCALINIZANTE", ["NaHCO3 sob demanda", "Rubrica FINEP: dosadora (4)"],
   rotulo={"x": 258, "y": 175, "alinh": "C"})
con("BL-04", "in", 218, 145, "BL-04", "ALCALINIZANTE", "DOS-201.in", "utility", "QUIM-2104")
D.append({"from": "DOS-201.out", "to": [275, 108], "route": [[275, 145]], "class": "utility", "number": "QUIM-2104"})
# sucção reserva da P-102 (RL-07 bidirecional) pelo N2-C, travada fechada
va("HV-118", "gate", 120, Y0 - 18, "LC", actuator="hand", rotation=270, scale=0.6,
   rotulo={"x": 124, "y": Y0 - 24, "alinh": "L"})
ln("R-101.NE", "HV-118.in", "LODO-2110", label=False)
C.append(dict(id="F01D", direction="out", x=120, y=Y0 - 32, tag="F01", rotation=270, scale=0.5,
              **{"from": "HV-118.out", "class": "process_major", "number": "LODO-2110"}))
SEM_ROTULO.append("LODO-2110")
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
ln("MS-201.out", "XV-221.in", "LODO-2106", route=[[524, 108]])
ln("XV-211.out", "R-201.NF", "LODO-2107", route=[[364, top201 + 14], [xf201, top201 + 14]])
ln("XV-221.out", "R-202.NF", "LODO-2108", route=[[524, top202 + 14], [xf202, top202 + 14]])
D.append({"from": [364, 108], "to": "XV-211.in", "class": "process_major", "number": "LODO-2107"})
# RL-07: manifold P-102 <> P-201
va("HV-202", "gate", 332, 158, "RL-07", actuator="hand")
con("F01B", "in", 292, 158, "F01", "DE P-102", "HV-202.in", "process_major", "LODO-2109")
D.append({"from": "HV-202.out", "to": [344, 108], "route": [[344, 158]], "class": "process_major", "number": "LODO-2109"})
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
D.append({"from": "HV-303.out", "to": [285, 108], "route": [[645, 108], [645, 94], [285, 94]],
          "class": "process_major", "number": "LODO-2406"})
con("BL-05", "out", 800, 92, "BL-05", "BIOFERTILIZANTE", "P-301.out", "process_major", "LODO-2407")
va("HV-304", "gate", 250, 94, "RL-05", actuator="hand", rotation=180)
con("F01C", "out", 205, 94, "F01", "P/ TQ-101", "HV-304.out", "process_major", "LODO-2408", rotation=180)
D.append({"from": [285, 94], "to": "HV-304.in", "class": "process_major", "number": "LODO-2408"})
# --- gás ---
con("G1", "out", 800, 505, "F03", "GAS-01 (IIC)", "HV-115.out", "utility", "BRUTO-2211")
D.append({"from": "HV-215.out", "to": [xg201, 505], "class": "utility", "number": "BRUTO-2221"})
D.append({"from": "HV-225.out", "to": [xg202, 505], "class": "utility", "number": "BRUTO-2231"})
va("HV-116", "gate", 135, 485, "RG-01 / LC", actuator="hand")
con("G2", "out", 190, 485, "F03", "RG-01 GÁS ÁCIDO", "HV-116.out", "utility", "ACID-2241")
D.append({"from": [xg101, 485], "to": "HV-116.in", "class": "utility", "number": "ACID-2241"})
# instrumentos
for t, x, y in (("PIT-111", 66, 300), ("LIC-111", 178, 286), ("AIT-111", 40, 178), ("TIT-111", 40, 234),
                ("LSLL-111", 40, 206), ("LSHH-111", 40, 150), ("ZSO-115", 40, 264), ("PSL-201", 190, 124),
                ("AIC-201", 322, 132), ("FQIT-201", 495, 126),
                ("PIT-211", 370, 368), ("LIT-211", 505, 352), ("TIT-211", 505, 322),
                ("PIT-221", 530, 372), ("LIT-221", 652, 352), ("TIT-221", 652, 322),
                ("LIT-301", 790, 200)):
    ins(t, x, y)
CON += [{"de": "PIT-111", "ate": [90, 226]}, {"de": "LIC-111", "ate": [150, 226]}, {"de": "AIT-111", "ate": [84, 178]},
        {"de": "LSLL-111", "ate": [84, 206]}, {"de": "LSHH-111", "ate": [84, 162]}, {"de": "PSL-201", "ate": [176, 124]},
        {"de": "AIC-201", "ate": [322, 108]}, {"de": "FQIT-201", "ate": [495, 108]},
        {"de": "TIT-111", "ate": [84, 218]}, {"de": "TIT-211", "ate": [452, 322]}, {"de": "TIT-221", "ate": [612, 322]},
        {"de": "PIT-211", "ate": [388, 300]}, {"de": "LIT-211", "ate": [452, 300]},
        {"de": "PIT-221", "ate": [548, 300]}, {"de": "LIT-221", "ate": [612, 300]},
        {"de": "LIT-301", "ate": [766, 200]}]
SIN += [{"de": "AIC-201", "ate": [266, 141]},
        {"de": "LIC-111", "ate": [225, 116], "via": [[196, 286], [196, 116]]}]
TXT += [
    {"texto": "TRANSFERÊNCIA NEUTRA EM GÁS: R-101 <> R-201/202 PELO COLETOR", "x": 201, "y": 215, "altura": 1.9},
    {"texto": "(sem TQ-201; trips da RES-001 §5.6 na P-201)", "x": 201, "y": 211, "altura": 1.9},
    {"texto": "SIFÃO U", "x": 477, "y": 244, "altura": 2.2, "alinh": "C"},
    {"texto": "SIFÃO U", "x": 637, "y": 244, "altura": 2.2, "alinh": "C"},
    {"texto": "COLETOR COMUM DE GÁS - GRUPO IIC (LAC-037)", "x": 300, "y": 529, "altura": 2.5},
]
casa = {
    "areas": [
        {"titulo": "ESTÁGIO ÁCIDO (R-101) E TRANSFERÊNCIA COM NEUTRALIZAÇÃO EM LINHA - S05/S09", "x0": 25, "y0": 84, "x1": 340, "y1": 578},
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
        {"titulo": "ALOCAÇÃO DE BOCAIS (C4)", "x": 698, "y": 568, "altura": 1.6,
         "colunas": [["BOCAL", 13], ["R-101", 55], ["R-201 / R-202", 60]],
         "linhas": [["N1-A", "Alimentação, tubo de imersão", "Alimentação, tubo de imersão"],
                    ["N1-B", "Selo SH-101", "Selo SH-201/202"],
                    ["N1-C", "N2 partida/purga (LC)", "N2 partida/purga (LC)"],
                    ["N1-D", "Reserva: transbordo (LAC-038)", "Quebra-sifão da coluna"],
                    ["N2-A", "Sucção P-201 (Qmáx, trips)", "Saída nivelada (coluna)"],
                    ["N2-B", "Amostragem", "Amostragem"],
                    ["N2-C", "Sucção reserva P-102 (LC)", "Reserva (LAC-039)"],
                    ["N2-D", "Expurgo LC + chave presa", "Expurgo LC + chave presa"],
                    ["N3 2x2\"", "Gás ao coletor", "Gás ao coletor"],
                    ["M2 / A4", "Emergência / A4 TAMPONAR", "Emergência / A4 TAMPONAR"]]}],
}
notas = [
    "1. EMISSÃO PRELIMINAR (T.E. A): a S3 (P&ID executivo) da Gen E não foi iniciada e a S1 está bloqueada no Gate 0; "
    "premissas D1-D6 [A VERIFICAR] (CLAUDE.md §4). Diâmetros das linhas pela S1. Não usar para construção.",
    "2. Cascata B (RES-001 REV03, aguarda RT - LAC-033), em mbar: operação +1,5 a +3,5; PIT-x11 com PAH/PAHH +5/+6, PAL +1 e "
    "PALL 0 hardwired (desliga sopradores e retirada); selo SH +8/-3; emergência bidirecional na M2 +12/-6 (R-101 -4/-5); "
    "envelope requerido à Fibrais +15/-8 (R-101 -6). Sem PVRV.",
    "3. Topo de todos os reatores em grupo IIC (coletor comum, LAC-037). Isolamentos do gás travados abertos (LO), sem bloqueio "
    "automático entre reator e alívio. RG-01: desvio do gás ácido do R-101 (LC).",
    "4. Configuração C4 (PARECER_F02 REV01): SEM TQ-201. P-201 aspira do R-101 (N2-A) e alimenta R-201/202 pelo tampo (tubo de "
    "imersão). A transferência é neutra em gás: o volume deslocado no metanogênico volta ao R-101 pelo coletor comum. R-101 com "
    "nível controlado (LIC-111) em vez de transbordo; R-201/202 com saída nivelada e quebra-sifão ao espaço de gás.",
    "5. Retirada por bomba admitida com Q máx. 20 m3/h por reator (proposta), permissivos, trips hardwired e chave presa (KL) nos "
    "expurgos N2-D (RES-001 REV03 §5.6). N2 só na partida e na purga pós-evento (LC). N2-C/N2-D ficam no costado (+0,30 m).",
    "6. Neutralização em linha, sob demanda: DOS-201 (NaHCO3) a montante do misturador estático MS-201, AIC-201 a jusante; RL-05 "
    "(digestato) opcional. P-201: permissivos ZSO-115 (gás do R-101 ligado), LSLL-111, LSHH do destino; trips PALL do R-101, "
    "PSL-201 na sucção e PAHH (para também a DOS-201). P-102 é reserva instalada da P-201 pelo N2-C (RL-07).",
    "7. Misturadores verticais de topo (D1) com VFD, selo duplo e motor Ex db IIC T3: potência e flambagem do tampo a verificar "
    "(LAC-007/008/028); a Fibrais mantém 15/10 CV (reunião de 29/10/2026).",
]
F = folha("FLUXOGRAMA DE ENGENHARIA - CASCATA ANAERÓBIA COM NEUTRALIZAÇÃO EM LINHA E BIOFERTILIZANTE",
          "TBU-GENE-PID-F02", "3/3", "ILHA 2 - DIGESTÃO")
F["revisao"] = "B"
F["revisoes"].append(["B", "A", "CONFIGURAÇÃO C1 (PARECER_F02)", "IA", "-", "-", "30/10/26"])
F["revisoes"].append(["C", "A", "CONFIGURAÇÃO C4 - SEM TQ-201 (PARECER REV01)", "IA", "-", "-", "30/10/26"])
F["revisao"] = "C"
F["documentos"].append("PARECER_F02 REV01 (30/10/2026) - configuração C4")
spec = {"folha": F,
        "sheet": {"layer_set": "pid", "sheet_size": "A1", "scale": 1.0, "intent": "ThermoBiogasUp Gen E F02"},
        "equipment": E, "valves": V, "instruments": I, "lines": L, "connectors": C, "derivacoes": D,
        "casa": casa, "notas": notas}
salvar("F02.json", spec)
print(len(E), len(V), len(I), len(L), len(C), len(D))
