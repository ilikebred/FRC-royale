/* Version 2 autos: an ordered route with commands at its waypoints. */
const AUTO_ENTRIES={
  trenchLeft:{name:'Trench left',x:2,y:44.6,slot:'L',low:true},
  bumpLeft:{name:'Bump left',x:7.6,y:44.6,slot:'L'},
  bumpRight:{name:'Bump right',x:19.4,y:44.6,slot:'R'},
  trenchRight:{name:'Trench right',x:25,y:44.6,slot:'R',low:true}
};
const WAYPOINT_ACTIONS={move:'Move / intake',shoot:'Shoot',feed:'Feed',wait:'Wait',climb:'Climb'};
function waypointIssue(p,st){
  if(blocked2026({A:'B',st},p.x,p.y,true))return 'Choose clear carpet on your side of midfield.';
  if(!Object.hasOwn(WAYPOINT_ACTIONS,p.action||'move'))return 'Choose a valid point command.';
  if(['shoot','feed','wait'].includes(p.action)&&(!Number.isFinite(p.seconds)||p.seconds<.25||p.seconds>20))return 'Set an action duration from 0.25 to 20 seconds.';
  if(p.action==='shoot'){
    const range={close:4.9,hood:9.5,spot:13,zone:24}[st.mode]||24;
    if(p.y<=41.9||dist(p,{x:13.5,y:41})>=range)return 'Shoot point must be in your alliance zone and within your shooter range.';
  }
  if(p.action==='feed'&&(p.y<=BAR.T+.5||p.y>=BAR.B-.5))return 'Place Feed in the neutral zone.';
  if(p.action==='climb'){
    if(!st.climb)return 'Equip a climber before adding Climb.';
    if(!TOWER_SPOTS.some(([x,y])=>dist(p,{x,y})<.6))return 'Place Climb at one of the three tower approach spots.';
  }
  return null;
}
function compileWaypointAuto(auto,st,A='B'){
  const entry=AUTO_ENTRIES[auto.entry];if(!entry)return {error:'Choose a starting lane.',groups:[]};
  if(entry.low&&!st.low)return {error:'This robot is too tall for a trench start. Choose a bump.',groups:[]};
  const start=M(A,entry.x,entry.y),groups=[];let cursor=start,raw=[start],indices=[];
  for(let i=0;i<(auto.path||[]).length;i++){
    const point=auto.path[i],error=waypointIssue(point,st);if(error)return {error:'Point '+(i+1)+': '+error,groups,start};
    if(point.action==='climb'&&i!==auto.path.length-1)return {error:'Climb must be the final point.',groups,start};
    const destination=M(A,point.x,point.y),leg=navigation2026(cursor,destination,st,A,true,true);
    if(!leg.length)return {error:'Point '+(i+1)+' cannot be reached.',groups,start};
    raw.push(...leg);indices.push(i);cursor=destination;
    if((point.action&&point.action!=='move')||i===auto.path.length-1){
      const path=smoothRoute(raw,p=>blocked2026({A,st},p.x,p.y,true)).slice(1);
      groups.push({path,indices,end:destination,action:point.action||'move',seconds:point.seconds||0});raw=[cursor];indices=[];
    }
  }
  return {start,groups,error:null};
}
function beginWaypointGroup(r){
  const program=r.waypointState,group=program.groups[program.index];
  r.autoFeed=false;r.goal=null;r.path=[];r.pathFrom={x:r.x,y:r.y};
  r.routePoints=program.groups.slice(program.index).map(g=>({...g.end}));
  if(!group){program.done=true;program.phase='done';r.programAction='wait';return}
  r.path=group.path.map(p=>({...p}));r.goal={type:'waypoint',...group.end};program.phase='travel';program.elapsed=0;r.programAction='move';
}
function stepWaypointAuto(m,r,dt,predict=false){
  const state=r.waypointState;if(!state||state.done){r.path=[];drive2026(m,r,dt);return}
  const group=state.groups[state.index];
  state.clock+=dt;
  drive2026(m,r,dt);
  if(state.phase==='travel'&&!r.path.length&&r.driveSpeed<.15){
    state.phase='action';state.elapsed=0;r.programAction=group.action;r.autoFeed=group.action==='feed';
    if(group.action==='climb'){
      const spots=TOWER_SPOTS.map(p=>M(r.A,...p));r.towerSpot=spots.sort((a,b)=>dist(a,r)-dist(b,r))[0];
      if(!predict){r.goal={type:'climb',auto:true,...r.towerSpot};r.mode='climb'}
    }
  }
  if(state.phase==='action'){
    // Wait for a settled, aimed chassis before counting a fixed shooter's firing window.
    const h=m.hub(r.A),aligned=Math.abs(angleDelta(Math.atan2(h.y-r.y,h.x-r.x),r.a))<.4;
    if(group.action==='shoot'&&r.st.mode!=='zone'&&r.held>0&&!aligned)return;
    if(group.action==='feed'&&r.st.mode!=='zone'&&r.held>0){const target=feedAim2026(r);if(Math.abs(angleDelta(Math.atan2(target.y-r.y,target.x-r.x),r.a))>.18)return;}
    if(r.driveSpeed>.15)return;
    state.elapsed+=dt;
    const duration=group.action==='move'?0:group.action==='climb'?r.st.climbTime*.6:group.seconds;
    if(state.elapsed>=duration){state.finished.push({indices:group.indices,t:state.clock});state.index++;beginWaypointGroup(r)}
  }
}
function estimateWaypointAuto(auto,st){
  const compiled=compileWaypointAuto(auto,st),rows=(auto.path||[]).map(p=>({s:p.action||'move',t:0,note:WAYPOINT_ACTIONS[p.action||'move']}));
  if(compiled.error)return {t:0,ok:false,rows,fuel:0,summary:compiled.error,error:compiled.error};
  const r={...compiled.start,A:'B',a:-Math.PI/2,st,held:Math.min(8,st.cap),path:[],waypointState:{groups:compiled.groups,index:0,clock:0,finished:[]}};
  beginWaypointGroup(r);
  const world={t:0,R:{auto:20},blocked:(r,x,y)=>blocked2026(r,x,y,true),hub:()=>({x:13.5,y:41}),planPath:()=>{}};
  let t=0;while(!r.waypointState.done&&t<40){stepWaypointAuto(world,r,1/30,true);t+=1/30}
  for(const finished of r.waypointState.finished)for(const i of finished.indices)rows[i].t=finished.t;
  const ok=t<=20&&r.waypointState.done;
  return {t,ok,rows,fuel:0,summary:ok?'Travel, bump crossings, settling and commands fit within AUTO.':'Over 20 seconds. Shorten the route or reduce action durations.',compiled};
}
const estimateBeforeWaypoints=estimateAuto;
estimateAuto=function(auto,st){return curYear()===2026&&auto.version===2?estimateWaypointAuto(auto,st):estimateBeforeWaypoints(auto,st)};
const lockBeforeWaypoints=autoLock;
autoLock=function(a,st){if(a?.version===2){const estimate=estimateWaypointAuto(a,st);return !a.path?.length?'Add a waypoint':estimate.ok?null:estimate.summary}return lockBeforeWaypoints(a,st)};
const robotBeforeWaypoints=Match.prototype.mkRobot,thinkBeforeWaypoints=Match.prototype.think,moveBeforeWaypoints=Match.prototype.move,shootBeforeWaypoints=Match.prototype.shoot;
Match.prototype.mkRobot=function(tm,k){
  const r=robotBeforeWaypoints.call(this,tm,k);
  if(tm.waypointAuto?.version===2){const compiled=compileWaypointAuto(tm.waypointAuto,r.st,r.A);
    if(!compiled.error){Object.assign(r,compiled.start);r.lastX=r.x;r.lastY=r.y;r.routeInitialized=true;r.routePoints=[];r.waypointState={groups:compiled.groups,index:0,clock:0,finished:[]};r.think=0;beginWaypointGroup(r)}
  }
  return r;
};
Match.prototype.think=function(r){
  if(r.waypointState&&this.t<this.R.auto){r.mode=r.programAction==='feed'?'feed':r.programAction==='climb'?'climb':'manual';return}
  if(r.waypointState&&!r.waypointReleased){r.waypointReleased=true;r.path=[];r.goal=null;r.autoFeed=false;r.autoPlan=null;r.think=0}
  return thinkBeforeWaypoints.call(this,r);
};
Match.prototype.move=function(r,dt){if(r.waypointState&&this.t<this.R.auto)return stepWaypointAuto(this,r,dt);return moveBeforeWaypoints.call(this,r,dt)};
Match.prototype.shoot=function(r,dt){if(r.waypointState&&this.t<this.R.auto&&!['shoot','feed'].includes(r.programAction)){r.shotAcc=0;r.spun=0;return}return shootBeforeWaypoints.call(this,r,dt)};

