import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// Energy Phase 2 (switch music_everywhere, default ON): one round play / pause button in every place and at home.
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
// A stand-in Web Audio context: records oscillators and whether it is running.
function setup({place='football',songs=0,flag=true}={}){const t=harness({...fixture(),place}),c=t.context,radio={calls:[],playing:false,songs:[],current:null};
 t.game.state.created=true;const kept=new Map();c.localStorage={getItem:k=>kept.has(k)?kept.get(k):null,setItem:(k,v)=>kept.set(k,String(v)),removeItem:k=>kept.delete(k)};c.ChinaLifeFlags={cast:k=>k==='music_everywhere'?flag:false,appOff:()=>false};
 const node=()=>({connect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}});
 c.AudioContext=class{constructor(){this.state='suspended';this.currentTime=0;this.destination={}}resume(){this.state='running';return Promise.resolve()}suspend(){this.state='suspended';return Promise.resolve()}createOscillator(){return node()}createGain(){return node()}};
 for(let i=0;i<songs;i++)radio.songs.push({id:'s'+i,title:'Song '+i,artist:'Artist'});radio.current=radio.songs[0]||null;
 Object.assign(radio,{play(){radio.calls.push('play');radio.playing=true;return Promise.resolve()},pause(){radio.calls.push('pause');radio.playing=false},next(){radio.calls.push('next')},open(){radio.calls.push('open')}});c.ChinaLifeRadio=radio;
 vm.runInContext(fs.readFileSync('public/music-pill.js','utf8'),c);c.ChinaLifeMusic.sync();return {t,c,d:t.document,radio,m:c.ChinaLifeMusic}}
test('music everywhere: one button plays the game beats when no artist songs are approved, next moves on, a pause is remembered',async()=>{
 const {t,c,d,m}=setup();const pill=d.getElementById('musicPill');assert.ok(pill&&!pill.hidden,'the button shows in a place');assert.ok(d.body.classList.contains('music-pill-on'));
 d.querySelector('#musicPill .mp-btn').onclick({stopPropagation(){}});await flush();
 assert.equal(m.playing,true);assert.equal(m.beat,t.game.catalog.tracks[0].id,'the first beat');assert.equal(m.now.artist,'ChinaLife beats');
 assert.equal(d.querySelector('#musicPill .mp-btn').getAttribute('aria-label'),'Pause music');assert.equal(d.querySelector('#musicPill .mp-label').hidden,false,'the name slides out');
 m.next();assert.equal(m.beat,t.game.catalog.tracks[1].id,'next beat');
 m.toggle();assert.equal(m.playing,false);assert.equal(c.localStorage.getItem('chinalife-music-on'),'off','a player pause is remembered');
 m.showBeats();assert.match(d.getElementById('activityContent').textContent,/Hometown Lounge/);
});
test('music everywhere: with artist songs the button plays ChinaLife Radio; the club DJ takes over in a club and the beats come back after',async()=>{
 const s=setup({songs:2});await s.m.play();assert.deepEqual(s.radio.calls,['play']);assert.equal(s.m.playing,true);assert.equal(s.m.now.title,'Song 0');s.m.next();assert.ok(s.radio.calls.includes('next'));
 const b=setup();await b.m.play();assert.equal(b.m.playing,true);
 b.t.game.state.place=b.t.game.clubs[0];b.m.sync();assert.equal(b.d.getElementById('musicPill').hidden,true,'not in a club');assert.equal(b.m.playing,false,'the club DJ plays there');
 b.t.game.state.place='football';b.m.sync();await flush();assert.equal(b.m.playing,true,'back on after the club');
 const off=setup({flag:false});assert.ok(!off.d.getElementById('musicPill'),'switched off');
 const r=f=>fs.readFileSync(f,'utf8');assert.match(r('public/flags.js'),/music_everywhere:true/);assert.match(r('chinalife-api/hafrik-features.php'),/'music_everywhere'=>'Music everywhere/);
 assert.match(r('public/index.dev.html'),/src="radio\.js"><\/script><script type="module" src="music-pill\.js">/);
 assert.match(r('public/university.js'),/window\.ChinaLifeMusic\?\.pause\?\.\(false\)/,'quiet in the library');
});
