import test from 'node:test';import assert from 'node:assert/strict';import {harness,fixture} from './game-harness.mjs';

test('Gist Night protects anonymous identity and renders reactions and poll choices',async()=>{
 const h=harness();const posts=[{id:'4',at:Date.now(),handle:'night-abc123',body:'The square is glowing.',reactions:{like:1,fire:0,laugh:2},mine:null,poll:{id:'9',question:'Stay out?',voted:null,options:[{text:'Yes',votes:3},{text:'No',votes:1}]}}];
 h.context.ChinaLifeAuth={request:async(path)=>{if(String(path).includes('gist-night'))return {data:{posts}};return {data:{posts:[]}}}};
 await h.game.gistNight();
 const feed=h.document.getElementById('gistNightFeed');
 assert.match(feed.textContent,/Anonymous tip/);assert.doesNotMatch(feed.textContent,/night-abc123|NaN/);assert.match(feed.textContent,/The square is glowing/);assert.match(feed.textContent,/Stay out/);assert.equal(feed.querySelector('[data-option="0"] .txt').textContent,'Yes');assert.match(feed.textContent,/4 votes/);assert.equal(feed.querySelector('[data-kind="like"] span').textContent,'1');
 assert.equal(feed.textContent.includes('user'),false);
});

test('City Hall renders a live tally and requires confirmation before submitting a vote',async()=>{
 const h=harness();const requests=[];
 const ballot={elections:{governor:{closes_ms:Date.now()+60000}},candidates:[{id:'8',name:'Ada'}],results:[{id:'8',office:'governor',name:'Ada',votes:2,rank:1}],voted_offices:[]};
 h.context.ChinaLifeAuth={request:async(path,method,body)=>{requests.push({path,method,body});return {data:method==='POST'?{ballot:{...ballot,voted_offices:['governor']}}:ballot}}};
 h.game.politics();await new Promise(r=>setImmediate(r));
 const office=h.document.querySelector('[data-ballot-office="governor"]');assert.match(office.textContent,/Governor/);assert.match(office.textContent,/Ada/);assert.match(office.textContent,/2 votes/);
 h.document.querySelector('[data-vote]').onclick();assert.equal(requests.filter(r=>r.method==='POST').length,0);assert.equal(office.querySelector('.ballot-confirm').hidden,false);
 await office.querySelector('[data-confirm]').onclick();
 const sent=requests.find(r=>r.method==='POST');assert.equal(sent.body.office,'governor');assert.equal(sent.body.candidate_id,8);assert.equal(sent.body.city,'Shenyang');
 assert.equal(h.document.querySelector('[data-ballot-office="governor"] [data-vote]'),null);
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
