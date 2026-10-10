import test from 'node:test';import assert from 'node:assert/strict';import {harness,fixture} from './game-harness.mjs';
test('reloads preserve the same day and daily reward; the day advances only at Beijing midnight',()=>{
 const h=harness({...fixture(),rankClaimed:6});h.game.claimDaily();const day=h.game.state.day,money=h.game.state.money,date=h.game.state.lastVisit;
 for(let i=0;i<3;i++){const reloaded=harness(JSON.parse(JSON.stringify(h.game.state)));assert.equal(reloaded.game.state.day,day);reloaded.game.claimDaily();assert.equal(reloaded.game.state.money,money);assert.equal(reloaded.game.state.lastVisit,date);}
 // The harness starts at 22:00 Beijing. UTC is still the previous calendar day at midnight in Beijing.
 h.passMinutes(119);assert.equal(h.game.state.day,day);h.passMinutes(1);assert.equal(h.game.state.day,day+1);h.game.claimDaily();assert.notEqual(h.game.state.lastVisit,date);const next=h.game.state.money;h.game.claimDaily();assert.equal(h.game.state.money,next);
});
