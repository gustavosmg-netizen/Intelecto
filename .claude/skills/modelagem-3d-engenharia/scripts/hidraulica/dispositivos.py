"""Dispositivos internos de tanques atmosféricos e acessórios de controle de nível (mm).

Todos mantêm o tanque à pressão atmosférica: entrada com separação de ar ou tubo
mergulhado com quebra-vácuo, saída por transbordamento (caixa de nível com vertedor) ou
por perna de nível com respiro, quebra-vórtice nas saídas de fundo, chicanas e misturador.
Coordenadas locais documentadas em cada função; `posicionar` vem de `geometria`.
"""
from __future__ import annotations

import math

from build123d import Align, Box, Cylinder, Pos, Rot, Vector

from . import geometria as g

C3 = (Align.CENTER,) * 3


def defletor(de: float, ponta: Vector, normal: Vector) -> object:
    """Chapa defletora diante da boca de entrada (quebra o jato, evita curto-circuito).

    `ponta` = boca interna do tubo de entrada; `normal` aponta para fora do tanque.
    """
    dentro = -normal
    centro = ponta + dentro * (1.5 * de) + Vector(0, 0, -0.5 * de)
    chapa = Box(2.5 * de, 10, 3.0 * de, align=C3)        # local: x largura, y espessura
    giro = math.degrees(math.atan2(dentro.Y, dentro.X)) - 90
    chapa = Pos(*centro) * Rot(0, 0, giro) * chapa
    # duas mãos-francesas prendendo a chapa à parede acima da boca
    braco = g.posicionar(Cylinder(12, 1.5 * de, align=g.BASE), ponta + Vector(0, 0, de), dentro)
    return chapa + braco


def tubo_imersao(de: float, di: float, ponta: Vector, normal: Vector, z_fim: float,
                 furo_quebra_vacuo: bool) -> tuple[object, float]:
    """Entrada mergulhada: trecho horizontal + curva + tubo descendo até z_fim.

    O furo de quebra-vácuo fica no topo da curva (cota do eixo de entrada): se a pressão
    a montante cair, entra ar por ele e o tanque não é sifonado de volta para a adutora.
    Retorna (sólido, cota do furo).
    """
    dentro = -normal
    R = 1.5 * de
    a = ponta + dentro * R                           # início da curva
    A, M, B, _, t = g.geometria_curva(a + dentro * R, dentro, Vector(0, 0, -1), R)
    peca = g.posicionar(g.tubo_reto(de, di, (A - ponta).length), ponta, dentro)
    peca += g.tubo_por_arco(de, di, A, M, B, dentro)
    L = B.Z - z_fim
    if L > 1:
        peca += g.posicionar(g.tubo_reto(de, di, L), B, Vector(0, 0, -1))
    z_furo = ponta.Z
    if furo_quebra_vacuo:
        furo = g.posicionar(Cylinder(max(0.12 * di, 12), de, align=g.BASE),
                            Vector(A.X, A.Y, ponta.Z), Vector(0, 0, 1))
        peca -= furo
    return peca, z_furo


def quebra_vortice(de: float, ponta: Vector, normal: Vector) -> object:
    """Cruzeta de chapas na boca de saída/sucção (corta o vórtice de ar)."""
    dentro = -normal
    L = 1.2 * de
    centro = ponta + dentro * (L / 2)
    giro = math.degrees(math.atan2(dentro.Y, dentro.X))
    a = Box(L, 2 * de, 8, align=C3)
    b = Box(L, 8, 2 * de, align=C3)
    return Pos(*centro) * Rot(0, 0, giro) * (a + b)


