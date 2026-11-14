// Energy Phase 7 (docs/ENERGY-PLAN.md, appadmin switch energy_loop, default ON): reasons to come back, in one place.
// 1. Welcome back: once a Beijing day, when the daily reward is ready, a card with the 7-day streak ladder and one big
//    Claim (the existing daily reward: daily.php / game.claimDaily, ¥50 and 20 XP times the streak day, up to day 7).
// 2. First visit of the day: each of the seven places pays ¥20 + 5 XP the first time you arrive that day, and all
//    seven pay a ¥100 + 20 XP bonus (daily-visit.php, server ledger). A small chip says so; the seventh celebrates.
// 3. Live pulses: a dock button pulses when something waits there (open matches, an open vote you have not cast, a
//    low need at the hospital, a finished Gossip task to collect).
// 4. ChinaLifeCelebrate(title, line): one shared celebration (banner, confetti, a short chime) for rewards and wins.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('energy_loop')!==false;
const signed=()=>!!window.ChinaLifeCloud?.signedIn&&!!window.ChinaLifeAuth?.request;
const bj=(back=0)=>new Date(Date.now()+8*3600e3-back*864e5).toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
// ---- 4. Celebrate ----
let actx=null;
function chime(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;actx||=new A();if(actx.state!=='running')actx.resume?.();const v=.12*(window.ChinaLifeAudio?.volume??.5)/.5;
 [523.25,659.25,783.99,1046.5].forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime+i*.09;o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,Math.min(.3,v)),t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.35);o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+.4)})}catch{}}
function celebrate(title,line='',{big=true}={}){const host=document.body;if(!host)return;
 const b=document.createElement('div');b.className='en-burst'+(big?' big':'');b.setAttribute('role','status');b.innerHTML='<b>'+esc(title)+'</b>'+(line?'<small>'+esc(line)+'</small>':'');host.appendChild(b);setTimeout(()=>b.remove(),big?3000:2400);
 if(big&&!reduce()){const colors=['#ffe14d','#ff5a5f','#4ade80','#38bdf8','#e0399b','#f2b33d'];for(let i=0;i<36;i++){const c=document.createElement('i');c.className='en-confetti';c.style.left=(4+((i*53)%92))+'%';c.style.background=colors[i%colors.length];c.style.animationDelay=(i%9)*60+'ms';c.style.setProperty('--x',((i%7)-3)*22+'px');host.appendChild(c);setTimeout(()=>c.remove(),2600)}}
 if(big)chime();try{navigator.vibrate?.(big?[30,40,60]:[20])}catch{}}
// ---- 1. Welcome back ----
const WKEY='chinalife-welcome-day';
const streakNext=s=>s.lastVisit===bj(1)?Math.min((s.streak||0)+1,7):1;
function busy(){return !!document.querySelector('dialog[open]')||!!$('enWelcome')||document.documentElement.classList.contains('fb-open')||!!document.querySelector('.coach-card:not([hidden]),.r3-coach:not([hidden])')}
function welcome(force=false){const g=G(),s=g?.state;if(!on()||!s?.created||(!force&&store.get(WKEY)===bj()))return false;if(!g.rankInfo?.()?.daily)return false;if(!force&&(busy()||document.hidden))return false;
 store.set(WKEY,bj());const n=streakNext(s);
 const tiles=[1,2,3,4,5,6,7].map(d=>'<li class="'+(d<n?'done':d===n?'today':'')+'"><small>Day '+d+'</small><b>'+(d<n?'✓':'¥'+50*d)+'</b>'+(d===7?'<em>MAX</em>':'')+'</li>').join('');
 const ov=document.createElement('div');ov.id='enWelcome';ov.className='en-welcome';
 ov.innerHTML='<div class="en-card"><p class="en-kicker">'+(n>1?'Welcome back!':'Welcome to a new day!')+'</p><h2>🔥 Day '+n+' streak</h2><p class="en-sub">'+(n>1?'You came back '+n+' days in a row. Don’t break the chain!':'Come back tomorrow and the reward grows, up to day 7.')+'</p><ol class="en-ladder">'+tiles+'</ol>'+
  '<button type="button" class="en-claim">Claim +¥'+50*n+' · +'+20*n+' XP</button><button type="button" class="en-later">Later</button></div>';
 document.body.appendChild(ov);
 ov.querySelector('.en-later').onclick=()=>ov.remove();
 ov.querySelector('.en-claim').onclick=async e=>{const btn=e.currentTarget;btn.disabled=true;btn.textContent='Claiming…';
  try{let r=null;if(signed()&&window.ChinaLifeCloud.claimDaily)r=await window.ChinaLifeCloud.claimDaily();else await g.claimDaily?.();
   const day=Number(r?.streak)||n;ov.remove();g.refresh?.();celebrate('🔥 Day '+day+' streak!','+¥'+(Number(r?.money)||50*day)+' · +'+(Number(r?.xp)||20*day)+' XP')}
  catch(err){btn.disabled=false;btn.textContent='Try again';g.toast?.(err?.message||'Could not claim right now')}};
 return true}
