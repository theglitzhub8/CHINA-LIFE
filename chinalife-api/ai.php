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
 'barista'=>['Coco','café barista','cafe',"You are Coco, a relaxed barista at the café in {city}. You chat about coffee and tea culture in China, good study spots, meeting people and making friends, and you love a bit of gossip about what's happening in the city."],
 'coach'=>['Coach Zhang','fitness coach','gym',"You are Coach Zhang, an upbeat fitness coach at the gym in {city}. You help with workouts, basketball, staying healthy, sleep and energy, in simple practical steps."],
 'stylist'=>['Lily','shopping & style guide','mall',"You are Lily, a fashion-loving shopping guide at the mall in {city}. You help with outfits, the ChinaLife Store, shopping on Taobao and in real malls, sizes in China and staying on budget."],
 'travel'=>['Officer Chen','transport helper','station',"You are Officer Chen, a helpful transport worker at the station in {city}. You explain the metro, high-speed trains, booking tickets with a passport, taxis and DiDi, and how to travel to other cities in the game."],
 'pilot'=>['Captain Ade','travel host','airport',"You are Captain Ade, a cheerful airline captain from Nigeria who flies between Chinese cities. You talk about flights, the other ChinaLife cities and what makes each one special."],
 'student'=>['Daniel','student mentor','campus',"You are Daniel, a final-year international student mentor on campus in {city}. You help with student life: classes, HSK, scholarships, part-time work rules, dorm life, homesickness and making friends."],
 'chef'=>['Mama Ngozi','African kitchen chef','african',"You are Mama Ngozi, a loving Nigerian chef who runs an African kitchen in {city}. You talk about African food in China, where to find ingredients, cooking at home and community."],
 'elder'=>['Grandpa Liu','park storyteller','park',"You are Grandpa Liu, a kind retired teacher who does tai chi in the park every morning in {city}. You share Chinese culture, history, festivals, proverbs and gentle life advice, with a little humour."],
 'concierge'=>['Sophie','hotel concierge','hotel',"You are Sophie, a polished hotel concierge in {city}. You help visitors plan their stay: sights, restaurants, getting around and practical tips for foreigners."],
 'hafrik'=>['Ada','Hafrik HQ concierge','hq',"You are Ada, the concierge at Hafrik HQ in {city}. You explain Hafrik and ChinaLife: making money, ranks, homes, the partners programme for businesses and artists, ads, and Hafrik services."],
];
// Any other public venue has its own AI host (agent "host" with the venue id); their name comes from the venue.
const CL_AI_HOSTS=['Xiao Bao','Mina','Jun','Lulu','Kwame','Yan','Tomi','Hana','Leo','Zara','Bo','Amaka'];
const CL_AI_SCREENS=['phone','food_delivery','store','chinese_course','chinese_class','chinese_practice','word_book','wallet','make_money','jobs','travel_to_another_city','flights','people_nearby','chats','friends','events','city_guide','radio','my_homes','home','driving_school','goals','rank','profile','appearance','news_gist','hafrik_hq','ai_guides','become_a_partner'];
function cl_ai_tools(array $places): array {$now=['type'=>'boolean','description'=>'true only if the player directly asked you to do this now'];return [
 ['name'=>'go_to_place','description'=>'Take the player to a place in their current city in the game.','input_schema'=>['type'=>'object','properties'=>['place_id'=>['type'=>'string','enum'=>$places?:['plaza']],'now'=>$now],'required'=>['place_id']]],
 ['name'=>'open_screen','description'=>'Open a screen of the game for the player (phone, food delivery, store, Chinese course, wallet, ways to make money, travel to another city, people, chats, events, city guide, radio, homes, goals, rank, Hafrik HQ, become a partner, …).','input_schema'=>['type'=>'object','properties'=>['screen'=>['type'=>'string','enum'=>CL_AI_SCREENS],'now'=>$now],'required'=>['screen']]],
 ['name'=>'show_business','description'=>'Show the page of one of the real businesses, artists or creators listed in this city.','input_schema'=>['type'=>'object','properties'=>['name'=>['type'=>'string'],'now'=>$now],'required'=>['name']]],
 ['name'=>'play_song','description'=>'Play a ChinaLife artist\'s song on ChinaLife Radio.','input_schema'=>['type'=>'object','properties'=>['artist'=>['type'=>'string'],'title'=>['type'=>'string'],'now'=>$now]]],
 ['name'=>'claim_daily_reward','description'=>'Claim the player\'s daily reward if it is ready.','input_schema'=>['type'=>'object','properties'=>['now'=>$now]]]];}
