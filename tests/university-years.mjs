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
 const view=(over={})=>({student:true,enrolled:'2026-11-02',start:'2026-11-02',orientation:false,year:1,week:1,weekday:3,dayName:'Class day',hsk:'HSK 1',examDay:false,resits:[],exams:[],results:{},passedYears:0,rooms:rooms(1),passMark:6,passMarks:{},questions:10,reward:{xp:60,coins:120},minute:720,classDay:true,timetable:[{id:'am',time:'09:00',end:'09:45',subject:'Chinese class',status:'missed'},{id:'pm',time:'14:00',end:'14:45',subject:'Lecture',status:'later'}],classTimes:[{id:'am',time:'09:00',subject:'Chinese class'},{id:'pm',time:'14:00',subject:'Lecture'}],attendance:90,truancy:false,classReward:{xp:10,coins:10},...over});
 const calls=[];let now=view();
 c.ChinaLifeCloud={university:async data=>{calls.push(data);if(!data)return now;if(data.action==='start_exam')return {...now,exam:{year:1,questions:[{prompt:'What does 你好 (nǐ hǎo) mean?',options:['sorry','hello','thanks','bye']},{prompt:'How do you say 我?',options:['nǐ','wǒ','tā','shì']}]}};
  return {...view({examDay:true,weekday:7,classDay:false,timetable:[],dayName:'Exam day',results:{1:{passed:true,score:2,total:2}},passedYears:1}),result:{year:1,passed:true,score:2,total:2,answers:['hello','wǒ'],xp:60,coins:120}}}};
 c.MutationObserver??=class{observe(){}};c.ChinaLifeFlags={cast:()=>false};vm.runInContext(r('public/university.js'),c);const U=c.ChinaLifeUniversity;
 assert.equal(await U.load(true),null,'switch off: nothing loads');assert.equal(calls.length,0);
 c.ChinaLifeFlags={cast:k=>k==='uni_years'};await U.load(true);assert.match(d.querySelector('.uni-chip').textContent,/Year 1 · Class day/);
 await U.open();const screen=()=>d.getElementById('activityContent').textContent;assert.match(screen(),/Year 1 of 4 · Class day · HSK 1/);assert.match(screen(),/library · opens in Year 2/);assert.match(screen(),/Next exam: Sunday/);
 d.getElementById('activityDialog').close();now=view({examDay:true,weekday:7,dayName:'Exam day',exams:[1],passMarks:{1:6},classDay:false,timetable:[]});await U.load(true);assert.match(d.querySelector('.uni-chip').textContent,/Exam day: Year 1 open/);
 await U.open();d.querySelector('[data-uni-exam="1"]').onclick();await new Promise(r=>setTimeout(r,0));assert.match(screen(),/What does 你好/);
 [...d.querySelectorAll('[data-uni-a]')].find(b=>b.textContent==='hello').onclick();[...d.querySelectorAll('[data-uni-a]')].find(b=>b.textContent==='wǒ').onclick();await new Promise(r=>setTimeout(r,0));
 assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify({action:'submit_exam',answers:['hello','wǒ']}));assert.match(screen(),/Year 1 passed/);assert.match(screen(),/\+60 XP · ¥120/);
});

