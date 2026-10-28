// University Years plan (docs/UNIVERSITY-YEARS-PLAN.md): every part is built behind an appadmin switch, default OFF.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const r=f=>fs.readFileSync(f,'utf8');
const SWITCHES=['uni_years','uni_food','wardrobe_locks','micro_style','real_sitting'];
function flags({on='',off=''}={}){const store={'chinalife-flags-on':on,'chinalife-flags-off':off},listeners={};
 const ctx={localStorage:{getItem:k=>store[k]??null},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail}},
  addEventListener:(t,f)=>{(listeners[t]||=[]).push(f)},dispatchEvent:e=>{for(const f of listeners[e.type]||[])f(e)},
  document:{head:{append(){}},createElement:()=>({})},ChinaLifeOneCity:{active:()=>true,allows:()=>true}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(r('public/flags.js'),ctx);return ctx}

test('University Years switches are labelled in appadmin Features and start OFF on the server',()=>{const php=r('chinalife-api/hafrik-features.php');
 const off=php.match(/function cl_hafrik_features_default_off\(\): array \{return \[(.*?)\];\}/)[1];
 for(const k of SWITCHES){assert.match(php,new RegExp("'"+k+"'=>'[^']{10,}'"),k+' label');assert.ok(off.includes("'"+k+"'"),k+' starts off')}
});

test('University Years switches start OFF on the client and follow the server and test overrides',()=>{
 let c=flags();const F=c.ChinaLifeFlags;for(const k of SWITCHES)assert.equal(F.cast(k),false,k);
 let changed=0;c.addEventListener('chinalife:cast',()=>changed++);
 c.dispatchEvent(new c.CustomEvent('chinalife:hafrik-features',{detail:{uni_years:true,real_sitting:true}}));
 assert.equal(F.cast('uni_years'),true);assert.equal(F.cast('real_sitting'),true);assert.equal(F.cast('uni_food'),false);assert.equal(changed,1);
 c=flags({on:'uni_food',off:'uni_years'});c.dispatchEvent(new c.CustomEvent('chinalife:hafrik-features',{detail:{uni_years:true}}));
 assert.equal(c.ChinaLifeFlags.cast('uni_food'),true);assert.equal(c.ChinaLifeFlags.cast('uni_years'),false);
});

test('dorm roommate: same gender, stable per player, Beijing-time routine and one moment a day',async()=>{
 const d=await import('../public/dorm.js');const game=(gender,name='Ada')=>({state:{gender,name,student:{university:'campus'}}});
 assert.match(d.roommate(game('female')).name,/^(Lin|Amara|Sofia)$/);assert.match(d.roommate(game('male')).name,/^(Wei|Kofi|Arjun)$/);
 assert.equal(d.roommate(game('male','Bo')).id,d.roommate(game('male','Bo')).id);
 assert.equal(d.routine(3).at,'bed');assert.equal(d.routine(7).at,'cook');assert.equal(d.routine(9).at,null);assert.equal(d.routine(12).at,'desk');
 assert.equal(d.routine(15).back,'17:00');assert.equal(d.routine(18).at,'cook');assert.equal(d.routine(21).at,'desk');assert.equal(d.routine(23).at,'bed');
 const ids=new Set(Array.from({length:5},(_,i)=>d.momentFor(i+1).id));assert.equal(ids.size,5);assert.equal(d.momentFor(6).id,d.momentFor(1).id);
});

test('dorm bond is saved, clamped and survives reloads',async()=>{const {harness,fixture}=await import('./game-harness.mjs');
 const t=harness({...fixture(),dorm:{bond:250,eventDay:3}});assert.equal(JSON.stringify(t.game.state.dorm),'{"bond":100,"eventDay":3}');
 const u=harness(fixture());assert.equal(JSON.stringify(u.game.state.dorm),'{"bond":50,"eventDay":0}');
});

test('university client: campus chip, University screen with locked rooms, and a Sunday exam marked by the server',async()=>{
 const {harness,fixture}=await import('./game-harness.mjs');const t=harness({...fixture(),place:'university'});const c=t.context,d=t.document;
 const rooms=y=>[['classrooms',1],['dorm',1],['store',1],['library',2],['lab',3],['hall',4]].map(([id,n])=>({id,name:id,year:n,open:y>=n}));
 const view=(over={})=>({student:true,enrolled:'2026-11-02',start:'2026-11-02',orientation:false,year:1,week:1,weekday:3,dayName:'Class day',hsk:'HSK 1',examDay:false,resits:[],exams:[],results:{},passedYears:0,rooms:rooms(1),passMark:6,questions:10,reward:{xp:60,coins:120},...over});
 const calls=[];let now=view();
 c.ChinaLifeCloud={university:async data=>{calls.push(data);if(!data)return now;if(data.action==='start_exam')return {...now,exam:{year:1,questions:[{prompt:'What does 你好 (nǐ hǎo) mean?',options:['sorry','hello','thanks','bye']},{prompt:'How do you say 我?',options:['nǐ','wǒ','tā','shì']}]}};
  return {...view({examDay:true,weekday:7,dayName:'Exam day',results:{1:{passed:true,score:2,total:2}},passedYears:1}),result:{year:1,passed:true,score:2,total:2,answers:['hello','wǒ'],xp:60,coins:120}}}};
 c.MutationObserver??=class{observe(){}};c.ChinaLifeFlags={cast:()=>false};vm.runInContext(r('public/university.js'),c);const U=c.ChinaLifeUniversity;
 assert.equal(await U.load(true),null,'switch off: nothing loads');assert.equal(calls.length,0);
 c.ChinaLifeFlags={cast:k=>k==='uni_years'};await U.load(true);assert.match(d.querySelector('.uni-chip').textContent,/Year 1 · Class day/);
 await U.open();const screen=()=>d.getElementById('activityContent').textContent;assert.match(screen(),/Year 1 of 4 · Class day · HSK 1/);assert.match(screen(),/library · opens in Year 2/);assert.match(screen(),/Next exam: Sunday/);
 d.getElementById('activityDialog').close();now=view({examDay:true,weekday:7,dayName:'Exam day',exams:[1]});await U.load(true);assert.match(d.querySelector('.uni-chip').textContent,/Exam day: Year 1 open/);
 await U.open();d.querySelector('[data-uni-exam="1"]').onclick();await new Promise(r=>setTimeout(r,0));assert.match(screen(),/What does 你好/);
 [...d.querySelectorAll('[data-uni-a]')].find(b=>b.textContent==='hello').onclick();[...d.querySelectorAll('[data-uni-a]')].find(b=>b.textContent==='wǒ').onclick();await new Promise(r=>setTimeout(r,0));
 assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify({action:'submit_exam',answers:['hello','wǒ']}));assert.match(screen(),/Year 1 passed/);assert.match(screen(),/\+60 XP · ¥120/);
});
