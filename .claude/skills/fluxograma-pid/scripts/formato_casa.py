"""Formato gráfico da casa para P&ID (referência visual: padrão MACh/Vale 0174GG, A1).

Tudo aqui atua sobre o DXF que o servidor `autocad-mcp-pro` já desenhou:
- cor, tipo e espessura de linha por serviço (lidos do número de linha no XDATA);
- símbolos próprios onde o catálogo ISO não tem (esteira, triturador, balança...);
- linhas desenhadas pela casa (transporte de sólidos, conexão de instrumento);
- áreas tracejadas com título, cotas de nível;
- faixa inferior (notas, documentos de referência, revisões) e carimbo;
- quadros de legenda (folha F00).
"""

from __future__ import annotations

import json
import re

from ezdxf.enums import TextEntityAlignment

# --- serviços (fluidos) -------------------------------------------------------------------
# código: (descrição, RGB, tipo de linha, espessura em 1/100 mm)
SERVICOS_PADRAO: dict[str, tuple[str, tuple[int, int, int], str, int]] = {
    "LODO": ("Lodo / digestato (fase líquida)", (150, 75, 0), "Continuous", 50),
    "SOL": ("Resíduo sólido (transporte mecânico)", (60, 60, 60), "TRACO_PONTO", 50),
    "AGUA": ("Água de processo / reposição", (0, 150, 200), "Continuous", 35),
    "AT": ("Água tratada de caldeira", (0, 110, 160), "TRACO", 35),
    "QUIM": ("Produto químico (dosagem)", (200, 0, 200), "TRACO", 35),
    "BRUTO": ("Biogás bruto (coletor comum, IIC)", (215, 165, 0), "Continuous", 50),
    "ACID": ("Gás ácido do R-101 (H2, IIC) - rota RG-01", (230, 110, 0), "TRACO", 50),
    "TRAT": ("Biogás dessulfurizado", (190, 150, 0), "TRACO", 50),
    "GAS": ("Biometano", (0, 140, 70), "Continuous", 50),
    "ALIV": ("Alívio / respiro para local seguro", (220, 0, 0), "TRACO", 35),
    "N2": ("Nitrogênio (partida e purga)", (110, 60, 170), "TRACO", 35),
    "VP": ("Vapor de processo", (210, 30, 30), "Continuous", 50),
    "CD": ("Condensado / flash", (230, 120, 120), "TRACO", 35),
    "GLP": ("Gás combustível (GLP)", (120, 120, 0), "TRACO_PONTO", 35),
    "AR": ("Ar de processo / suporte", (0, 70, 220), "TRACO", 35),
    "DR": ("Dreno, by-pass e extravasor", (0, 160, 60), "TRACO", 35),
    # saneamento (ETE)
    "EB": ("Esgoto bruto", (0, 0, 0), "Continuous", 50),
    "EQ": ("Esgoto equalizado", (0, 0, 0), "Continuous", 50),
    "LM": ("Licor misto", (90, 90, 90), "Continuous", 50),
    "ET": ("Efluente tratado", (0, 120, 60), "Continuous", 50),
    "LO": ("Lodo", (150, 75, 0), "Continuous", 50),
    "AS": ("Água de serviço", (0, 150, 200), "Continuous", 35),
    "BG": ("Biogás", (215, 165, 0), "Continuous", 50),
}

TIPOS_LINHA = {
    "TRACO": [9.0, 6.0, -3.0],
    "TRACO_PONTO": [12.0, 8.0, -1.5, 1.0, -1.5],
    "PONTILHADO": [3.0, 1.0, -2.0],
}

CAMADA_SINAL = "INSTRUMENT-LINE-SIGNAL"


def _rgb_int(rgb) -> int:
    return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]


def preparar_estilos(doc) -> None:
    for nome, padrao in TIPOS_LINHA.items():
        if nome not in doc.linetypes:
            doc.linetypes.add(nome, pattern=padrao, description=nome)
    # símbolos e textos em preto (padrão de referência); a cor fica só nas linhas por serviço
    for nome in ("PROCESS-EQUIPMENT", "PROCESS-VALVES", "INSTRUMENT-SYMBOL", "PROCESS-LINE-TEXT", "TEXT",
                 "PROCESS-EQUIPMENT-TEXT", "INSTRUMENT-TEXT", "TITLEBLOCK"):
        if nome in doc.layers:
            doc.layers.get(nome).dxf.color = 7
    if CAMADA_SINAL in doc.layers:
        lay = doc.layers.get(CAMADA_SINAL)
        lay.dxf.color = 3
    st = doc.styles.get("Standard")
    st.dxf.font = "arial.ttf"
    for nome, cor in (("CASA-FORMATO", 7), ("CASA-TEXTO", 7), ("CASA-AREAS", 30), ("CASA-COTAS", 7),
                      ("CASA-SIMBOLOS", 7), ("CASA-CONEXAO", 7), ("NOTAS", 7)):
        if nome not in doc.layers:
            doc.layers.add(nome, color=cor)
    doc.layers.get("CASA-CONEXAO").dxf.linetype = "PONTILHADO"


