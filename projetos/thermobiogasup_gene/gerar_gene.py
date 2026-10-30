"""Orquestrador da planta Gen E: modelo 3D, verificação, lista de bocais (De→Para Fibrais),
lista de materiais, memória hidráulica com LE/LP, STEP/GLB e prévia.

Uso: python gerar_gene.py [--sem-colisao] [--sem-previa]
Saídas em ./saida/ (documentos de TRABALHO: não liberados sem o Crivo A–F independente).
"""
import argparse
import csv
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import planta_gene as pg  # noqa: E402  (insere o caminho das scripts da skill)
import gas_gene as gg  # noqa: E402
import hidraulica_gene as hg  # noqa: E402
from hidraulica import montagem, prfv, validacao  # noqa: E402

ESTADO = {"usar": "USAR (existente)", "tamponar": "TAMPONAR (flange cego)",
          "converter": "CONVERTER: flange 8\" + cego", "novo": "NOVO (furar, laminar e flangear)"}


SERVICO = {"-RS": "respiro de equalização da descida da saída (quebra-sifão, gás)",
           "-VQ": "descarga da ventosa da crista da alça de entrada (gás, quebra-sifão)",
           "SH": "selo hidráulico de sobre/subpressão (+8/−3 mbar)",
           "LT": "transmissor de nível (radar)"}


def ligacoes(m):
    """porta -> linhas/dispositivos ligados a ela."""
    out = defaultdict(list)
    for ln in m.linhas.values():
        for p in (ln.origem, ln.destino):
            if p is not None and getattr(p, "nome", None):
                out[p.nome].append(ln.tag)
    return out


def tabela_bocais(m):
    lig = ligacoes(m)
    linhas = []
    for tq, b in m.tabela_bocais:
        nome = f"{tq.tag}.{b.tag}"
        conexao = ", ".join(lig.get(nome, [])) or b.ligacao or "—"
        if b.local == "costado":
            ref = "da junção cone-costado" if tq.fundo == "conico" else "do fundo interno"
            pos = f"costado az {b.az:.0f}°; eixo a {b.elev - tq.z_fundo:.0f} mm {ref}"
        elif b.local == "tampo":
            pos = (f"tampo az {b.az:.0f}°, r = {b.raio:.0f} mm; face a "
                   f"{b.elev - tq.z_tampo:.0f} mm do tampo")
        else:
            pos = "fundo (ponta do cone)"
        linhas.append({
            "equipamento": tq.tag, "desenho": tq.desenho, "bocal": b.tag,
            "DN": f"{b.dn} ({prfv.DN_POL.get(b.dn, '')})", "dn": b.dn, "local": b.local,
            "posicao": pos, "z_abs_mm": round(b.elev), "estado": b.estado,
            "acao": ESTADO[b.estado], "conexao": conexao,
            "servico": b.servico or next((v for k, v in SERVICO.items()
                                          if conexao.endswith(k)), ""),
            "origem": b.origem, "nota": b.nota,
            "soleira_mm": "" if b.soleira is None else round(b.soleira)})
    return linhas


