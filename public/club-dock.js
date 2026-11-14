// Club Phase 1 (docs/CLUB-PLAN.md, appadmin switch club_dock, default ON): inside a club, one row of big buttons is always
// on screen just above Home / Map / People / Phone: Door & VIP, Bar, Dance, Spray, Music, Mic and More. It replaces the
// Party fan, the ▶ music button, the "DJ is ready" chip, the radio and the place bar there, and option sheets open at
// half height so the club stays in view. The buttons press the club's own controls (club-host.js / club-fx.js
// .club-emotes, voice.js #quickVoice, audio.js, game.clubAccess), so every club behaves as before.
// Home Phase 1 (docs/HOME-PLAN.md, switch home_dock, default ON): at home the same dock has one button per need (Sleep,
// Shower, Toilet, Eat, Chill, Friends) with a bar showing that need, and More; they run game.js homeAct (no sheet).
// Gossip Centre (switch gossip_dock, default ON): Room, Hot Seat, Spill, TV, News, Mic and More (see syncGossip).
// Football Pitch, Voting Booth, Hafrik HQ and Hospital (switch place_docks, default ON): see SPOTS.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('club_dock')!==false,homeOn=()=>window.ChinaLifeFlags?.cast?.('home_dock')!==false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const press=sel=>{const b=document.querySelector(sel);if(b){b.click();return true}return false};
const DOCK=[['door','🎟','Door'],['bar','🍸','Bar'],['dance','💃','Dance'],['spray','💸','Spray'],['music','🎧','Music'],['mic','🎤','Mic'],['more','•••','More']];
// Place-bar items the dock already covers (by their title), so More lists only the rest.
const COVERED=/^(🎟\s*)?Entry & VIP$|^(🍸\s*)?Bar$|^(🎧\s*)?Change \/ request song$/,title=b=>(b.childNodes[0]?.textContent||'').trim();
const ACT={
 door:()=>G()?.clubAccess?.(G().state.place),
 // Seated in the VIP lounge, the bar comes to you (club-host.js waiter).
 bar:()=>window.ChinaLifeClubHost?.waiter?.()||press('.club-emotes [data-ce="menu"]')||pressItem(/^(🍸\s*)?Bar$/),
 dance:()=>press('.club-emotes [data-ce="dance"]')||window.ChinaLifeWorld?.emote?.('dance'),
 spray:()=>press('.club-emotes [data-ce="spray"]')||window.ChinaLifeClub?.open?.(),
 music:()=>window.ChinaLifeAudio?.open?.(),
 mic:()=>{if(!press('#quickVoice'))G()?.toast?.('Voice is not available here.')},
 more};
function items(){return [...document.querySelectorAll('#worldActivities button')].filter(b=>!COVERED.test(title(b)))}
function pressItem(re){const b=[...document.querySelectorAll('#worldActivities button')].find(x=>re.test(title(x)));if(b){b.click();return true}return false}
// More: the club's other buttons (toast, hype, shout-out), chat, and every other place-bar item.
function more(){const g=G(),extra=[['toast','🥂','Toast','Raise your glass'],['hype','🙌','Hype','Cheer with the DJ'],['shout','📣','Shout-out','On the big screen']].filter(([k])=>document.querySelector('.club-emotes [data-ce="'+k+'"]')),list=items();
 g.showScreen('🎉 More in the club','Everything else you can do tonight',
  '<div class="cd-more">'+extra.map(([k,i,t,s])=>'<button type="button" data-cd-ce="'+k+'"><span>'+i+'</span><b>'+t+'</b><small>'+s+'</small></button>').join('')+
  '<button type="button" data-cd-chat><span>💬</span><b>Chat</b><small>Talk to people here</small></button></div>'+
  '<div class="cd-list">'+list.map((b,n)=>'<button type="button" data-cd-item="'+n+'">'+b.innerHTML+'</button>').join('')+'</div>');
 const c=$('activityContent');
 c.querySelectorAll('[data-cd-ce]').forEach(b=>b.onclick=()=>{$('activityDialog')?.close();press('.club-emotes [data-ce="'+b.dataset.cdCe+'"]')});
 c.querySelector('[data-cd-chat]').onclick=()=>{$('activityDialog')?.close();press('#venueChatButton')};
 c.querySelectorAll('[data-cd-item]').forEach(b=>b.onclick=()=>{$('activityDialog')?.close();list[Number(b.dataset.cdItem)]?.click()})}
