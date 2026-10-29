<?php
declare(strict_types=1);
// Hospital Phase 3 (docs/HOSPITAL-PLAN.md, appadmin switch hospital_staff): player doctors and nurses.
// Doctors are players with a University major; nurses passed the Health worker test here. On a shift (cl_hset('shiftMinutes')
// minutes, at the City Hospital) they see the queue of patients and pick the treatment for each one's most urgent
// problem. A right treatment pays the doctor ¥120 / the nurse ¥80 + 20 XP (paid for cl_hset('paidPerDay') patients a day, one
// paid visit per patient a day) and the patient 10 XP; the patient is treated either way. Nobody on shift: the
// hospital's own staff treat you as before (game.js).
//
// GET                                   -> {enabled, me, staffOn, patient, queue}
// POST {action:'test_start'}            -> the Health worker test (once a day)
// POST {action:'test_submit', answers}  -> marked here; cl_hset('testPass') right makes you a nurse
// POST {action:'shift_start'|'shift_end'}
// POST {action:'request', chart}        -> ask the staff on shift; {action:'cancel'} to give up
// POST {action:'treat', id, treatment}  -> staff treat a waiting patient
// POST {action:'ack', id}               -> the patient takes the result (once), +10 XP when it was right
require_once __DIR__.'/common.php';
require_once __DIR__.'/hospital-lib.php';
cl_methods(['GET','POST']);
$input=$method==='POST'?cl_body(4000):$_GET;
$on=(cl_hafrik_features()['hospital_staff']??false)&&(cl_hafrik_features()['hospital_care']??false);
if (!$on) {if ($method==='GET') cl_reply(['enabled'=>false]); cl_fail('Hospital jobs are switched off',403);}

function hs_me(int $uid): array {
    $s=cl_one('SELECT certified_at,test_day=CURDATE() AS tested,shift_until>NOW() AS on_shift,UNIX_TIMESTAMP(shift_until) AS until_at FROM chinalife_hospital_staff WHERE user_id=?','i',[$uid]);
    $g=cl_one('SELECT JSON_UNQUOTE(JSON_EXTRACT(game_state,\'$.university.major\')) AS major FROM chinalife_saves WHERE user_id=?','i',[$uid]);
    $major=$g&&$g['major']!==null&&$g['major']!=='null'&&$g['major']!==''?(string)$g['major']:null;$cert=!empty($s['certified_at']);
    $today=cl_one('SELECT COUNT(*) n,COALESCE(SUM(paid>0),0) p FROM chinalife_hospital_patients WHERE staff_id=? AND treated_at>=CURDATE()','i',[$uid]);
    return ['role'=>$major?'doctor':($cert?'nurse':null),'major'=>$major,'certified'=>$cert,'onShift'=>(bool)($s['on_shift']??false),
        'shiftUntil'=>!empty($s['on_shift'])?(int)$s['until_at']:0,'testToday'=>(bool)($s['tested']??false),
        'treatedToday'=>(int)$today['n'],'paidToday'=>(int)$today['p']];
}
function hs_staff_on(): int {return (int)cl_one('SELECT COUNT(*) n FROM chinalife_hospital_staff WHERE shift_until>NOW() AND seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND)')['n'];}
function hs_name(int $id): string {
    $r=cl_one('SELECT JSON_UNQUOTE(JSON_EXTRACT(game_state,\'$.name\')) AS n FROM chinalife_saves WHERE user_id=?','i',[$id]);
    return mb_substr((string)($r['n']??'')?:'A player',0,40);
}
function hs_patient(array $p): array {
    $t=cl_hs_treatments();
    return ['id'=>(int)$p['id'],'status'=>$p['status'],'problem'=>$p['problem'],'label'=>$t[$p['problem']][0]??'',
        'treatment'=>$p['treatment'],'treatmentName'=>$p['treatment']?($t[$p['treatment']][1]??''):null,'correct'=>(bool)$p['correct'],
        'staff'=>$p['staff_id']?hs_name((int)$p['staff_id']):null,'waitingSince'=>(int)$p['since']];
}
cl_run("UPDATE chinalife_hospital_patients SET status='left' WHERE status='waiting' AND created_at<DATE_SUB(NOW(),INTERVAL ".cl_hset('waitMinutes')." MINUTE)");

