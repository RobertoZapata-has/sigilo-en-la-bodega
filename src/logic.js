// ===== LÓGICA PURA (sin gráficos) =====
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const K = (x, y) => x + ',' + y;
const P = k => k.split(',').map(Number);

function parseLevel(L) {
  const nodes = new Map(), adj = new Map();
  let start = null, goal = null;
  const cover = new Set();   // puntos con barricas: ahí no te ven y la vista del vigía no pasa
  L.map.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (r % 2 === 0 && c % 2 === 0 && 'oSGb'.includes(ch)) {
        const k = K(c / 2, r / 2);
        if (ch === 'b') cover.add(k);
        nodes.set(k, { x: c / 2, y: r / 2 });
        adj.set(k, new Set());
        if (ch === 'S') start = k;
        if (ch === 'G') goal = k;
      }
    }
  });
  const link = (a, b) => {
    if (!adj.has(a) || !adj.has(b)) throw new Error(L.name + ': arista suelta ' + a + ' ' + b);
    adj.get(a).add(b); adj.get(b).add(a);
  };
  L.map.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (r % 2 === 0 && c % 2 === 1 && ch === '-') link(K((c - 1) / 2, r / 2), K((c + 1) / 2, r / 2));
      if (r % 2 === 1 && c % 2 === 0 && ch === '|') link(K(c / 2, (r - 1) / 2), K(c / 2, (r + 1) / 2));
    }
  });
  const en = (L.enemies || []).map((e, id) => {
    if (e.t === 'sentry') {
      // con "turn", el vigía gira cada turno siguiendo esa lista de direcciones (guarda que gira)
      if (e.turn) { const ti = e.ti || 0; return { id, t: 'sentry', pos: K(...e.at), turn: e.turn, ti, face: e.turn[ti], range: e.range || 1, alive: true }; }
      return { id, t: 'sentry', pos: K(...e.at), face: e.face, range: e.range || 1, alive: true };
    }
    const route = e.route.map(p => K(...p));
    for (let i = 0; i < route.length - 1; i++)
      if (!adj.get(route[i]).has(route[i + 1])) throw new Error(L.name + ': ruta rota');
    if (e.loop && !adj.get(route[route.length - 1]).has(route[0])) throw new Error(L.name + ': ruta no cierra');
    const ri = e.start || 0;
    let rdir = e.dir || 1;
    if (!e.loop && (ri + rdir < 0 || ri + rdir >= route.length)) rdir = -rdir;
    return { id, t: 'patrol', route, loop: !!e.loop, ri, rdir, pos: route[ri], alive: true };
  });
  // Trenes que pasan cada tantos turnos por una fila de puntos (las vías)
  const trains = (L.trains || []).map(t => {
    const set = new Set();
    for (let x = t.x0; x <= t.x1; x++) if (nodes.has(K(x, t.y))) set.add(K(x, t.y));
    return { y: t.y, x0: t.x0, x1: t.x1, every: t.every, phase: t.phase || 0, dir: t.dir || 1, nodes: set };
  });
  // Puertas: caminos que se abren y se cierran solos (abiertas "open" turnos de cada "every")
  const doors = (L.doors || []).map(d => {
    const a = K(...d.a), b = K(...d.b);
    if (!adj.get(a) || !adj.get(a).has(b)) throw new Error(L.name + ': puerta sin camino ' + a + ' ' + b);
    return { a, b, every: d.every, open: d.open || 1, phase: d.phase || 0 };
  });
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const period = [...trains.map(t => t.every), ...doors.map(d => d.every)].reduce((a, b) => a * b / gcd(a, b), 1);
  const lv = { name: L.name, tip: L.tip, nodes, adj, start, goal, cover, trains, doors, period };
  lv.s0 = { p: start, moves: 0, en, over: null };
  return lv;
}

// ¿La puerta entre a y b está abierta en el turno t?
function doorAt(lv, a, b) { return lv.doors && lv.doors.find(d => (d.a === a && d.b === b) || (d.a === b && d.b === a)); }
function doorOpen(d, t) { return ((t + d.phase) % d.every + d.every) % d.every < d.open; }
function canPass(lv, a, b, t) { if (!lv.adj.get(a).has(b)) return false; const d = doorAt(lv, a, b); return !d || doorOpen(d, t); }
// ¿El tren pasa al terminar el turno t? ¿Cuántos turnos faltan desde t?
function trainPasses(tr, t) { return t > 0 && (t + tr.phase) % tr.every === 0; }
function trainIn(tr, t) { const r = (t + tr.phase) % tr.every; return r === 0 ? tr.every : tr.every - r; }

