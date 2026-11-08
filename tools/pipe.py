# Herramientas para armar los personajes de "Sigilo en la bodega" en Blender.
# Uso dentro de Blender:  exec(open(r"C:\Users\User\3D Objects\banda\pipe.py", encoding="utf-8").read())
import bpy, bmesh, math, os, json
import numpy as np
from mathutils import Vector, Matrix

R = math.radians
D = r"C:\Users\User\3D Objects\banda"
H = 1.8  # todos los personajes se normalizan a 1,80 m


# ---------- escena ----------
def limpiar_escena():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for x in list(coll):
            if x.users == 0:
                coll.remove(x)


def seleccionar(objs, activo=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = activo or objs[0]


def importar(path, name):
    before = set(bpy.data.objects)
    if path.lower().endswith('.obj'):
        bpy.ops.wm.obj_import(filepath=path)
    else:
        bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for o in new:
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    seleccionar(meshes)
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.name = name; ob.data.name = name
    return ob


def coords(ob):
    n = len(ob.data.vertices); a = np.empty(n * 3, dtype=np.float32)
    ob.data.vertices.foreach_get('co', a)
    return a.reshape(n, 3)


def set_coords(ob, P):
    ob.data.vertices.foreach_set('co', P.astype(np.float32).ravel()); ob.data.update()


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def normalizar(ob, alto=H, girar=0.0, max_tris=None, merge=True):
    """Pies en z=0, centrado en x/y, alto fijo. girar: grados alrededor de Z."""
    P = coords(ob)
    if girar:
        c, s = math.cos(R(girar)), math.sin(R(girar))
        P = P @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]], dtype=np.float32)
    mn, mx = P.min(0), P.max(0)
    k = alto / (mx[2] - mn[2])
    P = (P - np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]])) * k
    set_coords(ob, P)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    if merge:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0006)
    # piezas sueltas chiquitas
    bm.verts.ensure_lookup_table(); seen = set(); parts = []
    for v in bm.verts:
        if v in seen: continue
        st = [v]; comp = []; seen.add(v)
        while st:
            a = st.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b not in seen: seen.add(b); st.append(b)
        parts.append(comp)
    parts.sort(key=len, reverse=True)
    total = len(bm.verts)
    small = [v for p in parts[1:] if len(p) < total * 0.004 for v in p]
    if small:
        bmesh.ops.delete(bm, geom=small, context='VERTS')
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    if max_tris and tris(ob) > max_tris:
        seleccionar([ob])
        m = ob.modifiers.new('Dec', 'DECIMATE'); m.ratio = max_tris / tris(ob)
        bpy.ops.object.modifier_apply(modifier='Dec')
    seleccionar([ob]); bpy.ops.object.shade_smooth()
    return dict(parts=len(parts), removed=len(small), tris=tris(ob))