// ---- 2. First visit of the day ----
const PLACES=['night','gist','voting','football','hq','cityhospital','university'];
let visited=new Set(),visitDay='',lastPlace=null,visiting=false,retry=0;
async function loadVisits(){if(!signed())return;try{const r=await window.ChinaLifeAuth.request('/chinalife/daily-visit.php'),d=r?.data||r;if(Array.isArray(d?.visited)){visited=new Set(d.visited);visitDay=bj()}}catch{}}
// Outside the shared city the server first notes the arrival and pays after 30 s at the place (daily-visit.php).
const here=place=>G()?.state?.place===place&&!visited.has(place);
async function visit(place){if(visiting||!signed())return;visiting=true;
 try{const r=await window.ChinaLifeAuth.request('/chinalife/daily-visit.php','POST',{place,op:'arrive'}),w=Math.max(0,Number((r?.data||r)?.wait)||0);
  if(w){setTimeout(()=>{if(here(place))pay(place)},w*1000+800);return}}
 catch{if(retry++<2)setTimeout(()=>{lastPlace=null},12000);return}finally{visiting=false}
 pay(place)}
async function pay(place){if(visiting||!signed())return;visiting=true;
 try{const r=await window.ChinaLifeAuth.request('/chinalife/daily-visit.php','POST',{place}),d=r?.data||r;visited.add(place);
  if(d&&!d.duplicate&&d.awarded){G().applyServerTotals?.(d);G().save?.();G().refresh?.();
   if(d.all)celebrate('🗺️ All 7 places today!','+¥'+d.awarded+' · +'+d.awardedXp+' XP · come back tomorrow');
   else celebrate('📍 First visit today','+¥'+d.awarded+' · +'+d.awardedXp+' XP · '+visited.size+' of 7 places',{big:false})}}
 catch{if(retry++<2)setTimeout(()=>{lastPlace=null},12000)}finally{visiting=false}}
function watchPlace(){const s=G()?.state;if(!on()||!s?.created)return;if(visitDay!==bj()){visitDay=bj();visited=new Set();loadVisits()}
 const p=s.place;if(p===lastPlace)return;lastPlace=p;if(PLACES.includes(p)&&!visited.has(p))setTimeout(()=>{if(G()?.state?.place===p)visit(p)},4000)}
// ---- 3. Live pulses on the dock ----
let footballOpen=0,footballAt=0,voteWaiting=false,voteAt=0;
async function refreshLive(){const s=G()?.state;if(!s)return;const now=Date.now();
 if(s.place==='football'&&now-footballAt>30000){footballAt=now;try{const f=await window.ChinaLifeFootball?.summary?.();footballOpen=f?.enabled?(f.lobbies?.length||0)+(f.tournaments?.length||0):0}catch{footballOpen=0}}
 if(s.place==='voting'&&signed()&&now-voteAt>60000){voteAt=now;try{const r=await window.ChinaLifeAuth.request('/chinalife/politics.php?city='+encodeURIComponent(s.city)),d=r?.data||r,open=Object.keys(d?.elections||{});
  voteWaiting=!window.ChinaLifeFlags?.off?.('politics')&&open.some(o=>!(d.voted_offices||[]).includes(o)&&(d.candidates||[]).some(c=>c.office===o))}catch{voteWaiting=false}}}
function pulses(){const s=G()?.state;if(!s)return;const live=on();
 const mark=(sel,yes,why)=>{const b=document.querySelector(sel);if(!b)return;b.classList.toggle('live',live&&!!yes);if(live&&yes)b.dataset.liveWhy=why;else delete b.dataset.liveWhy};
 mark('#placeDock[data-place="football"] [data-pd="play"]',footballOpen>0,'Open matches waiting');
 mark('#placeDock[data-place="voting"] [data-pd="vote"]',voteWaiting,'You have a vote to cast');
 mark('#placeDock[data-place="cityhospital"] [data-pd="health"]',Object.values(s.needs||{}).some(v=>v<30),'A need is low');
 const t=window.ChinaLifeGossipRoom?.today?.tasks;mark('#gossipDock [data-gd="room"]',Array.isArray(t)&&t.some(x=>x.done&&!x.claimed),'A task is ready to collect')}
