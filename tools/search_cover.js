// Busca vigías para un mapa con barricas: la solución tiene que pasar por una barrica
// y, si se sacan las barricas, el nivel no tiene que tener solución.
const L=require('../src/logic.js');
const map=process.argv[2]?JSON.parse(process.argv[2]):[
 'S-o-b-o-o-o',
 '|   |   | |',
 'o-o-o-b-o-o',
 '    |     |',
 '    o-o-o-G'];
const noCover=map.map(r=>r.replace(/b/g,'o'));
const base=L.parseLevel({name:'x',map});
const keys=[...base.nodes.keys()].filter(k=>k!==base.start&&k!==base.goal&&!base.cover.has(k));
const D=['N','S','E','W'];
let rng=7;const R=()=>{rng=(rng*16807)%2147483647;return rng/2147483647};
const out=[];
for(let it=0;it<40000;it++){
  const n=2+Math.floor(R()*2), en=[], used=new Set();
  for(let i=0;i<n;i++){const k=keys[Math.floor(R()*keys.length)];if(used.has(k))continue;used.add(k);
    en.push({t:'sentry',at:k.split(',').map(Number),face:D[Math.floor(R()*4)],range:i===0?3:(R()<0.4?2:1)});}
  const d={name:'b',map,enemies:en};
  let lv;try{lv=L.parseLevel(d)}catch(e){continue}
  if(lv.s0.en.some(e=>L.sight(lv,e).length===0))continue;
  if(lv.s0.en.some(e=>L.sight(lv,e).includes(lv.start)))continue;
  const r=L.solve(lv,lv.s0); if(!r||!r.path)continue;
  if(!r.path.some(k=>lv.cover.has(k)))continue;
  const lv2=L.parseLevel({name:'y',map:noCover,enemies:en}); const r2=L.solve(lv2,lv2.s0);
  if(r2&&r2.path)continue;
  out.push({len:r.path.length,en,p:r.path.join(' ')});
}
out.sort((a,b)=>b.len-a.len);
const seen=new Set();
for(const o of out.slice(0,60)){const k=JSON.stringify(o.en);if(seen.has(k))continue;seen.add(k);console.log(o.len,o.p,'|',k);}
console.log('total',out.length);
