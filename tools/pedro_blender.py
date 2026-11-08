"""Construye a Pedro entero dentro de Blender: malla, esqueleto y animaciones.

Pedro se arma con primitivas propias (tubos y barridos), sin base de madera, en pose A,
con una sola textura chiquita (un atlas de colores planos) para que el GLB pese poco.

Uso:
    blender --background --python tools/pedro_blender.py -- assets/modelos/pedro_blender.glb
    blender --background --python tools/pedro_blender.py -- salida.glb --render carpeta/

Mira hacia -Y en Blender, que al exportar a glTF queda mirando a +Z (lo que espera el juego).
Los pies quedan en Z=0. La altura no importa: characters.js lo escala a MODEL_H.
"""

import bpy, math, os, sys, struct, json
from mathutils import Vector, Matrix, Quaternion

# ---------------------------------------------------------------- argumentos
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SALIDA = os.path.abspath(ARGS[0]) if ARGS else os.path.abspath('pedro_blender.glb')
RENDER_DIR = None
if '--render' in ARGS:
    RENDER_DIR = os.path.abspath(ARGS[ARGS.index('--render') + 1])

V = lambda x, y, z: Vector((x, y, z))
TAU = math.pi * 2


def suavizar(a, b, x):
    """smoothstep: 0 antes de a, 1 despues de b, con curva suave en el medio."""
    if b <= a:
        return 0.0 if x < a else 1.0
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ paleta
# Los colores siguen la hoja de estilo de assets/referencias y PAL de characters.js.
HEX = {
    'piel':      0xd8a886,
    'camisa':    0xe8dfc9,
    'chaleco':   0x76803f,
    'pantalon':  0x7c5739,
    'alpargata': 0xb5aa8a,
    'suela':     0x8d7f63,
    'boina':     0x312822,
    'pelo':      0x9b958b,
    'ceja':      0x6b665e,
    'bigote':    0x746f66,
    'panuelo':   0xab9a6d,
    'ojo':       0x1d1915,
    'boca':      0x8a6251,
    'cuero':     0x5d4430,
}
RANURA = {nombre: i for i, nombre in enumerate(HEX)}
COLS = 4
TEX = 256


def uv_de(ranura, t):
    """Coordenada UV dentro de la celda del color: u al centro, v segun el degrade."""
    cx, cy = ranura % COLS, ranura // COLS
    paso = 1.0 / COLS
    t = min(1.0, max(0.0, t))
    return ((cx + 0.5) * paso, (cy + 0.25 + 0.5 * t) * paso)


def crear_atlas():
    """Imagen chiquita con un cuadradito por color, con un degrade vertical suave."""
    img = bpy.data.images.new('pedro_atlas', TEX, TEX, alpha=False)
    # el espacio de color y el formato van antes de escribir: cambiarlos despues
    # invalida el buffer y la imagen queda negra
    img.colorspace_settings.name = 'sRGB'
    img.file_format = 'PNG'
    celda = TEX // COLS
    px = [0.0] * (TEX * TEX * 4)
    for nombre, valor in HEX.items():
        idx = RANURA[nombre]
        cx, cy = idx % COLS, idx // COLS
        # la imagen es de bytes: los valores van tal cual en sRGB, sin convertir
        base = [((valor >> d) & 255) / 255.0 for d in (16, 8, 0)]
        for j in range(celda):
            f = 0.90 + 0.18 * (j / (celda - 1.0))
            fila = [min(1.0, c * f) for c in base]
            for i in range(celda):
                o = ((cy * celda + j) * TEX + (cx * celda + i)) * 4
                px[o], px[o + 1], px[o + 2], px[o + 3] = fila[0], fila[1], fila[2], 1.0
    img.pixels.foreach_set(px)
    img.update()
    ruta = os.path.join(bpy.app.tempdir, 'pedro_atlas.png')
    img.filepath_raw = ruta
    img.save()
    img.pack()
    return img


# ------------------------------------------------------- primitivas de malla
def aro(n, rx, ry, centro, fase=0.0):
    return [V(centro[0] + math.cos(fase + TAU * i / n) * rx,
              centro[1] + math.sin(fase + TAU * i / n) * ry,
              centro[2]) for i in range(n)]


