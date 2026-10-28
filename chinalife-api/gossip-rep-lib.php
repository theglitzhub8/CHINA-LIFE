<?php
declare(strict_types=1);
// Gossip Room Phase 5 (docs/GOSSIP-ROOM-PLAN.md, appadmin switch gossip_rep): gist reputation and the weekly Truth teller
// award. Rep is worked out from what already happened, nothing new is stored:
//   Hot Seat: a gist the room called True +10, Cap -5 (rounds with HS_MIN_VOTES votes or more, as for coins);
//   Gossip wall: +1 for every 5 reactions on your anonymous tips, at most +5 a tip.
// Rep is only ever shown to its owner (it would hint at who wrote which gist). Each Monday (Beijing) the top three of
// last week get a 🏆 badge and CL_GIST_PRIZES, paid once on the server ledger; the week is recorded in
// chinalife_settings 'gossip_award' so it is never paid twice.
require_once __DIR__.'/hot-seat-lib.php';
const CL_GIST_PRIZES=[1000,500,250];
function cl_gist_rep_on(): bool {return (bool)(cl_hafrik_features()['gossip_rep']??false);}
// Beijing Monday 00:00 of this week (0) or an earlier one (-1 = last week), as a Unix time (so the database's own
// time zone never matters: rows are compared with UNIX_TIMESTAMP(created_at)).
function cl_gist_week(int $offset=0): int {
    $d=new DateTimeImmutable('now',new DateTimeZone('Asia/Shanghai'));$monday=$d->modify('-'.((int)$d->format('N')-1).' days')->setTime(0,0);
    return $monday->modify(($offset*7).' days')->getTimestamp();
}
function cl_gist_rep(int $uid, ?int $from=null, ?int $to=null): int {
    $range=($from!==null?' AND UNIX_TIMESTAMP(created_at)>=?':'').($to!==null?' AND UNIX_TIMESTAMP(created_at)<?':'');
    $args=array_values(array_filter([$from,$to],fn($v)=>$v!==null));$types='i'.str_repeat('i',count($args));
    $rep=0;
    foreach (cl_optional_rows("SELECT result,true_votes+cap_votes n FROM chinalife_hot_seat WHERE user_id=? AND status='revealed'".$range,$types,array_merge([$uid],$args)) as $r)
        if ((int)$r['n']>=HS_MIN_VOTES) $rep+=$r['result']==='true'?10:($r['result']==='cap'?-5:0);
    foreach (cl_optional_rows("SELECT (SELECT COUNT(*) FROM chinalife_gist_night_reactions x WHERE x.post_id=g.id) n FROM chinalife_gist_night g WHERE g.user_id=? AND g.official=0".str_replace('created_at','g.created_at',$range),$types,array_merge([$uid],$args)) as $r)
        $rep+=min(5,intdiv((int)$r['n'],5));
    return $rep;
}
// Pays last week's award once, when anyone asks for rep after the week has turned. Returns the winners' user ids.
function cl_gist_award_due(): array {
    global $db;if (!cl_gist_rep_on()) return [];
    $from=cl_gist_week(-1);$to=cl_gist_week(0);
    $db->begin_transaction();
    try {
        cl_run("INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('gossip_award','{}',NOW())");
        $row=cl_one("SELECT value FROM chinalife_settings WHERE name='gossip_award' FOR UPDATE");$done=json_decode((string)($row['value']??'{}'),true)?:[];
        if ((int)($done['week']??0)===$from) {$db->commit();return [];}
        $ids=array_unique(array_map('intval',array_merge(
            array_column(cl_optional_rows("SELECT DISTINCT user_id FROM chinalife_hot_seat WHERE status='revealed' AND UNIX_TIMESTAMP(created_at)>=? AND UNIX_TIMESTAMP(created_at)<?",'ii',[$from,$to]),'user_id'),
            array_column(cl_optional_rows("SELECT DISTINCT user_id FROM chinalife_gist_night WHERE official=0 AND UNIX_TIMESTAMP(created_at)>=? AND UNIX_TIMESTAMP(created_at)<?",'ii',[$from,$to]),'user_id'))));
        $scores=[];foreach ($ids as $id) {$r=cl_gist_rep($id,$from,$to);if ($r>0) $scores[$id]=$r;}
        arsort($scores);$winners=array_slice(array_keys($scores),0,3);
        $label=(new DateTimeImmutable('@'.$from))->setTimezone(new DateTimeZone('Asia/Shanghai'))->format('j M');
        foreach ($winners as $i=>$id) {
            if (!cl_one('SELECT user_id FROM chinalife_saves WHERE user_id=?','i',[$id])) continue;
            cl_credit($id,CL_GIST_PRIZES[$i]);
            if ((int)cl_one('SELECT COUNT(*) n FROM chinalife_badges WHERE user_id=?','i',[$id])['n']<30)
                cl_run('INSERT INTO chinalife_badges(user_id,icon,name,awarded_by,created_at) VALUES(?,?,?,0,NOW())','iss',[$id,['🥇','🥈','🥉'][$i],'Truth teller · week of '.$label]);
        }
        cl_run("UPDATE chinalife_settings SET value=?,updated_at=NOW() WHERE name='gossip_award'",'s',[json_encode(['week'=>$from,'winners'=>array_map('strval',$winners)])]);
        $db->commit();return $winners;
    } catch (Throwable $e) {$db->rollback();throw $e;}
}
