<?php
declare(strict_types=1);
// Energy Phase 7 (docs/ENERGY-PLAN.md, switch energy_loop): the first visit of the day to each of the seven places pays
// ¥20 + 5 XP, and visiting all seven in one Beijing day pays a ¥100 + 20 XP bonus, once, on the server ledger.
// When the player is in the shared city (a fresh presence row), the visit must be where they really are.
// GET  -> {visited:[place ids today], places:[the seven], bonus:bool, prize, bonus_prize}
// POST {place} -> the balances after paying it, with all:true when this visit completed the seven
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('daily_visit',40,60);

const DV_PLACES=['night','gist','voting','football','hq','cityhospital','university'];
const DV_PRIZE=20,DV_XP=5,DV_BONUS=100,DV_BONUS_XP=20;
$day=cl_beijing_day();
$visited=function() use ($uid,$day): array {
    $out=[];foreach (cl_rows('SELECT ref FROM chinalife_economy_actions WHERE user_id=? AND action="place-visit" AND ref LIKE ?','is',[$uid,'visit:%:'.$day]) as $r)
        if (preg_match('/^visit:([a-z]+):/',(string)$r['ref'],$m)) $out[]=$m[1];
    return array_values(array_intersect(DV_PLACES,$out));
};
$bonusRef='visit-all:'.$day;
$bonusPaid=fn()=>cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="place-visit" AND ref=?','is',[$uid,$bonusRef])!==null;

if ($_SERVER['REQUEST_METHOD']==='GET') json_response('success',['visited'=>$visited(),'places'=>DV_PLACES,'bonus'=>$bonusPaid(),'prize'=>DV_PRIZE,'bonus_prize'=>DV_BONUS]);
$input=cl_body();$place=(string)($input['place']??'');
if (!in_array($place,DV_PLACES,true)) cl_fail('Choose a place');
$here=cl_one('SELECT place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','i',[$uid]);
if ($here && explode('@',(string)$here['place'])[0]!==$place) cl_fail('You are not at that place',409);
if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$uid])) cl_fail('Save your character first',409);
$db->begin_transaction();
try {
    $game=cl_lock_character($uid);
    $ref='visit:'.$place.':'.$day;
    if (cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="place-visit" AND ref=?','is',[$uid,$ref])) {
        $bal=cl_balances_lock($uid);$db->commit();
        json_response('success',['money'=>$bal['coins'],'xp'=>$bal['xp'],'awarded'=>0,'awardedXp'=>0,'rankClaimed'=>(int)($game['rankClaimed']??0),'duplicate'=>true,'all'=>false]);
    }
    $moved=cl_move_totals($uid,$game,DV_PRIZE,DV_XP);
    cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,NOW())','issii',[$uid,'place-visit',$ref,$moved['awarded'],DV_XP]);
    $all=false;
    if (count($visited())===count(DV_PLACES) && !$bonusPaid()) {
        $bonus=cl_move_totals($uid,$game,DV_BONUS,DV_BONUS_XP);
        cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,NOW())','issii',[$uid,'place-visit',$bonusRef,$bonus['awarded'],DV_BONUS_XP]);
        $moved=['money'=>$bonus['money'],'xp'=>$bonus['xp'],'awarded'=>$moved['awarded']+$bonus['awarded'],'awardedXp'=>$moved['awardedXp']+$bonus['awardedXp'],'rankClaimed'=>$bonus['rankClaimed']??$moved['rankClaimed']??0];
        $all=true;
    }
    cl_store_totals($uid,$game);
    $db->commit();
    json_response('success',$moved+['duplicate'=>false,'all'=>$all],$all?'All seven places today!':'First visit today.');
} catch (Throwable $e) {$db->rollback();throw $e;}
