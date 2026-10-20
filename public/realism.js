// R7 realism prototype (loaded on demand). Realistic people, PBR street materials, sky + sun + IBL with time of day,
// car paint, ACES tone mapping with a light grade. Assets are CC0: people/animations by Quaternius (Universal Base
// Characters, Universal Animation Library), textures by ambientCG. See public/r7/LICENSES.txt.
// Quality: 'high' = everything; 'low' = people + tone mapping + albedo-only roads, no sky/IBL/normal maps (≈ current cost).
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkinned} from './vendor/SkeletonUtils.js';
import {Sky} from './vendor/Sky.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
const BASE='r7/',V='?v=r8a';
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
 const facade=new Map(),reflective=new Set([glassMat,darkGlass]);let envTex=null;const setEnv=t=>{if(envTex===t)return;envTex=t;for(const m of reflective){m.envMap=t;m.needsUpdate=true}};
 function upMat(m,o){if(!m||!m.isMeshStandardMaterial||m.userData.r7)return m;const c=m.color.getHex();
  if(m.transparent&&m.opacity<.75&&!m.map)return q==='high'?glassMat:m;
  const k=kind(c)||flatKind(m,o);if(k==='asphalt')return S('asphalt',{tex:'asphalt',color:0xd4d8dc,rough:1,scale:.22,ns:.8,ao:true});if(k==='paving')return S('paving',{tex:'paving',color:0xd9d6cf,rough:1,scale:.45,ns:1,ao:true});
  if(q!=='high'||m.map||m.vertexColors)return m;
  if(m.emissive&&m.emissive.getHex()!==0&&m.roughness<.3)return m; // lit windows/signs stay as they are
  if(!facade.has(m)){let n;if(o.isMesh&&brickish(m.color))n=S('brick'+c,{tex:'brick',color:m.color.clone().lerp(new THREE.Color(0xffffff),.35).getHex(),rough:1,scale:.5,ns:1.2});
   else{n=m.clone();n.roughness=Math.max(.8,m.roughness)}n.userData.r7=1;facade.set(m,n)}return facade.get(m)}
 // ---------- R8: buildings and street furniture ----------
 // Plain box buildings get a procedural facade in one shader (no new textures, no extra draw calls): window grid with
 // frames and ledges, a ground-floor shopfront band with a coloured sign strip, a cornice at the roofline, and windows
 // that light up at night. Low keeps the window grid, shopfronts and night lights but skips the noise/ledge detail.
 const uNight={value:0};R.night=uNight;let OFF='';try{OFF=localStorage.getItem('r8off')||''}catch{}
 const GLSL_H='float r8h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n';
 const bldMats=new Map();
 function bldMat(src){const k=src.uuid;if(bldMats.has(k))return bldMats.get(k);const m=src.clone();m.userData.r7=1;m.userData.r8bld=1;if(m.map){m.color.multiply(texAvg(m.map));m.map=null}m.emissiveMap=null;m.emissive.set(0);if(q==='high')m.roughness=Math.max(.8,m.roughness);
  m.onBeforeCompile=s=>{s.uniforms.uNight=uNight;m.userData.cmp=(m.userData.cmp||0)+1;
   s.vertexShader='attribute vec4 aBld;varying vec4 vBld;varying vec3 vBP;varying vec3 vBN;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvBP=(modelMatrix*vec4(transformed,1.)).xyz;vBN=normalize(mat3(modelMatrix)*objectNormal);vBld=aBld;');
   s.fragmentShader=(q==='high'?'':'#define R8_LOW\n')+'uniform float uNight;varying vec4 vBld;varying vec3 vBP;varying vec3 vBN;float bGlass=0.;vec3 bEmit=vec3(0.);\n'+GLSL_H+s.fragmentShader
    .replace('#include <map_fragment>',`#include <map_fragment>
{if(vBld.w>.5&&abs(vBN.y)<.5){float h=vBP.y-vBld.x,top=vBld.y-vBld.x,sd=vBld.z;float u=abs(vBN.x)>abs(vBN.z)?vBP.z:vBP.x;vec3 wall=diffuseColor.rgb;
#ifndef R8_LOW
 wall*=.9+r8h(floor(vec2(u,h)*1.7)+sd)*.06+r8h(floor(vec2(u,h)*.3)+sd*1.3)*.09;wall*=mix(.78,1.,smoothstep(0.,1.4,h));
#endif
 vec3 col=wall;float gf=top<5.6?top-.45:3.3;
 if(h<gf){float cw=3.2,cx=fract(u/cw),ci=floor(u/cw),sh=r8h(vec2(ci,sd));vec3 sc=.5+.45*cos(6.2831*(sh+vec3(0.,.33,.67)));
  if(h>gf*.72&&h<gf*.94){col=sc*.8;bEmit=sc*uNight*.85;}
  else if(h>.1&&h<gf*.66&&cx>.07&&cx<.93){float gt=gf*.66;col=mix(vec3(.07,.09,.11),vec3(.30,.35,.40),smoothstep(.2,gt,h));bGlass=1.;bEmit=vec3(1.,.82,.58)*step(.22,sh)*(.18+.9*uNight)*(.55+.45*smoothstep(gt,.3,h));}
  else col=wall*.6+.03;}
 else if(h>=gf&&h<top-.75){float fh=2.9,f=(h-gf)/fh,fy=fract(f),fi=floor(f),cw=2.4,cx=fract(u/cw),ci=floor(u/cw);
  if(cx>.2&&cx<.8&&fy>.24&&fy<.8){float lit=step(.6,r8h(vec2(ci+sd*7.,fi+sd)));col=mix(vec3(.10,.13,.17),vec3(.40,.48,.56),fy);bGlass=1.;bEmit=mix(vec3(1.,.76,.48),vec3(.78,.86,1.),r8h(vec2(fi,ci)))*lit*uNight*1.05;}
  else if(cx>.16&&cx<.84&&fy>.2&&fy<.84)col=wall*.62;
#ifndef R8_LOW
  else if(fy<.07)col=wall*1.1+.03;else if(fy>.95)col=wall*.78;
#endif
 }
 else if(h>=top-.75||h>=gf){col=wall*1.12+.04;
#ifndef R8_LOW
  if(h>top-.14||h<top-.62)col*=.82;
#endif
 }
 diffuseColor.rgb=col;}}`)
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.14,bGlass);')
    .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,.25,bGlass);')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=bEmit;');m.userData.fsHas=s.fragmentShader.includes('bEmit=sc');m.userData.vsHas=s.vertexShader.includes('vBld=aBld')};
  m.customProgramCacheKey=()=>'r8bld'+q;bldMats.set(k,m);return m}
 // Split a (merged) mesh into solids by welding equal corner positions, then tag ground-standing boxes taller than 4 m.
 const B3=THREE.Box3,V3=THREE.Vector3;
 function bldPrep(o){const g=o.geometry,pos=g.attributes.position;if(!pos||pos.count>60000||g.attributes.aBld)return null;const n=pos.count,par=new Int32Array(n);for(let i=0;i<n;i++)par[i]=i;
  const find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i]}return i},uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b};
  const key=new Map();for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*200)+','+Math.round(pos.getY(i)*200)+','+Math.round(pos.getZ(i)*200);const j=key.get(k);if(j===undefined)key.set(k,i);else uni(i,j)}
  const idx=g.index;if(idx)for(let t=0;t<idx.count;t+=3){uni(idx.getX(t),idx.getX(t+1));uni(idx.getX(t),idx.getX(t+2))}else for(let t=0;t<n;t+=3){uni(t,t+1);uni(t,t+2)}
  const comp=new Map(),v=new V3(),nrm=g.attributes.normal;o.updateMatrixWorld();for(let i=0;i<n;i++){const r=find(i);let c=comp.get(r);if(!c){c={b:new B3(),ax:true,v:[]};comp.set(r,c)}v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);c.b.expandByPoint(v);c.v.push(i);if(nrm){const ax=Math.abs(nrm.getX(i)),ay=Math.abs(nrm.getY(i)),az=Math.abs(nrm.getZ(i));if(Math.max(ax,ay,az)<.98)c.ax=false}}
  const a=new Float32Array(n*4),out=[];let any=false;R.lastComps=[...comp.values()].slice(0,8).map(c=>{const z=c.b.getSize(new V3());return [z.x.toFixed(1),z.y.toFixed(1),z.z.toFixed(1),c.b.min.y.toFixed(2),c.v.length]});for(const c of comp.values()){const s=c.b.getSize(new V3());if(s.y>2&&Math.min(s.x,s.z)>1.2&&c.b.min.y<1.2){any=true;const seed=Math.abs(Math.sin(c.b.min.x*12.9898+c.b.min.z*78.233))*43758.5453%97;for(const i of c.v){a[i*4]=c.b.min.y;a[i*4+1]=c.b.max.y;a[i*4+2]=seed;a[i*4+3]=1}out.push({b:c.b,ax:c.ax,seed})}}
  if(!any)return null;g.setAttribute('aBld',new THREE.BufferAttribute(a,4));return out}
 const facadeTex=t=>!!t&&t.image instanceof HTMLCanvasElement&&t.image.width<=256&&t.image.height<=256;
 const avgCol=new Map();function texAvg(t){if(avgCol.has(t))return avgCol.get(t);let c=new THREE.Color(0xd8d2c6);try{const d=t.image.getContext('2d').getImageData(0,0,t.image.width,t.image.height).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=16){const l=d[i]+d[i+1]+d[i+2];if(l>300){r+=d[i];g+=d[i+1];b+=d[i+2];n++}}if(n)c=new THREE.Color().setRGB(r/n/255,g/n/255,b/n/255,THREE.SRGBColorSpace)}catch{}avgCol.set(t,c);return c}
 const isBldCandidate=(o,m)=>o.isMesh&&!o.isInstancedMesh&&m&&m.isMeshStandardMaterial&&(!m.map||facadeTex(m.map))&&!m.transparent&&!m.vertexColors&&!(m.emissive&&m.emissive.getHex()!==0&&!m.emissiveMap)&&!kind(m.color.getHex());
 // Street furniture: awnings over shopfronts, benches and bins beside existing street lamps; fuller tree crowns (High).
 const awnMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85}),woodMat=new THREE.MeshStandardMaterial({color:0x7a5536,roughness:.8}),ironMat=new THREE.MeshStandardMaterial({color:0x2b3238,roughness:.55,metalness:.6}),binMat=new THREE.MeshStandardMaterial({color:0x2f5d46,roughness:.6,metalness:.3});
 for(const m of [awnMat,woodMat,ironMat,binMat])m.userData.r7=1;
 const AWN=[0x1f6f54,0xb5342c,0x24548c,0xd8a73a,0x6b3a6e,0x2c2c2c,0xe8e2d4];
 const benchGeo=(()=>{const parts=[[1.5,.06,.42,0,.45,0],[1.5,.32,.05,0,.72,-.2]].map(([w,h,d,x,y,z])=>new THREE.BoxGeometry(w,h,d).translate(x,y,z));return mergeGeometries(parts)})();
 const benchIron=(()=>{const parts=[];for(const x of [-.66,.66]){parts.push(new THREE.BoxGeometry(.06,.45,.42).translate(x,.22,0),new THREE.BoxGeometry(.06,.4,.05).translate(x,.68,-.21))}return mergeGeometries(parts)})();
 const binGeo=mergeGeometries([new THREE.CylinderGeometry(.22,.2,.78,10).translate(0,.39,0),new THREE.CylinderGeometry(.24,.24,.06,10).translate(0,.81,0)]);
 const crownGeo=(()=>{const parts=[[0,0,0,1],[.55,.18,.25,.72],[-.5,.3,-.28,.68],[.05,.5,-.45,.6]].map(([x,y,z,r])=>{const g=new THREE.IcosahedronGeometry(r,1);const p=g.attributes.position;for(let i=0;i<p.count;i++){const k=1+.09*Math.sin(p.getX(i)*9.1+p.getY(i)*5.3+p.getZ(i)*7.7);p.setXYZ(i,p.getX(i)*k,p.getY(i)*k,p.getZ(i)*k)}return g.translate(x,y,z)});const g=mergeGeometries(parts.map(g=>{g.deleteAttribute('uv');return g}));g.computeVertexNormals();return g})();
 const inside=(blds,x,z,pad=0)=>blds.some(b=>x>b.b.min.x-pad&&x<b.b.max.x+pad&&z>b.b.min.z-pad&&z<b.b.max.z+pad);
 function furnish(root,blds,lamps){const st=root.userData.r8||(root.userData.r8={blds:[],n:0});R.r8root=root;st.blds.push(...blds);const all=st.blds;const mtx=new THREE.Matrix4(),qq=new THREE.Quaternion(),e=new THREE.Euler(),one=new V3(1,1,1),col=new THREE.Color();
  const aw=[];for(const b of blds){if(!b.ax||b.b.max.y-b.b.min.y<2.2)continue;const {min,max}=b.b;const top=max.y-min.y,gf=top<5.6?top-.45:3.3;
   for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]]){const fx=nx>0?max.x:nx<0?min.x:0,fz=nz>0?max.z:nz<0?min.z:0;const along=nx?[min.z,max.z]:[min.x,max.x];const cxm=(min.x+max.x)/2,czm=(min.z+max.z)/2;
    if(inside(all.filter(o=>o!==b),nx?fx+nx*3:cxm,nz?fz+nz*3:czm))continue;
    for(let k=Math.ceil((along[0]+.2)/3.2);(k+1)*3.2<=along[1]-.2;k++){const sh=Math.abs(Math.sin(k*91.7+b.seed*13.1))%1;if(sh<.35)continue;const uc=(k+.5)*3.2;const x=nx?fx+nx*.5:uc,z=nz?fz+nz*.5:uc;aw.push([x,b.b.min.y+gf*.69,z,Math.atan2(nx,nz),AWN[Math.floor(sh*977)%AWN.length]])}}}
  if(aw.length){const g=new THREE.BoxGeometry(2.9,.05,1.0);const im=new THREE.InstancedMesh(g,awnMat,aw.length);aw.forEach(([x,y,z,ry,c],i)=>{e.set(.26,ry,0,'YXZ');qq.setFromEuler(e);mtx.compose(new V3(x,y,z),qq,one);im.setMatrixAt(i,mtx);im.setColorAt(i,col.setHex(c))});im.castShadow=q==='high';im.receiveShadow=true;im.userData.r8=1;root.add(im);done.add(im);st.n+=aw.length}
  const bench=[],bin=[];for(const L of lamps){const pts=[];for(let i=0;i<L.count;i++){L.getMatrixAt(i,mtx);const p=new V3().setFromMatrixPosition(mtx).applyMatrix4(L.matrixWorld);pts.push(p)}
   pts.forEach((p,i)=>{let best=null,bd=9;for(const b of all){const cx=Math.max(b.b.min.x,Math.min(p.x,b.b.max.x)),cz=Math.max(b.b.min.z,Math.min(p.z,b.b.max.z)),d=Math.hypot(p.x-cx,p.z-cz);if(d<bd&&d>.8){bd=d;best=[p.x-cx,p.z-cz]}}if(!best)return;
    const ax=Math.abs(best[0])>Math.abs(best[1]),nx=ax?Math.sign(best[0]):0,nz=ax?0:Math.sign(best[1]);// n points from building to lamp (towards the road)
    const tx=-nz,tz=nx,ry=Math.atan2(nx,nz);if(i%3===0){const x=p.x-nx*Math.min(1.1,bd*.45)+tx*1.4,z=p.z-nz*Math.min(1.1,bd*.45)+tz*1.4;if(!inside(all,x,z,.3))bench.push([x,z,ry,p.y-1.7])}
    if(i%2===1){const x=p.x+tx*.6-nx*.1,z=p.z+tz*.6-nz*.1;if(!inside(all,x,z,.2))bin.push([x,z,0,p.y-1.7])}})}
  const inst=(geo,mat,items)=>{if(!items.length)return;const im=new THREE.InstancedMesh(geo,mat,items.length);items.forEach(([x,z,ry,y],i)=>{qq.setFromAxisAngle(new V3(0,1,0),ry);mtx.compose(new V3(x,y,z),qq,one);im.setMatrixAt(i,mtx)});im.castShadow=false;im.receiveShadow=true;im.userData.r8=1;root.add(im);done.add(im)};
  inst(benchGeo,woodMat,bench);inst(benchIron,ironMat,bench);inst(binGeo,binMat,bin);st.n+=bench.length+bin.length;R.stats.furniture=(R.stats.furniture||0)+aw.length+bench.length+bin.length}
 const done=new WeakSet();
 function decorate(root,where){const nb=[],lamps=[];root.traverse(o=>{if(!o.isMesh||done.has(o)||o.userData.r7person||o.isSkinnedMesh)return;done.add(o);if(o.userData.npc)return;
  if(o.isInstancedMesh){const gp=o.geometry.parameters||{};if(o.geometry.type==='CylinderGeometry'&&gp.height===3.4&&gp.radiusTop===.06)lamps.push(o);else if(q==='high'&&!OFF.includes('crown')&&o.geometry.type==='IcosahedronGeometry'&&gp.radius===1&&gp.detail===0){o.geometry=crownGeo;o.castShadow=true}}
  else if(!OFF.includes('bld')&&!Array.isArray(o.material)&&isBldCandidate(o,o.material)){const b=bldPrep(o);if(b){o.material=bldMat(o.material);o.castShadow=true;o.receiveShadow=true;nb.push(...b);return}}const before=o.material;const after=Array.isArray(before)?before.map(m=>upMat(m,o)):upMat(before,o);if(after!==before){o.material=after;o.receiveShadow=true}if(o.castShadow){const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();if(g.boundingBox.max.y-g.boundingBox.min.y<.6*Math.max(1e-3,o.matrixWorld.elements[5]||1)&&g.boundingBox.max.y<.8)o.castShadow=false}});
  if((nb.length||lamps.length)&&!OFF.includes('furn'))try{furnish(root,nb,lamps)}catch(e){console.warn('r8 furnish',e)}
  if(q==='high')for(const v of ctx.cars())paint(v)}
 const paints=new Map();function paint(g){if(!g||g.userData.r7paint)return;g.userData.r7paint=1;g.traverse(o=>{if(!o.isMesh)return;const m=o.material;if(!m?.isMeshStandardMaterial)return;const c=m.color.getHex();if(c===0x2c3e4c){o.material=darkGlass;return}if(c===0xfff6d0||c===0xd5332f)return;if(!paints.has(m)){const p=new THREE.MeshPhysicalMaterial({color:m.color,metalness:.55,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMap:envTex,envMapIntensity:1.2});p.userData.r7=1;paints.set(m,p);reflective.add(p)}o.material=paints.get(m)})}
 // ---------- Sky, sun, IBL, time of day, haze ----------
 let sky=null,pmrem=null,envRT=null,envKey='',clubEnv=null,cubeRT=null,cubeCam=null;const skyScene=new THREE.Scene();
 if(q==='high'){sky=new Sky();sky.scale.setScalar(900);const u=sky.material.uniforms;u.turbidity.value=6;u.rayleigh.value=1.6;u.mieCoefficient.value=.006;u.mieDirectionalG.value=.82;sky.material.depthWrite=false;skyScene.add(sky);pmrem=new THREE.PMREMGenerator(renderer);cubeRT=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType});cubeCam=new THREE.CubeCamera(1,1000,cubeRT);skyScene.add(cubeCam)}
 const sunDir=new THREE.Vector3(),fog=new THREE.Fog(0xc9d6e2,40,190),tmpC=new THREE.Color();
 const H={day:new THREE.Color(0xcfdbe6),dusk:new THREE.Color(0xe9a777),night:new THREE.Color(0x0d1426)};
 let forced=null,lastStreet=null,savedBg=null;R.setHour=h=>{forced=h;envKey=''};
 function sunFor(h){const elev=68*Math.sin(Math.PI*(h-6)/12),az=THREE.MathUtils.degToRad(200+(h-12)*14);const e=THREE.MathUtils.degToRad(elev);sunDir.set(Math.cos(e)*Math.sin(az),Math.sin(e),Math.cos(e)*Math.cos(az));return elev}
 function light(street,club,hour,focus){
  const h=forced??hour;
  if(club){if(scene.fog===fog)scene.fog=null;renderer.toneMappingExposure=1.05;if(q==='high'){if(!clubEnv)clubEnv=makeClubEnv();setEnv(clubEnv)}return}
  if(!street){if(lastStreet){scene.fog=null;if(savedBg)scene.background=savedBg;savedBg=null}lastStreet=false;renderer.toneMappingExposure=1;return}
  if(!lastStreet){savedBg=scene.background}lastStreet=true;
  const elev=sunFor(h),day=ss(-4,12,elev),dusk=ss(-6,2,elev)*(1-ss(6,22,elev));uNight.value=1-ss(-6,6,elev);
  tmpC.copy(H.night).lerp(H.dusk,ss(-8,0,elev)).lerp(H.day,ss(4,20,elev));
  if(q==='high'){scene.fog=fog;fog.color.copy(tmpC);fog.near=35;fog.far=day>.5?200:150;
   const key=Math.round(h*6);if(key!==envKey){envKey=key;sky.material.uniforms.sunPosition.value.copy(sunDir);const u=sky.material.uniforms;u.rayleigh.value=1.2+dusk*1.8;u.turbidity.value=5+dusk*5;const tm=renderer.toneMapping;renderer.toneMapping=THREE.NoToneMapping;cubeCam.update(renderer,skyScene);renderer.toneMapping=tm;envRT?.dispose();envRT=pmrem.fromCubemap(cubeRT.texture);setEnv(envRT.texture)}
   scene.background=elev>-3?cubeRT.texture:H.night
   for(const m of reflective)m.envMapIntensity=(m===glassMat?1.4:1.2)*(.2+.8*day)}
  else{scene.background=tmpC.clone()}
  // Sun (or moon) follows the player so shadows stay crisp in a tight box.
  const moon=elev<-3;sun.color.set(moon?0xdfe6ff:0xffffff).lerp(new THREE.Color(0xffa463),moon?0:dusk*.9);sun.intensity=moon?.7:.4+2.3*ss(-2,18,elev);
  const d=moon?sunDir.clone().set(-sunDir.x,.55,-sunDir.z).normalize():sunDir;if(focus){sun.position.copy(focus).addScaledVector(d,45);sun.target.position.copy(focus);sun.target.updateMatrixWorld()}
  skyLight.color.copy(moon?new THREE.Color(0x8494bc):new THREE.Color(0xd8e8ff).lerp(new THREE.Color(0xffc9a0),dusk*.6));skyLight.groundColor.set(moon?0x14161c:0x6b6458);skyLight.intensity=moon?.9:(q==='high'?.45+.6*day:1.1+1.1*day);
  renderer.toneMappingExposure=moon?1.4:1+dusk*.08;
  const sc=sun.shadow.camera,ext=q==='high'?18:26;if(sc.right!==ext){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.updateProjectionMatrix()}
  if(q==='high'&&sun.shadow.mapSize.x!==1024){sun.shadow.mapSize.set(1024,1024);sun.shadow.map?.dispose();sun.shadow.map=null}sun.shadow.bias=-.0004;sun.shadow.normalBias=.02}
 function makeClubEnv(){const s=new THREE.Scene();s.background=new THREE.Color(0x05040a);const add=(c,x,y,z,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);s.add(m)};
  add(0xff2a7a,6,3,0,4,1);add(0x2ad1ff,-6,3,0,4,1);add(0x8a4dff,0,4,-6,6,1);add(0xffc14d,0,2,6,3,.6);add(0xffffff,0,9,0,3,3);const rt=pmrem.fromScene(s,0,.1,50);return rt.texture}
 R.clubFloor=(g)=>{if(!g?.material||g.userData.r7floor||q!=='high')return;g.userData.r7floor=1;const m=g.material.clone();m.roughness=.18;m.metalness=.35;m.normalMap=tex('concrete_n');m.normalScale.set(.25,.25);m.envMapIntensity=1.2;m.envMap=envTex;reflective.add(m);worldUV(m,.4);g.material=m};
 // ---------- People ----------
 const tpl={};let clips=null;R.people=Promise.all([glb('man.glb'),glb('woman.glb'),glb('anims.glb')]).then(([m,w,a])=>{tpl.man=prep(m.scene);tpl.woman=prep(w.scene);clips={};for(const c of a.animations){c.tracks=c.tracks.filter(t=>!/^root\.position/.test(t.name));for(const t of c.tracks)if(/^pelvis\.position/.test(t.name)){const v=t.values;for(let i=0;i<v.length;i+=3){v[i]=v[0];v[i+2]=v[2]}}clips[c.name]=c}if(clips.Walk_Formal_Loop){clips.Walk_Loop=clips.Walk_Formal_Loop;clips.Walk_Loop.name='Walk_Loop'}try{relaxIdle(tpl.man)}catch(e){console.warn('relaxed idle',e)}R.ready=true;for(const b of pending)dress(b.g,b.o);pending.length=0}).catch(e=>{console.warn('Realistic people unavailable',e);R.failed=true});

 // R8: the library idle is a guard-up hero stance. Build a calm standing idle from it: keep its breathing/weight shift on the
 // spine and head, stand the legs straight (no crouched guard stance), hang the arms naturally at the sides (palms in, elbows soft) with a slow sway, and open the hands.
 function relaxIdle(rig){const base=clips.Idle_Loop;if(!base)return;rig.updateMatrixWorld(true);const B={};rig.traverse(o=>{if(o.isBone)B[o.name]=o});const T=base.duration;
  const ARM=/^(clavicle|upperarm|lowerarm|hand|index|middle|pinky|ring|thumb|thigh|calf|foot|ball|pelvis|root)/;const tracks=base.tracks.filter(t=>!ARM.test(t.name.split('.')[0]));
  const pel=new THREE.Vector3();B.pelvis.getWorldPosition(pel);
  const q=new THREE.Quaternion(),pw=new THREE.Quaternion(),bw=new THREE.Quaternion(),a=new THREE.Vector3(),b=new THREE.Vector3();
  const aim=(bone,child,dir)=>{bone.getWorldPosition(a);child.getWorldPosition(b);const d=b.sub(a).normalize();bone.getWorldQuaternion(bw);bone.parent.getWorldQuaternion(pw);q.setFromUnitVectors(d,dir.clone().normalize());bw.premultiply(q);const loc=pw.invert().multiply(bw);bone.quaternion.copy(loc);bone.updateMatrixWorld(true);return loc.clone()};
  const keep=[];for(const sd of ['l','r']){const up=B['upperarm_'+sd],lo=B['lowerarm_'+sd],ha=B['hand_'+sd];if(!up||!lo||!ha)return;up.getWorldPosition(a);const side=Math.sign(a.x-pel.x)||1;
   const save=[up.quaternion.clone(),lo.quaternion.clone()];const keys=[];
   for(const f of [.03,.075]){up.quaternion.copy(save[0]);lo.quaternion.copy(save[1]);up.updateMatrixWorld(true);const qu=aim(up,lo,new THREE.Vector3(side*.2,-1,f));const ql=aim(lo,ha,new THREE.Vector3(side*.1,-1,f+.16));keys.push([qu,ql])}
   up.quaternion.copy(save[0]);lo.quaternion.copy(save[1]);rig.updateMatrixWorld(true);
   const tr=(n,i)=>new THREE.QuaternionKeyframeTrack(n+'.quaternion',[0,T/2,T],[...keys[0][i].toArray(),...keys[1][i].toArray(),...keys[0][i].toArray()]);keep.push(tr(up.name,0),tr(lo.name,1))}
  clips.Idle_Loop=new THREE.AnimationClip('Relaxed_Idle',T,tracks.concat(keep))}
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
 R.decorate=decorate;R.bldList=()=>(R.r8root?.userData.r8?.blds||[]).map(b=>({min:b.b.min.toArray(),max:b.b.max.toArray(),ax:b.ax}));R.dbgBld=o=>({cand:isBldCandidate(o,o.material),done:done.has(o),prep:(()=>{try{const g=o.geometry;const had=g.attributes.aBld;const r=had?'had':bldPrep(o);return r==='had'?'had':r?r.length:null}catch(e){return String(e)}})()});R.light=light;R.paint=paint;R.count=()=>people.size;
 return R}
