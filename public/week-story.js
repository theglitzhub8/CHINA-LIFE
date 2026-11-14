// Weekly story (docs/ROADMAP.md item 4, appadmin switch week_story, default ON). A 7-step story each week, one step a
// day (missed steps can be caught up later in the week), each a place and an action with one Go. Steps pay ¥50; step 7
// pays the ¥1,000 prize and a badge. chinalife-api/week-story.php counts every step on the server.
// Opens from the Today panel (tap the clock → 📖 the story's name) and ChinaLifeWeekStory.open().
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('week_story')!==false;
const signed=()=>!!window.ChinaLifeCloud?.signedIn&&!!window.ChinaLifeAuth?.request;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=(method='GET',body)=>window.ChinaLifeAuth.request('/chinalife/week-story.php',method,body).then(r=>r?.data||r);
// The story line for each step, by story id (same ids and order as WS_STORIES in week-story.php).
const LINES={
 exam:['The exam hall is at the University. Go and find it before the week gets busy.','Brush up your tones: take a Chinese class.','Books cost money. Work one shift.','Start a rumour about what is on the exam: drop a tip on the Gossip wall.','One more class before the big day.','Clear your head: play a football match.','Exam done! Celebrate with a night mission at the club.'],
 fitness:['Day one of training: work out at the gym.','Test your legs in a football match.','Get the all-clear from the City Hospital.','Back to the gym for round two.','Cheer on the city: react to 3 tips on the Gossip wall.','A practice match with the team.','Final session before the run: one last workout.'],
 star:['Introduce yourself at Hafrik HQ.','Get people talking: drop a tip on the Gossip wall.','Take the Hot Seat crowd’s side: vote on a round.','Be seen out: do a night mission at the club.','Reply to the buzz: react to 5 tips.','Pay City Hall a visit.','Your big night: one more night mission.'],
 nightowl:['Warm up for the party: a night mission at the club.','Catch up on the gossip: react to 3 tips.','A new outfit costs money. Work one shift.','Hear the latest on the Hot Seat: vote on a round.','Get the guest list from the Gossip Centre.','One more shift for the VIP table.','Party night! Finish with a night mission.'],
};
const KIND={class:['📘','Take a Chinese class'],shift:['💼','Work one shift'],mission:['🪩','Do a night mission'],match:['⚽','Play a football match'],gym:['🏋️','Work out at the gym'],
 tip:['🤫','Drop a gossip tip'],hotseat:['🔥','Vote on a Hot Seat round'],react:['😂','React to tips'],
 'visit:university':['🎓','Visit the University'],'visit:cityhospital':['🏥','Visit the City Hospital'],'visit:hq':['🏢','Visit Hafrik HQ'],'visit:voting':['🏛️','Visit City Hall'],'visit:gist':['🤫','Visit the Gossip Centre'],
 'visit:night':['🪩','Visit the Club'],'visit:football':['⚽','Visit the Football Pitch']};
const close=()=>{try{$('activityDialog')?.close()}catch{}};
const travel=id=>{close();const g=G();if(!g)return false;if(g.state?.place===id)return true;if(window.ChinaLifeWhereTo?.go)window.ChinaLifeWhereTo.go(id);else g.travel?.(id);return false};
function go(kind){const g=G(),T=window.ChinaLifeToday?.GO;
 if(kind.startsWith('visit:')){const p=kind.slice(6);if(travel(p))g?.toast?.('You’re here. Stay a little while and it counts.');return}
 if(kind==='class'){if(travel('university'))g?.toast?.('Pick Class on the bar at the bottom.');else g?.toast?.('Off to the University. Pick Class when you arrive.');return}
 if(kind==='shift')return (close(),g?.earn?.());
 if(kind==='gym'){if(travel('gym'))g?.toast?.('Pick a workout from the bar at the bottom.');return}
 if(T?.[kind])return T[kind]();
 if(kind==='react'||kind==='tip')return (close(),g?.gistNight?.());
 if(kind==='mission'){if(travel('night'))g?.toast?.('Night missions are on the club’s bottom bar.');return}
 if(kind==='match'){if(travel('football'))window.ChinaLifeFootball?.open?.();return}
 if(kind==='hotseat'){if(!travel('gist'))g?.toast?.('Off to the Gossip Centre. The Hot Seat is in the Room.')}}
