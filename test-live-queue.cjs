const fs=require('fs');
const bootstrap=fs.readFileSync('test.cjs','utf8').split('const packedClips=')[0];
const {sandbox,vm}=new Function('require',bootstrap+';return {sandbox,vm}')(require);
Object.assign(sandbox,{WebSocket,setTimeout,clearTimeout,setInterval,clearInterval});
for(const file of ['waypoint-auto.js','boost-targeting.js','multiplayer.js','gameplay.js','matchmaking.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
vm.runInContext("SAVE=freshSave(2026);SAVE.team={num:999999,name:'Relay test'};globalThis.Queue=PublicQueue",sandbox);
(async()=>{
 for(const mode of [1,2,3]){
  const found=[],queues=[],channel='TEST-QUEUE-'+Date.now()+'-'+mode;
  let resolve;const done=new Promise(r=>resolve=r);
  for(let i=0;i<mode*2;i++){
   let lastStatus='';const q=new sandbox.Queue(mode,message=>{if(message!==lastStatus){console.log('client '+i+': '+message);lastStatus=message}},(offer,id)=>{found.push({code:offer.code,id});if(found.length===mode*2)resolve();return {started:true}});
   q.relay.code=channel;queues.push(q);
  }
  let timeout;
  try{
   await Promise.all(queues.map(q=>q.connect()));
   await Promise.race([done,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Live '+mode+'v'+mode+' queue timed out')),18000))]);
   if(new Set(found.map(x=>x.code)).size!==1||new Set(found.map(x=>x.id)).size!==mode*2)throw Error('Queue consensus failed');
   console.log('PASS: '+mode*2+' live Supabase clients agreed on a '+mode+'v'+mode+' match');
  }finally{clearTimeout(timeout);for(const q of queues)q.close()}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
