// R1 feature flags. Switched-off features stay in the code and the database; they are only hidden.
// To turn one back on, remove it from the list (or, for testing, set localStorage 'chinalife-flags-on' to a comma list such as "politics,park").
// Players keep everything they own: a hidden venue still shows for anyone whose home, campus or job is there.
(()=>{
 const OFF={
  // Phone apps: politics, police, court, Cantaball, extras and duplicates.
  apps:['politics','police','court','cantaball','spaces','journal','cloud','celebrate','marketplace','ai','tasks','hafrikEvents'],
  // Venues with 1–3 visitors in the audit (map pins, search and lists only).
  places:['park','gamecenter','roachfarm','k11','partypier','ex','orangutan','gdufs','scau','gzucm'],
  // Whole features.
  features:['politics','cantaball']
 };
 const on=()=>{try{return new Set((localStorage.getItem('chinalife-flags-on')||'').split(',').map(s=>s.trim()).filter(Boolean))}catch{return new Set()}};
 const keepPlace=id=>{const s=window.ChinaLife?.state;if(!s)return false;const job=window.ChinaLife?.jobPlace?.(s.job);return s.place===id||s.student?.campus===id||s.home===id||job===id||(s.job==='roach-farmer'||s.job==='roach-manager')&&id==='roachfarm'};
 // One-city mode (one-city.js): every venue outside the seven destinations is hidden, never deleted. Homes stay.
 const oneCityOff=id=>!!window.ChinaLifeOneCity&&!window.ChinaLifeOneCity.allows(id)&&!window.ChinaLife?.isResidence?.(id);
 // Oct 2026 cast switches from appadmin Features (hafrik-features.php): ai_characters (default OFF), club_pappi (one-city
 // Club, default OFF) and club_hypeman (one-city Club, default ON). Until the server answers (or for guests) the defaults
 // apply. For testing, localStorage 'chinalife-flags-on' / 'chinalife-flags-off' (comma lists) override either way.
 // One-city phone (founder, 28 Oct 2026): the apps kept on the one-city phone. Everything else is hidden there, grouped
 // under one appadmin switch each (APP_GROUPS, default OFF). Classic mode keeps the R1 list above. 'police' stays
 // as "My reports" (the player report system) inside the Court app.
 // University Years plan (docs/UNIVERSITY-YEARS-PLAN.md): uni_years, uni_food, wardrobe_locks, micro_style and real_sitting, all default OFF.
 // Gossip Room plan (docs/GOSSIP-ROOM-PLAN.md): gossip_room, gossip_show, gossip_wall, gossip_city and gossip_rep, default OFF.
 // Hospital plan (docs/HOSPITAL-PLAN.md): hospital_care, hospital_checkup, hospital_pharmacy, hospital_staff, hospital_visits, default OFF.
 const ONE_CITY_APPS=['whereto','people','football','gossiproom','hotseat','gossiptv','wallet','exchange','marketplace','hafrikEvents','services','hafrikBusiness','spaces','tasks','goals','rank','work','jobs','earn','studio','university','chinese','skills','academy','community','police','court','shop','settings','notifications','admin'];
 const APP_GROUPS={app_launches:['celebrate'],app_travel:['travel','guide','driving'],app_homes:['home','homes'],app_cantaball:['cantaball'],app_story:['story'],app_politics:['politics'],app_delivery:['delivery'],app_needs:['needs'],app_together:['together'],app_opportunities:['fortune'],app_journal:['journal','cloud'],app_meet:['meet'],app_firstday:['firstday'],app_events:['events']};
 const CAST={ai_characters:false,club_pappi:false,club_hypeman:true,uni_years:false,uni_food:false,wardrobe_locks:false,micro_style:false,real_sitting:false,gossip_room:false,gossip_show:false,gossip_wall:false,gossip_city:false,gossip_rep:false,hospital_care:false,hospital_checkup:false,hospital_pharmacy:false,hospital_staff:false,hospital_visits:false,...Object.fromEntries(Object.keys(APP_GROUPS).map(k=>[k,false]))};
 const oneCityApp=id=>{if(ONE_CITY_APPS.includes(id))return true;const g=Object.keys(APP_GROUPS).find(k=>APP_GROUPS[k].includes(id));return g?cast(g):false};let served={};
 const offList=()=>{try{return new Set((localStorage.getItem('chinalife-flags-off')||'').split(',').map(s=>s.trim()).filter(Boolean))}catch{return new Set()}};
 const cast=key=>{if(!(key in CAST))return false;if(on().has(key))return true;if(offList().has(key))return false;return typeof served[key]==='boolean'?served[key]:CAST[key]};
 const castKey=()=>Object.keys(CAST).map(cast).join();
 window.addEventListener?.('chinalife:hafrik-features',e=>{const before=castKey();served={...(e.detail||{})};if(castKey()!==before)window.dispatchEvent(new CustomEvent('chinalife:cast'))});
 window.ChinaLifeFlags={OFF,CAST,cast,
  ONE_CITY_APPS,APP_GROUPS,
  appOff:id=>id==='ai'?!cast('ai_characters'):window.ChinaLifeOneCity?.active?.()?!oneCityApp(id)&&!on().has(id):OFF.apps.includes(id)&&!on().has(id),
  placeOff:id=>(OFF.places.includes(id)&&!on().has(id)||oneCityOff(id))&&!keepPlace(id),
  off:name=>OFF.features.includes(name)&&!on().has(name)};
})();
// R1 lazy loader for rarely used scripts (admin weekly editor, flight cabin). Resolves once the script has run.
(()=>{const done=new Map();window.ChinaLifeLazy=src=>{if(!done.has(src))done.set(src,new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src+'?v=r1';s.onload=()=>ok();s.onerror=()=>{done.delete(src);fail(Error('Could not load '+src))};document.head.append(s)}));return done.get(src)}})();
