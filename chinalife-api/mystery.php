<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);

function mystery_steps(string $city): array {
    $routes=['Shenyang'=>[
        ['object'=>'plaza-lantern','place'=>'plaza','x'=>2.2,'z'=>1.1,'label'=>'Paper lantern','clue'=>'The lantern’s ribbon names the park bench as the next stop.'],
        ['object'=>'park-bench','place'=>'park','x'=>-2.0,'z'=>0.2,'label'=>'Folded note','clue'=>'The note under the bench says the last mark is a poster inside 007 Club.'],
        ['object'=>'night-poster','place'=>'night','x'=>3.1,'z'=>-1.2,'label'=>'Club poster','clue'=>'The poster closes the route. You have the whole trail.'],
    ]];
    return $routes[$city]??[];
}
function mystery_state(string $city): array {
    global $uid;
    $steps=mystery_steps($city);$have=[];
    if ($steps) foreach (cl_rows('SELECT object_id FROM chinalife_mystery_finds WHERE user_id=? AND city=?','is',[$uid,$city]) as $row) $have[$row['object_id']]=true;
    $clues=[];$next=null;$found=[];
    foreach ($steps as $step) {
        if (isset($have[$step['object']])) {$clues[]=['object'=>$step['object'],'place'=>$step['place'],'text'=>$step['clue']];$found[]=$step['object'];}
        else {$next=['object'=>$step['object'],'place'=>$step['place'],'x'=>$step['x'],'z'=>$step['z'],'label'=>$step['label']];break;}
    }
    return ['city'=>$city,'found'=>$found,'clues'=>$clues,'next'=>$next];
}

$city=(string)($_GET['city']??'');
if ($method==='GET') {
    if (!in_array($city,cl_open_cities(),true)) cl_fail('Choose an active city');
    json_response('success',mystery_state($city));
}
cl_rate('mystery',20,60);
$input=cl_body();
$city=(string)($input['city']??'');
$object=(string)($input['object']??'');
if (!in_array($city,cl_open_cities(),true)) cl_fail('Choose an active city');
$steps=mystery_steps($city);$step=null;
foreach ($steps as $item) if ($item['object']===$object) $step=$item;
if (!$step) cl_fail('That clue is not on this route',404);
$state=mystery_state($city);
if (($state['next']['object']??'')!==$object) cl_fail('That is not the next clue',409);
$here=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND city=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','is',[$uid,$city]);
$place=$here?explode('@',$here['place'])[0]:'';
if ($place!==$step['place']) cl_fail('Be at the clue to check it',403);
cl_run('INSERT INTO chinalife_mystery_finds(user_id,city,object_id,created_at) VALUES(?,?,?,NOW())','iss',[$uid,$city,$object]);
json_response('success',mystery_state($city)+['clue'=>$step['clue'],'verified'=>true,'object'=>$object],'Clue verified.');