def servico_de(numero: str | None, servicos: dict) -> str | None:
    """Código de serviço contido no número de linha (ex.: 'DE63-LODO-1009' -> 'LODO')."""
    if not numero:
        return None
    for tok in re.split(r"[-_/ ]", numero.upper()):
        if tok in servicos:
            return tok
    return None


def camada_servico(doc, cod: str, servicos: dict) -> str:
    desc, rgb, lt, lw = servicos[cod]
    nome = f"LIN-{cod}"
    if nome not in doc.layers:
        doc.layers.add(nome, true_color=_rgb_int(rgb), linetype=lt, lineweight=lw)
    return nome


def aplicar_servicos(doc, servicos: dict) -> set[str]:
    """Move cada linha de processo para a camada do seu serviço; setas de fluxo seguem a linha."""
    msp = doc.modelspace()
    usados: set[str] = set()
    pontas: list[tuple[tuple[float, float], str]] = []
    for pl in msp.query("LWPOLYLINE"):
        if not pl.has_xdata("ACADMCP_PID"):
            continue
        try:
            dados = json.loads("".join(str(t.value) for t in pl.get_xdata("ACADMCP_PID")[1:]))
        except (ValueError, IndexError):
            continue
        sinal = ("electric", "pneumatic", "hydraulic", "capillary", "data")
        if dados.get("kind") != "line" or dados.get("class") in sinal:
            continue
        cod = servico_de(dados.get("number"), servicos)
        if not cod:
            continue
        pl.dxf.layer = camada_servico(doc, cod, servicos)
        pl.dxf.lineweight = -1
        usados.add(cod)
        pts = [(p[0], p[1]) for p in pl.get_points()]
        pontas += [(pts[0], pl.dxf.layer), (pts[-1], pl.dxf.layer)]
    for ins in msp.query("INSERT"):
        if "MARKER_ARROW" in ins.dxf.name and pontas:
            x, y = ins.dxf.insert.x, ins.dxf.insert.y
            p, lay = min(pontas, key=lambda t: (t[0][0] - x) ** 2 + (t[0][1] - y) ** 2)
            if (p[0] - x) ** 2 + (p[1] - y) ** 2 < 400:
                ins.dxf.layer = lay
    return usados


# --- textos ----------------------------------------------------------------------------------
def texto(msp, s, x, y, h=2.5, alinh="L", camada="CASA-TEXTO", cor=None):
    al = {"L": TextEntityAlignment.LEFT, "C": TextEntityAlignment.CENTER, "R": TextEntityAlignment.RIGHT,
          "MC": TextEntityAlignment.MIDDLE_CENTER, "ML": TextEntityAlignment.MIDDLE_LEFT}[alinh]
    t = msp.add_text(s, height=h, dxfattribs={"layer": camada, "style": "Standard"})
    t.set_placement((x, y), align=al)
    if cor is not None:
        t.dxf.true_color = _rgb_int(cor)
    return t


def largura_texto(s: str, h: float) -> float:
    """Largura real do texto (métrica da fonte que o renderizador vai usar; Arial ou o substituto)."""
    try:
        from ezdxf.fonts import fonts

        return fonts.make_font("arial.ttf", h).text_width(s)
    except Exception:  # sem fonte disponível: estimativa conservadora
        return len(s) * 0.75 * h


def quebrar(s: str, largura: float, h: float, recuo: str = "    ") -> list[str]:
    """Quebra de linha pela largura medida; continuação recuada."""
    linhas, atual = [], ""
    for palavra in s.split():
        tentativa = f"{atual} {palavra}" if atual.strip() else (atual + palavra)
        if atual.strip() and largura_texto(tentativa, h) > largura:
            linhas.append(atual)
            atual = recuo + palavra
        else:
            atual = tentativa
    if atual:
        linhas.append(atual)
    return linhas


def retangulo(msp, x0, y0, x1, y1, camada="CASA-FORMATO", lw=35):
    return msp.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True,
                              dxfattribs={"layer": camada, "lineweight": lw})


def linha(msp, x0, y0, x1, y1, camada="CASA-FORMATO", lw=18):
    return msp.add_line((x0, y0), (x1, y1), dxfattribs={"layer": camada, "lineweight": lw})


# --- faixa inferior e carimbo (A1/A0) --------------------------------------------------------
TIPOS_EMISSAO = ["(A) PRELIMINAR", "(B) PARA APROVAÇÃO", "(C) PARA CONHECIMENTO", "(D) PARA COTAÇÃO",
                 "(E) PARA CONSTRUÇÃO", "(F) CONFORME COMPRADO", "(G) CONFORME CONSTRUÍDO", "(H) CANCELADO"]


