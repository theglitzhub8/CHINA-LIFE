// University Years food economy (switch uni_food): campus store, fridge, recipes, free cooking and food sickness.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
function kitchen(save={}){const t=harness({...fixture(),...save}),c=t.context;c.MutationObserver??=class{observe(){}};c.ChinaLifeFlags={cast:k=>k==='uni_food'};
 const notes=[];c.ChinaLife.notify=text=>notes.push(text);vm.runInContext(fs.readFileSync('public/kitchen.js','utf8'),c);return {t,c,K:c.ChinaLifeKitchen,s:t.game.state,notes}}

test('cooking: known recipes, your own dish, and the mixes that make you ill',()=>{const {K}=kitchen();
 assert.equal(K.evaluate(['rice','tomato','egg']).recipe,'tomato-egg');assert.equal(K.evaluate(['chili','pork','rice','tofu']).recipe,'mapo-tofu');
 const own=K.evaluate(['noodles','tomato']);assert.equal(own.sick,false);assert.equal(own.name,'Your own dish');assert.equal(own.hunger,36);
 for(const [mix,why] of [[['chicken','beef','rice'],/Two kinds of meat/],[['chicken','chili'],/not cooked through/],[['garlic','soy'],/only seasoning/],[['plantain','soy','rice'],/did not go together/]]){
  const e=K.evaluate(mix);assert.equal(e.sick,true,mix.join());assert.match(e.why,why)}
 assert.equal(K.evaluate(['rice']).ok,false);assert.equal(K.evaluate(['rice','egg','tomato','greens','onion']).ok,false);
 // Every recipe costs between ¥4 and ¥17, so two home-cooked meals stay well under the ¥80 of two ordered ones.
 for(const r of K.RECIPES){const cost=r[3].reduce((a,id)=>a+K.ING[id][3],0);assert.ok(cost>=4&&cost<=17,r[0]+' ¥'+cost)}
});

test('campus store and kitchen: buy at a campus, cook at home, order food, train Cooking',()=>{const {t,K,s}=kitchen({place:'campus'});
 const money=s.money;for(const id of ['tomato','egg','rice'])assert.equal(K.buy(id),true);assert.equal(s.money,money-8);assert.equal(JSON.stringify(s.food.fridge),'{"tomato":1,"egg":1,"rice":1}');
 assert.equal(K.cook(['tomato','egg','rice']),false,'no cooking at the campus');
 s.place='home';assert.equal(K.buy('egg'),false,'the store is on campus');
 s.needs.hunger=20;const xp=s.skillXP?.Cooking||0;
 // A cook that takes time (the walk to the kitchen) keeps its meal record even if the screen redraws meanwhile.
 let finish;t.context.ChinaLifeWorld={perform:(spec,done)=>{finish=done;return true}};assert.equal(K.cook(['tomato','egg','rice']),true);K.tick();K.open();finish();
 assert.equal(s.needs.hunger,75);assert.equal(JSON.stringify(s.food.fridge),'{}');assert.equal(s.food.meals['tomato-egg'],1);assert.equal(s.food.cooked,1);assert.equal(s.skillXP.Cooking,xp+25);
 assert.equal(K.cook(['tomato','egg','rice']),false,'nothing left in the fridge');
 const before=s.money;s.needs.hunger=30;assert.equal(K.order(),true);assert.equal(s.money,before-40);assert.equal(s.needs.hunger,75);
});

test('food sickness: cramps send you to the toilet every 25 minutes until it passes or a doctor treats it',()=>{const {t,K,s,notes}=kitchen({place:'campus'});
 K.buy('chicken');K.buy('chili');s.place='home';s.needs.bladder=90;s.needs.hunger=40;
 assert.equal(K.cook(['chicken','chili']),true);assert.ok(s.food.sick);assert.equal(s.needs.bladder,10);assert.equal(s.needs.hunger,45,'a mystery dish barely feeds you');assert.match(notes[0],/not cooked through/);
 s.needs.bladder=100;t.passMinutes(10);K.tick();assert.equal(s.needs.bladder,100,'no cramp yet');
 t.passMinutes(16);K.tick();assert.equal(s.needs.bladder,10);assert.match(notes.at(-1),/Stomach cramps/);
 s.place='cityhospital';K.tick();assert.equal(s.food.sick,null,'a doctor treats it');
 s.place='campus';K.buy('garlic');K.buy('soy');s.place='home';K.cook(['garlic','soy']);assert.ok(s.food.sick);t.passMinutes(181);K.tick();assert.equal(s.food.sick,null,'it passes after 3 hours');
});

test('the food save is cleaned on load: unknown ingredients and recipes are dropped, counts capped',()=>{
 const {s}=kitchen({food:{fridge:{egg:2,gold:5,rice:999},meals:{'tomato-egg':3,cake:1},cooked:4,sick:{until:'soon'}}});
 assert.equal(JSON.stringify(s.food),'{"fridge":{"egg":2,"rice":30},"sick":null,"meals":{"tomato-egg":3},"cooked":4,"orders":0}');
});

test('switched off: no kitchen chip and no allowance call',async()=>{const t=harness({...fixture(),place:'home'}),c=t.context;c.MutationObserver??=class{observe(){}};
 let calls=0;c.ChinaLifeCloud={allowance:async()=>{calls++;return {paid:100}}};c.ChinaLifeFlags={cast:()=>false};vm.runInContext(fs.readFileSync('public/kitchen.js','utf8'),c);
 assert.equal(await c.ChinaLifeKitchen.claim(),null);assert.equal(calls,0);c.ChinaLifeKitchen.tick();assert.equal(t.document.querySelector('.kitchen-chip'),null);
 c.ChinaLifeFlags={cast:k=>k==='uni_food'};assert.equal((await c.ChinaLifeKitchen.claim()).paid,100);assert.equal(await c.ChinaLifeKitchen.claim(),null,'once a day');
 c.ChinaLifeKitchen.tick();assert.match(t.document.querySelector('.kitchen-chip').textContent,/Kitchen/);
});