test('university client: class chip and check-in, a buzz 2 minutes before class (once), and the truancy warning',async()=>{
 const {harness,fixture}=await import('./game-harness.mjs');const t=harness({...fixture(),place:'campus'});const c=t.context,d=t.document;
 const tt=(am='later',pm='later')=>[{id:'am',time:'09:00',end:'09:45',subject:'Chinese class',status:am},{id:'pm',time:'14:00',end:'14:45',subject:'Lecture',status:pm}];
 const view=(over={})=>({student:true,start:'2026-11-02',today:'2026-11-02',orientation:false,year:1,week:1,weekday:1,dayName:'Class day',hsk:'HSK 1',examDay:false,resits:[],exams:[],results:{},passedYears:0,rooms:[],passMark:5,passMarks:{},questions:10,reward:{xp:60,coins:120},minute:538,classDay:true,timetable:tt(),classTimes:[{id:'am',time:'09:00',subject:'Chinese class'},{id:'pm',time:'14:00',subject:'Lecture'}],attendance:100,truancy:false,classReward:{xp:10,coins:10},...over});
 const calls=[];let now=view();c.ChinaLifeCloud={presenceNow:async()=>{},university:async data=>{calls.push(data);if(!data)return now;now=view({timetable:tt('attended')});return {...now,attended:{id:'am',subject:'Chinese class',xp:10,coins:10}}}};
 const notes=[];c.ChinaLife.notify=(text,open)=>notes.push(text);c.navigator??={};c.MutationObserver??=class{observe(){}};c.ChinaLifeFlags={cast:k=>k==='uni_years'};
 vm.runInContext(r('public/university.js'),c);const U=c.ChinaLifeUniversity;await U.load(true);
 // 08:58: check-in is open, the chip says so; the phone buzzes once, not on every tick.
 assert.match(d.querySelector('.uni-chip').textContent,/Class now: 09:00 Chinese class/);U.tick();U.tick();assert.equal(notes.length,1);assert.match(notes[0],/Chinese class at 09:00, in 2 min/);
 d.querySelector('.uni-chip button').onclick();await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));
 assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify({action:'attend'}));assert.match(d.querySelector('.uni-chip').textContent,/Year 1 · Class day/);
 // The University screen lists today's classes and the score; a low score shows the truancy warning and the harder mark.
 await U.open();const screen=()=>d.getElementById('activityContent').textContent;assert.match(screen(),/09:00–09:45 Chinese class · ✅ attended/);assert.match(screen(),/Attendance this year: 100\/100/);
 d.getElementById('activityDialog').close();now=view({minute:900,attendance:40,truancy:true,passMark:7,timetable:tt('missed','missed')});await U.load(true);await U.open();
 assert.match(screen(),/14:00–14:45 Lecture · ❌ missed/);assert.match(screen(),/Truancy risk: your exam pass mark is 7\/10/);
});

test('university client: a quiet library session (radio paused), reading, three questions and the attendance won back',async()=>{
 const {harness,fixture}=await import('./game-harness.mjs');const t=harness({...fixture(),place:'campus'});const c=t.context,d=t.document;
 const view=(over={})=>({student:true,start:'2026-11-02',today:'2026-11-09',orientation:false,year:2,week:2,weekday:1,dayName:'Class day',hsk:'HSK 1',examDay:false,resits:[],exams:[],results:{},passedYears:0,rooms:[],passMark:6,passMarks:{},questions:10,reward:{xp:60,coins:120},minute:900,classDay:false,timetable:[],classTimes:[{id:'am',time:'09:00',subject:'Chinese class'}],attendance:80,truancy:false,classReward:{xp:10,coins:10},library:{open:true,today:0,perDay:2,points:5},knowledge:0,...over});
 const calls=[];c.ChinaLifeCloud={university:async data=>{calls.push(data);if(!data)return view();
  if(data.action==='start_library')return {...view({library:{open:true,today:1,perDay:2,points:5}}),session:{points:5,words:[{han:'你好',pinyin:'nǐ hǎo',en:'hello'},{han:'我',pinyin:'wǒ',en:'I, me'},{han:'谢谢',pinyin:'xièxie',en:'thank you'}],
   questions:['hello','I, me','thank you'].map(a=>({prompt:'What does it mean?',options:['sorry',a,'bye','name']}))}};
  return {...view({attendance:85,knowledge:15,library:{open:true,today:1,perDay:2,points:5}}),libraryResult:{right:3,total:3,passed:true,points:5,knowledge:15}}}};
 let paused=0;c.ChinaLifeRadio={playing:true,pause:()=>paused++};c.MutationObserver??=class{observe(){}};c.ChinaLifeFlags={cast:k=>k==='uni_years'};
 vm.runInContext(r('public/university.js'),c);const U=c.ChinaLifeUniversity;await U.load(true);await U.open();const screen=()=>d.getElementById('activityContent').textContent;
 assert.match(screen(),/Sessions today: 0\/2/);d.querySelector('[data-uni-library]').onclick();await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));
 assert.equal(paused,1,'the radio pauses');assert.match(screen(),/你好 nǐ hǎo · hello/);d.querySelector('[data-lib-ready]').onclick();
 for(const a of ['hello','I, me','thank you'])[...d.querySelectorAll('[data-lib-a]')].find(b=>b.textContent===a).onclick();await new Promise(r=>setTimeout(r,0));
 assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify({action:'submit_library',answers:['hello','I, me','thank you']}));assert.match(screen(),/\+5 attendance · \+15 knowledge/);assert.match(screen(),/Attendance this year: 85\/100/);
});

