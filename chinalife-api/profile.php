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
$netWorth=max(0,(int)($g['money']??0))+$value;
// Other players only ever see a status badge, never the balance or net worth.
$title=$netWorth>=1000000000?'🏆 Billionaire':($netWorth>=10000000?'👑 Big Laoban':($netWorth>=1000000?'💎 Millionaire':($netWorth>=100000?'💰 Rising Baller':'🌱 Building a life')));$own=$id===$uid;
json_response('success',['profile'=>['id'=>(string)$id,'name'=>$row['name'],'gender'=>in_array($g['gender']??null,['male','female'],true)?$g['gender']:null,'xp'=>(int)($g['xp']??0),'wealth'=>$title,'netWorth'=>$own?$netWorth:null,'homes'=>$homes,'items'=>$items,'badges'=>cl_rank_status($id)['badges']]]);
