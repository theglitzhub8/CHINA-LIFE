<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['POST']);$input=cl_body();$id=filter_var($input['message']??null,FILTER_VALIDATE_INT);$reason=$input['reason']??'';
if (!$id||!in_array($reason,['spam','harassment','inappropriate','other'],true)) cl_fail('Choose a message and reason');
$row=cl_one('SELECT * FROM chinalife_messages WHERE id=?','i',[$id]);if (!$row) cl_fail('Message unavailable',404);
cl_message_access($row);if ((int)$row['sender_id']===$uid) cl_fail('Delete your own message instead');
cl_rate('report',10,60);cl_run('INSERT IGNORE INTO chinalife_reports(reporter_id,message_id,reason,message_body,sender_id,created_at) VALUES(?,?,?,?,?,NOW())','iissi',[$uid,$id,$reason,$row['body'],(int)$row['sender_id']]);
json_response('success',['ok'=>true]);
