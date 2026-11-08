<?php
declare(strict_types=1);
// CLI only (cron, hourly or once at 20:00 Beijing): the evening streak reminder. A player who claimed the daily reward
// yesterday but not yet today gets one Hafrik notification (inbox + app push): "Your 🔥 N-day streak ends at midnight".
// It only sends between 19:00 and 23:00 Beijing, once per player per day (notify_id "streak-YYYY-MM-DD"), and only
// while the Hafrik integrations switches "notifications" and "streak_reminder" are on.
// Options: --now sends outside the evening window; --dry lists who would be reminded and sends nothing.
if (PHP_SAPI!=='cli') {http_response_code(404);exit;}
require_once __DIR__.'/../db.php';require_once __DIR__.'/../helpers.php';
$db=get_db_connection();mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
$args=array_slice($argv,1);$dry=in_array('--dry',$args,true);$now=in_array('--now',$args,true);
$clock=new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai'));
$today=$clock->format('Y-m-d');$yesterday=$clock->modify('-1 day')->format('Y-m-d');$hour=(int)$clock->format('G');
if (!$now && ($hour<19||$hour>=23)) {echo "Streak reminders wait for 19:00-23:00 Beijing (now $hour:00).\n";exit;}
$row=$db->query("SELECT value FROM chinalife_settings WHERE name='hafrik_features'")->fetch_assoc();$features=json_decode($row['value']??'{}',true)?:[];
if (($features['notifications']??true)===false||($features['streak_reminder']??true)===false) {echo "Streak reminders switched off.\n";exit;}
if (!$dry) {
    if (!is_file(__DIR__.'/../notifications/_admin_notify.php')) {echo "Hafrik notifications are not installed here.\n";exit(1);}
    require_once __DIR__.'/../notifications/_admin_notify.php';
}
if (!(int)$db->query("SELECT GET_LOCK('chinalife_streak_push',0) n")->fetch_assoc()['n']) exit;
try {
    $key='streak-'.$today;
    $hasInbox=(int)$db->query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notifications'")->fetch_assoc()['n']>0;
    if (!$hasInbox && !$dry) {echo "Hafrik notifications are not installed here.\n";exit(1);}
    $skip=$hasInbox?"AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.to_user_id=s.user_id AND n.action='chinalife_streak' AND n.notify_id=?)":"AND ?<>''";
    $s=$db->prepare("SELECT s.user_id,CAST(JSON_EXTRACT(s.game_state,'$.streak') AS UNSIGNED) streak FROM chinalife_saves s
        WHERE JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.lastVisit'))=?
        $skip
        ORDER BY s.user_id LIMIT 3000");
    $s->bind_param('ss',$yesterday,$key);$s->execute();$rows=$s->get_result()->fetch_all(MYSQLI_ASSOC);$s->close();
    $sent=0;
    foreach ($rows as $r) {
        $id=(int)$r['user_id'];$streak=max(1,min(7,(int)$r['streak']));$prize=50*min(7,$streak+1);
        $message='🔥 Your '.$streak.'-day ChinaLife streak ends at midnight. Come back and claim ¥'.$prize.' today!';
        if ($dry) {echo "would remind $id: $message\n";continue;}
        $result=v2_notify_user($db,$id,['from_user_id'=>0,'action'=>'chinalife_streak','node_type'=>'chinalife','node_url'=>'https://hafrik.com/china-life/','notify_id'=>$key,
            'message'=>$message,'push_title'=>'ChinaLife','push_body'=>$message,'data'=>['type'=>'chinalife_streak','notice'=>$key]]);
        if (!empty($result['inserted'])) $sent++;
    }
    echo ($dry?'Would remind: '.count($rows):"Streak reminders sent: $sent")."\n";
} finally {$db->query("SELECT RELEASE_LOCK('chinalife_streak_push')");}
