// City Album (docs/ROADMAP.md item 5, appadmin switch city_album, default ON). Eight sets, one per place, six cards each
// (the sixth is rare ✨). Every real thing you do at a place gives a card from its set (chinalife-api/album.php works them
// out on the server). Finish a set for ¥300; all eight for ¥2,000 and a badge. Doubles are spares: tap Trade on one to
// offer it to a friend for one of their spares (3 offers a day; offers to you show at the top with Accept and Decline).
// Opens from the Today panel (tap the clock → 🃏 City Album). A small toast says when a new card arrives.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('city_album')!==false;
const signed=()=>!!window.ChinaLifeCloud?.signedIn&&!!window.ChinaLifeAuth?.request;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=(method='GET',body)=>window.ChinaLifeAuth.request('/chinalife/album.php',method,body).then(r=>r?.data||r);
// set id => [icon, name, colour, how to get its cards, place to Go, [6 cards: [emoji, name]]] (same ids as AL_SETS).
const SETS={
 night:['🪩','The Club','#7c3aed','Night missions and drinks at the club, and your first visit each day','night',[['🎧','DJ Booth'],['🌈','Neon Sign'],['💃','Dance Floor'],['🧋','Bubble Tea Bar'],['🎟️','VIP Rope'],['🪩','Golden Disco Ball']]],
 gist:['🤫','Gossip Centre','#db2777','Tips on the wall, Hot Seat votes and your first visit each day','gist',[['🧱','The Whisper Wall'],['🔥','The Hot Seat'],['📺','Gossip TV'],['🌀','Rumour Mill'],['🎭','Anonymous Mask'],['🏆','The Truth Teller']]],
 voting:['🏛️','City Hall','#1d4ed8','Votes in elections and your first visit each day','voting',[['🗳️','Ballot Box'],['📜','Campaign Poster'],['🔏','City Seal'],['🎤','Debate Stage'],['🎗️','Victory Sash'],['🗝️','Key to the City']]],
 football:['⚽','Football Pitch','#15803d','Every match you finish and your first visit each day','football',[['⚽','Match Ball'],['🥅','Goal Net'],['🎽','Team Jersey'],['💡','Floodlights'],['🎯','Penalty Spot'],['👟','Golden Boot']]],
 hq:['🏢','Hafrik HQ','#b7791f','Every shift you work and your first visit each day','hq',[['🛎️','Gold Lobby'],['🪪','Hafrik Pass'],['📣','Rooftop Billboard'],['🛗','Glass Elevator'],['💼','Boardroom'],['🏙️','The Gold Tower']]],
 cityhospital:['🏥','City Hospital','#dc2626','Check-ups, the pharmacy and your first visit each day','cityhospital',[['🩺','Check-up Card'],['💊','Pharmacy Counter'],['🚑','Ambulance'],['🧑‍⚕️','Night Nurse'],['🥗','Healthy Meal'],['❤️‍🩹','Golden Heart']]],
 university:['🎓','University','#0e7490','Classes, homework, exams and your first visit each day','university',[['📚','Library Card'],['📘','Chinese Textbook'],['🏫','Lecture Hall'],['🎨','Student Club'],['🚲','Campus Bike'],['🎓','Graduation Cap']]],
 gym:['🏋️','The Gym','#ea580c','Every workout you do at the gym','gym',[['🏋️','Dumbbells'],['🏀','Basketball'],['🩰','Dance Shoes'],['🥤','Protein Shake'],['🏃','Treadmill'],['🥇','Champion Belt']]],
};
// SEEN: cards you have looked at (NEW labels until their set is opened). TOLD: cards a toast already announced.
const SEEN='chinalife-album-seen',TOLD='chinalife-album-told';
const read=(k=SEEN)=>{try{const v=JSON.parse(localStorage.getItem(k));return v&&typeof v==='object'&&!Array.isArray(v)?v:null}catch{return null}};
const write=(v,k=SEEN)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
let last=null,openSet=null,busy=false,trade=null; // trade: {give, friend?:{id,name}, spares?:[...], want?}
const flat=d=>Object.fromEntries((d.sets||[]).flatMap(s=>s.cards.map((n,i)=>[s.id+':'+i,n])));
// New cards since the last look: a toast for the first new one (the screen marks them NEW until opened).
// Card kinds you got since the last look (spares of a card you have are not new). The first look marks all as seen.
function notice(d,k=SEEN){const now=flat(d),seen=read(k);if(!seen){write(now,k);return []}
 return Object.keys(now).filter(x=>now[x]>0&&!seen[x])}
