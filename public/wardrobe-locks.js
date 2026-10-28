// University Years wardrobe (appadmin switch wardrobe_locks): stylish clothes are milestones, not paywalls.
// Each locked item has two rules: one for students while university years are on, one for everyone else.
// Rules: 'year:N' university year N, 'graduated', 'home' (your first bought home), 'xp:N' (the rank at N XP).
// Items you already own stay yours. chinalife-api/wardrobe-locks.php holds the same list for the server (save.php);
// tests/university-years.mjs fails while the two differ.
(()=>{const RULES={'jacket-varsity':['year:2','xp:200'],'jacket-leather':['home','home'],'leather-white':['home','home'],
 'suit-tailored':['graduated','xp:1500'],'trousers-suit':['graduated','xp:1500'],'qipao-silk':['xp:600','xp:600'],'loafers':['xp:600','xp:600'],
 'chain':['xp:1500','xp:1500'],'gown-evening':['xp:3500','xp:3500'],'designer-sneakers':['xp:3500','xp:3500'],'handbag':['xp:7000','xp:7000'],'luxwatch':['xp:12000','xp:12000']};
const RANKS={200:'Explorer',600:'Local',1500:'Regular',3500:'Insider',7000:'Shenyang Star',12000:'Legend'};
const label=r=>r==='graduated'?'Graduation':r==='home'?'Your first apartment':r.startsWith('year:')?'University Year '+r.slice(5):(RANKS[r.slice(3)]||r.slice(3)+' XP')+' rank';
const on=k=>window.ChinaLifeFlags?.cast?.(k)===true;
const rule=(s,id)=>{const r=RULES[id];return r?r[s?.background==='Student'&&on('uni_years')?0:1]:null};
function met(s,r){if(r==='graduated')return !!s?.student?.graduated;if(r==='home')return Object.keys(s?.properties||{}).length>0||(s?.ownedHomes||[]).length>0;
 if(r.startsWith('year:'))return (window.ChinaLifeUniversity?.status?.year||1)>=Number(r.slice(5));return (s?.xp||0)>=Number(r.slice(3))}
// '' when the item can be bought, otherwise what unlocks it.
function reason(s,id){if(!on('wardrobe_locks'))return '';const r=rule(s,id);return r&&!met(s,r)?label(r):''}
// The admin can change these rules, the allowance and the campus store prices (appadmin University tab). They are read
// from uni-settings.php while wardrobe_locks or uni_food is on, at most once a minute, and passed on as 'chinalife:uni-settings'.
const valid=r=>typeof r==='string'&&(/^(|graduated|home|year:[234])$/.test(r)||/^xp:\d{1,7}$/.test(r));let fetched=0;
function apply(d){if(!d||typeof d!=='object')return;if(d.wardrobe&&typeof d.wardrobe==='object'){for(const k of Object.keys(RULES))delete RULES[k];
  for(const [k,r] of Object.entries(d.wardrobe))if(Array.isArray(r)&&r.length===2&&valid(r[0])&&valid(r[1]))RULES[k]=[r[0],r[1]]}
 window.dispatchEvent(new CustomEvent('chinalife:uni-settings',{detail:d}))}
async function load(){if(!(on('wardrobe_locks')||on('uni_food'))||!window.ChinaLifeCloud?.signedIn||Date.now()-fetched<60e3)return;fetched=Date.now();
 try{const r=await window.ChinaLifeAuth.request('/chinalife/uni-settings.php');apply(r?.data||r)}catch{fetched=0}}
window.addEventListener?.('chinalife:cast',load);window.setInterval?.(load,5*60e3);window.setTimeout?.(load,8000);window.setTimeout?.(load,30000);
window.ChinaLifeWardrobeLocks={RULES,reason,label,meets:met,apply,load};
})();
