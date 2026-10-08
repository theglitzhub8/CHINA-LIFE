import * as THREE from './vendor/three.module.js';
// Shenyang City Centre prototype: Hafrik Square, Heping Grand Hotel, Black Sheep and the streets around them.
// This block is the visual benchmark for the rest of the map. Everything is generated (no downloaded assets):
// canvas facade textures shared across buildings, one sign atlas for every shop sign, and instanced street
// furniture, so the extra detail stays cheap on phones once static meshes are merged by world.js.
export const CENTRE={x0:-34,x1:0,z0:-16,z1:16,cx:-17,cz:0};

const mats=new Map();
function mat(key,make){if(!mats.has(key))mats.set(key,make());return mats.get(key)}
const solid=(color,rough=.8,metal=0)=>mat('c'+color+rough+metal,()=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal}));
const glow=color=>mat('g'+color,()=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.9,roughness:.4}));
function box(parent,w,h,d,material,x,y,z,ry=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.rotation.y=ry;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cyl(parent,r1,r2,h,material,x,y,z,seg=14){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// ---- Canvas textures: facades are drawn once and tiled, so a tall tower and a small shop share materials. ----
function canvasTexture(w,h,draw,repeat=true){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping}t.anisotropy=4;return t}
// Night windows: an emissive map holding only the cool, dark window panes of a facade, so at night windows glow
// and walls (brick, tile, stone) stay dark. world.js sets the emissive strength from the time of day.
function windowMask(source,key=''){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');try{if(/^(paving|sidewalk)/.test(key)){g.fillStyle='#000';g.fillRect(0,0,128,128);throw 0}
 // Glass curtain walls: only some panes are lit, so towers read as offices at night rather than lanterns.
 if(key.startsWith('glass')){g.fillStyle='#000';g.fillRect(0,0,128,128);g.fillStyle='#fff';g.fillRect(10,14,46,38);g.fillStyle='#777';g.fillRect(70,70,48,40);throw 0}
 g.drawImage(source,0,0);const img=g.getImageData(0,0,128,128),d=img.data;for(let i=0;i<d.length;i+=4){const r=d[i],gr=d[i+1],b=d[i+2],lum=(r*.3+gr*.59+b*.11)/255,win=b>r+8&&lum<.62;d[i]=d[i+1]=d[i+2]=win?255:0;d[i+3]=255}g.putImageData(img,0,0)}catch{}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
const textured=(key,draw,tint=0xffffff)=>mat('t'+key,()=>{const map=canvasTexture(128,128,draw),m=new THREE.MeshStandardMaterial({map,color:tint,roughness:.75,emissive:0x000000,emissiveMap:windowMask(map.image,key)});m.userData.facade=true;return m});
// One tile = one window bay and one storey.
const FACADES={
 glass:g=>{const grd=g.createLinearGradient(0,0,128,128);grd.addColorStop(0,'#5d93b8');grd.addColorStop(1,'#2d5f86');g.fillStyle=grd;g.fillRect(0,0,128,128);g.fillStyle='#9fd0ec55';g.fillRect(8,8,52,104);g.fillStyle='#1d3f5a';g.fillRect(0,0,128,6);g.fillRect(0,0,5,128);g.fillRect(62,0,4,128)},
 resi:g=>{g.fillStyle='#ece5d6';g.fillRect(0,0,128,128);g.fillStyle='#d9d0bd';g.fillRect(0,100,128,28);g.fillStyle='#4b6577';g.fillRect(18,22,40,58);g.fillRect(72,22,38,58);g.fillStyle='#f6d58a';g.fillRect(72,22,38,24);g.fillStyle='#c9c2b3';g.fillRect(12,82,104,8);g.fillStyle='#8f9aa0';for(let x=14;x<116;x+=8)g.fillRect(x,70,2,14)},
 brick:g=>{g.fillStyle='#8e4a34';g.fillRect(0,0,128,128);g.strokeStyle='#6e3524';g.lineWidth=2;for(let y=0;y<128;y+=10){g.beginPath();g.moveTo(0,y);g.lineTo(128,y);g.stroke();for(let x=(y/10)%2?0:16;x<128;x+=32){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+10);g.stroke()}}g.fillStyle='#2c3a42';g.fillRect(30,26,68,64);g.fillStyle='#f0c27a';g.fillRect(36,32,26,26);g.fillStyle='#e9dccb';g.fillRect(26,90,76,8)},
 shop:g=>{g.fillStyle='#e8dcc4';g.fillRect(0,0,128,128);g.fillStyle='#3d566a';g.fillRect(20,24,88,56);g.fillStyle='#a9c9dc';g.fillRect(24,28,38,48);g.fillStyle='#b9a98c';g.fillRect(14,82,100,10);g.fillStyle='#d5c8ae';g.fillRect(0,110,128,18)},
 stone:g=>{g.fillStyle='#d8cdb8';g.fillRect(0,0,128,128);g.fillStyle='#c4b79e';g.fillRect(0,0,128,4);g.fillRect(0,0,4,128);g.fillStyle='#3f5466';g.fillRect(22,18,84,76);g.fillStyle='#8fb5cc';g.fillRect(26,22,36,68);g.fillStyle='#bfb197';g.fillRect(16,96,96,8)},
 office:g=>{g.fillStyle='#bcc8cf';g.fillRect(0,0,128,128);g.fillStyle='#2f4d63';g.fillRect(6,10,116,84);g.fillStyle='#7fb2d1';g.fillRect(10,14,52,76);g.fillStyle='#e2e8ea';g.fillRect(0,96,128,12)},
 paving:g=>{g.fillStyle='#d9d2c4';g.fillRect(0,0,128,128);g.fillStyle='#cbc3b2';for(let x=0;x<128;x+=32)for(let y=0;y<128;y+=32)if((x+y)/32%2)g.fillRect(x,y,32,32);g.strokeStyle='#bfb6a4';g.lineWidth=2;for(let i=0;i<=128;i+=32){g.beginPath();g.moveTo(i,0);g.lineTo(i,128);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(128,i);g.stroke()}},
 sidewalk:g=>{g.fillStyle='#c9ccc7';g.fillRect(0,0,128,128);g.strokeStyle='#b4b8b2';g.lineWidth=2;for(let i=0;i<=128;i+=42.6){g.beginPath();g.moveTo(i,0);g.lineTo(i,128);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(128,i);g.stroke()}}};
