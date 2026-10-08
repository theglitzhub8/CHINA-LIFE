const game=window.ChinaLife,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.getElementById('sharedDialog');dialog.innerHTML='<div class="activity-panel"><span class="eyebrow">SHENYANG · TOGETHER</span><h2>Make a shared memory</h2><div id="sharedBody"></div><p id="sharedFeedback" role="status"></p></div><button id="closeShared" class="close-x" aria-label="Close shared activities">×</button>';
const banner=document.createElement('button');banner.id='sharedInviteNotice';banner.className='shared-invite-notice';banner.hidden=true;document.body.append(banner);
let catalog={},relationships=[],preferred=null,peerGender=null,sessions=[],peer=null,peerName='',account='',generation=0,polling=false,offset=0,seen=new Set(),busy=false,pending=null;
const $=id=>document.getElementById(id),mine=()=>window.ChinaLifeCloud?.playerId;
async function api(method='GET',data){const r=await window.ChinaLifeAuth.request('/chinalife/activities.php',method,data);return r.data||r}
function note(text){$('sharedFeedback').textContent=text}
function allowed(kind){if(!['girlfriend','boyfriend','date'].includes(kind))return true;if(!game.state.gender||!peerGender||game.state.gender===peerGender)return false;return kind==='date'||kind===(peerGender==='male'?'boyfriend':'girlfriend')}
function active(){return sessions.find(s=>['pending','accepted','active'].includes(s.status))}
function render(){
 const s=active(),id=mine();let html='';
 if(!window.ChinaLifeCloud?.signedIn)html='<p>Connect with Hafrik to join shared activities.</p>';
 else if(s){const spec=catalog[s.kind],host=s.inviter_id===id,slot=host?'a':'b',other=host?s.invitee_name:s.inviter_name;
  html='<h3>'+esc(spec.title)+' with '+esc(other)+'</h3><p>'+esc(game.locations.find(p=>p[0]===s.place)?.[1]||s.place)+' · Shenyang</p><p>'+(spec.proposal?'A relationship request · accept or decline freely.':spec.xp?'Complete together: +'+spec.xp+' XP and ¥'+spec.money+' each.':'An invitation to spend time together.')+'</p>';
  if(s.status==='pending')html+='<p>'+(host?'Waiting for your invitation to be accepted.':'You have been invited. Would you like to join?')+'</p>'+(!host?'<button class="primary-btn" data-shared="accept">Accept invitation</button><button class="soft-btn" data-shared="decline">Decline</button>':'');
  else if(s.status==='accepted')html+='<p>Meet at the venue. Both players must be present and ready.</p><button class="soft-btn" data-shared="travel">Go to the venue</button><button class="primary-btn" data-shared="ready" '+(s['ready_'+slot]?'disabled':'')+'>'+(s['ready_'+slot]?'Ready · waiting for your teammate':'I’m here and ready')+'</button>';
  else{const left=Math.max(0,Math.ceil((s.started_ms+spec.seconds*1000-Date.now()-offset)/1000));html+='<p>'+esc(spec.prompt)+'</p>'+(s['choice_'+(slot==='a'?'b':'a')]?'<p>Your teammate chose: <b>'+esc(spec.choices[s['choice_'+(slot==='a'?'b':'a')]])+'</b></p>':'')+Object.entries(spec.choices).map(([key,title])=>'<button class="soft-btn" data-shared="choose" data-choice="'+key+'" '+(s['choice_'+slot]===key?'disabled':'')+'>'+esc(title)+(s['choice_'+slot]===key?' ✓':'')+'</button>').join('')+'<p>'+ (left?'Spend '+left+' more seconds together.':'Ready to finish once you’ve both responded.')+'</p><button class="primary-btn" data-shared="finish" '+(left||!s.choice_a||!s.choice_b?'disabled':'')+'>Complete together</button>';}
  html+='<button class="soft-btn" data-shared="cancel">Cancel activity</button>';
 }else{
  html+='<p>Invite someone in Shenyang. Both players accept, meet at the venue, and participate.</p>';
  if(peer)html+='<p>With <b>'+esc(peerName||peer)+'</b></p>'+Object.entries(catalog).filter(([kind])=>allowed(kind)&&(!preferred||(preferred==='dinner'?kind.startsWith('dinner-'):preferred==='club'?kind.startsWith('club-'):kind===preferred))).map(([kind,spec])=>'<button class="choice-action" data-shared="invite" data-kind="'+kind+'"><b>'+esc(spec.title)+'</b><span>'+esc(game.locations.find(p=>p[0]===spec.place)?.[1]||spec.place)+(spec.proposal?' · optional relationship':' · '+spec.seconds+' seconds')+'</span></button>').join('');
  else html+='<button class="primary-btn" data-shared="people">Find a teammate</button>';
  const completed=sessions.filter(s=>s.status==='completed');if(completed.length)html+='<h3>Your recent shared memories</h3>'+completed.map(s=>'<p>'+esc(catalog[s.kind]?.title||s.kind)+' · '+esc(s.inviter_id===mine()?s.invitee_name:s.inviter_name)+' · '+Number(s.memories)+' shared '+(Number(s.memories)===1?'memory':'memories')+'</p>').join('');
 }
 if(relationships.length)html+='<h3>Your relationship</h3>'+relationships.map(r=>'<p>Partner: '+esc(r.inviter_id===mine()?r.invitee_name:r.inviter_name)+'</p><button class="soft-btn" data-shared="end-relationship" data-id="'+r.id+'">End relationship</button>').join('');
 $('sharedBody').innerHTML=html;$('sharedBody').querySelectorAll('[data-shared]').forEach(b=>b.onclick=()=>act(b.dataset.shared,b.dataset));
}
async function pollInternal(){
 if(polling||!window.ChinaLifeCloud?.signedIn||!game.state.created||document.hidden)return;
 const id=mine();if(id!==account){account=id;seen=new Set();sessions=[];peer=null;generation++}const epoch=generation;
 polling=true;try{const data=await api();if(epoch!==generation||id!==mine())return;catalog=data.catalog;sessions=data.activities;relationships=data.relationships||[];offset=data.serverTime-Date.now();
  const incoming=sessions.find(s=>s.status==='pending'&&s.invitee_id===id&&!seen.has(s.id));
  if(incoming){seen.add(incoming.id);banner.textContent=incoming.inviter_name+' invited you: '+catalog[incoming.kind].title;banner.hidden=false;banner.onclick=()=>{banner.hidden=true;open()};}
  if(!active()||active().status!=='pending')banner.hidden=true;
  if(dialog.open)render();
 }catch(e){if(dialog.open)note(e.message)}finally{polling=false}
}
function poll(){if(pending)return pending;const task=pollInternal();pending=task;task.finally(()=>{if(pending===task)pending=null});return task}
async function open(id=null,name='',kind=null){await window.ChinaLifeCloud?.ready;note('');await poll();peer=id;peerName=name;preferred=kind;peerGender=null;if(id)try{const r=await window.ChinaLifeAuth.request('/chinalife/profile.php?peer='+encodeURIComponent(id),'GET');peerGender=(r.data||r).profile?.gender}catch{}render();if(!dialog.open)dialog.showModal()}
async function act(action,data={}){
 if(busy)return;busy=true;note('');try{
  if(action==='people'){dialog.close();await window.ChinaLifeSocial.open('people');return}
  const s=active();if(action==='end-relationship'&&!confirm('End this relationship?'))return;if(action==='travel'){if(game.state.city!=='Shenyang')return note('Return to Shenyang to meet your teammate.');dialog.close();game.travel(s.place);return}
  if(!await window.ChinaLifeCloud.upload())return note('Save your character before joining. Check your Hafrik connection.');
  await window.ChinaLifeCloud.refresh();
  await api('POST',action==='invite'?{action,peer,kind:data.kind}:{action,id:action==='end-relationship'?data.id:s.id,...(action==='choose'?{choice:data.choice}:{})});
  await window.ChinaLifeCloud.syncTransfers();await poll();render();
  if(action==='choose'&&window.ChinaLifeWorld&&!window.ChinaLifeWorld.busy){
    const spec=catalog[s.kind],motions={study:{kind:'study',x:-1,z:2},basketball:{kind:'basketball',x:1,z:2},meal:{kind:'eat',x:2,z:3.2},spar:{kind:'box',x:-1,z:1.5}};
    dialog.close();if(!window.ChinaLifeWorld.perform({...(motions[s.kind]||(s.kind.startsWith('club-')?{kind:data.choice==='lounge'?'talk':'dance',x:0,z:0}:s.kind==='date'?{kind:'talk',x:-3,z:2}:{kind:'eat',x:2,z:3.2})),duration:5,label:spec.title},()=>open()))open();
  }
 }catch(e){note(e.message)}finally{busy=false}
}
$('closeShared').onclick=()=>dialog.close();setInterval(poll,3000);
window.addEventListener('chinalife:cloudready',()=>{generation++;account='';sessions=[];relationships=[];preferred=null;peer=null;seen=new Set();banner.hidden=true;if(dialog.open)render();poll()});
window.ChinaLifeShared={open,poll,ready:null};window.ChinaLifeShared.ready=poll();