def escrever_bocais(linhas, pasta: Path):
    with open(pasta / "BOCAIS_FIBRAIS.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=[k for k in linhas[0] if k != "dn"], delimiter=";",
                           extrasaction="ignore")
        w.writeheader()
        w.writerows(linhas)
    L = ["# Lista de bocais De→Para — reatores e tanques PRFV (Gen E)\n",
         "Situação: **DOCUMENTO DE TRABALHO — não liberado para emissão.** Revisão 4 (coleta "
         "no chão e sistema de biogás), revisada pelo Crivo A–F independente e corrigida. "
         "**Não furar antes de fechar a LAC-006** (arranjo "
         "de bocais e saída nivelada, FEA da modificação) **e a LAC-031** (envelope garantido). "
         "Estanqueidade a gás de M1/A4/flanges cegos: LAC-029.\n",
         "Convenções:",
         "- Flanges com furação ASME B16.5 Classe 150, face plana (FF) no PRFV. Válvulas FF e "
         "junta full-face.",
         "- Azimute horário a partir do 0° do desenho Fibrais, que deve coincidir com o norte "
         "de projeto na montagem.",
         "- Cotas absolutas na base comum z = 0 (premissa de S5). Uso: alinhar com a Fibrais o "
         "que é aberto, novo e tamponado.\n",
         "Legenda: **NOVO** = furar, laminar o pescoço com reforço (repad) e flangear. "
         "**TAMPONAR** = flange cego estanque a gás, com junta e parafusos. "
         "**CONVERTER** = adaptar o bocal para receber flange e cego.\n",
         "## Resumo para a Fibrais\n"]
    novos = Counter((l["equipamento"], l["dn"]) for l in linhas if l["estado"] == "novo")
    cegos = Counter((l["equipamento"], l["dn"]) for l in linhas
                    if l["estado"] in ("tamponar", "converter"))
    fib = [l for l in linhas if l["equipamento"] not in ("CS-301", "TQ-201")]   # itens CSTR
    tot_n = Counter(l["dn"] for l in fib if l["estado"] == "novo")
    tot_c = Counter(l["dn"] for l in fib if l["estado"] in ("tamponar", "converter"))
    L.append("| equipamento | bocais novos (qtd × DN) | flanges cegos (qtd × DN) |")
    L.append("|---|---|---|")
    for eq in dict.fromkeys(l["equipamento"] for l in linhas):
        n = " + ".join(f"{q}× DN{dn}" for (e, dn), q in sorted(novos.items()) if e == eq) or "—"
        c = " + ".join(f"{q}× DN{dn}" for (e, dn), q in sorted(cegos.items()) if e == eq) or "—"
        L.append(f"| {eq} | {n} | {c} |")
    L.append(f"| **total nos tanques Fibrais existentes** | **{' + '.join(f'{q}× DN{dn}' for dn, q in sorted(tot_n.items()))}**"
             f" | **{' + '.join(f'{q}× DN{dn}' for dn, q in sorted(tot_c.items()))}** |\n")
    L.append("Leitura do resumo:")
    L.append("- **Reatores (já fabricados):** os bocais novos são só a saída N-SAI DN150, com a "
             "soleira interna no N.A. (+3,50 / +7,50), e o LSHH DN50.")
    L.append("- **TQ-301 (já fabricado):** passa a ser só armazenamento do digestato. Recebe "
             "pela P-301 no N1-270; N1-0 e N1-90 ficam cegos; novos só o extravasor e o LSHH.")
    L.append("- **Reatores, flanges cegos:** dois N2, o M1 e o A4. Os quatro N1 ficam em uso: "
             "respiro de equalização da saída, descarga da ventosa da alça, selo hidráulico e "
             "radar.")
    L.append("- **A4 (8\"):** é convertido em flange com cego multitomada. É o candidato ao "
             "transbordo dedicado (LAC-038) e às tomadas independentes de PSLL/PAHH (LAC-048).")
    L.append("- **TQ-201 e CS-301 (novos, especificação CSTR):** todos os bocais são novos e "
             "cada um leva copo de selagem interno laminado (CP-101 no TQ-201; CP-201 e CP-202 "
             "na CS-301). Não entram no total dos tanques existentes.\n")
    L.append("## O que a Fibrais precisa confirmar ou fornecer antes de furar\n")
    for t in (
            "**Cargas nos bocais novos.** A N-SAI recebe só o registro e o tê do respiro. A "
            "descida até o tanque do chão se apoia numa estrutura metálica a projetar "
            "(LAC-047), não no bocal. A Fibrais informa as "
            "cargas admissíveis (forças e momentos) e o reforço (repad) de cada abertura nova, "
            "com a FEA da LAC-006.",
            "**Distância mínima de bocal à junta fundo-costado** (N-SUC a 250 mm e N-DRE a "
            "200 mm do fundo do TQ-201).",
            "**Detalhes internos dos tanques novos:** copos de selagem (CP-101 no TQ-201, "
            "CP-201/202 na CS-301) com borda acima do nível máximo; quebra-vórtice nos N-SUC; "
            "tubos de imersão no N-DOS e no N-RL05.",
            "**Dilatação do PEAD** entre o piso e os bocais altos (até ≈ 60 mm a ΔT 30 K). "
            "Prever liras ou mangote flexível junto ao bocal, sem carregar o PRFV.",
            "**Acessos e plataformas** (projeto CSTR, LAC proposta): V-201SAI e V-202SAI a "
            "+7,6 m, LSHH a +8,35 m e ventosas das alças a +5,35/+9,35 m. As caixas e bombas "
            "ficam no chão.",
            "**Tampa de visita M1:** aparafusada e removível, estanque a gás (LAC-029). Não "
            "é um cego definitivo.",
            ):
        L.append(f"- {t}")
    L.append("")
    for eq in dict.fromkeys(l["equipamento"] for l in linhas):
        sub = [l for l in linhas if l["equipamento"] == eq]
        L.append(f"## {eq} — desenho {sub[0]['desenho']}\n")
        L.append("| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |")
        L.append("|---|---|---|---|---|---|---|---|")
        for l in sub:
            L.append(f"| {l['bocal']} | {l['DN']} | {l['posicao']} | {l['z_abs_mm']} | "
                     f"{l['acao']} | {l['servico']} | {l['conexao']} | {l['nota']} |")
        L.append("")
    (pasta / "BOCAIS_FIBRAIS.md").write_text("\n".join(L), encoding="utf-8")
    return tot_n, tot_c


