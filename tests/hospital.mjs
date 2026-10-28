// Hospital Phase 0 (docs/HOSPITAL-PLAN.md, switch hospital_care): fainting or a blackout takes you to the City Hospital
// by ambulance; you wake up on the ward with the bill, and "Your health" shows what is wrong and how to fix it.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
const r=f=>fs.readFileSync(f,'utf8');const tick=()=>new Promise(res=>setImmediate(res));

const PAPER=['fever','head','stomach','cough','register'].map(id=>({id,prompt:'问 '+id,pinyin:'wèn',options:['right '+id,'wrong a','wrong b','wrong c']}));
const ITEMS={painkiller:[60,'Painkillers','止痛药','zhǐtòng yào','+20 energy'],ors:[40,'Rehydration salts','口服补液盐','kǒufú bǔyè yán','−40 drunk, +5 energy'],vitamins:[80,'Vitamins','维生素','wéishēngsù','Needs drop 30% slower for 24 hours'],stomach:[90,'Stomach medicine','肠胃药','chángwèi yào','Cures food sickness']};
let shelf={},vit=0;const pharm=b=>{if(b.op==='buy')shelf[b.item]=(shelf[b.item]||0)+1;if(b.op==='use'){shelf[b.item]--;if(b.item==='vitamins')vit=Math.floor(Date.now()/1000)+86400}return {items:ITEMS,max:5,stock:{painkiller:0,ors:0,vitamins:0,stomach:0,...shelf},vitaminsUntil:vit,money:2940,xp:0}};
let staff=()=>({}),visits=()=>({}),insure=()=>({}),bill=null;
function hospital(on,state={}){
 const t=harness({...fixture(),place:'football',...state}),c=t.context,calls=[],trips=[];
 const keys=on===true?['hospital_care']:on||[];c.ChinaLifeFlags={cast:k=>keys.includes(k),appOff:()=>false};c.ChinaLifeCloud={signedIn:true};
 c.ChinaLifeAuth={request:async(path,method,body)=>{if(/economy\.php/.test(path))calls.push([path,body]);if(/hospital-visits\.php/.test(path)){calls.push([path,body]);return {data:visits(method,body)}}if(/hospital-staff\.php/.test(path)){calls.push([path,body]);return {data:staff(method,body)}}if(body?.action==='pharmacy')return {data:pharm(body)};if(body?.action==='insurance')return {data:insure(body)};if(body?.action==='checkup')return {data:body.step==='start'?{questions:PAPER}:{money:3000,xp:500,checkup:{right:4,total:5,xp:32,marked:PAPER.map((q,i)=>({id:q.id,prompt:q.prompt,pinyin:q.pinyin,answer:q.options[0],right:i>0}))}}};return {data:bill||{charged:200,bill:200,first:false,recovering:false,money:3000,xp:0}}}};
 c.ChinaLifeWorld={journey:(o,done)=>{trips.push(o);done()}};
 vm.runInContext(r('public/hospital.js'),c);return {t,c,calls,trips};
}

test('fainting with the switch on: ambulance to the City Hospital, the ¥200 bill, and the wake-up screen',async()=>{
 const {t,c,calls,trips}=hospital(true);t.game.state.needs.energy=0;t.game.refresh();await tick();await tick();
 assert.equal(trips[0]?.to,'cityhospital');assert.match(trips[0].label,/Ambulance/);assert.equal(t.game.state.place,'cityhospital');
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),['/chinalife/economy.php',{action:'hospital',cause:'faint'}]);
 const d=t.document;assert.match(d.querySelector('#activityContent h2').textContent,/You fainted from exhaustion/);assert.match(d.getElementById('activityContent').textContent,/Bill: ¥200/);
 assert.ok(t.game.state.needs.energy>=45,'rested on the ward');
 d.getElementById('hpHealth').onclick();assert.match(d.querySelector('#activityContent h2').textContent,/Your health/);
});

