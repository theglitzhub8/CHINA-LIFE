// University Years (switch uni_years): the student's year, the weekly calendar (Mon-Fri classes, Sat library, Sun exam),
// campus rooms that open year by year, and the Sunday exam. Everything comes from university.php, which makes and grades
// the exam; the device only shows it. A chip appears at a campus (under the attendance chip when that one shows).
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife,C=()=>window.ChinaLifeCloud;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const campus=p=>['campus','ef','university','liaoning','dongbei','academy'].includes(p)||/univ|campus/.test(String(p||''));
const on=()=>window.ChinaLifeFlags?.cast?.('uni_years')===true&&G()?.state?.created&&G().state.background==='Student';
const ROOM_ICON={classrooms:'🏫',dorm:'🛏️',store:'🛒',library:'📚',lab:'🔬',hall:'🎓'};
let st=null,at=0,loading=false,chip=null;
async function load(force){if(!on()||!C()?.university||loading||(!force&&st&&Date.now()-at<600000))return st;loading=true;try{const d=await C().university();st=d?.student?d:null;at=Date.now()}catch{st=null}loading=false;render();return st}
const headline=s=>s.orientation?'Orientation week · Year 1 starts '+s.start:'Year '+s.year+' of 4 · '+s.dayName+' · '+s.hsk;
function render(){const show=on()&&st&&campus(G()?.state?.place)&&!document.querySelector('dialog[open]');if(!show){chip?.remove();chip=null;return}
 if(!chip){chip=document.createElement('div');chip.className='r5-attend uni-chip';chip.setAttribute('role','status');($('worldUI')||document.body).appendChild(chip)}
 chip.style.top=document.querySelector('.r5-attend:not(.uni-chip)')?'calc(max(8px, env(safe-area-inset-top)) + 176px)':'';
 const exam=st.exams.length>0,k=headline(st)+exam;if(chip.dataset.k===k)return;chip.dataset.k=k;
 chip.innerHTML='<span class="r5-ic">'+(exam?'📝':'🎓')+'</span><p><b>'+esc(exam?'Exam day: '+st.exams.map(y=>'Year '+y).join(', ')+' open':'Year '+st.year+' · '+st.dayName)+'</b><small>'+esc(exam?'Pass mark '+st.passMark+'/'+st.questions+' · +'+st.reward.xp+' XP · ¥'+st.reward.coins:headline(st))+'</small></p><button type="button">'+(exam?'Take exam':'Open')+'</button>';
 chip.querySelector('button').onclick=()=>open()}
async function open(){const g=G();if(!g)return;if(!st)await load(true);if(!st)return g.toast?.('University status is not available right now.');const s=st;
 const results=[1,2,3,4].map(y=>{const r=s.results[String(y)];return '<li>'+(r?.passed?'✅':r?'❌':y<=s.year?'⏳':'🔒')+' Year '+y+(r?' · '+r.score+'/'+r.total+(r.passed?' passed':' · resit on Sunday'):y<s.year?' · exam missed · resit on Sunday':y===s.year?' · exam on Sunday':'')+'</li>'}).join('');
 const rooms=s.rooms.map(r=>'<li>'+(r.open?ROOM_ICON[r.id]:'🔒')+' '+esc(r.name)+(r.open?'':' · opens in Year '+r.year)+'</li>').join('');
 const exams=s.exams.length?'<div class="uni-exams">'+s.exams.map(y=>'<button data-uni-exam="'+y+'">📝 Take the Year '+y+' exam'+(y<s.year?' (resit)':'')+'</button>').join('')+'</div>':'<p class="uni-next">Next exam: Sunday. Resits for missed or failed years open on any Sunday.</p>';
 g.showScreen('🎓 University','<b>'+esc(headline(s))+'</b> · '+s.passedYears+'/4 years passed',
  '<div class="uni-card"><p>One real week is one university year: Monday to Friday classes, Saturday library and catch-up, Sunday exam. Missing a day never fails you out: a missed or failed exam becomes a resit.</p>'+exams+'<h3>Your years</h3><ul class="uni-list">'+results+'</ul><h3>Campus</h3><ul class="uni-list">'+rooms+'</ul></div>');
 document.querySelectorAll('[data-uni-exam]').forEach(b=>b.onclick=()=>exam(Number(b.dataset.uniExam)))}
async function exam(year){const g=G();let paper;try{paper=(await C().university({action:'start_exam',year})).exam}catch(e){return g.toast?.(e.message||'The exam could not start.')}
 const answers=[];let i=0;const q=paper.questions;
 const ask=()=>{const x=q[i];g.showScreen('📝 Year '+year+' exam','Question '+(i+1)+' of '+q.length+' · pass mark '+(st?.passMark??6),'<div class="uni-card"><p class="uni-q">'+esc(x.prompt)+'</p><div class="uni-exams">'+x.options.map((o,n)=>'<button data-uni-a="'+n+'">'+esc(o)+'</button>').join('')+'</div></div>');
  document.querySelectorAll('[data-uni-a]').forEach(b=>b.onclick=()=>{answers.push(x.options[Number(b.dataset.uniA)]);i++;i<q.length?ask():submit()})};
 const submit=async()=>{let d;try{d=await C().university({action:'submit_exam',answers})}catch(e){return g.toast?.(e.message||'The exam could not be marked.')}st=d;at=Date.now();const r=d.result;
  g.showScreen(r.passed?'🎉 Year '+r.year+' passed':'Year '+r.year+' not passed yet',r.score+'/'+r.total+' right'+(r.passed?' · +'+r.xp+' XP · ¥'+r.coins:' · resit on a later Sunday'),
   '<div class="uni-card"><ol class="uni-list">'+q.map((x,n)=>'<li>'+(answers[n]===r.answers[n]?'✅':'❌')+' '+esc(x.prompt)+' <b>'+esc(r.answers[n])+'</b></li>').join('')+'</ol><div class="uni-exams"><button data-uni-back>Back to University</button></div></div>');
  document.querySelector('[data-uni-back]').onclick=()=>open();render()};ask()}
window.ChinaLifeUniversity={load,open,get status(){return st}};
window.addEventListener('chinalife:cloudready',()=>setTimeout(()=>load(true),2000));window.addEventListener('chinalife:update',()=>{load();render()});window.addEventListener('chinalife:cast',()=>{st=null;load(true)});
const watch=()=>{const t=$('worldVenueTitle'),u=$('worldUI');if(!t||!u)return setTimeout(watch,1000);const mo=new MutationObserver(()=>{load();render()});mo.observe(t,{childList:true,characterData:true,subtree:true});mo.observe(u,{attributes:true,attributeFilter:['class']})};watch();
document.addEventListener('close',()=>setTimeout(render,50),true);
const css=document.createElement('style');css.textContent='.uni-card p{margin:0 0 12px}.uni-card h3{margin:16px 0 6px;font-size:15px}.uni-list{margin:0;padding-left:4px;list-style:none;display:grid;gap:6px}.uni-exams{display:grid;gap:8px;margin:10px 0}.uni-exams button{padding:12px;border-radius:14px;border:1px solid #cfe3dd;background:#f3fbf8;font-weight:700;text-align:left}.uni-q{font-size:18px;font-weight:700}.uni-next{color:#55706c}';document.head.append(css);
})();
