const fs=require('fs');
const bootstrap=fs.readFileSync('test.cjs','utf8').split('const packedClips=')[0];
const {sandbox,vm}=new Function('require',bootstrap+';return {sandbox,vm}')(require);
for(const file of ['waypoint-auto.js','boost-targeting.js','multiplayer.js','gameplay.js','matchmaking.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
vm.runInContext(`
const assert=(v,m)=>{if(!v)throw Error(m)};
SAVE=freshSave(2026);SAVE.team={num:254,name:'Rank test',district:'ca'};persist=()=>{};screenOnlineMatch=()=>{};
assert(leagues().length===8&&leagues()[1].name==='Week 2'&&leagues()[7].name==='Einstein Championships','all eight ranks, including district teams');
for(let i=1;i<8;i++){assert(leagueOf(LEVEL_RP[i]-1)===i-1&&leagueOf(LEVEL_RP[i])===i,'exact promotion boundary');if(i>1)assert(LEVEL_RP[i]-LEVEL_RP[i-1]===2*(LEVEL_RP[i-1]-LEVEL_RP[i-2]),'exponential promotion cost')}
assert(new Set(LEVEL_RP.map(rankBadge)).size===8,'eight distinct rank icons');
assert(!closeRanks(2,37),'bottom and top Week 1 do not match');
assert(!closeRanks(37,282),'Week 1 and Week 4 do not match');
assert(closeRanks(30,37)&&closeRanks(39,40),'nearby RP and adjacent-rank boundaries match');
assert(!closeRanks(5080,10000),'Einstein still respects RP distance');
const rows=values=>values.map((rp,i)=>({id:String(i+1).padStart(20,'0'),rp}));
assert(rankedCandidates(rows([0,5,10,15]),'00000000000000000002',4).length===0,'every player in a group must be close, not just each close to one leader');
const six=rows([25,26,27,28,30,32]),group=rankedCandidates(six,six[0].id,6),balanced=balancedRoster(group,3);
assert(group.length===6&&balanced[0].id===six[0].id&&new Set(balanced.map(x=>x.id)).size===6,'balanced roster keeps leader and every player');
const difference=Math.abs(balanced.slice(0,3).reduce((n,p)=>n+p.rp,0)-balanced.slice(3).reduce((n,p)=>n+p.rp,0));assert(difference===0,'3v3 alliances balance RP');
const q=new PublicQueue(1,()=>{},()=>{});q.send=()=>{};
const search=(id,rp)=>({q:QUEUE_VERSION,kind:'search',id,year:2026,mode:1,rp,team:queueTeam()});
q.receive(search('00000000000000000001',37));assert(q.players.size===0,'distant searching player is not counted');q.receive(search('00000000000000000002',4));assert(q.players.size===1,'nearby player joins candidate pool');
const partial=new PublicQueue(2,message=>partial.message=message,()=>{});partial.rp=7;partial.send=()=>{};for(const p of rows([0,14,15]))partial.players.set(p.id,{...p,team:queueTeam(),seen:Date.now()});partial.pulse();assert(partial.message.startsWith('3 / 4'),'queue counter only counts a mutually compatible group');
{
 const oldShow=show;let markup='';const captured={};show=html=>{markup=html;throw captured};
 for(const rp of [0,39,40,5080,6000]){SAVE.trophies=rp;try{screenPit()}catch(e){if(e!==captured)throw e}assert(markup.includes('Competitive rank')&&markup.includes('rank-badge')&&!markup.includes('NaN')&&!markup.includes('Infinity'),'rank panel renders finite progress');if(rp>=5080)assert(markup.includes('Highest rank achieved'),'Einstein shows max-rank state')}
 SAVE.trophies=0;show=oldShow;
}
console.log('PASS: exponential ladder, boundaries, distinct icons, within-rank matching, cross-rank matching and balanced alliances');
{
 const profile=SAVE;profile.trophies=39;profile.rec={played:0,w:0,l:0,t:0,rp:0,best:0};
 const roster=[{id:'00000000000000000001',rp:39,team:queueTeam()},{id:'00000000000000000002',rp:39,team:{...queueTeam(),num:987}}];
 const s=new OfficialSession({code:'AAAAAAAAAA',players:roster},roster[0].id,1,()=>{});s.send=()=>true;s.start();s.run.step();s.run.m.rpInfo=()=>({n:4,chips:[['Victory',true]]});s.run.m.over=true;
 // Even when another profile is selected, finish the profile that joined.
 SAVE=freshSave(2026);SAVE.team={num:999,name:'Other profile'};s.advanceClock(0);
 assert(profile.rec.played===1&&profile.rec.rp===4&&profile.trophies===43,'completion records RP and match without a results paint');
 assert(SAVE.rec.played===0,'another profile is not credited');
 const entry=profile.matches[0];assert(entry.official&&entry.mode===1&&entry.rpN===4&&entry.tr===4&&entry.league==='Week 1'&&entry.leagueAfter==='Week 2'&&entry.promoted,'history records rank promotion');
 assert(entry.us.bots.length===3&&entry.them.bots.length===3&&entry.rows.length&&entry.cols.length&&entry.season.year===2026,'complete history summary');
 assert(matchLabel(entry).includes('Official 1v1'),'history labels official matches');
 const credits=profile.credits;s.settle();s.close();assert(profile.rec.played===1&&profile.matches.length===1&&profile.credits===credits,'no double counting results or close');
 // Same persisted result cannot be paid a second time by another session instance.
 SAVE=profile;const duplicate=new OfficialSession({code:'AAAAAAAAAA',players:roster},roster[0].id,1,()=>{});duplicate.send=()=>true;duplicate.start();duplicate.config.seed=s.config.seed;duplicate.run.m.over=true;duplicate.settle();assert(profile.rec.played===1&&profile.credits===credits,'saved match ID guards duplicate settlement');duplicate.closed=true;
 const showBefore=show,queryBefore=app.querySelector;let html='';show=value=>html=value;app.querySelector=()=>({});screenSummary(entry,false);show=showBefore;app.querySelector=queryBefore;
 assert(html.includes('Official 1v1')&&html.includes('Week 2')&&html.includes('Your alliance'),'saved official history renders in normal summary');
 console.log('PASS: background settlement, correct profile, persistent record/history, rank promotion, duplicate guards and history rendering');
}
`,sandbox);
