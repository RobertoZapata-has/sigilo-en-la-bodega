const L = require('../../src/logic.js');
const map = [
  'S-o-o   o-o-o',
  '|   |   |   |',
  'o-o-o-o-o-o-o',
  '  |       |  ',
  '  o-o-o-o-o  ',
  '  |       |  ',
  'o-o-o   o-o-G',
];
const trains = [{ y: 1, x0: 0, x1: 6, every: 4, phase: 2 }];
const tracks = []; for (let x = 0; x <= 6; x++) tracks.push(x + ',1');
module.exports = {
  base: { map, trains }, avoid: tracks,
  pool: [{ t: 'turn' }, { t: 'range', range: 2 }, { t: 'patrol', opts: [
    { route: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2]] }, { route: [[3, 0], [4, 0], [5, 0], [6, 0]] }, { route: [[0, 3], [1, 3], [2, 3]] }, { route: [[4, 3], [5, 3], [6, 3]] }] }, { t: 'turn' }, { t: 'sentry' }],
  n: [3, 5], len: [13, 22], iters: 15000, seed: 33,
  must: (lv, p, en) => {
    const usesRoof = p.some(k => k.endsWith(',2')), usesTrack = p.some(k => k.endsWith(',1'));
    return usesRoof && usesTrack;
  },
};
