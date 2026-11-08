// ===== JUEGO: escena 3D, animaciones y controles =====
const $ = s => document.querySelector(s);
const SP = 2;                // distancia entre puntos del tablero
const MARGIN = 1.5;          // borde de la maqueta alrededor de los puntos
const FIG = 1.22;            // tamaño de los personajes sobre el tablero
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Verificación previa de todos los niveles con el resolvedor
const VERIFIED = LEVELS.map(d => {
  const lv = parseLevel(d);
  const r = solve(lv, lv.s0);
  return { min: r && r.path ? r.path.length : null, explored: r ? r.explored : 0 };
});

let best = {};
try { best = JSON.parse(localStorage.getItem('sigilo-best') || '{}') || {}; } catch (e) { best = {}; }
const saveBest = () => { try { localStorage.setItem('sigilo-best', JSON.stringify(best)); } catch (e) {} };

// ---------- Escena ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
const hemi = new THREE.HemisphereLight(0xdde4ff, 0x3b3044, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 0.85);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.radius = 3;
scene.add(sun, sun.target);

const M = {
  sides: new THREE.MeshStandardMaterial({ color: 0x3f4a63, roughness: 0.95 }),
  top: new THREE.MeshStandardMaterial({ color: 0x5b6782, roughness: 0.95 }),
  path: new THREE.MeshStandardMaterial({ color: 0xebe4d4, roughness: 0.75 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xbdb5a5, roughness: 0.9 }),
  player: new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.45 }),
  playerBand: new THREE.MeshStandardMaterial({ color: 0xe6b450, roughness: 0.35, metalness: 0.3 }),
  enemy: new THREE.MeshStandardMaterial({ color: 0x8a2846, roughness: 0.5 }),
  nose: new THREE.MeshStandardMaterial({ color: 0xe5574a, roughness: 0.4, emissive: 0x401010 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe6b450, roughness: 0.3, metalness: 0.45, emissive: 0x4a3200 }),
  danger: new THREE.MeshBasicMaterial({ color: 0xe5574a, transparent: true, opacity: 0.9, depthWrite: false }),
  dangerNext: new THREE.MeshBasicMaterial({ color: 0xffb3a8, transparent: true, opacity: 0.38, depthWrite: false }),
  route: new THREE.MeshBasicMaterial({ color: 0xe5574a, transparent: true, opacity: 0.35, depthWrite: false }),
  reach: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
  hint: new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.95, depthWrite: false }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
};

