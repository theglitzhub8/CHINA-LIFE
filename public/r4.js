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
 else if(/learning hub|courses/i.test(t)&&/\b0%/.test(t)&&!/[1-9]\d?%/.test(t)){panel.querySelector('.activity-panel>p,.activity-panel h2')?.insertAdjacentHTML('afterend','<div class="r4-empty" data-r4-icon="book" data-io="1"><span class="r4-empty-ic">'+I('book')+'</span><p>Lesson 1 takes 2 minutes.</p><div><button class="r4-go" data-r4-start="1">Start</button></div></div>')}}
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

/* ---------- Wiring ---------- */
function tick(){empties();tip();titles()}
function boot(){if(!G()?.state){setTimeout(boot,300);return}tick();
 new MutationObserver(()=>soon(tick)).observe(document.body,{subtree:false,childList:true,attributes:true,attributeFilter:['class'],attributeOldValue:false});
 ['worldUI','activityContent','socialBody','phoneContent','worldVenueTitle'].map($).filter(Boolean).forEach(n=>new MutationObserver(()=>soon(tick)).observe(n,{childList:true,subtree:n.id!=='worldUI',...(n.id==='worldUI'?{attributes:true,attributeFilter:['class']}:{})}));
 document.querySelectorAll('dialog').forEach(d=>new MutationObserver(()=>soon(tick)).observe(d,{attributes:true,attributeFilter:['open']}))}
window.ChinaLifeTips={reset(){localStorage.removeItem(KEY);lastTip=0},get seen(){return seen()}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