test('university client: choose a major in Year 3, then a lab session (terms, steps in order with undo, instruction)',async()=>{
 const {harness,fixture}=await import('./game-harness.mjs');const t=harness({...fixture(),place:'campus'});const c=t.context,d=t.document;t.game.state.student={university:'campus',major:''};
 const majors=[{id:'cs',name:'Computer Science',icon:'💻'},{id:'physics',name:'Physics',icon:'⚛️'}];
 const view=(lab={})=>({student:true,start:'2026-11-02',today:'2026-11-16',orientation:false,year:3,week:3,weekday:1,dayName:'Class day',hsk:'HSK 2',examDay:false,resits:[],exams:[],results:{},passedYears:2,rooms:[],passMark:6,passMarks:{},questions:10,reward:{xp:60,coins:120},minute:600,classDay:false,timetable:[],classTimes:[],attendance:100,truancy:false,classReward:{xp:10,coins:10},library:{open:true,today:0,perDay:2,points:5},knowledge:0,lab:{open:true,major:null,majorName:null,today:0,perDay:1,credits:0,majors,...lab}});
 const session={major:'Computer Science',terms:[{prompt:'What does 电脑 (diànnǎo) mean?',options:['mouse','computer','file','data']},{prompt:'What does 代码 (dàimǎ) mean?',options:['code','screen','network','program']}],
  experiment:{title:'写一个程序 · Write a program',steps:[{id:'s2',han:'保存文件',en:'Save the file'},{id:'s0',han:'打开电脑',en:'Turn on the computer'},{id:'s3',han:'运行程序',en:'Run the program'},{id:'s1',han:'写代码',en:'Write the code'}]},
  instruction:{han:'请保存文件。',pinyin:'qǐng bǎocún wénjiàn',options:['Open the file','Save the file','Run the program','Turn off the screen']}};
 const calls=[];c.ChinaLifeCloud={university:async data=>{calls.push(data);if(!data)return view();
  if(data.action==='choose_major')return {...view({major:'cs',majorName:'Computer Science'}),major:{id:'cs',name:'Computer Science'}};
  if(data.action==='start_lab')return {...view({major:'cs',majorName:'Computer Science',today:1}),labSession:session};
  return {...view({major:'cs',majorName:'Computer Science',today:1,credits:1}),knowledge:20,labResult:{right:4,total:4,passed:true,xp:20,coins:0,knowledge:20,order:true,instruction:true,answers:{terms:['computer','code'],order:['s0','s1','s2','s3'],instruction:'Save the file'}}}}};
 c.MutationObserver??=class{observe(){}};c.ChinaLifeFlags={cast:k=>k==='uni_years'};vm.runInContext(r('public/university.js'),c);const U=c.ChinaLifeUniversity;
 const screen=()=>d.getElementById('activityContent').textContent,tap=(sel,text)=>[...d.querySelectorAll(sel)].find(b=>b.textContent.includes(text)).onclick(),tick=()=>new Promise(r=>setTimeout(r,0));
 await U.load(true);await U.open();assert.match(screen(),/choose your major/);d.querySelector('[data-uni-major="cs"]').onclick();await tick();await tick();
 assert.equal(t.game.state.student.major,'Computer Science','the major is on the character');assert.match(screen(),/Laboratory · Computer Science/);
 d.querySelector('[data-uni-lab]').onclick();await tick();await tick();tap('[data-lab-t]','computer');tap('[data-lab-t]','code');assert.match(screen(),/tap the steps in the right order/);
 tap('[data-lab-s]','打开电脑');tap('[data-lab-s]','运行程序');d.querySelector('[data-lab-undo]').onclick();d.querySelector('[data-lab-hint]').onclick();assert.match(screen(),/写代码 · Write the code/);
 tap('[data-lab-s]','写代码');tap('[data-lab-s]','保存文件');tap('[data-lab-s]','运行程序');assert.match(screen(),/请保存文件/);tap('[data-lab-i]','Save the file');await tick();
 assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify({action:'submit_lab',terms:['computer','code'],order:['s0','s1','s2','s3'],instruction:'Save the file'}));
 assert.match(screen(),/Lab credit earned/);assert.match(screen(),/打开电脑 → 写代码 → 保存文件 → 运行程序/);assert.match(screen(),/Lab credits: 1/);
});

