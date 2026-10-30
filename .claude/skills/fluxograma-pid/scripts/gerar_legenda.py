"""Monta a spec da folha de legenda (F00) a partir das specs das folhas de P&ID.

A legenda mostra só o que as folhas usam: símbolos do catálogo (desenhados pelo próprio servidor,
iguais aos das folhas), símbolos da casa, tipos de linha por serviço, linhas de sinal e conexão,
e quadros fixos de letras ISA-5.1 e de formato de identificação. Quadros extras do projeto
(ex.: lista de equipamentos com rubrica) entram por --quadros.

Uso:
    python scripts/gerar_legenda.py F01.json F02.json --folha folha_F00.json [--quadros q.json] -o F00.json
e depois o gerar_pid.py normal sobre F00.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

NOMES_EQUIP = {
    "tank": "Tanque / reator de teto plano", "vertical_vessel": "Vaso vertical", "horizontal_vessel": "Vaso horizontal",
    "hopper": "Silo / moega", "reactor": "Reator (tampos abaulados)", "column": "Coluna",
    "centrifugal_pump": "Bomba centrífuga", "pd_pump": "Bomba de deslocamento positivo", "compressor": "Compressor",
    "fan": "Soprador / ventilador", "agitator": "Misturador / agitador", "ejector": "Ejetor",
    "filter": "Filtro (vaso)", "strainer_y": "Filtro Y", "shell_tube_hx": "Trocador casco e tubos",
    "plate_hx": "Trocador de placas", "air_cooler": "Resfriador a ar", "fired_heater": "Forno / caldeira",
    "drain_vent": "Respiro / dreno", "reducer": "Redução", "orifice_plate": "Placa de orifício",
    "flange_pair": "Par de flanges", "spectacle_blind": "Figura 8 (raquete)",
}
NOMES_VALV = {"gate": "Válvula gaveta / faca", "globe": "Válvula globo", "ball": "Válvula esfera",
              "butterfly": "Válvula borboleta", "check": "Válvula de retenção", "needle": "Válvula agulha",
              "plug": "Válvula macho", "diaphragm": "Válvula diafragma", "angle": "Válvula angular",
              "relief": "Válvula de segurança / alívio (PSV)", "three_way": "Válvula de 3 vias (divisora)"}
NOMES_ATUADOR = {"hand": "manual", "piston": "atuador pneumático", "motor": "motorizada", "solenoid": "solenoide",
                 "diaphragm": "atuador de diafragma"}
NOMES_INSTR = {("plc", "field"): "Função de CLP (ISA-5.1), campo", ("dcs", "field"): "Função de SDCD, campo",
               ("discrete", "field"): "Instrumento discreto, campo", ("plc", "primary"): "Função de CLP, painel"}

LETRAS_1 = [["A", "Análise (pH, O2, gás)"], ["F", "Vazão"], ["L", "Nível"], ["P", "Pressão / vácuo"],
            ["T", "Temperatura"], ["Z", "Posição"], ["H", "Comando manual"], ["X", "Não classificada"]]
LETRAS_2 = [["I", "Indicador"], ["T", "Transmissor"], ["C", "Controlador"], ["S", "Chave (switch)"],
            ["V", "Válvula / elemento final"], ["A", "Alarme"], ["H / L", "Alto / baixo"],
            ["HH / LL", "Muito alto / muito baixo"], ["E", "Elemento primário"]]


def coletar(specs: list[dict]) -> dict:
    equip, valv, instr, con, casa_s, serv, sinal, conexao = {}, {}, set(), set(), {}, set(), False, False
    import formato_casa as fc

    for sp in specs:
        for it in sp.get("equipment", []):
            if it.get("aparencia"):
                casa_s[it["aparencia"]] = fc.SIMBOLOS_CASA[it["aparencia"]][4]
            else:
                equip.setdefault(it["symbol"], NOMES_EQUIP.get(it["symbol"], it["symbol"]))
        for it in sp.get("valves", []):
            chave = (it["symbol"], it.get("actuator") or "none", it.get("fail"))
            nome = NOMES_VALV.get(it["symbol"], it["symbol"])
            if chave[1] not in ("none", "hand") or it["symbol"] in ("gate",):
                nome += f", {NOMES_ATUADOR.get(chave[1], chave[1])}" if chave[1] != "none" else ""
            if chave[2]:
                nome += f" ({chave[2]} = falha {'fecha' if chave[2] == 'FC' else 'abre'})"
            valv.setdefault(chave, nome)
        for it in sp.get("instruments", []):
            instr.add((it.get("type", "discrete"), it.get("location", "field")))
        for it in sp.get("connectors", []):
            con.add(it.get("direction", "out"))
        for it in sp.get("casa", {}).get("simbolos", []):
            casa_s[it["simbolo"]] = fc.SIMBOLOS_CASA[it["simbolo"]][4]
        for grupo in ("lines", "connectors", "derivacoes"):
            for it in sp.get(grupo, []):
                cod = fc.servico_de(it.get("number"), fc.SERVICOS_PADRAO)
                if cod:
                    serv.add(cod)
        for it in sp.get("casa", {}).get("linhas", []):
            cod = fc.servico_de(it.get("numero"), fc.SERVICOS_PADRAO) or it.get("servico")
            if cod in fc.SERVICOS_PADRAO:
                serv.add(cod)
        sinal |= bool(sp.get("casa", {}).get("sinais"))
        conexao |= bool(sp.get("casa", {}).get("conexoes"))
    return {"equip": equip, "valv": valv, "instr": instr, "con": con, "casa": casa_s, "serv": serv,
            "sinal": sinal, "conexao": conexao}


def montar(specs: list[dict], folha: dict, quadros_extra: list[dict]) -> dict:
    import formato_casa as fc

    u = coletar(specs)
    E, V, I, C, simb, linhas, textos = [], [], [], [], [], [], []
    passo = 13.0
    amostras_equip = {"tank": {"width": 7, "height": 5, "roof": "flat"}, "vertical_vessel": {"width": 4, "height": 6},
                      "horizontal_vessel": {"width": 9, "height": 4}, "hopper": {"width": 6, "height": 7}}

    def secao(titulo, x, y):
        textos.append({"texto": titulo, "x": x, "y": y, "altura": 3.2})
        return y - 10

    # coluna 1: equipamentos do catálogo + símbolos da casa
    x, y = 30, secao("1. EQUIPAMENTOS DE PROCESSO (ISO 10628-2)", 28, 572)
    for k, (sym, nome) in enumerate(sorted(u["equip"].items(), key=lambda t: t[1])):
        it = {"id": f"E{k}", "symbol": sym, "x": x + 10, "y": y}
        if sym in amostras_equip:
            it["params"] = amostras_equip[sym]
        if sym == "drain_vent":
            it["rotation"] = 180
        E.append(it)
        textos.append({"texto": nome, "x": x + 30, "y": y - 1, "altura": 2.5})
        y -= passo
    y = secao("2. SÍMBOLOS DA CASA (sem equivalente no catálogo)", 28, y - 2)
    for k, (s, nome) in enumerate(sorted(u["casa"].items(), key=lambda t: t[1])):
        simb.append({"simbolo": s, "x": x + 10, "y": y, "tag": "", "scale": 0.8 if s in ("esteira", "caldeira",
                                                                                         "gasometro") else 1.0})
        textos.append({"texto": nome, "x": x + 30, "y": y - 1, "altura": 2.5})
        y -= passo
    # coluna 2: válvulas, bolhas, conectores
    x, y = 230, secao("3. VÁLVULAS E ACESSÓRIOS (ISO 10628-2 / ISA-5.1)", 228, 572)
    for k, ((sym, act, fail), nome) in enumerate(sorted(u["valv"].items(), key=lambda t: t[1])):
        it = {"id": f"V{k}", "symbol": sym, "x": x + 10, "y": y}
        if act != "none":
            it["actuator"] = act
        if fail:
            it["fail"] = fail
        V.append(it)
        textos.append({"texto": nome, "x": x + 30, "y": y - 1, "altura": 2.5})
        y -= passo
    y = secao("4. BOLHAS DE INSTRUMENTO (ANSI/ISA-5.1)", 228, y - 2)
    for k, (tp, loc) in enumerate(sorted(u["instr"])):
        I.append({"id": f"I{k}", "type": tp, "location": loc, "x": x + 10, "y": y, "tag": "XX-000"})
        textos.append({"texto": NOMES_INSTR.get((tp, loc), f"{tp}, {loc}"), "x": x + 30, "y": y - 1, "altura": 2.5})
        y -= passo + 3
    for k, d in enumerate(sorted(u["con"])):
        # o servidor exige linha no conector: amostra com um trecho curto até um par de flanges
        E.append({"id": f"FL{k}", "symbol": "flange_pair", "x": x + (34 if d == "in" else -14), "y": y, "scale": 0.6})
        C.append({"id": f"C{k}", "direction": d, "x": x + 10, "y": y, "tag": "F00", "link": "DESTINO",
                  ("to" if d == "in" else "from"): f"FL{k}.{'in' if d == 'in' else 'out'}", "class": "process_minor"})
        textos.append({"texto": f"Conector de folha / limite de bateria ({'chegada' if d == 'in' else 'saída'})",
                       "x": x + 42, "y": y - 1, "altura": 2.5})
        y -= passo
    # coluna 3: tipos de linha
    x, y = 435, secao("5. TIPOS DE LINHA E SERVIÇOS", 433, 572)
    for cod in sorted(u["serv"]):
        linhas.append({"pontos": [[x, y], [x + 30, y]], "servico": cod, "seta": False})
        textos.append({"texto": f"{cod} - {fc.SERVICOS_PADRAO[cod][0]}", "x": x + 35, "y": y - 1, "altura": 2.5})
        y -= 8
    if u["sinal"]:
        linhas.append({"pontos": [[x, y], [x + 30, y]], "servico": "SINAL", "seta": False})
        textos.append({"texto": "Sinal elétrico (intertravamento / controle)", "x": x + 35, "y": y - 1, "altura": 2.5})
        y -= 8
    if u["conexao"]:
        linhas.append({"pontos": [[x, y], [x + 30, y]], "servico": "CONEXAO", "seta": False})
        textos.append({"texto": "Conexão do instrumento ao processo", "x": x + 35, "y": y - 1, "altura": 2.5})
        y -= 8
    linhas.append({"pontos": [[x, y], [x + 12, y]], "servico": "LODO", "seta": False})
    linhas.append({"pontos": [[x + 18, y], [x + 30, y]], "servico": "LODO", "seta": False})
    linhas.append({"pontos": [[x + 15, y - 5], [x + 15, y + 5]], "servico": "AGUA", "seta": False})
    textos.append({"texto": "Cruzamento sem conexão: a linha de menor hierarquia é interrompida",
                   "x": x + 35, "y": y - 1, "altura": 2.5})
    y -= 12
    quadros = [
        {"titulo": "6. ISA-5.1 - PRIMEIRA LETRA", "x": 640, "y": 576, "altura": 2.6,
         "colunas": [["LETRA", 22], ["VARIÁVEL MEDIDA", 90]], "linhas": LETRAS_1},
        {"titulo": "7. ISA-5.1 - LETRAS SUBSEQUENTES", "x": 640, "y": 504, "altura": 2.6,
         "colunas": [["LETRA", 22], ["FUNÇÃO", 90]], "linhas": LETRAS_2},
        {"titulo": "8. FORMATO DE IDENTIFICAÇÃO", "x": 640, "y": 424, "altura": 2.4,
         "colunas": [["ITEM", 28], ["FORMATO / EXEMPLO", 158]],
         "linhas": [["Instrumento", "LETRAS-MALHA: PIT-111 = P pressão, I indicador, T transmissor; malha 111 (R-101)"],
                    ["Equipamento", "PREFIXO-ÁREA+SEQ: R-201, TQ-101, P-301; reserva com sufixo A/B"],
                    ["Válvula", "HV manual, XV on-off, PSV segurança, PVSV emergência; LO/LC travada aberta/fechada; KL chave presa"],
                    ["Linha", "SERVIÇO-SEQUENCIAL: LODO-1103; DN e material conforme memorial (S1)"],
                    ["Conector", "FOLHA + destino (ex.: F02 / P/ R-101)"]]},
    ]
    for q in quadros_extra:
        quadros.append(q)
    casa = {"simbolos": simb, "linhas": linhas, "textos": textos, "quadros": quadros}
    return {"folha": folha, "sheet": {"layer_set": "pid", "sheet_size": "A1", "scale": 1.0, "intent": "legenda"},
            "equipment": E, "valves": V, "instruments": I, "lines": [], "connectors": C, "casa": casa,
            "notas": folha.pop("notas", [])}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("specs", nargs="+", type=Path)
    ap.add_argument("--folha", type=Path, required=True, help="JSON com o bloco 'folha' (e 'notas') da F00")
    ap.add_argument("--quadros", type=Path, help="JSON com lista de quadros extras")
    ap.add_argument("-o", "--saida", type=Path, required=True)
    a = ap.parse_args()
    specs = [json.loads(p.read_text(encoding="utf-8")) for p in a.specs]
    folha = json.loads(a.folha.read_text(encoding="utf-8"))
    extra = json.loads(a.quadros.read_text(encoding="utf-8")) if a.quadros else []
    a.saida.write_text(json.dumps(montar(specs, folha, extra), ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"legenda: {a.saida}")


if __name__ == "__main__":
    main()
