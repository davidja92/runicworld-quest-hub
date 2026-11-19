(function(root){
 'use strict';
 const aliases={shrimp:'shrimps',rawshrimp:'rawshrimps',feathers:'feather',arrowshafts:'arrowshaft'};
 function key(value){const k=String(value||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\(u\)/g,'unstrung').replace(/[^a-z0-9]/g,'');return aliases[k]||k;}
 const positive=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0;
 const price=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
 const timestamp=v=>positive(v)?(Number(v)>1e12?Number(v)/1000:Number(v)):null;
 const skillKey=s=>key(s)==='runecrafting'?'runecraft':key(s);
 class Book {
  constructor(){this.items=new Map();this.names=new Map();this.trades=new Map();this.historyCache=new Map();this.historyIndex=null;this.vendors=[];this.source='none';this.generated=null;this.received=null;this.live=false;}
  setMarket(blob,{live=false,source='snapshot',now=Date.now()}={}){
   if(!blob||!Array.isArray(blob.items))throw Error('Market response must contain an items array.');
   const items=new Map(),names=new Map();
   for(const raw of blob.items){
    if(!raw||typeof raw.name!=='string'||!raw.name.trim())continue;
    const id=positive(raw.entry)?String(raw.entry):'name:'+key(raw.name),r={...raw,_id:id};
    items.set(id,r);const list=names.get(key(raw.name))||[];if(!list.includes(id))list.push(id);names.set(key(raw.name),list);
   }
   if(!items.size)throw Error('Market response contained no valid items. Previous prices retained.');
   this.items=items;this.names=names;this.historyCache.clear();this.generated=timestamp(blob.generated);this.received=now/1000;this.live=live;this.source=source;
   this.addHistory(blob.trades||[]);return items.size;
  }
  addHistory(rows){
   if(!Array.isArray(rows))return;
   this.historyCache.clear();this.historyIndex=null;
   for(const r of rows){if(!r||!positive(r.price)||!positive(r.qty)||!timestamp(r.at)||typeof r.name!=='string')continue;
    const t={entry:positive(r.entry)?String(r.entry):null,name:r.name,at:timestamp(r.at),price:Number(r.price),qty:Number(r.qty)};
    if(t.at>Date.now()/1000+300)continue;
    this.trades.set([t.entry||key(t.name),t.at,t.price,t.qty].join('|'),t);
   }
   if(this.trades.size>30000){const rows=[...this.trades.entries()].sort((a,b)=>b[1].at-a[1].at).slice(0,30000);this.trades=new Map(rows);}
  }
  record(name,id){id=id||/^Item\s*#(\d+)$/i.exec(String(name))?.[1];if(id)return this.items.get(String(id))||null;const matches=this.names.get(key(name))||[];return matches.length===1?this.items.get(matches[0]):null;}
  ambiguous(name,id){return !id&&(this.names.get(key(name))||[]).length>1;}
  history(name,id){const r=this.record(name,id),entry=id?String(id):positive(r?.entry)?String(r.entry):null;
   const lookup=(entry?'id:'+entry:'name:'+key(name))+'|'+key(name);if(this.historyCache.has(lookup))return this.historyCache.get(lookup);
   if(!this.historyIndex){const entries=new Map(),names=new Map(),anonymous=new Map();const add=(m,k,v)=>{if(!m.has(k))m.set(k,[]);m.get(k).push(v);};for(const t of this.trades.values()){add(names,key(t.name),t);if(t.entry)add(entries,t.entry,t);else add(anonymous,key(t.name),t);}this.historyIndex={entries,names,anonymous};}
   const index=this.historyIndex,rows=entry?[...(index.entries.get(entry)||[]),...(index.anonymous.get(key(name))||[])]:[...(index.names.get(key(name))||[])];rows.sort((a,b)=>a.at-b.at);this.historyCache.set(lookup,rows);return rows;
  }
  vendorOffers(name){return this.vendors.filter(v=>key(v.item)===key(name)&&v.presenceConfirmed===true&&Array.isArray(v.presenceEvidence)&&v.presenceEvidence.length);}
  quote(name,role='buy',{id=null,now=Date.now(),overrides={}}={}){
   if(this.ambiguous(name,id))return {price:null,kind:'missing',label:'Ambiguous item name; select a specific GE item',at:null};
   const r=this.record(name,id),field=role==='buy'?'bestSell':'bestBuy',qtyField=role==='buy'?'sellQty':'buyQty';
   const fresh=this.live&&this.generated!==null&&now/1000-this.generated<=600&&this.generated<=now/1000+300;
   if(r&&fresh&&positive(r[field])&&positive(r[qtyField]))return {price:Number(r[field]),kind:'ge',label:role==='buy'?'GE seller ask':'GE buyer bid',at:this.generated,quantity:Number(r[qtyField]),stale:false,note:'Best price only. Aggregate quantity spans price levels; fills are not guaranteed.'};
   const history=this.history(name,id);let h=history.length?history[history.length-1]:null;
   const lastAt=timestamp(r?.lastAt);if(r&&positive(r.last)&&(!h||(lastAt!==null&&lastAt<=now/1000+300&&lastAt>=h.at)))h={price:Number(r.last),at:lastAt!==null&&lastAt<=now/1000+300?lastAt:null,qty:null};
   if(h)return {price:h.price,kind:'history',label:'Last completed GE trade',at:h.at,stale:h.at===null||now/1000-h.at>86400,note:'Historical reference, not an executable current offer.'};
   const custom=overrides[key(r?.name||name)]?.[role];
   if(custom&&price(custom.price)&&custom.shop)return {price:Number(custom.price),kind:'vendor-confirmed',label:'Your observed NPC '+(role==='buy'?'purchase':'sell-to-shop')+' price',at:timestamp(custom.at),shop:custom.shop,note:'User-entered RunicWorld price. Stock may affect later units.'};
   const valueField=role==='buy'?'buyFromVendor':'sellToVendor';
   const candidates=this.vendorOffers(r?.name||name).filter(v=>!v.conditions&&price(v[valueField]));
   candidates.sort((a,b)=>role==='buy'?a[valueField]-b[valueField]:b[valueField]-a[valueField]);
   if(candidates.length){const v=candidates[0];return {price:Number(v[valueField]),kind:'vendor-wiki',label:'Wiki vendor reference',shop:v.shop,at:null,reference:true,source:v.source,shopSource:v.shopSource,quantity:v.referenceStock,note:'Vendor/NPC is listed in RunicWorld client data. Wiki stock and prices are not confirmed on the server; bulk prices can change.'};}
   return {price:null,kind:'missing',label:'No GE quote, history, or matched vendor price',at:null};
  }
  stats(name,id,now=Date.now()){
   const rows=this.history(name,id).filter(t=>t.at>=now/1000-86400),qty=rows.reduce((n,t)=>n+t.qty,0);
   return {observedTrades:rows.length,observedQuantity:qty,observedVwap:qty?rows.reduce((n,t)=>n+t.price*t.qty,0)/qty:null};
  }
 }
 function amountMap(value){const out={};for(const [name,q]of Object.entries(value||{})){if(positive(q))out[name]=Number(q);}return out;}
 function netSale(quote,feePercent){if(quote.price===null)return null;return quote.price-(['ge','history'].includes(quote.kind)?Math.floor(quote.price*Math.max(0,Math.min(100,Number(feePercent)||0))/100):0);}
 function calculate(book,{inputs={},outputs={},inputsKnown=true,flatCost=0,flatIncome=0,feePercent=0,overrides={}}){
  const rows=[],missing=[];let cost=Number(flatCost)||0,gross=Number(flatIncome)||0;
  for(const values of [inputs,outputs])for(const [name,q]of Object.entries(values||{}))if(q!==0&&!positive(q))missing.push('Invalid quantity: '+name);
  for(const [role,values]of [['buy',amountMap(inputs)],['sell',amountMap(outputs)]])for(const [name,qty]of Object.entries(values)){
   const q=book.quote(name,role,{overrides}),unit=role==='sell'?netSale(q,feePercent):q.price;
   if(unit===null)missing.push(name);else if(role==='buy')cost+=unit*qty;else gross+=unit*qty;
   rows.push({name,role,qty,quote:q,unit,total:unit===null?null:qty*unit});
  }
  if(!inputsKnown)missing.push('Ingredient quantities not supplied');
  if(!Object.keys(amountMap(outputs)).length)missing.push('No output supplied');
  return {rows,missing,cost,gross,net:missing.length?null:gross-cost,reference:rows.some(r=>r.quote.kind!=='ge'),vendorReference:rows.some(r=>r.quote.kind==='vendor-wiki')};
 }
 function hourly(method,skills={}){
  const out={inputs:amountMap(method.inputs),outputs:amountMap(method.outputs),flatIncome:Number(method.flat_income)||0,flatCost:Number(method.flat_cost)||0,rateLabel:'Imported hourly estimate',factor:1};
  const levels=Object.fromEntries(Object.entries(skills).map(([s,l])=>[skillKey(s),Number(l)]));
  const profile=method.rate_profile,base=Number(method.base_actions_per_hour);
  if(profile&&positive(base)&&Number.isFinite(levels[skillKey(profile.skill)])){
   const tiers=(profile.rates||[]).filter(t=>Number(t.level)<=levels[skillKey(profile.skill)]&&positive(t.actions_per_hour)).sort((a,b)=>Number(a.level)-Number(b.level));
   if(tiers.length){const tier=tiers[tiers.length-1];out.factor=Number(tier.actions_per_hour)/base;out.rateLabel=Number(tier.actions_per_hour).toLocaleString()+' actions/hour · '+(profile.evidence==='modeled_not_verified'?'modeled estimate':'Wiki rate reference');}
  }
  for(const field of ['inputs','outputs'])out[field]=Object.fromEntries(Object.entries(out[field]).map(([name,q])=>[name,q*out.factor]));
  out.flatIncome*=out.factor;out.flatCost*=out.factor;return out;
 }
 function shortfalls(method,skills){const levels=Object.fromEntries(Object.entries(skills||{}).map(([n,l])=>[skillKey(n),Number(l)]));return Object.entries(method.requirements||{}).filter(([name,required])=>!Number.isFinite(levels[skillKey(name)])||levels[skillKey(name)]<Number(required)).map(([name,level])=>name+' '+level);}
 function parseIngredients(text){
  const out={};for(const line of String(text||'').split(/\r?\n/).filter(s=>s.trim())){
   const parts=line.split('|');if(parts.length!==2||!parts[0].trim()||!positive(parts[1]))throw Error('Use one ingredient per line: Item name | quantity');
   const name=parts[0].trim();out[name]=(out[name]||0)+Number(parts[1]);
  }return out;
 }
 const api={Book,key,skillKey,calculate,hourly,shortfalls,parseIngredients,netSale,positive};root.RunicMarketCore=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