function tick(){if(!G())return;watchPlace();refreshLive().then(pulses);pulses();welcome()}
setInterval(tick,3000);window.addEventListener?.('chinalife:update',()=>pulses());
window.ChinaLifeCelebrate=celebrate;
window.ChinaLifeEnergy={welcome,visit,pay,watchPlace,pulses,refreshLive,celebrate,get visited(){return [...visited]},streakNext};
const css=document.createElement('style');css.textContent=
 '.en-welcome{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:16px;background:rgb(8 20 22 / .66);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);animation:enFade .25s ease-out}'+
 '.en-card{width:min(360px,100%);display:grid;gap:10px;justify-items:center;text-align:center;padding:22px 18px 16px;border-radius:26px;background:linear-gradient(165deg,#0c3f44,#082528);color:#f7fff7;box-shadow:0 24px 60px rgb(0 0 0 / .5);animation:enPop .45s cubic-bezier(.34,1.56,.64,1)}'+
 '.en-kicker{margin:0;font-size:13px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#f2b33d}.en-card h2{margin:0;font-size:30px}.en-sub{margin:0;font-size:14px;color:#cfe9e4}'+
 '.en-ladder{list-style:none;margin:6px 0;padding:0;display:grid;grid-template-columns:repeat(7,1fr);gap:5px;width:100%}.en-ladder li{display:grid;place-items:center;gap:2px;padding:7px 0;border-radius:12px;background:rgb(255 255 255 / .08);position:relative}'+
 '.en-ladder small{font-size:9px;opacity:.75}.en-ladder b{font-size:11px}.en-ladder li.done{background:rgb(74 222 128 / .22)}.en-ladder li.done b{color:#4ade80;font-size:15px}'+
 '.en-ladder li.today{background:linear-gradient(180deg,#ffe14d,#f2a516);color:#3a2600;transform:scale(1.12);box-shadow:0 6px 16px rgb(242 165 22 / .5)}.en-ladder em{position:absolute;top:-8px;font-style:normal;font-size:8px;font-weight:900;background:#ff5a5f;color:#fff;border-radius:6px;padding:1px 4px}'+
 '.en-claim{width:100%;min-height:54px;border:0;border-radius:18px;background:linear-gradient(180deg,#fff06a,#ffc81e);color:#13311f;font:900 18px/1 system-ui,sans-serif;box-shadow:0 5px 0 #b8870a;animation:enPulse 1.8s ease-in-out infinite}.en-claim:disabled{opacity:.7;animation:none}'+
 '.en-later{border:0;background:none;color:#a6c9c4;font-weight:700;padding:6px}'+
 '.en-burst{position:fixed;left:50%;top:22%;z-index:2147482500;display:grid;justify-items:center;gap:2px;padding:10px 18px;border-radius:18px;background:rgb(14 8 30 / .9);color:#fff;transform:translateX(-50%);box-shadow:0 12px 30px rgb(0 0 0 / .35);animation:enBurst 2.4s ease-out forwards;pointer-events:none;text-align:center;max-width:calc(100vw - 32px)}'+
 '.en-burst.big{top:30%;padding:16px 24px;background:linear-gradient(135deg,#7b3fe4,#e0399b);animation-duration:3s}.en-burst b{font-size:15px}.en-burst.big b{font-size:24px}.en-burst small{font-size:13px;opacity:.9}'+
 '.en-confetti{position:fixed;top:-12px;z-index:2147482400;width:8px;height:12px;border-radius:2px;pointer-events:none;animation:enFall 2.4s cubic-bezier(.2,.6,.4,1) forwards}'+
 '@keyframes enFall{to{transform:translate(var(--x),105vh) rotate(540deg);opacity:.2}}@keyframes enBurst{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}12%{opacity:1;transform:translate(-50%,0) scale(1.05)}20%{transform:translate(-50%,0) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-10px)}}'+
 '@keyframes enFade{from{opacity:0}}@keyframes enPop{from{transform:scale(.85);opacity:0}}@keyframes enPulse{50%{transform:scale(1.03)}}'+
 // A pulsing dock button: a glow and a small dot.
 'html:root body.place-docked #worldUI .club-dock button.live{position:relative}html:root body.place-docked #worldUI .club-dock button.live .cd-i{animation:enLive 1.3s ease-in-out infinite}'+
 'html:root body.place-docked #worldUI .club-dock button.live::after{content:"";position:absolute;top:5px;right:8px;width:8px;height:8px;border-radius:50%;background:#ff5a5f;box-shadow:0 0 0 2px rgb(14 8 30 / .78)}'+
 '@keyframes enLive{50%{transform:scale(1.18)}}'+
 '@media (prefers-reduced-motion:reduce){.en-card,.en-claim,.en-burst,html:root body.place-docked #worldUI .club-dock button.live .cd-i{animation:none!important}}';
document.head?.append(css);
})();
