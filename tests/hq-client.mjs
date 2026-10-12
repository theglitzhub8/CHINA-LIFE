import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {harness} from './game-harness.mjs';
test('HQ guests can visit named desks without presenting prepared answers as a live employee',async()=>{
 const h=harness();vm.runInContext(fs.readFileSync('public/hq-team.js','utf8'),h.context);vm.runInContext(fs.readFileSync('public/hq.js','utf8'),h.context);await h.context.ChinaLifeHQ.open();
 assert.equal(h.document.querySelectorAll('[id^="hqDesk-"]').length,4);h.click('hqDesk-lawrence');assert.match(h.document.getElementById('activityContent').textContent,/Prepared desk information/);assert.match(h.document.getElementById('activityContent').textContent,/not a live conversation/);
 h.context.ChinaLifeHQ.desk('ceo');assert(h.document.getElementById('hqAppointment'));assert(!h.document.getElementById('hqService-major-proposal'));assert(!h.document.getElementById('hqInbox'));
});

test('HQ entry opens staff reception',()=>{const h=harness();let opened=0;h.context.ChinaLifeHQ={open:()=>opened++};h.game.hq();assert.equal(opened,1);});

test('disabled Hafrik Services hides only the CEO catalogue and preserves staff services',async()=>{
 const h=harness();h.context.ChinaLifeHafrik={enabled:key=>key!=='services'};vm.runInContext(fs.readFileSync('public/hq-team.js','utf8'),h.context);vm.runInContext(fs.readFileSync('public/hq.js','utf8'),h.context);await h.context.ChinaLifeHQ.open();assert.equal(h.document.getElementById('hqRealServices'),null);h.context.ChinaLifeHQ.desk('lawrence');assert.equal(h.document.getElementById('hqDeskServices'),null);assert(h.document.getElementById('hqService-study'));h.context.ChinaLifeHQ.desk('ceo');assert(h.document.getElementById('hqDeskServices').hidden);
});

test('HQ catalogue shortcut falls back to staff reception when Services is disabled',()=>{
 const h=harness();let catalogue=0,reception=0;h.context.ChinaLifeHafrik={enabled:()=>false};h.context.ChinaLifeServices={open:()=>catalogue++};h.context.ChinaLifeHQ={open:()=>reception++};h.game.hq();assert.equal(catalogue,0);assert.equal(reception,1);
});

test('staff desks submit their assigned services while only the CEO opens the catalogue',async()=>{const h=harness();h.context.ChinaLifeCloud={signedIn:true};h.context.ChinaLifeAuth={request:async path=>path.includes('applications')?{services:{study:{title:'Study support',answer:'University guidance',owner:'lawrence'}},applications:[]}:{ceoAccess:false}};let opened=0;h.context.ChinaLifeServices={open:()=>opened++};vm.runInContext(fs.readFileSync('public/hq-team.js','utf8'),h.context);vm.runInContext(fs.readFileSync('public/hq.js','utf8'),h.context);await h.context.ChinaLifeHQ.open('lawrence');assert.equal(h.document.getElementById('hqDeskServices'),null);h.click('hqService-study');assert(h.document.getElementById('hqRequest'));assert.match(h.document.getElementById('activityContent').textContent,/University guidance/);h.context.ChinaLifeHQ.desk('ceo');h.click('hqDeskServices');assert.equal(opened,1);assert(h.document.getElementById('hqAppointment'));});
