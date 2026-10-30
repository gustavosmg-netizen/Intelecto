"""Sólidos de tubos, conexões, válvulas, bombas, sifão e suportes (build123d, mm).

Convenção local de cada peça em linha: eixo do escoamento = +Z (de z=0 a z=L), "cima"
(haste da válvula, topo da redução excêntrica) = +Y. `posicionar()` leva a peça ao mundo.
"""
from __future__ import annotations

import math

from build123d import (Align, Box, Circle, Cone, Cylinder, Location, Part, Plane, Pos,
                       Rot, Sphere, ThreePointArc, Torus, Vector, loft, sweep)

from . import normas

BASE = (Align.CENTER, Align.CENTER, Align.MIN)


def V(p) -> Vector:
    return p if isinstance(p, Vector) else Vector(*p)


def plano(origem, eixo, cima=(0, 0, 1)) -> Plane:
    """Plano com z = eixo do escoamento e y o mais próximo possível de `cima`."""
    z = V(eixo).normalized()
    c = V(cima)
    if abs(z.dot(c.normalized())) > 0.999:      # trecho vertical: haste aponta para +X
        c = Vector(1, 0, 0) if abs(z.X) < 0.9 else Vector(0, 1, 0)
    y = (c - z * c.dot(z)).normalized()
    return Plane(origin=V(origem), x_dir=y.cross(z), z_dir=z)


def posicionar(peca: Part, origem, eixo, cima=(0, 0, 1)) -> Part:
    return Location(plano(origem, eixo, cima)) * peca


# --- Tubos e conexões -----------------------------------------------------------------

def tubo_reto(de: float, di: float, L: float) -> Part:
    return Cylinder(de / 2, L, align=BASE) - Cylinder(di / 2, L, align=BASE)


def tubo_por_arco(de: float, di: float, A, M, B, eixo_A) -> Part:
    """Curva: anel varrido pelo arco A-M-B (A tangente a eixo_A)."""
    arco = ThreePointArc(V(A), V(M), V(B))
    secao = plano(A, eixo_A) * (Circle(de / 2) - Circle(di / 2))
    return sweep(secao, path=arco)


def geometria_curva(V0, d_in, d_out, R):
    """Pontos de tangência e ponto médio do arco que concorda d_in com d_out no vértice V0."""
    d_in, d_out = V(d_in).normalized(), V(d_out).normalized()
    ang = math.acos(max(-1.0, min(1.0, d_in.dot(d_out))))
    t = R * math.tan(ang / 2)
    A, B = V(V0) - d_in * t, V(V0) + d_out * t
    n = (d_out - d_in * d_out.dot(d_in)).normalized()
    C = A + n * R
    M = C + ((A + B) * 0.5 - C).normalized() * R
    return A, M, B, math.degrees(ang), t


def bolsa(de: float, L: float | None = None) -> Part:
    """Ponta-bolsa de PVC (junta elástica): luva externa com chanfro, local em z=0..L."""
    L = L or max(1.1 * de, 80)
    ext, folga = de / 2 + max(0.08 * de, 4), de / 2 + 0.6
    corpo = Cylinder(ext, L, align=BASE) + Cone(de / 2, ext, 0.25 * L, align=BASE).translate(
        (0, 0, -0.25 * L))
    return corpo - Cylinder(folga, L * 1.3, align=BASE).translate((0, 0, -0.3 * L))


def cordao_solda(de: float) -> Part:
    """Cordão de solda de topo do PEAD (anel externo pequeno)."""
    return Torus(de / 2, max(de * 0.012, 1.5))


def te(de: float, di: float, L: float, de_r: float, di_r: float, h_r: float) -> Part:
    """Tê: corrida em z=0..L, ramal para +Y saindo do centro com altura h_r a partir do eixo."""
    ramal = Cylinder(de_r / 2, h_r, align=BASE)
    ramal = posicionar(ramal, (0, 0, L / 2), (0, 1, 0), (0, 0, 1))
    furo = posicionar(Cylinder(di_r / 2, h_r + 1, align=BASE), (0, 0, L / 2), (0, 1, 0),
                      (0, 0, 1))
    return (Cylinder(de / 2, L, align=BASE) + ramal) - Cylinder(di / 2, L, align=BASE) - furo


