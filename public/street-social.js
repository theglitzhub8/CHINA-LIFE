// World v4: meeting people on the street and the live city map.
// - Tap a walker (avatar or name tag) for a mini profile: wave, quick chat (or private chat with friends), add friend.
// - While walking, a chip shows who else is on the street and points the camera at the nearest walker.
// - The live city map (ChinaLifeLiveMap) is a clean 2D overview: venue pins with live counts, you, walkers as dots.
const game=window.ChinaLife,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const W=()=>window.ChinaLifeWorld,C=()=>window.ChinaLifeCloud,A=()=>window.ChinaLifeAuth;
const players=()=>(C()?.cityPlayers||C()?.players||[]).filter(p=>!p.city||p.city===game.state.city);
const walkers=()=>players().filter(p=>p.street&&Number.isFinite(+p.street.x));
const colorOf=p=>/^#[0-9a-f]{6}$/i.test(p?.color)?p.color:'#0C3F44';
const initial=p=>esc((p?.name||'?')[0].toUpperCase());
let friendCache={at:0,list:[]};
async function friends(force=false){if(!force&&Date.now()-friendCache.at<20000)return friendCache.list;try{const r=await A().request('/chinalife/social.php','GET');friendCache={at:Date.now(),list:(r.data||r).friends||[]}}catch{}return friendCache.list}
export function streetWhere(p){if(!p?.street)return '';const n=W()?.nearestPlace?.(+p.street.x,+p.street.z);return n?'near '+n.name:'in '+(p.city||game.state.city)}
window.ChinaLifeStreetWhere=streetWhere;

// ---------- Mini profile card ----------
let card=null,cardId=null;
function close(){card?.classList.remove('open');const c=card;card=null;cardId=null;setTimeout(()=>c?.remove(),220)}
async function open(id){id=String(id);const p=players().find(x=>String(x.id)===id);if(!p)return game.toast?.('That player has moved on.');
 if(card)card.remove();cardId=id;card=document.createElement('section');card.className='street-card';card.setAttribute('role','dialog');card.setAttribute('aria-label',p.name+' on the street');
 const dist=(()=>{const me=W()?.myStreet?.();return me&&p.street?Math.round(Math.hypot(me.x-p.street.x,me.z-p.street.z)):null})();
 card.innerHTML='<button class="sc-close" aria-label="Close">✕</button><header><span class="sc-avatar" style="background:'+esc(colorOf(p))+'">'+initial(p)+'<i></i></span><div><b>'+esc(p.name)+'</b><small>🚶 On the street · '+esc(streetWhere(p))+(dist!=null?' · '+dist+' m away':'')+'</small><small class="sc-level">'+(p.xp!=null?'⭐ '+Number(p.xp).toLocaleString()+' XP':'Walking in '+esc(game.state.city))+'</small></div></header>'
  +'<div class="sc-actions"><button data-sc="wave"><span>👋</span>Wave</button><button data-sc="chat"><span>💬</span>Chat</button><button data-sc="friend"><span>➕</span><em>Add friend</em></button><button data-sc="profile"><span>👤</span>Profile</button></div>'
  +'<div class="sc-quick" hidden>'+[['hello','👋 Hello!'],['how','🙂 How are you?'],['where','📍 Where are you from?'],['nice','✨ Nice outfit!'],['friends','🤝 Can we be friends?'],['bye','👋 See you later!']].map(([k,t])=>'<button data-phrase="'+k+'">'+t+'</button>').join('')+'</div><p class="sc-note" aria-live="polite"></p>';
 document.body.append(card);requestAnimationFrame(()=>card?.classList.add('open'));
 const note=t=>{const n=card?.querySelector('.sc-note');if(n)n.textContent=t};
 card.querySelector('.sc-close').onclick=close;
 const fl=await friends();const f=fl.find(x=>String(x.id)===id);const fb=card?.querySelector('[data-sc="friend"] em');
 if(fb&&f)fb.textContent=f.status==='accepted'?'Friends ✓':f.outgoing?'Requested':'Accept';
 const send=async phrase=>{try{await A().request('/chinalife/gestures.php','POST',{city:game.state.city,street:1,to:id,phrase});W()?.say?.('me',({hello:'👋 Hello!',how:'🙂 How are you?',where:'📍 Where are you from?',nice:'✨ Nice outfit!',friends:'🤝 Can we be friends?',bye:'👋 See you later!'})[phrase]||'👋');return true}catch(e){note(e.message);return false}};
 card.querySelector('[data-sc="wave"]').onclick=async()=>{W()?.emote?.('wave');if(await send('hello'))note('You waved at '+p.name+'.')};
 card.querySelector('[data-sc="chat"]').onclick=()=>{if(f?.status==='accepted'){close();return window.ChinaLifeSocial?.openDirect(id)}const q=card.querySelector('.sc-quick');q.hidden=!q.hidden;note(q.hidden?'':'Pick a phrase to say. Become friends to chat privately.')};
 card.querySelectorAll('[data-phrase]').forEach(b=>b.onclick=async()=>{if(await send(b.dataset.phrase))note('Sent to '+p.name+'.')});
 card.querySelector('[data-sc="friend"]').onclick=async()=>{try{if(f?.status==='accepted')return note('You are already friends.');const action=f&&!f.outgoing&&f.status==='pending'?'accept':'request';const r=await A().request('/chinalife/friends.php','POST',{peer:id,action});const st=(r.data||r).status;fb.textContent=st==='accepted'?'Friends ✓':'Requested';note(st==='accepted'?'You are now friends.':'Friend request sent to '+p.name+'.');friendCache.at=0}catch(e){note(e.message)}};
 card.querySelector('[data-sc="profile"]').onclick=()=>{close();window.ChinaLifeSocial?.player(id)};
}
window.addEventListener('chinalife:players',()=>{if(cardId&&!players().some(p=>String(p.id)===cardId&&p.street)){const n=card?.querySelector('.sc-note');if(n)n.textContent='They left the street.'}renderChip()});
document.addEventListener('pointerdown',e=>{if(card&&!card.contains(e.target)&&!e.target.closest('.scene-label'))close()},true);
window.ChinaLifeStreetCard={open,close};

