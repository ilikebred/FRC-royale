/* BOTS service worker — version royale-v53
   The game is one self-contained page, so it is cached whole and plays offline.
   Pages: network first (picks up new versions), falling back to the cache when offline.
   Same-origin files: cache first. Anything else (the Supabase leaderboard) always goes to the network. */
const CACHE='bots-royale-v53', FILES=["gameplay.js?v=50", "matchmaking.js?v=53", "match-layout.css?v=53", "performance-ui.js?v=48", "icons/pit-stadium-soft.png", "icons/pit-cart-foreground.png", "arcade-theme.css?v=48", "multiplayer-clock.js?v=34", "boost-targeting.js?v=48", "multiplayer.js?v=53", "sounds/field-clips.js?v=31", "sounds/frc-start-sound.mp3", "sounds/frc-end.mp3", "sounds/frc-resume.mp3", "sounds/frc-warning.mp3", "waypoint-auto.js?v=26", "field-audio.js?v=48", "navigation.js?v=26", "auto-editor.js?v=26", "arena.js?v=48", "arena.css?v=34", "dynamics.js?v=29", "workshop.js?v=50", "workshop.css?v=41", "royale.css?v=26", "royale-models.js?v=48", "robot-preview.js?v=47", "robot-gpu.js?v=47", "icons/royale.svg?v=26", "enhancements.js?v=26", "enhancements.css?v=26", "./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('bots-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin||url.pathname.endsWith('.apk')) return;   // APK downloads always come fresh
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put('index.html',c));return r}).catch(()=>caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c))}return r})));
});
// push notifications (new seasons / announcements) — sent by the BOTS Admin app through the send-push function
self.addEventListener('push',e=>{
  let d={}; try{d=e.data?e.data.json():{}}catch(x){d={title:'BOTS',body:e.data?e.data.text():''}}
  const badge=('setAppBadge' in self.navigator)?self.navigator.setAppBadge().catch(()=>{}):Promise.resolve();
  e.waitUntil(Promise.all([badge,self.registration.showNotification(d.title||'BOTS',{body:d.body||'',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:d.tag||'bots-news',renotify:true,data:{url:d.url||'./'}})]));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if(c.url.startsWith(self.registration.scope)&&'focus' in c){c.postMessage({type:'bots-news'});return c.focus()}}
    return clients.openWindow(url);
  }));
});
