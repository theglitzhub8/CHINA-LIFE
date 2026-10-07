<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET']);
[$city,$place]=cl_room($_GET);
$after=$_GET['after']??null;
$cursor=(string)(cl_one('SELECT COALESCE(MAX(id),0) id FROM chinalife_messages')['id']);
if($after===null)json_response('success',['cursor'=>$cursor,'messages'=>[]]);
if(!is_string($after)||!preg_match('/^[0-9]{1,18}$/',$after))cl_fail('Invalid notification cursor');
$here=cl_one('SELECT user_id FROM chinalife_presence WHERE user_id=? AND city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','iss',[$uid,$city,$place])!==null;
$rows=cl_rows('SELECT m.id,m.sender_id player_id,u.user_name name,m.body,m.recipient_id FROM chinalife_messages m JOIN users u ON u.user_id=m.sender_id WHERE m.id>? AND m.id<=? AND m.sender_id<>? AND m.created_at>=DATE_SUB(NOW(),INTERVAL 7 DAY) AND ((m.recipient_id=? AND EXISTS(SELECT 1 FROM chinalife_friends f WHERE f.first_id=LEAST(m.sender_id,?) AND f.second_id=GREATEST(m.sender_id,?) AND f.status="accepted")) OR (?=1 AND m.recipient_id IS NULL AND m.city=? AND m.place=?)) AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=m.sender_id) OR (b.owner_id=m.sender_id AND b.peer_id=?)) ORDER BY m.id LIMIT 50','ssiiiiissii',[$after,$cursor,$uid,$uid,$uid,$uid,(int)$here,$city,$place,$uid,$uid]);
foreach($rows as &$row){$row['id']=(string)$row['id'];$row['player_id']=(string)$row['player_id'];$row['channel']=$row['recipient_id']===null?'venue':'direct';unset($row['recipient_id']);}unset($row);
// Drain large batches before advancing past them.
if(count($rows)===50)$cursor=$rows[49]['id'];
json_response('success',['cursor'=>$cursor,'messages'=>$rows]);
