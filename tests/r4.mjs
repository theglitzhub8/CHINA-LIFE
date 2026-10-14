import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const r=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');const js=r('public/r4.js'),css=r('public/r4.css'),r3=r('public/r3.js'),audio=r('public/audio.js'),html=r('public/index.dev.html');
test('r4 loads after r3',()=>{assert.ok(html.indexOf('r4.css')>html.indexOf('r3.css'));assert.ok(html.indexOf('r4.js')>html.indexOf('r3.js'))});
test('joystick holds still during a sheet drag',()=>{assert.match(r3,/function freeze\(\)/);assert.match(css,/sheet-dragging\{--tp-bottom:var\(--r4-tpb\)/)});
test('Election week banner hides while the sheet is open or dragged',()=>{assert.match(css,/:is\(\.dock-open,\.sheet-dragging\) :is\(\.vote-panel/)});
test('intro tips are one-time and dismissible',()=>{assert.match(js,/chinalife-tips/);assert.match(js,/Got it/)});
test('client only: no requests, no coins',()=>{assert.doesNotMatch(js,/fetch\(|ChinaLifeAuth|\.php|money\s*[+-]=|state\.money\s*=/)});
test('club music sync is not every 2.5 s, music fix intact',()=>{assert.doesNotMatch(audio,/setInterval\(sync,2500\)/);assert.match(audio,/presenceNow/)});
