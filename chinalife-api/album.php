<?php
declare(strict_types=1);
// City Album (docs/ROADMAP.md item 5, switch city_album). Eight sets, one per shared-city place, six cards each (card 6 is
// rare). Every real thing a player did at a place gives one card from that place's set: worked out from rows the game
// already keeps (the ledger and the gossip tables), so nothing new is stored for cards and nothing can be rerolled.
// Which card a row gives comes from a hash of the player, the kind of row and its id. Doubles are spares.
// Finishing a set pays AL_SET once; all eight pays AL_ALL and a badge, once. Ledger: 'album-set' "album:SET", "album:all".
// Trading (part 2, table chinalife_album_trades from migration-album-trades.sql): offer one of your spares to a friend
// for one of their spares. A spare offered in a pending trade is held for it. AL_TRADES_DAY offers a Beijing day, at
// most AL_TRADES_OPEN waiting, each expires after AL_TRADE_HOURS. Accepting checks both spares again. Accepted trades
// move the two cards in the counts below. Cards are named "SET:INDEX" (index 0-5).
// GET                  -> {sets:[{id,cards:[counts x6],have,done,claimed}], have, total, spares, setPrize, allPrize,
//                          allClaimed, trading:{on, incoming, outgoing, sentToday, perDay, friends:[{id,name}]}}
// GET ?friend=ID       -> {friend:{id,name}, spares:["SET:I", ...]} (cards that friend can trade)
// POST {op:'claim', set:'night'|...|'all'}          -> the GET state plus money/xp/awarded
// POST {op:'offer', to, give:'SET:I', want:'SET:I'} -> the GET state
// POST {op:'answer', id, accept:true|false}         -> the GET state
// POST {op:'cancel', id}                            -> the GET state
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('album',40,60);

const AL_SET=300,AL_SET_XP=30,AL_ALL=2000,AL_ALL_XP=200;
const AL_TRADES_DAY=3,AL_TRADES_OPEN=5,AL_TRADE_HOURS=48;
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
    // Accepted trades: the sender gives one card and gets the other; the friend the other way round.
    foreach (cl_optional_rows("SELECT from_id,give_card,want_card FROM chinalife_album_trades WHERE status='accepted' AND (from_id=? OR to_id=?)",'ii',[$uid,$uid]) as $t) {
        $g=al_key((string)$t['give_card']);$w=al_key((string)$t['want_card']);if (!$g||!$w) continue;
        $mine=(int)$t['from_id']===$uid;[$out,$in]=$mine?[$g,$w]:[$w,$g];
        $counts[$out[0]][$out[1]]=max(0,$counts[$out[0]][$out[1]]-1);$counts[$in[0]][$in[1]]++;
    }
    return $counts;
}
function al_key(string $k): ?array {return preg_match('/^([a-z]+):([0-5])$/',$k,$m)&&isset(AL_SETS[$m[1]])?[$m[1],(int)$m[2]]:null;}
function al_trades_on(): bool {static $on=null;return $on??=cl_one("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chinalife_album_trades'")!==null;}
// Cards a player can still trade: more than one, less the ones held by their own pending offers (other than $skip).
function al_spares(int $uid,int $skip=0): array {
    $counts=al_album($uid);$held=[];
    foreach (cl_optional_rows("SELECT give_card FROM chinalife_album_trades WHERE from_id=? AND status='pending' AND id<>?",'ii',[$uid,$skip]) as $t) $held[(string)$t['give_card']]=($held[(string)$t['give_card']]??0)+1;
    $out=[];foreach ($counts as $set=>$c) foreach ($c as $i=>$n) if ($n-1-($held[$set.':'.$i]??0)>=1) $out[]=$set.':'.$i;
    return $out;
}
function al_trading(int $uid): array {
    if (!al_trades_on()) return ['on'=>false];
    cl_run("UPDATE chinalife_album_trades SET status='expired',decided_at=NOW() WHERE status='pending' AND created_at<DATE_SUB(NOW(),INTERVAL ".AL_TRADE_HOURS." HOUR)");
    $row=fn(array $t,string $who)=>['id'=>(string)$t['id'],$who=>['id'=>(string)$t['peer'],'name'=>(string)$t['name']],'give'=>$t['give_card'],'want'=>$t['want_card'],'expiresIn'=>max(0,AL_TRADE_HOURS*3600-(int)$t['age'])];
    $q="SELECT t.id,t.give_card,t.want_card,u.user_id peer,u.user_name name,UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(t.created_at) age FROM chinalife_album_trades t JOIN users u ON u.user_id=t.%s WHERE t.%s=? AND t.status='pending' ORDER BY t.id DESC LIMIT 20";
    $since=(new DateTimeImmutable(cl_beijing_day().' 00:00:00',new DateTimeZone('Asia/Shanghai')))->getTimestamp();
    $friends=cl_rows("SELECT u.user_id id,u.user_name name FROM chinalife_friends f JOIN users u ON u.user_id=IF(f.first_id=?,f.second_id,f.first_id) WHERE (f.first_id=? OR f.second_id=?) AND f.status='accepted' ORDER BY u.user_name LIMIT 100",'iii',[$uid,$uid,$uid]);
    return ['on'=>true,'perDay'=>AL_TRADES_DAY,'hours'=>AL_TRADE_HOURS,
        'sentToday'=>(int)cl_one('SELECT COUNT(*) n FROM chinalife_album_trades WHERE from_id=? AND UNIX_TIMESTAMP(created_at)>=?','ii',[$uid,$since])['n'],
        'incoming'=>array_map(fn($t)=>$row($t,'from'),cl_rows(sprintf($q,'from_id','to_id'),'i',[$uid])),
        'outgoing'=>array_map(fn($t)=>$row($t,'to'),cl_rows(sprintf($q,'to_id','from_id'),'i',[$uid])),
        'friends'=>array_map(fn($f)=>['id'=>(string)$f['id'],'name'=>(string)$f['name']],array_values(array_filter($friends,fn($f)=>!cl_blocked($uid,(int)$f['id']))))];
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
        'setPrize'=>['coins'=>AL_SET,'xp'=>AL_SET_XP],'allPrize'=>['coins'=>AL_ALL,'xp'=>AL_ALL_XP],'allClaimed'=>in_array('album:all',$claimed,true),
        'trading'=>al_trading($uid)];
}
$friendOk=fn(int $id)=>$id>0&&$id!==$uid&&cl_friends($uid,$id)&&!cl_blocked($uid,$id);
if ($method==='GET') {
    if (isset($_GET['friend'])) {
        $id=(int)$_GET['friend'];if (!al_trades_on()) cl_fail('Trading is not open yet',503);
        if (!$friendOk($id)) cl_fail('You can only trade with friends',403);
        json_response('success',['friend'=>['id'=>(string)$id,'name'=>(string)(cl_one('SELECT user_name FROM users WHERE user_id=?','i',[$id])['user_name']??'Friend')],'spares'=>al_spares($id)]);
    }
    json_response('success',al_state($uid));
}

