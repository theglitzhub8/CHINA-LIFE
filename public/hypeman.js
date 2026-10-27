// Oct 2026: the one-city Club Hypeman (admin flag club_hypeman, default ON in one-city). Replaces ChampagnePappi there
// (club_pappi, default OFF). Canned lines only: no AI calls, no real-account link. Built by club-host.js.
// He works the front of the stage beside the DJ booth, shouts out real players by their character name as they come in,
// hypes the crowd on a timer, calls dance moments, big spenders and your own Hot seat / football wins, and has a short
// tap menu. "Shout me out" is free once per visit, so there is no money in it and nothing to validate on the server.
export const HYPE = {
  welcome: ['Oya, {n} don land! Make some noise! 🎤', '{n} is in the building! 🔥', 'VIP {n} just entered! Hands up! 🙌', 'Ehen! {n}, welcome to the {club}! 🎉'],
  join: ['Make noise for {n}! 🔊', '{n} just pulled up! We move! 🚀', 'Ehen! {n} don enter the {club}! 🙌', 'Big up {n}! Welcome in! 🎤'],
  crowd: ['Who dey here?! Make some noise! 📣', 'No dull vibes tonight! 🔥', 'Amapiano to the world! 🎹', 'Afrobeats all night long! 🥁', 'Gbedu dey burst! Shake body! 💃', 'If you love this song, scream! 📣', 'Hands up for the DJ! 🙌', 'E choke! This {club} is on fire! 🔥', 'Hydrate, then celebrate! 💧', 'Find your squad and hit the floor! 👯'],
  quiet: ['Early bird gets the dance floor! 💃', 'Call your friends, the {club} is open! 📲', 'Small crowd, big energy! Let\'s go! 🔥'],
  dance: ['Dance floor is open! Show me your moves! 💃', '{n} is dancing! E choke! 🔥', 'Look at {n} go! 🕺🔥'],
  duel: ['Dance-off! Everybody hit 💃 in 15 seconds!', 'Dance-off time! Show me moves in 15 seconds! 💃'],
  spray: ['{n} is spraying! Make it rain! 💸', 'Big money on the floor! {n} no dey play! 💸'],
  bigspend: ['Big spender alert! {n} just ordered {d}! 🍾', '{n} is balling tonight! {d} for the table! 🍾'],
  shout: ['Everybody shout {n}! 📣🔥', 'Big up {n}! The {club} loves you! 🎤', '{n}, you are the star of tonight! ⭐', 'Make some noise for {n}! 🔊🙌'],
  hotseat: ['Hot seat champion {n} is in the {club}! 🔥🏆', 'The room believed {n}! Hot seat winner! 🏆'],
  football: ['Football winner {n} is here! Goal machine! ⚽🏆', '{n} just won on the pitch! Champion in the {club}! ⚽🔥'],
  hype: ['Oya, crowd! Louder! 📣', 'I can\'t hear you! Make noise! 🔊', 'Put your hands up! 🙌🙌']
};
export const SHOUT_ONCE = 'Free once per visit';
export const HYPE_COOLDOWN_MS = 20000;
const WIN_KEY = 'chinalife-club-wins';
export function fillLine(t, v = {}) { return String(t).replace(/\{n\}/g, String(v.n || 'friend').slice(0, 18)).replace(/\{d\}/g, v.d || '').replace(/\{club\}/g, v.club || 'Club'); }
export function line(kind, v, rnd = Math.random) { const a = HYPE[kind] || HYPE.crowd; return fillLine(a[Math.floor(rnd() * a.length) % a.length], v); }
// Your own wins (hot-seat.js and football.js dispatch chinalife:winner) wait up to 2 hours for you to come to the Club.
function wins() { try { const now = Date.now(); return (JSON.parse(sessionStorage.getItem(WIN_KEY) || '[]') || []).filter((w) => w && now - w.at < 7200000) } catch { return [] } }
function storeWins(list) { try { sessionStorage.setItem(WIN_KEY, JSON.stringify(list.slice(-5))) } catch {} }
if (typeof window !== 'undefined') window.addEventListener('chinalife:winner', (e) => { const k = e.detail?.kind; if (k !== 'hotseat' && k !== 'football') return; storeWins([...wins(), { kind: k, at: Date.now(), done: false }]); window.ChinaLifeClubHost?.hypeman?.winner?.(k) });