def tubo(secciones, n=16, tapa0=('punta', 0.0), tapa1=('punta', 0.0), fase=0.0):
    """Une aros consecutivos con cuadrilateros. Cada seccion es (centro, rx, ry).

    Las tapas pueden ser ('domo', alto), ('punta', alto) o ('ninguna', 0).
    El eje va del primer aro al ultimo; las tapas salen para afuera de ese eje.
    """
    c0, rx0, ry0 = secciones[0]
    c1, rx1, ry1 = secciones[-1]
    eje = (Vector(c1) - Vector(c0))
    eje = eje.normalized() if eje.length > 1e-9 else V(0, 0, 1)

    anillos, punta0, punta1 = [], None, None

    modo, alto = tapa0
    if modo == 'domo':
        K = 3
        for i in range(K - 1, 0, -1):
            a = (math.pi / 2) * i / K
            anillos.append(aro(n, rx0 * math.cos(a), ry0 * math.cos(a),
                               Vector(c0) - eje * (alto * math.sin(a)), fase))
        punta0 = Vector(c0) - eje * alto
    elif modo == 'punta':
        punta0 = Vector(c0) - eje * alto

    for c, rx, ry in secciones:
        anillos.append(aro(n, rx, ry, c, fase))

    modo, alto = tapa1
    if modo == 'domo':
        K = 3
        for i in range(1, K):
            a = (math.pi / 2) * i / K
            anillos.append(aro(n, rx1 * math.cos(a), ry1 * math.cos(a),
                               Vector(c1) + eje * (alto * math.sin(a)), fase))
        punta1 = Vector(c1) + eje * alto
    elif modo == 'punta':
        punta1 = Vector(c1) + eje * alto

    verts, idx = [], []
    for an in anillos:
        idx.append(list(range(len(verts), len(verts) + n)))
        verts += an
    caras = []
    for a, b in zip(idx, idx[1:]):
        for i in range(n):
            j = (i + 1) % n
            caras.append((a[i], a[j], b[j], b[i]))
    if punta0 is not None:
        p = len(verts); verts.append(punta0)
        caras += [(p, idx[0][(i + 1) % n], idx[0][i]) for i in range(n)]
    if punta1 is not None:
        p = len(verts); verts.append(punta1)
        caras += [(p, idx[-1][i], idx[-1][(i + 1) % n]) for i in range(n)]
    return verts, caras


def esfera(centro, rx, ry, rz, n=14, m=8):
    sec = []
    for j in range(1, m):
        t = math.pi * j / m
        sec.append((V(centro[0], centro[1], centro[2] - rz * math.cos(t)),
                    rx * math.sin(t), ry * math.sin(t)))
    h = rz * (1 - math.cos(math.pi / m))
    return tubo(sec, n=n, tapa0=('punta', h), tapa1=('punta', h))


def barrido(marcos, seccion, escalas=None, cerrado=False, tapas=True):
    """Arrastra un perfil 2D a lo largo de una lista de marcos (origen, dirx, diry)."""
    k = len(seccion)
    escalas = escalas or [(1.0, 1.0)] * len(marcos)
    verts, idx = [], []
    for (o, dx, dy), (sx, sy) in zip(marcos, escalas):
        idx.append(list(range(len(verts), len(verts) + k)))
        verts += [Vector(o) + Vector(dx) * (u * sx) + Vector(dy) * (v * sy) for u, v in seccion]
    caras = []
    pares = list(zip(idx, idx[1:])) + ([(idx[-1], idx[0])] if cerrado else [])
    for a, b in pares:
        for i in range(k):
            j = (i + 1) % k
            caras.append((a[i], a[j], b[j], b[i]))
    if tapas and not cerrado:
        for anillo, invertir in ((idx[0], True), (idx[-1], False)):
            c = len(verts)
            verts.append(sum((verts[i] for i in anillo), Vector()) / k)
            for i in range(k):
                j = (i + 1) % k
                caras.append((c, anillo[j], anillo[i]) if invertir else (c, anillo[i], anillo[j]))
    return verts, caras


def transformar(verts, M):
    return [M @ v for v in verts]


# -------------------------------------------------------------- acumulador
class Cuerpo:
    def __init__(self):
        self.pos, self.grad, self.tag, self.caras, self.ranuras = [], [], [], [], []

    def sumar(self, geo, color, etiqueta):
        verts, caras = geo
        base = len(self.pos)
        zs = [v.z for v in verts]
        z0, z1 = min(zs), max(zs)
        alto = max(z1 - z0, 1e-6)
        centro = (z0 + z1) / 2
        escala = max(alto, 0.16)  # las piezas chicas quedan casi planas de color
        for v in verts:
            self.pos.append(v.copy())
            self.grad.append(min(1.0, max(0.0, 0.5 + (v.z - centro) / escala)))
            self.tag.append(etiqueta)
        r = RANURA[color]
        for c in caras:
            self.caras.append(tuple(base + i for i in c))
            self.ranuras.append(r)
        return range(base, len(self.pos))


# ------------------------------------------------------- medidas del muñeco
Z_TOBILLO = 0.095
Z_RODILLA = 0.345
Z_CADERA = 0.600
Z_CINTURA = 0.780
Z_PECHO = 0.955
Z_HOMBRO = 1.055
Z_CUELLO = 1.120
Z_CAB = 1.420              # centro de la cabeza
HOMBRO_X = 0.168
BRAZO_ANG = math.radians(38.0)
DIR_BRAZO = {1: V(math.sin(BRAZO_ANG), 0, -math.cos(BRAZO_ANG)),
             -1: V(-math.sin(BRAZO_ANG), 0, -math.cos(BRAZO_ANG))}
HOMBRO = {1: V(HOMBRO_X, 0, Z_HOMBRO), -1: V(-HOMBRO_X, 0, Z_HOMBRO)}
L_BRAZO, L_ANTEBRAZO, L_MANO = 0.255, 0.495, 0.615  # distancias desde el hombro


def cara_y(x, z, hacia_adentro=0.0):
    """Y aproximada de la superficie de la cabeza (para pegar ojos, nariz, etc.)."""
    u = (x / 0.246) ** 2 + ((z - Z_CAB) / 0.250) ** 2
    return -0.238 * math.sqrt(max(0.03, 1 - u)) + hacia_adentro


