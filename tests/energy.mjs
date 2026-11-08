import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// Energy Phase 7 (switch energy_loop, default ON): Welcome back streak card, first visit of the day, pulses, celebrations.
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const yesterday=()=>new Date(Date.now()+8*3600e3-864e5).toISOString().slice(0,10);
function setup({place='home',flag=true,streak=2,last=yesterday()}={}){const t=harness({...fixture(),place,city:'China',lastVisit:last,streak}),c=t.context,posts=[];
 t.game.state.created=true;t.game.state.lastVisit=last;t.game.state.streak=streak;
 c.ChinaLifeFlags={cast:k=>k==='energy_loop'?flag:undefined,off:()=>false};
 const kept=new Map();c.localStorage={getItem:k=>kept.has(k)?kept.get(k):null,setItem:(k,v)=>kept.set(k,String(v)),removeItem:k=>kept.delete(k)};
 c.ChinaLifeCloud={signedIn:true,claimDaily:async()=>{posts.push('daily');t.game.state.lastVisit=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);t.game.state.streak=streak+1;return {streak:streak+1,money:50*(streak+1),xp:20*(streak+1)}}};
 c.ChinaLifeAuth={request:async(url,method,body)=>{if(/daily-visit/.test(url)){if(method==='POST'){posts.push('visit:'+body.place);return {data:{money:3220,xp:5,awarded:20,awardedXp:5,duplicate:false,all:false}}}return {data:{visited:[]}}}return {data:{}}}};
 vm.runInContext(fs.readFileSync('public/energy.js','utf8'),c);return {t,c,d:t.document,posts,E:c.ChinaLifeEnergy,kept}}
test('Welcome back: once a day, the 7-day ladder at today\'s day, Claim uses the daily reward and celebrates',async()=>{
 const {t,d,posts,E,kept}=setup();assert.equal(t.game.rankInfo().daily,true);
 assert.equal(E.welcome(true),true);const card=d.getElementById('enWelcome');assert.match(card.textContent,/Day 3 streak/);
 assert.equal(d.querySelectorAll('.en-ladder li.done').length,2);assert.match(d.querySelector('.en-ladder li.today').textContent,/Day 3/);assert.match(d.querySelector('.en-claim').textContent,/\+¥150 · \+60 XP/);
 await d.querySelector('.en-claim').onclick({currentTarget:d.querySelector('.en-claim')});await flush();
 assert.deepEqual(posts,['daily']);assert.equal(d.getElementById('enWelcome'),null);assert.match(d.querySelector('.en-burst').textContent,/Day 3 streak!/);
 assert.equal(E.welcome(),false,'not again today');
 const fresh=setup({last:'2000-01-01',streak:5});fresh.E.welcome(true);assert.match(fresh.d.getElementById('enWelcome').textContent,/Day 1 streak/,'a missed day starts again');
 const claimed=setup();claimed.t.game.state.lastVisit=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);assert.equal(claimed.E.welcome(true),false,'nothing to claim');
});
test('first visit of the day pays once per place; pulses mark a dock button; switch off does nothing',async()=>{
 const {t,d,posts,E}=setup({place:'football'});await E.visit('football');await flush();
 assert.deepEqual(posts,['visit:football']);assert.equal(t.game.state.money,3220);assert.match(d.querySelector('.en-burst').textContent,/First visit today/);assert.deepEqual([...E.visited],['football']);
 const dock=d.createElement('nav');dock.id='placeDock';dock.dataset.place='cityhospital';dock.innerHTML='<button data-pd="health"></button>';d.body.append(dock);
 t.game.state.needs.hunger=10;E.pulses();assert.ok(dock.querySelector('[data-pd="health"]').classList.contains('live'));
 t.game.state.needs.hunger=80;E.pulses();assert.ok(!dock.querySelector('[data-pd="health"]').classList.contains('live'));
 const off=setup({flag:false});assert.equal(off.E.welcome(true),false);
 const r=f=>fs.readFileSync(f,'utf8');assert.match(r('public/flags.js'),/energy_loop:true/);assert.match(r('public/index.dev.html'),/<script src="club-dock\.js"><\/script><script src="energy\.js"><\/script>/);
 assert.match(r('public/football.js'),/ChinaLifeCelebrate\?\.\('🎯 Challenge complete!'/);assert.match(r('public/gossip-room.js'),/window\.ChinaLifeCelebrate\('✅ '/);
});
