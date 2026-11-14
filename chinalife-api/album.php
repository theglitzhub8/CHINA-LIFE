<?php
declare(strict_types=1);
// City Album (docs/ROADMAP.md item 5, switch city_album). Eight sets, one per shared-city place, six cards each (card 6 is
// rare). Every real thing a player did at a place gives one card from that place's set: worked out from rows the game
// already keeps (the ledger and the gossip tables), so nothing new is stored for cards and nothing can be rerolled.
// Which card a row gives comes from a hash of the player, the kind of row and its id. Doubles are spares (trading them is
// a later step). Finishing a set pays AL_SET once; all eight pays AL_ALL and a badge, once. Ledger: 'album-set'
// "album:SET" and "album:all".
// GET -> {sets:[{id,cards:[counts x6],have,done,claimed}], have, total, spares, setPrize, allPrize, allClaimed}
// POST {op:'claim', set:'night'|...|'all'} -> the same plus money/xp/awarded
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('album',40,60);

const AL_SET=300,AL_SET_XP=30,AL_ALL=2000,AL_ALL_XP=200;
const AL_CARDS=6,AL_WEIGHTS=[3,3,3,3,3,1]; // the sixth card is rare
// set => ledger actions (and place-visit refs) that give its cards. Gossip tips and Hot Seat votes give Gossip Centre cards.
const AL_SETS=[
    'night'=>['mission','club-drink'],
    'gist'=>[],
    'voting'=>['vote'],
    'football'=>['fb-full'],
    'hq'=>['job'],
    'cityhospital'=>['checkup','pharmacy','hospital'],
    'university'=>['school'],
    'gym'=>['gym-workout'],
];
function al_card(string $key): int {
    $h=crc32($key)%array_sum(AL_WEIGHTS);
    foreach (AL_WEIGHTS as $i=>$w) {if ($h<$w) return $i; $h-=$w;}
    return 0;
}
function al_album(int $uid): array {
    $counts=array_fill_keys(array_keys(AL_SETS),array_fill(0,AL_CARDS,0));
    $bySource=[];foreach (AL_SETS as $set=>$actions) foreach ($actions as $a) $bySource[$a]=$set;
    $add=function(string $set,string $key) use (&$counts,$uid) {$counts[$set][al_card($uid.':'.$key)]++;};
    $actions=array_merge(array_keys($bySource),['place-visit']);
    $in=implode(',',array_fill(0,count($actions),'?'));
    foreach (cl_rows("SELECT action,ref FROM chinalife_economy_actions WHERE user_id=? AND action IN ($in)",'i'.str_repeat('s',count($actions)),array_merge([$uid],$actions)) as $r) {
        $a=(string)$r['action'];$ref=(string)$r['ref'];
        if ($a==='place-visit') {if (preg_match('/^visit:([a-z]+):/',$ref,$m)&&isset($counts[$m[1]])) $add($m[1],$a.':'.$ref);continue;}
        if ($a==='mission'&&str_starts_with($ref,'mission:bonus:')) continue;
        $add($bySource[$a],$a.':'.$ref);
    }
    foreach (cl_optional_rows('SELECT id FROM chinalife_gist_night WHERE user_id=? AND official=0','i',[$uid]) as $r) $add('gist','tip:'.$r['id']);
    foreach (cl_optional_rows('SELECT gist_id id FROM chinalife_hot_seat_votes WHERE user_id=?','i',[$uid]) as $r) $add('gist','hotseat:'.$r['id']);
    return $counts;
}
function al_state(int $uid): array {
    $counts=al_album($uid);
    $claimed=array_column(cl_rows("SELECT ref FROM chinalife_economy_actions WHERE user_id=? AND action='album-set'",'i',[$uid]),'ref');
    $sets=[];$have=0;$spares=0;
    foreach ($counts as $id=>$c) {
        $got=count(array_filter($c));$have+=$got;$spares+=array_sum($c)-$got;
        $sets[]=['id'=>$id,'cards'=>$c,'have'=>$got,'done'=>$got===AL_CARDS,'claimed'=>in_array('album:'.$id,$claimed,true)];
    }
    return ['sets'=>$sets,'have'=>$have,'total'=>count($counts)*AL_CARDS,'spares'=>$spares,
        'setPrize'=>['coins'=>AL_SET,'xp'=>AL_SET_XP],'allPrize'=>['coins'=>AL_ALL,'xp'=>AL_ALL_XP],'allClaimed'=>in_array('album:all',$claimed,true)];
}
if ($method==='GET') json_response('success',al_state($uid));

$input=cl_body();$set=(string)($input['set']??'');
if (($input['op']??'')!=='claim'||($set!=='all'&&!isset(AL_SETS[$set]))) cl_fail('Choose a set to claim');
if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$uid])) cl_fail('Save your character first',409);
$db->begin_transaction();
try {
    $game=cl_lock_character($uid);
    $s=al_state($uid);$ref='album:'.$set;
    $ready=$set==='all'?count(array_filter($s['sets'],fn($x)=>$x['done']))===count($s['sets']):(array_values(array_filter($s['sets'],fn($x)=>$x['id']===$set))[0]['done']??false);
    if (!$ready) {$db->rollback();cl_fail($set==='all'?'Finish all eight sets first':'Collect all six cards first',409);}
    if (cl_one("SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action='album-set' AND ref=?",'is',[$uid,$ref])) {$db->rollback();cl_fail('Already claimed',409);}
    [$coins,$xp]=$set==='all'?[AL_ALL,AL_ALL_XP]:[AL_SET,AL_SET_XP];
    $moved=cl_move_totals($uid,$game,$coins,$xp);
    cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,NOW())','issii',[$uid,'album-set',$ref,$moved['awarded'],$xp]);
    cl_store_totals($uid,$game);
    if ($set==='all') {
        try {if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_badges WHERE user_id=?','i',[$uid])['n']<30)
            cl_run("INSERT INTO chinalife_badges(user_id,icon,name,awarded_by,created_at) VALUES(?,'🃏','City Album complete',0,NOW())",'i',[$uid]);}
        catch (Throwable $e) {} // a badge is a bonus; never block the prize
    }
    $db->commit();
    json_response('success',$moved+al_state($uid),$set==='all'?'City Album complete!':'Set complete!');
} catch (Throwable $e) {$db->rollback();throw $e;}
