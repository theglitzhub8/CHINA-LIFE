// Club experience (docs/CLUB-PLAN.md). Phase 0: the body. Standing straight, sitting properly on club and VIP sofas,
// tap a sofa to sit, and no see-through copy of your character behind walls.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const r=f=>fs.readFileSync(f,'utf8');

test('standing straight: straightening the spine keeps the thighs where the clip put them',()=>{
 const rl=r('public/realism.js');
 // Biped thighs hang off Bip01_Spine: without this the feet swung ~20 cm in front of the hips and the body leaned back.
 assert.match(rl,/LEGW=\{Bip01_L_Thigh:\[\],Bip01_R_Thigh:\[\]\}/);
 assert.match(rl,/if\(LEGW\[o\.name\]\)LEGW\[o\.name\]\[i\]=w;/);
 assert.match(rl,/const lt2=ws\.clone\(\)\.invert\(\)\.multiply\(LEGW\[tn\]\[i\]\);qv\[tn\]\.set\(/);
});

test('no see-through silhouette of your character behind walls or furniture',()=>{
 const rl=r('public/realism.js');
 assert.doesNotMatch(rl,/ghostMat/);assert.doesNotMatch(rl,/GreaterDepth/);
});

test('club and VIP sofas are real seats at the right height; tap one to sit; never sit on thin air',()=>{
 const w=r('public/world.js');
 assert.match(w,/s\.userData\.seat=\{h:\.475,vip:true\}/,'three VIP seats on the gold sofa');
 assert.match(w,/function clubSeats\(\)\{root\.traverse\(o=>\{if\(o\.userData\.kind!=='sofa'\|\|o\.userData\.clubSeats\)return;o\.userData\.clubSeats=1;o\.scale\.setScalar\(\.7\);for\(const x of \[-\.8,0,\.8\]\)/,'club sofas at human size, three seats each');
 assert.match(w,/clubFx=id==='night'\?nightClub\(clubCtx\):themedClub\(clubCtx,id\)\}catch\(e\)\{console\.warn\('club host',e\)\}clubSeats\(\)\}/);
 assert.match(w,/player\.userData\.realSeatY=c\.c\.h-\.42;/,'the body sits at the seat height');
 assert.match(w,/if\(kind==='sit'\)b\.position\.y=b\.userData\.chairSeat\?b\.userData\.realSeatY\?\?0:0;/);
 assert.match(w,/return game\.toast\('Find a seat: tap a sofa or a chair\.'\)/);
 assert.match(w,/if\(s&&s\.d<1\.2\)\{if\(s\.c\.vip&&!game\.hasVip\?\.\(place\)\)return game\.clubAccess\?\.\(place\);if\(sitAt\(s\.c\)\)return\}/,'tap a sofa to sit; VIP without a pass opens the VIP options');
 assert.match(w,/function vipSeat\(\)\{[^}]*filter\(c=>c\.vip\)[^}]*return !!s&&sitAt\(s\)\}/,'Take your VIP seat walks you to a VIP seat');
 assert.match(w,/a\.position\.y=a\.userData\.real\?\.07:SIT_Y;/,'seated crowd no longer sinks into chairs');
 assert.match(w,/else if\(player\.position\.y>0&&!actionRun&&!player\.userData\.chairSeat\)player\.position\.y=0;/,'the follow camera keeps you on the seat');
 assert.match(w,/Math\.hypot\(player\.position\.x-r\.seat\.x,player\.position\.z-r\.seat\.z\)>1\.8\)\{sitRun=null;return\}/,'a walk that ends near the seat still sits');
});

// Phase 1 (switch club_dock, default ON): one row of club buttons, More lists the rest, the old buttons hide.
import vm from 'node:vm';import {harness,fixture} from './game-harness.mjs';
function docked(flag=true){const t=harness({...fixture(),place:'night'}),c=t.context,d=t.document,pressed=[];
 c.ChinaLifeFlags={cast:k=>k==='club_dock'?flag:false,appOff:()=>false};
 const ui=d.getElementById('worldUI'),hud=d.createElement('div');hud.className='club-hud';
 hud.innerHTML='<div class="club-emotes">'+['dance','toast','hype','spray','menu'].map(k=>'<button data-ce="'+k+'"></button>').join('')+'</div>';ui.append(hud);
 hud.querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>pressed.push(b.dataset.ce));
 const acts=d.getElementById('worldActivities');acts.innerHTML=['🎟 Entry & VIP<small>x</small>','🍸 Bar<small>x</small>','Go to open mic<small>2h</small>','💼 Club jobs<small>x</small>','🎧 Change / request song<small>x</small>'].map(h=>'<button>'+h+'</button>').join('');
 acts.querySelectorAll('button').forEach(b=>b.onclick=()=>pressed.push('item:'+b.childNodes[0].textContent.trim()));
 c.ChinaLifeAudio={open:()=>pressed.push('music'),playing:true,nowPlaying:{title:'Hometown Lounge'}};
 vm.runInContext(r('public/club-dock.js'),c);c.ChinaLifeClubDock.sync();return {t,c,d,pressed}}

