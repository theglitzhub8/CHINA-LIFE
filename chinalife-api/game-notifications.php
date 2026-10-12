<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);
$actions="('chinalife_vote','chinalife_friend','chinalife_money','chinalife_message','chinalife_activity','chinalife_case','chinalife_city')";
function cl_notice_target(array $n): ?array {
 global $uid;
 $key=$n['id'];$actor=(int)$n['from_user_id'];
 if($n['action']==='chinalife_case'&&preg_match('/^case-([1-9][0-9]*)(?:-[0-9]+)?$/',$key,$m)&&cl_one('SELECT id FROM chinalife_court_cases WHERE id=? AND (claimant_id=? OR defendant_id=?)','iii',[(int)$m[1],$uid,$uid]))return ['type'=>'case','id'=>(int)$m[1]];
 if($n['action']==='chinalife_city'&&str_starts_with($key,'city-')&&in_array(substr($key,5),cl_open_cities(),true))return ['type'=>'launches'];
 if($n['action']==='chinalife_friend'&&$actor>0&&!cl_blocked($uid,$actor)){
  [$a,$b]=cl_pair($uid,$actor);
  if(cl_one('SELECT status FROM chinalife_friends WHERE first_id=? AND second_id=?','ii',[$a,$b]))return ['type'=>'friends','peer'=>(string)$actor];
 }
 if($n['action']==='chinalife_message'&&preg_match('/^message-([1-9][0-9]*)$/',$key,$m)){
  $r=cl_one('SELECT id,sender_id FROM chinalife_messages WHERE id=? AND recipient_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 7 DAY)','ii',[(int)$m[1],$uid]);
  if($r&&!cl_blocked($uid,(int)$r['sender_id'])&&cl_friends($uid,(int)$r['sender_id']))return ['type'=>'message','peer'=>(string)$r['sender_id'],'message'=>(string)$r['id']];
 }
 if($n['action']==='chinalife_vote'&&preg_match('/^vote-([1-9][0-9]*)$/',$key,$m)){
  $r=cl_one('SELECT v.city,c.id FROM chinalife_politics_votes v JOIN chinalife_politics_candidates c ON c.id=v.candidate_id WHERE v.id=? AND c.candidate_id=?','ii',[(int)$m[1],$uid]);
  if($r&&in_array($r['city'],cl_open_cities(),true))return ['type'=>'ballot','city'=>$r['city'],'candidate'=>(int)$r['id']];
 }
 if($n['action']==='chinalife_money'&&str_starts_with($key,'money-')&&cl_one('SELECT id FROM chinalife_transfers WHERE id=? AND recipient_id=?','si',[substr($key,6),$uid]))return ['type'=>'wallet'];
 if($n['action']==='chinalife_activity'&&preg_match('/^weekly-([1-9][0-9]*)-(?:start|result)$/',$key,$m)){
  $r=cl_one('SELECT r.id,r.city FROM chinalife_weekly_runs r JOIN chinalife_weekly_members p ON p.run_id=r.id WHERE r.id=? AND p.user_id=?','ii',[(int)$m[1],$uid]);if($r&&in_array($r['city'],cl_open_cities(),true))return ['type'=>'weekly','id'=>(int)$r['id']];
 }
 if($n['action']==='chinalife_activity'&&preg_match('/^activity-([1-9][0-9]*)$/',$key,$m)){
  $r=cl_one('SELECT inviter_id,city,place FROM chinalife_shared_activities WHERE id=? AND invitee_id=? AND status="pending" AND expires_at>NOW()','ii',[(int)$m[1],$uid]);
  if($r&&!cl_blocked($uid,(int)$r['inviter_id']))return ['type'=>'activity','city'=>$r['city'],'place'=>$r['place']];
 }
 return null;
}
if($method==='POST'){$in=cl_body();$key=$in['notice']??'';if(!is_string($key)||!preg_match('/^[a-zA-Z0-9-]{1,100}$/',$key))cl_fail('Choose a notification');cl_run("UPDATE notifications SET seen='1' WHERE to_user_id=? AND notify_id=? AND action IN $actions",'is',[$uid,$key]);json_response('success',['read'=>true]);}
$select="SELECT notify_id id,from_user_id,action,message,time,seen FROM notifications WHERE to_user_id=? AND action IN $actions";
$rows=cl_rows($select.' ORDER BY notification_id DESC LIMIT 50','i',[$uid]);
$key=$_GET['notice']??'';
if(is_string($key)&&preg_match('/^[a-zA-Z0-9-]{1,100}$/',$key)&&!in_array($key,array_column($rows,'id'),true)){
 $selected=cl_one($select.' AND notify_id=? ORDER BY notification_id DESC LIMIT 1','is',[$uid,$key]);if($selected)array_unshift($rows,$selected);
}
foreach($rows as &$n){$n['target']=cl_notice_target($n);unset($n['from_user_id']);}unset($n);
json_response('success',['items'=>$rows]);