LACUNAS_PROPOSTAS = [
    ("LAC-041", "Reometria da polpa real (τy e μp a 35 °C, 6–9% ST) e ensaio de bancada do copo "
     "de selagem", "Fecha as margens das saídas por gravidade e as AMT (caso pessimista)",
     "CSTR – S2", "Gate 3"),
    ("LAC-042", "Especificação do FCA-201 e do FCA-301 (carvão, perda de carga, saturação por H₂S)",
     "A perda de carga do FCA define o vácuo no TQ-201 atmosférico", "CSTR – S4", "Gate 4"),
    ("LAC-043", "Posição radial real do N3 (2\") no tampo dos reatores", "Locação das linhas "
     "de gás e do PT", "Fibrais (as-built)", "Gate 1"),
    ("LAC-044", "Caixa de contenção dos extravasores: destino e volume (falha da P-201/P-301 "
     "ou bloqueio a jusante)", "Transbordo seguro",
     "CSTR – S5", "Gate 3"),
    ("LAC-045", "Locação e base comum z = 0; altitude do sítio (NPSH com Congonhas/MG ≈ 870 m, "
     "sítio de referência da LAC-027)", "Todas as cotas e o NPSH são premissas", "CSTR – S5",
     "Gate 1"),
    ("LAC-046", "Selo das saídas: 330 mm de polpa (≈ 33 mbar) em vez dos 500 mmCA da proposta",
     "Decisão do responsável de processo", "CSTR – processo", "Gate 1"),
    ("LAC-047", "Estruturas de apoio das descidas; cargas admissíveis nos bocais novos; "
     "plataformas de acesso às válvulas altas (V-xSAI, ventosas)", "Integridade dos "
     "bocais PRFV e operação segura", "CSTR (S5) + Fibrais (cargas)", "Gate 3"),
    ("LAC-048", "Instrumentação complementar da RES-001 §5.6: tomadas independentes de "
     "PSLL/PAHH (A4 multitomada), LSL/LSLL do reator, analisador de O₂ no gás (SP-08), ZSC "
     "no V-xGAS, LSLL do TQ-201 como SIF dedicada", "Barreiras contra vácuo e entrada de ar",
     "CSTR – S4", "Gate 4"),
    ("LAC-049", "Biogás arrastado pelos copos de selagem ao TQ-201 e à CS-301 (respiros aos "
     "FCA-201/301) e residual do digestato no TQ-301 (A7 sem tratamento): "
     "vazão estimada, tratamento dos respiros e "
     "classificação de área (ver LAC-009)", "Odor, H₂S e área classificada", "CSTR – S4",
     "Gate 4"),
    ("LAC-050", "Gasômetros: fornecedor (consultar Plaslonas e outros; catálogo não encontrado "
     "em fonte aberta), pressão real de operação do GH-1 (alvo ≈ 0 a +2 mbar, faixa de "
     "mercado −1 a +5) e do GH-2 (15–30 mbar), volumes, alívio, medição de volume e "
     "ventilador de suporte", "Pressão dos reatores e ciclos de transferência", "CSTR – S3",
     "Gate 3"),
    ("LAC-051", "Material das linhas de gás aéreas (inox 304L/316L ou PEAD enterrado), "
     "distâncias de segurança (gasômetros, flare, consumidores), classificação de área e "
     "corta-chamas, sopradores, gasômetros e instrumentos certificados para o grupo IIC (gás do R-101 com H₂, D-RES-10)", "Segurança contra incêndio e explosão",
     "CSTR – S4", "Gate 4"),
    ("LAC-053", "Divergências com a RES-001 a validar: GH-1 a ≈ +0,5–2 mbar (RES-001 D3: +1,5 a "
     "+3); alternância GH-1A/B no lugar de gasômetro único com retirada simultânea; válvula "
     "mantenedora a montante ajustada em ≈ +0,3 mbar", "Coerência com a resolução de processo",
     "CSTR – processo", "Gate 1"),
    ("LAC-052", "Consumidores a jusante do GH-2 (SK-501, GE-601, caldeira): vazões e pressões "
     "de tie-in para fechar o volume do GH-2 e a pressão de descarga dos S-501",
     "Dimensionamento do GH-2 e dos sopradores", "CSTR – S3", "Gate 3"),
]


