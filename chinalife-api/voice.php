<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['POST','DELETE']);$input=cl_body();$session=cl_session($input['session']??null);
if ($method==='DELETE') {
    cl_run('DELETE FROM chinalife_voice_members WHERE user_id=? AND session=?','is',[$uid,$session]);
    cl_run('DELETE FROM chinalife_voice_signals WHERE (sender_id=? AND sender_session=?) OR (target_id=? AND target_session=?)','isis',[$uid,$session,$uid,$session]);json_response('success',['left'=>true]);
}
[$city,$place]=cl_scoped_room($input);cl_presence($uid,$city,$place);$action=$input['action']??'';
if (!is_bool($input['muted']??null)||!is_int($input['after']??null)||$input['after']<0) cl_fail('Invalid voice state');
cl_rate('voice',20,10);$muted=$input['muted']?1:0;
if ($action==='join') {
    $db->begin_transaction();
    cl_run('INSERT IGNORE INTO chinalife_voice_rooms(city,place) VALUES(?,?)','ss',[$city,$place]);
    cl_one('SELECT city FROM chinalife_voice_rooms WHERE city=? AND place=? FOR UPDATE','ss',[$city,$place]);
    // Up to 8 people per venue (listeners included): each phone connects to everyone else, so more would strain phones.
    $row=cl_one('SELECT COUNT(*) n FROM chinalife_voice_members WHERE city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND) AND user_id<>?','ssi',[$city,$place,$uid]);
    if ((int)$row['n']>=8) {$db->rollback();cl_fail('This voice room is full',409);}
    cl_run('INSERT INTO chinalife_voice_members(user_id,session,city,place,muted,seen_at) VALUES(?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE session=VALUES(session),city=VALUES(city),place=VALUES(place),muted=VALUES(muted),seen_at=NOW()','isssi',[$uid,$session,$city,$place,$muted]);$db->commit();
} elseif ($action==='pulse') {
    cl_voice($uid,$session,$city,$place);
    cl_run('UPDATE chinalife_voice_members SET muted=?,seen_at=NOW() WHERE user_id=? AND session=?','iis',[$muted,$uid,$session]);
} else cl_fail('Choose join or pulse');
$rows=cl_rows('SELECT v.user_id id,v.session,p.name,v.muted FROM chinalife_voice_members v JOIN chinalife_presence p ON p.user_id=v.user_id AND p.city=v.city AND p.place=v.place AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) WHERE v.city=? AND v.place=? AND v.seen_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND) AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=v.user_id) OR (b.owner_id=v.user_id AND b.peer_id=?)) ORDER BY v.user_id','ssii',[$city,$place,$uid,$uid]);
if(cl_private_place($place)&&str_contains($place,'@')){[$base,$owner]=explode('@',$place,2);$rows=array_values(array_filter($rows,function($r)use($city,$base,$owner){$peer=(int)$r['id'];return $peer===(int)$owner||(cl_friends((int)$owner,$peer)&&!cl_blocked((int)$owner,$peer)&&cl_one('SELECT id FROM chinalife_home_visits WHERE owner_id=? AND guest_id=? AND city=? AND place=? AND status="accepted" AND expires_at>NOW()','iiss',[(int)$owner,$peer,$city,$base]));}));}
foreach ($rows as &$row) {$row['id']=(string)$row['id'];$row['muted']=(bool)$row['muted'];}unset($row);
json_response('success',['id'=>(string)$uid,'members'=>$rows,'signals'=>[]]);
