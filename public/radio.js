// ChinaLife Radio: approved artists' own songs (uploaded on partners.html, approved in admin) play one after another
// in a loop while you play: on the map, in venues and in clubs (where the club's own music steps aside while the radio
// plays). It starts on the first tap unless the player paused it; it goes quiet while your mic is live.
const game=window.ChinaLife,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},set(k,v){try{localStorage.setItem(k,String(v))}catch{}}};
const audio=new Audio();audio.preload='none';
let list=[],index=Math.max(0,Number(store.get('chinalife-radio-index',0))||0),wanted=false,duck=false,volume=(v=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):.6)(Number(store.get('chinalife-radio-volume',.6)));
const songs=()=>(window.ChinaLifeCloud?.songs||[]).filter(s=>s.active!==false&&s.url);
const current=()=>list[index]||null;
const cover=s=>s?.cover&&window.ChinaLifeAuth?.base?window.ChinaLifeAuth.base+'/chinalife/media.php?id='+encodeURIComponent(s.cover):'';
const inClub=()=>(game.clubs||[]).includes(game.state.place);
const time=t=>!Number.isFinite(t)?'0:00':Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
function applyVolume(){audio.volume=volume*(duck?.25:1)}
function load(i){if(!list.length)return;index=((i%list.length)+list.length)%list.length;store.set('chinalife-radio-index',index);const s=current();if(audio.dataset.id!==s.id){audio.src=s.url;audio.dataset.id=s.id}mediaSession();render()}
// The radio tells the club music whether it is playing, so the two never play over each other.
const announce=()=>window.dispatchEvent(new CustomEvent('chinalife:radio',{detail:{playing:!audio.paused&&wanted}}));
async function play(i){if(!list.length)return;if(i!==undefined)load(i);else if(!audio.dataset.id)load(index);wanted=true;store.set('chinalife-radio-on','on');applyVolume();try{await audio.play()}catch{}render();announce()}
function pause(){wanted=false;store.set('chinalife-radio-on','off');audio.pause();render();announce()}
const next=()=>{load(index+1);if(wanted)play()},prev=()=>{if(audio.currentTime>5){audio.currentTime=0;return}load(index-1);if(wanted)play()};
audio.addEventListener('ended',next);
// A broken file never stops the radio: skip it after a moment (but not forever if everything fails).
let failures=0;audio.addEventListener('error',()=>{if(!wanted)return;if(++failures>=Math.max(3,list.length)){pause();failures=0;return game.toast?.('ChinaLife Radio could not load songs right now.')}setTimeout(next,800)});
audio.addEventListener('playing',()=>{failures=0;render()});audio.addEventListener('pause',render);audio.addEventListener('timeupdate',progress);
function mediaSession(){const s=current();if(!s||typeof navigator==='undefined'||!('mediaSession' in navigator))return;try{navigator.mediaSession.metadata=new MediaMetadata({title:s.title,artist:s.artist,album:'ChinaLife Radio',artwork:cover(s)?[{src:cover(s),sizes:'512x512'}]:[]});navigator.mediaSession.setActionHandler('play',()=>play());navigator.mediaSession.setActionHandler('pause',pause);navigator.mediaSession.setActionHandler('nexttrack',next);navigator.mediaSession.setActionHandler('previoustrack',prev)}catch{}}