def armar_cuerpo():
    C = Cuerpo()

    # --- piernas (pantalon) -------------------------------------------------
    for lado in (1, -1):
        C.sumar(tubo([
            (V(lado * 0.118, 0.004, Z_TOBILLO - 0.02), 0.056, 0.060),
            (V(lado * 0.118, 0.003, Z_TOBILLO + 0.06), 0.062, 0.068),
            (V(lado * 0.112, 0.000, Z_RODILLA - 0.06), 0.072, 0.080),
            (V(lado * 0.108, -0.002, Z_RODILLA + 0.01), 0.080, 0.086),
            (V(lado * 0.103, -0.004, Z_RODILLA + 0.10), 0.084, 0.091),
            (V(lado * 0.096, -0.002, Z_CADERA - 0.05), 0.094, 0.100),
            (V(lado * 0.094, 0.000, Z_CADERA + 0.04), 0.100, 0.104),
        ], n=14, tapa0=('punta', 0.0), tapa1=('punta', 0.0)),
            'pantalon', 'pata.L' if lado > 0 else 'pata.R')

    # --- alpargatas: suela de soga + capellada ------------------------------
    perfil_suela = [(-1.00, -1.00), (-0.55, -1.00), (0.55, -1.00), (1.00, -1.00),
                    (1.00, 0.55), (0.72, 1.00), (-0.72, 1.00), (-1.00, 0.55)]
    perfil_pie = [(-1.00, -1.00), (-0.50, -1.00), (0.50, -1.00), (1.00, -1.00),
                  (1.00, 0.10), (0.86, 0.72), (0.44, 1.00), (-0.44, 1.00),
                  (-0.86, 0.72), (-1.00, 0.10)]
    ys = [0.072, 0.034, -0.012, -0.058, -0.104, -0.146]
    escalas = [(0.52, 0.60), (0.94, 1.00), (1.00, 1.00), (0.97, 0.94), (0.84, 0.76), (0.50, 0.44)]
    for lado in (1, -1):
        px = lado * 0.118
        marcos_s = [(V(px, y, 0.016), V(1, 0, 0), V(0, 0, 1)) for y in ys]
        marcos_c = [(V(px, y, 0.050), V(1, 0, 0), V(0, 0, 1)) for y in ys]
        etiqueta = 'pata.L' if lado > 0 else 'pata.R'
        C.sumar(barrido(marcos_s, [(u * 0.076, v * 0.016) for u, v in perfil_suela], escalas),
                'suela', etiqueta)
        C.sumar(barrido(marcos_c, [(u * 0.072, v * 0.034) for u, v in perfil_pie], escalas),
                'alpargata', etiqueta)

    # --- pelvis (pantalon) --------------------------------------------------
    # la base angosta se mete entre los muslos y hace de entrepierna
    C.sumar(tubo([
        (V(0, 0, 0.500), 0.104, 0.097),
        (V(0, 0, 0.548), 0.142, 0.120),
        (V(0, 0, Z_CADERA - 0.02), 0.180, 0.135),
        (V(0, 0.002, Z_CADERA + 0.08), 0.192, 0.141),
        (V(0, 0.002, Z_CINTURA), 0.186, 0.137),
    ], n=18), 'pantalon', 'pelvis')

    # --- torso: camisa ------------------------------------------------------
    C.sumar(tubo([
        (V(0, 0, 0.745), 0.180, 0.133),
        (V(0, 0, 0.845), 0.191, 0.141),
        (V(0, 0, Z_PECHO), 0.201, 0.147),
        (V(0, 0, 1.025), 0.205, 0.148),
        (V(0, 0, Z_HOMBRO + 0.012), 0.193, 0.140),
        (V(0, 0, 1.105), 0.148, 0.116),
    ], n=20), 'camisa', 'torso')

    # cuello de la camisa, un poco levantado
    C.sumar(tubo([
        (V(0, 0.004, 1.088), 0.136, 0.112),
        (V(0, 0.004, 1.128), 0.126, 0.104),
    ], n=20), 'camisa', 'torso')

    # --- chaleco tejido, con el escote en V ---------------------------------
    rango = C.sumar(tubo([
        (V(0, 0, 0.716), 0.186, 0.140),
        (V(0, 0, 0.752), 0.197, 0.150),
        (V(0, 0, 0.880), 0.208, 0.157),
        (V(0, 0, 0.990), 0.214, 0.160),
        (V(0, 0, 1.048), 0.207, 0.153),
        (V(0, 0, 1.098), 0.172, 0.133),
    ], n=20), 'chaleco', 'torso')
    for i in rango:
        v = C.pos[i]
        ang = math.atan2(v.y, v.x)
        altura = suavizar(0.995, 1.100, v.z)
        frente = suavizar(0.50, 1.00, -math.sin(ang))
        espalda = suavizar(0.55, 1.00, math.sin(ang))
        baja = 0.250 * frente * altura + 0.110 * espalda * altura
        if baja > 1e-5:
            v.z -= baja
            v.x *= 0.975
            v.y *= 0.975

    # --- brazos: manga de camisa, antebrazo y mano --------------------------
    for lado in (1, -1):
        d = DIR_BRAZO[lado]
        eje_y = V(0, 1, 0)
        eje_x = d.cross(eje_y).normalized()
        M = Matrix((
            (eje_x.x, eje_y.x, d.x, HOMBRO[lado].x),
            (eje_x.y, eje_y.y, d.y, HOMBRO[lado].y),
            (eje_x.z, eje_y.z, d.z, HOMBRO[lado].z),
            (0, 0, 0, 1),
        ))
        etiqueta = 'brazo.L' if lado > 0 else 'brazo.R'

        manga = tubo([
            (V(0, 0, -0.030), 0.096, 0.094),
            (V(0, 0, 0.030), 0.103, 0.100),
            (V(0, 0, 0.110), 0.091, 0.089),
            (V(0, 0, 0.196), 0.080, 0.079),
            (V(0, 0, 0.236), 0.089, 0.088),
            (V(0, 0, 0.268), 0.086, 0.085),
        ], n=12, tapa0=('domo', 0.082), tapa1=('punta', 0.0))
        C.sumar((transformar(manga[0], M), manga[1]), 'camisa', etiqueta)

        antebrazo = tubo([
            (V(0, 0, 0.240), 0.072, 0.071),
            (V(0, 0, 0.320), 0.067, 0.066),
            (V(0, 0, 0.410), 0.057, 0.057),
            (V(0, 0, 0.462), 0.052, 0.052),
        ], n=12)
        C.sumar((transformar(antebrazo[0], M), antebrazo[1]), 'piel', etiqueta)

        mano = tubo([
            (V(0, 0, 0.462), 0.053, 0.049),
            (V(0, 0, 0.505), 0.068, 0.061),
            (V(0, 0, 0.548), 0.062, 0.056),
        ], n=12, tapa0=('punta', 0.0), tapa1=('domo', 0.045))
        C.sumar((transformar(mano[0], M), mano[1]), 'piel', etiqueta)

    # --- cuello -------------------------------------------------------------
    C.sumar(tubo([
        (V(0, 0.002, 1.075), 0.094, 0.090),
        (V(0, 0.002, 1.160), 0.089, 0.086),
        (V(0, 0.002, 1.225), 0.098, 0.094),
    ], n=14), 'piel', 'cuello')

    # --- pañuelo al cuello --------------------------------------------------
    N = 20
    marcos = []
    for i in range(N):
        a = TAU * i / N
        marcos.append((V(math.cos(a) * 0.112, math.sin(a) * 0.108, 1.146),
                       V(math.cos(a), math.sin(a), 0), V(0, 0, 1)))
    seccion = [(math.cos(TAU * i / 8) * 0.026, math.sin(TAU * i / 8) * 0.030) for i in range(8)]
    C.sumar(barrido(marcos, seccion, cerrado=True), 'panuelo', 'cuello')
    C.sumar(esfera(V(0, -0.118, 1.126), 0.038, 0.034, 0.034, n=10, m=6), 'panuelo', 'cuello')
    for lado in (1, -1):
        punta = tubo([(V(lado * 0.026, -0.120, 1.098), 0.030, 0.020),
                      (V(lado * 0.040, -0.116, 1.046), 0.016, 0.011)],
                     n=8, tapa0=('punta', 0.012), tapa1=('punta', 0.010))
        C.sumar(punta, 'panuelo', 'cuello')

    # --- cabeza -------------------------------------------------------------
    rango = C.sumar(tubo([
        (V(0, -0.014, Z_CAB - 0.235), 0.088, 0.096),
        (V(0, -0.018, Z_CAB - 0.196), 0.141, 0.152),
        (V(0, -0.013, Z_CAB - 0.140), 0.191, 0.200),
        (V(0, -0.006, Z_CAB - 0.070), 0.224, 0.229),
        (V(0, 0.000, Z_CAB + 0.005), 0.241, 0.240),
        (V(0, 0.003, Z_CAB + 0.080), 0.236, 0.234),
        (V(0, 0.005, Z_CAB + 0.150), 0.204, 0.204),
        (V(0, 0.006, Z_CAB + 0.205), 0.144, 0.147),
    ], n=22, tapa0=('punta', 0.046), tapa1=('punta', 0.055)), 'piel', 'cabeza')
    for i in rango:  # nuca un poco mas chata
        v = C.pos[i]
        if v.y > 0:
            v.y *= 0.93

    # orejas
    for lado in (1, -1):
        C.sumar(esfera(V(lado * 0.228, 0.012, Z_CAB - 0.012), 0.028, 0.050, 0.068, n=10, m=6),
                'piel', 'cabeza')

    # nariz
    C.sumar(esfera(V(0, cara_y(0, Z_CAB - 0.052) + 0.020, Z_CAB - 0.052), 0.050, 0.056, 0.046, n=12, m=7),
            'piel', 'cabeza')

    # ojos
    for lado in (1, -1):
        x = lado * 0.090
        C.sumar(esfera(V(x, cara_y(x, Z_CAB + 0.012) + 0.022, Z_CAB + 0.012), 0.034, 0.032, 0.040, n=10, m=6),
                'ojo', 'cabeza')

    # cejas pobladas, apenas caidas hacia afuera
    for lado in (1, -1):
        x = lado * 0.094
        geo = esfera(V(0, 0, 0), 0.062, 0.024, 0.020, n=10, m=5)
        R = Matrix.Translation(V(x, cara_y(x, Z_CAB + 0.078) + 0.012, Z_CAB + 0.078)) @ \
            Matrix.Rotation(lado * 0.20, 4, 'Y')
        C.sumar((transformar(geo[0], R), geo[1]), 'ceja', 'cabeza')

    # bigote gris, en dos mitades
    for lado in (1, -1):
        x = lado * 0.040
        geo = esfera(V(0, 0, 0), 0.056, 0.038, 0.024, n=10, m=5)
        R = Matrix.Translation(V(x, cara_y(x, Z_CAB - 0.108) + 0.014, Z_CAB - 0.108)) @ \
            Matrix.Rotation(lado * 0.30, 4, 'Y')
        C.sumar((transformar(geo[0], R), geo[1]), 'bigote', 'cabeza')

    # boca apenas insinuada
    C.sumar(esfera(V(0, cara_y(0, Z_CAB - 0.152) + 0.016, Z_CAB - 0.152), 0.042, 0.020, 0.012, n=10, m=4),
            'boca', 'cabeza')

    # --- pelo gris asomando por atras y los costados ------------------------
    N = 26
    a0, a1 = math.radians(-46), math.radians(226)
    marcos, escalas = [], []
    for i in range(N):
        a = a0 + (a1 - a0) * i / (N - 1)
        marcos.append((V(math.cos(a) * 0.241, math.sin(a) * 0.239, Z_CAB + 0.018),
                       V(math.cos(a), math.sin(a), 0), V(0, 0, 1)))
        punta = min(i, N - 1 - i) / 4.0
        f = 0.30 + 0.70 * suavizar(0.0, 1.0, min(1.0, punta))
        escalas.append((f, f))
    seccion = [(-0.018, 0.062), (0.013, 0.050), (0.014, 0.000), (0.010, -0.055),
               (-0.002, -0.068), (-0.020, -0.052), (-0.022, 0.000)]
    C.sumar(barrido(marcos, seccion, escalas), 'pelo', 'cabeza')

    # --- boina --------------------------------------------------------------
    boina = tubo([
        (V(0, 0, -0.016), 0.292, 0.288),
        (V(0, 0, 0.004), 0.300, 0.296),
        (V(0, 0, 0.034), 0.288, 0.283),
        (V(0, 0, 0.070), 0.238, 0.234),
        (V(0, 0, 0.098), 0.152, 0.150),
    ], n=24, tapa0=('punta', 0.0), tapa1=('domo', 0.040))
    nudo = tubo([(V(0, 0, 0.128), 0.017, 0.017), (V(0, 0, 0.168), 0.015, 0.015)],
                n=8, tapa0=('punta', 0.0), tapa1=('domo', 0.014))
    M = Matrix.Translation(V(0, 0.012, Z_CAB + 0.118)) @ \
        Matrix.Rotation(0.10, 4, 'X') @ Matrix.Rotation(0.13, 4, 'Y')
    C.sumar((transformar(boina[0], M), boina[1]), 'boina', 'cabeza')
    C.sumar((transformar(nudo[0], M), nudo[1]), 'boina', 'cabeza')

    return C


