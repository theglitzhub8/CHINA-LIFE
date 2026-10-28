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
  '<section class="gr-card"><h3>📰 City news</h3><div id="grNews"><p class="gr-muted">Loading the news…</p></div><div class="gr-actions"><button type="button" id="grNewsAll" class="gr-soft">See all city news</button></div></section></div>');
 $('grWall').onclick=()=>g.gistNight();$('grNewsAll').onclick=()=>g.cityNews?.();
 const f=H()?.featured?.(),body=f?.body||f?.text||'';$('grTv').textContent=body?'“'+body+'”':'No featured gist yet today. Win the room on the Hot Seat and it goes on the TV.';
 hot(mine);news(mine)}
async function hot(mine){const h=H(),p=$('grHot'),go=$('grHotGo');if(!p)return;
 if(!h?.enabled?.()){p.textContent='The Hot Seat is closed right now.';return}
 // Closed (one-city opening hours, game time): say when it opens; the wall and the news work from anywhere.
 const OC=window.ChinaLifeOneCity,P=OC?.PLACES?.gist;
 if(!here()&&P&&OC.isOpenAt&&!OC.isOpenAt('gist',G().state.hour)){p.textContent='The Gossip Room is closed now. It opens at '+String(P.hours[0]).padStart(2,'0')+':00. The Gossip wall and City news work from anywhere.';go.innerHTML='';return}
 let live=null;try{live=await h.peek?.()}catch{}if(mine!==opened||!$('grHot'))return;
 p.textContent=live?'🔴 Live now: '+live.votes+' vote'+(live.votes===1?'':'s')+' · '+live.secondsLeft+'s left to say True or Cap.':'Nobody is on the seat. Drop an anonymous gist and the room votes True or Cap.';
 const label=!here()?'Go to the Gossip Room':live?(live.own||live.voted?'Watch the round':'Vote now'):'Take the seat';
 go.innerHTML='<button type="button" id="grHotBtn">'+esc(label)+'</button>';
 // Away from the room: the same trip as Where to? (ride choice, opening hours).
 $('grHotBtn').onclick=()=>{if(here())return h.open();$('activityDialog')?.close();window.ChinaLifeWhereTo?.go?window.ChinaLifeWhereTo.go('gist'):G().select('gist')}}
async function news(mine){const box=$('grNews');if(!box)return;
 try{const r=await window.ChinaLifeAuth?.request?.('/chinalife/gist.php?city='+encodeURIComponent(G().state.city)),d=r?.data||r||{};if(mine!==opened||!$('grNews'))return;
  const posts=(d.posts||[]).slice(0,3);
  box.innerHTML=posts.length?posts.map(n=>'<article class="gr-news"><b>'+esc(n.title)+'</b><p>'+esc(String(n.body||'').slice(0,140))+(String(n.body||'').length>140?'…':'')+'</p></article>').join(''):'<p class="gr-muted">No city news today.</p>'}
 catch{if(mine===opened&&$('grNews'))box.innerHTML='<p class="gr-muted">City news is not available right now.</p>'}}
window.ChinaLifeGossipRoom={on,open};
const css=document.createElement('style');css.textContent='.gr{display:grid;gap:12px}.gr-card{padding:14px 16px;border-radius:18px;background:#f3fbf8;border:1px solid #d6ebe5}.gr-card h3{margin:0 0 6px;font-size:16px}.gr-card p{margin:0 0 10px}.gr-hot{background:#fff4f1;border-color:#ffd6cc}.gr-actions{display:flex;flex-wrap:wrap;gap:8px}.gr-actions button{min-height:44px;padding:0 16px;border:0;border-radius:22px;background:#1F8E93;color:#fff;font-weight:700}.gr-actions .gr-soft{background:#fff;color:#0C3F44;border:1px solid #cfe3dd}.gr-tv{margin:0;padding:12px 14px;border-radius:14px;background:#0C3F44;color:#F7FFF7;font-style:italic}.gr-news{padding:8px 0;border-top:1px solid #d6ebe5}.gr-news:first-child{border-top:0}.gr-news p{margin:2px 0 0;font-size:13px;color:#43666b}.gr-muted{color:#587675;font-size:13px}';document.head?.append(css);
})();
