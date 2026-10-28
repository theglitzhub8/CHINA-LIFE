import http from 'node:http';import crypto from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
import {spawn,execFileSync} from 'node:child_process';
import {fixture,harness} from './game-harness.mjs';
import vm from 'node:vm';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chinalife-api-')),socket=path.join(tmp,'mysql.sock');
let mysql,php,base;
const sql=command=>execFileSync('mysql',['--no-defaults','--socket='+socket,'-u','root','--batch','--skip-column-names','-e',command],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
// CL_CACHE_OFF: the 30 s shared cache (cache-lib.php) lives in the system temp dir and would leak between runs and tests.
const env={...process.env,CHINALIFE_TEST_SOCKET:socket,CHINALIFE_PUSH_TEST:'1',CL_CACHE_OFF:'1'};
async function waitFor(check){for(let i=0;i<100;i++){try{if(await check())return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test service failed to start')}
async function call(id,file,method='GET',data){const response=await fetch(base+'/api/v4/chinalife/'+file,{method,headers:{...(id?{Authorization:'Bearer test-'+id}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {...await response.json(),httpStatus:response.status}}
const presence=(city='Shenyang',place='plaza')=>({city,place,name:'Player',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2});
const game=()=>({...fixture(),city:'Shenyang'});
before(async()=>{
 execFileSync('mysqld',['--no-defaults','--initialize-insecure','--datadir='+path.join(tmp,'data')],{stdio:'ignore'});
 const log=fs.openSync(path.join(tmp,'mysql.log'),'a');mysql=spawn('mysqld',['--no-defaults','--datadir='+path.join(tmp,'data'),'--socket='+socket,'--skip-networking','--mysqlx=0','--pid-file='+path.join(tmp,'mysql.pid')],{stdio:['ignore',log,log]});
 await waitFor(()=>sql('SELECT 1').trim()==='1');
 sql('CREATE DATABASE chinalife_test; USE chinalife_test; CREATE TABLE users(user_id INT UNSIGNED PRIMARY KEY,user_name VARCHAR(100),user_picture VARCHAR(255) NULL,user_gender VARCHAR(8) NULL); INSERT INTO users(user_id,user_name) VALUES '+Array.from({length:12},(_,i)=>`(${i+1},'user${i+1}')`).join(','));
 const root=path.join(tmp,'web/api/v4');fs.mkdirSync(root,{recursive:true});fs.cpSync('chinalife-api',path.join(root,'chinalife'),{recursive:true});fs.writeFileSync(path.join(root,'chinalife/admin-config.php'),`<?php return ['usernames'=>['user1']];`);fs.writeFileSync(path.join(root,'chinalife/polling-config.json'),'{"mode":"adaptive"}');
 fs.writeFileSync(path.join(root,'db.php'),`<?php mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);`);
 fs.writeFileSync(path.join(root,'helpers.php'),`<?php function get_db_connection(){$db=new mysqli('localhost','root','','chinalife_test',0,getenv('CHINALIFE_TEST_SOCKET'));$db->set_charset('utf8mb4');return $db;} if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS'){http_response_code(204);exit;} function json_response($status,$data=null,$message=''){header('Content-Type: application/json');echo json_encode(compact('status','data','message'));exit;} function auth_user($db){$token=$_SERVER['HTTP_AUTHORIZATION']??'';if(!preg_match('/^Bearer test-([1-9][0-9]*)$/',$token,$m)){http_response_code(401);json_response('error',null,'Unauthorized');}$s=$db->prepare('SELECT * FROM users WHERE user_id=?');$id=(int)$m[1];$s->bind_param('i',$id);$s->execute();return $s->get_result()->fetch_assoc()?:[];}`);
 // Upgrade the schema already uploaded to the Hafrik server, twice, preserving its rows.
 for(const file of ['migration.sql','migration 2.sql','voice.sql'])sql('USE chinalife_test; '+fs.readFileSync('chinalife-api/'+file,'utf8'));
 sql(`USE chinalife_test; INSERT INTO chinalife_saves(user_id,character_data,game_state) VALUES(12,'{}','${JSON.stringify(game())}');`);
 for(let i=0;i<2;i++)execFileSync('php',[path.join(root,'chinalife/migrate.php')],{env,stdio:'pipe'});
 // Most tests start players in Shenyang; one-city mode (default open city China) is covered by its own tests.
 sql(`USE chinalife_test; INSERT INTO chinalife_settings(name,value,updated_at) VALUES('open_cities','["China","Shenyang"]',NOW())`);
 const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base='http://127.0.0.1:'+port;
 const phpLog=fs.openSync(path.join(tmp,'php.log'),'a');php=spawn('php',['-S','127.0.0.1:'+port,'-t',path.join(tmp,'web')],{env,stdio:['ignore',phpLog,phpLog]});
 await waitFor(async()=>{try{return (await fetch(base+'/api/v4/chinalife/save.php')).status===401}catch{return false}});
});
// Each run creates a ~190 MB MySQL data directory; remove it so repeated runs cannot fill the disk.
after(async()=>{php?.kill();if(mysql&&mysql.exitCode===null){const exited=new Promise(resolve=>mysql.once('exit',resolve));mysql.kill();await exited}fs.rmSync(tmp,{recursive:true,force:true})});
test('migration preserves existing saves and authenticated account identity',async()=>{const r=await call(12,'save.php');assert.equal(r.data.save.game.name,'Tester');assert.equal(r.data.revision,1);assert.equal(r.data.account.id,'12');assert.equal((await call(null,'save.php')).httpStatus,401)});
test('save revision prevents lost updates and isolates accounts',async()=>{
 let r=await call(1,'save.php','POST',{revision:0,save:{character:{},game:game()}});assert.equal(r.httpStatus,200);assert.equal(r.data.revision,1);
 r=await call(1,'save.php','POST',{revision:0,save:{character:{},game:{...game(),money:0}}});assert.equal(r.httpStatus,409);assert.equal(r.data.save.game.money,3200);assert.equal((await call(2,'save.php')).data.exists,false);
 r=await call(1,'save.php','POST',{revision:1,save:{character:{},game:{...game(),money:4000}}});assert.equal(r.data.revision,2);
 assert.equal((await call(1,'save.php','POST',{save:{character:{},game:[]}})).httpStatus,400);
});
test('street presence shares walkers in the same city, clears when not walking and expires after 30 seconds',async()=>{
 assert.equal((await call(1,'presence.php','POST',{...presence(),street:{x:12.5,z:-40,h:1.2}})).httpStatus,200);
 let r=await call(2,'presence.php','POST',presence());assert.equal(r.httpStatus,200);let a=r.data.players.find(p=>p.id==='1');assert.deepEqual(a.street,{x:12.5,z:-40,h:1.2});
 assert.equal((await call(2,'presence.php','POST',presence('Beijing'))).data.players.some(p=>p.id==='1'),false);
 assert.equal((await call(1,'presence.php','POST',{...presence(),street:{x:5000,z:0,h:0}})).httpStatus,400);
 assert.equal((await call(1,'presence.php','POST',{...presence(),street:{x:'a',z:0,h:0}})).httpStatus,400);
 await call(1,'presence.php','POST',{...presence('Shenyang','home'),street:{x:3,z:4,h:0}});r=await call(2,'presence.php','POST',presence());a=r.data.players.find(p=>p.id==='1');assert.equal(a.place,'private-home');assert.deepEqual(a.street,{x:3,z:4,h:0});
 sql("USE chinalife_test; UPDATE chinalife_presence SET street_at=DATE_SUB(NOW(),INTERVAL 31 SECOND) WHERE user_id=1");r=await call(2,'presence.php?city=Shenyang');assert.equal(r.data.players.find(p=>p.id==='1')?.street,undefined);
 await call(1,'presence.php','POST',{...presence(),street:{x:1,z:1,h:0}});await call(1,'presence.php','POST',presence());r=await call(2,'presence.php?city=Shenyang');assert.equal(r.data.players.find(p=>p.id==='1')?.street,undefined);
});
test('light street refresh returns only fresh walkers with their emote, and the full POST still lists everyone',async()=>{
 await call(3,'presence.php','POST',{...presence(),street:{x:4,z:5,h:0,e:'wave'}});await call(4,'presence.php','POST',presence());
 let r=await call(5,'presence.php','POST',{...presence(),street:{x:1,z:1,h:0},lite:1});assert.equal(r.httpStatus,200);assert.equal(r.data.lite,true);assert.equal(r.data.players,undefined);
 const w=r.data.walkers.find(p=>p.id==='3');assert.deepEqual(w.street,{x:4,z:5,h:0,e:'wave'});assert.equal(r.data.walkers.some(p=>p.id==='4'),false);assert.equal(r.data.walkers.some(p=>p.id==='5'),false);
 r=await call(5,'presence.php','POST',{...presence(),street:{x:1,z:1,h:0}});assert.equal(r.data.lite,undefined);assert.ok(r.data.players.some(p=>p.id==='4'));assert.equal(r.data.players.find(p=>p.id==='3').street.e,'wave');
 r=await call(5,'presence.php','POST',{...presence(),lite:1});assert.equal(r.data.lite,undefined);assert.ok(Array.isArray(r.data.players));
 await call(3,'presence.php','POST',{...presence(),street:{x:4,z:5,h:0,e:'<b>'}});r=await call(5,'presence.php','POST',{...presence(),street:{x:1,z:1,h:0},lite:1});assert.equal(r.data.walkers.find(p=>p.id==='3').street.e,undefined);
 assert.ok(sql("USE chinalife_test; SHOW INDEX FROM chinalife_presence WHERE Key_name='street_city_at'").includes('street_at'));
 for(const id of [3,4,5])await call(id,'presence.php','DELETE');
});
test('new venues are valid rooms',async()=>{for(const place of ['football','gamecenter','court'])assert.equal((await call(6,'presence.php','POST',presence('Shenyang',place))).httpStatus,200);await call(6,'presence.php','DELETE')});
test('presence preserves appearance, excludes self, separates cities and expires stale players',async()=>{
 for(const id of [1,2])assert.equal((await call(id,'presence.php','POST',presence())).httpStatus,200);
 let r=await call(1,'presence.php?city=Shenyang');assert.equal(r.data.players[0].id,'2');assert.equal(r.data.players[0].skin,'#8b5c43');assert.equal(r.data.players[0].hair,'cap');assert.equal(typeof r.data.players[0].x,'number');assert.equal(typeof r.data.players[0].xp,'number');
 await call(2,'presence.php','POST',presence('Beijing'));assert.equal((await call(1,'presence.php?city=Shenyang')).data.players.length,0);
 sql("USE chinalife_test; UPDATE chinalife_presence SET seen_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE user_id=2");assert.equal((await call(1,'presence.php?city=Beijing')).data.players.length,0);
 assert.equal((await call(1,'presence.php','POST',{...presence(),city:'invalid'})).httpStatus,400);
 await call(2,'presence.php','POST',presence());
});
test('venue chat enforces membership, escapes in the client, timestamps, limits and ownership',async()=>{
 assert.equal((await call(3,'messages.php?city=Shenyang&place=plaza')).httpStatus,403);
 const sent=await call(1,'messages.php','POST',{city:'Shenyang',place:'plaza',text:'<img src=x onerror=alert(1)> Hello'});assert.equal(sent.httpStatus,200);
 let r=await call(2,'messages.php?city=Shenyang&place=plaza');assert.equal(r.data.messages[0].player_id,'1');assert.equal(typeof r.data.messages[0].created_at,'number');assert.equal(r.data.messages[0].own,false);
 assert.equal((await call(2,'messages.php?id='+sent.data.id,'DELETE')).httpStatus,403);
 for(let i=0;i<4;i++)assert.equal((await call(1,'messages.php','POST',{...presence(),text:'Message '+i})).httpStatus,200);
 assert.equal((await call(1,'messages.php','POST',{...presence(),text:'Too fast'})).httpStatus,429);
});
test('friends, private messages, reports and blocks enforce account permissions',async()=>{
 assert.equal((await call(2,'messages.php','POST',{peer:'1',text:'Private'})).httpStatus,403);
 assert.equal((await call(1,'friends.php','POST',{peer:'2',action:'request'})).data.status,'pending');
 assert.equal((await call(1,'friends.php','POST',{peer:'2',action:'accept'})).httpStatus,403);
 assert.equal((await call(2,'friends.php','POST',{peer:'1',action:'accept'})).data.status,'accepted');
 const sent=await call(2,'messages.php','POST',{peer:'1',text:'Private hello'});assert.equal(sent.httpStatus,200);
 assert.equal((await call(1,'messages.php?peer=2')).data.messages[0].body,'Private hello');
 assert.equal((await call(1,'report.php','POST',{message:sent.data.id,reason:'spam'})).httpStatus,200);
 assert.equal((await call(3,'report.php','POST',{message:sent.data.id,reason:'spam'})).httpStatus,404);
 assert.equal((await call(1,'block.php','POST',{peer:'2',blocked:true})).httpStatus,200);
 assert.equal((await call(1,'social.php')).data.blocked[0].id,'2');assert.equal((await call(1,'presence.php?city=Shenyang')).data.players.length,0);
 assert.equal((await call(2,'messages.php?peer=1')).httpStatus,403);await call(1,'block.php','POST',{peer:'2',blocked:false});
});
test('voice capacity, session types, same-room signaling and stale sessions',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits; DELETE FROM chinalife_voice_members');for(let id=3;id<=11;id++)await call(id,'presence.php','POST',presence());
 for(let id=3;id<=10;id++){const r=await call(id,'voice.php','POST',{...presence(),session:'session-'+id,muted:true,after:0,action:'join'});assert.equal(r.httpStatus,200);assert.equal(typeof r.data.id,'string');assert.equal(typeof r.data.members[0].id,'string');assert.equal(typeof r.data.members[0].muted,'boolean')}
 {const full=await call(11,'voice.php','POST',{...presence(),session:'session-11',muted:true,after:0,action:'join'});assert.equal(full.httpStatus,409,'eight people fill a room');assert.match(full.message,/full/)}
 // Same account, second device: it takes voice over and the first device is told, so it stops instead of fighting back.
 assert.equal((await call(10,'voice.php','POST',{...presence(),session:'session-10b',muted:true,after:0,action:'join'})).httpStatus,200);
 {const moved=await call(10,'voice.php','POST',{...presence(),session:'session-10',muted:true,after:0,action:'pulse'});assert.equal(moved.httpStatus,409);assert.match(moved.message,/other device/)}
 assert.equal((await call(3,'voice-signal.php','POST',{...presence(),session:'session-3',peer:'4',peerSession:'wrong-session',payload:{type:'offer',sdp:'test'}})).httpStatus,403);
 assert.equal((await call(3,'voice-signal.php','POST',{...presence(),session:'session-3',peer:'4',peerSession:'session-4',payload:{type:'offer',sdp:'test'}})).httpStatus,200);
 let r=await call(4,'voice-signal.php?city=Shenyang&place=plaza&session=session-4&after=0');assert.equal(r.data.signals[0].sender,'3');assert.equal(r.data.signals[0].session,'session-3');
 await call(3,'voice.php','DELETE',{session:'old-session'});assert.equal((await call(3,'voice.php','POST',{...presence(),session:'session-3',muted:true,after:0,action:'pulse'})).httpStatus,200);
 sql("USE chinalife_test; UPDATE chinalife_voice_members SET seen_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE user_id=3");
 assert.equal((await call(3,'voice.php','POST',{...presence(),session:'session-3',muted:true,after:0,action:'pulse'})).httpStatus,403);
});
test('music uses Hafrik presence and queue limits',async()=>{
 await call(8,'presence.php','POST',presence('Shenyang','night'));
 for(let i=0;i<10;i++)assert.equal((await call(8,'music.php','POST',{city:'Shenyang',track:'neon'})).httpStatus,200,'request '+(i+1));
 assert.equal((await call(8,'music.php','POST',{city:'Shenyang',track:'neon'})).httpStatus,429);
 assert.equal((await call(1,'music.php?city=Shenyang')).httpStatus,403);
 sql("USE chinalife_test; UPDATE chinalife_music SET started_at=0 WHERE city='Shenyang'");
 const r=await call(8,'music.php?city=Shenyang');assert.equal(r.data.track,'neon');assert.equal(r.data.queue.length,9);
});
test('two actual game clients restore, join, chat, friend and privately message through PHP',async()=>{
 async function client(id){
  const t=harness(null),c=t.context,stored=new Map();c.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};c.HafrikSession={token:'test-'+id,user:{id,name:'User '+id}};c.URLSearchParams=URLSearchParams;c.fetch=(url,options)=>fetch(base+new URL(url).pathname+new URL(url).search,options);
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);t.game.loadSave({...game(),name:'Player '+id,place:'plaza'});await c.ChinaLifeCloud.upload();await c.ChinaLifeCloud.refresh();
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/social.js','utf8')+'})()',c);
  c.dispatchEvent(new c.CustomEvent('chinalife:cloudready'));
  return {...t,async press(action){const button=t.document.querySelector('[data-social="'+action+'"]');assert.ok(button,'Missing '+action);await button.onclick()}};
 }
 const a=await client(9),b=await client(10);await a.context.ChinaLifeCloud.refresh();assert.ok(a.context.ChinaLifeCloud.players.some(p=>p.id==='10'));
 await a.context.ChinaLifeSocial.open('venue');a.document.getElementById('chatInput').value='<img src=x onerror=alert(1)> Hello PHP';await a.document.getElementById('chatForm').onsubmit({preventDefault(){}});
 await b.context.ChinaLifeSocial.open('venue');assert.match(b.document.getElementById('socialBody').textContent,/Hello PHP/);assert.equal(b.document.getElementById('socialBody').querySelector('img'),null);
 await a.context.ChinaLifeSocial.player('10');await a.press('request');await b.context.ChinaLifeSocial.open('friends');await b.press('accept');await a.context.ChinaLifeSocial.open('messages');await a.press('direct');
 a.document.getElementById('chatInput').value='Private PHP';await a.document.getElementById('chatForm').onsubmit({preventDefault(){}});await b.context.ChinaLifeSocial.open('messages');await b.press('direct');assert.match(b.document.getElementById('socialBody').textContent,/Private PHP/);
 const beforeA=a.game.state.money,beforeB=b.game.state.money;await a.context.ChinaLifeSocial.player('10');await a.press('transfer');a.document.getElementById('transferAmount').value='50';await a.document.getElementById('transferForm').onsubmit({preventDefault(){}});await b.context.ChinaLifeCloud.syncTransfers();assert.equal(a.game.state.money,beforeA-50);assert.equal(b.game.state.money,beforeB+50);await b.context.ChinaLifeCloud.syncTransfers();assert.equal(b.game.state.money,beforeB+50);assert.equal(await b.context.ChinaLifeCloud.upload(),true);
});

test('game coin transfers conserve balances, reject overdrafts and are idempotent',async()=>{
 for(const id of [3,4]) {const existing=await call(id,'save.php');assert.equal((await call(id,'save.php','POST',{revision:existing.data.revision,save:{character:{},game:game()}})).httpStatus,200);}
 const data={peer:'4',amount:75,request_id:'transfer-test-000001'};
 assert.equal((await call(3,'transfers.php','POST',data)).httpStatus,200);
 assert.equal((await call(3,'transfers.php','POST',data)).data.duplicate,true);
 assert.equal((await call(3,'save.php')).data.save.game.money,3125);
 assert.equal((await call(4,'save.php')).data.save.game.money,3275);
 assert.equal((await call(3,'transfers.php','POST',{...data,amount:999999,request_id:'transfer-test-000002'})).httpStatus,409);
 assert.equal((await call(3,'transfers.php','POST',{...data,amount:-1})).httpStatus,400);
 assert.equal((await call(3,'transfers.php','POST',{...data,peer:'3'})).httpStatus,404);
 const saved=await call(4,'save.php');assert.equal((await call(4,'save.php','POST',{revision:saved.data.revision,save:{character:{},game:{...saved.data.save.game,transferTotal:0}}})).httpStatus,409);
 assert.equal((await call(4,'transfers.php')).data.transfers.length,1);
 const attempts=await Promise.all(['parallel-transfer-01','parallel-transfer-02'].map(request_id=>call(3,'transfers.php','POST',{peer:'4',amount:2500,request_id})));assert.deepEqual(attempts.map(r=>r.httpStatus).sort(),[200,409]);assert.equal((await call(3,'save.php')).data.save.game.money,625);
});

test('both student origins persist through Hafrik and converge into the same multiplayer venue',async()=>{
 async function studentClient(id,start){
  const t=harness(null),c=t.context,stored=new Map();c.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
  t.document.querySelector('[data-start="'+start+'"]').onclick();t.click('nextStep');t.document.querySelector('[data-role="Student"]').onclick();t.click('nextStep');t.document.getElementById('onName').oninput({target:{value:'Student '+id}});t.click('nextStep');
  c.HafrikSession={token:'test-'+id,user:{id}};c.URLSearchParams=URLSearchParams;c.fetch=(url,options)=>fetch(base+new URL(url).pathname+new URL(url).search,options);
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);
  return {...t,stored};
 }
 const [outside,inside]=await Promise.all([studentClient(5,'outside'),studentClient(6,'inside')]);
 // Arriving from abroad no longer locks players out of the shared city.
 assert.equal(outside.game.state.place,'airport');assert.equal(outside.context.ChinaLifeCloud.joined,true);assert.equal(inside.context.ChinaLifeCloud.joined,true);
 outside.game.state.place='campus';outside.game.refresh();await outside.context.ChinaLifeCloud.upload();
 await outside.context.ChinaLifeCloud.join();await Promise.all([outside.context.ChinaLifeCloud.refresh(),inside.context.ChinaLifeCloud.refresh()]);
 // Each client must see the other's heartbeat, so poll once more after both have announced themselves.
 await inside.context.ChinaLifeCloud.refresh();await outside.context.ChinaLifeCloud.refresh();

 assert.ok(outside.context.ChinaLifeCloud.players.some(p=>p.id==='6'));assert.ok(inside.context.ChinaLifeCloud.players.some(p=>p.id==='5'));
 await inside.context.ChinaLifeCloud.upload();const saved=(await call(5,'save.php')).data.save.game;assert.equal(saved.story.phase,'arrival');assert.equal(saved.student.start,'outside');
 outside.context.ChinaLifeCloud.open();await outside.click('hafrikLogout');assert.equal(outside.context.ChinaLifeCloud.signedIn,false);assert.equal(await outside.context.ChinaLifeAuth.connect({token:'test-5',user:{id:5}}),true);assert.equal(outside.game.state.student.start,'outside');assert.equal(outside.game.state.story.phase,'arrival');assert.equal(outside.document.getElementById('onboarding').open,false);
 const restarted=harness(null),c=restarted.context;c.HafrikSession={token:'test-5',user:{id:5}};c.URLSearchParams=URLSearchParams;c.fetch=(url,options)=>fetch(base+new URL(url).pathname+new URL(url).search,options);await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);assert.equal(restarted.game.state.name,'user5');assert.equal(restarted.game.state.student.start,'outside');assert.equal(restarted.document.getElementById('onboarding').open,false);
});


test('trusted game origin supports browser cookie CORS and unknown origins never get credential access',async()=>{
 const url=base+'/api/v4/chinalife/save.php',origin='https://china-life.hafrik.com';
 const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');
 const response=await fetch(url,{headers:{Origin:origin,Authorization:'Bearer test-1'}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);assert.equal(response.headers.get('access-control-allow-credentials'),'true');
 const unknown=await fetch(url,{headers:{Origin:'https://untrusted.example',Authorization:'Bearer test-1'}});assert.notEqual(unknown.headers.get('access-control-allow-credentials'),'true');assert.notEqual(unknown.headers.get('access-control-allow-origin'),'https://untrusted.example');
});


test('message notification feed delivers new venue and private messages, excludes self and blocked senders',async()=>{
 await call(9,'presence.php','POST',presence());await call(10,'presence.php','POST',presence());
 const initial=await call(9,'notifications.php?city=Shenyang&place=plaza');assert.deepEqual(initial.data.messages,[]);
 await call(10,'messages.php','POST',{city:'Shenyang',place:'plaza',text:'New venue notification'});
 await call(10,'messages.php','POST',{peer:'9',text:'New private notification'});
 const incoming=await call(9,'notifications.php?city=Shenyang&place=plaza&after='+initial.data.cursor);
 assert.equal(incoming.httpStatus,200);assert.deepEqual(incoming.data.messages.map(m=>m.channel),['venue','direct']);
 assert.ok(incoming.data.messages.every(m=>m.player_id==='10'));
 assert.equal((await call(9,'notifications.php?city=Shenyang&place=plaza&after='+incoming.data.cursor)).data.messages.length,0);
 assert.equal((await call(9,'block.php','POST',{peer:'10',blocked:true})).httpStatus,200);
 assert.equal((await call(9,'notifications.php?city=Shenyang&place=plaza&after='+initial.data.cursor)).data.messages.length,0);
});

test('voice relay credentials require an account and fall back to STUN without a TURN key',async()=>{
 assert.equal((await call(null,'ice.php')).httpStatus,401);
 const r=await call(3,'ice.php');assert.equal(r.httpStatus,200);assert.equal(r.data.turn,false);assert.deepEqual(r.data.iceServers,[{urls:['stun:stun.cloudflare.com:3478']}]);
});

test('leaderboard ranks server XP only and ignores client totals',async()=>{
 for(const id of [10,11]){const cur=(await call(id,'save.php')).data;const before=cur.save?.game?.xp??0;const r=await call(id,'save.php','POST',{revision:cur.revision||0,save:{character:{name:'x'},game:{...game(),transferTotal:cur.save?.game?.transferTotal??0,sharedXP:cur.save?.game?.sharedXP??0,xp:before+50000}}});assert.equal(r.httpStatus,200,r.message);const xp=(await call(id,'save.php')).data.save.game.xp;assert.ok(xp>=before&&xp<=before+600,'device XP is capped by real time ('+xp+')')}
 assert.equal((await call(1,'admin.php','POST',{action:'set_rank',user_id:11,rank:4,note:'Board'})).httpStatus,200);
 assert.equal((await call(1,'admin.php','POST',{action:'set_rank',user_id:10,rank:1,note:'Board'})).httpStatus,200);
 const board=await call(10,'leaderboard.php');assert.equal(board.httpStatus,200);const order=board.data.players.map(p=>p.id);assert.ok(order.indexOf('11')<order.indexOf('10'));assert.equal(board.data.players.find(p=>p.id==='11').xp,3500);assert.ok(board.data.players.find(p=>p.id==='10').own);assert.ok(board.data.position>=2);
 assert.equal((await call(null,'leaderboard.php')).httpStatus,401);
});

test('online counts players active in each city and the total number of saved players',async()=>{
 await call(12,'presence.php','POST',presence('Shenyang','plaza'));
 const r=await call(12,'online.php');assert.equal(r.httpStatus,200);assert.ok(r.data.cities.Shenyang>=1);assert.ok(r.data.online>=r.data.cities.Shenyang);assert.ok(r.data.players>=1);
 assert.equal((await call(null,'online.php')).httpStatus,401);
});

test('only admins can put money in wallets, and grants reach the saved character',async()=>{
 assert.equal((await call(2,'admin.php','POST',{action:'stats'})).httpStatus,403);
 const stats=await call(1,'admin.php','POST',{action:'stats'});assert.equal(stats.httpStatus,200);assert.ok(stats.data.players>=1);
 const found=await call(1,'admin.php','POST',{action:'search',query:'user12'});assert.equal(found.data.players[0].id,'12');
 const before=(await call(12,'save.php')).data.save.game;
 const grant=await call(1,'admin.php','POST',{action:'grant',user_id:12,amount:5000,note:'Launch gift'});assert.equal(grant.httpStatus,200);assert.equal(grant.data.balance,before.money+5000);
 const after=(await call(12,'save.php')).data.save.game;assert.equal(after.money,before.money+5000);assert.equal(after.transferTotal,(before.transferTotal||0)+5000);
 assert.equal((await call(1,'admin.php','POST',{action:'grant',user_id:12,amount:1.5})).httpStatus,400);
 assert.equal((await call(2,'admin.php','POST',{action:'grant',user_id:2,amount:999999})).httpStatus,403);
 assert.ok((await call(1,'admin.php','POST',{action:'stats'})).data.log.some(l=>l.action==='grant'&&l.note==='Launch gift'));
});

test('admin events reward each player once, only at the venue, and end on request',async()=>{
 const created=await call(1,'admin.php','POST',{action:'create_event',city:'Shenyang',title:'Afrobeats Night',body:'Dance till late',place:'blood',reward:700,hours:2,billboard:true,link:''});assert.equal(created.httpStatus,200);
 const list=await call(12,'events.php?city=Shenyang');const ev=list.data.events.find(e=>e.title==='Afrobeats Night');assert.ok(ev&&ev.billboard&&!ev.joined);assert.equal(list.data.admin,false);
 assert.equal((await call(12,'events.php','POST',{id:Number(ev.id)})).httpStatus,409);
 await call(12,'presence.php','POST',presence('Shenyang','blood'));const money=(await call(12,'save.php')).data.save.game.money;
 const joined=await call(12,'events.php','POST',{id:Number(ev.id)});assert.equal(joined.httpStatus,200);assert.equal(joined.data.reward,700);assert.equal((await call(12,'save.php')).data.save.game.money,money+700);
 assert.equal((await call(12,'events.php','POST',{id:Number(ev.id)})).httpStatus,409);
 assert.equal((await call(1,'admin.php','POST',{action:'create_event',title:'Bad',place:'nowhere',reward:1,hours:1})).httpStatus,400);
 await call(1,'admin.php','POST',{action:'end_event',id:Number(ev.id)});assert.ok(!(await call(12,'events.php?city=Shenyang')).data.events.some(e=>e.id===ev.id));
});

test('save ignores client coin and XP totals',async()=>{
 const cur=(await call(11,'save.php')).data,before=cur.save.game;
 const r=await call(11,'save.php','POST',{revision:cur.revision,save:{character:{name:'x'},game:{...before,xp:before.xp+999999,money:before.money+99999999}}});assert.equal(r.httpStatus,200);
 // Device earnings are accepted only within the real-time cap (save.php: +300 XP plus 30/min, ¥20,000 per rolling hour).
 const after=(await call(11,'save.php')).data.save.game;assert.ok(after.xp>=before.xp&&after.xp<=before.xp+600);assert.ok(after.money>=before.money&&after.money<=before.money+20000);assert.equal(r.data.money,after.money);assert.equal(r.data.xp,after.xp);
});

test('the weekly golden envelope pays only the first finder at its venue',async()=>{
 const g=await call(3,'golden.php');assert.equal(g.httpStatus,200);assert.equal(g.data.found_by,null);
 assert.equal((await call(3,'golden.php','POST',{})).httpStatus,409);
 for(const id of [3,4])await call(id,'presence.php','POST',presence('Shenyang',g.data.place));
 const money=(await call(3,'save.php')).data.save.game.money;const win=await call(3,'golden.php','POST',{});assert.equal(win.httpStatus,200);assert.equal((await call(3,'save.php')).data.save.game.money,money+50000);
 const late=await call(4,'golden.php','POST',{});assert.equal(late.httpStatus,409);assert.match(late.message,/user3/);assert.equal((await call(4,'golden.php')).data.found_by,'user3');
});

test('admins open cities and every player receives the open list',async()=>{
 // One-city mode: the admin's list is stored as given (no implied Shenyang) and cannot be empty.
 assert.deepEqual((await call(5,'events.php?city=Shenyang')).data.cities,['China','Shenyang']);
 assert.equal((await call(5,'admin.php','POST',{action:'set_cities',open:['Harbin']})).httpStatus,403);
 assert.equal((await call(1,'admin.php','POST',{action:'set_cities',open:['Atlantis']})).httpStatus,400);
 const r=await call(1,'admin.php','POST',{action:'set_cities',open:['Shenyang','Harbin']});assert.deepEqual(r.data.open,['Shenyang','Harbin']);
 assert.deepEqual((await call(5,'events.php?city=Shenyang')).data.cities,['Shenyang','Harbin']);
 assert.equal((await call(1,'admin.php','POST',{action:'set_cities',open:[]})).httpStatus,400);assert.deepEqual((await call(5,'events.php?city=Shenyang')).data.cities,['Shenyang','Harbin']);
 assert.deepEqual((await call(1,'admin.php','POST',{action:'set_cities',open:['China','Shenyang']})).data.open,['China','Shenyang']);
});

test('admins set the one-city world layout and every player receives it',async()=>{
 // migration-world-layout.sql seeds the one-city default once and never overwrites it.
 assert.deepEqual((await call(5,'events.php?city=China')).data.world_layout,{mode:'one-city',city:'China',places:['night','gist','voting','football','hq','cityhospital','university'],where_to:true,flights:false});
 assert.equal((await call(5,'admin.php','POST',{action:'set_world_layout',layout:{mode:'one-city'}})).httpStatus,403);
 assert.equal((await call(1,'admin.php','POST',{action:'set_world_layout',layout:{mode:'one-city',places:['casino']}})).httpStatus,400);
 assert.equal((await call(1,'admin.php','POST',{action:'set_world_layout',layout:{mode:'everything'}})).httpStatus,400);
 assert.equal((await call(1,'admin.php','POST',{action:'set_world_layout',layout:{mode:'one-city',npc_density:1.5}})).httpStatus,400);
 assert.equal((await call(1,'admin.php','POST',{action:'set_world_layout',layout:{mode:'one-city',npc_density:0.5}})).data.layout.npc_density,0.5);
 const r=await call(1,'admin.php','POST',{action:'set_world_layout',layout:{mode:'one-city',city:'China',places:['night','gist','hq']}});
 assert.deepEqual(r.data.layout,{mode:'one-city',city:'China',places:['night','gist','hq'],where_to:true,flights:false});
 assert.deepEqual((await call(5,'events.php?city=China')).data.world_layout.places,['night','gist','hq']);
 assert.equal((await call(1,'admin.php','POST',{action:'world_layout'})).data.layout.mode,'one-city');
 await call(1,'admin.php','POST',{action:'set_world_layout',layout:{mode:'classic'}});
 const c=(await call(5,'events.php?city=China')).data.world_layout;assert.equal(c.mode,'classic');assert.equal(c.flights,true);
 sql("USE chinalife_test; DELETE FROM chinalife_settings WHERE name='world_layout'");
});

test('daily push sends a valid VAPID-signed reminder and removes expired subscriptions',async()=>{
 const dir=path.join(tmp,'web/api/v4/chinalife');assert.equal((await call(6,'push.php')).data.enabled,false);
 execFileSync('php',[path.join(dir,'push-setup.php'),'mailto:test@example.com'],{env,stdio:'pipe'});
 const info=await call(6,'push.php');assert.equal(info.data.enabled,true);
 const hits=[];const server=http.createServer((req,res)=>{hits.push({url:req.url,auth:req.headers.authorization,ttl:req.headers.ttl});res.statusCode=req.url.includes('gone')?410:201;res.end()});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 assert.equal((await call(6,'push.php','POST',{endpoint:'https://evil.example/x'})).httpStatus,400);
 assert.equal((await call(6,'push.php','POST',{endpoint:'http://127.0.0.1:'+port+'/push/abcdefgh123'})).httpStatus,200);
 assert.equal((await call(7,'push.php','POST',{endpoint:'http://127.0.0.1:'+port+'/push/gone-abcdefgh'})).httpStatus,200);
 // Run the sender asynchronously so this process can answer as the push service.
 const run=async()=>(await promisify(execFile)('php',[path.join(dir,'push-daily.php')],{env})).stdout;const out=await run();
 assert.match(out,/sent: 1, expired removed: 1/);assert.equal(hits.length,2);
 const [, t, k]=hits[0].auth.match(/^vapid t=([^,]+), k=(.+)$/);assert.equal(k,info.data.publicKey);
 const [head,claims,sig]=t.split('.'),pub=Buffer.from(k,'base64url'),jwk={kty:'EC',crv:'P-256',x:pub.subarray(1,33).toString('base64url'),y:pub.subarray(33).toString('base64url')};
 assert.ok(crypto.verify('sha256',Buffer.from(head+'.'+claims),{key:crypto.createPublicKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')),'signature');
 assert.equal(JSON.parse(Buffer.from(claims,'base64url')).aud,'http://127.0.0.1:'+port);
 const again=await run();server.close();assert.match(again,/expired removed: 0/);
});

test('two real clients accept, meet, participate and receive shared activity rewards once',async()=>{
 for(const id of [11,12]){const r=await call(id,'save.php'),saved=r.data.save?.game||{};assert.equal((await call(id,'save.php','POST',{revision:r.data.revision,save:{character:{},game:{...game(),money:saved.money??3200,xp:saved.xp??0,transferTotal:saved.transferTotal||0,sharedXP:saved.sharedXP||0}}})).httpStatus,200);}
 async function client(id){const t=harness(null),c=t.context;c.HafrikSession={token:'test-'+id,user:{id}};c.URLSearchParams=URLSearchParams;c.fetch=(url,opts)=>fetch(base+new URL(url).pathname+new URL(url).search,opts);await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);vm.runInContext(fs.readFileSync('public/shared-activities.js','utf8'),c);await c.ChinaLifeShared.ready;return t;}
 const a=await client(11);let b=await client(12);
 await a.context.ChinaLifeShared.open('12','user12');assert.ok(a.document.querySelector('[data-kind="study"]'));await a.document.querySelector('[data-kind="study"]').onclick();
 // R1: a running game reads shared activities from the one-minute feed cache while the dialog is closed, so the invitee sees the invite on its next feed (here: a fresh load).
 b=await client(12);await b.context.ChinaLifeShared.poll();assert.equal(b.document.getElementById('sharedInviteNotice').hidden,false);await b.context.ChinaLifeShared.open();await b.document.querySelector('[data-shared="accept"]').onclick();
 let session=(await call(11,'activities.php')).data.activities[0];const id=session.id;
 const reconnect=await client(12);await reconnect.context.ChinaLifeShared.open();assert.match(reconnect.document.getElementById('sharedBody').textContent,/Both players must be present and ready/);
 assert.equal((await call(11,'activities.php','POST',{action:'ready',id})).httpStatus,409);
 assert.equal((await call(1,'activities.php','POST',{action:'accept',id})).httpStatus,404);
 for(const t of [a,b]){t.game.state.place='campus';await t.context.ChinaLifeCloud.upload();await t.context.ChinaLifeCloud.refresh();}
 for(const t of [a,b]){await t.context.ChinaLifeShared.poll();await t.document.querySelector('[data-shared="ready"]').onclick();}
 session=(await call(11,'activities.php')).data.activities[0];assert.equal(session.status,'active');
 assert.equal((await call(11,'activities.php','POST',{action:'finish',id})).httpStatus,409);
 await a.context.ChinaLifeShared.poll();await a.document.querySelector('[data-choice="nihao"]').onclick();await b.document.querySelector('[data-choice="zaijian"]').onclick();
 assert.equal((await call(11,'activities.php','POST',{action:'finish',id})).httpStatus,409);
 sql(`USE chinalife_test; UPDATE chinalife_shared_activities SET started_at=DATE_SUB(NOW(),INTERVAL 60 SECOND) WHERE id=${Number(id)}`);
 const beforeA={money:a.game.state.money,xp:a.game.state.xp},beforeB={money:b.game.state.money,xp:b.game.state.xp};
 await a.context.ChinaLifeShared.poll();await a.document.querySelector('[data-shared="finish"]').onclick();await b.context.ChinaLifeCloud.syncTransfers();
 assert.equal(a.game.state.money,beforeA.money+10);assert.equal(b.game.state.money,beforeB.money+10);assert.equal(a.game.state.xp,beforeA.xp+15);assert.equal(b.game.state.xp,beforeB.xp+15);
 assert.equal((await call(12,'activities.php','POST',{action:'finish',id})).data.duplicate,true);await b.context.ChinaLifeCloud.syncTransfers();assert.equal(b.game.state.xp,beforeB.xp+15);
 assert.equal((await call(11,'activities.php','POST',{action:'invite',kind:'study',peer:'12'})).httpStatus,409);
 assert.equal(await b.context.ChinaLifeCloud.upload(),true);
 const restart=await client(12);await restart.context.ChinaLifeShared.open();assert.match(restart.document.getElementById('sharedBody').textContent,/shared memory/);assert.equal(restart.game.state.sharedXP,15);
});

test('shared invitations decline, cancel, expire and require the invited player’s consent',async()=>{
 await call(11,'presence.php','POST',presence());await call(12,'presence.php','POST',presence());
 let r=await call(11,'activities.php','POST',{action:'invite',kind:'basketball',peer:'12'});assert.equal(r.httpStatus,200,r.message);let id=r.data.id;
 assert.equal((await call(11,'activities.php','POST',{action:'accept',id})).httpStatus,403);
 assert.equal((await call(12,'activities.php','POST',{action:'decline',id})).httpStatus,200);
 r=await call(11,'activities.php','POST',{action:'invite',kind:'meal',peer:'12'});id=r.data.id;
 assert.equal((await call(12,'activities.php','POST',{action:'accept',id})).httpStatus,200);assert.equal((await call(11,'activities.php','POST',{action:'cancel',id})).httpStatus,200);
 r=await call(11,'activities.php','POST',{action:'invite',kind:'basketball',peer:'12'});id=r.data.id;sql(`USE chinalife_test; UPDATE chinalife_shared_activities SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=${Number(id)}`);
 assert.equal((await call(12,'activities.php','POST',{action:'accept',id})).httpStatus,409);
 assert.equal((await call(11,'activities.php','POST',{action:'invite',kind:'fake',peer:'12'})).httpStatus,400);
});


test('basketball and meal complete with separate daily limits and persisted shared memories',async()=>{
 for(const [kind,place,choice] of [['basketball','gym','pass'],['meal','african','mild']]){
  for(const uid of [11,12])await call(uid,'presence.php','POST',presence('Shenyang',place));
  const invite=await call(11,'activities.php','POST',{action:'invite',kind,peer:'12'});assert.equal(invite.httpStatus,200);const id=invite.data.id;
  assert.equal((await call(12,'activities.php','POST',{action:'accept',id})).httpStatus,200);
  for(const uid of [11,12])assert.equal((await call(uid,'activities.php','POST',{action:'ready',id})).httpStatus,200);
  for(const uid of [11,12])assert.equal((await call(uid,'activities.php','POST',{action:'choose',id,choice})).httpStatus,200);
  sql(`USE chinalife_test; UPDATE chinalife_shared_activities SET started_at=DATE_SUB(NOW(),INTERVAL 60 SECOND) WHERE id=${Number(id)}`);
  // Moving away prevents a reward, even after the activity timer ends.
  await call(12,'presence.php','POST',presence('Shenyang','plaza'));assert.equal((await call(11,'activities.php','POST',{action:'finish',id})).httpStatus,409);
  await call(12,'presence.php','POST',presence('Shenyang',place));const completed=await Promise.all([call(11,'activities.php','POST',{action:'finish',id}),call(12,'activities.php','POST',{action:'finish',id})]);assert.ok(completed.every(r=>r.httpStatus===200));assert.equal(completed.filter(r=>r.data.duplicate).length,1);
  assert.equal((await call(12,'activities.php','POST',{action:'finish',id})).data.duplicate,true);
 }
 const list=(await call(11,'activities.php')).data.activities;assert.equal(list.filter(s=>s.status==='completed').length,3);assert.equal(Number(list[0].memories),3);
 assert.equal((await call(12,'save.php')).data.save.game.sharedXP,40);
 const saved=await call(12,'save.php');assert.equal((await call(12,'save.php','POST',{revision:saved.data.revision,save:{character:{},game:{...saved.data.save.game,sharedXP:999}}})).httpStatus,409);
});

test('relationships require consent, survive reconnect and can be ended by either partner',async()=>{
 sql("USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,'$.gender',IF(user_id=11,'male','female')) WHERE user_id IN (11,12)");
 for(const id of [11,12])await call(id,'presence.php','POST',presence());
 const before=(await call(11,'save.php')).data.save.game;
 let r=await call(11,'activities.php','POST',{action:'invite',kind:'girlfriend',peer:'12'});assert.equal(r.httpStatus,200);let id=r.data.id;
 assert.equal((await call(11,'activities.php','POST',{action:'accept',id})).httpStatus,403);
 assert.equal((await call(12,'activities.php','POST',{action:'decline',id})).httpStatus,200);
 assert.equal((await call(11,'activities.php')).data.relationships.length,0);
 r=await call(11,'activities.php','POST',{action:'invite',kind:'girlfriend',peer:'12'});id=r.data.id;
 assert.equal((await call(12,'activities.php','POST',{action:'accept',id})).httpStatus,200);
 for(const who of [11,12])assert.equal((await call(who,'activities.php')).data.relationships[0].id,id);
 sql(`USE chinalife_test; UPDATE chinalife_shared_activities SET expires_at=DATE_SUB(NOW(),INTERVAL 2 DAY),completed_at=DATE_SUB(NOW(),INTERVAL 2 DAY) WHERE id=${Number(id)}`);
 assert.equal((await call(12,'activities.php')).data.relationships.length,1);
 assert.equal((await call(1,'activities.php','POST',{action:'end-relationship',id})).httpStatus,404);
 assert.equal((await call(11,'activities.php','POST',{action:'invite',kind:'girlfriend',peer:'12'})).httpStatus,409);
 const after=(await call(11,'save.php')).data.save.game;assert.equal(after.money,before.money);assert.equal(after.xp,before.xp);
 assert.equal((await call(12,'activities.php','POST',{action:'end-relationship',id})).httpStatus,200);
 assert.equal((await call(11,'activities.php')).data.relationships.length,0);
});
test('date, both restaurant dinners and every club invitation use consent and venue participation',async()=>{
 const catalog=(await call(11,'activities.php')).data.catalog;
 for(const kind of ['date',...Object.keys(catalog).filter(k=>k.startsWith('dinner-')||k.startsWith('club-'))]){
  sql("USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12)");const spec=catalog[kind];for(const who of [11,12])assert.equal((await call(who,'presence.php','POST',presence('Shenyang',spec.place))).httpStatus,200);
  const invited=await call(11,'activities.php','POST',{action:'invite',kind,peer:'12'});assert.equal(invited.httpStatus,200,kind);const id=invited.data.id;
  assert.equal((await call(12,'activities.php','POST',{action:'accept',id})).httpStatus,200);
  for(const who of [11,12])assert.equal((await call(who,'activities.php','POST',{action:'ready',id})).httpStatus,200);
  for(const who of [11,12])assert.equal((await call(who,'activities.php','POST',{action:'choose',id,choice:Object.keys(spec.choices)[0]})).httpStatus,200);
  sql(`USE chinalife_test; UPDATE chinalife_shared_activities SET started_at=DATE_SUB(NOW(),INTERVAL 60 SECOND) WHERE id=${Number(id)}`);
  assert.equal((await call(11,'activities.php','POST',{action:'finish',id})).httpStatus,200);
 }
 sql("USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12)");for(const place of harness().game.universityIds)assert.equal((await call(11,'presence.php','POST',presence('Shenyang',place))).httpStatus,200,place);
});

test('two game clients send a partner request, accept it, reconnect and end it by blocking',async()=>{
 sql("USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12)");
 async function client(id){const t=harness(null),c=t.context;c.HafrikSession={token:'test-'+id,user:{id}};c.URLSearchParams=URLSearchParams;c.fetch=(url,opts)=>fetch(base+new URL(url).pathname+new URL(url).search,opts);await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);vm.runInContext(fs.readFileSync('public/shared-activities.js','utf8'),c);await c.ChinaLifeShared.ready;return t;}
 const a=await client(11);let b=await client(12);await a.context.ChinaLifeShared.open('12','user12','girlfriend');assert.equal(a.document.querySelectorAll('[data-kind]').length,1);await a.document.querySelector('[data-kind="girlfriend"]').onclick();
 // R1 feed cache: the invitee's game shows the request on its next feed (here: a fresh load).
 b=await client(12);await b.context.ChinaLifeShared.poll();assert.equal(b.document.getElementById('sharedInviteNotice').hidden,false);await b.context.ChinaLifeShared.open();await b.document.querySelector('[data-shared="accept"]').onclick();assert.match(b.document.getElementById('sharedBody').textContent,/Partner: user11/);
 const restarted=await client(11);await restarted.context.ChinaLifeShared.open();assert.match(restarted.document.getElementById('sharedBody').textContent,/Partner: user12/);assert.ok(restarted.document.querySelector('[data-shared="end-relationship"]'));
 assert.equal((await call(12,'block.php','POST',{peer:'11',blocked:true})).httpStatus,200);for(const id of [11,12])assert.equal((await call(id,'activities.php')).data.relationships.length,0);
 await call(12,'block.php','POST',{peer:'11',blocked:false});
});

test('admin browses saved players without search and ordinary accounts cannot access the list',async()=>{const r=await call(1,'admin.php','POST',{action:'players'});assert.equal(r.httpStatus,200);assert.ok(r.data.players.length>1);assert.ok(r.data.total>=r.data.players.length);assert.equal((await call(11,'admin.php','POST',{action:'players'})).httpStatus,403)});
test('partner title follows saved gender and server rejects incompatible romantic requests',async()=>{sql("USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12)");for(const id of [11,12])await call(id,'presence.php','POST',presence());assert.equal((await call(11,'activities.php','POST',{action:'invite',kind:'boyfriend',peer:'12'})).httpStatus,409);sql("USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,'$.gender','male') WHERE user_id=12");assert.equal((await call(11,'activities.php','POST',{action:'invite',kind:'date',peer:'12'})).httpStatus,409);sql("USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,'$.gender','female') WHERE user_id=12");const r=await call(12,'activities.php','POST',{action:'invite',kind:'boyfriend',peer:'11'});assert.equal(r.httpStatus,200);await call(11,'activities.php','POST',{action:'decline',id:r.data.id})});
test('hidden fortunes award server-configured money once and rich public profiles persist',async()=>{
 sql("USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id=11");assert.equal((await call(11,'fortune.php','POST',{id:'city-founder',reward:999999999})).httpStatus,409);
 sql("USE chinalife_test; UPDATE chinalife_saves SET updated_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE user_id=11");const current=await call(11,'save.php');const g=current.data.save.game;Object.assign(g,{gender:'male',ownedHomes:['home-mansion','home-nanhu'],activeHome:'home-mansion',propertyPortfolio:{Shenyang:['apartment','penthouse']},properties:{Shenyang:'penthouse'},upgrades:['piano','safe'],visited:['campus','business','market','university','mall','station'],stats:{activities:120,shifts:25},skills:{...g.skills,Creativity:6,Digital:6,Social:6,Network:6},business:{level:3,orders:40,revenue:10000,lastOrder:1}});
 assert.equal((await call(11,'save.php','POST',{revision:current.data.revision,save:{character:{},game:g}})).httpStatus,200);
 assert.equal((await call(1,'admin.php','POST',{action:'set_rank',user_id:11,rank:6,note:'Fortune unlock'})).httpStatus,200);
 const beforeClaims=(await call(11,'save.php')).data.save.game.money;
 const list=await call(11,'fortune.php');assert.ok(list.data.opportunities.every(o=>o.ready));for(const [id,reward] of [['creator-breakthrough',250000],['community-contract',1000000],['city-founder',2500000]]){const r=await call(11,'fortune.php','POST',{id,reward:1});assert.equal(r.httpStatus,200);assert.equal(r.data.reward,reward);assert.equal((await call(11,'fortune.php','POST',{id})).data.duplicate,true)}
 const loaded=await call(11,'save.php');assert.equal(loaded.data.save.game.money,beforeClaims+3750000);assert.equal(loaded.data.save.game.activeHome,'home-mansion');assert.ok((await call(11,'fortune.php')).data.opportunities.every(o=>o.claimed));const profile=(await call(12,'profile.php?peer=11')).data.profile;assert.equal(profile.wealth,'💎 Millionaire');assert.equal(profile.netWorth,null,'other players never see net worth');assert.ok((await call(11,'profile.php')).data.profile.netWorth>1000000,'own net worth is visible');assert.equal(profile.homes.length,4);assert.deepEqual(profile.items,['piano','safe']);assert.equal(profile.game,undefined);assert.equal((await call(null,'profile.php?peer=11')).httpStatus,401);
 for(const id of ['home-campus','home-nanhu','home-hunnan','home-river','home-mansion'])assert.equal((await call(11,'presence.php','POST',presence('Shenyang',id))).httpStatus,200);
});
test('hafrik and horlaarsman have admin access alongside configured additional admins',async()=>{sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(13,'hafrik'),(14,'horlaarsman')");for(const id of [13,14]){assert.equal((await call(id,'admin.php','POST',{action:'stats'})).httpStatus,200);assert.equal((await call(id,'admin.php','POST',{action:'players'})).httpStatus,200)}assert.equal((await call(12,'admin.php','POST',{action:'stats'})).httpStatus,403)});

test('players can report other players and admins see the reports with a running count',async()=>{
 assert.equal((await call(4,'report.php','POST',{peer:5,reason:'nonsense'})).httpStatus,400);
 assert.ok((await call(4,'report.php','POST',{peer:4,reason:'scam'})).httpStatus>=400,'cannot report yourself');
 assert.equal((await call(4,'report.php','POST',{peer:5,reason:'scam',note:'Asked for money outside the game'})).httpStatus,200);
 assert.equal((await call(6,'report.php','POST',{peer:5,reason:'harassment'})).httpStatus,200);
 assert.equal((await call(4,'report.php','POST',{peer:5,reason:'scam',note:'Again'})).httpStatus,200);
 assert.equal((await call(4,'admin.php','POST',{action:'reports'})).httpStatus,403);
 const reports=(await call(1,'admin.php','POST',{action:'reports'})).data.playerReports.filter(r=>r.player==='user5');
 assert.equal(reports.length,2);assert.ok(reports.every(r=>+r.total===2));assert.equal(reports.find(r=>r.reason==='scam').note,'Again');
});
test('studio contract catalogue is account-authenticated, read-only and configured on the server',async()=>{const r=await call(1,'studio.php');assert.equal(r.httpStatus,200);assert.equal(r.data.catalog.clients.length,3);assert.equal(r.data.catalog.clients[0].fee,420);assert.equal(r.data.catalog.styles.polished.rating,5);assert.equal((await call(null,'studio.php')).httpStatus,401);assert.equal((await call(1,'studio.php','POST',{fee:9999999})).httpStatus,405)});
test('account save retains an accepted studio deadline, review and repeat-client progress',async()=>{const current=await call(11,'save.php');const g=current.data.save.game;g.business={level:2,orders:5,revenue:2400,lastOrder:1,activeContract:{client:'student-founders',acceptedDay:1,dueDay:3,fee:980},clientHistory:[{client:'campus-society',day:1,rating:4,pay:420}],clientTrust:{'campus-society':2}};assert.equal((await call(11,'save.php','POST',{revision:current.data.revision,save:{character:{},game:g}})).httpStatus,200);const restored=(await call(11,'save.php')).data.save.game;assert.equal(restored.business.activeContract.dueDay,3);assert.equal(restored.business.clientHistory[0].rating,4);assert.equal(restored.business.clientTrust['campus-society'],2)});

test('two owners have separate starter and purchased home presence, chat and voice rooms',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12)');
 for(const place of ['home','home-campus','home-nanhu','home-hunnan','home-river','home-mansion']){
  for(const id of [11,12])assert.equal((await call(id,'presence.php','POST',presence('Shenyang',place))).httpStatus,200);
  for(const id of [11,12]){const r=await call(id,'presence.php?city=Shenyang&place='+place);assert.equal(r.httpStatus,200);assert.ok(!r.data.players.some(p=>p.id===String(id===11?12:11)&&p.place!=='private-home'));const other=r.data.players.find(p=>p.id===String(id===11?12:11));assert.equal(other?.place,'private-home','others at home show as online without their home');assert.equal(other.x,0);}
 }
 const room={city:'Shenyang',place:'home-mansion'};
 assert.equal((await call(11,'messages.php','POST',{...room,text:'Private mansion message'})).httpStatus,200);
 assert.ok((await call(11,'messages.php?city=Shenyang&place=home-mansion')).data.messages.some(m=>m.body==='Private mansion message'));
 assert.ok(!(await call(12,'messages.php?city=Shenyang&place=home-mansion')).data.messages.some(m=>m.body==='Private mansion message'));
 for(const id of [11,12]){const r=await call(id,'voice.php','POST',{...room,action:'join',session:'private-home-'+id,muted:false,after:0});assert.equal(r.httpStatus,200);assert.deepEqual(r.data.members.map(m=>m.id),[String(id)]);}
 assert.equal((await call(11,'voice-signal.php','POST',{...room,session:'private-home-11',peer:'12',peerSession:'private-home-12',payload:{type:'offer',sdp:'test'}})).httpStatus,403);
 assert.ok(!(await call(12,'notifications.php?city=Shenyang&place=home-mansion&after=0')).data.messages.some(m=>m.body==='Private mansion message'));
 assert.equal((await call(12,'presence.php','POST',presence('Shenyang','home-mansion@11'))).httpStatus,400);
 assert.equal((await call(12,'messages.php?city=Shenyang&place=home-mansion%4011')).httpStatus,400);
 for(const id of [11,12])await call(id,'presence.php','POST',presence());
 assert.ok((await call(11,'presence.php?city=Shenyang&place=plaza')).data.players.some(p=>p.id==='12'));
 assert.ok((await call(12,'presence.php?city=Shenyang&place=plaza')).data.players.some(p=>p.id==='11'));
 const saved=await call(11,'save.php');saved.data.save.game.place='home-mansion';assert.equal((await call(11,'save.php','POST',{revision:saved.data.revision,save:saved.data.save})).httpStatus,200);
 const reconnected=await call(11,'save.php');assert.equal(reconnected.data.save.game.place,'home-mansion');assert.equal(reconnected.data.save.game.activeHome,'home-mansion');
 assert.equal((await call(11,'presence.php','POST',presence('Shenyang',reconnected.data.save.game.place))).httpStatus,200);
 assert.equal((await call(12,'presence.php?city=Shenyang&place=plaza')).data.players.find(p=>p.id==='11')?.place,'private-home');
});

test('private home invitations require mutual friendship, acceptance and owner permission',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12); INSERT INTO chinalife_friends(first_id,second_id,requested_by,status,created_at) VALUES(11,12,11,"accepted",NOW()) ON DUPLICATE KEY UPDATE status="accepted"');
 const room={city:'Shenyang',place:'home-mansion'};await call(11,'presence.php','POST',presence('Shenyang',room.place));await call(12,'presence.php','POST',presence('Shenyang',room.place));
 assert.equal((await call(12,'presence.php','POST',{...presence('Shenyang',room.place),homeOwner:'11'})).httpStatus,403);
 assert.equal((await call(11,'home-visits.php','POST',{action:'invite',peer:'13',...room})).httpStatus,403);
 const invited=await call(11,'home-visits.php','POST',{action:'invite',peer:'12',...room});assert.equal(invited.httpStatus,200);const id=invited.data.id;
 assert.equal((await call(11,'home-visits.php','POST',{action:'accept',id})).httpStatus,403);
 const accepted=await call(12,'home-visits.php','POST',{action:'accept',id});assert.equal(accepted.httpStatus,200);assert.equal(accepted.data.visit.home.properties.Shenyang,'penthouse');assert.ok(accepted.data.visit.home.upgrades.includes('piano'));
 assert.equal((await call(12,'presence.php','POST',{...presence('Shenyang',room.place),homeOwner:'11'})).httpStatus,200);
 const peers=(await call(11,'presence.php?city=Shenyang')).data.players;assert.ok(peers.some(p=>p.id==='12'&&p.homeOwner==='11'));
 assert.ok((await call(12,'presence.php?city=Shenyang&homeOwner=11')).data.players.some(p=>p.id==='11'));
 assert.equal((await call(12,'messages.php','POST',{...room,homeOwner:'11',text:'Invited guest here'})).httpStatus,200);assert.ok((await call(11,'messages.php?city=Shenyang&place=home-mansion')).data.messages.some(m=>m.body==='Invited guest here'));
 for(const uid of [11,12])assert.equal((await call(uid,'voice.php','POST',{...room,homeOwner:'11',session:'home-visit-'+uid,action:'join',muted:false,after:0})).httpStatus,200);
 assert.equal((await call(11,'voice.php','POST',{...room,session:'home-visit-11',action:'pulse',muted:false,after:0})).data.members.length,2);
 assert.equal((await call(12,'home-visits.php','POST',{action:'revoke',id})).httpStatus,403);
 assert.equal((await call(11,'home-visits.php','POST',{action:'revoke',id})).httpStatus,200);
 assert.equal((await call(12,'messages.php?city=Shenyang&place=home-mansion&homeOwner=11')).httpStatus,403);
 assert.equal((await call(12,'presence.php','POST',{...presence('Shenyang',room.place),homeOwner:'11'})).httpStatus,403);
 assert.equal((await call(11,'voice.php','POST',{...room,session:'home-visit-11',action:'pulse',muted:false,after:0})).data.members.length,1);
});

test('expired home invitations cannot reconnect even if previously accepted',async()=>{
 sql('USE chinalife_test; INSERT INTO chinalife_home_visits(owner_id,guest_id,city,place,status,expires_at) VALUES(11,12,"Shenyang","home","accepted",DATE_SUB(NOW(),INTERVAL 1 SECOND))');
 assert.equal((await call(12,'presence.php','POST',{...presence('Shenyang','home'),homeOwner:'11'})).httpStatus,403);
 assert.equal((await call(12,'voice.php','POST',{city:'Shenyang',place:'home',homeOwner:'11',session:'expired-home-12',action:'join',muted:false,after:0})).httpStatus,403);
});

test('sparring challenges respect the target player setting, friendship and a one-day cool-down after a decline',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12,13); UPDATE chinalife_shared_activities SET status="cancelled" WHERE status IN ("pending","accepted","active"); INSERT INTO chinalife_friends(first_id,second_id,requested_by,status,created_at) VALUES(11,12,11,"accepted",NOW()) ON DUPLICATE KEY UPDATE status="accepted"; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,"$.sparFrom","off") WHERE user_id=12');
 for(const id of [11,12])await call(id,'presence.php','POST',presence('Shenyang','gym'));
 assert.equal((await call(11,'activities.php','POST',{action:'invite',peer:'12',kind:'spar'})).httpStatus,403,'challenges switched off');
 assert.equal((await call(11,'activities.php','POST',{action:'invite',peer:'13',kind:'spar'})).httpStatus,403,'strangers need the target to allow everyone');
 sql('USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,"$.sparFrom","friends") WHERE user_id=12');
 const invited=await call(11,'activities.php','POST',{action:'invite',peer:'12',kind:'spar'});assert.equal(invited.httpStatus,200);
 assert.equal((await call(12,'activities.php','POST',{action:'decline',id:invited.data.id})).httpStatus,200);
 assert.equal((await call(11,'activities.php','POST',{action:'invite',peer:'12',kind:'spar'})).httpStatus,429,'no repeat challenge after a decline');
 assert.ok((await call(11,'activities.php')).data.catalog.spar.money===0,'sparring never moves money');
});

