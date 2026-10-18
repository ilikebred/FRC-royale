/* Local FRC phase clips plus synthesized robot sounds. See sounds/README.md. Audio never consumes simulation RNG. */
const FieldAudio=(()=>{
  let settings={enabled:true,volume:.55};try{Object.assign(settings,JSON.parse(localStorage.getItem('royale-field-audio')||'{}'))}catch{}
  settings.volume=Number.isFinite(settings.volume)?clamp(settings.volume,0,1):.55;
  let ctx,bus,noise,timer,match=null,drive=[],voices=new Set(),last=new Map();
  let generation=0;
  const clips={start:'frc-start-sound',autoEnd:'frc-end',end:'frc-end',resume:'frc-resume',endgame:'frc-warning'},loading=new Map();
  function loadClips(){
    if(!ctx?.decodeAudioData)return;
    for(const name of new Set(Object.values(clips)))if(!loading.has(name)){
      const encoded=typeof FIELD_CLIPS!=='undefined'&&FIELD_CLIPS[name];
      const bytes=encoded?Promise.resolve(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer):
        (typeof fetch==='function'?fetch('sounds/'+name+'.mp3').then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer()}):Promise.reject(Error('Audio unavailable')));
      loading.set(name,bytes.then(data=>ctx.decodeAudioData(data)).catch(()=>null));
    }
  }
  function playClip(kind){
    const name=clips[kind];if(!name||!loading.has(name))return false;
    const token=generation,requested=ctx.currentTime;
    Promise.all([loading.get(name),loading.get(clips.autoEnd)]).then(([buffer,endBuffer])=>{
      if(!buffer||token!==generation||!settings.enabled||document.hidden||ctx.state!=='running'||ctx.currentTime-requested>2)return;
      const source=ctx.createBufferSource();source.buffer=buffer;source.connect(bus);voices.add(source);
      source.onended=()=>{voices.delete(source);source.disconnect()};
      source.start(Math.max(ctx.currentTime,requested)+(kind==='resume'?(endBuffer?.duration||0)+.08:0));
    });
    return true;
  }
  const persist=()=>{try{localStorage.setItem('royale-field-audio',JSON.stringify(settings))}catch{}};
  function init(){
    if(ctx)return true;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    try{ctx=new Audio();bus=ctx.createGain();bus.gain.value=settings.enabled?settings.volume:0;
      const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.15;bus.connect(limiter);limiter.connect(ctx.destination);
      noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const data=noise.getChannelData(0);let seed=89273;
      for(let i=0;i<data.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;data[i]=(seed>>>0)/2147483648-1}
      loadClips();return true;
    }catch{ctx=null;return false}
  }
  const resume=()=>ctx?.state==='suspended'&&!document.hidden?ctx.resume().catch(()=>{}):Promise.resolve();
  function unlock(){return init()?resume():Promise.resolve()}
  function stopDrives(){for(const v of drive){for(const n of v.sources){try{n.stop()}catch{}n.disconnect()}v.gain.disconnect();v.filter.disconnect();v.roadGain.disconnect()}drive=[]}
  function stop(){generation++;match=null;if(timer)clearInterval(timer);timer=null;stopDrives();for(const v of voices){try{v.stop()}catch{}}voices.clear();last.clear()}
  function voice(kind,freq,end,duration,level,pan=0,delay=0){
    if(!ctx||voices.size>=18)return;
    const t=ctx.currentTime+delay,src=kind==='noise'?ctx.createBufferSource():ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    if(kind==='noise'){src.buffer=noise;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.7}else{src.type=kind;src.frequency.setValueAtTime(freq,t);src.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);filter.type='lowpass';filter.frequency.value=2600}
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(level,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    src.connect(filter);filter.connect(gain);let panner;
    if(ctx.createStereoPanner){panner=ctx.createStereoPanner();panner.pan.value=clamp(pan,-.8,.8);gain.connect(panner);panner.connect(bus)}else gain.connect(bus);
    voices.add(src);src.onended=()=>{voices.delete(src);src.disconnect();filter.disconnect();gain.disconnect();panner?.disconnect()};src.start(t);src.stop(t+duration+.02);
  }
  function emit(kind,x=13.5){
    if(!settings.enabled||!ctx||ctx.state!=='running'||document.hidden)return;
    const now=ctx.currentTime,interval={score:.055,miss:.11,launch:.09,dump:.1,intake:.16}[kind]??.25;
    if(now-(last.get(kind)??-Infinity)<interval)return;last.set(kind,now);
    if(playClip(kind))return;
    const pan=(x/27-.5)*1.2;
    if(kind==='score'){voice('sine',145,48,.17,.34,pan);voice('noise',430,0,.065,.12,pan)}
    if(kind==='miss'){voice('sine',210,95,.09,.12,pan)}
    if(kind==='launch'){voice('noise',1800,0,.12,.12,pan);voice('triangle',540,230,.13,.09,pan)}
    if(kind==='dump'){voice('noise',650,0,.09,.15,pan);voice('sine',190,65,.1,.14,pan)}
    if(kind==='intake'){voice('noise',900,0,.055,.065,pan);voice('sine',170,100,.06,.08,pan)}
    if(kind==='start'||kind==='resume'){for(let i=0;i<3;i++)voice('triangle',600+i*150,600+i*150,.13,.16,0,i*.15)}
    if(kind==='shift'||kind==='endgame'){for(let i=0;i<2;i++){voice('sawtooth',330,310,.19,.09,0,i*.28);voice('sine',490,470,.19,.09,0,i*.28)}}
    if(kind==='end'||kind==='autoEnd'){voice('sawtooth',260,210,.55,.10);voice('sine',390,315,.55,.12)}
  }
  function makeDrive(type){
    const gain=ctx.createGain(),filter=ctx.createBiquadFilter(),motor=ctx.createOscillator(),road=ctx.createBufferSource();gain.gain.value=0;filter.type='lowpass';filter.frequency.value=type==='swerve'?850:430;
    motor.type=type==='swerve'?'triangle':'sawtooth';motor.frequency.value=80;road.buffer=noise;road.loop=true;
    const roadGain=ctx.createGain();roadGain.gain.value=type==='swerve'?.13:.35;road.connect(roadGain);roadGain.connect(filter);motor.connect(filter);filter.connect(gain);gain.connect(bus);motor.start();road.start();
    return {type,gain,filter,motor,road,roadGain,sources:[motor,road]};
  }
  function tick(){
    if(!ctx)return;
    const audible=match&&!match.over&&!PAUSED&&!document.hidden&&settings.enabled&&settings.volume>0;
    if(audible&&!drive.length)drive=['swerve','tank'].map(makeDrive);
    for(const v of drive){let speed=0,weight=0;for(const r of audible?match.robots:[]){if((r.tm.build.drive.id==='swerve'?'swerve':'tank')!==v.type||r.lock>0||r.climbLv>0)continue;const w=r.isPlayer?1:.22;speed+=Math.min(1,Math.hypot(r.motionVX||0,r.motionVY||0)/Math.max(1,r.st.speed))*w;weight+=w}
      const amount=Math.min(1,speed/Math.max(1,weight));v.gain.gain.setTargetAtTime(amount*(v.type==='swerve'?.07:.045),ctx.currentTime,.09);v.motor.frequency.setTargetAtTime((v.type==='swerve'?120:55)+amount*(v.type==='swerve'?550:115),ctx.currentTime,.1);v.road.playbackRate.setTargetAtTime(.5+amount,ctx.currentTime,.1)}
  }
  const api={unlock,emit,stop,tick,get match(){return match},get enabled(){return settings.enabled},get volume(){return settings.volume},get supported(){return !!(window.AudioContext||window.webkitAudioContext)},
    start(m){stop();match=m;if(!m)return;const token=generation;unlock().then(()=>{if(token===generation&&match===m)emit('start')});timer=setInterval(tick,80)},
    setEnabled(value){settings.enabled=!!value;persist();if(ctx)bus.gain.setTargetAtTime(settings.enabled?settings.volume:0,ctx.currentTime,.03);tick()},
    setVolume(value){settings.volume=clamp(Number(value)||0,0,1);persist();if(ctx)bus.gain.setTargetAtTime(settings.enabled?settings.volume:0,ctx.currentTime,.03)},
  };
  for(const type of ['pointerdown','keydown','click'])document.addEventListener(type,unlock,{capture:true});
  document.addEventListener('visibilitychange',()=>{tick();if(document.hidden)ctx?.suspend().catch(()=>{});else if(settings.enabled)resume()});
  return api;
})();
// Live-match hooks only: replay seeking and exports stay silent and deterministic.
const soundLaunch=Match.prototype.launch,soundLand=Match.prototype.land,soundStep=Match.prototype.step;
Match.prototype.launch=function(from,...args){const result=soundLaunch.call(this,from,...args);if(FieldAudio.match===this)FieldAudio.emit(['close','hood'].includes(from.st?.mode)?'dump':'launch',from.x);return result};
Match.prototype.land=function(f){const result=soundLand.call(this,f);if(FieldAudio.match===this&&!f.pass)FieldAudio.emit(f.made?'score':'miss',f.x1);return result};
Match.prototype.step=function(dt){
  const live=FieldAudio.match===this,phase=live?this.phase():null,held=live?this.robots.map(r=>r.held):null,before=this.t;
  const result=soundStep.call(this,dt);
  if(live){const next=this.phase();
    if(before<this.end&&this.t>=this.end)FieldAudio.emit('end');
    else if(phase.k==='auto'&&next.k!=='auto'){FieldAudio.emit('autoEnd');FieldAudio.emit('resume')}
    else if(next.k==='end'&&phase.k!=='end')FieldAudio.emit('endgame');
    else if(next.k==='shift'&&phase.k==='shift'&&next.i!==phase.i)FieldAudio.emit('shift');
    this.robots.forEach((r,i)=>{if(r.held>held[i])FieldAudio.emit('intake',r.x)})}
  return result;
};
const showBeforeFieldAudio=show;
show=function(html){FieldAudio.stop();return showBeforeFieldAudio(html)};
wireSound=function(){app.querySelectorAll('.snd').forEach(b=>{b.setAttribute('aria-label','Sound settings');b.title='Music and field sounds';b.onclick=()=>{
  FieldAudio.unlock();Music.unlock();const wasPaused=PAUSED;PAUSED=true;FieldAudio.tick();
  const restore=()=>{PAUSED=wasPaused},el=sheet(`<div class="row"><h2 class="grow">Sound</h2><button id="sound-close" aria-label="Close sound settings">${ICONS.x}</button></div><p class="muted">FRC match cues from Myinstants, plus motor, launcher and fuel sounds.</p><label class="row" style="padding:12px 0"><span class="grow">Field sounds</span><input id="field-enabled" type="checkbox" ${FieldAudio.enabled?'checked':''}></label><label class="row" style="padding:12px 0"><span class="grow">Music</span><input id="music-enabled" type="checkbox" ${Music.on?'checked':''}></label><label for="field-volume">Field volume <output id="field-volume-value">${Math.round(FieldAudio.volume*100)}%</output></label><input id="field-volume" type="range" min="0" max="100" value="${Math.round(FieldAudio.volume*100)}" style="width:100%;margin:16px 0"><div class="row"><button class="grow" data-sound-preview="score">Fuel thump</button><button class="grow" data-sound-preview="launch">Launcher</button><button class="grow" data-sound-preview="end">FRC End</button></div>${FieldAudio.supported?'':'<p class="muted">Field audio is not supported in this browser.</p>'}`,restore);
  el.querySelector('#sound-close').onclick=()=>{el.remove();restore()};
  el.querySelector('#field-enabled').onchange=e=>FieldAudio.setEnabled(e.target.checked);
  el.querySelector('#music-enabled').onchange=e=>{if(Music.on!==e.target.checked)Music.toggle()};
  if(typeof PerformanceUI!=='undefined'){const row=document.createElement('label');row.className='pit-setting';row.innerHTML='<span>Show FPS</span><input type="checkbox" aria-label="Show FPS">';row.querySelector('input').checked=PerformanceUI.enabled;row.querySelector('input').onchange=e=>PerformanceUI.set(e.target.checked);el.querySelector('.sheet').append(row)}
  el.querySelector('#field-volume').oninput=e=>{FieldAudio.setVolume(+e.target.value/100);el.querySelector('#field-volume-value').textContent=e.target.value+'%'};
  el.querySelectorAll('[data-sound-preview]').forEach(button=>button.onclick=()=>FieldAudio.emit(button.dataset.soundPreview));
}})};
