<?php
declare(strict_types=1);
// Admin actions for Football Field matches, included from admin.php (already admin-checked there).
// football                    -> {enabled, tournaments, disputed}
// set_football {enabled}      -> the feature switch (settings row 'football_matches'); off until approved
// football_tournament_save {id?, name, team_size, starts_at, max_teams, prize_coins}
// football_tournament_cancel {id}
// football_match_resolve {id, winner: 0|1|null, score:[a,b]}  -> settle a disputed match
require_once __DIR__.'/football-lib.php';
if ($action==='football') {
    $t=cl_optional_rows("SELECT t.id,t.name,t.team_size,t.starts_at,t.max_teams,t.status,t.prize_coins,(SELECT COUNT(*) FROM chinalife_football_tournament_teams x WHERE x.tournament_id=t.id) teams FROM chinalife_football_tournaments t ORDER BY t.id DESC LIMIT 40");
    $d=cl_optional_rows("SELECT id,tournament_id,bracket_match,report,updated_at FROM chinalife_football_matches WHERE status='disputed' ORDER BY id DESC LIMIT 40");
    json_response('success',['enabled'=>cl_football_enabled(),'tournaments'=>$t,'disputed'=>$d]);
}
if ($action==='set_football') {
    $on=($input['enabled']??null)===true;
    $db->begin_transaction();cl_run("INSERT IGNORE INTO chinalife_settings(name,value,updated_at) VALUES('football_matches','{}',NOW())");
    cl_one("SELECT value FROM chinalife_settings WHERE name='football_matches' FOR UPDATE");
    cl_run("UPDATE chinalife_settings SET value=?,updated_at=NOW() WHERE name='football_matches'",'s',[json_encode(['enabled'=>$on])]);
    admin_log('set_football',null,null,$on?'on':'off');$db->commit();json_response('success',['enabled'=>$on]);
}
if ($action==='football_tournament_save') {
    $id=(int)($input['id']??0);$name=fb_clean_name($input['name']??'',40);if (mb_strlen($name)<3) cl_fail('Give the tournament a name');
    $size=max(1,min(FB_MAX_TEAM,(int)($input['team_size']??3)));$max=max(2,min(32,(int)($input['max_teams']??8)));
    $prize=max(0,min(1000000,(int)($input['prize_coins']??0)));$at=strtotime((string)($input['starts_at']??''));if (!$at) cl_fail('Pick a start time');
    if ($id) {
        $row=cl_one('SELECT status FROM chinalife_football_tournaments WHERE id=?','i',[$id]);if (!$row) cl_fail('No such tournament',404);
        if ($row['status']!=='registering') cl_fail('Only tournaments still taking teams can be edited');
        cl_run('UPDATE chinalife_football_tournaments SET name=?,team_size=?,starts_at=?,max_teams=?,prize_coins=?,updated_at=NOW() WHERE id=?','sisiii',[$name,$size,gmdate('Y-m-d H:i:s',$at),$max,$prize,$id]);
    } else {
        cl_run("INSERT INTO chinalife_football_tournaments(name,team_size,starts_at,max_teams,status,prize_coins,created_by,created_at,updated_at) VALUES(?,?,?,?,'registering',?,?,NOW(),NOW())",'sisiii',[$name,$size,gmdate('Y-m-d H:i:s',$at),$max,$prize,$uid]);$id=(int)$db->insert_id;
    }
    admin_log('football_tournament_save',$id,$prize,$name);json_response('success',['id'=>(string)$id]);
}
if ($action==='football_tournament_cancel') {
    $id=(int)($input['id']??0);
    cl_run("UPDATE chinalife_football_tournaments SET status='cancelled',updated_at=NOW() WHERE id=? AND status IN('registering','running')",'i',[$id]);
    cl_run("UPDATE chinalife_football_matches SET status='cancelled',ended_at=NOW() WHERE tournament_id=? AND status IN('lobby','live','reported','disputed')",'i',[$id]);
    admin_log('football_tournament_cancel',$id,null,'');json_response('success',['id'=>(string)$id]);
}
if ($action==='football_match_resolve') {
    $id=(int)($input['id']??0);$db->begin_transaction();
    $m=cl_one("SELECT * FROM chinalife_football_matches WHERE id=? AND status='disputed' FOR UPDATE",'i',[$id]);if (!$m) cl_fail('No disputed match with that id',404);
    $sc=$input['score']??null;if (!is_array($sc)||count($sc)!==2) cl_fail('Give the final score');
    $w=$input['winner']??null;$w=$w===null?null:((int)$w===1?1:0);
    if ($m['tournament_id']!==null&&$w===null) cl_fail('A tournament match needs a winner');
    cl_run("UPDATE chinalife_football_matches SET status='done',score_a=?,score_b=?,winner=?,ended_at=NOW(),updated_at=NOW() WHERE id=?",'iiii',[(int)$sc[0],(int)$sc[1],$w,$id]);
    if ($m['tournament_id']!==null) fb_tournament_result((int)$m['tournament_id'],(string)$m['bracket_match'],(int)($w===0?$m['team_a_id']:$m['team_b_id']),[(int)$sc[0],(int)$sc[1]]);
    admin_log('football_match_resolve',$id,null,json_encode($sc));$db->commit();json_response('success',['id'=>(string)$id]);
}