test('a blackout with the switch on wakes you at the hospital, sobered up, with no ¥100 taxi',async()=>{
 const {t,calls}=hospital(true);t.game.state.drunk=100;const money=t.game.state.money;t.game.refresh();await tick();await tick();
 assert.equal(t.game.state.place,'cityhospital');assert.equal(calls[0][1].cause,'blackout');assert.ok(t.game.state.drunk<=20);assert.equal(t.game.state.money,3000,'the money is what the server says after the bill (no extra ¥100 taxi)');void money;
 assert.match(t.document.querySelector('#activityContent h2').textContent,/You blacked out/);
});

test('switch off: fainting works exactly as before (no ambulance, no bill)',async()=>{
 const {t,calls,trips}=hospital(false);t.game.state.needs.energy=0;t.game.refresh();await tick();
 assert.equal(trips.length,0);assert.equal(calls.length,0);assert.match(t.document.querySelector('#activityContent h2').textContent,/You fainted/);assert.notEqual(t.game.state.place,'cityhospital');
});

test('Your health lists what is low, food sickness and being drunk, with a fix for each',()=>{
 const {t,c}=hospital(true,{drunk:60});const s=t.game.state;s.needs.hunger=10;s.needs.fun=20;s.food={sick:{until:Date.now()+1e6}};
 c.ChinaLifeHospital.health();const text=t.document.getElementById('activityContent').textContent;
 assert.match(text,/Hungry · 10%/);assert.match(text,/Bored · 20%/);assert.match(text,/Food sickness/);assert.match(text,/Drunk · 60%/);assert.doesNotMatch(text,/Tired/);
 s.needs={hunger:80,energy:80,hygiene:80,bladder:80,fun:80,social:80};s.food={};s.drunk=0;c.ChinaLifeHospital.health();
 assert.match(t.document.getElementById('activityContent').textContent,/You’re in good shape/);
 assert.match(r('public/world.js'),/if\(p\[0\]==='cityhospital'&&window\.ChinaLifeHospital\?\.on\?\.\(\)\)items\.unshift\(\['🩺 Your health'/);
});

// Hospital Phase 1 (switch hospital_checkup): the free weekly check-up, 5 questions from the doctor, marked on the server.
test('check-up: offered in Your health at the hospital only with both switches, 5 questions, XP from the server, Chinese progress',async()=>{
 const off=hospital(true,{place:'cityhospital'});off.c.ChinaLifeHospital.health();assert.equal(off.t.document.getElementById('hpCheck'),null,'hospital_checkup off');
 const away=hospital(['hospital_care','hospital_checkup']);away.c.ChinaLifeHospital.health();assert.equal(away.t.document.getElementById('hpCheck'),null,'only at the hospital');
 const {t,c,calls}=hospital(['hospital_care','hospital_checkup'],{place:'cityhospital'}),d=t.document,chinese=()=>t.game.state.skillXP.Chinese+t.game.state.skills.Chinese*100,before=chinese();
 c.ChinaLifeHospital.health();d.getElementById('hpCheck').onclick();await tick();await tick();
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])),{action:'checkup',step:'start'});
 for(let i=0;i<5;i++){assert.match(d.querySelector('#activityContent h2').textContent,/Check-up/);assert.match(d.getElementById('activityContent').textContent,new RegExp('Question '+(i+1)+' of 5'));d.querySelector('[data-hp-a="0"]').onclick()}
 await tick();await tick();
 assert.deepEqual(JSON.parse(JSON.stringify(calls[1][1])),{action:'checkup',answers:{fever:'right fever',head:'right head',stomach:'right stomach',cough:'right cough',register:'right register'}});
 const text=d.getElementById('activityContent').textContent;assert.match(text,/4\/5 right · \+32 XP · Chinese \+20/);assert.match(text,/next free check-up is on Monday/);
 assert.equal(t.game.state.money,3000);assert.equal(chinese()-before,20,'+5 Chinese per right answer');
});

