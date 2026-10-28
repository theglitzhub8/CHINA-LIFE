import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const r=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');const js=r('public/r3.js'),css=r('public/r3.css'),game=r('public/game.js');
test('phone: 10 apps on one page, no page dots',()=>{assert.match(game,/const FOLDERS=\[/);assert.equal((game.match(/const FOLDERS=\[(.*?)\];/)[1].match(/\['[a-z]+','[A-Z][a-z]+'/g)||[]).length,10);assert.doesNotMatch(game,/phone-page-controls/)});
test('one Next step pill and onboarding with skip',()=>{assert.match(js,/id='r3Next'/);assert.match(css,/world-side>\*:not\(#r3Next\)\{display:none/);assert.match(js,/Skip tour/);assert.match(js,/state\.onboard|st\.onboard/)});
test('the sheet follows the finger and snaps to 3 detents',()=>{assert.match(js,/touchmove/);assert.match(js,/\['peek',96\],\['half'/)});
test('client only: no requests, no coins',()=>{assert.doesNotMatch(js,/fetch\(|ChinaLifeAuth|\.php|money\s*[+-]=|state\.money/)});
test('no id clash with the character creator',()=>{assert.doesNotMatch(js,/'nextStep'/)});

// UI review task 2: the one-city tour never waits for the hidden café, and the game stays quiet while it runs.
import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
test('one-city tour: no "Tap Map" step, "Pick a place" completes on arrival anywhere, no reward banner during the tour',()=>{
 const t=harness({...fixture(),day:1,xp:0,visited:['university'],place:'university'}),c=t.context,on={};delete t.game.state.onboard;
 const mem=new Map();Object.assign(c,{matchMedia:()=>({matches:true}),requestAnimationFrame:f=>f(),MutationObserver:class{observe(){}},addEventListener:(k,f)=>{on[k]=f},
  localStorage:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)},ChinaLifeWhereTo:{show(){}}});
 vm.runInContext(r('public/one-city.js'),c);vm.runInContext(r('public/r3.js'),c);const tick=()=>on['chinalife:cloudready']();
 assert.equal(c.ChinaLifeOnboarding.step,'cafe','first step is Pick a place');assert.doesNotMatch(t.document.getElementById('coachCard').textContent,/Tap Map/);
 assert.equal(c.ChinaLifeTour.active(),true);
 tick();assert.equal(c.ChinaLifeOnboarding.step,'cafe','staying put does not complete it');
 t.game.state.place='football';tick();assert.equal(c.ChinaLifeOnboarding.step,'order','arriving anywhere completes it');
 c.ChinaLifeOnboarding.advance('order');c.ChinaLifeOnboarding.advance('hi');c.ChinaLifeOnboarding.advance('phone');assert.equal(c.ChinaLifeTour.active(),false);
 assert.match(game,/dailyReady\(\)&&reminded!==today\(\)&&!window\.ChinaLifeTour\?\.active\?\.\(\)/,'reward banner waits for the tour');
});
