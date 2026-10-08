<?php
return [
 'clients'=>[
  ['id'=>'campus-society','name'=>'Campus Culture Society','brief'=>'Create a welcome poster for the next international student meetup.','level'=>1,'skill'=>'Digital','required'=>2,'fee'=>420,'days'=>2],
  ['id'=>'neighbourhood-cafe','name'=>'Neighbourhood Café Collective','brief'=>'Produce a short photo campaign for a neighbourhood café.','level'=>1,'skill'=>'Creativity','required'=>2,'fee'=>560,'days'=>3],
  ['id'=>'student-founders','name'=>'Student Founders Network','brief'=>'Design a launch kit for a student-run project.','level'=>2,'skill'=>'Digital','required'=>3,'fee'=>980,'days'=>2]
 ],
 'styles'=>[
  'quick'=>['label'=>'Quick delivery','minutes'=>120,'energy'=>20,'hunger'=>10,'multiplier'=>0.8,'rating'=>3],
  'balanced'=>['label'=>'Balanced delivery','minutes'=>180,'energy'=>25,'hunger'=>15,'multiplier'=>1,'rating'=>4],
  'polished'=>['label'=>'Polished delivery','minutes'=>240,'energy'=>35,'hunger'=>20,'multiplier'=>1.15,'rating'=>5]
 ],
 'lateMultiplier'=>0.5,'repeatBonus'=>0.1
];