def reducao(de1, di1, de2, di2, L, excentrica=False, topo_reto=True) -> Part:
    """Redução de de1 (z=0) para de2 (z=L). Excêntrica: geratriz superior (+Y) reta."""
    dy = 0.0
    if excentrica:
        dy = ((de1 - de2) / 2) * (1 if topo_reto else -1)
    ext = loft([Plane.XY * Circle(de1 / 2), Plane.XY.offset(L) * Pos(0, dy) * Circle(de2 / 2)])
    inn = loft([Plane.XY.offset(-0.01) * Circle(di1 / 2),
                Plane.XY.offset(L + 0.01) * Pos(0, dy * di2 / de2) * Circle(di2 / 2)])
    return ext - inn


def flange_peca(fl: normas.Flange, furo_central: float, cego=False) -> Part:
    """Flange em z=0..t, face de vedação em z=t, com furação real."""
    p = Cylinder(fl.D / 2, fl.t, align=BASE)
    if not cego:
        p -= Cylinder(furo_central / 2, fl.t, align=BASE)
    for i in range(fl.n):
        a = 2 * math.pi * (i + 0.5) / fl.n
        p -= Pos(fl.k / 2 * math.cos(a), fl.k / 2 * math.sin(a)) * Cylinder(
            fl.furo / 2, fl.t, align=BASE)
    return p


def parafusos(fl: normas.Flange, L_aperto: float) -> Part:
    """Parafusos + porcas de uma junta flangeada; aperto de z=0 a z=L_aperto."""
    d = fl.d_parafuso
    resultado = None
    for i in range(fl.n):
        a = 2 * math.pi * (i + 0.5) / fl.n
        x, y = fl.k / 2 * math.cos(a), fl.k / 2 * math.sin(a)
        haste = Pos(x, y, -0.8 * d) * Cylinder(d / 2, L_aperto + 1.6 * d + 0.4 * d, align=BASE)
        cabeca = Pos(x, y, -0.8 * d) * Cylinder(0.85 * d, 0.65 * d, align=BASE)
        porca = Pos(x, y, L_aperto) * Cylinder(0.85 * d, 0.8 * d, align=BASE)
        s = haste + cabeca + porca
        resultado = s if resultado is None else resultado + s
    return resultado


def colarinho_pead(de: float, fl: normas.Flange) -> Part:
    """Colarinho (stub end) de PEAD: ressalto que encosta na junta, z=0..t_c."""
    t_c = max(0.12 * de, 12)
    return Cylinder(min(fl.k / 2 - fl.furo, de / 2 + 0.18 * de), t_c, align=BASE) - Cylinder(
        de / 2 - de / 17, t_c, align=BASE)


# --- Válvulas e registros (flangeadas, comprimento = face a face) ---------------------

def _flanges_extremos(fl, L, furo):
    return flange_peca(fl, furo) + Pos(0, 0, L - fl.t) * flange_peca(fl, furo)


def valvula_gaveta(fl: normas.Flange, L: float, di: float) -> Part:
    """Gaveta de cunha: corpo oval, castelo, haste ascendente e volante (cima = +Y)."""
    r = fl.D / 2
    corpo = Pos(0, 0, L / 2) * Cylinder(0.62 * r, L - 2 * fl.t, align=(Align.CENTER,) * 3)
    corpo += Pos(0, 0, L / 2) * (Sphere(0.8 * r) & Box(1.6 * r, 3 * r, L * 0.8))
    castelo = posicionar(Cylinder(0.42 * r, 1.6 * r, align=BASE), (0, 0.5 * r, L / 2), (0, 1, 0))
    castelo += posicionar(Cylinder(0.55 * r, 0.12 * r, align=BASE), (0, 2.0 * r, L / 2),
                          (0, 1, 0))
    haste = posicionar(Cylinder(0.05 * r, 1.2 * r, align=BASE), (0, 2.1 * r, L / 2), (0, 1, 0))
    # volante: aro + cruzeta (dois braços retos), no plano perpendicular à haste
    volante = posicionar(Torus(0.7 * r, 0.06 * r), (0, 3.1 * r, L / 2), (0, 1, 0))
    volante += Pos(0, 3.1 * r, L / 2) * (Box(1.42 * r, 0.05 * r, 0.07 * r)
                                         + Box(0.07 * r, 0.05 * r, 1.42 * r))
    v = corpo + _flanges_extremos(fl, L, di) + castelo + haste + volante
    return v - Cylinder(di / 2, L, align=BASE)


