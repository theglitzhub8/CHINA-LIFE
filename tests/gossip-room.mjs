// Gossip Room Phase 0 (docs/GOSSIP-ROOM-PLAN.md, switch gossip_room, default OFF): one screen for Hot Seat, the
// Gossip wall, Gossip TV and City news, opened from the tea table, the phone and the place bar.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
const r=f=>fs.readFileSync(f,'utf8');
const tick=()=>new Promise(res=>setImmediate(res));

function room(on,{place='gist',live=null}={}){
 const t=harness({...fixture(),place}),c=t.context,calls={open:0,select:[]};
 c.ChinaLifeFlags={cast:k=>k==='gossip_room'&&on,appOff:()=>false};
 c.ChinaLifeHotSeat={enabled:()=>true,peek:async()=>live,featured:()=>({body:'Tunde bought a car with his allowance'}),open(){calls.open++}};
 c.ChinaLifeAuth={request:async url=>{calls.news=url;return {data:{posts:[{title:'Library hours',body:'The library opens late this week.'},{title:'Club night',body:'Amapiano on Friday.'}]}}}};
 vm.runInContext(r('public/gossip-room.js'),c);return {t,c,calls};
}

test('the switch starts off on the server and in the game',()=>{
 assert.match(r('chinalife-api/hafrik-features.php'),/'real_sitting','gossip_room'\];\}/);
 assert.match(r('public/flags.js'),/gossip_room:false/);
});

test('switch off: the tea table opens the Gossip wall as before, and the phone keeps Hot Seat and Gossip TV',async()=>{
 const {t}=room(false);await t.game.gist();await tick();
 assert.equal(t.document.querySelector('#activityContent h2').textContent,'🤫 Gossip wall');
});

test('switch on: one Gossip Room screen with Hot Seat, the Gossip wall, Gossip TV and City news',async()=>{
 const {t,calls}=room(true,{live:{votes:3,secondsLeft:20,own:false,voted:false}});await t.game.gist();await tick();await tick();
 const d=t.document,text=d.getElementById('activityContent').textContent;
 assert.equal(d.querySelector('#activityContent h2').textContent,'🫖 Gossip Room');
 for(const s of ['🔥 Hot Seat','🤫 Gossip wall','📺 Gossip TV','📰 City news'])assert.ok(text.includes(s),s);
 assert.match(d.getElementById('grHot').textContent,/Live now: 3 votes · 20s left/);assert.equal(d.getElementById('grHotBtn').textContent,'Vote now');
 d.getElementById('grHotBtn').onclick();assert.equal(calls.open,1,'in the room, the button opens the Hot Seat');
 assert.match(d.getElementById('grTv').textContent,/Tunde bought a car/);
 assert.match(calls.news,/gist\.php\?city=/);assert.match(d.getElementById('grNews').textContent,/Library hours/);
 d.getElementById('grWall').onclick();await tick();assert.equal(d.querySelector('#activityContent h2').textContent,'🤫 Gossip wall','the wall is one tap away');
});

test('away from the room the Hot Seat button walks you there; with nobody on the seat it says Take the seat',async()=>{
 const away=room(true,{place:'football'});await away.t.game.gist();await tick();await tick();
 assert.equal(away.t.document.getElementById('grHotBtn').textContent,'Go to the Gossip Room');
 const idle=room(true);await idle.t.game.gist();await tick();await tick();
 assert.equal(idle.t.document.getElementById('grHotBtn').textContent,'Take the seat');assert.match(idle.t.document.getElementById('grHot').textContent,/Nobody is on the seat/);
});

test('phone: the Gossip tile is one app (the Gossip Room) while the switch is on; plain names everywhere',()=>{
 const g=r('public/game.js');
 assert.match(g,/\['gossip','Gossip','fire_3d\.png',\['gossiproom','hotseat','gossiptv'\]\]/);
 assert.match(g,/!\(\(k==='hotseat'\|\|k==='gossiptv'\)&&all\.gossiproom\)/);
 assert.match(g,/\.\.\.\(window\.ChinaLifeGossipRoom\?\.on\?\.\(\)\?\{gossiproom:\['🫖','Gossip Room'/);
 assert.match(r('public/flags.js'),/'football','gossiproom','hotseat'/);
 assert.match(r('public/world.js'),/if\(p\[0\]==='gist'&&window\.ChinaLifeGossipRoom\?\.on\?\.\(\)\)items\.unshift\(\['🫖 Gossip Room'/);
 assert.match(g,/hotseat:\['🔥','Hot Seat'/);assert.match(r('public/index.dev.html'),/<script src="hot-seat\.js"><\/script><script src="gossip-room\.js"><\/script>/);
});

test('when the Gossip Room is closed, the screen says when it opens and offers no trip; trips use Where to?',async()=>{
 const {t,c}=room(true,{place:'football'});c.ChinaLifeOneCity={PLACES:{gist:{hours:[8,24]}},isOpenAt:()=>false};
 await t.game.gist();await tick();await tick();
 assert.match(t.document.getElementById('grHot').textContent,/closed now\. It opens at 08:00/);assert.equal(t.document.getElementById('grHotBtn'),null);
 const g=r('public/game.js');assert.match(g,/\$\('hsGo'\)\.onclick=\(\)=>\{\$\('activityDialog'\)\.close\(\);window\.ChinaLifeWhereTo\?\.go\?window\.ChinaLifeWhereTo\.go\('gist'\)/);
 assert.match(r('public/gossip-room.js'),/window\.ChinaLifeWhereTo\.go\('gist'\)/);
});

test('in the room, the place bar leads with the Gossip Room and drops the duplicate Gossip card while the switch is on',()=>{
 assert.match(r('public/world.js'),/if\(p\[0\]==='gist'&&!window\.ChinaLifeGossipRoom\?\.on\?\.\(\)\)items\.unshift\(\['🤫 Gossip'/);
});
