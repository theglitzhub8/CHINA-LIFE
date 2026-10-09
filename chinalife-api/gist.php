<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);
if ($method==='GET') {
 $city=$_GET['city']??'Shenyang';
 if(!is_string($city)||!in_array($city,cl_open_cities(),true))cl_fail('Choose an active city');
 json_response('success',['posts'=>cl_rows('SELECT id,title,body,link,UNIX_TIMESTAMP(created_at)*1000 at FROM chinalife_gist_posts WHERE city=? AND active=1 AND starts_at<=NOW() AND ends_at>NOW() ORDER BY id DESC LIMIT 30','s',[$city])]);
}
cl_rate('gist_submit',3,3600);$input=cl_body();
$city=$input['city']??'';$title=$input['title']??'';$body=$input['body']??'';$link=$input['link']??'';
if(!is_string($city)||!in_array($city,cl_open_cities(),true)||!is_string($title)||!is_string($body)||!is_string($link))cl_fail('Check your post');
$title=trim($title);$body=trim($body);$link=trim($link);
if($title===''||mb_strlen($title)>100||$body===''||mb_strlen($body)>600)cl_fail('Add a title and message');
if($link!==''&&!preg_match('#^https://[^\s<>"\x27]{3,290}$#',$link))cl_fail('Links must start with https://');
cl_run('INSERT INTO chinalife_gist_posts(city,title,body,link,active,starts_at,ends_at,created_by,created_at) VALUES(?,?,?,?,0,NOW(),DATE_ADD(NOW(),INTERVAL 7 DAY),?,NOW())','ssssi',[$city,$title,$body,$link,$uid]);
json_response('success',['submitted'=>true],'Your gist was sent for admin review.');