# ---------------------------------------------------------------- esqueleto
def huesos():
    def p(lado, s):
        return HOMBRO[lado] + DIR_BRAZO[lado] * s

    lista = [
        ('cadera', V(0, 0, Z_CADERA), V(0, 0, Z_CINTURA), None, False),
        ('espalda', V(0, 0, Z_CINTURA), V(0, 0, Z_PECHO), 'cadera', True),
        ('pecho', V(0, 0, Z_PECHO), V(0, 0, Z_CUELLO), 'espalda', True),
        ('cuello', V(0, 0, Z_CUELLO), V(0, 0, 1.210), 'pecho', True),
        ('cabeza', V(0, 0, 1.210), V(0, 0, 1.690), 'cuello', True),
    ]
    for lado, suf in ((1, '.L'), (-1, '.R')):
        lista += [
            ('hombro' + suf, V(lado * 0.048, 0, 1.062), HOMBRO[lado], 'pecho', False),
            ('brazo' + suf, HOMBRO[lado], p(lado, L_BRAZO), 'hombro' + suf, True),
            ('antebrazo' + suf, p(lado, L_BRAZO), p(lado, L_ANTEBRAZO), 'brazo' + suf, True),
            ('mano' + suf, p(lado, L_ANTEBRAZO), p(lado, L_MANO), 'antebrazo' + suf, True),
            ('muslo' + suf, V(lado * 0.090, 0, Z_CADERA), V(lado * 0.104, 0, Z_RODILLA), 'cadera', False),
            ('canilla' + suf, V(lado * 0.104, 0, Z_RODILLA), V(lado * 0.112, 0, Z_TOBILLO), 'muslo' + suf, True),
            ('pie' + suf, V(lado * 0.112, 0, Z_TOBILLO), V(lado * 0.112, -0.130, 0.030), 'canilla' + suf, True),
        ]
    return lista


