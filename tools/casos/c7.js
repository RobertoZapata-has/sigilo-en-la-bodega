module.exports = {
  base: { map: [
    'S-o-o-o-o',
    '|   |   |',
    'o-o-o-o-o',
    '  |   |  ',
    '  o-o-o-G',
  ] },
  pool: [{ t: 'turn' }, { t: 'sentry' }],
  n: [1, 2], len: [7, 10], iters: 15000,
  must: (lv, p, en) => en.some(e => e.turn) && p.some(k => { const t = en.find(e => e.turn); const [x, y] = t.at; return Math.abs(k.split(',')[0] - x) + Math.abs(k.split(',')[1] - y) === 1; }),
};
