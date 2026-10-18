/* Targeted boosts remain part of the deterministic replay input stream. */
const applyBeforeTargetBoost=SimRun.prototype.apply;
SimRun.prototype.apply=function(type,args){
  if(type!=='b')return applyBeforeTargetBoost.call(this,type,args);
  const target=args[1]==null?this.me:this.m.robots[args[1]];
  if(!target||target.A!==this.me.A)return {msg:'Drop boosts on your alliance robots'};
  if(!SEASONS[this.year].boosts.some(b=>b.k===args[0]))return {msg:'Unknown boost'};
  if(this.m.over||this.m.t>=this.m.end)return {msg:'The match has ended'};
  return this.wrap(()=>this.m.boost(args[0],target));
};
function boostDropTarget(robots,own,point,project,radius){
  let nearest=null,best=radius;
  for(const robot of robots){const p=project(robot.x,robot.y),d=Math.hypot(p.x-point.x,p.y-point.y);if(d<best){best=d;nearest=robot}}
  return nearest?.A===own.A?nearest:null;
}
function wireBoostDrag({root=app,canvas,own,robots,project,activate}){
  let drag=null,suppressUntil=0;
  const ghost=document.createElement('div');ghost.className='boost-drag-label';ghost.hidden=true;root.append(ghost);
  const status=document.createElement('div');status.className='sr-only';status.setAttribute('role','status');root.append(status);
  const targetAt=e=>{const rc=canvas.getBoundingClientRect();if(e.clientX<rc.left||e.clientX>rc.right||e.clientY<rc.top||e.clientY>rc.bottom)return null;const a=project(0,0),b=project(ROB_R*2,0);return boostDropTarget(robots,own,{x:e.clientX-rc.left,y:e.clientY-rc.top},project,Math.max(22,Math.hypot(b.x-a.x,b.y-a.y)))};
  const clear=()=>{drag=null;ghost.hidden=true;root.classList.remove('boost-dragging')};
  root.querySelectorAll('[data-b]').forEach(button=>{
    button.classList.add('boost-card');const cue=document.createElement('span');cue.className='boost-drag-cue';cue.textContent='⠿ Drag to ally';cue.setAttribute('aria-hidden','true');button.append(cue);button.setAttribute('aria-description','Click to boost your robot, or drag this card onto an allied robot.');
    button.style.touchAction='none';button.title='Click for your robot, or drag onto an ally';
    button.onclick=e=>{if(e.detail!==0&&performance.now()<suppressUntil)return;activate(button.dataset.b,own)};
    button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled)return;drag={button,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,target:null};button.setPointerCapture(e.pointerId)});
    button.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)drag.moved=true;if(!drag.moved)return;
      drag.target=targetAt(e);ghost.hidden=false;ghost.style.left=e.clientX+'px';ghost.style.top=(e.clientY-42)+'px';ghost.textContent=button.querySelector('.bn').textContent+' → '+(drag.target?drag.target.tm.num:'Drop on an ally');root.classList.add('boost-dragging');
    });
    button.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved,target=targetAt(e);clear();if(moved){suppressUntil=performance.now()+700;if(target){activate(button.dataset.b,target);status.textContent='Boost targeted at team '+target.tm.num}else status.textContent='Boost cancelled. Drop on an allied robot.'}});
    button.addEventListener('pointercancel',()=>{suppressUntil=performance.now()+700;clear()});button.addEventListener('lostpointercapture',clear);
    button.addEventListener('keydown',e=>{if(e.key==='Escape'){clear();suppressUntil=performance.now()+700}});
  });
  requestAnimationFrame(()=>{if(canvas.isConnected)window.onresize?.()});
  return {draw(ctx,scale){if(!drag?.moved)return;ctx.save();for(const r of robots.filter(r=>r.A===own.A)){ctx.strokeStyle=drag.target===r?'#ffd15a':'#6debdc';ctx.lineWidth=drag.target===r?4:2;const p=project(r.x,r.y);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(18,ROB_R*scale*1.6),0,Math.PI*2);ctx.stroke()}ctx.restore()}};
}
