// ChinaLife Chinese course: 30 short units of everyday Mandarin (about HSK 1–2) for life in China.
// Each unit teaches five new words and one sentence. Words you have learnt come back for review on a
// spaced schedule (1, 2, 4, 7, 15 days); a wrong answer brings a word back sooner. Quizzes mix question
// types — meaning, reverse, pinyin, listening and building a sentence — so lessons never repeat the same way.
(()=>{
const U=(title,words,sentence)=>({title,words,sentence});
// words: [characters, pinyin, English]; sentence: [characters, pinyin, English, tokens in order]
const units=[
 U('Greetings',[['你好','nǐ hǎo','hello'],['谢谢','xièxie','thank you'],['再见','zàijiàn','goodbye'],['不客气','bú kèqi','you’re welcome'],['对不起','duìbuqǐ','sorry']],['你好，谢谢！','nǐ hǎo, xièxie!','Hello, thank you!',['你好','谢谢']]),
 U('About me',[['我','wǒ','I, me'],['你','nǐ','you'],['他','tā','he, him'],['她','tā','she, her'],['是','shì','to be']],['我是学生。','wǒ shì xuésheng.','I am a student.',['我','是','学生']]),
 U('Names',[['叫','jiào','to be called'],['名字','míngzi','name'],['什么','shénme','what'],['认识','rènshi','to know (a person)'],['高兴','gāoxìng','glad, happy']],['你叫什么名字？','nǐ jiào shénme míngzi?','What is your name?',['你','叫','什么','名字']]),
 U('Countries',[['中国','Zhōngguó','China'],['人','rén','person'],['哪','nǎ','which'],['国','guó','country'],['非洲','Fēizhōu','Africa']],['你是哪国人？','nǐ shì nǎ guó rén?','Which country are you from?',['你','是','哪','国','人']]),
 U('Numbers 1–5',[['一','yī','one'],['二','èr','two'],['三','sān','three'],['四','sì','four'],['五','wǔ','five']],['我有三个朋友。','wǒ yǒu sān ge péngyou.','I have three friends.',['我','有','三个','朋友']]),
 U('Numbers 6–10',[['六','liù','six'],['七','qī','seven'],['八','bā','eight'],['九','jiǔ','nine'],['十','shí','ten']],['今天是八号。','jīntiān shì bā hào.','Today is the 8th.',['今天','是','八号']]),
 U('Yes and no',[['不','bù','not, no'],['对','duì','correct, right'],['好','hǎo','good, OK'],['没有','méiyǒu','don’t have, there isn’t'],['有','yǒu','to have']],['我没有钱。','wǒ méiyǒu qián.','I don’t have money.',['我','没有','钱']]),
 U('Family',[['爸爸','bàba','dad'],['妈妈','māma','mum'],['朋友','péngyou','friend'],['家','jiā','home, family'],['哥哥','gēge','older brother']],['我的家在非洲。','wǒ de jiā zài Fēizhōu.','My home is in Africa.',['我的','家','在','非洲']]),
 U('Food',[['吃','chī','to eat'],['米饭','mǐfàn','rice'],['面条','miàntiáo','noodles'],['饺子','jiǎozi','dumplings'],['好吃','hǎochī','delicious']],['饺子很好吃。','jiǎozi hěn hǎochī.','The dumplings are delicious.',['饺子','很','好吃']]),
 U('Drinks',[['喝','hē','to drink'],['水','shuǐ','water'],['茶','chá','tea'],['咖啡','kāfēi','coffee'],['啤酒','píjiǔ','beer']],['我想喝茶。','wǒ xiǎng hē chá.','I want to drink tea.',['我','想','喝','茶']]),
 U('Restaurant',[['菜单','càidān','menu'],['服务员','fúwùyuán','waiter'],['买单','mǎidān','the bill, please'],['辣','là','spicy'],['不要','bú yào','don’t want']],['服务员，买单！','fúwùyuán, mǎidān!','Waiter, the bill please!',['服务员','买单']]),
 U('Shopping',[['买','mǎi','to buy'],['多少钱','duōshao qián','how much'],['块','kuài','yuan (spoken)'],['贵','guì','expensive'],['便宜','piányi','cheap']],['这个多少钱？','zhège duōshao qián?','How much is this?',['这个','多少钱']]),
 U('Bargaining',[['太','tài','too (much)'],['一点儿','yìdiǎnr','a little'],['可以','kěyǐ','can, may'],['这个','zhège','this'],['那个','nàge','that']],['太贵了，便宜一点儿！','tài guì le, piányi yìdiǎnr!','Too expensive, a bit cheaper!',['太贵了','便宜','一点儿']]),
 U('Paying',[['微信','Wēixìn','WeChat'],['支付宝','Zhīfùbǎo','Alipay'],['现金','xiànjīn','cash'],['扫','sǎo','to scan'],['付钱','fù qián','to pay']],['我用微信付钱。','wǒ yòng Wēixìn fù qián.','I pay with WeChat.',['我','用','微信','付钱']]),
 U('Time',[['今天','jīntiān','today'],['明天','míngtiān','tomorrow'],['昨天','zuótiān','yesterday'],['现在','xiànzài','now'],['点','diǎn','o’clock']],['现在几点？','xiànzài jǐ diǎn?','What time is it now?',['现在','几','点']]),
 U('Days',[['星期','xīngqī','week'],['星期一','xīngqī yī','Monday'],['周末','zhōumò','weekend'],['早上','zǎoshang','morning'],['晚上','wǎnshang','evening']],['周末我去公园。','zhōumò wǒ qù gōngyuán.','At the weekend I go to the park.',['周末','我','去','公园']]),
 U('Directions',[['左','zuǒ','left'],['右','yòu','right'],['在哪儿','zài nǎr','where is'],['前面','qiánmiàn','in front, ahead'],['一直走','yìzhí zǒu','go straight']],['地铁站在哪儿？','dìtiě zhàn zài nǎr?','Where is the metro station?',['地铁站','在哪儿']]),
 U('Getting around',[['地铁','dìtiě','metro'],['出租车','chūzūchē','taxi'],['公交车','gōngjiāochē','bus'],['去','qù','to go'],['到','dào','to arrive, to']],['我坐地铁去学校。','wǒ zuò dìtiě qù xuéxiào.','I take the metro to school.',['我','坐','地铁','去','学校']]),
 U('Places',[['学校','xuéxiào','school'],['医院','yīyuàn','hospital'],['超市','chāoshì','supermarket'],['银行','yínháng','bank'],['公园','gōngyuán','park']],['银行在超市左边。','yínháng zài chāoshì zuǒbian.','The bank is to the left of the supermarket.',['银行','在','超市','左边']]),
 U('Campus',[['老师','lǎoshī','teacher'],['学生','xuésheng','student'],['图书馆','túshūguǎn','library'],['上课','shàng kè','to have class'],['作业','zuòyè','homework']],['我们八点上课。','wǒmen bā diǎn shàng kè.','We have class at eight.',['我们','八点','上课']]),
 U('Studying',[['学习','xuéxí','to study'],['汉语','Hànyǔ','Chinese language'],['懂','dǒng','to understand'],['说','shuō','to speak'],['慢','màn','slow']],['请说慢一点儿。','qǐng shuō màn yìdiǎnr.','Please speak a bit slower.',['请','说','慢','一点儿']]),
 U('Feelings',[['开心','kāixīn','happy'],['累','lèi','tired'],['饿','è','hungry'],['忙','máng','busy'],['想家','xiǎng jiā','homesick']],['我有点儿想家。','wǒ yǒudiǎnr xiǎng jiā.','I’m a bit homesick.',['我','有点儿','想家']]),
 U('Health',[['医生','yīshēng','doctor'],['药','yào','medicine'],['疼','téng','to hurt'],['头','tóu','head'],['不舒服','bù shūfu','unwell']],['我头疼，不舒服。','wǒ tóu téng, bù shūfu.','I have a headache and feel unwell.',['我','头疼','不舒服']]),
 U('Weather',[['天气','tiānqì','weather'],['冷','lěng','cold'],['热','rè','hot'],['下雨','xià yǔ','to rain'],['下雪','xià xuě','to snow']],['今天很冷，下雪了。','jīntiān hěn lěng, xià xuě le.','It’s cold today; it’s snowing.',['今天','很冷','下雪了']]),
 U('Phone & apps',[['手机','shǒujī','mobile phone'],['电话','diànhuà','phone call'],['加','jiā','to add (a contact)'],['发','fā','to send'],['号码','hàomǎ','number']],['我们加个微信吧！','wǒmen jiā ge Wēixìn ba!','Let’s add each other on WeChat!',['我们','加个','微信','吧']]),
 U('Making friends',[['喜欢','xǐhuan','to like'],['一起','yìqǐ','together'],['玩','wán','to have fun, hang out'],['聊天','liáo tiān','to chat'],['欢迎','huānyíng','welcome']],['我们一起去玩吧！','wǒmen yìqǐ qù wán ba!','Let’s go and hang out together!',['我们','一起','去','玩','吧']]),
 U('Going out',[['电影','diànyǐng','film'],['唱歌','chàng gē','to sing'],['跳舞','tiào wǔ','to dance'],['酒吧','jiǔbā','bar'],['音乐','yīnyuè','music']],['你喜欢跳舞吗？','nǐ xǐhuan tiào wǔ ma?','Do you like dancing?',['你','喜欢','跳舞','吗']]),
 U('Work',[['工作','gōngzuò','work, job'],['公司','gōngsī','company'],['老板','lǎobǎn','boss'],['开会','kāi huì','to have a meeting'],['工资','gōngzī','salary']],['我在公司工作。','wǒ zài gōngsī gōngzuò.','I work at a company.',['我','在','公司','工作']]),
 U('Home',[['房子','fángzi','house'],['房间','fángjiān','room'],['住','zhù','to live'],['床','chuáng','bed'],['厨房','chúfáng','kitchen']],['我住在沈阳。','wǒ zhù zài Shěnyáng.','I live in Shenyang.',['我','住在','沈阳']]),
 U('Help & safety',[['帮','bāng','to help'],['请','qǐng','please'],['警察','jǐngchá','police'],['小心','xiǎoxīn','be careful'],['没关系','méi guānxi','it’s OK, never mind']],['请帮我一下！','qǐng bāng wǒ yíxià!','Please help me!',['请','帮','我','一下']])
];
const INTERVALS=[0,1,2,4,7,15];
const allWords=units.flatMap((u,i)=>u.words.map(w=>({han:w[0],pin:w[1],en:w[2],unit:i})));
const byHan=new Map(allWords.map(w=>[w.han,w]));
const fresh=()=>({unit:0,lessons:0,words:{},practiceDay:0,practiceCount:0});
// Saves are untrusted: keep only known words, sane boxes and days.
function validate(v){const r=fresh();if(!v||typeof v!=='object')return r;const int=(x,max)=>Number.isInteger(x)&&x>=0?Math.min(x,max):0;
 r.unit=int(v.unit,units.length);r.lessons=int(v.lessons,100000);r.practiceDay=int(v.practiceDay,1000000);r.practiceCount=int(v.practiceCount,1000);
 for(const [han,e] of Object.entries(v.words||{}))if(byHan.has(han)&&Array.isArray(e))r.words[han]=[int(e[0],INTERVALS.length-1),int(e[1],1000000),int(e[2],100000),int(e[3],100000)];return r}
// Each word: [box, due day, times right, times wrong].
const learnt=p=>Object.keys(p.words).map(h=>byHan.get(h)).filter(Boolean);
const due=(p,day)=>learnt(p).filter(w=>p.words[w.han][1]<=day).sort((a,b)=>p.words[a.han][0]-p.words[b.han][0]||p.words[a.han][1]-p.words[b.han][1]);
const mastered=p=>learnt(p).filter(w=>p.words[w.han][0]>=4).length;
function record(p,han,right,day){const e=p.words[han]||[0,day,0,0];if(right){e[0]=Math.min(INTERVALS.length-1,e[0]+1);e[2]++}else{e[0]=Math.max(0,e[0]-2);e[3]++}e[1]=day+(right?INTERVALS[e[0]]:0)+(right?0:1);p.words[han]=e;return e}
const shuffle=(list,rnd=Math.random)=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function options(answer,key,pool,rnd){const seen=new Set([answer[key]]),out=[answer[key]];for(const w of shuffle(pool,rnd)){if(out.length>=4)break;if(!seen.has(w[key])){seen.add(w[key]);out.push(w[key])}}return shuffle(out,rnd)}
// Questions for one word, in a type chosen to vary (and harder once a word is known better).
function question(w,type,pool,rnd){if(type==='listen'){if(!canSpeak())type='meaning';else pool=pool.filter(x=>x.han===w.han||x.pin!==w.pin)}const ask={
  meaning:()=>({type,han:w.han,prompt:'What does '+w.han+' ('+w.pin+') mean?',options:options(w,'en',pool,rnd),answer:w.en}),
  reverse:()=>({type,han:w.han,prompt:'How do you write “'+w.en+'” in Chinese?',options:options(w,'han',pool,rnd),answer:w.han}),
  pinyin:()=>({type,han:w.han,prompt:'How do you say '+w.han+'?',options:options(w,'pin',pool,rnd),answer:w.pin}),
  listen:()=>({type,han:w.han,prompt:'Listen and choose what you hear.',speak:w.han,options:options(w,'han',pool,rnd),answer:w.han})};return (ask[type]||ask.meaning)()}
const TYPES=['meaning','reverse','pinyin','listen'];
// Today's class: five new words from the current unit, then a quiz on them plus up to two due reviews and the unit sentence.
function lesson(p,day,rnd=Math.random){const unit=units[Math.min(p.unit,units.length-1)],done=p.unit>=units.length,neu=unit.words.map(w=>byHan.get(w[0]));
 const review=due(p,day).filter(w=>w.unit!==p.unit).slice(0,2),pool=allWords.filter(w=>w.unit<=p.unit+1);
 const quiz=shuffle(neu,rnd).slice(0,4).map((w,i)=>question(w,TYPES[(i+p.lessons)%TYPES.length],pool,rnd)).concat(review.map((w,i)=>question(w,TYPES[(i+2+p.lessons)%TYPES.length],pool,rnd)));
 const s=unit.sentence;quiz.push({type:'sentence',prompt:'Build the sentence: “'+s[2]+'”',tokens:shuffle(s[3],rnd),answer:s[3].join(''),han:null,sentence:s});
 return {index:Math.min(p.unit,units.length-1),title:unit.title,words:neu,sentence:s,quiz,done}}
// Practice any time: due reviews first, then the weakest words; never new ones.
function practice(p,day,rnd=Math.random){const list=due(p,day),weak=learnt(p).filter(w=>!list.includes(w)).sort((a,b)=>p.words[a.han][0]-p.words[b.han][0]),words=[...list,...weak].slice(0,6),pool=learnt(p).length>=4?learnt(p):allWords.slice(0,20);
 return {due:list.length,quiz:words.map((w,i)=>question(w,TYPES[Math.floor(rnd()*TYPES.length)],pool,rnd))}}
// Pass with at least two thirds right to move on; otherwise the unit repeats tomorrow with new questions.
function finishLesson(p,results,day){const right=results.filter(Boolean).length,passed=right>=Math.ceil(results.length*2/3);p.lessons++;if(passed&&p.unit<units.length)p.unit++;return {right,total:results.length,passed}}
function speak(text){try{if(!window.speechSynthesis||typeof SpeechSynthesisUtterance!=='function')return false;const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=.8;const v=speechSynthesis.getVoices().find(v=>/zh[-_]CN/i.test(v.lang));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u);return true}catch{return false}}
const canSpeak=()=>!!(typeof window!=='undefined'&&window.speechSynthesis&&typeof SpeechSynthesisUtterance==='function');
window.ChinaLifeChinese={units,allWords,fresh,validate,learnt,due,mastered,record,lesson,practice,finishLesson,speak,canSpeak,shuffle,INTERVALS};
})();
