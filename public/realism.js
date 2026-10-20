// R7 realism prototype (loaded on demand). Realistic people, PBR street materials, sky + sun + IBL with time of day,
// car paint, ACES tone mapping with a light grade. Assets are CC0: people/animations by Quaternius (Universal Base
// Characters, Universal Animation Library), textures by ambientCG. See public/r7/LICENSES.txt.
// Quality: 'high' = everything; 'low' = people + tone mapping + albedo-only roads, no sky/IBL/normal maps (≈ current cost).
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkinned} from './vendor/SkeletonUtils.js';
import {Sky} from './vendor/Sky.js';
const BASE='r7/',V='?v=r7a';
const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
// Subtle grade on top of ACES: a touch of contrast and saturation, slightly warm highlights. Free: runs in the tone-map step.
THREE.ShaderChunk.tonemapping_pars_fragment=THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
 'vec3 CustomToneMapping( vec3 color ) { vec3 c = ACESFilmicToneMapping( color ); float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); c = mix( vec3( l ), c, 1.08 ); c = ( c - 0.5 ) * 1.05 + 0.5; c *= vec3( 1.015, 1.0, 0.985 ); return clamp( c, 0.0, 1.0 ); }');

export function detectQuality(gl){try{const forced=localStorage.getItem('chinalife-gfx');if(forced==='high'||forced==='low')return forced}catch{}
 const ua=navigator.userAgent||'',mem=navigator.deviceMemory,cores=navigator.hardwareConcurrency||4;let gpu='';try{const e=gl.getExtension('WEBGL_debug_renderer_info');gpu=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):''}catch{}
 try{if(localStorage.getItem('chinalife-gfx-auto')==='low')return 'low'}catch{}if(!(gl instanceof WebGL2RenderingContext))return 'low';if(/Mali-[4T][0-9]{0,2}\b|Adreno \(TM\) [3-5]\d\d|PowerVR|SwiftShader|llvmpipe/i.test(gpu))return 'low';
 if(/iPhone|iPad/.test(ua)){const m=ua.match(/OS (\d+)_/);return m&&+m[1]>=16?'high':'low'}
 if(mem!==undefined&&mem<4)return 'low';if(cores<6&&/Android/.test(ua))return 'low';return 'high'}

