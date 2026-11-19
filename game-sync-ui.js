'use strict';
// Loaded after app.js; uses its existing character, quest, and rendering state.
const syncPanel=document.createElement('section');
syncPanel.className='card';syncPanel.style.cssText='padding:16px;margin:16px 0';
syncPanel.innerHTML='<div class="head-detail"><div><h2>Game sync</h2><p id="gameSyncStatus" class="small" role="status">Connect the separate Windows companion to sync finished quests and farming.</p></div><div><button id="connectGameSync" type="button">Connect game sync</button> <button id="disconnectGameSync" type="button">Disconnect</button></div></div><details id="farmingDetails"><summary>Farming tracker</summary><p class="small">Open the in-game farming overview to receive its current patch data. Timers are estimates until confirmed by the game.</p><div id="farmingPatches"></div></details>';
document.querySelector('.playerbox').after(syncPanel);
let gameSyncToken=sessionStorage.getItem('rqh_game_sync_key')||'',gameSyncBusy=false,gameSyncGeneration=0;
let lastFarm=null;
function syncStatus(text){$('gameSyncStatus').textContent=text;}
$('connectGameSync').onclick=()=>{
 const key=prompt('Open Runic Quest & Farming Sync, click Copy pairing key, then paste it here. The connection stays on this PC.');
 if(key===null)return;if(!/^[a-f0-9]{48}$/.test(key.trim())){syncStatus('Pairing key must be the 48-character key copied from the companion.');return;}
 gameSyncToken=key.trim();sessionStorage.setItem('rqh_game_sync_key',gameSyncToken);gameSyncGeneration++;
 syncStatus('Connecting. Allow local-network access if your browser asks.');pollGameSync();
};
$('disconnectGameSync').onclick=()=>{gameSyncToken='';sessionStorage.removeItem('rqh_game_sync_key');gameSyncGeneration++;syncStatus('Disconnected. Saved quest progress is retained.');};
function farmTime(seconds){seconds=Math.max(0,Math.floor(seconds));return seconds<60?seconds+'s':Math.floor(seconds/60)+'m '+seconds%60+'s';}
function renderFarming(snapshot){
 const container=$('farmingPatches');
 if(!snapshot?.farming){container.textContent='No farming snapshot received for this character yet.';return;}
 const age=Math.max(0,Date.now()/1000-snapshot.collectedAt),stale=age>90;
 const labels={e:'Empty',r:'Ready',d:'Diseased',x:'Dead',g:'Growing'};
 let html='<p class="small">Last game snapshot: '+escapeHtml(new Date(snapshot.collectedAt*1000).toLocaleTimeString())+(stale?' — stale; focus the game to refresh':'')+'.</p>';
 html+='<p class="small">Farming data: '+(Number.isFinite(snapshot.farming.updatedAt)?'last server update '+escapeHtml(new Date(snapshot.farming.updatedAt*1000).toLocaleTimeString()):'from the client cache; server update time unknown')+'. Status remains the last reported game state.</p>';
 html+='<div style="overflow-x:auto"><table><thead><tr><th>Area / patch</th><th>Crop</th><th>Status</th></tr></thead><tbody>';
 for(const p of snapshot.farming.patches||[]){
  if(!p||typeof p.zone!=='string')continue;
  let status=labels[p.state]||('State '+String(p.state));
  if(p.state==='x'&&String(p.flags||'').includes('z'))status='Stump';
  if(p.state==='g'&&String(p.flags||'').includes('p'))status+=' (protected)';
  const remaining=Math.max(0,(Number(p.remainingSeconds)||0)-age);
  if(p.state!=='e'&&p.state!=='r'&&p.state!=='x'&&Number(p.remainingSeconds)>0){
   status+=remaining>0?' · '+farmTime(remaining)+(p.state==='d'&&p.canDie?' until death':' remaining'):' · timer elapsed; awaiting game confirmation';
  }
  html+='<tr><td>'+escapeHtml(p.zone+' — '+(p.location||p.category||''))+'</td><td>'+escapeHtml(p.crop||'—')+'</td><td>'+escapeHtml(status)+'</td></tr>';
 }
 for(const b of snapshot.farming.bins||[]){
  const remaining=Math.max(0,(Number(b.remainingSeconds)||0)-age);
  let status=b.state==='d'?String(b.value)+' ready ('+b.tier+')':b.state==='r'?(remaining>0?'Rotting · '+farmTime(remaining):'Timer elapsed; awaiting game confirmation'):b.state==='f'?String(b.value)+'/15':b.state==='e'?'Empty':'State '+b.state;
  html+='<tr><td>'+escapeHtml(b.zone+' — compost bin')+'</td><td>'+escapeHtml(b.tier||'—')+'</td><td>'+escapeHtml(status)+'</td></tr>';
 }
 container.innerHTML=html+'</tbody></table></div>';
}
async function pollGameSync(){
 if(!gameSyncToken||gameSyncBusy||document.hidden)return;
 const name=$('username').value.trim();
 if(!name||RWQuestSync.characterKey(name)!==RWQuestSync.characterKey(state.name)){syncStatus('Fetch your character first, then game sync will match that name.');return;}
 gameSyncBusy=true;const generation=gameSyncGeneration,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),3500);
 try{
  const response=await fetch('http://127.0.0.1:9127/v1/snapshot?character='+encodeURIComponent(name),{headers:{Authorization:'Bearer '+gameSyncToken},cache:'no-store',signal:controller.signal});
  if(response.status===401)throw Error('Companion restarted. Click Connect game sync and paste its new key.');
  if(!response.ok)throw Error('Companion returned HTTP '+response.status);
  const snapshot=await response.json();
  if(generation!==gameSyncGeneration||RWQuestSync.characterKey(state.name)!==RWQuestSync.characterKey(name)||RWQuestSync.characterKey($('username').value)!==RWQuestSync.characterKey(name))return;
  if(snapshot.waiting){syncStatus('Connected. Waiting for '+name+'; focus the game and press L to load quests.');return;}
  const result=RWQuestSync.merge(snapshot,state.name,quests,state.done);
  const qpChanged=result.questPoints!==null&&result.questPoints!==state.questPoints;
  state.done=result.done;
  if(result.questPoints!==null){state.questPoints=result.questPoints;localStorage.setItem(questPointKey(state.name),String(state.questPoints));}
  if(result.added||qpChanged){store();renderQuestPointsControl();renderList();if(state.view==='quest')renderDetail();}
  lastFarm=snapshot;renderFarming(snapshot);
  syncStatus('Synced '+state.name+' · '+snapshot.completed.length+' completed quests reported'+(result.added?' · '+result.added+' newly marked':'')+(result.unknown.length?' · '+result.unknown.length+' not in this catalogue':'')+' · '+new Date(snapshot.collectedAt*1000).toLocaleTimeString());
 }catch(error){if(generation===gameSyncGeneration)syncStatus(error.name==='AbortError'?'Companion timed out. Check it is running.':error instanceof TypeError?'Cannot reach the local companion. Start it, allow local-network access in the browser, and reconnect.':error.message);}
 finally{clearTimeout(timeout);gameSyncBusy=false;}
}
setInterval(pollGameSync,2000);
setInterval(()=>{if(lastFarm&&RWQuestSync.characterKey(lastFarm.character)===RWQuestSync.characterKey(state.name))renderFarming(lastFarm);else {$('farmingPatches').textContent='Waiting for farming data for the selected character.';lastFarm=null;}},1000);
pollGameSync();
