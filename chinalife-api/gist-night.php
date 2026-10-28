<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/hot-seat-lib.php';
require_once __DIR__.'/gossip-settings.php';
cl_methods(['GET','POST']);
// Gossip wall Phase 2 (docs/GOSSIP-ROOM-PLAN.md, appadmin switch gossip_wall): more reactions, anonymous replies,
// "Gist of the day" (today's most-reacted tip, at least 3 reactions) and place tags written in the post (#club …).
function gist_wall_on(): bool {return (bool)(cl_hafrik_features()['gossip_wall']??false);}
function gist_kinds(): array {return gist_wall_on()?['like','fire','laugh','shock','eyes','cap']:['like','fire','laugh'];}
const GIST_PLACES=['club','campus','football','hq','hospital','voting','gossip'];
function gist_place(string $body): ?string {return preg_match('/#('.implode('|',GIST_PLACES).')\b/i',$body,$m)?strtolower($m[1]):null;}

function gist_handle(int $userId, string $city): string {
    return 'night-'.substr(hash('sha256', $userId.'|'.$city.'|gist-night'), 0, 6);
}
function gist_night_feed(string $city): array {
    global $uid;
    $admin=cl_is_admin();
    // With the better wall on (Phase 6), tips hidden by reports or an admin leave the feed; admins still see them, marked.
    $posts=gist_wall_on()
        ?cl_rows('SELECT id,user_id,body,official,hidden,UNIX_TIMESTAMP(created_at)*1000 at FROM chinalife_gist_night WHERE city=? AND (hidden=0 OR ?=1) ORDER BY id DESC LIMIT 40','si',[$city,$admin?1:0])
        :cl_rows('SELECT id,user_id,body,official,UNIX_TIMESTAMP(created_at)*1000 at FROM chinalife_gist_night WHERE city=? ORDER BY id DESC LIMIT 40','s',[$city]);
    if (!$posts) return gist_legacy_posts($city,$admin);
    $ids=array_map(fn($p)=>(int)$p['id'],$posts);
    $in=implode(',',array_fill(0,count($ids),'?'));
    $types=str_repeat('i',count($ids));
    $reactions=[];$mine=[];
    foreach (cl_rows("SELECT post_id,kind,COUNT(*) n FROM chinalife_gist_night_reactions WHERE post_id IN ($in) GROUP BY post_id,kind",$types,$ids) as $row) $reactions[$row['post_id']][$row['kind']]=(int)$row['n'];
    foreach (cl_rows("SELECT post_id,kind FROM chinalife_gist_night_reactions WHERE user_id=? AND post_id IN ($in)",'i'.$types,array_merge([$uid],$ids)) as $row) $mine[$row['post_id']]=$row['kind'];
    $polls=[];
    foreach (cl_rows("SELECT id,post_id,question,options FROM chinalife_gist_night_polls WHERE post_id IN ($in)",$types,$ids) as $row) $polls[$row['post_id']]=$row;
    $pollIds=array_map(fn($p)=>(int)$p['id'],array_values($polls));
    $counts=[];$voted=[];
    if ($pollIds) {
        $pin=implode(',',array_fill(0,count($pollIds),'?'));$pt=str_repeat('i',count($pollIds));
        foreach (cl_rows("SELECT poll_id,option_index,COUNT(*) n FROM chinalife_gist_night_votes WHERE poll_id IN ($pin) GROUP BY poll_id,option_index",$pt,$pollIds) as $row) $counts[$row['poll_id']][(int)$row['option_index']]=(int)$row['n'];
        foreach (cl_rows("SELECT poll_id,option_index FROM chinalife_gist_night_votes WHERE user_id=? AND poll_id IN ($pin)",'i'.$pt,array_merge([$uid],$pollIds)) as $row) $voted[$row['poll_id']]=(int)$row['option_index'];
    }
    // Replies (switch gossip_wall): the count and the latest three per post, anonymous; "OP" marks the tip's author.
    $replies=[];$replyCounts=[];
    if (gist_wall_on()) {
        $authors=array_column($posts,'user_id','id');
        foreach (cl_optional_rows("SELECT post_id,COUNT(*) n FROM chinalife_gist_night_replies WHERE post_id IN ($in) GROUP BY post_id",$types,$ids) as $row) $replyCounts[$row['post_id']]=(int)$row['n'];
        foreach (array_reverse(cl_optional_rows("SELECT id,post_id,user_id,body,UNIX_TIMESTAMP(created_at)*1000 at FROM chinalife_gist_night_replies WHERE post_id IN ($in) ORDER BY id DESC LIMIT 300",$types,$ids)) as $row) {
            $r=['id'=>(string)$row['id'],'body'=>$row['body'],'at'=>(int)$row['at'],'op'=>(int)$row['user_id']===(int)($authors[$row['post_id']]??0),'own'=>(int)$row['user_id']===(int)$uid];
            if ($admin) $r['user_id']=(string)$row['user_id'];
            $replies[$row['post_id']][]=$r;
        }
        foreach ($replies as $k=>$list) $replies[$k]=array_slice($list,-3);
    }
    $out=[];
    foreach ($posts as $post) {
        // official: 1 = Hafrik (pinned), 2 = City buzz (gossip-city-lib.php, never pinned, never "yours"), 0 = anonymous tip.
        $official=(int)$post['official']===1;$auto=(int)$post['official']===2;
        $item=['id'=>(string)$post['id'],'tag'=>$official?'Hafrik':($auto?'City buzz':'Anonymous tip'),'official'=>$official,'auto'=>$auto,'own'=>!$auto&&(int)$post['user_id']===(int)$uid,'body'=>$post['body'],'at'=>(int)$post['at'],'reactions'=>$reactions[$post['id']]??['like'=>0,'fire'=>0,'laugh'=>0],'mine'=>$mine[$post['id']]??null];
        foreach (gist_kinds() as $kind) $item['reactions'][$kind]=(int)($item['reactions'][$kind]??0);
        if (gist_wall_on()) {$item['place']=gist_place((string)$post['body']);$item['replies']=$replies[$post['id']]??[];$item['reply_count']=(int)($replyCounts[$post['id']]??0);}
        // Players only ever see 'Anonymous tip'. Admins can still trace the author.
        if ($admin) {$item['user_id']=(string)$post['user_id'];if (!empty($post['hidden'])) $item['hidden']=true;$item['handle']=gist_handle((int)$post['user_id'],$city);}
        if (isset($polls[$post['id']])) {
            $poll=$polls[$post['id']];$options=json_decode((string)$poll['options'],true)?:[];
            $item['poll']=['id'=>(string)$poll['id'],'question'=>$poll['question'],'voted'=>array_key_exists($poll['id'],$voted)?$voted[$poll['id']]:null,'options'=>[]];
            foreach (array_values($options) as $i=>$text) $item['poll']['options'][]=['text'=>$text,'votes'=>(int)($counts[$poll['id']][$i]??0)];
        }
        $out[]=$item;
    }
    // Gist of the day: today's (Beijing) anonymous tip with the most reactions, at least 3.
    if (gist_wall_on()) {
        $start=(new DateTimeImmutable(cl_beijing_day().' 00:00',new DateTimeZone('Asia/Shanghai')))->getTimestamp()*1000;$best=null;$bestN=2;
        foreach ($out as $k=>$item) {if ($item['official']||$item['at']<$start) continue;$n=array_sum($item['reactions']);if ($n>$bestN) {$best=$k;$bestN=$n;}}
        if ($best!==null) $out[$best]['top']=true;
    }
    $out=array_merge($out,gist_legacy_posts($city,$admin));
    // Official Hafrik posts are pinned on top; everything else is newest first.
    usort($out,fn($a,$b)=>[(int)!empty($b['official']),$b['at']]<=>[(int)!empty($a['official']),$a['at']]);
    return $out;
}
// Approved posts from the old city board (gist.php) are read into the same feed as anonymous tips.
// They keep their author in chinalife_gist_posts.created_by, so admins can still trace them.
function gist_legacy_posts(string $city, bool $admin): array {
    $out=[];
    foreach (cl_rows('SELECT id,title,body,link,created_by,UNIX_TIMESTAMP(created_at)*1000 at FROM chinalife_gist_posts WHERE (city=? OR city="") AND active=1 ORDER BY id DESC LIMIT 20','s',[$city]) as $row) {
        $text=trim($row['title']."\n".$row['body'].($row['link']!==''?"\n".$row['link']:''));
        $item=['id'=>'board-'.$row['id'],'legacy'=>true,'tag'=>'Anonymous tip','official'=>false,'own'=>false,'body'=>$text,'at'=>(int)$row['at'],'reactions'=>['like'=>0,'fire'=>0,'laugh'=>0],'mine'=>null];
        if ($admin) $item['user_id']=(string)$row['created_by'];
        $out[]=$item;
    }
    return $out;
}

