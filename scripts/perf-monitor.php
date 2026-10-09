<?php
declare(strict_types=1);
// Read-only performance monitor (Batch 1 baseline and rollout). Run on the server from the CLI; it changes nothing:
// it reads /proc, the Apache access log, SHOW GLOBAL STATUS and SELECTs on chinalife_presence.
//   php perf-monitor.php --hafrik=/www/wwwroot/hafrik.com --log=/www/wwwlogs/hafrik.com-access_log \
//       [--interval=60] [--samples=30] [--csv=/root/perf-baseline.csv] [--endpoints-csv=/root/perf-baseline-endpoints.csv]
// Every interval prints one line (and appends it to --csv):
//   machine CPU %, load average, available memory and swap in use,
//   PHP-FPM per PHP version: CPU (% of one core), workers, workers busy during the interval; Apache CPU,
//   ChinaLife API requests per second with 4xx / 429 / 5xx counts (new access-log lines only),
//   MariaDB queries per second (all databases), reads and writes per second, running threads, new slow queries,
//   players online and how old each player's newest position is (together with others / alone, p50 and p95, seconds):
//   another player sees you at most that old plus their own heartbeat, the server-side measure of sync latency.
// At the end (after --samples, or on Ctrl+C / kill) it prints a summary: per-endpoint totals, requests per minute and
// error rates, and the average / peak of each measurement.
if (PHP_SAPI !== 'cli') {http_response_code(404);exit;}
$o=getopt('',['hafrik:','log:','interval::','samples::','csv::','endpoints-csv::','proc::']);
$hafrik=rtrim((string)($o['hafrik']??''),'/');$logFile=(string)($o['log']??'');$proc=rtrim((string)($o['proc']??'/proc'),'/');
$interval=max(1,(int)($o['interval']??60));$samples=max(0,(int)($o['samples']??0));$csv=(string)($o['csv']??'');$endpointsCsv=(string)($o['endpoints-csv']??'');
if ($hafrik===''||!is_file("$hafrik/api/v4/db.php")) {fwrite(STDERR,"Usage: php perf-monitor.php --hafrik=/www/wwwroot/hafrik.com --log=/path/to/access_log [--interval=60] [--samples=30] [--csv=file] [--endpoints-csv=file]\n");exit(2);}
if ($logFile!==''&&!is_readable($logFile)) {fwrite(STDERR,"Cannot read access log $logFile\n");exit(2);}
require_once "$hafrik/api/v4/db.php";
require_once "$hafrik/api/v4/helpers.php";
set_exception_handler(function(Throwable $e): void {fwrite(STDERR,'perf-monitor: '.$e->getMessage().PHP_EOL);exit(1);});
$db=get_db_connection();
date_default_timezone_set('Asia/Shanghai');

