// Hospital Phase 0 (docs/HOSPITAL-PLAN.md, appadmin switch hospital_care, default OFF). Fainting (game.js faint) and a
// drinking blackout (game.js blackout) take you to the City Hospital by ambulance: you wake up on the ward, a nurse
// tells you what happened, and the bill (¥200, your first visit free) is charged on the server (economy.php
// action 'hospital'). "🩺 Your health" (the hospital's place bar) shows what is wrong right now and how to fix it.
// Game interpretation, never medical advice.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('hospital_care')===true,checkOn=()=>on()&&window.ChinaLifeFlags?.cast?.('hospital_checkup')===true,pharmOn=()=>on()&&window.ChinaLifeFlags?.cast?.('hospital_pharmacy')===true,staffOn=()=>on()&&window.ChinaLifeFlags?.cast?.('hospital_staff')===true,visitsOn=()=>on()&&window.ChinaLifeFlags?.cast?.('hospital_visits')===true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const show=(...a)=>{G().showScreen(...a);const c=$('activityContent');if(c){c.scrollTop=0;c.dispatchEvent(new Event('scroll'))}};
const STORY={'faint-hunger':['😵 You fainted from hunger','You went too long without food. A nurse brought you a warm bowl of congee while you came round.'],
 'faint-energy':['😵 You fainted from exhaustion','You pushed yourself too hard. You slept on the ward and a nurse checked on you.'],
 blackout:['⚫ You blacked out','You drank too much. The nurses gave you water and kept an eye on you until you woke up.']};
// Called by game.js after fainting or a blackout (time has already passed there).
function wake(cause){const g=G(),s=g.state,n=s.needs;
 if(cause==='faint-hunger')n.hunger=Math.max(n.hunger??0,45);n.energy=Math.max(n.energy??0,45);if(cause==='blackout')s.drunk=Math.min(s.drunk||0,20);
 s.logs?.unshift(STORY[cause][0].slice(2)+'. You woke up at the City Hospital.');g.save?.();
 const arrive=()=>{if(s.place!=='cityhospital')g.walkIn?.('cityhospital');bill(cause)};
 const W=window.ChinaLifeWorld;if(W?.journey&&s.place!=='cityhospital')W.journey({from:s.place,to:'cityhospital',mode:'cab',label:'🚑 Ambulance to the City Hospital'},arrive);else arrive()}
async function bill(cause){const g=G();let d=null;
 if(window.ChinaLifeCloud?.signedIn&&window.ChinaLifeAuth?.request){try{const r=await window.ChinaLifeAuth.request('/chinalife/economy.php','POST',{action:'hospital',cause:cause==='blackout'?'blackout':'faint'});d=r?.data||r;g.applyServerTotals?.(d)}catch{}}
 const [title,text]=STORY[cause],line=!d?'No bill this time.':d.first?'🎁 Your first visit is free.':d.recovering?'No charge: you were treated here a few minutes ago.':d.charged?'💳 Bill: ¥'+Number(d.charged).toLocaleString()+(d.charged<d.bill?' (all you had)':'')+'.':'No charge.';
 show(title,'You woke up on the ward at the City Hospital.','<div class="hp-card"><p>'+esc(text)+'</p><p class="hp-bill">'+esc(line)+'</p></div><div class="hp-actions"><button type="button" id="hpHealth">🩺 Your health</button><button type="button" id="hpOk" class="hp-soft">I’m okay</button></div>');
 $('hpHealth').onclick=health;$('hpOk').onclick=()=>$('activityDialog')?.close()}
// What is wrong right now, and how to fix it. Low needs, food sickness (kitchen.js) and being drunk.
const FIX={hunger:['🍜','Hungry','Eat: order food, cook, or ask the Club for a snack'],energy:['😴','Tired','Rest on the ward (free) or see a doctor here (¥150)'],
 hygiene:['🫧','Needs a shower','Shower at home'],bladder:['🚻','Needs the toilet','Any venue has one'],fun:['🎉','Bored','Go out: the Club, Football or the Gossip Room'],social:['💬','Lonely','Say hi in a venue or open Link Up']};