// ---------- Who's on the street (walk mode chip) ----------
let chip=null;
function renderChip(){const walking=!!W()?.streetWalking?.();if(!walking){chip?.remove();chip=null;return}
 if(!chip){chip=document.createElement('button');chip.className='street-chip';chip.type='button';($('worldUI')||document.body).append(chip);chip.onclick=chipTap}
 const list=walkers(),me=W()?.myStreet?.(),online=players().length;
 if(!list.length){chip.innerHTML='<i class="sc-dot idle"></i><span><b>No one else on the street</b><small>'+(online?online+' online in '+esc(game.state.city)+' · see People':'Invite a friend to walk with you')+'</small></span>';chip.dataset.mode='people';return}
 const near=me?list.map(p=>({p,d:Math.hypot(p.street.x-me.x,p.street.z-me.z)})).sort((a,b)=>a.d-b.d)[0]:{p:list[0],d:null};
 chip.dataset.mode='near';chip.dataset.id=near.p.id;
 chip.innerHTML='<i class="sc-dot"></i><span><b>'+list.length+' on the street</b><small>Nearest: '+esc(near.p.name)+(near.d!=null?' · '+Math.round(near.d)+' m':'')+' · tap to look</small></span><span class="sc-faces">'+list.slice(0,3).map(p=>'<em style="background:'+esc(colorOf(p))+'">'+initial(p)+'</em>').join('')+'</span>'}
function chipTap(){if(chip.dataset.mode==='people')return game.people?.();const p=walkers().find(x=>String(x.id)===chip.dataset.id);if(!p)return;W()?.faceTo?.(+p.street.x,+p.street.z);game.toast?.('👀 '+p.name+' is '+streetWhere(p)+'. Walk over and tap them to say hi.')}
setInterval(renderChip,1500);