test('admins edit the rank ladder, set a player rank with an audit log, award badges and suspend rank privileges',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,5,11)');
 const ladder=[{xp:0,name:'Fresh',icon:'🌱',reward:0},{xp:100,name:'Known',icon:'⭐',reward:250},{xp:900,name:'Boss',icon:'👑',reward:2000}];
 assert.equal((await call(5,'admin.php','POST',{action:'set_ranks',ranks:ladder})).httpStatus,403,'players cannot edit ranks');
 assert.equal((await call(1,'admin.php','POST',{action:'set_ranks',ranks:[{xp:5,name:'Bad',icon:'x',reward:0},{xp:1,name:'Worse',icon:'y',reward:0}]})).httpStatus,400);
 assert.equal((await call(1,'admin.php','POST',{action:'set_ranks',ranks:ladder})).httpStatus,200);
 assert.deepEqual((await call(11,'events.php?city=Shenyang')).data.ranks.map(r=>r.name),['Fresh','Known','Boss'],'every player receives the ladder');
 assert.equal((await call(1,'admin.php','POST',{action:'set_rank',user_id:11,rank:2})).httpStatus,400,'a reason is required');
 assert.equal((await call(1,'admin.php','POST',{action:'set_rank',user_id:11,rank:2,note:'Festival winner'})).httpStatus,200);
 assert.equal((await call(11,'save.php')).data.save.game.xp,900);
 assert.equal((await call(1,'admin.php','POST',{action:'award_badge',user_id:11,icon:'🏮',name:'Lantern Festival 2026'})).httpStatus,200);
 assert.deepEqual((await call(12,'profile.php?peer=11')).data.profile.badges.map(b=>b.name),['Lantern Festival 2026']);
 assert.equal((await call(1,'admin.php','POST',{action:'suspend_rank',user_id:11,days:3})).httpStatus,400,'a reason is required to suspend');
 assert.equal((await call(1,'admin.php','POST',{action:'suspend_rank',user_id:11,days:3,note:'Exploit abuse'})).httpStatus,200);
 const me=(await call(11,'events.php?city=Shenyang')).data.me;assert.ok(me.rankSuspendedUntil>Date.now());assert.equal(me.rankSuspendedReason,'Exploit abuse');
 assert.ok(!(await call(12,'leaderboard.php')).data.players.some(p=>p.id==='11'),'suspended players leave the leaderboard');
 await call(1,'admin.php','POST',{action:'suspend_rank',user_id:11,days:0});assert.equal((await call(11,'events.php?city=Shenyang')).data.me.rankSuspendedUntil,null);
 const log=(await call(1,'admin.php','POST',{action:'ranks'})).data.log;assert.deepEqual(log.slice(0,5).map(l=>l.action),['suspend_rank','suspend_rank','award_badge','set_rank','set_ranks']);assert.match(log[3].note,/Festival winner/);
 assert.equal((await call(11,'events.php?city=Shenyang')).data.admin,false,'top rank never grants admin');
 sql("USE chinalife_test; DELETE FROM chinalife_settings WHERE name='ranks'");
});

