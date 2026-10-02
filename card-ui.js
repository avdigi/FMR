// Shared image-first picker tiles. Clicking any part adds one physical copy.
export function pickerCard(c,{art,esc,target,disabled=false,count=0}){
  const action=target==='deck'?'data-game-add':'data-add';
  return `<button class="deck-card picker-card" ${action}="${c.id}" aria-label="Add ${esc(c.name)} to ${target}" title="${esc(c.name)} · #${String(c.id).padStart(3,'0')} · ${esc(c.type)} · ${c.atk??'—'} ATK" ${disabled?'disabled':''}>${art(c)}<span class="deck-card-name">${esc(c.name)}</span><span class="deck-card-atk">${c.atk??'—'} ATK</span>${count?`<span class="picker-copy-count" aria-label="${count} in deck">×${count}</span>`:''}</button>`;
}

// Track the untransformed button so tilting the artwork never moves its hit area.
export function attachHandTilt(root){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  let current=null,frame=0,point=null;
  function reset(){
    cancelAnimationFrame(frame);frame=0;point=null;
    if(current){current.classList.remove('is-tilting');for(const name of ['--tilt-x','--tilt-y','--glare-x','--glare-y'])current.style.removeProperty(name);current=null;}
  }
  root.addEventListener('pointermove',e=>{
    const button=e.target.closest('[data-hand-card]');
    if(e.pointerType!=='mouse'||reduced.matches||!fine.matches||!button){reset();return;}
    if(current!==button){reset();current=button;}
    point={x:e.clientX,y:e.clientY};
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;if(!current?.isConnected||!point){reset();return;}
      const bounds=current.getBoundingClientRect(),x=Math.max(0,Math.min(1,(point.x-bounds.left)/bounds.width)),y=Math.max(0,Math.min(1,(point.y-bounds.top)/bounds.height));
      current.style.setProperty('--tilt-x',`${(0.5-y)*18}deg`);
      current.style.setProperty('--tilt-y',`${(x-0.5)*24}deg`);
      current.style.setProperty('--glare-x',`${x*100}%`);
      current.style.setProperty('--glare-y',`${y*100}%`);
      current.classList.add('is-tilting');
    });
  });
  root.addEventListener('pointerout',e=>{if(current&&!current.contains(e.relatedTarget))reset();});
  root.addEventListener('pointercancel',reset);
  root.addEventListener('click',reset);
  window.addEventListener('blur',reset);
  reduced.addEventListener('change',reset);fine.addEventListener('change',reset);
}