$input=cl_body();$op=(string)($input['op']??'');
if (in_array($op,['offer','answer','cancel'],true)) {
    if (!al_trades_on()) cl_fail('Trading is not open yet',503);
    cl_rate('album_trade',20,60);
    if ($op==='offer') {
        $to=(int)($input['to']??0);$give=(string)($input['give']??'');$want=(string)($input['want']??'');
        if (!al_key($give)||!al_key($want)) cl_fail('Choose the two cards');
        if ($give===$want) cl_fail('Pick a different card to ask for');
        if (!$friendOk($to)) cl_fail('You can only trade with friends',403);
        $db->begin_transaction();
        try {
            cl_one('SELECT user_id FROM users WHERE user_id=? FOR UPDATE','i',[$uid]); // one offer at a time per player
            $st=al_trading($uid);
            if ($st['sentToday']>=AL_TRADES_DAY) {$db->rollback();cl_fail('That’s '.AL_TRADES_DAY.' trade offers today. More tomorrow.',409);}
            if (count($st['outgoing'])>=AL_TRADES_OPEN) {$db->rollback();cl_fail('Wait for your friends to answer your offers first',409);}
            if (!in_array($give,al_spares($uid),true)) {$db->rollback();cl_fail('That card is not a spare any more',409);}
            if (!in_array($want,al_spares($to),true)) {$db->rollback();cl_fail('Your friend has no spare of that card',409);}
            cl_run("INSERT INTO chinalife_album_trades(from_id,to_id,give_card,want_card,status,created_at) VALUES(?,?,?,?,'pending',NOW())",'iiss',[$uid,$to,$give,$want]);
            $db->commit();
        } catch (Throwable $e) {$db->rollback();throw $e;}
        if (is_file(__DIR__.'/hafrik-notify.php')) {require_once __DIR__.'/hafrik-notify.php';cl_hafrik_notify($to,'activity','album-trade-'.$db->insert_id,'A friend offered you a card trade for your ChinaLife City Album.',$uid);}
        json_response('success',al_state($uid),'Offer sent.');
    }
    $id=(int)($input['id']??0);
    $db->begin_transaction();
    try {
        $t=cl_one("SELECT id,from_id,to_id,give_card,want_card FROM chinalife_album_trades WHERE id=? AND status='pending' FOR UPDATE",'i',[$id]);
        if ($op==='cancel') {
            if (!$t||(int)$t['from_id']!==$uid) {$db->rollback();cl_fail('That offer is no longer open',404);}
            cl_run("UPDATE chinalife_album_trades SET status='cancelled',decided_at=NOW() WHERE id=?",'i',[$id]);
            $db->commit();json_response('success',al_state($uid),'Offer cancelled.');
        }
        if (!$t||(int)$t['to_id']!==$uid) {$db->rollback();cl_fail('That offer is no longer open',404);}
        $accept=($input['accept']??false)===true;$from=(int)$t['from_id'];
        if ($accept) {
            cl_rows('SELECT user_id FROM users WHERE user_id IN (?,?) ORDER BY user_id FOR UPDATE','ii',[$uid,$from]); // both players, so a spare is never traded twice
            if (cl_blocked($uid,$from)) {$db->rollback();cl_fail('You can only trade with friends',403);}
            if (!in_array((string)$t['give_card'],al_spares($from,$id),true)) {cl_run("UPDATE chinalife_album_trades SET status='cancelled',decided_at=NOW() WHERE id=?",'i',[$id]);$db->commit();cl_fail('Your friend no longer has that spare',409);}
            if (!in_array((string)$t['want_card'],al_spares($uid),true)) {$db->rollback();cl_fail('You no longer have a spare of that card',409);}
        }
        cl_run('UPDATE chinalife_album_trades SET status=?,decided_at=NOW() WHERE id=?','si',[$accept?'accepted':'declined',$id]);
        $db->commit();
        json_response('success',al_state($uid),$accept?'Trade done!':'Offer declined.');
    } catch (Throwable $e) {$db->rollback();throw $e;}
}
$set=(string)($input['set']??'');
if ($op!=='claim'||($set!=='all'&&!isset(AL_SETS[$set]))) cl_fail('Choose a set to claim');
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
