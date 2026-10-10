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
const next=()=>{load(nextIndex());if(wanted)play()},prev=()=>{if(audio.currentTime>5){audio.currentTime=0;return}load(index-1);if(wanted)play()};
audio.addEventListener('ended',next);
// A broken file never stops the radio: skip it after a moment (but not forever if everything fails).
let failures=0;audio.addEventListener('error',()=>{if(!wanted)return;if(++failures>=Math.max(3,list.length)){pause();failures=0;return game.toast?.('ChinaLife Radio could not load songs right now.')}setTimeout(next,800)});
audio.addEventListener('playing',()=>{failures=0;render()});audio.addEventListener('pause',render);audio.addEventListener('timeupdate',progress);
function mediaSession(){const s=current();if(!s||typeof navigator==='undefined'||!('mediaSession' in navigator))return;try{navigator.mediaSession.metadata=new MediaMetadata({title:s.title,artist:s.artist,album:'ChinaLife Radio',artwork:cover(s)?[{src:cover(s),sizes:'512x512'}]:[]});navigator.mediaSession.setActionHandler('play',()=>play());navigator.mediaSession.setActionHandler('pause',pause);navigator.mediaSession.setActionHandler('nexttrack',next);navigator.mediaSession.setActionHandler('previoustrack',prev)}catch{}}

// ---- Interface: a mini-player pill (cover, song, play/pause, progress) and a full player sheet. ----
let tab='next',query='',artistFilter='',shuffle=store.get('chinalife-radio-shuffle','off')==='on';
const fab=document.createElement('div');fab.id='radioFab';fab.className='radio-fab';fab.hidden=true;fab.setAttribute('role','button');fab.setAttribute('aria-label','ChinaLife Radio');fab.tabIndex=0;
fab.innerHTML='<span class="radio-cover"><span class="radio-icon">🎵</span></span><span class="radio-now"><b></b><small></small></span><button type="button" class="radio-mini" aria-label="Play">▶</button><i class="radio-line"></i>';
(document.getElementById('worldUI')||document.body).append(fab);
fab.onclick=e=>{if(e.target.closest('.radio-mini')){e.stopPropagation();return (!audio.paused&&wanted)?pause():play()}open()};fab.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
const sheet=document.createElement('dialog');sheet.id='radioDialog';sheet.className='radio-sheet';document.body.append(sheet);
const eq='<span class="radio-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
function render(){const s=current(),on=!audio.paused&&wanted;fab.hidden=!list.length;fab.classList.toggle('playing',on);fab.classList.toggle('has-song',!!(s&&(on||audio.currentTime>0)));
 const c=fab.querySelector('.radio-cover');c.style.backgroundImage=s&&cover(s)?'url("'+cover(s).replace(/"/g,'')+'")':'';c.classList.toggle('with-art',!!(s&&cover(s)));
 fab.querySelector('.radio-now b').textContent=s?s.title:'ChinaLife Radio';fab.querySelector('.radio-now small').textContent=s?s.artist:'';
 const mini=fab.querySelector('.radio-mini');mini.textContent=on?'⏸':'▶';mini.setAttribute('aria-label',on?'Pause':'Play');fab.setAttribute('aria-label',on&&s?'Now playing '+s.title+' by '+s.artist:'ChinaLife Radio');if(sheet.open)draw()}
function progress(){const d=audio.duration||current()?.duration||0,p=d?Math.min(100,audio.currentTime/d*100):0;fab.querySelector('.radio-line').style.width=p+'%';
 if(!sheet.open)return;const seek=sheet.querySelector('.radio-seek');if(seek&&!seek.matches(':active'))seek.value=String(Math.round(p*10));const t=sheet.querySelector('.radio-time');if(t)t.innerHTML='<span>'+time(audio.currentTime)+'</span><span>'+time(d)+'</span>'}