# ---------- pintura por proyección (frente + espalda) ----------
def proyectar(ob, frente, espalda, bbF, bbB, size=2048, nombre=None):
    """Pinta la malla con las imágenes de frente y espalda (ya 'rellenas') y hornea una textura."""
    nombre = nombre or ob.name
    me = ob.data; P = coords(ob)
    xmid = (P[:, 0].min() + P[:, 0].max()) / 2; hz = P[:, 2].max()
    def uvfun(bb, mirror):
        k = (bb['y1'] - bb['y0']) / hz; cx = (bb['x0'] + bb['x1']) / 2
        def f(co):
            dx = (co.x - xmid) * k
            px = cx - dx if mirror else cx + dx
            py = bb['y1'] - co.z * k
            return (px / bb['W'], 1 - py / bb['H'])
        return f
    for n in ('proj_front', 'proj_back'):
        if n in me.uv_layers: me.uv_layers.remove(me.uv_layers[n])
    uf = me.uv_layers.new(name='proj_front'); ub = me.uv_layers.new(name='proj_back')
    ff, fb = uvfun(bbF, False), uvfun(bbB, True)
    for li, l in enumerate(me.loops):
        co = me.vertices[l.vertex_index].co
        uf.data[li].uv = ff(co); ub.data[li].uv = fb(co)
    bake = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    me.uv_layers.active = bake
    seleccionar([ob])
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    mat = bpy.data.materials.new(nombre + '_proj'); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
    tf = nt.nodes.new('ShaderNodeTexImage'); tf.image = bpy.data.images.load(os.path.join(D, frente), check_existing=True); tf.extension = 'EXTEND'
    tb = nt.nodes.new('ShaderNodeTexImage'); tb.image = bpy.data.images.load(os.path.join(D, espalda), check_existing=True); tb.extension = 'EXTEND'
    a = nt.nodes.new('ShaderNodeUVMap'); a.uv_map = 'proj_front'; b = nt.nodes.new('ShaderNodeUVMap'); b.uv_map = 'proj_back'
    nt.links.new(a.outputs[0], tf.inputs[0]); nt.links.new(b.outputs[0], tb.inputs[0])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    vt = nt.nodes.new('ShaderNodeVectorTransform'); vt.convert_from = 'WORLD'; vt.convert_to = 'OBJECT'; vt.vector_type = 'NORMAL'
    nt.links.new(geo.outputs['Normal'], vt.inputs[0])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(vt.outputs[0], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
    mr.inputs['From Min'].default_value = -0.2; mr.inputs['From Max'].default_value = 0.2
    nt.links.new(sep.outputs['Y'], mr.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(mr.outputs[0], mix.inputs['Factor'])
    nt.links.new(tf.outputs['Color'], mix.inputs[6]); nt.links.new(tb.outputs['Color'], mix.inputs[7])
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(mix.outputs[2], em.inputs[0])
    out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], out.inputs[0])
    img = bpy.data.images.new(nombre + '_color', size, size)
    tg = nt.nodes.new('ShaderNodeTexImage'); tg.image = img
    ubk = nt.nodes.new('ShaderNodeUVMap'); ubk.uv_map = 'UVMap'; nt.links.new(ubk.outputs[0], tg.inputs[0])
    for n in nt.nodes: n.select = False
    tg.select = True; nt.nodes.active = tg
    me.materials.clear(); me.materials.append(mat)
    sc = bpy.context.scene; eng = sc.render.engine
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1; sc.render.bake.margin = 16
    seleccionar([ob]); bpy.ops.object.bake(type='EMIT')
    sc.render.engine = eng
    img.filepath_raw = os.path.join(D, nombre + '_color.png'); img.file_format = 'PNG'; img.save()
    final = bpy.data.materials.new(nombre); final.use_nodes = True; n2 = final.node_tree
    bs = [n for n in n2.nodes if n.type == 'BSDF_PRINCIPLED'][0]; bs.inputs['Roughness'].default_value = 0.8
    t = n2.nodes.new('ShaderNodeTexImage'); t.image = img; n2.links.new(t.outputs['Color'], bs.inputs['Base Color'])
    me.materials.clear(); me.materials.append(final)
    for n in ('proj_front', 'proj_back'): me.uv_layers.remove(me.uv_layers[n])
    bpy.data.materials.remove(mat)
    return img


# ---------- esqueleto ----------
def _segs(xs, gap):
    if len(xs) == 0: return []
    xs = np.sort(xs); out = []; s = xs[0]; p = xs[0]
    for x in xs[1:]:
        if x - p > gap: out.append((s, p)); s = x
        p = x
    out.append((s, p)); return out


