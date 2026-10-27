// Football Field matches: engine, bracket and the server-side result rules (PHP, via the php CLI when present).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
await import('../public/football-engine.js');
const E = globalThis.ChinaLifeFootballEngine;
const run = (s, ms, inputs = {}) => { const ev = []; for (let t = 0; t < ms && s.phase !== 'full'; t += 33) ev.push(...E.step(s, inputs, 33)); return ev; };

test('bots fill every empty slot, 1v1 to 5v5', () => {
  for (const size of [1, 2, 3, 4, 5]) {
    const s = E.create({ roster: [{ id: 'u1', name: 'Me', team: 0 }], size, seed: 3 });
    assert.equal(s.players.length, size * 2);
    assert.equal(s.players.filter((p) => p.bot).length, size * 2 - 1);
    assert.equal(s.players.filter((p) => p.team === 1).length, size);
  }
  const s = E.create({ roster: Array.from({ length: 9 }, (_, i) => ({ id: 'u' + i, team: i % 2 })), size: 3 });
  assert.equal(s.players.length, 6, 'extra players beyond the team size are not added');
});

test('kickoff freezes play, then the clock runs and full time ends the match', () => {
  const s = E.create({ size: 2, seed: 9 });
  assert.equal(s.phase, 'kickoff');
  E.step(s, {}, 1000); assert.equal(s.phase, 'kickoff'); assert.equal(s.t, 0);
  const ev = run(s, 700); assert.ok(ev.some((e) => e.type === 'kickoff')); assert.equal(s.phase, 'play');
  run(s, 400000);
  assert.equal(s.phase, 'full'); assert.ok(s.t >= s.duration);
  assert.equal(E.checkReport(E.report(s), { seed: 9 }), null);
});

test('a shot into the goal scores, restarts with the other team, and the report adds up', () => {
  const s = E.create({ roster: [{ id: 'me', team: 0 }], size: 1, seed: 1 });
  run(s, 1600);
  const me = s.players.find((p) => p.id === 'me');
  Object.assign(me, { x: E.F.W - 6, y: E.F.H / 2, fx: 1, fy: 0, cd: 0 });
  const keeper = s.players.find((p) => p.team === 1); Object.assign(keeper, { x: 5, y: 3 });
  Object.assign(s.ball, { owner: 'me', x: me.x + 1.3, y: me.y, vx: 0, vy: 0 });
  let ev = E.step(s, { me: { mx: 0, my: 0, shoot: true } }, 33);
  for (let i = 0; i < 60 && !ev.some((e) => e.type === 'goal'); i++) ev = E.step(s, { me: { mx: 0, my: 0 } }, 33);
  const g = ev.find((e) => e.type === 'goal');
  assert.ok(g, 'goal scored'); assert.equal(g.team, 0); assert.equal(g.by, 'me');
  assert.deepEqual(s.score, [1, 0]); assert.equal(s.phase, 'goal'); assert.equal(s.kickoffTeam, 1);
  run(s, E.F.GOAL_MS + 100); assert.ok(['kickoff', 'play'].includes(s.phase));
  assert.ok(Math.abs(s.ball.x - E.F.W / 2) < 3, 'ball back on the centre spot');
});

test('passing goes to a teammate', () => {
  const s = E.create({ roster: [{ id: 'me', team: 0 }], size: 3, seed: 2 });
  run(s, 1600);
  const me = s.players.find((p) => p.id === 'me');
  Object.assign(s.ball, { owner: 'me' }); me.cd = 0; me.fx = 1; me.fy = 0;
  const ev = E.step(s, { me: { mx: 0, my: 0, pass: true } }, 33);
  const p = ev.find((e) => e.type === 'pass'); assert.ok(p);
  assert.equal(s.players.find((q) => q.id === p.to).team, 0);
});