def escrever_lacunas(pasta: Path):
    L = ["# Lacunas propostas por este trabalho (IDs a confirmar no REGISTRO_LACUNAS)\n",
         "Os IDs seguem o último do registro (LAC-040). Status: **PROPOSTA**: o dono do "
         "registro numera, aceita ou funde.\n",
         "| ID | lacuna | efeito | dono | gate |", "|---|---|---|---|---|"]
    L += [f"| {a} | {b} | {c} | {d} | {e} |" for a, b, c, d, e in LACUNAS_PROPOSTAS]
    L.append("\nLacunas existentes que este trabalho afeta: LAC-006 (bloqueante para S3; "
             "arranjo adotado é o bocal novo no nível), LAC-029, LAC-031 e LAC-038 (o A4 8\" "
             "multitomada é o candidato ao transbordo dedicado).")
    (pasta / "LACUNAS_PROPOSTAS.md").write_text("\n".join(L) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-colisao", action="store_true")
    ap.add_argument("--sem-previa", action="store_true")
    a = ap.parse_args()
    pasta = AQUI / "saida"
    pasta.mkdir(exist_ok=True)
    m, tq, _ = pg.construir_modelo()
    if a.sem_colisao:
        validacao._validar_colisoes = lambda *_: None
    achados = validacao.validar(m)
    (pasta / "gene_verificacao.md").write_text(validacao.relatorio(m, achados), encoding="utf-8")
    tot_n, tot_c = escrever_bocais(tabela_bocais(m), pasta)
    soma = defaultdict(float)
    for it in m.bom:
        soma[(it["item"], it["especificacao"], it["unidade"])] += it["quantidade"]
    with open(pasta / "gene_materiais.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["item", "especificacao", "unidade", "quantidade"])
        for (item, esp, un), q in sorted(soma.items()):
            w.writerow([item, esp, un, f"{q:g}".replace(".", ",")])
    res = hg.calcular(m, pg.NIVEL, tq)
    escrever_lacunas(pasta)
    hg.grafico(m, pg.NIVEL, pasta / "LE_LP_gene.png")
    hg.memoria(m, pg.NIVEL, res, pasta / "MEMORIA_HIDRAULICA.md", "LE_LP_gene.png")
    gg.memoria(m, gg.calcular(m), pasta / "MEMORIA_GAS.md")
    gg.matriz(pasta / "MATRIZ_CAUSA_EFEITO.md")
    base = str(pasta / "planta_gene")
    montagem.exportar(m, base, 6.0)
    if not a.sem_previa:
        scripts = Path(pg.RAIZ) / ".claude/skills/modelagem-3d-engenharia/scripts"
        subprocess.run([sys.executable, "-I", str(scripts / "previa_png.py"),
                        f"{base}.glb", f"{base}_previa.png"], check=False)
    erros = [x for x in achados if x.nivel == "ERRO"]
    print(f"{'REPROVADO' if erros else 'APROVADO'}: {len(erros)} erro(s), "
          f"{len(achados) - len(erros)} aviso(s)")
    for x in achados:
        print(f"  {x.codigo} {x.nivel:5} {x.objeto}: {x.mensagem}")
    print("novos:", dict(tot_n), "cegos:", dict(tot_c))
    return 1 if erros else 0


if __name__ == "__main__":
    sys.exit(main())