const G = {
  pawnBody: new THREE.LatheGeometry([
    [0, 0], [0.4, 0], [0.42, 0.05], [0.4, 0.12], [0.28, 0.17], [0.2, 0.3],
    [0.15, 0.58], [0.25, 0.63], [0.25, 0.68], [0.14, 0.72], [0, 0.72],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 28),
  head: new THREE.SphereGeometry(0.21, 24, 16),
  band: new THREE.TorusGeometry(0.2, 0.035, 8, 24),
  nose: new THREE.ConeGeometry(0.075, 0.22, 12),
  node: new THREE.CylinderGeometry(0.3, 0.32, 0.07, 28),
  nodeWide: new THREE.CylinderGeometry(0.44, 0.46, 0.07, 28),
  hitArea: new THREE.CylinderGeometry(0.95, 0.95, 0.6, 12),
  ring: new THREE.RingGeometry(0.52, 0.62, 36),
  dangerRing: new THREE.RingGeometry(0.33, 0.47, 36),
  dot: new THREE.CircleGeometry(0.1, 16),
  goal: new THREE.TorusGeometry(0.36, 0.075, 12, 36),
  goalDisc: new THREE.CylinderGeometry(0.22, 0.22, 0.05, 24),
};
const tri = new THREE.Shape();
tri.moveTo(0, 0.2); tri.lineTo(-0.17, -0.12); tri.lineTo(0.17, -0.12); tri.lineTo(0, 0.2);
G.arrow = new THREE.ShapeGeometry(tri);

// ---------- Estado de la partida ----------
let decorTick = null, TDEC = null, crateMeshes = new Map(), itemMeshes = new Map(), throwMode = false;
let LVD = {}, idx = 0, LV, state, hist = [], busy = false, hintKey = null;
let charKind = null;
try { charKind = localStorage.getItem('sigilo-char'); } catch (e) {}
if (!CHARS.PAL[charKind] || !CHARS.PAL[charKind].ring) charKind = null;
const Y = new THREE.Vector3(0, 1, 0);
const chOf = o => o.userData.ch;
let board = null, markers = null, player = null, enemyMeshes = [], hitMeshes = [], goalMesh = null, finale = null;
let center = [0, 0], ext = { x0: 0, x1: 0, z0: 0, z1: 0 }, graveCount = 0;

const hOf = k => (LVD.heights && LVD.heights[k]) || 0;
const wp = k => { const [x, y] = P(k); return new THREE.Vector3(x * SP - center[0], hOf(k), y * SP - center[1]); };
const toW = (gx, gy) => new THREE.Vector3(gx * SP - center[0], 0, gy * SP - center[1]);
const angleOf = (dx, dz) => Math.atan2(dx, dz);

function disposeGroup(g) {
  if (!g) return;
  scene.remove(g);
  g.traverse(o => { if (o.geometry && !o.geometry.userData.keep && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); });
}

function levelLabel(i) {
  const d = LEVELS[i], who = chOf(player).name;
  return d.chapter ? `${d.chapter.split(' · ')[0]} · ${i + 1} de ${LEVELS.length} · ${who}` : `Nivel ${i + 1} de ${LEVELS.length} · ${who}`;
}
function buildLevel(i, opts = {}) {
  idx = i;
  LVD = LEVELS[i];
  LV = parseLevel(LVD);
  state = LV.s0; hist = []; hintKey = null; graveCount = 0; hitMeshes = [];
  ZONES = LVD.zones || [];   // la cámara sigue al jugador en todos los niveles
  disposeGroup(board); disposeGroup(markers);
  board = new THREE.Group(); markers = new THREE.Group();
  scene.add(board, markers);

  const xs = [...LV.nodes.values()].map(n => n.x), ys = [...LV.nodes.values()].map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const m0 = MARGIN / SP, pad = LVD.pad || { l: m0, r: m0, t: m0, b: m0 };
  const gx0 = minX - pad.l, gx1 = maxX + pad.r, gy0 = minY - pad.t, gy1 = maxY + pad.b;
  center = [(gx0 + gx1) / 2 * SP, (gy0 + gy1) / 2 * SP];
  const w = (gx1 - gx0) * SP, d = (gy1 - gy0) * SP;
  const themed = !!LVD.theme;
  ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2, yTop: LVD.theme === 'anden' || LVD.theme === 'tren' || LVD.theme === 'playa' ? 2.9 : themed ? 2.3 : 1.2, yBot: themed ? -1.6 : -0.7 };

  // Maqueta
  if (themed) {
    board.add(DECOR.rockBlock(w, d, 1.5));
    board.add(DECOR.ground(w, d));
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), [M.sides, M.sides, M.top, M.sides, M.sides, M.sides]);
    base.position.y = -0.35;
    base.receiveShadow = true;
    board.add(base);
  }
  // hora del día: cambia el cielo (CSS) y la luz
  const SKY = {
    tarde: { hemi: [0xffe0c2, 0x5a4636, 0.85], sun: [0xffb070, 1.05] },
    anochecer: { hemi: [0xd8c4e8, 0x463a4c, 0.72], sun: [0xff9a7a, 0.75] },
    noche: { hemi: [0xdde4ff, 0x3b3044, 0.62], sun: [0xc9d4ff, 0.55] },
    luna: { hemi: [0xc4d2ff, 0x2c2a3e, 0.66], sun: [0xc8d8ff, 0.7] },
    alba: { hemi: [0xffd9d2, 0x4a3a52, 0.8], sun: [0xffa58a, 0.95] },
    dia: { hemi: [0xf4ecdc, 0x5a4c3c, 0.74], sun: [0xfff0d4, 1.0] },
  };
  const sky = LVD.sky || (themed ? 'noche' : 'dia');
  $('#stage').dataset.sky = sky;
  M.stone.color.set(sky === 'dia' ? 0x9c9282 : sky === 'tarde' ? 0xb1a795 : 0xbdb5a5);   // de día los caminos encandilan
  const L = SKY[sky];
  if (L) { hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; }
  else { hemi.color.set(0xdde4ff); hemi.groundColor.set(0x3b3044); hemi.intensity = 0.8; sun.color.set(0xfff0d8); sun.intensity = 0.85; }

  // Caminos
  const done = new Set();
  for (const [a, ns] of LV.adj) for (const b of ns) {
    const id = a < b ? a + '|' + b : b + '|' + a;
    if (done.has(id)) continue; done.add(id);
    const pa = wp(a), pb = wp(b);
    if (pa.y > 0.01 || pb.y > 0.01) continue;
    const horiz = Math.abs(pa.x - pb.x) > 0.1, pw = themed ? 0.62 : 0.16;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(horiz ? SP : pw, 0.05, horiz ? pw : SP), themed ? M.stone : M.path);
    seg.position.set((pa.x + pb.x) / 2, 0.025, (pa.z + pb.z) / 2);
    seg.receiveShadow = true;
    board.add(seg);
  }
  // Puntos
  for (const k of LV.nodes.keys()) {
    const p = wp(k);
    if (k === LV.goal) {
      goalMesh = new THREE.Group();
      const ring = new THREE.Mesh(G.goal, M.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
      const disc = new THREE.Mesh(G.goalDisc, M.gold); disc.position.y = 0.03;
      goalMesh.add(ring, disc); goalMesh.position.copy(p);
      ring.castShadow = true;
      board.add(goalMesh);
    } else {
      if (p.y < 0.01) {
        const n = new THREE.Mesh(themed ? G.nodeWide : G.node, themed ? M.stone : M.path); n.position.set(p.x, 0.035, p.z); n.receiveShadow = true;
        board.add(n);
      }
    }
    const h = new THREE.Mesh(G.hitArea, M.hit); h.position.set(p.x, p.y + 0.3, p.z); h.userData.k = k;
    board.add(h); hitMeshes.push(h);
  }

  CHARS.release(player); enemyMeshes.forEach(CHARS.release);
  decorTick = null; TDEC = null;
  if (finale) { CHARS.release(finale.zorro); CHARS.release(finale.corona); } finale = null;
  if (LVD.theme === 'bodega') DECOR.bodega(board, toW, SP);
  if (LVD.theme === 'finca') DECOR.finca(board, toW, SP, LV, [gx0, gy0, gx1, gy1], LVD.extra);
  if (LVD.theme === 'anden') decorTick = DECOR.anden(board, toW, SP).update;
  if (LVD.theme === 'tren' || LVD.theme === 'playa') { TDEC = TREN.build(LVD.scene, board, toW, SP, LV, LVD, [gx0, gy0, gx1, gy1]); decorTick = TDEC.update; }
  // cajones que se empujan y piedras para juntar
  crateMeshes = new Map(); itemMeshes = new Map(); throwMode = false;
  for (const k of state.crates) { const c = TREN.crateMesh(); c.position.copy(wp(k)); c.rotation.y = (P(k)[0] * 7 + P(k)[1] * 3) % 4 * 0.06; board.add(c); crateMeshes.set(k, c); }
  for (const k of state.items) { const st = TREN.stonePile(); st.position.copy(wp(k)); board.add(st); itemMeshes.set(k, st); }
  updateStoneBtn();
  player = CHARS.build(charKind || 'pedro');
  player.scale.setScalar(FIG);
  player.userData.face = 0;
  board.add(player);
  $('.legend .me').style.background = '#' + new THREE.Color(chOf(player).color).getHexString();
  const kindOf = e => e.t === 'dog' ? 'perro' : e.t !== 'sentry' ? 'sereno' : e.turn ? (CHARS.has('vigia') ? 'vigia' : 'guarda') : (e.range || 1) === 1 ? 'vigia' : 'sereno';
  enemyMeshes = state.en.map(e => { const m = CHARS.build(kindOf(e)); m.scale.setScalar(FIG); board.add(m); return m; });
  // barricas en los puntos que sirven de escondite
  for (const k of LV.cover) DECOR.coverSpot(board, wp(k), LVD.theme === 'tren' ? 'tren' : null);

  // Sol y sombras según el tamaño del tablero
  const R = Math.max(w, d);
  sun.position.set(-R * 0.6, R * (sky === 'tarde' || sky === 'alba' ? 0.7 : sky === 'anochecer' ? 1.0 : 1.6), R * 0.9);
  sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.1, far: R * 5 });
  sun.shadow.camera.updateProjectionMatrix();

  placeFinale();
  snap();
  fitCamera();
  introCamera();
  // Interfaz
  $('#lvNum').textContent = levelLabel(i);
  $('#lvName').textContent = LV.name;
  $('#tipTxt').textContent = LV.tip;
  $('#tip').hidden = false; $('#tip').style.opacity = 1;
  hideOverlays();
  if (LVD.intro && !opts.noIntro) {
    const [cNum, cName] = LVD.chapter.split(' · ');
    $('#chapNum').textContent = cNum;
    $('#chapTitle').textContent = cName || LVD.name;
    $('#chapTxt').textContent = LVD.intro;
    setChapArt(LVD.art);
    $('#postal').hidden = true;
    $('#chapBox').hidden = false;
  } else if (!opts.noIntro) showPostal();
  delete $('#winBox').dataset.outroShown;
  fitCamera();
  updateHud();
}

// Coloca todo según el estado, sin animar (para deshacer y reiniciar)
function snap() {
  graveCount = 0;
  player.position.copy(wp(state.p));
  player.quaternion.setFromAxisAngle(Y, player.userData.face || 0);
  chOf(player).mode = state.over === 'won' ? 'cheer' : 'idle';
  finaleMood();
  state.en.forEach((e, i) => {
    const m = enemyMeshes[i];
    if (e.alive) {
      tieUp(m, false);
      m.position.copy(wp(e.pos));
      const [dx, dz] = faceVec(LV, e);
      m.userData.face = angleOf(dx, dz);
      m.quaternion.setFromAxisAngle(Y, m.userData.face);
      chOf(m).mode = 'idle';
    } else {
      placeTied(m, i);
    }
  });
  // cajones y piedras donde dice el estado (al deshacer o reiniciar)
  if (crateMeshes.size) {
    const ms = [...crateMeshes.values()]; crateMeshes = new Map();
    state.crates.forEach((k, i) => { ms[i].position.copy(wp(k)); crateMeshes.set(k, ms[i]); });
  }
  itemMeshes.forEach((m, k) => { m.visible = state.items.includes(k); m.scale.setScalar(1); m.position.copy(wp(k)); });
  if (TDEC && TDEC.setLights) TDEC.setLights(state.moves, state.crates);
  throwMode = false; updateStoneBtn();
  if (state.over === 'caught') {
    const a = state.by === 'train' ? wp(state.p).add(new THREE.Vector3(-(LV.trains[state.train].dir || 1), 0, 0))
      : state.by === 'light' ? wp(LV.lights[state.light].beam[0]) : wp(state.en[state.by].pos), b = wp(state.p);
    chOf(player).mode = 'surprised';
    tipQuat(player, b.clone().sub(a).normalize(), 1, player.quaternion.clone());
  }
  if (TDEC) TDEC.setDoors(state.moves, false, tween);
  drawMarkers();
}

