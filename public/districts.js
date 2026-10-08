import * as THREE from './vendor/three.module.js';
import {solid,glow,box,cyl,facade,slab,roof,sign,instances,treesAndLamps,intersections,shopfront,seeded} from './city-kit.js';
// Every block of every city, built in its neighbourhood's style from map-data.js: business towers, Chinese
// residential slabs with street shops, campus halls and sports fields, malls, garden villas, nightlife neon,
// warehouses and riverfront homes, plus sidewalks, street trees, lamps, crossings and traffic lights everywhere.
// Buildings face south (+z), the side the map camera sees, and stay low in front of venues so none is hidden.

const SHOPS={residential:['24H MART','FRUIT','BARBER','LAUNDRY','SUPERMARKET','BAOZI'],student:['PRINT & STATIONERY','BUBBLE TEA','NOODLES','GAMING','PHONES','COFFEE'],food:['NOODLES','DUMPLINGS','BBQ','BAOZI','HOT POT','TEA HOUSE'],
 rail:['COURIER','NOODLES','24H MART'],centre:['COFFEE','PHARMACY','BANK','BOOKS'],shopping:['SUPERMARKET','PHONES','FLOWERS','COFFEE'],nightlife:['BBQ','HOT POT','BAR'],riverfront:['COFFEE','TEA HOUSE','FLOWERS'],cbd:['COFFEE','BANK'],gardens:['FLOWERS','FRUIT'],campus:['BOOKS','COFFEE']};
const CANTONESE={food:['DIM SUM','ROAST MEATS','HERBAL TEA','NOODLES','TEA HOUSE','DUMPLINGS']};
const AWNINGS=[0x2f8a57,0xb35a1f,0x2b5fb8,0xd0362f,0x7a3fbf,0x1f8d84,0xd0517a];
const ROOFS=[0xb4423a,0x2f5d8a,0x3c7a55,0x7d6a5c];
// Building recipes per neighbourhood style, picked by weight with a seed so each city looks the same every visit.
const RECIPES={residential:[['slab',6],['shophouse',3],['park',1]],student:[['dorm',5],['shophouse',4],['park',1]],campus:[['hall',4],['field',2],['dorm',3],['park',1]],rail:[['warehouse',5],['midtower',3],['shophouse',2]],
 food:[['shophouse',7],['slab',3]],centre:[['tower',4],['slab',3],['shophouse',3]],cbd:[['tower',7],['midtower',2],['park',1]],shopping:[['mall',5],['tower',3],['shophouse',2]],
 gardens:[['villa',6],['park',3],['slab',1]],nightlife:[['neon',6],['shophouse',3],['slab',1]],riverfront:[['slab',5],['tower',2],['park',3]],airport:[]};
function pick(style,seed){const list=RECIPES[style]||RECIPES.residential,total=list.reduce((n,r)=>n+r[1],0);let r=seeded(seed)*total;for(const [kind,w] of list){if((r-=w)<0)return kind}return list[0][0]}