// A box whose texture repeats every tileW x tileH world units on every face (so windows keep their size).
function facade(parent,w,h,d,style,x,y,z,tileW=1.6,tileH=1.15,tint){const geo=new THREE.BoxGeometry(w,h,d),uv=geo.attributes.uv,sizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*sizes[f][0]/tileW,uv.getY(i)*sizes[f][1]/tileH)}const m=new THREE.Mesh(geo,textured(style+(tint||''),FACADES[style],tint));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
// Roofs: a cap, a parapet and rooftop plant (AC units, water tanks) so skylines read as real buildings.
function roof(parent,w,d,x,y,z,color=0x6f7c84,seed=0){box(parent,w+.15,.18,d+.15,solid(color),x,y+.09,z);box(parent,w+.15,.35,.14,solid(0xd9d4c8),x,y+.3,z-d/2);box(parent,w+.15,.35,.14,solid(0xd9d4c8),x,y+.3,z+d/2);box(parent,.14,.35,d,solid(0xd9d4c8),x-w/2,y+.3,z);box(parent,.14,.35,d,solid(0xd9d4c8),x+w/2,y+.3,z);
 if(w>2.2&&d>2.2){box(parent,w*.3,.5,d*.25,solid(0xb8c0c4),x-w*.18,y+.43,z+((seed%2)?d*.18:-d*.18));cyl(parent,.32,.32,.7,solid(0x8aa1ad),x+w*.25,y+.53,z-d*.2,10)}}

