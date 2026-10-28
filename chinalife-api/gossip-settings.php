<?php
declare(strict_types=1);
// Gossip Room Phase 6 (docs/GOSSIP-ROOM-PLAN.md): settings the admin edits in appadmin's Gossip tab, saved in
// chinalife_settings 'gossip' as changes over these defaults. Read by hot-seat.php (Hot Seat Hour, queue, extra words),
// gist-night.php (extra words), gossip-rep-lib.php (prizes) and gossip-city-lib.php (City buzz per hour).
function cl_gossip_defaults(): array {
    return ['show_start'=>20,'show_end'=>22,'queue_max'=>10,'prizes'=>[1000,500,250],'buzz_hourly'=>4,'words'=>[]];
}
function cl_gossip_settings(): array {
    static $s=null;if ($s!==null) return $s;
    try {$row=cl_one("SELECT value FROM chinalife_settings WHERE name='gossip'");} catch (Throwable $e) {$row=null;}
    $saved=$row?json_decode((string)$row['value'],true):null;
    return $s=cl_gossip_valid(is_array($saved)?$saved:[])??cl_gossip_defaults();
}
// Checks changes and merges them over the defaults; null with the reason in $error when something is wrong.
function cl_gossip_valid(array $in, ?string &$error=null): ?array {
    $out=cl_gossip_defaults();$fail=function(string $m)use(&$error){$error=$m;return null;};
    foreach (['show_start'=>[0,23,'Show start'],'show_end'=>[1,24,'Show end'],'queue_max'=>[1,50,'Queue size'],'buzz_hourly'=>[0,20,'City buzz per hour']] as $k=>[$lo,$hi,$label])
        if (array_key_exists($k,$in)) {$v=$in[$k];if (!is_int($v)||$v<$lo||$v>$hi) return $fail($label.': use a whole number from '.$lo.' to '.$hi);$out[$k]=$v;}
    if ($out['show_start']>=$out['show_end']) return $fail('Hot Seat Hour must end after it starts');
    if (array_key_exists('prizes',$in)) {$p=$in['prizes'];if (!is_array($p)||count($p)!==3) return $fail('Give three prizes');
        foreach ($p as $v) if (!is_int($v)||$v<0||$v>100000) return $fail('Prizes are ¥0 to ¥100,000');$out['prizes']=array_values($p);}
    if (array_key_exists('words',$in)) {$w=$in['words'];if (!is_array($w)||count($w)>200) return $fail('Up to 200 blocked words');$clean=[];
        foreach ($w as $x) {if (!is_string($x)) return $fail('Blocked words are text');$x=mb_strtolower(trim($x));if ($x==='') continue;if (mb_strlen($x)<2||mb_strlen($x)>30) return $fail('Each blocked word is 2 to 30 characters');$clean[]=$x;}
        $out['words']=array_values(array_unique($clean));}
    return $out;
}
// The admin's extra blocked words, on top of the built-in Hot Seat list: a whole word, or anywhere for Chinese text.
function cl_gossip_blocked(string $text): bool {
    $t=mb_strtolower($text);
    foreach (cl_gossip_settings()['words'] as $w) {
        if (preg_match('/\p{Han}/u',$w)) {if (mb_strpos($t,$w)!==false) return true;continue;}
        if (preg_match('/(^|[^\p{L}\p{N}])'.preg_quote($w,'/').'($|[^\p{L}\p{N}])/u',$t)) return true;
    }
    return false;
}
function cl_gossip_live(int $hour): bool {$s=cl_gossip_settings();return $hour>=$s['show_start']&&$hour<$s['show_end'];}
