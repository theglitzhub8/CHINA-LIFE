// Hospital Phase 0 (docs/HOSPITAL-PLAN.md, switch hospital_care): fainting or a blackout takes you to the City Hospital
// by ambulance; you wake up on the ward with the bill, and "Your health" shows what is wrong and how to fix it.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
const r=f=>fs.readFileSync(f,'utf8');const tick=()=>new Promise(res=>setImmediate(res));

const PAPER=['fever','head','stomach','cough','register'].map(id=>({id,prompt:'问 '+id,pinyin:'wèn',options:['right '+id,'wrong a','wrong b','wrong c']}));
const ITEMS={painkiller:[60,'Painkillers','止痛药','zhǐtòng yào','+20 energy'],ors:[40,'Rehydration salts','口服补液盐','kǒufú bǔyè yán','−40 drunk, +5 energy'],vitamins:[80,'Vitamins','维生素','wéishēngsù','Needs drop 30% slower for 24 hours'],stomach:[90,'Stomach medicine','肠胃药','chángwèi yào','Cures food sickness']};
let shelf={},vit=0;const pharm=b=>{if(b.op==='buy')shelf[b.item]=(shelf[b.item]||0)+1;if(b.op==='use'){shelf[b.item]--;if(b.item==='vitamins')vit=Math.floor(Date.now()/1000)+86400}return {items:ITEMS,max:5,stock:{painkiller:0,ors:0,vitamins:0,stomach:0,...shelf},vitaminsUntil:vit,money:2940,xp:0}};
function hospital(on,state={}){
 const t=harness({...fixture(),place:'football',...state}),c=t.context,calls=[],trips=[];
 const keys=on===true?['hospital_care']:on||[];c.ChinaLifeFlags={cast:k=>keys.includes(k),appOff:()=>false};c.ChinaLifeCloud={signedIn:true};
 c.ChinaLifeAuth={request:async(path,method,body)=>{if(/economy\.php/.test(path))calls.push([path,body]);if(body?.action==='pharmacy')return {data:pharm(body)};if(body?.action==='checkup')return {data:body.step==='start'?{questions:PAPER}:{money:3000,xp:500,checkup:{right:4,total:5,xp:32,marked:PAPER.map((q,i)=>({id:q.id,prompt:q.prompt,pinyin:q.pinyin,answer:q.options[0],right:i>0}))}}};return {data:{charged:200,bill:200,first:false,recovering:false,money:3000,xp:0}}}};
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
