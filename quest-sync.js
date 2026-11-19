(function(root){
 'use strict';
 const normalize=value=>String(value||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
 const characterKey=value=>String(value||'').trim().toLowerCase();
 function merge(snapshot,character,catalogue,previous,now=Date.now()){
  if(!snapshot||snapshot.version!==1||characterKey(snapshot.character)!==characterKey(character))throw Error('Snapshot belongs to a different character.');
  if(!Number.isFinite(snapshot.collectedAt)||Math.abs(now/1000-snapshot.collectedAt)>300)throw Error('Game data is stale. Focus the game and keep the sync panel visible.');
  if(!Array.isArray(snapshot.completed)||snapshot.completed.length>1000)throw Error('Invalid quest data.');
  const index=new Map(catalogue.map(q=>[normalize(q.name),q.name]));
  const done={...previous},unknown=[];let added=0;
  for(const entry of snapshot.completed){
   if(!entry||typeof entry.name!=='string')throw Error('Invalid quest name.');
   const name=index.get(normalize(entry.name));
   if(!name){unknown.push(entry.name);continue;}
   if(!done[name]){done[name]=true;added++;}
  }
  let questPoints=null;
  if(snapshot.questPoints!==undefined){if(!Number.isInteger(snapshot.questPoints)||snapshot.questPoints<0||snapshot.questPoints>10000)throw Error('Invalid quest point total.');questPoints=snapshot.questPoints;}
  return {done,added,unknown,questPoints,farming:snapshot.farming||null};
 }
 const api={normalize,characterKey,merge};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.RWQuestSync=api;
})(typeof window==='undefined'?globalThis:window);
