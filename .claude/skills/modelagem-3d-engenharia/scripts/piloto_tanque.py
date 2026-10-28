"""Piloto: tanque de mistura Ø2000 x 3000 com bocais, linha de recalque e válvula.

Uso: python piloto_tanque.py <pasta_saida>
Gera <pasta_saida>/piloto_tanque.step e .glb.
"""
import sys
from pathlib import Path

from componentes import (bocal, exportar, linha, misturador_vertical,
                         tanque_vertical, tubo_od, valvula_gaveta)

saida = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
saida.mkdir(parents=True, exist_ok=True)

D, H = 2000, 3000
n1, face_n1 = bocal(100, (D / 2, 0, H - 300), "+x")
n2, face_n2 = bocal(80, (-D / 2, 0, 400), "-x")
partes = {
    "TQ-01": tanque_vertical(D, H, fundo_conico=400),
    "N1-entrada-DN100": n1,
    "N2-saida-DN80": n2,
    "MX-01": misturador_vertical((0, 0, H), altura_eixo=2300, d_rotor=700),
}
# Linha de entrada: chega por cima ao N1 (curva 1,5D no vértice)
xe, _, ze = face_n1
partes["L-001-DN100"] = linha([(xe, 0, ze), (xe + 800, 0, ze),
                               (xe + 800, 0, ze + 900)], 100, "esgoto")
# Linha de saída: do N2 segue em X, passa pela válvula e desce até a bomba
xs, _, zs = face_n2
partes["L-002-DN80"] = linha([(xs, 0, zs), (xs - 1500, 0, zs),
                              (xs - 1500, 0, 0)], 80, "lodo")
partes["V-001-DN80"] = valvula_gaveta(80, (xs - 600, 0, zs), eixo="x")

exportar(partes, str(saida / "piloto_tanque"))
print("OD DN80 =", round(tubo_od(80), 1), "mm; arquivos em", saida)
