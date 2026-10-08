<?php
// Durations and rewards are real-time game settings, independent of client values.
$catalog = [
 'study'=>['title'=>'Study together','place'=>'campus','seconds'=>20,'xp'=>15,'money'=>10,'prompt'=>'Practise a greeting together. How would you say hello?','choices'=>['nihao'=>'你好 · Nǐ hǎo','zaijian'=>'再见 · Zàijiàn']],
 'basketball'=>['title'=>'Campus basketball','place'=>'gym','seconds'=>20,'xp'=>15,'money'=>10,'prompt'=>'Your teammate is open. Choose your next move.','choices'=>['pass'=>'Pass to your teammate','shoot'=>'Take the shot']],
 'meal'=>['title'=>'Share a warm meal','place'=>'african','seconds'=>15,'xp'=>10,'money'=>5,'prompt'=>'Pick your meal and talk about your first week in Shenyang.','choices'=>['mild'=>'Something mild','spicy'=>'Something spicy']]
];
foreach(['girlfriend'=>'Girlfriend request','boyfriend'=>'Boyfriend request'] as $kind=>$title)$catalog[$kind]=['title'=>$title,'place'=>'plaza','seconds'=>0,'xp'=>0,'money'=>0,'proposal'=>true,'prompt'=>'Only accept if you want this relationship. You can end it at any time.','choices'=>[]];
$catalog['date']=['title'=>'Go on a date','place'=>'park','seconds'=>20,'xp'=>0,'money'=>0,'prompt'=>'What would you like to do together?','choices'=>['walk'=>'Walk and talk','sit'=>'Sit and get to know each other']];
foreach(['black-sheep'=>'Black Sheep Restaurant & Bar','tank'=>'Tank'] as $place=>$name)$catalog['dinner-'.$place]=['title'=>'Dinner together · '.$name,'place'=>$place,'seconds'=>20,'xp'=>0,'money'=>0,'prompt'=>'Choose your dinner plan. Order food from the venue menu separately.','choices'=>['chat'=>'Share stories over dinner','relax'=>'Enjoy a relaxed evening']];
foreach(['night'=>'007 Club','youle'=>'Youle Singing & Dancing Club','ex'=>'EX PLAYMALL','rex'=>'REX MUSIC CLUB','orangutan'=>'Orangutan Bunker','taxi-club'=>'Taxi Club','best-one'=>'BEST ONE CLUB','cats-eye'=>"CAT’S EYE",'silver-knight'=>'Silver Knight','blood'=>'BLOOD & EMBERS','skylight'=>'SKYLIGHT'] as $place=>$name)$catalog['club-'.$place]=['title'=>'Club together · '.$name,'place'=>$place,'seconds'=>20,'xp'=>0,'money'=>0,'prompt'=>'Choose how to spend the night together.','choices'=>['dance'=>'Dance together','lounge'=>'Hang out in the lounge']];
return $catalog;
