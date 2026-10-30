"""Diagnóstico: centro e volume das interferências entre pares de grupos."""
import sys
import planta_gene as pg
from hidraulica import validacao
m, tq, L = pg.construir_modelo()
donos = {}
for grupo, itens in m.pecas.items():
    donos.setdefault(validacao._dono(m, grupo), []).extend((grupo, s) for s, _ in itens)
pares = [p.split("×") for p in sys.argv[1:]]
for a, b in pares:
    for ga, sa in donos[a.strip()]:
        ba = sa.bounding_box()
        for gb, sb in donos[b.strip()]:
            if not validacao._caixas_tocam(ba, sb.bounding_box()):
                continue
            x = sa & sb
            if x.volume > 1:
                c = x.bounding_box().center()
                print(a, ga, "×", gb, round(x.volume / 1e6, 3), "dm³ em", [round(v) for v in c])
