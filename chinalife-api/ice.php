<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET']);cl_rate('ice',10,60);
// Cloudflare TURN relays voice when players cannot connect directly (mobile data, strict Wi-Fi).
// The API token stays on the server in turn-config.php (not in git) or environment variables.
$stun=[['urls'=>['stun:stun.cloudflare.com:3478']]];
$config=is_file(__DIR__.'/turn-config.php')?require __DIR__.'/turn-config.php':[];
$keyId=getenv('CHINALIFE_TURN_KEY_ID')?:(string)($config['key_id']??'');
$token=getenv('CHINALIFE_TURN_API_TOKEN')?:(string)($config['api_token']??'');
if (!preg_match('/^[0-9a-f]{32}$/',$keyId)||$token==='') json_response('success',['iceServers'=>$stun,'turn'=>false]);
$url='https://rtc.live.cloudflare.com/v1/turn/keys/'.$keyId.'/credentials/generate-ice-servers';
$curl=curl_init($url);
curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token,'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode(['ttl'=>86400])]);
$body=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
$servers=is_string($body)&&$status>=200&&$status<300?(json_decode($body,true)['iceServers']??null):null;
if (!is_array($servers)) {error_log('ChinaLife TURN credentials failed with HTTP '.$status);json_response('success',['iceServers'=>$stun,'turn'=>false]);}
if (isset($servers['urls'])) $servers=[$servers];
foreach ($servers as &$server) {
    // Browsers time out on Cloudflare's port 53 alternates, delaying every connection.
    $server['urls']=array_values(array_filter((array)$server['urls'],fn($u)=>is_string($u)&&!preg_match('/:53(\?|$)/',$u)));
}unset($server);
json_response('success',['iceServers'=>$servers,'turn'=>true]);