// Shuffle picks any other song next; otherwise the list plays in order and loops.
const nextIndex=()=>shuffle&&list.length>1?(index+1+Math.floor(Math.random()*(list.length-1)))%list.length:index+1;
function row(x,i,on){const art=cover(x);return '<li><button data-play="'+i+'" class="'+(i===index?'current':'')+'"><span class="radio-thumb"'+(art?' style="background-image:url(&quot;'+esc(art)+'&quot;)"':'')+'>'+(art?'':'🎤')+'</span><span class="radio-row"><b>'+esc(x.title)+'</b><small>'+esc(x.artist)+(x.city&&x.city!==game.state.city?' · '+esc(x.city):'')+'</small></span>'+(i===index&&on?eq:'<em>'+time(x.duration)+'</em>')+'</button></li>'}
function draw(){const s=current(),on=!audio.paused&&wanted,art=cover(s),artists=[...new Map(list.map(x=>[x.artist,x])).values()];
 const shown=tab==='next'?list.map((x,i)=>[x,i]).filter(([,i])=>i!==index).sort((a,b)=>((a[1]-index+list.length)%list.length)-((b[1]-index+list.length)%list.length)).slice(0,12)
  :list.map((x,i)=>[x,i]).filter(([x])=>(!artistFilter||x.artist===artistFilter)&&(!query||(x.title+' '+x.artist).toLowerCase().includes(query.toLowerCase())));
 sheet.innerHTML='<div class="radio-hero"'+(art?' style="--art:url(&quot;'+esc(art)+'&quot;)"':'')+'><div class="radio-head"><b>🎵 ChinaLife Radio</b><button class="radio-x" aria-label="Minimize player" title="Keep playing and return to the city">⌄</button></div>'
  +(s?'<div class="radio-player"><span class="radio-art"'+(art?' style="background-image:url(&quot;'+esc(art)+'&quot;)"':'')+'>'+(art?'':'🎤')+'</span><div class="radio-meta"><span class="radio-live">'+(on?eq+' Now playing':'Paused')+'</span><b>'+esc(s.title)+'</b><button class="radio-artistname" data-r="artist">'+esc(s.artist)+(s.city?' · '+esc(s.city):'')+' ›</button></div></div>'
   +'<input class="radio-seek" type="range" min="0" max="1000" value="0" aria-label="Seek"><div class="radio-time"></div>'
   +'<div class="radio-controls"><button data-r="shuffle" class="'+(shuffle?'on':'')+'" aria-label="Shuffle" aria-pressed="'+shuffle+'">🔀</button><button data-r="prev" aria-label="Previous">⏮</button><button data-r="toggle" class="radio-main" aria-label="'+(on?'Pause':'Play')+'">'+(on?'⏸':'▶')+'</button><button data-r="next" aria-label="Next">⏭</button><label class="radio-vol" aria-label="Volume">🔊<input type="range" min="0" max="100" value="'+Math.round(volume*100)+'"></label></div>'
   +(inClub()&&on?'<p class="radio-note light">The club’s own music is paused while the radio plays. Pause to hear the club DJ.</p>':''):'')+'</div>'
  +'<div class="radio-tabs">'+[['next','Up next'],['all','All songs · '+list.length],['artists','Artists · '+artists.length]].map(([k,n])=>'<button data-tab="'+k+'" class="'+(tab===k?'active':'')+'">'+n+'</button>').join('')+'</div>'
  +(tab==='artists'?'<div class="radio-artists">'+artists.map(a=>'<button data-artist="'+esc(a.artist)+'"><span class="radio-thumb"'+(cover(a)?' style="background-image:url(&quot;'+esc(cover(a))+'&quot;)"':'')+'>'+(cover(a)?'':'🎤')+'</span><b>'+esc(a.artist)+'</b><small>'+list.filter(x=>x.artist===a.artist).length+' song'+(list.filter(x=>x.artist===a.artist).length===1?'':'s')+(a.city?' · '+esc(a.city):'')+'</small></button>').join('')+'</div>'
   :(tab==='all'?'<div class="radio-search"><input type="search" placeholder="Search songs or artists" value="'+esc(query)+'">'+(artistFilter?'<button data-clear>'+esc(artistFilter)+' ✕</button>':'')+'</div>':'')+'<ol class="radio-list">'+(shown.map(([x,i])=>row(x,i,on)).join('')||'<li class="radio-empty">'+(tab==='next'?'This is the only song so far.':'No songs match.')+'</li>')+'</ol>')
  +'<p class="radio-note">Songs by ChinaLife artists. Are you an artist? <a href="partners.html" target="_blank" rel="noopener">Get on the radio ↗</a></p>';
 sheet.querySelector('.radio-x').onclick=()=>sheet.close();
 sheet.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const r=b.dataset.r;if(r==='toggle')on?pause():play();if(r==='next'){load(nextIndex());play()}if(r==='prev'){prev();play()}if(r==='shuffle'){shuffle=!shuffle;store.set('chinalife-radio-shuffle',shuffle?'on':'off');draw()}
  if(r==='artist'){const p=(game.partnerRestaurants||[]).find(x=>String(x.id)===String(current()?.listing));if(p){sheet.close();game.partner?.(p,true)}else{artistFilter=current()?.artist||'';tab='all';draw()}}});
 sheet.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;draw()});
 sheet.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>play(Number(b.dataset.play)));
 sheet.querySelectorAll('[data-artist]').forEach(b=>b.onclick=()=>{artistFilter=b.dataset.artist;query='';tab='all';draw()});
 const clear=sheet.querySelector('[data-clear]');if(clear)clear.onclick=()=>{artistFilter='';draw()};
 const q=sheet.querySelector('.radio-search input');if(q)q.oninput=e=>{query=e.target.value;const pos=e.target.selectionStart;draw();const n=sheet.querySelector('.radio-search input');n.focus();try{n.setSelectionRange(pos,pos)}catch{}};
 const seek=sheet.querySelector('.radio-seek');if(seek)seek.oninput=e=>{const d=audio.duration||current()?.duration;if(d)try{audio.currentTime=Number(e.target.value)/1000*d}catch{}};
 const v=sheet.querySelector('.radio-vol input');if(v)v.oninput=e=>{volume=Number(e.target.value)/100;store.set('chinalife-radio-volume',volume);applyVolume()};progress()}
