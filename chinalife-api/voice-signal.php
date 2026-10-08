<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);$input=$method==='POST'?cl_body():$_GET;
[$city,$place]=cl_scoped_room($input);$session=cl_session($input['session']??null);cl_voice($uid,$session,$city,$place);
cl_run('DELETE FROM chinalife_voice_signals WHERE created_at<DATE_SUB(NOW(),INTERVAL 2 MINUTE)');
if ($method==='POST') {
    cl_rate('signal',120,10);$peer=cl_peer($input['peer']??null);$peerSession=cl_session($input['peerSession']??null);
    if (cl_blocked($uid,$peer)) cl_fail('Voice peer unavailable',403);cl_voice($peer,$peerSession,$city,$place);
    $payload=$input['payload']??null;$type=$payload['type']??null;
    if (!is_array($payload)||!in_array($type,['offer','answer','candidate'],true)) cl_fail('Invalid voice signal');
    if ($type==='candidate') {if (!is_string($payload['candidate']['candidate']??null)||strlen($payload['candidate']['candidate'])>2000) cl_fail('Invalid ICE candidate');}
    elseif (!is_string($payload['sdp']??null)||strlen($payload['sdp'])>20000) cl_fail('Invalid session description');
    $json=json_encode($payload,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);if (strlen($json)>22000) cl_fail('Signal is too large');
    cl_run('INSERT INTO chinalife_voice_signals(sender_id,sender_session,target_id,city,place,target_session,payload,created_at) VALUES(?,?,?,?,?,?,?,NOW())','isissss',[$uid,$session,$peer,$city,$place,$peerSession,$json]);
    json_response('success',['sent'=>true]);
}
$after=filter_var($input['after']??0,FILTER_VALIDATE_INT);if ($after===false||$after<0) cl_fail('Invalid signal cursor');
$rows=cl_rows('SELECT s.id,s.sender_id sender,s.sender_session session,s.payload FROM chinalife_voice_signals s JOIN chinalife_voice_members m ON m.user_id=s.sender_id AND m.session=s.sender_session AND m.city=s.city AND m.place=s.place AND m.seen_at>=DATE_SUB(NOW(),INTERVAL 15 SECOND) JOIN chinalife_presence p ON p.user_id=m.user_id AND p.city=m.city AND p.place=m.place AND p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND) WHERE s.target_id=? AND s.id>? AND s.target_session=? AND s.city=? AND s.place=? AND s.created_at>=DATE_SUB(NOW(),INTERVAL 2 MINUTE) AND NOT EXISTS(SELECT 1 FROM chinalife_blocks b WHERE (b.owner_id=? AND b.peer_id=s.sender_id) OR (b.owner_id=s.sender_id AND b.peer_id=?)) ORDER BY s.id LIMIT 100','iisssii',[$uid,$after,$session,$city,$place,$uid,$uid]);
foreach ($rows as &$row) {$row['id']=(int)$row['id'];$row['sender']=(string)$row['sender'];$row['payload']=json_decode($row['payload'],true);}unset($row);
cl_run('DELETE FROM chinalife_voice_signals WHERE target_id=? AND target_session=? AND id<=?','isi',[$uid,$session,$after]);
json_response('success',['signals'=>$rows]);
