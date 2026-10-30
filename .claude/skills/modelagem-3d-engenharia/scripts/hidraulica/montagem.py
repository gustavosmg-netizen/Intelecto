"""Monta o modelo 3D a partir da especificação (dict lido do YAML).

Cada equipamento expõe portas (ponto na face do flange, direção saindo do equipamento,
DN/PN do flange, tipo de junta). Cada linha liga uma porta de origem a um destino no
sentido do escoamento, com curvas nos vértices, componentes em estações ao longo do eixo,
adaptadores de flange, parafusos, bolsas/soldas, setas de fluxo e suportes. Tudo o que o
validador precisa fica registrado em `Modelo`.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from build123d import Box, Compound, Cylinder, Location, Part, Pos, Rot, Vector

from . import dispositivos as dv
from . import geometria as g
from . import normas

CORES = {"agua": (0.10, 0.45, 0.80, 1), "agua_bruta": (0.10, 0.55, 0.35, 1),
         "esgoto": (0.45, 0.33, 0.20, 1), "lodo": (0.35, 0.22, 0.10, 1),
         "ar": (0.95, 0.95, 0.95, 1), "quimico": (1.0, 0.55, 0.0, 1),
         "drenagem": (0.10, 0.10, 0.10, 1), "concreto": (0.62, 0.61, 0.58, 1),
         "metal": (0.58, 0.60, 0.63, 1), "valvula": (0.70, 0.08, 0.06, 1),
         "bomba": (0.10, 0.30, 0.60, 1), "pead": (0.08, 0.08, 0.08, 1)}
FLANGEADOS = {"gaveta", "borboleta", "retencao", "esfera", "junta_desmontagem"}


@dataclass
class Porta:
    nome: str                 # "TQ-01.N1"
    ponto: Vector
    direcao: Vector           # saindo do equipamento
    dn: int                   # DN do flange (ou DN do tubo para ponta)
    pn: int = 10
    junta: str = "flange"     # flange | ponta | livre
    papel: str | None = None  # entrada, saida, extravasor, descarga, succao, recalque
    equipamento: str | None = None
    de: float | None = None   # DE do tubo quando a junta é ponta
    di: float | None = None   # DI do bocal (tubo de parede)
    extra: dict = field(default_factory=dict)   # spec do bocal (dispositivos internos)


@dataclass
class Componente:
    tipo: str
    tag: str
    s0: float
    s1: float
    dn: int
    extra: dict = field(default_factory=dict)


@dataclass
class Linha:
    tag: str
    spec: dict
    tubo: normas.Tubo
    regime: str
    origem: Porta
    destino: Porta
    vertices: list = field(default_factory=list)       # pontos do eixo (mm)
    elementos: list = field(default_factory=list)      # trechos retos e curvas
    componentes: list = field(default_factory=list)
    tubos_por_s: list = field(default_factory=list)    # [(s_inicio, Tubo)]
    suportes: list = field(default_factory=list)       # pontos dos apoios
    angulos: list = field(default_factory=list)        # deflexão em cada vértice (graus)
    comprimento: float = 0.0
    sifao: dict | None = None
    sifao_u: tuple | None = None
    erros_montagem: list = field(default_factory=list)

    def tubo_em(self, s: float) -> normas.Tubo:
        t = self.tubo
        for s0, tb in self.tubos_por_s:
            if s >= s0 - 1e-6:
                t = tb
        return t


@dataclass
class Modelo:
    spec: dict
    equipamentos: dict = field(default_factory=dict)  # tag -> dict(tipo, solido, props)
    portas: dict = field(default_factory=dict)
    linhas: dict = field(default_factory=dict)
    pecas: dict = field(default_factory=dict)         # nome -> lista de (sólido, cor)
    bom: list = field(default_factory=list)
    piso: float = 0.0

    def add(self, grupo: str, solido: Part, cor) -> None:
        self.pecas.setdefault(grupo, []).append((solido, cor))

    def item(self, item: str, espec: str, un: str, qtd: float) -> None:
        self.bom.append({"item": item, "especificacao": espec, "unidade": un, "quantidade": qtd})


# --- Equipamentos -----------------------------------------------------------------------

def _bocal_parede(m: Modelo, eq_tag: str, b: dict, ponto_ext: Vector, normal: Vector,
                  parede: float, z_fundo: float) -> None:
    """Tubo de parede flangeado com anel de vedação (puddle flange) embutido no concreto."""
    dn, pn = int(b["dn"]), int(b.get("pn", 10))
    fl = normas.flange(dn, pn)
    de = float(b.get("de_tubo", normas.PVC_DEFOFO_DE.get(dn, dn * 1.1)))
    proj_ext, proj_int = float(b.get("projecao", 150)), float(b.get("projecao_interna", 80))
    L = parede + proj_ext + proj_int
    inicio = ponto_ext - normal * (parede + proj_int)
    peca = g.tubo_reto(de, de - 2 * max(de / 26, 4), L)
    peca += Pos(0, 0, proj_int + parede / 2 - 6) * (Cylinder(de / 2 + 0.35 * de, 12, align=g.BASE)
                                                  - Cylinder(de / 2, 12, align=g.BASE))
    peca += Pos(0, 0, L - fl.t) * g.flange_peca(fl, de)
    nome = f"{b['tag']}-{eq_tag}-DN{dn}"
    m.add(nome, g.posicionar(peca, inicio, normal), CORES["metal"])
    face = ponto_ext + normal * proj_ext
    di = de - 2 * max(de / 26, 4)
    p = Porta(f"{eq_tag}.{b['tag']}", face, normal, dn, pn, "flange", b.get("papel"), eq_tag,
              di=di, extra=dict(b))
    m.portas[p.nome] = p
    m.item("Tubo de parede flangeado c/ anel de vedação", f"DN{dn} {normas.classe_txt(pn)} L={L:.0f} mm", "un", 1)
    _dispositivos_bocal(m, eq_tag, b, nome, de, di, inicio, ponto_ext - normal * parede, normal, p)
    return de


def _dispositivos_bocal(m: Modelo, eq_tag: str, b: dict, grupo: str, de: float, di: float,
                        ponta: Vector, face_int: Vector, normal: Vector, porta: Porta) -> None:
    """Dispositivos internos ligados ao bocal (registrados no grupo do bocal ou do tanque)."""
    if b.get("defletor"):
        m.add(grupo, dv.defletor(de, ponta, normal), CORES["metal"])
        m.item("Chapa defletora de entrada", f"{b['tag']} {eq_tag}", "un", 1)
    if b.get("tubo_imersao"):
        cfg = b["tubo_imersao"]
        peca, z_furo = dv.tubo_imersao(de, di, ponta, normal, float(cfg["ate"]),
                                       bool(cfg.get("quebra_vacuo", False)))
        m.add(grupo, peca, CORES["metal"])
        porta.extra["_z_quebra_vacuo"] = z_furo if cfg.get("quebra_vacuo") else None
        porta.extra["_z_boca_imersa"] = float(cfg["ate"])
        m.item("Tubo mergulhado de entrada" + (" c/ furo quebra-vácuo" if cfg.get("quebra_vacuo")
                                               else ""), f"DN{b['dn']} até EL {cfg['ate']}", "un", 1)
    if b.get("quebra_vortice"):
        m.add(grupo, dv.quebra_vortice(de, ponta, normal), CORES["metal"])
        m.item("Quebra-vórtice em cruz", f"{b['tag']} {eq_tag} DN{b['dn']}", "un", 1)
    if b.get("caixa_nivel"):
        cfg = b["caixa_nivel"]
        topo = float(cfg.get("topo", m.equipamentos.get("_borda_tmp", cfg["crista"] + 500)))
        caixa = dv.caixa_nivel(face_int, normal, float(cfg["crista"]), float(cfg["fundo"]),
                               float(cfg["largura"]), float(cfg.get("profundidade", 500)), topo)
        m.add(eq_tag, caixa, CORES["concreto"])
        m.item("Caixa de nível com vertedor de soleira livre",
               f"{eq_tag}: crista EL {cfg['crista']}, L = {cfg['largura']} mm", "un", 1)


def tanque(m: Modelo, e: dict) -> None:
    """Tanque de concreto retangular (L em x, B em y) ou cilíndrico (diametro)."""
    tag = e["tag"]
    x0, y0, z0 = map(float, e.get("origem", (0, 0, 0)))   # centro do fundo interno
    H, t, laje = float(e["altura"]), float(e.get("parede", 200)), float(e.get("laje", 250))
    cil = "diametro" in e
    if cil:
        R = float(e["diametro"]) / 2
        corpo = Pos(x0, y0, z0 - laje) * Cylinder(R + t, H + laje, align=g.BASE)
        corpo -= Pos(x0, y0, z0) * Cylinder(R, H + 1, align=g.BASE)
    else:
        Lx, By = float(e["comprimento"]), float(e["largura"])
        corpo = Pos(x0, y0, z0 - laje) * Box(Lx + 2 * t, By + 2 * t, H + laje, align=g.BASE)
        corpo -= Pos(x0, y0, z0) * Box(Lx, By, H + 1, align=g.BASE)
    furos = []
    m.equipamentos["_borda_tmp"] = z0 + H
    for b in e.get("bocais", []):
        if cil:
            az = math.radians(float(b["azimute"]))
            n = Vector(math.cos(az), math.sin(az), 0)
            ponto_ext = Vector(x0, y0, 0) + n * (R + t)
        else:
            n = {"leste": Vector(1, 0, 0), "oeste": Vector(-1, 0, 0), "norte": Vector(0, 1, 0),
                 "sul": Vector(0, -1, 0)}[b["parede"]]
            tang = Vector(-n.Y, n.X, 0)
            meia = (Lx / 2 if abs(n.X) else By / 2) + t
            ponto_ext = Vector(x0, y0, 0) + n * meia + tang * float(b.get("posicao", 0))
        dn = int(b["dn"])
        de = float(b.get("de_tubo", normas.PVC_DEFOFO_DE.get(dn, dn * 1.1)))
        if "eixo" in b:
            z = float(b["eixo"])
        else:  # cota da geratriz inferior interna (soleira) informada
            z = float(b["geratriz_inferior"]) + de / 2 - max(de / 26, 4)
        ponto_ext = Vector(ponto_ext.X, ponto_ext.Y, z)
        de = _bocal_parede(m, tag, b, ponto_ext, n, t, z0)
        furos.append(g.posicionar(Cylinder(de / 2 + 1, t * 3 + 400, align=g.BASE),
                                  ponto_ext - n * (t * 2 + 200), n))
    for f in furos:
        corpo -= f
    m.equipamentos.pop("_borda_tmp", None)
    respiro = e.get("respiro")
    if e.get("fechado"):
        tampa = (Pos(x0, y0, z0 + H) * Cylinder(R + t, 200, align=g.BASE) if cil else
                 Pos(x0, y0, z0 + H) * Box(Lx + 2 * t, By + 2 * t, 200, align=g.BASE))
        if respiro:
            dn_r = int(respiro["dn"])
            tr = normas.tubo("pvc_defofo" if dn_r in normas.PVC_DEFOFO_DE else "pvc_esgoto", dn_r)
            px, py = (float(v) for v in respiro.get("posicao", (0, 0)))
            base = Vector(x0 + px, y0 + py, z0 + H)
            tampa -= Pos(*base) * Cylinder(tr.de / 2 + 2, 600, align=(g.Align.CENTER,) * 3)
            h_r = float(respiro.get("altura", 600))
            topo = base + Vector(0, 0, 200 + h_r)
            m.add(f"N-RESP-{tag}-DN{dn_r}", g.posicionar(g.tubo_reto(tr.de, tr.di, 200 + h_r),
                                                       base, Vector(0, 0, 1)), CORES["metal"])
            m.add(f"N-RESP-{tag}-DN{dn_r}", dv.respiro_topo(tr.de, tr.di, topo), CORES["metal"])
            m.item("Respiro em pescoço de ganso c/ tela", f"{tag} DN{dn_r}", "un", 1)
        corpo += tampa
    if cil and e.get("chicanas"):
        corpo += dv.chicanas(x0, y0, R, z0, z0 + H - 300, int(e["chicanas"]))
        m.item("Chicanas verticais (largura D/12)", f"{tag}: {e['chicanas']} un", "un",
               int(e["chicanas"]))
    m.add(tag, corpo, CORES["concreto"])
    m.equipamentos[tag] = {"tipo": "tanque", "solido": corpo, "z_fundo": z0, "borda": z0 + H,
                           "na": e.get("na"), "na_max": e.get("na_max", e.get("na")),
                           "na_min": e.get("na_min", e.get("na")),
                           "cil": cil, "centro": (x0, y0), "dim": (R * 2, R * 2) if cil else (Lx, By),
                           "parede": t, "fechado": bool(e.get("fechado")), "respiro": respiro,
                           "chicanas": e.get("chicanas"), "uso": e.get("uso"),
                           "vazao_max_ls": e.get("vazao_max_ls")}
    vol = (math.pi * R * R if cil else Lx * By) * H / 1e9
    m.item("Estrutura de concreto", f"{tag} volume útil bruto {vol:.1f} m³", "un", 1)


def bomba(m: Modelo, e: dict) -> None:
    tag, rot = e["tag"], float(e.get("rotacao", 0))
    org = Vector(*map(float, e.get("origem", (0, 0, 0))))
    modelo = e.get("modelo", "centrifuga")
    if modelo == "submersivel":
        corpo, portas = g.bomba_submersivel(int(e["dn_recalque"]), float(e.get("altura_motor", 700)))
    else:
        corpo, portas = g.bomba_centrifuga(int(e["dn_succao"]), int(e["dn_recalque"]),
                                           float(e.get("altura_eixo", 450)))
    loc = Location(tuple(org), (0, 0, rot))
    m.add(tag, loc * corpo, CORES["bomba"])
    for nome, (p, d, dn) in portas.items():
        P = loc * Pos(*p)
        dir_ = Rot(0, 0, rot) * Pos(*d)
        porta = Porta(f"{tag}.{nome}", P.position, dir_.position.normalized(), dn, 10, "flange",
                      nome, tag)
        m.portas[porta.nome] = porta
    m.equipamentos[tag] = {"tipo": "bomba", "solido": loc * corpo, "spec": e}
    m.item("Conjunto motobomba", f"{tag} {modelo} "
           f"{e.get('descricao', '')}".strip(), "un", 1)


def misturador(m: Modelo, e: dict) -> None:
    """Misturador vertical sobre ponte apoiada na borda do tanque indicado."""
    tq = m.equipamentos[e["tanque"]]
    cx, cy = tq["centro"]
    vao = max(tq["dim"]) + 2 * tq["parede"]
    z_rotor = tq["z_fundo"] + float(e["altura_rotor"])
    fixo, rotor = dv.misturador(cx, cy, tq["borda"], vao, z_rotor, float(e["d_rotor"]),
                                float(e.get("potencia_kw", 5.5)))
    m.add(e["tag"], fixo, CORES["bomba"])
    m.add(f"{e['tag']}-ROTOR", rotor, CORES["metal"])     # o visualizador gira só este grupo
    peca = fixo + rotor
    m.equipamentos[e["tag"]] = {"tipo": "misturador", "tanque": e["tanque"], "spec": e,
                                "solido": peca}
    tq["misturador"] = e["tag"]
    m.item("Misturador vertical c/ ponte", f"{e['tag']} rotor Ø{e['d_rotor']} mm "
           f"{e.get('potencia_kw', 5.5)} kW", "un", 1)


# --- Linhas -----------------------------------------------------------------------------

def _resolver_ponto(m: Modelo, ref, inicio: bool, tubo: normas.Tubo):
    if isinstance(ref, str) and "@" in ref:
        return ("te", ref)
    if isinstance(ref, dict) and "te" in ref:      # {te: L-005, ponto: [x, y, z]}
        return ("te", ref)
    if isinstance(ref, str):
        if ref not in m.portas:
            raise KeyError(f"Porta '{ref}' não existe. Portas: {sorted(m.portas)}")
        return ("porta", m.portas[ref])
    p = Vector(*map(float, ref["ponto"]))
    d = Vector(*map(float, ref.get("direcao", (0, 0, 0))))
    junta = ref.get("junta", "livre")
    return ("porta", Porta(ref.get("descricao", "livre"), p, d, tubo.dn_flange, 10, junta,
                           ref.get("papel"), None, tubo.de))


def _expandir_sifao(pontos: list, R: float, de: float, di: float):
    """Substitui {'sifao': {...}} pelos vértices de um sifão em U com o selo pedido.

    O ponto anterior é a chegada (horizontal) e o seguinte, a saída; o fundo do U fica com
    a geratriz superior interna `selo` mm abaixo da soleira de saída.
    """
    saida = []
    for i, p in enumerate(pontos):
        if not isinstance(p, dict):
            saida.append(Vector(*map(float, p)))
            continue
        cfg = p["sifao"]
        P, Q = saida[-1], Vector(*map(float, pontos[i + 1]))
        d = Vector(Q.X - P.X, Q.Y - P.Y, 0).normalized()
        selo, i = float(cfg["selo"]), float(cfg.get("declividade", 0.01))
        a = max(2 * R, float(cfg.get("afastamento", 2 * R)))
        x1 = P + d * a
        x1 = Vector(x1.X, x1.Y, P.Z - i * a)                      # chegada com declividade
        baixo2_xy = x1 + d * (2 * R + de)
        dist_saida = math.hypot(Q.X - baixo2_xy.X, Q.Y - baixo2_xy.Y)
        z_sub = Q.Z + i * dist_saida                              # saída com declividade
        z_low = z_sub - di - selo          # geratriz superior interna do fundo = crista - selo
        baixo1 = Vector(x1.X, x1.Y, z_low)
        baixo2 = Vector(baixo2_xy.X, baixo2_xy.Y, z_low)
        subida = Vector(baixo2.X, baixo2.Y, z_sub)
        saida += [x1, baixo1, baixo2, subida]
        _expandir_sifao.ultimo = (baixo1, baixo2, subida)
    return saida


def _trajeto(linha: Linha, R: float):
    """Converte vértices em elementos retos e curvas, com abscissa s acumulada."""
    pts = linha.vertices
    elementos, s, inicio = [], 0.0, pts[0]
    for i in range(1, len(pts) - 1):
        d_in = (pts[i] - pts[i - 1]).normalized()
        d_out = (pts[i + 1] - pts[i]).normalized()
        if d_in.dot(d_out) > 0.99985:              # colinear (< 1°): sem curva
            linha.angulos.append(0.0)
            continue
        A, M, B, ang, t = g.geometria_curva(pts[i], d_in, d_out, R)
        linha.angulos.append(ang)
        if (A - inicio).length < -1e-6 or (A - inicio).dot(d_in) < -1e-3:
            linha.erros_montagem.append(f"trecho antes do vértice {i} é curto para a curva de "
                                        f"raio {R:.0f} mm")
        L = (A - inicio).length
        elementos.append(("reto", inicio, A, d_in, s, s + L))
        s += L
        arco = R * math.radians(ang)
        elementos.append(("curva", A, M, B, d_in, d_out, ang, s, s + arco))
        s += arco
        inicio = B
    d = (pts[-1] - inicio)
    elementos.append(("reto", inicio, pts[-1], d.normalized(), s, s + d.length))
    linha.elementos, linha.comprimento = elementos, s + d.length


def ponto_em(linha: Linha, s: float):
    """Ponto e direção do eixo na abscissa s (só em trecho reto)."""
    for el in linha.elementos:
        if el[0] == "reto" and el[4] - 1e-6 <= s <= el[5] + 1e-6:
            return el[1] + el[3] * (s - el[4]), el[3], el
    return None, None, None


def _trecho_reto_contem(linha: Linha, s0: float, s1: float) -> bool:
    return any(el[0] == "reto" and el[4] - 1e-6 <= s0 and s1 <= el[5] + 1e-6
               for el in linha.elementos)


def preparar_linha(m: Modelo, spec: dict) -> Linha:
    mat = spec["material"]
    tubo = normas.tubo(mat, int(spec.get("dn") or spec.get("de")), spec.get("sdr"))
    o = _resolver_ponto(m, spec["origem"], True, tubo)
    d = _resolver_ponto(m, spec["destino"], False, tubo)
    linha = Linha(spec["tag"], spec, tubo, spec.get("regime", "pressao"), None, None)
    linha.sifao = spec.get("sifao")
    linha._ref_origem, linha._ref_destino = o, d
    return linha


def tracar_linha(m: Modelo, linha: Linha, tes_pendentes: dict) -> None:
    spec, tubo = linha.spec, linha.tubo
    R = float(spec.get("raio_curva", 1.5)) * tubo.de
    o, d = linha._ref_origem, linha._ref_destino
    if o[0] == "te":
        linha.origem = _porta_te(m, o[1], linha, tes_pendentes, saindo=True)
    else:
        linha.origem = o[1]
    pontos_spec = spec.get("pontos", [])
    if d[0] == "te":
        linha.destino = _porta_te(m, d[1], linha, tes_pendentes, saindo=False)
    else:
        linha.destino = d[1]
    _expandir_sifao.ultimo = None
    pts = [linha.origem.ponto] + _expandir_sifao(pontos_spec, R, tubo.de, tubo.di)
    pts.append(linha.destino.ponto)
    linha.sifao_u = _expandir_sifao.ultimo          # (fundo início, fundo fim, topo da saída)
    linha.vertices = pts
    _trajeto(linha, R)
    linha.tubos_por_s = [(0.0, tubo)]
    _posicionar_componentes(linha)


def _porta_te(m: Modelo, ref: str, ramal: Linha, tes: dict, saindo: bool) -> Porta:
    """Registra um tê na linha principal; a porta fica na boca do ramal."""
    if isinstance(ref, dict):
        tag_run = ref["te"]
        run = m.linhas[tag_run]
        alvo_te = Vector(*map(float, ref["ponto"]))
        s = None
        for el in run.elementos:
            if el[0] != "reto":
                continue
            u = (alvo_te - el[1]).dot(el[3])
            if -1 <= u <= (el[2] - el[1]).length + 1 and (el[1] + el[3] * u - alvo_te).length < 2:
                s = el[4] + u
        if s is None:
            raise ValueError(f"{ramal.tag}: ponto do tê {tuple(alvo_te)} não está sobre trecho "
                             f"reto de {tag_run}")
    else:
        tag_run, s = ref.split("@")
        run = m.linhas[tag_run]
        s = float(s)
    P, d_run, _ = ponto_em(run, s)
    if P is None:
        raise ValueError(f"{ramal.tag}: tê em {ref} não cai em trecho reto")
    pts = ramal.spec.get("pontos", [])
    alvo = (Vector(*map(float, pts[0])) if saindo and pts else
            Vector(*map(float, pts[-1])) if pts else None)
    if isinstance(ref, dict) and "direcao" in ref:
        alvo = P + Vector(*map(float, ref["direcao"])) * 1000
    if alvo is None:
        raise ValueError(f"{ramal.tag}: informe 'pontos' para definir a direção do ramal do tê")
    n = alvo - P
    n = (n - d_run * n.dot(d_run))
    if n.length < 1:
        raise ValueError(f"{ramal.tag}: ramal paralelo à linha {tag_run}")
    n = n.normalized()
    h = run.tubo.de / 2 + 0.75 * ramal.tubo.de
    L = ramal.tubo.de + 1.0 * ramal.tubo.de
    tes.setdefault(tag_run, []).append({"s": s - L / 2, "L": L, "n": n, "h": h, "ramal": ramal.tag,
                                        "tubo_ramal": ramal.tubo})
    boca = P + n * h
    # direção da porta = saindo da linha principal (como um bocal de equipamento)
    return Porta(f"{tag_run}@{s:.0f}", boca, n, ramal.tubo.dn_flange, 10,
                 "ponta", "te", tag_run, ramal.tubo.de)


def _comprimento_componente(c: dict, tubo: normas.Tubo) -> float:
    tipo = c["tipo"]
    if tipo in FLANGEADOS:
        return normas.face_a_face(tipo, tubo.dn_flange)
    if tipo == "reducao":
        t2 = normas.tubo(tubo.material, int(c.get("dn2", c.get("de2"))))
        return max(3 * (tubo.de - t2.de), tubo.de)
    if tipo == "ventosa":
        return 2.2 * tubo.de
    raise ValueError(f"Componente desconhecido: {tipo}")


def _adaptador_comprimento(linha: Linha, porta: Porta, tubo: normas.Tubo) -> float:
    if porta.junta != "flange":
        return 0.0
    fl = normas.flange(porta.dn, porta.pn)
    return max(0.12 * tubo.de, 12) if tubo.material == "pead" else fl.t


def _posicionar_componentes(linha: Linha) -> None:
    tubo = linha.tubo
    s_ini = _adaptador_comprimento(linha, linha.origem, tubo)
    cursor = s_ini
    especificados = linha.spec.get("componentes", [])
    # componentes "fim" são empacotados de trás para frente a partir do destino
    finais = [c for c in especificados if c.get("distancia") == "fim"]
    normais = [c for c in especificados if c.get("distancia") != "fim"]
    retos = [el for el in linha.elementos if el[0] == "reto"]
    for c in normais:
        L = _comprimento_componente(c, linha.tubo_em(cursor))
        dist = c.get("distancia")
        if isinstance(dist, dict):          # {"trecho": i, "pos": inicio|meio|fim, "offset": mm}
            el = retos[int(dist["trecho"])]
            pos = dist.get("pos", "meio")
            base = {"inicio": el[4], "meio": (el[4] + el[5] - L) / 2, "fim": el[5] - L}[pos]
            s0 = base + float(dist.get("offset", 0.0))
        else:
            s0 = float(dist) if isinstance(dist, (int, float)) else cursor
        comp = Componente(c["tipo"], c.get("tag", c["tipo"]), s0, s0 + L,
                          linha.tubo_em(s0).dn_flange, dict(c))
        linha.componentes.append(comp)
        if c["tipo"] == "reducao":
            linha.tubos_por_s.append((s0 + L, normas.tubo(tubo.material,
                                                          int(c.get("dn2", c.get("de2"))))))
        cursor = s0 + L
    fim = linha.comprimento - _adaptador_comprimento(linha, linha.destino,
                                                     linha.tubo_em(linha.comprimento))
    def _t2(c):
        return normas.tubo(tubo.material, int(c.get("dn2", c.get("de2"))))

    for i, c in reversed(list(enumerate(finais))):
        # tubo onde o componente fica: o da redução final seguinte mais próxima a montante
        # dele na ordem da especificação; sem ela, o tubo da linha antes das reduções finais
        red_ant = [x for x in finais[:i] if x["tipo"] == "reducao"]
        t_aqui = _t2(red_ant[-1]) if red_ant else linha.tubo_em(fim - 1)
        if c["tipo"] == "reducao":
            t2 = _t2(c)
            L = max(3 * (t_aqui.de - t2.de), t_aqui.de) if t_aqui.de > t2.de else \
                max(3 * (t2.de - t_aqui.de), t2.de)
            linha.tubos_por_s.append((fim, t2))
            dn = t_aqui.dn_flange
        else:
            depois = [x for x in finais[:i + 1] if x["tipo"] == "reducao"]
            t_comp = _t2(depois[-1]) if depois else linha.tubo_em(fim - 1)
            L = _comprimento_componente(c, t_comp)
            dn = t_comp.dn_flange
        comp = Componente(c["tipo"], c.get("tag", c["tipo"]), fim - L, fim, dn, dict(c))
        linha.componentes.append(comp)
        fim -= L
    linha.tubos_por_s.sort(key=lambda x: x[0])
    linha.componentes.sort(key=lambda c: c.s0)
    for c in linha.componentes:
        if not _trecho_reto_contem(linha, c.s0, c.s1):
            linha.erros_montagem.append(f"{c.tag} ({c.tipo}) entre s={c.s0:.0f} e {c.s1:.0f} mm "
                                        "não cabe em trecho reto (cai em curva ou fora da linha)")


def construir_linha(m: Modelo, linha: Linha, tes: list) -> None:
    """Gera os sólidos da linha: tubos, curvas, juntas, adaptadores, válvulas, tês, setas."""
    nome = f"{linha.tag}-{linha.tubo.descricao.split()[-1] if linha.tubo.material != 'pead' else 'DE' + str(linha.tubo.dn)}"
    cor = CORES.get(linha.spec.get("servico", "agua"), CORES["agua"])
    if linha.tubo.material == "pead":
        cor = CORES["pead"] if linha.spec.get("cor") != "servico" else cor
    ocupados = []   # (s0, s1, tipo)

    def junta_flange(s: float, porta_fl: normas.Flange, tubo: normas.Tubo, sentido: int,
                     t_outro: float):
        """Adaptador do tubo + parafusos numa junta flangeada em s. sentido=+1: tubo segue
        a jusante de s (flange em s..s+t); -1: tubo chega de montante."""
        P, d, _ = ponto_em(linha, s)
        if P is None:
            linha.erros_montagem.append(f"junta flangeada em s={s:.0f} mm fora de trecho reto")
            return
        dd = d * sentido
        if tubo.material == "pead":
            t_c = max(0.12 * tubo.de, 12)
            peca = g.colarinho_pead(tubo.de, porta_fl) + Pos(0, 0, t_c) * g.flange_peca(
                porta_fl, tubo.de + 4)
            aperto = t_outro + t_c + porta_fl.t
            m.item("Colarinho PEAD + flange solto", f"DE{tubo.dn} / DN{porta_fl.dn} {normas.classe_txt(porta_fl.pn)}",
                   "cj", 1)
        else:
            peca = g.flange_peca(porta_fl, tubo.de) + Pos(0, 0, porta_fl.t) * (
                Cylinder(tubo.de / 2 * 1.22, 0.6 * tubo.de, align=g.BASE)
                - Cylinder(tubo.de / 2, 0.6 * tubo.de, align=g.BASE))
            aperto = t_outro + porta_fl.t
            m.item("Adaptador PVC flange-bolsa", f"DN{tubo.dn} / flange DN{porta_fl.dn} {normas.classe_txt(porta_fl.pn)}",
                   "un", 1)
        m.add(nome, g.posicionar(peca, P, dd), CORES["metal"])
        m.add(nome, g.posicionar(g.parafusos(porta_fl, aperto), P - dd * t_outro, dd),
              CORES["metal"])
        m.item("Jogo de parafusos, porcas e junta", f"{porta_fl.n}×{porta_fl.parafuso} DN{porta_fl.dn}",
               "jg", 1)

    # extremidades
    for porta, s, sentido in ((linha.origem, 0.0, 1), (linha.destino, linha.comprimento, -1)):
        tb = linha.tubo_em(s if sentido > 0 else s - 1)
        if porta.junta == "flange":
            fl = normas.flange(porta.dn, porta.pn)
            ta = _adaptador_comprimento(linha, porta, tb)
            junta_flange(s, fl, tb, sentido, fl.t)
            ocupados.append((s, s + ta, "adaptador") if sentido > 0 else
                            (s - ta, s, "adaptador"))
    # componentes
    for i, c in enumerate(linha.componentes):
        P, d, _ = ponto_em(linha, c.s0)
        if P is None:
            continue
        tb = linha.tubo_em(c.s0 + 0.5)
        L = c.s1 - c.s0
        cima = c.extra.get("cima", (0, 0, 1))
        if c.tipo in FLANGEADOS:
            fl = normas.flange(c.dn, int(linha.spec.get("pn", 10)))
            di = tb.di
            peca = {"gaveta": lambda: g.valvula_gaveta(fl, L, di),
                    "borboleta": lambda: g.valvula_borboleta(fl, L, di),
                    "retencao": lambda: g.valvula_retencao(fl, L, di),
                    "esfera": lambda: g.valvula_esfera(fl, L, di),
                    "junta_desmontagem": lambda: g.junta_desmontagem(fl, L, tb.de, di)}[c.tipo]()
            grupo = f"{c.tag}-DN{c.dn}" if c.tipo != "junta_desmontagem" else nome
            m.add(grupo, g.posicionar(peca, P, d, cima),
                  CORES["valvula"] if c.tipo != "junta_desmontagem" else CORES["metal"])
            rotulo = {"gaveta": "Válvula gaveta (registro) flangeada",
                      "borboleta": "Válvula borboleta wafer c/ redutor",
                      "retencao": "Válvula de retenção portinhola flangeada",
                      "esfera": "Válvula esfera flangeada",
                      "junta_desmontagem": "Junta de desmontagem travada"}[c.tipo]
            m.item(rotulo, f"DN{c.dn} {normas.classe_txt(int(linha.spec.get('pn', 10)))} F-F {L:.0f} mm", "un", 1)
            # vizinhos: componente flangeado colado -> só parafusos; senão adaptador no tubo
            ant = linha.componentes[i - 1] if i else None
            prox = linha.componentes[i + 1] if i + 1 < len(linha.componentes) else None
            colado_ant = (ant and ant.tipo in FLANGEADOS and abs(ant.s1 - c.s0) < 1) or (
                linha.origem.junta == "flange" and abs(c.s0) < 1)
            colado_prox = (prox and prox.tipo in FLANGEADOS and abs(prox.s0 - c.s1) < 1) or (
                linha.destino.junta == "flange" and abs(linha.comprimento - c.s1) < 1)
            if colado_ant:
                m.add(nome, g.posicionar(g.parafusos(fl, 2 * fl.t), P - d * fl.t, d),
                      CORES["metal"])
                m.item("Jogo de parafusos, porcas e junta", f"{fl.n}×{fl.parafuso} DN{fl.dn}", "jg", 1)
            else:
                junta_flange(c.s0, fl, tb, -1, fl.t)
                ta = _adaptador_comprimento(linha, Porta("", P, d, c.dn), tb)
                ocupados.append((c.s0 - ta, c.s0, "adaptador"))
            if not colado_prox:
                junta_flange(c.s1, fl, linha.tubo_em(c.s1 + 0.5), 1, fl.t)
                ta = _adaptador_comprimento(linha, Porta("", P, d, c.dn), linha.tubo_em(c.s1 + 0.5))
                ocupados.append((c.s1, c.s1 + ta, "adaptador"))
        elif c.tipo == "reducao":
            t2 = linha.tubo_em(c.s1 + 0.5)
            t1 = linha.tubo_em(c.s0 - 0.5)
            exc = bool(c.extra.get("excentrica", False))
            topo = c.extra.get("plano", "topo") == "topo"
            peca = g.reducao(t1.de, t1.di, t2.de, t2.di, L, exc, topo)
            m.add(nome, g.posicionar(peca, P, d, cima), cor)
            m.item(("Redução " if t2.de < t1.de else "Ampliação ")
                   + ("excêntrica" if exc else "concêntrica"),
                   f"{t1.descricao} × {t2.descricao}", "un", 1)
        elif c.tipo == "ventosa":
            dn_r = int(c.extra.get("dn_ramal", 50))
            de_r = min(tb.de, dn_r * 1.25)
            h = tb.de / 2 + 0.6 * de_r
            peca = g.te(tb.de, tb.di, L, de_r, de_r * 0.85, h)
            fl_r = normas.flange(dn_r)
            peca += g.posicionar(g.ventosa(fl_r, 2.2 * fl_r.D), (0, h, L / 2), (0, 1, 0))
            m.add(f"{c.tag}-DN{dn_r}", g.posicionar(peca, P, d, cima), CORES["valvula"])
            m.item("Tê com derivação flangeada + ventosa duplo efeito",
                   f"{tb.descricao} × DN{dn_r}", "cj", 1)
        ocupados.append((c.s0, c.s1, c.tipo))
    # tês de ramais que chegam/saem desta linha
    for t in tes:
        P, d, _ = ponto_em(linha, t["s"])
        if P is None:
            linha.erros_montagem.append(f"tê do ramal {t['ramal']} fora de trecho reto")
            continue
        tb = linha.tubo_em(t["s"] + 0.5)
        tr = t["tubo_ramal"]
        peca = g.te(tb.de, tb.di, t["L"], tr.de, tr.di, t["h"])
        m.add(nome, g.posicionar(peca, P, d, t["n"]), cor)
        m.item("Tê / junção", f"{tb.descricao} × {tr.descricao}", "un", 1)
        for c in linha.componentes:
            if c.tipo != "te" and c.s0 < t["s"] + t["L"] and t["s"] < c.s1:
                linha.erros_montagem.append(f"tê do ramal {t['ramal']} (s={t['s']:.0f}) "
                                            f"sobreposto a {c.tag} ({c.s0:.0f}–{c.s1:.0f} mm)")
        linha.componentes.append(Componente("te", f"TE-{t['ramal']}", t["s"], t["s"] + t["L"],
                                            tb.dn_flange, {"ramal": t["ramal"]}))
        ocupados.append((t["s"], t["s"] + t["L"], "te"))
    linha.componentes.sort(key=lambda c: c.s0)
    ocupados.sort()
    # tubos e curvas nos intervalos livres
    barra = normas.BARRA[linha.tubo.material]
    comprimento_tubo = {}
    for el in linha.elementos:
        if el[0] == "curva":
            _, A, M, B, d_in, d_out, ang, s0, s1 = el
            tb = linha.tubo_em(s0)
            m.add(nome, g.tubo_por_arco(tb.de, tb.di, A, M, B, d_in), cor)
            ang_com = min(normas.ANGULOS_COMERCIAIS, key=lambda a: abs(a - ang))
            m.item(f"Curva {ang_com:g}°" if abs(ang_com - ang) <= normas.TOLERANCIA_DEFLEXAO
                   else f"Curva especial {ang:.1f}°", tb.descricao, "un", 1)
            # bolsa da curva abraça o tubo reto vizinho (boca voltada para fora da curva)
            for ponto, dirx in ((A, -d_in), (B, d_out)):
                if tb.material == "pead":
                    m.add(nome, g.posicionar(g.cordao_solda(tb.de), ponto, dirx), cor)
                else:
                    m.add(nome, g.posicionar(g.bolsa(tb.de), ponto, dirx), cor)
            continue
        _, A, B, d, s0, s1 = el
        livres = [(s0, s1)]
        for o0, o1, _t in ocupados:
            novos = []
            for a, b in livres:
                if o1 <= a or o0 >= b:
                    novos.append((a, b))
                    continue
                if o0 > a:
                    novos.append((a, o0))
                if o1 < b:
                    novos.append((o1, b))
            livres = novos
        for a, b in livres:
            if b - a < 1:
                continue
            tb = linha.tubo_em(a + 0.5)
            P = A + d * (a - s0)
            m.add(nome, g.posicionar(g.tubo_reto(tb.de, tb.di, b - a), P, d), cor)
            comprimento_tubo[tb.descricao] = comprimento_tubo.get(tb.descricao, 0) + (b - a)
            # juntas a cada barra e seta de sentido de escoamento
            k = barra
            while a + k < b - 50:
                if tb.material == "pead":
                    m.add(nome, g.posicionar(g.cordao_solda(tb.de), A + d * (a + k - s0), d), cor)
                else:
                    m.add(nome, g.posicionar(g.bolsa(tb.de), A + d * (a + k - s0), d), cor)
                k += barra
            if b - a > 4 * tb.de and linha.regime != "ventilacao":
                meio = A + d * ((a + b) / 2 - s0)
                m.add(nome, g.posicionar(g.seta_fluxo(tb.de), meio, d), (1.0, 0.75, 0.0, 1))
    for desc, L in comprimento_tubo.items():
        if L < 50:      # toco entre conexões soldadas: não é item de compra
            continue
        m.item("Tubo", f"{desc} ({math.ceil(L / barra)} barra(s) de {barra / 1000:g} m)", "m",
               round(L / 1000, 2))
    if linha.spec.get("curvas_sob_medida"):
        n_c = sum(1 for a in linha.angulos if a)
        m.item("Curva gomada PEAD sob medida (ângulo do traçado)", f"{linha.tubo.descricao}",
               "un", n_c)
    if linha.spec.get("ponto_alto"):
        m.item("Respiro manual no ponto alto (DN25, válvula esfera)", linha.tag, "un", 1)
    if linha.regime == "ventilacao" and not linha.spec.get("fechada"):
        tb = linha.tubo_em(linha.comprimento)
        m.add(nome, dv.respiro_topo(tb.de, tb.di, linha.destino.ponto), CORES["metal"])
        m.item("Pescoço de ganso c/ tela (topo do respiro)", tb.descricao, "un", 1)
    if linha.spec.get("suportes", linha.regime == "pressao") is not False:
        _suportes(m, linha, ocupados)


def _suportes(m: Modelo, linha: Linha, ocupados) -> None:
    """Apoios de concreto nos trechos horizontais acima do piso e sob cada válvula."""
    piso = float(linha.spec.get("z_piso", m.piso))
    grupo = f"S-{linha.tag}"
    alvos = []
    for el in linha.elementos:
        if el[0] != "reto":
            continue
        _, A, B, d, s0, s1 = el
        if abs(d.Z) > 0.1:
            continue
        tb = linha.tubo_em(s0)
        if min(A.Z, B.Z) - tb.de / 2 - piso < 60 or _dentro_de_tanque(m, A) or _dentro_de_tanque(m, B):
            continue
        vao = normas.vao_maximo(tb)
        n = max(int(math.ceil((s1 - s0) / vao)), 1)
        for k in range(1, n):
            alvos.append(s0 + (s1 - s0) * k / n)
    usados = []
    # apoio de válvula tem prioridade; apoios de vão a menos de 300 mm de outro são descartados
    valvulas = [(c.s0 + c.s1) / 2 for c in linha.componentes if c.tipo in FLANGEADOS]
    for s in valvulas + sorted(x for x in alvos if x not in valvulas):
        if any(abs(s - u) < 300 for u in usados):
            continue
        usados.append(s)
        # não apoiar sobre flange/adaptador: desloca para fora do componente
        for o0, o1, t in ocupados:
            if o0 - 30 < s < o1 + 30 and t not in FLANGEADOS:
                s = o1 + 60 if o1 + 60 < linha.comprimento else o0 - 60
        P, d, _ = ponto_em(linha, s)
        if P is None or abs(d.Z) > 0.1 or _dentro_de_tanque(m, P, folga=900):
            continue
        if P.Z > float(linha.spec.get("z_max_apoio", 2500)):   # acima disso: pipe-rack (S6)
            continue
        tb = linha.tubo_em(s)
        if P.Z - tb.de / 2 - piso < 60:
            continue
        de_apoio = max(tb.de, normas.flange(tb.dn_flange).D if any(
            c.s0 <= s <= c.s1 and c.tipo in FLANGEADOS for c in linha.componentes) else tb.de)
        sup = g.suporte_apoio(de_apoio, 0, piso - P.Z)
        giro = math.degrees(math.atan2(d.Y, d.X)) + 90   # abraçadeira ao longo do tubo
        m.add(grupo, Location(tuple(P), (0, 0, giro)) * sup, CORES["concreto"])
        linha.suportes.append(P)
    if linha.suportes:
        m.item("Apoio de concreto c/ sela e abraçadeira", f"{linha.tag}", "un", len(linha.suportes))


def _dentro_de_tanque(m: Modelo, P: Vector, folga: float = 0.0) -> bool:
    for eq in m.equipamentos.values():
        if eq.get("tipo") not in ("tanque", "reator_prfv", "tanque_prfv"):
            continue
        cx, cy = eq["centro"]
        a, b = eq["dim"]
        t = eq["parede"]
        f = min(folga, 300.0) if eq.get("pote") else folga   # pote de selagem: só as pernas
        if eq["cil"]:
            if math.hypot(P.X - cx, P.Y - cy) <= a / 2 + t + f and P.Z <= eq["borda"] + 2000:
                return True
        elif abs(P.X - cx) <= a / 2 + t and abs(P.Y - cy) <= b / 2 + t and P.Z <= eq["borda"]:
            return True
    return False


def montar(spec: dict) -> Modelo:
    m = Modelo(spec, piso=float(spec.get("piso", 0)))
    for e in spec.get("equipamentos", []):
        {"tanque": tanque, "caixa": tanque, "bomba": bomba, "misturador": misturador}[e["tipo"]](m, e)
        if e["tipo"] == "caixa":
            m.equipamentos[e["tag"]]["tipo"] = "tanque"
    specs = list(spec.get("linhas", []))
    for s in spec.get("linhas", []):          # respiro na crista de perna de nível (quebra-sifão)
        r = s.get("respiro")
        if r:
            P = list(map(float, r["ponto"]))
            specs.append({"tag": f"{s['tag']}-RESP", "servico": "ar", "regime": "ventilacao",
                          "material": r.get("material", s["material"]),
                          ("de" if r.get("material", s["material"]) == "pead" else "dn"): r["dn"],
                          "suportes": False,
                          "origem": {"te": s["tag"], "ponto": P, "direcao": [0, 0, 1]},
                          "destino": {"ponto": [P[0], P[1], float(r["topo"])],
                                      "descricao": "respiro aberto"}})
    linhas = [preparar_linha(m, s) for s in specs]
    for ln in linhas:
        m.linhas[ln.tag] = ln
    # linhas sem tê primeiro (as que recebem ramais precisam do traçado pronto)
    tes: dict = {}
    ordem = sorted(linhas, key=lambda ln: (ln._ref_origem[0] == "te") or (ln._ref_destino[0] == "te"))
    for ln in ordem:
        tracar_linha(m, ln, tes)
    for ln in linhas:
        construir_linha(m, ln, tes.get(ln.tag, []))
    return m


def exportar(m: Modelo, base: str, deflexao: float = 2.0) -> None:
    """STEP exato + glTF tesselado (deflexao em mm; 5–8 mm deixa o .glb leve para a web)."""
    from build123d import export_gltf, export_step
    filhos = []
    for nome, itens in m.pecas.items():
        partes = []
        for i, (solido, cor) in enumerate(itens):
            solido.color = cor
            solido.label = nome if i == 0 else f"{nome}.{i:03d}"   # tag chega ao Blender/three
            partes.append(solido)
        grupo = Compound(children=partes)
        grupo.label = nome
        filhos.append(grupo)
    montagem = Compound(children=filhos)
    export_step(montagem, f"{base}.step")
    export_gltf(montagem, f"{base}.glb", binary=True, linear_deflection=deflexao,
                angular_deflection=0.35 if deflexao <= 2 else 0.6)
