// "Where to?" replaces the city map while one-city mode is on (one-city.js). The map code is untouched: switching the
// layout back to "classic" in admin restores the Map button and the map view. Travel uses the game's own flow
// (ChinaLife.travel → travel sheet → arrival), so walking, taxis, fares and presence behave as before.
const OC = window.ChinaLifeOneCity, game = () => window.ChinaLife, $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = (n) => String(n).padStart(2, '0');
const COMPASS = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>';
let panel = null, mapButton = null, original = null, open = false, ours = null;

function placeName(id) {
  const l = game()?.locations?.find((p) => p[0] === id);
  return (l && l[1]) || OC.PLACES[id]?.label || id;
}
function counts() {
  const list = window.ChinaLifeCloud?.cityPlayers || [], out = {};
  for (const p of list) if (p?.place) out[p.place] = (out[p.place] || 0) + 1;
  return out;
}
function hoursText(id) {
  const [a, b] = OC.hoursOf ? OC.hoursOf(id) : OC.PLACES[id].hours;
  return a === 0 && b === 24 ? 'Open 24 hours' : pad(a) + ':00–' + pad(b % 24) + ':00';
}
function context() {
  const s = game()?.state || {};
  return {
    minutes: s.hour || 0,
    needs: s.needs || {},
    student: !!s.student,
    day: s.day || 1,
    here: s.place,
    friendsOnline: window.ChinaLifeSocial?.friendsOnline || 0,
    counts: counts(),
  };
}
function card(id, c, live) {
  const p = OC.PLACES[id], openNow = OC.isOpenAt(id, c.minutes), n = c.counts[id] || 0;
  return '<button class="wt-card" data-wt="' + id + '" data-kind="' + p.kind + '"' + (openNow ? '' : ' aria-disabled="true"') + '>' +
    '<span class="wt-icon" aria-hidden="true">' + p.icon + '</span>' +
    '<span class="wt-copy"><b>' + esc(placeName(id)) + '</b><small>' + esc(p.line) + '</small></span>' +
    '<span class="wt-meta"><i class="wt-open ' + (openNow ? 'on' : 'off') + '">' + (openNow ? 'Open' : 'Closed') + ' · ' + hoursText(id) + '</i>' +
    (live ? '<i class="wt-count">' + (n ? n + (n === 1 ? ' person' : ' people') + ' here' : 'Quiet now') + '</i>' : '') + '</span></button>';
}
function render() {
  if (!panel) return;
  const g = game(), s = g?.state || {}, c = context(), live = !!window.ChinaLifeCloud?.joined;
  const tips = OC.suggest(c), here = s.place;
  const clock = pad(Math.floor((s.hour || 0) / 60) % 24) + ':' + pad((s.hour || 0) % 60);
  const inVenue = !$('worldUI')?.classList.contains('map-view');
  panel.innerHTML =
    '<header class="wt-head"><div><span class="wt-kicker">' + esc(window.ChinaLifeCities?.[s.city]?.han || '中国') + ' · ' + esc(s.city === 'China' ? 'ChinaLife' : s.city || 'ChinaLife') + '</span>' +
    '<h2>Where to?</h2><p>' + clock + ' · Day ' + (s.day || 1) + ' · ¥' + Number(s.money || 0).toLocaleString() + '</p></div>' +
    (inVenue ? '<button class="wt-close" id="wtClose" aria-label="Close">×</button>' : '') + '</header>' +
    '<section class="wt-section" aria-label="Suggested for you"><h3>Suggested for you</h3><div class="wt-suggest">' +
    tips.map((t) => '<button class="wt-tip" data-wt="' + t.id + '"><span aria-hidden="true">' + OC.PLACES[t.id].icon + '</span><b>' + esc(placeName(t.id)) + '</b><small>' + esc(t.why) + '</small></button>').join('') +
    '</div></section>' +
    '<section class="wt-section" aria-label="All destinations"><h3>All destinations</h3><div class="wt-grid">' +
    OC.layout.places.map((id) => card(id, c, live)).join('') + '</div></section>' +
    '<button class="wt-home" data-wt="home"><span aria-hidden="true">🏠</span> ' + (here === 'home' || String(here).startsWith('home-') ? 'Stay home' : 'Go home') + '</button>';
  panel.querySelectorAll('[data-wt]').forEach((b) => (b.onclick = () => go(b.dataset.wt)));
  $('wtClose')?.addEventListener('click', hide);
}
function go(id) {
  const g = game();
  if (!g) return;
  if (window.ChinaLifeWorld?.busy) return g.toast('Finish your current action first.');
  if (id !== 'home' && OC.PLACES[id] && !OC.isOpenAt(id, g.state.hour)) return g.toast(placeName(id) + ' is closed now. ' + hoursText(id) + '.');
  hide();
  g.travel(id);
}
function show() {
  if (!OC.whereTo()) return;
  open = true;
  panel.hidden = false;
  document.body.classList.add('where-to-open');
  render();
}
function hide() {
  open = false;
  if (panel) panel.hidden = true;
  document.body.classList.remove('where-to-open');
}
// The Map button becomes "Where to?" in one-city mode, and goes back to the map in classic mode.
function applyButton() {
  mapButton = $('navMap');
  if (!mapButton) return;
  if (!original) original = { html: mapButton.innerHTML, onclick: mapButton.onclick };
  else if (mapButton.onclick && mapButton.onclick !== ours) original.onclick = mapButton.onclick;
  if (OC.whereTo()) {
    mapButton.innerHTML = '<span>' + COMPASS + '</span>Where to?';
    ours = ours || (() => (window.ChinaLifeWorld?.busy ? game()?.toast('Finish your current action first.') : show()));
    mapButton.onclick = ours;
    mapButton.setAttribute('aria-label', 'Where to?');
  } else {
    mapButton.innerHTML = original.html;
    mapButton.onclick = original.onclick;
    mapButton.removeAttribute('aria-label');
    hide();
  }
}
function init() {
  if (!OC || panel) return;
  panel = document.createElement('div');
  panel.id = 'whereTo';
  panel.className = 'where-to';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Where to?');
  panel.hidden = true;
  document.body.append(panel);
  applyButton();
  OC.onChange(applyButton);
  // Leaving a venue opens the street map in classic mode; in one-city mode the player lands on "Where to?" instead.
  const ui = $('worldUI');
  // A journey also switches to the street map (world.js journey): keep the trip in view, never cover it with the list.
  if (ui) new MutationObserver(() => {
    if (!OC.whereTo()) return;
    if (window.ChinaLifeWorld?.busy) { if (open) hide(); return; }
    if (ui.classList.contains('map-view') && game()?.state?.created) { if (!open) show(); else render(); }
  }).observe(ui, { attributes: true, attributeFilter: ['class'] });
  for (const e of ['chinalife:update', 'chinalife:players', 'chinalife:online']) window.addEventListener(e, () => open && render());
  setInterval(() => open && render(), 15000);
  if (ui?.classList.contains('map-view') && game()?.state?.created) show();
}
// go(id) is also used by Link Up (social.js) so Join/Go there travel exactly like a Where to? card (hours, busy check).
window.ChinaLifeWhereTo = { show, hide, render, go, get open() { return open; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
// world.js assigns the Map button's handler during its own setup; re-apply once everything has loaded.
window.addEventListener('load', applyButton);
