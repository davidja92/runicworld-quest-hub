'use strict';
const $=id=>document.getElementById(id), escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SKILLS=['Attack','Defence','Strength','Hitpoints','Ranged','Prayer','Magic','Cooking','Woodcutting','Fletching','Fishing','Firemaking','Crafting','Smithing','Mining','Herblore','Agility','Thieving','Slayer','Farming','Runecraft','Hunter','Construction'];
const LEGACY=[...SKILLS]; const xpForLevel=n=>{let xp=0;for(let i=1;i<n;i++)xp+=Math.floor(i+300*Math.pow(2,i/7));return Math.floor(xp/4)};
const levelFromXp=x=>{x=Number(x)||0;let l=1;while(l<99&&xpForLevel(l+1)<=x)l++;return l};
const questPointKey=name=>'rqh_qp_'+String(name||'').trim().toLowerCase();
const readQuestPoints=name=>{const value=localStorage.getItem(questPointKey(name));return value===null?null:Math.max(0,Math.floor(Number(value)||0))};
const state={questPoints:readQuestPoints(localStorage.getItem('rqh_name')||''),activeTrainingSkill:null,view:'quest',xp:{},name:localStorage.getItem('rqh_name')||'',skills:{},selected:quests.find(q=>q.name==='Monkey Madness')||quests[0],guideCache:new Map(),done:JSON.parse(localStorage.getItem('rqh_done')||'{}'),items:JSON.parse(localStorage.getItem('rqh_items')||'{}')};
function store(){localStorage.setItem('rqh_done',JSON.stringify(state.done));localStorage.setItem('rqh_items',JSON.stringify(state.items))}
// Same public Cloudflare Worker and hiscores response handling as the GE Profit Finder.
// The API responds with { skills: [skill names], players: [{ name, xp: {"0": totalXP, ...} }] }.
const proxyBase=String(window.RUNICWORLD_CONFIG?.proxyBase||'').trim().replace(/\/+$/,'');
const API_HISCORES=proxyBase?`${proxyBase}/hiscores`:'https://runicworld.com/api/site/hiscores';
function parseHiscores(blob,name){
 if(!blob||!Array.isArray(blob.players))throw Error('Expected a hiscores response containing a players array.');
 const player=blob.players.find(p=>p&&String(p.name||'').trim().toLowerCase()===name.trim().toLowerCase());
 if(!player)throw Error(`Player "${name}" not found in ${blob.players.length} hiscores entries.`);
 if(!player.xp||typeof player.xp!=='object')throw Error('This player has no XP data.');
 if(!Array.isArray(blob.skills)||!blob.skills.length)throw Error('Hiscores did not provide its skill ID mapping; cannot safely identify skills.');
 const out={};let matched=0;
 for(let i=0;i<blob.skills.length;i++){
  const raw=String(blob.skills[i]||'').toLowerCase().replace(/[^a-z]/g,'');
  const skill=SKILLS.find(s=>s.toLowerCase().replace(/[^a-z]/g,'')===raw||((s==='Runecraft'||s==='Runecrafting')&&(raw==='runecraft'||raw==='runecrafting')));
  if(!skill)continue;
  const xp=Number(player.xp[String(i)]??0);
  if(!Number.isFinite(xp)||xp<0)continue;
  out[skill]=levelFromXp(xp);matched++;
 }
 if(matched<3)throw Error('Too few skill IDs could be matched to RunicWorld skills.');
 return {name:player.name,skills:out,xp:Object.fromEntries(Object.entries(out).map(([skill])=>{const i=blob.skills.findIndex(s=>{const raw=String(s).toLowerCase().replace(/[^a-z]/g,'');return raw===skill.toLowerCase()||(skill==='Runecraft'&&raw==='runecrafting')});return [skill,Number(player.xp[String(i)]??xpForLevel(out[skill]))]})),ironman:!!player.ironman};
}
let lookupInFlight=false;
async function lookup({silent=false}={}){
 if(lookupInFlight)return;
 const name=$('username').value.trim();if(!name)return;
 lookupInFlight=true;
 if(!silent){$('status').className='status loading';$('status').textContent=`Searching RunicWorld hiscores for ${name}…`;} $('fetch').disabled=true;
 try{
  const res=await fetch(API_HISCORES,{headers:{Accept:'application/json'},cache:'no-store'});
  if(!res.ok)throw Error(`HTTP ${res.status}`);
  const data=parseHiscores(await res.json(),name);
  if($('username').value.trim()!==name)throw Error('Username changed while loading. Search again.');
  state.name=data.name;state.skills=data.skills;state.xp=data.xp;state.questPoints=readQuestPoints(data.name);renderQuestPointsControl();
  localStorage.setItem('rqh_name',data.name);localStorage.setItem('rqh_skills',JSON.stringify(data.skills));localStorage.setItem('rqh_xp',JSON.stringify(data.xp));
  $('status').className='status';$('status').textContent=`${silent?'Auto-refreshed':'Imported'} ${data.name} (${data.ironman?'Ironman':'Normal'}) — ${Object.keys(data.skills).length} skills • ${new Date().toLocaleTimeString()}.`;
  renderList();if(state.view==='skills')renderSkillsView();else renderDetail();
  if(state.activeTrainingSkill&&!skillModal.classList.contains('hidden'))fillTraining(state.activeTrainingSkill);
 }catch(e){$('status').className='status error';$('status').textContent=`${silent?'Auto-refresh':'Hiscores lookup'} failed: ${e.message}. Previous saved levels are unchanged.`}
 finally{lookupInFlight=false;$('fetch').disabled=false;}
}
function questPointStatus(q){if(q.questPoints==null)return 'Not verified';if(state.questPoints==null)return `${q.questPoints} required · Enter yours above`;return state.questPoints>=q.questPoints?`${q.questPoints} required · ✓ Met`:`${q.questPoints} required · ${q.questPoints-state.questPoints} missing`;}
function renderQuestPointsControl(){const el=$('questPoints');if(el)el.value=state.questPoints==null?'':String(state.questPoints);const hint=$('questPointsHint');if(hint)hint.textContent=state.name?`Saved for ${state.name}`:'Fetch a character to save points separately for each player';}
function skillsCheck(q){const req=q.skills||{},entries=Object.entries(req);if(!entries.length)return {verified:false,missing:[]};if(!Object.keys(state.skills).length)return {verified:false,missing:[]};return {verified:true,missing:entries.filter(([k,v])=>(state.skills[k]||1)<v)}}
// Completion is saved by exact catalogue name. Follow a dependency only after resolving its alias.
const canonicalQuestName=name=>questLinkIndex.get(normalizeName(name))?.name||name;
function reqChain(q,seen=new Set([q.name])){
 let result=[];
 for(const alias of q.quests||[]){
  const name=canonicalQuestName(alias), child=quests.find(x=>x.name===name);
  if(seen.has(name))continue;
  seen.add(name);
  if(child)result.push(...reqChain(child,seen));
  result.push(name);
 }
 return result;
}
function completedPrerequisites(q){
 const chain=reqChain(q);
 return {chain,completed:chain.filter(n=>!!state.done[n]),missing:chain.filter(n=>!state.done[n])};
}
// Requirements must be known before declaring a quest has no prerequisites.
// The wiki is used only as a reference: RunicWorld can differ.
const wikiReqPending=new Map();
const wikiReqUnavailable=new Set();
const wikiReqCacheKey='rqh_wiki_prereqs_v2';
let wikiReqCache={};
try {wikiReqCache=JSON.parse(localStorage.getItem(wikiReqCacheKey)||'{}')||{}}catch{}
function extractRequirements(html,currentQuest){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const found=new Set();let matchedSection=false;
 for(const row of doc.querySelectorAll('tr')){
  const head=row.querySelector('th');
  if(!head||!/^\s*(quest\s+)?requirements?\s*:?\s*$/i.test(head.textContent.trim()))continue;
  matchedSection=true;
  for(const link of row.querySelectorAll('td a[href]')){
   const quest=resolveGuideQuest(link.href);
   if(quest&&quest.name!==currentQuest.name)found.add(quest.name);
  }
 }
 // Avoid claiming no prerequisites when a page structure is unrecognized.
 return matchedSection?[...found]:null;
}
// Resolve one quest at a time. Never recursively trigger renderDetail() from
// renderDetail()'s own asynchronous prerequisite loader.
// Local prerequisites remain available immediately; wiki entries are cached.
async function loadWikiPrerequisites(q){
 if(Object.prototype.hasOwnProperty.call(q,'quests')){
  q.prereqsVerified=true;
  return;
 }
 if(wikiReqCache[q.name] && Array.isArray(wikiReqCache[q.name].quests)){
  q.quests=wikiReqCache[q.name].quests.filter(n=>questLinkIndex.has(normalizeName(n)));
  q.prereqsVerified=true;
  q.requirementsSource='OSRS Wiki reference';
  // Called during render: do not re-render just to read the cache.
  return;
 }
 if(!wikiTitle(q.name)||wikiReqUnavailable.has(q.name))return;
 if(wikiReqPending.has(q.name))return wikiReqPending.get(q.name);
 const task=(async()=>{
  const title=wikiTitle(q.name);
  for(const page of [title,title+'/Quick guide']){
   try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    let response;
    try{
     response=await fetch(`https://oldschool.runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&origin=*&page=${encodeURIComponent(page)}`,{headers:{Accept:'application/json'},signal:controller.signal});
    }finally{clearTimeout(timeout)}
    if(!response.ok)continue;
    const data=await response.json();
    if(!data.parse?.text)continue;
    const req=extractRequirements(safeWikiHTML(data.parse.text),q);
    if(req===null)continue;
    q.quests=req;
    q.prereqsVerified=true;
    q.requirementsSource='OSRS Wiki reference';
    wikiReqCache[q.name]={quests:req};
    try{localStorage.setItem(wikiReqCacheKey,JSON.stringify(wikiReqCache))}catch{}
    // Update exactly once, without calling the loader again.
    if(state.selected===q&&state.view==='quest'){
     renderList();
     renderDetail({skipWikiPrerequisites:true});
    }
    return;
   }catch{}
  }
  wikiReqUnavailable.add(q.name);
 })().finally(()=>wikiReqPending.delete(q.name));
 wikiReqPending.set(q.name,task);
 return task;
}
function renderList(){let query=$('search').value.toLowerCase(),filter=$('filter').value;let filtered=quests.filter(q=>{const r=skillsCheck(q);return q.name.toLowerCase().includes(query)&&(filter==='all'||(filter==='done'&&state.done[q.name])||(filter==='todo'&&!state.done[q.name])||(filter==='ready'&&r.verified&&!r.missing.length)||(filter==='locked'&&r.verified&&r.missing.length))});$('count').textContent=`(${filtered.length})`;$('questList').innerHTML=filtered.map(q=>{let r=skillsCheck(q);return `<button class="quest-item ${q.name===state.selected.name?'active':''}" data-quest="${escapeHtml(q.name)}"><strong>${escapeHtml(q.name)}</strong><div class="badgeRow">${state.done[q.name]?'<span class="pill good">Completed</span>':''}${r.verified?`<span class="pill ${r.missing.length?'bad':'good'}">${r.missing.length?r.missing.length+' skills missing':'Skills met'}</span>`:'<span class="pill">Requirements to verify</span>'}</div></button>`}).join('')||'<div class="empty">No matching quests.</div>';
 $('questList').querySelectorAll('[data-quest]').forEach(btn=>btn.addEventListener('click',()=>{state.selected=quests.find(q=>q.name===btn.dataset.quest);render();}));}
