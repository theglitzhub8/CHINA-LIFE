<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET']);cl_rate('leaderboard',20,60);
// Ranks come from the server ledger only. Players whose rank is suspended by an admin are left out.
$xp='COALESCE(b.xp,0)';
$rows=cl_rows("SELECT s.user_id id,u.user_name name,$xp xp FROM chinalife_saves s JOIN users u ON u.user_id=s.user_id LEFT JOIN chinalife_balances b ON b.user_id=s.user_id WHERE NOT EXISTS(SELECT 1 FROM chinalife_rank_suspensions r WHERE r.user_id=s.user_id AND r.until>NOW()) ORDER BY xp DESC,s.user_id LIMIT 50");
foreach ($rows as &$row) {$row['own']=(int)$row['id']===$uid;$row['id']=(string)$row['id'];$row['xp']=(int)$row['xp'];}unset($row);
$mine=cl_one("SELECT $xp xp FROM chinalife_saves s LEFT JOIN chinalife_balances b ON b.user_id=s.user_id WHERE s.user_id=?",'i',[$uid]);
$position=$mine?(int)cl_one("SELECT COUNT(*)+1 n FROM chinalife_saves s LEFT JOIN chinalife_balances b ON b.user_id=s.user_id WHERE $xp>?",'i',[(int)$mine['xp']])['n']:null;
json_response('success',['players'=>$rows,'position'=>$position]);
