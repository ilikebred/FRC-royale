const fs=require('fs');const m=JSON.parse(fs.readFileSync('.openai/hosting.json'));m.static={directory:'dist'};fs.writeFileSync('.openai/hosting.json',JSON.stringify(m,null,2));fs.mkdirSync('dist',{recursive:true});for(const f of ['index.html','boost-targeting.js','performance-ui.js','multiplayer.js','multiplayer-clock.js','enhancements.js','enhancements.css','royale.css','royale-models.js','robot-preview.js','robot-gpu.js','dynamics.js','field-audio.js','waypoint-auto.js','navigation.js','auto-editor.js','arena.js','arena.css','workshop.js','workshop.css','arcade-theme.css','sw.js','manifest.webmanifest'])fs.copyFileSync(f,'dist/'+f);fs.cpSync('icons','dist/icons',{recursive:true});

require('./build-sounds.cjs');
fs.cpSync('sounds','dist/sounds',{recursive:true});
