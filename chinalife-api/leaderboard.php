<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET']);cl_rate('leaderboard',20,60);
// Ranks come from each account's saved XP; no extra table is needed.
$xp="CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.game_state,'$.xp')),'0') AS UNSIGNED)";
$rows=cl_rows("SELECT s.user_id id,u.user_name name,$xp xp FROM chinalife_saves s JOIN users u ON u.user_id=s.user_id ORDER BY xp DESC,s.user_id LIMIT 50");
foreach ($rows as &$row) {$row['own']=(int)$row['id']===$uid;$row['id']=(string)$row['id'];$row['xp']=(int)$row['xp'];}unset($row);
$mine=cl_one("SELECT $xp xp FROM chinalife_saves s WHERE s.user_id=?",'i',[$uid]);
$position=$mine?(int)cl_one("SELECT COUNT(*)+1 n FROM chinalife_saves s WHERE $xp>?",'i',[(int)$mine['xp']])['n']:null;
json_response('success',['players'=>$rows,'position'=>$position]);
