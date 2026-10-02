/** Fusion engine: dynamic programming over disjoint sets of physical hand slots.
 * All unordered binary fusion trees are retained; operand swaps and identical-copy
 * permutations are equivalent. Inputs are consumed exactly once. No path cap.
 */
export function createEngine(db){
 const cards=new Map(db.cards.map(c=>[c.id,c])),explicit=new Map(db.recipes.map(r=>[[r.a,r.b].sort((a,b)=>a-b).join(','),r])),cache=new Map();
 const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const matches=(c,p)=>p.card!==undefined?c.id===p.card:c.groups.includes(p.group);
 const descriptor=p=>p.card!==undefined?cards.get(p.card).name:p.group;
 function fuse(a,b){
  const key=[a,b].sort((a,b)=>a-b).join(',');if(cache.has(key))return cache.get(key);
  const ex=explicit.get(key);if(ex){const outcomes=ex.results.map(r=>({id:r.id,sources:r.sources,uncertain:ex.results.length>1||r.sources.every(s=>s.includes('questionable')),note:ex.results.length>1?'The supplied sources list conflicting results for this pair.':r.sources.every(s=>s.includes('questionable'))?'Marked questionable in the supplied guide.':''}));cache.set(key,outcomes);return outcomes}
  const ca=cards.get(a),cb=cards.get(b);if(!ca||!cb)return [];
  let candidates=[];
  for(const rule of db.rules){
   if(!((matches(ca,rule.a)&&matches(cb,rule.b))||(matches(ca,rule.b)&&matches(cb,rule.a))))continue;
   const result=rule.results.find(id=>{const c=cards.get(id);return c.atk===null || (ca.atk!==null&&cb.atk!==null&&c.atk>Math.max(ca.atk,cb.atk))});
   if(result)candidates.push({id:result,rule});
  }
  // Suppress lower-priority rule candidates only when that higher fusion is valid.
  candidates=candidates.filter(c=>!candidates.some(other=>{
   if(other.id===c.id)return false;
   if(c.rule.priorityResults?.some(p=>p.id===other.id&&(!p.curseOnly||cards.get(c.id).name==='Curse of Dragon')))return true;
   const groupPair=[descriptor(other.rule.a),descriptor(other.rule.b)].map(normalize).sort().join(',');
   return c.rule.priorityGroups?.some(g=>g.map(normalize).sort().join(',')===groupPair)??false;
  }));
  const ids=[...new Set(candidates.map(c=>c.id))];const results=ids.map(id=>({id,sources:['CSV rule'],uncertain:ids.length>1,note:ids.length>1?'Overlapping rules have no resolved priority in the supplied sources.':''}));cache.set(key,results);return results;
 }
 function potentialPartners(id){
  if(!cards.has(id))throw new Error('Choose a valid card ID.');
  const combinations=[];
  for(const partner of cards.values())for(const outcome of fuse(id,partner.id))combinations.push({partnerId:partner.id,resultId:outcome.id,evidence:outcome});
  return combinations.sort((a,b)=>(cards.get(b.resultId).atk??-1)-(cards.get(a.resultId).atk??-1)||cards.get(a.partnerId).name.localeCompare(cards.get(b.partnerId).name)||cards.get(a.resultId).name.localeCompare(cards.get(b.resultId).name));
 }
 function explore(hand){
  if(!Array.isArray(hand)||hand.length>5||hand.length<2||hand.some(id=>!cards.has(id)))throw new Error('Choose two to five valid card IDs.');
  const states=Array.from({length:1<<hand.length},()=>new Map());
  for(let i=0;i<hand.length;i++){const t={id:hand[i],mask:1<<i,slot:i,key:`c${hand[i]}`,uncertain:false,steps:0};states[1<<i].set(t.key,t)}
  const all=new Map();
  for(let mask=1;mask<states.length;mask++){
   if((mask&(mask-1))===0)continue;
   for(let left=(mask-1)&mask;left>0;left=(left-1)&mask){const right=mask^left;if(!right||left>right)continue;
    for(const a of states[left].values())for(const b of states[right].values())for(const outcome of fuse(a.id,b.id)){
     const [l,r]=a.key<b.key?[a,b]:[b,a];const key=`${outcome.id}(${l.key},${r.key})`;
     if(states[mask].has(key))continue;
     const tree={id:outcome.id,mask,key,left:l,right:r,evidence:outcome,uncertain:l.uncertain||r.uncertain||outcome.uncertain,steps:l.steps+r.steps+1};
     states[mask].set(key,tree);if(!all.has(key))all.set(key,tree);
    }
   }
  }
  const grouped=new Map();for(const t of all.values()){if(!grouped.has(t.id))grouped.set(t.id,[]);grouped.get(t.id).push(t)}
  return [...grouped].map(([id,paths])=>({id,paths:paths.sort((a,b)=>a.uncertain-b.uncertain||a.steps-b.steps||a.key.localeCompare(b.key))})).sort((a,b)=>(cards.get(b.id).atk??-1)-(cards.get(a.id).atk??-1)||cards.get(a.id).name.localeCompare(cards.get(b.id).name));
 }
 // Direct fusions from physical deck copies. A selected slot restricts pairs to
 // that copy; identical copies cannot stand in for a missing second ingredient.
 function deckFusions(deck,selectedSlot=null){
  if(!Array.isArray(deck)||deck.length>40||deck.some(id=>!cards.has(id)))throw new Error('Choose up to 40 valid cards.');
  if(selectedSlot!==null&&(!Number.isInteger(selectedSlot)||selectedSlot<0||selectedSlot>=deck.length))throw new Error('Choose a valid deck slot.');
  const grouped=new Map(),seen=new Set();
  for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++){
   if(selectedSlot!==null&&i!==selectedSlot&&j!==selectedSlot)continue;
   const [a,b]=[deck[i],deck[j]].sort((a,b)=>a-b),key=`${a},${b}`;
   if(seen.has(key))continue;seen.add(key);
   for(const evidence of fuse(a,b)){
    if(!grouped.has(evidence.id))grouped.set(evidence.id,{id:evidence.id,pairs:[]});
    grouped.get(evidence.id).pairs.push({a,b,evidence});
   }
  }
  return [...grouped.values()].sort((a,b)=>(cards.get(b.id).atk??-1)-(cards.get(a.id).atk??-1)||cards.get(a.id).name.localeCompare(cards.get(b.id).name));
 }
 // Recipes in which the focused card is an ingredient, optionally restricted
 // to physical copies in a deck. Null deck searches the entire card library.
 function ingredientFusions(id,deck=null){
  if(!cards.has(id))throw new Error('Choose a valid card ID.');
  if(deck!==null){
   if(!Array.isArray(deck))throw new Error('Choose a valid deck.');
   const slot=deck.indexOf(id);if(slot<0)throw new Error('This card is not in the deck.');
   return deckFusions(deck,slot).map(r=>({...r,pairs:r.pairs.map(p=>({...p,a:id,b:p.a===id?p.b:p.a}))}));
  }
  const grouped=new Map();
  for(const p of potentialPartners(id)){
   if(!grouped.has(p.resultId))grouped.set(p.resultId,{id:p.resultId,pairs:[]});
   grouped.get(p.resultId).pairs.push({a:id,b:p.partnerId,evidence:p.evidence});
  }
  return [...grouped.values()];
 }
 function recipesProducing(id){
  return db.recipes.filter(r=>r.results.some(o=>o.id===id)).map(r=>({a:r.a,b:r.b,evidence:fuse(r.a,r.b).find(o=>o.id===id)}));
 }
 return {cards,fuse,potentialPartners,explore,deckFusions,ingredientFusions,recipesProducing};
}
export function stepsFor(tree){const steps=[];function walk(t){if(!t.left)return {id:t.id,slot:t.slot};const a=walk(t.left),b=walk(t.right);const n=steps.length+1;steps.push({a,b,id:t.id,n,evidence:t.evidence});return {id:t.id,step:n}}walk(tree);return steps}
export function hasSeparateBranches(t){return !!t.left&&((t.left.steps>0&&t.right.steps>0)||hasSeparateBranches(t.left)||hasSeparateBranches(t.right))}
