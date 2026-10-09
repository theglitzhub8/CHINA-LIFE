<?php
declare(strict_types=1);
// Read-only performance monitor for the Batch 1 rollout. Run on the server from the CLI; it changes nothing.
//   php perf-monitor.php --hafrik=/www/wwwroot/hafrik.com --log=/www/wwwlogs/hafrik.com-access_log [--interval=60] [--samples=0] [--csv=/root/chinalife-perf.csv]
// Every interval it prints one line (and appends it to the CSV):
//   ChinaLife API requests per second, 4xx / 429 / 5xx counts (from the Apache access log, new lines only),
//   PHP-FPM and Apache CPU (% of one core, from /proc), whole-machine CPU %, load average,
//   MariaDB queries per second, reads and writes per second, running threads, new slow queries (SHOW GLOBAL STATUS),
//   players online, and how old the newest position of each player is (players together / alone): another player sees
//   you at most that old plus their own heartbeat, so it is the server-side measure of multiplayer sync latency.
if (PHP_SAPI !== 'cli') {http_response_code(404);exit;}
$o=getopt('',['hafrik:','log:','interval::','samples::','csv::','top::']);
$hafrik=rtrim((string)($o['hafrik']??''),'/');$logFile=(string)($o['log']??'');
$interval=max(1,(int)($o['interval']??60));$samples=max(0,(int)($o['samples']??0));$csv=(string)($o['csv']??'');$top=max(0,(int)($o['top']??5));
if ($hafrik===''||!is_file("$hafrik/api/v4/db.php")) {fwrite(STDERR,"Usage: php perf-monitor.php --hafrik=/www/wwwroot/hafrik.com --log=/path/to/access_log [--interval=60] [--samples=0] [--csv=file]\n");exit(2);}
if ($logFile!==''&&!is_readable($logFile)) {fwrite(STDERR,"Cannot read access log $logFile\n");exit(2);}
require_once "$hafrik/api/v4/db.php";
require_once "$hafrik/api/v4/helpers.php";
set_exception_handler(function(Throwable $e): void {fwrite(STDERR,'perf-monitor: '.$e->getMessage().PHP_EOL);exit(1);});
$db=get_db_connection();
date_default_timezone_set('Asia/Shanghai');

