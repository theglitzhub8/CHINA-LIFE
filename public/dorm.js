// University Years (switch uni_years): the dorm roommate. Lives in the shared student dorm (home-interiors.js 'dorm'),
// keeps a daily routine on Beijing time (asleep, at class, cooking, studying) and has one small moment a day.
// Placed by hosts.js placeHosts, so nothing in world.js changes. The bond (0-100) is saved in state.dorm.
// The roommate's corner of the dorm layout (home-interiors.js dorm): second bed, second desk chair, kitchen counter.
const DORM_MATE={bed:[-1.6,-2.2],desk:[-3.3,1.7],cook:[1.1,-2.3]};
const MATES={male:[{id:'wei',name:'Wei',from:'Chengdu',skin:0xc69c7a,hair:'cropped',shirt:0x3d6fa8},{id:'kofi',name:'Kofi',from:'Accra',skin:0x5b3a29,hair:'cropped',shirt:0x2f8f6a},{id:'arjun',name:'Arjun',from:'Pune',skin:0x9a6a4a,hair:'cropped',shirt:0xb5523b}],
 female:[{id:'lin',name:'Lin',from:'Harbin',skin:0xd8b294,hair:'bun',shirt:0xc0567a},{id:'amara',name:'Amara',from:'Lagos',skin:0x5b3a29,hair:'bun',shirt:0x7a4fb0},{id:'sofia',name:'Sofia',from:'Almaty',skin:0xe2c2a6,hair:'bun',shirt:0x2f7f9a}]};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dormActive(game,id){return id==='home'&&!window.ChinaLifeHomeVisits?.current&&game.homeType?.('home')==='dorm'}
export function roommate(game){const list=MATES[game.state.gender==='female'?'female':'male'],key=String(game.state.name||'')+'|'+String(game.state.student?.university||'');
 let n=0;for(const ch of key)n=(n*31+ch.charCodeAt(0))>>>0;return list[n%list.length]}
// Where the roommate is at a Beijing hour (state.hour is the Beijing minute of the day).
export function routine(hour){if(hour<7||hour>=23)return {at:'bed',doing:'asleep 💤'};if(hour<8)return {at:'cook',doing:'making breakfast'};
 if(hour<12||(hour>=14&&hour<17))return {at:null,doing:'at class',back:hour<12?'12:00':'17:00'};if(hour<14)return {at:'desk',doing:'resting between classes'};if(hour<19)return {at:'cook',doing:'cooking dinner'};return {at:'desk',doing:'studying'}}
const bond=game=>{const d=game.state.dorm||(game.state.dorm={bond:50,eventDay:0});return d};
// One small moment a day, picked by the day so it is the same on every device.
const MOMENTS=[
 {id:'borrow',ask:m=>'Hey… my food delivery got cancelled. Can I have some of your food? I\'ll cook for you this weekend.',yes:'Share your food',no:'Not today',give:{hunger:-12},bond:[5,-2],thanks:'You\'re a lifesaver! Weekend dumplings are on me 🥟'},
 {id:'quiet',ask:m=>'Exam coming up. Can we keep the room quiet tonight? No music after 22:00?',yes:'Sure, good luck',no:'I have plans',give:{},bond:[3,-3],thanks:'Thank you! I owe you one 🙏'},
 {id:'rubbish',ask:m=>'Small thing: the rubbish is full. Your turn to take it out? 🙂',yes:'On it',no:'Later',give:{fun:-3,hygiene:4},bond:[3,-2],thanks:'Thanks! Room smells better already.'},
 {id:'cooked',ask:m=>'I cooked too much '+(m.from==='Chengdu'?'mapo tofu':m.from==='Accra'||m.from==='Lagos'?'jollof rice':'fried rice')+'. Want some?',yes:'Yes please',no:'I\'m full',give:{hunger:20},bond:[2,0],thanks:'Enjoy! Tell me if it\'s too spicy 🌶️'},
 {id:'study',ask:m=>'Want to practise Chinese together tonight? You quiz me, I quiz you.',yes:'Let\'s do it',no:'Maybe tomorrow',give:{social:8,fun:4},bond:[4,0],thanks:'加油! We\'ve got this.'}];
export function momentFor(day){return MOMENTS[((Math.floor(day)%MOMENTS.length)+MOMENTS.length)%MOMENTS.length]}
const SMALL=['How was your day?','The Wi-Fi is slow again 😩','Did you eat yet? 吃饭了吗?','My mum called, she says hi.','Don\'t forget we have class tomorrow.'];
export function chat(game,m){const s=game.state,d=bond(game),r=routine(Math.floor((s.hour||0)/60)),mo=momentFor(s.day||1),open=d.eventDay!==s.day&&r.at;
 const feel=d.bond>=75?'Close friends':d.bond>=50?'Good roommates':d.bond>=25?'Getting along':'A bit tense';
 game.showScreen('🛏️ '+m.name,esc(m.name)+' from '+esc(m.from)+' · your roommate · '+feel+' ('+Math.round(d.bond)+'/100)',
  '<div class="host-chat"><div class="host-log"><p class="h">'+esc(r.at?(open?mo.ask(m):SMALL[(s.day||1)%SMALL.length]):m.name+' is '+r.doing+'.')+'</p></div>'+
  (open?'<div class="host-chips"><button data-mate="yes">'+esc(mo.yes)+'</button><button data-mate="no">'+esc(mo.no)+'</button></div>':'')+'</div>');
 document.querySelectorAll('[data-mate]').forEach(b=>b.onclick=()=>{const yes=b.dataset.mate==='yes';d.eventDay=s.day;d.bond=Math.max(0,Math.min(100,d.bond+mo.bond[yes?0:1]));
  if(yes)for(const [k,v] of Object.entries(mo.give))if(s.needs&&k in s.needs)s.needs[k]=Math.max(0,Math.min(100,s.needs[k]+v));
  game.save?.();game.toast?.(yes?m.name+': '+mo.thanks:m.name+': Okay, no worries.');chat(game,m)})}
export function placeRoommate(c,id){const game=c.game;if(!dormActive(game,id))return [];const m=roommate(game),r=routine(Math.floor((game.state.hour||0)/60)),label=m.name+' · roommate';
 if(!r.at){const l=c.label('🎒 '+m.name+' is at class · back at '+r.back,DORM_MATE.bed[0],1.6,DORM_MATE.bed[1],'interactive',()=>chat(game,m));if(l)l.el.classList.add('hafrik-host');return []}
 const [x,z]=DORM_MATE[r.at],body=c.person(x,z,m.shirt,m.skin,label,'mate:'+m.id,{skin:m.skin,hair:m.hair,top:{s:'tee',c:m.shirt},bottom:{s:'jeans',c:0x2b2f3a}});
 body.userData.roommate=m.id;body.userData.doing=r.doing;
 // Asleep: lying on the bed, head to the headboard. At the desk: facing the desk on the wall. Cooking: facing the counter.
 if(r.at==='bed'){body.rotation.x=-Math.PI/2;body.position.set(x,.62,z+1)}else body.rotation.y=r.at==='desk'?-Math.PI/2:Math.PI;
 // A sleeper is not an animated actor: the world's idle bob would reset his height into the mattress.
 if(r.at!=='bed')c.addActor(body);const l=c.labelFor(body);if(l){l.el.classList.add('hafrik-host');l.el.textContent=label+' · '+r.doing;l.el.onclick=e=>{e.stopPropagation();chat(game,m)}}return [body]}
