<?php
declare(strict_types=1);
// University Years micro-customization: the same lists as public/micro-style.js, for save.php and presence.php.
// Store items that take details, by their clothing style (the store catalogue lives on the client).
function cl_micro_items(): array {return ['shirt-oxford'=>'shirt','suit-tailored'=>'suit','grad-blazer'=>'suit','jacket-denim'=>'jacket','jacket-varsity'=>'jacket','jacket-leather'=>'jacket',
 'tee-basic'=>'tee','tee-graphic'=>'tee','tank-sport'=>'tank','hoodie'=>'hoodie','sweater-knit'=>'sweater','jeans'=>'jeans','chinos'=>'chinos','trousers-suit'=>'chinos','joggers'=>'joggers','backpack'=>'backpack','handbag'=>'handbag'];}
function cl_micro_lists(): array {return [
 'pal'=>['btn'=>['#d8c08a','#f4f4f2','#1f1f1f','#8a5a3c','#b8c4cc','#3fae8a'],'stitch'=>['#f4f4f2','#d8c08a','#c0392b','#2d6cdf','#1f1f1f','#ffd34d'],'col'=>['#2f4a6b','#7a1f2b','#1f3a2e','#e6d3b3','#1f1f1f','#c9a24a']],
 'enum'=>['collar'=>['classic','mandarin','spread','v'],'len'=>['full','crop'],'fit'=>['slim','regular','wide'],'graphic'=>['none','star','stripe','heart','panda']],
 'fields'=>['shirt'=>['btn','collar','stitch'],'suit'=>['btn','collar','stitch'],'jacket'=>['btn','collar','stitch'],'tee'=>['stitch'],'tank'=>['stitch'],'hoodie'=>['stitch'],'sweater'=>['stitch'],
  'jeans'=>['len','fit','stitch'],'chinos'=>['len','fit','stitch'],'joggers'=>['len','fit','stitch'],'backpack'=>['col','graphic'],'handbag'=>['col','graphic']],
 'rare'=>['btn:#3fae8a'=>['graduated','xp:1500'],'stitch:#ffd34d'=>['xp:3500','xp:3500'],'col:#c9a24a'=>['xp:7000','xp:7000'],'graphic:panda'=>['year:2','xp:600']]];}
// Only owned items, only the fields their style takes, only listed values. $allowed(field,value) can refuse rare ones.
function cl_micro_clean($details, array $owned, ?callable $allowed=null): array {
 $out=[];if(!is_array($details))return $out;$L=cl_micro_lists();$items=cl_micro_items();
 foreach(array_slice($details,0,60,true) as $id=>$d){if(!is_string($id)||!in_array($id,$owned,true)||!is_array($d)||!isset($items[$id]))continue;$c=[];
  foreach($L['fields'][$items[$id]] as $k){$v=$d[$k]??null;if(is_string($v)&&in_array($v,$L['pal'][$k]??$L['enum'][$k]??[],true)&&(!$allowed||$allowed($k,$v,$id)))$c[$k]=$v;}
  if($c)$out[$id]=$c;}
 return $out;
}
