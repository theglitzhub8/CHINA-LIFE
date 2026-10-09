// ChinaLife request scheduler (performance Batch 1).
// Every repeating server check runs through one loop per name, so a check can never be started twice and never
// overlaps itself. Intervals get ±15% jitter so phones do not hit the server in step; failures back off
// exponentially (with jitter, up to 60 s) and recover by themselves; coming back to the game re-checks at once.
// Mode 'adaptive' uses each loop's adaptive interval; 'legacy' uses the previous fixed timers (rollback). The
// server sets the mode (polling-config.php); localStorage 'chinalife-polling' can force one on a device.
(()=>{
 const loops=new Map();
 let mode=(()=>{try{const v=localStorage.getItem('chinalife-polling');return v==='legacy'||v==='adaptive'?v:'adaptive'}catch{return 'adaptive'}})(),forced=(()=>{try{return !!localStorage.getItem('chinalife-polling')}catch{return false}})();
 const jitter=ms=>Math.round(ms*(.85+Math.random()*.3));
 function loop(name,fn,{every,legacyEvery,maxBackoff=60000}={}){
  if(loops.has(name))return loops.get(name);
  const L={name,timer:null,running:false,again:false,failures:0,next:0,count:0,
   interval(){const v=mode==='legacy'?legacyEvery:(typeof every==='function'?every():every);return Math.max(250,Number(v)||legacyEvery||10000)},
   schedule(ms){clearTimeout(L.timer);L.next=Date.now()+ms;L.timer=setTimeout(L.tick,ms)},
   async tick(){if(L.running){L.again=true;return}L.running=true;L.count++;let failed=false;
    try{failed=(await fn())===false}catch{failed=true}finally{L.running=false}
    L.failures=failed?Math.min(L.failures+1,8):0;
    const base=L.interval(),wait=L.failures?Math.min(maxBackoff,base*2**L.failures):base;
    if(L.again){L.again=false;L.schedule(jitter(200))}else L.schedule(jitter(wait))},
   // Run soon (coalesced): used when a change counter moved or the player came back.
   kick(delay=150){if(L.running){L.again=true;return}if(L.next-Date.now()>delay)L.schedule(delay+Math.random()*250)},
   // Re-plan after the adaptive interval changed (e.g. someone walked into your venue).
   refresh(){const want=L.interval();if(!L.running&&!L.failures&&L.next-Date.now()>want)L.schedule(jitter(want))}};
  loops.set(name,L);L.schedule(Math.random()*Math.min(1500,L.interval()));return L}
 const all=fn=>loops.forEach(fn);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)all(L=>L.kick(300+Math.random()*700))});
 window.addEventListener('online',()=>all(L=>{L.failures=0;L.kick(500)}));
 window.ChinaLifePoll={loop,
  // Run a check now and wait for it (tests and debugging).
  run:async name=>{const L=loops.get(name);if(L)await L.tick()},
  kick:(name,delay)=>loops.get(name)?.kick(delay),
  refresh:name=>name?loops.get(name)?.refresh():all(L=>L.refresh()),
  get mode(){return mode},
  setMode(m){if(forced||(m!=='legacy'&&m!=='adaptive')||m===mode)return;mode=m;all(L=>L.refresh())},
  stats:()=>[...loops.values()].map(L=>({name:L.name,runs:L.count,failures:L.failures,interval:L.interval(),next:Math.max(0,L.next-Date.now())}))};
})();
