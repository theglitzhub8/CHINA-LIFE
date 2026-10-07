<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);
if ($method==='GET') {
    $city=$_GET['city']??'Shenyang';
    $rows=cl_rows('SELECT e.id,e.title,e.body,e.place,e.reward,e.billboard,e.link,UNIX_TIMESTAMP(e.ends_at)*1000 ends_at,EXISTS(SELECT 1 FROM chinalife_event_claims c WHERE c.event_id=e.id AND c.user_id=?) joined FROM chinalife_events e WHERE e.city=? AND e.starts_at<=NOW() AND e.ends_at>NOW() ORDER BY e.id DESC LIMIT 20','is',[$uid,$city]);
    foreach ($rows as &$r) {$r['id']=(string)$r['id'];$r['reward']=(int)$r['reward'];$r['billboard']=(bool)$r['billboard'];$r['joined']=(bool)$r['joined'];$r['ends_at']=(int)$r['ends_at'];}unset($r);
    json_response('success',['events'=>$rows,'admin'=>cl_is_admin(),'cities'=>cl_open_cities()]);
}
cl_rate('event',10,60);$input=cl_body();$id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if (!$id) cl_fail('Choose an event');
$db->begin_transaction();
$event=cl_one('SELECT id,place,reward,city FROM chinalife_events WHERE id=? AND starts_at<=NOW() AND ends_at>NOW() FOR UPDATE','i',[$id]);
if (!$event) {$db->rollback();cl_fail('This event has ended',404);}
// Players must be at the event venue (by their live presence) to join it.
if ($event['place']!==''&&!cl_one('SELECT 1 FROM chinalife_presence WHERE user_id=? AND city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND)','iss',[$uid,$event['city'],$event['place']])) {$db->rollback();cl_fail('Go to the event venue to join',409);}
if (!cl_run('INSERT IGNORE INTO chinalife_event_claims(event_id,user_id,created_at) VALUES(?,?,NOW())','ii',[$id,$uid])) {$db->rollback();cl_fail('You already joined this event',409);}
$reward=(int)$event['reward'];if ($reward>0) cl_credit($uid,$reward);
$db->commit();json_response('success',['joined'=>true,'reward'=>$reward]);
