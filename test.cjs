const fs=require('fs'),vm=require('vm');const html=fs.readFileSync('index.html','utf8');const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);for(const s of scripts)new vm.Script(s);console.log('All inline JavaScript parses');
const noop=()=>{};const el=new Proxy({style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,querySelectorAll:()=>[],getContext:()=>({})},{get:(t,k)=>k in t?t[k]:noop});
const sandbox={console,Math,JSON,Date,Map,Set,Uint8Array,Float32Array,Int32Array,URL,URLSearchParams,performance:{now:()=>0},setTimeout:noop,setInterval:noop,clearTimeout:noop,clearInterval:noop,requestAnimationFrame:noop,cancelAnimationFrame:noop,localStorage:{getItem:()=>null,setItem:noop},navigator:{userAgent:'test'},location:{search:'',hostname:'localhost',protocol:'http:',href:'http://localhost'},document:{createElement:()=>el,querySelector:()=>el,querySelectorAll:()=>[],getElementById:()=>el,addEventListener:noop,documentElement:{style:{},dataset:{}},body:el},addEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop}),innerWidth:1000,innerHeight:900};sandbox.crypto=require("crypto").webcrypto;sandbox.window=sandbox;sandbox.screen={width:1000,height:900};vm.createContext(sandbox);
for(const s of scripts){if(s.includes('const SEASONS='))vm.runInContext(s,sandbox)}
vm.runInContext(fs.readFileSync('navigation.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('enhancements.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('dynamics.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('royale-models.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('robot-preview.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('performance-ui.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('workshop.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('auto-editor.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('arena.js','utf8'),sandbox);
const packedClips=vm.runInNewContext(fs.readFileSync('sounds/field-clips.js','utf8')+'\nFIELD_CLIPS');
for(const [name,encoded] of Object.entries(packedClips))if(!Buffer.from(encoded,'base64').equals(fs.readFileSync('sounds/'+name+'.mp3')))throw Error('Bundled sound differs from supplied MP3: '+name);
if(Object.keys(packedClips).length!==4||html.indexOf('sounds/field-clips.js')>html.indexOf('<script src="field-audio.js'))throw Error('Four bundled sounds must load before audio startup');
vm.runInContext(fs.readFileSync('field-audio.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('waypoint-auto.js','utf8'),sandbox);
vm.runInContext(`
const assert=(v,m)=>{if(!v)throw Error(m)};
const motionWorld={blocked:()=>false,hub:()=>({x:0,y:0}),planPath:()=>{}};
{
 const ball=(x,y,vx=0,vy=0)=>({x,y,vx,vy});
 const world={fuel:[ball(8,27,12),ball(8.7,27)],robots:[]};
 Match.prototype.fuelPhysics.call(world,1/30);
 assert(world.fuel[1].vx>0&&world.fuel[0].vx<12,'fuel transfers momentum on contact');
 assert(dist(...world.fuel)>=.539,'fuel contact separates balls');
 const fast={fuel:[ball(8,27,30),ball(9,27,-30)],robots:[]};
 Match.prototype.fuelPhysics.call(fast,1/30);
 assert(fast.fuel[0].vx<0&&fast.fuel[1].vx>0,'fast opposing fuel cannot tunnel through each other');
 const overlap={fuel:[ball(8,27),ball(8,27)],robots:[]};
 collideFuel2026(overlap);assert(dist(...overlap.fuel)>.53,'coincident fuel separates without NaNs');
 const spread={fuel:Array.from({length:500},(_,i)=>ball(.5+(i%25),.5+Math.floor(i/25))),robots:[]};
 assert(collideFuel2026(spread)<500*10,'grid avoids all-pairs collision checks');
 const up=bumpPose2026({x:7,y:BAR.B-1.3,a:Math.PI/2}),down=bumpPose2026({x:7,y:BAR.B+1.3,a:Math.PI/2});
 assert(up.pitch>0&&down.pitch<0&&up.elevation>0,'robot pitches up then down across bump');
 assert(bumpPose2026({x:7,y:BAR.B-1.3,a:0}).roll>0,'sideways swerve rolls over bump');
 assert(bumpPose2026({x:2,y:BAR.B,a:0}).elevation===0,'trench traversal stays level');
 console.log('PASS: fuel separation, momentum, fast collisions, spatial grid scaling and bump poses');
}
const mover={x:0,y:0,a:0,path:[{x:100,y:0}],held:0,st:{speed:11.88,turn:4.2,strafe:true,bump:1}};
for(let i=0;i<180;i++){
  if(i===60)mover.path=[{x:mover.x,y:100}];
  if(i===120)mover.path=[];
  const old={x:mover.x,y:mover.y,a:mover.a,vx:mover.motionVX||0,vy:mover.motionVY||0};
  drive2026(motionWorld,mover,1/30);
  assert(dist(old,mover)<=11.88/30+1e-8,'bounded per-tick travel');
  assert(Math.hypot(mover.motionVX-old.vx,mover.motionVY-old.vy)<=18/30+1e-8,'bounded velocity change through sharp turns');
  assert(Math.abs(angleDelta(mover.a,old.a))<=4.2/30+1e-8,'bounded chassis rotation');
}
assert(mover.driveSpeed===0,'comes to rest after path ends');
const firingWorld={hub:()=>({x:0,y:0}),inZone:()=>true,active:()=>true,t:21,R:{auto:20},canShoot:Match.prototype.canShoot,launch:()=>{}};
function fired(mode,rate,moving,defended){
  const r={x:3,y:0,a:Math.PI,A:'B',held:1000,path:moving?[{x:10,y:0}]:[],motionVX:moving?3:0,motionVY:0,slow:defended?1:0,press:1,shotAcc:0,st:{mode,shotRate:rate,spin:0,acc:.9}};
  for(let i=0;i<300;i++)Match.prototype.shoot.call(firingWorld,r,1/30);
  return 1000-r.held;
}
assert(fired('close',6,true,false)===0,'moving dumper cannot shoot');
assert(fired('zone',3.6,true,false)>=35,'moving turret shoots');
assert(fired('close',6,false,false)>fired('zone',3.6,false,false),'dumper has higher burst output');
assert(fired('close',6,false,true)<=11,'defense chokes dumper output');
assert(fired('zone',3.6,true,true)>=31,'turret sustains output against defense');
console.log('PASS: acceleration, turn and travel bounds, braking to rest, mobile turret, stationary dumper, burst and defense tradeoffs');
SAVE={credits:10};assert(!TEST_CREDITS,'real coin spending is the default');TEST_CREDITS=true;for(let i=0;i<100;i++)assert(spendCredits(1700),'unlimited purchases');assert(SAVE.credits===10,'real balance unchanged');assert(JSON.parse(JSON.stringify(SAVE)).credits===10,'finite saved balance');TEST_CREDITS=false;assert(!spendCredits(11),'normal mode insufficient balance');assert(spendCredits(3)&&SAVE.credits===7,'normal price deduction');TEST_CREDITS=true;SAVE=null;
const curve=smoothRoute([{x:0,y:0},{x:5,y:0},{x:5,y:5}]);assert(curve.length>3,'curve sampling');assert(curve.some(p=>p.x<5&&p.y>0),'rounded corner');assert(smoothRoute([{x:0,y:0},{x:5,y:0},{x:5,y:5}],()=>true).length===3,'blocked curve fallback');
const build={};for(const [k,id] of Object.entries(SEASONS[2026].starter.equip))build[k]={id,lv:1};build.drive={id:'swerve',lv:1};
const navStats=buildStats(build,2026);
// Maxed, boosted swerve must follow short bends without sailing past the route.
const maxBuild={...build,drive:{id:'swerve',lv:5}},maxStats=buildStats(maxBuild,2026);
for(const boost of [0,10])for(const points of [
 [{x:0,y:0},{x:12,y:0},{x:12,y:5},{x:16,y:5}],
 [{x:0,y:0},{x:14,y:0},{x:14,y:1},{x:2,y:1}],
 [{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:4,y:2}]
]){
 const route=smoothRoute(points),r={...points[0],a:0,A:'B',held:0,st:maxStats,od:boost,path:route.slice(1),pathFrom:points[0]};
 let worst=0,ticks=0;
 const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return dist(p,{x:a.x+t*dx,y:a.y+t*dy})};
 for(let i=0;i<900&&(r.path.length||(r.driveSpeed||0)>.01);i++){ticks++;drive2026(motionWorld,r,1/30);worst=Math.max(worst,Math.min(...route.slice(1).map((p,j)=>segmentDistance(r,route[j],p))))}
 assert(ticks/30<(points[1].x===12?4:points[1].x===14?4.6:2.2),'swerve carries speed through plotted bends');
 assert(worst<.85,'max swerve stays within .85ft of plotted curve: '+worst);
 assert(dist(r,points.at(-1))<.3&&r.driveSpeed<.01,'max swerve brakes and settles at final point');
}

for(const auton of [false,true]){
 const pts=[{x:7,y:46},{x:10,y:47},{x:14,y:46},{x:18,y:47},{x:22,y:46}],start={x:3,y:46};
 let r={...start,a:0,A:'B',st:maxStats,held:0,path:[],routePoints:pts};
 const world=Object.create(Match.prototype);world.t=21;world.R={auto:20};world.hub=()=>({x:13.5,y:41});
 if(auton){const auto={version:2,entry:'bumpLeft',path:pts.map(p=>({...p,action:'move'}))},compiled=compileWaypointAuto(auto,maxStats);assert(compiled.groups.length===1,'auton move points share a single continuous path');r={...r,...compiled.start,path:compiled.groups[0].path,pathFrom:compiled.start};}
 else rebuildRoute(world,r);
 let minimum=Infinity;
 for(let i=0;i<600&&(r.path.length||(r.driveSpeed||0)>.01);i++){drive2026(world,r,1/30);if(r.x>11&&r.x<19)minimum=Math.min(minimum,r.driveSpeed)}
 assert(minimum>3,'intermediate move points keep flowing: '+minimum);
 assert(dist(r,pts.at(-1))<.3,'continuous route still reaches its destination');
}
assert(fuelBarOpacity({robots:[],fuel:[]},{x:5,y:32,w:3,h:.5})===.9,'clear carpet keeps bar readable');
assert(fuelBarOpacity({robots:[{x:6,y:32}],fuel:[]},{x:5,y:32,w:3,h:.5})===.25,'bar fades over robot');
assert(fuelBarOpacity({robots:[],fuel:[]},{x:12,y:41,w:3,h:.5})===.9,'bar stays opaque over hub');
assert(fuelBarOpacity({robots:[],fuel:[{x:6,y:32}]},{x:5,y:32,w:3,h:.5})===.9,'bar stays opaque over fuel');

{
 const owner={x:6,y:32};assert(fuelBarOpacity({robots:[owner]},{x:5,y:32,w:3,h:.5},owner)===.9,'own robot does not fade its bar');
 const robot={x:8,y:32,a:0,held:0,intakeAcc:0,st:{cap:8,intake:3,reach:.4},lock:0,climbLv:0};
 const ball=(x,y)=>({x,y,vx:0,vy:0});
 const center=ball(9.4,32),corner=ball(9.1,33.1),side=ball(8,33.4),rear=ball(6.6,32);
 const world={robots:[robot],fuel:[center,corner,side,rear]};
 Match.prototype.fuelPhysics.call(world,1/30);
 assert(center.vx===0&&center.vy===0,'roller retains center fuel instead of knocking it away');
 assert(Math.hypot(corner.vx,corner.vy)>0&&Math.hypot(side.vx,side.vy)>0,'intake corners and sides push fuel');
 for(let i=0;i<12;i++){Match.prototype.intake.call(world,robot,1/30);Match.prototype.fuelPhysics.call(world,1/30)}
 assert(robot.held===1&&!world.fuel.includes(center),'center fuel collected at intake rate');
 assert(world.fuel.includes(rear),'single intake does not collect from rear');
 robot.st.both=true;assert(intakeMouth2026(robot,ball(6.6,32))===-1,'dual intake accepts rear mouth');
 robot.a=Math.PI/2;assert(intakeMouth2026(robot,ball(8,33.4))===1,'mouth follows chassis heading');
 robot.a=0;robot.held=8;world.fuel=[ball(9.4,32)];Match.prototype.fuelPhysics.call(world,1/30);assert(world.fuel[0].vx>0,'full hopper pushes center fuel');
}

for(const mode of ['close','hood','zone','spot']){
 const r={a:0,turretA:Math.PI/2,st:{mode}},outlets=Array.from({length:10},()=>fuelOutlet2026(r));
 if(['close','hood'].includes(mode))assert(Math.max(...outlets.map(p=>p.outletY))-Math.min(...outlets.map(p=>p.outletY))===1,'dumper spans a one-foot mouth');
 else assert(outlets.every(p=>p.outletX===outlets[0].outletX&&p.outletY===outlets[0].outletY),'turret/flywheel keeps one muzzle');
}

{
 const r={a:0,turretA:0,st:{mode:'zone'},tm:{build:{shooter:{id:'dturret'}}}};
 const shots=Array.from({length:6},()=>fuelOutlet2026(r));
 assert(new Set(shots.map(p=>p.outletY)).size===2&&shots[0].outletY===shots[2].outletY,'double turret alternates two fixed lanes');
 r.turretA=Math.PI/2;assert(Math.abs(fuelOutlet2026(r).outletX-.6)<1e-9,'split lanes rotate with turret aim');
 const maxIntake=buildStats({...build,intake:{id:'otb',lv:5}},2026),prior=buildStats({...build,intake:{id:'otb',lv:4}},2026);
 assert(maxIntake.intake===10&&maxIntake.intake>prior.intake&&!prior.suction,'max single OTB unlocks 10 BPS suction');
 const bot={x:8,y:32,a:0,held:0,intakeAcc:0,st:maxIntake};
 assert(intakeMouth2026(bot,{x:9.6,y:33.2})===1,'max OTB captures fuel touching roller corner');
 assert(intakeMouth2026(bot,{x:8,y:33.4})===0&&intakeMouth2026(bot,{x:6.6,y:32})===0,'single intake still excludes robot sides and rear');
 const world={robots:[bot],fuel:Array.from({length:8},(_,i)=>({x:9.6,y:31.0+i*.28,vx:0,vy:0}))};
 Match.prototype.fuelPhysics.call(world,1/30);
 assert(world.fuel.every(f=>f.vx===0&&f.vy===0),'full mouth holds contacted fuel rather than spilling its corners');
 for(let i=0;i<31;i++)Match.prototype.intake.call(world,bot,1/30);
 assert(bot.held===8,'max OTB collects available mouth fuel at the new rate');
}

for(let lv=1;lv<=5;lv++){
 const turret=buildStats({...build,shooter:{id:'turret',lv}},2026),dumper=buildStats({...build,shooter:{id:'dumper',lv}},2026);
 assert(dumper.shotRate>turret.shotRate,'dumper retains burst advantage at every level');
 assert(turret.shotRate===[1.5,2.75,4.75,7.5,9][lv-1],'turret progression matches scaled table');
 assert(buildStats({...build,hopper:{id:'hopper',lv}},2026).cap===[15,28,43,60,70][lv-1],'hopper progression matches table');
}
for(const A of ['B','T'])for(const mode of ['close','hood','spot','zone']){
 const start=M(A,8,33),target=feedAim2026({...M(A,8,33),A,st:{mode}});
 const r={...start,A,a:-Math.PI/2,held:20,st:{...maxStats,mode,shotRate:5},feed:12,path:[M(A,20,33)],motionVX:5,motionVY:0,shotAcc:0};
 const world={...motionWorld,t:21,R:{auto:20},air:[],hub:()=>({x:13.5,y:41}),canShoot:()=>false};
 Match.prototype.shoot.call(world,r,1);
 assert(mode==='zone'?world.air.length>0:world.air.length===0,'only turret feeds on the move');
 if(mode!=='zone'){
   for(let tick=0;tick<180;tick++){drive2026(world,r,1/30);Match.prototype.shoot.call(world,r,1/30);if(world.air.length)break}
   assert(world.air.length>0&&r.driveSpeed<=.3,'fixed shooter stops before feeding');
   assert(Math.abs(angleDelta(Math.atan2(target.y-r.y,target.x-r.x),r.a))<=.18,'dumper aims into own alliance zone');
   assert(r.path.length>0,'feeding preserves route for resuming');
 }
}

for(const A of ['B','T'])for(const x of [6,21]){
 const r={...M(A,x,33),A},target=feedAim2026(r),local=M(A,target.x,target.y);
 assert(local.x===x&&local.y===46,'dumper feeds along its own alliance lane');
 const f={x0:r.x,y0:r.y,x1:target.x,y1:target.y,dur:1,pass:true,A},v=passRoll2026(f);
 assert(v.vy*(A==='B'?1:-1)>0&&Math.hypot(v.vx,v.vy)<=5.5,'pass retains bounded forward momentum');
 const world={fuel:[],robots:[],sc:{B:{},T:{}},addFuel:Match.prototype.addFuel};Match.prototype.land.call(world,f);
 const ball=world.fuel[0],start={...ball};for(let i=0;i<180;i++)Match.prototype.fuelPhysics.call(world,1/30);
 assert(dist(ball,start)>1&&dist(ball,start)<5,'passed fuel rolls a few feet then settles');
 assert(Math.hypot(ball.vx,ball.vy)<.05,'rolling fuel goes to sleep');
}
assert(Object.keys(fuelOutlet2026(null)).length===0,'human player launches unchanged');
console.log('PASS: continuous auton/teleop move points and fuel overlay occlusion');

{
 const r={x:0,y:0,a:0,A:'B',held:0,st:maxStats,path:smoothRoute([{x:0,y:0},{x:12,y:0},{x:12,y:8}]).slice(1),pathFrom:{x:0,y:0}};
 let turningWhileApproaching=false;
 for(let i=0;i<300&&r.path.length;i++){drive2026(motionWorld,r,1/30);if(r.x<9.5&&r.y<.4&&r.driveSpeed>3&&r.a>.08)turningWhileApproaching=true}
 assert(turningWhileApproaching,'swerve rotates before reaching the bend while translating');
}
console.log('PASS: max-level boosted swerve tight bends, hairpins, short points and destination braking');

for(const low of [true,false])for(const [start,end,auto]of [[{x:8,y:45},{x:18,y:34},true],[{x:8,y:40},{x:19,y:40},false],[{x:2,y:45},{x:2,y:33},true],[{x:8,y:48},{x:22,y:50},true]]){
  const st={...navStats,low},path=navigation2026(start,end,st,'B',auto,true);assert(path.length,'obstacle detour exists');
  const blocked=p=>blocked2026({A:'B',st},p.x,p.y,auto);let previous=start;
  const rounded=smoothRoute([start,...path],blocked).slice(1);
  for(const p of rounded){assert(clearSegment(previous,p,blocked),'entire rounded segment clears obstacles');previous=p}
  const r={...start,a:0,A:'B',st,path:rounded,pathFrom:start,held:0},world={...motionWorld,blocked:(r,x,y)=>blocked2026(r,x,y,auto)};
  for(let tick=0;tick<900&&(r.path.length||r.driveSpeed>.1);tick++){drive2026(world,r,1/30);assert(!blocked(r),'robot stays outside structures')}
  assert(dist(r,end)<.6,'route converges without looping at samples');
}
SAVE={season:2026};
const budgetAuto={start:'C',path:[{x:8,y:45},{x:8,y:34}],steps:['score']},timed=estimateAuto(budgetAuto,navStats);
assert(timed.routeTime>0&&timed.t>=timed.routeTime,'route timing includes travel and subsequent steps');
const tooLong={start:'C',steps:[],path:Array.from({length:30},(_,i)=>({x:i%2?22:5,y:45}))};
assert(!estimateAuto(tooLong,navStats).ok,'long AUTO route rejected');
assert(!estimateAuto({start:'C',steps:[],path:[{x:13.5,y:41}]},navStats).ok,'hub waypoint rejected');
assert(!estimateAuto({start:'C',steps:[],path:[{x:8,y:24}]},navStats).ok,'AUTO midfield crossing rejected');
for(const p of [{x:0,y:0},{x:27,y:54},{x:7,y:42}]){const projected=arenaProject(p.x,p.y),back=arenaUnproject(projected.x,projected.y);assert(dist(p,back)<1e-10,'field pointer projection roundtrip')}
console.log('PASS: obstacle and trench routing, swept collision clearance, route convergence, AUTO budgets and projected pointer coordinates');
const bumpTime=driveTravel2026({x:7.6,y:45},[{x:7.6,y:36}],navStats).time;
const trenchTime=driveTravel2026({x:2,y:45},[{x:2,y:36}],{...navStats,low:true}).time;
assert(bumpFactor2026({x:7.6,y:41},navStats)<.43,'swerve has a pronounced bump crossing speed limit');
assert(bumpTime>trenchTime+.3,'bump ascent and descent increase travel estimate');
assert(bumpFactor2026({x:7.6,y:40},navStats)===bumpFactor2026({x:7.6,y:42},navStats),'symmetric bump slowdown');
assert(bumpFactor2026({x:2,y:41},navStats)===1,'trench does not get bump slowdown');
const programAuto={version:2,start:'L',entry:'bumpLeft',steps:[],path:[{x:7.6,y:36,action:'wait',seconds:.5},{x:8,y:33,action:'feed',seconds:1},{x:13.5,y:44,action:'shoot',seconds:2}]};
const programEstimate=estimateWaypointAuto(programAuto,navStats);assert(programEstimate.ok,'mixed command auto fits');
assert(estimateWaypointAuto({...programAuto,path:[{x:7.6,y:44.6,action:'wait',seconds:20}]},navStats).t>=20,'wait time counted');
assert(!estimateWaypointAuto({...programAuto,path:[{x:8,y:34,action:'shoot',seconds:1}]},navStats).ok,'invalid shoot location rejected');
assert(!estimateWaypointAuto({...programAuto,entry:'trenchLeft'},{...navStats,low:false}).ok,'tall trench start rejected');
assert(!estimateWaypointAuto({...programAuto,path:[{x:18.7,y:50.3,action:'climb'}]},navStats).ok,'climb equipment required');
const programTeam={num:254,name:'Test',A:'B',slot:0,isPlayer:true,build,autoPlan:[],drawnPath:[],waypointAuto:programAuto};
const programRun=new SimRun(2026,[programTeam],441,{});assert(programRun.me.x===7.6,'selected entry is actual spawn');
while(!programRun.me.waypointState.done&&programRun.m.t<20)programRun.step();
assert(programRun.me.waypointState.done,'waypoint actions execute in sequence');
const climbBuild={...build,climber:{id:'hook',lv:1}},climbAuto={version:2,entry:'bumpRight',start:'R',steps:[],path:[{x:18.7,y:50.3,action:'climb'}]};
assert(estimateWaypointAuto(climbAuto,buildStats(climbBuild,2026)).ok,'valid tower climb fits');
const climbRun=new SimRun(2026,[{...programTeam,slot:2,build:climbBuild,waypointAuto:climbAuto}],442,{});climbRun.me.st.climbRel=1;
while(climbRun.m.t<19&&climbRun.me.autoLv===0)climbRun.step();assert(climbRun.me.autoLv===1&&climbRun.m.sc.B.autoTower>0,'waypoint climb awards tower points');
assert(programRun.me.passed>0,'feed command actually launches passes');
assert(programRun.m.air.some(f=>!f.pass)||programRun.me.scored>0,'shoot command actually launches shots');
assert(Math.abs(programRun.m.t-programEstimate.t)<.6,'shared predictor matches isolated runtime');
const programRecord=programRun.record(),programReplay=new ReplayRun(programRecord);programReplay.seek(programRecord.n);assert(dist(programRun.me,programReplay.me)<1e-8,'waypoint replay determinism');

const returns=new SimRun(2026,[programTeam],734,{});returns.m.fuel=[];returns.m.robots=[];returns.m.hubq=[{A:'B',t:0},{A:'T',t:0}];returns.step();
assert(returns.m.fuel.length===2,'hub emits one returned ball per score');
assert(returns.m.fuel.some(f=>f.y>27&&f.vy<0)&&returns.m.fuel.some(f=>f.y<27&&f.vy>0),'both hub returns roll toward midfield');
returns.wrap(()=>{
 for(const A of ['B','T']){
  const world={fuel:[],robots:[],addFuel:Match.prototype.addFuel};
  for(let i=0;i<80;i++)hubReturn2026(world,A);
  assert(world.fuel.every(f=>{const p=M(A,f.x,f.y);return p.x>HUBX[0]&&p.x<HUBX[1]&&Math.abs(p.y-38.85)<1e-8}),'every return starts at hub exit');
  assert(world.fuel.some(f=>f.vx>1)&&world.fuel.some(f=>f.vx<-1),'hub returns fan in both lateral directions');
  const starts=world.fuel.map(f=>({...f}));
  let reachedFarSide=false;
  for(let i=0;i<600;i++){
   Match.prototype.fuelPhysics.call(world,1/30);
   reachedFarSide ||= world.fuel.some(f=>M(A,f.x,f.y).y<=BAR.T+2.5);
  }
  assert(reachedFarSide,'hub returns can cross the neutral zone for both alliances');
  const distances=world.fuel.map((f,i)=>dist(f,starts[i]));
  assert(Math.max(...distances)-Math.min(...distances)>4,'hub returns travel visibly different distances');
  assert(world.fuel.every(f=>Math.hypot(f.vx,f.vy)<.05),'hub returns settle');
  const target=feedAim2026({...M(A,8,33),A}),start=M(A,8,33);
  const rolls=Array.from({length:80},()=>passRoll2026({x0:start.x,y0:start.y,x1:target.x,y1:target.y,dur:1}));
  assert(rolls.some(v=>v.vx>1)&&rolls.some(v=>v.vx<-1),'identical passes scatter in both directions');
  const ranges=rolls.map(v=>Math.hypot(v.vx,v.vy)/v.rollDrag);
  assert(Math.max(...ranges)-Math.min(...ranges)>2,'identical passes have varied rolling distances');
  for(const mode of ['close','hood','zone'])for(const x of [2,12,15,25]){
   const r={...M(A,x,33),A,st:{mode}};
   const targets=Array.from({length:80},()=>{const p=feedTarget2026(r);return M(A,p.x,p.y)});
   assert(targets.every(p=>p.x>0&&p.x<FW&&p.y>BAR.B&&p.y<FL),'passes land inside own alliance zone');
   if(mode!=='zone')assert(targets.every(p=>x<FW/2?p.x<FW/3:p.x>FW*2/3),'dumpers target the nearer outer third, even from midfield');
   assert(Math.max(...targets.map(p=>p.x))-Math.min(...targets.map(p=>p.x))>(mode==='zone'?18:4.5),'wider passing spread');
  }
 }
});
const mirrored=new SimRun(2026,[{...programTeam,A:'T'}],441,{});assert(mirrored.me.x===27-7.6&&mirrored.me.y===54-44.6,'entry mirrors for red alliance');
console.log('PASS: bump timing, lane starts, waypoint validity, timed wait/feed/shoot, prediction/runtime agreement and waypoint replay');
SAVE=null;
for(const sh of ['dumper','superdumper','flywheel','turret','dturret'])for(const hopper of ['bin','hopper','net','mega']){const b={...build,shooter:{id:sh,lv:1},hopper:{id:hopper,lv:1}};const model=robotModel(b,'#3e8bff',2026);assert(model.prims.length>50,'detailed model');assert(Number.isFinite(model.height),'finite model height');if(hopper!=='mega'&&sh!=='dturret')assert(model.height<=22.25,'short mechanism fits trench');for(const p of model.prims)for(const face of prismFaces(p))assert(face.v.flat().every(Number.isFinite),'finite model geometry')}
const teams=Array.from({length:6},(_,i)=>({num:i+1,name:'Test',A:i<3?'B':'T',slot:i%3,isPlayer:i===0,build,autoPlan:[],drawnPath:i===0?[{x:4.5,y:40},{x:7,y:38}]:[]}));
const run=new SimRun(2026,teams,123,{});for(let i=0;i<150;i++)run.step();assert(run.me.routeInitialized,'auto route initialized');assert(run.me.y<44,'autonomous route moved robot');
while(run.m.t<21)run.step();const before={x:run.me.x,y:run.me.y};assert(run.input('p',4,43)?.ok,'plot');assert(run.input('p',7,42)?.ok,'append');assert(run.me.routePoints.length===2,'queued points');run.input('u');assert(run.me.routePoints.length===1,'undo');let routeTravel=0;for(let i=0;i<120;i++){const p={x:run.me.x,y:run.me.y};run.step();routeTravel+=dist(run.me,p)}assert(routeTravel>1,'teleop route moves');
const record=run.record(), replay=new ReplayRun(record);replay.seek(record.n);assert(dist(run.me,replay.me)<1e-8,'replay determinism');

console.log('PASS: unlimited/normal credit spending and save integrity, 20 model combinations and trench clearance, curve sampling, obstacle fallback, autonomous movement, teleop queue, undo, movement, replay determinism');
`,sandbox);

const audioNodes=[];
const parameter=()=>({value:0,setValueAtTime(v){if(!Number.isFinite(v))throw Error('Invalid audio parameter');this.value=v},linearRampToValueAtTime(v){this.setValueAtTime(v)},exponentialRampToValueAtTime(v){if(v<=0)throw Error('Invalid exponential ramp');this.setValueAtTime(v)},setTargetAtTime(v){this.setValueAtTime(v)}});
const audioNode=()=>{const n={connect:noop,disconnect(){this.disconnected=true},start(){this.started=true},stop(){this.stopped=true},gain:parameter(),frequency:parameter(),Q:parameter(),pan:parameter(),playbackRate:parameter(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()};audioNodes.push(n);return n};
sandbox.AudioContext=class {constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=audioNode();sandbox.audioContext=this}createGain(){return audioNode()}createDynamicsCompressor(){return audioNode()}createOscillator(){return audioNode()}createBufferSource(){return audioNode()}createBiquadFilter(){return audioNode()}createStereoPanner(){return audioNode()}createBuffer(c,n){const d=new Float32Array(n);return {getChannelData:()=>d}}resume(){this.state='running';return Promise.resolve()}suspend(){this.state='suspended';return Promise.resolve()}};
vm.runInContext(`
const originalRandomAudio=Math.random;Math.random=()=>{throw Error('Audio must not consume match RNG')};
FieldAudio.unlock();Math.random=originalRandomAudio;
FieldAudio.start(run.m);run.me.motionVX=5;FieldAudio.tick();
for(const kind of ['score','miss','launch','dump','intake','start','shift','endgame','end']){audioContext.currentTime+=1;FieldAudio.emit(kind)}
const beforeAudioMute=FieldAudio.volume;FieldAudio.setVolume(.2);assert(FieldAudio.volume===.2,'volume setting');FieldAudio.setEnabled(false);assert(!FieldAudio.enabled,'mute setting');FieldAudio.setEnabled(true);
const observedAudio=[],emitAudio=FieldAudio.emit;FieldAudio.emit=(kind)=>observedAudio.push(kind);
run.m.t=run.m.R.auto-.01;run.m.step(1/30);assert(observedAudio.includes('autoEnd')&&observedAudio.includes('resume'),'auton ends then teleop resumes');
observedAudio.length=0;run.m.t=run.m.R.auto+run.m.R.trans-.01;run.m.step(1/30);assert(!observedAudio.includes('resume'),'first hub shift does not restart teleop sound');
observedAudio.length=0;run.m.t=run.m.end-run.m.R.end-.01;run.m.step(1/30);assert(observedAudio.includes('endgame'),'warning at endgame start');
observedAudio.length=0;run.m.t=run.m.end-.01;run.m.step(1/30);assert(observedAudio.includes('end'),'end clip at clock zero');
observedAudio.length=0;run.m.t=run.m.end+run.m.R.grace+2;run.m.step(1/30);assert(!observedAudio.includes('end'),'no duplicate buzzer after scoring grace');
observedAudio.length=0;replay.m.step(1/30);assert(observedAudio.length===0,'replay does not emit field cues');
FieldAudio.emit=emitAudio;FieldAudio.stop();assert(FieldAudio.match===null,'leaving detaches live match');FieldAudio.setVolume(beforeAudioMute);
`,sandbox);
if(audioNodes.filter(n=>n.started).some(n=>!n.stopped))throw Error('Audio sources leaked after leaving match');
console.log('PASS: audio synthesis parameters, RNG isolation, phase cues, replay silence, mute/volume and source cleanup');

vm.runInContext(fs.readFileSync('boost-targeting.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('multiplayer.js','utf8'),sandbox);
sandbox.Worker=class {constructor(url){this.url=url}terminate(){this.terminated=true}};
sandbox.document.removeEventListener=noop;
vm.runInContext(`
{
 SAVE=freshSave(2026);SAVE.team={num:254,name:"Test team"};
 const ownBuild=myBuild();
 const ts=Array.from({length:6},(_,i)=>({num:100+i,name:'Online Test',color:'#336699',A:i<3?'B':'T',slot:i%3,isPlayer:i===0||i===3,build:ownBuild,autoPlan:[],drawnPath:[]}));
 const r=new SimRun(2026,ts,978,{trophies:0});
 r.input('b','od',1);assert(r.m.robots[1].od===10&&!r.me.od,'drag boosts ally, not self');
 assert(r.input('b','od',3)?.msg&&!r.m.robots[3].od,'enemy boosts rejected');
 assert(r.input('b','od',999)?.msg,'invalid target rejected');
 r.input('b','fd');assert(r.me.feed===12,'legacy click boost applies to self');
 for(let i=0;i<20;i++)r.step();const replay=new ReplayRun(r.record());replay.seek(r.n);
 assert(replay.m.robots[1].od===r.m.robots[1].od&&replay.me.feed===r.me.feed,'targeted boost replay');
 const project=(x,y)=>({x:x*10,y:y*10});
 assert(boostDropTarget(r.m.robots,r.me,project(r.m.robots[3].x,r.m.robots[3].y),project,30)===null,'enemy drop rejected');
 assert(boostDropTarget(r.m.robots,r.me,project(r.m.robots[1].x,r.m.robots[1].y),project,30)===r.m.robots[1],'ally hit test');
 const beforeShow=screenOnlineMatch;screenOnlineMatch=()=>{};
 const host=new FriendSession('ABCDEF1234',true,()=>{}),guest=new FriendSession('ABCDEF1234',false,()=>{});
 host.peer=guest.id;guest.peer=host.id;host.peerTeam=guest.team;guest.peerTeam=host.team;
 const sent=[];host.send=(kind,data={})=>{sent.push({kind,...data});if(kind==='commandAck')guest.receive({v:ONLINE_VERSION,from:host.id,to:guest.id,kind,...data});return true};guest.send=(kind,data={})=>{if(kind==='ack'||kind==='command')host.receive({v:ONLINE_VERSION,from:guest.id,to:host.id,kind,...data});return true};
 host.start();guest.acceptConfig(host.config);host.started=true;
 assert(host.run.m.robots.length===6&&guest.run.m.robots.length===6,'six robots in shared match');
 const rewards=JSON.stringify(SAVE);
 // Drop frame one, deliver frame two, then retry: guest must not step out of order.
 for(let i=0;i<12;i++)host.hostStep();guest.acceptFrame(host.frames[1]);assert(guest.run.n===0,'out-of-order frames wait');
 for(const f of [...host.frames])guest.acceptFrame(f);while(guest.guestStep()){}assert(guest.run.n===host.run.n,'missing frame resend catches up');
 const duplicate=sent.find(x=>x.kind==='frame').frame;guest.acceptFrame(duplicate);assert(guest.run.n===host.run.n,'duplicate frame ignored');
 guest.command(4,'b','fd');assert(guest.outgoing.length===0&&host.pending.length===1,'guest command acknowledged');
 host.receive({v:ONLINE_VERSION,from:guest.id,to:host.id,kind:'command',seq:1,command:{robot:4,type:'b',args:['fd']}});assert(host.pending.length===1,'duplicate guest command ignored');
 // Stop all paint callbacks: only the session clock and incoming frames run.
 host.startClock();const worker=host.clockWorker;const startN=host.run.n;host.clockLast=0;
 document.hidden=true;host.advanceClock(1000);
 assert(host.run.n===startN+30,'background host advances elapsed time without animation frames');
 for(const f of [...host.frames])guest.acceptFrame(f);
 assert(guest.run.n===host.run.n&&host.frames.length===0,'hidden guest processes and acknowledges without painting');
 host.advanceClock(2000);for(const f of [...host.frames])guest.acceptFrame(f);
 assert(host.run.n===startN+60&&guest.run.n===host.run.n,'throttled one-second wakes keep real match pace');
 document.hidden=false;host.stopClock();assert(worker.terminated&&!host.clockRunning,'clock worker cleaned up');
 // Every numbered shift uses the same active/inactive readout as a regular match.
 const savedTime=host.run.m.t, savedInactive=host.run.m.firstInactive;host.run.m.firstInactive="B";
 for(let i=0;i<4;i++){host.run.m.t=host.run.m.R.auto+host.run.m.R.trans+i*host.run.m.R.shift+1;
   assert(host.run.m.phase().name.includes(String(i+1)),'numbered shift');
   const blue=host.run.m.hud('B'),red=host.run.m.hud('T');assert(blue.on!==red.on&&blue.text.includes('24s')&&red.text.includes('24s'),'opposing hub shift countdowns');
 }
 host.run.m.t=savedTime;host.run.m.firstInactive=savedInactive;
 let ticks=0;
 while(!host.run.m.over&&ticks++<10000){
   if(ticks===50)host.pending.push({alliance:'T',command:{robot:4,type:'b',args:['fd']}});
   if(ticks===51)host.pending.push({alliance:'T',command:{robot:1,type:'b',args:['od']}});
   if(ticks===52)host.pending.push({alliance:'B',command:{robot:2,type:'b',args:['od']}});
   if(ticks===53)host.pending.push({alliance:'B',command:{robot:1,type:'b',args:['od']}});
   if(ticks===680)host.pending.push({alliance:'T',command:{robot:4,type:'p',args:[10,9]}});
   host.hostStep();for(const f of [...host.frames])guest.acceptFrame(f);while(guest.guestStep()){}
   if(ticks===53){assert(!host.run.m.robots[1].od,'enemy and cooldown checks enforced');assert(host.run.m.robots[2].od>0,'allied targeted online boost applied')}
 }
 assert(host.run.m.over&&guest.run.m.over,'both clients reach final');
 assert(host.run.n===guest.run.n,'same final simulation tick');
 assert(host.run.m.total('B')===guest.run.m.total('B')&&host.run.m.total('T')===guest.run.m.total('T'),'same scores on both clients');
 for(let i=0;i<6;i++)assert(dist(host.run.m.robots[i],guest.run.m.robots[i])<1e-8,'identical robot positions');
 const hr=onlineResultData(host),gr=onlineResultData(guest);
 assert(hr.us.score===gr.them.score&&hr.them.score===gr.us.score,'results use each player alliance perspective');
 assert(hr.us.bots.filter(b=>b.you).length===1&&gr.us.bots.filter(b=>b.you).length===1&&!hr.them.bots.some(b=>b.you),'only local captain marked YOU');
 assert(hr.rows.length&&hr.cols.length===2&&hr.chips.length,'full score breakdown and objectives');
 const beforeResultsShow=show,previousQuery=app.querySelector,markup=[],resultButtons={};app.querySelector=selector=>resultButtons[selector]||(resultButtons[selector]={});show=html=>markup.push(html);screenOnlineResults(host);show=beforeResultsShow;app.querySelector=previousQuery;
 assert(markup[0].includes('Score breakdown')&&markup[0].includes('online-result-pit')&&markup[0].includes('Friendly match complete'),'regular-style result screen rendered');
 assert(JSON.stringify(SAVE)===rewards,'friend matches do not write rewards or progression');
 const savedDate=Date.now;Date.now=()=>host.lastSeen+31000;host.pulse();Date.now=savedDate;assert(host.closed,'disconnect ends session');
 guest.close();screenOnlineMatch=beforeShow;SAVE=null;
 console.log('PASS: targeted boosts/replays, ally hit testing, two-client complete match, out-of-order/duplicate recovery, alliance ownership, cooldowns, disconnect and no progression writes');
}
`,sandbox);
