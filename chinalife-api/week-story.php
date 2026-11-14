<?php
declare(strict_types=1);
// Weekly story (docs/ROADMAP.md item 4, switch week_story): a 7-step story each Beijing week (Monday to Sunday), the
// same story for everyone, picked from the week. Step N opens on day N (missed steps can be caught up later in the
// week). Each step is a place and an action, counted on the server from what the player really did (the same ledger
// and gossip tables as Today's Three), and only from after the step opened and after the previous step was claimed,
// so one action never finishes two steps. Each step pays WS_STEP coins + WS_STEP_XP; step 7 pays the prize and a badge.
// Ledger rows: 'story-step' "story:WEEK:N" (WEEK = the Monday, Y-m-d).
// GET  -> {week, story:{id,title,icon,blurb}, endsIn, steps:[{n,kind,count,target,opensIn,claimed,ready}], current, ...}
// POST {op:'claim'} -> pays the current step when it is ready; the same as GET plus money/xp/awarded
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('week_story',40,60);

// The first story starts on Monday 16 Nov 2026 (a full week); before that GET says when it starts and claims are refused.
const WS_FROM='2026-11-16';
const WS_STEP=50,WS_STEP_XP=10,WS_PRIZE=1000,WS_PRIZE_XP=100;
// id => [icon, title, blurb, 7 steps]. A step is [kind, target]; kinds are counted by ws_count(). The words for each step
// live in public/week-story.js (same ids). Add stories at the end; the week picks one by its ISO week number.
const WS_STORIES=[
    'exam'=>['📚','Exam Week','Your first big Chinese exam is on Sunday. Get ready one day at a time.',
        [['visit:university',1],['class',1],['shift',1],['tip',1],['class',1],['match',1],['mission',1]]],
    'fitness'=>['🏋️','Fitness Week','The city fun run is on Sunday. Train with friends and get match fit.',
        [['gym',1],['match',1],['visit:cityhospital',1],['gym',1],['react',3],['match',1],['gym',1]]],
    'star'=>['🌟','Rising Star','Everyone is talking about someone new in town. Make sure it is you.',
        [['visit:hq',1],['tip',1],['hotseat',1],['mission',1],['react',5],['visit:voting',1],['mission',1]]],
    'nightowl'=>['🪩','Night Owl Week','The club’s anniversary party is on Sunday and you are on the guest list.',
        [['mission',1],['react',3],['shift',1],['hotseat',1],['visit:gist',1],['shift',1],['mission',1]]],
];
// Now, pinned on local test stacks (CHINALIFE_TEST_SOCKET) by an "X-Test-Today: Y-m-d H:i" header (Beijing time).
function ws_now(): int {
    $t=$_SERVER['HTTP_X_TEST_TODAY']??'';
    if (getenv('CHINALIFE_TEST_SOCKET')&&preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/',$t)) return (new DateTimeImmutable($t,new DateTimeZone('Asia/Shanghai')))->getTimestamp();
    return time();
}
$now=ws_now();$tz=new DateTimeZone('Asia/Shanghai');
$d=(new DateTimeImmutable('@'.$now))->setTimezone($tz);
$monday=$d->modify('-'.((int)$d->format('N')-1).' days')->setTime(0,0);
$week=$monday->format('Y-m-d');$start=$monday->getTimestamp();
$keys=array_keys(WS_STORIES);$storyId=$keys[(int)$monday->format('W')%count($keys)];
[$icon,$title,$blurb,$plan]=WS_STORIES[$storyId];

// How many times the player did $kind from $from (a Unix time) until now.
function ws_count(string $kind,int $from): int {
    global $uid,$now;
    $ledger=function(string $action,string $like) use ($uid,$from,$now): int {
        return (int)(cl_one('SELECT COUNT(*) n FROM chinalife_economy_actions WHERE user_id=? AND action=? AND ref LIKE ? AND UNIX_TIMESTAMP(created_at)>=? AND UNIX_TIMESTAMP(created_at)<=?','issii',[$uid,$action,$like,$from,$now])['n']??0);
    };
    $opt=fn(string $sql)=>(int)(cl_optional_rows($sql,'iii',[$uid,$from,$now])[0]['n']??0);
    if (str_starts_with($kind,'visit:')) return $ledger('place-visit','visit:'.substr($kind,6).':%');
    return match($kind){
        'class'=>$ledger('school','school:class:%'),
        'shift'=>$ledger('job','job:%'),
        'mission'=>$ledger('mission','mission:%')-$ledger('mission','mission:bonus:%'),
        'match'=>$ledger('fb-full','fb:%'),
        'gym'=>$ledger('gym-workout','gym-workout:%'),
        'tip'=>$opt('SELECT COUNT(*) n FROM chinalife_gist_night WHERE user_id=? AND official=0 AND UNIX_TIMESTAMP(created_at)>=? AND UNIX_TIMESTAMP(created_at)<=?'),
        'hotseat'=>$opt('SELECT COUNT(*) n FROM chinalife_hot_seat_votes WHERE user_id=? AND UNIX_TIMESTAMP(created_at)>=? AND UNIX_TIMESTAMP(created_at)<=?'),
        'react'=>$opt('SELECT COUNT(*) n FROM chinalife_gist_night_reactions WHERE user_id=? AND UNIX_TIMESTAMP(created_at)>=? AND UNIX_TIMESTAMP(created_at)<=?'),
        default=>0,
    };
}
// Claim times of this week's steps: [n => unix time].
function ws_claims(): array {
    global $uid,$week;$out=[];
    foreach (cl_rows("SELECT ref,UNIX_TIMESTAMP(created_at) at FROM chinalife_economy_actions WHERE user_id=? AND action='story-step' AND ref LIKE ?",'is',[$uid,'story:'.$week.':%']) as $r)
        $out[(int)substr((string)$r['ref'],strlen('story:'.$week.':'))]=(int)$r['at'];
    return $out;
}
function ws_state(): array {
    global $plan,$start,$now,$week,$storyId,$icon,$title,$blurb;
    $claims=ws_claims();$steps=[];$current=null;
    foreach ($plan as $i=>[$kind,$target]) {
        $n=$i+1;$opens=$start+$i*86400;$claimed=isset($claims[$n]);$count=0;$ready=false;
        if (!$claimed&&$current===null) {
            $current=$n;
            if ($now>=$opens) {$from=max($opens,$claims[$n-1]??0);$count=min($target,ws_count($kind,$from));$ready=$count>=$target;}
        }
        $steps[]=['n'=>$n,'kind'=>$kind,'target'=>$target,'count'=>$claimed?$target:$count,'opensIn'=>max(0,$opens-$now),'claimed'=>$claimed,'ready'=>$ready];
    }
    return ['week'=>$week,'story'=>['id'=>$storyId,'icon'=>$icon,'title'=>$title,'blurb'=>$blurb],'endsIn'=>$start+7*86400-$now,
        'steps'=>$steps,'current'=>$current,'done'=>count($claims),'reward'=>['coins'=>WS_STEP,'xp'=>WS_STEP_XP],'prize'=>['coins'=>WS_PRIZE,'xp'=>WS_PRIZE_XP]];
}
if ($week<WS_FROM) {
    $first=new DateTimeImmutable(WS_FROM.' 00:00:00',$tz);$k=$keys[(int)$first->format('W')%count($keys)];
    if ($method==='GET') json_response('success',['soon'=>true,'startsIn'=>$first->getTimestamp()-$now,'story'=>['id'=>$k,'icon'=>WS_STORIES[$k][0],'title'=>WS_STORIES[$k][1],'blurb'=>WS_STORIES[$k][2]],
        'reward'=>['coins'=>WS_STEP,'xp'=>WS_STEP_XP],'prize'=>['coins'=>WS_PRIZE,'xp'=>WS_PRIZE_XP]]);
    cl_fail('The first story starts on Monday',409);
}
if ($method==='GET') json_response('success',ws_state());

$input=cl_body();if (($input['op']??'')!=='claim') cl_fail('Choose claim');
if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$uid])) cl_fail('Save your character first',409);
$db->begin_transaction();
try {
    $game=cl_lock_character($uid); // one claim at a time per player
    $s=ws_state();$n=$s['current'];
    if ($n===null) {$db->rollback();cl_fail('This week’s story is finished',409);}
    $step=$s['steps'][$n-1];
    if ($step['opensIn']>0) {$db->rollback();cl_fail('That step opens later this week',409);}
    if (!$step['ready']) {$db->rollback();cl_fail('Do this step first',409);}
    $last=$n===count($plan);$coins=WS_STEP+($last?WS_PRIZE:0);$xp=WS_STEP_XP+($last?WS_PRIZE_XP:0);
    $moved=cl_move_totals($uid,$game,$coins,$xp);
    cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,FROM_UNIXTIME(?))','issiii',[$uid,'story-step','story:'.$week.':'.$n,$moved['awarded'],$xp,$now]);
    cl_store_totals($uid,$game);
    if ($last) {
        try {if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_badges WHERE user_id=?','i',[$uid])['n']<30)
            cl_run('INSERT INTO chinalife_badges(user_id,icon,name,awarded_by,created_at) VALUES(?,?,?,0,NOW())','iss',[$uid,$icon,mb_substr($title.' · week of '.$monday->format('j M'),0,60)]);}
        catch (Throwable $e) {} // a badge is a bonus; never block the prize
    }
    $db->commit();
    json_response('success',$moved+ws_state()+['finished'=>$last],$last?'Story complete!':'Step done.');
} catch (Throwable $e) {$db->rollback();throw $e;}
