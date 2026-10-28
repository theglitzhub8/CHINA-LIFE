// University Years food economy (switch uni_food): the student's ¥100 daily allowance (paid by allowance.php), a campus
// store selling ingredients, a fridge, and cooking at home: ten known recipes, or 2-4 ingredients of your own choice.
// A sensible mix feeds you and trains Cooking; a bad one gives food sickness for 3 hours (no real meal, low energy and an
// urgent toilet trip every 25 minutes) until it passes or a doctor at the City Hospital treats it.
// Ordering a ready meal costs ¥40, so two a day eat most of the allowance; cooking costs about ¥8-17 a meal.
// Saved in state.food (fridge, sickness, meals cooked); money is spent on the device like every other purchase.
(()=>{const $=id=>document.getElementById(id),G=()=>window.ChinaLife,C=()=>window.ChinaLifeCloud;
// A new screen starts at the top (the sheet keeps the last scroll position, and r4.js's sticky title follows the scroll).
const show=(...a)=>{G().showScreen(...a);const c=$('activityContent');if(c){c.scrollTop=0;c.dispatchEvent(new Event('scroll'))}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const campus=p=>['campus','ef','university','liaoning','dongbei','academy'].includes(p)||/univ|campus/.test(String(p||''));
const home=p=>p==='home'||!!G()?.isResidence?.(p);
const on=()=>window.ChinaLifeFlags?.cast?.('uni_food')===true&&G()?.state?.created&&G().state.background==='Student';
// [name, Chinese, icon, price ¥, group]
const ING={rice:['Rice','米饭','🍚',3,'staple'],noodles:['Noodles','面条','🍜',4,'staple'],potato:['Potato','土豆','🥔',2,'staple'],plantain:['Plantain','大蕉','🍌',4,'staple'],wrappers:['Dumpling wrappers','饺子皮','🥟',5,'staple'],
 egg:['Egg','鸡蛋','🥚',2,'protein'],tofu:['Tofu','豆腐','⬜',4,'protein'],beans:['Beans','豆子','🫘',3,'protein'],chicken:['Chicken','鸡肉','🍗',9,'meat'],pork:['Pork','猪肉','🥓',9,'meat'],beef:['Beef','牛肉','🥩',12,'meat'],
 tomato:['Tomato','西红柿','🍅',3,'veg'],greens:['Bok choy','青菜','🥬',3,'veg'],onion:['Onion','洋葱','🧅',1,'veg'],
 chili:['Chili','辣椒','🌶️',1,'flavour'],garlic:['Garlic','大蒜','🧄',1,'flavour'],soy:['Soy sauce','酱油','🫙',2,'flavour']};
// [id, name, Chinese, ingredients, hunger]
const RECIPES=[['tomato-egg','Tomato and egg on rice','西红柿炒鸡蛋',['tomato','egg','rice'],55],['fried-rice','Egg fried rice','蛋炒饭',['rice','egg','greens'],50],['noodle-soup','Bok choy noodle soup','青菜面',['noodles','greens','egg'],50],
 ['mapo-tofu','Mapo tofu','麻婆豆腐',['tofu','pork','chili','rice'],60],['jollof','Jollof rice','加纳炒饭',['rice','tomato','onion','chili'],60],['dumplings','Pork dumplings','饺子',['wrappers','pork','greens'],60],
 ['beef-noodles','Beef noodles','牛肉面',['noodles','beef','chili'],60],['potato-strips','Hot and sour potato strips','酸辣土豆丝',['potato','chili','garlic'],40],['chicken-rice','Garlic chicken rice','鸡饭',['chicken','rice','garlic'],55],
 ['plantain-beans','Plantain and beans','大蕉炖豆子',['plantain','beans','onion'],55]];
// Pairs that do not belong in one pan.
const BAD=[['plantain','soy'],['beans','soy'],['tofu','beef'],['egg','beans'],['tomato','wrappers']];
const FRIDGE=30,SICK_MS=3*3600e3,CRAMP_MS=25*60e3;let ORDER=40;
// The admin sets the meal and ingredient prices in appadmin's University tab (wardrobe-locks.js loads them).
window.addEventListener?.('chinalife:uni-settings',e=>{const d=e.detail||{};if(Number.isInteger(d.mealPrice))ORDER=d.mealPrice;for(const [k,v] of Object.entries(d.food||{}))if(ING[k]&&Number.isInteger(v))ING[k][3]=v});
const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
// What a pan of ingredients turns into: a known recipe, your own dish, or something that will make you ill.
function evaluate(list){const ids=[...new Set(list)].filter(id=>ING[id]);if(ids.length<2||ids.length>4)return {ok:false,why:'Choose 2 to 4 ingredients.'};
 const r=RECIPES.find(r=>same(r[3],ids));if(r)return {ok:true,recipe:r[0],name:r[1],zh:r[2],hunger:r[4],xp:25,sick:false};
 const g=id=>ING[id][4],meats=ids.filter(id=>g(id)==='meat'),body=ids.filter(id=>g(id)!=='flavour');
 const bad=meats.length>1?'Two kinds of meat in one pan did not end well.':!body.length?'That was only seasoning.':meats.length&&!ids.some(id=>['staple','veg'].includes(g(id)))?'The meat was not cooked through.':BAD.find(p=>p.every(x=>ids.includes(x)))?'Those flavours really did not go together.':'';
 if(bad)return {ok:true,name:'Mystery dish',zh:'怪菜',hunger:5,xp:5,sick:true,why:bad};
 return {ok:true,name:'Your own dish',zh:'自创菜',hunger:Math.min(52,20+8*body.length),xp:10,sick:false}}
// Saves are untrusted: keep known ingredients and recipes, sane counts and times.
function validate(v){const r={fridge:{},sick:null,meals:{},cooked:0,orders:0};if(!v||typeof v!=='object')return r;const int=(x,max)=>Number.isInteger(x)&&x>=0?Math.min(x,max):0;
 for(const [k,n] of Object.entries(v.fridge||{}))if(ING[k]&&int(n,FRIDGE))r.fridge[k]=int(n,FRIDGE);
 for(const [k,n] of Object.entries(v.meals||{}))if(RECIPES.some(x=>x[0]===k)&&int(n,100000))r.meals[k]=int(n,100000);
 r.cooked=int(v.cooked,100000);r.orders=int(v.orders,100000);
 if(v.sick&&Number.isFinite(v.sick.until)&&Number.isFinite(v.sick.next))r.sick={until:v.sick.until,next:v.sick.next,why:typeof v.sick.why==='string'?v.sick.why.slice(0,120):''};return r}
// Clean each loaded food object once and keep using that same object (a cook in progress holds on to it).
const clean=new WeakSet();const food=()=>{const s=G().state;if(!s.food||!clean.has(s.food)){s.food=validate(s.food);clean.add(s.food)}return s.food};
const count=f=>Object.values(f.fridge).reduce((a,b)=>a+b,0);
const clamp=(n,k,d)=>{n[k]=Math.max(0,Math.min(100,(n[k]??50)+d))};
function buy(id,n=1){const g=G(),s=g.state,f=food();if(!ING[id])return false;if(!campus(s.place)){g.toast?.('The campus store is at your university.');return false}
 if(count(f)+n>FRIDGE){g.toast?.('Your fridge is full ('+FRIDGE+' items).');return false}const cost=ING[id][3]*n;if(s.money<cost){g.toast?.('Not enough money.');return false}
 s.money-=cost;f.fridge[id]=(f.fridge[id]||0)+n;g.save?.();g.refresh?.();return true}
function order(){const g=G(),s=g.state,f=food();if(s.money<ORDER){g.toast?.('A meal costs ¥'+ORDER+'.');return false}s.money-=ORDER;clamp(s.needs,'hunger',45);f.orders++;g.save?.();g.refresh?.();g.toast?.('🛵 Your meal arrived · −¥'+ORDER+' · +45 hunger');return true}
function sick(why){const f=food(),n=G().state.needs;f.sick={until:Date.now()+SICK_MS,next:Date.now()+CRAMP_MS,why};clamp(n,'energy',-15);clamp(n,'fun',-10);n.bladder=Math.min(n.bladder??50,10);
 G().notify?.('🤢 Food sickness: '+why+' Find a toilet now. It passes in 3 hours, or see a doctor at the City Hospital.',()=>open())}
// Cook at home: the ingredients leave the fridge, the character walks to the kitchen, then the meal applies.
function cook(list){const g=G(),s=g.state,f=food(),ids=[...new Set(list)];if(!home(s.place)){g.toast?.('Cook in your home or dorm kitchen.');return false}if(window.ChinaLifeWorld?.busy){g.toast?.('Finish what you are doing first.');return false}
 const e=evaluate(ids);if(!e.ok){g.toast?.(e.why);return false}if(ids.some(id=>!(f.fridge[id]>0))){g.toast?.('Buy the missing ingredients at the campus store.');return false}
 for(const id of ids){f.fridge[id]--;if(!f.fridge[id])delete f.fridge[id]}
 const done=()=>{const n=s.needs,f=food();f.cooked++;if(e.recipe)f.meals[e.recipe]=(f.meals[e.recipe]||0)+1;clamp(n,'hunger',e.hunger);g.gain?.('Cooking',e.xp);
  if(e.sick)sick(e.why);else g.toast?.('🍳 '+e.name+' '+e.zh+' · +'+e.hunger+' hunger · Cooking +'+e.xp);g.save?.();g.refresh?.();render()};
 if(!window.ChinaLifeWorld?.perform?.({kind:'cook',label:'Cooking '+e.name},done))done();g.save?.();return true}
// Cramps while sick, and a doctor's visit cures it. Runs every 30 s.
function tick(){if(!G()?.state?.created)return;const f=G().state.food;if(!f?.sick)return render();const t=Date.now(),g=G();
 if(t>=f.sick.until||g.state.place==='cityhospital'){f.sick=null;g.toast?.(g.state.place==='cityhospital'?'👩‍⚕️ The doctor gave you medicine. Your stomach is fine again.':'Your stomach has settled.');g.save?.();return render()}
 if(t>=f.sick.next){f.sick.next=t+CRAMP_MS;g.state.needs.bladder=Math.min(g.state.needs.bladder??50,10);g.notify?.('🤢 Stomach cramps! You need a toilet right now.',()=>open());g.save?.();g.refresh?.()}render()}
let claiming=false,claimedDay='';
async function claim(){if(!on()||claiming||!C()?.allowance)return null;const day=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);if(claimedDay===day)return null;claiming=true;
 try{const d=await C().allowance();claimedDay=day;if(d?.paid)G().toast?.('🎓 Student allowance: +¥'+d.paid+'. Food money for today.');return d}catch{return null}finally{claiming=false}}
function store(){const g=G(),s=g.state,f=food(),here=campus(s.place);
 show('🛒 Campus store','Fridge '+count(f)+'/'+FRIDGE+' · ¥'+s.money+(here?'':' · you are not at a campus'),
  '<div class="uni-card"><p>'+(here?'Fresh ingredients for your dorm kitchen. Cooking costs about ¥8-17 a meal; ordering one costs ¥'+ORDER+'.':'The campus store is at your university. You can look, but you can only buy there.')+'</p><ul class="uni-list kit-list">'+
  Object.entries(ING).map(([id,i])=>'<li><span>'+i[2]+' '+esc(i[0])+' <small>'+esc(i[1])+'</small></span><b>¥'+i[3]+'</b><small>'+(f.fridge[id]||0)+' in fridge</small><button data-kit-buy="'+id+'"'+(here?'':' disabled')+'>Buy</button></li>').join('')+'</ul></div>');
 document.querySelectorAll('[data-kit-buy]').forEach(b=>b.onclick=()=>{if(buy(b.dataset.kitBuy))store()})}
let picked=[];
function open(){const g=G(),s=g.state,f=food(),athome=home(s.place),sk=f.sick;
 const can=r=>r[3].every(id=>f.fridge[id]>0);
 const recipes=RECIPES.map(r=>'<li><span>'+esc(r[1])+' <small>'+esc(r[2])+'</small><br><small>'+r[3].map(id=>ING[id][2]).join(' ')+' · +'+r[4]+' hunger · ¥'+r[3].reduce((a,id)=>a+ING[id][3],0)+'</small></span><button data-kit-cook="'+r[0]+'"'+(athome&&can(r)?'':' disabled')+'>Cook</button></li>').join('');
 const fridge=Object.entries(f.fridge).map(([id,n])=>'<button class="kit-chip'+(picked.includes(id)?' on':'')+'" data-kit-pick="'+id+'">'+ING[id][2]+' '+esc(ING[id][0])+' ×'+n+'</button>').join('')||'<p class="uni-next">Your fridge is empty. Buy ingredients at the campus store.</p>';
 show('🍳 Kitchen','Fridge '+count(f)+'/'+FRIDGE+' · '+f.cooked+' meals cooked'+(athome?'':' · cook at home'),
  '<div class="uni-card">'+(sk?'<div class="uni-score risk"><b>🤢 Food sickness until '+new Date(sk.until).toTimeString().slice(0,5)+'</b><small>'+esc(sk.why)+' Use the toilet when the cramps come, rest, or see a doctor at the City Hospital.</small></div>':'')+
  '<h3>Fridge</h3><div class="kit-fridge">'+fridge+'</div>'+(Object.keys(f.fridge).length>1?'<div class="uni-exams"><button data-kit-free'+(athome&&picked.length>=2?'':' disabled')+'>🍳 Cook my own mix ('+picked.length+'/4)</button></div><p class="uni-next">Tap 2 to 4 ingredients to try your own dish. Some mixes go wrong.</p>':'')+
  '<h3>Recipes</h3><ul class="uni-list kit-list">'+recipes+'</ul><div class="uni-exams"><button data-kit-store>🛒 Campus store</button><button data-kit-order>🛵 Order a meal · ¥'+ORDER+' · +45 hunger</button></div></div>');
 document.querySelectorAll('[data-kit-pick]').forEach(b=>b.onclick=()=>{const id=b.dataset.kitPick;picked=picked.includes(id)?picked.filter(x=>x!==id):[...picked,id].slice(-4);open()});
 document.querySelectorAll('[data-kit-cook]').forEach(b=>b.onclick=()=>{const r=RECIPES.find(x=>x[0]===b.dataset.kitCook);$('activityDialog')?.close?.();cook(r[3])});
 const free=document.querySelector('[data-kit-free]');if(free)free.onclick=()=>{const list=picked;picked=[];$('activityDialog')?.close?.();cook(list)};
 document.querySelector('[data-kit-store]').onclick=()=>store();document.querySelector('[data-kit-order]').onclick=()=>{order();open()}}
// At home, a chip opens the kitchen.
let chip=null;
function render(){const g=G(),show=on()&&home(g?.state?.place)&&!document.querySelector('dialog[open]');if(!show){chip?.remove();chip=null;return}const f=food(),k=count(f)+'|'+!!f.sick;
 if(!chip){chip=document.createElement('div');chip.className='r5-attend kitchen-chip';chip.setAttribute('role','status');($('worldUI')||document.body).appendChild(chip)}if(chip.dataset.k===k)return;chip.dataset.k=k;
 chip.innerHTML='<span class="r5-ic">'+(f.sick?'🤢':'🍳')+'</span><p><b>'+(f.sick?'Food sickness':'Kitchen')+'</b><small>'+count(f)+' in the fridge · cook or order food</small></p><button type="button">Open</button>';chip.querySelector('button').onclick=()=>open()}
setInterval(tick,30000);
// game.js restores the save before this file loads; clean the food part now.
try{if(G()?.state?.food)food()}catch{}
window.ChinaLifeKitchen={on,ING,RECIPES,evaluate,validate,buy,cook,order,store,open,claim,tick,get state(){return G()?.state?.food}};
window.addEventListener('chinalife:cloudready',()=>setTimeout(claim,2500));window.addEventListener('chinalife:cast',()=>{claimedDay='';claim()});window.addEventListener('chinalife:update',()=>{claim();render()});
const watch=()=>{const t=$('worldVenueTitle');if(!t)return setTimeout(watch,1000);new MutationObserver(()=>{tick();claim()}).observe(t,{childList:true,characterData:true,subtree:true})};watch();
document.addEventListener('close',()=>setTimeout(render,50),true);
const css=document.createElement('style');css.textContent='.kit-list li{display:grid;grid-template-columns:1fr auto auto;gap:4px 10px;align-items:center;padding:8px 0;border-bottom:1px solid #e3efeb}.kit-list li small{color:#55706c}.kit-list li>small{grid-column:1}.kit-list button{padding:8px 12px;border-radius:12px;border:1px solid #cfe3dd;background:#f3fbf8;font-weight:700}.kit-list button:disabled{opacity:.45}.kit-fridge{display:flex;flex-wrap:wrap;gap:6px}.kit-chip{padding:7px 10px;border-radius:12px;border:1px solid #cfe3dd;background:#fff}.kit-chip.on{background:#1f8a70;color:#fff;border-color:#1f8a70}';document.head.append(css);
})();
