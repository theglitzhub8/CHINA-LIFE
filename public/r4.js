// R4 · one-time intro tips, empty states, the collapsing large title and small polish.
// Client-only: no requests, no new polling, no coins.
(()=>{
const $=id=>document.getElementById(id),G=()=>window.ChinaLife,I=n=>window.ChinaLifeIcon?.(n)||'';
let raf=0;const soon=f=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;f()})};

/* ---------- Empty states: icon, one line, one button ---------- */
function empties(root=document){root.querySelectorAll('.r4-empty:not([data-io])').forEach(e=>{e.dataset.io='1';e.insertAdjacentHTML('afterbegin','<span class="r4-empty-ic">'+I(e.dataset.r4Icon||'nav')+'</span>')});
 // Tasks with nothing done yet, and a Learning Hub with every course at 0%.
 const panel=$('activityContent');if(!panel||panel.querySelector('.r4-empty'))return;const t=panel.innerText||'';
 if(/\b0\s*\/\s*4\b/.test(t)&&/task/i.test(t)){panel.querySelector('.activity-panel>p,.activity-panel h2')?.insertAdjacentHTML('afterend','<div class="r4-empty" data-r4-icon="clock" data-io="1"><span class="r4-empty-ic">'+I('clock')+'</span><p>Start with today’s 4 quick tasks.</p><div><button class="r4-go" data-r4-show="1">Show me</button></div></div>')}
 else if(/learning hub|courses/i.test(t)&&/no courses|no lessons|nothing (here|yet)/i.test(t)&&!/\d+% complete/i.test(t)){panel.querySelector('.activity-panel>p,.activity-panel h2')?.insertAdjacentHTML('afterend','<div class="r4-empty" data-r4-icon="book" data-io="1"><span class="r4-empty-ic">'+I('book')+'</span><p>Lesson 1 takes 2 minutes.</p><div><button class="r4-go" data-r4-start="1">Start</button></div></div>')}}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-r4-go],#r4MoveIn,[data-r4-show],[data-r4-start]');if(!b)return;e.preventDefault();e.stopPropagation();
 if(b.id==='r4MoveIn')return G()?.chooseHome?.();
 if(b.dataset.r4Show){const first=$('activityContent').querySelector('.r4-empty ~ * button, .today-list > *, [data-task]');first?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});return}
 if(b.dataset.r4Start){const c=[...$('activityContent').querySelectorAll('button')].find(x=>!x.closest('.r4-empty')&&/lesson|start|course|learn/i.test(x.innerText));c?.click();return}
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());G()?.walkIn?.(b.dataset.r4Go)},true);

/* ---------- Intro tips: once per screen, dismissible, at most one a minute ---------- */
const TIPS={phone:'Your apps, all on one page. Tap one to open it.',people:'See who’s around. Tap someone to say hi.',map:'Tap a place to travel there.',club:'Tap Party to dance, toast or order drinks.',voting:'Voting is paused. You can still read the ballot.',home:'Rest, cook and shower here to refill your needs.',street:'Walk around to meet other players.'};
const KEY='chinalife-tips';const seen=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return []}};let lastTip=0,tipEl=null,tipFor='';
function where(){const st=G()?.state,ui=$('worldUI');if(!st?.created||!ui)return null;
 if($('phoneDialog')?.open)return 'phone';if($('socialDialog')?.open)return 'people';if(document.querySelector('dialog[open]'))return null;
 if(ui.classList.contains('map-view'))return 'map';if(window.ChinaLifeWorld?.street?.())return 'street';if(document.querySelector('.club-hud'))return 'club';
 if(st.place==='voting')return 'voting';if(st.place==='home'||String(st.place).startsWith('home-'))return 'home';return null}
function tip(){const step=window.ChinaLifeOnboarding?.step;const touring=step&&!/^(skip|done|wait)$/.test(step);const k=where();
 if(tipEl&&(k!==tipFor||touring)){tipEl.remove();tipEl=null;tipFor=''}
 if(!k||touring||tipEl||seen().includes(k)||Date.now()-lastTip<60000)return;
 const st=G().state;if(k==='club'&&Math.floor((st.hour||0)/60)%24>=22)return; // no tips in clubs late at night
 lastTip=Date.now();tipFor=k;tipEl=document.createElement('div');tipEl.className='r4-tip';tipEl.setAttribute('role','status');tipEl.innerHTML='<span class="r4-tip-ic">'+I('nav')+'</span><p>'+TIPS[k]+'</p><button type="button">Got it</button>';
 tipEl.querySelector('button').onclick=()=>{localStorage.setItem(KEY,JSON.stringify([...new Set([...seen(),k])]));tipEl.remove();tipEl=null;tipFor=''};
 // In a sheet the tip sits in the flow at the top; over the scene it floats under the top bar.
 const host=k==='phone'?$('phoneContent'):k==='people'?$('socialBody'):null;if(host){tipEl.classList.add('inline');host.prepend(tipEl)}else{$('worldUI').appendChild(tipEl)}}

