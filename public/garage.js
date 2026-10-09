import * as THREE from './vendor/three.module.js';
// Vehicles players can own: shown in the store preview, parked at villas and mansions, and driven across the city.
const mats=new Map();const m=(c,r=.45,metal=.25)=>{const k=c+':'+r+':'+metal;if(!mats.has(k))mats.set(k,new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:metal}));return mats.get(k)};
function b(g,w,h,d,c,x,y,z,r,metal){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m(c,r,metal));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o}
function wheels(g,xs,z,r=.3,y=r){for(const x of xs)for(const s of [-1,1]){const w=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.22,14),m(0x1b1b1b,.8,0));w.rotation.x=Math.PI/2;w.position.set(x,y,s*z);g.add(w);const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.5,r*.5,.24,10),m(0xc9ced1,.3,.8));hub.rotation.x=Math.PI/2;hub.position.set(x,y,s*z);g.add(hub)}}
const glass=0x22313d,light=0xfff6d0,tail=0xd5332f;
// Built along +x (front) so they drive the way world.js orients road vehicles.
export function carModel(id='sedan',color){const g=new THREE.Group();g.userData.kind='car-'+id;
 if(id==='scooter'){const c=color??0xf28a1e;wheels(g,[-.55,.55],0,.26);b(g,1.2,.2,.38,c,0,.5,0);b(g,.18,.6,.3,c,.5,.8,0);b(g,.06,.06,.6,0x1d1d1d,.55,1.12,0);b(g,.5,.12,.32,0x1d1d1d,-.2,.66,0);return g}
 if(id==='sports'){const c=color??0xd0362f;wheels(g,[-1,1],.62,.3);b(g,2.8,.42,1.3,c,0,.5,0);b(g,1.3,.32,1.1,glass,-.2,.86,0,.1,.4);b(g,1.4,.06,1.12,c,-.25,1.03,0);b(g,.4,.06,1.3,0x1d1d1d,-1.35,.9,0);for(const z of [-.45,.45]){b(g,.06,.1,.3,light,1.41,.55,z);b(g,.06,.08,.3,tail,-1.41,.6,z)}return g}
 if(id==='limo'){const c=color??0x1b1b1b;wheels(g,[-1.7,1.7],.66,.32);b(g,4.6,.6,1.32,c,0,.6,0,.25,.5);b(g,3.2,.5,1.18,glass,-.25,1.12,0,.1,.4);b(g,3.3,.06,1.22,c,-.25,1.39,0,.25,.5);b(g,.08,.2,1.1,0xc9ced1,2.32,.6,0,.2,.9);for(const z of [-.45,.45]){b(g,.06,.12,.3,light,2.31,.75,z);b(g,.06,.1,.3,tail,-2.31,.75,z)}return g}
 if(id==='suv'){const c=color??0x3d6fb6;wheels(g,[-1,1.05],.66,.36,.36);b(g,3,.8,1.36,c,0,.8,0);b(g,1.9,.6,1.24,glass,-.25,1.45,0,.1,.4);b(g,2,.08,1.3,c,-.25,1.78,0);for(const z of [-.45,.45]){b(g,.06,.14,.3,light,1.51,.95,z);b(g,.06,.12,.3,tail,-1.51,.95,z)}b(g,1.8,.06,1,0x1d1d1d,-.25,1.85,0);return g}
 if(id==='hatchback'){const c=color??0x2e7d5b;wheels(g,[-.75,.8],.58,.28);b(g,2.2,.55,1.16,c,0,.55,0);b(g,1.3,.5,1.06,glass,-.2,1.05,0,.1,.4);b(g,1.35,.06,1.1,c,-.2,1.32,0);for(const z of [-.4,.4]){b(g,.06,.12,.26,light,1.11,.66,z);b(g,.06,.1,.26,tail,-1.11,.66,z)}return g}
 const c=color??0xf4f2ee;wheels(g,[-.9,.9],.6,.3);b(g,2.7,.55,1.2,c,0,.55,0);b(g,1.45,.5,1.08,glass,-.1,1.05,0,.1,.4);b(g,1.5,.06,1.12,c,-.1,1.32,0);for(const z of [-.42,.42]){b(g,.06,.14,.24,light,1.36,.62,z);b(g,.06,.12,.24,tail,-1.36,.62,z)}return g}
