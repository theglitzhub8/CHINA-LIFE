import test from 'node:test';import assert from 'node:assert/strict';import {harness} from './game-harness.mjs';
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
const candidate={id:1,candidate_id:7,name:'Nominee <safe>',office:'governor',statement:'Better parks.',votes:3,rank:1,is_mine:true,at:Date.now()};
const ballot={candidates:[candidate],results:[candidate],elections:{governor:{closes_at:'2026-10-18 15:59:59'}},voted_offices:[],my_votes:3};
test('live ballot shows own totals, ranking bars and updates every vote button after casting',async()=>{
 const t=harness();let posted=false;t.context.ChinaLifeAuth={request:async(path,method)=>{if(method==='POST'){posted=true;return {data:{ballot:{...ballot,my_votes:4,voted_offices:['governor'],results:[{...candidate,votes:4}]}}}}return {data:ballot}}};
 t.game.phone();t.document.querySelector('[data-phone="politics"]').onclick();await settle();
 assert.match(t.document.getElementById('politicsBody').textContent,/received 3 votes/);assert.equal(t.document.querySelector('meter').getAttribute('value'),'3');assert.equal(t.document.querySelector('.politics-ranking td:nth-child(2)').textContent,'Nominee <safe> You');
 await t.document.querySelector('[data-vote]').onclick();assert(posted);assert(t.document.querySelector('[data-vote]').disabled);assert.match(t.document.getElementById('politicsBody').textContent,/received 4 votes/);
});
test('Gist shows approved nominees and anonymous vote updates in its election filter',async()=>{
 const t=harness();t.context.ChinaLifeAuth={request:async()=>({data:{posts:[],election:ballot,vote_activity:[{id:1,office:'governor',at:Date.now()}]}})};await t.game.gist();await settle();
 t.document.querySelector('[data-gist-filter="elections"]').onclick();const text=t.document.getElementById('gistPosts').textContent;assert.match(text,/Approved nominee/);assert.match(text,/Rank #1 · 3 votes/);assert.match(text,/A vote was cast for governor/);assert.match(text,/voter and choice private/);
});
test('Cantaball opens inline immediately and reload replaces the embedded session',()=>{
 const t=harness();t.game.phone();t.document.querySelector('[data-phone="cantaball"]').onclick();const first=t.document.querySelector('#cantaballFrame iframe');assert.equal(first.getAttribute('src'),'https://cantaball.bleon.net');t.click('cantaballRetry');assert.notEqual(t.document.querySelector('#cantaballFrame iframe'),first);
});
test('Phone clear-weather label follows the city sky rather than Beijing clock time',()=>{
 const t=harness();t.context.ChinaLifeWorld={weatherFor:()=> 'clear',skyHour:()=>12};t.game.phone();assert.match(t.document.getElementById('phoneContent').textContent,/Sunny/);t.context.ChinaLifeWorld.skyHour=()=>23;t.game.phone();assert.match(t.document.getElementById('phoneContent').textContent,/Clear night/);
});
test('a voter can choose another user without nominating and only own campaigns can be shared',async()=>{
 const t=harness();const other={...candidate,id:2,candidate_id:99,name:'Other player',is_mine:false};let payload,shared;t.context.ChinaLifeMilestones={campaign:(c,city)=>{shared={c,city}}};t.context.ChinaLifeAuth={request:async(path,method,body)=>{if(method==='POST'){payload=body;return {data:{ballot:{...ballot,candidates:[candidate,other],voted_offices:['governor']}}}}return {data:{...ballot,candidates:[candidate,other]}}}};
 t.game.phone();t.document.querySelector('[data-phone="politics"]').onclick();await settle();
 assert.match(t.document.getElementById('politicsBody').textContent,/do not need to nominate yourself/);assert.equal(t.document.querySelectorAll('[data-campaign]').length,1);
 t.document.querySelector('[data-campaign]').onclick();assert.equal(shared.c.candidate_id,7);
 await t.document.querySelector('[data-vote="2"]').onclick();assert.equal(payload.candidate_id,2);assert.equal(payload.office,'governor');assert(t.document.querySelector('[data-vote="1"]').disabled);
});

test('shared campaigns open a different city ballot without moving the character',async()=>{const t=harness();const before=t.game.state.city;let requested;t.context.ChinaLifeAuth={request:async(path)=>{requested=path;return {data:ballot}}};t.game.politics('Guangzhou',1);await settle();assert.equal(t.game.state.city,before);assert.match(requested,/city=Guangzhou/);assert.equal(t.document.querySelector('[aria-label="Shared campaign"] b').textContent,candidate.name);});

test('closed polls retain approved candidates and Hafrik campaign sharing with disabled voting',async()=>{
 const t=harness();let shared,posts=0;t.context.ChinaLifeMilestones={campaign:c=>shared=c};t.context.ChinaLifeAuth={request:async(path,method)=>{if(method==='POST')posts++;return {data:{...ballot,elections:{}}}}};
 t.game.politics();await settle();const button=t.document.querySelector('[data-vote="1"]');assert(button.disabled);assert.equal(button.textContent,'Voting closed');await button.onclick();assert.equal(posts,0);t.document.querySelector('[data-campaign="1"]').onclick();assert.equal(shared.id,1);assert.match(t.document.getElementById('politicsBody').textContent,/Voting closed/);
});
test('submitting a vote locks all candidates for that office until the ballot refreshes',async()=>{
 const t=harness();let complete;const other={...candidate,id:2,is_mine:false};t.context.ChinaLifeAuth={request:(path,method)=>method==='POST'?new Promise(resolve=>complete=resolve):Promise.resolve({data:{...ballot,candidates:[candidate,other]}})};
 t.game.politics();await settle();const pending=t.document.querySelector('[data-vote="2"]').onclick();assert(t.document.querySelector('[data-vote="1"]').disabled);assert(t.document.querySelector('[data-vote="2"]').disabled);complete({data:{ballot:{...ballot,candidates:[candidate,other],voted_offices:['governor']}}});await pending;assert(t.document.querySelector('[data-vote="1"]').disabled);
});

test('a pending ballot from another account cannot render or enable that account campaign',async()=>{
 const t=harness();t.game.setAccount('1');let complete;t.context.ChinaLifeAuth={request:()=>new Promise(resolve=>complete=resolve)};t.game.politics();t.game.setAccount('2');complete({data:ballot});await settle();assert.equal(t.document.querySelector('[data-vote]'),null);assert.equal(t.document.querySelector('[data-campaign]'),null);
});

test('office tabs and candidate search filter the ballot without casting or hiding sharing permanently',async()=>{const t=harness();const deputy={...candidate,id:2,name:'Second player',office:'deputy-governor',statement:'More classes.'};t.context.ChinaLifeAuth={request:async()=>({data:{...ballot,candidates:[candidate,deputy],results:[candidate,deputy]}})};t.game.politics();await settle();t.document.querySelector('[data-ballot-tab="deputy-governor"]').onclick();assert.equal(t.document.querySelector('[data-ballot-office="governor"]').hidden,true);assert.equal(t.document.querySelector('[data-ballot-office="deputy-governor"]').hidden,false);t.document.getElementById('politicsSearch').oninput({target:{value:'parks'}});assert.equal(t.document.getElementById('politicsSearchEmpty').hidden,false);t.document.querySelector('[data-ballot-tab="all"]').onclick();assert.equal(t.document.getElementById('politicsSearchEmpty').hidden,true);assert.equal(t.document.querySelector('[data-vote="2"]').closest('article').hidden,true);t.document.getElementById('politicsSearch').oninput({target:{value:''}});assert.equal(t.document.querySelector('[data-vote="2"]').closest('article').hidden,false);assert(t.document.querySelector('[data-campaign="1"]'));});
