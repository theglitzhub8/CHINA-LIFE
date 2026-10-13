<?php
declare(strict_types=1);
const CL_OFFICES=['governor','deputy-governor','city-councillor','student-representative'];
// Fill missing weekly ballots lazily; concurrent clients share the unique period.
function cl_politics_ensure_week(string $city): void {
 $now=new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai'));
 $start=$now->modify('monday this week')->setTime(0,0);$end=$start->modify('+7 days')->modify('-1 second');
 $period='weekly-'.$start->format('Y-m-d');
 foreach(CL_OFFICES as $office){
  if(cl_one('SELECT period FROM chinalife_politics_elections WHERE city=? AND office=? AND closes_at>=NOW() LIMIT 1','ss',[$city,$office]))continue;
  cl_run('INSERT IGNORE INTO chinalife_politics_elections(city,office,period,opens_at,closes_at) VALUES(?,?,?,FROM_UNIXTIME(?),FROM_UNIXTIME(?))','sssii',[$city,$office,$period,$start->getTimestamp(),$end->getTimestamp()]);
 }
}
// v10: candidate photos for the voting-centre board. Same rules as save.php: https only, no default avatars.
function cl_politics_photo(string $picture): ?string {
 $picture=trim($picture);if($picture===''||preg_match('~(?:blank_profile|default-avatar)~i',$picture))return null;
 $url=preg_match('~^https?://~i',$picture)?$picture:'https://s3.ap-northeast-1.wasabisys.com/hafriksocial/uploads/'.preg_replace('~^uploads/~','',ltrim($picture,'/'));
 return filter_var($url,FILTER_VALIDATE_URL)&&strtolower((string)parse_url($url,PHP_URL_SCHEME))==='https'?$url:null;
}
function cl_politics_snapshot(string $city): array {
 cl_politics_ensure_week($city);
 $latest=[];$active=[];
 foreach(cl_rows('SELECT office,period,opens_at,closes_at,UNIX_TIMESTAMP(closes_at)*1000 closes_ms,closes_at>=NOW() voting_open FROM chinalife_politics_elections WHERE city=? AND opens_at<=NOW() ORDER BY voting_open DESC,(period LIKE \'weekly-%\') ASC,closes_at DESC','s',[$city]) as $e){
  if(isset($latest[$e['office']]))continue;$latest[$e['office']]=$e;if($e['voting_open'])$active[$e['office']]=$e;
 }
 $c=cl_rows("SELECT c.id,c.office,c.statement,c.candidate_id,u.user_name name,u.user_picture picture,UNIX_TIMESTAMP(COALESCE(c.reviewed_at,c.created_at))*1000 at FROM chinalife_politics_candidates c JOIN users u ON u.user_id=c.candidate_id WHERE c.city=? AND c.status='approved' ORDER BY c.office,c.id",'s',[$city]);
 $counts=cl_rows('SELECT candidate_id,period,COUNT(*) votes FROM chinalife_politics_votes WHERE city=? GROUP BY candidate_id,period','s',[$city]);
 foreach($c as &$candidate){$candidate['photo']=cl_politics_photo((string)($candidate['picture']??''));unset($candidate['picture']);$candidate['votes']=0;$candidate['period']=$latest[$candidate['office']]['period']??null;foreach($counts as $row)if((int)$row['candidate_id']===(int)$candidate['id']&&$row['period']===$candidate['period'])$candidate['votes']=(int)$row['votes'];$candidate['is_mine']=(int)$candidate['candidate_id']===$GLOBALS['uid'];}unset($candidate);
 $results=$c;usort($results,fn($a,$b)=>strcmp($a['office'],$b['office'])?:($b['votes']<=>$a['votes'])?:($a['id']<=>$b['id']));
 $rank=[];$last=[];foreach($results as &$r){$office=$r['office'];$rank[$office]=($rank[$office]??0)+1;$r['rank']=isset($last[$office])&&$last[$office]['votes']===$r['votes']?$last[$office]['rank']:$rank[$office];$last[$office]=$r;}unset($r);
 $voted=[];foreach(cl_rows('SELECT office,period FROM chinalife_politics_votes WHERE city=? AND voter_id=?','si',[$city,$GLOBALS['uid']]) as $v)if(($latest[$v['office']]['period']??null)===$v['period'])$voted[]=$v['office'];
 $holders=[];foreach(CL_OFFICES as $office){$e=cl_one('SELECT period FROM chinalife_politics_elections WHERE city=? AND office=? AND closes_at<NOW() ORDER BY closes_at DESC LIMIT 1','ss',[$city,$office]);if(!$e)continue;$winners=cl_rows('SELECT c.id,c.candidate_id,u.user_name name,c.statement,COUNT(*) votes FROM chinalife_politics_votes v JOIN chinalife_politics_candidates c ON c.id=v.candidate_id JOIN users u ON u.user_id=c.candidate_id WHERE v.city=? AND v.office=? AND v.period=? GROUP BY c.id,c.candidate_id,u.user_name,c.statement ORDER BY votes DESC,c.id LIMIT 20','sss',[$city,$office,$e['period']]);if($winners){$top=(int)$winners[0]['votes'];$leaders=array_values(array_filter($winners,fn($x)=>(int)$x['votes']===$top));$holders[]=['office'=>$office,'period'=>$e['period'],'winners'=>$leaders,'votes'=>$top,'tied'=>count($leaders)>1,'term_ends_ms'=>$active[$office]['closes_ms']??null];}}
 return ['holders'=>$holders,'city'=>$city,'offices'=>CL_OFFICES,'elections'=>$active,'latest'=>$latest,'candidates'=>$c,'results'=>$results,'voted_offices'=>$voted,'my_votes'=>array_sum(array_map(fn($x)=>$x['is_mine']?$x['votes']:0,$c))];
}
