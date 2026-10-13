<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_election_winners_sync();
$offices=['governor','deputy-governor','city-councillor','student-representative'];

function election_board(string $city, array $offices): array {
    global $uid;
    $elections=[];
    foreach ($offices as $office) {
        $row=cl_one('SELECT id,UNIX_TIMESTAMP(ends_at)*1000 ends_at,(ends_at>NOW()) is_open FROM chinalife_elections WHERE city=? AND office=? ORDER BY id DESC LIMIT 1','ss',[$city,$office]);
        $candidates=cl_rows("SELECT c.id,u.user_name name FROM chinalife_politics_candidates c JOIN users u ON u.user_id=c.candidate_id WHERE c.city=? AND c.office=? AND c.status='approved' ORDER BY c.id",'ss',[$city,$office]);
        $votes=[];$mine=null;
        if ($row) {
            foreach (cl_rows('SELECT candidate_id,COUNT(*) n FROM chinalife_election_votes WHERE election_id=? GROUP BY candidate_id','i',[(int)$row['id']]) as $vote) $votes[(string)$vote['candidate_id']]=(int)$vote['n'];
            $own=cl_one('SELECT candidate_id FROM chinalife_election_votes WHERE election_id=? AND voter_id=?','ii',[(int)$row['id'],$uid]);
            if ($own) $mine=(string)$own['candidate_id'];
        }
        $elections[]=['id'=>$row?(string)$row['id']:null,'office'=>$office,'open'=>$row?(bool)(int)$row['is_open']:false,'ends_at'=>$row?(int)$row['ends_at']:null,'mine'=>$mine,'candidates'=>array_map(fn($c)=>['id'=>(string)$c['id'],'name'=>$c['name'],'votes'=>$votes[(string)$c['id']]??0],$candidates)];
    }
    return ['city'=>$city,'results'=>true,'elections'=>$elections];
}

$city=(string)($_GET['city']??'Shenyang');
if ($method==='GET') {
    if (!in_array($city,cl_open_cities(),true)) cl_fail('Choose an active city');
    json_response('success',election_board($city,$offices));
}
cl_rate('election_vote',20,60);
$input=cl_body();
$city=trim((string)($input['city']??''));
$office=(string)($input['office']??'');
$candidate=(int)($input['candidate']??0);
if (!in_array($city,cl_open_cities(),true)||!in_array($office,$offices,true)||$candidate<=0) cl_fail('Choose an office and a candidate');
if (!cl_one("SELECT id FROM chinalife_politics_candidates WHERE id=? AND city=? AND office=? AND status='approved'",'iss',[$candidate,$city,$office])) cl_fail('That candidate is not on this ballot',404);
$db->begin_transaction();
try {
    $row=cl_one('SELECT id FROM chinalife_elections WHERE city=? AND office=? AND ends_at>NOW() ORDER BY id DESC LIMIT 1 FOR UPDATE','ss',[$city,$office]);
    if (!$row) {
        cl_run('INSERT INTO chinalife_elections(city,office,starts_at,ends_at) VALUES(?,?,NOW(),DATE_ADD(NOW(),INTERVAL 7 DAY))','ss',[$city,$office]);
        $row=cl_one('SELECT id FROM chinalife_elections WHERE city=? AND office=? AND ends_at>NOW() ORDER BY id DESC LIMIT 1','ss',[$city,$office]);
    }
    $election=(int)$row['id'];
    if (cl_one('SELECT voter_id FROM chinalife_election_votes WHERE election_id=? AND voter_id=?','ii',[$election,$uid])) {$db->commit();cl_fail('You already voted in this election',409);}
    cl_run('INSERT INTO chinalife_election_votes(election_id,voter_id,candidate_id,created_at) VALUES(?,?,?,NOW())','iii',[$election,$uid,$candidate]);
    $db->commit();
    json_response('success',['election'=>(string)$election,'office'=>$office,'candidate'=>(string)$candidate]+election_board($city,$offices),'Vote recorded.');
} catch (Throwable $e) {$db->rollback();throw $e;}
