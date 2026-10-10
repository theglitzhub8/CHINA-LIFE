import vm from 'node:vm';
import test from 'node:test';import assert from 'node:assert/strict';import {harness,fixture} from './game-harness.mjs';
test('fresh character creation, name validation, background and isolated defaults',()=>{const h=harness(null);assert(h.document.getElementById('onboarding').open);h.click('nextStep');assert.match(h.document.getElementById('toast').textContent,/begins/);h.document.querySelector('[data-start="inside"]').onclick();h.click('nextStep');h.click('nextStep');assert.match(h.document.getElementById('toast').textContent,/role/);h.document.querySelector('[data-role="Student"]').onclick();h.click('nextStep');h.click('nextStep');assert.match(h.document.getElementById('toast').textContent,/name/);h.document.getElementById('onName').oninput({target:{value:'Adewale'}});h.click('nextStep');assert.equal(h.game.state.name,'Adewale');assert.equal(h.game.state.skills.Study,2);assert.equal(h.game.state.created,true);assert(!h.document.getElementById('onboarding').open);assert(h.writes.length>0)});
test('corrupt saves recover and blocked local storage does not break play',()=>{const corrupt=harness(null,{raw:'{broken'});assert(corrupt.document.getElementById('onboarding').open);assert.match(corrupt.document.getElementById('toast').textContent,/could not be loaded/);const blocked=harness(fixture(),{blockStorage:true});blocked.game.activity('home',0);assert.equal(blocked.game.state.hour,22*60,'the clock is Beijing time, activities do not move it');assert.match(blocked.document.getElementById('toast').textContent,/slept/)});
test('location activities require travel; free actions remain available in debt',()=>{const h=harness();h.game.activity('ef',0);assert.equal(h.game.state.money,3200);h.game.state.place='park';h.game.state.money=-100;h.game.activity('park',0);assert.equal(h.game.state.money,-100);assert.equal(h.game.state.stats.activities,1)});
test('activity durations, affordability and needs bounds',()=>{const h=harness();assert.equal(h.internal.duration('3h · free'),180);assert.equal(h.internal.duration('90m'),90);h.game.state.needs.energy=99;h.game.activity('home',0);assert.equal(h.game.state.needs.energy,100);h.game.state.money=1;const before=h.game.state.hour;h.game.activity('home',1);assert.equal(h.game.state.hour,before)});
test('phone Jobs exposes current shift and eight application controls',()=>{const h=harness({...fixture(),job:'cafe-job'});h.game.phone();h.document.querySelector('[data-phone="jobs"]').onclick();assert(h.document.getElementById('currentJob'));assert.equal(h.document.querySelectorAll('[data-job]').length,8);h.click('currentJob');assert(h.document.getElementById('goWork'))});
test('job prerequisites, next-day start, work location and daily pay limit',()=>{const h=harness();h.internal.jobsDialog();h.document.querySelector('[data-job="designer"]').onclick();assert.equal(h.game.state.job,null);h.document.querySelector('[data-job="cafe-job"]').onclick();assert.equal(h.game.state.jobStart,2);h.internal.workShift('steady');assert.equal(h.game.state.money,3200);h.game.state.place='cafe';h.internal.workShift('steady');assert.equal(h.game.state.money,3200);h.passDays(1);h.game.state.needs.energy=80;h.game.state.needs.hunger=80;h.internal.workShift('focus');assert.equal(h.game.state.money,3384);h.internal.workShift('steady');assert.equal(h.game.state.money,3384)});
test('paid cafe activity cannot bypass a career shift; freelance has daily limit',()=>{const h=harness({...fixture(),place:'cafe'});h.game.activity('cafe',0);assert.equal(h.game.state.money,3200);h.game.activity('cafe',1);assert.equal(h.game.state.money,3285);h.game.activity('cafe',1);assert.equal(h.game.state.money,3285);const restored=h.internal.validateSave(JSON.parse(JSON.stringify(h.game.state)));assert.equal(restored.paidActivities['cafe:1'],1)});
test('travel charges virtual money and exhausted players can return home',()=>{const h=harness();h.game.travel('gym');h.click('metroTravel');assert.equal(h.game.state.place,'gym');assert.equal(h.game.state.money,3196);h.game.state.money=-100;h.game.state.needs.energy=0;h.game.travel('home');h.click('walkTravel');assert.equal(h.game.state.place,'home');assert.equal(h.game.state.money,-100);assert.match(h.document.getElementById('activityContent').textContent,/You fainted/);assert.equal(h.game.state.needs.energy,20)});
test('home operations cannot teleport; pantry prevents hunger deadlock',()=>{const h=harness({...fixture(),place:'gym',money:-100});h.game.home();assert(h.document.getElementById('goHome'));assert(!h.document.getElementById('homeRest'));h.game.state.place='home';h.game.state.needs.hunger=0;h.game.home();h.click('pantryMeal');assert.equal(h.game.state.needs.hunger,35);assert(!h.document.getElementById('pantryMeal'))});
test('furniture charges once, desk trains skills and sleep advances day correctly',()=>{const h=harness();h.game.home();h.click('buy-bed');assert.equal(h.game.state.money,2750);h.click('buy-bed');assert.equal(h.game.state.money,2750);h.click('buy-desk');h.click('homeStudy');assert.equal(h.game.state.skillXP.Study,25);const day=h.game.state.day;h.click('homeRest');assert.equal(h.game.state.day,day,'sleeping restores energy; the day follows the real China date');assert.equal(h.game.state.needs.energy,100);h.passDays(1);assert.equal(h.game.state.day,day+1)});
test('weekly rent is charged once on day rollover, and once only after days away',()=>{const h=harness({...fixture(),day:6,hour:1439});h.passDays(1);assert.equal(h.game.state.day,7);assert.equal(h.game.state.money,2600);h.internal.advance(1);assert.equal(h.game.state.money,2600);h.passDays(20);assert.equal(h.game.state.day,27);assert.equal(h.game.state.money,2000,'a long absence charges one week, not three')});
test('NPC conversation location and daily limits preserve friendship rewards',()=>{const h=harness();assert.equal(h.internal.talkNPC('mei',0),false);h.game.state.place='campus';assert.equal(h.internal.talkNPC('mei',1),true);assert.equal(h.game.state.friends.mei,15);assert.equal(h.game.state.skillXP.Chinese,20);assert.equal(h.internal.talkNPC('mei',2),false);assert.equal(h.game.state.friends.mei,15)});
test('event venue, time, invalid choices and daily cooldown',()=>{const h=harness();assert.equal(h.internal.attendEvent(0),false);h.game.state.place='ef';assert.equal(h.internal.attendEvent(0),false);h.game.state.hour=1080;assert.equal(h.internal.attendEvent(5),false);assert.equal(h.internal.attendEvent(0),true);assert.equal(h.internal.attendEvent(0),false)});
test('quests and dream rewards can only be claimed once',()=>{const h=harness({...fixture(),visited:['home','ef','park','gym','cafe']});assert.equal(h.internal.claimQuest('payday'),false);assert.equal(h.internal.claimQuest('explorer'),true);assert.equal(h.game.state.money,3320);assert.equal(h.internal.claimQuest('explorer'),false);h.game.state.xp=400;h.game.state.upgrades=['bed','desk','kitchen'];assert.equal(h.internal.claimDream(),true);assert.equal(h.internal.claimDream(),false)});
test('studio launch, location, daily orders and expansion requirements',()=>{const h=harness();assert.equal(h.internal.launchBusiness(),false);h.game.state.skills.Network=2;h.game.state.skills.Digital=2;assert.equal(h.internal.launchBusiness(),true);assert.equal(h.internal.launchBusiness(),false);assert.equal(h.internal.fulfilOrder(),false);h.game.state.place='business';assert.equal(h.internal.fulfilOrder(),true);assert.equal(h.internal.fulfilOrder(),false);assert.equal(h.internal.growBusiness(),false)});
test('all thirteen phone apps route to their actual screen',()=>{const h=harness();let cloud=false;h.context.ChinaLifeCloud={open:()=>cloud=true};for(const key of ['jobs','people','skills','goals','events','studio','travel','home','journal','wallet','needs','settings','cloud']){h.game.phone();const b=h.document.querySelector('[data-phone="'+key+'"]');assert(b,key);b.onclick();if(key!=='cloud')assert(h.document.getElementById('activityDialog').open,key);else assert(cloud)} });
test('all appearance controls update the saved character',()=>{const h=harness();h.game.appearance();h.click('hair-cap');assert.equal(h.game.state.appearance.hair,'cap');h.click('skin0');assert.equal(h.game.state.appearance.skin,'#603c2c');h.click('outfit1');assert.equal(h.game.state.color,'#426dba')});
test('save import preserves progress and closes initial setup',()=>{const h=harness(null);h.game.loadSave({...fixture(),name:'Restored'});assert.equal(h.game.state.name,'Restored');assert(!h.document.getElementById('onboarding').open);assert.throws(()=>h.game.loadSave({...fixture(),money:'bad'}));assert.equal(h.game.state.name,'Restored')});