// Home: [key, icon, label, need shown under it].
const HOME=[['sleep','🛏','Sleep','energy'],['shower','🚿','Shower','hygiene'],['toilet','🚽','Toilet','bladder'],['eat','🍜','Eat','hunger'],['chill','📺','Chill','fun'],['friends','👋','Friends','social'],['more','•••','More',null]];
const act=id=>G()?.homeAct?.(id);
const HOME_ACT={sleep:()=>act('homeRest'),shower:()=>act('homeShower'),toilet:()=>act('homeToilet'),eat:eatSheet,chill:()=>act('homeNetflix'),friends:()=>act('homeInvitations'),more:homeMore};
function sheetButtons(list){return '<div class="cd-list">'+list.map(([k,t,s])=>'<button type="button" data-hd="'+k+'"><b>'+t+'</b><small>'+esc(s)+'</small></button>').join('')+'</div>'}
function wire(map){$('activityContent').querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>{$('activityDialog')?.close();map[b.dataset.hd]?.()})}
// Eat: cook (from the fridge when University food is on), instant noodles, order, or the free pantry when broke.
function eatSheet(){const g=G(),s=g.state,K=window.ChinaLifeKitchen,list=[];if(K?.on?.())list.push(['cook','🍳 Cook a meal','From your fridge, at the stove']);list.push(['noodles','🍜 Instant noodles','45 minutes · ¥18 · +30 hunger'],['order','🛵 Order food','A rider brings it to your door']);
 if(s.money<18&&s.pantryDay!==s.day)list.push(['pantry','🥫 Emergency pantry','Free basic meal · once a day']);
 g.showScreen('🍜 Eat','Hunger '+Math.round(s.needs.hunger)+'%',sheetButtons(list));wire({cook:()=>K.open(),noodles:()=>act('homeNoodles'),order:()=>g.delivery?.(false),pantry:()=>act('pantryMeal')})}
// More: nap, wardrobe, study, furniture, the full home sheet and your homes.
function homeMore(){const g=G(),s=g.state,desk=s.upgrades?.includes('desk');
 g.showScreen('🏠 More at home','Everything else you can do here',sheetButtons([['nap','😴 Take a nap','3 hours · restores energy'],['wardrobe','👔 Wardrobe','Change your outfit'],['call','📱 Video call family','From your bed · social up, a little less homesick'],['study','📚 Study at the desk',desk?'2 hours · trains you · uses 12 energy':'Buy a study desk in the home shop first'],['shop','🛋️ Furniture & home shop','Preview, pick a finish and buy'],['routine','🏠 Home routine','Rent, upgrades and everything at home'],['homes','🏘️ My homes','Switch between your homes']]));
 wire({nap:()=>act('homeNap'),wardrobe:()=>window.ChinaLifeHomeMoments?.wardrobe?.()||g.store?.(),call:()=>act('homeCall'),study:()=>desk?act('homeStudy'):act('homeShop'),shop:()=>act('homeShop'),routine:()=>g.home?.(),homes:()=>g.homes?.()})}
let dock=null,homeDock=null;
function buildHome(){homeDock=document.createElement('nav');homeDock.id='homeDock';homeDock.className='club-dock home-dock';homeDock.setAttribute('aria-label','Home');
 homeDock.innerHTML=HOME.map(([k,i,l,n])=>'<button type="button" data-hd-k="'+k+'"><span class="cd-i">'+i+'</span><span class="cd-l">'+l+'</span>'+(n?'<span class="cd-bar"><i></i></span>':'')+'</button>').join('');
 homeDock.querySelectorAll('[data-hd-k]').forEach(b=>b.onclick=e=>{e.stopPropagation();HOME_ACT[b.dataset.hdK]?.()});($('worldUI')||document.body).append(homeDock)}
