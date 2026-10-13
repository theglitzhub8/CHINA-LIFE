// v8 home customisation: floors and wallpapers painted onto the tagged floor/wall meshes of a home,
// with the choice saved server-side (home-style.php). Prices here are display only; the server charges.
import * as THREE from './vendor/three.module.js';
const FLOORS={default:['Original',0,null],oak:['Light oak',0,'planks:#c9a274:#b58c5e'],checker:['Retro checker',500,'checker:#f4efe6:#2b2b2b'],carpet:['Teal carpet',400,'flat:#2f8f8a'],bamboo:['Bamboo',700,'planks:#d8c27a:#c4ab60'],tatami:['Tatami',900,'tatami:#c9c48a:#8a7f4a'],herringbone:['Herringbone walnut',1200,'herring:#7a5536:#5e3f27'],marble:['White marble',2400,'marble:#f3f1ec:#c9c4bb']};
const WALLS={default:['Original',0,null],cream:['Warm cream',0,'flat:#f3e9d2'],mint:['Mint',200,'flat:#cfe9dc'],stripes:['Shanghai stripes',350,'stripes:#f6efe1:#1f8e93'],brick:['Hutong brick',600,'brick:#a65a3e:#d9cbb8'],panda:['Panda party',880,'panda:#ffffff:#222222'],dragon:['Lucky dragon red',1200,'dragon:#b3202a:#e8b33a'],damask:['Big Laoban gold',3800,'damask:#2b2b2b:#c9a24a']};
const texCache=new Map();
function paint(spec){if(texCache.has(spec))return texCache.get(spec);const [kind,a,b]=spec.split(':');const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle=a;x.fillRect(0,0,128,128);x.fillStyle=b||a;x.strokeStyle=b||a;
 if(kind==='planks'){x.lineWidth=2;for(let i=0;i<4;i++){x.fillRect(0,i*32,128,2);x.fillRect((i%2)*64+20,i*32,2,32)}}
 else if(kind==='checker'){for(let i=0;i<4;i++)for(let j=0;j<4;j++)if((i+j)%2)x.fillRect(i*32,j*32,32,32)}
 else if(kind==='tatami'){x.lineWidth=4;x.strokeRect(2,2,124,60);x.strokeRect(2,66,60,60);x.strokeRect(66,66,60,60)}
 else if(kind==='herring'){for(let i=-4;i<8;i++){x.save();x.translate(i*24,0);x.rotate(Math.PI/4);x.fillRect(0,0,6,90);x.restore()}}
 else if(kind==='marble'){x.lineWidth=1.5;for(let i=0;i<6;i++){x.beginPath();x.moveTo(Math.random()*128,0);x.bezierCurveTo(Math.random()*128,40,Math.random()*128,90,Math.random()*128,128);x.stroke()}}
 else if(kind==='stripes'){for(let i=0;i<128;i+=32)x.fillRect(i,0,12,128)}
 else if(kind==='brick'){for(let r=0;r<8;r++){x.fillRect(0,r*16,128,2);for(let k=0;k<4;k++)x.fillRect(k*32+(r%2)*16,r*16,2,16)}}
 else if(kind==='panda'){x.font='34px sans-serif';x.fillText('🐼',8,44);x.fillText('🎋',72,108);x.fillText('🐼',76,46);x.fillText('🎋',10,110)}
 else if(kind==='dragon'){x.font='bold 44px serif';x.fillText('福',10,52);x.fillText('龍',70,116);x.beginPath();x.arc(96,32,10,0,7);x.fill();x.beginPath();x.arc(32,96,10,0,7);x.fill()}
 else if(kind==='damask'){for(let i=0;i<2;i++)for(let j=0;j<2;j++){x.beginPath();x.ellipse(32+i*64,32+j*64,14,24,0,0,7);x.fill();x.fillStyle=a;x.beginPath();x.ellipse(32+i*64,32+j*64,6,12,0,0,7);x.fill();x.fillStyle=b}}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;texCache.set(spec,t);return t}
