const L = require('../../src/logic.js');
const map = [
  'S-o-o-o-o-o',
  '|   |   | |',
  'o-o-o-o-o-o',
  '|     |   |',
  'o-o-o-o-o-G',
];
const stones = [[1, 0]];
module.exports = {
  base: { map, stones, throwRange: 3 },
  pool: [{ t: 'sentry' }, { t: 'range', range: 2 }, { t: 'sentry' }, { t: 'dog', smell: 2, leash: 1 }],
  n: [2, 4], len: [8, 14], iters: 15000, seed: 16,
  must: (lv, p, en) => {
    if (!p.some(a => a.startsWith('T:'))) return false;
    const lv2 = L.parseLevel({ name: 'y', map, enemies: en });
    const r2 = L.solve(lv2, lv2.s0); return !(r2 && r2.path);
  },
};
