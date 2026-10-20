import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
const source=fs.readFileSync('public/world.js','utf8');
function camera(objects){
 const bounds=objects.map(object=>{object.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(object);return {object,box,c:box.getCenter(new THREE.Vector3()),r:10}});
 const context=vm.createContext({THREE,tp:{},occluders:()=>bounds});
 vm.runInContext(source.slice(source.indexOf('function streetCameraLimit('),source.indexOf('function tpActive()')),context);
 return (origin,position)=>context.streetCameraLimit(origin,position);
}
function wall(x){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,5,5),new THREE.MeshBasicMaterial());mesh.position.set(x,2,0);return mesh}
test('street camera retracts before a wall even when already closer than the old minimum',()=>{
 const origin=new THREE.Vector3(0,1.25,0),position=new THREE.Vector3(5,1.25,0);
 camera([wall(1)])(origin,position);
 assert.ok(position.x>.6&&position.x<.9,`lens x=${position.x}`);
});
test('street camera leaves clear space unchanged and ignores obstacles beyond the requested position',()=>{
 const origin=new THREE.Vector3(0,1.25,0),position=new THREE.Vector3(5,2.8,0),expected=position.clone();
 camera([wall(8)])(origin,position);assert.ok(position.equals(expected));
});
test('merged building bounds spanning the player do not falsely collapse the camera',()=>{
 const geometry=new THREE.BoxGeometry(.2,5,5);geometry.translate(4,2,4);
 // A second distant wall makes the combined bounding box contain the player, but the actual ray is clear.
 const other=new THREE.BoxGeometry(.2,5,5);other.translate(-4,2,-4);
 const values=new Float32Array([...geometry.toNonIndexed().attributes.position.array,...other.toNonIndexed().attributes.position.array]);
 const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(values,3));
 const origin=new THREE.Vector3(0,1.25,0),position=new THREE.Vector3(5,1.25,0);
 camera([new THREE.Mesh(merged,new THREE.MeshBasicMaterial())])(origin,position);
 assert.equal(position.x,5);
});
test('prototype camera activates only for local Guangzhou street mode',()=>{
 const c=vm.createContext({view:'map',city:'Guangzhou',tp:{on:true,walk:true},player:{},furnitureEdit:false,viewCity:()=>c.city});
 vm.runInContext(source.slice(source.indexOf('function gzStreet()'),source.indexOf('function streetCameraLimit('))+source.slice(source.indexOf('function tpActive()'),source.indexOf('function viewCam()')),c);
 assert.equal(c.gzStreet(),true);
 for(const [key,value] of [['city','Shenyang'],['view','venue']]){const old=c[key];c[key]=value;assert.equal(c.gzStreet(),false);c[key]=old}
 c.tp.walk=false;assert.equal(c.gzStreet(),false);c.tp.walk=true;c.tp.on=false;assert.equal(c.gzStreet(),false);
});
test('Street/Map switches retain position, cancel held input and keep the existing scene',()=>{
 const player=new THREE.Group();player.position.set(-50,0,-48);player.scale.setScalar(.8);
 const scene=new THREE.Scene();scene.add(player);const original=player.position.clone();
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,classList:{toggle(){}},setAttribute(){}});return elements.get(id)};
 const c=vm.createContext({THREE,player,tp:{move:new THREE.Vector2(1,1),keys:new Set(['w'])},view:'map',viewCity:()=> 'Guangzhou',game:{state:{city:'Guangzhou'},toast:()=>assert.fail('unexpected rejection')},actionRun:null,$,closePlaceSheet(){},litCopy(){},clearStreet(){},pedClear(){},setTimeout(){},layout:{xs:[-50],zs:[-48]},yaw:0,AVATAR:.8,target:new THREE.Vector3(),walkRoute:[],mapFocus:new THREE.Vector3(),updateCamera(){},labelsDirty:false});
 vm.runInContext(source.slice(source.indexOf('function ownStreetGeometry('),source.indexOf('function streetCameraLimit('))+source.slice(source.indexOf('function setCityWalk('),source.indexOf('function enterNear()')),c);
 c.setCityWalk(true);assert.equal(c.tp.walk,true);assert.ok(player.position.equals(original));
 c.setCityWalk(false);assert.equal(c.tp.walk,false);assert.ok(player.position.equals(original));assert.equal(player.parent,scene);assert.equal(c.tp.keys.size,0);assert.equal(c.tp.move.length(),0);
});

test('prototype avatar owns geometry without changing the shared model or cloning on every toggle',()=>{
 const body=new THREE.Group(),shared=new THREE.BoxGeometry(1,1,1);body.add(new THREE.Mesh(shared),new THREE.Mesh(shared));
 const c=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function ownStreetGeometry('),source.indexOf('function streetCameraLimit(')),c);
 c.ownStreetGeometry(body);const owned=body.children[0].geometry;assert.notEqual(owned,shared);assert.equal(body.children[1].geometry,owned);assert.deepEqual(owned.attributes.position.array,shared.attributes.position.array);
 c.ownStreetGeometry(body);assert.equal(body.children[0].geometry,owned);
});
