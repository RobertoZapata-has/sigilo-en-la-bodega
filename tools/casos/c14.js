const L = require('../../src/logic.js');
const map = [
  'S-o-o-o-o-o',
  '|   |   | |',
  'o-o-o-o-o-o',
  '|   |   | |',
  'o-o-o-o-o-G',
];
const crates = [[1, 1], [3, 2]];
module.exports = {
  base: { map, crates },
  pool: [{ t: 'range', range: 3 }, { t: 'range', range: 3 }, { t: 'sentry' }, { t: 'patrol', opts: [{ route: [[1, 2], [2, 2], [3, 2], [4, 2]] }, { route: [[2, 0], [3, 0], [4, 0], [5, 0]], range: 2 }] }],
  n: [2, 4], len: [9, 15], iters: 20000, seed: 14,
  must: (lv, p, en) => {
    // tiene que empujar algún cajón, y sin cajones no se puede igual de corto
    let s = lv.s0, pushed = false;
    for (const a of p) { const r = L.step(lv, s, a); if (r.ev.some(e => e.k === 'push')) pushed = true; s = r.s; }
    if (!pushed) return false;
    const lv2 = L.parseLevel({ name: 'y', map, enemies: en });
    const r2 = L.solve(lv2, lv2.s0); return !(r2 && r2.path && r2.path.length <= p.length);
  },
};
