const L = require('../../src/logic.js');
const map = [
  'S-o-o-o-o-o-o',
  '|   |   |   |',
  'o-o-o-o-o-o-o',
  '|     |     |',
  'o-o-o-o-o-o-o',
  '  |   |   |  ',
  'o-o-o-o-o-o-G',
];
const lights = [{ from: [6, 2], dir: 'W', len: 7, every: 4, on: 3, phase: 1 }];
const crates = [[3, 1]];
const stones = [[0, 2]];
module.exports = {
  base: { map, lights, crates, stones },
  avoid: ['0,2', '1,2', '2,2', '3,2', '4,2', '5,2', '6,2'],
  pool: [{ t: 'dog', smell: 2, leash: 2 }, { t: 'patrol', opts: [{ route: [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]], range: 2 }, { route: [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0]], range: 2 }, { route: [[1, 1], [2, 1]], range: 2 }] }, { t: 'range', range: 3 }, { t: 'turn' }, { t: 'sentry' }],
  n: [3, 5], len: [14, 24], iters: 6000, seed: 18,
  must: (lv, p, en) => {
    let s = lv.s0; const used = new Set();
    for (const a of p) { const r = L.step(lv, s, a); r.ev.forEach(e => used.add(e.k === 'emove' && e.dog ? 'dog' : e.k)); s = r.s; }
    return used.has('push') && used.has('throw');
  },
};