const left=s=>{s=Math.max(0,Math.floor(+s||0));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?d+'d '+h+'h':h?h+'h '+m+'m':m+'m'};
const opensWord=s=>s<=0?'now':s<=86400?'tomorrow':'in '+Math.ceil(s/86400)+' days'; // steps open at Beijing midnight
let last=null,busy=false;
function words(s){const [icon,w]=KIND[s.kind]||['🎯',s.kind];return [icon,s.target>1?w+' ('+s.target+')':w]}
function paint(d){last=d;const box=$('wsBody');if(!box)return;
 if(d.soon){box.innerHTML='<div class="ws-top"><span class="ws-icon">'+d.story.icon+'</span><div><b>'+esc(d.story.title)+'</b><small>'+esc(d.story.blurb)+'</small></div></div><div class="ws-step"><small>STARTS MONDAY · IN '+esc(left(d.startsIn).toUpperCase())+'</small><p class="ws-line">A new 7-step story every week. One step a day, each a place and something to do there.</p><p class="ws-pay">🎁 ¥'+d.reward.coins+' a step · ¥'+d.prize.coins.toLocaleString()+' and a badge for all seven</p></div>';return}const id=d.story.id,cur=d.steps.find(s=>s.n===d.current);
 const path='<ol class="ws-path">'+d.steps.map(s=>'<li class="'+(s.claimed?'done':s.n===d.current?'now':'')+'" title="Step '+s.n+'"><span>'+(s.claimed?'✓':s.n===7?'🏆':s.n)+'</span></li>').join('')+'</ol>';
 let body;
 if(!cur)body='<div class="ws-step finished"><b>🏆 Story complete!</b><p>You finished '+esc(d.story.title)+' and won the '+'¥'+d.prize.coins.toLocaleString()+' prize and a badge. A new story starts on Monday.</p></div>';
 else{const [icon,w]=words(cur),line=(LINES[id]||[])[cur.n-1]||'',open=cur.opensIn<=0,last7=cur.n===7;
  body='<div class="ws-step'+(cur.ready?' ready':'')+'"><small>STEP '+cur.n+' OF 7'+(open?'':' · OPENS '+esc(opensWord(cur.opensIn).toUpperCase()))+'</small><p class="ws-line">'+esc(line)+'</p>'+
   '<div class="ws-do"><span>'+icon+'</span><b>'+esc(w)+'</b>'+(cur.target>1&&open?'<em>'+cur.count+' / '+cur.target+'</em>':'')+'</div>'+
   '<p class="ws-pay">🎁 ¥'+d.reward.coins+' + '+d.reward.xp+' XP'+(last7?' · plus the ¥'+d.prize.coins.toLocaleString()+' prize and a badge':'')+'</p>'+
   (!open?'<p class="ws-wait">Come back '+esc(opensWord(cur.opensIn))+' for the next part of the story.</p>':cur.ready?'<button type="button" class="ws-btn claim" id="wsClaim">Claim ¥'+(d.reward.coins+(last7?d.prize.coins:0)).toLocaleString()+'</button>':'<button type="button" class="ws-btn" id="wsGo">Go</button>')+'</div>'}
 box.innerHTML='<div class="ws-top"><span class="ws-icon">'+d.story.icon+'</span><div><b>'+esc(d.story.title)+'</b><small>'+esc(d.story.blurb)+'</small></div></div>'+path+body+
  '<p class="ws-foot">One step a day; missed steps can be caught up. New story in '+left(d.endsIn)+'. Steps: '+d.done+' of 7 done.</p>';
 if($('wsGo'))$('wsGo').onclick=()=>go(cur.kind);
 if($('wsClaim'))$('wsClaim').onclick=claim}
async function claim(){if(busy)return;busy=true;const b=$('wsClaim');if(b){b.disabled=true;b.textContent='Claiming…'}
 try{const r=await api('POST',{op:'claim'});const g=G();if(r?.money!=null){g?.applyServerTotals?.(r);g?.save?.();g?.refresh?.()}
  paint(r);if(r.finished){window.ChinaLifeCelebrate?.('🏆','Story complete! +¥'+(r.awarded||0).toLocaleString());g?.toast?.('🏆 '+r.story.title+' complete! +¥'+(r.awarded||0).toLocaleString())}else g?.toast?.('✓ Step done · +¥'+(r.awarded||0))}
 catch(e){G()?.toast?.(e?.message||'Try again in a moment.');if(b){b.disabled=false;b.textContent='Claim'}}finally{busy=false}}
