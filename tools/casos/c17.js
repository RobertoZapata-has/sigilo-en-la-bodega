const L = require('../../src/logic.js');
const map = [
  'S-o-o-o-o-o',
  '|   |   | |',
  'o-o-o-o-o-o',
  '|   |   | |',
  'o-o-o-o-o-o',
  '  |   |   |',
  'o-o-o-o-o-G',
];
// camiones a la izquierda: sus faros barren las filas 1 y 3 hacia el este
const lights = [{ from: [0, 1], dir: 'E', len: 6, every: 3, on: 2, phase: 0 }, { from: [5, 2], dir: 'W', len: 6 }];
const crates = [[4, 1], [2, 3]];
module.exports = {
  base: { map, lights, crates },
  avoid: ['0,1', '1,1', '2,1', '3,1', '5,1', '0,2', '1,2', '2,2', '3,2', '4,2', '5,2'],
  pool: [{ t: 'sentry' }, { t: 'range', range: 2 }, { t: 'patrol', opts: [{ route: [[0, 3], [1, 3], [2, 3], [3, 3]], range: 2 }, { route: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], range: 2 }] }],
  n: [1, 3], len: [10, 18], iters: 15000, seed: 17,
  must: (lv, p, en) => {
    let s = lv.s0, pushed = false;
    for (const a of p) { const r = L.step(lv, s, a); if (r.ev.some(e => e.k === 'push')) pushed = true; s = r.s; }
    return pushed;
  },
};