test('Hafrik HQ applications are private to the player and reviewed by admins',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,5,11,12)');
 const list=await call(11,'applications.php');assert.equal(list.httpStatus,200);assert.ok(list.data.services.visa);
 assert.equal((await call(11,'applications.php','POST',{service:'spaceship',name:'A',contact:'+8612345678'})).httpStatus,400);
 assert.equal((await call(11,'applications.php','POST',{service:'visa',name:'Ada',contact:''})).httpStatus,400,'a contact is required');
 const sent=await call(11,'applications.php','POST',{service:'visa',name:'Ada',contact:'wa +8613800000000',city:'Shenyang',message:'Residence permit renewal'});assert.equal(sent.httpStatus,200);
 assert.equal((await call(11,'applications.php','POST',{service:'visa',name:'Ada',contact:'wa +8613800000000'})).httpStatus,409,'one open application per service');
 assert.equal((await call(12,'applications.php')).data.applications.length,0,'others never see it');
 assert.equal((await call(5,'admin.php','POST',{action:'applications'})).httpStatus,403);
 const pending=(await call(1,'admin.php','POST',{action:'applications',status:'pending'})).data;assert.ok(pending.applications.some(a=>a.id===sent.data.id&&a.contact.includes('8613800000000')));
 assert.equal((await call(1,'admin.php','POST',{action:'set_application',id:Number(sent.data.id),status:'approved',note:'We will call you tomorrow'})).httpStatus,200);
 const mine=(await call(11,'applications.php')).data.applications.find(a=>a.id===sent.data.id);assert.equal(mine.status,'approved');assert.equal(mine.admin_note,'We will call you tomorrow');
});