def desenhar_formato(msp, folha: dict, notas: list[str], tamanho: str) -> tuple[float, float, float, float]:
    """Faixa inferior com NOTAS | DOCUMENTOS DE REFERÊNCIA | REVISÕES | CARIMBO.
    Devolve a área útil de desenho (x0, y0, x1, y1)."""
    W, H = {"A1": (841, 594), "A0": (1189, 841)}[tamanho]
    x0, x1, yb = 20.0, W - 10.0, 10.0
    yt = yb + 72.0  # topo da faixa
    xc = x1 - 180.0  # carimbo
    xr = xc - 185.0  # revisões
    xd = xr - 170.0  # documentos
    retangulo(msp, x0, yb, x1, yt, lw=50)
    for xx in (xd, xr, xc):
        linha(msp, xx, yb, xx, yt, lw=35)

    def cabec(xa, xb, titulo):
        linha(msp, xa, yt - 6, xb, yt - 6)
        texto(msp, titulo, (xa + xb) / 2, yt - 4.4, 3.0, "C")

    # NOTAS
    cabec(x0, xd, "NOTAS")
    y = yt - 10.5
    for n in notas:
        for ln in quebrar(n, xd - x0 - 6, 2.2):
            if y < yb + 2.5:
                break
            texto(msp, ln, x0 + 3, y, 2.2)
            y -= 3.4
    # DOCUMENTOS DE REFERÊNCIA
    cabec(xd, xr, "DOCUMENTOS DE REFERÊNCIA")
    y = yt - 10.5
    for k, d in enumerate(folha.get("documentos", []), 1):
        for j, ln in enumerate(quebrar(f"{k} - {d}", xr - xd - 6, 2.2)):
            texto(msp, ln, xd + 3, y, 2.2)
            y -= 3.4
    # REVISÕES
    cabec(xr, xc, "REVISÕES")
    cols = [("REV.", 10), ("T.E.", 9), ("DESCRIÇÃO", 86), ("PROJ.", 16), ("VER.", 16), ("APR.", 16), ("DATA", 32)]
    yh = yb + 30.0
    linha(msp, xr, yh, xc, yh)
    linha(msp, xr, yh - 5, xc, yh - 5)
    xx = xr
    for nome, w in cols:
        texto(msp, nome, xx + w / 2, yh - 3.8, 2.0, "C")
        linha(msp, xx, yb + 18, xx, yt - 6) if xx > xr else None
        xx += w
    revs = folha.get("revisoes", [])
    for i, rv in enumerate(revs[-4:]):
        yy = yh + 2 + i * 5.5
        xx = xr
        for (nome, w), val in zip(cols, rv):
            texto(msp, str(val), xx + (w / 2 if nome != "DESCRIÇÃO" else 1.5), yy, 2.0,
                  "C" if nome != "DESCRIÇÃO" else "L")
            xx += w
    # tipos de emissão
    linha(msp, xr, yb + 18, xc, yb + 18)
    texto(msp, "T.E. -", xr + 2, yb + 13.5, 2.0)
    for i, te in enumerate(TIPOS_EMISSAO):
        texto(msp, te, xr + 14 + (i // 3) * 58, yb + 13.5 - (i % 3) * 4.2, 1.9)
    # CARIMBO
    k = xc
    linha(msp, k, yt - 16, x1, yt - 16)
    texto(msp, folha.get("empresa", "INTELECTO & CSTR"), k + 4, yt - 10, 5.0, "L", cor=(0, 70, 140))
    texto(msp, "CLASSIFICAÇÃO", x1 - 3, yt - 5, 1.8, "R")
    texto(msp, folha.get("classificacao", "USO INTERNO"), x1 - 3, yt - 11, 3.0, "R")
    linha(msp, k, yt - 24, x1, yt - 24)
    texto(msp, "PROJETO", k + 1.5, yt - 18.4, 1.8)
    texto(msp, folha.get("projeto", ""), k + 22, yt - 21.5, 3.2)
    linha(msp, k, yt - 42, x1, yt - 42)
    texto(msp, "TÍTULO", k + 1.5, yt - 26.4, 1.8)
    for i, ln in enumerate(quebrar(folha.get("titulo", ""), 172, 3.2, "")[:3]):
        texto(msp, ln, k + 4, yt - 31.8 - i * 4.6, 3.2)
    # linha de campos
    linha(msp, k, yt - 54, x1, yt - 54)
    campos = [("Nº DO DESENHO", folha.get("numero", ""), 92), ("REV.", folha.get("revisao", ""), 18),
              ("FOLHA", folha.get("folha", "1/1"), 22), ("ESCALA", folha.get("escala", "S/E"), 48)]
    xx = k
    for nome, val, w in campos:
        texto(msp, nome, xx + 1.5, yt - 44.6, 1.8)
        texto(msp, str(val), xx + 2.5, yt - 51.2, 3.6 if nome == "Nº DO DESENHO" else 3.2)
        xx += w
        if xx < x1 - 1:
            linha(msp, xx, yt - 54, xx, yt - 42)
    campos2 = [("CONTRATO", folha.get("contrato", ""), 92), ("TIPO DE EMISSÃO", folha.get("tipo_emissao", "A"), 40),
               ("DATA", folha.get("data", ""), 48)]
    xx = k
    for nome, val, w in campos2:
        texto(msp, nome, xx + 1.5, yt - 56.6, 1.8)
        texto(msp, str(val), xx + 2.5, yt - 62.5, 2.8)
        xx += w
        if xx < x1 - 1:
            linha(msp, xx, yb, xx, yt - 54)
    return (x0 + 2, yt + 2, x1 - 2, H - 12)


# --- quadros (tabelas) -------------------------------------------------------------------------
def desenhar_quadro(msp, q: dict) -> tuple[float, float]:
    """Tabela com título: {titulo, x, y (topo), colunas: [[nome, largura], ...], linhas: [[...], ...],
    altura (texto, 2,2), fonte (rodapé opcional)}. Células longas quebram dentro da coluna.
    Devolve (largura, altura) ocupadas."""
    x0, ytop, h = q["x"], q["y"], q.get("altura", 2.2)
    cols = q["colunas"]
    W = sum(c[1] for c in cols)
    passo = h * 1.55
    y = ytop
    texto(msp, q["titulo"], x0, y - h * 1.4, h * 1.25)
    y -= h * 2.2
    topo_tab = y
    # cabeçalho
    yh = y - passo * 1.2
    xx = x0
    for nome, w in cols:
        texto(msp, nome, xx + w / 2, yh + passo * 0.35, h * 0.95, "C")
        xx += w
    linha(msp, x0, yh, x0 + W, yh, lw=25)
    y = yh
    for ln_ in q["linhas"]:
        celulas = [quebrar(str(v), w - 2.0, h, "") for v, (_, w) in zip(ln_, cols)]
        n = max(len(c) for c in celulas)
        xx = x0
        for cel, (_, w) in zip(celulas, cols):
            for i, t in enumerate(cel):
                texto(msp, t, xx + 1.0, y - passo * (i + 0.8), h)
            xx += w
        y -= passo * n + 0.6
        linha(msp, x0, y, x0 + W, y, lw=13)
    retangulo(msp, x0, y, x0 + W, topo_tab, lw=35)
    xx = x0
    for _, w in cols[:-1]:
        xx += w
        linha(msp, xx, y, xx, topo_tab, lw=13)
    if q.get("fonte"):
        texto(msp, q["fonte"], x0, y - h * 1.5, h * 0.85)
        y -= h * 1.8
    return W, ytop - y


# --- áreas, cotas e conexões ------------------------------------------------------------------
def desenhar_areas(doc, areas: list[dict]) -> None:
    msp = doc.modelspace()
    for a in areas:
        cor = tuple(a.get("cor", (225, 160, 0)))
        pl = msp.add_lwpolyline([(a["x0"], a["y0"]), (a["x1"], a["y0"]), (a["x1"], a["y1"]), (a["x0"], a["y1"])],
                                close=True, dxfattribs={"layer": "CASA-AREAS", "linetype": "TRACO", "lineweight": 35})
        pl.dxf.true_color = _rgb_int(cor)
        texto(msp, a["titulo"], a["x0"] + 3, a["y1"] - 6, a.get("altura", 4.0), "L", "CASA-AREAS", cor)


def desenhar_cotas(doc, cotas: list[dict]) -> None:
    """Marca de nível: triângulo invertido + texto (ex.: 'NA EL +3,50 m'). Com x0/x1, desenha a linha
    d'água tracejada dentro do vaso, o triângulo no meio e o texto acima (padrão de referência)."""
    msp = doc.modelspace()
    for c in cotas:
        if "x0" in c:
            y, s = c["y"], c.get("tam", 2.0)
            msp.add_line((c["x0"], y), (c["x1"], y), dxfattribs={"layer": "CASA-COTAS", "linetype": "TRACO"})
            xm = (c["x0"] + c["x1"]) / 2
            msp.add_lwpolyline([(xm - s, y + 1.6 * s), (xm + s, y + 1.6 * s), (xm, y)], close=True,
                               dxfattribs={"layer": "CASA-COTAS"})
            texto(msp, c["texto"], xm, y + 1.6 * s + 1.0, c.get("altura", 2.2), "C", "CASA-COTAS")
            continue
        x, y, s = c["x"], c["y"], c.get("tam", 2.5)
        msp.add_lwpolyline([(x - s, y + 1.6 * s), (x + s, y + 1.6 * s), (x, y)], close=True,
                           dxfattribs={"layer": "CASA-COTAS"})
        linha(msp, x - 2.2 * s, y, x + 2.2 * s, y, "CASA-COTAS")
        texto(msp, c["texto"], x + 2.6 * s, y + 0.3, c.get("altura", 2.2), "L", "CASA-COTAS")


def seta(msp, x, y, ang, camada, tam=2.4):
    import math

    a = math.radians(ang)
    p1 = (x - tam * math.cos(a) + 0.42 * tam * math.sin(a), y - tam * math.sin(a) - 0.42 * tam * math.cos(a))
    p2 = (x - tam * math.cos(a) - 0.42 * tam * math.sin(a), y - tam * math.sin(a) + 0.42 * tam * math.cos(a))
    msp.add_solid([(x, y), p1, p2], dxfattribs={"layer": camada})


def desenhar_linhas_casa(doc, linhas: list[dict], servicos: dict) -> set[str]:
    """Linhas desenhadas pela casa (ex.: sólidos sem tubulação): pontos ortogonais, seta no fim."""
    msp = doc.modelspace()
    usados = set()
    for ln in linhas:
        cod = servico_de(ln.get("numero"), servicos) or ln.get("servico")
        if cod == "SINAL":
            if CAMADA_SINAL not in doc.layers:
                doc.layers.add(CAMADA_SINAL, color=3, linetype="TRACO")
            camada = CAMADA_SINAL
        else:
            camada = camada_servico(doc, cod, servicos) if cod in servicos else "CASA-CONEXAO"
        if cod in servicos:
            usados.add(cod)
        pts = [tuple(p) for p in ln["pontos"]]
        msp.add_lwpolyline(pts, dxfattribs={"layer": camada})
        if ln.get("seta", True):
            (xa, ya), (xb, yb) = pts[-2], pts[-1]
            import math
            seta(msp, xb, yb, math.degrees(math.atan2(yb - ya, xb - xa)), camada)
        if ln.get("numero") and ln.get("rotulo", True):
            # rótulo no meio do trecho mais longo; o pós-processamento acha o lugar livre
            seg = max(zip(pts, pts[1:]), key=lambda s: abs(s[0][0] - s[1][0]) + abs(s[0][1] - s[1][1]))
            (xa, ya), (xb, yb) = seg
            t = texto(msp, ln["numero"], (xa + xb) / 2, (ya + yb) / 2 + 1.2, 2.5, "C", "PROCESS-LINE-TEXT")
            if abs(xa - xb) < 0.01:
                t.dxf.rotation = 90
    return usados


def desenhar_conexoes(doc, conexoes: list[dict], bolhas: dict[str, tuple[float, float, float]]) -> None:
    """Ligação do instrumento ao processo (pontilhada fina): da borda da bolha até o ponto."""
    msp = doc.modelspace()
    for c in conexoes:
        if c["de"] not in bolhas:
            continue
        bx, by, r = bolhas[c["de"]]
        x, y = c["ate"]
        if abs(x - bx) >= abs(y - by):  # sai pela lateral, vai na horizontal e desce/sobe
            sx = bx + (r if x > bx else -r)
            pts = [(sx, by), (x, by), (x, y)] if abs(y - by) > 0.01 else [(sx, by), (x, y)]
        else:
            sy = by + (r if y > by else -r)
            pts = [(bx, sy), (bx, y), (x, y)] if abs(x - bx) > 0.01 else [(bx, sy), (x, y)]
        msp.add_lwpolyline(pts, dxfattribs={"layer": "CASA-CONEXAO", "lineweight": 18})


# --- símbolos próprios ---------------------------------------------------------------------
# Cada geometria desenha dentro da caixa [-hw, hw] x [-hh, hh] (meia largura e meia altura),
# para servir tanto de símbolo solto quanto de "aparência" sobre a caixa de um símbolo do catálogo.
import math  # noqa: E402


def _esteira(b, hw, hh):
    r = hh * 0.45
    b.add_lwpolyline([(-hw, -hh * 0.2), (hw, -hh * 0.2), (hw, hh * 0.6), (-hw, hh * 0.6)], close=True)
    n = max(3, int(hw * 2 / (r * 4)))
    for k in range(n):
        b.add_circle((-hw + r + k * (2 * hw - 2 * r) / (n - 1), -hh * 0.2), r * 0.7)
    b.add_line((-hw, -hh), (hw, -hh))


def _triturador(b, hw, hh):
    b.add_lwpolyline([(-hw * 0.7, -hh), (hw * 0.7, -hh), (hw * 0.7, hh * 0.3), (-hw * 0.7, hh * 0.3)], close=True)
    b.add_lwpolyline([(-hw * 0.7, hh * 0.3), (-hw, hh), (hw, hh), (hw * 0.7, hh * 0.3)])
    r = min(hw * 0.28, hh * 0.45)
    for x in (-hw * 0.32, hw * 0.32):
        cy = -hh * 0.35
        b.add_circle((x, cy), r)
        b.add_line((x - r * 0.7, cy - r * 0.7), (x + r * 0.7, cy + r * 0.7))
        b.add_line((x - r * 0.7, cy + r * 0.7), (x + r * 0.7, cy - r * 0.7))


def _balanca(b, hw, hh):
    b.add_lwpolyline([(-hw, -hh * 0.1), (hw, -hh * 0.1), (hw, hh * 0.5), (-hw, hh * 0.5)], close=True)
    for x in (-hw * 0.7, hw * 0.7):
        b.add_lwpolyline([(x - hw * 0.12, -hh * 0.1), (x + hw * 0.12, -hh * 0.1), (x, -hh * 0.8)], close=True)
    b.add_line((-hw, -hh * 0.8), (hw, -hh * 0.8))
    b.add_text("kg", dxfattribs={"height": hh * 0.45, "insert": (-hw * 0.2, hh * 0.05)})


def _macerador(b, hw, hh):
    r = min(hw, hh)
    b.add_circle((0, 0), r)
    for ang in (0, 60, 120):
        a = math.radians(ang)
        b.add_line((-0.8 * r * math.cos(a), -0.8 * r * math.sin(a)), (0.8 * r * math.cos(a), 0.8 * r * math.sin(a)))
    b.add_line((-hw, 0), (-r, 0))
    b.add_line((r, 0), (hw, 0))


def _caldeira(b, hw, hh):
    # caldeira flamotubular: corpo horizontal, chaminé e chama no queimador
    b.add_lwpolyline([(-hw, -hh), (hw, -hh), (hw, hh * 0.5), (-hw, hh * 0.5)], close=True)
    b.add_lwpolyline([(-hw * 0.15, hh * 0.5), (-hw * 0.15, hh), (hw * 0.15, hh), (hw * 0.15, hh * 0.5)])
    for k in range(3):
        y = -hh * 0.6 + k * hh * 0.4
        b.add_line((-hw * 0.55, y), (hw * 0.75, y))
    b.add_lwpolyline([(-hw * 0.95, -hh * 0.2), (-hw * 0.75, -hh * 0.45), (-hw * 0.6, -hh * 0.2),
                      (-hw * 0.75, hh * 0.15)], close=True)


def _gasometro(b, hw, hh):
    b.add_lwpolyline([(-hw, -hh), (hw, -hh)])
    pts = [(hw * math.cos(math.radians(a)), -hh + 2 * hh * math.sin(math.radians(a))) for a in range(0, 181, 10)]
    b.add_lwpolyline(pts)
    pts2 = [(0.8 * hw * math.cos(math.radians(a)), -hh + 1.6 * hh * math.sin(math.radians(a)))
            for a in range(0, 181, 10)]
    b.add_lwpolyline(pts2, dxfattribs={"linetype": "TRACO"})


def _emergencia(b, hw, hh):
    # alívio de emergência bidirecional (tampa de grande área com palheta de vácuo)
    b.add_lwpolyline([(-hw, -hh), (hw, -hh), (hw, -hh * 0.4), (-hw, -hh * 0.4)], close=True)
    b.add_line((0, -hh * 0.4), (0, hh))
    b.add_lwpolyline([(-hw * 0.35, hh * 0.55), (0, hh), (hw * 0.35, hh * 0.55)])
    b.add_lwpolyline([(-hw * 0.35, hh * 0.05), (0, -hh * 0.35), (hw * 0.35, hh * 0.05)])


def _respiro(b, hw, hh):
    b.add_line((0, -hh), (0, hh * 0.3))
    b.add_lwpolyline([(-hw, hh * 0.3), (hw, hh * 0.3), (0, hh)], close=True)


def _amostragem(b, hw, hh):
    b.add_lwpolyline([(-hw, -hh), (hw, -hh), (0, hh)], close=True)


SIMBOLOS_CASA = {
    # nome: (geometria, meia largura, meia altura, portas relativas a (hw, hh), descrição para a legenda)
    "esteira": (_esteira, 20, 6, {"in": (-1, 0.2), "out": (1, 0.2)}, "Esteira / transportador de correia"),
    "triturador": (_triturador, 14, 14, {"in": (0, 1), "out": (0, -1)}, "Triturador de dois eixos com moega"),
    "balanca": (_balanca, 14, 6, {"in": (-1, 0.2), "out": (1, 0.2)}, "Balança de recepção"),
    "macerador": (_macerador, 6, 6, {"in": (-1, 0), "out": (1, 0)}, "Macerador / triturador úmido em linha"),
    "caldeira": (_caldeira, 18, 12, {}, "Caldeira flamotubular (gerador de vapor)"),
    "gasometro": (_gasometro, 20, 12, {}, "Gasômetro de membrana dupla"),
    "emergencia": (_emergencia, 5, 6, {"in": (0, -1)}, "Alívio de emergência bidirecional (pressão/vácuo)"),
    "respiro": (_respiro, 3, 5, {"in": (0, -1)}, "Respiro / descarga para local seguro"),
    "amostragem": (_amostragem, 2.5, 2.5, {"in": (0, -1)}, "Ponto de amostragem"),
}

ATTDEFS_CASA = [("TAG", 0, -2.5, 3.5), ("DESC", 0, -6.5, 2.4)] + [(f"D{i}", 0, -10.0 - 3.2 * i, 2.1) for i in range(6)]


def _bloco_casa(doc, simbolo: str, hw: float, hh: float) -> str:
    nome = f"CASA_{simbolo.upper()}_{hw:g}x{hh:g}".replace(".", "p")
    if nome not in doc.blocks:
        b = doc.blocks.new(nome)
        SIMBOLOS_CASA[simbolo][0](b, hw, hh)
        for tag, x, y, h in ATTDEFS_CASA:
            a = b.add_attdef(tag, (x, y - hh), dxfattribs={"height": h, "layer": "CASA-TEXTO"})
            a.set_placement((x, y - hh), align=TextEntityAlignment.CENTER)
    return nome


def desenhar_simbolos_casa(doc, itens: list[dict], escala: float) -> dict[str, dict[str, tuple[float, float]]]:
    """Símbolos soltos da casa (respiro, alívio de emergência, amostragem...) com atributos; devolve portas."""
    msp = doc.modelspace()
    portas: dict[str, dict[str, tuple[float, float]]] = {}
    for it in itens:
        geo, hw, hh, prt, _ = SIMBOLOS_CASA[it["simbolo"]]
        s = it.get("scale", 1.0) * escala
        nome = _bloco_casa(doc, it["simbolo"], hw, hh)
        rot = it.get("rotation", 0)
        ref = msp.add_blockref(nome, (it["x"], it["y"]),
                               dxfattribs={"layer": "CASA-SIMBOLOS", "xscale": s, "yscale": s, "rotation": rot})
        vals = {"TAG": it.get("tag", ""), "DESC": it.get("desc", "")}
        vals.update({f"D{i}": d for i, d in enumerate(it.get("dados", [])[:6])})
        ref.add_auto_attribs(vals)
        alturas = {tag: h for tag, _, _, h in ATTDEFS_CASA}
        for at in ref.attribs:  # altura absoluta, independente da escala do símbolo
            at.dxf.height = alturas.get(at.dxf.tag, at.dxf.height)
            at.dxf.rotation = 0.0
        a = math.radians(rot)
        portas[it.get("id", it.get("tag", ""))] = {
            k: (it["x"] + s * (px * hw * math.cos(a) - py * hh * math.sin(a)),
                it["y"] + s * (px * hw * math.sin(a) + py * hh * math.cos(a))) for k, (px, py) in prt.items()}
    return portas


def aplicar_aparencias(doc, aparencias: dict[str, str]) -> None:
    """Troca o desenho de símbolos do catálogo pelo da casa, mantendo inserção, escala, rótulos e grafo
    (as listas CSV já foram extraídas). A geometria da casa ocupa a mesma caixa do bloco original."""
    from ezdxf import bbox

    msp = doc.modelspace()
    for ins in msp.query("INSERT"):
        tag = next((a.dxf.text for a in ins.attribs if a.dxf.tag == "TAG"), None)
        if tag not in aparencias:
            continue
        blk = doc.blocks[ins.dxf.name]
        cx = bbox.extents([e for e in blk if e.dxftype() not in ("ATTDEF",)], fast=True)
        if not cx.has_data:
            continue
        hw, hh = cx.size.x / 2, cx.size.y / 2
        nome = f"CASA_{aparencias[tag].upper()}_{ins.dxf.name}"
        if nome not in doc.blocks:
            nb = doc.blocks.new(nome, base_point=blk.block.dxf.base_point)
            # a geometria da casa é desenhada centrada na origem; um sub-bloco a leva ao centro da caixa
            tmp = doc.blocks.new(nome + "_G")
            SIMBOLOS_CASA[aparencias[tag]][0](tmp, hw, hh)
            nb.add_blockref(tmp.name, (cx.center.x, cx.center.y))
        ins.dxf.name = nome


# --- linhas de sinal e quebras de cruzamento -------------------------------------------------
def desenhar_sinais(doc, sinais: list[dict], bolhas: dict[str, tuple[float, float, float]]) -> None:
    """Sinal elétrico da casa (tracejado, ISA-5.1) da bolha até um ponto (bomba, painel, válvula)."""
    msp = doc.modelspace()
    if CAMADA_SINAL not in doc.layers:
        doc.layers.add(CAMADA_SINAL, color=3, linetype="TRACO")
    for sg in sinais:
        if sg["de"] not in bolhas:
            continue
        bx, by, r = bolhas[sg["de"]]
        pts = [tuple(p) for p in sg.get("via", [])] + [tuple(sg["ate"])]
        x0, y0 = pts[0]
        if abs(x0 - bx) >= abs(y0 - by):
            ini = (bx + (r if x0 > bx else -r), by)
            pts = [ini, (x0, by)] + pts if abs(y0 - by) > 0.01 else [ini] + pts
        else:
            ini = (bx, by + (r if y0 > by else -r))
            pts = [ini, (bx, y0)] + pts if abs(x0 - bx) > 0.01 else [ini] + pts
        msp.add_lwpolyline(pts, dxfattribs={"layer": CAMADA_SINAL, "lineweight": 25})
        if sg.get("texto"):
            texto(msp, sg["texto"], pts[-1][0] + 1.5, pts[-1][1] + 1.5, 2.0, "L", CAMADA_SINAL)


def quebrar_cruzamentos(doc, prefixos=("LIN-", "UTILITY", "PROCESS-PIPING", CAMADA_SINAL, "CASA-CONEXAO"),
                        folga: float = 1.8) -> int:
    """Cruzamento de linhas = interrupção da linha de menor hierarquia (mais fina; empate: a vertical).
    Tês (ponto comum) não são cruzamentos. Devolve o número de quebras feitas."""
    msp = doc.modelspace()
    pls = [pl for pl in msp.query("LWPOLYLINE") if pl.dxf.layer.startswith(prefixos)]

    def peso(pl):
        lw = pl.dxf.lineweight if pl.dxf.lineweight > 0 else doc.layers.get(pl.dxf.layer).dxf.lineweight
        return lw if lw and lw > 0 else 25

    segs = []
    for pl in pls:
        pts = [(float(p[0]), float(p[1])) for p in pl.get_points()]
        for k, (a, b) in enumerate(zip(pts, pts[1:])):
            segs.append((pl, k, a, b))
    cortes: dict[int, list[tuple[int, float, float]]] = {}
    n = 0
    for i, (p1, k1, a1, b1) in enumerate(segs):
        for p2, k2, a2, b2 in segs[i + 1:]:
            if p1 is p2:
                continue
            v1, v2 = abs(a1[0] - b1[0]) < 0.01, abs(a2[0] - b2[0]) < 0.01
            h1, h2 = abs(a1[1] - b1[1]) < 0.01, abs(a2[1] - b2[1]) < 0.01
            if not ((v1 and h2) or (h1 and v2)):
                continue
            (va, vb, ha, hb) = (a1, b1, a2, b2) if v1 else (a2, b2, a1, b1)
            x, y = va[0], ha[1]
            if not (min(ha[0], hb[0]) + 0.3 < x < max(ha[0], hb[0]) - 0.3
                    and min(va[1], vb[1]) + 0.3 < y < max(va[1], vb[1]) - 0.3):
                continue
            # quem quebra: a mais fina; empate -> a vertical
            alvo = (p1, k1) if peso(p1) < peso(p2) else (p2, k2) if peso(p2) < peso(p1) else \
                ((p1, k1) if v1 else (p2, k2))
            cortes.setdefault(id(alvo[0]), []).append((alvo[1], x, y))
            n += 1
    for pl in pls:
        if id(pl) not in cortes:
            continue
        pts = [(float(p[0]), float(p[1])) for p in pl.get_points()]
        pedacos, atual = [], [pts[0]]
        for k, (a, b) in enumerate(zip(pts, pts[1:])):
            cs = sorted((c for c in cortes[id(pl)] if c[0] == k),
                        key=lambda c: abs(c[1] - a[0]) + abs(c[2] - a[1]))
            for _, x, y in cs:
                dx, dy = b[0] - a[0], b[1] - a[1]
                L = math.hypot(dx, dy) or 1
                ux, uy = dx / L, dy / L
                atual.append((x - ux * folga, y - uy * folga))
                pedacos.append(atual)
                atual = [(x + ux * folga, y + uy * folga)]
            atual.append(b)
        pedacos.append(atual)
        attrs = {"layer": pl.dxf.layer, "lineweight": pl.dxf.lineweight}
        if pl.dxf.hasattr("true_color"):
            attrs["true_color"] = pl.dxf.true_color
        if pl.dxf.hasattr("linetype"):
            attrs["linetype"] = pl.dxf.linetype
        for pc in pedacos:
            if len(pc) >= 2:
                msp.add_lwpolyline(pc, dxfattribs=attrs)
        msp.delete_entity(pl)
    return n

def adicionar_dados(doc, dados_por_tag: dict[str, list[str]]) -> None:
    """Linhas de dados de processo sob o TAG/DESC de símbolos do catálogo (atributos extras)."""
    msp = doc.modelspace()
    for ins in msp.query("INSERT"):
        attrs = {a.dxf.tag: a for a in ins.attribs}
        tag = attrs.get("TAG")
        if not tag or tag.dxf.text not in dados_por_tag:
            continue
        base = attrs.get("DESC", tag)
        h = round(base.dxf.height * 0.8, 2)
        for i, d in enumerate(dados_por_tag[tag.dxf.text]):
            a = ins.add_attrib(f"D{i}", d, insert=(base.dxf.insert.x, base.dxf.insert.y - (i + 1) * h * 1.4),
                               dxfattribs={"height": h, "layer": base.dxf.layer, "halign": base.dxf.halign})
            if base.dxf.halign:
                a.dxf.align_point = (base.dxf.insert.x, base.dxf.insert.y - (i + 1) * h * 1.4)
