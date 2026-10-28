<?php
declare(strict_types=1);
// Gossip Room Phase 3 (docs/GOSSIP-ROOM-PLAN.md, appadmin switch gossip_city): the city makes gossip. When something
// true happens on the server (a graduation, a new rank, a football result, a Hot Seat streak) a "City buzz" tip goes on
// the Gossip wall (chinalife_gist_night.official = 2). It never names a player, only "someone"; the subject's id is kept
// for admins, like every anonymous tip. Each kind posts at most CL_CITY_GOSSIP_HOURLY times per city per hour (counted by
// the kind's emoji at the start of the text), so the wall is never flooded. A failure here never breaks the caller.
const CL_CITY_GOSSIP_HOURLY=4; // default; the admin can change it (gossip-settings.php buzz_hourly)
const CL_CITY_GOSSIP_EMOJI=['grad'=>'🎓','rank'=>'🏅','football'=>'⚽','hotseat'=>'🔥'];
function cl_city_gossip(string $city, int $subject, string $kind, string $text): bool {
    try {
        if (!function_exists('cl_hafrik_features')||!(cl_hafrik_features()['gossip_city']??false)) return false;
        $emoji=CL_CITY_GOSSIP_EMOJI[$kind]??null;if ($emoji===null||$city==='') return false;
        $recent=(int)(cl_one("SELECT COUNT(*) n FROM chinalife_gist_night WHERE city=? AND official=2 AND body LIKE ? AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)",'ss',[$city,$emoji.'%'])['n']??0);
        $cap=function_exists('cl_gossip_settings')?cl_gossip_settings()['buzz_hourly']:CL_CITY_GOSSIP_HOURLY;if ($recent>=$cap) return false;
        cl_run('INSERT INTO chinalife_gist_night(user_id,city,body,official,created_at) VALUES(?,?,?,2,NOW())','iss',[$subject,$city,mb_substr($emoji.' '.$text,0,280)]);
        return true;
    } catch (Throwable $e) {return false;}
}
