import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
function setup(enabled=true,post=()=>({reply:'Try **Taiyuan Street Market** for street food! [[go:market]] [[go:nowhere]]',remaining:39})){const t=harness({...fixture(),place:'plaza'}),c=t.context,calls=[];
 c.ChinaLifeCloud={ready:Promise.resolve(),signedIn:true,open(){}};
 c.ChinaLifeAuth={async request(path,method,data){calls.push({path,method,data});if(method==='GET')return {data:{enabled,messages:[],remaining:40}};if(method==='POST')return {data:post(data)};return {data:{}}}};
 vm.runInContext('(()=>{'+fs.readFileSync('public/ai-agents.js','utf8')+'})()',c);const dialog=t.document.getElementById('aiDialog');Object.defineProperty(dialog,'open',{get(){return this.hasAttribute('open')}});dialog.showModal=function(){this.setAttribute('open','')};dialog.close=function(){this.removeAttribute('open')};
 let went=null;t.game.travel=id=>{went=id};return {...t,ai:c.ChinaLifeAI,dialog,calls,get went(){return went}}}
const settle=()=>new Promise(r=>setTimeout(r,0));
test('AI characters chat with the game context and turn place tags into Go buttons',async()=>{const t=setup();
 assert.equal(t.ai.agentsAt('market').map(a=>a.name).join(),'Auntie Wang');assert.equal(t.ai.agents.length,14,'named characters across the city');
 await t.ai.open('guide');assert.match(t.dialog.textContent,/Mei/);assert.match(t.dialog.textContent,/40 messages left today/);assert.match(t.dialog.textContent,/What should I do today\?/);
 t.dialog.querySelector('[data-chip]').onclick();await settle();await settle();
 const post=t.calls.find(c=>c.method==='POST');assert.equal(post.data.agent,'guide');assert.equal(post.data.message,'What should I do today?');assert.equal(post.data.context.city,'Shenyang');assert.ok(post.data.context.places.some(p=>p[0]==='market'),'knows the city places');
 assert.match(t.dialog.textContent,/Taiyuan Street Market for street food/);assert.ok(t.dialog.querySelector('.ai-msg.them b'),'bold text');const go=[...t.dialog.querySelectorAll('[data-act]')];assert.equal(go.length,1,'only real places become buttons');
 go[0].onclick();assert.equal(t.went,'market');assert.equal(t.dialog.open,false);
});
test('before the server is set up the characters say they are on the way and no message can be sent',async()=>{const t=setup(false);await t.ai.open('tutor');assert.match(t.dialog.textContent,/on the way/);assert.equal(t.dialog.querySelector('#aiForm'),null)});
test('characters do things in the game: buttons for screens, places, songs and rewards, and direct requests run at once',async()=>{
 const t=setup(true,()=>({reply:'Opening your wallet!\n[[open:wallet]] [[go:cafe]] [[open:hack]] [[daily]]',auto:'[[open:wallet]]',remaining:30}));let wallet=0;t.game.wallet=()=>{wallet++};
 await t.ai.open('guide');const f=t.dialog.querySelector('#aiForm');t.dialog.querySelector('#aiInput').value='Open my wallet';f.onsubmit({preventDefault(){}});await settle();await settle();
 const labels=[...t.dialog.querySelectorAll('[data-act]')].map(b=>b.textContent);assert.ok(labels.some(l=>/Open your wallet/.test(l)));assert.ok(labels.some(l=>/Go to Heping Café/.test(l)));assert.ok(labels.some(l=>/Claim daily reward/.test(l)));assert.equal(labels.length,3,'unknown screens are ignored');
 t.timers.splice(0).forEach(f=>f());assert.equal(wallet,1,'asked directly, so the wallet opened by itself');assert.equal(t.dialog.open,false);
});
test('every public venue has an AI host, named the same way as on the server, but private homes do not',async()=>{const t=setup();
 const h=t.ai.agentsAt('gym');assert.equal(h.length,1);assert.equal(h[0].name,'Coach Zhang','named characters take their own venue');
 const host=t.ai.agentsAt('liaoning');assert.equal(host[0].id,'host');assert.equal(host[0].name,'Yan','same name as the server (crc32)');assert.match(host[0].role,/Host ·/);assert.equal(t.ai.agentsAt('home').length,0);
 await t.ai.open('host','liaoning');const get=t.calls.find(c=>c.method==='GET');assert.match(get.path,/agent=host&place=liaoning/);
});

test('AI residents are labeled, move, and stay out of private homes without altering human counts',()=>{
 const t=setup();t.context.ChinaLifeCloud.joined=true;t.game.state.place='cafe';
 const first=t.ai.residents();assert.equal(first.length,6);assert.ok(first.every(p=>p.simulated&&p.name.endsWith(' · AI')&&p.id.startsWith('resident:')));assert.ok(first.some(p=>p.place==='cafe'));
 t.passMinutes(1);const next=t.ai.residents();assert.notEqual(next[0].x,first[0].x);
 t.game.state.place='home';assert.ok(t.ai.residents().every(p=>!p.place.startsWith('home')));
 t.context.ChinaLifeCloud.joined=false;assert.equal(t.ai.residents().length,0);
});
