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

// Phase 5: chill and friends. Netflix gets a scene (sofa and TV, or the laptop at the desk); the host hears the doorbell.
test('chill at home: Netflix walks you to the sofa or desk, then laughs along; Netflix still works without a scene',()=>{
 const g=r('public/game.js');assert.match(g,/const s=window\.ChinaLifeHomeMoments\?\.chillSpot\?\.\(\);if\(s&&sceneAction\(\{\.\.\.s,label:'Watch Netflix',duration:10\},\$\('homeNetflix'\)\.onclick\)!==false\)return/);
 const t=harness({...fixture(),place:'home'}),s=t.game.state;s.needs.fun=30;s.needs.energy=80;const spots=[];t.context.ChinaLifeHomeMoments={chillSpot:()=>({kind:'type',x:-1.2,z:-3.6})};
 t.context.ChinaLifeWorld={perform:(spec,done)=>{spots.push(spec);done();return true}};assert.equal(t.game.homeAct('homeNetflix'),true);
 assert.equal(spots[0].label,'Watch Netflix');assert.equal(spots[0].kind,'type');assert.ok(s.needs.fun>30,'fun restored after the scene');
 const u=harness({...fixture(),place:'home'});u.game.state.needs.fun=30;u.game.state.needs.energy=80;u.context.ChinaLifeHomeMoments={chillSpot:()=>null};u.context.ChinaLifeWorld={perform:()=>{throw Error('no scene')}};
 u.game.homeAct('homeNetflix');assert.ok(u.game.state.needs.fun>30,'no spot: watched straight away');
 // home-moments.js: the laptop version at the desk (no sofa and TV in this home).
 const v=harness({...fixture(),place:'home'}),c=v.context,said=[],room=fakeRoom(),me=new room.root.constructor();c.requestAnimationFrame=f=>f(0);
 c.ChinaLifeWorld={say:(w,x)=>said.push(x),onFrame:()=>()=>{},body:me,fx:()=>room.ctx,homeSpot:k=>k==='desk'?{x:-1.2,z:-3.6}:null};c.ChinaLife.isResidence=p=>p==='home';c.ChinaLifeAudio={volume:0};
 vm.runInContext(r('public/home-moments.js'),c);v.timers.splice(0);assert.deepEqual(JSON.parse(JSON.stringify(c.ChinaLifeHomeMoments.chillSpot())),{kind:'type',x:-1.2,z:-3.6});
 const e=new c.Event('chinalife:perform');e.detail={state:'start',kind:'type',label:'Watch Netflix',place:'home',duration:3};c.dispatchEvent(e);assert.equal(e.detail.duration,10);
 assert.ok(room.root.children.some(o=>o.name==='home-moment'),'popcorn');for(const f of v.timers.splice(0))f();assert.ok(said.includes('😂😂😂'));assert.match(said[0],/Netflix time/);
 const end=new c.Event('chinalife:perform');end.detail={state:'end',kind:'type',label:'Watch Netflix',place:'home'};c.dispatchEvent(end);assert.ok(!room.root.children.some(o=>o.name==='home-moment'));assert.ok(said.includes('😌 Needed that'));
 const src=r('public/home-moments.js');assert.match(src,/findKind\(c,'sofa'\),tv=findKind\(c,'tv'\)/);assert.match(src,/me\.position\.y=ch\.h-\.42/);
});

test('friends: the host hears the doorbell when an invited friend accepts (once, and not for visits already on)',async()=>{
 const src=r('public/home-visits.js');assert.match(src,/v\.status==='accepted'&&!rung\.has\(v\.id\)/);assert.match(src,/new CustomEvent\('chinalife:guest-arrived',\{detail:\{name:v\.guest_name,place:v\.place\}\}\)/);
 const t=harness({...fixture(),place:'home'}),c=t.context,d=t.document,said=[];c.requestAnimationFrame=f=>f(0);
 c.ChinaLifeWorld={say:(w,x)=>said.push(x),onFrame:()=>()=>{}};c.ChinaLife.isResidence=p=>p==='home';c.ChinaLifeAudio={volume:0};vm.runInContext(r('public/home-moments.js'),c);t.timers.splice(0);
 const ring=[];c.addEventListener('chinalife:guest-arrived',e=>ring.push(e.detail.name));let visits=[{id:7,owner_id:1,guest_id:2,status:'accepted',guest_name:'Amaka',place:'home'}];
 c.ChinaLifeCloud={signedIn:true,playerId:1};c.ChinaLifeAuth={request:async()=>({data:{visits}})};c.setInterval=f=>{c.__poll=f};vm.runInContext(src,c);
 await c.__poll();assert.deepEqual(ring,[],'already on when the page loaded: quiet');
 visits=[...visits,{id:8,owner_id:1,guest_id:3,status:'pending',guest_name:'Chen',place:'home'}];await c.__poll();assert.deepEqual(ring,[]);
 visits[1]={...visits[1],status:'accepted'};await c.__poll();await c.__poll();assert.deepEqual(ring,['Chen'],'rings once');
 assert.match(d.querySelector('.hm-bell .hm-note').textContent,/Ding-dong! Chen is here/);for(const f of t.timers.splice(0))f();assert.ok(said.includes('👋 Come in, Chen!'));
});

