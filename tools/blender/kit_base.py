# Kit del Trasandino para "Sigilo en la bodega": utilidades comunes (se corre dentro de Blender)
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

SC = bpy.data.scenes.get('SigiloKit') or bpy.data.scenes.new('SigiloKit')
win = bpy.context.window or bpy.context.window_manager.windows[0]
win.scene = SC
COL = SC.collection

def lin(c):  # sRGB 0..1 -> lineal
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def hexc(h):
    return [lin(((h >> 16) & 255) / 255), lin(((h >> 8) & 255) / 255), lin((h & 255) / 255), 1.0]

MATS = {}
def mat(name, color, rough=0.75, metal=0.0, emit=None, es=1.0):
    key = 'sk_' + name
    if key in MATS: return MATS[key]
    m = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = hexc(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit is not None:
        b.inputs['Emission Color'].default_value = hexc(emit)
        b.inputs['Emission Strength'].default_value = es
    MATS[key] = m
    return m

class Asset:
    def __init__(self, name):
        self.name = name; self.parts = []
    def add(self, bm, material, smooth=False):
        me = bpy.data.meshes.new(self.name + '_p')
        bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = smooth
        o = bpy.data.objects.new(self.name + '_p', me)
        o.data.materials.append(material)
        COL.objects.link(o); self.parts.append(o)
        return o
    def finish(self, sharp_angle=40):
        old = bpy.data.objects.get(self.name)
        if old: bpy.data.objects.remove(old, do_unlink=True)
        main = self.parts[0]
        with bpy.context.temp_override(active_object=main, selected_editable_objects=self.parts, object=main):
            bpy.ops.object.join()
        main.name = self.name; main.data.name = self.name
        # bordes duros por ángulo, el resto suave
        bm = bmesh.new(); bm.from_mesh(main.data)
        for e in bm.edges:
            if len(e.link_faces) == 2:
                a = e.link_faces[0].normal.angle(e.link_faces[1].normal)
                e.smooth = a < math.radians(sharp_angle)
        bm.to_mesh(main.data); bm.free()
        for p in main.data.polygons: p.use_smooth = True
        return main

def tr(bm, loc=(0, 0, 0), rot=None, scale=None):
    M = Matrix.Identity(4)
    if scale: M = Matrix.Diagonal((*scale, 1)) @ M
    if rot:
        for ax, ang in rot:
            M = Matrix.Rotation(math.radians(ang), 4, ax) @ M
    M = Matrix.Translation(Vector(loc)) @ M
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return bm

def bevel(bm, w=0.02, seg=1):
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=w, segments=seg, affect='EDGES', profile=0.5, clamp_overlap=True)
    return bm

def cube(size, loc=(0, 0, 0), bev=0.015, rot=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    tr(bm, scale=size)
    if bev: bevel(bm, min(bev, min(size) * 0.3))
    return tr(bm, loc, rot)

def cyl(r, h, loc=(0, 0, 0), axis='Z', seg=20, r2=None, bev=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if bev: bevel(bm, bev)
    rot = {'Z': None, 'X': [('Y', 90)], 'Y': [('X', 90)]}[axis]
    return tr(bm, loc, rot)

def sphere(r, loc=(0, 0, 0), sub=2, scale=(1, 1, 1)):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    tr(bm, scale=scale)
    return tr(bm, loc)

def prism(points2d, depth, axis='Y', loc=(0, 0, 0)):
    """Polígono en el plano XZ extruido a lo largo de Y (centrado)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -depth / 2, z)) for x, z in points2d]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, depth, 0), verts=nv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return tr(bm, loc)

def export(obj, path):
    for o in SC.objects: o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_materials='EXPORT')
