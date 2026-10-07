<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET']);
$friends=cl_rows('SELECT u.user_id id,COALESCE(p.name,u.user_name) name,COALESCE(p.color,"#246fa7") color,f.status,(f.requested_by=?) outgoing,p.city,p.place,(p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)) online FROM chinalife_friends f JOIN users u ON u.user_id=IF(f.first_id=?,f.second_id,f.first_id) LEFT JOIN chinalife_presence p ON p.user_id=u.user_id WHERE (f.first_id=? OR f.second_id=?) AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=u.user_id) OR (b.owner_id=u.user_id AND b.peer_id=?)) ORDER BY f.created_at DESC LIMIT 100','iiiiii',[$uid,$uid,$uid,$uid,$uid,$uid]);
$blocks=cl_rows('SELECT u.user_id id,COALESCE(p.name,u.user_name) name,COALESCE(p.color,"#246fa7") color FROM chinalife_blocks b JOIN users u ON u.user_id=b.peer_id LEFT JOIN chinalife_presence p ON p.user_id=u.user_id WHERE b.owner_id=?','i',[$uid]);
foreach ($friends as &$row) {$row['id']=(string)$row['id'];$row['outgoing']=(bool)$row['outgoing'];$row['online']=(bool)$row['online'];}unset($row);
foreach ($blocks as &$row) $row['id']=(string)$row['id'];unset($row);
json_response('success',['friends'=>$friends,'blocked'=>$blocks]);