const sheetBeforeWaypoints=autoSheet;
autoSheet=function(auto,isNew){
  if(curYear()!==2026||auto.preset)return sheetBeforeWaypoints(auto,isNew);
  const st=buildStats(myBuild()),entry=AUTO_ENTRIES[auto.entry]?auto.entry:(auto.start==='R'?'bumpRight':'bumpLeft');
  const d={id:auto.id,name:auto.name,version:2,entry,start:AUTO_ENTRIES[entry].slot,steps:[],path:(auto.path||[]).map(p=>({...p,action:p.action||'move',seconds:p.seconds??2}))};
  const legacy=auto.version!==2&&((auto.steps||[]).length||d.path.length);
  if(legacy)for(const action of auto.steps||[]){
    const point={score:{x:13.5,y:44,action:'shoot',seconds:3},neutral:{x:8,y:30,action:'move'},depot:{x:7.5,y:51.4,action:'move'},outpost:{x:24.4,y:50.9,action:'wait',seconds:3},feed:{x:8,y:33,action:'feed',seconds:3},climb:{x:18.7,y:50.3,action:'climb'}}[action];
    if(point)d.path.push({...point});if(action==='cycle')d.path.push({x:8,y:30,action:'move'},{x:13.5,y:44,action:'shoot',seconds:3});
  }
  const el=sheet('',screenPit),host=el.firstChild;host.classList.add('auto-sheet','waypoint-sheet');
  host.innerHTML=`<div class="row"><h2 class="grow">${isNew?'New':'Edit'} autonomous</h2><button id="x" aria-label="Close" style="width:44px;padding:10px">${ICONS.x}</button></div><div><label for="an">Name</label><input id="an" type="text" maxlength="24" value="${esc(d.name)}"></div>
    <section class="card path-editor"><b>Plot your route</b><p class="muted">Click or drag to add points. The robot intakes along the path. Right-click to undo.</p><canvas width="324" height="648" aria-label="Autonomous waypoint field"></canvas><div class="row"><button data-undo>Undo point</button><button data-clear>Clear path</button></div><p class="muted">Numbers match the commands on the right. Tower circles mark climb positions.</p></section>
    <div class="auto-controls"><label for="auto-entry">Starting lane</label><select id="auto-entry">${Object.entries(AUTO_ENTRIES).map(([key,e])=>`<option value="${key}" ${key===d.entry?'selected':''} ${e.low&&!st.low?'disabled':''}>${e.name}${e.low&&!st.low?' · too tall':''}</option>`).join('')}</select><p class="muted" style="font-size:12px">Left and right are viewed from your alliance wall. Bump crossings slow both ascent and descent.</p>${legacy?'<p class="route-error">Legacy routine converted into point commands. Review the route and durations before saving.</p>':''}<div class="route-budget"><strong id="waypoint-budget"></strong><span id="waypoint-count"></span></div><div class="bar"><i id="waypoint-progress"></i></div><p id="waypoint-status" role="status" aria-live="polite"></p><h3>Path commands</h3><p class="muted" style="font-size:12px">Move points flow together. Other commands stop at their point. Shoot and Feed run for the duration you set.</p><div id="waypoint-steps"></div><div class="row" style="margin-top:16px">${isNew?'':'<button id="del">Delete</button>'}<button class="btn-primary grow" id="save">Save auto</button></div></div>`;
  const cv=host.querySelector('canvas'),ctx=cv.getContext('2d'),list=host.querySelector('#waypoint-steps');let selected=-1;
  const paint=(message='')=>{
    const e=estimateWaypointAuto(d,st),compiled=compileWaypointAuto(d,st),entry=AUTO_ENTRIES[d.entry];
    drawPlanningField(ctx,12,st);
    for(const [x,y] of TOWER_SPOTS){ctx.strokeStyle='#a47613';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x*12,y*12,5,0,7);ctx.stroke()}
    for(const [key,s] of Object.entries(AUTO_ENTRIES)){ctx.fillStyle=key===d.entry?'#e9a91e':'#56748c';ctx.beginPath();ctx.arc(s.x*12,s.y*12,key===d.entry?6:3,0,7);ctx.fill()}
    const points=[{x:entry.x,y:entry.y},...compiled.groups.flatMap(g=>g.path)];ctx.strokeStyle='#00868e';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x*12,p.y*12):ctx.moveTo(p.x*12,p.y*12));ctx.stroke();
    d.path.forEach((p,i)=>{ctx.fillStyle=i===selected?'#bd7b05':'#123f60';ctx.beginPath();ctx.arc(p.x*12,p.y*12,7,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i+1,p.x*12,p.y*12)});
    host.querySelector('#waypoint-budget').textContent=e.t.toFixed(1)+' / 20s estimated';host.querySelector('#waypoint-count').textContent=d.path.length+' points';
    const progress=host.querySelector('#waypoint-progress');progress.style.width=Math.min(100,e.t/20*100)+'%';progress.style.background=e.ok?'var(--ok)':'var(--red)';
    const status=host.querySelector('#waypoint-status');status.textContent=message||e.summary;status.classList.toggle('route-error',!!message||!e.ok);
    host.querySelector('#save').disabled=!e.ok||!d.path.length;
    list.innerHTML=d.path.map((p,i)=>`<div class="waypoint-step ${selected===i?'selected':''}" data-step="${i}"><div class="row"><b class="grow">Point ${i+1}</b><span class="muted">${e.rows[i]?.t?'by '+e.rows[i].t.toFixed(1)+'s':''}</span><button data-up="${i}" aria-label="Move point ${i+1} up" ${i===0?'disabled':''}>${ICONS.up}</button><button data-rm="${i}" aria-label="Remove point ${i+1}">${ICONS.x}</button></div><label for="command-${i}" class="sr-only">Point ${i+1} command</label><select id="command-${i}" data-command="${i}">${Object.entries(WAYPOINT_ACTIONS).map(([key,name])=>`<option value="${key}" ${p.action===key?'selected':''}>${name}</option>`).join('')}</select>${['shoot','feed','wait'].includes(p.action)?`<label class="row" style="margin-top:8px"><span class="grow">Duration (seconds)</span><input data-seconds="${i}" aria-label="Point ${i+1} duration in seconds" type="number" min="0.25" max="20" step="0.25" value="${p.seconds??2}" style="width:85px"></label>`:''}<small class="muted">${p.x.toFixed(1)}, ${p.y.toFixed(1)} ft${p.action==='climb'?' · final action':''}</small></div>`).join('')||'<p class="muted">Place a point on the field to add your first command.</p>';
    list.querySelectorAll('[data-command]').forEach(input=>input.onchange=()=>{const p=d.path[+input.dataset.command];p.action=input.value;p.seconds=p.seconds||2;paint()});
    list.querySelectorAll('[data-seconds]').forEach(input=>input.onchange=()=>{d.path[+input.dataset.seconds].seconds=+input.value;paint()});
    list.querySelectorAll('[data-rm]').forEach(button=>button.onclick=()=>{d.path.splice(+button.dataset.rm,1);paint()});
    list.querySelectorAll('[data-up]').forEach(button=>button.onclick=()=>{const i=+button.dataset.up;[d.path[i-1],d.path[i]]=[d.path[i],d.path[i-1]];paint()});
  };
  let drawing=false;
  const add=e=>{const b=cv.getBoundingClientRect(),p={x:(e.clientX-b.left)*27/b.width,y:(e.clientY-b.top)*54/b.height,action:'move',seconds:2};
    if(blocked2026({A:'B',st},p.x,p.y,true)){paint('Point blocked. Use clear carpet on your side of midfield.');return}
    if(d.path.length&&dist(p,d.path.at(-1))<1)return;
    if(d.path.length>=60){paint('Maximum 60 points. Remove a point before adding another.');return}
    d.path.push(p);const estimate=estimateWaypointAuto(d,st);if(!estimate.ok){d.path.pop();paint(estimate.summary);return}selected=d.path.length-1;paint();
  };
  cv.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drawing=true;cv.setPointerCapture(e.pointerId);add(e)};
  cv.onpointermove=e=>{if(drawing&&(e.buttons&1))add(e)};cv.onpointerup=cv.onpointercancel=()=>drawing=false;
  const undo=()=>{d.path.pop();selected=-1;paint()};cv.oncontextmenu=e=>{e.preventDefault();undo()};host.querySelector('[data-undo]').onclick=undo;
  host.querySelector('[data-clear]').onclick=()=>{d.path=[];paint()};host.querySelector('#auto-entry').onchange=e=>{d.entry=e.target.value;d.start=AUTO_ENTRIES[d.entry].slot;paint()};
  host.querySelector('#an').oninput=e=>d.name=e.target.value;host.querySelector('#x').onclick=()=>{el.remove();screenPit()};
  host.querySelector('#save').onclick=()=>{if(!d.name.trim())return toast('Name your auto');if(!d.path.length||!estimateWaypointAuto(d,st).ok)return toast('Fix the path commands and timing before saving');SAVE.autos=SAVE.autos||[];const i=SAVE.autos.findIndex(a=>a.id===d.id);if(i>=0)SAVE.autos[i]=d;else SAVE.autos.push(d);SAVE.autoSel=d.id;persist();el.remove();screenPit()};
  const del=host.querySelector('#del');if(del)del.onclick=()=>{el.remove();confirmDeleteAuto(auto)};paint();
};
