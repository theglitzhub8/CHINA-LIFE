// v11: one-city Club life. A shared beat clock, disco ball, colour beams, neon strips, a DJ booth with a DJ who
// moves on the beat, a "Now playing" chip and a shout-out to the DJ that shows on the booth screen.
// Mobile first: MeshBasic/additive materials only, no extra lights or shadows, one canvas redraw per shout-out.
// Built by club-host.js in one-city mode only; Classic 007 keeps its original dressing.
export const SHOUTS = ['Big up the DJ! 🔊', 'Run it back, DJ! 🔁', 'Amapiano to the world! 🎹', 'Afrobeats all night! 🥁', 'Jollof wars truce tonight 🍚', 'Happy birthday to me! 🎂', 'Shout-out to my squad 👯', 'Make some noise for Africa! 🌍'];
export const SHOUT_COOLDOWN_MS = 20000;
const PALETTE = [0xff3fa4, 0x35e6ff, 0x8b5cff, 0xffcf5a, 0x2ee6a0];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Beats since the epoch: the club DJ's synced phase while music plays, else a silent clock at the track tempo,
// so lights and dancers stay on one shared beat for everyone in the room.
export function beatPhase(bpm = 113, now = Date.now()) {
  const p = (typeof window !== 'undefined' && window.ChinaLifeAudio?.beatPhase?.()) ?? null;
  return p !== null && p !== undefined ? p : now / (60000 / bpm);
}
export function shoutText(name, msg) { return String(name || 'Someone').slice(0, 18) + ': ' + String(msg || '').slice(0, 40); }

