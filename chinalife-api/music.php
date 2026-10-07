<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);$input=$method==='POST'?cl_body():$_GET;
[$city,$place]=cl_room(['city'=>$input['city']??'','place'=>'night']);cl_presence($uid,$city,$place);
$now=(int)floor(microtime(true)*1000);
$db->begin_transaction();
cl_run("INSERT IGNORE INTO chinalife_music(city,track,started_at) VALUES(?,'hometown',?)",'si',[$city,$now]);
$state=cl_one('SELECT track,started_at FROM chinalife_music WHERE city=? FOR UPDATE','s',[$city]);
cl_run('DELETE FROM chinalife_music_requests WHERE created_at<DATE_SUB(NOW(),INTERVAL 1 HOUR)');
if ($method==='POST') {
    $track=$input['track']??'';
    if (!in_array($track,['hometown','afrogroove','neon','midnight'],true)) {$db->rollback();cl_fail('Choose a catalogue track');}
    // Serialize per-user queue limits across different cities as well.
    cl_one('SELECT user_id FROM users WHERE user_id=? FOR UPDATE','i',[$uid]);
    $count=cl_one('SELECT COUNT(*) n FROM chinalife_music_requests WHERE user_id=?','i',[$uid]);
    $room=cl_one('SELECT COUNT(*) n FROM chinalife_music_requests WHERE city=?','s',[$city]);
    if ((int)$count['n']>=2||(int)$room['n']>=20) {$db->rollback();cl_fail('The DJ queue is full. Wait for a track to play',429);}
    cl_run('INSERT INTO chinalife_music_requests(user_id,city,track,created_at) VALUES(?,?,?,NOW())','iss',[$uid,$city,$track]);
}
if ($now-(int)$state['started_at']>=60000) {
    $next=cl_one('SELECT id,track FROM chinalife_music_requests WHERE city=? ORDER BY created_at,id LIMIT 1','s',[$city]);
    $state=['track'=>$next['track']??$state['track'],'started_at'=>$now];
    cl_run('UPDATE chinalife_music SET track=?,started_at=? WHERE city=?','sis',[$state['track'],$now,$city]);
    if ($next) cl_run('DELETE FROM chinalife_music_requests WHERE id=?','i',[(int)$next['id']]);
}
$queue=cl_rows('SELECT r.id,r.track,u.user_name name FROM chinalife_music_requests r JOIN users u ON u.user_id=r.user_id LEFT JOIN chinalife_presence p ON p.user_id=r.user_id WHERE r.city=? ORDER BY r.created_at,r.id LIMIT 20','s',[$city]);
$db->commit();json_response('success',['track'=>$state['track'],'startedAt'=>(int)$state['started_at'],'serverTime'=>$now,'queue'=>$queue]);
