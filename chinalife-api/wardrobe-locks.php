<?php
declare(strict_types=1);
// University Years wardrobe (appadmin switch wardrobe_locks): the same rules as public/wardrobe-locks.js.
// [rule for students while university years are on, rule for everyone else]; 'year:N', 'graduated', 'home', 'xp:N'.
function cl_wardrobe_rules(): array {return ['jacket-varsity'=>['year:2','xp:200'],'jacket-leather'=>['home','home'],'leather-white'=>['home','home'],
 'suit-tailored'=>['graduated','xp:1500'],'trousers-suit'=>['graduated','xp:1500'],'qipao-silk'=>['xp:600','xp:600'],'loafers'=>['xp:600','xp:600'],
 'chain'=>['xp:1500','xp:1500'],'gown-evening'=>['xp:3500','xp:3500'],'designer-sneakers'=>['xp:3500','xp:3500'],'handbag'=>['xp:7000','xp:7000'],'luxwatch'=>['xp:12000','xp:12000']];}
// [milestone check for a rule, whether the student rules apply] for a save; also used by micro-style.php rare options.
function cl_wardrobe_met(array $game, array $stored, array $features): array {
 $student=($game['background']??'')==='Student'&&!empty($features['uni_years']);$u=is_array($stored['university']??null)?$stored['university']:[];
 $year=1;if(!empty($u['start'])){$days=(int)(new DateTimeImmutable($u['start'],new DateTimeZone('Asia/Shanghai')))->diff(new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai')))->format('%r%a');$year=max(1,min(4,intdiv(max(0,$days),7)+1));}
 $met=function(string $r)use($game,$u,$year):bool{if($r==='graduated')return !empty($u['graduated']);if($r==='home')return !empty($game['properties'])||!empty($game['ownedHomes']);
  if(str_starts_with($r,'year:'))return $year>=(int)substr($r,5);return (int)($game['xp']??0)>=(int)substr($r,3);};
 return [$met,$student];
}
// A device save may not add a locked item it has not unlocked, nor wear one it does not own. Items already in the
// stored wardrobe stay (bought before the locks, or unlocked earlier).
function cl_wardrobe_enforce(array $game, array $stored, array $features): array {
 $w=$game['wardrobe']??null;if(!is_array($w)||!is_array($w['owned']??null))return $game;
 [$met,$student]=cl_wardrobe_met($game,$stored,$features);
 $had=is_array($stored['wardrobe']['owned']??null)?$stored['wardrobe']['owned']:[];$rules=cl_wardrobe_rules();
 $w['owned']=array_values(array_filter($w['owned'],fn($id)=>!is_string($id)||!isset($rules[$id])||in_array($id,$had,true)||$met($rules[$id][$student?0:1])));
 $wearing=is_array($w['wearing']??null)?$w['wearing']:[];foreach(['top','bottom','shoes'] as $slot)if(isset($wearing[$slot])&&isset($rules[$wearing[$slot]])&&!in_array($wearing[$slot],$w['owned'],true))unset($wearing[$slot]);
 if(is_array($wearing['acc']??null))$wearing['acc']=array_values(array_filter($wearing['acc'],fn($id)=>!isset($rules[$id])||in_array($id,$w['owned'],true)));
 $w['wearing']=$wearing;$game['wardrobe']=$w;return $game;
}
