/* Static BSP geometry: split intersecting faces once, then traverse from the camera.
   Unlike average-depth sorting, this preserves occlusion throughout a full turn. */
const RobotPreview=(()=>{
  const cache=new Map(),EPS=1e-5;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  function split(face,n,d){
    const distances=face.v.map(v=>dot(n,v)-d),front=[],back=[];
    for(let i=0;i<face.v.length;i++){
      const j=(i+1)%face.v.length,a=face.v[i],b=face.v[j],da=distances[i],db=distances[j];
      if(da>=-EPS)front.push(a);if(da<=EPS)back.push(a);
      if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)){
        const t=da/(da-db),p=a.map((x,k)=>x+(b[k]-x)*t);front.push(p);back.push(p);
      }
    }
    return [front,back].map(v=>v.length>=3?{...face,v}:null);
  }
  function tree(faces){
    if(!faces.length)return null;
    // A handful of candidates avoids pathological trees of parallel mesh rails.
    let plane=faces[0],best=Infinity;
    for(let k=0;k<Math.min(9,faces.length);k++){
      const f=faces[Math.floor(k*faces.length/Math.min(9,faces.length))],d=dot(f.n,f.v[0]);let a=0,b=0,s=0;
      for(const p of faces){let pos=false,neg=false;for(const v of p.v){const q=dot(f.n,v)-d;pos||=q>EPS;neg||=q<-EPS}if(pos)a++;if(neg)b++;if(pos&&neg)s++}
      const cost=s*4+Math.abs(a-b);if(cost<best){best=cost;plane=f}
    }
    const n=plane.n,d=dot(n,plane.v[0]),same=[],front=[],back=[];
    for(const f of faces){let pos=false,neg=false;for(const v of f.v){const q=dot(n,v)-d;pos||=q>EPS;neg||=q<-EPS}
      if(pos&&neg){const [a,b]=split(f,n,d);if(a)front.push(a);if(b)back.push(b)}
      else if(pos)front.push(f);else if(neg)back.push(f);else same.push(f);
    }
    return {n,d,same,front:tree(front),back:tree(back)};
  }
  function get(build,color,year){
    const key=JSON.stringify([year,build,color]);if(cache.has(key))return cache.get(key);
    const model=robotModel(build,color,year),faces=[];
    for(const p of model.prims){
      for(const f of prismFaces(p)){
      if(!f.n.every(Number.isFinite)||Math.hypot(...f.n)<.5)continue;
      if(f.v.every(v=>Math.abs(dot(f.n,v)-dot(f.n,f.v[0]))<1e-5)){faces.push({...f,soft:!!p.rounded,twoSided:p.k==='mesh'});continue}
      for(let i=1;i<f.v.length-1;i++){
        const v=[f.v[0],f.v[i],f.v[i+1]],a=v[1].map((x,j)=>x-v[0][j]),b=v[2].map((x,j)=>x-v[0][j]);
        let n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);if(len<1e-8)continue;
        n=n.map(x=>x/len);if(dot(n,f.n)<0)n=n.map(x=>-x);
        faces.push({...f,v,n,soft:!!p.rounded,twoSided:p.k==='mesh'});
      }
    }
    }
    const result={model,tree:tree(faces)};if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  }
  function ordered(root,eye){const result=[];function walk(node){if(!node)return;const front=dot(node.n,eye)>node.d;walk(front?node.back:node.front);result.push(...node.same);walk(front?node.front:node.back)}walk(root);return result}
  return {get,ordered,clear:()=>cache.clear()};
})();
