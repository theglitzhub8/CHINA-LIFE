// R9e: natural locomotion for the Rocketbox avatars, from the Microsoft Rocketbox Avatar Library's own motion-capture clips (MIT,
// https://github.com/microsoft/Microsoft-Rocketbox, Assets/Animations/all_animations_max_motextr_xy/*.max.fbx), converted with
// FBX2glTF 0.9.7 (-b --anim-framerate bake30) to /tmp/r9e/glb/<name>.glb. Same Bip01 skeleton as the avatars, so no retarget.
// Each clip carries extras {src, leg}: leg = the source skeleton's thigh-to-ankle length.
// Kept: body bones only (fingers get the relaxed curl at runtime, face bones are not animated); translation on Bip01 only
// (its forward travel is kept so the runtime can measure the clip's ground speed, then removes it).
// Usage (needs @gltf-transform + meshoptimizer, e.g. copied next to a node_modules): OUT=public/r7/rb/loco.glb node loco.mjs
import {NodeIO,Document} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {resample,prune,dedup,meshopt} from '@gltf-transform/functions';import {MeshoptEncoder} from 'meshoptimizer';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const SRC=process.env.SRC||'/tmp/r9e/glb/',OUT=process.env.OUT||new URL('../../public/r7/rb/loco.glb',import.meta.url).pathname;
// clip name in the game <- Rocketbox source
const CLIPS=JSON.parse(process.env.CLIPS||'null')||{M_Walk:'m_walk_neutral',M_WalkFast:'m_walk_fast_02',M_Run:'m_run_fast_01',F_Walk:'f_walk_neutral',F_WalkFast:'f_walk_fast_03',F_Run:'f_run_fast_01'};
const S=['Pelvis','Spine','Spine1','Spine2','Neck','Head'];for(const a of ['L','R'])S.push(...['Clavicle','UpperArm','Forearm','Hand','Thigh','Calf','Foot','Toe0'].map(b=>a+' '+b));
const KEEP=new Set(['Bip01',...S.map(b=>'Bip01 '+b)]);
const doc=new Document(),buf=doc.createBuffer(),sc=doc.createScene('loco'),nodes={};for(const n of KEEP){nodes[n]=doc.createNode(n);sc.addChild(nodes[n])}
for(const [name,src] of Object.entries(CLIPS)){const d=await io.read(SRC+src+'.glb');const a0=d.getRoot().listAnimations()[0];const an=doc.createAnimation(name);
 // the source skeleton's leg length (thigh->calf->foot), so the runtime can scale the hips' travel to each avatar's legs
 {const N=n=>d.getRoot().listNodes().find(x=>x.getName()===n),L=s=>['Calf','Foot'].reduce((a,b)=>a+Math.hypot(...N('Bip01 '+s+' '+b).getTranslation()),0);an.setExtras({src:src+'.max.fbx',leg:+((L('L')+L('R'))/2).toFixed(4)})}
 for(const c of a0.listChannels()){const nm=c.getTargetNode()?.getName(),p=c.getTargetPath();if(!KEEP.has(nm)||p==='scale'||(p==='translation'&&nm!=='Bip01'))continue;
  const s=c.getSampler(),cp=a=>doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setBuffer(buf);
  const ns=doc.createAnimationSampler().setInput(cp(s.getInput())).setOutput(cp(s.getOutput())).setInterpolation('LINEAR');an.addSampler(ns);an.addChannel(doc.createAnimationChannel().setTargetNode(nodes[nm]).setTargetPath(p).setSampler(ns))}}
await doc.transform(resample({tolerance:2e-4}),dedup(),prune({keepLeaves:true}));await MeshoptEncoder.ready;await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(OUT,doc);console.log(OUT,(await import('fs')).statSync(OUT).size,'bytes',Object.keys(CLIPS).join(','));