test('homes and the home desk follow the player role',()=>{
 const student=harness({...fixture(),background:'Student'});assert.equal(student.game.locations.find(p=>p[0]==='home')[1],'Your private student home');
 const founder=harness({...fixture(),background:'Entrepreneur',money:50000});assert.equal(founder.game.locations.find(p=>p[0]==='home')[1],'Your city apartment');
 founder.game.shop('properties','villa');assert.match(founder.document.getElementById('activityContent').textContent,/Penthouse villa/);
 founder.game.home();founder.click('buy-desk');founder.click('homeStudy');assert.equal(founder.game.state.skillXP.Network,25);
 const tourist=harness({...fixture(),background:'Tourist'});assert.equal(tourist.game.locations.find(p=>p[0]==='home')[1],'Your hotel room');
});

test('Learn lists every skill with places that teach it, and courses raise new skills',()=>{
 const h=harness({...fixture(),money:5000});h.game.state.background='Worker';h.internal.skillsScreen();const text=h.document.getElementById('activityContent').textContent;
 for(const skill of ['Chinese','Cooking','Music','Digital'])assert.match(text,new RegExp(skill));assert.match(text,/Shenyang Skills Academy/);
 h.document.querySelector('[data-learn="academy"]').onclick();h.game.state.place='academy';h.game.activity('academy',2);assert.equal(h.game.state.skillXP.Cooking,20);
 const saved=harness(JSON.parse(JSON.stringify(h.game.state)));assert.equal(saved.game.state.skillXP.Cooking,20);
});

