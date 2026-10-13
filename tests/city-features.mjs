import test from 'node:test';import assert from 'node:assert/strict';import {harness,fixture} from './game-harness.mjs';

test('Gist Night renders the anonymous handle, reactions and poll choices',async()=>{
 const h=harness();const posts=[{id:'4',handle:'night-abc123',body:'The square is glowing.',reactions:{like:1,fire:0,laugh:2},mine:null,poll:{id:'9',question:'Stay out?',voted:null,options:[{text:'Yes',votes:3},{text:'No',votes:1}]}}];
 h.context.ChinaLifeAuth={request:async(path)=>{if(String(path).includes('gist-night'))return {data:{posts}};return {data:{posts:[]}}}};
 await h.game.gistNight();
 const feed=h.document.getElementById('gistNightFeed');
 assert.match(feed.textContent,/night-abc123/);assert.match(feed.textContent,/The square is glowing/);assert.match(feed.textContent,/Stay out/);assert.match(feed.textContent,/Yes · 3/);
 assert.equal(feed.textContent.includes('user'),false);
});

test('City Hall lists a live tally and a vote for an open office',async()=>{
 const h=harness();let sent=null;
 h.context.ChinaLifeAuth={request:async(path,method,body)=>{sent={path,method,body};return {data:{elections:[{id:'3',office:'governor',open:true,mine:null,candidates:[{id:'8',name:'Ada',votes:2}]}]}}}};
 await h.game.politics();
 assert.match(h.document.getElementById('politicsResults').textContent,/Governor: Ada · 2 · still open/);
 h.document.querySelector('[data-vote]').onclick();
 await new Promise(r=>setImmediate(r));
 assert.equal(sent.body.office,'governor');assert.equal(sent.body.candidate,8);
});

test('Party Night shows the round and sends a vote',async()=>{
 const h=harness({...fixture(),place:'night',hour:22*60,clubPass:{night:1}});
 h.context.ChinaLifeCloud={playerId:'6',signedIn:true};
 let sent=null;
 h.context.ChinaLifeAuth={request:async(path,method,body)=>{sent={path,method,body};return {data:{round:{id:'1',phase:'vote',dance_ends:Date.now()-1000,vote_ends:Date.now()+60000,title:'',winner:null,joined:true,mine:null,entries:[{id:'5',name:'Ada',votes:0},{id:'6',name:'You',votes:0}]}}}}};
 await h.game.party('night');
 assert.match(h.document.getElementById('partyBody').textContent,/Ada/);
 assert.equal(h.document.querySelector('[data-dancer="6"]'),null);
 h.document.querySelector('[data-dancer="5"]').onclick();
 await new Promise(r=>setImmediate(r));
 assert.equal(sent.body.action,'vote');assert.equal(sent.body.dancer,5);assert.equal(sent.body.place,'night');
});
