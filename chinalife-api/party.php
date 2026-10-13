<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);
$clubs=['night','youle','ex','rex','orangutan','taxi-club','best-one','cats-eye','silver-knight','blood','skylight','kama','partypier','hooleys','suns'];

function party_present(string $city, string $place): void {
    global $uid;
    $row=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND city=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','is',[$uid,$city]);
    $here=$row?explode('@',$row['place'])[0]:'';
    if ($here!==$place) cl_fail('Join this club first',403);
}
function party_load(string $city, string $place): ?array {
    return cl_one('SELECT id,city,place,winner_id,title,UNIX_TIMESTAMP(dance_ends)*1000 dance_ends,UNIX_TIMESTAMP(vote_ends)*1000 vote_ends FROM chinalife_party_rounds WHERE city=? AND place=? AND day=?','sss',[$city,$place,cl_beijing_day()]);
}
function party_close(array $round): array {
    if ($round['title']!==''||(int)$round['vote_ends']> (int)round(microtime(true)*1000)) return $round;
    $id=(int)$round['id'];
    $top=cl_one('SELECT entry_id,COUNT(*) n,MIN(created_at) first_at FROM chinalife_party_votes WHERE round_id=? GROUP BY entry_id ORDER BY n DESC,first_at,entry_id LIMIT 1','i',[$id]);
    if (!$top) $top=cl_one('SELECT user_id entry_id FROM chinalife_party_entries WHERE round_id=? ORDER BY created_at,user_id LIMIT 1','i',[$id]);
    $winner=$top?(int)$top['entry_id']:0;
    if ($winner) {
        $name=(string)(cl_one('SELECT user_name FROM users WHERE user_id=?','i',[$winner])['user_name']??'A dancer');
        cl_run('UPDATE chinalife_party_rounds SET winner_id=?,title=? WHERE id=? AND title=""','isi',[$winner,$name.' · Dance Champion',$id]);
    } else cl_run('UPDATE chinalife_party_rounds SET title=? WHERE id=? AND title=""','si',['No champion tonight',$id]);
    return party_load($round['city'],$round['place'])??$round;
}
function party_view(string $city, string $place): array {
    global $uid;
    $round=party_load($city,$place);
    if (!$round) return ['round'=>null];
    $round=party_close($round);
    $now=(int)round(microtime(true)*1000);
    $phase=$round['title']!==''?'closed':($now<(int)$round['dance_ends']?'dance':'vote');
    $entries=cl_rows('SELECT e.user_id,u.user_name name,(SELECT COUNT(*) FROM chinalife_party_votes v WHERE v.round_id=e.round_id AND v.entry_id=e.user_id) votes FROM chinalife_party_entries e JOIN users u ON u.user_id=e.user_id WHERE e.round_id=? ORDER BY votes DESC,e.created_at','i',[(int)$round['id']]);
    $mine=cl_one('SELECT entry_id FROM chinalife_party_votes WHERE round_id=? AND voter_id=?','ii',[(int)$round['id'],$uid]);
    $joined=cl_one('SELECT user_id FROM chinalife_party_entries WHERE round_id=? AND user_id=?','ii',[(int)$round['id'],$uid]);
    return ['round'=>['id'=>(string)$round['id'],'phase'=>$phase,'dance_ends'=>(int)$round['dance_ends'],'vote_ends'=>(int)$round['vote_ends'],'title'=>$round['title'],'winner'=>$round['winner_id']?(string)$round['winner_id']:null,'joined'=>$joined!==null,'mine'=>$mine?(string)$mine['entry_id']:null,'entries'=>array_map(fn($e)=>['id'=>(string)$e['user_id'],'name'=>$e['name'],'votes'=>(int)$e['votes']],$entries)]];
}

$city=(string)($_GET['city']??'');
$place=(string)($_GET['place']??'');
if ($method==='GET') {
    if (!in_array($city,cl_open_cities(),true)||!in_array($place,$clubs,true)) cl_fail('Choose a club');
    json_response('success',party_view($city,$place));
}
cl_rate('party',20,60);
$input=cl_body();
$action=(string)($input['action']??'');
$city=(string)($input['city']??'');
$place=(string)($input['place']??'');
if (!in_array($action,['join','vote'],true)||!in_array($city,cl_open_cities(),true)||!in_array($place,$clubs,true)) cl_fail('Choose a club battle');
party_present($city,$place);
cl_run('INSERT IGNORE INTO chinalife_party_rounds(city,place,day,dance_ends,vote_ends) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 90 SECOND),DATE_ADD(NOW(),INTERVAL 180 SECOND))','sss',[$city,$place,cl_beijing_day()]);
$view=party_view($city,$place);$round=$view['round'];
if ($action==='join') {
    if ($round['phase']!=='dance') cl_fail('The dance round has closed',409);
    if ($round['joined']) json_response('success',$view+['duplicate'=>true],'You are already on the floor.');
    cl_run('INSERT INTO chinalife_party_entries(round_id,user_id,created_at) VALUES(?,?,NOW())','ii',[(int)$round['id'],$uid]);
    json_response('success',party_view($city,$place)+['duplicate'=>false],'You joined the dance.');
}
$dancer=(int)($input['dancer']??0);
if ($round['phase']!=='vote') cl_fail($round['phase']==='dance'?'Voting opens when the round ends':'This round is over',409);
if ($dancer===$uid) cl_fail('Vote for someone else',409);
if (!cl_one('SELECT user_id FROM chinalife_party_entries WHERE round_id=? AND user_id=?','ii',[(int)$round['id'],$dancer])) cl_fail('That dancer is not in this round',404);
if ($round['mine']) cl_fail('You already voted',409);
cl_run('INSERT INTO chinalife_party_votes(round_id,voter_id,entry_id,created_at) VALUES(?,?,?,NOW())','iii',[(int)$round['id'],$uid,$dancer]);
json_response('success',party_view($city,$place),'Vote recorded.');