function tile(set,i,n,isNew,canTrade){const c=SETS[set]?.[5]?.[i]||['🃏','Card'],rare=i===5;
 return '<li class="al-card'+(n?' got':'')+(rare?' rare':'')+(isNew?' new':'')+'">'+(n?'<span class="al-e">'+c[0]+'</span><b>'+esc(c[1])+'</b>':'<span class="al-e">?</span><b>'+(rare?'Rare card':'Not yet')+'</b>')+(n>1?'<em>×'+n+'</em>':'')+(isNew?'<i>NEW</i>':'')+(rare&&n?'<small>✨ Rare</small>':'')+(n>1&&canTrade?'<button type="button" class="al-tr" data-give="'+set+':'+i+'">Trade</button>':'')+'</li>'}
const card=k=>{const [set,i]=String(k).split(':'),c=SETS[set]?.[5]?.[+i]||['🃏','a card'];return {e:c[0],name:c[1],set,i:+i,color:SETS[set]?.[2]||'#0C3F44'}};
const chip=k=>{const c=card(k);return '<span class="al-chip" style="--c:'+c.color+'">'+c.e+' '+esc(c.name)+'</span>'};
const hrs=s=>{const h=Math.max(1,Math.round(s/3600));return h>=24?Math.round(h/24)+'d':h+'h'};
// Offers to you and your own waiting offers, at the top of the album.
function offers(d){const t=d.trading;if(!t?.on)return '';const inc=t.incoming||[],out=t.outgoing||[];if(!inc.length&&!out.length)return '';
 return '<div class="al-offers">'+inc.map(o=>'<div class="al-offer in"><p><b>'+esc(o.from.name)+'</b> offers '+chip(o.give)+' for your '+chip(o.want)+'</p><small>Ends in '+hrs(o.expiresIn)+'</small><div><button type="button" class="al-no" data-answer="'+o.id+'" data-ok="0">Decline</button><button type="button" class="al-yes" data-answer="'+o.id+'" data-ok="1">Accept</button></div></div>').join('')+
  out.map(o=>'<div class="al-offer"><p>Waiting for <b>'+esc(o.to.name)+'</b>: your '+chip(o.give)+' for their '+chip(o.want)+'</p><div><button type="button" class="al-no" data-cancel="'+o.id+'">Cancel</button></div></div>').join('')+'</div>'}
