// One-city mode (Oct 2026). ChinaLife runs as one city (China) with seven destinations, and a "Where to?" screen
// replaces the city map. Nothing is deleted: the other cities, venues, the map view and flights all stay in the code
// and come back when an admin switches the layout to "classic" (Cities tab, setting `world_layout`).
// Pure logic lives here so tests can run it in Node; the screen itself is where-to.js.
(function (root) {
  const ALL_CITIES = ['China', 'Shenyang', 'Guangzhou', 'Shenzhen', 'Beijing', 'Shanghai', 'Chengdu', 'Harbin'];
  // The seven destinations, mapped to existing venue ids in game.js. Hours are game time (Beijing clock in game).
  const PLACES = {
    night: { kind: 'club', icon: '🪩', label: 'Club', line: 'Afrobeats, Amapiano and neon nights', hours: [18, 4] },
    gist: { kind: 'gossip', icon: '🗣️', label: 'Gossip Room', line: 'Who said what, news and notices', hours: [8, 24] },
    voting: { kind: 'voting', icon: '🗳️', label: 'Voting Booth', line: 'Candidates, ballots and city votes', hours: [8, 20] },
    football: { kind: 'pitch', icon: '⚽', label: 'Football Pitch', line: 'Five-a-side under the floodlights', hours: [6, 23] },
    hq: { kind: 'hq', icon: '🏢', label: 'Hafrik HQ', line: 'Services, team and community help', hours: [9, 21] },
    cityhospital: { kind: 'hospital', icon: '🏥', label: 'Hospital', line: 'Check-ups, rest and recovery', hours: [0, 24] },
    university: { kind: 'university', icon: '🎓', label: 'University', line: 'Lectures, study and campus life', hours: [7, 22] },
  };
  // The one-city Club (venue id 'night'). Change the name here, or per server with world_layout.club_name (admin).
  // Classic mode keeps the original '007 Club' naming and its Shenyang dressing; nothing is deleted.
  const CLUB = Object.freeze({ name: 'Jollof & Neon', tagline: 'Afrobeats · Amapiano · all night', track: 'amapiano', bpm: 113, classic: '007 Club' });
  const clubLabel = (v) => String(v ?? '').replace(/[\u0000-\u001f<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const ORDER = ['night', 'gist', 'voting', 'football', 'hq', 'cityhospital', 'university'];
  // npcDensity: share of each venue's ambient crowd that is spawned (1 = the classic crowd). The founder asked for fewer
  // NPCs per venue on 27 Oct 2026, so one-city mode spawns 40% and keeps at most 2 hosts. NPC definitions are untouched.
  const NPC_DENSITY = 0.4;
  const DEFAULT = Object.freeze({ mode: 'one-city', city: 'China', places: ORDER, whereTo: true, flights: false, npcDensity: NPC_DENSITY, clubName: CLUB.name });
  const CLASSIC = Object.freeze({ mode: 'classic', city: null, places: null, whereTo: false, flights: true, npcDensity: 1, clubName: null });
  const density = (v, d) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? d : Math.max(0, Math.min(1, Number(v))));

  // Accepts the server value (snake_case JSON from chinalife_settings.world_layout) or a partial object.
  function normalise(v) {
    if (!v || typeof v !== 'object') return { ...DEFAULT, places: [...ORDER] };
    if (v.mode === 'classic') return { ...CLASSIC, npcDensity: density(v.npc_density ?? v.npcDensity, 1) };
    const places = Array.isArray(v.places) ? v.places.filter((id) => PLACES[id]) : [...ORDER];
    const city = ALL_CITIES.includes(v.city) ? v.city : DEFAULT.city;
    const whereTo = v.where_to ?? v.whereTo;
    return { mode: 'one-city', city, places: places.length ? places : [...ORDER], whereTo: whereTo !== false, flights: v.flights === true, npcDensity: density(v.npc_density ?? v.npcDensity, NPC_DENSITY), clubName: clubLabel(v.club_name ?? v.clubName) || CLUB.name };
  }
  let layout = normalise(null);
  const listeners = new Set();
  const set = (v) => {
    layout = normalise(v);
    listeners.forEach((f) => {
      try { f(layout); } catch {}
    });
    return layout;
  };
  const active = () => layout.mode === 'one-city';
  // Residences (home, owned homes) always stay reachable; so does a player's own campus/job venue (flags.js keepPlace).
  const clubName = () => (active() ? layout.clubName || CLUB.name : CLUB.classic);
  // One-city copy for club text written for the classic Shenyang map: 007 becomes the club name, Shenyang becomes China.
  const brand = (text) => {
    if (!active() || text === null || text === undefined) return text;
    const n = clubName();
    return String(text).replace(/\b007(?:\s+Night)?\s+Club\b/gi, n).replace(/\b007\b/g, n).replace(/C L U B {1,2}· {1,2}S H E N Y A N G/g, CLUB.tagline.toUpperCase()).replace(/\bShenyang\b/g, 'China');
  };
  const allows = (id) => !active() || layout.places.includes(id) || id === 'home' || String(id).startsWith('home-');

  const hourOf = (minutes) => Math.floor((Number(minutes) || 0) / 60) % 24;
  function isOpenAt(id, minutes) {
    const p = PLACES[id];
    if (!p) return true;
    const h = hourOf(minutes), [a, b] = p.hours;
    if (a === 0 && b === 24) return true;
    return a < b ? h >= a && h < b : h >= a || h < b;
  }
  // "Suggested for you": up to three destinations with a reason, from the time of day and the player's needs.
  // ctx: { minutes, needs:{energy,hunger,hygiene,bladder,fun,social}, friendsOnline, counts:{id:n}, student, day }
  function suggest(ctx = {}) {
    const n = ctx.needs || {}, h = hourOf(ctx.minutes), out = [];
    const add = (id, why, score) => {
      if (!layout.places.includes(id) || out.some((s) => s.id === id)) return;
      out.push({ id, why, score: score + (isOpenAt(id, ctx.minutes) ? 0 : -50) });
    };
    const low = (k, t) => typeof n[k] === 'number' && n[k] < t;
    if (low('energy', 25) || low('hygiene', 20) || low('hunger', 15)) add('cityhospital', 'You are running low. Get checked and rest', 90);
    if (ctx.friendsOnline > 0) add('gist', ctx.friendsOnline + (ctx.friendsOnline === 1 ? ' friend is' : ' friends are') + ' online. Catch up', 70);
    if (h >= 8 && h < 12) add('university', ctx.student ? 'Class time. Your lecture is on' : 'Morning lectures are on', ctx.student ? 80 : 55);
    if (h >= 14 && h < 17) add('university', 'Afternoon study session', 45);
    if (h >= 16 && h < 21) add('football', h >= 18 ? 'Floodlit match tonight' : 'Kick-off soon on the pitch', 60);
    if (h >= 20 || h < 3) add('night', h >= 22 || h < 3 ? 'The dance floor is full' : 'The night is starting', 65);
    if (low('fun', 35)) add(h >= 18 || h < 3 ? 'night' : 'football', 'You need some fun', 50);
    if (low('social', 35)) add('gist', 'You have been quiet. Go hear the news', 48);
    if (h >= 9 && h < 18) add('hq', 'Hafrik HQ is open for help and services', 30);
    if (ctx.electionOpen) add('voting', 'Voting is open. Have your say', 75);
    // Busy places pull people in.
    for (const [id, c] of Object.entries(ctx.counts || {})) if (c >= 3) add(id, c + ' people are there now', 40 + Math.min(c, 20));
    if (!out.length) add('gist', 'See what is happening today', 20);
    return out.sort((a, b) => b.score - a.score).slice(0, 3);
  }
  // A save in a disabled city moves to the active city on load. The old city and place are kept on the save
  // (cityBeforeOneCity / placeBeforeOneCity) so an admin or a later update can send the player back.
  function relocate(state, openCities) {
    if (!state || !state.created || !active()) return false;
    const open = Array.isArray(openCities) && openCities.length ? openCities : [layout.city];
    if (open.includes(state.city)) return false;
    const target = open.includes(layout.city) ? layout.city : open[0];
    if (!state.cityBeforeOneCity) {
      state.cityBeforeOneCity = state.city;
      state.placeBeforeOneCity = state.place;
    }
    state.city = target;
    state.place = 'home';
    return true;
  }
  // Preview copies (any path with /preview-) play offline with their own local saves; see docs/ONE-CITY.md.
  const loc = root.location;
  const preview = !!(loc && /\/preview-[^/]*\//.test(loc.pathname || ''));
  root.ChinaLifeSandbox = root.ChinaLifeSandbox || (preview ? { localOnly: true, storagePrefix: 'chinalife-preview:' } : null);
  // Admin control (game.js Cities tab and admin.js). Saves chinalife_settings.world_layout through admin.php.
  async function mountAdmin(el, adminCall, toast) {
    const d = await adminCall('world_layout');
    const cur = normalise(d.layout), classic = cur.mode === 'classic';
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    el.innerHTML = '<h3>World layout</h3><p class="fine-print">One city: only the venues ticked below are open and a Where to? board replaces the map. Classic turns every venue, the map and flights back on. Nothing is deleted. ' + (d.layout ? '' : 'Not saved yet, so players get the built-in one-city default.') + '</p>' +
      '<label class="admin-check"><input type="radio" name="wlMode" value="one-city" ' + (classic ? '' : 'checked') + '> One city</label>' +
      '<label class="admin-check"><input type="radio" name="wlMode" value="classic" ' + (classic ? 'checked' : '') + '> Classic (all cities, venues and map)</label>' +
      '<label>Active city<select id="wlCity">' + ALL_CITIES.map((c) => '<option ' + ((cur.city || 'China') === c ? 'selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label>' +
      ORDER.map((id) => '<label class="admin-check"><input type="checkbox" data-wl-place="' + id + '" ' + (classic || cur.places.includes(id) ? 'checked' : '') + '> ' + PLACES[id].icon + ' ' + esc(PLACES[id].label) + '</label>').join('') +
      '<label class="admin-check"><input type="checkbox" id="wlFlights" ' + (cur.flights ? 'checked' : '') + '> Allow flights between cities</label>' +
      '<label>Club name (one city)<input id="wlClub" maxlength="24" value="' + esc(cur.clubName || CLUB.name) + '"></label>' +
      '<label>NPC crowd per venue (%)<input id="wlNpc" type="number" min="0" max="100" step="5" value="' + Math.round(cur.npcDensity * 100) + '"></label>' +
      '<button id="wlSave" class="primary-btn btn primary">Save world layout</button>';
    el.querySelector('#wlSave').onclick = async () => {
      const mode = el.querySelector('[name=wlMode]:checked').value;
      const layoutOut = { mode, city: el.querySelector('#wlCity').value, places: [...el.querySelectorAll('[data-wl-place]:checked')].map((x) => x.dataset.wlPlace), where_to: mode === 'one-city', flights: mode === 'classic' || el.querySelector('#wlFlights').checked, npc_density: density(Number(el.querySelector('#wlNpc').value) / 100, cur.npcDensity) };
      const club = clubLabel(el.querySelector('#wlClub').value);
      if (club && club !== CLUB.name) layoutOut.club_name = club;
      if (!layoutOut.places.length) return toast('Keep at least one venue open.');
      if (!confirm(mode === 'classic' ? 'Switch back to the classic map and every venue?' : 'One city: ' + layoutOut.city + ' with ' + layoutOut.places.length + ' venues?')) return;
      try { const r = await adminCall('set_world_layout', { layout: layoutOut }); set(r.layout); toast('World layout saved.'); mountAdmin(el, adminCall, toast); } catch (e) { toast(e.message); }
    };
  }
  root.ChinaLifeOneCity = {
    PLACES, ORDER, ALL_CITIES, DEFAULT, CLASSIC,
    normalise, set, get layout() { return layout; }, active, allows,
    whereTo: () => active() && layout.whereTo, flights: () => !active() || layout.flights,
    // Venue crowd share for world.js; localStorage 'chinalife-npc-density' (0–1) overrides it for testing.
    npcDensity: () => {
      try { const o = root.localStorage?.getItem('chinalife-npc-density'); if (o !== null && o !== undefined && o !== '') return density(o, layout.npcDensity); } catch {}
      return layout.npcDensity ?? 1;
    },
    NPC_DENSITY, CLUB, clubName, brand,
    isOpenAt, hourOf, suggest, relocate, mountAdmin,
    onChange: (f) => (listeners.add(f), () => listeners.delete(f)),
  };
})(typeof window !== 'undefined' ? window : globalThis);
