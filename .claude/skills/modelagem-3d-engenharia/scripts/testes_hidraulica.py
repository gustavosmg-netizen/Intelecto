"""Testes do validador: cada caso injeta um erro físico típico num exemplo e confere a regra.

Uso: python testes_hidraulica.py   (sai com código 1 se algum caso falhar)
"""
import copy
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hidraulica import montagem, validacao  # noqa: E402

EXEMPLOS = Path(__file__).parent.parent / "exemplos"
BASES = {n: yaml.safe_load((EXEMPLOS / f"{n}.yaml").read_text(encoding="utf-8"))
         for n in ("tanque_equalizacao", "reator_mistura", "elevatoria_submersivel")}


def linha(spec, tag):
    return next(x for x in spec["linhas"] if x["tag"] == tag)


def bocal(spec, tag):
    return next(b for b in spec["equipamentos"][0]["bocais"] if b["tag"] == tag)


# --- tanque de equalização --------------------------------------------------------------

def caso_declividade(s):
    linha(s, "L-001")["origem"]["ponto"][2] = 3418.5           # 0,18 % < 0,5 %


def caso_selo(s):
    ln = linha(s, "L-002")
    ln.update({"raio_curva": 0.75, "sifao": {"selo_min": 100},
               "pontos": [[-1200, 2500, 2922.5], {"sifao": {"selo": 30}}, [-1200, 4400, 2600]],
               "destino": {"ponto": [-1200, 4400, 400]}})


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
    linha(s, "L-002")["pontos"][0][2] = 2665.5


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


def caso_entrada_sem_separacao(s):
    bocal(s, "N1")["geratriz_inferior"] = 3000                   # 150 mm < 3·DI
    linha(s, "L-001")["origem"]["ponto"][2] = 3134.5


def caso_extravasor_com_registro(s):
    linha(s, "L-002")["componentes"] = [{"tipo": "gaveta", "tag": "V-099"}]


def caso_submergencia(s):
    s["equipamentos"][0]["na_min"] = 600                         # 150 mm sobre o eixo


# --- tanque de mistura/reação cilíndrico ------------------------------------------------

def _saida_perna(s, respiro=None):
    b = bocal(s, "N2")
    b.pop("caixa_nivel")
    b["eixo"] = 400
    ln = linha(s, "L-102")
    ln["pontos"] = [[3000, 0, 400], [3000, 0, 3900], [4000, 0, 3890]]   # crista a 1 %
    ln["destino"] = {"ponto": [9000, 0, 3840]}
    if respiro:
        ln["respiro"] = respiro


def caso_perna_sem_respiro(s):
    _saida_perna(s)


def caso_perna_com_respiro(s):
    _saida_perna(s, {"ponto": [3500, 0, 3895], "dn": 100, "topo": 5200})


def caso_respiro_baixo(s):
    _saida_perna(s, {"ponto": [3500, 0, 3895], "dn": 100, "topo": 4500})


def caso_tanque_fechado_sem_respiro(s):
    s["equipamentos"][0]["fechado"] = True


def caso_tanque_fechado_com_respiro(s):
    s["equipamentos"][0].update({"fechado": True, "respiro": {"dn": 200, "posicao": [1200, 1200]}})


def caso_caixa_afogada(s):
    b = bocal(s, "N2")
    b["dn"] = 100
    linha(s, "L-102").update({"material": "pvc_esgoto", "dn": 100})


def caso_imersao_sem_quebra_vacuo(s):
    bocal(s, "N1")["tubo_imersao"] = {"ate": 1500, "quebra_vacuo": False}


def caso_imersao_com_quebra_vacuo(s):
    bocal(s, "N1")["tubo_imersao"] = {"ate": 1500, "quebra_vacuo": True}


def caso_entrada_afogada(s):
    bocal(s, "N1")["geratriz_inferior"] = 3000
    linha(s, "L-101")["pontos"][-1][2] = 3078.5


# (nome, exemplo, mutação, código esperado ou None = aprovado, roda H13?)
CASOS = [
    ("equalização aprovada", "tanque_equalizacao", None, None, True),
    ("declividade insuficiente", "tanque_equalizacao", caso_declividade, "H05", False),
    ("selo hídrico curto", "tanque_equalizacao", caso_selo, "H06", False),
    ("recalque sem retenção", "tanque_equalizacao", caso_sem_retencao, "H08", False),
    ("sucção sem redução p/ bocal da bomba", "tanque_equalizacao", caso_sem_reducao, "H03", False),
    ("descarga de fundo sem registro", "tanque_equalizacao", caso_descarga_sem_registro, "H07", False),
    ("extravasor abaixo do N.A. máx", "tanque_equalizacao", caso_extravasor_baixo, "H07", False),
    ("linha fora do eixo do bocal", "tanque_equalizacao", caso_desalinhado, "H02", False),
    ("redução concêntrica na sucção", "tanque_equalizacao", caso_reducao_concentrica_succao, "H08", False),
    ("tubo atravessando o tanque", "tanque_equalizacao", caso_colisao, "H13", True),
    ("entrada sem separação de ar", "tanque_equalizacao", caso_entrada_sem_separacao, "H14", False),
    ("extravasor com registro", "tanque_equalizacao", caso_extravasor_com_registro, "H19", False),
    ("submergência insuficiente", "tanque_equalizacao", caso_submergencia, "H16", False),
    ("mistura aprovada", "reator_mistura", None, None, True),
    ("perna de nível sem respiro", "reator_mistura", caso_perna_sem_respiro, "H15", False),
    ("perna de nível com respiro", "reator_mistura", caso_perna_com_respiro, None, False),
    ("respiro abaixo da borda", "reator_mistura", caso_respiro_baixo, "H15", False),
    ("tanque fechado sem respiro", "reator_mistura", caso_tanque_fechado_sem_respiro, "H17", False),
    ("tanque fechado com respiro", "reator_mistura", caso_tanque_fechado_com_respiro, None, False),
    ("caixa de nível afogada", "reator_mistura", caso_caixa_afogada, "H18", False),
    ("tubo mergulhado sem quebra-vácuo", "reator_mistura", caso_imersao_sem_quebra_vacuo, "H14", False),
    ("tubo mergulhado com quebra-vácuo", "reator_mistura", caso_imersao_com_quebra_vacuo, None, False),
    ("entrada afogada sem proteção", "reator_mistura", caso_entrada_afogada, "H14", False),
    ("elevatória aprovada", "elevatoria_submersivel", None, None, True),
]

falhas = 0
original = validacao._validar_colisoes
for nome, base, mut, esperado, colisao in CASOS:
    spec = copy.deepcopy(BASES[base])
    if mut:
        mut(spec)
    validacao._validar_colisoes = original if colisao else (lambda *_: None)
    try:
        achados = validacao.validar(montagem.montar(spec))
    except Exception as e:                       # montagem impossível também é falha do caso
        achados = [validacao.Achado("EXC", "ERRO", base, f"{type(e).__name__}: {e}")]
    erros = {a.codigo for a in achados if a.nivel == "ERRO"}
    ok = (not erros) if esperado is None else (esperado in erros)
    falhas += not ok
    print(f"{'OK ' if ok else 'FALHOU'} {nome}: erros {sorted(erros) or '—'}")
    if not ok:
        for a in achados:
            print("     ", a.codigo, a.nivel, a.objeto, a.mensagem)
validacao._validar_colisoes = original
print(f"\n{len(CASOS) - falhas}/{len(CASOS)} casos corretos")
sys.exit(1 if falhas else 0)
