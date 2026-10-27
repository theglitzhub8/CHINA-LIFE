<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET']);cl_rate('profile',90,60);
$id=isset($_GET['peer'])?cl_peer($_GET['peer']):$uid;if(cl_blocked($uid,$id))cl_fail('Player unavailable',403);
$row=cl_one('SELECT u.user_id id,u.user_name name,s.game_state FROM users u JOIN chinalife_saves s ON s.user_id=u.user_id WHERE u.user_id=?','i',[$id]);if(!$row)cl_fail('Character unavailable',404);
$g=json_decode($row['game_state'],true);$assets=json_decode(file_get_contents(__DIR__.'/assets.json'),true,512,JSON_THROW_ON_ERROR);$homes=[];$value=0;
$portfolio=$g['propertyPortfolio']??[];foreach(($g['properties']??[]) as $city=>$type){$portfolio[$city]=$portfolio[$city]??[];if(!in_array($type,$portfolio[$city],true))$portfolio[$city][]=$type;}
foreach($portfolio as $city=>$types)foreach(array_unique($types) as $type)if(isset($assets['properties'][$type])){$homes[]=['name'=>ucfirst($type),'city'=>$city,'type'=>$type];$value+=$assets['properties'][$type];}
foreach($assets['estates'] as $h)if(in_array($h['id'],$g['ownedHomes']??[],true)){$homes[]=['name'=>$h['name'],'city'=>'Shenyang','type'=>$h['type'],'place'=>$h['id']];$value+=$h['price'];}
$items=[];foreach(array_unique($g['upgrades']??[]) as $item)if(isset($assets['furniture'][$item])){$items[]=$item;$value+=$assets['furniture'][$item];}
$bal=cl_one('SELECT coins,xp FROM chinalife_balances WHERE user_id=?','i',[$id]);
$money=$bal?(int)$bal['coins']:(int)($g['money']??0);$xp=$bal?(int)$bal['xp']:(int)($g['xp']??0);
$netWorth=max(0,$money)+$value;
// Other players only ever see a status badge, never the balance or net worth.
$title=$netWorth>=1000000000?'🏆 Billionaire':($netWorth>=10000000?'👑 Big Laoban':($netWorth>=1000000?'💎 Millionaire':($netWorth>=100000?'💰 Rising Baller':'🌱 Building a life')));$own=$id===$uid;
// v6 profile stats. Every extra is optional so a missing table never breaks the profile.
$one=function(string $q,string $t,array $v){$r=cl_optional_rows($q,$t,$v);return $r?(int)array_values($r[0])[0]:0;};
$friendsN=$one("SELECT COUNT(*) n FROM chinalife_friends WHERE (first_id=? OR second_id=?) AND status='accepted'",'ii',[$id,$id]);
$dance=$one('SELECT COUNT(*) n FROM chinalife_party_rounds WHERE winner_id=?','i',[$id]);
cl_election_winners_sync();$offices=$one('SELECT COUNT(*) n FROM chinalife_election_winners WHERE user_id=?','i',[$id]);
$visited=max(count(array_unique(array_filter((array)($g['visited']??[]),'is_string'))),$one('SELECT COUNT(*) n FROM chinalife_life_visits WHERE user_id=?','i',[$id]));
$recent=array_map(fn($r)=>['place'=>(string)$r['place'],'city'=>(string)$r['city'],'at'=>(int)$r['at']],cl_optional_rows('SELECT city,place,UNIX_TIMESTAMP(MAX(created_at))*1000 at FROM chinalife_life_visits WHERE user_id=? GROUP BY city,place ORDER BY at DESC LIMIT 5','i',[$id]));
$flist=array_map(fn($r)=>['id'=>(string)$r['id'],'name'=>(string)$r['name'],'color'=>(string)($r['color']??'#246fa7')],cl_optional_rows("SELECT u.user_id id,u.user_name name,p.color FROM chinalife_friends f JOIN users u ON u.user_id=IF(f.first_id=?,f.second_id,f.first_id) LEFT JOIN chinalife_presence p ON p.user_id=u.user_id WHERE (f.first_id=? OR f.second_id=?) AND f.status='accepted' ORDER BY f.created_at DESC LIMIT 8",'iii',[$id,$id,$id]));
// Link Up record (Oct 2026). Football: finished, non-disputed matches the player stayed in, and tournament titles.
// Hot seat: votes on revealed gists that matched the room's verdict. Authorship is never counted, so gists stay anonymous.
$fb=cl_optional_rows("SELECT COUNT(*) played,COALESCE(SUM(m.winner IS NOT NULL AND m.winner=p.team),0) won FROM chinalife_football_match_players p JOIN chinalife_football_matches m ON m.id=p.match_id WHERE p.user_id=? AND p.left_at IS NULL AND m.status='done'",'i',[$id]);
$titles=$one("SELECT COUNT(*) n FROM chinalife_football_tournaments t JOIN chinalife_football_tournament_members tm ON tm.tournament_id=t.id AND tm.team_id=t.champion_team_id WHERE tm.user_id=? AND t.status='done'",'i',[$id]);
$hs=cl_optional_rows("SELECT COUNT(*) calls,COALESCE(SUM(v.vote=g.result),0) rightcalls FROM chinalife_hot_seat_votes v JOIN chinalife_hot_seat g ON g.id=v.gist_id WHERE v.user_id=? AND g.status='revealed' AND g.result IN('true','cap')",'i',[$id]);
$pres=cl_one('SELECT city,place,(seen_at>=DATE_SUB(NOW(),INTERVAL 20 SECOND)) online FROM chinalife_presence WHERE user_id=?','i',[$id]);
$hasHome=!empty($g['ownedHomes'])||!empty($g['properties'])||!empty($g['propertyPortfolio']);
$extra=['city'=>(string)($pres['city']??($g['city']??'')),'online'=>(bool)($pres['online']??false),'role'=>is_string($g['background']??null)?$g['background']:null,'days'=>max(1,(int)($g['day']??1)),'stats'=>['friends'=>$friendsN,'venues'=>$visited,'dance'=>$dance,'offices'=>$offices],'recent'=>$recent,'friends'=>$flist,'coins'=>$own?$money:null,'hasHome'=>$hasHome,'own'=>$own]+($fb?['football'=>['played'=>(int)$fb[0]['played'],'won'=>(int)$fb[0]['won'],'titles'=>$titles]]:[])+($hs?['hotSeat'=>['calls'=>(int)$hs[0]['calls'],'right'=>(int)$hs[0]['rightcalls']]]:[]);
json_response('success',['profile'=>$extra+['id'=>(string)$id,'name'=>$row['name'],'gender'=>in_array($g['gender']??null,['male','female'],true)?$g['gender']:null,'xp'=>$xp,'wealth'=>$title,'netWorth'=>$own?$netWorth:null,'homes'=>$homes,'items'=>$items,'badges'=>cl_rank_status($id)['badges']]]);
