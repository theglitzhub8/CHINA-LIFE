<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['POST']);cl_admin();cl_rate('admin',60,60);
// Admins can send a banner image (up to 2 MB, about 2.8 MB as base64), so their requests may be larger.
$input=cl_body(3000000);$action=$input['action']??'';
function admin_log(string $action,?int $target,?int $amount,string $note): void {
    global $uid;cl_run('INSERT INTO chinalife_admin_log(admin_id,action,target_id,amount,note,created_at) VALUES(?,?,?,?,?,NOW())','isiis',[$uid,$action,$target,$amount,mb_substr($note,0,300)]);
}
$xp="CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.xp')),'0') AS SIGNED)";
$money="CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.money')),'0') AS SIGNED)";
if ($action==='stats') {
    $cities=[];foreach (cl_rows('SELECT city,COUNT(*) n FROM chinalife_presence WHERE seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND) GROUP BY city') as $r) $cities[$r['city']]=(int)$r['n'];
    json_response('success',['online'=>array_sum($cities),'cities'=>$cities,
        'players'=>(int)cl_one('SELECT COUNT(*) n FROM chinalife_saves')['n'],
        'newToday'=>(int)cl_one('SELECT COUNT(*) n FROM chinalife_saves WHERE created_at>=CURDATE()')['n'],
        'events'=>(int)cl_one('SELECT COUNT(*) n FROM chinalife_events WHERE starts_at<=NOW() AND ends_at>NOW()')['n'],
        'reports'=>(int)cl_one('SELECT COUNT(*) n FROM chinalife_reports')['n'],
        'log'=>cl_rows('SELECT l.action,l.amount,l.note,l.created_at,u.user_name target FROM chinalife_admin_log l LEFT JOIN users u ON u.user_id=l.target_id ORDER BY l.id DESC LIMIT 15')]);
}
if ($action==='players') {
 $q=trim((string)($input['query']??''));if(mb_strlen($q)>60)cl_fail('Filter is too long');
 $page=filter_var($input['page']??0,FILTER_VALIDATE_INT);if($page===false||$page<0||$page>100000)cl_fail('Choose a valid page');$offset=$page*25;$like='%'.str_replace(['%','_'],['\\%','\\_'],$q).'%';
 $total=(int)cl_one('SELECT COUNT(*) n FROM users u JOIN chinalife_saves s ON s.user_id=u.user_id WHERE u.user_name LIKE ?','s',[$like])['n'];
 $rows=cl_rows("SELECT u.user_id id,u.user_name name,$money money,$xp xp,s.updated_at,p.city,p.place,COALESCE(p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND),0) online FROM users u JOIN chinalife_saves s ON s.user_id=u.user_id LEFT JOIN chinalife_presence p ON p.user_id=u.user_id WHERE u.user_name LIKE ? ORDER BY online DESC,s.updated_at DESC,u.user_id LIMIT 25 OFFSET $offset",'s',[$like]);
 foreach($rows as &$r){$r['id']=(string)$r['id'];$r['money']=(int)$r['money'];$r['xp']=(int)$r['xp'];$r['online']=(bool)$r['online'];}unset($r);
 json_response('success',['players'=>$rows,'total'=>$total,'hasMore'=>$offset+count($rows)<$total]);
}
if ($action==='search') {
    $q=trim((string)($input['query']??''));if ($q===''||mb_strlen($q)>60) cl_fail('Type a username');
    // Exact username first, then names that start with the search.
    $rows=cl_rows("SELECT u.user_id id,u.user_name name,$money money,$xp xp,s.updated_at FROM users u JOIN chinalife_saves s ON s.user_id=u.user_id WHERE u.user_name LIKE ? ORDER BY (u.user_name=?) DESC,u.user_name LIMIT 20",'ss',[str_replace(['%','_'],['\\%','\\_'],$q).'%',$q]);
    foreach ($rows as &$r) {$r['id']=(string)$r['id'];$r['money']=(int)$r['money'];$r['xp']=(int)$r['xp'];}unset($r);
    json_response('success',['players'=>$rows]);
}
if ($action==='grant') {
    $target=filter_var($input['user_id']??null,FILTER_VALIDATE_INT);$amount=$input['amount']??null;$note=trim((string)($input['note']??''));
    if (!$target||!is_int($amount)||$amount===0||$amount<-1000000||$amount>10000000) cl_fail('Enter a whole amount between -1,000,000 and 10,000,000');
    $db->begin_transaction();$balance=cl_credit((int)$target,$amount);admin_log('grant',(int)$target,$amount,$note);$db->commit();
    json_response('success',['balance'=>$balance]);
}
if ($action==='events') {
    json_response('success',['events'=>cl_rows('SELECT id,title,body,city,place,reward,billboard,link,starts_at,ends_at,(starts_at<=NOW() AND ends_at>NOW()) active,(SELECT COUNT(*) FROM chinalife_event_claims c WHERE c.event_id=e.id) joined FROM chinalife_events e ORDER BY id DESC LIMIT 30')]);
}
if ($action==='create_event') {
    $title=trim((string)($input['title']??''));$body=trim((string)($input['body']??''));$place=(string)($input['place']??'');$link=trim((string)($input['link']??''));
    $reward=$input['reward']??0;$hours=$input['hours']??24;$billboard=!empty($input['billboard'])?1:0;
    if ($title===''||mb_strlen($title)>80||mb_strlen($body)>300) cl_fail('Give the event a title (up to 80 characters)');
    if ($place!=='') cl_room(['city'=>'Shenyang','place'=>$place]);
    if (!is_int($reward)||$reward<0||$reward>1000000) cl_fail('Reward must be 0 to 1,000,000');
    if (!is_int($hours)||$hours<1||$hours>720) cl_fail('Duration must be 1 to 720 hours');
    if ($link!==''&&!preg_match('#^https://[^\s<>"]{3,290}$#',$link)) cl_fail('Links must start with https://');
    cl_run('INSERT INTO chinalife_events(title,body,city,place,reward,billboard,link,starts_at,ends_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL ? HOUR),?,NOW())','ssssiisii',[$title,$body,'Shenyang',$place,$reward,$billboard,$link,$hours,$uid]);
    $id=(int)$db->insert_id;admin_log('create_event',null,$reward,$title);json_response('success',['id'=>$id]);
}
if ($action==='end_event') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if (!$id) cl_fail('Choose an event');
    cl_run('UPDATE chinalife_events SET ends_at=NOW() WHERE id=? AND ends_at>NOW()','i',[$id]);admin_log('end_event',null,null,(string)$id);json_response('success',['ended'=>true]);
}
if ($action==='cities') json_response('success',['open'=>cl_open_cities()]);
if ($action==='set_cities') {
    $all=['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'];$open=$input['open']??null;
    if (!is_array($open)||array_diff($open,$all)) cl_fail('Choose valid cities');
    $value=json_encode(array_values(array_unique(array_merge(['Shenyang'],$open))));
    cl_run('INSERT INTO chinalife_settings(name,value,updated_at) VALUES(\'open_cities\',?,NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=NOW()','s',[$value]);
    admin_log('set_cities',null,null,$value);json_response('success',['open'=>json_decode($value,true)]);
}
if ($action==='reports') {
    json_response('success',['reports'=>cl_rows('SELECT r.reason,r.message_body body,r.created_at,a.user_name reporter,b.user_name sender FROM chinalife_reports r LEFT JOIN users a ON a.user_id=r.reporter_id LEFT JOIN users b ON b.user_id=r.sender_id ORDER BY r.created_at DESC LIMIT 50'),'playerReports'=>cl_rows('SELECT r.reason,r.note,r.city,r.place,r.created_at,a.user_name reporter,b.user_name player,(SELECT COUNT(*) FROM chinalife_player_reports x WHERE x.peer_id=r.peer_id) total FROM chinalife_player_reports r LEFT JOIN users a ON a.user_id=r.reporter_id LEFT JOIN users b ON b.user_id=r.peer_id ORDER BY r.created_at DESC LIMIT 50')]);
}
// Rank management. Ranks, badges and suspensions are game status only; admin access comes from admin-config.php alone.
$rankActions="'set_ranks','set_rank','award_badge','revoke_badge','suspend_rank'";
if ($action==='ranks') {
    json_response('success',['ranks'=>cl_ranks(),'log'=>cl_rows("SELECT l.action,l.amount,l.note,l.created_at,u.user_name target,a.user_name admin FROM chinalife_admin_log l LEFT JOIN users u ON u.user_id=l.target_id LEFT JOIN users a ON a.user_id=l.admin_id WHERE l.action IN ($rankActions) ORDER BY l.id DESC LIMIT 50")]);
}
if ($action==='set_ranks') {
    $ranks=cl_valid_ranks($input['ranks']??null);
    if (!$ranks) cl_fail('Use 2 to 12 ranks: the first at 0 XP, XP rising each step, a name up to 30 characters, an icon and a reward from ¥0 to ¥1,000,000');
    $value=json_encode($ranks,JSON_UNESCAPED_UNICODE);
    cl_run("INSERT INTO chinalife_settings(name,value,updated_at) VALUES('ranks',?,NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=NOW()",'s',[$value]);
    admin_log('set_ranks',null,count($ranks),implode(' · ',array_map(fn($r)=>$r['icon'].' '.$r['name'].' '.$r['xp'],$ranks)));json_response('success',['ranks'=>$ranks]);
}
if (in_array($action,['player','set_rank','award_badge','suspend_rank'],true)) {
    $target=filter_var($input['user_id']??null,FILTER_VALIDATE_INT);if (!$target) cl_fail('Choose a player');
    $player=cl_one("SELECT u.user_id,u.user_name name,$xp xp FROM users u JOIN chinalife_saves s ON s.user_id=u.user_id WHERE u.user_id=?",'i',[$target]);
    if (!$player) cl_fail('That player has no saved character yet',404);
    $note=mb_substr(trim((string)($input['note']??'')),0,200);
}
if ($action==='player') json_response('success',['player'=>['id'=>(string)$target,'name'=>$player['name'],'xp'=>(int)$player['xp']]+cl_rank_status((int)$target)]);
if ($action==='set_rank') {
    // Moves the player's XP to the start of the chosen rank. Rank rewards are not paid for admin changes.
    $ranks=cl_ranks();$i=$input['rank']??null;if (!is_int($i)||!isset($ranks[$i])) cl_fail('Choose a rank');if ($note==='') cl_fail('Give a reason for the audit log');
    $db->begin_transaction();$row=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$target]);$game=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);$from=(int)($game['xp']??0);
    $game['xp']=$ranks[$i]['xp'];$game['rankClaimed']=$i;
    cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($game,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$target]);
    admin_log('set_rank',(int)$target,$i,$ranks[$i]['icon'].' '.$ranks[$i]['name'].' (was '.$from.' XP) · '.$note);$db->commit();json_response('success',['xp'=>$ranks[$i]['xp']]);
}
if ($action==='award_badge') {
    $icon=trim((string)($input['icon']??''));$name=trim((string)($input['name']??''));
    if ($icon===''||mb_strlen($icon)>8||$name===''||mb_strlen($name)>60) cl_fail('Give the badge an icon and a name up to 60 characters');
    if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_badges WHERE user_id=?','i',[$target])['n']>=30) cl_fail('This player already has 30 badges',409);
    cl_run('INSERT INTO chinalife_badges(user_id,icon,name,awarded_by,created_at) VALUES(?,?,?,?,NOW())','issi',[$target,$icon,$name,$uid]);
    admin_log('award_badge',(int)$target,null,$icon.' '.$name.($note!==''?' · '.$note:''));json_response('success',cl_rank_status((int)$target));
}
if ($action==='revoke_badge') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$badge=$id?cl_one('SELECT user_id,icon,name FROM chinalife_badges WHERE id=?','i',[$id]):null;if (!$badge) cl_fail('Choose a badge',404);
    cl_run('DELETE FROM chinalife_badges WHERE id=?','i',[$id]);admin_log('revoke_badge',(int)$badge['user_id'],null,$badge['icon'].' '.$badge['name']);json_response('success',cl_rank_status((int)$badge['user_id']));
}
if ($action==='suspend_rank') {
    // 0 days lifts a suspension. While suspended, rank rewards, rank perks and the leaderboard are paused.
    $days=$input['days']??null;if (!is_int($days)||$days<0||$days>365) cl_fail('Choose 0 to 365 days');
    if ($days===0) {cl_run('DELETE FROM chinalife_rank_suspensions WHERE user_id=?','i',[$target]);admin_log('suspend_rank',(int)$target,0,'Lifted'.($note!==''?' · '.$note:''));}
    else {if ($note==='') cl_fail('Give a reason for the audit log');
        cl_run('INSERT INTO chinalife_rank_suspensions(user_id,until,reason,created_by,created_at) VALUES(?,DATE_ADD(NOW(),INTERVAL ? DAY),?,?,NOW()) ON DUPLICATE KEY UPDATE until=VALUES(until),reason=VALUES(reason),created_by=VALUES(created_by),created_at=NOW()','iisi',[$target,$days,$note,$uid]);
        admin_log('suspend_rank',(int)$target,$days,$note);}
    json_response('success',cl_rank_status((int)$target));
}
// Hafrik HQ service applications.
if ($action==='applications') {
    $status=$input['status']??'pending';if (!in_array($status,['pending','approved','declined','all'],true)) cl_fail('Choose a status');
    $rows=cl_rows('SELECT a.id,a.service,a.name,a.contact,a.city,a.message,a.status,a.admin_note,a.created_at,u.user_name username FROM chinalife_applications a LEFT JOIN users u ON u.user_id=a.user_id'.($status==='all'?'':' WHERE a.status=?').' ORDER BY a.id DESC LIMIT 100',$status==='all'?'':'s',$status==='all'?[]:[$status]);
    foreach ($rows as &$r) $r['id']=(string)$r['id'];unset($r);
    json_response('success',['applications'=>$rows,'services'=>require __DIR__.'/services-config.php','pending'=>(int)cl_one('SELECT COUNT(*) n FROM chinalife_applications WHERE status="pending"')['n']]);
}
if ($action==='set_application') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$status=$input['status']??'';$note=mb_substr(trim((string)($input['note']??'')),0,300);
    if (!$id||!in_array($status,['pending','approved','declined'],true)) cl_fail('Choose an application and a status');
    $row=cl_one('SELECT user_id,service FROM chinalife_applications WHERE id=?','i',[$id]);if (!$row) cl_fail('Application not found',404);
    cl_run('UPDATE chinalife_applications SET status=?,admin_note=?,updated_at=NOW() WHERE id=?','ssi',[$status,$note,$id]);
    admin_log('set_application',(int)$row['user_id'],null,$row['service'].' → '.$status.($note!==''?' · '.$note:''));json_response('success',['ok'=>true]);
}
// Partner restaurants per city, with menus and order links.
if ($action==='restaurants') {
    $city=$input['city']??'Shenyang';if (!is_string($city)||mb_strlen($city)>40) cl_fail('Choose a city');
    json_response('success',['restaurants'=>cl_restaurants($city,true)]);
}
if ($action==='save_restaurant') {
    $r=cl_valid_restaurant($input);$id=filter_var($input['id']??null,FILTER_VALIDATE_INT);
    if ($id) {if (!cl_one('SELECT id FROM chinalife_restaurants WHERE id=?','i',[$id])) cl_fail('Restaurant not found',404);
        cl_run('UPDATE chinalife_restaurants SET city=?,name=?,icon=?,district=?,description=?,menu=?,order_link=?,wechat_id=?,whatsapp=?,active=?,updated_at=NOW() WHERE id=?','sssssssssii',[...array_values($r),$id]);}
    else {if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_restaurants WHERE city=?','s',[$r['city']])['n']>=200) cl_fail('A city can have up to 200 partner restaurants',409);
        $q=cl_query('INSERT INTO chinalife_restaurants(city,name,icon,district,description,menu,order_link,wechat_id,whatsapp,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW(),NOW())','sssssssssi',array_values($r));$id=$q->insert_id;$q->close();}
    // Where the restaurant appears on the city map: next to a chosen public venue, or nowhere.
    // Only changed when the form sends it, so older admin screens keep the placement.
    $near=array_key_exists('near',$input)?trim((string)$input['near']):null;
    if ($near==='') cl_run('DELETE FROM chinalife_restaurant_places WHERE restaurant_id=?','i',[$id]);
    elseif ($near!==null) {[,$near]=cl_room(['city'=>$r['city'],'place'=>$near]);if (cl_private_place($near)) cl_fail('Choose a public place');cl_run('INSERT INTO chinalife_restaurant_places(restaurant_id,near) VALUES(?,?) ON DUPLICATE KEY UPDATE near=VALUES(near)','is',[$id,$near]);}
    admin_log('save_restaurant',null,null,$r['city'].' · '.$r['name']);json_response('success',['id'=>(string)$id]);
}
if ($action==='delete_restaurant') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$row=$id?cl_one('SELECT city,name FROM chinalife_restaurants WHERE id=?','i',[$id]):null;if (!$row) cl_fail('Restaurant not found',404);
    cl_run('DELETE FROM chinalife_restaurants WHERE id=?','i',[$id]);admin_log('delete_restaurant',null,null,$row['city'].' · '.$row['name']);json_response('success',['deleted'=>true]);
}
// Partner applications from partners.html: list, then approve (goes straight into the game), ask for changes, or reject.
if ($action==='partners') {
    $status=(string)($input['status']??'pending');if (!in_array($status,['pending','changes','approved','rejected','all'],true)) cl_fail('Choose a status');
    $rows=cl_rows('SELECT s.id,s.user_id,u.user_name username,s.kind,s.city,s.title,s.data,s.status,s.admin_note,s.listing,s.created_at,s.updated_at FROM chinalife_submissions s LEFT JOIN users u ON u.user_id=s.user_id'.($status==='all'?'':' WHERE s.status=?').' ORDER BY s.updated_at DESC LIMIT 100',$status==='all'?'':'s',$status==='all'?[]:[$status]);
    foreach ($rows as &$r){$r['id']=(string)$r['id'];$r['user_id']=(string)$r['user_id'];$r['data']=json_decode($r['data'],true)?:[];}unset($r);
    $counts=[];foreach (cl_rows('SELECT status,COUNT(*) n FROM chinalife_submissions GROUP BY status') as $c) $counts[$c['status']]=(int)$c['n'];
    json_response('success',['submissions'=>$rows,'counts'=>$counts]);
}
if ($action==='review_partner') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$decision=(string)($input['decision']??'');$note=mb_substr(trim((string)($input['note']??'')),0,300);
    if (!in_array($decision,['approve','changes','reject'],true)) cl_fail('Choose approve, changes or reject');
    if (($decision!=='approve')&&$note==='') cl_fail('Tell the applicant what to change or why it was rejected');
    $db->begin_transaction();
    $s=$id?cl_one('SELECT * FROM chinalife_submissions WHERE id=? FOR UPDATE','i',[$id]):null;
    if (!$s){$db->rollback();cl_fail('Application not found',404);}
    if ($s['status']==='approved'){$db->rollback();cl_fail('Already approved',409);}
    $listing='';
    if ($decision==='approve') {
        $d=json_decode($s['data'],true)?:[];$kind=$s['kind'];
        if (in_array($kind,['restaurant','shop','service','creator'],true)) {
            if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_restaurants WHERE city=?','s',[$s['city']])['n']>=200){$db->rollback();cl_fail('This city already has 200 partner listings',409);}
            $menu=json_encode(array_map(fn($i)=>[$i['name'],$i['price'],$i['photo']??'',$i['description']??''],$d['items']??[]),JSON_UNESCAPED_UNICODE);
            $q=cl_query('INSERT INTO chinalife_restaurants(city,name,icon,district,description,menu,order_link,wechat_id,whatsapp,active,kind,photos,links,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,NOW(),NOW())','ssssssssssssi',
                [$s['city'],$s['title'],$d['icon']??'🍽',$d['district']??'',mb_substr($d['description']??'',0,300),$menu,$d['order_link']??'',$d['wechat_id']??'',$d['whatsapp']??'',$kind,json_encode($d['photos']??[]),json_encode($d['links']??[]),(int)$s['user_id']]);
            $rid=$q->insert_id;$q->close();if (($d['near']??'')!=='') cl_run('INSERT INTO chinalife_restaurant_places(restaurant_id,near) VALUES(?,?)','is',[$rid,$d['near']]);$listing='listing:'.$rid;
        } elseif ($kind==='event') {
            cl_run('INSERT INTO chinalife_events(title,body,city,place,reward,billboard,link,starts_at,ends_at,created_by,created_at) VALUES(?,?,?,?,0,1,?,FROM_UNIXTIME(?),FROM_UNIXTIME(?),?,NOW())','sssssiii',[$s['title'],mb_substr($d['description']??'',0,300),$s['city'],$d['place']??'',$d['link']??'',(int)$d['starts'],(int)$d['ends'],$uid]);
            $listing='event:'.$db->insert_id;
        } else {
            $m=cl_one('SELECT bytes,mime,width,height FROM chinalife_media WHERE id=?','s',[$d['photos'][0]??'']);if (!$m){$db->rollback();cl_fail('The banner image is missing',409);}
            $q=cl_query('INSERT INTO chinalife_ads(title,sponsor,city,place,link,image,mime,width,height,active,starts_at,ends_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,NOW(),DATE_ADD(NOW(),INTERVAL ? DAY),NOW(),NOW())','sssssssiii',
                [$s['title'],(string)(cl_one('SELECT user_name FROM users WHERE user_id=?','i',[(int)$s['user_id']])['user_name']??''),!empty($d['all_cities'])?'':$s['city'],$d['place']??'night',$d['link']??'',$m['bytes'],$m['mime'],(int)$m['width'],(int)$m['height'],(int)($d['days']??30)]);
            $listing='ad:'.$q->insert_id;$q->close();
        }
    }
    cl_run('UPDATE chinalife_submissions SET status=?,admin_note=?,listing=?,reviewed_by=?,reviewed_at=NOW(),updated_at=NOW() WHERE id=?','sssii',[$decision==='approve'?'approved':($decision==='changes'?'changes':'rejected'),$note,$listing,$uid,$id]);
    $db->commit();admin_log('review_partner',(int)$s['user_id'],null,$decision.' · '.$s['kind'].' · '.$s['title']);json_response('success',['status'=>$decision,'listing'=>$listing]);
}
if ($action==='ads') json_response('success',['ads'=>cl_ads('',true)]);
if ($action==='save_ad') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$title=trim((string)($input['title']??''));$sponsor=trim((string)($input['sponsor']??''));$link=trim((string)($input['link']??''));
    $city=(string)($input['city']??'');$place=(string)($input['place']??'night');$days=$input['days']??30;$active=!empty($input['active'])?1:0;
    if ($title===''||mb_strlen($title)>80||mb_strlen($sponsor)>80) cl_fail('Give the ad a title (up to 80 characters)');
    if ($city!==''&&!in_array($city,['Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true)) cl_fail('Choose a city');
    cl_room(['city'=>'Shenyang','place'=>$place]);if (cl_private_place($place)) cl_fail('Choose a public venue');
    if ($link!==''&&!preg_match('#^(https://|weixin://)[^\s<>"]{3,290}$#',$link)) cl_fail('Links must start with https:// or weixin://');
    if (!is_int($days)||$days<1||$days>365) cl_fail('Run the ad for 1 to 365 days');
    // The banner arrives as a data URL; only real PNG, JPEG or WebP images up to 2 MB are kept.
    $image=null;
    if (is_string($input['image']??null)&&$input['image']!=='') {
        if (!preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#',$input['image'],$m)) cl_fail('Upload a PNG, JPG or WebP image');
        $bytes=base64_decode($m[2],true);if ($bytes===false||strlen($bytes)>2*1024*1024) cl_fail('The banner must be 2 MB or smaller');
        $info=@getimagesizefromstring($bytes);$mime=$info['mime']??'';
        if (!$info||!in_array($mime,['image/png','image/jpeg','image/webp'],true)) cl_fail('That file is not a valid image');
        if ($info[0]<200||$info[1]<100||$info[0]>4096||$info[1]>4096) cl_fail('Use an image between 200×100 and 4096×4096 pixels');
        $image=[$bytes,$mime,(int)$info[0],(int)$info[1]];
    }
    if ($id) {
        if (!cl_one('SELECT id FROM chinalife_ads WHERE id=?','i',[$id])) cl_fail('Ad not found',404);
        cl_run('UPDATE chinalife_ads SET title=?,sponsor=?,city=?,place=?,link=?,active=?,ends_at=DATE_ADD(starts_at,INTERVAL ? DAY),updated_at=NOW() WHERE id=?','sssssiii',[$title,$sponsor,$city,$place,$link,$active,$days,$id]);
        if ($image) cl_run('UPDATE chinalife_ads SET image=?,mime=?,width=?,height=?,updated_at=NOW() WHERE id=?','ssiii',[$image[0],$image[1],$image[2],$image[3],$id]);
    } else {
        if (!$image) cl_fail('Upload the banner image');
        $q=cl_query('INSERT INTO chinalife_ads(title,sponsor,city,place,link,image,mime,width,height,active,starts_at,ends_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL ? DAY),NOW(),NOW())','sssssssiiii',[$title,$sponsor,$city,$place,$link,$image[0],$image[1],$image[2],$image[3],$active,$days]);$id=$q->insert_id;$q->close();
    }
    admin_log('save_ad',null,null,$title.' · '.$place);json_response('success',['id'=>(string)$id]);
}
if ($action==='delete_ad') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$row=$id?cl_one('SELECT title FROM chinalife_ads WHERE id=?','i',[$id]):null;if (!$row) cl_fail('Ad not found',404);
    cl_run('DELETE FROM chinalife_ads WHERE id=?','i',[$id]);admin_log('delete_ad',null,null,$row['title']);json_response('success',['deleted'=>true]);
}
cl_fail('Unknown admin action');