// The trade flow: pick a friend, then one of their spares, then send.
function tradeView(d){const t=d.trading,g=card(trade.give),left=Math.max(0,t.perDay-t.sentToday);
 let h='<button type="button" class="al-back" data-back="1">‹ Album</button><div class="al-trade"><small>YOU GIVE</small><div class="al-give">'+chip(trade.give)+'</div>';
 if(!left)return h+'<p class="al-msg">That’s '+t.perDay+' trade offers today. More tomorrow.</p></div>';
 if(!trade.friend){h+='<small>TRADE WITH</small>';
  h+=t.friends?.length?'<div class="al-friends">'+t.friends.map(f=>'<button type="button" data-friend="'+esc(f.id)+'" data-name="'+esc(f.name)+'">'+esc(f.name)+'</button>').join('')+'</div>':'<p class="al-msg">Trading is with friends. Add friends in Link Up, then come back.</p>';
  return h+'<p class="al-msg">'+left+' of '+t.perDay+' offers left today. Offers end after '+t.hours+' hours.</p></div>'}
 h+='<small>ASK '+esc(trade.friend.name.toUpperCase())+' FOR</small>';
 if(!trade.spares)return h+'<p class="al-msg">Looking at their spares…</p></div>';
 const mine=flat(d),list=trade.spares.filter(k=>k!==trade.give);
 if(!list.length)return h+'<p class="al-msg">'+esc(trade.friend.name)+' has no spares to trade yet.</p></div>';
 h+='<ul class="al-grid">'+list.map(k=>{const c=card(k),need=!mine[k];return '<li class="al-card got'+(c.i===5?' rare':'')+(trade.want===k?' pick':'')+'" style="--c:'+c.color+'"><button type="button" class="al-pickc" data-want="'+k+'"><span class="al-e">'+c.e+'</span><b>'+esc(c.name)+'</b>'+(need?'<small>You need this</small>':'')+'</button></li>'}).join('')+'</ul>';
 if(trade.want)h+='<button type="button" class="al-claim" data-send="1">Offer '+esc(g.name)+' for '+esc(card(trade.want).name)+'</button>';
 return h+'</div>'}
function paint(d){last=d;const box=$('alBody');if(!box)return;const fresh=new Set(notice(d));
 if(trade&&d.trading?.on){box.innerHTML=tradeView(d);return wire(box)}
 const all=d.sets.every(s=>s.done),canTrade=!!d.trading?.on;
 let html='<div class="al-top"><div class="al-ring" style="--p:'+Math.round(100*d.have/d.total)+'"><b>'+d.have+'</b><small>of '+d.total+'</small></div><div><b>Your City Album</b><small>Do things around the city to collect cards. Finish a set for ¥'+d.setPrize.coins+'. All eight: ¥'+d.allPrize.coins.toLocaleString()+' and a badge.</small>'+(d.spares?'<small class="al-spares">'+d.spares+' spare'+(d.spares===1?'':'s')+(canTrade?' · tap Trade on one to swap with a friend':' · trading opens soon')+'</small>':'')+'</div></div>'+offers(d);
 if(all&&!d.allClaimed)html+='<button type="button" class="al-claim all" data-claim="all">🃏 Claim ¥'+d.allPrize.coins.toLocaleString()+' · Album complete</button>';
 html+='<div class="al-sets">'+d.sets.map(s=>{const m=SETS[s.id]||['🃏',s.id,'#0C3F44','','',[]],isOpen=openSet===s.id,newIn=s.cards.some((n,i)=>fresh.has(s.id+':'+i));
  return '<section class="al-set'+(isOpen?' open':'')+(s.done?' done':'')+'" style="--c:'+m[2]+'"><button type="button" class="al-head" data-set="'+s.id+'"><span class="al-si">'+m[0]+'</span><span class="al-st"><b>'+esc(m[1])+'</b><small>'+s.have+' of 6'+(s.claimed?' · ✓ ¥'+d.setPrize.coins+' paid':s.done?' · prize ready':'')+'</small></span>'+(newIn?'<i class="al-dot">NEW</i>':'')+'<span class="al-bar"><i style="width:'+Math.round(100*s.have/6)+'%"></i></span></button>'+
   (isOpen?'<div class="al-in"><ul class="al-grid">'+s.cards.map((n,i)=>tile(s.id,i,n,fresh.has(s.id+':'+i),canTrade)).join('')+'</ul><p class="al-how">How to get them: '+esc(m[3])+'.</p>'+
    (s.done&&!s.claimed?'<button type="button" class="al-claim" data-claim="'+s.id+'">Claim ¥'+d.setPrize.coins+' + '+d.setPrize.xp+' XP</button>':!s.done&&m[4]?'<button type="button" class="al-go" data-go="'+m[4]+'">Go to '+esc(m[1])+'</button>':'')+'</div>':'')+'</section>'}).join('')+'</div>';
 box.innerHTML=html;wire(box)}