function dressMesh(o,spec,unit){if(!o.userData.origMat)o.userData.origMat=o.material;if(!spec){o.material=o.userData.origMat;return}
 const p=o.geometry?.parameters||{};const w=p.width||4,h=p.height||3,d=p.depth||4;const flat=spec.startsWith('flat:');
 const t=flat?null:paint(spec).clone();if(t){t.needsUpdate=true;const along=Math.max(w,d);t.repeat.set(Math.max(1,along/unit),Math.max(1,(o.userData.homeFloor?Math.min(w,d):h)/unit))}
 o.material=new THREE.MeshStandardMaterial({color:flat?spec.split(':')[1]:0xffffff,map:t,roughness:spec.startsWith('marble')?.25:.8});o.userData.privateMaterial=true}
let current=null,styles={},unlocked=[],loaded=false,peerFor=null;
const api=(m,d)=>window.ChinaLifeAuth.request('/chinalife/home-style.php'+(m==='GET'&&d?.peer?'?peer='+encodeURIComponent(d.peer):''),m,m==='GET'?undefined:d);
function apply(){if(!current)return;const s=styles[current.key]||{};current.group.traverse(o=>{if(!o.isMesh)return;if(o.userData.homeFloor)dressMesh(o,FLOORS[s.floor]?.[2]||null,3.2);else if(o.userData.homeWall)dressMesh(o,WALLS[s.wall]?.[2]||null,1.4)})}
async function load(peer=null){if(!window.ChinaLifeCloud?.signedIn||!window.ChinaLifeAuth)return;try{const r=await api('GET',peer?{peer}:null);const d=r.data||r;if(peer){styles={...styles,...Object.fromEntries(Object.entries(d.styles||{}).map(([k,v])=>['peer:'+peer+':'+k,v]))}}else{styles={...styles,...(d.styles||{})};unlocked=d.unlocked||[];loaded=true}apply()}catch{}}
// Called by world.js after it builds a home interior.
function attach(group,key,visit){const host=visit?.owner||visit?.ownerId||null;current={group,key:host?'peer:'+host+':'+key:key,own:!host,homeKey:key};apply();if(host){if(peerFor!==host){peerFor=host;load(host)}}else if(!loaded)load()}
async function choose(kind,id){if(!current?.own)return window.ChinaLife?.toast?.('Enter your own home first.');const s={floor:'default',wall:'default',...(styles[current.key]||{})};s[kind]=id;
 try{const r=await api('POST',{home:current.homeKey,floor:s.floor,wall:s.wall});const d=r.data||r;styles[current.key]=d.style;unlocked=d.unlocked||unlocked;window.ChinaLife?.applyServerTotals?.(d);apply();window.ChinaLife?.toast?.(d.charged?'🎨 Bought for ¥'+d.charged.toLocaleString()+' and saved.':'🎨 Saved.');render()}catch(e){window.ChinaLife?.toast?.(e.message||'Could not save the style')}}
function preview(kind,id){if(!current)return;const s={...(styles[current.key]||{})};const old=styles[current.key];styles[current.key]={...s,[kind]:id};apply();styles[current.key]=old}
function render(){const el=document.getElementById('homeStylePanel');if(!el)return;const s=styles[current?.key]||{};const row=(kind,cat)=>'<div class="hs-row">'+Object.entries(cat).map(([id,[name,price,spec]])=>{const owned=!price||unlocked.includes(kind+':'+id),on=(s[kind]||'default')===id;return '<button type="button" class="hs-swatch'+(on?' on':'')+'" data-hs-kind="'+kind+'" data-hs-id="'+id+'"><i style="'+(spec?'background-image:url('+(spec.startsWith('flat:')?'':paint(spec).image.toDataURL())+');background-color:'+(spec.split(':')[1]):'background:#ddd')+'"></i><b>'+name+'</b><small>'+(on?'✓ In use':owned?'Owned':'¥'+price.toLocaleString())+'</small></button>'}).join('')+'</div>';
 el.innerHTML='<h3>Floors</h3>'+row('floor',FLOORS)+'<h3>Wallpaper</h3>'+row('wall',WALLS)+'<p class="fine-print">Tap once to preview, tap again to buy and save. Bought styles work in all your homes.</p>';
 el.querySelectorAll('[data-hs-kind]').forEach(b=>b.onclick=()=>{const k=b.dataset.hsKind,id=b.dataset.hsId;if(b.classList.contains('previewing'))return choose(k,id);el.querySelectorAll('.previewing').forEach(x=>x.classList.remove('previewing'));b.classList.add('previewing');preview(k,id)})}
window.ChinaLifeHomeStyle={attach,load,choose,render,apply,get current(){return current},catalog:{FLOORS,WALLS}};