export function hypeman(c, { hud, bump, party, clubName = 'Club', startDuel, openBar }) {
  const { THREE, root, mesh, label, game } = c, reduced = c.motionReduced;
  const club = /^club$/i.test(clubName) ? 'Club' : clubName, v = (n, d) => ({ n, d, club });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  // Stylised game character like the rest of the cast: bright tee, cap, shades, chain and a microphone.
  const body = c.person(2.3, -2.25, 0xff3fa4, 0x5b3a29, '', null, { skin: 0x5b3a29, hair: 'cap', hairColor: 0x1f8e93, acc: ['sunglasses', 'chain', 'watch'], top: { s: 'tee', c: 0xff3fa4 }, bottom: { s: 'joggers', c: 0x121212 }, shoes: { s: 'sneakers', c: 0xf7fff7 } });
  body.rotation.y = .2; body.userData.hypeman = true;
  const mic = new THREE.Group(); mesh(new THREE.CylinderGeometry(.025, .035, .22, 8), 0x222222, 0, 0, 0, mic); mesh(new THREE.SphereGeometry(.06, 10, 8), 0xc9ced6, 0, .14, 0, mic);
  body.userData.limbs?.[3]?.add(mic); mic.position.set(0, -.6, .12); mic.rotation.x = -.5;
  const tag = label('🎤 Hypeman', 0, 0, 0, 'interactive hype-name', () => menu()); tag.follow = body;
  const bubble = label('', 0, 0, 0, 'say-bubble pappi-say hype-say quiet'); bubble.follow = body; bubble.lift = .45; bubble.el.setAttribute('role', 'status');
  let sayTimer = 0;
  // Priority: 2 = something you asked for (shout-out, hype, dance-off, win), 1 = a player joining, 0 = ambient.
  // A lower line never wipes a higher one still on screen: joins wait their turn, ambient lines are dropped.
  let holdUntil = 0, holdPri = 0;
  function say(text, ms = 4200, pri = 0) { const now = performance.now(); if (now < holdUntil && pri < holdPri) { if (pri > 0) setTimeout(() => say(text, ms, pri), holdUntil - now + 300); return text } holdUntil = now + ms; holdPri = pri; bubble.el.textContent = text; bubble.el.classList.remove('quiet'); bubble.hw = 0; clearTimeout(sayTimer); sayTimer = setTimeout(() => bubble.el.classList.add('quiet'), ms); hands = performance.now() + 1600; return text }
  const me = () => game.state?.name || 'You';
  let shouted = false, lastHype = 0, hands = 0, greeted = false, nextCrowd = performance.now() + 11000 + Math.random() * 6000, lastCheck = 0;
  const seen = new Set();
  function shoutMe() { if (shouted) { game.toast?.('🎤 The Hypeman already shouted you out this visit.'); return false } shouted = true; say(line('shout', v(me())), 6000, 2); bump?.(10); game.toast?.('🎤 The Hypeman shouted you out'); return true }
  function hypeCrowd() { const wait = Math.ceil((lastHype + HYPE_COOLDOWN_MS - Date.now()) / 1000); if (wait > 0) { game.toast?.('🎤 Catching his breath. Try again in ' + wait + 's.'); return false } lastHype = Date.now(); say(line('hype', v(me())), 4200, 2); bump?.(6); c.setEmote?.('cheer'); return true }
  function danceMoment() { if (startDuel?.() === false) { game.toast?.('💃 A dance-off is already on.'); return false } say(line('duel', v(me())), 6000, 2); return true }
  function menu() {
    game.showScreen('🎤 Hypeman', 'The voice of the ' + esc(club) + '. Canned lines, real vibes.', '<div class="pappi-menu hype-menu">' +
      '<button class="choice-action" data-hype="shout"' + (shouted ? ' disabled' : '') + '><b>📣 Shout me out</b><span>' + (shouted ? 'Done this visit ✓' : SHOUT_ONCE) + '</span></button>' +
      '<button class="choice-action" data-hype="crowd"><b>🔥 Hype the crowd</b><span>Party meter up</span></button>' +
      '<button class="choice-action" data-hype="dance"><b>💃 Start a dance-off</b><span>15 seconds: hit Dance to win</span></button>' +
      (openBar ? '<button class="choice-action" data-hype="bar"><b>🍾 Bar</b><span>Drinks at the counter</span></button>' : '') + '</div>');
    document.querySelectorAll('[data-hype]').forEach((b) => b.onclick = () => { const k = b.dataset.hype; if (k === 'bar') return openBar(); document.getElementById('activityDialog')?.close(); if (k === 'shout') shoutMe(); else if (k === 'crowd') hypeCrowd(); else if (k === 'dance') danceMoment() });
  }
  // Events from the club HUD (club-host.js): dance, spray, drinks, shout-outs to the DJ.
  function event(kind, d = {}) {
    if (kind === 'dance') return Math.random() < .5 ? say(line('dance', v(me()))) : '';
    if (kind === 'spray' && (d.amount || 0) >= 500) return say(line('spray', v(me())), 4200, 1);
    if (kind === 'drink' && (d.price || 0) >= 300) return say(line('bigspend', v(me(), d.name)), 4200, 1);
    return '';
  }
  function winner(kind) { const list = wins(), w = list.find((x) => x.kind === kind && !x.done) || list.find((x) => !x.done); if (!w) return false; w.done = true; storeWins(list); setTimeout(() => say(line(w.kind, v(me())), 6000, 2), 1200); return true }
  // Walking: a short beat along the stage front, keeping the shared personal space (world.js CROWD_GAP .72) and
  // never stepping into furniture; he gives way to anyone closer than that.
  const spots = [[2.3, -2.25], [-2.3, -2.25], [3.5, -1.95], [-3.5, -1.95], [1.1, -2.4], [-1.1, -2.4]];
  const free = (x, z) => Math.abs(x) < 9 && Math.abs(z) < 6.5 && !c.obstacles().some((o) => Math.abs(x - o.x) < o.w / 2 + .15 && Math.abs(z - o.z) < o.d / 2 + .15);
  const GAP = .8, clear = (x, z) => free(x, z) && !c.bodies().some((b) => b !== body && Math.hypot(b.position.x - x, b.position.z - z) < GAP);
  let goal = null, wait = 3, stuck = 0;
  function walk(time, dt) {
    if (goal) {
      const dx = goal[0] - body.position.x, dz = goal[1] - body.position.z, dist = Math.hypot(dx, dz);
      if (dist < .12 || stuck > 2) { goal = null; stuck = 0; wait = 4 + Math.random() * 5; body.rotation.y = .1 }
      else { const sx = dx / dist * Math.min(dist, dt * 1.1), sz = dz / dist * Math.min(dist, dt * 1.1); if (clear(body.position.x + sx * 4, body.position.z + sz * 4)) { body.position.x += sx; body.position.z += sz; body.rotation.y = Math.atan2(dx, dz) } else stuck += dt }
    } else { wait -= dt; if (wait <= 0) { let n; do n = spots[Math.floor(Math.random() * spots.length)]; while (n === goal); goal = n } }
    for (const b of c.bodies()) { if (b === body) continue; const dx = body.position.x - b.position.x, dz = body.position.z - b.position.z, d = Math.hypot(dx, dz); if (d >= .76) continue; const k = .76 - d, ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0; if (free(body.position.x + ux * k, body.position.z + uz * k)) { body.position.x += ux * k; body.position.z += uz * k } }
    const [l, r, al, ar] = body.userData.limbs || [], w = goal ? Math.sin(time * .01) : 0, up = performance.now() < hands;
    if (l && r) { l.rotation.x = w * .5; r.rotation.x = -w * .5 }
    if (al && ar && !reduced()) { ar.rotation.x = up ? -2.2 : -1.3; al.rotation.z = up ? 2.4 + Math.sin(time * .02) * .3 : .3 + Math.abs(Math.sin(time * .004)) * .4 }
  }
  function tick(time, dt) {
    if (!greeted && c.getPlayer()) { greeted = true; setTimeout(() => { say(line('welcome', v(me())), 5000, 1); if (wins().some((w) => !w.done)) winner() }, 1100) }
    walk(time, dt);
    if (time - lastCheck < 1000) return; lastCheck = time;
    // Real players coming in: their character name from the presence feed. Players already here when you arrive are not re-announced.
    const first = !seen.primed; seen.primed = true; let delay = 400;
    for (const r of c.remotes()) if (!seen.has(r.id)) { seen.add(r.id); if (!first && r.name) { const n = r.name; setTimeout(() => say(line('join', v(n)), 4200, 1), delay); delay += 4500 } }
    if (performance.now() > nextCrowd) { nextCrowd = performance.now() + 15000 + Math.random() * 12000; say(line(c.remotes().length || (party?.() || 0) > 40 ? 'crowd' : Math.random() < .5 ? 'quiet' : 'crowd', v(me()))) }
  }
  function dispose() { clearTimeout(sayTimer) }
  return { body, say, tick, dispose, menu, event, winner, shoutMe, hypeCrowd, danceMoment, keep: [body], get shouted() { return shouted } };
}