def valvula_borboleta(fl: normas.Flange, L: float, di: float) -> Part:
    """Borboleta wafer entre flanges, com redutor e volante lateral (cima = +Y)."""
    r = fl.D / 2
    corpo = Cylinder(fl.k / 2 - fl.furo, L, align=BASE) - Cylinder(di / 2, L, align=BASE)
    disco = Pos(0, 0, L / 2) * Rot(0, 60, 0) * Cylinder(di / 2 * 0.98, 0.08 * di,
                                                         align=(Align.CENTER,) * 3)
    pescoco = posicionar(Cylinder(0.12 * r, 0.9 * r, align=BASE), (0, fl.k / 2 - fl.furo, L / 2),
                         (0, 1, 0))
    redutor = Pos(0, r + 0.45 * r, L / 2) * Box(0.7 * r, 0.5 * r, 0.7 * r)
    volante = posicionar(Torus(0.45 * r, 0.05 * r), (0.55 * r, r + 0.45 * r, L / 2), (1, 0, 0))
    return corpo + disco + pescoco + redutor + volante


def valvula_retencao(fl: normas.Flange, L: float, di: float) -> Part:
    """Retenção de portinhola: corpo com tampa superior inclinada e seta de fluxo (+Z)."""
    r = fl.D / 2
    corpo = Pos(0, 0, L / 2) * Cylinder(0.66 * r, L - 2 * fl.t, align=(Align.CENTER,) * 3)
    tampa = Pos(0, 0.55 * r, L * 0.45) * Rot(15, 0, 0) * Box(0.9 * r, 0.35 * r, 0.55 * L)
    seta = Pos(0.68 * r, 0, L * 0.35) * Cone(0.12 * r, 0, 0.3 * L, align=BASE)
    seta += Pos(0.68 * r, 0, L * 0.15) * Cylinder(0.04 * r, 0.2 * L, align=BASE)
    v = corpo + tampa + seta + _flanges_extremos(fl, L, di)
    return v - Cylinder(di / 2, L, align=BASE)


def valvula_esfera(fl: normas.Flange, L: float, di: float) -> Part:
    r = fl.D / 2
    corpo = Pos(0, 0, L / 2) * Sphere(0.75 * r)
    corpo += Pos(0, 0, L / 2) * Cylinder(0.55 * r, L - 2 * fl.t, align=(Align.CENTER,) * 3)
    alavanca = Pos(0, 0.95 * r, L / 2) * Box(0.12 * r, 0.12 * r, 1.6 * L) + posicionar(
        Cylinder(0.08 * r, 0.3 * r, align=BASE), (0, 0.65 * r, L / 2), (0, 1, 0))
    v = corpo + alavanca + _flanges_extremos(fl, L, di)
    return v - Cylinder(di / 2, L, align=BASE)


def junta_desmontagem(fl: normas.Flange, L: float, de: float, di: float) -> Part:
    """Junta de desmontagem travada: dois flanges, carretel telescópico e tirantes."""
    carretel = Cylinder(de / 2 * 1.08, L, align=BASE) + Pos(0, 0, L * 0.35) * Cylinder(
        de / 2 * 1.25, L * 0.3, align=BASE)
    tirantes = None
    for i in range(min(fl.n, 4)):
        a = 2 * math.pi * (i + 0.5) / min(fl.n, 4)
        t = Pos(fl.k / 2 * math.cos(a), fl.k / 2 * math.sin(a), -15) * Cylinder(
            fl.d_parafuso / 2, L + 30, align=BASE)
        tirantes = t if tirantes is None else tirantes + t
    return (carretel + _flanges_extremos(fl, L, di) + tirantes) - Cylinder(di / 2, L,
                                                                           align=BASE)


def corta_chamas(fl: normas.Flange, L: float, di: float) -> Part:
    """Corta-chamas em linha: carcaça cilíndrica alargada com o elemento de lâminas e
    flanges nos extremos; tomadas de pressão diferencial e termopar na carcaça (cima = +Y)."""
    r = fl.D / 2
    corpo = Pos(0, 0, L / 2) * Cylinder(1.05 * r, L * 0.55, align=(Align.CENTER,) * 3)
    cones = Pos(0, 0, fl.t) * Cone(0.6 * r, 1.05 * r, L * 0.225 - fl.t, align=BASE)
    cones += Pos(0, 0, L * 0.775) * Cone(1.05 * r, 0.6 * r, L * 0.225 - fl.t, align=BASE)
    tomadas = posicionar(Cylinder(0.06 * r, 0.35 * r, align=BASE), (0, 1.0 * r, L * 0.35),
                         (0, 1, 0))
    tomadas += posicionar(Cylinder(0.06 * r, 0.35 * r, align=BASE), (0, 1.0 * r, L * 0.65),
                          (0, 1, 0))
    v = corpo + cones + tomadas + _flanges_extremos(fl, L, di)
    return v - Cylinder(di / 2, L, align=BASE)


