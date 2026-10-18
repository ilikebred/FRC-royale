/* Count actual rendered match frames, not the fixed 30 Hz simulation ticks. */
const PerformanceUI=(()=>{
 let enabled=false,last=0,start=0,frames=0,meter=null;
 try{enabled=localStorage.getItem('frc-show-fps')==='on'}catch{}
 function node(){if(!meter){meter=document.createElement('output');meter.className='fps-meter';meter.setAttribute('aria-label','Rendered frames per second');meter.hidden=true;document.body.append(meter)}return meter}
 function stop(){last=start=frames=0;if(meter)meter.hidden=true}
 function set(value){enabled=!!value;try{localStorage.setItem('frc-show-fps',enabled?'on':'off')}catch{}stop()}
 function tick(now){if(!enabled||document.hidden){stop();return}const el=node();el.hidden=false;
 if(!last||now-last>1000){last=start=now;frames=0;el.textContent='FPS · measuring';return}
 frames++;last=now;if(now-start>=500){el.textContent=Math.round(frames*1000/(now-start))+' FPS';start=now;frames=0}}
 return {get enabled(){return enabled},set,tick,stop};
})();