def caixa_nivel(face: Vector, normal: Vector, crista: float, fundo: float, largura: float,
                profundidade: float, topo: float, esp: float = 150) -> object:
    """Caixa de nível colada à parede, em volta da boca de saída.

    `face` = ponto da face interna da parede no eixo do bocal. O lado voltado para o
    tanque é o vertedor de soleira livre (crista em `crista`, largura útil `largura`); as
    laterais sobem até `topo` e entram 200 mm na parede (vale para parede curva). Aberta em
    cima: o tanque transborda para ela à pressão atmosférica.
    """
    dentro = -normal
    giro = math.degrees(math.atan2(dentro.Y, dentro.X))
    # local: x = para dentro do tanque (x=0 na face da parede), y = ao longo da parede
    x0, x1 = -200.0, profundidade + esp
    fundo_cx = Pos((x0 + x1) / 2, 0, fundo - esp / 2) * Box(x1 - x0, largura + 2 * esp, esp,
                                                          align=C3)
    frente = Pos(profundidade + esp / 2, 0, (fundo + crista) / 2) * Box(
        esp, largura + 2 * esp, crista - fundo, align=C3)
    caixa = fundo_cx + frente
    for sinal in (-1, 1):
        caixa += Pos((x0 + x1) / 2, sinal * (largura / 2 + esp / 2), (fundo + topo) / 2) * Box(
            x1 - x0, esp, topo - fundo, align=C3)
    return Pos(face.X, face.Y, 0) * Rot(0, 0, giro) * caixa


def chicanas(cx: float, cy: float, R: float, z0: float, z1: float, n: int = 4,
             esp: float = 150) -> object:
    """Chicanas verticais de largura D/12 junto à parede (evitam vórtice central)."""
    w = 2 * R / 12
    res = None
    for k in range(n):
        a = 2 * math.pi * k / n + math.pi / n
        c = Vector(cx, cy, 0) + Vector(math.cos(a), math.sin(a), 0) * (R - w / 2)
        p = Pos(c.X, c.Y, (z0 + z1) / 2) * Rot(0, 0, math.degrees(a)) * Box(w + 100, esp,
                                                                         z1 - z0, align=C3)
        res = p if res is None else res + p
    return res


def misturador(cx: float, cy: float, z_borda: float, vao: float, z_rotor: float,
               d_rotor: float, potencia_kw: float = 5.5) -> object:
    """Misturador vertical: ponte metálica sobre a borda, motorredutor, eixo e rotor de
    4 pás inclinadas a 45° (fluxo axial). Retorna (parte fixa, eixo + rotor)."""
    ponte = Pos(cx, cy, z_borda + 150) * Box(vao, 400, 300, align=C3)
    ponte -= Pos(cx, cy, z_borda + 150) * Box(vao + 2, 300, 200, align=C3)    # perfil caixão
    r_m = 140 + 20 * math.sqrt(potencia_kw)
    redutor = Pos(cx, cy, z_borda + 300) * Box(2.4 * r_m, 2.4 * r_m, 350, align=g.BASE)
    motor = Pos(cx, cy, z_borda + 650) * Cylinder(r_m, 3.2 * r_m, align=g.BASE)
    eixo = Pos(cx, cy, z_rotor) * Cylinder(35, z_borda + 300 - z_rotor, align=g.BASE)
    cubo = Pos(cx, cy, z_rotor) * Cylinder(80, 160, align=C3)
    rotor = cubo
    for k in range(4):
        pa = Pos(d_rotor / 4 + 40, 0, 0) * Rot(45, 0, 0) * Box(d_rotor / 2 - 80, d_rotor / 8, 14,
                                                               align=C3)
        rotor += Pos(cx, cy, z_rotor) * Rot(0, 0, 90 * k) * pa
    return ponte + redutor + motor, eixo + rotor          # (fixo, rotativo)


def respiro_topo(de: float, di: float, topo: Vector) -> object:
    """Pescoço de ganso (curva de 180° voltada para baixo) com tela no topo do respiro."""
    R = 1.0 * de
    A = topo
    centro = topo + Vector(R, 0, 0)
    M = centro + Vector(0, 0, R)
    B = topo + Vector(2 * R, 0, 0)
    peca = g.tubo_por_arco(de, di, A, M, B, Vector(0, 0, 1))
    peca += g.posicionar(g.tubo_reto(de, di, 0.8 * de), B, Vector(0, 0, -1))
    tela = Pos(B.X, B.Y, B.Z - 0.8 * de - 3) * (Cylinder(de / 2, 3, align=g.BASE)
                                                - Cylinder(de / 2 - 4, 3, align=g.BASE))
    return peca + tela