test('admins add partner restaurants with menus and order links, and players in that city receive them',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,5,11)');
 const r={city:'Shenyang',name:'Lanzhou Noodle House',icon:'🍜',district:'Heping',menu:[['Beef noodles',28],['Dumplings',22]],whatsapp:'+86 189 4014 7438',wechat_id:'noodle_house88',order_link:'https://u.wechat.com/abc123'};
 assert.equal((await call(5,'admin.php','POST',{action:'save_restaurant',...r})).httpStatus,403);
 assert.equal((await call(1,'admin.php','POST',{action:'save_restaurant',...r,order_link:'javascript:alert(1)'})).httpStatus,400,'only https or weixin links');
 assert.equal((await call(1,'admin.php','POST',{action:'save_restaurant',...r,order_link:'',wechat_id:'',whatsapp:''})).httpStatus,400,'needs a way to order');
 const saved=await call(1,'admin.php','POST',{action:'save_restaurant',...r});assert.equal(saved.httpStatus,200);
 const got=(await call(11,'events.php?city=Shenyang')).data.restaurants.find(x=>x.id===saved.data.id);assert.equal(got.whatsapp,'8618940147438');assert.deepEqual(got.menu.map(m=>m[0]),['Beef noodles','Dumplings']);
 assert.ok(!(await call(11,'events.php?city=Guangzhou')).data.restaurants.some(x=>x.id===saved.data.id),'only in its own city');
 await call(1,'admin.php','POST',{action:'save_restaurant',...r,id:Number(saved.data.id),active:false});assert.ok(!(await call(11,'events.php?city=Shenyang')).data.restaurants.some(x=>x.id===saved.data.id),'hidden restaurants are not shown');
 assert.equal((await call(1,'admin.php','POST',{action:'save_restaurant',...r,id:Number(saved.data.id),near:'home'})).httpStatus,400,'never inside a private home');
 assert.equal((await call(1,'admin.php','POST',{action:'save_restaurant',...r,id:Number(saved.data.id),near:'not-a-place'})).httpStatus,400);
 assert.equal((await call(1,'admin.php','POST',{action:'save_restaurant',...r,id:Number(saved.data.id),active:true,near:'market'})).httpStatus,200);
 assert.equal((await call(11,'events.php?city=Shenyang')).data.restaurants.find(x=>x.id===saved.data.id).near,'market','shown on the map next to the chosen place');
 await call(1,'admin.php','POST',{action:'save_restaurant',...r,id:Number(saved.data.id)});assert.equal((await call(1,'admin.php','POST',{action:'restaurants',city:'Shenyang'})).data.restaurants.find(x=>x.id===saved.data.id).near,'market','kept when the form does not send it');
 assert.equal((await call(1,'admin.php','POST',{action:'delete_restaurant',id:Number(saved.data.id)})).httpStatus,200);
});
test('quick phrases reach players in the same venue only, from a fixed list, and blocked players never see them',async()=>{
 for(const id of [1,2,3])assert.equal((await call(id,'presence.php','POST',presence('Shenyang','cafe'))).httpStatus,200);
 {const x=await call(1,'gestures.php','POST',{city:'Shenyang',place:'cafe',to:'2',phrase:'free text'});assert.equal(x.httpStatus,400,JSON.stringify(x))}
 assert.equal((await call(1,'gestures.php','POST',{city:'Shenyang',place:'cafe',to:'1',phrase:'hello'})).httpStatus,404);
 const sent=await call(1,'gestures.php','POST',{city:'Shenyang',place:'cafe',to:'2',phrase:'hello'});assert.equal(sent.httpStatus,200,JSON.stringify(sent));
 let r=await call(2,'presence.php?city=Shenyang');const g=r.data.gestures.find(x=>x.id===sent.data.id);assert.ok(g);assert.equal(g.sender,'1');assert.equal(g.target,'2');assert.equal(g.phrase,'hello');
 r=await call(3,'presence.php?city=Shenyang');assert.ok(r.data.gestures.some(x=>x.id===sent.data.id),'everyone in the room sees the bubble');
 await call(3,'presence.php','POST',presence('Shenyang','gym'));r=await call(3,'presence.php?city=Shenyang');assert.equal(r.data.gestures.some(x=>x.id===sent.data.id),false);
 assert.equal((await call(1,'gestures.php','POST',{city:'Shenyang',place:'cafe',to:'3',phrase:'hello'})).httpStatus,404);
 sql("USE chinalife_test; INSERT INTO chinalife_blocks(owner_id,peer_id) VALUES(2,1)");r=await call(2,'presence.php?city=Shenyang');assert.equal(r.data.gestures.some(x=>x.sender==='1'),false);
 assert.equal((await call(1,'gestures.php','POST',{city:'Shenyang',place:'cafe',to:'2',phrase:'mic'})).httpStatus,403);
 sql("USE chinalife_test; DELETE FROM chinalife_blocks WHERE owner_id=2 AND peer_id=1");
});
test('presence shares what each player is doing from a fixed list and how long they have been at their venue',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (7,8)');
 assert.equal((await call(7,'presence.php','POST',{...presence('Shenyang','night'),activity:'dance'})).httpStatus,200);
 assert.equal((await call(8,'presence.php','POST',{...presence('Shenyang','cafe'),activity:'<script>'})).httpStatus,200);
 let r=await call(8,'presence.php?city=Shenyang');const seven=r.data.players.find(p=>p.id==='7');assert.equal(seven.activity,'dance');assert.ok(Math.abs(seven.since-Date.now())<120000);
 r=await call(7,'presence.php?city=Shenyang');assert.equal(r.data.players.find(p=>p.id==='8').activity,'idle','unknown activities are never passed on');
 sql("USE chinalife_test; UPDATE chinalife_presence SET arrived_at=DATE_SUB(NOW(),INTERVAL 10 MINUTE) WHERE user_id=7");
 await call(7,'presence.php','POST',{...presence('Shenyang','night'),activity:'eat'});r=await call(8,'presence.php?city=Shenyang');assert.ok(Date.now()-r.data.players.find(p=>p.id==='7').since>500000,'staying keeps the arrival time');
 await call(7,'presence.php','POST',{...presence('Shenyang','gym'),activity:'sport'});r=await call(8,'presence.php?city=Shenyang');assert.ok(Date.now()-r.data.players.find(p=>p.id==='7').since<120000,'moving resets it');
});
test('the chats list gets the latest private message with each friend for previews',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (9,10); DELETE FROM chinalife_blocks WHERE owner_id IN (9,10) OR peer_id IN (9,10); DELETE FROM chinalife_friends WHERE first_id IN (9,10) OR second_id IN (9,10); DELETE FROM chinalife_messages WHERE sender_id IN (9,10) AND recipient_id IN (9,10)');
 await call(9,'friends.php','POST',{peer:'10',action:'request'});await call(10,'friends.php','POST',{peer:'9',action:'accept'});
 let f=(await call(9,'social.php')).data.friends.find(x=>x.id==='10');assert.equal(f.last,null);
 await call(9,'messages.php','POST',{peer:'10',text:'Hi there'});await call(10,'messages.php','POST',{peer:'9',text:'Hello! Where are you?'});
 f=(await call(9,'social.php')).data.friends.find(x=>x.id==='10');assert.equal(f.last.body,'Hello! Where are you?');assert.equal(f.last.own,false);assert.ok(f.last.at>0);
 assert.equal((await call(10,'social.php')).data.friends.find(x=>x.id==='9').last.own,true);
});
// A real PNG of the given size (solid colour) for banner uploads.
function png(w,h,noise=false){const crcTable=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
 const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c])};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;const raw=Buffer.concat(Array.from({length:h},()=>{const row=noise?crypto.randomBytes(1+w*3):Buffer.alloc(1+w*3,0xcc);row[0]=0;return row}));
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]).toString('base64')}
test('admins upload a paid banner for 007 Club; players in the city get it and the image is served publicly',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,5,11)');
 const ad={action:'save_ad',title:'Lagos Grill opening night',sponsor:'Lagos Grill',city:'Shenyang',place:'night',link:'https://example.com/lagos',days:14,active:true,image:png(640,320)};
 assert.equal((await call(5,'admin.php','POST',ad)).httpStatus,403,'admins only');
 assert.equal((await call(1,'admin.php','POST',{...ad,image:'data:image/png;base64,'+Buffer.from('<?php echo 1;').toString('base64')})).httpStatus,400,'not an image');
 assert.equal((await call(1,'admin.php','POST',{...ad,image:png(50,50)})).httpStatus,400,'too small');
 assert.equal((await call(1,'admin.php','POST',{...ad,place:'home'})).httpStatus,400,'never in a private home');
 assert.equal((await call(1,'admin.php','POST',{...ad,link:'javascript:alert(1)'})).httpStatus,400);
 const saved=await call(1,'admin.php','POST',ad);assert.equal(saved.httpStatus,200,JSON.stringify(saved));
 let got=(await call(11,'events.php?city=Shenyang')).data.ads.find(a=>a.id===saved.data.id);assert.equal(got.place,'night');assert.equal(got.width,640);assert.equal(got.height,320);assert.equal(got.image,undefined,'the list never carries image bytes');
 assert.equal((await call(11,'events.php?city=Guangzhou')).data.ads.some(a=>a.id===saved.data.id),false,'only its city');
 const big=png(900,500,true);assert.ok(big.length>1000000,'a realistic banner is well over 100 KB');const bigSaved=await call(1,'admin.php','POST',{...ad,id:Number(saved.data.id),image:big});assert.equal(bigSaved.httpStatus,200,JSON.stringify(bigSaved));assert.equal((await call(11,'events.php?city=Shenyang')).data.ads.find(a=>a.id===saved.data.id).width,900);
 const img=await fetch(base+'/api/v4/chinalife/ad-image.php?id='+saved.data.id);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/png');assert.equal((await img.arrayBuffer()).byteLength>50,true);
 await call(1,'admin.php','POST',{...ad,id:Number(saved.data.id),image:undefined,active:false});
 assert.equal((await call(11,'events.php?city=Shenyang')).data.ads.some(a=>a.id===saved.data.id),false,'paused ads disappear');
 assert.equal((await fetch(base+'/api/v4/chinalife/ad-image.php?id='+saved.data.id)).status,404);
 assert.equal((await call(1,'admin.php','POST',{action:'ads'})).data.ads.find(a=>a.id===saved.data.id).active,false);
 assert.equal((await call(1,'admin.php','POST',{action:'delete_ad',id:Number(saved.data.id)})).httpStatus,200);
});
test('game sign-up runs Hafrik\'s own register.php with CORS for the game origin and no login needed',async()=>{
 const auth=path.join(tmp,'web/api/v4/auth');fs.mkdirSync(auth,{recursive:true});
 // Stand-in for Hafrik's register.php: relative include like Hafrik's own scripts, echoes what it received, no CORS.
 fs.writeFileSync(path.join(auth,'register.php'),`<?php require_once '../db.php'; header('Content-Type: application/json'); $in=json_decode(file_get_contents('php://input'),true); echo json_encode(['status'=>'success','message'=>'Account created','data'=>['user_id'=>7,'username'=>$in['username']??null]]);`);
 const url=base+'/api/v4/chinalife/register.php',origin='https://china-life.hafrik.com';
 const pre=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),origin);assert.match(pre.headers.get('access-control-allow-headers'),/Content-Type/);
 const r=await fetch(url,{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify({username:'ama_m',email:'ama@example.com',password:'test-only-password'})});
 assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),origin);const j=await r.json();assert.equal(j.status,'success');assert.equal(j.data.username,'ama_m');
 assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://evil.example','content-type':'application/json'},body:'{}'})).headers.get('access-control-allow-origin'),null,'other sites get no CORS access');
 assert.equal((await fetch(url)).status,405);
});
test('sending money from a player profile works end to end with two real game clients',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (5,6); DELETE FROM chinalife_saves WHERE user_id IN (5,6)');
 async function client(id){const t=harness(null),c=t.context,stored=new Map();c.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};c.HafrikSession={token:'test-'+id,user:{id,name:'User '+id}};c.URLSearchParams=URLSearchParams;c.fetch=(url,options)=>fetch(base+new URL(url).pathname+new URL(url).search,options);
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);t.game.loadSave({...game(),name:'Player '+id,place:'plaza',money:5000});await c.ChinaLifeCloud.upload();
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/social.js','utf8')+'})()',c);return t}
 const a=await client(5),b=await client(6);await a.context.ChinaLifeCloud.refresh();
 await a.context.ChinaLifeSocial.player('6');a.document.querySelector('[data-social="transfer"]').onclick();await new Promise(r=>setTimeout(r,50));
 assert.ok(a.document.getElementById('transferForm'),'the send money form opens');a.document.getElementById('transferAmount').value='1200';await a.document.getElementById('transferForm').onsubmit({preventDefault(){}});
 for(let i=0;i<20&&a.game.state.money!==3800;i++)await new Promise(r=>setTimeout(r,50));
 assert.equal(a.game.state.money,3800,'sender: '+a.document.getElementById('socialFeedback').textContent);
 assert.equal(JSON.parse(sql("USE chinalife_test; SELECT JSON_EXTRACT(game_state,'$.money') FROM chinalife_saves WHERE user_id=6").trim().split('\n').pop()),6200);
 await b.context.ChinaLifeCloud.syncTransfers();assert.equal(b.game.state.money,6200,'the recipient sees it');
});
test('money can be sent to a player elsewhere in the city who is not a friend',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (7,8); DELETE FROM chinalife_saves WHERE user_id IN (7,8)');
 async function client(id,place){const t=harness(null),c=t.context,stored=new Map();c.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};c.HafrikSession={token:'test-'+id,user:{id,name:'User '+id}};c.URLSearchParams=URLSearchParams;c.fetch=(url,options)=>fetch(base+new URL(url).pathname+new URL(url).search,options);
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);t.game.loadSave({...game(),name:'Player '+id,place,money:5000});await c.ChinaLifeCloud.upload();
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/social.js','utf8')+'})()',c);return t}
 const a=await client(7,'plaza'),b=await client(8,'cafe');await b.context.ChinaLifeCloud.refresh();await a.context.ChinaLifeCloud.refresh();
 assert.ok(a.context.ChinaLifeCloud.cityPlayers.some(p=>p.id==='8'));assert.ok(!a.context.ChinaLifeCloud.players.some(p=>p.id==='8'),'not in the same venue');
 await a.context.ChinaLifeSocial.player('8');assert.ok(a.document.querySelector('[data-social="transfer"]'),'Send money is on their profile');a.document.querySelector('[data-social="transfer"]').onclick();await new Promise(r=>setTimeout(r,50));
 a.document.getElementById('transferAmount').value='700';await a.document.getElementById('transferForm').onsubmit({preventDefault(){}});
 for(let i=0;i<20&&a.game.state.money!==4300;i++)await new Promise(r=>setTimeout(r,50));assert.equal(a.game.state.money,4300,a.document.getElementById('socialFeedback').textContent);
 await b.context.ChinaLifeCloud.syncTransfers();assert.equal(b.game.state.money,5700);
});
test('partner applications: players apply with photos, admins approve and it goes into the game by itself',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,2,12); DELETE FROM chinalife_saves WHERE user_id=2');
 assert.equal((await call(2,'partner.php')).httpStatus,403,'needs a ChinaLife character first');
 const photo=(await call(12,'partner.php','POST',{action:'upload',image:png(400,300)}));assert.equal(photo.httpStatus,200,JSON.stringify(photo));assert.match(photo.data.id,/^[a-f0-9]{24}$/);
 const img=await fetch(base+'/api/v4/chinalife/media.php?id='+photo.data.id);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/png');
 const restaurant={city:'Shenyang',name:'Mama Put Kitchen',icon:'🍲',district:'Sanhao Street',description:'Jollof, suya and pepper soup',near:'market',wechat_id:'mamaput_sy',photos:[photo.data.id],items:[{name:'Jollof rice',price:35,photo:photo.data.id,description:'Party style'},{name:'Suya',price:28}]};
 assert.equal((await call(12,'partner.php','POST',{action:'submit',kind:'restaurant',fields:{...restaurant,items:[]}})).httpStatus,400,'needs items');
 assert.equal((await call(12,'partner.php','POST',{action:'submit',kind:'restaurant',fields:{...restaurant,wechat_id:'',whatsapp:''}})).httpStatus,400,'needs a way to order');
 assert.equal((await call(12,'partner.php','POST',{action:'submit',kind:'restaurant',fields:{...restaurant,photos:['0123456789abcdef01234567']}})).httpStatus,400,'only your own uploads');
 const sub=await call(12,'partner.php','POST',{action:'submit',kind:'restaurant',fields:restaurant});assert.equal(sub.httpStatus,200,JSON.stringify(sub));assert.equal(sub.data.submissions[0].status,'pending');
 const startsAt=new Date(Date.now()+8*3600e3-60000).toISOString().slice(0,16),endsAt=new Date(Date.now()+8*3600e3+86400e3).toISOString().slice(0,16);
 const ev=await call(12,'partner.php','POST',{action:'submit',kind:'event',fields:{city:'Shenyang',title:'Afro Night',description:'Music and food',place:'night',starts:startsAt,ends:endsAt,photos:[photo.data.id]}});assert.equal(ev.httpStatus,200,JSON.stringify(ev));
 const ad=await call(12,'partner.php','POST',{action:'submit',kind:'ad',fields:{city:'Shenyang',title:'Mama Put opening',place:'night',days:14,contact:'+86 189 0000 0000',photos:[photo.data.id]}});assert.equal(ad.httpStatus,200,JSON.stringify(ad));
 assert.equal((await call(5,'admin.php','POST',{action:'partners'})).httpStatus,403,'admins only');
 const list=await call(1,'admin.php','POST',{action:'partners',status:'pending'});const mine=list.data.submissions.filter(s=>s.user_id==='12');assert.equal(mine.length,3);assert.equal(mine.find(s=>s.kind==='restaurant').data.items[0].name,'Jollof rice');
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(sub.data.id),decision:'changes'})).httpStatus,400,'changes need a note');
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(sub.data.id),decision:'changes',note:'Add a price for every dish'})).httpStatus,200);
 let my=(await call(12,'partner.php')).data.submissions.find(s=>s.id===sub.data.id);assert.equal(my.status,'changes');assert.equal(my.admin_note,'Add a price for every dish');
 assert.equal((await call(12,'partner.php','POST',{action:'submit',id:Number(sub.data.id),kind:'restaurant',fields:{...restaurant,description:'Updated'}})).httpStatus,200,'resubmit after changes');
 for(const s of [sub,ev,ad])assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(s.data.id),decision:'approve'})).httpStatus,200);
 const game=(await call(11,'events.php?city=Shenyang')).data;
 const listed=game.restaurants.find(r=>r.name==='Mama Put Kitchen');assert.ok(listed,'restaurant is in the game');assert.equal(listed.kind,'restaurant');assert.equal(listed.near,'market');assert.deepEqual(listed.photos,[photo.data.id]);assert.equal(listed.menu[0][2],photo.data.id);assert.equal(listed.description,'Updated');
 assert.ok(game.events.some(e=>e.title==='Afro Night'&&e.place==='night'),'event is live');assert.ok(game.ads.some(a=>a.title==='Mama Put opening'),'ad is live');
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(sub.data.id),decision:'approve'})).httpStatus,409,'approves once');
 assert.equal((await call(12,'partner.php')).data.submissions.find(s=>s.id===sub.data.id).status,'approved');
});
test('clubs can apply too and appear as a club listing after approval',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,12)');
 const club={city:'Shenyang',name:'Vibes Lounge',district:'Heping',wechat_id:'vibes_lounge',items:[{name:'Hennessy bottle',price:1200},{name:'VIP table',price:3000}]};
 const sub=await call(12,'partner.php','POST',{action:'submit',kind:'club',fields:club});assert.equal(sub.httpStatus,200,JSON.stringify(sub));
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(sub.data.id),decision:'approve'})).httpStatus,200);
 const listed=(await call(11,'events.php?city=Shenyang')).data.restaurants.find(r=>r.name==='Vibes Lounge');assert.equal(listed.kind,'club');assert.equal(listed.icon,'🎶');assert.equal(listed.menu.length,2);
});
test('music artists apply with music links and no price list, and go live as artists',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,12); DELETE FROM chinalife_submissions WHERE user_id=12 AND status IN ("pending","changes")');
 assert.equal((await call(12,'partner.php','POST',{action:'submit',kind:'artist',fields:{city:'Shenyang',name:'Kola Beats'}})).httpStatus,400,'needs music links or a contact');
 const sub=await call(12,'partner.php','POST',{action:'submit',kind:'artist',fields:{city:'Shenyang',name:'Kola Beats',district:'Afrobeats',description:'Afrobeats from Lagos to Shenyang',links:['https://music.163.com/artist?id=1'],items:[{name:'Club show (45 min)',price:5000}]}});assert.equal(sub.httpStatus,200,JSON.stringify(sub));
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(sub.data.id),decision:'approve'})).httpStatus,200);
 const a=(await call(11,'events.php?city=Shenyang')).data.restaurants.find(r=>r.name==='Kola Beats');assert.equal(a.kind,'artist');assert.equal(a.icon,'🎤');assert.deepEqual(a.links,['https://music.163.com/artist?id=1']);assert.equal(a.district,'Afrobeats');
});

