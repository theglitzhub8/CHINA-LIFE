<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST','PUT','DELETE']);
// Hafrik profile gender (users.user_gender: 1 male, 2 female, 3 other), read-only. Null when not male/female.
function cl_profile_gender(int $id): ?string {$r=cl_one('SELECT user_gender FROM users WHERE user_id=?','i',[$id]);$g=(string)($r['user_gender']??'');return $g==='1'?'male':($g==='2'?'female':null);}
function cl_save_result(int $id): array {
    $row=cl_one('SELECT character_data,game_state,revision,created_at,updated_at FROM chinalife_saves WHERE user_id=?','i',[$id]);
    if (!$row) return ['exists'=>false,'save'=>null,'revision'=>0];
    $game=json_decode($row['game_state'],true);$character=json_decode($row['character_data'],true);
    if (!is_array($game)||!is_array($character)) cl_fail('Saved game data is corrupted',500);
    return ['exists'=>true,'save'=>['game'=>$game,'character'=>$character],'revision'=>(int)$row['revision'],'updated_at'=>$row['updated_at'],'created_at'=>$row['created_at']];
}
if ($method==='GET') {
    $picture=is_string($auth['user_picture']??null)?trim($auth['user_picture']):'';
    $avatar=null;
    if($picture!==''&&!preg_match('~(?:blank_profile|default-avatar)~i',$picture)){
        $url=function_exists('fix_url')?fix_url($picture):(preg_match('~^https?://~i',$picture)?$picture:'https://s3.ap-northeast-1.wasabisys.com/hafriksocial/uploads/'.preg_replace('~^uploads/~','',ltrim($picture,'/')));
        if(is_string($url)&&filter_var($url,FILTER_VALIDATE_URL)&&strtolower(parse_url($url,PHP_URL_SCHEME)??'')==='https'&&!parse_url($url,PHP_URL_USER)&&!parse_url($url,PHP_URL_PASS))$avatar=$url;
    }
    json_response('success',cl_save_result($uid)+['account'=>['id'=>(string)$uid,'username'=>$auth['user_name']??'Hafrik user','avatar'=>$avatar,'gender'=>cl_profile_gender($uid)]]);
}
if ($method==='DELETE') {
    cl_run('DELETE FROM chinalife_economy_actions WHERE user_id=?','i',[$uid]);
    cl_run('DELETE FROM chinalife_balances WHERE user_id=?','i',[$uid]);
    cl_run('DELETE FROM chinalife_saves WHERE user_id=?','i',[$uid]);json_response('success',['deleted'=>true]);
}
cl_rate('save',15,10);$input=cl_body(1048576);$save=$input['save']??null;$revision=$input['revision']??0;
if (!is_int($revision)||$revision<0||!is_array($save)) cl_fail('Invalid save revision or payload');
$game=$save['game']??null;$character=$save['character']??null;
if (!is_array($game)||($game['created']??false)!==true||!is_array($character)) cl_fail('Invalid character save');
// The in-game name is always the player's Hafrik username.
$username=trim((string)($auth['user_name']??''));
if ($username===''||mb_strlen($username)>64) cl_fail('Your Hafrik account needs a username');
$game['name']=$username;$character['name']=$username;
cl_room($game);
if(!in_array($game['gender']??null,[null,'male','female'],true))cl_fail('Choose a valid gender');
// A save without a game gender takes the Hafrik profile gender, so a male account always gets a male character.
if(($game['gender']??null)===null){$pg=cl_profile_gender($uid);if($pg!==null)$game['gender']=$pg;}
foreach (['money','xp','day','hour'] as $key) if (!is_numeric($game[$key]??null)||!is_finite((float)$game[$key])) cl_fail('Invalid character save');
foreach (['energy','hunger','hygiene','bladder','fun','social'] as $key) if (!is_numeric($game['needs'][$key]??null)||$game['needs'][$key]<0||$game['needs'][$key]>100) cl_fail('Invalid character needs');
$stored=cl_one('SELECT game_state,TIMESTAMPDIFF(SECOND,updated_at,NOW()) elapsed FROM chinalife_saves WHERE user_id=?','i',[$uid]);
$storedGame=$stored?json_decode($stored['game_state'],true):[];
if(!$stored&&!in_array($game['city'],cl_open_cities(),true))cl_fail('Choose an available starting city',403);
// Daily rewards are awarded by daily.php, never by an uploaded save.
$game['lastVisit']=$storedGame['lastVisit']??'';$game['streak']=$storedGame['streak']??0;
// Attendance, university progress and the student allowance are written only by their endpoints; a device save keeps them.
foreach(['attendance','university','allowance'] as $key){if(isset($storedGame[$key]))$game[$key]=$storedGame[$key];else unset($game[$key]);}
// Advance the saved day only at Beijing midnight, using the stored calendar anchor.
$clockDay=intdiv(time()+8*3600,86400);$anchor=(int)($storedGame['chinaDay']??$clockDay);if($anchor<=0||$anchor>$clockDay)$anchor=$clockDay;
$game['day']=$stored?(int)($storedGame['day']??1)+max(0,$clockDay-$anchor):1;
$game['chinaDay']=$clockDay;$game['hour']=intdiv(time()+8*3600,60)%1440;