test('club dock: seven buttons in a club that press the club\'s own controls, More lists the rest',()=>{
 const {t,c,d,pressed}=docked();const dock=d.getElementById('clubDock');
 assert.ok(dock&&!dock.hidden);assert.ok(d.body.classList.contains('club-docked'));
 assert.deepEqual([...dock.querySelectorAll('[data-cd]')].map(b=>b.dataset.cd),['door','bar','dance','spray','music','mic','more']);
 for(const k of ['bar','dance','spray','music'])dock.querySelector('[data-cd="'+k+'"]').onclick({stopPropagation(){}});
 assert.deepEqual(pressed,['menu','dance','spray','music']);assert.ok(dock.querySelector('[data-cd="music"]').classList.contains('on'),'Music lights up while a song plays');
 let opened=null;t.game.clubAccess=id=>{opened=id};dock.querySelector('[data-cd="door"]').onclick({stopPropagation(){}});assert.equal(opened,'night');
 c.ChinaLifeClubDock.more();const text=d.getElementById('activityContent').textContent;
 assert.match(text,/Toast/);assert.match(text,/Hype/);assert.match(text,/Chat/);assert.match(text,/Go to open mic/);assert.match(text,/Club jobs/);
 assert.doesNotMatch(text,/Entry & VIP|Change \/ request song/,'already on the dock');assert.equal(d.querySelectorAll('[data-cd-item]').length,2);
 d.querySelector('[data-cd-item="0"]').onclick();assert.equal(pressed.at(-1),'item:Go to open mic');
 d.querySelector('[data-cd-ce="toast"]').onclick();assert.equal(pressed.at(-1),'toast');
});

