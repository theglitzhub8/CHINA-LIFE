<?php
declare(strict_types=1);
// One-time, explicitly invoked launch configuration. Never resets later admin choices.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../db.php';require_once __DIR__.'/../helpers.php';
set_exception_handler(function(Throwable $e):void{fwrite(STDERR,'China launch failed: '.$e->getMessage().PHP_EOL);exit(1);});
$db=get_db_connection();$db->begin_transaction();
try{
 $db->query("INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('china_hub_launch','',NOW())");
 $marker=$db->query("SELECT value FROM chinalife_settings WHERE name='china_hub_launch' FOR UPDATE")->fetch_assoc();
 if($marker['value']!==''){$db->commit();echo "China launch already applied. Admin city settings preserved.\n";exit;}
 $previous=$db->query("SELECT value FROM chinalife_settings WHERE name='open_cities' FOR UPDATE")->fetch_assoc();
 $backup=json_encode(['version'=>1,'previous_open'=>json_decode($previous['value']??'["Shenyang"]',true)],JSON_THROW_ON_ERROR);
 $db->query("INSERT INTO chinalife_settings(name,value,updated_at) VALUES('open_cities','[\"China\"]',NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=NOW()");
 $s=$db->prepare("UPDATE chinalife_settings SET value=?,updated_at=NOW() WHERE name='china_hub_launch'");$s->bind_param('s',$backup);$s->execute();$s->close();$db->commit();
 echo "China is open. Named cities are closed until admin unlocks them. Existing characters preserved.\n";
}catch(Throwable $e){$db->rollback();throw $e;}
