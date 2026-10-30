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
import hidraulica_gene as hg  # noqa: E402
from hidraulica import montagem, prfv, validacao  # noqa: E402

ESTADO = {"usar": "USAR (existente)", "tamponar": "TAMPONAR (flange cego)",
          "converter": "CONVERTER: flange 8\" + cego", "novo": "NOVO (furar, laminar e flangear)"}


SERVICO = {"-SP": "respiro do standpipe da saída (quebra-sifão ligado ao gás)",
           "-AL": "respiro da alça de entrada (quebra-sifão ligado ao gás)",
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
         "Situação: **DOCUMENTO DE TRABALHO — não liberado** (Crivo A–F independente "
         "pendente). Flanges com furação ANSI B16.5 classe 150. Azimute medido no sentido "
         "horário a partir do norte do desenho Fibrais. Cotas absolutas na base comum z = 0 "
         "(premissa de S5). Uso: alinhar com a Fibrais o que é aberto, novo e tamponado.\n",
         "Legenda: **NOVO** = furar, laminar o pescoço com reforço (repad) e flangear. "
         "**TAMPONAR** = flange cego estanque a gás, com junta e parafusos. "
         "**CONVERTER** = adaptar o bocal para receber flange e cego.\n",
         "## Resumo para a Fibrais\n"]
    novos = Counter((l["equipamento"], l["dn"]) for l in linhas if l["estado"] == "novo")
    cegos = Counter((l["equipamento"], l["dn"]) for l in linhas
                    if l["estado"] in ("tamponar", "converter"))
    tot_n = Counter(l["dn"] for l in linhas if l["estado"] == "novo")
    tot_c = Counter(l["dn"] for l in linhas if l["estado"] in ("tamponar", "converter"))
    L.append("| equipamento | bocais novos (qtd × DN) | flanges cegos (qtd × DN) |")
    L.append("|---|---|---|")
    for eq in dict.fromkeys(l["equipamento"] for l in linhas):
        n = " + ".join(f"{q}× DN{dn}" for (e, dn), q in sorted(novos.items()) if e == eq) or "—"
        c = " + ".join(f"{q}× DN{dn}" for (e, dn), q in sorted(cegos.items()) if e == eq) or "—"
        L.append(f"| {eq} | {n} | {c} |")
    L.append(f"| **total** | **{' + '.join(f'{q}× DN{dn}' for dn, q in sorted(tot_n.items()))}**"
             f" | **{' + '.join(f'{q}× DN{dn}' for dn, q in sorted(tot_c.items()))}** |\n")
    L.append("Os bocais do TQ-201 são todos novos porque o tanque é especificado pela CSTR "
             "(LAC-010). Nos reatores e no TQ-301, já fabricados, os novos são só a saída "
             "N-SAI DN150 no nível de transbordo e o LSHH DN50.\n")
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
    res = hg.calcular(m, pg.NIVEL)
    hg.grafico(m, pg.NIVEL, pasta / "LE_LP_gene.png")
    hg.memoria(m, pg.NIVEL, res, pasta / "MEMORIA_HIDRAULICA.md", "LE_LP_gene.png")
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