function wire(box){
 box.querySelectorAll('[data-give]').forEach(b=>b.onclick=e=>{e.stopPropagation();trade={give:b.dataset.give};paint(last)});
 box.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{trade=null;paint(last)});
 box.querySelectorAll('[data-friend]').forEach(b=>b.onclick=async()=>{trade={...trade,friend:{id:b.dataset.friend,name:b.dataset.name}};paint(last);
  try{const r=await window.ChinaLifeAuth.request('/chinalife/album.php?friend='+encodeURIComponent(b.dataset.friend)).then(x=>x?.data||x);if(trade?.friend?.id===b.dataset.friend){trade.spares=r.spares||[];paint(last)}}
  catch(e){G()?.toast?.(e?.message||'Try again in a moment.');trade={give:trade?.give};paint(last)}});
 box.querySelectorAll('[data-want]').forEach(b=>b.onclick=()=>{trade.want=b.dataset.want;paint(last)});
 box.querySelectorAll('[data-send]').forEach(b=>b.onclick=()=>post({op:'offer',to:+trade.friend.id,give:trade.give,want:trade.want},b,'✓ Offer sent to '+trade.friend.name));
 box.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>post({op:'answer',id:+b.dataset.answer,accept:b.dataset.ok==='1'},b,b.dataset.ok==='1'?'🔁 Trade done!':'Offer declined'));
 box.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>post({op:'cancel',id:+b.dataset.cancel},b,'Offer cancelled'));
 box.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>{openSet=openSet===b.dataset.set?null:b.dataset.set;paint(last);if(openSet){const seen=read()||{};last.sets.find(s=>s.id===openSet)?.cards.forEach((n,i)=>{seen[openSet+':'+i]=n});write(seen)}});
 box.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>claim(b.dataset.claim,b));
 box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{try{$('activityDialog')?.close()}catch{}const g=G();if(g?.state?.place===b.dataset.go)return;if(window.ChinaLifeWhereTo?.go)window.ChinaLifeWhereTo.go(b.dataset.go);else g?.travel?.(b.dataset.go)})}
async function post(body,b,msg){if(busy)return;busy=true;if(b)b.disabled=true;
 try{const r=await api('POST',body);if(body.op==='offer')trade=null;paint(r);G()?.toast?.(msg)}
 catch(e){G()?.toast?.(e?.message||'Try again in a moment.');if(b)b.disabled=false;if(body.op==='answer')peek()}finally{busy=false}}
async function claim(set,b){if(busy)return;busy=true;if(b){b.disabled=true;b.textContent='Claiming…'}
 try{const r=await api('POST',{op:'claim',set});const g=G();if(r?.money!=null){g?.applyServerTotals?.(r);g?.save?.();g?.refresh?.()}
  paint(r);const msg=set==='all'?'🃏 City Album complete! +¥'+(r.awarded||0).toLocaleString():'✓ '+(SETS[set]?.[1]||'Set')+' complete! +¥'+(r.awarded||0);window.ChinaLifeCelebrate?.('🃏',msg);g?.toast?.(msg)}
 catch(e){G()?.toast?.(e?.message||'Try again in a moment.');if(b){b.disabled=false;b.textContent='Claim'}}finally{busy=false}}
let lastPeek=0;
async function peek({toast=false}={}){if(!on()||!signed())return null;lastPeek=Date.now();
 try{const d=await api();if(!d?.sets)return null;if(!read(SEEN))write(flat(d)); // the first look ever: what you have is not new
  const inc=(d.trading?.incoming||[]).map(o=>o.id),told=(()=>{try{const v=JSON.parse(localStorage.getItem('chinalife-album-offers'));return Array.isArray(v)?v:[]}catch{return []}})(),nw=(d.trading?.incoming||[]).filter(o=>!told.includes(o.id));
  if(toast&&!$('alBody')&&nw.length)G()?.toast?.('🔁 '+nw[0].from.name+' offered you a card trade. Open your City Album.');try{localStorage.setItem('chinalife-album-offers',JSON.stringify(inc))}catch{}
  if(toast&&!$('alBody')&&!nw.length){const fresh=notice(d,TOLD);write(flat(d),TOLD);if(fresh.length){const [set,i]=fresh[0].split(':'),c=SETS[set]?.[5]?.[+i];if(c)G()?.toast?.('🃏 New card for your City Album: '+c[0]+' '+c[1]+(fresh.length>1?' (+'+(fresh.length-1)+' more)':''))}}
  last=d;if($('alBody'))paint(d);return d}catch{return null}}