// ---- Building recipes: each builds one ~6x6 plot centred on (x,z); `low` keeps it short in front of venues. ----
const B={
 tower(g,x,z,s,low,ctx){if(low)return B.shophouse(g,x,z,s,low,ctx);const w=4.4+seeded(s+1)*1.2,h=12+Math.round(seeded(s+2)*14),style=['glass','teal','office'][s%3];box(g,w+1,1.4,w+1,solid(0xd9d4c8),x,.7,z);facade(g,w,h,w,style,x,1.4+h/2,z,1.3,1.1);
  if(seeded(s+3)>.4){const t=w*.72,h2=h*.28;box(g,w+.2,.3,w+.2,solid(0xf2b632,.4,.4),x,1.55+h,z);facade(g,t,h2,t,style,x,1.7+h+h2/2,z,1.3,1.1);roof(g,t,t,x,1.7+h+h2,z,0x55636b,s)}else{roof(g,w,w,x,1.4+h,z,0x55636b,s);box(g,w+.25,.35,w+.25,solid(style==='teal'?0x2f716d:0x1e4c73,.4,.4),x,1.6+h,z)}
  shopfront(g,w,x,z+w/2,ctx.shop(s),AWNINGS[s%AWNINGS.length])},
 midtower(g,x,z,s,low,ctx){if(low)return B.shophouse(g,x,z,s,low,ctx);const w=5,h=7+Math.round(seeded(s+2)*5);facade(g,w,h,w,'office',x,h/2,z,1.4,1.2);roof(g,w,w,x,h,z,0x55636b,s);sign(g,'OFFICES',3.4,.75,x,h-1,z+w/2+.02)},
 slab(g,x,z,s,low,ctx){const w=5.6,d=4.4,floors=low?3:6+Math.round(seeded(s+2)*8),h=floors*1.15,style=['resi','tile','pink'][s%3],r=ROOFS[s%ROOFS.length];box(g,w,1.4,d,solid(0xe9e2d3),x,.7,z);facade(g,w,h-1.4,d,style,x,1.4+(h-1.4)/2,z,1.4,1.15);
  for(let f=2;f<floors;f+=2)box(g,w+.1,.22,.5,solid(0xe4ddcf),x,f*1.15,z+d/2+.2);if(!low){box(g,w+.3,.9,d+.3,solid(r),x,h+.45,z);box(g,w*.5,.8,d*.4,solid(r),x,h+1.2,z)}else roof(g,w,d,x,h,z,r,s);shopfront(g,w,x,z+d/2,ctx.shop(s),AWNINGS[s%AWNINGS.length])},
 dorm(g,x,z,s,low){const w=5.8,d=4,floors=low?3:4+Math.round(seeded(s+2)*3),h=floors*1.15;facade(g,w,h,d,s%2?'tile':'resi',x,h/2,z,1.45,1.15);roof(g,w,d,x,h,z,0x2f5d8a,s);for(let f=1;f<floors;f++)box(g,w+.1,.18,.45,solid(0xdfe3e4),x,f*1.15,z+d/2+.18);if(s%2)sign(g,'STUDENT DORMS',3.6,.75,x,1.15*floors-.6,z+d/2+.42)},
 shophouse(g,x,z,s,low,ctx){const w=5.2,d=4.4,floors=low?2:2+Math.round(seeded(s+2)*2),h=1.4+floors*1.15,style=['shop','brick','resi','pink'][s%4];box(g,w,1.4,d,solid(0xe9e2d3),x,.7,z);facade(g,w,h-1.4,d,style,x,1.4+(h-1.4)/2,z,1.3,1.15);roof(g,w,d,x,h,z,0x7d6a5c,s);shopfront(g,w,x,z+d/2,ctx.shop(s),AWNINGS[s%AWNINGS.length]);for(let f=0;f<floors-1;f++)box(g,.5,.35,.3,solid(0xdfe3e4),x+1.6,2.2+f*1.15,z+d/2+.15)},
 hall(g,x,z,s,low){const w=6.2,d=5.2,h=low?3.4:4.6;facade(g,w,h,d,'stone',x,h/2,z,1.55,1.15);roof(g,w,d,x,h,z,0x8b7f6d,s);for(let i=0;i<4;i++)cyl(g,.16,.16,h-.4,solid(0xeee6d4),x-2.3+i*1.53,(h-.4)/2,z+d/2+.35,10);box(g,w+.2,.35,1,solid(0xd8cdb8),x,h-.15,z+d/2+.4);if(s%3===0)sign(g,'LIBRARY',3.2,.75,x,h+.6,z+d/2+.42)},
 field(g,x,z){slab(g,6.2,6.4,'grass',x,.24,z,.06,3);const track=new THREE.Mesh(new THREE.TorusGeometry(2.4,.32,4,28),solid(0xb4523e));track.rotation.x=Math.PI/2;track.scale.set(1,.72,1);track.position.set(x,.3,z);track.receiveShadow=true;g.add(track);for(const dx of [-2.6,2.6])box(g,.08,1.2,1.4,solid(0xffffff),x+dx,.8,z)},
 mall(g,x,z,s,low,ctx){const w=6,d=5.6,h=low?3.4:4.8;facade(g,w,h,d,'shop',x,h/2,z,1.5,1.2,0xf4e9f8);roof(g,w,d,x,h,z,0x5a4a6a,s);box(g,w-.4,.4,.3,glow(0xf7c66b),x,h-.6,z+d/2+.16);sign(g,'MALL',3.6,.85,x,h-1.4,z+d/2+.03);shopfront(g,w,x,z+d/2,ctx.shop(s),0x7a3fbf);
  if(!low&&seeded(s+5)>.5){const t=3.6,h2=8+Math.round(seeded(s+6)*6);facade(g,t,h2,t,'glass',x-.8,h+h2/2,z-.6,1.2,1.1);roof(g,t,t,x-.8,h+h2,z-.6,0x55636b,s)}},
 villa(g,x,z,s){const w=4.2,d=3.6,h=2.3;slab(g,5.6,5.2,'grass',x,.24,z,.06,3);facade(g,w,h,d,s%2?'pink':'resi',x,h/2+.2,z-.3,1.4,1.15);const top=new THREE.Mesh(new THREE.ConeGeometry(3.2,1.4,4),solid(ROOFS[s%ROOFS.length]));top.position.set(x,h+.9,z-.3);top.rotation.y=Math.PI/4;top.scale.set(1,1,.85);top.castShadow=true;g.add(top);for(const dx of [-2.6,2.6])box(g,.25,.6,5,solid(0x4f8f57),x+dx,.5,z);box(g,.9,1.4,.08,solid(0x6b4a35),x,.9,z+d/2-.28)},
 warehouse(g,x,z,s){const w=6,d=5,h=3.2;facade(g,w,h,d,'grey',x,h/2,z,2,1.6);for(let i=0;i<3;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,d,3,1,false,0,Math.PI),solid(0x7f8a8f));t.rotation.set(0,0,Math.PI/2);t.rotation.order='ZYX';t.position.set(x-2+i*2,h,z);g.add(t)}box(g,2.4,2.2,.1,solid(0x52606a),x-1.2,1.1,z+d/2+.03);sign(g,s%2?'LOGISTICS':'COURIER',2.8,.7,x+1.4,2.4,z+d/2+.03)},
 neon(g,x,z,s,low,ctx){const w=5.2,d=4.4,floors=low?2:3+Math.round(seeded(s+2)*3),h=1.4+floors*1.15,c=[0xe05ab8,0x00e5ff,0xffd36b,0x9b5cff][s%4];box(g,w,1.4,d,solid(0x2a2238),x,.7,z);facade(g,w,h-1.4,d,'neon',x,1.4+(h-1.4)/2,z,1.3,1.15);roof(g,w,d,x,h,z,0x2a2238,s);
  box(g,.3,h-1.6,.3,glow(c),x+w/2-.3,1.4+(h-1.6)/2,z+d/2+.1);box(g,w-.4,.25,.25,glow(c),x,1.5,z+d/2+.1);sign(g,['BAR','KARAOKE','GAMING'][s%3],3.6,.85,x,h-.9,z+d/2+.03);shopfront(g,w,x,z+d/2,ctx.shop(s),0x2a1c3a)},
 park(g,x,z,s,low,ctx){slab(g,6,6,'grass',x,.24,z,.06,3);for(const [dx,dz] of [[-1.8,-1.6],[1.9,-1.2],[-.6,1.9]])ctx.trees.push([x+dx,0,z+dz,0,.9+seeded(s+dx)*.25]);box(g,1.8,.12,.5,solid(0x7d5a3c),x+1.2,.42,z+1.6);box(g,1.8,.12,.5,solid(0x7d5a3c),x-2,.42,z+.2,Math.PI/2);if(s%2){cyl(g,1,1.1,.3,solid(0xcfc6b5),x+.6,.35,z-.2,18);cyl(g,.85,.85,.06,solid(0x5fb7d9),x+.6,.52,z-.2,18)}}};

