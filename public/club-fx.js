// v10: themed clubs (every club except 007, no host) and the paid money spray shared by all clubs.
// Spray is paid on the server (economy.php action club-spray): ledger-recorded, one every 20 s, ¥20,000 a day.
export const SPRAYS=[100,500,2000];
export const THEMES={
 afro:{name:'Afrobeats Rooftop',tag:'AFROBEATS',colors:[0xff8a1f,0xffd23f,0x2ec27e,0xff4f6d],css:'#ffb13b',lines:['Afrobeats all night','Shaku shaku to the front']},
 hiphop:{name:'Hip-hop Lounge',tag:'HIP-HOP',colors:[0xff2d55,0xf5f5f5,0xffcf5a,0x7a5cff],css:'#ff2d55',lines:['Bars and bottles','Throwbacks on rotation']},
 amapiano:{name:'Amapiano Warehouse',tag:'AMAPIANO',colors:[0x22d3ee,0x3b82f6,0xa3e635,0xf472b6],css:'#22d3ee',lines:['Log drum loading','Ke Lento']},
 rnb:{name:'R&B & Chill',tag:'R&B',colors:[0xc084fc,0xf9a8d4,0x60a5fa,0xfde68a],css:'#c084fc',lines:['Slow jams only','Candles, couches, classics']},
 afrohouse:{name:'Afro-house Embers',tag:'AFRO-HOUSE',colors:[0xff4a2a,0xff9a3c,0xffd166,0xb5179e],css:'#ff6a3c',lines:['Deep drums, warm lights','Ember hour']}};
// Each club keeps one theme; 007 stays the after-party.
export const CLUB_THEME={skylight:'afro',partypier:'afro',suns:'afro',rex:'hiphop','silver-knight':'hiphop','best-one':'hiphop',orangutan:'amapiano',ex:'amapiano','taxi-club':'amapiano',hooleys:'amapiano','cats-eye':'rnb',youle:'rnb',kama:'rnb',blood:'afrohouse'};
const rooftops=['skylight','partypier'];
// Money rain: one shared note geometry and two materials, falling over the given spot for ~3 s.
export function moneyRain(c,at,count=36){const {THREE,root}=c,reduced=c.motionReduced();const g=new THREE.PlaneGeometry(.3,.15),mats=[0x64cb85,0xe7c26a].map(col=>new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,transparent:true}));const group=new THREE.Group();root.add(group);const n=reduced?8:count;
 for(let i=0;i<n;i++){const m=new THREE.Mesh(g,mats[i%2]);m.position.set(at.x+(Math.random()-.5)*3,2.4+Math.random()*2.2,at.z+(Math.random()-.5)*3);m.rotation.set(Math.random()*3,Math.random()*3,0);m.userData.v=.6+Math.random()*.8;m.userData.s=(Math.random()-.5)*6;group.add(m)}
 let t0=null,prev=null;const step=t=>{if(!group.parent)return;t0??=t;const dt=Math.min(.05,(t-(prev??t))/1000);prev=t;const age=(t-t0)/1000;for(const m of group.children){if(m.position.y>.18){m.position.y-=dt*m.userData.v*(reduced?0:1);m.rotation.x+=dt*m.userData.s;m.rotation.z+=dt*m.userData.s*.5;m.position.x+=Math.sin(age*3+m.userData.s)*dt*.3}}if(age>2.4)for(const mt of mats)mt.opacity=Math.max(0,1-(age-2.4)/.8);if(age<3.2&&!document.hidden)requestAnimationFrame(step);else{group.removeFromParent();g.dispose();mats.forEach(m=>m.dispose())}};requestAnimationFrame(step)}
export function sprayMenu(c,onDone){const game=c.game;let busy=false;
 game.showScreen('💸 Make it rain','Game coins only · ¥'+Math.floor(game.state.money).toLocaleString(),'<div class="pappi-menu">'+SPRAYS.map(n=>'<button class="choice-action" data-rain="'+n+'"><b>💸 Spray ¥'+n.toLocaleString()+'</b><span>'+(n>=2000?'Big money rain':n>=500?'Money rain':'A little rain')+'</span></button>').join('')+'</div><p id="rainStatus" class="fine-print" role="status">One spray every 20 seconds.</p>');
 document.querySelectorAll('[data-rain]').forEach(b=>b.onclick=async()=>{const st=document.getElementById('rainStatus'),amount=Number(b.dataset.rain);if(busy)return;if(!(window.ChinaLifeAuth?.request&&window.ChinaLifeCloud?.signedIn)){st.textContent='Sign in to spray.';return}if(amount>game.state.money){st.textContent='Not enough money.';return}
  busy=true;document.querySelectorAll('[data-rain]').forEach(x=>x.disabled=true);
  try{const r=await window.ChinaLifeAuth.request('/chinalife/economy.php','POST',{action:'club-spray',amount});game.applyServerTotals(r.data);document.getElementById('activityDialog')?.close();
   if(r.data?.cooldown){game.toast('⏳ '+(r.message||'Wait a moment.'))}else{const me=c.getPlayer();if(me)moneyRain(c,me.position,amount>=2000?60:amount>=500?40:24);window.ChinaLifeWorld?.sprayMoney?.('me');game.toast('💸 You sprayed ¥'+amount.toLocaleString());onDone?.(amount)}game.save?.();game.refresh?.()}
  catch(e){if(st)st.textContent=e.message||'Try again.'}finally{busy=false;document.querySelectorAll('[data-rain]').forEach(x=>x.disabled=false)}})}
