<?php
declare(strict_types=1);
// Shared Hafrik inbox and device push, after the game action succeeds.
function cl_hafrik_notify(int $recipient,string $kind,string $key,string $message,int $actor=0): void {
 global $db;
 if($recipient<1||!in_array($kind,['vote','friend','money','message','activity','case','city'],true))return;
 try {
  if(!cl_hafrik_features()['notifications'])return;
  $helper=__DIR__.'/../notifications/_admin_notify.php';
  if(!is_file($helper)){error_log('ChinaLife: Hafrik notification helper unavailable');return;}
  require_once $helper;
  v2_notify_user($db,$recipient,['from_user_id'=>$actor,'action'=>'chinalife_'.$kind,'node_type'=>'chinalife','node_url'=>'https://hafrik.com/china-life/#view=inbox&notice='.rawurlencode($key),'notify_id'=>$key,'message'=>$message,'push_title'=>'ChinaLife','push_body'=>$message,'data'=>['type'=>'chinalife_'.$kind,'notice'=>$key]]);
 }catch(Throwable $e){error_log('ChinaLife notification delivery: '.$e->getMessage());}
}