function syncHome(){const g=G(),ui=$('worldUI'),here=homeOn()&&!!g?.state?.created&&!!g.isResidence?.(g.state.place)&&!window.ChinaLifeHomeVisits?.current&&!ui?.classList.contains('map-view')&&!document.querySelector('#worldUI .club-hud');
 document.body.classList.toggle('home-docked',here);if(here&&!homeDock)buildHome();if(homeDock)homeDock.hidden=!here;if(!here||!homeDock)return false;
 for(const [k,,,n] of HOME){if(!n)continue;const v=Math.max(0,Math.min(100,Math.round(g.state.needs?.[n]??100))),b=homeDock.querySelector('[data-hd-k="'+k+'"]'),bar=b.querySelector('.cd-bar i');bar.style.width=v+'%';b.classList.toggle('low',v<30);b.title=n+' '+v+'%'}return true}
function build(){dock=document.createElement('nav');dock.id='clubDock';dock.className='club-dock';dock.setAttribute('aria-label','Club');
 dock.innerHTML=DOCK.map(([k,i,l])=>'<button type="button" data-cd="'+k+'"><span class="cd-i">'+i+'</span><span class="cd-l">'+l+'</span></button>').join('');
 dock.querySelectorAll('[data-cd]').forEach(b=>b.onclick=e=>{e.stopPropagation();ACT[b.dataset.cd]?.()});($('worldUI')||document.body).append(dock)}
// Gossip Centre (switch gossip_dock, default ON): the same dock in the Gossip Centre ('gist'): the Gossip Room screen, the
// Hot Seat (lit while a round is on), Spill (the Gossip wall: read and post), Gossip TV, City news, the Mic and More.
const gossipOn=()=>window.ChinaLifeFlags?.cast?.('gossip_dock')!==false;
const GOSSIP=[['room','🫖','Room'],['hot','🔥','Hot Seat'],['spill','🤫','Spill'],['tv','📺','TV'],['news','📰','News'],['mic','🎤','Mic'],['more','•••','More']];
const GOSSIP_COVERED=/^(🫖\s*)?Gossip Room$|^(🔥\s*)?Hot Seat$/;
const GOSSIP_ACT={
 room:()=>window.ChinaLifeGossipRoom?.on?.()?window.ChinaLifeGossipRoom.open():G()?.gistNight?.(),
 hot:()=>window.ChinaLifeHotSeat?.enabled?.()?window.ChinaLifeHotSeat.open():G()?.toast?.('The hot seat is closed right now'),
 spill:()=>G()?.gistNight?.(),tv:()=>G()?.gossipTv?.(),news:()=>G()?.cityNews?.(),mic:ACT.mic,more:gossipMore};
// More: the room's own activities (read today's gossip, share a tip) and chat.
// With Tonight on (switch gossip_tonight), the old rows that repeat News and Spill are not offered again.
const GOSSIP_TWICE=/Read today.s city gossip|Share a useful tip/;
function gossipMore(){const g=G(),twice=window.ChinaLifeFlags?.cast?.('gossip_tonight')!==false,list=[...document.querySelectorAll('#worldActivities button')].filter(b=>!GOSSIP_COVERED.test(title(b))&&!(twice&&GOSSIP_TWICE.test(b.textContent||'')));
 g.showScreen('🫖 More in the Gossip Centre','Everything else you can do here',
  '<div class="cd-list">'+list.map((b,n)=>'<button type="button" data-cd-item="'+n+'">'+b.innerHTML+'</button>').join('')+'<button type="button" data-cd-chat><b>💬 Chat</b><small>Talk to people in the room</small></button></div>');
 const c=$('activityContent');c.querySelector('[data-cd-chat]').onclick=()=>{$('activityDialog')?.close();press('#venueChatButton')};
 c.querySelectorAll('[data-cd-item]').forEach(b=>b.onclick=()=>{$('activityDialog')?.close();list[Number(b.dataset.cdItem)]?.click()})}
