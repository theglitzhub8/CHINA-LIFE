<?php
declare(strict_types=1);
// Quick phrases ("Hello", "Unmute your mic"…) sent to a player in the same venue. Only phrases from a fixed list
// are accepted, so nothing free-form passes through here. Everyone in the room sees the bubble over the sender;
// the chosen player also hears it. They are delivered with the presence poll and expire after a few seconds.
require_once __DIR__.'/common.php';
cl_methods(['POST']);$input=cl_body();
// Street mode: both players are walking the same city's streets (positions refreshed in the last 30 s).
if(!empty($input['street'])){
 $city=$input['city']??'';if(!in_array($city,['China','Shenyang','Guangzhou','Shenzhen','Beijing','Shanghai','Chengdu','Harbin'],true))cl_fail('Choose a valid city');
 if(!cl_one('SELECT user_id FROM chinalife_presence WHERE user_id=? AND city=? AND street_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND)','is',[$uid,$city]))cl_fail('Walk the city streets first',409);
 $phrase=$input['phrase']??'';if(!is_string($phrase)||!in_array($phrase,cl_gesture_phrases(),true))cl_fail('Choose a phrase');
 $to=cl_peer($input['to']??null);if(cl_blocked($uid,$to))cl_fail('You cannot message this player',403);
 if(!cl_one('SELECT user_id FROM chinalife_presence WHERE user_id=? AND city=? AND street_at>=DATE_SUB(NOW(),INTERVAL 30 SECOND)','is',[$to,$city]))cl_fail('That player has left the street',404);
 cl_rate('gesture',6,10);
 cl_run('INSERT INTO chinalife_gestures(sender_id,target_id,city,place,phrase) VALUES(?,?,?,?,?)','iisss',[$uid,$to,$city,'street',$phrase]);
 json_response('success',['id'=>(string)$db->insert_id,'sent'=>true]);
}
[$city,$place]=cl_scoped_room($input);cl_presence($uid,$city,$place);
$phrase=$input['phrase']??'';if(!is_string($phrase)||!in_array($phrase,cl_gesture_phrases(),true))cl_fail('Choose a phrase');
$to=null;if(($input['to']??null)!==null){$to=cl_peer($input['to']);if(cl_blocked($uid,$to))cl_fail('You cannot message this player',403);
 if(!cl_one('SELECT user_id FROM chinalife_presence WHERE user_id=? AND city=? AND place=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','iss',[$to,$city,$place]))cl_fail('That player is no longer here',404);}
cl_rate('gesture',6,10);
cl_run('INSERT INTO chinalife_gestures(sender_id,target_id,city,place,phrase) VALUES(?,?,?,?,?)','iisss',[$uid,$to,$city,$place,$phrase]);
$gestureId=(string)$db->insert_id;
if(random_int(1,40)===1)cl_run('DELETE FROM chinalife_gestures WHERE created_at<DATE_SUB(NOW(),INTERVAL 1 HOUR)','',[]);
json_response('success',['id'=>$gestureId,'sent'=>true]);
