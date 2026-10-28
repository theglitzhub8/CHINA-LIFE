<?php
declare(strict_types=1);
// Gossip Room Phase 5 (switch gossip_rep): your own gist rep (this week and all time) and the weekly Truth teller award.
// Only ever your own: rep is never shown for other players (it would hint at who wrote which gist). The first request
// after a week turns pays last week's award (gossip-rep-lib.php cl_gist_award_due).
require_once __DIR__.'/common.php';
require_once __DIR__.'/gossip-rep-lib.php';
cl_methods(['GET']);cl_rate('gossip_rep',30,60);
if (!cl_gist_rep_on()) json_response('success',['on'=>false]);
cl_gist_award_due();
$last=json_decode((string)(cl_one("SELECT value FROM chinalife_settings WHERE name='gossip_award'")['value']??'{}'),true)?:[];
$place=array_search((string)$uid,$last['winners']??[],true);
json_response('success',['on'=>true,'week'=>cl_gist_rep($uid,cl_gist_week(0)),'total'=>cl_gist_rep($uid),'prizes'=>cl_gist_prizes(),
    'last_week'=>$place===false?null:['place'=>$place+1,'prize'=>cl_gist_prizes()[$place]]]);
