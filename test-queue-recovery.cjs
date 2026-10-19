const fs=require('fs');
const bootstrap=fs.readFileSync('test.cjs','utf8').split('const packedClips=')[0];
const {sandbox,vm}=new Function('require',bootstrap+';return {sandbox,vm}')(require);
for(const file of ['waypoint-auto.js','boost-targeting.js','multiplayer.js','gameplay.js','matchmaking.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
vm.runInContext(`
const assert=(v,m)=>{if(!v)throw Error(m)};
SAVE=freshSave(2026);SAVE.team={num:254,name:'Queue regression'};
const make=id=>{const q=new PublicQueue(1,message=>q.message=message,()=>({started:false}));q.id=id;q.sent=[];q.send=(kind,data={})=>q.sent.push({kind,...data});return q};
const a='00000000000000000001',b='00000000000000000002',c='00000000000000000003';
const packet=(id,kind,data)=>({id,kind,q:QUEUE_VERSION,year:2026,mode:1,...data});
const offer=(host,guest,code,team=guest.team)=>packet(host,'offer',{offer:{code,players:[{id:host,team:queueTeam(),rp:0},{id:guest.id,team,rp:guest.rp}]}});
// The host retried, but the guest still remembers the expired proposal.
const guest=make(c);guest.receive(offer(a,guest,'AAAAAAAAAA'));guest.receive(offer(a,guest,'BBBBBBBBBB'));
assert(guest.offer.code==='BBBBBBBBBB'&&guest.sent.at(-1).kind==='accept','same leader retry replaces the stale offer');
// Two leaders can discover partially overlapping groups at different times.
const race=make(c);race.receive(offer(b,race,'CCCCCCCCCC'));race.receive(offer(a,race,'DDDDDDDDDD'));race.receive(offer(b,race,'EEEEEEEEEE'));
assert(race.offer.players[0].id===a,'competing offers converge on one leader');
race.receive(packet(a,'release',{code:'DDDDDDDDDD'}));assert(!race.offer,'release unlocks followers immediately');
// Transport reorders object keys and can round floating point values.
const reordered=JSON.parse(JSON.stringify(guest.team,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).reverse()):v));
reordered.condition-=1e-8;assert(sameQueueTeam(reordered,guest.team,2026),'equivalent loadout accepts key order and harmless precision changes');
reordered.condition=40;assert(!sameQueueTeam(reordered,guest.team,2026),'meaningful loadout changes remain rejected');
const mismatch=make(c);mismatch.receive(offer(a,mismatch,'FFFFFFFFFF',reordered));assert(mismatch.closed&&mismatch.sent.some(p=>p.kind==='decline')&&mismatch.message.includes('Reload'),'invalid loadout produces an actionable error rather than an endless loop');
// Repeated missing confirmations must terminate with a recovery action.
const leader=make(a),realNow=Date.now;let now=100000;Date.now=()=>now;
try{
 for(let n=0;n<4&&!leader.closed;n++){leader.players.set(b,{id:b,team:queueTeam(),rp:0,seen:now});leader.pulse();now+=10000}
 assert(leader.closed&&leader.message.includes('timed out'),'confirmation retries are bounded');
 assert(leader.sent.some(p=>p.kind==='release'),'expired host offers are explicitly released');
}finally{Date.now=realNow}
const launch=make(c);launch.found=()=>{throw Error('fixture startup failure')};launch.launch();assert(launch.closed&&launch.message.includes('could not open'),'launch errors do not get silently swallowed');
console.log('PASS: stale-offer retries, competing leaders, explicit release, transport normalization, mismatch diagnostics, bounded retries and startup failure');
`,sandbox);
