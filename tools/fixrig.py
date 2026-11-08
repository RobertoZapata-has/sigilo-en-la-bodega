# Referencia: así se generó assets/modelos/pedro_animado_actual.glb (necesita playwright y three@0.128 en npmthree/).
import asyncio, base64, json
from playwright.async_api import async_playwright

BASE = "npmthree/node_modules/three/"
LIBS = "".join(f"<script>{open(BASE + f).read()}</script>" for f in [
    "build/three.min.js", "examples/js/libs/fflate.min.js",
    "examples/js/loaders/FBXLoader.js", "examples/js/exporters/GLTFExporter.js"])
b64 = lambda p: base64.b64encode(open(p, "rb").read()).decode()

JS = r"""
(async () => {
const FB = { walk: '%WALK%', idle: '%IDLE%', surprised: '%SURP%' };
const buf = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
const L = new THREE.FBXLoader();
const objs = {}; for (const k in FB) objs[k] = L.parse(buf(FB[k]), '');
const base = objs.walk;
let mesh = null; base.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
const bones = mesh.skeleton.bones;
const report = { bonesMatch: {} };
for (const k of ['idle', 'surprised']) {
  const names = new Set(); objs[k].traverse(o => { if (o.isBone) names.add(o.name); });
  report.bonesMatch[k] = bones.every(b => names.has(b.name));
}
const clips = ['walk', 'idle', 'surprised'].map(k => { const c = objs[k].animations[0].clone(); c.name = k; return c; });

// --- detectar triángulos que se estiran (la lámina entre los zapatos) ---
const geo = mesh.geometry;
const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
const nTri = pos.count / 3;
const comp = (a, i, j) => a.array[i * a.itemSize + j];
const side = i => { // lado de la pierna dominante del vértice
  let best = -1, bw = 0;
  for (let j = 0; j < 4; j++) { const w = comp(sw, i, j); if (w > bw) { bw = w; best = comp(si, i, j); } }
  const n = bones[best].name;
  if (/Left(UpLeg|Leg|Foot|ToeBase|Toe_End)/.test(n)) return 'L';
  if (/Right(UpLeg|Leg|Foot|ToeBase|Toe_End)/.test(n)) return 'R';
  return 'C';
};
const sides = new Array(pos.count); for (let i = 0; i < pos.count; i++) sides[i] = side(i);
const restEdge = new Float32Array(nTri);
const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const maxEdge = vv => Math.max(vv[0].distanceTo(vv[1]), vv[1].distanceTo(vv[2]), vv[2].distanceTo(vv[0]));
for (let t = 0; t < nTri; t++) { for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(pos, t * 3 + j); restEdge[t] = maxEdge(v); }
// pesos: debajo de la entrepierna, cada vértice sigue solo a la pierna de su lado
const idxOf = n => bones.findIndex(b => b.name.endsWith(n));
const chain = side => ['UpLeg', 'Leg', 'Foot', 'ToeBase', 'Toe_End'].map(n => idxOf(side + n)).filter(k => k >= 0);
const LC = chain('Left'), RC = chain('Right');
let lx = 0, ln = 0;
for (let i = 0; i < pos.count; i++) if (sides[i] === 'L' && pos.getY(i) < 0.1 * %HEIGHT%) { lx += pos.getX(i); ln++; }
const leftIsPos = lx / Math.max(ln, 1) > 0;
const crotch = 0.3 * %HEIGHT%;
let fixedW = 0;
for (let i = 0; i < pos.count; i++) {
  const y = pos.getY(i), x = pos.getX(i);
  if (y > crotch) continue;
  const mine = (x > 0) === leftIsPos ? LC : RC, other = mine === LC ? RC : LC;
  const ws = [0, 1, 2, 3].map(j => [comp(si, i, j), comp(sw, i, j)]);
  let changed = false;
  for (const p of ws) if (other.includes(p[0]) && p[1] > 0) { p[1] = 0; changed = true; }
  let tot = ws.reduce((a, p) => a + p[1], 0);
  if (tot < 1e-4) { // asignar al hueso más cercano en altura de su propia pierna
    const k = y < 0.07 * %HEIGHT% ? mine[2] : y < 0.17 * %HEIGHT% ? mine[1] : mine[0];
    ws[0] = [k, 1]; ws[1] = [k, 0]; ws[2] = [k, 0]; ws[3] = [k, 0]; tot = 1; changed = true;
  }
  if (changed) {
    fixedW++;
    for (let j = 0; j < 4; j++) { si.array[i * 4 + j] = ws[j][0]; sw.array[i * 4 + j] = ws[j][1] / tot; }
  }
}

si.needsUpdate = sw.needsUpdate = true;
report.leftIsPos = leftIsPos; report.fixedWeights = fixedW;
const stretch = new Float32Array(nTri);
const mixer = new THREE.AnimationMixer(base);
for (const clip of clips) {
  const a = mixer.clipAction(clip); a.play();
  for (let s = 0; s < 24; s++) {
    mixer.setTime(clip.duration * s / 24); base.updateMatrixWorld(true);
    for (let t = 0; t < nTri; t++) {
      for (let j = 0; j < 3; j++) { v[j].fromBufferAttribute(pos, t * 3 + j); mesh.boneTransform(t * 3 + j, v[j]); }
      const r = maxEdge(v) / Math.max(restEdge[t], 1e-5);
      if (r > stretch[t]) stretch[t] = r;
    }
  }
  a.stop();
}
const keep = [];
let cutSide = 0, cutStretch = 0;
for (let t = 0; t < nTri; t++) {
  let y = 0, hasP = false, hasN = false;
  for (let j = 0; j < 3; j++) { const k = t * 3 + j; y = Math.max(y, pos.getY(k)); if (pos.getX(k) > 0) hasP = true; else hasN = true; }
  if (y < 0.07 * %HEIGHT% && hasP && hasN) { cutSide++; continue; }
  if (y < 0.05 * %HEIGHT% && stretch[t] > 3) { cutStretch++; continue; }
  keep.push(t);
}
report.tris = nTri; report.cutSide = cutSide; report.cutStretch = cutStretch;

// --- geometría nueva con solo los triángulos que quedan ---
const ng = new THREE.BufferGeometry();
for (const name of ['position', 'uv', 'skinIndex', 'skinWeight']) {
  const src = geo.attributes[name]; if (!src) continue;
  const arr = new src.array.constructor(keep.length * 3 * src.itemSize);
  keep.forEach((t, k) => { for (let j = 0; j < 3; j++) for (let c = 0; c < src.itemSize; c++) arr[(k * 3 + j) * src.itemSize + c] = src.array[(t * 3 + j) * src.itemSize + c]; });
  ng.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize, src.normalized));
}
ng.computeVertexNormals();
const tex = await new Promise(r => new THREE.TextureLoader().load('data:image/jpeg;base64,%TEX%', r));
tex.encoding = THREE.sRGBEncoding; tex.flipY = true; tex.format = THREE.RGBFormat;
mesh.geometry = ng;
mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, skinning: true });
mesh.name = 'Pedro';

// --- vistas de control ---
const R = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
R.setClearColor(0xd8d4cc); R.outputEncoding = THREE.sRGBEncoding; R.setScissorTest(true);
const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.0));
const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(1, 2, 3); sc.add(dl); sc.add(base);
const H = %HEIGHT%;
let col = 0;
for (const clip of clips) {
  const a = mixer.clipAction(clip); a.play();
  for (const [f, az] of [[0.12, 0.3], [0.37, 1.57], [0.62, 0.3], [0.87, 1.57]]) {
    mixer.setTime(clip.duration * f); base.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(30, 150 / 330, 0.01, 50);
    cam.position.set(Math.sin(az) * H * 2.8, H * 0.6, Math.cos(az) * H * 2.8); cam.lookAt(0, H * 0.45, 0);
    R.setViewport(col * 150, 0, 150, 330); R.setScissor(col * 150, 0, 150, 330); R.render(sc, cam); col++;
  }
  a.stop();
}
mixer.stopAllAction(); mixer.setTime(0);
for (const b of bones) { /* pose de descanso al exportar */ }
base.animations = clips;

// --- exportar GLB con las tres animaciones ---
const glb = await new Promise(r => new THREE.GLTFExporter().parse(base, r, { binary: true, animations: clips, onlyVisible: true, embedImages: true }));
const bytes = new Uint8Array(glb); let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
window.glb = btoa(s);
window.report = report;
})().catch(e => { window.report = { error: String(e && e.stack || e) }; });
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 1800, "height": 330})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        js = (JS.replace('%WALK%', b64('fbx_in/walk.fbx')).replace('%IDLE%', b64('fbx_in/idle.fbx'))
                .replace('%SURP%', b64('fbx_in/surprised.fbx')).replace('%TEX%', b64('obj_out/pedro_tex_1024.jpg'))
                .replace('%HEIGHT%', '1.0'))
        await pg.set_content(f'<html><body style="margin:0"><canvas id=c width=1800 height=330></canvas>{LIBS}<script>{js}</script></body></html>')
        await pg.wait_for_function("window.report", timeout=240000)
        rep = await pg.evaluate("window.report")
        print(json.dumps(rep), errs[:3])
        await pg.screenshot(path="rig_check.png")
        g = await pg.evaluate("window.glb || ''")
        if g:
            open("pedro_animado.glb", "wb").write(base64.b64decode(g))
        await b.close()

asyncio.run(main())
