// Reuse the existing destination search, including its filters and travel flow.
document.getElementById('destinationSearch').addEventListener('click', () => {
  const ui = document.getElementById('worldUI');
  if (!ui.classList.contains('search-open')) document.getElementById('mapSearchBtn').click();
  document.getElementById('mapSearchInput').focus();
});