// ---- Interface: a 🎵 button (with the song while playing) and a sheet with the player and playlist. ----
const fab=document.createElement('button');fab.id='radioFab';fab.className='radio-fab';fab.type='button';fab.setAttribute('aria-label','ChinaLife Radio');fab.hidden=true;fab.innerHTML='<span class="radio-icon">🎵</span><span class="radio-now"></span>';
(document.getElementById('worldUI')||document.body).append(fab);fab.onclick=open;
const sheet=document.createElement('dialog');sheet.id='radioDialog';sheet.className='radio-sheet';document.body.append(sheet);
function render(){const s=current(),on=!audio.paused&&wanted;fab.hidden=!list.length;fab.classList.toggle('playing',on);fab.querySelector('.radio-now').textContent=on&&s?s.title+' · '+s.artist:'';fab.setAttribute('aria-label',on&&s?'Now playing '+s.title+' by '+s.artist:'ChinaLife Radio');if(sheet.open)draw()}
function progress(){const bar=sheet.open&&sheet.querySelector('.radio-progress i');if(bar){const d=audio.duration||current()?.duration||1;bar.style.width=Math.min(100,audio.currentTime/d*100)+'%';sheet.querySelector('.radio-time').textContent=time(audio.currentTime)+' / '+time(audio.duration||current()?.duration)}}
function draw(){const s=current(),on=!audio.paused&&wanted;
 sheet.innerHTML='<div class="radio-head"><b>🎵 ChinaLife Radio</b><button class="radio-x" aria-label="Close">✕</button></div>'
  +(s?'<div class="radio-player">'+(cover(s)?'<img src="'+esc(cover(s))+'" alt="">':'<span class="radio-art">🎤</span>')+'<div><b>'+esc(s.title)+'</b><span>'+esc(s.artist)+(s.city?' · '+esc(s.city):'')+'</span><div class="radio-progress"><i></i></div><small class="radio-time"></small></div></div>'
   +'<div class="radio-controls"><button data-r="prev" aria-label="Previous">⏮</button><button data-r="toggle" class="radio-main" aria-label="'+(on?'Pause':'Play')+'">'+(on?'⏸':'▶')+'</button><button data-r="next" aria-label="Next">⏭</button></div>'
   +(inClub()&&on?'<p class="radio-note">The club’s music is paused while the radio plays. Pause the radio to hear the club DJ.</p>':'')
   +'<label class="radio-volume">🔊<input type="range" min="0" max="100" value="'+Math.round(volume*100)+'" aria-label="Radio volume"></label>'+(s.listing?'<button class="soft-btn radio-artist" data-r="artist">Open '+esc(s.artist)+'’s page</button>':''):'')
  +'<h4>Playlist · '+list.length+' song'+(list.length===1?'':'s')+'</h4><ol class="radio-list">'+list.map((x,i)=>'<li><button data-play="'+i+'" class="'+(i===index?'current':'')+'"><span>'+(i===index&&on?'🔊':String(i+1))+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.artist)+(x.city&&x.city!==game.state.city?' · '+esc(x.city):'')+'</small><em>'+time(x.duration)+'</em></button></li>').join('')+'</ol>'
  +'<p class="radio-note">Songs by ChinaLife artists. Are you an artist? <a href="partners.html" target="_blank" rel="noopener">Get on the radio ↗</a></p>';
 sheet.querySelector('.radio-x').onclick=()=>sheet.close();
 sheet.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const r=b.dataset.r;if(r==='toggle')on?pause():play();if(r==='next'){load(index+1);play()}if(r==='prev'){prev();play()}if(r==='artist'){const p=(game.partnerRestaurants||[]).find(x=>String(x.id)===String(current()?.listing));sheet.close();if(p)game.partner?.(p,true);else game.toast?.('This artist is listed in '+current()?.city+'.')}});
 sheet.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>play(Number(b.dataset.play)));
 const v=sheet.querySelector('.radio-volume input');if(v)v.oninput=e=>{volume=Number(e.target.value)/100;store.set('chinalife-radio-volume',volume);applyVolume()};progress()}
function open(){if(!list.length)return game.toast?.('No artists on the radio yet.');draw();if(!sheet.open)sheet.showModal()}
sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});

// New songs from the server keep the current song playing where possible.
function refresh(){const id=current()?.id;list=songs();const i=list.findIndex(s=>s.id===id);if(i>=0)index=i;else if(index>=list.length)index=0;if(!list.length){pause()}render()}
window.addEventListener('chinalife:songs',refresh);window.addEventListener('chinalife:cloudready',refresh);
// Clubs have their own DJ: pause on the way in, resume on the way out.
// Starts on the first tap anywhere (browsers need a tap before sound), unless the player paused it before.
let started=false;const autoStart=()=>{if(started||wanted)return;if(store.get('chinalife-radio-on','on')==='off'){started=true;return}if(list.length){started=true;play()}};['pointerdown','keydown'].forEach(e=>document.addEventListener(e,autoStart,{capture:true}));
audio.addEventListener('pause',announce);audio.addEventListener('playing',announce);
window.addEventListener('chinalife:voice',e=>{duck=!!e.detail?.active;applyVolume()});
window.ChinaLifeRadio={open,play:id=>{const i=list.findIndex(s=>s.id===id);play(i>=0?i:undefined)},pause,next,prev,get playing(){return !audio.paused&&wanted},get current(){return current()},get songs(){return list},get audio(){return audio}};
refresh();