// ---- One shared sign atlas: every bilingual sign in the district is one material, so they merge into one draw call. ----
const SIGNS=[['哈弗里克广场','HAFRIK SQUARE','#f2b632','#10283a'],['和平大酒店','HEPING GRAND HOTEL','#f6e3b0','#6e1b1b'],['黑羊餐吧','BLACK SHEEP','#f3ead9','#1b1b1b'],['便利店','24H MART','#ffffff','#2f8a57'],['咖啡','COFFEE','#fff5e6','#6b4630'],['奶茶','BUBBLE TEA','#ffffff','#d0517a'],['书店','BOOKS','#10283a','#f2d36b'],['药店','PHARMACY','#ffffff','#1f8d84'],['和平影城','CINEMA','#ffe27a','#3b1f5c'],['和平商务中心','HEPING CENTRE','#ffffff','#1e4c73'],['公交 和平广场站','BUS · HEPING SQ','#ffffff','#1d6fb8'],['地铁 2号线','METRO LINE 2','#ffffff','#c8102e'],['火锅','HOT POT','#ffe9c7','#b22222'],['欢迎来到沈阳','WELCOME TO SHENYANG','#ffffff','#c8102e'],['和平','HEPING','#f2b632','#10283a'],['银行','BANK','#ffffff','#7a5c1e']];
const signIndex=Object.fromEntries(SIGNS.map((s,i)=>[s[1],i]));
const ROWS=16,signMat=()=>mat('signs',()=>{const tex=canvasTexture(1024,128*ROWS,(g,w)=>{SIGNS.forEach(([zh,en,fg,bg],i)=>{const y=i*128;g.fillStyle=bg;g.fillRect(0,y,w,128);g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';g.font='900 54px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif';g.fillText(zh,w/2,y+44);g.font='800 34px Manrope,system-ui,sans-serif';g.fillText(en,w/2,y+96)})},false);return new THREE.MeshBasicMaterial({map:tex})});
function sign(parent,en,w,h,x,y,z,ry=0){const i=signIndex[en],geo=new THREE.PlaneGeometry(w,h),uv=geo.attributes.uv;for(let k=0;k<uv.count;k++)uv.setY(k,1-(i+1)/ROWS+uv.getY(k)/ROWS);const m=new THREE.Mesh(geo,signMat());m.position.set(x,y,z);m.rotation.y=ry;parent.add(m);return m}

// ---- Instanced street furniture: hundreds of parts, a handful of draw calls. ----
function instances(parent,geo,material,items,cast=true){if(!items.length)return;const m=new THREE.InstancedMesh(geo,material,items.length),o=new THREE.Object3D();items.forEach((it,i)=>{o.position.set(it[0],it[1],it[2]);o.rotation.set(0,it[3]||0,0);o.scale.setScalar(it[4]||1);o.updateMatrix();m.setMatrixAt(i,o.matrix)});m.castShadow=cast;m.receiveShadow=true;parent.add(m)}

// ---- Venue landmarks (built around their own origin; world.js places them at the venue position). ----
function hafrikSquare(){const g=new THREE.Group();g.userData.kind='plaza';
 const pave=textured('paving',FACADES.paving),disc=new THREE.Mesh(new THREE.CylinderGeometry(6.4,6.4,.12,40),pave);disc.position.y=.12;disc.receiveShadow=true;g.add(disc);
 for(const r of [4.2,5.6]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.12,6,48),solid(0xb9ab92));ring.rotation.x=Math.PI/2;ring.position.y=.2;g.add(ring)}
 // Fountain: three tiers and glowing water.
 cyl(g,2.3,2.5,.5,solid(0xcfc6b5),0,.4,0,32);const water=cyl(g,2.05,2.05,.1,mat('water',()=>new THREE.MeshStandardMaterial({color:0x5fb7d9,emissive:0x2a7fa6,emissiveIntensity:.35,roughness:.15,metalness:.1})),0,.66,0,32);water.castShadow=false;
 cyl(g,.9,1.1,.5,solid(0xcfc6b5),0,.95,0,20);cyl(g,.75,.75,.08,solid(0x7fc8e3),0,1.22,0,20);cyl(g,.28,.38,1.1,solid(0xd9d0bf),0,1.7,0,12);cyl(g,.5,.5,.1,solid(0x9ad4ea),0,2.25,0,16);
 // LED screen and Hafrik sign on the north side of the square.
 box(g,6.2,3.4,.35,solid(0x23303a),0,3.2,-5.4);sign(g,'HAFRIK SQUARE',5.8,1.6,0,3.95,-5.21);sign(g,'WELCOME TO SHENYANG',5.8,1.2,0,2.55,-5.21);for(const x of [-2.8,2.8])box(g,.3,1.6,.3,solid(0x23303a),x,.8,-5.4);
 // Planters with trees, benches and flag poles.
 for(const [x,z] of [[-4.6,-3.4],[4.6,-3.4],[-4.6,3.6],[4.6,3.6]]){box(g,1.6,.5,1.6,solid(0x9c8a6e),x,.45,z);cyl(g,.12,.16,1.2,solid(0x6d5236),x,1.3,z,8);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,0),solid(0x4f8f57));crown.position.set(x,2.35,z);crown.castShadow=true;g.add(crown);box(g,1.9,.12,.5,solid(0x7d5a3c),x+(x<0?1.8:-1.8),.42,z)}
 for(const x of [-1.6,0,1.6]){cyl(g,.05,.05,4.6,solid(0xd9dde0,.4,.6),x,2.3,5.6,8);box(g,.9,.55,.02,solid(x?0xc8102e:0xf2b632),x+.47,4.25,5.6)}
 return g}
function hepingHotel(){const g=new THREE.Group();g.userData.kind='hotel';
 facade(g,7,3.2,7,'stone',0,1.6,0,1.75,1.6);roof(g,7,7,0,3.2,0,0x8b7f6d,1);
 // Entrance canopy with columns and a drop-off on the plaza side.
 box(g,.9,.25,4.6,solid(0xf2b632,.5,.3),3.95,2.4,-.6);for(const z of [-2.6,1.4])cyl(g,.12,.12,2.3,solid(0xe6dcc8),4.3,1.15,z,10);sign(g,'HEPING GRAND HOTEL',4.4,.95,3.52,2.95,-.6,Math.PI/2);
 // Tower with two setbacks and a lit crown.
 facade(g,5.2,12,5.2,'glass',.6,9.2,.6,1.3,1.1);facade(g,4.4,6,4.4,'glass',.6,18.2,.6,1.3,1.1);facade(g,3.4,3.2,3.4,'glass',.6,22.8,.6,1.3,1.1);
 for(const [w,y] of [[5.5,15.25],[4.7,21.25]])box(g,w,.3,w,solid(0xf2b632,.4,.4),.6,y,.6);
 box(g,3.7,.35,3.7,solid(0xf2b632,.4,.5),.6,24.55,.6);box(g,1.2,1.6,1.2,glow(0xffd36b),.6,25.5,.6);cyl(g,.06,.06,2.6,solid(0xdddddd,.3,.7),.6,27.2,.6,6);
 sign(g,'HEPING GRAND HOTEL',3.2,.85,.6,22.9,2.32);sign(g,'HEPING GRAND HOTEL',3.2,.85,2.32,22.9,.6,Math.PI/2);
 for(const z of [2,2.8,3.6])cyl(g,.04,.04,3.2,solid(0xd9dde0,.4,.6),3.8,1.6,z,6);
 return g}
function blackSheep(){const g=new THREE.Group();g.userData.kind='black-sheep';
 facade(g,7,4.6,5,'brick',0,2.3,0,1.75,2.3);roof(g,7,5,0,4.6,0,0x3a3330,0);
 // Wooden shopfront, black awning, sign and a terrace with umbrellas and string lights.
 box(g,6.4,1.9,.12,solid(0x4b3427,.7),0,1.05,2.55);for(const x of [-2.2,0,2.2])box(g,1.8,1.4,.06,mat('shopglass',()=>new THREE.MeshStandardMaterial({color:0xf3cf8b,emissive:0xb87a2c,emissiveIntensity:.45,roughness:.2})),x,1.1,2.63);
 box(g,6.8,.12,1.3,solid(0x1c1c1c),0,2.25,3.1);sign(g,'BLACK SHEEP',3.6,.9,0,3.05,2.56);
 for(const [x,z] of [[-2.3,3.9],[0,4.1],[2.3,3.9]]){cyl(g,.45,.45,.06,solid(0x5a4232),x,.75,z,12);cyl(g,.05,.05,.75,solid(0x2b2b2b),x,.38,z,6);cyl(g,.03,.03,1.9,solid(0x2b2b2b),x,1.5,z,6);const umb=new THREE.Mesh(new THREE.ConeGeometry(1.15,.5,8),solid(x?0xf2ead9:0x1c1c1c));umb.position.set(x,2.5,z);umb.castShadow=true;g.add(umb)}
 for(let i=0;i<9;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),glow(0xffd58a));b.position.set(-3.2+i*.8,2.15-Math.sin(i/8*Math.PI)*.25,3.75);g.add(b)}
 return g}