def ventosa(fl_ramal: normas.Flange, altura: float) -> Part:
    """Ventosa de duplo efeito sobre flange do ramal (local: base em z=0, para cima +Z)."""
    r = fl_ramal.D / 2
    corpo = Pos(0, 0, fl_ramal.t) * Cylinder(0.75 * r, altura * 0.6, align=BASE)
    tampa = Pos(0, 0, fl_ramal.t + altura * 0.6) * Cone(0.75 * r, 0.3 * r, altura * 0.25,
                                                        align=BASE)
    return flange_peca(fl_ramal, 0, cego=True) + corpo + tampa


# --- Bombas ---------------------------------------------------------------------------

def bomba_centrifuga(dn_s: int, dn_r: int, h_eixo: float):
    """Bomba centrífuga horizontal de sucção axial (monobloco/mancal + motor + base).

    Local: eixo do rotor ao longo de +X; sucção em x=0 olhando para -X; recalque vertical
    no topo da voluta. Retorna (sólido, portas) com portas em coordenadas locais.
    """
    fs, fr = normas.flange(dn_s), normas.flange(dn_r)
    Rv = 1.6 * fr.D / 2 + 40                    # raio da voluta
    xs = 0.0
    xv = fs.t + 0.9 * fs.D                      # centro da voluta
    bocal_s = posicionar(Cylinder(fs.D / 2 * 0.62, xv - Rv * 0.6 - xs, align=BASE),
                         (xs, 0, h_eixo), (1, 0, 0))
    voluta = posicionar(Cylinder(Rv, 0.55 * Rv, align=(Align.CENTER,) * 3), (xv, 0, h_eixo),
                        (1, 0, 0))
    voluta += Pos(xv, Rv * 0.35, h_eixo) * Box(0.55 * Rv, 0.9 * Rv, 0.6 * Rv)
    z_r = h_eixo + Rv + 0.25 * Rv
    bocal_r = Pos(xv, Rv * 0.55, h_eixo) * Cylinder(fr.D / 2 * 0.6, z_r - h_eixo - fr.t,
                                                     align=BASE)
    fl_s = posicionar(flange_peca(fs, 0), (xs + fs.t, 0, h_eixo), (-1, 0, 0))
    fl_r = Pos(xv, Rv * 0.55, z_r - fr.t) * flange_peca(fr, 0)
    mancal = posicionar(Cylinder(0.45 * Rv, 1.1 * Rv, align=BASE), (xv + 0.27 * Rv, 0, h_eixo),
                        (1, 0, 0))
    x_m = xv + 1.6 * Rv
    acopl = posicionar(Cylinder(0.3 * Rv, 0.3 * Rv, align=BASE), (x_m - 0.3 * Rv, 0, h_eixo),
                       (1, 0, 0))
    motor = posicionar(Cylinder(0.85 * Rv, 2.2 * Rv, align=BASE), (x_m, 0, h_eixo), (1, 0, 0))
    aletas = None
    for k in range(8):
        a = math.radians(k * 45)
        al = posicionar(Box(0.08 * Rv, 0.12 * Rv, 2.0 * Rv, align=(Align.CENTER, Align.CENTER,
                                                                    Align.MIN)),
                        (x_m + 0.1 * Rv, 0.85 * Rv * math.cos(a), h_eixo + 0.85 * Rv * math.sin(a)),
                        (1, 0, 0))
        aletas = al if aletas is None else aletas + al
    x_fim = x_m + 2.2 * Rv
    base = Pos((xv - 0.6 * Rv + x_fim) / 2, 0, 0) * Box(x_fim - xv + 0.8 * Rv, 1.9 * Rv,
                                                        0.12 * h_eixo, align=BASE)
    pes = Pos(xv, 0, 0) * Box(0.5 * Rv, 1.2 * Rv, h_eixo - Rv * 0.6, align=BASE)
    pes += Pos(x_m + 1.1 * Rv, 0, 0) * Box(0.6 * Rv, 1.5 * Rv, h_eixo - 0.85 * Rv, align=BASE)
    corpo = bocal_s + voluta + bocal_r + fl_s + fl_r + mancal + acopl + motor + aletas + base + pes
    furo_s = posicionar(Cylinder(normas_di(dn_s) / 2, xv - xs, align=BASE), (xs, 0, h_eixo),
                        (1, 0, 0))
    furo_r = Pos(xv, Rv * 0.55, h_eixo) * Cylinder(normas_di(dn_r) / 2, z_r - h_eixo + 1,
                                                   align=BASE)
    corpo = corpo - furo_s - furo_r
    portas = {"succao": ((xs, 0, h_eixo), (-1, 0, 0), dn_s),
              "recalque": ((xv, Rv * 0.55, z_r), (0, 0, 1), dn_r)}
    return corpo, portas


