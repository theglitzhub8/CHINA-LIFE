// R3 · first-time onboarding, the single "Next step" pill and a room sheet that follows the finger.
// Client-only: no network calls, no timers that hit the server, no coins (rewards stay server-side).
(()=>{
const $=id=>document.getElementById(id),G=()=>window.ChinaLife,I=n=>window.ChinaLifeIcon?.(n)||'';
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let raf=0;const soon=f=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;f()})};

/* ---------- Next step: one pill instead of the chip stack ---------- */
const NEEDS=[['hunger','Hungry? The café is close','cafe','food'],['energy','Tired? Head home to rest','home','home'],['hygiene','Time for a shower at home','home','home'],['fun','Bored? 007 Club is open','night','party'],['social','Lonely? Say hi at the café','cafe','chat']];
function nextStep(){const st=G()?.state;if(!st?.created)return null;const vis=id=>{const e=$(id);return e&&!e.hidden&&e.offsetParent!==null?e:null};
 if(onboardStep())return null; // the coach card speaks during onboarding
 if($('worldRankBadge')&&!$('worldRankBadge').hidden)return {icon:'gift',text:'Daily reward ready',go:()=>$('worldRank').click()};
 const low=NEEDS.find(([k])=>Number(st.needs?.[k]??100)<30);if(low&&st.place!==low[2])return {icon:low[3],text:low[1],go:()=>G().walkIn(low[2])};
 const today=vis('worldToday');if(today&&!/nothing due/i.test($('worldTodayText')?.textContent||''))return {icon:'clock',text:$('worldTodayText').textContent,go:()=>today.click()};
 const drunk=vis('worldDrunk');if(drunk&&!/sober/i.test($('worldDrunkText')?.textContent||''))return {icon:'drinks',text:'Drinks · '+$('worldDrunkText').textContent,go:()=>drunk.click()};
 const ev=vis('worldEvent');if(ev)return {icon:'party',text:($('worldEventTitle')?.textContent||'City event')+' · '+($('worldEventText')?.textContent||''),go:()=>ev.click()};
 const tr=vis('worldTreasure');if(tr)return {icon:'gift',text:$('worldTreasureText')?.textContent||'Red envelope hunt',go:()=>tr.click()};
 const goal=$('worldGoalTitle')?.textContent;return {icon:'nav',text:goal||'Explore your city',go:()=>$('worldGoal')?.click()}}
function pill(){const side=document.querySelector('#worldUI .world-side');if(!side)return;let p=$('r3Next');
 if(!p){p=document.createElement('button');p.id='r3Next';p.type='button';p.className='next-step';p.dataset.ioSkip='1';side.prepend(p);p.onclick=e=>{e.stopPropagation();p._go?.()}}
 const n=nextStep();p.hidden=!n;if(!n)return;const html=I(n.icon)+'<span>'+n.text.replace(/[<>&]/g,'')+'</span>'+I('fwd','sm chev');if(p._html!==html){p.innerHTML=html;p._html=html}p._go=n.go;p.setAttribute('aria-label','Next step: '+n.text)}

/* ---------- Onboarding: one coach card at a time, skippable, saved in state.onboard ---------- */
const STEPS=[
 {id:'walk',title:'Walk around',text:'Drag the joystick to move.',spot:'.tp-stick'},
 {id:'map',title:'Open the map',text:'Tap Map to see your city.',spot:'#navMap'},
 {id:'cafe',title:'Go to the café',text:'Tap the café, then go in. The first ride is free.',spot:null,go:()=>G().walkIn('cafe')},
 {id:'order',title:'Order a drink',text:'Pick something from the sheet to refill your needs.',spot:'#worldActivities'},
 {id:'hi',title:'Say hi',text:'Tap “Say something” to chat with people here.',spot:'#venueSay'},
 {id:'phone',title:'Your phone',text:'Open Phone and claim your welcome reward.',spot:'#navPhone'}];
const LS='chinalife-onboard';
function onboardState(){const st=G()?.state;if(!st?.created)return 'wait';if(st.onboard)return st.onboard;const ls=localStorage.getItem(LS);if(ls)return ls;
 // Only brand-new players get the tour: day 1, almost no XP, nothing visited yet.
 const fresh=(st.day||1)<=1&&Number(st.xp||0)<60&&(st.visited||[]).length<=2;return fresh?'0':'skip'}
function setOnboard(v){const st=G()?.state;if(st)st.onboard=v;localStorage.setItem(LS,v)}
function onboardStep(){const s=onboardState();if(!/^\d+$/.test(s))return null;return STEPS[+s]||null}
let card=null,spotEl=null;
function coach(){const step=onboardStep();if(!step){card?.remove();card=null;spot(null);return}
 if(!card){card=document.createElement('section');card.id='coachCard';card.className='coach-card';card.setAttribute('role','status');document.getElementById('worldUI')?.appendChild(card)}
 const i=STEPS.indexOf(step),html='<div class="coach-dots">'+STEPS.map((_,k)=>'<i'+(k<i?' class="done"':k===i?' class="now"':'')+'></i>').join('')+'</div><b>'+step.title+'</b><p>'+step.text+'</p><div class="coach-actions"><button type="button" data-coach="skip">Skip tour</button>'+(step.go?'<button type="button" class="primary" data-coach="go">Take me there</button>':'')+'</div>';
 if(card._html!==html){card.innerHTML=html;card._html=html;card.querySelector('[data-coach=skip]').onclick=()=>{setOnboard('skip');coach()};const g=card.querySelector('[data-coach=go]');if(g)g.onclick=()=>{step.go();}}
 spot(step.spot?document.querySelector(step.spot):null)}