function health(){const s=G().state,n=s.needs||{},rows=[],here=s.place==='cityhospital';
 for(const [k,[icon,label,fix]] of Object.entries(FIX)){const v=Math.round(n[k]??100);if(v<35)rows.push([icon,label+' · '+v+'%',fix])}
 if(s.food?.sick)rows.push(['🤢','Food sickness',s.place==='cityhospital'?'The doctor here treats it: you are being looked after':'Come to the City Hospital and the doctor treats it']);
 if((s.drunk||0)>=40)rows.push(['🥴','Drunk · '+Math.round(s.drunk)+'%','Drink water and rest before going out again']);
 show('🩺 Your health','How your character is doing right now. A game, not medical advice.',
  (rows.length?'<ul class="hp-list">'+rows.map(([i,l,f])=>'<li><span>'+i+'</span><b>'+esc(l)+'</b><small>'+esc(f)+'</small></li>').join('')+'</ul>':'<div class="hp-card"><p>✅ You’re in good shape. Keep eating, resting and going out.</p></div>')+
  (vitUntil>Date.now()?'<p class="hp-note">💊 Vitamins working: needs drop 30% slower until '+clock(vitUntil)+'.</p>':'')+
  ((checkOn()&&here)||pharmOn()||((staffOn()||visitsOn())&&here)?'<div class="hp-actions">'+(staffOn()&&here?'<button type="button" id="hpAsk">🧑‍⚕️ Ask the doctor on shift</button>':'')+(checkOn()&&here?'<button type="button" id="hpCheck">👩‍⚕️ Free weekly check-up</button>':'')+(pharmOn()?'<button type="button" id="hpPharm">💊 '+(here?'Pharmacy':'Your medicine')+'</button>':'')+(visitsOn()&&here?'<button type="button" id="hpWard">💐 Visit the ward</button>':'')+(staffOn()&&here?'<button type="button" id="hpWork" class="hp-soft">🩺 Work at the hospital</button>':'')+'</div>':''));
 const b=$('hpCheck');if(b)b.onclick=checkup;const m=$('hpPharm');if(m)m.onclick=pharmacy;const a=$('hpAsk');if(a)a.onclick=askStaff;const w=$('hpWork');if(w)w.onclick=work;const v=$('hpWard');if(v)v.onclick=ward;if(visitsOn())collectVisits()}
// Hospital Phase 1 (switch hospital_checkup): the free weekly check-up. The doctor asks 5 questions in simple Chinese
// (economy.php action 'checkup', questions and marking in hospital-lib.php); XP on the server, Chinese progress here.
const req=body=>window.ChinaLifeAuth.request('/chinalife/economy.php','POST',body).then(r=>r?.data||r);
async function checkup(){const g=G();if(!window.ChinaLifeCloud?.signedIn||!window.ChinaLifeAuth?.request)return g.toast?.('Sign in to see the doctor for a check-up.');
 let q;try{q=(await req({action:'checkup',step:'start'})).questions}catch(e){return g.toast?.(e.message||'The doctor is busy right now.')}
 const answers={};let i=0;
 const ask=()=>{const x=q[i];show('👩‍⚕️ Check-up','Question '+(i+1)+' of '+q.length+' · answer the doctor',
  '<div class="hp-card"><p class="hp-q">'+esc(x.prompt)+'</p>'+(x.pinyin?'<p class="hp-py">'+esc(x.pinyin)+'</p>':'')+'</div><div class="hp-choices">'+x.options.map((o,n)=>'<button type="button" data-hp-a="'+n+'">'+esc(o)+'</button>').join('')+'</div>');
  document.querySelectorAll('[data-hp-a]').forEach(b=>b.onclick=()=>{answers[x.id]=x.options[Number(b.dataset.hpA)];i++;i<q.length?ask():submit()})};
 const submit=async()=>{let r;try{r=await req({action:'checkup',answers})}catch(e){return g.toast?.(e.message||'The check-up could not be marked.')}
  const c=r.checkup;g.applyServerTotals?.(r);g.gain?.('Chinese',c.right*5);G().state.logs?.unshift('Check-up at the City Hospital: '+c.right+'/'+c.total+' in hospital Chinese.');g.save?.();
  show(c.right===c.total?'👩‍⚕️ Perfect check-up':'👩‍⚕️ Check-up done',c.right+'/'+c.total+' right · +'+c.xp+' XP · Chinese +'+c.right*5,
   '<ul class="hp-list hp-marked">'+c.marked.map(m=>'<li class="'+(m.right?'ok':'')+'"><span>'+(m.right?'✅':'❌')+'</span><b>'+esc(m.prompt)+'</b><small>'+esc((m.pinyin?m.pinyin+' · ':'')+m.answer)+'</small></li>').join('')+'</ul><p class="hp-note">Your next free check-up is on Monday.</p><div class="hp-actions"><button type="button" id="hpDone" class="hp-soft">Done</button></div>');
  $('hpDone').onclick=()=>$('activityDialog')?.close()};
 ask()}