// Final del capítulo: la corona sobre la salida y el Zorro Funes al lado (solo si sus modelos cargaron)
function placeFinale() {
  const F = LVD.finale; if (!F || !board) return;
  finale = finale || {};
  if (!finale.corona && F.crown !== false && CHARS.has('corona')) {
    const c = CHARS.build('corona'); c.scale.setScalar(FIG);
    c.position.copy(wp(LV.goal)); c.position.y = 0.32;
    board.add(c); finale.corona = c;
  }
  if (!finale.zorro && CHARS.has('zorro')) {
    const z = CHARS.build('zorro'); z.scale.setScalar(FIG);
    z.position.copy(toW(F.zorro[0], F.zorro[1]));
    const [dx, dy] = DIRS[F.face || 'N']; z.quaternion.setFromAxisAngle(Y, angleOf(dx, dy));
    board.add(z); finale.zorro = z;
  }
  finaleMood();
}
function finaleMood() {
  if (!finale || !finale.zorro) return;
  chOf(finale.zorro).mode = state && state.over === 'won' ? 'surprised' : 'idle';
}
function graveSpot(n) {
  return new THREE.Vector3(ext.x0 + 1.0 + n * 1.6, 0.3, ext.z1 - MARGIN / 2);
}
function lyingQuat() { return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(Y, -Math.PI / 2)); }
function placeInGrave(m, n) { m.position.copy(graveSpot(n)); m.quaternion.copy(lyingQuat()); }
// Guardias noqueados: quedan atados y sentados en una esquina del punto donde cayeron, fuera del camino
const TIE_D = [[1, -1], [-1, 1], [-1, -1], [1, 1]];   // primero los costados vistos desde la cámara
function tiedSpot(i) {
  const e = state.en[i], used = new Set();
  state.en.forEach((o, j) => { if (j < i && !o.alive && o.pos === e.pos) used.add(j); });
  const n = [...used].length;                    // si cayeron dos en el mismo punto, el segundo va a otra esquina
  const [dx, dz] = TIE_D[n % 4];
  const p = wp(e.pos), off = 0.92;
  return { pos: new THREE.Vector3(p.x + dx * off, p.y, p.z + dz * off), ang: angleOf(dx, dz) };
}
function tieUp(m, on) {
  const ch = chOf(m);
  if (!m.userData.rope) {
    const rope = new THREE.Group(), mt = new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 0.9 });
    [0.27, 0.36].forEach(y => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 20), mt); t.rotation.x = Math.PI / 2; t.position.set(0, y, -0.04); rope.add(t); });
    m.add(rope); m.userData.rope = rope;
  }
  m.userData.rope.visible = on && ch.model;
  // el farol del sereno se apaga cuando lo atan
  m.traverse(o => { if (o.isPointLight) o.visible = !on; if (o.name === 'Farol') o.visible = !on; });
}
function placeTied(m, i) {
  const t = tiedSpot(i), ch = chOf(m);
  m.position.copy(t.pos);
  if (ch.model) { m.quaternion.setFromAxisAngle(Y, t.ang); ch.mode = 'tied'; }
  else { m.quaternion.copy(lyingQuat()); ch.mode = 'down'; }
  tieUp(m, true);
}
function tipQuat(obj, dir, u, base) {
  const axis = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(axis, u * Math.PI / 2);
  obj.quaternion.copy(q.multiply(base || new THREE.Quaternion()));
}

// ---------- Marcadores ----------
// Cartelito redondo con un número o un símbolo (turnos que faltan para el tren o la puerta)
const BADGES = {};
function badge(text, bg, fg, kind) {
  const key = text + bg + fg + kind;
  if (!BADGES[key]) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fillStyle = bg; x.fill();
    x.lineWidth = 6; x.strokeStyle = '#d8b25e'; x.stroke();
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = (text.length > 1 && text !== '↔' ? '600 50px' : '700 62px') + ' "Barlow Condensed", Arial, sans-serif';
    x.fillText(text, 64, 68);
    if (kind === 'tren' || kind === 'apaga' || kind === 'prende') { x.font = '600 18px "Barlow Condensed", Arial'; x.fillText(kind.toUpperCase(), 64, 104); }
    const t = new THREE.CanvasTexture(cv);
    BADGES[key] = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
  }
  const s = new THREE.Sprite(BADGES[key]); s.scale.set(0.72, 0.72, 1); s.renderOrder = 5;
  return s;
}
function drawMarkers() {
  disposeGroup(markers);
  markers = new THREE.Group(); scene.add(markers);
  const flat = (geo, mat, p, y = 0.09) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(p.x, p.y + y, p.z); markers.add(m); return m; };

  for (const e of state.en) {
    if (!e.alive) continue;
    if (e.t === 'patrol') for (const k of e.route) if (k !== e.pos) flat(G.dot, M.route, wp(k), 0.08);
    if (e.t === 'dog') {
      // hasta dónde huele el perro y hasta dónde llega su cadena
      const dS = distances(LV, e.pos, state, e.smell + 1), dH = distances(LV, e.home, state, e.leash + 1);
      for (const [k, d] of dS) if (d > 0 && d <= e.smell) flat(G.dot, M.dangerNext, wp(k), 0.09).scale.setScalar(1.35);
      for (const [k, d] of dH) if (d === e.leash) flat(G.ring, M.route, wp(k), 0.085).scale.setScalar(0.55);
      continue;
    }
    const f = facing(LV, e), a = wp(e.pos);
    const nf = nextFacing(LV, e);
    if (nf && nf !== f) {
      const c = wp(nf);
      flat(G.dangerRing, M.dangerNext, c, 0.1);
      const g2 = new THREE.Group();
      const tr2 = new THREE.Mesh(G.arrow, M.dangerNext); tr2.rotation.x = -Math.PI / 2; g2.add(tr2);
      const ex = c.x - a.x, ez = c.z - a.z;
      g2.rotation.y = Math.atan2(-ex, -ez); g2.scale.setScalar(0.8);
      g2.position.set(a.x + ex * 0.55, a.y + 0.1, a.z + ez * 0.55);
      markers.add(g2);
    }
    if (!f) continue;
    const seen = sight(LV, e, state.moves, state);
    const b = wp(f);
    seen.forEach((k, i) => { const r = flat(G.dangerRing, M.danger, wp(k), 0.1); if (i) r.scale.setScalar(0.8); });
    if (!seen.length) flat(G.dot, M.danger, b, 0.1);   // la vista está tapada por una barrica
    const g = new THREE.Group();
    const tr = new THREE.Mesh(G.arrow, M.danger); tr.rotation.x = -Math.PI / 2; g.add(tr);
    const dx = b.x - a.x, dz = b.z - a.z;
    g.rotation.y = Math.atan2(-dx, -dz);
    g.position.set(a.x + dx * 0.55, a.y + 0.1, a.z + dz * 0.55);
    markers.add(g);
  }
  // vías: cuántos turnos faltan para que pase la próxima máquina
  (LV.trains || []).forEach(tr => {
    const n = trainIn(tr, state.moves), xs = [...tr.nodes].map(k => P(k)[0]);
    const p = toW(Math.min(...xs) - 0.72, tr.y); p.y = 0.75;
    const warn = n === 1 && !state.over;
    const sp = badge(String(n), warn ? '#e5574a' : '#efe3c8', warn ? '#fff' : '#2b2117', 'tren'); sp.position.copy(p); markers.add(sp);
    if (warn) for (const k of tr.nodes) flat(G.dangerRing, M.danger, wp(k), 0.1).scale.setScalar(0.7);
  });
  // faros: los que parpadean muestran en cuántos turnos cambian
  (LV.lights || []).forEach(l => {
    const lit = litNodes(LV, l, state.moves, state);
    for (const k of lit) flat(G.dangerRing, M.danger, wp(k), 0.1).scale.setScalar(0.7);
    if (!l.every) return;
    const on = lightOn(l, state.moves); let n = 1; while (n < l.every && lightOn(l, state.moves + n) === on) n++;
    const [x, y] = P(l.beam[0]), p = wp(l.beam[0]);
    const sp = badge(String(n), on ? '#e5574a' : '#efe3c8', on ? '#fff' : '#2b2117', on ? 'apaga' : 'prende'); sp.position.set(p.x, 1.25, p.z); markers.add(sp);
  });
  // tirar una piedra: los puntos a los que llega
  if (throwMode && !state.over && !busy) for (const k of throwTargets(LV, state)) {
    const r = flat(G.ring, M.hint, wp(k), 0.12); r.scale.setScalar(0.85);
  }
  // puertas: abiertas (verde) o cuántos turnos faltan para que se abran
  (LV.doors || []).forEach(d => {
    const a = wp(d.a), b = wp(d.b), open = doorOpen(d, state.moves);
    let n = 1; while (!open && n < d.every && !doorOpen(d, state.moves + n)) n++;
    const sp = badge(open ? '↔' : String(n), open ? '#5d9c6a' : '#7a1f36', '#fff', 'puerta');
    sp.position.set((a.x + b.x) / 2, 1.05, (a.z + b.z) / 2); markers.add(sp);
  });
  if (!state.over && !busy) {
    for (const k of LV.adj.get(state.p)) {
      if (!canPass(LV, state.p, k, state.moves)) continue;
      const r = flat(G.ring, k === hintKey ? M.hint : M.reach, wp(k), 0.11);
      r.userData.pulse = true;
      if (k === hintKey) r.userData.hint = true;
    }
  }
}

