// v10: themed interiors. Each kind adds props along the walls so the middle of the room stays walkable.
// Static props get merged by the world; only the few animated canvases are kept live.
export function dressRoom(c,id){
 const {THREE,root,mesh,box,cylinder,label,game}=c,kind=kindOf(game,id);if(!kind)return null;
 const disposers=[],keep=[],timers=[];
 const panel=(w,h,draw,x,y,z,ry=0,live=false)=>{const cv=document.createElement('canvas');cv.width=512;cv.height=Math.round(512*h/w);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;const g=new THREE.PlaneGeometry(w,h),m=new THREE.MeshBasicMaterial({map:t});disposers.push(t,g,m);const p=new THREE.Mesh(g,m);p.position.set(x,y,z);p.rotation.y=ry;root.add(p);const paint=()=>{draw(cv.getContext('2d'),cv.width,cv.height);t.needsUpdate=true};paint();if(live)keep.push(p);p.userData.paint=paint;return p};
 const text=(x2,t,px,y,{color='#fff',weight=800,align='left',x=24}={})=>{x2.fillStyle=color;x2.font=weight+' '+px+'px system-ui,sans-serif';x2.textAlign=align;x2.fillText(t,x,y)};
 const BACK=-4.62,LEFT=-6.62;
 if(kind==='gist'){
  // Newsroom: on-air screen with rolling headlines, a pinboard of clues, a tea table and a studio mic.
  const heads=['Who left 007 with two phones?','Landlord raises rent, tenants raise eyebrows','Mystery chef spotted at the market','Campus crush confesses on the radio','Big Laoban buys third scooter'];let k=0;
  const tv=panel(3.4,1.9,(x,w,h)=>{x.fillStyle='#14121f';x.fillRect(0,0,w,h);x.fillStyle='#e0263b';x.fillRect(0,0,w,64);text(x,'● ON AIR · GOSSIP TV',30,44);const hs=window.ChinaLifeHotSeat?.enabled?.()&&window.ChinaLifeHotSeat.featured?.();if(hs&&k%2===0){window.ChinaLifeHotSeat.paintTV(x,w,h,hs,text);return}text(x,'BREAKING',26,120,{color:'#ffcf5a'});const words=String(window.ChinaLifeOneCity?.brand?.(heads[k%heads.length])??heads[k%heads.length]).split(' ');let line='',y=170;for(const wd of words){if((line+wd).length>22){text(x,line,34,y);y+=44;line=''}line+=wd+' '}text(x,line,34,y);x.fillStyle='#e0263b';x.fillRect(0,h-40,w,40);text(x,'Tip us anonymously at the Gossip desk',18,h-14)},-3,2.6,BACK,0,true);
  timers.push(setInterval(()=>{k++;tv.userData.paint()},7000));
  // Gossip hot seat: today's most-voted gist takes every other slot on Gossip TV, and shows at once when it changes.
  const onHotSeat=()=>{k=0;tv.userData.paint()};addEventListener('chinalife:hotseat',onHotSeat);disposers.push({dispose(){removeEventListener('chinalife:hotseat',onHotSeat)}});
  box(3.6,2.1,.06,0x241b2e,-3,2.6,BACK-.04);
  box(.06,1.6,2.4,0x8a6a45,LEFT+.05,1.7,1.4);for(let i=0;i<6;i++)box(.02,.42,.34,[0xfff4c2,0xffffff,0xbfe3ff][i%3],LEFT+.1,1.3+(i%2)*.6,.6+Math.floor(i/2)*.8);
  for(let i=0;i<3;i++){const s=box(.01,.012,.9,0xd22b2b,LEFT+.12,1.55+i*.15,.9+i*.5);s.rotation.x=.4-i*.4}
  box(2.2,.45,.8,0x7a3b62,-3.8,.25,-3.4);box(2.2,.5,.15,0x7a3b62,-3.8,.6,-3.75);cylinder(.45,.42,0xd9b24a,-3.8,.22,-2.4);
  cylinder(.03,1.5,0x222222,4.6,.75,-2.6);mesh(new THREE.SphereGeometry(.09,10,8),0x333333,4.6,1.55,-2.6);
  label('🫖 Tea table · spill it',-3.8,1.2,-2.4,'interactive',()=>game.gist?.());
  if(window.ChinaLifeHotSeat?.enabled?.()){cylinder(.34,.5,0xe0263b,3.7,.25,-2.6);box(.7,.7,.1,0xe0263b,3.7,.85,-2.95);cylinder(.36,.04,0xffcf5a,3.7,.52,-2.6);label('🔥 Hot seat · True or Cap?',3.9,1.9,-2.6,'interactive',()=>window.ChinaLifeHotSeat.open())}}
 if(kind==='hospital'){
  // Ward: reception with a red cross, two curtained beds, a heart monitor and waiting chairs.
  box(3,1.05,.7,0xf4f7f8,-3.6,.53,BACK+1.1);box(3.1,.06,.8,0x5fb5b8,-3.6,1.08,BACK+1.1);
  panel(1.2,1.2,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#e0263b';x.fillRect(w*.38,h*.12,w*.24,h*.76);x.fillRect(w*.12,h*.38,w*.76,h*.24)},-3.6,2.6,BACK);
  for(const z of [-1.8,1.2]){box(2,.5,1,0xffffff,4.8,.45,z);box(2,.12,1,0xbfe3ff,4.8,.74,z);box(.4,.12,.8,0xffffff,5.6,.84,z);box(.04,2,1.4,0xa8d8e0,3.6,1.1,z);cylinder(.025,1.6,0xbcc6cc,6.1,.8,z+.6);box(.18,.26,.06,0xd7f0ff,6.1,1.55,z+.6)}
  let ph=0;const mon=panel(.9,.6,(x,w,h)=>{x.fillStyle='#03140f';x.fillRect(0,0,w,h);x.strokeStyle='#38f59a';x.lineWidth=5;x.beginPath();for(let i=0;i<=w;i+=8){const t=(i+ph)%170,y=t>60&&t<70?h*.15:t>70&&t<80?h*.85:h*.55;i?x.lineTo(i,y):x.moveTo(i,y)}x.stroke();text(x,'72 bpm',30,40,{color:'#38f59a'})},5.9,1.7,-1.8-.55,-Math.PI/2,true);
  timers.push(setInterval(()=>{if(c.motionReduced())return;ph+=40;mon.userData.paint()},250));
  for(let i=0;i<4;i++){box(.55,.45,.55,0x5fb5b8,-5.8,.23,.4+i*.8);box(.55,.5,.1,0x5fb5b8,-6.05,.6,.4+i*.8)}
  box(10,.012,.5,0x5fb5b8,0,.135,3.4)}
 if(kind==='school'){
  // Classroom: timetable board, teacher's desk, a clock, a world map and a bookshelf.
  panel(2.6,1.5,(x,w,h)=>{x.fillStyle='#1f4a3a';x.fillRect(0,0,w,h);text(x,'课程表 · TIMETABLE',26,40,{color:'#ffe9a8'});const tt=window.ChinaLifeSchool?.timetable?.()||[];tt.slice(0,6).forEach((p,i)=>{text(x,p.time+'  '+p.icon+' '+p.name,22,80+i*36,{color:p.now?'#ffd34d':'#e8f3ee',weight:p.now?900:600})})},-3.6,2.3,BACK);
  box(2.8,1.6,.06,0x6b4a2b,-3.6,2.3,BACK-.04);
  box(1.8,.8,.8,0x8a6a45,2.6,.4,-3.2);box(1.9,.06,.9,0x6b4a2b,2.6,.82,-3.2);
  panel(.6,.6,(x,w,h)=>{x.fillStyle='#fff';x.beginPath();x.arc(w/2,h/2,w/2-6,0,7);x.fill();x.strokeStyle='#222';x.lineWidth=8;x.stroke();const d=new Date(),a=(d.getHours()%12+d.getMinutes()/60)/12*6.283,b=d.getMinutes()/60*6.283;x.lineWidth=10;x.beginPath();x.moveTo(w/2,h/2);x.lineTo(w/2+Math.sin(a)*70,h/2-Math.cos(a)*70);x.stroke();x.lineWidth=6;x.beginPath();x.moveTo(w/2,h/2);x.lineTo(w/2+Math.sin(b)*110,h/2-Math.cos(b)*110);x.stroke()},4.8,2.9,BACK,0,true);
  box(.4,2,1.8,0x8a6a45,LEFT+.25,1,-2.6);for(let i=0;i<4;i++)for(let j=0;j<5;j++)box(.25,.32,.12,[0xc0392b,0x2e86c1,0x27ae60,0xf1c40f][(i+j)%4],LEFT+.3,.4+i*.45,-3.3+j*.3);
  panel(1.6,1,(x,w,h)=>{x.fillStyle='#bfe3ff';x.fillRect(0,0,w,h);x.fillStyle='#7dbb6e';[[60,80,120,90],[220,60,90,120],[330,110,120,140],[90,200,80,80]].forEach(([a,b,cw,ch])=>{x.beginPath();x.ellipse(a+cw/2,b+ch/2,cw/2,ch/2,0,0,7);x.fill()});text(x,'WORLD',26,h-20,{color:'#1d3b57'})},LEFT+.05,2.2,1.6,Math.PI/2);
  label('🏫 School day · timetable & grades',-3.6,3.35,BACK+.2,'interactive',()=>window.ChinaLifeSchool?.open())}
 if(kind==='restaurant'){
  // Dining room: clothed tables with plates, red lanterns, a menu board and a pass counter.
  for(const [x,z] of [[-4.6,-2.6],[-4.6,.6],[4.6,.6]]){cylinder(.6,.06,0xf8f1e4,x,.85,z,root,16);cylinder(.08,.8,0x6b4a2b,x,.42,z);for(const a of [0,2.1,4.2])cylinder(.14,.02,0xffffff,x+Math.cos(a)*.35,.89,z+Math.sin(a)*.35,root,12)}
  for(const x of [-4,-1.3,1.3,4]){cylinder(.01,.6,0x222222,x,3.1,-1);mesh(new THREE.SphereGeometry(.28,10,8),0xd22b2b,x,2.65,-1);cylinder(.12,.06,0xd9b24a,x,2.92,-1);cylinder(.12,.06,0xd9b24a,x,2.38,-1)}
  panel(1.8,1.2,(x,w,h)=>{x.fillStyle='#2b1a12';x.fillRect(0,0,w,h);text(x,'TODAY · 今日菜单',24,44,{color:'#ffcf5a'});['Jollof rice  ¥38','Suya skewers  ¥26','Dumplings  ¥18','Jianbing  ¥8','Chapman  ¥15'].forEach((l,i)=>text(x,l,22,92+i*40,{color:'#f8f1e4',weight:600}))},3.8,2.4,BACK);
  box(3.2,1.05,.6,0x6b4a2b,3.8,.53,BACK+1);box(3.3,.06,.7,0xd9b24a,3.8,1.08,BACK+1)}
 if(kind==='airport'){
  // Terminal: departures board, check-in desks, a luggage belt, gate seats and a big window with a plane.
  const cities=['Beijing','Shanghai','Guangzhou','Shenzhen','Chengdu','Harbin','Lagos','Accra','Nairobi','Dubai'];let off=0;
  const board=panel(3.6,1.6,(x,w,h)=>{x.fillStyle='#0b0f14';x.fillRect(0,0,w,h);text(x,'DEPARTURES · 出发',24,36,{color:'#ffd34d'});const now=new Date();for(let i=0;i<6;i++){const cty=cities[(i+off)%cities.length],t=new Date(now.getTime()+(i+1)*25*60000),st=i===0?'BOARDING':i===1?'GATE OPEN':'ON TIME';text(x,String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'),18,72+i*32,{color:'#e8f3ee',weight:600});text(x,'CL'+(100+((i+off)*37)%900)+'  '+cty,18,72+i*32,{color:'#e8f3ee',weight:700,x:110});text(x,st,18,72+i*32,{color:i===0?'#38f59a':'#ffd34d',weight:800,align:'right',x:w-20})}},-3.4,2.6,BACK,0,true);
  timers.push(setInterval(()=>{off++;board.userData.paint()},9000));
  for(const x of [2.2,4,5.8]){box(1.4,1,.6,0x3c5a73,x,.5,BACK+1.1);box(1.5,.06,.7,0xcfd8dc,x,1.03,BACK+1.1);box(.5,.35,.04,0x101820,x,1.3,BACK+.85)}
  box(.8,.4,4.4,0x2b2b2b,LEFT+.6,.2,1.2);for(let i=0;i<4;i++)box(.45,.32,.6,[0x8e44ad,0x16a085,0xd35400,0x2c3e50][i],LEFT+.6,.56,-.4+i*1.1);
  for(let i=0;i<5;i++){box(.5,.45,.5,0x5d6d7e,-1+i*.6,.23,3.6);box(.5,.5,.1,0x5d6d7e,-1+i*.6,.6,3.85)}
  panel(2.6,1.3,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#7ec8ff');g.addColorStop(1,'#d8f0ff');x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='#fff';x.beginPath();x.ellipse(w*.5,h*.55,w*.32,h*.08,0,0,7);x.fill();x.beginPath();x.moveTo(w*.45,h*.55);x.lineTo(w*.6,h*.25);x.lineTo(w*.66,h*.25);x.lineTo(w*.58,h*.55);x.fill();x.beginPath();x.moveTo(w*.2,h*.55);x.lineTo(w*.22,h*.36);x.lineTo(w*.27,h*.36);x.lineTo(w*.3,h*.55);x.fill();x.fillStyle='#e0263b';x.fillRect(w*.3,h*.52,w*.4,h*.03)},LEFT+.05,2.2,-2.4,Math.PI/2);
  label('✈️ Flights',-2.4,3.6,BACK+.2,'interactive',()=>game.flights?.())}
 return {tick(){},keep,dispose(){timers.forEach(clearInterval);for(const d of disposers)d.dispose()},kind};
}
export function kindOf(game,id){
 if(id==='gist')return 'gist';
 if(id==='cityhospital'||id==='hospital')return 'hospital';
 if(id==='airport')return 'airport';
 if(game.isClassroom?.(id))return 'school';
 if(game.cityContent?.restaurants?.some(r=>r.id===id))return 'restaurant';
 return null}
