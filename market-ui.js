(function(){
 'use strict';
 const C=window.RunicMarketCore,book=new C.Book(),esc=escapeHtml;
 const num=n=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
 const time=n=>n?new Date(n*1000).toLocaleString():'Time unknown';
 const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
 const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
 let methods=[],vendorData=null,initialized=false,pending=false,loading=null,selected=null,activeTab='prices',pageSize=60,profitSize=30;
 let overrides=read('rwhub_vendor_overrides',{}),watch=new Map(read('rwhub_watchlist',[])),methodOverrides=read('rwhub_method_overrides',{});
 let sourceMessage='Load prices to begin.',liveError='',lastHistoryAt=null,recipeOrigin='',lastSharedAttempt=0;const loadWarnings=[];
 const originalProfit=read('rw_profit_web_v5',null);
 if(originalProfit){
  for(const [name,v]of Object.entries(originalProfit.customShops||{}))if(C.positive(v.price)||v.price===0){const k=C.key(name);overrides[k]??={};overrides[k].buy??={...v,at:null};}
  for(const [name,v]of Object.entries(originalProfit.customSellShops||{}))if(C.positive(v.price)||v.price===0){const k=C.key(name);overrides[k]??={};overrides[k].sell??={...v,at:null};}
 }
 const button=document.createElement('button');button.id='openMarket';button.textContent='GE & profits';document.querySelector('.header-tools').appendChild(button);
 const panel=document.createElement('section');panel.id='marketPanel';panel.className='market-panel card hidden';
 panel.innerHTML=`<div class="market-heading"><div><div class="eyebrow">RunicWorld economy</div><h2>GE & profits</h2><p>Price your supplies, track trades, and compare crafting margins.</p></div><button id="marketBack">Back to quests</button></div>
 <div class="market-toolbar"><button class="primary" id="marketRefresh">Refresh GE</button><label>Auto-refresh<select id="marketInterval"><option value="0">Off</option><option value="1">1 minute</option><option value="5" selected>5 minutes</option><option value="15">15 minutes</option></select></label><label>Skill<select id="marketSkill"><option value="">All skills</option>${SKILLS.map(s=>'<option>'+esc(s)+'</option>').join('')}</select></label><label>GE sell fee %<input id="marketFee" type="number" min="0" max="100" step="0.1" value="0"></label></div>
 <p class="market-status" id="marketStatus" role="status"></p><p class="small">Prices: current GE ask/bid → last actual trade → matched vendor reference. Guide prices are not treated as trades. Fee is your assumption; verify it in game.</p>
 <div class="market-tabs" role="group" aria-label="Market views"><button data-market-tab="prices" class="primary">Item prices</button><button data-market-tab="profits">Profit methods</button><button data-market-tab="recipe">Recipe costs</button></div>
 <div id="marketPricesView"><div class="market-toolbar"><label class="market-search">Find an item<input id="marketSearch" type="search" placeholder="Logs, ore, runes, bow string…"></label><label>Show<select id="marketScope"><option value="all">All known items</option><option value="supplies">Skill supplies</option><option value="watch">Watchlist</option></select></label></div><div id="marketItemDetail"></div><div class="market-table-wrap"><table><thead><tr><th>Track / item</th><th>Buy estimate</th><th>Sell estimate</th><th>Last trade</th></tr></thead><tbody id="marketRows"></tbody></table></div><button id="marketMore">Show more items</button></div>
 <div id="marketProfitsView" class="hidden"><div class="market-toolbar"><label class="market-search">Find a method<input id="marketMethodSearch" type="search" placeholder="Fletch, smelt, cook…"></label><label class="market-check"><input type="checkbox" id="marketComplete" checked> Priced methods only</label><label class="market-check"><input type="checkbox" id="marketEligible">Levels met only</label></div><p class="small">GP/hour uses imported throughput estimates, not measured RunicWorld rates. Historical and shop references are estimates, not guaranteed fills.</p><div class="market-table-wrap"><table><thead><tr><th>Method</th><th>Est. cost/hour</th><th>Est. sales/hour</th><th>Est. net/hour</th><th>Price basis</th></tr></thead><tbody id="marketProfitRows"></tbody></table></div><button id="marketProfitMore">Show more methods</button><div id="marketMethodDetail"></div></div>
 <div id="marketRecipeView" class="hidden"><p class="small" id="recipeOrigin">Enter the actual recipe quantities from your game. Missing ingredients are not assumed free.</p><div class="market-recipe-grid"><label>Output item<input id="recipeOutput" list="marketItemNames" placeholder="Yew Shortbow Unstrung"></label><label>Output per action<input id="recipeOutputQty" type="number" min="0.001" step="any" value="1"></label><label>Planned actions<input id="recipeActions" type="number" min="1" step="1" value="1"></label><label>XP per action, if known<input id="recipeXp" type="number" min="0" step="any" placeholder="Optional"></label><label class="market-wide">Ingredients per action — one per line: item name | quantity<textarea id="recipeInputs" rows="4" placeholder="Yew Logs | 1&#10;Bow String | 1"></textarea></label><label class="market-check market-wide"><input type="checkbox" id="recipeNoInputs"> This action has no consumable inputs</label></div><div id="recipeResults"></div></div>
 <details class="market-settings"><summary>Vendor references & your observed prices</summary><p class="small" id="vendorCoverage"></p><p class="small">Wiki references only use vendors/NPCs listed in your client files. Presence does not verify their RunicWorld stock or prices. Conditional shop variants are excluded from automatic fallback.</p><form id="vendorOverrideForm" class="market-recipe-grid"><label>Item<input id="vendorOverrideItem" list="marketItemNames" required></label><label>Direction<select id="vendorOverrideRole"><option value="buy">You buy from NPC</option><option value="sell">You sell to NPC</option></select></label><label>Observed unit price<input id="vendorOverridePrice" type="number" min="0" step="any" required></label><label>NPC / shop<input id="vendorOverrideShop" required></label><button type="submit">Save observed price</button></form><div id="vendorOverrides"></div><p class="small">Observed prices are local to this browser and apply only after GE and history are unavailable.</p></details><datalist id="marketItemNames"></datalist>`;
 document.querySelector('.playerbox').after(panel);
 function status(){
  const age=book.generated?time(book.generated):'unknown';
  $('marketStatus').textContent=sourceMessage+' · GE data timestamp: '+age+(lastHistoryAt?' · shared history collected '+time(lastHistoryAt):'')+(liveError?' · '+liveError:'')+(loadWarnings.length?' · Missing data files: '+loadWarnings.join(', '):'');
 }
 function tab(name){activeTab=name;for(const [key,id]of [['prices','marketPricesView'],['profits','marketProfitsView'],['recipe','marketRecipeView']])$(id).classList.toggle('hidden',key!==name);panel.querySelectorAll('[data-market-tab]').forEach(b=>b.classList.toggle('primary',b.dataset.marketTab===name));render();}
 function open(name='',skill=''){
  panel.classList.remove('hidden');document.querySelector('.layout').classList.add('hidden');
  if(skill)$('marketSkill').value=skill;$('marketSearch').value=name;pageSize=60;tab('prices');
  init().then(()=>{if(name)selectItem(name);render();});panel.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function close(){panel.classList.add('hidden');document.querySelector('.layout').classList.remove('hidden');}
 window.RunicMarket={open,close,book};button.onclick=()=>open();$('marketBack').onclick=close;
 $('showSkills').addEventListener('click',close);$('openSkillPlanner').addEventListener('click',close);
 panel.querySelectorAll('[data-market-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.marketTab));
 const fee=()=>Math.max(0,Math.min(100,Number($('marketFee').value)||0));
 const watchKey=(name,id)=>String(id||book.record(name,id)?.entry||C.key(name));
 const watched=(name,id)=>watch.has(watchKey(name,id))||watch.has(C.key(name));
 $('marketFee').value=String(read('rwhub_fee',0));$('marketFee').oninput=()=>{save('rwhub_fee',fee());render();};
 $('marketSearch').oninput=()=>{pageSize=60;renderPrices();};$('marketScope').onchange=()=>{pageSize=60;renderPrices();};
 $('marketSkill').onchange=()=>{pageSize=60;render();};$('marketMethodSearch').oninput=()=>{profitSize=30;renderProfits();};
 $('marketComplete').onchange=$('marketEligible').onchange=()=>renderProfits();
 $('marketMore').onclick=()=>{pageSize+=60;renderPrices();};$('marketProfitMore').onclick=()=>{profitSize+=30;renderProfits();};
 $('marketRefresh').onclick=()=>refresh();
 for(const id of ['recipeOutput','recipeOutputQty','recipeActions','recipeInputs','recipeXp'])$(id).oninput=renderRecipe;
 $('recipeOutput').oninput=()=>{$('recipeNoInputs').checked=false;$('recipeXp').value='';$('recipeOrigin').textContent='Output edited manually. Verify ingredient quantities, output batch and XP against the game.';renderRecipe();};
 $('recipeNoInputs').onchange=renderRecipe;
 function quoteMarkup(q){return '<strong>'+num(q.price)+'</strong><span class="market-source '+(q.kind==='vendor-wiki'||q.stale?'market-caution':'')+'">'+esc(q.label)+(q.shop?' · '+esc(q.shop):'')+(q.stale?' · stale / age unknown':'')+'</span>';}
 function dataItems(){
  const items=new Map(),knownNames=new Set();for(const r of book.items.values()){items.set(r._id,{name:r.name,id:r.entry||null});knownNames.add(C.key(r.name));}
  for(const t of book.trades.values())if(t.entry&&!items.has(String(t.entry))){items.set(String(t.entry),{name:t.name,id:t.entry});knownNames.add(C.key(t.name));}
  const add=name=>{if(!knownNames.has(C.key(name))&&!book.record(name)&&!book.ambiguous(name)){items.set('name:'+C.key(name),{name,id:null});knownNames.add(C.key(name));}};
  for(const v of book.vendors)add(v.item);for(const m of methods)for(const n of [...Object.keys(m.inputs||{}),...Object.keys(m.outputs||{})])add(n);
  for(const value of watch.values())if(value.id&&!items.has(String(value.id)))items.set(String(value.id),{name:value.name,id:value.id});else add(value.name);
  return [...items.values()].sort((a,b)=>a.name.localeCompare(b.name));
 }
 function relevantMethods(){const skill=$('marketSkill').value;return methods.filter(m=>!skill||Object.keys(m.requirements||{}).some(s=>C.skillKey(s)===C.skillKey(skill))||C.skillKey(String(m.category||'').split('/')[0])===C.skillKey(skill));}
 function renderPrices(){
  const query=$('marketSearch').value.toLowerCase().trim(),scope=$('marketScope').value;
  const relevant=relevantMethods(),supplies=new Set(relevant.flatMap(m=>Object.keys(m.inputs||{})).map(C.key)),skillItems=new Set(relevant.flatMap(m=>[...Object.keys(m.inputs||{}),...Object.keys(m.outputs||{})]).map(C.key));
  const rows=dataItems().filter(i=>(!query||i.name.toLowerCase().includes(query)||String(i.id||'')===query||book.vendorOffers(i.name).some(v=>v.shop.toLowerCase().includes(query)))&&(!$('marketSkill').value||skillItems.has(C.key(i.name)))&&(scope!=='supplies'||supplies.has(C.key(i.name)))&&(scope!=='watch'||watched(i.name,i.id)));
  $('marketRows').innerHTML=rows.slice(0,pageSize).map(i=>{
   const r=book.record(i.name,i.id),buy=book.quote(i.name,'buy',{id:i.id,overrides}),sell=book.quote(i.name,'sell',{id:i.id,overrides});
   const h=book.history(i.name,i.id).at(-1),last=h||(r&&C.positive(r.last)?{price:Number(r.last),at:r.lastAt}:null),tracked=watched(i.name,i.id);
   return '<tr><td><button class="market-star" data-watch="'+esc(i.name)+'" data-entry="'+esc(i.id||'')+'" aria-label="'+(tracked?'Untrack ':'Track ')+esc(i.name)+'">'+(tracked?'★':'☆')+'</button> <button class="market-item-link" data-item="'+esc(i.name)+'" data-entry="'+esc(i.id||'')+'">'+esc(i.name)+'</button></td><td>'+quoteMarkup(buy)+'</td><td>'+quoteMarkup(sell)+'</td><td>'+num(last?.price)+'<span class="market-source">'+(last?esc(time(last.at)):'No observed trade')+'</span></td></tr>';
  }).join('')||'<tr><td colspan="4">No matching items. Clear the skill/search filter, or add items to your watchlist.</td></tr>';
  $('marketMore').hidden=rows.length<=pageSize;$('marketMore').textContent='Show more ('+Math.min(pageSize,rows.length)+' / '+rows.length+')';
 }
 function selectItem(name,id=null){selected={name,id};renderItem();}
 $('marketSearch').onkeydown=e=>{if(e.key==='Enter'&&$('marketSearch').value.trim())selectItem($('marketSearch').value.trim());};
 function renderItem(){
  if(!selected)return;const {name,id}=selected,r=book.record(name,id),hist=book.history(name,id),stats=book.stats(name,id);
  const buy=book.quote(name,'buy',{id,overrides}),sell=book.quote(name,'sell',{id,overrides});
  const range=hist.filter(t=>t.at>=Date.now()/1000-30*86400),points=range.length?range:hist;
  let chart='<p class="small">No observed trade history. No chart is inferred from guide prices.</p>';
  if(points.length){
   const prices=points.map(t=>t.price),min=Math.min(...prices),max=Math.max(...prices),first=points[0].at,last=points.at(-1).at;
   const xy=points.map(t=>({x:20+(t.at-first)/(last-first||1)*720,y:130-(t.price-min)/(max-min||1)*105,t}));
   chart='<svg class="market-chart" viewBox="0 0 760 160" role="img" aria-label="Observed completed trade prices"><line x1="20" y1="130" x2="740" y2="130" stroke="currentColor" opacity=".3"/><polyline fill="none" stroke="#79d5aa" stroke-width="2" points="'+xy.map(p=>p.x+','+p.y).join(' ')+'"/>'+xy.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3" fill="#e6bb72"><title>'+esc(time(p.t.at)+' · '+num(p.t.price)+' gp · '+num(p.t.qty)+' units')+'</title></circle>').join('')+'<text x="20" y="154" fill="currentColor" font-size="11">'+esc(new Date(first*1000).toLocaleDateString())+'</text><text x="620" y="154" fill="currentColor" font-size="11">'+esc(new Date(last*1000).toLocaleDateString())+'</text></svg><p class="small">Observed range '+num(min)+'–'+num(max)+' gp · '+points.length+' collected trades. Hover a point for price, time and quantity.</p>';
  }
  const vendors=book.vendorOffers(name);
  $('marketItemDetail').innerHTML='<section class="market-detail"><div class="market-heading"><h3>'+esc(name)+'</h3><div><button data-watch="'+esc(name)+'" data-entry="'+esc(id||'')+'">'+(watched(name,id)?'Untrack':'Track item')+'</button> <button data-price-recipe="'+esc(name)+'">Price a recipe</button></div></div><div class="market-metrics"><div>Buy estimate'+quoteMarkup(buy)+'</div><div>Sell estimate'+quoteMarkup(sell)+'</div><div>Observed 24h VWAP<strong>'+num(stats.observedVwap)+'</strong><span class="market-source">'+num(stats.observedQuantity)+' units in collected trades only</span></div><div>24h volume at snapshot time<strong>'+num(r?.vol24h)+'</strong><span class="market-source">From GE snapshot, not a guaranteed buyer</span></div></div>'+chart+
  '<p class="small">'+esc(buy.note||'')+' '+esc(sell.note||'')+'</p>'+(vendors.length?'<details><summary>'+vendors.length+' matched vendor references</summary><div class="market-table-wrap"><table><thead><tr><th>Shop</th><th>You buy</th><th>You sell</th><th>Reference stock / condition</th></tr></thead><tbody>'+vendors.map(v=>'<tr><td><a href="'+esc(safeUrl(v.shopSource))+'" target="_blank" rel="noopener noreferrer">'+esc(v.shop)+'</a></td><td>'+num(v.buyFromVendor)+'</td><td>'+num(v.sellToVendor)+'</td><td>'+esc(v.referenceStock)+(v.conditions?' · '+esc(v.conditions):'')+'</td></tr>').join('')+'</tbody></table></div><p class="small">Wiki references. Client-listed vendor presence does not confirm server inventory. Prices change with stock.</p></details>':'<p class="small">No supported vendor reference for this item.</p>')+'</section>';
 }
 function methodResult(m){const quantities=C.hourly(m,state.skills);return {...C.calculate(book,{...quantities,overrides,feePercent:fee()}),quantities,short:C.shortfalls(m,state.skills)};}
 function renderProfits(){
  const search=$('marketMethodSearch').value.toLowerCase().trim();
  const list=relevantMethods().map(m=>({m,result:methodResult(m)})).filter(({m,result:r})=>(!search||m.name.toLowerCase().includes(search))&&(!$('marketComplete').checked||!r.missing.length)&&(!$('marketEligible').checked||!r.short.length)).sort((a,b)=>(b.result.net??-Infinity)-(a.result.net??-Infinity));
  $('marketProfitRows').innerHTML=list.slice(0,profitSize).map(({m,result:r})=>'<tr><td><button class="market-item-link" data-method="'+esc(m.name)+'">'+esc(m.name)+'</button><span class="market-source">'+esc(m.category||'Other')+(r.short.length?' · levels: '+esc(r.short.join(', ')):' · level requirements met')+'</span></td><td>'+(!r.missing.length?num(r.cost):'Incomplete')+'</td><td>'+(!r.missing.length?num(r.gross):'Incomplete')+'</td><td class="'+(r.net<0?'market-loss':'market-gain')+'">'+num(r.net)+'</td><td>'+esc(r.missing.length?r.missing.join(', '):r.rows.some(row=>row.quote.stale)?'Stale history / time unknown':r.vendorReference?'Includes Wiki shop reference':r.reference?'Includes historical / observed vendor prices':'Current GE quotes')+'<span class="market-source">'+esc(r.quantities.rateLabel)+'</span></td></tr>').join('')||'<tr><td colspan="5">No methods match. Try turning off “Priced methods only” to inspect missing prices.</td></tr>';
  $('marketProfitMore').hidden=list.length<=profitSize;
 }
 function breakdown(result){return '<div class="market-table-wrap"><table><thead><tr><th>Item / direction</th><th>Quantity</th><th>Unit gp</th><th>Total gp</th><th>Source</th></tr></thead><tbody>'+result.rows.map(r=>'<tr><td>'+esc(r.name)+'<span class="market-source">'+(r.role==='buy'?'Ingredient':'Output')+'</span></td><td>'+num(r.qty)+'</td><td>'+num(r.unit)+'</td><td>'+num(r.total)+'</td><td>'+esc(r.quote.label)+(r.quote.shop?' · '+esc(r.quote.shop):'')+(r.quote.stale?' · stale / age unknown':'')+'</td></tr>').join('')+'</tbody></table></div>';}
 function showMethod(name){
  const m=methods.find(m=>m.name===name);if(!m)return;const r=methodResult(m);
  $('marketMethodDetail').innerHTML='<section class="market-detail"><h3>'+esc(name)+'</h3><p>'+esc(m.note||'')+'</p><p class="small">'+esc(r.quantities.rateLabel)+' · Hourly values are estimates. Available GE quantity may be spread across prices; vendor prices may change for each unit.</p>'+breakdown(r)+'<button data-use-method="'+esc(name)+'">Use in recipe calculator</button><details><summary>Edit this method’s quantities</summary><form id="methodEditForm" class="market-recipe-grid"><label class="market-wide">Hourly ingredients: item | quantity<textarea id="methodEditInputs">'+esc(Object.entries(m.inputs||{}).map(([n,q])=>n+' | '+q).join('\n'))+'</textarea></label><label class="market-wide">Hourly outputs: item | quantity<textarea id="methodEditOutputs">'+esc(Object.entries(m.outputs||{}).map(([n,q])=>n+' | '+q).join('\n'))+'</textarea></label><button>Save local method</button></form></details></section>';
  $('methodEditForm').onsubmit=e=>{e.preventDefault();try{m.inputs=C.parseIngredients($('methodEditInputs').value);m.outputs=C.parseIngredients($('methodEditOutputs').value);m.rate_profile=null;m.base_actions_per_hour=0;m.note='Your saved hourly quantities; verify throughput and supplies in game.';methodOverrides[m.name]=m;save('rwhub_method_overrides',methodOverrides);renderProfits();showMethod(name);}catch(e){alert(e.message);}};
 }
 function useMethod(name,preserveGoal=false){
  const m=methods.find(m=>m.name===name);if(!m)return;if(!preserveGoal){$('recipeActions').value='1';$('recipeXp').value=C.positive(m.xp_per_action)?String(m.xp_per_action):'';}const outputs=Object.entries(m.outputs||{}),base=Number(m.base_actions_per_hour);
  if(outputs.length!==1||!C.positive(base)){$('recipeOutput').value=outputs.length===1?outputs[0][0]:'';$('recipeOutputQty').value='1';$('recipeInputs').value='';$('recipeNoInputs').checked=false;recipeOrigin='This method has no verified per-action batch basis. Enter actual recipe quantities; do not infer them from hourly outputs.';$('recipeOrigin').textContent=recipeOrigin;tab('recipe');return;}
  $('recipeOutput').value=outputs[0][0];$('recipeOutputQty').value=String(outputs[0][1]/base);$('recipeInputs').value=Object.entries(m.inputs||{}).map(([n,q])=>n+' | '+q/base).join('\n');$('recipeNoInputs').checked=!Object.keys(m.inputs||{}).length;
  recipeOrigin='Imported per-action ratios from '+m.name+'. These are reference method quantities; verify the recipe and output batch in RunicWorld.';$('recipeOrigin').textContent=recipeOrigin;tab('recipe');
 }
 function renderRecipe(){
  if(!initialized)return;
  const name=$('recipeOutput').value.trim(),qty=Number($('recipeOutputQty').value),actions=Number($('recipeActions').value),xp=Number($('recipeXp').value);
  if(!name){$('recipeResults').textContent='Choose the item you want to make.';return;}
  try{
   if(!C.positive(qty)||!Number.isInteger(actions)||actions<1||actions>1e9)throw Error('Enter a positive output quantity and a whole number of actions.');
   const inputs=C.parseIngredients($('recipeInputs').value),known=Object.keys(inputs).length>0||$('recipeNoInputs').checked;
   const totals=Object.fromEntries(Object.entries(inputs).map(([n,q])=>[n,q*actions]));
   const result=C.calculate(book,{inputs:totals,outputs:{[name]:qty*actions},inputsKnown:known,overrides,feePercent:fee()});
   $('recipeResults').innerHTML='<div class="market-metrics"><div>Planned actions<strong>'+num(actions)+'</strong></div><div>Ingredient cost<strong>'+(!result.missing.length?num(result.cost):'Incomplete')+'</strong></div><div>Est. sale value<strong>'+(!result.missing.length?num(result.gross):'Incomplete')+'</strong></div><div>Est. net profit<strong>'+num(result.net)+'</strong></div></div>'+(result.missing.length?'<p class="error">Missing: '+esc(result.missing.join(', '))+'. No zero-cost assumption has been made.</p>':'<p class="small">'+(xp>0?'Net gp/XP: '+num(result.net/(xp*actions))+' · ':'')+(result.reference?'Includes reference prices. ':'')+'Best-price quantities and Wiki stock do not guarantee execution for this batch.</p>')+breakdown(result);
  }catch(e){$('recipeResults').textContent=e.message;}
 }
 function renderOverrides(){
  $('vendorOverrides').innerHTML=Object.entries(overrides).flatMap(([item,roles])=>Object.entries(roles).map(([role,v])=>'<div class="small">'+esc(item)+' · '+esc(role)+' · '+num(v.price)+' gp · '+esc(v.shop)+' <button data-remove-vendor="'+esc(item)+'" data-role="'+esc(role)+'">Remove</button></div>')).join('');
 }
 $('vendorOverrideForm').onsubmit=e=>{e.preventDefault();const name=$('vendorOverrideItem').value.trim(),p=Number($('vendorOverridePrice').value),shop=$('vendorOverrideShop').value.trim(),role=$('vendorOverrideRole').value;if(!name||!shop||!Number.isFinite(p)||p<0)return;const k=C.key(name);overrides[k]??={};overrides[k][role]={price:p,shop,at:Date.now()/1000};save('rwhub_vendor_overrides',overrides);renderOverrides();render();};
 panel.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.item)selectItem(b.dataset.item,b.dataset.entry||null);
  if(b.dataset.watch){const k=watchKey(b.dataset.watch,b.dataset.entry||null);if(watched(b.dataset.watch,b.dataset.entry||null)){watch.delete(k);watch.delete(C.key(b.dataset.watch));}else watch.set(k,{name:b.dataset.watch,id:b.dataset.entry||book.record(b.dataset.watch)?.entry||null});save('rwhub_watchlist',[...watch]);renderPrices();renderItem();}
  if(b.dataset.method)showMethod(b.dataset.method);
  if(b.dataset.useMethod)useMethod(b.dataset.useMethod);
  if(b.dataset.priceRecipe){$('recipeOutput').value=b.dataset.priceRecipe;$('recipeInputs').value='';$('recipeNoInputs').checked=false;$('recipeActions').value='1';$('recipeOutputQty').value='1';$('recipeXp').value='';$('recipeOrigin').textContent='Enter the actual materials and batch output from the in-game crafting menu.';tab('recipe');}
  if(b.dataset.removeVendor){delete overrides[b.dataset.removeVendor][b.dataset.role];save('rwhub_vendor_overrides',overrides);renderOverrides();render();}
 });
 function render(){if(!initialized)return;status();if(activeTab==='prices'){renderPrices();renderItem();}else if(activeTab==='profits')renderProfits();else renderRecipe();}
 async function json(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);return response.json();}
 function persist(){save('rwhub_market_cache',{generated:book.generated,items:[...book.items.values()],trades:[]});save('rwhub_observed_trades',[...book.trades.values()]);}
 function vendorCoverage(){if($('vendorCoverage'))$('vendorCoverage').textContent=(vendorData?.vendors.length||0)+' Wiki shop variants matched to named RunicWorld client vendors/NPCs; '+book.vendors.length+' reference offers. Exported '+(vendorData?.generatedAt||'unknown')+'. No generic general-store buy-back formula is applied.';}
 async function sharedReferences(){
  if(Date.now()-lastSharedAttempt<15*60000)return;lastSharedAttempt=Date.now();
  const vendorUrl=window.RUNICWORLD_CONFIG?.vendorReferenceUrl||'https://raw.githubusercontent.com/davidja92/runicworld-quest-hub/main/vendor-prices.json';
  const results=await Promise.allSettled([json('https://raw.githubusercontent.com/davidja92/runicworld-profit-finder/main/trade_history.json'),json(vendorUrl)]);
  if(results[0].status==='fulfilled'){const h=results[0].value;book.addHistory(h.trades||[]);lastHistoryAt=h.last_collection_at||lastHistoryAt;persist();}
  if(results[1].status==='fulfilled'){const v=results[1].value;if(v.schema===1&&Array.isArray(v.offers)&&v.offers.length&&Array.isArray(v.vendors)&&(!vendorData||Date.parse(v.generatedAt)>=Date.parse(vendorData.generatedAt))){vendorData=v;book.vendors=v.offers;vendorCoverage();}}
  render();
 }
 async function refresh(){
  if(pending)return;pending=true;$('marketRefresh').disabled=true;
  try{const base=String(window.RUNICWORLD_CONFIG?.proxyBase||'').replace(/\/+$/,'');const data=await json((base||'https://runicworld.com/api/site')+'/ge/market');book.setMarket(data,{live:true,source:'RunicWorld GE API'});sourceMessage='GE feed received: '+book.items.size+' items';liveError='';persist();}
  catch(e){liveError='Live refresh failed ('+e.message+'); previous data retained';}
  finally{pending=false;$('marketRefresh').disabled=false;render();sharedReferences();}
 }
 async function init(){
  if(loading)return loading;
  loading=(async()=>{
   const cached=read('rwhub_market_cache',null),oldCache=read('rw_profit_live_market_v63',null);
   if(cached)try{book.setMarket(cached,{source:'browser cache'});sourceMessage='Cached GE data';}catch{}
   else if(oldCache)try{book.setMarket(oldCache.payload||oldCache.blob||oldCache,{source:'previous tracker cache'});}catch{}
   book.addHistory(read('rwhub_observed_trades',[]));book.addHistory(read('rw_observed_trades_v70',{})?.trades||[]);
   const results=await Promise.allSettled([json('profit-methods.json'),json('vendor-prices.json'),json('trade_history.json'),json('market_snapshot.json')]);
   if(results[0].status==='fulfilled'&&Array.isArray(results[0].value.METHODS))methods=results[0].value.METHODS;else loadWarnings.push('profit-methods.json');
   if(originalProfit?.methods)for(const m of originalProfit.methods)methodOverrides[m.name]??=m;
   methods=methods.map(m=>methodOverrides[m.name]||m);const names=new Set(methods.map(m=>m.name));methods.push(...Object.values(methodOverrides).filter(m=>m&&m.name&&!names.has(m.name)));
   if(results[1].status==='fulfilled'&&Array.isArray(results[1].value.offers)&&Array.isArray(results[1].value.vendors)){vendorData=results[1].value;book.vendors=vendorData.offers;}else loadWarnings.push('vendor-prices.json');
   if(results[2].status==='fulfilled'){book.addHistory(results[2].value.trades||[]);lastHistoryAt=results[2].value.last_collection_at||null;}
   if(results[3].status==='fulfilled'&&(!book.items.size||Number(results[3].value.generated)>Number(book.generated))){book.setMarket(results[3].value,{source:'bundled snapshot'});sourceMessage='Bundled GE snapshot (not live)';}
   initialized=true;
   vendorCoverage();
   $('marketItemNames').innerHTML=dataItems().map(i=>'<option value="'+esc(i.name)+'"></option>').join('');renderOverrides();render();
   // The existing tracker repository keeps collecting trades. Prefer it over
   // the bundled file when accessible, while retaining older local observations.
   sharedReferences();refresh();
  })();return loading;
 }
 let autoTimer;function schedule(){if(autoTimer)clearInterval(autoTimer);const minutes=Number($('marketInterval').value);save('rwhub_refresh_minutes',minutes);if(minutes>0)autoTimer=setInterval(()=>{if(!document.hidden&&initialized)refresh();},minutes*60000);}
 $('marketInterval').value=String(read('rwhub_refresh_minutes',5));$('marketInterval').onchange=schedule;schedule();
 $('trainingMethods').addEventListener('click',async e=>{
  const b=e.target.closest('[data-market-name]');if(!b)return;
  const skill=b.dataset.marketSkill,xp=Number(b.dataset.marketXp),actions=Number(b.dataset.marketActions)||1;
  closeTraining();open('',skill);await init();
  let name=book.record(b.dataset.marketName,b.dataset.marketEntry||null)?.name||b.dataset.marketName;
  // Fishing calculator labels omit "Raw" for many catches. Only remap when
  // the existing fishing-method data explicitly lists that raw output.
  if(skill==='Fishing'&&methods.some(m=>Object.keys(m.requirements||{}).some(s=>C.skillKey(s)==='fishing')&&Object.keys(m.outputs||{}).some(n=>C.key(n)===C.key('Raw '+name))))name='Raw '+name;
  $('recipeOutput').value=name;$('recipeOutputQty').value='1';$('recipeInputs').value='';$('recipeNoInputs').checked=false;$('recipeActions').value=String(actions);$('recipeXp').value=xp>0?String(xp):'';
  const matches=methods.filter(m=>Object.keys(m.outputs||{}).length===1&&C.key(Object.keys(m.outputs)[0])===C.key(name)&&C.positive(m.base_actions_per_hour)&&Object.keys(m.requirements||{}).some(s=>C.skillKey(s)===C.skillKey(skill)));
  if(matches.length===1)useMethod(matches[0].name,true);else {$('recipeOrigin').textContent='Selected from the RunicWorld '+skill+' planner. Ingredient quantities and batch output are not recorded for this entry; enter them from the game.';tab('recipe');}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&initialized)render();});
 document.addEventListener('runichub:character-updated',()=>{if(initialized)render();});
})();
