import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const r=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');const css=r('public/ios.css'),js=r('public/ios.js'),html=r('public/index.dev.html');
test('the iOS layer loads last and is bundled',()=>{assert.ok(html.indexOf('ios.css')>html.indexOf('club.css'));assert.match(html,/<script src="ios\.js"><\/script>/);assert.match(r('public/index.html'),/styles\.[0-9a-f]{10}\.css/)});
test('Hafrik colours and the type scale',()=>{for(const c of ['#1F8E93','#0C3F44','#F7FFF7','#121212'])assert.ok(css.includes(c));assert.match(css,/--t-large:700 34px\/41px/);assert.match(css,/--t-cap:500 12px\/16px/);assert.match(css,/Readex Pro/)});
test('controls: 88px joystick, 56px jump, 28px tab icons',()=>{assert.match(css,/\.tp-stick\{width:88px!important;height:88px/);assert.match(css,/\.tp-jump\{width:56px!important;height:56px/);assert.match(css,/\.world-nav svg\{width:28px!important;height:28px/)});
test('three sheet detents and one close',()=>{assert.match(css,/dock-full/);assert.match(css,/92vh/);assert.match(css,/50vh/);assert.match(css,/\.ios-close/);assert.match(js,/classList\.add\('ios-close'\)/)});
test('one Party button and reduced motion',()=>{assert.match(js,/party-toggle/);assert.match(css,/club-emotes>button:not\(\.party-toggle\)\{display:none/);assert.match(css,/prefers-reduced-motion:reduce/)});
test('no new network polling',()=>{assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|ChinaLifeAuth|ChinaLifeCloud|\.php/)});
