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
$sql=file_get_contents(__DIR__.'/migration-all.sql');
if (str_starts_with($type,'bigint')) $sql=preg_replace('/\bINT UNSIGNED\b/i','BIGINT UNSIGNED',$sql);
$db->multi_query($sql);
do {if ($result=$db->store_result()) $result->free();} while ($db->more_results() && $db->next_result());
$columns=[['chinalife_politics_votes','period',"VARCHAR(32) NOT NULL DEFAULT ''"],['chinalife_saves','revision','INT UNSIGNED NOT NULL DEFAULT 1'],['chinalife_presence','skin',"CHAR(7) NOT NULL DEFAULT '#8b5c43'"],['chinalife_presence','hair',"VARCHAR(12) NOT NULL DEFAULT 'cropped'"],['chinalife_voice_signals','sender_session',"VARCHAR(80) NOT NULL DEFAULT ''"],['chinalife_presence','activity',"VARCHAR(12) NOT NULL DEFAULT 'idle'"],['chinalife_presence','arrived_at','DATETIME NULL'],['chinalife_restaurants','kind',"VARCHAR(12) NOT NULL DEFAULT 'restaurant'"],['chinalife_restaurants','photos','TEXT NULL'],['chinalife_restaurants','links','TEXT NULL'],['chinalife_restaurants','owner_id','INT UNSIGNED NULL']];
foreach ($columns as [$table,$column,$definition]) {
    $statement=$db->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');$statement->bind_param('ss',$table,$column);$statement->execute();$exists=$statement->get_result()->fetch_row();$statement->close();
    if (!$exists) {$db->query("ALTER TABLE `$table` ADD COLUMN `$column` $definition");echo "Added $table.$column\n";}
}
// Preserve old votes in their matching election before allowing one vote per new period.
$db->query("UPDATE chinalife_politics_votes v SET period=COALESCE((SELECT e.period FROM chinalife_politics_elections e WHERE e.city=v.city AND e.office=v.office AND v.created_at>=e.opens_at AND v.created_at<=e.closes_at ORDER BY e.closes_at DESC LIMIT 1),'legacy') WHERE period=''");
$indexes=[];$result=$db->query('SHOW INDEX FROM chinalife_politics_votes');while($row=$result->fetch_assoc())$indexes[$row['Key_name']]=true;
if(!isset($indexes['one_vote_period']))$db->query('ALTER TABLE chinalife_politics_votes ADD UNIQUE KEY one_vote_period(city,office,period,voter_id)');
if(isset($indexes['one_vote']))$db->query('ALTER TABLE chinalife_politics_votes DROP INDEX one_vote');
echo "ChinaLife schema ready. Existing saves preserved.\n";
