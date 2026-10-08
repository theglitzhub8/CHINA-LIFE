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
    [$city,$place] = cl_scoped_room($input); cl_rate('presence',30,10);
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
$own=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND city=?','is',[$uid,$city]);
$private=$own&&cl_private_place($own['place']);$roomPlace=$own['place']??'';
if($private){$base=explode('@',$roomPlace)[0];$owner=explode('@',$roomPlace)[1]??(string)$uid;cl_scoped_room(['city'=>$city,'place'=>$base,'homeOwner'=>$owner]);
 $rows=cl_rows("SELECT p.user_id id,p.name,p.city,p.place,p.color,p.skin,p.hair,p.x,p.z,CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.xp')),'0') AS UNSIGNED) xp FROM chinalife_presence p LEFT JOIN chinalife_saves s ON s.user_id=p.user_id WHERE p.city=? AND p.place=? AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) AND p.user_id<>? AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=p.user_id) OR (b.owner_id=p.user_id AND b.peer_id=?)) ORDER BY p.user_id LIMIT 20",'ssiii',[$city,$roomPlace,$uid,$uid,$uid]);
 foreach($rows as &$p){$peer=(int)$p['id'];if($peer!==(int)$owner&&(!cl_friends((int)$owner,$peer)||cl_blocked((int)$owner,$peer)||!cl_one('SELECT id FROM chinalife_home_visits WHERE owner_id=? AND guest_id=? AND city=? AND place=? AND status="accepted" AND expires_at>NOW()','iiss',[(int)$owner,$peer,$city,$base])))$p=null;else{$p['place']=$base;$p['homeOwner']=$owner;}}unset($p);$rows=array_values(array_filter($rows));
}else{$rows = cl_rows("SELECT p.user_id id,p.name,p.city,p.place,p.color,p.skin,p.hair,p.x,p.z,CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.xp')),'0') AS UNSIGNED) xp FROM chinalife_presence p LEFT JOIN chinalife_saves s ON s.user_id=p.user_id WHERE p.city=? AND p.place<>'home' AND p.place NOT LIKE 'home-%' AND p.place NOT LIKE 'home@%' AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) AND p.user_id<>? AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=p.user_id) OR (b.owner_id=p.user_id AND b.peer_id=?)) ORDER BY p.seen_at DESC,p.user_id LIMIT 200",'siii',[$city,$uid,$uid,$uid]);}

foreach ($rows as &$row) {$row['id']=(string)$row['id'];$row['xp']=(int)$row['xp'];$row['x']=(float)$row['x'];$row['z']=(float)$row['z'];} unset($row);
json_response('success',['id'=>(string)$uid,'players'=>$rows]);
