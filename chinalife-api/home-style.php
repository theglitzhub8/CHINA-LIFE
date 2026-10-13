<?php
declare(strict_types=1);
// v8 floors and wallpapers. Prices live here (the client copy is display only); each paid style is bought once
// from the server ledger, then can be used in every home. Visitors may read a host's style, never change it.
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);cl_rate('home-style',40,60);
$FLOORS=['default'=>0,'oak'=>0,'checker'=>500,'carpet'=>400,'bamboo'=>700,'tatami'=>900,'herringbone'=>1200,'marble'=>2400];
$WALLS=['default'=>0,'cream'=>0,'mint'=>200,'stripes'=>350,'brick'=>600,'panda'=>880,'dragon'=>1200,'damask'=>3800];
function hs_key(string $k): string {if(!preg_match('/^[A-Za-z]{2,20}\|[a-z0-9-]{1,40}\|[a-z0-9-]{1,30}$/',$k))cl_fail('Choose one of your homes');return $k;}
function hs_unlocks(int $id): array {return array_map(fn($r)=>(string)$r['style'],cl_optional_rows('SELECT style FROM chinalife_home_style_unlocks WHERE user_id=?','i',[$id]));}
if ($method==='GET') {
    $id=isset($_GET['peer'])?cl_peer($_GET['peer']):$uid;if($id!==$uid&&cl_blocked($uid,$id))cl_fail('Player unavailable',403);
    $rows=cl_optional_rows('SELECT home_key,floor,wall FROM chinalife_home_styles WHERE user_id=? ORDER BY updated_at DESC LIMIT 100','i',[$id]);
    $styles=[];foreach($rows as $r)$styles[$r['home_key']]=['floor'=>$r['floor'],'wall'=>$r['wall']];
    json_response('success',['styles'=>$styles,'unlocked'=>$id===$uid?hs_unlocks($uid):[],'prices'=>['floor'=>$FLOORS,'wall'=>$WALLS]]);
}
$in=cl_body();$key=hs_key((string)($in['home']??''));$floor=(string)($in['floor']??'default');$wall=(string)($in['wall']??'default');
if(!isset($FLOORS[$floor])||!isset($WALLS[$wall]))cl_fail('Choose a floor and wallpaper from the catalogue');
$db->begin_transaction();
try{
    $game=cl_lock_character($uid);
    // The home must be one the player lives in: a rental/property they hold in that city, or an owned estate.
    [$city,$place,$type]=explode('|',$key);
    // Everyone has a starter home ('home' / campus room); estates must be owned. Styles are cosmetic only.
    $owned=in_array($place,['home','home-campus'],true)||in_array($place,(array)($game['ownedHomes']??[]),true);
    if(!$owned)cl_fail("This isn't your home",403);
    $have=hs_unlocks($uid);$cost=0;$buy=[];
    foreach([['floor:'.$floor,$FLOORS[$floor]],['wall:'.$wall,$WALLS[$wall]]] as [$sid,$price])if($price>0&&!in_array($sid,$have,true)){$cost+=$price;$buy[]=[$sid,$price];}
    $moved=null;
    if($cost>0){$bal=cl_balances_lock($uid);if($bal['coins']<$cost)cl_fail('You need ¥'.number_format($cost).' for this style',409);
        $moved=cl_move_totals($uid,$game,-$cost,0);
        foreach($buy as [$sid,$price]){cl_run('INSERT INTO chinalife_home_style_unlocks(user_id,style,created_at) VALUES(?,?,NOW())','is',[$uid,$sid]);cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,0,NOW())','issi',[$uid,'homestyle','homestyle:'.$sid,-$price]);}
        cl_store_totals($uid,$game);}
    cl_run('INSERT INTO chinalife_home_styles(user_id,home_key,floor,wall,updated_at) VALUES(?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE floor=VALUES(floor),wall=VALUES(wall),updated_at=NOW()','isss',[$uid,$key,$floor,$wall]);
    $db->commit();
}catch(Throwable $e){$db->rollback();throw $e;}
$bal=cl_one('SELECT coins,xp FROM chinalife_balances WHERE user_id=?','i',[$uid]);
json_response('success',['style'=>['floor'=>$floor,'wall'=>$wall],'charged'=>$cost,'unlocked'=>hs_unlocks($uid),'money'=>(int)$bal['coins'],'xp'=>(int)$bal['xp'],'rankClaimed'=>(int)($game['rankClaimed']??0),'awarded'=>-$cost,'awardedXp'=>0],$cost?'Style bought and saved.':'Style saved.');
