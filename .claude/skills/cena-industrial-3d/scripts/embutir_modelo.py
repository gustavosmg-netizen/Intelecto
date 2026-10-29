"""Gera modelo.js (glb em base64) para publicar o visualizador como Artifact.

O Artifact não serve .glb; um .js com o binário em base64 sim.
Uso: python embutir_modelo.py modelo.glb pasta_do_visualizador/modelo.js
         [--titulo "TQ-01 equalização"] [--subtitulo "verificação aprovada · unidades em m"]
"""
import argparse
import base64
import json
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("glb")
ap.add_argument("destino")
ap.add_argument("--titulo")
ap.add_argument("--subtitulo")
a = ap.parse_args()
glb, destino = Path(a.glb), Path(a.destino)
b64 = base64.b64encode(glb.read_bytes()).decode("ascii")
linhas = [f'window.MODELO_GLB_B64 = "{b64}";']
if a.titulo:
    linhas.append(f"window.MODELO_TITULO = {json.dumps(a.titulo, ensure_ascii=False)};")
if a.subtitulo:
    linhas.append(f"window.MODELO_SUBTITULO = {json.dumps(a.subtitulo, ensure_ascii=False)};")
destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")
print(f"{destino} ({destino.stat().st_size / 1e6:.1f} MB)")
