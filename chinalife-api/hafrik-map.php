<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET','POST']);
function cl_hafrik_source(string $source): array {
    return match($source) {
        'business'=>['pages','page_id','page_title','page_name','page_description','page_admin','1=1','page_location'],
        'space'=>['groups','group_id','group_title','group_name','group_description','group_admin',"group_privacy != 'secret'",null],
        'event'=>['events','event_id','event_title','event_name','event_description','event_admin',"event_privacy != 'secret' AND event_end_date>=NOW()",'event_location'],
        'course'=>['hafrikx_academy_courses','id','title','id','description',null,'is_active=1',null],
        default=>[],
    };
}
function cl_hafrik_table(string $table): bool {return (bool)cl_one('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?','s',[$table]);}
function cl_hafrik_item(string $source,array $row,string $city,string $near): array {
    $id=(int)$row['id'];
    return ['id'=>'hafrik-'.$source.'-'.$id,'name'=>html_entity_decode($row['title'],ENT_QUOTES|ENT_HTML5,'UTF-8'),'description'=>html_entity_decode((string)$row['description'],ENT_QUOTES|ENT_HTML5,'UTF-8'),
        'kind'=>'service','icon'=>['business'=>'🏢','space'=>'👥','event'=>'🎟️','course'=>'🎓'][$source],'city'=>$city,'near'=>$near,'district'=>'Hafrik','menu'=>[],'photos'=>[],'links'=>[],
        'hafrik'=>['type'=>$source,'id'=>$id],'active'=>true];
}
function cl_hafrik_city(string $location): ?string {
    $names=['Shenyang'=>'沈阳','Guangzhou'=>'广州','Shenzhen'=>'深圳','Beijing'=>'北京','Shanghai'=>'上海','Chengdu'=>'成都','Harbin'=>'哈尔滨'];$found=[];
    foreach($names as $city=>$han)if(preg_match('/\b'.preg_quote($city,'/').'\b/i',$location)||str_contains($location,$han))$found[]=$city;
    return count($found)===1?$found[0]:null;
}
if ($method==='POST') {
    cl_hafrik_require('map');
    $in=cl_body();$source=$in['source']??'';$spec=is_string($source)?cl_hafrik_source($source):[];
    $id=filter_var($in['id']??null,FILTER_VALIDATE_INT);$city=$in['city']??'';$near=$in['near']??'plaza';
    if (!$spec||!$id||$id<1) cl_fail('Choose a Hafrik listing');cl_hafrik_require($source);
    if (!is_string($city)||!in_array($city,cl_open_cities(),true)) cl_fail('Choose an open ChinaLife city');
    if (!is_string($near)||!in_array($near,['plaza','mall','market','park','campus','ef','business'],true)) cl_fail('Choose a public venue');
    [$table,$pk,$title,$slug,$description,$owner,$visible]=$spec;
    if(!cl_hafrik_table($table))cl_fail('Hafrik listing is unavailable',503);
    $row=cl_one("SELECT $pk id".($owner?",$owner owner_id":'')." FROM `$table` WHERE $pk=? AND ($visible)",'i',[$id]);
    if(!$row)cl_fail('Hafrik listing not found',404);
    $canEdit=cl_is_admin()||($owner&&(int)$row['owner_id']===$uid);
    if(!$canEdit&&in_array($source,['business','space'],true)){$admins=$source==='business'?'pages_admins':'groups_admins';if(cl_hafrik_table($admins))$canEdit=(bool)cl_one("SELECT 1 FROM $admins WHERE $pk=? AND user_id=?",'ii',[$id,$uid]);}
    if(!$canEdit)cl_fail('Only the listing owner or an administrator can place this listing',403);
    cl_rate('hafrik_place',20,60);$active=($in['active']??true)?1:0;
    cl_run('INSERT INTO chinalife_hafrik_places(source,source_id,city,near,active,updated_by,updated_at) VALUES(?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE city=VALUES(city),near=VALUES(near),active=VALUES(active),updated_by=VALUES(updated_by),updated_at=NOW()','sissii',[$source,$id,$city,$near,$active,$uid]);
    json_response('success',['city'=>$city,'near'=>$near,'active'=>(bool)$active]);
}
$city=$_GET['city']??'Shenyang';if(!is_string($city)||!in_array($city,cl_open_cities(),true))cl_fail('Choose an open ChinaLife city');
$features=cl_hafrik_features();$items=[];$unavailable=[];if(!$features['map'])json_response('success',['items'=>[],'unavailable'=>[],'city'=>$city,'features'=>$features]);
foreach(['business','space','event','course'] as $source){
    if(!$features[$source])continue;
    [$table,$pk,$title,$slug,$description,$owner,$visible,$location]=cl_hafrik_source($source);
    if(!cl_hafrik_table($table)){$unavailable[]=$source;continue;}
    // Explicit placement overrides inferred addresses, including an explicit hide.
    $rows=cl_rows("SELECT s.$pk id,s.$title title,s.$description description,p.near FROM chinalife_hafrik_places p JOIN `$table` s ON s.$pk=p.source_id WHERE p.source=? AND p.city=? AND p.active=1 AND ($visible) ORDER BY p.source_id LIMIT 100",'ss',[$source,$city]);
    foreach($rows as $r)$items[]=cl_hafrik_item($source,$r,$city,$r['near']);
    if($location){
        $han=['Shenyang'=>'沈阳','Guangzhou'=>'广州','Shenzhen'=>'深圳','Beijing'=>'北京','Shanghai'=>'上海','Chengdu'=>'成都','Harbin'=>'哈尔滨'][$city];
        $rows=cl_rows("SELECT s.$pk id,s.$title title,s.$description description,s.$location location FROM `$table` s LEFT JOIN chinalife_hafrik_places p ON p.source=? AND p.source_id=s.$pk WHERE p.source_id IS NULL AND ($visible) AND (s.$location LIKE ? OR s.$location LIKE ?) ORDER BY s.$pk DESC LIMIT 100",'sss',[$source,'%'.$city.'%','%'.$han.'%']);
        foreach($rows as $r)if(cl_hafrik_city((string)$r['location'])===$city)$items[]=cl_hafrik_item($source,$r,$city,$source==='business'?'mall':'plaza');
    }
}
json_response('success',['items'=>$items,'unavailable'=>$unavailable,'city'=>$city,'features'=>$features]);
