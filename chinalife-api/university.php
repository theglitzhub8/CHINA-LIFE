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
require_once __DIR__.'/university-lab.php';
cl_methods(['GET','POST']);cl_rate('university',30,60);
if(!(cl_hafrik_features()['uni_years']??false)){http_response_code(403);json_response('error',['enabled'=>false],'University years are switched off');exit;}
const CL_UNI_YEARS=4, CL_UNI_QUESTIONS=10, CL_UNI_PASS=6, CL_UNI_XP=60, CL_UNI_COINS=120;
// Timetable on class days (Mon-Fri, Beijing time): [id, start minute, subject]. Each class lasts 45 minutes; check-in
// opens 2 minutes early (when the phone buzzes). Attendance starts each year at 100: a missed class costs 10, an attended
// one gives 5 back (up to 100). The year's score sets its exam pass mark: 90+ is 5/10, 60+ is 6/10, below is 7/10.
const CL_UNI_CLASSES=[['am',540,'Chinese class'],['pm',840,'Lecture']], CL_UNI_CLASS_LEN=45, CL_UNI_EARLY=2, CL_UNI_MISS=10, CL_UNI_GAIN=5, CL_UNI_CLASS_XP=10, CL_UNI_CLASS_COINS=10, CL_UNI_TRUANCY=60;
// Library (opens in Year 2): up to 2 reading sessions a day. Read 3 words of the year's units, then answer 3 questions;
// 2 right wins back 5 attendance points for the current year (10 on Saturday, library day) and 5 knowledge per right answer.
// Laboratory (opens in Year 3): choose a major once, then one lab session a day: 2 terms, an experiment to put in order
// and a Chinese instruction to act on (4 points). 3 points pass: a lab credit and 20 XP; 5 knowledge per point.
const CL_UNI_LAB_DAY=1, CL_UNI_LAB_PASS=3, CL_UNI_LAB_XP=20;
const CL_UNI_LIB_DAY=2, CL_UNI_LIB_POINTS=5, CL_UNI_LIB_SAT=10, CL_UNI_LIB_WORDS=3, CL_UNI_LIB_PASS=2;
// Course units per year: Years 1-2 are HSK 1 (units 1-15), Years 3-4 HSK 2 (units 16-30), each year a little wider.
const CL_UNI_UNITS=[1=>[0,9],2=>[5,14],3=>[15,22],4=>[18,29]];
// Campus rooms and the year they open in. Rooms of later phases show as locked until then.
const CL_UNI_ROOMS=[['classrooms','Classrooms',1],['dorm','Dorm',1],['store','Campus store',1],['library','Library',2],['lab','Laboratory',3],['hall','Graduation hall',4]];
// Beijing date and minute of the day. Local test stacks (CHINALIFE_TEST_SOCKET) may pin them ("Y-m-d" or "Y-m-d H:i",
// noon when no time is given), so a Sunday exam or a 9:00 class can be tried at any time.
function cl_uni_now(): array {
 $t=$_SERVER['HTTP_X_TEST_TODAY']??'';if(getenv('CHINALIFE_TEST_SOCKET')&&preg_match('/^(\d{4}-\d{2}-\d{2})(?: (\d{2}):(\d{2}))?$/',$t,$m))return [$m[1],isset($m[2])?(int)$m[2]*60+(int)$m[3]:720];
 $d=new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai'));return [$d->format('Y-m-d'),(int)$d->format('G')*60+(int)$d->format('i')];
}
function cl_uni_hm(int $m): string {return sprintf('%02d:%02d',intdiv($m,60),$m%60);}
// Class status for a day and minute: attended, now (check-in open), missed (ended without check-in) or later.
function cl_uni_slot(array $u, string $day, string $today, int $minute, array $c): string {
 if(!empty($u['classes'][$day.'|'.$c[0]]))return 'attended';if($day<$today||$minute>=$c[1]+CL_UNI_CLASS_LEN)return 'missed';return $minute>=$c[1]-CL_UNI_EARLY?'now':'later';
}
// Attendance score of a year: its Monday to Friday classes since enrolment, up to now.
function cl_uni_score(array $u, int $year, string $today, int $minute): int {
 $s=100;$monday=cl_uni_date($u['start'])->modify('+'.(($year-1)*7).' days');
 for($i=0;$i<5;$i++){$d=$monday->modify("+$i days")->format('Y-m-d');if($d>$today)break;if($d<$u['enrolled'])continue;
  foreach(CL_UNI_CLASSES as $c){$st=cl_uni_slot($u,$d,$today,$minute,$c);if($st==='attended')$s=min(100,$s+CL_UNI_GAIN);elseif($st==='missed')$s=max(0,$s-CL_UNI_MISS);}}
 return min(100,$s+(int)($u['libBonus'][(string)$year]??0));
}
function cl_uni_pass(int $score): int {return $score>=90?5:($score>=CL_UNI_TRUANCY?6:7);}
function cl_uni_date(string $d): DateTimeImmutable {return new DateTimeImmutable($d,new DateTimeZone('Asia/Shanghai'));}
// Enrolling Monday to Wednesday starts Year 1 this week; Thursday to Sunday is orientation until next Monday.
function cl_uni_enrol(string $today): array {$d=cl_uni_date($today);$n=(int)$d->format('N');$monday=$d->modify('-'.($n-1).' days');
 return ['enrolled'=>$today,'classes'=>[],'start'=>($n<=3?$monday:$monday->modify('+7 days'))->format('Y-m-d'),'results'=>[],'attempts'=>[],'exam'=>null];}
