/* 2026 drivetrain: velocities in ft/s, acceleration in ft/s². */
const DRIVE_2026={accel:12,brake:18,yawAccel:14};
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function bumpFactor2026(p,st){
  if(!BUMPS.some(([a,b])=>p.x>a&&p.x<b))return 1;
  const distance=Math.min(Math.abs(p.y-BAR.B),Math.abs(p.y-BAR.T));
  // Front wheels climb before the center reaches the ramp; rear wheels clear last.
  const contact=clamp((2.5-distance)/1.2,0,1),crossing=clamp((st.bump||.6)*.65,.24,.62);
  return 1-(1-crossing)*contact;
}
function bumpElevation2026(p){
  if(!BUMPS.some(([a,b])=>p.x>a&&p.x<b))return 0;
  return .55*clamp(1-Math.min(Math.abs(p.y-BAR.B),Math.abs(p.y-BAR.T))/2,0,1);
}
function bumpPose2026(r){
  // Sample four wheel contacts in world space, including sideways swerve travel.
  const c=Math.cos(r.a),s=Math.sin(r.a),wheel=1.05;
  const height=(x,y)=>bumpElevation2026({x:r.x+x*c-y*s,y:r.y+x*s+y*c});
  const fl=height(wheel,-wheel),fr=height(wheel,wheel),bl=height(-wheel,-wheel),br=height(-wheel,wheel);
  return {elevation:Math.max((fl+fr+bl+br)/4,bumpElevation2026(r)*.85),
    pitch:Math.atan2(fl+fr-bl-br,4*wheel),roll:Math.atan2(fr+br-fl-bl,4*wheel)};
}
function drive2026(m,r,dt){
  r.motionVX=r.motionVX||0;r.motionVY=r.motionVY||0;r.yawVelocity=r.yawVelocity||0;
  // Advance by projection, so a passed curve sample never pulls the robot backward.
  r.pathFrom=r.pathFrom||{x:r.x,y:r.y};
  while(r.path.length){
    const p=r.path[0],a=r.pathFrom,dx=p.x-a.x,dy=p.y-a.y,l2=dx*dx+dy*dy;
    const passed=l2>.0001&&((r.x-a.x)*dx+(r.y-a.y)*dy)/l2>=1;
    if(dist(r,p)<(r.path.length===1?.18:.35)||(r.path.length>1&&passed&&clearSegment(r,r.path[1],q=>m.blocked(r,q.x,q.y)))){r.pathFrom=r.path.shift()}else break;
  }
  const speed=Math.hypot(r.motionVX,r.motionVY),passing=fixedFeed2026(m,r),hasPath=r.path.length>0&&!passing;
  let tx=0,ty=0,want=r.a;
  if(hasPath){
    // Look ahead along the route, but never cut across an obstacle.
    let target=r.path[0],look=.45+speed*.14,from=r,remaining=0;
    for(const p of r.path){remaining+=dist(from,p);from=p}
    from=r;
    for(const p of r.path){const d=dist(from,p);if(d>=look){target={x:from.x+(p.x-from.x)*look/(d||1),y:from.y+(p.y-from.y)*look/(d||1)};break}look-=d;target=p;from=p}
    const visible=p=>{const n=Math.max(1,Math.ceil(dist(r,p)/.15));for(let i=1;i<=n;i++)if(m.blocked(r,r.x+(p.x-r.x)*i/n,r.y+(p.y-r.y)*i/n))return false;return true};
    if(!visible(target))target=r.path[0];
    const dx=target.x-r.x,dy=target.y-r.y,d=Math.hypot(dx,dy)||1;
    want=Math.atan2(dy,dx);
    // Swerve chassis rotation anticipates the upcoming curve independently of
    // the shorter translation lookahead that keeps its wheels on the route.
    if(r.st.strafe){
      let headingLook=1.5+speed*.35,headingFrom=r,headingTarget=target;
      for(const p of r.path){const length=dist(headingFrom,p);if(length>=headingLook){headingTarget={x:headingFrom.x+(p.x-headingFrom.x)*headingLook/(length||1),y:headingFrom.y+(p.y-headingFrom.y)*headingLook/(length||1)};break}headingLook-=length;headingTarget=p;headingFrom=p}
      want=Math.atan2(headingTarget.y-r.y,headingTarget.x-r.x);
    }
    let top=r.st.speed*(r.od>0?1.35:1)*(r.slow>0&&!r.dash?.55:1)*(r.dash?1.3:1);
    const freeSpeed=top;top*=bumpFactor2026(r,r.st);
    // Look ahead far enough to brake before entering either slope, even with a boost.
    let terrainFrom=r,terrainDistance=0;
    for(const p of r.path){const length=dist(terrainFrom,p),samples=Math.max(1,Math.ceil(length/.3));
      for(let i=1;i<=samples;i++){const ahead=terrainDistance+length*i/samples;if(ahead>freeSpeed*freeSpeed/(2*DRIVE_2026.brake)+3)break;
        const q={x:terrainFrom.x+(p.x-terrainFrom.x)*i/samples,y:terrainFrom.y+(p.y-terrainFrom.y)*i/samples},limit=freeSpeed*bumpFactor2026(q,r.st);top=Math.min(top,Math.sqrt(limit*limit+2*DRIVE_2026.brake*ahead))}
      terrainDistance+=length;terrainFrom=p;if(terrainDistance>freeSpeed*freeSpeed/(2*DRIVE_2026.brake)+3)break;
    }
    // Reserve acceleration for steering and include one tick of braking latency.
    const routeBrake=DRIVE_2026.brake*.8,lateral=DRIVE_2026.accel*.8;
    const safeApproach=(limit,distance)=>Math.sqrt(limit*limit+2*routeBrake*Math.max(0,distance-speed*dt-.16));
    top=Math.min(top,safeApproach(0,remaining));
    // Absolute curvature limits stay safe at every upgrade and boost level.
    let previous=r.pathFrom,bendDistance=-dist(r.pathFrom,r);
    for(let i=0;i<r.path.length-1;i++){
      const p=r.path[i],next=r.path[i+1],a=dist(previous,p),b=dist(p,next),c=dist(previous,next);
      const cross=Math.abs((p.x-previous.x)*(next.y-p.y)-(p.y-previous.y)*(next.x-p.x));
      const dot=a*b?((p.x-previous.x)*(next.x-p.x)+(p.y-previous.y)*(next.y-p.y))/(a*b):1;
      bendDistance+=a;
      if(a>.001&&b>.001&&(cross>.00001||dot<0)){
        const radius=dot<-.95?0:a*b*c/(2*Math.max(cross,.00001));
        top=Math.min(top,safeApproach(Math.max(.8,Math.sqrt(lateral*radius)),Math.max(0,bendDistance-.25)));
      }
      previous=p;
      if(bendDistance>freeSpeed*freeSpeed/(2*routeBrake)+3)break;
    }
    if(speed>.1){const alignment=clamp((r.motionVX*dx+r.motionVY*dy)/(speed*d),-1,1);if(alignment<.5)top*=Math.max(.25,alignment*2)}
    if(r.st.both&&Math.abs(angleDelta(want,r.a))>Math.PI/2)want+=Math.PI;
    if(!r.st.strafe)top*=Math.max(.15,Math.cos(angleDelta(want,r.a)));
    tx=dx/d*top;ty=dy/d*top;
  }
  // A fixed shooter/dumper has to settle and point its mechanism at the hub.
  if(!hasPath&&r.held>0&&['close','hood','spot'].includes(r.st.mode)&&dist(r,m.hub(r.A))<13){const h=m.hub(r.A);want=Math.atan2(h.y-r.y,h.x-r.x)}
  if(passing){const target=feedAim2026(r);want=Math.atan2(target.y-r.y,target.x-r.x)}
  const yawLimit=Math.min(r.st.turn,r.st.strafe?4.2:3.2),error=angleDelta(want,r.a);
  const yawTarget=Math.sign(error)*Math.min(yawLimit,Math.sqrt(2*DRIVE_2026.yawAccel*Math.abs(error)));
  r.yawVelocity+=clamp(yawTarget-r.yawVelocity,-DRIVE_2026.yawAccel*dt,DRIVE_2026.yawAccel*dt);
  const turn=r.yawVelocity*dt;if(Math.abs(turn)>Math.abs(error)&&turn*error>0){r.a+=error;r.yawVelocity=0}else r.a+=turn;
  const vx=tx-r.motionVX,vy=ty-r.motionVY,change=Math.hypot(vx,vy);
  const acceleration=Math.hypot(tx,ty)<speed?DRIVE_2026.brake:DRIVE_2026.accel;
  const ratio=change?Math.min(1,acceleration*dt/change):0;
  r.motionVX+=vx*ratio;r.motionVY+=vy*ratio;
  if(!hasPath&&Math.hypot(r.motionVX,r.motionVY)<.04){r.motionVX=0;r.motionVY=0}
  const x=r.x,y=r.y,n=Math.max(1,Math.ceil(Math.hypot(r.motionVX,r.motionVY)*dt/.12));
  for(let i=0;i<n;i++){
    const nx=r.x+r.motionVX*dt/n,ny=r.y+r.motionVY*dt/n;
    if(!m.blocked(r,nx,ny)){r.x=nx;r.y=ny}else{
      if(!m.blocked(r,nx,r.y))r.x=nx;else r.motionVX=0;
      if(!m.blocked(r,r.x,ny))r.y=ny;else r.motionVY=0;
    }
  }
  r.driveSpeed=Math.hypot(r.motionVX,r.motionVY);
  r.stuck=hasPath&&dist(r,{x,y})<.01?(r.stuck||0)+dt:0;
  if(r.stuck>1.2&&r.goal){r.stuck=0;if(r.waypointState){const target=r.path[0]||r.goal,remaining=r.path.slice(1);m.planPath(r,target);r.path.push(...remaining)}else if(r.routePoints?.length)rebuildRoute(m,r);else m.planPath(r,r.goal);r.think=0}
  r.lastX=r.x;r.lastY=r.y;
}
// Render between fixed simulation ticks; never change authoritative physics poses.
const step2026=Match.prototype.step,draw2026=Match.prototype.draw;
Match.prototype.step=function(dt){for(const r of this.robots){r.renderPrevious={x:r.x,y:r.y,a:r.a};if(r.lock>0||r.climbLv>0){r.motionVX=0;r.motionVY=0;r.yawVelocity=0}}return step2026.call(this,dt)};
Match.prototype.draw=function(...args){
  const alpha=clamp(this.renderAlpha??1,0,1),poses=this.robots.map(r=>({x:r.x,y:r.y,a:r.a}));
  try{this.robots.forEach((r,i)=>{const p=r.renderPrevious||poses[i];r.x=p.x+(r.x-p.x)*alpha;r.y=p.y+(r.y-p.y)*alpha;r.a=p.a+angleDelta(r.a,p.a)*alpha});return draw2026.apply(this,args)}
  finally{this.robots.forEach((r,i)=>Object.assign(r,poses[i]))}
};

