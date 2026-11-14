// Today's Three (docs/TODAY-PLAN.md Phase 1, appadmin switch todays_three, default ON). One screen for what to do
// today: three tasks a Beijing day, one per group (💴 Hustle, 🏙 Life, 💬 Link-up), each with how long it takes, what it
// already pays and one Go; one free swap a day (↻); all three done pays a Daily Bonus (chinalife-api/today.php checks
// every task on the server). The daily streak sits on top. Opens from the ⏱ Today chip and the phone's Tasks app.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('todays_three')!==false;
const signed=()=>!!window.ChinaLifeCloud?.signedIn&&!!window.ChinaLifeAuth?.request;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=(method='GET',body)=>window.ChinaLifeAuth.request('/chinalife/today.php',method,body).then(r=>r?.data||r);
const GROUPS={hustle:['💴','Hustle'],life:['🏙','Life'],linkup:['💬','Link-up']};
// key => [icon, words, minutes, reward line]
const TASKS={
 shift:['💼','Work one shift at your job',5,'Your job’s pay'],
 mission:['🪩','Do a night mission at a club',5,'Club XP'],
 match:['⚽','Play a football match',4,'Counts for the ¥300 challenge'],
 places:['🗺','Visit 3 places',6,'+¥20 each'],
 gym:['🏋️','Work out at the gym',3,'Trains Fitness'],
 tip:['🤫','Drop a tip on the Gossip wall',2,'+¥100 in the Gossip Centre'],
 hotseat:['🔥','Vote on a Hot Seat round',2,'+¥100 in the Gossip Centre'],
 react:['😂','React to 5 tips on the wall',2,'+¥100 in the Gossip Centre'],
};
let last=null,opened=0,busy=false;
const close=()=>{try{$('activityDialog')?.close()}catch{}};
const travel=id=>{close();const g=G();if(!g)return;if(g.state?.place===id)return true;if(window.ChinaLifeWhereTo?.go)window.ChinaLifeWhereTo.go(id);else g.travel?.(id);return false};
const GO={
 shift:()=>{close();G()?.earn?.()},
 mission:()=>{if(travel('night'))G()?.toast?.('Night missions are on the club’s bottom bar.')},
 match:()=>{if(travel('football'))window.ChinaLifeFootball?.open?.();else G()?.toast?.('Off to the pitch. Tap ⚡ Play when you arrive.')},
 gym:()=>{if(travel('gym'))G()?.toast?.('Pick a workout from the gym’s list.');else G()?.toast?.('Off to the gym. Do one workout there.')},
 places:()=>{close();if(window.ChinaLifeWhereTo?.show)window.ChinaLifeWhereTo.show();else G()?.toast?.('Open the map and pick a place.')},
 tip:()=>{close();G()?.gistNight?.()},
 react:()=>{close();G()?.gistNight?.()},
 hotseat:()=>{const H=window.ChinaLifeHotSeat;if(G()?.state?.place==='gist'&&H?.enabled?.()){close();return H.open()}if(!travel('gist'))G()?.toast?.('Off to the Gossip Centre. The Hot Seat is in the Room.')},
};
const left=s=>{s=Math.max(0,Math.floor(+s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+'h '+m+'m':m+'m'};
function streakRow(){const g=G(),s=g?.state;if(!s)return '';const ready=!!g.rankInfo?.()?.daily,n=window.ChinaLifeEnergy?.streakNext?.(s)??((s.streak||0)+1);
 return '<button type="button" class="td-streak" data-td="streak"><span>🔥</span><div><b>'+(ready?'Day '+n+' streak reward is ready':(s.streak||0)+'-day streak')+'</b><small>'+(ready?'Claim +¥'+50*Math.min(n,7)+' before midnight':'Come back tomorrow to keep it going')+'</small></div><em>'+(ready?'Claim':'✓')+'</em></button>'}
function card(t,swapLeft){const [icon,words,min,reward]=TASKS[t.key]||['🎯',t.key,3,''],[gi,gn]=GROUPS[t.group]||['🎯',t.group],pct=Math.round(100*t.count/t.target);
 return '<article class="td-task'+(t.done?' done':'')+'" data-group="'+esc(t.group)+'"><span class="td-icon">'+icon+'</span><div class="td-body"><small class="td-tag">'+gi+' '+esc(gn.toUpperCase())+'</small><b>'+esc(words)+'</b>'+
  '<span class="td-meta">about '+min+' min · '+esc(reward)+'</span>'+(t.target>1?'<span class="td-bar"><i style="width:'+pct+'%"></i></span><small class="td-count">'+t.count+' / '+t.target+'</small>':'')+'</div>'+
  '<div class="td-side">'+(t.done?'<span class="td-done">✓</span>':'<button type="button" class="td-go" data-go="'+esc(t.key)+'">Go</button>'+(swapLeft?'<button type="button" class="td-swap" data-swap="'+esc(t.group)+'" aria-label="Swap this task">↻</button>':''))+'</div></article>'}
function paint(d){last=d;const box=$('tdBody');if(!box)return;const done=d.tasks.filter(t=>t.done).length,all=done===d.tasks.length,b=d.bonus;
 box.innerHTML='<div class="td-top"><div class="td-ring" style="--p:'+Math.round(100*done/d.tasks.length)+'"><b>'+done+'/'+d.tasks.length+'</b></div><div><b>Today’s Three</b><small>New tasks in '+left(d.endsIn)+'</small></div></div>'+streakRow()+
  d.tasks.map(t=>card(t,!d.swapped)).join('')+(!d.swapped&&!all?'<p class="td-note">↻ One free swap a day: swap a task you don’t fancy.</p>':'')+
  '<section class="td-bonus'+(all&&!b.claimed?' ready':'')+(b.claimed?' claimed':'')+'"><span>🎁</span><div><b>'+(b.claimed?'Daily Bonus collected':'Daily Bonus')+'</b><small>'+(b.claimed?'Come back tomorrow for three new tasks.':'Do all three · +¥'+b.coins+' · +'+b.xp+' XP')+'</small></div>'+(all&&!b.claimed?'<button type="button" data-td="bonus">Collect</button>':b.claimed?'<em>✓</em>':'<em>'+done+'/3</em>')+'</section>'+
  (window.ChinaLifeWeekly?'<button type="button" class="td-link" data-td="weekly">📅 Weekly activities ›</button>':'');
 box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>GO[b.dataset.go]?.());
 box.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>swap(b.dataset.swap));
 box.querySelector('[data-td="bonus"]')?.addEventListener('click',bonus);
 box.querySelector('[data-td="weekly"]')?.addEventListener('click',()=>window.ChinaLifeWeekly.open('tasks'));
 box.querySelector('[data-td="streak"]')?.addEventListener('click',()=>{if(G()?.rankInfo?.()?.daily){close();window.ChinaLifeEnergy?.welcome?.(true)||G()?.claimDaily?.()}});
}
async function swap(group){if(busy)return;busy=true;try{paint(await api('POST',{op:'swap',group}));G()?.toast?.('↻ New task. That was today’s free swap.')}catch(e){G()?.toast?.(e.message||'Could not swap right now')}finally{busy=false}}
async function bonus(){if(busy)return;busy=true;try{const d=await api('POST',{op:'bonus'});G()?.applyServerTotals?.(d);try{G()?.save?.();G()?.refresh?.()}catch{}paint(d);
 if(!d.duplicate)(window.ChinaLifeCelebrate||(()=>{}))('🎁 Daily Bonus!','+¥'+d.bonus.coins+' · +'+d.bonus.xp+' XP · all three done')}catch(e){G()?.toast?.(e.message||'Could not collect right now')}finally{busy=false}}