// Hospital Phase 2 (switch hospital_pharmacy): buy at the hospital, take anywhere (Your health / the phone's Wellbeing).
test('pharmacy: buy at the hospital, take anywhere, each medicine does what it says, vitamins slow the drop',async()=>{
 shelf={};vit=0;const keys=['hospital_care','hospital_pharmacy'];
 const off=hospital(['hospital_care'],{place:'cityhospital'});off.c.ChinaLifeHospital.health();assert.equal(off.t.document.getElementById('hpPharm'),null,'hospital_pharmacy off');
 const {t,c,calls}=hospital(keys,{place:'cityhospital'}),d=t.document,s=t.game.state,H=c.ChinaLifeHospital,click=async el=>{el.onclick();await tick();await tick()};
 H.health();assert.match(d.getElementById('hpPharm').textContent,/Pharmacy/);await click(d.getElementById('hpPharm'));
 assert.match(d.getElementById('activityContent').textContent,/止痛药/);assert.ok(d.querySelector('[data-hp-use="painkiller"]').disabled,'nothing to take yet');
 for(const id of ['painkiller','ors','vitamins','stomach'])await click(d.querySelector('[data-hp-buy="'+id+'"]'));
 assert.equal(s.money,2940,'money from the server');assert.deepEqual(calls.filter(x=>x[1].op==='buy').map(x=>x[1].item),['painkiller','ors','vitamins','stomach']);
 s.place='football';s.needs.energy=30;s.drunk=70;s.food={sick:{until:Date.now()+1e6,next:Date.now()+1e6,why:''}};
 H.health();assert.match(d.getElementById('hpPharm').textContent,/Your medicine/);await click(d.getElementById('hpPharm'));
 assert.equal(d.querySelector('[data-hp-buy]'),null,'buy only at the hospital');
 await click(d.querySelector('[data-hp-use="painkiller"]'));assert.equal(s.needs.energy,50);
 await click(d.querySelector('[data-hp-use="ors"]'));assert.equal(s.drunk,30);assert.equal(s.needs.energy,55);
 await click(d.querySelector('[data-hp-use="stomach"]'));assert.equal(s.food.sick,null);
 await click(d.querySelector('[data-hp-use="vitamins"]'));assert.match(d.getElementById('activityContent').textContent,/Vitamins working until/);
 s.needs.hunger=80;H.vitamins();s.needs.hunger=70;H.vitamins();assert.equal(s.needs.hunger,73,'30% of the drop given back');
 assert.match(r('public/game.js'),/needs:\['💊','Wellbeing',\(\)=>window\.ChinaLifeHospital\?\.on\?\.\(\)\?window\.ChinaLifeHospital\.health\(\):\$\('needsBtn'\)\.onclick\(\)\]/);
});