// Active roller mouth, in chassis coordinates; corners and sides remain bumpers.
function intakeMouth2026(r,f){
  const c=Math.cos(r.a),s=Math.sin(r.a),dx=f.x-r.x,dy=f.y-r.y;
  const along=dx*c+dy*s,across=-dx*s+dy*c,reach=ROB_R+.35+r.st.reach;
  if(Math.abs(across)>(r.st.suction?1.25:.82))return 0;
  if(along>=.2&&along<=reach)return 1;
  if(r.st.both&&along<=-.2&&along>=-reach)return -1;
  return 0;
}

// Cosmetic launch offsets: never consume simulation randomness or change scoring.
function fuelOutlet2026(r){
  if(!r?.st)return {};
  const body=r.a||0,dumper=['close','hood'].includes(r.st.mode);
  const aim=r.st.mode==='zone'?(r.turretA??body):body;
  if(dumper){
    const lanes=[-.5,.5,0,-.25,.25],side=lanes[(r.outletShot||0)%lanes.length];r.outletShot=(r.outletShot||0)+1;
    return {outletX:Math.cos(body)*1.15-Math.sin(body)*side,outletY:Math.sin(body)*1.15+Math.cos(body)*side,outletZ:r.st.mode==='hood'?1.35:1};
  }
  const dual=r.tm?.build?.shooter?.id==='dturret';
  const side=dual?((r.outletShot||0)%2? .35:-.35):0;
  if(dual)r.outletShot=(r.outletShot||0)+1;
  return {outletX:Math.cos(body)*.25+Math.cos(aim)*.6-Math.sin(aim)*side,outletY:Math.sin(body)*.25+Math.sin(aim)*.6+Math.cos(aim)*side,outletZ:dual?2:1.35};
}

