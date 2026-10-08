import * as THREE from './vendor/three.module.js';
// Fills the empty half of every city block with towers, houses or apartments, adds river
// embankments and boats, and builds the cars that drive the map. Everything is fictional.
const mats=new Map();
function mat(color,map){const key=color+(map?'|'+map.uuid:'');if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,map:map||null,roughness:.7,metalness:map?.15:0}));return mats.get(key)}
function box(g,w,h,d,color,x,y,z,map){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,map));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
const seeded=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v)};

let windowTexture;
function windows(){
 if(windowTexture)return windowTexture;
 const c=document.createElement('canvas');c.width=64;c.height=64;const ctx=c.getContext('2d');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,64,64);
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){ctx.fillStyle=(x+y*3)%5===0?'#fff4c8':'#9fb8c6';ctx.fillRect(x*16+3,y*16+4,10,9)}
 windowTexture=new THREE.CanvasTexture(c);windowTexture.wrapS=windowTexture.wrapT=THREE.RepeatWrapping;return windowTexture;
}
const glass=[0x6f9bb3,0x7fb0b5,0x8c9fb8,0xb7a98c,0x5f8aa6];
export function tower(seed,short=false){
 const g=new THREE.Group(),h=short?3+Math.round(seeded(seed)*2):7+Math.round(seeded(seed)*11),w=3.2+seeded(seed+1)*1.2,color=glass[seed%glass.length];
 const tex=windows().clone();tex.needsUpdate=true;tex.repeat.set(Math.round(w),Math.round(h/1.4));
 box(g,w+.8,1,w+.8,0xd9dcd6,0,.5,0);
 box(g,w,h,w,color,0,1+h/2,0,tex);
 if(!short&&seeded(seed+2)>.45){box(g,w*.7,h*.3,w*.7,color,0,1+h+h*.15,0,tex);box(g,.12,2,.12,0x9aa7ad,0,1+h*1.3+1,0)}
 else box(g,w+.2,.35,w+.2,0x3f5662,0,1+h+.18,0);
 g.userData.kind='tower';return g;
}
const houseWalls=[0xf1e3c8,0xe7d2b3,0xf4efe6,0xd9b99b,0xe9ddd0],houseRoofs=[0x9b4a3c,0x5a6c75,0x7a5a43,0xb0603f];
export function house(seed){
 const g=new THREE.Group(),wall=houseWalls[seed%houseWalls.length],roof=houseRoofs[seed%houseRoofs.length];
 box(g,3.4,1.9,2.8,wall,0,.95,0);
 const top=new THREE.Mesh(new THREE.ConeGeometry(2.6,1.3,4),mat(roof));top.position.set(0,2.55,0);top.rotation.y=Math.PI/4;top.scale.set(1,1,.82);top.castShadow=true;g.add(top);
 box(g,.6,1,.05,0x6b4a35,0,.5,1.42);for(const x of [-1,1])box(g,.6,.5,.05,0xa9cbd6,x,1.2,1.42);
 box(g,4.2,.06,3.8,0x8fb878,0,.03,.4);for(const x of [-1.9,1.9])box(g,.08,.45,3.8,0xf3efe4,x,.22,.4);
 g.userData.kind='house';return g;
}
const carColors=[0xd8443c,0xf4f2ee,0x23303a,0x3d6fb6,0x9aa5ad,0x2e7d5b];
export function car(kind='sedan',seed=0){
 const g=new THREE.Group();
 if(kind==='bus'){box(g,4.4,1.5,1.4,0xe9eef0,0,1,0);box(g,4.2,.45,1.42,0x2b5c7a,0,1.25,0);box(g,4.42,.18,1.42,0x1aa58f,0,.45,0)}
 else{
  const color=kind==='taxi'?0xf2b632:carColors[seed%carColors.length],tall=kind==='suv';
  box(g,2.5,tall?.7:.55,1.2,color,0,tall?.6:.52,0);
  box(g,1.35,tall?.55:.48,1.08,0x2c3e4c,-.1,tall?1.22:1.04,0);
  box(g,1.25,.06,1.12,color,-.1,tall?1.52:1.3,0);
  for(const z of [-.42,.42]){box(g,.06,.14,.22,0xfff6d0,1.26,.6,z);box(g,.06,.12,.22,0xd5332f,-1.26,.6,z)}
  if(kind==='taxi')box(g,.5,.18,.3,0xffffff,-.1,1.42,0);
 }
 const length=kind==='bus'?1.6:.8;
 for(const x of [-length,length])for(const z of [-.62,.62]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.16,12),mat(0x1e2a33));w.rotation.x=Math.PI/2;w.position.set(x,.27,z);g.add(w)}
 g.userData.kind='car';return g;
}
function boat(seed){const g=new THREE.Group();box(g,2.6,.35,1,seed%2?0xffffff:0xc8463a,0,.18,0);box(g,1,.5,.8,0xe9eef0,-.3,.6,0);box(g,.9,.12,.05,0x2c3e4c,-.3,.7,.42);g.userData.kind='boat';return g}

