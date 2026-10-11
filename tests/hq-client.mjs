import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {harness} from './game-harness.mjs';
test('HQ guests can visit named desks without presenting prepared answers as a live employee',async()=>{
 const h=harness();vm.runInContext(fs.readFileSync('public/hq-team.js','utf8'),h.context);vm.runInContext(fs.readFileSync('public/hq.js','utf8'),h.context);await h.context.ChinaLifeHQ.open();
 assert.equal(h.document.querySelectorAll('[id^="hqDesk-"]').length,4);h.click('hqDesk-lawrence');assert.match(h.document.getElementById('activityContent').textContent,/Prepared desk information/);assert.match(h.document.getElementById('activityContent').textContent,/not a live conversation/);
 h.context.ChinaLifeHQ.desk('ceo');assert(h.document.getElementById('hqAppointment'));assert(!h.document.getElementById('hqService-major-proposal'));assert(!h.document.getElementById('hqInbox'));
});

test('HQ service entry uses the real Hafrik catalogue',()=>{const h=harness();let opened=0;h.context.ChinaLifeServices={open:()=>opened++};h.game.hq();assert.equal(opened,1);});

test('disabled Hafrik Services hides the reception and staff desk catalogue entries',async()=>{
 const h=harness();h.context.ChinaLifeHafrik={enabled:key=>key!=='services'};vm.runInContext(fs.readFileSync('public/hq-team.js','utf8'),h.context);vm.runInContext(fs.readFileSync('public/hq.js','utf8'),h.context);await h.context.ChinaLifeHQ.open();assert(h.document.getElementById('hqRealServices').hidden);h.context.ChinaLifeHQ.desk('lawrence');assert(h.document.getElementById('hqDeskServices').hidden);
});

test('HQ catalogue shortcut falls back to staff reception when Services is disabled',()=>{
 const h=harness();let catalogue=0,reception=0;h.context.ChinaLifeHafrik={enabled:()=>false};h.context.ChinaLifeServices={open:()=>catalogue++};h.context.ChinaLifeHQ={open:()=>reception++};h.game.hq();assert.equal(catalogue,0);assert.equal(reception,1);
});