// ---------- Animación ----------
const tweens = [];
const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
function tween(ms, fn) {
  if (reduceMotion) ms = Math.min(ms, 60);
  return new Promise(res => tweens.push({ t0: performance.now(), ms, fn, res }));
}
const smooth = u => (1 - Math.cos(Math.PI * u)) / 2;
function turnTo(obj, ang, ms = 160) {
  const a0 = obj.userData.face || 0;
  let d = ang - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.userData.face = ang;
  if (Math.abs(d) < 0.01) { obj.quaternion.setFromAxisAngle(Y, ang); return Promise.resolve(); }
  return tween(ms, u => { obj.quaternion.setFromAxisAngle(Y, a0 + d * ease(u)); });
}
// Camina de un punto al otro: gira, da dos pasos y vuelve a quedarse quieto.
async function walkTo(obj, from, to, ms = 460) {
  const ch = chOf(obj);
  await turnTo(obj, angleOf(to.x - from.x, to.z - from.z), 120);
  ch.mode = 'walk'; ch.phase = 0; ch.stepRate = (2 * Math.PI) / (ms / 1000);
  const up = to.y > from.y;
  await tween(ms, u => {
    const s = smooth(u);
    obj.position.lerpVectors(from, to, s);
    if (from.y !== to.y) {
      const [c0, c1] = LVD.climb || [0, 0.36];
      const k = up ? Math.min(1, Math.max(0, (s - c0) / (c1 - c0))) : Math.min(1, Math.max(0, (s - (1 - c1)) / (c1 - c0)));
      obj.position.y = from.y + (to.y - from.y) * k;
    }
  });
  ch.mode = 'idle';
}
async function knockOut(m, dir, i) {
  chOf(m).mode = 'down';
  const base = m.quaternion.clone(), p0 = m.position.clone();
  await tween(260, u => { tipQuat(m, dir, ease(u), base); m.position.copy(p0).addScaledVector(dir, 0.35 * u); });
  const t = tiedSpot(i), p1 = m.position.clone(), q1 = m.quaternion.clone();
  const q2 = new THREE.Quaternion().setFromAxisAngle(Y, t.ang);
  if (chOf(m).model) chOf(m).mode = 'tied';
  await tween(380, u => {
    const e = ease(u);
    m.position.lerpVectors(p1, t.pos, e); m.position.y += Math.sin(Math.PI * u) * 0.35;
    m.quaternion.copy(q1).slerp(chOf(m).model ? q2 : lyingQuat(), e);
  });
  placeTied(m, i);
}
async function caughtAnim(m, ePos, pPos) {
  const dir = pPos.clone().sub(ePos).setY(0).normalize();
  const ang = angleOf(dir.x, dir.z);
  const pc = chOf(player), ec = chOf(m);
  pc.mode = 'surprised';
  await Promise.all([
    turnTo(m, ang, 120),
    turnTo(player, angleOf(-dir.x, -dir.z), 120),
  ]);
  const p0 = player.position.clone();
  await tween(240, u => { player.position.y = p0.y + Math.sin(Math.PI * u) * 0.35; });
  ec.mode = 'push';
  await tween(150, u => { m.position.copy(ePos).addScaledVector(dir, 0.55 * ease(u)); });
  const base = player.quaternion.clone();
  await Promise.all([
    tween(320, u => tipQuat(player, dir, ease(u), base)),
    tween(260, u => { m.position.copy(ePos).addScaledVector(dir, 0.55 * (1 - ease(u))); }),
  ]);
  ec.mode = 'idle';
}

async function playTurn(prev, r) {
  const ev = r.ev;
  const pc = chOf(player);
  const th = ev.find(e => e.k === 'throw');
  const pm = ev.find(e => e.k === 'pmove') || { from: prev.p, to: prev.p };
  const from = wp(pm.from), to = wp(pm.to);
  const dir = th ? new THREE.Vector3(0, 0, 1) : to.clone().sub(from).normalize();
  const push = ev.find(e => e.k === 'push'), pick = ev.find(e => e.k === 'pick');
  if (th) {
    // la piedra vuela en arco y hace ruido donde cae
    const a = wp(th.from), b = wp(th.at);
    await turnTo(player, angleOf(b.x - a.x, b.z - a.z), 140);
    pc.mode = 'push';
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: 0x8e8a80, flatShading: true }));
    st.castShadow = true; board.add(st);
    const h = 1.2 + a.distanceTo(b) * 0.12;
    await tween(520, u => { st.position.lerpVectors(a, b, u); st.position.y = a.y + 1.1 * (1 - u) + Math.sin(Math.PI * u) * h; st.rotation.x += 0.3; });
    pc.mode = 'idle';
    const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(b.x, b.y + 0.1, b.z); board.add(ring);
    const alerted = ev.filter(e => e.k === 'alert');
    const marks = alerted.map(e => { const sp = badge('!', '#f1d07a', '#2b2117', 'alerta'); const m = enemyMeshes[e.id]; sp.position.set(m.position.x, m.position.y + 1.6, m.position.z); sp.scale.set(0.5, 0.5, 1); board.add(sp); return sp; });
    await Promise.all([
      tween(420, u => { ring.scale.setScalar(0.6 + u * 1.8); ring.material.opacity = 0.9 * (1 - u); st.position.y = b.y + 0.06; }),
      ...alerted.map(e => { const en = r.s.en[e.id]; if (en.t !== 'sentry') return null; const [dx, dz] = faceVec(LV, en); return turnTo(enemyMeshes[e.id], angleOf(dx, dz), 260); }),
    ]);
    board.remove(ring); setTimeout(() => { board.remove(st); marks.forEach(m => board.remove(m)); }, 900);
  } else if (pm.blocked) {
    const mid = from.clone().lerp(to, 0.38);
    await walkTo(player, from, mid, 240);
    pc.mode = 'walk';
    await tween(220, u => { player.position.lerpVectors(mid, from, smooth(u)); });
    pc.mode = 'idle';
  } else if (push) {
    // empuja el cajón: camina detrás y el cajón se corre un casillero
    const cm = crateMeshes.get(push.from); crateMeshes.delete(push.from); crateMeshes.set(push.to, cm);
    const c0 = wp(push.from), c1 = wp(push.to);
    pc.mode = 'push';
    await Promise.all([walkTo(player, from, to, 560), tween(560, u => { cm && cm.position.lerpVectors(c0, c1, smooth(u)); })]);
    pc.mode = 'idle';
  } else if (!th) await walkTo(player, from, to);
  if (pick) {   // junta la piedra
    const m = itemMeshes.get(pick.at), p0 = m.position.clone();
    await tween(300, u => { m.position.y = p0.y + Math.sin(Math.PI * u) * 0.6 + u * 0.4; m.scale.setScalar(1 - u); });
    m.visible = false;
  }
  const td = ev.find(e => e.k === 'takedown');
  if (td) {
    pc.mode = 'push';
    await knockOut(enemyMeshes[td.id], dir, td.id);
    pc.mode = 'idle';
  }
  const caught = ev.find(e => e.k === 'caught');
  // movimientos de patrulleros
  const moves = ev.filter(e => e.k === 'emove');
  if (moves.length) {
    await Promise.all(moves.map(mv => walkTo(enemyMeshes[mv.id], wp(mv.from), wp(mv.to), 420)));
  }
  // todos miran hacia su próximo destino
  await Promise.all(r.s.en.map((e, i) => {
    if (!e.alive || (caught && caught.id !== undefined && e.id === caught.id)) return null;
    const [dx, dz] = faceVec(LV, e);
    return turnTo(enemyMeshes[i], angleOf(dx, dz));
  }));
  if (TDEC) TDEC.setDoors(r.s.moves, true, tween);
  if (TDEC && TDEC.setLights) TDEC.setLights(r.s.moves, r.s.crates);
  const barks = ev.filter(e => e.k === 'bark');
  if (barks.length) { barks.forEach(b => { chOf(enemyMeshes[b.id]).mode = 'bark'; }); await tween(380, () => {}); barks.forEach(b => { chOf(enemyMeshes[b.id]).mode = 'idle'; }); }
  const lightHit = caught && caught.light !== undefined;
  if (lightHit) { pc.mode = 'surprised'; await tween(500, () => {}); }
  const trainsEv = ev.filter(e => e.k === 'train');
  if (trainsEv.length && TDEC) {
    const hitTr = caught && caught.train !== undefined;
    const runs = trainsEv.map(t => TDEC.passTrain(t.i, tween));
    if (hitTr) {
      await tween(330, () => {});
      const dir = new THREE.Vector3(LV.trains[caught.train].dir || 1, 0, 0), base = player.quaternion.clone(), p0 = player.position.clone();
      pc.mode = 'surprised';
      await tween(420, u => { tipQuat(player, dir, ease(u), base); player.position.copy(p0).addScaledVector(dir, 0.9 * ease(u)); player.position.y = p0.y + Math.sin(Math.PI * u) * 0.5; });
    }
    await Promise.all(runs);
  }
  if (caught && caught.id !== undefined) {
    const e = r.s.en[caught.id];
    if (e.t === 'dog') {   // el perro muerde
      const dm = enemyMeshes[caught.id]; chOf(dm).mode = 'push'; pc.mode = 'surprised';
      await tween(520, () => {});
    } else await caughtAnim(enemyMeshes[caught.id], wp(e.pos), wp(r.s.p));
  }
  if (ev.some(e => e.k === 'win')) {
    pc.mode = 'cheer';
    finaleMood();
    const g = goalMesh;
    await tween(380, u => { const s = 1 + Math.sin(Math.PI * u) * 0.5; g.scale.set(s, 1, s); });
  }
}

