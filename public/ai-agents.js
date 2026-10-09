// AI characters in every city (Claude, through the server's ai.php: the API key never reaches the device).
// They stand at their venues (tap them), and are listed in the phone's AI guides app. Replies can include
// [[go:place]] tags, shown as buttons that take the player there.
const game=window.ChinaLife,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AGENTS=[
 {id:'guide',name:'Mei',role:'City guide',emoji:'🧭',place:'plaza',color:0xd94f70,tint:'#d94f70,#7c3aed',spot:[-2.6,-1.6],hello:'Hi! I’m Mei. New here or just looking for something fun to do in {city}?',chips:['What should I do today?','Where can I eat?','How do I use the metro?','Any events tonight?']},
 {id:'tutor',name:'Teacher Li',role:'Chinese tutor',emoji:'🀄',place:'ef',color:0xc0392b,tint:'#dc2626,#7f1d1d',spot:[2.6,-1.4],hello:'你好！I’m Teacher Li. Shall we practise some Chinese together?',chips:['Teach me a useful phrase','Practise ordering food','How do tones work?','Quiz me']},
 {id:'food',name:'Auntie Wang',role:'Food & market expert',emoji:'🥟',place:'market',color:0xe67e22,tint:'#f97316,#b45309',spot:[-2.8,1.4],hello:'Aiya, you look hungry! I’m Auntie Wang. What are you craving?',chips:['What should I try here?','How do I bargain?','Where’s food from home?','Is this price fair?']},
 {id:'night',name:'DJ Kofi',role:'Nightlife host',emoji:'🎶',place:'night',color:0x2b2140,tint:'#7c3aed,#db2777',spot:[3,-2.2],hello:'Yo! DJ Kofi here. Looking for a good night out in {city}?',chips:['Which club tonight?','Who should I listen to?','Any events this week?','Tips for a safe night']}];
