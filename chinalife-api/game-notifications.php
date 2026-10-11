<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);
if($method==='POST'){$in=cl_body();$key=$in['notice']??'';if(!is_string($key)||!preg_match('/^[a-zA-Z0-9-]{1,100}$/',$key))cl_fail('Choose a notification');cl_run("UPDATE notifications SET seen='1' WHERE to_user_id=? AND notify_id=? AND action IN ('chinalife_vote','chinalife_friend','chinalife_money')",'is',[$uid,$key]);json_response('success',['read'=>true]);}
$rows=cl_rows("SELECT notify_id id,action,message,time,seen FROM notifications WHERE to_user_id=? AND action IN ('chinalife_vote','chinalife_friend','chinalife_money') ORDER BY notification_id DESC LIMIT 50",'i',[$uid]);json_response('success',['items'=>$rows]);