// ---------- Acciones ----------
async function tryMove(to) {
  if (busy || state.over) return;
  const r = step(LV, state, to);
  if (!r) {
    if (state.crates.includes(to)) toast('El cajón no se puede correr para ese lado: algo lo traba.');
    else if (LV.adj.get(state.p).has(to)) toast('La puerta está cerrada. Mirá el número: en esos turnos se abre.');
    return;
  }
  throwMode = false;
  hist.push(state);
  const prev = state;
  state = r.s; hintKey = null; busy = true;
  hideTip(); hideToast(); if (!$('#postal').hidden) hidePostal();
  followPlayer();
  drawMarkers();
  updateHud();
  await playTurn(prev, r);
  busy = false; updateStoneBtn();
  drawMarkers();
  afterTurn();
}

function afterTurn() {
  updateHud();
  if (state.over === 'won') {
    const min = VERIFIED[idx].min, n = state.moves;
    const prevBest = best[idx];
    if (!prevBest || n < prevBest) { best[idx] = n; saveBest(); }
    const perfect = n === min;
    const grapes = perfect ? 3 : n <= min + 2 ? 2 : 1;
    $('#winGrapes').innerHTML = [0, 1, 2].map(k => `<svg class="${k < grapes ? '' : 'off'}" viewBox="0 0 34 40"><use href="#uva"/></svg>`).join('');
    $('#winGrapes').setAttribute('aria-label', `${grapes} de 3 racimos`);
    $('#winTitle').textContent = perfect ? '¡Cosecha perfecta!' : '¡Llegaste!';
    $('#winChip').textContent = perfect ? 'Recorrido perfecto' : `Se puede en ${min}`;
    $('#winTxt').textContent = perfect
      ? `Lo hiciste en ${n} movidas, igual que el resolvedor.`
      : `Lo hiciste en ${n} movidas. El camino más corto tiene ${min}.`;
    $('#winNext').textContent = idx < LEVELS.length - 1 ? 'Siguiente' : 'Ver niveles';
    $('#winBox').hidden = false;
  } else if (state.over === 'caught' && state.by === 'light') {
    const who = chOf(player).name;
    $('#lostTitle').textContent = `Los faros iluminaron a ${who}`;
    $('#lostTxt').textContent = 'No te quedes en la luz de un camión. Un cajón corta el haz, y el que parpadea avisa en cuántos turnos se apaga.';
    $('#lostBox').hidden = false;
  } else if (state.over === 'caught' && state.en[state.by] && state.en[state.by].t === 'dog') {
    const who = chOf(player).name;
    $('#lostTitle').textContent = `El perro alcanzó a ${who}`;
    $('#lostTxt').textContent = 'Si pasás a dos casilleros o menos, el perro te sigue. Pero su cadena no da más que hasta el círculo: alejalo y rodealo, o distraelo con una piedra.';
    $('#lostBox').hidden = false;
  } else if (state.over === 'caught' && state.by === 'train') {
    const who = chOf(player).name;
    $('#lostTitle').textContent = `La máquina pasó por encima de ${who}`;
    $('#lostTxt').textContent = 'El cartelito de cada vía dice en cuántos turnos pasa la próxima máquina. Cuando marca 1 (en rojo), salí de las vías.';
    $('#lostBox').hidden = false;
  } else if (state.over === 'caught') {
    const e = state.en[state.by];
    const who = chOf(player).name;
    $('#lostTitle').textContent = e.t === 'patrol' ? `El sereno atrapó a ${who}` : e.turn ? `El guarda vio a ${who}` : (e.range || 1) > 1 ? `El vigía del farol vio a ${who}` : `El vigía vio a ${who}`;
    $('#lostTxt').textContent = state.front
      ? 'Entraste por el frente. A alguien de la banda solo lo sacás si llegás por detrás o de costado.'
      : e.t === 'patrol'
        ? 'Quedaste justo en el próximo paso del sereno, el punto que marca su flecha roja.'
        : e.turn ? 'El guarda giró y quedaste justo donde apuntaba. Fijate en la flecha clara: es hacia dónde mira después.'
        : (e.range || 1) > 1
          ? 'El vigía del farol ve varios puntos en línea recta, los marcados en rojo. Buscá una barrica que te tape.'
          : 'Quedaste en el punto que vigila su flecha roja.';
    $('#lostBox').hidden = false;
  }
}

function undo() {
  if (busy || !hist.length) return;
  state = hist.pop(); hintKey = null;
  hideOverlays();
  snap(); updateHud(); followPlayer(400);
}
function restart() {
  if (busy) return;
  state = LV.s0; hist = []; hintKey = null;
  hideOverlays(); snap(); updateHud();
  showTip();
  followPlayer(500);
}
function hint() {
  if (busy || state.over) return;
  const r = solve(LV, state);
  if (r && r.path) {
    hintKey = r.path[0];
    if (hintKey.startsWith('T:')) { hintKey = hintKey.slice(2); throwMode = true; updateStoneBtn(); drawMarkers(); toast(`Tirá la piedra al punto dorado. Te faltan ${r.path.length} movidas.`); return; }
    drawMarkers();
    toast(`Andá al punto dorado. Te faltan ${r.path.length} movidas.`);
  } else {
    toast('Desde acá no hay salida. Deshacé una movida.');
  }
}

