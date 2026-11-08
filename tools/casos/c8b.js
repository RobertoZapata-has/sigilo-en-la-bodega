const L = require('../../src/logic.js');
const map = [
  'S-o-o-b-o-o-o',
  '|   |   |   |',
  'o-b-o-o-o-b-o',
  '|   |   |   |',
  'o-o-o-b-o-o-G',
];
module.exports = {
  base: { map },
  pool: [{ t: 'range', range: 3 }, { t: 'turn' }, { t: 'range', range: 2 }, { t: 'sentry' }],
  n: [2, 4], len: [9, 16], iters: 25000, seed: 9,
  must: (lv, p, en) => {
    if (p.filter(k => lv.cover.has(k)).length < 1) return false;
    const lv2 = L.parseLevel({ name: 'y', map: map.map(r => r.replace(/b/g, 'o')), enemies: en });
    const r2 = L.solve(lv2, lv2.s0); return !(r2 && r2.path && r2.path.length <= p.length);
  },
};