def medir(ob):
    P = coords(ob); x, y, z = P[:, 0], P[:, 1], P[:, 2]; Hm = z.max(); e = 0.006 * Hm
    L = {}
    # Brazos: línea del antebrazo, de la punta de la mano hacia adentro
    for s, sg in (('L', 1), ('R', -1)):
        tip_i = np.argmax(sg * x); tip = P[tip_i]; tx = abs(tip[0])
        pts = []
        for f in np.linspace(0.6, 0.86, 14):
            x0 = sg * tx * f; m = (np.abs(x - x0) < e) & (z > 0.3 * Hm)
            if m.sum() < 3: continue
            zz = np.sort(z[m]); cl = _segs(zz, 0.04 * Hm)
            c = max(cl, key=lambda q: q[1])  # el racimo más alto (el brazo)
            mm = m & (z >= c[0]) & (z <= c[1])
            pts.append((abs(x0), (c[0] + c[1]) / 2, float(y[mm].mean())))
        pts = np.array(pts)
        b, a = np.polyfit(pts[:, 0], pts[:, 1], 1)
        ay = float(np.median(pts[:, 2]))
        sx = 0.30 * tx; sz = float(np.clip(a + b * sx, 0.68 * Hm, 0.85 * Hm))
        wx = tx - 0.22 * (tx - sx); ex = sx + 0.52 * (wx - sx)
        zl = lambda xx: a + b * xx
        L['arm' + s] = dict(sh=(sg * sx, ay, sz), el=(sg * ex, ay + 0.012, zl(ex)), wr=(sg * wx, ay, zl(wx)),
                            tip=tuple(float(v) for v in tip), ang=math.degrees(math.atan(abs(b))))
    # Piernas
    m = (np.abs(z - 0.2 * Hm) < e); seg = [q for q in _segs(x[m], 0.015 * Hm) if q[1] - q[0] > 0.02 * Hm]
    segL = max([q for q in seg if (q[0] + q[1]) > 0], key=lambda q: q[1] - q[0])
    segR = max([q for q in seg if (q[0] + q[1]) < 0], key=lambda q: q[1] - q[0])
    legx = ((segL[0] + segL[1]) / 2, (segR[0] + segR[1]) / 2)
    crotch = 0.2 * Hm
    for zz in np.arange(0.2 * Hm, 0.6 * Hm, 0.004 * Hm):
        mm = (np.abs(z - zz) < e) & (np.abs(x) < 0.012 * Hm)
        if mm.sum() > 0: break
        crotch = zz
    hip = float(np.clip(crotch + 0.06 * Hm, 0.47 * Hm, 0.51 * Hm))
    ank = 0.06 * Hm; knee = ank + 0.47 * (hip - ank)
    for s, sg, lx in (('L', 1, legx[0]), ('R', -1, legx[1])):
        mf = (z < 0.05 * Hm) & (np.sign(x) == sg)
        toe = float(y[mf].min()); heel = float(y[mf].max())
        ma = (z > 0.08 * Hm) & (z < 0.12 * Hm) & (np.abs(x - lx) < 0.05 * Hm)
        ay = float(y[ma].mean()) if ma.sum() else (toe + heel) / 2
        mk = (np.abs(z - knee) < e) & (np.abs(x - lx) < 0.06 * Hm)
        ky = float(y[mk].mean()) if mk.sum() else ay
        L['leg' + s] = dict(hip=(lx * 0.92, ky + 0.01, hip), knee=(lx, ky - 0.02, knee), ank=(lx * 1.05, ay, ank),
                            ball=(lx * 1.06, toe + 0.42 * (ay - toe), 0.022 * Hm), toe=(lx * 1.06, toe, 0.016 * Hm))
    # Columna y cuello
    def ycen(zz):
        mm = (np.abs(z - zz) < e) & (np.abs(x) < 0.08 * Hm)
        if not mm.sum(): return 0.0
        a, b = np.percentile(y[mm], [4, 96]); return float((a + b) / 2)
    best = None
    for zz in np.arange(0.74 * Hm, 0.88 * Hm, 0.004 * Hm):
        mm = (np.abs(z - zz) < e)
        seg = [q for q in _segs(x[mm], 0.01 * Hm) if q[0] <= 0.02 * Hm and q[1] >= -0.02 * Hm]
        if not seg: continue
        w = max(q[1] - q[0] for q in seg)
        if best is None or w < best[0]: best = (w, zz)
    sz = (L['armL']['sh'][2] + L['armR']['sh'][2]) / 2
    neck_top = float(best[1]) if best else 0.84 * Hm
    neck_top = max(neck_top, sz + 0.05 * Hm)
    neck_base = sz + 0.025 * Hm
    sp1 = hip + 0.31 * (neck_base - hip); sp2 = hip + 0.62 * (neck_base - hip)
    L['spine'] = dict(hips=(0, ycen(hip + 0.01), hip + 0.01), sp1=(0, ycen(sp1), sp1), sp2=(0, ycen(sp2), sp2),
                      nb=(0, ycen(neck_base), neck_base), nt=(0, ycen(neck_top), neck_top), top=(0, ycen(neck_top), Hm))
    L['H'] = float(Hm); L['crotch'] = float(crotch)
    return L


