<?php
declare(strict_types=1);
// R4b: short-lived cache for shared, read-heavy ChinaLife data (online counts, leaderboard, Hafrik map pins).
// Never used for coins, balances, saves or anything per player. Uses APCu when the extension is loaded,
// otherwise small JSON files in /dev/shm (RAM). Set CL_CACHE_OFF=1 in the environment to bypass.
function cl_cache_dir(): string {return (is_dir('/dev/shm')&&is_writable('/dev/shm')?'/dev/shm':sys_get_temp_dir()).'/chinalife-cache';}
function cl_cache(string $key, int $ttl, callable $build): mixed {
    if (getenv('CL_CACHE_OFF')==='1') {return $build();}
    $key='cl4:'.$key;
    if (function_exists('apcu_enabled')&&apcu_enabled()) {
        $hit=false;$value=apcu_fetch($key,$hit);if ($hit) {cl_cache_mark('HIT');return $value;}
        $value=$build();apcu_store($key,$value,$ttl);cl_cache_mark('MISS');return $value;
    }
    $dir=cl_cache_dir();$file=$dir.'/'.preg_replace('/[^a-z0-9_.-]/i','_',$key).'.json';
    $raw=@file_get_contents($file);
    if ($raw!==false) {$row=json_decode($raw,true);if (is_array($row)&&($row['exp']??0)>time()) {cl_cache_mark('HIT');return $row['v'];}}
    $value=$build();
    if (!is_dir($dir)) {@mkdir($dir,0700,true);}
    $tmp=$file.'.'.getmypid();if (@file_put_contents($tmp,json_encode(['exp'=>time()+$ttl,'v'=>$value]))!==false) {@rename($tmp,$file);}
    cl_cache_mark('MISS');return $value;
}
function cl_cache_forget(string $prefix): void {
    $prefix='cl4:'.$prefix;
    if (function_exists('apcu_enabled')&&apcu_enabled()&&class_exists('APCUIterator')) {apcu_delete(new APCUIterator('/^'.preg_quote($prefix,'/').'/'));}
    foreach (glob(cl_cache_dir().'/'.preg_replace('/[^a-z0-9_.-]/i','_',$prefix).'*')?:[] as $f) {@unlink($f);}
}
function cl_cache_mark(string $state): void {if (!headers_sent()) {header('X-CL-Cache: '.$state,false);}}
