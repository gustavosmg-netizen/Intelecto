"""Gera modelo.js (glb em base64) para publicar o visualizador como Artifact.

O Artifact não serve .glb; um .js com o binário em base64 sim.
Uso: python embutir_modelo.py modelo.glb pasta_do_visualizador/modelo.js
"""
import base64
import sys
from pathlib import Path

glb, destino = Path(sys.argv[1]), Path(sys.argv[2])
b64 = base64.b64encode(glb.read_bytes()).decode("ascii")
destino.write_text(f'window.MODELO_GLB_B64 = "{b64}";\n', encoding="ascii")
print(f"{destino} ({destino.stat().st_size / 1e6:.1f} MB)")