export function create(ctx){
 const {renderer,scene,sun,skyLight}=ctx;let q=ctx.quality;const R={quality:()=>q,ready:false,stats:{bytes:0}};
 renderer.toneMapping=THREE.CustomToneMapping;renderer.toneMappingExposure=1;
 const loader=new GLTFLoader(),tl=new THREE.TextureLoader();
 const track=url=>fetch(url,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error(url+' '+r.status);return r.arrayBuffer()}).then(b=>{R.stats.bytes+=b.byteLength;return b});
 const glb=url=>track(BASE+url+V).then(b=>new Promise((ok,no)=>loader.parse(b,BASE,ok,no)));
 const tex=(name,srgb,rep=1)=>{const t=tl.load(BASE+'tex/'+name+'.webp'+V,()=>{R.stats.bytes+=0},undefined,()=>{});t.wrapS=t.wrapT=THREE.RepeatWrapping;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=q==='high'?4:1;return t};
 // ---------- Surfaces ----------
 // Box geometry UVs are per face; world-space planar UVs let one texture tile evenly over a merged street of any length.
 const worldUV=(m,scale)=>{m.onBeforeCompile=s=>{s.uniforms.uWS={value:scale};s.vertexShader='uniform float uWS;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n{vec4 wp=modelMatrix*vec4(position,1.0);vec3 an=abs(mat3(modelMatrix)*normal);vec2 tw=an.y>0.5?wp.xz:(an.x>an.z?wp.zy:wp.xy);tw*=uWS;\n#ifdef USE_MAP\nvMapUv=tw;\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv=tw;\n#endif\n#ifdef USE_ROUGHNESSMAP\nvRoughnessMapUv=tw;\n#endif\n#ifdef USE_AOMAP\nvAoMapUv=tw;\n#endif\n}')};m.customProgramCacheKey=()=>'wuv'+scale;return m};
 const surf={};const S=(k,o)=>{if(surf[k])return surf[k];const hi=q==='high',m=new THREE.MeshStandardMaterial({color:o.color??0xffffff,map:o.tex?tex(o.tex+'_c',true):null,roughness:o.rough??1,metalness:0,normalMap:hi&&o.tex?tex(o.tex+'_n'):null,roughnessMap:hi&&o.tex?tex(o.tex+'_orm'):null,aoMap:hi&&o.tex&&o.ao?tex(o.tex+'_orm'):null,aoMapIntensity:.8});if(m.normalMap)m.normalScale.set(o.ns??1,o.ns??1);return surf[k]=worldUV(m,o.scale??.25)};
 const kind=c=>{if(c===0x526b79)return 'asphalt';if(c===0xdce1db)return 'paving';return null};
 // Ground slabs (roads, pavements) by shape: greyish colour, almost all area facing up, below knee height. Dark = asphalt, light = paving.
 const fk=new WeakMap();function flatKind(m,o){if(!o?.isMesh||m.transparent||m.map)return null;if(o===ctx.ground?.())return null;const hsl={};m.color.getHSL(hsl,THREE.SRGBColorSpace);if(hsl.s>.3)return null;const key=o.geometry;if(fk.has(key))return fk.get(key);let r=null;
  const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);if(bb.max.y<.5&&bb.max.x-bb.min.x>3){const pos=g.attributes.position,idx=g.index,n=idx?idx.count:pos.count,A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),N=new THREE.Vector3();let up=0,all=0;for(let i=0;i<n&&i<60000;i+=3){const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;A.fromBufferAttribute(pos,a);B.fromBufferAttribute(pos,b);C.fromBufferAttribute(pos,c);N.subVectors(C,B).cross(A.clone().sub(B));const ar=N.length();all+=ar;if(Math.abs(N.y)>.9*ar)up+=ar}
   if(all>0&&up/all>.8)r=hsl.l<.45?'asphalt':hsl.l>.6?'paving':null}fk.set(key,r);return r}
 const brickish=col=>{const h={};col.getHSL(h,THREE.SRGBColorSpace);return h.h<.075&&h.s>.25&&h.s<.85&&h.l>.18&&h.l<.6};
 const glassMat=new THREE.MeshStandardMaterial({color:0x8fa9b8,metalness:.85,roughness:.06,envMapIntensity:1.4});
 const darkGlass=new THREE.MeshPhysicalMaterial({color:0x10161c,metalness:.2,roughness:.04,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.5});
 const facade=new Map();
 function upMat(m,o){if(!m||!m.isMeshStandardMaterial||m.userData.r7)return m;const c=m.color.getHex();
  if(m.transparent&&m.opacity<.75&&!m.map)return q==='high'?glassMat:m;
  const k=kind(c)||flatKind(m,o);if(k==='asphalt')return S('asphalt',{tex:'asphalt',color:0xd4d8dc,rough:1,scale:.22,ns:.8,ao:true});if(k==='paving')return S('paving',{tex:'paving',color:0xd9d6cf,rough:1,scale:.45,ns:1,ao:true});
  if(q!=='high'||m.map||m.vertexColors)return m;
  if(m.emissive&&m.emissive.getHex()!==0&&m.roughness<.3)return m; // lit windows/signs stay as they are
  if(!facade.has(m)){let n;if(o.isMesh&&brickish(m.color))n=S('brick'+c,{tex:'brick',color:m.color.clone().lerp(new THREE.Color(0xffffff),.35).getHex(),rough:1,scale:.5,ns:1.2});
   else{n=m.clone();n.flatShading=false;n.normalMap=tex('concrete_n');n.normalScale.set(.35,.35);n.roughnessMap=tex('concrete_orm');n.roughness=Math.max(.75,m.roughness);worldUV(n,.3)}n.userData.r7=1;facade.set(m,n)}return facade.get(m)}
 const done=new WeakSet();
 function decorate(root,where){root.traverse(o=>{if(!o.isMesh||done.has(o)||o.userData.r7person||o.isSkinnedMesh)return;done.add(o);if(o.userData.npc)return;const before=o.material;const after=Array.isArray(before)?before.map(m=>upMat(m,o)):upMat(before,o);if(after!==before){o.material=after;o.receiveShadow=true}});
  if(q==='high')for(const v of ctx.cars())paint(v)}
 const paints=new Map();function paint(g){if(!g||g.userData.r7paint)return;g.userData.r7paint=1;g.traverse(o=>{if(!o.isMesh)return;const m=o.material;if(!m?.isMeshStandardMaterial)return;const c=m.color.getHex();if(c===0x2c3e4c){o.material=darkGlass;return}if(c===0xfff6d0||c===0xd5332f)return;if(!paints.has(m)){const p=new THREE.MeshPhysicalMaterial({color:m.color,metalness:.55,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.2});p.userData.r7=1;paints.set(m,p)}o.material=paints.get(m)})}
 // ---------- Sky, sun, IBL, time of day, haze ----------
 let sky=null,pmrem=null,envRT=null,envKey='',clubEnv=null;const skyScene=new THREE.Scene();
 if(q==='high'){sky=new Sky();sky.scale.setScalar(900);const u=sky.material.uniforms;u.turbidity.value=6;u.rayleigh.value=1.6;u.mieCoefficient.value=.006;u.mieDirectionalG.value=.82;sky.material.depthWrite=false;skyScene.add(sky);pmrem=new THREE.PMREMGenerator(renderer)}
 const sunDir=new THREE.Vector3(),fog=new THREE.Fog(0xc9d6e2,40,190),tmpC=new THREE.Color();
 const H={day:new THREE.Color(0xcfdbe6),dusk:new THREE.Color(0xe9a777),night:new THREE.Color(0x0d1426)};
 let forced=null,lastStreet=null,savedBg=null;R.setHour=h=>{forced=h;envKey=''};
 function sunFor(h){const elev=68*Math.sin(Math.PI*(h-6)/12),az=THREE.MathUtils.degToRad(200+(h-12)*14);const e=THREE.MathUtils.degToRad(elev);sunDir.set(Math.cos(e)*Math.sin(az),Math.sin(e),Math.cos(e)*Math.cos(az));return elev}
 function light(street,club,hour,focus){
  const h=forced??hour;
  if(club){if(scene.fog===fog)scene.fog=null;renderer.toneMappingExposure=1.05;if(q==='high'){if(!clubEnv)clubEnv=makeClubEnv();scene.environment=clubEnv;scene.environmentIntensity=.6}return}
  if(!street){if(lastStreet){scene.fog=null;scene.environment=null;if(savedBg)scene.background=savedBg;savedBg=null}lastStreet=false;renderer.toneMappingExposure=1;if(q==='high'&&scene.environment===clubEnv)scene.environment=null;return}
  if(!lastStreet){savedBg=scene.background}lastStreet=true;
  const elev=sunFor(h),day=ss(-4,12,elev),dusk=ss(-6,2,elev)*(1-ss(6,22,elev));
  tmpC.copy(H.night).lerp(H.dusk,ss(-8,0,elev)).lerp(H.day,ss(4,20,elev));
  if(q==='high'){scene.fog=fog;fog.color.copy(tmpC);fog.near=35;fog.far=day>.5?200:150;
   const key=Math.round(h*6);if(key!==envKey){envKey=key;sky.material.uniforms.sunPosition.value.copy(sunDir);const u=sky.material.uniforms;u.rayleigh.value=1.2+dusk*1.8;u.turbidity.value=5+dusk*5;envRT?.dispose();envRT=pmrem.fromScene(skyScene,0,.1,1000);scene.environment=envRT.texture}
   if(elev>-3){scene.background=null;if(!scene.children.includes(sky))scene.add(sky)}else{sky.removeFromParent();scene.background=H.night}
   scene.environmentIntensity=.15+.85*day}
  else{scene.background=tmpC.clone()}
  // Sun (or moon) follows the player so shadows stay crisp in a tight box.
  const moon=elev<-3;sun.color.set(moon?0xdfe6ff:0xffffff).lerp(new THREE.Color(0xffa463),moon?0:dusk*.9);sun.intensity=moon?.7:.4+3.1*ss(-2,18,elev);
  const d=moon?sunDir.clone().set(-sunDir.x,.55,-sunDir.z).normalize():sunDir;if(focus){sun.position.copy(focus).addScaledVector(d,45);sun.target.position.copy(focus);sun.target.updateMatrixWorld()}
  skyLight.color.copy(moon?new THREE.Color(0x8494bc):new THREE.Color(0xd8e8ff).lerp(new THREE.Color(0xffc9a0),dusk*.6));skyLight.groundColor.set(moon?0x14161c:0x6b6458);skyLight.intensity=moon?.9:(q==='high'?.55+.9*day:1.2+1.3*day);
  renderer.toneMappingExposure=moon?1.4:1+dusk*.08;
  const sc=sun.shadow.camera,ext=q==='high'?22:28;if(sc.right!==ext){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.updateProjectionMatrix()}
  if(q==='high'&&sun.shadow.mapSize.x!==2048){sun.shadow.mapSize.set(2048,2048);sun.shadow.map?.dispose();sun.shadow.map=null}sun.shadow.bias=-.0004;sun.shadow.normalBias=.02}
 function makeClubEnv(){const s=new THREE.Scene();s.background=new THREE.Color(0x05040a);const add=(c,x,y,z,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);s.add(m)};
  add(0xff2a7a,6,3,0,4,1);add(0x2ad1ff,-6,3,0,4,1);add(0x8a4dff,0,4,-6,6,1);add(0xffc14d,0,2,6,3,.6);add(0xffffff,0,9,0,3,3);const rt=pmrem.fromScene(s,0,.1,50);return rt.texture}
 R.clubFloor=(g)=>{if(!g?.material||g.userData.r7floor||q!=='high')return;g.userData.r7floor=1;const m=g.material.clone();m.roughness=.18;m.metalness=.35;m.normalMap=tex('concrete_n');m.normalScale.set(.25,.25);m.envMapIntensity=1.2;worldUV(m,.4);g.material=m};
 // ---------- People ----------
 const tpl={};let clips=null;R.people=Promise.all([glb('man.glb'),glb('woman.glb'),glb('anims.glb')]).then(([m,w,a])=>{tpl.man=prep(m.scene);tpl.woman=prep(w.scene);clips={};for(const c of a.animations){c.tracks=c.tracks.filter(t=>!/^root\.position/.test(t.name));for(const t of c.tracks)if(/^pelvis\.position/.test(t.name)){const v=t.values;for(let i=0;i<v.length;i+=3){v[i]=v[0];v[i+2]=v[2]}}clips[c.name]=c}R.ready=true;for(const b of pending)dress(b.g,b.o);pending.length=0}).catch(e=>{console.warn('Realistic people unavailable',e);R.failed=true});
 const REG={pelvis:4,root:4,thigh:4,calf:5,foot:6,ball:6,spine_01:1,spine_02:1,spine_03:1,clavicle:1,upperarm:2,lowerarm:3,neck_01:0,Head:0,hand:0};
 function prep(scene){let height=1.8;scene.traverse(o=>{if(!o.isSkinnedMesh)return;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;const mn=o.material.name||'';
   if(/Superhero/.test(mn)){const names=o.skeleton.bones.map(b=>b.name),cat=names.map(n=>{for(const k in REG)if(n===k||n.startsWith(k+'_')||n.startsWith(k))return REG[k];return /index|middle|pinky|ring|thumb/.test(n)?0:1});const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,r=new Float32Array(si.count);for(let i=0;i<si.count;i++){let best=0,bw=-1;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>bw){bw=w;best=si.getComponent(i,k)}}r[i]=cat[best]}o.geometry.setAttribute('region',new THREE.BufferAttribute(r,1));o.userData.body=1;o.geometry.computeBoundingBox();height=o.geometry.boundingBox.max.y-o.geometry.boundingBox.min.y}
   else if(/Hair/.test(mn))o.userData.hair=1});scene.userData.h=height;return scene}
 const REF=new THREE.Color().setRGB(166/255,120/255,88/255,THREE.SRGBColorSpace);
 const LONG=new Set(['shirt','hoodie','jacket','suit','sweater','qipao','gown']);
 function bodyMat(src,look){const m=src.clone();m.userData.r7=1;const u={uTop:{value:new THREE.Color(look.top)},uBottom:{value:new THREE.Color(look.bottom)},uShoe:{value:new THREE.Color(look.shoes)},uSkinT:{value:(()=>{const c=new THREE.Color(look.skin);return c.setRGB(c.r/REF.r,c.g/REF.g,c.b/REF.b)})()},uF:{value:new THREE.Vector4(look.sleeve,look.long,look.legs,0)}};
  m.onBeforeCompile=s=>{m.userData.sh=s;Object.assign(s.uniforms,u);s.vertexShader='attribute float region;\nvarying float vReg;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvReg=region;');
   s.fragmentShader='uniform vec3 uTop,uBottom,uShoe,uSkinT;uniform vec4 uF;varying float vReg;float r7c;\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{float r=floor(vReg+.5);vec3 cl=uTop;r7c=0.;if(r==1.)r7c=1.;else if(r==2.)r7c=uF.x;else if(r==3.)r7c=uF.y;else if(r==4.){r7c=1.;cl=uBottom;}else if(r==5.){r7c=uF.z;cl=uBottom;}else if(r==6.){r7c=1.;cl=uShoe;}float lum=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(min(diffuseColor.rgb*uSkinT,vec3(1.)),cl*(.78+.5*lum),r7c);}').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.86,r7c);').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,r7c*.6));')};m.customProgramCacheKey=()=>'r7body';return m}
 const pending=[];const hexOf=v=>typeof v==='string'?parseInt(v.replace('#',''),16):v;
 function lookOf(o){const top=o.top||{s:o.outfit==='dress'?'dress':o.outfit==='tank'?'tank':'tee',c:o.shirt},bot=o.bottom||{s:'jeans',c:o.trousers},sh=o.shoes&&typeof o.shoes==='object'?o.shoes:{c:o.shoes};const ts=top.s||'tee',bs=bot.s||'jeans',dress=['dress','gown','qipao'].includes(ts);
  const fem=o.gender==='female'||(o.gender!=='male'&&(dress||bs==='skirt'||['long','bun','buns','ponytail','bob','pigtails','braids'].includes(o.hair)));
  return {fem,top:hexOf(top.c??0x23799a),bottom:hexOf(dress?top.c:(bot.c??0x28394b)),shoes:hexOf(sh.c??0x2b2b2b),skin:hexOf(o.skin??0xa06d4d),hair:hexOf(o.hairColor??0x1f2628),bald:o.hair==='bald'||o.hair==='shaved',sleeve:ts==='tank'?0:1,long:LONG.has(ts)?1:0,legs:bs==='shorts'||(bs==='skirt'&&!dress)?0:1}}
 function dress(g,o){if(!R.ready){pending.push({g,o});return}if(g.userData.r7person||!g.parent&&!g.userData.keep)return;const L=lookOf(o),src=L.fem?tpl.woman:tpl.man,m=cloneSkinned(src);
  m.traverse(c=>{if(!c.isSkinnedMesh)return;c.userData.r7person=1;if(c.userData.body)c.material=bodyMat(c.material,L);else if(c.userData.hair){c.material=c.material.clone();c.material.color.set(L.hair).multiplyScalar(1/.3);c.visible=!L.bald}});
  // Your own character shows as a soft silhouette wherever a wall or tree hides it (drawn only where it is behind something).
  if(o.self)m.traverse(c=>{if(!c.isSkinnedMesh||!c.userData.body||c.userData.ghost)return;const gh=new THREE.SkinnedMesh(c.geometry,ghostMat);gh.userData.ghost=gh.userData.r7person=1;gh.frustumCulled=false;gh.renderOrder=10;gh.bind(c.skeleton,c.bindMatrix);c.parent.add(gh)});
  const s=1.86/src.userData.h;m.scale.setScalar(s);m.userData.r7person=1;
  for(const c of g.children)if(!c.userData.r7keep&&c.name!=='emote-prop'){c.userData.r7hidden=c.visible;c.visible=false}
  g.add(m);const mixer=new THREE.AnimationMixer(m),act={};for(const n of ['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Dance_Loop','Sitting_Idle_Loop'])if(clips[n]){act[n]=mixer.clipAction(clips[n]);act[n].play();act[n].setEffectiveWeight(n==='Idle_Loop'?1:0)}
  for(const a of Object.values(act))a.time=Math.random()*a.getClip().duration;
  g.userData.real={m,mixer,act,w:{Idle_Loop:1},acc:0};people.add(g)}
 const people=new Set(),ghostMat=new THREE.MeshBasicMaterial({color:0x8ff0e6,transparent:true,opacity:.42,depthWrite:false,depthFunc:THREE.GreaterDepth});
 R.dress=(g,o)=>{try{dress(g,o)}catch(e){console.warn('dress',e)}};
 R.frame=(g,moving,dt,spd,emote,far)=>{const r=g.userData.real;if(!r)return false;r.acc+=dt;if(far&&r.acc<.066)return true;const step=r.acc;r.acc=0;
  const height=1.86*g.scale.x,hps=(spd||0)/height,jog=moving&&hps>1.55,want=emote==='dance'?'Dance_Loop':emote==='sit'?'Sitting_Idle_Loop':!moving?'Idle_Loop':jog?'Jog_Fwd_Loop':'Walk_Loop';
  const k=1-Math.exp(-step*10);for(const [n,a] of Object.entries(r.act)){const cur=r.w[n]||0,t=n===want?1:0,nw=cur+(t-cur)*k;r.w[n]=nw;a.setEffectiveWeight(nw)}
  if(r.act.Walk_Loop)r.act.Walk_Loop.timeScale=THREE.MathUtils.clamp(hps/.95,.6,1.7);if(r.act.Jog_Fwd_Loop)r.act.Jog_Fwd_Loop.timeScale=THREE.MathUtils.clamp(hps/1.9,.7,1.4);
  r.mixer.update(step);return true};
 R.undress=g=>{const r=g.userData.real;if(!r)return;r.m.removeFromParent();r.mixer.stopAllAction();for(const c of g.children)if(c.userData.r7hidden!==undefined){c.visible=c.userData.r7hidden;delete c.userData.r7hidden}delete g.userData.real;people.delete(g)};
 R.decorate=decorate;R.light=light;R.paint=paint;R.count=()=>people.size;
 return R}