async function peek(){if(!on()||!signed())return null;try{const d=await api();if(d?.steps||d?.soon){last=d;if($('wsBody'))paint(d)}return d}catch{return null}}
async function open(){const g=G();if(!on()||!g?.showScreen)return;
 g.showScreen('📖 Weekly story','A new story every week. One step a day.','<div class="ws" id="wsBody">'+(signed()?'<p class="ws-foot">Getting this week’s story…</p>':'<p class="ws-foot">Log in with Hafrik to play the weekly story.</p><button type="button" class="ws-btn" id="wsLogin">Log in</button>')+'</div>');
 if($('wsLogin'))$('wsLogin').onclick=()=>window.ChinaLifeCloud?.open?.();
 if(last)paint(last);await peek()}
// A short line for the Today panel.
function summary(){const d=last;if(d?.soon)return {hot:false,text:'Starts Monday · ¥1,000 prize'};if(!d?.steps)return null;const cur=d.steps.find(s=>s.n===d.current);
 if(!cur)return {hot:false,text:'Complete ✓ · new story Monday'};
 return {hot:!!cur.ready,text:cur.ready?'Step '+cur.n+' done · claim ¥'+d.reward.coins:cur.opensIn>0?'Step '+cur.n+' opens '+opensWord(cur.opensIn):'Step '+cur.n+' of 7 · '+words(cur)[1]}}
window.ChinaLifeWeekStory={open,on,peek,summary,LINES,KIND,get last(){return last}};
const css=document.createElement('style');css.textContent=
 '.ws{display:grid;gap:14px;color:#0C3F44}.ws-top{display:flex;gap:12px;align-items:center}.ws-icon{width:52px;height:52px;flex:none;border-radius:16px;display:grid;place-items:center;font-size:28px;background:linear-gradient(150deg,#fff1c7,#ffe2a8)}'+
 '.ws-top b{display:block;font-size:19px}.ws-top small{display:block;font-size:13px;color:#587675;line-height:1.35}'+
 '.ws-path{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(7,1fr);position:relative}.ws-path::before{content:"";position:absolute;left:7%;right:7%;top:50%;height:3px;background:#dfe9e7;border-radius:2px}'+
 '.ws-path li{display:grid;place-items:center;position:relative}.ws-path span{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#fff;border:2px solid #dfe9e7;font-size:13px;font-weight:900;color:#8aa3a1}'+
 '.ws-path li.done span{background:#16a37f;border-color:#16a37f;color:#fff}.ws-path li.now span{border-color:#f2b33d;color:#9a5a00;box-shadow:0 0 0 4px #f2b33d33;transform:scale(1.12)}'+
 '.ws-step{padding:14px;border-radius:20px;background:#fff;border:1.5px solid #e3ecea;box-shadow:0 2px 10px #06232612}.ws-step.ready{border-color:#f2b33d}.ws-step small{font-size:11px;font-weight:900;letter-spacing:.07em;color:#587675}'+
 '.ws-line{margin:6px 0 10px;font-size:15px;line-height:1.4;font-style:italic;color:#2d5654}.ws-do{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:#f1f6f5}.ws-do span{font-size:20px}.ws-do b{flex:1;font-size:15px}.ws-do em{font-style:normal;font-weight:900;color:#16a37f}'+
 '.ws-pay{margin:10px 0 0;font-size:13px;color:#2d5654}.ws-wait{margin:10px 0 0;font-size:13px;font-weight:700;color:#9a5a00}'+
 '.ws-btn{display:block;width:100%;margin-top:12px;min-height:46px;border:0;border-radius:23px;background:#0C3F44;color:#fff;font:inherit;font-size:15px;font-weight:900;cursor:pointer}.ws-btn.claim{background:#f2b33d;color:#3a2600}'+
 '.ws-step.finished b{font-size:17px}.ws-step.finished p{margin:6px 0 0;font-size:14px;color:#2d5654}.ws-foot{margin:0;font-size:12px;color:#587675;text-align:center}'+
 '@media (prefers-reduced-motion:reduce){.ws-path li.now span{transform:none}}';document.head?.append(css);
})();
