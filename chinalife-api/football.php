<?php
declare(strict_types=1);
// Football Field: real-time small-sided matches (1v1 to 5v5) and knockout tournaments.
// Host-authoritative: the host's phone runs the match (public/football-engine.js) and POSTs a snapshot ~5 times a
// second; every other player POSTs their joystick and Pass/Shoot taps and polls the latest snapshot. Bots fill gaps.
// At full time the host reports the score and goal list; the server re-checks it (fb_check_result) and waits for
// the other players to confirm what they saw before it counts (fb_settle). A player can only be in one match at a time.
//
// GET  football.php?action=lobby                      -> {enabled, me, mine, lobbies, tournaments}
// GET  football.php?action=state&id=..                -> {match, players, snap}
// GET  football.php?action=tournament&id=..           -> {tournament, teams, matches}
// POST {action:'create', size} | {action:'quick', size} | {action:'join', id, team} | {action:'team', id, team}
// POST {action:'leave', id} | {action:'start', id} (host)
// POST {action:'input', id, mx, my, pass, shoot}      (players)  -> {snap}
// POST {action:'snap', id, seq, snap}                 (host)     -> {inputs}
// POST {action:'result', id, report}                  (host)     -> {status}
// POST {action:'confirm', id, score}                  (others)   -> {status}
// POST {action:'t_create', name, team_size, starts_at, max_teams} (any player; prizes are admin-only)
// POST {action:'t_register', id, team_name} | {action:'t_join', id, team_id} | {action:'t_leave', id} | {action:'t_play', id}
// Admin create/edit/cancel/resolve and the on/off switch live in football-admin.php (admin.php actions football*).
require_once __DIR__.'/common.php';
require_once __DIR__.'/football-lib.php';
cl_methods(['GET','POST']);
$input=$method==='POST'?cl_body(60000):$_GET;
$action=is_string($input['action']??null)?$input['action']:'lobby';
$hot=in_array($action,['input','snap','state'],true);
cl_rate($hot?'football_hot':'football',$hot?900:120,60);
if (!cl_football_enabled()) {if ($method==='GET'&&$action==='lobby') cl_reply(['enabled'=>false]); cl_fail('Football matches are closed right now',403);}
$id=(int)($input['id']??0);

