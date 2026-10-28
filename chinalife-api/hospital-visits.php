<?php
declare(strict_types=1);
// Hospital Phase 4 (docs/HOSPITAL-PLAN.md, appadmin switch hospital_visits): visiting friends on the ward.
// Friends who woke up at the hospital or were treated by a player doctor/nurse in the last CL_HV_HOURS are "on the ward".
// From the City Hospital you visit them (once a friend a day) with a card, flowers or fruit, paid from your ledger,
// +CL_HV_XP XP for you; their game collects the visit and applies the gift (hospital.js).
//
// GET                                  -> {enabled, ward:[friends recovering], waiting, gifts, cards}
// POST {action:'visit', to, gift, card}-> from the City Hospital
// POST {action:'collect'}              -> visits you haven't seen yet (marked seen)
require_once __DIR__.'/common.php';
require_once __DIR__.'/hospital-lib.php';
cl_methods(['GET','POST']);
$input=$method==='POST'?cl_body(2000):$_GET;
$on=(cl_hafrik_features()['hospital_visits']??false)&&(cl_hafrik_features()['hospital_care']??false);
if (!$on) {if ($method==='GET') cl_reply(['enabled'=>false]); cl_fail('Ward visits are switched off',403);}

function hv_name(int $id): string {
    $r=cl_one('SELECT JSON_UNQUOTE(JSON_EXTRACT(game_state,\'$.name\')) AS n FROM chinalife_saves WHERE user_id=?','i',[$id]);
    return mb_substr((string)($r['n']??'')?:'A friend',0,40);
}
// When each of these players last arrived on the ward (unix time), for those still within CL_HV_HOURS.
function hv_on_ward(array $ids): array {
    $ids=array_values(array_filter(array_map('intval',$ids)));if (!$ids) return [];$in=implode(',',$ids);$since=[];
    foreach (cl_rows("SELECT user_id,UNIX_TIMESTAMP(MAX(created_at)) t FROM chinalife_economy_actions WHERE action='hospital' AND user_id IN ($in) AND created_at>=DATE_SUB(NOW(),INTERVAL ".CL_HV_HOURS." HOUR) GROUP BY user_id") as $r) $since[(int)$r['user_id']]=(int)$r['t'];
    foreach (cl_optional_rows("SELECT user_id,UNIX_TIMESTAMP(MAX(treated_at)) t FROM chinalife_hospital_patients WHERE status IN ('treated','done') AND user_id IN ($in) AND treated_at>=DATE_SUB(NOW(),INTERVAL ".CL_HV_HOURS." HOUR) GROUP BY user_id") as $r) $since[(int)$r['user_id']]=max($since[(int)$r['user_id']]??0,(int)$r['t']);
    return $since;
}
function hv_friends(int $uid): array {
    return array_map(fn($r)=>(int)$r['id'],cl_rows("SELECT IF(first_id=?,second_id,first_id) id FROM chinalife_friends WHERE (first_id=? OR second_id=?) AND status='accepted' LIMIT 300",'iii',[$uid,$uid,$uid]));
}

if ($method==='GET') {
    $ward=[];
    foreach (hv_on_ward(hv_friends($uid)) as $id=>$since) {
        if (cl_blocked($uid,$id)) continue;
        $ward[]=['id'=>$id,'name'=>hv_name($id),'since'=>$since,'until'=>$since+CL_HV_HOURS*3600,
            'visited'=>(bool)cl_one('SELECT id FROM chinalife_hospital_visits WHERE visitor_id=? AND patient_id=? AND created_at>=CURDATE()','ii',[$uid,$id])];
    }
    usort($ward,fn($a,$b)=>$b['since']<=>$a['since']);
    $waiting=(int)cl_one('SELECT COUNT(*) n FROM chinalife_hospital_visits WHERE patient_id=? AND seen_at IS NULL','i',[$uid])['n'];
    cl_reply(['enabled'=>true,'ward'=>$ward,'waiting'=>$waiting,'gifts'=>cl_hv_gifts(),'cards'=>cl_hv_cards(),'hours'=>CL_HV_HOURS]);
}

cl_rate('hospital',60,60);
$action=(string)($input['action']??'');
$db->begin_transaction();
try {
    if ($action==='visit') {
        $to=(int)($input['to']??0);$gift=(string)($input['gift']??'');$card=(string)($input['card']??'');
        if (!isset(cl_hv_gifts()[$gift])||!isset(cl_hv_cards()[$card])) cl_fail('Choose a gift and a card');
        if ($to===$uid||!cl_friends($uid,$to)||cl_blocked($uid,$to)) cl_fail('You can visit your friends',403);
        $p=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 90 SECOND)','i',[$uid]);
        if (!$p||explode('@',(string)$p['place'])[0]!=='cityhospital') cl_fail('Go to the City Hospital to visit the ward',409);
        if (!isset(hv_on_ward([$to])[$to])) cl_fail('Your friend is not on the ward any more',409);
        if (cl_one('SELECT id FROM chinalife_hospital_visits WHERE visitor_id=? AND patient_id=? AND created_at>=CURDATE() FOR UPDATE','ii',[$uid,$to])) cl_fail('You visited them today already',409);
        $price=cl_hv_gifts()[$gift][0];if ($price&&cl_balances_lock($uid)['coins']<$price) cl_fail('You need ¥'.$price.' for '.cl_hv_gifts()[$gift][1],409);
        $game=cl_lock_character($uid);$moved=cl_move_totals($uid,$game,-$price,CL_HV_XP);cl_store_totals($uid,$game);
        cl_run('INSERT INTO chinalife_hospital_visits(visitor_id,patient_id,gift,card,created_at) VALUES(?,?,?,?,NOW())','iiss',[$uid,$to,$gift,$card]);
        $db->commit();cl_reply($moved+['visited'=>['id'=>$to,'name'=>hv_name($to),'gift'=>$gift,'card'=>cl_hv_cards()[$card],'paid'=>$price,'xp'=>CL_HV_XP]]);
    }
    if ($action==='collect') {
        $rows=cl_rows('SELECT id,visitor_id,gift,card FROM chinalife_hospital_visits WHERE patient_id=? AND seen_at IS NULL ORDER BY id LIMIT 20 FOR UPDATE','i',[$uid]);
        if ($rows) cl_run('UPDATE chinalife_hospital_visits SET seen_at=NOW() WHERE id IN ('.implode(',',array_map(fn($r)=>(int)$r['id'],$rows)).')');
        $db->commit();
        cl_reply(['visits'=>array_map(fn($r)=>['from'=>hv_name((int)$r['visitor_id']),'gift'=>$r['gift'],'giftName'=>cl_hv_gifts()[$r['gift']][1]??'','card'=>cl_hv_cards()[$r['card']]??''],$rows)]);
    }
    cl_fail('Choose a ward action');
} catch (Throwable $e) {
    $db->rollback();
    throw $e;
}