def cadena(t, juntas, nombres, suaves):
    """Reparte el peso de un vertice entre huesos encadenados, con mezcla suave."""
    s = [1.0] + [suavizar(j - d, j + d, t) for j, d in zip(juntas, suaves)] + [0.0]
    return {n: max(0.0, s[i] - s[i + 1]) for i, n in enumerate(nombres)}


def pesos_de(v, tag):
    if tag in ('pata.L', 'pata.R'):
        suf = tag[-2:]
        return cadena(-v.z, [-Z_CADERA, -Z_RODILLA, -Z_TOBILLO],
                      ['cadera', 'muslo' + suf, 'canilla' + suf, 'pie' + suf],
                      [0.055, 0.062, 0.048])
    if tag == 'pelvis':
        return cadena(v.z, [0.735, 0.950], ['cadera', 'espalda', 'pecho'], [0.060, 0.060])
    if tag == 'torso':
        return cadena(v.z, [0.730, 0.905, 1.062],
                      ['cadera', 'espalda', 'pecho', 'cuello'], [0.070, 0.070, 0.060])
    if tag in ('brazo.L', 'brazo.R'):
        lado = 1 if tag.endswith('.L') else -1
        suf = tag[-2:]
        s = (v - HOMBRO[lado]).dot(DIR_BRAZO[lado])
        return cadena(s, [0.030, L_BRAZO, L_ANTEBRAZO],
                      ['hombro' + suf, 'brazo' + suf, 'antebrazo' + suf, 'mano' + suf],
                      [0.058, 0.058, 0.038])
    if tag == 'cuello':
        return cadena(v.z, [1.128, 1.218], ['pecho', 'cuello', 'cabeza'], [0.048, 0.045])
    if tag == 'cabeza':
        return cadena(v.z, [1.180], ['cuello', 'cabeza'], [0.035])
    return {'cadera': 1.0}