async function open(){const g=G();if(!g?.showScreen)return;const mine=++opened;
 g.showScreen('🎯 Today','Three things to do today, and a bonus for all three.','<div class="td" id="tdBody">'+(signed()?'<p class="td-muted">Getting today’s tasks…</p>':'<p class="td-muted">Log in with Hafrik to get Today’s Three: three daily tasks and a ¥300 bonus.</p><button type="button" class="td-go wide" id="tdLogin">Log in</button>')+'</div>');
 const c=$('activityContent');if(c)c.scrollTop=0;
 if(!signed()){$('tdLogin')?.addEventListener('click',()=>{close();window.ChinaLifeCloud?.open?.()});return}
 try{const d=await api();if(mine===opened)paint(d)}catch(e){if(mine===opened&&$('tdBody'))$('tdBody').innerHTML='<p class="td-muted">'+esc(e.message||'Today’s tasks are not available right now.')+'</p>'}}
async function peek(){if(!on()||!signed())return null;try{return last=await api()}catch{return null}}
// The gym: a workout happens on this phone, so it tells the server when you arrive and when a workout is done there;
// today.php counts it after a minute at the gym (or straight away when the shared city shows you at the gym).
const gym={day:'',arrived:false,acts:null,sent:false,next:0};
async function gymTick(){const s=G()?.state;if(!on()||!signed()||!s?.created)return;const day=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
 if(gym.day!==day)Object.assign(gym,{day,arrived:false,acts:null,sent:false,next:0});if(gym.sent)return;
 if(s.place!=='gym'){gym.acts=null;return}const acts=+(s.stats?.activities||0);
 if(gym.acts===null){gym.acts=acts;if(!gym.arrived){gym.arrived=true;api('POST',{op:'gym-arrive'}).catch(()=>{gym.arrived=false})}return}
 if(acts<=gym.acts||Date.now()<gym.next)return;gym.next=Date.now()+15000;
 try{const d=await api('POST',{op:'workout'});gym.sent=true;last=d;G()?.toast?.('🏋️ Workout counted for Today’s Three');window.ChinaLifeTodayPanel?.pill?.()}catch(e){if(!/longer|first/i.test(e.message||''))gym.sent=true}}
