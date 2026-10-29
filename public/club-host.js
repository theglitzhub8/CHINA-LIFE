import {sprayMenu} from './club-fx.js?v=20261014d1';
import {clubLife} from './club-life.js?v=20261027d';
import {hypeman} from './hypeman.js?v=20261028a';
// v9: 007 Club host ChampagnePappi, the neon club dressing and the party HUD.
// v11: in one-city mode the club takes ChinaLifeOneCity.clubName() (no 007, no Shenyang) and club-life.js adds the
// disco lights, DJ booth, Now playing chip and shout-outs. Classic mode keeps the 007 naming unchanged.
// Built once per visit into the venue root; tick() runs from the world loop. No paid AI: canned lines only.
// Oct 2026: in one-city ChampagnePappi sits behind the admin flag club_pappi (default OFF) and the canned Hypeman
// (hypeman.js, flag club_hypeman, default ON) works the room instead. The bar is a plain counter that works either way
// (the server menu has no tie to Pappi); with Pappi off it is the Club bar and Pappi Fizz shows as Club Fizz (same sku).
// Drinks are paid on the server (economy.php action club-drink) and only update money/XP, never the save revision.
export const DRINKS=[
 {sku:'pappi-fizz',icon:'🥂',name:'Pappi Fizz',price:120,note:'+10 XP · fun up',fun:15,social:6,alc:15},
 {sku:'gold-rush',icon:'🍾',name:'Gold Rush',price:300,note:'+25 XP · big fun',fun:25,social:12,alc:22},
 {sku:'zero-proof',icon:'🍹',name:'Zero Proof',price:40,note:'+5 XP · no alcohol',fun:8,social:4,alc:0},
 {sku:'water',icon:'💧',name:'Water',price:0,note:'Sobers you up',fun:0,social:0,energy:3,alc:-10}];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const LINES={
 welcome:['Welcome to 007, {n}! 🥂','{n}! The party just got better.','Ayyy {n} is in the building!','{n}, you look expensive tonight. 😎'],
 join:['Yo {n}, welcome in! 🍾','Make some noise for {n}!','{n} just pulled up. Respect.'],
 banter:['Champagne for the real ones. 🥂','No sad faces in my club.','Hydrate, then celebrate. 💧','Shades on. Inside. Always.','VIP is a mindset… and also ¥500.','Who ordered the vibes? Me. I did.','If you can stand, you can dance.'],
 dj:['DJ, run it back! 🔊','This DJ is cooking tonight. 🔥','Hands up for the DJ! 🙌','Turn it up, DJ!'],
 duel:['Dance-off! Hit 💃 in 15 seconds!','Dance-off time! Show me moves. 💃'],
 toast:['Cheers! 🥂','To money, love and good music!','Glasses up! 🥂'],
 served:['One {d}, coming right up!','{d} for {n}. Enjoy! 🍾','Good choice, {n}.'],
 quiet:['It\'s quiet… bring your friends. 📲','Early bird gets the dance floor.']};
