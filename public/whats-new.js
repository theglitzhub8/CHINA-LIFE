// What's new and How it works (docs/TODAY-PLAN.md Phase 5). Client only: no requests, no coins.
// · What's new (switch whats_new, default ON): after an update, a sheet once with dated cards for what is new since you
//   last looked, each with a grey "where to find it" box and a Try it. Brand-new players are not shown old news.
//   Opens again from the Today panel (tap the clock → ✨ What's new).
// · How it works (switch how_it_works, default ON): the first time you open Today's Three, Events, City Hall (voting)
//   or Football, or arrive at the Gossip Centre or the Gym, a small "How it works" card with three steps and Got it.
//   Shown once each, one at a time, never while the first-day tour is running.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const flag=k=>window.ChinaLifeFlags?.cast?.(k)!==false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{const v=JSON.parse(localStorage.getItem(k));return Array.isArray(v)?v:[]}catch{return []}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const touring=()=>{const s=window.ChinaLifeOnboarding?.step;return !!s&&!/^(skip|done|wait)$/.test(s)};
const shut=()=>{try{$('activityDialog')?.close()}catch{}};

/* ---------- What's new ---------- */
// Newest first. id never changes once shipped; add new cards at the top.
const NEWS=[
 {id:'events',date:'2026-11-14',icon:'🏟',title:'Events',text:'Match Day, the election and Hot Seat Hour on one screen: who’s leading in your city, your place and the prize.',where:'Tap the clock at the top → 🏟 Events',go:()=>window.ChinaLifeEventScreens?.open?.()},
 {id:'today-three',date:'2026-11-14',icon:'🎯',title:'Today’s Three',text:'Three quick tasks every day, one Go each. Finish all three for a ¥300 Daily Bonus. One free swap a day.',where:'Tap the clock → Today’s Three, or the Next step chip under the top bar',go:()=>window.ChinaLifeToday?.open?.()},
 {id:'gym',date:'2026-11-14',icon:'🏋️',title:'The Gym',text:'A new place in the city: train, play basketball, join a dance class and meet people. A workout can be one of your daily tasks.',where:'Map → Where to? → 🏋️ Gym',go:()=>{shut();window.ChinaLifeWhereTo?.go?.('gym')}},
 {id:'place-bars',date:'2026-11-14',icon:'🎓',title:'New bottom bars',text:'The University and the Gym now have a bottom bar like the club: everything you can do there in one row.',where:'At the University or the Gym, along the bottom of the screen'},
];
const NEWS_KEY='chinalife-news';
const fresh=()=>{const seen=read(NEWS_KEY);return NEWS.filter(n=>!seen.includes(n.id))};
const markAll=()=>write(NEWS_KEY,[...new Set([...read(NEWS_KEY),...NEWS.map(n=>n.id)])]);
const day=d=>{try{return new Date(d+'T12:00:00+08:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}catch{return d}};
function news(list=NEWS){const g=G();if(!g?.showScreen)return false;
 g.showScreen('✨ What’s new','New in ChinaLife since you last looked.','<div class="wn" id="wnBody">'+list.map((n,i)=>
  '<article class="wn-card"><small class="wn-date">'+esc(day(n.date))+'</small><div class="wn-head"><span class="wn-i">'+n.icon+'</span><b>'+esc(n.title)+'</b></div><p>'+esc(n.text)+'</p>'+
  '<div class="wn-where"><small>Where to find it</small>'+esc(n.where)+'</div>'+(n.go?'<button type="button" class="wn-go" data-wn="'+i+'">Try it</button>':'')+'</article>').join('')+
  '<button type="button" class="wn-done" id="wnDone">Got it</button></div>');
 $('wnBody').querySelectorAll('[data-wn]').forEach(b=>b.onclick=()=>{markAll();shut();list[+b.dataset.wn].go()});
 $('wnDone').onclick=()=>{markAll();shut()};markAll();return true}
// Once after an update: wait until the game is up and nothing else is open (the welcome-back card goes first).
let tries=0;
function autoNews(){if(!flag('whats_new'))return;const g=G(),s=g?.state;if(!s?.created||tries++>40)return;
 if(!read(NEWS_KEY).length&&(+s.day||1)<=1){markAll();return} // a new player: no old news
 const list=fresh();if(!list.length)return;
 if(document.querySelector('dialog[open]')||touring())return setTimeout(autoNews,3000);
 news(list)}

/* ---------- How it works ---------- */
const HOW={
 three:['🎯','Today’s Three',['Three tasks a day, one from each group. Tap Go and it takes you there.','Don’t like one? Swap it once a day with ↻.','Finish all three for a ¥300 Daily Bonus. New tasks at midnight Beijing time.']],
 events:['🏟','Events',['Live events come first, with how long is left.','The Top 3 are players in your city. Your own line shows where you stand.','Tap the big button to join in and win the prize.']],
 voting:['🗳','City Hall',['Pick an office, read the candidates and tap Vote.','One vote per office each election, and it can’t be changed.','Every vote pays ¥50 and 10 XP. Want to run? Nominate yourself.']],
 football:['⚽','Football',['Pick a size (1v1 to 5v5) and tap Play. Bots fill empty spots.','A match lasts about 3 minutes. Goals and wins count for today’s ¥300 challenge.','Cups have a start time and a prize. Join with friends as a team.']],
 gossip:['🤫','Gossip Centre',['Drop anonymous tips on the wall. Your name is never shown.','In the Room, gists go on the Hot Seat and everyone votes True or Cap.','Vote with the room for ¥20 a right call. The show is every night.']],
 gym:['🏋️','The Gym',['Pick a workout from the bar at the bottom: Train, Ball or Dance.','Each costs a little money and trains Fitness or Social. It uses energy, so eat and shower after.','Stay a minute and it counts for a gym task in Today’s Three.']],
};
const HOW_KEY='chinalife-howto';
let card=null,cardFor='';
function context(){const s=G()?.state;if(!s?.created)return null;
 if($('tdBody'))return ['three',$('tdBody')];if($('evBody'))return ['events',$('evBody')];if($('politicsBody'))return ['voting',$('politicsBody')];
 const fb=$('fbScreen');if(fb&&!fb.hidden&&!window.ChinaLifeFootball?.match)return ['football',fb];
 if(document.querySelector('dialog[open]')||$('worldUI')?.classList.contains('map-view'))return null;
 if(s.place==='gist')return ['gossip',null];if(s.place==='gym')return ['gym',null];return null}
function how(){if(!flag('how_it_works'))return;const c=context(),k=c?.[0];
 if(card&&(k!==cardFor||!card.isConnected)){card.remove();card=null;cardFor=''}
 if(!k||card||touring()||read(HOW_KEY).includes(k)||document.querySelector('.r4-tip'))return;
 const [icon,title,steps]=HOW[k];card=document.createElement('div');cardFor=k;card.className='hw'+(c[1]?' inline':' float');card.setAttribute('role','note');
 card.innerHTML='<div class="hw-head"><span>'+icon+'</span><b>How it works · '+esc(title)+'</b></div><ol>'+steps.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol><button type="button" class="hw-ok">Got it</button>';
 card.querySelector('.hw-ok').onclick=()=>{write(HOW_KEY,[...new Set([...read(HOW_KEY),k])]);card.remove();card=null;cardFor=''};
 if(c[1])k==='football'?c[1].prepend(card):c[1].before(card);else ($('worldUI')||document.body).appendChild(card)}
let soon=0;const later=()=>{clearTimeout(soon);soon=setTimeout(how,400)};
document.addEventListener('click',later,true);setInterval(()=>{if(!document.hidden)how()},2000);

window.ChinaLifeWhatsNew={open:()=>flag('whats_new')&&news(),fresh,NEWS,HOW,how,autoNews,on:()=>flag('whats_new')};
const start=()=>setTimeout(autoNews,5000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();

const css=document.createElement('style');css.textContent=
 '.wn{display:grid;gap:12px}.wn-card{position:relative;padding:14px;border-radius:20px;background:#fff;border:1px solid #e3ecea;box-shadow:0 2px 10px #06232612;color:#0C3F44}'+
 '.wn-date{position:absolute;top:12px;right:14px;font-size:11px;font-weight:800;color:#587675;background:#eef6f4;border-radius:8px;padding:2px 7px}'+
 '.wn-head{display:flex;align-items:center;gap:10px;padding-right:60px}.wn-i{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#eef6f4;font-size:19px}.wn-head b{font-size:16px}'+
 '.wn-card p{margin:8px 0 0;font-size:14px;line-height:1.4;color:#2d5654}'+
 '.wn-where{margin-top:10px;padding:9px 11px;border-radius:12px;background:#f1f4f4;font-size:13px;font-weight:700;color:#3d5856}.wn-where small{display:block;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#7b9391;font-weight:800;margin-bottom:2px}'+
 '.wn-go{margin-top:10px;min-height:38px;padding:0 18px;border:0;border-radius:19px;background:#0C3F44;color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}'+
 '.wn-done{min-height:46px;border:0;border-radius:23px;background:#16a37f;color:#fff;font:inherit;font-size:15px;font-weight:900;cursor:pointer}'+
 '.hw{background:#fff;color:#0C3F44;border-radius:18px;padding:12px 14px;box-shadow:0 8px 26px #06232630;border:1.5px solid #f2b33d}'+
 '.hw.inline{margin:0 0 12px}.hw.float{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top) + 118px);z-index:40;max-width:420px;margin:0 auto;animation:hwIn .22s ease-out}@keyframes hwIn{from{transform:translateY(-10px);opacity:0}}'+
 '.fb-screen>.hw.inline{position:relative;z-index:5;margin:10px}'+
 '.hw-head{display:flex;align-items:center;gap:8px}.hw-head span{font-size:18px}.hw-head b{font-size:14px}'+
 '.hw ol{margin:8px 0 0;padding-left:20px;display:grid;gap:4px;font-size:13px;line-height:1.35;color:#2d5654}'+
 '.hw-ok{display:block;margin:10px 0 0 auto;min-height:34px;padding:0 16px;border:0;border-radius:17px;background:#f2b33d;color:#3a2600;font:inherit;font-size:13px;font-weight:900;cursor:pointer}'+
 '@media (prefers-reduced-motion:reduce){.hw.float{animation:none}}';document.head?.append(css);
})();