// Hospital Phase 2 (switch hospital_pharmacy): medicine bought at the City Hospital and kept (stock on the server,
// economy.php action 'pharmacy'); used anywhere, from Your health (the phone's Wellbeing app). The effect is applied here.
let vitUntil=0,snap=null;const clock=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const EFFECT={painkiller:(s,n)=>{n.energy=Math.min(100,(n.energy??0)+20)},ors:(s,n)=>{s.drunk=Math.max(0,(s.drunk||0)-40);n.energy=Math.min(100,(n.energy??0)+5)},
 vitamins:()=>{snap=null},stomach:s=>{if(s.food?.sick)s.food.sick=null}};
async function pharmacy(){const g=G();if(!window.ChinaLifeCloud?.signedIn||!window.ChinaLifeAuth?.request)return g.toast?.('Sign in to use the pharmacy.');
 try{paint(await req({action:'pharmacy',op:'stock'}))}catch(e){g.toast?.(e.message||'The pharmacy is closed right now.')}}
function paint(d){const g=G(),here=g.state.place==='cityhospital';vitUntil=(d.vitaminsUntil||0)*1000;
 show('💊 '+(here?'Pharmacy':'Your medicine'),here?'Buy medicine to keep (up to '+d.max+' of each) and take it anywhere from your phone.':'Take what you keep. Buy more at the City Hospital pharmacy.',
  '<ul class="hp-list hp-meds">'+Object.entries(d.items).map(([id,[price,name,han,py,does]])=>{const n=d.stock[id]||0;
   return '<li><span>💊</span><b>'+esc(name)+' · '+esc(han)+'</b><small>'+esc(py)+' · '+esc(does)+' · You have '+n+'</small><div class="hp-med-btns">'+(here?'<button type="button" data-hp-buy="'+id+'"'+(n>=d.max?' disabled':'')+'>Buy ¥'+price+'</button>':'')+'<button type="button" class="hp-soft" data-hp-use="'+id+'"'+(n?'':' disabled')+'>Take</button></div></li>'}).join('')+'</ul>'+
  (vitUntil>Date.now()?'<p class="hp-note">Vitamins working until '+clock(vitUntil)+'.</p>':'')+'<p class="hp-note">A game, not medical advice.</p>');
 document.querySelectorAll('[data-hp-buy]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const r=await req({action:'pharmacy',op:'buy',item:b.dataset.hpBuy});g.applyServerTotals?.(r);g.save?.();g.refresh?.();paint(r);g.toast?.('💊 Bought '+r.items[b.dataset.hpBuy][1].toLowerCase()+'.')}catch(e){b.disabled=false;g.toast?.(e.message||'Could not buy that.')}});
 document.querySelectorAll('[data-hp-use]').forEach(b=>b.onclick=async()=>{const id=b.dataset.hpUse;b.disabled=true;try{const r=await req({action:'pharmacy',op:'use',item:id}),s=g.state;EFFECT[id](s,s.needs);vitUntil=(r.vitaminsUntil||0)*1000;
  s.logs?.unshift('Took '+r.items[id][1].toLowerCase()+' ('+r.items[id][2]+').');g.save?.();g.refresh?.();paint(r);g.toast?.('💊 '+r.items[id][1]+': '+r.items[id][4]+'.')}catch(e){b.disabled=false;g.toast?.(e.message||'Could not take that.')}})}
// Vitamins: every 20 s, give back 30% of what each need dropped since the last look.
function vitamins(){const n=G()?.state?.needs;if(!n||vitUntil<=Date.now()){snap=null;return}
 if(snap)for(const k of Object.keys(FIX))if(Number.isFinite(snap[k])&&n[k]<snap[k])n[k]=Math.min(100,n[k]+(snap[k]-n[k])*.3);snap={...n}}
setInterval(vitamins,20000);
// After a reload, ask once whether vitamins are still working.
setTimeout(()=>{if(pharmOn()&&window.ChinaLifeCloud?.signedIn)req({action:'pharmacy',op:'stock'}).then(d=>{vitUntil=(d.vitaminsUntil||0)*1000}).catch(()=>{})},8000);
// Hospital Phase 3 (switch hospital_staff): player doctors and nurses (hospital-staff.php). Patients ask the staff on
// shift and wait in a queue; staff read each chart and pick the treatment for the most urgent problem.
const staffApi=body=>window.ChinaLifeAuth.request('/chinalife/hospital-staff.php',body?'POST':'GET',body).then(r=>r?.data||r);
const signed=()=>window.ChinaLifeCloud?.signedIn&&window.ChinaLifeAuth?.request;
const NEED={hunger:'Hunger',energy:'Energy',hygiene:'Hygiene',bladder:'Bladder',fun:'Fun',social:'Social'};
// What the treatment does for the patient (the ward staff step in when the treatment was wrong, so it always works).
const CURE={sick:s=>{if(s.food?.sick)s.food.sick=null},drunk:s=>{s.drunk=Math.max(0,(s.drunk||0)-50)},bladder:(s,n)=>{n.bladder=100}};
const cure=(problem,s)=>{const n=s.needs;if(CURE[problem])CURE[problem](s,n);else if(problem in n)n[problem]=Math.min(100,(n[problem]??0)+(problem==='fun'||problem==='social'?30:40))};
let waiting=false,waitTimer=0;
async function askStaff(){const g=G(),s=g.state;if(!signed())return g.toast?.('Sign in to see the doctor on shift.');
 try{const d=await staffApi({action:'request',chart:{needs:s.needs,drunk:s.drunk||0,sick:!!s.food?.sick}});waiting=true;waitScreen(d.patient)}
 catch(e){g.toast?.((e.message||'Nobody can see you right now.')+(/shift/.test(e.message||'')?' The ward staff can help: rest on the ward or see a doctor (¥150).':''))}}
function waitScreen(p){show('🧑‍⚕️ Waiting for the doctor','You’re in the queue. Someone on shift will see you soon (up to 10 minutes).',
 '<div class="hp-card"><p>Your chart says: <b>'+esc(p?.label||'')+'</b>.</p><p class="hp-note">You can close this: we’ll tell you when you’ve been seen.</p></div><div class="hp-actions"><button type="button" id="hpLeave" class="hp-soft">Leave the queue</button></div>');
 $('hpLeave').onclick=async()=>{try{await staffApi({action:'cancel'})}catch{}waiting=false;$('activityDialog')?.close()};pollPatient()}
async function pollPatient(){clearTimeout(waitTimer);if(!waiting)return;let d;try{d=await staffApi()}catch{d=null}
 if(d&&d.patient?.status==='treated')return collect(d.patient);if(d&&!d.patient){waiting=false;return G().toast?.('Nobody on shift could see you in time. The ward staff can help: rest on the ward or see a doctor (¥150).')}
 waitTimer=setTimeout(pollPatient,$('hpLeave')?5000:20000)}
async function collect(p){const g=G();waiting=false;let r;try{r=await staffApi({action:'ack',id:p.id})}catch{return}
 const s=g.state;cure(p.problem,s);g.applyServerTotals?.(r);s.logs?.unshift(p.staff+' treated you at the City Hospital ('+p.treatmentName+').');g.save?.();g.refresh?.();
 show('🩺 '+esc(p.staff)+' treated you',p.correct?'The right treatment · +10 XP':'The ward staff stepped in',
  '<div class="hp-card"><p>Your problem: <b>'+esc(p.label)+'</b>.</p><p>Treatment: <b>'+esc(p.treatmentName)+'</b>.</p>'+(p.correct?'':'<p>That wasn’t quite right, so a nurse sorted it out. You’re fine now.</p>')+'</div><div class="hp-actions"><button type="button" id="hpDone2" class="hp-soft">Thanks</button></div>');
 $('hpDone2').onclick=()=>$('activityDialog')?.close()}
// Staff: qualification, the Health worker test, the shift and the queue.
let queueTimer=0,queueKey='';
async function work(){const g=G();if(!signed())return g.toast?.('Sign in to work at the hospital.');let d;try{d=await staffApi()}catch(e){return g.toast?.(e.message||'The hospital office is closed.')}
 const me=d.me,pay=d.pay,role=me.role==='doctor'?'Doctor':'Nurse';
 if(me.onShift)return queueScreen(d);
 if(!me.role)return show('🩺 Work at the hospital','Only qualified players treat patients here.',
  '<ul class="hp-list hp-meds"><li><span>🎓</span><b>Doctor</b><small>Choose a University major (Year 3). Pays ¥'+pay.doctor+' for each right treatment.</small></li><li><span>📝</span><b>Nurse</b><small>Pass the Health worker test: 8 questions, 7 right, one try a day. Pays ¥'+pay.nurse+' for each right treatment.</small></li></ul>'+
  '<div class="hp-actions"><button type="button" id="hpTest"'+(me.testToday?' disabled':'')+'>📝 '+(me.testToday?'Test taken today: try again tomorrow':'Take the Health worker test')+'</button></div>'),$('hpTest').onclick=healthTest;
 show('🩺 Work at the hospital','You’re qualified: '+role+'.','<div class="hp-card"><p>A shift is '+pay.shift+' minutes at the City Hospital. Read each patient’s chart and pick the treatment for the most urgent problem.</p><p class="hp-bill">¥'+(me.role==='doctor'?pay.doctor:pay.nurse)+' + '+pay.xp+' XP for each right treatment (paid for '+pay.perDay+' patients a day).</p><p class="hp-note">Treated today: '+me.treatedToday+'</p></div><div class="hp-actions"><button type="button" id="hpShift">Start my shift</button></div>');
 $('hpShift').onclick=async()=>{try{await staffApi({action:'shift_start'});work()}catch(e){g.toast?.(e.message||'Could not start the shift.')}}}
function chartText(c){const n=c.needs||{},bits=[];if(c.sick)bits.push('<i class="hp-hot">🤢 Food sickness</i>');if((c.drunk||0)>0)bits.push('<i'+(c.drunk>=60?' class="hp-hot"':'')+'>Drunk '+c.drunk+'%</i>');
 for(const [k,l] of Object.entries(NEED))bits.push('<i'+((n[k]??100)<35?' class="hp-hot"':'')+'>'+l+' '+(n[k]??100)+'%</i>');return bits.join('')}
function queueScreen(d){const me=d.me;queueKey='';
 show('🩺 On shift','Until '+clock(me.shiftUntil*1000)+' · treated today '+me.treatedToday+' · paid '+me.paidToday+'/'+d.pay.perDay,
  '<p class="hp-note">Treat the most urgent: food sickness first, then drunk (60%+), then the lowest need.</p><div id="hpQueue"></div><div class="hp-actions"><button type="button" id="hpEnd" class="hp-soft">End my shift</button></div>');
 $('hpEnd').onclick=async()=>{clearTimeout(queueTimer);try{await staffApi({action:'shift_end'})}catch{}$('activityDialog')?.close()};paintQueue(d)}
function paintQueue(d){const box=$('hpQueue');if(!box)return;const key=d.queue.map(p=>p.id).join(',');
 if(key!==queueKey){queueKey=key;box.innerHTML=d.queue.length?d.queue.map(p=>'<div class="hp-card hp-patient"><p><b>'+esc(p.name)+'</b> <small>waiting '+Math.max(1,Math.round((Date.now()/1000-p.waitingSince)/60))+' min</small></p><p class="hp-chart">'+chartText(p.chart)+'</p><div class="hp-choices">'+p.options.map(([k,l])=>'<button type="button" data-hp-treat="'+p.id+':'+k+'">'+esc(l)+'</button>').join('')+'</div></div>').join(''):'<div class="hp-card"><p>No patients right now. Stay on this screen: new patients appear here.</p></div>';
  box.querySelectorAll('[data-hp-treat]').forEach(b=>b.onclick=()=>treat(...b.dataset.hpTreat.split(':')))}
 clearTimeout(queueTimer);if(d.me.onShift)queueTimer=setTimeout(async()=>{if(!$('hpQueue'))return;try{paintQueue(await staffApi())}catch{}},5000)}
async function treat(id,k){const g=G();lockTreat(true);let r;try{r=await staffApi({action:'treat',id:Number(id),treatment:k})}catch(e){lockTreat(false);g.toast?.(e.message||'Could not treat this patient.');try{paintQueue(await staffApi())}catch{}return}
 g.applyServerTotals?.(r);g.save?.();g.refresh?.();const x=r.result;g.toast?.(x.correct?'✅ Right treatment · +'+(x.paid?'¥'+x.paid+' · +':'')+x.xp+' XP':'❌ Not quite: '+x.label+' needed '+x.right+' · +'+x.xp+' XP');queueKey='';try{paintQueue(await staffApi())}catch{}}
const lockTreat=on=>document.querySelectorAll('[data-hp-treat]').forEach(b=>b.disabled=on);
// The Health worker test (nurses): 8 questions marked on the server, 7 right to pass.
async function healthTest(){const g=G();let t;try{t=await staffApi({action:'test_start'})}catch(e){return g.toast?.(e.message||'The test is not available.')}
 const q=t.questions,answers=[];let i=0;
 const ask=()=>{const x=q[i];show('📝 Health worker test','Question '+(i+1)+' of '+q.length+' · '+t.pass+' right to pass',
  '<div class="hp-card"><p class="hp-q">'+esc(x.prompt)+'</p>'+(x.pinyin?'<p class="hp-py">'+esc(x.pinyin)+'</p>':'')+'</div><div class="hp-choices">'+x.options.map((o,n)=>'<button type="button" data-hp-a="'+n+'">'+esc(o)+'</button>').join('')+'</div>');
  document.querySelectorAll('[data-hp-a]').forEach(b=>b.onclick=()=>{answers.push(x.options[Number(b.dataset.hpA)]);i++;i<q.length?ask():submit()})};
 const submit=async()=>{let r;try{r=await staffApi({action:'test_submit',answers})}catch(e){return g.toast?.(e.message||'The test could not be marked.')}
  show(r.passed?'🎉 You’re a nurse':'📝 Not this time',r.right+'/'+r.total+' right'+(r.passed?' · Health worker certificate':' · try again tomorrow'),
   '<ol class="hp-list hp-marked">'+q.map((x,n)=>'<li class="'+(answers[n]===r.answers[n]?'ok':'')+'"><span>'+(answers[n]===r.answers[n]?'✅':'❌')+'</span><b>'+esc(x.prompt)+'</b><small>'+esc(r.answers[n])+'</small></li>').join('')+'</ol><div class="hp-actions">'+(r.passed?'<button type="button" id="hpGoWork">🩺 Start working</button>':'')+'<button type="button" id="hpDone3" class="hp-soft">Done</button></div>');
  if($('hpGoWork'))$('hpGoWork').onclick=work;$('hpDone3').onclick=()=>$('activityDialog')?.close()};
 ask()}
// After a reload, pick up a visit that is still waiting (or was treated while you were away).
setTimeout(()=>{if(staffOn()&&signed())staffApi().then(d=>{if(d?.patient){waiting=true;pollPatient()}}).catch(()=>{})},9000);
// Hospital Phase 4 (switch hospital_visits): friends recovering on the ward (hospital-visits.php). Visit from the
// hospital with a card, flowers or fruit; the patient's game collects visits and applies the gift here.
const wardApi=body=>window.ChinaLifeAuth.request('/chinalife/hospital-visits.php',body?'POST':'GET',body).then(r=>r?.data||r);
const GIFT={card:{social:10},flowers:{fun:15,social:20},fruit:{hunger:15,social:15}};
async function ward(){const g=G();if(!signed())return g.toast?.('Sign in to visit your friends.');let d;try{d=await wardApi()}catch(e){return g.toast?.(e.message||'The ward is closed to visitors right now.')}
 show('💐 The ward','Friends recovering here (for '+d.hours+' hours after a hospital visit). Visit each one once a day.',
  d.ward.length?'<ul class="hp-list hp-meds">'+d.ward.map(f=>'<li><span>🛏️</span><b>'+esc(f.name)+'</b><small>On the ward until '+clock(f.until*1000)+'</small><div class="hp-med-btns"><button type="button" data-hp-visit="'+f.id+'"'+(f.visited?' disabled':'')+'>'+(f.visited?'Visited today':'Visit')+'</button></div></li>').join('')+'</ul>':'<div class="hp-card"><p>None of your friends are on the ward right now. That’s good news!</p></div>');
 document.querySelectorAll('[data-hp-visit]').forEach(b=>b.onclick=()=>visit(d,d.ward.find(f=>f.id===Number(b.dataset.hpVisit))))}
function visit(d,f){const g=G();let gift=null;
 const pickGift=()=>{show('💐 Visit '+f.name,'Bring something','<div class="hp-choices">'+Object.entries(d.gifts).map(([k,[price,name,does]])=>'<button type="button" data-hp-gift="'+k+'">'+esc(name)+' · '+(price?'¥'+price:'free')+'<br><small>'+esc(does)+'</small></button>').join('')+'</div>');
  document.querySelectorAll('[data-hp-gift]').forEach(b=>b.onclick=()=>{gift=b.dataset.hpGift;pickCard()})};
 const pickCard=()=>{show('💌 A card for '+f.name,'Choose what to write','<div class="hp-choices">'+Object.entries(d.cards).map(([k,t])=>'<button type="button" data-hp-card="'+k+'">'+esc(t)+'</button>').join('')+'</div>');
  document.querySelectorAll('[data-hp-card]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const r=await wardApi({action:'visit',to:f.id,gift,card:b.dataset.hpCard});g.applyServerTotals?.(r);g.state.needs.social=Math.min(100,(g.state.needs.social??0)+10);
   g.state.logs?.unshift('Visited '+f.name+' on the ward.');g.save?.();g.refresh?.();g.toast?.('💐 You visited '+f.name+(r.visited.paid?' · −¥'+r.visited.paid:'')+' · +'+r.visited.xp+' XP');ward()}catch(e){b.disabled=false;g.toast?.(e.message||'Could not visit right now.')}})};
 pickGift()}
