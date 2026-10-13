<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);

$jobs=[
    'cafe-job'=>['place'=>'cafe','base'=>160,'xp'=>25],
    'teacher'=>['place'=>'ef','base'=>260,'xp'=>25],
    'content'=>['place'=>'business','base'=>340,'xp'=>25],
    'designer'=>['place'=>'business','base'=>520,'xp'=>25],
    'sales'=>['place'=>'mall','base'=>430,'xp'=>25],
    'coach'=>['place'=>'gym','base'=>300,'xp'=>25],
    'delivery'=>['place'=>'market','base'=>220,'xp'=>25],
    'translator'=>['place'=>'business','base'=>600,'xp'=>25],
    'roach-farmer'=>['place'=>'roachfarm','base'=>280,'xp'=>25],
    'roach-manager'=>['place'=>'roachfarm','base'=>480,'xp'=>25],
    'jianbing'=>['place'=>'market','base'=>240,'xp'=>25],
    'square-dance'=>['place'=>'park','base'=>210,'xp'=>25],
];
$clubs=['night','youle','ex','rex','orangutan','taxi-club','best-one','cats-eye','silver-knight','blood','skylight','kama','partypier','hooleys','suns'];
$missions=['entry','soft','vibe','dance','work'];
$store=[
    'tee-basic'=>80,'tank-sport'=>90,'tee-graphic'=>180,'shirt-oxford'=>260,'hoodie'=>320,'sweater-knit'=>420,'jacket-denim'=>520,'dress-summer'=>560,'jacket-varsity'=>680,'qipao-silk'=>1800,'jacket-leather'=>2400,'suit-tailored'=>6800,'gown-evening'=>9800,
    'shorts'=>150,'joggers'=>200,'jeans'=>240,'skirt-pleated'=>260,'chinos'=>280,'trousers-suit'=>1600,
    'slides'=>90,'canvas'=>180,'runners'=>560,'boots'=>980,'leather-white'=>1200,'loafers'=>1500,'heels'=>1800,'designer-sneakers'=>6500,
    'beanie'=>110,'cap'=>120,'glasses'=>300,'backpack'=>420,'sunglasses'=>480,'headphones'=>1100,'watch'=>1800,'chain'=>5800,'handbag'=>22000,'luxwatch'=>38000,
    'scooter'=>3800,'hatchback'=>68000,'sedan'=>85000,'suv'=>260000,'sports'=>880000,'limo'=>1800000,
];
$furniture=['toilet'=>350,'shower'=>800,'fan'=>180,'bed'=>450,'kitchen'=>280,'desk'=>650,'sofa'=>520,'bookshelf'=>320,'lamp'=>140,'rug'=>180,'plant'=>95,'tv'=>1200,'dining'=>900,'gaming'=>2800,'piano'=>6500,'aquarium'=>1800,'safe'=>12000,'art'=>240];
$homes=['penthouse'=>850000,'mansion'=>2500000,'apartment'=>6500,'townhouse'=>18000,'villa'=>42000];

if ($method==='GET') {
    $row=cl_one('SELECT coins,xp FROM chinalife_balances WHERE user_id=?','i',[$uid]);
    json_response('success',['money'=>(int)($row['coins']??0),'xp'=>(int)($row['xp']??0)]);
}

cl_rate('economy',30,60);
$input=cl_body();
$action=(string)($input['action']??'');
if (!in_array($action,['job','mission','purchase','accident','club-drink','club-spray','school'],true)) cl_fail('Choose a job, mission or purchase');
// v9: ChampagnePappi's bar in 007 Club. Price and XP live here only; one drink per 90 s, XP for the first 8 a day.
$clubDrinks=['pappi-fizz'=>[120,10],'gold-rush'=>[300,25],'zero-proof'=>[40,5],'water'=>[0,0]];

function economy_here(): array {
    global $uid;
    $row=cl_one('SELECT city,place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','i',[$uid]);
    if (!$row) cl_fail('Join this venue first',403);
    return [$row['city'], explode('@',$row['place'])[0]];
}
function economy_seen(string $action, string $ref): bool {
    global $uid;
    return cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action=? AND ref=?','iss',[$uid,$action,$ref])!==null;
}
function economy_note(string $action, string $ref, int $coins, int $xp): void {
    global $uid;
    cl_run('INSERT INTO chinalife_economy_actions(user_id,action,ref,coins,xp,created_at) VALUES(?,?,?,?,?,NOW())','issii',[$uid,$action,$ref,$coins,$xp]);
}
function economy_totals(array $game): array {
    global $uid;
    $bal=cl_balances_lock($uid);
    return ['money'=>$bal['coins'],'xp'=>$bal['xp'],'awarded'=>0,'awardedXp'=>0,'rankClaimed'=>(int)($game['rankClaimed']??0),'duplicate'=>true,'bonus'=>false];
}

