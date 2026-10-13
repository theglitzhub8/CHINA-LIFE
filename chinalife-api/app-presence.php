<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['POST']);cl_body();cl_rate('app_presence',8,60);
$row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=?','i',[$uid]);$g=$row?json_decode($row['game_state'],true):null;
if(!$g||empty($g['created']))json_response('success',['online'=>false]);
// Preserve the real room and position; the app extends activity, never teleports.
$live=cl_one('SELECT user_id,city,place FROM chinalife_presence WHERE user_id=?','i',[$uid]);
if($live){if(cl_private_place($live['place'])){[$base,$owner]=array_pad(explode('@',$live['place'],2),2,(string)$uid);cl_scoped_room(['city'=>$live['city'],'place'=>$base,'homeOwner'=>$owner]);}cl_run('UPDATE chinalife_presence SET seen_at=NOW() WHERE user_id=?','i',[$uid]);json_response('success',['online'=>true]);}
[$city,$place]=cl_scoped_room(['city'=>$g['city']??'Shenyang','place'=>$g['place']??'home']);
$skin=$g['appearance']['skin']??'#8b5c43';$color=$g['color']??'#ef9f79';$hair=$g['appearance']['hair']??'cropped';
if(!is_string($skin)||!preg_match('/^#[0-9a-f]{6}$/i',$skin))$skin='#8b5c43';if(!is_string($color)||!preg_match('/^#[0-9a-f]{6}$/i',$color))$color='#ef9f79';if(!in_array($hair,['cropped','bun','cap'],true))$hair='cropped';
cl_run('INSERT IGNORE INTO chinalife_presence(user_id,name,city,place,color,skin,hair,x,z,activity,arrived_at,seen_at) VALUES(?,?,?,?,?,?,?,0,0,"idle",NOW(),NOW())','issssss',[$uid,$auth['user_name'],$city,$place,$color,$skin,$hair]);json_response('success',['online'=>true]);
