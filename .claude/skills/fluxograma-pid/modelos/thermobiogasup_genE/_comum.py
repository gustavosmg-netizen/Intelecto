"""Campos comuns das folhas Gen E (fonte: PROJETO_EXECUTIVO_OFICIAL, 29/10/2026)."""
import json

DOCS = [
    "CLAUDE.md Rev01-A - Constituição do Projeto Executivo (alternativa Gen E)",
    "00_BASES_E_CRITERIOS_DE_PROJETO_REV00 (S0)",
    "MATRIZ_RASTREABILIDADE_TOTAL REV00 - subsistemas S01 a S31",
    "REGISTRO_LACUNAS (40 lacunas; 15 bloqueantes)",
    "RES-001 REV03 - Envelope de pressões e vazões de alívio (aguarda RT)",
    "Fibrais 315C/315E/315D/315A/315B-25 Rev. A (as-built tanques)",
    "Engecontrol 0618/2026 - relatório da caldeira CL-101",
    "TBU-GENE-PID-F00 - Legenda, simbologia e notas gerais",
]


def folha(titulo, numero, n, unidade):
    return {
        "titulo": titulo, "numero": numero, "revisao": "A", "folha": n,
        "projeto": "THERMOBIOGASUP - CSTR / FINEP 0786/23 - GEN E",
        "unidade": unidade, "escala": "S/ESCALA", "data": "30/10/2026",
        "contrato": "FINEP 03.24.0194.00", "classificacao": "USO INTERNO", "tipo_emissao": "A",
        "empresa": "INTELECTO & CSTR", "escala_simbolos": 2.0,
        "revisoes": [["A", "A", "EMISSÃO INICIAL - PRELIMINAR (S3 NÃO INICIADA)", "IA", "-", "-", "30/10/26"]],
        "documentos": DOCS,
        "rodape": "Exemplo da skill fluxograma-pid - não emitido pelo projeto",
    }


def noz(*spec):
    return [{"name": n, "side": s, "fraction": f} for n, s, f in spec]


def salvar(nome, spec):
    with open(nome, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=1)
