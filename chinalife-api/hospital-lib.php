<?php
// Hospital Phase 1 (docs/HOSPITAL-PLAN.md, appadmin switch hospital_checkup): the free weekly check-up. The doctor asks
// in simple Chinese and you answer from choices; the words are the ones you'd need at a real hospital in China.
// [id, prompt, pinyin (or ''), right answer, three wrong answers]. Prompts in Chinese ask for the meaning; prompts in
// English ask how you'd say it. Answers stay on the server; the player sees them after marking.
const CL_CHECKUP_QUESTIONS=5, CL_CHECKUP_XP=8, CL_CHECKUP_PERFECT=20;
function cl_checkup_bank(): array {return [
 ['where','你哪儿不舒服？','nǐ nǎr bù shūfu?','Where do you feel unwell?',['Where do you live?','What would you like to eat?','When did you arrive?']],
 ['fever','你发烧吗？','nǐ fāshāo ma?','Do you have a fever?',['Are you hungry?','Are you tired?','Are you a student?']],
 ['head','你头疼吗？','nǐ tóu téng ma?','Do you have a headache?',['Is your phone broken?','Do you like tea?','Are you cold?']],
 ['stomach','你肚子疼吗？','nǐ dùzi téng ma?','Does your stomach hurt?',['Did you sleep well?','Is the food spicy?','Do you have a cough?']],
 ['allergy','你对什么过敏？','nǐ duì shénme guòmǐn?','What are you allergic to?',['What do you study?','What is your name?','What time is it?']],
 ['days','疼了几天了？','téng le jǐ tiān le?','How many days has it hurt?',['How much does it cost?','How old are you?','How many people are here?']],
 ['cough','你咳嗽吗？','nǐ késou ma?','Do you have a cough?',['Do you smoke?','Do you drink beer?','Do you have WeChat?']],
 ['mouth','张开嘴，说“啊”。','zhāngkāi zuǐ, shuō “a”.','Open your mouth and say “ah”.',['Close your eyes and rest.','Sit down and wait.','Take off your coat.']],
 ['dose','一天吃三次，饭后吃。','yì tiān chī sān cì, fàn hòu chī.','Take it three times a day, after meals.',['Eat three meals a day.','Come back in three days.','Don’t eat for three hours.']],
 ['rest','多喝水，多休息。','duō hē shuǐ, duō xiūxi.','Drink lots of water and get plenty of rest.',['Drink less coffee and work more.','Go home and cook.','Walk more and sleep less.']],
 ['register','挂号','guàhào','to register at the hospital desk',['to pay the bill','to make a phone call','to buy medicine']],
 ['emergency','急诊','jízhěn','emergency department',['waiting room','pharmacy','car park']],
 ['say-fever','How do you say “I have a fever”?','','我发烧了',['我饿了','我累了','我过敏']],
 ['say-stomach','How do you say “My stomach hurts”?','','我肚子疼',['我头疼','我很忙','我想家']],
 ['say-allergy','How do you say “I’m allergic to penicillin”?','','我对青霉素过敏',['我喜欢青霉素','我没有青霉素','我要买青霉素']],
 ['say-pharmacy','How do you ask “Where is the pharmacy?”','','药房在哪儿？',['药多少钱？','医生在哪儿？','你吃药了吗？']],
 ['say-doctor','How do you say “I need to see a doctor”?','','我要看医生',['我是医生','我不要药','我想回家']],
 ['say-better','How do you say “I feel better now”?','','我现在好多了',['我现在很饿','我现在不舒服','我现在要走了']],
];}
function cl_checkup_week(): string {return (new DateTime('now',new DateTimeZone('Asia/Shanghai')))->format('o-\WW');}
// A fresh check-up: CL_CHECKUP_QUESTIONS questions with shuffled choices, no answers.
function cl_checkup_paper(): array {
 $bank=cl_checkup_bank();shuffle($bank);
 return array_map(function($q){$o=[$q[3],...$q[4]];shuffle($o);return ['id'=>$q[0],'prompt'=>$q[1],'pinyin'=>$q[2],'options'=>$o];},array_slice($bank,0,CL_CHECKUP_QUESTIONS));
}
// Marks {id: answer}. Exactly CL_CHECKUP_QUESTIONS distinct questions from the bank, or null.
function cl_checkup_mark(array $answers): ?array {
 $bank=[];foreach (cl_checkup_bank() as $q) $bank[$q[0]]=$q;
 if (count($answers)!==CL_CHECKUP_QUESTIONS) return null;
 $right=0;$marked=[];
 foreach ($answers as $id=>$a) {$q=$bank[(string)$id]??null;if (!$q) return null;$ok=(string)$a===$q[3];$right+=$ok?1:0;$marked[]=['id'=>$q[0],'prompt'=>$q[1],'pinyin'=>$q[2],'answer'=>$q[3],'right'=>$ok];}
 return ['right'=>$right,'total'=>CL_CHECKUP_QUESTIONS,'marked'=>$marked,'xp'=>$right*CL_CHECKUP_XP+($right===CL_CHECKUP_QUESTIONS?CL_CHECKUP_PERFECT:0)];
}
// Hospital Phase 2 (switch hospital_pharmacy): medicine you buy at the City Hospital and keep, used from the phone.
// Stock = bought minus used, counted from chinalife_economy_actions (action 'pharmacy', refs 'buy:<id>:…' / 'use:<id>:…').
// id => [price, name, Chinese, pinyin, what it does]. Priced so that a visit (rest free, doctor ¥150) is still worth it.
const CL_PHARMACY_MAX=5, CL_VITAMIN_HOURS=24;
function cl_pharmacy_items(): array {return [
 'painkiller'=>[60,'Painkillers','止痛药','zhǐtòng yào','+20 energy'],
 'ors'=>[40,'Rehydration salts','口服补液盐','kǒufú bǔyè yán','−40 drunk, +5 energy'],
 'vitamins'=>[80,'Vitamins','维生素','wéishēngsù','Needs drop 30% slower for 24 hours'],
 'stomach'=>[90,'Stomach medicine','肠胃药','chángwèi yào','Cures food sickness'],
];}
// Stock per item and when today's vitamins wear off (0 = none).
function cl_pharmacy_stock(int $uid): array {
 $stock=array_fill_keys(array_keys(cl_pharmacy_items()),0);
 foreach (cl_rows('SELECT ref FROM chinalife_economy_actions WHERE user_id=? AND action="pharmacy"','i',[$uid]) as $r) {
  [$op,$id]=array_pad(explode(':',(string)$r['ref']),2,'');if (isset($stock[$id])) $stock[$id]+=$op==='buy'?1:($op==='use'?-1:0);
 }
 $v=cl_one('SELECT UNIX_TIMESTAMP(MAX(created_at)) t FROM chinalife_economy_actions WHERE user_id=? AND action="pharmacy" AND ref LIKE "use:vitamins:%"','i',[$uid]);
 $until=(int)($v['t']??0);$until=$until?$until+CL_VITAMIN_HOURS*3600:0;
 return ['stock'=>array_map(fn($n)=>max(0,$n),$stock),'vitaminsUntil'=>$until>time()?$until:0];
}
