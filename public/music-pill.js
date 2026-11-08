// Energy Phase 2 (docs/ENERGY-PLAN.md, appadmin switch music_everywhere, default ON): music everywhere. One small round
// button sits above the bottom bar on the left, in every place and at home: tap it to play or pause. When a song starts, its name
// slides out beside it for a few seconds with ⏭ (next); tap the name for the full player.
// What plays: ChinaLife Radio (approved artists' songs, radio.js) when there are any; otherwise the game's own beats
// (catalog tracks, played here with a small Web Audio synth, the same patterns as the club in audio.js), one after another.
// In a club the club's own music controls are in charge (club DJ), so the button steps aside there and the beats pause.
// A pause is remembered on this device; otherwise music starts on the first tap (browsers need a tap before sound).
// It goes quiet while your mic is live, while the game is in the background and in the library (university.js).
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife,R=()=>window.ChinaLifeRadio;
const on=()=>window.ChinaLifeFlags?.cast?.('music_everywhere')!==false;
const KEY='chinalife-music-on',store={get(){try{return localStorage.getItem(KEY)}catch{return null}},set(v){try{localStorage.setItem(KEY,v)}catch{}}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inClub=()=>{const g=G();return !!g&&(g.clubs||[]).includes(g.state?.place)};
const songs=()=>R()?.songs?.length>0;
// ---- The game's own beats ----
const beats=()=>G()?.catalog?.tracks||[];
let ctx=null,master=null,beatOn=false,beatIndex=0,step=0,t0=0,beatStart=0,duck=false;const BEAT_SECONDS=150,VOLUME=.32;
function tone(f,type,time,len,amt,glide){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;if(glide){o.frequency.setValueAtTime(f,time);o.frequency.exponentialRampToValueAtTime(f*glide,time+len)}
 g.gain.setValueAtTime(.001,time);g.gain.exponentialRampToValueAtTime(amt,time+.012);g.gain.exponentialRampToValueAtTime(.001,time+len);o.connect(g);g.connect(master);o.start(time);o.stop(time+len+.02)}
const hz=n=>440*2**((n-69)/12);
function schedule(){if(!beatOn||!ctx||ctx.state!=='running')return;const tr=beats()[beatIndex];if(!tr)return;
 if(ctx.currentTime-beatStart>BEAT_SECONDS){nextBeat();return}
 const beat=60/(tr.bpm||110),P=tr.pattern||{};
 while(t0+step*beat/4<ctx.currentTime+.2){const time=t0+step*beat/4;if(time>=ctx.currentTime){const s=step%16,bar=Math.floor(step/16)%4;
  if((P.kick||[0,6,10]).includes(s))tone(48,'sine',time,.18,.55);if((P.snare||[4,12]).includes(s))tone(170,'triangle',time,.06,.18);
  if(P.shaker?true:s%2===0)tone(6200,'square',time,.025,P.shaker&&s%2?.01:.018);if(s%4===0&&tr.bass)tone(hz(tr.bass[bar]),'triangle',time,beat*.7,.2);
  if(P.log?.includes(s)&&tr.bass)tone(hz(tr.bass[bar]+12),'sine',time,beat*.55,.3,.55);if((P.lead||[0,3,6,10,14]).includes(s)&&tr.notes)tone(hz(tr.notes[(s+bar)%4]),P.leadWave||(tr.id==='neon'?'sawtooth':'sine'),time,beat*.45,.08)}step++}}
setInterval(schedule,60);
const level=()=>{if(master)master.gain.value=beatOn?VOLUME*(duck?.25:1):0};
async function beatPlay(){const A=window.AudioContext||window.webkitAudioContext;if(!A||!beats().length)return false;
 try{if(!ctx){ctx=new A();master=ctx.createGain();master.connect(ctx.destination)}await ctx.resume()}catch{return false}
 if(!beatOn){beatOn=true;t0=ctx.currentTime+.05;step=0;beatStart=ctx.currentTime}level();show();return true}
function beatPause(){beatOn=false;level();try{ctx?.suspend()}catch{}}
function nextBeat(){const n=beats().length;if(!n)return;beatIndex=(beatIndex+1)%n;if(ctx){t0=ctx.currentTime+.05;step=0;beatStart=ctx.currentTime}show()}
// ---- What is playing, and the controls ----
const playing=()=>!!R()?.playing||beatOn;
function now(){const s=songs()?R().current:null;if(s)return {title:s.title,artist:s.artist};const b=beats()[beatIndex];return b?{title:b.name,artist:'ChinaLife beats'}:{title:'Music',artist:''}}
async function play(){store.set('on');if(songs()){beatPause();await R().play()}else await beatPlay();render()}
// A player's pause is remembered; a pause for a reason (mic, library, background) is not.
function pause(remember=true){if(remember)store.set('off');R()?.pause?.();beatPause();render()}
const toggle=()=>playing()?pause():play();
function next(){if(songs()){R().next();if(!R().playing)R().play()}else{nextBeat();if(!beatOn)beatPlay()}render();show()}
const full=()=>songs()?R().open():showBeats();
// No artist songs yet: a small list of the beats to pick from.
function showBeats(){const g=G();g.showScreen('🎵 Music','The game’s own beats play until artists join the radio. Tap one to play it.',
 '<div class="mp-list">'+beats().map((b,i)=>'<button type="button" data-mp="'+i+'" class="'+(i===beatIndex&&beatOn?'on':'')+'"><b>'+esc(b.name)+'</b><small>'+esc(b.style||'')+'</small></button>').join('')+'</div>'+
 '<p class="mp-note">Are you an artist? <a href="partners.html" target="_blank" rel="noopener">Get your songs on the radio ↗</a></p>');
 $('activityContent').querySelectorAll('[data-mp]').forEach(b=>b.onclick=()=>{beatIndex=Number(b.dataset.mp);if(ctx){t0=ctx.currentTime+.05;step=0;beatStart=ctx.currentTime}store.set('on');R()?.pause?.();beatPlay();$('activityDialog')?.close();render()})}
// ---- The button ----
const PLAY='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',PAUSE='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
let afterClub=false,pill=null,label=null,hideAt=0,lastKey='';
function build(){pill=document.createElement('div');pill.id='musicPill';pill.className='music-pill';
 pill.innerHTML='<button type="button" class="mp-btn" aria-label="Play music"><span class="mp-play">'+PLAY+'</span></button>'+
  '<div class="mp-label" hidden><button type="button" class="mp-name"><b></b><small></small></button><button type="button" class="mp-next" aria-label="Next song">⏭</button></div>';
 label=pill.querySelector('.mp-label');pill.querySelector('.mp-btn').onclick=e=>{e.stopPropagation();toggle();show()};
 pill.querySelector('.mp-name').onclick=e=>{e.stopPropagation();full()};pill.querySelector('.mp-next').onclick=e=>{e.stopPropagation();next()};
 ($('worldUI')||document.body).append(pill)}
// The name slides out for a few seconds (on a new song, or a tap).
function show(){hideAt=Date.now()+4500;render()}
// Above whatever sits at the bottom: a dock, the place bar, or the Home / Map / People / Phone bar.
function place(){const H=window.innerHeight||800,tops=[...document.querySelectorAll('#worldUI .club-dock:not([hidden]),#infoPanel,.world-nav')].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed').map(e=>e.getBoundingClientRect()).filter(r=>r.height>0&&r.width>0).map(r=>r.top);
 const top=tops.length?Math.min(...tops):H-90;pill.style.bottom=Math.max(70,Math.round(H-top+10))+'px'}
function render(){if(!pill)return;const p=playing();pill.classList.toggle('playing',p);
 const b=pill.querySelector('.mp-btn');b.setAttribute('aria-label',p?'Pause music':'Play music');const icon=pill.querySelector('.mp-play'),want=p?'pause':'play';if(icon.dataset.i!==want){icon.dataset.i=want;icon.innerHTML=p?PAUSE:PLAY}
 const n=now();pill.querySelector('.mp-name b').textContent=n.title;pill.querySelector('.mp-name small').textContent=n.artist;label.hidden=Date.now()>hideAt}
function sync(){// Not on the approved city map (CLAUDE.md): the music keeps playing there, and the button is back in any place.
 const g=G(),here=on()&&!!g?.state?.created&&!inClub()&&!$('worldUI')?.classList.contains('map-view');
 document.body.classList.toggle('music-pill-on',here);
 // The club DJ takes over in a club; the beats come back when you leave (unless you paused them).
 if(!here){if(pill)pill.hidden=true;if(inClub()&&beatOn){beatPause();afterClub=true}return}
 if(afterClub){afterClub=false;if(store.get()!=='off'&&!playing())play()}
 if(!pill)build();pill.hidden=false;
 // Artist songs arrived while the beats play: switch to the radio.
 if(beatOn&&songs()){beatPause();R().play()}
 // Background (app hidden or the native app paused): quiet.
 if(beatOn&&(document.hidden||window.ChinaLifeNativePaused))beatPause();
 const k=now().title;if(playing()&&k!==lastKey){lastKey=k;show()}place();render()}
setInterval(sync,1000);window.addEventListener('chinalife:update',sync);window.addEventListener('chinalife:songs',sync);window.addEventListener('chinalife:radio',()=>render());
window.addEventListener('chinalife:voice',e=>{duck=!!e.detail?.active;level()});
// Starts on the first tap anywhere unless the player paused it; not in a club (the DJ plays there).
let started=false;const auto=()=>{if(started||!on()||!G()?.state?.created||inClub())return;started=true;if(store.get()==='off'||playing())return;if(!songs())beatPlay().then(render)};
['pointerdown','keydown'].forEach(e=>document.addEventListener(e,auto,{capture:true}));
window.ChinaLifeMusic={play,pause,toggle,next,sync,showBeats,get playing(){return playing()},get now(){return now()},get beat(){return beatOn?beats()[beatIndex]?.id:null}};
const css=document.createElement('style');css.textContent=
 // Outside clubs the old radio button and club ▶ button step aside: this one button does both (clubs keep theirs).
 'html:root body.music-pill-on #worldUI :is(.radio-fab,#clubMusicToggle,.club-music-fab){display:none!important}'+
 '#worldUI .music-pill{position:absolute;left:calc(16px + env(safe-area-inset-left));bottom:150px;z-index:31;display:flex;align-items:center;gap:8px;pointer-events:auto}#worldUI .music-pill[hidden]{display:none}'+
 '#worldUI .mp-btn{position:relative;width:46px;height:46px;border-radius:50%;border:0;padding:0;display:grid;place-items:center;background:linear-gradient(135deg,#ff7a59,#e0399b);color:#fff;font-size:18px;box-shadow:0 6px 18px rgb(224 57 155 / .4)}'+
 '#worldUI .music-pill.playing .mp-btn{animation:mpGlow 2s ease-in-out infinite}@keyframes mpGlow{50%{box-shadow:0 0 0 6px rgb(255 122 89 / .25),0 6px 18px rgb(224 57 155 / .4)}}'+
 '#worldUI .mp-play{display:grid;place-items:center}'+
 '#worldUI .mp-label{display:flex;align-items:center;gap:2px;max-width:calc(100vw - 150px);padding:4px 4px 4px 12px;border-radius:24px;background:rgb(14 8 30 / .82);color:#fff;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:mpIn .25s ease-out}#worldUI .mp-label[hidden]{display:none}'+
 '@keyframes mpIn{from{opacity:0;transform:translateX(-8px)}}#worldUI .mp-name{display:grid;text-align:left;min-width:0;border:0;background:none;color:inherit;padding:0}#worldUI .mp-name b,#worldUI .mp-name small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#worldUI .mp-name b{font-size:13px}#worldUI .mp-name small{font-size:11px;opacity:.75}'+
 '#worldUI .mp-next{width:36px;height:36px;border-radius:50%;border:0;background:rgb(255 255 255 / .14);color:#fff;font-size:14px;flex:none}'+
 '@media (prefers-reduced-motion:reduce){#worldUI .music-pill.playing .mp-btn{animation:none}}'+
 '.mp-list{display:grid;gap:8px}.mp-list button{display:grid;gap:2px;text-align:left;padding:12px 14px;border-radius:16px;border:1px solid #e3e8ef;background:#fff}.mp-list button.on{border-color:#e0399b;background:#fff1f7}.mp-list small{color:#5d706b}.mp-note{font-size:13px;color:#5d706b}';
document.head?.append(css);
})();
