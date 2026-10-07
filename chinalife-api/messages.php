<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST','DELETE']);
if ($method==='DELETE') {
    $id=filter_var($_GET['id']??null,FILTER_VALIDATE_INT);
    if (!$id) cl_fail('Choose a message');
    if (!cl_run('DELETE FROM chinalife_messages WHERE id=? AND sender_id=?','ii',[$id,$uid])) cl_fail('Only your own messages can be deleted',403);
    json_response('success',['deleted'=>true]);
}
$input=$method==='POST'?cl_body():$_GET;
$peer=isset($input['peer']) && $input['peer']!=='' ? cl_peer($input['peer']):null;
if ($peer) {
    if (cl_blocked($uid,$peer)||!cl_friends($uid,$peer)) cl_fail('Accept a friend request before private messaging',403);
    $city='';$place='';
} else {[$city,$place]=cl_room($input);cl_presence($uid,$city,$place);}
if ($method==='POST') {
    $text=$input['text']??null;
    if (!is_string($text)||trim($text)===''||mb_strlen($text)>400) cl_fail('Write a message between 1 and 400 characters');
    cl_rate('messages',5,10);
    $statement=cl_query('INSERT INTO chinalife_messages(sender_id,recipient_id,city,place,body,created_at) VALUES(?,?,?,?,?,NOW())','iisss',[$uid,$peer,$city,$place,trim($text)]);
    $id=(string)$statement->insert_id;$statement->close();
    cl_run('DELETE FROM chinalife_messages WHERE created_at<DATE_SUB(NOW(),INTERVAL 7 DAY)');
    json_response('success',['id'=>$id]);
}
$base='SELECT m.id,m.sender_id player_id,COALESCE(p.name,u.user_name) name,COALESCE(p.color,"#246fa7") color,m.body,UNIX_TIMESTAMP(m.created_at)*1000 created_at,(m.sender_id=?) own FROM chinalife_messages m JOIN users u ON u.user_id=m.sender_id LEFT JOIN chinalife_presence p ON p.user_id=m.sender_id WHERE m.created_at>=DATE_SUB(NOW(),INTERVAL 7 DAY) AND ';
if ($peer) $rows=cl_rows($base.'((m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?)) ORDER BY m.id DESC LIMIT 50','iiiii',[$uid,$uid,$peer,$peer,$uid]);
else $rows=cl_rows($base.'m.city=? AND m.place=? AND m.recipient_id IS NULL AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=m.sender_id) OR (b.owner_id=m.sender_id AND b.peer_id=?)) ORDER BY m.id DESC LIMIT 50','issii',[$uid,$city,$place,$uid,$uid]);
foreach ($rows as &$row) {$row['id']=(string)$row['id'];$row['player_id']=(string)$row['player_id'];$row['created_at']=(int)$row['created_at'];$row['own']=(bool)$row['own'];} unset($row);
json_response('success',['messages'=>array_reverse($rows)]);
