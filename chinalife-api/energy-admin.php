<?php
declare(strict_types=1);
// Admin → Energy (required by admin.php for action "energy"): is the Energy plan bringing players back?
// Everything is counted from records the game already keeps, per Beijing day, for the last 14 days:
//   daily streak claims (chinalife_daily_receipts), how many of them came back the next day, the rewards the Energy
//   phases pay (chinalife_economy_actions), streak reminders sent (Hafrik notifications), and today's streak lengths.
if (!isset($uid)) exit;
const EN_DAYS=14;
$tz=new DateTimeZone('Asia/Shanghai');$today=new DateTimeImmutable('today',$tz);
$from=$today->modify('-'.(EN_DAYS-1).' days');$fromDay=$from->format('Y-m-d');$since=$from->getTimestamp();
$days=[];for ($i=0;$i<EN_DAYS;$i++) {$d=$from->modify("+$i days")->format('Y-m-d');$days[$d]=['day'=>$d,'players'=>0,'back'=>$i<EN_DAYS-1?0:null,'visits'=>0,'allSeven'=>0,'gossip'=>0,'football'=>0,'votes'=>0,'three'=>0,'reminders'=>0];}
$cell=function(string $day,string $key,int $n) use (&$days){if (isset($days[$day])) $days[$day][$key]=$n;};

// Players who claimed the daily streak each day, and how many of them claimed again the next day.
foreach (cl_optional_rows('SELECT day,COUNT(*) n FROM chinalife_daily_receipts WHERE day>=? GROUP BY day','s',[$fromDay]) as $r) $cell((string)$r['day'],'players',(int)$r['n']);
foreach (cl_optional_rows('SELECT a.day,COUNT(b.user_id) n FROM chinalife_daily_receipts a LEFT JOIN chinalife_daily_receipts b ON b.user_id=a.user_id AND b.day=DATE_ADD(a.day,INTERVAL 1 DAY) WHERE a.day>=? AND a.day<? GROUP BY a.day','ss',[$fromDay,$today->format('Y-m-d')]) as $r) $cell((string)$r['day'],'back',(int)$r['n']);

// Energy rewards, bucketed by Beijing day from the Unix time so the server's own time zone never matters.
$keys=['football-daily'=>'football','gossip-task'=>'gossip','vote'=>'votes','today-bonus'=>'three'];
foreach (cl_rows("SELECT action,LEFT(ref,10)='visit-all:' AS bonus,FLOOR((UNIX_TIMESTAMP(created_at)+28800)/86400) d,COUNT(*) n FROM chinalife_economy_actions WHERE action IN ('place-visit','football-daily','gossip-task','vote','today-bonus') AND UNIX_TIMESTAMP(created_at)>=? GROUP BY action,bonus,d",'i',[$since]) as $r) {
    $day=gmdate('Y-m-d',(int)$r['d']*86400);
    $key=$r['action']==='place-visit'?((int)$r['bonus']?'allSeven':'visits'):$keys[$r['action']];
    if (isset($days[$day])) $days[$day][$key]+=(int)$r['n'];
}
// Streak reminders: one Hafrik notification per player per day, notify_id "streak-YYYY-MM-DD".
foreach (cl_optional_rows("SELECT notify_id,COUNT(*) n FROM notifications WHERE action='chinalife_streak' AND notify_id>=? GROUP BY notify_id",'s',['streak-'.$fromDay]) as $r) $cell(substr((string)$r['notify_id'],7),'reminders',(int)$r['n']);

// Today's streak lengths (1 to 7) among players who claimed today.
$streaks=array_fill(1,7,0);$todayDay=$today->format('Y-m-d');
foreach (cl_optional_rows("SELECT LEAST(7,GREATEST(1,CAST(JSON_EXTRACT(game_state,'$.streak') AS UNSIGNED))) s,COUNT(*) n FROM chinalife_saves WHERE JSON_UNQUOTE(JSON_EXTRACT(game_state,'$.lastVisit'))=? GROUP BY s",'s',[$todayDay]) as $r) $streaks[(int)$r['s']]+=(int)$r['n'];
$waiting=(int)(cl_optional_rows("SELECT COUNT(*) n FROM chinalife_saves WHERE JSON_UNQUOTE(JSON_EXTRACT(game_state,'$.lastVisit'))=?",'s',[$today->modify('-1 day')->format('Y-m-d')])[0]['n']??0);

json_response('success',['days'=>array_values(array_reverse($days)),'streaks'=>$streaks,'waiting'=>$waiting,'today'=>$todayDay,
    'switches'=>array_intersect_key(cl_hafrik_features(),array_flip(['energy_loop','streak_reminder']))]);
