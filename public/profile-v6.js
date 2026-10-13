// v6 profile card: one renderer for your own profile and other players'.
(()=>{'use strict';
const ROLES={Student:['🎓','Student'],Entrepreneur:['🚀','Entrepreneur'],Worker:['💼','Professional'],Creator:['🎥','Creator'],Tourist:['🧳','Visitor']};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ago=t=>{const m=Math.max(1,Math.round((Date.now()-t)/60000));return m<60?m+'m ago':m<1440?Math.round(m/60)+'h ago':Math.round(m/1440)+'d ago'};
const placeName=(id,city)=>{try{const g=window.ChinaLife;const l=(g?.placesIn?.(city)||g?.locations||[]).find(p=>p[0]===id);return l?l[1]:id.replace(/[-_]/g,' ')}catch{return id}};
function card(p,{own=false,actions=''}={}){
 const xp=Number(p.xp||0),lv=1+Math.floor(xp/100),pct=xp%100,role=ROLES[p.role]||null,s=p.stats||{};
 const stat=(n,l)=>'<div class="pv6-stat"><b>'+Number(n||0).toLocaleString()+'</b><span>'+l+'</span></div>';
 return '<section class="pv6">'
 +'<header class="pv6-head"><span class="pv6-avatar" style="background:'+esc(p.color||'#0c3f44')+'">'+esc((p.name||'?')[0].toUpperCase())+(p.online?'<i></i>':'')+'</span>'
 +'<div class="pv6-id"><h3>'+esc(p.name||'Player')+'</h3><p>'+(p.city?'📍 '+esc(p.city):'')+(role?' <span class="pv6-role">'+role[0]+' '+role[1]+'</span>':'')+'</p>'
 +'<div class="pv6-rank"><span>Lv '+lv+'</span><div class="pv6-bar"><i style="width:'+pct+'%"></i></div><small>'+pct+'/100 XP</small></div></div>'
 +(own&&p.coins!=null?'<div class="pv6-coins">¥'+Number(p.coins).toLocaleString()+'</div>':'')+'</header>'
 +(p.wealth||p.badges?.length?'<div class="pv6-badges">'+(p.wealth?'<span>'+esc(p.wealth)+'</span>':'')+(p.badges||[]).map(b=>'<span>'+esc(b.icon)+' '+esc(b.name)+'</span>').join('')+'</div>':'')
 +'<div class="pv6-stats">'+stat(p.days,'Days played')+stat(s.friends,'Friends')+stat(s.venues,'Venues')+stat(s.dance,'Dance titles')+stat(s.offices,'Offices')+'</div>'
 +(actions?'<div class="pv6-actions">'+actions+'</div>':'')
 +'<h4 class="pv6-h">Recent activity</h4>'+((p.recent||[]).length?'<ul class="pv6-recent">'+p.recent.map(r=>'<li>📍 '+esc(placeName(r.place,r.city))+(placeName(r.place,r.city).includes(r.city)?'':' · '+esc(r.city))+'<small>'+ago(r.at)+'</small></li>').join('')+'</ul>':'<p class="pv6-empty">No recent activity yet.</p>')
 +'<h4 class="pv6-h">Friends</h4>'+((p.friends||[]).length?'<div class="pv6-friends">'+p.friends.map(f=>'<button type="button" data-pv6-peer="'+esc(f.id)+'"><span style="background:'+esc(f.color)+'">'+esc((f.name||'?')[0].toUpperCase())+'</span>'+esc(f.name)+'</button>').join('')+'</div>':'<p class="pv6-empty">No friends yet.</p>')
 +'</section>'}
function bind(root){root.querySelectorAll('[data-pv6-peer]').forEach(b=>b.onclick=()=>window.ChinaLifeSocial?.player(b.dataset.pv6Peer))}
async function own(el){const g=window.ChinaLife,st=g?.state||{};
 const local={name:st.name,xp:st.xp,city:st.city,role:st.background,days:st.day,coins:st.money,stats:{friends:0,venues:(st.visited||[]).length,dance:0,offices:0}};
 el.innerHTML=card(local,{own:true});
 if(!window.ChinaLifeCloud?.signedIn||!window.ChinaLifeAuth)return;
 try{const r=await window.ChinaLifeAuth.request('/chinalife/profile.php','GET');const p=(r.data||r).profile;if(p&&el.isConnected){el.innerHTML=card({...p,color:window.ChinaLifeCloud?.color||p.color},{own:true});bind(el)}}catch{}}
window.ChinaLifeProfile={card,bind,own};
})();
// Hafrik default avatars (d-avatar.jpg / f-avatar.jpg) are missing on storage: swap in a neutral placeholder instead of a broken image.
document.addEventListener('error',e=>{const t=e.target;if(t?.tagName==='IMG'&&/\/[a-z]-avatar\.jpg(\?|$)/.test(t.src)&&!t.dataset.pv6){t.dataset.pv6='1';t.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#0c3f44"/><circle cx="20" cy="15" r="7" fill="#7fd1c7"/><path d="M6 38c2-9 8-13 14-13s12 4 14 13z" fill="#7fd1c7"/></svg>')}},true);