export function clubLife(c, { say, bump, hud, clubName, bpm = 113 }) {
  const { THREE, root, mesh, box, cylinder, label, game } = c, reduced = c.motionReduced, disposers = [];
  const basic = (color, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color, ...extra }); disposers.push(m); return m };
  const geo = (g) => (disposers.push(g), g);
  const glow = (color, opacity) => basic(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const clock = { phase: () => beatPhase(bpm), bpm };
  window.ChinaLifeClubBeat = clock;

  // Disco ball over the dance floor, with mirror sparkles that sweep the floor.
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xdfe3ff, metalness: .9, roughness: .18, flatShading: true, emissive: 0x2a2440 }); disposers.push(ballMat);
  const ball = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(.42, 1)), ballMat); ball.position.set(.3, 4.15, .6); root.add(ball);
  const glint = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(.44, 1)), basic(0xffffff, { wireframe: true, transparent: true, opacity: .55 })); ball.add(glint);
  { const s = mesh(geo(new THREE.CylinderGeometry(.012, .012, 1.2, 4)), 0x999999, .3, 4.95, .6); s.castShadow = false }
  const spotG = geo(new THREE.CircleGeometry(.24, 12)), spots = [];
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(spotG, glow(PALETTE[i % PALETTE.length], .55)); m.rotation.x = -Math.PI / 2; m.userData.a = i / 10 * Math.PI * 2; m.userData.r = 1.1 + (i % 3) * .9; root.add(m); spots.push(m) }
  // Four coloured beams (two more than the classic room) from the corners of the stage.
  const beamG = geo(new THREE.ConeGeometry(.9, 4.4, 12, 1, true)), beams = [];
  for (const [x, z, k] of [[-6.2, -5.2, 2], [6.2, -5.2, 3], [-3.2, -5.6, 4], [3.2, -5.6, 0]]) { const b = new THREE.Mesh(beamG, glow(PALETTE[k], .12)); const pivot = new THREE.Group(); pivot.position.set(x, 3.5, z); b.position.y = -2.2; pivot.add(b); pivot.userData.k = k; pivot.userData.side = x < 0 ? 1 : -1; root.add(pivot); beams.push(pivot) }
  // Neon strips along the back and side walls; their colour drifts slowly and jumps on the bar.
  const stripMats = [basic(0xff3fa4), basic(0x35e6ff)], strips = [];
  for (const [w, d, x, y, z, m] of [[18.4, .07, 0, 3.45, -6.8, 0], [18.4, .07, 0, .32, -6.8, 1], [.07, 13, -9.3, 3.45, 0, 1], [.07, 13, -9.3, .32, 0, 0]]) { const s = mesh(geo(new THREE.BoxGeometry(w, .07, d)), 0, x, y, z); s.material = stripMats[m]; s.castShadow = s.receiveShadow = false; s.userData.privateMaterial = true; strips.push(s) }
  // DJ booth on the stage: decks, a glowing front screen (shout-outs show here) and the DJ.
  box(2.6, .9, .7, 0x17102a, 0, .75, -3.2);
  { const t = mesh(geo(new THREE.BoxGeometry(2.7, .05, .8)), 0, 0, 1.22, -3.2); t.material = basic(0x111111); t.userData.privateMaterial = true }
  const decks = [-.6, .6].map((x) => { const d = cylinder(.24, .04, 0x222222, x, 1.27, -3.25, root, 16); const dot = mesh(geo(new THREE.BoxGeometry(.2, .012, .03)), 0xffcf5a, 0, .03, 0, d); dot.castShadow = false; return d });
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const g2 = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; disposers.push(tex);
  const screenMat = basic(0xffffff, { map: tex });
  // The club screen hangs over the DJ (visible from the floor camera); the booth front repeats it.
  const screen = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.6, 1.12)), screenMat); screen.position.set(0, 3.05, -4.5); root.add(screen);
  const front = new THREE.Mesh(geo(new THREE.PlaneGeometry(2.5, .78)), screenMat); front.position.set(0, .78, -2.84); root.add(front);
  for (const x of [-1.75, 1.75]) { const w = mesh(geo(new THREE.CylinderGeometry(.01, .01, 1.4, 4)), 0x999999, x, 4.3, -4.5); w.castShadow = false }
  let shout = null, lastShoutAt = 0;
  function paint(flash = 0) {
    const s = shout && Date.now() < shout.until ? shout : null;
    g2.fillStyle = s ? (flash ? '#2a0d3d' : '#14061f') : '#0b0717'; g2.fillRect(0, 0, 512, 160);
    g2.strokeStyle = s ? '#ffcf5a' : '#ff3fa4'; g2.lineWidth = 6; g2.strokeRect(5, 5, 502, 150);
    g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillStyle = s ? '#ffcf5a' : '#35e6ff';
    g2.font = '800 26px system-ui,sans-serif'; g2.fillText(s ? '📣 SHOUT-OUT' : '🎧 ' + String(clubName).toUpperCase(), 256, 38, 480);
    g2.fillStyle = '#fff'; g2.font = '900 34px system-ui,sans-serif';
    g2.fillText(s ? shoutText(s.name, s.msg) : 'Tap 📣 to shout out the DJ', 256, 102, 484);
    screen.userData.signText = front.userData.signText = s ? shoutText(s.name, s.msg) : clubName; tex.needsUpdate = true;
  }
  paint();
  const dj = c.person(0, -3.95, 0x111111, 0x4a2f22, '', 'dj', { skin: 0x4a2f22, hair: 'cap', hairColor: 0x111111, acc: ['headphones', 'chain'], top: { s: 'tee', c: 0x8b5cff }, bottom: { s: 'jeans', c: 0x161616 } });
  dj.position.y = .3; dj.userData.mode = 'dj'; dj.userData.baseY = .3; dj.userData.phase = 0; c.addActor(dj);
  const djTag = label('🎧 DJ', 0, 0, 0, 'interactive', () => openShout()); djTag.follow = dj;
  const bubble = label('', 0, 0, 0, 'say-bubble pappi-say dj-say quiet'); bubble.follow = dj; bubble.lift = .45; bubble.el.setAttribute('role', 'status');
  let djTimer = 0; const djSay = (t, ms = 4200) => { bubble.el.textContent = t; bubble.el.classList.remove('quiet'); bubble.hw = 0; clearTimeout(djTimer); djTimer = setTimeout(() => bubble.el.classList.add('quiet'), ms) };

  // HUD: Now playing chip (tap to play or pause the club DJ) and the shout-out button in the party fan.
  const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'club-now'; chip.setAttribute('aria-live', 'polite');
  chip.onclick = () => window.ChinaLifeAudio?.toggle?.(); hud.append(chip);
  let chipKey = '';
  function drawChip() {
    const a = window.ChinaLifeAudio, n = a?.nowPlaying, on = !!(n && n.playing);
    const key = on + '|' + (n?.title || '') + '|' + (n?.artist || '');
    if (key === chipKey) return; chipKey = key; chip.classList.toggle('on', on);
    chip.innerHTML = on ? '<i class="eq" aria-hidden="true"><b></b><b></b><b></b></i><span><small>Now playing</small>' + esc(n.title) + ' · ' + esc(n.artist) + '</span>' : '<i aria-hidden="true">▶</i><span><small>DJ is ready</small>Tap for Afrobeats &amp; Amapiano</span>';
    chip.setAttribute('aria-label', on ? 'Now playing ' + n.title + '. Tap to pause.' : 'Play club music');
  }
  drawChip();
  const bar = hud.querySelector('.club-emotes');
  if (bar) { const b = document.createElement('button'); b.dataset.ce = 'shout'; b.innerHTML = '📣<span>Shout-out</span>'; bar.insertBefore(b, bar.querySelector('[data-ce=spray]')); }
  function openShout() {
    const wait = Math.ceil((lastShoutAt + SHOUT_COOLDOWN_MS - Date.now()) / 1000);
    if (wait > 0) return game.toast('📣 The DJ just read one out. Try again in ' + wait + 's.');
    game.showScreen('📣 Shout-out to the DJ', 'Pick one. The DJ reads it out and it shows on the booth screen.', '<div class="pappi-menu club-shouts">' + SHOUTS.map((s, i) => '<button class="choice-action" data-shout="' + i + '"><b>' + esc(s) + '</b></button>').join('') + '</div>');
    document.querySelectorAll('[data-shout]').forEach((b) => b.onclick = () => { document.getElementById('activityDialog')?.close(); send(SHOUTS[Number(b.dataset.shout)]) });
  }
  function send(msg, name = game.state.name) {
    if (!SHOUTS.includes(msg)) return false;
    lastShoutAt = Date.now(); shout = { name: name || 'You', msg, until: Date.now() + 15000 }; paint();
    djSay('Shout-out to ' + shout.name + '! ' + msg, 6000); game.toast?.('📣 Your shout-out is on the club screen'); say?.('Big up ' + shout.name + '! 🙌', 3500); bump?.(10); flashBeats = 4; hype = performance.now() + 4000;
    window.dispatchEvent(new CustomEvent('chinalife:club-shout', { detail: { ...shout } })); return true;
  }

  let lastBeat = -1, lastFx = 0, flashBeats = 0, hype = 0, lastChip = 0, hue = 0;
  function tick(time, dt, floor) {
    const ph = clock.phase(), beat = Math.floor(ph), frac = ph - beat, still = reduced();
    if (beat !== lastBeat) {
      lastBeat = beat;
      for (const b of beams) b.children[0].material.color.setHex(PALETTE[(b.userData.k + beat) % PALETTE.length]);
      for (let i = 0; i < spots.length; i++) spots[i].material.color.setHex(PALETTE[(i + beat) % PALETTE.length]);
      if (beat % 4 === 0) { hue = (hue + .17) % 1 }
      if (flashBeats > 0) { flashBeats--; if (floor) for (const t of floor.tiles) t.material = floor.mats[beat % floor.mats.length]; paint(beat % 2) } else if (shout && Date.now() > shout.until) { shout = null; paint() }
    }
    if (time - lastChip > 1000) { lastChip = time; drawChip() }
    if (still || time - lastFx < 50) return; lastFx = time;
    const kick = Math.pow(1 - frac, 3);
    ball.rotation.y += .02; glint.material.opacity = .3 + kick * .6;
    for (const s of spots) { const a = s.userData.a + time * .00035; s.position.set(.3 + Math.cos(a) * s.userData.r, .18, .6 + Math.sin(a) * s.userData.r * .7); s.material.opacity = .25 + kick * .5 }
    for (const b of beams) { const sw = Math.sin(time * .0012 + b.userData.k); b.rotation.z = b.userData.side * (.35 + .3 * sw); b.rotation.x = .3 + .25 * Math.cos(time * .0009 + b.userData.k); b.children[0].material.opacity = .08 + kick * .12 }
    stripMats[0].color.setHSL(hue, 1, .45 + kick * .2); stripMats[1].color.setHSL((hue + .5) % 1, 1, .45 + kick * .2);
    for (const d of decks) d.rotation.y -= .25;
    if (floor) for (const m of floor.mats) m.opacity = .3 + kick * .45;
    // DJ hands: one on the deck, the other up on the beat (both up during a shout-out).
    const [, , al, ar] = dj.userData.limbs || [];
    if (al && ar && !dj.userData.real) { const up = performance.now() < hype; ar.rotation.x = -1.2; al.rotation.z = up ? 2.6 + Math.sin(frac * Math.PI) * .3 : .4 + kick * .5; if (up) ar.rotation.z = -2.4 }
  }
  function dispose() { if (window.ChinaLifeClubBeat === clock) window.ChinaLifeClubBeat = null; clearTimeout(djTimer); chip.remove(); for (const d of disposers) d.dispose?.() }
  return { tick, dispose, openShout, send, paint, keep: [ball, ...spots, ...beams, ...strips, ...decks, dj, screen, front], dj, clock, get shout() { return shout } };
}
