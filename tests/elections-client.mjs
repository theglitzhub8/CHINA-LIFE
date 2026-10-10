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
