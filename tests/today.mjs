import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// Today's Three (docs/TODAY-PLAN.md Phase 1, switch todays_three, default ON).
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const task=(group,key,count,target,done=count>=target)=>({group,key,count,target,done});
function setup({flag=true,signed=true,state}={}){const t=harness({...fixture(),place:'home',city:'China'}),c=t.context,posts=[];t.game.state.created=true;
 c.ChinaLifeFlags={cast:k=>k==='todays_three'?flag:undefined,off:()=>false};
 let d=state||{day:'2026-11-14',endsIn:3*3600+120,swapped:false,bonus:{coins:300,xp:50,claimed:false},tasks:[task('hustle','shift',0,1),task('life','places',1,3),task('linkup','tip',1,1)]};
 c.ChinaLifeCloud={signedIn:signed};
 c.ChinaLifeAuth={request:async(url,method,body)=>{assert.match(url,/today\.php/);if(method==='POST'){posts.push(body);
   if(body.op==='swap')d={...d,swapped:true,tasks:d.tasks.map(x=>x.group===body.group?task('hustle','mission',0,1):x)};
   if(body.op==='bonus')return {data:{...d,bonus:{...d.bonus,claimed:true},money:3500,xp:50,awarded:300,awardedXp:50,duplicate:false}}}return {data:d}}};
 const shown=[];t.game.showScreen=(title,sub,html)=>{shown.push(title);t.document.getElementById('activityContent').innerHTML=html};
 const fun=[];c.ChinaLifeCelebrate=(a,b)=>fun.push(a+' '+b);
 vm.runInContext(fs.readFileSync('public/today.js','utf8'),c);return {t,c,doc:t.document,posts,shown,fun,T:c.ChinaLifeToday}}
test('Today’s Three: three tasks with group, time, reward and Go; progress, countdown and the bonus line',async()=>{
 const {doc,T,shown}=setup();await T.open();await flush();
 assert.deepEqual(shown,['🎯 Today']);const box=doc.getElementById('tdBody');
 assert.equal(box.querySelectorAll('.td-task').length,3);assert.match(box.textContent,/1\/3/);assert.match(box.textContent,/New tasks in 3h 2m/);
 assert.match(box.textContent,/HUSTLE.*Work one shift at your job.*about 5 min/);assert.match(box.textContent,/1 \/ 3/);
 assert.equal(box.querySelectorAll('[data-go]').length,2,'done tasks have no Go');assert.equal(box.querySelectorAll('[data-swap]').length,2,'swap only unfinished tasks');
 assert.match(box.textContent,/Do all three · \+¥300 · \+50 XP/);assert.equal(box.querySelector('[data-td="bonus"]'),null);
});
test('Today’s Three: one swap replaces the task and hides the other swaps; the bonus pays and celebrates once all are done',async()=>{
 const {doc,T,posts}=setup();await T.open();await flush();
 doc.querySelector('[data-swap="hustle"]').onclick();await flush();
 assert.equal(JSON.stringify(posts),JSON.stringify([{op:'swap',group:'hustle'}]));assert.match(doc.getElementById('tdBody').textContent,/night mission/);assert.equal(doc.querySelectorAll('[data-swap]').length,0);
 const all=setup({state:{day:'2026-11-14',endsIn:60,swapped:true,bonus:{coins:300,xp:50,claimed:false},tasks:[task('hustle','shift',1,1),task('life','match',1,1),task('linkup','react',5,5)]}});
 await all.T.open();await flush();const btn=all.doc.querySelector('[data-td="bonus"]');assert.ok(btn,'Collect shows');
 btn.dispatchEvent?.(new all.c.Event('click'));if(!all.posts.length)await btn.click?.();await flush();
 assert.equal(JSON.stringify(all.posts),JSON.stringify([{op:'bonus'}]));assert.equal(all.t.game.state.money,3500);assert.match(all.fun[0],/Daily Bonus/);assert.match(all.doc.getElementById('tdBody').textContent,/Daily Bonus collected/);
});
test('Today’s Three: signed out asks to log in; the switch off leaves the old Tasks screen',async()=>{
 const {doc,T,posts}=setup({signed:false});await T.open();await flush();assert.match(doc.getElementById('tdBody').textContent,/Log in with Hafrik/);assert.equal(posts.length,0);
 const off=setup({flag:false});assert.equal(off.T.on(),false);
});