// ---- The block: paving, sidewalks, buildings, street furniture and the four corner intersections. ----
export function buildCityCentre(){const g=new THREE.Group();g.userData.kind='city-centre';const {x0,x1,z0,z1,cx,cz}=CENTRE;
 // Raised sidewalk slab with a granite kerb, then plaza paving around the square.
 const walk=new THREE.Mesh(new THREE.BoxGeometry(29.4,.2,27.4),textured('sidewalk',FACADES.sidewalk));{const uv=walk.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*29.4/2.4,uv.getY(i)*27.4/2.4)}walk.position.set(cx,.1,cz);walk.receiveShadow=true;g.add(walk);
 for(const [w,d,x,z] of [[29.6,.3,cx,z0+2.2],[29.6,.3,cx,z1-2.2],[.3,27.6,x0+2.2,cz],[.3,27.6,x1-2.2,cz]])box(g,w,.26,d,solid(0xa7aaa6),x,.13,z);
 // North shophouse row: four 3-4 storey shophouses with bilingual signs and awnings facing the street.
 const shops=[['24H MART',0x2f8a57,4],['COFFEE',0x6b4630,3],['BUBBLE TEA',0xd0517a,4]];shops.forEach(([en,awning,floors],i)=>{const x=-22.9+i*5.05,z=-11,h=1.4+floors*1.15;facade(g,4.8,h-1.4,4.6,i%2?'resi':'shop',x,1.4+(h-1.4)/2,z,1.2,1.15);box(g,4.8,1.4,4.6,solid(0xe9e2d3),x,.7,z);box(g,4.2,1.05,.08,mat('shopglass2',()=>new THREE.MeshStandardMaterial({color:0xcfe6ef,emissive:0x8fb9c9,emissiveIntensity:.25,roughness:.15})),x,.65,z+2.32);box(g,4.6,.12,1.1,solid(awning),x,1.45,z+2.85);sign(g,en,3.9,.8,x,1.95,z+2.33);roof(g,4.8,4.6,x,h,z,0x7d6a5c,i);for(let f=0;f<floors-1;f++)box(g,.5,.35,.3,solid(0xdfe3e4),x+1.6,2.2+f*1.15,z+2.45)});
 // North-east: Heping Centre office tower. East: cinema with a lit marquee. West: residential tower. South: bank and hot pot.
 facade(g,5.6,22,5.6,'office',-28.8,11,-10.6,1.4,1.3);roof(g,5.6,5.6,-28.8,22,-10.6,0x55636b,2);box(g,5.9,.4,5.9,solid(0x1e4c73,.4,.4),-28.8,22.6,-10.6);sign(g,'HEPING CENTRE',4.8,1.15,-28.8,20.6,-7.78);sign(g,'HEPING CENTRE',4.8,1.15,-25.98,20.6,-10.6,Math.PI/2);
 facade(g,6,6,6.4,'office',-5.8,3,.6,1.5,1.2,0xe3d6f0);roof(g,6,6.4,-5.8,6,.6,0x5a4a6a,3);sign(g,'CINEMA',4.8,1.3,-5.8,4.6,3.81);box(g,5.2,.45,.3,glow(0xffcf5a),-5.8,3.65,3.95);sign(g,'CINEMA',4.8,1.3,-2.79,4.6,.6,Math.PI/2);
 facade(g,4.6,17.2,5.6,'resi',-29.2,8.6,.4,1.53,1.15);roof(g,4.6,5.6,-29.2,17.2,.4,0xb4423a,4);box(g,4.9,1.2,5.9,solid(0xb4423a),-29.2,18,.4);for(let f=1;f<15;f+=2)box(g,.6,.3,5.7,solid(0xe4ddcf),-26.75,f*1.15,.4);
 facade(g,4,4.6,4.6,'stone',-8.9,2.3,10.9,1.33,1.15);roof(g,4,4.6,-8.9,4.6,10.9,0x6d6255,5);sign(g,'BANK',3.2,.8,-8.9,3.6,13.21);
 facade(g,3.8,3.6,4.6,'brick',-4.7,1.8,10.9,1.27,1.2);roof(g,3.8,4.6,-4.7,3.6,10.9,0x4a2f28,6);box(g,3.6,.12,1,solid(0xb22222),-4.7,2.1,13.65);sign(g,'HOT POT',3.2,.8,-4.7,2.75,13.21);sign(g,'HOT POT',3.2,.8,-2.79,2.75,10.9,Math.PI/2);
 // Metro entrance and bus stop on the square's edges.
 box(g,3,.15,2.2,solid(0x7b8d8c),-23.6,.25,-6.2);for(const x of [-25,-22.2])box(g,.1,1.15,2.1,solid(0x415d67),x,.82,-6.2);box(g,3.3,.14,2.5,solid(0xc8102e),-23.6,1.45,-6.2);sign(g,'METRO LINE 2',3,.75,-23.6,2.05,-4.94);
 box(g,4,.1,1.2,solid(0x1d6fb8),-16.5,2.45,13.2);box(g,3.8,1.9,.06,mat('busglass',()=>new THREE.MeshStandardMaterial({color:0xbfe1ef,transparent:true,opacity:.45,roughness:.1})),-16.5,1.45,12.65);for(const x of [-18.3,-14.7])box(g,.1,2.3,.1,solid(0x2d3d47),x,1.25,13.2);box(g,3,.12,.45,solid(0x6b7c86),-16.5,.65,12.9);sign(g,'BUS · HEPING SQ',2.4,.6,-14.6,2.1,13.2,Math.PI/2);
 // Street trees and lamps along every sidewalk, bollards, benches and a shared-bike rack (instanced).
 const trees=[],lamps=[],bollards=[],bikes=[];for(let x=x0+4;x<=x1-4;x+=4.4){trees.push([x,0,z0+3.1,0,.9+((x*7)%3)*.08],[x,0,z1-3.1,0,.95]);lamps.push([x+2.2,0,z0+3.1,0],[x+2.2,0,z1-3.1,Math.PI])}for(let z=z0+6;z<=z1-6;z+=4.4){trees.push([x0+3.1,0,z,0,.92],[x1-3.1,0,z,0,1]);lamps.push([x0+3.1,0,z+2.2,Math.PI/2],[x1-3.1,0,z+2.2,-Math.PI/2])}
 for(let i=0;i<8;i++)bollards.push([cx-6.8+i*1.95,0,6.9]);for(let i=0;i<6;i++)bikes.push([-12.6+i*.75,0,9.4,Math.PI/2]);
 instances(g,new THREE.CylinderGeometry(.11,.15,1.5,6),solid(0x6d5236),trees.map(t=>[t[0],.75*(t[4]||1),t[2],0,t[4]]));
 instances(g,new THREE.IcosahedronGeometry(1,0),solid(0x4f8f57),trees.map(t=>[t[0],2.05*(t[4]||1),t[2],t[0],t[4]]));
 instances(g,new THREE.CylinderGeometry(.06,.08,3.4,6),solid(0x34434c,.5,.5),lamps.map(l=>[l[0],1.7,l[2]]));instances(g,new THREE.BoxGeometry(.55,.14,.24),glow(0xfff1c4),lamps.map(l=>[l[0],3.4,l[2],l[3]]),false);
 instances(g,new THREE.CylinderGeometry(.09,.09,.6,6),solid(0x4a5a63,.5,.4),bollards.map(b=>[b[0],.5,b[2]]));
 instances(g,new THREE.BoxGeometry(1.1,.45,.08),solid(0xf2b632),bikes.map(b=>[b[0],.55,b[2],b[3]]));instances(g,new THREE.TorusGeometry(.24,.04,5,10),solid(0x23303a),bikes.flatMap(b=>[[b[0],.42,b[2]-.38,b[3]],[b[0],.42,b[2]+.38,b[3]]]));
 // Four corner intersections: zebra crossings on every approach, stop lines and traffic lights.
 const white=solid(0xf1efe6,.9),corners=[[x0,z0],[x1,z0],[x0,z1],[x1,z1]],stripes=[],lights=[];
 for(const [ix,iz] of corners){for(const s of [-1,1]){for(let k=0;k<6;k++){stripes.push([ix-1.45+k*.58,.17,iz+s*3.9,0]);stripes.push([ix+s*3.9,.17,iz-1.45+k*.58,Math.PI/2])}box(g,3.2,.02,.25,white,ix-1,.17,iz+s*5.3);box(g,.25,.02,3.2,white,ix+s*5.3,.17,iz+1)}
  for(const [dx,dz,ry] of [[-2.9,-2.9,0],[2.9,2.9,Math.PI]]){const px=ix+dx,pz=iz+dz;lights.push([px,pz,ry])}}
 instances(g,new THREE.BoxGeometry(.32,.03,3),white,stripes,false);
 for(const [px,pz,ry] of lights){const pole=new THREE.Group();pole.position.set(px,0,pz);pole.rotation.y=ry;cyl(pole,.08,.1,3.6,solid(0x2d3a42,.5,.5),0,1.8,0,8);box(pole,2.2,.12,.12,solid(0x2d3a42,.5,.5),1.1,3.5,0);box(pole,.32,.9,.3,solid(0x1c242a),2.1,3.05,0);for(const [y,c] of [[3.35,0xd6202a],[3.05,0xf5b331],[2.75,0x2fbf71]])box(pole,.2,.2,.05,glow(c),2.1,y,.17);g.add(pole)}
 return {group:g,venues:{plaza:hafrikSquare(),hotel:hepingHotel(),'black-sheep':blackSheep()}}}
// Circles that keep generic filler buildings out of the prototype block.
export function centreBlocked(){const out=[];for(let x=CENTRE.x0+3;x<=CENTRE.x1-3;x+=5)for(let z=CENTRE.z0+3;z<=CENTRE.z1-3;z+=5)out.push([x,z,4]);return out}
