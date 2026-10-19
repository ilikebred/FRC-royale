/* Friend matches: host-ordered simulation frames over Supabase Realtime broadcast.
   No account secrets, profile writes or ranked rewards travel through this channel. */
const ONLINE_VERSION=3;
class MatchRelay{
  constructor(code,onMessage,onError){this.code=code;this.onMessage=onMessage;this.onError=onError;this.ref=0;this.closed=false;this.joined=false}
  connect(){return new Promise((resolve,reject)=>{
    const socket=this.socket=new WebSocket(LB_URL.replace('https:','wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent(LB_KEY)+'&vsn=1.0.0');
    this.topic='realtime:frc-friends-v'+ONLINE_VERSION+'-'+this.code;
    const fail=message=>{if(this.closed)return;const joined=this.joined;this.close();if(joined)this.onError(message);else reject(new Error(message))};
    this.timeout=setTimeout(()=>fail('Could not connect. Check your connection and try again.'),12000);
    socket.onopen=()=>this.push('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:false}},'1');
    socket.onmessage=e=>{try{if(typeof e.data!=='string'||e.data.length>120000)return;const msg=JSON.parse(e.data);
      if(msg.event==='phx_reply'&&msg.ref==='1'){if(msg.payload.status!=='ok')return fail('Multiplayer service is unavailable. Please try again later.');clearTimeout(this.timeout);this.joined=true;this.heartbeat=setInterval(()=>this.push('heartbeat',{},null,'phoenix'),20000);resolve();return}
      if(msg.event==='phx_error'||msg.event==='phx_close')return fail('The room connection closed. Return to the pit and reconnect.');
      if(msg.event==='broadcast'&&msg.topic===this.topic&&msg.payload.event==='game')this.onMessage(msg.payload.payload);
    }catch{fail('The room received invalid data. Please reconnect.')}};
    socket.onerror=()=>fail('Unable to reach multiplayer. Check your connection.');socket.onclose=()=>fail('Disconnected from the room. This match does not count.');
  })}
  push(event,payload,ref=null,topic=this.topic){if(this.socket?.readyState!==1)return false;this.socket.send(JSON.stringify({topic,event,payload,ref:ref||String(++this.ref+1),join_ref:topic==='phoenix'?undefined:'1'}));return true}
  send(payload){return this.joined&&this.push('broadcast',{type:'broadcast',event:'game',payload})}
  close(){this.closed=true;clearTimeout(this.timeout);clearInterval(this.heartbeat);this.socket?.close();this.joined=false}
}
const onlineId=()=>{const a=new Uint8Array(10);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')};
function onlineTeam(raw,year){
  if(!raw||!Number.isInteger(raw.num)||raw.num<1||raw.num>999999||typeof raw.name!=='string'||raw.name.length>80||!/^#[0-9a-f]{6}$/i.test(raw.color))throw Error('Invalid robot');
  const build={};for(const slot of SEASONS[year].slots){const p=raw.build?.[slot];if(!p||!P(slot,p.id,year)||!Number.isInteger(p.lv)||p.lv<1||p.lv>5)throw Error('Invalid robot hardware');build[slot]={id:p.id,lv:p.lv}}
  if(buildStats(build).weight>SEASONS[year].weightLimit)throw Error('Robot exceeds the weight limit');
  let auto=null;
  if(raw.auto){const a=raw.auto;if(!['L','C','R'].includes(a.start)||!Array.isArray(a.steps)||a.steps.length>20||a.steps.some(k=>!Object.hasOwn(SEASONS[year].autoSteps,k)))throw Error('Invalid auto');
    auto={start:a.start,steps:a.steps.slice(),path:[]};
    if(a.version===2){if(year!==2026||!Object.hasOwn(AUTO_ENTRIES,a.entry)||!Array.isArray(a.path)||a.path.length>80)throw Error('Invalid route');
      auto={...auto,version:2,entry:a.entry,path:a.path.map(p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Object.hasOwn(WAYPOINT_ACTIONS,p.action||'move'))throw Error('Invalid point');return {x:p.x,y:p.y,action:p.action||'move',seconds:p.seconds??2}})};
      if(compileWaypointAuto(auto,buildStats(build)).error)throw Error('Invalid route');auto.start=AUTO_ENTRIES[auto.entry].slot;
    }else if(a.path?.length){if(!Array.isArray(a.path)||a.path.length>80||a.path.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>FW||p.y<0||p.y>FL))throw Error('Invalid route');auto.path=a.path.map(p=>({x:p.x,y:p.y}))}
  }
  return {num:raw.num,name:raw.name,build,color:raw.color,epa:null,auto,material:['alloy','reinforced','titanium'].includes(raw.material)?raw.material:'alloy',condition:Number.isFinite(raw.condition)?clamp(raw.condition,0,100):100};
}
// Commands include a robot index; alliance ownership and boost cooldowns are checked by the host.
function applyOnlineCommand(run,command,alliance,cooldowns){
  const m=run.m,{robot,type,args}=command||{},r=m.robots[robot];
  if(!Number.isInteger(robot)||!r||r.A!==alliance||!Array.isArray(args)||args.length>2||m.over)return {msg:'Invalid robot command'};
  if(!['p','u','b','g','w'].includes(type))return {msg:'Invalid command'};
  if(type==='p'&&(args.length!==2||!args.every(Number.isFinite)||args[0]<0||args[0]>FW||args[1]<0||args[1]>FL))return {msg:'Choose a point on the field'};
  if(type==='b'){
    const k=args[0];if(!SEASONS[run.year].boosts.some(b=>b.k===k))return {msg:'Unknown boost'};
    if(m.t<(cooldowns[alliance][k]||0))return {msg:'That boost is cooling down'};
    const gate=m.boostGate?.(k,r);if(gate&&!gate.ready)return {msg:gate.sub||'Boost is not ready'};
  }
  if(type==='g'&&args[0]!=null&&!SEASONS[run.year].game?.goalModes?.some(g=>g.k===args[0]))return {msg:'Invalid goal'};
  if(type==='w'&&args[0]!=null&&!(SEASONS[run.year].game?.pieceTypes||['hatch','cargo']).includes(args[0]))return {msg:'Invalid game piece'};
  const previous=run.me;run.me=r;let result;
  try{result=run.apply(type,type==='b'?[args[0],robot]:args)}finally{run.me=previous}
  if(type==='b'&&!result?.msg&&!m.boostGate?.(args[0],r))cooldowns[alliance][args[0]]=m.t+BOOST_CD;
  return result;
}
let ONLINE=null;
function screenOnline(){
  if(buildStats(myBuild()).weight>SV().weightLimit){toast('Your robot is too heavy to compete');return}
  ONLINE?.close();ONLINE=null;PIT_SECTION=null;
  show('<div class="pad online-lobby"><button id="online-back">'+ICONS.back+' Back to pit</button><h1>Play with a friend</h1><p>Lead opposing alliances in '+esc(SV().name)+'. Each player brings their robot and directs three allied bots.</p><p class="muted">Friendly matches · no coins or ranking points awarded. Both players need the same season and game version.</p><button class="btn-primary btn-big" id="room-create">Create room</button><label for="room-code">Have a room code?</label><div class="row"><input id="room-code" maxlength="12" placeholder="Enter room code" autocomplete="off" autocapitalize="characters" spellcheck="false"><button id="room-join">Join</button></div><p id="room-status" role="status"></p><div id="room-details" hidden></div></div>');
  $('#online-back').onclick=()=>{ONLINE?.close();ONLINE=null;screenPit()};BACK=$('#online-back').onclick;
  const status=text=>{if($('#room-status'))$('#room-status').textContent=text};
  const open=async host=>{
    const code=host?onlineId().slice(0,10).toUpperCase():$('#room-code').value.replace(/[\s-]/g,'').toUpperCase();
    if(!/^[A-F0-9]{10}$/.test(code)){status('Enter the 10-character room code from your friend.');return}
    $('#room-create').disabled=true;$('#room-join').disabled=true;status('Connecting…');
    let session;
    try{session=ONLINE=new FriendSession(code,host,status);await session.connect();if(ONLINE!==session)return;
      const details=$('#room-details');details.hidden=false;details.innerHTML='<p>Room code</p><strong class="room-code">'+code+'</strong><p id="room-opponent">Waiting for your friend…</p>'+(host?'<button class="btn-primary btn-big" id="room-start" disabled>Start match</button>':'<p>Waiting for the host to start.</p>');
      if(host)$('#room-start').onclick=()=>session.start();session.lobbyUpdate();
    }catch(e){if(session&&ONLINE!==session)return;session?.close();ONLINE=null;status(e.message);$('#room-create').disabled=false;$('#room-join').disabled=false}
  };
  $('#room-create').onclick=()=>open(true);$('#room-join').onclick=()=>open(false);$('#room-code').onkeydown=e=>{if(e.key==='Enter'&&!$('#room-join').disabled)open(false)};
}
class FriendSession{
  constructor(code,host,status){Object.assign(this,{code,host,status,id:onlineId(),peer:null,lastSeen:Date.now(),closed:false,started:false,seq:0,ack:0,frames:[],pending:[],commandSeq:0,lastCommand:0,outgoing:[],playback:[],received:0});this.team=onlineTeam({num:Number(SAVE.team.num),name:SAVE.team.name,build:myBuild(),color:SAVE.color,auto:autoById(SAVE.autoSel)},curYear());this.year=curYear();this.cooldowns={B:{},T:{}};this.relay=new MatchRelay(code,p=>this.receive(p),e=>this.fail(e))}
  async connect(){await this.relay.connect();if(this.closed)return;this.pulse();this.timer=setInterval(()=>this.pulse(),1000);this.status(this.host?'Share the room code with your friend.':'Looking for the host…')}
  send(kind,data={}){return this.relay.send({v:ONLINE_VERSION,from:this.id,to:this.peer,kind,...data})}
  pulse(){
    if(this.closed)return;
    if((this.peer||!this.host)&&Date.now()-this.lastSeen>30000){this.fail(this.peer?'Your opponent disconnected. The friendly match has ended.':'No opponent found. Check the room code and try again.');return}
    if(!this.peer&&!this.host)this.send('hello',{year:this.year,team:this.team});
    else this.send('ping');
    if(this.host&&this.config&&!this.started)this.send('start',{config:this.config});
    if(!this.host&&this.config&&!this.started)this.send('ready');
    if(!this.host&&this.started)for(const item of this.outgoing)this.send('command',item);
    if(this.host&&this.started)for(const frame of this.frames)this.send('frame',{frame});
  }
  lobbyUpdate(){if($('#room-opponent')&&this.peerTeam)$('#room-opponent').textContent='Opponent: '+this.peerTeam.num+' · '+this.peerTeam.name;if($('#room-start'))$('#room-start').disabled=!this.peer||!!this.config}
  receive(p){
    if(this.closed||!p||p.v!==ONLINE_VERSION||p.from===this.id||typeof p.from!=='string'||p.from.length!==20||(p.to&&p.to!==this.id))return;
    try{
      if(this.host&&p.kind==='hello'){
        if(this.peer&&this.peer!==p.from){this.relay.send({v:ONLINE_VERSION,from:this.id,to:p.from,kind:'reject',reason:'This room already has two players.'});return}
        if(p.year!==this.year){this.relay.send({v:ONLINE_VERSION,from:this.id,to:p.from,kind:'reject',reason:'Choose the same season as the host.'});return}
        this.peerTeam=onlineTeam(p.team,this.year);this.peer=p.from;this.lastSeen=Date.now();this.send('welcome',{year:this.year,team:this.team});this.lobbyUpdate();return;
      }
      if(!this.host&&!this.peer&&p.kind==='welcome'){if(p.year!==this.year)throw Error('Season mismatch');this.peerTeam=onlineTeam(p.team,this.year);this.peer=p.from;this.lastSeen=Date.now();this.lobbyUpdate();this.status('Connected. Waiting for the host.');return}
      if(!this.peer&&p.kind==='reject'){this.fail(p.reason==='This room already has two players.'?p.reason:'Choose the same season as the host.');return}
      if(p.from!==this.peer)return;this.lastSeen=Date.now();
      if(p.kind==='leave'){while(this.guestStep()){}if(this.run?.m.over){this.close();return}this.fail('Your opponent left. This friendly match does not count.');return}
      if(p.kind==='ping'){this.send('pong');return}
      if(p.kind==='notice'&&!this.host&&typeof p.message==='string'){toast(p.message.slice(0,120));return}
      if(p.kind==='start'&&!this.host&&!this.config){this.acceptConfig(p.config);this.send('ready');return}
      if(p.kind==='ready'&&this.host&&this.config&&!this.started){this.started=true;screenOnlineMatch(this);return}
      if(p.kind==='command'&&this.host&&this.started){if(!Number.isInteger(p.seq))return;if(p.seq<=this.lastCommand){this.send('commandAck',{seq:this.lastCommand});return}if(p.seq!==this.lastCommand+1||this.pending.length>=40)return;this.lastCommand=p.seq;this.pending.push({alliance:'T',command:p.command});this.send('commandAck',{seq:p.seq});return}
      if(p.kind==='commandAck'&&!this.host&&Number.isInteger(p.seq)&&p.seq<=this.commandSeq){this.outgoing=this.outgoing.filter(c=>c.seq>p.seq);return}
      if(p.kind==='ack'&&this.host&&Number.isInteger(p.seq)&&p.seq<=this.seq){this.ack=Math.max(this.ack,p.seq);this.frames=this.frames.filter(f=>f.seq>this.ack);return}
      if(p.kind==='frame'&&!this.host&&this.run){this.acceptFrame(p.frame);return}
    }catch{this.fail('The match could not synchronize. Return to the pit and create a new room.')}
  }
  start(){
    if(!this.peer||this.config)return;
    const used=new Set([this.team.num,this.peerTeam.num]),bots=drawTeams(4,used);
    if(bots.length!==4){this.status('Could not build the alliances. Try again.');return}
    const teams=[this.team,...bots.slice(0,2),this.peerTeam,...bots.slice(2)].map((t,i)=>({...onlineTeam(t,this.year),A:i<3?'B':'T',slot:i%3,isPlayer:i===0||i===3}));
    for(const base of [0,3]){const main=teams[base],slot={L:0,C:1,R:2}[main.auto?.start]??0,free=[0,1,2].filter(x=>x!==slot);main.slot=slot;teams[base+1].slot=free[0];teams[base+2].slot=free[1]}
    for(const t of teams){if(t.auto){t.waypointAuto=t.auto.version===2?t.auto:null;t.drawnPath=t.auto.version===2?[]:t.auto.path;t.autoPlan=t.auto.steps}}
    this.config={year:this.year,seed:crypto.getRandomValues(new Uint32Array(1))[0],teams};
    this.run=new SimRun(this.year,teams.map(t=>({...t,waypointAuto:t.waypointAuto||null,drawnPath:t.drawnPath||[],autoPlan:t.autoPlan||null})),this.config.seed,{trophies:0});this.lobbyUpdate();this.status('Waiting for your opponent to load…');this.send('start',{config:this.config});
  }
  acceptConfig(c){
    if(c?.year!==this.year||!Number.isInteger(c.seed)||c.seed<0||c.seed>0xffffffff||!Array.isArray(c.teams)||c.teams.length!==6)throw Error('Invalid match');
    const teams=c.teams.map((t,i)=>{if(![0,1,2].includes(t.slot))throw Error('Invalid slot');const clean=onlineTeam(t,this.year);return {...clean,A:i<3?'B':'T',slot:t.slot,isPlayer:i===0||i===3,waypointAuto:clean.auto?.version===2?clean.auto:null,drawnPath:clean.auto?.version===2?[]:clean.auto?.path||[],autoPlan:clean.auto?.steps||null}});
    if(new Set(teams.slice(0,3).map(t=>t.slot)).size!==3||new Set(teams.slice(3).map(t=>t.slot)).size!==3)throw Error('Duplicate slot');
    this.config={year:this.year,seed:c.seed,teams};this.run=new SimRun(this.year,teams,c.seed,{trophies:0});screenOnlineMatch(this);
  }
  startClock(){
    if(this.clockRunning||this.closed)return;
    this.clockRunning=true;this.clockLast=performance.now();this.clockDebt=0;
    const tick=()=>this.advanceClock(performance.now());
    try{this.clockWorker=new Worker('multiplayer-clock.js?v=34');this.clockWorker.onmessage=tick;this.clockWorker.onerror=()=>{this.clockWorker?.terminate();this.clockWorker=null;if(this.clockRunning&&!this.clockFallback)this.clockFallback=setInterval(tick,33)}}
    catch{this.clockFallback=setInterval(tick,33)}
    this.clockVisibility=tick;document.addEventListener('visibilitychange',tick);
  }
  advanceClock(now){
    if(!this.clockRunning||this.closed||this.run.m.over){if(this.run?.m.over)this.stopClock();return}
    const elapsed=Math.max(0,(now-this.clockLast)/1000);this.clockLast=now;
    if(!this.started){this.clockDebt=0;return}
    // Preserve elapsed time through throttled wakeups. Limit each task's work,
    // retaining the remainder so it catches up without blocking the UI.
    this.clockDebt=Math.min(30,(this.clockDebt||0)+elapsed);
    let steps=0;
    while(this.clockDebt+1e-9>=1/30&&steps++<120&&!this.run.m.over){
      if(!(this.host?this.hostStep():this.guestStep())){
        if(!this.host)this.clockDebt=0; // Guest time is bounded by host frames.
        break;
      }
      this.clockDebt=Math.max(0,this.clockDebt-1/30);
    }
    if(this.run.m.over)this.stopClock();
  }
  stopClock(){
    this.clockRunning=false;this.clockWorker?.terminate();this.clockWorker=null;clearInterval(this.clockFallback);this.clockFallback=null;
    if(this.clockVisibility)document.removeEventListener('visibilitychange',this.clockVisibility);this.clockVisibility=null;
  }
  command(robot,type,...args){const command={robot,type,args};if(this.closed||!this.started||Date.now()-this.lastSeen>4000)return;if(this.host){if(this.pending.length<40)this.pending.push({alliance:'B',command})}else if(this.outgoing.length<40){const item={seq:++this.commandSeq,command};this.outgoing.push(item);this.send('command',item)}}
  hostStep(){
    if(this.closed||!this.started||this.frames.length>=10||Date.now()-this.lastSeen>4000)return false;
    if(!this.batch)this.batch={seq:++this.seq,from:this.run.n,commands:[]};
    for(const item of this.pending.splice(0)){const result=applyOnlineCommand(this.run,item.command,item.alliance,this.cooldowns);if(result?.msg){if(item.alliance==='B')toast(result.msg);else this.send('notice',{message:result.msg})}else this.batch.commands.push({n:this.run.n,...item})}
    this.run.step();
    if(this.run.n-this.batch.from>=6||this.run.m.over){this.batch.to=this.run.n;this.frames.push(this.batch);this.send('frame',{frame:this.batch});this.batch=null}
    return true;
  }
  acceptFrame(f){
    if(!f||!Number.isInteger(f.seq)||f.seq<1)return;
    if(f.seq<=this.received){this.send('ack',{seq:this.ack});return}
    if(f.seq!==this.received+1){this.send('ack',{seq:this.ack});return}
    const expected=this.playback.length?this.playback.at(-1).to:this.run.n;
    if(f.from!==expected||!Number.isInteger(f.to)||f.to<=f.from||f.to-f.from>6||!Array.isArray(f.commands)||f.commands.length>240||this.playback.length>=10)throw Error('Invalid frame');
    if(f.commands.some(c=>!Number.isInteger(c.n)||c.n<f.from||c.n>=f.to||!['B','T'].includes(c.alliance)))throw Error('Invalid input');
    this.started=true;this.received=f.seq;this.playback.push(f);
    // A hidden guest must acknowledge frames even when no paint callbacks run.
    if(document.hidden){while(this.guestStep()){}if(this.run.m.over)this.stopClock()}
  }
  guestStep(){
    const f=this.playback[0];if(this.host||!f||this.closed)return false;
    for(const c of f.commands.filter(c=>c.n===this.run.n))applyOnlineCommand(this.run,c.command,c.alliance,this.cooldowns);
    this.run.step();if(this.run.n===f.to){this.playback.shift();this.ack=f.seq;this.send('ack',{seq:this.ack})}return true;
  }
  fail(message){if(this.closed)return;this.close();this.status(message);if($('#online-state'))$('#online-state').textContent=message;if($('#room-start'))$('#room-start').disabled=true;if($('#room-create'))$('#room-create').disabled=false;if($('#room-join'))$('#room-join').disabled=false}
  close(){if(this.closed)return;this.send('leave');this.closed=true;this.stopClock();clearInterval(this.timer);this.relay.close()}
}
function screenOnlineMatch(session){
  const run=session.run,m=run.m,A=session.localAlliance||(session.host?'B':'T'),own=session.official?m.robots[session.ownIndex]:m.robots.find(r=>r.A===A&&r.isPlayer),SS=SEASONS[session.year],AC={B:'#3E8BFF',T:'#E5484D'};let selected=own;
  show('<div class="online-match"><div class="mhud"><div class="sb" style="background:'+AC[A]+'"><span class="l">Your alliance</span><span class="s" id="online-us">0</span></div><div class="clock"><span class="t" id="online-clock">'+fmtT(m.R.auto)+'</span><span class="p" id="online-phase">AUTO</span></div><div class="sb" style="background:'+AC[A==='B'?'T':'B']+'"><span class="l">Opponent</span><span class="s" id="online-them">0</span></div></div><div class="hubline online-shifts"><div class="hubpill" id="online-hub-us"><span>YOU</span><span class="hub-text"></span></div><div class="hubpill" id="online-hub-them"><span>THEM</span><span class="hub-text"></span></div></div><div class="hubline"><span id="online-state" role="status">Connecting players…</span><button id="online-leave">Leave</button>'+soundBtn()+'</div><div class="fieldwrap"><canvas id="online-field" tabindex="0" aria-label="Match field. Select an allied robot below, then click to add route points."></canvas></div><div class="online-team" role="group" aria-label="Robot to direct">'+m.robots.filter(r=>r.A===A).map(r=>'<button data-robot="'+m.robots.indexOf(r)+'" aria-pressed="'+(r===own)+'">'+r.tm.num+(r===own?' · You':'')+'</button>').join('')+'<button id="online-undo">Undo point</button></div><div class="boosts">'+SS.boosts.map(b=>'<button data-b="'+b.k+'" class="boost-'+b.k+'"><span class="bn">'+b.name+'</span><small class="bs">'+b.sub+'</small><span class="cd"></span></button>').join('')+'</div><p class="online-help">Select a robot to direct its route. Click a boost for your robot; drag it onto any ally. Friendly match · '+session.code+'</p></div>');
  Music.play('match');wireSound();FieldAudio.start(session.year===2026?m:null);
  const updateCondition=durabilityHUD(app,own);
  if(session.official){app.querySelector('.online-help').textContent='Official '+session.mode+'v'+session.mode+' · Drive your robot or AI allies. Drag boosts onto any ally.';app.querySelectorAll('[data-robot]').forEach(b=>{if(!session.canControl(+b.dataset.robot)){b.disabled=true;b.title='Controlled by your teammate'}})}
  const leave=()=>{session.close();ONLINE=null;screenPit()};$('#online-leave').onclick=leave;BACK=leave;
  const cv=$('#online-field'),ctx=cv.getContext('2d'),dpr=Math.min(devicePixelRatio||1,1.5),wide=false;let scale=10;
  if(wide)rotCtx(ctx);ctx._rot=wide;
  const fit=()=>{const reserved=[...app.querySelectorAll('.mhud,.hubline,.online-team,.boosts,.online-help')].reduce((sum,el)=>sum+el.offsetHeight,20),w=wide?FL:FW,h=wide?FW:FL;scale=Math.max(1,Math.min((app.clientWidth-24)/w,(innerHeight-reserved)/h));cv.style.width=w*scale+'px';cv.style.height=h*scale+'px';cv.width=Math.round(w*scale*dpr);cv.height=Math.round(h*scale*dpr)};fit();window.onresize=fit;
  const project=(x,y)=>{const p=session.year===2026?arenaProject(x,y):{x,y};return wide?{x:p.y*scale,y:(FW-p.x)*scale}:{x:p.x*scale,y:p.y*scale}};
  const send=(r,type,...args)=>session.command(m.robots.indexOf(r),type,...args);
  const drag=wireBoostDrag({canvas:cv,own,robots:m.robots,project,activate:(k,r)=>send(r,'b',k)});
  cv.onpointerdown=e=>{if(e.button!==0)return;if(m.t<m.R.auto){toast('Robot routes unlock in TELEOP');return}const rc=cv.getBoundingClientRect(),x=(e.clientX-rc.left)/scale,y=(e.clientY-rc.top)/scale,p=wide?{x:FW-y,y:x}:{x,y},q=session.year===2026?arenaUnproject(p.x,p.y):p;send(selected,'p',+q.x.toFixed(3),+q.y.toFixed(3))};
  cv.oncontextmenu=e=>{e.preventDefault();send(selected,'u')};$('#online-undo').onclick=()=>send(selected,'u');
  app.querySelectorAll('[data-robot]').forEach(b=>b.onclick=()=>{selected=m.robots[+b.dataset.robot];app.querySelectorAll('[data-robot]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  session.startClock();
  const loop=now=>{
    if(ONLINE!==session)return;
    if(m.over){screenOnlineResults(session);return}updateCondition();
    ctx.setTransform(dpr,0,0,dpr,0,0);if(wide){ctx.translate(0,FW*scale);ctx.rotate(-Math.PI/2)}m.renderAlpha=Math.min(1,Math.max(0,(performance.now()-session.clockLast)/1000+(session.clockDebt||0))*30);m.draw(ctx,scale,AC,selected);PerformanceUI.tick(now);ctx.setTransform(dpr,0,0,dpr,0,0);drag.draw(ctx,scale);
    const ph=m.phase();$('#online-us').textContent=m.total(A);$('#online-them').textContent=m.total(A==='B'?'T':'B');$('#online-clock').textContent=fmtT(ph.clock);$('#online-phase').textContent=m.over?'FINAL':ph.name;
    for(const [id,alliance] of [['online-hub-us',A],['online-hub-them',A==='B'?'T':'B']]){const pill=$('#'+id),hud=m.hud(alliance);pill.classList.toggle('on',hud.on);pill.style.background=hud.on?AC[alliance]:'';pill.querySelector('.hub-text').textContent=hud.text}
    if(!session.closed)$('#online-state').textContent=Date.now()-session.lastSeen>4000?'Waiting for opponent connection…':session.started?'Live · '+(A==='B'?'Blue':'Red')+' alliance':'Waiting for host…';
    app.querySelectorAll('[data-b]').forEach(b=>{const left=(session.cooldowns[A][b.dataset.b]||0)-m.t;b.disabled=session.closed||!session.started||m.over||left>0;b.querySelector('.bs').textContent=left>0?'Ready in '+Math.ceil(left)+'s':SS.boosts.find(x=>x.k===b.dataset.b).sub});
    RAF=requestAnimationFrame(loop);
  };RAF=requestAnimationFrame(loop);
}

function onlineResultData(session){
  const m=session.run.m,A=session.localAlliance||(session.host?'B':'T'),O=A==='B'?'T':'B',own=session.official?m.robots[session.ownIndex]:m.robots.find(r=>r.A===A&&r.isPlayer),colors={B:'#3E8BFF',T:'#E5484D'};
  const side=alliance=>({color:colors[alliance],name:alliance==='B'?'Blue':'Red',score:m.total(alliance),extras:m.sideExtras(alliance),fouls:m.sc[alliance==='B'?'T':'B'].foul,bots:m.robots.filter(r=>r.A===alliance).map(r=>({...m.robotLine(r),you:r===own})).sort((a,b)=>b.pts-a.pts)});
  const us=side(A),them=side(O);
  return {us,them,result:us.score>them.score?'win':us.score<them.score?'loss':'tie',rows:m.breakdown(A,O),cols:m.contribCols,chips:m.rpInfo(A).chips};
}
function screenOnlineResults(session){
  session.stopClock();FieldAudio.stop();Music.stop();
  const data=onlineResultData(session),{us,them,result}=data;
  const reward=session.official?session.settle():null;
  Music.jingle(result==='win');
  const contribution=(side,label)=>`<div class="card contrib"><div class="row"><b class="disp grow" style="color:${side.color}">${label} · ${side.name.toUpperCase()}</b><b class="disp" style="font-size:24px">${side.score}</b></div><table class="ct"><thead><tr><th>Team</th>${data.cols.map(c=>`<th>${esc(c)}</th>`).join('')}<th>Pts</th></tr></thead><tbody>${side.bots.map(b=>`<tr class="${b.you?'you':''}"><td><b class="disp">${b.num}</b>${b.you?' <span class="tag fuel">YOU</span>':''}<div class="tn">${esc(b.name)}</div></td>${b.c.map(c=>`<td>${c[0]}<div class="tn">${esc(String(c[1]))}</div></td>`).join('')}<td><b>${b.pts}</b>${b.fouls?`<div class="tn">${b.fouls} fouls</div>`:''}</td></tr>`).join('')}${side.extras.map(e=>`<tr class="sub"><td>${esc(e[0])}</td><td>${e[1]}</td><td>—</td><td><b>${e[1]}</b></td></tr>`).join('')}${side.fouls?`<tr class="sub"><td>Foul points from opponents</td><td>—</td><td>—</td><td><b>${side.fouls}</b></td></tr>`:''}</tbody></table></div>`;
  show(`<div class="online-summary"><div class="brandbar"><div class="blogo">FRC Royale</div><div class="tag">${session.year} · ${esc(SEASONS[session.year].name)}</div></div><div class="banner"><h1 style="color:${result==='win'?'var(--ok)':result==='loss'?'var(--red)':'var(--fuel)'}">${result==='win'?'VICTORY':result==='loss'?'DEFEAT':'TIE'}</h1><div class="final"><span style="color:${us.color}">${us.score}</span><span class="muted" style="font-size:20px">–</span><span style="color:${them.color}">${them.score}</span></div><p class="muted">Friendly match complete</p></div><div class="pad col">${contribution(us,'Your alliance')}${contribution(them,'Opponents')}<div class="card"><table class="bd"><thead><tr><th>Score breakdown</th><th style="color:${us.color}">YOU</th><th style="color:${them.color}">THEM</th></tr></thead><tbody>${data.rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}<tr><td><b>TOTAL</b></td><td><b>${us.score}</b></td><td><b>${them.score}</b></td></tr></tbody></table></div><div class="card col"><b class="disp">Match objectives</b><div class="rp">${data.chips.map(c=>`<span class="${c[1]?'got':''}">${esc(c[0])}</span>`).join('')}</div><p class="muted">Friendly matches do not award coins or ranking points.</p></div><div class="row"><button class="grow" id="online-result-pit">Pit</button><button class="btn-primary grow" id="online-result-again">Play with a friend</button></div></div></div>`);
  const exit=next=>{session.close();if(ONLINE===session)ONLINE=null;next()};
  if(session.official){
    app.querySelector('.banner p').textContent='Official '+session.mode+'v'+session.mode+' match complete';
    const rank=document.createElement('div');rank.className='rank-result';rank.innerHTML=rankBadge(session.profile.trophies)+'<span><strong>'+leagues(session.profile)[leagueOf(session.profile.trophies)].name+'</strong><br>+'+session.run.m.rpInfo(session.localAlliance).n+' RP · '+session.profile.trophies+' total RP</span>';app.querySelector('.banner').append(rank);
    const note=app.querySelector('.card.col p');if(note)note.textContent=reward?'+'+reward.total+' coins · Contribution '+reward.performance+' · Result '+reward.outcome+' · Objectives '+reward.objectives+' · Robot care '+reward.care+' · Fouls −'+reward.fouls+'. Condition: '+Math.ceil(robotCondition(session.run.m.robots[session.ownIndex].durability))+'%. Repair in the workbench.':'Match ended without rewards.';
    $('#online-result-again').textContent='Find next match';
  }
  $('#online-result-pit').onclick=()=>exit(screenPit);$('#online-result-again').onclick=()=>exit(session.official?screenMatchmaking:screenOnline);BACK=()=>exit(screenPit);
}