$city=(string)($_GET['city']??'');
if ($method==='GET') {
    if (!in_array($city,cl_open_cities(),true)) cl_fail('Choose an active city');
    // The newest tip's id only, for the "New gist on the wall" banner in the Gossip Room (gossip-room.js).
    if (isset($_GET['latest'])) json_response('success',['latest'=>(string)(cl_one('SELECT MAX(id) id FROM chinalife_gist_night WHERE city=?','s',[$city])['id']??0)]);
    json_response('success',['city'=>$city,'admin'=>cl_is_admin(),'posts'=>gist_night_feed($city)]);
}
$input=cl_body();
$action=(string)($input['action']??'post');
$city=(string)($input['city']??$city);
if (!in_array($city,cl_open_cities(),true)) cl_fail('Choose an active city');
if ($action==='post') {
    cl_rate('gist_night',6,3600);
    $body=trim((string)($input['body']??''));
    if ($body===''||mb_strlen($body)>280) cl_fail('Write a short gossip');
    // The admin's extra blocked words (appadmin Gossip tab); with the better wall on, also the built-in swear list.
    if (cl_gossip_blocked($body)||(gist_wall_on()&&hs_profane($body))) cl_fail('Keep it friendly: no swearing or insults',422);
    $poll=$input['poll']??null;$clean=null;$question='';
    if ($poll!==null) {
        if (!is_array($poll)) cl_fail('Check the poll');
        $question=trim((string)($poll['question']??''));$options=$poll['options']??null;
        if ($question===''||mb_strlen($question)>140||!is_array($options)||count($options)<2||count($options)>4) cl_fail('A poll needs a question and 2 to 4 choices');
        $clean=[];
        foreach ($options as $option) {if (!is_string($option)) cl_fail('Check the poll');$option=trim($option);if ($option===''||mb_strlen($option)>40) cl_fail('Check the poll');$clean[]=$option;}
    }
    // Admins post from the same composer; their posts carry the official Hafrik tag unless they choose anonymous.
    $official=cl_is_admin()&&($input['official']??true)!==false?1:0;
    // Each city has its own feed. An official admin post can optionally go to every open city (one copy per city).
    $targets=$official&&($input['all_cities']??false)===true?cl_open_cities():[$city];
    foreach ($targets as $target) {
        cl_run('INSERT INTO chinalife_gist_night(user_id,city,body,official,created_at) VALUES(?,?,?,?,NOW())','issi',[$uid,$target,$body,$official]);
        $newId=(int)cl_one('SELECT LAST_INSERT_ID() id')['id'];if ($target===$city) $id=$newId;
        if ($clean) cl_run('INSERT INTO chinalife_gist_night_polls(post_id,question,options) VALUES(?,?,?)','iss',[$newId,$question,json_encode($clean,JSON_UNESCAPED_UNICODE)]);
    }
    json_response('success',['id'=>(string)$id,'posts'=>gist_night_feed($city)],($official?'Posted as Hafrik.':'Tip dropped.'));
}
if ($action==='react') {
    cl_rate('gist_night_tap',30,60);
    $id=(int)($input['id']??0);$kind=(string)($input['kind']??'');
    if (!in_array($kind,gist_kinds(),true) || !$id) cl_fail('Choose a reaction');
    $post=cl_one('SELECT id,city FROM chinalife_gist_night WHERE id=?','i',[$id]);
    if (!$post||$post['city']!==$city) cl_fail('That gossip is gone',404);
    $have=cl_one('SELECT kind FROM chinalife_gist_night_reactions WHERE post_id=? AND user_id=?','ii',[$id,$uid]);
    if ($have&&$have['kind']===$kind) cl_run('DELETE FROM chinalife_gist_night_reactions WHERE post_id=? AND user_id=?','ii',[$id,$uid]);
    elseif ($have) cl_run('UPDATE chinalife_gist_night_reactions SET kind=?,created_at=NOW() WHERE post_id=? AND user_id=?','sii',[$kind,$id,$uid]);
    else cl_run('INSERT INTO chinalife_gist_night_reactions(post_id,user_id,kind,created_at) VALUES(?,?,?,NOW())','iis',[$id,$uid,$kind]);
    json_response('success',['posts'=>gist_night_feed($city)],'Reaction saved.');
}
if ($action==='reply') {
    // A short anonymous answer (switch gossip_wall): 2-140 characters, no swearing, links, @handles or numbers.
    if (!gist_wall_on()) cl_fail('Replies are switched off',403);
    cl_rate('gist_night_reply',20,3600);
    $id=(int)($input['id']??0);$text=trim(preg_replace('/\s+/u',' ',(string)($input['body']??'')));
    if (!$id) cl_fail('Choose a tip to reply to');
    if (mb_strlen($text)<2||mb_strlen($text)>140) cl_fail('Replies are 2 to 140 characters',422);
    if (hs_profane($text)||cl_gossip_blocked($text)) cl_fail('Keep it friendly: no swearing or insults',422);
    if (hs_personal($text)) cl_fail('No names, links, @handles or phone numbers',422);
    $post=cl_one('SELECT id,city FROM chinalife_gist_night WHERE id=?','i',[$id]);
    if (!$post||$post['city']!==$city) cl_fail('That gossip is gone',404);
    cl_run('INSERT INTO chinalife_gist_night_replies(post_id,user_id,body,created_at) VALUES(?,?,?,NOW())','iis',[$id,$uid,$text]);
    json_response('success',['posts'=>gist_night_feed($city)],'Reply posted anonymously.');
}
if ($action==='report') {
    // Phase 6 (with the better wall on): one report per player per tip; 3 hide it until an admin looks (appadmin Gossip tab).
    if (!gist_wall_on()) cl_fail('Reports are switched off',403);
    cl_rate('gist_night_report',10,3600);
    $id=(int)($input['id']??0);$post=cl_one('SELECT id,city,official FROM chinalife_gist_night WHERE id=?','i',[$id]);
    if (!$post||$post['city']!==$city) cl_fail('That gossip is gone',404);if ((int)$post['official']===1) cl_fail('Hafrik posts cannot be reported');
    $reason=mb_substr(trim((string)($input['reason']??'player')),0,40)?:'player';
    cl_run('INSERT IGNORE INTO chinalife_gist_night_reports(post_id,user_id,reason,created_at) VALUES(?,?,?,NOW())','iis',[$id,$uid,$reason]);
    $n=(int)cl_one('SELECT COUNT(*) n FROM chinalife_gist_night_reports WHERE post_id=?','i',[$id])['n'];
    cl_run('UPDATE chinalife_gist_night SET reports=?,hidden=IF(?>=3,1,hidden) WHERE id=?','iii',[$n,$n,$id]);
    json_response('success',['posts'=>gist_night_feed($city)],'Thanks. The ChinaLife team will look at it.');
}
if ($action==='vote') {
    cl_rate('gist_night_tap',30,60);
    $poll=(int)($input['poll']??0);$option=$input['option']??null;
    if (!$poll||!is_int($option)) cl_fail('Choose a poll choice');
    $row=cl_one('SELECT p.id,p.options,g.city FROM chinalife_gist_night_polls p JOIN chinalife_gist_night g ON g.id=p.post_id WHERE p.id=?','i',[$poll]);
    if (!$row||$row['city']!==$city) cl_fail('That poll is gone',404);
    $options=json_decode((string)$row['options'],true)?:[];
    if ($option<0||$option>=count($options)) cl_fail('Choose a poll choice');
    if (cl_one('SELECT poll_id FROM chinalife_gist_night_votes WHERE poll_id=? AND user_id=?','ii',[$poll,$uid])) cl_fail('You already voted in this poll',409);
    cl_run('INSERT INTO chinalife_gist_night_votes(poll_id,user_id,option_index,created_at) VALUES(?,?,?,NOW())','iii',[$poll,$uid,$option]);
    json_response('success',['posts'=>gist_night_feed($city)],'Vote recorded.');
}
cl_fail('Choose a gossip action');