// Build every block of a city (except `skip` blocks, e.g. the City Centre prototype) and all street furniture.
export function buildDistricts(layout,city,{skip=()=>false,blocked=[],venues=[]}={}){
 const g=new THREE.Group();g.userData.kind='districts';const {xs,zs,riverZ}=layout,trees=[],lamps=[];
 const shopsFor=style=>(city==='Guangzhou'&&CANTONESE[style])||SHOPS[style]||SHOPS.residential;
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
  const cx=(xs[i]+xs[i+1])/2,cz=(zs[j]+zs[j+1])/2,district=layout.districts[j*4+i],style=district?.style||'residential';
  if(skip(cx,cz)||style==='airport')continue;
  // Blocks crossed by the river keep the water clear: their sidewalk starts south of it.
  const top=zs[j]+2.3,bottom=zs[j+1]-2.3,riverCut=riverZ>zs[j]&&riverZ<zs[j+1],z0=riverCut?riverZ+2.3:top,depth=bottom-z0,zc=(z0+bottom)/2;
  slab(g,29.4,depth,'sidewalk',cx,.1,zc);for(const [w,d,x,z] of [[29.6,.3,cx,z0+.1],[29.6,.3,cx,bottom-.1],[.3,depth,xs[i]+2.2,zc],[.3,depth,xs[i+1]-2.2,zc]])box(g,w,.26,d,solid(0xa7aaa6),x,.13,z);
  if(['gardens','campus','riverfront'].includes(style))slab(g,25,depth-4.4,'grass',cx,.21,zc,.04,3);
  for(let x=xs[i]+4;x<=xs[i+1]-4;x+=4.4){trees.push([x,0,z0+.9,0,.85+seeded(x+cz)*.2],[x,0,bottom-.9,0,.95]);lamps.push([x+2.2,0,z0+.9,0],[x+2.2,0,bottom-.9,Math.PI])}
  for(let z=z0+4;z<=bottom-4;z+=4.4){trees.push([xs[i]+3.1,0,z,0,.92],[xs[i+1]-3.1,0,z,0,1]);lamps.push([xs[i]+3.1,0,z+2.2,Math.PI/2],[xs[i+1]-3.1,0,z+2.2,-Math.PI/2])}
  // Plots: four columns by three rows inside the sidewalks, skipping venues, billboards and street details.
  const rows=riverCut?[z0+4.6,(z0+bottom)/2,bottom-4.4]:[cz-8.5,cz,cz+8.5],ctx={trees,shop:s=>{const list=shopsFor(style);return list[s%list.length]}};
  rows.forEach((z,r)=>[-10.5,-3.5,3.5,10.5].forEach((dx,c)=>{const x=cx+dx,s=Math.abs(Math.round(x*7+z*13+i*31+j*17));
   if(blocked.some(([bx,bz,rad])=>Math.hypot(bx-x,bz-z)<rad+2.4)||venues.some(([vx,vz])=>Math.abs(vx-x)<5.6&&Math.abs(vz-z)<5.4))return;
   // The camera looks from the south-east; a tall building there would cover a venue behind it, so it stays low.
   const low=venues.some(([vx,vz])=>{const ahead=(x+z)-(vx+vz);return ahead>0&&ahead<30&&Math.abs((x-z)-(vx-vz))<9});
   B[pick(style,s)](g,x,z,s,low,ctx)}));
 }
 treesAndLamps(g,trees,lamps);
 // Zebra crossings and traffic lights at every inner intersection (border roads have no crossing traffic).
 const points=[];for(const x of xs.slice(1,-1))for(const z of zs.slice(1,-1))points.push([x,z]);intersections(g,points);
 return g}
