// v8: an advert helicopter that circles the city towing a banner. One small group, one canvas texture,
// redrawn only when the advert rotates (every 20 s). Adverts come from live admin ads, then partner
// venues, then the "advertise here" house ad.
import * as THREE from './vendor/three.module.js';
const M=c=>new THREE.MeshLambertMaterial({color:c});
function adTexts(){const out=[];for(const a of (window.ChinaLifeCloud?.ads||[]))if(a&&a.title)out.push({t:String(a.title).slice(0,34),s:String(a.sponsor||'').slice(0,30)});
 for(const r of (Array.isArray(window.ChinaLife?.partnerRestaurants)?window.ChinaLife.partnerRestaurants:[]).slice(0,6))if(r?.name)out.push({t:String(r.name).slice(0,34),s:'Partner on Hafrik'});
 const wa=window.ChinaLifeCatalog?.advertising?.whatsapp;out.push({t:'YOUR AD HERE',s:wa?'WhatsApp '+wa:'Advertise on ChinaLife'});return out}
export function helicopter(layout){
 const g=new THREE.Group();g.userData.helicopter=true;
 const body=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,8),M(0xe8453c));body.scale.set(1.5,1,1);g.add(body);
 const glass=new THREE.Mesh(new THREE.SphereGeometry(.75,8,6),M(0x9ed8e6));glass.position.set(1.05,.25,0);g.add(glass);
 const tail=new THREE.Mesh(new THREE.BoxGeometry(2.8,.28,.28),M(0xe8453c));tail.position.set(-2.6,.25,0);g.add(tail);
 const fin=new THREE.Mesh(new THREE.BoxGeometry(.5,.8,.08),M(0xffffff));fin.position.set(-3.9,.55,0);g.add(fin);
 for(const z of [-.7,.7]){const s=new THREE.Mesh(new THREE.BoxGeometry(2.4,.08,.08),M(0x333333));s.position.set(0,-1.15,z);g.add(s)}
 const rotor=new THREE.Group();rotor.position.y=1.2;for(const r of [0,Math.PI/2]){const b=new THREE.Mesh(new THREE.BoxGeometry(5.2,.05,.22),M(0x222222));b.rotation.y=r;rotor.add(b)}g.add(rotor);
 const tr=new THREE.Mesh(new THREE.BoxGeometry(.06,1,.12),M(0x222222));tr.position.set(-3.95,.55,.1);g.add(tr);
 // Banner on a rope behind the tail.
 const cv=document.createElement('canvas');cv.width=512;cv.height=128;const tex=new THREE.CanvasTexture(cv);
 // Two one-sided faces back to back so the text reads correctly from both sides.
 const banner=new THREE.Group();banner.position.set(-10.5,-1.6,0);g.add(banner);const bm=new THREE.MeshBasicMaterial({map:tex});for(const r of [0,Math.PI]){const f=new THREE.Mesh(new THREE.PlaneGeometry(9,2.25),bm);f.rotation.y=r;banner.add(f)}
 const rope=new THREE.Mesh(new THREE.BoxGeometry(2.4,.04,.04),M(0x555555));rope.position.set(-5.2,-.6,0);rope.rotation.z=.35;g.add(rope);
 let idx=-1,shownAt=-1e9,ads=[];
 const draw=()=>{ads=adTexts();idx=(idx+1)%ads.length;const a=ads[idx],c=cv.getContext('2d');c.fillStyle='#fff7e0';c.fillRect(0,0,512,128);c.fillStyle='#e8453c';c.fillRect(0,0,512,10);c.fillRect(0,118,512,10);c.fillStyle='#0c3f44';c.textAlign='center';c.font='800 46px sans-serif';c.fillText(a.t,256,64,490);c.font='600 26px sans-serif';c.fillStyle='#1f8e93';c.fillText(a.s,256,104,490);tex.needsUpdate=true};
 const xs=layout?.xs||[-60,60],zs=layout?.zs||[-60,60];const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
 const rx=Math.max(30,(Math.max(...xs)-Math.min(...xs))*.42),rz=Math.max(24,(Math.max(...zs)-Math.min(...zs))*.42);
 g.scale.setScalar(2.2);
 return {group:g,banner,update(t){if(t-shownAt>20){shownAt=t;draw()}const a=t*.05;g.position.set(cx+Math.cos(a)*rx,26+Math.sin(t*.7)*.6,cz+Math.sin(a)*rz);
  // Face along the direction of travel (derivative of the ellipse).
  g.rotation.y=Math.atan2(-Math.cos(a)*rz,-Math.sin(a)*rx);rotor.rotation.y=t*25;tr.rotation.x=t*30},get ad(){return ads[idx]}};
}
