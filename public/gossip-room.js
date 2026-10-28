// Gossip Room (docs/GOSSIP-ROOM-PLAN.md Phase 0, appadmin switch gossip_room, default OFF): one screen for everything
// gossip, in this order: tonight's Hot Seat (hot-seat.js), the Gossip wall (anonymous posts, game.js gistNightScreen),
// Gossip TV's pick (today's most-voted Hot Seat gist) and City news (gist.php). It opens from the phone's Gossip tile,
// the room's place bar and the tea table. With the switch off, every door works as before.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife,H=()=>window.ChinaLifeHotSeat;
const on=()=>window.ChinaLifeFlags?.cast?.('gossip_room')===true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A new screen starts at the top (as in kitchen.js and university.js).
const show=(...a)=>{G().showScreen(...a);const c=$('activityContent');if(c){c.scrollTop=0;c.dispatchEvent(new Event('scroll'))}};
const here=()=>G()?.state?.place==='gist';
let opened=0;
async function open(){const g=G();if(!g)return;const mine=++opened;
 show('🫖 Gossip Room','Hot Seat, the Gossip wall, Gossip TV and City news. Posts are anonymous to players.',
  '<div class="gr"><section class="gr-card gr-hot"><h3>🔥 Hot Seat</h3><p id="grHot">Checking the seat…</p><div class="gr-actions" id="grHotGo"></div></section>'+
  '<section class="gr-card"><h3>🤫 Gossip wall</h3><p>Anonymous posts and polls from around the city. Read them, react, or drop your own.</p><div class="gr-actions"><button type="button" id="grWall">Open the Gossip wall</button></div></section>'+
  '<section class="gr-card"><h3>📺 Gossip TV</h3><blockquote id="grTv" class="gr-tv"></blockquote></section>'+
  (repOn()?'<section class="gr-card"><h3>🏅 Your gist rep</h3><p id="grRep" class="gr-muted">Counting…</p></section>':'')+
  '<section class="gr-card"><h3>📰 City news</h3><div id="grNews"><p class="gr-muted">Loading the news…</p></div><div class="gr-actions"><button type="button" id="grNewsAll" class="gr-soft">See all city news</button></div></section></div>');
 $('grWall').onclick=()=>g.gistNight();$('grNewsAll').onclick=()=>g.cityNews?.();
 const f=H()?.featured?.(),body=f?.body||f?.text||'';$('grTv').textContent=body?'“'+body+'”':'No featured gist yet today. Win the room on the Hot Seat and it goes on the TV.';
 hot(mine);news(mine);rep(mine)}
async function hot(mine){const h=H(),p=$('grHot'),go=$('grHotGo');if(!p)return;
 if(!h?.enabled?.()){p.textContent='The Hot Seat is closed right now.';return}
 // Closed (one-city opening hours, game time): say when it opens; the wall and the news work from anywhere.
 const OC=window.ChinaLifeOneCity,P=OC?.PLACES?.gist;
 if(!here()&&P&&OC.isOpenAt&&!OC.isOpenAt('gist',G().state.hour)){p.textContent='The Gossip Room is closed now. It opens at '+String(P.hours[0]).padStart(2,'0')+':00. The Gossip wall and City news work from anywhere.';go.innerHTML='';return}
 let live=null;try{live=await h.peek?.()}catch{}if(mine!==opened||!$('grHot'))return;
 p.textContent=live?'🔴 Live now: '+live.votes+' vote'+(live.votes===1?'':'s')+' · '+live.secondsLeft+'s left to say True or Cap.':'Nobody is on the seat. Drop an anonymous gist and the room votes True or Cap.';
 // Hot Seat Hour (switch gossip_show): when it is on, how busy it is; otherwise when it starts.
 const s=h.show?.();if(s?.on)p.insertAdjacentHTML('beforebegin','<p class="gr-show'+(s.live?' live':'')+'">'+esc(s.live?'🔴 Hot Seat Hour until '+s.end+' · '+s.audience+' in the room'+(s.queue?' · '+s.queue+' waiting for the seat':''):'Hot Seat Hour: every night '+s.start+'–'+s.end)+'</p>');
 const label=!here()?'Go to the Gossip Room':live?(live.own||live.voted?'Watch the round':'Vote now'):'Take the seat';
 go.innerHTML='<button type="button" id="grHotBtn">'+esc(label)+'</button>';
 // Away from the room: the same trip as Where to? (ride choice, opening hours).
 $('grHotBtn').onclick=()=>{if(here())return h.open();$('activityDialog')?.close();window.ChinaLifeWhereTo?.go?window.ChinaLifeWhereTo.go('gist'):G().select('gist')}}
async function news(mine){const box=$('grNews');if(!box)return;
 try{const r=await window.ChinaLifeAuth?.request?.('/chinalife/gist.php?city='+encodeURIComponent(G().state.city)),d=r?.data||r||{};if(mine!==opened||!$('grNews'))return;
  const posts=(d.posts||[]).slice(0,3);
  box.innerHTML=posts.length?posts.map(n=>'<article class="gr-news"><b>'+esc(n.title)+'</b><p>'+esc(String(n.body||'').slice(0,140))+(String(n.body||'').length>140?'…':'')+'</p></article>').join(''):'<p class="gr-muted">No city news today.</p>'}
 catch{if(mine===opened&&$('grNews'))box.innerHTML='<p class="gr-muted">City news is not available right now.</p>'}}
