// Controlled ChinaLife API load benchmark (never touches production).
// Starts a private MySQL/MariaDB and the PHP built-in server (4 workers), creates N players with realistic saves,
// then replays the game's request schedule for each player for D seconds and reports, per endpoint:
// requests, requests per player per minute, median and p95 time, and database queries per request.
//
//   node tests/load/bench.mjs --players 30 --seconds 60 --schedule current
//   node tests/load/bench.mjs --players 30 --seconds 60 --schedule optimized
//
// "current" mirrors the timers in the game today; "optimized" mirrors the proposed schedule in
// docs/PERFORMANCE-AUDIT.md so the two can be compared on the same machine.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn,execFileSync} from 'node:child_process';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d};
const PLAYERS=Number(arg('players',30)),SECONDS=Number(arg('seconds',60)),SCHEDULE=arg('schedule','current'),VOICE_SHARE=Number(arg('voice',0.4)),CLUB_SHARE=Number(arg('club',0.25));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chinalife-bench-')),socket=path.join(tmp,'mysql.sock');
const sql=c=>execFileSync('mysql',['--no-defaults','--socket='+socket,'-u','root','--batch','--skip-column-names','-e',c],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1<<26});
const env={...process.env,CHINALIFE_TEST_SOCKET:socket,PHP_CLI_SERVER_WORKERS:'4'};
const wait=async f=>{for(let i=0;i<200;i++){try{if(await f())return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('service did not start')};
let mysql,php,base;
async function start(){
 execFileSync('mysqld',['--no-defaults','--initialize-insecure','--datadir='+path.join(tmp,'data')],{stdio:'ignore'});
 mysql=spawn('mysqld',['--no-defaults','--datadir='+path.join(tmp,'data'),'--socket='+socket,'--skip-networking','--mysqlx=0','--pid-file='+path.join(tmp,'mysql.pid')],{stdio:'ignore'});
 await wait(()=>sql('SELECT 1').trim()==='1');
 sql('CREATE DATABASE chinalife_test; USE chinalife_test; CREATE TABLE users(user_id INT UNSIGNED PRIMARY KEY,user_name VARCHAR(100)); INSERT INTO users VALUES '+Array.from({length:PLAYERS},(_,i)=>`(${i+1},'player${i+1}')`).join(','));
 const root=path.join(tmp,'web/api/v4');fs.mkdirSync(root,{recursive:true});fs.cpSync('chinalife-api',path.join(root,'chinalife'),{recursive:true});
 fs.writeFileSync(path.join(root,'chinalife/admin-config.php'),`<?php return ['usernames'=>['player1']];`);
 fs.writeFileSync(path.join(root,'db.php'),`<?php mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);`);
 // Stand-in for Hafrik's helpers.php: one user lookup per request, like a cached Sngine token check (the real one may cost more).
 fs.writeFileSync(path.join(root,'helpers.php'),`<?php function get_db_connection(){$db=new mysqli('localhost','root','','chinalife_test',0,getenv('CHINALIFE_TEST_SOCKET'));$db->set_charset('utf8mb4');return $db;} if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS'){http_response_code(204);exit;} function json_response($status,$data=null,$message=''){header('Content-Type: application/json');echo json_encode(compact('status','data','message'));exit;} function auth_user($db){$token=$_SERVER['HTTP_AUTHORIZATION']??'';if(!preg_match('/^Bearer test-([1-9][0-9]*)$/',$token,$m)){http_response_code(401);json_response('error',null,'Unauthorized');}$s=$db->prepare('SELECT * FROM users WHERE user_id=?');$id=(int)$m[1];$s->bind_param('i',$id);$s->execute();return $s->get_result()->fetch_assoc()?:[];}`);
 execFileSync('php',[path.join(root,'chinalife/migrate.php')],{env,stdio:'ignore'});
 // Realistic saves (~20 KB: full logs, Chinese course progress, visited places, wardrobe).
 const words={};for(let i=0;i<120;i++)words['词'+i]=[2,100,3,1];
 for(let i=1;i<=PLAYERS;i++){const game={created:true,name:'player'+i,city:'Shenyang',place:'plaza',money:5000+i,xp:1200,day:5,hour:600,color:'#246fa7',needs:{energy:80,hunger:70,hygiene:70,bladder:70,fun:70,social:70},logs:Array.from({length:40},(_,k)=>'Log entry '+k+' '.repeat(300)),chinese:{unit:8,lessons:9,words},visited:['plaza','cafe','market','night'],wardrobe:{owned:['tee','jeans','sneakers'],wearing:{top:'tee',bottom:'jeans',shoes:'sneakers',acc:[]},colors:{}},transferTotal:0,sharedXP:0};
  sql(`USE chinalife_test; INSERT INTO chinalife_saves(user_id,character_data,game_state,revision,created_at,updated_at) VALUES(${i},'{}','${JSON.stringify(game).replace(/'/g,"''")}',1,NOW(),NOW())`)}
 const l=net.createServer();await new Promise(r=>l.listen(0,'127.0.0.1',r));const port=l.address().port;await new Promise(r=>l.close(r));base='http://127.0.0.1:'+port;
 php=spawn('php',['-S','127.0.0.1:'+port,'-t',path.join(tmp,'web')],{env,stdio:'ignore'});
 await wait(async()=>(await fetch(base+'/api/v4/chinalife/save.php')).status===401);
}
const stats={};
const record=(name,ms,status)=>{const s=stats[name]||(stats[name]={n:0,times:[],errors:0});s.n++;s.times.push(ms);if(status>=400&&status!==409&&status!==429)s.errors++};
async function call(id,file,method='GET',data,name){const t=performance.now();let status=0;try{const r=await fetch(base+'/api/v4/chinalife/'+file,{method,headers:{Authorization:'Bearer test-'+id,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});status=r.status;await r.arrayBuffer()}catch{status=599}record(name||file.split('?')[0]+(method==='GET'?'':' '+method),performance.now()-t,status);return status}
const PLACES=['plaza','cafe','market','night','gym','mall','park','station'];
// Per-player request loops. Every loop waits for its own request (like the game's "polling" guards).
// Batch 1 model: one presence POST with change counters (2.5 s when others share the venue, 10 s alone); the counters
// wake the message check (else every 30 s); activities 30 s, transfers 60 s, home visits 60 s (safety intervals).
// Each player also posts a venue message about every 2 minutes. Voice, music and saves are unchanged (later batches).
const placeOf=i=>i<=Math.ceil(PLAYERS*CLUB_SHARE)?'night':PLACES[i%PLACES.length];
function batch1(i){const place=placeOf(i),room={city:'Shenyang',place},inVoice=i%Math.round(1/VOICE_SHARE)===0,session='bench-session-'+i,others=[...Array(PLAYERS)].some((_,k)=>k+1!==i&&placeOf(k+1)===place);
 const presence={...room,name:'p',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2,activity:'idle',inbox:1};let last=null,cursor='0';
 const notify=()=>call(i,'notifications.php?city=Shenyang&place='+place+'&after='+cursor);
 return [
  [others?2500:10000,async()=>{const t=performance.now();const r=await fetch(base+'/api/v4/chinalife/presence.php',{method:'POST',headers:{Authorization:'Bearer test-'+i,'content-type':'application/json'},body:JSON.stringify(presence)});const j=await r.json().catch(()=>null);record('presence.php POST (+inbox)',performance.now()-t,r.status);
   const box=j?.data?.inbox;if(box&&last&&(box.room!==last.room||box.messages!==last.messages))await notify();last=box||last}],
  [30000,notify],
  [30000,()=>call(i,'activities.php')],
  [60000,()=>call(i,'save.php',undefined,undefined,'save.php (transfer check)')],
  [30000,async()=>{const s=await fetch(base+'/api/v4/chinalife/save.php',{headers:{Authorization:'Bearer test-'+i}}).then(r=>r.json()).catch(()=>null);if(s?.data)await call(i,'save.php','POST',{revision:s.data.revision,save:s.data.save},'save.php POST')}],
  [60000,()=>call(i,'home-visits.php')],
  [45000,()=>call(i,'events.php?city=Shenyang')],
  [120000,()=>call(i,'messages.php','POST',{...room,text:'hello from '+i},'messages.php POST (simulated chat)')],
  ...(place==='night'?[[2500,()=>call(i,'music.php?city=Shenyang&place=night')]]:[]),
  ...(inVoice?[[1800,async()=>{await call(i,'voice.php','POST',{...room,session,muted:true,after:0,action:'pulse'});await call(i,'voice-signal.php?city=Shenyang&place='+place+'&session='+session+'&after=0')}]]:[])];}
function schedules(i){if(SCHEDULE==='batch1')return batch1(i);const place=i<=Math.ceil(PLAYERS*CLUB_SHARE)?'night':PLACES[i%PLACES.length],room={city:'Shenyang',place},inVoice=i%Math.round(1/VOICE_SHARE)===0;
 const presence={...room,name:'p',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2,activity:'idle'};const session='bench-session-'+i;let rev=1;
 const cur=SCHEDULE==='current';
 return [
  [cur?1000:20000,()=>call(i,'notifications.php?city=Shenyang&place='+place+'&after=0')],
  [cur?2500:20000,async()=>{await call(i,'presence.php','POST',presence);await call(i,'presence.php?city=Shenyang')}],
  [cur?3000:30000,()=>call(i,'activities.php')],
  [cur?5000:60000,()=>call(i,'save.php',undefined,undefined,'save.php (transfer check)')],
  ...(cur?[[120000,()=>call(i,'messages.php','POST',{...room,text:'hello from '+i},'messages.php POST (simulated chat)')]]:[]),
  [30000,async()=>{if(cur||Math.random()<.3){const s=await fetch(base+'/api/v4/chinalife/save.php',{headers:{Authorization:'Bearer test-'+i}}).then(r=>r.json()).catch(()=>null);if(s?.data){rev=s.data.revision;await call(i,'save.php','POST',{revision:rev,save:s.data.save},'save.php POST')}}}],
  [cur?10000:60000,()=>call(i,'home-visits.php')],
  [cur?45000:45000,()=>call(i,'events.php?city=Shenyang')],
  ...(place==='night'?[[cur?2500:15000,()=>call(i,'music.php?city=Shenyang&place=night')]]:[]),
  ...(inVoice?[[cur?1800:4000,async()=>{await call(i,'voice.php','POST',{...room,session,muted:true,after:0,action:'pulse'});await call(i,'voice-signal.php?city=Shenyang&place='+place+'&session='+session+'&after=0')}]]:[])];}
async function run(){
 // Everyone joins first (presence and, for voice players, the voice room).
 for(let i=1;i<=PLAYERS;i++){const place=i<=Math.ceil(PLAYERS*CLUB_SHARE)?'night':PLACES[i%PLACES.length];await call(i,'presence.php','POST',{city:'Shenyang',place,name:'p',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2},'setup');if(i%Math.round(1/VOICE_SHARE)===0)await call(i,'voice.php','POST',{city:'Shenyang',place,session:'bench-session-'+i,muted:true,after:0,action:'join'},'setup')}
 sql('USE chinalife_test; DELETE FROM chinalife_rate_limits');for(const k in stats)delete stats[k];
 const q0=Number(sql("SHOW GLOBAL STATUS LIKE 'Questions'").split('\t')[1]),started=Date.now(),end=started+SECONDS*1000,loops=[];
 for(let i=1;i<=PLAYERS;i++)for(const [every,fn] of schedules(i))loops.push((async()=>{await new Promise(r=>setTimeout(r,Math.random()*every));while(Date.now()<end){const t=Date.now();await fn();const left=every-(Date.now()-t);if(left>0)await new Promise(r=>setTimeout(r,Math.min(left,Math.max(0,end-Date.now()))))}})());
 await Promise.all(loops);const elapsed=(Date.now()-started)/1000,q1=Number(sql("SHOW GLOBAL STATUS LIKE 'Questions'").split('\t')[1]);
 const rows=Object.entries(stats).filter(([k])=>k!=='setup').map(([k,s])=>{const t=s.times.sort((a,b)=>a-b);return {endpoint:k,requests:s.n,per_player_min:+(s.n/PLAYERS/(elapsed/60)).toFixed(1),median_ms:+t[Math.floor(t.length/2)].toFixed(1),p95_ms:+t[Math.floor(t.length*.95)].toFixed(1),errors:s.errors}}).sort((a,b)=>b.requests-a.requests);
 const total=rows.reduce((n,r)=>n+r.requests,0);
 console.log(`\nSchedule: ${SCHEDULE} · ${PLAYERS} players · ${elapsed.toFixed(0)} s · voice ${Math.round(VOICE_SHARE*100)}% · club ${Math.round(CLUB_SHARE*100)}%`);console.table(rows);
 console.log(`Total ${total} requests = ${(total/elapsed).toFixed(1)} req/s = ${(total/PLAYERS/(elapsed/60)).toFixed(1)} req per player per minute; DB queries ${q1-q0} (${((q1-q0)/total).toFixed(1)} per request)`);
}
// Queries per request for each endpoint on its own (sequential, after warm-up).
async function perEndpoint(){const room='city=Shenyang&place=plaza',probes=[['notifications.php?'+room+'&after=0'],['presence.php?city=Shenyang'],['presence.php','POST',{city:'Shenyang',place:'plaza',name:'p',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2}],['activities.php'],['save.php'],['home-visits.php'],['events.php?city=Shenyang']];
 const out=[];for(const [file,method,data] of probes){sql('USE chinalife_test; DELETE FROM chinalife_rate_limits');await call(2,file,method,data,'warm');const q0=Number(sql("SHOW GLOBAL STATUS LIKE 'Questions'").split('\t')[1]),t=performance.now(),n=20;for(let k=0;k<n;k++)await call(2,file,method,data,'probe');const ms=(performance.now()-t)/n,q1=Number(sql("SHOW GLOBAL STATUS LIKE 'Questions'").split('\t')[1]);const r=await fetch(base+'/api/v4/chinalife/'+file,{method:method||'GET',headers:{Authorization:'Bearer test-2',...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const bytes=(await r.arrayBuffer()).byteLength;out.push({endpoint:file.split('?')[0]+(method?' '+method:''),avg_ms:+ms.toFixed(1),queries:+((q1-q0)/n-1).toFixed(1),response_bytes:bytes})}
 console.log('\nPer request (sequential, '+PLAYERS+' players online; queries exclude the stats query):');console.table(out)}
try{await start();await perEndpoint();await run()}finally{php?.kill();if(mysql&&mysql.exitCode===null){const e=new Promise(r=>mysql.once('exit',r));mysql.kill();await e}fs.rmSync(tmp,{recursive:true,force:true})}
