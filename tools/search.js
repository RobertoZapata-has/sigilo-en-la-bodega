const L=require('../src/logic.js');
const map=['S-o-o      ','|   |      ','o   o-o-o  ','|   | | |  ','o-o-o-o-o  ','    | | |  ','    o-o-o-o','    |     |','    o-o-o-G'];
const ring=[[2,1],[3,1],[4,1],[4,2],[4,3],[3,3],[2,3],[2,2]];
const base=L.parseLevel({name:'x',map});
const cells=[...base.nodes.keys()].filter(k=>!['0,0','5,4','3,2'].includes(k)&&!ring.map(String).includes(k));
const ringK=ring.map(String);
const D=['N','S','E','W'];
let rng=1;const R=()=>{rng=(rng*16807)%2147483647;return rng/2147483647};
const out=[];
for(let it=0;it<6000;it++){
  const n=1+Math.floor(R()*3);const en=[];const used=new Set();
  const pool=[...cells,...ringK.filter(k=>!['2,1'].includes(k))];
  for(let i=0;i<n;i++){const k=pool[Math.floor(R()*pool.length)];if(used.has(k))continue;used.add(k);en.push({t:'sentry',at:k.split(',').map(Number),face:D[Math.floor(R()*4)]});}
  const st=Math.floor(R()*8); const rev=R()<.5;
  const route=rev?[...ring].reverse():ring;
  if(used.has(String(route[st]))) continue;
  const d={name:'b',map,enemies:[{t:'patrol',loop:true,start:st,route},...en]};
  let lv;try{lv=L.parseLevel(d)}catch(e){continue}
  if(lv.s0.en.some(e=>e.t==='sentry'&&!L.facing(lv,e)))continue;
  const r=L.solve(lv,lv.s0); if(!r||!r.path)continue;
  const p=r.path; if(!p.includes('3,2'))continue;
  // la solución ingenua (camino más corto del grafo) debe fallar
  out.push({len:p.length,d,p:p.join(' ')});
}
out.sort((a,b)=>b.len-a.len);
const seen=new Set();
for(const o of out.slice(0,40)){const k=JSON.stringify(o.d.enemies);if(seen.has(k))continue;seen.add(k);console.log(o.len,o.p,'|',JSON.stringify(o.d.enemies));}
