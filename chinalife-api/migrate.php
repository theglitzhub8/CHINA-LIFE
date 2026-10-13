<?php
declare(strict_types=1);
// Execute only from the server CLI; it uses Hafrik's existing database configuration.
if (PHP_SAPI !== 'cli') {http_response_code(404);exit;}
require_once __DIR__.'/../db.php';
require_once __DIR__.'/../helpers.php';
// Hafrik helpers install an HTTP error handler; CLI migrations must fail visibly.
set_exception_handler(function(Throwable $error): void {
    fwrite(STDERR, 'ChinaLife migration failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
});
$db=get_db_connection();
$schema=$db->query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='user_id'")->fetch_assoc();
$type=strtolower($schema['COLUMN_TYPE']??'');
if (!preg_match('/^(int|bigint)(\([0-9]+\))? unsigned$/',$type)) throw new RuntimeException('Expected users.user_id to be INT UNSIGNED or BIGINT UNSIGNED. Check its schema before migrating.');
$files=[__DIR__.'/migration-all.sql'];
$extra=glob(__DIR__.'/migration-*.sql') ?: [];
sort($extra);
foreach ($extra as $file) if (basename($file)!=='migration-all.sql') $files[]=$file;
foreach ($files as $file) {
    $sql=file_get_contents($file);
    if ($sql===false || trim($sql)==='') continue;
    if (str_starts_with($type,'bigint')) $sql=preg_replace('/\bINT UNSIGNED\b/i','BIGINT UNSIGNED',$sql);
    $db->multi_query($sql);
    do {if ($result=$db->store_result()) $result->free();} while ($db->more_results() && $db->next_result());
    if ($db->errno) throw new RuntimeException(basename($file).': '.$db->error);
}
$columns=[['chinalife_presence','street_x','FLOAT NULL'],['chinalife_presence','street_z','FLOAT NULL'],['chinalife_presence','street_h','FLOAT NULL'],['chinalife_presence','street_at','DATETIME NULL'],['chinalife_gist_night','official','TINYINT NOT NULL DEFAULT 0'],['chinalife_weekly_members','reminder','TINYINT NOT NULL DEFAULT 0'],['chinalife_weekly_members','reminded_at','DATETIME NULL'],['chinalife_court_cases','report_id','BIGINT UNSIGNED NULL'],['chinalife_player_reports','request_id',"VARCHAR(80) NOT NULL DEFAULT ''"],['chinalife_politics_votes','period',"VARCHAR(32) NOT NULL DEFAULT ''"],['chinalife_saves','revision','INT UNSIGNED NOT NULL DEFAULT 1'],['chinalife_presence','skin',"CHAR(7) NOT NULL DEFAULT '#8b5c43'"],['chinalife_presence','hair',"VARCHAR(12) NOT NULL DEFAULT 'cropped'"],['chinalife_voice_signals','sender_session',"VARCHAR(80) NOT NULL DEFAULT ''"],['chinalife_presence','activity',"VARCHAR(12) NOT NULL DEFAULT 'idle'"],['chinalife_presence','arrived_at','DATETIME NULL'],['chinalife_restaurants','kind',"VARCHAR(12) NOT NULL DEFAULT 'restaurant'"],['chinalife_restaurants','photos','TEXT NULL'],['chinalife_restaurants','links','TEXT NULL'],['chinalife_restaurants','owner_id','INT UNSIGNED NULL']];
foreach ($columns as [$table,$column,$definition]) {
    $statement=$db->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');$statement->bind_param('ss',$table,$column);$statement->execute();$exists=$statement->get_result()->fetch_row();$statement->close();
    if (!$exists) {$db->query("ALTER TABLE `$table` ADD COLUMN `$column` $definition");echo "Added $table.$column\n";}
}
// Preserve old votes in their matching election before allowing one vote per new period.
$db->query("UPDATE chinalife_politics_votes v SET period=COALESCE((SELECT e.period FROM chinalife_politics_elections e WHERE e.city=v.city AND e.office=v.office AND v.created_at>=e.opens_at AND v.created_at<=e.closes_at ORDER BY e.closes_at DESC LIMIT 1),'legacy') WHERE period=''");
$indexes=[];$result=$db->query('SHOW INDEX FROM chinalife_politics_votes');while($row=$result->fetch_assoc())$indexes[$row['Key_name']]=true;
if(!isset($indexes['one_vote_period']))$db->query('ALTER TABLE chinalife_politics_votes ADD UNIQUE KEY one_vote_period(city,office,period,voter_id)');
if(isset($indexes['one_vote']))$db->query('ALTER TABLE chinalife_politics_votes DROP INDEX one_vote');
$transferColumn=$db->query("SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chinalife_court_cases' AND COLUMN_NAME='transfer_id'")->fetch_assoc();
if(($transferColumn['IS_NULLABLE']??'')==='NO')$db->query('ALTER TABLE chinalife_court_cases MODIFY transfer_id VARCHAR(80) NULL');
$caseIndexes=[];$result=$db->query('SHOW INDEX FROM chinalife_court_cases');while($row=$result->fetch_assoc())$caseIndexes[$row['Key_name']]=true;
if(!isset($caseIndexes['court_report']))$db->query('ALTER TABLE chinalife_court_cases ADD UNIQUE KEY court_report(report_id)');
// Give old reports stable retry keys, then allow a separate report for a new incident.
$db->query("UPDATE chinalife_player_reports SET request_id=CONCAT('legacy-',peer_id,'-',reason) WHERE request_id=''");
$reportIndexes=[];$result=$db->query('SHOW INDEX FROM chinalife_player_reports');while($row=$result->fetch_assoc())$reportIndexes[$row['Key_name']][]=$row['Column_name'];
if(!isset($reportIndexes['report_request']))$db->query('ALTER TABLE chinalife_player_reports ADD UNIQUE KEY report_request(reporter_id,request_id)');
foreach($reportIndexes as $key=>$fields)if($fields===['reporter_id','peer_id','reason'])$db->query("ALTER TABLE chinalife_player_reports DROP INDEX `$key`");
$todayBeijing=gmdate('Y-m-d',time()+28800);$statement=$db->prepare("INSERT IGNORE INTO chinalife_daily_receipts(user_id,day) SELECT user_id,? FROM chinalife_saves WHERE JSON_UNQUOTE(JSON_EXTRACT(game_state,'$.lastVisit'))=?");$statement->bind_param('ss',$todayBeijing,$todayBeijing);$statement->execute();$statement->close();
echo "ChinaLife schema ready. Existing saves preserved.\n";