if(($game['transferTotal']??0)!==($storedGame['transferTotal']??0)) {http_response_code(409);json_response('error',cl_save_result($uid),'Refresh your money transfers before saving.');}
if(($game['sharedXP']??0)!==($storedGame['sharedXP']??0)){http_response_code(409);json_response('error',cl_save_result($uid),'Refresh shared activity rewards before saving.');}
// Coins and XP live in the server ledger (chinalife_balances). Server actions (jobs, missions, purchases,
// transfers, weekly/daily/life rewards) move the ledger directly. Earnings that still happen on the device
// are accepted on save only within the existing real-time cap, measured from the ledger, so an edited save
// cannot inflate coins. Spending on the device lowers the ledger.
$db->begin_transaction();
if ($stored) {
    $bal=cl_balances_lock($uid);
    $minutes=max(0,(int)$stored['elapsed'])/60;
    $coinCap=$bal['coins']+20000+600*$minutes;$xpCap=$bal['xp']+300+30*$minutes;
    // Device earnings are capped per rolling hour, not per save, so repeated saves cannot each add ¥20,000.
    $recent=cl_one("SELECT COALESCE(SUM(coins),0) n FROM chinalife_economy_actions WHERE user_id=? AND action='device' AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)",'i',[$uid]);
    $room=max(0,20000-(int)($recent['n']??0));$coinCap=min($coinCap,$bal['coins']+$room);
    $money=(int)floor(min((float)$game['money'],$coinCap));
    if ($money>$bal['coins']) cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,0,NOW())','issi',[$uid,'device','device:'.microtime(true).':'.random_int(0,999999),$money-$bal['coins']]);$xp=(int)floor(min((float)$game['xp'],$xpCap));
    if ($money<-10000000) $money=-10000000;
    if ($xp<$bal['xp']) $xp=$bal['xp'];
    $ranks=cl_ranks();$reached=0;foreach ($ranks as $i=>$r) if ($xp>=(int)$r['xp']) $reached=$i;
    $game['rankClaimed']=max((int)($storedGame['rankClaimed']??0),min((int)($game['rankClaimed']??0),$reached));
    $game['money']=$money;$game['xp']=$xp;
} else {
    $money=(int)$game['money'];$xp=(int)$game['xp'];
    if ($money<0||$money>5000) $money=3200;
    if ($xp!==0) $xp=0;
    $game['money']=$money;$game['xp']=$xp;$game['rankClaimed']=0;
}
// Wardrobe locks (switch wardrobe_locks): no locked item before its milestone (wardrobe-locks.php).
$features=cl_hafrik_features();if(!empty($features['wardrobe_locks'])){require_once __DIR__.'/wardrobe-locks.php';$game=cl_wardrobe_enforce($game,$storedGame,$features);}
// Micro-customization details (micro-style.php): cleaned on every save; rare options need their milestone while
// micro_style is on, unless the item already had that option.
if(is_array($game['wardrobe']??null)){require_once __DIR__.'/micro-style.php';$allowed=null;
 if(!empty($features['micro_style'])){require_once __DIR__.'/wardrobe-locks.php';[$met,$student]=cl_wardrobe_met($game,$storedGame,$features);$rare=cl_micro_lists()['rare'];$prev=$storedGame['wardrobe']['details']??[];
  $allowed=fn($k,$v,$id)=>!isset($rare[$k.':'.$v])||(($prev[$id][$k]??null)===$v)||$met($rare[$k.':'.$v][$student?0:1]);}
 $game['wardrobe']['details']=cl_micro_clean($game['wardrobe']['details']??[],is_array($game['wardrobe']['owned']??null)?$game['wardrobe']['owned']:[],$allowed);}
$gameJson=json_encode($game,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);$characterJson=json_encode($character,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
if ($revision===0) $changed=cl_run('INSERT IGNORE INTO chinalife_saves(user_id,character_data,game_state,revision,created_at,updated_at) VALUES(?,?,?,1,NOW(),NOW())','iss',[$uid,$characterJson,$gameJson]);
else $changed=cl_run('UPDATE chinalife_saves SET character_data=?,game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=? AND revision=?','ssii',[$characterJson,$gameJson,$uid,$revision]);
if (!$changed) {http_response_code(409);json_response('error',cl_save_result($uid),'A newer account save exists. Load it before saving again.');}
if ($stored) cl_balance_write($uid,(int)$game['money'],(int)$game['xp']);
if ($revision===0) {
    cl_run('DELETE FROM chinalife_economy_actions WHERE user_id=?','i',[$uid]);
    cl_run('INSERT INTO chinalife_balances(user_id,coins,xp,updated_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE coins=VALUES(coins),xp=VALUES(xp),updated_at=NOW()','iii',[$uid,(int)$game['money'],(int)$game['xp']]);
}
$db->commit();
json_response('success',['saved'=>true,'revision'=>$revision+1,'user_id'=>(string)$uid,'money'=>(int)$game['money'],'xp'=>(int)$game['xp'],'rankClaimed'=>(int)($game['rankClaimed']??0)]);
