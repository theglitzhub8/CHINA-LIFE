<?php
declare(strict_types=1);
const CL_OFFICES=['governor','deputy-governor','city-councillor','student-representative'];
function cl_politics_snapshot(string $city): array {
 $latest=[];$active=[];
 foreach(cl_rows('SELECT office,period,opens_at,closes_at,closes_at>=NOW() voting_open FROM chinalife_politics_elections WHERE city=? AND opens_at<=NOW() ORDER BY closes_at DESC','s',[$city]) as $e){
  if(isset($latest[$e['office']]))continue;$latest[$e['office']]=$e;if($e['voting_open'])$active[$e['office']]=$e;
 }
 $c=cl_rows("SELECT c.id,c.office,c.statement,c.candidate_id,u.user_name name,UNIX_TIMESTAMP(COALESCE(c.reviewed_at,c.created_at))*1000 at FROM chinalife_politics_candidates c JOIN users u ON u.user_id=c.candidate_id WHERE c.city=? AND c.status='approved' ORDER BY c.office,c.id",'s',[$city]);
 $counts=cl_rows('SELECT candidate_id,period,COUNT(*) votes FROM chinalife_politics_votes WHERE city=? GROUP BY candidate_id,period','s',[$city]);
 foreach($c as &$candidate){$candidate['votes']=0;$candidate['period']=$latest[$candidate['office']]['period']??null;foreach($counts as $row)if((int)$row['candidate_id']===(int)$candidate['id']&&$row['period']===$candidate['period'])$candidate['votes']=(int)$row['votes'];$candidate['is_mine']=(int)$candidate['candidate_id']===$GLOBALS['uid'];}unset($candidate);
 $results=$c;usort($results,fn($a,$b)=>strcmp($a['office'],$b['office'])?:($b['votes']<=>$a['votes'])?:($a['id']<=>$b['id']));
 $rank=[];$last=[];foreach($results as &$r){$office=$r['office'];$rank[$office]=($rank[$office]??0)+1;$r['rank']=isset($last[$office])&&$last[$office]['votes']===$r['votes']?$last[$office]['rank']:$rank[$office];$last[$office]=$r;}unset($r);
 $voted=[];foreach(cl_rows('SELECT office,period FROM chinalife_politics_votes WHERE city=? AND voter_id=?','si',[$city,$GLOBALS['uid']]) as $v)if(($latest[$v['office']]['period']??null)===$v['period'])$voted[]=$v['office'];
 return ['city'=>$city,'offices'=>CL_OFFICES,'elections'=>$active,'latest'=>$latest,'candidates'=>$c,'results'=>$results,'voted_offices'=>$voted,'my_votes'=>array_sum(array_map(fn($x)=>$x['is_mine']?$x['votes']:0,$c))];
}
