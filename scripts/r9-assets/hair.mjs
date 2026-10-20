// R9: CC0 Quaternius "Universal Base Characters" hairstyles, re-expressed as rigid meshes in Head-bone space (attach to the head bone at runtime).
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {prune,dedup,weld,quantize,textureCompress} from '@gltf-transform/functions';import sharp from 'sharp';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const H='/tmp/r7a/ubc/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/';
const styles=['Hair_Buzzed','Hair_BuzzedFemale','Hair_SimpleParted','Hair_Long','Hair_Buns','Hair_Beard','Eyebrows_Regular'];
const mul=(m,v,w)=>[0,1,2].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+(w?m[12+i]:0));
const out=new (await import('@gltf-transform/core')).Document();const ob=out.createBuffer(),scene=out.createScene();const mats={};
for(const s of styles){const d=await io.read(H+s+'.gltf'),r=d.getRoot();const skin=r.listSkins()[0],joints=skin.listJoints(),hi=joints.findIndex(j=>j.getName()==='Head'),ibm=skin.getInverseBindMatrices().getElement(hi,[]);
 for(const m of r.listMeshes())for(const p of m.listPrimitives()){const P=p.getAttribute('POSITION'),N=p.getAttribute('NORMAL'),UV=p.getAttribute('TEXCOORD_0'),n=P.getCount();const pa=new Float32Array(n*3),na=new Float32Array(n*3);let mn=[9,9,9],mx=[-9,-9,-9];
  for(let i=0;i<n;i++){const v=mul(ibm,P.getElement(i,[]),1),q=mul(ibm,N.getElement(i,[]),0),l=Math.hypot(...q)||1;pa.set(v,i*3);na.set(q.map(x=>x/l),i*3);for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],v[k]);mx[k]=Math.max(mx[k],v[k])}}
  console.log(s,n,mn.map(x=>x.toFixed(3)).join(','),mx.map(x=>x.toFixed(3)).join(','));
  const mname=p.getMaterial().getName();if(!mats[mname]){const om=out.createMaterial(mname).setRoughnessFactor(.85).setMetallicFactor(0);const src=p.getMaterial();const bc=src.getBaseColorTexture();if(bc){const t=out.createTexture(mname+'_c').setImage(bc.getImage()).setMimeType(bc.getMimeType());om.setBaseColorTexture(t)}const nt=src.getNormalTexture();if(nt){const t=out.createTexture(mname+'_n').setImage(nt.getImage()).setMimeType(nt.getMimeType());om.setNormalTexture(t)}om.setAlphaMode(src.getAlphaMode());om.setAlphaCutoff(src.getAlphaCutoff());om.setDoubleSided(src.getDoubleSided());mats[mname]=om}
  const acc=(a,t)=>out.createAccessor().setArray(a).setType(t).setBuffer(ob);const np=out.createPrimitive().setAttribute('POSITION',acc(pa,'VEC3')).setAttribute('NORMAL',acc(na,'VEC3')).setAttribute('TEXCOORD_0',acc(new Float32Array(UV.getArray()),'VEC2')).setIndices(out.createAccessor().setArray(new Uint32Array(p.getIndices().getArray())).setType('SCALAR').setBuffer(ob)).setMaterial(mats[mname]);
  scene.addChild(out.createNode(s).setMesh(out.createMesh(s).addPrimitive(np)))}}
await out.transform(weld(),dedup(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[256,256],quality:75}),quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}),prune());
await io.write(process.argv[2]||'/workspace/cl/public/r7/hair.glb',out);
