<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['POST']);$input=cl_body();
// Player reports: harassment, cheating, scams and more, reviewed by admins.
if (isset($input['peer'])) {
    $peer=cl_peer($input['peer']);$reason=$input['reason']??'';$note=trim((string)($input['note']??''));
    if ($peer===$uid) cl_fail('You cannot report yourself');
    if (!in_array($reason,['harassment','bullying','cheating','scam','inappropriate','username','exploit'],true)||mb_strlen($note)>300) cl_fail('Choose a reason');
    cl_rate('report',10,60);
    $here=cl_one('SELECT city,place FROM chinalife_presence WHERE user_id=?','i',[$uid]);
    cl_run('INSERT INTO chinalife_player_reports(reporter_id,peer_id,reason,note,city,place,created_at) VALUES(?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE note=VALUES(note),city=VALUES(city),place=VALUES(place),created_at=NOW()','iissss',[$uid,$peer,$reason,$note,$here['city']??'',$here['place']??'']);
    json_response('success',['ok'=>true]);
}
$id=filter_var($input['message']??null,FILTER_VALIDATE_INT);$reason=$input['reason']??'';
if (!$id||!in_array($reason,['spam','harassment','inappropriate','other'],true)) cl_fail('Choose a message and reason');
$row=cl_one('SELECT * FROM chinalife_messages WHERE id=?','i',[$id]);if (!$row) cl_fail('Message unavailable',404);
cl_message_access($row);if ((int)$row['sender_id']===$uid) cl_fail('Delete your own message instead');
cl_rate('report',10,60);cl_run('INSERT IGNORE INTO chinalife_reports(reporter_id,message_id,reason,message_body,sender_id,created_at) VALUES(?,?,?,?,?,NOW())','iissi',[$uid,$id,$reason,$row['body'],(int)$row['sender_id']]);
json_response('success',['ok'=>true]);