def esqueleto(ob, L=None, nombre='Rig'):
    L = L or medir(ob)
    if nombre in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[nombre], do_unlink=True)
    arm = bpy.data.armatures.new(nombre); rig = bpy.data.objects.new(nombre, arm)
    bpy.context.scene.collection.objects.link(rig); rig.show_in_front = True
    seleccionar([rig]); bpy.ops.object.mode_set(mode='EDIT'); eb = arm.edit_bones
    def B(n, h, t, parent=None, conn=False):
        b = eb.new(n); b.head = Vector(h); b.tail = Vector(t)
        if parent: b.parent = eb[parent]; b.use_connect = conn
        d = (b.tail - b.head).normalized()
        b.align_roll(Vector((0, -1, 0)) if abs(d.y) < 0.9 else Vector((0, 0, 1)))
    S = L['spine']
    B('root', (0, 0, 0), (0, 0.25, 0))
    B('hips', S['hips'], S['sp1'], 'root'); B('spine', S['sp1'], S['sp2'], 'hips', True)
    B('chest', S['sp2'], S['nb'], 'spine', True)
    B('neck', S['nb'], S['nt'], 'chest'); B('head', S['nt'], S['top'], 'neck', True)
    for s in ('L', 'R'):
        A = L['arm' + s]; G = L['leg' + s]; sg = 1 if s == 'L' else -1
        B(f'shoulder.{s}', (0.03 * sg, S['nb'][1], A['sh'][2] + 0.01), A['sh'], 'chest')
        B(f'upper_arm.{s}', A['sh'], A['el'], f'shoulder.{s}', True)
        B(f'forearm.{s}', A['el'], A['wr'], f'upper_arm.{s}', True)
        B(f'hand.{s}', A['wr'], A['tip'], f'forearm.{s}', True)
        B(f'thigh.{s}', G['hip'], G['knee'], 'hips')
        B(f'shin.{s}', G['knee'], G['ank'], f'thigh.{s}', True)
        B(f'foot.{s}', G['ank'], G['ball'], f'shin.{s}', True)
        B(f'toe.{s}', G['ball'], G['toe'], f'foot.{s}', True)
    eb['root'].use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')
    seleccionar([ob, rig], rig)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    # vértices sin peso: al hueso más cercano
    me = ob.data; sin = [v for v in me.vertices if not any(g.weight > 0.01 for g in v.groups)]
    if sin:
        segs = [(b.name, Vector(b.head_local), Vector(b.tail_local)) for b in arm.bones if b.use_deform]
        for v in sin:
            def dist(sg):
                a, b = sg[1], sg[2]; ab = b - a; t = max(0, min(1, (v.co - a).dot(ab) / ab.length_squared))
                return (v.co - (a + ab * t)).length
            n = min(segs, key=dist)[0]
            vg = ob.vertex_groups.get(n) or ob.vertex_groups.new(name=n); vg.add([v.index], 1.0, 'REPLACE')
    rig['arm_ang'] = (L['armL']['ang'] + L['armR']['ang']) / 2
    return rig, dict(sin_peso=len(sin), arm_ang=round(rig['arm_ang'], 1), crotch=round(L['crotch'], 3))


