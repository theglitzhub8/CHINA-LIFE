// Football Field matches (Oct 2026): the match simulation shared by the host, guests' prediction and the tests.
// Pure functions, no DOM. A match is host-authoritative: one client (the host) runs step() at 30 Hz and sends
// snapshots; guests only send their joystick and Pass/Shoot taps. Bots fill empty slots on either team.
// The bracket helpers here match chinalife-api/football-lib.php (tests/football.mjs checks both).
(function (root) {
  'use strict';
  const F = Object.freeze({ W: 60, H: 36, GOAL: 10, R: .9, BALL: .45, SPEED: 9, BOT: .82, FRICTION: 1.6, PASS: 22, SHOOT: 30, CONTROL: 1.25, KICK_CD: 350, KICKOFF_MS: 1500, GOAL_MS: 2200, DURATION_MS: 180000, EXTRA_MS: 60000, MAX_TEAM: 5 });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const BOT_NAMES = ['Kofi', 'Emeka', 'Ama', 'Tunde', 'Zainab', 'Musa', 'Chidi', 'Lerato', 'Femi', 'Nana'];
  // Formation slots (fractions of the half) for 1..5 players, from the keeper forwards.
  const SLOTS = { 1: [[.55, .5]], 2: [[.3, .5], [.7, .5]], 3: [[.15, .5], [.55, .3], [.55, .7]], 4: [[.12, .5], [.45, .3], [.45, .7], [.8, .5]], 5: [[.08, .5], [.4, .25], [.4, .75], [.75, .35], [.75, .65]] };
  function home(team, i, size) { const s = (SLOTS[size] || SLOTS[5])[i] || [.5, .5], fx = s[0] * F.W / 2; return { x: team === 0 ? fx : F.W - fx, y: s[1] * F.H }; }
  // roster: [{id,name,team:0|1}] humans; size: players per team. Missing slots become bots.
  function create({ roster = [], size = 3, seed = 1, duration = F.DURATION_MS, knockout = false } = {}) {
    size = clamp(Math.round(size) || 1, 1, F.MAX_TEAM);
    const players = [], count = [0, 0];
    for (const r of roster) { const team = r.team === 1 ? 1 : 0; if (count[team] >= size) continue; players.push({ id: String(r.id), name: String(r.name || 'Player').slice(0, 18), team, bot: false, slot: count[team]++ }); }
    let b = 0;
    for (const team of [0, 1]) while (count[team] < size) players.push({ id: 'bot-' + team + '-' + count[team], name: BOT_NAMES[b++ % BOT_NAMES.length] + ' 🤖', team, bot: true, slot: count[team]++ });
    for (const p of players) Object.assign(p, home(p.team, p.slot, size), { vx: 0, vy: 0, fx: p.team ? -1 : 1, fy: 0, cd: 0 });
    const s = { v: 1, size, seed, t: 0, duration, knockout, phase: 'kickoff', phaseT: F.KICKOFF_MS, score: [0, 0], kickoffTeam: 0, ball: { x: F.W / 2, y: F.H / 2, vx: 0, vy: 0, owner: null, last: null }, players, goals: [], shots: [0, 0], extra: false, pens: null, winner: null, seq: 0 };
    kickoff(s, 0); return s;
  }
  function kickoff(s, team) {
    s.phase = 'kickoff'; s.phaseT = F.KICKOFF_MS; s.kickoffTeam = team;
    for (const p of s.players) { Object.assign(p, home(p.team, p.slot, s.size)); p.vx = p.vy = 0; p.cd = 0; }
    Object.assign(s.ball, { x: F.W / 2, y: F.H / 2, vx: 0, vy: 0, owner: null, last: null });
    // The kicking-off team's most forward player stands on the ball.
    const taker = s.players.filter((p) => p.team === team).sort((a, b) => b.slot - a.slot)[0];
    if (taker) { taker.x = F.W / 2 + (team ? 1.2 : -1.2); taker.y = F.H / 2; }
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const goalX = (team) => (team === 0 ? F.W : 0); // where team attacks
  function kick(s, p, tx, ty, speed, kind) {
    const dx = tx - s.ball.x, dy = ty - s.ball.y, d = Math.hypot(dx, dy) || 1;
    s.ball.vx = dx / d * speed; s.ball.vy = dy / d * speed; s.ball.owner = null; s.ball.last = p.id; p.cd = F.KICK_CD;
    if (kind === 'shoot') s.shots[p.team]++;
  }
  function passTarget(s, p) {
    let best = null, bs = -1e9;
    for (const q of s.players) {
      if (q === p || q.team !== p.team) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, facing = (dx * p.fx + dy * p.fy) / d;
      const score = facing * 10 - Math.abs(d - 12) * .4 + (p.team === 0 ? dx : -dx) * .15;
      if (score > bs) { bs = score; best = q; }
    }
    return best;
  }
  function shootAt(s, p, r) { const spread = (r() - .5) * F.GOAL * .8; return { x: goalX(p.team), y: F.H / 2 + spread }; }
  // Bot brain: chase if nearest on its team, else hold a shifted formation slot. With the ball: shoot in range, pass under pressure.
  function botInput(s, p, r) {
    const b = s.ball, mates = s.players.filter((q) => q.team === p.team);
    if (b.owner === p.id) {
      const gx = goalX(p.team), toGoal = Math.abs(gx - p.x);
      if (toGoal < 17 && Math.abs(p.y - F.H / 2) < 12) return { mx: 0, my: 0, shoot: r() < .25 };
      const press = s.players.some((q) => q.team !== p.team && dist(q, p) < 3.2);
      if (press && mates.length > 1 && r() < .08) return { mx: 0, my: 0, pass: true };
      const dx = gx - p.x, dy = F.H / 2 - p.y, d = Math.hypot(dx, dy) || 1; return { mx: dx / d, my: dy / d * .6 };
    }
    const chaser = mates.filter((q) => !q.human).sort((a, c) => dist(a, b) - dist(c, b))[0];
    const humanCloser = mates.some((q) => q.human && dist(q, b) < dist(p, b) - 1);
    if (chaser === p && !humanCloser) { const dx = b.x + b.vx * .15 - p.x, dy = b.y + b.vy * .15 - p.y, d = Math.hypot(dx, dy); return d < .3 ? { mx: 0, my: 0 } : { mx: dx / d, my: dy / d }; }
    const h = home(p.team, p.slot, s.size), shift = (b.x - F.W / 2) * .45, tx = clamp(h.x + shift, 2, F.W - 2), ty = h.y + (b.y - F.H / 2) * .3;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy); return d < .6 ? { mx: 0, my: 0 } : { mx: dx / d * .8, my: dy / d * .8 };
  }
  // inputs: { [playerId]: {mx,my,pass,shoot} } for humans. dt in ms. Returns the list of events that happened.
  function step(s, inputs = {}, dt = 33) {
    const ev = [], r = rng(s.seed + s.seq++);
    if (s.phase === 'full') return ev;
    s.phaseT -= dt;
    if (s.phase === 'goal') { if (s.phaseT <= 0) { if (s.endAfterGoal) return finish(s, ev); kickoff(s, s.kickoffTeam); } return ev; }
    if (s.phase === 'kickoff') { if (s.phaseT > 0) return ev; s.phase = 'play'; ev.push({ type: 'kickoff' }); }
    s.t += dt;
    const sec = dt / 1000, b = s.ball;
    for (const p of s.players) {
      p.human = !p.bot && !!inputs[p.id] || (!p.bot && p.human);
      const inp = p.bot || !inputs[p.id] ? (p.bot ? botInput(s, p, r) : { mx: 0, my: 0 }) : inputs[p.id];
      let mx = +inp.mx || 0, my = +inp.my || 0; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      const sp = F.SPEED * (p.bot ? F.BOT : 1) * (b.owner === p.id ? .88 : 1);
      p.vx = mx * sp; p.vy = my * sp; p.x = clamp(p.x + p.vx * sec, F.R, F.W - F.R); p.y = clamp(p.y + p.vy * sec, F.R, F.H - F.R);
      if (m > .1) { p.fx = mx / Math.max(m, 1e-6) * Math.min(m, 1); p.fy = my / Math.max(m, 1e-6) * Math.min(m, 1); const fm = Math.hypot(p.fx, p.fy) || 1; p.fx /= fm; p.fy /= fm; }
      p.cd = Math.max(0, p.cd - dt);
      if (b.owner === p.id && p.cd === 0) {
        if (inp.shoot) { const t = shootAt(s, p, r); kick(s, p, t.x, t.y, F.SHOOT, 'shoot'); ev.push({ type: 'shot', by: p.id }); }
        else if (inp.pass) { const q = passTarget(s, p); if (q) { kick(s, p, q.x + q.vx * .25, q.y + q.vy * .25, F.PASS, 'pass'); ev.push({ type: 'pass', by: p.id, to: q.id }); } else { kick(s, p, p.x + p.fx * 10, p.y + p.fy * 10, F.PASS, 'pass'); } }
      }
    }
    // Players never overlap: push apart (same soft-collision idea as the venues).
    for (let i = 0; i < s.players.length; i++) for (let j = i + 1; j < s.players.length; j++) {
      const a = s.players[i], c = s.players[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), min = F.R * 2;
      if (d > 0 && d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
    }
    if (b.owner) {
      const p = s.players.find((q) => q.id === b.owner);
      if (p) { b.x = p.x + p.fx * (F.R + F.BALL); b.y = p.y + p.fy * (F.R + F.BALL); b.vx = p.vx; b.vy = p.vy; }
      // Tackle: an opponent touching the ball carrier can take it.
      for (const q of s.players) if (p && q.team !== p.team && q.cd === 0 && dist(q, b) < F.CONTROL * .8 && r() < .06) { b.owner = q.id; b.last = q.id; p.cd = 600; ev.push({ type: 'tackle', by: q.id }); break; }
    } else {
      b.x += b.vx * sec; b.y += b.vy * sec; const f = Math.max(0, 1 - F.FRICTION * sec); b.vx *= f; b.vy *= f;
      if (b.y < F.BALL || b.y > F.H - F.BALL) { b.vy = -b.vy * .7; b.y = clamp(b.y, F.BALL, F.H - F.BALL); }
      const inMouth = Math.abs(b.y - F.H / 2) < F.GOAL / 2;
      if (b.x < 0 || b.x > F.W) {
        if (inMouth) return goal(s, b.x > F.W ? 0 : 1, ev);
        b.vx = -b.vx * .7; b.x = clamp(b.x, F.BALL, F.W - F.BALL);
      }
      // Loose ball: the closest player in reach (not on kick cooldown) takes control.
      let best = null, bd = F.CONTROL; for (const p of s.players) { const d = dist(p, b); if (p.cd === 0 && d < bd && Math.hypot(b.vx, b.vy) < (p.id === b.last ? 6 : 26)) { bd = d; best = p; } }
      if (best) { b.owner = best.id; b.last = best.id; }
    }
    const limit = s.duration + (s.extra ? F.EXTRA_MS : 0);
    if (s.t >= limit) {
      if (s.score[0] === s.score[1] && s.knockout && !s.extra) { s.extra = true; ev.push({ type: 'extra' }); kickoff(s, r() < .5 ? 0 : 1); return ev; }
      return finish(s, ev);
    }
    return ev;
  }
  function goal(s, team, ev) {
    s.score[team]++; const by = s.ball.last, scorer = s.players.find((p) => p.id === by);
    const own = scorer && scorer.team !== team;
    s.goals.push({ team, by: own ? null : by, own: !!own, t: Math.round(s.t) }); ev.push({ type: 'goal', team, by, own: !!own });
    s.phase = 'goal'; s.phaseT = F.GOAL_MS; s.kickoffTeam = 1 - team; s.ball.vx = s.ball.vy = 0; s.ball.owner = null;
    if (s.extra) s.endAfterGoal = true; // golden goal
    return ev;
  }
  // Penalties only decide a knockout tie still level after extra time; seeded so host and server agree.
  function penalties(seed) { const r = rng(seed * 7 + 3), k = [0, 0]; for (let i = 0; i < 5; i++) for (const t of [0, 1]) if (r() < .75) k[t]++; while (k[0] === k[1]) { for (const t of [0, 1]) if (r() < .75) k[t]++; } return k; }
  function finish(s, ev) {
    s.phase = 'full'; s.phaseT = 0;
    if (s.score[0] !== s.score[1]) s.winner = s.score[0] > s.score[1] ? 0 : 1;
    else if (s.knockout) { s.pens = penalties(s.seed); s.winner = s.pens[0] > s.pens[1] ? 0 : 1; }
    else s.winner = null;
    ev.push({ type: 'full', score: s.score.slice(), winner: s.winner, pens: s.pens }); return ev;
  }
  // What the host reports at full time and what the server re-checks (football-lib.php fb_check_result).
  function report(s) { return { score: s.score.slice(), goals: s.goals.map((g) => ({ ...g })), winner: s.winner, pens: s.pens, extra: s.extra, t: Math.round(s.t) }; }
  function checkReport(rep, { duration = F.DURATION_MS, players = [], knockout = false, seed = 1 } = {}) {
    if (!rep || !Array.isArray(rep.score) || rep.score.length !== 2) return 'Missing score';
    const [a, b] = rep.score; if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 30)) return 'Impossible score';
    if (!Array.isArray(rep.goals) || rep.goals.length !== a + b) return 'Goals do not add up';
    if (rep.goals.filter((g) => g.team === 0).length !== a) return 'Goals do not add up';
    const ids = new Set(players.map(String));
    for (const g of rep.goals) { if (g.by !== null && !ids.has(String(g.by)) && !/^bot-[01]-[0-4]$/.test(String(g.by))) return 'Unknown scorer'; if (!(g.t >= 0 && g.t <= duration + F.EXTRA_MS + 1000)) return 'Goal time out of range'; }
    const times = rep.goals.map((g) => g.t); if (times.some((t, i) => i && t < times[i - 1])) return 'Goals out of order';
    let w = a === b ? null : a > b ? 0 : 1;
    if (w === null && knockout) { const p = penalties(seed); w = p[0] > p[1] ? 0 : 1; }
    if (rep.winner !== w) return 'Wrong winner';
    return null;
  }
  // Snapshots: compact arrays for the wire (host -> guests).
  const r1 = (v) => Math.round(v * 10) / 10;
  function snapshot(s) { return { t: s.t, ph: s.phase, pt: Math.round(s.phaseT), sc: s.score, x: s.extra ? 1 : 0, w: s.winner, pn: s.pens, b: [r1(s.ball.x), r1(s.ball.y), r1(s.ball.vx), r1(s.ball.vy), s.ball.owner], p: s.players.map((p) => [p.id, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r1(p.fx), r1(p.fy)]), g: s.goals.length }; }
  function applySnapshot(s, n) {
    if (!n) return s; s.t = n.t; s.phase = n.ph; s.phaseT = n.pt; s.score = n.sc.slice(); s.extra = !!n.x; s.winner = n.w ?? null; s.pens = n.pn || null;
    Object.assign(s.ball, { x: n.b[0], y: n.b[1], vx: n.b[2], vy: n.b[3], owner: n.b[4] });
    for (const a of n.p) { const p = s.players.find((q) => q.id === a[0]); if (p) Object.assign(p, { x: a[1], y: a[2], vx: a[3], vy: a[4], fx: a[5], fy: a[6] }); }
    return s;
  }
  // ---------- knockout brackets ----------
  // teams: [{id,name}] in seed order. Returns rounds: [[{id,a,b,winner,score}]...]; byes advance automatically.
  function bracket(teams) {
    const n = teams.length; if (n < 2) return [];
    let size = 1; while (size < n) size *= 2;
    const order = seedOrder(size), rounds = [], first = [];
    for (let i = 0; i < size; i += 2) {
      const a = teams[order[i] - 1] || null, b = teams[order[i + 1] - 1] || null;
      first.push({ id: 'r1m' + (i / 2 + 1), a: a && a.id, b: b && b.id, winner: !a ? b && b.id : !b ? a.id : null, score: null, bye: !a || !b });
    }
    rounds.push(first);
    for (let r = 2, len = size / 4; len >= 1; r++, len /= 2) rounds.push(Array.from({ length: len }, (_, i) => ({ id: 'r' + r + 'm' + (i + 1), a: null, b: null, winner: null, score: null })));
    if (size === 2) return rounds;
    propagate(rounds); return rounds;
  }
  function seedOrder(size) { let o = [1, 2]; while (o.length < size) { const m = o.length * 2 + 1, next = []; for (const s of o) next.push(s, m - s); o = next; } return o; }
  function propagate(rounds) {
    for (let r = 1; r < rounds.length; r++) rounds[r].forEach((m, i) => {
      const fa = rounds[r - 1][i * 2], fb = rounds[r - 1][i * 2 + 1];
      m.a = fa && fa.winner || null; m.b = fb && fb.winner || null;
      if (m.winner && m.winner !== m.a && m.winner !== m.b) { m.winner = null; m.score = null; }
    });
    return rounds;
  }
  function recordResult(rounds, matchId, winner, score) {
    for (const round of rounds) for (const m of round) if (m.id === matchId) {
      if (m.winner && !m.bye) return 'Already played'; if (!m.a || !m.b) return 'Teams not decided yet'; if (winner !== m.a && winner !== m.b) return 'Winner is not in this match';
      m.winner = winner; m.score = score || null; propagate(rounds); return null;
    }
    return 'Unknown match';
  }
  const champion = (rounds) => (rounds.length ? rounds[rounds.length - 1][0].winner : null);
  const playable = (rounds) => rounds.flat().filter((m) => m.a && m.b && !m.winner);
  const api = { F, rng, create, step, kickoff, report, checkReport, penalties, snapshot, applySnapshot, bracket, seedOrder, recordResult, champion, playable, home, botInput };
  root.ChinaLifeFootballEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