function fixedFeed2026(m,r){return r.st.mode!=='zone'&&r.held>0&&(r.feed>0||(r.autoFeed&&m.t<m.R?.auto))&&r.y>BAR.T+.5&&r.y<BAR.B-.5}

// Dumpers aim at the nearer corner; keep the aim stable while the chassis turns.
function feedAim2026(r){
  const local=M(r.A,r.x,r.y),dumper=['close','hood'].includes(r.st?.mode);
  return dumper?M(r.A,local.x<FW/2?FW/6:FW*5/6,48):M(r.A,clamp(local.x,5,22),46);
}
function feedTarget2026(r){
  if(r.st.mode==='zone')return M(r.A,rnd(3,24),rnd(43,50));
  const aim=feedAim2026(r);
  return {x:aim.x+rnd(-2.7,2.7),y:aim.y+rnd(-1.8,1.8)};
}
function passRoll2026(f){
  const dx=f.x1-f.x0,dy=f.y1-f.y0,d=Math.hypot(dx,dy)||1;
  const angle=Math.atan2(dy,dx)+rnd(-.6,.6);
  const speed=clamp(d/Math.max(.2,f.dur)*.25*rnd(.55,1.5),2,5.5);
  return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,rollDrag:rnd(1.2,1.9)};
}

function hubReturn2026(m,A){
  // Start at the neutral-facing lip, just clear of the hub collision box.
  const p=M(A,rnd(HUBX[0]+.3,HUBX[1]-.3),41-2.15);
  // Exponential drag gives a free roll distance near speed / drag.
  // Longer releases can cross the full neutral zone while others stop nearby.
  const angle=-Math.PI/2+rnd(-1.1,1.1),rollDrag=rnd(.38,.58),speed=rnd(4,34)*rollDrag,sign=A==='B'?1:-1;
  m.addFuel(p.x,p.y,Math.cos(angle)*speed*sign,Math.sin(angle)*speed*sign,rollDrag);
}

