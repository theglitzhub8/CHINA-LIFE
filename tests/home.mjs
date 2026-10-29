// Home experience (docs/HOME-PLAN.md). Phase 1: the home dock, one button per need with a bar, More, and game.js homeAct
// (run a home action without the "At home" sheet, and without it popping back up afterwards).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
const r=f=>fs.readFileSync(f,'utf8');

function home(flag=true,needs={}){const t=harness({...fixture(),place:'home'}),c=t.context,d=t.document,calls=[];
 c.ChinaLifeFlags={cast:k=>k==='home_dock'?flag:false,appOff:()=>false};Object.assign(t.game.state.needs,needs);
 t.game.homeAct=id=>{calls.push(id);return true};vm.runInContext(r('public/club-dock.js'),c);c.ChinaLifeClubDock.sync();return {t,c,d,calls}}

test('home dock: seven buttons at home, a bar per need (low ones flagged), each runs its home action',()=>{
 const {c,d,calls}=home(true,{energy:70,hunger:20,hygiene:55,bladder:90,fun:40,social:10});const dock=d.getElementById('homeDock');
 assert.ok(dock&&!dock.hidden);assert.ok(d.body.classList.contains('home-docked')&&d.body.classList.contains('place-docked'));
 assert.deepEqual([...dock.querySelectorAll('[data-hd-k]')].map(b=>b.dataset.hdK),['sleep','shower','toilet','eat','chill','friends','more']);
 const bar=k=>dock.querySelector('[data-hd-k="'+k+'"]');assert.equal(bar('sleep').querySelector('.cd-bar i').style.width,'70%');
 assert.ok(bar('eat').classList.contains('low'),'hunger 20% is low');assert.ok(bar('friends').classList.contains('low'));assert.ok(!bar('toilet').classList.contains('low'));
 for(const k of ['sleep','shower','toilet','chill','friends'])bar(k).onclick({stopPropagation(){}});
 assert.deepEqual(calls,['homeRest','homeShower','homeToilet','homeNetflix','homeInvitations']);
 c.ChinaLifeClubDock.home('eat');assert.match(d.getElementById('activityContent').textContent,/Instant noodles/);assert.match(d.getElementById('activityContent').textContent,/Order food/);
 c.ChinaLifeClubDock.home('more');const more=d.getElementById('activityContent').textContent;for(const t of ['Take a nap','Wardrobe','Study at the desk','Furniture & home shop','Home routine','My homes'])assert.match(more,new RegExp(t));
});

