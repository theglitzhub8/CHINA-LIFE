<?php
declare(strict_types=1);
function cl_life_award(int $player,string $key,int $money,int $xp): bool {
 $row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$player]);if(!$row)cl_fail('Create your character first',409);
 if(!cl_run('INSERT IGNORE INTO chinalife_life_claims(user_id,claim_key,created_at) VALUES(?,?,NOW())','is',[$player,$key]))return false;
 $g=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);if((int)$g['money']+$money>1000000000)cl_fail('Spend some game funds before claiming this reward',409);$g['money']=(int)$g['money']+$money;$g['xp']=(int)$g['xp']+$xp;$g['transferTotal']=(int)($g['transferTotal']??0)+$money;$g['sharedXP']=(int)($g['sharedXP']??0)+$xp;
 cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$player]);return true;
}
function cl_life_steps(int $player): array {
 $save=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=?','i',[$player]);$g=json_decode($save['game_state']??'{}',true);
 $visits=cl_rows('SELECT DISTINCT place FROM chinalife_life_visits WHERE user_id=?','i',[$player]);$places=array_column($visits,'place');
 return ['hq'=>in_array('hq',$places,true),'explore'=>count($places)>=3,'services'=>!cl_hafrik_features()['services']||(bool)cl_one("SELECT 1 FROM chinalife_life_claims WHERE user_id=? AND claim_key='tour-services'",'i',[$player]),'meet'=>(bool)cl_one("SELECT 1 FROM chinalife_friends WHERE (first_id=? OR second_id=?) AND status='accepted' LIMIT 1",'ii',[$player,$player]),'daily'=>!empty($g['lastVisit'])];
}
function cl_life_sessions(string $city): array {
 $clock=new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai'));$day=$clock->format('Y-m-d');$items=[];
 foreach([['study','Study together','campus',18,20],['meal','Community lunch','market',12,14],['social','Community meetup · all day','plaza',0,24]] as [$kind,$title,$place,$start,$end]){
  $a=$clock->setTime($start,0)->getTimestamp();$b=$clock->setTime($end,0)->getTimestamp();$items[]=['kind'=>$kind,'title'=>$title,'city'=>$city,'day'=>$day,'place'=>$place,'opens_at'=>$a,'ends_at'=>$b,'money'=>100,'xp'=>30,'participants'=>(int)(cl_one('SELECT COUNT(*) n FROM chinalife_community_members m JOIN chinalife_presence p ON p.user_id=m.user_id AND p.city=m.city AND p.place=? AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) WHERE m.city=? AND m.day=? AND m.kind=?','ssss',[$place,$city,$day,$kind])['n']??0)];
 }return $items;
}
function cl_life_city_launches(array $before,array $after): void {
 foreach(array_diff($after,$before) as $city){$now=time();if(!cl_run('INSERT IGNORE INTO chinalife_city_launches(city,opens_at,ends_at,created_by) VALUES(?,?,?,?)','siii',[$city,$now,$now+172800,$GLOBALS['uid']]))continue;
 cl_run('INSERT IGNORE INTO chinalife_life_outbox(user_id,city,actor_id,created_at) SELECT user_id,?,?,NOW() FROM chinalife_saves','si',[$city,$GLOBALS['uid']]);
 cl_run('INSERT INTO chinalife_gist_posts(city,title,body,link,starts_at,ends_at,created_by,created_at) VALUES("",?,?,"",NOW(),DATE_ADD(NOW(),INTERVAL 48 HOUR),?,NOW())','ssi',[$city.' is open!','Free travel for 48 hours. Visit Hafrik Square in '.$city.' and claim your opening-day welcome reward.',$GLOBALS['uid']]);
 }
}
