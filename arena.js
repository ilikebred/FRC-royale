/* Straight overhead field. Depth comes from raised geometry, not a tilted board. */
const arenaProject=(x,y)=>({x:.97*x+.4,y:.98*y+.4});
const arenaUnproject=(x,y)=>({x:(x-.4)/.97,y:(y-.4)/.98});
const arenaDraw=Match.prototype.draw;
Match.prototype.draw=function(ctx,S,...args){
  ctx.save();ctx.fillStyle=document.documentElement.dataset.theme==='light'?'#dff2fc':'#10243c';ctx.fillRect(0,0,FW*S,FL*S);
  ctx.transform(.97,0,0,.98,.4*S,.4*S);
  try{return arenaDraw.call(this,ctx,S,...args)}finally{ctx.restore()}
};
function arenaBlock(ctx,x,y,w,h,z,top,side,S){
  const lift=z*.42;
  ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(x*S,y*S);ctx.lineTo((x+w)*S,y*S);ctx.lineTo((x+w)*S,(y+h)*S);ctx.lineTo(x*S,(y+h)*S);ctx.closePath();ctx.fill();
  ctx.fillStyle=top;ctx.fillRect(x*S,(y-lift)*S,w*S,h*S);
  ctx.fillStyle=side;ctx.fillRect(x*S,(y+h-lift)*S,w*S,lift*S);
  ctx.strokeStyle='#ffffff40';ctx.lineWidth=.7;ctx.strokeRect(x*S,(y-lift)*S,w*S,h*S);
}
drawField=function(ctx,m,S,AC,player){
  const light=document.documentElement.dataset.theme==='light',W=FW*S,H=FL*S;
  // Carpet, rounded field frame and front rail.
  ctx.fillStyle=light?'#5b84a5':'#071421';rr(ctx,-.35*S,-.35*S,W+.7*S,H+1.05*S,.9*S);ctx.fill();
  ctx.fillStyle=light?'#d5e8f3':'#1c3449';rr(ctx,0,0,W,H,.6*S);ctx.fill();
  for(const A of ['B','T']){ctx.fillStyle=light?(A==='B'?'#bddbfa':'#f1dce2'):(A==='B'?'#203e61':'#412f43');ctx.fillRect(.2*S,(A==='B'?41:.2)*S,(FW-.4)*S,12.8*S)}
  ctx.strokeStyle=light?'#789ab4':'#8ca8bd';ctx.lineWidth=1.5;ctx.setLineDash([.5*S,.35*S]);ctx.beginPath();ctx.moveTo(0,CENTER*S);ctx.lineTo(W,CENTER*S);ctx.stroke();ctx.setLineDash([]);
  const label=(txt,x,y,size=.65)=>{ctx.fillStyle=light?'#385c79':'#bfd3e4';ctx.font=`700 ${Math.max(7,size*S)}px 'Chakra Petch',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,x*S,y*S)};
  for(const A of ['B','T']){
    const a=M(A,DEPOT.x0,DEPOT.y0),b=M(A,DEPOT.x1,DEPOT.y1);ctx.strokeStyle=AC[A];ctx.lineWidth=1.4;ctx.setLineDash([4,3]);ctx.strokeRect(Math.min(a.x,b.x)*S,Math.min(a.y,b.y)*S,5*S,1.4*S);ctx.setLineDash([]);
    const o=M(A,OUTPOST.x,OUTPOST.y);arenaBlock(ctx,o.x-1,o.y-1.3,2,2.6,.5,AC[A],shade(AC[A],-.3),S);label(m.outpost[A],o.x,o.y,.9);
    const Y=BAR[A];
    for(const [a,b]of BUMPS){
      ctx.fillStyle=light?'#8ba9be':'#4b657b';ctx.fillRect(a*S,(Y-1.3)*S,(b-a)*S,2.6*S);
      ctx.fillStyle=light?'#adc7d9':'#648299';ctx.fillRect(a*S,(Y-1.3)*S,(b-a)*S,1.3*S);
      ctx.strokeStyle=light?'#dceaf2':'#8ba9bf';ctx.lineWidth=.8;for(let x=a+.2;x<b-.5;x+=.8){ctx.beginPath();ctx.moveTo(x*S,(Y-1.3)*S);ctx.lineTo((x+.5)*S,(Y+1.3)*S);ctx.stroke()}
    }
    for(const [a,b]of TRENCH){ctx.fillStyle='#294b64';ctx.fillRect(a*S,(Y-.9)*S,(b-a)*S,1.8*S);ctx.fillStyle='#b8d1e0';ctx.fillRect(a*S,(Y-1)*S,(b-a)*S,.2*S);ctx.fillRect(a*S,(Y+.8)*S,(b-a)*S,.2*S)}
  }
  label('NEUTRAL ZONE',5.3,37.7);label('MIDFIELD',23.5,26.4,.5);
  for(const [t,x,y]of [['DEPOT',7.5,51.6],['TRENCH',2,43],['TRENCH',25,43],['BUMP',7.6,43],['BUMP',19.4,43]])label(t,x,y);
  const fr=Math.max(1.4,.27*S);
  for(const f of m.fuel){ctx.fillStyle='#27415c35';ctx.beginPath();ctx.ellipse(f.x*S+.5,f.y*S+1,fr*1.1,fr*.7,0,0,7);ctx.fill();ctx.fillStyle='#ffdb35';ctx.strokeStyle='#a57912';ctx.lineWidth=Math.max(.65,S*.055);ctx.beginPath();ctx.arc(f.x*S,(f.y-.08)*S,fr,0,7);ctx.fill();ctx.stroke()}
  const objects=[];
  for(const A of ['B','T']){
    objects.push({y:BAR[A]+2.1,draw:()=>{const Y=BAR[A],active=m.active(A),top=active?AC[A]:(light?'#b7cddd':'#476076');arenaBlock(ctx,11.2,Y-2.1,4.6,4.2,1.4,top,shade(AC[A],-.4),S);
      ctx.fillStyle=light?'#214b6e':'#102536';rr(ctx,11.8*S,(Y-1.7)*S,3.4*S,1.3*S,.3*S);ctx.fill();ctx.strokeStyle=active?'#ffffff99':AC[A];ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle=active?'#fff':light?'#385b78':'#d9e9f7';ctx.font=`700 ${1.1*S}px 'Chakra Petch',sans-serif`;ctx.textAlign='center';ctx.fillText(m.sc[A].fuel,13.5*S,(Y+.5)*S)}});
    const tw=M(A,TOWER_C,52.8);objects.push({y:tw.y+1.2,draw:()=>{arenaBlock(ctx,tw.x-2.6,tw.y-1.2,5.2,2.4,.8,light?'#b1ccdf':'#526f86','#36546c',S);ctx.strokeStyle=AC[A];ctx.lineWidth=.18*S;ctx.strokeRect((tw.x-2.6)*S,(tw.y-1.5)*S,5.2*S,2.4*S);ctx.strokeStyle='#466a86';ctx.lineWidth=.12*S;for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo((tw.x-2.2)*S,(tw.y-1+k*.65)*S);ctx.lineTo((tw.x+2.2)*S,(tw.y-1+k*.65)*S);ctx.stroke()}}});
  }
  for(const r of m.robots)objects.push({y:r.y+1.4,draw:()=>{
    drawBot(ctx,r.tm.build,r.x*S,r.y*S,r.a,S,AC[r.A],{...bumpPose2026(r),num:r.tm.num,st:r.st,held:r.held,turretA:r.turretA,hl:r.isPlayer,hang:r.climbHang||r.climbLv>0});
    if(r.od>0||r.def>0||r.feed>0){ctx.strokeStyle=r.od>0?'#e4b127':r.def>0?'#ed5968':'#19ab83';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x*S,r.y*S,2*S,1.75*S,0,0,7);ctx.stroke()}

  }});
  objects.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
  // Compact bar-only overlays fade wherever they would cover field detail.
  for(const r of m.robots){
    const w=Math.max(30,3.6*S),h=Math.max(4,.45*S),x=clamp(r.x*S-w/2,0,W-w),y=clamp((r.y+1.9)*S,0,H-h);
    const fill=clamp(r.held/r.st.cap,0,1);
    ctx.save();ctx.font=`700 ${Math.max(8,.75*S)}px 'Chakra Petch',sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=2.5;ctx.strokeStyle='#102b42';ctx.strokeText(r.tm.num,x+w/2,y-12);ctx.fillStyle=r.isPlayer?'#ffe16b':'#fff';ctx.fillText(r.tm.num,x+w/2,y-12);
    const count=Math.floor(r.held)+'/'+r.st.cap;ctx.font=`800 ${Math.max(10,.9*S)}px 'Chakra Petch',sans-serif`;ctx.strokeText(count,x+w/2,y-1);ctx.fillStyle='#fff';ctx.fillText(count,x+w/2,y-1);ctx.restore();
    ctx.save();ctx.globalAlpha=fuelBarOpacity(m,{x:x/S,y:y/S,w:w/S,h:h/S},r);
    ctx.fillStyle='#17334b';rr(ctx,x,y,w,h,h/2);ctx.fill();
    ctx.fillStyle='#ffd247';if(fill>0){rr(ctx,x+1,y+1,Math.max(0,(w-2)*fill),h-2,Math.min(h/2,(w-2)*fill/2));ctx.fill()}
    ctx.restore();
  }

  for(const f of m.air){const k=f.t/f.dur,x=f.x0+(f.x1-f.x0)*k+(f.outletX||0)*(1-k),y=f.y0+(f.y1-f.y0)*k+(f.outletY||0)*(1-k),h=Math.sin(k*Math.PI)*f.arc+(f.outletZ||0)*(1-k);ctx.fillStyle='#0003';ctx.beginPath();ctx.arc(x*S,y*S,fr,0,7);ctx.fill();ctx.fillStyle='#ffe264';ctx.beginPath();ctx.arc(x*S,(y-h*.42)*S,fr*(1+h*.12),0,7);ctx.fill()}
  for(const e of m.fx){ctx.save();ctx.globalAlpha=Math.max(0,1-e.t/(e.k==='ring'?.5:1.6));if(e.k==='ring'){ctx.strokeStyle=e.col;ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x*S,e.y*S,S*(1+e.t*6),0,7);ctx.stroke()}else{ctx.font=`bold ${Math.max(10,S)}px sans-serif`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#19354b';ctx.strokeText(e.txt,e.x*S,(e.y-1-e.t*2)*S);ctx.fillStyle=e.col;ctx.fillText(e.txt,e.x*S,(e.y-1-e.t*2)*S)}ctx.restore()}
};
// Match-sized sprites retain equipment, turret aiming, and bump motion without
// transforming thousands of preview-model polygons for each of six robots.
const matchSpriteDraw=drawBot;
const terrainReducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
drawBot=function(ctx,b,x,y,a,s,col,o={}){
  if((o.year||curYear())!==2026)return matchSpriteDraw(ctx,b,x,y,a,s,col,o);
  ctx.save();ctx.translate(x,y-(o.elevation||0)*s*.42);
  if(!terrainReducedMotion.matches){ctx.rotate(a);ctx.transform(Math.cos(o.pitch||0),0,Math.sin(o.roll||0)*.12,Math.cos(o.roll||0),0,0);ctx.rotate(-a)}
  matchSpriteDraw(ctx,b,0,0,a,s,col,o);ctx.restore();
};

function fuelBarOpacity(m,bar,owner){
  const overlaps=(x,y,w,h)=>bar.x<x+w&&bar.x+bar.w>x&&bar.y<y+h&&bar.y+bar.h>y;
  return m.robots.some(r=>r!==owner&&overlaps(r.x-1.7,r.y-2.3,3.4,3.8))?.25:.9;
}
