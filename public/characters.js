import * as THREE from './vendor/three.module.js';
// Rounded low-poly people with hip and shoulder joints, so walking, sitting and dancing bend naturally.
// limbs are [leftLeg, rightLeg, leftArm, rightArm] pivot groups; rotating them swings the whole limb.
const mats=new Map(),geos=new Map();
const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.72}));return mats.get(color)};
const geo=(key,make)=>{if(!geos.has(key))geos.set(key,make());return geos.get(key)};
function part(parent,geometry,color,x,y,z){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
const hex=v=>typeof v==='string'?parseInt(v.replace('#',''),16):v;

export function characterModel({shirt=0x23799a,skin=0xa06d4d,trousers=0x28394b,shoes=0xf2efe8,hair='cropped',hairColor=0x1f2628,outfit='tee'}={}){
 shirt=hex(shirt);skin=hex(skin);trousers=hex(trousers);shoes=hex(shoes);hairColor=hex(hairColor);
 const g=new THREE.Group(),limbs=[];
 // Legs hang from the hips; a dress hides the upper legs.
 for(const side of [-1,1]){const hip=new THREE.Group();hip.position.set(side*.11,.84,0);g.add(hip);
  part(hip,geo('leg',()=>new THREE.CapsuleGeometry(.085,.5,4,10)),outfit==='dress'?skin:trousers,0,-.38,0);
  part(hip,geo('shoe',()=>new THREE.BoxGeometry(.17,.1,.3)),shoes,0,-.79,.05);limbs.push(hip)}
 if(outfit==='dress'){part(g,geo('skirt',()=>new THREE.CylinderGeometry(.2,.32,.5,14)),shirt,0,.78,0)}
 const torso=part(g,geo('torso',()=>new THREE.CapsuleGeometry(.19,.34,6,14)),shirt,0,1.13,0);torso.scale.set(1.18,1,.78);
 part(g,geo('neck',()=>new THREE.CylinderGeometry(.07,.08,.12,10)),skin,0,1.47,0);
 // Arms hang from the shoulders: sleeve, forearm and hand.
 for(const side of [-1,1]){const shoulder=new THREE.Group();shoulder.position.set(side*.29,1.36,0);g.add(shoulder);
  part(shoulder,geo('sleeve',()=>new THREE.CapsuleGeometry(.075,.16,4,10)),outfit==='tank'?skin:shirt,0,-.12,0);
  part(shoulder,geo('forearm',()=>new THREE.CapsuleGeometry(.062,.22,4,10)),skin,0,-.36,0);
  part(shoulder,geo('hand',()=>new THREE.SphereGeometry(.07,10,8)),skin,0,-.55,.01);limbs.push(shoulder)}
 const head=part(g,geo('head',()=>new THREE.SphereGeometry(.2,18,14)),skin,0,1.68,0);head.scale.set(1,1.08,1);
 for(const x of [-.07,.07])part(g,geo('eye',()=>new THREE.SphereGeometry(.024,8,6)),0x15232a,x,1.71,.185);
 part(g,geo('mouth',()=>new THREE.BoxGeometry(.08,.016,.02)),0x6b3a2e,0,1.6,.19);
 const top=geo('hairTop',()=>new THREE.SphereGeometry(.212,18,10,0,Math.PI*2,0,Math.PI*.55));
 if(hair==='afro'){const a=part(g,geo('afro',()=>new THREE.SphereGeometry(.27,16,12)),hairColor,0,1.82,-.03);a.scale.set(1,.85,1)}
 else if(hair==='long'){part(g,top,hairColor,0,1.7,0);const back=part(g,geo('longBack',()=>new THREE.CapsuleGeometry(.17,.3,4,10)),hairColor,0,1.5,-.1);back.scale.set(1.15,1,.55)}
 else if(hair!=='bald')part(g,top,hairColor,0,1.7,0);
 if(hair==='bun')part(g,geo('bun',()=>new THREE.SphereGeometry(.11,10,8)),hairColor,0,1.92,-.08);
 if(hair==='cap'){part(g,geo('cap',()=>new THREE.CylinderGeometry(.22,.22,.12,16)),0xe8e1c8,0,1.86,0);part(g,geo('brim',()=>new THREE.BoxGeometry(.34,.03,.2)),0xe8e1c8,0,1.81,.2)}
 g.userData.limbs=limbs;return g;
}

// Varied looks for the people who fill each venue; seeded so a venue looks the same on every visit.
const skins=[0x5a3a2a,0x7b4f36,0x8f5f42,0xa9785a,0xc99b76,0xe0bc9a,0xf1d3b8],shirts=[0xd94b4b,0x2f6fb5,0x1fa58a,0xf2b632,0x8a55c7,0xf4f1ea,0x23303a,0xe86fa0,0x3c8f5a,0xff8a3d],
 pants=[0x23303a,0x2f4a6b,0x6b5b4a,0xd9d2c3,0x3c3c46,0x7a2a35],hairs=['cropped','afro','long','bun','cap','cropped','long','bald'],hairColors=[0x1f2628,0x3a2418,0x5a3a20,0x1f2628,0x8a5a2b];
export function npcLook(seed){const r=n=>{const v=Math.sin((seed+1)*12.9898+n*78.233)*43758.5453;return v-Math.floor(v)};const pick=(list,n)=>list[Math.floor(r(n)*list.length)%list.length];
 return {shirt:pick(shirts,1),skin:pick(skins,2),trousers:pick(pants,3),hair:pick(hairs,4),hairColor:pick(hairColors,5),outfit:r(6)>.78?'dress':r(6)>.6?'tank':'tee'}}
