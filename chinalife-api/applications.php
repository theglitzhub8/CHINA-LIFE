<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);
// Hafrik HQ service applications: players apply, admins review them in the panel.
$services=require __DIR__.'/services-config.php';
if ($method==='GET') {
    $rows=cl_rows('SELECT id,service,city,status,admin_note,created_at,updated_at FROM chinalife_applications WHERE user_id=? ORDER BY id DESC LIMIT 30','i',[$uid]);
    foreach ($rows as &$r) $r['id']=(string)$r['id'];unset($r);
    json_response('success',['services'=>$services,'applications'=>$rows]);
}
$input=cl_body();$service=$input['service']??'';
$name=trim((string)($input['name']??''));$contact=trim((string)($input['contact']??''));$city=trim((string)($input['city']??''));$message=trim((string)($input['message']??''));
if (!is_string($service)||!isset($services[$service])) cl_fail('Choose a service');
if ($name===''||mb_strlen($name)>80) cl_fail('Enter your name');
if (mb_strlen($contact)<4||mb_strlen($contact)>80) cl_fail('Enter a WhatsApp number, WeChat ID or email we can reach you on');
if (mb_strlen($city)>40||mb_strlen($message)>600) cl_fail('Keep your message under 600 characters');
cl_rate('application',5,600);
if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_applications WHERE user_id=? AND status="pending"','i',[$uid])['n']>=5) cl_fail('You already have 5 applications waiting for review',409);
if (cl_one('SELECT id FROM chinalife_applications WHERE user_id=? AND service=? AND status="pending"','is',[$uid,$service])) cl_fail('You already applied for this service. We will contact you soon',409);
$q=cl_query('INSERT INTO chinalife_applications(user_id,service,name,contact,city,message,status,created_at,updated_at) VALUES(?,?,?,?,?,?,"pending",NOW(),NOW())','isssss',[$uid,$service,$name,$contact,$city,$message]);$id=(string)$q->insert_id;$q->close();
json_response('success',['id'=>$id]);
