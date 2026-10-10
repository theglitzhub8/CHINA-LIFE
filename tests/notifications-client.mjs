import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {harness} from './game-harness.mjs';
test('new messages notify with the social panel closed and tapping opens the right conversation',async()=>{
 const t=harness(),c=t.context;let cursor='20',items=[],opened;
 c.URLSearchParams=URLSearchParams;c.ChinaLifeCloud={signedIn:true,playerId:'1'};c.ChinaLifeAuth={async request(){return {data:{cursor,messages:items}}}};c.ChinaLifeSocial={openDirect:id=>opened=id,open:view=>opened=view};
 vm.runInContext(fs.readFileSync('public/notifications.js','utf8'),c);await new Promise(resolve=>setImmediate(resolve));assert.equal(t.document.getElementById('messageNotification').hidden,true);
 cursor='21';items=[{id:'21',player_id:'2',name:'Bob',body:'<img> Hello',channel:'direct'}];await c.ChinaLifeNotifications.poll();const banner=t.document.getElementById('messageNotification');assert.equal(banner.hidden,false);assert.match(banner.textContent,/Bob: <img> Hello/);assert.equal(banner.querySelector('img'),null);banner.onclick();assert.equal(opened,'2');assert.equal(banner.hidden,true);
 items=[];await c.ChinaLifeNotifications.poll();assert.equal(banner.hidden,true);
});

test('admin announcement overlays escape text, survive refresh checks and persist dismissal per account',()=>{
 const t=harness(),c=t.context,storage=new Map();c.URLSearchParams=URLSearchParams;c.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 c.ChinaLifeCloud={signedIn:true,playerId:'1',announcements:[{id:'7',title:'<img src=x>',body:'Hello all cities'}]};c.ChinaLifeAuth={async request(){return {data:{cursor:'0',messages:[]}}}};
 vm.runInContext(fs.readFileSync('public/notifications.js','utf8'),c);
 const overlay=t.document.querySelector('[role="alertdialog"]');assert.equal(overlay.hidden,false);assert.equal(overlay.querySelector('img'),null);assert.match(overlay.textContent,/Hello all cities/);
 overlay.querySelectorAll('button')[1].onclick();assert.equal(overlay.hidden,true);c.ChinaLifeNotifications.showAnnouncements();assert.equal(overlay.hidden,true);assert.equal(storage.get('chinalife-announcements-1'),'["7"]');
 c.ChinaLifeCloud.playerId='2';c.ChinaLifeNotifications.showAnnouncements();assert.equal(overlay.hidden,false,'each account sees the notice');
});
