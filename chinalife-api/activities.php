<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);
$catalog=require __DIR__.'/shared-config.php';
function shared_romance(int $a,int $b,string $kind): void {
 if(!in_array($kind,['girlfriend','boyfriend','date'],true))return;
 $rows=cl_rows('SELECT user_id,game_state FROM chinalife_saves WHERE user_id IN (?,?)','ii',[$a,$b]);$g=[];
 foreach($rows as $r)$g[(int)$r['user_id']]=json_decode($r['game_state'],true)['gender']??null;
 if(!in_array($g[$a]??null,['male','female'],true)||!in_array($g[$b]??null,['male','female'],true))cl_fail('Both players must set their gender in Profile first',409);
 if($g[$a]===$g[$b])cl_fail('Romantic requests are available between male and female characters',409);
 if(($kind==='girlfriend'&&$g[$b]!=='female')||($kind==='boyfriend'&&$g[$b]!=='male'))cl_fail('Choose the matching relationship request',409);
}
function shared_present(array $row): void {
 $count=cl_one('SELECT COUNT(*) count FROM chinalife_presence WHERE user_id IN (?,?) AND city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','iiss',[(int)$row['inviter_id'],(int)$row['invitee_id'],$row['city'],$row['place']]);
 if((int)$count['count']!==2)cl_fail('Both players must be online at this venue',409);
}
if($method==='GET') {
 $rows=cl_rows('SELECT a.*,(SELECT COUNT(*) FROM chinalife_shared_activities history WHERE history.status="completed" AND LEAST(history.inviter_id,history.invitee_id)=LEAST(a.inviter_id,a.invitee_id) AND GREATEST(history.inviter_id,history.invitee_id)=GREATEST(a.inviter_id,a.invitee_id)) memories,u.user_name inviter_name,v.user_name invitee_name,UNIX_TIMESTAMP(a.started_at)*1000 started_ms,UNIX_TIMESTAMP(a.expires_at)*1000 expires_ms FROM chinalife_shared_activities a JOIN users u ON u.user_id=a.inviter_id JOIN users v ON v.user_id=a.invitee_id WHERE (a.inviter_id=? OR a.invitee_id=?) AND ((a.expires_at>NOW() AND a.status IN ("pending","accepted","active")) OR a.completed_at>=DATE_SUB(NOW(),INTERVAL 1 DAY)) ORDER BY a.id DESC LIMIT 20','ii',[$uid,$uid]);
 foreach($rows as &$r){$r['id']=(string)$r['id'];$r['inviter_id']=(string)$r['inviter_id'];$r['invitee_id']=(string)$r['invitee_id'];$r['started_ms']=$r['started_ms']===null?null:(int)$r['started_ms'];$r['expires_ms']=(int)$r['expires_ms'];$r['ready_a']=(bool)$r['ready_a'];$r['ready_b']=(bool)$r['ready_b'];}unset($r);
 $relationships=cl_rows('SELECT a.id,a.kind,a.inviter_id,a.invitee_id,u.user_name inviter_name,v.user_name invitee_name FROM chinalife_shared_activities a JOIN users u ON u.user_id=a.inviter_id JOIN users v ON v.user_id=a.invitee_id WHERE (a.inviter_id=? OR a.invitee_id=?) AND a.kind IN ("girlfriend","boyfriend") AND a.status="completed" AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=a.inviter_id AND b.peer_id=a.invitee_id) OR (b.owner_id=a.invitee_id AND b.peer_id=a.inviter_id))','ii',[$uid,$uid]);
 foreach($relationships as &$r){foreach(['id','inviter_id','invitee_id'] as $k)$r[$k]=(string)$r[$k];}unset($r);
 json_response('success',['catalog'=>$catalog,'activities'=>$rows,'relationships'=>$relationships,'serverTime'=>(int)round(microtime(true)*1000)]);
}
cl_rate('shared_activity',30,60);$input=cl_body();$action=$input['action']??'';
if($action==='invite') {
 $peer=cl_peer($input['peer']??null);$kind=$input['kind']??'';if(!is_string($kind)||!isset($catalog[$kind]))cl_fail('Choose a shared activity');
 shared_romance($uid,$peer,$kind);if(cl_blocked($uid,$peer))cl_fail('Player unavailable',403);
 if($kind==='spar'){
  // Harassment controls: players choose who may challenge them, and a declined challenge cannot be repeated for a day.
  $from=json_decode(cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=?','i',[$peer])['game_state']??'{}',true)['sparFrom']??'friends';
  if($from==='off'||($from!=='everyone'&&!cl_friends($uid,$peer)))cl_fail('This player is not taking sparring challenges from you',403);
  if(cl_one('SELECT id FROM chinalife_shared_activities WHERE inviter_id=? AND invitee_id=? AND kind="spar" AND status="declined" AND created_at>=DATE_SUB(NOW(),INTERVAL 1 DAY) LIMIT 1','ii',[$uid,$peer]))cl_fail('They declined your last spar. Wait a day before asking again',429);
 }
 cl_rate('shared_invite',10,60);
 $presence=cl_one('SELECT city FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','i',[$uid]);
 if(($presence['city']??'')!=='Shenyang')cl_fail('Shared student activities start in Shenyang',409);
 cl_presence($peer,'Shenyang',cl_one('SELECT place FROM chinalife_presence WHERE user_id=?','i',[$peer])['place']??'');
 $db->begin_transaction();
 try{
  cl_rows('SELECT user_id FROM users WHERE user_id IN (?,?) ORDER BY user_id FOR UPDATE','ii',[$uid,$peer]);
  if(count(cl_rows('SELECT user_id FROM chinalife_saves WHERE user_id IN (?,?)','ii',[$uid,$peer]))!==2)cl_fail('Both players need saved characters',409);
  if(cl_one('SELECT id FROM chinalife_shared_activities WHERE (inviter_id IN (?,?) OR invitee_id IN (?,?)) AND status IN ("pending","accepted","active") AND expires_at>NOW() LIMIT 1','iiii',[$uid,$peer,$uid,$peer]))cl_fail('Finish or cancel your current activity invitation first',409);
  if(!empty($catalog[$kind]['proposal'])&&cl_one('SELECT id FROM chinalife_shared_activities WHERE kind IN ("girlfriend","boyfriend") AND status="completed" AND (inviter_id IN (?,?) OR invitee_id IN (?,?)) LIMIT 1','iiii',[$uid,$peer,$uid,$peer]))cl_fail('End your existing relationship before starting another',409);
  [$first,$second]=cl_pair($uid,$peer);
  if(cl_one('SELECT id FROM chinalife_shared_activities WHERE LEAST(inviter_id,invitee_id)=? AND GREATEST(inviter_id,invitee_id)=? AND kind=? AND status="completed" AND completed_at>=CURDATE()','iis',[$first,$second,$kind]))cl_fail('You already completed this activity together today',409);
  $s=cl_query('INSERT INTO chinalife_shared_activities(inviter_id,invitee_id,kind,city,place,created_at,expires_at) VALUES(?,?,?,"Shenyang",?,NOW(),DATE_ADD(NOW(),INTERVAL 5 MINUTE))','iiss',[$uid,$peer,$kind,$catalog[$kind]['place']]);$id=(string)$s->insert_id;$s->close();$db->commit();json_response('success',['id'=>$id]);
 }catch(Throwable $e){$db->rollback();throw $e;}
}
$id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if(!$id)cl_fail('Choose an invitation');
$db->begin_transaction();
try{
 $row=cl_one('SELECT *,expires_at>NOW() fresh,TIMESTAMPDIFF(SECOND,started_at,NOW()) elapsed FROM chinalife_shared_activities WHERE id=? FOR UPDATE','i',[$id]);
 if(!$row||!in_array($uid,[(int)$row['inviter_id'],(int)$row['invitee_id']],true))cl_fail('Invitation unavailable',404);
 if($action==='end-relationship'){
  if($row['status']!=='completed'||empty($catalog[$row['kind']]['proposal']))cl_fail('Relationship unavailable',409);
  cl_run('UPDATE chinalife_shared_activities SET status="cancelled" WHERE id=?','i',[$id]);$db->commit();json_response('success',['ok'=>true]);
 }
 if($row['status']==='completed'&&$action==='finish'){$db->commit();json_response('success',['completed'=>true,'duplicate'=>true]);}
 if(!$row['fresh']||in_array($row['status'],['cancelled','declined','completed'],true))cl_fail('This activity has ended',409);
 if($action==='cancel'||$action==='decline') {
  if($action==='decline'&&($uid!==(int)$row['invitee_id']||$row['status']!=='pending'))cl_fail('Only the invited player can decline',403);
  cl_run('UPDATE chinalife_shared_activities SET status=? WHERE id=?','si',[$action==='decline'?'declined':'cancelled',$id]);
 }else{
  if(cl_blocked((int)$row['inviter_id'],(int)$row['invitee_id']))cl_fail('Player unavailable',403);
  $spec=$catalog[$row['kind']];$slot=$uid===(int)$row['inviter_id']?'a':'b';
  if($action==='accept'){shared_romance((int)$row['inviter_id'],(int)$row['invitee_id'],$row['kind']);
   if($slot!=='b'||$row['status']!=='pending')cl_fail('Only the invited player can accept',403);
   if(!empty($spec['proposal'])){
    cl_rows('SELECT user_id FROM users WHERE user_id IN (?,?) ORDER BY user_id FOR UPDATE','ii',[(int)$row['inviter_id'],(int)$row['invitee_id']]);
    if(cl_one('SELECT id FROM chinalife_shared_activities WHERE kind IN ("girlfriend","boyfriend") AND status="completed" AND (inviter_id IN (?,?) OR invitee_id IN (?,?)) LIMIT 1','iiii',[(int)$row['inviter_id'],(int)$row['invitee_id'],(int)$row['inviter_id'],(int)$row['invitee_id']]))cl_fail('One of you already has a relationship',409);
    cl_run('UPDATE chinalife_shared_activities SET status="completed",completed_at=NOW() WHERE id=?','i',[$id]);
   }else cl_run('UPDATE chinalife_shared_activities SET status="accepted",expires_at=DATE_ADD(NOW(),INTERVAL 30 MINUTE) WHERE id=?','i',[$id]);
  }elseif($action==='ready'){
   if($row['status']!=='accepted')cl_fail('Accept the invitation first',409);
   shared_present($row);
   cl_run("UPDATE chinalife_shared_activities SET ready_$slot=1 WHERE id=?",'i',[$id]);
   if($row['ready_'.($slot==='a'?'b':'a')])cl_run('UPDATE chinalife_shared_activities SET status="active",started_at=NOW() WHERE id=?','i',[$id]);
  }elseif($action==='choose'){
   if($row['status']!=='active'||!is_string($input['choice']??null)||!isset($spec['choices'][$input['choice']]))cl_fail('Choose a valid activity response',409);
   shared_present($row);cl_run("UPDATE chinalife_shared_activities SET choice_$slot=? WHERE id=?",'si',[$input['choice'],$id]);
  }elseif($action==='finish'){
   if($row['status']!=='active'||!$row['choice_a']||!$row['choice_b']||(int)$row['elapsed']<$spec['seconds'])cl_fail('Both players must participate and finish the activity',409);
   shared_present($row);
   $saves=cl_rows('SELECT user_id,game_state FROM chinalife_saves WHERE user_id IN (?,?) ORDER BY user_id FOR UPDATE','ii',[(int)$row['inviter_id'],(int)$row['invitee_id']]);
   if(count($saves)!==2)cl_fail('Both characters must still be saved',409);
   foreach($saves as $save){$g=json_decode($save['game_state'],true,512,JSON_THROW_ON_ERROR);if(($g['money']??0)+$spec['money']>1000000000||($g['xp']??0)+$spec['xp']>10000000)cl_fail('Reward limit reached',409);$g['money']+=$spec['money'];$g['xp']+=$spec['xp'];$g['transferTotal']=($g['transferTotal']??0)+$spec['money'];$g['sharedXP']=($g['sharedXP']??0)+$spec['xp'];cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),(int)$save['user_id']]);}
   cl_run('UPDATE chinalife_shared_activities SET status="completed",completed_at=NOW() WHERE id=?','i',[$id]);
  }else cl_fail('Choose a valid activity action');
 }
 $db->commit();json_response('success',['ok'=>true]);
}catch(Throwable $e){$db->rollback();throw $e;}
