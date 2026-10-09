import * as THREE from './vendor/three.module.js';
import {furnitureModel,buildingModel} from './models.js';
import {characterModel} from './characters.js';
import {carModel} from './garage.js';
// Store and shop previews: furniture, homes, the avatar trying on clothes, and cars.
let renderer,scene,camera,object,yaw=Math.PI/5;
function clear(){if(object){object.traverse(o=>o.geometry?.dispose());scene.remove(object)}}
function build(detail,id){if(detail.mode==='avatar')return characterModel(detail.look||{});if(detail.mode==='car')return carModel(detail.id,detail.color);return detail.mode==='properties'?buildingModel('home',id):furnitureModel(id,detail.color)}
function draw(detail,id){clear();object=build(detail,id);scene.add(object);object.rotation.y=detail.mode==='avatar'?yaw-Math.PI/5+.35:yaw;const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z,detail.mode==='avatar'?1.9:2);
 camera.position.set(center.x+extent*1.3,center.y+extent*(detail.mode==='avatar'?.35:1),center.z+extent*1.6);camera.lookAt(center);camera.left=-extent*.85;camera.right=extent*.85;camera.top=extent*.6;camera.bottom=-extent*.6;camera.updateProjectionMatrix();renderer.render(scene,camera)}
function open(detail){const holder=document.getElementById('productPreview');if(!holder)return;try{if(!renderer){renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});renderer.setSize(360,240);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));scene=new THREE.Scene();scene.background=new THREE.Color(0xeef2f4);scene.add(new THREE.HemisphereLight(0xffffff,0x759397,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,8,5);scene.add(light);camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100)}
 document.querySelectorAll('[data-product]').forEach(canvas=>{draw(detail,canvas.dataset.product);canvas.getContext('2d').drawImage(renderer.domElement,0,0,canvas.width,canvas.height)});draw(detail,detail.id);holder.replaceChildren(renderer.domElement)}catch(error){holder.textContent='3D previews are unavailable on this device. You can still shop.'}}
window.ChinaLifePreview={rotate(){if(!object)return;yaw+=Math.PI/4;object.rotation.y=yaw;renderer.render(scene,camera)}};
window.addEventListener('chinalife:preview',e=>open(e.detail));
