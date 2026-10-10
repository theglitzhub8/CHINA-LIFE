import {connectClient} from './hafrik-worker-harness.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';import {backend} from './api-harness.mjs';
async function setup(){const server=backend(),t=harness({...fixture(),name:'alice',place:'night'}),c=t.context;let created=0,notes=0,now=Date.now();c.Date=class extends Date{static now(){return now}};class AudioContext{constructor(){created++;this.state='suspended';this.destination={}}get currentTime(){return now/1000}async resume(){this.state='running'}async suspend(){this.state='suspended'}createGain(){return {gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}createOscillator(){return {frequency:{value:0},connect(){},start(){notes++},stop(){}}}}c.AudioContext=AudioContext;c.fetch=(path,options)=>server.call('alice',path,options.method,options.body?JSON.parse(options.body):undefined);await connectClient(t,server,'alice');await vm.runInContext('(async()=>{'+fs.readFileSync('public/audio.js','utf8')+'})()',c);return {...t,server,advanceAudio(){for(let i=0;i<10;i++){now+=100;t.intervals.at(-2)()}},get created(){return created},get notes(){return notes}}}
test('club sound is opt-in, synthesizes notes, pauses and stops outside the venue',async()=>{const t=await setup();t.context.ChinaLifeAudio.open();assert.equal(t.created,0);await t.context.ChinaLifeAudio.start();assert.equal(t.created,1);t.advanceAudio();assert.ok(t.notes>0);assert.equal(t.context.ChinaLifeAudio.playing,true);t.context.ChinaLifeAudio.stop();assert.equal(t.context.ChinaLifeAudio.playing,false);await t.context.ChinaLifeAudio.start();t.game.state.place='church';t.internal.render();assert.equal(t.context.ChinaLifeAudio.playing,false);assert.equal(t.document.getElementById('audioDialog').open,false)});
test('DJ request enters the shared queue without automatically playing sound',async()=>{const t=await setup();t.context.ChinaLifeAudio.open();await t.document.querySelector('[data-track="neon"]').onclick();assert.equal(t.created,0);assert.equal(t.server.sqlite.prepare('SELECT track FROM club_music_requests').get().track,'neon');assert.match(t.document.getElementById('djQueue').textContent,/Neon After Hours/)});


test('first club tap starts music and explicit mute survives leaving and returning',async()=>{
 const t=await setup();t.document.dispatchEvent(new t.context.Event('pointerdown'));await new Promise(resolve=>setImmediate(resolve));assert.equal(t.context.ChinaLifeAudio.playing,true);
 t.context.ChinaLifeAudio.stop();t.game.state.place='home';t.internal.render();t.game.state.place='night';t.internal.render();t.document.dispatchEvent(new t.context.Event('pointerdown'));await new Promise(resolve=>setImmediate(resolve));assert.equal(t.context.ChinaLifeAudio.playing,false);
});


test('a pending audio resume cannot start club music after leaving the club',async()=>{
 const t=await setup();let resume;t.context.AudioContext.prototype.resume=function(){return new Promise(resolve=>resume=()=>{this.state='running';resolve()})};
 const starting=t.context.ChinaLifeAudio.start();t.game.state.place='home';t.internal.render();resume();await starting;assert.equal(t.context.ChinaLifeAudio.playing,false);
});

test('club music is loudest at the DJ booth, fades by the door and on the map, and its volume is remembered',async()=>{
 const t=await setup(),a=t.context.ChinaLifeAudio,stored=new Map();t.context.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
 t.context.ChinaLifeWorld={view:'venue',position:{x:0,z:-3}};const booth=a.nearness;
 t.context.ChinaLifeWorld.position={x:5,z:4};const door=a.nearness;t.context.ChinaLifeWorld.view='map';const map=a.nearness;
 assert.equal(booth,1);assert.ok(door<booth&&door>=.35,'door '+door);assert.equal(map,.2);
 a.setVolume(.75);assert.equal(a.volume,.75);assert.equal(stored.get('chinalife-music-volume'),'0.75');a.setVolume(3);assert.equal(a.volume,1);
});

test('club quick play switches away from radio, minimizes without pausing, and hides after leaving',async()=>{
 const t=await setup(),a=t.context.ChinaLifeAudio;let paused=0,wall;
 t.context.ChinaLifeWorld={updateClubMusic:info=>wall=info};t.context.ChinaLifeRadio={current:{title:'Artist track',artist:'Singer',cover:'cover-id'},pause(){paused++;t.context.dispatchEvent(new t.context.CustomEvent('chinalife:radio',{detail:{playing:false}}))}};
 t.context.dispatchEvent(new t.context.CustomEvent('chinalife:radio',{detail:{playing:true}}));assert.equal(wall.title,'Artist track');assert.match(wall.cover,/media.php/);
 const button=t.document.getElementById('clubMusicToggle');assert.equal(button.hidden,false);await button.onclick();assert.equal(paused,1);assert.equal(a.playing,true);assert.equal(button.getAttribute('aria-label'),'Pause club music');assert.equal(wall.source,'Club DJ');
 a.open();t.document.getElementById('closeAudio').onclick();assert.equal(a.playing,true,'minimize does not stop playback');await button.onclick();assert.equal(a.playing,false);
 t.game.state.place='home';t.internal.render();assert.equal(button.hidden,true);
});
