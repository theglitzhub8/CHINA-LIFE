import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
// poller.js in a sandbox with a controllable clock.
function sandbox(stored=null){let now=0;const timers=[];const c={Math,Date:class extends Date{static now(){return now}},localStorage:{getItem:()=>stored},document:{hidden:false,addEventListener(k,f){(c.listeners[k]||=[]).push(f)}},listeners:{},addEventListener(k,f){(c.listeners[k]||=[]).push(f)},
 setTimeout(f,ms){const t={f,at:now+ms,id:timers.length};timers.push(t);return t},clearTimeout(t){if(t)t.cancelled=true}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('public/poller.js','utf8'),c);
 const advance=async ms=>{const end=now+ms;for(;;){const next=timers.filter(t=>!t.cancelled&&t.at<=end).sort((a,b)=>a.at-b.at)[0];if(!next)break;next.cancelled=true;now=next.at;await next.f();await Promise.resolve()}now=end};
 return {P:c.ChinaLifePoll,advance,fire:k=>(c.listeners[k]||[]).forEach(f=>f()),get now(){return now},doc:c.document}}
test('a loop runs at its interval with jitter, never twice at once, and the same name is never started twice',async()=>{const {P,advance}=sandbox();let runs=0,inFlight=0,maxInFlight=0;
 const slow=async()=>{inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);runs++;await new Promise(r=>setTimeout(r,0));inFlight--};
 const a=P.loop('x',slow,{every:10000,legacyEvery:1000}),b=P.loop('x',()=>{throw Error('second loop must not exist')},{every:1});assert.equal(a,b,'same loop returned');
 await advance(60000);assert.ok(runs>=5&&runs<=8,'about every 10 s with ±15% jitter: '+runs);assert.equal(maxInFlight,1);
});
test('failures back off exponentially (capped at 60 s) and recover; coming back to the game or the network re-checks at once',async()=>{const {P,advance,fire}=sandbox();let fail=true,runs=0;
 P.loop('y',()=>{runs++;return fail?false:true},{every:2000,legacyEvery:2000});await advance(120000);assert.ok(runs<=9,'backs off instead of 60 tries: '+runs);
 fail=false;const before=runs;fire('online');await advance(1000);assert.equal(runs,before+1,'network back: tried again at once');await advance(10000);assert.ok(runs>=before+4,'normal speed after recovery');
 const r=runs;fire('visibilitychange');await advance(1100);assert.equal(runs,r+1,'re-checked when the player came back');
});
test('kick runs a check soon (coalesced), refresh speeds a slow loop up, and legacy mode uses the old fixed timers',async()=>{const {P,advance}=sandbox();let runs=0,fast=false;
 P.loop('z',()=>{runs++},{every:()=>fast?2500:30000,legacyEvery:1000});await advance(2000);const r0=runs;
 P.kick('z');P.kick('z');P.kick('z');await advance(500);assert.equal(runs,r0+1,'three kicks, one request');
 fast=true;P.refresh('z');await advance(3000);assert.ok(runs>=r0+2,'faster at once when someone arrives');
 P.setMode('legacy');assert.equal(P.mode,'legacy');const r1=runs;await advance(10000);assert.ok(runs-r1>=8,'legacy: every 1 s like before');
});
test('a device can force legacy polling, and the server cannot override that',()=>{const {P}=sandbox('legacy');assert.equal(P.mode,'legacy');P.setMode('adaptive');assert.equal(P.mode,'legacy')});