def bomba_submersivel(dn_r: int, altura_motor: float = 700):
    """Bomba submersível com pé de acoplamento e tubos-guia. Local: base em z=0.

    O recalque sai do pé de acoplamento num flange horizontal virado para cima, afastado do
    motor o bastante para a coluna e as válvulas não encostarem nele; os tubos-guia ladeiam
    a coluna em y.
    """
    fr = normas.flange(dn_r)
    R = 1.4 * fr.D / 2                       # raio da voluta
    r_motor = 0.75 * R
    x_b = -0.2 * R                           # eixo da bomba
    x_r = x_b + r_motor + fr.D / 2 + 80      # eixo da coluna de recalque
    z_r = 0.25 * R + 1.2 * R
    pe = Pos((x_b - R + x_r + fr.D / 2) / 2, 0, 0) * Box(x_r + fr.D / 2 - (x_b - R) + 40,
                                                        2.0 * R, 0.25 * R, align=BASE)
    voluta = Pos(x_b, 0, 0.25 * R) * Cylinder(R, 0.9 * R, align=BASE)
    saida = posicionar(Cylinder(fr.D / 2 * 0.55, x_r - x_b, align=BASE), (x_b, 0, 0.7 * R),
                       (1, 0, 0))
    curva_pe = Pos(x_r, 0, 0.25 * R) * Cylinder(fr.D / 2 * 0.6, 1.2 * R, align=BASE)
    motor = Pos(x_b, 0, 1.15 * R) * Cylinder(r_motor, altura_motor, align=BASE)
    alca = Pos(x_b, 0, 1.15 * R + altura_motor) * Torus(0.35 * R, 0.05 * R)
    fl = Pos(x_r, 0, z_r - fr.t) * flange_peca(fr, 0)
    guias = None
    for y in (-(fr.D / 2 + 45), fr.D / 2 + 45):
        g = Pos(x_r, y, 0.25 * R) * Cylinder(18, altura_motor + 1.4 * R, align=BASE)
        guias = g if guias is None else guias + g
    corpo = pe + voluta + saida + curva_pe + motor + alca + fl + guias
    corpo -= Pos(x_r, 0, 0.25 * R) * Cylinder(normas_di(dn_r) / 2, 1.2 * R + 1, align=BASE)
    return corpo, {"recalque": ((x_r, 0, z_r), (0, 0, 1), dn_r)}


def normas_di(dn: int) -> float:
    """Diâmetro interno de bocal de equipamento (aprox. DN)."""
    return float(dn)


# --- Suportes -------------------------------------------------------------------------

def suporte_apoio(de: float, z_eixo: float, z_piso: float) -> Part:
    """Pilarete de concreto com sela e abraçadeira (local: eixo do tubo em (0,0,z_eixo))."""
    h = z_eixo - de / 2 - z_piso
    larg = max(1.6 * de, 200)
    pilar = Pos(0, 0, z_piso) * Box(larg, 0.8 * larg, max(h - 10, 1), align=BASE)
    sela = Pos(0, 0, z_eixo - de / 2 - 10) * Box(larg * 0.9, 80, 10 + de * 0.3, align=BASE)
    sela -= Pos(0, 0, z_eixo) * Rot(90, 0, 0) * Cylinder(de / 2, 200)
    abr = Pos(0, 0, z_eixo) * Rot(90, 0, 0) * (Cylinder(de / 2 + 6, 50) - Cylinder(de / 2, 50))
    return pilar + sela + abr


def seta_fluxo(de: float) -> Part:
    """Seta de sentido de escoamento sobre o tubo (local: aponta +Z, apoiada em +Y)."""
    s = 0.35 * de + 20
    return Pos(0, de / 2 + s * 0.35, 0) * (Cylinder(s * 0.12, s, align=BASE) + Pos(0, 0, s) * Cone(
        s * 0.3, 0, s * 0.7, align=BASE))