test('home dock: hidden when switched off, away from home or visiting someone else\'s home',()=>{
 const off=home(false);assert.ok(!off.d.getElementById('homeDock'));
 const {t,c,d}=home();t.game.state.place='night';c.ChinaLifeClubDock.sync();assert.equal(d.getElementById('homeDock').hidden,true);
 t.game.state.place='home';c.ChinaLifeHomeVisits={current:{id:1}};c.ChinaLifeClubDock.sync();assert.equal(d.getElementById('homeDock').hidden,true,'a guest has no home dock');
 assert.match(r('public/flags.js'),/home_dock:true/);assert.match(r('chinalife-api/hafrik-features.php'),/'home_dock'=>'Home: one row of buttons/);
 assert.match(r('public/club-dock.js'),/body\.home-docked #worldUI #infoPanel\{display:none!important\}/);
});

test('homeAct runs a home action without the At home sheet, and the sheet still opens normally afterwards',()=>{
 const t=harness({...fixture(),place:'home'});const s=t.game.state,d=t.document;s.needs.fun=30;s.needs.energy=80;
 assert.equal(t.game.homeAct('homeNetflix'),true);assert.ok(s.needs.fun>30,'Netflix restored fun');
 assert.ok(!d.getElementById('activityDialog').open||!/At home/.test(d.querySelector('#activityContent h2')?.textContent||''),'no At home sheet afterwards');
 t.game.home();assert.match(d.querySelector('#activityContent h2').textContent,/At home/,'opening the sheet yourself still works');
 s.place='night';assert.equal(t.game.homeAct('homeNetflix'),undefined);assert.match(d.getElementById('toast').textContent,/Go home first/);
});

// Owner saw the club menu at home: after visiting the club, the hidden club dock still showed because the dock style set
// display:flex over the hidden attribute. A hidden dock now always stays hidden.
test('after the club, home shows the home dock only (a hidden dock never shows)',()=>{
 const {t,c,d}=home();c.ChinaLifeFlags.cast=k=>k==='home_dock'||k==='club_dock';const ui=d.getElementById('worldUI'),hud=d.createElement('div');hud.className='club-hud';
 t.game.state.place='night';ui.append(hud);c.ChinaLifeClubDock.sync();assert.equal(d.getElementById('clubDock').hidden,false);assert.equal(d.getElementById('homeDock').hidden,true);
 hud.remove();t.game.state.place='home';c.ChinaLifeClubDock.sync();assert.equal(d.getElementById('clubDock').hidden,true);assert.equal(d.getElementById('homeDock').hidden,false);
 assert.match(r('public/club-dock.js'),/html:root body #worldUI \.club-dock\[hidden\]\{display:none!important\}/);
});

// Phase 2: sleep where night falls (home-moments.js). Only what you see changes; game.js sleep keeps its time and energy.
test('sleep at home: night falls over the room with a counter of the hours slept, then morning and a stretch',()=>{
 const src=r('public/home-moments.js'),w=r('public/world.js');
 assert.match(w,/onFrame:f=>\(frameHooks\.add\(f\),\(\)=>frameHooks\.delete\(f\)\)/);assert.match(w,/get body\(\)\{return player\}/);assert.match(w,/for\(const f of frameHooks\)try\{f\(time,dt\)\}/);
 assert.match(r('public/index.dev.html'),/<script src="home-moments\.js"><\/script>/);
 assert.match(src,/d\.duration=nap\?5\.5:8/);assert.match(src,/nightFall\(nap\?180:480/);
 const t=harness({...fixture(),place:'home'}),c=t.context,d=t.document,said=[];c.performance=performance;c.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),5);
 let vp=d.getElementById('worldViewport');if(!vp){vp=d.createElement('div');vp.id='worldViewport';d.body.append(vp)}c.ChinaLifeWorld={say:(who,s)=>said.push(s),onFrame:()=>()=>{}};c.ChinaLife.isResidence=p=>p==='home';
 vm.runInContext(src,c);const fire=detail=>{const e=new c.Event('chinalife:perform');e.detail=detail;c.dispatchEvent(e);return detail};
 const start=fire({state:'start',kind:'sleep',label:'Proper sleep',place:'home',duration:3});assert.equal(start.duration,8);
 const el=vp.querySelector('.hm-night');assert.ok(el,'night veil');assert.equal(el.querySelectorAll('.hm-star').length,18);assert.match(el.textContent,/of sleep/);assert.deepEqual(said,['💤 Goodnight…']);
 fire({state:'end',kind:'sleep',label:'Proper sleep',place:'home'});assert.ok(el.classList.contains('dawn'));
 for(const f of t.timers.splice(0))f();assert.ok(said.includes('☀️ Good morning!'));
 const nap=fire({state:'start',kind:'sleep',label:'Take a nap',place:'home',duration:3});assert.equal(nap.duration,5.5);
 const away=fire({state:'start',kind:'sleep',label:'Proper sleep',place:'night',duration:3});assert.equal(away.duration,3,'not at home: untouched');
});

// Phase 3: shower and toilet (the 'wash' activity at home). The body goes out of sight under a veil; world.js shows it again.
test('shower and toilet at home: a frosted shower with humming, or the door and a flush, then fresh with the need filled',()=>{
 const src=r('public/home-moments.js');assert.match(src,/d\.duration=loo\?5:7/);assert.match(r('public/game.js'),/kind:'wash',x:4,z:3,label:'Use the toilet'/);assert.match(r('public/game.js'),/kind:'wash',x:4,z:3,label:'Freshen up'/);
 const t=harness({...fixture(),place:'home'}),c=t.context,d=t.document,said=[],body={visible:true};c.requestAnimationFrame=f=>f(0);
 c.ChinaLifeWorld={say:(who,s)=>said.push(s),onFrame:()=>()=>{},body};c.ChinaLife.isResidence=p=>p==='home';c.ChinaLifeAudio={volume:0};
 vm.runInContext(src,c);t.timers.splice(0);const vp=d.getElementById('worldViewport')||d.body,fire=detail=>{const e=new c.Event('chinalife:perform');e.detail=detail;c.dispatchEvent(e);return detail};
 assert.equal(fire({state:'start',kind:'wash',label:'Freshen up',place:'home',duration:3}).duration,7);
 let el=vp.querySelector('.hm-shower');assert.ok(el,'shower veil');assert.equal(body.visible,false,'never the body');assert.equal(el.querySelectorAll('.hm-drop').length,34);assert.ok(el.querySelector('.hm-steam'));
 t.timers.shift()();assert.match(el.querySelector('.hm-hum').textContent,/La la la/);t.timers.splice(0);
 fire({state:'end',kind:'wash',label:'Freshen up',place:'home'});assert.ok(el.classList.contains('done'));assert.match(el.querySelector('.hm-note').textContent,/Hygiene 100%/);
 for(const f of t.timers.splice(0))f();assert.ok(said.includes('✨ So fresh!'));
 body.visible=true;t.timers.splice(0);assert.equal(fire({state:'start',kind:'wash',label:'Use the toilet',place:'home',duration:3}).duration,5);
 el=vp.querySelector('.hm-loo');assert.ok(el,'toilet veil');assert.match(el.textContent,/15 minutes later/);assert.equal(body.visible,false);
 t.timers.shift()();assert.ok(el.classList.contains('flushed'),'flush');
 fire({state:'end',kind:'wash',label:'Use the toilet',place:'home'});assert.match(el.querySelector('.hm-note').textContent,/Bladder 100%/);for(const f of t.timers.splice(0))f();assert.ok(said.includes('😮‍💨 Much better'));
 assert.equal(fire({state:'start',kind:'wash',label:'Freshen up',place:'gym',duration:3}).duration,3,'not at home: untouched');
});

// Phase 4: eat. A pot on the stove while cooking, then a little table to eat at; collecting a delivery brings the rider.
function fakeRoom(){class O{constructor(){this.children=[];this.parent=null;this.position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})}};this.rotation={y:0};this.scale={x:1,setScalar(v){this.x=v}};this.userData={};this.visible=true;this.material={};this.geometry={dispose(){}}}
 add(...k){for(const o of k){o.parent=this;this.children.push(o)}return this}removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(o=>o!==this);this.parent=null}}traverse(f){f(this);for(const o of this.children)o.traverse(f)}}
 const root=new O(),actors=[],obstacles=[{x:.6,z:-3.1,w:1.95,d:1}],mk=(x,y,z,p)=>{const m=new O();m.position.set(x,y,z);(p||root).add(m);return m};
 const THREE={Group:O,Mesh:O,SphereGeometry:O,BoxGeometry:O,MeshBasicMaterial:O,MeshStandardMaterial:O};
 return {root,actors,ctx:{THREE,root,obstacles:()=>obstacles,cylinder:(r,h,c,x,y,z,p)=>mk(x,y,z,p),box:(w,h,d,c,x,y,z,p)=>mk(x,y,z,p),moveTo(x,z,ry){me.position.x=x;me.position.z=z;me.rotation.y=ry},
  person:(x,z,shirt,skin,name,id,look)=>{const b=mk(x,0,z);b.userData.name=name;b.userData.look=look;return b},addActor:b=>actors.push(b),removeActor:b=>{actors.splice(actors.indexOf(b),1);b.removeFromParent()},labelFor:()=>null},me:null}}