# ------------------------------------------------------------- construccion
def construir():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    esc = bpy.context.scene
    esc.render.fps = 24
    esc.unit_settings.system = 'METRIC'

    C = armar_cuerpo()
    img = crear_atlas()

    me = bpy.data.meshes.new('Pedro')
    me.from_pydata([tuple(v) for v in C.pos], [], C.caras)
    me.update()

    capa = me.uv_layers.new(name='UVMap').data
    for poly, ranura in zip(me.polygons, C.ranuras):
        for li in poly.loop_indices:
            capa[li].uv = uv_de(ranura, C.grad[me.loops[li].vertex_index])

    mat = bpy.data.materials.new('pedro')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Metallic'].default_value = 0.0
    me.materials.append(mat)

    obj = bpy.data.objects.new('Pedro', me)
    esc.collection.objects.link(obj)

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(48))
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)

    # --- esqueleto ----------------------------------------------------------
    arm = bpy.data.armatures.new('esqueleto')
    rig = bpy.data.objects.new('Pedro_rig', arm)
    esc.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for nombre, cabeza, cola, padre, pegado in huesos():
        eb = arm.edit_bones.new(nombre)
        eb.head, eb.tail = cabeza, cola
        if padre:
            eb.parent = arm.edit_bones[padre]
            eb.use_connect = pegado
    bpy.ops.object.mode_set(mode='OBJECT')

    # --- pesos --------------------------------------------------------------
    grupos = {h.name: obj.vertex_groups.new(name=h.name) for h in arm.bones}
    for i, (v, tag) in enumerate(zip(C.pos, C.tag)):
        w = {k: p for k, p in pesos_de(v, tag).items() if p > 0.004}
        total = sum(w.values()) or 1.0
        for nombre, p in w.items():
            grupos[nombre].add([i], p / total, 'REPLACE')

    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    mod = obj.modifiers.new('Esqueleto', 'ARMATURE')
    mod.object = rig

    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    return obj, rig


# ------------------------------------------------------------- animaciones
def girar(pb, rx, ry, rz):
    """Rota el hueso usando ejes del mundo (X=adelante/atras, Y=afuera, Z=giro)."""
    M = pb.bone.matrix_local.to_3x3()
    R = Matrix.Rotation(rz, 3, 'Z') @ Matrix.Rotation(ry, 3, 'Y') @ Matrix.Rotation(rx, 3, 'X')
    pb.rotation_quaternion = (M.inverted() @ R @ M).to_quaternion()


def desplazar(pb, d):
    pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(d)


def aplicar(rig, pose):
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = (0, 0, 0)
    for nombre, val in pose.items():
        pb = rig.pose.bones[nombre]
        girar(pb, val[0], val[1], val[2])
        if len(val) > 3:
            desplazar(pb, val[3])


def nueva_accion(rig, nombre):
    acc = bpy.data.actions.new(nombre)
    acc.use_fake_user = True
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = acc
    try:  # Blender 4.4+ usa "slots" dentro de la accion
        if hasattr(acc, 'slots') and rig.animation_data.action_slot is None:
            rig.animation_data.action_slot = acc.slots.new(id_type='OBJECT', name='rig')
    except Exception:
        pass
    return acc


def grabar(rig, nombre, cuadros):
    acc = nueva_accion(rig, nombre)
    for f, pose in cuadros:
        bpy.context.scene.frame_set(f)
        aplicar(rig, pose)
        for pb in rig.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=f)
            pb.keyframe_insert('location', frame=f)
    try:
        acc.use_frame_range = True
        acc.frame_start, acc.frame_end = cuadros[0][0], cuadros[-1][0]
    except Exception:
        pass
    rig.animation_data.action = None
    return acc


BRAZO_PEGADO = 0.25     # acerca los brazos al cuerpo (la pose A los deja muy abiertos)


