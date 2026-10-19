const fs=require('fs');
// Reuse the simulation-only DOM harness; none of the existing test cases run here.
const bootstrap=fs.readFileSync('test.cjs','utf8').split('const packedClips=')[0];
const {sandbox,vm}=new Function('require',bootstrap+';return {sandbox,vm}')(require);
for(const file of ['waypoint-auto.js','boost-targeting.js','multiplayer.js','gameplay.js','matchmaking.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
vm.runInContext(`
const assert=(ok,message)=>{if(!ok)throw Error(message)};
SAVE=freshSave(2026);SAVE.team={num:254,name:'Testing'};persist=()=>{};screenOnlineMatch=()=>{};toast=()=>{};
const teams=Array.from({length:6},(_,i)=>({num:100+i,name:'Robot',color:'#336699',A:i<3?'B':'T',slot:i%3,isPlayer:i===0,build:myBuild(),condition:100,material:'alloy'}));
{
 const run=new SimRun(2026,teams,817,{trophies:0,durability:1});initDurability(run);
 const r=run.me,other=run.m.robots[1];other.durability.material='titanium';
 impactRobot(run.m,r,16);impactRobot(run.m,other,16);
 assert(r.durability.condition<other.durability.condition,'stronger materials resist impacts');
 const damaged=r.durability.condition;impactRobot(run.m,r,16);assert(r.durability.condition===damaged,'continuous contact does not spam impact damage');
 r.durability.heat=100;r.held=5;beforeDurability(run);r.held=0;afterDurability(run);assert(r.durability.condition<damaged,'overheating causes wear');
 r.durability.heat=70;r.od=0;beforeDurability(run);afterDurability(run);assert(r.durability.heat<70,'idle robots cool');
 r.durability.condition=0;const scored=r.scored;run.step();assert(r.lock>0&&r.st.speed===0&&r.scored===scored,'broken robot stops operating');
 assert(run.apply('b',['od',0])?.msg,'cannot boost a broken robot');
}
{
 const run=new SimRun(2026,teams,555,{trophies:0,durability:1});run.input('b','od');for(let i=0;i<950;i++)run.step();
 const replay=new ReplayRun(run.record());replay.seek(run.n);
 assert(replay.run.ctx.durability===1,'replay retains damage rules');
 assert(JSON.stringify(run.m.robots.map(r=>r.durability))===JSON.stringify(replay.m.robots.map(r=>r.durability)),'damage and heat replay deterministically');
 assert(run.m.total('B')===replay.m.total('B'),'damage replay score');
 const old=new SimRun(2026,teams,555,{trophies:0});old.step();assert(!old.me.durability,'legacy replays do not acquire new wear rules');
 const low=performanceCoins(run.m,run.me,'loss');run.me.scored+=20;const high=performanceCoins(run.m,run.me,'loss');assert(high.total>low.total,'personal performance increases coins');
}
console.log('PASS: impacts, materials, contact cooldown, heat, cooling, breakage, replay compatibility and performance rewards');
globalThis.queueChecks=()=>{
 const bus=new Map();
 MatchRelay.prototype.connect=async function(){this.joined=true;const peers=bus.get(this.code)||[];peers.push(this);bus.set(this.code,peers)};
 MatchRelay.prototype.send=function(p){for(const peer of bus.get(this.code)||[])if(peer!==this&&!peer.closed)peer.onMessage(JSON.parse(JSON.stringify(p)));return true};
 MatchRelay.prototype.close=function(){this.closed=true;this.joined=false};
 for(const mode of [1,2,3]){
   const found=[],queues=Array.from({length:mode*2},()=>new PublicQueue(mode,()=>{},(offer,id)=>{found.push({offer,id});return {started:false}}));
   for(const q of queues){q.relay.connect();q.pulse()}
   for(let n=0;n<8;n++)for(const q of queues)q.pulse();
   assert(found.length===mode*2,'all '+mode+'v'+mode+' players matched');
   assert(new Set(found.map(f=>f.offer.code)).size===1,'one agreed room');
   for(const q of queues)q.close();
 }
 const cancel=new PublicQueue(1,()=>{},()=>{throw Error('Cancelled queue matched')});cancel.relay.connect();cancel.pulse();cancel.close();assert(cancel.closed,'cancel exits discovery');
 console.log('PASS: 1v1, 2v2 and 3v3 queue agreement, room consensus and cancellation');
};queueChecks();
globalThis.sessionChecks=()=>{
 for(const mode of [1,2,3]){
   SAVE=freshSave(2026);SAVE.team={num:254,name:'Testing'};
   const roster=Array.from({length:mode*2},(_,i)=>({id:String(i+1).padStart(20,'0'),team:{...queueTeam(),num:100+i}}));
   const offer={code:'AAAABBCCDD',players:roster},sessions=roster.map(p=>new OfficialSession(offer,p.id,mode,()=>{})),host=sessions[0];
   for(const s of sessions)s.relay.send=p=>{for(const other of sessions)if(other!==s&&!other.closed)other.receive(JSON.parse(JSON.stringify(p)));return true};
   for(const member of host.members.values())member.joined=true;
   host.start();assert(sessions.every(s=>s.config),'all players receive configuration');
   assert(host.started,'all clients ready before start');
   assert(host.config.owners.filter(Boolean).length===mode*2,'correct human roster size');
   assert(sessions.every(s=>s.run.me===s.run.m.robots[s.ownIndex]),'each player controls own bot');
   const guest=sessions[1];
   // Frames prove the start handshake before guests can submit commands.
   for(let i=0;i<6;i++)host.hostStep();for(const s of sessions.slice(1))while(s.guestStep()){}
   const foreign=host.config.owners.findIndex(x=>x&&x!==guest.id);guest.command(foreign,'p',8,8);assert(!host.pending.length,'cannot drive another human bot');
   guest.command(guest.ownIndex,'b','od');assert(host.pending.length===1,'own robot commands delivered');
   let ticks=0;document.hidden=true;
   while(!host.run.m.over&&ticks++<6000){host.hostStep();for(const s of sessions.slice(1))while(s.guestStep()){}}
   document.hidden=false;
   assert(sessions.every(s=>s.run.m.over),'every '+mode+'v'+mode+' client finishes');
   const snapshot=s=>JSON.stringify({n:s.run.n,score:[s.run.m.total('B'),s.run.m.total('T')],bots:s.run.m.robots.map(r=>[r.x,r.y,r.durability])});
   assert(sessions.every(s=>snapshot(s)===snapshot(host)),'all '+mode+'v'+mode+' positions, scores and wear agree');
   const before=SAVE.credits,reward=host.settle();assert(SAVE.credits===before+reward.total,'official reward paid');host.settle();assert(SAVE.credits===before+reward.total,'official reward paid only once');
   assert(SAVE.rec.played===1,'official record updated once');
   for(const s of sessions)s.closed=true;
   console.log('PASS: complete '+mode+'v'+mode+' synchronization, ownership, wear and idempotent rewards');
 }
};sessionChecks();
`,sandbox);
const html=fs.readFileSync('index.html','utf8');
if(!html.includes('let cr=practice?0:performanceCoins')||!html.includes('t.isPlayer&&!PENDING.practice?robotCondition(SAVE):100'))throw Error('Practice must award no coins and begin undamaged');
