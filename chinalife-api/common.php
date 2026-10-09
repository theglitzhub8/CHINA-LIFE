<?php
declare(strict_types=1);
// Browser SSO may send Hafrik cookies from the trusted game subdomain.
// Credentialed CORS requires an exact origin, never a wildcard.
$clOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$clCookieOrigin = in_array($clOrigin, ['https://china-life.hafrik.com','https://hafrik.com','https://www.hafrik.com'], true);
function cl_browser_cors(): void {
    if (!$GLOBALS['clCookieOrigin']) return;
    header('Access-Control-Allow-Origin: ' . $GLOBALS['clOrigin']);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With, X-Session-Token');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Vary: Origin');
}
cl_browser_cors();
if ($clCookieOrigin && strtoupper($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204); exit;
}
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
// Shared Hafrik bootstrap may have supplied its own wildcard CORS headers.
cl_browser_cors();
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
set_exception_handler(function(Throwable $error): void {
    error_log('ChinaLife API: ' . $error->getMessage());
    http_response_code(503);
    json_response('error', null, 'ChinaLife service is temporarily unavailable');
});
$db = get_db_connection();
$auth = auth_user($db);
$uid = (int)($auth['user_id'] ?? 0);
if ($uid <= 0) cl_fail('Unauthorized', 401);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
function cl_fail(string $message, int $status = 400): never {
    http_response_code($status); json_response('error', null, $message); exit;
}
function cl_methods(array $allowed): void {
    if (!in_array($GLOBALS['method'], $allowed, true)) {
        header('Allow: ' . implode(', ', array_merge($allowed, ['OPTIONS'])));
        cl_fail('Method not allowed', 405);
    }
}
function cl_body(int $limit = 100000): array {
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) cl_fail('Expected JSON', 415);
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false || strlen($raw) > $limit) cl_fail('Request is too large', 413);
    $value = json_decode($raw);
    if (!is_object($value)) cl_fail('Expected a JSON object');
    return json_decode($raw, true);
}
function cl_query(string $sql, string $types = '', array $values = []): mysqli_stmt {
    global $db;
    $statement = $db->prepare($sql);
    if ($types !== '') $statement->bind_param($types, ...$values);
    $statement->execute(); return $statement;
}
function cl_rows(string $sql, string $types = '', array $values = []): array {
    $statement = cl_query($sql, $types, $values);
    $rows = $statement->get_result()->fetch_all(MYSQLI_ASSOC); $statement->close(); return $rows;
}
function cl_one(string $sql, string $types = '', array $values = []): ?array {return cl_rows($sql, $types, $values)[0] ?? null;}
function cl_run(string $sql, string $types = '', array $values = []): int {
    $statement = cl_query($sql, $types, $values); $changed = $statement->affected_rows; $statement->close(); return $changed;
}
function cl_room(array $input): array {
    $cities = ['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'];
    $places = ['home','ef','cafe','market','campus','gym','business','mall','park','night','station','african','church','plaza','gist','airport','university','liaoning','dongbei','blood','skylight','academy','hotel','palace','zhongjie','medical','aerospace','technology','normal','ligong','jianzhu','agricultural','pharmaceutical','chemical','tcm','medical-college','engineering','youle','ex','rex','orangutan','taxi-club','best-one','cats-eye','silver-knight','black-sheep','tank','home-campus','home-nanhu','home-hunnan','home-river','home-mansion','cantontower','cantonfair','baima','consulates','hospital','shamian','beijingroad','kama','partypier','bingsheng','bosphorus','gdufs','scnu','gzhu','smu','scau','gmu','gdut','gzucm','gdufe','gdpu','gafa','gzsport','hooleys','suns','tigerprawn','gzrestaurant','rosewood','ritz','shangrila','langham','grandview','parccentral','teemall','k11','shahe','guihuagang','baiyunmountain','chenclan','chimelong','sysmemorial','pearlcruise','polyexpo','sourcing','gzeast','gzrailway','baiyunstation','provincial','unitedfamily','gmuhospital','nanfang','haizhulake','tianhepark','liwanlake','childrenspark','ersha'];
    $city = $input['city'] ?? ''; $place = $input['place'] ?? '';
    if (!in_array($city, $cities, true) || !in_array($place, $places, true)) cl_fail('Choose a valid city and venue');
    return [$city, $place];
}
// Private residence instances are derived from authentication, never a client-supplied owner.
function cl_private_place(string $place): bool {return $place==='home'||str_starts_with($place,'home-')||str_starts_with($place,'home@');}
function cl_scoped_room(array $input): array {global $uid;[$city,$place]=cl_room($input);if(!cl_private_place($place))return [$city,$place];$owner=$uid;if(isset($input['homeOwner'])&&(string)$input['homeOwner']!==(string)$uid){$owner=filter_var($input['homeOwner'],FILTER_VALIDATE_INT);if(!$owner||!cl_one('SELECT id FROM chinalife_home_visits WHERE owner_id=? AND guest_id=? AND city=? AND place=? AND status="accepted" AND expires_at>NOW()','iiss',[$owner,$uid,$city,$place])||!cl_friends($owner,$uid)||cl_blocked($owner,$uid))cl_fail('This home invitation is unavailable',403);}return [$city,$place.'@'.$owner];}
function cl_presence(int $userId, string $city, string $place): void {
    if(cl_private_place($place)&&str_contains($place,'@')){[$base,$owner]=explode('@',$place,2);if((int)$owner!==$userId&&(!cl_friends((int)$owner,$userId)||cl_blocked((int)$owner,$userId)||!cl_one('SELECT id FROM chinalife_home_visits WHERE owner_id=? AND guest_id=? AND city=? AND place=? AND status="accepted" AND expires_at>NOW()','iiss',[(int)$owner,$userId,$city,$base])))cl_fail('This home invitation ended',403);}
    if (!cl_one('SELECT user_id FROM chinalife_presence WHERE user_id=? AND city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)', 'iss', [$userId,$city,$place])) cl_fail('Join this venue first', 403);
}
function cl_peer(mixed $value): int {
    if ((!is_string($value) && !is_int($value)) || !preg_match('/^[1-9][0-9]{0,18}$/', (string)$value)) cl_fail('Choose a valid player');
    $peer = (int)$value;
    if ($peer === $GLOBALS['uid'] || !cl_one('SELECT user_id FROM users WHERE user_id=?', 'i', [$peer])) cl_fail('Player unavailable', 404);
    return $peer;
}
// Quick phrases players can send each other (see gestures.php); the text for each lives in social.js.
function cl_gesture_phrases(): array {return ['hello','mic','how','friends','dance','drink','thanks','where','nice','bye'];}
function cl_blocked(int $a, int $b): bool {
    return cl_one('SELECT owner_id FROM chinalife_blocks WHERE (owner_id=? AND peer_id=?) OR (owner_id=? AND peer_id=?)', 'iiii', [$a,$b,$b,$a]) !== null;
}
function cl_pair(int $a, int $b): array {return [min($a,$b),max($a,$b)];}
function cl_friends(int $a, int $b): bool {
    return cl_one("SELECT first_id FROM chinalife_friends WHERE first_id=? AND second_id=? AND status='accepted'", 'ii', cl_pair($a,$b)) !== null;
}
function cl_session(mixed $value): string {
    if (!is_string($value) || !preg_match('/^[a-zA-Z0-9-]{8,80}$/', $value)) cl_fail('Invalid voice session'); return $value;
}
function cl_voice(int $id, string $session, string $city, string $place, bool $self=true): void {
    cl_presence($id,$city,$place);
    if (!cl_one('SELECT user_id FROM chinalife_voice_members WHERE user_id=? AND session=? AND city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND)', 'isss', [$id,$session,$city,$place])) {
        // One voice connection per account: if another device or tab took it, say so, so this one stops instead of fighting back.
        if ($self&&cl_one('SELECT user_id FROM chinalife_voice_members WHERE user_id=? AND session<>? AND seen_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND)', 'is', [$id,$session])) cl_fail('Voice moved to your other device', 409);
        cl_fail('Voice session expired. Join again', 403);
    }
}
// Atomic per-account limits serialize concurrent requests without relying on client timers.
function cl_rate(string $kind, int $limit, int $seconds): void {
    global $uid;
    $bucket = intdiv(time(), $seconds);
    cl_run('INSERT INTO chinalife_rate_limits(user_id,kind,bucket,hits) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE hits=IF(bucket=VALUES(bucket),hits+1,1),bucket=VALUES(bucket)', 'isi', [$uid,$kind,$bucket]);
    $row = cl_one('SELECT hits FROM chinalife_rate_limits WHERE user_id=? AND kind=?', 'is', [$uid,$kind]);
    if ((int)$row['hits'] > $limit) cl_fail('Too many requests. Wait a few seconds', 429);
}
function cl_message_access(array $row): void {
    global $uid;
    $sender = (int)$row['sender_id']; $recipient = isset($row['recipient_id']) ? (int)$row['recipient_id'] : null;
    if ($recipient !== null) {
        if (!in_array($uid,[$sender,$recipient],true) || !cl_friends($sender,$recipient) || cl_blocked($sender,$recipient)) cl_fail('Message unavailable',404);
    } else {cl_presence($uid,$row['city'],$row['place']); if (cl_blocked($uid,$sender)) cl_fail('Message unavailable',404);}
}