test('ranks pay once per rank-up and the daily streak grows on consecutive days',()=>{
 const h=harness({...fixture(),xp:150,rankClaimed:0,money:1000});h.game.state.xp=250;h.internal.render();assert.equal(h.game.state.rankClaimed,1);assert.equal(h.game.state.money,1500);h.internal.render();assert.equal(h.game.state.money,1500);
 h.game.state.xp=4000;h.internal.render();assert.equal(h.game.state.rankClaimed,4);assert.equal(h.game.state.money,1500+1000+1500+2000);
 const yesterday=new Date(Date.now()+8*3600e3-864e5).toISOString().slice(0,10),d=harness({...fixture(),lastVisit:yesterday,streak:3,money:0,rankClaimed:6});
 d.game.claimDaily();assert.equal(d.game.state.streak,4);assert.equal(d.game.state.money,200);d.game.claimDaily();assert.equal(d.game.state.money,200);
 const restored=harness(JSON.parse(JSON.stringify(d.game.state)));assert.equal(restored.game.state.streak,4);assert.equal(restored.game.state.lastVisit,new Date(Date.now()+8*3600e3).toISOString().slice(0,10),'the Beijing date');
 const old=harness({...fixture(),xp:5000});assert.equal(old.game.state.rankClaimed,4);
});

test('fainting, asking for food helps once a day, and gigs pay once a day',()=>{
 const h=harness({...fixture(),money:0});const hour=h.game.state.hour;h.game.state.needs.hunger=0;h.internal.render();
 assert.match(h.document.getElementById('activityContent').textContent,/You fainted/);
 h.click('faintAsk');assert.equal(h.game.state.needs.hunger,40);h.game.state.needs.hunger=0;h.internal.render();h.click('faintAsk');assert.equal(h.game.state.needs.hunger,0);
 h.game.state.money=100;h.click('faintBuy');assert.match(h.document.getElementById('activityContent').textContent,/Order food/);assert.ok(h.document.getElementById('shop-black-sheep'),'every restaurant in the city is listed');h.click('shop-market');const [,price,dish]=h.game.menus.market[0],hungry=h.game.state.needs.hunger;h.click('deliver-0');assert.equal(h.game.state.money,100-price-8);assert.ok(h.game.state.needs.hunger>=hungry+dish-2,'a fainted player gets the food straight away');h.game.state.money=0;
 h.game.state.needs.hunger=60;h.game.state.needs.energy=80;h.game.earn();h.click('gig-tutor');assert.equal(h.game.state.money,80);h.click('gig-tutor');assert.equal(h.game.state.money,80);
 const saved=harness(JSON.parse(JSON.stringify(h.game.state)));assert.equal(saved.game.state.gigs.tutor,h.game.state.day);
});
test('unaffordable activities open Make money and Today lists what is due',()=>{
 const h=harness({...fixture(),money:5,place:'mall'});h.game.activity('mall',0);assert.match(h.document.getElementById('activityContent').textContent,/Make money/);
 const tasks=h.game.todayTasks().map(t=>t[1]).join(' | ');assert.match(tasks,/Low on money/);assert.match(tasks,/Rent/);h.game.tasks();assert.match(h.document.getElementById('activityContent').textContent,/Today/);
});

test('a ready daily reward shows a notification banner that opens Rank',()=>{
 const h=harness({...fixture(),lastVisit:'2000-01-01'});h.internal.render();for(const fn of [...h.timers])if(typeof fn==='function')fn();const banner=h.document.getElementById('gameNotification');assert.ok(banner,'banner');assert.match(banner.textContent,/daily reward/);banner.onclick();assert.match(h.document.getElementById('activityContent').textContent,/Claim daily reward/);
});