function nextIdx(e) {
  return e.loop ? (e.ri + 1) % e.route.length : e.ri + e.rdir;
}
function facing(lv, e) {
  if (e.t === 'sentry') {
    const [x, y] = P(e.pos), [dx, dy] = DIRS[e.face];
    const n = K(x + dx, y + dy);
    return lv.adj.get(e.pos).has(n) ? n : null;
  }
  return e.route[nextIdx(e)];
}
// Hacia dónde va a mirar el guarda que gira después del próximo turno
function nextFacing(lv, e) {
  if (!e.turn) return null;
  const f = e.turn[(e.ti + 1) % e.turn.length];
  const [x, y] = P(e.pos), [dx, dy] = DIRS[f];
  const n = K(x + dx, y + dy);
  return lv.adj.get(e.pos).has(n) ? n : null;
}
// Puntos que ve un guardia. El vigía con farol (range > 1) ve en línea recta hasta su alcance;
// una barrica corta la vista y quien está en ella no se ve. El sereno solo "ve" su próximo paso.
function sight(lv, e, t) {
  if (e.t !== 'sentry') { const f = facing(lv, e); return f ? [f] : []; }
  const out = []; const [dx, dy] = DIRS[e.face];
  let cur = e.pos;
  for (let i = 0; i < (e.range || 1); i++) {
    const [x, y] = P(cur), n = K(x + dx, y + dy);
    if (!lv.adj.get(cur).has(n)) break;
    if (t !== undefined && !canPass(lv, cur, n, t)) break;
    if (lv.cover && lv.cover.has(n)) break;
    out.push(n); cur = n;
  }
  return out;
}
function faceVec(lv, e) {
  if (e.t === 'sentry') return DIRS[e.face];
  const [x, y] = P(e.pos), [fx, fy] = P(facing(lv, e));
  return [fx - x, fy - y];
}
function advance(e) {
  if (e.loop) e.ri = (e.ri + 1) % e.route.length;
  else {
    e.ri += e.rdir;
    if (e.ri + e.rdir < 0 || e.ri + e.rdir >= e.route.length) e.rdir = -e.rdir;
  }
  e.pos = e.route[e.ri];
}

// Un turno completo: mueve el jugador y después actúan los enemigos.
// Devuelve el estado nuevo y la lista de eventos para animar.
function step(lv, s, to) {
  if (s.over || !canPass(lv, s.p, to, s.moves)) return null;
  const ns = { p: to, moves: s.moves + 1, en: s.en.map(e => ({ ...e })), over: null, by: null };
  const ev = [{ k: 'pmove', from: s.p, to }];
  const hit = ns.en.find(e => e.alive && e.pos === to);
  if (hit) {
    if (facing(lv, hit) === s.p) { // entraste de frente
      ns.p = s.p; ns.front = true; ev[0].blocked = true;
      ns.over = 'caught'; ns.by = hit.id; ev.push({ k: 'caught', id: hit.id }); return { s: ns, ev };
    }
    hit.alive = false; ev.push({ k: 'takedown', id: hit.id, from: s.p });
  }
  if (to === lv.goal) { ns.over = 'won'; ev.push({ k: 'win' }); return { s: ns, ev }; }
  for (const e of ns.en) {
    if (!e.alive) continue;
    if (e.turn) { e.ti = (e.ti + 1) % e.turn.length; e.face = e.turn[e.ti]; ev.push({ k: 'eturn', id: e.id }); }
    const f = facing(lv, e);
    if (sight(lv, e, ns.moves).includes(ns.p)) { ns.over = 'caught'; ns.by = e.id; ev.push({ k: 'caught', id: e.id, lunge: true }); return { s: ns, ev }; }
    if (e.t === 'patrol') {
      if (ns.en.some(o => o !== e && o.alive && o.pos === f)) { ev.push({ k: 'wait', id: e.id }); continue; }
      const from = e.pos; advance(e);
      ev.push({ k: 'emove', id: e.id, from, to: e.pos });
    }
  }
  // el tren pasa: si estás en las vías, te lleva puesto
  for (let i = 0; i < (lv.trains || []).length; i++) {
    const tr = lv.trains[i];
    if (!trainPasses(tr, ns.moves)) continue;
    ev.push({ k: 'train', i });
    if (tr.nodes.has(ns.p)) { ns.over = 'caught'; ns.by = 'train'; ns.train = i; ev.push({ k: 'caught', train: i }); return { s: ns, ev }; }
  }
  return { s: ns, ev };
}

let PERIOD = 1;
const keyOf = s => s.p + '|' + (PERIOD > 1 ? s.moves % PERIOD : '') + '|' + s.en.map(e => e.alive ? e.pos + ':' + e.ri + ':' + e.rdir + ':' + (e.turn ? e.ti : '') : 'x').join(';');

// Resolvedor: búsqueda en anchura sobre todos los estados posibles.
// Devuelve la secuencia más corta de casillas o null si no hay salida.
function solve(lv, s0, limit = 200000) {
  PERIOD = lv.period || 1;
  const seen = new Map([[keyOf(s0), null]]);
  let q = [s0], explored = 0;
  while (q.length) {
    const nq = [];
    for (const s of q) {
      for (const to of lv.adj.get(s.p)) {
        const r = step(lv, s, to);
        if (!r || r.s.over === 'caught') continue;
        const k = keyOf(r.s);
        if (seen.has(k)) continue;
        seen.set(k, { prev: keyOf(s), to });
        explored++;
        if (r.s.over === 'won') {
          const path = []; let cur = k;
          while (seen.get(cur)) { path.unshift(seen.get(cur).to); cur = seen.get(cur).prev; }
          return { path, explored: seen.size };
        }
        if (seen.size > limit) return null;
        nq.push(r.s);
      }
    }
    q = nq;
  }
  return { path: null, explored: seen.size };
}

if (typeof module !== 'undefined') module.exports = { parseLevel, step, solve, facing, nextFacing, sight, faceVec, doorAt, doorOpen, canPass, trainPasses, trainIn, keyOf, K, P, DIRS };
