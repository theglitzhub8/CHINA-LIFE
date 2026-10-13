<?php
declare(strict_types=1);
require_once __DIR__.'/life-lib.php';
function cl_week_clock(): DateTimeImmutable {return new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai'));}
function cl_week_run(int $id,bool $lock=false): array {
 $r=cl_one('SELECT r.*,t.enabled,t.city template_city FROM chinalife_weekly_runs r JOIN chinalife_weekly_templates t ON t.id=r.template_id WHERE r.id=?'.($lock?' FOR UPDATE':''),'i',[$id]);
 if(!$r)cl_fail('Activity not found',404);
 if($r['cancelled']||!$r['enabled']||!in_array($r['city'],cl_open_cities(),true)||($r['template_city']!==''&&$r['template_city']!==$r['city']))cl_fail('This activity is unavailable',409);
 $r['spec']=json_decode($r['snapshot'],true,512,JSON_THROW_ON_ERROR);return $r;
}
function cl_week_generate(string $city): void {
 $clock=cl_week_clock();$templates=cl_rows('SELECT * FROM chinalife_weekly_templates WHERE enabled=1 AND kind NOT IN("coming","legacy") AND (city="" OR city=?)','s',[$city]);
 // Each dated occurrence is immutable once it starts. Editing a template changes only future occurrences.
 foreach($templates as $t)for($offset=-6;$offset<=7;$offset++){
  $day=$clock->modify(($offset>=0?'+':'').$offset.' days');if((int)$day->format('N')!==(int)$t['weekday'])continue;
  $start=$day->setTime(intdiv((int)$t['start_min'],60),(int)$t['start_min']%60)->getTimestamp();$end=$day->setTime(intdiv((int)$t['end_min'],60),(int)$t['end_min']%60)->getTimestamp();$spec=$t;if($city==='Guangzhou'){$aliases=['campus'=>'gdufs','station'=>'gzrailway','night'=>'hooleys'];$spec['place']=$aliases[$spec['place']]??$spec['place'];$cfg=json_decode($spec['config'],true);if(isset($cfg['clues']))foreach($cfg['clues'] as &$clue)$clue['place']=$aliases[$clue['place']]??$clue['place'];unset($clue);$spec['config']=json_encode($cfg,JSON_THROW_ON_ERROR);}$snapshot=json_encode($spec,JSON_THROW_ON_ERROR);
  cl_run('INSERT IGNORE INTO chinalife_weekly_runs(template_id,city,day,starts_at,ends_at,snapshot) VALUES(?,?,?,?,?,?)','sssiis',[$t['id'],$city,$day->format('Y-m-d'),$start,$end,$snapshot]);
  cl_run('UPDATE chinalife_weekly_runs SET starts_at=?,ends_at=?,snapshot=? WHERE template_id=? AND city=? AND day=? AND starts_at>UNIX_TIMESTAMP() AND COALESCE(JSON_EXTRACT(snapshot,"$.revision"),0)<=?','iissssi',[$start,$end,$snapshot,$t['id'],$city,$day->format('Y-m-d'),(int)$t['revision']]);
 }
}
function cl_week_tasks(int $player,string $period): array {
 $clock=cl_week_clock();$start=$period==='week'?$clock->modify('-'.((int)$clock->format('N')-1).' days'):$clock;$date=$start->format('Y-m-d');$end=$period==='week'?$start->modify('+7 days'):$start->modify('+1 day');$day=$clock->format('Y-m-d');
 $visits=(int)(cl_one('SELECT COUNT(DISTINCT city,place) n FROM chinalife_weekly_visits WHERE user_id=? AND day>=? AND day<?','iss',[$player,$date,$end->format('Y-m-d')])['n']??0);
 $daily=(int)(cl_one('SELECT COUNT(*) n FROM chinalife_daily_receipts WHERE user_id=? AND day>=? AND day<?','iss',[$player,$date,$end->format('Y-m-d')])['n']??0);
 $save=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=?','i',[$player]);$g=json_decode($save['game_state']??'{}',true);if($period==='day'&&($g['lastVisit']??'')===$day)$daily=max(1,$daily);
 $completed=(int)(cl_one('SELECT COUNT(*) n FROM chinalife_weekly_members WHERE user_id=? AND completed_at>=? AND completed_at<?','iii',[$player,$start->setTime(0,0)->getTimestamp(),$end->setTime(0,0)->getTimestamp()])['n']??0);
 $completed+=(int)(cl_one('SELECT COUNT(*) n FROM chinalife_life_claims WHERE user_id=? AND claim_key LIKE "community-%" AND created_at>=? AND created_at<?','iss',[$player,$date,$end->format('Y-m-d')])['n']??0);
 $friends=(int)(cl_one('SELECT COUNT(*) n FROM chinalife_weekly_friends WHERE (first_id=? OR second_id=?) AND day>=? AND day<?','iiss',[$player,$player,$date,$end->format('Y-m-d')])['n']??0);
 $definitions=$period==='day'?[['daily','Claim today’s daily reward',1,$daily,'rank',0,0],['explore','Explore two public venues',2,$visits,'guide',25,10],['activity','Complete a featured activity',1,$completed,'activities',40,15],['friend','Make a new accepted friendship',1,$friends,'people',25,10]]:[['weekly-events','Complete two featured activities',2,$completed,'activities',100,30],['weekly-explore','Explore five public venues',5,$visits,'guide',75,25],['weekly-daily','Claim three daily rewards',3,$daily,'rank',75,25]];
 $tasks=[];foreach($definitions as [$id,$title,$target,$value,$route,$money,$xp]){$key='task-'.$period.'-'.$date.'-'.$id;$claimed=$id==='daily'?$value>=1:(bool)cl_one('SELECT 1 FROM chinalife_life_claims WHERE user_id=? AND claim_key=?','is',[$player,$key]);$tasks[]=['id'=>$id,'title'=>$title,'target'=>$target,'value'=>min($target,$value),'route'=>$route,'money'=>$money,'xp'=>$xp,'claimed'=>$claimed,'key'=>$key];}
 $chest='task-'.$period.'-'.$date.'-chest';return ['period'=>$period,'starts'=>$date,'ends_at'=>$end->setTime(0,0)->getTimestamp(),'tasks'=>$tasks,'chest'=>['key'=>$chest,'money'=>$period==='week'?100:40,'xp'=>$period==='week'?30:15,'claimed'=>(bool)cl_one('SELECT 1 FROM chinalife_life_claims WHERE user_id=? AND claim_key=?','is',[$player,$chest])]];
}
