// University Years (switch uni_years): the student's year, the weekly calendar (Mon-Fri classes, Sat library, Sun exam),
// today's timetable with class check-in, the attendance score, campus rooms that open year by year, and the Sunday exam.
// Everything comes from university.php, which checks attendance and makes and grades the exam; the device only shows it.
// A chip appears at a campus (under the attendance chip when that one shows). Two minutes before a class the phone buzzes
// anywhere in the game.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife,C=()=>window.ChinaLifeCloud;
// A new screen starts at the top (the sheet keeps the last scroll position, and r4.js's sticky title follows the scroll).
const show=(...a)=>{G().showScreen(...a);const c=$('activityContent');if(c){c.scrollTop=0;c.dispatchEvent(new Event('scroll'))}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const campus=p=>['campus','ef','university','liaoning','dongbei','academy'].includes(p)||/univ|campus/.test(String(p||''));
const on=()=>window.ChinaLifeFlags?.cast?.('uni_years')===true&&G()?.state?.created&&G().state.background==='Student';
const ROOM_ICON={classrooms:'🏫',dorm:'🛏️',store:'🛒',library:'📚',lab:'🔬',hall:'🎓'};
let st=null,at=0,loading=false,chip=null,busy=false;
async function load(force){if(!on()||!C()?.university||loading||(!force&&st&&Date.now()-at<600000&&now()<1440))return st;loading=true;try{const d=await C().university();st=d?.student?d:null;at=Date.now()}catch{st=null}loading=false;render();return st}
// Beijing minute of the day by the server's clock: the minute it answered with, plus the time since.
const now=()=>st?st.minute+Math.floor((Date.now()-at)/60000):0;
const mins=t=>{const [h,m]=String(t).split(':').map(Number);return h*60+m};
// Today's classes with a status worked out live: attended (from the server), now (check-in open), missed or later.
const today=()=>!st?.classDay?[]:st.timetable.map(c=>{const m=now(),s=mins(c.time);return {...c,status:c.status==='attended'?'attended':m>=s+45?'missed':m>=s-2?'now':'later'}});
const headline=s=>s.orientation?'Orientation week · Year 1 starts '+s.start:'Year '+s.year+' of 4 · '+s.dayName+' · '+s.hsk;
// Sit under the daily attendance chip whenever that one shows (it can appear after this one).
const place=()=>{if(chip)chip.style.top=document.querySelector('.r5-attend:not(.uni-chip)')?'calc(max(8px, env(safe-area-inset-top)) + 176px)':''};
function render(){const show=on()&&st&&campus(G()?.state?.place)&&!document.querySelector('dialog[open]');if(!show){chip?.remove();chip=null;return}
 if(!chip){chip=document.createElement('div');chip.className='r5-attend uni-chip';chip.setAttribute('role','status');($('worldUI')||document.body).appendChild(chip)}
 place();
 const cls=today().find(c=>c.status==='now'),exam=st.exams.length>0,k=headline(st)+exam+(cls?.id||'')+busy+st.attendance;if(chip.dataset.k===k)return;chip.dataset.k=k;
 const [icon,title,small,button]=cls?['📳','Class now: '+cls.time+' '+cls.subject,'Check in from the classroom · +'+st.classReward.xp+' XP · ¥'+st.classReward.coins,busy?'…':'Check in']:
  exam?['📝','Exam day: '+st.exams.map(y=>'Year '+y).join(', ')+' open','Pass mark '+(st.passMarks[String(st.exams[0])]??st.passMark)+'/'+st.questions+' · +'+st.reward.xp+' XP · ¥'+st.reward.coins,'Take exam']:
  ['🎓','Year '+st.year+' · '+st.dayName,headline(st)+' · attendance '+st.attendance,'Open'];
 chip.innerHTML='<span class="r5-ic">'+icon+'</span><p><b>'+esc(title)+'</b><small>'+esc(small)+'</small></p><button type="button"'+(busy?' disabled':'')+'>'+button+'</button>';
 chip.querySelector('button').onclick=()=>cls?attend():open()}
async function attend(){const g=G();if(busy)return;busy=true;render();try{await C().presenceNow?.();const d=await C().university({action:'attend'});st=d;at=Date.now();g.toast?.('✓ Checked in to '+d.attended.subject+' · +'+d.attended.xp+' XP · ¥'+d.attended.coins)}
 catch(e){g.toast?.(e.message||'Check-in failed.');await load(true)}busy=false;render()}
async function open(){const g=G();if(!g)return;if(!st)await load(true);if(!st)return g.toast?.('University status is not available right now.');const s=st;
 const results=[1,2,3,4].map(y=>{const r=s.results[String(y)];return '<li>'+(r?.passed?'✅':r?'❌':y<=s.year?'⏳':'🔒')+' Year '+y+(r?' · '+r.score+'/'+r.total+(r.passed?' passed':' · resit on Sunday'):y<s.year?' · exam missed · resit on Sunday':y===s.year?' · exam on Sunday':'')+'</li>'}).join('');
 const rooms=s.rooms.map(r=>'<li>'+(r.open?ROOM_ICON[r.id]:'🔒')+' '+esc(r.name)+(r.open?'':' · opens in Year '+r.year)+'</li>').join('');
 const exams=s.exams.length?'<div class="uni-exams">'+s.exams.map(y=>'<button data-uni-exam="'+y+'">📝 Take the Year '+y+' exam'+(y<s.year?' (resit)':'')+' · pass mark '+(s.passMarks[String(y)]??s.passMark)+'/'+s.questions+'</button>').join('')+'</div>':'<p class="uni-next">Next exam: Sunday. Resits for missed or failed years open on any Sunday.</p>';
 const STATUS={attended:'✅ attended',now:'📳 on now: check in',missed:'❌ missed',later:'⏰ later'};
 const classes=s.classDay?'<ul class="uni-list">'+today().map(c=>'<li>'+esc(c.time+'–'+c.end+' '+c.subject)+' · '+STATUS[c.status]+'</li>').join('')+'</ul>'+(today().some(c=>c.status==='now')?'<div class="uni-exams"><button data-uni-attend>📳 Check in to class</button></div>':''):'<p class="uni-next">No classes today. Classes are Monday to Friday at '+s.classTimes.map(c=>c.time).join(' and ')+'.</p>';
 const score='<div class="uni-score'+(s.truancy?' risk':'')+'"><b>Attendance this year: '+s.attendance+'/100</b><span><i style="width:'+s.attendance+'%"></i></span><small>'+(s.truancy?'⚠️ Truancy risk: your exam pass mark is '+s.passMark+'/'+s.questions+'. Go to every class to bring it back up.':'Exam pass mark '+s.passMark+'/'+s.questions+'. A missed class costs 10, a class you attend gives 5 back.')+'</small></div>';
 show('🎓 University','<b>'+esc(headline(s))+'</b> · '+s.passedYears+'/4 years passed',
  '<div class="uni-card"><p>One real week is one university year: Monday to Friday classes, Saturday library and catch-up, Sunday exam. Missing a day never fails you out: a missed or failed exam becomes a resit.</p>'+score+exams+'<h3>Today</h3>'+classes+'<h3>Your years</h3><ul class="uni-list">'+results+'</ul><h3>Campus</h3><ul class="uni-list">'+rooms+'</ul>'+(window.ChinaLifeKitchen?.on?.()?'<div class="uni-exams"><button data-uni-store>🛒 Campus store</button><button data-uni-kitchen>🍳 Kitchen and fridge</button></div>':'')+'</div>');
 document.querySelectorAll('[data-uni-exam]').forEach(b=>b.onclick=()=>exam(Number(b.dataset.uniExam)));
 const st2=document.querySelector('[data-uni-store]');if(st2)st2.onclick=()=>window.ChinaLifeKitchen.store();const k2=document.querySelector('[data-uni-kitchen]');if(k2)k2.onclick=()=>window.ChinaLifeKitchen.open();
 const a=document.querySelector('[data-uni-attend]');if(a)a.onclick=async()=>{await attend();open()}}
async function exam(year){const g=G();let paper;try{paper=(await C().university({action:'start_exam',year})).exam}catch(e){return g.toast?.(e.message||'The exam could not start.')}
 const answers=[];let i=0;const q=paper.questions;
 const ask=()=>{const x=q[i];show('📝 Year '+year+' exam','Question '+(i+1)+' of '+q.length+' · pass mark '+(paper.passMark??st?.passMark??6),'<div class="uni-card"><p class="uni-q">'+esc(x.prompt)+'</p><div class="uni-exams">'+x.options.map((o,n)=>'<button data-uni-a="'+n+'">'+esc(o)+'</button>').join('')+'</div></div>');
  document.querySelectorAll('[data-uni-a]').forEach(b=>b.onclick=()=>{answers.push(x.options[Number(b.dataset.uniA)]);i++;i<q.length?ask():submit()})};
 const submit=async()=>{let d;try{d=await C().university({action:'submit_exam',answers})}catch(e){return g.toast?.(e.message||'The exam could not be marked.')}st=d;at=Date.now();const r=d.result;
  show(r.passed?'🎉 Year '+r.year+' passed':'Year '+r.year+' not passed yet',r.score+'/'+r.total+' right'+(r.passed?' · +'+r.xp+' XP · ¥'+r.coins:' · resit on a later Sunday'),
   '<div class="uni-card"><ol class="uni-list">'+q.map((x,n)=>'<li>'+(answers[n]===r.answers[n]?'✅':'❌')+' '+esc(x.prompt)+' <b>'+esc(r.answers[n])+'</b></li>').join('')+'</ol><div class="uni-exams"><button data-uni-back>Back to University</button></div></div>');
  document.querySelector('[data-uni-back]').onclick=()=>open();render()};ask()}
// The phone buzzes 2 minutes before each class (and once more if it has just started), anywhere in the game, once per class.
const buzzed=new Set((()=>{try{const v=JSON.parse(localStorage.getItem('chinalife-uni-buzz')||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch{return []}})());
function tick(){if(!on()||!st)return;if(now()>=1440)return load(true);
 for(const c of today()){const key=st.today+'|'+c.id,m=now(),s=mins(c.time);if(c.status!=='now'||m>=s+5||buzzed.has(key))continue;buzzed.add(key);
  try{localStorage.setItem('chinalife-uni-buzz',JSON.stringify([...buzzed].slice(-20)))}catch{}
  G().notify?.('📳 '+c.subject+' '+(m<s?'at '+c.time+', in '+(s-m)+' min':'started at '+c.time)+' · go to your campus to check in',()=>open());try{navigator.vibrate?.([200,100,200])}catch{}}
 render()}
setInterval(tick,20000);
window.ChinaLifeUniversity={load,open,attend,tick,get status(){return st}};
window.addEventListener('chinalife:cloudready',()=>setTimeout(()=>load(true),2000));window.addEventListener('chinalife:update',()=>{load();render()});window.addEventListener('chinalife:cast',()=>{st=null;load(true)});
const watch=()=>{const t=$('worldVenueTitle'),u=$('worldUI');if(!t||!u)return setTimeout(watch,1000);const mo=new MutationObserver(()=>{load();render()});mo.observe(t,{childList:true,characterData:true,subtree:true});mo.observe(u,{attributes:true,attributeFilter:['class']});new MutationObserver(place).observe(u,{childList:true})};watch();
document.addEventListener('close',()=>setTimeout(render,50),true);
const css=document.createElement('style');css.textContent='.uni-card p{margin:0 0 12px}.uni-card h3{margin:16px 0 6px;font-size:15px}.uni-list{margin:0;padding-left:4px;list-style:none;display:grid;gap:6px}.uni-exams{display:grid;gap:8px;margin:10px 0}.uni-exams button{padding:12px;border-radius:14px;border:1px solid #cfe3dd;background:#f3fbf8;font-weight:700;text-align:left}.uni-q{font-size:18px;font-weight:700}.uni-next{color:#55706c}.uni-score{display:grid;gap:6px;padding:12px;border-radius:14px;background:#f3fbf8;margin:0 0 10px}.uni-score span{height:8px;border-radius:8px;background:#dcebe6;overflow:hidden}.uni-score i{display:block;height:100%;background:#1f8a70}.uni-score.risk{background:#fff4ec}.uni-score.risk i{background:#d9643a}.uni-score small{color:#55706c}';document.head.append(css);
})();
