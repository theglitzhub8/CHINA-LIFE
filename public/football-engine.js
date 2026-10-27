// Football Field matches (v2, Oct 2026): the match simulation shared by the host, guests' prediction and the tests.
// Pure functions, no DOM. Host-authoritative: the host runs step() at 60 Hz and relays snapshots; guests send inputs.
// v2 adds momentum, sprint/stamina, close dribbling, aimed passes and lobs, hold-to-power shots with placement,
// slide tackles and steals, auto-switching, keepers that dive and save, ball height/bounce/spin, posts and crossbar,
// kick-ins, corners and goal kicks, role-based bots with three difficulty levels, and per-player match stats.
// The bracket helpers match chinalife-api/football-lib.php (tests/football.mjs checks both).
(function (root) {
  'use strict';
  const F = Object.freeze({ W: 60, H: 36, GOAL: 8.5, GOAL_H: 2.6, NET: 1.8, POST: .18, BOX_D: 9, BOX_W: 22, SIX_D: 3.2, SIX_W: 12,
    R: .6, BALL: .3, SPEED: 7.4, SPRINT: 9.8, ACCEL: 30, G: 22, CONTROL: 1.05, KICK_CD: 260,
    KICKOFF_MS: 3000, KICKOFF2_MS: 1800, GOAL_MS: 4600, RESTART_MS: 1100, DURATION_MS: 180000, EXTRA_MS: 60000, MAX_TEAM: 5, DT: 1000 / 60 });
  const DIFF = Object.freeze({
    easy: { speed: .8, react: 650, err: 2.8, tackle: .35, steal: .5, save: .78, range: 12, pass: .35 },
    normal: { speed: .9, react: 380, err: 2, tackle: .7, steal: 1, save: 1, range: 14, pass: .6 },
    hard: { speed: .98, react: 200, err: 1.3, tackle: 1, steal: 1.5, save: 1.12, range: 16, pass: .75 },
  });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hyp = Math.hypot;
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const BOT_NAMES = ['Kofi', 'Emeka', 'Ama', 'Tunde', 'Zainab', 'Musa', 'Chidi', 'Lerato', 'Femi', 'Nana'];
  const ROLES = { 1: ['att'], 2: ['gk', 'att'], 3: ['gk', 'def', 'att'], 4: ['gk', 'def', 'mid', 'att'], 5: ['gk', 'def', 'def', 'att', 'att'] };
  // Home spots as (fraction of the length from the own goal, fraction of the width).
  const HOME = { 1: [[.4, .5]], 2: [[.03, .5], [.5, .5]], 3: [[.03, .5], [.27, .5], [.58, .5]], 4: [[.03, .5], [.25, .5], [.45, .3], [.62, .68]], 5: [[.03, .5], [.25, .3], [.25, .7], [.6, .32], [.6, .68]] };
  const dirOf = (team) => (team === 0 ? 1 : -1);          // attacking direction along x
  const ownGoalX = (team) => (team === 0 ? 0 : F.W);
  const goalX = (team) => (team === 0 ? F.W : 0);         // the goal a team attacks
  const fx = (team, frac) => (team === 0 ? frac * F.W : F.W - frac * F.W);
  function home(team, i, size) { const h = (HOME[size] || HOME[5])[i] || [.5, .5]; return { x: fx(team, h[0]), y: h[1] * F.H }; }
  const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
  const blankStats = () => ({ g: 0, a: 0, sh: 0, sot: 0, pa: 0, pc: 0, tk: 0, sv: 0 });
  // roster: [{id,name,team}] humans; size: players per team. Humans take outfield slots first; bots fill the rest.
  function create({ roster = [], size = 3, seed = 1, duration = F.DURATION_MS, knockout = false, difficulty = 'normal', autoSwitch = true } = {}) {
    size = clamp(Math.round(size) || 1, 1, F.MAX_TEAM);
    const roles = ROLES[size], players = [], taken = [new Set(), new Set()];
    const slotOrder = [...Array(size).keys()].reverse(); // attackers first, keeper last
    for (const r of roster) { const team = r.team === 1 ? 1 : 0, slot = slotOrder.find((i) => !taken[team].has(i)); if (slot === undefined) continue; taken[team].add(slot); players.push({ id: String(r.id), name: String(r.name || 'Player').slice(0, 18), team, bot: false, slot }); }
    let b = 0;
    for (const team of [0, 1]) for (let slot = 0; slot < size; slot++) if (!taken[team].has(slot)) players.push({ id: 'bot-' + team + '-' + slot, name: BOT_NAMES[b++ % BOT_NAMES.length], team, bot: true, slot });
    players.sort((a, c) => a.team - c.team || a.slot - c.slot);
    for (const p of players) Object.assign(p, home(p.team, p.slot, size), { role: roles[p.slot], num: p.slot === 0 && roles[0] === 'gk' ? 1 : p.slot + (roles[0] === 'gk' ? 1 : 7), vx: 0, vy: 0, ang: p.team ? Math.PI : 0, cd: 0, slide: 0, dive: 0, stun: 0, hold: 0, stamina: 1, sprint: false, touch: 0, think: 0, plan: null, st: blankStats() });
    const ctrl = {}; for (const p of players) if (!p.bot) ctrl[p.id] = p.id;
    const s = { v: 2, size, seed, t: 0, duration, knockout, difficulty: DIFF[difficulty] ? difficulty : 'normal', autoSwitch, phase: 'kickoff', phaseT: F.KICKOFF_MS, score: [0, 0], kickoffTeam: 0,
      ball: { x: F.W / 2, y: F.H / 2, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, last: null, lastTeam: null, tried: false },
      players, ctrl, actN: {}, switchCd: {}, goals: [], lastGoal: null, restart: null, shots: [0, 0], poss: [0, 0], lastPass: null, extra: false, pens: null, winner: null, seq: 0 };
    kickoff(s, 0, F.KICKOFF_MS); return s;
  }
  const byId = (s, id) => s.players.find((p) => p.id === id);
  const keeperOf = (s, team) => s.players.find((p) => p.team === team && p.role === 'gk');
  function kickoff(s, team, ms = F.KICKOFF2_MS) {
    s.phase = 'kickoff'; s.phaseT = ms; s.kickoffTeam = team; s.restart = null;
    for (const p of s.players) { Object.assign(p, home(p.team, p.slot, s.size)); p.vx = p.vy = 0; p.cd = p.slide = p.dive = p.stun = p.hold = 0; p.ang = p.team ? Math.PI : 0; p.stamina = Math.min(1, p.stamina + .3); }
    Object.assign(s.ball, { x: F.W / 2, y: F.H / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, lastTeam: null, tried: false });
    // The kicking-off team's most forward player stands on the ball.
    const taker = s.players.filter((p) => p.team === team && p.role !== 'gk').sort((a, b) => b.slot - a.slot)[0];
    if (taker) { taker.x = F.W / 2 - dirOf(team) * 1.1; taker.y = F.H / 2; }
    for (const p of s.players) if (p.team !== team && Math.abs(p.x - F.W / 2) < 6) p.x = F.W / 2 - dirOf(p.team) * 6;
    for (const h of Object.keys(s.ctrl)) { const own = byId(s, h); if (own) s.ctrl[h] = own.id; }
    if (taker) giveSwitch(s, taker);
  }
  // A human on the taker's team who isn't controlling someone else takes the restart.
  function giveSwitch(s, p) { if (!s.autoSwitch || p.role === 'gk') return; const humans = Object.keys(s.ctrl).filter((h) => byId(s, h)?.team === p.team); if (humans.length !== 1) return; if (Object.values(s.ctrl).includes(p.id)) return; s.ctrl[humans[0]] = p.id; }
  const controllerOf = (s, pid) => Object.keys(s.ctrl).find((h) => s.ctrl[h] === pid) || null;
  // ---------- kicks ----------
  function kick(s, p, vx, vy, vz, kind, ev, power = 0) {
    const b = s.ball; b.vx = vx; b.vy = vy; b.vz = vz; b.z = Math.max(b.z, .05); b.owner = null; b.last = p.id; b.lastTeam = p.team; b.tried = false; p.cd = F.KICK_CD; p.hold = 0;
    if (kind === 'pass' || kind === 'lob') { p.st.pa++; s.lastPass = { by: p.id, team: p.team, t: s.t }; } else s.lastPass = kind === 'shot' ? s.lastPass : null;
    if (kind === 'shot') { s.shots[p.team]++; p.st.sh++; }
    ev.push({ type: 'kick', kind, by: p.id, power: +power.toFixed(2) });
  }
  function aimPass(s, p, dx, dy) {
    const m = hyp(dx, dy); let ux = m > .3 ? dx / m : Math.cos(p.ang), uy = m > .3 ? dy / m : Math.sin(p.ang);
    let best = null, bs = -1e9;
    for (const q of s.players) {
      if (q === p || q.team !== p.team) continue;
      const tx = q.x + q.vx * .3 - p.x, ty = q.y + q.vy * .3 - p.y, d = hyp(tx, ty) || 1, c = (tx * ux + ty * uy) / d;
      if (c < .25) continue;
      const score = c * 3 - d / 22 - (q.role === 'gk' ? 1.5 : 0);
      if (score > bs) { bs = score; best = q; }
    }
    return { q: best, ux, uy };
  }
  function doPass(s, p, dx, dy, lob, power, ev) {
    const { q, ux, uy } = aimPass(s, p, dx, dy);
    let tx, ty;
    if (q) { const lead = lob ? .55 : .3; tx = q.x + q.vx * lead + (lob ? dirOf(p.team) * 2 : 0); ty = q.y + q.vy * lead; }
    else { tx = p.x + ux * (lob ? 16 : 11); ty = p.y + uy * (lob ? 16 : 11); }
    tx = clamp(tx, .5, F.W - .5); ty = clamp(ty, .5, F.H - .5);
    const d = hyp(tx - p.x, ty - p.y) || 1, nx = (tx - p.x) / d, ny = (ty - p.y) / d;
    if (lob) { const vz = clamp(d * .42, 5, 11), tf = 2 * vz / F.G, sp = Math.min(24, d / tf * .92); kick(s, p, nx * sp, ny * sp, vz, 'lob', ev, power); }
    else { const sp = clamp(6 + d * 1.15, 11, 25); kick(s, p, nx * sp, ny * sp, 0, 'pass', ev, power); }
    if (q) s.lastPass.to = q.id;
  }
  // Shot: power 0..1 from the hold meter; aim -1..1 across the goal mouth (from the stick, or away from the keeper for bots).
  function doShot(s, p, power, aim, err, r, ev) {
    power = clamp(power, .15, 1);
    const gx = goalX(p.team), d = Math.abs(gx - p.x);
    let ty = F.H / 2 + clamp(aim, -1, 1) * (F.GOAL / 2 - .55);
    ty += (r() - .5) * 2 * (err + Math.max(0, power - .86) * 9 + d * .05);
    const tx = gx + dirOf(p.team) * 1, dd = hyp(tx - p.x, ty - p.y) || 1, sp = 13 + power * 19;
    const vz = power > .9 ? 3 + (power - .9) * 110 : .5 + power * 2.2;
    kick(s, p, (tx - p.x) / dd * sp, (ty - p.y) / dd * sp, vz, 'shot', ev, power);
  }
  function slide(s, p, dx, dy, ev) {
    if (p.slide || p.stun || p.role === 'gk') return;
    const m = hyp(dx, dy); const ux = m > .3 ? dx / m : Math.cos(p.ang), uy = m > .3 ? dy / m : Math.sin(p.ang);
    p.slide = 450; p.vx = ux * 11.5; p.vy = uy * 11.5; p.ang = Math.atan2(uy, ux); ev.push({ type: 'slide', by: p.id });
  }
  function switchTo(s, h, p, ev) { if (!p || s.ctrl[h] === p.id) return; s.ctrl[h] = p.id; s.switchCd[h] = 500; ev.push({ type: 'switch', human: h, to: p.id }); }
  function nearestMate(s, team, exclude = []) {
    const b = s.ball; return s.players.filter((q) => q.team === team && q.role !== 'gk' && !exclude.includes(q.id)).sort((a, c) => dist(a, b) - dist(c, b))[0];
  }
  // Apply one action for a player (from a human or a bot).
  function act(s, p, a, mv, r, h, ev) {
    const b = s.ball, mine = b.owner === p.id, nearLoose = !b.owner && b.z < 1.1 && dist(p, b) < 1.4 && p.cd === 0;
    const D = DIFF[s.difficulty], err = p.bot && !h ? D.err : .35;
    if (a.type === 'shoot') {
      if (mine || nearLoose) { const lat = p.team === 0 ? mv.my : -mv.my; const aim = h ? (Math.abs(lat) > .2 ? lat : (r() - .5) * .6) : (a.aim ?? 0); doShot(s, p, a.power ?? .7, aim, err, r, ev); }
      else if (h) slide(s, p, mv.mx, mv.my, ev);
    } else if (a.type === 'pass' || a.type === 'lob') {
      if (mine || nearLoose) doPass(s, p, a.dx ?? mv.mx, a.dy ?? mv.my, a.type === 'lob' || !!a.lob, a.power ?? .5, ev);
      else if (h) { const others = Object.entries(s.ctrl).filter(([k]) => k !== h).map(([, v]) => v); switchTo(s, h, nearestMate(s, p.team, [p.id, ...others]), ev); }
    } else if (a.type === 'tackle') slide(s, p, mv.mx, mv.my, ev);
    else if (a.type === 'switch' && h) { const others = Object.entries(s.ctrl).filter(([k]) => k !== h).map(([, v]) => v); switchTo(s, h, nearestMate(s, p.team, [p.id, ...others]), ev); }
  }
  // ---------- bots ----------
  function shapePos(s, p) {
    const b = s.ball, h = home(p.team, p.slot, s.size), own = b.owner ? byId(s, b.owner) : null, attacking = own ? own.team === p.team : b.lastTeam === p.team;
    const d = dirOf(p.team), shift = attacking ? { def: 8, mid: 11, att: 14 }[p.role] || 10 : { def: -2, mid: -5, att: -7 }[p.role] || -4;
    let x = h.x + d * shift + (b.x - F.W / 2) * .42, y = h.y + (b.y - F.H / 2) * .38;
    if (p.role === 'def') x = d > 0 ? Math.min(x, b.x - 3) : Math.max(x, b.x + 3);
    return { x: clamp(x, 2, F.W - 2), y: clamp(y, 2, F.H - 2) };
  }
  const steer = (p, tx, ty, slow = 1.2) => { const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy); if (d < .25) return { mx: 0, my: 0 }; const k = d < slow ? d / slow : 1; return { mx: dx / d * k, my: dy / d * k, d }; };
  function keeperAI(s, p, r, ev) {
    const b = s.ball, gx = ownGoalX(p.team), d = dirOf(p.team), D = DIFF[s.difficulty];
    if (b.owner === p.id) {
      p.hold += F.DT; if (p.hold < 800) return { mx: 0, my: 0 };
      const mates = s.players.filter((q) => q.team === p.team && q !== p); const pressed = s.players.some((q) => q.team !== p.team && dist(q, p) < 7);
      const tgt = mates.sort((a, c) => (openness(s, c) - openness(s, a)))[0];
      return { mx: 0, my: 0, act: { type: pressed || !tgt ? 'lob' : 'pass', dx: tgt ? tgt.x - p.x : d, dy: tgt ? tgt.y - p.y : 0 } };
    }
    // Dive at shots heading for goal.
    const toward = (b.vx * -d), sp = hyp(b.vx, b.vy);
    if (!b.owner && toward > 6 && !p.dive && Math.abs(b.x - gx) < 26) {
      const t = (p.x - b.x) / (b.vx || 1e-6);
      if (t > 0 && t < .6) { const py = b.y + b.vy * t; if (Math.abs(py - F.H / 2) < F.GOAL / 2 + 1 && Math.abs(py - p.y) > .7 && r() < .5 + D.save * .45) { p.dive = 620; const dy = py - p.y; p.vy = Math.sign(dy) * Math.min(10, Math.abs(dy) / Math.max(t, .14)); p.vx = 0; ev.push({ type: 'dive', by: p.id }); } }
    }
    const inBox = Math.abs(b.x - gx) < F.BOX_D && Math.abs(b.y - F.H / 2) < F.BOX_W / 2;
    if (!b.owner && inBox && sp < 14) { const opp = s.players.filter((q) => q.team !== p.team).reduce((m, q) => Math.min(m, dist(q, b)), 99); if (dist(p, b) < opp + 1.5) { const st = steer(p, b.x, b.y, .3); return { ...st, sprint: true }; } }
    const toBall = hyp(b.x - gx, b.y - F.H / 2), dk = clamp(toBall * .1, .6, 2.6);
    const ang = Math.atan2(b.y - F.H / 2, (b.x - gx) || .001);
    const tx = gx + Math.cos(ang) * dk, ty = clamp(F.H / 2 + Math.sin(ang) * dk * 1.2, F.H / 2 - F.GOAL / 2 - .2, F.H / 2 + F.GOAL / 2 + .2);
    return steer(p, tx, ty, .8);
  }
  function openness(s, q) { let m = 99; for (const o of s.players) if (o.team !== q.team) m = Math.min(m, dist(o, q)); return m + dirOf(q.team) * (q.x - F.W / 2) * .08; }
  function laneBlocked(s, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y, L = hyp(dx, dy) || 1;
    return s.players.some((o) => { if (o.team === p.team) return false; const t = ((o.x - p.x) * dx + (o.y - p.y) * dy) / (L * L); if (t < .05 || t > .95) return false; return hyp(p.x + dx * t - o.x, p.y + dy * t - o.y) < 1.3; });
  }
  function botAI(s, p, r, ev) {
    if (p.role === 'gk') return keeperAI(s, p, r, ev);
    const b = s.ball, D = DIFF[s.difficulty], d = dirOf(p.team), gx = goalX(p.team);
    p.think -= F.DT;
    if (b.owner === p.id) {
      const toGoal = hyp(gx - p.x, F.H / 2 - p.y), front = s.players.filter((o) => o.team !== p.team && (o.x - p.x) * d > -0.5 && dist(o, p) < 3.2);
      if (p.think <= 0) {
        p.think = D.react * (.6 + r() * .8);
        const k = keeperOf(s, 1 - p.team);
        if (toGoal < D.range * (s.size === 1 ? .75 : 1) && Math.abs(p.y - F.H / 2) < 10 && (toGoal < 8 || !front.length || r() < .3)) { const aim = k ? (k.y > F.H / 2 ? -1 : 1) * (.55 + r() * .4) : (r() - .5); return { mx: 0, my: 0, act: { type: 'shoot', power: .62 + r() * .26, aim } }; }
        const mates = s.players.filter((q) => q.team === p.team && q !== p && q.role !== 'gk');
        if (mates.length && (front.length && r() < D.pass + .2 || r() < D.pass * .35)) {
          const ahead = mates.map((q) => ({ q, v: openness(s, q) + (q.x - p.x) * d * .25 - dist(p, q) * .05 })).sort((a, c) => c.v - a.v)[0];
          if (ahead && ahead.v > 1.5) { const lob = laneBlocked(s, p, ahead.q); return { mx: 0, my: 0, act: { type: lob ? 'lob' : 'pass', dx: ahead.q.x - p.x, dy: ahead.q.y - p.y } }; }
        }
      }
      // Dribble toward goal, bending away from defenders in front.
      let vx = gx - p.x, vy = F.H / 2 - p.y; const m = hyp(vx, vy) || 1; vx /= m; vy /= m;
      for (const o of front) { const ox = p.x - o.x, oy = p.y - o.y, od = hyp(ox, oy) || 1; vy += (oy / od) * 1.4 / od; vx += (ox / od) * .3 / od; }
      if (p.y < 3) vy += .8; if (p.y > F.H - 3) vy -= .8;
      const mm = hyp(vx, vy) || 1; return { mx: vx / mm, my: vy / mm, sprint: !front.length && p.stamina > .4 };
    }
    const own = b.owner ? byId(s, b.owner) : null, mates = s.players.filter((q) => q.team === p.team && q.role !== 'gk');
    const rank = mates.slice().sort((a, c) => dist(a, b) - dist(c, b)), myRank = rank.indexOf(p);
    // Teammates controlled by humans count as the chaser if they're closest.
    if (!own || own.team !== p.team) {
      const human0 = rank[0] && controllerOf(s, rank[0].id);
      const chaseRank = human0 ? 1 : 0;
      if (myRank === chaseRank || (!own && myRank === 0)) {
        const lead = own ? .25 : clamp(dist(p, b) / 14, .1, .7), tx = b.x + b.vx * lead, ty = b.y + b.vy * lead;
        if (own && dist(p, own) < 2.1 && p.cd === 0 && !p.slide && r() < D.tackle * .05) return { ...steer(p, tx, ty), act: { type: 'tackle' } };
        return { ...steer(p, tx, ty, .2), sprint: dist(p, b) > 4 && p.stamina > .25 };
      }
      if (own && myRank === chaseRank + 1) { const og = ownGoalX(p.team); return { ...steer(p, b.x + (og - b.x) * .3, b.y + (F.H / 2 - b.y) * .3, 1) }; }
    }
    const sp = shapePos(s, p); return { ...steer(p, sp.x, sp.y, 1.5), sprint: dist(p, sp) > 9 && p.stamina > .5 };
  }
  // ---------- the tick ----------
  function movePlayer(p, mv, sec, ownsBall, speedK = 1) {
    if (p.slide > 0) { p.slide -= sec * 1000; const f = Math.pow(.05, sec); p.vx *= f; p.vy *= f; if (p.slide <= 0) { p.slide = 0; p.stun = 280; } }
    else if (p.dive > 0) { p.dive -= sec * 1000; p.vy *= Math.pow(.15, sec); if (p.dive <= 0) { p.dive = 0; p.stun = 350; } }
    else {
      let mx = +mv.mx || 0, my = +mv.my || 0; const m = hyp(mx, my); if (m > 1) { mx /= m; my /= m; }
      const sprint = !!mv.sprint && p.stamina > .05 && m > .2;
      p.sprint = sprint; p.stamina = clamp(p.stamina + (sprint ? -.22 : .1) * sec, 0, 1);
      let top = (sprint ? F.SPRINT : F.SPEED) * speedK * (ownsBall ? .9 : 1) * (p.stun > 0 ? .35 : 1);
      if (p.role === 'gk') top *= .95;
      const tvx = mx * top, tvy = my * top, dvx = tvx - p.vx, dvy = tvy - p.vy, dm = hyp(dvx, dvy), maxd = F.ACCEL * (ownsBall ? .8 : 1) * sec;
      if (dm > maxd) { p.vx += dvx / dm * maxd; p.vy += dvy / dm * maxd; } else { p.vx = tvx; p.vy = tvy; }
      if (p.stun > 0) p.stun = Math.max(0, p.stun - sec * 1000);
      const want = m > .15 ? Math.atan2(my, mx) : hyp(p.vx, p.vy) > .8 ? Math.atan2(p.vy, p.vx) : p.ang;
      let da = want - p.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const turn = (ownsBall ? 9 : 14) * sec; p.ang += clamp(da, -turn, turn);
    }
    p.x = clamp(p.x + p.vx * sec, -1.5, F.W + 1.5); p.y = clamp(p.y + p.vy * sec, -1.5, F.H + 1.5);
    p.touch += hyp(p.vx, p.vy) * sec * 1.3;
  }
  function normInputs(inputs) {
    const out = {};
    for (const [h, i] of Object.entries(inputs || {})) {
      if (!i) continue; const o = { mx: +i.mx || 0, my: +i.my || 0, sprint: !!i.sprint, act: null };
      if (i.act && typeof i.act === 'object') o.act = i.act;
      else if (i.shoot) o.act = { type: 'shoot', power: typeof i.shoot === 'number' ? i.shoot : .7 };
      else if (i.pass) o.act = { type: i.lob ? 'lob' : 'pass', power: .5 };
      out[h] = o;
    }
    return out;
  }
  // inputs: { [humanId]: {mx,my,sprint, act:{n,type,power}} } (also accepts the v1 {pass,shoot} booleans). dt in ms.
  function step(s, inputs = {}, dt = F.DT) {
    const ev = [], ins = normInputs(inputs); let left = dt, first = true;
    while (left > 0 && s.phase !== 'full') { const d = Math.min(left, 34); left -= d; tick(s, ins, d, ev, first); first = false; }
    return ev;
  }
  function tick(s, ins, dt, ev, first) {
    const r = rng(s.seed * 31 + s.seq++), sec = dt / 1000, b = s.ball, D = DIFF[s.difficulty];
    s.phaseT -= dt;
    if (s.phase === 'goal') { ballPhysics(s, sec, ev, true); for (const p of s.players) movePlayer(p, { mx: 0, my: 0 }, sec, false); if (s.phaseT <= 0) { if (s.endAfterGoal) return finish(s, ev); kickoff(s, s.kickoffTeam); } return; }
    if (s.phase === 'kickoff') { if (s.phaseT > 0) return; s.phase = 'play'; const t = s.players.filter((p) => p.team === s.kickoffTeam && p.role !== 'gk').sort((a, c) => dist(a, b) - dist(c, b))[0]; if (t) { b.owner = t.id; b.last = t.id; b.lastTeam = t.team; } ev.push({ type: 'whistle', kind: 'kickoff' }); }
    if (s.phase === 'restart') { if (s.phaseT > 0) return; s.phase = 'play'; ev.push({ type: 'whistle', kind: 'restart' }); }
    s.t += dt;
    if (b.owner) { const o = byId(s, b.owner); if (o) s.poss[o.team] += dt; }
    for (const h of Object.keys(s.switchCd)) s.switchCd[h] = Math.max(0, s.switchCd[h] - dt);
    // Who is human-controlled this tick.
    const ctrlBy = {}; for (const [h, pid] of Object.entries(s.ctrl)) ctrlBy[pid] = h;
    for (const p of s.players) {
      const h = ctrlBy[p.id]; let mv;
      if (h) {
        const i = ins[h] || { mx: 0, my: 0 }; mv = i;
        if (first && i.act && (i.act.n === undefined || i.act.n > (s.actN[h] || 0))) { if (i.act.n !== undefined) s.actN[h] = i.act.n; act(s, p, i.act, i, r, h, ev); }
        if (p.role === 'gk' && !i.mx && !i.my && b.owner !== p.id) mv = keeperAI(s, p, r, ev); // human keeper: auto-position when idle
      } else { mv = botAI(s, p, r, ev); if (mv.act) act(s, p, mv.act, mv, r, null, ev); }
      p.cd = Math.max(0, p.cd - dt);
      movePlayer(p, mv, sec, b.owner === p.id, h ? 1 : D.speed);
    }
    // Soft collisions between players (sliding players knock others over).
    for (let i = 0; i < s.players.length; i++) for (let j = i + 1; j < s.players.length; j++) {
      const a = s.players[i], c = s.players[j], dx = c.x - a.x, dy = c.y - a.y, d = hyp(dx, dy), min = F.R * 1.6;
      if (d > 0 && d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
    }
    if (b.owner) {
      const p = byId(s, b.owner);
      if (!p) b.owner = null;
      else {
        const spd = hyp(p.vx, p.vy), off = F.R + F.BALL + .05 + (spd > 1 ? .18 + .32 * (.5 + .5 * Math.sin(p.touch * 2.2)) : 0);
        b.x = p.x + Math.cos(p.ang) * off; b.y = p.y + Math.sin(p.ang) * off; b.z = 0; b.vx = p.vx; b.vy = p.vy; b.vz = 0; b.spin += spd * sec / F.BALL;
        // Steals: an opponent pressing into the carrier can poke the ball away.
        for (const q of s.players) {
          if (q.team === p.team || q.stun || q.cd) continue; const dq = hyp(q.x - b.x, q.y - b.y);
          if (q.slide > 0 && dq < 1.25) { b.owner = null; b.vx = Math.cos(q.ang) * 8 + (r() - .5) * 3; b.vy = Math.sin(q.ang) * 8 + (r() - .5) * 3; b.vz = 1.5; b.last = q.id; b.lastTeam = q.team; b.tried = false; p.stun = 650; p.vx *= .2; p.vy *= .2; q.st.tk++; ev.push({ type: 'tackle', by: q.id, on: p.id }); break; }
          const rate = ctrlBy[q.id] ? 1.4 : D.steal;
          if (q.role !== 'gk' && dq < .95 && r() < rate * sec * 1.6) { b.owner = q.id; b.last = q.id; b.lastTeam = q.team; p.cd = 500; p.stun = 250; q.st.tk++; ev.push({ type: 'steal', by: q.id, on: p.id }); if (ctrlBy[p.id] && s.autoSwitch) {} break; }
        }
        if (p.role === 'gk' && b.owner === p.id) p.hold = p.hold || 1;
      }
    } else ballPhysics(s, sec, ev, false, r);
    if (s.phase !== 'play') return;
    // Auto-switch: the human's team-mate nearest the ball takes over when defending; a pass receiver is switched to.
    if (s.autoSwitch) for (const [h, pid] of Object.entries(s.ctrl)) {
      const cp = byId(s, pid); if (!cp || s.switchCd[h] > 0) continue;
      const own = b.owner ? byId(s, b.owner) : null;
      if (own && own.team === cp.team && own !== cp && !ctrlBy[own.id] && own.role !== 'gk') { switchTo(s, h, own, ev); continue; }
      if (own && own.team === cp.team) continue;
      const others = Object.entries(s.ctrl).filter(([k]) => k !== h).map(([, v]) => v), n = nearestMate(s, cp.team, others);
      if (n && n !== cp && dist(n, b) + 3 < dist(cp, b)) switchTo(s, h, n, ev);
    }
    const limit = s.duration + (s.extra ? F.EXTRA_MS : 0);
    if (s.t >= limit) {
      if (s.score[0] === s.score[1] && s.knockout && !s.extra) { s.extra = true; ev.push({ type: 'extra' }); kickoff(s, r() < .5 ? 0 : 1); return; }
      finish(s, ev);
    }
  }
  function ballPhysics(s, sec, ev, inGoal, r = Math.random) {
    const b = s.ball, prevX = b.x;
    b.x += b.vx * sec; b.y += b.vy * sec; b.z += b.vz * sec; b.vz -= F.G * sec;
    const hs = hyp(b.vx, b.vy); b.spin += hs * sec / F.BALL;
    if (b.z <= 0) { b.z = 0; if (b.vz < -2.5) { b.vz = -b.vz * .5; b.vx *= .86; b.vy *= .86; ev.push({ type: 'bounce', v: +(-b.vz).toFixed(1) }); } else b.vz = 0; }
    if (b.z === 0 && b.vz === 0) { const k = Math.exp(-.8 * sec), lin = 1.4 * sec; const n = Math.max(0, hs * k - lin); if (hs > 0) { b.vx *= n / hs; b.vy *= n / hs; } }
    else { const k = Math.exp(-.08 * sec); b.vx *= k; b.vy *= k; }
    const mouthTop = F.H / 2 - F.GOAL / 2, mouthBot = F.H / 2 + F.GOAL / 2, inMouth = b.y > mouthTop && b.y < mouthBot;
    if (inGoal) { // ball rolling into the net after a goal
      if (b.x < -F.NET + .3) { b.x = -F.NET + .3; b.vx = -b.vx * .2; } if (b.x > F.W + F.NET - .3) { b.x = F.W + F.NET - .3; b.vx = -b.vx * .2; }
      if (b.x < 0 || b.x > F.W) { if (b.y < mouthTop + .3) { b.y = mouthTop + .3; b.vy = Math.abs(b.vy) * .3; } if (b.y > mouthBot - .3) { b.y = mouthBot - .3; b.vy = -Math.abs(b.vy) * .3; } if (b.z > F.GOAL_H - .3) { b.z = F.GOAL_H - .3; b.vz = -1; } }
      return;
    }
    // Posts and crossbar.
    for (const gx of [0, F.W]) for (const py of [mouthTop, mouthBot]) {
      if (b.z > F.GOAL_H) continue; const dx = b.x - gx, dy = b.y - py, d = hyp(dx, dy), min = F.POST + F.BALL;
      if (d < min && d > 0) { const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; b.vx *= .7; b.vy *= .7; b.x = gx + nx * min; b.y = py + ny * min; b.tried = false; ev.push({ type: 'post' }); } }
    }
    for (const gx of [0, F.W]) {
      const crossed = (prevX - gx) * (b.x - gx) <= 0 && prevX !== b.x;
      if (crossed && inMouth && b.z > F.GOAL_H - .3 && b.z < F.GOAL_H + .3) { b.vx = -b.vx * .55; b.vz = Math.abs(b.vz) * .3 + 1; b.x = gx + Math.sign(prevX - gx || 1) * .05; ev.push({ type: 'bar' }); return; }
    }
    // Keeper saves (one attempt per kick).
    for (const k of s.players) {
      if (k.role !== 'gk' || b.tried || b.lastTeam === k.team && b.last === k.id) continue;
      const reach = k.dive ? 1.7 : 1.15, d = hyp(k.x - b.x, k.y - b.y);
      if (d < reach && b.z < (k.dive ? 2.4 : 2.1)) {
        b.tried = true; const sp = hyp(b.vx, b.vy), D = DIFF[s.difficulty];
        if (sp < 7 && b.z < .6) { s.ball.owner = k.id; b.last = k.id; b.lastTeam = k.team; k.hold = 1; ev.push({ type: 'save', by: k.id, kind: 'collect' }); return; }
        const chance = clamp(D.save * (1.45 - sp / 42) - (d / reach) * .18, .15, .97);
        if (r() < chance) {
          k.st.sv++;
          if (sp < 21 && r() < .55) { b.owner = k.id; b.last = k.id; b.lastTeam = k.team; b.vx = b.vy = b.vz = 0; k.hold = 1; ev.push({ type: 'save', by: k.id, kind: 'catch' }); return; }
          const d0 = dirOf(k.team); b.vx = Math.abs(b.vx) * .35 * d0 + d0 * 3; b.vy = b.vy * .4 + (r() - .5) * 12; b.vz = 3 + r() * 2; b.last = k.id; b.lastTeam = k.team; ev.push({ type: 'save', by: k.id, kind: 'parry' }); return;
        }
      }
    }
    // Loose ball: the nearest player who can reach it takes it (fast shots are only blocked).
    if (b.z < 1) {
      let best = null, bd = F.CONTROL;
      for (const p of s.players) { if (p.cd || p.stun || p.dive) continue; const d = hyp(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = p; } }
      if (best) {
        const rel = hyp(b.vx - best.vx, b.vy - best.vy);
        if (best.slide) { b.vx = Math.cos(best.ang) * 9; b.vy = Math.sin(best.ang) * 9; b.last = best.id; b.lastTeam = best.team; best.cd = 200; }
        else if (rel > 19 && best.team !== b.lastTeam) { b.vx *= -.3; b.vy *= -.3; b.vz = 2; b.last = best.id; b.lastTeam = best.team; best.cd = 250; ev.push({ type: 'block', by: best.id }); }
        else {
          const lp = s.lastPass; if (lp && lp.team === best.team && lp.by !== best.id && s.t - lp.t < 4000 && b.last === lp.by) { const pp = byId(s, lp.by); if (pp) pp.st.pc++; s.lastPass = { ...lp, rec: best.id, recT: s.t }; }
          b.owner = best.id; b.last = best.id; b.lastTeam = best.team; b.z = 0; b.vz = 0; best.touch = 0;
        }
      }
    }
    // Out of play.
    if (b.y < -F.BALL || b.y > F.H + F.BALL) return restart(s, 'kickin', 1 - b.lastTeam, clamp(b.x, 1, F.W - 1), b.y < 0 ? .4 : F.H - .4, ev);
    for (const [gx, defTeam] of [[0, 0], [F.W, 1]]) {
      const over = gx === 0 ? b.x < 0 : b.x > F.W; if (!over) continue;
      if (inMouth && b.z < F.GOAL_H) return goal(s, 1 - defTeam, ev);
      if (b.lastTeam === defTeam) return restart(s, 'corner', 1 - defTeam, gx === 0 ? .5 : F.W - .5, b.y < F.H / 2 ? .5 : F.H - .5, ev);
      return restart(s, 'goalkick', defTeam, gx === 0 ? F.SIX_D : F.W - F.SIX_D, F.H / 2, ev);
    }
  }
  function restart(s, type, team, x, y, ev) {
    const b = s.ball; Object.assign(b, { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: null, tried: false });
    let taker = type === 'goalkick' ? keeperOf(s, team) : null;
    if (!taker) taker = s.players.filter((p) => p.team === team && p.role !== 'gk').sort((a, c) => hyp(a.x - x, a.y - y) - hyp(c.x - x, c.y - y))[0];
    const ax = clamp(F.W / 2 - x, -1, 1) * (type === 'corner' ? 0 : 1), ay = y < F.H / 2 ? 1 : -1;
    const tx = type === 'kickin' ? 0 : type === 'corner' ? (x < F.W / 2 ? 1 : -1) : dirOf(team), ty = type === 'kickin' ? ay : type === 'corner' ? ay : 0;
    void ax; const m = hyp(tx, ty) || 1;
    if (taker) { taker.ang = Math.atan2(ty / m, tx / m); taker.x = x - Math.cos(taker.ang) * (F.R + F.BALL + .05); taker.y = y - Math.sin(taker.ang) * (F.R + F.BALL + .05); taker.vx = taker.vy = 0; taker.hold = 0; b.owner = taker.id; b.last = taker.id; b.lastTeam = team; taker.think = 250; giveSwitch(s, taker); }
    for (const p of s.players) if (p.team !== team && hyp(p.x - x, p.y - y) < 4) { const d = hyp(p.x - x, p.y - y) || 1; p.x = x + (p.x - x) / d * 4; p.y = clamp(y + (p.y - y) / d * 4, 1, F.H - 1); }
    s.phase = 'restart'; s.phaseT = F.RESTART_MS; s.restart = { type, team, x, y };
    ev.push({ type: 'out', kind: type, team }); ev.push({ type: 'whistle', kind: 'out' });
  }
  function goal(s, team, ev) {
    s.score[team]++; const b = s.ball, by = b.last, scorer = byId(s, by), own = !!scorer && scorer.team !== team;
    let assist = null; const lp = s.lastPass; if (!own && lp && lp.team === team && lp.rec === by && lp.by !== by && s.t - lp.t < 8000) assist = lp.by;
    if (scorer && !own) { scorer.st.g++; scorer.st.sot++; } if (assist) byId(s, assist).st.a++;
    const g = { team, by: own ? null : by, own, t: Math.round(s.t) }; s.goals.push(g); s.lastGoal = { ...g, scorer: by, assist };
    ev.push({ type: 'goal', team, by, own, assist });
    s.phase = 'goal'; s.phaseT = F.GOAL_MS; s.kickoffTeam = 1 - team; b.owner = null;
    if (s.extra) s.endAfterGoal = true; // golden goal
  }
  // Penalties only decide a knockout tie still level after extra time; seeded so host and server agree.
  function penalties(seed) { const r = rng(seed * 7 + 3), k = [0, 0]; for (let i = 0; i < 5; i++) for (const t of [0, 1]) if (r() < .75) k[t]++; while (k[0] === k[1]) { for (const t of [0, 1]) if (r() < .75) k[t]++; } return k; }
  function finish(s, ev) {
    s.phase = 'full'; s.phaseT = 0;
    if (s.score[0] !== s.score[1]) s.winner = s.score[0] > s.score[1] ? 0 : 1;
    else if (s.knockout) { s.pens = penalties(s.seed); s.winner = s.pens[0] > s.pens[1] ? 0 : 1; }
    else s.winner = null;
    ev.push({ type: 'full', score: s.score.slice(), winner: s.winner, pens: s.pens }); ev.push({ type: 'whistle', kind: 'full' });
  }
  // Man of the match: goals, assists, saves, tackles, shots on target and completed passes.
  function rating(p) { const t = p.st; return t.g * 3 + t.a * 2 + t.sv * 1.2 + t.tk * .8 + t.sot * .5 + t.sh * .2 + t.pc * .25; }
  function manOfMatch(s) { let best = null, bv = -1; for (const p of s.players) { const v = rating(p) + (s.winner === p.team ? .5 : 0); if (v > bv) { bv = v; best = p; } } return best ? { id: best.id, name: best.name, team: best.team, num: best.num, bot: best.bot, st: { ...best.st }, rating: +bv.toFixed(1) } : null; }
  function possession(s) { const t = s.poss[0] + s.poss[1]; return t ? [Math.round(s.poss[0] / t * 100), 100 - Math.round(s.poss[0] / t * 100)] : [50, 50]; }
  // What the host reports at full time and what the server re-checks (football-lib.php fb_check_result).
  function report(s) { return { score: s.score.slice(), goals: s.goals.map((g) => ({ team: g.team, by: g.by, own: g.own, t: g.t })), winner: s.winner, pens: s.pens, extra: s.extra, t: Math.round(s.t) }; }
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
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  function snapshot(s) {
    const n = { v: 2, t: Math.round(s.t), ph: s.phase, pt: Math.round(s.phaseT), sc: s.score, x: s.extra ? 1 : 0, w: s.winner, pn: s.pens, ko: s.kickoffTeam, c: s.ctrl,
      b: [r1(s.ball.x), r1(s.ball.y), r1(s.ball.z), r1(s.ball.vx), r1(s.ball.vy), r1(s.ball.vz), s.ball.owner, r1(s.ball.spin % 100)],
      p: s.players.map((p) => [p.id, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r2(p.ang), (p.slide ? 1 : 0) | (p.dive ? 2 : 0) | (p.sprint ? 4 : 0) | (p.stun ? 8 : 0), r1(p.stamina)]),
      g: s.goals.length, rs: s.restart && s.phase === 'restart' ? s.restart : null, sh: s.shots, po: s.poss.map(Math.round) };
    if (s.phase === 'goal' || s.phase === 'full') { n.lg = s.lastGoal; n.gl = s.goals; n.st = s.players.map((p) => [p.id, p.st.g, p.st.a, p.st.sh, p.st.sot, p.st.pa, p.st.pc, p.st.tk, p.st.sv]); }
    return n;
  }
  function applySnapshot(s, n, { skip = null } = {}) {
    if (!n) return s; s.t = n.t; s.phase = n.ph; s.phaseT = n.pt; s.score = n.sc.slice(); s.extra = !!n.x; s.winner = n.w ?? null; s.pens = n.pn || null;
    if (n.ko !== undefined) s.kickoffTeam = n.ko; if (n.c) s.ctrl = { ...n.c }; if (n.sh) s.shots = n.sh.slice(); if (n.po) s.poss = n.po.slice();
    const b = n.b; Object.assign(s.ball, b.length > 5 ? { x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5], owner: b[6], spin: b[7] } : { x: b[0], y: b[1], z: 0, vx: b[2], vy: b[3], vz: 0, owner: b[4] });
    for (const a of n.p) { const p = byId(s, a[0]); if (!p || p.id === skip) continue; if (a.length > 7) Object.assign(p, { x: a[1], y: a[2], vx: a[3], vy: a[4], ang: a[5], slide: a[6] & 1 ? 1 : 0, dive: a[6] & 2 ? 1 : 0, sprint: !!(a[6] & 4), stun: a[6] & 8 ? 1 : 0, stamina: a[7] }); else Object.assign(p, { x: a[1], y: a[2], vx: a[3], vy: a[4], ang: Math.atan2(a[6], a[5]) }); }
    s.restart = n.rs || null; if (n.lg) s.lastGoal = n.lg; if (n.gl) s.goals = n.gl.slice();
    if (n.st) for (const a of n.st) { const p = byId(s, a[0]); if (p) p.st = { g: a[1], a: a[2], sh: a[3], sot: a[4], pa: a[5], pc: a[6], tk: a[7], sv: a[8] }; }
    return s;
  }
  // ---------- knockout brackets ----------
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
  const api = { F, DIFF, ROLES, rng, create, step, kickoff, movePlayer, report, checkReport, penalties, snapshot, applySnapshot, manOfMatch, possession, rating, bracket, seedOrder, recordResult, champion, playable, home, dirOf, goalX };
  root.ChinaLifeFootballEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
