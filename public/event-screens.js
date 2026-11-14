// Event screens (docs/TODAY-PLAN.md Phase 4, appadmin switch event_screens, default ON). One screen for the city's
// events: ⚽ Match Day (with the next cup), 🗳 the open election and 🔥 Hot Seat Hour. Each card has a countdown, the Top 3
// in your city, your own line, the reward and one Go. Live events come first. Data: chinalife-api/event-screens.php.
// Opens from the Today panel (tap the clock) and from ChinaLifeEventScreens.open('match'|'election'|'hotseat').
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('event_screens')!==false;
const signed=()=>!!window.ChinaLifeCloud?.signedIn&&!!window.ChinaLifeAuth?.request;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const OFFICE={'governor':'Governor','deputy-governor':'Deputy Governor','city-councillor':'City Councillor','student-representative':'Student Rep'};
const CHALLENGE={goals:n=>'Score '+n+' goals',won:n=>'Win '+n+' matches',played:n=>'Play '+n+' matches'};
let last=null,skew=0,timer=0,opened=0,lastLoad=0;
const now=()=>Date.now()/1000+skew;
const left=s=>{s=Math.max(0,Math.floor(s));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;return d?d+'d '+h+'h':h?h+'h '+m+'m':m+'m '+String(x).padStart(2,'0')+'s'};
const hhmm=t=>{try{return new Date(t*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'})}catch{return ''}};
const money=n=>'¥'+Number(n||0).toLocaleString();
const close=()=>{try{$('activityDialog')?.close()}catch{}};
const travel=id=>{close();const g=G();if(!g)return false;if(g.state?.place===id)return true;if(window.ChinaLifeWhereTo?.go)window.ChinaLifeWhereTo.go(id);else g.travel?.(id);return false};
const GO={
 match:()=>{if(travel('football'))window.ChinaLifeFootball?.open?.();else G()?.toast?.('Off to the pitch. Tap ⚡ Play when you arrive.')},
 election:()=>{close();G()?.politics?.()},
 hotseat:()=>{const H=window.ChinaLifeHotSeat;if(G()?.state?.place==='gist'&&H?.enabled?.()){close();return H.open()}if(!travel('gist'))G()?.toast?.('Off to the Gossip Centre. The Hot Seat is in the Room.')},
};
// Live first; among live ones the shortest show first (Hot Seat Hour, then the election, then Match Day).
const RANK={hotseat:0,election:1,match:2};
const order=list=>[...list].sort((a,b)=>(b.live-a.live)||(RANK[a.kind]-RANK[b.kind]));
function board(e,empty){const medal=['🥇','🥈','🥉'];
 if(!e.top?.length)return '<p class="ev-empty">'+esc(empty)+'</p>';
 return '<ol class="ev-top">'+e.top.map((r,i)=>'<li'+(r.me?' class="me"':'')+'><span>'+medal[i]+'</span><b>'+esc(r.name)+(r.me?' (you)':'')+'</b><em>'+Number(r.n)+' '+esc(r.n===1?e.unit.replace(/s$/,''):e.unit)+'</em></li>').join('')+'</ol>'}
function clock(e){
 if(e.kind==='hotseat'&&!e.live)return '<span class="ev-clock" data-at="'+e.startsAt+'" data-pre="Starts in ">Starts in '+left(e.startsAt-now())+'</span><small class="ev-when">'+hhmm(e.startsAt)+'–'+hhmm(e.endsAt)+' Beijing</small>';
 if(!e.endsAt)return '<span class="ev-clock">No race open now</span>';
 const word={match:'Ends in ',election:'Voting closes in ',hotseat:'Live · ends in '}[e.kind];
 return '<span class="ev-clock" data-at="'+e.endsAt+'" data-pre="'+word+'">'+word+left(e.endsAt-now())+'</span>'}
function card(e){let title,sub='',mine,reward,go,empty;
 if(e.kind==='match'){const c=e.challenge||{},f=CHALLENGE[c.key];title='⚽ Match Day';
  sub=f?'Today: '+f(c.target)+' ('+Math.min(c.count,c.target)+'/'+c.target+')'+(c.claimed?' · ✓ paid':''):'';
  mine=e.me.n?'You: '+e.me.n+' goal'+(e.me.n===1?'':'s')+' today'+(e.me.rank?' · #'+e.me.rank+' in the city':''):'Not on the board yet. Score a goal to get on it.';
  reward=money(e.reward.coins)+' for today’s challenge';go='⚡ Play a match';empty='No goals yet today. The first goal takes the top spot.';
  if(e.cup)sub+='<span class="ev-cup">🏆 '+esc(e.cup.name)+' · '+(e.cup.running?'playing now':'starts in '+left(e.cup.startsAt-now()))+(e.cup.prize?' · '+money(e.cup.prize)+' prize':'')+'</span>'}
 else if(e.kind==='election'){title='🗳 Election'+(e.office?' · '+(OFFICE[e.office]||e.office):'');
  sub=e.me.races?e.me.races+' race'+(e.me.races===1?'':'s')+' open in your city':'';
  mine=!e.live?'Nothing to vote on right now.':e.me.voted>=e.me.races?'✓ You voted in every race':e.me.voted?'You voted in '+e.me.voted+' of '+e.me.races+' races':'You haven’t voted yet';
  reward=money(e.reward.coins)+' + '+e.reward.xp+' XP for each race you vote in';go=e.live?'🗳 Vote now':'See the ballot';empty='No candidates yet. The ballot fills up once nominations are approved.'}
 else{title='🔥 Hot Seat Hour';sub=e.live?'The room is voting True or Cap on gists right now':'Gists go on the seat one after another every night';
  mine=e.me.n?'You: '+e.me.n+' right call'+(e.me.n===1?'':'s')+' tonight'+(e.me.rank?' · #'+e.me.rank:''):'Not on the board yet. Vote with the room to get on it.';
  reward=money(e.reward.coins)+' for each right call · up to '+e.reward.max+' a day';go=e.live?'🔥 Join the show':'Go to the Gossip Room';empty='No right calls yet tonight.'}
 return '<article class="ev-card ev-'+e.kind+(e.live?' live':'')+'" data-ev="'+e.kind+'"><header><b>'+title+'</b>'+(e.live?'<i class="ev-live">LIVE</i>':'')+'</header>'+clock(e)+(sub?'<p class="ev-sub">'+sub+'</p>':'')+
  '<h4>Top 3 in your city</h4>'+board(e,empty)+'<p class="ev-me">'+esc(mine)+'</p><p class="ev-reward">🎁 '+esc(reward)+'</p><button type="button" class="ev-go" data-go="'+e.kind+'">'+go+'</button></article>'}
function paint(d,focus){last=d;const box=$('evBody');if(!box)return;skew=(+d.now||Date.now()/1000)-Date.now()/1000;
 box.innerHTML=order(d.events||[]).map(card).join('')||'<p class="ev-empty">No events right now.</p>';
 box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>GO[b.dataset.go]?.());
 const f=focus&&box.querySelector('[data-ev="'+focus+'"]');if(f){f.classList.add('focus');f.scrollIntoView?.({block:'nearest'})}}
function tick(){const box=$('evBody');if(!box){clearInterval(timer);timer=0;return}
 box.querySelectorAll('[data-at]').forEach(el=>{const s=+el.dataset.at-now();el.textContent=el.dataset.pre+left(s)});
 if(last&&(last.events||[]).some(e=>(e.kind==='hotseat'&&!e.live?e.startsAt:e.endsAt)&&(e.kind==='hotseat'&&!e.live?e.startsAt:e.endsAt)<=now())&&Date.now()-lastLoad>20000)load();}
let loading=null;
function load(focus){if(!signed())return Promise.resolve(null);if(loading)return loading;lastLoad=Date.now();
 const city=G()?.state?.city||'China';
 loading=window.ChinaLifeAuth.request('/chinalife/event-screens.php?city='+encodeURIComponent(city)).then(r=>{const d=r?.data||r;if(d?.events){last=d;paint(d,focus)}return d}).catch(err=>{const box=$('evBody');if(box&&!last)box.innerHTML='<p class="ev-empty">'+esc(err?.message||'Events could not load. Try again in a moment.')+'</p>';return null}).finally(()=>{loading=null});
 return loading}
async function open(focus){const g=G();if(!on()||!g?.showScreen)return;opened++;
 g.showScreen('🏟 Events','What’s on in your city: who’s leading, your place and the prize.','<div class="ev" id="evBody">'+(signed()?'<p class="ev-empty">Getting the events…</p>':'<p class="ev-empty">Log in with Hafrik to see the city’s events and leaders.</p><button type="button" class="ev-go" id="evLogin">Log in</button>')+'</div>');
 if($('evLogin'))$('evLogin').onclick=()=>window.ChinaLifeCloud?.open?.();
 if(last)paint(last,focus);if(!timer)timer=setInterval(tick,1000);await load(focus)}
// For the Today panel: a short line for its Events row ("Hot Seat Hour is live").
function summary(){const d=last;if(!d?.events)return null;const live=order(d.events).filter(e=>e.live);
 const name={match:'Match Day',election:'An election',hotseat:'Hot Seat Hour'};
 if(live[0]?.kind==='hotseat')return {hot:true,text:'Hot Seat Hour is live'};
 const hs=d.events.find(e=>e.kind==='hotseat');
 return {hot:false,text:live.map(e=>name[e.kind]).join(' · ')+(hs&&!hs.live?' · Hot Seat at '+hhmm(hs.startsAt):'')}}
window.ChinaLifeEventScreens={open,on,load,summary,get last(){return last},GO,_order:order};
const css=document.createElement('style');css.textContent=
 '.ev{display:grid;gap:12px}.ev-empty{color:#587675;font-size:13px;margin:4px 0}'+
 '.ev-card{--a:#0f766e;--b:#e6f6f2;border-radius:22px;padding:14px 14px 12px;background:linear-gradient(160deg,var(--b),#fff 70%);border:1.5px solid color-mix(in srgb,var(--a) 22%,transparent);color:#0C3F44}'+
 '.ev-match{--a:#15803d;--b:#e3f7e8}.ev-election{--a:#1d4ed8;--b:#e7eefe}.ev-hotseat{--a:#dc2626;--b:#fde8e4}'+
 '.ev-card.focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--a) 45%,transparent)}'+
 '.ev-card header{display:flex;align-items:center;justify-content:space-between;gap:8px}.ev-card header b{font-size:17px}'+
 '.ev-live{font-style:normal;font-size:11px;font-weight:900;letter-spacing:.06em;color:#fff;background:var(--a);border-radius:9px;padding:3px 8px;animation:evPulse 1.4s ease-in-out infinite}@keyframes evPulse{50%{opacity:.6}}'+
 '.ev-clock{display:block;margin-top:6px;font-size:22px;font-weight:900;color:var(--a);font-variant-numeric:tabular-nums;letter-spacing:-.01em}.ev-when{display:block;color:#587675;font-size:12px;font-weight:700}'+
 '.ev-sub{margin:6px 0 0;font-size:13px;color:#2d5654}.ev-cup{display:block;margin-top:4px;font-weight:800;color:#8a5a00}'+
 '.ev-card h4{margin:12px 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#587675}'+
 '.ev-top{list-style:none;margin:0;padding:0;display:grid;gap:4px}.ev-top li{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:6px;padding:7px 10px;border-radius:12px;background:#ffffffc0}'+
 '.ev-top li.me{background:#fff4d1;box-shadow:inset 0 0 0 1.5px #f2b33d}.ev-top b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ev-top em{font-style:normal;font-size:12px;font-weight:800;color:var(--a)}'+
 '.ev-me{margin:10px 0 0;font-size:13px;font-weight:800}.ev-reward{margin:4px 0 0;font-size:13px;color:#2d5654}'+
 '.ev-go{display:block;width:100%;margin-top:12px;min-height:46px;border:0;border-radius:23px;background:var(--a,#0f766e);color:#fff;font:inherit;font-size:15px;font-weight:900;cursor:pointer}.ev-go:active{transform:scale(.98)}'+
 '@media (prefers-reduced-motion:reduce){.ev-live{animation:none}}';document.head?.append(css);
})();
