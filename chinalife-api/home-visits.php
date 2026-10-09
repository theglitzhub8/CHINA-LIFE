<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);
if($method==='GET'){
 $rows=cl_rows('SELECT v.id,v.owner_id,v.guest_id,v.city,v.place,v.status,u.user_name owner_name,g.user_name guest_name FROM chinalife_home_visits v JOIN users u ON u.user_id=v.owner_id JOIN users g ON g.user_id=v.guest_id WHERE (v.owner_id=? OR v.guest_id=?) AND v.expires_at>NOW() AND v.status IN ("pending","accepted") ORDER BY v.id DESC LIMIT 50','ii',[$uid,$uid]);
 foreach($rows as &$r){$r['id']=(string)$r['id'];$r['owner_id']=(string)$r['owner_id'];$r['guest_id']=(string)$r['guest_id'];}unset($r);json_response('success',['visits'=>$rows]);
}
$input=cl_body();$action=$input['action']??'';
if($action==='invite'){
 [$city,$place]=cl_room($input);if(!cl_private_place($place))cl_fail('Invite from your own home');cl_presence($uid,$city,$place.'@'.$uid);
 if($place!=='home'){$saved=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=?','i',[$uid]);$game=json_decode($saved['game_state']??'{}',true);if(!in_array($place,$game['ownedHomes']??[],true))cl_fail('Buy this address before inviting',403);}
 $peer=cl_peer($input['peer']??null);if($peer===$uid||!cl_friends($uid,$peer)||cl_blocked($uid,$peer))cl_fail('Invite an accepted friend',403);
 cl_rate('home-invites',10,60);$existing=cl_one('SELECT id FROM chinalife_home_visits WHERE owner_id=? AND guest_id=? AND city=? AND place=? AND status IN ("pending","accepted") AND expires_at>NOW()','iiss',[$uid,$peer,$city,$place]);
 if(!$existing){$q=cl_query('INSERT INTO chinalife_home_visits(owner_id,guest_id,city,place,status,expires_at) VALUES(?,?,?,?,"pending",DATE_ADD(NOW(),INTERVAL 2 HOUR))','iiss',[$uid,$peer,$city,$place]);$id=(string)$q->insert_id;$q->close();}else $id=(string)$existing['id'];cl_bump([$uid,$peer],'visits');json_response('success',['id'=>$id]);
}
$id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if(!$id)cl_fail('Choose an invitation');
$v=cl_one('SELECT * FROM chinalife_home_visits WHERE id=? AND expires_at>NOW()','i',[$id]);if(!$v)cl_fail('This invitation expired',404);
if(in_array($action,['decline','leave','revoke'],true)){
 if(($action==='revoke'&&(int)$v['owner_id']!==$uid)||($action!=='revoke'&&(int)$v['guest_id']!==$uid))cl_fail('This invitation is private',403);
 cl_run('UPDATE chinalife_home_visits SET status="closed" WHERE id=?','i',[$id]);cl_bump([(int)$v['owner_id'],(int)$v['guest_id']],'visits');cl_run('DELETE FROM chinalife_presence WHERE user_id=? AND city=? AND place=?','iss',[(int)$v['guest_id'],$v['city'],$v['place'].'@'.$v['owner_id']]);cl_run('DELETE FROM chinalife_voice_members WHERE user_id=? AND city=? AND place=?','iss',[(int)$v['guest_id'],$v['city'],$v['place'].'@'.$v['owner_id']]);json_response('success',['closed'=>true]);
}
if($action!=='accept'||(int)$v['guest_id']!==$uid||!in_array($v['status'],['pending','accepted'],true)||!cl_friends((int)$v['owner_id'],$uid)||cl_blocked((int)$v['owner_id'],$uid))cl_fail('This invitation is unavailable',403);
$save=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=?','i',[(int)$v['owner_id']]);$g=json_decode($save['game_state']??'{}',true);if(empty($g['created']))cl_fail('The host character is unavailable',409);
if($v['place']!=='home'&&!in_array($v['place'],$g['ownedHomes']??[],true))cl_fail('The host does not own this address',403);
cl_run('UPDATE chinalife_home_visits SET status="accepted" WHERE id=?','i',[$id]);cl_bump([(int)$v['owner_id'],$uid],'visits');
json_response('success',['visit'=>['id'=>(string)$id,'owner'=>(string)$v['owner_id'],'city'=>$v['city'],'place'=>$v['place'],'home'=>['properties'=>$g['properties']??[],'upgrades'=>$g['upgrades']??[],'furnitureColors'=>$g['furnitureColors']??[],'ownedHomes'=>$g['ownedHomes']??[]]]]);