const byId=id=>AGENTS.find(a=>a.id===id);
const placeName=id=>game.cityData?.[game.state.city]?.names?.[id]||game.locations?.find(p=>p[0]===id)?.[1]||id;
let agent=null,messages=[],remaining=null,enabled=null,busy=false;
async function api(method,data){const path='/chinalife/ai.php'+(method==='POST'?'':'?agent='+encodeURIComponent(agent.id));const r=await window.ChinaLifeAuth.request(path,method,method==='POST'?{agent:agent.id,...data}:undefined);return r.data||r}
// What the character should know about the player right now (the server adds the real businesses and events).
function context(){const s=game.state,h=Math.floor(s.hour/60)%24,m=s.hour%60,needs=Object.entries(s.needs||{}).sort((a,b)=>a[1]-b[1])[0];
 const places=(game.placesIn?.(s.city)||game.locations||[]).map(p=>[p[0],placeName(p[0])]).filter(p=>!/^home/.test(p[0])).slice(0,80);
 return {city:s.city,place:placeName(s.place),name:s.name,money:Math.floor(s.money),time:String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'),feeling:needs?'lowest need: '+needs[0]+' '+Math.round(needs[1])+'%':'',chinese:(s.chinese?.unit||0)+1,places}}
// Reply text: safe HTML, line breaks, and [[go:place]] tags as buttons to known places only.
function format(text){const known=new Set((game.locations||[]).map(p=>p[0]));let goes=[];const body=esc(text).replace(/\[\[go:([a-z0-9-]{2,30})\]\]/g,(_,id)=>{if(known.has(id)&&!goes.includes(id))goes.push(id);return ''}).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
 return body+(goes.length?'<div class="ai-goes">'+goes.map(id=>'<button data-go="'+esc(id)+'">📍 Go to '+esc(placeName(id))+'</button>').join('')+'</div>':'')}
const dialog=document.createElement('dialog');dialog.id='aiDialog';dialog.className='ai-sheet';document.body.append(dialog);
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
function draw(typing=false){const a=agent;if(!a)return;const hello=a.hello.replace('{city}',game.state.city);
 dialog.innerHTML='<header class="ai-head" style="--tint:linear-gradient(135deg,'+a.tint+')"><span class="ai-avatar">'+a.emoji+'</span><div><b>'+esc(a.name)+' <em>AI</em></b><small>'+esc(a.role)+' · '+esc(placeName(a.place))+'</small></div><button class="ai-x" aria-label="Close">✕</button></header>'
  +'<div class="ai-thread" id="aiThread">'+(enabled===false?'<div class="ai-off"><b>'+esc(a.name)+' is on the way</b><p>The AI characters are being set up for '+esc(game.state.city)+'. Check back soon!</p></div>'
   :'<div class="ai-msg them"><div>'+esc(hello)+'</div></div>'+messages.map(m=>'<div class="ai-msg '+(m.role==='user'?'me':'them')+'"><div>'+(m.role==='user'?esc(m.content):format(m.content))+'</div></div>').join('')+(typing?'<div class="ai-msg them"><div class="ai-typing"><i></i><i></i><i></i></div></div>':''))+'</div>'
  +(enabled===false?'':(messages.length<2?'<div class="ai-chips">'+a.chips.map(c=>'<button data-chip="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div>':'')
   +'<form class="ai-compose" id="aiForm"><input id="aiInput" maxlength="500" placeholder="Message '+esc(a.name)+'…" autocomplete="off"'+(busy?' disabled':'')+'><button aria-label="Send"'+(busy?' disabled':'')+'>➤</button></form>'
   +'<p class="ai-foot">AI character · replies can be wrong'+(remaining!=null?' · '+remaining+' message'+(remaining===1?'':'s')+' left today':'')+(messages.length?' · <button class="ai-clear" type="button">Clear chat</button>':'')+'</p>');
 dialog.querySelector('.ai-x').onclick=()=>dialog.close();const t=$('aiThread');t.scrollTop=t.scrollHeight;
 dialog.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{dialog.close();game.travel?.(b.dataset.go)});
 dialog.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>send(b.dataset.chip));
 const f=$('aiForm');if(f)f.onsubmit=e=>{e.preventDefault();send($('aiInput').value)};const clear=dialog.querySelector('.ai-clear');if(clear)clear.onclick=async()=>{if(!confirm('Clear your chat with '+a.name+'?'))return;try{await api('DELETE');messages=[];draw()}catch(e){game.toast?.(e.message)}};
 if(!typing&&$('aiInput')&&!busy)setTimeout(()=>$('aiInput')?.focus(),50)}
async function send(text){text=String(text||'').trim();if(!text||busy||!agent)return;busy=true;messages.push({role:'user',content:text});draw(true);
 try{const r=await api('POST',{message:text,context:context()});messages.push({role:'assistant',content:r.reply});remaining=r.remaining;window.ChinaLifeSound?.play?.('message')}
 catch(e){messages.pop();game.toast?.(e.message||'Try again in a moment.');if(e.status===503)enabled=false}
 finally{busy=false;draw();if(enabled!==false&&$('aiInput')&&!messages.length)$('aiInput').value=text}}
async function open(id){const a=byId(id);if(!a)return;await window.ChinaLifeCloud?.ready;if(!window.ChinaLifeCloud?.signedIn){window.ChinaLifeCloud?.open();return}
 agent=a;messages=[];remaining=null;draw(true);if(!dialog.open)dialog.showModal();
 try{const r=await api('GET');enabled=r.enabled;messages=r.messages||[];remaining=r.remaining}catch(e){enabled=null;game.toast?.(e.message)}draw()}
// The AI guides list (phone app): who they are, where to find them, chat now or go there.
function home(){game.showScreen?.('🤖 AI guides · '+esc(game.state.city),'Characters who know '+esc(game.state.city)+'. Ask them anything; they’ll point you to real places, people and events.',AGENTS.map(a=>'<div class="ai-card"><span class="ai-avatar" style="--tint:linear-gradient(135deg,'+a.tint+')">'+a.emoji+'</span><div><b>'+esc(a.name)+'</b><small>'+esc(a.role)+' · at '+esc(placeName(a.place))+'</small></div><button class="primary-btn" data-ai-chat="'+a.id+'">Chat</button></div>').join('')+'<p class="fine-print">AI characters can make mistakes. Never share passwords or payment details in chats.</p>');
 document.querySelectorAll('[data-ai-chat]').forEach(b=>b.onclick=()=>{$('activityDialog')?.close();open(b.dataset.aiChat)})}
window.ChinaLifeAI={agents:AGENTS,agentsAt:place=>AGENTS.filter(a=>a.place===place),open,home};
window.dispatchEvent(new CustomEvent('chinalife:ai-ready'));