// Hospital Phase 3 (switch hospital_staff): a patient asks the staff on shift; a nurse takes the test and treats.
test('player doctors and nurses: ask the doctor on shift, wait, get treated; the test, the shift and the queue',async()=>{
 const keys=['hospital_care','hospital_staff'],me={role:null,onShift:false,testToday:false,treatedToday:0,paidToday:0,shiftUntil:0},pay={doctor:120,nurse:80,xp:20,perDay:20,shift:60};
 let patient=null;const P={id:7,problem:'sick',label:'Food sickness',status:'waiting'};
 staff=(m,b)=>{if(!b)return {enabled:true,me,pay,staffOn:1,patient,queue:me.onShift?[{id:9,name:'user9',chart:{needs:{hunger:20,energy:80},drunk:70,sick:false},options:[['energy','Rest on the ward'],['drunk','Rehydration salts 口服补液盐'],['fun','TV'],['hunger','Congee']],waitingSince:Date.now()/1000-120}]:[]};
  if(b.action==='request'){patient={...P};return {patient}}if(b.action==='ack'){patient=null;return {money:3000,xp:510}}
  if(b.action==='test_start')return {questions:[{id:'a',prompt:'挂号',pinyin:'guàhào',options:['to register','x','y','z']}],pass:7};if(b.action==='test_submit'){me.role='nurse';return {right:1,total:1,passed:true,answers:['to register']}}
  if(b.action==='shift_start'){me.onShift=true;me.shiftUntil=Date.now()/1000+3600;return {me}}if(b.action==='treat')return {money:3080,xp:520,result:{correct:true,paid:80,xp:20,problem:'drunk',label:'Drunk',right:'Rehydration salts'},me};return {}};
 const off=hospital(['hospital_care'],{place:'cityhospital'});off.c.ChinaLifeHospital.health();assert.equal(off.t.document.getElementById('hpAsk'),null,'hospital_staff off');
 const {t,c,calls}=hospital(keys,{place:'cityhospital'}),d=t.document,s=t.game.state,H=c.ChinaLifeHospital,click=async el=>{el.onclick();await tick();await tick();await tick()};
 s.food={sick:{until:Date.now()+1e6,next:Date.now()+1e6,why:''}};s.drunk=0;
 // The patient: ask, wait, and collect once treated (the cure is applied here).
 H.health();await click(d.getElementById('hpAsk'));const ask=calls.find(x=>x[1]?.action==='request')[1];assert.equal(ask.chart.sick,true);assert.ok('hunger' in ask.chart.needs);
 assert.match(d.querySelector('#activityContent h2').textContent,/Waiting for the doctor/);
 patient={...P,status:'treated',staff:'user57',treatment:'sick',treatmentName:'Stomach medicine 肠胃药',correct:true};
 const poll=t.timers.pop();await poll();await tick();await tick();await tick();
 assert.match(d.querySelector('#activityContent h2').textContent,/user57 treated you/);assert.equal(s.food.sick,null,'cured');assert.equal(s.xp,510,'XP from the server');
 // The nurse: not qualified, the test, the shift, the queue and a treatment.
 await click({onclick:H.work});assert.match(d.getElementById('activityContent').textContent,/Only qualified players/);
 await click(d.getElementById('hpTest'));await click(d.querySelector('[data-hp-a="0"]'));assert.match(d.querySelector('#activityContent h2').textContent,/You’re a nurse/);
 await click(d.getElementById('hpGoWork'));assert.match(d.getElementById('activityContent').textContent,/qualified: Nurse/);
 await click(d.getElementById('hpShift'));assert.match(d.querySelector('#activityContent h2').textContent,/On shift/);
 const text=d.getElementById('hpQueue').textContent;assert.match(text,/user9/);assert.match(text,/Drunk 70%/);assert.match(text,/Hunger 20%/);
 await click(d.querySelector('[data-hp-treat="9:drunk"]'));assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x[1]?.action==='treat')[1])),{action:'treat',id:9,treatment:'drunk'});assert.equal(s.money,3080);
});

