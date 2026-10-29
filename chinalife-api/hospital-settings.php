<?php
declare(strict_types=1);
// Hospital Phase 6 (docs/HOSPITAL-PLAN.md): settings the admin edits in appadmin's Hospital tab, saved in
// chinalife_settings 'hospital' as changes over these defaults. Read only when a hospital action runs (cl_hset), by
// economy.php (bill, check-up, pharmacy, insurance), hospital-staff.php and hospital-visits.php through hospital-lib.php.
// Whole-number settings: [default, lowest, highest, label]. The labels show in appadmin.
function cl_hospital_numbers(): array {return [
 'bill'=>[200,0,100000,'Wake-up hospital bill (¥)'],'recoverMinutes'=>[10,0,240,'No second bill within (minutes)'],
 'checkupQuestions'=>[5,3,10,'Check-up questions'],'checkupXp'=>[8,0,1000,'Check-up XP per right answer'],'checkupPerfect'=>[20,0,1000,'Check-up bonus XP for all right'],
 'painkiller'=>[60,0,10000,'Painkillers (¥)'],'ors'=>[40,0,10000,'Rehydration salts (¥)'],'vitamins'=>[80,0,10000,'Vitamins (¥)'],'stomach'=>[90,0,10000,'Stomach medicine (¥)'],
 'pharmacyMax'=>[5,1,50,'Medicine kept of each kind'],'vitaminHours'=>[24,1,168,'Vitamins work for (hours)'],
 'payDoctor'=>[120,0,100000,'Doctor pay per right treatment (¥)'],'payNurse'=>[80,0,100000,'Nurse pay per right treatment (¥)'],
 'staffXp'=>[20,0,1000,'Staff XP per right treatment'],'staffXpWrong'=>[5,0,1000,'Staff XP for a wrong treatment'],'patientXp'=>[10,0,1000,'Patient XP for a right treatment'],
 'paidPerDay'=>[20,0,500,'Paid patients a day per staff'],'shiftMinutes'=>[60,10,480,'Shift length (minutes)'],'waitMinutes'=>[10,1,120,'Patients wait up to (minutes)'],
 'againMinutes'=>[20,0,1440,'Minutes between patient visits'],'testPass'=>[7,1,8,'Health worker test: right answers to pass (of 8)'],
 'wardHours'=>[3,1,48,'On the ward for (hours)'],'flowers'=>[50,0,10000,'Flowers (¥)'],'fruit'=>[30,0,10000,'Fruit (¥)'],'visitXp'=>[10,0,1000,'Visitor XP'],
 'insFee'=>[200,0,100000,'Insurance fee (¥)'],'insDays'=>[30,1,365,'Insurance cover (days)'],'insBillCut'=>[80,0,100,'Insurance: hospital bill off (%)'],
 'insPharmacyCut'=>[25,0,100,'Insurance: pharmacy off (%)'],'insRenewDays'=>[7,0,365,'Insurance: renew in the last (days)'],
];}
function cl_hospital_defaults(): array {return array_map(fn($n)=>$n[0],cl_hospital_numbers())+['checkupOff'=>[],'checkupExtra'=>[]];}
function cl_hospital_settings(): array {
 static $s=null;if ($s!==null) return $s;
 try {$row=cl_one("SELECT value FROM chinalife_settings WHERE name='hospital'");} catch (Throwable $e) {$row=null;}
 $saved=$row?json_decode((string)$row['value'],true):null;
 return $s=cl_hospital_valid(is_array($saved)?$saved:[])??cl_hospital_defaults();
}
function cl_hset(string $k): int {return (int)cl_hospital_settings()[$k];}
// Checks changes and merges them over the defaults; null with the reason in $error when something is wrong.
// checkupOff: ids of built-in check-up questions turned off. checkupExtra: the admin's own questions
// {id, prompt, pinyin, answer, wrong:[3]} (ids start with "x-").
function cl_hospital_valid(array $in, ?string &$error=null): ?array {
 $out=cl_hospital_defaults();$fail=function(string $m)use(&$error){$error=$m;return null;};
 foreach (cl_hospital_numbers() as $k=>[,$lo,$hi,$label]) if (array_key_exists($k,$in)) {$v=$in[$k];if (!is_int($v)||$v<$lo||$v>$hi) return $fail($label.': use a whole number from '.$lo.' to '.number_format($hi));$out[$k]=$v;}
 $built=array_map(fn($q)=>$q[0],cl_checkup_builtin());
 if (array_key_exists('checkupOff',$in)) {$o=$in['checkupOff'];if (!is_array($o)) return $fail('Turned-off questions are a list');
  foreach ($o as $id) if (!is_string($id)||!in_array($id,$built,true)) return $fail('Unknown check-up question: '.(is_string($id)?$id:'?'));$out['checkupOff']=array_values(array_unique($o));}
 if (array_key_exists('checkupExtra',$in)) {$x=$in['checkupExtra'];if (!is_array($x)||count($x)>50) return $fail('Up to 50 extra check-up questions');$clean=[];
  foreach (array_values($x) as $i=>$q) {
   $t=fn($v,$max)=>is_string($v)?trim($v):null;$prompt=$t($q['prompt']??null,120);$answer=$t($q['answer']??null,80);$pinyin=$t($q['pinyin']??'',120)??'';
   $wrong=is_array($q['wrong']??null)?array_values(array_filter(array_map(fn($w)=>is_string($w)?trim($w):'',$q['wrong']),fn($w)=>$w!=='')):[];
   if (!$prompt||!$answer||mb_strlen($prompt)>120||mb_strlen($answer)>80||mb_strlen($pinyin)>120) return $fail('Question '.($i+1).': write the question (up to 120) and the right answer (up to 80)');
   if (count($wrong)!==3||count(array_unique([$answer,...$wrong]))!==4) return $fail('Question '.($i+1).': give three different wrong answers');
   foreach ($wrong as $w) if (mb_strlen($w)>80) return $fail('Question '.($i+1).': wrong answers are up to 80 characters');
   $clean[]=['id'=>'x-'.($i+1),'prompt'=>$prompt,'pinyin'=>$pinyin,'answer'=>$answer,'wrong'=>$wrong];}
  $out['checkupExtra']=$clean;}
 if (count($built)-count($out['checkupOff'])+count($out['checkupExtra'])<max($out['checkupQuestions'],4)) return $fail('Keep at least '.max($out['checkupQuestions'],4).' check-up questions switched on');
 return $out;
}
