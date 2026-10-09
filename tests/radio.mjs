import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// A stand-in for the browser's <audio>: records what the radio asks it to do.
function setup(place='home'){const t=harness({...fixture(),place}),c=t.context,players=[];
 c.Audio=class{constructor(){this.paused=true;this.volume=1;this.currentTime=0;this.dataset={};this.handlers={};this.src='';players.push(this)}addEventListener(k,f){(this.handlers[k]||=[]).push(f)}fire(k){(this.handlers[k]||[]).forEach(f=>f())}play(){this.paused=false;this.fire('playing');return Promise.resolve()}pause(){this.paused=true;this.fire('pause')}};
 c.ChinaLifeAuth={base:'https://hafrik.com/api/v4'};c.ChinaLifeCloud={songs:[{id:'a1a1a1a1a1a1a1a1',title:'Lagos Nights',artist:'Kola Beats',listing:'21',city:'Shenyang',duration:185,url:'https://hafrik.com/chinalife-music/a1.mp3',cover:''},{id:'b2b2b2b2b2b2b2b2',title:'Harbin Snow',artist:'Ice Queen',listing:'22',city:'Harbin',duration:200,url:'https://hafrik.com/chinalife-music/b2.mp3',cover:''}]};
 for(const d of t.document.querySelectorAll('dialog'))if(!d.showModal)d.showModal=function(){this.setAttribute('open','')};
 vm.runInContext('(()=>{'+fs.readFileSync('public/radio.js','utf8')+'})()',c);const sheet=t.document.getElementById('radioDialog');Object.defineProperty(sheet,'open',{get(){return this.hasAttribute('open')}});sheet.showModal=function(){this.setAttribute('open','')};sheet.close=function(){this.removeAttribute('open')};const radio=c.ChinaLifeRadio;return {...t,radio,audio:radio.audio}}
test('ChinaLife Radio plays approved artists one after another, loops, and lets players pick a song',async()=>{const t=setup();
 const fab=t.document.getElementById('radioFab');assert.equal(fab.hidden,false,'the radio button shows when there are songs');
 await t.radio.play();assert.equal(t.audio.src,'https://hafrik.com/chinalife-music/a1.mp3');assert.equal(t.radio.playing,true);assert.match(fab.textContent,/Lagos Nights/);assert.match(fab.textContent,/Kola Beats/);
 t.audio.fire('ended');await Promise.resolve();assert.equal(t.radio.current.title,'Harbin Snow','next song');t.audio.fire('ended');await Promise.resolve();assert.equal(t.radio.current.title,'Lagos Nights','loops round');
 fab.onclick({target:fab});const sheet=t.document.getElementById('radioDialog');assert.match(sheet.textContent,/Up next/);assert.match(sheet.textContent,/Harbin Snow/,'up next shows the next song');sheet.querySelector('[data-tab="all"]').onclick();assert.match(sheet.textContent,/All songs · 2/);
 sheet.querySelector('[data-play="1"]').onclick();await Promise.resolve();assert.equal(t.radio.current.title,'Harbin Snow');
 t.radio.pause();assert.equal(t.radio.playing,false);
});
test('the radio keeps playing in clubs and on the map, starts on the first tap, and goes quiet while the mic is live',async()=>{const t=setup();let radioState=null;t.context.addEventListener('chinalife:radio',e=>{radioState=e.detail.playing});
 t.document.dispatchEvent(new t.context.Event('pointerdown'));await Promise.resolve();assert.equal(t.radio.playing,true,'first tap starts the radio');assert.equal(radioState,true,'club music is told to step aside');const loud=t.audio.volume;
 t.context.dispatchEvent(new t.context.CustomEvent('chinalife:voice',{detail:{active:true}}));assert.ok(t.audio.volume<loud,'quieter while talking');t.context.dispatchEvent(new t.context.CustomEvent('chinalife:voice',{detail:{active:false}}));assert.equal(t.audio.volume,loud);
 t.game.state.place='night';t.context.dispatchEvent(new t.context.CustomEvent('chinalife:update'));assert.equal(t.audio.paused,false,'still playing in the club');
 t.game.state.place='plaza';t.context.dispatchEvent(new t.context.CustomEvent('chinalife:update'));assert.equal(t.audio.paused,false,'and outside');
 t.radio.pause();assert.equal(radioState,false,'club music comes back when the radio is paused');
});
test('the full player searches songs, filters by artist and shuffles',async()=>{const t=setup();await t.radio.play();const fab=t.document.getElementById('radioFab');fab.onclick({target:fab});const sheet=t.document.getElementById('radioDialog');
 sheet.querySelector('[data-tab="artists"]').onclick();assert.equal(sheet.querySelectorAll('[data-artist]').length,2);sheet.querySelector('[data-artist="Ice Queen"]').onclick();assert.match(sheet.textContent,/Harbin Snow/);assert.doesNotMatch(sheet.querySelector('.radio-list').textContent,/Lagos Nights/);
 sheet.querySelector('[data-clear]').onclick();const q=sheet.querySelector('.radio-search input');q.value='lagos';q.oninput({target:q});assert.match(sheet.querySelector('.radio-list').textContent,/Lagos Nights/);assert.doesNotMatch(sheet.querySelector('.radio-list').textContent,/Harbin/);
 sheet.querySelector('[data-r="shuffle"]').onclick();assert.equal(sheet.querySelector('[data-r="shuffle"]').getAttribute('aria-pressed'),'true');sheet.querySelector('[data-r="next"]').onclick();await Promise.resolve();assert.equal(t.radio.current.title,'Harbin Snow','with two songs, shuffle still moves to the other one');
 fab.querySelector('.radio-mini').onclick=null;fab.onclick({target:fab.querySelector('.radio-mini'),stopPropagation(){}});assert.equal(t.radio.playing,false,'the mini player pauses');
});
test('with no approved songs the radio button stays hidden',()=>{const t=setup();t.context.ChinaLifeCloud.songs=[];t.context.dispatchEvent(new t.context.CustomEvent('chinalife:songs'));assert.equal(t.document.getElementById('radioFab').hidden,true)});
