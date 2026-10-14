<?php
declare(strict_types=1);
// R5 (not deployed): daily class attendance for Student characters.
// One school day = one Beijing calendar day. Attend at a campus (checked against live presence) for +15 XP and ¥30, once a day.
// Soft rules: the first 2 days after enrolment never count as misses. 2 misses in the last 7 days = visa warning.
// 3+ misses = visa at risk: 50 XP is held back once, and returned after 3 school days in a row.
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('attendance',20,60);
const CL_ATT_COINS=30, CL_ATT_XP=15, CL_ATT_HOLD=50, CL_ATT_GRACE=2, CL_ATT_RISK=3, CL_ATT_RECOVER=3;
function cl_att_campus(string $place): bool {return in_array($place,['campus','ef','university','liaoning','dongbei','academy'],true)||str_contains($place,'univ')||str_contains($place,'campus');}
function cl_att_view(array $a, string $today): array {
  $tz=new DateTimeZone('Asia/Shanghai');$t=new DateTimeImmutable($today,$tz);$since=(string)($a['since']??$today);
  $countFrom=(new DateTimeImmutable($since,$tz))->modify('+'.CL_ATT_GRACE.' days')->format('Y-m-d');$days=$a['days']??[];$missed=0;
  for($i=1;$i<=7;$i++){$d=$t->modify("-$i day")->format('Y-m-d');if($d>=$countFrom&&!in_array($d,$days,true))$missed++;}
  $run=0;for($i=0;$i<30;$i++){$d=$t->modify("-$i day")->format('Y-m-d');if(in_array($d,$days,true))$run++;elseif($i>0)break;}
  $status=!empty($a['risk'])?'risk':($missed>=2?'warning':'ok');
  return ['today'=>in_array($today,$days,true),'missed'=>$missed,'streak'=>$run,'status'=>$status,'held'=>(int)($a['held']??0),'recoverLeft'=>!empty($a['risk'])?max(0,CL_ATT_RECOVER-$run):0,'reward'=>['coins'=>CL_ATT_COINS,'xp'=>CL_ATT_XP]];
}
$today=cl_beijing_day();
$db->begin_transaction();
try {
 $row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$uid]);
 if(!$row){$db->rollback();cl_fail('Create your character first',409);}
 $g=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);
 if(($g['background']??'')!=='Student'){$db->rollback();json_response('success',['student'=>false]);}
 $a=is_array($g['attendance']??null)?$g['attendance']:[];$a['since']=$a['since']??$today;$a['days']=array_values(array_filter((array)($a['days']??[]),'is_string'));
 $changed=false;$coins=0;$xp=0;$event=null;
 if($method==='POST'){
  if(in_array($today,$a['days'],true)){$db->rollback();cl_fail('You’re already marked present today',409);}
  $p=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 90 SECOND)','i',[$uid]);
  if(!$p||!cl_att_campus((string)$p['place'])){$db->rollback();cl_fail('Go to your campus to mark attendance',409);}
  $a['days'][]=$today;$a['days']=array_slice(array_values(array_unique($a['days'])),-21);$coins=CL_ATT_COINS;$xp=CL_ATT_XP;$changed=true;$event='present';
 }
 $v=cl_att_view($a,$today);
 if(empty($a['risk'])&&$v['missed']>=CL_ATT_RISK){$a['risk']=true;$a['held']=CL_ATT_HOLD;$xp-=CL_ATT_HOLD;$changed=true;$event='risk';}
 elseif(!empty($a['risk'])&&$v['streak']>=CL_ATT_RECOVER){$xp+=(int)($a['held']??0);$a['risk']=false;$a['held']=0;$changed=true;$event='recovered';}
 if($changed){$g['attendance']=$a;if($coins||$xp)cl_move_totals($uid,$g,$coins,$xp);
  cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$uid]);}
 $db->commit();json_response('success',['student'=>true,'event'=>$event,'coins'=>$coins,'xp'=>$xp]+cl_att_view($a,$today));
}catch(Throwable $e){$db->rollback();throw $e;}
