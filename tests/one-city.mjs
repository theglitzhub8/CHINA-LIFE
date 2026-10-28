// One-city mode (docs/ONE-CITY.md): world layout setting, venue gating, save relocation and "Suggested for you".
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
const load=(extra={})=>{const ctx={console,localStorage:{getItem:()=>null},...extra};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/one-city.js','utf8'),ctx);return ctx};
const H=h=>h*60;

test('layout defaults to one city with the seven destinations and classic turns everything back on',()=>{
 const {ChinaLifeOneCity:o}=load();
 assert.equal(o.active(),true);assert.equal(o.layout.city,'China');
 assert.deepEqual([...o.layout.places],['night','gist','voting','football','hq','cityhospital','university']);
 assert.equal(o.whereTo(),true);assert.equal(o.flights(),false);
 assert.equal(o.allows('night'),true);assert.equal(o.allows('cafe'),false);assert.equal(o.allows('home'),true);assert.equal(o.allows('home-villa'),true);
 // Server JSON is snake_case; unknown venues are dropped.
 o.set({mode:'one-city',city:'China',places:['gist','casino'],where_to:false,flights:true});
 assert.deepEqual([...o.layout.places],['gist']);assert.equal(o.whereTo(),false);assert.equal(o.flights(),true);
 o.set({mode:'classic'});
 assert.equal(o.active(),false);assert.equal(o.allows('cafe'),true);assert.equal(o.whereTo(),false);assert.equal(o.flights(),true);
 o.set(null);assert.equal(o.active(),true);
});

test('opening hours follow game time, including the club past midnight',()=>{
 const {ChinaLifeOneCity:o}=load();
 assert.equal(o.isOpenAt('night',H(23)),true);assert.equal(o.isOpenAt('night',H(2)),true);assert.equal(o.isOpenAt('night',H(12)),false);
 assert.equal(o.isOpenAt('cityhospital',H(3)),true);assert.equal(o.isOpenAt('university',H(6)),false);assert.equal(o.isOpenAt('university',H(9)),true);
});

test('suggestions come from needs, time of day, friends and busy places',()=>{
 const {ChinaLifeOneCity:o}=load(),top=ctx=>o.suggest(ctx)[0]?.id;
 const ok={energy:80,hunger:80,hygiene:80,bladder:80,fun:80,social:80};
 assert.equal(top({minutes:H(13),needs:{...ok,energy:10}}),'cityhospital');
 assert.equal(top({minutes:H(23),needs:ok}),'night');
 assert.equal(top({minutes:H(9),needs:ok,student:true}),'university');
 assert.equal(top({minutes:H(17),needs:ok}),'football');
 assert.equal(top({minutes:H(13),needs:ok,friendsOnline:2}),'gist');
 assert.match(o.suggest({minutes:H(13),needs:ok,friendsOnline:2})[0].why,/2 friends are online/);
 assert.equal(top({minutes:H(13),needs:ok,electionOpen:true}),'voting');
 assert.ok(o.suggest({minutes:H(13),needs:ok,counts:{football:6}}).some(s=>s.id==='football'&&/6 people/.test(s.why)));
 assert.ok(o.suggest({minutes:H(4),needs:ok}).length>0,'always suggests something');
 assert.ok(o.suggest({minutes:H(23),needs:ok}).length<=3);
 // Closed places sink below open ones; venues switched off by admin are never suggested.
 assert.notEqual(top({minutes:H(12),needs:{...ok,fun:10}}),'night');
 o.set({mode:'one-city',places:['gist','hq']});
 assert.ok(o.suggest({minutes:H(23),needs:{...ok,energy:5}}).every(s=>['gist','hq'].includes(s.id)));
});

test('a save in a disabled city moves to the active city and keeps where it was',()=>{
 const {ChinaLifeOneCity:o}=load();
 const s={created:true,city:'Guangzhou',place:'canton'};
 assert.equal(o.relocate(s,['China']),true);
 assert.deepEqual(s,{created:true,city:'China',place:'home',cityBeforeOneCity:'Guangzhou',placeBeforeOneCity:'canton'});
 assert.equal(o.relocate(s,['China']),false,'no second move');
 s.city='Harbin';o.relocate(s,['China']);assert.equal(s.cityBeforeOneCity,'Guangzhou','first city is never overwritten');
 assert.equal(o.relocate({created:false,city:'Harbin'},['China']),false,'new players use onboarding');
 o.set({mode:'classic'});const c={created:true,city:'Harbin',place:'home'};assert.equal(o.relocate(c,['China']),false,'classic never moves anyone');
});

test('flags hide every venue outside the layout but keep homes and the player\'s own place',()=>{
 const ctx=load();ctx.ChinaLife={state:{place:'cafe',student:{campus:'liaoning'},job:null},isResidence:id=>id==='home',jobPlace:()=>null};
 vm.runInContext(fs.readFileSync('public/flags.js','utf8'),ctx);const f=ctx.ChinaLifeFlags;
 assert.equal(f.placeOff('night'),false);assert.equal(f.placeOff('market'),true);assert.equal(f.placeOff('home'),false);
 assert.equal(f.placeOff('cafe'),false,'the place the player stands in stays visible');assert.equal(f.placeOff('liaoning'),false,'own campus stays');
 ctx.ChinaLifeOneCity.set({mode:'classic'});assert.equal(f.placeOff('market'),false);
});

test('game load relocates a Guangzhou save to China non-destructively and validateSave keeps the old city',()=>{
 const h=harness({...fixture(),city:'Guangzhou',place:'home'},{openCities:['China'],scripts:['public/one-city.js']});
 assert.equal(h.game.state.city,'China');assert.equal(h.game.state.cityBeforeOneCity,'Guangzhou');
 const v=h.internal.validateSave({...fixture(),city:'China',cityBeforeOneCity:'Guangzhou',placeBeforeOneCity:'home'});
 assert.equal(v.cityBeforeOneCity,'Guangzhou');
});

test('flights are paused while one city is on and come back in classic mode',()=>{
 const h=harness({...fixture(),city:'China'},{openCities:['China'],scripts:['public/one-city.js']});
 h.internal.tripScreen();
 assert.match(h.document.body.textContent,/Travel between cities is paused/);
 h.context.ChinaLifeOneCity.set({mode:'classic'});assert.equal(h.context.ChinaLifeOneCity.flights(),true);
});

test('without one-city.js the game behaves exactly as before (classic)',()=>{
 const h=harness({...fixture(),city:'Guangzhou'},{openCities:['China','Guangzhou']});
 assert.equal(h.game.state.city,'Guangzhou');assert.equal(h.game.state.cityBeforeOneCity,undefined);
});

test('venue crowd density: 40% in one-city mode, full in classic, admin value and test override',()=>{
 const {ChinaLifeOneCity:o}=load();
 assert.equal(o.npcDensity(),0.4);
 o.set({mode:'one-city',npc_density:0.6});assert.equal(o.npcDensity(),0.6);
 o.set({mode:'one-city',npc_density:7});assert.equal(o.npcDensity(),1);
 o.set({mode:'one-city',npc_density:'x'});assert.equal(o.npcDensity(),0.4);
 o.set({mode:'classic'});assert.equal(o.npcDensity(),1);
 const {ChinaLifeOneCity:t}=load({localStorage:{getItem:k=>k==='chinalife-npc-density'?'0.25':null}});
 assert.equal(t.npcDensity(),0.25);
});

test('world.js scales venue crowds, caps hosts and keeps characters apart every frame',()=>{
 const w=fs.readFileSync('public/world.js','utf8');
 assert.match(w,/function separateCrowd\(dt\)/);assert.match(w,/separateCrowd\(dt\);/);
 assert.match(w,/placeHosts\(fxCtx\(\),id\)\}catch\(e\)\{console\.warn\('hosts',e\)\}trimCrowd\(\);/);
 assert.match(w,/const count=scaled\(/);assert.match(w,/function crowdReserved\(id\)/);
 // NPC definitions stay: every Hafrik host and AI character is still defined.
 assert.match(fs.readFileSync('public/hosts.js','utf8'),/id:'tunde'/);
});

test('other players are separated through a display offset, never by moving their synced position',()=>{
 const w=fs.readFileSync('public/world.js','utf8');
 // The lerp aims at target + offset; the push writes only the offset.
 assert.match(w,/const goal=r\.off\?remoteGoal\.copy\(r\.target\)\.add\(r\.off\):r\.target/);
 assert.match(w,/r\.body\.position\.lerp\(goal,k\)/);
 assert.doesNotMatch(w,/c\.r\.target\.x\+=/);
 // Every character in the room counts (scripted club people too), and each remote is listed once.
 assert.match(w,/for\(const a of root\.children\)addBody\(a\)/);
});

// UI review C3: suggestions are honest. Closed places only when nothing is open, "full" only with people there,
// and a new student is pointed to campus first.
test('suggestions never claim a crowd, skip closed places and send new students to campus',()=>{
 const {ChinaLifeOneCity:o}=load(),ok={energy:80,hunger:80,hygiene:80,bladder:80,fun:80,social:80};
 const club=ctx=>o.suggest(ctx).find(s=>s.id==='night');
 assert.doesNotMatch(club({minutes:H(23),needs:ok}).why,/full/);assert.match(club({minutes:H(23),needs:ok,counts:{night:5}}).why,/full|5 people/);
 assert.ok(o.suggest({minutes:H(12),needs:{...ok,fun:10}}).every(s=>s.open),'only open places when some are open');
 assert.equal(o.suggest({minutes:H(13),needs:ok,student:true,day:1})[0].id,'university');
 assert.notEqual(o.suggest({minutes:H(13),needs:ok,student:true,day:9})[0]?.id,'university');
 assert.ok(!o.suggest({minutes:H(13),needs:ok,student:true,day:1,here:'campus'}).some(s=>s.id==='university'),'never where you already are');
 assert.ok(o.suggest({minutes:H(3)+30,needs:ok,here:'night'}).length>0);
});
