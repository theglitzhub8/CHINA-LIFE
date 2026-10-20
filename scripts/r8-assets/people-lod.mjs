// Crowd LOD: simplified copies of the R7 characters (same skeleton/bones), geometry only; textures come from the full models at runtime.
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {simplify,weld,prune,dedup,quantize} from '@gltf-transform/functions';import {MeshoptSimplifier} from 'meshoptimizer';import fs from 'fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),D='/workspace/cl/public/r7/';await MeshoptSimplifier.ready;
const tris=d=>d.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((k,p)=>k+(p.getIndices()?p.getIndices().getCount():p.getAttribute('POSITION').getCount())/3,0),0);
for(const n of ['man','woman']){const d=await io.read(D+n+'.glb');const t0=tris(d);for(const t of d.getRoot().listTextures())t.dispose();
 await d.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:+(process.env.RATIO||.22),error:.01,lockBorder:false}),dedup(),prune({keepAttributes:true}));
 await io.write(D+n+'_lo.glb',d);console.log(n,t0,'->',tris(d),fs.statSync(D+n+'_lo.glb').size)}