// Resolve OSRS Wiki quest links to our RunicWorld quest catalogue.
// Supports canonical wiki titles, in-game aliases, underscore URLs and quick-guide links.
const questLinkIndex=new Map();
for(const quest of quests){
 for(const title of [quest.name, wikiTitleAlias(quest.name)]){
  if(!title)continue;
  questLinkIndex.set(normalizeName(title),quest);
  questLinkIndex.set(normalizeName(title.replace(/\/Quick_guide$/i,'')),quest);
 }
}
function wikiTitleAlias(name){return Object.prototype.hasOwnProperty.call(wikiAliases,name)?wikiAliases[name]:name}
function resolveGuideQuest(href){
 try{
  const url=new URL(href,'https://oldschool.runescape.wiki');
  if(!['oldschool.runescape.wiki','oldschool.runescape.wiki.org'].includes(url.hostname))return null;
  let title='';
  const match=url.pathname.match(/^\/(?:w|wiki)\/(.+)$/i);
  if(match)title=decodeURIComponent(match[1]);
  else if(url.pathname==='/w/index.php')title=url.searchParams.get('title')||'';
  if(!title)return null;
  title=title.replace(/_/g,' ').replace(/\/Quick guide$/i,'').replace(/\/Quick_guide$/i,'');
  return questLinkIndex.get(normalizeName(title))||null;
 }catch{return null}
}
// One delegated handler also works for walkthroughs inserted asynchronously.
$('detail').addEventListener('click',event=>{
 const anchor=event.target.closest('a[href]');
 if(!anchor||!anchor.closest('#guideBody'))return;
 const target=resolveGuideQuest(anchor.href);
 if(!target)return; // Non-quest subjects continue to the OSRS Wiki.
 event.preventDefault();
 state.selected=target;
 $('search').value=''; // Ensure the destination quest is visible in the sidebar.
 $('filter').value='all';
 render();
 $('detail').scrollIntoView({behavior:'smooth',block:'start'});
});
function wikiTitle(name){return Object.prototype.hasOwnProperty.call(wikiAliases,name)?wikiAliases[name]:name}
function wikiUrl(q){let title=wikiTitle(q.name);return title?`https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replace(/ /g,'_'))}/Quick_guide`:null}
function renderDetail({skipWikiPrerequisites=false}={}){state.view='quest';let q=state.selected,r=skillsCheck(q),allItems=q.items||[],prereqs=reqChain(q);let progress=completedPrerequisites(q);let current=state.items[q.name]||{};let reqs=Object.entries(q.skills||{});let missing=r.missing.length;
 $('detail').innerHTML=`<div class="head-detail"><div><div class="eyebrow">Quest planner</div><h1>${escapeHtml(q.name)}</h1><div class="small">${q.skills||q.quests||q.items?'Curated starter metadata • verify against game':'Live wiki guide • requirements not yet curated locally'}</div></div><button id="completed" class="${state.done[q.name]?'primary':''}">${state.done[q.name]?'✓ Completed':'Mark completed'}</button></div><div class="summary"><div class="metric"><span>Skills</span><strong>${!reqs.length?'Not verified':!Object.keys(state.skills).length?'Load player':missing?missing+' missing':'Met'}</strong></div><div class="metric"><span>Prerequisite quests</span><strong class="${progress.missing.length?'error':'qp-met'}">${prereqs.length?`${progress.completed.length}/${prereqs.length} completed${progress.missing.length?` · ${progress.missing.length} missing`:' · Met'}`:(q.prereqsVerified||Object.prototype.hasOwnProperty.call(q,'quests')?'None required':'Checking / unverified')}</strong></div><div class="metric"><span>Quest points needed</span><strong class="${q.questPoints!=null&&state.questPoints!=null&&state.questPoints<q.questPoints?'error':q.questPoints!=null&&state.questPoints>=q.questPoints?'qp-met':''}">${escapeHtml(questPointStatus(q))}</strong></div></div><div class="note">RunicWorld may use altered quest data. Missing requirements in the local database are <b>unknown</b>, not proof that a quest has none. Load the full wiki quick guide below for instructions and additional requirements.</div><section><h2>Skill requirements</h2><div class="reqs">${reqs.length?reqs.map(([skill,lvl])=>{let have=state.skills[skill];return `<button type="button" class="req skill-trigger ${have!=null?(have>=lvl?'good':'bad'):''}" data-skill="${escapeHtml(skill)}" data-target="${lvl}" title="Open ${escapeHtml(skill)} training calculator"><b>${escapeHtml(skill)} ${lvl}</b>${have!=null?` <span class="small">(yours: ${have})</span>`:''} <span aria-hidden="true">↗</span></button>`}).join(''):'<span class="muted">Not verified locally — consult the guide.</span>'}</div></section><section><h2>Required prerequisite quests</h2>${!q.prereqsVerified&&!Object.prototype.hasOwnProperty.call(q,'quests')?'<button type="button" id="fetchPrereqs">Check wiki prerequisites</button>':''}${prereqs.length?prereqs.map(name=>`<div class="check"><input type="checkbox" class="prereq-done" data-prereq="${escapeHtml(name)}" ${state.done[name]?'checked':''} aria-label="Mark ${escapeHtml(name)} complete"><span><a href="#" class="jump" data-jump="${escapeHtml(name)}">${escapeHtml(name)}</a> <span class="small ${state.done[name]?'qp-met':'error'}">${state.done[name]?'✓ Completed':'✕ Missing'}</span></span></div>`).join(''):'<div class="muted">None documented locally, or requirements not yet verified.</div>'}</section><section><h2>Items checklist</h2>${allItems.length?allItems.map((item,i)=>`<label class="check"><input type="checkbox" data-item="${i}" ${current[i]?'checked':''}><span>${escapeHtml(item)}</span></label>`).join(''):'<div class="muted">See the live guide for a complete item list.</div>'}</section>${q.steps?.length?`<section><h2>Quick outline</h2><ol>${q.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol></section>`:''}<div class="guide"><div class="head-detail"><h2>Full step-by-step walkthrough</h2><div class="tabbar"><button type="button" id="reloadGuide">Load walkthrough</button>${wikiUrl(q)?`<a href="${wikiUrl(q)}" target="_blank" rel="noopener noreferrer">Open on OSRS Wiki ↗</a>`:''}</div></div><div id="guideBody" class="guide-content"><span class="muted">Walkthrough is ready to load on demand. Click Load walkthrough above.</span></div></div>`;
 $('detail').querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>openTraining(b.dataset.skill,Number(b.dataset.target)));$('completed').onclick=()=>{state.done[q.name]=!state.done[q.name];store();render()};$('detail').querySelectorAll('[data-item]').forEach(x=>x.onchange=()=>{state.items[q.name]??={};state.items[q.name][x.dataset.item]=x.checked;store()});$('detail').querySelectorAll('.prereq-done').forEach(x=>x.onchange=()=>{state.done[x.dataset.prereq]=x.checked;store();render()});$('detail').querySelectorAll('.jump').forEach(x=>x.onclick=e=>{e.preventDefault();let found=quests.find(v=>v.name===x.dataset.jump);if(found){state.selected=found;render()}});$('reloadGuide').onclick=()=>{state.guideCache.delete(q.name);loadGuide(q)};const prereqButton=$('fetchPrereqs');if(prereqButton)prereqButton.onclick=()=>{prereqButton.disabled=true;prereqButton.textContent='Checking wiki…';loadWikiPrerequisites(q).then(()=>{if(state.selected===q)renderDetail({skipWikiPrerequisites:true});}).catch(()=>{if(state.selected===q){prereqButton.disabled=false;prereqButton.textContent='Retry requirements lookup';}})};
}
function safeWikiHTML(html){let dom=new DOMParser().parseFromString(html,'text/html');dom.querySelectorAll('script,iframe,form,style,link,button,input,textarea,select,object,embed').forEach(el=>el.remove());dom.querySelectorAll('*').forEach(el=>{for(const att of [...el.attributes])if(att.name.startsWith('on')||att.name==='srcdoc'||att.name==='style')el.removeAttribute(att.name);for(const att of ['href','src','srcset']){let value=el.getAttribute(att);if(!value)continue;if(att==='srcset'){el.removeAttribute(att);continue}try{let url=new URL(value,'https://oldschool.runescape.wiki');if(!['https:','http:'].includes(url.protocol))el.removeAttribute(att);else el.setAttribute(att,url.href)}catch{el.removeAttribute(att)}}});return dom.body.innerHTML}
async function loadGuide(q){let dest=$('guideBody');if(!dest)return;if(state.guideCache.has(q.name)){dest.innerHTML=state.guideCache.get(q.name);return}dest.innerHTML='<span class="loading">Loading OSRS Wiki quick guide...</span>';let canonical=wikiTitle(q.name);if(!canonical){dest.innerHTML='<p class="muted">No matching OSRS Wiki quest quick guide is available for this activity or custom quest. Details must be confirmed in RunicWorld.</p>';return;}let title=canonical+'/Quick guide';let url=`https://oldschool.runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&origin=*&page=${encodeURIComponent(title)}`;try{const response=await fetch(url,{headers:{Accept:'application/json'}});if(!response.ok)throw Error('Wiki HTTP '+response.status);const payload=await response.json();if(payload.error||!payload.parse?.text)throw Error(payload.error?.info||'Guide not found');let clean=safeWikiHTML(payload.parse.text);state.guideCache.set(q.name,clean);if(state.selected.name===q.name)$('guideBody').innerHTML=clean}catch(e){if(state.selected.name===q.name)$('guideBody').innerHTML=`<p class="error">Could not embed this guide (${escapeHtml(e.message)}). The wiki may block cross-site requests, or the page may have a different title.</p><p><a href="${wikiUrl(q)}" target="_blank" rel="noopener noreferrer">Read the full step-by-step guide on the OSRS Wiki ↗</a></p>`}}
function render(){renderList();renderDetail()}
$('username').value=state.name;renderQuestPointsControl();$('questPoints').addEventListener('change',()=>{const raw=$('questPoints').value.trim();if(raw!==''&&(!Number.isInteger(Number(raw))||Number(raw)<0||Number(raw)>1000)){renderQuestPointsControl();return;}state.questPoints=raw===''?null:Number(raw);if(state.name){if(state.questPoints==null)localStorage.removeItem(questPointKey(state.name));else localStorage.setItem(questPointKey(state.name),String(state.questPoints));}renderQuestPointsControl();renderList();if(state.view==='quest')renderDetail();});$('fetch').onclick=lookup;$('username').addEventListener('keydown',e=>{if(e.key==='Enter')lookup()});$('search').oninput=renderList;$('filter').onchange=renderList;
function renderSkillsView(){state.view='skills';let html=`<div class="head-detail"><h1>${escapeHtml(state.name||'Player')} skills</h1><button id="back">Back to quest</button></div>${Object.keys(state.skills).length?`<div class="stats">${SKILLS.map(s=>`<button class="stat skill-trigger" data-skill="${s}" type="button"><small>${s}</small><span class="level">${state.skills[s]??'?'}</span></button>`).join('')}</div>`:'<p class="muted">Look up a RunicWorld character to see their skills.</p>'}`;$('detail').innerHTML=html;$('back').onclick=renderDetail;$('detail').querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>openTraining(b.dataset.skill,Math.min(99,(state.skills[b.dataset.skill]||1)+10)))};$('showSkills').onclick=renderSkillsView;$('resetProgress').onclick=()=>{if(confirm('Clear all locally saved completed quests and item checklists?')){state.done={};state.items={};store();render()}};
try{state.xp=JSON.parse(localStorage.getItem('rqh_xp')||'{}');state.skills=JSON.parse(localStorage.getItem('rqh_skills')||'{}');if(state.name&&Object.keys(state.skills).length)$('status').textContent=`Saved skills for ${state.name} loaded. Automatic refresh every 60 seconds while this tab is open.`}catch{}render();

