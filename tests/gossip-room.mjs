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
 assert.match(r('chinalife-api/hafrik-features.php'),/'real_sitting','gossip_room','gossip_show','gossip_wall'\];\}/);
 assert.match(r('public/flags.js'),/gossip_room:false,gossip_show:false,gossip_wall:false/);
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

// Phase 1 + 4 (switch gossip_show): Hot Seat Hour in the sheet and on the TV, the crowd reacts, the room fills up.
function hotSeat(show,round){
 const t=harness({...fixture(),place:'gist'}),c=t.context,posts=[];let reply={enabled:true,show,round,featured:null};
 c.queueMicrotask=queueMicrotask;c.ChinaLifeCloud={joined:true,signedIn:true,api:async(path,method,body)=>{if(method==='POST')posts.push(body);return {data:typeof reply==='function'?reply(body):reply}}};
 c.ChinaLifeFlags={cast:k=>k==='gossip_show'||k==='gossip_room',appOff:()=>false};
 vm.runInContext(r('public/hot-seat.js'),c);vm.runInContext(r('public/gossip-room.js'),c);return {t,c,posts,set:v=>{reply=v}};
}
const live={on:true,live:true,start:'20:00',end:'22:00',audience:7,queue:1,my_queue:null};
const voting={id:'5',body:'Someone at the club paid for everybody tonight',own:false,status:'voting',closes_in:30000,seconds:45,votes:2,my_vote:null};

