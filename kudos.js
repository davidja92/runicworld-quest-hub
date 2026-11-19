// Estimates from marked completions, not a live or claimed museum balance.
// Reference: https://oldschool.runescape.wiki/w/Historian_Minas
// Quiz: https://oldschool.runescape.wiki/w/Kudos#Natural_history_quiz
// RunicWorld's server reward mapping is not exposed by the inspected client.
(function(root){
 'use strict';
 const rewards=[
  {name:'Demon Slayer',value:5},
  {name:'Rune Mysteries',value:5},
  {name:'Shield of Arrav',value:5},
  {name:'The Grand Tree',value:5},
  {name:'Hazeel Cult',value:5},
  {name:'In Aid of the Myreque',value:5},
  {name:'Making History',value:5},
  {name:"Merlin's Crystal",value:5},
  {name:'Observatory Quest',value:5},
  {name:'Priest in Peril',value:5},
  {name:'A Tail of Two Cats',value:5},
  {name:'Temple of Ikov',value:5},
  {name:'What Lies Below',value:5},
  {name:'Defender of Varrock',value:5},
  {name:'Ghostly Robes',aliases:['Curse of the Empty Lord'],value:10,note:'Assumes the full miniquest and complete ghostly robes set.'},
  {name:'Natural History Quiz',value:28,note:'Assumes all 14 animal displays are complete.'}
 ];
 const normalize=name=>String(name||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
 function calculate(done,catalogue){
  const available=new Set(catalogue.map(q=>normalize(q.name)));
  const completed=new Set(Object.entries(done||{}).filter(([,value])=>value===true).map(([name])=>normalize(name)));
  const entries=rewards.filter(r=>[r.name,...(r.aliases||[])].some(name=>available.has(normalize(name)))).map(r=>({...r,complete:[r.name,...(r.aliases||[])].some(name=>completed.has(normalize(name)))}));
  return {total:entries.filter(r=>r.complete).reduce((sum,r)=>sum+r.value,0),entries};
 }
 const api={calculate,rewards};root.QuestKudos=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