// Theme dressing + HUD for a club without a host. Room: 14×10 indoors, open deck for rooftops.
export function themedClub(c,id){
 const {THREE,root,mesh,box,cylinder,label,game}=c,theme=THEMES[CLUB_THEME[id]||'rnb'],reduced=c.motionReduced,disposers=[],W=7,D=5,roof=rooftops.includes(id);
 const basic=(color,extra={})=>{const m=new THREE.MeshBasicMaterial({color,...extra});disposers.push(m);return m};
 const plane=(w,h,mat,x,y,z,ry=0,rx=0)=>{const g=new THREE.PlaneGeometry(w,h);disposers.push(g);const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,0);root.add(m);return m};
 const neon=(text,w,h,color,x,y,z,ry=0,size=96)=>{const cv=document.createElement('canvas');cv.width=512;cv.height=Math.round(512*h/w);const x2=cv.getContext('2d');x2.fillStyle='rgba(10,6,24,.85)';x2.fillRect(0,0,cv.width,cv.height);x2.shadowColor=color;x2.shadowBlur=24;x2.strokeStyle=color;x2.lineWidth=6;x2.strokeRect(10,10,cv.width-20,cv.height-20);x2.fillStyle='#fff';x2.font='900 '+Math.min(size,Math.floor(900/Math.max(4,text.length)))+'px system-ui,sans-serif';x2.textAlign='center';x2.textBaseline='middle';x2.fillText(text,256,cv.height/2+4);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;disposers.push(t);const m=plane(w,h,basic(0xffffff,{map:t,transparent:true}),x,y,z,ry);m.userData.signText=text;return m};
 const [c0,c1,c2,c3]=theme.colors,glow=[basic(c0),basic(c1)];
 // Neon entrance on the left wall with a rope.
 for(const z of [2.6,4.4]){const p=mesh(new THREE.BoxGeometry(.16,2.6,.16),0x221532,-W+.25,1.3,z);p.material=glow[0];p.userData.privateMaterial=true}
 {const t=mesh(new THREE.BoxGeometry(.16,.16,2),0x221532,-W+.25,2.6,3.5);t.material=glow[1];t.userData.privateMaterial=true}
 neon(theme.tag,1.8,.5,theme.css,-W+.18,3.05,3.5,Math.PI/2);
 for(const x of [-6.2,-5.4])cylinder(.05,.9,0xd9b24a,x,.45,4.6);box(.8,.05,.05,0xb5122b,-5.8,.8,4.6);
 // Theme name on the back wall, plus a small bar on the right.
 neon(theme.name.toUpperCase(),3.4,.55,theme.css,0,3.25,-D+.25);
 box(2.4,1.05,.6,0x1a1026,W-1.8,.53,-D+1.1);{const t=mesh(new THREE.BoxGeometry(2.5,.06,.7),0x111111,W-1.8,1.08,-D+1.1);t.material=glow[1];t.userData.privateMaterial=true}
 for(let i=0;i<6;i++)cylinder(.06,.32,[c0,c2,0x3b8f4a][i%3],W-2.9+i*.42,1.28,-D+1.1,root,8);
 // Dance floor: 5×4 tiles in the theme's four colours, swapped on the beat.
 const floorMats=[c0,c1,c2,c3].map(col=>basic(col,{transparent:true,opacity:.5})),tg=new THREE.PlaneGeometry(1.05,1.05);disposers.push(tg);const tiles=[];
 for(let i=0;i<5;i++)for(let j=0;j<4;j++){const t=new THREE.Mesh(tg,floorMats[(i+j)%4]);t.rotation.x=-Math.PI/2;t.position.set(-2.75+i*1.1+.55,.16,-1.4+j*1.1+.55);t.userData.k=(i*3+j*5)%4;root.add(t);tiles.push(t)}
 const bg=new THREE.ConeGeometry(.9,roof?3.6:3.4,12,1,true);disposers.push(bg);const beam=new THREE.Group();beam.position.set(0,roof?4:3.5,0);{const b=new THREE.Mesh(bg,basic(c0,{transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));b.position.y=-1.7;beam.add(b)}root.add(beam);
 // HUD.
 const hud=hudFor(c,{drinks:false,onSpray:a=>{boost+=a>=2000?20:a>=500?12:6}});let boost=0;
 const curtain=document.createElement('div');curtain.className='club-curtain';curtain.style.setProperty('--neon',theme.css);curtain.innerHTML='<b>'+theme.tag+'</b>';document.body.append(curtain);requestAnimationFrame(()=>curtain.classList.add('open'));setTimeout(()=>curtain.remove(),1200);
 hud.bump=n=>{boost+=n};
 let lastBeat=-1,lastFx=0,lastCheck=0;
 function tick(time){const phase=window.ChinaLifeAudio?.beatPhase?.(),beat=phase!=null?Math.floor(phase):Math.floor(time/900);if(beat!==lastBeat){lastBeat=beat;for(const t of tiles)t.material=floorMats[(t.userData.k+beat)%4]}
  if(!reduced()&&time-lastFx>66){lastFx=time;beam.rotation.z=.45*Math.sin(time*.0011);beam.rotation.x=.25*Math.cos(time*.0008);const pulse=phase!=null?1-(phase%1):.5;for(const m of floorMats)m.opacity=.3+pulse*.35}
  if(time-lastCheck>1000){lastCheck=time;boost=Math.max(0,boost-.6);hud.setParty(Math.round(15+c.remotes().length*12+(window.ChinaLifeAudio?.playing?25:0)+boost))}}
 function dispose(){hud.remove();curtain.remove();for(const d of disposers)d.dispose?.()}
 // Nudge room furniture that ends up on the dance floor out to the nearer side (runs after the room is built).
 function settle(){const fx0=-3.05,fx1=3.05,fz0=-1.7,fz1=3.3,skip=new Set([...tiles,beam]),box3=new THREE.Box3();
  for(const o of [...root.children]){if(skip.has(o)||o.userData.limbs||o.isLight||o.userData.treasure)continue;box3.setFromObject(o);if(box3.isEmpty())continue;const sx=box3.max.x-box3.min.x,sz=box3.max.z-box3.min.z,h=box3.max.y-box3.min.y;
   if(sx>4||sz>4||h<.2||box3.min.y>1.6)continue;if(box3.max.x<=fx0||box3.min.x>=fx1||box3.max.z<=fz0||box3.min.z>=fz1)continue;
   const left=box3.max.x-fx0+.15,right=fx1-box3.min.x+.15,dx=left<right?-left:right;o.position.x+=dx;
   for(const ob of c.obstacles())if(ob.x>=box3.min.x-.01&&ob.x<=box3.max.x+.01&&ob.z>=box3.min.z-.01&&ob.z<=box3.max.z+.01)ob.x+=dx}}
 return {tick,dispose,settle,keep:[...tiles,beam],theme};
}
// The club HUD: party meter + Dance / Toast / Spray (and Drinks in 007).
export function hudFor(c,{drinks,onDrinks,onSpray,onEmote}){
 const el=document.createElement('div');el.className='club-hud';el.innerHTML='<div class="club-meter" role="meter" aria-label="Party level" aria-valuemin="0" aria-valuemax="100"><span>🔥</span><i><b></b></i><em>0%</em></div><div class="club-emotes"><button data-ce="dance">💃<span>Dance</span></button><button data-ce="toast">🥂<span>Toast</span></button><button data-ce="spray">💸<span>Spray</span></button>'+(drinks?'<button data-ce="menu">🍾<span>Drinks</span></button>':'')+'</div>';
 (document.getElementById('worldUI')||document.body).append(el);const meter=el.querySelector('.club-meter'),fill=meter.querySelector('b'),pct=meter.querySelector('em');
 el.querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>{const k=b.dataset.ce;if(k==='menu')return onDrinks?.();if(k==='spray')return sprayMenu(c,a=>onSpray?.(a));c.setEmote(k==='toast'?'drink':'dance');el.bump?.(k==='toast'?5:8);onEmote?.(k)});
 el.setParty=p=>{p=Math.max(0,Math.min(100,p));fill.style.width=p+'%';pct.textContent=p+'%';meter.setAttribute('aria-valuenow',p);meter.classList.toggle('hot',p>=75)};
 return el}
