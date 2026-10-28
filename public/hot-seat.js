// Gossip hot seat (Oct 2026). One player at a time takes the hot seat in the Gossip Room and posts a
// short anonymous gist. Everyone else in the venue has LIMITS.seconds to vote True or Cap, then the
// verdict is revealed and voters who matched the majority get coins. Today's most-voted gist is
// featured on Gossip TV (rooms.js). Signed in on the live game it talks to chinalife-api/hot-seat.php;
// offline (preview folders, or not joined) the venue's NPCs and AI hosts vote instead, with no API calls.
// The word list and limits match chinalife-api/hot-seat-lib.php (tests/hot-seat.mjs checks both).
(function(root){
'use strict';
const LIMITS={min:10,max:140,seconds:45,reveal:20,minVotes:3,voter:20,author:10,daily:10,hideReports:3};
const EXACT=['dick','dicks','dickhead','prick','twat','cock','cocks','slag','hoe','hoes','mumu','olodo','ashawo','arse','arsehole'];
const PREFIX=['fuck','fuk','motherf','shit','bitch','cunt','asshole','whore','slut','nigg','fag','retard','wank','bastard','pussy','rape','rapist','kys'];
const CJK=['傻逼','煞笔','操你','草泥马','妈的','你妈','婊子','贱人','滚蛋','去死'];
const LEET={'0':'o','1':'i','!':'i','3':'e','4':'a','@':'a','5':'s','$':'s','7':'t','8':'b'};
const normalise=s=>String(s).toLowerCase().replace(/[01!34@5$78]/g,c=>LEET[c]);
function profane(text){
  const n=normalise(text);if(CJK.some(w=>n.includes(w)))return true;
  const tokens=n.split(/[^a-z]+/).filter(Boolean),joined=[];let run='';
  for(const t of tokens){if(t.length===1){run+=t;continue}if(run.length>2)joined.push(run);run=''}
  if(run.length>2)joined.push(run);
  return [...tokens,...joined].some(t=>EXACT.includes(t)||PREFIX.some(p=>t.startsWith(p)));
}
const personal=text=>/https?:\/\/|www\.|\.(com|net|org|cn|ng)\b|@[A-Za-z0-9_]{2,}|\d[\d\s-]{6,}\d/i.test(String(text));
function checkText(raw){
  if(typeof raw!=='string')return {ok:false,error:'Write your gist'};
  const text=raw.replace(/\s+/gu,' ').trim(),len=[...text].length;
  if(len<LIMITS.min)return {ok:false,error:'Make it at least '+LIMITS.min+' characters'};
  if(len>LIMITS.max)return {ok:false,error:'Keep it under '+LIMITS.max+' characters'};
  if(profane(text))return {ok:false,error:'Keep it clean. No swearing or insults'};
  if(personal(text))return {ok:false,error:'Keep it anonymous. No links, @names or numbers'};
  return {ok:true,text};
}
const majority=(t,c)=>t===c?'tie':t>c?'true':'cap';
// votes: [{who, vote}] ; author: who wrote it. Same rules as hs_payouts() in PHP.
function payouts(votes,author,paidToday={}){
  const t=votes.filter(v=>v.vote==='true').length,c=votes.length-t,result=majority(t,c),pay={};
  if(votes.length>=LIMITS.minVotes&&result!=='tie'){
    for(const v of votes)if(v.vote===result&&v.who!==author&&(paidToday[v.who]||0)<LIMITS.daily)pay[v.who]=LIMITS.voter;
    if(result==='true')pay[author]=(pay[author]||0)+LIMITS.author;
  }
  return {true:t,cap:c,result,pay};
}
function hash(s){let h=2166136261;for(const ch of String(s)){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// How believable a gist sounds to the NPCs: big claims lean Cap, small specific ones lean True.
function lean(text){
  const n=String(text).toLowerCase();let p=.55;
  if(/\b(always|never|everyone|nobody|million|billion|100%|literally|swear|definitely)\b/.test(n))p-=.25;
  if(/!{2,}|\?{2,}/.test(n))p-=.1;
  if(/\b(i saw|yesterday|last night|this morning|today|i heard|my roommate|in class)\b/.test(n))p+=.15;
  return Math.max(.15,Math.min(.85,p));
}
// Offline voters vote at a random moment in the window; the seed keeps a round reproducible.
function simulateVotes(text,voters,seconds,seed){
  const r=rng(seed??hash(text)),p=lean(text);
  return voters.map(who=>({who,vote:r()<p?'true':'cap',at:Math.round((.12+r()*.7)*seconds*1000)})).sort((a,b)=>a.at-b.at);
}
const beijingDay=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
// Most-voted revealed gist of the given day (ties go to the newest).
function featuredOf(list,day){let best=null;for(const g of list||[])if(g.day===day&&!g.hidden&&(!best||g.true+g.cap>=best.true+best.cap))best=g;return best}
const NPC_GISTS=['Someone in the Gossip Room has been wearing the same jacket to every party this month','The DJ at the club played the same song three times last night and nobody noticed','A student was seen sleeping in the library with a bowl of noodles still in hand','Tunde secretly practises his dance moves before the venue opens','The new couple from the café already had their first fight over dumplings','Someone tipped the waiter a million yuan by mistake and pretended it was on purpose'];
const api={LIMITS,EXACT,PREFIX,CJK,normalise,profane,personal,checkText,majority,payouts,lean,simulateVotes,hash,beijingDay,featuredOf,NPC_GISTS};
if(typeof document==='undefined'){root.ChinaLifeHotSeat=api;return}

// ---------- browser ----------
const $=id=>document.getElementById(id),game=()=>root.ChinaLife,sandbox=()=>root.ChinaLifeSandbox;
const PREFIX_KEY=()=>(sandbox()?.storagePrefix||''),STORE=()=>PREFIX_KEY()+'chinalife-hotseat',OFF_KEY=()=>PREFIX_KEY()+'chinalife-hotseat-off';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let serverOn=null,serverFeatured=null,round=null,timer=null,poll=null,busy=false;
const online=()=>!sandbox()?.localOnly&&!!root.ChinaLifeCloud?.joined&&!!root.ChinaLifeCloud?.api;
const seconds=()=>{const v=+localStorage.getItem(PREFIX_KEY()+'chinalife-hotseat-seconds');return v>=5&&v<=120?v:LIMITS.seconds};
function load(){try{const s=JSON.parse(localStorage.getItem(STORE()));if(s&&typeof s==='object')return s}catch{}return {list:[],paid:{}}}
function store(s){s.list=(s.list||[]).filter(g=>g.day>=beijingDay(new Date(Date.now()-3*864e5))).slice(-40);try{localStorage.setItem(STORE(),JSON.stringify(s))}catch{}}
function enabled(){
  if(root.ChinaLifeFlags?.off?.('hotseat'))return false;
  if(online())return serverOn!==false;
  return localStorage.getItem(OFF_KEY())!=='1';
}
function setEnabled(on){const was=enabled();serverOn=on===true?true:on===false?false:null;if(was!==enabled()){emit();if(!enabled())$('hotSeatDialog')?.close()}}
function featured(){if(online())return serverFeatured;return featuredOf(load().list,beijingDay())}
const emit=()=>dispatchEvent(new CustomEvent('chinalife:hotseat'));
// Who is in the room to vote offline: the AI host(s), Tunde, and the venue regulars.
function voters(){
  const names=[];try{for(const a of root.ChinaLifeAI?.agentsAt?.('gist')||[])if(a?.name)names.push(a.name)}catch{}
  for(const n of ['Tunde','Mei','Kofi','Ama','Jun','Zara'])if(!names.includes(n))names.push(n);
  return names.slice(0,7);
}
function wrap(x,str,maxW,px,lineH,y0,maxLines){x.font='800 '+px+'px system-ui,sans-serif';const words=String(str).split(' ');let line='',y=y0,n=0;
  for(const w of words){const test=line?line+' '+w:w;if(x.measureText(test).width>maxW&&line){x.fillText(line,24,y);y+=lineH;line=w;if(++n>=maxLines-1){line=line+' …';break}}else line=test}x.fillText(line,24,y);return y}
// Gossip TV slot (rooms.js passes its canvas and text helper).
function paintTV(x,w,h,g,text){
  // The shop awning in front of the TV hides its lower third, so the verdict and quote sit high.
  const t=g.true+g.cap||1,tp=Math.round(g.true/t*100);
  x.fillStyle='#1a0f1f';x.fillRect(0,0,w,h);x.fillStyle='#ff5a1f';x.fillRect(0,0,w,56);text(x,'🔥 HOT SEAT · GIST OF THE DAY',22,38);
  x.fillStyle='#2fbf71';x.fillRect(0,56,w*g.true/t,38);x.fillStyle='#e0263b';x.fillRect(w*g.true/t,56,w*g.cap/t,38);
  text(x,(g.result==='cap'?'🧢 CAP':g.result==='true'?'✅ TRUE':'🤝 SPLIT')+' · '+tp+'% true · '+(g.true+g.cap)+' votes',20,83);
  x.fillStyle='#fff';x.textAlign='left';wrap(x,'“'+g.body+'”',w-48,24,30,128,5);
}
function sheet(){
  let d=$('hotSeatDialog');if(d)return d;
  d=document.createElement('dialog');d.id='hotSeatDialog';d.className='hs-sheet';d.setAttribute('aria-label','Gossip hot seat');
  d.innerHTML='<div class="hs-head"><b>🔥 Hot seat</b><span class="hs-anon">Anonymous · Gossip Room</span><button class="hs-x" aria-label="Close">✕</button></div><div class="hs-body"></div>';
  d.querySelector('.hs-x').onclick=()=>d.close();
  d.addEventListener('close',()=>{clearInterval(poll);poll=null});
  document.body.appendChild(d);return d;
}
const toast=t=>game()?.toast?.(t);
function view(html){const d=sheet();d.querySelector('.hs-body').innerHTML=html;if(!d.open)try{d.showModal()}catch{d.setAttribute('open','')}return d}
function composer(note){
  const L=online()?{...LIMITS}:LIMITS;
  const d=view('<p class="hs-lead">Take the seat, drop a gist. The room has <b>'+seconds()+' seconds</b> to vote <b class="t">True</b> or <b class="c">Cap</b>.</p>'+
    (note?'<p class="hs-note">'+esc(note)+'</p>':'')+
    '<label class="hs-field"><span>Your gist (anonymous)</span><textarea id="hsText" maxlength="'+L.max+'" rows="3" placeholder="e.g. Someone at the café orders two bubble teas and drinks both alone"></textarea><small><span id="hsCount">0</span>/'+L.max+' · no names, links or numbers</small></label>'+
    '<p class="hs-err" id="hsErr" role="alert"></p>'+
    '<button class="hs-go" id="hsTake">🔥 Take the hot seat</button>'+
    '<button class="hs-ghost" id="hsWatch">👀 Watch someone else &amp; vote</button>'+
    '<p class="hs-rules">Match the majority: <b>+¥'+LIMITS.voter+'</b>. Room believes your gist: <b>+¥'+LIMITS.author+'</b>.</p>');
  const ta=d.querySelector('#hsText'),cnt=d.querySelector('#hsCount');
  ta.oninput=()=>{cnt.textContent=[...ta.value].length;d.querySelector('#hsErr').textContent=''};
  d.querySelector('#hsTake').onclick=()=>take(ta.value);
  d.querySelector('#hsWatch').onclick=()=>watch();
}
function voteView(){
  const r=round,left=Math.max(0,r.closesAt-Date.now()),pct=left/(r.seconds*1000);
  const who=r.own?'You are on the hot seat':'🔥 Someone in the room is on the hot seat';
  const chips=(r.shown||[]).map(v=>'<span class="hs-chip">'+esc(v.who)+' voted</span>').join('');
  const mine=r.myVote;
  return '<p class="hs-who">'+who+'</p><blockquote class="hs-gist">“'+esc(r.body)+'”</blockquote>'+
    '<div class="hs-timer" style="--p:'+pct.toFixed(3)+'"><span>'+Math.ceil(left/1000)+'s</span></div>'+
    (r.own?'<p class="hs-note">Sit tight. You can\'t vote on your own gist.</p>':
    '<div class="hs-votes"><button class="hs-true'+(mine==='true'?' on':'')+'" data-v="true" '+(mine?'disabled':'')+'>✅ True</button><button class="hs-cap'+(mine==='cap'?' on':'')+'" data-v="cap" '+(mine?'disabled':'')+'>🧢 Cap</button></div>')+
    '<p class="hs-count">'+r.count+' vote'+(r.count===1?'':'s')+' in'+(mine?' · yours is locked':'')+'</p><div class="hs-chips">'+chips+'</div>'+
    (r.own?'':'<button class="hs-report" data-report>⚑ Report</button>');
}
function revealView(){
  const r=round,t=r.true+r.cap||1,tp=Math.round(r.true/t*100),cp=100-tp,res=r.result;
  const stamp=res==='true'?'<div class="hs-stamp t">TRUE ✅</div>':res==='cap'?'<div class="hs-stamp c">CAP 🧢</div>':'<div class="hs-stamp s">SPLIT 🤝</div>';
  const won=r.reward>0;
  // Oct 2026: tell the Club Hypeman (hypeman.js) about a win, once per round.
  if(won&&!r.cheered){r.cheered=true;try{root.dispatchEvent?.(new root.CustomEvent('chinalife:winner',{detail:{kind:'hotseat',reward:r.reward}}))}catch{}}
  const line=r.own?(res==='true'?'The room believed you.':res==='cap'?'The room called cap on you.':'The room couldn\'t decide.'):
    (!r.myVote?'You didn\'t vote this round.':res==='tie'?'Dead heat. No winners this time.':r.myVote===res?'You read the room!':'The room went the other way.');
  const voters=(r.votes||[]).map(v=>'<span class="hs-chip '+(v.vote==='true'?'t':'c')+'">'+esc(v.who)+' · '+(v.vote==='true'?'True':'Cap')+'</span>').join('');
  return '<div class="hs-reveal'+(won?' won':'')+'">'+stamp+(won?confetti():'')+'</div><blockquote class="hs-gist small">“'+esc(r.body)+'”</blockquote>'+
    '<div class="hs-bar"><i class="t" style="--w:'+tp+'%"></i><i class="c" style="--w:'+cp+'%"></i></div><div class="hs-split"><span>True '+tp+'% · '+r.true+'</span><span>Cap '+cp+'% · '+r.cap+'</span></div>'+
    '<p class="hs-result">'+line+(won?' <b class="hs-coins">+¥'+r.reward+'</b>':'')+'</p>'+
    (r.votes?'<div class="hs-chips">'+voters+'</div>':'')+
    '<div class="hs-row"><button class="hs-go" id="hsAgain">🔥 Next round</button>'+(r.own?'':'<button class="hs-report" data-report>⚑ Report</button>')+'</div>';
}
function confetti(){let s='<div class="hs-confetti" aria-hidden="true">';const r=rng(Date.now());for(let i=0;i<18;i++)s+='<i style="--x:'+Math.round(r()*240-120)+'px;--y:'+Math.round(-80-r()*120)+'px;--r:'+Math.round(r()*720-360)+'deg;--d:'+(r()*.25).toFixed(2)+'s">'+['🎉','✨','💰','🔥'][i%4]+'</i>';return s+'</div>'}
function paint(){
  if(!round)return composer();
  const d=view(round.status==='voting'?voteView():revealView());
  d.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>vote(b.dataset.v));
  d.querySelector('[data-report]')?.addEventListener('click',report);
  const again=d.querySelector('#hsAgain');if(again)again.onclick=()=>{round=null;composer()};
}
// ---------- offline round (NPCs vote) ----------
function startLocal(body,own,author){
  const s=seconds(),vs=voters().filter(v=>v!==author);
  round={id:'local-'+Date.now(),body,own,author,seconds:s,startedAt:Date.now(),closesAt:Date.now()+s*1000,status:'voting',sim:simulateVotes(body,vs,s,hash(body+Date.now())),shown:[],votes:[],count:0,myVote:null,local:true};
  clearInterval(timer);timer=setInterval(tickLocal,250);paint();
}
function tickLocal(){
  if(!round?.local){clearInterval(timer);return}
  if(round.status!=='voting')return;
  const el=Date.now()-round.startedAt;let changed=false;
  while(round.sim.length&&round.sim[0].at<=el){const v=round.sim.shift();round.votes.push(v);round.shown.push(v);changed=true}
  round.count=round.votes.length;
  if(Date.now()>=round.closesAt){revealLocal();return}
  if($('hotSeatDialog')?.open){const t=$('hotSeatDialog').querySelector('.hs-timer');if(changed||!t)paint();else{const left=Math.max(0,round.closesAt-Date.now());t.style.setProperty('--p',(left/(round.seconds*1000)).toFixed(3));t.firstElementChild.textContent=Math.ceil(left/1000)+'s'}}
}
function revealLocal(){
  clearInterval(timer);const r=round,me='__you',st=load(),day=beijingDay();
  if(st.paid?.day!==day)st.paid={day,n:0};
  const votes=r.votes.map(v=>({who:v.who,vote:v.vote}));if(r.myVote)votes.push({who:me,vote:r.myVote});
  const author=r.own?me:r.author,out=payouts(votes,author,{[me]:st.paid.n>=LIMITS.daily?LIMITS.daily:0});
  Object.assign(r,{status:'revealed',true:out.true,cap:out.cap,result:out.result,reward:out.pay[me]||0,votes:r.votes.concat(r.myVote?[{who:'You',vote:r.myVote}]:[])});
  if(r.reward){const g=game();if(g?.state){g.state.money=(+g.state.money||0)+r.reward;g.save?.();g.refresh?.();dispatchEvent(new CustomEvent('chinalife:update'))}if(!r.own||out.pay[me]>LIMITS.author)st.paid.n++}
  st.list=(st.list||[]).concat([{day,body:r.body,true:out.true,cap:out.cap,result:out.result,at:Date.now(),own:r.own}]);store(st);
  if(!$('hotSeatDialog')?.open&&r.reward)toast('🔥 Hot seat: '+(r.result==='true'?'TRUE':'CAP')+' · +¥'+r.reward);
  emit();paint();
}
// ---------- online round (hot-seat.php) ----------
const where=()=>({city:game()?.state?.city||'Shenyang',place:'gist'});
async function call(method,body){const res=await root.ChinaLifeCloud.api('/chinalife/hot-seat.php',method,method==='GET'?where():{...where(),...body});return res?.data||res}
function fromServer(d){
  if(!d)return;if(typeof d.enabled==='boolean')setEnabled(d.enabled);
  const before=JSON.stringify(serverFeatured);serverFeatured=d.featured||null;if(JSON.stringify(serverFeatured)!==before)emit();
  if(Number.isFinite(+d.money))game()?.applyServerTotals?.({money:d.money});
  const r=d.round;if(!r){if(round&&!round.local)round=null;return}
  round={id:r.id,body:r.body,own:r.own,author:null,seconds:r.seconds,closesAt:Date.now()+r.closes_in,status:r.status,count:r.votes,myVote:r.my_vote,shown:[],true:r.true,cap:r.cap,result:r.result,reward:r.reward||0};
}
async function refresh(){if(busy)return;try{fromServer(await call('GET'));if($('hotSeatDialog')?.open&&!$('hsText'))paint()}catch(e){/* keep the last view */}}
// ---------- actions ----------
async function take(raw){
  const c=checkText(raw);if(!c.ok){const e=$('hsErr');if(e)e.textContent=c.error;return}
  if(!online())return startLocal(c.text,true,null);
  busy=true;try{fromServer(await call('POST',{action:'take',body:c.text}));paint()}catch(e){const el=$('hsErr');if(el)el.textContent=e.message||'Could not take the seat'}finally{busy=false}
}
function watch(){
  if(online())return refresh().then(()=>{if(!round)composer('Nobody is on the seat right now. Take it!')});
  const vs=voters(),author=vs[Math.floor(Math.random()*vs.length)],st=load();
  const used=new Set((st.list||[]).map(g=>g.body)),pool=NPC_GISTS.filter(g=>!used.has(g));
  startLocal((pool.length?pool:NPC_GISTS)[Math.floor(Math.random()*(pool.length||NPC_GISTS.length))],false,author);
}
async function vote(v){
  if(!round||round.own||round.myVote||round.status!=='voting')return;
  if(round.local){round.myVote=v;round.count=round.votes.length+1;paint();return}
  busy=true;try{fromServer(await call('POST',{action:'vote',id:round.id,vote:v}));paint()}catch(e){toast(e.message||'Vote failed')}finally{busy=false}
}
async function report(){
  if(!round)return;if(!confirm('Report this gist to the admins?'))return;
  if(round.local){const st=load();const g=(st.list||[]).find(x=>x.body===round.body);if(g)g.hidden=true;store(st);emit();toast('Reported. It won\'t show on Gossip TV.');round=null;return composer()}
  try{fromServer(await call('POST',{action:'report',id:round.id,reason:'player'}));toast('Thanks. The ChinaLife team will look at it.');round=null;composer()}catch(e){toast(e.message||'Report failed')}
}
function open(){
  if(!enabled())return toast('The hot seat is closed right now');
  if(game()?.state?.place&&game().state.place!=='gist')return toast('The hot seat is in the Gossip Room');
  if(online()){refresh().then(paint);clearInterval(poll);poll=setInterval(refresh,2000);return}
  paint();
}
// ---------- admin ----------
function mountAdmin(el,admin,say=toast){
  if(!el)return;
  const draw=(on,rows,offline)=>{
    el.innerHTML='<h3>🔥 Gossip hot seat</h3><label class="hs-admin-switch"><input type="checkbox" id="hsAdminOn" '+(on?'checked':'')+'> Hot seat is on</label>'+
      (offline?'<p class="hint">Preview: the switch is saved on this device only. The live list needs the server.</p>':'')+
      '<div class="hs-admin-list">'+(rows||[]).map(g=>'<div class="hs-admin-row'+(g.status==='hidden'?' hidden':'')+'"><p>“'+esc(g.body)+'”</p><small>#'+esc(g.id)+' · @'+esc(g.user_name||g.user_id)+' · '+esc(g.city)+' · '+esc(g.status)+' · ✅'+(+g.true_votes)+' 🧢'+(+g.cap_votes)+(+g.reports?' · ⚑'+(+g.reports):'')+'</small><span><button data-op="'+(g.status==='hidden'?'unhide':'hide')+'" data-id="'+esc(g.id)+'">'+(g.status==='hidden'?'Unhide':'Hide')+'</button><button data-op="delete" data-id="'+esc(g.id)+'" class="danger">Delete</button></span></div>').join('')+(rows&&!rows.length?'<p class="hint">No gists yet.</p>':'')+'</div>';
    el.querySelector('#hsAdminOn').onchange=async e=>{const want=e.target.checked;
      if(offline){if(want)localStorage.removeItem(OFF_KEY());else localStorage.setItem(OFF_KEY(),'1');emit();return say('Hot seat '+(want?'on':'off')+' on this device')}
      try{await admin('set_hot_seat',{enabled:want});setEnabled(want);say('Hot seat '+(want?'on':'off'))}catch(err){e.target.checked=!want;say(err.message||'Could not save')}};
    el.querySelectorAll('[data-op]').forEach(b=>b.onclick=async()=>{if(b.dataset.op==='delete'&&!confirm('Delete this gist for good?'))return;
      try{await admin('hot_seat_moderate',{id:+b.dataset.id,op:b.dataset.op});load_()}catch(err){say(err.message||'Could not update')}});
  };
  const load_=async()=>{
    if(sandbox()?.localOnly)return draw(localStorage.getItem(OFF_KEY())!=='1',null,true);
    try{const r=await admin('hot_seat',{}),d=r?.data||r;draw(d.enabled===true,d.gists||[],false)}catch(e){draw(enabled(),null,true)}
  };
  load_();
}
// Link Up (social.js) "Happening now": the live round, if any. Online it is the same GET the seat polls; the True/Cap split stays hidden.
async function peek(){if(!enabled())return null;if(online()&&!busy){try{fromServer(await call('GET'))}catch{}}const r=round;if(!r||r.status!=='voting')return null;const left=Math.max(0,Math.round((r.closesAt-Date.now())/1000));return left?{id:r.id,votes:+r.count||0,secondsLeft:left,own:!!r.own,voted:!!r.myVote,local:!!r.local}:null}
root.ChinaLifeHotSeat={...api,enabled,setEnabled,featured,open,peek,paintTV,mountAdmin,voters,get round(){return round},_finish(){if(round?.local&&round.status==='voting'){round.closesAt=Date.now();round.startedAt-=round.seconds*1000;tickLocal()}}};
})(typeof window!=='undefined'?window:globalThis);
