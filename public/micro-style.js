// University Years micro-customization (appadmin switch micro_style): small details on clothes you own, so two people
// in the same outfit never look identical. Saved per item in state.wardrobe.details[itemId]:
//   tops: btn (button colour: shirts, suits, jackets), collar (shirts, suits, jackets), stitch (hem stitching)
//   trousers (jeans, chinos, joggers): len (full or cropped), fit (slim, regular, wide), stitch (seam stitching)
//   backpack and handbag: col (colourway), graphic
// Rare options unlock with milestones (same rules as wardrobe-locks.js). chinalife-api/micro-style.php keeps the same
// lists for the server (save.php, presence.php); tests/university-years.mjs fails while they differ.
(()=>{const PAL={btn:['#d8c08a','#f4f4f2','#1f1f1f','#8a5a3c','#b8c4cc','#3fae8a'],stitch:['#f4f4f2','#d8c08a','#c0392b','#2d6cdf','#1f1f1f','#ffd34d'],col:['#2f4a6b','#7a1f2b','#1f3a2e','#e6d3b3','#1f1f1f','#c9a24a']};
const ENUM={collar:['classic','mandarin','spread','v'],len:['full','crop'],fit:['slim','regular','wide'],graphic:['none','star','stripe','heart','panda']};
// Which details each clothing style takes.
const FIELDS={shirt:['btn','collar','stitch'],suit:['btn','collar','stitch'],jacket:['btn','collar','stitch'],tee:['stitch'],tank:['stitch'],hoodie:['stitch'],sweater:['stitch'],
 jeans:['len','fit','stitch'],chinos:['len','fit','stitch'],joggers:['len','fit','stitch'],backpack:['col','graphic'],handbag:['col','graphic']};
// 'field:value' → [rule for students with university years, rule for everyone else] (see wardrobe-locks.js).
const RARE={'btn:#3fae8a':['graduated','xp:1500'],'stitch:#ffd34d':['xp:3500','xp:3500'],'col:#c9a24a':['xp:7000','xp:7000'],'graphic:panda':['year:2','xp:600']};
const NAMES={btn:'Buttons',collar:'Collar',stitch:'Stitching',len:'Length',fit:'Fit',col:'Colourway',graphic:'Graphic'};
const LABEL={classic:'Classic',mandarin:'Mandarin',spread:'Spread',v:'V-neck',full:'Full length',crop:'Cropped',slim:'Slim',regular:'Regular',wide:'Wide',none:'None',star:'⭐ Star',stripe:'〰️ Stripe',heart:'❤️ Heart',panda:'🐼 Panda'};
const valid=(f,v)=>(PAL[f]||ENUM[f]||[]).includes(v);
const store=()=>window.ChinaLifeStore?.items||[],styleOf=id=>store().find(i=>i.id===id)?.style;
// Saves are untrusted: only owned items, only the fields their style takes, only listed values.
function clean(details,owned){const out={};if(!details||typeof details!=='object')return out;for(const [id,d] of Object.entries(details).slice(0,60)){if(!owned?.includes(id)||!d||typeof d!=='object')continue;
 const f=FIELDS[styleOf(id)];if(!f)continue;const c={};for(const k of f)if(valid(k,d[k]))c[k]=d[k];if(Object.keys(c).length)out[id]=c}return out}
const L=()=>window.ChinaLifeWardrobeLocks;
// '' when the option can be chosen, otherwise what unlocks it.
function rareLock(s,field,value){const r=RARE[field+':'+value];if(!r)return '';const rule=r[s?.background==='Student'&&window.ChinaLifeFlags?.cast?.('uni_years')===true?0:1];return L()?.meets?.(s,rule)?'':L()?.label?.(rule)||'a milestone'}
const on=()=>window.ChinaLifeFlags?.cast?.('micro_style')===true;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The "Customise" block under an owned item in the store.
function panel(it,w,s){if(!on()||!it||!w?.owned?.includes(it.id))return '';const f=FIELDS[it.style];if(!f)return '';const d=(w.details||{})[it.id]||{};
 return '<div class="ms-panel"><b>✂️ Customise</b>'+f.map(k=>'<div class="ms-row"><small>'+NAMES[k]+'</small><div>'+(PAL[k]||ENUM[k]).map(v=>{const lock=rareLock(s,k,v),cur=d[k]===v;
  return PAL[k]?'<button data-ms="'+k+'" data-v="'+v+'" class="ms-sw'+(cur?' active':'')+'" style="background:'+v+'" aria-label="'+NAMES[k]+' '+v+(lock?' (unlocks with '+esc(lock)+')':'')+'"'+(lock?' disabled title="🔒 '+esc(lock)+'"':'')+'>'+(lock?'🔒':'')+'</button>'
   :'<button data-ms="'+k+'" data-v="'+v+'" class="ms-opt'+(cur?' active':'')+'"'+(lock?' disabled title="🔒 '+esc(lock)+'"':'')+'>'+(lock?'🔒 ':'')+LABEL[v]+'</button>'}).join('')+'</div></div>').join('')+'</div>'}
function bind(it,w,s,done){document.querySelectorAll('[data-ms]').forEach(b=>b.onclick=()=>{const k=b.dataset.ms,v=b.dataset.v;if(!valid(k,v)||rareLock(s,k,v))return;
 w.details=w.details||{};const d=w.details[it.id]=w.details[it.id]||{};if(d[k]===v)delete d[k];else d[k]=v;if(!Object.keys(d).length)delete w.details[it.id];done()})}
window.ChinaLifeStyle={PAL,ENUM,FIELDS,RARE,clean,rareLock,panel,bind,on};
const css=document.createElement('style');css.textContent='.ms-panel{display:grid;gap:8px;margin-top:10px;padding:10px;border-radius:14px;background:#f3fbf8}.ms-row{display:grid;gap:4px}.ms-row>div{display:flex;flex-wrap:wrap;gap:6px}.ms-sw{width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #cfe3dd;font-size:11px}.ms-sw.active,.ms-opt.active{box-shadow:0 0 0 3px #1f8a70}.ms-opt{padding:6px 10px;border-radius:12px;border:1px solid #cfe3dd;background:#fff;font-weight:700}.ms-sw:disabled,.ms-opt:disabled{opacity:.55}';document.head?.append(css);
})();