function db_status(mysqli $db): array {$s=[];$r=$db->query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Questions','Com_select','Com_insert','Com_update','Com_delete','Threads_running','Slow_queries')");while($row=$r->fetch_row())$s[$row[0]]=(int)$row[1];return $s;}
// CPU ticks per process group: php-fpm grouped by PHP version (from its binary path), Apache, everything.
function cpu_ticks(): array {
    $t=['fpm'=>[],'apache'=>0,'total'=>0,'idle'=>0];if(!is_dir('/proc'))return $t;
    $stat=preg_split('/\s+/',trim(strtok((string)@file_get_contents('/proc/stat'),"\n")));array_shift($stat);$t['total']=array_sum(array_map('intval',$stat));$t['idle']=(int)($stat[3]??0)+(int)($stat[4]??0);
    foreach (glob('/proc/[0-9]*',GLOB_ONLYDIR)?:[] as $dir) {
        $raw=@file_get_contents("$dir/stat");if($raw===false)continue;
        $name=substr($raw,strpos($raw,'(')+1,strrpos($raw,')')-strpos($raw,'(')-1);$f=explode(' ',substr($raw,strrpos($raw,')')+2));$ticks=(int)$f[11]+(int)$f[12];
        if (str_starts_with($name,'php-fpm')) {$exe=(string)@readlink("$dir/exe");$v=preg_match('~/php/(\d+)/~',$exe,$m)?'php'.$m[1]:'php-fpm';$t['fpm'][$v]=($t['fpm'][$v]??0)+$ticks;}
        elseif ($name==='httpd'||$name==='apache2') $t['apache']+=$ticks;
    }
    return $t;
}
// New access-log lines since the last read (handles rotation).
function log_lines(string $file, int &$offset): array {
    if ($file==='') return [];clearstatcache(true,$file);$size=(int)@filesize($file);if($size<$offset)$offset=0;if($size===$offset)return [];
    $h=fopen($file,'rb');fseek($h,$offset);$data=stream_get_contents($h,min($size-$offset,200*1024*1024));fclose($h);
    $end=strrpos($data,"\n");if($end===false)return [];$offset+=$end+1;return explode("\n",substr($data,0,$end));
}
function presence_ages(mysqli $db): array {
    $rows=$db->query("SELECT TIMESTAMPDIFF(SECOND,p.seen_at,NOW()) age,(SELECT COUNT(*) FROM chinalife_presence q WHERE q.city=p.city AND q.place=p.place AND q.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND))>1 together FROM chinalife_presence p WHERE p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)")->fetch_all(MYSQLI_ASSOC);
    $g=['together'=>[],'alone'=>[]];foreach($rows as $r)$g[(int)$r['together']?'together':'alone'][]=(int)$r['age'];
    $pct=function(array $a,float $p){if(!$a)return '-';sort($a);return (string)$a[(int)min(count($a)-1,floor($p*(count($a)-1)+.5))];};
    return ['online'=>count($rows),'together'=>count($g['together']),'tog_p50'=>$pct($g['together'],.5),'tog_p95'=>$pct($g['together'],.95),'alone_p50'=>$pct($g['alone'],.5),'alone_p95'=>$pct($g['alone'],.95)];
}
$cfg=@file_get_contents("$hafrik/api/v4/chinalife/polling-config.json");$cfgShown=$cfg===false?'missing (legacy for everyone)':preg_replace('/\s+/',' ',trim($cfg));
$cores=max(1,(int)trim((string)@shell_exec('nproc')));$hz=max(1,(int)trim((string)@shell_exec('getconf CLK_TCK'))?:100);
fwrite(STDOUT,"ChinaLife perf monitor · every {$interval}s · {$cores} cores · polling-config.json: $cfgShown\n");
$offset=$logFile===''?0:(int)filesize($logFile);
$prevDb=db_status($db);$prevCpu=cpu_ticks();$prevTime=microtime(true);
$header=['time','api_rps','api_4xx','api_429','api_5xx','fpm_cpu_pct','apache_cpu_pct','machine_cpu_pct','load1','db_qps','db_select_ps','db_write_ps','db_threads_running','db_slow_new','online','together','sync_age_together_p50_s','sync_age_together_p95_s','sync_age_alone_p50_s','sync_age_alone_p95_s','top_endpoints'];
if ($csv!==''&&!is_file($csv)) file_put_contents($csv,implode(',',$header)."\n");
for ($n=0;$samples===0||$n<$samples;$n++) {
    sleep($interval);
    $now=microtime(true);$secs=max(.001,$now-$prevTime);$prevTime=$now;
    $count=0;$e4=0;$e429=0;$e5=0;$by=[];
    foreach (log_lines($logFile,$offset) as $line) {
        if (!preg_match('~"[A-Z]+ /api/v4/chinalife/([^ ?"]+)[^"]*" (\d{3})~',$line,$m)) continue;
        $count++;$by[$m[1]]=($by[$m[1]]??0)+1;$code=(int)$m[2];if($code===429)$e429++;elseif($code>=500)$e5++;elseif($code>=400)$e4++;
    }
    arsort($by);$topList=implode(' ',array_map(fn($k,$v)=>"$k:$v",array_keys(array_slice($by,0,$top,true)),array_slice($by,0,$top,true)));
    $cpu=cpu_ticks();$tick=fn($a,$b)=>max(0,$a-$b);
    $fpm=[];foreach($cpu['fpm'] as $v=>$t)$fpm[]=$v.'='.round($tick($t,$prevCpu['fpm'][$v]??$t)/$hz/$secs*100,1);
    $apache=round($tick($cpu['apache'],$prevCpu['apache'])/$hz/$secs*100,1);
    $dt=$tick($cpu['total'],$prevCpu['total']);$machine=$dt?round(100*(1-$tick($cpu['idle'],$prevCpu['idle'])/$dt),1):0;$prevCpu=$cpu;
    $load=is_readable('/proc/loadavg')?explode(' ',(string)file_get_contents('/proc/loadavg'))[0]:(string)(sys_getloadavg()[0]??'');
    $st=db_status($db);$d=fn($k)=>round(max(0,($st[$k]??0)-($prevDb[$k]??0))/$secs,1);
    $row=['time'=>date('Y-m-d H:i:s'),'api_rps'=>round($count/$secs,2),'api_4xx'=>$e4,'api_429'=>$e429,'api_5xx'=>$e5,'fpm_cpu_pct'=>implode(' ',$fpm)?:'-','apache_cpu_pct'=>$apache,'machine_cpu_pct'=>$machine,'load1'=>$load,
        'db_qps'=>$d('Questions'),'db_select_ps'=>$d('Com_select'),'db_write_ps'=>round($d('Com_insert')+$d('Com_update')+$d('Com_delete'),1),'db_threads_running'=>$st['Threads_running']??0,'db_slow_new'=>max(0,($st['Slow_queries']??0)-($prevDb['Slow_queries']??0))];
    $prevDb=$st;$row+=array_combine(['online','together','sync_age_together_p50_s','sync_age_together_p95_s','sync_age_alone_p50_s','sync_age_alone_p95_s'],array_values(presence_ages($db)));$row['top_endpoints']=$topList;
    fwrite(STDOUT,sprintf("%s  api %s req/s (4xx %d, 429 %d, 5xx %d)  fpm %s%%  apache %s%%  machine %s%%  load %s  db %s q/s (sel %s, wr %s, run %d, slow +%d)  online %d (together %d)  pos age together p50/p95 %s/%ss alone %s/%ss  [%s]\n",
        $row['time'],$row['api_rps'],$e4,$e429,$e5,$row['fpm_cpu_pct'],$apache,$machine,$load,$row['db_qps'],$row['db_select_ps'],$row['db_write_ps'],$row['db_threads_running'],$row['db_slow_new'],$row['online'],$row['together'],$row['sync_age_together_p50_s'],$row['sync_age_together_p95_s'],$row['sync_age_alone_p50_s'],$row['sync_age_alone_p95_s'],$topList));
    if ($csv!=='') {$h=fopen($csv,'ab');fputcsv($h,array_map(fn($k)=>$row[$k],$header),',','"','');fclose($h);}
}