setInterval(gymTick,3000);
// Phase 3 (switch today_next, default ON): the "Next step" chip (r3.js) shows the next unfinished task with Go, then the
// bonus when all three are done. Null when there is nothing to say, so the chip falls back to its usual hints.
const ICON={shift:'hand',mission:'party',match:'play',places:'map',gym:'jump',tip:'chat',hotseat:'hype',react:'smile'};
function next(){if(!on()||window.ChinaLifeFlags?.cast?.('today_next')===false||!signed()||!last?.tasks)return null;const b=last.bonus||{};
 const todo=last.tasks.find(t=>!t.done);
 if(!todo)return b.claimed?null:{icon:'gift',text:'Daily Bonus ready · +¥'+(b.coins||300),go:open};
 const [,words,,reward]=TASKS[todo.key]||[];if(!words)return null;const money=/\+¥\d+/.exec(reward||'')?.[0];
 return {icon:ICON[todo.key]||'nav',text:words+(todo.target>1?' ('+todo.count+'/'+todo.target+')':'')+(money?' · '+money:''),go:()=>GO[todo.key]?.()}}
window.addEventListener('chinalife:cloudready',()=>{if(!last)peek()});
window.ChinaLifeToday={open,on,peek,next,get last(){return last},TASKS,GROUPS,gymTick,_gym:gym};
const css=document.createElement('style');css.textContent=
 '.td{display:grid;gap:10px;padding-bottom:16px}.td-muted{color:#587675;font-size:14px}'+
 '.td-top{display:flex;align-items:center;gap:12px;padding:4px 2px}.td-top b{display:block;font-size:17px;color:#0C3F44}.td-top small{color:#587675;font-weight:700;font-size:12px}'+
 '.td-ring{--p:0;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#16a37f calc(var(--p)*1%),#e3efec 0);flex:none}.td-ring b{width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:14px!important}'+
 '.td-streak,.td-bonus{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px 14px;border-radius:18px;border:1px solid #f6d7b0;background:linear-gradient(135deg,#fff7ec,#fff)}.td-streak>span,.td-bonus>span{font-size:24px}.td-streak div,.td-bonus div{flex:1;min-width:0}'+
 '.td-streak b,.td-bonus b{display:block;font-size:14px;color:#3a2600}.td-streak small,.td-bonus small{color:#8a6a3a;font-size:12px;font-weight:600}.td-streak em,.td-bonus em{font-style:normal;font-weight:800;color:#c2410c}'+
 '.td-task{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:12px;border-radius:18px;background:#fff;border:1px solid #dcebe7;box-shadow:0 2px 8px #0c3f440d}'+
 '.td-task.done{background:#f1fbf6;border-color:#bfe8d3}.td-task.done b{color:#587675}.td-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:#eef6f4}'+
 '.td-task[data-group=hustle] .td-icon{background:#fff3d6}.td-task[data-group=life] .td-icon{background:#e3f1ff}.td-task[data-group=linkup] .td-icon{background:#fde8f3}'+
 '.td-body{min-width:0;display:grid;gap:2px}.td-tag{font-size:10px;font-weight:800;letter-spacing:.06em;color:#16a37f}.td-body b{font-size:15px;color:#0C3F44}.td-meta{font-size:12px;color:#587675}'+
 '.td-bar{display:block;height:6px;border-radius:3px;background:#e3efec;overflow:hidden;margin-top:4px}.td-bar i{display:block;height:100%;background:linear-gradient(90deg,#16a37f,#4ade80)}.td-count{font-size:11px;color:#587675;font-weight:700}'+
 '.td-side{display:grid;gap:6px;justify-items:center}.td-go{min-height:38px;min-width:58px;padding:0 16px;border:0;border-radius:19px;background:#0C3F44;color:#fff;font-weight:800}.td-go.wide{width:100%;margin-top:6px}'+
 '.td-swap{width:30px;height:30px;border-radius:50%;border:1px solid #dcebe7;background:#fff;color:#587675;font-size:15px}.td-done{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#16a37f;color:#fff;font-weight:900}'+
 '.td-note{margin:0;font-size:12px;color:#587675;text-align:center}'+
 '.td-bonus.ready{border-color:#f2b33d;background:linear-gradient(135deg,#fff1c7,#fff8e6);box-shadow:0 0 0 3px #f2b33d33}.td-bonus.claimed{opacity:.75}'+
 '.td-bonus button{min-height:40px;padding:0 18px;border:0;border-radius:20px;background:#f2b33d;color:#3a2600;font-weight:900;animation:tdPop 1.4s ease-in-out infinite}@keyframes tdPop{50%{transform:scale(1.07)}}'+
 '.td-link{border:0;background:none;color:#0C3F44;font-weight:700;padding:8px;justify-self:center}'+
 '@media (prefers-reduced-motion:reduce){.td-bonus button{animation:none}}';document.head?.append(css);
})();
