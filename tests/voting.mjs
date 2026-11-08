import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {harness,fixture} from './game-harness.mjs';
// Energy Phase 5 (switch voting_v2, default ON): candidate photos and a crown, I VOTED with a server reward, the empty
// ballot card and a one-time winner reveal.
const tick=()=>new Promise(r=>setTimeout(r,0));
function ballot({candidates=[],voted=[],holders=[]}={}){const results=candidates.map((c,i)=>({...c,rank:i+1}));return {city:'China',elections:{governor:{closes_ms:Date.now()+3600e3},'deputy-governor':{closes_ms:Date.now()+3600e3}},candidates,results,voted_offices:voted,holders,my_votes:0}}
function setup(snap,flag=true){const t=harness({...fixture(),place:'voting',city:'China'}),c=t.context,posts=[];
 c.ChinaLifeFlags={cast:k=>k==='voting_v2'?flag:undefined,off:()=>false};let current=snap;
 c.ChinaLifeAuth={request:async(url,method,body)=>{if(method==='POST'){posts.push(body);current=ballot({candidates:snap.candidates.map(x=>x.id===body.candidate_id?{...x,votes:x.votes+1}:x),voted:[body.office]});return {data:{voted:true,reward:{money:3250,xp:10,awarded:50,awardedXp:10},ballot:current}}}return {data:current}}};
 const store=new Map();c.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 return {t,c,d:t.document,posts,store}}
const A={id:1,office:'governor',name:'Amara Obi',statement:'Free jollof Fridays',votes:3,photo:'https://example.com/a.jpg',is_mine:false},B={id:2,office:'governor',name:'Li Wei',statement:'Night buses',votes:1,photo:null,is_mine:false};
test('ballot v2: photos and a crown, one vote stamps I VOTED and pays ¥50 + 10 XP from the server',async()=>{
 const {t,d,posts}=setup(ballot({candidates:[A,B]}));t.game.politics();await tick();await tick();
 const art=d.querySelector('[data-cand="1"]');assert.match(art.querySelector('.ballot-avatar').className,/photo/);assert.match(art.querySelector('.ballot-avatar').getAttribute('style'),/example\.com\/a\.jpg/);
 assert.equal(d.querySelector('[data-cand="2"] .ballot-avatar').textContent,'LW','no photo: initials');assert.match(art.textContent,/👑 Leading/);
 assert.equal(d.querySelector('.ballot-search').hidden,true,'search only with more than six candidates');
 d.querySelector('[data-vote="1"]').onclick();d.querySelector('[data-confirm="1"]').onclick();await tick();await tick();
 assert.deepEqual(posts.map(p=>[p.office,p.candidate_id]),[['governor',1]]);assert.equal(t.game.state.money,3250,'the server total');
 assert.match(d.querySelector('.ballot-stamp').textContent,/I VOTED/);assert.match(d.querySelector('.ballot-stamp').textContent,/\+¥50 · \+10 XP/);
});
test('ballot v2: an empty ballot is one Stand for election card; a new winner is revealed once; switch off keeps the old ballot',async()=>{
 const e=setup(ballot({holders:[{office:'governor',period:'weekly-2026-45',winners:[{name:'Amara Obi'}],votes:12,tied:false}]}));e.t.game.politics();await tick();await tick();
 assert.match(e.d.querySelector('.ballot-empty').textContent,/Nobody is on the ballot yet/);assert.ok(e.d.querySelector('[data-ballot-stand]'));
 assert.equal(e.d.querySelectorAll('[data-ballot-office]').length,0,'not four empty offices');assert.equal(e.d.querySelector('.ballot-tabs').hidden,true);
 assert.match(e.d.querySelector('.ballot-reveal').textContent,/And the new Governor is…/);assert.match(e.d.querySelector('.ballot-reveal-name').textContent,/Amara Obi/);
 e.d.querySelector('.ballot-reveal button').onclick();e.t.game.politics();await tick();await tick();assert.equal(e.d.querySelector('.ballot-reveal'),null,'once per election on this device');
 const off=setup(ballot({candidates:[A]}),false);off.t.game.politics();await tick();await tick();
 assert.ok(!off.d.querySelector('.ballot-avatar.photo'));assert.ok(!off.d.querySelector('.ballot-empty'));
 const r=f=>fs.readFileSync(f,'utf8');assert.match(r('public/flags.js'),/voting_v2:true/);assert.match(r('chinalife-api/politics.php'),/cl_move_totals\(\$uid,\$game,50,10\)/);
});
test('voting is open for everyone by default; the voting_open switch pauses it in the game and on the server',async()=>{
 const vm=await import('node:vm');const ctx={window:{},localStorage:{getItem:()=>null}};ctx.window.addEventListener=()=>{};ctx.window.dispatchEvent=()=>{};vm.createContext(ctx);
 vm.runInContext('var window=this.window,localStorage=this.localStorage;'+fs.readFileSync('public/flags.js','utf8').split('// R1 lazy loader')[0],ctx);
 const F=ctx.window.ChinaLifeFlags;assert.equal(F.off('politics'),false,'open by default');assert.equal(F.off('cantaball'),true,'other features unchanged');
 assert.equal(F.appOff('politics'),true,'the old phone app stays hidden: the Voting Booth is the way in');
 const r=f=>fs.readFileSync(f,'utf8');assert.match(r('chinalife-api/hafrik-features.php'),/'voting_open'=>'Voting is open/);assert.doesNotMatch(r('chinalife-api/hafrik-features.php').match(/function cl_hafrik_features_default_off[^\n]*/)[0],/voting_open/);
 assert.match(r('chinalife-api/politics.php'),/cl_hafrik_features\(\)\['voting_open'\]\?\?true\)\)cl_fail\('Voting is paused for now',409\)/);
});