// Visits waiting for you: the gift's effect is applied once, and a banner says who came.
let collecting=false;
async function collectVisits(){if(collecting||!visitsOn()||!signed())return;collecting=true;try{const d=await wardApi();if(!d?.waiting)return;const r=await wardApi({action:'collect'}),g=G(),s=g.state;
 for(const v of r.visits){for(const [k,n] of Object.entries(GIFT[v.gift]||{}))s.needs[k]=Math.min(100,(s.needs[k]??0)+n);s.logs?.unshift(v.from+' visited you on the ward: '+v.card)}
 if(!r.visits.length)return;g.save?.();g.refresh?.();const v=r.visits[0];
 const open=()=>show('💐 Visitors on the ward','Your friends came to see you','<ul class="hp-list hp-meds">'+r.visits.map(v=>'<li><span>'+(v.gift==='flowers'?'💐':v.gift==='fruit'?'🍎':'💌')+'</span><b>'+esc(v.from)+'</b><small>'+esc(v.giftName)+' · '+esc(v.card)+'</small></li>').join('')+'</ul>');
 g.notify?g.notify('💐 '+v.from+(r.visits.length>1?' and '+(r.visits.length-1)+' more':'')+' visited you on the ward',open):open()}catch{}finally{collecting=false}}
setTimeout(collectVisits,9500);setInterval(collectVisits,180000);
window.ChinaLifeHospital={on,wake,health,checkup,pharmacy,vitamins,askStaff,work,healthTest,ward,collectVisits,STORY,FIX};
const css=document.createElement('style');css.textContent='.hp-card{padding:14px 16px;border-radius:18px;background:#f3fbf8;border:1px solid #d6ebe5}.hp-card p{margin:0 0 8px}.hp-bill{font-weight:700}.hp-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.hp-actions button{min-height:44px;padding:0 16px;border:0;border-radius:22px;background:#1F8E93;color:#fff;font-weight:700}.hp-actions .hp-soft{background:#fff;color:#0C3F44;border:1px solid #cfe3dd}'+
 '.hp-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.hp-list li{display:grid;grid-template-columns:32px 1fr;gap:2px 8px;padding:10px 12px;border-radius:14px;background:#fff4f1;border:1px solid #ffd6cc}.hp-list span{grid-row:span 2;font-size:22px}.hp-list small{color:#43666b}.hp-list li.ok{background:#f3fbf8;border-color:#d6ebe5}.hp-q{font-size:20px;font-weight:700}.hp-py{color:#43666b}.hp-choices{display:grid;gap:8px;margin-top:12px}.hp-choices button{min-height:48px;padding:10px 14px;border-radius:14px;border:1px solid #cfe3dd;background:#fff;font-weight:700;text-align:left}.hp-note{color:#43666b;margin:12px 0 0}.hp-meds li{background:#fff;border-color:#d6ebe5}.hp-med-btns{grid-column:2;display:flex;gap:8px;margin-top:6px}.hp-med-btns button{min-height:40px;padding:0 14px;border:0;border-radius:20px;background:#1F8E93;color:#fff;font-weight:700}.hp-med-btns .hp-soft{background:#fff;color:#0C3F44;border:1px solid #cfe3dd}.hp-med-btns button:disabled{opacity:.45}.hp-patient{margin-bottom:10px}.hp-patient small{color:#43666b;font-weight:400}.hp-chart{display:flex;flex-wrap:wrap;gap:6px}.hp-chart i{font-style:normal;font-size:13px;padding:3px 8px;border-radius:10px;background:#fff;border:1px solid #d6ebe5}.hp-chart .hp-hot{background:#fff4f1;border-color:#ffb8a6;font-weight:700}.hp-choices small{font-weight:400;color:#43666b}';document.head?.append(css);
})();
