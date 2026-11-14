// Today panel (docs/TODAY-PLAN.md Phase 2, appadmin switch today_panel, default ON). Tap the clock in the top bar, or the
// small 🎯 0/3 pill beside it, and one card drops down with everything for today in one list: Today's Three, streak and
// rank, notifications, messages, players online, mood and needs, wallet, and switches for music and a clean screen.
// Each row opens the screen the game already has. The approved top bar is not restyled: only the pill is added, and
// it sits in the empty space at the right of the clock line.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife;
const on=()=>window.ChinaLifeFlags?.cast?.('today_panel')!==false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=()=>window.ChinaLifeToday;
const done=d=>d?d.tasks.filter(t=>t.done).length:null;
function pill(){if(!on()){$('todayPill')?.remove();return}const chip=document.querySelector('#worldUI .hud-bar .time-chip');if(!chip)return;
 let p=$('todayPill');if(!p){p=document.createElement('button');p.type='button';p.id='todayPill';p.className='tdp-pill';p.setAttribute('aria-label','Open today');p.onclick=e=>{e.stopPropagation();open()};chip.appendChild(p);
  $('worldClock')?.addEventListener('click',e=>{if(on()){e.stopPropagation();open()}});$('worldClock')?.classList.add('tdp-tap')}
 const d=T()?.last,n=done(d),all=d&&n===d.tasks.length,ready=all&&!d.bonus.claimed;
 p.innerHTML='<span>🎯</span>'+(d?'<b>'+(d.bonus.claimed?'✓':n+'/'+d.tasks.length)+'</b>':'');p.classList.toggle('ready',!!ready||!!G()?.rankInfo?.()?.daily);fit()}
// Never cover the clock: on narrow phones the pill moves to the city line, then shows the icon alone.
function fit(){const p=$('todayPill'),chip=p?.parentElement;if(!p||!chip)return;p.classList.remove('low','tiny');p.hidden=false;$('worldClock')?.classList.remove('tdp-dot');
 const room=(el,row)=>{const r=el?.getBoundingClientRect();return r&&r.width?chip.getBoundingClientRect().right-6-r.right:999};
 if(room($('worldClock'))>=p.offsetWidth+6)return;p.classList.add('low');if(room($('worldCity'))>=p.offsetWidth+6)return;p.classList.add('tiny');if(room($('worldCity'))>=p.offsetWidth+4)return;
 // No room at all: the clock itself opens the panel; a gold dot says something is waiting.
 p.hidden=true;$('worldClock')?.classList.toggle('tdp-dot',p.classList.contains('ready'))}
window.addEventListener('resize',()=>fit());
async function refresh(){if(!on())return pill();if(T()?.on?.())await T().peek();pill();if($('tdpCard'))paint()}
function row(id,icon,title,sub,{tail='›',hot=false}={}){return '<button type="button" class="tdp-row'+(hot?' hot':'')+'" data-tdp="'+id+'"><span class="tdp-i">'+icon+'</span><span class="tdp-t"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></span><span class="tdp-tail">'+tail+'</span></button>'}
const sw=on=>'<i class="tdp-sw'+(on?' on':'')+'"><i></i></i>';
function paint(){const card=$('tdpCard');if(!card)return;const g=G(),s=g?.state||{},r=g?.rankInfo?.()||{},d=T()?.last,n=done(d),M=window.ChinaLifeMusic,S=window.ChinaLifeSocial;
 const clock=($('worldClock')?.textContent||'').replace(/^\S+\s/,''),mood=$('worldMood')?.textContent||'',online=+(window.ChinaLifeCloud?.online?.players||0);
 const streak=window.ChinaLifeEnergy?.streakNext?.(s);const rows=[];
 if(T()?.on?.())rows.push(row('three','🎯','Today’s Three',d?(d.bonus.claimed?'All done · bonus collected ✓':n+' of '+d.tasks.length+' done · +¥'+d.bonus.coins+' bonus'):'Three tasks and a ¥300 bonus',{hot:!!d&&n===d.tasks.length&&!d.bonus.claimed}));
 const E=window.ChinaLifeEventScreens,es=E?.on?.()&&E.summary?.();if(E?.on?.())rows.push(row('events','🏟','Events',es?.text||'Match Day, elections and Hot Seat Hour',{hot:!!es?.hot}));
 rows.push(row('rank',r.icon||'🏆',(r.daily?'Streak reward ready':(s.streak||0)+'-day streak')+' · '+(r.name||'Rank'),r.daily?'Claim day '+(streak||1)+' before midnight':r.next?r.next.toLocaleString()+' XP to the next rank':'Top rank',{hot:!!r.daily}));
 if(window.ChinaLifeMilestones?.inbox)rows.push(row('inbox','🔔','Notifications','News, rewards and milestones'));
 if(S?.open){rows.push(row('messages','💬','Messages','Your chats with friends'));rows.push(row('people','🟢',online?online+' playing now':'Link Up',S.friendsOnline?S.friendsOnline+' friend'+(S.friendsOnline===1?'':'s')+' online':'Places, chats and friends'))}
 rows.push(row('needs','😊',mood||'Mood','See what you need'));
 rows.push(row('wallet','💴','¥'+Number(s.money||0).toLocaleString(),'Your wallet',{tail:'＋'}));
 if(M)rows.push(row('music','🎵','Music',M.playing?'Playing · tap to pause':'Paused · tap to play',{tail:sw(!!M.playing)}));
 const clean=$('worldUI')?.classList.contains('clean');if($('worldClean'))rows.push(row('clean','🧹','Clean screen',clean?'Rewards and needs are tucked away':'Tuck the side chips away',{tail:sw(!!clean)}));
 card.innerHTML='<header><div><b>'+esc(clock)+'</b><small>'+esc((s.city||'China')+' · Day '+(s.day||1))+'</small></div><button type="button" class="tdp-x" aria-label="Close">✕</button></header><div class="tdp-list">'+rows.join('')+'</div>';
 card.querySelector('.tdp-x').onclick=close;
 card.querySelectorAll('[data-tdp]').forEach(b=>b.onclick=()=>act(b.dataset.tdp))}
