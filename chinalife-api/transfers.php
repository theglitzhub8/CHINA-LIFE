<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);
if($method==='GET') {
 $rows=cl_rows('SELECT t.id,t.sender_id,t.recipient_id,t.amount,t.created_at,s.user_name sender_name,r.user_name recipient_name FROM chinalife_transfers t JOIN users s ON s.user_id=t.sender_id JOIN users r ON r.user_id=t.recipient_id WHERE t.sender_id=? OR t.recipient_id=? ORDER BY t.created_at DESC,t.id DESC LIMIT 20','ii',[$uid,$uid]);
 json_response('success',['transfers'=>$rows]);
}
cl_rate('transfer',10,10);$input=cl_body();$peer=cl_peer($input['peer']??null);$amount=$input['amount']??null;$key=$input['request_id']??'';
if(!is_int($amount)||$amount<1||$amount>1000000)cl_fail('Enter a whole amount from 1 to 1,000,000');
if(!is_string($key)||!preg_match('/^[a-zA-Z0-9-]{16,80}$/',$key))cl_fail('Invalid transfer request');
if(cl_blocked($uid,$peer))cl_fail('Player unavailable',403);
$db->begin_transaction();
try {
 // Always lock in account order, including retries, to prevent deadlocks and overspending.
 $rows=cl_rows('SELECT user_id,game_state,revision FROM chinalife_saves WHERE user_id IN (?,?) ORDER BY user_id FOR UPDATE','ii',[$uid,$peer]);
 $receipt=cl_one('SELECT recipient_id,amount FROM chinalife_transfers WHERE sender_id=? AND id=?','is',[$uid,$key]);
 if($receipt){$db->rollback();if((int)$receipt['recipient_id']!==$peer||(int)$receipt['amount']!==$amount)cl_fail('Request already used',409);json_response('success',['sent'=>true,'duplicate'=>true]);}
 if(count($rows)!==2){$db->rollback();cl_fail('Both players need a saved character',409);}
 $spray=($input['effect']??'')==='spray';$sprayRoom=null;
 if($spray){$sprayRoom=cl_one('SELECT city,place FROM chinalife_presence WHERE user_id=? AND seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)','i',[$uid]);$clubs=require __DIR__.'/shared-config.php';if(!$sprayRoom||!isset($clubs['club-'.$sprayRoom['place']]))cl_fail('Visit a club to spray money',409);cl_presence($peer,$sprayRoom['city'],$sprayRoom['place']);}
 $games=[];foreach($rows as $row)$games[(int)$row['user_id']]=json_decode($row['game_state'],true,512,JSON_THROW_ON_ERROR);
 if(($games[$uid]['money']??0)<$amount){$db->rollback();cl_fail('Not enough money',409);}
 if(($games[$peer]['money']??0)+$amount>1000000000){$db->rollback();cl_fail('Recipient balance is full',409);}
 foreach([$uid=>-$amount,$peer=>$amount] as $id=>$delta){$g=$games[$id];$g['money']+=$delta;$g['transferTotal']=($g['transferTotal']??0)+$delta;cl_run('UPDATE chinalife_saves SET game_state=?,revision=revision+1,updated_at=NOW() WHERE user_id=?','si',[json_encode($g,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$id]);}
 cl_run('INSERT INTO chinalife_transfers(id,sender_id,recipient_id,amount,created_at) VALUES(?,?,?,?,NOW())','siii',[$key,$uid,$peer,$amount]);if($spray)cl_run('INSERT INTO chinalife_gestures(sender_id,target_id,city,place,phrase) VALUES(?,?,?,?,"spray")','iiss',[$uid,$peer,$sprayRoom['city'],$sprayRoom['place']]);$db->commit();json_response('success',['sent'=>true,'amount'=>$amount]);
}catch(Throwable $e){$db->rollback();throw $e;}
