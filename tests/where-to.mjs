// "Where to?" (one-city mode) opens by itself when you land on the street map, but a journey also switches to the street
// map (world.js journey): during a trip the list stays closed so you can watch the ride.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';

test('Where to? never covers a journey: it stays closed (and closes) while the world is busy travelling',()=>{
 const s=fs.readFileSync('public/where-to.js','utf8');
 assert.match(s,/if \(!OC\.whereTo\(\)\) return;\n    if \(window\.ChinaLifeWorld\?\.busy\) \{ if \(open\) hide\(\); return; \}\n    if \(ui\.classList\.contains\('map-view'\) && game\(\)\?\.state\?\.created\) \{ if \(!open\) show\(\); else render\(\); \}/);
 // A journey sets actionRun right after switching to the map, so busy is already true when the observer runs.
 assert.match(fs.readFileSync('public/world.js','utf8'),/function journey\(spec,done\)\{[^]*?city\(\);[^]*?actionRun=\{kind:'travel'/);
});

// Every trip shows the walk or ride on the map: places the map layout has no street entrance for (one-city Gossip Room
// and Hospital, owned homes) get one from their map position, their classic district, or the city centre.
test('journeys find a street route to and from every one-city destination and owned homes',()=>{
 const w=fs.readFileSync('public/world.js','utf8');
 assert.match(w,/const ROUTE_ALIAS=\{cityhospital:'medical'\};/);
 assert.match(w,/function routeLayout\(\.\.\.ids\)\{.*?layout\.positions\[id\]\|\|layout\.positions\[ROUTE_ALIAS\[id\]\]\|\|\(String\(id\)\.startsWith\('home'\)&&layout\.positions\.home\)\|\|\[0,0\]/);
 assert.match(w,/const route=streetRoute\(routeLayout\(spec\.from,spec\.to\),spec\.from,spec\.to\);/);
});