$day=cl_beijing_day();
$db->begin_transaction();
try {
    $game=cl_lock_character($uid);
    // Street accident: ambulance ¥300 + treatment ¥500 = ¥800, taken from the server ledger and never below ¥0.
    // One accident per 10 minutes; a repeat inside the cooldown is free (the player is still recovering).
    if ($action==='accident') {
        $walk=cl_optional_rows('SELECT city FROM chinalife_presence WHERE user_id=? AND street_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND)','i',[$uid]);
        if (!$walk) cl_fail('Accidents only happen on the street',403);
        if (cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="accident" AND created_at>=DATE_SUB(NOW(),INTERVAL 10 MINUTE)','i',[$uid])) {$totals=economy_totals($game);$db->commit();json_response('success',$totals+['charged'=>0,'cooldown'=>true],'Still recovering.');}
        $held=cl_balances_lock($uid);$fee=max(0,min(800,$held['coins']));
        $moved=cl_move_totals($uid,$game,-$fee,0);
        economy_note('accident','accident:'.time(),-$fee,0);
        cl_store_totals($uid,$game);
        $db->commit();
        json_response('success',$moved+['charged'=>$fee,'ambulance'=>min(300,$fee),'treatment'=>$fee-min(300,$fee),'cooldown'=>false,'duplicate'=>false,'bonus'=>false],'Treated at the hospital.');
    }
    // v10: school day. Class: once per subject a day, at a classroom. Homework: once a day, anywhere.
    // Exam: once per ISO week, at a classroom. Client scores only pick the tier; the caps keep it cheap.
    if ($action==='school') {
        $kind=(string)($input['kind']??'');$subject=(string)($input['subject']??'');$score=max(0,min(100,(int)($input['score']??0)));
        if (!in_array($kind,['class','homework','exam'],true)) cl_fail('Choose a class, homework or the exam');
        if ($kind==='class' && !in_array($subject,['tones','vocab','characters','dialogues','review'],true)) cl_fail('Choose a class');
        if ($kind!=='homework') {
            [, $here]=economy_here();
            $rooms=['campus','ef','university','liaoning','dongbei','academy','medical','aerospace','technology','normal','ligong','jianzhu','agricultural','pharmaceutical','chemical','tcm','medical-college','engineering','gafa','gdpu','gdufe','gdufs','gdut','gmu','gzhu','gzsport','gzucm','scau','scnu','smu'];
            if (!in_array($here,$rooms,true)) cl_fail('Go to a classroom first',403);
        }
        $bj=new DateTime('now',new DateTimeZone('Asia/Shanghai'));
        $ref=$kind==='exam'?'school:exam:'.$bj->format('o-\WW'):'school:'.$kind.':'.($kind==='class'?$subject:'hw').':'.$day;
        if (economy_seen('school',$ref)) {$totals=economy_totals($game);$db->commit();json_response('success',$totals,'Already recorded.');}
        if ($kind==='class') {$coins=$score>=60?40:0;$xp=$score>=60?15:5;}
        elseif ($kind==='homework') {$coins=$score>=60?80:0;$xp=$score>=60?25:5;}
        else {[$coins,$xp]=$score>=90?[800,120]:($score>=75?[500,90]:($score>=60?[300,60]:[0,20]));}
        $moved=cl_move_totals($uid,$game,$coins,$xp);
        economy_note('school',$ref,$moved['awarded'],$xp);
        cl_store_totals($uid,$game);
        $db->commit();
        json_response('success',$moved+['duplicate'=>false,'bonus'=>false],'Recorded.');
    }
    // v10: money spray in any club. A coin sink (no XP); one every 20 s and ¥20,000 a Beijing day.
    if ($action==='club-spray') {
        $amount=(int)($input['amount']??0);
        if (!in_array($amount,[100,500,2000],true)) cl_fail('Choose a spray amount');
        [$sprayCity, $here]=economy_here();
        if (!in_array($here,$clubs,true)) cl_fail('Spray money inside a club',403);
        if (cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="club-spray" AND created_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','i',[$uid])) {$totals=economy_totals($game);$db->commit();json_response('success',$totals+['cooldown'=>true],'One spray every 20 seconds.');}
        $spent=cl_one('SELECT COALESCE(-SUM(coins),0) n FROM chinalife_economy_actions WHERE user_id=? AND action="club-spray" AND ref LIKE ?','is',[$uid,'club-spray:%:'.$day]);
        if ((int)($spent['n']??0)+$amount>20000) cl_fail('Daily spray limit reached (¥20,000)',429);
        $held=cl_balances_lock($uid);
        if ($held['coins']<$amount) cl_fail('Not enough money',409);
        $moved=cl_move_totals($uid,$game,-$amount,0);
        economy_note('club-spray','club-spray:'.$here.':'.bin2hex(random_bytes(4)).':'.$day,-$amount,0);
        $room=cl_one('SELECT city,place FROM chinalife_presence WHERE user_id=?','i',[$uid]);if($room)cl_run('INSERT INTO chinalife_gestures(sender_id,target_id,city,place,phrase) VALUES(?,?,?,?,"spray")','iiss',[$uid,$uid,$room['city'],$room['place']]);
        cl_store_totals($uid,$game);
        $db->commit();
        json_response('success',$moved+['cooldown'=>false,'duplicate'=>false,'bonus'=>false],'Money rain!');
    }
    if ($action==='club-drink') {
        $sku=(string)($input['sku']??'');
        if (!isset($clubDrinks[$sku])) cl_fail('That drink is not on the menu');
        [, $here]=economy_here();
        if ($here!=='night') cl_fail('Order at 007 Club',403);
        if (cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="club-drink" AND created_at>=DATE_SUB(NOW(),INTERVAL 90 SECOND)','i',[$uid])) {$totals=economy_totals($game);$db->commit();json_response('success',$totals+['cooldown'=>true],'One drink every 90 seconds.');}
        [$price,$xp]=$clubDrinks[$sku];
        $held=cl_balances_lock($uid);
        if ($held['coins']<$price) cl_fail('Not enough money',409);
        $today=cl_one('SELECT COUNT(*) n FROM chinalife_economy_actions WHERE user_id=? AND action="club-drink" AND xp>0 AND ref LIKE ?','is',[$uid,'club-drink:%:'.$day]);
        if ((int)($today['n']??0)>=8) $xp=0;
        $moved=cl_move_totals($uid,$game,-$price,$xp);
        economy_note('club-drink','club-drink:'.$sku.':'.bin2hex(random_bytes(4)).':'.$day,-$price,$xp);
        cl_store_totals($uid,$game);
        $db->commit();
        json_response('success',$moved+['cooldown'=>false,'duplicate'=>false,'bonus'=>false],'Served.');
    }
    if ($action==='job') {
        $job=(string)($input['job']??'');
        $style=($input['style']??'')==='focus'?'focus':'steady';
        if ($job==='studio-order') {
            $level=(int)($game['business']['level']??0);
            if ($level<1||$level>3) cl_fail('Open your studio before taking an order',409);
            $place='business';$pay=180+$level*90;$xp=30;
        } else {
            if (!isset($jobs[$job])) cl_fail('Choose a real job');
            if (($game['job']??'')!==$job) cl_fail('That is not your current job',409);
            $place=$jobs[$job]['place'];$xp=$jobs[$job]['xp'];
            $promotion=(int)($game['promotion']??1);if ($promotion<1||$promotion>5) $promotion=1;
            $pay=(int)round($jobs[$job]['base']*(1+($promotion-1)*0.15)*($style==='focus'?1.15:1));
        }
        [, $here]=economy_here();
        if ($here!==$place) cl_fail('Be at work to record this shift',403);
        $ref='job:'.$job.':'.$day;
        if (economy_seen('job',$ref)) {$totals=economy_totals($game);$db->commit();json_response('success',$totals,'Already recorded today.');}
        $moved=cl_move_totals($uid,$game,$pay,$xp);
        economy_note('job',$ref,$moved['awarded'],$xp);
        cl_store_totals($uid,$game);
        $db->commit();
        json_response('success',$moved+['duplicate'=>false,'bonus'=>false],'Shift recorded.');
    }
    if ($action==='mission') {
        $key=(string)($input['key']??'');
        if (!in_array($key,$missions,true)) cl_fail('Choose a night mission');
        [, $here]=economy_here();
        if (!in_array($here,$clubs,true)) cl_fail('Night missions are recorded at a club',403);
        $ref='mission:'.$key.':'.$day;
        if (economy_seen('mission',$ref)) {$totals=economy_totals($game);$db->commit();json_response('success',$totals);}
        economy_note('mission',$ref,0,0);
        $rows=cl_rows('SELECT ref FROM chinalife_economy_actions WHERE user_id=? AND action="mission" AND ref LIKE ?','is',[$uid,'mission:%:'.$day]);
        $done=[];
        foreach ($rows as $row) if (preg_match('/^mission:([a-z]+):/',$row['ref'],$m) && $m[1]!=='bonus') $done[$m[1]]=true;
        $held=cl_balances_lock($uid);
        $bonus=false;$moved=['money'=>$held['coins'],'xp'=>$held['xp'],'awarded'=>0,'awardedXp'=>0,'rankClaimed'=>(int)($game['rankClaimed']??0)];
        if (count(array_intersect_key(array_flip($missions),$done))===count($missions) && !economy_seen('mission','mission:bonus:'.$day)) {
            $moved=cl_move_totals($uid,$game,500,100);
            economy_note('mission','mission:bonus:'.$day,$moved['awarded'],100);
            cl_store_totals($uid,$game);
            $bonus=true;
        }
        $db->commit();
        json_response('success',$moved+['duplicate'=>false,'bonus'=>$bonus],$bonus?'Night missions complete.':'Mission recorded.');
    }
    $sku=(string)($input['sku']??'');
    if ($sku===''||strlen($sku)>80) cl_fail('Choose something to buy');
    $price=0;$gain=0;$ref=$sku;$placeNeed=null;
    if ($sku==='club-entry') {$price=60;$placeNeed=(string)($input['place']??'');$ref='club-entry:'.$placeNeed.':'.$day;}
    elseif ($sku==='vip-night') {$price=500;$placeNeed=(string)($input['place']??'');$ref='vip-night:'.$placeNeed.':'.$day;}
    elseif ($sku==='vip-member') {$price=3000;$ref='vip-member:'.$day;if (cl_one('SELECT id FROM chinalife_economy_actions WHERE user_id=? AND action="purchase" AND ref LIKE "vip-member:%" AND created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) AND ref<>?','is',[$uid,$ref])) cl_fail('Your VIP membership is still active',409);}
    elseif ($sku==='private-room') {$price=1500;$placeNeed=(string)($input['place']??'');$ref='private-room:'.$placeNeed.':'.$day;}
    elseif ($sku==='dance-entry') {$price=50;$placeNeed=(string)($input['place']??'');$ref='dance-entry:'.$day;}
    elseif ($sku==='studio-open') {$price=900;$ref='studio-open';}
    elseif (preg_match('/^club-owner:([a-z0-9-]+)$/',$sku,$m)) {$price=800000;$gain=200;$placeNeed=$m[1];$ref=$sku;}
    elseif (preg_match('/^store:([a-z0-9-]+)$/',$sku,$m) && isset($store[$m[1]])) {$price=$store[$m[1]];$gain=min(200,(int)round($price/500));}
    elseif (preg_match('/^furniture:([a-z0-9-]+)$/',$sku,$m) && isset($furniture[$m[1]])) {$price=$furniture[$m[1]];}
    elseif (preg_match('/^home:([A-Za-z]+):([a-z0-9-]+)$/',$sku,$m) && isset($homes[$m[2]]) && in_array($m[1],['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true)) {$price=$homes[$m[2]];}
    else cl_fail('That item is not for sale');
    if ($placeNeed!==null) {
        if (!in_array($placeNeed,$clubs,true)) cl_fail('Choose a club');
        [, $here]=economy_here();
        if ($here!==$placeNeed) cl_fail('Be at the club to buy this',403);
    }
    if (economy_seen('purchase',$ref)) {$totals=economy_totals($game);$db->commit();json_response('success',$totals,'Already bought.');}
    $held=cl_balances_lock($uid);
    if ($price>0 && $held['coins']<$price) cl_fail('Not enough money',409);
    $moved=cl_move_totals($uid,$game,-$price,$gain);
    economy_note('purchase',$ref,-$price,$gain);
    cl_store_totals($uid,$game);
    $db->commit();
    json_response('success',$moved+['duplicate'=>false,'bonus'=>false],'Purchase recorded.');
} catch (Throwable $e) {
    $db->rollback();
    throw $e;
}
