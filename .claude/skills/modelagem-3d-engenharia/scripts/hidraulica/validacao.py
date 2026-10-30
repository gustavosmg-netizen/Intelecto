"""Verificação física e hidráulica do modelo montado.

Nível ERRO reprova o modelo (não deve ser emitido); AVISO exige justificativa no memorial.
Cada regra tem código fixo (H01…H12) para o relatório ser comparável entre revisões.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from build123d import Vector

from . import normas
from .montagem import FLANGEADOS, Linha, Modelo

BLOQUEIO = {"gaveta", "borboleta", "esfera"}


@dataclass
class Achado:
    codigo: str
    nivel: str      # ERRO | AVISO
    objeto: str
    mensagem: str


def _segmentos(linha: Linha):
    return [el for el in linha.elementos if el[0] == "reto"]


def _invert(z_eixo: float, tubo: normas.Tubo) -> float:
    return z_eixo - tubo.di / 2


def _componentes_ate(linha: Linha, s_max: float, desde_fim=False):
    if desde_fim:
        return [c for c in linha.componentes if c.s1 >= linha.comprimento - s_max]
    return [c for c in linha.componentes if c.s0 <= s_max]


def validar(m: Modelo) -> list[Achado]:
    r: list[Achado] = []

    def add(cod, niv, obj, msg):
        r.append(Achado(cod, niv, obj, msg))

    for ln in m.linhas.values():
        if ln.regime == "ventilacao":
            for e in ln.erros_montagem:
                add("H01", "ERRO", ln.tag, f"Montagem impossível: {e}.")
            continue
        _validar_linha(m, ln, add)
    _validar_bocais(m, add)
    _validar_tanques(m, add)
    _validar_colisoes(m, add)
    return r


def _validar_linha(m: Modelo, ln: Linha, add) -> None:
    tag = ln.tag
    for e in ln.erros_montagem:                                            # H01
        add("H01", "ERRO", tag, f"Montagem impossível: {e}.")
    segs = _segmentos(ln)
    if not segs:
        return
    # H02: saída/chegada alinhadas aos bocais (sem curva colada ao flange)
    for porta, d, nome in ((ln.origem, segs[0][3], "origem"), (ln.destino, segs[-1][3], "destino")):
        if porta.direcao.length < 0.5:
            continue
        esperado = porta.direcao.normalized() * (1 if nome == "origem" else -1)
        if d.dot(esperado) < 0.999:
            add("H02", "ERRO", tag, f"A linha não {'sai' if nome == 'origem' else 'chega'} no "
                f"eixo do bocal {porta.nome}: o primeiro trecho precisa seguir a direção do bocal "
                f"({_fmt(esperado)}), mas segue {_fmt(d)}.")
    # H03: compatibilidade de DN/PN nas juntas flangeadas das extremidades
    for porta, s in ((ln.origem, 0.5), (ln.destino, ln.comprimento - 0.5)):
        tb = ln.tubo_em(s)
        if porta.junta == "flange" and tb.dn_flange != porta.dn:
            add("H03", "ERRO", tag, f"{tb.descricao} (flange DN{tb.dn_flange}) ligado ao bocal "
                f"{porta.nome} DN{porta.dn}: falta redução/ampliação.")
        pn = int(ln.spec.get("pn", 10))
        if porta.junta == "flange" and porta.pn != pn:
            add("H03", "ERRO", tag, f"Flange PN{pn} da linha contra PN{porta.pn} em {porta.nome}: "
                "furação incompatível.")
    # H04: ângulos de curva comerciais
    for i, ang in enumerate(ln.angulos, start=1):
        if ang == 0 or ln.spec.get("curvas_sob_medida"):   # PEAD: curva gomada fabricada
            continue
        perto = min(normas.ANGULOS_COMERCIAIS, key=lambda a: abs(a - ang))
        if abs(perto - ang) > normas.TOLERANCIA_DEFLEXAO:
            add("H04", "AVISO", tag, f"Curva no vértice {i} com {ang:.1f}°: não comercial "
                f"(90/45/22,5/11,25°). Ajuste o traçado ou especifique peça especial.")
    if ln.regime == "gravidade":
        _validar_gravidade(ln, segs, add)
    elif ln.regime == "selada":
        pass        # saída de reator com gás: verificada por hidráulica não newtoniana do projeto
    else:
        _validar_pressao(ln, segs, add)
    # H09: velocidade
    q = ln.spec.get("vazao_ls")
    if q:
        tb = ln.tubo_em(ln.comprimento / 2)          # tubo do trecho corrente
        v = q / 1000 / (math.pi * (tb.di / 1000) ** 2 / 4)
        papel_d = ln.destino.papel
        if ln.spec.get("nao_newtoniano"):
            lim = (0.0, 3.0)    # lodo: velocidade baixa é admitida; verificar sedimentação no projeto
        else:
            lim = (0.0, 1.5) if papel_d == "succao" else (0.6, 3.0) if ln.regime == "pressao" else (0.6, 5.0)
        if not lim[0] <= v <= lim[1]:
            add("H09", "AVISO", tag, f"Velocidade {v:.2f} m/s fora da faixa {lim[0]}–{lim[1]} m/s "
                f"({'sucção' if papel_d == 'succao' else ln.regime}).")
    # H12: vãos entre apoios
    _validar_vaos(m, ln, segs, add)


def _validar_gravidade(ln: Linha, segs, add) -> None:
    tag, tb = ln.tag, ln.tubo
    i_min = float(ln.spec.get("declividade_minima", normas.declividade_minima(tb.material, tb.dn)))
    subidas = []
    u = ln.sifao_u
    # perna de nível: até a crista o tubo trabalha afogado sob a carga do tanque; as regras de
    # conduto livre valem da crista em diante
    z_crista = max(p.Z for p in ln.vertices) if ln.spec.get("respiro") else None
    s_crista = None
    if z_crista is not None:
        s_crista = next((el[4] for el in segs if el[1].Z >= z_crista - 0.5 * tb.de), None)
    for _, A, B, d, s0, s1 in segs:
        h = math.hypot(B.X - A.X, B.Y - A.Y)
        dz = B.Z - A.Z
        if s_crista is not None and s1 <= s_crista + 1e-6:
            continue                                   # trecho afogado antes da crista
        if u and _sobre(A, B, u[1], u[2]):
            continue                                   # ramo ascendente do sifão
        if dz > 1.0:
            if z_crista is not None and B.Z <= z_crista + 1:
                continue                               # perna de nível: sobe até a crista
            subidas.append((A, B))
            continue
        if u and _sobre(A, B, u[0], u[1]):
            continue                                   # fundo do U do sifão é horizontal
        if h > 10 and abs(dz) < h:                                         # trecho horizontal
            i = -dz / h
            if i + 1e-9 < i_min:
                add("H05", "ERRO", tag, f"Conduto livre com declividade {i * 100:.2f} % entre "
                    f"{_fmt(A)} e {_fmt(B)}; mínimo {i_min * 100:.2f} %.")
    if subidas:
        add("H05", "ERRO", tag, "Conduto livre com trecho em aclive (contra o escoamento) sem "
            "sifão declarado: forma bolsão de sólidos e represa a linha.")
    z_ini = _invert(z_crista if z_crista is not None else ln.vertices[0].Z, tb)
    z_fim = _invert(ln.vertices[-1].Z, ln.tubo_em(ln.comprimento - 1))
    if z_fim >= z_ini:
        add("H05", "ERRO", tag, f"Saída (soleira {z_fim:.0f}) não está abaixo da entrada "
            f"(soleira {z_ini:.0f}): não há escoamento por gravidade.")
    if ln.sifao:
        _validar_sifao(ln, add)


def _sobre(A, B, P, Q) -> bool:
    """O trecho A-B (entre pontos de tangência) está sobre a reta dos vértices P-Q?"""
    d = (Q - P).normalized()
    return all(((X - P) - d * (X - P).dot(d)).length < 1 for X in (A, B))


def _validar_sifao(ln: Linha, add) -> None:
    """H06: selo hídrico = soleira da crista de saída do U - geratriz superior interna do fundo."""
    tb, pts = ln.tubo, ln.vertices
    selo_min = float(ln.sifao.get("selo_min", ln.sifao.get("selo", normas.SELO_MINIMO_PADRAO)))
    if not ln.sifao_u:
        add("H06", "ERRO", ln.tag, "Sifão declarado mas o traçado não tem o elemento "
            "{sifao: {selo: …}} em 'pontos'.")
        return
    fundo, _, topo = ln.sifao_u
    z_topo_fundo = fundo.Z + tb.di / 2
    z_soleira_crista = topo.Z - tb.di / 2
    selo = z_soleira_crista - z_topo_fundo
    if selo + 1e-6 < selo_min:
        add("H06", "ERRO", ln.tag, f"Selo hídrico do sifão = {selo:.0f} mm, abaixo do mínimo "
            f"{selo_min:.0f} mm: gases do lado de jusante passam pelo sifão.")
    z_entrada = _invert(pts[0].Z, tb)
    if z_entrada <= z_soleira_crista:
        add("H06", "ERRO", ln.tag, f"Entrada do sifão (soleira {z_entrada:.0f}) não está acima "
            f"da crista de saída ({z_soleira_crista:.0f}): o sifão não escoa.")
    ln._selo_calculado = selo


def _validar_pressao(ln: Linha, segs, add) -> None:
    tag = ln.tag
    tipos = [c.tipo for c in ln.componentes]
    if ln.destino.papel == "succao":                                       # H08 sucção
        if not any(c.tipo in BLOQUEIO for c in ln.componentes):
            add("H08", "ERRO", tag, "Sucção sem registro de bloqueio: a bomba não pode ser "
                "retirada com o poço/tanque cheio.")
        reds = [c for c in ln.componentes if c.tipo == "reducao"]
        horizontal_final = abs(segs[-1][3].Z) < 0.1
        for c in reds:
            if horizontal_final and not (c.extra.get("excentrica") and
                                         c.extra.get("plano", "topo") == "topo"):
                add("H08", "ERRO", tag, f"{c.tag}: redução na sucção horizontal deve ser "
                    "excêntrica com geratriz superior reta (evita bolsa de ar na entrada da bomba).")
        zs = [p.Z for p in ln.vertices]
        if max(zs[1:-1] or [-1e9]) > max(zs[0], zs[-1]) + 0.5 * ln.tubo.de:
            add("H08", "ERRO", tag, "Ponto alto na sucção: acumula ar e desescorva a bomba.")
    if ln.origem.papel == "recalque":                                      # H08 recalque
        iniciais = [c for c in ln.componentes if c.s0 < 5000 and c.tipo in FLANGEADOS]
        t_ini = [c.tipo for c in iniciais]
        if "retencao" not in t_ini:
            add("H08", "ERRO", tag, "Recalque sem válvula de retenção junto à bomba (golpe e "
                "retorno de água pela bomba parada).")
        elif not any(t in BLOQUEIO for t in t_ini[t_ini.index("retencao") + 1:]):
            add("H08", "ERRO", tag, "Recalque sem registro de bloqueio a jusante da retenção "
                "(ordem correta: bomba → retenção → registro).")
        if "junta_desmontagem" not in tipos:
            add("H08", "AVISO", tag, "Sem junta de desmontagem junto às válvulas do recalque: "
                "a retirada de válvula/bomba exige cortar a linha.")
    # pontos altos em linha pressurizada pedem ventosa
    for i in range(1, len(ln.vertices) - 1):
        a, b = ln.vertices[i - 1].Z, ln.vertices[i].Z
        if b > a + 1 and all(p.Z <= b + 1 for p in ln.vertices[i:]):
            # descarga livre (ponto livre ou entrada de tanque) expulsa o ar sozinha
            livre = ln.destino.junta == "livre" or ln.destino.papel == "entrada"
            if not livre and "ventosa" not in tipos and not ln.spec.get("ponto_alto"):
                add("H10", "AVISO", tag, f"Ponto alto em {_fmt(ln.vertices[i])} sem ventosa: "
                    "ar acumulado reduz a seção e causa golpes.")
                break


def _validar_bocais(m: Modelo, add) -> None:
    usados = set()
    for ln in m.linhas.values():
        usados.add(ln.origem.nome)
        usados.add(ln.destino.nome)
    for nome, p in m.portas.items():
        eq = m.equipamentos.get(p.equipamento or "", {})
        if nome not in usados:
            add("H11", "AVISO", nome, "Bocal sem linha conectada: prever flange cego ou remover.")
        if eq.get("tipo") != "tanque":
            continue
        ln = next((x for x in m.linhas.values() if nome in (x.origem.nome, x.destino.nome)), None)
        tb = ln.tubo if ln else None
        di = tb.di if tb else p.dn
        soleira, coroa = p.ponto.Z - di / 2, p.ponto.Z + di / 2
        na_max, borda, fundo = eq.get("na_max"), eq["borda"], eq["z_fundo"]
        if p.papel == "extravasor":
            if na_max is not None and soleira < na_max:
                add("H07", "ERRO", nome, f"Extravasor com soleira {soleira:.0f} abaixo do N.A. "
                    f"máximo {na_max:.0f}: o tanque não atinge o nível de operação.")
            if coroa > borda:
                add("H07", "ERRO", nome, f"Extravasor com geratriz superior {coroa:.0f} acima da "
                    f"borda {borda:.0f}: o tanque transborda antes de extravasar.")
        if p.papel == "descarga":
            if soleira > fundo + 150:
                add("H07", "AVISO", nome, f"Descarga de fundo com soleira {soleira - fundo:.0f} mm "
                    "acima do fundo: não esvazia o tanque.")
        if p.papel in ("descarga", "saida", "succao") and ln and ln.origem.nome == nome:
            perto = [c for c in ln.componentes if c.s0 < 3000 and c.tipo in BLOQUEIO]
            abaixo_na = (eq.get("na") is not None and coroa < float(eq["na"])
                         and not p.extra.get("caixa_nivel"))   # caixa de nível: lado atmosférico
            if not perto and (p.papel == "descarga" or abaixo_na):
                add("H07", "ERRO" if p.papel != "saida" else "AVISO", nome,
                    f"Bocal de {p.papel} abaixo do N.A. sem registro nos primeiros 3 m da linha "
                    f"{ln.tag}: não há como isolar o tanque.")


def _validar_vaos(m: Modelo, ln: Linha, segs, add) -> None:
    if ln.spec.get("suportes", ln.regime == "pressao") is False:
        return
    for _, A, B, d, s0, s1 in segs:
        if abs(d.Z) > 0.1:
            continue
        tb = ln.tubo_em(s0 + 0.5)
        if min(A.Z, B.Z) - tb.de / 2 - float(ln.spec.get("z_piso", m.piso)) < 60:
            continue
        if min(A.Z, B.Z) > float(ln.spec.get("z_max_apoio", 2500)):
            continue            # trecho elevado: apoio em pipe-rack/estrutura (S6), fora deste modelo
        apoios = sorted([0.0, (B - A).length] + [
            (p - A).dot(d) for p in ln.suportes if 0 <= (p - A).dot(d) <= (B - A).length + 1
            and ((p - A) - d * (p - A).dot(d)).length < 5])
        maior = max(b - a for a, b in zip(apoios, apoios[1:]))
        vao = normas.vao_maximo(tb)
        if maior > vao * 1.05:
            add("H12", "AVISO", ln.tag, f"Vão livre de {maior / 1000:.2f} m entre apoios em "
                f"{_fmt(A)}→{_fmt(B)}; máximo recomendado {vao / 1000:.2f} m para {tb.descricao}.")


def _dono(m: Modelo, grupo: str) -> str:
    if grupo.endswith("-ROTOR"):          # eixo+rotor pertence ao próprio misturador
        return grupo[: -len("-ROTOR")]
    for ln in m.linhas.values():          # linhas primeiro (tags de linha não contêm tags de tanque)
        if grupo.startswith(ln.tag + "-") or grupo == f"S-{ln.tag}":
            return ln.tag
    for eq in m.equipamentos:             # bocais, instrumentos e acessórios do equipamento
        if grupo == eq or f"-{eq}-" in grupo or grupo.endswith(f"-{eq}"):
            return eq
    for ln in m.linhas.values():
        if grupo.startswith(ln.tag + "-") or grupo == f"S-{ln.tag}":
            return ln.tag
        for c in ln.componentes:
            if grupo.startswith(c.tag + "-"):
                return ln.tag
    for nome, p in m.portas.items():
        tag_bocal = nome.split(".")[1]
        if grupo.startswith(f"{tag_bocal}-{p.equipamento}-"):
            return p.equipamento
    return grupo


def _validar_colisoes(m: Modelo, add) -> None:
    """H13: interferência física. Entre peças ligadas (linha × seu equipamento, linha × ramal)
    só se tolera o contato na própria junta (esfera de um diâmetro de flange em torno dela)."""
    juntas = {}
    for ln in m.linhas.values():
        for p in (ln.origem, ln.destino):
            dono = p.equipamento
            if dono:
                raio = normas.flange(p.dn).D if p.dn in normas.FLANGE_PN10 else 300
                juntas.setdefault(frozenset((ln.tag, dono)), []).append((p.ponto, raio))
    donos = {}
    for grupo, itens in m.pecas.items():
        donos.setdefault(_dono(m, grupo), []).extend(s for s, _ in itens)
    nomes = sorted(donos)
    caixas = {n: [s.bounding_box() for s in donos[n]] for n in nomes}
    for i, a in enumerate(nomes):
        for b in nomes[i + 1:]:
            tolerado = juntas.get(frozenset((a, b)), [])
            vol = 0.0
            for sa, ba in zip(donos[a], caixas[a]):
                for sb, bb in zip(donos[b], caixas[b]):
                    if not _caixas_tocam(ba, bb):
                        continue
                    try:
                        inter = sa & sb
                        v = inter.volume
                    except Exception:
                        continue
                    if v <= 0:
                        continue
                    c = inter.bounding_box().center()
                    if any((c - P).length <= raio for P, raio in tolerado):
                        continue
                    vol += v
            if vol > 2000:
                add("H13", "ERRO", f"{a} × {b}", f"Interferência física de {vol / 1e6:.3f} dm³ "
                    "entre peças sem ligação: reveja o traçado.")


def _caixas_tocam(a, b) -> bool:
    return (a.min.X <= b.max.X and b.min.X <= a.max.X and a.min.Y <= b.max.Y and
            b.min.Y <= a.max.Y and a.min.Z <= b.max.Z and b.min.Z <= a.max.Z)


def _fmt(v: Vector) -> str:
    return f"({v.X:.0f}, {v.Y:.0f}, {v.Z:.0f})" if abs(v.length - 1) > 1e-3 else \
        f"({v.X:.2f}, {v.Y:.2f}, {v.Z:.2f})"


def relatorio(m: Modelo, achados: list[Achado]) -> str:
    erros = [a for a in achados if a.nivel == "ERRO"]
    avisos = [a for a in achados if a.nivel == "AVISO"]
    status = "REPROVADO" if erros else "APROVADO" + (" com avisos" if avisos else "")
    out = [f"# Verificação físico-hidráulica: {m.spec.get('projeto', 'modelo')}", "",
           f"**Resultado: {status}** · {len(erros)} erro(s), {len(avisos)} aviso(s)", "",
           "## Linhas", "", "| Linha | Material | Regime | Comprimento (m) | Destaques |",
           "|---|---|---|---|---|"]
    for ln in m.linhas.values():
        dest = []
        if ln.regime == "gravidade":
            u = ln.sifao_u
            incl = [(-(B.Z - A.Z) / math.hypot(B.X - A.X, B.Y - A.Y))
                    for _, A, B, d, *_ in _segmentos(ln) if math.hypot(B.X - A.X, B.Y - A.Y) > 10
                    and abs(B.Z - A.Z) < math.hypot(B.X - A.X, B.Y - A.Y)
                    and not (u and _sobre(A, B, u[0], u[1]))]
            if incl:
                dest.append(f"i mín {min(incl) * 100:.2f} %")
            if getattr(ln, "_selo_calculado", None) is not None:
                dest.append(f"selo {ln._selo_calculado:.0f} mm")
        if ln.spec.get("vazao_ls"):
            tb = ln.tubo_em(ln.comprimento / 2)
            v = ln.spec["vazao_ls"] / 1000 / (math.pi * (tb.di / 1000) ** 2 / 4)
            dest.append(f"Q {ln.spec['vazao_ls']} L/s, v {v:.2f} m/s")
        comps = ", ".join(f"{c.tag}" for c in ln.componentes if c.tipo != "te")
        if comps:
            dest.append(comps)
        out.append(f"| {ln.tag} | {ln.tubo_em(ln.comprimento / 2).descricao} | {ln.regime} | "
                   f"{ln.comprimento / 1000:.2f} | {'; '.join(dest)} |")
    out += ["", "## Achados", ""]
    if not achados:
        out.append("Nenhum achado.")
    else:
        out += ["| Código | Nível | Objeto | Descrição |", "|---|---|---|---|"]
        for a in sorted(achados, key=lambda a: (a.nivel != "ERRO", a.codigo)):
            out.append(f"| {a.codigo} | {a.nivel} | {a.objeto} | {a.mensagem} |")
    out += ["", "## Regras verificadas", "",
            "H01 montagem possível · H02 linhas no eixo dos bocais · H03 DN/PN compatíveis · "
            "H04 curvas comerciais · H05 declividade e sentido em conduto livre · H06 selo hídrico "
            "do sifão · H07 entrada, extravasor e descarga do tanque · H08 sucção e recalque de "
            "bombas · H09 velocidades · H10 ventosas em pontos altos · H11 bocais sem ligação · "
            "H12 vão entre apoios · H13 interferências físicas · H14 separação atmosférica / "
            "quebra-vácuo na entrada · H15 perna de nível com respiro · H16 submergência mínima "
            "(ANSI/HI 9.8) · H17 respiro de tanque fechado · H18 caixa de nível e lâmina do "
            "vertedor · H19 extravasor livre e com capacidade · H20 curto-circuito e vórtice em "
            "tanque de mistura.", "",
            "Dimensões de tubos e flanges: tabelas em `hidraulica/normas.py` (DE e furação "
            "normativos; espessuras e face a face típicos de catálogo)."]
    return "\n".join(out) + "\n"


# --- Tanques atmosféricos: entrada, saída, extravasor, respiro, submergência ----------------

G = 9.81


def _vazao_entrada(m: Modelo, tag: str) -> float | None:
    eq = m.equipamentos[tag]
    if eq.get("vazao_max_ls"):
        return float(eq["vazao_max_ls"])
    qs = [ln.spec["vazao_ls"] for ln in m.linhas.values()
          if ln.destino.equipamento == tag and ln.spec.get("vazao_ls")]
    return float(sum(qs)) if qs else None


def _orificio(di_mm: float, carga_mm: float, cd: float = 0.6) -> float:
    """Vazão (L/s) de um bocal afogado sob carga sobre o eixo."""
    if carga_mm <= 0:
        return 0.0
    a = math.pi * (di_mm / 1000) ** 2 / 4
    return cd * a * math.sqrt(2 * G * carga_mm / 1000) * 1000


def _validar_tanques(m: Modelo, add) -> None:
    for tag, eq in m.equipamentos.items():
        if eq.get("tipo") != "tanque":
            continue
        portas = [p for p in m.portas.values() if p.equipamento == tag]
        sai_de = {ln.origem.nome: ln for ln in m.linhas.values()}
        chega_em = {ln.destino.nome: ln for ln in m.linhas.values()}
        extravasores = [p for p in portas if p.papel == "extravasor"]
        transb = (min(p.ponto.Z - (p.di or p.dn) / 2 for p in extravasores) if extravasores
                  else eq.get("na_max"))
        q_in = _vazao_entrada(m, tag)
        for p in portas:
            di = p.di or float(p.dn)
            soleira = p.ponto.Z - di / 2
            # H14 entradas: separação atmosférica ou tubo mergulhado com quebra-vácuo
            if p.papel == "entrada" and transb is not None:
                ln = chega_em.get(p.nome)
                if p.extra.get("tubo_imersao"):
                    zq = p.extra.get("_z_quebra_vacuo")
                    if zq is None:
                        add("H14", "ERRO", p.nome, "Tubo mergulhado sem furo quebra-vácuo: ao "
                            "parar a alimentação o tanque sifona de volta para a linha de chegada.")
                    elif zq < transb + 25:
                        add("H14", "ERRO", p.nome, f"Quebra-vácuo em EL {zq:.0f} abaixo do nível de "
                            f"transbordamento {transb:.0f} + 25 mm: fica afogado e não admite ar.")
                else:
                    req = 3 * di          # bocal na parede: 3×DI (parede junto à saída)
                    if soleira >= transb + req:
                        pass
                    elif soleira >= transb:
                        add("H14", "ERRO", p.nome, f"Separação atmosférica de {soleira - transb:.0f} mm "
                            f"entre a soleira da entrada e o nível de transbordamento ({transb:.0f}); "
                            f"mínimo {req:.0f} mm (3×DI, ASME A112.1.2 / códigos prediais).")
                    elif ln and any(c.tipo == "retencao" for c in ln.componentes):
                        add("H14", "AVISO", p.nome, "Entrada afogada protegida só por retenção: "
                            "prefira descarga livre acima do transbordamento ou tubo mergulhado com "
                            "quebra-vácuo.")
                    else:
                        add("H14", "ERRO", p.nome, f"Entrada afogada (soleira {soleira:.0f} abaixo do "
                            f"transbordamento {transb:.0f}) sem proteção: o tanque pressuriza a linha "
                            "de chegada (remanso) e pode sifonar para ela.")
            # H15 perna de nível: ponto alto na saída exige respiro acima da borda
            ln = sai_de.get(p.nome)
            if p.papel in ("saida", "descarga") and ln is not None:
                zs = [v.Z for v in ln.vertices]
                i_c = max(range(len(zs)), key=lambda i: zs[i])
                if zs[i_c] > zs[0] + 1 and min(zs[i_c:]) < zs[i_c] - 1:
                    respiros = [x for x in m.linhas.values() if x.regime == "ventilacao"
                                and x.origem.equipamento == ln.tag
                                and abs(x.vertices[0].Z - zs[i_c]) < 2 * ln.tubo.de]
                    if not respiros:
                        add("H15", "ERRO", ln.tag, f"Saída sobe até EL {zs[i_c]:.0f} e desce sem "
                            "respiro na crista: o trecho descendente funciona como sifão e esvazia o "
                            "tanque até a cota do bocal (subpressão).")
                    for r in respiros:
                        topo = r.destino.ponto.Z
                        if topo <= eq["borda"]:
                            add("H15", "ERRO", r.tag, f"Respiro termina em EL {topo:.0f}, abaixo da "
                                f"borda {eq['borda']:.0f}: transborda pelo respiro.")
                    nivel = zs[i_c] - ln.tubo.di / 2
                    if eq.get("na") is not None and abs(nivel - float(eq["na"])) > 50:
                        add("H15", "AVISO", ln.tag, f"Perna de nível fixa o N.A. em ~{nivel:.0f} "
                            f"(soleira da crista), diferente do N.A. declarado {eq['na']}.")
            # H16 submergência mínima (ANSI/HI 9.8) em saídas pressurizadas e sucções
            if ln is not None and p.papel in ("succao", "saida") and ln.spec.get("vazao_ls") and (
                    ln.regime == "pressao") and eq.get("na_min") is not None:
                D = di / 1000
                v = ln.spec["vazao_ls"] / 1000 / (math.pi * D ** 2 / 4)
                S = D * (1 + 2.3 * v / math.sqrt(G * D)) * 1000
                disp = float(eq["na_min"]) - p.ponto.Z
                if disp < S:
                    add("H16", "ERRO", p.nome, f"Submergência {disp:.0f} mm sobre o eixo no N.A. "
                        f"mínimo; exigido {S:.0f} mm (S = D(1+2,3Fr), ANSI/HI 9.8): entra ar por "
                        "vórtice.")
                if p.papel == "succao" and not p.extra.get("quebra_vortice"):
                    add("H16", "AVISO", p.nome, "Sucção sem quebra-vórtice na boca.")
            # H18 caixa de nível (saída por transbordamento)
            cfg = p.extra.get("caixa_nivel")
            if cfg:
                crista, L = float(cfg["crista"]), float(cfg["largura"])
                if p.ponto.Z + di / 2 > crista:
                    add("H18", "ERRO", p.nome, "Bocal de saída acima da crista do vertedor: a caixa "
                        "não drena.")
                if float(cfg["fundo"]) > soleira:
                    add("H18", "ERRO", p.nome, "Fundo da caixa de nível acima da soleira do bocal.")
                if q_in:
                    h = (q_in / 1000 / (1.84 * L / 1000)) ** (2 / 3) * 1000
                    na_calc = crista + h
                    eq["_na_calc"] = na_calc
                    if eq.get("na") is not None and abs(float(eq["na"]) - na_calc) > 30:
                        add("H18", "AVISO", tag, f"N.A. declarado {eq['na']} difere do calculado "
                            f"{na_calc:.0f} (crista {crista:.0f} + lâmina {h:.0f} mm, Francis, "
                            f"Q = {q_in:g} L/s, L = {L:.0f} mm).")
                    if transb is not None and na_calc > transb - 50:
                        add("H18", "ERRO", tag, f"N.A. de operação {na_calc:.0f} a menos de 50 mm "
                            f"do transbordamento {transb:.0f}: o extravasor trabalha em regime normal.")
                    q_cap = _orificio(di, crista - p.ponto.Z)
                    if q_cap < q_in:
                        add("H18", "ERRO", p.nome, f"Bocal da caixa de nível escoa {q_cap:.1f} L/s com "
                            f"a carga disponível; entram {q_in:g} L/s: a caixa afoga o vertedor.")
                if ln is not None and ln.regime != "gravidade":
                    add("H18", "AVISO", ln.tag, "Saída da caixa de nível deveria ser conduto livre.")
            # H19 extravasor
            if p.papel == "extravasor":
                if ln is not None:
                    if any(c.tipo in BLOQUEIO or c.tipo == "retencao" for c in ln.componentes):
                        add("H19", "ERRO", ln.tag, "Extravasor com válvula: fechado ou travado, o "
                            "tanque transborda pela borda.")
                    if ln.sifao:
                        add("H19", "AVISO", ln.tag, "Sifão no extravasor: reduz a capacidade e pode "
                            "travar com ar; use descarga livre em caixa aberta e, se precisar de "
                            "fecho hídrico, ponha o desconector depois dela.")
                    if ln.destino.junta != "livre" and ln.destino.papel != "entrada":
                        add("H19", "AVISO", ln.tag, "Extravasor sem descarga livre visível no destino.")
                if q_in:
                    H = eq["borda"] - 100 - soleira
                    q_cap = (_orificio(di, H - di / 2) if H > di else
                             1.84 * (di / 1000) * max(H, 0) / 1000 * math.sqrt(max(H, 0) / 1000) * 1000)
                    if q_cap < q_in:
                        add("H19", "ERRO", p.nome, f"Extravasor escoa {q_cap:.1f} L/s até 100 mm "
                            f"abaixo da borda; entram até {q_in:g} L/s.")
        # H17 tanque fechado precisa respirar
        if eq.get("fechado"):
            dns = [p.dn for p in portas if p.papel in ("entrada", "saida", "succao", "descarga")]
            if not eq.get("respiro"):
                add("H17", "ERRO", tag, "Tanque fechado sem respiro: enche sob pressão e esvazia "
                    "sob vácuo (risco de colapso da tampa e de sifonamento).")
            elif dns and int(eq["respiro"]["dn"]) < max(dns):
                add("H17", "ERRO", tag, f"Respiro DN{eq['respiro']['dn']} menor que a maior ligação "
                    f"DN{max(dns)}: não acompanha a vazão de enchimento/esvaziamento.")
        # H20 mistura: curto-circuito e vórtice
        if eq.get("misturador") or eq.get("uso") == "mistura":
            cx, cy = eq["centro"]
            ent = [p for p in portas if p.papel == "entrada"]
            sai = [p for p in portas if p.papel in ("saida", "succao")]
            for a in ent:
                for b in sai:
                    va = Vector(a.ponto.X - cx, a.ponto.Y - cy, 0).normalized()
                    vb = Vector(b.ponto.X - cx, b.ponto.Y - cy, 0).normalized()
                    ang = math.degrees(math.acos(max(-1, min(1, va.dot(vb)))))
                    if ang < 90:
                        add("H20", "AVISO", f"{a.nome}/{b.nome}", f"Entrada e saída a {ang:.0f}° em "
                            "planta: risco de curto-circuito; afaste para ≥ 90° (ideal 180°).")
            if eq.get("misturador") and eq["cil"] and not eq.get("chicanas"):
                add("H20", "AVISO", tag, "Tanque cilíndrico com misturador sem chicanas: forma "
                    "vórtice central e a mistura gira em bloco (use 4 chicanas de D/12).")
