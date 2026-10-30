"""Equipamentos do sistema de biogás (envelopes representativos com bocais reais).

- gasometro_membrana: bolsa de membrana simples de baixa pressão (≈ −1 a +5 mbar), deitada
  sobre laje, dentro de abrigo; entrada e saída SEPARADAS (linhas exclusivas), selo d'água
  de alívio próprio, medição de volume (cabo/laser) e dreno de condensado.
- gasometro_dupla_membrana: domo de dupla membrana (membrana externa sustentada por
  ventilador de ar), pressão de operação de dezenas de mbar, válvula de alívio própria.
- soprador_skid: dois sopradores (operação + reserva) em base comum, sucção e descarga.
- flare: queimador (vela/enclausurado) com skid de reforço e corta-chamas.
- pote_condensado: pote com selo para o dreno, no ponto baixo das linhas.
- analisador: armário do analisador CH₄/O₂/H₂S (tomada de amostra).
Volumes, pressões e dimensões são de catálogo típico: a especificação final é do fornecedor.
"""
from __future__ import annotations

import math

from build123d import Align, Box, Cone, Cylinder, Pos, Sphere, Vector, scale

from . import geometria as g
from . import normas

COR = {"membrana": (0.20, 0.45, 0.30, 1), "membrana2": (0.88, 0.86, 0.80, 1),
       "laje": (0.62, 0.61, 0.58, 1), "aco": (0.85, 0.65, 0.10, 1),
       "maquina": (0.10, 0.30, 0.60, 1), "flare": (0.55, 0.57, 0.60, 1),
       "chama": (0.95, 0.35, 0.05, 1), "selo": (0.65, 0.10, 0.10, 1),
       "instr": (0.15, 0.55, 0.85, 1)}
C3 = (Align.CENTER, Align.CENTER, Align.CENTER)


def _porta(m, eq: str, nome: str, P: Vector, D: Vector, dn: int, papel: str, cor,
           comprimento: float = 250.0):
    """Bocal flangeado (Classe 150) saindo do equipamento na direção D, face em P."""
    from .montagem import Porta
    fl = normas.flange(dn, normas.CLASSE_ANSI)
    de = normas.tubo("pead", {25: 32, 50: 63, 80: 90, 100: 110, 150: 160, 200: 200}[dn]).de
    base = P - D * comprimento
    m.add(eq, g.posicionar(g.tubo_reto(de, de * 0.8, comprimento - fl.t), base, D), cor)
    m.add(eq, g.posicionar(g.flange_peca(fl, de * 0.8), P - D * fl.t, D), (0.58, 0.60, 0.63, 1))
    m.portas[f"{eq}.{nome}"] = Porta(f"{eq}.{nome}", P, D, dn, normas.CLASSE_ANSI, "flange",
                                     papel, eq)


