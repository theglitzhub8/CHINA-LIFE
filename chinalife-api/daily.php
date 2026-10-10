<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['POST']);cl_body();cl_rate('daily',10,60);
$clock=new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai'));
$today=$clock->format('Y-m-d');$yesterday=$clock->modify('-1 day')->format('Y-m-d');
$db->begin_transaction();
try {
 $row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$uid]);
 if(!$row){$db->rollback();cl_fail('Create your character first',409);}
 $g=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);
 if((string)($g['lastVisit']??'')>=$today){$db->rollback();cl_fail('Today’s Beijing daily reward is already claimed',409);}
 $streak=($g['lastVisit']??'')===$yesterday?min(7,max(0,(int)($g['streak']??0))+1):1;
 $money=50*$streak;$xp=20*$streak;
 $g['money']=(int)($g['money']??0)+$money;$g['xp']=(int)($g['xp']??0)+$xp;
 $g['transferTotal']=(int)($g['transferTotal']??0)+$money;$g['sharedXP']=(int)($g['sharedXP']??0)+$xp;
 $g['lastVisit']=$today;$g['streak']=$streak;
 cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$uid]);
 $db->commit();json_response('success',['date'=>$today,'streak'=>$streak,'money'=>$money,'xp'=>$xp]);
}catch(Throwable $e){$db->rollback();throw $e;}
