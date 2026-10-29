"""Gera modelo 3D hidráulico a partir de especificação YAML e verifica o sentido físico.

Uso: python gerar_modelo.py especificacao.yaml pasta_saida/ [--sem-colisao]
Saídas: <tag>.step, <tag>.glb, <tag>_previa.png, <tag>_verificacao.md, <tag>_materiais.csv
Código de saída 1 quando a verificação reprova (há ERRO).
"""
import argparse
import csv
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hidraulica import montagem, validacao  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("spec")
ap.add_argument("saida")
ap.add_argument("--sem-colisao", action="store_true", help="pula H13 (mais rápido)")
ap.add_argument("--sem-previa", action="store_true")
ap.add_argument("--deflexao", type=float, default=2.0,
                help="tolerância da malha do .glb em mm (6 = leve para web)")
a = ap.parse_args()

spec = yaml.safe_load(Path(a.spec).read_text(encoding="utf-8"))
saida = Path(a.saida)
saida.mkdir(parents=True, exist_ok=True)
base = saida / spec.get("arquivo", Path(a.spec).stem)

m = montagem.montar(spec)
if a.sem_colisao:
    validacao._validar_colisoes = lambda *_: None
achados = validacao.validar(m)
(base.parent / f"{base.name}_verificacao.md").write_text(validacao.relatorio(m, achados),
                                                         encoding="utf-8")
soma = defaultdict(float)
for it in m.bom:
    soma[(it["item"], it["especificacao"], it["unidade"])] += it["quantidade"]
with open(base.parent / f"{base.name}_materiais.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["item", "especificacao", "unidade", "quantidade"])
    for (item, esp, un), q in sorted(soma.items()):
        w.writerow([item, esp, un, f"{q:g}".replace(".", ",")])
montagem.exportar(m, str(base), a.deflexao)
if not a.sem_previa:
    subprocess.run([sys.executable, "-I", str(Path(__file__).parent / "previa_png.py"),
                    f"{base}.glb", f"{base}_previa.png"], check=False)
erros = [x for x in achados if x.nivel == "ERRO"]
print(f"{'REPROVADO' if erros else 'APROVADO'}: {len(erros)} erro(s), "
      f"{len(achados) - len(erros)} aviso(s) -> {base}_verificacao.md")
for x in achados:
    print(f"  {x.codigo} {x.nivel:5} {x.objeto}: {x.mensagem}")
sys.exit(1 if erros else 0)
