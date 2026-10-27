<?php
declare(strict_types=1);
// Gossip hot seat (Oct 2026): pure rules shared by hot-seat.php, admin.php and the tests.
// Keep the word list and limits in step with public/hot-seat.js (tests/hot-seat.mjs checks they match).
const HS_MIN_LEN=10;
const HS_MAX_LEN=140;
const HS_SECONDS=45;          // voting window
const HS_REVEAL_SECONDS=20;   // how long a result stays on the seat
const HS_MIN_VOTES=3;         // fewer votes than this: no coins (stops two friends farming)
const HS_VOTER_REWARD=20;     // coins for voting with the majority
const HS_AUTHOR_REWARD=10;    // coins for the author when the room says True
const HS_DAILY_REWARDS=10;    // most paid votes per player per Beijing day
const HS_HIDE_REPORTS=3;      // reports that hide a gist until an admin looks
const HS_PLACES=['gist'];
// Lower-case roots. EXACT words match a whole word; PREFIX roots also match longer words (fucking, bitches).
const HS_EXACT=['dick','dicks','dickhead','prick','twat','cock','cocks','slag','hoe','hoes','mumu','olodo','ashawo','arse','arsehole'];
const HS_PREFIX=['fuck','fuk','motherf','shit','bitch','cunt','asshole','whore','slut','nigg','fag','retard','wank','bastard','pussy','rape','rapist','kys'];
const HS_CJK=['傻逼','煞笔','操你','草泥马','妈的','你妈','婊子','贱人','滚蛋','去死'];

function hs_normalise(string $s): string {
    $s=mb_strtolower($s);
    return strtr($s,['0'=>'o','1'=>'i','!'=>'i','3'=>'e','4'=>'a','@'=>'a','5'=>'s','$'=>'s','7'=>'t','8'=>'b']);
}
function hs_profane(string $text): bool {
    $n=hs_normalise($text);
    foreach (HS_CJK as $w) if (mb_strpos($n,$w)!==false) return true;
    $tokens=preg_split('/[^a-z]+/',$n,-1,PREG_SPLIT_NO_EMPTY)?:[];
    // Spaced or dotted letters ("f u c k", "s.h.i.t") are joined back into one word.
    $joined=[];$run='';
    foreach ($tokens as $t) {if (strlen($t)===1) {$run.=$t;continue;} if (strlen($run)>2) $joined[]=$run; $run='';}
    if (strlen($run)>2) $joined[]=$run;
    foreach (array_merge($tokens,$joined) as $t) {
        if (in_array($t,HS_EXACT,true)) return true;
        foreach (HS_PREFIX as $p) if (str_starts_with($t,$p)) return true;
    }
    return false;
}
// Anonymous means anonymous: no links, emails, @handles or phone numbers that point at a real person.
function hs_personal(string $text): bool {
    return (bool)preg_match('~https?://|www\.|\.(com|net|org|cn|ng)\b|@[A-Za-z0-9_]{2,}|\d[\d\s-]{6,}\d~i',$text);
}
// Returns [true, cleaned text] or [false, message for the player].
function hs_check_text(mixed $raw): array {
    if (!is_string($raw)) return [false,'Write your gist'];
    $text=trim((string)preg_replace('/\s+/u',' ',$raw));
    $len=mb_strlen($text);
    if ($len<HS_MIN_LEN) return [false,'Make it at least '.HS_MIN_LEN.' characters'];
    if ($len>HS_MAX_LEN) return [false,'Keep it under '.HS_MAX_LEN.' characters'];
    if (hs_profane($text)) return [false,'Keep it clean. No swearing or insults'];
    if (hs_personal($text)) return [false,'Keep it anonymous. No links, @names or numbers'];
    return [true,$text];
}
function hs_majority(int $true, int $cap): string {return $true===$cap?'tie':($true>$cap?'true':'cap');}
// Who gets coins once a round closes. $votes: list of ['user_id'=>int,'vote'=>'true'|'cap','paid_today'=>int].
function hs_payouts(array $votes, int $author): array {
    $t=count(array_filter($votes,fn($v)=>$v['vote']==='true'));$c=count($votes)-$t;$result=hs_majority($t,$c);$pay=[];
    if (count($votes)>=HS_MIN_VOTES&&$result!=='tie') {
        foreach ($votes as $v) if ($v['vote']===$result&&(int)$v['user_id']!==$author&&(int)($v['paid_today']??0)<HS_DAILY_REWARDS) $pay[(int)$v['user_id']]=HS_VOTER_REWARD;
        if ($result==='true') $pay[$author]=($pay[$author]??0)+HS_AUTHOR_REWARD;
    }
    return ['true'=>$t,'cap'=>$c,'result'=>$result,'pay'=>$pay];
}
// Admin switch. No row (migration not run yet) means off, so production stays quiet until an admin turns it on.
function cl_hot_seat_enabled(): bool {
    try {$row=cl_one("SELECT value FROM chinalife_settings WHERE name='hot_seat'");}
    catch (mysqli_sql_exception $e) {return false;}
    $v=$row?json_decode((string)$row['value'],true):null;
    return is_array($v)&&($v['enabled']??false)===true;
}