/* ---------- Large title collapses into an inline 17 pt title on scroll ---------- */
function titles(){document.querySelectorAll('dialog[open]:not([data-r4t])').forEach(d=>{d.dataset.r4t='1';d.addEventListener('scroll',()=>bar(d),{passive:true,capture:true})})}
function bar(d){const sc=[d,...d.querySelectorAll('*')].find(e=>e.scrollTop>0)||d;const y=sc.scrollTop;const h=d.querySelector('.activity-panel>h2,.social-heading h2,#socialTitle');if(!h)return;let t=d.querySelector(':scope>.r4-inline-title');
 if(!t){t=document.createElement('div');t.className='r4-inline-title';t.setAttribute('aria-hidden','true');d.prepend(t)}t.textContent=h.textContent.trim();d.classList.toggle('r4-scrolled',y>48)}

/* ---------- R4b: iOS action sheet for destructive or costly choices ---------- */
// ChinaLifeSheet.confirm({title,message,ok,destructive}) -> Promise<boolean>. A modal <dialog>, so it stacks above other sheets.
function sheetConfirm({title='',message='',ok='OK',destructive=false}={}){return new Promise(done=>{
 const d=document.createElement('dialog');d.className='r4-sheet';d.setAttribute('aria-label',title);
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 d.innerHTML='<div class="r4-sheet-group"><div class="r4-sheet-head"><b>'+esc(title)+'</b>'+(message?'<p>'+esc(message)+'</p>':'')+'</div><button type="button" class="r4-sheet-ok'+(destructive?' destructive':'')+'">'+esc(ok)+'</button></div><button type="button" class="r4-sheet-cancel">Cancel</button>';
 let settled=false;const end=v=>{if(settled)return;settled=true;d.classList.add('out');setTimeout(()=>{d.close();d.remove()},180);done(v)};
 d.querySelector('.r4-sheet-ok').onclick=()=>end(true);d.querySelector('.r4-sheet-cancel').onclick=()=>end(false);
 d.addEventListener('cancel',e=>{e.preventDefault();end(false)});d.addEventListener('click',e=>{if(e.target===d)end(false)});
 document.body.appendChild(d);d.showModal();d.querySelector('.r4-sheet-cancel').focus();try{navigator.vibrate?.(8)}catch{}})}
window.ChinaLifeSheet={confirm:sheetConfirm};

/* ---------- R4b: every sheet has a close, swipe-down and the Back button closes the top sheet ---------- */
const SHEETS='#activityDialog,#phoneDialog,#helpDialog,#sharedDialog,#audioDialog,#voiceDialog,#socialDialog,#cloudDialog,#aiDialog,#radioDialog,#liveMapDialog,dialog.r4-where';
function sheetify(){document.querySelectorAll('dialog[open]').forEach(d=>{if(!d.matches(SHEETS)||d.dataset.r4s)return;d.dataset.r4s='1';
  const vis=e=>e&&e.offsetParent!==null&&getComputedStyle(e).visibility!=='hidden';
  if(![...d.querySelectorAll('.ios-close,[id^=close],[aria-label^=Close],[aria-label^=Minimize],.r4-x')].some(vis)){const x=document.createElement('button');x.type='button';x.className='r4-x';x.setAttribute('aria-label','Close');x.textContent='✕';x.onclick=()=>d.close();d.appendChild(x)}
  if(!d.querySelector(':scope>.r4-grab')){const g=document.createElement('div');g.className='r4-grab';g.setAttribute('aria-hidden','true');d.prepend(g)}
  // One sentinel history entry while any sheet is open; Back pops it and closes the top sheet (no history.back() races).
  if(!history.state?.r4sheet){try{history.pushState({r4sheet:1},'')}catch{}}
  d.addEventListener('close',function onc(){d.removeEventListener('close',onc);delete d.dataset.r4s;d.style.transform=''})})}
window.addEventListener('popstate',()=>{const open=[...document.querySelectorAll('dialog[open]')].filter(d=>d.matches(SHEETS)||d.classList.contains('r4-sheet'));const top=open[open.length-1];if(top){top.close();if(open.length>1){try{history.pushState({r4sheet:1},'')}catch{}}}});
// Swipe down: from the grab strip anywhere, or from content when it is scrolled to the top.
let sw=null;
document.addEventListener('touchstart',e=>{const d=e.target.closest?.('dialog[open]');if(!d||!d.matches(SHEETS)||e.touches.length!==1)return;
  let n=e.target,top=true;while(n&&n!==d){if(n.scrollHeight>n.clientHeight+2&&/auto|scroll/.test(getComputedStyle(n).overflowY)&&n.scrollTop>0){top=false;break}n=n.parentElement}if(d.scrollTop>0)top=false;
  if(!top&&!e.target.closest('.r4-grab'))return;if(e.target.closest('input,textarea,select,[type=range],.tp-stick'))return;sw={d,y:e.touches[0].clientY,dy:0,t:Date.now()}},{passive:true});
