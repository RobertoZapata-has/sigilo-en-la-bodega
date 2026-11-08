const L = require('../../src/logic.js');
const map = [
  'S-o-b-o-o-o',
  '|   |   | |',
  'o-o-o-o-b-o',
  '|   |     |',
  'o-b-o-o-o-G',
];
module.exports = {
  base: { map },
  pool: [{ t: 'range', range: 3 }, { t: 'turn' }, { t: 'sentry' }],
  n: [2, 3], len: [9, 14], iters: 20000, seed: 5,
  must: (lv, p, en) => {
    if (!p.some(k => lv.cover.has(k))) return false;
    const lv2 = L.parseLevel({ name: 'y', map: map.map(r => r.replace(/b/g, 'o')), enemies: en });
    const r2 = L.solve(lv2, lv2.s0); return !(r2 && r2.path && r2.path.length <= p.length);
  },
};