function fb_match(int $id,bool $lock=false): array {
    $m=cl_one('SELECT * FROM chinalife_football_matches WHERE id=?'.($lock?' FOR UPDATE':''),'i',[$id]);
    if (!$m) cl_fail('That match has ended',404); return $m;
}
function fb_public(array $m): array {
    return ['id'=>(string)$m['id'],'status'=>$m['status'],'size'=>(int)$m['size'],'host'=>$m['host_id']!==null?(string)$m['host_id']:null,
        'tournament'=>$m['tournament_id']!==null?(string)$m['tournament_id']:null,'bracket_match'=>$m['bracket_match'],
        'seed'=>(int)$m['seed'],'duration'=>(int)$m['duration_ms'],'knockout'=>(bool)$m['knockout'],
        'score'=>$m['score_a']===null?null:[(int)$m['score_a'],(int)$m['score_b']],'winner'=>$m['winner']===null?null:(int)$m['winner']];
}
function fb_roster(int $id): array {return array_map(fn($p)=>['id'=>(string)$p['user_id'],'name'=>$p['user_name']??'Player','team'=>(int)$p['team']],fb_match_players($id));}
function fb_me_in(array $m): ?array {global $uid;return cl_one('SELECT team,left_at FROM chinalife_football_match_players WHERE match_id=? AND user_id=? AND left_at IS NULL','ii',[(int)$m['id'],$uid]);}
function fb_join(array $m,int $team): void {
    global $uid;
    if ($m['status']!=='lobby') cl_fail('That match already kicked off');
    if (fb_active_match($uid,(int)$m['id'])) cl_fail('Finish or leave your other match first');
    if ($m['tournament_id']!==null) {
        $mine=cl_one('SELECT team_id FROM chinalife_football_tournament_members WHERE tournament_id=? AND user_id=?','ii',[(int)$m['tournament_id'],$uid]);
        if (!$mine||!in_array((int)$mine['team_id'],[(int)$m['team_a_id'],(int)$m['team_b_id']],true)) cl_fail('This match is for the two teams in it');
        $team=(int)$mine['team_id']===(int)$m['team_a_id']?0:1;
    }
    $count=cl_one('SELECT COUNT(*) n FROM chinalife_football_match_players WHERE match_id=? AND team=? AND left_at IS NULL AND user_id<>?','iii',[(int)$m['id'],$team,$uid]);
    if ((int)$count['n']>=(int)$m['size']) cl_fail('That team is full');
    cl_run('INSERT INTO chinalife_football_match_players(match_id,user_id,team,joined_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE team=VALUES(team),left_at=NULL,confirm=NULL','iii',[(int)$m['id'],$uid,$team]);
    if ($m['host_id']===null) cl_run('UPDATE chinalife_football_matches SET host_id=?,updated_at=NOW() WHERE id=? AND host_id IS NULL','ii',[$uid,(int)$m['id']]);
}
function fb_state(int $id): array {
    global $uid;$m=fb_match($id);
    return ['me'=>(string)$uid,'match'=>fb_public($m),'players'=>fb_roster($id),'snap'=>$m['state']?json_decode((string)$m['state'],true):null,'seq'=>(int)$m['state_seq']];
}
function fb_finalise(array $m): string {
    // Settle a reported match once the confirmations allow it.
    $rep=json_decode((string)$m['report'],true);$players=fb_match_players((int)$m['id']);$hostTeam=0;$confirms=[];$teams=[0=>0,1=>0];
    foreach ($players as $p) {$teams[(int)$p['team']]++; if ((int)$p['user_id']===(int)$m['host_id']) {$hostTeam=(int)$p['team'];continue;} if ($p['confirm']!==null) $confirms[]=['team'=>(int)$p['team'],'score'=>json_decode($p['confirm'],true)];}
    $age=(int)cl_one('SELECT TIMESTAMPDIFF(SECOND,reported_at,NOW()) a FROM chinalife_football_matches WHERE id=?','i',[(int)$m['id']])['a'];
    $verdict=fb_settle($rep['score'],$hostTeam,$confirms,$teams[1-$hostTeam]>0,$m['tournament_id']!==null,$age);
    if ($verdict==='wait') return 'reported';
    if ($verdict==='dispute') {cl_run("UPDATE chinalife_football_matches SET status='disputed',updated_at=NOW() WHERE id=?",'i',[(int)$m['id']]);return 'disputed';}
    cl_run("UPDATE chinalife_football_matches SET status='done',ended_at=NOW(),updated_at=NOW() WHERE id=?",'i',[(int)$m['id']]);
    if ($m['tournament_id']!==null&&$rep['winner']!==null) fb_tournament_result((int)$m['tournament_id'],(string)$m['bracket_match'],(int)($rep['winner']===0?$m['team_a_id']:$m['team_b_id']),$rep['score']);
    return 'done';
}

if ($method==='GET') {
    if ($action==='state') cl_reply(fb_state($id));
    if ($action==='tournament') {
        $t=cl_one('SELECT id,name,team_size,starts_at,max_teams,status,prize_coins,bracket,champion_team_id,created_by FROM chinalife_football_tournaments WHERE id=?','i',[$id]);
        if (!$t) cl_fail('No such tournament',404);
        if (in_array($t['status'],['registering','running'],true)) {global $db;$db->begin_transaction();fb_tournament_tick($id);$db->commit();$t=cl_one('SELECT id,name,team_size,starts_at,max_teams,status,prize_coins,bracket,champion_team_id,created_by FROM chinalife_football_tournaments WHERE id=?','i',[$id]);}
        $t['bracket']=$t['bracket']?json_decode((string)$t['bracket'],true):null;
        $matches=cl_rows("SELECT id,status,bracket_match,score_a,score_b,scheduled_at FROM chinalife_football_matches WHERE tournament_id=? ORDER BY id",'i',[$id]);
        cl_reply(['me'=>(string)$uid,'tournament'=>$t,'teams'=>fb_tournament_teams($id),'matches'=>$matches]);
    }
    fb_tidy();
    $mine=fb_active_match($uid);
    // A reported result waiting for confirmations settles here once its wait is over, so nobody stays stuck.
    if ($mine&&$mine['status']==='reported') {global $db;$db->begin_transaction();fb_finalise(fb_match((int)$mine['id'],true));$db->commit();$mine=fb_active_match($uid);}
    $lobbies=cl_rows("SELECT m.id,m.size,m.status,m.host_id,(SELECT COUNT(*) FROM chinalife_football_match_players p WHERE p.match_id=m.id AND p.left_at IS NULL) humans FROM chinalife_football_matches m WHERE m.status IN('lobby','live') AND m.tournament_id IS NULL ORDER BY m.id DESC LIMIT 20");
    $tournaments=cl_rows("SELECT t.id,t.name,t.team_size,t.starts_at,t.max_teams,t.status,t.prize_coins,(SELECT COUNT(*) FROM chinalife_football_tournament_teams x WHERE x.tournament_id=t.id) teams FROM chinalife_football_tournaments t WHERE t.status IN('registering','running') OR t.updated_at>NOW()-INTERVAL 2 DAY ORDER BY t.starts_at LIMIT 20");
    cl_reply(['enabled'=>true,'me'=>(string)$uid,'mine'=>$mine?fb_state((int)$mine['id']):null,'lobbies'=>$lobbies,'tournaments'=>$tournaments]);
}

