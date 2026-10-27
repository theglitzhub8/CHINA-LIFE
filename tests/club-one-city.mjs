// One-city Club (docs/ONE-CITY.md "Club"): configurable name without 007/Shenyang, Classic keeps 007, beat clock, shout-outs.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const load=()=>{const ctx={console,localStorage:{getItem:()=>null}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/one-city.js','utf8'),ctx);return ctx.ChinaLifeOneCity};

test('one-city club name is configurable and never says 007 or Shenyang; Classic keeps 007 Club',()=>{
 const o=load();
 assert.equal(o.clubName(),'Jollof & Neon');assert.equal(o.CLUB.classic,'007 Club');
 assert.doesNotMatch(o.clubName(),/007|Shenyang|Guangzhou/);
 assert.equal(o.brand('Welcome to 007, {n}! 🥂'),'Welcome to Jollof & Neon, {n}! 🥂');
 assert.equal(o.brand('Bored? 007 Club is open'),'Bored? Jollof & Neon is open');
 assert.equal(o.brand('I’m filming a “day in Shenyang” vlog.'),'I’m filming a “day in China” vlog.');
 o.set({mode:'one-city',club_name:'  Afro   Lounge China <b> '});assert.equal(o.clubName(),'Afro Lounge China b');
 o.set({mode:'one-city',club_name:''});assert.equal(o.clubName(),'Jollof & Neon');
 o.set({mode:'classic'});assert.equal(o.clubName(),'007 Club');assert.equal(o.brand('Welcome to 007'),'Welcome to 007');
});

test('club copy sources route through the brand helper',()=>{
 const src=f=>fs.readFileSync('public/'+f,'utf8');
 assert.match(src('club-host.js'),/neon\(clubSign/);assert.doesNotMatch(src('club-host.js'),/innerHTML='<b>007<\/b>'/);
 assert.match(src('game.js'),/p\[0\]==='night'&&window\.ChinaLifeOneCity\?\.active\(\)\)p\[1\]=window\.ChinaLifeOneCity\.clubName\(\)/);
 assert.match(src('game.js'),/function brandClub\(\)/);
 for(const f of ['hosts.js','r3.js','social.js','rooms.js','shared-activities.js'])assert.match(src(f),/ChinaLifeOneCity(\?)?\.brand/,f);
 // Classic dressing is kept (disabled in one city, not deleted).
 assert.match(src('world.js'),/S H E N Y A N G/);assert.match(src('catalog.js'),/"name": "007 Club"/);
});

test('beat clock follows the DJ when music plays and a silent tempo otherwise; shout-outs are presets only',async()=>{
 globalThis.window={};const m=await import('../public/club-life.js');
 assert.equal(Math.floor(m.beatPhase(120,60000)),120);
 window.ChinaLifeAudio={beatPhase:()=>7.5};assert.equal(m.beatPhase(120,0),7.5);
 window.ChinaLifeAudio={beatPhase:()=>null};assert.equal(m.beatPhase(60,3000),3);
 assert.ok(m.SHOUTS.length>=6&&m.SHOUTS.every(s=>s.length<=40&&!/007|Shenyang/.test(s)));
 assert.equal(m.shoutText('A'.repeat(30),'Big up'),'A'.repeat(18)+': Big up');
 assert.ok(m.SHOUT_COOLDOWN_MS>=10000);
 delete globalThis.window;
});

test('amapiano track exists and server validates club_name',()=>{
 assert.match(fs.readFileSync('public/catalog.js','utf8'),/id:'amapiano',name:'Jollof Log Drum',style:'Amapiano · 113 BPM',bpm:113/);
 const php=fs.readFileSync('chinalife-api/common.php','utf8');assert.match(php,/club_name/);assert.match(php,/mb_strlen\(\$c\)>24/);
});
