(function(){
 'use strict';
 const C=QuestMapCore,D=QuestMapData,esc=escapeHtml;
 const dialog=document.createElement('dialog');dialog.className='qm-dialog';dialog.setAttribute('aria-label','Quest step map');document.body.append(dialog);
 let quest,steps=[],selected=0,layer='osrs4',zoom=1,placing=false,saved={},previousFocus;
 const storageKey='rqh_map_pins_v1';
 try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if(!saved||Array.isArray(saved)||typeof saved!=='object')saved={};}catch{saved={};}
 const id=s=>C.key(quest.name)+'|'+s.id;
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(saved));return true;}catch{dialog.querySelector('#qmStatus').textContent='Pins could not be saved: browser storage is full.';return false;}}
 function point(s){const p=saved[id(s)]||s.location;return C.valid(p,D.layers)?p:null;}
 function guideSteps(q){
  const body=document.getElementById('guideBody');if(!body)return [];
  let active=false,result=[];
  for(const e of body.querySelectorAll('h2,h3,li')){
   if(/^H[23]$/.test(e.tagName)){const t=e.textContent.toLowerCase();if(/walkthrough|getting started/.test(t))active=true;else if(/rewards|transcript|trivia|music unlocked/.test(t))active=false;}
   if(active&&e.tagName==='LI'&&!e.querySelector('li')&&!e.closest('table,.toc,nav')){const text=e.textContent.trim().replace(/\s+/g,' ');if(text.length>15)result.push({id:'guide:'+text,text,label:String(result.length+1)});}
  }
  return result.length?result:(q.steps||[]).map((text,i)=>({id:'outline:'+text,text,label:String(i+1)}));
 }
 function open(q){
  quest=q;placing=false;selected=0;const native=C.find(q.name,D.quests),outline=guideSteps(q);
  steps=[];
  if(native.start)steps.push({id:'start',text:'Start: '+native.start.name,label:'S',location:native.start});
  steps.push(...outline);
  if(!outline.length)steps.push({id:'unavailable',text:'Walkthrough steps are not loaded. Close this map, let the quest guide load, then reopen it. Custom RunicWorld quests need their own step data.',label:'?'});
  if(native.end)steps.push({id:'finish',text:'Finish: '+native.end.name,label:'F',location:native.end});
  if(!steps.length)steps=[{id:'custom',text:'Quest location — add a pin using the map or game coordinates.',label:'1'}];
  layer=point(steps[0])?.map||'osrs4';previousFocus=document.activeElement;
  render();dialog.showModal();fit();focusPin();
 }
 function render(){
  dialog.innerHTML=`<div class="qm-toolbar"><h2>${esc(quest.name)} · Map</h2><label>Layer <select id="qmLayer">${Object.entries(D.layers).map(([k,v])=>`<option value="${k}" ${k===layer?'selected':''}>${v.name}</option>`).join('')}</select></label><button id="qmOut" aria-label="Zoom out">−</button><button id="qmIn" aria-label="Zoom in">+</button><button id="qmFit">Fit map</button><button id="qmClose">Close</button></div><div class="qm-help">Client coordinates mark S (start) and F (finish). Numbered steps use your saved pins. Select a step to locate it. Drag to pan; use +/− to zoom. This map does not show live player position.</div><div class="qm-body"><div class="qm-list">${steps.map((s,i)=>`<button class="qm-step" data-step="${i}" aria-current="${i===selected}"><b>${s.label}.</b> ${esc(s.text)}<br><span class="small">${point(s)?esc(D.layers[point(s).map].name)+' · '+(saved[id(s)]?'Your saved pin':'Client location'):'Location not available — add pin'}</span></button>`).join('')}</div><div class="qm-stage" id="qmStage"><div class="qm-world" id="qmWorld"><img src="maps/${layer}.webp" alt="RunicWorld ${D.layers[layer].name} map"><div id="qmPins"></div></div></div></div><p id="qmStatus" class="qm-help" role="status"></p><div class="qm-toolbar"><button id="qmPlace">Pin selected step on map</button><button id="qmClear">Reset selected pin</button><button id="qmExport">Export pins</button><label>Import pins <input id="qmImport" type="file" accept="application/json,.json" style="width:205px"></label></div><details><summary>Set selected step using game world coordinates</summary><div class="qm-coords"><label>X <input id="qmX" type="number" step="any"></label><label>Y <input id="qmY" type="number" step="any"></label><button id="qmSet">Save coordinates on this layer</button></div><p class="small">Uses RunicWorld world coordinates, not OSRS tile coordinates. Pins are saved in this browser; export them for backup.</p></details>`;
  dialog.querySelector('#qmClose').onclick=()=>dialog.close();dialog.querySelector('#qmLayer').onchange=e=>{layer=e.target.value;placing=false;render();fit();};
  dialog.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>select(+b.dataset.step));
  dialog.querySelector('#qmIn').onclick=()=>scale(zoom*1.3);dialog.querySelector('#qmOut').onclick=()=>scale(zoom/1.3);dialog.querySelector('#qmFit').onclick=fit;
  dialog.querySelector('#qmPlace').onclick=()=>{placing=true;status('Click the selected step’s location on the '+D.layers[layer].name+' map.');};
  dialog.querySelector('#qmClear').onclick=()=>{delete saved[id(steps[selected])];save();refresh();};
  dialog.querySelector('#qmSet').onclick=()=>{const x=dialog.querySelector('#qmX'),y=dialog.querySelector('#qmY');if(!x.value.trim()||!y.value.trim())return status('Enter both X and Y.');setPoint({map:layer,x:+x.value,y:+y.value});};
  dialog.querySelector('#qmExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,pins:saved},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='runicworld-quest-pins.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  dialog.querySelector('#qmImport').onchange=async e=>{try{const f=e.target.files[0];if(!f||f.size>2000000)throw Error();const d=JSON.parse(await f.text());if(d.version!==1||!d.pins||Array.isArray(d.pins)||typeof d.pins!=='object'||Object.entries(d.pins).some(([k,p])=>!k.includes('|')||!C.valid(p,D.layers)))throw Error();Object.assign(saved,d.pins);save();refresh();status('Pins imported.');}catch{status('Could not import: choose a valid exported quest-pins JSON file.');}};
  const stage=dialog.querySelector('#qmStage');let drag=null;
  stage.onpointerdown=e=>{if(e.target.closest('button')||placing)return;drag={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};stage.setPointerCapture(e.pointerId);};
  stage.onpointermove=e=>{if(drag){stage.scrollLeft=drag.left+drag.x-e.clientX;stage.scrollTop=drag.top+drag.y-e.clientY;}};
  stage.onpointerup=()=>{drag=null;};stage.onpointercancel=()=>{drag=null;};
  dialog.querySelector('#qmWorld').onclick=e=>{if(!placing||e.target.closest('button'))return;const r=e.currentTarget.getBoundingClientRect();setPoint({map:layer,...C.unproject({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height},D.layers[layer])});};
  dialog.querySelector('img').onerror=()=>status('Map image missing. Upload the maps folder alongside the website files.');
  scale(zoom);pins();
 }
 function status(t){dialog.querySelector('#qmStatus').textContent=t;}
 function scale(z){const stage=dialog.querySelector('#qmStage'),old=zoom,cx=(stage.scrollLeft+stage.clientWidth/2)/old,cy=(stage.scrollTop+stage.clientHeight/2)/old;zoom=Math.max(.1,Math.min(3,z));const world=dialog.querySelector('#qmWorld');world.style.width=D.layers[layer].width*zoom+'px';world.style.height=D.layers[layer].height*zoom+'px';stage.scrollLeft=cx*zoom-stage.clientWidth/2;stage.scrollTop=cy*zoom-stage.clientHeight/2;}
 function fit(){const s=dialog.querySelector('#qmStage'),l=D.layers[layer];scale(Math.min(s.clientWidth/l.width,s.clientHeight/l.height));}
 function pins(){const groups=new Map();steps.forEach((s,i)=>{const p=point(s);if(!p||p.map!==layer)return;const k=p.x.toFixed(3)+','+p.y.toFixed(3);if(!groups.has(k))groups.set(k,{p,items:[]});groups.get(k).items.push({s,i});});dialog.querySelector('#qmPins').innerHTML=[...groups.values()].map(({p,items})=>{const n=C.project(p,D.layers[layer]),active=items.some(v=>v.i===selected),target=items.find(v=>v.i===selected)||items[0],label=items.map(v=>v.s.label).join('/'),title=items.map(v=>v.s.text).join(' · ');return `<button class="qm-pin" data-pin="${target.i}" aria-current="${active}" style="left:${n.x*100}%;top:${n.y*100}%" title="${esc(title)}" aria-label="${esc(title)}">${label}</button>`;}).join('');dialog.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>select(+b.dataset.pin));}
 function focusPin(){const p=point(steps[selected]);if(!p)return status('This step has no known location. Add a pin on the map or enter game coordinates.');const n=C.project(p,D.layers[layer]),s=dialog.querySelector('#qmStage');s.scrollLeft=n.x*D.layers[layer].width*zoom-s.clientWidth/2;s.scrollTop=n.y*D.layers[layer].height*zoom-s.clientHeight/2;status(steps[selected].text+' · X '+p.x.toFixed(1)+' / Y '+p.y.toFixed(1));}
 function select(i){selected=i;placing=false;const p=point(steps[i]);if(p&&p.map!==layer){layer=p.map;render();fit();}dialog.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.step===i)));pins();focusPin();}
 function refresh(){const z=zoom;render();scale(z);focusPin();}
 function setPoint(p){if(!C.valid(p,D.layers))return status('Those coordinates are outside this map layer.');saved[id(steps[selected])]=p;placing=false;const ok=save();refresh();if(!ok)status('Pin is temporary: browser storage is full. Export pins to keep it.');}
 dialog.addEventListener('close',()=>{placing=false;previousFocus?.focus();});
 function addButton(){const detail=document.getElementById('detail');if(!detail||!state.selected||state.view!=='quest'||detail.querySelector('[data-open-quest-map]'))return;const b=document.createElement('button');b.type='button';b.dataset.openQuestMap='true';b.textContent='Show all steps on map';b.onclick=()=>open(state.selected);detail.querySelector('.head-detail')?.append(b);}
 new MutationObserver(addButton).observe(document.getElementById('detail'),{childList:true});addButton();
 window.RunicQuestMap={open};
})();
