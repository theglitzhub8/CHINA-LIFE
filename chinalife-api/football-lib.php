<?php
declare(strict_types=1);
// Football Field matches and knockout tournaments. Pure helpers first (unit-tested from tests/football.mjs
// through the php CLI), then the small DB helpers used by football.php and the admin actions.
// The bracket and result rules mirror public/football-engine.js.
const FB_DURATION_MS=180000;
const FB_EXTRA_MS=60000;
const FB_MAX_TEAM=5;
const FB_LOBBY_TTL=900;     // seconds an unstarted lobby lives
const FB_STALE_LIVE=45;     // seconds without a host snapshot before a live match is abandoned
const FB_CONFIRM_WAIT=120;  // seconds a casual result waits for confirmations before the host report stands

// 32-bit integer helpers so the PHP rng matches JavaScript's Math.imul / >>> exactly.
function fb_u32(int $v): int {return $v & 0xFFFFFFFF;}
function fb_i32(int $v): int {$v&=0xFFFFFFFF;return $v>=0x80000000?$v-0x100000000:$v;}
function fb_imul(int $a,int $b): int {$a=fb_u32($a);$b=fb_u32($b);$lo=($a&0xFFFF)*$b;$hi=(($a>>16)*$b)&0xFFFF;return fb_i32($lo+($hi<<16));}
function fb_rng(int $seed): Closure {
    $a=fb_u32($seed); if ($a===0) $a=1; $a=fb_i32($a);
    return function() use (&$a): float {
        $a=fb_i32($a+0x6D2B79F5);
        $t=fb_imul($a ^ fb_u32($a)>>15, 1|$a);
        $t=fb_i32(fb_i32($t+fb_imul($t ^ fb_u32($t)>>7, 61|$t)) ^ $t);
        return (fb_u32($t ^ fb_u32($t)>>14))/4294967296;
    };
}
function fb_penalties(int $seed): array {
    $r=fb_rng($seed*7+3);$k=[0,0];
    for ($i=0;$i<5;$i++) foreach ([0,1] as $t) if ($r()<.75) $k[$t]++;
    while ($k[0]===$k[1]) foreach ([0,1] as $t) if ($r()<.75) $k[$t]++;
    return $k;
}
// Server-side check of the host's full-time report. Returns null when it is consistent, else the reason.
function fb_check_result(mixed $rep,array $playerIds,bool $knockout,int $seed,int $duration=FB_DURATION_MS): ?string {
    if (!is_array($rep)||!is_array($rep['score']??null)||count($rep['score'])!==2) return 'Missing score';
    [$a,$b]=array_values($rep['score']);
    foreach ([$a,$b] as $n) if (!is_int($n)||$n<0||$n>30) return 'Impossible score';
    $goals=$rep['goals']??null;
    if (!is_array($goals)||count($goals)!==$a+$b) return 'Goals do not add up';
    $ids=array_map('strval',$playerIds);$teamA=0;$last=-1;
    foreach ($goals as $g) {
        if (!is_array($g)||!in_array($g['team']??null,[0,1],true)) return 'Bad goal';
        if ($g['team']===0) $teamA++;
        $by=$g['by']??null;
        if ($by!==null&&!in_array((string)$by,$ids,true)&&!preg_match('/^bot-[01]-[0-4]$/',(string)$by)) return 'Unknown scorer';
        $t=$g['t']??-1; if (!is_int($t)||$t<0||$t>$duration+FB_EXTRA_MS+1000) return 'Goal time out of range';
        if ($t<$last) return 'Goals out of order'; $last=$t;
    }
    if ($teamA!==$a) return 'Goals do not add up';
    $w=$a===$b?null:($a>$b?0:1);
    if ($w===null&&$knockout) {$p=fb_penalties($seed);$w=$p[0]>$p[1]?0:1;}
    if (($rep['winner']??null)!==$w) return 'Wrong winner';
    return null;
}
// Knockout bracket. $teams in seed order: [['id'=>..,'name'=>..]]. Byes advance automatically.
function fb_seed_order(int $size): array {$o=[1,2];while (count($o)<$size){$m=count($o)*2+1;$n=[];foreach ($o as $s){$n[]=$s;$n[]=$m-$s;}$o=$n;}return $o;}
function fb_bracket(array $teams): array {
    $n=count($teams); if ($n<2) return [];
    $size=1; while ($size<$n) $size*=2;
    $order=fb_seed_order($size);$first=[];
    for ($i=0;$i<$size;$i+=2) {
        $a=$teams[$order[$i]-1]['id']??null;$b=$teams[$order[$i+1]-1]['id']??null;
        $first[]=['id'=>'r1m'.($i/2+1),'a'=>$a,'b'=>$b,'winner'=>$a===null?$b:($b===null?$a:null),'score'=>null,'bye'=>$a===null||$b===null];
    }
    $rounds=[$first];
    for ($r=2,$len=intdiv($size,4);$len>=1;$r++,$len=intdiv($len,2)) {
        $round=[];for ($i=0;$i<$len;$i++) $round[]=['id'=>'r'.$r.'m'.($i+1),'a'=>null,'b'=>null,'winner'=>null,'score'=>null];
        $rounds[]=$round; if ($len===1) break;
    }
    return fb_propagate($rounds);
}
function fb_propagate(array $rounds): array {
    for ($r=1;$r<count($rounds);$r++) foreach ($rounds[$r] as $i=>$m) {
        $fa=$rounds[$r-1][$i*2]??null;$fb=$rounds[$r-1][$i*2+1]??null;
        $m['a']=$fa['winner']??null;$m['b']=$fb['winner']??null;
        if ($m['winner']!==null&&$m['winner']!==$m['a']&&$m['winner']!==$m['b']) {$m['winner']=null;$m['score']=null;}
        $rounds[$r][$i]=$m;
    }
    return $rounds;
}
function fb_record(array &$rounds,string $matchId,mixed $winner,?array $score): ?string {
    foreach ($rounds as $r=>$round) foreach ($round as $i=>$m) if ($m['id']===$matchId) {
        if ($m['winner']!==null&&empty($m['bye'])) return 'Already played';
        if ($m['a']===null||$m['b']===null) return 'Teams not decided yet';
        if ($winner!==$m['a']&&$winner!==$m['b']) return 'Winner is not in this match';
        $rounds[$r][$i]['winner']=$winner;$rounds[$r][$i]['score']=$score;$rounds=fb_propagate($rounds);return null;
    }
    return 'Unknown match';
}
function fb_champion(array $rounds): mixed {return $rounds?($rounds[count($rounds)-1][0]['winner']??null):null;}
function fb_playable(array $rounds): array {$out=[];foreach ($rounds as $round) foreach ($round as $m) if ($m['a']!==null&&$m['b']!==null&&$m['winner']===null) $out[]=$m;return $out;}
// Do the confirmations settle the result? $confirms: [['team'=>0|1,'score'=>[a,b]]] from humans other than the host.
// Returns 'accept', 'dispute' or 'wait'. Any disagreement is a dispute for an admin. A tournament result needs at
// least one human on the other side of the host to agree (when there is one); a casual result stands after a wait.
function fb_settle(array $reported,int $hostTeam,array $confirms,bool $otherSideHasHumans,bool $tournament,int $ageSeconds): string {
    $agreeOther=false;
    foreach ($confirms as $c) {
        if (($c['score']??null)!==$reported) return 'dispute';
        if (($c['team']??-1)!==$hostTeam) $agreeOther=true;
    }
    if (!$otherSideHasHumans||$agreeOther) return 'accept';
    if ($tournament) return $ageSeconds>=FB_CONFIRM_WAIT*3?'dispute':'wait';
    return $ageSeconds>=FB_CONFIRM_WAIT?'accept':'wait';
}
function fb_clean_name(mixed $v,int $max): string {return is_string($v)?trim(preg_replace('/\s+/u',' ',mb_substr(strip_tags($v),0,$max))):'';}

