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
    if (e.t === 'dog') return { id, t: 'dog', pos: K(...e.at), home: K(...e.at), leash: e.leash === undefined ? 2 : e.leash, smell: e.smell || 2, face: e.face || 'S', alive: true };
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
    return { id, t: 'patrol', route, loop: !!e.loop, ri, rdir, pos: route[ri], range: e.range || 1, alive: true };
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
  // Faros de camión: iluminan una fila de puntos desde "from" hacia "dir" (los tapa un cajón o una barrica)
  const lights = (L.lights || []).map(l => {
    const beam = []; let [x, y] = l.from; const [dx, dy] = DIRS[l.dir];
    for (let i = 0; i < (l.len || 3); i++) { if (!nodes.has(K(x, y))) break; beam.push(K(x, y)); x += dx; y += dy; }
    return { beam, dir: l.dir, every: l.every || 0, on: l.on || 1, phase: l.phase || 0, truck: l.truck };
  });
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const period = [...trains.map(t => t.every), ...doors.map(d => d.every), ...lights.filter(l => l.every).map(l => l.every)].reduce((a, b) => a * b / gcd(a, b), 1);
  const lv = { name: L.name, tip: L.tip, nodes, adj, start, goal, cover, trains, doors, lights, period, throwRange: L.throwRange || 3 };
  const crates = (L.crates || []).map(c => K(...c)).sort();
  const items = (L.stones || []).map(c => K(...c)).sort();
  lv.s0 = { p: start, moves: 0, en, over: null, crates, items, stones: L.carry || 0 };
  return lv;
}

// ¿La puerta entre a y b está abierta en el turno t?
function doorAt(lv, a, b) { return lv.doors && lv.doors.find(d => (d.a === a && d.b === b) || (d.a === b && d.b === a)); }
function doorOpen(d, t) { return ((t + d.phase) % d.every + d.every) % d.every < d.open; }
function canPass(lv, a, b, t) { if (!lv.adj.get(a).has(b)) return false; const d = doorAt(lv, a, b); return !d || doorOpen(d, t); }
// ¿El tren pasa al terminar el turno t? ¿Cuántos turnos faltan desde t?
function trainPasses(tr, t) { return t > 0 && (t + tr.phase) % tr.every === 0; }
function trainIn(tr, t) { const r = (t + tr.phase) % tr.every; return r === 0 ? tr.every : tr.every - r; }

