<?php
declare(strict_types=1);
// CLI cron: bounded city-launch delivery through Hafrik's installed inbox/push helper.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../db.php';require_once __DIR__.'/../helpers.php';
$db=get_db_connection();mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
$features=$db->query("SELECT value FROM chinalife_settings WHERE name='hafrik_features'")->fetch_assoc();
if((json_decode($features['value']??'{}',true)['notifications']??true)===false){echo "Notifications switched off.\n";exit;}
require_once __DIR__.'/../notifications/_admin_notify.php';
if(!(int)$db->query("SELECT GET_LOCK('chinalife_life_dispatch',0) n")->fetch_assoc()['n'])exit;
try{
 $rows=$db->query('SELECT o.* FROM chinalife_life_outbox o JOIN chinalife_city_launches l ON l.city=o.city WHERE o.delivered_at IS NULL AND l.ends_at>UNIX_TIMESTAMP() ORDER BY o.created_at,o.user_id LIMIT 50')->fetch_all(MYSQLI_ASSOC);$sent=0;
 $open=$db->query("SELECT value FROM chinalife_settings WHERE name='open_cities'")->fetch_assoc();$cities=json_decode($open['value']??'["China"]',true);
 foreach($rows as $r){if(!in_array($r['city'],$cities,true))continue;$key='city-'.$r['city'];$id=(int)$r['user_id'];$s=$db->prepare('SELECT 1 FROM notifications WHERE to_user_id=? AND notify_id=? AND action="chinalife_city" LIMIT 1');$s->bind_param('is',$id,$key);$s->execute();$exists=(bool)$s->get_result()->fetch_row();$s->close();
  if(!$exists){$message=$r['city'].' is open in ChinaLife! Free travel for 48 hours and a city welcome reward await.';$result=v2_notify_user($db,$id,['from_user_id'=>(int)$r['actor_id'],'action'=>'chinalife_city','node_type'=>'chinalife','node_url'=>'https://hafrik.com/china-life/#view=inbox&notice='.rawurlencode($key),'notify_id'=>$key,'message'=>$message,'push_title'=>'ChinaLife','push_body'=>$message,'data'=>['type'=>'chinalife_city','notice'=>$key]]);if(empty($result['inserted']))continue;$sent++;}
  $s=$db->prepare('UPDATE chinalife_life_outbox SET delivered_at=NOW() WHERE user_id=? AND city=?');$s->bind_param('is',$id,$r['city']);$s->execute();$s->close();
 }echo "City launch inbox notifications created: $sent\n";
 // One opted-in reminder per dated occurrence. Existing native activity notifications open the game inbox.
 $weeklyReady=(int)$db->query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('chinalife_weekly_runs','chinalife_weekly_templates','chinalife_weekly_members')")->fetch_assoc()['n']===3;
 $weekly=$weeklyReady?$db->query('SELECT r.id,r.city,r.starts_at,r.snapshot,m.user_id FROM chinalife_weekly_runs r JOIN chinalife_weekly_templates t ON t.id=r.template_id JOIN chinalife_weekly_members m ON m.run_id=r.id WHERE m.reminder=1 AND m.reminded_at IS NULL AND m.completed_at IS NULL AND r.cancelled=0 AND t.enabled=1 AND (t.city="" OR t.city=r.city) AND r.starts_at<=UNIX_TIMESTAMP()+600 AND r.starts_at>=UNIX_TIMESTAMP()-300 AND r.ends_at>UNIX_TIMESTAMP() ORDER BY r.starts_at,m.user_id LIMIT 50')->fetch_all(MYSQLI_ASSOC):[];$count=0;
 foreach($weekly as $r){if(!in_array($r['city'],$cities,true))continue;$id=(int)$r['user_id'];$run=(int)$r['id'];$key='weekly-'.$run.'-start';$s=$db->prepare('SELECT 1 FROM notifications WHERE to_user_id=? AND notify_id=? AND action="chinalife_activity" LIMIT 1');$s->bind_param('is',$id,$key);$s->execute();$exists=(bool)$s->get_result()->fetch_row();$s->close();if(!$exists){$spec=json_decode($r['snapshot'],true);$message=$spec['title'].' '.((int)$r['starts_at']>time()?'starts soon':'is starting').' in '.$r['city'].'. Open your ChinaLife activity.';$result=v2_notify_user($db,$id,['from_user_id'=>0,'action'=>'chinalife_activity','node_type'=>'chinalife','node_url'=>'https://hafrik.com/china-life/#view=inbox&notice='.$key,'notify_id'=>$key,'message'=>$message,'push_title'=>'ChinaLife','push_body'=>$message,'data'=>['type'=>'chinalife_activity','notice'=>$key]]);if(empty($result['inserted']))continue;$count++;}$s=$db->prepare('UPDATE chinalife_weekly_members SET reminded_at=NOW() WHERE run_id=? AND user_id=?');$s->bind_param('ii',$run,$id);$s->execute();$s->close();}echo "Weekly activity reminders created: $count\n";
}finally{$db->query("SELECT RELEASE_LOCK('chinalife_life_dispatch')");}
