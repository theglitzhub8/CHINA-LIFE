// Link Up (one-city People tab, docs/LINK-UP.md): name, tabs, legacy Nearby switch, Places rows, Happening now, profile record.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
const src=f=>fs.readFileSync('public/'+f,'utf8');
// A client with one-city.js (or without it, for Classic) and stubbed cloud/auth: no server needed.
async function client({card=false,oneCity=true,joined=true,signedIn=true,players=[],friends=[],football=null,hot=null,profile=null,flags=''}={}){
 const t=harness({...fixture(),name:'me',city:'China',place:'gist',hour:20*60}),c=t.context,store=new Map([['chinalife-flags-on',flags]]);
 c.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};c.URLSearchParams=URLSearchParams;
 if(oneCity)vm.runInContext(src('one-city.js'),c);
 c.ChinaLifeCloud={signedIn,joined,players:players.filter(p=>p.place==='gist'),cityPlayers:players,ready:Promise.resolve(),join:async()=>true,leave:async()=>{},open(){}};
 const calls=[];c.ChinaLifeAuth={request:async(path)=>{calls.push(path);if(path.includes('/social.php'))return {friends,blocked:[]};if(path.includes('/profile.php'))return {profile};if(path.includes('/messages.php'))return {messages:[]};return {}}};
 c.ChinaLifeFootball={summary:async()=>football};c.ChinaLifeHotSeat={peek:async()=>hot,open(){}};
 const travels=[];c.ChinaLifeWhereTo={go:id=>travels.push(id)};
 if(card)vm.runInContext(src('profile-v6.js'),c);
 await vm.runInContext('(async()=>{'+src('social.js')+'})()',c);
 const S=c.ChinaLifeSocial,doc=t.document,body=()=>doc.getElementById('socialBody'),tabs=()=>[...doc.querySelectorAll('#socialTabs [data-view]')].map(b=>b.dataset.view);
 return {t,c,S,doc,body,tabs,calls,travels,store,async press(action,peer){const sel='[data-social="'+action+'"]'+(peer!=null?'[data-peer="'+peer+'"]':''),b=doc.querySelector(sel);assert.ok(b,'Control '+sel);await b.onclick()},settle:()=>new Promise(r=>setTimeout(r,0))};
}
const P=(id,place,extra={})=>({id,name:id[0].toUpperCase()+id.slice(1),color:'#1f8e93',city:'China',place,...extra});

test('one-city: the tab is called Link Up with Places, Chats and Friends; venue chat and Nearby are not tabs',async()=>{
 const u=await client({players:[P('ada','gist')]});
 assert.equal(u.S.tabName,'Link Up');
 assert.match(u.doc.getElementById('navPeople').textContent,/Link Up/);assert.equal(u.doc.getElementById('navPeople').getAttribute('aria-label'),'Link Up');
 await u.S.open('people');
 assert.equal(u.S.view,'places');assert.deepEqual(u.tabs(),['places','messages','friends']);
 assert.equal(u.doc.getElementById('socialTitle').textContent,'Link Up');
 assert.equal(u.body().querySelector('.ppl-map,.ppl-filters,[data-social="ppl-filter"]'),null,'old Nearby screen is hidden');
 assert.doesNotMatch(u.body().textContent,/Simulated city characters/);
});

test('classic layout keeps People with Nearby, Chats, Friends and Venue exactly as before',async()=>{
 const u=await client({oneCity:false});
 assert.equal(u.S.tabName,'People');assert.match(u.doc.getElementById('navPeople').textContent,/People/);
 assert.equal(u.S.legacyNearby,true);
 await u.S.open('people');assert.equal(u.S.view,'people');
 assert.deepEqual(u.tabs(),['people','messages','friends','venue']);
});

