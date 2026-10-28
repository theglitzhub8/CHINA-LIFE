// UI review task 6 (docs/UI-UX-REVIEW.md): one look for sheets. One close button size, 44px taps, no sheet text under
// 12px, the game's own confirm instead of browser pop-ups, swipe-down on every closable sheet, and a current help sheet.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const r=f=>fs.readFileSync('public/'+f,'utf8');

test('every close button is the same 44px circle, small buttons and HUD taps reach 44px, sheet text is at least 12px',()=>{
 const css=r('r4.css');
 assert.match(css,/:is\(dialog \.ios-close,dialog \.r4-x,\.where-to \.wt-close,\.fb-x,#closeSocial\)\{width:44px!important;height:44px!important/);
 assert.match(css,/:is\(\.coach-actions button,\.r4-tip button,\.lu-btn\)\{min-height:44px!important\}/);
 assert.match(css,/:is\(#cloudButton,#worldWallet,#worldVenueMore,#panelToggle\)::after\{content:'';position:absolute;inset:-4px\}/);
 assert.match(css,/\.pv6-stat span,html:root body \.lu-you\{font-size:12px!important\}/);
 assert.match(css,/#helpDialog \.help-grid span\{font-size:13px!important/);
});

test('players get the game\'s own confirm sheet, not a browser pop-up',()=>{
 assert.match(r('game.js'),/window\.ChinaLifeSheet\.confirm\(\{title:'Replace your character with '/);
 assert.match(r('hot-seat.js'),/window\.ChinaLifeSheet\.confirm\(\{title:'Report this gist\?'/);
 assert.doesNotMatch(r('hot-seat.js'),/to the admins/);
});

test('Hot Seat closes with swipe-down and Back; sign-up and the accident sheet must be finished',()=>{
 const sheets=r('r4.js').match(/const SHEETS='([^']+)'/)[1];
 assert.ok(sheets.includes('#hotSeatDialog'));assert.ok(!sheets.includes('#onboarding'));assert.ok(!sheets.includes('#accidentDialog'));
});

test('the help sheet describes today\'s game',()=>{
 const html=r('index.dev.html'),help=html.match(/<dialog id="helpDialog">([^]*?)<\/dialog>/)[1];
 assert.doesNotMatch(help,/single-player|personality → dream/);assert.match(help,/Where to\?/);assert.match(help,/Link Up/);assert.match(help,/hafrik\.com\/how-to-play/);
});

// UI review task 7: one Study folder (University for students while it is on, Chinese, Skills & certificates, Learning
// Hub) and one Today folder for every to-do list (tasks, goals, weekly activities, rank).
test('phone: one Today folder for to-do lists and one Study folder with matching names',()=>{
 const g=r('game.js');
 assert.match(g,/\['today','Today','bullseye_3d\.png',\['tasks','goals','community','rank'\]\]/);
 assert.match(g,/\['study','Study','graduation_cap_3d\.png',\['university','chinese','skills','academy'\]\]/);
 assert.doesNotMatch(g,/\['weekly','Weekly'/);assert.doesNotMatch(g,/\['learning','Learning'/);
 assert.match(g,/k!=='university'\|\|state\.background==='Student'&&window\.ChinaLifeFlags\?\.cast\?\.\('uni_years'\)===true/);
 assert.match(g,/skills:\['📚','Skills & certificates',skillsScreen\]/);assert.match(g,/screen\('Skills & certificates','Take courses and practise at places across the city/);
 assert.match(r('r4.js'),/Phone → Today → Rank/);
});

test('the University app exists only for students while University Years is on',async()=>{
 const {harness,fixture}=await import('./game-harness.mjs');
 const apps=(flag,background)=>{const t=harness({...fixture(),background});t.context.ChinaLifeFlags={cast:k=>k==='uni_years'&&flag,appOff:()=>false};t.game.phone();return [...t.document.querySelectorAll('[data-phone]')].map(b=>b.dataset.phone)};
 assert.ok(!apps(false,'Student').includes('university'),'switch off');assert.ok(!apps(true,'Worker').includes('university'),'not a student');assert.ok(apps(true,'Student').includes('university'));
});

// UI review task 8: phone widgets read in full (short day, two-line wrap) and the event subtitle matches what it shows.
test('phone widgets: short day, text wraps instead of cutting, honest "Next up" subtitle',()=>{
 const g=r('game.js'),css=r('r4.css');
 assert.match(g,/const day=new Date\(\)\.toLocaleDateString\('en-GB',\{weekday:'short',day:'numeric',month:'short',timeZone:'Asia\/Shanghai'\}\)\.replace\(',',''\)/);
 assert.match(g,/\(liveEv\.length\?'Live now':task\?'Your next step':'Tonight at the clubs'\)/);
 assert.match(css,/#phoneDialog \.pw4 :is\(\.phone-widget b,\.pw-clock span,\.pw-clock small\)\{white-space:normal!important;display:-webkit-box!important;-webkit-line-clamp:2/);
});
