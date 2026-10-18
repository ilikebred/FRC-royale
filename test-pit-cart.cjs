const fs=require('fs'),vm=require('vm');const html=fs.readFileSync('index.html','utf8');const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);for(const s of scripts)new vm.Script(s);console.log('All inline JavaScript parses');
const noop=()=>{};const el=new Proxy({style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,querySelectorAll:()=>[],getContext:()=>({})},{get:(t,k)=>k in t?t[k]:noop});
const sandbox={console,Math,JSON,Date,Map,Set,Uint8Array,Float32Array,Int32Array,URL,URLSearchParams,performance:{now:()=>0},setTimeout:noop,setInterval:noop,clearTimeout:noop,clearInterval:noop,requestAnimationFrame:noop,cancelAnimationFrame:noop,localStorage:{getItem:()=>null,setItem:noop},navigator:{userAgent:'test'},location:{search:'',hostname:'localhost',protocol:'http:',href:'http://localhost'},document:{createElement:()=>el,querySelector:()=>el,querySelectorAll:()=>[],getElementById:()=>el,addEventListener:noop,documentElement:{style:{},dataset:{}},body:el},addEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop}),innerWidth:1000,innerHeight:900};sandbox.crypto=require("crypto").webcrypto;sandbox.window=sandbox;sandbox.screen={width:1000,height:900};vm.createContext(sandbox);
for(const s of scripts){if(s.includes('const SEASONS='))vm.runInContext(s,sandbox)}
vm.runInContext(fs.readFileSync('navigation.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('enhancements.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('dynamics.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('royale-models.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('robot-preview.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('performance-ui.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('workshop.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('auto-editor.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('arena.js','utf8'),sandbox);
const packedClips=vm.runInNewContext(fs.readFileSync('sounds/field-clips.js','utf8')+'\nFIELD_CLIPS');
for(const [name,encoded] of Object.entries(packedClips))if(!Buffer.from(encoded,'base64').equals(fs.readFileSync('sounds/'+name+'.mp3')))throw Error('Bundled sound differs from supplied MP3: '+name);
if(Object.keys(packedClips).length!==4||html.indexOf('sounds/field-clips.js')>html.indexOf('<script src="field-audio.js'))throw Error('Four bundled sounds must load before audio startup');
vm.runInContext(fs.readFileSync('field-audio.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('waypoint-auto.js','utf8'),sandbox);

const {createCanvas}=require(process.env.CANVAS_MODULE||'@napi-rs/canvas');
const canvas=createCanvas(1200,760),ctx=canvas.getContext('2d');ctx.fillStyle='#c8e8f8';ctx.fillRect(0,0,1200,760);sandbox.cartCanvas=ctx;
vm.runInContext(`
SAVE={season:2026};
const b={drive:{id:'swerve',lv:1},intake:{id:'otb',lv:1},hopper:{id:'net',lv:1},shooter:{id:'turret',lv:1},climber:{id:'none',lv:1}};
const beforeCart=JSON.stringify(robotModel(b,'#e5444e'));
if(Math.abs(pitRoll(20)-Math.PI/18)>1e-10||Math.abs(pitRoll(-20)+Math.PI/18)>1e-10)throw Error('Roll limit');
for(const [i,yaw] of [-.7,.8,2.4].entries())for(const [j,roll] of [0,.17].entries()){
 cartCanvas.save();cartCanvas.translate(i*400,j*380);draw3D(cartCanvas,400,350,b,'#e5444e',yaw,1001,true,roll);cartCanvas.fillStyle='#123657';cartCanvas.font='16px sans-serif';cartCanvas.fillText(j?'10° roll':'Level view',145,365);cartCanvas.restore();
}
if(JSON.stringify(robotModel(b,'#e5444e'))!==beforeCart)throw Error('Pit cart altered robot geometry');
`,sandbox);
fs.writeFileSync('pit-cart-preview.png',canvas.toBuffer('image/png'));
console.log('PASS: bounded roll, robot renderer at six angles, geometry unchanged');


// Remove only robot faces to prove every cart pixel is invariant under interaction.
vm.runInContext('RobotPreview.clear(); var originalPitModel=robotModel; robotModel=(...args)=>({...originalPitModel(...args),prims:[]});',sandbox);
ctx.clearRect(0,0,1200,760);
vm.runInContext("draw3D(cartCanvas,400,350,b,'#e5444e',-.7,1001,true,0,0)",sandbox);
const fixedCart=canvas.toBuffer('image/png');
ctx.clearRect(0,0,1200,760);
vm.runInContext("draw3D(cartCanvas,400,350,b,'#e5444e',2.4,1001,true,.17,.65)",sandbox);
if(!fixedCart.equals(canvas.toBuffer('image/png')))throw Error('Cart moved with robot');
vm.runInContext('robotModel=originalPitModel;RobotPreview.clear()',sandbox);
if(ctx.getImageData(0,0,1200,760).data.some(v=>v!==0))throw Error('Unexpected cart model or shadow in pit');
console.log('PASS: pit renderer draws no cart model or floor shadow');

vm.runInContext(`const rounded=robotModel(b,'#e5444e').prims.filter(p=>p.rounded);if(!rounded.length)throw Error('Rounded parts missing');for(const p of rounded)for(const f of prismFaces(p)){if(!f.n.every(Number.isFinite)||Math.abs(Math.hypot(...f.n)-1)>.00001)throw Error('Invalid bevel normal');for(const v of f.v)if(v[0]<p.x0-.00001||v[0]>p.x1+.00001||v[1]<p.y0-.00001||v[1]>p.y1+.00001||v[2]<p.z0-.00001||v[2]>p.z1+.00001)throw Error('Bevel outside part bounds')}`,sandbox);console.log('PASS: rounded parts preserve bounds and valid face normals');

vm.runInContext(`
const dot3=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function hitFace(f,eye,dir){const den=dot3(f.n,dir);if(Math.abs(den)<1e-8)return null;const t=dot3(f.n,f.v[0].map((x,i)=>x-eye[i]))/den;if(t<0)return null;const p=eye.map((x,i)=>x+t*dir[i]);let sign=0;for(let i=0;i<f.v.length;i++){const a=f.v[i],b=f.v[(i+1)%f.v.length],q=dot3(cross3(b.map((x,k)=>x-a[k]),p.map((x,k)=>x-a[k])),f.n);if(Math.abs(q)<1e-7)continue;const s=Math.sign(q);if(sign&&s!==sign)return null;sign=s}return t}
for(const sh of ['turret','dturret','superdumper']){
 const build={...b,shooter:{id:sh,lv:1}},g=RobotPreview.get(build,'#e5444e',2026);
 if(RobotPreview.get(build,'#e5444e',2026)!==g)throw Error('Geometry cache miss');
 for(let a=0;a<24;a++){
  const yaw=a*Math.PI/12,eye=[155*Math.cos(yaw),-155*Math.sin(yaw),35],ordered=RobotPreview.ordered(g.tree,eye);
  for(const z of [5,12,19])for(const y of [-8,0,8]){const target=[.371,y+.137,z+.193],dir=target.map((v,i)=>v-eye[i]);let last=Infinity;
   for(const f of ordered){const t=hitFace(f,eye,dir);if(t===null)continue;if(t>last+.0001)throw Error('Occlusion order inverted at '+sh+' angle '+a+' t '+t+' last '+last+' face '+JSON.stringify(f.v));last=t}
  }
 }
}
`,sandbox);
console.log('PASS: occlusion ray checks across 24 angles and three shooter configurations; geometry cache reused');
