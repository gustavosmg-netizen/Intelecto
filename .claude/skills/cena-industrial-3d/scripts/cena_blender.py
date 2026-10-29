"""Cena cinematográfica industrial no Blender a partir de um .glb da skill modelagem-3d-engenharia.

Aplica materiais PBR procedurais pela tag do objeto, cria piso, água no N.A., céu físico,
sol, câmera com lente 35 mm e profundidade de campo, e renderiza (Cycles, AgX).

Uso headless:   python cena_blender.py modelo.glb saida.png [--na 2600] [--amostras 64]
                                       [--blend cena.blend] [--turntable frames]
Uso no Blender (MCP execute_blender_code): exec do arquivo e chamar montar_cena(...).
Tudo procedural: não depende de texturas baixadas (HDRI/PBR externos são opcionais).
"""
from __future__ import annotations

import argparse
import math
import sys

import bpy
from mathutils import Vector

# (cor base RGB, metálico, rugosidade) por prefixo de tag; cor de tubo vem do glTF
MATERIAIS = {
    "TQ": ((0.36, 0.35, 0.33), 0.0, 0.85),   # concreto aparente / chapa pintada
    "N": ((0.70, 0.71, 0.73), 1.0, 0.35),    # bocal e flange em aço
    "L": (None, 0.6, 0.40),                  # tubulação pintada (cor do serviço)
    "V": ((0.55, 0.05, 0.04), 0.3, 0.45),    # válvula em ferro fundido pintado
    "MX": ((0.15, 0.25, 0.45), 0.4, 0.40),   # motorredutor azul industrial
    "B": ((0.10, 0.30, 0.55), 0.4, 0.40),    # bomba
    "VT": ((0.55, 0.05, 0.04), 0.3, 0.45),   # ventosa
    "S": ((0.40, 0.39, 0.37), 0.0, 0.90),    # apoios de concreto
}


def _limpar() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _principled(nome: str, cor, metalico: float, rugosidade: float, ruido: bool = False):
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*cor, 1)
    bsdf.inputs["Metallic"].default_value = metalico
    bsdf.inputs["Roughness"].default_value = rugosidade
    if ruido:  # manchas leves de uso, evita o aspecto "plástico" de CG
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 0.8
        tex.inputs["Detail"].default_value = 8
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = (rugosidade - 0.15,) * 3 + (1,)
        ramp.color_ramp.elements[1].color = (min(rugosidade + 0.15, 1),) * 3 + (1,)
        nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Roughness"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.05
        nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def _cor_importada(obj):
    """Cor base que veio do glTF (cor do serviço definida em componentes.CORES)."""
    for slot in obj.material_slots:
        if slot.material and slot.material.use_nodes:
            b = next((n for n in slot.material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b:
                return tuple(b.inputs["Base Color"].default_value[:3])
    return (0.5, 0.5, 0.5)


def aplicar_materiais() -> None:
    cache = {}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        tag = obj.name.split("-")[0].rstrip("0123456789") or obj.name
        prefixo = next((p for p in sorted(MATERIAIS, key=len, reverse=True) if tag.startswith(p)), None)
        if prefixo is None:
            continue
        cor, met, rug = MATERIAIS[prefixo]
        cor = cor or _cor_importada(obj)
        chave = (prefixo, tuple(round(c, 3) for c in cor))
        if chave not in cache:
            cache[chave] = _principled(f"PBR_{prefixo}", cor, met, rug, ruido=True)
        obj.data.materials.clear()
        obj.data.materials.append(cache[chave])
        for p in obj.data.polygons:
            p.use_smooth = True


CENARIO = ("Piso", "Agua_NA")


def _limites():
    """Caixa envolvente do modelo de engenharia (sem piso e água)."""
    pts = [o.matrix_world @ Vector(c) for o in bpy.context.scene.objects
           if o.type == "MESH" and not o.name.startswith(CENARIO) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def adicionar_ambiente(na_m: float | None, tanque: str = "TQ") -> None:
    mn, mx = _limites()
    centro, tam = (mn + mx) / 2, max((mx - mn).x, (mx - mn).y)
    # Piso de concreto
    bpy.ops.mesh.primitive_plane_add(size=tam * 6, location=(centro.x, centro.y, mn.z))
    piso = bpy.context.active_object
    piso.name = "Piso"
    piso.data.materials.append(_principled("PBR_piso", (0.22, 0.21, 0.20), 0.0, 0.9, ruido=True))
    # Água no N.A. do tanque (disco no diâmetro interno)
    tq = next((o for o in bpy.context.scene.objects if o.name.startswith(tanque)), None)
    if na_m is not None and tq is not None:
        d = tq.dimensions.x
        bpy.ops.mesh.primitive_cylinder_add(radius=d / 2 * 0.99, depth=0.01,
                                            location=(tq.matrix_world.translation.x, tq.matrix_world.translation.y, na_m))
        agua = bpy.context.active_object
        agua.name = "Agua_NA"
        m = _principled("PBR_agua", (0.05, 0.12, 0.10), 0.0, 0.05)
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Transmission Weight"].default_value = 0.6
        b.inputs["IOR"].default_value = 1.33
        agua.data.materials.append(m)
    # Céu físico + sol (sem HDRI externo)
    mundo = bpy.data.worlds.new("Ceu")
    bpy.context.scene.world = mundo
    mundo.use_nodes = True
    nt = mundo.node_tree
    ceu = nt.nodes.new("ShaderNodeTexSky")
    for tipo in ("MULTIPLE_SCATTERING", "NISHITA", "HOSEK_WILKIE"):
        try:
            ceu.sky_type = tipo
            break
        except TypeError:
            continue
    ceu.sun_elevation = math.radians(35)
    ceu.sun_rotation = math.radians(140)
    ceu.sun_disc = False  # o sol vem da lâmpada abaixo, para não iluminar em dobro
    fundo = next(n for n in nt.nodes if n.type == "BACKGROUND")
    fundo.inputs["Strength"].default_value = 0.08
    nt.links.new(ceu.outputs["Color"], fundo.inputs["Color"])
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(55), 0, math.radians(140)))
    bpy.context.active_object.data.energy = 2.5
    bpy.context.active_object.data.angle = math.radians(1.5)


def adicionar_camera(azimute: float = -50, elevacao: float = 22, lente: float = 35):
    mn, mx = _limites()
    centro, raio = (mn + mx) / 2, (mx - mn).length / 2
    dist = raio / math.sin(math.atan(10.125 / lente)) * 1.05  # cabe na altura 16:9
    az, el = math.radians(azimute), math.radians(elevacao)
    pos = centro + Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el),
                           math.sin(el))) * dist
    bpy.ops.object.camera_add(location=pos)
    cam = bpy.context.active_object
    cam.data.lens = lente
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = dist
    cam.data.dof.aperture_fstop = 8
    alvo = bpy.data.objects.new("Alvo", None)
    alvo.location = centro
    bpy.context.scene.collection.objects.link(alvo)
    c = cam.constraints.new("TRACK_TO")
    c.target = alvo
    bpy.context.scene.camera = cam
    return cam, alvo


