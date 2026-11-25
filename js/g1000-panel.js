// The mock G1000 (js/g1000.js) on the 3D panel: live PFD and MFD screens
// (js/g1000-display.js on canvas textures), and, in Operate mode, the
// bezel keys and knobs. js/viewer.js calls attach() once the model is
// built, tick() every frame and click() for left clicks while operating.
//
// The model has one part per kind of key or knob, covering both displays
// (and one part for all 24 softkeys), so which display, which softkey and
// which half of a concentric knob come from where the click lands.
window.G1000_PANEL = (function () {
  // Part id -> what it is in js/g1000.js.
  const KNOBS = {
    nav_frequency_knob: 'nav', com_frequency_knob: 'com', hdg_knob: 'hdg', alt_knob: 'alt',
    crs_baro_knob: 'crs_baro', fms_knob: 'fms', range_knob: 'range',
    nav_volume_knob: 'nav_volume', com_volume_knob: 'com_volume',
  };
  const KEYS = {
    nav_transfer_key: 'nav_transfer', com_transfer_key: 'com_transfer', direct_to_key: 'direct_to',
    fpl_key: 'fpl', clr_key: 'clr', ent_key: 'ent', menu_key: 'menu', proc_key: 'proc',
    ap_key: 'ap', fd_key: 'fd', hdg_key: 'hdg', alt_key: 'alt', nav_key: 'nav', vnv_key: 'vnv',
    apr_key: 'apr', bc_key: 'bc', vs_key: 'vs', flc_key: 'flc', nose_up_key: 'nose_up', nose_dn_key: 'nose_dn',
  };
  // Concentric knobs: the inner knob's radius is 4.7 mm, the outer's 6.6.
  const CONCENTRIC = new Set(['nav', 'com', 'alt', 'crs_baro', 'fms']);
  const INNER_R = 0.0050;
  // The PFD is on the pilot's side (+x), the MFD on the right (-x).
  const SPLIT_X = 0.025;
  const displayAt = (x) => (x > SPLIT_X ? 'pfd' : 'mfd');

  function attach({ THREE, scene, camera, renderer, meshes, meshById, flash }) {
    const G = window.G1000, D = window.G1000_DISPLAY;

    // ---- Screens: a canvas-textured plane just in front of each dark
    // screen quad (the untextured piece of the pfd and mfd parts). ----
    const screens = ['pfd', 'mfd'].map((id) => {
      const parent = meshById[id];
      const g = parent.geometry, pos = g.attributes.position;
      const group = g.groups.find((gr) => !parent.material[gr.materialIndex].map);
      const box = new THREE.Box3();
      for (let k = group.start; k < group.start + group.count; k++) {
        box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, g.index.getX(k)));
      }
      const canvas = document.createElement('canvas');
      canvas.width = D.W;
      canvas.height = D.H;
      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
      else texture.encoding = THREE.sRGBEncoding;
      const size = box.getSize(new THREE.Vector3());
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true }));
      // Facing aft, toward the pilot: the plane's +x then runs to the
      // pilot's right, which is the scene's -x.
      plane.rotation.y = Math.PI;
      plane.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.0003);
      plane.renderOrder = 1;
      scene.add(plane);
      return { id, parent, plane, canvas, ctx: canvas.getContext('2d'), texture };
    });

    // ---- Where on a part a click landed ----
    // Knob centres per display, from the part's vertices on that side.
    const centres = {};
    function centreOf(pid, display) {
      const key = pid + ':' + display;
      if (centres[key]) return centres[key];
      const pos = meshById[pid].geometry.attributes.position, box = new THREE.Box3(), v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (displayAt(v.x) === display) box.expandByPoint(v);
      }
      centres[key] = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, min: box.min.x, max: box.max.x };
      return centres[key];
    }
    // Softkeys: twelve evenly spaced, numbered from the pilot's left (+x).
    function softkeyAt(point, display) {
      const c = centreOf('softkeys', display);
      return Math.max(0, Math.min(11, Math.floor(((c.max - point.x) / (c.max - c.min)) * 12)));
    }

    const ray = new THREE.Raycaster();
    // The first visible, solid part under the pointer, if it is one the
    // mock operates: { pid, display, point, inner }.
    function controlAt(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1,
                          y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
      const hit = ray.intersectObjects(meshes.filter((m) => m.visible && !m.userData.part.glass))[0];
      if (!hit) return null;
      const pid = hit.object.userData.part.id;
      if (!(pid in KNOBS) && !(pid in KEYS) && pid !== 'softkeys') return null;
      const display = displayAt(hit.point.x);
      let inner = false;
      if (pid in KNOBS) {
        const c = centreOf(pid, display);
        inner = Math.hypot(hit.point.x - c.x, hit.point.y - c.y) < INNER_R;
      }
      return { pid, mesh: hit.object, display, point: hit.point, inner };
    }

    const name = (c) => {
      const knob = KNOBS[c.pid];
      const half = knob && CONCENTRIC.has(knob) ? (c.inner ? ' (inner)' : ' (outer)') : '';
      // The autopilot keys are only on the PFD; the rest are on both.
      const where = c.mesh.userData.part.system === 'autopilot' ? '' : ' · ' + c.display.toUpperCase();
      if (c.pid === 'softkeys') {
        const i = softkeyAt(c.point, c.display);
        const label = G.MENUS[G.menu(c.display)][i] || 'blank';
        return `Softkey ${i + 1} “${label}” · ${c.display.toUpperCase()}`;
      }
      return (I18N['part.' + c.pid] ?? c.pid) + half + where;
    };

    let operating = false;
    // Left click: press a key or softkey, push a knob. Returns the header
    // text for what was operated, or null if the click wasn't on a control.
    function click(e) {
      if (!operating) return null;
      const c = controlAt(e);
      if (!c) return null;
      // Named before pressing: a softkey's label changes with its menu.
      const said = name(c) + (c.pid in KNOBS ? ' · push' : '');
      // The MFD's autopilot keys belong to another unit's layout (context
      // parts, never hit); the PFD's are the GFC 700's.
      if (c.pid === 'softkeys') G.press('softkey:' + softkeyAt(c.point, c.display), c.display);
      else if (c.pid in KEYS) G.press(KEYS[c.pid], c.display);
      else G.push(KNOBS[c.pid], c.display);
      flash?.(c.mesh);
      redraw(true);
      return said;
    }

    // Scrolling over a knob turns it (scroll up: clockwise), instead of
    // zooming. Trackpads send many small deltas: they add up to steps.
    let wheelAcc = 0, onTurn = null;
    renderer.domElement.parentElement.addEventListener('wheel', (e) => {
      if (!operating) return;
      const c = controlAt(e);
      if (!c || !(c.pid in KNOBS)) return;
      e.preventDefault();
      e.stopPropagation();
      // A mouse wheel notch (about 100 px) is one click of the knob;
      // trackpad deltas add up to one.
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.sign(dy) !== Math.sign(wheelAcc)) wheelAcc = 0;
      wheelAcc += dy;
      if (Math.abs(wheelAcc) < 40) return;
      G.turn(KNOBS[c.pid], c.inner ? 'inner' : 'outer', wheelAcc < 0 ? 1 : -1, c.display);
      wheelAcc = 0;
      redraw(true);
      onTurn?.(name(c) + ' · turn');
    }, { capture: true, passive: false });

    // Flying by hand with the autopilot off: arrows for pitch and bank,
    // Page Up/Down for power. Not while a dialog or text field has focus.
    document.addEventListener('keydown', (e) => {
      if (!operating || e.target.matches('input, select, textarea')
        || document.querySelector('.modal:not([hidden])')) return;
      const input = { ArrowUp: { pitch: -0.5 }, ArrowDown: { pitch: 0.5 }, ArrowLeft: { roll: -3 },
        ArrowRight: { roll: 3 }, PageUp: { power: 0.05 }, PageDown: { power: -0.05 } }[e.key];
      if (!input) return;
      e.preventDefault();
      G.fly(input);
    });

    // ---- Every frame: the simulation, and the screens at ~15 Hz ----
    let lastT = performance.now(), lastDraw = 0;
    function redraw(force = false) {
      const now = performance.now();
      if (!force && now - lastDraw < 66) return;
      lastDraw = now;
      for (const s of screens) {
        (s.id === 'pfd' ? D.drawPFD : D.drawMFD)(s.ctx, G.state, G);
        s.texture.needsUpdate = true;
      }
    }
    function tick() {
      const now = performance.now();
      G.tick((now - lastT) / 1000);
      lastT = now;
      // The screens follow their display's part: hidden, faded by the
      // quiz's x-ray.
      for (const s of screens) {
        s.plane.visible = s.parent.visible;
        s.plane.material.opacity = s.parent.material[0].opacity;
      }
      redraw();
    }

    return {
      tick, click, redraw,
      get operating() { return operating; },
      setOperate(on) { operating = on; },
      onTurn(fn) { onTurn = fn; },
      reset() { G.reset(); redraw(true); },
      // For tools (tools/shot.py --js): where a part's control is.
      controlAt, softkeyAt, screens,
    };
  }

  return { attach, KNOBS, KEYS };
})();
