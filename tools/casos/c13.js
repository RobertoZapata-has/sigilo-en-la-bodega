const L = require('../../src/logic.js');
module.exports = {
  base: { map: [
    'S-o-o-o-o-o',
    '|   |     |',
    'o-o-o-o-o-o',
    '|     |   |',
    'o-o-o-o-o-G',
  ] },
  pool: [{ t: 'patrol', opts: [
    { route: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]], range: 2 },
    { route: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], range: 2 },
    { route: [[1, 2], [2, 2], [3, 2], [4, 2]], range: 2 },
    { route: [[2, 0], [3, 0], [4, 0], [5, 0]], range: 2 }] }, { t: 'sentry' }, { t: 'turn' }],
  n: [1, 3], len: [8, 13], iters: 15000, seed: 13,
  must: (lv, p, en) => {
    // sin el farol (range 1) tiene que haber un camino más corto
    const en2 = en.map(e => Object.assign({}, e, { range: 1 }));
    const lv2 = L.parseLevel({ name: 'y', map: module.exports.base.map, enemies: en2 });
    const r2 = L.solve(lv2, lv2.s0); return r2 && r2.path && r2.path.length < p.length;
  },
};