// Hospital Phase 4 (switch hospital_visits): visit a friend on the ward; your visitors' gifts reach you once.
test('ward visits: list friends on the ward, visit with flowers and a card, and collect your own visitors',async()=>{
 const keys=['hospital_care','hospital_visits'],gifts={card:[0,'Just a card','+10 social'],flowers:[50,'Flowers 鲜花','+15 fun, +20 social'],fruit:[30,'Fruit 水果','+15 hunger, +15 social']},cards={getwell:'早日康复！ Get well soon!',miss:'我们想你！ We miss you!'};
 let waiting=0,visited=false;
 visits=(m,b)=>{if(!b)return {enabled:true,hours:3,gifts,cards,waiting,ward:[{id:60,name:'user60',since:Date.now()/1000-600,until:Date.now()/1000+9000,visited}]};
  if(b.action==='visit'){visited=true;return {money:2950,xp:0,visited:{id:60,name:'user60',gift:b.gift,card:cards[b.card],paid:50,xp:10}}}
  if(b.action==='collect'){waiting=0;return {visits:[{from:'user59',gift:'fruit',giftName:'Fruit 水果',card:'我们想你！ We miss you!'}]}}return {}};
 const off=hospital(['hospital_care'],{place:'cityhospital'});off.c.ChinaLifeHospital.health();assert.equal(off.t.document.getElementById('hpWard'),null,'hospital_visits off');
 const {t,c,calls}=hospital(keys,{place:'cityhospital'}),d=t.document,s=t.game.state,click=async el=>{el.onclick();await tick();await tick();await tick()};
 c.ChinaLifeHospital.health();await tick();await tick();assert.equal(calls.filter(x=>x[1]?.action==='collect').length,0,'nothing waiting: nothing collected');
 await click(d.getElementById('hpWard'));assert.match(d.getElementById('activityContent').textContent,/user60/);
 await click(d.querySelector('[data-hp-visit="60"]'));await click(d.querySelector('[data-hp-gift="flowers"]'));const social=s.needs.social;await click(d.querySelector('[data-hp-card="getwell"]'));
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x[1]?.action==='visit')[1])),{action:'visit',to:60,gift:'flowers',card:'getwell'});
 assert.equal(s.money,2950);assert.equal(s.needs.social,Math.min(100,social+10),'visiting cheers you up too');assert.ok(d.querySelector('[data-hp-visit="60"]').disabled,'visited today');
 // Your own visitors: fruit gives +15 hunger and +15 social, once, with a banner that opens the list.
 waiting=1;s.needs.hunger=40;s.needs.social=40;await c.ChinaLifeHospital.collectVisits();
 assert.equal(s.needs.hunger,55);assert.equal(s.needs.social,55);const banner=d.getElementById('gameNotification');assert.match(banner.textContent,/user59 visited you on the ward/);
 banner.onclick();assert.match(d.getElementById('activityContent').textContent,/我们想你/);
 await c.ChinaLifeHospital.collectVisits();assert.equal(s.needs.hunger,55,'only once');
});

// Hospital Phase 5 (switch hospital_insurance): students join the campus insurance; the bill shows what it saved.
test('student insurance: offered to students only, join for ¥200, and the wake-up bill shows the saving',async()=>{
 const keys=['hospital_care','hospital_insurance'];let until=0;
 insure=b=>{if(b.op==='join')until=Math.floor(Date.now()/1000)+30*86400;return {money:2800,xp:0,insurance:{until,student:true,fee:200,days:30,billCut:80,pharmacyCut:25,bill:200,renewDays:7}}};
 const worker=hospital(keys,{background:'Worker'});worker.c.ChinaLifeHospital.health();assert.equal(worker.t.document.getElementById('hpIns'),null,'students only');
 const {t,c,calls}=hospital(keys),d=t.document,s=t.game.state,click=async el=>{el.onclick();await tick();await tick();await tick()};
 c.ChinaLifeHospital.health();await click(d.getElementById('hpIns'));const text=d.getElementById('activityContent').textContent;
 assert.match(text,/Not covered yet/);assert.match(text,/¥40 instead of ¥200/);assert.match(text,/25% off/);assert.match(text,/never renews by itself/);
 await click(d.getElementById('hpJoin'));assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(x=>x[1]?.action==='insurance').map(x=>x[1].op))),['status','join','status']);
 assert.equal(s.money,2800);assert.match(d.getElementById('activityContent').textContent,/Covered until/);assert.ok(d.getElementById('hpJoin').disabled,'renew only in the last week');
 bill={charged:40,bill:40,insured:true,saved:160,first:false,recovering:false,money:2760,xp:0};s.needs.energy=0;t.game.refresh();await tick();await tick();
 assert.match(d.getElementById('activityContent').textContent,/Bill: ¥40 · 🛡️ your insurance saved ¥160/);bill=null;
});
