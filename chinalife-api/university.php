<?php
declare(strict_types=1);
// University Years (docs/UNIVERSITY-YEARS-PLAN.md, appadmin switch uni_years, default OFF).
// 1 real week = 1 academic year on Beijing time: Monday to Friday classes, Saturday library / catch-up, Sunday exam.
// A degree is 4 years. The year comes from the enrolment date, never from the device. Missing an exam never fails a
// student out: the year moves on with time and the missed or failed exam becomes a resit on a later Sunday.
// Exams are made and graded here from the Chinese course words (university-words.php); answers never leave the server.
// Everything is kept in game_state.university, written only by this endpoint (save.php keeps the stored copy).
require_once __DIR__.'/common.php';
require_once __DIR__.'/university-words.php';
cl_methods(['GET','POST']);cl_rate('university',30,60);
if(!(cl_hafrik_features()['uni_years']??false)){http_response_code(403);json_response('error',['enabled'=>false],'University years are switched off');exit;}
const CL_UNI_YEARS=4, CL_UNI_QUESTIONS=10, CL_UNI_PASS=6, CL_UNI_XP=60, CL_UNI_COINS=120;
// Course units per year: Years 1-2 are HSK 1 (units 1-15), Years 3-4 HSK 2 (units 16-30), each year a little wider.
const CL_UNI_UNITS=[1=>[0,9],2=>[5,14],3=>[15,22],4=>[18,29]];
// Campus rooms and the year they open in. Rooms of later phases show as locked until then.
const CL_UNI_ROOMS=[['classrooms','Classrooms',1],['dorm','Dorm',1],['store','Campus store',1],['library','Library',2],['lab','Laboratory',3],['hall','Graduation hall',4]];
function cl_uni_today(): string {
 // Local test stacks (CHINALIFE_TEST_SOCKET) may pin the date, so a Sunday exam can be tried on any day.
 $t=$_SERVER['HTTP_X_TEST_TODAY']??'';if(getenv('CHINALIFE_TEST_SOCKET')&&preg_match('/^\d{4}-\d{2}-\d{2}$/',$t))return $t;return cl_beijing_day();
}
function cl_uni_date(string $d): DateTimeImmutable {return new DateTimeImmutable($d,new DateTimeZone('Asia/Shanghai'));}
// Enrolling Monday to Wednesday starts Year 1 this week; Thursday to Sunday is orientation until next Monday.
function cl_uni_enrol(string $today): array {$d=cl_uni_date($today);$n=(int)$d->format('N');$monday=$d->modify('-'.($n-1).' days');
 return ['enrolled'=>$today,'start'=>($n<=3?$monday:$monday->modify('+7 days'))->format('Y-m-d'),'results'=>[],'attempts'=>[],'exam'=>null];}