test('eat at home: a pot on the stove, then sit at a little table; a delivery brings the rider in from the door',()=>{
 const src=r('public/home-moments.js'),w=r('public/world.js');assert.match(w,/fx:\(\)=>view==='venue'\?fxCtx\(\):null,homeSpot:k=>view==='venue'\?homeSpots\[k\]\|\|null:null/);
 const t=harness({...fixture(),place:'home'}),c=t.context,said=[],room=fakeRoom(),me=new room.root.constructor();room.me=me;me.position.set(.6,0,-2.3);
 const ctx=room.ctx;ctx.moveTo=(x,z,ry)=>{me.position.x=x;me.position.z=z;me.rotation.y=ry};const performs=[],hooks=new Set();
 c.ChinaLifeWorld={say:(who,s)=>said.push(s),onFrame:f=>(hooks.add(f),()=>hooks.delete(f)),body:me,fx:()=>ctx,homeSpot:k=>k==='door'?{x:3,z:2.8}:null,perform:(spec,done)=>{performs.push(spec);return true},busy:false};
 c.ChinaLife.isResidence=p=>p==='home';c.ChinaLifeAudio={volume:0};c.requestAnimationFrame=f=>f(0);vm.runInContext(src,c);t.timers.splice(0);
 const fire=detail=>{const e=new c.Event('chinalife:perform');e.detail=detail;c.dispatchEvent(e);return detail},moment=()=>room.root.children.find(o=>o.name==='home-moment');
 assert.equal(fire({state:'start',kind:'cook',label:'🍜 Cook instant noodles',place:'home',duration:3}).duration,9);
 assert.ok(moment()?.children.length>=4,'pot, lid and flame on the stove');assert.ok(Math.abs(me.rotation.y-Math.PI)<.01,'facing the stove');assert.match(said[0],/Cooking instant noodles/);
 for(const f of hooks)f(1000,16);assert.ok(Math.abs(me.rotation.y-Math.PI)<.2,'stays facing the pot through the pose');
 fire({state:'end',kind:'cook',label:'🍜 Cook instant noodles',place:'home'});assert.ok(!moment(),'pot cleared');assert.ok(said.includes('🍜 Ready!'));
 for(const f of t.timers.splice(0))f();assert.equal(performs[0].kind,'eat');assert.match(performs[0].label,/Eating instant noodles/);assert.equal(performs[0].duration,6);
 assert.equal(fire({state:'start',kind:'eat',label:performs[0].label,place:'home',duration:3}).duration,6);assert.ok(moment(),'table, stool and bowl');
 fire({state:'end',kind:'eat',label:performs[0].label,place:'home'});assert.ok(!moment());assert.ok(said.includes('😌 That hit the spot'));
 // Delivery: only an order seen on its way sends the rider.
 c.ChinaLife.state.foodOrders=[{id:'old',item:'🍕 Pizza',received:true},{id:'o1',item:'🍛 Jollof rice',received:false}];for(const f of t.intervals)f();
 c.ChinaLife.state.foodOrders[1].received=true;t.timers.splice(0);c.dispatchEvent(new c.Event('chinalife:delivery'));for(const f of t.timers.splice(0))f();
 const rider=room.actors[0];assert.ok(rider,'the rider walks in');assert.equal(rider.userData.name,'🛵 Delivery!');assert.equal(rider.userData.look.top.c,0xffc400);assert.equal(rider.userData.mode,'serve');
 assert.deepEqual([rider.position.x,rider.position.z],[3,2.8],'from the door');rider.userData.onArrive();performs.length=0;
 for(const f of t.timers.splice(0))f();for(const f of t.timers.splice(0))f();assert.ok(said.includes('🙏 Thank you!'));assert.match(performs[0]?.label||'',/Eating Jollof rice/);
 rider.userData.path=[];rider.userData.onArrive();assert.equal(room.actors.length,0,'he leaves');
 c.dispatchEvent(new c.Event('chinalife:delivery'));for(const f of t.timers.splice(0))f();assert.equal(room.actors.length,0,'an old order never sends a rider');
});
