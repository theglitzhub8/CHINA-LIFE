// Football Field API against a throwaway local MariaDB + php -S (same harness as php-api.mjs; test-N bearer users, user1 is admin).
// Run on its own: node --test tests/php-api-football.mjs
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
process.env.PATH=process.env.PATH+':/usr/sbin:/usr/bin';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chinalife-api-')),socket=path.join(tmp,'mysql.sock');
let mysql,php,base;
const sql=command=>execFileSync('mysql',['--no-defaults','--socket='+socket,'-u','root','--batch','--skip-column-names','-e',command],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const env={...process.env,CHINALIFE_TEST_SOCKET:socket,CHINALIFE_PUSH_TEST:'1'};
async function waitFor(check){for(let i=0;i<100;i++){try{if(await check())return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Test service failed to start')}
async function call(id,file,method='GET',data){const response=await fetch(base+'/api/v4/chinalife/'+file,{method,headers:{...(id?{Authorization:'Bearer test-'+id}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {...await response.json(),httpStatus:response.status}}
const presence=(city='Shenyang',place='plaza')=>({city,place,name:'Player',color:'#246fa7',skin:'#8b5c43',hair:'cap',x:1,z:2});
const game=()=>({...fixture(),city:'Shenyang'});
before(async()=>{
 // MySQL initialises with --initialize-insecure; MariaDB (Debian) with mariadb-install-db.
 const maria=/MariaDB/i.test(execFileSync('mysqld',['--version'],{encoding:'utf8'}));
 if(maria)execFileSync('mariadb-install-db',['--no-defaults','--datadir='+path.join(tmp,'data'),'--auth-root-authentication-method=normal','--skip-test-db'],{stdio:'ignore'});
 else execFileSync('mysqld',['--no-defaults','--initialize-insecure','--datadir='+path.join(tmp,'data')],{stdio:'ignore'});
 const log=fs.openSync(path.join(tmp,'mysql.log'),'a');mysql=spawn('mysqld',['--no-defaults','--datadir='+path.join(tmp,'data'),'--socket='+socket,'--skip-networking',...(maria?[]:['--mysqlx=0']),'--pid-file='+path.join(tmp,'mysql.pid')],{stdio:['ignore',log,log]});
 await waitFor(()=>sql('SELECT 1').trim()==='1');
 sql('CREATE DATABASE chinalife_test; USE chinalife_test; CREATE TABLE users(user_id INT UNSIGNED PRIMARY KEY,user_name VARCHAR(100)); INSERT INTO users VALUES '+Array.from({length:12},(_,i)=>`(${i+1},'user${i+1}')`).join(','));
 const root=path.join(tmp,'web/api/v4');fs.mkdirSync(root,{recursive:true});fs.cpSync('chinalife-api',path.join(root,'chinalife'),{recursive:true});fs.writeFileSync(path.join(root,'chinalife/admin-config.php'),`<?php return ['usernames'=>['user1']];`);fs.writeFileSync(path.join(root,'chinalife/polling-config.json'),'{"mode":"adaptive"}');
 fs.writeFileSync(path.join(root,'db.php'),`<?php mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);`);
 fs.writeFileSync(path.join(root,'helpers.php'),`<?php function get_db_connection(){$db=new mysqli('localhost','root','','chinalife_test',0,getenv('CHINALIFE_TEST_SOCKET'));$db->set_charset('utf8mb4');return $db;} if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS'){http_response_code(204);exit;} function json_response($status,$data=null,$message=''){header('Content-Type: application/json');echo json_encode(compact('status','data','message'));exit;} function auth_user($db){$token=$_SERVER['HTTP_AUTHORIZATION']??'';if(!preg_match('/^Bearer test-([1-9][0-9]*)$/',$token,$m)){http_response_code(401);json_response('error',null,'Unauthorized');}$s=$db->prepare('SELECT * FROM users WHERE user_id=?');$id=(int)$m[1];$s->bind_param('i',$id);$s->execute();return $s->get_result()->fetch_assoc()?:[];}`);
 // Upgrade the schema already uploaded to the Hafrik server, twice, preserving its rows.
 for(const file of ['migration.sql','migration 2.sql','voice.sql'])sql('USE chinalife_test; '+fs.readFileSync('chinalife-api/'+file,'utf8'));
 sql(`USE chinalife_test; INSERT INTO chinalife_saves(user_id,character_data,game_state) VALUES(12,'{}','${JSON.stringify(game())}');`);
 for(let i=0;i<2;i++)execFileSync('php',[path.join(root,'chinalife/migrate.php')],{env,stdio:'pipe'});
 // Football tables come from the pending migration (not run by migrate.php).
 for(let i=0;i<2;i++)sql('USE chinalife_test; '+fs.readFileSync('chinalife-api/pending/migration-football.sql','utf8'));
 const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base='http://127.0.0.1:'+port;
 const phpLog=fs.openSync(path.join(tmp,'php.log'),'a');php=spawn('php',['-S','127.0.0.1:'+port,'-t',path.join(tmp,'web')],{env,stdio:['ignore',phpLog,phpLog]});
 await waitFor(async()=>{try{return (await fetch(base+'/api/v4/chinalife/save.php')).status===401}catch{return false}});
});
// Each run creates a ~190 MB MySQL data directory; remove it so repeated runs cannot fill the disk.
after(async()=>{php?.kill();if(mysql&&mysql.exitCode===null){const exited=new Promise(resolve=>mysql.once('exit',resolve));mysql.kill();await exited}fs.rmSync(tmp,{recursive:true,force:true})});

const coins=id=>{const v=sql(`USE chinalife_test; SELECT game_state FROM chinalife_saves WHERE user_id=${id}`).trim();return v?JSON.parse(v.replace(/\\\\/g,'\\')).money:null};
const ago=(id,sec)=>sql(`USE chinalife_test; UPDATE chinalife_football_matches SET started_at=NOW()-INTERVAL ${sec} SECOND WHERE id=${+id}`);
const report=(score,goals,winner)=>({score,goals,winner});
test('switch starts off; admin turns it on',async()=>{
 let r=await call(2,'football.php?action=lobby');assert.equal(r.data.enabled,false);
 r=await call(2,'football.php','POST',{action:'create',size:1});assert.equal(r.httpStatus,403);
 r=await call(2,'admin.php','POST',{action:'set_football',enabled:true});assert.equal(r.httpStatus,403,'players cannot flip it');
 r=await call(1,'admin.php','POST',{action:'set_football',enabled:true});assert.equal(r.data.enabled,true);
 r=await call(1,'admin.php','POST',{action:'football'});assert.equal(r.data.enabled,true);
});
let A;
test('lobby: create, one match at a time, join, host-only kick off',async()=>{
 let r=await call(2,'football.php','POST',{action:'create',size:1});assert.equal(r.httpStatus,200,JSON.stringify(r));A=r.data.match.id;assert.equal(r.data.match.host,'2');assert.equal(r.data.me,'2');
 r=await call(2,'football.php','POST',{action:'quick',size:1});assert.match(r.message,/other match/);
 r=await call(3,'football.php','POST',{action:'join',id:A,team:1});assert.deepEqual(r.data.players.map(p=>[p.id,p.team]),[['2',0],['3',1]]);
 r=await call(4,'football.php','POST',{action:'join',id:A,team:1});assert.match(r.message,/full/);
 r=await call(3,'football.php','POST',{action:'start',id:A});assert.match(r.message,/host/);
 r=await call(2,'football.php','POST',{action:'start',id:A});assert.equal(r.data.match.status,'live');
 r=await call(5,'football.php','POST',{action:'join',id:A,team:0});assert.match(r.message,/kicked off/);
});
test('relay: guests send inputs, the host sends snapshots and gets inputs back',async()=>{
 let r=await call(3,'football.php','POST',{action:'input',id:A,mx:.5,my:-2,pass:true});assert.equal(r.httpStatus,200);
 r=await call(3,'football.php','POST',{action:'snap',id:A,seq:1,snap:{t:1}});assert.equal(r.httpStatus,403,'only the host sends the match');
 r=await call(2,'football.php','POST',{action:'snap',id:A,seq:1,snap:{t:1000,sc:[0,0]}});assert.deepEqual(r.data.inputs['3'],{mx:.5,my:-1,pass:true,shoot:false});
 r=await call(3,'football.php?action=state&id='+A);assert.equal(r.data.snap.t,1000);
 r=await call(2,'football.php','POST',{action:'snap',id:A,seq:1,snap:{t:5}});r=await call(3,'football.php?action=state&id='+A);assert.equal(r.data.snap.t,1000,'old snapshots are ignored');
 // v2 fields: sprint + one numbered action are relayed; unknown action types are dropped
 r=await call(3,'football.php','POST',{action:'input',id:A,mx:0,my:0,sprint:true,act:{n:7,type:'lob',power:1.7}});assert.equal(r.httpStatus,200);
 r=await call(2,'football.php','POST',{action:'snap',id:A,seq:2,snap:{t:1100,sc:[0,0]}});assert.deepEqual(r.data.inputs['3'],{mx:0,my:0,pass:false,shoot:false,sprint:true,act:{n:7,type:'lob',power:1}});
 r=await call(3,'football.php','POST',{action:'input',id:A,mx:0,my:0,act:{n:8,type:'nuke'}});
 r=await call(2,'football.php','POST',{action:'snap',id:A,seq:3,snap:{t:1200,sc:[0,0]}});assert.deepEqual(r.data.inputs['3'],{mx:0,my:0,pass:false,shoot:false});
});
test('results: too early, doctored, then host + other side confirm',async()=>{
 const good=report([1,0],[{team:0,by:'2',t:5000}],0);
 let r=await call(2,'football.php','POST',{action:'result',id:A,report:good});assert.match(r.message,/not over/);
 ago(A,200);
 r=await call(2,'football.php','POST',{action:'result',id:A,report:{...good,score:[9,0]}});assert.match(r.message,/rejected/);
 r=await call(1,'admin.php','POST',{action:'football'});assert.equal(r.data.disputed.length,1);
 r=await call(1,'admin.php','POST',{action:'football_match_resolve',id:+A,score:[0,0],winner:null});assert.equal(r.httpStatus,200);
 // A fresh match: good report waits for the other side, then a matching confirm settles it.
 r=await call(2,'football.php','POST',{action:'create',size:1});const B=r.data.match.id;
 await call(3,'football.php','POST',{action:'join',id:B,team:1});await call(2,'football.php','POST',{action:'start',id:B});ago(B,200);
 r=await call(2,'football.php','POST',{action:'result',id:B,report:good});assert.equal(r.data.status,'reported');
 r=await call(3,'football.php','POST',{action:'quick',size:1});assert.match(r.message,/other match/,'still busy until the result settles');
 r=await call(3,'football.php','POST',{action:'confirm',id:B,score:[1,0]});assert.equal(r.data.status,'done');
 r=await call(3,'football.php?action=state&id='+B);assert.deepEqual(r.data.match.score,[1,0]);
 // A mismatching confirm is a dispute.
 r=await call(2,'football.php','POST',{action:'create',size:1});const C=r.data.match.id;
 await call(3,'football.php','POST',{action:'join',id:C,team:1});await call(2,'football.php','POST',{action:'start',id:C});ago(C,200);
 await call(2,'football.php','POST',{action:'result',id:C,report:good});
 r=await call(3,'football.php','POST',{action:'confirm',id:C,score:[0,1]});assert.equal(r.data.status,'disputed');
});
test('tournament: create, register, bracket, play, advance, prize',async()=>{
 const at=new Date(Date.now()+3600e3).toISOString();
 sql(`USE chinalife_test; INSERT INTO chinalife_saves(user_id,character_data,game_state) VALUES(4,'{}','${JSON.stringify(game())}');`);
 const before=coins(4);
 let r=await call(4,'football.php','POST',{action:'t_create',name:'Friday Night Cup',team_size:2,max_teams:4,starts_at:at});const T=r.data.id;assert.ok(T);
 r=await call(1,'admin.php','POST',{action:'football_tournament_save',id:+T,name:'Friday Night Cup',team_size:2,max_teams:4,starts_at:at,prize_coins:1000});assert.equal(r.httpStatus,200);
 r=await call(4,'football.php','POST',{action:'t_register',id:T,team_name:'Alpha'});const alpha=r.data.team_id;
 r=await call(5,'football.php','POST',{action:'t_register',id:T,team_name:'Beta'});
 r=await call(6,'football.php','POST',{action:'t_join',id:T,team_id:alpha});assert.equal(r.data.teams.find(t=>t.name==='Alpha').members.length,2);
 r=await call(7,'football.php','POST',{action:'t_join',id:T,team_id:alpha});assert.match(r.message,/full/);
 r=await call(5,'football.php','POST',{action:'t_register',id:T,team_name:'Gamma'});assert.match(r.message,/already/);
 sql(`USE chinalife_test; UPDATE chinalife_football_tournaments SET starts_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id=${+T}`);
 r=await call(5,'football.php?action=tournament&id='+T);assert.equal(r.data.tournament.status,'running');assert.equal(r.data.tournament.bracket.length,1);assert.equal(r.data.matches.length,1);
 r=await call(7,'football.php','POST',{action:'t_play',id:T});assert.match(r.message,/not in this tournament/);
 r=await call(5,'football.php','POST',{action:'t_play',id:T});const M=r.data.match.id;assert.equal(r.data.match.host,'5');
 const beta=r.data.players[0].team;
 r=await call(5,'football.php','POST',{action:'start',id:M});assert.match(r.message,/each team/);
 r=await call(4,'football.php','POST',{action:'t_play',id:T});assert.equal(r.data.players.length,2);
 await call(5,'football.php','POST',{action:'start',id:M});ago(M,200);
 const alphaSide=1-beta;
 r=await call(5,'football.php','POST',{action:'result',id:M,report:report(alphaSide?[0,2]:[2,0],[{team:alphaSide,by:'4',t:1000},{team:alphaSide,by:'bot-'+alphaSide+'-1',t:2000}],alphaSide)});assert.equal(r.data?.status,'reported','tournament results wait for the other side: '+JSON.stringify(r));
 r=await call(4,'football.php','POST',{action:'confirm',id:M,score:alphaSide?[0,2]:[2,0]});assert.equal(r.data?.status,'done',JSON.stringify(r));
 r=await call(5,'football.php?action=tournament&id='+T);assert.equal(r.data.tournament.status,'done');assert.equal(String(r.data.tournament.champion_team_id),String(alpha));
 assert.equal(coins(4)-before,500,'1000 coin prize split between the two Alpha players (user 6 has no save yet, so is skipped)');
});
test('two players over the API: the guest steers its player on the host, and sees the host snapshot',async()=>{
 await import('../public/football-engine.js');const E=globalThis.ChinaLifeFootballEngine;
 let r=await call(9,'football.php','POST',{action:'create',size:2});const id=r.data.match.id;
 await call(10,'football.php','POST',{action:'join',id,team:1});
 r=await call(9,'football.php','POST',{action:'start',id});
 const roster=r.data.players.map(p=>({id:p.id,name:p.name,team:p.team}));
 const host=E.create({roster,size:r.data.match.size,seed:r.data.match.seed});
 const guestView=E.create({roster,size:r.data.match.size,seed:r.data.match.seed});
 const start=host.players.find(p=>p.id==='10');const x0=start.x;let inputs={},seq=0;
 for(let tick=0;tick<120;tick++){
  if(tick%5===0){await call(10,'football.php','POST',{action:'input',id,mx:1,my:0});const d=await call(9,'football.php','POST',{action:'snap',id,seq:++seq,snap:E.snapshot(host)});inputs=d.data.inputs;}
  E.step(host,inputs,33);
 }
 await call(9,'football.php','POST',{action:'snap',id,seq:++seq,snap:E.snapshot(host)});
 r=await call(10,'football.php','POST',{action:'input',id,mx:0,my:0});E.applySnapshot(guestView,r.data.snap);
 const moved=host.players.find(p=>p.id==='10').x-x0;
 assert.ok(moved>5,'team B guest pushed +x on the host: moved '+moved.toFixed(1));
 assert.ok(Math.abs(guestView.players.find(p=>p.id==='10').x-host.players.find(p=>p.id==='10').x)<.1,'guest sees the host position');
 assert.deepEqual(guestView.score,host.score);
 await call(9,'football.php','POST',{action:'leave',id});await call(10,'football.php','POST',{action:'leave',id});
});
test('admin cancel stops a tournament',async()=>{
 const at=new Date(Date.now()+3600e3).toISOString();
 let r=await call(1,'admin.php','POST',{action:'football_tournament_save',name:'Cancel Cup',team_size:1,max_teams:4,starts_at:at,prize_coins:0});const T=r.data.id;
 r=await call(1,'admin.php','POST',{action:'football_tournament_cancel',id:+T});assert.equal(r.httpStatus,200);
 r=await call(8,'football.php','POST',{action:'t_register',id:T,team_name:'Late'});assert.match(r.message,/closed/);
 r=await call(1,'admin.php','POST',{action:'set_football',enabled:false});r=await call(2,'football.php?action=lobby');assert.equal(r.data.enabled,false);
});