test('club dock: hidden outside clubs and when the switch is off; the old club buttons hide only while docked',()=>{
 const off=docked(false);assert.ok(!off.d.getElementById('clubDock'));assert.ok(!off.d.body.classList.contains('club-docked'));
 const {c,d}=docked();d.querySelector('.club-hud').remove();c.ChinaLifeClubDock.sync();assert.equal(d.getElementById('clubDock').hidden,true);assert.ok(!d.body.classList.contains('club-docked'));
 const css=r('public/club-dock.js');assert.match(css,/body\.club-docked #worldUI :is\(\.club-emotes,#clubMusicToggle,\.club-music-fab,\.radio-fab,\.club-now,#quickVoice,\.quick-voice,#infoPanel\)\{display:none!important\}/);
 assert.match(css,/dialog:is\(#activityDialog,#audioDialog\)\[open\]\{max-height:62vh!important/,'option sheets stop at about half height');
 assert.match(r('public/flags.js'),/club_dock:true/);assert.match(r('chinalife-api/hafrik-features.php'),/'club_dock'=>'Club: one row of buttons/);
 assert.match(r('public/index.dev.html'),/<script src="club-dock\.js"><\/script>/);
});

// Phase 3: tap anything in a club to use it (walk there, then act).
test('tap to use: bar, DJ booth and DJ, dance floor, bouncer and wall ads do their thing',()=>{
 const w=r('public/world.js');
 assert.match(w,/function goDo\(x,z,fn\)\{if\(!player\)return;if\(Math\.hypot\(player\.position\.x-x,player\.position\.z-z\)<\.8\)return fn\(\);clearEmote\(\);setWalk\(new THREE\.Vector3\(x,0,z\)\);tapRun=\{x,z,fn\}\}/,'walk there, then act');
 assert.match(w,/function setWalk\(end\)\{sitRun=null;tapRun=null;/,'a new walk cancels it');assert.match(w,/if\(sitRun\)sitFrame\(dt\);if\(tapRun\)tapFrame\(\);/);
 assert.match(w,/if\(place==='night'&&p\.y>\.3&&p\.x>5\.3&&p\.x<9\.2&&p\.z>-7&&p\.z<-3\.6\)\{goDo\(6\.9,-3\.1,\(\)=>\{turnTo\(player,Math\.PI,1\);clubPress\('menu'\)/,'the bar counter opens the bar');
 assert.match(w,/goDo\(0,-2,\(\)=>\{turnTo\(player,Math\.PI,1\);window\.ChinaLifeAudio\?\.open\?\.\(\)\}\);return true\}/,'the DJ booth opens song requests');
 assert.match(w,/if\(p\.y>\.08&&p\.y<\.3&&Math\.abs\(p\.x\)<2\.5&&Math\.abs\(p\.z\)<1\.5\)\{goDo\(p\.x,p\.z,\(\)=>\{clubPress\('dance'\)\|\|setEmote\('dance'\)\}\);return true\}/,'a dance-floor tile: walk there and dance');
 assert.match(w,/if\(a\?\.userData\?\.npc==='security'&&game\.clubs\.includes\(place\)\)return game\.clubAccess\?\.\(place\);if\(a\?\.userData\?\.npc==='dj'&&game\.clubs\.includes\(place\)\)return goDo\(0,-2,/,'the bouncer opens Entry & VIP; the DJ opens song requests');
 assert.match(w,/if\(!onMap\)holder\.userData\.tap=\(\)=>game\.ad\?\.\(ad\);/,'tap a wall ad to open it');
 assert.match(w,/while\(o&&o!==root&&!o\.userData\.tap\)o=o\.parent;if\(o\?\.userData\.tap\)\{o\.userData\.tap\(\);return\}/);
 assert.match(w,/if\(solid&&clubTap\(solid\)\)return;/);
});

// Phase 4: VIP service. Sitting in VIP brings a waiter from the bar; the first drink is free (server-checked), then he takes
// your order; the dock's Bar calls him while you are seated in VIP.
test('VIP waiter: comes when you sit in VIP, first drink on the house, then takes your order',()=>{
 const w=r('public/world.js'),h=r('public/club-host.js'),d=r('public/club-dock.js');
 assert.match(w,/window\.dispatchEvent\(new CustomEvent\('chinalife:vip-seated',\{detail:\{x:c\.c\.x,z:c\.c\.z,place\}\}\)\)/);
 assert.match(w,/if\(u\.mode==='serve'\)\{const w=u\.path\?\.\[0\];if\(!w\)\{u\.mode='wait';/,'the waiter walks a path, then waits');
 assert.match(w,/removeActor:b=>\{const i=actors\.indexOf\(b\);if\(i>=0\)actors\.splice\(i,1\);b\.removeFromParent\(\)\}/);
 assert.match(h,/window\.addEventListener\('chinalife:vip-seated',onVip\)/);assert.match(h,/window\.removeEventListener\('chinalife:vip-seated',onVip\)/);
 assert.match(h,/\{action:'club-drink',sku:'pappi-fizz',vip:1\}/,'the welcome drink asks the server for the free VIP drink');
 assert.match(h,/afterOrder=x=>\{putDown\(glass,x,false\);/,'after the free one he takes an order from the menu');
 assert.match(h,/if\(!seatedVip\(\)\)c\.setEmote\('drink'\);/,'ordering from your VIP seat does not stand you up');
 assert.match(h,/const api=\{waiter:\(\)=>callWaiter\(false\),/);assert.match(d,/bar:\(\)=>window\.ChinaLifeClubHost\?\.waiter\?\.\(\)\|\|press\(/);
});

// Phase 5: the walls. Ads on their own walls (never over the Now playing screen or the BAR sign), no "Advertise here" in
// clubs, and the Now playing screen says who asked for the song.
test('club walls: ads clear of the music screen and bar, no Advertise here, Now playing shows the requester',()=>{
 const w=r('public/world.js'),a=r('public/audio.js');
 assert.match(w,/const adSpots=id=>id==='night'\?\[\{x:-9\.3,y:2\.1,z:-2\.2,ry:Math\.PI\/2,w:4\.4,h:2\.5\},\{x:-9\.3,y:2\.1,z:2\.8,ry:Math\.PI\/2,w:4\.4,h:2\.5\},\{x:3\.2,y:2\.2,z:-6\.86,ry:0,w:3\.2,h:2\}\]/);
 // The music screen is 4.6 wide at x −3.5 on the back wall; the bar shelf starts at x 5.8. The back-wall ad (3.2 wide at x 3.2) clears both.
 assert.ok(3.2-3.2/2>-3.5+4.6/2&&3.2+3.2/2<5.8);
 assert.match(w,/if\(ad\.venues\.includes\(id\)&&!game\.clubs\.includes\(id\)\)adPlacement\(/);
 assert.match(w,/ctx\.fillText\(info\.by\?'🎤 Requested by '\+String\(info\.by\)\.slice\(0,30\):info\.source\|\|'Club DJ',250,242,366\);/);
 assert.match(a,/const q=queue\[0\];requestedBy=q&&q\.track===data\.track\?q\.name:null;/);assert.match(a,/source:'Club DJ',by:requestedBy\}/);
});
