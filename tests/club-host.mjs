import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/club-host.js',import.meta.url),'utf8'),php=readFileSync(new URL('../chinalife-api/economy.php',import.meta.url),'utf8');
test('club drink prices match the server menu',async()=>{
 const {DRINKS}=await import('../public/club-host.js');const menu=php.match(/\$clubDrinks=\[(.*?)\];/)[1];
 for(const d of DRINKS){const m=menu.match(new RegExp("'"+d.sku+"'=>\\[(\\d+),(\\d+)\\]"));assert.ok(m,d.sku);assert.equal(+m[1],d.price,d.sku)}});
test('club drinks are rate limited and never bump the save revision',()=>{
 const block=php.slice(php.indexOf("if ($action==='club-drink')"),php.indexOf("if ($action==='job')"));
 assert.match(block,/INTERVAL 90 SECOND/);assert.match(block,/cl_store_totals/);assert.doesNotMatch(block,/cl_store_character/);assert.match(block,/\$here!=='night'/)});
test('host uses canned lines only',()=>{assert.doesNotMatch(src,/ai\.php|openai|anthropic/i)});
test('club spray is server-paid, rate-limited, capped and ledgered',()=>{
 const block=php.slice(php.indexOf("if ($action==='club-spray')"),php.indexOf("if ($action==='club-drink')"));
 assert.match(block,/INTERVAL 20 SECOND/);assert.match(block,/>20000/);assert.match(block,/economy_note\('club-spray'/);assert.match(block,/cl_store_totals/);assert.doesNotMatch(block,/cl_store_character/);assert.match(block,/\[100,500,2000\]/)});
test('every club except 007 has a theme',async()=>{const {CLUB_THEME,THEMES,SPRAYS}=await import('../public/club-fx.js');const clubs=php.match(/\$clubs=\[(.*?)\];/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));for(const id of clubs)if(id!=='night')assert.ok(THEMES[CLUB_THEME[id]],id);assert.deepEqual(SPRAYS,[100,500,2000])});
