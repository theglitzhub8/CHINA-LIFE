<?php
declare(strict_types=1);
// AI characters in every city, powered by Claude. The API key stays in ai-config.php on the server (never sent to
// players). Each character has its own personality; what they know comes from the player's situation (sent by the
// game), plus the real partner listings and live events read here from the database. Conversations are kept per
// player and character; each player has a daily message limit.
require_once __DIR__.'/common.php';
cl_methods(['GET','POST','DELETE']);
$cfg=is_file(__DIR__.'/ai-config.php')?(require __DIR__.'/ai-config.php'):[];
$enabled=is_array($cfg)&&is_string($cfg['api_key']??null)&&$cfg['api_key']!==''&&$cfg['api_key']!=='YOUR_ANTHROPIC_API_KEY'&&($cfg['enabled']??true)!==false;
$limit=max(1,(int)($cfg['daily_limit']??40));
const CL_AI_AGENTS=[
 'guide'=>['Mei','city guide','plaza',"You are Mei, a cheerful local city guide who grew up in {city}. You help newcomers and students find their way: what to do today, where to go, how things work in China (metro, apps like WeChat and Alipay, SIM cards, culture). You love recommending the real businesses, artists and events listed below."],
 'tutor'=>['Teacher Li','Chinese tutor','ef',"You are Teacher Li, a patient Mandarin teacher at the student centre in {city}. You help players learn practical Chinese. When you teach, write Chinese characters, then pinyin with tone marks, then English, e.g. 你好 (nǐ hǎo) – hello. Match the player's level, give one small thing at a time, ask them to try replying, and gently correct mistakes."],
 'food'=>['Auntie Wang','food & market expert','market',"You are Auntie Wang, a warm, funny street-food and market expert in {city}. You know local dishes, fair prices, how to order and bargain politely in Chinese, and where foreigners can find food from home. Recommend the real restaurants and shops listed below when they fit."],
 'night'=>['DJ Kofi','nightlife host','night',"You are DJ Kofi, a friendly nightlife host and DJ in {city} who came to China from Ghana. You know the clubs, music, events and artists in the game. You keep nights fun and safe: going with friends, getting home, respecting people. You never pressure anyone to drink and you suggest non-alcoholic drinks too."],
];
$agent=(string)($_GET['agent']??(cl_body_peek()['agent']??''));
function cl_body_peek(): array {static $b=null;if ($b===null){$b=$GLOBALS['method']==='POST'?cl_body(20000):[];}return $b;}
if (!isset(CL_AI_AGENTS[$agent])) cl_fail('Choose a character');
$usedToday=fn()=>(int)cl_one("SELECT COUNT(*) n FROM chinalife_ai_messages WHERE user_id=? AND role='user' AND created_at>=CURDATE()",'i',[$uid])['n'];
$history=fn(int $n)=>array_reverse(cl_rows('SELECT role,content,UNIX_TIMESTAMP(created_at)*1000 at FROM chinalife_ai_messages WHERE user_id=? AND agent=? ORDER BY id DESC LIMIT '.$n,'is',[$uid,$agent]));
if ($method==='GET') json_response('success',['enabled'=>$enabled,'messages'=>$enabled?$history(30):[],'remaining'=>max(0,$limit-$usedToday()),'limit'=>$limit]);
if ($method==='DELETE') {cl_run('DELETE FROM chinalife_ai_messages WHERE user_id=? AND agent=?','is',[$uid,$agent]);json_response('success',['cleared'=>true]);}
if (!$enabled) cl_fail('The AI characters are not switched on yet',503);
$input=cl_body_peek();
cl_rate('ai',8,60);
$message=trim((string)($input['message']??''));if ($message===''||mb_strlen($message)>500) cl_fail('Write a message up to 500 characters');
if ($usedToday()>=$limit) cl_fail('You have used today’s '.$limit.' messages with the AI characters. Come back tomorrow',429);
// What the player is doing (from the game; only shapes the conversation) and what is real (from the database).
$c=is_array($input['context']??null)?$input['context']:[];$str=fn($k,$n)=>mb_substr(trim((string)($c[$k]??'')),0,$n);
$city=in_array($c['city']??'',CL_CITIES,true)?$c['city']:'Shenyang';
$places=[];foreach (array_slice(is_array($c['places']??null)?$c['places']:[],0,80) as $p){$id=(string)($p[0]??'');$name=mb_substr((string)($p[1]??''),0,60);if (preg_match('/^[a-z0-9-]{2,30}$/',$id)&&$name!=='') $places[$id]=$name;}
$partners=array_map(fn($r)=>'- '.$r['icon'].' '.$r['name'].' ('.$r['kind'].($r['district']?', '.$r['district']:'').')'.($r['menu']?': '.implode(', ',array_map(fn($m)=>$m[0].' ¥'.$m[1],array_slice($r['menu'],0,3))):''),array_slice(cl_restaurants($city),0,30));
$events=array_map(fn($e)=>'- '.$e['title'].($e['place']?' at '.($places[$e['place']]??$e['place']):' (whole city)'),cl_rows('SELECT title,place FROM chinalife_events WHERE city=? AND starts_at<=NOW() AND ends_at>NOW() ORDER BY id DESC LIMIT 10','s',[$city]));
[$name,$role,,$persona]=CL_AI_AGENTS[$agent];
$system=str_replace('{city}',$city,$persona)."\n\n"
 ."You live inside ChinaLife, a life game where players from around the world live in {$city}, China. Talk like a real person in a chat: warm, short (usually under 90 words), simple English unless the player writes in another language.\n"
 ."Rules: keep everything friendly and suitable for all ages. No sexual or romantic roleplay, no hate, no violence, nothing illegal, no political arguments. Never ask for passwords, payment details or personal information. For real-world visas, health, safety or money questions give general tips and say to check official sources. Do not make up businesses: only recommend the real ones listed below, or the game's places.\n"
 ."To suggest a place the player can go to in the game, add a tag like [[go:market]] after mentioning it, using only these place ids: ".implode(', ',array_map(fn($id,$n)=>$id.'='.$n,array_keys($places),$places)).".\n\n"
 ."Player: ".$str('name',40)." · in ".$city." at ".$str('place',60)." · ".$str('time',20)." China time · money ¥".((int)($c['money']??0))." · ".$str('feeling',60)." · Chinese course unit ".((int)($c['chinese']??0))."\n"
 ."Real businesses, artists and creators in {$city} on ChinaLife:\n".($partners?implode("\n",$partners):'- none listed yet')."\n"
 ."Live events in {$city}:\n".($events?implode("\n",$events):'- none right now');
