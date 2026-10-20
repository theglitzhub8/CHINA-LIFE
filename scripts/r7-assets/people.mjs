import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {prune,dedup,resample,quantize,textureCompress,weld} from '@gltf-transform/functions';import sharp from 'sharp';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),O='/tmp/r7a/out/';import fs from 'fs';fs.mkdirSync(O,{recursive:true});
const B='/tmp/r7a/ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/';
// Animations
{const d=await io.read('/tmp/r7a/ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'),r=d.getRoot();const keep=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Dance_Loop','Sitting_Idle_Loop','Idle_Talking_Loop'];
for(const a of r.listAnimations())if(!keep.includes(a.getName())){for(const x of a.listSamplers()){x.dispose()}for(const c of a.listChannels())c.dispose();a.dispose()}
for(const n of r.listNodes())n.setMesh(null);for(const m of r.listMeshes())m.dispose();for(const s of r.listSkins())s.dispose();
// drop finger tracks (small win) except keep root motion off: remove root/pelvis translation drift handled in runtime
for(const a of r.listAnimations())for(const c of a.listChannels()){const n=c.getTargetNode()?.getName()||'';if(/(index|middle|pinky|ring|thumb)_0[234]|leaf/.test(n)||(c.getTargetPath()==='scale')){c.dispose()}}
await d.transform(resample({tolerance:5e-4}),prune(),dedup());await io.write(O+'anims.glb',d)}
for(const [src,out] of [['Superhero_Male_FullBody.gltf','man.glb'],['Superhero_Female_FullBody.gltf','woman.glb']]){const d=await io.read(B+src);const LT='/tmp/r7a/ubc/Universal Base Characters[Standard]/Base Characters/Textures/';for(const t of d.getRoot().listTextures()){const u=t.getURI();if(/Male_Dark/.test(u))t.setImage(fs.readFileSync(LT+'T_Superhero_Male_Ligh.png'));if(/Female_Dark/.test(u))t.setImage(fs.readFileSync(LT+'T_Superhero_Female_Light_BaseColor.png'))}
await d.transform(weld(),dedup(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[512,512],quality:78}),quantize({quantizeNormal:10,quantizeTexcoord:12,quantizePosition:14}),prune());await io.write(O+out,d)}
