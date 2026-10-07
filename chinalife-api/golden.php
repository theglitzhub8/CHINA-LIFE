<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);
// One golden envelope per ISO week, in a venue picked from the week number. The first finder wins.
const CL_GOLDEN_REWARD=50000;
$week=gmdate('o-\WW');$venues=['market','cafe','african','hotel','night','blood','skylight','campus','academy','gym','park','mall','plaza','business','station','church'];
$place=$venues[crc32('golden'.$week)%count($venues)];
$winner=fn()=>cl_one('SELECT g.user_id,u.user_name name FROM chinalife_golden g JOIN users u ON u.user_id=g.user_id WHERE g.week=?','s',[$week]);
if ($method==='GET') {$w=$winner();json_response('success',['week'=>$week,'place'=>$place,'reward'=>CL_GOLDEN_REWARD,'found_by'=>$w['name']??null,'mine'=>$w&&(int)$w['user_id']===$uid]);}
cl_rate('golden',10,60);
if (!cl_one('SELECT 1 FROM chinalife_presence WHERE user_id=? AND city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND)','iss',[$uid,'Shenyang',$place])) cl_fail('Look for the golden envelope in the right venue',409);
$db->begin_transaction();
if (!cl_run('INSERT IGNORE INTO chinalife_golden(week,user_id,created_at) VALUES(?,?,NOW())','si',[$week,$uid])) {$db->rollback();$w=$winner();cl_fail('Too late. '.($w['name']??'Someone').' found it first',409);}
cl_credit($uid,CL_GOLDEN_REWARD);$db->commit();
json_response('success',['found'=>true,'reward'=>CL_GOLDEN_REWARD]);
