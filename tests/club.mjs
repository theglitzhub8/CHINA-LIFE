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
