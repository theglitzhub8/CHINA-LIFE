<?php
declare(strict_types=1);
// University Years food economy (docs/UNIVERSITY-YEARS-PLAN.md, appadmin switch uni_food, default OFF).
// Students get a ¥100 allowance once per Beijing day (about ¥3,000 a month), paid here on the server ledger.
// GET shows whether today's allowance is waiting; POST collects it (a second POST the same day pays nothing).
// game_state.allowance is written only here; save.php keeps the stored copy.
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('allowance',20,60);
if(!(cl_hafrik_features()['uni_food']??false)){http_response_code(403);json_response('error',['enabled'=>false],'The student allowance is switched off');exit;}
// The amount is set in appadmin's University tab (university-settings.php, default ¥100).
require_once __DIR__.'/university-settings.php';define('CL_ALLOWANCE',cl_uni_settings()['allowance']);
// Local test stacks (CHINALIFE_TEST_SOCKET) may pin the day, as in university.php.
$t=$_SERVER['HTTP_X_TEST_TODAY']??'';$today=getenv('CHINALIFE_TEST_SOCKET')&&preg_match('/^(\d{4}-\d{2}-\d{2})/',$t,$m)?$m[1]:cl_beijing_day();
$db->begin_transaction();
try {
 $row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$uid]);
 if(!$row){$db->rollback();cl_fail('Create your character first',409);}
 $g=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);
 if(($g['background']??'')!=='Student'){$db->rollback();json_response('success',['student'=>false]);}
 $a=is_array($g['allowance']??null)?$g['allowance']:['day'=>'','total'=>0];$waiting=($a['day']??'')!==$today;$paid=0;
 if($method==='POST'&&$waiting){$a=['day'=>$today,'total'=>(int)($a['total']??0)+CL_ALLOWANCE];$g['allowance']=$a;$paid=CL_ALLOWANCE;$waiting=false;
  cl_move_totals($uid,$g,CL_ALLOWANCE,0);
  cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$uid]);}
 $db->commit();json_response('success',['student'=>true,'today'=>$today,'amount'=>CL_ALLOWANCE,'waiting'=>$waiting,'paid'=>$paid,'total'=>(int)($a['total']??0)]);
}catch(Throwable $e){$db->rollback();throw $e;}