let gossipDock=null;
function buildGossip(){gossipDock=document.createElement('nav');gossipDock.id='gossipDock';gossipDock.className='club-dock gossip-dock';gossipDock.setAttribute('aria-label','Gossip Centre');
 gossipDock.innerHTML=GOSSIP.map(([k,i,l])=>'<button type="button" data-gd="'+k+'"><span class="cd-i">'+i+'</span><span class="cd-l">'+l+'</span></button>').join('');
 gossipDock.querySelectorAll('[data-gd]').forEach(b=>b.onclick=e=>{e.stopPropagation();GOSSIP_ACT[b.dataset.gd]?.()});($('worldUI')||document.body).append(gossipDock)}
function syncGossip(){const g=G(),ui=$('worldUI'),here=gossipOn()&&!!g?.state?.created&&g.state.place==='gist'&&!ui?.classList.contains('map-view');
 document.body.classList.toggle('gossip-docked',here);if(here&&!gossipDock)buildGossip();if(gossipDock)gossipDock.hidden=!here;if(!here||!gossipDock)return false;
 const H=window.ChinaLifeHotSeat,live=H?.round?.status==='voting'||!!H?.show?.()?.live,hot=gossipDock.querySelector('[data-gd="hot"]');hot.classList.toggle('on',live);hot.title=live?'A Hot Seat round is on: vote True or Cap':'Take the hot seat';
 const v=$('quickVoice'),mic=gossipDock.querySelector('[data-gd="mic"]');mic.classList.toggle('on',v?.getAttribute('aria-pressed')==='true');mic.querySelector('.cd-i').textContent=v?.textContent?.trim()==='🔇'?'🔇':'🎤';mic.title=v?.getAttribute('aria-label')||'Join voice';return true}
