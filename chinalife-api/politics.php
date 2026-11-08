<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';require_once __DIR__.'/hafrik-notify.php';require_once __DIR__.'/politics-lib.php';cl_methods(['GET','POST']);
$in=$method==='POST'?cl_body():$_GET;$city=$in['city']??'Shenyang';
if(!is_string($city)||!in_array($city,cl_open_cities(),true))cl_fail('Choose an active city');
if($method==='GET')json_response('success',cl_politics_snapshot($city));
$office=$in['office']??'';if(!is_string($office)||!in_array($office,CL_OFFICES,true))cl_fail('Choose a valid office');
if(isset($_GET['vote'])){
 cl_politics_ensure_week($city);
 $candidate=filter_var($in['candidate_id']??null,FILTER_VALIDATE_INT);if(!$candidate||$candidate<1)cl_fail('Choose a candidate');
 $e=cl_one('SELECT period FROM chinalife_politics_elections WHERE city=? AND office=? AND opens_at<=NOW() AND closes_at>=NOW() ORDER BY (period LIKE \'weekly-%\') ASC,closes_at DESC LIMIT 1','ss',[$city,$office]);if(!$e)cl_fail('Voting is closed',409);
 if(!$nominee=cl_one("SELECT id,candidate_id FROM chinalife_politics_candidates WHERE id=? AND city=? AND office=? AND status='approved'",'iss',[$candidate,$city,$office]))cl_fail('Candidate is not approved',403);
 try{cl_run('INSERT INTO chinalife_politics_votes(city,office,period,voter_id,candidate_id,created_at) VALUES(?,?,?,?,?,NOW())','sssii',[$city,$office,$e['period'],$uid,$candidate]);}catch(mysqli_sql_exception $x){if($x->getCode()===1062)cl_fail('You already voted in this office this election',409);throw $x;}
 $voteId=$db->insert_id;
 // Energy Phase 5 (docs/ENERGY-PLAN.md): voting pays ¥50 + 10 XP on the server ledger, once per office per election
 // (the vote itself is once per office per election; the economy ref keeps the pay to one even if that ever changed).
 $reward=null;$ref='vote:'.$city.':'.$office.':'.$e['period'];
 // Only with a saved character (cl_lock_character would otherwise end the request after the vote was recorded).
 if(cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$uid])){$db->begin_transaction();
 try{$game=cl_lock_character($uid);
  if(!cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="vote" AND ref=?','is',[$uid,$ref])){$reward=cl_move_totals($uid,$game,50,10);cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,NOW())','issii',[$uid,'vote',$ref,$reward['awarded'],10]);cl_store_totals($uid,$game);}
  $db->commit();}catch(Throwable $x){$db->rollback();$reward=null;}}
 cl_hafrik_notify((int)$nominee['candidate_id'],'vote','vote-'.$voteId,'Your '.$office.' campaign in '.$city.' received a vote.');
 json_response('success',['voted'=>true,'period'=>$e['period'],'reward'=>$reward,'ballot'=>cl_politics_snapshot($city)]);
}
$statement=$in['statement']??'';$candidate=filter_var($in['candidate_id']??$uid,FILTER_VALIDATE_INT);
if(!is_string($statement)||trim($statement)===''||mb_strlen($statement)>600||$candidate!==$uid)cl_fail('Invalid nomination');
cl_rate('nomination',8,3600);
try{cl_run('INSERT INTO chinalife_politics_candidates(city,office,candidate_id,statement,created_at) VALUES(?,?,?,?,NOW())','ssis',[$city,$office,$uid,trim($statement)]);}catch(mysqli_sql_exception $x){if($x->getCode()===1062)cl_fail('You already have a nomination for this office',409);throw $x;}
json_response('success',['submitted'=>true]);
