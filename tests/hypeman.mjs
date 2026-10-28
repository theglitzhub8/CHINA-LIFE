// Oct 2026: AI characters off, ChampagnePappi off in one-city, the canned Club Hypeman on, and the slim one-city phone.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const r=f=>fs.readFileSync(f,'utf8');
function flags({oneCity=true,on='',off=''}={}){const store={'chinalife-flags-on':on,'chinalife-flags-off':off},listeners={};
 const ctx={localStorage:{getItem:k=>store[k]??null},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail}},
  addEventListener:(t,f)=>{(listeners[t]||=[]).push(f)},dispatchEvent:e=>{for(const f of listeners[e.type]||[])f(e)},
  document:{head:{append(){}},createElement:()=>({})},ChinaLifeOneCity:{active:()=>oneCity,allows:()=>true}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(r('public/flags.js'),ctx);return ctx}
test('cast switches: AI and Pappi default off, Hypeman default on; server and test overrides win',()=>{
 let c=flags();const F=c.ChinaLifeFlags;
 assert.equal(F.cast('ai_characters'),false);assert.equal(F.cast('club_pappi'),false);assert.equal(F.cast('club_hypeman'),true);assert.equal(F.cast('nope'),false);
 let changed=0;c.addEventListener('chinalife:cast',()=>changed++);
 c.dispatchEvent(new c.CustomEvent('chinalife:hafrik-features',{detail:{ai_characters:true,club_hypeman:false}}));
 assert.equal(F.cast('ai_characters'),true);assert.equal(F.cast('club_hypeman'),false);assert.equal(changed,1);
 c=flags({on:'club_pappi',off:'club_hypeman'});assert.equal(c.ChinaLifeFlags.cast('club_pappi'),true);assert.equal(c.ChinaLifeFlags.cast('club_hypeman'),false)});