def gasometro_membrana(m, tag: str, centro, V_util: float, dn: int = 100):
    """Bolsa deitada (elipsoide) Vútil ≈ V_util m³ sobre laje, com abrigo de estrutura leve.
    Bocais: E (entrada, face sul), S (saída, face norte) — linhas exclusivas."""
    cx, cy = centro
    # elipsoide a × b × c com 4/3·π·a·b·c = V e proporção 2 : 1 : 0,6
    k = (V_util * 1e9 / (4 / 3 * math.pi * 2 * 1 * 0.6)) ** (1 / 3)
    a, b, c = 2 * k, 1 * k, 0.6 * k
    bolsa = Pos(cx, cy, 250 + c) * scale(Sphere(1.0), (a, b, c))
    m.add(tag, bolsa, COR["membrana"])
    laje = Pos(cx, cy, 0) * Box(2 * a + 1200, 2 * b + 2400, 250, align=g.BASE)
    m.add(f"BASE-{tag}", laje, COR["laje"])
    # abrigo: pórticos leves (pilares e banzos) — sem cobertura desenhada
    H = 250 + 2 * c + 700
    ab = None
    for sx in (-1, 1):
        for i in range(4):
            x = cx - a - 300 + i * (2 * a + 600) / 3
            p = Pos(x, cy + sx * (b + 900), 250) * Box(120, 120, H - 250, align=g.BASE)
            ab = p if ab is None else ab + p
    for i in range(4):
        x = cx - a - 300 + i * (2 * a + 600) / 3
        ab += Pos(x, cy, H) * Box(120, 2 * b + 1920, 160, align=C3)
    m.add(f"ABRIGO-{tag}", ab, COR["aco"])
    z = 250 + 450
    _porta(m, tag, "E", Vector(cx - a * 0.55, cy - b - 1100, z), Vector(0, -1, 0), dn, "entrada",
           COR["membrana"], comprimento=1100 + 0.2 * b)
    _porta(m, tag, "S", Vector(cx + a * 0.55, cy + b + 1100, z), Vector(0, 1, 0), dn, "saida",
           COR["membrana"], comprimento=1100 + 0.2 * b)
    # selo d'água de alívio próprio (o mais baixo do sistema) e medição de volume
    sx, sy = cx + a + 250, cy - b - 300
    m.add(f"SH-{tag}", Pos(sx, sy, 250) * Cylinder(300, 1500, align=g.BASE), COR["selo"])
    m.add(f"SH-{tag}", Pos(sx, sy, 1750) * Cylinder(60, 1800, align=g.BASE), COR["selo"])
    m.add(f"LT-{tag}", Pos(cx, cy, H + 80) * Box(300, 200, 200, align=C3), COR["instr"])
    m.add(f"LT-{tag}", Pos(cx, cy, 250 + 2 * c) * Cylinder(6, H - 250 - 2 * c, align=g.BASE),
          COR["instr"])
    m.equipamentos[tag] = {"tipo": "gasometro", "solido": bolsa, "centro": (cx, cy),
                           "dim": (2 * a, 2 * b), "V": V_util}
    m.item("Gasômetro de membrana simples de baixa pressão (bolsa em abrigo)",
           f"{tag}: Vútil ≈ {V_util:.0f} m³; −1 a +5 mbar; entrada e saída DN{dn} separadas; "
           "selo d'água de alívio, medição de volume, dreno", "un", 1)


def gasometro_dupla_membrana(m, tag: str, centro, D: float, dn: int = 100):
    """Domo de dupla membrana (¾ de esfera) sobre anel de concreto; ventilador de ar de
    suporte, válvula de alívio/vácuo própria e medição de volume. Bocais E e S na base."""
    cx, cy = centro
    R = D / 2
    anel = Pos(cx, cy, 0) * (Cylinder(R + 300, 600, align=g.BASE) - Cylinder(R - 200, 600,
                                                                            align=g.BASE))
    m.add(f"BASE-{tag}", anel, COR["laje"])
    domo = Pos(cx, cy, 600) * (Sphere(R) & Pos(0, 0, -0.25 * R) * Box(2.2 * R, 2.2 * R, 2.5 * R,
                                                                        align=g.BASE))
    m.add(tag, domo, COR["membrana2"])
    m.add(f"VA-{tag}", Pos(cx + R + 900, cy, 0) * Box(900, 600, 700, align=g.BASE), COR["maquina"])
    m.add(f"PSV-{tag}", Pos(cx - R - 700, cy, 0) * Cylinder(280, 1300, align=g.BASE), COR["selo"])
    m.add(f"LT-{tag}", Pos(cx, cy, 600 + R + 60) * Box(260, 260, 120, align=C3), COR["instr"])
    _porta(m, tag, "E", Vector(cx, cy - R - 1100, 350), Vector(0, -1, 0), dn, "entrada",
           COR["laje"], comprimento=1400)
    _porta(m, tag, "S", Vector(cx, cy + R + 1100, 350), Vector(0, 1, 0), dn, "saida",
           COR["laje"], comprimento=1400)
    V = 2 / 3 * math.pi * R ** 3 * 1.35 / 1e9
    m.equipamentos[tag] = {"tipo": "gasometro", "solido": domo, "centro": (cx, cy),
                           "dim": (D, D), "V": V}
    m.item("Gasômetro de dupla membrana (ventilador de suporte, alívio, medição de volume)",
           f"{tag}: Ø{D / 1000:.1f} m, ≈ {V:.0f} m³; pressão de operação conforme consumidores "
           "(típico 15–30 mbar)", "un", 1)