test('player gist waits for admin approval and is scoped to its city',async()=>{
 const submitted=await call(11,'gist.php','POST',{city:'Shenyang',title:'Community gist test',body:'Meet at the center.',link:'https://hafrik.com'});assert.equal(submitted.httpStatus,200,submitted.message);
 const g=await call(11,'gist.php?city=Shenyang');assert.equal(g.httpStatus,200,g.message);assert.ok(!g.data.posts.some(p=>p.title==='Community gist test'));
 const list=await call(1,'admin.php','POST',{action:'gist'}),post=list.data.posts.find(p=>p.title==='Community gist test');assert.ok(post);
 assert.equal((await call(11,'admin.php','POST',{action:'approve_gist',id:Number(post.id)})).httpStatus,403);
 assert.equal((await call(1,'admin.php','POST',{action:'approve_gist',id:Number(post.id)})).httpStatus,200);
 assert.ok((await call(11,'gist.php?city=Shenyang')).data.posts.some(p=>p.title==='Community gist test'));
 await call(1,'admin.php','POST',{action:'end_gist',id:Number(post.id)});
 assert.ok(!(await call(11,'gist.php?city=Shenyang')).data.posts.some(p=>p.title==='Community gist test'));
});
test('admins choose the city and venue a partner ad or event runs in when approving',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,12); DELETE FROM chinalife_submissions WHERE user_id=12 AND status IN ("pending","changes")');
 const banner=(await call(12,'partner.php','POST',{action:'upload',image:png(800,400)})).data.id;
 const ad=await call(12,'partner.php','POST',{action:'submit',kind:'ad',fields:{city:'Shenyang',title:'City pick ad',place:'night',days:7,contact:'wechat me',photos:[banner]}});assert.equal(ad.httpStatus,200,JSON.stringify(ad));
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(ad.data.id),decision:'approve',city:'Atlantis',place:'night'})).httpStatus,400);
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(ad.data.id),decision:'approve',city:'Guangzhou',place:'mall'})).httpStatus,200);
 const gz=(await call(11,'events.php?city=Guangzhou')).data.ads.find(a=>a.title==='City pick ad');assert.ok(gz,'runs in the city the admin chose');assert.equal(gz.place,'mall');
 assert.ok(!(await call(11,'events.php?city=Shenyang')).data.ads.some(a=>a.title==='City pick ad'),'not in the city the applicant asked for');
 const every=await call(12,'partner.php','POST',{action:'submit',kind:'ad',fields:{city:'Shenyang',title:'Everywhere ad',place:'night',days:7,contact:'wechat me',photos:[banner]}});
 await call(1,'admin.php','POST',{action:'review_partner',id:Number(every.data.id),decision:'approve',city:'',place:'night'});
 for(const c of ['Shenyang','Harbin'])assert.ok((await call(11,'events.php?city='+c)).data.ads.some(a=>a.title==='Everywhere ad'),'every city: '+c);
 const t=s=>new Date(Date.now()+8*3600e3+s).toISOString().slice(0,16);
 const ev=await call(12,'partner.php','POST',{action:'submit',kind:'event',fields:{city:'Shenyang',title:'Moved event',place:'night',starts:t(-60000),ends:t(86400e3)}});
 await call(1,'admin.php','POST',{action:'review_partner',id:Number(ev.data.id),decision:'approve',city:'Shenzhen',place:''});
 assert.ok((await call(11,'events.php?city=Shenzhen')).data.events.some(e=>e.title==='Moved event'&&e.place===''));
});
test('artists upload their own songs; on approval they reach ChinaLife Radio and club DJ booths, and admins can take them down',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,11,12); DELETE FROM chinalife_submissions WHERE user_id=12 AND status IN ("pending","changes")');
 const up=(body,q='title=Lagos%20Nights&duration=185')=>fetch(base+'/api/v4/chinalife/partner.php?action=upload_song&'+q,{method:'POST',headers:{Authorization:'Bearer test-12','content-type':'audio/mpeg'},body}).then(async r=>({...await r.json(),httpStatus:r.status}));
 assert.equal((await up(Buffer.from('<?php echo 1; ?> not music'))).httpStatus,400,'only real MP3 or M4A');
 assert.equal((await up(Buffer.concat([Buffer.from('ID3'),crypto.randomBytes(4000)]),'title=X&duration=5')).httpStatus,400,'sensible length');
 const mp3=Buffer.concat([Buffer.from('ID3'),crypto.randomBytes(20000)]);const song=await up(mp3);assert.equal(song.httpStatus,200,JSON.stringify(song));assert.match(song.data.id,/^[a-f0-9]{16}$/);
 const file=await fetch(song.data.url);assert.equal(file.status,200,'the song file is served');assert.equal(Buffer.from(await file.arrayBuffer()).length,mp3.length);
 const m4a=await up(Buffer.concat([Buffer.from([0,0,0,0x20]),Buffer.from('ftypM4A '),crypto.randomBytes(5000)]),'title=Second&duration=200');assert.equal(m4a.httpStatus,200,JSON.stringify(m4a));
 const wavHead=Buffer.alloc(12);wavHead.write('RIFF',0);wavHead.writeUInt32LE(3000000,4);wavHead.write('WAVE',8);const wav=await up(Buffer.concat([wavHead,crypto.randomBytes(3000000)]),'title=Studio%20Master&duration=600');assert.equal(wav.httpStatus,200,JSON.stringify(wav));assert.match(wav.data.url,/\.wav$/);assert.equal((await fetch(wav.data.url)).status,200,'a 3 MB WAV is stored and served');
 assert.equal((await up(Buffer.from('RIFF0000AVI LIST'),'title=Video&duration=60')).httpStatus,400,'other RIFF files are refused');
 assert.equal((await call(11,'events.php?city=Shenyang')).data.songs.some(s=>s.id===song.data.id),false,'nothing plays before approval');
 assert.equal((await call(12,'partner.php','POST',{action:'submit',kind:'artist',fields:{city:'Shenyang',name:'Radio Artist',songs:[{id:'ffffffffffffffff',title:'Fake'}]}})).httpStatus,400,'only their own uploads');
 const sub=await call(12,'partner.php','POST',{action:'submit',kind:'artist',fields:{city:'Shenyang',name:'Radio Artist',district:'Afrobeats',songs:[{id:song.data.id,title:'Lagos Nights (Radio Edit)'},{id:m4a.data.id,title:'Second'}]}});assert.equal(sub.httpStatus,200,JSON.stringify(sub));
 assert.equal((await call(1,'admin.php','POST',{action:'review_partner',id:Number(sub.data.id),decision:'approve'})).httpStatus,200);
 let songs=(await call(11,'events.php?city=Shenyang')).data.songs;const live=songs.find(s=>s.id===song.data.id);assert.ok(live,'on the radio');assert.equal(live.title,'Lagos Nights (Radio Edit)');assert.equal(live.artist,'Radio Artist');assert.equal(live.duration,185);assert.match(live.url,/chinalife-music\/[a-f0-9]{16}\.mp3$/);
 assert.ok((await call(11,'events.php?city=Harbin')).data.songs.some(s=>s.id===song.data.id),'the radio plays artists from every city');
 await call(11,'presence.php','POST',presence('Shenyang','night'));
 assert.equal((await call(11,'music.php','POST',{city:'Shenyang',place:'night',track:'song:'+song.data.id})).httpStatus,200,'request an artist song in the club');
 assert.equal((await call(11,'music.php','POST',{city:'Shenyang',place:'night',track:'song:0000000000000000'})).httpStatus,400);
 assert.equal((await call(1,'admin.php','POST',{action:'songs'})).data.songs.find(s=>s.id===song.data.id).active,true);
 assert.equal((await call(1,'admin.php','POST',{action:'song_active',id:song.data.id,active:false})).httpStatus,200);
 assert.equal((await call(11,'events.php?city=Shenyang')).data.songs.some(s=>s.id===song.data.id),false,'taken down');
});
test('admins edit any partner listing and it changes in the game at once, or delete it with everything it created',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,11,12); DELETE FROM chinalife_submissions WHERE user_id=12 AND status IN ("pending","changes")');
 const shop={city:'Shenyang',name:'Edit Me Mart',district:'Heping',wechat_id:'editmemart',items:[{name:'Garri',price:20}]};
 const sub=await call(12,'partner.php','POST',{action:'submit',kind:'shop',fields:shop});assert.equal(sub.httpStatus,200,JSON.stringify(sub));await call(1,'admin.php','POST',{action:'review_partner',id:Number(sub.data.id),decision:'approve'});
 const pic=await call(1,'admin.php','POST',{action:'partner_upload',image:png(300,300)});assert.equal(pic.httpStatus,200,JSON.stringify(pic));
 assert.equal((await call(5,'admin.php','POST',{action:'partner_update',id:Number(sub.data.id),fields:shop})).httpStatus,403,'admins only');
 const upd=await call(1,'admin.php','POST',{action:'partner_update',id:Number(sub.data.id),fields:{...shop,name:'Edited Mart',near:'mall',photos:[pic.data.id],items:[{name:'Garri 2kg',price:38,photo:pic.data.id},{name:'Palm oil',price:45}]}});assert.equal(upd.httpStatus,200,JSON.stringify(upd));
 let live=(await call(11,'events.php?city=Shenyang')).data.restaurants.find(r=>r.name==='Edited Mart');assert.ok(live,'renamed in the game');assert.equal(live.menu.length,2);assert.equal(live.menu[0][2],pic.data.id);assert.equal(live.near,'mall');assert.deepEqual(live.photos,[pic.data.id]);
 assert.ok(!(await call(11,'events.php?city=Shenyang')).data.restaurants.some(r=>r.name==='Edit Me Mart'));
 // An artist with songs: delete removes the listing, the songs and their files.
 const up=(body,q)=>fetch(base+'/api/v4/chinalife/partner.php?action=upload_song&'+q,{method:'POST',headers:{Authorization:'Bearer test-12','content-type':'audio/mpeg'},body}).then(r=>r.json());
 const song=(await up(Buffer.concat([Buffer.from('ID3'),crypto.randomBytes(3000)]),'title=Gone&duration=120')).data;
 const art=await call(12,'partner.php','POST',{action:'submit',kind:'artist',fields:{city:'Shenyang',name:'Delete Me Band',songs:[{id:song.id,title:'Gone'}]}});await call(1,'admin.php','POST',{action:'review_partner',id:Number(art.data.id),decision:'approve'});
 assert.ok((await call(11,'events.php?city=Shenyang')).data.songs.some(s=>s.id===song.id));assert.equal((await fetch(song.url)).status,200);
 assert.equal((await call(1,'admin.php','POST',{action:'partner_delete',id:Number(art.data.id)})).httpStatus,200);
 const after=(await call(11,'events.php?city=Shenyang')).data;assert.ok(!after.restaurants.some(r=>r.name==='Delete Me Band'),'listing gone');assert.ok(!after.songs.some(s=>s.id===song.id),'songs gone');assert.equal((await fetch(song.url)).status,404,'song file removed');
 assert.ok(!(await call(1,'admin.php','POST',{action:'partners',status:'all'})).data.submissions.some(s=>s.id===art.data.id),'application gone');
 // A live ad: title, venue and city change in place.
 const banner=(await call(12,'partner.php','POST',{action:'upload',image:png(800,400)})).data.id;
 const ad=await call(12,'partner.php','POST',{action:'submit',kind:'ad',fields:{city:'Shenyang',title:'Old ad',place:'night',days:7,contact:'me',photos:[banner]}});await call(1,'admin.php','POST',{action:'review_partner',id:Number(ad.data.id),decision:'approve'});
 assert.equal((await call(1,'admin.php','POST',{action:'partner_update',id:Number(ad.data.id),fields:{city:'Harbin',title:'New ad',place:'mall',days:14,contact:'me',photos:[banner]}})).httpStatus,200);
 const hb=(await call(11,'events.php?city=Harbin')).data.ads.find(a=>a.title==='New ad');assert.ok(hb);assert.equal(hb.place,'mall');assert.ok(!(await call(11,'events.php?city=Shenyang')).data.ads.some(a=>a.title==='Old ad'||a.title==='New ad'));
});
test('AI city characters: off without a key, then answer with real listings in context, keep history and a daily limit',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11); DELETE FROM chinalife_ai_messages');
 const cfg=path.join(tmp,'web/api/v4/chinalife/ai-config.php');try{fs.unlinkSync(cfg)}catch{}
 // AI characters sit behind the admin switch ai_characters (default off since Oct 2026).
 assert.equal((await call(11,'ai.php?agent=guide')).httpStatus,403,'switched off by default');
 assert.equal((await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{ai_characters:true}})).httpStatus,200);
 let r=await call(11,'ai.php?agent=guide');assert.equal(r.httpStatus,200);assert.equal(r.data.enabled,false);
 assert.equal((await call(11,'ai.php','POST',{agent:'guide',message:'Hi'})).httpStatus,503,'not switched on without a key');
 // A stand-in for the Anthropic Messages API that records what it was sent.
 const seen=[];let fail=false;const mock=http.createServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{seen.push({headers:req.headers,body:JSON.parse(body)});if(fail){res.writeHead(529,{'content-type':'application/json'});return res.end('{"type":"error"}')}res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({content:[{type:'text',text:'Try the jollof at Mama Put! [[go:market]]'}]}))})});
 await new Promise(ok=>mock.listen(0,'127.0.0.1',ok));const port=mock.address().port;
 fs.writeFileSync(cfg,`<?php return ['api_key'=>'test-key','model'=>'claude-sonnet-5-5','daily_limit'=>3,'endpoint'=>'http://127.0.0.1:${port}/v1/messages'];`);
 try{
  assert.equal((await call(11,'ai.php','POST',{agent:'stranger',message:'Hi'})).httpStatus,400,'only known characters');
  r=await call(11,'ai.php','POST',{agent:'guide',message:'Where can I eat African food?',context:{city:'Shenyang',place:'Hafrik Square',name:'Player',money:5000,places:[['market','Taiyuan Street Market'],['../etc','bad']]}});
  assert.equal(r.httpStatus,200,JSON.stringify(r));assert.match(r.data.reply,/jollof/);assert.equal(r.data.remaining,2);
  const sent=seen.at(-1);assert.equal(sent.headers['x-api-key'],'test-key');assert.equal(sent.headers['anthropic-version'],'2023-06-01');assert.equal(sent.body.model,'claude-sonnet-5-5');
  assert.match(sent.body.system,/You are Mei/);assert.match(sent.body.system,/No sexual or romantic/);assert.match(sent.body.system,/market=Taiyuan Street Market/);assert.doesNotMatch(sent.body.system,/\.\.\/etc/,'only safe place ids');
  assert.deepEqual(sent.body.messages,[{role:'user',content:'Where can I eat African food?'}]);
  r=await call(11,'ai.php','POST',{agent:'guide',message:'Thanks!',context:{city:'Shenyang'}});assert.equal(seen.at(-1).body.messages.length,3,'remembers the conversation');
  assert.equal((await call(11,'ai.php?agent=tutor')).data.messages.length,0,'each character has its own conversation');
  const h=await call(11,'ai.php?agent=guide');assert.equal(h.data.messages.length,4);assert.equal(h.data.messages[1].role,'assistant');assert.equal(h.data.remaining,1);
  fail=true;assert.equal((await call(11,'ai.php','POST',{agent:'guide',message:'Again'})).httpStatus,502,'API trouble shows a friendly error');fail=false;
  await call(11,'ai.php','POST',{agent:'food',message:'Third'});assert.equal((await call(11,'ai.php','POST',{agent:'food',message:'Fourth'})).httpStatus,429,'daily limit');
  assert.equal((await call(11,'ai.php?agent=guide','DELETE')).httpStatus,200);assert.equal((await call(11,'ai.php?agent=guide')).data.messages.length,0,'conversation cleared');assert.equal((await call(11,'ai.php?agent=guide')).data.remaining,0,'clearing history does not reset usage');assert.equal((await call(11,'ai.php','POST',{agent:'tutor',message:'Bypass'})).httpStatus,429,'daily quota applies across characters after history deletion');
 }finally{mock.close();fs.unlinkSync(cfg)}
});
test('AI characters act in the game with tools (checked against real places, screens, businesses), and every venue has a host',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11); DELETE FROM chinalife_ai_messages');
 const cfg=path.join(tmp,'web/api/v4/chinalife/ai-config.php');let reply=null,seen=[];
 assert.equal((await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{ai_characters:true}})).httpStatus,200);
 const mock=http.createServer((req,res)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{seen.push(JSON.parse(b));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({stop_reason:'tool_use',content:reply}))})});
 await new Promise(ok=>mock.listen(0,'127.0.0.1',ok));fs.writeFileSync(cfg,`<?php return ['api_key'=>'test-key','daily_limit'=>50,'endpoint'=>'http://127.0.0.1:${mock.address().port}/v1/messages'];`);
 try{
  const ctx={city:'Shenyang',place:'Hafrik Square',places:[['market','Taiyuan Street Market'],['cafe','Heping Café']]};
  reply=[{type:'text',text:'Let me open your wallet.'},{type:'tool_use',id:'t1',name:'open_screen',input:{screen:'wallet',now:true}},{type:'tool_use',id:'t2',name:'go_to_place',input:{place_id:'market'}},{type:'tool_use',id:'t3',name:'go_to_place',input:{place_id:'moon'}},{type:'tool_use',id:'t4',name:'open_screen',input:{screen:'hack_admin'}},{type:'tool_use',id:'t5',name:'show_business',input:{name:'No Such Place'}}];
  let r=await call(11,'ai.php','POST',{agent:'guide',message:'Open my wallet',context:ctx});assert.equal(r.httpStatus,200,JSON.stringify(r));
  assert.match(r.data.reply,/\[\[open:wallet\]\]/);assert.match(r.data.reply,/\[\[go:market\]\]/);assert.doesNotMatch(r.data.reply,/moon|hack_admin|No Such/,'only real places, screens and businesses');assert.equal(r.data.auto,'[[open:wallet]]','asked directly, so it runs now');
  const tools=seen.at(-1).tools;assert.deepEqual(tools.map(t=>t.name),['go_to_place','open_screen','show_business','play_song','claim_daily_reward']);assert.deepEqual(tools[0].input_schema.properties.place_id.enum,['market','cafe']);
  reply=[{type:'tool_use',id:'t6',name:'claim_daily_reward',input:{}}];r=await call(11,'ai.php','POST',{agent:'guide',message:'Get my reward',context:ctx});assert.equal(r.data.reply,'On it! 👇\n[[daily]]');assert.equal(r.data.auto,null);
  // A host for any public venue, with its own conversation.
  reply=[{type:'text',text:'Welcome to the gym!'}];r=await call(11,'ai.php','POST',{agent:'host',place:'gym',message:'Hi',context:{...ctx,place:'Heping Gym'}});assert.equal(r.httpStatus,200,JSON.stringify(r));assert.match(seen.at(-1).system,/the friendly host of Heping Gym/);
  assert.equal((await call(11,'ai.php?agent=host&place=gym')).data.messages.length,2);assert.equal((await call(11,'ai.php?agent=host&place=cafe')).data.messages.length,0);
  assert.equal((await call(11,'ai.php','POST',{agent:'host',place:'home',message:'Hi',context:ctx})).httpStatus,400,'no hosts in private homes');
  reply=[{type:'text',text:'Hello from the café'}];r=await call(11,'ai.php','POST',{agent:'barista',message:'Hi',context:ctx});assert.equal(r.httpStatus,200);assert.match(seen.at(-1).system,/You are Coco/);
 }finally{mock.close();fs.unlinkSync(cfg);await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{ai_characters:false}})}
});
// Performance Batch 1 (presence inbox counters, polling-config switch, poller.js scheduling) was never deployed: the live
// snapshot ff21334 replaced presence.php and cloud.js without it, and it lives on branch perf/batch-1. Its tests are kept, skipped.
test.skip('Batch 1: presence carries correctly scoped change counters; old clients get the same response as before',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (3,4,5); DELETE FROM chinalife_friends WHERE first_id IN (3,4,5) OR second_id IN (3,4,5); DELETE FROM chinalife_blocks WHERE owner_id IN (3,4,5) OR peer_id IN (3,4,5)');
 for(const [id,place] of [[3,'cafe'],[4,'cafe'],[5,'gym']])await call(id,'presence.php','POST',presence('Shenyang',place));
 const box=async id=>(await call(id,'presence.php','POST',{...presence('Shenyang',id===5?'gym':'cafe'),inbox:1})).data.inbox;
 assert.equal((await call(3,'presence.php','POST',presence('Shenyang','cafe'))).data.inbox,undefined,'no inbox unless asked: unchanged for old clients');
 const a0=await box(3),b0=await box(4),c0=await box(5);assert.equal(a0.mode,'adaptive');assert.equal(typeof a0.revision,'number');
 // Venue message: the room id moves for players in that venue only.
 await call(3,'messages.php','POST',{city:'Shenyang',place:'cafe',text:'Hello cafe'});
 assert.notEqual((await box(4)).room,b0.room,'same venue sees a new room message');assert.equal((await box(5)).room,c0.room,'another venue does not');
 // Private message: only the recipient's message counter moves.
 await call(3,'friends.php','POST',{peer:'4',action:'request'});await call(4,'friends.php','POST',{peer:'3',action:'accept'});
 const b1=await box(4),a1=await box(3);await call(3,'messages.php','POST',{peer:'4',text:'Private hi'});
 assert.equal((await box(4)).messages,b1.messages+1,'recipient');assert.equal((await box(3)).messages,a1.messages,'sender unchanged');assert.equal((await box(5)).messages,c0.messages,'others unchanged');
 // Shared activity: both participants, nobody else.
 const b2=await box(4),a2=await box(3);const inv=await call(3,'activities.php','POST',{action:'invite',peer:'4',kind:'meal'});assert.equal(inv.httpStatus,200,JSON.stringify(inv));
 assert.equal((await box(4)).activities,b2.activities+1);assert.equal((await box(3)).activities,a2.activities+1);assert.equal((await box(5)).activities,c0.activities);
 await call(4,'activities.php','POST',{action:'decline',id:Number(inv.data.id)});assert.equal((await box(3)).activities,a2.activities+2,'declining notifies the inviter');
 // Money received bumps the save revision the player sees.
 const r0=(await box(4)).revision;await call(3,'transfers.php','POST',{peer:'4',amount:1,request_id:'batch1-transfer-0001'});assert.equal((await box(4)).revision,r0+1);
 // Rollback switch.
 // Deployed before the migration: no counters, clients told to keep the old polling, and messages still send.
 sql('USE chinalife_test; RENAME TABLE chinalife_inbox TO chinalife_inbox_off');
 try{assert.deepEqual((await box(3)),{mode:'legacy'});const sent=await call(3,'messages.php','POST',{city:'Shenyang',place:'plaza',text:'no inbox yet',peer:'4'});assert.equal(sent.httpStatus,200,JSON.stringify(sent))}
 finally{sql('USE chinalife_test; RENAME TABLE chinalife_inbox_off TO chinalife_inbox')}
 // Rollout switch (server-only JSON, read on every request so it applies at once). Legacy answers carry no counters.
 const cfg=path.join(tmp,'web/api/v4/chinalife/polling-config.json'),orig=fs.readFileSync(cfg,'utf8'),mode=async id=>(await box(id)).mode;
 try{
  fs.writeFileSync(cfg,'{"mode":"legacy"}');assert.deepEqual(await box(3),{mode:'legacy'},'kill switch: immediate, and no extra queries');
  fs.rmSync(cfg);assert.equal(await mode(3),'legacy','missing file means legacy');fs.writeFileSync(cfg,'not json');assert.equal(await mode(3),'legacy','broken file means legacy');
  fs.writeFileSync(cfg,'{"mode":"testers","testers":["USER3","4"]}');assert.equal(await mode(3),'adaptive','tester by username');assert.equal(await mode(4),'adaptive','tester by user id');assert.deepEqual(await box(5),{mode:'legacy'},'everyone else stays on the old polling');
  fs.writeFileSync(cfg,'{"mode":"testers","testers":[],"percent":100}');assert.equal(await mode(5),'adaptive','percent rollout');
  fs.writeFileSync(cfg,'{"mode":"legacy","testers":["user3"]}');assert.equal(await mode(3),'legacy','legacy overrides the tester list');
 }finally{fs.writeFileSync(cfg,orig)}
});
test.skip('Batch 1 end to end: one presence request per heartbeat, messages wake the right checks, fast when together, legacy rollback',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (6,7); DELETE FROM chinalife_saves WHERE user_id IN (6,7); DELETE FROM chinalife_presence WHERE user_id IN (6,7)');
 async function client(id){const t=harness(null),c=t.context,stored=new Map(),log=[];c.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};c.HafrikSession={token:'test-'+id,user:{id,name:'User '+id}};c.URLSearchParams=URLSearchParams;
  c.fetch=(url,options)=>{const u=new URL(url);log.push((options?.method||'GET')+' '+u.pathname.split('/').pop());return fetch(base+u.pathname+u.search,options)};
  vm.runInContext(fs.readFileSync('public/poller.js','utf8'),c);
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);t.game.loadSave({...game(),name:'Player '+id,place:'plaza'});await c.ChinaLifeCloud.upload();await c.ChinaLifeCloud.refresh();
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/notifications.js','utf8')+'})()',c);await vm.runInContext('(async()=>{'+fs.readFileSync('public/shared-activities.js','utf8')+'})()',c);return {...t,P:c.ChinaLifePoll,log}}
 for(let i=0;i<30;i++){const m=(await call(6,'presence.php','POST',{...presence(),inbox:1})).data?.inbox?.mode;if(m==='adaptive')break;await new Promise(r=>setTimeout(r,200))}sql('USE chinalife_test; DELETE FROM chinalife_presence WHERE user_id=6; DELETE FROM chinalife_rate_limits WHERE user_id IN (6,7)');
 const a=await client(6),b=await client(7);await a.P.run('presence');assert.equal(b.P.mode,'adaptive','switched on by the server after the first heartbeat');
 b.log.length=0;await b.P.run('presence');assert.deepEqual(b.log,['POST presence.php'],'one request per heartbeat (no separate GET)');
 assert.ok(b.context.ChinaLifeCloud.players.some(p=>p.id==='6'),'still sees the other player');
 assert.equal(b.P.stats().find(s=>s.name==='presence').interval,2500,'fast while another player is in the venue');
 await b.P.run('notifications');
 // A venue message: the next heartbeat wakes B's message check, which delivers it.
 const before=b.P.stats().find(s=>s.name==='notifications').next;assert.ok(before>5000,'message check is idle (safety interval) before anything happens');
 await call(6,'messages.php','POST',{city:'Shenyang',place:'plaza',text:'Batch one hello'});await b.P.run('presence');
 assert.ok(b.P.stats().find(s=>s.name==='notifications').next<1000,'heartbeat woke the message check');b.log.length=0;await b.P.run('notifications');
 assert.deepEqual(b.log,['GET notifications.php']);assert.match(b.document.getElementById('messageNotification').textContent,/Batch one hello/);
 // A shared-activity invitation wakes B's activity check, shows the invite, and keeps that check fast while it is open.
 sql('USE chinalife_test; DELETE FROM chinalife_friends WHERE first_id IN (6,7) OR second_id IN (6,7); DELETE FROM chinalife_shared_activities WHERE inviter_id IN (6,7) OR invitee_id IN (6,7)');
 await call(6,'friends.php','POST',{peer:'7',action:'request'});await call(7,'friends.php','POST',{peer:'6',action:'accept'});
 await b.P.run('activities');assert.equal(b.P.stats().find(s=>s.name==='activities').interval,30000,'idle activity check is slow');
 await call(6,'presence.php','POST',presence('Shenyang','plaza'));const inv=await call(6,'activities.php','POST',{action:'invite',peer:'7',kind:'meal'});assert.equal(inv.httpStatus,200,JSON.stringify(inv));
 await b.P.run('presence');assert.ok(b.P.stats().find(s=>s.name==='activities').next<1000,'heartbeat woke the activity check');await b.P.run('activities');
 assert.match(b.document.getElementById('sharedInvite')?.textContent||b.document.body.textContent,/invited you/);assert.equal(b.P.stats().find(s=>s.name==='activities').interval,3000,'fast while the invitation is open');
 await call(6,'activities.php','POST',{action:'cancel',id:Number(inv.data.id)});
 // Alone: slower heartbeat.
 sql('USE chinalife_test; DELETE FROM chinalife_presence WHERE user_id<>7');await b.P.run('presence');assert.equal(b.P.stats().find(s=>s.name==='presence').interval,10000,'10 s when nobody is with you');
 // Rollback: the server switches every game back to the old two-request heartbeat.
 const cfg=path.join(tmp,'web/api/v4/chinalife/polling-config.json'),orig=fs.readFileSync(cfg,'utf8');fs.writeFileSync(cfg,'{"mode":"legacy"}');
 try{await b.P.run('presence');assert.equal(b.P.mode,'legacy');b.log.length=0;await b.P.run('presence');assert.deepEqual(b.log,['POST presence.php','GET presence.php'],'legacy heartbeat as before');assert.equal(b.P.stats().find(s=>s.name==='notifications').interval,1000)}
 finally{fs.writeFileSync(cfg,orig)}
 // Switching the server back reaches devices already in legacy mode without a reload.
 await b.P.run('presence');assert.equal(b.P.mode,'adaptive');b.log.length=0;await b.P.run('presence');assert.deepEqual(b.log,['POST presence.php'],'back to one request per heartbeat');
});