// Free spots are in the half of each block that venues and the residential rows leave empty.
export function skyline(layout,blocked){
 const group=new THREE.Group(),kinds={'Business district':'tower','City centre':'tower','Shopping district':'tower','Residential quarter':'house','City gardens':'house','Riverside gardens':'house','Tianhe CBD':'tower','Zhujiang New Town':'tower','Yuexiu · City centre':'tower','Baiyun':'house','Liwan riverside':'house'};
 group.userData.kind='skyline';
 for(let i=0;i<4;i++)for(let j=0;j<3;j++){
  const cx=(layout.xs[i]+layout.xs[i+1])/2,cz=(layout.zs[j]+layout.zs[j+1])/2,district=layout.districts[j*4+i],kind=kinds[district?.name]||'apartment';
  for(const dx of [-9,-3,3,9])for(const dz of [3,9]){
   const x=cx+dx,z=cz+dz,seed=i*31+j*17+dx*3+dz;
   if(blocked.some(([bx,bz,r])=>Math.hypot(bx-x,bz-z)<r))continue;
   // Tall towers would hide venues in the isometric view, so those stay mid-rise.
   // The camera looks across x+z, so a tower covers a venue that is behind it (smaller x+z) on the same screen column (x-z).
   const nearVenue=Object.values(layout.positions).some(([vx,vz])=>Math.abs((x-z)-(vx-vz))<9&&(x+z)-(vx+vz)>0&&(x+z)-(vx+vz)<34);
   const asset=kind==='tower'?tower(seed,nearVenue):kind==='house'?house(seed):null;
   if(!asset){group.userData.apartments=(group.userData.apartments||[]).concat([[x,z,seed]]);continue}
   asset.position.set(x,0,z);asset.rotation.y=kind==='house'&&dz>5?Math.PI:0;group.add(asset);
  }
 }
 // Stone embankments keep the river readable between the road and the riverside blocks.
 for(const dz of [-2.15,2.15])box(group,144,.3,.3,0xb9b2a3,0,.2,layout.riverZ+dz);
 return group;
}
export function vehicles(layout){
 const list=[];let n=0;
 const kinds=['taxi','sedan','suv','sedan','taxi','bus','sedan','suv'];
 for(const x of layout.xs)for(const direction of [1,-1]){const kind=kinds[n%kinds.length];list.push({body:car(kind,n),axis:'z',lane:x+direction*.95,p:-44+((n*23)%88),direction,speed:kind==='bus'?3:4+(n%3),limit:52,y:.05});n++}
 for(const z of layout.zs)for(const direction of [1,-1]){const kind=kinds[n%kinds.length];list.push({body:car(kind,n),axis:'x',lane:z+direction*.95,p:-60+((n*37)%120),direction,speed:kind==='bus'?3:4+(n%3),limit:68,y:.05});n++}
 for(let k=0;k<3;k++)list.push({body:boat(k),axis:'x',lane:layout.riverZ+(k%2?.7:-.7),p:-60+k*45,direction:k%2?-1:1,speed:1.4,limit:72,y:.08});
 return list;
}
export function moveVehicle(v,dt,moving){
 if(moving)v.p+=dt*v.direction*v.speed;
 if(v.p>v.limit)v.p=-v.limit;if(v.p<-v.limit)v.p=v.limit;
 if(v.axis==='z'){v.body.position.set(v.lane,v.y,v.p);v.body.rotation.y=v.direction>0?-Math.PI/2:Math.PI/2}
 else{v.body.position.set(v.p,v.y,v.lane);v.body.rotation.y=v.direction>0?0:Math.PI}
}

