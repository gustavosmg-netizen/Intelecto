"""Prévia PNG de um .glb sem GUI (matplotlib). Uso: python previa_png.py modelo.glb saida.png"""
import sys, numpy as np, trimesh, matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
sc = trimesh.load(sys.argv[1]); fig = plt.figure(figsize=(10, 9)); ax = fig.add_subplot(projection="3d")
luz = np.array([0.4, -0.6, 0.7]); luz /= np.linalg.norm(luz); allv = []
for g in sc.dump():
    g.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))  # Y-up -> Z-up
    m = getattr(g.visual, "material", None); bc = getattr(m, "baseColorFactor", None)
    c = np.array(bc[:3]) / (255 if np.max(bc[:3]) > 1 else 1) if bc is not None else np.array([.6, .6, .6])
    sh = 0.45 + 0.55 * np.clip(g.face_normals @ luz, 0, 1)
    ax.add_collection3d(Poly3DCollection(g.triangles, facecolors=np.clip(c * sh[:, None], 0, 1), linewidths=0))
    allv.append(g.vertices)
v = np.vstack(allv); mn, mx = v.min(0), v.max(0); r = (mx - mn).max() / 2; ce = (mx + mn) / 2
for f, i in ((ax.set_xlim, 0), (ax.set_ylim, 1), (ax.set_zlim, 2)): f(ce[i] - r, ce[i] + r)
ax.view_init(22, -60); ax.set_axis_off(); plt.tight_layout(); plt.savefig(sys.argv[2], dpi=110)
