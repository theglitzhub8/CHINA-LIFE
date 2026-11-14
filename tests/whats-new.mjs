import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
// What's new and How it works (docs/TODAY-PLAN.md Phase 5, switches whats_new and how_it_works, default ON).
function setup({flags={},day=5,place='home',seen}={}){const t=harness({...fixture(),place,city:'China'}),c=t.context,calls=[];t.game.state.created=true;t.game.state.day=day;t.game.state.place=place;
 c.ChinaLifeFlags={cast:k=>k in flags?flags[k]:undefined,off:()=>false};
 const mem=new Map();c.localStorage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v))};if(seen)c.localStorage.setItem('chinalife-news',JSON.stringify(seen));
 const shown=[];t.game.showScreen=(title,sub,html)=>{shown.push(title);t.document.getElementById('activityContent').innerHTML=html};
 c.ChinaLifeEventScreens={open:()=>calls.push('events')};c.ChinaLifeToday={open:()=>calls.push('three')};
 vm.runInContext(fs.readFileSync('public/whats-new.js','utf8'),c);return {t,c,doc:t.document,calls,shown,W:c.ChinaLifeWhatsNew}}
test('What’s new: dated cards, each with a grey “where to find it” box and Try it; Got it marks them seen',()=>{
 const {doc,W,shown,calls,c}=setup();assert.equal(W.fresh().length,W.NEWS.length);
 W.open();assert.deepEqual(shown,['✨ What’s new']);const cards=[...doc.querySelectorAll('.wn-card')];assert.equal(cards.length,W.NEWS.length);
 assert.match(cards[0].textContent,/14 Nov.*Events.*Where to find itTap the clock at the top → 🏟 Events/);
 assert.ok(cards.every(x=>x.querySelector('.wn-where')),'every card says where');
 assert.equal(W.fresh().length,0,'opening it counts as seen');cards[0].querySelector('[data-wn]').onclick();assert.deepEqual(calls,['events']);
 assert.ok(JSON.parse(c.localStorage.getItem('chinalife-news')).includes('events'));
});
test('What’s new: shown once after an update, only the new cards; a brand-new player gets no old news',async()=>{
 const old=setup({seen:['gym','place-bars']});old.W.autoNews();assert.deepEqual(old.shown,['✨ What’s new']);
 assert.equal(JSON.stringify([...old.doc.querySelectorAll('.wn-card b')].map(b=>b.textContent)),JSON.stringify(['Events','Today’s Three']));
 old.W.autoNews();assert.equal(old.shown.length,1,'only once');
 const fresh=setup({day:1});fresh.W.autoNews();assert.deepEqual(fresh.shown,[]);assert.equal(fresh.W.fresh().length,0,'marked seen quietly');
 const off=setup({flags:{whats_new:false}});off.W.autoNews();off.W.open();assert.deepEqual(off.shown,[]);
});
test('How it works: a one-time card with three steps on Today’s Three, and floating at the Gossip Centre; Got it is for good',()=>{
 const {doc,W,c}=setup();doc.getElementById('activityContent').innerHTML='<div id="tdBody"><p>tasks</p></div>';W.how();
 const card=doc.querySelector('#activityContent>.hw');assert.ok(card,'at the top of the screen');assert.equal(card.nextElementSibling.id,'tdBody','just above the tasks, so their redraws keep it');assert.match(card.textContent,/How it works · Today’s Three/);assert.equal(card.querySelectorAll('li').length,3);
 card.querySelector('.hw-ok').onclick();assert.equal(doc.querySelector('.hw'),null);W.how();assert.equal(doc.querySelector('.hw'),null,'never again');
 assert.deepEqual(JSON.parse(c.localStorage.getItem('chinalife-howto')),['three']);
 const g=setup({place:'gist'});g.W.how();const f=g.doc.querySelector('.hw.float');assert.ok(f);assert.match(f.textContent,/Gossip Centre.*True or Cap/);
 const gym=setup({place:'gym'});gym.W.how();assert.match(gym.doc.querySelector('.hw').textContent,/The Gym/);
 const off=setup({place:'gist',flags:{how_it_works:false}});off.W.how();assert.equal(off.doc.querySelector('.hw'),null);
});
