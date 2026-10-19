/* Public discovery uses the configured Supabase relay. Matches are browser-hosted. */
const QUEUE_VERSION=3;
let MATCH_QUEUE=null;
const validQueueRP=rp=>Number.isSafeInteger(rp)&&rp>=0;
function rankedCandidates(players,id,count){
  const sorted=players.slice().sort((a,b)=>a.rp-b.rp||a.id.localeCompare(b.id)),groups=[];
  for(let i=0;i+count<=sorted.length;i++){
    const group=sorted.slice(i,i+count);
    if(group.some(p=>p.id===id)&&closeRanks(group[0].rp,group.at(-1).rp))groups.push(group);
  }
  groups.sort((a,b)=>(rankPosition(a.at(-1).rp)-rankPosition(a[0].rp))-(rankPosition(b.at(-1).rp)-rankPosition(b[0].rp))||a.map(p=>p.id).sort().join('').localeCompare(b.map(p=>p.id).sort().join('')));
  return (groups[0]||[]).sort((a,b)=>a.id.localeCompare(b.id));
}
function balancedRoster(players,mode){
  const host=players[0],rest=players.slice(1);let best=null,gap=Infinity;
  for(let mask=0;mask<1<<rest.length;mask++){
    const blue=[host,...rest.filter((_,i)=>mask>>i&1)];if(blue.length!==mode)continue;
    const red=rest.filter((_,i)=>!(mask>>i&1)),score=Math.abs(blue.reduce((n,p)=>n+rankPosition(p.rp),0)-red.reduce((n,p)=>n+rankPosition(p.rp),0));
    if(score<gap){gap=score;best=[...blue,...red]}
  }
  return best;
}
function queueTeam(){return onlineTeam({num:Number(SAVE.team.num),name:SAVE.team.name,build:myBuild(),color:SAVE.color,auto:autoById(SAVE.autoSel),material:materialOf(SAVE.material).id,condition:robotCondition(SAVE)},curYear())}
function sameQueueTeam(a,b,year){
  // Compare normalized values, not JSON text or transport key order. Tiny
  // floating-point differences in condition/path coordinates are immaterial.
  const same=(x,y)=>{
    if(typeof x==='number'&&typeof y==='number')return Math.abs(x-y)<=1e-6;
    if(x===y)return true;
    if(!x||!y||typeof x!=='object'||typeof y!=='object'||Array.isArray(x)!==Array.isArray(y))return false;
    const keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));
  };
  return same(onlineTeam(a,year),onlineTeam(b,year));
}
class PublicQueue{
  constructor(mode,status,found){
    this.mode=mode;this.status=status;this.found=found;this.id=onlineId();this.year=curYear();this.team=queueTeam();this.rp=Math.max(0,Math.floor(SAVE.trophies||0));this.players=new Map();this.closed=false;
    this.relay=new MatchRelay('QUEUE-'+QUEUE_VERSION+'-'+this.year+'-'+mode,p=>this.receive(p),e=>this.fail(e));
  }
  async connect(){await this.relay.connect();if(this.closed)return;this.pulse();this.timer=setInterval(()=>this.pulse(),1000)}
  send(kind,data={}){this.relay.send({q:QUEUE_VERSION,kind,id:this.id,year:this.year,mode:this.mode,...data})}
  pulse(){
    if(this.closed)return;
    const now=Date.now();
    if(this.committed){this.send('commit',{offer:this.offer});if(this.session?.started||now-this.commitAt>30000)this.close();return}
    this.players.set(this.id,{id:this.id,team:this.team,rp:this.rp,seen:now});
    for(const [id,p] of this.players)if(now-p.seen>6500)this.players.delete(id);
    if(this.offer&&now-this.offerAt>9000){
      if(this.offer.players[0].id===this.id){this.send('release',{code:this.offer.code});this.retries=(this.retries||0)+1;if(this.retries>=3){this.fail('Match confirmation timed out. Both players should reload the latest game version and search again.');return}}
      this.offer=null;this.accepted=null;
    }
    this.send('search',{team:this.team,rp:this.rp});
    const candidates=rankedCandidates([...this.players.values()],this.id,this.mode*2);
    let nearby=candidates.length;for(let count=this.mode*2-1;!nearby&&count>0;count--)nearby=rankedCandidates([...this.players.values()],this.id,count).length;
    this.status(this.offer?'Confirming players'+(this.accepted?' · '+this.accepted.size+' / '+this.mode*2:'')+'…':nearby+' / '+this.mode*2+' compatible players · searching');
    if(!this.offer&&candidates.length===this.mode*2&&candidates[0].id===this.id){this.offer={code:onlineId().slice(0,10).toUpperCase(),players:balancedRoster(candidates,this.mode).map(({id,team,rp})=>({id,team,rp}))};this.offerAt=now;this.accepted=new Set([this.id])}
    if(this.offer?.players[0].id===this.id){
      this.send('offer',{offer:this.offer});
      if(this.accepted.size===this.mode*2){this.committed=true;this.commitAt=now;this.send('commit',{offer:this.offer});this.launch()}
    }
  }
  receive(p){
    if(this.closed||!p||p.q!==QUEUE_VERSION||p.year!==this.year||p.mode!==this.mode||!/^[a-f0-9]{20}$/.test(p.id)||p.id===this.id)return;
    try{
      if(p.kind==='search'&&!this.committed&&(this.players.has(p.id)||this.players.size<128)&&validQueueRP(p.rp)&&closeRanks(p.rp,this.rp)){this.players.set(p.id,{id:p.id,team:onlineTeam(p.team,this.year),rp:p.rp,seen:Date.now()});return}
      if(p.kind==='cancel'){this.players.delete(p.id);if(this.offer?.players.some(x=>x.id===p.id)&&!this.committed){this.offer=null;this.accepted=null}return}
      if(p.kind==='release'&&!this.committed&&this.offer?.players[0].id===p.id&&this.offer.code===p.code){this.offer=null;this.accepted=null;return}
      if(p.kind==='decline'&&!this.committed&&p.host===this.id&&this.offer?.code===p.code&&this.offer.players.some(x=>x.id===p.id)){this.fail('A player could not confirm the robot loadout. Both players should reload the latest game version and search again.');return}
      if(p.kind==='offer'&&!this.committed){
        const o=p.offer;if(!o||!/^[A-F0-9]{10}$/.test(o.code)||!Array.isArray(o.players)||o.players.length!==this.mode*2||o.players[0].id!==p.id||new Set(o.players.map(x=>x.id)).size!==o.players.length||!o.players.some(x=>x.id===this.id))return;
        if(o.players.some(x=>!/^[a-f0-9]{20}$/.test(x.id)))return;
        if(o.players.some(x=>!validQueueRP(x.rp))||!closeRanks(Math.min(...o.players.map(x=>x.rp)),Math.max(...o.players.map(x=>x.rp)))||o.players.find(x=>x.id===this.id).rp!==this.rp)return;
        // A retry from the same leader replaces its old offer. Competing
        // leaders converge on the lower ID instead of locking each other out.
        if(this.offer&&this.offer.code!==o.code&&this.offer.players[0].id.localeCompare(p.id)<0)return;
        const own=o.players.find(x=>x.id===this.id);
        if(!sameQueueTeam(own.team,this.team,this.year)){this.send('decline',{code:o.code,host:p.id});this.fail('Your robot loadout could not be confirmed. Reload the latest game version and search again.');return}
        const players=o.players.map(x=>({id:x.id,team:onlineTeam(x.team,this.year),rp:x.rp}));
        this.offer={code:o.code,players};this.accepted=null;this.offerAt=Date.now();this.send('accept',{code:o.code,host:p.id});return;
      }
      if(p.kind==='accept'&&p.host===this.id&&this.offer?.code===p.code&&this.offer.players.some(x=>x.id===p.id)){this.accepted?.add(p.id);return}
      if(p.kind==='commit'&&!this.committed&&this.offer?.players[0].id===p.id&&p.offer?.code===this.offer.code){this.committed=true;this.launch();this.close()}
    }catch{/* Malformed discovery messages never enter a match. */}
  }
  launch(){if(this.session)return;try{this.session=this.found(this.offer,this.id,this.mode)}catch{this.fail('The match could not open. Cancel and search again.')}}
  fail(message){this.close();this.status(message+' You can retry the queue.')}
  close(){if(this.closed)return;if(!this.committed)this.send('cancel');this.closed=true;clearInterval(this.timer);this.relay.close()}
}
function screenMatchmaking(){
  MATCH_QUEUE?.close();MATCH_QUEUE=null;ONLINE?.close();ONLINE=null;PIT_SECTION=null;
  show('<main class="pad online-lobby"><button id="queue-back">'+ICONS.back+' Back to pit</button><h1>Official match</h1><p>Face other players. Each alliance always has three robots; AI fills the remaining slots.</p><div class="queue-modes" role="group" aria-label="Players per alliance">'+[1,2,3].map(n=>'<button data-mode="'+n+'" aria-pressed="'+(n===1)+'">'+n+'v'+n+'</button>').join('')+'</div><p id="queue-description">One player and two AI robots per alliance.</p><p>Earn coins for your contribution, objectives, result, and robot care. Damage carries back to the workbench.</p><button class="btn-primary" id="queue-start">Find match</button><p id="queue-status" role="status" aria-live="polite">Ready to search</p><button class="queue-cancel" id="queue-cancel" hidden>Cancel search</button><p class="muted">Players must be searching in the same season and mode, with similar RP progress. We wait for a close match instead of widening to distant ranks.</p></main>');
  const rank=document.createElement('div');rank.className='queue-rank';rank.innerHTML=rankBadge(SAVE.trophies)+'<p><strong>'+leagues()[leagueOf(SAVE.trophies)].name+'</strong> · '+SAVE.trophies+' RP<br><small>Searching for players close to your rank progress.</small></p>';app.querySelector('.queue-modes').before(rank);
  let mode=1;
  const status=t=>{if($('#queue-status'))$('#queue-status').textContent=t};
  const reset=()=>{MATCH_QUEUE?.close();MATCH_QUEUE=null;ONLINE?.close();ONLINE=null;screenMatchmaking()};
  $('#queue-back').onclick=()=>{MATCH_QUEUE?.close();ONLINE?.close();MATCH_QUEUE=null;ONLINE=null;screenPit()};BACK=$('#queue-back').onclick;
  $('#queue-cancel').onclick=reset;
  app.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=+b.dataset.mode;app.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#queue-description').textContent=mode===1?'One player and two AI robots per alliance.':mode===2?'Two players and one AI robot per alliance.':'Three players per alliance. Every robot has a human driver.'});
  $('#queue-start').onclick=async()=>{
    if(buildStats(myBuild()).weight>SV().weightLimit){status('Your robot exceeds the weight limit. Adjust it in the workbench.');return}
    $('#queue-start').disabled=true;app.querySelectorAll('[data-mode]').forEach(b=>b.disabled=true);$('#queue-cancel').hidden=false;status('Connecting to matchmaking…');
    const queue=MATCH_QUEUE=new PublicQueue(mode,status,(offer,id,n)=>{
      const session=ONLINE=new OfficialSession(offer,id,n,status);session.connect().catch(e=>session.fail(e.message));return session;
    });
    try{await queue.connect()}catch(e){if(MATCH_QUEUE===queue){queue.close();status(e.message+' Cancel and retry.')}}
  };
}
class OfficialSession extends FriendSession{
  constructor(offer,id,mode,status){
    super(offer.code,id===offer.players[0].id,status);
    this.id=id;this.mode=mode;this.roster=offer.players;this.hostId=this.roster[0].id;this.peer=this.host?null:this.hostId;this.official=true;
    this.localAlliance=this.roster.findIndex(p=>p.id===id)<mode?'B':'T';
    this.ownIndex=(this.localAlliance==='B'?0:3)+this.roster.findIndex(p=>p.id===id)%mode;
    this.members=new Map(this.roster.filter(p=>p.id!==id).map(p=>[p.id,{seen:Date.now(),joined:false,ready:false,ack:0,commandSeq:0}]));
    this.team=this.roster.find(p=>p.id===id).team;
    this.profile=SAVE;
  }
  canControl(index){return this.config?.owners[index]===this.id||(!this.config?.owners[index]&&this.run?.m.robots[index]?.A===this.localAlliance)}
  advanceClock(now){super.advanceClock(now);if(this.run?.m.over)this.settle()}
  guestStep(){const stepped=super.guestStep();if(this.run?.m.over)this.settle();return stepped}
  async connect(){await this.relay.connect();if(this.closed)return;this.status('Match found. Connecting all players…');this.pulse();this.timer=setInterval(()=>this.pulse(),1000)}
  send(kind,data={}){return this.relay.send({v:ONLINE_VERSION,from:this.id,to:this.host?null:this.hostId,kind,...data})}
  sendTo(to,kind,data={}){return this.relay.send({v:ONLINE_VERSION,from:this.id,to,kind,...data})}
  pulse(){
    if(this.closed)return;
    if(this.host){
      if([...this.members.values()].some(p=>Date.now()-p.seen>30000)){this.fail('A player disconnected. No rewards were awarded.');return}
      this.send('ping');
      if(!this.config&&[...this.members.values()].every(p=>p.joined))this.start();
      if(this.config&&!this.started)this.send('start',{config:this.config});
      if(this.started){this.send('go');for(const frame of this.frames)this.send('frame',{frame})}
    }else{
      if(Date.now()-this.lastSeen>30000){this.fail('The host disconnected. No rewards were awarded.');return}
      this.send('hello');if(this.config)this.send('ready');
      for(const item of this.outgoing)this.send('command',item);
    }
  }
  receive(p){
    if(this.closed||!p||p.v!==ONLINE_VERSION||p.from===this.id||(p.to&&p.to!==this.id)||!this.members.has(p.from))return;
    if(!this.host&&p.from!==this.hostId)return;
    const member=this.members.get(p.from);member.seen=Date.now();this.lastSeen=Date.now();
    try{
      if(p.kind==='leave'){while(!this.host&&this.guestStep()){}if(this.run?.m.over){this.settle();this.close();return}this.fail('A player left. No rewards were awarded.');return}
      if(p.kind==='ping'){this.send('pong');return}
      if(this.host&&p.kind==='hello'){member.joined=true;this.sendTo(p.from,'welcome');this.status('Players connected: '+(1+[...this.members.values()].filter(x=>x.joined).length)+' / '+this.mode*2);return}
      if(!this.host&&p.kind==='welcome'){this.status('Match found. Loading all players…');return}
      if(!this.host&&p.kind==='start'){if(!this.config)this.acceptConfig(p.config);this.send('ready');return}
      if(this.host&&p.kind==='ready'&&this.config){member.ready=true;if(!this.started&&[...this.members.values()].every(x=>x.ready)){this.started=true;this.send('go');screenOnlineMatch(this)}return}
      if(!this.host&&p.kind==='go'&&this.config){this.started=true;return}
      if(this.host&&p.kind==='command'&&this.started){
        if(!Number.isInteger(p.seq))return;
        if(p.seq<=member.commandSeq){this.sendTo(p.from,'commandAck',{seq:member.commandSeq});return}
        if(p.seq!==member.commandSeq+1||this.pending.length>=40)return;
        member.commandSeq=p.seq;const index=p.command?.robot,alliance=this.roster.findIndex(x=>x.id===p.from)<this.mode?'B':'T';
        if(this.config.owners[index]===p.from||(!this.config.owners[index]&&this.run.m.robots[index]?.A===alliance)||p.command?.type==='b'&&this.run.m.robots[index]?.A===alliance)this.pending.push({alliance,command:p.command,sender:p.from});
        this.sendTo(p.from,'commandAck',{seq:member.commandSeq});return;
      }
      if(!this.host&&p.kind==='commandAck'&&Number.isInteger(p.seq)&&p.seq<=this.commandSeq){this.outgoing=this.outgoing.filter(x=>x.seq>p.seq);return}
      if(this.host&&p.kind==='ack'&&Number.isInteger(p.seq)&&p.seq<=this.seq){member.ack=Math.max(member.ack,p.seq);this.ack=Math.min(...[...this.members.values()].map(x=>x.ack));this.frames=this.frames.filter(x=>x.seq>this.ack);return}
      if(!this.host&&p.kind==='frame'&&this.run){this.acceptFrame(p.frame);return}
      if(!this.host&&p.kind==='notice'&&typeof p.message==='string')toast(p.message.slice(0,120));
    }catch{this.fail('The match could not synchronize. Return to the pit and search again.')}
  }
  start(){
    if(this.config)return;
    const used=new Set(this.roster.map(x=>x.team.num)),bots=drawTeams(6-this.mode*2,used),teams=[],owners=[];let bot=0;
    for(const [side,A] of ['B','T'].entries())for(let slot=0;slot<3;slot++){
      const player=slot<this.mode?this.roster[side*this.mode+slot]:null;
      const t=onlineTeam(player?player.team:bots[bot++],this.year);
      teams.push({...t,A,slot,isPlayer:!!player,waypointAuto:t.auto?.version===2?t.auto:null,drawnPath:t.auto?.version===2?[]:t.auto?.path||[],autoPlan:t.auto?.steps||null});owners.push(player?.id||null);
    }
    this.config={year:this.year,seed:crypto.getRandomValues(new Uint32Array(1))[0],teams,owners,durability:1,mode:this.mode};
    this.run=new SimRun(this.year,teams,this.config.seed,{trophies:0,durability:1});this.run.me=this.run.m.robots[this.ownIndex];this.status('Loading all players…');this.send('start',{config:this.config});
  }
  acceptConfig(c){
    if(c?.year!==this.year||c.mode!==this.mode||c.durability!==1||!Number.isInteger(c.seed)||c.seed<0||c.seed>0xffffffff||!Array.isArray(c.teams)||c.teams.length!==6||!Array.isArray(c.owners)||c.owners.length!==6)throw Error('Invalid match');
    const expected=['B','T'].flatMap((A,side)=>[0,1,2].map(slot=>slot<this.mode?this.roster[side*this.mode+slot].id:null));
    if(JSON.stringify(c.owners)!==JSON.stringify(expected))throw Error('Invalid ownership');
    const teams=c.teams.map((t,i)=>{const clean=onlineTeam(t,this.year);if(t.slot!==i%3)throw Error('Invalid slot');return {...clean,A:i<3?'B':'T',slot:i%3,isPlayer:!!c.owners[i],waypointAuto:clean.auto?.version===2?clean.auto:null,drawnPath:clean.auto?.version===2?[]:clean.auto?.path||[],autoPlan:clean.auto?.steps||null}});
    this.config={...c,teams};this.run=new SimRun(this.year,teams,c.seed,{trophies:0,durability:1});this.run.me=this.run.m.robots[this.ownIndex];screenOnlineMatch(this);
  }
  command(robot,type,...args){
    if(this.closed||!this.started||(!this.canControl(robot)&&!(type==='b'&&this.run.m.robots[robot]?.A===this.localAlliance)))return;
    const command={robot,type,args};
    if(this.host){if(this.pending.length<40)this.pending.push({alliance:this.localAlliance,command,sender:this.id})}
    else if(this.outgoing.length<40){const item={seq:++this.commandSeq,command};this.outgoing.push(item);this.send('command',item)}
  }
  hostStep(){
    if(this.closed||!this.started||this.frames.length>=10||[...this.members.values()].some(p=>Date.now()-p.seen>4000))return false;
    if(!this.batch)this.batch={seq:++this.seq,from:this.run.n,commands:[]};
    for(const item of this.pending.splice(0)){const result=applyOnlineCommand(this.run,item.command,item.alliance,this.cooldowns);if(result?.msg){if(item.sender===this.id)toast(result.msg);else this.sendTo(item.sender,'notice',{message:result.msg})}else this.batch.commands.push({n:this.run.n,alliance:item.alliance,command:item.command})}
    this.run.step();
    if(this.run.n-this.batch.from>=6||this.run.m.over){this.batch.to=this.run.n;this.frames.push(this.batch);this.send('frame',{frame:this.batch});this.batch=null}
    if(this.run.m.over)this.settle();
    return true;
  }
  settle(){
    if(this.settled||!this.run?.m.over||this.closed)return this.reward;
    const m=this.run.m,r=m.robots[this.ownIndex],result=m.total(r.A)>m.total(r.A==='B'?'T':'B')?'win':m.total(r.A)<m.total(r.A==='B'?'T':'B')?'loss':'tie';
    const p=this.profile,rp=m.rpInfo(r.A).n,before=p.trophies,oldRank=leagueOf(before),matchId='online-'+this.year+'-'+this.code+'-'+this.config.seed;
    const existing=(p.matches||[]).find(x=>x.id===matchId);if(existing){this.settled=true;this.reward=existing.reward;return this.reward}
    this.reward=performanceCoins(m,r,result);p.credits+=this.reward.total;p.condition=robotCondition(r.durability);
    p.trophies+=rp;const newBanners=awardBanners(p,before,p.trophies);p.rec.played++;p.rec[result==='win'?'w':result==='loss'?'l':'t']++;p.rec.rp+=rp;p.rec.best=Math.max(p.rec.best,m.total(r.A));
    const data=onlineResultData(this),rank=leagueOf(p.trophies),side=s=>({col:s.name,color:s.color,total:s.score,foulRecv:s.fouls,extras:s.extras,bots:s.bots});
    const summary={id:matchId,date:Date.now(),official:true,mode:this.mode,practice:false,qual:p.rec.played,v:3,res:result,my:data.us.score,th:data.them.score,myColor:r.A==='B'?'blue':'red',us:side(data.us),them:side(data.them),cols:data.cols,rows:data.rows,chips:data.chips,rpN:rp,tr:rp,cr:this.reward.total,reward:this.reward,trophies:p.trophies,goal:levelGoal(rank,p),league:leagues(p)[oldRank].name,leagueAfter:leagues(p)[rank].name,promoted:rank>oldRank,newBanners,team:{num:p.team.num,name:p.team.name},auto:'Online autonomous',meText:m.meText(r,'Online autonomous'),season:{year:this.year,name:SEASONS[this.year].name},replay:null};
    p.matches=[summary,...(p.matches||[])].slice(0,100);p.updated=Date.now();this.settled=true;persist();return this.reward;
  }
  close(){
    if(this.closed)return;
    if(this.run?.m.over&&!this.settled)this.settle();
    if(this.run){const robot=this.run.m.robots[this.ownIndex];this.profile.condition=robotCondition(robot?.durability||robot?.tm);persist()}
    super.close();
  }
}
