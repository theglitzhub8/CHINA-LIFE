// Reuse destination search; keep floating elements clear of the actual panel size.
const ui = document.getElementById('worldUI');
const dock = ui.querySelector('.world-dock');
const nav = ui.querySelector('.world-nav');
const sheet = document.getElementById('placeSheet');
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
  ui.classList.toggle('compact-controls', portraitControls && panelTop - audioRailHeight < tools.top + 154);
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