// Modal stays on the current quest, and skill buttons remain clickable in player-skills view.
const skillModal=$('skillModal');
function closeTraining(){state.activeTrainingSkill=null;skillModal.classList.add('hidden');document.body.style.overflow='';}
$('closeTraining').onclick=closeTraining;
skillModal.addEventListener('click',e=>{if(e.target===skillModal)closeTraining()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!skillModal.classList.contains('hidden'))closeTraining()});
const fmt=n=>Math.ceil(n).toLocaleString('en-US');
function openTraining(skill,target){
 state.activeTrainingSkill=skill;
 const have=state.skills[skill]??1,known=state.xp[skill]!=null;
 const xp=known?Number(state.xp[skill]):xpForLevel(have);
 target=Math.max(1,Math.min(99,target||have+1));
 const needed=Math.max(0,xpForLevel(target)-xp);
 $('trainingTitle').textContent=skill+' training';
 $('trainingTarget').value=target;
 $('trainingTarget').oninput=()=>fillTraining(skill);
 $('trainingSort').onchange=()=>fillTraining(skill);
 $('trainingAvailableOnly').onchange=()=>fillTraining(skill);
 $('trainingMethods').scrollTop=0;
 skillModal.classList.remove('hidden');document.body.style.overflow='hidden';
 fillTraining(skill);
 $('closeTraining').focus();
}
function fillTraining(skill){
 const level=state.skills[skill]??1,xpKnown=state.xp[skill]!=null;
 const xp=xpKnown?Number(state.xp[skill]):xpForLevel(level);
 const target=Math.max(1,Math.min(99,parseInt($('trainingTarget').value,10)||level+1));
 const remaining=Math.max(0,xpForLevel(target)-xp);
 const sortOrder=$('trainingSort').value;
 const availableOnly=$('trainingAvailableOnly').checked;
 const rows=[...(TRAINING[skill]||[])].filter(([req])=>!availableOnly||req<=level).sort((a,b)=>sortOrder==='xp-desc'?(b[1]-a[1]||a[0]-b[0]):sortOrder==='level'?(a[0]-b[0]||a[1]-b[1]):(a[1]-b[1]||a[0]-b[0]));
 $('trainingCount').textContent=rows.length+' shown • '+(TRAINING[skill]||[]).filter(([req])=>req<=level).length+' currently unlocked';
 $('trainingSummary').innerHTML=`<div class="training-metrics"><div><span>Current level</span><b>${level}</b></div><div><span>Target level</span><b>${target}</b></div><div><span>XP remaining</span><b>${fmt(remaining)}</b></div></div><p class="small">${xpKnown?'Exact hiscores XP: '+fmt(xp):'XP estimated from the start of level '+level+'. Fetch skills for an exact remainder.'} Level ${target} begins at ${fmt(xpForLevel(target))} XP.</p>`;
 $('trainingMethods').innerHTML=rows.length?rows.map(([req,gain,action,materials])=>{
  const unlocked=req<=level,usable=unlocked&&remaining>0;
  const count=gain>0?fmt(remaining/gain):'—';
  return `<div class="training-method ${unlocked?'':'training-locked'}"><div><b>${escapeHtml(action)}</b><div class="small">Level ${req} • ${escapeHtml(materials)}</div><span class="training-availability">${unlocked?'✓ Available now':'🔒 Unlock at level '+req}</span></div><div class="training-numbers"><strong>${gain.toLocaleString('en-US')} XP/action</strong><span class="small">${usable?count+' actions to target':unlocked?'Target met':'Not yet available'}</span></div></div>`
 }).join(''):'<p class="muted">No classic training entries listed for this skill and target.</p>';
 $('trainingNote').textContent='Action counts are comparisons assuming you use one method for all remaining XP. Locked methods require training to their unlock level first. Combat XP depends on damage; failure/burning rates, quest rewards, and server modifiers are not included. Modern OSRS-only activities are identified when included. Verify available recipes and XP in RunicWorld.';
}

// Refresh at most once per minute, using the same Worker as manual lookup.
setInterval(()=>{if(!document.hidden&&state.name&&$('username').value.trim().toLowerCase()===state.name.toLowerCase())lookup({silent:true});},60000);