test('university client: graduation writing, the checklist, the stage, the certificate, the blazer and moving out',async()=>{
 const {harness,fixture}=await import('./game-harness.mjs');const t=harness({...fixture(),place:'university'});const c=t.context,d=t.document;t.game.state.student={university:'campus',major:'Physics'};
 t.game.state.wardrobe={owned:[],wearing:{acc:[]},colors:{}};
 const grad=(over={})=>({open:true,ready:true,missing:[],graduated:null,intro:null,minHan:20,reward:{coins:500,xp:200},...over});
 const view=g=>({student:true,start:'2026-11-02',today:'2026-11-23',orientation:false,year:4,week:4,weekday:1,dayName:'Class day',hsk:'HSK 2',examDay:false,resits:[],exams:[],results:{},passedYears:4,rooms:[],passMark:5,passMarks:{},questions:10,reward:{xp:60,coins:120},minute:600,classDay:false,timetable:[],classTimes:[],attendance:100,truancy:false,classReward:{xp:10,coins:10},library:{open:true,today:0,perDay:2,points:5},knowledge:40,lab:{open:true,major:'physics',majorName:'Physics',today:0,perDay:1,credits:2,majors:[]},graduation:g});
 const good='我叫Ada。我是尼日利亚人。我在东北大学学习。我的专业是物理。毕业以后我想在中国工作。';
 const calls=[];c.ChinaLifeCloud={university:async data=>{calls.push(data);if(!data)return view(grad());
  if(data.text!==good)return {...view(grad()),introResult:{passed:false,han:8,parts:{name:true,country:false,university:false,major:false,plan:false},coins:0,xp:0}};
  return {...view(grad({graduated:'2026-11-23',intro:good})),introResult:{passed:true,han:40,parts:{},date:'2026-11-23',coins:500,xp:200,major:'Physics'}}}};
 const said=[];let performed=0;c.ChinaLifeWorld={say:(who,text)=>said.push(text),perform:(spec,done)=>{performed++;done();return true}};
 c.MutationObserver??=class{observe(){}};c.ChinaLifeFlags={cast:k=>k==='uni_years'};vm.runInContext(r('public/university.js'),c);const U=c.ChinaLifeUniversity;
 const screen=()=>d.getElementById('activityContent').textContent,tick=()=>new Promise(r=>setTimeout(r,0));
 await U.load(true);await U.open();d.querySelector('[data-uni-grad]').onclick();assert.match(screen(),/At least 20 Chinese characters/);
 d.getElementById('uniIntro').value='我叫Ada。我是学生。';d.querySelector('[data-uni-submit]').onclick();await tick();await tick();
 assert.match(screen(),/❌ Where you are from/);assert.match(screen(),/8 Chinese characters · write at least 20/);assert.equal(d.getElementById('uniIntro').value,'我叫Ada。我是学生。','the draft is kept');
 d.getElementById('uniIntro').value=good;d.querySelector('[data-uni-submit]').onclick();await tick();await tick();
 assert.equal(performed,1);assert.equal(said[0],good,'read on stage');assert.match(screen(),/Degree certificate/);assert.match(screen(),/Bachelor · Physics/);assert.match(screen(),/moved out of the dorm/);
 assert.equal(t.game.state.student.graduated,'2026-11-23');assert.ok(t.game.state.wardrobe.owned.includes('grad-blazer'));
});

test('the graduation blazer is never sold, but shows under My stuff once it is yours',async()=>{
 const {harness,fixture}=await import('./game-harness.mjs');const t=harness({...fixture(),place:'mall'}),d=t.document;
 const cat=c=>{t.game.store(c);return !!d.querySelector('[data-item="grad-blazer"]')};
 assert.equal(cat('clothes'),false);assert.equal(cat('mine'),false);
 t.game.state.wardrobe.owned.push('grad-blazer');assert.equal(cat('clothes'),false);assert.equal(cat('mine'),true);
});
