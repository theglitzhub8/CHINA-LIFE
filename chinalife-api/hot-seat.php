<?php
declare(strict_types=1);
// Gossip hot seat: one player at a time posts a short anonymous gist in the Gossip Room,
// everyone else in the venue votes True or Cap for HS_SECONDS, then the result is revealed and
// voters who matched the majority get coins. Today's most-voted gist is featured on Gossip TV.
//
// GET  hot-seat.php?city=Shenyang&place=gist      -> {enabled, round, featured}
// POST {action:'take',   city, place, body}        -> take the empty seat with a gist
// POST {action:'vote',   city, place, id, vote}    -> vote 'true' or 'cap' (once, not on your own gist)
// POST {action:'report', city, place, id, reason}  -> report a gist; HS_HIDE_REPORTS reports hide it
// Closed rounds are settled lazily on the next request for the venue, inside a transaction.
// Admin list / hide / delete / on-off live in admin.php (actions hot_seat*).
require_once __DIR__.'/common.php';
require_once __DIR__.'/hot-seat-lib.php';
cl_methods(['GET','POST']);
$input=$method==='POST'?cl_body(4000):$_GET;
$city=is_string($input['city']??null)?mb_substr($input['city'],0,40):'';
$place=is_string($input['place']??null)?$input['place']:'gist';
if (!in_array($city,cl_open_cities(),true)) cl_fail('Choose an open city');
if (!in_array($place,HS_PLACES,true)) cl_fail('The hot seat is in the Gossip Room');
if (!cl_hot_seat_enabled()) {if ($method==='GET') cl_reply(['enabled'=>false,'round'=>null,'featured'=>null]); cl_fail('The hot seat is closed right now',403);}

function hs_settle_due(string $city, string $place): array {
    global $db;$paid=[];
    foreach (cl_rows("SELECT id FROM chinalife_hot_seat WHERE city=? AND place=? AND status='voting' AND closes_at<=NOW() LIMIT 5",'ss',[$city,$place]) as $due) {
        $db->begin_transaction();
        $g=cl_one("SELECT id,user_id FROM chinalife_hot_seat WHERE id=? AND status='voting' FOR UPDATE",'i',[(int)$due['id']]);
        if (!$g) {$db->rollback();continue;}
        $day=cl_beijing_day();
        $votes=cl_rows('SELECT v.user_id,v.vote,(SELECT COUNT(*) FROM chinalife_hot_seat_votes p WHERE p.user_id=v.user_id AND p.rewarded>0 AND p.day=?) paid_today FROM chinalife_hot_seat_votes v WHERE v.gist_id=?','si',[$day,(int)$g['id']]);
        $r=hs_payouts($votes,(int)$g['user_id']);
        cl_run("UPDATE chinalife_hot_seat SET status='revealed',true_votes=?,cap_votes=?,result=? WHERE id=?",'iisi',[$r['true'],$r['cap'],$r['result'],(int)$g['id']]);
        foreach ($r['pay'] as $user=>$coins) {
            if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$user])) continue;
            $paid[$user]=cl_credit($user,$coins);
            cl_run('UPDATE chinalife_hot_seat_votes SET rewarded=? WHERE gist_id=? AND user_id=?','iii',[$coins,(int)$g['id'],$user]);
        }
        $db->commit();
    }
    return $paid;
}
function hs_round_out(?array $g): ?array {
    global $uid;if (!$g) return null;
    $id=(int)$g['id'];$open=$g['status']==='voting';
    $mine=cl_one('SELECT vote,rewarded FROM chinalife_hot_seat_votes WHERE gist_id=? AND user_id=?','ii',[$id,$uid]);
    $total=(int)(cl_one('SELECT COUNT(*) n FROM chinalife_hot_seat_votes WHERE gist_id=?','i',[$id])['n']??0);
    $out=['id'=>(string)$id,'body'=>$g['body'],'own'=>(int)$g['user_id']===$uid,'status'=>$open?'voting':'revealed','closes_in'=>max(0,(int)$g['left_ms']),'seconds'=>HS_SECONDS,'votes'=>$total,'my_vote'=>$mine['vote']??null];
    // The split stays secret until the reveal so early votes don't steer late ones.
    if (!$open) $out+=['true'=>(int)$g['true_votes'],'cap'=>(int)$g['cap_votes'],'result'=>$g['result'],'reward'=>(int)($mine['rewarded']??0)+((int)$g['user_id']===$uid&&$g['result']==='true'&&$total>=HS_MIN_VOTES?HS_AUTHOR_REWARD:0)];
    return $out;
}
function hs_state(string $city, string $place): array {
    $round=cl_one("SELECT id,user_id,body,status,true_votes,cap_votes,result,TIMESTAMPDIFF(MICROSECOND,NOW(),closes_at) DIV 1000 left_ms FROM chinalife_hot_seat WHERE city=? AND place=? AND (status='voting' OR (status='revealed' AND closes_at>=DATE_SUB(NOW(),INTERVAL ? SECOND))) ORDER BY id DESC LIMIT 1",'ssi',[$city,$place,HS_REVEAL_SECONDS]);
    $featured=cl_one("SELECT body,true_votes,cap_votes,result FROM chinalife_hot_seat WHERE city=? AND place=? AND status='revealed' AND day=? ORDER BY true_votes+cap_votes DESC,id DESC LIMIT 1",'sss',[$city,$place,cl_beijing_day()]);
    return ['enabled'=>true,'limits'=>['min'=>HS_MIN_LEN,'max'=>HS_MAX_LEN,'seconds'=>HS_SECONDS],'round'=>hs_round_out($round),'featured'=>$featured?['body'=>$featured['body'],'true'=>(int)$featured['true_votes'],'cap'=>(int)$featured['cap_votes'],'result'=>$featured['result']]:null];
}

