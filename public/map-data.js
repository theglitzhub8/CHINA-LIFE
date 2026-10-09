// Map data for every city: the street grid, the twelve neighbourhoods and their visual style, the shared base
// positions of core places, and what differs per city. Places that belong to one city (catalog content and the
// Guangzhou landmarks) bring their own positions from catalog.js. Map code reads this; it holds no city specifics.
export const GRID={xs:[-68,-34,0,34,68],zs:[-48,-16,16,48],width:148,depth:112,riverZ:20};
// Styles drive how districts.js builds each block: residential, student, campus, rail, food, centre, cbd,
// shopping, gardens, nightlife, riverfront and airport.
export const DISTRICTS=[
 {name:'Residential quarter',x:-50,z:-42,style:'residential'},{name:'Student quarter',x:-17,z:-42,style:'student'},{name:'University campus',x:17,z:-42,style:'campus'},{name:'Rail district',x:51,z:-42,style:'rail'},
 {name:'Food & community',x:-50,z:-9,style:'food'},{name:'City centre',x:-17,z:-9,style:'centre'},{name:'Business district',x:17,z:-9,style:'cbd'},{name:'Shopping district',x:51,z:-9,style:'shopping'},
 {name:'City gardens',x:-50,z:23,style:'gardens'},{name:'Nightlife district',x:-17,z:23,style:'nightlife'},{name:'Riverfront',x:17,z:23,style:'riverfront'},{name:'Airport district',x:51,z:23,style:'airport'}];
export const BASE_POSITIONS={home:[-50,-32],church:[-50,-23],ef:[-17,-33],cafe:[-17,-23],campus:[17,-32],gym:[17,-23],university:[34,-32],liaoning:[51,-22],dongbei:[34,-10],station:[68,-32],market:[-50,0],african:[-40,3],plaza:[-17,0],voting:[-5,0],skylight:[7,9],hotel:[-6,10],business:[17,0],mall:[51,0],academy:[40,9],park:[-50,32],palace:[-38,40],zhongjie:[-60,-8],night:[-17,32],blood:[-28,40],airport:[49,48],hq:[0,-74]};
// Per city: climate flags, the welcome sign, upgraded prototype blocks, position overrides and district renames.
export const CITY_MAPS={
 Shenyang:{north:true,welcome:'WELCOME TO SHENYANG',prototype:'centre',positions:{hotel:[-6,-9]}},
 Harbin:{north:true},Beijing:{north:true},Chengdu:{},Shenzhen:{coastal:true},Shanghai:{coastal:true},
 Guangzhou:{coastal:true,welcome:'WELCOME TO GUANGZHOU',districts:['Baiyun','Tianhe · University Town','Tianhe · Sports Centre','Huangpu','Liwan · Old Town','Yuexiu · City centre','Zhujiang New Town','Tianhe CBD','Liwan riverside','Haizhu · Pearl River','Haizhu · Pazhou','Panyu · Nansha'].map(name=>({name}))}};
export function cityMap(name){const m=CITY_MAPS[name]||{};return {north:!!m.north,coastal:!!m.coastal,welcome:m.welcome||null,prototype:m.prototype||null,positions:m.positions||{},
 districts:DISTRICTS.map((d,i)=>({...d,name:i===8&&m.coastal?'Riverside gardens':d.name,...(m.districts?.[i]||{})}))}}
