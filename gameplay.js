/* Versioned, deterministic wear. Old replays retain their original simulation. */
const MATERIALS=[
  {id:'alloy',name:'Standard alloy',cost:0,resistance:1,desc:'Balanced starter frame.'},
  {id:'reinforced',name:'Reinforced alloy',cost:650,resistance:1.6,desc:'38% less impact damage and wear.'},
  {id:'titanium',name:'Titanium composite',cost:1600,resistance:2.5,desc:'60% less impact damage and wear.'}
];
const materialOf=id=>MATERIALS.find(m=>m.id===id)||MATERIALS[0];
const robotCondition=p=>Number.isFinite(p?.condition)?clamp(p.condition,0,100):100;
function performanceCoins(m,r,result){
  const performance=Math.max(0,Math.min(320,Math.round(m.rewardPts(r)||0)));
  const outcome=result==='win'?90:result==='tie'?60:40;
  const objectives=Math.max(0,m.rpInfo(r.A).n)*15;
  const care=Math.round(robotCondition(r.durability)/5);
  const fouls=Math.min(performance,Math.max(0,r.fouls||0)*8);
  return {performance,outcome,objectives,care,fouls,total:outcome+performance+objectives+care-fouls};
}
function initDurability(run){
  for(const r of run.m.robots){
    r.durability={condition:robotCondition(r.tm),heat:0,impactAt:-10,material:materialOf(r.tm.material).id};
    r.durabilityBase={...r.st};
  }
}
function damageRobot(m,r,amount){
  const d=r.durability;if(!d||d.condition<=0)return;
  d.condition=Math.max(0,d.condition-amount/materialOf(d.material).resistance);
  if(d.condition===0){r.path=[];r.motionVX=0;r.motionVY=0;m.fxText?.(r.x,r.y,'BROKEN','#ff7c77')}
}
function impactRobot(m,r,speed){
  const d=r.durability;if(!d||speed<8||m.t-d.impactAt<1)return;
  d.impactAt=m.t;damageRobot(m,r,(speed-7)*1.5);
}
function beforeDurability(run){
  if(!run.m.robots[0]?.durability)initDurability(run);
  for(const r of run.m.robots){
    const d=r.durability,b=r.durabilityBase;
    const factor=d.condition<=0?0:d.condition<35?.65:1,thermal=d.heat>=85?.5:1;
    for(const k of ['speed','shotRate','intake'])if(Number.isFinite(b[k]))r.st[k]=b[k]*factor*(k==='shotRate'?thermal:1);
    if(d.condition<=0){r.lock=10;r.think=10;r.motionVX=0;r.motionVY=0;r.path=[]}
    r.wearPrevious={x:r.x,y:r.y,held:typeof r.held==='number'?r.held:0,vx:r.motionVX||0,vy:r.motionVY||0};
  }
  const bots=run.m.robots;
  for(let i=0;i<bots.length;i++)for(let j=i+1;j<bots.length;j++){
    const a=bots[i],b=bots[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d>ROB_R*2+.45||d<.001)continue;
    const closing=((a.motionVX-b.motionVX)*dx+(a.motionVY-b.motionVY)*dy)/d;
    if(closing>8){impactRobot(run.m,a,closing);impactRobot(run.m,b,closing)}
  }
}
function afterDurability(run){
  for(const r of run.m.robots){
    const d=r.durability,p=r.wearPrevious;if(!p||d.condition<=0)continue;
    const travel=Math.hypot(r.x-p.x,r.y-p.y),shots=Math.max(0,p.held-(typeof r.held==='number'?r.held:0));
    d.heat=clamp(d.heat+shots*1.1+(r.od>0?2.4:0)/30-(shots?0:1.5)/30,0,100);
    damageRobot(run.m,r,travel*.0015+shots*.005+(d.heat>85?.6/30:0));
  }
}
const gameplayStep=SimRun.prototype.step;
SimRun.prototype.step=function(){
  if(this.ctx.durability===1&&!this.m.over){beforeDurability(this);gameplayStep.call(this);afterDurability(this)}else gameplayStep.call(this);
};
const gameplayRecord=SimRun.prototype.record;
SimRun.prototype.record=function(){return {...gameplayRecord.call(this),durability:this.ctx.durability}};
const gameplayApply=SimRun.prototype.apply;
SimRun.prototype.apply=function(type,args){
  const target=type==='b'&&Number.isInteger(args[1])?this.m.robots[args[1]]:this.me;
  if(target?.durability?.condition<=0)return {msg:'Robot broken — repair it in the workbench after the match'};
  return gameplayApply.call(this,type,args);
};
// Report obstacle impacts at the point the drivetrain resolves them.
const wearDrive=drive2026;
drive2026=function(m,r,dt){
  const vx=r.motionVX||0,vy=r.motionVY||0;wearDrive(m,r,dt);
  const lost=Math.hypot(vx-(r.motionVX||0),vy-(r.motionVY||0));
  if(lost>8&&m.blocked(r,r.x+vx*dt,r.y+vy*dt))impactRobot(m,r,lost);
};
function durabilityHUD(root,robot){
  const meter=document.createElement('div');meter.className='robot-condition';meter.innerHTML='<span></span><meter min="0" max="100" aria-label="Robot condition"></meter><span></span><meter min="0" max="100" aria-label="Robot heat"></meter>';
  const place=root.querySelector('.hubline');if(place)place.append(meter);
  return ()=>{const d=robot.durability||{condition:100,heat:0};const labels=meter.querySelectorAll('span'),bars=meter.querySelectorAll('meter');labels[0].textContent=d.condition<=0?'BROKEN':Math.ceil(d.condition)+'% condition';labels[1].textContent=Math.round(d.heat)+'% heat'+(d.heat>=85?' · cooling needed':'');bars[0].value=d.condition;bars[1].value=d.heat;meter.classList.toggle('damaged',d.condition<35||d.heat>=85)};
}
function mountDurabilityShop(panel){
  const section=document.createElement('section');section.className='durability-shop';panel.prepend(section);
  const render=()=>{
    const condition=robotCondition(SAVE),cost=Math.ceil((100-condition)*2),owned=new Set(SAVE.materials||['alloy']),selected=materialOf(SAVE.material);
    section.innerHTML='<h2>Frame & repairs</h2><p><strong>'+Math.ceil(condition)+'% condition</strong> · '+selected.name+'</p><p class="muted">Hard collisions and prolonged overheating damage your robot. Below 35% it slows down; at 0% it breaks. Practice resets damage.</p><button id="repair-frame" '+(!cost||!canSpendCredits(cost)?'disabled':'')+'>Repair to 100% · '+cost+' coins</button><div class="material-options">'+MATERIALS.map(m=>'<button data-material="'+m.id+'" aria-pressed="'+(selected.id===m.id)+'" '+(selected.id===m.id||(!owned.has(m.id)&&!canSpendCredits(m.cost))?'disabled':'')+'><strong>'+m.name+'</strong><span>'+m.desc+'</span><b>'+(selected.id===m.id?'Equipped':owned.has(m.id)?'Equip':m.cost+' coins')+'</b></button>').join('')+'</div>';
    section.querySelector('#repair-frame').onclick=()=>{if(cost&&spendCredits(cost)){SAVE.condition=100;persist();screenPit()}};
    section.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>{const m=materialOf(b.dataset.material);if(!owned.has(m.id)&&!spendCredits(m.cost))return;owned.add(m.id);SAVE.materials=[...owned];SAVE.material=m.id;persist();screenPit()});
  };render();
}