function collideFuel2026(m){
  // Reused linked-cell grid: only inspect neighboring cells, once per pair.
  const size=.6,cols=46,rows=91,diameter=.54;
  const grid=m.fuelGrid||(m.fuelGrid={head:new Int32Array(cols*rows),next:new Int32Array(512)});
  if(grid.next.length<m.fuel.length)grid.next=new Int32Array(m.fuel.length*2);
  grid.head.fill(-1);let checks=0;
  for(let i=0;i<m.fuel.length;i++){
    const f=m.fuel[i],cx=clamp(Math.floor(f.x/size),0,cols-1),cy=clamp(Math.floor(f.y/size),0,rows-1);
    for(let y=Math.max(0,cy-1);y<=Math.min(rows-1,cy+1);y++)for(let x=Math.max(0,cx-1);x<=Math.min(cols-1,cx+1);x++){
      for(let j=grid.head[y*cols+x];j!==-1;j=grid.next[j]){
        checks++;const g=m.fuel[j],a=f.intakeHeld?0:1,b=g.intakeHeld?0:1;if(!a&&!b)continue;
        let dx=f.x-g.x,dy=f.y-g.y,d2=dx*dx+dy*dy;if(d2>=diameter*diameter)continue;
        let d=Math.sqrt(d2);if(d<1e-8){dx=(i+j)%2?1:0;dy=dx?0:1;d=1}
        const nx=dx/d,ny=dy/d,overlap=(diameter-Math.sqrt(d2))/(a+b);
        f.x=clamp(f.x+nx*overlap*a,.3,FW-.3);f.y=clamp(f.y+ny*overlap*a,.3,FL-.3);
        g.x=clamp(g.x-nx*overlap*b,.3,FW-.3);g.y=clamp(g.y-ny*overlap*b,.3,FL-.3);
        const closing=(f.vx-g.vx)*nx+(f.vy-g.vy)*ny;
        if(closing<0){const impulse=-(1+.45)*closing/(a+b);f.vx+=nx*impulse*a;f.vy+=ny*impulse*a;g.vx-=nx*impulse*b;g.vy-=ny*impulse*b}
      }
    }
    const cell=cy*cols+cx;grid.next[i]=grid.head[cell];grid.head[cell]=i;
  }
  return checks;
}
