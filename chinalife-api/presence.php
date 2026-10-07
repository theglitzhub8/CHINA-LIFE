<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST','DELETE']);
if ($method === 'DELETE') {
    cl_run('DELETE FROM chinalife_presence WHERE user_id=?','i',[$uid]);
    cl_run('DELETE FROM chinalife_voice_members WHERE user_id=?','i',[$uid]);
    json_response('success',['left'=>true]);
}
$input = $method === 'POST' ? cl_body() : $_GET;
if ($method === 'POST') {
    [$city,$place] = cl_room($input); cl_rate('presence',30,10);
    // The in-game name is always the player's Hafrik username.
    $name = (string)($auth['user_name'] ?? '');
    if (trim($name)==='' || mb_strlen($name)>64) cl_fail('Your Hafrik account needs a username');
    foreach (['color','skin'] as $key) if (!is_string($input[$key] ?? null) || !preg_match('/^#[0-9a-f]{6}$/i',$input[$key])) cl_fail('Invalid appearance');
    if (!in_array($input['hair'] ?? '',['cropped','bun','cap'],true)) cl_fail('Invalid hairstyle');
    foreach (['x','z'] as $key) if (!is_numeric($input[$key] ?? null) || !is_finite((float)$input[$key]) || abs((float)$input[$key])>100) cl_fail('Invalid player position');
    cl_run('INSERT INTO chinalife_presence(user_id,name,city,place,color,skin,hair,x,z,seen_at) VALUES(?,?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name),city=VALUES(city),place=VALUES(place),color=VALUES(color),skin=VALUES(skin),hair=VALUES(hair),x=VALUES(x),z=VALUES(z),seen_at=NOW()', 'issssssdd',[$uid,trim($name),$city,$place,$input['color'],$input['skin'],$input['hair'],(float)$input['x'],(float)$input['z']]);
}
$city = $input['city'] ?? '';
if (!in_array($city,['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true)) cl_fail('Choose a valid city');
$rows = cl_rows('SELECT p.user_id id,p.name,p.city,p.place,p.color,p.skin,p.hair,p.x,p.z FROM chinalife_presence p WHERE p.city=? AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) AND p.user_id<>? AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=p.user_id) OR (b.owner_id=p.user_id AND b.peer_id=?)) ORDER BY p.seen_at DESC,p.user_id LIMIT 200','siii',[$city,$uid,$uid,$uid]);
foreach ($rows as &$row) {$row['id']=(string)$row['id'];$row['x']=(float)$row['x'];$row['z']=(float)$row['z'];} unset($row);
json_response('success',['id'=>(string)$uid,'players'=>$rows]);
