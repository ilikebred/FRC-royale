/* BOTS workshop enhancements. Original game: https://github.com/sjsonline/bots */
function smoothRoute(points, blocked=()=>false) {
  // Eliminate duplicate/collinear samples before shaping one continuous route.
  points=points.filter((p,i)=>!i||dist(p,points[i-1])>.001);
  const clean=[];
  for(const p of points){while(clean.length>1){const a=clean.at(-2),b=clean.at(-1),ab=dist(a,b),bc=dist(b,p);if(ab*bc&&((b.x-a.x)*(p.x-b.x)+(b.y-a.y)*(p.y-b.y))/(ab*bc)>.99999)clean.pop();else break}clean.push(p)}
  points=clean;
  if(points.length<3)return points.map(p=>({...p}));
  const out=[{...points[0]}];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1], b=points[i], c=points[i+1];
    const da=dist(a,b), dc=dist(b,c), radius=Math.min(3,da*.45,dc*.45);
    if(da<.01||dc<.01){out.push({...b});continue}
    const p={x:b.x+(a.x-b.x)*radius/da,y:b.y+(a.y-b.y)*radius/da};
    const q={x:b.x+(c.x-b.x)*radius/dc,y:b.y+(c.y-b.y)*radius/dc};
    const curve=[p];
    const n=Math.max(8,Math.ceil(radius*12));
    for(let j=1;j<=n;j++){const t=j/n,u=1-t;curve.push({x:u*u*p.x+2*u*t*b.x+t*t*q.x,y:u*u*p.y+2*u*t*b.y+t*t*q.y})}
    const candidate=[out.at(-1),...curve,c];
    out.push(...(candidate.some((p,j)=>j&&!clearSegment(candidate[j-1],p,blocked))?[{...b}]:curve));
  }
  out.push({...points[points.length-1]});return out;
}
function rebuildRoute(m,r){
  const route=r.routePoints||[]; let cursor={x:r.x,y:r.y}, path=[];
  const saved={x:r.x,y:r.y,path:r.path,goal:r.goal};
  for(const p of route){
    // Plan raw legs and smooth once, rather than rounding already-rounded samples.
    if(m instanceof Match)path.push(...navigation2026(cursor,p,r.st,r.A,m.t<m.R.auto));
    else{r.x=cursor.x;r.y=cursor.y;m.planPath(r,p);path.push(...r.path.map(q=>({...q})))}
    cursor=path.at(-1)||cursor;
  }
  Object.assign(r,saved);
  r.path=smoothRoute([{x:r.x,y:r.y},...path],p=>m.blocked(r,p.x,p.y)).slice(1);r.pathFrom={x:r.x,y:r.y};
  r.goal=route.length?{type:'route',...route.at(-1)}:null;
  r.manual=null;r.think=0;r.routeStall=0;r.routeActive=r.path.length>0;
}
for(const C of [Match,MatchDS,GenMatch]){
  const proto=C.prototype, think=proto.think, move=proto.move, draw=proto.draw, plan=proto.planPath;
  proto.planPath=function(r,to){plan.call(this,r,to);if(r.st.strafe)r.path=smoothRoute([{x:r.x,y:r.y},...r.path],p=>this.blocked(r,p.x,p.y)).slice(1)};
  proto.think=function(r){
    if(!r.routeInitialized){r.routeInitialized=true;r.routeAuto=!!r.tm?.drawnPath?.length;r.routePoints=(r.tm?.drawnPath||[]).map(p=>M(r.A,p.x,p.y));if(r.routePoints.length)rebuildRoute(this,r)}
    if(r.routeAuto&&this.t>=this.R.auto){r.routeAuto=false;r.routeActive=false;r.routePoints=[];r.path=[];r.goal=null}
    if(r.routePoints?.length||r.routeActive){r.mode='manual';return}
    return think.call(this,r);
  };
  proto.move=function(r,dt){
    if(r.routePoints?.length||r.routeActive){
      while(r.routePoints.length&&dist(r,r.routePoints[0])<(r.routePoints.length===1?.35:2.1))r.routePoints.shift();
      if(!r.path.length){r.routePoints=[];r.routeActive=false;r.goal=null;r.think=0}
    }
    // Consume dense curve samples without spending a simulation tick stopped at each one.
    if(C===Match){drive2026(this,r,dt);return}
    while(r.path.length>1&&dist(r,r.path[0])<.38)r.path.shift();
    const x=r.x,y=r.y, speed=r.st.speed;
    const target=r.path.length?speed:0;
    r.driveSpeed=(r.driveSpeed||0)+clamp(target-(r.driveSpeed||0),-speed*4*dt,speed*2.5*dt);
    r.st.speed=Math.max(.01,r.driveSpeed);
    try{move.call(this,r,dt)}finally{r.st.speed=speed}
    if(r.routePoints?.length){r.routeStall=dist(r,{x,y})<.005?(r.routeStall||0)+dt:0;if(r.routeStall>1.5)rebuildRoute(this,r)}
  };
  proto.draw=function(ctx,s,ac,me){draw.call(this,ctx,s,ac,me);if(!me?.routePoints?.length)return;ctx.save();ctx.strokeStyle='#54e4dc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(me.x*s,me.y*s);for(const p of me.path)ctx.lineTo(p.x*s,p.y*s);ctx.stroke();me.routePoints.forEach((p,i)=>{ctx.fillStyle='#0e2530';ctx.beginPath();ctx.arc(p.x*s,p.y*s,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(i+1,p.x*s,p.y*s+3)});ctx.restore()};
}
const originalApply=SimRun.prototype.apply;
SimRun.prototype.apply=function(type,a){
  if(type!=='p'&&type!=='u')return originalApply.call(this,type,a);
  return this.wrap(()=>{const m=this.m,r=this.me;if(m.t<m.R.auto||m.t>=m.end||r.lock>0||r.climbLv>0||r.done)return null;
    r.routePoints=r.routePoints||[];
    if(type==='u')r.routePoints.pop();else{
      const p={x:clamp(a[0],ROB_R+.1,FW-ROB_R-.1),y:clamp(a[1],ROB_R+.1,FL-ROB_R-.1)};
      if(m.blocked(r,p.x,p.y))return {msg:'Choose a point clear of field obstacles'};
      if(r.routePoints.length>=80)return {msg:'Route limit reached — undo a point first'};
      r.routePoints.push(p);
    }
    if(m.release)m.release(r);rebuildRoute(m,r);return {ok:true};
  });
};
const originalEstimateAuto=estimateAuto;
function installTheme(){
  const b=document.createElement('button');b.id='theme-toggle';b.type='button';
  const apply=theme=>{document.documentElement.dataset.theme=theme;b.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'+(theme==='dark'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>':'<path d="M20 15.5A9 9 0 0 1 8.5 4a9 9 0 1 0 11.5 11.5Z"/>')+'</svg><span>'+(theme==='dark'?'Light':'Dark')+'</span>';b.setAttribute('aria-label','Switch to '+(theme==='dark'?'light':'dark')+' mode')};
  let saved;try{saved=localStorage.getItem('bots-theme')}catch{}apply(saved||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));
  b.onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';apply(t);try{localStorage.setItem('bots-theme',t)}catch{}};document.body.append(b);
}
installTheme();
const originalShowWithTheme=show;
show=function(html){
  const toggle=document.getElementById('theme-toggle');
  originalShowWithTheme(html);
  if(toggle)(document.querySelector('.hubline')||document.body).append(toggle);
};
