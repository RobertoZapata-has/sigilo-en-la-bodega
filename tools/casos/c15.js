const L = require('../../src/logic.js');
const map = [
  'S-o-o-o-o-o',
  '|   |   |  ',
  'o-o-o-o-o-o',
  '  |   |   |',
  'o-o-o-o-o-o',
  '|   |   |  ',
  'o-o-o-o-o-G',
];
module.exports = {
  base: { map },
  pool: [{ t: 'dog', smell: 2 }, { t: 'dog', smell: 2 }, { t: 'sentry' }, { t: 'range', range: 2 }],
  n: [2, 4], len: [10, 16], iters: 12000, seed: 15,
  must: (lv, p, en) => {
    // los perros tienen que moverse durante la solución
    let s = lv.s0, dogMoves = 0;
    for (const a of p) { const r = L.step(lv, s, a); dogMoves += r.ev.filter(e => e.k === 'emove' && e.dog).length; s = r.s; }
    if (dogMoves < 2) return false;
    const lv2 = L.parseLevel({ name: 'y', map, enemies: en.filter(e => e.t !== 'dog') });
    const r2 = L.solve(lv2, lv2.s0); return r2 && r2.path && r2.path.length < p.length;
  },
};
