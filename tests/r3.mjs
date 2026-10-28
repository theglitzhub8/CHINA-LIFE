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

// UI review task 3: one card under the HUD at a time, and banners take that spot (newest wins) instead of covering the HUD.
test('one card spot: the most important card shows, banners take the spot, the newest banner wins',()=>{
 const t=harness({...fixture(),day:9,xp:5000,visited:['a','b','c']}),c=t.context,d=t.document;let now=0;
 const mem=new Map();Object.assign(c,{matchMedia:()=>({matches:true}),requestAnimationFrame:f=>f(),MutationObserver:class{observe(){}},addEventListener(){},performance:{now:()=>++now},
  localStorage:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)}});
 vm.runInContext(r('public/r3.js'),c);const ui=d.getElementById('worldUI'),add=cls=>{const e=d.createElement('div');e.className=cls;ui.appendChild(e);return e};
 const uni=add('r5-attend uni-chip'),kitchen=add('r5-attend kitchen-chip'),school=add('r5-attend'),tip=add('r4-tip');c.ChinaLifeLane.update();
 const shown=()=>[...d.querySelectorAll('.r5-attend,.r4-tip,.message-notification,#toast')].filter(e=>!e.classList.contains('lane-wait'));
 assert.deepEqual(shown().filter(e=>e!==d.getElementById('toast')),[school],'daily attendance before kitchen, university info and tips');
 uni.classList.add('uni-now');c.ChinaLifeLane.update();assert.ok(uni.classList.contains('lane-first'),'an open class check-in goes first');
 school.remove();uni.classList.remove('uni-now');c.ChinaLifeLane.update();assert.ok(kitchen.classList.contains('lane-first'),'the next card comes back when one goes');
 // A banner takes the spot: every card waits. Two banners: the newest shows.
 const toast=d.getElementById('toast');toast.classList.add('show');c.ChinaLifeLane.update();assert.ok([uni,kitchen,tip].every(e=>e.classList.contains('lane-wait')));
 const note=d.createElement('button');note.className='message-notification';note.hidden=false;d.body.append(note);c.ChinaLifeLane.update();
 assert.ok(toast.classList.contains('lane-wait'));assert.ok(!note.classList.contains('lane-wait'));
 note.hidden=true;toast.classList.remove('show');c.ChinaLifeLane.update();assert.ok(kitchen.classList.contains('lane-first'),'cards return when banners go');
 const css=r('public/r4.css');assert.match(css,/#toast\{top:calc\(max\(8px,env\(safe-area-inset-top\)\) \+ 56px\)!important;opacity:0/);assert.match(css,/\.lane-wait\{display:none!important\}/);
});

// UI review task 4: the place bar starts collapsed in every room (the tour opens it for its two steps inside it), the
// mic shows only when someone else is in voice or you talk, and jump only while walking the streets.
test('calm controls: rooms open with the place bar collapsed, tour opens it when needed, mic and jump only when useful',()=>{
 const world=r('public/world.js'),voice=r('public/voice.js'),css=r('public/r4.css');
 assert.match(world,/function buildRoom\(id\)\{[^]*?classList\.remove\('search-open','home-view','dock-open','dock-full'\)/);
 assert.doesNotMatch(world,/classList\.add\('dock-open'\)/);
 assert.match(voice,/classList\.toggle\('voice-useful',joining\|\|\(active&&!listening\)\|\|members\.some\(p=>p\.id!==me\)\)/);
 assert.match(css,/#quickVoice:not\(\.voice-useful\)\{display:none!important\}/);assert.match(css,/#worldUI:not\(\.tp-walking\) \.tp-jump\{display:none!important\}/);
 const t=harness({...fixture(),day:1,xp:0,visited:['university'],place:'university'}),c=t.context,on={};delete t.game.state.onboard;
 const mem=new Map([['chinalife-onboard','1']]);Object.assign(c,{matchMedia:()=>({matches:true}),requestAnimationFrame:f=>f(),MutationObserver:class{observe(){}},addEventListener:(k,f)=>{on[k]=f},
  localStorage:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)},ChinaLifeWhereTo:{show(){}},ChinaLifeOneCity:{walkCity:()=>false}});
 const ui=t.document.getElementById('worldUI');ui.classList.remove('dock-open');vm.runInContext(r('public/r3.js'),c);
 assert.equal(c.ChinaLifeOnboarding.step,'order');assert.ok(ui.classList.contains('dock-open'),'"Try an activity" opens the bar');
 ui.classList.remove('dock-open');on['chinalife:cloudready']();assert.ok(!ui.classList.contains('dock-open'),'only once: the player can close it again');
});
