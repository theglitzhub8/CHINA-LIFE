<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';require_once __DIR__.'/politics-lib.php';cl_methods(['GET','POST']);
$in=$method==='POST'?cl_body():$_GET;$city=$in['city']??'Shenyang';
if(!is_string($city)||!in_array($city,cl_open_cities(),true))cl_fail('Choose an active city');
if($method==='GET')json_response('success',cl_politics_snapshot($city));
$office=$in['office']??'';if(!is_string($office)||!in_array($office,CL_OFFICES,true))cl_fail('Choose a valid office');
if(isset($_GET['vote'])){
 $candidate=filter_var($in['candidate_id']??null,FILTER_VALIDATE_INT);if(!$candidate||$candidate<1)cl_fail('Choose a candidate');
 $e=cl_one('SELECT period FROM chinalife_politics_elections WHERE city=? AND office=? AND opens_at<=NOW() AND closes_at>=NOW() ORDER BY closes_at DESC LIMIT 1','ss',[$city,$office]);if(!$e)cl_fail('Voting is closed',409);
 if(!cl_one("SELECT id FROM chinalife_politics_candidates WHERE id=? AND city=? AND office=? AND status='approved'",'iss',[$candidate,$city,$office]))cl_fail('Candidate is not approved',403);
 try{cl_run('INSERT INTO chinalife_politics_votes(city,office,period,voter_id,candidate_id,created_at) VALUES(?,?,?,?,?,NOW())','sssii',[$city,$office,$e['period'],$uid,$candidate]);}catch(mysqli_sql_exception $x){if($x->getCode()===1062)cl_fail('You already voted in this office this election',409);throw $x;}
 json_response('success',['voted'=>true,'period'=>$e['period'],'ballot'=>cl_politics_snapshot($city)]);
}
$statement=$in['statement']??'';$candidate=filter_var($in['candidate_id']??$uid,FILTER_VALIDATE_INT);
if(!is_string($statement)||trim($statement)===''||mb_strlen($statement)>600||$candidate!==$uid)cl_fail('Invalid nomination');
cl_rate('nomination',8,3600);
try{cl_run('INSERT INTO chinalife_politics_candidates(city,office,candidate_id,statement,created_at) VALUES(?,?,?,?,NOW())','ssis',[$city,$office,$uid,trim($statement)]);}catch(mysqli_sql_exception $x){if($x->getCode()===1062)cl_fail('You already have a nomination for this office',409);throw $x;}
json_response('success',['submitted'=>true]);
