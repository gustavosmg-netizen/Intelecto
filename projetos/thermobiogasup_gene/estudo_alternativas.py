"""Estudo de alternativas (rev. 5): coleta/selagem dos líquidos e arquitetura do gás, com
indicadores físicos (sem valores monetários). Compara a rev. 3 (commit 6048da6, potes
elevados) com a rev. 4 a partir das listas de materiais geradas pelo próprio modelo.

Uso: python estudo_alternativas.py   (depois de gerar_gene.py)
"""
import csv
import io
import subprocess
from collections import defaultdict
from pathlib import Path

AQUI = Path(__file__).resolve().parent
REV3 = "9853f59"   # rev. 4


def _bom(texto):
    out = []
    for r in csv.DictReader(io.StringIO(texto), delimiter=";"):
        r["q"] = float(r["quantidade"].replace(",", "."))
        out.append(r)
    return out


def _git(caminho):
    return subprocess.run(["git", "show", f"{REV3}:projetos/thermobiogasup_gene/{caminho}"],
                          cwd=AQUI, capture_output=True, text=True, check=True).stdout


def indicadores(bom, bocais):
    ind = defaultdict(float)
    for r in bom:
        it = r["item"]
        if it == "Tubo":
            de = r["especificacao"].split()[1]                 # "PEAD DE160 SDR17 (...)"
            ind[f"tubo {de} (m)"] += r["q"]
            ind["tubo total (m)"] += r["q"]
        elif it.startswith("Bomba de cavidade"):
            ind["bombas instaladas"] += r["q"]
        elif it.startswith("Bomba PCP móvel"):
            ind["bomba móvel de reserva"] += r["q"]
        elif it.startswith("Skid de sopradores"):
            ind["sopradores (skid A+B)"] += 2 * r["q"]
        elif it.startswith("Válvula") or it.startswith("Tê + ventosa") or \
                it.startswith("Tê com derivação"):
            ind["válvulas e ventosas"] += r["q"]
        elif it.startswith("Pote de selagem"):
            ind["potes elevados sobre estrutura"] += r["q"]
        elif it.startswith("Copo de selagem"):
            ind["copos de selagem internos (no chão)"] += r["q"]
        elif it.startswith("Curva"):
            ind["curvas"] += r["q"]
        elif it.startswith("Detector") or it.startswith("Analisador") or \
                it.startswith("PSHH") or it.startswith("Medidor"):
            ind["instrumentos de segurança"] += r["q"]
        elif it.startswith("Gasômetro"):
            ind["gasômetros"] += r["q"]
    exist = ("R-101", "R-201", "R-202", "TQ-301")
    for b in bocais:
        if b["equipamento"] in exist and b["estado"] == "novo":
            ind["bocais novos nos tanques Fibrais existentes"] += 1
        if b["equipamento"] in exist and b["estado"] in ("tamponar", "converter"):
            ind["flanges cegos nos tanques Fibrais existentes"] += 1
    return ind


