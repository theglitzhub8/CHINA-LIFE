<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
cl_methods(['GET','POST']);

function gist_handle(int $userId, string $city): string {
    return 'night-'.substr(hash('sha256', $userId.'|'.$city.'|gist-night'), 0, 6);
}
function gist_night_feed(string $city): array {
    global $uid;
    $admin=cl_is_admin();
    $posts=cl_rows('SELECT id,user_id,body,official,UNIX_TIMESTAMP(created_at)*1000 at FROM chinalife_gist_night WHERE city=? ORDER BY id DESC LIMIT 40','s',[$city]);
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
    $out=[];
    foreach ($posts as $post) {
        $official=(int)$post['official']===1;
        $item=['id'=>(string)$post['id'],'tag'=>$official?'Hafrik':'Anonymous tip','official'=>$official,'own'=>(int)$post['user_id']===(int)$uid,'body'=>$post['body'],'at'=>(int)$post['at'],'reactions'=>$reactions[$post['id']]??['like'=>0,'fire'=>0,'laugh'=>0],'mine'=>$mine[$post['id']]??null];
        foreach (['like','fire','laugh'] as $kind) $item['reactions'][$kind]=(int)($item['reactions'][$kind]??0);
        // Players only ever see 'Anonymous tip'. Admins can still trace the author.
        if ($admin) {$item['user_id']=(string)$post['user_id'];$item['handle']=gist_handle((int)$post['user_id'],$city);}
        if (isset($polls[$post['id']])) {
            $poll=$polls[$post['id']];$options=json_decode((string)$poll['options'],true)?:[];
            $item['poll']=['id'=>(string)$poll['id'],'question'=>$poll['question'],'voted'=>array_key_exists($poll['id'],$voted)?$voted[$poll['id']]:null,'options'=>[]];
            foreach (array_values($options) as $i=>$text) $item['poll']['options'][]=['text'=>$text,'votes'=>(int)($counts[$poll['id']][$i]??0)];
        }
        $out[]=$item;
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
    if (!in_array($kind,['like','fire','laugh'],true) || !$id) cl_fail('Choose a reaction');
    $post=cl_one('SELECT id,city FROM chinalife_gist_night WHERE id=?','i',[$id]);
    if (!$post||$post['city']!==$city) cl_fail('That gossip is gone',404);
    $have=cl_one('SELECT kind FROM chinalife_gist_night_reactions WHERE post_id=? AND user_id=?','ii',[$id,$uid]);
    if ($have&&$have['kind']===$kind) cl_run('DELETE FROM chinalife_gist_night_reactions WHERE post_id=? AND user_id=?','ii',[$id,$uid]);
    elseif ($have) cl_run('UPDATE chinalife_gist_night_reactions SET kind=?,created_at=NOW() WHERE post_id=? AND user_id=?','sii',[$kind,$id,$uid]);
    else cl_run('INSERT INTO chinalife_gist_night_reactions(post_id,user_id,kind,created_at) VALUES(?,?,?,NOW())','iis',[$id,$uid,$kind]);
    json_response('success',['posts'=>gist_night_feed($city)],'Reaction saved.');
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
