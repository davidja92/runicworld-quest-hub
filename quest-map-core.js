(function(root){
 'use strict';
 const key=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
 function project(p,l){if(!l||!Number.isFinite(p.x)||!Number.isFinite(p.y))return null;const x=(l.left-p.y)/(l.left-l.right),y=(l.top-p.x)/(l.top-l.bottom);return x>=0&&x<=1&&y>=0&&y<=1?{x,y}:null;}
 function unproject(p,l){return {x:l.top-p.y*(l.top-l.bottom),y:l.left-p.x*(l.left-l.right)};}
 function find(name,data){const k=key(name);return Object.entries(data).find(([n])=>key(n)===k)?.[1]||{};}
 function valid(p,layers){return !!p&&!!project(p,layers[p.map]);}
 const api={key,project,unproject,find,valid};if(typeof module!=='undefined')module.exports=api;else root.QuestMapCore=api;
})(typeof window!=='undefined'?window:globalThis);
