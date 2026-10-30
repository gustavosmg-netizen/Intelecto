"""Gera um fluxograma de engenharia (P&ID) a partir de uma especificação JSON/YAML.

Pipeline: especificação -> servidor MCP `autocad-mcp-pro` (motor ezdxf, sem AutoCAD)
-> pid_from_spec (uma transação) -> moldura + carimbo -> listas CSV -> DXF
-> pós-processamento (carimbo em PT-BR) -> PDF A3/A1 monocromático + PNG de conferência.

Uso (sem instalar nada no Python do sistema):
    uv run --with "autocad-mcp-pro[pdf]==1.7.0" --with pyyaml \
        python scripts/gerar_pid.py modelos/ete_exemplo.json --saida saida_pid

Sai com código 1 se a especificação for rejeitada ou se a crítica do P&ID
apontar problema que não seja apenas informativo.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

#: Rótulos do carimbo ISO 7200 do servidor -> rótulos da casa.
ROTULOS_PT = {
    "DWG NO": "Nº DO DESENHO",
    "REV": "REV.",
    "SHEET": "FOLHA",
    "PART NO": "PROJETO",
    "MATERIAL": "UNIDADE / ÁREA",
    "SCALE": "ESCALA",
    "DRAWN": "DESENHO",
    "CHECKED": "VERIFICAÇÃO",
    "DATE": "DATA",
    "COMPANY": "EMPRESA",
}

FOLHAS_MM = {"A4": (297, 210), "A3": (420, 297), "A2": (594, 420), "A1": (841, 594), "A0": (1189, 841)}


def carregar_spec(caminho: Path) -> dict:
    texto = caminho.read_text(encoding="utf-8")
    if caminho.suffix.lower() in (".yaml", ".yml"):
        import yaml

        return yaml.safe_load(texto)
    return json.loads(texto)


def comando_servidor() -> str:
    """O executável `autocad-mcp` do mesmo ambiente deste Python."""
    local = Path(sys.executable).parent / ("autocad-mcp.exe" if os.name == "nt" else "autocad-mcp")
    if local.exists():
        return str(local)
    achado = shutil.which("autocad-mcp")
    if not achado:
        sys.exit("autocad-mcp não encontrado: rode com  uv run --with 'autocad-mcp-pro[pdf]==1.7.0' ...")
    return achado


async def desenhar(spec: dict, saida: Path, nome: str) -> dict:
    from fastmcp import Client
    from fastmcp.client.transports import StdioTransport

    folha = spec.get("folha", {})
    derivacoes = spec.get("derivacoes", [])
    pid = {k: v for k, v in spec.items() if k not in CHAVES_CASA}
    # Escala dos símbolos na folha (A1 = 2, A0 = 2,8): multiplica a escala de cada item;
    # as dimensões de vasos em `params` também escalam, então são dadas no tamanho base.
    escala = float(folha.get("escala_simbolos", 1.0))
    pid = json.loads(json.dumps(pid))
    for secao in ("equipment", "valves", "instruments", "connectors"):
        for item in pid.get(secao, []):
            for chave in CHAVES_ITEM_CASA:  # tratadas no pós-processamento
                item.pop(chave, None)
            if escala != 1.0:
                item["scale"] = item.get("scale", 1.0) * escala
    tamanho = pid.get("sheet", {}).get("sheet_size", "A3")
    env = {
        **os.environ,
        "AUTOCAD_MCP_BACKEND": "ezdxf",
        "ALLOWED_PATHS": str(saida),
        "TOOL_PACKS": "core,pid",
        "LOG_LEVEL": "WARNING",
    }
    dxf = saida / f"{nome}.dxf"
    resultado: dict = {}
    transporte = StdioTransport(command=comando_servidor(), args=[], env=env, log_file=saida / f"{nome}_servidor.log")
    async def silencio(_msg) -> None:  # o log do servidor vai para o arquivo _servidor.log
        return None

    async with Client(transporte, log_handler=silencio) as c:

        async def chamar(ferramenta: str, args: dict) -> dict:
            r = await c.call_tool(ferramenta, args, raise_on_error=False)
            texto = "".join(getattr(b, "text", "") for b in r.content)
            if r.is_error:
                raise SystemExit(f"[{ferramenta}] recusado: {texto}")
            try:
                return json.loads(texto) if texto else {}
            except json.JSONDecodeError:
                return {"texto": texto}

        await chamar("drawing_new", {})
        r = await chamar("pid_from_spec", {"spec": pid})
        resultado["critica"] = r.get("critique", [])
        resultado["cruzamentos"] = r.get("crossings_total")
        handles = r.get("handles", {})

        def ponta(ref):
            # "B-101B.discharge" -> porta de um item da spec; [x, y] -> ponto (tê numa linha existente).
            if isinstance(ref, (list, tuple)):
                return {"x": ref[0], "y": ref[1]}
            item, _, porta = ref.partition(".")
            if item not in handles:
                raise SystemExit(f"derivação: item {item!r} não existe na spec")
            return {"handle": handles[item], "port": porta} if porta else {"handle": handles[item]}

        for i, d in enumerate(derivacoes):
            args = {"from_": ponta(d["from"]), "to": ponta(d["to"]), "line_class": d.get("class", "process_major")}
            for chave_spec, chave_mcp in (("number", "line_number"), ("route", "route"), ("stub", "stub")):
                if chave_spec in d:
                    args[chave_mcp] = d[chave_spec]
            try:
                await chamar("pid_line_draw", args)
            except SystemExit as e:
                raise SystemExit(f"derivacoes[{i}]: {e}") from None
        if derivacoes:
            focos = ["pid_dangling_line", "pid_duplicate_tag", "pid_incompatible_connection",
                     "pid_untagged_instrument", "pid_illegal_tag", "pid_unconnected_equipment"]
            rc = await chamar("drawing_critique", {"focus": focos})
            resultado["critica"] = rc if isinstance(rc, list) else rc.get("issues", resultado["critica"])
        titulo = folha.get("titulo", pid.get("sheet", {}).get("intent", "FLUXOGRAMA DE ENGENHARIA"))
        if tamanho in ("A1", "A0"):
            await chamar("sheet_frame", {"size": tamanho})
        else:
            await chamar(
              "titleblock_apply",
              {
                  "size": tamanho,
                  "title": titulo,
                  "drawing_no": folha.get("numero", "PID-000"),
                  "revision": str(folha.get("revisao", "0")),
                  "sheet": folha.get("folha", "1/1"),
                  "part_no": folha.get("projeto", ""),
                  "material": folha.get("unidade", ""),
                  "scale": folha.get("escala", "S/E"),
                  "drawn_by": folha.get("desenho", ""),
                  "checked_by": folha.get("verificacao", ""),
                  "date": folha.get("data", ""),
                  "company": folha.get("empresa", "INTELECTO & CSTR"),
                  "projection": "",
                  "zones": True,
              },
            )
        for lista in ("line_list", "equipment_list", "instrument_index"):
            await chamar(f"pid_{lista}", {"csv_path": str(saida / f"{nome}_{lista}.csv")})
        await chamar("drawing_save_as", {"path": str(dxf)})
    resultado["dxf"] = str(dxf)
    resultado["folha"] = tamanho
    resultado["titulo"] = titulo
    return resultado


CHAVES_CASA = {"folha", "derivacoes", "notas", "casa"}
CHAVES_ITEM_CASA = ("aparencia", "dados", "rotulo")

CAMADAS_LINHA = ("PROCESS-PIPING", "UTILITY-LINE", "INSTRUMENT-LINE", "LIN-")


def _segmentos(msp) -> list[tuple[str, tuple, tuple]]:
    segs = []
    for pl in msp.query("LWPOLYLINE"):
        if not pl.dxf.layer.startswith(CAMADAS_LINHA):
            continue
        pts = [(float(p[0]), float(p[1])) for p in pl.get_points()]
        segs += [(pl.dxf.handle, a, b) for a, b in zip(pts, pts[1:])]
    return segs


def _textos(msp) -> list:
    """Textos soltos e atributos de bloco (TAG/DESC); números de linha ficam de fora (vão sobre a linha)."""
    textos = [t for t in msp.query("TEXT") if t.dxf.layer != "PROCESS-LINE-TEXT" and t.dxf.text.strip()]
    for ins in msp.query("INSERT"):
        textos += [a for a in ins.attribs if a.dxf.text.strip()]
    return textos


def _colide(texto, segs) -> str | None:
    """Handle da primeira linha que cruza a caixa do texto (com folga de 0,5 mm)."""
    from ezdxf import bbox

    caixa = bbox.extents([texto], fast=False)
    if not caixa.has_data:
        return None
    x0, y0, x1, y1 = caixa.extmin.x - 0.5, caixa.extmin.y - 0.5, caixa.extmax.x + 0.5, caixa.extmax.y + 0.5
    for h, a, b in segs:
        sx0, sx1 = sorted((a[0], b[0]))
        sy0, sy1 = sorted((a[1], b[1]))
        if sx0 <= x1 and sx1 >= x0 and sy0 <= y1 and sy1 >= y0:
            return h
    return None


def _caixa(ent, folga: float = 0.5):
    from ezdxf import bbox

    c = bbox.extents([ent], fast=False)
    if not c.has_data:
        return None
    return (c.extmin.x - folga, c.extmin.y - folga, c.extmax.x + folga, c.extmax.y + folga)


def _cruza(a, b) -> bool:
    return a is not None and b is not None and a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]


def _obstaculos(msp) -> list[tuple[str, str, tuple]]:
    """(dono, descrição, caixa) de todo texto, atributo e símbolo da folha. O dono é o handle
    do bloco (para não comparar um rótulo com o próprio símbolo) ou do texto solto."""
    from ezdxf import bbox

    obs = []
    for t in msp.query("TEXT"):
        if t.dxf.text.strip() and t.dxf.layer not in ("TITLEBLOCK",):
            obs.append((t.dxf.handle, f"texto {t.dxf.text!r}", _caixa(t, 0.2)))
    for ins in msp.query("INSERT"):
        for a in ins.attribs:
            if a.dxf.text.strip():
                obs.append((ins.dxf.handle, f"rótulo {a.dxf.text!r}", _caixa(a, 0.2)))
        geo = bbox.extents(ins.virtual_entities(), fast=True)
        if geo.has_data:
            obs.append((ins.dxf.handle, f"símbolo {ins.dxf.name}",
                        (geo.extmin.x, geo.extmin.y, geo.extmax.x, geo.extmax.y)))
    return obs


def _livre(rotulos, dono: str, segs, obs) -> bool:
    for a in rotulos:
        if _colide(a, segs):
            return False
        cx = _caixa(a, 0.2)
        if any(_cruza(cx, c) for d, _, c in obs if d != dono):
            return False
    return True


def _dist_ponto_seg(p, a, b) -> float:
    ax, ay, bx, by = a[0], a[1], b[0], b[1]
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
    return ((p[0] - ax - t * dx) ** 2 + (p[1] - ay - t * dy) ** 2) ** 0.5


def corrigir_numeros_linha(msp) -> None:
    """Um número por linha, no trecho mais longo em que ele não encosta em símbolo,
    rótulo ou outra linha; os repetidos (a mesma linha partida por válvulas) saem."""
    segs = _segmentos(msp)
    textos = [t for t in msp.query("TEXT") if t.dxf.layer == "PROCESS-LINE-TEXT" and t.dxf.text.strip()]
    grupos: dict[str, list] = {}
    for t in textos:
        grupos.setdefault(t.dxf.text, []).append(t)
    for numero, ts in grupos.items():
        # trechos das polylines a que cada texto do grupo pertence (a mais próxima do texto)
        donos = set()
        for t in ts:
            p = (t.dxf.insert.x, t.dxf.insert.y)
            donos.add(min(segs, key=lambda s: _dist_ponto_seg(p, s[1], s[2]))[0])
        candidatos = sorted((s for s in segs if s[0] in donos),
                            key=lambda s: -((s[1][0] - s[2][0]) ** 2 + (s[1][1] - s[2][1]) ** 2))
        alvo, sobra = ts[0], ts[1:]
        h = alvo.dxf.height
        original = (alvo.dxf.insert, alvo.dxf.rotation, alvo.dxf.halign, alvo.dxf.get("align_point"))
        for e in sobra:
            msp.delete_entity(e)
        obs = [o for o in _obstaculos(msp) if o[0] != alvo.dxf.handle]
        outros = [s for s in segs if s[0] not in donos]
        achou = False
        # Desliza ao longo de cada trecho (meio, depois lados) e, se não couber, reduz a fonte.
        for altura in (h, h * 0.8, h * 0.65):
            alvo.dxf.height = altura
            for _, a, b in candidatos:
                vertical = abs(a[0] - b[0]) < 0.01
                for f in (0.5, 0.35, 0.65, 0.2, 0.8):
                    mx, my = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
                    lados = ([(mx - 1.2, my), (mx + 1.2 + altura, my)] if vertical
                             else [(mx, my + 1.2), (mx, my - 1.2 - altura)])
                    for x, y in lados:
                        alvo.dxf.rotation = 90.0 if vertical else 0.0
                        alvo.dxf.halign = 1
                        alvo.dxf.insert = (x, y)
                        alvo.dxf.align_point = (x, y)
                        cx = _caixa(alvo, 0.3)
                        if not any(_cruza(cx, c) for _, _, c in obs) and not _colide(alvo, outros):
                            achou = True
                            break
                    if achou:
                        break
                if achou:
                    break
            if achou:
                break
        if not achou:
            alvo.dxf.height = h
            alvo.dxf.insert, alvo.dxf.rotation, alvo.dxf.halign = original[:3]
            if original[3] is not None:
                alvo.dxf.align_point = original[3]


def posicionar_rotulos(msp, rotulos_spec: dict[str, dict]) -> set[str]:
    """Rótulo em posição dada pela spec ({x, y, alinh: L|C|R}): TAG, DESC e dados empilhados para baixo.
    Devolve os handles dos símbolos fixados (a correção automática não mexe neles)."""
    from ezdxf.enums import TextEntityAlignment

    fixos = set()
    al = {"L": TextEntityAlignment.LEFT, "C": TextEntityAlignment.CENTER, "R": TextEntityAlignment.RIGHT}
    for ins in msp.query("INSERT"):
        attrs = {a.dxf.tag: a for a in ins.attribs}
        tag = attrs.get("TAG")
        if not tag or tag.dxf.text not in rotulos_spec:
            continue
        r = rotulos_spec[tag.dxf.text]
        y = r["y"]
        ordem = [a for a in ins.attribs if a.dxf.text.strip() and a.dxf.tag not in ("FUNC", "LOOP")]
        ordem.sort(key=lambda a: (a.dxf.tag != "TAG", a.dxf.tag != "DESC", a.dxf.tag))
        for a in ordem:
            a.dxf.rotation = 0.0
            a.set_placement((r["x"], y - a.dxf.height), align=al[r.get("alinh", "C")])
            y -= a.dxf.height * 1.4
        fixos.add(ins.dxf.handle)
    return fixos


def corrigir_rotulos(msp, fixos: set[str] | None = None) -> None:
    """Rótulos TAG/DESC de bloco que caem sobre uma linha: tenta abaixo do símbolo,
    depois à direita. O que não tiver posição livre fica e vira aviso na verificação."""
    from ezdxf import bbox

    segs = _segmentos(msp)
    for ins in msp.query("INSERT"):
        if fixos and ins.dxf.handle in fixos:
            continue
        # texto interno da bolha ISA (FUNC/LOOP) e TAG dentro do conector não saem do lugar
        fixos = {"FUNC", "LOOP"} | ({"TAG"} if "CONNECTOR" in ins.dxf.name else set())
        rotulos = [a for a in ins.attribs if a.dxf.text.strip() and a.dxf.tag not in fixos]
        if not rotulos:
            continue
        # Símbolo girado (válvula em linha vertical, misturador lateral): rótulo volta à horizontal.
        girado = any(abs(a.dxf.rotation % 360) > 0.01 for a in rotulos)
        for a in rotulos:
            a.dxf.rotation = 0.0
        obs = _obstaculos(msp)
        if not girado and _livre(rotulos, ins.dxf.handle, segs, obs):
            continue
        geo = bbox.extents(ins.virtual_entities(), fast=True)
        if not geo.has_data:
            continue
        cx, ymin, xmax, ymid = geo.center.x, geo.extmin.y, geo.extmax.x, geo.center.y
        originais = [(a, a.dxf.insert, a.dxf.halign, a.dxf.get("align_point")) for a in rotulos]
        # TAG primeiro e DESC embaixo dele, centralizados; ou empilhados à direita, alinhados à esquerda.
        xmin, ymax = geo.extmin.x, geo.extmax.y
        ordem = sorted(rotulos, key=lambda a: a.dxf.tag != "TAG")
        n = len(ordem)
        # deslocamento acumulado de cada linha pela altura real (TAG maior que DESC e dados)
        passo = [a.dxf.height * 1.35 for a in ordem]
        abaixo = [sum(passo[: k + 1]) for k in range(n)]
        acima = [sum(passo[k + 1:]) for k in range(n)]
        meio = [sum(passo) / 2 - sum(passo[:k]) - passo[k] * 0.8 for k in range(n)]
        tentativas = [
            [(cx, ymin - 1.5 - abaixo[k], 1) for k in range(n)],  # abaixo
            [(xmax + 2.0, ymid + meio[k], 0) for k in range(n)],  # à direita
            [(xmax + 2.0, ymax + 1.5 + acima[k], 0) for k in range(n)],  # acima, à direita
            [(xmin - 2.0, ymid + meio[k], 2) for k in range(n)],  # à esquerda
            [(xmin - 2.0, ymax + 1.5 + acima[k], 2) for k in range(n)],  # acima, à esquerda
            [(xmax + 2.0, ymin - 1.5 - abaixo[k], 0) for k in range(n)],  # abaixo, à direita
            [(xmin - 2.0, ymin - 1.5 - abaixo[k], 2) for k in range(n)],  # abaixo, à esquerda
            [(cx, ymax + 1.5 + acima[k], 1) for k in range(n)],  # acima
            [(cx, ymin - 8.0 - abaixo[k], 1) for k in range(n)],  # mais abaixo
        ]
        ordem = sorted(rotulos, key=lambda a: a.dxf.tag != "TAG")
        for posicoes in tentativas:
            for a, (x, y, hal) in zip(ordem, posicoes):
                a.dxf.halign = hal
                a.dxf.insert = (x, y)
                if hal:
                    a.dxf.align_point = (x, y)
            if _livre(rotulos, ins.dxf.handle, segs, obs):
                break
        else:
            for a, ins_pt, hal, ap in originais:
                a.dxf.insert, a.dxf.halign = ins_pt, hal
                if ap is not None:
                    a.dxf.align_point = ap


def verificar_desenho(dxf: Path) -> list[dict]:
    """Checagens que a crítica do servidor não faz: trechos de linhas diferentes
    colados no mesmo eixo (erro) e textos/atributos sobre linhas (aviso)."""
    import ezdxf

    msp = ezdxf.readfile(dxf).modelspace()
    segs = _segmentos(msp)
    vertices = {pl.dxf.handle: [(round(p[0], 2), round(p[1], 2)) for p in pl.get_points()]
                for pl in msp.query("LWPOLYLINE") if pl.dxf.layer.startswith(CAMADAS_LINHA)}
    achados: list[dict] = []
    tol = 0.01
    for i, (h1, a1, b1) in enumerate(segs):
        for h2, a2, b2 in segs[i + 1 :]:
            if h1 == h2:
                continue
            for eixo in (0, 1):  # 0: trecho vertical (x constante); 1: horizontal (y constante)
                outro = 1 - eixo
                if all(abs(p[eixo] - a1[eixo]) < tol for p in (b1, a2, b2)):
                    lo = max(min(a1[outro], b1[outro]), min(a2[outro], b2[outro]))
                    hi = min(max(a1[outro], b1[outro]), max(a2[outro], b2[outro]))
                    if hi - lo > 0.5:
                        # Ramal que sai do mesmo bocal (mesmo vértice inicial ou final) é tê, não erro.
                        v1, v2 = vertices[h1], vertices[h2]
                        if {v1[0], v1[-1]} & {v2[0], v2[-1]}:
                            achados.append({"severity": "warning", "focus": "ramal_no_mesmo_bocal",
                                            "message": f"linhas {h1} e {h2} saem juntas por {hi - lo:.1f} mm do mesmo "
                                                       "ponto (lido como tê); confira se é o pretendido"})
                            continue
                        achados.append({"severity": "error", "focus": "linhas_sobrepostas",
                                        "message": f"linhas {h1} e {h2} coladas por {hi - lo:.1f} mm "
                                                   f"no eixo {'x' if eixo == 0 else 'y'}={a1[eixo]:.1f}; "
                                                   "passe 'route' com waypoints"})
    for t in _textos(msp):
        h = _colide(t, segs)
        if h:
            achados.append({"severity": "warning", "focus": "texto_sobre_linha",
                            "message": f"texto {t.dxf.text!r} cruza a linha {h}; afaste o item ou a linha"})
    obs = _obstaculos(msp)
    vistos = set()
    for i, (d1, n1, c1) in enumerate(obs):
        for d2, n2, c2 in obs[i + 1 :]:
            if d1 == d2 or n1.startswith("símbolo") and n2.startswith("símbolo"):
                continue
            if _cruza(c1, c2) and (n1, n2) not in vistos:
                # texto inteiramente dentro de um vaso (TAG/nível escritos no corpo) é intencional
                if any(n.startswith("símbolo PID_VESSEL") and not m.startswith("símbolo") and
                       a[0] <= b[0] and a[1] <= b[1] and a[2] >= b[2] and a[3] >= b[3]
                       for n, m, a, b in ((n1, n2, c1, c2), (n2, n1, c2, c1))):
                    continue
                vistos.add((n1, n2))
                achados.append({"severity": "warning", "focus": "texto_sobreposto",
                                "message": f"{n1} sobrepõe {n2}; afaste um dos dois"})
    return achados


def pos_processar(dxf: Path, res: dict, spec: dict) -> None:
    """Formato da casa (A1/A0) ou carimbo ISO em PT-BR (A4-A2), cores por serviço, símbolos e
    linhas da casa, correção de rótulos, PDF colorido + PDF P&B e PNG de conferência."""
    import ezdxf
    import matplotlib

    matplotlib.use("Agg")
    from ezdxf import bbox
    from ezdxf.addons.drawing import matplotlib as mpl
    from ezdxf.addons.drawing.config import ColorPolicy, Configuration

    import formato_casa as fc

    tamanho, titulo = res["folha"], res["titulo"]
    folha = spec.get("folha", {})
    casa = spec.get("casa", {})
    escala = float(folha.get("escala_simbolos", 1.0))
    servicos = {**fc.SERVICOS_PADRAO, **{k: tuple(v) for k, v in casa.get("servicos", {}).items()}}

    doc = ezdxf.readfile(dxf)
    msp = doc.modelspace()
    fc.preparar_estilos(doc)
    for t in msp.query("TEXT"):
        if t.dxf.text in ROTULOS_PT:
            t.dxf.text = ROTULOS_PT[t.dxf.text]
        elif t.dxf.text == titulo:
            # Encolhe o título até caber entre o início do texto e a borda direita do carimbo.
            largura = bbox.extents([t]).size.x
            livre = FOLHAS_MM.get(tamanho, FOLHAS_MM["A3"])[0] - 10.0 - t.dxf.insert.x - 3.0
            if largura > livre > 0:
                t.dxf.height = round(t.dxf.height * livre / largura, 2)
    for ins in msp.query("INSERT"):
        # TAG de projeto com malha alfanumérica (LT-R101, ZS-VE01): o servidor deixa tudo em FUNC;
        # a bolha ISA mostra função em cima e malha embaixo.
        attrs = {a.dxf.tag: a for a in ins.attribs}
        if {"FUNC", "LOOP"} <= attrs.keys() and not attrs["LOOP"].dxf.text and "-" in attrs["FUNC"].dxf.text:
            func, _, loop = attrs["FUNC"].dxf.text.partition("-")
            attrs["FUNC"].dxf.text, attrs["LOOP"].dxf.text = func, loop
        if {"FUNC", "LOOP"} <= attrs.keys():
            # função e malha cabem em ~70% do diâmetro da bolha (raio 5 x escala)
            livre = 0.7 * 10.0 * abs(ins.dxf.xscale)
            for a in (attrs["FUNC"], attrs["LOOP"]):
                larg = fc.largura_texto(a.dxf.text, a.dxf.height)
                if larg > livre:
                    a.dxf.height = round(a.dxf.height * livre / larg, 2)
    if escala > 1.0:
        # Alturas de texto do padrão de referência (A1): TAG 3,5 / descrição 2,5 / conector 3,0 mm.
        alturas = {"TAG": 3.5, "DESC": 2.5, "LINK": 2.5}
        for ins in msp.query("INSERT"):
            conector = "CONNECTOR" in ins.dxf.name
            for a in ins.attribs:
                h = 3.0 if (conector and a.dxf.tag == "TAG") else alturas.get(a.dxf.tag)
                if h and a.dxf.height > h:
                    a.dxf.height = h
        # Número de linha acompanha a folha maior (2,5 mm no A3 -> 3,5 mm no A1).
        for t in msp.query("TEXT"):
            if t.dxf.layer == "PROCESS-LINE-TEXT":
                t.dxf.height = round(t.dxf.height * (1 + 0.4 * (escala - 1)), 2)
    from ezdxf.enums import TextEntityAlignment

    for ins in msp.query("INSERT"):
        # conector girado (180°/90°): TAG interno volta à horizontal, centrado no corpo do conector
        if "CONNECTOR" in ins.dxf.name and abs(ins.dxf.rotation % 360) > 0.01:
            for a in ins.attribs:
                if a.dxf.tag == "TAG":
                    a.dxf.rotation = 0.0
                    a.set_placement((ins.dxf.insert.x, ins.dxf.insert.y), align=TextEntityAlignment.MIDDLE_CENTER)
    sem_rotulo = set(spec.get("casa", {}).get("sem_rotulo", []))
    for t in list(msp.query("TEXT")):
        # Linha sem número na spec recebe do servidor só um sequencial ("30"): sem valor de projeto, sai.
        # Números listados em casa.sem_rotulo ficam só na lista de linhas (trechos curtos, engates).
        if t.dxf.layer == "PROCESS-LINE-TEXT" and (t.dxf.text.strip().isdigit() or t.dxf.text in sem_rotulo):
            msp.delete_entity(t)

    fc.aplicar_aparencias(doc, {it["tag"]: it["aparencia"] for sec in ("equipment", "valves")
                                for it in spec.get(sec, []) if it.get("aparencia")})
    usados = fc.aplicar_servicos(doc, servicos)
    fc.adicionar_dados(doc, {it["tag"]: it["dados"] for sec in ("equipment", "valves")
                             for it in spec.get(sec, []) if it.get("dados")})
    fc.desenhar_simbolos_casa(doc, casa.get("simbolos", []), escala)
    usados |= fc.desenhar_linhas_casa(doc, casa.get("linhas", []), servicos)
    fc.desenhar_areas(doc, casa.get("areas", []))
    fc.desenhar_cotas(doc, casa.get("cotas", []))
    bolhas = {i["tag"]: (i["x"], i["y"], 5.0 * escala * i.get("scale", 1.0)) for i in spec.get("instruments", [])}
    fc.desenhar_conexoes(doc, casa.get("conexoes", []), bolhas)
    fc.desenhar_sinais(doc, casa.get("sinais", []), bolhas)
    res["quebras"] = fc.quebrar_cruzamentos(doc)
    for q in casa.get("quadros", []):
        fc.desenhar_quadro(msp, q)
    for tx in casa.get("textos", []):
        fc.texto(msp, tx["texto"], tx["x"], tx["y"], tx.get("altura", 2.5), tx.get("alinh", "L"))
    notas = spec.get("notas")
    if tamanho in ("A1", "A0"):
        linhas_notas = notas.get("linhas", []) if isinstance(notas, dict) else (notas or [])
        linhas_notas = [n for n in linhas_notas if n.strip().upper() != "NOTAS"]
        fc.desenhar_formato(msp, folha, linhas_notas, tamanho)
    elif notas:
        # Bloco de notas solto (A4-A2), escrito antes das correções para que rótulos desviem dele.
        x, y, alt = notas["x"], notas["y"], notas.get("altura", 2.5)
        for k, ln in enumerate(notas["linhas"]):
            msp.add_text(ln, height=alt if k else alt * 1.3,
                         dxfattribs={"layer": "NOTAS", "insert": (x, y - k * alt * 1.7)})

    rotulos_spec = {it["tag"]: it["rotulo"] for sec in ("equipment", "valves") for it in spec.get(sec, [])
                    if it.get("rotulo")}
    rotulos_spec.update({it["tag"]: it["rotulo"] for it in casa.get("simbolos", []) if it.get("rotulo")})
    fixos = posicionar_rotulos(msp, rotulos_spec)
    corrigir_numeros_linha(msp)
    for _ in range(3):  # um rótulo movido pode liberar o lugar de outro
        corrigir_rotulos(msp, fixos)
    doc.saveas(dxf)
    res["servicos_usados"] = sorted(usados)

    w, h = FOLHAS_MM.get(tamanho, FOLHAS_MM["A3"])
    tam = (w / 25.4, h / 25.4)
    mpl.qsave(msp, str(dxf.with_suffix(".pdf")), bg="#FFFFFF", size_inches=tam)
    mpl.qsave(msp, str(dxf.with_name(dxf.stem + "_PB.pdf")), bg="#FFFFFF",
              config=Configuration(color_policy=ColorPolicy.BLACK), size_inches=tam)
    mpl.qsave(msp, str(dxf.with_suffix(".png")), bg="#FFFFFF", dpi=200)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec", type=Path, help="especificação .json/.yaml (formato pid_from_spec + bloco 'folha')")
    ap.add_argument("--saida", type=Path, default=Path("saida_pid"))
    ap.add_argument("--nome", default=None, help="nome base dos arquivos (padrão: número do desenho)")
    a = ap.parse_args()

    spec = carregar_spec(a.spec)
    saida = a.saida.resolve()
    saida.mkdir(parents=True, exist_ok=True)
    nome = a.nome or spec.get("folha", {}).get("numero", a.spec.stem)

    res = asyncio.run(desenhar(spec, saida, nome))
    pos_processar(Path(res["dxf"]), res, spec)

    for i in res["critica"]:
        # Malha alfanumérica é padrão de projeto (separada na bolha no pós-processamento), não falta de TAG.
        if i.get("focus") == "pid_untagged_instrument" and "LOOP empty" in i.get("message", ""):
            i["severity"], i["focus"] = "info", "malha_alfanumerica"
    res["critica"] += verificar_desenho(Path(res["dxf"]))
    problemas = [i for i in res["critica"] if i.get("severity") == "error"]
    for i in res["critica"]:
        print(f"  [{i.get('severity')}] {i.get('focus')}: {i.get('message')}")
    print(f"Cruzamentos de linha: {res['cruzamentos']} (desenhados com quebra: {res.get('quebras', 0)})")
    print(f"Arquivos em {saida}:")
    for f in sorted(saida.glob(f"{nome}*")):
        print("  ", f.name)
    sys.exit(1 if problemas else 0)


if __name__ == "__main__":
    main()
