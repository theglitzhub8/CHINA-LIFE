<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);
$team=require __DIR__.'/hq-team.php';$services=require __DIR__.'/services-config.php';
// Identity comes from the authenticated database account, never a browser-supplied role.
$user=cl_one('SELECT user_name FROM users WHERE user_id=?','i',[$uid]);
$staff=null;foreach($team as $member)if(strcasecmp($member['username'],$user['user_name']??'')===0)$staff=$member;
$owned=$staff?$staff['services']:[];
if($method==='POST'){
 if(!$staff)cl_fail('Staff access required',403);
 $input=cl_body();$id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$status=$input['status']??'';$note=trim((string)($input['note']??''));
 if(!$id||!in_array($status,['pending','approved','declined'],true)||mb_strlen($note)>300)cl_fail('Choose a request status and keep your reply under 300 characters');
 $row=cl_one('SELECT service FROM chinalife_applications WHERE id=?','i',[$id]);
 if(!$row||!in_array($row['service'],$owned,true))cl_fail('This request belongs to another desk',403);
 cl_run('UPDATE chinalife_applications SET status=?,admin_note=?,updated_at=NOW() WHERE id=?','ssi',[$status,$note,$id]);json_response('success',['ok'=>true]);
}
$staffStatus=[];foreach($team as $member){$row=cl_one('SELECT u.user_id,p.city,p.place,COALESCE(p.seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND),0) online FROM users u LEFT JOIN chinalife_presence p ON p.user_id=u.user_id WHERE LOWER(u.user_name)=LOWER(?)','s',[$member['username']]);$staffStatus[$member['id']]=['online'=>!empty($row['online']),'atDesk'=>!empty($row['online'])&&$row['place']==='hq'];}
$inbox=[];if($owned){$marks=implode(',',array_fill(0,count($owned),'?'));$inbox=cl_rows('SELECT id,service,name,contact,city,message,status,admin_note,created_at FROM chinalife_applications WHERE service IN ('.$marks.') ORDER BY id DESC LIMIT 50',str_repeat('s',count($owned)),$owned);}
$meeting=cl_one('SELECT id FROM chinalife_applications WHERE user_id=? AND service="ceo-meeting" AND status="approved"','i',[$uid]);
json_response('success',['staff'=>$staff['id']??null,'status'=>$staffStatus,'inbox'=>$inbox,'ceoAccess'=>$staff!==null||$meeting!==null]);
