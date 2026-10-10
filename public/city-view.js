// Reuse destination search; keep floating elements clear of the actual panel size.
const ui = document.getElementById('worldUI');
const dock = ui.querySelector('.world-dock');
const nav = ui.querySelector('.world-nav');
const sheet = document.getElementById('placeSheet');
const panelToggle = document.getElementById('panelToggle');
const heading = ui.querySelector('.venue-heading');
function syncPanelToggle() {
  const open = ui.classList.contains('dock-open');
  panelToggle.setAttribute('aria-expanded', String(open));
  panelToggle.setAttribute('aria-label', open ? 'Minimize info menu' : 'Expand info menu');
  panelToggle.textContent = open ? '⌄' : '⌃';
}
function togglePanel() {
  ui.classList.toggle('dock-open');
  syncPanelToggle();
  scheduleMeasure();
}
panelToggle.addEventListener('click', event => {event.stopPropagation(); togglePanel();});
// Keep the whole title row tappable, including inside a venue; preserve the details button.
heading.addEventListener('click', event => {
  if (event.target.closest('button')) return;
  event.stopImmediatePropagation();
  togglePanel();
}, true);
new MutationObserver(() => {syncPanelToggle(); scheduleMeasure();}).observe(ui, {attributes: true, attributeFilter: ['class']});
syncPanelToggle();
let pending = false;
function measurePanels() {
  pending = false;
  const dockHeight = dock.getBoundingClientRect().height;
  const navHeight = nav.getBoundingClientRect().height;
  const height = sheet.hidden ? dockHeight : Math.max(dockHeight, navHeight + sheet.getBoundingClientRect().height + 10);
  ui.style.setProperty('--dock-height', `${Math.ceil(height)}px`);
  ui.style.setProperty('--nav-height', `${Math.ceil(navHeight)}px`);
  document.documentElement.style.setProperty('--dock-height', `${Math.ceil(height)}px`);
  // On short portrait screens, put audio beside the map tools rather than stacking into them.
  const bounds = ui.getBoundingClientRect();
  const tools = ui.querySelector('.scene-tools').getBoundingClientRect();
  const panelTop = dock.getBoundingClientRect().top - Math.max(0, height - dockHeight);
  const portraitControls = bounds.width < 1000 && !(bounds.height <= 500 && bounds.width >= 501);
  const audioRailHeight = bounds.width > 600 ? 148 : 108;
  const compact = portraitControls && panelTop - audioRailHeight < tools.top + 154;
  if (ui.classList.contains('compact-controls') !== compact) ui.classList.toggle('compact-controls', compact);
}
function scheduleMeasure() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(measurePanels);
}
if (typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(scheduleMeasure);
  [dock, nav, sheet].forEach(element => observer.observe(element));
}
new MutationObserver(scheduleMeasure).observe(sheet, {attributes: true, attributeFilter: ['hidden']});
window.addEventListener('resize', scheduleMeasure);
window.visualViewport?.addEventListener('resize', scheduleMeasure);
measurePanels();
document.getElementById('destinationSearch').addEventListener('click', () => {
  if (!ui.classList.contains('search-open')) document.getElementById('mapSearchBtn').click();
  document.getElementById('mapSearchInput').focus();
});
