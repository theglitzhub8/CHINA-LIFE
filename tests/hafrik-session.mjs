import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
function server() {
  const saves = new Map(), players = new Map(), calls = []; let failPresence = false, pendingSave;
  return {saves,players,calls,set failPresence(value){failPresence=value},set pendingSave(value){pendingSave=value},async fetch(raw,request) {
    const url = new URL(raw), id = request.headers.Authorization?.replace('Bearer ','');
    calls.push({path:url.pathname,method:request.method,id,body:request.body && JSON.parse(request.body)});
    if (!id) return Response.json({message:'Sign in'}, {status:401});
    if (url.pathname.endsWith('/save.php')) {
      if (request.method === 'GET') return Response.json({status:'success',data:{exists:saves.has(id),save:saves.has(id)?{game:saves.get(id)}:null}});
      const body = JSON.parse(request.body); if (pendingSave) await pendingSave;
      saves.set(id,body.save.game); return Response.json({status:'success'});
    }
    if (url.pathname.endsWith('/presence.php')) {
      if (failPresence) return Response.json({message:'Unavailable'}, {status:503});
      if (request.method === 'POST') players.set(id,{id,...JSON.parse(request.body)});
      if (request.method === 'DELETE') players.delete(id);
      return Response.json({status:'success',data:{id,players:[...players.values()].filter(p=>p.city === url.searchParams.get('city'))}});
    }
    throw Error('Unexpected API: '+url.pathname);
  }};
}
async function client(api,id,{stored=new Map(),native=true}={}) {
  const t=harness(null),c=t.context;
  c.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
  c.URLSearchParams=URLSearchParams;c.fetch=api.fetch.bind(api);
  if(native)c.HafrikSession={token:id,user:{id,name:id}};
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);
  return {...t,stored};
}
test('two signed-in users register automatically and see each other in the same venue',async()=>{
  const api=server();for(const id of ['alice','bob'])api.saves.set(id,{...fixture(),name:id,city:'Shenyang'});
  const a=await client(api,'alice'),b=await client(api,'bob');await a.context.ChinaLifeCloud.refresh();
  assert.equal(a.context.ChinaLifeCloud.players[0].name,'bob');assert.equal(b.context.ChinaLifeCloud.players[0].name,'alice');
  assert.equal(api.players.size,2);assert.ok(api.calls.some(c=>c.method==='POST'&&c.path.endsWith('/presence.php')));
  b.game.state.place='park';await b.context.ChinaLifeCloud.refresh();await a.context.ChinaLifeCloud.refresh();
  assert.equal(a.context.ChinaLifeCloud.players.length,0);assert.equal(a.context.ChinaLifeCloud.cityPlayers.length,1);
});
test('account save loads before setup and each account has its own local character',async()=>{
  const api=server();api.saves.set('alice',{...fixture(),name:'Saved Alice'});
  const t=await client(api,'alice');assert.equal(t.game.state.name,'Saved Alice');assert.equal(t.document.getElementById('onboarding').open,false);
  await t.context.ChinaLifeAuth.connect({token:'bob',user:{id:'bob'}});assert.equal(t.game.state.created,false);assert.equal(t.document.getElementById('onboarding').open,true);
  t.game.loadSave({...fixture(),name:'New Bob'});await t.context.ChinaLifeCloud.upload();
  assert.equal(api.saves.get('bob').name,'New Bob');assert.equal(api.saves.get('alice').name,'Saved Alice');
  const returning=await client(api,'bob');assert.equal(returning.game.state.name,'New Bob');assert.equal(returning.document.getElementById('onboarding').open,false);
});
test('remembered login restores automatically and password form is optional',async()=>{
  const api=server();api.saves.set('alice',fixture());const stored=new Map([['chinalife-hafrik-token','alice'],['chinalife-hafrik-profile',JSON.stringify({id:'alice'})]]);
  const t=await client(api,'alice',{stored,native:false});assert.equal(t.context.ChinaLifeCloud.signedIn,true);assert.equal(t.document.getElementById('onboarding').open,false);
  await t.context.ChinaLifeCloud.leave();assert.equal(api.players.size,0);
});
test('presence errors do not claim a successful join',async()=>{
  const api=server();api.saves.set('alice',fixture());api.failPresence=true;
  const t=await client(api,'alice');assert.equal(t.context.ChinaLifeCloud.joined,false);assert.match(t.document.getElementById('cloudStatus').title,/Unavailable/);
});
test('upload caches the exact submitted snapshot when play continues during the request',async()=>{
  const api=server();api.saves.set('alice',fixture());const t=await client(api,'alice');let release;
  api.pendingSave=new Promise(resolve=>release=resolve);const upload=t.context.ChinaLifeCloud.upload();t.game.state.money=9999;release();await upload;
  assert.equal(api.saves.get('alice').money,3200);assert.equal(t.game.state.money,9999);
});

