// Buscador genérico de guardias para un mapa (capítulo 2 en adelante).
// Uso: node tools/search2.js tools/casos/<caso>.js
// El caso exporta { base: {map, trains?, doors?, ...}, pool: [plantillas], n: [min,max], len: [min,max], must?: (lv, path)=>bool, iters? }
const L = require('../src/logic.js');
const C = require(require('path').resolve(process.argv[2]));
let rng = C.seed || 11; const R = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; };
const pick = a => a[Math.floor(R() * a.length)];
const base = L.parseLevel(Object.assign({ name: 'x' }, C.base));
const free = [...base.nodes.keys()].filter(k => k !== base.start && k !== base.goal && !base.cover.has(k) && !(C.avoid || []).includes(k));
const D = ['N', 'S', 'E', 'W'];
const TURNS = [['E', 'S', 'W', 'N'], ['N', 'E', 'S', 'W'], ['E', 'W'], ['N', 'S'], ['W', 'N', 'E', 'S'], ['S', 'N']];
function deadly(lv) {
  let traps = 0, total = 0; const seen = new Set(); const q = [lv.s0];
  const key = s => L.keyOf(s);
  while (q.length && seen.size < 40000) { const s = q.pop(); for (const t of lv.adj.get(s.p)) { const x = L.step(lv, s, t); if (!x) continue; total++; if (x.s.over === 'caught') { traps++; continue; } if (x.s.over) continue; const k = key(x.s); if (seen.has(k)) continue; seen.add(k); q.push(x.s); } }
  return [traps, total];
}
function make(tpl, used) {
  for (let tries = 0; tries < 20; tries++) {
    const k = tpl.at ? tpl.at : pick(free).split(',').map(Number);
    const key = k.join(',');
    if (used.has(key)) continue;
    if (tpl.t === 'turn') { const tu = tpl.turn || pick(TURNS); return { t: 'sentry', at: k, turn: tu, ti: tpl.ti !== undefined ? tpl.ti : Math.floor(R() * tu.length) }; }
    if (tpl.t === 'range') return { t: 'sentry', at: k, face: tpl.face || pick(D), range: tpl.range || 3 };
    if (tpl.t === 'patrol') return Object.assign({ t: 'patrol' }, tpl.opts[Math.floor(R() * tpl.opts.length)], { start: Math.floor(R() * 3) });
    return { t: 'sentry', at: k, face: tpl.face || pick(D) };
  }
  return null;
}
const out = [];
for (let it = 0; it < (C.iters || 20000); it++) {
  const n = C.n[0] + Math.floor(R() * (C.n[1] - C.n[0] + 1));
  const en = [], used = new Set();
  const fixed = C.fixed || [];
  for (const f of fixed) { en.push(f); if (f.at) used.add(f.at.join(',')); }
  for (let i = 0; i < n; i++) { const tpl = C.pool[i % C.pool.length]; const e = make(tpl, used); if (!e) continue; if (e.at) used.add(e.at.join(',')); en.push(e); }
  const d = Object.assign({ name: 'c' }, C.base, { enemies: en });
  let lv; try { lv = L.parseLevel(d); } catch (e) { continue; }
  if (lv.s0.en.some(e => e.t === 'sentry' && !e.turn && L.sight(lv, e, 0).length === 0)) continue;
  if (lv.s0.en.some(e => e.pos && L.sight(lv, e, 0).includes(lv.start))) continue;
  const r = L.solve(lv, lv.s0, 300000); if (!r || !r.path) continue;
  if (r.path.length < C.len[0] || r.path.length > C.len[1]) continue;
  if (C.must && !C.must(lv, r.path, en)) continue;
  const [tr, tot] = deadly(lv);
  // castigo por esperar: movidas que vuelven al punto anterior
  let back = 0; for (let i = 2; i < r.path.length; i++) if (r.path[i] === r.path[i - 2]) back++;
  const kills = r.path.filter(k => en.some(e => e.at && e.at.join(',') === k)).length;
  const score = r.path.length + tr / Math.max(1, tot) * 20 - back * 1.5 + kills * 0.5;
  out.push({ score, len: r.path.length, tr, tot, back, en, p: r.path.join(' ') });
}
out.sort((a, b) => b.score - a.score);
const seen = new Set();
for (const o of out.slice(0, 25)) { const k = JSON.stringify(o.en); if (seen.has(k)) continue; seen.add(k); console.log(o.score.toFixed(1), 'mín', o.len, 'mort', o.tr + '/' + o.tot, 'idas-vueltas', o.back, '|', o.p, '\n   ', k); }
console.log('total', out.length);
