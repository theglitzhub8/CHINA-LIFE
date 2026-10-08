import http from 'node:http';import crypto from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
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
const env={...process.env,CHINALIFE_TEST_SOCKET:socket,CHINALIFE_PUSH_TEST:'1'};
async function waitFor(check){for(let i=0;i<100;i++){try{if(await check())return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test service failed to start')}
async function call(id,file,method='GET',data){const response=await fetch(base+'/api/v4/chinalife/'+file,{method,headers:{...(id?{Authorization:'Bearer test-'+id}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {...await response.json(),httpStatus:response.status}}
const presence=(city='Shenyang',place='plaza')=>({city,place,name:'Player',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2});
const game=()=>({...fixture(),city:'Shenyang'});
before(async()=>{
 execFileSync('mysqld',['--no-defaults','--initialize-insecure','--datadir='+path.join(tmp,'data')],{stdio:'ignore'});
 const log=fs.openSync(path.join(tmp,'mysql.log'),'a');mysql=spawn('mysqld',['--no-defaults','--datadir='+path.join(tmp,'data'),'--socket='+socket,'--skip-networking','--mysqlx=0','--pid-file='+path.join(tmp,'mysql.pid')],{stdio:['ignore',log,log]});
 await waitFor(()=>sql('SELECT 1').trim()==='1');
 sql('CREATE DATABASE chinalife_test; USE chinalife_test; CREATE TABLE users(user_id INT UNSIGNED PRIMARY KEY,user_name VARCHAR(100)); INSERT INTO users VALUES '+Array.from({length:12},(_,i)=>`(${i+1},'user${i+1}')`).join(','));
 const root=path.join(tmp,'web/api/v4');fs.mkdirSync(root,{recursive:true});fs.cpSync('chinalife-api',path.join(root,'chinalife'),{recursive:true});fs.writeFileSync(path.join(root,'chinalife/admin-config.php'),`<?php return ['usernames'=>['user1']];`);
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
 const created=await call(1,'admin.php','POST',{action:'create_event',title:'Afrobeats Night',body:'Dance till late',place:'blood',reward:700,hours:2,billboard:true,link:''});assert.equal(created.httpStatus,200);
 const list=await call(12,'events.php?city=Shenyang');const ev=list.data.events.find(e=>e.title==='Afrobeats Night');assert.ok(ev&&ev.billboard&&!ev.joined);assert.equal(list.data.admin,false);
 assert.equal((await call(12,'events.php','POST',{id:Number(ev.id)})).httpStatus,409);
 await call(12,'presence.php','POST',presence('Shenyang','blood'));const money=(await call(12,'save.php')).data.save.game.money;
 const joined=await call(12,'events.php','POST',{id:Number(ev.id)});assert.equal(joined.httpStatus,200);assert.equal(joined.data.reward,700);assert.equal((await call(12,'save.php')).data.save.game.money,money+700);
 assert.equal((await call(12,'events.php','POST',{id:Number(ev.id)})).httpStatus,409);
 assert.equal((await call(1,'admin.php','POST',{action:'create_event',title:'Bad',place:'nowhere',reward:1,hours:1})).httpStatus,400);
 await call(1,'admin.php','POST',{action:'end_event',id:Number(ev.id)});assert.ok(!(await call(12,'events.php?city=Shenyang')).data.events.some(e=>e.id===ev.id));
});

test('save caps XP and money growth by real time so edited saves cannot top the leaderboard',async()=>{
 const cur=(await call(11,'save.php')).data,before=cur.save.game;
 const r=await call(11,'save.php','POST',{revision:cur.revision,save:{character:{name:'x'},game:{...before,xp:before.xp+999999,money:before.money+99999999}}});assert.equal(r.httpStatus,200);
 const after=(await call(11,'save.php')).data.save.game;assert.ok(after.xp<=before.xp+400,'xp '+after.xp);assert.ok(after.money<=before.money+21000,'money '+after.money);assert.ok(after.xp>before.xp);
});

test('the weekly golden envelope pays only the first finder at its venue',async()=>{
 const g=await call(3,'golden.php');assert.equal(g.httpStatus,200);assert.equal(g.data.found_by,null);
 assert.equal((await call(3,'golden.php','POST',{})).httpStatus,409);
 for(const id of [3,4])await call(id,'presence.php','POST',presence('Shenyang',g.data.place));
 const money=(await call(3,'save.php')).data.save.game.money;const win=await call(3,'golden.php','POST',{});assert.equal(win.httpStatus,200);assert.equal((await call(3,'save.php')).data.save.game.money,money+50000);
 const late=await call(4,'golden.php','POST',{});assert.equal(late.httpStatus,409);assert.match(late.message,/user3/);assert.equal((await call(4,'golden.php')).data.found_by,'user3');
});

test('admins open cities and every player receives the open list',async()=>{
 assert.deepEqual((await call(5,'events.php?city=Shenyang')).data.cities,['Shenyang']);
 assert.equal((await call(5,'admin.php','POST',{action:'set_cities',open:['Harbin']})).httpStatus,403);
 assert.equal((await call(1,'admin.php','POST',{action:'set_cities',open:['Atlantis']})).httpStatus,400);
 const r=await call(1,'admin.php','POST',{action:'set_cities',open:['Harbin']});assert.deepEqual(r.data.open,['Shenyang','Harbin']);
 assert.deepEqual((await call(5,'events.php?city=Shenyang')).data.cities,['Shenyang','Harbin']);
 await call(1,'admin.php','POST',{action:'set_cities',open:[]});assert.deepEqual((await call(5,'events.php?city=Shenyang')).data.cities,['Shenyang']);
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
 const a=await client(11),b=await client(12);
 await a.context.ChinaLifeShared.open('12','user12');assert.ok(a.document.querySelector('[data-kind="study"]'));await a.document.querySelector('[data-kind="study"]').onclick();
 await b.context.ChinaLifeShared.poll();assert.equal(b.document.getElementById('sharedInviteNotice').hidden,false);await b.context.ChinaLifeShared.open();await b.document.querySelector('[data-shared="accept"]').onclick();
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
 let r=await call(11,'activities.php','POST',{action:'invite',kind:'basketball',peer:'12'});assert.equal(r.httpStatus,200);let id=r.data.id;
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
 const a=await client(11),b=await client(12);await a.context.ChinaLifeShared.open('12','user12','girlfriend');assert.equal(a.document.querySelectorAll('[data-kind]').length,1);await a.document.querySelector('[data-kind="girlfriend"]').onclick();
 await b.context.ChinaLifeShared.poll();assert.equal(b.document.getElementById('sharedInviteNotice').hidden,false);await b.context.ChinaLifeShared.open();await b.document.querySelector('[data-shared="accept"]').onclick();assert.match(b.document.getElementById('sharedBody').textContent,/Partner: user11/);
 const restarted=await client(11);await restarted.context.ChinaLifeShared.open();assert.match(restarted.document.getElementById('sharedBody').textContent,/Partner: user12/);assert.ok(restarted.document.querySelector('[data-shared="end-relationship"]'));
 assert.equal((await call(12,'block.php','POST',{peer:'11',blocked:true})).httpStatus,200);for(const id of [11,12])assert.equal((await call(id,'activities.php')).data.relationships.length,0);
 await call(12,'block.php','POST',{peer:'11',blocked:false});
});

test('admin browses saved players without search and ordinary accounts cannot access the list',async()=>{const r=await call(1,'admin.php','POST',{action:'players'});assert.equal(r.httpStatus,200);assert.ok(r.data.players.length>1);assert.ok(r.data.total>=r.data.players.length);assert.equal((await call(11,'admin.php','POST',{action:'players'})).httpStatus,403)});
test('partner title follows saved gender and server rejects incompatible romantic requests',async()=>{sql("USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id IN (11,12)");for(const id of [11,12])await call(id,'presence.php','POST',presence());assert.equal((await call(11,'activities.php','POST',{action:'invite',kind:'boyfriend',peer:'12'})).httpStatus,409);sql("USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,'$.gender','male') WHERE user_id=12");assert.equal((await call(11,'activities.php','POST',{action:'invite',kind:'date',peer:'12'})).httpStatus,409);sql("USE chinalife_test; UPDATE chinalife_saves SET game_state=JSON_SET(game_state,'$.gender','female') WHERE user_id=12");const r=await call(12,'activities.php','POST',{action:'invite',kind:'boyfriend',peer:'11'});assert.equal(r.httpStatus,200);await call(11,'activities.php','POST',{action:'decline',id:r.data.id})});
test('hidden fortunes award server-configured money once and rich public profiles persist',async()=>{
 sql("USE chinalife_test; DELETE FROM chinalife_rate_limits WHERE user_id=11");assert.equal((await call(11,'fortune.php','POST',{id:'city-founder',reward:999999999})).httpStatus,409);
 sql("USE chinalife_test; UPDATE chinalife_saves SET updated_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE user_id=11");const current=await call(11,'save.php');const g=current.data.save.game;Object.assign(g,{money:8000,gender:'male',ownedHomes:['home-mansion','home-nanhu'],activeHome:'home-mansion',propertyPortfolio:{Shenyang:['apartment','penthouse']},properties:{Shenyang:'penthouse'},upgrades:['piano','safe'],visited:['campus','business','market','university','mall','station'],xp:8000,stats:{activities:120,shifts:25},skills:{...g.skills,Creativity:6,Digital:6,Social:6,Network:6},business:{level:3,orders:40,revenue:10000,lastOrder:1}});
 assert.equal((await call(11,'save.php','POST',{revision:current.data.revision,save:{character:{},game:g}})).httpStatus,200);
 const list=await call(11,'fortune.php');assert.ok(list.data.opportunities.every(o=>o.ready));for(const [id,reward] of [['creator-breakthrough',250000],['community-contract',1000000],['city-founder',2500000]]){const r=await call(11,'fortune.php','POST',{id,reward:1});assert.equal(r.httpStatus,200);assert.equal(r.data.reward,reward);assert.equal((await call(11,'fortune.php','POST',{id})).data.duplicate,true)}
 const loaded=await call(11,'save.php');assert.equal(loaded.data.save.game.money,3758000);assert.equal(loaded.data.save.game.activeHome,'home-mansion');assert.ok((await call(11,'fortune.php')).data.opportunities.every(o=>o.claimed));const profile=(await call(12,'profile.php?peer=11')).data.profile;assert.equal(profile.wealth,'💎 Millionaire');assert.equal(profile.netWorth,null,'other players never see net worth');assert.ok((await call(11,'profile.php')).data.profile.netWorth>1000000,'own net worth is visible');assert.equal(profile.homes.length,4);assert.deepEqual(profile.items,['piano','safe']);assert.equal(profile.game,undefined);assert.equal((await call(null,'profile.php?peer=11')).httpStatus,401);
 for(const id of ['home-campus','home-nanhu','home-hunnan','home-river','home-mansion'])assert.equal((await call(11,'presence.php','POST',presence('Shenyang',id))).httpStatus,200);
});
test('hafrik and horlaarsman have admin access alongside configured additional admins',async()=>{sql("USE chinalife_test; INSERT INTO users VALUES(13,'hafrik'),(14,'horlaarsman')");for(const id of [13,14]){assert.equal((await call(id,'admin.php','POST',{action:'stats'})).httpStatus,200);assert.equal((await call(id,'admin.php','POST',{action:'players'})).httpStatus,200)}assert.equal((await call(12,'admin.php','POST',{action:'stats'})).httpStatus,403)});

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
  for(const id of [11,12]){const r=await call(id,'presence.php?city=Shenyang&place='+place);assert.equal(r.httpStatus,200);assert.ok(!r.data.players.some(p=>p.id===String(id===11?12:11)));}
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
 assert.ok(!(await call(12,'presence.php?city=Shenyang&place=plaza')).data.players.some(p=>p.id==='11'));
});