test('every incoming transfer moves the recipient revision once, under concurrency and retries',async()=>{
 const ids=[8,9,10,11];sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (8,9,10,11); DELETE FROM chinalife_transfers WHERE sender_id IN (8,9,10,11) OR recipient_id IN (8,9,10,11); DELETE FROM chinalife_saves WHERE user_id IN (8,9,10,11)');
 for(const id of ids)assert.equal((await call(id,'save.php','POST',{revision:0,save:{character:{name:'P'+id},game:{...game(),name:'P'+id,money:1000,transferTotal:0}}})).httpStatus,200);
 const start=await call(11,'save.php');
 // Three senders, two transfers each, all at once, and every request sent twice (a retry racing the original).
 const sends=[8,9,10].flatMap(from=>[1,2].map(n=>({from,amount:from*10+n,request_id:'batch1-money-'+from+'-'+n+'-xxxxxxxx'})));
 const results=await Promise.all(sends.flatMap(t=>[t,t]).map(t=>call(t.from,'transfers.php','POST',{peer:'11',amount:t.amount,request_id:t.request_id})));
 assert.ok(results.every(r=>r.httpStatus===200),JSON.stringify(results.filter(r=>r.httpStatus!==200)));
 assert.equal(results.filter(r=>r.data.duplicate).length,6,'each retry is recognised, never paid twice');
 const end=await call(11,'save.php'),total=sends.reduce((a,t)=>a+t.amount,0);
 assert.equal(end.data.revision,start.data.revision+6,'one revision step per transfer');
 assert.equal(end.data.save.game.money,1000+total);assert.equal(end.data.save.game.transferTotal,total);
 for(const from of [8,9,10])assert.equal((await call(from,'save.php')).data.save.game.money,1000-(from*10+1)-(from*10+2));
});
test.skip('Batch 1 money: the heartbeat reports the new revision and an open game picks the money up',async()=>{
 const inbox=async()=>(await call(11,'presence.php','POST',{...presence(),inbox:1})).data.inbox;
 assert.equal((await inbox()).revision,(await call(11,'save.php')).data.revision,'the heartbeat reports the new revision');
 // An open game (adaptive) picks up money even after another device saved without money in between.
 const t=harness(null),c=t.context,stored=new Map();c.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};c.HafrikSession={token:'test-11',user:{id:11,name:'User 11'}};c.URLSearchParams=URLSearchParams;
 c.fetch=(url,options)=>{const u=new URL(url);return fetch(base+u.pathname+u.search,options)};vm.runInContext(fs.readFileSync('public/poller.js','utf8'),c);
 await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);await c.ChinaLifeCloud.ready;const P=c.ChinaLifePoll,next=()=>P.stats().find(s=>s.name==='transfers').next;
 await P.run('presence');await P.run('presence');await P.run('transfers');const m0=t.game.state.money;
 sql('USE chinalife_test; UPDATE chinalife_saves SET revision=revision+1 WHERE user_id=11');
 await P.run('presence');assert.ok(next()<1000,'newer save noticed');await P.run('transfers');assert.equal(t.game.state.money,m0,'no money in that save');
 await P.run('presence');assert.ok(next()>5000,'the same revision is not downloaded again on every heartbeat');
 await call(8,'transfers.php','POST',{peer:'11',amount:7,request_id:'batch1-money-late-xxxxxxxxx'});
 await P.run('presence');assert.ok(next()<1000,'money wakes the transfer check');await P.run('transfers');assert.equal(t.game.state.money,m0+7,'received money shows in the game');
});

test('perf monitor reads /proc, the access log, database status and presence ages without changing anything',()=>{
 // A fake /proc: two PHP 8.4 workers (one busy), a PHP-FPM master (left out), Apache, memory and load.
 const proc=path.join(tmp,'fakeproc'),log=path.join(tmp,'access_log');fs.rmSync(proc,{recursive:true,force:true});fs.writeFileSync(log,'');
 const pidStat=(pid,name,ticks)=>`${pid} (${name}) S 1 1 1 0 -1 0 0 0 0 0 ${ticks} 0 0 0 20 0 1 0`;
 const write=busyTicks=>{fs.mkdirSync(proc,{recursive:true});fs.writeFileSync(path.join(proc,'stat'),`cpu ${1000+busyTicks} 0 100 ${9000} 0 0 0 0 0 0\n`);fs.writeFileSync(path.join(proc,'meminfo'),'MemTotal: 16384000 kB\nMemAvailable: 8192000 kB\nSwapTotal: 2048000 kB\nSwapFree: 1024000 kB\n');fs.writeFileSync(path.join(proc,'loadavg'),'1.25 1.10 0.90 2/300 1234\n');
  for(const [pid,name,ticks,cmd] of [[101,'php-fpm',500,'php-fpm: master process (/www/server/php/84/etc/php-fpm.conf)'],[102,'php-fpm',100+busyTicks,'php-fpm: pool www'],[103,'php-fpm',50,'php-fpm: pool www'],[200,'httpd',300+busyTicks,'/usr/sbin/httpd']]){const d=path.join(proc,String(pid));fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'stat'),pidStat(pid,name,ticks));fs.writeFileSync(path.join(d,'cmdline'),cmd);try{fs.symlinkSync('/www/server/php/84/sbin/php-fpm',path.join(d,'exe'))}catch{}}};
 write(0);
 const out=execFileSync('bash',['-c',`(sleep 0.5; printf '%s\n' '1.2.3.4 - - [x] "POST /api/v4/chinalife/presence.php HTTP/1.1" 200 10' '1.2.3.4 - - [x] "GET /api/v4/chinalife/notifications.php?city=Shenyang HTTP/1.1" 429 5' '1.2.3.4 - - [x] "GET /api/v4/chinalife/presence.php?city=Shenyang HTTP/1.1" 503 5' '1.2.3.4 - - [x] "GET /other.php HTTP/1.1" 500 5' >> "$1"; node -e "$5" ) & php scripts/perf-monitor.php --hafrik="$2" --log="$1" --interval=1 --samples=1 --csv="$3" --endpoints-csv="$4" --proc="$6"`,'_',log,path.join(tmp,'web'),path.join(tmp,'perf.csv'),path.join(tmp,'perf-endpoints.csv'),
  `const fs=require('fs'),p=require('path'),d='${proc}';fs.writeFileSync(p.join(d,'stat'),'cpu 1050 0 100 9050 0 0 0 0 0 0\\n');fs.writeFileSync(p.join(d,'102','stat'),'102 (php-fpm) S 1 1 1 0 -1 0 0 0 0 0 150 0 0 0 20 0 1 0');fs.writeFileSync(p.join(d,'200','stat'),'200 (httpd) S 1 1 1 0 -1 0 0 0 0 0 310 0 0 0 20 0 1 0')`,proc],{env,encoding:'utf8'});
 assert.match(out,/api 3(\.\d+)? req\/s|api 2\.\d+ req\/s/,out);assert.match(out,/4xx 0, 429 1, 5xx 1/,'only ChinaLife API lines are counted');
 assert.match(out,/php84 cpu [\d.]+% workers 2 busy 1/,'workers per PHP version, master left out, busy worker found');assert.match(out,/mem avail 8000 MB swap 1000 MB/);assert.match(out,/load 1\.25/);assert.match(out,/cpu 50(\.0)?%/,'machine CPU from /proc/stat');
 assert.match(out,/db [\d.]+ q\/s/);assert.match(out,/online \d+/);
 assert.match(out,/=== Summary/);assert.match(out,/presence\.php\s+2\s/);assert.match(out,/php84\s+cpu avg/);
 const csv=fs.readFileSync(path.join(tmp,'perf.csv'),'utf8').trim().split('\n');assert.equal(csv.length,2);assert.match(csv[0],/^time,api_rps/);
 assert.match(fs.readFileSync(path.join(tmp,'perf-endpoints.csv'),'utf8'),/presence\.php,2,[\d.]+,0,0,1,50/);
});

test('partner upload quotas reject storage exhaustion before adding photos or songs',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id=12');
 const count=()=>Number(sql('USE chinalife_test; SELECT COUNT(*) FROM chinalife_media WHERE user_id=12').trim());
 const before=count();
 // Reach the file quota with small records, without allocating large files in tests.
 for(let i=before;i<100;i++)sql(`USE chinalife_test; INSERT INTO chinalife_media(id,user_id,mime,width,height,bytes,created_at) VALUES('${crypto.randomBytes(12).toString('hex')}',12,'image/png',120,120,'x',NOW())`);
 assert.equal((await call(12,'partner.php','POST',{action:'upload',image:png(120,120)})).httpStatus,409);
 assert.equal(count(),100);
 sql("USE chinalife_test; UPDATE chinalife_songs SET bytes=524288000 WHERE user_id=12 LIMIT 1");
 const r=await fetch(base+'/api/v4/chinalife/partner.php?action=upload_song&title=Quota&duration=30',{method:'POST',headers:{Authorization:'Bearer test-12','content-type':'audio/mpeg'},body:Buffer.from('ID3testaudio')});
 assert.equal(r.status,409);assert.match((await r.json()).message,/storage limit/);
});

test('server economy records jobs, night missions and purchases and ignores client totals',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id=5; DELETE FROM chinalife_economy_actions WHERE user_id=5; DELETE FROM chinalife_balances WHERE user_id=5; DELETE FROM chinalife_saves WHERE user_id=5');
 const created=await call(5,'save.php','POST',{revision:0,save:{character:{},game:{...game(),job:'cafe-job',promotion:1,place:'cafe',money:10000,xp:9000}}});
 assert.equal(created.httpStatus,200,created.message);
 assert.equal(created.data.money,3200,'a new character cannot invent a coin total');
 assert.equal(created.data.xp,0);
 assert.equal((await call(null,'economy.php')).httpStatus,401);
 const empty=await call(5,'economy.php','POST',{action:'job',job:'cafe-job',style:'focus'});
 assert.equal(empty.httpStatus,403,'a shift needs a live presence at work');
 await call(5,'presence.php','POST',presence('Shenyang','cafe'));
 const shift=await call(5,'economy.php','POST',{action:'job',job:'cafe-job',style:'focus'});
 assert.equal(shift.httpStatus,200,shift.message);assert.equal(shift.data.awarded,184);assert.equal(shift.data.awardedXp,25);assert.equal(shift.data.money,3384);assert.equal(shift.data.xp,25);assert.equal(shift.data.duplicate,false);
 const again=await call(5,'economy.php','POST',{action:'job',job:'cafe-job',style:'steady'});
 assert.equal(again.httpStatus,200);assert.equal(again.data.duplicate,true);assert.equal(again.data.money,3384);
 assert.equal((await call(5,'economy.php','POST',{action:'job',job:'teacher',style:'steady'})).httpStatus,409);
 const saved=(await call(5,'save.php')).data;
 assert.equal(saved.save.game.money,3384);assert.equal(saved.save.game.xp,25);
 await call(5,'presence.php','POST',presence('Shenyang','night'));
 for(const key of ['entry','soft','vibe','dance']){const m=await call(5,'economy.php','POST',{action:'mission',key});assert.equal(m.httpStatus,200,m.message);assert.equal(m.data.bonus,false)}
 const bonus=await call(5,'economy.php','POST',{action:'mission',key:'work'});
 assert.equal(bonus.httpStatus,200,bonus.message);assert.equal(bonus.data.bonus,true);assert.equal(bonus.data.awarded,500);assert.equal(bonus.data.awardedXp,100);assert.equal(bonus.data.money,3884);assert.equal(bonus.data.xp,125);
 assert.equal((await call(5,'economy.php','POST',{action:'mission',key:'work'})).data.duplicate,true);
 const broke=await call(5,'economy.php','POST',{action:'purchase',sku:'club-owner:night',place:'night'});
 assert.equal(broke.httpStatus,409);
 const entry=await call(5,'economy.php','POST',{action:'purchase',sku:'club-entry',place:'night'});
 assert.equal(entry.httpStatus,200,entry.message);assert.equal(entry.data.money,3824);assert.equal(entry.data.duplicate,false);
 assert.equal((await call(5,'economy.php','POST',{action:'purchase',sku:'club-entry',place:'night'})).data.duplicate,true);
 const totals=await call(5,'economy.php');assert.equal(totals.data.money,3824);assert.equal(totals.data.xp,125);
 const board=await call(5,'leaderboard.php');assert.equal(board.data.players.find(p=>p.id==='5').xp,125);
 // An edited save cannot set totals: device earnings are accepted only within the cap (save.php: ¥20,000 per rolling hour, +300 XP plus 30 per minute since the last save).
 const last=(await call(5,'save.php')).data,inflated=await call(5,'save.php','POST',{revision:last.revision,save:{character:{},game:{...last.save.game,money:999999,xp:999999}}});
 assert.equal(inflated.httpStatus,200,inflated.message);assert.equal(inflated.data.money,3824+20000);assert.ok(inflated.data.xp>=125+300&&inflated.data.xp<=125+330,String(inflated.data.xp));
});

test('Gist Night shows an anonymous handle, keeps the author for admins, and counts reactions and one poll vote',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (1,5,6)');
 const posted=await call(5,'gist-night.php','POST',{action:'post',city:'Shenyang',body:'The square is glowing.',poll:{question:'Stay out?',options:['Yes','No']}});
 assert.equal(posted.httpStatus,200,posted.message);
 // Players see only an 'Anonymous tip' tag (Gossip redesign); the night-xxxxxx handle and author are for admins.
 const pub=await call(6,'gist-night.php?city=Shenyang');const post=pub.data.posts[0];
 assert.equal(post.id,posted.data.id);assert.equal(post.tag,'Anonymous tip');assert.equal(post.handle,undefined);assert.equal(post.user_id,undefined);assert.equal(post.body,'The square is glowing.');
 const admin=await call(1,'gist-night.php?city=Shenyang');assert.equal(admin.data.posts[0].user_id,'5');assert.match(admin.data.posts[0].handle,/^night-[0-9a-f]{6}$/);assert.equal(admin.data.admin,true);
 const react=await call(6,'gist-night.php','POST',{action:'react',city:'Shenyang',id:+post.id,kind:'fire'});
 assert.equal(react.data.posts[0].reactions.fire,1);assert.equal(react.data.posts[0].mine,'fire');
 const off=await call(6,'gist-night.php','POST',{action:'react',city:'Shenyang',id:+post.id,kind:'fire'});assert.equal(off.data.posts[0].reactions.fire,0);
 const vote=await call(6,'gist-night.php','POST',{action:'vote',city:'Shenyang',poll:+post.poll.id,option:0});
 assert.equal(vote.httpStatus,200,vote.message);assert.equal(vote.data.posts[0].poll.options[0].votes,1);assert.equal(vote.data.posts[0].poll.voted,0);
 assert.equal((await call(6,'gist-night.php','POST',{action:'vote',city:'Shenyang',poll:+post.poll.id,option:1})).httpStatus,409);
});

test('City Hall records one vote per player per office per election and publishes results',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (5,6,7); DELETE FROM chinalife_election_votes; DELETE FROM chinalife_elections; DELETE FROM chinalife_politics_candidates WHERE candidate_id IN (5,6)');
 assert.equal((await call(5,'politics.php','POST',{city:'Shenyang',office:'governor',statement:'Light the square.'})).httpStatus,200);
 sql("USE chinalife_test; UPDATE chinalife_politics_candidates SET status='approved' WHERE candidate_id=5 AND office='governor'");
 const before=await call(6,'elections.php?city=Shenyang');const gov=before.data.elections.find(e=>e.office==='governor');
 assert.equal(gov.candidates[0].name,'user5');assert.equal(gov.candidates[0].votes,0);assert.equal(gov.open,false);
 const cast=await call(6,'elections.php','POST',{city:'Shenyang',office:'governor',candidate:+gov.candidates[0].id});
 assert.equal(cast.httpStatus,200,cast.message);assert.equal(cast.data.elections.find(e=>e.office==='governor').candidates[0].votes,1);assert.equal(cast.data.elections.find(e=>e.office==='governor').mine,gov.candidates[0].id);
 assert.equal((await call(6,'elections.php','POST',{city:'Shenyang',office:'governor',candidate:+gov.candidates[0].id})).httpStatus,409);
 assert.equal((await call(7,'elections.php','POST',{city:'Shenyang',office:'governor',candidate:+gov.candidates[0].id})).httpStatus,200);
 sql('USE chinalife_test; UPDATE chinalife_elections SET ends_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE)');
 const closed=await call(6,'elections.php?city=Shenyang&results=1');const done=closed.data.elections.find(e=>e.office==='governor');
 assert.equal(done.open,false);assert.equal(done.candidates[0].votes,2);assert.equal(closed.data.results,true);
 const again=await call(6,'elections.php','POST',{city:'Shenyang',office:'governor',candidate:+gov.candidates[0].id});
 assert.equal(again.httpStatus,200,again.message);assert.notEqual(again.data.election,done.id);
});

test('City Mystery accepts clue objects only in route order and only at the venue',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id=5; DELETE FROM chinalife_mystery_finds WHERE user_id=5');
 assert.equal((await call(5,'mystery.php','POST',{city:'Shenyang',object:'plaza-lantern'})).httpStatus,403);
 await call(5,'presence.php','POST',presence('Shenyang','plaza'));
 assert.equal((await call(5,'mystery.php','POST',{city:'Shenyang',object:'park-bench'})).httpStatus,409);
 const first=await call(5,'mystery.php','POST',{city:'Shenyang',object:'plaza-lantern'});
 assert.equal(first.httpStatus,200,first.message);assert.equal(first.data.verified,true);assert.match(first.data.clue,/park bench/);assert.equal(first.data.next.object,'park-bench');assert.equal(first.data.next.place,'park');
 await call(5,'presence.php','POST',presence('Shenyang','park'));
 const second=await call(5,'mystery.php','POST',{city:'Shenyang',object:'park-bench'});
 assert.equal(second.data.next.object,'night-poster');assert.equal(second.data.clues.length,2);
 const route=await call(5,'mystery.php?city=Shenyang');assert.deepEqual(route.data.found,['plaza-lantern','park-bench']);assert.equal(route.data.next.place,'night');
});

test('Party Night runs a timed dance, takes one vote each and names the winner',async()=>{
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (5,6); DELETE FROM chinalife_party_votes; DELETE FROM chinalife_party_entries; DELETE FROM chinalife_party_rounds');
 await call(5,'presence.php','POST',presence('Shenyang','night'));await call(6,'presence.php','POST',presence('Shenyang','night'));
 const joined=await call(5,'party.php','POST',{action:'join',city:'Shenyang',place:'night'});
 assert.equal(joined.httpStatus,200,joined.message);assert.equal(joined.data.round.phase,'dance');assert.equal(joined.data.round.joined,true);
 assert.equal((await call(6,'party.php','POST',{action:'join',city:'Shenyang',place:'night'})).httpStatus,200);
 assert.equal((await call(5,'party.php','POST',{action:'vote',city:'Shenyang',place:'night',dancer:6})).httpStatus,409);
 sql('USE chinalife_test; UPDATE chinalife_party_rounds SET dance_ends=DATE_SUB(NOW(),INTERVAL 1 SECOND), vote_ends=DATE_ADD(NOW(),INTERVAL 2 MINUTE)');
 assert.equal((await call(6,'party.php','POST',{action:'vote',city:'Shenyang',place:'night',dancer:6})).httpStatus,409);
 const vote=await call(5,'party.php','POST',{action:'vote',city:'Shenyang',place:'night',dancer:6});
 assert.equal(vote.httpStatus,200,vote.message);assert.equal(vote.data.round.entries.find(e=>e.id==='6').votes,1);assert.equal(vote.data.round.mine,'6');
 assert.equal((await call(5,'party.php','POST',{action:'vote',city:'Shenyang',place:'night',dancer:6})).httpStatus,409);
 sql('USE chinalife_test; UPDATE chinalife_party_rounds SET vote_ends=DATE_SUB(NOW(),INTERVAL 1 SECOND)');
 const done=await call(6,'party.php?city=Shenyang&place=night');
 assert.equal(done.data.round.phase,'closed');assert.equal(done.data.round.winner,'6');assert.match(done.data.round.title,/user6 · Dance Champion/);
});

