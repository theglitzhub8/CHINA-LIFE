<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET']);cl_rate('online',20,60);
// Players count as online while their presence heartbeat is under a minute old.
$rows=cl_rows('SELECT city,COUNT(*) n FROM chinalife_presence WHERE seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND) GROUP BY city');
$cities=[];$online=0;foreach ($rows as $row) {$cities[$row['city']]=(int)$row['n'];$online+=(int)$row['n'];}
$players=(int)cl_one('SELECT COUNT(*) n FROM chinalife_saves')['n'];
json_response('success',['online'=>$online,'cities'=>$cities,'players'=>$players]);