// ---------- Interfaz ----------
function updateHud() {
  $('#moves').textContent = state.moves;
  $('#minTxt').textContent = `mín. ${VERIFIED[idx].min}`;
  $('#bUndo').disabled = !hist.length;
}
function hideOverlays() { $('#winBox').hidden = true; $('#lostBox').hidden = true; $('#lvSheet').hidden = true; $('#chapBox').hidden = true; }
function hideTip() { const t = $('#tip'); if (!t.hidden) { t.style.opacity = 0; setTimeout(() => { if (t.style.opacity === '0') { t.hidden = true; fitCamera(); } }, 300); } }
function showTip() { const t = $('#tip'); t.hidden = false; t.style.opacity = 1; fitCamera(); }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}
function hideToast() { $('#toast').hidden = true; }
// Postal del lugar: aparece al empezar un nivel, con la ilustración y el nombre del sitio
let postalTimer;
function showPostal() {
  const pc = $('#postal'); clearTimeout(postalTimer);
  if (!LVD.art) { pc.hidden = true; return; }
  $('#postalImg').src = LVD.art;
  $('#postalPlace').textContent = LVD.place || LVD.name;
  $('#postalSub').textContent = (LVD.chapter || '').replace(' · ', ' — ');
  pc.hidden = false; pc.classList.remove('out'); void pc.offsetWidth; pc.classList.add('in');
  postalTimer = setTimeout(hidePostal, 3400);
}
function hidePostal() { const pc = $('#postal'); pc.classList.remove('in'); pc.classList.add('out'); clearTimeout(postalTimer); postalTimer = setTimeout(() => { pc.hidden = true; }, 450); }

function openLevels() {
  if (busy) return;
  const ul = $('#lvList'); ul.innerHTML = '';
  LEVELS.forEach((d, i) => {
    const v = VERIFIED[i];
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'tt-row';
    b.setAttribute('aria-current', i === idx ? 'true' : 'false');
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t">${d.art ? `<img class="thumb" alt="" loading="lazy" src="${d.art}">` : ''}<span class="tx"><strong></strong><small></small></span></span><span class="num">${v.min || '–'}</span><span class="num best">${best[i] || '·'}</span>`;
    b.querySelector('strong').textContent = d.name;
    b.querySelector('small').textContent = d.place ? `${d.chapter.split(' · ')[0]} · ${d.place}` : (d.chapter || 'Entrenamiento');
    b.onclick = () => buildLevel(i);
    li.appendChild(b); ul.appendChild(li);
  });
  $('#lvSheet').hidden = false;
}

$('#bUndo').onclick = undo;
$('#bRestart').onclick = restart;
$('#bHint').onclick = hint;
// Botón de la piedra: aparece en los niveles con piedras
function updateStoneBtn() {
  const b = $('#bStone'); if (!b) return;
  const show = !!(LVD.stones || LVD.carry);
  b.hidden = !show;
  if (!show) return;
  b.disabled = busy || !!state.over || !state.stones;
  b.classList.toggle('on', throwMode);
  $('#stoneN').textContent = state.stones || 0;
}
function toggleThrow() {
  if (busy || state.over || !state.stones) { if (!state.stones) toast('Primero juntá una piedra del suelo.'); return; }
  throwMode = !throwMode; updateStoneBtn(); drawMarkers();
  if (throwMode) toast('Tocá un punto dorado para tirar la piedra. Los guardias de al lado miran el ruido.');
}
$('#bStone').onclick = toggleThrow;
$('#bLevels').onclick = openLevels;
$('#lvClose').onclick = () => { $('#lvSheet').hidden = true; };
$('#lostUndo').onclick = undo;
$('#lostRestart').onclick = restart;
$('#winRetry').onclick = restart;
$('#winNext').onclick = () => {
  if (LVD.outro && !$('#winBox').dataset.outroShown) { $('#winBox').dataset.outroShown = '1'; return showOutro(); }
  idx < LEVELS.length - 1 ? buildLevel(idx + 1) : openLevels();
};
// Fin de capítulo: cartel con la historia y la ilustración del lugar
function showOutro() {
  hideOverlays();
  const [cNum] = (LVD.chapter || '').split(' · ');
  $('#chapNum').textContent = 'Fin del ' + (cNum || 'capítulo').toLowerCase();
  $('#chapTitle').textContent = LVD.outroTitle || 'La corona sigue lejos';
  $('#chapTxt').textContent = LVD.outro;
  setChapArt(LVD.art);
  $('#chapGo').textContent = idx < LEVELS.length - 1 ? 'Seguir' : 'Continuará…';
  $('#chapBox').dataset.next = idx < LEVELS.length - 1 ? String(idx + 1) : 'route';
  $('#chapBox').hidden = false;
}
function setChapArt(src) {
  const b = $('#chapBox');
  b.style.setProperty('--art', src ? `url("${src}")` : 'none');
  b.classList.toggle('has-art', !!src);
}
$('#tipClose').onclick = hideTip;
$('#postal').onclick = hidePostal;
$('#chapGo').onclick = () => {
  const nx = $('#chapBox').dataset.next; delete $('#chapBox').dataset.next;
  $('#chapBox').hidden = true; $('#chapGo').textContent = 'Empezar';
  if (nx === 'route') openLevels(); else if (nx) buildLevel(+nx); else showPostal();
};
$('#bMap').onclick = () => setOverview(!overview);
$('#lvChar').onclick = () => { $('#lvSheet').hidden = true; openPicker(); };

// Toques sobre el tablero
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 12) return;
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, cam);
  const hits = ray.intersectObjects(hitMeshes, false);
  if (throwMode) {
    const tg = throwTargets(LV, state), h = hits.find(x => tg.includes(x.object.userData.k));
    if (h) tryMove('T:' + h.object.userData.k); else { throwMode = false; updateStoneBtn(); drawMarkers(); }
    return;
  }
  // elegir el punto vecino más cercano al toque
  const nb = LV.adj.get(state.p);
  const h = hits.find(x => nb.has(x.object.userData.k));
  if (h) tryMove(h.object.userData.k);
});
// Teclado: flechas o WASD, Z deshacer, R reiniciar, H pista
window.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') { toggleThrow(); return; }
  const map = { ArrowUp: 'N', w: 'N', ArrowDown: 'S', s: 'S', ArrowLeft: 'W', a: 'W', ArrowRight: 'E', d: 'E' };
  const dir = map[e.key];
  if (dir) {
    const [x, y] = P(state.p), [dx, dy] = DIRS[dir];
    const k = K(x + dx, y + dy);
    if (LV.adj.get(state.p).has(k)) { e.preventDefault(); tryMove(k); }
  } else if (e.key === 'z') undo();
  else if (e.key === 'r') restart();
  else if (e.key === 'h') hint();
  else if (e.key === 'm') setOverview(!overview);
});