def main():
    bom3 = _bom(_git("saida/gene_materiais.csv"))
    boc3 = list(csv.DictReader(io.StringIO(_git("saida/BOCAIS_FIBRAIS.csv")), delimiter=";"))
    bom4 = _bom((AQUI / "saida/gene_materiais.csv").read_text(encoding="utf-8"))
    boc4 = list(csv.DictReader(open(AQUI / "saida/BOCAIS_FIBRAIS.csv", encoding="utf-8"),
                               delimiter=";"))
    i3, i4 = indicadores(bom3, boc3), indicadores(bom4, boc4)
    chaves = sorted(set(i3) | set(i4), key=lambda k: (not k.startswith("tubo"), k))
    L = ["# Estudo de alternativas — Gen E rev. 5 (planta enxuta)\n",
         "Situação: **DOCUMENTO DE TRABALHO**, sujeito ao Crivo A–F. Indicadores físicos, sem "
         "valores monetários. Base: pedido do cliente (menos unidades; reavaliar sem o tanque de "
         "neutralização) e F02 Rev. B (C1) do chat de fluxogramas "
         "(`.claude/skills/fluxograma-pid/modelos/thermobiogasup_genE/PARECER_F02.md`, branch "
         "`claude/wizardly-volta-web5tm`).\n",
         "## 1. Neutralização: tanque ou em linha\n",
         "| | C1: TQ-201 fechado e equalizado ao R-101 | **C3: em linha (adotada)** |",
         "|---|---|---|",
         "| Unidades | tanque, agitador, linha de gás de equalização, linha de saída do R-101 por "
         "gravidade com selo | dosadora (skid), misturador estático, pH/ORP em linha |",
         "| Pulmão de pH | ≈ 1 m³ no tanque | o próprio R-101 (≈ 5,6 m³ entre LSL e operação) e "
         "os metanogênicos (pulso de ≈ 0,7% do volume) |",
         "| Segurança | +1 vaso fechado no envelope de pressão; IIC | um vaso a menos no "
         "envelope; a P-201 aspira o R-101 com reposição de gás (mesma regra das purgas) |",
         "| Controle | pH no tanque | pH/ORP em linha + saída de cada metanogênico; pulso "
         "intertravado ao pH |",
         "| Contrato | aderente ao item FINEP \"tanques de neutralização\" | exige consulta "
         "(LAC-054) |\n",
         "O ganho de segurança do tanque era pequeno: ele separava os estágios, mas acrescentava "
         "um vaso fechado, uma linha de gás e uma linha de líquido. O pulmão de pH migra para o "
         "R-101, que passa a ter nível variável.\n",
         "## 2. Alimentação dos reatores\n",
         "| | Alça externa com ventosa ao gás (rev. 4) | **Tampo com tubo de imersão (C1, "
         "adotada)** | Tampo sem tubo (descarga direta no N1) |",
         "|---|---|---|---|",
         "| Hidráulica (τy alto) | AMT ≈ igual; descida DE160 cheia | AMT ≈ igual; tubo cheio "
         "abaixo do nível; no caso pessimista parte do pulso sai pelo furo | menor AMT; sem "
         "trecho cheio interno |",
         "| Quebra-sifão | ventosa de esgoto em lodo (manutenção, falha) | furo no espaço de "
         "gás: passivo | inerente (descarga livre no gás) |",
         "| Curto-circuito | entrada no fundo, saída no topo: ótimo | entrada a 1/3 da "
         "altura: bom | entrada na superfície, perto da saída por transbordo: **ruim nos "
         "R-201/202**, bom no R-101 (que sai pelo fundo) |",
         "| Espuma e aerossol | — | baixo | queda livre de ≈ 1,8 m: respingo, espuma e "
         "arraste de gás |",
         "| Escoramento | subida + crista + descida por reator (≈ 2 colunas de 10 m) | uma "
         "subida por reator | uma subida por reator |",
         "| Interferência nos vasos Fibrais | nenhuma | tubo interno no N1 (carga, folga do "
         "misturador): **confirmar com a Fibrais** | nenhuma |",
         "| Unidades | 3 ventosas, 3 linhas de gás das ventosas, 3 descidas, 3 válvulas no "
         "fundo | 3 tubos internos | — |\n",
         "**Se a Fibrais não aceitar o tubo de imersão:**",
         "- **R-101:** descarregar direto no N1. A saída é pelo fundo, então não há "
         "curto-circuito.",
         "- **R-201/R-202:** descarregar direto no N1 mais afastado do N-SAI, com quatro "
         "condições:",
         "  - pulso intertravado ao misturador em operação;",
         "  - pulso pequeno (≈ 0,7% do volume);",
         "  - ensaio com traçador na partida (LAC-047);",
         "  - defletor curto no bocal, que é bem mais leve que o tubo, para não formar "
         "espuma.\n",
         "## 3. Saída dos metanogênicos\n",
         "| | Coluna externa a partir do N2 (C1) | U DN80 ao TQ-301 aberto | **N-SAI no nível + "
         "copos na CS-301 (mantida)** |",
         "|---|---|---|---|",
         "| Tubo cheio de polpa | ≈ 7 m (do fundo à crista) | ≈ 6 m + 4 curvas | só o tubo "
         "mergulhado (≈ 0,5 m) |",
         "| Com τy = 100 Pa | ≈ 2 m de carga: o nível passaria do tampo | ≈ 5 m contra 2,8 m "
         "disponíveis: não escoa | folga de 1,2 m na soleira |",
         "| Bocal novo no reator | não | não | sim (N-SAI DN150) |\n",
         "## 4. Purgas\n",
         "A P-302 dedicada sai. A P-301 faz as purgas por um manifold de sucção com chave presa, "
         "uma sucção por vez: CS-301, N3 do TQ-301 e purga de R-201 ou R-202. As purgas são curtas "
         "(minutos por dia) e a CS-301 tem horas de pulmão na vazão média (≈ 0,3 m³/h).\n",
         "## 5. Indicadores físicos: rev. 4 × rev. 5 (das listas de materiais do modelo)\n",
         "| indicador | rev. 4 | rev. 5 | Δ |", "|---|---|---|---|"]
    for k in chaves:
        a, b = i3.get(k, 0), i4.get(k, 0)
        fmt = (lambda x: f"{x:.1f}".replace(".", ",")) if "(m)" in k else (lambda x: f"{x:.0f}")
        L.append(f"| {k} | {fmt(a)} | {fmt(b)} | {fmt(b - a)} |")
    L += ["\n**Unidades que saem na rev. 5:**",
          "- TQ-201 com o agitador AG-200 e o FCA-201;",
          "- copo CP-101;",
          "- P-302;",
          "- saída por transbordo do R-101 (bocal novo e respiro de equalização);",
          "- 3 alças com ventosas e as linhas de gás delas;",
          "- recirculação L-201RC.",
          "\n**Unidades que entram:** skid de dosagem DOS-201, misturador estático MX-201, "
          "pH/ORP em linha e nos copos, e 3 tubos de imersão.",
          "\n**Gás sem mudança:** GH-1A/B, S-501, GH-2 e flare, por decisão do cliente."]
    (AQUI / "saida/ESTUDO_ALTERNATIVAS.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()
