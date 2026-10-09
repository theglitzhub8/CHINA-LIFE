import * as THREE from './vendor/three.module.js';
// Human-proportioned low-poly people with hip and shoulder joints, a face, and layered clothing that matches
// what the player owns: tops, bottoms, shoes and accessories. limbs are [leftLeg, rightLeg, leftArm, rightArm]
// pivot groups; rotating them swings the whole limb (walking, sitting and dancing animations use them).
const mats=new Map(),geos=new Map();
const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.72}));return mats.get(color)};
const geo=(key,make)=>{if(!geos.has(key))geos.set(key,make());return geos.get(key)};
function part(parent,geometry,color,x,y,z){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
const hex=v=>typeof v==='string'?parseInt(v.replace('#',''),16):v;
const shade=(c,f)=>{const x=new THREE.Color(c);x.multiplyScalar(f);return x.getHex()};
const cap=(r,l)=>geo('cap'+r+l,()=>new THREE.CapsuleGeometry(r,l,4,10));
const boxG=(w,h,d)=>geo('b'+w+h+d,()=>new THREE.BoxGeometry(w,h,d));
const sph=r=>geo('s'+r,()=>new THREE.SphereGeometry(r,12,10));

// Older saves pass shirt/trousers/outfit; newer ones pass a full outfit {top,bottom,shoes,acc} from the store.
function normalise(o){const top=o.top||{s:o.outfit==='dress'?'dress':o.outfit==='tank'?'tank':'tee',c:o.shirt},bottom=o.bottom||{s:o.outfit==='dress'?'none':'jeans',c:o.trousers},shoes=o.shoes&&typeof o.shoes==='object'?o.shoes:{s:'sneakers',c:o.shoes};return {top:{s:top.s||'tee',c:hex(top.c??0x23799a)},bottom:{s:bottom.s||'jeans',c:hex(bottom.c??0x28394b)},shoes:{s:shoes.s||'sneakers',c:hex(shoes.c??0xf2efe8)},acc:Array.isArray(o.acc)?o.acc:[]}}

export function characterModel(options={}){
 const {skin:s0=0xa06d4d,hair='cropped',hairColor:h0=0x1f2628}=options,skin=hex(s0),hairColor=hex(h0),fit=normalise(options);
 const g=new THREE.Group(),limbs=[],top=fit.top,bottom=fit.bottom,dress=['dress','gown','qipao'].includes(top.s);
 const longSleeve=['shirt','hoodie','jacket','suit','sweater','qipao','gown'].includes(top.s),shortLegs=bottom.s==='shorts',skirt=bottom.s==='skirt'||dress;
 // Legs: thigh and shin hang from the hips; shorts and skirts show skin below.
 for(const side of [-1,1]){const hip=new THREE.Group();hip.position.set(side*.1,.9,0);g.add(hip);
  part(hip,cap(.085,.34),dress||skirt?skin:bottom.c,0,-.22,0);
  part(hip,cap(.07,.36),shortLegs||skirt?skin:bottom.c,0,-.62,0);
  // Shoes by style.
  const sh=fit.shoes,sc=sh.c;if(options.lite){part(hip,boxG(.16,.11,.3),sc,0,-.87,.05);limbs.push(hip);continue}if(sh.s==='boots'){part(hip,boxG(.17,.24,.26),sc,0,-.82,.03)}else if(sh.s==='heels'){part(hip,boxG(.13,.08,.26),sc,0,-.87,.05);part(hip,boxG(.04,.12,.04),sc,0,-.92,-.07)}else if(sh.s==='slides'){part(hip,boxG(.15,.04,.28),sc,0,-.9,.04);part(hip,boxG(.15,.05,.1),skin,0,-.86,.06)}else if(sh.s==='loafers'){part(hip,boxG(.15,.08,.29),sc,0,-.88,.05)}else{part(hip,boxG(.16,.11,.3),sc,0,-.87,.05);part(hip,boxG(.162,.03,.31),0xffffff,0,-.92,.05)}
  limbs.push(hip)}
 if(skirt&&!dress)part(g,geo('skirt',()=>new THREE.CylinderGeometry(.19,.29,.38,14)),bottom.c,0,.82,0);
 if(dress){const long=top.s==='gown';part(g,geo(long?'gown':'dressSkirt',()=>new THREE.CylinderGeometry(.2,long?.38:.31,long?.85:.48,16)),top.c,0,long?.55:.78,0)}
 else part(g,geo('hips',()=>new THREE.CylinderGeometry(.2,.19,.18,12)),bottom.c,0,.93,0);
 // Torso: chest wider than waist; jackets and suits add an open front over an inner layer.
 const torso=part(g,geo('torso2',()=>new THREE.CylinderGeometry(.24,.19,.5,14)),top.c,0,1.22,0);torso.scale.set(1,1,.72);
 if(top.s==='jacket'||top.s==='suit'){part(g,boxG(.12,.46,.02),top.s==='suit'?0xf4f4f2:shade(top.c,1.35),0,1.22,.17);if(top.s==='suit')part(g,boxG(.05,.32,.02),0x8c1c2b,0,1.2,.185)}
 if(top.s==='shirt'||top.s==='suit'||top.s==='qipao'){part(g,boxG(.2,.06,.14),top.s==='qipao'?top.c:0xf4f4f2,0,1.48,.03)}
 if(top.s==='hoodie')part(g,geo('hood',()=>new THREE.TorusGeometry(.16,.06,6,14)),top.c,0,1.48,-.04).rotation.x=Math.PI/2.4;
 if(top.s==='qipao')for(let i=0;i<3;i++)part(g,boxG(.03,.03,.02),0xc9a24a,.07,1.4-i*.09,.175);
 part(g,geo('neck',()=>new THREE.CylinderGeometry(.065,.075,.12,10)),skin,0,1.52,0);
 // Arms: sleeve, forearm (skin or sleeve) and hand.
 for(const side of [-1,1]){const shoulder=new THREE.Group();shoulder.position.set(side*.29,1.42,0);g.add(shoulder);
  part(shoulder,cap(.07,.2),top.s==='tank'?skin:top.c,0,-.14,0);part(shoulder,cap(.058,.22),longSleeve?top.c:skin,0,-.4,0);
  part(shoulder,sph(.062),skin,0,-.59,.01);limbs.push(shoulder)}
 // Head and face.
 const head=part(g,sph(.19),skin,0,1.75,0);head.scale.set(.95,1.08,1);
 const lite=!!options.lite;if(!lite){for(const x of [-.19,.19])part(g,sph(.045),skin,x,1.74,0);
 for(const x of [-.068,.068]){part(g,geo('eyeWhite',()=>new THREE.SphereGeometry(.032,10,8)),0xffffff,x,1.77,.165);part(g,geo('pupil',()=>new THREE.SphereGeometry(.018,8,6)),0x1d1d1d,x,1.77,.19);part(g,boxG(.07,.014,.02),shade(hairColor,1),x,1.825,.172)}
 part(g,geo('nose',()=>new THREE.ConeGeometry(.025,.07,6)),shade(skin,.92),0,1.73,.19).rotation.x=Math.PI/2;
 part(g,boxG(.075,.016,.02),0x7a3b33,0,1.665,.18)}else for(const x of [-.068,.068])part(g,boxG(.04,.04,.02),0x1d1d1d,x,1.77,.18);
 // Hairstyles.
 const top3=geo('hairTop',()=>new THREE.SphereGeometry(.2,18,10,0,Math.PI*2,0,Math.PI*.55));
 if(hair==='afro'){const a=part(g,sph(.27),hairColor,0,1.87,-.03);a.scale.set(1,.85,1)}
 else if(hair==='long'){part(g,top3,hairColor,0,1.78,0);const back=part(g,cap(.17,.32),hairColor,0,1.58,-.1);back.scale.set(1.15,1,.55)}
 else if(hair==='curly'){for(let i=0;i<9;i++){const a=i/9*Math.PI*2;part(g,sph(.09),hairColor,Math.cos(a)*.15,1.88+Math.sin(i*2.1)*.03,Math.sin(a)*.13-.02)}part(g,sph(.13),hairColor,0,1.93,-.02)}
 else if(hair==='braids'){part(g,top3,hairColor,0,1.78,0);for(const x of [-.12,.12])part(g,cap(.04,.42),hairColor,x,1.5,-.1)}
 else if(hair==='ponytail'){part(g,top3,hairColor,0,1.78,0);const pt=part(g,cap(.06,.26),hairColor,0,1.68,-.2);pt.rotation.x=.4}
 else if(hair==='bob'){part(g,top3,hairColor,0,1.78,0);part(g,geo('bob',()=>new THREE.CylinderGeometry(.21,.22,.24,14)),hairColor,0,1.72,-.03).scale.set(1,1,.9)}
 else if(hair==='buzz'){const b=part(g,top3,shade(hairColor,1.15),0,1.78,0);b.scale.set(1,.85,1)}
 else if(hair!=='bald')part(g,top3,hairColor,0,1.78,0);
 if(hair==='bun')part(g,sph(.1),hairColor,0,1.99,-.08);
 const acc=new Set(fit.acc);
 if(hair==='cap'||acc.has('cap')){part(g,geo('capTop',()=>new THREE.CylinderGeometry(.21,.21,.12,16)),acc.has('cap')?0x1d1d1d:0xe8e1c8,0,1.93,0);part(g,boxG(.34,.03,.2),acc.has('cap')?0x1d1d1d:0xe8e1c8,0,1.88,.2)}
 if(acc.has('beanie'))part(g,geo('beanie',()=>new THREE.SphereGeometry(.215,14,10,0,Math.PI*2,0,Math.PI*.55)),0x8c1c2b,0,1.8,0);
 if(acc.has('glasses')||acc.has('sunglasses')){const c=acc.has('sunglasses')?0x111111:0x2b2b2b;for(const x of [-.068,.068])part(g,boxG(.09,.06,.02),c,x,1.77,.2);part(g,boxG(.05,.012,.02),c,0,1.775,.2)}
 if(acc.has('headphones')){const band=part(g,geo('band',()=>new THREE.TorusGeometry(.2,.025,6,16,Math.PI)),0x1d1d1d,0,1.78,0);band.rotation.z=0;for(const x of [-.2,.2])part(g,sph(.06),0x1d1d1d,x,1.74,0)}
 if(acc.has('chain'))part(g,geo('chain',()=>new THREE.TorusGeometry(.13,.015,6,18)),0xd9b24a,0,1.42,.08).rotation.x=Math.PI/2.3;
 if(acc.has('watch')||acc.has('luxwatch'))part(limbs[2],boxG(.08,.05,.09),acc.has('luxwatch')?0xd9b24a:0x1d1d1d,0,-.5,.02);
 if(acc.has('backpack'))part(g,boxG(.32,.4,.16),0x2f4a6b,0,1.2,-.22);
 if(acc.has('handbag')){part(g,boxG(.22,.16,.08),0x7a1f2b,.38,.95,.04);part(g,geo('strap',()=>new THREE.TorusGeometry(.09,.012,4,10,Math.PI)),0xd9b24a,.38,1.03,.04)}
 g.userData.limbs=limbs;return g;
}

// Varied looks for the people who fill each venue; seeded so a venue looks the same on every visit.
const skins=[0x5a3a2a,0x7b4f36,0x8f5f42,0xa9785a,0xc99b76,0xe0bc9a,0xf1d3b8],shirts=[0xd94b4b,0x2f6fb5,0x1fa58a,0xf2b632,0x8a55c7,0xf4f1ea,0x23303a,0xe86fa0,0x3c8f5a,0xff8a3d],
 pants=[0x23303a,0x2f4a6b,0x6b5b4a,0xd9d2c3,0x3c3c46,0x7a2a35],hairs=['cropped','afro','long','bun','cap','curly','ponytail','bob','braids','buzz','bald'],hairColors=[0x1f2628,0x3a2418,0x5a3a20,0x1f2628,0x8a5a2b],
 tops=['tee','tee','shirt','hoodie','jacket','sweater','tank','dress'],bottoms=['jeans','chinos','jeans','shorts','skirt','joggers'],shoeStyles=['sneakers','sneakers','boots','loafers','heels','slides'];
export function npcLook(seed){const r=n=>{const v=Math.sin((seed+1)*12.9898+n*78.233)*43758.5453;return v-Math.floor(v)};const pick=(list,n)=>list[Math.floor(r(n)*list.length)%list.length];
 const top=pick(tops,6),acc=r(9)>.7?[pick(['glasses','sunglasses','headphones','backpack','watch','chain'],10)]:[];
 return {shirt:pick(shirts,1),skin:pick(skins,2),trousers:pick(pants,3),hair:pick(hairs,4),hairColor:pick(hairColors,5),outfit:top==='dress'?'dress':top==='tank'?'tank':'tee',
  top:{s:top,c:pick(shirts,1)},bottom:{s:top==='dress'?'none':pick(bottoms,7),c:pick(pants,3)},shoes:{s:pick(shoeStyles,8),c:pick([0xf2efe8,0x1d1d1d,0x7a5537,0x8c1c2b],11)},acc}}
