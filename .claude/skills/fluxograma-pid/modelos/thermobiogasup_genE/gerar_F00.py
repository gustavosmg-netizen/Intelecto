"""F00 Gen E - legenda, simbologia, lista de equipamentos com rubrica FINEP e notas gerais."""
import json
import subprocess
import sys
from pathlib import Path

from _comum import folha

AQUI = Path(__file__).resolve().parent
# Rubrica FINEP (Relação de Itens de 06/05/2026; Bases REV00 §2; Matriz S0). "Contrapartida" = fora da relação.
RUBRICA = {
    "BAL-101": "Contrapartida", "SIL-101": "Contrapartida", "ES-101": "Contrapartida",
    "TRI-101": "Triturador (1)", "DV-101": "Contrapartida", "TA-101": "Tratamento de água da caldeira (1)",
    "CL-101": "Caldeira (1) - compra indefinida (LAC-004)", "AC-101": "Planta de explosão a vapor - a verificar",
    "EV-101": "Planta de explosão a vapor (1)", "TQ-103": "Planta de explosão a vapor - a verificar",
    "CD-101": "Planta de explosão a vapor - a verificar", "CH-101": "Contrapartida",
    "TQ-101": "Tanques (3)", "AG-101": "Incluso na proposta Fibrais (pago)", "MAC-101": "Não consta (LAC-016)",
    "P-101": "Bombas (4)", "P-102": "Bombas (4)", "P-201": "Bombas (4)", "P-301": "Bombas (4)",
    "R-101": "Biodigestores (5)", "R-201": "Biodigestores (5)", "R-202": "Biodigestores (5)",
    "TQ-201": "Tanques (3) - neutralização (Formulário)", "TQ-301": "Tanque de digestato excluído (LAC-012)",
    "AG-200": "Sem item próprio", "DOS-201": "Bomba dosadora (4)", "FCA-201": "Contrapartida",
    "SH-101": "Contrapartida", "SH-201": "Contrapartida", "SH-202": "Contrapartida",
    "AG-R101": "Sem item próprio (LAC-008)", "AG-R201": "Sem item próprio (LAC-008)",
    "AG-R202": "Sem item próprio (LAC-008)",
    "PVSV-111": "Contrapartida (Fibrais garante - ART)", "PVSV-211": "Contrapartida (Fibrais garante - ART)",
    "PVSV-221": "Contrapartida (Fibrais garante - ART)",
}
NOMES_AG = {"AG-R101": "Misturador vertical de topo do R-101", "AG-R201": "Misturador vertical de topo do R-201",
            "AG-R202": "Misturador vertical de topo do R-202"}

linhas = []
for nome in ("F01", "F02"):
    sp = json.loads((AQUI / f"{nome}.json").read_text(encoding="utf-8"))
    for it in sp["equipment"]:
        tag = it.get("tag") or it["id"]
        if it["symbol"] == "drain_vent" and tag not in RUBRICA:
            continue
        desc = it.get("desc") or NOMES_AG.get(tag, "")
        dados = "; ".join(it.get("dados", []))
        linhas.append([tag, desc.capitalize() if desc.isupper() else desc, nome, dados, RUBRICA.get(tag, "-")])
    for it in sp.get("casa", {}).get("simbolos", []):
        if it.get("tag", "").startswith("PVSV"):
            linhas.append([it["tag"], "Alívio de emergência bidirecional na M2 Ø800", nome,
                           "+12/-6 mbar (R-101: -4/-5) - RES-001 REV03", RUBRICA.get(it["tag"], "Contrapartida")])
meio = (len(linhas) + 1) // 2
cols = [["TAG", 20], ["DESCRIÇÃO", 70], ["FL.", 9], ["DADOS PRINCIPAIS / FONTE", 152], ["RUBRICA FINEP", 140]]
quadros = [
    {"titulo": "9. LISTA DE EQUIPAMENTOS (F01-F02) E ENQUADRAMENTO FINEP", "x": 28, "y": 300, "altura": 2.5,
     "colunas": cols, "linhas": linhas[:meio]},
    {"titulo": " ", "x": 28 + 391 + 10, "y": 300, "altura": 2.5, "colunas": cols, "linhas": linhas[meio:],
     "fonte": "Rubrica: Relação de Itens FINEP 06/05/2026 (Bases REV00 §2, Matriz S0). 'Contrapartida' = fora da relação."},
]
f = folha("LEGENDA, SIMBOLOGIA, LISTA DE EQUIPAMENTOS E NOTAS GERAIS", "TBU-GENE-PID-F00", "1/3", "GERAL")
f["escala_simbolos"] = 1.0
f["notas"] = [
    "1. Conjunto F00-F02 elaborado como EXEMPLO da skill fluxograma-pid a partir da pasta PROJETO_EXECUTIVO_OFICIAL (Gen E, "
    "29/10/2026). Emissão preliminar (T.E. A): a S3 não foi iniciada e a S1 está bloqueada no Gate 0.",
    "2. Premissas D1-D6 marcadas [A VERIFICAR] até deliberação da Diretoria e confirmação na seção indicada (CLAUDE.md §4-5).",
    "3. Toda pendência aparece como LACUNA com ID (REGISTRO_LACUNAS.md). DN das linhas, níveis operacionais e set points "
    "só vão para 'Para Construção' sem LACUNA bloqueante aberta.",
    "4. Simbologia ISO 10628-2 e ANSI/ISA-5.1 (letras compatíveis com a NBR 8190). Símbolos da casa onde o catálogo não "
    "tem equivalente. Cores de linha por serviço; impressão P&B disponível (arquivo _PB.pdf).",
    "5. Cruzamentos sem conexão: a linha de menor hierarquia é interrompida. Tês indicados pela junção das linhas.",
]
(AQUI / "_folha_F00.json").write_text(json.dumps(f, ensure_ascii=False, indent=1), encoding="utf-8")
(AQUI / "_quadros_F00.json").write_text(json.dumps(quadros, ensure_ascii=False, indent=1), encoding="utf-8")
subprocess.run([sys.executable, str(AQUI.parents[1] / "scripts" / "gerar_legenda.py"), str(AQUI / "F01.json"),
                str(AQUI / "F02.json"), "--folha", str(AQUI / "_folha_F00.json"), "--quadros",
                str(AQUI / "_quadros_F00.json"), "-o", str(AQUI / "F00.json")], check=True)
print(len(linhas), "equipamentos na lista")