if ($method==='GET') {
    cl_run('UPDATE chinalife_hospital_staff SET seen_at=NOW() WHERE user_id=? AND shift_until>NOW()','i',[$uid]);
    $me=hs_me($uid);
    $mine=cl_one("SELECT *,UNIX_TIMESTAMP(created_at) since FROM chinalife_hospital_patients WHERE user_id=? AND status IN ('waiting','treated') ORDER BY id DESC LIMIT 1",'i',[$uid]);
    $queue=[];
    if ($me['onShift']) foreach (cl_rows("SELECT id,user_id,chart,UNIX_TIMESTAMP(created_at) since FROM chinalife_hospital_patients WHERE status='waiting' AND user_id<>? ORDER BY id LIMIT 10",'i',[$uid]) as $p) {
        $chart=json_decode($p['chart'],true)?:[];$queue[]=['id'=>(int)$p['id'],'name'=>hs_name((int)$p['user_id']),'chart'=>$chart,
            'options'=>cl_hs_options((int)$p['id'],cl_hs_problem(cl_hs_chart($chart))),'waitingSince'=>(int)$p['since']];
    }
    cl_reply(['enabled'=>true,'me'=>$me,'staffOn'=>hs_staff_on(),'patient'=>$mine?hs_patient($mine):null,'queue'=>$queue,
        'pay'=>['doctor'=>cl_hset('payDoctor'),'nurse'=>cl_hset('payNurse'),'xp'=>cl_hset('staffXp'),'perDay'=>cl_hset('paidPerDay'),'shift'=>cl_hset('shiftMinutes'),'testPass'=>cl_hset('testPass')]]);
}