// University Years Phase 3: calendar from the enrolment date, Sunday exams made and graded on the server, resits.
test('university years: enrolment, weekly calendar, server-graded Sunday exam, resit and saves that keep progress',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(21,'user21')");
 const uni=(today,data)=>fetch(base+'/api/v4/chinalife/university.php',{method:data?'POST':'GET',headers:{Authorization:'Bearer test-21','X-Test-Today':today,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/chinese-course.js','utf8'),ctx);const words=ctx.window.ChinaLifeChinese.allWords;
 const solve=q=>{const m=q.prompt.match(/^What does (.+) \(/),w=q.prompt.match(/^How do you write “(.+)” in Chinese/),p=q.prompt.match(/^How do you say (.+)\?$/);
  const hit=m?words.find(x=>x.han===m[1]):w?words.find(x=>x.en===w[1]&&q.options.includes(x.han)):words.find(x=>x.han===p[1]);return m?hit.en:w?hit.han:hit.pin};
 assert.equal((await uni('2026-11-04')).httpStatus,403,'switched off by default');
 try{
  assert.equal((await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:true}})).status,'success');
  assert.equal((await call(21,'save.php','POST',{revision:0,save:{character:{},game:game()}})).httpStatus,200);
  // Wednesday 4 Nov 2026: Year 1 started on Monday the 2nd. Rooms of later years are locked. No exam on a class day.
  let s=await uni('2026-11-04');assert.equal(s.student,true);assert.equal(s.start,'2026-11-02');assert.equal(s.year,1);assert.equal(s.dayName,'Class day');assert.equal(s.examDay,false);
  assert.deepEqual(s.rooms.filter(r=>r.open).map(r=>r.id),['classrooms','dorm','store']);
  assert.equal((await call(21,'save.php')).data.revision,1,'enrolling does not move the save revision, so an open game keeps saving');
  assert.equal((await uni('2026-11-04',{action:'start_exam',year:1})).httpStatus,409);
  // Sunday: the Year 1 exam opens; questions come without answers; a wrong paper fails and cannot be retaken that day.
  s=await uni('2026-11-08');assert.equal(s.examDay,true);assert.deepEqual(s.exams,[1]);
  let e=await uni('2026-11-08',{action:'start_exam',year:1});assert.equal(e.exam.questions.length,10);assert.ok(!JSON.stringify(e.exam).includes('answer'));
  let r=await uni('2026-11-08',{action:'submit_exam',answers:[]});assert.equal(r.result.passed,false);assert.equal(r.result.score,0);assert.deepEqual(r.exams,[]);
  assert.equal((await uni('2026-11-08',{action:'start_exam',year:1})).httpStatus,409);
  // A device save never wipes university progress or attendance (both written only by their endpoints).
  sql("USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,'$.attendance',JSON_OBJECT('since','2026-11-02','days',JSON_ARRAY('2026-11-04'))) WHERE user_id=21");
  const saved=await call(21,'save.php');assert.equal((await call(21,'save.php','POST',{revision:saved.data.revision,save:{character:{},game:{...saved.data.save.game,university:null}}})).httpStatus,200);
  assert.equal(JSON.parse(sql("USE chinalife_test; SELECT JSON_EXTRACT(game_state,'$.attendance.days') FROM chinalife_saves WHERE user_id=21")).join(),'2026-11-04');
  // Next Sunday is Year 2: the library opens, Year 1 is a resit next to the Year 2 exam. Passing pays XP and coins once.
  s=await uni('2026-11-15');assert.equal(s.year,2);assert.deepEqual(s.resits,[1]);assert.deepEqual(s.exams,[1,2]);assert.equal(s.rooms.find(x=>x.id==='library').open,true);
  e=await uni('2026-11-15',{action:'start_exam',year:1});r=await uni('2026-11-15',{action:'submit_exam',answers:e.exam.questions.map(solve)});
  assert.equal(r.result.passed,true,JSON.stringify(r.result));assert.equal(r.result.score,10);assert.equal(r.result.xp,60);assert.equal(r.result.coins,120);assert.deepEqual(r.exams,[2]);assert.deepEqual(r.resits,[]);
  // Thursday enrolment is orientation until next Monday; after four weeks the year stays at 4.
  sql("USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_REMOVE(game_state,'$.university') WHERE user_id=21");
  s=await uni('2026-11-05');assert.equal(s.orientation,true);assert.equal(s.start,'2026-11-09');assert.equal(s.dayName,'Orientation');
  s=await uni('2026-12-30');assert.equal(s.year,4);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:false}})}
});

test('university and attendance rewards paid by the server stay paid after the game saves again',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(22,'user22')");
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:true}});
  assert.equal((await call(22,'save.php','POST',{revision:0,save:{character:{},game:{...game(),place:'campus'}}})).httpStatus,200);
  const t=harness(null),c=t.context;c.HafrikSession={token:'test-22',user:{id:22}};c.URLSearchParams=URLSearchParams;
  c.fetch=(url,opts={})=>{const u=new URL(url);return fetch(base+u.pathname+u.search,u.pathname.endsWith('university.php')?{...opts,headers:{...(opts.headers||{}),'X-Test-Today':today}}:opts)};let today='2026-11-04';
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);await c.ChinaLifeCloud.ready;
  const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/chinese-course.js','utf8'),ctx);const W=ctx.window.ChinaLifeChinese.allWords;
  const solve=q=>{const m=q.prompt.match(/^What does (.+) \(/),w=q.prompt.match(/^How do you write “(.+)” in Chinese/),p=q.prompt.match(/^How do you say (.+)\?$/);return m?W.find(x=>x.han===m[1]).en:w?W.find(x=>x.en===w[1]&&q.options.includes(x.han)).han:W.find(x=>x.han===p[1]).pin};
  await c.ChinaLifeCloud.university();today='2026-11-08';
  const money=t.game.state.money,xp=t.game.state.xp;
  const paper=(await c.ChinaLifeCloud.university({action:'start_exam',year:1})).exam;const d=await c.ChinaLifeCloud.university({action:'submit_exam',answers:paper.questions.map(solve)});
  assert.equal(d.result.passed,true);assert.equal(t.game.state.money,money+120);assert.equal(t.game.state.xp,xp+60);
  // Attendance at the campus pays ¥30 + 15 XP on the server; the device shows it at once.
  await call(22,'presence.php','POST',{...presence('China','campus')});const a=await c.ChinaLifeCloud.attendance(true);assert.equal(a.event,'present');
  assert.equal(t.game.state.money,money+150);assert.equal(t.game.state.xp,xp+75);
  // The next device save must not read the old totals as spending.
  t.game.state.needs.fun=Math.max(0,t.game.state.needs.fun-1);await c.ChinaLifeCloud.upload();
  const s=(await call(22,'save.php')).data.save.game;assert.equal(s.money,money+150);assert.equal(s.xp,xp+75);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:false}})}
});

// University Years Phase 4: timetable, class check-in from the classroom, attendance score and the exam pass mark.
test('university classes: check-in window, presence at campus, attendance score, truancy risk and a harder exam',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(23,'user23')");
 const uni=(now,data)=>fetch(base+'/api/v4/chinalife/university.php',{method:data?'POST':'GET',headers:{Authorization:'Bearer test-23','X-Test-Today':now,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 const st=s=>s.timetable.map(c=>c.id+':'+c.status).join(' ');
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:true}});
  assert.equal((await call(23,'save.php','POST',{revision:0,save:{character:{},game:{...game(),place:'campus'}}})).httpStatus,200);
  // Monday 2 Nov, 08:00: enrolled, Year 1 starts today; two classes ahead, full attendance, the easiest pass mark.
  let s=await uni('2026-11-02 08:00');assert.equal(s.start,'2026-11-02');assert.equal(st(s),'am:later pm:later');assert.equal(s.timetable[0].time,'09:00');assert.equal(s.attendance,100);assert.equal(s.passMark,5);
  assert.equal((await uni('2026-11-02 08:00',{action:'attend'})).httpStatus,409,'too early');
  // 08:58: check-in opens (the phone buzzes now). Only from the campus.
  await call(23,'presence.php','POST',{...presence('China','home')});assert.match((await uni('2026-11-02 08:58',{action:'attend'})).message,/Go to your campus/);
  await call(23,'presence.php','POST',{...presence('China','campus')});let a=await uni('2026-11-02 08:58',{action:'attend'});
  assert.equal(a.httpStatus,200);assert.deepEqual(a.attended,{id:'am',subject:'Chinese class',xp:10,coins:10});assert.equal(st(a),'am:attended pm:later');
  assert.match((await uni('2026-11-02 09:10',{action:'attend'})).message,/already checked in/);
  // 15:00: the 14:00 lecture was missed: 100 → 90, still the easy mark.
  s=await uni('2026-11-02 15:00');assert.equal(st(s),'am:attended pm:missed');assert.equal(s.attendance,90);assert.equal(s.passMark,5);
  // Tuesday evening, both missed: 70, pass mark 6. Friday evening: 10, truancy risk, pass mark 7.
  s=await uni('2026-11-03 18:00');assert.equal(s.attendance,70);assert.equal(s.passMark,6);assert.equal(s.truancy,false);
  s=await uni('2026-11-06 18:00');assert.equal(s.attendance,10);assert.equal(s.truancy,true);assert.equal(s.passMark,7);
  s=await uni('2026-11-07 10:00');assert.equal(s.classDay,false);assert.deepEqual(s.timetable,[]);
  // Sunday: the Year 1 exam needs 7/10 now.
  s=await uni('2026-11-08 10:00');assert.equal(s.passMarks['1'],7);assert.equal((await uni('2026-11-08 10:00',{action:'start_exam',year:1})).exam.passMark,7);
  // Year 2 starts fresh at 100.
  s=await uni('2026-11-09 08:00');assert.equal(s.year,2);assert.equal(s.attendance,100);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:false}})}
});

// University Years Phase 5: the ¥100 daily student allowance is paid on the server and stays paid after device saves.
test('student allowance: switch, once per Beijing day, students only, and the money survives the next save',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(24,'user24'),(25,'user25')");
 const pay=(id,today,post=true)=>fetch(base+'/api/v4/chinalife/allowance.php',{method:post?'POST':'GET',headers:{Authorization:'Bearer test-'+id,'X-Test-Today':today,...(post?{'content-type':'application/json'}:{})},body:post?'{}':undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 assert.equal((await pay(24,'2026-11-02')).httpStatus,403,'switched off by default');
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_food:true}});
  assert.equal((await call(24,'save.php','POST',{revision:0,save:{character:{},game:game()}})).httpStatus,200);
  assert.equal((await call(25,'save.php','POST',{revision:0,save:{character:{},game:{...game(),background:'Worker'}}})).httpStatus,200);
  assert.equal((await pay(25,'2026-11-02')).student,false,'only students');
  // Through a real game client: the ¥100 shows at once and stays after the next device save.
  const t=harness(null),c=t.context;c.HafrikSession={token:'test-24',user:{id:24}};c.URLSearchParams=URLSearchParams;
  c.fetch=(url,opts={})=>{const u=new URL(url);return fetch(base+u.pathname+u.search,u.pathname.endsWith('allowance.php')?{...opts,headers:{...(opts.headers||{}),'X-Test-Today':'2026-11-02'}}:opts)};
  await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);await c.ChinaLifeCloud.ready;
  const money=t.game.state.money;assert.equal((await pay(24,'2026-11-02',false)).waiting,true);
  const d=await c.ChinaLifeCloud.allowance();assert.equal(d.paid,100);assert.equal(t.game.state.money,money+100);
  assert.equal((await c.ChinaLifeCloud.allowance()).paid,0,'once a day');assert.equal(t.game.state.money,money+100);
  t.game.state.needs.fun=Math.max(0,t.game.state.needs.fun-1);await c.ChinaLifeCloud.upload();
  const s=(await call(24,'save.php')).data.save.game;assert.equal(s.money,money+100);assert.equal(s.allowance.day,'2026-11-02');
  // The next Beijing day pays again.
  const next=await pay(24,'2026-11-03');assert.equal(next.paid,100);assert.equal(next.total,200);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_food:false}})}
});

// The admin edits University Years from appadmin: settings over the defaults, and fixes to one student's record.
test('university admin: settings checked and applied (allowance, classes, pass marks, wardrobe), and student record fixes',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(34,'user34'),(35,'user35')");
 const uni=(id,now,data)=>fetch(base+'/api/v4/chinalife/university.php',{method:data?'POST':'GET',headers:{Authorization:'Bearer test-'+id,'X-Test-Today':now,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 const set=settings=>call(1,'admin.php','POST',{action:'set_university_settings',settings});
 assert.equal((await call(2,'admin.php','POST',{action:'university_settings'})).httpStatus,403,'admins only');
 const d=(await call(1,'admin.php','POST',{action:'university_settings'})).data;assert.equal(d.settings.allowance,100);assert.equal(d.settings.classes.length,2);assert.equal(d.settings.wardrobe['jacket-varsity'][0],'year:2');
 try{
  for(const bad of [{allowance:-1},{passGood:8,passNormal:6},{classes:[{time:'09:00',subject:'A'},{time:'09:20',subject:'B'}]},{classes:[]},{food:{caviar:5}},{wardrobe:{'jacket-varsity':['year:9','']}},{examQuestions:5}])
   assert.equal((await set(bad)).httpStatus,400,JSON.stringify(bad));
  assert.equal((await set({allowance:150,mealPrice:30,passNormal:4,passGood:3,passTruant:5,examXp:99,classes:[{id:'am',time:'08:00',subject:'Morning Chinese'},{time:'16:30',subject:'Culture'}],food:{rice:5},wardrobe:{'chain':['','xp:10']}})).httpStatus,200);
  const s=(await call(1,'admin.php','POST',{action:'university_settings'})).data;assert.equal(s.settings.allowance,150);assert.deepEqual(s.settings.wardrobe,{chain:['','xp:10']});assert.equal(s.settings.food.rice,5);assert.equal(s.settings.food.egg,2);
  assert.match(s.log[0].note,/Daily allowance \(¥\): 100 → 150/);
  const pub=await call(34,'uni-settings.php');assert.equal(pub.data.allowance,150);assert.equal(pub.data.mealPrice,30);assert.deepEqual(pub.data.wardrobe,{chain:['','xp:10']});
  // The game reads them: the timetable, pass marks and the allowance amount.
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:true,uni_food:true}});
  assert.equal((await call(34,'save.php','POST',{revision:0,save:{character:{},game:game()}})).httpStatus,200);
  const v=await uni(34,'2026-11-02 08:01');assert.deepEqual(v.timetable.map(c=>[c.id,c.time,c.subject,c.status]),[['am','08:00','Morning Chinese','now'],[v.timetable[1].id,'16:30','Culture','later']]);assert.equal(v.passMark,3);
  const pay=await fetch(base+'/api/v4/chinalife/allowance.php',{method:'POST',headers:{Authorization:'Bearer test-34','X-Test-Today':'2026-11-02','content-type':'application/json'},body:'{}'}).then(r=>r.json());assert.equal((pay.data||pay).paid,150);
  // Student record fixes, in the audit log, with no reward paid.
  const before=(await call(34,'save.php')).data.save.game.money;const fix=data=>call(1,'admin.php','POST',{action:'student_update',user_id:34,...data});
  assert.equal((await fix({op:'year',year:3})).data.university.year,3);
  const passed=await fix({op:'pass',year:1});assert.equal(passed.data.university.results['1'].passed,true);assert.equal(passed.data.university.passedYears,1);
  assert.equal((await fix({op:'unpass',year:1})).data.university.passedYears,0);
  const m=await fix({op:'major',major:'physics'});assert.equal(m.data.university.lab.major,'physics');
  assert.equal((await fix({op:'attendance',points:30})).data.university.attendance,Math.min(100,m.data.university.attendance+30));
  assert.ok((await fix({op:'graduate'})).data.university.graduation.graduated);
  let g=(await call(34,'save.php')).data.save.game;assert.ok(g.student.graduated);assert.equal(g.money,before,'admin fixes pay nothing');
  assert.equal((await fix({op:'ungraduate'})).data.university.graduation.graduated,null);
  assert.equal((await fix({op:'allowance'})).data.allowance.day,'');
  assert.equal((await fix({op:'restart'})).data.university,null);g=(await call(34,'save.php')).data.save.game;assert.equal(g.university,undefined);
  assert.equal((await fix({op:'year',year:7})).httpStatus,400);
  assert.equal((await call(35,'save.php','POST',{revision:0,save:{character:{},game:{...game(),background:'Worker'}}})).httpStatus,200);
  assert.equal((await call(1,'admin.php','POST',{action:'student_update',user_id:35,op:'graduate'})).httpStatus,409,'students only');
  assert.equal((await call(1,'admin.php','POST',{action:'student',user_id:35})).data.student,false);
  // Reset to defaults stores nothing over them.
  assert.equal((await set(d.defaults)).httpStatus,200);assert.equal((await call(34,'uni-settings.php')).data.allowance,100);
 }finally{await set(d.defaults);await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:false,uni_food:false}})}
});

// University Years Phase 6: library reading sessions win back attendance points from Year 2.
test('university library: opens in Year 2, on campus, 2 sessions a day, wins back attendance (double on Saturday)',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(26,'user26')");
 const uni=(now,data)=>fetch(base+'/api/v4/chinalife/university.php',{method:data?'POST':'GET',headers:{Authorization:'Bearer test-26','X-Test-Today':now,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:true}});
  assert.equal((await call(26,'save.php','POST',{revision:0,save:{character:{},game:{...game(),place:'campus'}}})).httpStatus,200);
  await call(26,'presence.php','POST',{...presence('China','campus')});
  let s=await uni('2026-11-02 08:00');assert.equal(s.library.open,false);assert.match((await uni('2026-11-02 08:00',{action:'start_library'})).message,/opens in Year 2/);
  // Monday of Year 2, 15:00: both classes missed (80). A good session: 3 words read, 3 right, +5 attendance, +15 knowledge.
  s=await uni('2026-11-09 15:00');assert.equal(s.year,2);assert.equal(s.attendance,80);assert.deepEqual(s.library,{open:true,today:0,perDay:2,points:5});
  let l=await uni('2026-11-09 15:00',{action:'start_library'});assert.equal(l.session.words.length,3);assert.ok(!JSON.stringify(l.session.questions).includes('answer'));
  let r=await uni('2026-11-09 15:00',{action:'submit_library',answers:l.session.words.map(w=>w.en)});
  assert.deepEqual({...r.libraryResult,answers:undefined},{right:3,total:3,passed:true,points:5,knowledge:15,answers:undefined});assert.equal(r.attendance,85);assert.equal(r.knowledge,15);
  // A poor session wins nothing; a third one that day is refused.
  l=await uni('2026-11-09 16:00',{action:'start_library'});r=await uni('2026-11-09 16:00',{action:'submit_library',answers:[]});assert.equal(r.libraryResult.passed,false);assert.equal(r.attendance,85);
  assert.match((await uni('2026-11-09 17:00',{action:'start_library'})).message,/read enough today/);
  // Saturday is library day: a good session is worth 10.
  s=await uni('2026-11-14 10:00');assert.equal(s.library.points,10);const before=s.attendance;
  l=await uni('2026-11-14 10:00',{action:'start_library'});r=await uni('2026-11-14 10:00',{action:'submit_library',answers:l.session.words.map(w=>w.en)});assert.equal(r.attendance,before+10);
  // Only from the campus.
  await call(26,'presence.php','POST',{...presence('China','home')});assert.match((await uni('2026-11-15 10:00',{action:'start_library'})).message,/on your campus/);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:false}})}
});

// University Years Phase 7: choose a major in Year 3, then daily lab sessions marked on the server.
test('university lab: major chosen once in Year 3, one session a day on campus, terms, experiment order and instruction',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(27,'user27')");
 const uni=(now,data)=>fetch(base+'/api/v4/chinalife/university.php',{method:data?'POST':'GET',headers:{Authorization:'Bearer test-27','X-Test-Today':now,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 const php=fs.readFileSync('chinalife-api/university-lab.php','utf8');const terms=new Map([...php.matchAll(/\['([^']+)','([^']+)','([^']+)'\]/g)].map(m=>[m[1],m[3]]));
 const instr=new Map([...php.matchAll(/\['(请[^']+)','[^']+','([^']+)',\[/g)].map(m=>[m[1],m[2]]));
 const solve=l=>({action:'submit_lab',terms:l.terms.map(q=>terms.get(q.prompt.match(/^What does (.+) \(/)[1])),order:l.experiment.steps.map(s=>s.id).sort(),instruction:instr.get(l.instruction.han)});
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:true}});
  assert.equal((await call(27,'save.php','POST',{revision:0,save:{character:{},game:{...game(),place:'campus'}}})).httpStatus,200);
  await call(27,'presence.php','POST',{...presence('China','campus')});
  await uni('2026-11-02 08:00');assert.match((await uni('2026-11-09 10:00',{action:'choose_major',major:'cs'})).message,/in Year 3/);
  let s=await uni('2026-11-16 10:00');assert.equal(s.year,3);assert.equal(s.lab.open,true);assert.equal(s.lab.major,null);assert.deepEqual(s.lab.majors.map(m=>m.id),['cs','physics']);
  assert.match((await uni('2026-11-16 10:00',{action:'start_lab'})).message,/Choose your major first/);
  assert.equal((await uni('2026-11-16 10:00',{action:'choose_major',major:'chemistry'})).httpStatus,400);
  s=await uni('2026-11-16 10:00',{action:'choose_major',major:'cs'});assert.equal(s.major.name,'Computer Science');assert.equal(s.lab.majorName,'Computer Science');
  assert.match((await uni('2026-11-16 10:00',{action:'choose_major',major:'physics'})).message,/already chose/);
  // A session: 2 terms, 4 shuffled steps, 1 instruction; answers never sent. All right: pass, a credit, 20 XP, 20 knowledge.
  let l=(await uni('2026-11-16 10:00',{action:'start_lab'})).labSession;assert.equal(l.major,'Computer Science');assert.equal(l.terms.length,2);assert.equal(l.experiment.steps.length,4);assert.equal(l.instruction.options.length,4);
  assert.ok(!JSON.stringify(l).includes('answer'));
  let r=await uni('2026-11-16 10:00',solve(l));assert.equal(r.labResult.right,4,JSON.stringify(r.labResult));assert.equal(r.labResult.passed,true);assert.equal(r.labResult.xp,20);assert.equal(r.lab.credits,1);assert.equal(r.knowledge,20);
  assert.match((await uni('2026-11-16 15:00',{action:'start_lab'})).message,/One lab session a day/);
  // Next day: terms right but the experiment in the wrong order and the wrong action: 2 of 4, no credit.
  l=(await uni('2026-11-17 10:00',{action:'start_lab'})).labSession;const bad={...solve(l),order:solve(l).order.reverse(),instruction:'nope'};
  r=await uni('2026-11-17 10:00',bad);assert.equal(r.labResult.right,2);assert.equal(r.labResult.passed,false);assert.equal(r.labResult.order,false);assert.equal(r.lab.credits,1);
  await call(27,'presence.php','POST',{...presence('China','home')});assert.match((await uni('2026-11-18 10:00',{action:'start_lab'})).message,/on your campus/);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:false}})}
});

