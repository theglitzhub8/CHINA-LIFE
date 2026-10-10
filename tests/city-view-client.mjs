import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

function preview() {
  const {document} = parseHTML(fs.readFileSync('public/index.html', 'utf8'));
  const ui = document.getElementById('worldUI');
  const bounds = {width: 390, height: 844, dockHeight: 196, sheetHeight: 280};
  ui.getBoundingClientRect = () => ({width: bounds.width, height: bounds.height});
  ui.querySelector('.world-dock').getBoundingClientRect = () => ({height: bounds.dockHeight, top: bounds.height - bounds.dockHeight - 10});
  ui.querySelector('.world-nav').getBoundingClientRect = () => ({height: 56});
  ui.querySelector('.scene-tools').getBoundingClientRect = () => ({top: 96});
  document.getElementById('placeSheet').getBoundingClientRect = () => ({height: bounds.sheetHeight});
  const frames = [], handlers = {}; let resize, mutation;
  const context = vm.createContext({document, requestAnimationFrame: fn => frames.push(fn),
    ResizeObserver: class {constructor(fn) {resize = fn;} observe() {}},
    MutationObserver: class {constructor(fn) {mutation = fn;} observe() {}},
    window: {addEventListener: (name, fn) => {handlers[name] = fn;}, visualViewport: {addEventListener() {}}},
  });
  vm.runInContext(fs.readFileSync('public/city-view.js', 'utf8'), context);
  return {document, ui, bounds, resize: () => resize(), mutation: () => mutation(), flush: () => {while (frames.length) frames.shift()();}, frames, handlers};
}

test('floating UI measures expanded docks and place sheets, and prevents short-screen control collisions', () => {
  const p = preview();
  assert.equal(p.ui.style.getPropertyValue('--dock-height'), '196px');
  p.bounds.dockHeight = 298; p.resize(); p.resize();
  assert.equal(p.frames.length, 1, 'resize observations coalesce into one frame');
  p.flush();
  assert.equal(p.ui.style.getPropertyValue('--dock-height'), '298px');
  p.document.getElementById('placeSheet').hidden = false;
  p.bounds.sheetHeight = 350; p.mutation(); p.flush();
  assert.equal(p.ui.style.getPropertyValue('--dock-height'), '416px');
  assert.equal(p.document.documentElement.style.getPropertyValue('--dock-height'), '416px', 'toasts outside the scene receive the measured height');
  p.bounds.width = 320; p.bounds.height = 568; p.handlers.resize(); p.flush();
  assert.equal(p.ui.classList.contains('compact-controls'), true);
  p.bounds.width = 568; p.bounds.height = 320; p.handlers.resize(); p.flush();
  assert.equal(p.ui.classList.contains('compact-controls'), false, 'landscape uses its own audio rail');
  p.document.getElementById('placeSheet').hidden = true;
  p.bounds.dockHeight = 196; p.mutation(); p.flush();
  assert.equal(p.ui.style.getPropertyValue('--dock-height'), '196px');
});

test('destination button focuses existing search without closing an already open search', () => {
  const p = preview(); let opened = 0, focused = 0;
  p.document.getElementById('mapSearchBtn').click = () => {opened++; p.ui.classList.add('search-open');};
  p.document.getElementById('mapSearchInput').focus = () => {focused++;};
  const button = p.document.getElementById('destinationSearch');
  button.click(); button.click();
  assert.equal(opened, 1);
  assert.equal(focused, 2);
});
