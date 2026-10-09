<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);$input=$method==='POST'?cl_body():$_GET;
$club=$input['place']??'night';if(!in_array($club,['night', 'youle', 'ex', 'rex', 'orangutan', 'taxi-club', 'best-one', 'cats-eye', 'silver-knight', 'blood', 'skylight'],true)) cl_fail('Choose a club');
[$city,$place]=cl_room(['city'=>$input['city']??'','place'=>$club]);cl_presence($uid,$city,$place);
// Each club keeps its own DJ queue; 007 Club keeps the original per-city key.
$room=$place==='night'?$city:$city.':'.$place;
$now=(int)floor(microtime(true)*1000);
$db->begin_transaction();
$defaultTrack=['youle'=>'afrogroove','ex'=>'neon','rex'=>'hometown','orangutan'=>'midnight','taxi-club'=>'afrogroove','best-one'=>'midnight','cats-eye'=>'midnight','silver-knight'=>'neon'][$place]??'hometown';
cl_run('INSERT IGNORE INTO chinalife_music(city,track,started_at) VALUES(?,?,?)','ssi',[$room,$defaultTrack,$now]);
$state=cl_one('SELECT track,started_at FROM chinalife_music WHERE city=? FOR UPDATE','s',[$room]);
cl_run('DELETE FROM chinalife_music_requests WHERE created_at<DATE_SUB(NOW(),INTERVAL 1 HOUR)');
if ($method==='POST') {
    $track=$input['track']??'';
    // Catalogue loops, or an approved artist's song ("song:<id>").
    $isSong=is_string($track)&&preg_match('/^song:([a-f0-9]{16})$/',$track,$sm)&&cl_one('SELECT id FROM chinalife_songs WHERE id=? AND active=1','s',[$sm[1]]);
    if (!$isSong&&!in_array($track,['hometown','afrogroove','neon','midnight'],true)) {$db->rollback();cl_fail('Choose a track or an artist song');}
    // Serialize per-user queue limits across different cities as well.
    cl_one('SELECT user_id FROM users WHERE user_id=? FOR UPDATE','i',[$uid]);
    $count=cl_one('SELECT COUNT(*) n FROM chinalife_music_requests WHERE user_id=?','i',[$uid]);
    $queued=cl_one('SELECT COUNT(*) n FROM chinalife_music_requests WHERE city=?','s',[$room]);
    if ((int)$count['n']>=2||(int)$queued['n']>=20) {$db->rollback();cl_fail('The DJ queue is full. Wait for a track to play',429);}
    cl_run('INSERT INTO chinalife_music_requests(user_id,city,track,created_at) VALUES(?,?,?,NOW())','iss',[$uid,$room,$track]);
}
// Loops change every minute; an artist's song plays to the end.
$length=60000;if (preg_match('/^song:([a-f0-9]{16})$/',(string)$state['track'],$cm)){$sr=cl_one('SELECT duration FROM chinalife_songs WHERE id=?','s',[$cm[1]]);$length=$sr?max(15,(int)$sr['duration'])*1000:0;}
if ($now-(int)$state['started_at']>=$length) {
    $next=cl_one('SELECT id,track FROM chinalife_music_requests WHERE city=? ORDER BY created_at,id LIMIT 1','s',[$room]);
    $state=['track'=>$next['track']??$state['track'],'started_at'=>$now];
    cl_run('UPDATE chinalife_music SET track=?,started_at=? WHERE city=?','sis',[$state['track'],$now,$room]);
    if ($next) cl_run('DELETE FROM chinalife_music_requests WHERE id=?','i',[(int)$next['id']]);
}
$queue=cl_rows('SELECT r.id,r.track,u.user_name name FROM chinalife_music_requests r JOIN users u ON u.user_id=r.user_id LEFT JOIN chinalife_presence p ON p.user_id=r.user_id WHERE r.city=? ORDER BY r.created_at,r.id LIMIT 20','s',[$room]);
$db->commit();json_response('success',['track'=>$state['track'],'startedAt'=>(int)$state['started_at'],'serverTime'=>$now,'queue'=>$queue]);