// ---------- Elegir personaje ----------
const pkCanvas = $('#pkCanvas');
let pk = null;
function setupPicker() {
  const r = new THREE.WebGLRenderer({ canvas: pkCanvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xdde4ff, 0x3b3044, 0.85));
  const key = new THREE.DirectionalLight(0xfff0d8, 0.9); key.position.set(-2, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
  s.add(key);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 48), M.top);
  floor.position.y = -0.15; floor.receiveShadow = true; s.add(floor);
  const c = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  c.position.set(0, 1.25, 3.7); c.lookAt(0, 0.58, 0);
  const pedro = CHARS.build('pedro'); pedro.position.x = -0.72; s.add(pedro);
  const clara = CHARS.build('clara'); clara.position.x = 0.72; s.add(clara);
  pk = { r, s, c, figs: { pedro, clara } };
}
function renderPicker(t) {
  if (!pk) return;
  const W = pkCanvas.clientWidth, H = pkCanvas.clientHeight;
  if (!W || !H) return;
  if (pkCanvas.width !== Math.round(W * pk.r.getPixelRatio())) { pk.r.setSize(W, H, false); }
  pk.c.aspect = W / H;
  pk.c.fov = W / H < 1.1 ? 40 : 30;
  pk.c.updateProjectionMatrix();
  for (const [k, f] of Object.entries(pk.figs)) {
    const sel = pk.hover === k;
    f.rotation.y = (k === 'pedro' ? 0.28 : -0.28) + (reduceMotion ? 0 : Math.sin(t * 0.6 + (k === 'pedro' ? 0 : 2)) * 0.15);
    chOf(f).mode = sel ? 'cheer' : 'idle';
  }
  pk.r.render(pk.s, pk.c);
}
function openPicker() {
  if (!pk) setupPicker();
  pk.hover = charKind;
  document.querySelectorAll('.pk').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === charKind ? 'true' : 'false'));
  $('#picker').hidden = false;
}
function setCharacter(kind) {
  charKind = kind;
  try { localStorage.setItem('sigilo-char', kind); } catch (e) {}
  const face = player.userData.face || 0;
  CHARS.release(player); board.remove(player);
  player = CHARS.build(kind); player.scale.setScalar(FIG); player.userData.face = face; board.add(player);
  snap();
  $('#lvNum').textContent = levelLabel(idx);
  $('.legend .me').style.background = '#' + new THREE.Color(chOf(player).color).getHexString();
  $('#picker').hidden = true;
  if (!state.over) toast(`Esta noche vas con ${chOf(player).name}.`);
}
document.querySelectorAll('.pk').forEach(b => {
  b.addEventListener('click', () => setCharacter(b.dataset.k));
  b.addEventListener('pointerenter', () => { if (pk) pk.hover = b.dataset.k; });
  b.addEventListener('focus', () => { if (pk) pk.hover = b.dataset.k; });
});

// ---------- Cámara ----------
// ---------- Cámara ----------
// La cámara es ortográfica y siempre mira en la misma dirección: acercar o mover la vista es
// cambiar el rectángulo que muestra (camRect). Como en Lara Croft GO, la cámara va baja y cerca y
// sigue al jugador en cada movida; se abre solo para mostrar a los guardias que pueden atraparlo.
// Los "zones" con nombre (la bodega) solo sirven para avisar en qué parte del nivel estás.
let camRect = null, camZone = -1, overview = false, camAnim = null, introTimer = null, ZONES = null;
const ZONE_PAD = 0.45;                      // margen alrededor de un tramo, en casilleros
const ZONE_W = 2, ZONE_H = 2;               // tramos automáticos: 3 columnas y 3 filas de puntos
const AHEAD = 3;                            // pasos de ronda que se miran para avisar que viene un sereno
const VIEW_H = 7;                           // alto mínimo de la vista, en unidades del mundo (≈ 3 casilleros)
const CAM_EL = 0.55, CAM_AZ = Math.PI / 4;  // inclinación ≈ 31° y tablero en diagonal, como Lara Croft GO
// Niveles sin tramos propios: ventanas de 3 columnas que se pisan, para ver todo más cerca
function autoZones(lv) {
  const xs = [...lv.nodes.values()].map(n => n.x), ys = [...lv.nodes.values()].map(n => n.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const spans = (a, b, w) => {
    if (b - a <= w) return [[a, b]];
    const out = []; for (let s = a; ; s += w) { const e = Math.min(s + w, b); out.push([e - w, e]); if (e >= b) break; }
    return out;
  };
  const zs = [];
  for (const [ya, yb] of spans(y0, y1, ZONE_H)) for (const [xa, xb] of spans(x0, x1, ZONE_W)) zs.push({ box: [xa, ya, xb, yb] });
  return zs.length > 1 ? zs : null;
}
const inBox = (k, b, m = 0) => { const [x, y] = P(k); return x >= b[0] - m && x <= b[2] + m && y >= b[1] - m && y <= b[3] + m; };
// Guardias que importan en un tramo: los que están o miran adentro, y los serenos que van a entrar pronto
function threatPoints(box) {
  const pts = [];
  for (const e of state.en) {
    if (!e.alive) continue;
    const f = facing(LV, e), seen = sight(LV, e, state.moves, state);
    let near = inBox(e.pos, box, 0.5) || seen.some(k => inBox(k, box));
    if (!near && e.t === 'patrol') {
      let ri = e.ri, rd = e.rdir;
      for (let i = 0; i < AHEAD && !near; i++) {
        if (e.loop) ri = (ri + 1) % e.route.length;
        else { if (ri + rd < 0 || ri + rd >= e.route.length) rd = -rd; ri += rd; }
        near = inBox(e.route[ri], box);
      }
    }
    if (!near) continue;
    pts.push(e.pos, ...seen); if (f) pts.push(f);
  }
  return pts;
}
function orientCamera(W, H) {
  const tall = !LVD.theme && W / H < 0.85 && (ext.x1 - ext.x0) > (ext.z1 - ext.z0) * 1.2;
  const az = tall ? Math.PI / 2 + 0.3 : CAM_AZ, el = CAM_EL, dist = 60;
  cam.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
}
// Rectángulo de cámara que muestra todos los puntos dados, respetando la forma de la pantalla
function rectFor(pts, pad) {
  const stage = $('#stage'), W = stage.clientWidth, H = stage.clientHeight;
  const inv = cam.matrixWorldInverse;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    const v = p.clone().applyMatrix4(inv);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  let w = x1 - x0 + pad * 2, h = (y1 - y0) + pad * 2;
  // espacio libre arriba (etiqueta del nivel) y abajo (nota y botonera flotante)
  const topH = Math.max(0, $('#hud').offsetHeight - 20);
  const tipEl = $('#tip'), dockEl = $('#dock');
  const lowest = tipEl.hidden ? dockEl.offsetTop : Math.min(dockEl.offsetTop, tipEl.offsetTop);
  const botH = Math.max(0, H - lowest + 6);
  const usableH = Math.max(H - topH - botH, H * 0.45);
  const aspect = W / usableH;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w, h, fullH: h * (H / usableH), topOff: h * (topH / usableH) };
}
function boardRect() {
  const pts = [];
  for (const x of [ext.x0, ext.x1]) for (const z of [ext.z0, ext.z1]) for (const y of [ext.yBot, ext.yTop]) pts.push(new THREE.Vector3(x, y, z));
  return rectFor(pts, LVD.theme ? 0.2 : 0.6);
}
function zoneRect(z) {
  let [gx0, gy0, gx1, gy1] = z.box; const m = ZONE_PAD, pts = [];
  if (state) for (const k of threatPoints(z.box)) {
    const [x, y] = P(k);
    gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y);
  }
  for (const gx of [gx0 - m, gx1 + m]) for (const gy of [gy0 - m, gy1 + m]) for (const y of [0, 1.5]) {
    const p = toW(gx, gy); p.y = y; pts.push(p);
  }
  return rectFor(pts, 0);
}
function applyRect(r) {
  camRect = r;
  cam.left = r.cx - r.w / 2; cam.right = r.cx + r.w / 2;
  cam.top = r.cy + r.h / 2 + r.topOff; cam.bottom = cam.top - r.fullH;
  cam.updateProjectionMatrix();
}
// Vista que sigue al jugador: él, sus vecinos y los guardias que lo pueden atrapar; nunca menos de VIEW_H
function followRect() {
  const [px, py] = P(state.p);
  const keys = [state.p, ...LV.adj.get(state.p), ...threatPoints([px - 1, py - 1, px + 1, py + 1])];
  const pts = [];
  for (const k of keys) { const p = wp(k); pts.push(p.clone(), p.clone().setY(p.y + 1.6)); }
  const r = rectFor(pts, 0.7);
  if (r.fullH < VIEW_H) { const f = VIEW_H / r.fullH; r.w *= f; r.h *= f; r.fullH *= f; r.topOff *= f; }
  // que no se vea vacío más allá del borde de la maqueta
  const B = boardRect();
  if (r.w >= B.w || r.fullH >= B.fullH) return B;
  r.cx = Math.min(Math.max(r.cx, B.cx - (B.w - r.w) / 2), B.cx + (B.w - r.w) / 2);
  r.cy = Math.min(Math.max(r.cy, B.cy - (B.h - r.h) / 2), B.cy + (B.h - r.h) / 2);
  return r;
}
function wantedRect() {
  if (!ZONES || overview || !state) return boardRect();
  return followRect();
}
// Se desliza hasta el rectángulo pedido (o salta, si no hay que animar)
function moveCamera(ms = 650) {
  const to = wantedRect();
  if (camAnim) { camAnim.cancel = true; camAnim = null; }
  if (!camRect || ms <= 0 || reduceMotion) { applyRect(to); return Promise.resolve(); }
  const from = { ...camRect }, a = { cancel: false }; camAnim = a;
  const k = ['cx', 'cy', 'w', 'h', 'fullH', 'topOff'];
  return tween(ms, u => {
    if (a.cancel) return;
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const r = {}; for (const n of k) r[n] = from[n] + (to[n] - from[n]) * e;
    applyRect(r);
  });
}
// Tramo donde está el jugador: si sigue dentro del actual, no cambia
function zoneOf(key) {
  const zs = ZONES; if (!zs) return -1;
  const [x, y] = P(key);
  const inZ = i => { const b = zs[i].box; return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]; };
  if (camZone >= 0 && inZ(camZone)) return camZone;
  for (let i = 0; i < zs.length; i++) if (inZ(i)) return i;
  return camZone;
}
// Después de cada movida la cámara acompaña al jugador; si entra en una parte con nombre, lo avisa
function followPlayer(ms = 480) {
  if (!ZONES) return;
  clearTimeout(introTimer);
  const z = zoneOf(state.p);
  const changed = z !== camZone && z >= 0;
  camZone = z;
  if (overview) { overview = false; updateMapBtn(); }
  if (changed) zoneLabel();
  const to = wantedRect();
  if (camRect && ['cx', 'cy', 'w'].every(n => Math.abs(to[n] - camRect[n]) < 0.02)) return;
  return moveCamera(ms);
}
function zoneLabel() {
  const zs = ZONES; if (!zs || camZone < 0 || !zs[camZone].name) return;
  toast(zs[camZone].name);
}
function setOverview(on) {
  if (!ZONES) return;
  clearTimeout(introTimer);
  overview = on; updateMapBtn(); moveCamera(on ? 550 : 650);
}
function updateMapBtn() {
  const b = $('#bMap');
  b.hidden = !ZONES;
  (b.querySelector('.lb') || b.querySelector('span')).textContent = overview ? 'Acercar' : 'Mapa';
  b.setAttribute('aria-pressed', overview ? 'true' : 'false');
}
// Al empezar un nivel por tramos: se ve el mapa entero y después se acerca al primer tramo
function introCamera() {
  clearTimeout(introTimer);
  camZone = -1; overview = !!ZONES;
  updateMapBtn();
  applyRect(boardRect());
  if (!ZONES) return;
  camZone = zoneOf(state.p);
  introTimer = setTimeout(() => {
    if (!overview || busy) return;
    camZone = -1; camZone = zoneOf(state.p);
    overview = false; updateMapBtn(); moveCamera(1000); zoneLabel();
  }, reduceMotion ? 600 : 1900);
}
function fitCamera() {
  const stage = $('#stage');
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return;
  renderer.setSize(W, H, false);
  orientCamera(W, H);
  if (camAnim) { camAnim.cancel = true; camAnim = null; }
  applyRect(wantedRect());
}
new ResizeObserver(fitCamera).observe($('#stage'));