// Phase 4 (switch gossip_show): the room reacts to a reveal. Everyone in the room (players and characters, by their
// name labels) cheers a True and laughs at a Cap for a few seconds.
const showOn=()=>window.ChinaLifeFlags?.cast?.('gossip_show')===true;
function react(result){if(!showOn()||!here())return;const set=result==='true'?['👏','🎉','🙌','🔥']:result==='cap'?['😂','🧢','🙄','😅']:['🤔','🤷'];
 // A burst rising over the room (name labels are hidden in the follow camera), bigger with a bigger audience.
 const host=$('worldUI')||document.body,n=Math.min(24,10+(window.ChinaLifeHotSeat?.show?.()?.audience||0)*2);
 for(let i=0;i<n;i++){const b=document.createElement('span');b.className='gr-react';b.textContent=set[i%set.length];
  b.style.left=(8+((i*37)%84))+'%';b.style.animationDelay=(i%8)*140+'ms';host.appendChild(b);setTimeout(()=>b.remove(),3400)}}
window.addEventListener?.('chinalife:hotseat-reveal',e=>react(e.detail?.result));
// Phase 1: one reminder a night when Hot Seat Hour starts (game open, signed in).
const KEY='chinalife-hot-seat-hour';
function remind(){const s=window.ChinaLifeHotSeat?.show?.(),g=G();if(!showOn()||!g?.state?.created||!window.ChinaLifeCloud?.signedIn)return;
 const now=new Date(Date.now()+8*3600e3),day=now.toISOString().slice(0,10),hour=now.getUTCHours();
 if(hour!==Number(String(s?.start||'20:00').slice(0,2)))return;try{if(localStorage.getItem(KEY)===day)return;localStorage.setItem(KEY,day)}catch{}
 g.notify?.('🔥 Hot Seat Hour is on in the Gossip Room until '+(s?.end||'22:00')+'. Tap to see it.',()=>open())}
setInterval?.(remind,60e3);
// Phase 3 (switch gossip_city): while you are in the Gossip Room, a new tip on the wall (a player's or the city's)
// gives a small banner. It checks the newest tip's id every 30 seconds (gist-night.php?latest).
let newestSeen=null;
async function watchWall(){if(window.ChinaLifeFlags?.cast?.('gossip_city')!==true||!here()||!window.ChinaLifeCloud?.signedIn){newestSeen=null;return}
 try{const r=await window.ChinaLifeAuth?.request?.('/chinalife/gist-night.php?latest=1&city='+encodeURIComponent(G().state.city)),id=Number((r?.data||r)?.latest||0);
  if(newestSeen!==null&&id>newestSeen&&!$('gistNightFeed'))G().notify?.('🫖 New gist on the wall. Tap to read it.',()=>G().gistNight());newestSeen=Math.max(newestSeen??0,id)}catch{}}
setInterval?.(watchWall,30e3);
// Phase 5 (switch gossip_rep): your gist rep (only you see it; gossip-rep.php) and the weekly Truth teller award.
const repOn=()=>window.ChinaLifeFlags?.cast?.('gossip_rep')===true;let repData=null;
async function rep(mine){const box=$('grRep');if(!box)return;
 try{const r=await window.ChinaLifeAuth?.request?.('/chinalife/gossip-rep.php'),d=r?.data||r;if(mine!==opened||!$('grRep'))return;if(!d?.on){box.closest('section')?.remove();return}repData=d;
  const p=d.prizes||[1000,500,250],won=d.last_week;
  box.innerHTML=(won?'<b class="gr-won">'+['🥇','🥈','🥉'][won.place-1]+' You were Truth teller #'+won.place+' last week: +¥'+Number(won.prize).toLocaleString()+' and a badge!</b><br>':'')+
   '<b>'+d.week+'</b> this week · <b>'+d.total+'</b> all time<br>Hot Seat gists the room believes: +10 · called Cap: −5 · every 5 reactions on your wall tips: +1. '+
   'Each Monday the week\'s top three get a badge and ¥'+p.map(n=>Number(n).toLocaleString()).join(' / ¥')+'. Only you can see your rep.'}
 catch{if(mine===opened&&$('grRep'))box.textContent='Your rep is not available right now.'}}
window.ChinaLifeGossipRoom={on,open,react,remind,watchWall,get rep(){return repData}};
const css=document.createElement('style');css.textContent='.gr{display:grid;gap:12px}.gr-card{padding:14px 16px;border-radius:18px;background:#f3fbf8;border:1px solid #d6ebe5}.gr-card h3{margin:0 0 6px;font-size:16px}.gr-card p{margin:0 0 10px}.gr-hot{background:#fff4f1;border-color:#ffd6cc}.gr-actions{display:flex;flex-wrap:wrap;gap:8px}.gr-actions button{min-height:44px;padding:0 16px;border:0;border-radius:22px;background:#1F8E93;color:#fff;font-weight:700}.gr-actions .gr-soft{background:#fff;color:#0C3F44;border:1px solid #cfe3dd}.gr-tv{margin:0;padding:12px 14px;border-radius:14px;background:#0C3F44;color:#F7FFF7;font-style:italic}.gr-news{padding:8px 0;border-top:1px solid #d6ebe5}.gr-news:first-child{border-top:0}.gr-news p{margin:2px 0 0;font-size:13px;color:#43666b}.gr-muted{color:#587675;font-size:13px}.gr-show{margin:0 0 8px;padding:6px 10px;border-radius:12px;background:#fff;font-size:13px;font-weight:700;color:#0C3F44}.gr-show.live{background:#e0263b;color:#fff}'+
 '.gr-react{position:absolute;bottom:32%;z-index:35;font-size:28px;opacity:0;animation:grUp 2.6s ease-out forwards;pointer-events:none}@keyframes grUp{0%{opacity:0;transform:translateY(20px) scale(.6)}15%{opacity:1;transform:translateY(0) scale(1.2)}100%{opacity:0;transform:translateY(-180px) scale(1)}}'+
 '@media (prefers-reduced-motion:reduce){.gr-react{animation:none}}';document.head?.append(css);
})();