test('knockout draws go to extra time then seeded penalties', () => {
  const s = E.create({ size: 1, seed: 77, knockout: true, duration: 2000 });
  // Keep the bots from scoring: freeze them out of play by teleporting the ball each tick.
  for (let i = 0; i < 6000 && s.phase !== 'full'; i++) { E.step(s, {}, 33); if (s.phase === 'play') { s.ball.owner = null; s.ball.x = E.F.W / 2; s.ball.y = 1; s.ball.vx = s.ball.vy = 0; } }
  assert.equal(s.phase, 'full'); assert.ok(s.extra); assert.deepEqual(s.score, [0, 0]);
  assert.ok(s.pens && s.pens[0] !== s.pens[1]); assert.equal(s.winner, s.pens[0] > s.pens[1] ? 0 : 1);
  assert.equal(E.checkReport(E.report(s), { knockout: true, seed: 77, duration: 2000 }), null);
});

test('the server-side check rejects doctored reports', () => {
  const ok = { score: [2, 1], goals: [{ team: 0, by: 'u1', t: 1000 }, { team: 1, by: 'bot-1-0', t: 2000 }, { team: 0, by: null, own: true, t: 3000 }], winner: 0 };
  assert.equal(E.checkReport(ok, { players: ['u1'] }), null);
  assert.match(E.checkReport({ ...ok, score: [5, 1] }, { players: ['u1'] }), /add up/);
  assert.match(E.checkReport({ ...ok, winner: 1 }, { players: ['u1'] }), /winner/);
  assert.match(E.checkReport({ ...ok, goals: [{ ...ok.goals[0], by: 'stranger' }, ...ok.goals.slice(1)] }, { players: ['u1'] }), /scorer/);
  assert.match(E.checkReport({ ...ok, score: [99, 0] }, { players: ['u1'] }), /Impossible/);
});

test('snapshots round-trip for guests', () => {
  const a = E.create({ roster: [{ id: 'h', team: 0 }, { id: 'g', team: 1 }], size: 2, seed: 5 }); run(a, 5000);
  const b = E.create({ roster: [{ id: 'h', team: 0 }, { id: 'g', team: 1 }], size: 2, seed: 5 });
  const snap = JSON.parse(JSON.stringify(E.snapshot(a)));
  assert.ok(JSON.stringify(snap).length < 2000, 'small enough for 5 per second');
  E.applySnapshot(b, snap);
  assert.deepEqual(b.score, a.score); assert.equal(b.t, a.t);
  assert.ok(Math.abs(b.players[0].x - a.players[0].x) < .06);
});

