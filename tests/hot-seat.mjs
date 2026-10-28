// Gossip hot seat (docs/HOT-SEAT.md): text checks, voting maths, offline NPC voters, Gossip TV wiring,
// and that the PHP API, migration and admin switch match the client.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {execFileSync} from 'node:child_process';
const load=()=>{const ctx={console,Intl,Date,Math};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/hot-seat.js','utf8'),ctx);return ctx.ChinaLifeHotSeat};
const hs=load();
const php=code=>{try{return JSON.parse(execFileSync('php',['-r','require "chinalife-api/hot-seat-lib.php";echo json_encode('+code+',JSON_UNESCAPED_UNICODE);'],{encoding:'utf8'}))}catch(e){if(e.code==='ENOENT')return undefined;throw e}};
const SAMPLES=['Someone at 007 left with two phones','What the fuck is this place','f u c k the DJ honestly','sh1t happens to everyone here','Scunthorpe fans are loud tonight','call me on 138 0013 8000 ok','dm @tunde_x for the tea','see www.example.com for proof','这个人是傻逼吧哈哈哈哈哈','short','x'.repeat(141),'   The   new   couple   already   fought   '];

test('gists are length-limited, cleaned and free of swearing and personal details',()=>{
 assert.equal(hs.LIMITS.max,140);assert.equal(hs.LIMITS.min,10);
 assert.ok(hs.LIMITS.seconds>=30&&hs.LIMITS.seconds<=60,'voting window is 30–60 s');
 assert.deepEqual({...hs.checkText('Someone at 007 left with two phones')},{ok:true,text:'Someone at 007 left with two phones'});
 for(const bad of ['What the fuck is this place','f u c k the DJ honestly','sh1t happens to everyone here','这个人是傻逼吧哈哈哈哈哈'])assert.match(hs.checkText(bad).error,/clean/,bad);
 for(const bad of ['call me on 138 0013 8000 ok','dm @tunde_x for the tea','see www.example.com for proof'])assert.match(hs.checkText(bad).error,/anonymous/,bad);
 assert.equal(hs.checkText('Scunthorpe fans are loud tonight').ok,true,'whole words only');
 assert.match(hs.checkText('short').error,/at least/);assert.match(hs.checkText('x'.repeat(141)).error,/under 140/);
 assert.equal(hs.checkText('   The   new   couple   already   fought   ').text,'The new couple already fought');
 assert.equal(hs.checkText(42).ok,false);
});

test('majority voters are paid, ties and tiny rounds pay nobody, and the daily cap holds',()=>{
 const v=(...a)=>a.map(([who,vote])=>({who,vote}));
 const r=hs.payouts(v(['a','true'],['b','true'],['c','cap']),'me');
 assert.equal(r.result,'true');assert.deepEqual({...r.pay},{a:20,b:20,me:10});
 assert.deepEqual({...hs.payouts(v(['a','cap'],['b','cap'],['c','true']),'me').pay},{a:20,b:20},'author paid only when believed');
 assert.equal(hs.payouts(v(['a','true'],['b','cap'],['c','true'],['d','cap']),'me').result,'tie');
 assert.deepEqual({...hs.payouts(v(['a','true'],['b','cap'],['c','true'],['d','cap']),'me').pay},{});
 assert.deepEqual({...hs.payouts(v(['a','true'],['b','true']),'me').pay},{},'fewer than 3 votes');
 assert.deepEqual({...hs.payouts(v(['a','true'],['b','true'],['c','true']),'me',{a:10}).pay},{b:20,c:20,me:10},'daily cap');
});

test('offline NPC voters are reproducible, inside the window, and lean on how the gist sounds',()=>{
 const a=hs.simulateVotes('I saw someone at the café last night',['Tunde','Mei','Kofi','Ama'],45,7),b=hs.simulateVotes('I saw someone at the café last night',['Tunde','Mei','Kofi','Ama'],45,7);
 assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
 assert.equal(a.length,4);for(const x of a){assert.ok(x.at>0&&x.at<45000);assert.ok(['true','cap'].includes(x.vote))}
 assert.ok(a.every((x,i)=>!i||a[i-1].at<=x.at),'sorted by time');
 assert.ok(hs.lean('Everyone in this city has a million yuan, literally!!')<hs.lean('I saw two students share noodles last night'));
 for(const g of hs.NPC_GISTS)assert.equal(hs.checkText(g).ok,true,g);
});

test('today\'s most-voted gist is featured and hidden ones are skipped',()=>{
 const day='2026-10-27',list=[{day,body:'a',true:2,cap:1},{day,body:'b',true:5,cap:4},{day:'2026-10-26',body:'old',true:50,cap:0},{day,body:'hid',true:20,cap:20,hidden:true}];
 assert.equal(hs.featuredOf(list,day).body,'b');assert.equal(hs.featuredOf([],day),null);
 assert.match(hs.beijingDay(new Date('2026-10-27T17:00:00Z')),/2026-10-28/,'Beijing day, not UTC');
});

test('PHP rules match the client (word list, limits, payouts)',()=>{
 const lib=fs.readFileSync('chinalife-api/hot-seat-lib.php','utf8');
 const list=name=>JSON.parse(lib.match(new RegExp('const '+name+'=(\\[[^\\]]*\\])'))[1].replace(/'/g,'"'));
 assert.deepEqual(list('HS_EXACT'),[...hs.EXACT]);assert.deepEqual(list('HS_PREFIX'),[...hs.PREFIX]);assert.deepEqual(list('HS_CJK'),[...hs.CJK]);
 for(const [k,n] of [['HS_MIN_LEN','min'],['HS_MAX_LEN','max'],['HS_SECONDS','seconds'],['HS_MIN_VOTES','minVotes'],['HS_VOTER_REWARD','voter'],['HS_AUTHOR_REWARD','author'],['HS_DAILY_REWARDS','daily'],['HS_HIDE_REPORTS','hideReports']])assert.equal(+lib.match(new RegExp('const '+k+'=(\\d+)'))[1],hs.LIMITS[n],k);
 const out=php('array_map(fn($t)=>hs_check_text($t),'+JSON.stringify(SAMPLES).replace(/^\[/,'[').replace(/\]$/,']')+')');
 if(out===undefined)return;// php not installed
 SAMPLES.forEach((s,i)=>{const c=hs.checkText(s);assert.equal(out[i][0],c.ok,s);assert.equal(out[i][1],c.ok?c.text:c.error,s)});
 assert.deepEqual(php("hs_payouts([['user_id'=>2,'vote'=>'true'],['user_id'=>3,'vote'=>'true'],['user_id'=>4,'vote'=>'cap']],1)"),{true:2,cap:1,result:'true',pay:{2:20,3:20,1:10}});
});

test('API, migration and admin: routes, rate limits, report, hide/delete and an off switch',()=>{
 const api=fs.readFileSync('chinalife-api/hot-seat.php','utf8'),sql=fs.readFileSync('chinalife-api/migration-hot-seat.sql','utf8'),admin=fs.readFileSync('chinalife-api/admin.php','utf8'),events=fs.readFileSync('chinalife-api/events.php','utf8');
 for(const a of ["'take'","'vote'","'report'"])assert.ok(api.includes("$action==="+a),a);
 for(const k of ["cl_rate('hot_seat_take'","cl_rate('hot_seat_vote'","cl_rate('hot_seat_report'","cl_presence(","hs_check_text(","cl_hot_seat_enabled()","FOR UPDATE","INSERT IGNORE INTO chinalife_hot_seat_votes"])assert.ok(api.includes(k),k);
 assert.ok(/status='voting' AND closes_at<=NOW\(\)/.test(api),'closed rounds are settled');
 assert.ok(!/true_votes'|'cap'=>\(int\)\$g\['cap_votes'\]/.test(api.split("if (!$open)")[0].split('function hs_round_out')[1]||''),'split hidden until reveal');
 for(const t of ['chinalife_hot_seat ','chinalife_hot_seat_votes','chinalife_hot_seat_reports'])assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS '+t),t);
 assert.match(sql,/body VARCHAR\(140\)/);assert.match(sql,/ON DELETE CASCADE/);
 for(const a of ["'hot_seat'","'set_hot_seat'","'hot_seat_moderate'"])assert.ok(admin.includes("$action==="+a),a);
 assert.ok(admin.includes("['hide','unhide','delete']"));assert.ok(events.includes("'hot_seat'=>cl_hot_seat_enabled()"));
 assert.ok(fs.readFileSync('public/cloud.js','utf8').includes("ChinaLifeHotSeat?.setEnabled(data.hot_seat)"));
});

test('client wiring: loaded in the game, entry points in the Gossip Room, Gossip TV and admin',()=>{
 const dev=fs.readFileSync('public/index.dev.html','utf8'),rooms=fs.readFileSync('public/rooms.js','utf8'),world=fs.readFileSync('public/world.js','utf8'),js=fs.readFileSync('public/hot-seat.js','utf8');
 assert.ok(dev.includes('<script src="hot-seat.js"></script>')&&dev.includes('href="hot-seat.css"'));
 assert.ok(rooms.includes("ChinaLifeHotSeat.paintTV(")&&rooms.includes("'chinalife:hotseat'")&&rooms.includes("removeEventListener('chinalife:hotseat'"));
 assert.ok(rooms.includes("label('🔥 Hot Seat · True or Cap?'"));assert.ok(world.includes("['🔥 Hot Seat',"));
 assert.ok(fs.readFileSync('public/admin.js','utf8').includes("ChinaLifeHotSeat?.mountAdmin($('hsCard')")&&fs.readFileSync('public/game.js','utf8').includes("ChinaLifeHotSeat?.mountAdmin($('adminHotSeat')"));
 // Offline never calls the API; online only talks to hot-seat.php.
 assert.ok(/const online=\(\)=>!sandbox\(\)\?\.localOnly&&!!root\.ChinaLifeCloud\?\.joined/.test(js));
 // One network path: net() is ChinaLifeCloud.api if it exists, else the signed-in request while gossip_show is on.
 assert.equal((js.match(/net\(\)\('\/chinalife\/hot-seat\.php'/g)||[]).length,1);assert.ok(js.includes("'/chinalife/hot-seat.php'"));
 assert.match(js,/const net=\(\)=>root\.ChinaLifeCloud\?\.api\|\|\(root\.ChinaLifeFlags\?\.cast\?\.\('gossip_show'\)===true\?root\.ChinaLifeAuth\?\.request:null\)\|\|null;/);
 assert.ok(js.includes("ChinaLifeFlags?.off?.('hotseat')"),'flag kill switch');
});
