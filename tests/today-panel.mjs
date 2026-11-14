import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// Today panel (docs/TODAY-PLAN.md Phase 2, switch today_panel, default ON).
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function setup({flag=true,last}={}){const t=harness({...fixture(),place:'home',city:'China'}),c=t.context,calls=[];t.game.state.created=true;
 c.ChinaLifeFlags={cast:k=>k==='today_panel'?flag:undefined,off:()=>false};
 c.ChinaLifeToday={on:()=>true,last:last??{tasks:[{done:true},{done:false},{done:false}],bonus:{coins:300,claimed:false}},peek:async()=>c.ChinaLifeToday.last,open:()=>calls.push('three')};
 let playing=false;c.ChinaLifeMusic={get playing(){return playing},toggle:()=>{playing=!playing;calls.push('music')}};
 c.ChinaLifeSocial={open:tab=>calls.push('social:'+tab),friendsOnline:2};c.ChinaLifeMilestones={inbox:()=>calls.push('inbox')};
 t.game.wallet=()=>calls.push('wallet');
 vm.runInContext(fs.readFileSync('public/today-panel.js','utf8'),c);return {t,c,doc:t.document,calls,P:c.ChinaLifeTodayPanel}}
test('Today panel: a 🎯 pill in the clock chip shows today’s progress, and the clock opens the panel',async()=>{
 const {doc,P}=setup();P.pill();const pill=doc.getElementById('todayPill');assert.ok(pill,'pill added');
 assert.equal(pill.parentElement.className,'time-chip');assert.match(pill.textContent,/1\/3/);
 doc.getElementById('worldClock').dispatchEvent(new doc.defaultView.Event('click'));assert.ok(doc.getElementById('tdpCard'),'the clock opens it');
 P.close();assert.equal(doc.getElementById('tdpCard'),null);
});
test('Today panel: one list of rows, each opening the screen it names; music switches in place',async()=>{
 const {doc,P,calls}=setup();P.open();await flush();const card=doc.getElementById('tdpCard');
 const ids=[...card.querySelectorAll('[data-tdp]')].map(b=>b.dataset.tdp);
 assert.equal(JSON.stringify(ids),JSON.stringify(['three','rank','inbox','messages','people','needs','wallet','music','clean']));
 assert.match(card.textContent,/Today’s Three1 of 3 done · \+¥300 bonus/);assert.match(card.textContent,/2 friends online/);
 card.querySelector('[data-tdp="music"]').onclick();assert.ok(doc.getElementById('tdpCard'),'music keeps the panel open');
 card.querySelector('[data-tdp="messages"]').onclick();assert.equal(doc.getElementById('tdpCard'),null,'a row closes the panel');
 P.open();await flush();doc.querySelector('[data-tdp="wallet"]').onclick();P.open();await flush();doc.querySelector('[data-tdp="three"]').onclick();
 assert.equal(JSON.stringify(calls),JSON.stringify(['music','social:messages','wallet','three']));
});
test('Today panel: the switch off leaves the top bar exactly as it was',()=>{
 const {doc,P}=setup({flag:false});P.pill();P.open();assert.equal(doc.getElementById('todayPill'),null);assert.equal(doc.getElementById('tdpCard'),null);
});
test('Today panel: an 🏟 Events row names what is on and opens the event screen',async()=>{
 const t=harness({...fixture(),place:'home',city:'China'}),c=t.context,calls=[];t.game.state.created=true;
 c.ChinaLifeFlags={cast:()=>undefined,off:()=>false};c.ChinaLifeToday={on:()=>false};
 c.ChinaLifeEventScreens={on:()=>true,load:async()=>calls.push('load'),summary:()=>({hot:true,text:'Hot Seat Hour is live'}),open:()=>calls.push('events')};
 vm.runInContext(fs.readFileSync('public/today-panel.js','utf8'),c);const P=c.ChinaLifeTodayPanel;P.open();await flush();
 const r=t.document.querySelector('[data-tdp="events"]');assert.ok(r);assert.match(r.textContent,/EventsHot Seat Hour is live/);assert.ok(r.classList.contains('hot'));
 r.onclick();assert.deepEqual(calls,['load','events']);
});