const brand=t=>window.ChinaLifeOneCity?.brand?.(t)??t;
const fill=(t,v)=>brand(t).replace('{n}',v.n||'friend').replace('{d}',v.d||'');
export function nightClub(c){
 const {THREE,root,mesh,box,cylinder,label,game}=c,reduced=c.motionReduced,disposers=[],OC=window.ChinaLifeOneCity,oneCity=!!OC?.active?.(),clubName=oneCity?OC.clubName():'007 Club',clubSign=oneCity?clubName.toUpperCase():'007';
 const cast=k=>window.ChinaLifeFlags?.cast?.(k)===true,pappiOn=!oneCity||cast('club_pappi'),hypeOn=oneCity&&cast('club_hypeman');let hype=null;
 const drinkName=x=>!pappiOn&&x.sku==='pappi-fizz'?'Club Fizz':x.name;
 const escH=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
 const basic=(color,extra={})=>{const m=new THREE.MeshBasicMaterial({color,...extra});disposers.push(m);return m};
 const plane=(w,h,mat,x,y,z,ry=0,rx=0)=>{const g=new THREE.PlaneGeometry(w,h);disposers.push(g);const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,0);root.add(m);return m};
 // Neon text panels drawn once on canvas.
 const neon=(text,w,h,color,x,y,z,ry=0,size=110)=>{const cv=document.createElement('canvas');cv.width=512;cv.height=Math.round(512*h/w);const x2=cv.getContext('2d');x2.fillStyle='rgba(10,6,24,.85)';x2.fillRect(0,0,cv.width,cv.height);x2.shadowColor=color;x2.shadowBlur=24;x2.strokeStyle=color;x2.lineWidth=6;x2.strokeRect(10,10,cv.width-20,cv.height-20);x2.fillStyle='#fff';x2.font='900 '+size+'px system-ui,sans-serif';while(size>28&&x2.measureText(text).width>cv.width-48){size-=4;x2.font='900 '+size+'px system-ui,sans-serif'}x2.textAlign='center';x2.textBaseline='middle';x2.fillText(text,256,cv.height/2+4);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;disposers.push(t);const m=plane(w,h,basic(0xffffff,{map:t,transparent:true}),x,y,z,ry);m.userData.signText=text;return m};
 // Entrance: neon arch, VIP rope and the bouncer, between the doors and the arrival spots.
 const pink=basic(0xff3fa4),cyan=basic(0x35e6ff),gold=basic(0xffcf5a);
 for(const z of [4.9,6.7]){const p=mesh(new THREE.BoxGeometry(.18,3,.18),0x221532,-9.2,1.5,z);p.material=pink;p.userData.privateMaterial=true}
 {const top=mesh(new THREE.BoxGeometry(.18,.18,2),0x221532,-9.2,3,5.8);top.material=cyan;top.userData.privateMaterial=true}
 neon(clubSign,oneCity?2.4:1.7,.6,'#ff3fa4',-9.28,3.5,5.8,Math.PI/2,120);
 for(const x of [-8.4,-7.6,-6.8])cylinder(.05,.95,0xd9b24a,x,.48,6.75);box(1.6,.05,.05,0xb5122b,-7.6,.82,6.75);
 const bouncer=c.person(-8.3,4.6,0x111111,0x5b3a29,'Bouncer','host',{skin:0x5b3a29,hair:'cropped',acc:['sunglasses','headphones'],top:{s:'tee',c:0x111111},bottom:{s:'jeans',c:0x161616}});bouncer.rotation.y=Math.PI/2;
 // Dance floor: 6×4 tiles in four shared colours that swap on the beat.
 const floorMats=[0xff3fa4,0x35e6ff,0x8b5cff,0xffcf5a].map(col=>basic(col,{transparent:true,opacity:.55})),tileG=new THREE.PlaneGeometry(1.05,1.05);disposers.push(tileG);const tiles=[];
 for(let i=0;i<6;i++)for(let j=0;j<4;j++){const t=new THREE.Mesh(tileG,floorMats[(i+j)%4]);t.rotation.x=-Math.PI/2;t.position.set(-3+i*1.1+.55,.15,-1.6+j*1.1+.55);t.userData.k=(i*3+j*5)%4;root.add(t);tiles.push(t)}
 // Two light beams sweeping from the ceiling.
 const beamG=new THREE.ConeGeometry(1.1,4.6,14,1,true);disposers.push(beamG);const beams=[0xff3fa4,0x35e6ff].map((col,i)=>{const b=new THREE.Mesh(beamG,basic(col,{transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));const pivot=new THREE.Group();pivot.position.set(i?2.6:-2.6,4.9,-.6);b.position.y=-2.3;pivot.add(b);root.add(pivot);return pivot});
 // Bar in the back-right corner, with a lit shelf of bottles.
 box(3.4,1.05,.7,0x1a1026,7.2,.53,-4.1);{const top=mesh(new THREE.BoxGeometry(3.5,.06,.8),0x111111,7.2,1.08,-4.1);top.material=gold;top.userData.privateMaterial=true}
 box(3.4,.06,.35,0x2a1d3a,7.2,1.9,-6.6);for(let i=0;i<9;i++)cylinder(.07,.36,[0x3b8f4a,0xd9b24a,0x7a1f2b][i%3],5.8+i*.35,2.12,-6.6,root,8);
 neon('BAR',1.6,.55,'#35e6ff',7.2,2.85,-6.75,0,120);
 label('🍾 Bar',7.2,1.9,-4.1,'interactive',()=>menu());
 // VIP corner glow.
 neon('VIP',1.4,.5,'#ffcf5a',-5.2,2.6,-4.4,0,120);plane(3,2.2,basic(0xffcf5a,{transparent:true,opacity:.07,depthWrite:false}),-5.2,.16,-2.8,0,-Math.PI/2);
 // ChampagnePappi: gold suit, shades, chains, luxury watch and a champagne bottle.
 const pappi=c.person(7,-3.2,0xd4a843,0x6b4329,'',null,{skin:0x6b4329,hair:'cropped',hairColor:0x111111,acc:['sunglasses','chain','luxwatch'],top:{s:'suit',c:0xd4a843},bottom:{s:'trousers',c:0xf3efe4},shoes:{s:'loafers',c:0xffffff}});
 const bottle=new THREE.Group();mesh(new THREE.CylinderGeometry(.06,.07,.3,10),0x1f5a35,0,0,0,bottle);mesh(new THREE.CylinderGeometry(.025,.05,.12,8),0xd9b24a,0,.2,0,bottle);pappi.userData.limbs[3].add(bottle);bottle.position.set(0,-.62,.12);
 mesh(new THREE.TorusGeometry(.17,.022,6,20),0xd9b24a,0,1.36,.1,pappi).rotation.x=Math.PI/2.4;
 {const shades=mesh(new THREE.BoxGeometry(.36,.1,.05),0x050505,0,1.775,.2,pappi);shades.castShadow=false;mesh(new THREE.BoxGeometry(.4,.025,.04),0xd9b24a,0,1.83,.2,pappi);
  const glintG=new THREE.PlaneGeometry(.07,.025);disposers.push(glintG);const glintM=basic(0xffffff,{transparent:true,opacity:.9});for(const x of [-.11,.06]){const gl=new THREE.Mesh(glintG,glintM);gl.position.set(x,1.79,.227);gl.rotation.z=.5;pappi.add(gl)}pappi.userData.glint=glintM}
 if(!pappiOn){root.remove(pappi);pappi.visible=false}
 // Linked to the real Hafrik account champagnepapi (user 6988): tap opens the profile card; online state comes from the existing presence feed only.
 const REAL={id:'6988',user:'champagnepapi'};let realOn=false;
 const tag=pappiOn?label('🍾 ChampagnePappi',0,0,0,'pappi-name',()=>{if(window.ChinaLifeSocial?.player)window.ChinaLifeSocial.player(REAL.id);else menu()}):{el:null};if(pappiOn)tag.follow=pappi;
 if(!document.getElementById('pappiOnlineCss')){const st=document.createElement('style');st.id='pappiOnlineCss';st.textContent='.scene-label.pappi-name.online::after{content:"\\25CF  online";margin-left:6px;font-size:.78em;color:#0b7a3b;background:#d8ffe6;border-radius:9px;padding:1px 6px}';document.head.append(st)}
 function realCheck(list){const on=(list||[]).some(p=>String(p.id)===REAL.id||String(p.name||'').toLowerCase()===REAL.user);tag.el?.classList.toggle('online',on);if(on&&!realOn)setTimeout(()=>say("I'm online, pull up! 🍾",5000),600);realOn=on}
 const onPlayers=e=>realCheck(e.detail);if(pappiOn){window.addEventListener('chinalife:players',onPlayers);realCheck(window.ChinaLifeCloud?.players)}
 const bubble=pappiOn?label('',0,0,0,'say-bubble pappi-say quiet'):null;if(bubble){bubble.follow=pappi;bubble.lift=.45;bubble.el.setAttribute('role','status')}
 let sayTimer=0;function say(text,ms=4200){if(!bubble)return hype?.say(text,ms);bubble.el.textContent=text;bubble.el.classList.remove('quiet');bubble.hw=0;clearTimeout(sayTimer);sayTimer=setTimeout(()=>bubble.el.classList.add('quiet'),ms)}
 const spots=[[7,-3.2],[3.1,.4],[-4.6,-1.2],[-7.2,5.6],[6,2.9],[-2.8,3]];let goal=null,wait=2,greeted=false,seen=new Set(),nextBanter=performance.now()+9000,duel=null;
 // HUD: party meter, emotes and the drink menu.
 const hud=document.createElement('div');hud.className='club-hud';hud.innerHTML='<div class="club-meter" role="meter" aria-label="Party level" aria-valuemin="0" aria-valuemax="100"><span>🔥</span><i><b></b></i><em>0%</em></div><div class="club-emotes"><button data-ce="dance">💃<span>Dance</span></button><button data-ce="toast">🥂<span>Toast</span></button><button data-ce="hype">🙌<span>Hype</span></button><button data-ce="spray">💸<span>Spray</span></button><button data-ce="menu">🍾<span>Drinks</span></button></div>';
 (document.getElementById('worldUI')||document.body).append(hud);
 let boost=0;const meter=hud.querySelector('.club-meter'),fillEl=meter.querySelector('b'),pct=meter.querySelector('em');
 const life=oneCity?clubLife(c,{say:(t,ms)=>say(t,ms),bump:n=>{boost+=n},hud,clubName,bpm:OC.CLUB?.bpm||113}):null;
 if(hypeOn)try{hype=hypeman(c,{hud,clubName,bump:n=>{boost+=n},party:()=>party(),openBar:()=>menu(),startDuel:()=>{if(duel&&performance.now()<duel)return false;duel=performance.now()+15000;return true}})}catch(e){console.warn('hypeman',e)}
 hud.querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>{const k=b.dataset.ce;if(k==='menu')return menu();if(k==='shout')return life?.openShout();if(k==='spray')return sprayMenu(c,a=>{boost+=a>=2000?20:a>=500?12:6;if(hype&&a>=500)return hype.event('spray',{amount:a});say(a>=2000?'Big money! Make it rain! 💸':'Spray on the dance floor! 💸')});if(k==='dance'){c.setEmote('dance');boost+=8;if(duel&&performance.now()<duel){duel=null;boost+=20;say('🏆 '+game.state.name+' wins the dance-off!');game.toast('🏆 You won the dance-off')}else hype?.event('dance')}if(k==='toast'){boost+=5;say(pick(LINES.toast));toastMoment()}if(k==='hype'){boost+=6;say(pick(LINES.dj));hypeMoment()}});
 const curtain=document.createElement('div');curtain.className='club-curtain'+(clubSign.length>6?' brand':'');curtain.innerHTML='<b>'+escH(clubSign==='007'?'007':clubName)+'</b>';document.body.append(curtain);requestAnimationFrame(()=>curtain.classList.add('open'));setTimeout(()=>curtain.remove(),1200);
 function party(){const crowd=c.remotes().length,music=window.ChinaLifeAudio?.playing?25:0;return Math.max(0,Math.min(100,Math.round(15+crowd*12+music+boost)))}
 let busy=false;const last=new Map();
 function menu(){const s=game.state,d=game.drunkInfo?.()||{icon:'😊',label:'Sober',value:0};
  game.showScreen(pappiOn?'🍾 Pappi\'s bar':'🍾 '+clubName+' bar','¥'+Math.floor(s.money).toLocaleString()+' · '+d.icon+' '+d.label,'<div class="pappi-menu">'+DRINKS.map(x=>'<button class="choice-action" data-drink="'+x.sku+'"><b>'+x.icon+' '+drinkName(x)+' · '+(x.price?'¥'+x.price:'free')+'</b><span>'+x.note+'</span></button>').join('')+'</div><p id="pappiStatus" class="fine-print" role="status">One drink every 90 seconds.</p>');
  document.querySelectorAll('[data-drink]').forEach(b=>b.onclick=()=>order(DRINKS.find(x=>x.sku===b.dataset.drink)))}
 // Club Phase 4 (docs/CLUB-PLAN.md): VIP service. Sitting in the VIP lounge (world.js 'chinalife:vip-seated') brings a waiter
 // from the bar with a tray: the first drink of the night is on the house (economy.php club-drink vip:1, checked against your
 // VIP pass), after that he takes your order from the menu at bar prices. The drink goes on a little table by your seat.
 let afterOrder=null,waiterBody=null,vipSpot=null,waitTimer=0;const servedProps=[];
 const onVip=e=>{if(e.detail?.place!=='night')return;vipSpot=e.detail;setTimeout(()=>callWaiter(true),1800)};window.addEventListener('chinalife:vip-seated',onVip);
 function seatedVip(){const p=c.getPlayer();return !!(vipSpot&&p&&window.ChinaLifeWorld?.emoteNow==='sit'&&Math.hypot(p.position.x-vipSpot.x,p.position.z-vipSpot.z)<.3)}
 const IN=[[3,-2.1],[-3.4,-2.1],[-3.6,-2.6]];
 function callWaiter(first){if(!seatedVip()||waiterBody)return false;const T=c.THREE;
  const w=c.person(6.2,-3.1,0x111111,0x5a3a26,'',null,{skin:'#5a3a26',hair:'cropped',trousers:'#111111',top:{s:'suit',c:0x111111},crowd:true,gender:'male'});
  const tray=new T.Mesh(new T.CylinderGeometry(.24,.24,.03,18),new T.MeshStandardMaterial({color:0xd8d8d8,metalness:.8,roughness:.3}));tray.position.set(.3,1.38,.3);tray.userData.r7keep=true;w.add(tray);
  const glass=new T.Mesh(new T.CylinderGeometry(.045,.035,.16,12),new T.MeshStandardMaterial({color:0xffd56a,transparent:true,opacity:.85,emissive:0x664400}));glass.position.set(.3,1.48,.3);glass.userData.r7keep=true;w.add(glass);
  Object.assign(w.userData,{mode:'serve',path:[...IN,[vipSpot.x+.6,vipSpot.z+.8]],onArrive:()=>arrive(w,glass,first)});c.addActor(w);waiterBody=w;
  game.toast(first?'🤵 A waiter is bringing your welcome drink':'🤵 A waiter is on his way to take your order');return true}
 // The drink goes on a little side table by the seat, and you feel it (same effects as ordering at the bar).
 function putDown(glass,x,free){glass.visible=false;const T=c.THREE,s=vipSpot,tbl=new T.Mesh(new T.CylinderGeometry(.18,.14,.46,16),new T.MeshStandardMaterial({color:0x2a1d3a,roughness:.4}));tbl.position.set(s.x+.55,.23,s.z+.4);
  const g2=new T.Mesh(glass.geometry,glass.material);g2.position.set(s.x+.55,.54,s.z+.4);c.root.add(tbl,g2);servedProps.push(tbl,g2);
  if(free){const st=game.state;st.needs.fun=Math.min(100,(st.needs.fun||0)+x.fun);st.needs.social=Math.min(100,(st.needs.social||0)+x.social);st.drunk=Math.max(0,Math.min(95,(st.drunk||0)+x.alc));boost+=8}}
 async function arrive(w,glass,first){const p=c.getPlayer();if(p)w.userData.face=Math.atan2(p.position.x-w.position.x,p.position.z-w.position.z);if(!seatedVip())return leave(w);
  if(first&&window.ChinaLifeAuth?.request&&window.ChinaLifeCloud?.signedIn){try{const r=await window.ChinaLifeAuth.request('/chinalife/economy.php','POST',{action:'club-drink',sku:'pappi-fizz',vip:1});game.applyServerTotals(r.data);putDown(glass,DRINKS[0],true);
   say('On the house for our VIP, '+game.state.name+'! 🥂');game.toast('🥂 '+drinkName(DRINKS[0])+' · on the house'+(r.data?.awardedXp?' · +'+r.data.awardedXp+' XP':''));game.save?.();game.refresh?.();setTimeout(()=>leave(w),1800);return}catch{}}
  // After the free one: he takes your order (paid at the bar price through order()), or leaves if you don't order.
  afterOrder=x=>{putDown(glass,x,false);clearTimeout(waitTimer);setTimeout(()=>leave(w),1500)};menu();clearTimeout(waitTimer);waitTimer=setTimeout(()=>{afterOrder=null;leave(w)},15000)}
 function leave(w){if(w.userData.mode==='serve')return;Object.assign(w.userData,{mode:'serve',face:null,path:[[-3.6,-2.6],...IN.slice().reverse(),[6.2,-3.1]],onArrive:()=>{c.removeActor?.(w);if(waiterBody===w)waiterBody=null}})}
 // Leaving the seat clears the table.
 function vipTick(){if(servedProps.length&&!seatedVip())for(const o of servedProps.splice(0))o.removeFromParent()}

 // Club moments (docs/CLUB-PLAN.md, 30 Oct 2026): every club action shows what it means. Arm poses on the real bodies
 // (bones turned after the animation each frame), props in the hand, speech bubbles, a stage spotlight, lighting bursts,
 // sparkles and confetti, and the crowd turning to watch or answering. The game's own costs and rewards are unchanged.
 const POSES={toast:[['Bip01_R_UpperArm','z',-1.5],['Bip01_R_Forearm','z',-.8]],mic:[['Bip01_R_UpperArm','z',-1.1],['Bip01_R_Forearm','z',-2]],hold:[['Bip01_R_UpperArm','z',-.5],['Bip01_R_Forearm','z',-1.3]],hype:[['Bip01_R_UpperArm','y',2.3],['Bip01_L_UpperArm','y',-2.3]]};
 const AX={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)},qTmp=new THREE.Quaternion(),vTmp=new THREE.Vector3();
 const posed=new Map(),fx=[],props=new Set(),bubbles=new Map(),moved=[];let spot=null,flashUntil=0,micVol=null;
 const boneOf=(b,n)=>{const cache=b.userData.cdBones||(b.userData.cdBones={});if(!(n in cache)){let f=null;b.traverse(o=>{if(!f&&o.name===n)f=o});cache[n]=f}return cache[n]};
 function pose(body,name,ms){if(!body?.userData?.real||reduced())return;posed.set(body,{name,from:performance.now(),until:performance.now()+ms})}
 // Weight eases in and out over a quarter second; hype pumps the arms.
 function poseTick(now){for(const [body,p] of posed){if(now>p.until+250||!body.parent){posed.delete(body);continue}const w=Math.min(1,(now-p.from)/250,(p.until+250-now)/250),pump=p.name==='hype'?1+.18*Math.sin(now/120):1;
  for(const [bn,ax,a] of POSES[p.name]){const b=boneOf(body,bn);if(b){qTmp.setFromAxisAngle(AX[ax],a*w*pump);b.quaternion.multiply(qTmp)}}}}
 // A prop in a body's right hand (glass, mic) for ms; scaled to world size whatever the bone's scale.
 function inHand(body,make,ms){const hand=boneOf(body,'Bip01_R_Hand');if(!hand)return null;const o=make();body.updateMatrixWorld(true);hand.getWorldScale(vTmp);o.scale.divide(vTmp);o.position.set(.08/vTmp.x,0,.04/vTmp.z);hand.add(o);props.add(o);setTimeout(()=>{o.removeFromParent();props.delete(o)},ms);return o}
 const glassMesh=()=>{const g=new THREE.Group(),m=new THREE.Mesh(new THREE.CylinderGeometry(.045,.035,.15,12),new THREE.MeshStandardMaterial({color:0xffd56a,transparent:true,opacity:.85,emissive:0x664400}));g.add(m);return g};
 const micMesh=()=>{const g=new THREE.Group(),h=new THREE.Mesh(new THREE.CylinderGeometry(.02,.016,.16,10),new THREE.MeshStandardMaterial({color:0x222222})),b=new THREE.Mesh(new THREE.SphereGeometry(.04,12,10),new THREE.MeshStandardMaterial({color:0xb8b8b8,metalness:.8,roughness:.3}));b.position.y=.1;g.add(h,b);return g};
 // Speech bubble over any body (one per body, reused).
 function bubbleOn(body,text,ms=2600){let b=bubbles.get(body);if(!b){b=label('',0,0,0,'say-bubble pappi-say quiet');b.follow=body;b.lift=.5;bubbles.set(body,b)}b.el.textContent=text;b.el.classList.remove('quiet');b.hw=0;clearTimeout(b.t);b.t=setTimeout(()=>b.el.classList.add('quiet'),ms)}
 // Sparkles (toast) and confetti (hype, applause): small unlit quads that fly and fall.
 function burst(at,n,colors,up=2.2){if(reduced())return;const g=new THREE.PlaneGeometry(.07,.07);for(let i=0;i<n;i++){const m=new THREE.Mesh(g,basic(colors[i%colors.length],{side:THREE.DoubleSide}));m.position.copy(at);const a=Math.random()*Math.PI*2,s=.6+Math.random()*1.4;m.userData.v=new THREE.Vector3(Math.cos(a)*s,up*(.6+Math.random()*.8),Math.sin(a)*s);m.userData.r=Math.random()*8;m.userData.life=1.6+Math.random()*.8;root.add(m);fx.push(m)}}
 function fxTick(dt){for(let i=fx.length-1;i>=0;i--){const m=fx[i];m.userData.life-=dt;m.userData.v.y-=4.2*dt;m.position.addScaledVector(m.userData.v,dt);m.rotation.x+=m.userData.r*dt;m.rotation.y+=m.userData.r*dt*.7;if(m.userData.life<=0||m.position.y<.05){m.removeFromParent();fx.splice(i,1)}}}
 // The crowd (club NPCs, not staff) near a point; they can turn to face something and come back to what they were doing.
 const crowd=(x,z,r)=>c.bodies().filter(b=>b!==c.getPlayer()&&b.userData?.mode&&['dance','chat'].includes(b.userData.mode)&&Math.hypot(b.position.x-x,b.position.z-z)<r);
 function watch(list,x,z,ms){for(const b of list){moved.push({b,mode:b.userData.mode,face:b.userData.face});b.userData.mode='wait';b.userData.face=Math.atan2(x-b.position.x,z-b.position.z)}setTimeout(()=>{for(const m of moved.splice(0))if(m.b.userData.mode==='wait'){m.b.userData.mode=m.mode;m.b.userData.face=m.face}},ms)}
 function handWorld(body){const h=boneOf(body,'Bip01_R_Hand');return h?h.getWorldPosition(new THREE.Vector3()):body.position.clone().setY(1.4)}
 // 🥂 Toast: glass up, sparkles, "Cheers!", the two nearest people raise theirs back.
 function toastMoment(){const me=c.getPlayer();if(!me)return;pose(me,'toast',2600);inHand(me,glassMesh,2900);bubbleOn(me,'🥂 Cheers!');setTimeout(()=>burst(handWorld(me),18,[0xffd56a,0xffffff,0xffe9a8],1.4),450);
  crowd(me.position.x,me.position.z,5).sort((a,b)=>a.position.distanceTo(me.position)-b.position.distanceTo(me.position)).slice(0,2).forEach((b,i)=>{watch([b],me.position.x,me.position.z,2800);setTimeout(()=>{bubbleOn(b,i?'Cheers! 🥂':'🥂 To '+game.state.name+'!',2200);pose(b,'toast',2200);inHand(b,glassMesh,2400)},500+i*350)})}
 // 🙌 Hype: both arms up and pumping, the lights strobe, the floor flashes, confetti, the crowd jumps.
 function hypeMoment(){const me=c.getPlayer();if(!me)return;pose(me,'hype',3200);bubbleOn(me,'🙌 Let\'s gooo!',2600);flashUntil=performance.now()+3000;burst(me.position.clone().setY(2.4),36,[0xff3fa4,0x35e6ff,0xffcf5a,0x8b5cff],2.6);
  crowd(me.position.x,me.position.z,7).slice(0,4).forEach((b,i)=>setTimeout(()=>bubbleOn(b,['🔥','🙌','Ayyy!','Turn up! 🎉'][i],1800),300+i*250))}
 // 🎤 Open mic (place-bar "Go to open mic", kind 'perform'): up on the stage, a mic stand and a mic in your hand, a
 // spotlight, the music drops, the crowd turns to watch; applause and confetti at the end.
 const MIC={x:-2,z:-3};let audience=[];
 function micStart(ev){const me=c.getPlayer();if(!me)return;ev.duration=9;me.position.set(MIC.x,.52,MIC.z);me.rotation.y=.2;
  const stand=new THREE.Group(),pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1.25,8),new THREE.MeshStandardMaterial({color:0x111111})),foot=new THREE.Mesh(new THREE.CylinderGeometry(.18,.2,.03,16),pole.material);pole.position.y=.62;stand.add(pole,foot);stand.position.set(MIC.x+.05,.52,MIC.z+.42);root.add(stand);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.1,4.2,20,1,true),basic(0xfff3c4,{transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));cone.position.set(MIC.x,2.6,MIC.z);const light=new THREE.SpotLight(0xfff3c4,40,9,.5,.4);light.position.set(MIC.x,4.6,MIC.z+.4);light.target.position.set(MIC.x,.5,MIC.z);root.add(cone,light,light.target);spot=[stand,cone,light,light.target];
  pose(me,'mic',8800);inHand(me,micMesh,8800);const a=window.ChinaLifeAudio;if(a?.setVolume&&micVol==null){micVol=a.volume;a.setVolume(micVol*.35)}
  audience=crowd(MIC.x,MIC.z,11);watch(audience,MIC.x,MIC.z,9200);bubbleOn(me,'🎤 Is this thing on? Hello '+clubName+'!',3000);setTimeout(()=>bubbleOn(me,'🎤 '+pick(['This one goes out to everybody far from home…','Lagos to China, we are here! 🇳🇬🇨🇳','Make some noise! 🙌','Thank you! You\'re beautiful!'])),3600)}
 function micEnd(){const me=c.getPlayer();if(spot){for(const o of spot)o.removeFromParent();spot=null}const a=window.ChinaLifeAudio;if(micVol!=null){a?.setVolume?.(micVol);micVol=null}if(me)burst(new THREE.Vector3(MIC.x,2.6,MIC.z),40,[0xff3fa4,0x35e6ff,0xffcf5a],2.2);
  audience.splice(0).slice(0,5).forEach((b,i)=>setTimeout(()=>bubbleOn(b,['👏👏','Encore! 👏','🔥🔥','We love you! 👏','👏'][i],2200),i*200));boost+=12}
 // 🍸 Meet people over a drink (kind 'talk'): someone from the crowd walks over, you both hold a drink and chat.
 const CHAT=[['me','Hey! I\'m {n} 👋'],['them','Nice to meet you, {n}! Where are you from?'],['me','Lagos, now living in China 🇨🇳'],['them','No way! Let\'s dance later 🥂']];
 let friend=null;
 function meetStart(ev){const me=c.getPlayer();if(!me)return;ev.duration=8.5;const near=crowd(me.position.x,me.position.z,14).filter(b=>b.userData.mode==='chat').sort((a,b)=>a.position.distanceTo(me.position)-b.position.distanceTo(me.position))[0];
  pose(me,'hold',8000);inHand(me,glassMesh,8000);if(!near){bubbleOn(me,'🥂 Cheers, everyone!');return}
  const f=Math.atan2(near.position.x-me.position.x,near.position.z-me.position.z),sx=me.position.x+Math.sin(f)*.95,sz=me.position.z+Math.cos(f)*.95;friend={b:near,mode:near.userData.mode};
  Object.assign(near.userData,{mode:'serve',path:[[sx,sz]],onArrive:()=>{near.userData.face=Math.atan2(me.position.x-near.position.x,me.position.z-near.position.z);pose(near,'hold',6000);inHand(near,glassMesh,6000)}});me.rotation.y=f;
  CHAT.forEach(([who,t],i)=>setTimeout(()=>{if(friend?.b===near)bubbleOn(who==='me'?me:near,t.replace('{n}',game.state.name),1900)},1600+i*1700))}
 function meetEnd(){if(!friend)return;const f=friend;friend=null;f.b.userData.mode=f.mode;f.b.userData.face=null}
 // 💃 Dance with the crowd / the main floor (kind 'dance'): the floor flashes and the people around you dance with you.
 function danceStart(ev){const me=c.getPlayer();if(!me)return;ev.duration=Math.max(ev.duration||0,6);flashUntil=performance.now()+2200;bubbleOn(me,'💃 Let\'s dance!',2200);
  crowd(me.position.x,me.position.z,4).forEach((b,i)=>{if(b.userData.mode==='chat'){moved.push({b,mode:'chat',face:b.userData.face});b.userData.mode='dance'}if(i<2)setTimeout(()=>bubbleOn(b,['Ayy! 🔥','Go {n}! 💃'][i].replace('{n}',game.state.name),1800),600+i*400)});setTimeout(()=>{for(const m of moved.splice(0))if(m.b.userData.mode==='dance'&&m.mode==='chat')m.b.userData.mode='chat'},6500)}
 const onPerform=e=>{const d=e.detail||{};if(d.place!=='night')return;if(d.state==='start'){if(d.kind==='perform')micStart(d);else if(d.kind==='talk'&&/drink/i.test(d.label||''))meetStart(d);else if(d.kind==='dance')danceStart(d)}else{if(d.kind==='perform')micEnd();if(d.kind==='talk')meetEnd()}};
 window.addEventListener('chinalife:perform',onPerform);
 function momentsTick(t,dt){poseTick(performance.now());fxTick(dt);if(performance.now()<flashUntil&&!reduced()){const on=Math.floor(t/90)%2;for(const m of floorMats)m.opacity=on?.95:.25;beams[0].rotation.z=Math.sin(t*.02)*.9;beams[1].rotation.z=-Math.sin(t*.02)*.9}}
 function momentsDispose(){window.removeEventListener('chinalife:perform',onPerform);micEnd();meetEnd();for(const m of fx.splice(0))m.removeFromParent();for(const o of props)o.removeFromParent();props.clear();for(const b of bubbles.values())b.el.remove();bubbles.clear();posed.clear()}
 async function order(x){const status=document.getElementById('pappiStatus');if(busy||!x)return;if(!(window.ChinaLifeAuth?.request&&window.ChinaLifeCloud?.signedIn)){if(status)status.textContent='Sign in to order.';return}
  if(x.price>game.state.money){if(status)status.textContent='Not enough money.';return}
  busy=true;document.querySelectorAll('[data-drink]').forEach(b=>b.disabled=true);
  try{const r=await window.ChinaLifeAuth.request('/chinalife/economy.php','POST',{action:'club-drink',sku:x.sku});game.applyServerTotals(r.data);const s=game.state;
   if(!r.data?.cooldown){s.needs.fun=Math.min(100,(s.needs.fun||0)+x.fun);s.needs.social=Math.min(100,(s.needs.social||0)+x.social);if(x.energy)s.needs.energy=Math.min(100,(s.needs.energy||0)+x.energy);s.drunk=Math.max(0,Math.min(95,(s.drunk||0)+x.alc));boost+=x.price>=300?14:x.price?8:2}
   document.getElementById('activityDialog')?.close();say(r.data?.cooldown?'Easy, tiger. One every 90 seconds. ⏳':(hype&&x.price>=300?hype.event('drink',{price:x.price,name:drinkName(x)}):fill(pick(LINES.served),{n:s.name,d:drinkName(x)})));game.toast(r.data?.cooldown?'⏳ '+(r.message||'Slow down. Try again soon.'):x.icon+' '+drinkName(x)+(r.data?.awardedXp?' · +'+r.data.awardedXp+' XP':''));if(!seatedVip())c.setEmote('drink');if(afterOrder&&!r.data?.cooldown)afterOrder(x);afterOrder=null;game.save?.();game.refresh?.()}
  catch(e){if(status)status.textContent=e.message||'Try again.'}finally{busy=false;document.querySelectorAll('[data-drink]').forEach(b=>b.disabled=false)}}
 let lastCheck=0,lastBeat=-1,lastFx=0,stuck=0,steer=0,straightFor=0;const vel={x:0,z:0};
 // Heading eases toward the target along the shortest arc and ignores tiny differences.
 const turn=(target,dt)=>{let d=target-pappi.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));if(Math.abs(d)<.03)return;pappi.rotation.y+=d*(1-Math.exp(-dt*7))};
 const free=(x,z)=>Math.abs(x)<9&&Math.abs(z)<6.5&&!c.obstacles().some(o=>Math.abs(x-o.x)<o.w/2+.15&&Math.abs(z-o.z)<o.d/2+.15);
 // v11: Pappi keeps the same personal space as everyone else (world.js CROWD_GAP .72) and gives way when someone is closer.
 const GAP=.8,clear=(x,z)=>free(x,z)&&!c.bodies().some(b=>b!==pappi&&Math.hypot(b.position.x-x,b.position.z-z)<GAP);
 function yieldSpace(){for(const b of c.bodies()){if(b===pappi)continue;const dx=pappi.position.x-b.position.x,dz=pappi.position.z-b.position.z,d=Math.hypot(dx,dz);if(d>=.76)continue;const ux=d>1e-4?dx/d:1,uz=d>1e-4?dz/d:0,k=.76-d;for(const [vx,vz] of [[ux,uz],[uz,-ux],[-uz,ux]]){const nx=pappi.position.x+vx*k,nz=pappi.position.z+vz*k;if(free(nx,nz)){pappi.position.x=nx;pappi.position.z=nz;break}}}}
 function tick(time,dt){
  const me=c.getPlayer();
  if(me&&!greeted&&pappiOn){greeted=true;setTimeout(()=>say(fill(pick(LINES.welcome),{n:game.state.name})),900)}
  // Lights: on the beat while the DJ plays, slow drift otherwise.
  const phase=window.ChinaLifeAudio?.beatPhase?.(),beat=phase!=null?Math.floor(phase):Math.floor(time/900);
  if(beat!==lastBeat){lastBeat=beat;for(const t of tiles)t.material=floorMats[(t.userData.k+beat)%4]}
  if(!reduced()&&time-lastFx>66){lastFx=time;if(pappi.userData.glint)pappi.userData.glint.opacity=.5+.45*Math.abs(Math.sin(time*.003));const sw=Math.sin(time*.0011);beams[0].rotation.z=.5*sw;beams[1].rotation.z=-.5*sw;beams[0].rotation.x=beams[1].rotation.x=.25*Math.cos(time*.0008);const pulse=phase!=null?1-(phase%1):.5;for(const m of floorMats)m.opacity=.35+pulse*.35}
  // Pappi walks between his spots and pauses to talk.
  // Walking: one committed steer angle (hysteresis), smoothed velocity and heading, full settle when idle.
  if(pappiOn){if(goal){const dx=goal[0]-pappi.position.x,dz=goal[1]-pappi.position.z,dist=Math.hypot(dx,dz);
   if(dist<.15||stuck>2.5){goal=null;stuck=0;steer=0;wait=3+Math.random()*4}
   else{const ux=dx/dist,uz=dz/dist,dir=a=>[ux*Math.cos(a)-uz*Math.sin(a),ux*Math.sin(a)+uz*Math.cos(a)],ok=a=>{const [vx,vz]=dir(a);return clear(pappi.position.x+vx*.5,pappi.position.z+vz*.5)};
    // Keep the current angle while it stays clear; drift back to straight only once straight has been clear for a moment.
    if(!ok(steer)){const opts=[.6,-.6,1.2,-1.2,1.8,-1.8].sort((a,b)=>Math.abs(a-steer)-Math.abs(b-steer));const f=opts.find(ok);steer=f??steer;straightFor=0;if(f==null)stuck+=dt}
    else if(steer!==0){straightFor=ok(0)?straightFor+dt:0;if(straightFor>.4){steer=0;straightFor=0}}
    const [vx,vz]=ok(steer)?dir(steer):[0,0],k=1-Math.exp(-dt*6);vel.x+=(vx*1.2-vel.x)*k;vel.z+=(vz*1.2-vel.z)*k;
    const sp=Math.hypot(vel.x,vel.z);if(sp>.02){const step=Math.min(sp*dt,dist);pappi.position.x+=vel.x/sp*step;pappi.position.z+=vel.z/sp*step}else stuck+=dt;
    if(sp>.15)turn(Math.atan2(vel.x,vel.z),dt);
    const w=Math.sin(time*.01)*Math.min(1,sp/1.2),[l,r,al,ar]=pappi.userData.limbs;l.rotation.x=w*.5;r.rotation.x=-w*.5;al.rotation.x=-w*.4;al.rotation.z=0;ar.rotation.x=-.6;pappi.position.y=0}}
  else{wait-=dt;vel.x=vel.z=0;const [l,r,al]=pappi.userData.limbs,e=1-Math.exp(-dt*8);l.rotation.x*=1-e;r.rotation.x*=1-e;al.rotation.x*=1-e;al.rotation.z+=((reduced()?.3:.4+Math.sin(time*.003)*.3)-al.rotation.z)*e;pappi.position.y=0;
   if(wait<=0){let next;do next=pick(spots);while(next===pappi.userData.spot);pappi.userData.spot=next;goal=next}}
  yieldSpace()}
  if(time-(dodgeAt||0)>250){dodgeAt=time;dodge()}
  if(time-lastCheck>1000){lastCheck=time;boost=Math.max(0,boost-.6);const p=party();fillEl.style.width=p+'%';pct.textContent=p+'%';meter.setAttribute('aria-valuenow',p);meter.classList.toggle('hot',p>=75);
   const first=!seen.primed;seen.primed=true;for(const r of c.remotes())if(!seen.has(r.id)){seen.add(r.id);if(!first&&r.name&&pappiOn)setTimeout(()=>say(fill(pick(LINES.join),{n:r.name})),400)}
   if(pappiOn&&performance.now()>nextBanter){nextBanter=performance.now()+16000+Math.random()*14000;const roll=Math.random();if(roll<.12&&!duel){duel=performance.now()+15000;say(pick(LINES.duel),6000)}else if(roll<.4&&window.ChinaLifeAudio?.playing)say(pick(LINES.dj));else if(realOn&&roll<.6)say(pick(["I'm online, pull up! 🍾","Pappi is live tonight. Tap my name and follow! 🍾"]));else say(pick(c.remotes().length?LINES.banter:[...LINES.banter,...LINES.quiet]))}}}
 let dodgeAt=0;const emoteBar=hud.querySelector('.club-emotes');function dodge(){if(!bubble)return;const e=bubble.el;if(e.classList.contains('quiet')){e.style.marginLeft='';return}const b=e.getBoundingClientRect(),r=emoteBar.getBoundingClientRect(),cur=parseFloat(e.style.marginLeft)||0;const over=b.right-cur-(r.left-10);e.style.marginLeft=(b.bottom>r.top&&b.top<r.bottom&&over>0)?(-over)+'px':''}
 function dispose(){window.removeEventListener('chinalife:players',onPlayers);window.removeEventListener('chinalife:vip-seated',onVip);momentsDispose();clearTimeout(waitTimer);if(waiterBody)c.removeActor?.(waiterBody);for(const o of servedProps.splice(0))o.removeFromParent();if(window.ChinaLifeClubHost?.pappi===pappi)window.ChinaLifeClubHost=null;clearTimeout(sayTimer);life?.dispose();hype?.dispose();hud.remove();curtain.remove();for(const d of disposers)d.dispose?.();const out=document.createElement('div');out.className='club-curtain leaving'+(clubSign.length>6?' brand':'');out.innerHTML='<b>'+escH(clubSign==='007'?'007':clubName)+'</b>';document.body.append(out);setTimeout(()=>out.remove(),700)}
 const api={waiter:()=>callWaiter(false),_obs:()=>c.obstacles(),keep:[...(pappiOn?[pappi]:[]),bouncer,...tiles,...beams,...(life?.keep||[]),...(hype?.keep||[])],tick:(t,d)=>{tick(t,d);vipTick();momentsTick(t,d);life?.tick(t,d,{tiles,mats:floorMats});hype?.tick(t,d)},life,clubName,dispose,menu,say,party,pappi:pappiOn?pappi:null,hypeman:hype,me:()=>c.getPlayer()};window.ChinaLifeClubHost=api;return api;
}
