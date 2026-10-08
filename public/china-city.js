import * as THREE from './vendor/three.module.js';
// Stylized districts inspired by Chinese urban life; these are fictional layouts.
const styles={
 Shenyang:{wall:0xb76f55,roof:0x53636a,glass:0x8cb5c2,trees:0xcba44d,sign:'和平大街 · HEPING',station:'沈阳站',district:'和平生活区'},
 Beijing:{wall:0xb3aaa0,roof:0x45535d,glass:0x86b2bf,trees:0x889950,sign:'胡同 · HUTONG',station:'北京站',district:'胡同生活区'},
 Shanghai:{wall:0xc3a17d,roof:0x455e6a,glass:0x84b9d4,trees:0x669b75,sign:'滨江大道 · RIVERSIDE',station:'上海站',district:'滨江生活区'},
 Guangzhou:{wall:0xefe0bb,roof:0x427c73,glass:0x80bab5,trees:0x458c62,sign:'骑楼街 · ARCADE',station:'广州站',district:'岭南生活区'},
 Shenzhen:{wall:0xc5d7de,roof:0x466879,glass:0x5ab4d1,trees:0x498c70,sign:'创新大道 · INNOVATION',station:'深圳站',district:'科创生活区'},
 Chengdu:{wall:0xddcfae,roof:0x5b6861,glass:0x88ada9,trees:0x6b994e,sign:'茶馆街 · TEA STREET',station:'成都站',district:'天府生活区'},
 Harbin:{wall:0xe9d1a1,roof:0x53667a,glass:0x7fa8c7,trees:0x588975,sign:'中央大街 · CENTRAL',station:'哈尔滨站',district:'冰城生活区'},
};
const materials=new Map();
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8,flatShading:true}));return materials.get(color)}
function box(group,w,h,d,color,x=0,y=h/2,z=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh}
function cylinder(group,r,h,color,x,y,z){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh}
function textSign(group,text,x,y,z,w=4,color='#174d53'){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=144;const ctx=canvas.getContext('2d');
 if(!ctx)return;ctx.fillStyle=color;ctx.fillRect(0,0,768,144);ctx.fillStyle='#fff1cf';ctx.textAlign='center';ctx.font='bold 46px "PingFang SC","Microsoft YaHei",sans-serif';ctx.fillText(text,384,93);
 const texture=new THREE.CanvasTexture(canvas),mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w*.1875),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);group.add(mesh);mesh.userData.chineseSign=text;
}
function lantern(group,x,y,z){cylinder(group,.08,.6,0x66564a,x,y+.3,z);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),material(0xc94337));lamp.scale.set(.9,1.15,.9);lamp.position.set(x,y,z);group.add(lamp);cylinder(group,.08,.07,0xe7bd65,x,y-.24,z);box(group,.025,.35,.025,0xe8b955,x,y-.43,z)}
function shop(group,x,z,name,color){box(group,4,1.5,2.5,0xead8b3,x,.75,z);box(group,4.3,.16,1.1,color,x,1.6,z+1.2);for(const dx of [-1.35,1.35])box(group,1,.85,.06,0x83adb1,x+dx,.7,z+1.27);textSign(group,name,x,1.18,z+1.34,3.5,'#8b3b31');lantern(group,x-1.7,1.4,z+1.65)}
function bicycles(group,x,z){for(let i=0;i<3;i++){const bike=new THREE.Group();bike.position.set(x+i*.65,.15,z);for(const dz of [-.45,.45]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.28,.04,6,12),material(0x354853));wheel.rotation.y=Math.PI/2;wheel.position.set(0,.25,dz);bike.add(wheel)}box(bike,.06,.48,.6,0xe3b83d,0,.4,0);box(bike,.2,.06,.22,0x253a45,0,.7,-.12);box(bike,.5,.06,.06,0x253a45,0,.8,.45);group.add(bike)}}
export function chineseResidential(name,index=0){
 const style=styles[name]||styles.Shenyang,group=new THREE.Group();group.userData.kind='chinese-residential';
 const hutong=name==='Beijing',height=hutong?2.4:4.8+(index%3)*1.2;
 box(group,4.6,height,3.5,style.wall);box(group,4.9,.22,3.8,style.roof,0,height+.1);
 if(hutong){const roof=new THREE.Mesh(new THREE.ConeGeometry(3.7,1.1,4),material(style.roof));roof.rotation.y=Math.PI/4;roof.scale.z=.82;roof.position.y=height+.55;group.add(roof)}
 for(let y=1;y<height;y+=1.2)for(const x of [-1.5,0,1.5]){box(group,.85,.75,.08,style.glass,x,y,1.79);if(!hutong){box(group,1.05,.09,.45,0xd2d1bf,x,y-.38,1.97);box(group,.6,.38,.18,0xd7ddd8,x+.5,y-.1,1.95)}}
 box(group,.9,1.5,.08,0x365b5c,0,.75,1.81);return group;
}
export function chineseCityDetails(layout,name,{skipCentre=false,skipCrosswalks=false}={}){
 const group=new THREE.Group(),style=styles[name]||styles.Shenyang;group.userData.kind='chinese-streets';
 // Crosswalks and bicycle lanes define the streets rather than a decorative backdrop.
 if(!skipCrosswalks)for(const x of layout.xs.slice(1,-1))for(const z of layout.zs.slice(1,-1))for(let stripe=0;stripe<6;stripe++)box(group,.32,.02,3,0xeee9d9,x-1.45+stripe*.58,.16,z+3.9);
 for(const z of [-48,16]){box(group,136,.03,.65,0x4e9785,0,.16,z+3.2);for(const x of [-51,-17,17,51]){box(group,.08,2.6,.08,0x435e67,x,1.3,z+3.8);textSign(group,style.sign,x,2.5,z+3.85,5)}}
 // The upgraded City Centre prototype brings its own metro entrance, square gateway and decorations.
 if(!skipCentre){const metro=new THREE.Group();metro.position.set(-30,0,4);box(metro,3,.15,2.4,0x7b8d8c,0,.08);for(const x of [-1.35,1.35])box(metro,.1,1.1,2.3,0x415d67,x,.6);box(metro,3.2,.14,2.6,style.roof,0,1.25);textSign(metro,'地铁 METRO · 2号线',0,1.8,1.3,3.8);group.add(metro)}
 const [mx,mz]=layout.positions.market;shop(group,mx-8,mz,'便利店 · MART',0x568476);shop(group,mx+7,mz+5,name==='Chengdu'?'茶馆 · TEA':'面馆 · NOODLES',0xb96b41);bicycles(group,mx-6,mz+4);
 const [sx,sz]=layout.positions.station;textSign(group,style.station+' · 高铁 HIGH SPEED',sx,2.7,sz+1.5,7,'#245f77');
 const [px,pz]=layout.positions.plaza;if(!skipCentre){const gate=new THREE.Group();gate.position.set(px,0,pz-5);for(const x of [-3,3])box(gate,.28,3,.28,0x8f443a,x,1.5);box(gate,6.7,.22,.65,style.roof,0,3);textSign(gate,'哈弗里克广场 · HAFRIK',0,2.7,.35,5);group.add(gate);
 for(const x of [-20,-14])lantern(group,x,2.4,-5)}
 if(name==='Chengdu')for(const x of [-55,-53,-51]){cylinder(group,.07,2.4,0x649c50,x,1.2,28);for(const y of [.8,1.5,2.1])box(group,.8,.06,.2,0x6b9c51,x,y,28)}
 return group;
}
export function chineseVenueDetails(id,name){
 const group=new THREE.Group();group.userData.kind='chinese-venue';
 const names={home:'欢迎回家 · WELCOME HOME',cafe:'咖啡 · COFFEE',market:'欢迎光临 · MARKET',ef:'国际学生中心 · STUDENT CENTRE',campus:'学习交流 · CAMPUS',university:'大学 · UNIVERSITY',liaoning:'大学 · UNIVERSITY',dongbei:'财经课堂 · BUSINESS SCHOOL',gym:'健身 · FITNESS',business:'创业空间 · STARTUP HUB',mall:'购物中心 · SHOPPING',park:'公园 · PARK',night:'音乐现场 · LIVE MUSIC',station:(styles[name]||styles.Shenyang).station,airport:'出发 · DEPARTURES',plaza:'哈弗里克广场 · HAFRIK SQUARE'};
 if(names[id]){if(['market','park','station','plaza'].includes(id)){for(const x of [-4.8,4.8])box(group,.1,2.7,.1,0x4f6469,x,1.35,-4.7);textSign(group,names[id],0,2.5,-4.6,7)}else textSign(group,names[id],1.5,2.7,-4.69,5.5)}
 if(['market','plaza'].includes(id))for(const x of [-4.8,4.8])lantern(group,x,2,-4.6);
 if(id==='cafe'){textSign(group,'拿铁 · 茶 · LATTE',-3,1.8,-2.6,2.4,'#785640')}
 return group;
}
