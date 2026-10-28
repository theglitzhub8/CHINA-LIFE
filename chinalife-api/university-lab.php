<?php
declare(strict_types=1);
// University Years Year 3 laboratory (university.php): the two majors and their Chinese lab content.
// terms: [characters, pinyin, English]; experiments: [title, [[step characters, English], ...] in the right order];
// instructions: [Chinese instruction, pinyin, the right action, [three wrong actions]].
function cl_uni_lab(): array {return [
 'cs'=>['name'=>'Computer Science','icon'=>'💻',
  'terms'=>[['电脑','diànnǎo','computer'],['程序','chéngxù','program'],['网络','wǎngluò','network'],['数据','shùjù','data'],['代码','dàimǎ','code'],['软件','ruǎnjiàn','software'],['硬件','yìngjiàn','hardware'],['键盘','jiànpán','keyboard'],['鼠标','shǔbiāo','mouse'],['屏幕','píngmù','screen'],['密码','mìmǎ','password'],['文件','wénjiàn','file'],['保存','bǎocún','to save'],['运行','yùnxíng','to run (a program)'],['资料','zīliào','information, material']],
  'experiments'=>[['写一个程序 · Write a program',[['打开电脑','Turn on the computer'],['写代码','Write the code'],['保存文件','Save the file'],['运行程序','Run the program']]],
   ['上网查资料 · Look something up online',[['打开电脑','Turn on the computer'],['连上网络','Connect to the network'],['输入密码','Enter the password'],['查找资料','Search for information']]]],
  'instructions'=>[['请保存文件。','qǐng bǎocún wénjiàn','Save the file',['Open the file','Turn off the screen','Run the program']],
   ['请输入密码。','qǐng shūrù mìmǎ','Enter the password',['Turn off the computer','Open the program','Save the file']],
   ['请运行程序。','qǐng yùnxíng chéngxù','Run the program',['Save the program','Turn off the screen','Enter the password']],
   ['请连上网络。','qǐng liánshàng wǎngluò','Connect to the network',['Turn on the screen','Write the code','Save the file']]]],
 'physics'=>['name'=>'Physics','icon'=>'⚛️',
  'terms'=>[['物理','wùlǐ','physics'],['速度','sùdù','speed'],['力','lì','force'],['能量','néngliàng','energy'],['温度','wēndù','temperature'],['重量','zhòngliàng','weight'],['时间','shíjiān','time'],['光','guāng','light'],['电','diàn','electricity'],['实验','shíyàn','experiment'],['测量','cèliáng','to measure'],['加热','jiārè','to heat up'],['记录','jìlù','to record'],['结果','jiéguǒ','result'],['计算','jìsuàn','to calculate']],
  'experiments'=>[['测量水的温度 · Measure the water temperature',[['准备一杯水','Get a cup of water'],['把水加热','Heat the water'],['测量温度','Measure the temperature'],['记录结果','Record the result']]],
   ['测量速度 · Measure speed',[['准备小车','Get the toy car'],['推动小车','Push the car'],['记录时间','Record the time'],['计算速度','Work out the speed']]]],
  'instructions'=>[['请测量温度。','qǐng cèliáng wēndù','Measure the temperature',['Heat the water','Record the time','Turn on the light']],
   ['请记录结果。','qǐng jìlù jiéguǒ','Record the result',['Measure the weight','Push the car','Turn off the light']],
   ['请打开灯。','qǐng dǎkāi dēng','Turn on the light',['Heat the water','Record the time','Measure the speed']],
   ['请把水加热。','qǐng bǎ shuǐ jiārè','Heat the water',['Measure the water','Record the result','Push the car']]]]];}
