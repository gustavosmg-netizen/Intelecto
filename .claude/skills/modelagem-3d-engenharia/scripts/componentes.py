"""Biblioteca mínima de componentes 3D de processo (build123d + bd_warehouse).

Unidades: mm. Eixo Z = vertical. Diâmetros de tubo e flanges vêm das tabelas
ASME B36.10/B16.5 do bd_warehouse; o DN brasileiro é convertido por DN_PARA_NPS.
Cada função devolve um Part já posicionado; a montagem é feita em montar().
"""
from __future__ import annotations

from build123d import (Axis, Box, Compound, Cone, Cylinder, Location, Part,
                       Polyline, Sphere, Torus, export_gltf, export_step)
import bd_warehouse.pipe as _bdpipe
from bd_warehouse.flange import WeldNeckFlange
from bd_warehouse.pipe import Pipe

# bd_warehouse 0.4.0 passa 'steel'/'iron'/'pvc' ao bd_materials, que não conhece
# esses nomes; o alias mantém as tabelas dimensionais ASME funcionando.
_ALIAS_MATERIAL = {"steel": "mild_steel", "iron": "mild_steel", "pvc": "abs"}
_resolver_original = _bdpipe.resolve_material
_bdpipe.resolve_material = lambda m: _resolver_original(_ALIAS_MATERIAL.get(m, m))

DN_PARA_NPS = {15: "1/2", 20: "3/4", 25: "1", 32: "1 1/4", 40: "1 1/2", 50: "2",
               65: "2 1/2", 80: "3", 100: "4", 125: "5", 150: "6", 200: "8",
               250: "10", 300: "12", 350: "14", 400: "16", 450: "18", 500: "20",
               600: "24"}

# Cores RGBA por serviço (referência NBR 6493; ajustar ao padrão do cliente)
CORES = {"agua": (0.0, 0.5, 0.0, 1), "esgoto": (0.3, 0.3, 0.3, 1),
         "lodo": (0.4, 0.25, 0.1, 1), "ar": (0.2, 0.5, 0.9, 1),
         "quimico": (1.0, 0.6, 0.0, 1), "concreto": (0.75, 0.75, 0.72, 1),
         "aco": (0.6, 0.62, 0.65, 1), "valvula": (0.8, 0.1, 0.1, 1)}


def _cor(p: Part, servico: str) -> Part:
    p.color = CORES.get(servico, CORES["aco"])
    return p


def tubo_od(dn: int, material: str = "steel", sch: str = "40") -> float:
    """Diâmetro externo real (mm) do DN, conforme tabela ASME."""
    return Pipe(nps=DN_PARA_NPS[dn], material=material, identifier=sch,
                path=Polyline((0, 0, 0), (0, 0, 10))).od


def linha(pontos, dn: int, servico: str = "agua", material: str = "steel",
          sch: str = "40", raio_curva: float | None = None) -> Part:
    """Tubulação por pontos (x, y, z); curvas de raio longo (1,5·D) nos vértices."""
    nps = DN_PARA_NPS[dn]
    od = tubo_od(dn, material, sch)
    caminho = Polyline(*pontos)
    if len(pontos) > 2:
        caminho = caminho.fillet_2d(raio_curva or 1.5 * od, caminho.vertices()[1:-1]) \
            if _coplanar(pontos) else caminho
    return _cor(Pipe(nps=nps, material=material, identifier=sch, path=caminho), servico)


def _coplanar(pontos) -> bool:
    return len(pontos) == 3 or all(p[2] == pontos[0][2] for p in pontos)


def flange(dn: int, classe: int = 150, local: Location = Location()) -> Part:
    """Flange de pescoço (WN) ASME B16.5 face com ressalto."""
    nps = DN_PARA_NPS[dn]
    return _cor(local * WeldNeckFlange(nps=nps, flange_class=classe), "aco")