// ---------- Bucle ----------
let lastT = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    const u = Math.min(1, (t - tw.t0) / tw.ms);
    tw.fn(u);
    if (u >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  if (markers && !reduceMotion) markers.children.forEach(m => {
    if (m.userData.pulse) { const s = 1 + Math.sin(t / 220) * (m.userData.hint ? 0.14 : 0.07); m.scale.set(s, s, 1); }
  });
  if (goalMesh && !reduceMotion) goalMesh.children[0].rotation.z = t / 1600;
  if (finale && finale.corona && !reduceMotion) { finale.corona.rotation.y = t / 2400; finale.corona.position.y = 0.32 + Math.sin(t / 700) * 0.04; }
  CHARS.tick(reduceMotion ? dt * 0.5 : dt, t / 1000);
  if (decorTick && !reduceMotion) decorTick(t / 1000);
  if (!$('#picker').hidden) renderPicker(t / 1000);
  else renderer.render(scene, cam);
  requestAnimationFrame(frame);
}

// ---------- Arranque (conserva el nivel y las movidas si la página se actualiza) ----------
function start(data) {
  data = data || {};
  if (data.ch && CHARS.PAL[data.ch] && CHARS.PAL[data.ch].ring) charKind = data.ch;
  buildLevel(Math.min(Math.max(0, data.li | 0), LEVELS.length - 1), { noIntro: Array.isArray(data.path) && data.path.length > 0 });
  if (Array.isArray(data.path)) {
    for (const k of data.path) { const r = step(LV, state, k); if (!r) break; hist.push(state); state = r.s; }
    if (data.path.length) { $('#tip').hidden = true; snap(); afterTurn(); }
  }
  updateHud();
  if (!charKind) openPicker();
  requestAnimationFrame(frame);
}
// Cuando termina de cargar el Pedro animado, reemplaza al de bloques
// Cuando termina de cargar un modelo de Blender, reemplaza al muñeco de bloques
CHARS.onModel = kind => {
  if (!player) return;
  const swap = old => {
    const n = CHARS.build(kind); n.scale.copy(old.scale); n.position.copy(old.position); n.quaternion.copy(old.quaternion);
    n.userData.face = old.userData.face; chOf(n).mode = chOf(old).mode;
    CHARS.release(old); old.parent && old.parent.remove(old); board.add(n); return n;
  };
  if (!busy) {
    if (chOf(player).kind === kind) player = swap(player);
    enemyMeshes = enemyMeshes.map(m => chOf(m).kind === kind ? swap(m) : m);
  }
  // Guardias: se reemplazan en el mismo lugar y con la misma orientación
  if ((kind === 'vigia' || kind === 'sereno') && board && !busy && state) {
    enemyMeshes = enemyMeshes.map((m, i) => {
      const e = state.en[i]; if (e.t === 'dog') return m;
      const want = e.t === 'sentry' && (e.range || 1) === 1 ? 'vigia' : 'sereno';
      if (want !== kind) return m;
      const n = CHARS.build(kind); n.scale.copy(m.scale); n.position.copy(m.position); n.quaternion.copy(m.quaternion);
      n.userData.face = m.userData.face; chOf(n).mode = chOf(m).mode;
      CHARS.release(m); board.remove(m); board.add(n);
      if (!e.alive) placeTied(n, i);
      return n;
    });
  }
  if (kind === 'zorro' || kind === 'corona') placeFinale();
  if (pk && pk.figs[kind]) {
    const old = pk.figs[kind]; CHARS.release(old); pk.s.remove(old);
    const f = CHARS.build(kind); f.position.copy(old.position); pk.s.add(f); pk.figs[kind] = f;
  }
};
CHARS.loadModel('pedro', 'pedro_model.js');
CHARS.loadModel('clara', 'clara_model.js');
CHARS.loadModel('vigia', 'vigia_model.js');
CHARS.loadModel('sereno', 'sereno_model.js');
CHARS.loadModel('zorro', 'zorro_model.js');
CHARS.loadModel('corona', 'corona_model.js');
DECOR.loadProps('escenario_model.js');
TREN.loadKit('trasandino_model.js');
TREN.loadKit('playa_model.js', () => CHARS.notify('perro'), 'KIT_PLAYA');
window.claude?.hot?.snapshot?.(() => ({ ch: charKind, li: idx, path: hist.concat([state]).slice(1).map(s => s.p) }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