cl_rate('hospital',60,60);
$action=(string)($input['action']??'');
$db->begin_transaction();
try {
    if ($action==='test_start') {
        $s=cl_one('SELECT certified_at,test_day=CURDATE() AS tested FROM chinalife_hospital_staff WHERE user_id=? FOR UPDATE','i',[$uid]);
        if (!empty($s['certified_at'])) cl_fail('You already have your Health worker certificate',409);
        if (!empty($s['tested'])) cl_fail('One try a day. Come back tomorrow.',409);
        [$qs,$answers]=cl_hs_test();
        cl_run('INSERT INTO chinalife_hospital_staff(user_id,test_day,test_answers) VALUES(?,CURDATE(),?) ON DUPLICATE KEY UPDATE test_day=CURDATE(),test_answers=VALUES(test_answers)','is',[$uid,json_encode($answers,JSON_UNESCAPED_UNICODE)]);
        $db->commit();cl_reply(['questions'=>$qs,'pass'=>cl_hset('testPass')]);
    }
    if ($action==='test_submit') {
        $s=cl_one('SELECT test_answers FROM chinalife_hospital_staff WHERE user_id=? AND test_day=CURDATE() FOR UPDATE','i',[$uid]);
        $answers=json_decode((string)($s['test_answers']??''),true);if (!is_array($answers)) cl_fail('Start the test first',409);
        $given=is_array($input['answers']??null)?array_values($input['answers']):[];$right=0;
        foreach ($answers as $i=>$a) if (isset($given[$i])&&(string)$given[$i]===$a) $right++;
        $passed=$right>=cl_hset('testPass');
        cl_run('UPDATE chinalife_hospital_staff SET test_answers=NULL'.($passed?',certified_at=NOW()':'').' WHERE user_id=?','i',[$uid]);
        $db->commit();cl_reply(['right'=>$right,'total'=>count($answers),'passed'=>$passed,'answers'=>$answers,'me'=>hs_me($uid)]);
    }
    if ($action==='shift_start') {
        $me=hs_me($uid);if (!$me['role']) cl_fail('Only qualified players work here: choose a University major, or pass the Health worker test',403);
        $p=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 90 SECOND)','i',[$uid]);
        if (!$p||explode('@',(string)$p['place'])[0]!=='cityhospital') cl_fail('Go to the City Hospital to start your shift',409);
        if (cl_one("SELECT id FROM chinalife_hospital_patients WHERE user_id=? AND status='waiting'",'i',[$uid])) cl_fail('You are waiting as a patient',409);
        cl_run('INSERT INTO chinalife_hospital_staff(user_id,shift_until,seen_at) VALUES(?,DATE_ADD(NOW(),INTERVAL '.cl_hset('shiftMinutes').' MINUTE),NOW()) ON DUPLICATE KEY UPDATE shift_until=IF(shift_until>NOW(),shift_until,VALUES(shift_until)),seen_at=NOW()','i',[$uid]);
        $db->commit();cl_reply(['me'=>hs_me($uid)]);
    }
    if ($action==='shift_end') {
        cl_run('UPDATE chinalife_hospital_staff SET shift_until=NOW() WHERE user_id=? AND shift_until>NOW()','i',[$uid]);
        $db->commit();cl_reply(['me'=>hs_me($uid)]);
    }
    if ($action==='request') {
        if (hs_me($uid)['onShift']) cl_fail('You are on shift: end it to be a patient',409);
        if (cl_one("SELECT id FROM chinalife_hospital_patients WHERE user_id=? AND status IN ('waiting','treated') FOR UPDATE",'i',[$uid])) cl_fail('You are already waiting',409);
        if (cl_one("SELECT id FROM chinalife_hospital_patients WHERE user_id=? AND status='done' AND treated_at>=DATE_SUB(NOW(),INTERVAL ".cl_hset('againMinutes')." MINUTE)",'i',[$uid])) cl_fail('You were just treated. Rest a little first.',409);
        if (hs_staff_on()<1) cl_fail('No doctor or nurse is on shift right now',409);
        $chart=cl_hs_chart($input['chart']??null);
        cl_run("INSERT INTO chinalife_hospital_patients(user_id,chart,problem,created_at) VALUES(?,?,?,NOW())",'iss',[$uid,json_encode($chart),cl_hs_problem($chart)]);
        $p=cl_one('SELECT *,UNIX_TIMESTAMP(created_at) since FROM chinalife_hospital_patients WHERE id=?','i',[$db->insert_id]);
        $db->commit();cl_reply(['patient'=>hs_patient($p)]);
    }
    if ($action==='cancel') {
        cl_run("UPDATE chinalife_hospital_patients SET status='left' WHERE user_id=? AND status='waiting'",'i',[$uid]);
        $db->commit();cl_reply(['patient'=>null]);
    }
    if ($action==='treat') {
        $me=hs_me($uid);if (!$me['role']||!$me['onShift']) cl_fail('Start a shift first',403);
        $id=(int)($input['id']??0);$treatment=(string)($input['treatment']??'');
        if (!isset(cl_hs_treatments()[$treatment])) cl_fail('Choose a treatment');
        $p=cl_one("SELECT * FROM chinalife_hospital_patients WHERE id=? FOR UPDATE",'i',[$id]);
        if (!$p||(int)$p['user_id']===$uid) cl_fail('Choose a patient in the queue',404);
        if ($p['status']!=='waiting') cl_fail('Someone else is looking after this patient',409);
        $correct=$treatment===$p['problem'];
        $pairPaid=(bool)cl_one('SELECT id FROM chinalife_hospital_patients WHERE staff_id=? AND user_id=? AND paid>0 AND treated_at>=CURDATE()','ii',[$uid,(int)$p['user_id']]);
        $pay=$correct&&!$pairPaid&&$me['paidToday']<cl_hset('paidPerDay')?($me['role']==='doctor'?cl_hset('payDoctor'):cl_hset('payNurse')):0;
        $game=cl_lock_character($uid);$moved=cl_move_totals($uid,$game,$pay,$correct?cl_hset('staffXp'):cl_hset('staffXpWrong'));cl_store_totals($uid,$game);
        cl_run("UPDATE chinalife_hospital_patients SET status='treated',staff_id=?,treatment=?,correct=?,paid=?,treated_at=NOW() WHERE id=?",'isiii',[$uid,$treatment,$correct?1:0,$pay,$id]);
        cl_run('UPDATE chinalife_hospital_staff SET treated=treated+1,seen_at=NOW() WHERE user_id=?','i',[$uid]);
        $t=cl_hs_treatments();
        $db->commit();cl_reply($moved+['result'=>['correct'=>$correct,'paid'=>$pay,'xp'=>$correct?cl_hset('staffXp'):cl_hset('staffXpWrong'),'problem'=>$p['problem'],'label'=>$t[$p['problem']][0],'right'=>$t[$p['problem']][1]],'me'=>hs_me($uid)]);
    }
    if ($action==='ack') {
        $p=cl_one("SELECT *,UNIX_TIMESTAMP(created_at) since FROM chinalife_hospital_patients WHERE id=? AND user_id=? AND status='treated' FOR UPDATE",'ii',[(int)($input['id']??0),$uid]);
        if (!$p) cl_fail('Nothing to collect',409);
        $game=cl_lock_character($uid);$moved=cl_move_totals($uid,$game,0,$p['correct']?cl_hset('patientXp'):0);cl_store_totals($uid,$game);
        cl_run("UPDATE chinalife_hospital_patients SET status='done' WHERE id=?",'i',[(int)$p['id']]);
        $db->commit();cl_reply($moved+['patient'=>hs_patient(['status'=>'done']+$p)]);
    }
    cl_fail('Choose a hospital action');
} catch (Throwable $e) {
    $db->rollback();
    throw $e;
}
