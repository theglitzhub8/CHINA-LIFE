<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['POST']);cl_admin();cl_rate('admin',60,60);
$input=cl_body();$action=$input['action']??'';
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
    json_response('success',['reports'=>cl_rows('SELECT r.reason,r.message_body body,r.created_at,a.user_name reporter,b.user_name sender FROM chinalife_reports r LEFT JOIN users a ON a.user_id=r.reporter_id LEFT JOIN users b ON b.user_id=r.sender_id ORDER BY r.created_at DESC LIMIT 50')]);
}
cl_fail('Unknown admin action');
