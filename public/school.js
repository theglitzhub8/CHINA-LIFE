// R5 (not deployed): daily class attendance for Student characters. Status comes from the server once per load and after
// marking (no polling); rewards and the visa hold are applied server-side in attendance.php.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife,C=()=>window.ChinaLifeCloud;
const campus=p=>['campus','ef','university','liaoning','dongbei','academy'].includes(p)||/univ|campus/.test(String(p||''));
let st=null,busy=false,chip=null,loaded=false;
const student=()=>G()?.state?.created&&G().state.background==='Student';
const copy=s=>!s?'':s.status==='risk'?'Visa at risk. Attend '+s.recoverLeft+' more day'+(s.recoverLeft===1?'':'s')+' in a row to clear it and get your '+s.held+' XP back.':s.status==='warning'?'Visa warning: you missed '+s.missed+' classes this week. Go to campus today.':s.today?'You’re in class today. See you tomorrow.':'Go to campus today to mark attendance. +'+s.reward.xp+' XP · ¥'+s.reward.coins;
async function load(){if(loaded||!student()||!C()?.attendance)return;loaded=true;try{st=await C().attendance(false);if(st?.event==='risk')G().toast?.('⚠️ Visa at risk: '+st.held+' XP held until you attend 3 days in a row.');else if(st?.status==='warning'){const k='chinalife-visa-warn',d=new Date().toDateString();if(localStorage.getItem(k)!==d){localStorage.setItem(k,d);G().toast?.('⚠️ '+copy(st))}}}catch{}render()}
async function mark(){if(busy)return;busy=true;render();try{const r=await C().attendance(true);st=r;G().toast?.(r.event==='recovered'?'✅ Present. Visa back in good standing, '+r.xp+' XP returned.':'✅ Present. +'+r.xp+' XP · ¥'+r.coins)}catch(e){G().toast?.(e.message||'Couldn’t mark attendance.')}busy=false;render();window.dispatchEvent(new CustomEvent('chinalife:attendance'))}
function render(){const s=G()?.state,show=student()&&st&&!st.today&&campus(s?.place)&&!document.querySelector('dialog[open]');
 if(!show){chip?.remove();chip=null;return}
 if(!chip){chip=document.createElement('div');chip.className='r5-attend';chip.setAttribute('role','status');($('worldUI')||document.body).appendChild(chip)}
 chip.innerHTML='<span class="r5-ic">🎓</span><p><b>Class today</b><small>+'+st.reward.xp+' XP · ¥'+st.reward.coins+(st.status!=='ok'?' · '+(st.status==='risk'?'visa at risk':'visa warning'):'')+'</small></p><button type="button"'+(busy?' disabled':'')+'>'+(busy?'…':'I’m here')+'</button>';chip.querySelector('button').onclick=mark}
function card(){if(!student())return '';if(!st)return '<section class="r5-card"><span class="r5-ic">🎓</span><div><b>Class attendance</b><small>Sign in to track your school days.</small></div></section>';
 return '<section class="r5-card '+st.status+'"><span class="r5-ic">'+(st.status==='ok'?'🎓':'⚠️')+'</span><div><b>'+(st.today?'Present today':'Class attendance')+' · '+st.streak+'-day streak</b><small>'+copy(st)+'</small></div></section>'}
window.ChinaLifeSchool={card,load,mark,get status(){return st}};
window.addEventListener('chinalife:cloudready',()=>setTimeout(load,1500));window.addEventListener('chinalife:update',()=>{load();render()});
setTimeout(load,4000);document.addEventListener('close',()=>setTimeout(render,50),true);})();
