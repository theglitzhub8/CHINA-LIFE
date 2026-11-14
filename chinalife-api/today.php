<?php
declare(strict_types=1);
// Today's Three (docs/TODAY-PLAN.md Phase 1, switch todays_three): every Beijing day each player gets three tasks, one
// per group (💴 Hustle, 🏙 Life, 💬 Link-up), picked from the date so everyone gets the same ones and nothing is stored.
// Each task is counted on the server from what the player really did today (the ledger and the gossip tables). The
// tasks keep paying their own rewards where they already do; finishing all three pays a Daily Bonus once a day.
// One free swap a day replaces one group's task with the next one in that group.
// GET  -> {day, endsIn, tasks:[{group,key,count,target,done}], swapped, bonus:{coins,xp,claimed}}
// POST {op:'swap', group} | {op:'bonus'} -> the same as GET (bonus: plus money/xp/awarded)
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('today',40,60);

const TD_BONUS=300,TD_BONUS_XP=50;
// group => [key => target]; the order is the swap order.
const TD_POOL=[
    'hustle'=>['shift'=>1,'mission'=>1],
    'life'=>['match'=>1,'places'=>3],
    'linkup'=>['tip'=>1,'hotseat'=>1,'react'=>5],
];
$day=cl_beijing_day();
$since=(new DateTimeImmutable($day.' 00:00:00',new DateTimeZone('Asia/Shanghai')))->getTimestamp();
$endsIn=$since+86400-time();

function td_ledger(string $action,string $like,string $not=''): int {
    global $uid;
    $sql='SELECT COUNT(*) n FROM chinalife_economy_actions WHERE user_id=? AND action=? AND ref LIKE ?'.($not!==''?' AND ref NOT LIKE ?':'');
    $row=$not!==''?cl_one($sql,'isss',[$uid,$action,$like,$not]):cl_one($sql,'iss',[$uid,$action,$like]);
    return (int)($row['n']??0);
}
function td_count(string $key): int {
    global $uid,$day,$since;
    $opt=fn(string $sql,string $t,array $v)=>(int)(cl_optional_rows($sql,$t,$v)[0]['n']??0);
    return match($key){
        'shift'=>td_ledger('job','job:%:'.$day),
        'mission'=>td_ledger('mission','mission:%:'.$day,'mission:bonus:%'),
        'match'=>td_ledger('fb-full','fb:'.$day.':%'),
        'places'=>td_ledger('place-visit','visit:%:'.$day),
        'tip'=>$opt('SELECT COUNT(*) n FROM chinalife_gist_night WHERE user_id=? AND official=0 AND UNIX_TIMESTAMP(created_at)>=?','ii',[$uid,$since]),
        'hotseat'=>$opt('SELECT COUNT(*) n FROM chinalife_hot_seat_votes WHERE user_id=? AND day=?','is',[$uid,$day]),
        'react'=>$opt('SELECT COUNT(*) n FROM chinalife_gist_night_reactions WHERE user_id=? AND UNIX_TIMESTAMP(created_at)>=?','ii',[$uid,$since]),
    };
}
function td_swapped(): ?string {
    global $uid,$day;
    $row=cl_one("SELECT ref FROM chinalife_economy_actions WHERE user_id=? AND action='today-swap' AND ref LIKE ?",'is',[$uid,'today-swap:'.$day.':%']);
    return $row?substr((string)$row['ref'],strlen('today-swap:'.$day.':')):null;
}
function td_tasks(): array {
    global $day;
    $swapped=td_swapped();$out=[];
    foreach (TD_POOL as $group=>$items) {
        $keys=array_keys($items);$i=crc32($day.'|'.$group)%count($keys);if ($swapped===$group) $i=($i+1)%count($keys);
        $key=$keys[$i];$target=$items[$key];$n=td_count($key);
        $out[]=['group'=>$group,'key'=>$key,'count'=>min($n,$target),'target'=>$target,'done'=>$n>=$target];
    }
    return $out;
}
$bonusRef='today-bonus:'.$day;
$state=function() use ($uid,$day,$endsIn,$bonusRef): array {
    $tasks=td_tasks();
    return ['day'=>$day,'endsIn'=>$endsIn,'tasks'=>$tasks,'swapped'=>td_swapped()!==null,
        'bonus'=>['coins'=>TD_BONUS,'xp'=>TD_BONUS_XP,'claimed'=>cl_one("SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action='today-bonus' AND ref=?",'is',[$uid,$bonusRef])!==null]];
};
if ($method==='GET') json_response('success',$state());

$input=cl_body();$op=(string)($input['op']??'');
if (!in_array($op,['swap','bonus'],true)) cl_fail('Choose swap or bonus');
if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$uid])) cl_fail('Save your character first',409);
$db->begin_transaction();
try {
    $game=cl_lock_character($uid);
    if ($op==='swap') {
        $group=(string)($input['group']??'');
        if (!isset(TD_POOL[$group])) {$db->rollback();cl_fail('Choose a task to swap');}
        if (td_swapped()!==null) {$db->rollback();cl_fail('You already used today’s free swap',409);}
        foreach (td_tasks() as $t) if ($t['group']===$group&&$t['done']) {$db->rollback();cl_fail('That task is already done',409);}
        cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,0,0,NOW())','iss',[$uid,'today-swap','today-swap:'.$day.':'.$group]);
        $db->commit();json_response('success',$state(),'Task swapped.');
    }
    // bonus
    foreach (td_tasks() as $t) if (!$t['done']) {$db->rollback();cl_fail('Finish all three first',409);}
    if (cl_one("SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action='today-bonus' AND ref=?",'is',[$uid,$bonusRef])) {
        $bal=cl_balances_lock($uid);$db->commit();
        json_response('success',$state()+['money'=>$bal['coins'],'xp'=>$bal['xp'],'awarded'=>0,'awardedXp'=>0,'duplicate'=>true]);
    }
    $moved=cl_move_totals($uid,$game,TD_BONUS,TD_BONUS_XP);
    cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,NOW())','issii',[$uid,'today-bonus',$bonusRef,$moved['awarded'],TD_BONUS_XP]);
    cl_store_totals($uid,$game);
    $db->commit();
    json_response('success',$moved+$state()+['duplicate'=>false],'Daily Bonus!');
} catch (Throwable $e) {$db->rollback();throw $e;}
