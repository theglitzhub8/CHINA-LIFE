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
    cl_run('DELETE FROM chinalife_economy_actions WHERE user_id=?','i',[$uid]);
    cl_run('DELETE FROM chinalife_balances WHERE user_id=?','i',[$uid]);
    cl_run('DELETE FROM chinalife_saves WHERE user_id=?','i',[$uid]);json_response('success',['deleted'=>true]);
}
cl_rate('save',15,10);$input=cl_body(1048576);$save=$input['save']??null;$revision=$input['revision']??0;
if (!is_int($revision)||$revision<0||!is_array($save)) cl_fail('Invalid save revision or payload');
$game=$save['game']??null;$character=$save['character']??null;
if (!is_array($game)||($game['created']??false)!==true||!is_array($character)) cl_fail('Invalid character save');
// The in-game name is always the player's Hafrik username.
$username=trim((string)($auth['user_name']??''));
if ($username===''||mb_strlen($username)>64) cl_fail('Your Hafrik account needs a username');
$game['name']=$username;$character['name']=$username;
cl_room($game);
if(!in_array($game['gender']??null,[null,'male','female'],true))cl_fail('Choose a valid gender');
foreach (['money','xp','day','hour'] as $key) if (!is_numeric($game[$key]??null)||!is_finite((float)$game[$key])) cl_fail('Invalid character save');
foreach (['energy','hunger','hygiene','bladder','fun','social'] as $key) if (!is_numeric($game['needs'][$key]??null)||$game['needs'][$key]<0||$game['needs'][$key]>100) cl_fail('Invalid character needs');
$stored=cl_one('SELECT game_state,TIMESTAMPDIFF(SECOND,updated_at,NOW()) elapsed FROM chinalife_saves WHERE user_id=?','i',[$uid]);
$storedGame=$stored?json_decode($stored['game_state'],true):[];
if(($game['transferTotal']??0)!==($storedGame['transferTotal']??0)) {http_response_code(409);json_response('error',cl_save_result($uid),'Refresh your money transfers before saving.');}
if(($game['sharedXP']??0)!==($storedGame['sharedXP']??0)){http_response_code(409);json_response('error',cl_save_result($uid),'Refresh shared activity rewards before saving.');}
// Coins, XP and the rank already paid for are server totals. A save may not raise or invent them.
if ($stored) {
    $bal=cl_balances_lock($uid);
    $game['money']=$bal['coins'];$game['xp']=$bal['xp'];
    $game['rankClaimed']=(int)($storedGame['rankClaimed']??0);
} else {
    $money=(int)$game['money'];$xp=(int)$game['xp'];
    if ($money<0||$money>5000) $money=3200;
    if ($xp!==0) $xp=0;
    $game['money']=$money;$game['xp']=$xp;$game['rankClaimed']=0;
}
$gameJson=json_encode($game,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);$characterJson=json_encode($character,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
if ($revision===0) $changed=cl_run('INSERT IGNORE INTO chinalife_saves(user_id,character_data,game_state,revision,created_at,updated_at) VALUES(?,?,?,1,NOW(),NOW())','iss',[$uid,$characterJson,$gameJson]);
else $changed=cl_run('UPDATE chinalife_saves SET character_data=?,game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=? AND revision=?','ssii',[$characterJson,$gameJson,$uid,$revision]);
if (!$changed) {http_response_code(409);json_response('error',cl_save_result($uid),'A newer account save exists. Load it before saving again.');}
if ($revision===0) {
    cl_run('DELETE FROM chinalife_economy_actions WHERE user_id=?','i',[$uid]);
    cl_run('INSERT INTO chinalife_balances(user_id,coins,xp,updated_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE coins=VALUES(coins),xp=VALUES(xp),updated_at=NOW()','iii',[$uid,(int)$game['money'],(int)$game['xp']]);
}
json_response('success',['saved'=>true,'revision'=>$revision+1,'user_id'=>(string)$uid,'money'=>(int)$game['money'],'xp'=>(int)$game['xp'],'rankClaimed'=>(int)($game['rankClaimed']??0)]);
