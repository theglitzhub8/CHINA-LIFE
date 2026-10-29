// Home moments (docs/HOME-PLAN.md). Phase 2: sleep where night falls. Going to bed (Sleep, or a nap) lays you in bed, the
// room goes dark with the moon and stars, "Zzz" drifts up and a big counter runs through the hours of sleep (the game
// clock itself stays on Beijing time, so it does not jump); then the
// light turns warm, you stretch and say "Good morning ☀️". The game's own sleep (game.js homeRest / the nap activity:
// time, energy, rent) is unchanged; this only adds what you see. Runs off world.js 'chinalife:perform' (kind 'sleep').
(()=>{const G=()=>window.ChinaLife,W=()=>window.ChinaLifeWorld;
const reduced=()=>!!G()?.state?.reduceMotion||!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pad=n=>String(n).padStart(2,'0'),slept=m=>Math.floor(m/60)+'h '+pad(Math.floor(m%60))+'m';
let night=null;

// The stretch on waking: both arms up, eased in and out (bones turned after the animation, before the frame is drawn).
const STRETCH=[['Bip01_R_UpperArm','y',2.4],['Bip01_L_UpperArm','y',-2.4]];
let stretchUntil=0,stretchFrom=0,offFrame=null;const bones=new Map();
function boneOf(body,n){if(!bones.has(body))bones.set(body,{});const c=bones.get(body);if(!(n in c)){let f=null;body.traverse(o=>{if(!f&&o.name===n)f=o});c[n]=f}return c[n]}
function stretchFrame(){const now=performance.now(),me=W()?.body;if(!me?.userData?.real||now>stretchUntil+300){offFrame?.();offFrame=null;return}
 const w=Math.min(1,(now-stretchFrom)/300,(stretchUntil+300-now)/300);
 // three.js types come from the bone itself (this file has no THREE import).
 for(const [bn,ax,a] of STRETCH){const b=boneOf(me,bn);if(!b)continue;const axis=b.position.clone().set(ax==='x'?1:0,ax==='y'?1:0,ax==='z'?1:0);b.quaternion.multiply(b.quaternion.clone().setFromAxisAngle(axis,a*w))}}
function stretch(ms){if(reduced()||!W()?.onFrame)return;stretchFrom=performance.now();stretchUntil=stretchFrom+ms;if(!offFrame)offFrame=W().onFrame(stretchFrame)}

// The night over the room: a dark blue veil with the moon, stars and drifting Zzz, and a counter running through the hours slept.
function nightFall(minutes,ms,nap){const host=document.getElementById('worldViewport')||document.body,el=document.createElement('div');el.className='hm-night'+(nap?' nap':'');
 el.innerHTML='<div class="hm-sky"></div><span class="hm-moon">🌙</span>'+Array.from({length:18},(_,i)=>'<i class="hm-star" style="left:'+(5+Math.random()*90)+'%;top:'+(4+Math.random()*40)+'%;animation-delay:'+(i*.17).toFixed(2)+'s"></i>').join('')+
  '<div class="hm-clock"><b>0h 00m</b><small>'+(nap?'of a nap':'of sleep')+'</small></div><div class="hm-zzz"><span>Z</span><span>z</span><span>z</span></div>';
 host.append(el);requestAnimationFrame(()=>el.classList.add('on'));
 const span=minutes,t0=performance.now(),run=Math.max(1200,ms-1800),b=el.querySelector('.hm-clock b');
 const tick=()=>{if(!el.isConnected)return;const k=Math.min(1,(performance.now()-t0)/run);b.textContent=slept(span*k);if(k<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);
 W()?.say?.('me','💤 Goodnight…');return el}
function wake(el,nap){if(!el)return;el.classList.add('dawn');el.querySelector('.hm-clock small').textContent=nap?'Feeling better':'Good morning';setTimeout(()=>{el.classList.remove('on');setTimeout(()=>el.remove(),900)},900);
 setTimeout(()=>{W()?.say?.('me',nap?'😌 That nap hit different':'☀️ Good morning!');stretch(1800)},600)}

window.addEventListener('chinalife:perform',e=>{const d=e.detail||{},g=G();if(d.kind!=='sleep'||!g?.isResidence?.(d.place))return;
 const nap=/nap/i.test(d.label||'');if(d.state==='start'){if(reduced())return;d.duration=nap?5.5:8;
  // Eight hours for a proper sleep, three for a nap (the nap activity says 3h).
  night=nightFall(nap?180:480,d.duration*1000,nap)}
 else{const el=night;night=null;wake(el,nap)}});
window.ChinaLifeHomeMoments={nightFall,wake,stretch};
const css=document.createElement('style');css.textContent=
 '.hm-night{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;transition:opacity 1.2s ease}.hm-night.on{opacity:1}'+
 '.hm-sky{position:absolute;inset:0;background:radial-gradient(ellipse at 70% 15%,rgb(40 60 120 / .35),transparent 55%),linear-gradient(180deg,rgb(8 12 40 / .82),rgb(14 18 52 / .7));transition:background 1.2s ease}'+
 '.hm-night.dawn .hm-sky{background:linear-gradient(180deg,rgb(255 176 102 / .55),rgb(255 222 170 / .35))}'+
 '.hm-moon{position:absolute;left:10%;top:23%;font-size:46px;filter:drop-shadow(0 0 18px rgb(255 240 190 / .8));transition:opacity .8s}.hm-night.dawn .hm-moon,.hm-night.dawn .hm-star,.hm-night.dawn .hm-zzz{opacity:0}'+
 '.hm-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;animation:hmTwinkle 1.6s ease-in-out infinite;transition:opacity .8s}@keyframes hmTwinkle{50%{opacity:.25;transform:scale(.6)}}'+
 '.hm-clock{position:absolute;left:50%;top:13%;transform:translateX(-50%);display:grid;justify-items:center;color:#fff;text-shadow:0 2px 12px rgb(0 0 0 / .5)}.hm-clock b{font:800 46px/1 system-ui,sans-serif;letter-spacing:1px}.hm-clock small{font:700 14px system-ui,sans-serif;opacity:.85;margin-top:6px}'+
 '.hm-zzz{position:absolute;left:52%;top:46%;color:#cfe0ff;font:800 26px system-ui,sans-serif}.hm-zzz span{position:absolute;opacity:0;animation:hmZ 2.4s ease-out infinite}.hm-zzz span:nth-child(2){animation-delay:.8s;font-size:.8em}.hm-zzz span:nth-child(3){animation-delay:1.6s;font-size:.65em}'+
 '@keyframes hmZ{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(40px,-70px)}}';
document.head?.append(css);
})();