// Faros: ¿está prendido en el turno t? ¿Qué puntos ilumina?
function lightOn(l, t) { return !l.every || ((t + l.phase) % l.every + l.every) % l.every < l.on; }
function litNodes(lv, l, t, s) {
  if (!lightOn(l, t)) return [];
  const out = [];
  for (const k of l.beam) { if ((s && s.crates && s.crates.includes(k)) || lv.cover.has(k)) break; out.push(k); }
  return out;
}
// Distancias por los caminos (los cajones cortan el paso)
function distances(lv, from, s, max = 99) {
  const d = new Map([[from, 0]]); let q = [from];
  while (q.length) {
    const nq = [];
    for (const k of q) for (const n of lv.adj.get(k)) {
      if (d.has(n) || (s && s.crates && s.crates.includes(n))) continue;
      d.set(n, d.get(k) + 1); if (d.get(n) < max) nq.push(n);
    }
    q = nq;
  }
  return d;
}
// Puntos a los que se puede tirar una piedra: en línea recta, hasta throwRange casilleros
function throwTargets(lv, s) {
  if (!s.stones) return [];
  const out = [], [x, y] = P(s.p);
  for (const [dx, dy] of Object.values(DIRS))
    for (let i = 1; i <= lv.throwRange; i++) { const k = K(x + dx * i, y + dy * i); if (lv.nodes.has(k) && !(s.crates || []).includes(k)) out.push(k); }
  return out;
}
// Acciones posibles: moverse a un vecino, o tirar una piedra ("T:x,y")
function actions(lv, s) {
  const a = [...lv.adj.get(s.p)];
  for (const k of throwTargets(lv, s)) a.push('T:' + k);
  return a;
}
// Dirección que más acerca de "a" a "b"
function dirToward(a, b) {
  const [ax, ay] = P(a), [bx, by] = P(b), dx = bx - ax, dy = by - ay;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

function nextIdx(e) {
  return e.loop ? (e.ri + 1) % e.route.length : e.ri + e.rdir;
}
function facing(lv, e) {
  if (e.t === 'dog') return null;
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
function sight(lv, e, t, s) {
  if (e.t === 'dog') return [];
  if (e.t !== 'sentry') {
    // el capataz con farol (patrulla con range) ve también los puntos que siguen en línea recta
    const f = facing(lv, e); if (!f) return [];
    const out = [f];
    if ((e.range || 1) > 1) {
      const [x0, y0] = P(e.pos), [x1, y1] = P(f), dx = x1 - x0, dy = y1 - y0;
      let cur = f;
      for (let i = 1; i < e.range; i++) {
        const [x, y] = P(cur), n = K(x + dx, y + dy);
        if (!lv.adj.get(cur).has(n) || lv.cover.has(n) || (s && s.crates && s.crates.includes(n))) break;
        out.push(n); cur = n;
      }
    }
    return out;
  }
  const out = []; const [dx, dy] = DIRS[e.face];
  let cur = e.pos;
  for (let i = 0; i < (e.range || 1); i++) {
    const [x, y] = P(cur), n = K(x + dx, y + dy);
    if (!lv.adj.get(cur).has(n)) break;
    if (t !== undefined && !canPass(lv, cur, n, t)) break;
    if (lv.cover && lv.cover.has(n)) break;
    if (s && s.crates && s.crates.includes(n)) break;
    out.push(n); cur = n;
  }
  return out;
}
function faceVec(lv, e) {
  if (e.t === 'sentry' || e.t === 'dog') return DIRS[e.face];
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
  if (s.over) return null;
  const crates0 = s.crates || [];
  let throwAt = null;
  if (to.startsWith('T:')) { throwAt = to.slice(2); if (!throwTargets(lv, s).includes(throwAt)) return null; to = s.p; }
  else if (!canPass(lv, s.p, to, s.moves)) return null;
  const ns = { p: to, moves: s.moves + 1, en: s.en.map(e => ({ ...e })), over: null, by: null, crates: crates0, items: s.items || [], stones: s.stones || 0 };
  const ev = [];
  if (throwAt) {
    ns.stones--; ev.push({ k: 'throw', from: s.p, at: throwAt });
    // los que están cerca del ruido se dan vuelta a mirar; los perros corren hacia la piedra
    for (const e of ns.en) {
      if (!e.alive) continue;
      const [ex, ey] = P(e.pos), [tx, ty] = P(throwAt), md = Math.abs(ex - tx) + Math.abs(ey - ty);
      if (e.t === 'sentry' && !e.turn && md > 0 && md <= 2) { e.face = dirToward(e.pos, throwAt); ev.push({ k: 'alert', id: e.id }); }
      if (e.t === 'dog' && md <= 3) { e.lure = throwAt; ev.push({ k: 'alert', id: e.id }); }
    }
  } else {
    ev.push({ k: 'pmove', from: s.p, to });
    // empujar un cajón
    if (crates0.includes(to)) {
      const [px, py] = P(s.p), [tx, ty] = P(to), nx = K(2 * tx - px, 2 * ty - py);
      const blocked = !lv.nodes.has(nx) || !canPass(lv, to, nx, s.moves) || crates0.includes(nx) || nx === lv.goal || lv.cover.has(nx)
        || (s.items || []).includes(nx) || s.en.some(e => e.alive && e.pos === nx);
      if (blocked) return null;
      ns.crates = crates0.map(c => c === to ? nx : c).sort();
      ev.push({ k: 'push', from: to, to: nx });
    }
    if (ns.items.includes(to)) { ns.items = ns.items.filter(k => k !== to); ns.stones++; ev.push({ k: 'pick', at: to }); }
  }
  const hit = !throwAt && ns.en.find(e => e.alive && e.pos === to);
  if (hit && hit.t === 'dog') {   // a un perro no se lo agarra: muerde
    ns.p = s.p; ev[0].blocked = true; ns.over = 'caught'; ns.by = hit.id; ev.push({ k: 'caught', id: hit.id }); return { s: ns, ev };
  }
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
    if (e.t === 'dog') {
      // el perro olfatea: si estás a "smell" pasos o menos, viene; si no, vuelve a su cucha. No se aleja más de "leash" de la cucha.
      const dHome = distances(lv, e.home, ns);
      const target = e.lure || null; delete e.lure;
      const dP = distances(lv, ns.p, ns);
      let goal = target;
      if (!goal && (dP.get(e.pos) ?? 99) <= e.smell) goal = ns.p;
      if (!goal && e.pos !== e.home) goal = e.home;
      if (!goal) continue;
      const dG = goal === ns.p ? dP : distances(lv, goal, ns);
      let best = null;
      for (const n of lv.adj.get(e.pos)) {
        if ((dHome.get(n) ?? 99) > e.leash) continue;
        if (ns.crates.includes(n) || ns.en.some(o => o !== e && o.alive && o.pos === n)) continue;
        if ((dG.get(n) ?? 99) < (dG.get(e.pos) ?? 99) && (!best || (dG.get(n) < dG.get(best)))) best = n;
      }
      if (!best) { if (goal === ns.p) ev.push({ k: 'bark', id: e.id }); continue; }
      const from = e.pos; e.face = dirToward(from, best); e.pos = best;
      ev.push({ k: 'emove', id: e.id, from, to: best, dog: true });
      if (best === ns.p) { ns.over = 'caught'; ns.by = e.id; ev.push({ k: 'caught', id: e.id, bite: true }); return { s: ns, ev }; }
      continue;
    }
    if (e.turn) { e.ti = (e.ti + 1) % e.turn.length; e.face = e.turn[e.ti]; ev.push({ k: 'eturn', id: e.id }); }
    const f = facing(lv, e);
    if (sight(lv, e, ns.moves, ns).includes(ns.p)) { ns.over = 'caught'; ns.by = e.id; ev.push({ k: 'caught', id: e.id, lunge: true }); return { s: ns, ev }; }
    if (e.t === 'patrol') {
      if (ns.crates.includes(f) || ns.en.some(o => o !== e && o.alive && o.pos === f)) { ev.push({ k: 'wait', id: e.id }); continue; }
      const from = e.pos; advance(e);
      ev.push({ k: 'emove', id: e.id, from, to: e.pos });
    }
  }
  // faros: si quedás en la luz, te ven
  for (let i = 0; i < lv.lights.length; i++) {
    if (litNodes(lv, lv.lights[i], ns.moves, ns).includes(ns.p)) { ns.over = 'caught'; ns.by = 'light'; ns.light = i; ev.push({ k: 'caught', light: i }); return { s: ns, ev }; }
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
const keyOf = s => s.p + '|' + (PERIOD > 1 ? s.moves % PERIOD : '') + '|' + (s.crates || []).join('/') + '|' + (s.items || []).join('/') + '|' + (s.stones || 0) + '|' + s.en.map(e => e.alive ? e.pos + ':' + e.ri + ':' + e.rdir + ':' + (e.turn ? e.ti : e.face || '') : 'x').join(';');

// Resolvedor: búsqueda en anchura sobre todos los estados posibles.
// Devuelve la secuencia más corta de casillas o null si no hay salida.
function solve(lv, s0, limit = 200000) {
  PERIOD = lv.period || 1;
  const seen = new Map([[keyOf(s0), null]]);
  let q = [s0], explored = 0;
  while (q.length) {
    const nq = [];
    for (const s of q) {
      for (const to of actions(lv, s)) {
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

if (typeof module !== 'undefined') module.exports = { parseLevel, step, solve, facing, nextFacing, sight, faceVec, doorAt, doorOpen, canPass, trainPasses, trainIn, keyOf, actions, throwTargets, litNodes, lightOn, distances, K, P, DIRS };
