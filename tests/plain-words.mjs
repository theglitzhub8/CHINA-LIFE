// UI review task 5 (docs/UI-UX-REVIEW.md): words a new player can read. Money is ¥, players never read "admin" or
// "NPC", scripted hosts never claim to be online, dates are readable and low needs say so in a word.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const r=f=>fs.readFileSync('public/'+f,'utf8');

test('money is ¥ (virtual yuan), never "Coins" or "game coins", and players are never told about "admin"',()=>{
 assert.match(r('game.js'),/><small>Money<\/small><b>¥/);assert.doesNotMatch(r('game.js'),/<small>Coins<\/small>/);
 assert.doesNotMatch(r('club.js'),/game coins/);
 for(const f of ['community-life.js','football.js','hot-seat.js'])assert.doesNotMatch(r(f),/(by admin|An admin will|an admin will|Admin will announce)/,f);
});

test('scripted characters: no " · NPC" suffix, and hosts never claim "● Online"',()=>{
 assert.match(r('r4.css'),/\.scene-label\.npc:after\{content:none!important\}/);
 assert.doesNotMatch(r('hosts.js'),/● Online/);
});

test('University card: readable dates, attendance only once classes start',()=>{
 const js=r('university.js'),day=new Function('return '+js.match(/const day=(d=>\{[^\n]*?\});/)[1])();
 assert.equal(day('2026-11-02'),'Mon 2 Nov');assert.equal(day('nonsense'),'nonsense');
 assert.match(js,/'Orientation week · classes start '\+day\(s\.start\)/);assert.match(js,/st\.orientation\?'':' · attendance '\+st\.attendance\+'\/100'/);
});

test('a low need says it in a word, and needs and XP are explained the first time',()=>{
 const world=r('world.js'),r4=r('r4.js');
 assert.match(world,/const low=\{hunger:'Hungry',energy:'Tired',fun:'Bored',social:'Lonely',hygiene:'Shower',bladder:'Toilet'\}/);
 assert.match(world,/\(v<25\?'<em aria-hidden="true">'\+low\[k\]\+'<\/em>':''\)/);
 assert.match(r4,/needs:'The bars under the top bar are your needs/);assert.match(r4,/xp:'XP comes from classes, work and going out/);
 assert.match(r4,/!seen\(\)\.includes\('needs'\)&&Object\.values\(st\.needs\|\|\{\}\)\.some\(v=>v<25\)/);
});

test('the card spot and banners sit below the needs strip, so a card never hides "Hungry"',()=>{
 assert.match(r('r4.css'),/#worldUI\.has-needs:not\(\.map-view\) \.lane-first\{top:calc\(max\(8px,env\(safe-area-inset-top\)\) \+ 96px\)!important\}/);
 assert.match(r('r3.js'),/r4-tip'\)\?70:30/,'one-time tips go before persistent info cards');
});