test('dice pays double on a win, returns ties and allows ten rolls a day',()=>{
 const h=harness({...fixture(),money:10000,rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),M=vm.runInContext('Math',h.context),real=M.random;let seq=[.99,.99,0,0],n=0;M.random=()=>seq[n++%4];
 h.game.dice();h.click('dice-1000');assert.equal(h.game.state.money,11000);seq=[0,0,.99,.99];n=0;h.click('dice-1000');assert.equal(h.game.state.money,10000);
 seq=[.5,.5,.5,.5];n=0;h.click('dice-200');assert.equal(h.game.state.money,10000);
 for(let i=0;i<12;i++)h.click('dice-50');assert.equal(h.game.state.dice.count,10);M.random=real;
});

test('food menus charge and feed at the venue, clubs keep night hours, and skills earn certificates',()=>{
 const h=harness({...fixture(),money:1000,place:'african',secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender'],rankClaimed:6});h.game.state.needs.hunger=20;h.game.menu('african');h.click('menu-0');assert.equal(h.game.state.money,955);assert.equal(h.game.state.needs.hunger,75);
 h.game.state.place='blood';h.game.state.hour=10*60;const money=h.game.state.money;h.game.activity('blood',0);assert.equal(h.game.state.money,money);assert.match(h.document.getElementById('activityContent').textContent,/Pay entry/,'open all day; entry is still required');
 h.game.state.hour=22*60;h.game.state.needs.energy=90;h.game.state.clubPass={blood:h.game.state.day};h.game.activity('blood',1);assert.equal(h.game.state.money,money-60);
 const m=h.game.state.money;h.game.state.skills.Chinese=3;h.internal.render();assert.deepEqual([...h.game.state.certs],['hsk1','hsk2']);assert.equal(h.game.state.money,m+1300);h.internal.render();assert.equal(h.game.state.money,m+1300);
 assert.ok(h.game.locations.some(p=>p[0]==='palace'));assert.ok(h.game.locations.some(p=>p[0]==='zhongjie'));
});
test('studio launch and expansion explain blocked actions inside the open panel',()=>{const t=harness();t.game.business();t.click('businessLaunch');assert.match(t.document.getElementById('businessStatus').textContent,/Network and Digital/);assert.equal(t.game.state.business,null);t.game.state.skills.Network=2;t.game.state.skills.Digital=2;t.game.state.money=100;t.click('businessLaunch');assert.match(t.document.getElementById('businessStatus').textContent,/¥900/);t.game.state.money=3200;t.click('businessLaunch');assert.equal(t.game.state.business.level,1);assert.match(t.document.getElementById('businessStatus').textContent,/studio is open/);assert.ok(t.document.getElementById('businessOrder'));t.click('businessExpand');assert.match(t.document.getElementById('businessStatus').textContent,/3 orders/);t.click('businessOrder');assert.match(t.document.getElementById('businessStatus').textContent,/Go to/)});

// Answers whichever course question is on screen (right=false picks a wrong option).
function answerCourse(h,right=true){const C=h.context.ChinaLifeChinese,doc=h.document,lead=doc.querySelector('#activityContent .lead').textContent;
 if(doc.getElementById('sentenceCheck')){const unit=C.units.find(u=>lead.includes(u.sentence[2]));for(const t of right?unit.sentence[3]:[...unit.sentence[3]].reverse())[...doc.querySelectorAll('[data-token]')].find(b=>b.textContent===t&&!b.disabled).onclick();doc.getElementById('sentenceCheck').onclick();return}
 const w=C.allWords.find(w=>lead.includes('What does '+w.han+' (')||lead.includes('“'+w.en+'”')||lead==='How do you say '+w.han+'?'),answer=lead.startsWith('What does')?w.en:lead.startsWith('How do you write')?w.han:w.pin;
 const opts=[...doc.querySelectorAll('[id^="quizOpt"]')],btn=opts.find(b=>(b.textContent.trim()===answer)===right);btn.onclick()}
test('Chinese class teaches five words and a sentence, quizzes them in different ways and moves to the next unit',()=>{
 const h=harness({...fixture(),place:'campus',secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender'],rankClaimed:6});
 assert.ok(h.game.isClassroom('campus'));h.game.classroom();const text=h.document.getElementById('activityContent').textContent;assert.match(text,/你好/);assert.match(text,/对不起/);assert.match(text,/Hello, thank you!/);
 const xp=h.game.state.xp;h.click('quizStart');for(let q=0;q<5;q++)answerCourse(h);
 assert.equal(h.game.state.classCount,1);assert.equal(h.game.state.classStreak,1);assert.equal(h.game.state.xp,xp+5+15+10);assert.equal(h.game.state.skillXP.Chinese,30);
 assert.equal(Object.keys(h.game.state.chinese.words).length,5,'all five words are in the review schedule');
 h.game.classroom();assert.match(h.document.getElementById('activityContent').textContent,/already had class/);assert.equal(h.document.getElementById('quizStart'),null);
 assert.equal(h.game.currentLesson()[0],'About me');const saved=harness(JSON.parse(JSON.stringify(h.game.state)));assert.equal(saved.game.state.classCount,1);assert.equal(saved.game.state.chinese.unit,1);
});
test('failing a Chinese class repeats the unit tomorrow, and missed words come back for review',()=>{
 const h=harness({...fixture(),place:'campus'});h.game.classroom();h.click('quizStart');for(let q=0;q<5;q++)answerCourse(h,false);
 const c=h.game.state.chinese;assert.equal(c.unit,0,'same unit again');assert.ok(Object.values(c.words).every(e=>e[1]<=h.game.state.day+1));
 h.game.state.day+=1;const C=h.context.ChinaLifeChinese;assert.ok(C.due(c,h.game.state.day).length>=4,'missed words are due tomorrow');
 h.game.practiceChinese();h.click('pStart');const before=h.game.state.xp;for(let q=0;q<6&&h.document.querySelector('[id^="quizOpt"],#sentenceCheck');q++)answerCourse(h);assert.ok(h.game.state.xp>before,'practice gives a little XP');
});
test('Chinese course saves are validated and every unit has five words and a sentence made of its tokens',()=>{
 const h=harness({...fixture(),chinese:{unit:3,lessons:4,words:{'你好':[2,9,3,1],'fake':[1,1,1,1],'谢谢':[99,-4,1,1]}}});const c=h.game.state.chinese;assert.equal(c.unit,3);assert.deepEqual(Object.keys(c.words).sort(),['你好','谢谢'].sort());assert.equal(c.words['谢谢'][0],5);assert.equal(c.words['谢谢'][1],0);
 const C=h.context.ChinaLifeChinese;assert.equal(C.units.length,30);for(const u of C.units){assert.equal(u.words.length,5,u.title);assert.equal(u.sentence[3].join(''),u.sentence[0].replace(/[，。！？,.!?]/g,''),u.title)}
 assert.equal(new Set(C.allWords.map(w=>w.han)).size,C.allWords.length,'no word is taught twice');
});

test('settings has separate music and voice volume sliders',()=>{
 const h=harness();let music=null,voice=null;h.context.ChinaLifeAudio={volume:.3,setVolume:v=>music=v};h.context.ChinaLifeVoice={prefs:{volume:80},setVolume:v=>voice=v};
 h.game.phone();h.document.querySelector('[data-phone="settings"]').onclick();
 const m=h.document.getElementById('musicVolume'),v=h.document.getElementById('voiceVolumeSetting');assert.equal(m.getAttribute('value'),'30');assert.equal(v.getAttribute('value'),'80');
 m.oninput({target:{value:'60'}});v.oninput({target:{value:'40'}});assert.equal(music,.6);assert.equal(voice,40);
});

test('clubs charge entry each night and unlock VIP, private rooms and the exclusive lounge',()=>{
 const h=harness({...fixture(),money:10000,place:'night',hour:22*60,rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),g=h.game,day=g.state.day,dialog=h.document.getElementById('activityDialog');g.state.hour=22*60;g.state.needs.energy=90;
 g.activity('night',0);assert.match(h.document.getElementById('activityContent').textContent,/Pay entry/);assert.equal(g.state.money,10000);
 h.click('clubEntry');assert.equal(g.state.money,9940);assert.equal(g.state.clubPass.night,day);assert.equal(dialog.open,false,'window closes after buying');
 g.clubAccess('night');assert.equal(h.document.getElementById('vipTable'),null);assert.equal(h.document.getElementById('exShow'),null,'exclusive needs Insider rank or membership');
 h.click('vipNight');assert.equal(g.state.money,9440);assert.equal(dialog.open,false);g.clubAccess('night');h.click('vipTable');assert.equal(g.state.money,8640);assert.equal(dialog.open,false,'window closes after a VIP activity');
 g.clubAccess('night');h.click('roomBook');assert.equal(g.state.privateRoom.id,'night');g.clubAccess('night');assert.ok(h.document.getElementById('roomParty'));
 // After midnight tonight's passes still work until 6am. The next evening they have expired.
 h.passMinutes(150);assert.ok(g.state.hour<6*60&&g.state.day===day+1);assert.ok(h.document.getElementById('roomParty'),'still tonight after midnight');
 h.passMinutes(21*60-30);g.clubAccess('night');assert.equal(h.document.getElementById('roomParty'),null);
 const now=g.state.day;h.click('vipMember');assert.equal(g.state.vipUntil,now+30);g.clubAccess('night');assert.ok(h.document.getElementById('exShow'));
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.equal(saved.game.state.vipUntil,now+30);assert.equal(saved.game.state.clubPass.night,now);
 g.state.hour=10*60;assert.equal(g.clubOpen('night'),true,'clubs are open all day for now');g.clubAccess('night');assert.doesNotMatch(h.document.getElementById('activityContent').textContent,/Closed/);
});

test('drinks raise the drunk meter, water and time lower it, and 100% blacks out at home',()=>{
 const h=harness({...fixture(),money:5000,place:'night',rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),g=h.game;g.state.hour=22*60;g.state.needs.energy=95;g.state.clubPass={night:g.state.day};
 g.bar('night');h.click('bar-0');assert.equal(Math.round(g.state.drunk),18,'a cocktail adds 18');assert.equal(g.drunkInfo().label,'Sober');
 g.bar('night');h.click('bar-0');g.bar('night');h.click('bar-1');assert.equal(g.drunkInfo().label,'Tipsy');
 g.bar('night');h.click('bar-2');const before=g.state.drunk;g.bar('night');h.click('bar-3');assert.ok(g.state.drunk<before-9,'water sobers you up');
 g.state.drunk=100;h.internal.render();assert.match(h.document.getElementById('activityContent').textContent,/blacked out/);assert.equal(g.state.place,'home');assert.equal(g.state.drunk,30);
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.equal(saved.game.state.drunk,30);
});

test('club security refuses very drunk guests, warns once, then throws them out for the night',()=>{
 const h=harness({...fixture(),money:5000,place:'night',rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),g=h.game;g.state.hour=22*60;g.state.needs.energy=95;
 g.state.drunk=85;assert.equal(g.securityCheck('night'),false);assert.match(h.document.getElementById('activityContent').textContent,/Not tonight/);
 g.state.clubPass={night:g.state.day};assert.equal(g.securityCheck('night'),false);assert.match(h.document.getElementById('activityContent').textContent,/warning/);
 h.click('secWater');assert.equal(g.state.drunk,75);assert.equal(g.securityCheck('night'),true);
 g.state.drunk=90;assert.equal(g.securityCheck('night'),false);assert.match(h.document.getElementById('activityContent').textContent,/Thrown out/);
 assert.equal(g.state.place,'plaza');assert.equal(g.reputation(),45);assert.equal(g.state.clubPass.night,undefined);
 g.state.drunk=0;assert.equal(g.securityCheck('night'),false,'banned for the rest of the night');
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.equal(saved.game.reputation(),45);assert.equal(saved.game.securityCheck('night'),false);
 g.state.day++;assert.equal(g.securityCheck('night'),true,'welcome back tomorrow');
});

test('a club fight gets a security warning first, then police fines, detention and reputation loss',()=>{
 const h=harness({...fixture(),money:5000,place:'night',rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),g=h.game;g.state.hour=22*60;g.state.needs.energy=95;g.state.clubPass={night:g.state.day};
 g.state.drunk=40;g.bar('night');assert.ok(h.document.getElementById('barTrouble'),'trouble finds you after a few drinks');h.click('barTrouble');
 h.click('fightWalk');assert.equal(g.reputation(),51,'walking away is rewarded');
 g.trouble('night');h.click('fightPunch');assert.match(h.document.getElementById('activityContent').textContent,/Removed by security/);assert.equal(g.state.place,'plaza');assert.equal(g.reputation(),46);assert.equal(g.state.money,5000,'no fine for a first warning');
 g.state.place='blood';g.state.clubPass={blood:g.state.day};g.state.hour=19*60;const hour=g.state.hour;g.trouble('blood');h.click('fightPunch');
 assert.match(h.document.getElementById('activityContent').textContent,/Police detained you/);assert.equal(g.state.money,4500);assert.equal(g.reputation(),36);assert.equal(g.policeRecord().length,2);assert.ok(g.state.needs.fun<=80&&g.state.needs.energy<=80,'detention drains you');
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.equal(saved.game.policeRecord().length,2);assert.equal(saved.game.reputation(),36);
 g.state.record=[{day:g.state.day,place:'blood',type:'fight',fined:500}];g.state.place='skylight';g.state.clubPass={skylight:g.state.day};g.state.money=200;g.trouble('skylight');h.click('fightPunch');assert.equal(g.state.money,0,'takes what you have');assert.match(h.document.getElementById('activityContent').textContent,/a longer night/);
 g.state.reputation=10;g.state.clubPass={};g.state.clubBan={};assert.equal(g.securityCheck('night'),false,'a bad reputation keeps you out');
});

test('admin-configured ranks rename the ladder and a suspension pauses rank rewards and perks',()=>{
 const h=harness({...fixture(),money:1000,xp:0,rankClaimed:0}),g=h.game;
 g.setRanks([{xp:0,name:'Fresh',icon:'🌱',reward:0},{xp:100,name:'Known',icon:'⭐',reward:250},{xp:300,name:'Boss',icon:'👑',reward:2000}]);
 assert.deepEqual([...g.rankLadder().map(r=>r[1])],['Fresh','Known','Boss']);
 g.setRanks([{xp:5,name:'Broken',icon:'x',reward:0}]);assert.equal(g.rankLadder().length,3,'invalid ladders are ignored');
 g.setRankStatus({badges:[{id:'1',icon:'🏮',name:'Lantern Festival'}],rankSuspendedUntil:Date.now()+86400000,rankSuspendedReason:'Exploit'});
 g.state.xp=150;h.internal.render();assert.equal(g.state.money,1000,'no rank reward while suspended');
 g.ranks();const text=h.document.getElementById('activityContent').textContent;assert.match(text,/paused/);assert.match(text,/Lantern Festival/);
 g.setRankStatus({badges:[],rankSuspendedUntil:null});h.internal.render();assert.equal(g.state.money,1250,'the configured reward is paid');
});

test('club jobs pay one gig a night, check skills, and club owners collect daily takings with free entry',()=>{
 const h=harness({...fixture(),money:900000,place:'night',rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),g=h.game;g.state.hour=22*60;g.state.needs.energy=95;
 g.clubJobs('night');h.click('gig-dj');assert.equal(g.state.money,900000,'DJ needs Music 3');
 h.click('gig-promoter');assert.equal(g.state.money,900180);assert.equal(g.state.clubGig.id,'promoter');
 g.clubJobs('night');h.click('gig-bartender');assert.equal(g.state.money,900180,'one gig a night');
 g.clubJobs('night');h.click('clubBuy');assert.ok(g.ownsClub('night'));assert.equal(g.state.money,100180);
 g.clubJobs('night');h.click('clubTakings');assert.equal(g.state.money,100180+4000+50*60);g.clubJobs('night');h.click('clubTakings');assert.equal(g.state.money,107180,'once a day');
 g.state.clubPass={};assert.equal(g.securityCheck('night'),true);g.bar('night');assert.ok(h.document.getElementById('bar-0'),'owners walk straight in');
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.ok(saved.game.ownsClub('night'));assert.equal(saved.game.state.clubGig.id,'promoter');
});

test('dance competitions score copied beats plus style, pay prizes once a night and count toward night missions',()=>{
 const h=harness({...fixture(),money:1000,place:'night',rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),g=h.game;g.state.hour=22*60;g.state.needs.energy=95;
 g.dance('night');assert.match(h.document.getElementById('activityContent').textContent,/Entry/);
 g.clubAccess('night');h.click('clubEntry');g.dance('night');h.click('danceStart');assert.equal(g.state.money,1000-60-50);
 const moves=['Left step','Right step','Jump','Spin'];for(let n=0;n<5;n++){const text=h.document.getElementById('activityContent').textContent,after=text.split('calls: ')[1],call=moves.map((m,i)=>[after.indexOf(m),i]).filter(x=>x[0]>=0).sort((a,b)=>a[0]-b[0])[0][1];h.click('move-'+call)}
 assert.match(h.document.getElementById('activityContent').textContent,/5\/5 beats/);assert.equal(g.state.danceComp.place,1);assert.equal(g.state.money,890+600);
 g.dance('night');assert.equal(g.state.money,1490,'one entry a night');
 g.bar('night');h.click('bar-3');g.missions();assert.match(h.document.getElementById('activityContent').textContent,/3\/5 done/);
 g.clubJobs('night');h.click('gig-promoter');const before=g.state.money;g.activity('night',0);
 assert.equal(g.state.nightMission.paid,true);assert.equal(g.state.money,before-35+500,'all five missions pay the bonus');
});

test('the arcade sells tokens for money but tickets only buy prizes',()=>{
 const h=harness({...fixture(),money:1000,place:'mall'}),g=h.game;
 g.arcade();h.click('arcadeWheel');assert.equal(g.state.arcade.tokens,0);
 h.click('arcadeTokens');assert.equal(g.state.money,900);assert.equal(g.state.arcade.tokens,5);
 for(let i=0;i<5;i++)h.click('arcadeHoops');assert.equal(g.state.arcade.tokens,0);assert.ok(g.state.arcade.tickets>=35);
 g.state.arcade.tickets=150;g.arcade();h.click('prize-plush');assert.deepEqual([...g.state.arcade.prizes],['plush']);assert.equal(g.state.arcade.tickets,50);assert.equal(g.state.money,900,'tickets never become money');
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.equal(saved.game.state.arcade.tickets,50);
});

test('food delivery lists every city restaurant, a rider takes time to arrive and the food is collected at home',()=>{
 const h=harness({...fixture(),money:500,place:'home'}),g=h.game;g.state.needs.hunger=20;
 g.delivery();for(const id of ['black-sheep','tank','african','market','cafe'])assert.ok(h.document.getElementById('shop-'+id),id+' delivers');
 h.click('shop-tank');const [,price,dish]=g.menus.tank[0];h.click('deliver-0');assert.equal(g.state.money,500-price-8);assert.equal(g.state.needs.hunger,20,'nothing to eat until the rider arrives');
 const order=g.pendingDeliveries()[0];assert.equal(order.from,'tank');assert.equal(order.arrived,false);g.collectFood(order.id);assert.equal(g.state.foodOrders[0].received,false);
 g.state.foodOrders[0].eta=h.context.Date.now()-1;g.state.place='plaza';g.collectFood(order.id);assert.equal(g.state.foodOrders[0].received,false,'collect it at home');
 g.state.place='home';g.collectFood(order.id);assert.equal(g.state.foodOrders[0].received,true);assert.ok(g.state.needs.hunger>=20+dish-2);
 g.home();for(const id of ['homeRest','homeNap','homeShower','homeToilet','homeOrder','homeNoodles','homeNetflix','homeShop'])assert.ok(h.document.getElementById(id),id);
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.equal(saved.game.state.foodOrders[0].from,'tank');
});

test('the VIP flow: members get in everywhere, perks run once a night, passes need you at the club and past security',()=>{
 const h=harness({...fixture(),money:20000,place:'night',rankClaimed:6,secrets:['night-owl','foodie','scholar','jet-setter','treasure-hunter','big-spender']}),g=h.game;g.state.hour=14*60;g.state.needs.energy=95;
 g.clubAccess('night');h.click('vipMember');assert.equal(g.state.money,17000);assert.equal(h.document.getElementById('activityDialog').open,false,'window closes after buying');
 g.state.place='blood';g.clubAccess('blood');assert.match(h.document.getElementById('activityContent').textContent,/free entry and VIP at every club/);assert.equal(h.document.getElementById('clubEntry'),null,'members never pay entry');
 h.click('vipDj');const xp=g.state.xp;g.clubAccess('blood');assert.match(h.document.getElementById('activityContent').textContent,/Done tonight/);h.click('vipDj');assert.equal(g.state.xp,xp,'free perks run once a night');
 h.click('exShow');assert.equal(g.state.money,16800,'members reach the exclusive lounge');
 g.state.place='plaza';g.clubAccess('skylight');h.click('roomBook');assert.equal(g.state.money,16800,'buy passes at the club itself');
 g.state.place='skylight';g.state.clubBan={skylight:g.state.day};h.click('roomBook');assert.equal(g.state.money,16800,'banned players cannot buy');
 const saved=harness(JSON.parse(JSON.stringify(g.state)));assert.ok(Object.keys(saved.game.state.clubPerks).includes('blood:DJ lounge'));
});

test('Hafrik HQ is a venue in every city and partner restaurants open their real order links',()=>{
 const h=harness({...fixture(),money:500,place:'home'}),g=h.game;
 for(const city of ['Shenyang','Guangzhou']){g.state.city=city;assert.ok(g.locations.some(p=>p[0]==='hq'),'HQ in '+city)}
 g.state.city='Shenyang';g.setPartnerRestaurants([{id:'1',name:'Lanzhou Noodle House',icon:'🍜',district:'Heping',menu:[['Beef noodles',28]],order_link:'https://u.wechat.com/abc',wechat_id:'noodle_house88',whatsapp:'8618940147438'}]);
 g.delivery();assert.match(h.document.getElementById('activityContent').textContent,/Order for real/);h.click('partner-0');
 const links=[...h.document.querySelectorAll('#activityContent a.external-app')].map(a=>a.getAttribute('href'));assert.ok(links.includes('https://u.wechat.com/abc'));assert.ok(links.some(u=>u.startsWith('https://wa.me/8618940147438')));
 assert.match(h.document.getElementById('activityContent').textContent,/Beef noodles¥28/);assert.ok(h.document.getElementById('partnerWechat'));assert.equal(g.state.money,500,'real orders never touch game money');
});

test('the store sells clothes you wear, cars you drive, and saves only real catalogue items',()=>{
 const h=harness({...fixture(),money:2000000,place:'plaza'}),g=h.game;
 assert.equal(g.state.wardrobe.wearing.top,'tee-basic','everyone starts with a basic outfit');
 g.store('clothes','hoodie');h.click('storeBuy');assert.equal(g.state.money,2000000-320);assert.equal(g.state.wardrobe.wearing.top,'hoodie');assert.equal(g.playerLook().top.s,'hoodie');
 g.store('accessories','sunglasses');h.click('storeBuy');assert.deepEqual([...g.playerLook().acc],['sunglasses']);h.click('storeRemove');assert.equal(g.playerLook().acc.length,0);
 g.store('clothes','tee-basic');h.click('storeWear');assert.equal(g.state.wardrobe.wearing.top,'tee-basic');
 g.store('cars','scooter');h.click('storeBuy');assert.equal(g.activeCar().id,'scooter','scooters need no licence');
 g.store('cars','sports');h.click('storeBuy');assert.ok(g.state.garage.owned.includes('sports'));assert.equal(g.activeCar().id,'scooter','a licence is needed before the sports car can be driven');
 g.travel('market');assert.ok(h.document.getElementById('carTravel'),'your vehicle is a travel option');
 const saved=harness({...JSON.parse(JSON.stringify(g.state)),wardrobe:{owned:['hoodie','fake-item'],wearing:{top:'fake-item'}},garage:{owned:['spaceship','scooter'],active:'spaceship'}});
 assert.ok(!saved.game.state.wardrobe.owned.includes('fake-item'));assert.equal(saved.game.state.wardrobe.wearing.top,'tee-basic');assert.deepEqual([...saved.game.state.garage.owned],['scooter']);assert.equal(saved.game.state.garage.active,'scooter');
 const old=harness({...fixture(),driving:{lessons:3,licensed:true,car:'sedan'}});assert.ok(old.game.state.garage.owned.includes('sedan'),'an old sedan moves into the garage');
});
test('approved partners: restaurants are in food delivery, shops and services in the City guide with their photos and prices',()=>{const h=harness({...fixture(),place:'home'});h.context.ChinaLifeAuth={base:'https://hafrik.com/api/v4'};
 h.game.setPartnerRestaurants([{id:'1',kind:'restaurant',name:'Mama Put Kitchen',icon:'🍲',menu:[['Jollof rice',35,'aaaaaaaaaaaaaaaaaaaaaaaa','Party style']],photos:[],wechat_id:'mamaput_sy'},{id:'2',kind:'shop',name:'Africa Mart',icon:'🛒',district:'Sanhao',menu:[['Garri 1kg',25,'','']],photos:['bbbbbbbbbbbbbbbbbbbbbbbb'],whatsapp:'8618900000000'},{id:'3',kind:'service',name:'Visa Helper',icon:'🧰',menu:[['Visa extension help',300,'','']],photos:[]}]);
 h.game.delivery();const food=h.document.getElementById('activityContent').textContent;assert.match(food,/Mama Put Kitchen/);assert.doesNotMatch(food,/Africa Mart|Visa Helper/,'only restaurants in delivery');
 h.game.cityGuide();let t=h.document.getElementById('activityContent');assert.match(t.textContent,/Mama Put Kitchen/);assert.match(t.textContent,/Become a partner/);
 t.querySelector('[data-guide="shop"]').onclick();t=h.document.getElementById('activityContent');assert.match(t.textContent,/Africa Mart/);assert.doesNotMatch(t.textContent,/Mama Put/);assert.ok(t.querySelector('img[src*="media.php?id=bbbbbbbbbbbbbbbbbbbbbbbb"]'));
 t.querySelector('[data-guide-item="0"]').onclick();t=h.document.getElementById('activityContent');assert.match(t.textContent,/Products/);assert.match(t.textContent,/Garri 1kg/);assert.ok(t.querySelector('a[href^="https://wa.me/8618900000000"]'));
 h.click('partnerBack');assert.match(h.document.getElementById('activityContent').textContent,/City guide/);
});

test('Gist combines approved news events and live player activity with working filters',async()=>{
 const t=harness();t.context.ChinaLifeCloud={events:[{title:'Campus welcome',body:'Join us',place:'campus'}],feed:[{name:'Neighbour',text:'came online',kind:'online',at:Date.now()}]};t.context.ChinaLifeAuth={request:async()=>({data:{posts:[{title:'City news',body:'Welcome students',at:Date.now(),link:'https://hafrik.com'}]}})};
 await t.game.gist();let body=t.document.getElementById('gistPosts');assert.match(body.textContent,/City news/);assert.match(body.textContent,/Campus welcome/);assert.match(body.textContent,/Neighbour/);
 t.document.querySelector('[data-gist-filter="players"]').onclick();assert.match(body.textContent,/Neighbour/);assert.doesNotMatch(body.textContent,/City news|Campus welcome/);
 t.context.ChinaLifeCloud.feed.push({name:'Visitor',text:'arrived at 007 Club',kind:'moved',at:Date.now()});t.context.dispatchEvent(new t.context.CustomEvent('chinalife:cityfeed'));assert.match(body.textContent,/Visitor/);
});

test('buying VIP automatically takes the player to their seat and never repeats the charge on seating',()=>{const t=harness();t.game.state.place='night';t.game.state.money=10000;let seats=0;t.context.ChinaLifeWorld={vipSeat(){seats++}};t.game.clubAccess('night');t.click('vipNight');assert.equal(seats,1);assert.equal(t.game.state.money,9500);t.game.clubAccess('night');t.click('vipSeat');assert.equal(seats,2);assert.equal(t.game.state.money,9500);});