test('admin switch legacy_people_nearby brings the old Nearby screen back, and the test flag does too',async()=>{
 const u=await client();
 assert.equal(u.S.legacyNearby,false);
 u.c.dispatchEvent(new (u.c.CustomEvent||CustomEvent)('chinalife:hafrik-features',{detail:{legacy_people_nearby:true}}));
 assert.equal(u.S.legacyNearby,true);await u.S.open('people');assert.equal(u.S.view,'people');assert.ok(u.tabs().includes('people'));assert.match(u.body().textContent,/Simulated city characters/,'old Nearby screen is kept, not deleted');
 u.c.dispatchEvent(new (u.c.CustomEvent||CustomEvent)('chinalife:hafrik-features',{detail:{legacy_people_nearby:false}}));
 assert.equal(u.S.legacyNearby,false);
 const f=await client({flags:'something,legacy_people_nearby'});assert.equal(f.S.legacyNearby,true);
});

test('Places lists the seven venues with live player counts, You are here, closed hours and Join/Go via Where to?',async()=>{
 const u=await client({players:[P('ada','gist'),P('bayo','gist'),P('chen','football'),P('dami','football'),P('efe','football'),P('fang','private-home')]});
 await u.S.open('places');
 const rows=[...u.body().querySelectorAll('.lu-place')];assert.equal(rows.length,7);
 const row=id=>u.body().querySelector('.lu-place-main[data-peer="'+id+'"]').closest('.lu-place');
 assert.match(row('gist').textContent,/You’re here.*2 others here/);assert.ok(row('gist').querySelector('[data-social="venue-chat"]'),'venue chat sits on your own place');
 assert.match(row('football').textContent,/3 players here/);assert.match(row('football').querySelector('[data-social="lu-go"]').textContent,/Join/);
 assert.match(row('cityhospital').textContent,/Quiet now/);
 assert.match(row('voting').textContent,/Closed · 08:00–20:00/);assert.ok(row('voting').querySelector('button[disabled]'));
 assert.doesNotMatch(u.body().textContent,/Fang/,'players at home are not listed at a place');
 await u.press('lu-go','football');assert.deepEqual(u.travels,['football']);
});

test('tapping a place shows who is there with friends marked',async()=>{
 const u=await client({players:[P('ada','football'),P('bayo','football')],friends:[{...P('ada','football'),status:'accepted',online:true}]});
 await u.S.open('places');await u.settle();await u.press('lu-place','football');
 assert.equal(u.S.view,'place');
 const t=u.body().textContent;assert.match(t,/Ada/);assert.match(t,/Bayo/);assert.match(t,/Friend/);
 assert.ok(u.body().querySelector('[data-social="lu-go"][data-peer="football"]'));
});

test('Happening now shows open matches, tournaments, the live hot seat and friends online, and hides when empty',async()=>{
 const empty=await client();await empty.S.open('places');await empty.S.loadHappening(true);
 assert.doesNotMatch(empty.body().textContent,/Happening now|Friends online/);
 const u=await client({friends:[{...P('dami','football'),status:'accepted',online:true},{...P('kemi',''),status:'accepted',online:false}],
  football:{enabled:true,online:true,lobbies:[{id:'L1',size:3,humans:4}],tournaments:[{id:'T1',name:'Friday Cup',size:3,teams:2,max:8,status:'registering',startsAt:null}]},
  hot:{id:'G1',votes:6,secondsLeft:74,own:false,voted:false,local:false}});
 await u.S.open('places');await u.S.refresh?.();await u.S.loadHappening(true);await u.settle();
 const t=u.body().textContent;
 assert.match(t,/Happening now/);assert.match(t,/hot seat/i);assert.match(t,/6 votes/);assert.match(t,/Friday Cup/);assert.match(t,/2 spots|waiting/);
 assert.ok(u.body().querySelector('[data-social="lu-hotseat"]'));assert.ok(u.body().querySelector('[data-social="lu-match"]'));assert.ok(u.body().querySelector('[data-social="lu-tournament"]'));
 assert.equal(u.S.happening.hot.votes,6);
});

