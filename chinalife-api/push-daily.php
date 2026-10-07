<?php
declare(strict_types=1);
// CLI only (cron): sends the daily reminder to every subscribed browser. The push has no body;
// the game's service worker shows the daily reward message.
if (PHP_SAPI !== 'cli') {http_response_code(404);exit;}
require_once __DIR__.'/../db.php';require_once __DIR__.'/../helpers.php';
$config=require __DIR__.'/push-config.php';$db=get_db_connection();
$b64=fn(string $s)=>rtrim(strtr(base64_encode($s),'+/','-_'),'=');
// openssl returns a DER signature; JWT ES256 needs the raw 64-byte R||S.
function der_to_raw(string $der): string {$pos=3;$rLen=ord($der[$pos]);$r=substr($der,$pos+1,$rLen);$pos+=1+$rLen+1;$sLen=ord($der[$pos]);$s=substr($der,$pos+1,$sLen);
    $fix=fn($n)=>str_pad(ltrim($n,"\0"),32,"\0",STR_PAD_LEFT);return $fix($r).$fix($s);}
$key=openssl_pkey_get_private($config['private_pem']);$sent=0;$removed=0;$jwts=[];
foreach ($db->query('SELECT id,endpoint FROM chinalife_push')->fetch_all(MYSQLI_ASSOC) as $row) {
    $parts=parse_url($row['endpoint']);$aud=$parts['scheme'].'://'.$parts['host'].(isset($parts['port'])?':'.$parts['port']:'');
    if (!isset($jwts[$aud])) {$head=$b64(json_encode(['typ'=>'JWT','alg'=>'ES256']));$claims=$b64(json_encode(['aud'=>$aud,'exp'=>time()+12*3600,'sub'=>$config['subject']]));openssl_sign("$head.$claims",$der,$key,OPENSSL_ALGO_SHA256);$jwts[$aud]="$head.$claims.".$b64(der_to_raw($der));}
    $curl=curl_init($row['endpoint']);curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>'',CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,CURLOPT_HTTPHEADER=>['TTL: 43200','Urgency: normal','Content-Length: 0','Authorization: vapid t='.$jwts[$aud].', k='.$config['public']]]);
    curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
    if ($status===404||$status===410) {$db->query('DELETE FROM chinalife_push WHERE id='.(int)$row['id']);$removed++;} elseif ($status>=200&&$status<300) $sent++;
}
echo "Daily reminders sent: $sent, expired removed: $removed\n";