test('presence publishes room coordinates while viewing the city map',async()=>{
  const api=server();api.saves.set('alice',fixture());const t=await client(api,'alice');
  t.context.ChinaLifeWorld={view:'map',position:{x:70,z:-40},roomPosition:{x:2.5,z:3}};
  await t.context.ChinaLifeCloud.refresh();assert.equal(api.players.get('alice').x,2.5);assert.equal(api.players.get('alice').z,3);
  t.context.ChinaLifeWorld={view:'venue',position:{x:-1,z:1}};
  await t.context.ChinaLifeCloud.refresh();assert.equal(api.players.get('alice').x,-1);
});

test('guest student character moves into a new Hafrik account and reloads once',async()=>{
 const api=server(),t=await client(api,'alice',{native:false});
 t.document.querySelector('[data-start="outside"]').onclick();t.click('nextStep');t.document.getElementById('onName').oninput({target:{value:'Guest Student'}});for(let i=0;i<4;i++)t.click('nextStep');t.document.getElementById('studentMajor').value='Computer Science';t.click('nextStep');t.click('storyNext');
 assert.equal(await t.context.ChinaLifeAuth.connect({token:'alice',user:{id:'alice'}}),true);assert.equal(t.game.state.name,'Guest Student');assert.equal(t.game.state.story.index,1);assert.equal(t.context.ChinaLifeCloud.joined,false);assert.equal(api.saves.get('alice').student.major,'Computer Science');
 const returned=await client(api,'alice');assert.equal(returned.game.state.story.index,1);assert.equal(returned.game.state.student.studyLevel,'Undergraduate');assert.equal(returned.document.getElementById('onboarding').open,false);
});

test('manual login omits cookies and stale tokens, then restores the account with the new token',async()=>{
 const api=server();api.saves.set('alice',{...fixture(),name:'Saved Alice'});
 const t=await client(api,'unused',{native:false});let loginRequest;
 t.context.fetch=async (url,request)=>{
  if(new URL(url).pathname.endsWith('/auth/login.php')){
   loginRequest=request;
   // Model the browser's rejection of wildcard CORS with credentialed requests.
   if(request.credentials==='include')throw TypeError('Failed to fetch');
   return Response.json({status:'success',data:{token:'alice',user:{id:'alice'}}});
  }
  return api.fetch(url,request);
 };
 t.context.ChinaLifeCloud.open();t.document.getElementById('hafrikLogin').value='alice';t.document.getElementById('hafrikPassword').value='test-only-password';
 await t.document.getElementById('hafrikLoginForm').onsubmit({preventDefault(){}});
 assert.equal(loginRequest.credentials,'omit');assert.equal(loginRequest.headers.Authorization,undefined);assert.equal(JSON.parse(loginRequest.body).login,'alice');assert.equal(t.context.ChinaLifeCloud.signedIn,true);assert.equal(t.game.state.name,'Saved Alice');assert.equal(t.document.getElementById('onboarding').open,false);assert.equal(t.document.getElementById('cloudDialog').open,false);assert.equal(t.stored.get('chinalife-hafrik-token'),'alice');
 // A second password login must also omit the previous account's bearer token.
 await t.context.ChinaLifeAuth.request('/auth/login.php','POST',{login:'alice',password:'test-only-password'});assert.equal(loginRequest.headers.Authorization,undefined);
});

