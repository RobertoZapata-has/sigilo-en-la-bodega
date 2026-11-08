const L = require('../../src/logic.js');
const map = [
  'o-o-o-o-o-o-o-o-o',
  '|     |     |   |',
  'S-o-o-o-o-o-o-o-G',
  '  |     |     |  ',
  '  o     o     o  ',
];
const doors = [{ a: [2, 1], b: [3, 1], every: 3, open: 1, phase: 0 }, { a: [5, 1], b: [6, 1], every: 3, open: 1, phase: 1 }];
module.exports = {
  base: { map, doors },
  pool: [{ t: 'patrol', opts: [{ route: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]] }, { route: [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]] }, { route: [[3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]] }] }, { t: 'turn' }, { t: 'sentry' }, { t: 'turn' }],
  n: [2, 4], len: [11, 18], iters: 15000, seed: 21,
  must: (lv, p, en) => {
    if (!p.some((k, i) => i > 0 && L.doorAt(lv, k, p[i - 1]))) return false;
    const lv2 = L.parseLevel({ name: 'y', map, enemies: en });
    const r2 = L.solve(lv2, lv2.s0); return !(r2 && r2.path && r2.path.length >= p.length - 1);
  },
};
