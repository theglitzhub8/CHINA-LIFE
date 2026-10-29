// Home moments (docs/HOME-PLAN.md). Phase 3 (shower and toilet) is further down. Phase 2: sleep where night falls. Going to bed (Sleep, or a nap) lays you in bed, the
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

// Phase 3: shower and toilet (both the 'wash' activity at the bathroom). Never the body: you go out of sight while a
// frosted veil with running water and steam (shower) or a closed door and "15 minutes later…" (toilet) covers the room.
// world.js shows the body again when the activity ends.
let ac=null;
function water(ms,flush){try{const vol=window.ChinaLifeAudio?.volume??1;if(!vol)return;ac=ac||new (window.AudioContext||window.webkitAudioContext)();
 const n=ac.sampleRate*ms/1000,buf=ac.createBuffer(1,n,ac.sampleRate),ch=buf.getChannelData(0);for(let i=0;i<n;i++)ch[i]=Math.random()*2-1;
 const src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain(),t=ac.currentTime,s=ms/1000;src.buffer=buf;f.type=flush?'lowpass':'bandpass';
 f.frequency.setValueAtTime(flush?2400:1800,t);if(flush)f.frequency.exponentialRampToValueAtTime(260,t+s);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime((flush?.16:.07)*vol,t+.25);g.gain.setValueAtTime((flush?.16:.07)*vol,t+s-.5);g.gain.linearRampToValueAtTime(0,t+s);
 src.connect(f).connect(g).connect(ac.destination);src.start()}catch{}}
function veil(cls,html){const host=document.getElementById('worldViewport')||document.body,el=document.createElement('div');el.className='hm-wash '+cls;el.innerHTML=html;host.append(el);requestAnimationFrame(()=>el.classList.add('on'));return el}
function hide(){const me=W()?.body;if(me)me.visible=false}
let wash=null;
function showerStart(ms){hide();water(ms-600);
 const el=veil('hm-shower','<div class="hm-frost"></div>'+Array.from({length:34},(_,i)=>'<i class="hm-drop" style="left:'+(2+Math.random()*96)+'%;animation-delay:'+(Math.random()*.9).toFixed(2)+'s;animation-duration:'+(.55+Math.random()*.4).toFixed(2)+'s"></i>').join('')+
  Array.from({length:7},(_,i)=>'<span class="hm-steam" style="left:'+(8+i*13)+'%;animation-delay:'+(i*.45).toFixed(2)+'s"></span>').join('')+'<div class="hm-note">🚿 Showering…</div><div class="hm-hum"></div>');
 // The speech bubble hangs off the (hidden) body, so the humming floats up from behind the glass instead.
 const hum=el.querySelector('.hm-hum'),sing=s=>{hum.textContent=s;hum.classList.remove('up');void hum.offsetWidth;hum.classList.add('up')};
 const t1=setTimeout(()=>sing('🎶 La la la…'),1200),t2=setTimeout(()=>sing('🎶 Hmm hmm hmmm~'),Math.max(2500,ms-3400));
 return {el,stop(){clearTimeout(t1);clearTimeout(t2);fresh(el,'✨ So fresh!','🧼 Hygiene 100%')}}}
function toiletStart(ms){hide();
 const el=veil('hm-loo','<div class="hm-door">🚪</div><div class="hm-note">🚽 15 minutes later…</div><div class="hm-flush">🌀 Flush!</div>');
 const t=setTimeout(()=>{el.classList.add('flushed');water(1500,true)},Math.max(1500,ms-1900));
 return {el,stop(){clearTimeout(t);fresh(el,'😮‍💨 Much better','🚽 Bladder 100%')}}}
// Out of the bathroom: the veil fades, a burst of sparkles and a chip with the need you just filled.
function fresh(el,line,chip){el.classList.add('done');el.querySelector('.hm-note').textContent=chip;setTimeout(()=>{el.classList.remove('on');setTimeout(()=>el.remove(),800)},700);
 setTimeout(()=>W()?.say?.('me',line),500)}
window.addEventListener('chinalife:perform',e=>{const d=e.detail||{},g=G();if(d.kind!=='wash'||!g?.isResidence?.(d.place))return;
 const loo=/toilet/i.test(d.label||'');if(d.state==='start'){if(reduced())return;d.duration=loo?5:7;wash=(loo?toiletStart:showerStart)(d.duration*1000)}
 else{const w=wash;wash=null;w?.stop()}});
