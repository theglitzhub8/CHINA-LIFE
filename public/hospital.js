// Hospital Phase 0 (docs/HOSPITAL-PLAN.md, appadmin switch hospital_care, default OFF). Fainting (game.js faint) and a
// drinking blackout (game.js blackout) take you to the City Hospital by ambulance: you wake up on the ward, a nurse
// tells you what happened, and the bill (¥200, your first visit free) is charged on the server (economy.php
// action 'hospital'). "🩺 Your health" (the hospital's place bar) shows what is wrong right now and how to fix it.
// Game interpretation, never medical advice.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('hospital_care')===true,checkOn=()=>on()&&window.ChinaLifeFlags?.cast?.('hospital_checkup')===true,pharmOn=()=>on()&&window.ChinaLifeFlags?.cast?.('hospital_pharmacy')===true;
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
  ((checkOn()&&here)||pharmOn()?'<div class="hp-actions">'+(checkOn()&&here?'<button type="button" id="hpCheck">👩‍⚕️ Free weekly check-up</button>':'')+(pharmOn()?'<button type="button" id="hpPharm">💊 '+(here?'Pharmacy':'Your medicine')+'</button>':'')+'</div>':''));
 const b=$('hpCheck');if(b)b.onclick=checkup;const m=$('hpPharm');if(m)m.onclick=pharmacy}
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
window.ChinaLifeHospital={on,wake,health,checkup,pharmacy,vitamins,STORY,FIX};
const css=document.createElement('style');css.textContent='.hp-card{padding:14px 16px;border-radius:18px;background:#f3fbf8;border:1px solid #d6ebe5}.hp-card p{margin:0 0 8px}.hp-bill{font-weight:700}.hp-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.hp-actions button{min-height:44px;padding:0 16px;border:0;border-radius:22px;background:#1F8E93;color:#fff;font-weight:700}.hp-actions .hp-soft{background:#fff;color:#0C3F44;border:1px solid #cfe3dd}'+
 '.hp-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.hp-list li{display:grid;grid-template-columns:32px 1fr;gap:2px 8px;padding:10px 12px;border-radius:14px;background:#fff4f1;border:1px solid #ffd6cc}.hp-list span{grid-row:span 2;font-size:22px}.hp-list small{color:#43666b}.hp-list li.ok{background:#f3fbf8;border-color:#d6ebe5}.hp-q{font-size:20px;font-weight:700}.hp-py{color:#43666b}.hp-choices{display:grid;gap:8px;margin-top:12px}.hp-choices button{min-height:48px;padding:10px 14px;border-radius:14px;border:1px solid #cfe3dd;background:#fff;font-weight:700;text-align:left}.hp-note{color:#43666b;margin:12px 0 0}.hp-meds li{background:#fff;border-color:#d6ebe5}.hp-med-btns{grid-column:2;display:flex;gap:8px;margin-top:6px}.hp-med-btns button{min-height:40px;padding:0 14px;border:0;border-radius:20px;background:#1F8E93;color:#fff;font-weight:700}.hp-med-btns .hp-soft{background:#fff;color:#0C3F44;border:1px solid #cfe3dd}.hp-med-btns button:disabled{opacity:.45}';document.head?.append(css);
})();
