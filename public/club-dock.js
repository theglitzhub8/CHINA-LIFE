// Club Phase 1 (docs/CLUB-PLAN.md, appadmin switch club_dock, default ON): inside a club, one row of big buttons is always
// on screen just above Home / Map / People / Phone: Door & VIP, Bar, Dance, Spray, Music, Mic and More. It replaces the
// Party fan, the ▶ music button, the "DJ is ready" chip, the radio and the place bar there, and option sheets open at
// half height so the club stays in view. The buttons press the club's own controls (club-host.js / club-fx.js
// .club-emotes, voice.js #quickVoice, audio.js, game.clubAccess), so every club behaves as before.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('club_dock')!==false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const press=sel=>{const b=document.querySelector(sel);if(b){b.click();return true}return false};
const DOCK=[['door','🎟','Door'],['bar','🍸','Bar'],['dance','💃','Dance'],['spray','💸','Spray'],['music','🎧','Music'],['mic','🎤','Mic'],['more','•••','More']];
// Place-bar items the dock already covers (by their title), so More lists only the rest.
const COVERED=/^(🎟\s*)?Entry & VIP$|^(🍸\s*)?Bar$|^(🎧\s*)?Change \/ request song$/,title=b=>(b.childNodes[0]?.textContent||'').trim();
const ACT={
 door:()=>G()?.clubAccess?.(G().state.place),
 bar:()=>press('.club-emotes [data-ce="menu"]')||pressItem(/^(🍸\s*)?Bar$/),
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
let dock=null;
function build(){dock=document.createElement('nav');dock.id='clubDock';dock.className='club-dock';dock.setAttribute('aria-label','Club');
 dock.innerHTML=DOCK.map(([k,i,l])=>'<button type="button" data-cd="'+k+'"><span class="cd-i">'+i+'</span><span class="cd-l">'+l+'</span></button>').join('');
 dock.querySelectorAll('[data-cd]').forEach(b=>b.onclick=e=>{e.stopPropagation();ACT[b.dataset.cd]?.()});($('worldUI')||document.body).append(dock)}
// Show the dock while you are inside a club (the club HUD exists), keep Music and Mic lit to match what is playing / live.
function sync(){const inClub=on()&&!!document.querySelector('#worldUI .club-hud');document.body.classList.toggle('club-docked',inClub);
 if(inClub&&!dock)build();if(dock)dock.hidden=!inClub;if(!inClub||!dock)return;
 const nav=document.querySelector('.world-nav');if(nav)document.body.style.setProperty('--cd-nav',nav.getBoundingClientRect().height+'px');
 const a=window.ChinaLifeAudio,m=dock.querySelector('[data-cd="music"]');m.classList.toggle('on',!!a?.playing);m.title=a?.playing&&a.nowPlaying?'Now playing: '+(a.nowPlaying.title||a.nowPlaying.name||''):'Request a song';
 const v=$('quickVoice'),mic=dock.querySelector('[data-cd="mic"]'),live=v?.getAttribute('aria-pressed')==='true';mic.classList.toggle('on',live);mic.querySelector('.cd-i').textContent=v?.textContent?.trim()==='🔇'?'🔇':'🎤';mic.title=v?.getAttribute('aria-label')||'Join voice'}
setInterval(sync,1000);if(typeof MutationObserver!=='undefined')new MutationObserver(sync).observe(document.body,{childList:true,subtree:false});window.addEventListener('chinalife:update',sync);
window.ChinaLifeClubDock={sync,act:k=>ACT[k]?.(),more,items};
const css=document.createElement('style');css.textContent=
 'html:root body.club-docked #worldUI .club-dock{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--cd-nav,84px) + 18px + env(safe-area-inset-bottom));z-index:30;display:flex;gap:4px;padding:6px;border-radius:26px;background:rgb(14 8 30 / .78);border:1px solid rgb(255 255 255 / .14);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 10px 30px rgb(0 0 0 / .35);pointer-events:auto;max-width:calc(100vw - 24px)}'+
 'html:root body.club-docked #worldUI .club-dock button{display:grid;justify-items:center;gap:2px;width:46px;min-height:52px;padding:6px 0 4px;border:0;border-radius:18px;background:transparent;color:#fff;font:700 10px/1.1 system-ui,sans-serif}'+
 'html:root body.club-docked #worldUI .club-dock .cd-i{font-size:22px;line-height:1}html:root body.club-docked #worldUI .club-dock button:active{background:rgb(255 255 255 / .14)}'+
 'html:root body.club-docked #worldUI .club-dock button.on{background:linear-gradient(135deg,#7b3fe4,#e0399b)}'+
 // In a club the dock replaces the Party fan, music / radio buttons, the DJ chip, the mic and the place bar.
 'html:root body.club-docked #worldUI :is(.club-emotes,#clubMusicToggle,.club-music-fab,.radio-fab,.club-now,#quickVoice,.quick-voice,#infoPanel){display:none!important}'+
 // The joystick and jump sit above the dock.
 'html:root body.club-docked #worldUI :is(.tp-stick,.tp-jump){bottom:calc(var(--cd-nav,84px) + 92px + env(safe-area-inset-bottom))!important}'+
 // Sheets opened in a club stop at about half height, with the club still showing behind them.
 'html:root body.club-docked dialog:is(#activityDialog,#audioDialog)[open]{max-height:62vh!important;top:auto!important}html:root body.club-docked dialog:is(#activityDialog,#audioDialog)::backdrop{background:rgb(0 0 0 / .18)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'+
 '.cd-more{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.cd-more button{display:grid;justify-items:center;gap:2px;padding:10px 4px;border-radius:16px;border:1px solid #e3d9f5;background:#faf7ff}.cd-more span{font-size:24px}.cd-more b{font-size:13px}.cd-more small{font-size:10px;color:#6b6280;text-align:center}'+
 '.cd-list{display:grid;gap:8px}.cd-list button{display:grid;gap:2px;text-align:left;padding:12px 14px;border-radius:16px;border:1px solid #e3e8ef;background:#fff}';
document.head?.append(css);
})();
