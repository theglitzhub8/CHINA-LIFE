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
    // What the player is doing, from a fixed list (nothing free-form is shown to others).
    $activity=$input['activity']??'idle';if(!in_array($activity,['idle','walk','travel','sport','shop','cook','dance','eat','music','chat','pray','work','relax','sleep','study','health'],true))$activity='idle';
    // arrived_at is set first so it still compares against the old place; it records when they reached this venue.
    cl_run('INSERT INTO chinalife_presence(user_id,name,city,place,color,skin,hair,x,z,activity,arrived_at,seen_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE arrived_at=IF(city=VALUES(city) AND place=VALUES(place) AND seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND),arrived_at,NOW()),name=VALUES(name),city=VALUES(city),place=VALUES(place),color=VALUES(color),skin=VALUES(skin),hair=VALUES(hair),x=VALUES(x),z=VALUES(z),activity=VALUES(activity),seen_at=NOW()', 'issssssdds',[$uid,trim($name),$city,$place,$input['color'],$input['skin'],$input['hair'],(float)$input['x'],(float)$input['z'],$activity]);
}
$city = $input['city'] ?? '';
if (!in_array($city,['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true)) cl_fail('Choose a valid city');
$own=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND city=?','is',[$uid,$city]);
$private=$own&&cl_private_place($own['place']);$roomPlace=$own['place']??'';
if($private){$base=explode('@',$roomPlace)[0];$owner=explode('@',$roomPlace)[1]??(string)$uid;cl_scoped_room(['city'=>$city,'place'=>$base,'homeOwner'=>$owner]);
 $rows=cl_rows("SELECT p.user_id id,p.name,p.city,p.place,p.color,p.skin,p.hair,p.x,p.z,p.activity,UNIX_TIMESTAMP(p.arrived_at)*1000 since,CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.xp')),'0') AS UNSIGNED) xp,JSON_EXTRACT(s.game_state,'$.wardrobe.wearing') wearing,JSON_EXTRACT(s.game_state,'$.wardrobe.colors') wear_colors,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.day')) vip_day,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.hour')) vip_hour,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.vipUntil')) vip_until,JSON_EXTRACT(s.game_state,'$.vipPass') vip_pass FROM chinalife_presence p LEFT JOIN chinalife_saves s ON s.user_id=p.user_id WHERE p.city=? AND p.place=? AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) AND p.user_id<>? AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=p.user_id) OR (b.owner_id=p.user_id AND b.peer_id=?)) ORDER BY p.user_id LIMIT 20",'ssiii',[$city,$roomPlace,$uid,$uid,$uid]);
 foreach($rows as &$p){$peer=(int)$p['id'];if($peer!==(int)$owner&&(!cl_friends((int)$owner,$peer)||cl_blocked((int)$owner,$peer)||!cl_one('SELECT id FROM chinalife_home_visits WHERE owner_id=? AND guest_id=? AND city=? AND place=? AND status="accepted" AND expires_at>NOW()','iiss',[(int)$owner,$peer,$city,$base])))$p=null;else{$p['place']=$base;$p['homeOwner']=$owner;}}unset($p);$rows=array_values(array_filter($rows));
}
$public = cl_rows("SELECT p.user_id id,p.name,p.city,p.place,p.color,p.skin,p.hair,p.x,p.z,p.activity,UNIX_TIMESTAMP(p.arrived_at)*1000 since,CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.xp')),'0') AS UNSIGNED) xp,JSON_EXTRACT(s.game_state,'$.wardrobe.wearing') wearing,JSON_EXTRACT(s.game_state,'$.wardrobe.colors') wear_colors,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.day')) vip_day,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.hour')) vip_hour,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.vipUntil')) vip_until,JSON_EXTRACT(s.game_state,'$.vipPass') vip_pass FROM chinalife_presence p LEFT JOIN chinalife_saves s ON s.user_id=p.user_id WHERE p.city=? AND p.place<>'home' AND p.place NOT LIKE 'home-%' AND p.place NOT LIKE 'home@%' AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) AND p.user_id<>? AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=p.user_id) OR (b.owner_id=p.user_id AND b.peer_id=?)) ORDER BY p.seen_at DESC,p.user_id LIMIT 200",'siii',[$city,$uid,$uid,$uid]);
// Everyone online in this city: players in public venues with their venue, players at home only as "Private home".
$atHome=cl_rows("SELECT p.user_id id,p.name,p.city,'private-home' place,p.color,p.skin,p.hair,0 x,0 z,'idle' activity,UNIX_TIMESTAMP(p.arrived_at)*1000 since,CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.xp')),'0') AS UNSIGNED) xp,NULL wearing,NULL wear_colors,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.day')) vip_day,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.hour')) vip_hour,JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.vipUntil')) vip_until,JSON_EXTRACT(s.game_state,'$.vipPass') vip_pass FROM chinalife_presence p LEFT JOIN chinalife_saves s ON s.user_id=p.user_id WHERE p.city=? AND (p.place='home' OR p.place LIKE 'home-%' OR p.place LIKE 'home@%') AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) AND p.user_id<>? AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=p.user_id) OR (b.owner_id=p.user_id AND b.peer_id=?)) ORDER BY p.seen_at DESC LIMIT 100",'siii',[$city,$uid,$uid,$uid]);
if(!$private)$rows=[];$seen=array_flip(array_map(fn($r)=>(string)$r['id'],$rows));
foreach(array_merge($public,$atHome) as $r)if(!isset($seen[(string)$r['id']])){$seen[(string)$r['id']]=1;$rows[]=$r;}

// What each player wears comes from their saved character, so outfits cannot be faked by the client.
foreach ($rows as &$row) {$vipDay=(int)($row['vip_day']??1);$vipPass=json_decode((string)($row['vip_pass']??''),true);$vipNight=$vipDay-((int)($row['vip_hour']??720)<360?1:0);$row['vip']=(int)($row['vip_until']??0)>=$vipDay||(isset($vipPass[$row['place']])&&(int)$vipPass[$row['place']]===$vipNight);unset($row['vip_day'],$row['vip_hour'],$row['vip_until'],$row['vip_pass']);$row['id']=(string)$row['id'];$row['xp']=(int)$row['xp'];$row['activity']=(string)($row['activity']??'idle');$row['since']=(int)($row['since']??0);$row['x']=(float)$row['x'];$row['z']=(float)$row['z'];$w=json_decode((string)($row['wearing']??''),true);$c=json_decode((string)($row['wear_colors']??''),true);$row['wearing']=is_array($w)?['top'=>is_string($w['top']??null)?$w['top']:null,'bottom'=>is_string($w['bottom']??null)?$w['bottom']:null,'shoes'=>is_string($w['shoes']??null)?$w['shoes']:null,'acc'=>array_values(array_filter(array_slice((array)($w['acc']??[]),0,4),'is_string'))]:null;$row['colors']=is_array($c)?array_filter($c,fn($v,$k)=>is_string($k)&&is_string($v)&&preg_match('/^#[0-9a-fA-F]{6}$/',$v),ARRAY_FILTER_USE_BOTH):(object)[];unset($row['wear_colors']);} unset($row);
// Quick phrases sent in this room during the last few seconds (blocked players are left out).
$gestures=$roomPlace===''?[]:cl_rows('SELECT g.id,g.sender_id sender,g.target_id target,g.phrase FROM chinalife_gestures g WHERE g.city=? AND g.place=? AND g.created_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND) AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=g.sender_id) OR (b.owner_id=g.sender_id AND b.peer_id=?)) ORDER BY g.id DESC LIMIT 30','ssii',[$city,$roomPlace,$uid,$uid]);
foreach($gestures as &$g){$g['id']=(string)$g['id'];$g['sender']=(string)$g['sender'];$g['target']=$g['target']===null?null:(string)$g['target'];}unset($g);
json_response('success',['id'=>(string)$uid,'players'=>$rows,'gestures'=>$gestures]);