def soprador_skid(m, tag: str, centro, dn: int = 100):
    """Skid com dois sopradores (A operação, B reserva), sucção a oeste e descarga a leste,
    retenção e manômetros na descarga. Envelope 2,6 × 1,8 × 1,3 m."""
    cx, cy = centro
    skid = Pos(cx, cy, 0) * Box(2600, 1800, 150, align=g.BASE)
    for dy in (-450, 450):
        skid += Pos(cx, cy + dy, 150) * Box(1400, 600, 650, align=g.BASE)
        skid += g.posicionar(Cylinder(230, 500, align=g.BASE), (cx - 1200, cy + dy, 500),
                             (1, 0, 0))
    m.add(tag, skid, COR["maquina"])
    _porta(m, tag, "S", Vector(cx - 1300 - 300, cy, 600), Vector(-1, 0, 0), dn, "succao",
           COR["maquina"], comprimento=300)
    _porta(m, tag, "D", Vector(cx + 1300 + 300, cy, 600), Vector(1, 0, 0), dn, "recalque",
           COR["maquina"], comprimento=300)
    m.equipamentos[tag] = {"tipo": "soprador", "solido": skid, "centro": (cx, cy)}


def flare(m, tag: str, centro, H: float = 7000, dn: int = 100):
    """Flare enclausurado/vela com skid (soprador de reforço, válvula de bloqueio dupla,
    corta-chamas de detonação e ignição piloto). Entrada a oeste."""
    cx, cy = centro
    base = Pos(cx, cy, 0) * Box(2200, 1800, 200, align=g.BASE)
    skid = Pos(cx - 400, cy, 200) * Box(1100, 1200, 900, align=g.BASE)
    pilha = Pos(cx + 500, cy, 200) * Cylinder(450, H - 600, align=g.BASE)
    pilha += Pos(cx + 500, cy, H - 400) * Cone(450, 380, 400, align=g.BASE)
    m.add(tag, base + skid, COR["maquina"])
    m.add(f"PILHA-{tag}", pilha, COR["flare"])
    m.add(f"CHAMA-{tag}", Pos(cx + 500, cy, H) * Cone(250, 0, 900, align=g.BASE), COR["chama"])
    _porta(m, tag, "E", Vector(cx - 1100 - 400, cy, 700), Vector(-1, 0, 0), dn, "entrada",
           COR["maquina"], comprimento=550)
    m.equipamentos[tag] = {"tipo": "flare", "solido": pilha, "centro": (cx, cy)}
    m.item("Flare (queimador) com skid: soprador de reforço, bloqueio duplo, corta-chamas de "
           "detonação, ignição piloto e detector de chama", f"{tag}: ≥ pico da planta com folga",
           "cj", 1)


def pote_condensado(m, tag: str, centro, z_entrada: float, dn: int = 100, az_saida: float = 0.0):
    """Pote de condensado no ponto baixo: gás entra por cima, sai pelo lado; dreno com selo
    hidráulico (sifão ≥ 2× a pressão máxima da linha) e visor."""
    cx, cy = centro
    H = z_entrada - 150
    pote = Pos(cx, cy, 150) * Cylinder(200, H - 150, align=g.BASE)
    pote += Pos(cx, cy, 0) * Box(600, 600, 150, align=g.BASE)
    pote += g.posicionar(Cylinder(25, 450, align=g.BASE), (cx, cy, 300), (1, 0, 0))   # dreno
    pote += Pos(cx + 450, cy, 0) * Cylinder(80, 600, align=g.BASE)                   # selo
    m.add(tag, pote, COR["selo"])
    _porta(m, tag, "E", Vector(cx, cy, z_entrada), Vector(0, 0, 1), dn, "entrada", COR["selo"],
           comprimento=200)
    d = Vector(math.sin(math.radians(az_saida)), math.cos(math.radians(az_saida)), 0)
    _porta(m, tag, "S", Vector(cx, cy, H - 250) + d * 450, d, dn, "saida", COR["selo"],
           comprimento=250)
    m.equipamentos[tag] = {"tipo": "pote", "solido": pote, "centro": (cx, cy)}
    m.item("Pote de condensado com dreno em selo hidráulico e visor", tag, "un", 1)


def analisador(m, tag: str, pos):
    x, y = pos
    m.add(tag, Pos(x, y, 0) * Box(700, 450, 1900, align=g.BASE), COR["instr"])
    m.item("Analisador de biogás CH₄/CO₂/O₂/H₂S (amostragem contínua)", tag, "un", 1)
