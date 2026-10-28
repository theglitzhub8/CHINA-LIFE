// University Years plan (docs/UNIVERSITY-YEARS-PLAN.md): every part is built behind an appadmin switch, default OFF.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const r=f=>fs.readFileSync(f,'utf8');
const SWITCHES=['uni_years','uni_food','wardrobe_locks','micro_style','real_sitting'];
function flags({on='',off=''}={}){const store={'chinalife-flags-on':on,'chinalife-flags-off':off},listeners={};
 const ctx={localStorage:{getItem:k=>store[k]??null},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail}},
  addEventListener:(t,f)=>{(listeners[t]||=[]).push(f)},dispatchEvent:e=>{for(const f of listeners[e.type]||[])f(e)},
  document:{head:{append(){}},createElement:()=>({})},ChinaLifeOneCity:{active:()=>true,allows:()=>true}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(r('public/flags.js'),ctx);return ctx}

test('University Years switches are labelled in appadmin Features and start OFF on the server',()=>{const php=r('chinalife-api/hafrik-features.php');
 const off=php.match(/function cl_hafrik_features_default_off\(\): array \{return \[(.*?)\];\}/)[1];
 for(const k of SWITCHES){assert.match(php,new RegExp("'"+k+"'=>'[^']{10,}'"),k+' label');assert.ok(off.includes("'"+k+"'"),k+' starts off')}
});

test('University Years switches start OFF on the client and follow the server and test overrides',()=>{
 let c=flags();const F=c.ChinaLifeFlags;for(const k of SWITCHES)assert.equal(F.cast(k),false,k);
 let changed=0;c.addEventListener('chinalife:cast',()=>changed++);
 c.dispatchEvent(new c.CustomEvent('chinalife:hafrik-features',{detail:{uni_years:true,real_sitting:true}}));
 assert.equal(F.cast('uni_years'),true);assert.equal(F.cast('real_sitting'),true);assert.equal(F.cast('uni_food'),false);assert.equal(changed,1);
 c=flags({on:'uni_food',off:'uni_years'});c.dispatchEvent(new c.CustomEvent('chinalife:hafrik-features',{detail:{uni_years:true}}));
 assert.equal(c.ChinaLifeFlags.cast('uni_food'),true);assert.equal(c.ChinaLifeFlags.cast('uni_years'),false);
});
