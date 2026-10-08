import test from 'node:test';import assert from 'node:assert/strict';import {harness,fixture} from './game-harness.mjs';import {cityLayout} from '../public/city-layout.js';
test('Guangzhou lists every catalog place with activities, a model and a map position that does not overlap another venue',()=>{
 const t=harness({...fixture(),city:'Guangzhou',place:'home'}),places=t.context.ChinaLifeCatalog.guangzhou.places,ids=t.game.locations.map(p=>p[0]);
 assert.ok(places.length>=56);
 for(const p of places){assert.ok(ids.includes(p.id),p.id);const v=t.game.locations.find(x=>x[0]===p.id);assert.ok(v[7].length>0,p.id+' activities');assert.ok(p.model,p.id+' model')}
 const layout=cityLayout('Guangzhou',places.length&&{places}),shared=['home','ef','cafe','market','campus','gym','university','liaoning','station','african','church','plaza','hotel','business','mall','academy','park','night','airport'];
 const spots=[...shared,...places.map(p=>p.id)].map(id=>[id,layout.positions[id]]);
 for(let i=0;i<spots.length;i++)for(let j=i+1;j<spots.length;j++)assert.ok(Math.hypot(spots[i][1][0]-spots[j][1][0],spots[i][1][1]-spots[j][1][1])>=7.9,spots[i][0]+' overlaps '+spots[j][0]);
 assert.ok(layout.districts.some(d=>d.name==='Tianhe CBD'));
 for(const id of ['scnu','gafa','rosewood','teemall','chimelong','pearlcruise','polyexpo','gzrailway','nanfang','ersha','hooleys','tigerprawn'])assert.ok(ids.includes(id),id);
});
