<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['POST']);$input=cl_body();$peer=cl_peer($input['peer']??null);
if (cl_blocked($uid,$peer)) cl_fail('Player unavailable',403);
[$first,$second]=cl_pair($uid,$peer);$action=$input['action']??'';
$edge=cl_one('SELECT status,requested_by FROM chinalife_friends WHERE first_id=? AND second_id=?','ii',[$first,$second]);
if ($action==='request') {
    cl_rate('friends',20,60);
    if ($edge) json_response('success',['status'=>$edge['status']]);
    $n=cl_one("SELECT COUNT(*) n FROM chinalife_friends WHERE requested_by=? AND status='pending'",'i',[$uid]);
    if ((int)$n['n']>=20) cl_fail('Wait for your pending invitations to be answered',429);
    cl_run("INSERT IGNORE INTO chinalife_friends(first_id,second_id,requested_by,status,created_at) VALUES(?,?,?,'pending',NOW())",'iii',[$first,$second,$uid]);json_response('success',['status'=>'pending']);
}
if ($action==='accept') {
    if (!$edge||$edge['status']!=='pending'||(int)$edge['requested_by']===$uid) cl_fail('Only the recipient can accept',403);
    cl_run("UPDATE chinalife_friends SET status='accepted' WHERE first_id=? AND second_id=? AND status='pending' AND requested_by<>?",'iii',[$first,$second,$uid]);json_response('success',['status'=>'accepted']);
}
if (!in_array($action,['decline','cancel','remove'],true)) cl_fail('Invalid friendship action');
if (!$edge) json_response('success',['ok'=>true]);
if (($action==='cancel'&&(int)$edge['requested_by']!==$uid)||($action==='decline'&&(int)$edge['requested_by']===$uid)||($action==='remove'&&$edge['status']!=='accepted')) cl_fail('This friendship action is unavailable',403);
cl_run('DELETE FROM chinalife_friends WHERE first_id=? AND second_id=?','ii',[$first,$second]);json_response('success',['ok'=>true]);
