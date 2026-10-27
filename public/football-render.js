// Football Field match renderer (v2, Oct 2026): a tilted broadcast camera that follows the ball, a floodlit
// mini-stadium (stands, crowd, ad boards, floodlights), striped pitch with full markings and goal nets,
// kit-coloured players with numbers, ball shadow/height/spin, confetti, camera shake and a mini-map.
// Plus FBSound: synthesized whistle, kicks, post, crowd bed and cheers (WebAudio, no audio files).
// One canvas, no per-frame allocations in the hot paths beyond small arrays; ~200 draw calls per frame.
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  const E = root.ChinaLifeFootballEngine; if (!E) return;
  const F = E.F, TAU = Math.PI * 2;
  const KIT = [{ shirt: '#e8473b', dark: '#9e2219', shorts: '#fff', num: '#fff', gk: '#ffd23f' }, { shirt: '#2f73d9', dark: '#174a9a', shorts: '#14213d', num: '#fff', gk: '#3fe08a' }];
  const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#5c3a1e', '#a86b3c'], HAIR = ['#1b1b1b', '#2b1a10', '#4a2c12', '#111'];
  const CROWD = ['#e8473b', '#2f73d9', '#ffd23f', '#f4f4f4', '#ff8a3d', '#7c4dff'];
  function create(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    let W = 0, H = 0, dpr = 1, quality = 1;
    const cam = { u: F.W / 2, v: F.H / 2, zoom: 1, shake: 0, theta: 54 * Math.PI / 180, dist: 44, f: 400, cy: 0 };
    let flip = false; // true when my team attacks toward x = 0
    const toU = (x) => (flip ? F.W - x : x), toV = (y) => (flip ? F.H - y : y);
    // Crowd: fixed seats on the three visible stands + near stand edge.
    const seats = [];
    (function seatsInit() {
      const r = E.rng(77);
      // rows climb the stands: side stands (v<0, v>H) and the two end stands
      const rows = 7;
      for (let row = 0; row < rows; row++) {
        const z = .55 + row * 1.08, off = 4 + row * 1.45;
        for (let u = -3; u < F.W + 3; u += .78) for (const side of [0, 1]) if (r() < .86) seats.push({ u: u + (r() - .5) * .3, v: side ? F.H + off : -off, z, c: Math.floor(r() * CROWD.length), ph: r() * TAU, sx: 0, sy: 0, k: 0, ok: false });
        for (let v = -3; v < F.H + 3; v += .78) for (const end of [0, 1]) if (r() < .86) seats.push({ u: end ? F.W + 5 + row * 1.45 : -5 - row * 1.45, v: v + (r() - .5) * .3, z, c: Math.floor(r() * CROWD.length), ph: r() * TAU, sx: 0, sy: 0, k: 0, ok: false });
      }
    })();
    const glow = document.createElement('canvas'); glow.width = glow.height = 128;
    (function () { const g = glow.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,235,.95)'); gr.addColorStop(.25, 'rgba(255,250,210,.45)'); gr.addColorStop(1, 'rgba(255,250,210,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); })();
    function resize() {
      const r = canvas.getBoundingClientRect(); dpr = Math.min(quality < 1 ? 1.25 : 2, root.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // ---------- projection ----------
    let ct = 0, st = 0, camU0 = 0, camH = 0, sx0 = 0, sy0 = 0;
    function setupCam() {
      ct = Math.cos(cam.theta); st = Math.sin(cam.theta); camU0 = cam.u - cam.dist * ct; camH = cam.dist * st;
      cam.f = W * cam.dist / (21.5 / cam.zoom); cam.cy = H * .54;
      sx0 = cam.shake ? (Math.random() - .5) * cam.shake : 0; sy0 = cam.shake ? (Math.random() - .5) * cam.shake : 0;
    }
    const P = { x: 0, y: 0, k: 0 };
    // u,v in view space (my attack = +u = up the screen), z height. Returns false when behind the camera.
    function pr(u, v, z, out = P) {
      const rf = u - camU0, up = z - camH, depth = rf * ct - up * st;
      if (depth < .5) return false;
      const yc = rf * st + up * ct, k = cam.f / depth;
      out.x = W / 2 + (v - cam.v) * k + sx0; out.y = cam.cy - yc * k + sy0; out.k = k; return true;
    }
    const prF = (x, y, z, out) => pr(toU(x), toV(y), z, out);
    function poly(pts) { // pts: flat [u,v,z,...]; returns true if drawn path
      ctx.beginPath(); for (let i = 0; i < pts.length; i += 3) { if (!pr(pts[i], pts[i + 1], pts[i + 2])) return false; if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); } ctx.closePath(); return true;
    }
    function line(u1, v1, z1, u2, v2, z2) { if (!pr(u1, v1, z1)) return; const x = P.x, y = P.y; if (!pr(u2, v2, z2)) return; ctx.moveTo(x, y); ctx.lineTo(P.x, P.y); }
    // ---------- camera ----------
    function follow(s, dt, opts = {}) {
      const b = s.ball, bu = toU(b.x), bv = toV(b.y), vu = flip ? -b.vx : b.vx;
      const tu = Math.max(4, Math.min(F.W - 2, bu + 3 + vu * .18)), tv = F.H / 2 + (bv - F.H / 2) * .5;
      const tz = opts.zoom || (s.phase === 'goal' ? 1.18 : s.phase === 'kickoff' ? .92 : 1);
      const k = 1 - Math.exp(-dt / 1000 * (opts.snap ? 30 : 3.6));
      cam.u += (tu - cam.u) * k; cam.v += (tv - cam.v) * k; cam.zoom += (tz - cam.zoom) * k * .6;
      cam.shake *= Math.exp(-dt / 1000 * 6); if (cam.shake < .3) cam.shake = 0;
    }
    // ---------- scene ----------
    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, H * .5); g.addColorStop(0, '#060b1a'); g.addColorStop(1, '#16233d'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    function drawStands(s, now, excite) {
      // concrete bowl
      ctx.fillStyle = '#1b2333';
      const segs = 6, L = F.W + 16;
      for (let i = 0; i < segs; i++) {
        const u1 = -8 + L * i / segs, u2 = -8 + L * (i + 1) / segs;
        if (poly([u1, -3, 0, u2, -3, 0, u2, -14, 8, u1, -14, 8])) ctx.fill();
        if (poly([u1, F.H + 3, 0, u2, F.H + 3, 0, u2, F.H + 14, 8, u1, F.H + 14, 8])) ctx.fill();
      }
      ctx.fillStyle = '#20293b';
      if (poly([F.W + 4, -14, 0, F.W + 4, F.H + 14, 0, F.W + 13, F.H + 14, 8, F.W + 13, -14, 8])) ctx.fill();
      if (poly([-4, -14, 0, -4, F.H + 14, 0, -13, F.H + 14, 8, -13, -14, 8])) ctx.fill();
      // roof edge (dark band)
      ctx.fillStyle = '#0b101c';
      if (poly([-13, -14, 8, F.W + 13, -14, 8, F.W + 13, -14, 9.2, -13, -14, 9.2])) ctx.fill();
      if (poly([F.W + 13, -14, 8, F.W + 13, F.H + 14, 8, F.W + 13, F.H + 14, 9.2, F.W + 13, -14, 9.2])) ctx.fill();
      if (poly([-13, F.H + 14, 8, F.W + 13, F.H + 14, 8, F.W + 13, F.H + 14, 9.2, -13, F.H + 14, 9.2])) ctx.fill();
      // tier stripes on the stands
      ctx.fillStyle = '#263048';
      for (let row = 0; row < 7; row += 2) { const z1 = .2 + row * 1.08, z2 = z1 + 1.08, o1 = 3.6 + row * 1.45, o2 = o1 + 1.45;
        if (poly([-8, -o1, z1, F.W + 8, -o1, z1, F.W + 8, -o2, z2, -8, -o2, z2])) ctx.fill();
        if (poly([-8, F.H + o1, z1, F.W + 8, F.H + o1, z1, F.W + 8, F.H + o2, z2, -8, F.H + o2, z2])) ctx.fill();
        if (poly([F.W + o1 + 1, -8, z1, F.W + o1 + 1, F.H + 8, z1, F.W + o2 + 1, F.H + 8, z2, F.W + o2 + 1, -8, z2])) ctx.fill(); }
      // fans: shirts batched by colour, then heads in one batch
      const jump = excite > .85, step = quality < 1 ? 2 : 1;
      for (let i = 0; i < seats.length; i += step) { const c = seats[i]; const bob = jump ? Math.abs(Math.sin(now / 130 + c.ph)) * .45 : Math.max(0, Math.sin(now / 900 + c.ph)) * .06 * (1 + excite * 4); c.ok = pr(c.u, c.v, c.z + bob); if (c.ok) { c.sx = P.x; c.sy = P.y; c.k = P.k; if (c.sy < -10 || c.sy > H) c.ok = false; } }
      for (let col = 0; col < CROWD.length; col++) {
        ctx.fillStyle = CROWD[col]; ctx.beginPath();
        for (let i = 0; i < seats.length; i += step) { const c = seats[i]; if (!c.ok || c.c !== col) continue; const w = Math.max(1.5, c.k * .5); ctx.rect(c.sx - w / 2, c.sy - w * .9, w, w * 1.1); }
        ctx.fill();
      }
      ctx.fillStyle = '#c99b72'; ctx.beginPath();
      for (let i = 0; i < seats.length; i += step) { const c = seats[i]; if (!c.ok) continue; const w = Math.max(1.2, c.k * .3); ctx.rect(c.sx - w / 2, c.sy - c.k * .45 - w * 1.1, w, w); }
      ctx.fill();
      // roof floodlight rows
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { const v = -2 + i * (F.H + 4) / 6; if (pr(F.W + 13, v, 9.6)) { const g = P.k * 7; ctx.drawImage(glow, P.x - g / 2, P.y - g / 2, g, g); } }
      for (let i = 0; i < 8; i++) { const u = -4 + i * (F.W + 8) / 7; for (const v of [-14, F.H + 14]) if (pr(u, v, 9.6)) { const g = P.k * 7; ctx.drawImage(glow, P.x - g / 2, P.y - g / 2, g, g); } }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#f3f6ff';
      for (let i = 0; i < 7; i++) { const v = -2 + i * (F.H + 4) / 6; if (pr(F.W + 13, v, 9.6)) ctx.fillRect(P.x - P.k * .9, P.y - P.k * .3, P.k * 1.8, P.k * .6); }
    }
    function drawBoards(now) {
      const cols = ['#ffd23f', '#e8473b', '#16a34a', '#2f73d9'];
      for (const side of [0, 1]) {
        const v = side ? F.H + 1.8 : -1.8;
        for (let i = 0; i < 10; i++) {
          const u1 = -1 + i * 6.2, u2 = u1 + 6;
          ctx.fillStyle = cols[(i + side + Math.floor(now / 4000)) % cols.length];
          if (poly([u1, v, 0, u2, v, 0, u2, v, .85, u1, v, .85])) ctx.fill();
        }
      }
      // board text on the far side boards (only when big enough)
      ctx.fillStyle = '#0d1b2a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 10; i++) { const u = 2 + i * 6.2; if (!pr(u, F.H + 1.8, .42) || P.k < 8) continue; ctx.font = `800 ${Math.round(P.k * .55)}px system-ui,sans-serif`; ctx.fillText(i % 2 ? 'CHINA LIFE' : 'FOOTBALL FIELD', P.x, P.y); }
      for (let i = 0; i < 10; i++) { const u = 2 + i * 6.2; if (!pr(u, -1.8, .42) || P.k < 8) continue; ctx.font = `800 ${Math.round(P.k * .55)}px system-ui,sans-serif`; ctx.fillText(i % 2 ? 'FOOTBALL FIELD' : 'CHINA LIFE', P.x, P.y); }
    }
    function drawGrass() {
      ctx.fillStyle = '#1f6b37'; if (poly([-6, -3, 0, F.W + 6, -3, 0, F.W + 6, F.H + 3, 0, -6, F.H + 3, 0])) ctx.fill();
      const n = 12;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#2c8a46' : '#38a457'; const u1 = F.W * i / n, u2 = F.W * (i + 1) / n; if (poly([u1, 0, 0, u2, 0, 0, u2, F.H, 0, u1, F.H, 0])) ctx.fill(); }
      if (pr(F.W + 3, F.H / 2, 0)) { const y0 = Math.max(0, P.y), g = ctx.createLinearGradient(0, y0, 0, y0 + H * .35); g.addColorStop(0, 'rgba(8,20,30,.35)'); g.addColorStop(1, 'rgba(8,20,30,0)'); ctx.fillStyle = g; ctx.fillRect(0, y0, W, H * .35); }
    }
    function drawLines() {
      pr(cam.u, cam.v, 0); ctx.lineWidth = Math.max(1, P.k * .13); ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.lineJoin = 'round';
      ctx.beginPath();
      line(0, 0, 0, F.W, 0, 0); line(F.W, 0, 0, F.W, F.H, 0); line(F.W, F.H, 0, 0, F.H, 0); line(0, F.H, 0, 0, 0, 0); line(F.W / 2, 0, 0, F.W / 2, F.H, 0);
      for (const end of [0, 1]) {
        const g = end ? F.W : 0, d = end ? -1 : 1;
        for (const [dep, wid] of [[F.BOX_D, F.BOX_W], [F.SIX_D, F.SIX_W]]) { const a = F.H / 2 - wid / 2, b2 = F.H / 2 + wid / 2; line(g, a, 0, g + d * dep, a, 0); line(g + d * dep, a, 0, g + d * dep, b2, 0); line(g + d * dep, b2, 0, g, b2, 0); }
        // penalty arc
        let first = true; for (let i = 0; i <= 12; i++) { const a = -0.93 + 1.86 * i / 12, u = g + d * (6.5 + 5 * Math.cos(a)), v = F.H / 2 + 5 * Math.sin(a); if (Math.abs(u - g) < F.BOX_D) { first = true; continue; } if (!pr(u, v, 0)) continue; if (first) { ctx.moveTo(P.x, P.y); first = false; } else ctx.lineTo(P.x, P.y); }
      }
      let first = true; for (let i = 0; i <= 40; i++) { const a = TAU * i / 40; if (!pr(F.W / 2 + 5 * Math.cos(a), F.H / 2 + 5 * Math.sin(a), 0)) continue; if (first) { ctx.moveTo(P.x, P.y); first = false; } else ctx.lineTo(P.x, P.y); }
      for (const [cu, cv2] of [[0, 0], [F.W, 0], [0, F.H], [F.W, F.H]]) { first = true; for (let i = 0; i <= 6; i++) { const a = TAU / 4 * i / 6, u = cu + (cu ? -1 : 1) * Math.cos(a), v = cv2 + (cv2 ? -1 : 1) * Math.sin(a); if (!pr(u, v, 0)) continue; if (first) { ctx.moveTo(P.x, P.y); first = false; } else ctx.lineTo(P.x, P.y); } }
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const [u, v] of [[F.W / 2, F.H / 2], [6.5, F.H / 2], [F.W - 6.5, F.H / 2]]) if (pr(u, v, 0)) { ctx.beginPath(); ctx.ellipse(P.x, P.y, P.k * .25, P.k * .25 * st, 0, 0, TAU); ctx.fill(); }
    }
    function drawGoal(end, ballIn) {
      const g = end ? F.W : 0, d = end ? 1 : -1, a = F.H / 2 - F.GOAL / 2, b = F.H / 2 + F.GOAL / 2, back = g + d * F.NET, Hh = F.GOAL_H, bulge = ballIn ? .5 : 0;
      ctx.fillStyle = 'rgba(235,240,255,.13)';
      if (poly([back + d * bulge, a, 0, back + d * bulge, b, 0, back + d * bulge, b, Hh * .8, back + d * bulge, a, Hh * .8])) ctx.fill();
      if (poly([g, a, Hh, g, b, Hh, back, b, Hh * .8, back, a, Hh * .8])) ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const v = a + (b - a) * i / 10; line(g, v, Hh, back + d * bulge, v, Hh * .8); line(back + d * bulge, v, Hh * .8, back + d * bulge, v, 0); }
      for (let i = 0; i <= 4; i++) { const z = Hh * .8 * i / 4; line(back + d * bulge, a, z, back + d * bulge, b, z); line(g, a, z * 1.25 > Hh ? Hh : z * 1.25, back, a, z); line(g, b, z * 1.25 > Hh ? Hh : z * 1.25, back, b, z); }
      ctx.stroke();
      pr(g, F.H / 2, 0); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, P.k * .22); ctx.lineCap = 'round'; ctx.beginPath(); line(g, a, 0, g, a, Hh); line(g, a, Hh, g, b, Hh); line(g, b, Hh, g, b, 0); ctx.stroke(); ctx.lineCap = 'butt';
    }
    function drawLights() {
      for (const [u, v] of [[-10, -12], [F.W + 10, -12], [-10, F.H + 12], [F.W + 10, F.H + 12]]) {
        if (!pr(u, v, 0)) continue; const x0 = P.x, y0 = P.y; if (!pr(u, v, 17)) continue;
        ctx.strokeStyle = '#3a4357'; ctx.lineWidth = Math.max(1.5, P.k * .35); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(P.x, P.y); ctx.stroke();
        ctx.fillStyle = '#dfe6f5'; const w = P.k * 2.6, h = P.k * 1.1; ctx.fillRect(P.x - w / 2, P.y - h, w, h);
        const gs = P.k * 14; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow, P.x - gs / 2, P.y - h / 2 - gs / 2, gs, gs); ctx.globalCompositeOperation = 'source-over';
      }
    }
    // ---------- actors ----------
    const actors = [];
    function drawShadow(u, v, rx, alpha) { if (!pr(u, v, 0)) return; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.ellipse(P.x, P.y, rx * P.k, rx * P.k * st * .75, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    function drawPlayer(p, view, now) {
      const u = toU(p.x), v = toV(p.y); if (!pr(u, v, 0)) return; const x = P.x, y = P.y, K = P.k, k = K * 1.3, S = 1.3;
      const kit = KIT[p.team], gk = p.role === 'gk', shirt = gk ? kit.gk : kit.shirt, spd = Math.hypot(p.vx, p.vy);
      const skin = SKIN[(p.slot * 3 + p.team * 2) % SKIN.length], hair = HAIR[(p.slot + p.team) % HAIR.length];
      const ctrl = view.ctrlIds.has(p.id), mineCtrl = p.id === view.myCtrl;
      // screen-space facing (for slides/dives and the "looking" side)
      const fu = Math.cos(p.ang) * (flip ? -1 : 1), fv = Math.sin(p.ang) * (flip ? -1 : 1);
      if (ctrl) { ctx.strokeStyle = mineCtrl ? '#ffe14d' : 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(2, k * .14); ctx.beginPath(); ctx.ellipse(x, y, k * .95, k * .95 * st * .75, 0, 0, TAU); ctx.stroke();
        if (mineCtrl) { ctx.beginPath(); const tx = x + fv * k * 1.25, ty = y - fu * k * 1.25 * st * .75; ctx.fillStyle = '#ffe14d'; ctx.arc(tx, ty, Math.max(2, k * .16), 0, TAU); ctx.fill(); } }
      if (p.slide || p.dive) {
        const ang = p.dive ? (fv >= 0 ? 0 : Math.PI) + (p.vy * (flip ? -1 : 1) > 0 ? 0 : 0) : Math.atan2(-fu * st, fv);
        const dang = p.dive ? (Math.sign((flip ? -1 : 1) * p.vy) >= 0 ? 0 : Math.PI) : ang;
        const zc = p.dive ? .7 : .3; ctx.save(); ctx.translate(x, y - zc * S * K * st); ctx.rotate(dang);
        ctx.fillStyle = kit.shorts; ctx.fillRect(-k * .2, -k * .25, k * .5, k * .5);
        ctx.strokeStyle = skin; ctx.lineWidth = k * .2; ctx.beginPath(); ctx.moveTo(k * .3, -k * .1); ctx.lineTo(k * 1.1, -k * .15); ctx.moveTo(k * .3, k * .1); ctx.lineTo(k * 1.0, k * .25); ctx.stroke();
        ctx.fillStyle = shirt; ctx.fillRect(-k * .95, -k * .32, k * .8, k * .64);
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-k * 1.2, 0, k * .26, 0, TAU); ctx.fill();
        if (p.dive) { ctx.strokeStyle = gk ? '#fff' : skin; ctx.lineWidth = k * .18; ctx.beginPath(); ctx.moveTo(-k * 1, -k * .2); ctx.lineTo(-k * 1.7, -k * .45); ctx.moveTo(-k * 1, k * .2); ctx.lineTo(-k * 1.7, k * .45); ctx.stroke(); }
        ctx.restore(); return;
      }
      const run = Math.min(1, spd / 8), sw = Math.sin(p.touch * 2.2) * run, bob = Math.abs(sw) * k * .06;
      const hip = 0.9, sh = 1.55, w = .85;
      const hy = y - hip * S * K * st - bob, sy = y - sh * S * K * st - bob, hdy = y - 1.82 * S * K * st - bob;
      // legs
      ctx.strokeStyle = gk ? '#222' : kit.dark; ctx.lineWidth = Math.max(1.5, k * .2); ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(x - k * .14, hy); ctx.lineTo(x - k * .14 + sw * k * .32, y - k * .05); ctx.moveTo(x + k * .14, hy); ctx.lineTo(x + k * .14 - sw * k * .32, y - k * .05); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(x - k * .14 + sw * k * .32 - k * .12, y - k * .1, k * .24, k * .12); ctx.fillRect(x + k * .14 - sw * k * .32 - k * .12, y - k * .1, k * .24, k * .12);
      // shorts + shirt
      ctx.fillStyle = gk ? '#222' : kit.shorts; ctx.fillRect(x - k * w * .48, hy - k * .28, k * w * .96, k * .32);
      ctx.fillStyle = shirt; const top = sy - k * .05, bot = hy - k * .2;
      ctx.beginPath(); ctx.moveTo(x - k * w * .5, top + k * .1); ctx.lineTo(x + k * w * .5, top + k * .1); ctx.lineTo(x + k * w * .45, bot); ctx.lineTo(x - k * w * .45, bot); ctx.closePath(); ctx.fill();
      // arms
      ctx.strokeStyle = skin; ctx.lineWidth = Math.max(1.2, k * .14); ctx.beginPath(); ctx.moveTo(x - k * w * .52, top + k * .15); ctx.lineTo(x - k * w * .62 - sw * k * .15, top + k * .55); ctx.moveTo(x + k * w * .52, top + k * .15); ctx.lineTo(x + k * w * .62 + sw * k * .15, top + k * .55); ctx.stroke(); ctx.lineCap = 'butt';
      // number (on the back when running away from camera)
      if (k > 9) { ctx.fillStyle = gk ? '#13311f' : kit.num; ctx.font = `900 ${Math.round(k * .5)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(p.num), x, (top + bot) / 2 + k * .04); }
      // head
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, hdy, k * .27, 0, TAU); ctx.fill();
      ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, hdy - k * .04, k * .27, Math.PI * (fu > 0 ? .95 : 1.1), Math.PI * (fu > 0 ? 2.05 : 1.9)); ctx.fill();
      // tags: humans get names, my controlled player gets the arrow
      const human = view.humanIds.has(p.id) || ctrl;
      if (mineCtrl) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(x, hdy - k * .45); ctx.lineTo(x - k * .25, hdy - k * .85); ctx.lineTo(x + k * .25, hdy - k * .85); ctx.closePath(); ctx.fill(); }
      if (human && k > 6) {
        const name = mineCtrl ? 'YOU' : view.nameOf(p); ctx.font = `800 ${Math.max(9, Math.round(k * .42))}px system-ui,sans-serif`; const tw = ctx.measureText(name).width + 8, ty = hdy - k * (mineCtrl ? 1.2 : .7);
        ctx.fillStyle = mineCtrl ? 'rgba(20,20,10,.75)' : p.team ? 'rgba(23,74,154,.85)' : 'rgba(158,34,25,.85)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - tw / 2, ty - 8, tw, 15, 6); else ctx.rect(x - tw / 2, ty - 8, tw, 15); ctx.fill();
        ctx.fillStyle = mineCtrl ? '#ffe14d' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, x, ty);
      }
      // power meter / stamina for my controlled player
      if (mineCtrl && view.charge > 0) {
        const r = k * 1.1, cx2 = x + k * 1.25, cy2 = (top + hy) / 2; ctx.lineWidth = Math.max(4, k * .3);
        ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(cx2, cy2, r, Math.PI * .75, Math.PI * 2.25); ctx.stroke();
        const c = view.charge; ctx.strokeStyle = c > .9 ? '#ff4d4d' : c > .7 ? '#ffe14d' : '#7dff9a'; ctx.beginPath(); ctx.arc(cx2, cy2, r, Math.PI * .75, Math.PI * (.75 + 1.5 * c)); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); const za = Math.PI * (.75 + 1.5 * .9); ctx.moveTo(cx2 + Math.cos(za) * (r - 5), cy2 + Math.sin(za) * (r - 5)); ctx.lineTo(cx2 + Math.cos(za) * (r + 5), cy2 + Math.sin(za) * (r + 5)); ctx.stroke();
      }
      if (mineCtrl && p.stamina < .98) { const bw = k * 1.4; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - bw / 2, y + k * .35, bw, 3); ctx.fillStyle = p.stamina > .3 ? '#7dff9a' : '#ff8a3d'; ctx.fillRect(x - bw / 2, y + k * .35, bw * p.stamina, 3); }
    }
    const trail = [];
    function drawBall(b) {
      const u = toU(b.x), v = toV(b.y);
      if (!pr(u, v, b.z + F.BALL)) return; const x = P.x, y = P.y, r = Math.max(3.5, P.k * F.BALL * 1.55);
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 14 && trail.length > 1) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(trail[0][0], trail[0][1]); for (const t of trail) ctx.lineTo(t[0], t[1]); ctx.lineTo(x, y); ctx.stroke(); ctx.lineCap = 'butt'; }
      trail.push([x, y]); if (trail.length > 5) trail.shift();
      const g = ctx.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(1, '#c9ced6'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      // spinning panels along the travel direction
      const mvx = (flip ? -1 : 1) * b.vy, mvy = -(flip ? -1 : 1) * b.vx * st, mm = Math.hypot(mvx, mvy) || 1, dx = mvx / mm, dy = mvy / mm;
      ctx.fillStyle = '#1b1b1b';
      for (let i = 0; i < 3; i++) { const a = b.spin + i * 2.09, o = Math.sin(a) * r * .55, vis = Math.cos(a); if (vis < -.2) continue; const px = x + dx * o + -dy * (i - 1) * r * .35, py = y + dy * o + dx * (i - 1) * r * .35; ctx.beginPath(); ctx.arc(px, py, r * .26 * (.5 + .5 * Math.max(0, vis)), 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    }
    // ---------- particles ----------
    const parts = [];
    function confetti(n = 140, team = 0) {
      const cols = team ? ['#2f73d9', '#fff', '#ffe14d', '#7cc0ff'] : ['#e8473b', '#fff', '#ffe14d', '#ff9a8a'];
      for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: -10 - Math.random() * H * .4, vx: (Math.random() - .5) * 80, vy: 60 + Math.random() * 120, a: Math.random() * TAU, va: (Math.random() - .5) * 10, w: 5 + Math.random() * 5, c: cols[i % cols.length], life: 3.5 + Math.random() });
    }
    function puff(s, x, y, n = 8, color = 'rgba(200,230,180,.8)') { if (!prF(x, y, .1)) return; for (let i = 0; i < n; i++) parts.push({ x: P.x, y: P.y, vx: (Math.random() - .5) * 90, vy: -Math.random() * 60, a: 0, va: 0, w: P.k * .35, c: color, life: .5, dust: true }); }
    function drawParts(dt) {
      const k = dt / 1000;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= k; if (p.life <= 0 || p.y > H + 20) { parts.splice(i, 1); continue; }
        p.x += p.vx * k; p.y += p.vy * k; p.a += p.va * k; if (!p.dust) { p.vx += Math.sin(p.a) * 30 * k; } else p.vy += 120 * k;
        ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c;
        if (p.dust) { ctx.beginPath(); ctx.arc(p.x, p.y, p.w, 0, TAU); ctx.fill(); } else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
    }
    // ---------- mini-map ----------
    function drawMap(s, view) {
      const mw = 50, mh = 80, x0 = W - mw - 8, y0 = 58;
      ctx.globalAlpha = .82; ctx.fillStyle = '#123b22'; ctx.fillRect(x0, y0, mw, mh); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, mw - 1, mh - 1);
      ctx.beginPath(); ctx.moveTo(x0, y0 + mh / 2); ctx.lineTo(x0 + mw, y0 + mh / 2); ctx.stroke();
      const mp = (x, y) => [x0 + toV(y) / F.H * mw, y0 + mh - toU(x) / F.W * mh];
      for (const team of [0, 1]) { ctx.fillStyle = KIT[team].shirt; ctx.beginPath(); for (const p of s.players) { if (p.team !== team) continue; const [a, b] = mp(p.x, p.y); ctx.rect(a - 2, b - 2, 4, 4); } ctx.fill(); }
      const me = s.players.find((p) => p.id === view.myCtrl); if (me) { const [a, b] = mp(me.x, me.y); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1.5; ctx.strokeRect(a - 3, b - 3, 6, 6); }
      const [bx, by] = mp(s.ball.x, s.ball.y); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    // ---------- frame ----------
    let ft = 16, last = 0, ms = 0;
    function draw(s, view, dt) {
      const now = performance.now(); try { drawInner(s, view, dt, now); } finally { ms = ms * .92 + (performance.now() - now) * .08; }
    }
    function drawInner(s, view, dt, now) { if (last) { ft = ft * .95 + (now - last) * .05; } last = now;
      if (ms > 9 && ft > 22 && quality === 1 && now > 4000) { quality = .6; resize(); }
      flip = view.myTeam === 1; follow(s, dt, view.cam || {}); setupCam();
      drawSky(); drawLights(); drawStands(s, now, view.excite || 0); drawGrass(); drawBoards(now); drawLines();
      const b = s.ball, bu = toU(b.x), farEnd = 1; // the attacking goal is at u = F.W (far)
      const ballIn = s.phase === 'goal';
      drawGoal(farEnd, ballIn && bu > F.W);
      // shadows (one fill)
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      for (const p of s.players) drawShadow(toU(p.x), toV(p.y), p.slide || p.dive ? 1.4 : .75, 1);
      drawShadow(bu, toV(b.y), F.BALL * 1.2, Math.max(.15, .55 - b.z * .12));
      // depth-sorted actors (far first)
      actors.length = 0; for (const p of s.players) actors.push(p);
      actors.sort((a, c) => toU(c.x) - toU(a.x));
      let ballDrawn = false;
      for (const p of actors) { if (!ballDrawn && toU(p.x) < bu) { drawBall(b); ballDrawn = true; } drawPlayer(p, view, now); }
      if (!ballDrawn) drawBall(b);
      drawGoal(0, ballIn && bu < 0);
      drawParts(dt);
      if (view.letterbox) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34); }
      if (view.map !== false) drawMap(s, view);
    }
    return { resize, draw, confetti, puff, shake(n) { cam.shake = Math.max(cam.shake, n); }, snapCam(s, myTeam) { flip = myTeam === 1; cam.u = toU(s.ball.x); cam.v = F.H / 2; }, get fps() { return Math.round(1000 / ft); }, get ms() { return +ms.toFixed(2); }, get quality() { return quality; } };
  }
  // ---------- sound (synthesized) ----------
  const FBSound = (() => {
    let ac = null, master = null, crowdG = null, noise = null, on = true;
    try { on = localStorage.getItem('chinalife-football-sound') !== '0'; } catch {}
    function init() {
      if (ac || !on) return ac; const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
      try { ac = new AC(); } catch { return null; }
      master = ac.createGain(); master.gain.value = .8; master.connect(ac.destination);
      const len = ac.sampleRate * 2; noise = ac.createBuffer(1, len, ac.sampleRate); const d = noise.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; l = (l + .02 * w) / 1.02; d[i] = l * 3.5 + w * .15; }
      const src = ac.createBufferSource(); src.buffer = noise; src.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = .6; crowdG = ac.createGain(); crowdG.gain.value = .0; src.connect(bp); bp.connect(crowdG); crowdG.connect(master); src.start();
      crowdG.gain.setTargetAtTime(.06, ac.currentTime, .8);
      return ac;
    }
    const t = () => ac.currentTime;
    function env(node, peak, a, d, at = t()) { node.gain.setValueAtTime(0, at); node.gain.linearRampToValueAtTime(peak, at + a); node.gain.exponentialRampToValueAtTime(.0001, at + a + d); }
    function whistle(kind = 'short') {
      if (!ac || !on) return; const blasts = kind === 'full' ? [[0, .28], [.38, .28], [.76, .9]] : kind === 'kickoff' ? [[0, .55]] : [[0, .22]];
      for (const [st, du] of blasts) {
        const at = t() + st, o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
        o.frequency.value = 2900; o2.frequency.value = 3150; lfo.frequency.value = 38; lg.gain.value = 140; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        o.connect(g); o2.connect(g); g.connect(master); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.08, at + .02); g.gain.setValueAtTime(.08, at + du - .04); g.gain.linearRampToValueAtTime(0, at + du);
        for (const n of [o, o2, lfo]) { n.start(at); n.stop(at + du + .05); }
      }
    }
    function kick(power = .5) {
      if (!ac || !on) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(170, t()); o.frequency.exponentialRampToValueAtTime(48, t() + .1); o.connect(g); g.connect(master); env(g, .25 + power * .45, .004, .14); o.start(); o.stop(t() + .2);
      const n = ac.createBufferSource(), hp = ac.createBiquadFilter(), g2 = ac.createGain(); n.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 1800; n.connect(hp); hp.connect(g2); g2.connect(master); env(g2, .12 + power * .2, .002, .05); n.start(t(), Math.random()); n.stop(t() + .08);
    }
    function ping() { if (!ac || !on) return; for (const f of [1250, 1880, 2650]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f; o.connect(g); g.connect(master); env(g, .09, .002, .7); o.start(); o.stop(t() + .8); } }
    function swell(peak = .35, dur = 3.2, freq = 1100) { if (!ac || !on) return; const n = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = noise; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = .5; n.connect(bp); bp.connect(g); g.connect(master); g.gain.setValueAtTime(0, t()); g.gain.linearRampToValueAtTime(peak, t() + .18); g.gain.exponentialRampToValueAtTime(.0001, t() + dur); n.start(); n.stop(t() + dur + .1); }
    const cheer = () => swell(.42, 3.6, 1150), ooh = () => swell(.16, 1.1, 420);
    function crowd(level) { if (!ac || !crowdG || !on) return; crowdG.gain.setTargetAtTime(.04 + level * .09, t(), .4); }
    function stop() { if (!ac) return; const old = ac; try { crowdG?.gain.setTargetAtTime(0, t(), .15); } catch {} ac = null; crowdG = null; setTimeout(() => { try { old.close?.(); } catch {} }, 300); }
    function toggle() { on = !on; try { localStorage.setItem('chinalife-football-sound', on ? '1' : '0'); } catch {} if (!on) stop(); else init(); return on; }
    return { init, whistle, kick, ping, cheer, ooh, crowd, stop, toggle, get on() { return on; }, resume() { try { ac?.resume?.(); } catch {} } };
  })();
  root.ChinaLifeFootballRender = { create, sound: FBSound, KIT };
})(typeof window !== 'undefined' ? window : globalThis);
