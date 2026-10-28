// Gossip wall Phase 2 (docs/GOSSIP-ROOM-PLAN.md, appadmin switch gossip_wall, default OFF). game.js gistNightScreen draws
// the feed and hands it here; with the switch on each tip gets the full reaction row (😂 🔥 🫢 👀 🧢 ❤️), anonymous
// replies, its place tag (#club, #campus …, written in the post), and today's most-reacted tip is lifted to the top as
// "🏆 Gist of the day". Place chips above the feed filter it. Everything is checked and stored by gist-night.php.
(()=>{const on=()=>window.ChinaLifeFlags?.cast?.('gossip_wall')===true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KINDS=[['laugh','😂'],['fire','🔥'],['shock','🫢'],['eyes','👀'],['cap','🧢'],['like','❤️']];
const PLACES=[['club','🪩 Club'],['campus','🎓 Campus'],['football','⚽ Football'],['hq','🏢 HQ'],['hospital','🏥 Hospital'],['voting','🗳️ Voting'],['gossip','🫖 Gossip']];
let filter='';
function decorate(feed,posts,send){if(!on()||!feed)return;const cards=[...feed.querySelectorAll('article.gossip-card')];
 cards.forEach((card,i)=>{const p=posts[i];if(!p||p.legacy)return;card.dataset.place=p.place||'';
  const head=card.querySelector('header');if(p.place&&head)head.insertAdjacentHTML('beforeend','<span class="gw-place">#'+esc(p.place)+'</span>');
  if(p.top){card.classList.add('gw-top');head?.insertAdjacentHTML('afterbegin','<span class="gw-crown">🏆 Gist of the day</span>')}
  const row=card.querySelector('.gossip-reacts');if(row)row.outerHTML='<footer class="gossip-reacts gw-reacts">'+KINDS.map(([k,e])=>'<button type="button" data-gw-react="'+esc(p.id)+'" data-kind="'+k+'" class="'+(p.mine===k?'mine':'')+'" aria-label="'+k+'">'+e+' <span>'+(p.reactions?.[k]||0)+'</span></button>').join('')+'</footer>';
  const n=p.reply_count||0,list=(p.replies||[]).map(r=>'<li><b>'+(r.op?'Tipster':r.own?'You':'Anonymous')+'</b> '+esc(r.body)+'</li>').join('');
  card.insertAdjacentHTML('beforeend','<div class="gw-replies"><button type="button" class="gw-open" data-gw-open>💬 '+(n?n+' repl'+(n===1?'y':'ies'):'Reply')+'</button>'+(list?'<ul>'+(n>3?'<li class="gw-more">'+(n-3)+' earlier</li>':'')+list+'</ul>':'')+
   '<form class="gw-form" data-gw-form="'+esc(p.id)+'" hidden><input maxlength="140" placeholder="Reply anonymously…" aria-label="Your reply"><button>Send</button></form></div>')});
 // Today's top tip goes first, under any pinned Hafrik posts.
 const top=feed.querySelector('.gw-top');if(top){const pinned=[...feed.querySelectorAll('article.gossip-card.official')].pop();pinned?pinned.after(top):feed.prepend(top)}
 feed.querySelectorAll('[data-gw-react]').forEach(b=>b.onclick=()=>send({action:'react',id:+b.dataset.gwReact,kind:b.dataset.kind}));
 feed.querySelectorAll('[data-gw-open]').forEach(b=>b.onclick=()=>{const f=b.parentElement.querySelector('form');f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus()});
 feed.querySelectorAll('[data-gw-form]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const t=f.querySelector('input').value.trim();if(t.length<2)return;f.querySelector('button').disabled=true;
  send({action:'reply',id:+f.dataset.gwForm,body:t}).catch(()=>{}).finally(()=>{if(f.isConnected)f.querySelector('button').disabled=false})});
 chips(feed)}
// Place chips above the feed: All, or one place (from the #tag in each tip).
function chips(feed){let bar=feed.parentElement?.querySelector('.gw-chips');
 if(!bar){bar=document.createElement('div');bar.className='gw-chips';feed.before(bar)}
 bar.innerHTML=[['','All']].concat(PLACES).map(([k,l])=>'<button type="button" data-gw-chip="'+k+'" class="'+(filter===k?'on':'')+'">'+esc(l)+'</button>').join('');
 bar.querySelectorAll('[data-gw-chip]').forEach(b=>b.onclick=()=>{filter=b.dataset.gwChip;chips(feed)});
 feed.querySelectorAll('article.gossip-card').forEach(c=>{c.hidden=!!filter&&c.dataset.place!==filter&&!c.classList.contains('official')});
 const hint=feed.parentElement?.querySelector('#gistNightForm .gw-hint');if(!hint)feed.parentElement?.querySelector('#gistNightForm label')?.insertAdjacentHTML('beforeend','<small class="gw-hint">Add a place: #club #campus #football #hq</small>')}
window.ChinaLifeGossipWall={on,decorate,KINDS,PLACES};
const css=document.createElement('style');css.textContent='.gw-chips{display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px}.gw-chips button{flex:none;min-height:40px;padding:0 12px;border-radius:18px;border:1px solid #d6ebe5;background:#fff;font-weight:600}.gw-chips button.on{background:#0C3F44;color:#fff;border-color:#0C3F44}'+
 '.gw-place{font-size:12px;font-weight:700;color:#1F8E93}.gw-crown{font-size:12px;font-weight:800;color:#b07a00;background:#fff4c2;padding:2px 8px;border-radius:10px}.gossip-card.gw-top{box-shadow:0 0 0 2px #f2c14e}'+
 '.gw-reacts{flex-wrap:wrap}.gw-replies{margin-top:8px}.gw-replies ul{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px}.gw-replies li{font-size:13px;padding:6px 10px;border-radius:12px;background:rgba(12,63,68,.06)}.gw-replies li b{margin-right:4px}.gw-more{opacity:.7}'+
 '.gw-open{min-height:36px;border:0;background:none;color:#1F8E93;font-weight:700;padding:0}.gw-form{display:flex;gap:6px;margin-top:6px}.gw-form input{flex:1;min-height:40px;border-radius:12px;border:1px solid #cfe3dd;padding:0 10px}.gw-form button{min-height:40px;padding:0 14px;border:0;border-radius:12px;background:#1F8E93;color:#fff;font-weight:700}.gw-hint{display:block;font-size:12px;opacity:.75;margin-top:4px}';document.head?.append(css);
})();