// Energy Phase 1 (docs/ENERGY-PLAN.md, switch place_docks, default ON): the same dock at the Football Pitch, the Voting
// Booth, Hafrik HQ and the City Hospital. A button opens that place's own screen or presses its place-bar item (found by
// title, as More does); a button whose item is not there is hidden. More lists the items no button covers, and Chat.
const spotsOn=()=>window.ChinaLifeFlags?.cast?.('place_docks')!==false;
// Matched on the whole text: some items show a drawn icon in place of their emoji, which empties title().
const findItem=re=>[...document.querySelectorAll('#worldActivities button')].find(x=>re.test(x.textContent||'')),pressSpot=re=>{const b=findItem(re);if(b){b.click();return true}return false};
const chat=()=>press('#venueChatButton')||G()?.toast?.('Chat opens when you join the shared city');
// [key, icon, label, action, title pattern of the place-bar item it covers (and needs, when the action is that item)].
const FB=()=>window.ChinaLifeFootball;
const SPOTS={
 football:{name:'the Football Pitch',icon:'⚽',buttons:[
  ['play','⚡','Play',()=>FB()?.open?FB().open():pressSpot(/Play a match/),/Play a match/,!0],
  // Cups: the football screen, scrolled to the tournaments.
  ['cups','🏆','Cups',async()=>{if(!FB()?.open)return pressSpot(/Play a match/);await FB().open();setTimeout(()=>[...document.querySelectorAll('h3')].find(h=>/Tournaments/.test(h.textContent))?.scrollIntoView({block:'start',behavior:'smooth'}),250)},null,!0],
  ['kick','⚽','Kick',()=>pressSpot(/Kick-about/),/Kick-about/],
  ['watch','🎽','Watch',()=>pressSpot(/Watch from the stands/),/Watch from the stands/]]},
 voting:{name:'the Voting Booth',icon:'🗳️',buttons:[
  ['vote','🗳️','Vote',()=>G()?.politics?.(),/Open the ballot/,!0],
  ['notices','📜','Notices',()=>pressSpot(/Read election notices/),/Read election notices/],
  ['chat','💬','Chat',chat,null,!0]]},
 hq:{name:'Hafrik HQ',icon:'🏢',buttons:[
  ['services','🧾','Services',()=>pressSpot(/Apply for Hafrik services/),/Apply for Hafrik services/],
  ['work','💼','Work',()=>pressSpot(/Work at Hafrik HQ/),/Work at Hafrik HQ/],
  ['ceo','📅','CEO',()=>pressSpot(/CEO appointment/),/CEO appointment/],
  ['cowork','💻','Co-work',()=>pressSpot(/Co-work/),/Co-work/],
  ['meetup','🤝','Meetup',()=>pressSpot(/community meetup/),/community meetup/]]},
 cityhospital:{name:'the Hospital',icon:'🏥',buttons:[
  ['doctor','🩺','Doctor',()=>pressSpot(/See a doctor/),/See a doctor/],
  ['rest','🛏','Rest',()=>pressSpot(/Rest on the ward/),/Rest on the ward/],
  ['health','❤️','Health',()=>window.ChinaLifeHospital?.health?window.ChinaLifeHospital.health():G()?.needs?.(),/Your health/,!0],
  ['chat','💬','Chat',chat,null,!0]]},
 // Added 14 Nov 2026 (owner: every place gets the club's bottom row): the University and the Gym.
 university:{name:'the University',icon:'🎓',buttons:[
  ['campus','🏛️','Campus',()=>window.ChinaLifeUniversity?.open?window.ChinaLifeUniversity.open():pressSpot(/Continue your student story/),null,!0],
  ['class','📝','Class',()=>pressSpot(/Chinese class/),/Chinese class/],
  ['lecture','🎓','Lecture',()=>pressSpot(/Attend a lecture/),/Attend a lecture/],
  ['club','👥','Club',()=>pressSpot(/Join a student club/),/Join a student club/],
  ['chat','💬','Chat',chat,null,!0]]},
 gym:{name:'the Gym',icon:'🏋️',buttons:[
  ['train','🏋️','Train',()=>pressSpot(/Train for an hour/),/Train for an hour/],
  ['ball','🏀','Ball',()=>pressSpot(/Play basketball/),/Play basketball/],
  ['dance','💃','Dance',()=>pressSpot(/Join a dance class/),/Join a dance class/],
  ['meet','🤝','Meet',()=>pressSpot(/Meet someone/),/Meet someone/],
  ['chat','💬','Chat',chat,null,!0]]}};
const spotButtons=id=>[...SPOTS[id].buttons,['mic','🎤','Mic',ACT.mic,null,!0],['more','•••','More',()=>spotMore(id),null,!0]];
function spotMore(id){const g=G(),s=SPOTS[id],covered=s.buttons.map(b=>b[4]).filter(Boolean),list=[...document.querySelectorAll('#worldActivities button')].filter(b=>!covered.some(re=>re.test(b.textContent||'')));
 g.showScreen(s.icon+' More at '+s.name,'Everything else you can do here',
  '<div class="cd-list">'+list.map((b,n)=>'<button type="button" data-cd-item="'+n+'">'+b.innerHTML+'</button>').join('')+'<button type="button" data-cd-chat><b>💬 Chat</b><small>Talk to people here</small></button></div>');
 const c=$('activityContent');c.querySelector('[data-cd-chat]').onclick=()=>{$('activityDialog')?.close();chat()};
 c.querySelectorAll('[data-cd-item]').forEach(b=>b.onclick=()=>{$('activityDialog')?.close();list[Number(b.dataset.cdItem)]?.click()})}
let spotDock=null,spotId=null;
function buildSpot(id){spotDock?.remove();spotId=id;spotDock=document.createElement('nav');spotDock.id='placeDock';spotDock.className='club-dock spot-dock';spotDock.dataset.place=id;spotDock.setAttribute('aria-label',SPOTS[id].name);
 const list=spotButtons(id);spotDock.innerHTML=list.map(([k,i,l])=>'<button type="button" data-pd="'+k+'"><span class="cd-i">'+i+'</span><span class="cd-l">'+l+'</span></button>').join('');
 spotDock.querySelectorAll('[data-pd]').forEach(b=>b.onclick=e=>{e.stopPropagation();list.find(x=>x[0]===b.dataset.pd)?.[3]?.()});($('worldUI')||document.body).append(spotDock)}
