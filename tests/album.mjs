import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// City Album (docs/ROADMAP.md item 5, switch city_album, default ON).
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const ids=['night','gist','voting','football','hq','cityhospital','university','gym'];
const album=(cards={})=>{const sets=ids.map(id=>{const c=cards[id]||[0,0,0,0,0,0],have=c.filter(Boolean).length;return {id,cards:c,have,done:have===6,claimed:false}});
 return {sets,have:sets.reduce((a,s)=>a+s.have,0),total:48,spares:sets.reduce((a,s)=>a+s.cards.reduce((x,y)=>x+y,0)-s.have,0),setPrize:{coins:300,xp:30},allPrize:{coins:2000,xp:200},allClaimed:false}};
function setup({flag=true,d=album(),reply,seen}={}){const t=harness({...fixture(),place:'home',city:'China'}),c=t.context,calls=[],posts=[];t.game.state.created=true;
 const mem=new Map();c.localStorage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v))};if(seen)for(const[k,v]of Object.entries(seen))mem.set(k,JSON.stringify(v));
 c.ChinaLifeFlags={cast:k=>k==='city_album'?flag:undefined,off:()=>false};c.ChinaLifeCloud={signedIn:true};let cur=d;
 c.ChinaLifeAuth={request:async(url,method,body)=>{assert.match(url,/album\.php/);if(method==='POST'){posts.push(body);cur=reply;return {data:reply}}return {data:cur}}};
 const shown=[];t.game.showScreen=(title,sub,html)=>{shown.push(title);t.document.getElementById('activityContent').innerHTML=html};
 t.game.toast=m=>calls.push(m);t.game.applyServerTotals=r=>calls.push('paid:'+r.money);c.ChinaLifeWhereTo={go:id=>calls.push('go:'+id)};
 vm.runInContext(fs.readFileSync('public/album.js','utf8'),c);return {t,c,doc:t.document,calls,posts,shown,A:c.ChinaLifeAlbum,set:v=>{cur=v}}}
