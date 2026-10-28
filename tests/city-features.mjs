import test from 'node:test';import assert from 'node:assert/strict';import {harness,fixture} from './game-harness.mjs';

test('Gist Night renders anonymous tips without handles, reactions and poll choices',async()=>{
 const h=harness();const posts=[{id:'4',handle:'night-abc123',at:h.context.Date.now(),body:'The square is glowing.',reactions:{like:1,fire:0,laugh:2},mine:null,poll:{id:'9',question:'Stay out?',voted:null,options:[{text:'Yes',votes:3},{text:'No',votes:1}]}}];
 h.context.ChinaLifeAuth={request:async(path)=>{if(String(path).includes('gist-night'))return {data:{posts}};return {data:{posts:[]}}}};
 await h.game.gistNight();
 const feed=h.document.getElementById('gistNightFeed');
 assert.match(feed.textContent,/Anonymous tip/);assert.doesNotMatch(feed.textContent,/night-abc123/,'no handle is shown to players');assert.match(feed.textContent,/just now/);assert.match(feed.textContent,/The square is glowing/);assert.match(feed.textContent,/Stay out/);assert.match(feed.textContent,/4 votes/);assert.deepEqual([...feed.querySelectorAll('[data-poll]')].map(b=>b.textContent),['Yes','No']);assert.deepEqual([...feed.querySelectorAll('[data-react]')].map(b=>b.dataset.kind+b.textContent.match(/\d+/)[0]),['like1','fire0','laugh2']);
 assert.equal(feed.textContent.includes('user'),false);
});

test('City Hall lists a live tally and a vote for an open office',async()=>{
 const h=harness();let sent=null;
 const ada={id:'8',office:'governor',name:'Ada',votes:2,rank:1,is_mine:false};
 h.context.ChinaLifeAuth={request:async(path,method,body)=>{sent={path,method,body};return {data:{elections:{governor:{period:'weekly-1',closes_ms:h.context.Date.now()+36e5}},candidates:[ada],results:[ada],voted_offices:method==='POST'?['governor']:[]}}}};
 h.game.politics();await new Promise(r=>setImmediate(r));
 const governor=h.document.querySelector('[data-ballot-office="governor"]');
 assert.match(governor.textContent,/2 votes so far/);assert.match(governor.textContent,/Voting open/);assert.match(governor.textContent,/Ada.*2 votes · 100%/);
 h.document.querySelector('[data-vote="8"]').onclick();assert.equal(sent.method,undefined,'one tap only opens the confirmation');
 h.document.querySelector('[data-confirm="8"]').onclick();
 await new Promise(r=>setImmediate(r));
 assert.match(sent.path,/politics\.php\?vote=1/);assert.equal(sent.body.office,'governor');assert.equal(sent.body.candidate_id,8);
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
