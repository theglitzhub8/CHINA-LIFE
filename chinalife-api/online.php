<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';require_once __DIR__.'/cache-lib.php';
cl_methods(['GET']);cl_rate('online',20,60);
// Players count as online while their presence heartbeat is under a minute old.
[$rows,$players]=cl_cache('online',10,static fn()=>[cl_rows('SELECT city,COUNT(*) n FROM chinalife_presence WHERE seen_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND) GROUP BY city'),(int)cl_one('SELECT COUNT(*) n FROM chinalife_saves')['n']]);
$cities=[];$online=0;foreach ($rows as $row) {$cities[$row['city']]=(int)$row['n'];$online+=(int)$row['n'];}
cl_reply(['online'=>$online,'cities'=>$cities,'players'=>$players]);
