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