document.addEventListener('touchmove',e=>{if(!sw)return;sw.dy=Math.max(0,e.touches[0].clientY-sw.y);if(sw.dy>8){sw.d.classList.add('r4-swiping');sw.d.style.transform='translateY('+sw.dy+'px)'}},{passive:true});
document.addEventListener('touchend',()=>{if(!sw)return;const {d,dy,t}=sw;sw=null;d.classList.remove('r4-swiping');if(dy>110||(dy>50&&dy/(Date.now()-t)>.6)){d.style.transform='translateY(100%)';setTimeout(()=>{d.close();d.style.transform=''},180)}else d.style.transform=''},{passive:true});

/* ---------- R4b: Map opens a "Where to?" picker first ---------- */
const POPULAR=['cafe','night','mall','campus','park','market','gym','ef','plaza','voting'];
function wherePicker(fullMap){const g=G(),st=g?.state;if(!st)return fullMap();const places=(g.placesIn?.(st.city)||[]).filter(p=>p[0]!==st.place);if(!places.length)return fullMap();
 let d=document.querySelector('dialog.r4-where');if(!d){d=document.createElement('dialog');d.className='r4-where ios-sheet';document.body.appendChild(d)}
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 const row=p=>'<li><button type="button" data-r4-to="'+esc(p[0])+'"><i>'+esc(p[3]||'📍')+'</i><span>'+esc(p[1])+'<small>'+esc(p[2]||'')+'</small></span></button></li>';
 const pop=POPULAR.map(id=>places.find(p=>p[0]===id)).filter(Boolean).slice(0,6);
 d.innerHTML='<h2>Where to?</h2><input type="search" placeholder="Search places in '+esc(st.city)+'" aria-label="Search places" enterkeyhint="search"><h3>Popular</h3><ul class="r4-pop">'+(pop.length?pop:places.slice(0,6)).map(row).join('')+'</ul><ul class="r4-res" hidden></ul><button type="button" class="r4-fullmap">Open the city map</button>';
 const q=d.querySelector('input'),res=d.querySelector('.r4-res'),popl=d.querySelector('.r4-pop'),h3=d.querySelector('h3');
 q.oninput=()=>{const v=q.value.trim().toLowerCase();res.hidden=!v;popl.hidden=!!v;h3.textContent=v?'Results':'Popular';if(v){const m=places.filter(p=>(p[1]+' '+(p[2]||'')+' '+p[0]).toLowerCase().includes(v)).slice(0,12);res.innerHTML=m.length?m.map(row).join(''):'<li><small>No places match.</small></li>'}};
 d.onclick=e=>{const b=e.target.closest('[data-r4-to]');if(b){d.close();(g.travel||g.walkIn)(b.dataset.r4To);return}if(e.target.closest('.r4-fullmap')){d.close();fullMap()}};
 if(!d.open)d.showModal();sheetify()}
function wireMap(){const nav=$('navMap');if(!nav||!nav.onclick||nav.onclick.__r4)return;const orig=nav.onclick;const f=function(e){const step=window.ChinaLifeOnboarding?.step;const touring=step&&!/^(skip|done|wait)$/.test(step);if(touring||$('worldUI')?.classList.contains('map-view')||window.ChinaLifeWorld?.busy)return orig.call(this,e);// R4d: Map opens the city view and expands the room card to its own Where to section (no separate card).
orig.call(nav,e);setTimeout(()=>{const ui=$('worldUI');if(ui?.classList.contains('map-view')&&!ui.classList.contains('dock-open'))$('panelToggle')?.click()},350)};f.__r4=true;nav.onclick=f}

/* ---------- Wiring ---------- */
// R4e: some Hafrik course titles arrive with literal UTF-8 escapes (\xe2\x80\x94). Decode them on screen only; the data is untouched.
const ESC=/(?:\\x[0-9a-f]{2})+/gi;function unesc(){document.querySelectorAll('dialog[open]').forEach(d=>{if(!/\\x[0-9a-f]{2}/i.test(d.textContent))return;const w=document.createTreeWalker(d,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))if(ESC.test(n.nodeValue)){ESC.lastIndex=0;n.nodeValue=n.nodeValue.replace(ESC,m=>{try{return new TextDecoder().decode(new Uint8Array(m.split('\\x').slice(1).map(h=>parseInt(h,16))))}catch{return m}})}ESC.lastIndex=0})}
function tick(){unesc();empties();tip();titles();sheetify();wireMap()}
function boot(){if(!G()?.state){setTimeout(boot,300);return}tick();
 new MutationObserver(()=>soon(tick)).observe(document.body,{subtree:false,childList:true,attributes:true,attributeFilter:['class'],attributeOldValue:false});
 ['worldUI','activityContent','socialBody','phoneContent','worldVenueTitle'].map($).filter(Boolean).forEach(n=>new MutationObserver(()=>soon(tick)).observe(n,{childList:true,subtree:n.id!=='worldUI',...(n.id==='worldUI'?{attributes:true,attributeFilter:['class']}:{})}));
 document.querySelectorAll('dialog').forEach(d=>new MutationObserver(()=>soon(tick)).observe(d,{attributes:true,attributeFilter:['open']}))}
window.ChinaLifeTips={reset(){localStorage.removeItem(KEY);lastTip=0},get seen(){return seen()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