test('Hot Seat Hour in the sheet: banner, host line and Join the queue; queuing posts the gist and says your place',async()=>{
 const {t,c,posts,set}=hotSeat(live,voting);c.ChinaLifeHotSeat.open();await tick();await tick();
 const d=t.document,body=d.querySelector('#hotSeatDialog .hs-body').textContent;
 assert.match(body,/🔴 Hot Seat Hour · until 22:00 · 7 in the room · 1 waiting/);assert.match(body,/🎙️ Host:/);
 d.getElementById('hsQueue').onclick();assert.ok(d.getElementById('hsText'),'the composer opens');assert.match(d.querySelector('.hs-note').textContent,/goes on the seat when it is your turn/);
 set({enabled:true,show:{...live,queue:2,my_queue:2},round:voting,featured:null,queued:true});
 d.getElementById('hsText').value='The football captain is learning Chinese in secret';d.getElementById('hsTake').onclick();await tick();await tick();
 assert.equal(posts[0].action,'take');assert.match(d.getElementById('toast').textContent,/#2 in the queue/);
 assert.match(d.querySelector('#hotSeatDialog .hs-body').textContent,/you are #2/);assert.equal(d.getElementById('hsQueue'),null,'no second place in the queue');
});

test('outside the Hour: the banner says when it runs and there is no queue button',async()=>{
 const {t,c}=hotSeat({...live,live:false,queue:0},voting);c.ChinaLifeHotSeat.open();await tick();await tick();
 assert.match(t.document.querySelector('#hotSeatDialog .hs-body').textContent,/Hot Seat Hour: every night 20:00–22:00/);assert.equal(t.document.getElementById('hsQueue'),null);
});

test('Gossip TV shows the live round; a reveal makes the room cheer (True) or laugh (Cap); the room fills up in the Hour',async()=>{
 const {t,c,set}=hotSeat(live,voting);c.ChinaLifeHotSeat.open();await tick();await tick();
 assert.equal(c.ChinaLifeHotSeat.liveTV().body,voting.body);
 const calls=[];const x={fillRect(){},set fillStyle(v){},set textAlign(v){},measureText:s=>({width:String(s).length*10}),fillText:s=>calls.push(s)};
 assert.equal(c.ChinaLifeHotSeat.paintLive(x,600,300,(_,s)=>calls.push(s)),true);assert.ok(calls.some(s=>/LIVE · HOT SEAT HOUR/.test(s)));
 const label=t.document.createElement('div');label.className='scene-label';Object.defineProperty(label,'offsetParent',{get:()=>t.document.body});t.document.getElementById('worldUI').appendChild(label);
 let heard=null;c.addEventListener('chinalife:hotseat-reveal',e=>heard=e.detail.result);
 set({enabled:true,show:live,round:{...voting,status:'revealed',true:5,cap:1,result:'true',reward:0},featured:null});await c.ChinaLifeHotSeat.peek();await tick();await tick();
 assert.equal(heard,'true');const burst=[...t.document.querySelectorAll('#worldUI .gr-react')].map(e=>e.textContent);assert.ok(burst.length>=10&&burst.every(e=>['👏','🎉','🙌','🔥'].includes(e)),'the crowd cheers');
 c.ChinaLifeGossipRoom.react('cap');assert.ok([...t.document.querySelectorAll('#worldUI .gr-react')].some(e=>['😂','🧢','🙄','😅'].includes(e.textContent)),'and laughs at a Cap');
 c.localStorage={getItem:()=>null,setItem(){},removeItem(){}};vm.runInContext(r('public/one-city.js'),c);assert.equal(c.ChinaLifeOneCity.npcDensity(),1,'full crowd in the Gossip Room during the Hour');
 t.game.state.place='night';assert.ok(c.ChinaLifeOneCity.npcDensity()<1,'other places keep the one-city crowd');
});

test('one reminder a night when Hot Seat Hour starts, and none at other times',async()=>{
 const at=(minutes)=>{const t=harness({...fixture(),place:'football'},{clockMinutes:minutes}),c=t.context,notes=[],mem=new Map();
  c.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem(){}};
  c.ChinaLifeCloud={joined:true,signedIn:true,api:async()=>({data:{enabled:true,show:live,round:null}})};c.queueMicrotask=queueMicrotask;
  c.ChinaLifeFlags={cast:k=>k==='gossip_show'||k==='gossip_room',appOff:()=>false};
  vm.runInContext(r('public/hot-seat.js'),c);vm.runInContext(r('public/gossip-room.js'),c);t.game.notify=(text)=>notes.push(text);return {c,notes}};
 const eight=at(-120);eight.c.ChinaLifeGossipRoom.remind();eight.c.ChinaLifeGossipRoom.remind();
 assert.equal(eight.notes.length,1,'once a night');assert.match(eight.notes[0],/Hot Seat Hour is on in the Gossip Room until 22:00/);
 const late=at(0);late.c.ChinaLifeGossipRoom.remind();assert.equal(late.notes.length,0,'not at 22:00');
});

test('Hot Seat stays offline (simulated voters) unless Hot Seat Hour is on, then it uses the signed-in request',()=>{
 const t=harness({...fixture(),place:'gist'}),c=t.context,urls=[];c.queueMicrotask=queueMicrotask;
 c.ChinaLifeCloud={joined:true,signedIn:true};c.ChinaLifeAuth={request:async u=>{urls.push(u);return {data:{enabled:true,round:null}}}};
 let on=false;c.ChinaLifeFlags={cast:k=>k==='gossip_show'&&on,appOff:()=>false};vm.runInContext(r('public/hot-seat.js'),c);
 c.ChinaLifeHotSeat.peek();assert.equal(urls.length,0,'switch off: no server calls (as before)');
 on=true;c.ChinaLifeHotSeat.peek();assert.match(urls[0]||'',/\/chinalife\/hot-seat\.php/,'switch on: talks to the server');
});

// Phase 2 (switch gossip_wall): the wall gets the full reaction row, replies, its place tag, Gist of the day on top,
// and place chips that filter it. Off: the wall is exactly as before.
function wall(on,posts){
 const t=harness({...fixture(),place:'gist'}),c=t.context,sent=[];
 c.ChinaLifeFlags={cast:k=>k==='gossip_wall'&&on,appOff:()=>false};
 c.ChinaLifeAuth={request:async(path,method,body)=>{if(method==='POST')sent.push(body);return {data:{admin:false,posts}}}};
 vm.runInContext(r('public/gossip-wall.js'),c);return {t,c,sent};
}
const tips=[
 {id:'1',official:true,tag:'Hafrik',own:false,body:'Welcome to the wall',at:Date.now(),reactions:{like:0,fire:0,laugh:0},mine:null},
 {id:'2',official:false,own:false,body:'Big news from #campus today',at:Date.now(),reactions:{like:0,fire:1,laugh:0,shock:0,eyes:0,cap:0},mine:null,place:'campus',replies:[],reply_count:0},
 {id:'3',official:false,own:false,body:'Who danced on the table at the #club?',at:Date.now(),reactions:{like:1,fire:2,laugh:3,shock:1,eyes:0,cap:2},mine:'cap',place:'club',top:true,reply_count:5,
  replies:[{id:'9',body:'It was the DJ',op:false,own:true},{id:'10',body:'I was there',op:true,own:false},{id:'11',body:'No way',op:false,own:false}]}];

test('Gossip wall with the switch on: six reactions, replies, place tags, Gist of the day first, and place chips',async()=>{
 const {t,sent}=wall(true,tips);await t.game.gistNight();await tick();const d=t.document,cards=[...d.querySelectorAll('#gistNightFeed article.gossip-card')];
 assert.match(cards[1].textContent,/🏆 Gist of the day/,'the top tip comes right after the pinned Hafrik post');assert.match(cards[1].textContent,/#club/);
 const reacts=[...cards[1].querySelectorAll('[data-gw-react]')].map(b=>b.textContent.trim());assert.deepEqual(reacts,['😂 3','🔥 2','🫢 1','👀 0','🧢 2','❤️ 1']);
 assert.ok(cards[1].querySelector('[data-kind="cap"]').className.includes('mine'));
 assert.match(cards[1].querySelector('.gw-replies').textContent,/💬 5 replies.*2 earlier.*You It was the DJ.*Tipster I was there.*Anonymous No way/s);
 cards[1].querySelector('[data-kind="shock"]').onclick();assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))),{city:t.game.state.city,action:'react',id:3,kind:'shock'});
 const f=cards[1].querySelector('[data-gw-form]');f.querySelector('input').value='Too funny';f.onsubmit({preventDefault(){}});assert.equal(sent.at(-1).action,'reply');assert.equal(sent.at(-1).body,'Too funny');
 d.querySelector('[data-gw-chip="campus"]').onclick();
 const shown=[...d.querySelectorAll('#gistNightFeed article.gossip-card')].filter(c=>!c.hidden).map(c=>c.dataset.place||'pinned');assert.deepEqual(shown,['pinned','campus'],'the campus chip keeps pinned posts and #campus tips');
});

test('Gossip wall with the switch off: no new reactions, replies or chips',async()=>{
 const {t}=wall(false,tips);await t.game.gistNight();await tick();const d=t.document;
 assert.equal(d.querySelector('[data-gw-react]'),null);assert.equal(d.querySelector('.gw-replies'),null);assert.equal(d.querySelector('.gw-chips'),null);
 assert.equal(d.querySelectorAll('#gistNightFeed [data-react]').length,9,'the old three reactions on each of the three posts');
});
