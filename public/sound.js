// ChinaLife sound and effects: every sound is synthesised with Web Audio (no downloads, works offline).
// UI taps, panel whooshes, purchases, coins, rank-ups, notifications and messages, footsteps while walking,
// an engine hum while driving, and outdoor ambience (city traffic and birds by day, crickets at night, rain or
// wind with the weather). The volume and on/off live in Settings and are remembered on this device.
(()=>{
 const KEY='chinalife-sfx',saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}})();
 let volume=Number.isFinite(saved.volume)?saved.volume:.6,enabled=saved.enabled!==false,ctx=null,master=null,ambience=null,engine=null,lastStep=0,lastTap=0;
 const store=()=>{try{localStorage.setItem(KEY,JSON.stringify({volume,enabled}))}catch{}};
 function start(){if(ctx||!window.AudioContext&&!window.webkitAudioContext)return;ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=enabled?volume:0;master.connect(ctx.destination)}
 // Browsers only allow audio after a user gesture; the first tap unlocks it.
 const unlock=()=>{start();if(ctx?.state==='suspended')ctx.resume()};['pointerdown','keydown','touchstart'].forEach(e=>window.addEventListener(e,unlock,{passive:true}));
 function tone(freq,dur,{type='sine',gain=.25,at=0,glide=0,attack=.005}={}){if(!ctx||!enabled)return;const t=ctx.currentTime+at,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(glide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+glide),t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05)}
 let noiseBuf=null;const noise=()=>{if(!noiseBuf){noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}return noiseBuf};
 function hiss(dur,{freq=1200,q=.8,gain=.2,at=0,type='bandpass',sweep=0}={}){if(!ctx||!enabled)return;const t=ctx.currentTime+at,src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=noise();f.type=type;f.frequency.setValueAtTime(freq,t);if(sweep)f.frequency.exponentialRampToValueAtTime(Math.max(60,freq+sweep),t+dur);f.Q.value=q;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(f);f.connect(g);g.connect(master);src.start(t);src.stop(t+dur+.05)}
 const SOUNDS={
  tap:()=>{tone(1800,.035,{type:'triangle',gain:.07});hiss(.025,{freq:4000,gain:.03})},
  open:()=>{hiss(.22,{freq:600,sweep:2200,gain:.06,q:.6});tone(520,.12,{gain:.05,glide:220})},
  close:()=>{hiss(.18,{freq:2400,sweep:-1900,gain:.05,q:.6})},
  pop:()=>{tone(880,.09,{type:'triangle',gain:.12,glide:300})},
  notify:()=>{tone(1046,.18,{gain:.12});tone(1568,.32,{gain:.1,at:.12})},
  message:()=>{tone(740,.08,{type:'triangle',gain:.12});tone(1175,.16,{type:'triangle',gain:.11,at:.08})},
  coin:()=>{tone(1318,.08,{type:'square',gain:.06});tone(1976,.22,{type:'square',gain:.06,at:.07})},
  spend:()=>{tone(420,.07,{type:'triangle',gain:.06,glide:-120})},
  purchase:()=>{hiss(.05,{freq:5000,gain:.08});tone(1568,.1,{type:'triangle',gain:.12,at:.03});tone(2093,.35,{type:'triangle',gain:.12,at:.12});tone(2637,.4,{gain:.06,at:.2})},
  levelup:()=>{[523,659,784,1046].forEach((f,i)=>tone(f,.28,{type:'triangle',gain:.12,at:i*.09}));tone(1568,.6,{gain:.08,at:.38})},
  success:()=>{[659,784,988].forEach((f,i)=>tone(f,.3,{type:'sine',gain:.08,at:i*.06}))},
  error:()=>{tone(180,.18,{type:'sawtooth',gain:.06});tone(150,.22,{type:'sawtooth',gain:.06,at:.1})},
  door:()=>{hiss(.12,{freq:300,gain:.12,type:'lowpass'});tone(140,.18,{gain:.12,at:.02});tone(760,.25,{type:'triangle',gain:.05,at:.12})},
  step:()=>{hiss(.07,{freq:260+Math.random()*120,gain:.06,type:'lowpass'})},
  whoosh:()=>{hiss(.5,{freq:300,sweep:1800,gain:.08,q:.4})}};
 function play(name){if(!ctx){start();if(!ctx)return}if(ctx.state==='suspended')ctx.resume();SOUNDS[name]?.()}
 // ---- Continuous layers: outdoor ambience and the engine while driving. ----
 function loopNoise(filterType,freq,gain,q=.7){const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=noise();src.loop=true;f.type=filterType;f.frequency.value=freq;f.Q.value=q;g.gain.value=0;src.connect(f);f.connect(g);g.connect(master);src.start();return {src,g,f,target:gain}}
 function fade(layer,to,t=1.2){if(layer)layer.g.gain.setTargetAtTime(to,ctx.currentTime,t/3)}
 function ambient(){if(!ctx||!enabled)return;const W=window.ChinaLifeWorld,game=window.ChinaLife,outside=!!W?.outdoors,state=game?.state||{},hour=Math.floor(W?.skyHour?W.skyHour():(state.hour||0)/60)%24,night=hour<6||hour>=20,wx=W?.weatherFor?.(state.city||'Shenyang',state.day||1)||'clear';
  if(!ambience)ambience={city:loopNoise('lowpass',380,.05),rain:loopNoise('bandpass',2400,.07,.5),wind:loopNoise('bandpass',500,.05,.4)};
  const hidden=document.hidden||document.querySelector('dialog[open]:not(#activityDialog)');
  fade(ambience.city,outside&&!hidden?(night?.025:.05):0);fade(ambience.rain,outside&&!hidden&&wx==='rain'?.08:0);fade(ambience.wind,outside&&!hidden&&wx==='snow'?.06:0);
  // Birds by day and crickets at night, now and then, when outside.
  if(outside&&!hidden&&Math.random()<.25){if(night){for(let i=0;i<3;i++)tone(4200+Math.random()*300,.05,{type:'sine',gain:.012,at:i*.09})}else if(wx==='clear'){const f=2600+Math.random()*900;tone(f,.08,{gain:.02,glide:500});tone(f+300,.1,{gain:.016,at:.12,glide:-400})}}
  // Engine hum during car, taxi and bus rides.
  const mode=W?.travelMode;const driving=mode&&!['walk','metro','bike','flight'].includes(mode);if(driving&&!engine){engine={o:ctx.createOscillator(),g:ctx.createGain()};engine.o.type='sawtooth';engine.o.frequency.value=58;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=260;engine.o.connect(f);f.connect(engine.g);engine.g.connect(master);engine.g.gain.value=0;engine.o.start();engine.g.gain.setTargetAtTime(.07,ctx.currentTime,.3)}else if(!driving&&engine){const e=engine;engine=null;e.g.gain.setTargetAtTime(0,ctx.currentTime,.2);setTimeout(()=>e.o.stop(),900)}
  if(engine)engine.o.frequency.setTargetAtTime(58+Math.random()*14,ctx.currentTime,.4)}
 // ---- Game hooks: watch money, rank and place, footsteps, panels, toasts and notifications. ----
 let lastMoney=null,lastRank=null,lastPlace=null;
 function watch(){const game=window.ChinaLife,s=game?.state;if(!s?.created)return;const rank=game.rankInfo?.().name;
  if(lastMoney!=null&&Math.round(s.money)!==lastMoney){play(s.money>lastMoney?'coin':'spend')}lastMoney=Math.round(s.money);
  if(lastRank!=null&&rank&&rank!==lastRank)play('levelup');lastRank=rank;
  if(lastPlace!=null&&s.place!==lastPlace)play('door');lastPlace=s.place}
 setInterval(()=>{try{watch();ambient();const W=window.ChinaLifeWorld;if(W?.walking&&performance.now()-lastStep>340){lastStep=performance.now();play('step')}}catch{}},170);
 setInterval(()=>{try{if(!document.hidden)ambient()}catch{}},2500);
 // Soft taps on buttons, a whoosh when panels open and close.
 document.addEventListener('click',e=>{if(e.target.closest('button,a,[data-social],[data-phone]')&&performance.now()-lastTap>60){lastTap=performance.now();play('tap')}},true);
 const watched=new WeakSet();const observe=()=>document.querySelectorAll('dialog').forEach(d=>{if(watched.has(d))return;watched.add(d);new MutationObserver(()=>play(d.open?'open':'close')).observe(d,{attributes:true,attributeFilter:['open']})});observe();setInterval(observe,3000);
 const toast=document.getElementById('toast');if(toast)new MutationObserver(()=>{if(toast.matches(':popover-open')||toast.classList.contains('show'))play('pop')}).observe(toast,{attributes:true,childList:true,characterData:true,subtree:true});
 new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.id==='gameNotification'||n.id==='messageNotification'){play(n.id==='messageNotification'?'message':'notify')}}).observe(document.body,{childList:true});
 // Notification banners are reused after they first appear; listen to their text changing too.
 const banners=new WeakSet();setInterval(()=>{for(const id of ['gameNotification','messageNotification']){const el=document.getElementById(id);if(el&&!banners.has(el)){banners.add(el);new MutationObserver(()=>{if(!el.hidden)play(id==='messageNotification'?'message':'notify')}).observe(el,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden','class']})}}},1000);
 window.addEventListener('chinalife:messages',()=>play('message'));
 window.ChinaLifeSound={play,get volume(){return volume},get enabled(){return enabled},setVolume(v){volume=Math.max(0,Math.min(1,Number(v)||0));if(master)master.gain.value=enabled?volume:0;store()},setEnabled(on){enabled=!!on;if(master)master.gain.value=enabled?volume:0;store();if(enabled)play('success')}};
})();
