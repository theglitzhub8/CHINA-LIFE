import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// Weekly story (docs/ROADMAP.md item 4, switch week_story, default ON).
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const kinds=['visit:university','class','shift','tip','class','match','mission'];
const state=(claimed=0,{ready=false,opensIn=0}={})=>({week:'2026-11-23',story:{id:'exam',icon:'📚',title:'Exam Week',blurb:'Your first big Chinese exam is on Sunday.'},endsIn:5*86400,done:claimed,
 current:claimed<7?claimed+1:null,reward:{coins:50,xp:10},prize:{coins:1000,xp:100},
 steps:kinds.map((kind,i)=>({n:i+1,kind,target:1,count:i<claimed?1:i===claimed&&ready?1:0,opensIn:i===claimed?opensIn:i<claimed?0:86400*(i-claimed),claimed:i<claimed,ready:i===claimed&&ready}))});
function setup({flag=true,d=state(),reply}={}){const t=harness({...fixture(),place:'home',city:'China'}),c=t.context,calls=[],posts=[];t.game.state.created=true;
 c.ChinaLifeFlags={cast:k=>k==='week_story'?flag:undefined,off:()=>false};c.ChinaLifeCloud={signedIn:true};
 c.ChinaLifeAuth={request:async(url,method,body)=>{assert.match(url,/week-story\.php/);if(method==='POST'){posts.push(body);return {data:reply}}return {data:d}}};
 const shown=[];t.game.showScreen=(title,sub,html)=>{shown.push(title);t.document.getElementById('activityContent').innerHTML=html};
 c.ChinaLifeWhereTo={go:id=>calls.push('go:'+id)};t.game.toast=m=>calls.push('toast');t.game.applyServerTotals=r=>calls.push('paid:'+r.money);
 vm.runInContext(fs.readFileSync('public/week-story.js','utf8'),c);return {t,c,doc:t.document,calls,posts,shown,W:c.ChinaLifeWeekStory}}
test('Weekly story: the story, a 7-step path, the step’s story line, what to do, the reward and Go',async()=>{
 const {doc,W,shown,calls}=setup({d:state(2)});await W.open();await flush();assert.deepEqual(shown,['📖 Weekly story']);
 const box=doc.getElementById('wsBody');assert.match(box.textContent,/Exam Week/);
 assert.equal(JSON.stringify([...box.querySelectorAll('.ws-path li')].map(l=>l.className)),JSON.stringify(['done','done','now','','','','']));
 assert.match(box.textContent,/STEP 3 OF 7Books cost money\. Work one shift\./);assert.match(box.textContent,/¥50 \+ 10 XP/);assert.match(box.textContent,/2 of 7 done/);
 
 assert.equal(W.summary().text,'Step 3 of 7 · Work one shift');
});
test('Weekly story: a step that opens tomorrow says so; a ready step claims and pays; step 7 shows the prize',async()=>{
 const later=setup({d:state(3,{opensIn:3600})});await later.W.open();await flush();assert.match(later.doc.getElementById('wsBody').textContent,/OPENS TOMORROW.*Come back tomorrow/);
 assert.equal(later.doc.getElementById('wsGo'),null);assert.equal(later.W.summary().text,'Step 4 opens tomorrow');
 const r=setup({d:state(6,{ready:true}),reply:{...state(7),money:5000,xp:300,awarded:1050,finished:true}});await r.W.open();await flush();
 assert.match(r.doc.getElementById('wsBody').textContent,/plus the ¥1,000 prize and a badge/);assert.equal(r.W.summary().hot,true);
 const b=r.doc.getElementById('wsClaim');assert.match(b.textContent,/Claim ¥1,050/);await b.onclick();await flush();
 assert.equal(JSON.stringify(r.posts),JSON.stringify([{op:'claim'}]));assert.ok(r.calls.includes('paid:5000'));assert.match(r.doc.getElementById('wsBody').textContent,/Story complete!/);
});
test('Weekly story: before the first week it says when it starts; the switch off opens nothing',async()=>{
 const soon=setup({d:{soon:true,startsIn:90000,story:{id:'nightowl',icon:'🪩',title:'Night Owl Week',blurb:'Party.'},reward:{coins:50,xp:10},prize:{coins:1000,xp:100}}});
 await soon.W.open();await flush();assert.match(soon.doc.getElementById('wsBody').textContent,/Night Owl WeekParty\.STARTS MONDAY · IN 1D 1H/);assert.equal(soon.W.summary().text,'Starts Monday · ¥1,000 prize');
 const off=setup({flag:false});await off.W.open();assert.deepEqual(off.shown,[]);
});
test('Weekly story: every story has 7 lines, and every step kind has words',()=>{
 const {W}=setup();const php=fs.readFileSync('chinalife-api/week-story.php','utf8');
 for(const id of ['exam','fitness','star','nightowl']){assert.equal(W.LINES[id].length,7,id);assert.match(php,new RegExp("'"+id+"'=>"))}
 for(const k of php.match(/\['([a-z:]+)',\d+\]/g).map(x=>x.match(/'([a-z:]+)'/)[1]))assert.ok(W.KIND[k],k);
});
