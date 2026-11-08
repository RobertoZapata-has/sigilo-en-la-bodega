const L = require('../../src/logic.js');
const map = [
  'S-o-o-o-o-o',
  '|   |   |  ',
  'o-o-o-o-o-o',
  '  |   |   |',
  'o-o-o-o-o-o',
  '|   |   |  ',
  'o-o-o-o-o-o',
  '  |   |   |',
  'o-o-o-o-o-G',
];
const trains = [{ y: 1, x0: 0, x1: 5, every: 3, phase: 0 }, { y: 3, x0: 0, x1: 5, every: 4, phase: 1, dir: -1 }];
const tracks = []; for (let x = 0; x <= 5; x++) tracks.push(x + ',1', x + ',3');
module.exports = {
  base: { map, trains }, avoid: tracks,
  pool: [{ t: 'turn' }, { t: 'sentry' }, { t: 'patrol', opts: [
    { route: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]] },
    { route: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] },
    { route: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] } ] }, { t: 'turn' }],
  n: [2, 4], len: [11, 18], iters: 12000, seed: 3,
  must: (lv, p, en) => {
    const lv2 = L.parseLevel({ name: 'y', map, enemies: en });
    const r2 = L.solve(lv2, lv2.s0); return !(r2 && r2.path && r2.path.length <= p.length - 2);
  },
};