window.ChinaLifeHomeMoments={nightFall,wake,stretch,showerStart,toiletStart};
const css=document.createElement('style');css.textContent=
 '.hm-night{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;transition:opacity 1.2s ease}.hm-night.on{opacity:1}'+
 '.hm-sky{position:absolute;inset:0;background:radial-gradient(ellipse at 70% 15%,rgb(40 60 120 / .35),transparent 55%),linear-gradient(180deg,rgb(8 12 40 / .82),rgb(14 18 52 / .7));transition:background 1.2s ease}'+
 '.hm-night.dawn .hm-sky{background:linear-gradient(180deg,rgb(255 176 102 / .55),rgb(255 222 170 / .35))}'+
 '.hm-moon{position:absolute;left:10%;top:23%;font-size:46px;filter:drop-shadow(0 0 18px rgb(255 240 190 / .8));transition:opacity .8s}.hm-night.dawn .hm-moon,.hm-night.dawn .hm-star,.hm-night.dawn .hm-zzz{opacity:0}'+
 '.hm-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;animation:hmTwinkle 1.6s ease-in-out infinite;transition:opacity .8s}@keyframes hmTwinkle{50%{opacity:.25;transform:scale(.6)}}'+
 '.hm-clock{position:absolute;left:50%;top:13%;transform:translateX(-50%);display:grid;justify-items:center;color:#fff;text-shadow:0 2px 12px rgb(0 0 0 / .5)}.hm-clock b{font:800 46px/1 system-ui,sans-serif;letter-spacing:1px}.hm-clock small{font:700 14px system-ui,sans-serif;opacity:.85;margin-top:6px}'+
 '.hm-zzz{position:absolute;left:52%;top:46%;color:#cfe0ff;font:800 26px system-ui,sans-serif}.hm-zzz span{position:absolute;opacity:0;animation:hmZ 2.4s ease-out infinite}.hm-zzz span:nth-child(2){animation-delay:.8s;font-size:.8em}.hm-zzz span:nth-child(3){animation-delay:1.6s;font-size:.65em}'+
 '@keyframes hmZ{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(40px,-70px)}}'+
 '.hm-wash{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;transition:opacity .9s ease;overflow:hidden}.hm-wash.on{opacity:1}'+
 '.hm-frost{position:absolute;inset:0;background:linear-gradient(180deg,rgb(200 230 255 / .55),rgb(225 242 255 / .7));backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}'+
 '.hm-drop{position:absolute;top:-12%;width:2px;height:46px;border-radius:2px;background:linear-gradient(rgb(255 255 255 / 0),rgb(120 180 230 / .85));animation:hmDrop .8s linear infinite}@keyframes hmDrop{to{transform:translateY(120vh)}}'+
 '.hm-steam{position:absolute;bottom:-60px;width:120px;height:120px;border-radius:50%;background:radial-gradient(rgb(255 255 255 / .95),transparent 70%);animation:hmSteam 3.2s ease-out infinite;opacity:0}@keyframes hmSteam{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:.9}100%{opacity:0;transform:translateY(-55vh) scale(1.8)}}'+
 '.hm-note{position:absolute;left:50%;top:16%;transform:translateX(-50%);padding:10px 18px;border-radius:999px;background:rgb(255 255 255 / .85);color:#16324a;font:800 17px system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 20px rgb(0 0 0 / .15);transition:transform .4s}'+
 '.hm-hum{position:absolute;left:50%;top:40%;transform:translateX(-50%);padding:8px 14px;border-radius:16px;background:#fff;color:#16324a;font:800 16px system-ui,sans-serif;white-space:nowrap;opacity:0;box-shadow:0 4px 14px rgb(0 0 0 / .12)}.hm-hum.up{animation:hmHum 2.6s ease-out both}@keyframes hmHum{0%{opacity:0;transform:translate(-50%,16px)}15%,75%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-26px)}}.hm-wash.done .hm-hum{display:none}'+
 '.hm-wash.done .hm-note{transform:translateX(-50%) scale(1.12);background:#e9fff1;color:#11683a}.hm-wash.done .hm-drop,.hm-wash.done .hm-steam{opacity:0;animation-play-state:paused}'+
 '.hm-wash.done:after{content:"✨  ✨  ✨";position:absolute;left:50%;top:44%;transform:translateX(-50%);font-size:34px;letter-spacing:8px;animation:hmSpark .9s ease-out both}@keyframes hmSpark{from{opacity:0;transform:translateX(-50%) scale(.4)}60%{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(-40px) scale(1.3)}}'+
 '.hm-loo{background:rgb(12 16 26 / .9)}.hm-loo.done{background:rgb(12 16 26 / .4);transition:opacity .9s ease,background .6s}.hm-door{position:absolute;left:50%;top:38%;transform:translateX(-50%);font-size:84px;filter:drop-shadow(0 6px 18px rgb(0 0 0 / .5))}'+
 '.hm-flush{position:absolute;left:50%;top:56%;transform:translateX(-50%) scale(.6);color:#bfe3ff;font:900 30px system-ui,sans-serif;opacity:0;transition:opacity .3s,transform .5s}.hm-loo.flushed .hm-flush{opacity:1;transform:translateX(-50%) scale(1) rotate(-4deg)}.hm-loo.done .hm-flush{opacity:0}';
document.head?.append(css);
})();
