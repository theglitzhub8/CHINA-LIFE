<?php
declare(strict_types=1);
// Today's football challenge, checked on the server (Energy Phase 3, closed 14 Nov 2026). The phone reports every match
// it plays (on this phone with bots, or online): a kickoff, then the full time. A full time counts only when it comes
// FB_DAY_MIN_SECONDS or more after its kickoff, once per kickoff, at most FB_DAY_MAX kickoffs a Beijing day.
// economy.php 'football-daily' pays the ¥300 only when these counts meet today's challenge (fb_day_done).
// GET                                    -> {counts:{played,won,goals}, challenge:[key,target], claimed}
// POST {op:'kickoff'}                    -> {kickoff:"fb:DAY:N"}
// POST {op:'full', kickoff, goals, result:'w'|'d'|'l'} -> {counts, challenge, claimed}
require_once __DIR__.'/common.php';
require_once __DIR__.'/football-lib.php';
cl_methods(['GET','POST']);cl_rate('football_day',40,60);

$day=cl_beijing_day();
$today=fn()=>['counts'=>fb_day_counts($uid,$day),'challenge'=>fb_day_challenge($day),
    'claimed'=>cl_one("SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action='football-daily' AND ref=?",'is',[$uid,'football-daily:'.$day])!==null];
if ($_SERVER['REQUEST_METHOD']==='GET') json_response('success',$today());

$input=cl_body();$op=(string)($input['op']??'');
if (!in_array($op,['kickoff','full'],true)) cl_fail('Choose kickoff or full time');
if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$uid])) cl_fail('Save your character first',409);
$db->begin_transaction();
try {
    cl_lock_character($uid); // one request at a time per player, so the kickoff number cannot be taken twice
    if ($op==='kickoff') {
        $n=(int)cl_one("SELECT COUNT(*) n FROM chinalife_economy_actions WHERE user_id=? AND action='fb-kickoff' AND ref LIKE ?",'is',[$uid,'fb:'.$day.':%'])['n'];
        if ($n>=FB_DAY_MAX) {$db->rollback();cl_fail('That is enough football for today',409);}
        $ref='fb:'.$day.':'.($n+1);
        cl_run("INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,'fb-kickoff',?,0,0,NOW())",'is',[$uid,$ref]);
        $db->commit();json_response('success',['kickoff'=>$ref]);
    }
    $kick=(string)($input['kickoff']??'');$goals=$input['goals']??null;$result=(string)($input['result']??'');
    if (!preg_match('/^fb:\d{4}-\d\d-\d\d:\d+$/',$kick)||!is_int($goals)||$goals<0||$goals>10||!in_array($result,['w','d','l'],true)) {$db->rollback();cl_fail('Check the match result');}
    $row=cl_one("SELECT UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(created_at) age FROM chinalife_economy_actions WHERE user_id=? AND action='fb-kickoff' AND ref=?",'is',[$uid,$kick]);
    if (!$row) {$db->rollback();cl_fail('That match did not kick off',404);}
    $age=(int)$row['age'];
    if ($age<FB_DAY_MIN_SECONDS) {$db->rollback();cl_fail('That match ended too soon to count',409);}
    if ($age>7200) {$db->rollback();cl_fail('That match is too old to count',409);}
    if (cl_one("SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action='fb-full' AND ref LIKE ?",'is',[$uid,$kick.':%'])) {$db->rollback();cl_fail('That match is already counted',409);}
    cl_run("INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,'fb-full',?,0,0,NOW())",'is',[$uid,$kick.':'.$goals.':'.$result]);
    $db->commit();
    json_response('success',$today());
} catch (Throwable $e) {$db->rollback();throw $e;}
