<?php
declare(strict_types=1);
// Partner applications (partners.html): restaurants, shops, services, content creators, events and ads.
// Only signed-in players with a ChinaLife character can apply. Photos are uploaded first (action "upload"), then
// the application references them. Admins review in admin.php ("partners"); approval puts it into the game.
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);
if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$uid])) cl_fail('Create your ChinaLife character first, then come back to apply',403);
$mine=function() use ($uid){$rows=cl_rows('SELECT id,kind,city,title,data,status,admin_note,created_at,updated_at FROM chinalife_submissions WHERE user_id=? ORDER BY id DESC LIMIT 50','i',[$uid]);
    foreach ($rows as &$r){$r['id']=(string)$r['id'];$r['data']=json_decode($r['data'],true)?:[];}unset($r);return $rows;};
if ($method==='GET') json_response('success',['submissions'=>$mine(),'username'=>$auth['user_name']??'']);
// Songs arrive as the raw file (not JSON), up to 100 MB: ?action=upload_song&title=…&duration=…
if ($method==='POST'&&($_GET['action']??'')==='upload_song') {
    cl_rate('partner_song',20,3600);
    if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_songs WHERE user_id=?','i',[$uid])['n']>=30) cl_fail('You have uploaded 30 songs. Remove some from your applications first',409);
    $title=trim((string)($_GET['title']??''));$duration=filter_var($_GET['duration']??null,FILTER_VALIDATE_INT);
    if ($title===''||mb_strlen($title)>80) cl_fail('Give the song a title (up to 80 characters)');
    if ($duration===false||$duration<15||$duration>1200) cl_fail('Songs must be between 15 seconds and 20 minutes');
    // Up to 100 MB: the upload is streamed straight to disk (never held in memory), then checked.
    $max=104857600;
    $in=fopen('php://input','rb');$head=$in?(string)fread($in,12):'';
    if ($head==='') cl_fail('The song did not arrive. The server upload limit may be too low (it needs at least 110 MB)');
    // Only real MP3 (ID3 tag or MPEG frame), M4A/AAC (ISO "ftyp" box) or WAV (RIFF…WAVE) files.
    if (str_starts_with($head,'ID3')||(ord($head[0])===0xFF&&(ord($head[1]??"\0")&0xE0)===0xE0)) [$mime,$ext]=['audio/mpeg','mp3'];
    elseif (substr($head,4,4)==='ftyp') [$mime,$ext]=['audio/mp4','m4a'];
    elseif (substr($head,0,4)==='RIFF'&&substr($head,8,4)==='WAVE') [$mime,$ext]=['audio/wav','wav'];
    else cl_fail('Upload an MP3, M4A or WAV song');
    [$dir]=cl_music_storage();
    if (!is_dir($dir)&&!@mkdir($dir,0755,true)) cl_fail('Song storage is not set up on the server yet. Ask the ChinaLife team',503);
    $id=bin2hex(random_bytes(8));$file=$id.'.'.$ext;$part=$dir.'/'.$id.'.part';
    $out=@fopen($part,'xb');if (!$out) cl_fail('Song storage is not writable on the server. Ask the ChinaLife team',503);
    fwrite($out,$head);$size=strlen($head)+stream_copy_to_stream($in,$out,$max+1-strlen($head));fclose($out);fclose($in);
    if ($size>$max){@unlink($part);cl_fail('Songs must be 100 MB or smaller',413);}
    if (!@rename($part,$dir.'/'.$file)){@unlink($part);cl_fail('Song storage is not writable on the server. Ask the ChinaLife team',503);}
    cl_run('INSERT INTO chinalife_songs(id,user_id,title,file,mime,bytes,duration,active,created_at) VALUES(?,?,?,?,?,?,?,0,NOW())','sisssii',[$id,$uid,$title,$file,$mime,$size,$duration]);
    [,$url]=cl_music_storage();
    json_response('success',['id'=>$id,'title'=>$title,'duration'=>$duration,'url'=>$url.$file]);
}
$input=cl_body(3000000);$action=$input['action']??'';
if ($action==='upload') {
    cl_rate('partner_upload',60,3600);
    [$bytes,$mime,$w,$h]=cl_image($input['image']??null,2097152,120,120);
    $id=bin2hex(random_bytes(12));
    cl_run('INSERT INTO chinalife_media(id,user_id,mime,width,height,bytes,created_at) VALUES(?,?,?,?,?,?,NOW())','sisiis',[$id,$uid,$mime,$w,$h,$bytes]);
    json_response('success',['id'=>$id,'width'=>$w,'height'=>$h]);
}
if ($action==='submit') {
    cl_rate('partner_submit',20,3600);
    $kind=(string)($input['kind']??'');[$city,$title,$data]=cl_partner_data($kind,is_array($input['fields']??null)?$input['fields']:[],$uid);
    $json=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);
    if ($id) {
        // Editing an application is allowed while it is waiting or after the admin asked for changes.
        if (!cl_run('UPDATE chinalife_submissions SET kind=?,city=?,title=?,data=?,status="pending",updated_at=NOW() WHERE id=? AND user_id=? AND status IN ("pending","changes")','ssssii',[$kind,$city,$title,$json,$id,$uid])&&!cl_one('SELECT id FROM chinalife_submissions WHERE id=? AND user_id=? AND status IN ("pending","changes")','ii',[$id,$uid])) cl_fail('This application can no longer be edited',409);
    } else {
        if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_submissions WHERE user_id=? AND status IN ("pending","changes")','i',[$uid])['n']>=5) cl_fail('You have 5 applications waiting. Wait for a review before sending more',409);
        $q=cl_query('INSERT INTO chinalife_submissions(user_id,kind,city,title,data,status,created_at,updated_at) VALUES(?,?,?,?,?,"pending",NOW(),NOW())','issss',[$uid,$kind,$city,$title,$json]);$id=$q->insert_id;$q->close();
    }
    json_response('success',['id'=>(string)$id,'submissions'=>$mine()]);
}
if ($action==='withdraw') {
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);
    if (!$id||!cl_run('DELETE FROM chinalife_submissions WHERE id=? AND user_id=? AND status IN ("pending","changes","rejected")','ii',[$id,$uid])) cl_fail('This application cannot be withdrawn',409);
    json_response('success',['submissions'=>$mine()]);
}
cl_fail('Unknown action');