function syncSpot(){const g=G(),ui=$('worldUI'),id=g?.state?.place,here=spotsOn()&&!!g?.state?.created&&!!SPOTS[id]&&!ui?.classList.contains('map-view')&&!document.querySelector('#worldUI .club-hud');
 document.body.classList.toggle('spot-docked',here);if(here&&(!spotDock||spotId!==id||!spotDock.isConnected))buildSpot(id);if(spotDock)spotDock.hidden=!here;if(!here)return false;
 // An item button shows only while its place-bar item is there (some come from switches, e.g. HQ services).
 for(const [k,,,,re,always] of spotButtons(id))if(re&&!always){const b=spotDock.querySelector('[data-pd="'+k+'"]');if(b)b.hidden=!findItem(re)}
 const v=$('quickVoice'),mic=spotDock.querySelector('[data-pd="mic"]');mic.classList.toggle('on',v?.getAttribute('aria-pressed')==='true');mic.querySelector('.cd-i').textContent=v?.textContent?.trim()==='🔇'?'🔇':'🎤';mic.title=v?.getAttribute('aria-label')||'Join voice';return true}
// Show the dock while you are inside a club (the club HUD exists), keep Music and Mic lit to match what is playing / live.
function sync(){const home=syncHome(),gossip=syncGossip(),spot=syncSpot(),atHome=home||gossip||spot,inClub=on()&&!!document.querySelector('#worldUI .club-hud');document.body.classList.toggle('club-docked',inClub);document.body.classList.toggle('place-docked',inClub||atHome);
 const nav0=document.querySelector('.world-nav');if(nav0&&(inClub||atHome))document.body.style.setProperty('--cd-nav',nav0.getBoundingClientRect().height+'px');
 if(inClub&&!dock)build();if(dock)dock.hidden=!inClub;if(!inClub||!dock)return;
 const nav=document.querySelector('.world-nav');if(nav)document.body.style.setProperty('--cd-nav',nav.getBoundingClientRect().height+'px');
 const a=window.ChinaLifeAudio,m=dock.querySelector('[data-cd="music"]');m.classList.toggle('on',!!a?.playing);m.title=a?.playing&&a.nowPlaying?'Now playing: '+(a.nowPlaying.title||a.nowPlaying.name||''):'Request a song';
 const v=$('quickVoice'),mic=dock.querySelector('[data-cd="mic"]'),live=v?.getAttribute('aria-pressed')==='true';mic.classList.toggle('on',live);mic.querySelector('.cd-i').textContent=v?.textContent?.trim()==='🔇'?'🔇':'🎤';mic.title=v?.getAttribute('aria-label')||'Join voice'}
