import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// Event screens (docs/TODAY-PLAN.md Phase 4, switch event_screens, default ON).
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const now=1763150400;
const data=({hotLive=true,raceOpen=true}={})=>({now,city:'China',events:[
 {kind:'match',live:true,endsAt:now+3*3600,unit:'goals',top:[{name:'Ada',n:3,me:false},{name:'You',n:1,me:true}],me:{n:1,rank:2},challenge:{key:'goals',target:3,count:1,claimed:false},reward:{coins:300},cup:{name:'Winter Cup',startsAt:now+2*86400,running:false,prize:5000}},
 {kind:'election',live:raceOpen,endsAt:raceOpen?now+86400:null,office:raceOpen?'governor':null,unit:'votes',top:raceOpen?[{name:'Mei',n:4,me:false}]:[],me:{voted:0,races:raceOpen?1:0},reward:{coins:50,xp:10}},
 {kind:'hotseat',live:hotLive,startsAt:hotLive?now-600:now+5*3600,endsAt:hotLive?now+3000:now+7*3600,unit:'right calls',top:[],me:{n:0,rank:null},reward:{coins:20,per:'right call',max:10}}]});
function setup({flag=true,signed=true,d=data(),place='home'}={}){const t=harness({...fixture(),place,city:'China'}),c=t.context,calls=[];t.game.state.created=true;
 c.ChinaLifeFlags={cast:k=>k==='event_screens'?flag:undefined,off:()=>false};c.ChinaLifeCloud={signedIn:signed,open:()=>calls.push('login')};
 c.ChinaLifeAuth={request:async url=>{calls.push(url);return {data:d}}};
 const shown=[];t.game.showScreen=(title,sub,html)=>{shown.push(title);t.document.getElementById('activityContent').innerHTML=html};
 c.ChinaLifeWhereTo={go:id=>calls.push('go:'+id)};t.game.politics=()=>calls.push('politics');t.game.toast=()=>{};
 vm.runInContext(fs.readFileSync('public/event-screens.js','utf8'),c);return {t,c,doc:t.document,calls,shown,E:c.ChinaLifeEventScreens}}
test('Event screens: live events first, each with a countdown, the Top 3, your line, the reward and one Go',async()=>{
 const {doc,E,shown,calls}=setup();await E.open();await flush();
 assert.deepEqual(shown,['🏟 Events']);assert.match(calls[0],/event-screens\.php\?city=China/);
 const cards=[...doc.querySelectorAll('.ev-card')];assert.equal(JSON.stringify(cards.map(c=>c.dataset.ev)),JSON.stringify(['hotseat','election','match']));
 const [hs,el,m]=cards.map(c=>c.textContent);
 assert.match(hs,/LIVE/);assert.match(hs,/Live · ends in 50m/);assert.match(hs,/Not on the board yet/);assert.match(hs,/¥20 for each right call · up to 10 a day/);
 assert.match(el,/Election · Governor/);assert.match(el,/Voting closes in 1d 0h/);assert.match(el,/Mei4 votes/);assert.match(el,/You haven’t voted yet/);assert.match(el,/¥50 \+ 10 XP/);
 assert.match(m,/Ends in 3h 0m/);assert.match(m,/Score 3 goals \(1\/3\)/);assert.match(m,/Winter Cup · starts in 2d 0h · ¥5,000 prize/);assert.match(m,/You \(you\)1 goal/);assert.match(m,/#2 in the city/);
 assert.ok(cards[2].querySelector('li.me'),'your row stands out');
 assert.equal(doc.querySelectorAll('[data-go]').length,3);
});
test('Event screens: Go takes you to the pitch, the ballot and the Gossip Room',async()=>{
 const {doc,E,calls}=setup();await E.open('election');await flush();assert.ok(doc.querySelector('[data-ev="election"]').classList.contains('focus'));
 for(const k of ['match','election','hotseat']){await E.open();await flush();doc.querySelector('[data-go="'+k+'"]').onclick()}
 assert.equal(JSON.stringify(calls.filter(c=>!c.includes('.php'))),JSON.stringify(['go:football','politics','go:gist']));
});
test('Event screens: Hot Seat Hour later tonight shows when it starts; the Today panel line names what is on',async()=>{
 const {doc,E}=setup({d:data({hotLive:false,raceOpen:false})});await E.open();await flush();
 const cards=[...doc.querySelectorAll('.ev-card')];assert.equal(cards[0].dataset.ev,'match','only Match Day is live');
 const hs=doc.querySelector('[data-ev="hotseat"]').textContent;assert.match(hs,/Starts in 5h 0m/);assert.match(hs,/Go to the Gossip Room/);
 assert.match(doc.querySelector('[data-ev="election"]').textContent,/Nothing to vote on right now/);
 assert.equal(E.summary().hot,false);assert.match(E.summary().text,/^Match Day · Hot Seat at \d\d:\d\d$/);
 const live=setup();await live.E.load();assert.deepEqual(JSON.parse(JSON.stringify(live.E.summary())),{hot:true,text:'Hot Seat Hour is live'});
});
test('Event screens: signed out asks to log in; the switch off opens nothing',async()=>{
 const out=setup({signed:false});await out.E.open();await flush();assert.match(out.doc.getElementById('evBody').textContent,/Log in with Hafrik/);
 out.doc.getElementById('evLogin').onclick();assert.ok(out.calls.includes('login'));assert.equal(out.calls.some(c=>c.includes('.php')),false);
 const off=setup({flag:false});await off.E.open();assert.deepEqual(off.shown,[]);
});