test('brackets: byes, seeding and results advance to a champion', () => {
  const teams = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id }));
  const r = E.bracket(teams);
  assert.equal(r.length, 3); assert.equal(r[0].length, 4);
  assert.equal(r[0].filter((m) => m.bye).length, 3, 'three byes for five teams');
  assert.equal(r[0][0].a, 'A', 'top seed in the first slot');
  assert.equal(E.recordResult(r, 'r3m1', 'A'), 'Teams not decided yet');
  const [m] = E.playable(r); assert.deepEqual([m.a, m.b], ['D', 'E']);
  assert.equal(E.recordResult(r, m.id, 'X'), 'Winner is not in this match');
  assert.equal(E.recordResult(r, m.id, 'E', [1, 2]), null);
  assert.equal(E.recordResult(r, m.id, 'D'), 'Already played');
  while (E.playable(r).length) { const n = E.playable(r)[0]; E.recordResult(r, n.id, n.a, [1, 0]); }
  assert.equal(E.champion(r), 'A');
  assert.deepEqual(E.bracket([{ id: 'x' }, { id: 'y' }]).map((x) => x.length), [1]);
  assert.deepEqual(E.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

const php = ['/usr/bin/php', '/usr/local/bin/php'].find((p) => existsSync(p));
test('PHP lib matches the engine (brackets, penalties, result check, settle)', { skip: !php && 'php CLI not installed' }, () => {
  const lib = new URL('../chinalife-api/football-lib.php', import.meta.url).pathname;
  const code = `require '${lib}';
    $r=fb_bracket([['id'=>'A'],['id'=>'B'],['id'=>'C'],['id'=>'D'],['id'=>'E']]);
    $p=fb_playable($r);$e1=fb_record($r,$p[0]['id'],'E',[1,2]);$e2=fb_record($r,$p[0]['id'],'D',null);
    while($q=fb_playable($r))fb_record($r,$q[0]['id'],$q[0]['a'],[1,0]);
    $ok=['score'=>[2,1],'goals'=>[['team'=>0,'by'=>'u1','t'=>1000],['team'=>1,'by'=>'bot-1-0','t'=>2000],['team'=>0,'by'=>null,'own'=>true,'t'=>3000]],'winner'=>0];
    $bad=$ok;$bad['winner']=1;$bad2=$ok;$bad2['score']=[5,1];
    echo json_encode(['first'=>array_map(fn($m)=>[$m['a'],$m['b']],$r[0]),'e1'=>$e1,'e2'=>$e2,'champ'=>fb_champion($r),'pens'=>[fb_penalties(77),fb_penalties(5),fb_penalties(123456)],
      'ok'=>fb_check_result($ok,['u1'],false,1),'bad'=>fb_check_result($bad,['u1'],false,1),'bad2'=>fb_check_result($bad2,['u1'],false,1),
      'settle'=>[fb_settle([2,1],0,[],true,false,10),fb_settle([2,1],0,[],true,false,500),fb_settle([2,1],0,[['team'=>1,'score'=>[2,1]]],true,true,1),fb_settle([2,1],0,[['team'=>1,'score'=>[1,1]]],true,false,1),fb_settle([2,1],0,[],false,true,0),fb_settle([2,1],0,[],true,true,30)]]);`;
  const out = JSON.parse(execFileSync(php, ['-r', code], { encoding: 'utf8' }));
  const js = E.bracket(['A', 'B', 'C', 'D', 'E'].map((id) => ({ id })));
  assert.deepEqual(out.first, js[0].map((m) => [m.a, m.b]));
  assert.equal(out.e1, null); assert.equal(out.e2, 'Already played'); assert.equal(out.champ, 'A');
  assert.deepEqual(out.pens, [E.penalties(77), E.penalties(5), E.penalties(123456)], 'same seeded penalties as the engine');
  assert.equal(out.ok, null); assert.equal(out.bad, 'Wrong winner'); assert.equal(out.bad2, 'Goals do not add up');
  assert.deepEqual(out.settle, ['wait', 'accept', 'accept', 'dispute', 'accept', 'wait']);
});

test('wiring: one match at a time, admin switch, migration kept out of migrate.php', () => {
  const api = readFileSync(new URL('../chinalife-api/football.php', import.meta.url), 'utf8');
  assert.match(api, /fb_active_match\(\$uid/); assert.match(api, /cl_football_enabled\(\)/);
  const admin = readFileSync(new URL('../chinalife-api/admin.php', import.meta.url), 'utf8');
  assert.match(admin, /football-admin\.php/);
  assert.ok(existsSync(new URL('../chinalife-api/pending/migration-football.sql', import.meta.url)));
  assert.ok(!existsSync(new URL('../chinalife-api/migration-football.sql', import.meta.url)), 'not picked up by migrate.php');
  const sql = readFileSync(new URL('../chinalife-api/pending/migration-football.sql', import.meta.url), 'utf8');
  assert.match(sql, /'football_matches', '\{"enabled":false\}'/);
  const dev = readFileSync(new URL('../public/index.dev.html', import.meta.url), 'utf8');
  assert.ok(dev.indexOf('football-engine.js') < dev.indexOf('football.js"'));
  assert.match(readFileSync(new URL('../public/world.js', import.meta.url), 'utf8'), /ChinaLifeFootball\?\.enabled/);
});
