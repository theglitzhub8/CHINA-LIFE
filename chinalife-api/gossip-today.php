<?php
declare(strict_types=1);
// Energy Phase 4 (docs/ENERGY-PLAN.md, switch gossip_tonight): "Today here" in the Gossip Centre. Three small tasks a
// Beijing day, each checked on the server from what you really did today, each paying ¥100 + 10 XP once:
//   tip   - drop a tip on the Gossip wall (chinalife_gist_night, your own: not Hafrik's or the city's posts)
//   vote  - vote True or Cap on a Hot Seat round (chinalife_hot_seat_votes)
//   react - react to 5 tips on the wall (chinalife_gist_night_reactions)
// GET  -> {tasks:[{key,count,target,done,claimed}], prize, xp}
// POST {key} -> the balances after paying it (duplicate:true when already paid today)
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('gossip_today',30,60);

const GT_PRIZE=100,GT_XP=10;
$tasks=['tip'=>1,'vote'=>1,'react'=>5];
$day=cl_beijing_day();
// Beijing midnight as a Unix time, compared with UNIX_TIMESTAMP(created_at) so the server's own time zone never matters.
$since=(new DateTimeImmutable($day.' 00:00:00',new DateTimeZone('Asia/Shanghai')))->getTimestamp();
function gt_count(string $key): int {
    global $uid,$day,$since;
    $row=match($key){
        'tip'=>cl_one('SELECT COUNT(*) n FROM chinalife_gist_night WHERE user_id=? AND official=0 AND UNIX_TIMESTAMP(created_at)>=?','ii',[$uid,$since]),
        'vote'=>cl_one('SELECT COUNT(*) n FROM chinalife_hot_seat_votes WHERE user_id=? AND day=?','is',[$uid,$day]),
        'react'=>cl_one('SELECT COUNT(*) n FROM chinalife_gist_night_reactions WHERE user_id=? AND UNIX_TIMESTAMP(created_at)>=?','ii',[$uid,$since]),
    };
    return (int)($row['n']??0);
}
$paid=fn(string $key)=>cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="gossip-task" AND ref=?','is',[$uid,'gossip-task:'.$key.':'.$day])!==null;

if ($_SERVER['REQUEST_METHOD']==='GET') {
    $out=[];foreach ($tasks as $key=>$target) {$n=gt_count($key);$out[]=['key'=>$key,'count'=>min($n,$target),'target'=>$target,'done'=>$n>=$target,'claimed'=>$paid($key)];}
    json_response('success',['tasks'=>$out,'prize'=>GT_PRIZE,'xp'=>GT_XP]);
}
$input=cl_body();$key=(string)($input['key']??'');
if (!isset($tasks[$key])) cl_fail('Choose a task');
if (gt_count($key)<$tasks[$key]) cl_fail('Finish the task first',409);
$db->begin_transaction();
try {
    $game=cl_lock_character($uid);
    $ref='gossip-task:'.$key.':'.$day;
    if ($paid($key)) {$bal=cl_balances_lock($uid);$db->commit();json_response('success',['money'=>$bal['coins'],'xp'=>$bal['xp'],'awarded'=>0,'awardedXp'=>0,'rankClaimed'=>(int)($game['rankClaimed']??0),'duplicate'=>true]);}
    $moved=cl_move_totals($uid,$game,GT_PRIZE,GT_XP);
    cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,NOW())','issii',[$uid,'gossip-task',$ref,$moved['awarded'],GT_XP]);
    cl_store_totals($uid,$game);
    $db->commit();
    json_response('success',$moved+['duplicate'=>false],'Task complete.');
} catch (Throwable $e) {$db->rollback();throw $e;}