setInterval(sync,1000);if(typeof MutationObserver!=='undefined')new MutationObserver(sync).observe(document.body,{childList:true,subtree:false});window.addEventListener('chinalife:update',sync);
window.ChinaLifeClubDock={sync,act:k=>ACT[k]?.(),more,items,home:k=>HOME_ACT[k]?.(),gossip:k=>GOSSIP_ACT[k]?.(),spot:k=>spotButtons(spotId||G()?.state?.place).find(x=>x[0]===k)?.[3]?.(),SPOTS};
const css=document.createElement('style');css.textContent=
 'html:root body.place-docked #worldUI .club-dock{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--cd-nav,84px) + 18px + env(safe-area-inset-bottom));z-index:30;display:flex;gap:4px;padding:6px;border-radius:26px;background:rgb(14 8 30 / .78);border:1px solid rgb(255 255 255 / .14);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 10px 30px rgb(0 0 0 / .35);pointer-events:auto;max-width:calc(100vw - 24px)}'+
 'html:root body.place-docked #worldUI .club-dock button{display:grid;justify-items:center;gap:2px;width:46px;min-height:52px;padding:6px 0 4px;border:0;border-radius:18px;background:transparent;color:#fff;font:700 10px/1.1 system-ui,sans-serif}'+
 'html:root body.place-docked #worldUI .club-dock .cd-i{font-size:22px;line-height:1}html:root body.place-docked #worldUI .club-dock button:active{background:rgb(255 255 255 / .14)}'+
 'html:root body.place-docked #worldUI .club-dock button.on{background:linear-gradient(135deg,#7b3fe4,#e0399b)}'+
 // In a club the dock replaces the Party fan, music / radio buttons, the DJ chip, the mic and the place bar.
 'html:root body.club-docked #worldUI :is(.club-emotes,#clubMusicToggle,.club-music-fab,.radio-fab,.club-now,#quickVoice,.quick-voice,#infoPanel){display:none!important}'+
 // The joystick and jump sit above the dock.
 'html:root body.place-docked #worldUI :is(.tp-stick,.tp-jump){bottom:calc(var(--cd-nav,84px) + 92px + env(safe-area-inset-bottom))!important}'+
 // Sheets opened in a club stop at about half height, with the club still showing behind them.
 // The scroll box inside gets the same height, or the bottom of a long screen can never be scrolled into view.
 'html:root body.place-docked dialog:is(#activityDialog,#audioDialog)[open]{max-height:62vh!important;top:auto!important}html:root body.place-docked dialog:is(#activityDialog,#audioDialog)[open]{display:flex!important;flex-direction:column}html:root body.place-docked dialog[open]>:is(#activityContent,#audioContent){flex:1 1 auto;min-height:0;max-height:none!important;overflow-y:auto}html:root body.place-docked dialog:is(#activityDialog,#audioDialog)::backdrop{background:rgb(0 0 0 / .18)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'+
 // The dance competition's move sheet stays small (club-host.js), moves in a 2 × 2 grid.
 'html:root body.club-docked dialog#activityDialog.cd-compact[open]{max-height:36vh!important;height:auto!important;min-height:0!important}html:root body.club-docked #activityDialog.cd-compact .dance-pad{display:grid;grid-template-columns:1fr 1fr;gap:8px}html:root body.club-docked #activityDialog.cd-compact .dance-pad button{min-height:52px;margin:0}'+
 // In the Gossip Centre the dock replaces the place bar and the mic button.
 'html:root body:is(.gossip-docked,.spot-docked) #worldUI :is(#infoPanel,#quickVoice,.quick-voice){display:none!important}html:root body #worldUI .club-dock button[hidden]{display:none!important}'+
 // A hidden dock stays hidden (the club, home and gossip docks share one spot and one style).
 'html:root body #worldUI .club-dock[hidden]{display:none!important}'+
 // At home the dock replaces the place bar; each need button has a bar (red when low).
 'html:root body.home-docked #worldUI #infoPanel{display:none!important}html:root body.place-docked #worldUI .home-dock .cd-bar{display:block;width:28px;height:3px;border-radius:2px;background:rgb(255 255 255 / .22);overflow:hidden}html:root body.place-docked #worldUI .home-dock .cd-bar i{display:block;height:100%;background:#4ade80}html:root body.place-docked #worldUI .home-dock .low .cd-bar i{background:#f87171}html:root body.place-docked #worldUI .home-dock .low .cd-i{animation:cdPulse 1.4s ease-in-out infinite}@keyframes cdPulse{50%{transform:scale(1.12)}}'+
 '.cd-more{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.cd-more button{display:grid;justify-items:center;gap:2px;padding:10px 4px;border-radius:16px;border:1px solid #e3d9f5;background:#faf7ff}.cd-more span{font-size:24px}.cd-more b{font-size:13px}.cd-more small{font-size:10px;color:#6b6280;text-align:center}'+
 '.cd-list{display:grid;gap:8px}.cd-list button{display:grid;gap:2px;text-align:left;padding:12px 14px;border-radius:16px;border:1px solid #e3e8ef;background:#fff}';
document.head?.append(css);
})();
