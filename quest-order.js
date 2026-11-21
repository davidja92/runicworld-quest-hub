(function(root){
 'use strict';
 const key=s=>String(s).toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
 const xp=l=>{let n=0;for(let i=1;i<l;i++)n+=Math.floor(i+300*2**(i/7));return Math.floor(n/4);};
 function create(catalog,player={}){
  const done=player.done||{},skills=player.skills||{},index=new Map();
  for(const q of catalog)for(const n of [q.name,...(q.aliases||[])])index.set(key(n),q);
  const resolve=n=>index.get(key(n));
  const completed=n=>!!done[resolve(n)?.name||n];
  function assess(q,{planned=new Set(),points=player.questPoints}={}){
   const missingQuests=new Set(),partial=new Set(),unknown=new Set(),needed={},visiting=new Set(),visited=new Set();let qp=0,cycle=false;
   function visit(t){
    if(visiting.has(t.name)){cycle=true;return;}if(visited.has(t.name))return;
    visiting.add(t.name);
    if(!t.requirementsKnown)unknown.add(t.name);
    if(t.requirementsKnown&&Number.isInteger(t.questPoints))qp=Math.max(qp,t.questPoints);
    for(const [s,l]of Object.entries(t.skills||{}))needed[s]=Math.max(needed[s]||0,l);
    for(const n of t.partialQuests||[])if(!completed(n))partial.add(n);
    for(const n of t.quests||[]){const r=resolve(n);if(completed(n)||planned.has(r?.name||n))continue;missingQuests.add(r?.name||n);if(r)visit(r);else unknown.add(n);}
    visiting.delete(t.name);visited.add(t.name);
   }
   visit(q);
   const missingSkills=Object.entries(needed).filter(([s,l])=>Number.isFinite(skills[s])&&skills[s]<l);
   const unknownSkills=Object.keys(needed).filter(s=>!Number.isFinite(skills[s]));
   const qpUnknown=qp>0&&!Number.isFinite(points),qpMissing=qpUnknown?0:Math.max(0,qp-(points||0));
   const trainingXp=missingSkills.reduce((n,[s,l])=>n+Math.max(0,xp(l)-xp(skills[s])),0);
   const ready=!cycle&&!missingQuests.size&&!partial.size&&!unknown.size&&!unknownSkills.length&&!missingSkills.length&&!qpUnknown&&!qpMissing;
   return {ready,missingQuests:[...missingQuests],partial:[...partial],unknown:[...unknown],unknownSkills,missingSkills,qp,qpUnknown,qpMissing,trainingXp,cycle};
  }
  const impacts=new Map(catalog.map(q=>[q.name,new Set()]));
  for(const q of catalog){const seen=new Set();function visit(t){for(const n of t.quests||[]){const r=resolve(n);if(!r||seen.has(r.name))continue;seen.add(r.name);if(!completed(q.name))impacts.get(r.name).add(q.name);visit(r);}}visit(q);}
  const remaining=catalog.filter(q=>!completed(q.name)),ordered=[],planned=new Set();let points=Number.isFinite(player.questPoints)?player.questPoints:null;
  const reward=q=>{const r=player.reward?player.reward(q):q.qpReward;return Number.isInteger(r)&&r>=0?r:0;};
  while(remaining.length){
   let candidates=remaining.filter(q=>(q.quests||[]).every(n=>completed(n)||planned.has(resolve(n)?.name||n)));
   // Cycles and absent prerequisite records stay visible, but never count as ready.
   if(!candidates.length)candidates=[...remaining];
   const score=q=>{const a=assess(q,{planned,points});return [a.cycle||a.unknown.length||a.unknownSkills.length||a.partial.length||a.qpUnknown?3:a.missingSkills.length?2:a.qpMissing?1:0,a.trainingXp,a.qpMissing,-impacts.get(q.name).size,q.wikiRank??999,-reward(q)];};
   const scores=new Map(candidates.map(q=>[q.name,score(q)]));
   candidates.sort((a,b)=>{const aa=scores.get(a.name),bb=scores.get(b.name);for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return a.name.localeCompare(b.name);});
   const q=candidates[0];remaining.splice(remaining.indexOf(q),1);ordered.push(q);planned.add(q.name);
   if(points!==null&&q.requirementsKnown)points+=reward(q);
  }
  ordered.push(...catalog.filter(q=>completed(q.name)).sort((a,b)=>a.name.localeCompare(b.name)));
  return {ordered,assess,impact:q=>impacts.get(q.name)?.size||0};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuestOrder=api;
})(typeof globalThis!=='undefined'?globalThis:this);

