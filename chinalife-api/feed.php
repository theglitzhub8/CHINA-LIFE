<?php
declare(strict_types=1);
// R1: one request a minute for the slow-changing feeds (online, events, golden envelope, shared activities).
// Each part runs the endpoint's own GET code; replies and failures are caught per part, so one failure never breaks the others.
define('CL_FEED', true);
require_once __DIR__.'/common.php';
cl_methods(['GET']);cl_rate('feed',8,60);
$parts=array_values(array_intersect(explode(',',(string)($_GET['parts']??'online,events,golden,activities')),['online','events','golden','activities']));
$out=[];
foreach ($parts as $part) {
    try {
        (static function (string $file): void {global $method,$uid,$db,$input;require __DIR__.'/'.$file.'.php';})($part);
        $out[$part]=['error'=>'No reply'];
    } catch (ClFeedResult $r) {
        $out[$part]=$r->state==='success'?$r->payload:['error'=>$r->getMessage(),'status'=>$r->httpStatus];
    } catch (Throwable $e) {
        error_log('ChinaLife feed '.$part.': '.$e->getMessage());$out[$part]=['error'=>'Unavailable','status'=>500];
    }
}
header('Cache-Control: private, no-store');
json_response('success',$out);