// Product admins plus optional additional usernames in the server-only admin-config.php.
function cl_is_admin(): bool {
    global $auth;
    $config=is_file(__DIR__.'/admin-config.php')?require __DIR__.'/admin-config.php':[];
    $admins=array_map('strtolower',array_merge(['hafrik','horlaarsman'],(array)($config['usernames']??[])));
    return in_array(strtolower((string)($auth['user_name']??'')),$admins,true);
}
function cl_admin(): void {if (!cl_is_admin()) cl_fail('Admin only',403);}
// Adds money to a saved character the same way transfers do, so an open game picks it up.
// Call inside a transaction.
function cl_credit(int $userId, int $amount): int {
    $row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$userId]);
    if (!$row) cl_fail('That player has no saved character yet',404);
    $game=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);
    $money=(int)($game['money']??0)+$amount;
    if ($money>1000000000||$money<-10000000) cl_fail('That would put the balance out of range',409);
    $game['money']=$money;$game['transferTotal']=(int)($game['transferTotal']??0)+$amount;
    cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($game,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$userId]);
    return $money;
}
// Cities players can travel to; Shenyang is always open. Admins change the list from the panel.
function cl_open_cities(): array {
    $row=cl_one("SELECT value FROM chinalife_settings WHERE name='open_cities'");
    $list=$row?json_decode($row['value'],true):null;
    return array_values(array_unique(array_merge(['Shenyang'],is_array($list)?$list:[])));
}
// Player ranks (XP ladder) are configured by admins. They are game status only and never grant admin access.
function cl_default_ranks(): array {
    $list=[[0,'Newcomer','🌱'],[200,'Explorer','🧭'],[600,'Local','🏮'],[1500,'Regular','⭐'],[3500,'Insider','💎'],[7000,'Shenyang Star','🌟'],[12000,'Legend','👑']];
    return array_map(fn($r,$i)=>['xp'=>$r[0],'name'=>$r[1],'icon'=>$r[2],'reward'=>$i*500],$list,array_keys($list));
}
function cl_valid_ranks($list): ?array {
    if (!is_array($list)||count($list)<2||count($list)>12) return null;$out=[];
    foreach (array_values($list) as $i=>$r) {
        $xp=$r['xp']??null;$reward=$r['reward']??null;$name=trim((string)($r['name']??''));$icon=trim((string)($r['icon']??''));
        if (!is_int($xp)||$xp<0||$xp>10000000||($i===0&&$xp!==0)||($i>0&&$xp<=$out[$i-1]['xp'])) return null;
        if (!is_int($reward)||$reward<0||$reward>1000000||$name===''||mb_strlen($name)>30||$icon===''||mb_strlen($icon)>8) return null;
        $out[]=['xp'=>$xp,'name'=>$name,'icon'=>$icon,'reward'=>$i?$reward:0];
    }
    return $out;
}
function cl_ranks(): array {
    $row=cl_one("SELECT value FROM chinalife_settings WHERE name='ranks'");
    return ($row?cl_valid_ranks(json_decode($row['value'],true)):null)??cl_default_ranks();
}
// Partner restaurants are added by admins per city. Ordering opens their own WeChat, WhatsApp or order link.
function cl_restaurants(string $city, bool $all=false): array {
    $rows=cl_rows('SELECT r.id,r.city,r.name,r.icon,r.district,r.description,r.menu,r.order_link,r.wechat_id,r.whatsapp,r.active,r.kind,r.photos,r.links,COALESCE(p.near,\'\') near FROM chinalife_restaurants r LEFT JOIN chinalife_restaurant_places p ON p.restaurant_id=r.id WHERE r.city=?'.($all?'':' AND r.active=1').' ORDER BY r.name LIMIT 200','s',[$city]);
    foreach ($rows as &$r) {$r['id']=(string)$r['id'];$r['kind']=$r['kind']?:'restaurant';$r['photos']=json_decode((string)($r['photos']??''),true)?:[];$r['links']=json_decode((string)($r['links']??''),true)?:[];$r['menu']=json_decode($r['menu'],true)?:[];$r['active']=(bool)$r['active'];}unset($r);
    return $rows;
}
// Paid ads shown on venue walls: live ads for one city (or all cities). Images are served by ad-image.php.
function cl_ads(string $city, bool $all=false): array {
    $rows=cl_rows('SELECT id,title,sponsor,city,place,link,width,height,active,UNIX_TIMESTAMP(starts_at)*1000 starts_at,UNIX_TIMESTAMP(ends_at)*1000 ends_at,UNIX_TIMESTAMP(updated_at) version FROM chinalife_ads WHERE '.($all?'1=1':'active=1 AND starts_at<=NOW() AND ends_at>NOW() AND (city=\'\' OR city=?)').' ORDER BY id DESC LIMIT 50',$all?'':'s',$all?[]:[$city]);
    foreach ($rows as &$r) {foreach (['width','height','starts_at','ends_at','version'] as $k) $r[$k]=(int)$r[$k];$r['id']=(string)$r['id'];$r['active']=(bool)$r['active'];}unset($r);
    return $rows;
}
// An uploaded image as a data URL: only real PNG, JPEG or WebP within the size and pixel limits. Returns [bytes,mime,w,h].
function cl_image(mixed $dataUrl, int $maxBytes=2097152, int $minW=200, int $minH=100): array {
    if (!is_string($dataUrl)||!preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#',$dataUrl,$m)) cl_fail('Upload a PNG, JPG or WebP image');
    $bytes=base64_decode($m[2],true);if ($bytes===false||strlen($bytes)>$maxBytes) cl_fail('Images must be '.round($maxBytes/1048576,1).' MB or smaller');
    $info=@getimagesizefromstring($bytes);$mime=$info['mime']??'';
    if (!$info||!in_array($mime,['image/png','image/jpeg','image/webp'],true)) cl_fail('That file is not a valid image');
    if ($info[0]<$minW||$info[1]<$minH||$info[0]>4096||$info[1]>4096) cl_fail('Use an image between '.$minW.'×'.$minH.' and 4096×4096 pixels');
    return [$bytes,$mime,(int)$info[0],(int)$info[1]];
}
const CL_CITIES=['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'];
const CL_PARTNER_KINDS=['restaurant','shop','service','creator','event','ad'];
// Partner applications from partners.html. Every field is checked here; what is stored is exactly what goes into the game
// on approval. Photos must be images this account uploaded. Returns [city, title, data].
function cl_partner_data(string $kind, array $in, int $owner): array {
    if (!in_array($kind,CL_PARTNER_KINDS,true)) cl_fail('Choose what you want to list');
    $city=$in['city']??'';if (!in_array($city,CL_CITIES,true)) cl_fail('Choose a city');
    $text=function(string $key,int $max,bool $required=false,string $label='') use ($in){$v=trim((string)($in[$key]??''));if ($required&&$v==='') cl_fail('Add '.($label?:$key));if (mb_strlen($v)>$max) cl_fail(ucfirst($label?:$key).' is too long (up to '.$max.' characters)');return $v;};
    $media=function(mixed $list,int $max) use ($owner){if ($list===null||$list==='') return [];if (!is_array($list)||count($list)>$max) cl_fail('Add up to '.$max.' photos');$ids=[];foreach ($list as $id){if (!is_string($id)||!preg_match('/^[a-f0-9]{24}$/',$id)||!cl_one('SELECT id FROM chinalife_media WHERE id=? AND user_id=?','si',[$id,$owner])) cl_fail('A photo is missing. Upload it again');$ids[]=$id;}return array_values(array_unique($ids));};
    $venue=function(string $key,bool $allowEmpty=true) use ($in,$city){$v=(string)($in[$key]??'');if ($v===''&&$allowEmpty) return '';[,$v]=cl_room(['city'=>$city,'place'=>$v]);if (cl_private_place($v)) cl_fail('Choose a public place');return $v;};
    $link=function(string $key,string $schemes='https://|weixin://') use ($in){$v=trim((string)($in[$key]??''));if ($v!==''&&!preg_match('#^('.$schemes.')[^\s<>"]{3,290}$#',$v)) cl_fail('Links must start with '.str_replace('|',' or ',$schemes));return $v;};
    $wechat=trim((string)($in['wechat_id']??''));if ($wechat!==''&&!preg_match('/^[A-Za-z][-_A-Za-z0-9]{5,39}$/',$wechat)) cl_fail('Enter a valid WeChat ID (6 to 40 letters, numbers, - or _)');
    $whatsapp=preg_replace('/[^0-9]/','',(string)($in['whatsapp']??''));if ($whatsapp!==''&&(strlen($whatsapp)<8||strlen($whatsapp)>15)) cl_fail('Enter the WhatsApp number with country code, e.g. 8618940147438');
    $contact=$text('contact',120);
    $d=['icon'=>$text('icon',8)?:['restaurant'=>'🍽','shop'=>'🛒','service'=>'🧰','creator'=>'🎬','event'=>'🎉','ad'=>'📣'][$kind],'description'=>$text('description',600),'wechat_id'=>$wechat,'whatsapp'=>$whatsapp,'contact'=>$contact];
    if (in_array($kind,['restaurant','shop','service','creator'],true)) {
        $title=$text('name',80,true,'a name');$d['district']=$text('district',80);$d['order_link']=$link('order_link');$d['near']=$venue('near');$d['photos']=$media($in['photos']??[],6);
        $items=$in['items']??[];$need=$kind==='creator'?0:1;if (!is_array($items)||count($items)<$need||count($items)>80) cl_fail($kind==='creator'?'Add up to 80 offers':'Add 1 to 80 items with prices');
        $d['items']=[];foreach ($items as $it){$name=trim((string)($it['name']??''));$price=$it['price']??null;$desc=trim((string)($it['description']??''));
            if ($name===''||mb_strlen($name)>60||!is_numeric($price)||$price<0||$price>1000000||mb_strlen($desc)>120) cl_fail('Each item needs a name (up to 60 characters) and a price from 0 to 1,000,000');
            $photo=$media(($it['photo']??'')===''?[]:[$it['photo']],1);$d['items'][]=['name'=>$name,'price'=>round((float)$price,2),'description'=>$desc,'photo'=>$photo[0]??''];}
        $links=$in['links']??[];if (!is_array($links)||count($links)>6) cl_fail('Add up to 6 social links');$d['links']=[];foreach ($links as $l){$l=trim((string)$l);if ($l==='') continue;if (!preg_match('#^https://[^\s<>"]{3,290}$#',$l)) cl_fail('Social links must start with https://');$d['links'][]=$l;}
        if ($kind==='creator'&&!$d['links']&&$wechat===''&&$whatsapp==='') cl_fail('Add a social link or a way to contact you');
        if ($kind!=='creator'&&$d['order_link']===''&&$wechat===''&&$whatsapp==='') cl_fail('Add at least one way for players to reach you: a link, a WeChat ID or a WhatsApp number');
    } elseif ($kind==='event') {
        $title=$text('title',80,true,'an event title');$d['place']=$venue('place');$d['link']=$link('link','https://');$d['photos']=$media($in['photos']??[],1);
        $tz=new DateTimeZone('Asia/Shanghai');$parse=function(string $key,string $label) use ($in,$tz){$v=(string)($in[$key]??'');$t=DateTime::createFromFormat('!Y-m-d\TH:i',$v,$tz);if (!$t) cl_fail('Choose the '.$label.' date and time');return $t->getTimestamp();};
        $start=$parse('starts','start');$end=$parse('ends','end');
        if ($start<time()-3600||$start>time()+180*86400) cl_fail('The event must start within the next 6 months');if ($end<=$start||$end-$start>30*86400) cl_fail('The event must end after it starts, within 30 days');
        $d['starts']=$start;$d['ends']=$end;
    } else {
        $title=$text('title',80,true,'an ad title');$d['link']=$link('link');$d['place']=$venue('place',false);$d['photos']=$media($in['photos']??[],1);if (!$d['photos']) cl_fail('Upload the banner image');
        $days=$in['days']??30;if (!in_array($days,[7,14,30,60,90],true)) cl_fail('Choose how long the ad runs');$d['days']=$days;$d['all_cities']=!empty($in['all_cities']);
        if ($wechat===''&&$whatsapp===''&&$contact==='') cl_fail('Add a way for our team to reach you about the ad');
    }
    return [$city,$title,$d];
}
function cl_valid_restaurant(array $input): array {
    $name=trim((string)($input['name']??''));$icon=trim((string)($input['icon']??''))?:'🍽';$district=trim((string)($input['district']??''));$description=trim((string)($input['description']??''));
    $link=trim((string)($input['order_link']??''));$wechat=trim((string)($input['wechat_id']??''));$whatsapp=preg_replace('/[^0-9]/','',(string)($input['whatsapp']??''));
    if (!in_array($input['city']??'',['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true)) cl_fail('Choose a city');
    if ($name===''||mb_strlen($name)>80||mb_strlen($icon)>8||mb_strlen($district)>80||mb_strlen($description)>300) cl_fail('Give the restaurant a name (up to 80 characters)');
    if ($link!==''&&!preg_match('#^(https://|weixin://)[^\s<>"]{3,290}$#',$link)) cl_fail('Order links must start with https:// or weixin://');
    if ($wechat!==''&&!preg_match('/^[A-Za-z][-_A-Za-z0-9]{5,39}$/',$wechat)) cl_fail('Enter a valid WeChat ID (6 to 40 letters, numbers, - or _)');
    if ($whatsapp!==''&&(strlen($whatsapp)<8||strlen($whatsapp)>15)) cl_fail('Enter the WhatsApp number with country code, e.g. 8618940147438');
    $menu=$input['menu']??[];if (!is_array($menu)||count($menu)<1||count($menu)>80) cl_fail('Add 1 to 80 dishes to the menu');
    $dishes=[];foreach ($menu as $d) {$dish=trim((string)($d[0]??''));$price=$d[1]??null;
        if ($dish===''||mb_strlen($dish)>60||!is_numeric($price)||$price<0||$price>100000) cl_fail('Each dish needs a name and a price from 0 to 100,000');
        $dishes[]=[$dish,round((float)$price,2)];}
    if ($link===''&&$wechat===''&&$whatsapp==='') cl_fail('Add at least one way to order: a link, a WeChat ID or a WhatsApp number');
    return ['city'=>$input['city'],'name'=>$name,'icon'=>$icon,'district'=>$district,'description'=>$description,'menu'=>json_encode($dishes,JSON_UNESCAPED_UNICODE),'order_link'=>$link,'wechat_id'=>$wechat,'whatsapp'=>$whatsapp,'active'=>empty($input['active'])&&array_key_exists('active',$input)?0:1];
}
// Admin-awarded event badges and rank suspensions, shown to the player and on public profiles.
function cl_rank_status(int $userId): array {
    $badges=cl_rows('SELECT id,icon,name FROM chinalife_badges WHERE user_id=? ORDER BY id DESC LIMIT 30','i',[$userId]);
    foreach ($badges as &$b) $b['id']=(string)$b['id'];unset($b);
    $s=cl_one('SELECT UNIX_TIMESTAMP(until)*1000 until_ms,reason FROM chinalife_rank_suspensions WHERE user_id=? AND until>NOW()','i',[$userId]);
    return ['badges'=>$badges,'rankSuspendedUntil'=>$s?(int)$s['until_ms']:null,'rankSuspendedReason'=>$s['reason']??null];
}