function act(id){const g=G(),S=window.ChinaLifeSocial;
 if(id==='music'){window.ChinaLifeMusic?.toggle?.();return setTimeout(paint,60)}
 if(id==='clean'){$('worldClean')?.click();return setTimeout(paint,60)}
 close();({three:()=>T()?.open(),events:()=>window.ChinaLifeEventScreens?.open?.(),rank:()=>g?.rankInfo?.()?.daily&&window.ChinaLifeEnergy?.welcome?window.ChinaLifeEnergy.welcome(true)||g.ranks?.():g?.ranks?.(),inbox:()=>window.ChinaLifeMilestones.inbox(),messages:()=>S.open('messages'),people:()=>S.open('people'),needs:()=>g?.needs?.(),wallet:()=>g?.wallet?.()})[id]?.()}
function close(){$('tdpWrap')?.remove();document.removeEventListener('keydown',esc_)}
const esc_=e=>{if(e.key==='Escape')close()};
function open(){if(!on())return;if($('tdpWrap'))return close();const w=document.createElement('div');w.id='tdpWrap';w.className='tdp-wrap';w.innerHTML='<div class="tdp-card" id="tdpCard" role="dialog" aria-label="Today"></div>';
 w.onclick=e=>{if(e.target===w)close()};document.body.appendChild(w);document.addEventListener('keydown',esc_);paint();refresh();window.ChinaLifeEventScreens?.on?.()&&window.ChinaLifeEventScreens.load?.()?.then?.(()=>paint())}
window.ChinaLifeTodayPanel={open,close,refresh,pill,on};
const start=()=>{pill();refresh()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else setTimeout(start,0);
window.addEventListener('chinalife:cloudready',()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
document.addEventListener('close',e=>{if(e.target?.id==='activityDialog')setTimeout(refresh,300)},true);
setInterval(()=>{if(!document.hidden)refresh()},180000);
const css=document.createElement('style');css.textContent=
 '#worldUI .hud-bar .time-chip{position:relative}.tdp-tap{cursor:pointer}'+
 'html body #worldUI .hud-bar .tdp-pill{position:absolute;right:6px;top:4px;display:flex;align-items:center;gap:3px;height:24px;padding:0 8px;border:0;border-radius:12px;background:#ffffff26;color:inherit;font:inherit;font-size:12px;font-weight:800;cursor:pointer}'+
 '.tdp-pill span{font-size:13px}html body #worldUI .hud-bar .tdp-pill.low{top:auto;bottom:3px;height:22px;padding:0 7px}html body #worldUI .hud-bar .tdp-pill.tiny b{display:none}html body #worldUI .hud-bar .tdp-pill[hidden]{display:none}#worldClock.tdp-dot::after{content:"";display:inline-block;width:7px;height:7px;margin-left:3px;border-radius:50%;background:#f2b33d;vertical-align:middle;box-shadow:0 0 0 3px #f2b33d44}html body #worldUI .hud-bar .tdp-pill.ready{background:#f2b33d;color:#3a2600;animation:tdpPulse 1.6s ease-in-out infinite}@keyframes tdpPulse{50%{box-shadow:0 0 0 5px #f2b33d44}}'+
 '.tdp-wrap{position:fixed;inset:0;z-index:60;background:#06232633;display:flex;justify-content:center;align-items:flex-start;padding:calc(env(safe-area-inset-top) + 64px) 12px 12px;animation:tdpFade .18s ease-out}@keyframes tdpFade{from{opacity:0}}'+
 '.tdp-card{width:min(420px,100%);max-height:calc(100dvh - 90px);overflow-y:auto;background:#fff;border-radius:26px;box-shadow:0 18px 48px #06232640;color:#0C3F44;animation:tdpDrop .22s ease-out}@keyframes tdpDrop{from{transform:translateY(-14px);opacity:.4}}'+
 '.tdp-card header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px}.tdp-card header b{display:block;font-size:28px;letter-spacing:-.02em}.tdp-card header small{color:#587675;font-weight:700}'+
 '.tdp-x{width:36px;height:36px;border-radius:50%;border:0;background:#0C3F44;color:#fff;font-size:15px}'+
 '.tdp-list{display:grid;padding:0 8px 10px}.tdp-row{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:10px;width:100%;padding:10px;border:0;border-top:1px solid #eef3f2;background:none;text-align:left;color:inherit;font:inherit}'+
 '.tdp-row:first-child{border-top:0}.tdp-row:active{background:#f3f8f7}.tdp-i{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#eef6f4;font-size:19px}'+
 '.tdp-t{min-width:0;display:grid}.tdp-t b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tdp-t small{font-size:12px;color:#587675;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tdp-tail{color:#8aa3a1;font-size:18px;font-weight:700}'+
 '.tdp-row.hot .tdp-i{background:#fff1c7;box-shadow:0 0 0 2px #f2b33d}.tdp-row.hot b{color:#9a5a00}'+
 '.tdp-sw{display:block;width:44px;height:26px;border-radius:13px;background:#d5e1df;position:relative;transition:background .2s}.tdp-sw>i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0003;transition:left .2s}'+
 '.tdp-sw.on{background:#16a37f}.tdp-sw.on>i{left:21px}'+
 '@media (prefers-reduced-motion:reduce){.tdp-pill.ready,.tdp-wrap,.tdp-card{animation:none}}';document.head?.append(css);
})();
