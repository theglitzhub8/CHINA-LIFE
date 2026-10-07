<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST','DELETE']);
$config=is_file(__DIR__.'/push-config.php')?require __DIR__.'/push-config.php':null;
if ($method==='GET') json_response('success',['enabled'=>(bool)$config,'publicKey'=>$config['public']??null]);
$input=cl_body();$endpoint=(string)($input['endpoint']??'');
// Only real browser push services, so the server never posts to arbitrary addresses.
if (!preg_match('#^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/[^\s]{8,600}$#',$endpoint)&&!(getenv('CHINALIFE_PUSH_TEST')&&str_starts_with($endpoint,'http://127.0.0.1:'))) cl_fail('Unsupported push endpoint');
$hash=hash('sha256',$endpoint);
if ($method==='DELETE') {cl_run('DELETE FROM chinalife_push WHERE endpoint_hash=? AND user_id=?','si',[$hash,$uid]);json_response('success',['removed'=>true]);}
if (!$config) cl_fail('Notifications are not set up on this server yet',503);
cl_rate('push',10,60);
cl_run('INSERT INTO chinalife_push(user_id,endpoint,endpoint_hash,created_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)','iss',[$uid,$endpoint,$hash]);
json_response('success',['subscribed'=>true]);
