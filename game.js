import {pickerCard} from './card-ui.js';
import {stepsFor,hasSeparateBranches} from './engine.js';

const STORAGE_KEY='fusion-atlas.decks.v1';
export function createGameMode({root,engine,art,esc,toast,onDetail}){
  let decks=[],activeId=null,selected=[],editing=false,creating=false,confirmDelete=false;
  let storageError='',readFailed=false,shown=10,pathLimits={},matches=[];
  const card=id=>engine.cards.get(id),$=s=>root.querySelector(s);
  const active=()=>decks.find(d=>d.id===activeId);
  function load(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{"decks":[]}');
      if(!saved||!Array.isArray(saved.decks)||saved.decks.some(d=>!d||typeof d.id!=='string'||typeof d.name!=='string'||!Array.isArray(d.cards)||d.cards.length>40||d.cards.some(id=>!card(id)))||new Set(saved.decks.map(d=>d.id)).size!==saved.decks.length)throw Error();
      decks=saved.decks;activeId=decks.some(d=>d.id===saved.activeId)?saved.activeId:decks[0]?.id;
      storageError='';readFailed=false;
    }catch{readFailed=true;storageError='Saved decks could not be read. Enable browser storage and retry. Existing saved data has been preserved.';}
  }
  function save(){
    if(readFailed)return false;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({decks,activeId}));storageError='';return true;}
    catch{storageError='Changes are only in memory. Browser storage is unavailable or full. Keep this page open and retry saving.';return false;}
  }
  function calculate(){
    const deck=active();shown=10;pathLimits={};
    matches=!deck?[]:selected.length<2?engine.deckFusions(deck.cards,selected[0]??null):engine.explore(selected.map(i=>deck.cards[i]));
  }
  function render(){
    const deck=active();
    root.innerHTML=`<div class="game-title"><div><p class="eyebrow">DUEL COMPANION</p><h1>Game mode</h1></div><p class="muted">Your decks, ready at a glance.</p></div>
      <div class="game-deckbar panel"><label class="game-deck-select">Active deck<select id="gameDeck" ${!decks.length?'disabled':''}>${decks.length?decks.map(d=>`<option value="${esc(d.id)}" ${d.id===activeId?'selected':''}>${esc(d.name)} · ${d.cards.length} cards</option>`).join(''):'<option>No decks yet</option>'}</select></label><button class="button secondary" data-game-action="new" ${readFailed?'disabled':''}>+ New deck</button>${deck?`<button class="button ${editing?'primary':'secondary'}" data-game-action="edit">${editing?'Done editing':'Edit deck'}</button>`:''}<span class="game-save-note">${storageError?'Not saved':'Saved in this browser'}</span></div>
      ${storageError?`<div class="game-storage-error" role="alert">${esc(storageError)} <button class="button secondary" data-game-action="retry">Retry ${readFailed?'loading':'saving'}</button></div>`:''}
      ${creating||!deck&&!readFailed?`<form id="gameNewDeck" class="game-new panel"><label for="gameNewName">Deck name</label><input id="gameNewName" maxlength="60" required placeholder="e.g. Dragon / Thunder"><button class="button primary">Create deck</button>${deck?'<button type="button" class="text-button" data-game-action="cancel-new">Cancel</button>':''}</form>`:''}
      ${deck?`<div class="game-layout"><section class="game-board panel"><div class="panel-heading"><h2>${esc(deck.name)} <span>${deck.cards.length} / 40</span></h2>${editing?'<button class="text-button" data-game-action="delete">Delete deck</button>':`<button class="text-button" data-game-action="clear" ${!selected.length?'disabled':''}>Clear selection</button>`}</div>
      ${confirmDelete?`<div class="game-delete">Delete “${esc(deck.name)}” from this browser? <button class="button secondary" data-game-action="confirm-delete">Delete deck</button> <button class="text-button" data-game-action="cancel-delete">Keep deck</button></div>`:''}
      ${editing?`<label class="game-rename">Deck name<input id="gameName" maxlength="60" value="${esc(deck.name)}"></label>`:''}
      <div class="game-selection-bar"><span>${editing?'Add cards below; use × to remove a copy.':`${selected.length} / 5 selected · Click cards to build your current hand.`}</span>${!editing&&selected.length?`<span class="gold">${selected.length===1?'Deck partners':'Hand fusions'}</span>`:''}</div>
      <div class="deck-grid" aria-label="Cards in active deck">${deck.cards.map((id,i)=>{const c=card(id),selection=selected.indexOf(i);return `<div class="deck-cell ${selection>=0?'is-selected':''}"><button class="deck-card" data-game-slot="${i}" ${editing?`aria-label="View ${esc(c.name)} details"`:`aria-pressed="${selection>=0}" aria-label="${selection>=0?'Deselect':'Select'} ${esc(c.name)}, deck slot ${i+1}"`} title="${esc(c.name)} · ${c.atk??'—'} ATK">${art(c)}<span class="deck-card-name">${esc(c.name)}</span><span class="deck-card-atk">${c.atk??'—'} ATK</span>${selection>=0?`<span class="deck-selection-number">${selection+1}</span>`:''}</button>${editing?`<button class="deck-remove" data-game-remove="${i}" aria-label="Remove ${esc(c.name)}, copy in slot ${i+1}">×</button>`:''}</div>`}).join('')}</div>
      ${!deck.cards.length?`<div class="game-empty"><span class="alchemy">◇</span><h3>Your deck starts here.</h3><p>${editing?'Search the card catalog below to add your cards.':'Edit this deck to add cards from the catalog.'}</p>${!editing?'<button class="button primary" data-game-action="edit">Add cards</button>':''}</div>`:''}
      ${editing?`<section class="game-catalog"><h2>Add to deck</h2><div class="game-catalog-controls"><label class="search"><span>⌕</span><input id="gameSearch" type="search" placeholder="Card name or number…" aria-label="Search cards to add to deck"></label><select id="gameType" aria-label="Filter deck catalog by type"><option value="">All card types</option>${[...new Set([...engine.cards.values()].map(c=>c.type))].sort().map(t=>`<option>${esc(t)}</option>`).join('')}</select></div><div id="gameCatalog" class="game-catalog-list picker-grid"></div></section>`:''}</section>
      <aside class="game-fusions"><div class="panel-heading"><div><p class="eyebrow">HIGHEST ATTACK FIRST</p><h2 id="gameResultsTitle"></h2></div><span class="tag" id="gameResultCount"></span></div><p id="gameResultContext" class="game-result-context"></p><div id="gameResults" aria-live="polite"></div></aside></div>`:`<div class="game-empty panel"><span class="alchemy">✧</span><h2>A deck for every strategy.</h2><p>Create a deck to see its strongest direct fusions and select your hand during a duel.</p></div>`}`;
    if(deck){renderResults();if(editing)renderCatalog();}
  }
  function renderCatalog(){
    const deck=active(),q=$('#gameSearch').value.trim().toLowerCase(),type=$('#gameType').value;
    const cards=[...engine.cards.values()].filter(c=>(!type||c.type===type)&&(c.name.toLowerCase().includes(q)||String(c.id).padStart(3,'0').includes(q)));
    $('#gameCatalog').innerHTML=cards.slice(0,50).map(c=>pickerCard(c,{art,esc,target:'deck',disabled:deck.cards.length>=40,count:deck.cards.filter(id=>id===c.id).length})).join('')||'<p class="muted">No cards match your search.</p>';
    if(cards.length>50)$('#gameCatalog').insertAdjacentHTML('beforeend','<p class="card-meta">Showing 50 matches. Search to narrow the catalog.</p>');
  }
  function mini(id,label=''){
    const c=card(id);return `<button class="game-ingredient" data-detail="${id}">${art(c)}<span>${esc(c.name)}${label?`<small>${label}</small>`:''}</span></button>`;
  }
  function evidenceHtml(e){return `<p class="game-evidence">${e.sources.map(esc).join(' + ')}${e.uncertain?' · ⚠ '+esc(e.note):''}</p>`;}
  function pairHtml(p){return `<div class="game-pair"><div class="game-formula">${mini(p.a)}<span class="gold">+</span>${mini(p.b,p.a===p.b?'Second copy':'')}</div>${evidenceHtml(p.evidence)}</div>`;}
  function chainHtml(p){
    return `<div class="game-pair"><p class="game-path-label">${p.steps+1} cards · ${p.steps} ${p.steps===1?'fusion':'fusions'}${hasSeparateBranches(p)?' · Separate setup':''}</p>${stepsFor(p).map(s=>`<div class="game-chain-step"><span class="game-step-label">${s.n}</span><div><div class="game-formula">${mini(s.a.id,s.a.step?`Step ${s.a.step}`:`Selection ${s.a.slot+1}`)}<span class="gold">+</span>${mini(s.b.id,s.b.step?`Step ${s.b.step}`:`Selection ${s.b.slot+1}`)}</div><div class="game-chain-output"><span class="gold">→</span>${mini(s.id,'Result')}</div>${evidenceHtml(s.evidence)}</div></div>`).join('')}${hasSeparateBranches(p)?'<p class="warning">Prepare both branches separately before combining them.</p>':''}</div>`;
  }
  function renderResults(){
    $('#gameResultsTitle').textContent=selected.length>1?'Selected hand fusions':selected.length?'Partners in your deck':'Top deck fusions';
    $('#gameResultCount').textContent=`${matches.length} results`;
    $('#gameResultContext').textContent=selected.length>1?'All fusion chains from your selected copies, including intermediate results.':selected.length?'Direct fusions using this card and another card in your deck.':'Two-card fusions available in this deck. Select up to five cards to explore chains.';
    $('#gameResults').innerHTML=matches.length?matches.slice(0,shown).map((r,i)=>{const c=card(r.id),paths=r.pairs||r.paths,limit=pathLimits[r.id]||3;return `<article class="game-result panel"><div class="game-result-head"><span class="game-rank">${String(i+1).padStart(2,'0')}</span><button class="game-result-art" data-detail="${c.id}" aria-label="View ${esc(c.name)} details">${art(c)}</button><div><button class="card-name" data-detail="${c.id}">${esc(c.name)}</button><strong>${c.atk??'—'} <small>ATK</small></strong><span class="card-meta">${c.def??'—'} DEF${paths.some(p=>p.evidence?.uncertain||p.uncertain)?' · ⚠ Uncertain source':''}</span></div></div><details ${pathLimits[r.id]?'open':''}><summary>${paths.length} ${r.pairs?(paths.length===1?'ingredient pair':'ingredient pairs'):(paths.length===1?'fusion path':'fusion paths')}</summary><div class="game-pairs">${paths.slice(0,limit).map(r.pairs?pairHtml:chainHtml).join('')}${paths.length>limit?`<button class="text-button gold" data-game-paths="${r.id}">Show more (${paths.length-limit} remaining)</button>`:''}</div></details></article>`}).join('')+(matches.length>shown?`<button class="button secondary load-more" data-game-action="more">Show more results (${matches.length-shown} remaining)</button>`:''):`<div class="game-empty panel"><span class="alchemy">◇</span><h3>${active().cards.length<2?'Add cards to find fusions.':'No recorded fusions.'}</h3><p>${selected.length?'Try a different selection, or clear it to see your full deck.':'Add more cards to your deck to discover available pairs.'}</p></div>`;
  }
  function keepCatalogRender(){
    const q=$('#gameSearch')?.value||'',type=$('#gameType')?.value||'',scroll=$('#gameCatalog')?.scrollTop||0;
    render();if(editing){$('#gameSearch').value=q;$('#gameType').value=type;renderCatalog();$('#gameCatalog').scrollTop=scroll;}
  }
  root.addEventListener('submit',e=>{
    if(e.target.id!=='gameNewDeck')return;e.preventDefault();const name=$('#gameNewName').value.trim();if(!name){$('#gameNewName').focus();return;}
    const deck={id:crypto.randomUUID(),name,cards:[]};decks.push(deck);activeId=deck.id;selected=[];creating=false;editing=true;confirmDelete=false;save();calculate();render();$('#gameSearch').focus();
  });
  function renameDeck(value){
    const name=value.trim();if(!name)return;
    active().name=name;save();
    $('.game-board .panel-heading h2').innerHTML=`${esc(name)} <span>${active().cards.length} / 40</span>`;
    $('#gameDeck').selectedOptions[0].textContent=`${name} · ${active().cards.length} cards`;
    $('.game-save-note').textContent=storageError?'Not saved: '+storageError:'Saved in this browser';
  }
  root.addEventListener('input',e=>{if(e.target.id==='gameSearch')renderCatalog();if(e.target.id==='gameName')renameDeck(e.target.value);});
  root.addEventListener('change',e=>{
    if(e.target.id==='gameDeck'){activeId=e.target.value;selected=[];editing=false;confirmDelete=false;creating=false;save();calculate();render();}
    if(e.target.id==='gameType')renderCatalog();
    if(e.target.id==='gameName'){if(e.target.value.trim())renameDeck(e.target.value);else{e.target.value=active().name;toast('Give your deck a name.');}}
  });
  root.addEventListener('click',e=>{
    const add=e.target.closest('[data-game-add]'),remove=e.target.closest('[data-game-remove]'),slot=e.target.closest('[data-game-slot]'),paths=e.target.closest('[data-game-paths]');
    if(add){if(active().cards.length>=40){toast('This deck already has 40 cards.');return;}active().cards.push(+add.dataset.gameAdd);save();calculate();keepCatalogRender();const next=$(`[data-game-add="${add.dataset.gameAdd}"]`);if(next&&!next.disabled)next.focus({preventScroll:true});return;}
    if(remove){active().cards.splice(+remove.dataset.gameRemove,1);selected=[];save();calculate();keepCatalogRender();return;}
    if(slot){const i=+slot.dataset.gameSlot;if(editing){onDetail(active().cards[i]);return;}if(selected.includes(i))selected=selected.filter(n=>n!==i);else if(selected.length<5)selected.push(i);else{toast('Select up to five cards. Deselect one to change your hand.');return;}calculate();render();$(`[data-game-slot="${i}"]`).focus({preventScroll:true});return;}
    if(paths){const id=+paths.dataset.gamePaths;pathLimits[id]=(pathLimits[id]||3)+10;renderResults();return;}
    const action=e.target.closest('[data-game-action]')?.dataset.gameAction;
    if(!action)return;
    if(action==='new'){creating=true;render();$('#gameNewName').focus();}
    if(action==='cancel-new'){creating=false;render();}
    if(action==='edit'){if(editing)renameDeck($('#gameName').value);editing=!editing;selected=[];confirmDelete=false;calculate();render();if(editing)$('#gameSearch').focus();}
    if(action==='clear'){selected=[];calculate();render();}
    if(action==='more'){shown+=10;renderResults();}
    if(action==='delete'){confirmDelete=true;keepCatalogRender();}
    if(action==='cancel-delete'){confirmDelete=false;keepCatalogRender();}
    if(action==='confirm-delete'){decks=decks.filter(d=>d.id!==activeId);activeId=decks[0]?.id;selected=[];editing=false;confirmDelete=false;save();calculate();render();}
    if(action==='retry'){if(readFailed)load();else save();calculate();render();}
  });
  load();calculate();
  return {show(){render();}};
}
