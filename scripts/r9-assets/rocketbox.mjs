// R9: Microsoft Rocketbox avatars (MIT) -> small GLBs. Source FBX (the 81-bone "hipoly" body, ~5-7k verts) converted with
// FBX2glTF 0.9.7 to /tmp/rb/raw_<name>.glb; here we attach the colour/opacity textures and shrink them to WebP.
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {prune,dedup,weld,quantize,textureCompress,meshopt} from '@gltf-transform/functions';import {MeshoptEncoder} from 'meshoptimizer';import sharp from 'sharp';import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});const OUT='/workspace/cl/public/r7/rb/';
const names=fs.readFileSync('/tmp/rb/list.txt','utf8').trim().split('\n').map(p=>p.split('/').pop());
for(const n of names)for(const [dir,size] of [['',512],['lo/',256]]){const d=await io.read('/tmp/rb/raw_'+n+'.glb'),r=d.getRoot();const T='/tmp/rb/src/'+n+'/Textures/';
 for(const m of r.listMaterials()){const id=m.getName().split('_').pop(),pre=m.getName().split('_')[0];const f=T+pre+'_'+id+'_color.png';m.setMetallicFactor(0).setRoughnessFactor(.75).setBaseColorFactor([1,1,1,1]);
  if(fs.existsSync(f)){const t=d.createTexture(m.getName()).setImage(fs.readFileSync(f)).setMimeType('image/png');m.setBaseColorTexture(t)}
  if(id==='opacity'){m.setAlphaMode('MASK').setAlphaCutoff(.42).setDoubleSided(true)}}
 for(const a of r.listAnimations())a.dispose();
 await d.transform(weld(),dedup(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[size,size],quality:dir?70:78}),quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}),prune());
 await MeshoptEncoder.ready;await d.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
 for(const t of r.listTextures())if(!t.getImage()||t.getImage().length<200)t.dispose();
 await io.write(OUT+dir+n+'.glb',d)}
console.log('done');
