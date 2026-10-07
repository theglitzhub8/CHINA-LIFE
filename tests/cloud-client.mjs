import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {harness,fixture} from './game-harness.mjs';
async function setup(options={}){
 const t=harness(null),c=t.context,local=new Map();let money=3200,revision=1,pending;
 c.localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)};c.URLSearchParams=URLSearchParams;c.HafrikSession={token:'session',user:{id:'1',name:'Tester'}};
 c.fetch=async(raw,request)=>{
  const url=new URL(raw);
  if(url.pathname.endsWith('save.php')){
   if(request.method==='GET')return Response.json({status:'success',data:{revision,save:{game:{...fixture(),money}},account:{id:'1',username:'Tester'}}});
   if(options.uploadStatus)return Response.json({status:'error',message:options.uploadStatus===409?'Newer save exists':'Session expired',data:{revision:2,save:{game:{...fixture(),money:5000}}}},{status:options.uploadStatus});
   const body=JSON.parse(request.body);money=body.save.game.money;revision++;return Response.json({status:'success',data:{revision}});
  }
  if(url.pathname.endsWith('presence.php')){
   if(request.method==='GET'&&options.defer){options.defer=false;return new Promise(resolve=>pending=()=>resolve(Response.json({status:'success',data:{players:[{id:'2',city:'Shenyang',place:'home',name:'Other'}]}})))}
   return Response.json({status:'success',data:{players:[]}});
  }
 };
 await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);
 return {...t,get release(){return pending}};
}
test('save conflicts retain the newer account save and pause automatic overwrites',async()=>{
 const t=await setup({uploadStatus:409});assert.equal(await t.context.ChinaLifeCloud.upload(),false);
 assert.match(t.document.getElementById('cloudContent').textContent,/newer account save/);
 t.document.getElementById('cloudLoad').onclick();assert.equal(t.game.state.money,5000);
});
test('expired app authentication asks the app again and keeps password login optional',async()=>{
 const t=await setup({uploadStatus:401});assert.equal(await t.context.ChinaLifeCloud.upload(),false);
 assert.equal(t.context.ChinaLifeCloud.signedIn,false);assert.equal(t.context.ChinaLifeCloud.players.length,0);
 assert.match(t.document.getElementById('cloudContent').textContent,/Try again/);assert.doesNotMatch(t.document.getElementById('cloudContent').textContent,/Continue with Hafrik/);assert.ok(t.document.getElementById('hafrikLoginForm').closest('details'));
});
test('leaving shared city discards a pending presence response',async()=>{
 const options={};const t=await setup(options);options.defer=true;
 const pulse=t.context.ChinaLifeCloud.refresh();await new Promise(setImmediate);
 await t.context.ChinaLifeCloud.leave();t.release();await pulse;
 assert.equal(t.context.ChinaLifeCloud.players.length,0);assert.equal(t.context.ChinaLifeCloud.joined,false);
});
test('changing venue discards a pending presence response',async()=>{
 const options={};const t=await setup(options);options.defer=true;
 const pulse=t.context.ChinaLifeCloud.refresh();await new Promise(setImmediate);t.game.state.place='park';t.release();await pulse;
 assert.equal(t.context.ChinaLifeCloud.players.length,0);
});
