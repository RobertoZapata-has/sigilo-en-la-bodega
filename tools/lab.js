const L=require('../src/logic.js');
function analyze(d){const lv=L.parseLevel(d);const r=L.solve(lv,lv.s0);
 // árbol de decisiones: cuántos estados alcanzables son "perdedores" (sin salida o atrapado)
 let traps=0,total=0;const seen=new Set();let q=[lv.s0];
 const key=s=>JSON.stringify([s.p,s.moves%(lv.period||1),s.en.map(e=>[e.alive,e.pos,e.ri,e.rdir,e.ti])]);
 while(q.length){const s=q.pop();for(const t of lv.adj.get(s.p)){const x=L.step(lv,s,t);if(!x)continue;total++;if(x.s.over==='caught'){traps++;continue;}if(x.s.over)continue;const k=key(x.s);if(seen.has(k))continue;seen.add(k);q.push(x.s);}}
 console.log((d.name+'               ').slice(0,16),r.path?('mín '+r.path.length+' → '+r.path.join(' ')):'SIN SOLUCIÓN','| movidas mortales',traps+'/'+total);}
module.exports=analyze;
// Uso directo: node tools/lab.js  → revisa todos los niveles
if (require.main === module) require('../src/levels.js').forEach(module.exports);