def pose_base(mezcla=1.0):
    """Postura de reposo: pose A pero con los brazos mas pegados al cuerpo."""
    p = {}
    for lado, suf in ((1, '.L'), (-1, '.R')):
        p['brazo' + suf] = (0.02, lado * BRAZO_PEGADO * mezcla, 0.0)
        p['antebrazo' + suf] = (-0.10 * mezcla, lado * 0.06 * mezcla, 0.0)
        p['mano' + suf] = (-0.04 * mezcla, 0.0, 0.0)
    p['espalda'] = (0.02 * mezcla, 0, 0)
    return p


def anim_caminar():
    """Un ciclo completo (dos pasos) en el lugar. El juego le ajusta la velocidad."""
    cuadros = []
    for f in range(1, 26, 2):
        phi = TAU * (f - 1) / 24.0
        p = pose_base()
        for lado, suf in ((1, '.L'), (-1, '.R')):
            ph = phi if lado > 0 else phi + math.pi
            s, c = math.sin(ph), math.cos(ph)
            muslo = -0.60 * s
            canilla = 0.10 + 0.72 * max(0.0, c) ** 1.5
            p['muslo' + suf] = (muslo, lado * 0.02, 0)
            p['canilla' + suf] = (canilla, 0, 0)
            p['pie' + suf] = (-0.72 * (muslo + canilla) + 0.10, 0, 0)
            p['brazo' + suf] = (0.46 * s, lado * BRAZO_PEGADO, 0)
            p['antebrazo' + suf] = (-0.20 - 0.26 * max(0.0, -s), lado * 0.06, 0)
            p['mano' + suf] = (-0.06, 0, 0)
        s = math.sin(phi)
        p['cadera'] = (0.03, 0, -0.11 * s, (-0.013 * s, 0, 0.018 * math.cos(2 * phi)))
        p['espalda'] = (0.075, 0, 0.05 * s)
        p['pecho'] = (0.02, 0, 0.09 * s)
        p['cuello'] = (-0.04, 0, -0.05 * s)
        p['cabeza'] = (-0.05, 0, -0.07 * s)
        cuadros.append((f, p))
    return cuadros


def anim_quieto():
    """Respiracion lenta y cabeceo, 4 segundos que enganchan sin salto."""
    cuadros = []
    for f in range(1, 98, 6):
        t = (f - 1) / 24.0
        a = TAU * t / 4.0        # ciclo largo: peso del cuerpo
        b = TAU * t / 2.0        # ciclo corto: respiracion
        p = pose_base()
        p['cadera'] = (0.03, 0, 0.030 * math.sin(a), (0.007 * math.sin(a), 0, 0.006 * math.sin(b + math.pi)))
        p['espalda'] = (0.028 + 0.022 * math.sin(b), 0, -0.018 * math.sin(a))
        p['pecho'] = (-0.014 * math.sin(b), 0, -0.012 * math.sin(a))
        p['cuello'] = (-0.02 - 0.010 * math.sin(b), 0, -0.04 * math.sin(a))
        p['cabeza'] = (-0.03 + 0.026 * math.sin(b + 1.0), 0.03 * math.sin(a + 0.6), 0.10 * math.sin(a))
        for lado, suf in ((1, '.L'), (-1, '.R')):
            p['brazo' + suf] = (0.03 * math.sin(b + 0.6), lado * (BRAZO_PEGADO + 0.03 * math.sin(b)), 0)
            p['antebrazo' + suf] = (-0.12 + 0.03 * math.sin(b + 1.2), lado * 0.07, 0)
            p['mano' + suf] = (-0.05, 0, 0)
        cuadros.append((f, p))
    return cuadros


def anim_sorpresa():
    """Sobresalto sostenido: se queda en la pose con un temblor chico, y engancha."""
    cuadros = []
    for f in range(1, 38, 3):
        t = (f - 1) / 36.0
        tem = math.sin(TAU * t) * 0.5 + math.sin(2 * TAU * t) * 0.5
        p = {}
        for lado, suf in ((1, '.L'), (-1, '.R')):
            p['brazo' + suf] = (-0.95 + 0.05 * tem, lado * (0.14 + 0.03 * tem), lado * 0.10)
            p['antebrazo' + suf] = (-1.15 - 0.07 * tem, lado * 0.34, 0)
            p['mano' + suf] = (-0.18, lado * 0.12, 0)
        p['cadera'] = (0.12, 0, 0, (0, 0.012, -0.030 + 0.006 * tem))
        p['espalda'] = (-0.24 - 0.02 * tem, 0, 0)
        p['pecho'] = (-0.13, 0, 0)
        p['cuello'] = (-0.15, 0, 0.03 * tem)
        p['cabeza'] = (-0.13 - 0.03 * tem, 0, 0.05 * tem)
        for lado, suf in ((1, '.L'), (-1, '.R')):
            p['muslo' + suf] = (0.16, lado * 0.05, 0)
            p['canilla' + suf] = (0.24, 0, 0)
            p['pie' + suf] = (-0.30, 0, 0)
        cuadros.append((f, p))
    return cuadros