$messages=array_map(fn($m)=>['role'=>$m['role']==='assistant'?'assistant':'user','content'=>$m['content']],$history(12));
$messages[]=['role'=>'user','content'=>$message];
// The API wants turns to alternate, starting with the user.
$clean=[];foreach ($messages as $m){if ($clean&&end($clean)['role']===$m['role']){$clean[count($clean)-1]['content'].="\n".$m['content'];}else $clean[]=$m;}
while ($clean&&$clean[0]['role']!=='user') array_shift($clean);
$ch=curl_init((string)($cfg['endpoint']??'https://api.anthropic.com/v1/messages'));
curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>40,CURLOPT_CONNECTTIMEOUT=>10,
 CURLOPT_HTTPHEADER=>['content-type: application/json','x-api-key: '.$cfg['api_key'],'anthropic-version: 2023-06-01'],
 CURLOPT_POSTFIELDS=>json_encode(['model'=>(string)($cfg['model']??'claude-sonnet-5-5'),'max_tokens'=>500,'system'=>$system,'messages'=>$clean],JSON_UNESCAPED_UNICODE)]);
$raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
$res=is_string($raw)?json_decode($raw,true):null;
$reply=trim(implode('',array_map(fn($b)=>($b['type']??'')==='text'?(string)$b['text']:'',is_array($res['content']??null)?$res['content']:[])));
if ($status!==200||$reply==='') {error_log('ChinaLife AI: HTTP '.$status.' '.$err.' '.mb_substr((string)$raw,0,300));cl_fail($name.' is busy right now. Try again in a moment',502);}
$reply=mb_substr($reply,0,4000);
cl_run('INSERT INTO chinalife_ai_messages(user_id,agent,role,content,created_at) VALUES(?,?,"user",?,NOW()),(?,?,"assistant",?,NOW())','ississ',[$uid,$agent,$message,$uid,$agent,$reply]);
cl_run('DELETE FROM chinalife_ai_messages WHERE user_id=? AND agent=? AND id NOT IN (SELECT id FROM (SELECT id FROM chinalife_ai_messages WHERE user_id=? AND agent=? ORDER BY id DESC LIMIT 60) keep)','isis',[$uid,$agent,$uid,$agent]);
json_response('success',['reply'=>$reply,'remaining'=>max(0,$limit-$usedToday()),'at'=>(int)(microtime(true)*1000)]);
