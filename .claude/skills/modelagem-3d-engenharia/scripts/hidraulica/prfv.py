"""Tanques e reatores de PRFV com bocais flangeados ANSI B16.5 150# (padrão Fibrais).

Cada bocal tem um ESTADO, que é o que vai para o fornecedor:
  usar      bocal existente (as-built) que recebe tubulação ou dispositivo
  tamponar  bocal existente sem uso: flange cego PRFV + junta + parafusos
  converter acessório existente que vira flange e é tamponado (ex.: respiro A4 em PVC)
  novo      bocal a executar (furo + pescoço + reforço do laminado), com DN/cota/azimute

Azimute no padrão dos desenhos Fibrais: 0° no topo da planta, sentido horário. A planta do
projeto usa x = leste e y = norte, com o topo da planta voltado para o norte (premissa de
locação S5): direção = (sen α, cos α).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from build123d import Align, Box, Cone, Cylinder, Pos, Rot, Sphere, Torus, Vector

from . import geometria as g
from . import normas

C3 = (Align.CENTER,) * 3
COR = {"prfv": (0.82, 0.83, 0.80, 1), "usar": (0.70, 0.71, 0.70, 1),
       "tamponar": (1.00, 0.45, 0.00, 1), "novo": (0.10, 0.75, 0.25, 1),
       "converter": (1.00, 0.45, 0.00, 1), "dispositivo": (0.70, 0.08, 0.06, 1),
       "instrumento": (0.95, 0.80, 0.10, 1), "aco": (0.95, 0.80, 0.10, 1),
       "motor": (0.10, 0.30, 0.60, 1)}
DN_POL = {25: '1"', 50: '2"', 80: '3"', 100: '4"', 150: '6"', 200: '8"', 300: '12"',
          600: '24"', 800: "Ø800 mm"}


def direcao(az: float) -> Vector:
    a = math.radians(az)
    return Vector(math.sin(a), math.cos(a), 0)


@dataclass
class Bocal:
    tag: str
    dn: int                      # mm (6" = 150)
    local: str                   # costado | tampo | fundo
    estado: str                  # usar | tamponar | converter | novo
    servico: str
    az: float = 0.0
    elev: float = 0.0            # costado: cota do eixo; tampo/fundo: cota da face do flange
    raio: float = 0.0            # tampo: distância ao eixo do tanque
    proj: float = 120.0
    origem: str = "as-built"     # referência do desenho ou "novo (CSTR)"
    ligacao: str = ""            # linha ou dispositivo ligado
    nota: str = ""
    soleira: float | None = None # informativo (cota da geratriz inferior interna)


@dataclass
class TanquePRFV:
    tag: str
    desenho: str
    centro: tuple
    Di: float
    z_fundo: float               # cota do fundo interno (plano) ou do início do cilindro (cônico)
    Hcil: float
    t: float = 12.0
    fundo: str = "plano"         # plano | conico
    h_cone: float = 0.0
    pes: list = field(default_factory=list)          # azimutes dos pés (fundo cônico)
    tampo: str = "fechado"       # fechado (gás) | atmosferico
    bocais: list = field(default_factory=list)
    escada_az: float | None = None
    guarda_corpo: bool = True
    chicanas: int = 0
    niveis: dict = field(default_factory=dict)       # nome -> cota (mm)
    gas: bool = False

    @property
    def R(self) -> float:
        return self.Di / 2

    @property
    def z_tampo(self) -> float:
        return self.z_fundo + self.Hcil

    def bocal(self, tag: str) -> Bocal:
        return next(b for b in self.bocais if b.tag == tag)


def _pescoco(dn: int) -> tuple[float, float]:
    """(Ø externo, Ø interno) do pescoço PRFV do bocal."""
    di = {25: 26.6, 50: 50.8, 80: 77.9, 100: 102.3, 150: 152.4, 200: 202.7, 300: 304.8,
          600: 590.5, 800: 800.0}[dn]
    return di + 2 * max(8.0, 0.06 * di), di


def _flange_prfv(dn: int):
    """Flange PRFV (furação ANSI 150#); devolve (Flange de furação, D externo, espessura)."""
    if dn == 800:     # M2: flange próprio Fibrais (Ø900 / furação Ø850, 8 parafusos 5/16")
        return normas.Flange(800, 150, 900, 850, 8, 9.5, "M8", 30), 900.0, 30.0
    fl = normas.flange(dn, normas.CLASSE_ANSI)
    D, t = normas.FLANGE_PRFV.get(dn, (fl.D * 1.04, max(fl.t + 6, 22)))
    return fl, D, t


def _peca_bocal(b: Bocal, comprimento: float):
    """Bocal em coordenadas locais: pescoço de z=0 a z=L, face do flange em z=L."""
    de, di = _pescoco(b.dn)
    fl, D, tf = _flange_prfv(b.dn)
    L = comprimento
    neck = Cylinder(de / 2, L - tf, align=g.BASE) - Cylinder(di / 2, L - tf, align=g.BASE)
    furo = 0 if b.dn == 800 else di
    flange = Pos(0, 0, L - tf) * _disco_furado(fl, D, tf, furo)
    corpo = neck + flange
    extra = None
    if b.estado in ("tamponar", "converter"):
        extra = Pos(0, 0, L) * _disco_furado(fl, D, tf * 0.8, 0)
        extra += Pos(0, 0, L - tf) * g.parafusos(fl, tf * 1.8)
    return corpo, extra, (fl, D, tf)


def _disco_furado(fl, D, t, furo):
    p = Cylinder(D / 2, t, align=g.BASE)
    if furo:
        p -= Cylinder(furo / 2, t, align=g.BASE)
    for i in range(fl.n):
        a = 2 * math.pi * (i + 0.5) / fl.n
        p -= Pos(fl.k / 2 * math.cos(a), fl.k / 2 * math.sin(a)) * Cylinder(fl.furo / 2, t,
                                                                            align=g.BASE)
    return p


def construir(m, tq: TanquePRFV):
    """Gera casco, bocais, acessórios e registra portas e a tabela de bocais no Modelo."""
    from .montagem import Porta
    cx, cy = tq.centro
    R, t = tq.R, tq.t
    z0, z1 = tq.z_fundo, tq.z_tampo
    casco = Pos(cx, cy, z0) * (Cylinder(R + t, tq.Hcil, align=g.BASE)
                               - Cylinder(R, tq.Hcil, align=g.BASE))
    if tq.fundo == "plano":
        casco += Pos(cx, cy, z0 - t) * Cylinder(R + t, t, align=g.BASE)
    else:
        hc = tq.h_cone
        cone = Pos(cx, cy, z0 - hc) * (Cone(80 + t, R + t, hc, align=g.BASE)
                                       - Cone(80, R, hc, align=g.BASE))
        casco += cone
        for az in tq.pes:
            d = direcao(az) * (R + t + 60)
            casco += Pos(cx + d.X, cy + d.Y, 0) * Cylinder(84, z0 + 200, align=g.BASE)
    casco += Pos(cx, cy, z1) * Cylinder(R + t, 15 if tq.tampo == "fechado" else 12, align=g.BASE)
    # reforços do tampo (vigas PRFV, como nos desenhos)
    for dy in (-0.5, 0.0, 0.5):
        casco += Pos(cx, cy + dy * R * 1.2, z1 + 15) * Box(2 * R * 0.95, 80, 60, align=(
            Align.CENTER, Align.CENTER, Align.MIN))
    if tq.gas:      # abertura central do eixo do agitador (Ø400 nos desenhos 315D/E-25)
        casco -= Pos(cx, cy, z1 - 10) * Cylinder(200, 200, align=g.BASE)
    furos = []
    m.equipamentos[tq.tag] = {"tipo": "reator_prfv" if tq.gas else "tanque_prfv", "obj": tq,
                              "centro": (cx, cy), "dim": (tq.Di, tq.Di), "parede": t,
                              "cil": True, "borda": z1, "z_fundo": z0, "solido": None}
    m.tabela_bocais = getattr(m, "tabela_bocais", [])
    for b in tq.bocais:
        if b.local == "costado":
            n = direcao(b.az)
            base = Vector(cx, cy, b.elev) + n * (R - 5)
            L = t + 5 + b.proj
            loc_o, eixo = base, n
            face = base + n * L
        elif b.local == "tampo":
            off = direcao(b.az) * b.raio
            base = Vector(cx + off.X, cy + off.Y, z1)
            L = b.elev - z1
            loc_o, eixo = base, Vector(0, 0, 1)
            face = Vector(base.X, base.Y, b.elev)
        else:   # fundo do cone, flange voltado para baixo
            base = Vector(cx, cy, z0 - tq.h_cone)
            L = (z0 - tq.h_cone) - b.elev
            loc_o, eixo = base, Vector(0, 0, -1)
            face = Vector(cx, cy, b.elev)
        corpo, extra, (fl, D, tf) = _peca_bocal(b, L)
        grupo = f"{b.tag}-{tq.tag}-DN{b.dn}"
        cor = COR["novo"] if b.estado == "novo" else COR["usar"]
        m.add(grupo, g.posicionar(corpo, loc_o, eixo), cor)
        if extra is not None:
            m.add(grupo, g.posicionar(extra, loc_o, eixo), COR[b.estado])
        if b.estado == "novo" and b.local == "costado":     # reforço do laminado (repad)
            de, _ = _pescoco(b.dn)
            m.add(grupo, g.posicionar(Cylinder(de * 1.1, 8, align=g.BASE) - Cylinder(
                de / 2, 8, align=g.BASE), base + n * (t + 5), n), COR["novo"])
        de, di = _pescoco(b.dn)
        # furo no laminado pelo Ø externo do pescoço (o pescoço é laminado no furo)
        furos.append(g.posicionar(Cylinder(de / 2, t * 4 + 60, align=g.BASE),
                                  loc_o - eixo * (t * 2 + 30), eixo))
        if b.estado in ("usar", "novo"):
            p = Porta(f"{tq.tag}.{b.tag}", face, eixo, b.dn, normas.CLASSE_ANSI, "flange",
                      b.servico, tq.tag, de=None, di=di, extra={"bocal": b})
            m.portas[p.nome] = p
        m.tabela_bocais.append((tq, b))
    for f in furos:
        casco -= f
    if tq.chicanas:
        w = tq.Di / 12
        for k in range(tq.chicanas):
            a = 45 + 90 * k
            d = direcao(a) * (R - w / 2 - 20)
            casco += Pos(cx + d.X, cy + d.Y, (z0 + 300 + z1 - 300) / 2) * Rot(0, 0, -a) * Box(
                12, w, (z1 - 300) - (z0 + 300), align=C3)
    m.add(tq.tag, casco, COR["prfv"])
    m.equipamentos[tq.tag]["solido"] = casco
    if tq.guarda_corpo:
        gc = None
        for h in (550, 1100):
            r = Pos(cx, cy, z1 + h) * Torus(R + t - 40, 21)
            gc = r if gc is None else gc + r
        for k in range(12):
            d = direcao(15 + 30 * k) * (R + t - 40)      # montantes fora dos eixos dos bocais
            gc += Pos(cx + d.X, cy + d.Y, z1) * Cylinder(21, 1100, align=g.BASE)
        m.add(f"A7-{tq.tag}", gc, COR["aco"])
    if tq.escada_az is not None:
        n = direcao(tq.escada_az)
        tg = Vector(n.Y, -n.X, 0)
        P = Vector(cx, cy, 0) + n * (R + t + 250)
        z_lo = 0 if tq.fundo == "plano" else 0
        esc = None
        for s in (-1, 1):
            q = P + tg * (s * 230)
            e = Pos(q.X, q.Y, z_lo) * Cylinder(25, z1 + 1100 - z_lo, align=g.BASE)
            esc = e if esc is None else esc + e
        for zz in range(int(z_lo) + 300, int(z1) + 1000, 300):
            esc += g.posicionar(Cylinder(12, 460, align=C3), (P.X, P.Y, zz), tg)
        m.add(f"A6-{tq.tag}", esc, COR["aco"])
    return tq


# --- Dispositivos sobre bocais -------------------------------------------------------------

def selo_hidraulico(m, tq: TanquePRFV, tag_bocal: str, tag: str):
    """Envelope do selo hidráulico (alívio normal) montado direto no bocal do tampo
    (RES-001 SP-13). Dimensões representativas: a Fibrais dimensiona e garante (LAC-017)."""
    b = tq.bocal(tag_bocal)
    P = m.portas[f"{tq.tag}.{tag_bocal}"].ponto
    vaso = Pos(P.X, P.Y, P.Z) * Cylinder(260, 1100, align=g.BASE)
    vaso += Pos(P.X, P.Y, P.Z + 1100) * Cone(260, 60, 250, align=g.BASE)
    vaso += Pos(P.X + 260, P.Y, P.Z + 300) * Rot(0, 90, 0) * Cylinder(30, 180, align=C3)  # visor
    m.add(f"{tag}-{tq.tag}", vaso, COR["dispositivo"])
    del m.portas[f"{tq.tag}.{tag_bocal}"]
    b.ligacao = tag
    m.item("Selo hidráulico bidirecional (alívio normal, dimensionado pela Fibrais)",
           f"{tq.tag} sobre {tag_bocal} {DN_POL[b.dn]}", "un", 1)


def emergencia_m2(m, tq: TanquePRFV, tag_bocal: str, tag: str):
    """Envelope do dispositivo de emergência bidirecional na M2 (DEC-001; LAC-032)."""
    b = tq.bocal(tag_bocal)
    P = m.portas[f"{tq.tag}.{tag_bocal}"].ponto
    d = Pos(P.X, P.Y, P.Z) * Cylinder(450, 120, align=g.BASE)
    d += Pos(P.X, P.Y, P.Z + 120) * Cylinder(420, 260, align=g.BASE)
    d += Pos(P.X, P.Y, P.Z + 380) * Cylinder(150, 180, align=g.BASE)          # contrapeso
    d += Pos(P.X, P.Y, P.Z + 120) * (Cylinder(470, 40, align=g.BASE) - Cylinder(430, 40,
                                                                                align=g.BASE))
    m.add(f"{tag}-{tq.tag}", d, COR["dispositivo"])
    del m.portas[f"{tq.tag}.{tag_bocal}"]
    b.ligacao = tag
    m.item("Dispositivo de alívio de emergência bidirecional (pressão e vácuo) na M2",
           f"{tq.tag}: dimensionado e garantido pela Fibrais (RES-001 §7)", "un", 1)


def instrumento(m, tq: TanquePRFV, tag_bocal: str, tag: str, tipo: str, comprimento=0.0):
    """Instrumento sobre bocal: radar (LT), garfo vibratório (LSHH/LSLL), PT, boia, pH."""
    b = tq.bocal(tag_bocal)
    porta = m.portas.pop(f"{tq.tag}.{tag_bocal}")
    P, n = porta.ponto, porta.direcao
    if tipo == "radar":
        corpo = g.posicionar(Cylinder(70, 180, align=g.BASE), P, n)
        corpo += g.posicionar(Cone(110, 40, 160, align=g.BASE), P, -n)
    elif tipo == "garfo":
        corpo = g.posicionar(Cylinder(45, 140, align=g.BASE), P, n)
        corpo += g.posicionar(Box(24, 10, 140, align=(Align.CENTER, Align.CENTER, Align.MIN)),
                              P - n * (b.proj + tq.t + 140), n)
    elif tipo == "pt":
        corpo = g.posicionar(Cylinder(30, 200, align=g.BASE), P, n)
        corpo += g.posicionar(Box(110, 90, 110, align=C3), P + n * 260, n)
    elif tipo == "boia":                                       # chave de nível por boia
        corpo = g.posicionar(Cylinder(55, 120, align=g.BASE), P, n)
        cabo = g.posicionar(Cylinder(4, comprimento, align=g.BASE), P - n * comprimento, n)
        corpo += cabo + Pos(*(P - n * comprimento - n * 60)) * Sphere(60)
    elif tipo == "ph":
        corpo = g.posicionar(Cylinder(30, comprimento, align=g.BASE), P - n * comprimento, n)
        corpo += g.posicionar(Cylinder(45, 150, align=g.BASE), P, n)
    else:
        raise ValueError(tipo)
    m.add(f"{tag}-{tq.tag}", corpo, COR["instrumento"])
    b.ligacao = tag
    return corpo


def agitador_topo(m, tq: TanquePRFV, tag: str, n_niveis=2, z_rotor=None, d_rotor=None,
                  pot_cv=None):
    """Agitador vertical de topo pela abertura central do tampo (Fibrais; LAC-007/030)."""
    cx, cy = tq.centro
    z1 = tq.z_tampo
    d_rotor = d_rotor or 0.40 * tq.Di
    base = Pos(cx, cy, z1 + 75) * Box(700, 700, 60, align=g.BASE)
    red = Pos(cx, cy, z1 + 135) * Box(420, 420, 380, align=g.BASE)
    mot = Pos(cx, cy, z1 + 515) * Cylinder(170, 520, align=g.BASE)
    fixo = base + red + mot
    z_fim = tq.z_fundo + 150
    eixo = Pos(cx, cy, z_fim) * Cylinder(40, z1 + 135 - z_fim, align=g.BASE)
    zs = z_rotor or [tq.z_fundo + 0.18 * tq.Hcil, tq.z_fundo + 0.55 * tq.Hcil][:n_niveis]
    rot = eixo + Pos(cx, cy, z_fim - 60) * Cylinder(90, 120, align=g.BASE)    # pino de fundo
    for z in zs:
        rot += Pos(cx, cy, z) * Cylinder(90, 180, align=C3)
        for k in range(4):
            pa = Pos(d_rotor / 4 + 45, 0, 0) * Rot(45, 0, 0) * Box(d_rotor / 2 - 90, d_rotor / 7,
                                                                   14, align=C3)
            rot += Pos(cx, cy, z) * Rot(0, 0, 90 * k) * pa
    m.add(tag, fixo, COR["motor"])
    m.add(f"{tag}-ROTOR", rot, (0.55, 0.57, 0.60, 1))
    m.item("Agitador vertical de topo (Fibrais T211026-45)",
           f"{tag} em {tq.tag}" + (f", {pot_cv} CV" if pot_cv else ""), "un", 1)


def bomba_pcp(m, tag: str, origem, rot_z: float, dn_s: int, dn_r: int, L: float = 1600):
    """Bomba de cavidade progressiva horizontal: sucção lateral (+y local) na carcaça de
    entrada, recalque axial na ponta do estator. Local: eixo ao longo de +x, z do eixo = 450."""
    from build123d import Location
    from .montagem import Porta
    zc = 450.0
    fs, fr = normas.flange(dn_s, normas.CLASSE_ANSI), normas.flange(dn_r, normas.CLASSE_ANSI)
    base = Pos(L / 2 - 400, 0, 0) * Box(L + 900, 480, 120, align=g.BASE)
    carcaca = Pos(0, 0, zc) * Box(360, 300, 320, align=C3)
    # sucção lateral no eixo (+y local): a bomba fica abaixo do nível mínimo do tanque
    boca_s = g.posicionar(Cylinder(fs.D / 2 * 0.62, 230, align=g.BASE), (0, 150, zc), (0, 1, 0))
    fl_s = g.posicionar(g.flange_peca(fs, dn_s), (0, 380 - fs.t, zc), (0, 1, 0))
    estator = g.posicionar(Cylinder(110, L, align=g.BASE), (180, 0, zc), (1, 0, 0))
    boca_r = g.posicionar(Cylinder(fr.D / 2 * 0.62, 150, align=g.BASE), (180 + L, 0, zc), (1, 0, 0))
    fl_r = g.posicionar(g.flange_peca(fr, dn_r), (180 + L + 150 - fr.t, 0, zc), (1, 0, 0))
    lanterna = g.posicionar(Cylinder(90, 300, align=g.BASE), (-480, 0, zc), (1, 0, 0))
    motor = g.posicionar(Cylinder(170, 600, align=g.BASE), (-1080, 0, zc), (1, 0, 0))
    red = Pos(-480 - 100, 0, zc) * Box(240, 300, 300, align=C3)
    pes = Pos(0, 0, 120) * Box(260, 300, zc - 280, align=g.BASE)
    pes += Pos(180 + L, 0, 120) * Box(200, 260, zc - 230, align=g.BASE)
    corpo = base + carcaca + boca_s + fl_s + estator + boca_r + fl_r + lanterna + motor + red + pes
    loc = Location(tuple(origem), (0, 0, rot_z))
    m.add(tag, loc * corpo, COR["motor"])
    portas = {"succao": ((0, 380, zc), (0, 1, 0), dn_s),
              "recalque": ((180 + L + 150, 0, zc), (1, 0, 0), dn_r)}
    for nome, (p, d, dn) in portas.items():
        P = (loc * Pos(*p)).position
        D = (Rot(0, 0, rot_z) * Pos(*d)).position.normalized()
        m.portas[f"{tag}.{nome}"] = Porta(f"{tag}.{nome}", P, D, dn, normas.CLASSE_ANSI,
                                          "flange", nome, tag)
    m.equipamentos[tag] = {"tipo": "bomba", "solido": loc * corpo, "spec": {"tag": tag}}
    m.item("Bomba de cavidade progressiva (PCP)", f"{tag} sucção {DN_POL[dn_s]} recalque "
           f"{DN_POL[dn_r]}", "un", 1)


def filtro_carvao(m, tag: str, centro, porta_nome: str):
    """Envelope do filtro de carvão ativado do respiro do TQ-201 (FCA-201; LAC-042)."""
    from .montagem import Porta
    x, y = centro
    v = Pos(x, y, 0) * Cylinder(350, 1300, align=g.BASE)
    v += Pos(x, y, 1300) * Cone(350, 80, 200, align=g.BASE)
    m.add(tag, v, (0.25, 0.25, 0.28, 1))
    fl = normas.flange(150, normas.CLASSE_ANSI)
    face = Vector(x - 350 - 150, y, 900)
    m.add(f"{tag}", g.posicionar(Cylinder(85, 150, align=g.BASE), Vector(x - 350, y, 900),
                                 Vector(-1, 0, 0)), (0.25, 0.25, 0.28, 1))
    m.add(f"{tag}", g.posicionar(g.flange_peca(fl, 150), face + Vector(fl.t, 0, 0),
                                 Vector(-1, 0, 0)), COR["usar"])
    m.portas[porta_nome] = Porta(porta_nome, face, Vector(-1, 0, 0), 150, normas.CLASSE_ANSI,
                                 "flange", "entrada", tag)
    m.equipamentos[tag] = {"tipo": "filtro", "solido": v}
    m.item("Filtro de carvão ativado do respiro (FCA-201)", "envelope; especificar (LAC-042)",
           "un", 1)


def pote_selagem(m, tag: str, centro, z_vertedor: float, selo: float, az_saida: float,
                 Di: float = 400.0, de_dip: float = 160.0, folga_fundo: float = 200.0,
                 bordo: float = 350.0, desenho: str = "novo (CSTR)") -> TanquePRFV:
    """Pote de selagem (fecho hídrico) de saída por gravidade de reator fechado.

    A descida do reator entra pelo bocal do tampo e continua por dentro como tubo mergulhado
    (dip-leg) até `selo` abaixo da soleira do vertedor; o pote transborda pelo bocal lateral
    (soleira = z_vertedor) para o tanque de destino. O ânulo externo fica à pressão do destino
    (ventilado pela própria linha de transbordo, que trabalha com lâmina livre).
    Poucas curvas cheias: com polpa de tensão de escoamento alta cada curva cheia custa caro.
    """
    z_dip = z_vertedor - selo
    z0 = z_dip - folga_fundo
    H = z_vertedor + bordo - z0
    di_dip = normas.tubo("pead", int(de_dip)).di
    b = [Bocal("N-ENT", 150, "tampo", "novo", "chegada do reator; continua como tubo mergulhado",
               raio=0, elev=z0 + H + 150, origem=desenho),
         Bocal("N-SAI", 150, "costado", "novo", "vertedor de saída (lâmina livre) ao destino",
               az=az_saida, elev=z_vertedor + 76, origem=desenho, soleira=z_vertedor),
         Bocal("N-DRE", 50, "costado", "tamponar", "dreno/limpeza do fundo do pote: cego com "
               "registro DN50 (só com a saída do reator fechada)", az=(az_saida + 180) % 360,
               elev=z0 + 90, origem=desenho),
         Bocal("N-LAV", 50, "costado", "tamponar", "engate de água de lavagem (flushing)",
               az=(az_saida + 90) % 360, elev=z_vertedor + 200, origem=desenho)]
    tq = TanquePRFV(tag, desenho, centro, Di, z0, H, t=10, tampo="fechado", bocais=b,
                    escada_az=None, guarda_corpo=False, gas=False)
    construir(m, tq)
    cx, cy = centro
    dip = Pos(cx, cy, z_dip) * (Cylinder(de_dip / 2, z0 + H - z_dip, align=g.BASE)
                                - Cylinder(di_dip / 2, z0 + H - z_dip, align=g.BASE))
    m.add(f"{tag}-DIP", dip, COR["usar"])
    pernas = None
    for az in (45, 135, 225, 315):
        d = direcao(az) * (Di / 2 + 10 + 40)
        p = Pos(cx + d.X, cy + d.Y, 0) * Box(60, 60, z0 - 10, align=(Align.CENTER, Align.CENTER,
                                                                     Align.MIN))
        pernas = p if pernas is None else pernas + p
    m.add(f"{tag}-SUP", pernas, COR["aco"])
    m.equipamentos[tag]["pote"] = {"z_vertedor": z_vertedor, "z_dip": z_dip, "z_fundo": z0,
                                   "Di": Di, "de_dip": de_dip, "di_dip": di_dip}
    m.item("Pote de selagem (fecho hídrico) com tubo mergulhado e vertedor DN150",
           f"{tag}: Ø{Di:.0f} × {H:.0f} mm, selo {selo:.0f} mm, apoio metálico até o piso", "un", 1)
    return tq