# ---------- animaciones ----------
def animar(rig, extra=None, clips=('idle', 'walk', 'surprised', 'push', 'cheer', 'down', 'wave')):
    """extra: dict opcional con 'base' (rotaciones extra en reposo), 'idle_head' (grados de mirar a los costados)."""
    extra = extra or {}
    P = rig.pose.bones
    for pb in P: pb.rotation_mode = 'XYZ'
    if not rig.animation_data: rig.animation_data_create()
    ad = rig.animation_data
    for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
    for n in clips:
        a = bpy.data.actions.get(n)
        if a: bpy.data.actions.remove(a)
    down = 84 - rig.get('arm_ang', 46)
    BASE = {'upper_arm.L': (0, 0, -down), 'upper_arm.R': (0, 0, down), 'forearm.L': (12, 0, 0), 'forearm.R': (12, 0, 0)}
    for k, v in extra.get('base', {}).items():
        b = BASE.get(k, (0, 0, 0)); BASE[k] = tuple(b[i] + v[i] for i in range(3))
    def reset():
        for pb in P: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0)
    def pose(f, rots, locs=None, base=True):
        reset(); d = dict(BASE) if base else {}
        for k, v in rots.items():
            b = d.get(k, (0, 0, 0)); d[k] = tuple(b[i] + v[i] for i in range(3))
        for k, v in d.items(): P[k].rotation_euler = tuple(R(x) for x in v)
        for k, v in (locs or {}).items(): P[k].location = v
        for pb in P:
            pb.keyframe_insert('rotation_euler', frame=f); pb.keyframe_insert('location', frame=f)
    def new(n):
        a = bpy.data.actions.new(n); a.use_fake_user = True; ad.action = a; return a
    def push(a):
        tr = ad.nla_tracks.new(); tr.name = a.name; tr.strips.new(a.name, int(a.frame_range[0]), a); ad.action = None
    look = extra.get('idle_head', 0)
    if 'idle' in clips:
        a = new('idle')
        for f, b, h in [(1, 0, 0), (13, 1, 1), (25, 0, 0), (37, -0.5, -1), (49, 0, 0)]:
            pose(f, {'chest': (-2 * b, 0, 0), 'spine': (-1 * b, 0, 0), 'neck': (1 * b, 0, 0), 'head': (0, 4 * b + look * h, 1 * b),
                     'upper_arm.L': (0, 0, -1.5 * b), 'upper_arm.R': (0, 0, 1.5 * b), 'forearm.L': (3 * b, 0, 0), 'forearm.R': (3 * b, 0, 0)},
                 {'hips': (0, 0.004 * b, 0)})
        push(a)
    if 'walk' in clips:
        a = new('walk'); arm = extra.get('walk_arm', 1.0)
        def wk(side):
            Lg, Rg = ('L', 'R') if side > 0 else ('R', 'L')
            return {f'thigh.{Lg}': (28, 0, 0), f'shin.{Lg}': (-8, 0, 0), f'foot.{Lg}': (-12, 0, 0),
                    f'thigh.{Rg}': (-22, 0, 0), f'shin.{Rg}': (-18, 0, 0), f'foot.{Rg}': (18, 0, 0),
                    f'upper_arm.{Rg}': (25 * arm, 0, 0), f'upper_arm.{Lg}': (-22 * arm, 0, 0), f'forearm.{Rg}': (20 * arm, 0, 0),
                    'hips': (0, 6 * side, 0), 'chest': (0, -8 * side, 0), 'head': (0, 4 * side, 0)}
        def ps(side):
            Pp, Sd = ('R', 'L') if side > 0 else ('L', 'R')
            return {f'thigh.{Pp}': (22, 0, 0), f'shin.{Pp}': (-60, 0, 0), f'foot.{Pp}': (10, 0, 0), f'thigh.{Sd}': (-2, 0, 0), f'shin.{Sd}': (-4, 0, 0)}
        pose(1, wk(1), {'hips': (0, -0.025, 0)}); pose(7, ps(1), {'hips': (0, 0.012, 0)})
        pose(13, wk(-1), {'hips': (0, -0.025, 0)}); pose(19, ps(-1), {'hips': (0, 0.012, 0)})
        pose(25, wk(1), {'hips': (0, -0.025, 0)}); push(a)
    if 'surprised' in clips:
        a = new('surprised'); pose(1, {})
        S = {'chest': (-12, 0, 0), 'spine': (-4, 0, 0), 'neck': (-6, 0, 0), 'head': (-10, 0, 0),
             'upper_arm.L': (-20, 0, 40), 'upper_arm.R': (-20, 0, -40), 'forearm.L': (75, 0, 0), 'forearm.R': (75, 0, 0),
             'hand.L': (-20, 0, 0), 'hand.R': (-20, 0, 0), 'thigh.L': (-6, 0, 0), 'thigh.R': (10, 0, 0), 'shin.R': (-14, 0, 0)}
        pose(5, {k: tuple(v * 1.15 for v in vv) for k, vv in S.items()}, {'hips': (0, 0.035, 0.03)})
        pose(10, S, {'hips': (0, 0.0, 0.025)}); pose(24, S, {'hips': (0, 0.0, 0.025)}); push(a)
    if 'push' in clips:
        a = new('push'); pose(1, {})
        W = {'chest': (-6, 0, 0), 'upper_arm.L': (35, 0, 20), 'upper_arm.R': (35, 0, -20), 'forearm.L': (80, 0, 0), 'forearm.R': (80, 0, 0),
             'thigh.R': (-12, 0, 0), 'thigh.L': (8, 0, 0), 'shin.L': (-10, 0, 0)}
        pose(5, W, {'hips': (0, -0.02, -0.02)})
        Hh = {'chest': (18, 0, 0), 'spine': (8, 0, 0), 'head': (-12, 0, 0), 'upper_arm.L': (80, 0, 30), 'upper_arm.R': (80, 0, -30),
              'forearm.L': (5, 0, 0), 'forearm.R': (5, 0, 0), 'hand.L': (-35, 0, 0), 'hand.R': (-35, 0, 0),
              'thigh.L': (30, 0, 0), 'shin.L': (-25, 0, 0), 'thigh.R': (-25, 0, 0), 'shin.R': (-8, 0, 0), 'foot.R': (15, 0, 0)}
        pose(9, Hh, {'hips': (0, -0.04, -0.06)}); pose(16, Hh, {'hips': (0, -0.04, -0.06)}); pose(24, {}); push(a)
    if 'cheer' in clips:
        a = new('cheer')
        up = lambda ang, fo: {'upper_arm.L': (0, 0, ang + down), 'upper_arm.R': (0, 0, -ang - down),
                              'forearm.L': (0, 0, fo), 'forearm.R': (0, 0, -fo), 'chest': (-6, 0, 0), 'head': (-10, 0, 0)}
        U1 = up(97, 22); U2 = dict(up(112, 40))
        U2.update({'thigh.L': (12, 0, 0), 'thigh.R': (12, 0, 0), 'shin.L': (-24, 0, 0), 'shin.R': (-24, 0, 0), 'foot.L': (12, 0, 0), 'foot.R': (12, 0, 0)})
        for f, U, hz in [(1, U1, 0), (7, U2, -0.04), (13, U1, 0.03), (19, U2, -0.04), (25, U1, 0)]:
            pose(f, U, {'hips': (0, hz, 0)})
        push(a)
    if 'down' in clips:
        a = new('down')
        Dn = {'upper_arm.L': (0, 0, down + 25), 'upper_arm.R': (0, 0, -down - 25), 'forearm.L': (25, 0, 0), 'forearm.R': (-5, 0, 0),
              'head': (0, 25, 8), 'neck': (0, 0, 6), 'thigh.L': (18, 0, 0), 'shin.L': (-40, 0, 0), 'foot.L': (20, 0, 0), 'thigh.R': (-4, 0, 0)}
        pose(1, Dn); pose(2, Dn); push(a)
    if 'wave' in clips:
        a = new('wave'); pose(1, {})
        up = {'upper_arm.R': (0, 0, -100), 'forearm.R': (-12, 0, -70), 'chest': (0, -6, 0), 'head': (0, -8, 3)}
        pose(10, up)
        for f, w in [(16, 25), (22, -10), (28, 25), (34, -10)]:
            d = dict(up); d['forearm.R'] = (-12, 0, -70 + w); d['hand.R'] = (0, 0, w * 0.6); pose(f, d)
        pose(40, up); pose(49, {}); push(a)
    reset()
    return [t.name for t in ad.nla_tracks]