$paid=hs_settle_due($city,$place);
$money=isset($paid[$uid])?['money'=>$paid[$uid]]:[];
if ($method==='GET') cl_reply(hs_state($city,$place)+$money);
$action=$input['action']??'';

if ($action==='take') {
    cl_presence($uid,$city,$place);
    cl_rate('hot_seat_take',3,3600);
    [$ok,$text]=hs_check_text($input['body']??null);
    if (!$ok) cl_fail($text,422);
    $db->begin_transaction();
    // Lock the venue's live round row (if any) so two players can't take the seat at once.
    $busy=cl_one("SELECT id FROM chinalife_hot_seat WHERE city=? AND place=? AND status='voting' FOR UPDATE",'ss',[$city,$place]);
    if ($busy) {$db->rollback();cl_fail('Someone is already on the hot seat. Vote, then take it next',409);}
    cl_run("INSERT INTO chinalife_hot_seat(user_id,city,place,body,status,day,created_at,closes_at) VALUES(?,?,?,?,'voting',?,NOW(),DATE_ADD(NOW(),INTERVAL ? SECOND))",'issssi',[$uid,$city,$place,$text,cl_beijing_day(),HS_SECONDS]);
    $db->commit();
    json_response('success',hs_state($city,$place),'You are on the hot seat.');
}
$id=filter_var($input['id']??null,FILTER_VALIDATE_INT);
if (!$id) cl_fail('Choose a gist');
$g=cl_one('SELECT id,user_id,status,city,place,closes_at>NOW() open_now FROM chinalife_hot_seat WHERE id=?','i',[$id]);
if (!$g||$g['city']!==$city||$g['place']!==$place||in_array($g['status'],['hidden'],true)) cl_fail('That gist is gone',404);

if ($action==='vote') {
    cl_presence($uid,$city,$place);
    cl_rate('hot_seat_vote',30,60);
    $vote=$input['vote']??'';
    if (!in_array($vote,['true','cap'],true)) cl_fail('Vote True or Cap');
    if ((int)$g['user_id']===$uid) cl_fail('You can\'t vote on your own gist',409);
    if ($g['status']!=='voting'||!(int)$g['open_now']) cl_fail('Voting has closed',409);
    if (cl_run('INSERT IGNORE INTO chinalife_hot_seat_votes(gist_id,user_id,vote,day,created_at) VALUES(?,?,?,?,NOW())','iiss',[$id,$uid,$vote,cl_beijing_day()])===0) cl_fail('You already voted',409);
    json_response('success',hs_state($city,$place),'Vote locked in.');
}
if ($action==='report') {
    cl_rate('hot_seat_report',10,3600);
    $reason=is_string($input['reason']??null)?mb_substr(trim($input['reason']),0,40):'other';
    if ((int)$g['user_id']===$uid) cl_fail('That is your own gist',409);
    if (cl_run('INSERT IGNORE INTO chinalife_hot_seat_reports(gist_id,user_id,reason,created_at) VALUES(?,?,?,NOW())','iis',[$id,$uid,$reason])===0) cl_fail('You already reported this gist',409);
    cl_run('UPDATE chinalife_hot_seat SET reports=reports+1 WHERE id=?','i',[$id]);
    cl_run("UPDATE chinalife_hot_seat SET status='hidden',hidden_by=0 WHERE id=? AND reports>=?",'ii',[$id,HS_HIDE_REPORTS]);
    json_response('success',hs_state($city,$place),'Thanks. An admin will look at it.');
}
cl_fail('Choose a hot seat action');