// A passenger jet pointing along +x: rounded fuselage, swept wings, engines, tail fin and a window stripe.
export function jet(livery=0x1f6fb5){
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,4.2,6,14),mat(0xf4f6f7));body.rotation.z=Math.PI/2;body.position.y=.9;body.castShadow=true;g.add(body);
 box(g,4.1,.12,.86,livery,0,.72,0);box(g,3.8,.1,.88,0x2c3e4c,.2,1.08,0);
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.42,14,10),mat(0xf4f6f7));nose.scale.set(1.4,1,1);nose.position.set(2.5,.9,0);g.add(nose);
 for(const side of [-1,1]){const wing=box(g,1.5,.1,2.8,0xdfe5e8,-.1,.72,side*1.6);wing.rotation.y=side*.32;const eng=new THREE.Mesh(new THREE.CylinderGeometry(.2,.22,.8,12),mat(0x9aa7ad));eng.rotation.z=Math.PI/2;eng.position.set(.15,.5,side*1.25);g.add(eng);const stab=box(g,.7,.08,1.2,0xdfe5e8,-2.3,1.05,side*.7);stab.rotation.y=side*.35}
 box(g,.9,1.1,.1,livery,-2.3,1.6,0);
 g.userData.kind='jet';return g;
}
// The airfield beside the airport venue: runway, taxiway, terminal, tower, parked jets,
// one jet that keeps taking off and landing, and another crossing the sky.
export function airfield(layout){
 const g=new THREE.Group(),planes=[],[ax]=layout.positions.airport,runZ=74,x0=ax-36,x1=ax+24;g.userData.kind='airfield';
 box(g,x1-x0+12,.12,30,0xb9c4bf,(x0+x1)/2,-.04,70);
 box(g,x1-x0+4,.06,4.4,0x3b4650,(x0+x1)/2,.05,runZ);for(let x=x0+4;x<x1;x+=4)box(g,1.8,.02,.16,0xf3f1e6,x,.09,runZ);for(const dz of [-1.9,1.9])box(g,x1-x0+4,.02,.1,0xf3f1e6,(x0+x1)/2,.09,runZ+dz);
 for(const x of [x0+1,x1-1])for(let k=-1.5;k<=1.5;k+=.75)box(g,.5,.02,.3,0xf3f1e6,x,.09,runZ+k);
 box(g,x1-x0-6,.06,2.2,0x4a5560,(x0+x1)/2,.05,runZ-6);for(const x of [x0+6,x1-6])box(g,2.2,.06,6,0x4a5560,x,.05,runZ-3);
 box(g,26,2.6,4,0xe9eef0,ax-6,1.3,60);box(g,26.2,1.4,4.1,0x6f9bb3,ax-6,1.9,60.02);box(g,27,.3,4.8,0x2f4656,ax-6,2.75,60);
 box(g,1.4,6,1.4,0xe9eef0,ax+14,3,61);box(g,2.6,1.2,2.6,0x6f9bb3,ax+14,6.4,61);box(g,2.9,.25,2.9,0x2f4656,ax+14,7.1,61);
 const liveries=[0xc8102e,0x1f6fb5,0x0f8a7e];[-16,-6,4].forEach((dx,i)=>{const p=jet(liveries[i]);p.position.set(ax+dx,0,65.5);p.rotation.y=-Math.PI/2;g.add(p);box(g,.5,.5,2.8,0xd7dde0,ax+dx,1.2,63)});
 // Take off, climb away, then land again on the same runway (seconds per cycle: 26).
 const hop=jet(0x0f8a7e);g.add(hop);planes.push({body:hop,update(t){const c=t%26;let x,y=0,z=runZ,pitch=0;if(c<6){const u=c/6;x=x0+2+(x1-x0-4)*u*u;y=u>.7?(u-.7)*3:0;pitch=u>.7?.12:0}else if(c<11){const u=(c-6)/5;x=x1+u*40;y=1+u*18;pitch=.18}else if(c<15){x=1e4}else if(c<21){const u=(c-15)/6;x=x0-40+u*40;y=18*(1-u)+.0;pitch=-.1}else{const u=(c-21)/5,e=1-(1-u)*(1-u);x=x0+(x1-x0-8)*e;y=0;pitch=0}hop.visible=x<1e3;hop.position.set(x,y,z);hop.rotation.set(0,0,pitch)}});
 // A cruising jet crosses the whole city high above it.
 const cruise=jet(0xc8102e);cruise.scale.setScalar(.8);g.add(cruise);planes.push({body:cruise,update(t){const c=(t%40)/40;cruise.position.set(-120+240*c,22,-30+c*20);cruise.rotation.set(0,-.08,0)}});
 return {group:g,planes};
}
