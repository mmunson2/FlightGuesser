// The KPAE airport diagram (data/kpae-diagram.png, the FAA's AL-142) as a
// flat picture over the stage: drag to pan, scroll to zoom about the
// pointer, double-click to fit. js/viewer.js shows and hides it.
window.DIAGRAM = (function () {
  const box = document.getElementById('diagram');
  const img = box.querySelector('img');
  let scale = 1, x = 0, y = 0, fitted = false, drag = null;

  const apply = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; };
  function fit() {
    if (!img.naturalWidth || !box.clientWidth) return;
    scale = Math.min(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight);
    x = (box.clientWidth - img.naturalWidth * scale) / 2;
    y = (box.clientHeight - img.naturalHeight * scale) / 2;
    fitted = true;
    apply();
  }
  // Zoom by `factor` keeping the picture's point under (px, py) in place.
  function zoom(factor, px, py) {
    const min = Math.min(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight) / 2;
    const next = Math.min(4, Math.max(min, scale * factor));
    x = px - ((px - x) * next) / scale;
    y = py - ((py - y) * next) / scale;
    scale = next;
    apply();
  }
  box.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = box.getBoundingClientRect();
    zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  box.addEventListener('pointerdown', (e) => {
    drag = { px: e.clientX, py: e.clientY, x, y };
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    x = drag.x + e.clientX - drag.px;
    y = drag.y + e.clientY - drag.py;
    apply();
  });
  box.addEventListener('pointerup', () => { drag = null; });
  box.addEventListener('dblclick', fit);
  img.addEventListener('load', () => { if (!box.hidden) fit(); });
  window.addEventListener('resize', () => { if (!box.hidden) fit(); });

  return {
    // Load the picture the first time it is shown (a phone, sent to the
    // notecards, never fetches it), and fit it then (it has no size while
    // hidden).
    show() {
      if (!img.getAttribute('src')) img.src = img.dataset.src;
      else if (!fitted) fit();
    },
    fit,
    state: () => ({ scale, x, y, loaded: img.complete && img.naturalWidth > 0 }),
  };
})();
