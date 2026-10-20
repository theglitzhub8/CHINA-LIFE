// R7 realism prototype (loaded on demand). Realistic people, PBR street materials, sky + sun + IBL with time of day,
// car paint, ACES tone mapping with a light grade. Assets are CC0: people/animations by Quaternius (Universal Base
// Characters, Universal Animation Library), textures by ambientCG. See public/r7/LICENSES.txt.
// Quality: 'high' = everything; 'low' = people + tone mapping + albedo-only roads, no sky/IBL/normal maps (≈ current cost).
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkinned} from './vendor/SkeletonUtils.js';
import {Sky} from './vendor/Sky.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
const BASE='r7/',V='?v=r8b';
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
 const uNight={value:0};R.night=uNight;let OFF='';try{if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)||/[?&]cldebug=1/.test(location.search))OFF=localStorage.getItem('r8off')||''}catch{}// dev-only feature switches
 const GLSL_H='float r8h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n';
 const bldMats=new Map();let _fd,_fn;const facD=()=>_fd||(_fd=tex('fac_day_'+(q==='high'?'h':'l'),true)),facN=()=>_fn||(_fn=tex('fac_night_'+(q==='high'?'h':'l'),true));
 function bldMat(src){const k=src.uuid;if(bldMats.has(k))return bldMats.get(k);const m=src.clone();m.userData.r7=1;m.userData.r8bld=1;if(m.map){m.color.multiply(texAvg(m.map));m.map=null}m.emissiveMap=null;m.emissive.set(0);if(q==='high')m.roughness=Math.max(.8,m.roughness);
  const hiT=q==='high';if(hiT){m.userData.tC=tex('concrete_c',true);m.userData.tB=tex('brick_c',true)}
  m.onBeforeCompile=s=>{s.uniforms.uNight=uNight;s.uniforms.tFacD={value:facD()};s.uniforms.tFacN={value:facN()};if(hiT){s.uniforms.tWallC={value:m.userData.tC};s.uniforms.tWallB={value:m.userData.tB}}
   s.vertexShader='attribute vec4 aBld;attribute vec4 aBldC;flat varying vec4 vBC;flat varying vec4 vBld;varying vec3 vBP;varying vec3 vBN;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvBP=(modelMatrix*vec4(transformed,1.)).xyz;vBN=normalize(mat3(modelMatrix)*objectNormal);vBld=aBld;vBC=aBldC;');
   s.fragmentShader=(OFF.includes('dbga')?'#define R8_DBG vec3(fd.a)\n':OFF.includes('dbgn')?'#define R8_DBG fn\n':OFF.includes('dbg')?'#define R8_DBG fd.rgb\n':'')+(q==='high'?'':'#define R8_LOW\n')+'uniform float uNight;uniform sampler2D tFacD,tFacN;\n#define FACT '+(q==='high'?'1024.':'512.')+'\nflat varying vec4 vBC;\n#ifndef R8_LOW\nuniform sampler2D tWallC,tWallB;\n#endif\nflat varying vec4 vBld;varying vec3 vBP;varying vec3 vBN;float bGlass=0.;vec3 bEmit=vec3(0.);vec3 dbgC=vec3(0.);float dbgOn=0.;\n'+GLSL_H+s.fragmentShader
    .replace('#include <map_fragment>',`#include <map_fragment>
{if(vBld.w>.5&&abs(vBN.y)<.5){float h=vBP.y-vBld.x,top=vBld.y-vBld.x,sd=vBld.z;float u=abs(vBN.x)>abs(vBN.z)?vBP.z:vBP.x;vec3 wall=diffuseColor.rgb;
#ifndef R8_LOW
 float lw=dot(wall,vec3(.3,.59,.11));wall=mix(wall,vec3(lw)*vec3(1.04,1.,.94),.4);if(h<3.4||h>top-.8||top<5.6){float brick=step(.62,fract(sd*.371))*step(h,top-.75);vec3 tc=texture2D(tWallC,vec2(u,h)*.35).rgb,tb=texture2D(tWallB,vec2(u,h)*.55).rgb;vec3 tx=mix(tc/max(dot(tc,vec3(.33)),.05),tb/max(dot(tb,vec3(.33)),.05)*vec3(1.,.82,.7),brick);wall*=mix(vec3(1.),tx,.75);wall*=.94+r8h(floor(vec2(u,h)*.3)+sd*1.3)*.1;wall*=mix(.72,1.,smoothstep(0.,1.2,h));}
#endif
 vec3 col=wall;float gf=top<5.6?top-.45:3.3;
 if(h<gf){float cw=3.2,cx=fract(u/cw),ci=floor(u/cw),sh=r8h(vec2(ci,sd));vec3 sc=.5+.45*cos(6.2831*(sh+vec3(0.,.33,.67)));
  if(h>gf*.72&&h<gf*.94){col=sc*.8;bEmit=sc*sc*uNight*.5;}
  else if(h>.1&&h<gf*.66&&cx>.07&&cx<.93){float gt=gf*.66;col=mix(vec3(.07,.09,.11),vec3(.30,.35,.40),smoothstep(.2,gt,h));bGlass=1.;bEmit=vec3(1.,.78,.52)*step(.22,sh)*(.06+.42*uNight)*(.55+.45*smoothstep(gt,.3,h));}
  else col=wall*.6+.03;}
 else if(h>=gf&&h<top-.75){float sl=floor(fract(sd)*10.+.5);
  vec2 tuv=vec2((u-(abs(vBN.x)>abs(vBN.z)?vBC.y:vBC.x))/18.+r8h(vec2(sd,1.7))*.0,(h-gf)/18.),f=fract(tuv),o=vec2(mod(sl,2.)*.5,.5-floor(sl*.5)*.5),au=o+.003+f*.494;
  vec2 gx=dFdx(tuv),gy=dFdy(tuv);float lod=max(0.,log2(max(length(gx),length(gy))*FACT));vec4 fd=textureLod(tFacD,au,lod);vec3 fn=textureLod(tFacN,au,max(0.,lod-1.)).rgb;
  float lw2=dot(wall,vec3(.3,.59,.11));vec3 tint=lw2>.03?clamp(mix(vec3(1.),wall/lw2,sl>2.5?.08:.22),.75,1.3):vec3(1.);
  col=fd.rgb*mix(tint,vec3(1.),fd.a)*(sl>2.5?1.7:1.05);bGlass=fd.a*(sl>2.5?.85:1.);if(sl>2.5){vec2 ce=floor(tuv*vec2(16.,10.));fn=mix(vec3(1.,.8,.55),vec3(.8,.9,1.),r8h(ce.yx+sd))*step(.74,r8h(ce+sd*3.1))*.55;}vec2 wc=floor(tuv*6.);fn*=step(.45,r8h(wc+sd*5.3));bEmit=fn*vec3(1.,.86,.68)*fd.a*uNight*.4+col*(.16+.22*fd.a)*(1.-uNight);
#ifdef R8_DBG
dbgC=R8_DBG;dbgOn=1.;
#endif

 }
 else if(h>=top-.75||h>=gf){col=wall*1.12+.04;
#ifndef R8_LOW
  if(h>top-.14||h<top-.62)col*=.82;
#endif
 }
 diffuseColor.rgb=col;}
 else if(vBld.w>.5&&vBN.y>.5&&vBP.y>vBld.y-.05){float e=min(min(vBP.x-vBC.x,vBC.z-vBP.x),min(vBP.z-vBC.y,vBC.w-vBP.z));vec3 rc=vec3(.42,.43,.44);
#ifndef R8_LOW
 vec3 tc2=texture2D(tWallC,vBP.xz*.3).rgb;rc*=tc2/max(dot(tc2,vec3(.33)),.05)*.9+.1;
#endif
 vec2 sg=fract(vBP.xz*.5);rc*=.92+.08*step(.04,sg.x)*step(.04,sg.y);rc*=.9+.15*r8h(floor(vBP.xz*.25)+vBld.z);
 if(e<.32)rc=vec3(.62,.6,.57)*(e<.05?.7:1.);else if(e<.5)rc*=.6;diffuseColor.rgb=rc;}}`)
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.22,bGlass);')
    .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,.12,bGlass);')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=bEmit;').replace('#include <dithering_fragment>','#include <dithering_fragment>\n#ifdef R8_DBG\nif(dbgOn>.5)gl_FragColor=vec4(dbgC,1.);\n#endif')};
  m.customProgramCacheKey=()=>'r8bld'+q;bldMats.set(k,m);return m}
 // Split a (merged) mesh into solids by welding equal corner positions, then tag ground-standing boxes taller than 4 m.
 const B3=THREE.Box3,V3=THREE.Vector3;
 function bldPrep(o){const g=o.geometry,pos=g.attributes.position;if(!pos||pos.count>200000||g.attributes.aBld)return null;const n=pos.count,par=new Int32Array(n);for(let i=0;i<n;i++)par[i]=i;
  const find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i]}return i},uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b};
  const key=new Map();for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*200)+','+Math.round(pos.getY(i)*200)+','+Math.round(pos.getZ(i)*200);const j=key.get(k);if(j===undefined)key.set(k,i);else uni(i,j)}
  const idx=g.index;if(idx)for(let t=0;t<idx.count;t+=3){uni(idx.getX(t),idx.getX(t+1));uni(idx.getX(t),idx.getX(t+2))}else for(let t=0;t<n;t+=3){uni(t,t+1);uni(t,t+2)}
  const comp=new Map(),v=new V3(),nrm=g.attributes.normal;o.updateMatrixWorld();for(let i=0;i<n;i++){const r=find(i);let c=comp.get(r);if(!c){c={b:new B3(),ax:true,v:[]};comp.set(r,c)}v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);c.b.expandByPoint(v);c.v.push(i);if(nrm){const ax=Math.abs(nrm.getX(i)),ay=Math.abs(nrm.getY(i)),az=Math.abs(nrm.getZ(i));if(Math.max(ax,ay,az)<.98)c.ax=false}}
  const a=new Float32Array(n*4),ac=new Float32Array(n*4),out=[];let any=false;for(const c of comp.values()){const s=c.b.getSize(new V3());if(s.y>1.9&&(Math.min(s.x,s.z)>1.2||Math.max(s.x,s.z)>2.5&&Math.min(s.x,s.z)>.12)&&c.b.min.y<4.5&&c.v.length>=8){any=true;const hs=Math.abs(Math.sin(c.b.min.x*12.9898+c.b.min.z*78.233))*43758.5453,top=s.y,slot=top>16&&(hs*7.13%1)>.45?3:Math.floor((hs*3.71%1)*2.999),seed=Math.floor(hs%97)+slot*.1;for(const i of c.v){a[i*4]=c.b.min.y;a[i*4+1]=c.b.max.y;a[i*4+2]=seed;a[i*4+3]=1;ac[i*4]=c.b.min.x;ac[i*4+1]=c.b.min.z;ac[i*4+2]=c.b.max.x;ac[i*4+3]=c.b.max.z}out.push({b:c.b,ax:c.ax,seed,slot})}}
  if(!any)return null;g.setAttribute('aBld',new THREE.BufferAttribute(a,4));g.setAttribute('aBldC',new THREE.BufferAttribute(ac,4));return out}
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
 const crownGeo=(()=>{const parts=[[0,0,0,1],[.55,.2,.25,.7],[-.48,.32,-.3,.66]].map(([x,y,z,r])=>{const g=new THREE.IcosahedronGeometry(r,0);const p=g.attributes.position;for(let i=0;i<p.count;i++){const k=1+.09*Math.sin(p.getX(i)*9.1+p.getY(i)*5.3+p.getZ(i)*7.7);p.setXYZ(i,p.getX(i)*k,p.getY(i)*k,p.getZ(i)*k)}return g.translate(x,y,z)});const g=mergeGeometries(parts.map(g=>{g.deleteAttribute('uv');return g}));g.computeVertexNormals();return g})();
 const unitBox=new THREE.BoxGeometry(1,1,1),balSlab=new THREE.BoxGeometry(2.2,.14,1.1),balRail=mergeGeometries([new THREE.BoxGeometry(2.2,.95,.05).translate(0,.55,.53),new THREE.BoxGeometry(.05,.95,1.1).translate(-1.08,.55,0),new THREE.BoxGeometry(.05,.95,1.1).translate(1.08,.55,0),new THREE.BoxGeometry(2.24,.06,.08).translate(0,1.04,.53)]);
 const ledgeMat=new THREE.MeshStandardMaterial({color:0xa29d93,roughness:.95}),railMat=new THREE.MeshStandardMaterial({color:0x30383d,roughness:.4,metalness:.6});ledgeMat.userData.r7=railMat.userData.r7=1;
 const acGeo=mergeGeometries([new THREE.BoxGeometry(1.1,.75,.8).translate(0,.45,0),new THREE.BoxGeometry(1.2,.08,.9).translate(0,.04,0)]),tankGeo=mergeGeometries([new THREE.CylinderGeometry(.75,.75,1.5,12).translate(0,1.35,0),new THREE.BoxGeometry(1.4,.6,1.4).translate(0,.3,0)]),hutGeo=new THREE.BoxGeometry(2.2,2.3,2.4).translate(0,1.15,0);
 const acMat=new THREE.MeshStandardMaterial({color:0xc4c8ca,roughness:.5,metalness:.5}),tankMat=new THREE.MeshStandardMaterial({color:0x8f989c,roughness:.45,metalness:.6}),hutMat=new THREE.MeshStandardMaterial({color:0xb9b4aa,roughness:.95});for(const m of [acMat,tankMat,hutMat])m.userData.r7=1;
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
  // Rooftops: AC units, water tanks and stair huts (instanced, three draw calls for the whole city).
  const acs=[],tanks=[],huts=[];for(const b of blds){if(!b.ax)continue;const {min,max}=b.b,top=max.y-min.y,w=max.x-min.x,d=max.z-min.z;if(top<4||w<3||d<3)continue;const rnd=k=>Math.abs(Math.sin(b.seed*12.9898+k*78.233)*43758.5453)%1;
   const nA=Math.max(1,Math.min(5,Math.floor(w*d/30)));for(let k=0;k<nA;k++)acs.push([min.x+1+rnd(k)*(w-2),min.z+1+rnd(k+9)*(d-2),rnd(k+3)>.5?0:Math.PI/2,max.y]);
   if(top>8&&w>5&&d>5){if(rnd(20)>.4)tanks.push([min.x+1.6+rnd(21)*(w-3.2),min.z+1.6+rnd(22)*(d-3.2),0,max.y]);huts.push([min.x+1.6+rnd(23)*(w-3.2),min.z+1.6+rnd(24)*(d-3.2),0,max.y])}}
  // Facade depth: floor ledges and corner pilasters on open faces, balconies on residential (brick) facades (High).
  const led=[],bal=[],bay=[];for(const b of blds){if(!b.ax)continue;const {min,max}=b.b,top=max.y-min.y;if(top<1.9)continue;const gf=top<5.6?top-.45:3.3;const rnd=k=>Math.abs(Math.sin(b.seed*12.9898+k*78.233)*43758.5453)%1;
   for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]]){const fx=nx>0?max.x:nx<0?min.x:0,fz=nz>0?max.z:nz<0?min.z:0,a0=nx?min.z:min.x,a1=nx?max.z:max.x,L=a1-a0,cm=(a0+a1)/2,ry=Math.atan2(nx,nz);
    if(inside(all.filter(o=>o!==b),nx?fx+nx*2.5:cm,nz?fz+nz*2.5:cm)&&inside(all.filter(o=>o!==b),nx?fx+nx*2.5:a0+.5,nz?fz+nz*2.5:a0+.5))continue;
    const P=(along,out,y)=>nx?[fx+nx*out,y,along]:[along,y,fz+nz*out];
    for(let y=gf;y<top-.9;y+=3){const [x,yy,z]=P(cm,.1,min.y+y);led.push([x,yy,z,ry,L+.2,.12,.18])}
    for(const e of [a0,a1]){const [x,yy,z]=P(e,0,min.y+top/2);led.push([x,yy,z,ry,.42,top-.2,.42])}{const [x,yy,z]=P(cm,.18,max.y-.16);led.push([x,yy,z,ry,L+.5,.32,.36])}
    for(let k=Math.ceil((a0+.2)/3.2);(k+1)*3.2<=a1-.2;k++){const sh=Math.abs(Math.sin(k*91.7+b.seed*13.1))%1;if(sh<.35)continue;const bh=gf*.6,[x,yy,z]=P((k+.5)*3.2,.16,min.y+.12+bh/2);bay.push([x,yy,z,ry,2.6,bh,.32])}
    if(q==='high'&&b.slot!==3&&top>5){for(let y=gf+3;y<top-1.5;y+=3)for(let k=0;(k+1)*3<=L-.4;k++){if(rnd(k*7+y*3+nx*2+nz*5)<(b.slot===1?.7:.35))continue;const [x,yy,z]=P(a0+((L-Math.floor(L/3)*3)/2)+(k+.5)*3,.55,min.y+y+.05);bal.push([x,yy,z,ry])}}}}
  if(led.length){const im=new THREE.InstancedMesh(unitBox,ledgeMat,led.length);led.forEach(([x,y,z,ry,w,h,d],i)=>{qq.setFromAxisAngle(new V3(0,1,0),ry);mtx.compose(new V3(x,y,z),qq,new V3(w,h,d));im.setMatrixAt(i,mtx)});im.castShadow=false;im.receiveShadow=true;im.userData.r8=1;root.add(im);done.add(im)}
  if(bay.length){const im=new THREE.InstancedMesh(unitBox,q==='high'?darkGlass:railMat,bay.length);bay.forEach(([x,y,z,ry,w,h,d],i)=>{qq.setFromAxisAngle(new V3(0,1,0),ry);mtx.compose(new V3(x,y,z),qq,new V3(w,h,d));im.setMatrixAt(i,mtx)});im.receiveShadow=true;im.userData.r8=1;root.add(im);done.add(im);const fr=new THREE.InstancedMesh(unitBox,ironMat,bay.length);bay.forEach(([x,y,z,ry,w,h,d],i)=>{qq.setFromAxisAngle(new V3(0,1,0),ry);mtx.compose(new V3(x,y+h/2+.05,z),qq,new V3(w+.12,.1,d+.06));fr.setMatrixAt(i,mtx)});fr.userData.r8=1;root.add(fr);done.add(fr);R.stats.bays=bay.length}
  inst(balSlab,ledgeMat,bal.map(([x,y,z,ry])=>[x,z,ry,y]));inst(balRail,railMat,bal.map(([x,y,z,ry])=>[x,z,ry,y]));st.n+=led.length+bal.length;R.stats.ledges=led.length;R.stats.balconies=bal.length;
  inst(acGeo,acMat,acs);inst(tankGeo,tankMat,tanks);inst(hutGeo,hutMat,huts);st.n+=acs.length+tanks.length+huts.length;
  inst(benchGeo,woodMat,bench);inst(benchIron,ironMat,bench);inst(binGeo,binMat,bin);st.n+=bench.length+bin.length;R.stats.furniture=(R.stats.furniture||0)+aw.length+bench.length+bin.length}
 const done=new WeakSet(),allBld=[];
 // Photo facades replace the old modelled window panes/frames/ledges on upper floors; collapse those triangles so they
 // do not z-fight with the facade (ground-floor shopfront parts, signs, roofs and cornices stay).
 function stripWin(root,blds){if(!blds.length)return;const zs=blds.map(b=>{const t=b.b.max.y-b.b.min.y;return {b:b.b,y0:b.b.min.y+(t<5.6?t-.45:3.3)+.05,y1:b.b.max.y-.8}}).filter(z=>z.y1>z.y0);if(!zs.length)return;let n=0;const a=new V3(),b2=new V3(),c=new V3();
  root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||o.userData.r7person||o.userData.r8||o.userData.npc||o.userData.r8s===blds.length)return;o.userData.r8s=blds.length;const g=o.geometry;if(!g?.attributes?.position||g.attributes.aBld||Array.isArray(o.material))return;const m=o.material;if(!m||!(m.isMeshStandardMaterial||m.isMeshBasicMaterial&&m.map)||m.transparent)return;const P=m.isMeshBasicMaterial?.15:.45;
   if(!g.boundingBox)g.computeBoundingBox();const wb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);if(!zs.some(z=>wb.min.x<z.b.max.x+P&&wb.max.x>z.b.min.x-P&&wb.min.z<z.b.max.z+P&&wb.max.z>z.b.min.z-P&&wb.max.y>z.y0&&wb.min.y<z.y1))return;
   const pos=g.attributes.position,idx=g.index,nt=(idx?idx.count:pos.count)/3;let hit=[];for(let t=0;t<nt;t++){const i0=idx?idx.getX(t*3):t*3,i1=idx?idx.getX(t*3+1):t*3+1,i2=idx?idx.getX(t*3+2):t*3+2;a.fromBufferAttribute(pos,i0);b2.fromBufferAttribute(pos,i1);c.fromBufferAttribute(pos,i2);a.add(b2).add(c).multiplyScalar(1/3).applyMatrix4(o.matrixWorld);
    for(const z of zs){if(a.y>z.y0&&a.y<z.y1&&a.x>z.b.min.x-P&&a.x<z.b.max.x+P&&a.z>z.b.min.z-P&&a.z<z.b.max.z+P){hit.push(t);break}}}
   if(!hit.length)return;const ng=o.userData.r8own?g:g.clone();o.userData.r8own=1;o.geometry=ng;if(ng.index){const ia=ng.index.array;for(const t of hit){ia[t*3+1]=ia[t*3+2]=ia[t*3]}ng.index.needsUpdate=true}else{const pa=ng.attributes.position.array;for(const t of hit)for(let k=1;k<3;k++)for(let d=0;d<3;d++)pa[(t*3+k)*3+d]=pa[t*9+d];ng.attributes.position.needsUpdate=true}n+=hit.length});R.stats.stripped=(R.stats.stripped||0)+n}
 function decorate(root,where){const nb=[],lamps=[];root.traverse(o=>{if(!o.isMesh||done.has(o)||o.userData.r7person||o.isSkinnedMesh)return;done.add(o);if(o.userData.npc)return;
  if(o.isInstancedMesh){const gp=o.geometry.parameters||{};if(o.geometry.type==='CylinderGeometry'&&gp.height===3.4&&gp.radiusTop===.06)lamps.push(o);else if(q==='high'&&!OFF.includes('crown')&&o.geometry.type==='IcosahedronGeometry'&&gp.radius===1&&gp.detail===0){o.geometry=crownGeo;o.castShadow=true}}
  else if(!OFF.includes('bld')&&!Array.isArray(o.material)&&isBldCandidate(o,o.material)){const b=bldPrep(o);if(b){o.material=bldMat(o.material);o.castShadow=true;o.receiveShadow=true;nb.push(...b);return}}const before=o.material;const after=Array.isArray(before)?before.map(m=>upMat(m,o)):upMat(before,o);if(after!==before){o.material=after;o.receiveShadow=true}if(o.castShadow){const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();if(g.boundingBox.max.y-g.boundingBox.min.y<.6*Math.max(1e-3,o.matrixWorld.elements[5]||1)&&g.boundingBox.max.y<.8)o.castShadow=false}});
  if(nb.length)allBld.push(...nb);if(allBld.length&&!OFF.includes('strip'))try{stripWin(scene,allBld)}catch(e){console.warn('r8 strip',e)}
  if((nb.length||lamps.length)&&!OFF.includes('furn'))try{furnish(root,nb,lamps)}catch(e){console.warn('r8 furnish',e)}
  if(q==='high')for(const v of ctx.cars())paint(v)}
 const paints=new Map();function paint(g){if(!g||g.userData.r7paint)return;g.userData.r7paint=1;g.traverse(o=>{if(!o.isMesh)return;const m=o.material;if(!m?.isMeshStandardMaterial)return;const c=m.color.getHex();if(c===0x2c3e4c){o.material=darkGlass;return}if(c===0xfff6d0||c===0xd5332f)return;if(!paints.has(m)){const p=new THREE.MeshPhysicalMaterial({color:m.color,metalness:.55,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMap:envTex,envMapIntensity:1.2});p.userData.r7=1;paints.set(m,p);reflective.add(p)}o.material=paints.get(m)})}
 // ---------- Sky, sun, IBL, time of day, haze ----------
 let sky=null,pmrem=null,envRT=null,envKey='',clubEnv=null,cubeRT=null,cubeCam=null;const skyScene=new THREE.Scene();
 if(q==='high'){sky=new Sky();sky.scale.setScalar(900);const u=sky.material.uniforms;u.turbidity.value=6;u.rayleigh.value=1.6;u.mieCoefficient.value=.006;u.mieDirectionalG.value=.82;sky.material.depthWrite=false;skyScene.add(sky);pmrem=new THREE.PMREMGenerator(renderer);cubeRT=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType});cubeCam=new THREE.CubeCamera(1,1000,cubeRT);skyScene.add(cubeCam)}
 const sunDir=new THREE.Vector3(),fog=new THREE.Fog(0xc9d6e2,40,190),tmpC=new THREE.Color();
 // R8 sky dome: gradient sky (zenith to horizon haze), sun glow, faint stars at night and a distant skyline silhouette with
 // lit windows after dark. One draw call, follows the camera, not fogged; the fog colour matches its horizon.
 const SK={zen:new THREE.Color(),hor:new THREE.Color(),sil:new THREE.Color()};
 const skyU={uZen:{value:SK.zen},uHor:{value:SK.hor},uSil:{value:SK.sil},uSun:{value:new THREE.Vector3(0,1,0)},uSunC:{value:new THREE.Color()},uNightK:uNight};
 const dome=new THREE.Mesh(new THREE.SphereGeometry(200,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vD;void main(){vD=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
  fragmentShader:`uniform vec3 uZen,uHor,uSil,uSun,uSunC;uniform float uNightK;varying vec3 vD;
float h1(float x){return fract(sin(x*127.1)*43758.5453);}float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec3 d=normalize(vD);float e=d.y,a=atan(d.z,d.x);
 vec3 c=mix(uHor,uZen,pow(smoothstep(-.02,.55,e),.7));float sd=max(dot(d,normalize(uSun)),0.);c+=uSunC*(pow(sd,8.)*.35+pow(sd,300.)*2.5);
 vec2 sp=vec2(a*90.,e*90.);float st=step(.9965,h2(floor(sp)))*smoothstep(.05,.3,e)*uNightK;c+=vec3(st*.8);
 float u=a*60.,bi=floor(u),bh=.012+.075*pow(h1(bi),2.2)+.03*h1(floor(a*9.));float bw=fract(u);
 if(e<bh&&e>-.2){vec3 sc=uSil;float wy=fract(e*260.),wx=fract(bw*7.);float win=step(.35,wx)*step(.3,wy)*step(.6,h2(vec2(floor(bw*7.)+bi*7.,floor(e*260.))));sc+=vec3(1.,.8,.5)*win*uNightK*.55*step(.05,bw)*step(bw,.95);
  c=mix(sc,c,smoothstep(bh-.004,bh,e)*0.);c=e<bh?sc:c;}
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`}));
 dome.frustumCulled=false;dome.renderOrder=-10;dome.userData.r8=1;dome.onBeforeRender=(r,s,cam)=>{dome.position.copy(cam.position)};dome.visible=false;scene.add(dome);
 const H={day:new THREE.Color(0xcfdbe6),dusk:new THREE.Color(0xe9a777),night:new THREE.Color(0x0d1426)};
 let forced=null,lastStreet=null,savedBg=null;R.setHour=h=>{forced=h;envKey=''};
 function sunFor(h){const elev=68*Math.sin(Math.PI*(h-6)/12),az=THREE.MathUtils.degToRad(200+(h-12)*14);const e=THREE.MathUtils.degToRad(elev);sunDir.set(Math.cos(e)*Math.sin(az),Math.sin(e),Math.cos(e)*Math.cos(az));return elev}
 function light(street,club,hour,focus){
  const h=forced??hour;
  dome.visible=!!street&&!club;
  if(club){if(scene.fog===fog)scene.fog=null;renderer.toneMappingExposure=1.05;if(q==='high'){if(!clubEnv)clubEnv=makeClubEnv();setEnv(clubEnv)}return}
  if(!street){if(lastStreet){scene.fog=null;if(savedBg)scene.background=savedBg;savedBg=null}lastStreet=false;renderer.toneMappingExposure=1;return}
  if(!lastStreet){savedBg=scene.background}lastStreet=true;
  const elev=sunFor(h),day=ss(-4,12,elev),dusk=ss(-6,2,elev)*(1-ss(6,22,elev));uNight.value=1-ss(-6,6,elev);
  tmpC.copy(H.night).lerp(H.dusk,ss(-8,0,elev)).lerp(H.day,ss(4,20,elev));
  {const n=uNight.value;SK.zen.set(0x2f6fc4).lerp(new THREE.Color(0x3a4f86),dusk).lerp(new THREE.Color(0x050a1c),n);SK.hor.set(0xbcd3ea).lerp(new THREE.Color(0xf2a066),dusk).lerp(new THREE.Color(0x15203a),n);
   SK.sil.copy(SK.hor).lerp(new THREE.Color(0x6f7f92),.45*(1-n)).lerp(new THREE.Color(0x05070d),n*.85).lerp(new THREE.Color(0x4a3340),dusk*.4);skyU.uSun.value.copy(sunDir);skyU.uSunC.value.set(0xfff1d6).lerp(new THREE.Color(0xff8a3c),dusk).multiplyScalar(1-n)}
  tmpC.copy(SK.hor).lerp(SK.sil,.5);
  if(q==='high'){scene.fog=fog;fog.color.copy(tmpC);fog.near=60;fog.far=day>.5?240:190;
   const key=Math.round(h*6);if(key!==envKey){envKey=key;sky.material.uniforms.sunPosition.value.copy(sunDir);const u=sky.material.uniforms;u.rayleigh.value=1.2+dusk*1.8;u.turbidity.value=5+dusk*5;const tm=renderer.toneMapping;renderer.toneMapping=THREE.NoToneMapping;cubeCam.update(renderer,skyScene);renderer.toneMapping=tm;envRT?.dispose();envRT=pmrem.fromCubemap(cubeRT.texture);setEnv(envRT.texture)}
   scene.background=SK.hor
   for(const m of reflective)m.envMapIntensity=(m===glassMat?1.4:1.2)*(.2+.8*day)}
  else{scene.fog=fog;fog.color.copy(tmpC);fog.near=60;fog.far=220;scene.background=SK.hor}
  // Sun (or moon) follows the player so shadows stay crisp in a tight box.
  const moon=elev<-3;sun.color.set(moon?0xdfe6ff:0xffffff).lerp(new THREE.Color(0xffa463),moon?0:dusk*.9);sun.intensity=moon?.7:.4+2.3*ss(-2,18,elev);
  const d=moon?sunDir.clone().set(-sunDir.x,.55,-sunDir.z).normalize():sunDir;if(focus){sun.position.copy(focus).addScaledVector(d,45);sun.target.position.copy(focus);sun.target.updateMatrixWorld()}
  skyLight.color.copy(moon?new THREE.Color(0x8494bc):new THREE.Color(0xd8e8ff).lerp(new THREE.Color(0xffc9a0),dusk*.6));skyLight.groundColor.set(moon?0x3a3226:0x6b6458);skyLight.intensity=moon?1.6:(q==='high'?.45+.6*day:1.1+1.1*day);
  renderer.toneMappingExposure=moon?1.3:1+dusk*.08;nightBasics(uNight.value);
  const sc=sun.shadow.camera,ext=q==='high'?18:26;if(sc.right!==ext){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.updateProjectionMatrix()}
  if(q==='high'&&sun.shadow.mapSize.x!==1024){sun.shadow.mapSize.set(1024,1024);sun.shadow.map?.dispose();sun.shadow.map=null}sun.shadow.bias=-.0004;sun.shadow.normalBias=.02}
 // R8: unlit near-white panels (old window/sign decals, glass strips) glare at night; ease them to a dim warm glow.