// ---------- Live city map ----------
const KIND={club:'🎉',food:'🍜',sport:'⚽',work:'💼',shop:'🛍️'};
const SPORT=['football','gamecenter','court','gym','park'];
let mapFilter='all';
function liveMap(){const L=W()?.mapLayout?.();if(!L||!L.positions)return game.toast?.('The map is still loading.');
 let d=$('liveMapDialog');if(!d){d=document.createElement('dialog');d.id='liveMapDialog';d.className='live-map';document.body.append(d)}
 const draw=()=>{const all=players(),walk=walkers(),counts={};for(const p of all)if(!p.street&&p.place&&p.place!=='private-home')counts[p.place]=(counts[p.place]||0)+1;
  const pts=Object.values(L.positions),xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]),x0=Math.min(...xs)-8,x1=Math.max(...xs)+8,z0=Math.min(...zs)-8,z1=Math.max(...zs)+8,cl=v=>Math.max(2,Math.min(98,v)),sx=x=>cl((x-x0)/(x1-x0)*100),sz=z=>cl((z-z0)/(z1-z0)*100);d.classList.toggle('f-play',mapFilter==='play');
  const pins=L.places.filter(p=>L.positions[p.id]).filter(p=>mapFilter==='all'||(mapFilter==='busy'&&counts[p.id])||(mapFilter==='play'&&SPORT.includes(p.id))||(mapFilter==='people'&&counts[p.id]));
  const me=W()?.myStreet?.(),mePlace=L.positions[game.state.place],walking=W()?.streetWalking?.();
  const mePos=walking&&me?[me.x,me.z]:mePlace;
  d.innerHTML='<div class="lm-head"><div><small>Live map</small><h2>'+esc(game.state.city)+'</h2></div><button class="lm-close" aria-label="Close map">✕</button></div>'
   +'<div class="lm-stats"><span><b>'+(all.length+1)+'</b> online</span><span><b>'+walk.length+'</b> on the street</span><span><b>'+Object.keys(counts).length+'</b> busy places</span></div>'
   +'<div class="lm-filters" role="tablist">'+[['all','All places'],['busy','Busy now'],['play','⚽ Play'],['people','👥 People']].map(([k,t])=>'<button data-lmf="'+k+'" aria-pressed="'+(mapFilter===k)+'">'+t+'</button>').join('')+'</div>'
   +'<div class="lm-board"><div class="lm-grid" style="aspect-ratio:'+((x1-x0)/(z1-z0)).toFixed(3)+'">'+(L.xs||[]).filter(x=>x>x0&&x<x1).map(x=>'<i class="lm-st v" style="left:'+sx(x)+'%"></i>').join('')+(L.zs||[]).filter(z=>z>z0&&z<z1).map(z=>'<i class="lm-st h" style="top:'+sz(z)+'%"></i>').join('')
   +pins.map(p=>{const [x,z]=L.positions[p.id],n=counts[p.id]||0,newv=['football','gamecenter','court'].includes(p.id);return '<button class="lm-pin'+(n?' busy':'')+(newv?' new':'')+(mapFilter==='people'&&!n?' dim':'')+'" style="left:'+sx(x)+'%;top:'+sz(z)+'%" data-place="'+esc(p.id)+'" title="'+esc(p.name)+'"><span>'+esc(p.icon||'📍')+'</span>'+(n?'<b>'+n+'</b>':'')+'<em>'+esc(p.name)+'</em></button>'}).join('')
   +(mapFilter!=='busy'?walk.map(p=>'<button class="lm-walker" style="left:'+sx(+p.street.x)+'%;top:'+sz(+p.street.z)+'%;background:'+esc(colorOf(p))+'" data-walker="'+esc(p.id)+'" title="'+esc(p.name)+' · on the street"><span>'+esc(p.name)+'</span></button>').join(''):'')
   +(mePos?'<span class="lm-me" style="left:'+sx(mePos[0])+'%;top:'+sz(mePos[1])+'%"><i></i><b>You</b></span>':'')+'</div></div>'
   +'<div class="lm-legend"><span><i class="lg-me"></i>You</span><span><i class="lg-walk"></i>Walking</span><span><i class="lg-busy"></i>Players inside</span><span><i class="lg-new"></i>New</span></div><p class="lm-sel" aria-live="polite">Tap a place or a walker.</p>';
  d.querySelector('.lm-close').onclick=()=>d.close();
  d.querySelectorAll('[data-lmf]').forEach(b=>b.onclick=()=>{mapFilter=b.dataset.lmf;draw()});
  d.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{d.querySelectorAll('.lm-pin.sel').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');const id=b.dataset.place,p=L.places.find(x=>x.id===id),here=all.filter(x=>x.place===id&&!x.street);d.querySelector('.lm-sel').innerHTML='<b>'+esc(p.icon||'')+' '+esc(p.name)+'</b> · '+(here.length?here.length+' inside: '+here.slice(0,4).map(x=>esc(x.name)).join(', '):'Quiet right now')+' <button class="lm-go" data-go="'+esc(id)+'">'+(id===game.state.place?'Go inside':'Go there')+'</button>';d.querySelector('.lm-go').onclick=()=>{d.close();game.travel(id)}});
  d.querySelectorAll('[data-walker]').forEach(b=>b.onclick=()=>{const p=walk.find(x=>String(x.id)===b.dataset.walker);if(!p)return;d.querySelector('.lm-sel').innerHTML='<b>🚶 '+esc(p.name)+'</b> · on the street '+esc(streetWhere(p))+' <button class="lm-go">'+(W()?.streetWalking?.()?'Look':'Walk there')+'</button>';d.querySelector('.lm-go').onclick=()=>{d.close();if(!W()?.streetWalking?.()){W()?.map?.();setTimeout(()=>W()?.setCityWalk?.(true),300)}setTimeout(()=>W()?.faceTo?.(+p.street.x,+p.street.z),700)}});
 };
 draw();d.redraw=draw;if(!d.open)d.showModal()}
window.addEventListener('chinalife:players',()=>{const d=$('liveMapDialog');if(d?.open)d.redraw?.()});
window.ChinaLifeLiveMap={open:liveMap};
// A "Live map" button on the city map screen.
function mapButton(){const ui=$('worldUI');if(!ui||$('liveMapBtn'))return;const b=document.createElement('button');b.id='liveMapBtn';b.type='button';b.className='live-map-btn';b.innerHTML='<span>🗺️</span>Live map';b.setAttribute('aria-label','Open the live city map');b.onclick=liveMap;ui.append(b)}
setInterval(()=>{mapButton();const b=$('liveMapBtn');if(b)b.hidden=!$('navMap')?.classList.contains('active')},700);addEventListener('load',()=>setTimeout(mapButton,1500));
