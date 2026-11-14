<?php
declare(strict_types=1);
// Event screens (docs/TODAY-PLAN.md Phase 4, switch event_screens): one shared screen for Match Day (and cups),
// elections and Hot Seat Hour. Each event: a countdown, the Top 3 in your city, your own line, the reward. Read only;
// everything comes from what the game already stores. Gossip rep is never shown for other players (it would hint at
// who wrote which gist), so the Hot Seat board ranks right calls: votes that matched the room's verdict tonight.
// GET ?city= -> {now, events:[{kind, live, endsAt|startsAt, top:[{name,n}], me:{n,rank}, reward, ...}]}
require_once __DIR__.'/common.php';
require_once __DIR__.'/football-lib.php';
require_once __DIR__.'/hot-seat-lib.php';
require_once __DIR__.'/gossip-settings.php';
require_once __DIR__.'/politics-lib.php';
cl_methods(['GET']);cl_rate('event_screens',30,60);

$city=(string)($_GET['city']??'China');
if (!in_array($city,cl_open_cities(),true)) $city=cl_open_cities()[0];
$day=cl_beijing_day();$tz=new DateTimeZone('Asia/Shanghai');
$midnight=(new DateTimeImmutable($day.' 00:00:00',$tz))->getTimestamp();
// Rank $me in a [user_id=>n] list (n>0 only), and the Top 3 with names.
function ev_board(array $scores,int $me): array {
    arsort($scores);$ids=array_keys($scores);$top=[];
    $names=[];if ($ids) {$in=implode(',',array_map('intval',array_slice($ids,0,3)));foreach (cl_rows("SELECT user_id,user_name FROM users WHERE user_id IN ($in)") as $u) $names[(int)$u['user_id']]=$u['user_name'];}
    foreach (array_slice($ids,0,3) as $id) $top[]=['name'=>(string)($names[$id]??'Player'),'n'=>$scores[$id],'me'=>$id===$me];
    $pos=array_search($me,$ids,true);
    return [$top,['n'=>$scores[$me]??0,'rank'=>$pos===false?null:$pos+1]];
}
$events=[];

// ⚽ Match Day: goals scored today by players last seen in this city; the daily challenge pays ¥300; the next cup.
$goals=[];
foreach (cl_optional_rows("SELECT a.user_id,a.ref FROM chinalife_economy_actions a JOIN chinalife_presence p ON p.user_id=a.user_id AND p.city=? WHERE a.action='fb-full' AND a.ref LIKE ?",'ss',[$city,'fb:'.$day.':%']) as $r)
    if (preg_match('/^fb:[\d-]+:\d+:(\d+):[wdl]$/',(string)$r['ref'],$m)&&(int)$m[1]>0) $goals[(int)$r['user_id']]=($goals[(int)$r['user_id']]??0)+(int)$m[1];
$mine=fb_day_counts($uid,$day);if ($mine['goals']>0) $goals[$uid]=$mine['goals'];
[$top,$me]=ev_board($goals,$uid);$me['n']=$mine['goals'];
[$ck,$cn]=fb_day_challenge($day);
$cup=cl_optional_rows("SELECT name,UNIX_TIMESTAMP(starts_at) at,status,prize_coins FROM chinalife_football_tournaments WHERE status IN('registering','running') ORDER BY status='running' DESC,starts_at LIMIT 1",'',[])[0]??null;
$events[]=['kind'=>'match','live'=>true,'endsAt'=>$midnight+86400,'top'=>$top,'me'=>$me,'unit'=>'goals',
    'challenge'=>['key'=>$ck,'target'=>$cn,'count'=>$mine[$ck],'claimed'=>cl_one("SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action='football-daily' AND ref=?",'is',[$uid,'football-daily:'.$day])!==null],
    'reward'=>['coins'=>300],
    'cup'=>$cup?['name'=>(string)$cup['name'],'startsAt'=>(int)$cup['at'],'running'=>$cup['status']==='running','prize'=>(int)$cup['prize_coins']]:null];

// 🗳 Elections: the open race with the most votes; voting pays ¥50 + 10 XP per office.
try {$p=cl_politics_snapshot($city);} catch (Throwable $e) {$p=null;}
if ($p) {
    $open=array_keys($p['elections']);$best=null;$bestVotes=-1;
    foreach ($open as $office) {$v=array_sum(array_map(fn($c)=>$c['office']===$office?$c['votes']:0,$p['results']));$has=count(array_filter($p['results'],fn($c)=>$c['office']===$office));if ($has&&$v>$bestVotes) {$best=$office;$bestVotes=$v;}}
    $race=$best?array_values(array_filter($p['results'],fn($c)=>$c['office']===$best)):[];
    $events[]=['kind'=>'election','live'=>(bool)$best,'endsAt'=>$best?intdiv((int)$p['elections'][$best]['closes_ms'],1000):null,'office'=>$best,
        'top'=>array_map(fn($c)=>['name'=>(string)$c['name'],'n'=>(int)$c['votes'],'me'=>(bool)$c['is_mine']],array_slice($race,0,3)),
        'me'=>['voted'=>count(array_intersect($p['voted_offices'],$open)),'races'=>count(array_filter($open,fn($o)=>count(array_filter($p['results'],fn($c)=>$c['office']===$o))>0))],
        'unit'=>'votes','reward'=>['coins'=>50,'xp'=>10]];
}

// 🔥 Hot Seat Hour: a nightly show (admin hours, Beijing). Right calls tonight in this city.
$g=cl_gossip_settings();$hour=hs_beijing_hour();$live=cl_gossip_live($hour);
$start=$midnight+$g['show_start']*3600;$end=$midnight+$g['show_end']*3600;if (!$live&&$hour>=$g['show_end']) {$start+=86400;$end+=86400;}
$calls=[];
foreach (cl_optional_rows("SELECT v.user_id,COUNT(*) n FROM chinalife_hot_seat_votes v JOIN chinalife_hot_seat h ON h.id=v.gist_id WHERE h.city=? AND v.day=? AND h.status='revealed' AND h.result=v.vote AND h.true_votes+h.cap_votes>=? GROUP BY v.user_id",'ssi',[$city,$day,HS_MIN_VOTES]) as $r)
    $calls[(int)$r['user_id']]=(int)$r['n'];
[$top,$me]=ev_board($calls,$uid);
$events[]=['kind'=>'hotseat','live'=>$live,'startsAt'=>$start,'endsAt'=>$end,'top'=>$top,'me'=>$me,'unit'=>'right calls',
    'reward'=>['coins'=>HS_VOTER_REWARD,'per'=>'right call','max'=>HS_DAILY_REWARDS]];

json_response('success',['now'=>time(),'city'=>$city,'events'=>$events]);
