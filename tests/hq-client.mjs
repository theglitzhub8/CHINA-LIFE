import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {harness} from './game-harness.mjs';
test('HQ guests can visit named desks without presenting prepared answers as a live employee',async()=>{
 const h=harness();vm.runInContext(fs.readFileSync('public/hq-team.js','utf8'),h.context);vm.runInContext(fs.readFileSync('public/hq.js','utf8'),h.context);await h.context.ChinaLifeHQ.open();
 assert.equal(h.document.querySelectorAll('[id^="hqDesk-"]').length,4);h.click('hqDesk-lawrence');assert.match(h.document.getElementById('activityContent').textContent,/Prepared desk information/);assert.match(h.document.getElementById('activityContent').textContent,/not a live conversation/);
 h.context.ChinaLifeHQ.desk('ceo');assert(h.document.getElementById('hqAppointment'));assert(!h.document.getElementById('hqService-major-proposal'));assert(!h.document.getElementById('hqInbox'));
});