def tanque_vertical(diametro: float, altura: float, espessura: float = 8,
                    fundo_conico: float = 0.0, servico: str = "aco") -> Part:
    """Tanque cilíndrico vertical, fundo em Z=0 (o cone, se houver, fica abaixo)."""
    casco = Cylinder(diametro / 2, altura).translate((0, 0, altura / 2))
    casco -= Cylinder(diametro / 2 - espessura, altura).translate(
        (0, 0, altura / 2 + espessura))
    if fundo_conico > 0:
        cone = Cone(50, diametro / 2, fundo_conico).translate((0, 0, -fundo_conico / 2))
        casco = casco + cone
    return _cor(casco, servico)


def bocal(dn: int, centro, direcao: str, comprimento: float = 200,
          classe: int = 150) -> tuple[Part, tuple]:
    """Bocal = trecho de tubo + flange WN; direcao em {'+x','-x','+y','-y','+z','-z'}.

    Devolve (peça, ponto da face do flange) para a linha seguinte partir dali.
    """
    vet = {"+x": (1, 0, 0), "-x": (-1, 0, 0), "+y": (0, 1, 0), "-y": (0, -1, 0),
           "+z": (0, 0, 1), "-z": (0, 0, -1)}[direcao]
    fim = tuple(c + v * comprimento for c, v in zip(centro, vet))
    tubo = linha([centro, fim], dn, "aco")
    rot = {"+x": (0, 90, 0), "-x": (0, -90, 0), "+y": (-90, 0, 0),
           "-y": (90, 0, 0), "+z": (0, 0, 0), "-z": (180, 0, 0)}[direcao]
    fl = flange(dn, classe, Location(fim, rot))
    altura = flange(dn, classe).bounding_box().size.Z  # do pescoço à face
    face = tuple(f + v * altura for f, v in zip(fim, vet))
    return tubo + fl, face


def valvula_gaveta(dn: int, centro, eixo: str = "x", servico: str = "valvula") -> Part:
    """Válvula gaveta flangeada simplificada: corpo, castelo, haste e volante."""
    od = tubo_od(dn)
    face = 1.6 * od + 100  # comprimento face a face aproximado (ASME B16.10)
    corpo = Cylinder(od * 0.75, face, rotation=(0, 90, 0))
    corpo += Sphere(od * 0.85)
    castelo = Cylinder(od * 0.35, od * 1.6).translate((0, 0, od * 0.8 + od * 0.8))
    haste = Cylinder(od * 0.06, od * 1.2).translate((0, 0, od * 2.6 + od * 0.6))
    volante = Torus(od * 0.6, od * 0.05).translate((0, 0, od * 3.4))
    v = corpo + castelo + haste + volante
    if eixo == "y":
        v = v.rotate(Axis.Z, 90)
    return _cor(v.translate(centro), servico)


def misturador_vertical(centro_topo, altura_eixo: float, d_rotor: float,
                        potencia_kw: float = 5.5) -> Part:
    """Agitador de topo: motorredutor, eixo e rotor de 4 pás inclinadas."""
    x, y, z = centro_topo
    motor = Cylinder(120 + 15 * potencia_kw ** 0.5, 450).translate((0, 0, 225 + 200))
    redutor = Box(320, 320, 200).translate((0, 0, 100))
    eixo = Cylinder(30, altura_eixo).translate((0, 0, -altura_eixo / 2))
    cubo = Cylinder(60, 120).translate((0, 0, -altura_eixo))
    pa = Box(d_rotor / 2, d_rotor / 10, 12).translate((d_rotor / 4, 0, 0)).rotate(Axis.X, 45)
    rotor = cubo
    for ang in (0, 90, 180, 270):
        rotor += pa.rotate(Axis.Z, ang).translate((0, 0, -altura_eixo))
    m = _cor(motor + redutor, "aco") + eixo + rotor
    return _cor(m.translate((x, y, z)), "aco")


def exportar(partes: dict[str, Part], base: str) -> None:
    """Exporta STEP (engenharia) e glTF (visualização/render) da montagem."""
    for nome, p in partes.items():
        p.label = nome
    montagem = Compound(children=list(partes.values()))
    export_step(montagem, f"{base}.step")
    # glTF sai em Y-up (convenção do formato); deflexão de 0,5 mm basta para render
    export_gltf(montagem, f"{base}.glb", binary=True, linear_deflection=0.5,
                angular_deflection=0.2)