def ver_clip(rig, n, frame=1):
    ad = rig.animation_data
    for t in ad.nla_tracks: t.mute = True
    ad.action = bpy.data.actions[n] if n else None
    bpy.context.scene.frame_set(frame)


def pose_reposo(rig):
    ad = rig.animation_data
    ad.action = None
    for t in ad.nla_tracks: t.mute = False
    for pb in rig.pose.bones: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0)
    bpy.context.scene.frame_set(1)


def enganchar(obj, rig, bone, clip='idle', frame=1):
    """Pega un objeto a un hueso, tomando como referencia la pose de 'clip' (así queda derecho en esa pose)."""
    ver_clip(rig, clip, frame); bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = rig; obj.parent_type = 'BONE'; obj.parent_bone = bone
    bpy.context.view_layer.update(); obj.matrix_world = mw
    bpy.context.view_layer.update()


def exportar(objs, rig, path, limites, tex=1024):
    """limites: {nombre_objeto: triángulos} para la versión del juego."""
    pose_reposo(rig)
    mods = []
    for o in objs:
        t = limites.get(o.name)
        if t and tris(o) > t:
            m = o.modifiers.new('GameDec', 'DECIMATE'); m.ratio = t / tris(o); mods.append((o, m))
            seleccionar([o])
            while o.modifiers.find('GameDec') > 0:
                bpy.ops.object.modifier_move_up(modifier='GameDec')
    swaps = []
    for o in objs:
        for ms in o.material_slots:
            if not ms.material or not ms.material.use_nodes: continue
            for n in ms.material.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image and max(n.image.size) > tex:
                    src = n.image; cp = src.copy(); w, h = cp.size; f = tex / max(w, h); cp.scale(int(w * f), int(h * f))
                    n.image = cp; swaps.append((n, src, cp))
    seleccionar(list(objs) + [rig], rig)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
                              export_def_bones=True, export_image_format='JPEG', export_jpeg_quality=85, export_yup=True)
    for n, src, cp in swaps: n.image = src; bpy.data.images.remove(cp)
    for o, m in mods: o.modifiers.remove(m)
    return os.path.getsize(path)
