import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const r=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');const js=r('public/r3.js'),css=r('public/r3.css'),game=r('public/game.js');
test('phone: 10 apps on one page, no page dots',()=>{assert.match(game,/const FOLDERS=\[/);assert.equal((game.match(/const FOLDERS=\[(.*?)\];/)[1].match(/\['[a-z]+','[A-Z][a-z]+'/g)||[]).length,10);assert.doesNotMatch(game,/phone-page-controls/)});
test('one Next step pill and onboarding with skip',()=>{assert.match(js,/id='r3Next'/);assert.match(css,/world-side>\*:not\(#r3Next\)\{display:none/);assert.match(js,/Skip tour/);assert.match(js,/state\.onboard|st\.onboard/)});
test('the sheet follows the finger and snaps to 3 detents',()=>{assert.match(js,/touchmove/);assert.match(js,/\['peek',96\],\['half'/)});
test('client only: no requests, no coins',()=>{assert.doesNotMatch(js,/fetch\(|ChinaLifeAuth|\.php|money\s*[+-]=|state\.money/)});
test('no id clash with the character creator',()=>{assert.doesNotMatch(js,/'nextStep'/)});