test('manual login reports invalid credentials and allows another attempt',async()=>{
 const t=await client(server(),'unused',{native:false});t.context.fetch=async()=>Response.json({status:'error',message:'Invalid credentials'},{status:401});t.context.ChinaLifeCloud.open();t.document.getElementById('hafrikLogin').value='alice';t.document.getElementById('hafrikPassword').value='wrong-test-password';await t.document.getElementById('hafrikLoginForm').onsubmit({preventDefault(){}});assert.equal(t.document.getElementById('hafrikLoginFeedback').textContent,'Invalid credentials');assert.equal(t.document.querySelector('#hafrikLoginForm button[type="submit"]').disabled,false);assert.equal(t.context.ChinaLifeCloud.signedIn,false);
});

test('valid cloud character loads even when the account device cache is invalid',async()=>{
 const api=server();api.saves.set('alice',{...fixture(),name:'Cloud Character',money:4200});const stored=new Map([['chinalife-account-alice',JSON.stringify({...fixture(),money:'invalid stale cache'})]]);
 const t=await client(api,'alice',{stored});assert.equal(t.context.ChinaLifeCloud.signedIn,true);assert.equal(t.game.state.name,'Cloud Character');assert.equal(t.game.state.money,4200);assert.equal(t.document.getElementById('onboarding').open,false);assert.equal(api.saves.get('alice').money,4200);
});

test('invalid cloud character is diagnosed and never replaced by the device copy',async()=>{
 const api=server();api.saves.set('alice',{...fixture(),money:'unrecoverable'});const stored=new Map([['chinalife-account-alice',JSON.stringify(fixture())]]);const t=await client(api,'alice',{stored});assert.match(t.document.getElementById('cloudStatus').title,/money/);assert.match(t.document.getElementById('cloudStatus').title,/not been replaced/);assert.equal(api.calls.filter(c=>c.path.endsWith('/save.php')&&c.method==='POST').length,0);assert.equal(api.saves.get('alice').money,'unrecoverable');assert.equal(await t.context.ChinaLifeCloud.upload(),false);
});


test('two accounts recover from an initial presence outage on the regular heartbeat',async()=>{
 const api=server();for(const id of ['alice','bob'])api.saves.set(id,{...fixture(),name:id,city:'Shenyang'});
 api.failPresence=true;const a=await client(api,'alice'),b=await client(api,'bob');
 assert.equal(a.context.ChinaLifeCloud.joined,false);assert.equal(b.context.ChinaLifeCloud.joined,false);
 api.failPresence=false;
 const heartbeat=t=>t.intervals.find(fn=>fn.name==='presenceHeartbeat')();
 await heartbeat(a);await heartbeat(b);await heartbeat(a);
 assert.equal(a.context.ChinaLifeCloud.players[0].id,'bob');assert.equal(b.context.ChinaLifeCloud.players[0].id,'alice');
 assert.equal(a.context.ChinaLifeCloud.joined,true);assert.equal(b.context.ChinaLifeCloud.joined,true);
 await a.context.ChinaLifeCloud.leave();await heartbeat(a);assert.equal(a.context.ChinaLifeCloud.joined,true);
});

test('background first join resumes when the game becomes visible',async()=>{
 const api=server();api.saves.set('alice',fixture());const t=await client(api,'alice');
 await t.context.ChinaLifeCloud.leave();t.document.hidden=true;
 await t.context.ChinaLifeCloud.join();assert.equal(t.context.ChinaLifeCloud.joined,false);
 const heartbeat=t.intervals.find(fn=>fn.name==='presenceHeartbeat');await heartbeat();assert.equal(t.context.ChinaLifeCloud.joined,false);
 t.document.hidden=false;await heartbeat();assert.equal(t.context.ChinaLifeCloud.joined,true);
});
