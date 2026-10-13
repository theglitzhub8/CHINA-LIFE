import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/club-host.js',import.meta.url),'utf8'),php=readFileSync(new URL('../chinalife-api/economy.php',import.meta.url),'utf8');
test('club drink prices match the server menu',async()=>{
 const {DRINKS}=await import('../public/club-host.js');const menu=php.match(/\$clubDrinks=\[(.*?)\];/)[1];
 for(const d of DRINKS){const m=menu.match(new RegExp("'"+d.sku+"'=>\\[(\\d+),(\\d+)\\]"));assert.ok(m,d.sku);assert.equal(+m[1],d.price,d.sku)}});
test('club drinks are rate limited and never bump the save revision',()=>{
 const block=php.slice(php.indexOf("if ($action==='club-drink')"),php.indexOf("if ($action==='job')"));
 assert.match(block,/INTERVAL 90 SECOND/);assert.match(block,/cl_store_totals/);assert.doesNotMatch(block,/cl_store_character/);assert.match(block,/\$here!=='night'/)});
test('host uses canned lines only',()=>{assert.doesNotMatch(src,/ai\.php|openai|anthropic/i)});