function cl_uni_view(array $u, string $today): array {
 $days=(int)cl_uni_date($u['start'])->diff(cl_uni_date($today))->format('%r%a');$orientation=$days<0;$week=$orientation?0:intdiv($days,7);
 $year=min(CL_UNI_YEARS,$week+1);$weekday=(int)cl_uni_date($today)->format('N');$examDay=!$orientation&&$weekday===7;
 $results=is_array($u['results']??null)?$u['results']:[];$attempts=is_array($u['attempts']??null)?$u['attempts']:[];
 $passed=fn($y)=>!empty($results[(string)$y]['passed']);$due=[];for($y=1;$y<=$year;$y++)if(!$passed($y))$due[]=$y;
 $open=$examDay?array_values(array_filter($due,fn($y)=>($attempts[(string)$y]??'')!==$today)):[];
 $finished=count(array_filter(range(1,CL_UNI_YEARS),$passed));
 return ['enrolled'=>$u['enrolled'],'start'=>$u['start'],'today'=>$today,'orientation'=>$orientation,'year'=>$year,'week'=>$week+1,'weekday'=>$weekday,
  'dayName'=>$orientation?'Orientation':['','Class day','Class day','Class day','Class day','Class day','Library day','Exam day'][$weekday],
  'hsk'=>$year<=2?'HSK 1':'HSK 2','examDay'=>$examDay,'resits'=>array_values(array_filter($due,fn($y)=>$y<$year)),'exams'=>$open,
  'results'=>$results,'passedYears'=>$finished,'degreeDone'=>$finished===CL_UNI_YEARS,
  'rooms'=>array_map(fn($r)=>['id'=>$r[0],'name'=>$r[1],'year'=>$r[2],'open'=>$r[2]===1||($year>=$r[2]&&!$orientation)],CL_UNI_ROOMS),
  'passMark'=>CL_UNI_PASS,'questions'=>CL_UNI_QUESTIONS,'reward'=>['xp'=>CL_UNI_XP,'coins'=>CL_UNI_COINS]];
}
// Ten questions from the year's units: meaning, writing or pinyin, four choices each. Answers stay on the server.
function cl_uni_exam(int $year): array {
 [$from,$to]=CL_UNI_UNITS[$year];$pool=array_values(array_filter(cl_uni_words(),fn($w)=>$w[3]>=$from&&$w[3]<=$to));shuffle($pool);
 $qs=[];$answers=[];foreach(array_slice($pool,0,CL_UNI_QUESTIONS) as $w){$type=['meaning','reverse','pinyin'][random_int(0,2)];$f=['meaning'=>2,'reverse'=>0,'pinyin'=>1][$type];
  $others=array_values(array_unique(array_filter(array_column($pool,$f),fn($v)=>$v!==$w[$f])));shuffle($others);$options=array_merge([$w[$f]],array_slice($others,0,3));shuffle($options);
  $prompt=['meaning'=>'What does '.$w[0].' ('.$w[1].') mean?','reverse'=>'How do you write “'.$w[2].'” in Chinese?','pinyin'=>'How do you say '.$w[0].'?'][$type];
  $qs[]=['type'=>$type,'prompt'=>$prompt,'options'=>$options];$answers[]=$w[$f];}
 return [$qs,$answers];
}
$today=cl_uni_today();$input=$method==='POST'?cl_body(4000):[];
$db->begin_transaction();
try {
 $row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$uid]);
 if(!$row){$db->rollback();cl_fail('Create your character first',409);}
 $g=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);
 if(($g['background']??'')!=='Student'){$db->rollback();json_response('success',['student'=>false]);}
 $u=is_array($g['university']??null)&&isset($g['university']['start'])?$g['university']:cl_uni_enrol($today);$changed=!isset($g['university']['start']);
 $v=cl_uni_view($u,$today);$out=[];$coins=0;$xp=0;
 if($method==='POST'){
  $action=(string)($input['action']??'');
  if($action==='start_exam'){
   $year=(int)($input['year']??0);if(!in_array($year,$v['exams'],true)){$db->rollback();cl_fail($v['examDay']?'That exam is not open for you today':'Exams are on Sunday',409);}
   [$qs,$answers]=cl_uni_exam($year);$u['exam']=['year'=>$year,'day'=>$today,'answers'=>$answers];$u['attempts'][(string)$year]=$today;$changed=true;$out=['exam'=>['year'=>$year,'questions'=>$qs]];
  } elseif($action==='submit_exam'){
   $e=$u['exam']??null;if(!is_array($e)||($e['day']??'')!==$today){$db->rollback();cl_fail('Start the exam first',409);}
   $given=is_array($input['answers']??null)?array_values($input['answers']):[];$right=0;foreach($e['answers'] as $i=>$a)if(isset($given[$i])&&$given[$i]===$a)$right++;
   $passed=$right>=CL_UNI_PASS;$y=(string)$e['year'];$before=$u['results'][$y]??null;
   if($passed||!$before||($before['score']??0)<$right)$u['results'][$y]=['passed'=>$passed,'score'=>$right,'total'=>count($e['answers']),'on'=>$today];
   if($passed){$coins=CL_UNI_COINS;$xp=CL_UNI_XP;}
   $u['exam']=null;$changed=true;$out=['result'=>['year'=>(int)$y,'passed'=>$passed,'score'=>$right,'total'=>count($e['answers']),'answers'=>$e['answers'],'coins'=>$coins,'xp'=>$xp]];
  } else {$db->rollback();cl_fail('Unknown action');}
  $v=cl_uni_view($u,$today);
 }
 // Enrolment and exam papers do not move the save revision (save.php keeps game_state.university), so an open game
 // can keep saving. Only a pass, which moves coins and XP, does; the game reloads its save after every POST.
 if($changed){$g['university']=$u;if($coins||$xp)cl_move_totals($uid,$g,$coins,$xp);
  cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+?,updated_at=NOW() WHERE user_id=?','sii',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$coins||$xp?1:0,$uid]);}
 $db->commit();json_response('success',['student'=>true]+$v+$out);
}catch(Throwable $e){$db->rollback();throw $e;}
