import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(sql){
 const stmt=sqlite.prepare(sql);
 return {bind(...args){return {
 async first(){return stmt.get(...args)||null},
 async all(){return {results:stmt.all(...args)}},
 async run(){const r=stmt.run(...args);return {meta:{changes:r.changes}}}
 }}};
}};
const base='https://game.example';
async function request(path,method='GET',body=null,id='alice',origin=base){const headers={};if(id){headers['oai-authenticated-user-id']=id;headers['oai-authenticated-user-email']=id+'@example.test'}if(body){headers['content-type']='application/json';headers.origin=origin}if(method==='DELETE')headers.origin=origin;return worker.fetch(new Request(base+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB})}
const state={created:true,name:'Alice',background:'Student',place:'home',day:1,hour:520,money:3200,xp:0,color:'#18776d',skills:{Chinese:1,Social:1,Digital:1,Creativity:1,Fitness:1},needs:{energy:80,hunger:75,hygiene:80,bladder:70,fun:55,social:45},trait:[],dream:'0',visited:['home'],upgrades:[],trips:[],logs:[]};
test('bundled game assets retain correct content types',async()=>{const r=await request('/');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);assert.match(await r.text(),/worldViewport/);assert.equal((await request('/world.js')).status,200);assert.equal((await request('/vendor/three.module.js')).status,200);assert.equal((await request('/unknown')).status,404)});
test('public account check and unauthenticated API rejection',async()=>{assert.equal((await (await request('/api/account','GET',null,null)).json()).signedIn,false);assert.equal((await request('/api/save','GET',null,null)).status,401)});
test('save creation, account isolation, revisions and conflict protection',async()=>{let r=await request('/api/save','PUT',{state,revision:0});assert.equal(r.status,200);assert.equal((await r.json()).revision,1);assert.equal((await (await request('/api/save')).json()).state.name,'Alice');assert.equal((await (await request('/api/save','GET',null,'bob')).json()).state,null);r=await request('/api/save','PUT',{state:{...state,money:3500},revision:1});assert.equal((await r.json()).revision,2);r=await request('/api/save','PUT',{state:{...state,money:0},revision:1});assert.equal(r.status,409);assert.equal((await r.json()).state.money,3500)});
test('invalid saves and cross-origin writes are rejected',async()=>{assert.equal((await request('/api/save','PUT',{state:{...state,money:'bad'},revision:2})).status,400);assert.equal((await request('/api/save','PUT',{state,revision:2},'alice','https://other.example')).status,403)});
test('presence is limited to current venue, excludes self and never exposes email',async()=>{const p={name:'Alice',place:'cafe',color:'#18776d',skin:'#8b5c43',hair:'cropped',x:0,z:2};assert.equal((await request('/api/presence','POST',p)).status,200);let r=await request('/api/presence','POST',{...p,name:'Bob'},'bob');let v=await r.json();assert.equal(v.players.length,1);assert.equal(v.players[0].name,'Alice');assert.equal('email' in v.players[0],false);assert.equal('user_id' in v.players[0],false);r=await request('/api/presence','POST',{...p,name:'Bob',place:'gym'},'bob');assert.equal((await r.json()).players.length,0);sqlite.prepare('UPDATE city_presence SET seen_at = 0 WHERE user_id = ?').run('alice');r=await request('/api/presence','POST',{...p,name:'Bob'},'bob');assert.equal((await r.json()).players.length,0);assert.equal((await request('/api/presence','DELETE',null,'bob')).status,200);assert.equal(sqlite.prepare('SELECT user_id FROM city_presence WHERE user_id = ?').get('bob'),undefined)});
test('malformed, oversized and non-object request bodies return client errors',async()=>{for(const [body,type,status] of [['{','application/json',400],['null','application/json',400],['[]','application/json',400],['x'.repeat(100001),'application/json',413],['{}','text/plain',415]]){const response=await worker.fetch(new Request(base+'/api/save',{method:'PUT',headers:{origin:base,'content-type':type,'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.test'},body}),{DB});assert.equal(response.status,status)}});

test('Worker home instances isolate two owners and restore shared public presence',async()=>{
 const p={city:'Shenyang',name:'Alice',place:'home',color:'#18776d',skin:'#8b5c43',hair:'cropped',x:0,z:2};
 for(const place of ['home','home-campus','home-mansion']){
  assert.equal((await request('/api/presence','POST',{...p,place})).status,200);
  const r=await request('/api/presence','POST',{...p,place,name:'Bob'},'bob');assert.equal(r.status,200);assert.deepEqual((await r.json()).players,[]);
  const a=sqlite.prepare('SELECT place FROM city_presence WHERE user_id = ?').get('alice').place,b=sqlite.prepare('SELECT place FROM city_presence WHERE user_id = ?').get('bob').place;assert.notEqual(a,b);assert.ok(a.startsWith(place+'@'));
 }
 const room={city:'Shenyang',place:'home-mansion',channel:'venue'};
 assert.equal((await request('/api/messages','POST',{...room,text:'Owner only'})).status,200);
 const r=await request('/api/messages?channel=venue&city=Shenyang&place=home-mansion','GET',null,'bob');assert.equal(r.status,200);assert.deepEqual((await r.json()).messages,[]);
 for(const id of ['alice','bob']){const r=await request('/api/voice','POST',{...room,action:'join',session:'private-home-'+id,muted:false,after:0},id);assert.equal(r.status,200);assert.equal((await r.json()).members.length,1);}
 for(const id of ['alice','bob'])await request('/api/presence','POST',{...p,place:'plaza',name:id},id);
 assert.equal((await (await request('/api/presence','POST',{...p,place:'plaza'})).json()).players.length,1);
});
