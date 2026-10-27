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
 window.ChinaLifeFlags={OFF,
  appOff:id=>OFF.apps.includes(id)&&!on().has(id),
  placeOff:id=>(OFF.places.includes(id)&&!on().has(id)||oneCityOff(id))&&!keepPlace(id),
  off:name=>OFF.features.includes(name)&&!on().has(name)};
})();
// R1 lazy loader for rarely used scripts (admin weekly editor, flight cabin). Resolves once the script has run.
(()=>{const done=new Map();window.ChinaLifeLazy=src=>{if(!done.has(src))done.set(src,new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src+'?v=r1';s.onload=()=>ok();s.onerror=()=>{done.delete(src);fail(Error('Could not load '+src))};document.head.append(s)}));return done.get(src)}})();