function db_status(mysqli $db): array {$s=[];$r=$db->query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Questions','Com_select','Com_insert','Com_update','Com_delete','Threads_running','Threads_connected','Slow_queries')");while($row=$r->fetch_row())$s[$row[0]]=(int)$row[1];return $s;}
// CPU ticks per process: PHP-FPM workers grouped by PHP version (from the binary path; masters left out), Apache, machine.
function cpu_ticks(string $proc): array {
    $t=['fpm'=>[],'apache'=>0,'total'=>0,'idle'=>0];if(!is_dir($proc))return $t;
    $stat=preg_split('/\s+/',trim(strtok((string)@file_get_contents("$proc/stat"),"\n")));array_shift($stat);$t['total']=array_sum(array_map('intval',$stat));$t['idle']=(int)($stat[3]??0)+(int)($stat[4]??0);
    foreach (glob("$proc/[0-9]*",GLOB_ONLYDIR)?:[] as $dir) {
        $raw=@file_get_contents("$dir/stat");if($raw===false||!str_contains($raw,')'))continue;
        $name=substr($raw,strpos($raw,'(')+1,strrpos($raw,')')-strpos($raw,'(')-1);$f=explode(' ',substr($raw,strrpos($raw,')')+2));$ticks=(int)($f[11]??0)+(int)($f[12]??0);
        if (str_starts_with($name,'php-fpm')) {
            if (str_contains((string)@file_get_contents("$dir/cmdline"),'master process')) continue;
            $v=preg_match('~/php/(\d+)/~',(string)@readlink("$dir/exe"),$m)?'php'.$m[1]:'php-fpm';$t['fpm'][$v][basename($dir)]=$ticks;
        } elseif ($name==='httpd'||$name==='apache2') $t['apache']+=$ticks;
    }
    return $t;
}
function memory(string $proc): array {
    $m=[];foreach (explode("\n",(string)@file_get_contents("$proc/meminfo")) as $l) if (preg_match('/^(\w+):\s+(\d+)/',$l,$x)) $m[$x[1]]=(int)$x[2];
    return ['mem_available_mb'=>isset($m['MemAvailable'])?intdiv($m['MemAvailable'],1024):'-','mem_total_mb'=>isset($m['MemTotal'])?intdiv($m['MemTotal'],1024):'-','swap_used_mb'=>isset($m['SwapTotal'])?intdiv($m['SwapTotal']-($m['SwapFree']??0),1024):'-'];
}
// New access-log lines since the last read (handles rotation).
function log_lines(string $file, int &$offset): array {
    if ($file==='') return [];clearstatcache(true,$file);$size=(int)@filesize($file);if($size<$offset)$offset=0;if($size===$offset)return [];
    $h=fopen($file,'rb');fseek($h,$offset);$data=stream_get_contents($h,min($size-$offset,200*1024*1024));fclose($h);
    $end=strrpos($data,"\n");if($end===false)return [];$offset+=$end+1;return explode("\n",substr($data,0,$end));
}
function pct(array $a, float $p): string {if(!$a)return '-';sort($a);return (string)$a[(int)min(count($a)-1,floor($p*(count($a)-1)+.5))];}
function presence_ages(mysqli $db): array {
    $rows=$db->query("SELECT TIMESTAMPDIFF(SECOND,p.seen_at,NOW()) age,(SELECT COUNT(*) FROM chinalife_presence q WHERE q.city=p.city AND q.place=p.place AND q.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND))>1 together FROM chinalife_presence p WHERE p.seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)")->fetch_all(MYSQLI_ASSOC);
    $g=['together'=>[],'alone'=>[]];foreach($rows as $r)$g[(int)$r['together']?'together':'alone'][]=(int)$r['age'];
    return ['online'=>count($rows),'together'=>count($g['together']),'sync_age_together_p50_s'=>pct($g['together'],.5),'sync_age_together_p95_s'=>pct($g['together'],.95),'sync_age_alone_p50_s'=>pct($g['alone'],.5),'sync_age_alone_p95_s'=>pct($g['alone'],.95)];
}
$cfg=@file_get_contents("$hafrik/api/v4/chinalife/polling-config.json");$cfgShown=$cfg===false?'missing (legacy for everyone)':preg_replace('/\s+/',' ',trim($cfg));
$cores=max(1,(int)trim((string)@shell_exec('nproc 2>/dev/null')));$hz=(int)trim((string)@shell_exec('getconf CLK_TCK 2>/dev/null'))?:100;
fwrite(STDOUT,'ChinaLife perf monitor · '.date('Y-m-d H:i:s')." Beijing · every {$interval}s · {$cores} cores · polling-config.json: $cfgShown\n");
$offset=$logFile===''?0:(int)filesize($logFile);
$prevDb=db_status($db);$prevCpu=cpu_ticks($proc);$prevTime=microtime(true);$started=$prevTime;
$header=['time','api_rps','api_4xx','api_429','api_5xx','machine_cpu_pct','load1','mem_available_mb','swap_used_mb','fpm','apache_cpu_pct','db_qps','db_select_ps','db_write_ps','db_threads_running','db_threads_connected','db_slow_new','online','together','sync_age_together_p50_s','sync_age_together_p95_s','sync_age_alone_p50_s','sync_age_alone_p95_s'];
if ($csv!==''&&!is_file($csv)) file_put_contents($csv,implode(',',$header)."\n");
$endpoints=[];$history=[];

function summary(): void {
    global $endpoints,$history,$started,$endpointsCsv;static $done=false;if($done)return;$done=true;
    $minutes=max(1/60,(microtime(true)-$started)/60);$all=array_sum(array_column($endpoints,'n'));
    fwrite(STDOUT,sprintf("\n=== Summary: %.1f minutes, %d samples ===\nChinaLife API requests: %d (%.2f req/s)\n",$minutes,count($history),$all,$all/$minutes/60));
    uasort($endpoints,fn($a,$b)=>$b['n']<=>$a['n']);
    fwrite(STDOUT,sprintf("%-28s %9s %9s %7s %7s %7s %8s\n",'endpoint','requests','per min','4xx','429','5xx','error %'));
    $rows=[];foreach ($endpoints as $name=>$e) {$err=$e['4xx']+$e['429']+$e['5xx'];$rows[]=[$name,$e['n'],round($e['n']/$minutes,1),$e['4xx'],$e['429'],$e['5xx'],round(100*$err/max(1,$e['n']),2)];fwrite(STDOUT,sprintf("%-28s %9d %9.1f %7d %7d %7d %7.2f%%\n",...$rows[array_key_last($rows)]));}
    if ($endpointsCsv!=='') {$h=fopen($endpointsCsv,'wb');fputcsv($h,['endpoint','requests','per_min','4xx','429','5xx','error_pct'],',','"','');foreach($rows as $r)fputcsv($h,$r,',','"','');fclose($h);}
    if (!$history) return;
    fwrite(STDOUT,"\nmeasurement                      average       peak\n");
    foreach (['api_rps','machine_cpu_pct','load1','mem_available_mb','swap_used_mb','apache_cpu_pct','db_qps','db_select_ps','db_write_ps','db_threads_running','online','together','sync_age_together_p95_s','sync_age_alone_p95_s'] as $k) {
        $v=array_values(array_filter(array_column($history,$k),'is_numeric'));if(!$v)continue;$peak=$k==='mem_available_mb'?min($v):max($v);
        fwrite(STDOUT,sprintf("%-30s %9.1f %10.1f%s\n",$k,array_sum($v)/count($v),$peak,$k==='mem_available_mb'?'  (lowest)':''));
    }
    $fpm=[];foreach($history as $h)foreach($h['fpm_detail'] as $ver=>$d){$fpm[$ver]['cpu'][]=$d['cpu'];$fpm[$ver]['workers'][]=$d['workers'];$fpm[$ver]['busy'][]=$d['busy'];}
    foreach ($fpm as $ver=>$d) fwrite(STDOUT,sprintf("%-30s cpu avg %.1f%% peak %.1f%% · workers avg %.1f peak %d · busy avg %.1f peak %d\n",$ver,array_sum($d['cpu'])/count($d['cpu']),max($d['cpu']),array_sum($d['workers'])/count($d['workers']),max($d['workers']),array_sum($d['busy'])/count($d['busy']),max($d['busy'])));
}
register_shutdown_function('summary');
if (function_exists('pcntl_async_signals')) {pcntl_async_signals(true);foreach([SIGINT,SIGTERM] as $s)pcntl_signal($s,function(){exit(0);});}

for ($n=0;$samples===0||$n<$samples;$n++) {
    sleep($interval);
    $now=microtime(true);$secs=max(.001,$now-$prevTime);$prevTime=$now;
    $count=0;$e4=0;$e429=0;$e5=0;
    foreach (log_lines($logFile,$offset) as $line) {
        if (!preg_match('~"[A-Z]+ /api/v4/chinalife/([^ ?"]+)[^"]*" (\d{3})~',$line,$m)) continue;
        $count++;$code=(int)$m[2];$kind=$code===429?'429':($code>=500?'5xx':($code>=400?'4xx':''));
        $endpoints[$m[1]]??=['n'=>0,'4xx'=>0,'429'=>0,'5xx'=>0];$endpoints[$m[1]]['n']++;
        if($kind){$endpoints[$m[1]][$kind]++;if($kind==='429')$e429++;elseif($kind==='5xx')$e5++;else $e4++;}
    }
    $cpu=cpu_ticks($proc);$fpm=[];$fpmText=[];
    foreach ($cpu['fpm'] as $ver=>$workers) {
        $ticks=0;$busy=0;foreach($workers as $pid=>$t){$d=max(0,$t-($prevCpu['fpm'][$ver][$pid]??$t));$ticks+=$d;if($d>0)$busy++;}
        $fpm[$ver]=['cpu'=>round($ticks/$hz/$secs*100,1),'workers'=>count($workers),'busy'=>$busy];$fpmText[]="$ver cpu {$fpm[$ver]['cpu']}% workers ".count($workers)." busy $busy";
    }
    $apache=round(max(0,$cpu['apache']-$prevCpu['apache'])/$hz/$secs*100,1);
    $dt=max(0,$cpu['total']-$prevCpu['total']);$machine=$dt?round(100*(1-max(0,$cpu['idle']-$prevCpu['idle'])/$dt),1):'-';$prevCpu=$cpu;
    $load=is_readable("$proc/loadavg")?explode(' ',(string)file_get_contents("$proc/loadavg"))[0]:(string)(sys_getloadavg()[0]??'-');
    $st=db_status($db);$d=fn($k)=>round(max(0,($st[$k]??0)-($prevDb[$k]??0))/$secs,1);
    $row=['time'=>date('Y-m-d H:i:s'),'api_rps'=>round($count/$secs,2),'api_4xx'=>$e4,'api_429'=>$e429,'api_5xx'=>$e5,'machine_cpu_pct'=>$machine,'load1'=>$load]+memory($proc)
        +['fpm'=>implode(' | ',$fpmText)?:'-','apache_cpu_pct'=>$apache,'db_qps'=>$d('Questions'),'db_select_ps'=>$d('Com_select'),'db_write_ps'=>round($d('Com_insert')+$d('Com_update')+$d('Com_delete'),1),
           'db_threads_running'=>$st['Threads_running']??0,'db_threads_connected'=>$st['Threads_connected']??0,'db_slow_new'=>max(0,($st['Slow_queries']??0)-($prevDb['Slow_queries']??0))]+presence_ages($db);
    $prevDb=$st;$history[]=$row+['fpm_detail'=>$fpm];
    fwrite(STDOUT,sprintf("%s  api %s req/s (4xx %d, 429 %d, 5xx %d)  cpu %s%% load %s  mem avail %s MB swap %s MB  [%s]  apache %s%%  db %s q/s (sel %s, wr %s, run %d, conn %d, slow +%d)  online %d (together %d)  pos age together p50/p95 %s/%ss alone %s/%ss\n",
        $row['time'],$row['api_rps'],$e4,$e429,$e5,$machine,$load,$row['mem_available_mb'],$row['swap_used_mb'],$row['fpm'],$apache,$row['db_qps'],$row['db_select_ps'],$row['db_write_ps'],$row['db_threads_running'],$row['db_threads_connected'],$row['db_slow_new'],$row['online'],$row['together'],$row['sync_age_together_p50_s'],$row['sync_age_together_p95_s'],$row['sync_age_alone_p50_s'],$row['sync_age_alone_p95_s']));
    if ($csv!=='') {$h=fopen($csv,'ab');fputcsv($h,array_map(fn($k)=>$row[$k],$header),',','"','');fclose($h);}
}
