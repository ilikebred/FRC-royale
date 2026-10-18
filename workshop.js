/* Local test economy: keep real credit balances finite and untouched. */
let TEST_CREDITS=(()=>{try{return localStorage.getItem('frc-royale-test-credits')!=='off'}catch{return true}})();
function creditLabel(){return TEST_CREDITS?'∞':String(SAVE.credits)}
function canSpendCredits(cost){return TEST_CREDITS||SAVE.credits>=cost}
function spendCredits(cost){if(!canSpendCredits(cost))return false;if(TEST_CREDITS)SAVE.testBuild=true;else SAVE.credits-=cost;return true}
function toggleTestCredits(){TEST_CREDITS=!TEST_CREDITS;try{localStorage.setItem('frc-royale-test-credits',TEST_CREDITS?'on':'off')}catch{}screenPit()}

let PIT_SECTION=null;
function polishPit(st,model){
  const preview=document.querySelector('.preview'),pad=preview?.nextElementSibling;if(!pad)return;
  app.classList.add('pit-screen');
  const burst=document.createElement('div');burst.className='pit-burst-layer';burst.setAttribute('aria-hidden','true');app.prepend(burst);
  const top=document.querySelector('.topbar'),menu=top.querySelector('#menu');
  const coins=top.querySelector('.coins');coins.classList.add('pit-wallet');top.append(coins,menu);menu.setAttribute('aria-label','Options');
  const workspace=document.createElement('main');workspace.className='pit-lobby';
  const groups=[];
  for(const h of [...pad.querySelectorAll('h3.sect')]){
    const panel=document.createElement('section');
    let node=h.nextElementSibling;while(node&&!node.matches('h3.sect')&&node.id!=='play'&&node.id!=='practice'&&node.tagName!=='P'){const next=node.nextElementSibling;panel.append(node);node=next}h.remove();groups.push(panel);
  }
  const league=pad.querySelector('.league');league.classList.add('pit-rank');
  const shortcuts=document.createElement('nav');shortcuts.className='pit-shortcuts';shortcuts.setAttribute('aria-label','Robot workshop');
  const icon=paths=>'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  shortcuts.innerHTML='<button id="open-hardware">'+icon('<path fill="#ffc83e" stroke="#102e59" d="M5 17h38v25H5z"/><path fill="#ffe795" stroke="#102e59" d="M4 15h40v13H4z"/><path stroke="#d8f4ff" d="M17 15V7h14v8"/><path fill="#52ceef" stroke="#102e59" d="M20 25h8v9h-8z"/>')+'<span>Workbench</span></button><button id="open-autonomous">'+icon('<circle fill="#ffd154" stroke="#102e59" cx="10" cy="36" r="5"/><circle fill="#62efcf" stroke="#102e59" cx="38" cy="12" r="5"/><path d="M10 32V18a6 6 0 0 1 12 0v12a6 6 0 0 0 12 0V12m0 0-5 5m5-5 5 5"/>')+'<span>Autonomous<br>pathing</span></button>';
  const rp=document.createElement('span');rp.className='pit-rp-count';rp.setAttribute('aria-label',SAVE.trophies+' rank points');rp.innerHTML=icon('<path fill="#ffd34f" stroke="#704313" d="M14 6h20v17c0 15-20 15-20 0z"/><path stroke="#704313" d="M14 10H6v9q0 10 10 10M34 10h8v9q0 10-10 10M24 34v7M16 42h16"/>')+'<strong>'+SAVE.trophies+'</strong><small>RP</small>';top.querySelector('#team').after(rp);
  coins.querySelector('.coin').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff1a1" stroke="#a06514" stroke-width="1.5" d="m4 7 5 4 3-6 3 6 5-4-2 12H6z"/></svg>';
  const stage=document.createElement('section');stage.className='pit-spotlight';
  const cart=document.createElement('img');cart.className='pit-cart-foreground';cart.src='icons/pit-cart-foreground.png';cart.alt='';cart.draggable=false;stage.append(cart);
  preview.querySelector('.ov').remove();
  stage.append(preview);const hint=document.createElement('p');hint.className='pit-rotate-hint';hint.textContent='Drag sideways to rotate · up/down to tilt';const reset=document.createElement('button');reset.id='pit-reset-view';reset.textContent='Reset view';reset.className='btn-ghost';stage.append(hint,reset);
  const stats=groups[2];stats.className='pit-stats';stats.insertAdjacentHTML('afterbegin','<h2>Stats</h2>');
  stats.insertAdjacentHTML('beforeend','<div class="pit-build-name"><strong>'+esc(P('drive',SAVE.equip.drive).name)+'</strong><span>'+Math.round(model.height)+' in tall · '+st.weight+' lb</span></div>');
  const utility=document.createElement('nav');utility.className='pit-links';for(const id of ['lbp','guide','past']){const el=pad.querySelector('#'+id);if(el)(id==='lbp'?shortcuts:utility).append(el)}
  const actions=document.createElement('div');actions.className='pit-match-actions';actions.append(pad.querySelector('#play'),pad.querySelector('#practice'));if(!actions.firstChild.disabled)actions.firstChild.textContent='Play';
  const multiplayer=document.createElement('button');multiplayer.id='play-friend';multiplayer.textContent='Play with a friend';multiplayer.onclick=screenOnline;actions.append(multiplayer);
  const options=document.createElement('section');options.className='pit-options-content';
  options.innerHTML='<button id="pit-main-menu">Main menu</button><div class="pit-setting"><span>Appearance</span></div><div class="pit-setting pit-sound"><span>Audio settings</span></div><button class="test-switch" id="test-credits" role="switch" aria-checked="'+TEST_CREDITS+'">Test credits <b>'+(TEST_CREDITS?'ON':'OFF')+'</b></button>';
  const fps=document.createElement('label');fps.className='pit-setting';fps.innerHTML='<span>Show FPS in matches</span><input type="checkbox" aria-label="Show FPS in matches">';fps.querySelector('input').checked=PerformanceUI.enabled;fps.querySelector('input').onchange=e=>PerformanceUI.set(e.target.checked);options.append(fps);
  const theme=document.getElementById('theme-toggle');if(theme)options.querySelector('.pit-setting').append(theme);
  const sound=top.querySelector('.snd');if(sound)options.querySelector('.pit-sound').append(sound);
  options.querySelector('#pit-main-menu').onclick=()=>{PIT_SECTION=null;screenMenu()};options.querySelector('#test-credits').onclick=toggleTestCredits;
  const drawer=document.createElement('section');drawer.className='pit-drawer';drawer.hidden=true;
  drawer.innerHTML='<header><button id="close-workshop" aria-label="Back to pit">'+(ICONS.back||ICONS.x)+' Back</button><h1></h1></header>';
  const panels=[groups[0],groups[1],options];panels.forEach(p=>{p.classList.add('pit-drawer-content');p.hidden=true;drawer.append(p)});
  const titles=['Workbench','Autonomous pathing','Options'];
  const select=i=>{PIT_SECTION=i;app.classList.toggle('pit-detail',i!==null);drawer.hidden=i===null;workspace.hidden=i!==null;panels.forEach((p,j)=>p.hidden=j!==i);if(i!==null){drawer.querySelector('h1').textContent=titles[i];drawer.querySelector('#close-workshop').focus()}else{workspace.querySelector('#open-hardware').focus()}BACK=i===null?screenMenu:()=>select(null);window.onresize?.()};
  drawer.querySelector('#close-workshop').onclick=()=>select(null);
  shortcuts.querySelector('#open-hardware').onclick=()=>select(0);shortcuts.querySelector('#open-autonomous').onclick=()=>select(1);
  window.openPitOptions=()=>select(2);
  const trophy=shortcuts.querySelector('#lbp');if(trophy)trophy.innerHTML=icon('<path fill="#ffd34f" stroke="#102e59" d="M14 6h20v17c0 15-20 15-20 0z"/><path stroke="#ffe798" d="M14 10H6v9q0 10 10 10M34 10h8v9q0 10-10 10M24 34v7M16 42h16"/>')+'<span>Leaderboards</span>';
  pad.before(workspace);workspace.append(league,shortcuts,stage,stats,utility,actions);workspace.after(drawer);pad.remove();
  if(PIT_SECTION!==null)select(PIT_SECTION);
}
function paintPartPreviews(el,slot){
  if(curYear()!==2026||!['hopper','shooter','intake','drive'].includes(slot))return;
  el.querySelectorAll('[data-preview-part]').forEach(cv=>{const b=myBuild();b[slot]={id:cv.dataset.previewPart,lv:1};cv.width=520;cv.height=260;draw3D(cv.getContext('2d'),520,260,b,SAVE.color,-.7,SAVE.team.num)});
}
// Fresh screens must not inherit the wide pit layout.
const beforeWorkshopShow=show;
show=function(html){if(typeof PerformanceUI!=='undefined')PerformanceUI.stop();app.classList.remove('pit-screen','pit-detail');beforeWorkshopShow(html)};
const PIT_MAX_ROLL=Math.PI/18;
function pitRoll(value){return clamp(value,-PIT_MAX_ROLL,PIT_MAX_ROLL)}