test('profiles show the football record and hot seat calls when the API sends them, and nothing otherwise',async()=>{
 const pp={id:'ada',name:'Ada',color:'#1f8e93',online:true,badges:[],homes:[],football:{played:14,won:9,titles:1},hotSeat:{calls:23,right:17}};
 const u=await client({players:[P('ada','football')],profile:pp});await u.S.player('ada');await u.settle();
 const t=u.body().textContent;assert.match(t,/14\s*played/);assert.match(t,/9\s*won/);assert.match(t,/1 title/);assert.match(t,/17\s*of 23 hot seat calls right/);
 for(const a of ['request','go-player','report-player','block'])assert.ok(u.body().querySelector('[data-social="'+a+'"]'),'profile keeps '+a);
 const v=await client({players:[P('ada','football')],profile:{...pp,football:undefined,hotSeat:undefined}});await v.S.player('ada');await v.settle();
 assert.doesNotMatch(v.body().textContent,/hot seat calls|played ·/);
});

test('guests see the Places list with a Hafrik log in prompt',async()=>{
 const u=await client({signedIn:false,joined:false});await u.S.open('places');
 assert.equal(u.body().querySelectorAll('.lu-place').length,7);assert.ok(u.body().querySelector('[data-social="hafrik-login"]'));
});

test('football and hot seat expose read-only summaries for Link Up; Where to? exposes go',()=>{
 const f=src('football.js'),h=src('hot-seat.js'),w=src('where-to.js');
 assert.match(f,/summary/);assert.match(f,/joinLobby/);assert.match(f,/openTournament/);
 assert.match(h,/peek/);assert.match(w,/ChinaLifeWhereTo\s*=\s*\{[^}]*\bgo\b/);
});

test('the admin Features list carries legacy_people_nearby, off by default; profile.php adds the record without gist authorship',()=>{
 const php=fs.readFileSync('chinalife-api/hafrik-features.php','utf8');
 assert.match(php,/'legacy_people_nearby'=>/);assert.match(php,/cl_hafrik_features_default_off\(\): array \{return \['legacy_people_nearby'[,\]]/);assert.ok(!/default_off[^\n]*club_hypeman/.test(php),'Hypeman starts on');
 const prof=fs.readFileSync('chinalife-api/profile.php','utf8');
 assert.match(prof,/'football'=>/);assert.match(prof,/'hotSeat'=>/);assert.match(prof,/chinalife_hot_seat_votes/);assert.doesNotMatch(prof,/author_id/);
 assert.match(src('index.dev.html'),/link-up\.css/);assert.match(src('index.dev.html'),/<\/svg><\/span>Link Up<\/button>/);
});

test('polished profile: record sits under the stats row inside the card, the name is light, and Wave is not repeated in one-city',async()=>{
 const pp={id:'ada',name:'Ada',color:'#1f8e93',city:'China',online:true,badges:[],homes:[],stats:{},football:{played:14,won:9,titles:1},hotSeat:{calls:23,right:17}};
 const u=await client({card:true,players:[P('ada','gist')],profile:pp});await u.S.player('ada');await u.settle();
 const html=u.body().innerHTML;assert.ok(u.body().querySelector('.pv6 .lu-record'),'record inside the card');
 assert.ok(html.indexOf('lu-record')>html.indexOf('pv6-stats')&&html.indexOf('lu-record')<html.indexOf('Recent activity'),'record right after the stats row');
 assert.equal(u.body().querySelectorAll('[data-social="wave"]').length,1,'one Wave in one-city');
 assert.equal(u.body().querySelector('[data-social="go-player"]'),null,'no Go there when they are at your place');
 assert.match(src('link-up.css'),/\.pv6-head \.pv6-id h3[^{]*\{color:#F7FFF7/);
 const c=await client({card:true,oneCity:false,players:[P('ada','gist')],profile:pp});await c.S.player('ada');await c.settle();
 assert.equal(c.body().querySelectorAll('[data-social="wave"]').length,2,'Classic keeps its Wave in Do something together');
});
