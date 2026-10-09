import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// A stand-in for the browser's <audio>: records what the radio asks it to do.
function setup(place='home'){const t=harness({...fixture(),place}),c=t.context,players=[];
 c.Audio=class{constructor(){this.paused=true;this.volume=1;this.currentTime=0;this.dataset={};this.handlers={};this.src='';players.push(this)}addEventListener(k,f){(this.handlers[k]||=[]).push(f)}fire(k){(this.handlers[k]||[]).forEach(f=>f())}play(){this.paused=false;this.fire('playing');return Promise.resolve()}pause(){this.paused=true;this.fire('pause')}};
 c.ChinaLifeAuth={base:'https://hafrik.com/api/v4'};c.ChinaLifeCloud={songs:[{id:'a1a1a1a1a1a1a1a1',title:'Lagos Nights',artist:'Kola Beats',listing:'21',city:'Shenyang',duration:185,url:'https://hafrik.com/chinalife-music/a1.mp3',cover:''},{id:'b2b2b2b2b2b2b2b2',title:'Harbin Snow',artist:'Ice Queen',listing:'22',city:'Harbin',duration:200,url:'https://hafrik.com/chinalife-music/b2.mp3',cover:''}]};
 for(const d of t.document.querySelectorAll('dialog'))if(!d.showModal)d.showModal=function(){this.setAttribute('open','')};
 vm.runInContext('(()=>{'+fs.readFileSync('public/radio.js','utf8')+'})()',c);const sheet=t.document.getElementById('radioDialog');Object.defineProperty(sheet,'open',{get(){return this.hasAttribute('open')}});sheet.showModal=function(){this.setAttribute('open','')};sheet.close=function(){this.removeAttribute('open')};const radio=c.ChinaLifeRadio;return {...t,radio,audio:radio.audio}}
test('ChinaLife Radio plays approved artists one after another, loops, and lets players pick a song',async()=>{const t=setup();
 const fab=t.document.getElementById('radioFab');assert.equal(fab.hidden,false,'the radio button shows when there are songs');
 await t.radio.play();assert.equal(t.audio.src,'https://hafrik.com/chinalife-music/a1.mp3');assert.equal(t.radio.playing,true);assert.match(fab.textContent,/Lagos Nights · Kola Beats/);
 t.audio.fire('ended');await Promise.resolve();assert.equal(t.radio.current.title,'Harbin Snow','next song');t.audio.fire('ended');await Promise.resolve();assert.equal(t.radio.current.title,'Lagos Nights','loops round');
 fab.onclick();const sheet=t.document.getElementById('radioDialog');assert.match(sheet.textContent,/Playlist · 2 songs/);assert.match(sheet.textContent,/Harbin Snow/);
 sheet.querySelector('[data-play="1"]').onclick();await Promise.resolve();assert.equal(t.radio.current.title,'Harbin Snow');
 t.radio.pause();assert.equal(t.radio.playing,false);
});
test('the radio steps aside in clubs, comes back outside, and goes quiet while the mic is live',async()=>{const t=setup();await t.radio.play();const loud=t.audio.volume;
 t.context.dispatchEvent(new t.context.CustomEvent('chinalife:voice',{detail:{active:true}}));assert.ok(t.audio.volume<loud,'quieter while talking');t.context.dispatchEvent(new t.context.CustomEvent('chinalife:voice',{detail:{active:false}}));assert.equal(t.audio.volume,loud);
 t.game.state.place='night';t.context.dispatchEvent(new t.context.CustomEvent('chinalife:update'));assert.equal(t.audio.paused,true,'paused in the club');
 t.game.state.place='plaza';t.context.dispatchEvent(new t.context.CustomEvent('chinalife:update'));await Promise.resolve();assert.equal(t.audio.paused,false,'resumes outside');
});
test('with no approved songs the radio button stays hidden',()=>{const t=setup();t.context.ChinaLifeCloud.songs=[];t.context.dispatchEvent(new t.context.CustomEvent('chinalife:songs'));assert.equal(t.document.getElementById('radioFab').hidden,true)});
