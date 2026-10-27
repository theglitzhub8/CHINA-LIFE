// Football Field: "⚽ Play a match" (Oct 2026). Real-time 1v1 to 5v5 matches with joystick + Pass/Shoot,
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
  const online = () => !sandbox()?.localOnly && !!root.ChinaLifeCloud?.joined && !!root.ChinaLifeCloud?.api;
  let serverOn = null; // null = not asked yet
  const meName = () => String(game()?.state?.name || game()?.state?.player?.name || root.ChinaLifeCloud?.profile?.user_name || 'You').slice(0, 18);
  function enabled() {
    if (root.ChinaLifeFlags?.off?.('football')) return false;
    if (!online()) return localStorage.getItem(OFF_KEY()) !== '1';
    return serverOn === true;
  }
  async function call(method, body) { const r = await root.ChinaLifeCloud.api('/chinalife/football.php', method, body); return r?.data || r; }
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
  function stopLoops() { clearInterval(poll); poll = null; cancelAnimationFrame(loop); loop = null; clearInterval(netT); netT = null; }
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
      ${isHost ? `<button class="fb-btn primary big" data-fb="start">▶ Kick off</button><p class="fb-note">Bots fill the open spots when you kick off.</p>` : '<p class="fb-note">Waiting for the host to kick off…</p>'}
      <button class="fb-btn ghost" data-fb="leave">Leave match</button></section>`, 'Match lobby');
  }
  // ---------- match ----------
  const input = { mx: 0, my: 0, pass: false, shoot: false };
  let netT = null, lastFrame = 0, acc = 0, cv = null, ctx = null, events = [], banner = null, prevSnap = null;
  function startMatch() {
    clearInterval(poll); poll = null; finished = false;
    const m = match; m.status = 'live';
    m.state = E.create({ roster: m.roster.map((p) => ({ id: String(p.id), name: p.name, team: p.team })), size: m.size, seed: m.seed || (Date.now() % 2e9), duration: m.duration || F.DURATION_MS, knockout: !!m.knockout });
    m.myTeam = (m.roster.find((p) => String(p.id) === String(m.me)) || { team: 0 }).team;
    m.isHost = String(m.host) === String(m.me);
    show('match', `<div class="fb-hud"><span class="fb-sa">A <b>0</b></span><span class="fb-clock">3:00</span><span class="fb-sb"><b>0</b> B</span></div>
      <canvas class="fb-pitch"></canvas><div class="fb-banner" hidden></div>
      <div class="fb-controls"><div class="fb-stick"><div class="fb-knob"></div></div><div class="fb-buttons"><button class="fb-act pass" data-act="pass">Pass</button><button class="fb-act shoot" data-act="shoot">Shoot</button></div></div>`, m.tournament ? 'Tournament match' : `${m.size}v${m.size} match`);
    cv = $('.fb-pitch', el); ctx = cv.getContext('2d'); bindControls(); size();
    banner = { text: 'Kick off!', until: performance.now() + 1400 };
    lastFrame = performance.now(); acc = 0; loop = requestAnimationFrame(frame);
    if (!m.local) netT = setInterval(m.isHost ? hostNet : guestNet, m.isHost ? 200 : 150);
  }
  let remoteInputs = {};
  function frame(now) {
    const m = match; if (!m || view !== 'match') return;
    const dt = Math.min(100, now - lastFrame); lastFrame = now;
    if (m.local || m.isHost) {
      acc += dt;
      while (acc >= 33) { acc -= 33; const ins = { ...remoteInputs, [String(m.me)]: { ...input } }; const ev = E.step(m.state, ins, 33); input.pass = input.shoot = false; handle(ev); }
    } else guestPredict(dt);
    draw(); hud();
    loop = requestAnimationFrame(frame);
  }
  function handle(ev) {
    for (const e of ev) {
      if (e.type === 'goal') { const p = match.state.players.find((q) => q.id === e.by); banner = { text: `GOAL! ${e.own ? 'Own goal' : esc(p?.name || '')}`, until: performance.now() + 2000, big: true }; buzz(80); }
      if (e.type === 'extra') banner = { text: 'Extra time · golden goal', until: performance.now() + 2000 };
      if (e.type === 'full') fullTime();
    }
  }
  function buzz(ms) { try { navigator.vibrate?.(ms); } catch {} }
  // Host: send a snapshot, receive the other players' inputs.
  async function hostNet() {
    const m = match; if (!m || m.local) return;
    try { const d = await call('POST', { action: 'snap', id: m.id, seq: ++m.seq, snap: E.snapshot(m.state) }); remoteInputs = d.inputs || {}; if (d.match && d.match.status !== 'live') { say('Match stopped'); } } catch (e) { if (e.status === 403 || e.status === 404) { say(e.message); home(); } }
  }
  // Guest: send my input, get the host's latest snapshot back in the same request.
  async function guestNet() {
    const m = match; if (!m || m.local) return;
    const sent = { ...input }; input.pass = input.shoot = false;
    try {
      const d = await call('POST', { action: 'input', id: m.id, mx: sent.mx, my: sent.my, pass: sent.pass, shoot: sent.shoot });
      if (d.snap) { const before = m.state.goals.length, prevScore = m.state.score.slice(); prevSnap = JSON.parse(JSON.stringify(m.state.players.map((p) => [p.x, p.y]))); E.applySnapshot(m.state, d.snap); if (m.state.score[0] + m.state.score[1] > prevScore[0] + prevScore[1]) { banner = { text: 'GOAL!', until: performance.now() + 2000, big: true }; buzz(80); } }
      if (d.match?.status && d.match.status !== 'live' || m.state.phase === 'full') { if (m.state.phase === 'full' || ['reported', 'done'].includes(d.match?.status)) fullTime(d.match); else { say('Match stopped'); home(); } }
    } catch (e) { if (e.status === 404) home(); }
  }
  // Between snapshots guests move everything along its last velocity so it looks smooth.
  function guestPredict(dt) { const s = match.state; if (s.phase !== 'play') return; const k = dt / 1000; for (const p of s.players) { p.x = Math.max(F.R, Math.min(F.W - F.R, p.x + p.vx * k)); p.y = Math.max(F.R, Math.min(F.H - F.R, p.y + p.vy * k)); } const b = s.ball; if (!b.owner) { b.x += b.vx * k; b.y += b.vy * k; } else { const p = s.players.find((q) => q.id === b.owner); if (p) { b.x = p.x + p.fx * (F.R + F.BALL); b.y = p.y + p.fy * (F.R + F.BALL); } } s.t += dt; }
  let finished = false;
  async function fullTime(srv) {
    if (finished) return; finished = true; const m = match; clearInterval(netT); netT = null;
    const s = m.state, mine = m.myTeam, won = s.winner === mine, isDraw = s.winner === null;
    let note = '';
    if (!m.local) {
      try {
        if (m.isHost) { const r = await call('POST', { action: 'result', id: m.id, report: E.report(s) }); note = r.status === 'done' ? 'Result confirmed ✓' : r.status === 'disputed' ? 'Result disputed: an admin will check it' : 'Waiting for the other players to confirm…'; }
        else { const r = await call('POST', { action: 'confirm', id: m.id, score: s.score }); note = r.status === 'done' ? 'Result confirmed ✓' : r.status === 'disputed' ? 'Scores did not match: an admin will check it' : 'Result sent ✓'; }
      } catch (e) { note = e.message; }
    } else {
      const st = stats(); st.played++; if (won) st.won++; else if (!isDraw) st.lost++; else st.drawn++; localStorage.setItem(STATS_KEY(), JSON.stringify(st));
      if (m.tournament) note = localTournamentResult(m);
    }
    banner = null; cancelAnimationFrame(loop); loop = null; draw();
    const scorers = s.goals.map((g) => { const p = s.players.find((q) => q.id === g.by); return `<li class="t${g.team}">⚽ ${Math.floor(g.t / 60000)}:${String(Math.floor(g.t / 1000) % 60).padStart(2, '0')} · ${g.own ? 'Own goal' : esc(p?.name || 'Player')} <small>${g.team ? 'B' : 'A'}</small></li>`; }).join('');
    const ov = document.createElement('div'); ov.className = 'fb-full';
    ov.innerHTML = `<div class="fb-card"><p class="fb-kicker">FULL TIME</p><h2>${isDraw ? 'Draw' : won ? 'You win! 🎉' : 'You lose'}</h2><p class="fb-final"><span>A</span> ${s.score[0]} – ${s.score[1]} <span>B</span></p>${s.pens ? `<p class="fb-sub">Penalties ${s.pens[0]}–${s.pens[1]}</p>` : ''}<ul class="fb-goals">${scorers || '<li>No goals</li>'}</ul><p class="fb-note">${esc(note)}</p>
      <div class="fb-row">${m.tournament ? `<button class="fb-btn primary" data-fb="t-open" data-id="${esc(m.tournament)}">🏆 Bracket</button>` : `<button class="fb-btn primary" data-fb="again">Play again</button>`}<button class="fb-btn" data-fb="home">Done</button></div></div>`;
    $('.fb-body', el).appendChild(ov); buzz([60, 40, 60]);
  }
  const stats = () => { try { return { played: 0, won: 0, lost: 0, drawn: 0, ...JSON.parse(localStorage.getItem(STATS_KEY()) || '{}') }; } catch { return { played: 0, won: 0, lost: 0, drawn: 0 }; } };
  // ---------- drawing (portrait: my team always attacks up) ----------
  let scale = 10, ox = 0, oy = 0;
  function size() {
    if (!cv) return; const r = cv.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min((r.width - 16) / (F.H + 2), (r.height - 8) / (F.W + 3)); ox = (r.width - F.H * scale) / 2; oy = (r.height - F.W * scale) / 2;
  }
  root.addEventListener?.('resize', () => size());
  function toScreen(x, y) { const up = match?.myTeam !== 1; return up ? [ox + y * scale, oy + (F.W - x) * scale] : [ox + (F.H - y) * scale, oy + x * scale]; }
  function draw() {
    if (!ctx || !match) return; const s = match.state, W = cv.clientWidth, H = cv.clientHeight;
    ctx.clearRect(0, 0, W, H);
    // grass stripes
    for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#2f8a4c' : '#36985a'; ctx.fillRect(ox, oy + i * F.W * scale / 10, F.H * scale, F.W * scale / 10 + 1); }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, F.H * scale, F.W * scale);
    ctx.beginPath(); ctx.moveTo(ox, oy + F.W * scale / 2); ctx.lineTo(ox + F.H * scale, oy + F.W * scale / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(ox + F.H * scale / 2, oy + F.W * scale / 2, 5 * scale, 0, Math.PI * 2); ctx.stroke();
    for (const end of [0, 1]) { const y0 = end ? oy + F.W * scale : oy, dir = end ? -1 : 1; ctx.strokeRect(ox + (F.H / 2 - 9) * scale, end ? y0 - 8 * scale : y0, 18 * scale, 8 * scale);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(ox + (F.H / 2 - F.GOAL / 2) * scale, y0 - (end ? 0 : 1.4 * scale) + (end ? 0 : 0), F.GOAL * scale, 1.4 * scale * (end ? 1 : 1)); void dir; }
    // players
    for (const p of s.players) {
      const [x, y] = toScreen(p.x, p.y), me = String(p.id) === String(match.me), r = F.R * scale * 1.05;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, r, r * .7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.team ? '#3a7bd5' : '#e8543f'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = me ? 3 : 1.5; ctx.strokeStyle = me ? '#ffe14d' : 'rgba(255,255,255,.9)'; ctx.stroke();
      const [fx, fy] = toScreen(p.x + p.fx * F.R * 1.4, p.y + p.fy * F.R * 1.4); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = me ? '#ffe14d' : 'rgba(255,255,255,.92)'; ctx.fillText(me ? 'YOU' : p.name.replace(' 🤖', '').slice(0, 9), x, y - r - 4);
    }
    const [bx, by] = toScreen(s.ball.x, s.ball.y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, Math.max(4, F.BALL * scale), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const bn = $('.fb-banner', el);
    if (banner && performance.now() < banner.until) { bn.hidden = false; bn.textContent = banner.text; bn.classList.toggle('big', !!banner.big); }
    else if (s.phase === 'kickoff') { bn.hidden = false; bn.textContent = 'Kick off'; bn.classList.remove('big'); }
    else bn.hidden = true;
  }
  function hud() {
    const s = match.state, left = Math.max(0, (s.extra ? s.duration + F.EXTRA_MS : s.duration) - s.t), sec = Math.ceil(left / 1000);
    const sa = $('.fb-sa b', el), sb = $('.fb-sb b', el), c = $('.fb-clock', el); if (!sa) return;
    sa.textContent = s.score[0]; sb.textContent = s.score[1]; c.textContent = (s.extra ? 'ET ' : '') + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  // ---------- controls ----------
  function setStick(jx, jy) {
    // joystick right/down in screen space -> field direction (my team attacks up the screen)
    const up = match?.myTeam !== 1; input.mx = up ? -jy : jy; input.my = up ? jx : -jx;
  }
  function bindControls() {
    const stick = $('.fb-stick', el), knob = $('.fb-knob', el); let id = null, cx = 0, cy = 0;
    const move = (e) => { const R = stick.clientWidth / 2, dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), k = d > R ? R / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; setStick(dx * k / R, dy * k / R); };
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); e.preventDefault(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; setStick(0, 0); };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    for (const b of el.querySelectorAll('.fb-act')) b.addEventListener('pointerdown', (e) => { input[b.dataset.act] = true; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); e.preventDefault(); });
  }
  const keys = new Set();
  document.addEventListener('keydown', (e) => { if (view !== 'match' || !match) return; const k = e.key.toLowerCase(); if (k === 'j') input.pass = true; else if (k === 'k' || k === ' ') input.shoot = true; else keys.add(k); keyStick(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); });
  document.addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); if (view === 'match') keyStick(); });
  function keyStick() { const has = (...a) => a.some((k) => keys.has(k)); const jx = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0), jy = (has('s', 'arrowdown') ? 1 : 0) - (has('w', 'arrowup') ? 1 : 0); if (keys.size || jx || jy) setStick(jx, jy); else setStick(0, 0); }
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
  root.ChinaLifeFootball = { open, close, enabled, refreshFlag, mountAdmin, get match() { return match; }, _engine: E, _finish() { if (match?.state && (match.local || match.isHost)) { match.state.t = match.state.duration + (match.state.extra ? F.EXTRA_MS : 0); } }, _input: input };
})(typeof window !== 'undefined' ? window : globalThis);