async function open(set){const g=G();if(!on()||!g?.showScreen)return;openSet=set||openSet;
 g.showScreen('🃏 City Album','Cards from every place in the city.','<div class="al" id="alBody">'+(signed()?'<p class="al-msg">Opening your album…</p>':'<p class="al-msg">Log in with Hafrik to collect cards.</p><button type="button" class="al-go" id="alLogin">Log in</button>')+'</div>');
 if($('alLogin'))$('alLogin').onclick=()=>window.ChinaLifeCloud?.open?.();
 trade=null;if(last)paint(last);const d=await peek();if(d)write(flat(d),TOLD)}
function summary(){const d=last;if(!d?.sets)return null;const n=d.trading?.incoming?.length||0;if(n)return {hot:true,text:n+' trade offer'+(n===1?'':'s')+' waiting'};const ready=d.sets.some(s=>s.done&&!s.claimed)||(d.sets.every(s=>s.done)&&!d.allClaimed);
 return {hot:ready,text:ready?'A set is complete · claim your prize':d.have+' of '+d.total+' cards'+(d.spares?' · '+d.spares+' spare'+(d.spares===1?'':'s'):'')}}
window.ChinaLifeAlbum={open,on,peek,summary,SETS,get last(){return last}};
// New cards arrive after doing things: look again when a screen closes (at most every 20 s) and when the game comes back.
document.addEventListener('close',e=>{if(e.target?.id==='activityDialog'&&Date.now()-lastPeek>20000)setTimeout(()=>peek({toast:true}),1500)},true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastPeek>60000)peek({toast:true})});
window.addEventListener('chinalife:cloudready',()=>setTimeout(()=>peek({toast:true}),8000));
const css=document.createElement('style');css.textContent=
 '.al{display:grid;gap:14px;color:#0C3F44}.al-msg{margin:0;color:#587675;font-size:13px}'+
 '.al-top{display:flex;gap:14px;align-items:center}.al-top>div:last-child b{display:block;font-size:17px}.al-top small{display:block;font-size:12.5px;color:#587675;line-height:1.35}.al-top .al-spares{margin-top:3px;font-weight:800;color:#9a5a00}'+
 '.al-ring{--p:0;flex:none;width:68px;height:68px;border-radius:50%;display:grid;place-content:center;text-align:center;background:radial-gradient(closest-side,#fff 78%,transparent 80% 100%),conic-gradient(#16a37f calc(var(--p)*1%),#e3ecea 0)}.al-ring b{font-size:20px;line-height:1}.al-ring small{font-size:10px;color:#587675}'+
 '.al-sets{display:grid;gap:10px}.al-set{border-radius:18px;background:#fff;border:1.5px solid #e3ecea;overflow:hidden}.al-set.done{border-color:color-mix(in srgb,var(--c) 45%,#fff)}'+
 '.al-head{display:grid;grid-template-columns:42px 1fr auto;grid-template-rows:auto auto;align-items:center;gap:2px 10px;width:100%;padding:10px 12px;border:0;background:none;text-align:left;color:inherit;font:inherit;cursor:pointer}'+
 '.al-si{grid-row:span 2;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb,var(--c) 14%,#fff)}.al-st b{display:block;font-size:15px}.al-st small{font-size:12px;color:#587675}'+
 '.al-dot{font-style:normal;font-size:10px;font-weight:900;color:#fff;background:#f2b33d;border-radius:8px;padding:2px 6px}.al-bar{grid-column:2/4;height:5px;border-radius:3px;background:#eef3f2;overflow:hidden}.al-bar i{display:block;height:100%;background:var(--c)}'+
 '.al-in{padding:0 12px 12px}.al-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'+
 '.al-card{position:relative;aspect-ratio:3/4;border-radius:14px;display:grid;place-content:center;justify-items:center;gap:4px;text-align:center;padding:6px;background:repeating-linear-gradient(135deg,#f3f6f6 0 8px,#eef2f2 8px 16px);border:1.5px dashed #d5e1df;color:#8aa3a1}'+
 '.al-card.got{background:linear-gradient(160deg,color-mix(in srgb,var(--c) 16%,#fff),#fff);border:1.5px solid color-mix(in srgb,var(--c) 40%,#fff);color:#0C3F44}.al-card.rare.got{background:linear-gradient(160deg,#fff4d1,#fff);border-color:#f2b33d;box-shadow:0 0 0 2px #f2b33d33}'+
 '.al-e{font-size:28px;line-height:1}.al-card b{font-size:11.5px;line-height:1.2}.al-card small{font-size:10px;font-weight:800;color:#9a5a00}.al-card em{position:absolute;top:5px;right:6px;font-style:normal;font-size:11px;font-weight:900;color:var(--c)}'+
 '.al-card i{position:absolute;top:5px;left:5px;font-style:normal;font-size:9px;font-weight:900;color:#fff;background:#f2b33d;border-radius:6px;padding:1px 5px}'+
 '.al-how{margin:10px 0 0;font-size:12.5px;color:#587675}'+
 '.al-tr{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);border:0;border-radius:9px;padding:2px 9px;background:var(--c);color:#fff;font:inherit;font-size:10.5px;font-weight:900;cursor:pointer}'+
 '.al-offers{display:grid;gap:8px}.al-offer{padding:10px 12px;border-radius:16px;background:#f3f7f6;border:1.5px solid #e3ecea}.al-offer.in{background:#fff8e6;border-color:#f2b33d}.al-offer p{margin:0;font-size:13.5px;line-height:1.6}.al-offer small{font-size:11px;color:#587675}'+
 '.al-offer div{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}.al-yes,.al-no{min-height:34px;padding:0 16px;border:0;border-radius:17px;font:inherit;font-size:13px;font-weight:900;cursor:pointer}.al-yes{background:#16a37f;color:#fff}.al-no{background:#e6edec;color:#0C3F44}'+
 '.al-chip{display:inline-block;padding:1px 8px;border-radius:9px;background:color-mix(in srgb,var(--c) 14%,#fff);font-weight:800;white-space:nowrap}'+
 '.al-back{justify-self:start;border:0;background:none;color:#0C3F44;font:inherit;font-size:14px;font-weight:800;padding:0;cursor:pointer}.al-trade{display:grid;gap:8px}.al-trade>small{font-size:11px;font-weight:900;letter-spacing:.07em;color:#587675;margin-top:6px}'+
 '.al-friends{display:flex;flex-wrap:wrap;gap:8px}.al-friends button{min-height:38px;padding:0 14px;border-radius:19px;border:1.5px solid #d5e1df;background:#fff;font:inherit;font-size:14px;font-weight:800;color:#0C3F44;cursor:pointer}'+
 '.al-pickc{all:unset;display:grid;place-content:center;justify-items:center;gap:4px;width:100%;height:100%;cursor:pointer}.al-card.pick{box-shadow:0 0 0 3px #f2b33d}'+
 '.al-claim,.al-go{display:block;width:100%;margin-top:10px;min-height:44px;border:0;border-radius:22px;font:inherit;font-size:14px;font-weight:900;cursor:pointer}.al-claim{background:#f2b33d;color:#3a2600}.al-go{background:#0C3F44;color:#fff}.al-claim.all{margin:0}';document.head?.append(css);
})();
