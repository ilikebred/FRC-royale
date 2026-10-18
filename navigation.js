/* One field geometry and planner for simulation, drawn routes and AUTO estimates. */
function blocked2026(r,x,y,auto=false){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<ROB_R||x>FW-ROB_R||y<ROB_R||y>FL-ROB_R)return true;
  if(auto&&(r.A==='B'?y<CENTER+ROB_R*.4:y>CENTER-ROB_R*.4))return true;
  for(const Y of [BAR.B,BAR.T]){
    if(Math.abs(y-Y)<2.1&&x>HUBX[0]-ROB_R*.6&&x<HUBX[1]+ROB_R*.6)return true;
    if(Math.abs(y-Y)<1.05){
      const bump=BUMPS.some(([a,b])=>x>a+.6&&x<b-.6);
      const trench=r.st.low&&TRENCH.some(([a,b])=>x>=a+ROB_R&&x<=b-ROB_R);
      if(!bump&&!trench)return true;
    }
  }
  for(const A of ['B','T']){const p=M(A,TOWER_C,52.8);if(Math.abs(x-p.x)<2.6&&Math.abs(y-p.y)<1.2+ROB_R*.6)return true}
  return false;
}
Match.prototype.blocked=function(r,x,y){return blocked2026(r,x,y,this.t<this.R.auto)};
function clearSegment(a,b,blocked){
  const n=Math.max(1,Math.ceil(dist(a,b)/.18));
  for(let i=0;i<=n;i++)if(blocked({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;
  return true;
}
const navGrids=new Map();
function navigation2026(start,goal,st,A='B',auto=false,strict=false){
  const r={st,A},blocked=p=>blocked2026(r,p.x,p.y,auto);
  let end={x:goal.x,y:goal.y};
  if(blocked(start))return [];
  if(blocked(end)){
    if(strict)return [];
    let found=null;
    for(let rad=.25;rad<=3&&!found;rad+=.25)for(let i=0;i<24;i++){
      const p={x:goal.x+Math.cos(i*Math.PI/12)*rad,y:goal.y+Math.sin(i*Math.PI/12)*rad};
      if(!blocked(p)&&(!found||dist(start,p)<dist(start,found)))found=p;
    }
    if(!found)return [];end=found;
  }
  if(clearSegment(start,end,blocked))return [end];
  const step=.5,nx=55,ny=109,key=[!!st.low,A,auto].join(':'),count=nx*ny;
  let grid=navGrids.get(key);
  if(!grid){grid=new Uint8Array(count);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)grid[y*nx+x]=!blocked({x:x*step,y:y*step});navGrids.set(key,grid)}
  const point=i=>({x:(i%nx)*step,y:Math.floor(i/nx)*step});
  const nearest=p=>{let best=-1,d=Infinity;const xx=Math.round(p.x/step),yy=Math.round(p.y/step);for(let y=yy-2;y<=yy+2;y++)for(let x=xx-2;x<=xx+2;x++){
    const i=y*nx+x;if(x<0||y<0||x>=nx||y>=ny||!grid[i])continue;const q=point(i),v=dist(p,q);if(v<d&&clearSegment(p,q,blocked)){best=i;d=v}}
    return best};
  const s=nearest(start),g=nearest(end);if(s<0||g<0)return [];
  const costs=new Float64Array(count).fill(Infinity),prev=new Int32Array(count).fill(-1),closed=new Uint8Array(count),heap=[];
  const push=(id,f)=>{let i=heap.length;heap.push({id,f});while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p}heap[i]={id,f}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c}heap[i]=last}return top.id};
  costs[s]=0;push(s,dist(point(s),end));
  while(heap.length){const i=pop();if(closed[i])continue;if(i===g)break;closed[i]=1;const p=point(i),ix=i%nx,iy=Math.floor(i/nx);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const x=ix+dx,y=iy+dy,j=y*nx+x;if(x<0||y<0||x>=nx||y>=ny||!grid[j]||closed[j])continue;
      const q=point(j);if(!clearSegment(p,q,blocked))continue;
      const bump=Math.min(Math.abs(q.y-BAR.B),Math.abs(q.y-BAR.T))<1.3&&BUMPS.some(([a,b])=>q.x>a&&q.x<b);
      const cost=costs[i]+Math.hypot(dx,dy)*step*(bump?1/Math.max(.25,st.bump):1);
      if(cost<costs[j]){costs[j]=cost;prev[j]=i;push(j,cost+dist(q,end))}
    }
  }
  if(!Number.isFinite(costs[g]))return [];
  const raw=[end];for(let i=g;i!==s;i=prev[i]){if(i<0)return [];raw.push(point(i))}raw.push(point(s));raw.push(start);raw.reverse();
  // Remove grid stair-steps, checking the full swept segment before each shortcut.
  const path=[];let at=0;while(at<raw.length-1){let next=raw.length-1;while(next>at+1&&!clearSegment(raw[at],raw[next],blocked))next--;path.push(raw[next]);at=next}
  return path;
}
Match.prototype.planPath=function(r,to){r.pathFrom={x:r.x,y:r.y};r.path=navigation2026(r,to,r.st,r.A,this.t<this.R.auto)};
function plannedAutoRoute(auto,st){
  const start={x:START_POS[auto.start][0],y:START_POS[auto.start][1]},blocked=p=>blocked2026({st,A:'B'},p.x,p.y,true);
  let from=start,path=[];
  for(const p of auto.path||[]){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||blocked(p))return {start,path:[],valid:false};const leg=navigation2026(from,p,st,'B',true,true);if(!leg.length)return {start,path:[],valid:false};path.push(...leg);from=p}
  return {start,path:smoothRoute([start,...path],blocked).slice(1),valid:true};
}
function autoRouteTiming(auto,st){
  const route=plannedAutoRoute(auto,st);if(!route.valid)return {...route,time:0};
  return {...route,...driveTravel2026(route.start,route.path,st)};
}
function driveTravel2026(start,path,st){
  const r={...start,a:-Math.PI/2,A:'B',st,path:path.map(p=>({...p})),pathFrom:start,held:0};
  const world={blocked:(r,x,y)=>blocked2026(r,x,y,true),hub:()=>({x:13.5,y:41}),planPath:()=>{}};
  let t=0;while((r.path.length||(r.driveSpeed||0)>.1)&&t<24){drive2026(world,r,1/30);t+=1/30}
  return {time:t,end:[r.x,r.y]};
}
function estimatedDrive2026(from,to,st){
  const start={x:from[0],y:from[1]},goal={x:to[0],y:to[1]},raw=navigation2026(start,goal,st,'B',true);
  if(!raw.length)return 24;
  const path=smoothRoute([start,...raw],p=>blocked2026({A:'B',st},p.x,p.y,true)).slice(1);
  return driveTravel2026(start,path,st).time;
}