// Phase 6: the video call home, study at the desk, the wardrobe.
test('video call family: from the bed, social up (less on a second call the same day), the call on screen',()=>{
 const t=harness({...fixture(),place:'home'}),s=t.game.state,specs=[];s.needs.social=20;s.student={...(s.student||{}),departure:'Lagos'};
 t.context.ChinaLifeWorld={homeSpot:k=>k==='bedside'?{x:-3.6,z:-.6}:null,perform:(spec,done)=>{specs.push(spec);done();return true}};
 assert.equal(t.game.homeAct('homeCall'),true);assert.deepEqual([specs[0].kind,specs[0].x,specs[0].z,specs[0].label,specs[0].duration],['phone',-3.6,-.6,'Video call family',12]);
 assert.equal(s.needs.social,50);assert.match(t.document.getElementById('toast').textContent,/family in Lagos/);t.game.homeAct('homeCall');assert.equal(s.needs.social,60,'second call the same day');
 assert.match(r('public/game.js'),/r\.familyCallDay=num\(v\.familyCallDay\?\?0,0,36500\)/);
 const {c,d}=home();c.ChinaLifeClubDock.home('more');assert.match(d.getElementById('activityContent').textContent,/Video call family/);
 // The call itself (home-moments.js).
 const v=harness({...fixture(),place:'home'}),x=v.context;x.requestAnimationFrame=()=>0;x.performance=performance;x.ChinaLifeWorld={say(){},onFrame:()=>()=>{}};x.ChinaLife.isResidence=p=>p==='home';x.ChinaLife.state.student={departure:'Lagos'};x.ChinaLifeAudio={volume:0};
 vm.runInContext(r('public/home-moments.js'),x);v.timers.splice(0);const e=new x.Event('chinalife:perform');e.detail={state:'start',kind:'phone',label:'Video call family',place:'home',duration:3};x.dispatchEvent(e);
 assert.equal(e.detail.duration,12);const el=v.document.querySelector('.hm-call');assert.match(el.textContent,/Family · Lagos/);v.timers.shift()();assert.match(el.querySelector('.hm-said').textContent,/We can see you/);
 v.timers.shift()();assert.ok(el.querySelector('.hm-said').classList.contains('me'),'your reply on the call');
 const end=new x.Event('chinalife:perform');end.detail={state:'end',kind:'phone',label:'Video call family',place:'home'};x.dispatchEvent(end);assert.ok(el.classList.contains('done'));
});

test('study at the desk and the wardrobe: walk to the real desk / wardrobe; a new look shows with a spin',()=>{
 assert.match(r('public/game.js'),/const d=window\.ChinaLifeWorld\.homeSpot\?\.\('desk'\);return sceneAction\(\{kind:'type',x:d\?\.x\?\?3,z:d\?\.z\?\?-0\.8/);
 assert.match(r('public/home-interiors.js'),/g\.userData\.homeWardrobe=1;return g\}/);assert.match(r('public/club-dock.js'),/wardrobe:\(\)=>window\.ChinaLifeHomeMoments\?\.wardrobe\?\.\(\)\|\|g\.store\?\.\(\)/);
 const t=harness({...fixture(),place:'home'}),c=t.context,said=[],room=fakeRoom(),me=new room.root.constructor(),hooks=new Set(),perf=[];me.position.set(0,0,0);
 c.requestAnimationFrame=f=>f(0);c.performance=performance;c.ChinaLifeWorld={say:(w,x)=>said.push(x),onFrame:f=>(hooks.add(f),()=>hooks.delete(f)),body:me,fx:()=>room.ctx,perform:(spec,done)=>{perf.push([spec,done]);return true},busy:false};
 c.ChinaLife.isResidence=p=>p==='home';c.ChinaLifeAudio={volume:0};const T=room.ctx.THREE;
 Object.assign(T,{PointLight:room.root.constructor,Vector3:class{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}},Quaternion:class{},Euler:class{setFromQuaternion(){this.y=Math.PI/2;return this}}});
 const wr=new room.root.constructor();wr.userData.homeWardrobe=1;wr.getWorldPosition=v=>Object.assign(v,{x:-6,y:0,z:.8});wr.getWorldQuaternion=q=>q;room.root.add(wr);
 vm.runInContext(r('public/home-moments.js'),c);t.timers.splice(0);let opened=0;c.ChinaLife.store=()=>opened++;c.ChinaLife.state.appearance={top:{s:'tee',c:1}};
 assert.equal(c.ChinaLifeHomeMoments.wardrobe(),true);assert.equal(perf[0][0].label,'Wardrobe');assert.equal(perf[0][0].x,-5,'room side of the wardrobe');
 perf[0][1]();assert.equal(opened,1,'outfit screen');assert.ok(Math.abs(me.rotation.y+Math.PI/2)<1e-9,'facing the wardrobe');
 c.ChinaLife.state.appearance={top:{s:'hoodie',c:2}};for(const f of t.intervals)f();for(const f of t.timers.splice(0))f();assert.ok(said.includes('✨ New look!'));assert.ok(hooks.size>0,'turns around');
 // Study: books, a lamp and thoughts at the desk.
 const e=new c.Event('chinalife:perform');e.detail={state:'start',kind:'type',label:'Study at your desk',place:'home',duration:3};c.dispatchEvent(e);assert.equal(e.detail.duration,8);
 assert.ok(room.root.children.some(o=>o.name==='home-moment'),'books and lamp');for(const f of t.timers.splice(0))f();assert.ok(said.includes('💡 Oh, I get it now!'));
 const end=new c.Event('chinalife:perform');end.detail={state:'end',kind:'type',label:'Study at your desk',place:'home'};c.dispatchEvent(end);assert.ok(said.includes('🎓 Brain: upgraded'));
});