// University Years Phase 8: graduation with a self-introduction in Chinese, checked on the server.
test('university graduation: needs four passed years and a major, opens in Year 4, checks the Chinese self-introduction, pays once',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(28,'user28')");
 const uni=(now,data)=>fetch(base+'/api/v4/chinalife/university.php',{method:data?'POST':'GET',headers:{Authorization:'Bearer test-28','X-Test-Today':now,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 const good='我叫Ada。我是尼日利亚人。我在东北大学学习。我的专业是物理。毕业以后我想在中国工作。';
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:true}});
  assert.equal((await call(28,'save.php','POST',{revision:0,save:{character:{},game:game()}})).httpStatus,200);
  let s=await uni('2026-11-02 08:00');assert.equal(s.graduation.open,false);
  s=await uni('2026-11-23 10:00');assert.equal(s.year,4);assert.equal(s.graduation.open,true);assert.equal(s.graduation.ready,false);
  assert.deepEqual(s.graduation.missing,['Pass the Year 1 exam','Pass the Year 2 exam','Pass the Year 3 exam','Pass the Year 4 exam','Choose your major in the laboratory']);
  assert.match((await uni('2026-11-23 10:00',{action:'graduate',text:good})).message,/Pass the Year 1 exam/);
  sql(`USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,'$.university.results',JSON_OBJECT('1',JSON_OBJECT('passed',true),'2',JSON_OBJECT('passed',true),'3',JSON_OBJECT('passed',true),'4',JSON_OBJECT('passed',true)),'$.university.major','physics') WHERE user_id=28`);
  assert.match((await uni('2026-11-16 10:00',{action:'graduate',text:good})).message,/opens in Year 4/);
  s=await uni('2026-11-23 10:00');assert.equal(s.graduation.ready,true);
  // Too short and missing parts: nothing paid, the checklist says what is missing.
  let r=await uni('2026-11-23 10:00',{action:'graduate',text:'我叫Ada。我是学生。'});assert.equal(r.introResult.passed,false);assert.equal(r.introResult.han,8);
  assert.deepEqual(r.introResult.parts,{name:true,country:false,university:false,major:false,plan:false});assert.equal(r.graduation.graduated,null);
  // The major must be the student's own (Physics here, not computer science words).
  r=await uni('2026-11-23 10:00',{action:'graduate',text:good.replace('物理','计算机')});assert.equal(r.introResult.parts.major,false);
  r=await uni('2026-11-23 10:00',{action:'graduate',text:good});assert.equal(r.introResult.passed,true);assert.equal(r.introResult.coins,500);assert.equal(r.introResult.xp,200);
  assert.equal(r.graduation.graduated,'2026-11-23');assert.equal(r.graduation.intro,good);
  assert.match((await uni('2026-11-24 10:00',{action:'graduate',text:good})).message,/already graduated/);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{uni_years:false}})}
});

// University Years Phase 9: the server refuses new locked clothes in a save; items owned before stay.
test('wardrobe locks: a save cannot add a locked item before its milestone; owned items stay; first home unlocks',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(29,'user29')");
 const wardrobe=(owned,acc=[])=>({owned:['tee-basic','jeans','canvas',...owned],wearing:{top:'tee-basic',bottom:'jeans',shoes:'canvas',acc},colors:{}});
 const save=async g=>{const cur=await call(29,'save.php');return call(29,'save.php','POST',{revision:cur.data?.revision??0,save:{character:{},game:g}})};
 const base={...game(),background:'Worker'};
 // Before the switch: a gold chain is bought.
 assert.equal((await save({...base,wardrobe:wardrobe(['chain'])})).httpStatus,200);
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{wardrobe_locks:true}});
  assert.equal((await save({...base,wardrobe:wardrobe(['chain','luxwatch','leather-white'],['chain','luxwatch'])})).httpStatus,200);
  let w=(await call(29,'save.php')).data.save.game.wardrobe;
  assert.deepEqual(w.owned,['tee-basic','jeans','canvas','chain'],'the watch (Legend) and leather sneakers (first home) are refused; the chain stays');assert.deepEqual(w.wearing.acc,['chain']);
  // A first home unlocks the leather sneakers.
  assert.equal((await save({...base,properties:{Shenyang:'apartment'},wardrobe:wardrobe(['chain','leather-white'])})).httpStatus,200);
  w=(await call(29,'save.php')).data.save.game.wardrobe;assert.ok(w.owned.includes('leather-white'));
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{wardrobe_locks:false}})}
});

// University Years Phase 10: micro-customization details are cleaned on save, rare options need milestones, and other
// players receive the details of what you wear.
test('micro-customization: saves keep only valid details, rare options need their milestone, and presence shares them',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(30,'user30'),(31,'user31')");
 const save=async(id,g)=>{const cur=await call(id,'save.php');return call(id,'save.php','POST',{revision:cur.data?.revision??0,save:{character:{},game:g}})};
 const wardrobe=details=>({owned:['tee-basic','jeans','canvas','shirt-oxford','backpack'],wearing:{top:'shirt-oxford',bottom:'jeans',shoes:'canvas',acc:['backpack']},colors:{},details});
 const base={...game(),background:'Worker',city:'China',place:'campus'};
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{micro_style:true}});
  assert.equal((await save(30,{...base,wardrobe:wardrobe({'shirt-oxford':{btn:'#3fae8a',collar:'v',glitter:'yes'},jeans:{len:'crop',fit:'huge'},backpack:{col:'#c9a24a',graphic:'star'},handbag:{col:'#7a1f2b'}})})).httpStatus,200);
  // Jade buttons (Regular rank) and the gold bag (Shenyang Star) are refused at 0 XP; unknown fields and values go.
  let d=(await call(30,'save.php')).data.save.game.wardrobe.details;
  assert.deepEqual(d,{'shirt-oxford':{collar:'v'},jeans:{len:'crop'},backpack:{graphic:'star'}});
  // At Regular rank the jade buttons are allowed.
  sql("USE chinalife_test; UPDATE chinalife_balances SET xp=1600 WHERE user_id=30");
  await save(30,{...base,xp:1600,wardrobe:wardrobe({'shirt-oxford':{btn:'#3fae8a',collar:'v'},jeans:{len:'crop'},backpack:{graphic:'star'}})});
  d=(await call(30,'save.php')).data.save.game.wardrobe.details;assert.equal(d['shirt-oxford'].btn,'#3fae8a');
  // Another player in the same place sees the details of what user 30 wears.
  assert.equal((await save(31,{...base})).httpStatus,200);
  await call(30,'presence.php','POST',{...presence('China','campus')});const p=(await call(31,'presence.php','POST',{...presence('China','campus')})).data.players.find(x=>String(x.id)==='30');
  assert.deepEqual(p.details,{'shirt-oxford':{btn:'#3fae8a',collar:'v'},jeans:{len:'crop'},backpack:{graphic:'star'}});
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{micro_style:false}})}
});

// Gossip Room Phase 1 (docs/GOSSIP-ROOM-PLAN.md, switch gossip_show): Hot Seat Hour, 20:00-22:00 Beijing time. A busy
// seat queues gists (one per player); after each reveal the next goes live; the queue is dropped when the show ends.
test('Hot Seat Hour: queue during the show, next gist after the reveal, queue dropped after 22:00, off by default',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(36,'user36'),(37,'user37'),(38,'user38')");
 const hs=(id,now,data)=>fetch(base+'/api/v4/chinalife/hot-seat.php'+(data?'':'?city=China&place=gist'),{method:data?'POST':'GET',headers:{Authorization:'Bearer test-'+id,'X-Test-Today':now,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify({city:'China',place:'gist',...data}):undefined}).then(async r=>{const j=await r.json();return {...j,...(j.data||{}),httpStatus:r.status}});
 for(const id of [36,37,38])assert.equal((await call(id,'save.php','POST',{revision:0,save:{character:{},game:game()}})).httpStatus,200);
 for(const id of [36,37,38])assert.equal((await call(id,'presence.php','POST',presence('China','gist'))).httpStatus,200);
 const night='2026-11-02 20:30';
 assert.equal((await call(1,'admin.php','POST',{action:'set_hot_seat',enabled:true})).httpStatus,200);
 assert.deepEqual((await hs(36,night)).show,{on:false},'switched off by default');
 const t0=await hs(36,night,{action:'take',body:'Someone at the club paid for everybody tonight'});assert.equal(t0.httpStatus,200,t0.message);
 assert.equal((await hs(37,night,{action:'take',body:'The football captain is learning Chinese in secret'})).httpStatus,409,'no queue while the switch is off');
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_show:true}});
  const q1=await hs(37,night,{action:'take',body:'The football captain is learning Chinese in secret'});assert.equal(q1.httpStatus,200,q1.message);assert.equal(q1.queued,true);assert.equal(q1.show.my_queue,1);
  assert.match(q1.message,/#1 in the queue/);
  assert.equal((await hs(38,night,{action:'take',body:'A student cooked jollof for the whole dorm floor'})).show.my_queue,2);
  assert.equal((await hs(37,night,{action:'take',body:'Another gist from the same person here'})).httpStatus,409,'one waiting gist per player');
  const view=await hs(36,night);assert.equal(view.show.live,true);assert.equal(view.show.queue,2);assert.equal(view.show.start,'20:00');assert.equal(view.show.end,'22:00');assert.ok(view.show.audience>=1);
  assert.match(view.round.body,/paid for everybody/);
  // The first round ends; during its reveal the seat stays busy, then the next queued gist goes live.
  sql("USE chinalife_test; UPDATE chinalife_hot_seat SET closes_at=DATE_SUB(NOW(),INTERVAL 5 SECOND) WHERE user_id=36 AND status='voting'");
  assert.equal((await hs(36,night)).round.status,'revealed','the reveal is not cut short');
  sql("USE chinalife_test; UPDATE chinalife_hot_seat SET closes_at=DATE_SUB(NOW(),INTERVAL 60 SECOND) WHERE user_id=36");
  const next=await hs(37,night);assert.equal(next.round.status,'voting');assert.match(next.round.body,/football captain/);assert.equal(next.round.own,true);assert.equal(next.show.queue,1);
  // After the show the waiting gist is dropped, never shown.
  const late=await hs(38,'2026-11-02 23:00');assert.equal(late.show.live,false);assert.equal(late.show.queue,0);
  assert.equal(sql("USE chinalife_test; SELECT status FROM chinalife_hot_seat WHERE user_id=38").trim(),'dropped');
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_show:false}});sql("USE chinalife_test; DELETE FROM chinalife_hot_seat WHERE user_id IN (36,37,38)")}
});

// Gossip Room Phase 2 (switch gossip_wall): more reactions, anonymous replies, place tags and Gist of the day.
test('Gossip wall: new reactions and replies only with the switch, clean replies, place tags, Gist of the day',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(40,'user40'),(41,'user41'),(42,'user42'),(43,'user43')");
 const gn=(id,data)=>call(id,data?'gist-night.php':'gist-night.php?city=China',data?'POST':'GET',data?{city:'China',...data}:undefined);
 const post=await gn(40,{action:'post',body:'Who danced on the table at the #club last night?'});assert.equal(post.httpStatus,200,post.message);const id=+post.data.id;
 assert.equal((await gn(41,{action:'react',id,kind:'cap'})).httpStatus,400,'🧢 needs the switch');
 assert.equal((await gn(41,{action:'reply',id,body:'It was the DJ'})).httpStatus,403,'replies need the switch');
 assert.equal((await gn(41,'')).data?.posts?.[0]?.replies,undefined);
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_wall:true}});
  for(const [u,k] of [[41,'cap'],[42,'shock'],[43,'eyes']])assert.equal((await gn(u,{action:'react',id,kind:k})).httpStatus,200);
  const r1=await gn(41,{action:'reply',id,body:'It was the DJ, everyone saw'});assert.equal(r1.httpStatus,200,r1.message);
  assert.equal((await gn(40,{action:'reply',id,body:'I was there too'})).httpStatus,200);
  assert.equal((await gn(42,{action:'reply',id,body:'see https://example.com'})).httpStatus,422,'no links');
  assert.equal((await gn(42,{action:'reply',id,body:'x'})).httpStatus,422,'too short');
  const feed=(await gn(41)).data.posts,p=feed.find(x=>+x.id===id);
  assert.equal(p.place,'club');assert.equal(p.reply_count,2);assert.deepEqual(p.replies.map(r=>[r.body,r.op,r.own]),[['It was the DJ, everyone saw',false,true],['I was there too',true,false]]);
  assert.equal(p.reactions.cap,1);assert.equal(p.reactions.shock,1);assert.equal(p.reactions.eyes,1);assert.equal(p.mine,'cap');
  assert.equal(p.top,true,'3 reactions today: Gist of the day');assert.equal(p.replies[0].user_id,undefined,'players never see who replied');
  assert.equal((await gn(1)).data.posts.find(x=>+x.id===id).replies[0].user_id,'41','admins can trace a reply');
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_wall:false}});sql('USE chinalife_test; DELETE FROM chinalife_gist_night WHERE user_id=40')}
});

// Gossip Room Phase 3 (switch gossip_city): the city posts its own news to the Gossip wall, never with a name. Here a
// student crosses the 200 XP rank by attending class, and a "City buzz" tip appears (not "yours", not pinned).
test('City buzz: a real rank-up posts anonymous city news only with the switch, and a new tip id is cheap to check',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(44,'user44')");
 const latest=async()=>Number((await call(44,'gist-night.php?city=China&latest=1')).data.latest);
 assert.equal((await call(44,'save.php','POST',{revision:0,save:{character:{},game:{...game(),city:'China',background:'Student',xp:195,rankClaimed:0}}})).httpStatus,200);
 sql("USE chinalife_test; UPDATE chinalife_balances SET xp=195 WHERE user_id=44");
 assert.equal((await call(44,'presence.php','POST',presence('China','campus'))).httpStatus,200);
 const before=await latest();
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_city:true}});
  const att=await call(44,'attendance.php','POST',{});assert.equal(att.httpStatus,200,att.message);
  assert.ok(await latest()>before,'a new tip');
  const feed=(await call(44,'gist-night.php?city=China')).data.posts,buzz=feed.find(p=>p.auto);
  assert.ok(buzz,'City buzz on the wall');assert.match(buzz.body,/^🏅 Someone just reached the .+ rank/);assert.doesNotMatch(buzz.body,/user44/);
  assert.equal(buzz.tag,'City buzz');assert.equal(buzz.own,false,'never "yours", even for the player it is about');assert.equal(buzz.official,false,'not pinned');
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_city:false}});sql("USE chinalife_test; DELETE FROM chinalife_gist_night WHERE official=2")}
});

test('City buzz stays off by default and posts at most 4 of a kind per city per hour',async()=>{
 const lib=fs.readFileSync('chinalife-api/gossip-city-lib.php','utf8');
 assert.match(lib,/const CL_CITY_GOSSIP_HOURLY=4;/);assert.match(lib,/\$cap=function_exists\('cl_gossip_settings'\)\?cl_gossip_settings\(\)\['buzz_hourly'\]:CL_CITY_GOSSIP_HOURLY;if \(\$recent>=\$cap\) return false;/);
 assert.match(lib,/cl_hafrik_features\(\)\['gossip_city'\]\?\?false/);
 for(const [f,k] of [['common.php','rank'],['university.php','grad'],['football.php','football'],['hot-seat.php','hotseat']])assert.match(fs.readFileSync('chinalife-api/'+f,'utf8'),new RegExp("cl_city_gossip\\([^;]*'"+k+"','Someone|cl_city_gossip\\([^;]*'"+k+"','Full time"),f);
});

// Gossip Room Phase 5 (switch gossip_rep): gist rep (only your own) and the weekly Truth teller award, paid once.
test('gist rep and the weekly Truth teller award: top three of last week paid once with badges, rep only for yourself',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(45,'user45'),(46,'user46'),(47,'user47'),(48,'user48')");
 for(const id of [45,46,47,48])assert.equal((await call(id,'save.php','POST',{revision:0,save:{character:{},game:{...game(),city:'China'}}})).httpStatus,200);
 const hs=(u,result)=>`INSERT INTO chinalife_hot_seat(user_id,city,place,body,status,day,true_votes,cap_votes,result,created_at,closes_at) VALUES(${u},'China','gist','A test gist for the award','revealed',CURDATE(),${result==='true'?3:0},${result==='cap'?3:0},'${result}',DATE_SUB(NOW(),INTERVAL 7 DAY),DATE_SUB(NOW(),INTERVAL 7 DAY));`;
 sql('USE chinalife_test; DELETE FROM chinalife_settings WHERE name="gossip_award"; '+hs(45,'true')+hs(45,'true')+hs(46,'true')+hs(47,'cap')+
  "INSERT INTO chinalife_gist_night(user_id,city,body,official,created_at) VALUES(48,'China','A wall tip people liked',0,DATE_SUB(NOW(),INTERVAL 7 DAY));"+
  "INSERT INTO chinalife_gist_night_reactions(post_id,user_id,kind,created_at) SELECT LAST_INSERT_ID(),u.user_id,'fire',NOW() FROM users u WHERE u.user_id BETWEEN 2 AND 6;");
 const money=id=>Number(sql(`USE chinalife_test; SELECT coins FROM chinalife_balances WHERE user_id=${id}`).trim());
 const before={45:money(45),46:money(46),47:money(47),48:money(48)};
 assert.deepEqual((await call(45,'gossip-rep.php')).data,{on:false},'off by default');
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_rep:true}});
  const meR=await call(45,'gossip-rep.php');assert.equal(meR.httpStatus,200,meR.message);const me=meR.data;assert.equal(me.on,true);assert.equal(me.total,20);assert.deepEqual(me.last_week,{place:1,prize:1000});
  assert.equal(money(45)-before[45],1000);assert.equal(money(46)-before[46],500);assert.equal(money(48)-before[48],250);assert.equal(money(47),before[47],'a Cap author wins nothing');
  assert.match(sql("USE chinalife_test; SELECT name FROM chinalife_badges WHERE user_id=45"),/Truth teller . week of /);assert.equal(sql("USE chinalife_test; SELECT HEX(icon) FROM chinalife_badges WHERE user_id=45").trim(),'F09FA587','🥇');
  assert.deepEqual((await call(47,'gossip-rep.php')).data.total,-5);
  await call(46,'gossip-rep.php');assert.equal(money(46)-before[46],500,'paid once a week');
  assert.ok(!('gist_rep' in (await call(46,'profile.php?id=45')).data.profile),'never shown on other players\' profiles');
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_rep:false}});sql('USE chinalife_test; DELETE FROM chinalife_hot_seat WHERE user_id IN (45,46,47); DELETE FROM chinalife_gist_night WHERE user_id=48')}
});

// Gossip Room Phase 6: admin settings (Hot Seat Hour, queue, prizes, City buzz, blocked words), wall reports and one
// moderation queue. Admins see who posted; three reports hide a wall tip.
test('Gossip admin: settings checked and applied, extra blocked words, wall reports hide a tip, one moderation queue',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(49,'user49'),(50,'user50'),(51,'user51'),(52,'user52'); DELETE FROM chinalife_rate_limits WHERE user_id=1");
 const set=settings=>call(1,'admin.php','POST',{action:'set_gossip_settings',settings});
 assert.equal((await call(2,'admin.php','POST',{action:'gossip_settings'})).httpStatus,403);
 const d=(await call(1,'admin.php','POST',{action:'gossip_settings'})).data;assert.deepEqual(d.settings,{show_start:20,show_end:22,queue_max:10,prizes:[1000,500,250],buzz_hourly:4,words:[]});
 try{
  for(const bad of [{show_start:22,show_end:20},{queue_max:0},{prizes:[1,2]},{words:['x']},{buzz_hourly:99}])assert.equal((await set(bad)).httpStatus,400,JSON.stringify(bad));
  assert.equal((await set({show_start:18,show_end:19,prizes:[2000,800,300],words:['Jollofgate']})).httpStatus,200);
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_show:true,gossip_wall:true}});await call(1,'admin.php','POST',{action:'set_hot_seat',enabled:true});
  assert.equal((await call(49,'hot-seat.php?city=China&place=gist')).data.show.start,'18:00');
  assert.equal((await call(49,'gist-night.php','POST',{city:'China',action:'post',body:'Big jollofgate news at the club'})).httpStatus,422,'admin word blocked on the wall');
  // Three players report a tip: it leaves the feed, and the queue shows it with its author.
  const post=await call(49,'gist-night.php','POST',{city:'China',action:'post',body:'A tip that people will report'});const id=+post.data.id;
  for(const u of [50,51])assert.equal((await call(u,'gist-night.php','POST',{city:'China',action:'report',id})).httpStatus,200);
  assert.ok((await call(52,'gist-night.php?city=China')).data.posts.some(p=>+p.id===id),'two reports: still there');
  assert.equal((await call(52,'gist-night.php','POST',{city:'China',action:'report',id})).httpStatus,200);
  assert.ok(!(await call(50,'gist-night.php?city=China')).data.posts.some(p=>+p.id===id),'three reports: hidden from players');
  assert.ok((await call(1,'gist-night.php?city=China')).data.posts.find(p=>+p.id===id).hidden,'admins still see it, marked');
  const q=(await call(1,'admin.php','POST',{action:'gossip_queue'})).data.items.find(i=>i.kind==='wall'&&+i.id===id);
  assert.equal(q.author,'user49');assert.equal(q.reports,3);assert.equal(q.hidden,true);
  assert.equal((await call(1,'admin.php','POST',{action:'gossip_moderate',id,op:'restore'})).httpStatus,200);
  assert.ok((await call(50,'gist-night.php?city=China')).data.posts.some(p=>+p.id===id),'restored');
  assert.equal((await call(1,'admin.php','POST',{action:'gossip_moderate',id,op:'delete'})).httpStatus,200);
  assert.equal((await call(1,'admin.php','POST',{action:'gossip_moderate',id,op:'hide'})).httpStatus,404);
 }finally{await set(d.defaults);await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{gossip_show:false,gossip_wall:false}});sql('USE chinalife_test; DELETE FROM chinalife_gist_night WHERE user_id=49')}
});

// Hospital Phase 0 (switch hospital_care): waking up at the hospital. ¥200 from the ledger, first visit free, a
// repeat inside 10 minutes free, never below ¥0.
test('hospital bill: off by default, first visit free, recovering free, then ¥200, never more than you have',async()=>{
 sql("USE chinalife_test; INSERT INTO users(user_id,user_name) VALUES(53,'user53')");
 assert.equal((await call(53,'save.php','POST',{revision:0,save:{character:{},game:{...game(),city:'China'}}})).httpStatus,200);
 const coins=()=>Number(sql('USE chinalife_test; SELECT coins FROM chinalife_balances WHERE user_id=53').trim());
 const visit=cause=>call(53,'economy.php','POST',{action:'hospital',cause});
 assert.equal((await visit('faint')).httpStatus,403,'switched off by default');
 try{
  await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{hospital_care:true}});
  const start=coins();
  const first=await visit('faint');assert.equal(first.httpStatus,200,first.message);assert.equal(first.data.charged,0);assert.equal(first.data.first,true);assert.equal(coins(),start);
  const again=await visit('blackout');assert.equal(again.data.charged,0);assert.equal(again.data.recovering,true);
  assert.equal((await visit('nonsense')).httpStatus,400);
  sql("USE chinalife_test; UPDATE chinalife_economy_actions SET created_at=DATE_SUB(NOW(),INTERVAL 1 HOUR) WHERE user_id=53 AND action='hospital'");
  const paid=await visit('faint');assert.equal(paid.data.charged,200);assert.equal(paid.data.first,false);assert.equal(coins(),start-200);
  sql("USE chinalife_test; UPDATE chinalife_economy_actions SET created_at=DATE_SUB(NOW(),INTERVAL 1 HOUR) WHERE user_id=53 AND action='hospital'; UPDATE chinalife_balances SET coins=50 WHERE user_id=53");
  const broke=await visit('faint');assert.equal(broke.data.charged,50,'never below ¥0');assert.equal(coins(),0);
 }finally{await call(1,'admin.php','POST',{action:'set_hafrik_features',features:{hospital_care:false}})}
});