test('server switches exist in appadmin Features with the right defaults',()=>{const php=r('chinalife-api/hafrik-features.php');
 for(const k of ['ai_characters','club_pappi','club_hypeman','app_travel','app_homes','app_delivery','app_needs','app_politics','app_cantaball','app_story','app_launches'])assert.match(php,new RegExp("'"+k+"'=>'"),k+' label');
 const off=php.match(/function cl_hafrik_features_default_off\(\): array \{return \[(.*?)\];\}/)[1];
 for(const k of ['ai_characters','club_pappi','app_travel','legacy_people_nearby'])assert.ok(off.includes("'"+k+"'"),k+' starts off');assert.ok(!off.includes('club_hypeman'),'Hypeman starts on');
 const flagsJs=r('public/flags.js'),groups=[...php.matchAll(/'(app_[a-z]+)'=>'One-city phone/g)].map(m=>m[1]);for(const g of groups)assert.ok(flagsJs.includes(g+':['),g+' wired on the client')});
test('ai.php refuses cleanly while AI characters are off, before any Claude call',()=>{const php=r('chinalife-api/ai.php'),gate=php.indexOf("cl_hafrik_features()['ai_characters']");
 assert.ok(gate>0&&gate<php.indexOf('curl_init'));assert.match(php.slice(gate,gate+300),/http_response_code\(403\);json_response\('error',\['enabled'=>false/)});
test('ai-agents.js: no bodies, residents, app or calls while off; nothing deleted',()=>{const js=r('public/ai-agents.js');
 assert.match(js,/agentsAt:place=>\{if\(!aiOn\(\)\)return \[\];/);assert.match(js,/residents:\(\)=>aiOn\(\)\?residents\(\):\[\]/);assert.match(js,/open:\(\.\.\.args\)=>aiOn\(\)\?open\(\.\.\.args\):aiOff\(\)/);assert.match(js,/function welcome\(\)\{if\(!aiOn\(\)\)return;/);
 assert.ok(js.includes("id:'night',name:'DJ Kofi'"),'characters kept');
 const c=flags();assert.equal(c.ChinaLifeFlags.appOff('ai'),true,'AI guides app hidden');c.dispatchEvent(new c.CustomEvent('chinalife:hafrik-features',{detail:{ai_characters:true}}));assert.equal(c.ChinaLifeFlags.appOff('ai'),false)});
test('Hypeman: canned, clean lines that fill names and the club name',async()=>{const js=r('public/hypeman.js');assert.doesNotMatch(js,/ai\.php|anthropic|openai|ChinaLifeAuth|fetch\(|6988|champagnepapi/i);
 const {HYPE,line,fillLine}=await import('../public/hypeman.js');
 for(const k of ['welcome','join','crowd','dance','duel','spray','bigspend','shout','hotseat','football'])assert.ok(HYPE[k]?.length,k);
 const all=Object.values(HYPE).flat();assert.ok(all.length>40);for(const t of all){assert.ok(t.length<=70,t);assert.doesNotMatch(t,/sex|f[u*]ck|shit|bitch|nigg|ass\b|drunk|pappi|007/i,t)}
 assert.equal(fillLine('Make noise for {n}!',{n:'A very very long character name here'}),'Make noise for A very very long c!');
 assert.equal(line('join',{n:'Bayo',club:'Club'},()=>0),'Make noise for Bayo! 🔊');assert.match(line('hotseat',{n:'Ada',club:'Club'},()=>0),/Ada.*Club/)});
test('club-host: Pappi behind club_pappi in one-city, Hypeman behind club_hypeman, bar kept as a plain counter',()=>{const js=r('public/club-host.js');
 assert.match(js,/pappiOn=!oneCity\|\|cast\('club_pappi'\),hypeOn=oneCity&&cast\('club_hypeman'\)/);assert.match(js,/if\(!pappiOn\)\{root\.remove\(pappi\);pappi\.visible=false\}/);
 assert.match(js,/label\('🍾 Bar',7\.2,1\.9,-4\.1,'interactive',\(\)=>menu\(\)\)/,'bar counter does not depend on Pappi');assert.ok(js.includes("'pappi-fizz'?'Club Fizz'"),'same sku, Club wording');
 assert.match(js,/hype=hypeman\(c,\{/);assert.match(js,/hypeman:hype/);assert.match(js,/if\(!bubble\)return hype\?\.say\(text,ms\)/);
 assert.ok(js.includes("const REAL={id:'6988',user:'champagnepapi'}"),'Pappi code kept for classic / switch-on')});
test('wins reach the Hypeman: hot seat and football dispatch chinalife:winner',()=>{assert.match(r('public/hot-seat.js'),/chinalife:winner',\{detail:\{kind:'hotseat'/);assert.match(r('public/football.js'),/chinalife:winner', \{ detail: \{ kind: 'football' \} \}/)});
test('host personas: one-city strips Pappi / REX lines for Club wording',async()=>{globalThis.ChinaLifeOneCity={active:()=>true,brand:t=>String(t).replace(/\b007\b/g,'the Club')};
 try{const {HOSTS,oneCityLine,reply}=await import('../public/hosts.js');const lines=HOSTS.flatMap(h=>[...h.hello,...h.small,...h.bye,...Object.values(h.topics).flat()]);
  for(const t of lines)assert.doesNotMatch(globalThis.ChinaLifeOneCity.brand(oneCityLine(t)),/pappi|champagne|\bREX\b|007/i,t);
  const tunde=HOSTS.find(h=>h.id==='tunde');for(let i=0;i<40;i++)assert.doesNotMatch(reply(tunde,'any gossip?','Ada'),/pappi/i)}
 finally{delete globalThis.ChinaLifeOneCity}});
test('one-city phone keeps the founder\'s apps; the rest is hidden, not deleted, and switchable',()=>{const c=flags(),F=c.ChinaLifeFlags;
 for(const id of ['whereto','people','football','hotseat','gossiptv','wallet','exchange','marketplace','hafrikEvents','services','hafrikBusiness','spaces','tasks','goals','rank','work','chinese','skills','academy','community','police','court','shop','settings','admin'])assert.equal(F.appOff(id),false,id+' kept');
 for(const id of ['travel','guide','driving','home','homes','cantaball','story','politics','delivery','needs','celebrate','together','fortune','journal','cloud','meet','firstday','events','ai'])assert.equal(F.appOff(id),true,id+' hidden');
 c.dispatchEvent(new c.CustomEvent('chinalife:hafrik-features',{detail:{app_travel:true}}));assert.equal(F.appOff('travel'),false,'appadmin switch brings it back');
 const classic=flags({oneCity:false}).ChinaLifeFlags;assert.equal(classic.appOff('travel'),false);assert.equal(classic.appOff('court'),true,'classic keeps the R1 list');
 const g=r('public/game.js');for(const n of ['Where to?','Link Up','Football','Gossip','Wallet','Hafrik','Today','Work','Study','Court','Store','Settings','Admin'])assert.ok(g.includes("'"+n+"'"),n);
 assert.match(g,/const fallback=window\.ChinaLifeOneCity\?\.active\?\.\(\)\?'assets\/phone\/hafrik-wallpaper\.svg'/);const svg=r('public/assets/phone/hafrik-wallpaper.svg');for(const col of ['#F7FFF7','#121212','#1F8E93','#0C3F44'])assert.ok(svg.includes(col),col);
 for(const f of ['soccer_ball_3d.png','fire_3d.png','globe_showing_europe-africa_3d.png','bullseye_3d.png','spiral_calendar_3d.png'])assert.ok(fs.existsSync('public/assets/phone/'+f),f)});
test('Work routes by background: students get side jobs, others work or their own business',()=>{const g=r('public/game.js'),w=g.slice(g.indexOf('function workApp(){'),g.indexOf('function hotSeatApp(){'));
 assert.match(w,/student=state\.background==='Student'\|\|!!state\.student/);assert.match(w,/student\?shift\+action\('workJobs','💼 Part-time jobs'/);assert.match(w,/action\('workBiz','🧰 My business'/);assert.match(w,/on\('workJobs',jobsDialog\);on\('workGigs',\(\)=>earnScreen\(\)\);on\('workBiz',businessScreen\)/)});
test('Hypeman outfit: bright, stylised, kept visible on every graphics level',async()=>{const js=r('public/hypeman.js');const {OUTFIT}=await import('../public/hypeman.js');
 assert.equal(OUTFIT.jacket,0xff2d95);assert.match(js,/avatar: 'Male_Adult_12'/,'a model that also exists in the Low set');
 assert.match(js,/userData\.r7keep = true/,'glow, cap and mic survive the realism swap');assert.match(js,/top: \{ s: 'tee', c: 0xff3fa4 \}/,'Classic graphics: stylised pink tee');
 assert.doesNotMatch(js,/\.(jpe?g|png|webp)['"]/i,'no photo textures');assert.match(js,/walk\(time, dt\); outfit\.update\(time\)/)});
