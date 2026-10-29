"""Testes do validador: cada caso injeta um erro físico típico no exemplo e confere a regra.

Uso: python testes_hidraulica.py   (sai com código 1 se algum caso falhar)
"""
import copy
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hidraulica import montagem, validacao  # noqa: E402

BASE = yaml.safe_load((Path(__file__).parent.parent / "exemplos" / "tanque_equalizacao.yaml")
                      .read_text(encoding="utf-8"))


def linha(spec, tag):
    return next(x for x in spec["linhas"] if x["tag"] == tag)


def bocal(spec, tag):
    return next(b for b in spec["equipamentos"][0]["bocais"] if b["tag"] == tag)


def caso_declividade(s):
    linha(s, "L-001")["origem"]["ponto"][2] = 2988.5          # 0,18 % < 0,5 %


def caso_selo(s):
    linha(s, "L-002")["pontos"][1]["sifao"]["selo"] = 30       # selo_min 100


def caso_sem_retencao(s):
    c = linha(s, "L-005")["componentes"]
    c[:] = [x for x in c if x["tipo"] != "retencao"]


def caso_sem_reducao(s):
    c = linha(s, "L-004")["componentes"]
    c[:] = [x for x in c if x["tipo"] != "reducao"]


def caso_descarga_sem_registro(s):
    linha(s, "L-003").pop("componentes")


def caso_extravasor_baixo(s):
    bocal(s, "N2")["geratriz_inferior"] = 2600
    linha(s, "L-002")["pontos"][0][2] = 2672.5


def caso_desalinhado(s):
    linha(s, "L-004")["pontos"] = [[2400, 600, 450], [3500, 600, 450], [3500, 0, 450]]


def caso_reducao_concentrica_succao(s):
    for c in linha(s, "L-004")["componentes"]:
        if c["tipo"] == "reducao":
            c["excentrica"] = False


def caso_colisao(s):
    s["linhas"].append({"tag": "L-099", "servico": "agua", "regime": "pressao",
                        "material": "pvc_pba", "dn": 50, "suportes": False,
                        "origem": {"ponto": [-1000, -3000, 1000], "direcao": [0, 1, 0]},
                        "destino": {"ponto": [-1000, 3000, 1000]}})


CASOS = [("base aprovada", None, None, False),
         ("declividade insuficiente", caso_declividade, "H05", False),
         ("selo hídrico curto", caso_selo, "H06", False),
         ("recalque sem retenção", caso_sem_retencao, "H08", False),
         ("sucção sem redução p/ bocal da bomba", caso_sem_reducao, "H03", False),
         ("descarga de fundo sem registro", caso_descarga_sem_registro, "H07", False),
         ("extravasor abaixo do N.A. máx", caso_extravasor_baixo, "H07", False),
         ("linha fora do eixo do bocal", caso_desalinhado, "H02", False),
         ("redução concêntrica na sucção", caso_reducao_concentrica_succao, "H08", False),
         ("tubo atravessando o tanque", caso_colisao, "H13", True)]

falhas = 0
for nome, mut, esperado, colisao in CASOS:
    spec = copy.deepcopy(BASE)
    if mut:
        mut(spec)
    if not colisao and esperado is not None:
        original = validacao._validar_colisoes
        validacao._validar_colisoes = lambda *_: None
    try:
        m = montagem.montar(spec)
        achados = validacao.validar(m)
    finally:
        if not colisao and esperado is not None:
            validacao._validar_colisoes = original
    erros = {a.codigo for a in achados if a.nivel == "ERRO"}
    ok = (not erros) if esperado is None else (esperado in erros)
    falhas += not ok
    print(f"{'OK ' if ok else 'FALHOU'} {nome}: erros {sorted(erros) or '—'}")
    if not ok:
        for a in achados:
            print("     ", a.codigo, a.nivel, a.mensagem)
sys.exit(1 if falhas else 0)
