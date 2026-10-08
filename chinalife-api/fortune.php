<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);$catalog=require __DIR__.'/fortune-config.php';
function fortune_ready(array $g,array $spec): bool {
 if(array_diff($spec['discover'],$g['visited']??[]))return false;
 foreach($spec['needs'] as $path=>$minimum){$value=$g;foreach(explode('.',$path) as $key)$value=is_array($value)?($value[$key]??0):0;if(!is_numeric($value)||$value<$minimum)return false;}return true;
}
if($method==='GET'){
 $save=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=?','i',[$uid]);$g=json_decode($save['game_state']??'{}',true);$claimed=array_column(cl_rows('SELECT reward_id FROM chinalife_fortune_claims WHERE user_id=?','i',[$uid]),'reward_id');$list=[];
 foreach($catalog as $id=>$spec){$found=!array_diff($spec['discover'],$g['visited']??[]);$list[]=['id'=>$id,'title'=>$found?$spec['title']:'Hidden opportunity','hint'=>$spec['hint'],'reward'=>$found?$spec['reward']:null,'found'=>$found,'ready'=>fortune_ready($g,$spec),'claimed'=>in_array($id,$claimed,true)];}
 json_response('success',['opportunities'=>$list]);
}
cl_rate('fortune',10,60);$input=cl_body();$id=$input['id']??'';if(!is_string($id)||!isset($catalog[$id]))cl_fail('Choose a discovered opportunity');
$db->begin_transaction();try{
 $save=cl_one('SELECT game_state FROM chinalife_saves WHERE user_id=? FOR UPDATE','i',[$uid]);if(!$save)cl_fail('Save your character first',409);$g=json_decode($save['game_state'],true);$spec=$catalog[$id];
 if(cl_one('SELECT reward_id FROM chinalife_fortune_claims WHERE user_id=? AND reward_id=?','is',[$uid,$id])){$db->commit();json_response('success',['duplicate'=>true]);}
 if(!fortune_ready($g,$spec))cl_fail('Keep building your skills and experience before claiming this opportunity',409);
 $balance=cl_credit($uid,$spec['reward']);cl_run('INSERT INTO chinalife_fortune_claims(user_id,reward_id,amount,claimed_at) VALUES(?,?,?,NOW())','isi',[$uid,$id,$spec['reward']]);$db->commit();json_response('success',['reward'=>$spec['reward'],'balance'=>$balance]);
}catch(Throwable $e){$db->rollback();throw $e;}
