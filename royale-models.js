/* FRC Royale: equipment-driven robot geometry, dimensions in inches. */
const legacyRobotModel=robotModel, legacyPrismFaces=prismFaces, legacyDrawBot=drawBot;
robotModel=function(b,col,year=curYear()){
  if(year!==2026)return legacyRobotModel(b,col,year);
  const prims=[],silver='#c4d4e1',dark='#263b50',rubber='#172332',accent='#36dcc9';
  const box=(x0,x1,y0,y1,z0,z1,c,extra={})=>prims.push({k:'box',x0:Math.min(x0,x1),x1:Math.max(x0,x1),y0:Math.min(y0,y1),y1:Math.max(y0,y1),z0,z1,c,rounded:Math.min(Math.abs(x1-x0),Math.abs(y1-y0),z1-z0)>1.5?1:0,...extra});
  const cyl=(cx,cy,r,z0,z1,c,extra={})=>prims.push({k:'cyl',cx,cy,r,z0,z1,c,n:24,...extra});
  const ball=(cx,cy,cz,r,extra={})=>prims.push({k:'sphere',cx,cy,cz,r,c:'#ffd348',...extra});
  const roller=(x,y,z,length,r,c)=>cyl(0,0,r,-length/2,length/2,c,{origin:[x,y,z],roll:Math.PI/2});
  const plate=(vertices,c,offset=[0,.55,0])=>{
    const far=vertices.map(v=>v.map((n,i)=>n+offset[i])),faces=[vertices,far.slice().reverse()];
    for(let i=0;i<vertices.length;i++){const j=(i+1)%vertices.length;faces.push([vertices[i],vertices[j],far[j],far[i]])}
    prims.push({k:'mesh',faces,c});
  };
  // Hollow aluminum chassis and low electronics tray.
  box(-13,13,-13,13,1.7,2.3,dark);
  for(const y of [-12,11])box(-13,13,y,y+1,2,5,silver);
  for(const x of [-12,11])box(x,x+1,-12,12,2,5,silver);
  box(-7,-2,-5,1,2.3,5,'#142333');box(-6.6,-2.4,-4.6,.6,5,5.4,'#e14b53');
  box(-6,-1,3,8,2.3,3.6,'#269584');
  // Generic control hardware: power distribution, controller, motor cans and loom.
  box(-1,3,7,10,2.4,3.4,'#d4dce2');box(-.5,2.5,7.4,9.6,3.4,3.7,'#303d49');
  for(let x=-.2;x<3;x+=.7)box(x,x+.3,9.8,10.6,2.8,3.4,'#e7af34');
  box(-8,-6.8,-3,8,3,3.4,'#bd3c3f');box(-8.7,-8.1,-3,8,3,3.4,'#15202a');
  for(const y of [-9,8]){box(5,9,y,y+1,3,3.8,dark);cyl(7,y+.5,1.1,3.8,6.4,silver);cyl(7,y+.5,.65,6.4,6.8,rubber)}
  for(const x of [-10,10])for(const y of [-10,10]){
    if(b.drive.id==='swerve'){cyl(x,y,2.8,2.2,3.4,dark);cyl(x,y,2.3,3.4,4.1,accent);roller(x,y,2,2.2,2,rubber);cyl(x+1.4,y,1,4.1,6.8,silver)}
  }
  if(b.drive.id!=='swerve')for(const x of [-9,0,9])for(const y of [-11,11]){roller(x,y,2.5,2.4,2.5,rubber);roller(x,y,2.5,2.6,1.15,silver)}
  // Fabric bumpers with seams and replaceable corner caps.
  box(-16.75,16.75,-16.75,-13.5,2.5,7.5,col,{label:[0,-1,0]});box(-16.75,16.75,13.5,16.75,2.5,7.5,col,{label:[0,1,0]});
  for(const x of [-16.75,13.5])box(x,x+3.25,-13.5,13.5,2.5,7.5,col);
  for(const y of [-16.8,16.3])box(-13,13,y,y+.45,7,7.7,shade(col,.4));
  for(const x of [-16.8,14.8])for(const y of [-16.8,14.8])box(x,x+2,y,y+2,2.3,7.6,shade(col,-.12));
  // Horizontal segmented compliant intake rollers, at the equipped end(s).
  const intake=(sign)=>{const x=(b.intake.id==='roller'?13.4:20)*sign;
    for(const y of [-10.8,10.2])box(sign*9,x+sign*1,y,y+.6,4.5,6,silver);
    roller(x,0,3.2,22,.45,silver);
    for(let y=-9;y<10;y+=2.3)roller(x,y,3.2,1.7,1.3,accent);
    box(x-1.8,x+1.8,11,13,2.5,5.5,dark);
  };intake(1);if(b.intake.id==='dual')intake(-1);
  // Folded hopper plates: full rear wall, flared side cheeks, sloped feed floor.
  const H={bin:11,hopper:18,net:20,mega:27}[b.hopper.id]||11;
  const W={bin:8,hopper:10,net:12,mega:12}[b.hopper.id]||8;
  plate([[-12,-W,8],[-12,W,8],[2,W,6],[2,-W,6]],'#7498ac',[0,0,-.6]);
  box(-12.5,-12,-W,W,7.5,H,'#86a9bd');
  box(-12.8,-11.8,-W-.4,W+.4,H-.7,H+.1,silver);
  for(const sign of [-1,1]){const y=sign*W;
    if(b.hopper.id!=='net'){
      plate([[-12,y,8],[2,y,6],[2,y,H-2],[-1,y,H],[-12,y,H]],'#9cbacb',[0,sign*.6,0]);
      // Contrasting inset panel and exposed fasteners on the outside face.
      if(H>12)plate([[-10,y+sign*.65,10],[0,y+sign*.65,8.5],[0,y+sign*.65,H-3],[-10,y+sign*.65,H-2]],shade(col,-.15),[0,sign*.12,0]);
      for(const x of [-10.8,.4])for(const z of [9,H-1.5])roller(x,y+sign*.85,z,.25,.35,silver);
    }else{
      for(let z=8;z<H;z+=2)box(-12,2,y,y+.2,z,z+.2,'#8aabba');
      for(let x=-12;x<=2;x+=2)box(x,x+.2,y,y+.2,7,H,'#8aabba');
    }
    box(-12.4,-.5,y-.4,y+.4,H-.6,H+.1,silver);
    for(const x of [-12,1.5])box(x,x+.6,y-.3,y+.3,5,H-1,silver);
  }
  let fuelIndex=0;for(const x of [-8,-4])for(const y of [-4,0,4])ball(x,y,10,1.9,{fuelIndex:fuelIndex++});
  box(1,5,-3.5,3.5,5.6,6.2,rubber);for(const x of [2,3.3,4.6])roller(x,0,6.5,6,.4,accent);
  // Gusset plates and fasteners make the frame read as a fabricated FRC chassis.
  for(const x of [-11,10])for(const y of [-11,10]){box(x,x+1.7,y,y+1.7,5,5.35,silver);cyl(x+.8,y+.8,.3,5.35,5.65,rubber)}
  // Mechanism separates dumpers from fixed flywheels and rotating shooters.
  const sh=b.shooter.id;
  if(sh==='dumper'||sh==='superdumper'){
    const z=sh==='superdumper'?13:10, tilt=sh==='superdumper'?-.32:-.18;
    const tr={tilt,origin:[4,0,z]};
    box(0,10,-7,7,0,.6,'#668ba5',tr);
    for(const y of [-7,6.4])box(0,10,y,y+.6,0,6.4,silver,tr);
    box(-.5,.3,-7,7,0,6.4,dark,tr);box(9.4,10,-7,7,0,.6,'#ffcf43',tr);
    // Open deep bucket with spherical fuel and a low discharge lip.
    for(const y of [-3,3])ball(5,y,3.1,2.4,tr);
    for(const y of [-8,7])box(3,5,y,y+1,5,z+1,dark);
    box(3.5,4.5,-8,8,z-.5,z+.5,'#f2bb37');
    if(sh==='superdumper')box(7,8,-8,-7,6,15,accent);
  }else{
    const dual=sh==='dturret',turret=dual||sh==='turret',z=dual?21:10.8;
    for(const y of [-5,4])box(1,3,y,y+1,5,z,dark);
    const turretStart=prims.length;
    if(turret){cyl(3,0,dual?8:6.3,z,z+1,dark);cyl(3,0,dual?7.4:5.8,z+1,z+1.7,'#e6b73e');cyl(3,0,dual?6.8:5.1,z+1.7,z+2.2,silver)}
    const channels=dual?[-4.2,4.2]:[0],w=dual?3.1:4.6;
    for(const y of channels){const tr={tilt:-.38,origin:[2,y,z+2]};
      box(-2,9,-w,w,0,.7,dark,tr);
      for(const yy of [-w,w-.5])box(-2,9,yy,yy+.5,0,6.5,silver,tr);
      // Paired flywheels and curved hood ribs; no cannon-style barrels.
      for(const yy of [-w+1.2,w-1.2])cyl(4,yy,1.3,.8,5.8,rubber,tr);
      for(let x=-1;x<6;x+=1.8)box(x,x+.6,-w,w,6.3,7,shade(col,.25),tr);
      box(8,9,-w,w,.7,1.2,accent,tr);
      // A tall ball-sized throat, visible fuel, and raised hood above the feed path.
      ball(6.6,0,3.6,2.3,tr);
    }
    if(turret){box(0,2,-1,1,z+6,z+7,dark);box(1.9,2.1,-.65,.65,z+6.2,z+6.8,'#4cf5e2')}
    if(turret)for(let i=turretStart;i<prims.length;i++)prims[i].turret=true;
  }
  const climber=b.climber.id;
  if(climber!=='none'){for(const y of [-6,6]){box(-12,-10.5,y,y+1,5,climber==='hook'?19:21,silver);box(-12,-7,y,y+1,climber==='hook'?18:20,climber==='hook'?19:21,accent)}if(climber==='tele')box(-11,-10,-6,7,9,21,dark)}
  const height=Math.max(...prims.flatMap(p=>prismFaces(p).flatMap(f=>f.v.map(v=>v[2]))));
  return {prims,height,width:b.intake.id==='dual'?44:39};
};
prismFaces=function(p){
  if(p.k==='mesh')return p.faces.map(v=>{const a=v[1].map((n,i)=>n-v[0][i]),b=v[2].map((n,i)=>n-v[0][i]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...cross)||1;return {v,n:cross.map(n=>n/length),c:p.c}});
  let faces;
  if(p.k==='sphere'){
    faces=[];const point=(lat,lon)=>[p.cx+p.r*Math.cos(lat)*Math.cos(lon),p.cy+p.r*Math.cos(lat)*Math.sin(lon),p.cz+p.r*Math.sin(lat)];
    for(let a=0;a<8;a++)for(let b=0;b<16;b++){
      const lo=-Math.PI/2+a*Math.PI/8,hi=lo+Math.PI/8,l=b*Math.PI/8,h=l+Math.PI/8;
      const v=[point(lo,l),point(lo,h),point(hi,h),point(hi,l)],lat=(lo+hi)/2,lon=(l+h)/2;
      faces.push({v,n:[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)],c:p.c});
    }
  }else if(p.k==='box'&&p.rounded){
    const r=Math.min(p.rounded,(p.x1-p.x0)/3,(p.y1-p.y0)/3,(p.z1-p.z0)/3);
    const ring=(inset,z)=>{
      const rad=Math.max(.01,r-inset),out=[];
      for(const [cx,cy,start] of [[p.x1-r,p.y1-r,0],[p.x0+r,p.y1-r,Math.PI/2],[p.x0+r,p.y0+r,Math.PI],[p.x1-r,p.y0+r,Math.PI*1.5]])
        for(let j=0;j<=3;j++){const a=start+j*Math.PI/6;out.push([cx+rad*Math.cos(a),cy+rad*Math.sin(a),z])}
      return out;
    };
    const rings=[ring(r*.7,p.z0),ring(0,p.z0+r),ring(0,p.z1-r),ring(r*.7,p.z1)];
    const polygons=[rings[0].slice().reverse(),rings[3]];
    for(let k=0;k<3;k++)for(let i=0;i<16;i++){const j=(i+1)%16;polygons.push([rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i]])}
    faces=polygons.map(v=>{const a=v[1].map((x,i)=>x-v[0][i]),b=v[2].map((x,i)=>x-v[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n)||1;return {v,n:n.map(x=>x/len),c:p.c}});
    for(const f of faces)f.label=!!p.label&&f.n.every((x,i)=>Math.abs(x-p.label[i])<.00001);
  }else faces=legacyPrismFaces(p);if(!p.origin)return faces;
  const c=Math.cos(p.tilt||0),s=Math.sin(p.tilt||0),rc=Math.cos(p.roll||0),rs=Math.sin(p.roll||0),rot=([x,y,z])=>{const yy=y*rc-z*rs,zz=y*rs+z*rc;return [x*c+zz*s,yy,-x*s+zz*c]};
  return faces.map(f=>({...f,v:f.v.map(v=>rot(v).map((n,i)=>n+p.origin[i])),n:rot(f.n)}));
};
// Match-scale renderer: consistent silhouettes, deliberate high-contrast details.
drawBot=function(ctx,b,x,y,a,s,col,o={}){
  if((o.year||curYear())!==2026)return legacyDrawBot(ctx,b,x,y,a,s,col,o);
  const st=o.st||buildStats(b),u=s/11.25;
  ctx.save();ctx.translate(x,y);
  if(o.hl){ctx.strokeStyle='#ffe17a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,21*u,0,Math.PI*2);ctx.stroke()}
  ctx.rotate(a);ctx.scale(u,u);
  const rect=(x,y,w,h,c,r=0)=>{ctx.fillStyle=c;if(r){rr(ctx,x,y,w,h,r);ctx.fill()}else ctx.fillRect(x,y,w,h)};
  const circle=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()};
  rect(-16,-15,34,34,'#0007',4);rect(-17,-17,34,34,shade(col,-.4),3);rect(-17,-17,33,32,col,3);rect(-14,-14,28,28,'#233b50',2);
  for(const yy of [-12,11])rect(-12,yy,24,1,'#b5cbd9');for(const xx of [-12,11])rect(xx,-12,1,24,'#b5cbd9');
  for(const xx of [-10,10])for(const yy of [-10,10]){ctx.save();ctx.translate(xx,yy);if(b.drive.id==='swerve'){circle(0,0,3.2,'#36b8aa');ctx.rotate(o.wheelA||0)}rect(-2.6,-1.5,5.2,3,'#101c28',.6);rect(-1,-1.5,.7,3,'#a7becb');ctx.restore()}
  const intake=sign=>{const xx=sign*(b.intake.id==='roller'?14:20);for(const yy of [-11,10])rect(Math.min(sign*10,xx),yy,Math.abs(xx-sign*10)+1,1,'#a6bdcc');rect(xx-1,-11,2,22,'#bdcfd8');for(let yy=-10;yy<10;yy+=3)rect(xx-1.6,yy,3.2,2,'#48e5cb',.5);rect(xx-2,11,4,3,'#1b2d3d',.5)};intake(1);if(b.intake.id==='dual')intake(-1);
  const hw={bin:8,hopper:10,mega:12,net:12}[b.hopper.id]||8;
  rect(-12.5,-hw-1,15.5,hw*2+2,'#d0e0e7',1);rect(-11,-hw+1,12,hw*2-2,'#45687e',1);
  rect(-12.5,-hw,2,hw*2,'#9bb9cc');rect(-10.5,-hw,12.5,1.4,'#eef7fb');rect(-10.5,hw-1.4,12.5,1.4,'#a0becf');
  for(const yy of [-hw+.5,hw-.5])for(const xx of [-11,1])circle(xx,yy,.55,'#263a4c');
  const held=o.held==null?3:Math.min(6,Math.ceil(o.held/(st.cap||8)*6));for(let i=0;i<held;i++)circle(-6+(i%2)*4,-4+Math.floor(i/2)*4,1.7,'#ffd457');
  if(b.hopper.id==='net'){ctx.strokeStyle='#80a0b7';ctx.lineWidth=.45;for(let yy=-6;yy<=6;yy+=3){ctx.beginPath();ctx.moveTo(-9,yy);ctx.lineTo(1,yy);ctx.stroke()}}
  const sh=b.shooter.id;
  if(sh==='dumper'||sh==='superdumper'){
    rect(2,-9,12,18,'#b8cfdb',1);rect(3,-7.5,10,15,'#476982');rect(3,-7.5,2,15,'#1c3449');rect(13,-8,1.5,16,'#ffd457');
    for(const yy of [-9,8]){rect(2,yy,12,1,'#e4f2f7');circle(3,yy,1.2,'#6ddbc8')}
    if(sh==='superdumper'){rect(8,-10,1.5,20,'#43d6bd');rect(6,-5,5,10,'#678ca3')}
  }else{
    const dual=sh==='dturret',turret=dual||sh==='turret';ctx.save();ctx.translate(3,0);if(turret)ctx.rotate((o.turretA??a)-a);
    if(turret){circle(0,0,dual?8.6:7,'#102a3d');circle(0,0,dual?7.8:6.3,'#e6b73e');circle(0,0,dual?6.8:5.3,'#6d8da4')}
    for(const yy of dual?[-4.5,4.5]:[0]){const w=dual?6.5:9;rect(-3,yy-w/2,13,w,'#b4ccda',1);rect(-2,yy-w/2+1,11,w-2,'#233c50');rect(7,yy-w/2+1,3,w-2,'#46dfc7');for(const side of [-1,1])circle(3,yy+side*(w/2-1.7),1.6,'#111d29');for(let xx=-1;xx<6;xx+=2.4)rect(xx,yy-w/2,1,w,shade(col,.35))}
    circle(-3,0,1,'#66fff0');ctx.restore();
  }
  if(b.climber.id!=='none')for(const yy of [-6,6]){rect(-13,yy,2,5,'#c3d9e5');rect(-13,yy,5,1.3,'#45d6bd')}
  // White stitching and readable team identification on the bumper.
  rect(-10,-16.5,20,.55,shade(col,.55));rect(-10,15.7,20,.55,shade(col,.55));
  if(o.num!=null&&s>=5){ctx.save();ctx.rotate(Math.PI/2);ctx.fillStyle='#fff';ctx.font='bold 4.5px sans-serif';ctx.textAlign='center';ctx.fillText(String(o.num),0,16);ctx.restore()}
  ctx.restore();
};