function cl_ai_actions(array $blocks, array $places, string $city): array {$tags=[];$auto=null;
 foreach ($blocks as $b){if (($b['type']??'')!=='tool_use'||count($tags)>=4) continue;$in=is_array($b['input']??null)?$b['input']:[];$tag=null;
  switch ($b['name']??''){
   case 'go_to_place': $id=(string)($in['place_id']??'');if (isset($places[$id])) $tag='[[go:'.$id.']]';break;
   case 'open_screen': $sc=(string)($in['screen']??'');if (in_array($sc,CL_AI_SCREENS,true)) $tag='[[open:'.$sc.']]';break;
   case 'show_business': $n=mb_strtolower(trim((string)($in['name']??'')));foreach (cl_restaurants($city) as $r) if ($n!==''&&(mb_strtolower($r['name'])===$n||str_contains(mb_strtolower($r['name']),$n))){$tag='[[biz:'.$r['id'].']]';break;}break;
   case 'play_song': $a=mb_strtolower(trim((string)($in['artist']??'')));$t=mb_strtolower(trim((string)($in['title']??'')));foreach (cl_songs($city) as $sg) if (($a===''||str_contains(mb_strtolower($sg['artist']),$a))&&($t===''||str_contains(mb_strtolower($sg['title']),$t))&&($a!==''||$t!=='')){$tag='[[song:'.$sg['id'].']]';break;}break;
   case 'claim_daily_reward': $tag='[[daily]]';break;}
  if ($tag&&!in_array($tag,$tags,true)){$tags[]=$tag;if ($auto===null&&!empty($in['now'])) $auto=$tag;}}
 return [$tags,$auto];}
$agent=(string)($_GET['agent']??(cl_body_peek()['agent']??''));$hostPlace=(string)($_GET['place']??(cl_body_peek()['place']??''));
function cl_body_peek(): array {static $b=null;if ($b===null){$b=$GLOBALS['method']==='POST'?cl_body(20000):[];}return $b;}
if ($agent==='host') {[,$hostPlace]=cl_room(['city'=>'Shenyang','place'=>$hostPlace]);if (cl_private_place($hostPlace)) cl_fail('Choose a public venue');
    $agentDef=[CL_AI_HOSTS[crc32($hostPlace)%count(CL_AI_HOSTS)],'host',$hostPlace,'You are {name}, the friendly host of {venue} in {city}. You know this place well: what people do here, what to try, and what is nearby. You also help with anything else about life in the city.'];
    $agent='h'.hash('crc32b',$hostPlace);
} elseif (isset(CL_AI_AGENTS[$agent])) $agentDef=CL_AI_AGENTS[$agent];
else cl_fail('Choose a character');
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
[$name,$role,,$persona]=$agentDef;$persona=str_replace(['{name}','{venue}'],[$name,$places[$hostPlace]??($str('place',60)?:'this place')],$persona);
$system=str_replace('{city}',$city,$persona)."\n\n"
 ."You live inside ChinaLife, a life game where players from around the world live in {$city}, China. Talk like a real person in a chat: warm, short (usually under 90 words), simple English unless the player writes in another language.\n"
 ."Rules: keep everything friendly and suitable for all ages. No sexual or romantic roleplay, no hate, no violence, nothing illegal, no political arguments. Never ask for passwords, payment details or personal information. For real-world visas, health, safety or money questions give general tips and say to check official sources. Do not make up businesses: only recommend the real ones listed below, or the game's places.\n"
 ."You can act in the game with your tools: take the player to a place (go_to_place), open a screen (open_screen), show a real business or artist (show_business), play an artist's song on ChinaLife Radio (play_song) or claim their daily reward (claim_daily_reward). Use them whenever they help, and set now=true only when the player directly asks you to do it right now. Always also write a short message. Never spend the player's money yourself: for buying, open the right screen.\n"
 ."Place ids in this city: ".implode(', ',array_map(fn($id,$n)=>$id.'='.$n,array_keys($places),$places)).".\n\n"
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
 CURLOPT_POSTFIELDS=>json_encode(['model'=>(string)($cfg['model']??'claude-sonnet-5-5'),'max_tokens'=>600,'system'=>$system,'messages'=>$clean,'tools'=>cl_ai_tools(array_keys($places))],JSON_UNESCAPED_UNICODE)]);
$raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=curl_error($ch);curl_close($ch);
$res=is_string($raw)?json_decode($raw,true):null;
$blocks=is_array($res['content']??null)?$res['content']:[];$reply=trim(implode('',array_map(fn($b)=>($b['type']??'')==='text'?(string)$b['text']:'',$blocks)));
// Tool calls become action tags in the reply ([[go:market]], [[open:wallet]], …) that the game shows as buttons;
// the first one marked now=true runs straight away. Everything is checked against what really exists.
[$tags,$auto]=cl_ai_actions($blocks,$places,$city);if ($reply===''&&$tags) $reply='On it! 👇';if ($tags) $reply.="\n".implode(' ',$tags);
if ($status!==200||$reply==='') {error_log('ChinaLife AI: HTTP '.$status.' '.$err.' '.mb_substr((string)$raw,0,300));cl_fail($name.' is busy right now. Try again in a moment',502);}
$reply=mb_substr($reply,0,4000);
cl_run('INSERT INTO chinalife_ai_messages(user_id,agent,role,content,created_at) VALUES(?,?,"user",?,NOW()),(?,?,"assistant",?,NOW())','ississ',[$uid,$agent,$message,$uid,$agent,$reply]);
cl_run('DELETE FROM chinalife_ai_messages WHERE user_id=? AND agent=? AND id NOT IN (SELECT id FROM (SELECT id FROM chinalife_ai_messages WHERE user_id=? AND agent=? ORDER BY id DESC LIMIT 60) keep)','isis',[$uid,$agent,$uid,$agent]);
json_response('success',['reply'=>$reply,'auto'=>$auto,'remaining'=>max(0,$limit-$usedToday()),'at'=>(int)(microtime(true)*1000)]);
