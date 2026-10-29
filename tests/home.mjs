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
