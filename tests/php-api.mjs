import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {fixture,harness} from './game-harness.mjs';
import vm from 'node:vm';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chinalife-api-')),socket=path.join(tmp,'mysql.sock');
let mysql,php,base;
const sql=command=>execFileSync('mysql',['--no-defaults','--socket='+socket,'-u','root','--batch','--skip-column-names','-e',command],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const env={...process.env,CHINALIFE_TEST_SOCKET:socket};
async function waitFor(check){for(let i=0;i<100;i++){try{if(await check())return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test service failed to start')}
async function call(id,file,method='GET',data){const response=await fetch(base+'/api/v4/chinalife/'+file,{method,headers:{...(id?{Authorization:'Bearer test-'+id}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {...await response.json(),httpStatus:response.status}}
const presence=(city='Shenyang',place='plaza')=>({city,place,name:'Player',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2});
const game=()=>({...fixture(),city:'Shenyang'});
before(async()=>{
 execFileSync('mysqld',['--no-defaults','--initialize-insecure','--datadir='+path.join(tmp,'data')],{stdio:'ignore'});
 const log=fs.openSync(path.join(tmp,'mysql.log'),'a');mysql=spawn('mysqld',['--no-defaults','--datadir='+path.join(tmp,'data'),'--socket='+socket,'--skip-networking','--mysqlx=0','--pid-file='+path.join(tmp,'mysql.pid')],{stdio:['ignore',log,log]});
 await waitFor(()=>sql('SELECT 1').trim()==='1');
 sql('CREATE DATABASE chinalife_test; USE chinalife_test; CREATE TABLE users(user_id INT UNSIGNED PRIMARY KEY,user_name VARCHAR(100)); INSERT INTO users VALUES '+Array.from({length:12},(_,i)=>`(${i+1},'user${i+1}')`).join(','));
 const root=path.join(tmp,'web/api/v4');fs.mkdirSync(root,{recursive:true});fs.cpSync('chinalife-api',path.join(root,'chinalife'),{recursive:true});
 fs.writeFileSync(path.join(root,'db.php'),`<?php mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);`);
 fs.writeFileSync(path.join(root,'helpers.php'),`<?php function get_db_connection(){$db=new mysqli('localhost','root','','chinalife_test',0,getenv('CHINALIFE_TEST_SOCKET'));$db->set_charset('utf8mb4');return $db;} if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS'){http_response_code(204);exit;} function json_response($status,$data=null,$message=''){header('Content-Type: application/json');echo json_encode(compact('status','data','message'));exit;} function auth_user($db){$token=$_SERVER['HTTP_AUTHORIZATION']??'';if(!preg_match('/^Bearer test-([1-9][0-9]*)$/',$token,$m)){http_response_code(401);json_response('error',null,'Unauthorized');}$s=$db->prepare('SELECT * FROM users WHERE user_id=?');$id=(int)$m[1];$s->bind_param('i',$id);$s->execute();return $s->get_result()->fetch_assoc()?:[];}`);
 // Upgrade the schema already uploaded to the Hafrik server, twice, preserving its rows.
 for(const file of ['migration.sql','migration 2.sql','voice.sql'])sql('USE chinalife_test; '+fs.readFileSync('chinalife-api/'+file,'utf8'));
 sql(`USE chinalife_test; INSERT INTO chinalife_saves(user_id,character_data,game_state) VALUES(12,'{}','${JSON.stringify(game())}');`);
 for(let i=0;i<2;i++)execFileSync('php',[path.join(root,'chinalife/migrate.php')],{env,stdio:'pipe'});
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
test('presence preserves appearance, excludes self, separates cities and expires stale players',async()=>{
 for(const id of [1,2])assert.equal((await call(id,'presence.php','POST',presence())).httpStatus,200);
 let r=await call(1,'presence.php?city=Shenyang');assert.equal(r.data.players[0].id,'2');assert.equal(r.data.players[0].skin,'#8b5c43');assert.equal(r.data.players[0].hair,'cap');assert.equal(typeof r.data.players[0].x,'number');
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
 for(let id=3;id<=7;id++)await call(id,'presence.php','POST',presence());
 for(let id=3;id<=6;id++){const r=await call(id,'voice.php','POST',{...presence(),session:'session-'+id,muted:true,after:0,action:'join'});assert.equal(r.httpStatus,200);assert.equal(typeof r.data.id,'string');assert.equal(typeof r.data.members[0].id,'string');assert.equal(typeof r.data.members[0].muted,'boolean')}
 assert.equal((await call(7,'voice.php','POST',{...presence(),session:'session-7',muted:true,after:0,action:'join'})).httpStatus,409);
 assert.equal((await call(3,'voice-signal.php','POST',{...presence(),session:'session-3',peer:'4',peerSession:'wrong-session',payload:{type:'offer',sdp:'test'}})).httpStatus,403);
 assert.equal((await call(3,'voice-signal.php','POST',{...presence(),session:'session-3',peer:'4',peerSession:'session-4',payload:{type:'offer',sdp:'test'}})).httpStatus,200);
 let r=await call(4,'voice-signal.php?city=Shenyang&place=plaza&session=session-4&after=0');assert.equal(r.data.signals[0].sender,'3');assert.equal(r.data.signals[0].session,'session-3');
 await call(3,'voice.php','DELETE',{session:'old-session'});assert.equal((await call(3,'voice.php','POST',{...presence(),session:'session-3',muted:true,after:0,action:'pulse'})).httpStatus,200);
 sql("USE chinalife_test; UPDATE chinalife_voice_members SET seen_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE user_id=3");
 assert.equal((await call(3,'voice.php','POST',{...presence(),session:'session-3',muted:true,after:0,action:'pulse'})).httpStatus,403);
});
test('music uses Hafrik presence and queue limits',async()=>{
 await call(8,'presence.php','POST',presence('Shenyang','night'));
 for(let i=0;i<2;i++)assert.equal((await call(8,'music.php','POST',{city:'Shenyang',track:'neon'})).httpStatus,200);
 assert.equal((await call(8,'music.php','POST',{city:'Shenyang',track:'neon'})).httpStatus,429);
 assert.equal((await call(1,'music.php?city=Shenyang')).httpStatus,403);
 sql("USE chinalife_test; UPDATE chinalife_music SET started_at=0 WHERE city='Shenyang'");
 const r=await call(8,'music.php?city=Shenyang');assert.equal(r.data.track,'neon');assert.equal(r.data.queue.length,1);
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

test('leaderboard ranks saved accounts by XP and reports the caller position',async()=>{
 // Earlier tests may have saved these accounts, so update on top of their current revision.
 for(const [id,xp] of [[10,900],[11,4200]]){const cur=(await call(id,'save.php')).data;const r=await call(id,'save.php','POST',{revision:cur.revision||0,save:{character:{name:'x'},game:{...game(),transferTotal:cur.save?.game?.transferTotal??0,xp}}});assert.equal(r.httpStatus,200,r.message)}
 const board=await call(10,'leaderboard.php');assert.equal(board.httpStatus,200);const order=board.data.players.map(p=>p.id);assert.ok(order.indexOf('11')<order.indexOf('10'));assert.ok(board.data.players.find(p=>p.id==='10').own);assert.ok(board.data.position>=2);
 assert.equal((await call(null,'leaderboard.php')).httpStatus,401);
});
