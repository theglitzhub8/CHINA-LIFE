import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
function setup(enabled=true){const t=harness({...fixture(),place:'plaza'}),c=t.context,calls=[];
 c.ChinaLifeCloud={ready:Promise.resolve(),signedIn:true,open(){}};
 c.ChinaLifeAuth={async request(path,method,data){calls.push({path,method,data});if(method==='GET')return {data:{enabled,messages:[],remaining:40}};if(method==='POST')return {data:{reply:'Try **Taiyuan Street Market** for street food! [[go:market]] [[go:nowhere]]',remaining:39}};return {data:{}}}};
 vm.runInContext('(()=>{'+fs.readFileSync('public/ai-agents.js','utf8')+'})()',c);const dialog=t.document.getElementById('aiDialog');Object.defineProperty(dialog,'open',{get(){return this.hasAttribute('open')}});dialog.showModal=function(){this.setAttribute('open','')};dialog.close=function(){this.removeAttribute('open')};
 let went=null;t.game.travel=id=>{went=id};return {...t,ai:c.ChinaLifeAI,dialog,calls,get went(){return went}}}
const settle=()=>new Promise(r=>setTimeout(r,0));
test('AI characters chat with the game context and turn place tags into Go buttons',async()=>{const t=setup();
 assert.equal(t.ai.agentsAt('market').map(a=>a.name).join(),'Auntie Wang');assert.equal(t.ai.agents.length,4);
 await t.ai.open('guide');assert.match(t.dialog.textContent,/Mei/);assert.match(t.dialog.textContent,/40 messages left today/);assert.match(t.dialog.textContent,/What should I do today\?/);
 t.dialog.querySelector('[data-chip]').onclick();await settle();await settle();
 const post=t.calls.find(c=>c.method==='POST');assert.equal(post.data.agent,'guide');assert.equal(post.data.message,'What should I do today?');assert.equal(post.data.context.city,'Shenyang');assert.ok(post.data.context.places.some(p=>p[0]==='market'),'knows the city places');
 assert.match(t.dialog.textContent,/Taiyuan Street Market for street food/);assert.ok(t.dialog.querySelector('.ai-msg.them b'),'bold text');const go=[...t.dialog.querySelectorAll('[data-go]')];assert.equal(go.length,1,'only real places become buttons');
 go[0].onclick();assert.equal(t.went,'market');assert.equal(t.dialog.open,false);
});
test('before the server is set up the characters say they are on the way and no message can be sent',async()=>{const t=setup(false);await t.ai.open('tutor');assert.match(t.dialog.textContent,/on the way/);assert.equal(t.dialog.querySelector('#aiForm'),null)});