test('City Album: eight sets with progress; a set opens to six cards, rare and spares marked, how to get them and Go',async()=>{
 const {doc,A,shown,calls}=setup({d:album({gym:[2,1,0,0,0,1],night:[1,0,0,0,0,0]})});await A.open();await flush();
 assert.deepEqual(shown,['🃏 City Album']);const box=doc.getElementById('alBody');
 assert.match(box.textContent,/4of 48/);assert.match(box.textContent,/1 spare · trading opens soon/);
 assert.equal(box.querySelectorAll('.al-set').length,8);assert.match(box.querySelector('.al-set:last-child').textContent,/The Gym3 of 6/);
 box.querySelector('[data-set="gym"]').onclick();const cards=[...doc.querySelectorAll('.al-set.open .al-card')];assert.equal(cards.length,6);
 assert.match(cards[0].textContent,/DumbbellsDumbbells|Dumbbells×2/);assert.match(cards[5].textContent,/Champion Belt.*Rare/);assert.ok(cards[5].classList.contains('rare'));
 assert.match(cards[2].textContent,/Not yet/);assert.match(doc.querySelector('.al-set.open').textContent,/Every workout you do at the gym/);
 doc.querySelector('[data-go="gym"]').onclick();assert.ok(calls.includes('go:gym'));
 assert.equal(A.summary().text,'4 of 48 cards · 1 spare');
});
test('City Album: a complete set claims its prize; all eight claim the album prize',async()=>{
 const full=[1,1,1,1,1,1],done=album({gym:full});const paid=JSON.parse(JSON.stringify(done));paid.sets[7].claimed=true;
 const {doc,A,posts,calls}=setup({d:done,reply:{...paid,money:4000,xp:100,awarded:300}});await A.open('gym');await flush();
 assert.equal(A.summary().hot,true);const b=doc.querySelector('[data-claim="gym"]');assert.match(b.textContent,/Claim ¥300 \+ 30 XP/);
 await b.onclick();await flush();assert.equal(JSON.stringify(posts),JSON.stringify([{op:'claim',set:'gym'}]));assert.ok(calls.includes('paid:4000'));
 assert.match(doc.querySelector('.al-set:last-child').textContent,/✓ ¥300 paid/);
 const all=album(Object.fromEntries(ids.map(i=>[i,full])));all.sets.forEach(s=>s.claimed=true);const x=setup({d:all});await x.A.open();await flush();
 assert.match(x.doc.querySelector('[data-claim="all"]').textContent,/Claim ¥2,000 · Album complete/);
});
test('City Album: a toast names a new card once; new cards show NEW until their set is opened; the switch off opens nothing',async()=>{
 const before=album({night:[1,0,0,0,0,0]}),after=album({night:[1,0,0,1,0,0]});
 const s=setup({d:before});await s.A.peek({toast:true});assert.equal(s.calls.length,0,'the first look is quiet');
 s.set(after);await s.A.peek({toast:true});assert.deepEqual(s.calls,['🃏 New card for your City Album: 🧋 Bubble Tea Bar']);
 await s.A.peek({toast:true});assert.equal(s.calls.length,1,'only once');
 await s.A.open();await flush();assert.match(s.doc.querySelector('.al-set').textContent,/NEW/);
 s.doc.querySelector('[data-set="night"]').onclick();assert.ok(s.doc.querySelector('.al-card.new'));
 s.doc.querySelector('[data-set="night"]').onclick();s.doc.querySelector('[data-set="night"]').onclick();assert.equal(s.doc.querySelector('.al-card.new'),null,'seen now');
 const off=setup({flag:false});await off.A.open();assert.deepEqual(off.shown,[]);
});
test('City Album: every set has six named cards, and the sets match the server',()=>{
 const {A}=setup();const php=fs.readFileSync('chinalife-api/album.php','utf8');
 for(const id of ids){assert.equal(A.SETS[id][5].length,6,id);assert.match(php,new RegExp("'"+id+"'=>"))}
});
test('City Album trading: Trade on a spare, pick a friend and one of their spares, send; offers to you can be accepted',async()=>{
 const d=album({gym:[3,1,0,0,0,0]});d.trading={on:true,perDay:3,hours:48,sentToday:0,incoming:[],outgoing:[],friends:[{id:'7',name:'Ada'}]};
 const after=JSON.parse(JSON.stringify(d));after.trading.sentToday=1;after.trading.outgoing=[{id:'1',to:{id:'7',name:'Ada'},give:'gym:0',want:'football:2',expiresIn:172800}];
 const s=setup({d,reply:after});const urls=[];const req=s.c.ChinaLifeAuth.request;s.c.ChinaLifeAuth.request=async(url,method,body)=>{urls.push(url);if(/friend=7/.test(url))return {data:{friend:{id:'7',name:'Ada'},spares:['football:2','gym:0']}};return req(url,method,body)};
 await s.A.open('gym');await flush();const doc=s.doc;
 assert.equal(doc.querySelectorAll('[data-give]').length,1,'only spares can be traded');doc.querySelector('[data-give="gym:0"]').onclick({stopPropagation(){}});
 assert.match(doc.getElementById('alBody').textContent,/YOU GIVE🏋️ Dumbbells.*TRADE WITHAda.*3 of 3 offers left today/);
 await doc.querySelector('[data-friend="7"]').onclick();await flush();assert.ok(urls.some(u=>/album\.php\?friend=7/.test(u)));
 const picks=[...doc.querySelectorAll('[data-want]')].map(b=>b.dataset.want);assert.deepEqual(picks,['football:2'],'not the card you are giving');
 assert.match(doc.getElementById('alBody').textContent,/Team JerseyYou need this/);
 doc.querySelector('[data-want="football:2"]').onclick();const send=doc.querySelector('[data-send]');assert.match(send.textContent,/Offer Dumbbells for Team Jersey/);
 await send.onclick();await flush();assert.equal(JSON.stringify(s.posts.at(-1)),JSON.stringify({op:'offer',to:7,give:'gym:0',want:'football:2'}));
 assert.match(doc.getElementById('alBody').textContent,/Waiting for Ada: your 🏋️ Dumbbells for their 🎽 Team Jersey/);
 // An offer to you: a toast once, the Today panel line, Accept.
 const inc=album({football:[2,0,1,0,0,0]});inc.trading={on:true,perDay:3,hours:48,sentToday:0,outgoing:[],friends:[],incoming:[{id:'9',from:{id:'8',name:'Ben'},give:'night:1',want:'football:0',expiresIn:7200}]};
 const t=setup({d:inc,reply:{...inc,trading:{...inc.trading,incoming:[]}}});await t.A.peek({toast:true});assert.deepEqual(t.calls,['🔁 Ben offered you a card trade. Open your City Album.']);
 await t.A.peek({toast:true});assert.equal(t.calls.length,1,'once');assert.deepEqual(JSON.parse(JSON.stringify(t.A.summary())),{hot:true,text:'1 trade offer waiting'});
 await t.A.open();await flush();assert.match(t.doc.getElementById('alBody').textContent,/Ben offers 🌈 Neon Sign for your ⚽ Match Ball.*Ends in 2h/);
 await t.doc.querySelector('[data-answer="9"][data-ok="1"]').onclick();await flush();assert.equal(JSON.stringify(t.posts),JSON.stringify([{op:'answer',id:9,accept:true}]));
});