// ---------- DB helpers (need common.php) ----------
function cl_football_enabled(): bool {
    try {$row=cl_one("SELECT value FROM chinalife_settings WHERE name='football_matches'");}
    catch (mysqli_sql_exception $e) {return false;}
    $v=$row?json_decode((string)$row['value'],true):null;
    return is_array($v)&&($v['enabled']??false)===true;
}
// Expire old lobbies and abandoned live matches (lazy, on every request).
function fb_tidy(): void {
    cl_run("UPDATE chinalife_football_matches SET status='cancelled',ended_at=NOW() WHERE status='lobby' AND created_at<NOW()-INTERVAL ".FB_LOBBY_TTL." SECOND AND tournament_id IS NULL");
    cl_run("UPDATE chinalife_football_matches SET status='cancelled',ended_at=NOW() WHERE status='live' AND updated_at<NOW()-INTERVAL ".FB_STALE_LIVE." SECOND");
}
// One match at a time: the lobby or live match this player is in (other than $except).
function fb_active_match(int $userId,int $except=0): ?array {
    return cl_one("SELECT m.id,m.status FROM chinalife_football_match_players p JOIN chinalife_football_matches m ON m.id=p.match_id WHERE p.user_id=? AND p.left_at IS NULL AND m.status IN('lobby','live','reported') AND m.id<>? LIMIT 1",'ii',[$userId,$except]);
}
function fb_match_players(int $matchId): array {
    return cl_rows('SELECT p.user_id,p.team,p.confirm,u.user_name FROM chinalife_football_match_players p LEFT JOIN users u ON u.user_id=p.user_id WHERE p.match_id=? AND p.left_at IS NULL ORDER BY p.joined_at','i',[$matchId]);
}
function fb_tournament_teams(int $tid): array {
    $teams=cl_rows('SELECT id,name,captain_id FROM chinalife_football_tournament_teams WHERE tournament_id=? ORDER BY id','i',[$tid]);
    $members=cl_rows('SELECT m.team_id,m.user_id,u.user_name FROM chinalife_football_tournament_members m LEFT JOIN users u ON u.user_id=m.user_id WHERE m.tournament_id=?','i',[$tid]);
    foreach ($teams as &$t) {$t['members']=array_values(array_map(fn($m)=>['id'=>(string)$m['user_id'],'name'=>$m['user_name']],array_filter($members,fn($m)=>(int)$m['team_id']===(int)$t['id'])));$t['id']=(string)$t['id'];}
    return $teams;
}
// Start due tournaments and make sure every playable bracket match has a lobby row.
function fb_tournament_tick(int $tid): void {
    global $db;
    $t=cl_one("SELECT * FROM chinalife_football_tournaments WHERE id=? FOR UPDATE",'i',[$tid]);
    if (!$t||in_array($t['status'],['done','cancelled'],true)) return;
    if ($t['status']==='registering') {
        // starts_at is stored in UTC (gmdate) so compare with UTC_TIMESTAMP(), whatever the DB session time zone is.
        if (!cl_one('SELECT 1 FROM chinalife_football_tournaments WHERE id=? AND starts_at<=UTC_TIMESTAMP()','i',[$tid])) return;
        $teams=fb_tournament_teams($tid);
        if (count($teams)<2) {cl_run("UPDATE chinalife_football_tournaments SET status='cancelled',updated_at=NOW() WHERE id=?",'i',[$tid]);return;}
        $rounds=fb_bracket(array_map(fn($x)=>['id'=>$x['id']],$teams));
        cl_run("UPDATE chinalife_football_tournaments SET status='running',bracket=?,updated_at=NOW() WHERE id=?",'si',[json_encode($rounds),$tid]);
        $t['bracket']=json_encode($rounds);
    }
    $rounds=json_decode((string)$t['bracket'],true)?:[];
    foreach (fb_playable($rounds) as $m) {
        if (cl_one("SELECT id FROM chinalife_football_matches WHERE tournament_id=? AND bracket_match=? AND status IN('lobby','live','reported','disputed')",'is',[$tid,$m['id']])) continue;
        cl_run("INSERT INTO chinalife_football_matches(city,status,size,host_id,tournament_id,bracket_match,team_a_id,team_b_id,seed,duration_ms,knockout,scheduled_at,created_at,updated_at) VALUES('China','lobby',?,NULL,?,?,?,?,?,?,1,NOW(),NOW(),NOW())",
            'iisiiii',[(int)$t['team_size'],$tid,$m['id'],(int)$m['a'],(int)$m['b'],random_int(1,2000000000),FB_DURATION_MS]);
    }
}
// A tournament match result is final: advance the bracket, schedule the next round, pay the champions.
function fb_tournament_result(int $tid,string $bracketMatch,int $winnerTeamId,array $score): void {
    $t=cl_one("SELECT * FROM chinalife_football_tournaments WHERE id=? FOR UPDATE",'i',[$tid]);
    if (!$t||$t['status']!=='running') return;
    $rounds=json_decode((string)$t['bracket'],true)?:[];
    if (fb_record($rounds,$bracketMatch,(string)$winnerTeamId,$score)!==null) return;
    $champ=fb_champion($rounds);
    cl_run("UPDATE chinalife_football_tournaments SET bracket=?,status=?,champion_team_id=?,updated_at=NOW() WHERE id=?",'ssii',[json_encode($rounds),$champ?'done':'running',$champ?(int)$champ:null,$tid]);
    if ($champ&&(int)$t['prize_coins']>0) {
        $members=cl_rows('SELECT user_id FROM chinalife_football_tournament_members WHERE team_id=?','i',[(int)$champ]);
        $each=$members?intdiv((int)$t['prize_coins'],count($members)):0;
        // Each member gets an equal share; a member who has never saved a character has no wallet yet and is skipped.
        foreach ($members as $m) if ($each>0&&cl_one('SELECT 1 FROM chinalife_saves WHERE user_id=?','i',[(int)$m['user_id']])) cl_credit((int)$m['user_id'],$each);
    }
    if (!$champ) fb_tournament_tick($tid);
}
