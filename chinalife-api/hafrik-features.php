<?php
declare(strict_types=1);
// ChinaLife controls only; Hafrik's own application remains available.
function cl_hafrik_feature_labels(): array {
 return ['business'=>'Businesses','space'=>'Spaces / Communities','people'=>'Meet People','course'=>'Learning Hub / Academy','event'=>'Hafrik Events','product'=>'Marketplace','exchange'=>'Hafrik Exchange','services'=>'Hafrik Services','map'=>'Hafrik locations on the map','sharing'=>'Share campaigns and milestones on Hafrik','notifications'=>'Send game alerts to the Hafrik inbox and push','legacy_people_nearby'=>'Old People Nearby screen (map pins, on the street, residents, simulated characters, live feed) in one-city Link Up'];
}
function cl_hafrik_features_default_off(): array {return ['legacy_people_nearby'];}
function cl_hafrik_features(): array {
 $defaults=array_fill_keys(array_keys(cl_hafrik_feature_labels()),true);
 // Switches that start OFF. legacy_people_nearby: one-city Link Up replaced the old Nearby screen (Oct 2026); it is kept, not deleted.
 foreach(cl_hafrik_features_default_off() as $key)$defaults[$key]=false;
 $row=cl_one("SELECT value FROM chinalife_settings WHERE name='hafrik_features'");
 $saved=$row?json_decode($row['value'],true):null;
 if(is_array($saved))foreach($defaults as $key=>$value)if(isset($saved[$key])&&is_bool($saved[$key]))$defaults[$key]=$saved[$key];
 return $defaults;
}
function cl_hafrik_require(string $feature): void {
 if(!(cl_hafrik_features()[$feature]??false))cl_fail('This Hafrik feature is currently switched off in ChinaLife',403);
}