function spot(el){if(spotEl===el)return;spotEl?.classList.remove('coach-spot');spotEl=el;el?.classList.add('coach-spot')}
function advance(id){const step=onboardStep();if(!step||step.id!==id)return;const i=STEPS.indexOf(step);setOnboard(i+1>=STEPS.length?'done':String(i+1));if(i+1>=STEPS.length)window.ChinaLifeToast?.('You’re all set. Enjoy your life in China.');coach();soon(pill)}
// Step completion, from what the player actually does.
document.addEventListener('pointerdown',e=>{const t=e.target;if(t.closest?.('.tp-stick'))setTimeout(()=>advance('walk'),900);if(t.closest?.('#navMap'))setTimeout(()=>advance('map'),300);if(t.closest?.('#worldActivities button'))setTimeout(()=>advance('order'),300);if(t.closest?.('#venueSay,#venueChatButton'))setTimeout(()=>advance('hi'),300);if(t.closest?.('#navPhone'))setTimeout(()=>advance('phone'),300)},{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(/^(Arrow|w$|a$|s$|d$)/i.test(e.key))advance('walk')});
function placeWatch(){const st=G()?.state;if(st?.place==='cafe')advance('cafe')}

/* ---------- Room sheet follows the finger, then snaps to peek / half / near-full ---------- */
function drag(){const ui=$('worldUI'),c=$('infoPanel');if(!ui||!c||c.dataset.r3)return;c.dataset.r3='1';window.ChinaLifeSheetDrag=true;
 let y0=null,h0=0,moved=false,tabH=0;const vh=()=>innerHeight;
 const set=h=>{c.style.setProperty('height',h+'px','important');c.style.setProperty('max-height',h+'px','important')};
 c.addEventListener('touchstart',e=>{const t=e.touches[0];const inScroll=c.scrollTop>0&&!e.target.closest('.venue-heading,.venue-card::before');if(inScroll||e.target.closest('input,textarea,#worldActivities'))return;y0=t.clientY;h0=c.getBoundingClientRect().height;moved=false;tabH=document.querySelector('#worldUI .world-nav')?.getBoundingClientRect().height||60},{passive:true});
 c.addEventListener('touchmove',e=>{if(y0==null)return;const dy=e.touches[0].clientY-y0;if(!moved&&Math.abs(dy)<6)return;moved=true;ui.classList.add('sheet-dragging');set(Math.max(72,Math.min(vh()*.92-tabH,h0-dy)))},{passive:true});
 c.addEventListener('touchend',e=>{if(y0==null)return;const dy=e.changedTouches[0].clientY-y0;y0=null;if(!moved)return;const h=Math.max(72,Math.min(vh()*.92-tabH,h0-dy));
  const stops=[['peek',96],['half',vh()*.5-24],['full',vh()*.92-tabH]];const v=Math.abs(dy)>120?(dy<0?1:-1):0;let k=stops.reduce((b,s,i)=>Math.abs(s[1]-h)<Math.abs(stops[b][1]-h)?i:b,0);
  setTimeout(()=>{ui.classList.remove('sheet-dragging');c.style.removeProperty('height');c.style.removeProperty('max-height');const n=stops[k][0];ui.classList.toggle('dock-open',n!=='peek');ui.classList.toggle('dock-full',n==='full');haptic()},0)},{passive:true});
 // Mouse and pen: the same drag on the grabber row.
 c.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||!e.target.closest('.venue-heading'))return;if(e.target.closest('button'))return;const y=e.clientY,h=c.getBoundingClientRect().height;tabH=document.querySelector('#worldUI .world-nav')?.getBoundingClientRect().height||60;let m=false;
  const mv=ev=>{const dy=ev.clientY-y;if(Math.abs(dy)>6)m=true;if(m){ui.classList.add('sheet-dragging');set(Math.max(72,Math.min(vh()*.92-tabH,h-dy)))}};
  const up=ev=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);if(!m)return;const hh=Math.max(72,Math.min(vh()*.92-tabH,h-(ev.clientY-y)));const stops=[['peek',96],['half',vh()*.5-24],['full',vh()*.92-tabH]];const k=stops.reduce((b,s,i)=>Math.abs(s[1]-hh)<Math.abs(stops[b][1]-hh)?i:b,0);ui.classList.remove('sheet-dragging');c.style.removeProperty('height');c.style.removeProperty('max-height');ui.classList.toggle('dock-open',stops[k][0]!=='peek');ui.classList.toggle('dock-full',stops[k][0]==='full')};
  addEventListener('pointermove',mv);addEventListener('pointerup',up)})}
function haptic(){if(!reduce.matches&&navigator.vibrate)try{navigator.vibrate(8)}catch{}}

/* ---------- Wiring: react to DOM changes the game already makes ---------- */
function tick(){pill();coach();placeWatch();drag()}
function boot(){if(!G()?.state){setTimeout(boot,300);return}tick();
 const side=document.querySelector('#worldUI .world-side'),title=$('worldVenueTitle'),needs=$('worldNeeds');
 const mo=new MutationObserver(ms=>{if(ms.every(m=>m.target.id==='r3Next'||m.target.closest?.('#r3Next')))return;soon(tick)});
 [side,title,needs].filter(Boolean).forEach(n=>mo.observe(n,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']}));
 new MutationObserver(()=>soon(tick)).observe($('worldUI'),{attributes:true,attributeFilter:['class']});
 addEventListener('chinalife:cloudready',()=>soon(tick))}
window.ChinaLifeOnboarding={reset(){localStorage.removeItem(LS);const st=G()?.state;if(st)delete st.onboard;coach()},get step(){return onboardStep()?.id||onboardState()},advance};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
