<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST','PUT','DELETE']);
function cl_save_result(int $id): array {
    $row=cl_one('SELECT character_data,game_state,revision,created_at,updated_at FROM chinalife_saves WHERE user_id=?','i',[$id]);
    if (!$row) return ['exists'=>false,'save'=>null,'revision'=>0];
    $game=json_decode($row['game_state'],true);$character=json_decode($row['character_data'],true);
    if (!is_array($game)||!is_array($character)) cl_fail('Saved game data is corrupted',500);
    return ['exists'=>true,'save'=>['game'=>$game,'character'=>$character],'revision'=>(int)$row['revision'],'updated_at'=>$row['updated_at'],'created_at'=>$row['created_at']];
}
if ($method==='GET') json_response('success',cl_save_result($uid)+['account'=>['id'=>(string)$uid,'username'=>$auth['user_name']??'Hafrik user']]);
if ($method==='DELETE') {
    cl_run('DELETE FROM chinalife_saves WHERE user_id=?','i',[$uid]);json_response('success',['deleted'=>true]);
}
cl_rate('save',15,10);$input=cl_body(1048576);$save=$input['save']??null;$revision=$input['revision']??0;
if (!is_int($revision)||$revision<0||!is_array($save)) cl_fail('Invalid save revision or payload');
$game=$save['game']??null;$character=$save['character']??null;
if (!is_array($game)||($game['created']??false)!==true||!is_string($game['name']??null)||trim($game['name'])===''||mb_strlen($game['name'])>22||!is_array($character)) cl_fail('Invalid character save');
cl_room($game);
foreach (['money','xp','day','hour'] as $key) if (!is_numeric($game[$key]??null)||!is_finite((float)$game[$key])) cl_fail('Invalid character save');
foreach (['energy','hunger','hygiene','bladder','fun','social'] as $key) if (!is_numeric($game['needs'][$key]??null)||$game['needs'][$key]<0||$game['needs'][$key]>100) cl_fail('Invalid character needs');
$gameJson=json_encode($game,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);$characterJson=json_encode($character,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
if ($revision===0) $changed=cl_run('INSERT IGNORE INTO chinalife_saves(user_id,character_data,game_state,revision,created_at,updated_at) VALUES(?,?,?,1,NOW(),NOW())','iss',[$uid,$characterJson,$gameJson]);
else $changed=cl_run('UPDATE chinalife_saves SET character_data=?,game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=? AND revision=?','ssii',[$characterJson,$gameJson,$uid,$revision]);
if (!$changed) {http_response_code(409);json_response('error',cl_save_result($uid),'A newer account save exists. Load it before saving again.');}
json_response('success',['saved'=>true,'revision'=>$revision+1,'user_id'=>(string)$uid]);