global $db;
switch ($action) {
case 'create': case 'quick':
    $size=max(1,min(FB_MAX_TEAM,(int)($input['size']??3)));
    if (fb_active_match($uid)) cl_fail('Finish or leave your other match first');
    $db->begin_transaction();
    if ($action==='quick') {
        $open=cl_one("SELECT m.* FROM chinalife_football_matches m WHERE m.status='lobby' AND m.tournament_id IS NULL AND m.size=? AND (SELECT COUNT(*) FROM chinalife_football_match_players p WHERE p.match_id=m.id AND p.left_at IS NULL)<m.size*2 ORDER BY m.id LIMIT 1 FOR UPDATE",'i',[$size]);
        if ($open) {$a=cl_one('SELECT SUM(team=0) a,SUM(team=1) b FROM chinalife_football_match_players WHERE match_id=? AND left_at IS NULL','i',[(int)$open['id']]);fb_join($open,(int)$a['a']<=(int)$a['b']?0:1);$db->commit();cl_reply(fb_state((int)$open['id']));}
    }
    cl_run("INSERT INTO chinalife_football_matches(city,status,size,host_id,seed,duration_ms,knockout,created_at,updated_at) VALUES('China','lobby',?,?,?,?,0,NOW(),NOW())",'iiii',[$size,$uid,random_int(1,2000000000),FB_DURATION_MS]);
    $mid=(int)$db->insert_id;fb_join(fb_match($mid,true),0);$db->commit();cl_reply(fb_state($mid));
case 'join': case 'team':
    $db->begin_transaction();$m=fb_match($id,true);fb_join($m,(int)($input['team']??0)===1?1:0);$db->commit();cl_reply(fb_state($id));
case 'leave':
    $db->begin_transaction();$m=fb_match($id,true);
    cl_run('UPDATE chinalife_football_match_players SET left_at=NOW() WHERE match_id=? AND user_id=?','ii',[$id,$uid]);
    if ((int)$m['host_id']===$uid) {
        $next=cl_one('SELECT user_id FROM chinalife_football_match_players WHERE match_id=? AND left_at IS NULL ORDER BY joined_at LIMIT 1','i',[$id]);
        if ($next) cl_run('UPDATE chinalife_football_matches SET host_id=?,updated_at=NOW() WHERE id=?','ii',[(int)$next['user_id'],$id]);
        elseif ($m['tournament_id']===null) cl_run("UPDATE chinalife_football_matches SET status='cancelled',ended_at=NOW() WHERE id=? AND status IN('lobby','live')",'i',[$id]);
        else cl_run("UPDATE chinalife_football_matches SET host_id=NULL,status=IF(status='live','lobby',status),state=NULL WHERE id=?",'i',[$id]);
    }
    $db->commit();cl_reply(['left'=>true]);
case 'start':
    $db->begin_transaction();$m=fb_match($id,true);
    if ((int)$m['host_id']!==$uid) cl_fail('Only the host can kick off');
    if ($m['status']!=='lobby') cl_fail('Already started');
    if ($m['tournament_id']!==null) {$t=cl_one('SELECT SUM(team=0) a,SUM(team=1) b FROM chinalife_football_match_players WHERE match_id=? AND left_at IS NULL','i',[$id]);if ((int)$t['a']<1||(int)$t['b']<1) cl_fail('Wait for at least one player from each team');}
    cl_run("UPDATE chinalife_football_matches SET status='live',started_at=NOW(),updated_at=NOW(),state=NULL,state_seq=0 WHERE id=?",'i',[$id]);
    $db->commit();cl_reply(fb_state($id));
case 'snap':
    $m=fb_match($id);if ((int)$m['host_id']!==$uid) cl_fail('Only the host sends the match',403);
    if ($m['status']!=='live') cl_reply(['match'=>fb_public($m)]);
    $snap=$input['snap']??null;if (!is_array($snap)) cl_fail('Missing snapshot');
    $json=json_encode($snap);if (strlen($json)>8000) cl_fail('Snapshot too large');
    cl_run('UPDATE chinalife_football_matches SET state=?,state_seq=?,updated_at=NOW() WHERE id=? AND state_seq<?','siii',[$json,(int)($input['seq']??0),$id,(int)($input['seq']??0)]);
    $inputs=[];foreach (cl_rows('SELECT user_id,input FROM chinalife_football_match_players WHERE match_id=? AND left_at IS NULL AND input_at>NOW(3)-INTERVAL 2 SECOND','i',[$id]) as $r) $inputs[(string)$r['user_id']]=json_decode((string)$r['input'],true);
    cl_reply(['inputs'=>$inputs,'players'=>fb_roster($id)]);
case 'input':
    $c=fn($v)=>max(-1,min(1,round((float)$v,2)));
    $in=json_encode(['mx'=>$c($input['mx']??0),'my'=>$c($input['my']??0),'pass'=>!empty($input['pass']),'shoot'=>!empty($input['shoot'])]);
    cl_run('UPDATE chinalife_football_match_players SET input=?,input_at=NOW(3) WHERE match_id=? AND user_id=? AND left_at IS NULL','sii',[$in,$id,$uid]);
    cl_reply(fb_state($id));
case 'result':
    $db->begin_transaction();$m=fb_match($id,true);
    if ((int)$m['host_id']!==$uid) cl_fail('Only the host reports the result',403);
    if ($m['status']!=='live') cl_fail('This match is not live');
    $elapsed=(int)cl_one('SELECT TIMESTAMPDIFF(SECOND,started_at,NOW()) e FROM chinalife_football_matches WHERE id=?','i',[$id])['e'];
    if ($elapsed*1000<(int)$m['duration_ms']-5000) cl_fail('The match is not over yet');
    $report=$input['report']??null;$ids=array_map(fn($p)=>(string)$p['user_id'],fb_match_players($id));
    $why=fb_check_result($report,$ids,(bool)$m['knockout'],(int)$m['seed'],(int)$m['duration_ms']);
    if ($why!==null) {cl_run("UPDATE chinalife_football_matches SET status='disputed',report=?,updated_at=NOW() WHERE id=?",'si',[json_encode(['rejected'=>$why,'report'=>$report]),$id]);$db->commit();cl_fail('Result rejected: '.$why);}
    $sa=(int)$report['score'][0];$sb=(int)$report['score'][1];$w=$report['winner'];
    cl_run("UPDATE chinalife_football_matches SET status='reported',report=?,score_a=?,score_b=?,winner=?,reported_at=NOW(),updated_at=NOW() WHERE id=?",'siiii',[json_encode($report),$sa,$sb,$w,$id]);
    $status=fb_finalise(fb_match($id,true));$db->commit();cl_reply(['status'=>$status]);
case 'confirm':
    $db->begin_transaction();$m=fb_match($id,true);
    if (!fb_me_in($m)) cl_fail('You were not in this match');
    $sc=$input['score']??null;if (!is_array($sc)||count($sc)!==2) cl_fail('Missing score');
    cl_run('UPDATE chinalife_football_match_players SET confirm=? WHERE match_id=? AND user_id=?','sii',[json_encode([(int)$sc[0],(int)$sc[1]]),$id,$uid]);
    $status=$m['status']==='reported'?fb_finalise(fb_match($id,true)):$m['status'];$db->commit();cl_reply(['status'=>$status]);
case 't_create':
    $name=fb_clean_name($input['name']??'',40);if (mb_strlen($name)<3) cl_fail('Give the tournament a name');
    $size=max(1,min(FB_MAX_TEAM,(int)($input['team_size']??3)));$max=max(2,min(32,(int)($input['max_teams']??8)));
    $at=strtotime((string)($input['starts_at']??''));if (!$at||$at<time()+60||$at>time()+30*86400) cl_fail('Pick a start time in the next 30 days');
    if (cl_one("SELECT COUNT(*) n FROM chinalife_football_tournaments WHERE created_by=? AND status='registering'",'i',[$uid])['n']>=2) cl_fail('You already have two tournaments open');
    cl_run("INSERT INTO chinalife_football_tournaments(name,team_size,starts_at,max_teams,status,prize_coins,created_by,created_at,updated_at) VALUES(?,?,?,?,'registering',0,?,NOW(),NOW())",'sisii',[$name,$size,gmdate('Y-m-d H:i:s',$at),$max,$uid]);
    cl_reply(['id'=>(string)$db->insert_id]);
case 't_register': case 't_join':
    $db->begin_transaction();$t=cl_one('SELECT * FROM chinalife_football_tournaments WHERE id=? FOR UPDATE','i',[$id]);
    if (!$t||$t['status']!=='registering') cl_fail('Registration is closed');
    if (cl_one('SELECT 1 FROM chinalife_football_tournament_members WHERE tournament_id=? AND user_id=?','ii',[$id,$uid])) cl_fail('You are already in a team here');
    if ($action==='t_register') {
        $tn=fb_clean_name($input['team_name']??'',24);if (mb_strlen($tn)<2) cl_fail('Name your team');
        if (cl_one('SELECT COUNT(*) n FROM chinalife_football_tournament_teams WHERE tournament_id=?','i',[$id])['n']>=(int)$t['max_teams']) cl_fail('The tournament is full');
        if (cl_one('SELECT 1 FROM chinalife_football_tournament_teams WHERE tournament_id=? AND name=?','is',[$id,$tn])) cl_fail('That team name is taken');
        cl_run('INSERT INTO chinalife_football_tournament_teams(tournament_id,name,captain_id,created_at) VALUES(?,?,?,NOW())','isi',[$id,$tn,$uid]);$team=(int)$db->insert_id;
    } else {
        $team=(int)($input['team_id']??0);if (!cl_one('SELECT 1 FROM chinalife_football_tournament_teams WHERE id=? AND tournament_id=?','ii',[$team,$id])) cl_fail('No such team');
        if (cl_one('SELECT COUNT(*) n FROM chinalife_football_tournament_members WHERE team_id=?','i',[$team])['n']>=(int)$t['team_size']) cl_fail('That team is full');
    }
    cl_run('INSERT INTO chinalife_football_tournament_members(tournament_id,team_id,user_id,joined_at) VALUES(?,?,?,NOW())','iii',[$id,$team,$uid]);
    $db->commit();cl_reply(['team_id'=>(string)$team,'teams'=>fb_tournament_teams($id)]);
case 't_leave':
    $db->begin_transaction();$t=cl_one('SELECT status FROM chinalife_football_tournaments WHERE id=? FOR UPDATE','i',[$id]);
    if (!$t||$t['status']!=='registering') cl_fail('You can only leave before it starts');
    $mine=cl_one('SELECT team_id FROM chinalife_football_tournament_members WHERE tournament_id=? AND user_id=?','ii',[$id,$uid]);
    if ($mine) {cl_run('DELETE FROM chinalife_football_tournament_members WHERE tournament_id=? AND user_id=?','ii',[$id,$uid]);
        if (!cl_one('SELECT 1 FROM chinalife_football_tournament_members WHERE team_id=?','i',[(int)$mine['team_id']])) cl_run('DELETE FROM chinalife_football_tournament_teams WHERE id=?','i',[(int)$mine['team_id']]);}
    $db->commit();cl_reply(['left'=>true]);
case 't_play':
    $db->begin_transaction();fb_tournament_tick($id);
    $mine=cl_one('SELECT team_id FROM chinalife_football_tournament_members WHERE tournament_id=? AND user_id=?','ii',[$id,$uid]);if (!$mine) cl_fail('You are not in this tournament');
    $m=cl_one("SELECT * FROM chinalife_football_matches WHERE tournament_id=? AND status='lobby' AND (team_a_id=? OR team_b_id=?) LIMIT 1 FOR UPDATE",'iii',[$id,(int)$mine['team_id'],(int)$mine['team_id']]);
    if (!$m) {$db->commit();cl_fail('No match for your team right now');}
    fb_join($m,0);$db->commit();cl_reply(fb_state((int)$m['id']));
default: cl_fail('Unknown action');
}
