<?php
declare(strict_types=1);
// University Years settings the admin edits in appadmin (University tab). Saved in chinalife_settings 'university'
// as changes over these defaults; a value the admin never touched follows the default. university.php, allowance.php,
// wardrobe-locks.php and uni-settings.php (the public part for the game) read them through cl_uni_settings().
require_once __DIR__.'/wardrobe-locks.php';
// The campus store's ingredients and their default prices (¥). public/kitchen.js has the same ids and prices.
function cl_uni_food_defaults(): array {return ['rice'=>3,'noodles'=>4,'potato'=>2,'plantain'=>4,'wrappers'=>5,'egg'=>2,'tofu'=>4,'beans'=>3,'chicken'=>9,'pork'=>9,'beef'=>12,
 'tomato'=>3,'greens'=>3,'onion'=>1,'chili'=>1,'garlic'=>1,'soy'=>2];}
// Whole-number settings: [default, lowest, highest, label]. The labels show in appadmin.
function cl_uni_numbers(): array {return [
 'allowance'=>[100,0,5000,'Daily allowance (¥)'],'mealPrice'=>[40,0,1000,'Ready meal price (¥)'],
 'classLength'=>[45,10,180,'Class length (minutes)'],'checkInEarly'=>[2,0,30,'Check-in opens early (minutes)'],
 'classXp'=>[10,0,1000,'XP per class'],'classCoins'=>[10,0,10000,'¥ per class'],
 'missPenalty'=>[10,0,100,'Attendance lost per missed class'],'attendGain'=>[5,0,100,'Attendance won back per class'],
 'goodLine'=>[90,0,100,'Good attendance from'],'truancyLine'=>[60,0,100,'Truancy risk below'],
 'examQuestions'=>[10,3,30,'Exam questions'],'passGood'=>[5,1,30,'Pass mark with good attendance'],'passNormal'=>[6,1,30,'Pass mark with normal attendance'],'passTruant'=>[7,1,30,'Pass mark at truancy risk'],
 'examXp'=>[60,0,10000,'XP for passing a year'],'examCoins'=>[120,0,100000,'¥ for passing a year'],
 'libraryPerDay'=>[2,0,10,'Library sessions a day'],'libraryPoints'=>[5,0,50,'Attendance points per library pass'],'librarySaturday'=>[10,0,50,'Attendance points on Saturday'],
 'labPerDay'=>[1,0,10,'Lab sessions a day'],'labPass'=>[3,1,4,'Lab points to pass (of 4)'],'labXp'=>[20,0,10000,'XP per passed lab'],
 'gradCoins'=>[500,0,1000000,'¥ for graduating'],'gradXp'=>[200,0,100000,'XP for graduating'],'gradMinHan'=>[20,5,200,'Characters in the self-introduction'],
]; }
function cl_uni_default_classes(): array {return [['id'=>'am','time'=>'09:00','subject'=>'Chinese class'],['id'=>'pm','time'=>'14:00','subject'=>'Lecture']];}
function cl_uni_defaults(): array {
 return array_map(fn($n)=>$n[0],cl_uni_numbers())+['classes'=>cl_uni_default_classes(),'food'=>cl_uni_food_defaults(),'wardrobe'=>cl_wardrobe_default_rules()];
}
function cl_uni_settings(): array {
 static $s=null;if($s!==null)return $s;
 $row=cl_one("SELECT value FROM chinalife_settings WHERE name='university'");$saved=$row?json_decode((string)$row['value'],true):null;
 $s=cl_uni_valid_settings(is_array($saved)?$saved:[])??cl_uni_defaults();return $s;
}
// A wardrobe rule: '' (no lock), 'year:2'..'year:4', 'graduated', 'home' or 'xp:N'.
function cl_uni_valid_rule($r): bool {return is_string($r)&&($r===''||in_array($r,['graduated','home','year:2','year:3','year:4'],true)||(bool)preg_match('/^xp:(0|[1-9]\d{0,6})$/',$r));}
// Checks changes and merges them over the defaults. Returns null with the reason in $error when something is wrong.
function cl_uni_valid_settings(array $in, ?string &$error=null): ?array {
 $out=cl_uni_defaults();$fail=function(string $m)use(&$error){$error=$m;return null;};
 foreach(cl_uni_numbers() as $k=>[$def,$lo,$hi,$label])if(array_key_exists($k,$in)){$v=$in[$k];if(!is_int($v)||$v<$lo||$v>$hi)return $fail($label.': use a whole number from '.$lo.' to '.number_format($hi));$out[$k]=$v;}
 if($out['passGood']>$out['passNormal']||$out['passNormal']>$out['passTruant'])return $fail('Pass marks: good attendance ≤ normal ≤ truancy risk');
 if($out['passTruant']>$out['examQuestions'])return $fail('Pass marks cannot be higher than the number of exam questions');
 if($out['truancyLine']>$out['goodLine'])return $fail('The truancy line must be at or below the good attendance line');
 if(array_key_exists('classes',$in)){$c=$in['classes'];if(!is_array($c)||!array_is_list($c)||count($c)<1||count($c)>4)return $fail('Use 1 to 4 classes a day');
  $list=[];$ids=[];foreach($c as $i=>$x){if(!is_array($x))return $fail('Each class needs a time and a subject');$time=$x['time']??null;$subject=trim((string)($x['subject']??''));
   if(!is_string($time)||!preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/',$time,$m)||(int)$m[1]<6||(int)$m[1]>21)return $fail('Class times are HH:MM between 06:00 and 21:59');
   if($subject===''||mb_strlen($subject)>40)return $fail('Each class needs a subject of up to 40 characters');
   // Check-ins are saved under the class id, so a class keeps its id while it is edited.
   $id=is_string($x['id']??null)&&preg_match('/^[a-z0-9]{1,8}$/',$x['id'])&&!in_array($x['id'],$ids,true)?$x['id']:'c'.substr(md5($time.$subject.$i),0,6);$ids[]=$id;
   $list[]=['id'=>$id,'time'=>$time,'subject'=>$subject];}
  usort($list,fn($a,$b)=>strcmp($a['time'],$b['time']));$out['classes']=$list;}
 $mins=array_map(fn($c)=>(int)substr($c['time'],0,2)*60+(int)substr($c['time'],3),$out['classes']);
 for($i=1;$i<count($mins);$i++)if($mins[$i]<$mins[$i-1]+$out['classLength']+$out['checkInEarly'])return $fail('Classes overlap: leave at least the class length between start times');
 if(end($mins)+$out['classLength']>24*60)return $fail('The last class must end before midnight');
 if(array_key_exists('food',$in)){if(!is_array($in['food']))return $fail('Food prices are a list');foreach($in['food'] as $k=>$v){if(!isset($out['food'][$k]))return $fail('Unknown ingredient: '.$k);if(!is_int($v)||$v<0||$v>500)return $fail('Ingredient prices are ¥0 to ¥500');$out['food'][$k]=$v;}}
 if(array_key_exists('wardrobe',$in)){$w=$in['wardrobe'];if(!is_array($w)||count($w)>60)return $fail('Wardrobe locks: up to 60 items');$rules=[];
  foreach($w as $id=>$r){if(!is_string($id)||!preg_match('/^[a-z0-9-]{1,40}$/',$id))return $fail('Wardrobe locks: use store item ids such as jacket-varsity');
   if(!is_array($r)||count($r)!==2||!cl_uni_valid_rule($r[0]??null)||!cl_uni_valid_rule($r[1]??null))return $fail('Wardrobe locks for '.$id.': choose a valid unlock for students and for everyone else');
   if($r[0]!==''||$r[1]!=='')$rules[$id]=[$r[0],$r[1]];}
  $out['wardrobe']=$rules;}
 return $out;
}
// What the game needs on every device (uni-settings.php): prices, the allowance and the wardrobe locks.
function cl_uni_public(): array {$s=cl_uni_settings();return ['allowance'=>$s['allowance'],'mealPrice'=>$s['mealPrice'],'food'=>$s['food'],'wardrobe'=>(object)$s['wardrobe']];}
