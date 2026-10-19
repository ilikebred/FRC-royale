const fs=require('fs');
const bootstrap=fs.readFileSync('test.cjs','utf8').split('const packedClips=')[0];
const {sandbox,vm}=new Function('require',bootstrap+';return {sandbox,vm}')(require);
Object.assign(sandbox,{WebSocket,setTimeout,clearTimeout,setInterval,clearInterval});
for(const file of ['waypoint-auto.js','boost-targeting.js','multiplayer.js','gameplay.js','matchmaking.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
vm.runInContext("SAVE=freshSave(2026);SAVE.team={num:999999,name:'Relay test'};screenOnlineMatch=()=>{};persist=()=>{};globalThis.Queue=PublicQueue;globalThis.Session=OfficialSession",sandbox);
(async()=>{
 for(const mode of [1,2,3]){
  const found=[],queues=[],sessions=[],channel='TEST-QUEUE-'+Date.now()+'-'+mode;
  let resolve;const done=new Promise(r=>resolve=r);
  for(let i=0;i<mode*2;i++){
   let lastStatus='';const status=message=>{if(message!==lastStatus){console.log('client '+i+': '+message);lastStatus=message}};
   const q=new sandbox.Queue(mode,status,(offer,id)=>{found.push({code:offer.code,id});if(found.length===mode*2)resolve();const session=new sandbox.Session(offer,id,mode,status);sessions.push(session);session.connect().catch(e=>session.fail(e.message));return session});
   q.team.condition=97.12345678901234+i*.001;
   q.relay.code=channel;queues.push(q);
  }
  let timeout;
  try{
   await Promise.all(queues.map(q=>q.connect()));
   await Promise.race([done,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Live '+mode+'v'+mode+' queue timed out')),18000))]);
   if(new Set(found.map(x=>x.code)).size!==1||new Set(found.map(x=>x.id)).size!==mode*2)throw Error('Queue consensus failed');
   const deadline=Date.now()+20000;
   while(sessions.some(s=>!s.started)&&Date.now()<deadline){if(sessions.some(s=>s.closed))throw Error('Session closed during room handoff');await new Promise(r=>setTimeout(r,100))}
   if(sessions.some(s=>!s.started||!s.run))throw Error('Full queue did not start a match');
   const host=sessions.find(s=>s.host);for(let i=0;i<6;i++)host.hostStep();
   const frameDeadline=Date.now()+5000;
   while(sessions.some(s=>s.run.n<6)&&Date.now()<frameDeadline){for(const s of sessions)if(!s.host)while(s.guestStep()){}await new Promise(r=>setTimeout(r,50))}
   if(sessions.some(s=>s.run.n!==6))throw Error('Match started without synchronized gameplay');
   console.log('PASS: '+mode*2+' live Supabase clients matched, joined, started and synchronized a '+mode+'v'+mode+' game');
  }finally{clearTimeout(timeout);for(const q of queues)q.close();for(const s of sessions){s.run=null;s.close()}}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
