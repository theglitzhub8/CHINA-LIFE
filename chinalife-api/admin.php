<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';require_once __DIR__.'/life-lib.php';
cl_methods(['POST']);cl_admin();cl_rate('admin',60,60);
// Admins can send a banner image (up to 2 MB, about 2.8 MB as base64), so their requests may be larger.
$input=cl_body(3000000);$action=$input['action']??'';
function admin_log(string $action,?int $target,?int $amount,string $note): void {
    global $uid;cl_run('INSERT INTO chinalife_admin_log(admin_id,action,target_id,amount,note,created_at) VALUES(?,?,?,?,?,NOW())','isiis',[$uid,$action,$target,$amount,mb_substr($note,0,300)]);
}
if($action==='hafrik_features')json_response('success',['features'=>cl_hafrik_features(),'labels'=>cl_hafrik_feature_labels()]);
if($action==='set_hafrik_features'){
 $changes=$input['features']??null;$labels=cl_hafrik_feature_labels();
 if(!is_array($changes)||!$changes)cl_fail('Choose integrations to update');
 foreach($changes as $key=>$value)if(!isset($labels[$key])||!is_bool($value))cl_fail('Use valid integration names and on/off values');
 // A settings lock preserves concurrent changes to different switches.
 $db->begin_transaction();cl_run("INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('hafrik_features','{}',NOW())");
 cl_one("SELECT value FROM chinalife_settings WHERE name='hafrik_features' FOR UPDATE");
 $features=array_replace(cl_hafrik_features(),$changes);$value=json_encode($features);
 cl_run("UPDATE chinalife_settings SET value=?,updated_at=NOW() WHERE name='hafrik_features'",'s',[$value]);
 admin_log('set_hafrik_features',null,null,implode(' · ',array_map(fn($key)=>$labels[$key].': '.($changes[$key]?'on':'off'),array_keys($changes))));$db->commit();
 json_response('success',['features'=>$features]);
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
if ($action==='gist') { json_response('success',['posts'=>cl_rows('SELECT id,title,body,city,link,starts_at,ends_at,active FROM chinalife_gist_posts ORDER BY id DESC LIMIT 50')]); }
if ($action==='create_announcement') {
 $title=trim((string)($input['title']??''));$body=trim((string)($input['body']??''));$hours=$input['hours']??168;
 if($title===''||mb_strlen($title)>100||$body===''||mb_strlen($body)>600||!is_int($hours)||$hours<1||$hours>2160)cl_fail('Add a title, message and duration');
 // Empty city is reserved for admin announcements visible in every city.
 cl_run('INSERT INTO chinalife_gist_posts(city,title,body,link,starts_at,ends_at,created_by,created_at) VALUES("",?,?,"",NOW(),DATE_ADD(NOW(),INTERVAL ? HOUR),?,NOW())','ssii',[$title,$body,$hours,$uid]);
 $id=(string)$db->insert_id;admin_log('create_announcement',null,null,$title);json_response('success',['id'=>$id]);
}
if ($action==='create_gist') { $title=trim((string)($input['title']??''));$body=trim((string)($input['body']??''));$city=trim((string)($input['city']??'Shenyang'));$link=trim((string)($input['link']??''));$hours=$input['hours']??168;if($title===''||mb_strlen($title)>100||$body===''||mb_strlen($body)>600||!in_array($city,['China','Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true)||!is_int($hours)||$hours<1||$hours>2160)cl_fail('Check the gossip fields');if($link!==''&&!preg_match('#^https://[^\s<>"]{3,290}$#',$link))cl_fail('Links must start with https://');cl_run('INSERT INTO chinalife_gist_posts(city,title,body,link,starts_at,ends_at,created_by,created_at) VALUES(?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL ? HOUR),?,NOW())','ssssii',[$city,$title,$body,$link,$hours,$uid]);admin_log('create_gist',null,null,$city.' · '.$title);json_response('success',['id'=>(string)$db->insert_id]);}
if ($action==='approve_gist') { $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if(!$id)cl_fail('Choose a post');cl_run('UPDATE chinalife_gist_posts SET active=1,starts_at=NOW(),ends_at=DATE_ADD(NOW(),INTERVAL 7 DAY) WHERE id=? AND active=0','i',[$id]);admin_log('approve_gist',null,null,(string)$id);json_response('success',['approved'=>true]);}
if ($action==='end_gist') { $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if(!$id)cl_fail('Choose a post');cl_run('UPDATE chinalife_gist_posts SET active=0,ends_at=NOW() WHERE id=?','i',[$id]);admin_log('end_gist',null,null,(string)$id);json_response('success',['ended'=>true]);}
if ($action==='politics') { json_response('success',['candidates'=>cl_rows('SELECT c.id,c.city,c.office,c.statement,c.status,c.created_at,u.user_name name,COUNT(v.id) votes FROM chinalife_politics_candidates c JOIN users u ON u.user_id=c.candidate_id LEFT JOIN chinalife_politics_votes v ON v.candidate_id=c.id GROUP BY c.id,c.city,c.office,c.statement,c.status,c.created_at,u.user_name ORDER BY c.city,c.office,votes DESC,c.id DESC LIMIT 200'),'elections'=>cl_rows('SELECT city,office,period,opens_at,closes_at FROM chinalife_politics_elections ORDER BY closes_at DESC LIMIT 50')]); }
if ($action==='politics_review') { $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$decision=$input['decision']??'';if(!$id||!in_array($decision,['approved','rejected'],true))cl_fail('Choose a candidate and decision');cl_run('UPDATE chinalife_politics_candidates SET status=?,reviewed_at=NOW() WHERE id=?','si',[$decision,$id]);admin_log('politics_'.$decision,null,null,(string)$id);json_response('success',['updated'=>true]);}
if ($action==='politics_delete') { $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if(!$id)cl_fail('Choose a candidate');cl_run('DELETE FROM chinalife_politics_candidates WHERE id=?','i',[$id]);admin_log('politics_delete',null,null,(string)$id);json_response('success',['deleted'=>true]);}
if ($action==='politics_elections') { $city=trim((string)($input['city']??'Shenyang'));$office=(string)($input['office']??'');$opens=trim((string)($input['opens_at']??''));$closes=trim((string)($input['closes_at']??''));$period=trim((string)($input['period']??date('Y')));if(!in_array($office,['governor','deputy-governor','city-councillor','student-representative'],true)||$opens===''||$closes===''||strtotime($closes)<=strtotime($opens))cl_fail('Choose valid election times');cl_run('INSERT INTO chinalife_politics_elections(city,office,period,opens_at,closes_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE opens_at=VALUES(opens_at),closes_at=VALUES(closes_at)','sssss',[$city,$office,$period,$opens,$closes]);json_response('success',['saved'=>true]);}
if ($action==='events') {
    json_response('success',['events'=>cl_rows('SELECT id,title,body,city,place,reward,billboard,link,starts_at,ends_at,(starts_at<=NOW() AND ends_at>NOW()) active,(SELECT COUNT(*) FROM chinalife_event_claims c WHERE c.event_id=e.id) joined FROM chinalife_events e ORDER BY id DESC LIMIT 30')]);
}
if ($action==='create_event') {
    $city=$input['city']??cl_open_cities()[0];if(!is_string($city)||!in_array($city,CL_CITIES,true))cl_fail('Choose a valid city');
    $title=trim((string)($input['title']??''));$body=trim((string)($input['body']??''));$place=(string)($input['place']??'');$link=trim((string)($input['link']??''));
    $reward=$input['reward']??0;$hours=$input['hours']??24;$billboard=!empty($input['billboard'])?1:0;
    if ($title===''||mb_strlen($title)>80||mb_strlen($body)>300) cl_fail('Give the event a title (up to 80 characters)');
    if ($place!=='') cl_room(['city'=>'Shenyang','place'=>$place]);
    if (!is_int($reward)||$reward<0||$reward>1000000) cl_fail('Reward must be 0 to 1,000,000');
    if (!is_int($hours)||$hours<1||$hours>720) cl_fail('Duration must be 1 to 720 hours');
    if ($link!==''&&!preg_match('#^https://[^\s<>"]{3,290}$#',$link)) cl_fail('Links must start with https://');
    cl_run('INSERT INTO chinalife_events(title,body,city,place,reward,billboard,link,starts_at,ends_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL ? HOUR),?,NOW())','ssssiisii',[$title,$body,$city,$place,$reward,$billboard,$link,$hours,$uid]);
    $id=(int)$db->insert_id;admin_log('create_event',null,$reward,$title);json_response('success',['id'=>$id]);
}
if ($action==='end_event') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);if (!$id) cl_fail('Choose an event');
    cl_run('UPDATE chinalife_events SET ends_at=NOW() WHERE id=? AND ends_at>NOW()','i',[$id]);admin_log('end_event',null,null,(string)$id);json_response('success',['ended'=>true]);
}
if ($action==='cities') json_response('success',['open'=>cl_open_cities()]);
// Gossip hot seat moderation: list recent gists (reported first), hide/unhide, delete, and the on/off switch.
if (str_starts_with((string)$action,'football')||$action==='set_football') require __DIR__.'/football-admin.php';
if ($action==='hot_seat') {
    require_once __DIR__.'/hot-seat-lib.php';
    $rows=cl_optional_rows("SELECT h.id,h.user_id,u.user_name,h.city,h.body,h.status,h.true_votes,h.cap_votes,h.reports,h.created_at FROM chinalife_hot_seat h LEFT JOIN users u ON u.user_id=h.user_id ORDER BY h.reports>0 DESC,h.id DESC LIMIT 60");
    json_response('success',['enabled'=>cl_hot_seat_enabled(),'gists'=>$rows]);
}
if ($action==='set_hot_seat') {
    $on=$input['enabled']??null;if (!is_bool($on)) cl_fail('Choose on or off');
    $db->begin_transaction();cl_run("INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('hot_seat','{}',NOW())");
    cl_one("SELECT value FROM chinalife_settings WHERE name='hot_seat' FOR UPDATE");
    cl_run("UPDATE chinalife_settings SET value=?,updated_at=NOW() WHERE name='hot_seat'",'s',[json_encode(['enabled'=>$on])]);
    admin_log('set_hot_seat',null,null,$on?'on':'off');$db->commit();json_response('success',['enabled'=>$on]);
}
// Gossip Room Phase 6 (appadmin Gossip tab): settings over the defaults (gossip-settings.php) and one moderation queue
// for reported Hot Seat gists and wall tips. Admins see who posted; players never do.
if ($action==='gossip_settings') {
    require_once __DIR__.'/gossip-settings.php';
    json_response('success',['settings'=>cl_gossip_settings(),'defaults'=>cl_gossip_defaults(),
        'switches'=>array_intersect_key(cl_hafrik_features(),array_flip(['gossip_room','gossip_show','gossip_wall','gossip_city','gossip_rep']))]);
}
if ($action==='set_gossip_settings') {
    require_once __DIR__.'/gossip-settings.php';
    $s=cl_gossip_valid(is_array($input['settings']??null)?$input['settings']:[],$error);if (!$s) cl_fail($error??'Check the settings');
    $d=cl_gossip_defaults();$changed=array_filter($s,fn($v,$k)=>$v!==$d[$k],ARRAY_FILTER_USE_BOTH);$before=cl_gossip_settings();
    cl_run("INSERT INTO chinalife_settings(name,value,updated_at) VALUES('gossip',?,NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=NOW()",'s',[json_encode((object)$changed,JSON_UNESCAPED_UNICODE)]);
    admin_log('set_gossip_settings',null,null,implode(' · ',array_map(fn($k)=>$k.': '.json_encode($before[$k],JSON_UNESCAPED_UNICODE).' → '.json_encode($s[$k],JSON_UNESCAPED_UNICODE),array_keys(array_filter($s,fn($v,$k)=>$v!==$before[$k],ARRAY_FILTER_USE_BOTH))))?:'No changes');
    json_response('success',['settings'=>$s]);
}
if ($action==='gossip_queue') {
    $hs=cl_optional_rows("SELECT h.id,h.user_id,u.user_name,h.body,h.status,h.reports,h.created_at FROM chinalife_hot_seat h LEFT JOIN users u ON u.user_id=h.user_id WHERE h.reports>0 OR h.status='hidden' ORDER BY h.id DESC LIMIT 50");
    // Before migrate.php adds the wall's hidden/reports columns (1054), the wall part of the queue is simply empty.
    try {$wall=cl_optional_rows("SELECT g.id,g.user_id,u.user_name,g.body,g.hidden,g.reports,g.created_at FROM chinalife_gist_night g LEFT JOIN users u ON u.user_id=g.user_id WHERE g.reports>0 OR g.hidden=1 ORDER BY g.id DESC LIMIT 50");}
    catch (mysqli_sql_exception $e) {if ($e->getCode()!==1054) throw $e;$wall=[];}
    $items=[];
    foreach ($hs as $r) $items[]=['kind'=>'hotseat','id'=>(string)$r['id'],'author'=>$r['user_name'],'author_id'=>(string)$r['user_id'],'body'=>$r['body'],'hidden'=>$r['status']==='hidden','reports'=>(int)$r['reports'],'at'=>$r['created_at']];
    foreach ($wall as $r) $items[]=['kind'=>'wall','id'=>(string)$r['id'],'author'=>$r['user_name'],'author_id'=>(string)$r['user_id'],'body'=>$r['body'],'hidden'=>(int)$r['hidden']===1,'reports'=>(int)$r['reports'],'at'=>$r['created_at']];
    usort($items,fn($a,$b)=>strcmp($b['at'],$a['at']));
    json_response('success',['items'=>$items]);
}
if ($action==='gossip_moderate') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$op=$input['op']??'';
    if (!$id||!in_array($op,['hide','restore','delete'],true)) cl_fail('Choose a tip and hide, restore or delete');
    $row=cl_one('SELECT body FROM chinalife_gist_night WHERE id=?','i',[$id]);if (!$row) cl_fail('That tip is gone',404);
    if ($op==='delete') cl_run('DELETE FROM chinalife_gist_night WHERE id=?','i',[$id]);
    elseif ($op==='hide') cl_run('UPDATE chinalife_gist_night SET hidden=1 WHERE id=?','i',[$id]);
    else {cl_run('UPDATE chinalife_gist_night SET hidden=0,reports=0 WHERE id=?','i',[$id]);cl_run('DELETE FROM chinalife_gist_night_reports WHERE post_id=?','i',[$id]);}
    admin_log('gossip_wall_'.$op,$id,null,mb_substr($row['body'],0,120));json_response('success',['id'=>(string)$id,'op'=>$op]);
}
if ($action==='hot_seat_moderate') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$op=$input['op']??'';
    if (!$id||!in_array($op,['hide','unhide','delete'],true)) cl_fail('Choose a gist and hide, unhide or delete');
    $row=cl_one('SELECT body FROM chinalife_hot_seat WHERE id=?','i',[$id]);if (!$row) cl_fail('That gist is gone',404);
    if ($op==='delete') cl_run('DELETE FROM chinalife_hot_seat WHERE id=?','i',[$id]);
    elseif ($op==='hide') cl_run("UPDATE chinalife_hot_seat SET status='hidden',hidden_by=? WHERE id=?",'ii',[$uid,$id]);
    else cl_run("UPDATE chinalife_hot_seat SET status=IF(closes_at>NOW(),'voting','revealed'),hidden_by=NULL,reports=0 WHERE id=? AND status='hidden'",'i',[$id]);
    admin_log('hot_seat_'.$op,$id,null,mb_substr($row['body'],0,120));json_response('success',['id'=>(string)$id,'op'=>$op]);
}
if ($action==='world_layout') json_response('success',['layout'=>cl_world_layout(),'places'=>CL_ONE_CITY_PLACES,'open'=>cl_open_cities()]);
if ($action==='set_world_layout') {
    $layout=cl_valid_world_layout($input['layout']??null);if (!$layout) cl_fail('Choose a valid world layout');
    $db->begin_transaction();cl_run("INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('world_layout','{}',NOW())");
    cl_one("SELECT value FROM chinalife_settings WHERE name='world_layout' FOR UPDATE");$value=json_encode($layout);
    cl_run("UPDATE chinalife_settings SET value=?,updated_at=NOW() WHERE name='world_layout'",'s',[$value]);$db->commit();
    admin_log('set_world_layout',null,null,$value);json_response('success',['layout'=>$layout]);
}
if ($action==='set_cities') {
    $all=['China','Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'];$open=$input['open']??null;
    if (!is_array($open)||!count($open)||array_diff($open,$all)) cl_fail('Choose valid cities');
    $db->begin_transaction();cl_one("SELECT value FROM chinalife_settings WHERE name='open_cities' FOR UPDATE");$before=cl_open_cities();
    $value=json_encode(array_values(array_unique($open)));
    cl_run('INSERT INTO chinalife_settings(name,value,updated_at) VALUES(\'open_cities\',?,NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=NOW()','s',[$value]);
    cl_life_city_launches($before,$open);$db->commit();
    admin_log('set_cities',null,null,$value);json_response('success',['open'=>json_decode($value,true)]);
}
if ($action==='reports') {
    json_response('success',['reports'=>cl_rows('SELECT r.reason,r.message_body body,r.created_at,a.user_name reporter,b.user_name sender FROM chinalife_reports r LEFT JOIN users a ON a.user_id=r.reporter_id LEFT JOIN users b ON b.user_id=r.sender_id ORDER BY r.created_at DESC LIMIT 50'),'playerReports'=>cl_rows('SELECT r.reason,r.note,r.city,r.place,r.created_at,a.user_name reporter,b.user_name player,(SELECT COUNT(*) FROM chinalife_player_reports x WHERE x.peer_id=r.peer_id) total FROM chinalife_player_reports r LEFT JOIN users a ON a.user_id=r.reporter_id LEFT JOIN users b ON b.user_id=r.peer_id ORDER BY r.created_at DESC LIMIT 50')]);
}
// University Years settings (University tab). Only changes from the defaults are stored, so untouched values follow the code.
if (in_array($action,['university_settings','set_university_settings','student','student_update'],true)) {
 require_once __DIR__.'/university-settings.php';define('CL_UNI_FUNCTIONS_ONLY',true);require_once __DIR__.'/university.php';
}
if ($action==='university_settings') {
 json_response('success',['settings'=>cl_uni_settings(),'defaults'=>cl_uni_defaults(),'numbers'=>array_map(fn($n)=>['min'=>$n[1],'max'=>$n[2],'label'=>$n[3]],cl_uni_numbers()),
  'switches'=>array_intersect_key(cl_hafrik_features(),array_flip(['uni_years','uni_food','wardrobe_locks','micro_style','real_sitting'])),
  'log'=>cl_rows("SELECT l.action,l.note,l.created_at,u.user_name target,a.user_name admin FROM chinalife_admin_log l LEFT JOIN users u ON u.user_id=l.target_id LEFT JOIN users a ON a.user_id=l.admin_id WHERE l.action IN ('set_university_settings','student_update') ORDER BY l.id DESC LIMIT 30")]);
}
if ($action==='set_university_settings') {
 $s=cl_uni_valid_settings(is_array($input['settings']??null)?$input['settings']:[],$error);if(!$s)cl_fail($error??'Check the settings');
 $defaults=cl_uni_defaults();$changed=array_filter($s,fn($v,$k)=>$v!==$defaults[$k],ARRAY_FILTER_USE_BOTH);$before=cl_uni_settings();
 cl_run("INSERT INTO chinalife_settings(name,value,updated_at) VALUES('university',?,NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=NOW()",'s',[json_encode((object)$changed,JSON_UNESCAPED_UNICODE)]);
 $labels=cl_uni_numbers();
 admin_log('set_university_settings',null,null,implode(' · ',array_map(fn($k)=>($labels[$k][3]??$k).(is_int($s[$k])?': '.$before[$k].' → '.$s[$k]:' changed'),array_keys(array_filter($s,fn($v,$k)=>$v!==$before[$k],ARRAY_FILTER_USE_BOTH))))?:'No changes');
 json_response('success',['settings'=>$s]);
}
// A student's university record: what the game shows them, and admin fixes. Admin changes pay no rewards.
if ($action==='student'||$action==='student_update') {
 $target=filter_var($input['user_id']??null,FILTER_VALIDATE_INT);if(!$target)cl_fail('Choose a player');
 [$today,$minute]=cl_uni_now();$db->begin_transaction();$g=cl_lock_character((int)$target);
 $u=is_array($g['university']??null)&&isset($g['university']['start'])?$g['university']:null;
 if($action==='student_update'){
  if(($g['background']??'')!=='Student'){$db->rollback();cl_fail('This player is not a student',409);}
  $op=(string)($input['op']??'');$year=filter_var($input['year']??null,FILTER_VALIDATE_INT);$note='';
  if($op==='restart'){unset($g['university']);if(isset($g['student']))unset($g['student']['graduated']);$u=null;$note='University restarted (enrols again on next visit)';}
  else{
   if(!$u)$u=cl_uni_enrol($today);
   if($op==='year'){if(!$year||$year<1||$year>CL_UNI_YEARS){$db->rollback();cl_fail('Choose Year 1 to 4');}
    $d=cl_uni_date($today);$monday=$d->modify('-'.((int)$d->format('N')-1).' days');$u['start']=$monday->modify('-'.(($year-1)*7).' days')->format('Y-m-d');if($u['enrolled']>$u['start'])$u['enrolled']=$u['start'];$note='Moved to Year '.$year;}
   elseif($op==='pass'||$op==='unpass'){if(!$year||$year<1||$year>CL_UNI_YEARS){$db->rollback();cl_fail('Choose Year 1 to 4');}
    $u['results']=is_array($u['results']??null)?$u['results']:[];if($op==='pass')$u['results'][(string)$year]=['passed'=>true,'score'=>CL_UNI_QUESTIONS,'total'=>CL_UNI_QUESTIONS,'on'=>$today,'admin'=>true];else unset($u['results'][(string)$year]);
    $note=($op==='pass'?'Passed':'Cleared').' the Year '.$year.' exam';}
   elseif($op==='resit'){$u['attempts']=array_filter(is_array($u['attempts']??null)?$u['attempts']:[],fn($d)=>$d!==$today);$u['exam']=null;$note='Can sit today’s exams again';}
   elseif($op==='attendance'){$points=filter_var($input['points']??null,FILTER_VALIDATE_INT);if($points===false||$points===null||$points<-100||$points>100||!$points){$db->rollback();cl_fail('Enter -100 to 100 attendance points');}
    $y=(string)cl_uni_view($u,$today,$minute)['year'];$u['libBonus']=is_array($u['libBonus']??null)?$u['libBonus']:[];$u['libBonus'][$y]=max(-200,min(200,(int)($u['libBonus'][$y]??0)+$points));$note=($points>0?'+':'').$points.' attendance (Year '.$y.')';}
   elseif($op==='major'){$m=(string)($input['major']??'');if($m===''){unset($u['major']);$note='Major cleared';}elseif(isset(cl_uni_lab()[$m])){$u['major']=$m;$note='Major set to '.cl_uni_lab()[$m]['name'];}else{$db->rollback();cl_fail('Choose a major');}}
   elseif($op==='graduate'){$u['graduated']=$today;$g['student']=is_array($g['student']??null)?$g['student']:[];$g['student']['graduated']=$today;
    if(is_array($g['wardrobe']['owned']??null)&&!in_array('grad-blazer',$g['wardrobe']['owned'],true))$g['wardrobe']['owned'][]='grad-blazer';$note='Marked graduated';}
   elseif($op==='ungraduate'){unset($u['graduated'],$u['intro']);if(isset($g['student']))unset($g['student']['graduated']);$note='Graduation undone';}
   elseif($op==='allowance'){$g['allowance']=['day'=>'','total'=>(int)($g['allowance']['total']??0)];$note='Can collect today’s allowance again';}
   else{$db->rollback();cl_fail('Unknown change');}
   $g['university']=$u;
  }
  cl_store_character((int)$target,$g);admin_log('student_update',(int)$target,null,$note);
 }
 $db->commit();
 json_response('success',['student'=>($g['background']??'')==='Student','graduatedFlag'=>$g['student']['graduated']??null,'allowance'=>$g['allowance']??null,
  'university'=>$u?cl_uni_view($u,$today,$minute)+['labCreditsTotal'=>(int)($u['labCredits']??0)]:null,'majors'=>array_map(fn($k,$m)=>['id'=>$k,'name'=>$m['name']],array_keys(cl_uni_lab()),cl_uni_lab())]);
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
    $db->begin_transaction();$game=cl_lock_character((int)$target);$from=(int)($game['xp']??0);
    $held=cl_balances_lock((int)$target);cl_balance_write((int)$target,$held['coins'],(int)$ranks[$i]['xp']);
    $game['money']=$held['coins'];$game['xp']=$ranks[$i]['xp'];$game['rankClaimed']=$i;
    cl_store_character((int)$target,$game);
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
    $status=$input['status']??'all';$page=$input['page']??0;if (!is_int($page)||$page<0||$page>100000) cl_fail('Choose a page');$offset=$page*100;if (!in_array($status,['pending','approved','declined','all'],true)) cl_fail('Choose a status');
    $rows=cl_rows('SELECT a.id,a.service,a.name,a.contact,a.city,a.message,a.status,a.admin_note,a.created_at,u.user_name username FROM chinalife_applications a LEFT JOIN users u ON u.user_id=a.user_id'.($status==='all'?'':' WHERE a.status=?').' ORDER BY a.id DESC LIMIT 101 OFFSET ?',$status==='all'?'i':'si',$status==='all'?[$offset]:[$status,$offset]);
    $hasMore=count($rows)>100;if($hasMore)array_pop($rows);foreach ($rows as &$r) $r['id']=(string)$r['id'];unset($r);
    json_response('success',['page'=>$page,'hasMore'=>$hasMore,'applications'=>$rows,'services'=>require __DIR__.'/services-config.php','pending'=>(int)cl_one('SELECT COUNT(*) n FROM chinalife_applications WHERE status="pending"')['n']]);
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
    [,$musicUrl]=cl_music_storage();
    foreach ($rows as &$r){$r['id']=(string)$r['id'];$r['user_id']=(string)$r['user_id'];$r['data']=json_decode($r['data'],true)?:[];
        // Admins listen to an artist's songs before approving.
        foreach ($r['data']['songs']??[] as $k=>$sg){$f=cl_one('SELECT file,duration FROM chinalife_songs WHERE id=?','s',[$sg['id']]);$r['data']['songs'][$k]['url']=$f?$musicUrl.$f['file']:'';$r['data']['songs'][$k]['duration']=(int)($f['duration']??0);}}unset($r);
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
        // For ads and events the admin decides where it runs: city ('' = every city, ads only) and venue.
        if (in_array($kind,['event','ad'],true)&&array_key_exists('city',$input)) {$oc=(string)$input['city'];
            if ($oc===''){if ($kind==='event'){$db->rollback();cl_fail('Choose a city for the event');}$d['all_cities']=true;}
            else {if (!in_array($oc,CL_CITIES,true)){$db->rollback();cl_fail('Choose a city');}$s['city']=$oc;$d['all_cities']=false;}}
        if (in_array($kind,['event','ad'],true)&&array_key_exists('place',$input)) {$op=(string)$input['place'];
            if ($op===''){if ($kind==='ad'){$db->rollback();cl_fail('Choose a venue for the ad');}$d['place']='';}
            else {[,$op]=cl_room(['city'=>'Shenyang','place'=>$op]);if (cl_private_place($op)){$db->rollback();cl_fail('Choose a public venue');}$d['place']=$op;}}
        if (in_array($kind,['restaurant','shop','service','creator','club','artist'],true)) {
            if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_restaurants WHERE city=?','s',[$s['city']])['n']>=200){$db->rollback();cl_fail('This city already has 200 partner listings',409);}
            $menu=json_encode(array_map(fn($i)=>[$i['name'],$i['price'],$i['photo']??'',$i['description']??''],$d['items']??[]),JSON_UNESCAPED_UNICODE);
            $q=cl_query('INSERT INTO chinalife_restaurants(city,name,icon,district,description,menu,order_link,wechat_id,whatsapp,active,kind,photos,links,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,NOW(),NOW())','ssssssssssssi',
                [$s['city'],$s['title'],$d['icon']??'🍽',$d['district']??'',mb_substr($d['description']??'',0,300),$menu,$d['order_link']??'',$d['wechat_id']??'',$d['whatsapp']??'',$kind,json_encode($d['photos']??[]),json_encode($d['links']??[]),(int)$s['user_id']]);
            $rid=$q->insert_id;$q->close();if (($d['near']??'')!=='') cl_run('INSERT INTO chinalife_restaurant_places(restaurant_id,near) VALUES(?,?)','is',[$rid,$d['near']]);$listing='listing:'.$rid;
            // An artist's songs go live with them, under the titles they gave.
            foreach ($d['songs']??[] as $sg) cl_run('UPDATE chinalife_songs SET listing_id=?,active=1,title=? WHERE id=? AND user_id=?','issi',[$rid,$sg['title'],$sg['id'],(int)$s['user_id']]);
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
    cl_run('UPDATE chinalife_submissions SET status=?,admin_note=?,listing=?,city=?,reviewed_by=?,reviewed_at=NOW(),updated_at=NOW() WHERE id=?','ssssii',[$decision==='approve'?'approved':($decision==='changes'?'changes':'rejected'),$note,$listing,$s['city'],$uid,$id]);
    $db->commit();admin_log('review_partner',(int)$s['user_id'],null,$decision.' · '.$s['kind'].' · '.$s['title']);json_response('success',['status'=>$decision,'listing'=>$listing]);
}
// Admins edit any partner application; if it is live, the game updates at once. Admins may add photos too.
if ($action==='partner_upload') {
    [$bytes,$mime,$w,$h]=cl_image($input['image']??null,2097152,120,120);$mid=bin2hex(random_bytes(12));
    cl_run('INSERT INTO chinalife_media(id,user_id,mime,width,height,bytes,created_at) VALUES(?,?,?,?,?,?,NOW())','sisiis',[$mid,$uid,$mime,$w,$h,$bytes]);json_response('success',['id'=>$mid]);
}
if ($action==='partner_update') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$s=$id?cl_one('SELECT * FROM chinalife_submissions WHERE id=?','i',[$id]):null;if (!$s) cl_fail('Application not found',404);
    [$city,$title,$d]=cl_partner_data($s['kind'],is_array($input['fields']??null)?$input['fields']:[],(int)$s['user_id'],true);
    $db->begin_transaction();
    [$type,$lid]=array_pad(explode(':',$s['listing'],2),2,'');$lid=(int)$lid;
    if ($s['status']==='approved'&&$lid) {
        if ($type==='listing') {
            $menu=json_encode(array_map(fn($i)=>[$i['name'],$i['price'],$i['photo']??'',$i['description']??''],$d['items']??[]),JSON_UNESCAPED_UNICODE);
            cl_run('UPDATE chinalife_restaurants SET city=?,name=?,icon=?,district=?,description=?,menu=?,order_link=?,wechat_id=?,whatsapp=?,photos=?,links=?,updated_at=NOW() WHERE id=?','sssssssssssi',[$city,$title,$d['icon'],$d['district']??'',mb_substr($d['description']??'',0,300),$menu,$d['order_link']??'',$d['wechat_id']??'',$d['whatsapp']??'',json_encode($d['photos']??[]),json_encode($d['links']??[]),$lid]);
            cl_run('DELETE FROM chinalife_restaurant_places WHERE restaurant_id=?','i',[$lid]);if (($d['near']??'')!=='') cl_run('INSERT INTO chinalife_restaurant_places(restaurant_id,near) VALUES(?,?)','is',[$lid,$d['near']]);
            $keep=array_column($d['songs']??[],'id');foreach (cl_rows('SELECT id FROM chinalife_songs WHERE listing_id=?','i',[$lid]) as $old) if (!in_array($old['id'],$keep,true)) cl_run('UPDATE chinalife_songs SET active=0,listing_id=NULL WHERE id=?','s',[$old['id']]);
            foreach ($d['songs']??[] as $sg) cl_run('UPDATE chinalife_songs SET listing_id=?,active=1,title=? WHERE id=?','iss',[$lid,$sg['title'],$sg['id']]);
        } elseif ($type==='event') {
            cl_run('UPDATE chinalife_events SET title=?,body=?,city=?,place=?,link=?,starts_at=FROM_UNIXTIME(?),ends_at=FROM_UNIXTIME(?) WHERE id=?','sssssiii',[$title,mb_substr($d['description']??'',0,300),$city,$d['place']??'',$d['link']??'',(int)$d['starts'],(int)$d['ends'],$lid]);
        } elseif ($type==='ad') {
            cl_run('UPDATE chinalife_ads SET title=?,city=?,place=?,link=?,ends_at=DATE_ADD(starts_at,INTERVAL ? DAY),updated_at=NOW() WHERE id=?','ssssii',[$title,!empty($d['all_cities'])?'':$city,$d['place']??'night',$d['link']??'',(int)($d['days']??30),$lid]);
            $m=cl_one('SELECT bytes,mime,width,height FROM chinalife_media WHERE id=?','s',[$d['photos'][0]??'']);if ($m) cl_run('UPDATE chinalife_ads SET image=?,mime=?,width=?,height=? WHERE id=?','ssiii',[$m['bytes'],$m['mime'],(int)$m['width'],(int)$m['height'],$lid]);
        }
    }
    cl_run('UPDATE chinalife_submissions SET city=?,title=?,data=?,updated_at=NOW() WHERE id=?','sssi',[$city,$title,json_encode($d,JSON_UNESCAPED_UNICODE),$id]);
    $db->commit();admin_log('edit_partner',(int)$s['user_id'],null,$s['kind'].' · '.$title);json_response('success',['updated'=>true]);
}
// Deleting removes the application and everything it put into the game (listing, map spot, songs and their files, event, ad).
if ($action==='partner_delete') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$s=$id?cl_one('SELECT * FROM chinalife_submissions WHERE id=?','i',[$id]):null;if (!$s) cl_fail('Application not found',404);
    $d=json_decode($s['data'],true)?:[];[$type,$lid]=array_pad(explode(':',$s['listing'],2),2,'');$lid=(int)$lid;[$dir]=cl_music_storage();
    $db->begin_transaction();
    $songIds=array_column($d['songs']??[],'id');if ($type==='listing'&&$lid) foreach (cl_rows('SELECT id FROM chinalife_songs WHERE listing_id=?','i',[$lid]) as $r) $songIds[]=$r['id'];
    $files=[];foreach (array_unique($songIds) as $sid){$f=cl_one('SELECT file FROM chinalife_songs WHERE id=?','s',[$sid]);if ($f){$files[]=$f['file'];cl_run('DELETE FROM chinalife_songs WHERE id=?','s',[$sid]);}}
    if ($type==='listing'&&$lid) cl_run('DELETE FROM chinalife_restaurants WHERE id=?','i',[$lid]);
    if ($type==='event'&&$lid) cl_run('DELETE FROM chinalife_events WHERE id=?','i',[$lid]);
    if ($type==='ad'&&$lid) cl_run('DELETE FROM chinalife_ads WHERE id=?','i',[$lid]);
    cl_run('DELETE FROM chinalife_submissions WHERE id=?','i',[$id]);$db->commit();
    foreach ($files as $f) if (preg_match('/^[a-f0-9]{16}\.(mp3|m4a|wav)$/',$f)) @unlink($dir.'/'.$f);
    admin_log('delete_partner',(int)$s['user_id'],null,$s['kind'].' · '.$s['title']);json_response('success',['deleted'=>true]);
}
// ChinaLife Radio: every approved song, with take down / put back.
if ($action==='songs') json_response('success',['songs'=>cl_songs('',true)]);
if ($action==='song_active') {
    $id=(string)($input['id']??'');if (!preg_match('/^[a-f0-9]{16}$/',$id)||!cl_one('SELECT id FROM chinalife_songs WHERE id=? AND listing_id IS NOT NULL','s',[$id])) cl_fail('Song not found',404);
    $on=!empty($input['active'])?1:0;cl_run('UPDATE chinalife_songs SET active=? WHERE id=?','is',[$on,$id]);admin_log($on?'song_on':'song_off',null,null,$id);json_response('success',['active'=>(bool)$on]);
}
if ($action==='ads') json_response('success',['ads'=>cl_ads('',true)]);
if ($action==='save_ad') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);$title=trim((string)($input['title']??''));$sponsor=trim((string)($input['sponsor']??''));$link=trim((string)($input['link']??''));
    $city=(string)($input['city']??'');$place=(string)($input['place']??'night');$days=$input['days']??30;$active=!empty($input['active'])?1:0;
    if ($title===''||mb_strlen($title)>80||mb_strlen($sponsor)>80) cl_fail('Give the ad a title (up to 80 characters)');
    if ($city!==''&&!in_array($city,['China','Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true)) cl_fail('Choose a city');
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