def configurar_render(saida: str, amostras: int = 64, largura: int = 1920, altura: int = 1080):
    cena = bpy.context.scene
    for motor in ("CYCLES", "BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            cena.render.engine = motor
            break
        except TypeError:
            continue
    if cena.render.engine == "CYCLES":
        cena.cycles.samples = amostras
        cena.cycles.use_denoising = True
    cena.render.resolution_x, cena.render.resolution_y = largura, altura
    try:
        cena.view_settings.view_transform = "AgX"
        cena.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    cena.render.filepath = saida


def turntable(alvo, frames: int) -> None:
    """Gira a câmera 360° em volta do alvo (vídeo de apresentação)."""
    cena = bpy.context.scene
    pivo = bpy.data.objects.new("Pivo", None)
    pivo.location = alvo.location
    cena.collection.objects.link(pivo)
    cena.camera.parent = pivo
    cena.camera.matrix_parent_inverse = pivo.matrix_world.inverted()
    cena.frame_start, cena.frame_end = 1, frames
    pivo.rotation_euler = (0, 0, 0)
    pivo.keyframe_insert("rotation_euler", frame=1)
    pivo.rotation_euler = (0, 0, math.radians(360))
    pivo.keyframe_insert("rotation_euler", frame=frames + 1)
    for fc in getattr(pivo.animation_data.action, "fcurves", []):
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"


def montar_cena(glb: str, saida: str, na_mm: float | None = None, amostras: int = 64,
                limpar: bool = True):
    if limpar:
        _limpar()
    bpy.ops.import_scene.gltf(filepath=glb)  # converte Y-up → Z-up e mm → m
    aplicar_materiais()
    adicionar_ambiente(None if na_mm is None else na_mm / 1000)
    cam, alvo = adicionar_camera()
    configurar_render(saida, amostras)
    return cam, alvo


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("glb")
    ap.add_argument("saida")
    ap.add_argument("--na", type=float, help="nível d'água em mm")
    ap.add_argument("--amostras", type=int, default=64)
    ap.add_argument("--res", default="1920x1080", help="largura x altura")
    ap.add_argument("--blend", help="salvar também o .blend")
    ap.add_argument("--turntable", type=int, default=0, help="frames do giro 360°")
    a = ap.parse_args(argv)
    _, alvo = montar_cena(a.glb, a.saida, a.na, a.amostras)
    larg, alt = (int(v) for v in a.res.lower().split("x"))
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = larg, alt
    if a.blend:
        bpy.ops.wm.save_as_mainfile(filepath=a.blend)
    if a.turntable:
        turntable(alvo, a.turntable)
        bpy.ops.render.render(animation=True)
    else:
        bpy.ops.render.render(write_still=True)
    print("render:", a.saida)
