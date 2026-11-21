(function(root){
 'use strict';
 const key=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
 const xpForLevel=l=>{let sum=0;for(let i=1;i<l;i++)sum+=Math.floor(i+300*2**(i/7));return Math.floor(sum/4);};
 const mini=/wintertodt|tempoross|guardians of the rift|pest control|blast furnace|tithe farm|sorceress|mahogany homes|trouble brewing|fishing trawler|giants.? foundry|rogues.? den|barbarian assault|soul wars|nightmare zone/i;
 const priority={"Druidic Ritual":'Open Herblore before processing your herbs.',"Tree Gnome Village":'Prioritize the spirit-tree travel network if enabled on RunicWorld.',"The Grand Tree":'Work toward gnome travel and the Monkey Madness chain.',"Priest in Peril":'Open Morytania quest chains and resource access.',"Fairytale I - Growing Pains":'Work toward farming equipment and the fairy-ring quest chain.',"Ghosts Ahoy":'Work toward the Ectophial travel option.',"Animal Magnetism":'Work toward your ranged ammunition-saving device.',"Lost City":'Open Zanaris and the fairy quest chain.',"Lunar Diplomacy":'Work toward the Lunar spellbook and production utility.',"My Arm's Big Adventure":'Work toward the Troll Stronghold farming patch.',"Throne of Miscellania":'Check whether kingdom resource management works on your server.'};
 const common={Prayer:/dragon bones|big bones|^bones(?:\s|$)/i,Herblore:/attack potion|antipoison|strength potion|restore potion|prayer potion|super attack|super strength|super restore|ranarr|guam/i,Crafting:/bow.?string|ball of wool|leather|glass|gold.*(ring|amulet)|tiara|cut .*sapphire/i,Agility:/gnome|lumbridge|draynor|al.?kharid|varrock|canifis|falador|seers|ardougne|wilderness|barbarian.*course/i,Mining:/copper|tin|iron ore|coal|mithril ore|adamant.*ore|runite ore/i,Fishing:/shrimp|anchov|trout|salmon|lobster|monkfish|shark/i,Cooking:/shrimp|trout|salmon|lobster|monkfish|shark/i,Fletching:/shortbow|longbow|arrow shaft/i,Woodcutting:/^(logs|oak logs|willow logs|maple logs|yew logs|magic logs)$/i,Smithing:/bar|iron|steel|mithril/i,Magic:/high.*alch|fire strike|fire bolt|fire blast|superheat/i};
 function methods(skill,level,training,settings={},data={}){
  const seen=new Set();return (training[skill]||[]).filter(row=>{
   const name=row[2],meta=row[4]||{},id=row[0]+'|'+key(name)+'|'+row[1];
   if(seen.has(id)||row[0]>level||/^Item #/.test(name)||meta.category==='Quest'||!settings.minigames&&mini.test(name+' '+row[3]))return false;
   seen.add(id);return true;
  }).map(row=>{
   const m=row[4]||{},conflict=Number.isFinite(m.guideListedXp)&&Number.isFinite(row[1])&&m.guideListedXp!==row[1];
   return {level:row[0],xp:conflict?null:Number.isFinite(row[1])&&row[1]>0?row[1]:null,name:row[2],note:row[3],meta:m,conflict,ingredients:ingredients(m.note,data.itemNames||{})};
  }).sort((a,b)=>{
   const preferred=settings.methodPrefs?.[skill];const match=n=>preferred&&key(n)===key(preferred)?1:0;
   return match(b.name)-match(a.name)||(common[skill]?.test(b.name)?1:0)-(common[skill]?.test(a.name)?1:0)||b.level-a.level||a.name.localeCompare(b.name);
  });
 }
 function ingredients(note,names){
  if(!note||!/^item:\d+(?:\*\d+)?(?:\s*\+\s*item:\d+(?:\*\d+)?)*(?:\s*--[\s\S]*)?$/.test(note.trim()))return [];
  return [...note.split('--')[0].matchAll(/item:(\d+)(?:\*(\d+))?/g)].map(m=>({id:+m[1],name:names[m[1]]||'Item #'+m[1],quantity:m[2]?+m[2]:1}));
 }
 function goals(catalog,settings){
  const target={};for(const q of catalog.filter(q=>q.requirementsKnown))for(const [s,l]of Object.entries(q.skills||{}))target[s]=Math.max(target[s]||1,l);
  const presets={balanced:{Prayer:43,Magic:55,Herblore:38,Crafting:40,Agility:56},fletching:{Fletching:80,Woodcutting:60,Magic:55,Crafting:10}};
  for(const [s,l]of Object.entries(presets[settings.focus]||{}))target[s]=Math.max(target[s]||1,l);
  for(const s of settings.skills||[])if(settings.focus==='all70'||settings.focus==='all99')target[s]=Math.max(target[s]||1,settings.focus==='all99'?99:70);
  for(const [s,l]of Object.entries(settings.targets||{}))if(Number.isInteger(l)&&l>=1&&l<=99)target[s]=Math.max(target[s]||1,l);
  return target;
 }
 function build({catalog,training={},data={},player={},settings={}}){
  const byName=new Map(catalog.map(q=>[q.name,q])),done=player.done||{},current=player.skills||{},target=goals(catalog.filter(q=>!done[q.name]),settings),levels={...current};
  const remain=catalog.filter(q=>!done[q.name]),planned=new Set(Object.keys(done).filter(n=>done[n])),uncertain=new Set(),steps=[],trainingTargets={};
  let qp=Number.isFinite(player.questPoints)?player.questPoints:null,last=null;
  const reward=q=>{const n=player.reward?player.reward(q):q.qpReward;return Number.isInteger(n)&&n>=0?n:null;};
  const needed=Object.assign({},target);
  const impacts=new Map(catalog.map(q=>[q.name,new Set()]));
  for(const q of remain){const seen=new Set();function visit(t){for(const n of t.quests||[]){if(seen.has(n))continue;seen.add(n);impacts.get(n)?.add(q.name);if(byName.has(n))visit(byName.get(n));}}visit(q);}
  function distance(q){const p=data.quests?.[q.name]?.start;return p&&last&&p.map===last.map?Math.hypot(p.x-last.x,p.y-last.y):Infinity;}
  function gap(q){return Object.entries(q.skills||{}).reduce((sum,[s,l])=>sum+(Number.isFinite(levels[s])?Math.max(0,xpForLevel(l)-xpForLevel(levels[s])):0),0);}
  function train(skill,level,reason){
   if(Number.isFinite(levels[skill])&&levels[skill]>=level)return;
   const have=current[skill],first=!trainingTargets[skill],previous=levels[skill];
   steps.push({id:'train:'+skill+':'+level,type:'train',skill,target:level,from:Number.isFinite(previous)?previous:null,reason,phase:steps.filter(s=>s.type==='quest').length<20?'Foundations':'Skill bridges',first,needsPlayer:!Number.isFinite(have)});
   trainingTargets[skill]=Math.max(trainingTargets[skill]||0,level);levels[skill]=level;
  }
  while(remain.length){
   const legal=remain.filter(q=>(q.quests||[]).every(n=>planned.has(n)));
   if(!legal.length){for(const q of remain)steps.push({id:'verify:'+q.name,type:'verify',name:q.name,reason:'Resolve an absent prerequisite or dependency cycle before adding this quest.',phase:'Verify in game'});break;}
   function score(q){const unknown=!q.requirementsKnown||Object.keys(q.skills||{}).some(s=>!Number.isFinite(current[s]));const gate=q.questPoints>0&&(qp===null||q.questPoints>qp);const g=gap(q);
    const xp=data.quests?.[q.name]?.xpReference||{};const benefit=Object.entries(xp).reduce((n,[s,v])=>n+Math.min(v,Math.max(0,xpForLevel(needed[s]||1)-xpForLevel(levels[s]||1))),0);
    return [unknown?3:g?2:gate?1:0,g,gate?(qp===null?1000:q.questPoints-qp):0,-(priority[q.name]?3:0)-impacts.get(q.name).size,-benefit,distance(q),q.wikiRank??999];}
   const scores=new Map(legal.map(q=>[q.name,score(q)]));legal.sort((a,b)=>{const aa=scores.get(a.name),bb=scores.get(b.name);for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return aa[i]<bb[i]?-1:1;return a.name.localeCompare(b.name);});
   const q=legal[0];remain.splice(remain.indexOf(q),1);
   if(!q.requirementsKnown||(q.quests||[]).some(n=>uncertain.has(n))){steps.push({id:'verify:'+q.name,type:'verify',name:q.name,reason:'This entry or one of its prerequisites needs RunicWorld verification before it can be scheduled confidently.',phase:'Verify in game'});planned.add(q.name);uncertain.add(q.name);continue;}
   for(const [s,l]of Object.entries(q.skills||{}))train(s,l,'Needed for '+q.name);
   const partial=(q.partialQuests||[]).filter(n=>!done[n]&&!settings.started?.[n]);
   const pointsUnknown=q.questPoints>0&&qp===null,pointsMissing=qp===null?0:Math.max(0,(q.questPoints||0)-qp);
   const phase=priority[q.name]?'Unlocks & travel':Object.keys(q.skills||{}).some(s=>q.skills[s]>=50)||q.questPoints>=55?'Advanced quest chains':'Foundations';
   steps.push({id:'quest:'+q.name,type:'quest',name:q.name,reason:priority[q.name]||'Progress this prerequisite chain and collect its quest-point reward.',phase,partial,pointsUnknown,pointsMissing,qpReward:reward(q),projectedQp:qp});
   planned.add(q.name);if(qp!==null&&reward(q)!==null)qp+=reward(q);last=data.quests?.[q.name]?.start||last;
  }
  for(const [s,l]of Object.entries(target))train(s,l,'Your '+(settings.focus==='all99'?'level 99':settings.focus==='all70'?'level 70':'progression')+' goal');
  return {steps,targets:target,remainingQuests:catalog.filter(q=>!done[q.name]).length,completedQuests:catalog.filter(q=>done[q.name]).length,projectedQp:qp};
 }
 function bankPlan(questNames,data,bank={}){
  const items=new Map();
  for(const quest of questNames)for(const r of data.quests?.[quest]?.items||[]){
   if(r.during||r.alternative||!Number.isFinite(r.quantity))continue;
   const id=key(r.name);if(!items.has(id))items.set(id,{name:r.name,quantity:0,tool:r.tool,quests:[]});
   const row=items.get(id);row.quantity=r.tool?Math.max(row.quantity,r.quantity):row.quantity+r.quantity;row.quests.push(quest);
  }
  return [...items.values()].map(row=>({...row,owned:Math.max(0,Number(bank[key(row.name)])||0),missing:Math.max(0,row.quantity-(Number(bank[key(row.name)])||0))})).sort((a,b)=>Number(b.tool)-Number(a.tool)||a.name.localeCompare(b.name));
 }
 function trainingEstimate(step,method,player,customXp){
  const exact=Number.isFinite(player.xp?.[step.skill]),level=player.skills?.[step.skill];
  const from=Number.isFinite(level)?exact?player.xp[step.skill]:xpForLevel(level):null;
  const remaining=from===null?null:Math.max(0,xpForLevel(step.target)-from);
  const gain=Number.isFinite(customXp)&&customXp>0?customXp:method?.xp;
  return {remaining,exact,actions:remaining!==null&&Number.isFinite(gain)&&gain>0?Math.ceil(remaining/gain):null,xp:gain};
 }
 const api={key,xpForLevel,methods,ingredients,goals,build,bankPlan,trainingEstimate,priority};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RunicPathway=api;
})(typeof globalThis!=='undefined'?globalThis:this);
