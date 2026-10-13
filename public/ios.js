// R2 · Hafrik iOS: one outline icon set, the single-row top bar, sheet detents, one close button,
// the club Party button and map-label decluttering. No network calls and no polling.
(()=>{
const P={ // 24×24 outline paths, 2px stroke (Lucide-style)
 x:'<path d="M18 6 6 18M6 6l12 12"/>',back:'<path d="m15 18-6-6 6-6"/>',fwd:'<path d="m9 18 6-6-6-6"/>',down:'<path d="m6 9 6 6 6-6"/>',up:'<path d="m18 15-6-6-6 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
 rotate:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',fit:'<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
 smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 tag:'<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
 pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
 mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0M12 17v5"/>',music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 jump:'<path d="m12 4-7 7h4v7h6v-7h4z"/>',chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12"/>',gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
 party:'<path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m22 2-2.2.8a2.9 2.9 0 0 0-1.9 3.2c.1.9-.6 1.6-1.4 1.6h-.4c-.9 0-1.7.6-2 1.5L13 11"/><path d="M11 13c1.9 1.9 2.8 4.2 2 5s-3.1-.1-5-2-2.8-4.2-2-5 3.1.1 5 2"/>',
 dance:'<circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v5M7 10l4-2 3 2 3-1M12 8l-1 6"/>',toast:'<path d="M8 22h8M12 15v7M7 3h10l-1 8a4 4 0 0 1-8 0z"/><path d="M7.5 7h9"/>',
 hype:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3a2.5 2.5 0 0 0 2.5 2.8"/>',
 spray:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',drinks:'<path d="M8 22h8M12 11v11M3 3h18l-9 8z"/>',
 nav:'<path d="m3 11 19-9-9 19-2-8z"/>',hand:'<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16.9a2 2 0 0 1 3-2.8L8 16"/>',
 walk:'<circle cx="13" cy="4" r="2"/><path d="m8 21 3-6 3 2v4M9 9l3-2 3 3 3 1M12 7l-1 6"/>',play:'<path d="M7 4v16l13-8z"/>',pause:'<path d="M8 4v16M16 4v16"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',food:'<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',handshake:'<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a3 3 0 0 0-4.2 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5.8 5.8 0 0 1 7 .9L22 9M2 12l5.5 5.5a1 1 0 1 0 3-3"/><path d="M2 9l3-3"/>',volume:'<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',mute:'<path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>',bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',send:'<path d="M7 17 17 7M7 7h10v10"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'};
const svg=(n,c='')=>'<svg class="ic '+c+'" viewBox="0 0 24 24" aria-hidden="true">'+(P[n]||'')+'</svg>';
window.ChinaLifeIcon=svg;
// UI glyphs → icon. Emoji stay only inside content (food, gifts…), never as a control.
const G={'×':'x','✕':'x','‹':'back','⌄':'down','⌃':'up','＋':'plus','−':'minus','⋯':'more','↻':'rotate','⛶':'fit','🔍':'search','🏷️':'tag','🏷':'tag','📍':'pin','🗺️':'map','🗺':'map','🎙':'mic','🎙️':'mic','🎵':'music','⤴':'jump','💬':'chat','🎁':'gift','💃':'dance','🥂':'toast','🙌':'hype','💸':'spray','🍾':'drinks','🚶':'walk','◎':'nav','👥':'users','🎤':'mic','🤝':'handshake','🔊':'volume','🔇':'mute','🔔':'bell','↗':'send','⌂':'home','📍':'pin','⏱':'clock','🍽':'food','▶':'play','▶️':'play','⏸':'pause','⏸️':'pause','■':'stop'};
const KEYS=Object.keys(G).sort((a,b)=>b.length-a.length);
const CONTROLS='#worldUI button,dialog button,dialog h3,dialog label,.social-tabs button,#worldUI .venue-icon,dialog .close-x,dialog .social-close,dialog .social-back,dialog .phone-back,.club-emotes button,#tpJump';
function iconize(el){if(el.dataset.ioSkip)return;const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const nodes=[];while(tw.nextNode())nodes.push(tw.currentNode);for(const n of nodes){if(n.parentElement.closest('svg'))continue;if(n.parentElement!==el&&n.parentElement.closest(CONTROLS)!==el)continue;const t=n.textContent;const s=t.trimStart();const k=KEYS.find(k=>s.startsWith(k));if(!k)continue;
  const rest=s.slice(k.length);const span=document.createElement('span');span.className='io-g';span.innerHTML=svg(G[k]);n.replaceWith(span,...(rest.trim()&&!el.matches('.phone-back')?[document.createTextNode(rest.replace(/^\s+/,''))]:[]))}
 if(el.matches('.close-x,.social-close'))el.classList.add('ios-close');}
// The svg sits inside a span wrapper; unwrap so sizing rules apply to .ic directly.
function unwrap(el){el.querySelectorAll('.io-g').forEach(s=>s.replaceWith(...s.childNodes))}
function pass(root){const list=root.matches?.(CONTROLS)?[root]:[];root.querySelectorAll?.(CONTROLS).forEach(e=>list.push(e));for(const e of list){iconize(e);unwrap(e)}}
// Top bar: one row. City under the time, the account as an icon button, wallet on the right.
function topBar(){const bar=document.querySelector('#worldUI .hud-bar');if(!bar||bar.dataset.io)return;bar.dataset.io='1';
 const time=bar.querySelector('.time-chip'),city=document.getElementById('worldCity'),cloud=document.getElementById('cloudButton'),wallet=document.getElementById('worldWallet');
 if(time&&city)time.appendChild(city);const right=document.createElement('div');right.className='hud-right';if(cloud){cloud.insertAdjacentHTML('afterbegin',svg('user'));right.appendChild(cloud)}if(wallet)right.appendChild(wallet);bar.appendChild(right);
 const guest=()=>cloud&&cloud.classList.toggle('guest',/guest|sign in|join/i.test(cloud.textContent||''));guest();if(cloud)new MutationObserver(guest).observe(cloud,{subtree:true,characterData:true,childList:true})}
// Club: one Party button that fans out the five actions.
function party(){document.querySelectorAll('.club-emotes:not([data-io])').forEach(bar=>{bar.dataset.io='1';const b=document.createElement('button');b.type='button';b.className='party-toggle';b.dataset.ioSkip='1';b.setAttribute('aria-expanded','false');b.innerHTML=svg('party')+'<span>Party</span>';
 b.onclick=e=>{e.stopPropagation();const o=bar.classList.toggle('open');b.setAttribute('aria-expanded',String(o));haptic()};bar.appendChild(b);
 bar.addEventListener('click',e=>{const t=e.target.closest('button');if(t&&t!==b&&t.dataset.ce!=='menu')setTimeout(()=>{bar.classList.remove('open');b.setAttribute('aria-expanded','false')},400)})})}
// Sheets: every modal is a sheet with a grabber; the room card has peek / half / near-full detents.
function sheets(){document.querySelectorAll('dialog:not([data-io])').forEach(d=>{if(d.id==='onboarding')return;d.dataset.io='1';d.classList.add('ios-sheet');
  let y0=null;d.addEventListener('touchstart',e=>{const r=d.getBoundingClientRect();y0=e.touches[0].clientY-r.top<40?e.touches[0].clientY:null},{passive:true});
  d.addEventListener('touchend',e=>{if(y0==null)return;const dy=e.changedTouches[0].clientY-y0;y0=null;if(dy>90)(d.querySelector('.close-x,.social-close')||{click:()=>d.close()}).click()},{passive:true})});
 const ui=document.getElementById('worldUI'),card=document.getElementById('infoPanel');if(!ui||!card||card.dataset.io)return;card.dataset.io='1';
 let sy=null;card.addEventListener('touchstart',e=>{if(window.ChinaLifeSheetDrag)return;sy=e.touches[0].clientY},{passive:true});
 card.addEventListener('touchend',e=>{if(sy==null)return;const dy=e.changedTouches[0].clientY-sy;sy=null;if(Math.abs(dy)<36||card.scrollTop>0&&dy>0)return;
  const open=ui.classList.contains('dock-open'),full=ui.classList.contains('dock-full');
  if(dy<0){if(open)ui.classList.add('dock-full')}else if(full){setTimeout(()=>ui.classList.add('dock-open'),0);ui.classList.remove('dock-full')}},{passive:true});
 new MutationObserver(()=>{if(!ui.classList.contains('dock-open')&&ui.classList.contains('dock-full'))ui.classList.remove('dock-full')}).observe(ui,{attributes:true,attributeFilter:['class']})}
// Map: fewer labels. Keep districts and the closest, non-overlapping venues (at most 9) while the map is open.
// Scene labels: never on top of a control. On the map, also keep only districts and the closest 9 venues.
const HUD='#worldUI .hud-bar,.coach-card,#worldUI .world-side>*,#worldUI .scene-tools>button,#worldUI #tpToggle,#worldUI #quickVoice,#worldUI .radio-fab,#worldUI #clubMusicToggle,.club-emotes>button,.club-meter,#worldUI .tp-stick,#worldUI .tp-jump,#worldUI .venue-card,#worldUI .world-nav,#worldUI [class*=street-] button,#worldUI #tpWalk,#worldUI #tpEnter';
let cullT=null;function cull(){const ui=document.getElementById('worldUI');if(!ui||document.hidden)return;const labels=[...document.querySelectorAll('#sceneLabels .scene-label')];if(!labels.length)return;
 const map=ui.classList.contains('map-view');const W=innerWidth,H=innerHeight,cx=W/2,cy=H*.45;
 const hud=[...document.querySelectorAll(HUD)].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);const kept=[];let venues=0;
 const hit=(r,list,pad)=>list.some(k=>r.left<k.right+pad&&k.left<r.right+pad&&r.top<k.bottom+pad&&k.top<r.bottom+pad);
 const items=labels.map(l=>{const r=l.getBoundingClientRect();const t=(l.innerText||'').trim();const district=/^[A-Z\s·]+$/.test(t);const me=t===(window.ChinaLife?.state?.name||'')||l.classList.contains('self');return {l,r,p:me?-2:district?-1:Math.hypot(r.left+r.width/2-cx,r.top+r.height/2-cy)}}).sort((a,b)=>a.p-b.p);
 for(const i of items){const r=i.r;let hide=r.width>0&&hit(r,hud,2);if(map&&!hide&&r.width>0){hide=hit(r,kept,6)||(i.p>=0&&venues>=9);if(!hide){if(i.p>=0)venues++;kept.push(r)}}
  if(hide!==i.l.classList.contains('ios-cull'))i.l.classList.toggle('ios-cull',hide)}}
function mapWatch(){if(!cullT)cullT=setInterval(()=>requestAnimationFrame(cull),400)}
// Haptic-like press feedback.
const reduce=matchMedia('(prefers-reduced-motion: reduce)');function haptic(){if(!reduce.matches&&navigator.vibrate)try{navigator.vibrate(8)}catch{}try{window.webkit?.messageHandlers?.hafrikHaptic?.postMessage('light')}catch{}}
document.addEventListener('pointerdown',e=>{if(e.target.closest?.('button,[role=button]'))haptic()},{passive:true,capture:true});
// One batched pass per frame for whatever changed.
let queue=new Set(),raf=0;const flush=()=>{raf=0;const q=[...queue];queue.clear();for(const n of q)if(n.isConnected)pass(n);party();sheets()};
const mo=new MutationObserver(ms=>{for(const m of ms){const t=m.type==='characterData'?m.target.parentElement:m.target;if(t&&t.nodeType===1)queue.add(t.closest(CONTROLS)||t)}if(!raf)raf=requestAnimationFrame(flush)});
function boot(){const em=document.getElementById('worldEmote');if(em&&/😊/.test(em.textContent)){em.textContent='';em.insertAdjacentHTML('afterbegin',svg('smile'))}topBar();pass(document.body);party();sheets();mapWatch();mo.observe(document.body,{subtree:true,childList:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
