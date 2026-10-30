"""Diagnóstico: monta o modelo e roda a verificação geral (H01–H13)."""
import time
import planta_gene as pg
from hidraulica import validacao
t = time.time()
m, tq, L = pg.construir_modelo()
print("montagem", round(time.time() - t), "s")
ach = validacao.validar(m)
print("verificação", round(time.time() - t), "s")
for a in ach:
    print(a.codigo, a.nivel, a.objeto, "|", a.mensagem[:220])