function open(){if(!list.length)return game.toast?.('No artists on the radio yet.');tab=tab||'next';draw();if(!sheet.open)sheet.showModal()}
sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});

// New songs from the server keep the current song playing where possible.
function refresh(){const id=current()?.id;list=songs();const i=list.findIndex(s=>s.id===id);if(i>=0)index=i;else if(index>=list.length)index=0;if(!list.length){pause()}render()}
window.addEventListener('chinalife:songs',refresh);window.addEventListener('chinalife:cloudready',refresh);
// Clubs have their own DJ: pause on the way in, resume on the way out.
// Starts on the first tap anywhere (browsers need a tap before sound), unless the player paused it before.
let started=false;const autoStart=()=>{if(started||wanted||inClub())return;if(store.get('chinalife-radio-on','on')==='off'){started=true;return}if(list.length){started=true;play()}};['pointerdown','keydown'].forEach(e=>document.addEventListener(e,autoStart,{capture:true}));
audio.addEventListener('pause',announce);audio.addEventListener('playing',announce);
window.addEventListener('chinalife:voice',e=>{duck=!!e.detail?.active;applyVolume()});
window.ChinaLifeRadio={open,play:id=>{const i=list.findIndex(s=>s.id===id);play(i>=0?i:undefined)},pause,next,prev,get playing(){return !audio.paused&&wanted},get current(){return current()},get songs(){return list},get audio(){return audio}};
refresh();