# ---------------------------------------------------------------- exportar
def exportar(ruta):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    deseados = dict(
        filepath=ruta, export_format='GLB', use_selection=False,
        export_apply=True, export_yup=True,
        export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_optimize_animation_size=False,
        export_bake_animation=False, export_nla_strips=False,
        export_anim_single_armature=True, export_rest_position_armature=True,
        export_skins=True, export_materials='EXPORT', export_image_format='AUTO',
        export_texcoords=True, export_normals=True, export_cameras=False,
        export_lights=False, export_extras=False, export_morph=False,
    )
    validos = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    bpy.ops.export_scene.gltf(**{k: v for k, v in deseados.items() if k in validos})


def revisar_glb(ruta, esperados):
    """Lee el GLB, corrige los nombres de los clips si vienen con prefijo y resume."""
    datos = open(ruta, 'rb').read()
    pos, trozos = 12, []
    while pos < len(datos):
        largo, tipo = struct.unpack_from('<II', datos, pos)
        trozos.append((tipo, pos + 8, largo))
        pos += 8 + largo
    tipo, ini, largo = trozos[0]
    doc = json.loads(datos[ini:ini + largo].decode('utf-8'))

    cambios = False
    nombres = [a.get('name', '') for a in doc.get('animations', [])]
    for a in doc.get('animations', []):
        corto = a.get('name', '').split('|')[-1]
        if corto in esperados and a.get('name') != corto:
            a['name'] = corto
            cambios = True
    if cambios:
        crudo = json.dumps(doc, separators=(',', ':')).encode('utf-8')
        crudo += b' ' * ((4 - len(crudo) % 4) % 4)
        resto = b''
        for tipo, ini, largo in trozos[1:]:
            resto += struct.pack('<II', largo, tipo) + datos[ini:ini + largo]
        cuerpo = struct.pack('<II', len(crudo), 0x4E4F534A) + crudo + resto
        with open(ruta, 'wb') as f:
            f.write(struct.pack('<4sII', b'glTF', 2, 12 + len(cuerpo)) + cuerpo)

    cuentas = []
    for m in doc.get('meshes', []):
        for p in m['primitives']:
            acc = doc['accessors'][p['indices']]
            cuentas.append(acc['count'] // 3)
    return {
        'clips': [a.get('name') for a in doc.get('animations', [])],
        'clips_previos': nombres,
        'triangulos': sum(cuentas),
        'imagenes': len(doc.get('images', [])),
        'kb': round(len(datos) / 1024),
    }


# ------------------------------------------------------------------ render
def render_control(obj, rig, carpeta):
    """Imagenes rapidas de control con el motor Workbench (anda sin placa de video)."""
    os.makedirs(carpeta, exist_ok=True)
    esc = bpy.context.scene
    esc.render.engine = 'BLENDER_WORKBENCH'
    esc.render.resolution_x, esc.render.resolution_y = 420, 760
    esc.render.film_transparent = False
    esc.world = bpy.data.worlds.new('mundo')
    esc.world.color = (0.30, 0.31, 0.34)
    esc.view_settings.view_transform = 'Standard'  # colores tal cual, sin filtro
    sh = esc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_shadows = True
    sh.show_cavity = False

    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.1
    cam = bpy.data.objects.new('cam', cam_data)
    esc.collection.objects.link(cam)
    esc.camera = cam

    def tomar(nombre, az, el=0.12, accion=None, cuadro=1):
        if accion:
            rig.animation_data.action = bpy.data.actions[accion]
            try:
                rig.animation_data.action_slot = bpy.data.actions[accion].slots[0]
            except Exception:
                pass
            esc.frame_set(cuadro)
        else:
            rig.animation_data.action = None
            esc.frame_set(1)
            aplicar(rig, {})
        d = 4.0
        cam.location = V(math.sin(az) * math.cos(el) * d, -math.cos(az) * math.cos(el) * d,
                         0.88 + math.sin(el) * d)
        dirv = V(0, 0, 0.88) - cam.location
        cam.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
        esc.render.filepath = os.path.join(carpeta, nombre + '.png')
        bpy.ops.render.render(write_still=True)

    tomar('01_frente', 0.0)
    tomar('02_tres_cuartos', math.radians(38))
    tomar('03_perfil', math.radians(90))
    tomar('04_espalda', math.radians(180))
    tomar('05_caminar', math.radians(28), accion='walk', cuadro=7)
    tomar('06_caminar_b', math.radians(28), accion='walk', cuadro=19)
    tomar('07_quieto', math.radians(20), accion='idle', cuadro=25)
    tomar('08_sorpresa', math.radians(28), accion='surprised', cuadro=13)
    rig.animation_data.action = None


# -------------------------------------------------------------------- main
def main():
    obj, rig = construir()
    grabar(rig, 'walk', anim_caminar())
    grabar(rig, 'idle', anim_quieto())
    grabar(rig, 'surprised', anim_sorpresa())
    aplicar(rig, {})
    bpy.context.scene.frame_set(1)

    caras = len(obj.data.polygons)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f'[pedro] vertices={len(obj.data.vertices)} caras={caras} triangulos={tris}')

    exportar(SALIDA)
    info = revisar_glb(SALIDA, {'walk', 'idle', 'surprised'})
    print('[pedro] GLB:', json.dumps(info, ensure_ascii=False))

    if RENDER_DIR:
        render_control(obj, rig, RENDER_DIR)
        print('[pedro] renders en', RENDER_DIR)


main()
