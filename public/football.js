// Football Field: "⚽ Play a match" (Oct 2026, v2 polish). Real-time 1v1 to 5v5 matches with joystick, Sprint, Pass (hold = lob), Shoot (hold = power),
// lobbies with Team A/B and quick match, bots in empty slots, and knockout tournaments with a bracket.
// Online it talks to chinalife-api/football.php; the match is host-authoritative (the host's phone runs
// football-engine.js and relays snapshots through the API; everyone else sends inputs and draws what the host sends).
// Offline (preview sandbox) everything runs on this device: you plus bots, and local tournaments vs local teams.
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  const E = root.ChinaLifeFootballEngine; if (!E) return;
  const F = E.F, $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const game = () => root.ChinaLife, sandbox = () => root.ChinaLifeSandbox;
  const PREFIX = () => sandbox()?.storagePrefix || '';
  const OFF_KEY = () => PREFIX() + 'chinalife-football-off', T_KEY = () => PREFIX() + 'chinalife-football-tournaments', STATS_KEY = () => PREFIX() + 'chinalife-football-stats';
  // The game never exposed ChinaLifeCloud.api, so Football ran offline (you plus bots) for everyone. The signed-in request
  // (ChinaLifeAuth.request) is the same function; the server's football_matches switch decides if matches are open.
  const net = () => root.ChinaLifeCloud?.api || root.ChinaLifeAuth?.request || null;
  const online = () => !sandbox()?.localOnly && !!root.ChinaLifeCloud?.joined && !!net();
  let serverOn = null; // null = not asked yet
  const meName = () => String(game()?.state?.name || game()?.state?.player?.name || root.ChinaLifeCloud?.profile?.user_name || 'You').slice(0, 18);
  function enabled() {
    if (root.ChinaLifeFlags?.off?.('football')) return false;
    if (!online()) return localStorage.getItem(OFF_KEY()) !== '1';
    return serverOn === true;
  }
  async function call(method, body) { const r = await net()('/chinalife/football.php', method, body); return r?.data || r; }
  async function refreshFlag() { if (!online()) return enabled(); try { const d = await call('GET', { action: 'lobby' }); serverOn = d?.enabled === true; return serverOn; } catch { serverOn = false; return false; } }
  // ---------- screen ----------
  let el = null, view = 'home', poll = null, loop = null, msgT = null;
  let match = null; // {local, id, state, me, myTeam, host, roster, size, tournament, bracketMatch, seq}
  function screen() {
    if (el) return el;
    el = document.createElement('div'); el.id = 'fbScreen'; el.className = 'fb-screen'; el.hidden = true;
    el.innerHTML = '<header class="fb-top"><button class="fb-back" data-fb="back" aria-label="Back">‹</button><b class="fb-title">⚽ Football Field</b><button class="fb-x" data-fb="close" aria-label="Close">✕</button></header><main class="fb-body"></main><div class="fb-msg" hidden></div>';
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    return el;
  }
  const body = () => $('.fb-body', screen());
  function say(m) { const n = $('.fb-msg', screen()); n.textContent = m; n.hidden = false; clearTimeout(msgT); msgT = setTimeout(() => { n.hidden = true; }, 2600); }
  function show(v, html, title) { view = v; screen().hidden = false; screen().dataset.view = v; $('.fb-title', el).textContent = title || '⚽ Football Field'; body().innerHTML = html; document.documentElement.classList.add('fb-open'); }
  function close() {
    stopLoops(); if (el) el.hidden = true; document.documentElement.classList.remove('fb-open');
    if (match && !match.local && match.id && ['lobby', 'live'].includes(match.status) && match.state?.phase !== 'full') call('POST', { action: 'leave', id: match.id }).catch(() => {});
    match = null;
  }
  function stopLoops() { clearInterval(poll); poll = null; cancelAnimationFrame(loop); loop = null; clearInterval(netT); netT = null; SND.stop(); }
  // ---------- home ----------
  async function open() {
    if (!enabled()) { if (online() && serverOn === null && await refreshFlag()) return open(); return toastOut('Football matches are closed right now'); }
    home();
  }
  function toastOut(m) { (game()?.toast || root.toast || ((x) => console.info(x)))(m); }
  let pickSize = 3;
  async function home() {
    stopLoops(); match = null;
    const sizes = [1, 2, 3, 4, 5].map((n) => `<button class="fb-chip${n === pickSize ? ' on' : ''}" data-fb="size" data-n="${n}">${n}v${n}</button>`).join('');
    let lobbies = '', tours = '';
    if (online()) {
      try {
        const d = await call('GET', { action: 'lobby' });
        if (d.mine && ['lobby', 'live'].includes(d.mine.match?.status)) { return enterLobby(d.mine); }
        if (d.mine) setTimeout(() => say('Your last result is waiting for the other players to confirm'), 50);
        lobbies = (d.lobbies || []).map((l) => `<li><span>${l.size}v${l.size} · ${l.humans} player${l.humans == 1 ? '' : 's'} · ${l.status === 'live' ? 'playing' : 'waiting'}</span>${l.status === 'lobby' ? `<button class="fb-mini" data-fb="join" data-id="${esc(l.id)}">Join</button>` : ''}</li>`).join('');
        tours = (d.tournaments || []).map(tourRow).join('');
      } catch (e) { say(e.message); }
    } else tours = localTours().map(tourRow).join('');
    show('home', `<section class="fb-hero"><h2>Play a match</h2><p>Real matches with other players on the Field. Empty spots are filled by bots, so you can always play.</p>
      <div class="fb-sizes">${sizes}</div>
      <div class="fb-row"><button class="fb-btn primary" data-fb="quick">⚡ Quick match</button><button class="fb-btn" data-fb="create">＋ New match</button></div></section>
      ${online() ? `<section><h3>Open matches</h3><ul class="fb-list">${lobbies || '<li class="fb-empty">No open matches. Start one and invite friends.</li>'}</ul></section>` : ''}
      <section><h3>🏆 Tournaments</h3><ul class="fb-list">${tours || '<li class="fb-empty">No tournaments yet.</li>'}</ul><button class="fb-btn" data-fb="t-new">＋ Create a tournament</button></section>
      <p class="fb-note">${online() ? 'One match at a time. Results are checked by the server.' : 'Preview: matches and tournaments are saved on this device.'}</p>`);
  }
  const tourRow = (t) => `<li><span><b>${esc(t.name)}</b><small>${t.team_size}v${t.team_size} · ${t.teams}/${t.max_teams} teams · ${statusLabel(t)}${+t.prize_coins ? ` · 🪙 ${(+t.prize_coins).toLocaleString()}` : ''}</small></span><button class="fb-mini" data-fb="t-open" data-id="${esc(t.id)}">View</button></li>`;
  const statusLabel = (t) => t.status === 'registering' ? 'starts ' + when(t.starts_at) : t.status === 'running' ? 'in play' : t.status === 'done' ? 'finished' : 'cancelled';
  function when(at) { const d = new Date(String(at).includes('T') || String(at).includes('Z') ? at : String(at).replace(' ', 'T') + 'Z'); return isNaN(d) ? String(at) : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  // ---------- lobby ----------
  function localLobby(size, team = 0, extra = {}) {
    return { local: true, id: 'local', status: 'lobby', size, me: 'me', host: 'me', roster: [{ id: 'me', name: meName(), team }], ...extra };
  }
  function fromServer(d) {
    const m = d.match, me = String(d.me ?? lastMe ?? '');
    return { local: false, id: m.id, status: m.status, size: m.size, host: m.host, me, roster: d.players || [], tournament: m.tournament, bracketMatch: m.bracket_match, seed: m.seed, duration: m.duration, knockout: m.knockout, snap: d.snap, seq: d.seq || 0, score: m.score, winner: m.winner };
  }
  let lastMe = null;
  function enterLobby(d) { match = d.local ? d : fromServer(d); paintLobby(); if (!match.local) { clearInterval(poll); poll = setInterval(pollLobby, 1500); } }
  async function pollLobby() {
    if (!match || match.local) return;
    try { const d = await call('GET', { action: 'state', id: match.id }); const m = fromServer(d); Object.assign(match, m); if (match.status === 'live') return startMatch(); if (['cancelled', 'done'].includes(match.status)) { say('That match has ended'); return home(); } if (view === 'lobby') paintLobby(); } catch (e) { say(e.message); }
  }
  function paintLobby() {
    const m = match, mine = m.roster.find((p) => String(p.id) === String(m.me));
    const col = (team) => { const ps = m.roster.filter((p) => p.team === team), slots = [];
      for (let i = 0; i < m.size; i++) slots.push(ps[i] ? `<li class="fb-p${String(ps[i].id) === String(m.me) ? ' me' : ''}">${esc(ps[i].name)}${String(ps[i].id) === String(m.host) ? ' <i>host</i>' : ''}</li>` : '<li class="fb-p bot">🤖 Bot (open spot)</li>');
      return `<div class="fb-team t${team}"><h3>${team ? 'Team B' : 'Team A'}</h3><ul>${slots.join('')}</ul>${!m.tournament && mine && mine.team !== team ? `<button class="fb-mini" data-fb="team" data-t="${team}">Join ${team ? 'B' : 'A'}</button>` : ''}</div>`; };
    const isHost = String(m.host) === String(m.me);
    show('lobby', `<section class="fb-lobby"><p class="fb-sub">${m.size}v${m.size} · 3 minutes${m.tournament ? ' · tournament match' : ''}${m.local ? ' · on this device' : ''}</p>
      <div class="fb-teams">${col(0)}${col(1)}</div>
      ${isHost ? `<div class="fb-diff"><span>Bots</span>${['easy', 'normal', 'hard'].map((d) => `<button class="fb-chip${d === difficulty ? ' on' : ''}" data-fb="diff" data-d="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div><button class="fb-btn primary big" data-fb="start">▶ Kick off</button><p class="fb-note">Bots fill the open spots when you kick off.</p>` : '<p class="fb-note">Waiting for the host to kick off…</p>'}
      <button class="fb-btn ghost" data-fb="leave">Leave match</button></section>`, 'Match lobby');
  }
  // ---------- match ----------
  // v2: 60 Hz fixed-step sim on the host/offline, a tilted follow camera (football-render.js), hold-to-power shots,
  // tap/hold passes (hold = lob), sprint, slide tackles, auto-switch, countdown, GOAL splash + slow-mo + replay,
  // confetti, synthesized whistle/crowd, haptics, and for guests: snapshot interpolation + own-player prediction.
  const RD = root.ChinaLifeFootballRender, SND = RD?.sound || { init() {}, whistle() {}, kick() {}, ping() {}, cheer() {}, ooh() {}, crowd() {}, stop() {}, toggle() { return false; }, resume() {}, on: false };
  const DIFF_KEY = () => PREFIX() + 'chinalife-football-diff';
  let difficulty = (() => { try { return localStorage.getItem(DIFF_KEY()) || 'normal'; } catch { return 'normal'; } })();
  const input = { mx: 0, my: 0, sprint: false, act: null };
  // action numbers start from the clock so a reloaded guest never reuses an old n (the host applies each n once)
  const actBase = () => Date.now() % 100000000;
  let actN = actBase(), charge = null, pendingAct = null;
  let netT = null, lastFrame = 0, acc = 0, cv = null, rend = null, remoteInputs = {}, legacyPrev = {}, legacyN = {};
  let fx = null;
  const now = () => performance.now();
  function resetFx() { fx = { goalAt: 0, goal: null, replay: null, rec: [], go: 0, excite: 0, lastPhase: null, banner: null, labels: '' }; }
  function startMatch() {
    clearInterval(poll); poll = null; finished = false; resetFx(); actN = actBase(); charge = null; pendingAct = null; input.mx = input.my = 0; input.sprint = false; input.act = null; legacyPrev = {}; legacyN = {}; remoteInputs = {};
    const m = match; m.status = 'live';
    m.state = E.create({ roster: m.roster.map((p) => ({ id: String(p.id), name: p.name, team: p.team })), size: m.size, seed: m.seed || (Date.now() % 2e9), duration: m.duration || F.DURATION_MS, knockout: !!m.knockout, difficulty });
    m.myTeam = (m.roster.find((p) => String(p.id) === String(m.me)) || { team: 0 }).team;
    m.isHost = String(m.host) === String(m.me);
    m.humans = new Set(m.roster.map((p) => String(p.id)));
    m.buf = []; m.pred = null; m.rtt = 250;
    show('match', `<div class="fb-stage"><canvas class="fb-pitch"></canvas>
      <div class="fb-hud"><button class="fb-hb" data-fb="back" aria-label="Leave">‹</button><div class="fb-sc"><span class="fb-tm t0">A</span><b class="fb-score"><i>0</i><s>–</s><i>0</i></b><span class="fb-tm t1">B</span></div><span class="fb-clock">3:00</span><button class="fb-hb" data-fb="snd" aria-label="Sound">${SND.on ? '🔊' : '🔇'}</button></div>
      <div class="fb-count" hidden></div><div class="fb-goal" hidden><b>GOAL!</b><span></span></div><div class="fb-replay" hidden>⟲ REPLAY</div><div class="fb-banner" hidden></div>
      <div class="fb-controls"><div class="fb-stickzone"><div class="fb-stick"><div class="fb-knob"></div></div></div>
        <div class="fb-buttons"><button class="fb-act sprint" data-act="sprint">Sprint</button><button class="fb-act pass" data-act="pass"><span>Pass</span></button><button class="fb-act shoot" data-act="shoot"><span>Shoot</span></button></div></div></div>`, m.tournament ? 'Tournament match' : `${m.size}v${m.size} match`);
    cv = $('.fb-pitch', el); rend = RD.create(cv); rend.resize(); rend.snapCam(m.state, m.myTeam); bindControls();
    SND.init(); SND.resume();
    lastFrame = now(); acc = 0; loop = requestAnimationFrame(frame);
    if (!m.local) netT = setInterval(m.isHost ? hostNet : guestNet, m.isHost ? 200 : 120);
  }
  const myCtrl = () => { const s = match?.state; return s ? (s.ctrl[String(match.me)] || String(match.me)) : null; };
  function frame(t) {
    const m = match; if (!m || view !== 'match') return;
    const dt = Math.min(100, t - lastFrame); lastFrame = t;
    const s = m.state;
    if (m.local || m.isHost) {
      // Slow motion for the first moments after a goal.
      const slow = s.phase === 'goal' && s.phaseT > F.GOAL_MS - 600 ? .4 : 1;
      acc += dt * slow;
      while (acc >= F.DT) { acc -= F.DT; const ins = { ...takeRemote(), [String(m.me)]: { mx: input.mx, my: input.my, sprint: input.sprint, act: input.act } }; const ev = E.step(s, ins, F.DT); input.act = null; handle(ev); if (!match || finished) break; }
    } else guestUpdate(dt);
    if (!match) return;
    juice(dt); render(dt);
    loop = requestAnimationFrame(frame);
  }
  // Remote inputs (host): movement persists; one-shot actions carry a sequence number so each applies once.
  function takeRemote() {
    const out = {};
    for (const [h, i] of Object.entries(remoteInputs)) {
      if (!i) continue; let a = i.act && typeof i.act === 'object' ? i.act : null;
      if (!a) { // a v1 server only relays pass/shoot booleans: act on the rising edge
        const prev = legacyPrev[h] || {}; if (i.shoot && !prev.shoot) a = { type: 'shoot', power: .7 }; else if (i.pass && !prev.pass) a = { type: 'pass' };
        legacyPrev[h] = { pass: !!i.pass, shoot: !!i.shoot }; if (a) { legacyN[h] = (legacyN[h] || 0) + 1; a.n = legacyN[h]; i.act = a; }
      }
      out[h] = { mx: +i.mx || 0, my: +i.my || 0, sprint: !!i.sprint, act: a };
    }
    return out;
  }
  function nameOf(p) { return p.name; }
  function handle(ev) {
    const m = match, me = myCtrl();
    for (const e of ev) {
      if (e.type === 'kick') { SND.kick(e.power || .5); if (e.by === me) buzz(e.kind === 'shot' ? 25 : 10); if (e.kind === 'shot') fx.excite = Math.max(fx.excite, .7); }
      else if (e.type === 'whistle') SND.whistle(e.kind === 'full' ? 'full' : e.kind === 'kickoff' ? 'kickoff' : 'short');
      else if (e.type === 'post' || e.type === 'bar') { SND.ping(); SND.ooh(); rend?.shake(7); flash(e.type === 'post' ? 'Off the post!' : 'Off the bar!'); buzz(40); }
      else if (e.type === 'save') { if (e.kind !== 'collect') { SND.ooh(); flash(e.kind === 'catch' ? 'Great catch!' : 'What a save!'); } }
      else if (e.type === 'slide') { const p = m.state.players.find((q) => q.id === e.by); if (p) rend?.puff(m.state, p.x, p.y); if (e.by === me) buzz(20); }
      else if (e.type === 'tackle' || e.type === 'steal') { SND.kick(.2); if (e.by === me || e.on === me) buzz(30); if (e.type === 'tackle') flash(e.by === me ? 'Tackle won!' : 'Tackle!'); }
      else if (e.type === 'out') flash(e.kind === 'corner' ? 'Corner' : e.kind === 'goalkick' ? 'Goal kick' : 'Kick-in');
      else if (e.type === 'goal') goalFx(e.team, e.by, e.own, e.assist);
      else if (e.type === 'extra') flash('Extra time · golden goal', 2200);
      else if (e.type === 'full') { setTimeout(() => fullTime(), 900); }
    }
  }
  function flash(text, ms = 1300) { fx.banner = { text, until: now() + ms }; }
  function goalFx(team, by, own, assist) {
    const s = match.state, p = s.players.find((q) => q.id === by), a = assist && s.players.find((q) => q.id === assist);
    fx.goalAt = now(); fx.goal = { team, text: own ? `Own goal · ${p ? esc(p.name) : ''}` : `⚽ ${esc(p?.name || 'Goal')}${p ? ` #${p.num}` : ''}${a ? ` <small>assist ${esc(a.name)}</small>` : ''}`, mine: team === match.myTeam };
    fx.replay = { clip: null, start: fx.goalAt + 1500 };
    rend?.confetti(170, team); rend?.shake(12); SND.cheer(); fx.excite = 1; buzz(team === match.myTeam ? [80, 60, 160] : [60]);
  }
  function buzz(ms) { try { navigator.vibrate?.(ms); } catch {} }
  // Effects that run every frame (countdown, splash, crowd, button labels).
  function juice(dt) {
    const s = match.state, t = now();
    if (s.phase !== 'goal') { const b = s.ball, dg = Math.min(Math.hypot(b.x, b.y - F.H / 2), Math.hypot(F.W - b.x, b.y - F.H / 2)); fx.excite += ((dg < 16 ? 1 - dg / 16 : 0) * .8 - fx.excite) * Math.min(1, dt / 600); }
    SND.crowd(fx.excite);
    if (fx.lastPhase === 'kickoff' && s.phase === 'play') fx.go = t + 650;
    fx.lastPhase = s.phase;
    const cnt = $('.fb-count', el); if (cnt) { let txt = ''; if (s.phase === 'kickoff' && s.phaseT > 0) txt = String(Math.ceil(s.phaseT / 1000)); else if (t < fx.go) txt = 'GO!'; if (cnt.dataset.t !== txt) { cnt.dataset.t = txt; cnt.textContent = txt; cnt.hidden = !txt; cnt.classList.remove('pop'); void cnt.offsetWidth; if (txt) cnt.classList.add('pop'); } }
    const g = $('.fb-goal', el), showGoal = fx.goal && s.phase === 'goal' && t - fx.goalAt < 1500;
    if (g) { if (showGoal && g.hidden) { g.hidden = false; g.className = 'fb-goal t' + fx.goal.team; $('span', g).innerHTML = fx.goal.text; } else if (!showGoal && !g.hidden) g.hidden = true; }
    const bn = $('.fb-banner', el); if (bn) { const on = fx.banner && t < fx.banner.until && s.phase !== 'goal'; if (on) { if (bn.textContent !== fx.banner.text) bn.textContent = fx.banner.text; bn.hidden = false; } else bn.hidden = true; }
    // Button labels follow possession: Pass/Shoot with the ball, Switch/Tackle without.
    const me = myCtrl(), has = s.ball.owner === me, near = !s.ball.owner && (() => { const p = s.players.find((q) => q.id === me); return p && Math.hypot(p.x - s.ball.x, p.y - s.ball.y) < 1.6; })();
    const lab = has || near ? (charge?.type === 'pass' && t - charge.t0 > 260 ? 'Lob|Shoot' : 'Pass|Shoot') : 'Switch|Tackle';
    if (lab !== fx.labels) { fx.labels = lab; const [l1, l2] = lab.split('|'); const pb = $('.fb-act.pass span', el), sb = $('.fb-act.shoot span', el); if (pb) pb.textContent = l1; if (sb) sb.textContent = l2; $('.fb-controls', el)?.classList.toggle('defend', l1 === 'Switch'); }
    const sbtn = $('.fb-act.shoot', el); if (sbtn) sbtn.style.setProperty('--p', charge?.type === 'shoot' ? chargeLevel() : 0);
    hud();
  }
  const chargeLevel = () => (charge ? Math.min(1, (now() - charge.t0) / 900) : 0);
  // Replay buffer: what was drawn over the last few seconds.
  function record(s) {
    const t = now(), rec = fx.rec;
    rec.push({ t, b: [s.ball.x, s.ball.y, s.ball.z, s.ball.spin, s.ball.vx, s.ball.vy, s.ball.owner], p: s.players.map((p) => [p.x, p.y, p.ang, p.vx, p.vy, p.slide ? 1 : 0, p.dive ? 1 : 0, p.touch]) });
    while (rec.length && t - rec[0].t > 4200) rec.shift();
  }
  let ghost = null;
  function replayState(t) {
    const r = fx.replay, s = match.state; if (!r) return null;
    if (s.phase !== 'goal' || t < r.start) return null;
    if (!r.clip) { r.clip = fx.rec.filter((f) => f.t >= fx.goalAt - 2600 && f.t <= fx.goalAt + 300); if (r.clip.length < 10) { fx.replay = null; return null; } }
    const c = r.clip, t0 = c[0].t, span = c[c.length - 1].t - t0, k = (t - r.start) * .75; if (k > span) { fx.replay = null; return null; }
    let i = 0; while (i < c.length - 1 && c[i + 1].t - t0 < k) i++;
    const f = c[i];
    if (!ghost || ghost.players.length !== s.players.length) ghost = { players: s.players.map((p) => ({ ...p })), ball: { ...s.ball }, phase: 'play', ctrl: s.ctrl };
    ghost.players.forEach((g, j) => { const a = f.p[j]; Object.assign(g, { x: a[0], y: a[1], ang: a[2], vx: a[3], vy: a[4], slide: a[5], dive: a[6], touch: a[7], st: s.players[j].st, stamina: 1 }); });
    Object.assign(ghost.ball, { x: f.b[0], y: f.b[1], z: f.b[2], spin: f.b[3], vx: f.b[4], vy: f.b[5], owner: f.b[6] });
    ghost.ctrl = s.ctrl; return ghost;
  }
  function render(dt) {
    const s = match.state, t = now(); if (!rend) return;
    const rs = replayState(t);
    if (!rs) record(s);
    const rb = $('.fb-replay', el); if (rb) rb.hidden = !rs;
    const ctrlIds = new Set(Object.values(s.ctrl || {}));
    rend.draw(rs || s, { myTeam: match.myTeam, myCtrl: myCtrl(), ctrlIds, humanIds: match.humans, nameOf, charge: charge?.type === 'shoot' ? chargeLevel() : 0, excite: fx.excite, letterbox: !!rs, map: !rs, cam: rs ? { zoom: 1.3 } : {} }, dt);
  }
  // Host: send a snapshot, receive the other players' inputs.
  async function hostNet() {
    const m = match; if (!m || m.local) return;
    try { const d = await call('POST', { action: 'snap', id: m.id, seq: ++m.seq, snap: E.snapshot(m.state) }); remoteInputs = d.inputs || {}; if (d.match && d.match.status !== 'live') { say('Match stopped'); } } catch (e) { if (e.status === 403 || e.status === 404) { say(e.message); home(); } }
  }
  // Guest: send my input (+ my latest one-shot action), get the host's latest snapshot back in the same request.
  async function guestNet() {
    const m = match; if (!m || m.local) return;
    const a = pendingAct; const sent = { action: 'input', id: m.id, mx: input.mx, my: input.my, sprint: input.sprint, pass: !!a && a.type !== 'shoot', shoot: !!a && a.type === 'shoot' };
    if (a) sent.act = { n: a.n, type: a.type, power: +(a.power || 0).toFixed(2) };
    // keep re-sending the action for ~420 ms: a v1 relay keeps only the latest pass/shoot flags and the host polls every 200 ms
    if (a && now() > a.until) pendingAct = null; const t0 = now();
    try {
      const d = await call('POST', sent);
      if (!match) return; m.rtt = m.rtt * .8 + (now() - t0) * .2;
      if (d.snap && (!m.buf.length || d.snap.t !== m.buf[m.buf.length - 1].n.t || d.snap.ph !== m.buf[m.buf.length - 1].n.ph)) onSnap(d.snap);
      if (d.match?.status && d.match.status !== 'live' || m.state.phase === 'full') { if (m.state.phase === 'full' || ['reported', 'done'].includes(d.match?.status)) fullTime(d.match); else { say('Match stopped'); home(); } }
    } catch (e) { if (e.status === 404) home(); }
  }
  function onSnap(n) {
    const m = match, prev = m.buf.length ? m.buf[m.buf.length - 1].n : null;
    m.buf.push({ at: now(), n }); while (m.buf.length > 12) m.buf.shift();
    if (!prev) return;
    // Recreate the host's events from the difference between snapshots (sounds, splash, whistles).
    const ev = [];
    if (n.sc[0] + n.sc[1] > prev.sc[0] + prev.sc[1]) { const lg = n.lg || {}; ev.push({ type: 'goal', team: n.sc[0] > prev.sc[0] ? 0 : 1, by: lg.scorer || lg.by, own: !!lg.own, assist: lg.assist }); }
    if (prev.ph !== n.ph) { if (n.ph === 'play') ev.push({ type: 'whistle', kind: prev.ph === 'kickoff' ? 'kickoff' : 'restart' }); if (n.ph === 'restart' && n.rs) ev.push({ type: 'out', kind: n.rs.type }, { type: 'whistle', kind: 'out' }); if (n.ph === 'full') ev.push({ type: 'whistle', kind: 'full' }); }
    const bs = Math.hypot(n.b[3], n.b[4]), ps = Math.hypot(prev.b[3], prev.b[4]); if (n.b[6] === null && bs > ps + 6) ev.push({ type: 'kick', power: Math.min(1, bs / 30) });
    if (ev.length) { E.applySnapshot(m.state, n); handle(ev); }
  }
  // Guests draw the host ~(one snapshot interval) in the past, interpolated, and predict their own player locally.
  function guestUpdate(dt) {
    const m = match, s = m.state, buf = m.buf; if (!buf.length) return;
    const delay = Math.max(160, Math.min(400, m.rtt * .6 + 120)), rt = now() - delay;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length - 1; i++) if (buf[i].at <= rt && buf[i + 1].at >= rt) { a = buf[i]; b = buf[i + 1]; break; }
    const k = b.at === a.at ? 1 : Math.max(0, Math.min(1, (rt - a.at) / (b.at - a.at)));
    const pid = s.ctrl[String(m.me)] || String(m.me);
    E.applySnapshot(s, b.n);
    const lerp = (x, y) => x + (y - x) * k, la = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return x + d * k; };
    const pa = new Map(a.n.p.map((r) => [r[0], r]));
    for (const p of s.players) { const r = pa.get(p.id), q = b.n.p.find((x) => x[0] === p.id); if (!r || !q || r.length < 8) continue; p.x = lerp(r[1], q[1]); p.y = lerp(r[2], q[2]); p.ang = la(r[5], q[5]); p.touch = (p.touch || 0) + Math.hypot(p.vx, p.vy) * dt / 1000 * 1.3; }
    if (a.n.b.length > 6) { s.ball.x = lerp(a.n.b[0], b.n.b[0]); s.ball.y = lerp(a.n.b[1], b.n.b[1]); s.ball.z = lerp(a.n.b[2], b.n.b[2]); s.ball.spin = (s.ball.spin || 0) + Math.hypot(s.ball.vx, s.ball.vy) * dt / 1000 / F.BALL; }
    // Own player: predicted from my input, gently corrected toward where the host says I am.
    const me = s.players.find((p) => p.id === pid);
    if (me && s.phase === 'play') {
      const hostP = b.n.p.find((x) => x[0] === pid) || [pid, me.x, me.y, 0, 0, me.ang];
      if (!m.pred || m.pred.id !== pid) m.pred = { ...me, x: hostP[1], y: hostP[2], vx: hostP[3], vy: hostP[4], ang: hostP[5] };
      const pr = m.pred; pr.slide = 0; pr.dive = 0; pr.stun = 0;
      E.movePlayer(pr, input, dt / 1000, s.ball.owner === pid, 1);
      const lead = (now() - b.at + m.rtt / 2) / 1000, tx = hostP[1] + hostP[3] * lead, ty = hostP[2] + hostP[4] * lead, ex = tx - pr.x, ey = ty - pr.y;
      if (Math.hypot(ex, ey) > 4) { pr.x = tx; pr.y = ty; } else { const c = Math.min(1, dt / 1000 * 3); pr.x += ex * c; pr.y += ey * c; }
      Object.assign(me, { x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, ang: pr.ang, touch: pr.touch, sprint: pr.sprint });
      if (s.ball.owner === pid) { s.ball.x = me.x + Math.cos(me.ang) * (F.R + F.BALL + .1); s.ball.y = me.y + Math.sin(me.ang) * (F.R + F.BALL + .1); s.ball.z = 0; }
    } else m.pred = null;
    if (s.phase === 'full' && !finished) fullTime();
  }
  let finished = false;
  async function fullTime(srv) {
    if (finished || !match) return; finished = true; const m = match; clearInterval(netT); netT = null;
    const s = m.state, mine = m.myTeam, won = s.winner === mine, isDraw = s.winner === null; if (won) try { window.dispatchEvent(new CustomEvent('chinalife:winner', { detail: { kind: 'football' } })); } catch {} // Club Hypeman
    let note = '';
    if (!m.local) {
      try {
        if (m.isHost) { const r = await call('POST', { action: 'result', id: m.id, report: E.report(s) }); note = r.status === 'done' ? 'Result confirmed ✓' : r.status === 'disputed' ? 'Result disputed: the ChinaLife team will check it' : 'Waiting for the other players to confirm…'; }
        else { const r = await call('POST', { action: 'confirm', id: m.id, score: s.score }); note = r.status === 'done' ? 'Result confirmed ✓' : r.status === 'disputed' ? 'Scores did not match: the ChinaLife team will check it' : 'Result sent ✓'; }
      } catch (e) { note = e.message; }
    } else {
      const st = stats(); st.played++; if (won) st.won++; else if (!isDraw) st.lost++; else st.drawn++; localStorage.setItem(STATS_KEY(), JSON.stringify(st));
      if (m.tournament) note = localTournamentResult(m);
    }
    if (!match || match !== m) return;
    const mt = (t) => `${Math.floor(t / 60000)}:${String(Math.floor(t / 1000) % 60).padStart(2, '0')}`;
    const scorers = s.goals.map((g) => { const p = s.players.find((q) => q.id === g.by); return `<li class="t${g.team}">⚽ ${mt(g.t)} · ${g.own ? 'Own goal' : esc(p?.name || 'Player')} <small>${g.team ? 'B' : 'A'}</small></li>`; }).join('');
    const motm = E.manOfMatch(s), poss = E.possession(s), sh = s.shots || [0, 0];
    const line = motm ? [motm.st.g && `${motm.st.g} goal${motm.st.g > 1 ? 's' : ''}`, motm.st.a && `${motm.st.a} assist${motm.st.a > 1 ? 's' : ''}`, motm.st.sv && `${motm.st.sv} save${motm.st.sv > 1 ? 's' : ''}`, motm.st.tk && `${motm.st.tk} tackle${motm.st.tk > 1 ? 's' : ''}`, motm.st.pc && `${motm.st.pc} passes`].filter(Boolean).join(' · ') || 'Solid all match' : '';
    const youMotm = motm && (motm.id === String(m.me));
    const ov = document.createElement('div'); ov.className = 'fb-full';
    ov.innerHTML = `<div class="fb-card"><p class="fb-kicker">FULL TIME</p><h2>${isDraw ? 'Draw' : won ? 'You win! 🎉' : 'You lose'}</h2><p class="fb-final"><span class="t0">A</span> ${s.score[0]} – ${s.score[1]} <span class="t1">B</span></p>${s.pens ? `<p class="fb-sub">Penalties ${s.pens[0]}–${s.pens[1]}</p>` : ''}
      ${motm ? `<div class="fb-motm t${motm.team}"><span class="fb-star">★</span><div><small>MAN OF THE MATCH</small><b>${esc(youMotm ? 'You' : motm.name)} <em>#${motm.num} · ${motm.team ? 'B' : 'A'}</em></b><small>${esc(line)} · rating ${motm.rating}</small></div></div>` : ''}
      <div class="fb-stats"><div><b>${poss[0]}%</b><small>Possession</small><b>${poss[1]}%</b></div><div><b>${sh[0]}</b><small>Shots</small><b>${sh[1]}</b></div></div>
      <ul class="fb-goals">${scorers || '<li>No goals</li>'}</ul><p class="fb-note">${esc(note)}</p>
      <div class="fb-row">${m.tournament ? `<button class="fb-btn primary" data-fb="t-open" data-id="${esc(m.tournament)}">🏆 Bracket</button>` : `<button class="fb-btn primary" data-fb="again">Play again</button>`}<button class="fb-btn" data-fb="home">Done</button></div></div>`;
    $('.fb-stage', el)?.appendChild(ov); buzz([60, 40, 60]);
    if (won) rend?.confetti(120, mine);
    // keep drawing a gentle crowd view behind the card
  }
  const stats = () => { try { return { played: 0, won: 0, lost: 0, drawn: 0, ...JSON.parse(localStorage.getItem(STATS_KEY()) || '{}') }; } catch { return { played: 0, won: 0, lost: 0, drawn: 0 }; } };
  function hud() {
    const s = match.state, left = Math.max(0, (s.extra ? s.duration + F.EXTRA_MS : s.duration) - s.t), sec = Math.ceil(left / 1000);
    const sc = el.querySelectorAll('.fb-score i'), c = $('.fb-clock', el); if (!sc.length) return;
    if (sc[0].textContent !== String(s.score[0])) sc[0].textContent = s.score[0]; if (sc[1].textContent !== String(s.score[1])) sc[1].textContent = s.score[1];
    const txt = (s.extra ? 'ET ' : '') + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); if (c.textContent !== txt) c.textContent = txt;
  }
  root.addEventListener?.('resize', () => rend?.resize());
  // ---------- controls ----------
  function setStick(jx, jy) {
    // joystick right/down in screen space -> field direction (my team attacks up the screen)
    const up = match?.myTeam !== 1; input.mx = up ? -jy : jy; input.my = up ? jx : -jx;
  }
  function pushAct(a) { a.n = ++actN; a.until = now() + 420; input.act = a; pendingAct = a; }
  function hasBall() { const s = match?.state; if (!s) return false; const me = myCtrl(); if (s.ball.owner === me) return true; const p = s.players.find((q) => q.id === me); return !s.ball.owner && p && Math.hypot(p.x - s.ball.x, p.y - s.ball.y) < 1.6; }
  function press(kind) {
    SND.resume();
    if (kind === 'sprint') { input.sprint = true; return; }
    if (!hasBall()) { pushAct({ type: kind === 'shoot' ? 'tackle' : 'switch' }); buzz(8); return; }
    charge = { type: kind, t0: now() };
  }
  function release(kind) {
    if (kind === 'sprint') { input.sprint = false; return; }
    if (!charge || charge.type !== kind) return; const held = now() - charge.t0;
    if (kind === 'shoot') pushAct({ type: 'shoot', power: +Math.max(.2, chargeLevel()).toFixed(2) });
    else pushAct(held > 260 ? { type: 'lob', power: Math.min(1, held / 700) } : { type: 'pass', power: .5 });
    charge = null;
  }
  function bindControls() {
    const zone = $('.fb-stickzone', el), stick = $('.fb-stick', el), knob = $('.fb-knob', el); let id = null, cx = 0, cy = 0;
    const R = () => stick.clientWidth / 2;
    const move = (e) => { const r = R(), dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), k = d > r ? r / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; const m = Math.min(1, d / r); const nx = d ? dx / d * m : 0, ny = d ? dy / d * m : 0; setStick(Math.abs(nx) < .12 ? 0 : nx, Math.abs(ny) < .12 ? 0 : ny); };
    zone.addEventListener('pointerdown', (e) => { id = e.pointerId; try { zone.setPointerCapture(id); } catch {} const zr = zone.getBoundingClientRect(); const r = R(); cx = Math.max(zr.left + r, Math.min(zr.right - r, e.clientX)); cy = Math.max(zr.top + r, Math.min(zr.bottom - r, e.clientY)); stick.style.left = (cx - zr.left - r) + 'px'; stick.style.top = (cy - zr.top - r) + 'px'; stick.classList.add('on'); move(e); SND.resume(); e.preventDefault(); });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; stick.classList.remove('on'); stick.style.left = stick.style.top = ''; setStick(0, 0); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    for (const b of el.querySelectorAll('.fb-act')) {
      const kind = b.dataset.act;
      b.addEventListener('pointerdown', (e) => { try { b.setPointerCapture?.(e.pointerId); } catch {} b.classList.add('down'); press(kind); e.preventDefault(); });
      const up = (e) => { b.classList.remove('down'); release(kind); e.preventDefault(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
  const keys = new Set(), KEYACT = { j: 'pass', k: 'shoot', ' ': 'shoot', shift: 'sprint', l: 'sprint' };
  document.addEventListener('keydown', (e) => { if (view !== 'match' || !match) return; const k = e.key.toLowerCase(); if (KEYACT[k]) { if (!e.repeat) press(KEYACT[k]); } else keys.add(k); keyStick(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); });
  document.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (view === 'match' && match && KEYACT[k]) release(KEYACT[k]); keys.delete(k); if (view === 'match') keyStick(); });
  function keyStick() { const has = (...a) => a.some((k) => keys.has(k)); const jx = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0), jy = (has('s', 'arrowdown') ? 1 : 0) - (has('w', 'arrowup') ? 1 : 0); const m = Math.hypot(jx, jy) || 1; setStick(jx / m, jy / m); }
  // ---------- tournaments ----------
  function localTours() { try { const v = JSON.parse(localStorage.getItem(T_KEY()) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
  function saveTours(list) { localStorage.setItem(T_KEY(), JSON.stringify(list.slice(-12))); }
  const LOCAL_TEAMS = ['Riverside Rovers', 'Night Market FC', 'Campus United', 'Metro Lions', 'Old Town Stars', 'Lantern City', 'Harbour Kings', 'Panda Strikers'];
  function tForm() {
    const at = new Date(Date.now() + 3600e3); at.setMinutes(0, 0, 0);
    const local = new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    show('t-new', `<form class="fb-form" data-fb-form="t-create"><label>Name<input name="name" maxlength="40" required placeholder="Friday Night Cup"></label>
      <label>Team size<select name="team_size">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n}v${n}</option>`).join('')}</select></label>
      <label>Starts<input name="starts_at" type="datetime-local" value="${local}" required></label>
      <label>Max teams<select name="max_teams">${[4, 8, 16].map((n) => `<option${n === 8 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <p class="fb-note">Knockout bracket. Prize coins can only be added by an admin.</p><button class="fb-btn primary big">Create tournament</button></form>`, 'New tournament');
  }
  async function tCreate(f) {
    const d = Object.fromEntries(new FormData(f)); const at = new Date(d.starts_at);
    if (online()) { try { const r = await call('POST', { action: 't_create', name: d.name, team_size: +d.team_size, max_teams: +d.max_teams, starts_at: at.toISOString() }); return tOpen(r.id); } catch (e) { return say(e.message); } }
    const list = localTours(), t = { id: 'L' + Date.now().toString(36), name: String(d.name).slice(0, 40), team_size: +d.team_size, max_teams: +d.max_teams, starts_at: at.toISOString(), status: 'registering', prize_coins: 0, teams: 0, list: [], bracket: null, mine: null };
    list.push(t); saveTours(list); tOpen(t.id);
  }
  let tCur = null;
  async function tOpen(id) {
    stopLoops(); match = null; finished = false;
    if (online()) {
      try { const d = await call('GET', { action: 'tournament', id }); tCur = { ...d.tournament, teams: d.teams, matches: d.matches, me: d.me, remote: true }; } catch (e) { return say(e.message); }
    } else { tCur = localTours().find((t) => t.id === id); if (!tCur) return home(); tCur = { ...tCur, teams: tCur.list }; }
    paintTour();
  }
  function teamName(id) { return (tCur.teams || []).find((t) => String(t.id) === String(id))?.name || 'TBD'; }
  function myTeamId() { const me = tCur.remote ? String(tCur.me ?? '') : 'me'; return (tCur.teams || []).find((t) => (t.members || []).some((m) => String(m.id) === me))?.id ?? null; }
  function paintTour() {
    const t = tCur, mine = myTeamId(), rounds = t.bracket || [];
    const names = ['Final', 'Semi-finals', 'Quarter-finals', 'Round of 16', 'Round of 32'];
    const br = rounds.length ? `<div class="fb-bracket">${rounds.map((round, ri) => `<div class="fb-round"><h4>${names[rounds.length - 1 - ri] || 'Round ' + (ri + 1)}</h4>${round.map((m) => `<div class="fb-m${m.winner ? ' done' : ''}${mine && (String(m.a) === String(mine) || String(m.b) === String(mine)) ? ' mine' : ''}"><span class="${m.winner && String(m.winner) === String(m.a) ? 'w' : ''}">${m.a ? esc(teamName(m.a)) : m.bye && ri === 0 ? '— bye —' : 'TBD'}<b>${m.score ? m.score[0] : ''}</b></span><span class="${m.winner && String(m.winner) === String(m.b) ? 'w' : ''}">${m.b ? esc(teamName(m.b)) : m.bye && ri === 0 ? '— bye —' : 'TBD'}<b>${m.score ? m.score[1] : ''}</b></span></div>`).join('')}</div>`).join('')}</div>` : '';
    const champ = rounds.length ? E.champion(rounds) : null;
    const myMatch = mine && rounds.length ? E.playable(rounds).find((m) => String(m.a) === String(mine) || String(m.b) === String(mine)) : null;
    const teams = (t.teams || []).map((x) => `<li><span><b>${esc(x.name)}</b><small>${(x.members || []).map((m) => esc(m.name)).join(', ') || 'local team'}</small></span>${t.status === 'registering' && !mine && (x.members || []).length < t.team_size && x.members?.length ? `<button class="fb-mini" data-fb="t-join" data-team="${esc(x.id)}">Join</button>` : ''}</li>`).join('');
    show('tour', `<section class="fb-tour"><h2>${esc(t.name)}</h2><p class="fb-sub">${t.team_size}v${t.team_size} · knockout · ${(t.teams || []).length}/${t.max_teams} teams · ${statusLabel(t)}${+t.prize_coins ? ` · 🪙 ${(+t.prize_coins).toLocaleString()} prize` : ''}</p>
      ${champ ? `<p class="fb-champ">🏆 Champions: <b>${esc(teamName(champ))}</b></p>` : ''}
      ${myMatch ? `<button class="fb-btn primary big" data-fb="t-play" data-match="${esc(myMatch.id)}">⚽ Play my match: ${esc(teamName(myMatch.a))} vs ${esc(teamName(myMatch.b))}</button>` : ''}
      ${br || '<p class="fb-note">The bracket is drawn when the tournament starts.</p>'}
      ${t.status === 'registering' ? (mine ? `<p class="fb-note">You're in <b>${esc(teamName(mine))}</b>.</p><button class="fb-btn ghost" data-fb="t-leave">Leave team</button>` : `<form class="fb-form inline" data-fb-form="t-register"><input name="team_name" maxlength="24" placeholder="Your team name" required><button class="fb-btn primary">Register team</button></form>`) : ''}
      ${!t.remote && t.status === 'registering' ? `<div class="fb-row"><button class="fb-btn" data-fb="t-fill">Add local teams</button><button class="fb-btn primary" data-fb="t-start">Start now</button></div>` : ''}
      ${!t.remote && t.status === 'running' ? `<button class="fb-btn" data-fb="t-sim">Play out the other matches</button>` : ''}
      <h3>Teams</h3><ul class="fb-list">${teams || '<li class="fb-empty">No teams yet. Be the first.</li>'}</ul></section>`, '🏆 Tournament');
  }
  function localSave(t) { const list = localTours(), i = list.findIndex((x) => x.id === t.id); const copy = { ...t, list: t.teams, teams: t.teams.length }; delete copy.remote; if (i >= 0) list[i] = copy; else list.push(copy); saveTours(list); tCur = t; }
  async function tRegister(name) {
    if (online()) { try { await call('POST', { action: 't_register', id: tCur.id, team_name: name }); return tOpen(tCur.id); } catch (e) { return say(e.message); } }
    if (tCur.teams.length >= tCur.max_teams) return say('The tournament is full');
    tCur.teams.push({ id: 'T' + (tCur.teams.length + 1), name: String(name).slice(0, 24), members: [{ id: 'me', name: meName() }] }); localSave(tCur); paintTour();
  }
  function tFill() { const used = new Set(tCur.teams.map((t) => t.name)); for (const n of LOCAL_TEAMS) { if (tCur.teams.length >= Math.min(tCur.max_teams, 8)) break; if (!used.has(n)) tCur.teams.push({ id: 'T' + (tCur.teams.length + 1), name: n, members: [] }); } localSave(tCur); paintTour(); }
  function tStart() { if (tCur.teams.length < 2) return say('Need at least two teams'); tCur.bracket = E.bracket(tCur.teams.map((t) => ({ id: t.id }))); tCur.status = 'running'; localSave(tCur); paintTour(); }
  function quickSim(seed) { const s = E.create({ size: tCur.team_size, seed, duration: F.DURATION_MS, knockout: true }); let n = 0; while (s.phase !== 'full' && n++ < 20000) E.step(s, {}, 100); return s; }
  function tSim() { const mine = myTeamId(); for (const m of E.playable(tCur.bracket)) { if (String(m.a) === String(mine) || String(m.b) === String(mine)) continue; const s = quickSim((Date.now() + m.id.length * 97) % 2e9); E.recordResult(tCur.bracket, m.id, s.winner === 0 ? m.a : m.b, s.score); } finishLocalTour(); localSave(tCur); paintTour(); }
  function finishLocalTour() { if (E.champion(tCur.bracket)) tCur.status = 'done'; }
  function localTournamentResult(m) { const t = localTours().find((x) => x.id === m.tournament); if (!t) return ''; tCur = { ...t, teams: t.list }; const bm = E.playable(tCur.bracket).find((x) => x.id === m.bracketMatch); if (!bm) return ''; const s = m.state; E.recordResult(tCur.bracket, bm.id, s.winner === 0 ? bm.a : bm.b, s.score); finishLocalTour(); localSave(tCur); return s.winner === m.myTeam ? 'Your team goes through ✓' : 'Knocked out'; }
  async function tPlay(matchId) {
    if (online()) { try { const d = await call('POST', { action: 't_play', id: tCur.id }); return enterLobby(d); } catch (e) { return say(e.message); } }
    const bm = E.playable(tCur.bracket).find((x) => x.id === matchId), mine = myTeamId(); if (!bm) return;
    enterLobby(localLobby(tCur.team_size, String(bm.a) === String(mine) ? 0 : 1, { tournament: tCur.id, bracketMatch: bm.id, knockout: true }));
  }
  // ---------- clicks ----------
  async function onClick(e) {
    const b = e.target.closest('[data-fb]'); if (!b) return; const a = b.dataset.fb;
    if (a === 'close') return close();
    if (a === 'back' || a === 'home') { if (match && !match.local && match.status === 'lobby') { try { await call('POST', { action: 'leave', id: match.id }); } catch {} } finished = false; return view === 'home' ? close() : home(); }
    if (a === 'size') { pickSize = +b.dataset.n; return home(); }
    if (a === 'diff') { difficulty = b.dataset.d; try { localStorage.setItem(DIFF_KEY(), difficulty); } catch {} return paintLobby(); }
    if (a === 'snd') { const on = SND.toggle(); b.textContent = on ? '🔊' : '🔇'; return; }
    if (a === 'quick' || a === 'create' || a === 'again') {
      finished = false; const n = a === 'again' && match ? match.size : pickSize;
      if (!online()) { const lob = localLobby(n); enterLobby(lob); if (a === 'quick') return startMatch(); return; }
      try { const d = await call('POST', { action: a === 'create' ? 'create' : 'quick', size: n }); lastMe = d.me; return enterLobby(d); } catch (err) { return say(err.message); }
    }
    if (a === 'join') { try { return enterLobby(await call('POST', { action: 'join', id: b.dataset.id, team: 0 })); } catch (err) { return say(err.message); } }
    if (a === 'team') { const t = +b.dataset.t; if (match.local) { match.roster[0].team = t; return paintLobby(); } try { const d = await call('POST', { action: 'team', id: match.id, team: t }); Object.assign(match, fromServer(d)); return paintLobby(); } catch (err) { return say(err.message); } }
    if (a === 'start') { if (match.local) return startMatch(); try { const d = await call('POST', { action: 'start', id: match.id }); Object.assign(match, fromServer(d)); return startMatch(); } catch (err) { return say(err.message); } }
    if (a === 'leave') { if (!match.local) { try { await call('POST', { action: 'leave', id: match.id }); } catch {} } return home(); }
    if (a === 't-new') return tForm();
    if (a === 't-open') return tOpen(b.dataset.id);
    if (a === 't-join') { if (online()) { try { await call('POST', { action: 't_join', id: tCur.id, team_id: b.dataset.team }); return tOpen(tCur.id); } catch (err) { return say(err.message); } } return; }
    if (a === 't-leave') { if (online()) { try { await call('POST', { action: 't_leave', id: tCur.id }); } catch (err) { return say(err.message); } return tOpen(tCur.id); } tCur.teams = tCur.teams.filter((t) => !(t.members || []).some((m) => m.id === 'me')); localSave(tCur); return paintTour(); }
    if (a === 't-fill') return tFill();
    if (a === 't-start') return tStart();
    if (a === 't-sim') return tSim();
    if (a === 't-play') return tPlay(b.dataset.match);
  }
  document.addEventListener('submit', (e) => { const f = e.target.closest?.('[data-fb-form]'); if (!f || !el?.contains(f)) return; e.preventDefault(); if (f.dataset.fbForm === 't-create') tCreate(f); if (f.dataset.fbForm === 't-register') tRegister(new FormData(f).get('team_name')); });
  // ---------- admin ----------
  function mountAdmin(box, admin, toast = say) {
    if (!box) return;
    if (!online() || !admin) {
      const paint = () => { const on = localStorage.getItem(OFF_KEY()) !== '1'; box.innerHTML = `<h3>⚽ Football matches</h3><p>Preview switch (this device only): <b>${on ? 'On' : 'Off'}</b></p><button class="primary-btn" data-fbadm="flip">${on ? 'Turn off' : 'Turn on'}</button>`; box.querySelector('[data-fbadm]').onclick = () => { localStorage.setItem(OFF_KEY(), on ? '1' : '0'); paint(); }; };
      return paint();
    }
    const paint = async () => {
      let d; try { d = await admin('football', {}); d = d?.data || d; } catch (e) { box.innerHTML = `<h3>⚽ Football matches</h3><p>${esc(e.message)}</p>`; return; }
      box.innerHTML = `<h3>⚽ Football matches</h3><p>Matches and tournaments are <b>${d.enabled ? 'ON' : 'OFF'}</b> for players.</p><button class="primary-btn" data-fbadm="flip">${d.enabled ? 'Turn off' : 'Turn on'}</button>
        <h4>Tournaments</h4><ul class="fb-admin-list">${(d.tournaments || []).map((t) => `<li><b>${esc(t.name)}</b> · ${t.team_size}v${t.team_size} · ${t.teams}/${t.max_teams} · ${esc(t.status)} · 🪙${t.prize_coins} ${t.status === 'registering' ? `<button data-fbadm="edit" data-id="${t.id}">Edit</button>` : ''}${['registering', 'running'].includes(t.status) ? `<button data-fbadm="cancel" data-id="${t.id}">Cancel</button>` : ''}</li>`).join('') || '<li>None yet</li>'}</ul>
        <form data-fbadm-form><input type="hidden" name="id"><input name="name" placeholder="Tournament name" required><input name="starts_at" type="datetime-local" required><select name="team_size">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n}v${n}</option>`).join('')}</select><select name="max_teams"><option>4</option><option selected>8</option><option>16</option></select><input name="prize_coins" type="number" min="0" placeholder="Prize coins (optional)"><button class="primary-btn">Save tournament</button></form>
        <h4>Disputed results</h4><ul class="fb-admin-list">${(d.disputed || []).map((m) => `<li>#${m.id}${m.tournament_id ? ' (tournament)' : ''} <button data-fbadm="resolve" data-id="${m.id}">Set result</button></li>`).join('') || '<li>None</li>'}</ul>`;
      box.querySelector('[data-fbadm="flip"]').onclick = async () => { try { await admin('set_football', { enabled: !d.enabled }); toast(d.enabled ? 'Football matches off' : 'Football matches on'); paint(); } catch (e) { toast(e.message); } };
      box.querySelectorAll('[data-fbadm="cancel"]').forEach((b) => (b.onclick = async () => { if (!confirm('Cancel this tournament?')) return; try { await admin('football_tournament_cancel', { id: +b.dataset.id }); paint(); } catch (e) { toast(e.message); } }));
      box.querySelectorAll('[data-fbadm="edit"]').forEach((b) => (b.onclick = () => { const t = d.tournaments.find((x) => String(x.id) === b.dataset.id), f = box.querySelector('[data-fbadm-form]'); f.id.value = t.id; f.name.value = t.name; f.team_size.value = t.team_size; f.max_teams.value = t.max_teams; f.prize_coins.value = t.prize_coins; const at = new Date(String(t.starts_at).replace(' ', 'T') + 'Z'); f.starts_at.value = new Date(at - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }));
      box.querySelectorAll('[data-fbadm="resolve"]').forEach((b) => (b.onclick = async () => { const v = prompt('Final score as A-B, then winner A or B (e.g. 2-1 A)'); const m = /^(\d+)\s*-\s*(\d+)\s*([AB])?$/i.exec(String(v || '').trim()); if (!m) return; try { await admin('football_match_resolve', { id: +b.dataset.id, score: [+m[1], +m[2]], winner: m[3] ? (m[3].toUpperCase() === 'A' ? 0 : 1) : null }); paint(); } catch (e) { toast(e.message); } }));
      box.querySelector('[data-fbadm-form]').onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); try { await admin('football_tournament_save', { id: +f.id || 0, name: f.name, team_size: +f.team_size, max_teams: +f.max_teams, prize_coins: +f.prize_coins || 0, starts_at: new Date(f.starts_at).toISOString() }); toast('Tournament saved'); paint(); } catch (err) { toast(err.message); } };
    };
    paint();
  }
  if (online()) refreshFlag();
  root.addEventListener?.('chinalife:cloudready', () => refreshFlag());
  // Link Up (social.js) "Happening now": open lobbies and tournaments that still need players. Read-only; online it is one
  // lobby GET (the same call the Football screen makes), offline it lists this device's local tournaments.
  const tourBrief = (t) => ({ id: String(t.id), name: String(t.name || ''), size: +t.team_size || 0, teams: +t.teams || 0, max: +t.max_teams || 0, status: t.status, startsAt: t.starts_at || null });
  async function summary() {
    const none = { enabled: false, online: online(), lobbies: [], tournaments: [] };
    if (!enabled()) { if (!(online() && serverOn === null && await refreshFlag())) return none; }
    if (online()) {
      try {
        const d = await call('GET', { action: 'lobby' }); serverOn = d?.enabled === true; if (!serverOn) return none;
        return { enabled: true, online: true,
          lobbies: (d.lobbies || []).filter((l) => l.status === 'lobby' && +l.humans < +l.size * 2).map((l) => ({ id: String(l.id), size: +l.size, humans: +l.humans })),
          tournaments: (d.tournaments || []).filter((t) => t.status === 'registering' && +t.teams < +t.max_teams).map(tourBrief) };
      } catch { return { ...none, enabled: true, error: true }; }
    }
    return { enabled: true, online: false, lobbies: [], tournaments: localTours().filter((t) => t.status === 'registering' && (+t.teams || 0) < (+t.max_teams || 0)).map(tourBrief) };
  }
  async function joinLobby(id) {
    if (!enabled()) return toastOut('Football matches are closed right now');
    if (!online()) return open();
    try { enterLobby(await call('POST', { action: 'join', id, team: 0 })); } catch (e) { await home(); say(e.message); }
  }
  async function openTournament(id) { if (!enabled()) return toastOut('Football matches are closed right now'); return tOpen(id); }
  root.ChinaLifeFootball = { open, close, enabled, refreshFlag, mountAdmin, summary, joinLobby, openTournament, get match() { return match; }, _engine: E, get _fps() { return rend?.fps; }, get _drawMs() { return rend?.ms; }, _finish() { if (match?.state && (match.local || match.isHost)) { match.state.t = match.state.duration + (match.state.extra ? F.EXTRA_MS : 0); } }, _input: input };
})(typeof window !== 'undefined' ? window : globalThis);