function cl_uni_view(array $u, string $today, int $minute): array {
 $days=(int)cl_uni_date($u['start'])->diff(cl_uni_date($today))->format('%r%a');$orientation=$days<0;$week=$orientation?0:intdiv($days,7);
 $year=min(CL_UNI_YEARS,$week+1);$weekday=(int)cl_uni_date($today)->format('N');$examDay=!$orientation&&$weekday===7;
 $results=is_array($u['results']??null)?$u['results']:[];$attempts=is_array($u['attempts']??null)?$u['attempts']:[];
 $passed=fn($y)=>!empty($results[(string)$y]['passed']);$due=[];for($y=1;$y<=$year;$y++)if(!$passed($y))$due[]=$y;
 $open=$examDay?array_values(array_filter($due,fn($y)=>($attempts[(string)$y]??'')!==$today)):[];
 $finished=count(array_filter(range(1,CL_UNI_YEARS),$passed));$classDay=!$orientation&&$weekday<=5;
 $timetable=$classDay?array_map(fn($c)=>['id'=>$c[0],'time'=>cl_uni_hm($c[1]),'end'=>cl_uni_hm($c[1]+CL_UNI_CLASS_LEN),'subject'=>$c[2],'status'=>cl_uni_slot($u,$today,$today,$minute,$c)],CL_UNI_CLASSES):[];
 $score=$orientation?100:cl_uni_score($u,$year,$today,$minute);
 return ['enrolled'=>$u['enrolled'],'start'=>$u['start'],'today'=>$today,'orientation'=>$orientation,'year'=>$year,'week'=>$week+1,'weekday'=>$weekday,
  'dayName'=>$orientation?'Orientation':['','Class day','Class day','Class day','Class day','Class day','Library day','Exam day'][$weekday],
  'hsk'=>$year<=2?'HSK 1':'HSK 2','examDay'=>$examDay,'resits'=>array_values(array_filter($due,fn($y)=>$y<$year)),'exams'=>$open,
  'results'=>$results,'passedYears'=>$finished,'degreeDone'=>$finished===CL_UNI_YEARS,
  'rooms'=>array_map(fn($r)=>['id'=>$r[0],'name'=>$r[1],'year'=>$r[2],'open'=>$r[2]===1||($year>=$r[2]&&!$orientation)],CL_UNI_ROOMS),
  'minute'=>$minute,'classDay'=>$classDay,'timetable'=>$timetable,'classTimes'=>array_map(fn($c)=>['id'=>$c[0],'time'=>cl_uni_hm($c[1]),'subject'=>$c[2]],CL_UNI_CLASSES),
  'attendance'=>$score,'truancy'=>$score<CL_UNI_TRUANCY,'classReward'=>['xp'=>CL_UNI_CLASS_XP,'coins'=>CL_UNI_CLASS_COINS],
  'library'=>['open'=>$year>=2&&!$orientation,'today'=>(int)($u['library'][$today]??0),'perDay'=>CL_UNI_LIB_DAY,'points'=>$weekday===6?CL_UNI_LIB_SAT:CL_UNI_LIB_POINTS],'knowledge'=>(int)($u['knowledge']??0),
  'lab'=>['open'=>$year>=3&&!$orientation,'major'=>$u['major']??null,'majorName'=>isset($u['major'])?cl_uni_lab()[$u['major']]['name']:null,'today'=>(int)($u['labDays'][$today]??0),'perDay'=>CL_UNI_LAB_DAY,'credits'=>(int)($u['labCredits']??0),'majors'=>array_map(fn($k,$m)=>['id'=>$k,'name'=>$m['name'],'icon'=>$m['icon']],array_keys(cl_uni_lab()),cl_uni_lab())],
  'passMark'=>cl_uni_pass($score),'passMarks'=>(object)array_combine(array_map('strval',$open),array_map(fn($y)=>cl_uni_pass(cl_uni_score($u,$y,$today,$minute)),$open)),'questions'=>CL_UNI_QUESTIONS,'reward'=>['xp'=>CL_UNI_XP,'coins'=>CL_UNI_COINS]];
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
[$today,$minute]=cl_uni_now();$input=$method==='POST'?cl_body(4000):[];
$db->begin_transaction();
try {
 $row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$uid]);
 if(!$row){$db->rollback();cl_fail('Create your character first',409);}
 $g=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);
 if(($g['background']??'')!=='Student'){$db->rollback();json_response('success',['student'=>false]);}
 $u=is_array($g['university']??null)&&isset($g['university']['start'])?$g['university']:cl_uni_enrol($today);$changed=!isset($g['university']['start']);
 $v=cl_uni_view($u,$today,$minute);$out=[];$coins=0;$xp=0;
 if($method==='POST'){
  $action=(string)($input['action']??'');
  if($action==='start_exam'){
   $year=(int)($input['year']??0);if(!in_array($year,$v['exams'],true)){$db->rollback();cl_fail($v['examDay']?'That exam is not open for you today':'Exams are on Sunday',409);}
   $pass=cl_uni_pass(cl_uni_score($u,$year,$today,$minute));[$qs,$answers]=cl_uni_exam($year);$u['exam']=['year'=>$year,'day'=>$today,'answers'=>$answers,'pass'=>$pass];$u['attempts'][(string)$year]=$today;$changed=true;$out=['exam'=>['year'=>$year,'passMark'=>$pass,'questions'=>$qs]];
  } elseif($action==='submit_exam'){
   $e=$u['exam']??null;if(!is_array($e)||($e['day']??'')!==$today){$db->rollback();cl_fail('Start the exam first',409);}
   $given=is_array($input['answers']??null)?array_values($input['answers']):[];$right=0;foreach($e['answers'] as $i=>$a)if(isset($given[$i])&&$given[$i]===$a)$right++;
   $passed=$right>=(int)($e['pass']??CL_UNI_PASS);$y=(string)$e['year'];$before=$u['results'][$y]??null;
   if($passed||!$before||($before['score']??0)<$right)$u['results'][$y]=['passed'=>$passed,'score'=>$right,'total'=>count($e['answers']),'on'=>$today];
   if($passed){$coins=CL_UNI_COINS;$xp=CL_UNI_XP;}
   $u['exam']=null;$changed=true;$out=['result'=>['year'=>(int)$y,'passed'=>$passed,'score'=>$right,'total'=>count($e['answers']),'answers'=>$e['answers'],'coins'=>$coins,'xp'=>$xp]];
  } elseif($action==='attend'){
   // Check in to the class that is on now, from the classroom (live presence at a campus, as for daily attendance).
   $slot=null;foreach($v['timetable'] as $c)if($c['status']==='now')$slot=$c;
   if(!$slot){$db->rollback();cl_fail(array_filter($v['timetable'],fn($c)=>$c['status']==='attended'&&$c['end']>cl_uni_hm($minute))?'You’re already checked in to this class':'No class is on right now',409);}
   $p=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 90 SECOND)','i',[$uid]);$place=(string)($p['place']??'');
   if(!$p||!(in_array($place,['campus','ef','university','liaoning','dongbei','academy'],true)||str_contains($place,'univ')||str_contains($place,'campus'))){$db->rollback();cl_fail('Go to your campus classroom to check in',409);}
   $u['classes']=is_array($u['classes']??null)?$u['classes']:[];$u['classes'][$today.'|'.$slot['id']]=true;$u['classes']=array_slice($u['classes'],-60,null,true);
   $coins=CL_UNI_CLASS_COINS;$xp=CL_UNI_CLASS_XP;$changed=true;$out=['attended'=>['id'=>$slot['id'],'subject'=>$slot['subject'],'xp'=>$xp,'coins'=>$coins]];
  } elseif($action==='start_library'){
   // A quiet reading session in the campus library: 3 words to read, then 3 questions on them (answers stay here).
   if(!$v['library']['open']){$db->rollback();cl_fail('The library opens in Year 2',409);}
   if($v['library']['today']>=CL_UNI_LIB_DAY){$db->rollback();cl_fail('You have read enough today. The library opens again tomorrow.',409);}
   $p=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 90 SECOND)','i',[$uid]);$place=(string)($p['place']??'');
   if(!$p||!(in_array($place,['campus','ef','university','liaoning','dongbei','academy'],true)||str_contains($place,'univ')||str_contains($place,'campus'))){$db->rollback();cl_fail('The library is on your campus',409);}
   [$from,$to]=CL_UNI_UNITS[$year=$v['year']];$pool=array_values(array_filter(cl_uni_words(),fn($w)=>$w[3]>=$from&&$w[3]<=$to));shuffle($pool);$read=array_slice($pool,0,CL_UNI_LIB_WORDS);
   $qs=[];$answers=[];foreach($read as $w){$others=array_values(array_unique(array_filter(array_column($pool,2),fn($x)=>$x!==$w[2])));shuffle($others);$o=array_merge([$w[2]],array_slice($others,0,3));shuffle($o);
    $qs[]=['prompt'=>'What does '.$w[0].' ('.$w[1].') mean?','options'=>$o];$answers[]=$w[2];}
   $u['library']=is_array($u['library']??null)?array_slice($u['library'],-14,null,true):[];$u['library'][$today]=(int)($u['library'][$today]??0)+1;
   $u['lib']=['day'=>$today,'year'=>$year,'answers'=>$answers,'points'=>$v['library']['points']];$changed=true;
   $out=['session'=>['words'=>array_map(fn($w)=>['han'=>$w[0],'pinyin'=>$w[1],'en'=>$w[2]],$read),'questions'=>$qs,'points'=>$v['library']['points']]];
  } elseif($action==='submit_library'){
   $l=$u['lib']??null;if(!is_array($l)||($l['day']??'')!==$today){$db->rollback();cl_fail('Start a library session first',409);}
   $given=is_array($input['answers']??null)?array_values($input['answers']):[];$right=0;foreach($l['answers'] as $i=>$a)if(isset($given[$i])&&$given[$i]===$a)$right++;
   $passed=$right>=CL_UNI_LIB_PASS;$y=(string)$l['year'];$points=$passed?(int)$l['points']:0;
   if($points){$u['libBonus']=is_array($u['libBonus']??null)?$u['libBonus']:[];$u['libBonus'][$y]=(int)($u['libBonus'][$y]??0)+$points;}
   $u['knowledge']=(int)($u['knowledge']??0)+$right*5;$u['lib']=null;$changed=true;
   $out=['libraryResult'=>['right'=>$right,'total'=>count($l['answers']),'passed'=>$passed,'points'=>$points,'knowledge'=>$right*5,'answers'=>$l['answers']]];
  } elseif($action==='choose_major'){
   $major=(string)($input['major']??'');if(!$v['lab']['open']){$db->rollback();cl_fail('You choose your major in Year 3',409);}
   if(isset($u['major'])){$db->rollback();cl_fail('You already chose your major',409);}if(!isset(cl_uni_lab()[$major])){$db->rollback();cl_fail('Choose Computer Science or Physics');}
   $u['major']=$major;$changed=true;$out=['major'=>['id'=>$major,'name'=>cl_uni_lab()[$major]['name']]];
  } elseif($action==='start_lab'){
   if(!$v['lab']['open']){$db->rollback();cl_fail('The laboratory opens in Year 3',409);}if(!isset($u['major'])){$db->rollback();cl_fail('Choose your major first',409);}
   if($v['lab']['today']>=CL_UNI_LAB_DAY){$db->rollback();cl_fail('One lab session a day. Come back tomorrow.',409);}
   $p=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 90 SECOND)','i',[$uid]);$place=(string)($p['place']??'');
   if(!$p||!(in_array($place,['campus','ef','university','liaoning','dongbei','academy'],true)||str_contains($place,'univ')||str_contains($place,'campus'))){$db->rollback();cl_fail('The laboratory is on your campus',409);}
   $m=cl_uni_lab()[$u['major']];$terms=$m['terms'];shuffle($terms);$qs=[];$termAnswers=[];
   foreach(array_slice($terms,0,2) as $t){$others=array_values(array_filter(array_column($m['terms'],2),fn($x)=>$x!==$t[2]));shuffle($others);$o=array_merge([$t[2]],array_slice($others,0,3));shuffle($o);$qs[]=['prompt'=>'What does '.$t[0].' ('.$t[1].') mean?','options'=>$o];$termAnswers[]=$t[2];}
   $e=$m['experiments'][random_int(0,count($m['experiments'])-1)];$steps=[];foreach($e[1] as $i=>$st)$steps[]=['id'=>'s'.$i,'han'=>$st[0],'en'=>$st[1]];$order=array_column($steps,'id');shuffle($steps);
   $in=$m['instructions'][random_int(0,count($m['instructions'])-1)];$io=array_merge([$in[2]],$in[3]);shuffle($io);
   $u['labDays']=is_array($u['labDays']??null)?array_slice($u['labDays'],-14,null,true):[];$u['labDays'][$today]=(int)($u['labDays'][$today]??0)+1;
   $u['labRun']=['day'=>$today,'terms'=>$termAnswers,'order'=>$order,'instruction'=>$in[2]];$changed=true;
   $out=['labSession'=>['major'=>$m['name'],'terms'=>$qs,'experiment'=>['title'=>$e[0],'steps'=>$steps],'instruction'=>['han'=>$in[0],'pinyin'=>$in[1],'options'=>$io]]];
  } elseif($action==='submit_lab'){
   $l=$u['labRun']??null;if(!is_array($l)||($l['day']??'')!==$today){$db->rollback();cl_fail('Start a lab session first',409);}
   $terms=is_array($input['terms']??null)?array_values($input['terms']):[];$right=0;foreach($l['terms'] as $i=>$a)if(($terms[$i]??null)===$a)$right++;
   $orderOk=is_array($input['order']??null)&&array_values($input['order'])===$l['order'];$instrOk=($input['instruction']??null)===$l['instruction'];$right+=($orderOk?1:0)+($instrOk?1:0);
   $passed=$right>=CL_UNI_LAB_PASS;$u['knowledge']=(int)($u['knowledge']??0)+$right*5;if($passed){$u['labCredits']=(int)($u['labCredits']??0)+1;$xp=CL_UNI_LAB_XP;}
   $u['labRun']=null;$changed=true;$out=['labResult'=>['right'=>$right,'total'=>4,'passed'=>$passed,'xp'=>$xp,'coins'=>0,'knowledge'=>$right*5,'order'=>$orderOk,'instruction'=>$instrOk,'answers'=>['terms'=>$l['terms'],'order'=>$l['order'],'instruction'=>$l['instruction']]]];
  } else {$db->rollback();cl_fail('Unknown action');}
  $v=cl_uni_view($u,$today,$minute);
 }
 // Enrolment and exam papers do not move the save revision (save.php keeps game_state.university), so an open game
 // can keep saving. Only a pass, which moves coins and XP, does; the game reloads its save after every POST.
 if($changed){$g['university']=$u;if($coins||$xp)cl_move_totals($uid,$g,$coins,$xp);
  cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+?,updated_at=NOW() WHERE user_id=?','sii',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$coins||$xp?1:0,$uid]);}
 $db->commit();json_response('success',['student'=>true]+$v+$out);
}catch(Throwable $e){$db->rollback();throw $e;}
