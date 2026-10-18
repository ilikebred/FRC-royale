estimateAuto=function(auto,st){
  if(curYear()!==2026||!auto.path?.length)return originalEstimateAuto(auto,st);
  const route=autoRouteTiming(auto,st);
  const e=originalEstimateAuto({...auto,_routeEnd:route.end,_routeTime:route.time},st);
  return {...e,ok:route.valid&&route.time<24&&e.t<=SV().rules.auto,routeTime:route.time,route,
    summary:route.valid?e.summary+' · '+route.time.toFixed(1)+'s driving the drawn route':'Route blocked. Move points clear of structures and stay on your side of midfield.'};
};
const originalAutoLockRoutes=autoLock;
autoLock=function(a,st){if(a?.path?.length&&!estimateAuto(a,st).ok)return 'Drawn route and steps must fit within AUTO and clear field obstacles';return originalAutoLockRoutes(a,st)};
function mountPathEditor(host,d,ro){
  const box=document.createElement('section');box.className='card path-editor';
  box.innerHTML='<b>Autonomous route</b><p class="muted">Drag or click to plot. Routes avoid structures and reserve time for your steps. Right-click to undo.</p><canvas width="324" height="648" aria-label="Autonomous field with hubs, trenches, bumps, depots, towers and midfield"></canvas><div class="route-budget"><strong data-budget></strong><span data-count></span></div><div class="bar"><i data-budget-bar></i></div><p data-route-status role="status" aria-live="polite"></p><div class="row"><button type="button" data-undo>Undo point</button><button type="button" data-clear>Clear path</button></div>';
  host.querySelector('#an').parentElement.after(box);
  host.classList.add('auto-sheet');
  const controls=document.createElement('div');controls.className='auto-controls';
  while(box.nextSibling)controls.append(box.nextSibling);host.append(controls);
  const cv=box.querySelector('canvas'),ctx=cv.getContext('2d'),st=buildStats(myBuild());d.path=d.path||[];
  const paint=(message='')=>{
    const e=estimateAuto(d,st),route=curYear()===2026?plannedAutoRoute(d,st):null,S=12;
    drawPlanningField(ctx,S,st);
    const start=route?.start||{x:{L:4.5,C:13.5,R:22.5}[d.start],y:48},pts=[start,...(route?.path||d.path)];
    ctx.strokeStyle='#007f88';ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x*S,p.y*S):ctx.moveTo(p.x*S,p.y*S));ctx.stroke();
    [start,...d.path].forEach((p,i)=>{ctx.fillStyle=i?'#008b94':'#e9a91e';ctx.beginPath();ctx.arc(p.x*S,p.y*S,i?3:6,0,7);ctx.fill()});
    ctx.fillStyle='#122e4c';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('START',start.x*S,start.y*S-10);
    box.querySelector('[data-budget]').textContent=e.t.toFixed(1)+' / '+SV().rules.auto+'s estimated';
    box.querySelector('[data-count]').textContent=d.path.length+' points';
    const bar=box.querySelector('[data-budget-bar]');bar.style.width=Math.min(100,e.t/SV().rules.auto*100)+'%';bar.style.background=e.ok?'var(--ok)':'var(--red)';
    box.querySelector('[data-route-status]').textContent=message||(!e.ok?'Over budget or blocked. Remove points or steps before saving.':Math.max(0,SV().rules.auto-e.t).toFixed(1)+'s remaining · '+(st.low?'Your robot fits through trenches.':'Tall robot: routes use bumps.'));
    box.querySelector('[data-route-status]').classList.toggle('route-error',!!message||!e.ok);
    const save=host.querySelector('#save');if(save)save.disabled=!e.ok;
    const total=host.querySelector('[data-auto-total]');if(total){total.textContent=e.t.toFixed(1)+' / '+SV().rules.auto+'s';total.style.color=e.ok?'var(--ok)':'var(--red)'}
    const summary=host.querySelector('[data-auto-summary]');if(summary)summary.textContent=e.summary+'. '+(e.ok?'Fits in AUTO.':'Shorten the route or remove steps.');
    const progress=host.querySelector('[data-auto-progress]');if(progress){progress.style.width=clamp(e.t/SV().rules.auto*100,0,100)+'%';progress.style.background=e.ok?'var(--ok)':'var(--red)'}
    host.querySelectorAll('[data-est-row]').forEach((el,i)=>{if(e.rows[i])el.textContent=e.rows[i].note+' · done at '+e.rows[i].t.toFixed(1)+'s'});
  };
  let drawing=false;
  const add=e=>{
    const bounds=cv.getBoundingClientRect(),p={x:(e.clientX-bounds.left)*27/bounds.width,y:(e.clientY-bounds.top)*54/bounds.height};
    if(d.path.length&&dist(p,d.path.at(-1))<1)return;
    if(curYear()===2026&&blocked2026({A:'B',st},p.x,p.y,true)){paint('Point blocked: use open carpet on your side of midfield.');return}
    if(d.path.length>=80){paint('Point limit reached. Undo a point to redraw.');return}
    d.path.push(p);const estimate=estimateAuto(d,st);
    if(!estimate.ok){d.path.pop();paint('That point would exceed AUTO time or make the route unreachable. Shorten the route or remove a step.');return}
    paint();
  };
  cv.onpointerdown=e=>{if(ro||e.button!==0)return;e.preventDefault();drawing=true;cv.setPointerCapture(e.pointerId);add(e)};
  cv.onpointermove=e=>{if(drawing)add(e)};cv.onpointerup=cv.onpointercancel=()=>drawing=false;
  const undo=()=>{if(!ro){d.path.pop();paint()}};
  cv.oncontextmenu=e=>{e.preventDefault();undo()};box.querySelector('[data-undo]').onclick=undo;
  box.querySelector('[data-clear]').onclick=()=>{if(!ro){d.path=[];paint()}};box.querySelectorAll('button').forEach(b=>b.disabled=ro);paint();
};
function drawPlanningField(ctx,S,st){
  const light=document.documentElement.dataset.theme==='light';
  ctx.fillStyle=light?'#d9eaf3':'#172e45';ctx.fillRect(0,0,FW*S,FL*S);
  ctx.fillStyle=light?'#f2dce1':'#402b3e';ctx.fillRect(0,0,FW*S,13*S);
  ctx.fillStyle=light?'#bbdaf5':'#203f65';ctx.fillRect(0,41*S,FW*S,13*S);
  ctx.font='bold 10px sans-serif';ctx.textAlign='center';
  for(const A of ['B','T']){
    const Y=BAR[A],col=A==='B'?'#318aff':'#ef535d';
    for(const [a,b]of TRENCH){ctx.fillStyle=st.low?'#40637a':'#503d45';ctx.fillRect(a*S,(Y-.9)*S,(b-a)*S,1.8*S);ctx.fillStyle='#fff';ctx.fillText(st.low?'PASS':'LOW',((a+b)/2)*S,(Y+.3)*S)}
    for(const [a,b]of BUMPS){ctx.fillStyle='#829fb3';ctx.fillRect(a*S,(Y-1.3)*S,(b-a)*S,2.6*S);ctx.strokeStyle='#c3d9e5';for(let x=a;x<b-.7;x+=.8){ctx.beginPath();ctx.moveTo(x*S,(Y-1.3)*S);ctx.lineTo((x+.7)*S,(Y+1.3)*S);ctx.stroke()}}
    ctx.fillStyle=col;ctx.fillRect(HUBX[0]*S,(Y-2.1)*S,4.6*S,4.2*S);ctx.fillStyle='#fff';ctx.fillText('HUB',13.5*S,(Y+.3)*S);
    const tw=M(A,TOWER_C,52.8);ctx.fillStyle='#607f94';ctx.fillRect((tw.x-2.6)*S,(tw.y-1.2)*S,5.2*S,2.4*S);
    ctx.fillStyle='#fff';ctx.fillText('TOWER',tw.x*S,(tw.y+.3)*S);
    const d=M(A,7.5,52.8);ctx.strokeStyle=col;ctx.setLineDash([4,3]);ctx.strokeRect((d.x-2.5)*S,(d.y-.7)*S,5*S,1.4*S);ctx.setLineDash([]);
    const out=M(A,25.6,52);ctx.fillStyle=col;ctx.fillRect((out.x-.8)*S,(out.y-1)*S,1.6*S,2*S);
  }
  ctx.fillStyle=light?'#355975':'#c8deef';ctx.fillText('NEUTRAL ZONE',13.5*S,34*S);ctx.fillText('DEPOT',7.5*S,51.4*S);
  ctx.strokeStyle=light?'#6b879d':'#a8c3d9';ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(0,27*S);ctx.lineTo(FW*S,27*S);ctx.stroke();ctx.setLineDash([]);
  ctx.fillText('MIDFIELD · AUTO LIMIT',13.5*S,26*S);
  ctx.fillStyle=light?'#ffffff55':'#00000044';ctx.fillRect(0,0,FW*S,(27+ROB_R*.4)*S);
}