let bmRoot=null,bmList=[];const bmWarm=new THREE.Color(0x8a6c48);
function nightBasics(n){const r=R.r8root;if(!r)return;if(bmRoot!==r||bmList.n!==r.children.length){bmRoot=r;bmList=[];bmList.n=r.children.length;const seen=new Set();r.traverse(o=>{const m=o.material;if(!o.isMesh||!m||Array.isArray(m)||seen.has(m)||o.userData.limbs)return;seen.add(m);if(m.isMeshBasicMaterial){const c=m.color;if(c.r+c.g+c.b>2.1)bmList.push([m,c.clone(),'color'])}else if(m.emissive){const e=m.emissive.r+m.emissive.g+m.emissive.b;if(e*(m.emissiveIntensity??1)>1.6&&Math.min(m.emissive.r,m.emissive.g,m.emissive.b)>.45)bmList.push([m,m.emissive.clone(),'emissive'])}})}for(const [m,c,k] of bmList)m[k].copy(c).lerp(bmWarm,n*.6)}
function makeClubEnv(){const s=new THREE.Scene();s.background=new THREE.Color(0x05040a);const add=(c,x,y,z,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);s.add(m)};
  add(0xff2a7a,6,3,0,4,1);add(0x2ad1ff,-6,3,0,4,1);add(0x8a4dff,0,4,-6,6,1);add(0xffc14d,0,2,6,3,.6);add(0xffffff,0,9,0,3,3);const rt=pmrem.fromScene(s,0,.1,50);return rt.texture}
 R.clubFloor=(g)=>{if(!g?.material||g.userData.r7floor||q!=='high')return;g.userData.r7floor=1;const m=g.material.clone();m.roughness=.18;m.metalness=.35;m.normalMap=tex('concrete_n');m.normalScale.set(.25,.25);m.envMapIntensity=1.2;m.envMap=envTex;reflective.add(m);worldUV(m,.4);g.material=m};
 // ---------- People ----------
 const tpl={};let clips=null;R.people=Promise.all([glb('man.glb'),glb('woman.glb'),glb('anims.glb'),glb('man_lo.glb').catch(()=>null),glb('woman_lo.glb').catch(()=>null),glb('hair.glb').catch(()=>null)]).then(([m,w,a,ml,wl,hr])=>{try{if(hr)hairKit(hr.scene)}catch(e){console.warn('hair kit',e)}tpl.man=prep(m.scene);tpl.woman=prep(w.scene);if(ml&&wl){tpl.manLo=lodOf(ml.scene,tpl.man);tpl.womanLo=lodOf(wl.scene,tpl.woman)}clips={};for(const c of a.animations){c.tracks=c.tracks.filter(t=>!/^root\.position/.test(t.name));for(const t of c.tracks)if(/^pelvis\.position/.test(t.name)){const v=t.values;for(let i=0;i<v.length;i+=3){v[i]=v[0];v[i+2]=v[2]}}clips[c.name]=c}if(clips.Walk_Formal_Loop){clips.Walk_Loop=clips.Walk_Formal_Loop;clips.Walk_Loop.name='Walk_Loop'}try{relaxIdle(tpl.man)}catch(e){console.warn('relaxed idle',e)}R.ready=true;for(const b of pending)dress(b.g,b.o);pending.length=0}).catch(e=>{console.warn('Realistic people unavailable',e);R.failed=true});

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
 function bodyMat(src,look,bb){const m=src.clone();m.userData.r7=1;const u={uTop:{value:new THREE.Color(look.top)},uBottom:{value:new THREE.Color(look.bottom)},uShoe:{value:new THREE.Color(look.shoes)},uSkinT:{value:(()=>{const c=new THREE.Color(look.skin);return c.setRGB(c.r/REF.r,c.g/REF.g,c.b/REF.b)})()},uF:{value:new THREE.Vector4(look.sleeve,look.long,look.legs,0)},uP:{value:new THREE.Vector4(look.pat||0,look.denim||0,0,look.pat===3?.96:1.0)},uInner:{value:new THREE.Color(look.inner??0xe9e4da)},uBB:{value:bb?new THREE.Vector4((bb.min.x+bb.max.x)/2,bb.min.y,(bb.min.z+bb.max.z)/2,1.9/Math.max(1e-4,bb.max.y-bb.min.y)):new THREE.Vector4(0,0,0,1)}};
  m.onBeforeCompile=s=>{m.userData.sh=s;Object.assign(s.uniforms,u);s.vertexShader='attribute float region;\nflat varying float vReg;varying vec3 vOP;uniform vec4 uF,uP,uBB;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvReg=region;vOP=position;{float r=floor(region+.5);{float wy=(position.y-uBB.y)*uBB.w;if(r==0.&&abs((position.x-uBB.x)*uBB.w)<.32&&wy>.55&&wy<1.4)r=wy>uP.w?1.:4.;if(r==1.||r==4.||r==5.&&wy>uP.w)r=wy>uP.w?1.:4.;}float cm=r==1.?.02+.012*step(2.5,uP.x):r==2.?.014*uF.x:r==3.?.011*uF.y:r==4.?.016:r==5.?.011*uF.z:r==6.?.008:0.;transformed+=normalize(normal)*cm/uBB.w;}');
   s.fragmentShader='uniform vec3 uTop,uBottom,uShoe,uSkinT,uInner;uniform vec4 uF,uP,uBB;flat varying float vReg;varying vec3 vOP;float r7c;\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{float r=floor(vReg+.5);vec3 cl=uTop;vec3 op=(vOP-uBB.xyz)*uBB.w;if(r==0.&&abs(op.x)<.32&&op.y>.55&&op.y<1.4)r=op.y>uP.w?1.:4.;if(r==1.||r==4.||r==5.&&op.y>uP.w)r=op.y>uP.w?1.:4.;r7c=0.;if(r==1.)r7c=1.;else if(r==2.)r7c=uF.x;else if(r==3.)r7c=uF.y;else if(r==4.){r7c=1.;cl=uBottom;}else if(r==5.){r7c=uF.z;cl=uBottom;}else if(r==6.){r7c=1.;cl=uShoe;}if(r>=1.&&r<=3.&&r7c>.5){if(uP.x==1.){float ck=abs(step(.5,fract(op.x*16.))-step(.5,fract(op.y*16.)));cl*=mix(.78,1.08,ck);}else if(uP.x==2.){cl=mix(cl,vec3(.93),step(.62,fract(op.y*20.))*.55);}else if(uP.x==3.&&r==1.&&abs(op.x)<.05&&op.z>0.){cl=uInner;}}if((r==4.||r==5.)&&uP.y==1.){cl*=.9+.12*step(.5,fract((op.x+op.y)*140.))+.06*sin(op.y*37.+op.x*11.);}if(r==6.&&op.y<.035)cl=vec3(.9,.89,.86);float lum=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(min(diffuseColor.rgb*uSkinT,vec3(1.)),cl*(.95+.06*lum),r7c);}').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor*.72,.86,r7c);').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,r7c*.92));')};m.customProgramCacheKey=()=>'r7body';return m}
 const pending=[];const hexOf=v=>typeof v==='string'?parseInt(v.replace('#',''),16):v;
 // ---------- R9: variety (hair, skin, outfits), deterministic per NPC id ----------
 const hsh=t=>{let h=2166136261;for(const c of String(t))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0},rnd=(seed,k)=>hsh(seed+'|'+k)%1000/1000,pick=(seed,k,arr)=>arr[Math.floor(rnd(seed,k)*arr.length)];
 const V9={skin:[0x4a2b1e,0x553322,0x5a3726,0x6b4430,0x7a4e36,0x8b5c43,0x9c6a4c,0xa87652,0xb9825d,0xd2a07c,0xe1b596,0xc8956b],
  hairM:['fade','cropped','afro','locs','curly','cap','fade','parted','bald','afro','cropped','locs'],hairF:['long','buns','afro','braids','curly','bob','ponytail','cap','buns','braids'],
  hairC:[0x15110f,0x1c1612,0x241a14,0x15110f,0x3a2618,0x5a3a22,0x15110f,0x2a2a2a],
  topM:['tee','shirt','jacket','hoodie','tee','shirt','sweater','tank'],topF:['tee','dress','jacket','shirt','tank','dress','sweater','tee'],
  top:[0xe9e4da,0x1d1f24,0x2f4f7a,0x8a2c2c,0xc59642,0x3f6b4a,0xd96c4a,0x6c5a8e,0x9aa3ad,0xe7c7a1,0x1f7a8c,0xb35777,0xf0f0f0,0x2b2b30],
  bottom:[0x2c3e5c,0x3b5578,0x1b1c20,0x8b7a5a,0x55585e,0x6b4b3a,0x2c3e5c,0x1b1c20],shoes:[0xf2efe8,0x1a1a1a,0xc23b2b,0x8a6a4a,0x2a4f8a,0xf2efe8],cap:[0x1d1f24,0xc23b2b,0x2f4f7a,0xe9e4da,0x3f6b4a,0xc59642]};
 function vary(o){if(o.self||o.noVary)return o;const id=o.id||(o.shirt+'/'+o.skin+'/'+o.hair+'/'+o.gender);const fem=o.gender==='female'||(o.gender!=='male'&&(['dress','gown','qipao'].includes(o.top?.s)||['long','bun','buns','ponytail','bob','braids'].includes(o.hair)))||(!o.gender&&o.crowd&&rnd(id,'g')<.45);
  const v={...o,gender:fem?'female':'male'};if(!o.hair||o.hair==='cropped')v.hair=pick(id,'h',fem?V9.hairF:V9.hairM);if(!o.hairColor)v.hairColor=pick(id,'hc',V9.hairC);
  if(o.crowd&&!o.keepSkin)v.skin=rnd(id,'sk')<.82?V9.skin[Math.floor(rnd(id,'s2')*9)]:V9.skin[9+Math.floor(rnd(id,'s3')*3)];
  if(!o.top){const st=pick(id,'t',fem?V9.topF:V9.topM);v.top={s:st,c:o.crowd?pick(id,'tc',V9.top):(o.shirt??pick(id,'tc',V9.top))}}
  if(!o.bottom&&!o.trousers)v.bottom={s:fem&&rnd(id,'sk2')<.25?'skirt':'jeans',c:pick(id,'bc',V9.bottom)};if(!o.shoes)v.shoes={c:pick(id,'sc',V9.shoes)};
  v.beard=o.beard??(!fem&&rnd(id,'b')<.38);v.pattern=o.pattern??(rnd(id,'p')<.3?1:rnd(id,'p')<.45?2:0);v.capC=pick(id,'cc',V9.cap);return v}
 const HK={geo:{},mat:{},mc:new Map()};
 function hairKit(sc){sc.updateMatrixWorld(true);sc.traverse(n=>{if(n.isMesh){const g=n.geometry.clone();for(const k of ['position','normal']){const at=g.attributes[k];if(at?.normalized||at?.array instanceof Int16Array||at?.array instanceof Int8Array)g.setAttribute(k,new THREE.BufferAttribute(Float32Array.from({length:at.count*at.itemSize},(_,i)=>at.getComponent(Math.floor(i/at.itemSize),i%at.itemSize)),at.itemSize))}g.applyMatrix4(n.matrixWorld);HK.geo[n.name]=g;HK.mat[n.name]=n.material}});
  const buz=HK.geo.Hair_Buzzed;if(!buz)return;const lumpy=(rx,ry,rz,cx,cy,cz,seg)=>{const g=new THREE.SphereGeometry(1,seg,Math.round(seg*.75));const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.07*Math.sin(x*11+y*7)*Math.sin(z*9-y*5)+.04*Math.sin(x*23+z*19);p.setXYZ(i,cx+x*rx*n,cy+y*ry*n,cz+z*rz*n)}g.computeVertexNormals();return g};
  const strip=g=>{const o=g.index?g.toNonIndexed():g;for(const k of Object.keys(o.attributes))if(!['position','normal'].includes(k))o.deleteAttribute(k);return o};
  HK.geo.afro=lumpy(.132,.122,.134,0,.168,-.028,18);HK.geo.curly=lumpy(.112,.1,.116,0,.162,-.02,16);
  {const parts=[];const n=26;for(let k=0;k<n;k++){const az=(-160+320*k/(n-1))*Math.PI/180;if(Math.abs(az)<.62&&k%2)continue;const L=.16+.1*Math.abs(Math.sin(k*2.3));const c=new THREE.CylinderGeometry(.012,.009,L,5,1);c.translate(0,-L/2,0);c.rotateX(-.12);c.rotateZ(.1*Math.sign(Math.sin(az)));c.rotateY(az+Math.PI);const r=.082;c.translate(Math.sin(az)*r,.175,-Math.cos(az)*r*.9+(Math.abs(az)<.62?-.02:0));parts.push(strip(c))}
   HK.geo.locs=mergeGeometries(parts)}
  {const d=new THREE.SphereGeometry(.104,16,8,0,Math.PI*2,0,Math.PI*.5);d.scale(1,.78,1.04);d.translate(0,.152,-.006);const b=new THREE.CylinderGeometry(.088,.088,.01,18);b.scale(1,1,.7);b.rotateX(.12);b.translate(0,.155,.088);HK.geo.cap=mergeGeometries([strip(d),strip(b)])}}
 const STYLE={fade:['Hair_Buzzed'],buzz:['Hair_Buzzed'],cropped:['Hair_SimpleParted'],parted:['Hair_SimpleParted'],afro:['Hair_Buzzed','afro'],curly:['Hair_Buzzed','curly'],locs:['Hair_Buzzed','locs'],braids:['Hair_BuzzedFemale','locs'],long:['Hair_Long'],ponytail:['Hair_Long'],bob:['Hair_SimpleParted'],bun:['Hair_Buns'],buns:['Hair_Buns'],cap:['Hair_Buzzed','cap'],bald:[],shaved:[]};
 function hairMat(name,col,proc){const k=name+'/'+col;let m=HK.mc.get(k);if(m)return m;if(proc){m=new THREE.MeshStandardMaterial({color:col,roughness:name==='cap'?.7:.95,metalness:0})}else{const src=HK.mat[name];m=src.clone();m.color.set(col).multiplyScalar(1/.3)}m.userData.r7=1;HK.mc.set(k,m);return m}
 function addHair(m,L,lo){const head=m.getObjectByName('Head');if(!head||!HK.geo.Hair_Buzzed)return;let st=STYLE[L.style]||STYLE.cropped;if(L.fem&&st[0]==='Hair_Buzzed'&&L.style!=='fade'&&L.style!=='buzz')st=['Hair_BuzzedFemale',...st.slice(1)];if(L.fem&&L.style==='cropped')st=['Hair_BuzzedFemale'];
  const list=[...st];if(L.beard&&!L.fem)list.push('Hair_Beard');for(const n of list){const proc=!HK.mat[n],g=HK.geo[n];if(!g)continue;const mm=new THREE.Mesh(g,hairMat(n,n==='cap'?L.capC:L.hair,proc));mm.castShadow=!lo;mm.userData.r7person=1;mm.frustumCulled=false;head.add(mm)}}
 const skirtMats=new Map();
 // Skirts and dresses: a soft flared cone on the pelvis bone (the body paint alone reads as leggings).
 function addSkirt(m,g,L,lo){if(!L.skirt)return;const pel=m.getObjectByName('pelvis');if(!pel)return;g.updateMatrixWorld(true);const P=pel.getWorldPosition(new THREE.Vector3()),Hw=1.86*g.scale.x*(g.parent?g.parent.getWorldScale(new THREE.Vector3()).x:1),k=Hw/1.86,len=(L.skirt===2?.5:.4)*k;
  const cg=new THREE.CylinderGeometry(.15*k,(L.skirt===2?.25:.22)*k,len,18,3,true);cg.translate(0,-len/2+.08*k,0);const key=L.bottom;let mt=skirtMats.get(key);if(!mt){mt=new THREE.MeshStandardMaterial({color:key,roughness:.85,side:THREE.DoubleSide});mt.userData.r7=1;skirtMats.set(key,mt)}
  const c=new THREE.Mesh(cg,mt);c.castShadow=!lo;c.userData.r7person=1;c.frustumCulled=false;c.position.copy(P);(g.parent||g).add(c);c.updateMatrixWorld(true);pel.attach(c)}
 function lookOf(o){o=vary(o);const top=o.top||{s:o.outfit==='dress'?'dress':o.outfit==='tank'?'tank':'tee',c:o.shirt},bot=o.bottom||{s:'jeans',c:o.trousers},sh=o.shoes&&typeof o.shoes==='object'?o.shoes:{c:o.shoes};const ts=top.s||'tee',bs=bot.s||'jeans',dress=['dress','gown','qipao'].includes(ts);
  const fem=o.gender==='female'||(o.gender!=='male'&&(dress||bs==='skirt'||['long','bun','buns','ponytail','bob','pigtails','braids'].includes(o.hair)));
  return {fem,top:hexOf(top.c??0x23799a),bottom:hexOf(dress?top.c:(bot.c??0x28394b)),shoes:hexOf(sh.c??0x2b2b2b),skin:hexOf(o.skin??0xa06d4d),hair:hexOf(o.hairColor??0x1f2628),bald:o.hair==='bald'||o.hair==='shaved',sleeve:ts==='tank'?0:1,long:LONG.has(ts)?1:0,legs:bs==='shorts'||(bs==='skirt'&&!dress)?0:1,style:o.hair||'cropped',beard:!!o.beard,capC:o.capC??0x1d1f24,pat:ts==='jacket'?3:ts==='shirt'?(o.pattern??1):(o.pattern===2?2:0),denim:bs==='jeans'?1:0,inner:0xe9e4da,skirt:dress||bs==='skirt'?(dress?2:1):0}}
 function dress(g,o){if(!R.ready){pending.push({g,o});return}if(g.userData.r7person||!g.parent&&!g.userData.keep)return;const L=lookOf(o),lo=o.crowd&&tpl.manLo,src=lo?(L.fem?tpl.womanLo:tpl.manLo):L.fem?tpl.woman:tpl.man,m=cloneSkinned(src);
  m.traverse(c=>{if(!c.isSkinnedMesh)return;c.userData.r7person=1;if(c.userData.body)c.material=bodyMat(c.material,L,c.geometry.boundingBox);else if(c.userData.hair){c.material=c.material.clone();c.material.color.set(L.hair).multiplyScalar(1/.3)}});addHair(m,L,lo);
  // Your own character shows as a soft silhouette wherever a wall or tree hides it (drawn only where it is behind something).
  if(o.self)m.traverse(c=>{if(!c.isSkinnedMesh||!c.userData.body||c.userData.ghost)return;const gh=new THREE.SkinnedMesh(c.geometry,ghostMat);gh.userData.ghost=gh.userData.r7person=1;gh.frustumCulled=false;gh.renderOrder=1;gh.bind(c.skeleton,c.bindMatrix);c.parent.add(gh)});
  const s=1.86/src.userData.h;m.scale.setScalar(s);m.userData.r7person=1;
  for(const c of g.children)if(!c.userData.r7keep&&c.name!=='emote-prop'){c.userData.r7hidden=c.visible;c.visible=false}
  g.add(m);try{addSkirt(m,g,L,lo)}catch(e){}if(o.self)g.traverse(c=>{if(c.isMesh&&!c.userData.ghost&&c.userData.r7person)c.renderOrder=2});const mixer=new THREE.AnimationMixer(m),act={};for(const n of o.crowd?['Idle_Loop','Idle_Talking_Loop','Dance_Loop','Walk_Loop','Sitting_Idle_Loop']:['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Dance_Loop','Sitting_Idle_Loop'])if(clips[n]){act[n]=mixer.clipAction(clips[n]);act[n].setEffectiveWeight(n==='Idle_Loop'?1:0);if(n==='Idle_Loop')act[n].play()}if(act.Dance_Loop)act.Dance_Loop.timeScale=.85+Math.random()*.3;
  for(const a of Object.values(act))a.time=Math.random()*a.getClip().duration;
  const frozen=false;g.userData.real={m,mixer,act,w:{Idle_Loop:1},acc:0,frozen,posed:0,lod:!!lo};people.add(g)}
 let crowdN=0,bud=12,budF=-1;R.resetCrowd=()=>{crowdN=0};
 // Low-poly crowd copy: same skeleton, materials (with textures) borrowed from the full model by name; no shadows.
 function lodOf(scene,hi){const mats={};hi.traverse(o=>{if(o.isSkinnedMesh)mats[o.material.name]=o.material});prep(scene);scene.traverse(o=>{if(!o.isSkinnedMesh)return;o.castShadow=false;const h=mats[o.material.name];if(h)o.material=h});scene.userData.h=hi.userData.h;return scene}
 const people=new Set(),ghostMat=new THREE.MeshBasicMaterial({color:0x8ff0e6,transparent:false,opacity:.42,depthWrite:false,depthFunc:THREE.GreaterDepth,blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor});
 // R9: the silhouette is drawn after the world but before your own body (renderOrder 1 vs 2), so your clothes and hair never trigger it.
 R.dress=(g,o)=>{try{dress(g,o)}catch(e){console.warn('dress',e)}};
 R.frame=(g,moving,dt,spd,emote,far)=>{const r=g.userData.real;if(!r)return false;r.acc+=dt;if(far&&r.acc<.066)return true;if(r.lod){const f=renderer.info.render.frame;if(f!==budF){budF=f;bud=12}if(bud>0)bud--;else if(r.acc<.25)return true}const step=r.acc;r.acc=0;
  const height=1.86*g.scale.x,hps=(spd||0)/height,jog=moving&&hps>1.15,want=emote==='dance'?'Dance_Loop':emote==='talk'&&r.act.Idle_Talking_Loop?'Idle_Talking_Loop':emote==='sit'?'Sitting_Idle_Loop':!moving?'Idle_Loop':jog&&r.act.Jog_Fwd_Loop?'Jog_Fwd_Loop':'Walk_Loop';
  if(r.frozen&&r.posed>1)return true;const k=r.frozen?1:1-Math.exp(-step*10);for(const [n,a] of Object.entries(r.act)){const cur=r.w[n]||0,t=n===want?1:0,nw=cur+(t-cur)*k;r.w[n]=nw;if(nw<.002&&t===0){if(a.isRunning())a.stop()}else{if(!a.isRunning())a.play();a.setEffectiveWeight(nw)}}if(r.frozen){r.posed++;r.mixer.update(r.posed===1?Math.random()*2:0);return true}
  if(r.act.Walk_Loop)r.act.Walk_Loop.timeScale=THREE.MathUtils.clamp(hps/.45,.5,1.8);if(r.act.Jog_Fwd_Loop)r.act.Jog_Fwd_Loop.timeScale=THREE.MathUtils.clamp(hps/1.9,.7,1.4);
  r.mixer.update(step);return true};
 R.undress=g=>{const r=g.userData.real;if(!r)return;r.m.removeFromParent();r.mixer.stopAllAction();for(const c of g.children)if(c.userData.r7hidden!==undefined){c.visible=c.userData.r7hidden;delete c.userData.r7hidden}delete g.userData.real;people.delete(g)};
 R.decorate=decorate;R.bldList=()=>(R.r8root?.userData.r8?.blds||[]).map(b=>({min:b.b.min.toArray(),max:b.b.max.toArray(),ax:b.ax}));R.light=light;R.paint=paint;R.count=()=>people.size;
 return R}
