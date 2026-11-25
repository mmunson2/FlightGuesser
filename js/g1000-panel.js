// The mock G1000 (js/g1000.js) on the 3D panel: live PFD and MFD screens
// (js/g1000-display.js on canvas textures), live standby instrument faces
// (js/g1000-standby.js), and, in Operate mode, the
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
    // The standby altimeter's Kollsman knob (only its knob: see STBY_KNOB).
    standby_altimeter: 'stby_baro',
    // The audio panel's volume (small) and squelch (large) knob.
    audio_volume_knob: 'gma_vol',
  };
  // The standby altimeter is one part, gauge and knob; the knob is the only
  // piece that stands proud of the bezel (in front of this depth).
  const STBY = 'standby_altimeter', STBY_KNOB_Z = 0.36;
  const KEYS = {
    nav_transfer_key: 'nav_transfer', com_transfer_key: 'com_transfer', direct_to_key: 'direct_to',
    fpl_key: 'fpl', clr_key: 'clr', ent_key: 'ent', menu_key: 'menu', proc_key: 'proc',
    ap_key: 'ap', fd_key: 'fd', hdg_key: 'hdg', alt_key: 'alt', nav_key: 'nav', vnv_key: 'vnv',
    apr_key: 'apr', bc_key: 'bc', vs_key: 'vs', flc_key: 'flc', nose_up_key: 'nose_up', nose_dn_key: 'nose_dn',
    // The audio panel (js/g1000-gma.js): com1_mic_key -> 'gma:com1_mic'.
    ...Object.fromEntries(G1000_GMA.KEYS.map((k) => [k + '_key', 'gma:' + k])),
    // The red DISPLAY BACKUP button: not a part of its own (see BACKUP).
    display_backup: 'display_backup',
  };
  // The audio panel is one unit in the middle: its parts straddle the
  // displays' split, so they aren't split by display. Its volume knob's
  // part also holds the red DISPLAY BACKUP button below it (under
  // AUDIO_KNOB_Y): a hit there is the button, the control 'display_backup'
  // on the knob's mesh.
  const AUDIO = new Set([...G1000_GMA.KEYS.map((k) => k + '_key'), 'audio_volume_knob']);
  const AUDIO_KNOB = 'audio_volume_knob', AUDIO_KNOB_Y = -0.02, BACKUP = 'display_backup';
  // Whether a vertex at (x, y, z) belongs to a part's control on `display`.
  const onControl = (pid, display, x, y, z) => (pid === STBY ? z < STBY_KNOB_Z
    : pid === AUDIO_KNOB ? y > AUDIO_KNOB_Y : pid === BACKUP ? y < AUDIO_KNOB_Y
      : AUDIO.has(pid) || displayAt(x) === display);
  // Concentric knobs: the inner knob's radius is 4.7 mm, the outer's 6.
  // Their zones are bigger than the knobs, to be easy to hit: the inner
  // knob within INNER_ZONE of the centre, the outer out to OUTER_ZONE (the
  // nearest other control is 16 mm away), panel around it included.
  const CONCENTRIC = new Set(['nav', 'com', 'alt', 'crs_baro', 'fms', 'gma_vol']);
  const INNER_ZONE = 0.0055, OUTER_ZONE = 0.012, INNER_KNOB = 0.0049;
  // The PFD is on the pilot's side (+x), the MFD on the right (-x).
  const SPLIT_X = 0.025;
  const displayAt = (x) => (x > SPLIT_X ? 'pfd' : 'mfd');

  function attach({ THREE, scene, camera, renderer, controls, meshes, meshById, highlight = 0x36c2ff }) {
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

    // ---- Standby instruments: a live face (js/g1000-standby.js) on a
    // disc inside each bezel, in front of the model's own fixed needles.
    // The dial's centre: midway across, and half the width down from the
    // top (the bottom has the knob). Radius and depth from the models:
    // the bezel lip is 32 mm out, 0.3652 deep; the dials sit at 0.3685
    // or more. The attitude indicator's bezel reaches in to 26 mm. ----
    const SB = window.G1000_STANDBY;
    const gauges = Object.keys(SB.draw).filter((id) => meshById[id]).map((id) => {
      const parent = meshById[id], box = new THREE.Box3().setFromObject(parent);
      const w = box.max.x - box.min.x;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SB.SIZE;
      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
      else texture.encoding = THREE.sRGBEncoding;
      const r = id === 'standby_attitude_indicator' ? 0.0255 : 0.0305;
      const plane = new THREE.Mesh(new THREE.CircleGeometry(r, 64),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true }));
      // Facing the pilot, like the screens.
      plane.rotation.y = Math.PI;
      plane.position.set((box.min.x + box.max.x) / 2, box.max.y - w / 2, 0.3664);
      plane.renderOrder = 1;
      scene.add(plane);
      return { id, parent, plane, ctx: canvas.getContext('2d'), texture };
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
        // The standby altimeter: its knob only, whichever side; the audio
        // panel's parts whole.
        if (onControl(pid, display, v.x, v.y, v.z)) box.expandByPoint(v);
      }
      centres[key] = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2,
                       z: (box.min.z + box.max.z) / 2, front: box.min.z, min: box.min.x, max: box.max.x };
      return centres[key];
    }
    // Softkeys: twelve evenly spaced, numbered from the pilot's left (+x).
    function softkeyAt(point, display) {
      const c = centreOf('softkeys', display);
      return Math.max(0, Math.min(11, Math.floor(((c.max - point.x) / (c.max - c.min)) * 12)));
    }

    // Lighting one control: a part covers its key or knob on both displays
    // (and all twelve softkeys), so a pressed one lights through an overlay
    // of just its own triangles: the part's on that display, and for a
    // softkey those in its twelfth. Same textures, tinted like a selection.
    const pieces = {};
    function pieceOf(c) {
      const slot = c.pid === 'softkeys' ? softkeyAt(c.point, c.display) : -1;
      // A concentric knob lights only the half in use.
      const half = CONCENTRIC.has(KNOBS[c.pid]) ? (c.inner ? 'inner' : 'outer') : '';
      const key = c.pid + ':' + c.display + ':' + slot + ':' + half;
      if (pieces[key]) return pieces[key];
      const mesh = c.mesh, g = mesh.geometry, pos = g.attributes.position, idx = g.index;
      const sk = slot >= 0 && centreOf('softkeys', c.display);
      const mine = (t) => {
        let x = 0, y = 0, z = 0;
        for (let j = 0; j < 3; j++) {
          const i = idx.getX(t + j);
          x += pos.getX(i) / 3; y += pos.getY(i) / 3; z += pos.getZ(i) / 3;
        }
        // The standby altimeter's knob: its triangles in front of the bezel.
        if (c.pid === STBY) return [0, 1, 2].every((j) => pos.getZ(idx.getX(t + j)) < STBY_KNOB_Z);
        if (!onControl(c.pid, c.display, x, y, z)) return false;
        if (half) {
          // The inner knob: triangles all within its 4.7 mm radius.
          const k = centreOf(c.pid, c.display);
          let far = 0;
          for (let j = 0; j < 3; j++) {
            const i = idx.getX(t + j);
            far = Math.max(far, Math.hypot(pos.getX(i) - k.x, pos.getY(i) - k.y));
          }
          if ((far < INNER_KNOB) !== (half === 'inner')) return false;
        }
        return slot < 0 || Math.max(0, Math.min(11, Math.floor(((sk.max - x) / (sk.max - sk.min)) * 12))) === slot;
      };
      const geom = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(g.attributes)) geom.setAttribute(name, attr);
      const index = [];
      const groups = g.groups.length ? g.groups : [{ start: 0, count: idx.count, materialIndex: 0 }];
      for (const gr of groups) {
        const start = index.length;
        for (let t = gr.start; t < gr.start + gr.count; t += 3) {
          if (mine(t)) index.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
        }
        if (index.length > start) geom.addGroup(start, index.length - start, gr.materialIndex);
      }
      geom.setIndex(index);
      const mats = [mesh.material].flat().map((m) => {
        const lit = m.clone();
        lit.color.setHex(highlight);
        lit.emissive?.setHex(highlight).multiplyScalar(0.45);
        // Drawn over the part's own, identical triangles.
        lit.polygonOffset = true;
        lit.polygonOffsetFactor = -1;
        lit.polygonOffsetUnits = -4;
        return lit;
      });
      const piece = new THREE.Mesh(geom, mats);
      piece.visible = false;
      // A child of the part: same transform, and hidden with it.
      mesh.add(piece);
      return (pieces[key] = piece);
    }
    function flash(c) {
      const piece = pieceOf(c);
      piece.visible = true;
      clearTimeout(piece.userData.off);
      piece.userData.off = setTimeout(() => { piece.visible = false; }, 150);
    }

    // ---- The audio panel's annunciators: each key's part has a small box
    // at its top (the top 1.3 mm), printed with a white triangle. A green
    // triangle over its face shows the key is on (js/g1000-gma.js lit()). ----
    const leds = G1000_GMA.KEYS.filter((k) => meshById[k + '_key']).map((key) => {
      const parent = meshById[key + '_key'], pos = parent.geometry.attributes.position;
      const all = new THREE.Box3().setFromBufferAttribute(pos), box = new THREE.Box3(), v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (v.y > all.max.y - 0.0013) box.expandByPoint(v);
      }
      const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(0, -h / 2); shape.closePath();
      const led = new THREE.Mesh(new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: 0x3dff6a, toneMapped: false, side: THREE.DoubleSide }));
      led.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.0002);
      led.visible = false;
      led.renderOrder = 1;
      scene.add(led);
      return { key, parent, led };
    });

    const ray = new THREE.Raycaster();
    // The first visible, solid part under the pointer, if it is one the
    // mock operates: { pid, display, point, inner }.
    function controlAt(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1,
                          y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
      const hit = ray.intersectObjects(meshes.filter((m) => m.visible && !m.userData.part.glass), false)[0];
      const pid = hit?.object.userData.part.id;
      // The standby altimeter operates only by its knob (within 8 mm of it).
      if (pid === STBY) {
        const k = centreOf(STBY, 'mfd');
        if (Math.hypot(hit.point.x - k.x, hit.point.y - k.y) > 0.008) return zoneAt(hit);
      }
      if (pid === AUDIO_KNOB && hit.point.y < AUDIO_KNOB_Y) {
        return { pid: BACKUP, mesh: hit.object, display: displayAt(hit.point.x), point: hit.point, inner: false };
      }
      if (hit && ((pid in KEYS) || pid === 'softkeys' || ((pid in KNOBS) && !CONCENTRIC.has(KNOBS[pid])))) {
        return { pid, mesh: hit.object, display: displayAt(hit.point.x), point: hit.point, inner: false };
      }
      return zoneAt(hit);
    }
    // A concentric knob's zone under the pointer (ray set), unless something
    // nearer than the knob's face is in the way.
    const ZONED = Object.keys(KNOBS).filter((pid) => CONCENTRIC.has(KNOBS[pid]));
    const facePlane = new THREE.Plane(), onFace = new THREE.Vector3();
    function zoneAt(hit) {
      for (const pid of ZONED) {
        if (!meshById[pid].visible) continue;
        for (const display of ['pfd', 'mfd']) {
          const k = centreOf(pid, display);
          facePlane.set(new THREE.Vector3(0, 0, -1), k.front);
          if (!ray.ray.intersectPlane(facePlane, onFace)) continue;
          const d = Math.hypot(onFace.x - k.x, onFace.y - k.y);
          if (d > OUTER_ZONE) continue;
          if (hit && hit.object !== meshById[pid] && hit.distance < ray.ray.origin.distanceTo(onFace) - 0.003) return null;
          return { pid, mesh: meshById[pid], display, point: onFace.clone(), inner: d < INNER_ZONE };
        }
      }
      return null;
    }

    const name = (c) => {
      const knob = KNOBS[c.pid];
      const half = knob && CONCENTRIC.has(knob) ? (c.inner ? ' (inner)' : ' (outer)') : '';
      // The autopilot keys are only on the PFD, the audio panel is one;
      // the rest are on both.
      const where = ['autopilot', 'audio_panel'].includes(c.mesh.userData.part.system) ? '' : ' · ' + c.display.toUpperCase();
      if (c.pid === STBY) return 'Standby altimeter knob (baro)';
      if (c.pid === BACKUP) return 'DISPLAY BACKUP button';
      if (c.pid === 'softkeys') {
        const i = softkeyAt(c.point, c.display);
        const label = G.labels(c.display)[i] || 'blank';
        return `Softkey ${i + 1} “${label}” · ${c.display.toUpperCase()}`;
      }
      return (I18N['part.' + c.pid] ?? c.pid) + half + where;
    };

    let operating = false;
    // Left click: press a key or softkey, push a knob. Returns the header
    // text for what was operated, or null if the click wasn't on a control.
    function click(e) {
      if (!operating) return null;
      // The end of a drag that turned a knob: not a push.
      if (turnedAt && performance.now() - turnedAt < 50) return lastSaid;
      const c = controlAt(e);
      if (!c) return null;
      // Named before pressing: a softkey's label changes with its menu.
      const said = name(c) + (c.pid in KNOBS ? ' · push' : '');
      // The MFD's autopilot keys belong to another unit's layout (context
      // parts, never hit); the PFD's are the GFC 700's.
      if (c.pid === 'softkeys') G.press('softkey:' + softkeyAt(c.point, c.display), c.display);
      else if (c.pid in KEYS) G.press(KEYS[c.pid], c.display);
      else G.push(KNOBS[c.pid], c.display);
      flash(c);
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

    // Dragging on a knob turns it: the pointer's angle around the knob's
    // centre on screen, one click per STEP of it (clockwise on screen is
    // clockwise, as the panel faces the camera). The camera stays put.
    const STEP = Math.PI / 12, MIN_R = 6;
    let drag = null, turnedAt = 0, lastSaid = null;
    function screenCentre(c) {
      const k = centreOf(c.pid, c.display);
      const p = new THREE.Vector3(k.x, k.y, k.z).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
    }
    const angleAt = (d, e) => {
      const dx = e.clientX - d.centre.x, dy = e.clientY - d.centre.y;
      return Math.hypot(dx, dy) < MIN_R ? null : Math.atan2(dy, dx);
    };
    // The knob overlay: a canvas-textured plane in front of a knob. On a
    // concentric knob, hovered or turning, it shades the zone in use and
    // labels it INNER or OUTER. Turning, an arc around the pointer's angle
    // with an arrowhead shows the way it is going.
    const OVER_PX = 512, OVER_M = 0.06, MM = OVER_PX / OVER_M / 1000;
    const overCanvas = document.createElement('canvas');
    overCanvas.width = overCanvas.height = OVER_PX;
    const overCtx = overCanvas.getContext('2d');
    const overTex = new THREE.CanvasTexture(overCanvas);
    if ('colorSpace' in overTex) overTex.colorSpace = THREE.SRGBColorSpace;
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(OVER_M, OVER_M),
      new THREE.MeshBasicMaterial({ map: overTex, transparent: true, depthTest: false, depthWrite: false,
        toneMapped: false, side: THREE.DoubleSide }));
    // Facing aft like the screens, so canvas x runs to the pilot's right and
    // canvas angles match the pointer's on screen.
    overlay.rotation.y = Math.PI;
    overlay.renderOrder = 10;
    overlay.visible = false;
    scene.add(overlay);
    let fadeFrom = 0, shown = null;
    // c: the control; d: the drag, if turning.
    function drawOverlay(c, d) {
      const ctx = overCtx, k = centreOf(c.pid, c.display), zoned = CONCENTRIC.has(KNOBS[c.pid]);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, OVER_PX, OVER_PX);
      // Millimetres from the knob's centre.
      ctx.setTransform(MM, 0, 0, MM, OVER_PX / 2, OVER_PX / 2);
      ctx.lineCap = ctx.lineJoin = 'round';
      // Each shape twice: a dark outline, then white on it.
      const both = (path, width, alpha, fill) => {
        for (const [style, w] of [['rgba(0,0,0,0.7)', width + 1.2], ['#ffffff', width]]) {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = ctx.fillStyle = style;
          ctx.lineWidth = w;
          path();
          ctx.stroke();
          if (fill) ctx.fill();
        }
      };
      const circle = (r) => () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); };
      const inR = INNER_ZONE * 1000, outR = OUTER_ZONE * 1000;
      if (zoned) {
        // Both zones' edges faintly, the one in use shaded and outlined.
        both(circle(inR), 0.4, 0.35);
        both(circle(outR), 0.4, 0.35);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, c.inner ? inR : outR, 0, 2 * Math.PI);
        if (!c.inner) ctx.arc(0, 0, inR, 0, 2 * Math.PI, true);
        ctx.fill();
        both(circle(c.inner ? inR : outR), 0.7, 1);
        if (!c.inner) both(circle(inR), 0.7, 1);
        // The label above the knob.
        ctx.font = 'bold 5px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.fillStyle = '#ffffff';
        const label = c.inner ? 'INNER' : 'OUTER';
        ctx.strokeText(label, 0, -outR - 1.5);
        ctx.fillText(label, 0, -outR - 1.5);
      }
      if (!d) { overTex.needsUpdate = true; return; }
      // The turn: inner knob's arrow on its face, the outer's outside its zone.
      const r = zoned ? (c.inner ? inR - 1.5 : outR + 2.5) : (k.max - k.min) * 500 + 4.5;
      if (!zoned) both(circle(r), 1, 0.45);
      if (d.dir && d.last != null) {
        // A 100° arc behind the pointer, the head at the pointer.
        const head = d.last, tail = head - d.dir * (100 * Math.PI / 180);
        const hx = r * Math.cos(head), hy = r * Math.sin(head);
        // Tangent along the turn, and the outward normal.
        const tx = -Math.sin(head) * d.dir, ty = Math.cos(head) * d.dir;
        const nx = Math.cos(head), ny = Math.sin(head);
        const w = c.inner ? 1.6 : 2.4, L = w * 2.6, W = w * 1.8;
        both(() => {
          ctx.beginPath();
          ctx.arc(0, 0, r, Math.min(head, tail), Math.max(head, tail));
        }, w, 1);
        both(() => {
          ctx.beginPath();
          ctx.moveTo(hx + tx * L, hy + ty * L);
          ctx.lineTo(hx + nx * W, hy + ny * W);
          ctx.lineTo(hx - nx * W, hy - ny * W);
          ctx.closePath();
        }, 0.6, 1, true);
      }
      overTex.needsUpdate = true;
    }
    function showOverlay(c, d) {
      const k = centreOf(c.pid, c.display);
      overlay.position.set(k.x, k.y, k.front);
      overlay.material.opacity = 1;
      overlay.visible = true;
      fadeFrom = 0;
      shown = c.pid + ':' + c.display + ':' + c.inner;
      drawOverlay(c, d);
    }
    function hideOverlay(fade) {
      shown = null;
      if (fade) fadeFrom = performance.now();
      else overlay.visible = false;
    }

    // Hovering: once a frame, the control under the pointer sets the
    // cursor, and a concentric knob shows its zone.
    let hoverEvent = null;
    renderer.domElement.addEventListener('pointermove', (e) => { hoverEvent = e; });
    renderer.domElement.addEventListener('pointerleave', () => { hoverEvent = { gone: true }; });
    function hover() {
      const e = hoverEvent;
      if (!e || drag) return;
      hoverEvent = null;
      const c = operating && !e.gone && e.buttons === 0 ? controlAt(e) : null;
      renderer.domElement.style.cursor = !c ? '' : c.pid in KNOBS ? 'grab' : 'pointer';
      if (c && CONCENTRIC.has(KNOBS[c.pid])) {
        if (shown !== c.pid + ':' + c.display + ':' + c.inner) showOverlay(c);
      } else if (shown) hideOverlay(false);
    }

    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (!operating || e.button !== 0) return;
      const c = controlAt(e);
      if (!c || !(c.pid in KNOBS)) return;
      // OrbitControls listens on the same element: switch it off until the
      // drag ends, so the drag turns the knob instead of the camera.
      controls.enabled = false;
      drag = { c, centre: screenCentre(c), acc: 0, id: e.pointerId };
      drag.last = angleAt(drag, e);
      drag.dir = 0;
      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture(e.pointerId);
      drag.piece = pieceOf(c);
      drag.piece.visible = true;
      showOverlay(c, drag);
    }, { capture: true });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const a = angleAt(drag, e);
      if (a == null) return;
      if (drag.last == null) { drag.last = a; return; }
      let da = a - drag.last;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      drag.last = a;
      drag.acc += da;
      if (drag.dir) drawOverlay(drag.c, drag);
      const steps = Math.trunc(drag.acc / STEP);
      if (!steps) return;
      drag.acc -= steps * STEP;
      drag.dir = Math.sign(steps);
      drawOverlay(drag.c, drag);
      const { c } = drag;
      G.turn(KNOBS[c.pid], c.inner ? 'inner' : 'outer', steps, c.display);
      drag.turned = true;
      redraw(true);
      lastSaid = name(c) + ' · turn';
      onTurn?.(lastSaid);
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.turned) turnedAt = performance.now();
      drag.piece.visible = false;
      hideOverlay(true);
      drag = null;
      hoverEvent = e;
      controls.enabled = true;
    };
    renderer.domElement.addEventListener('pointerup', endDrag, { capture: true });
    renderer.domElement.addEventListener('pointercancel', endDrag);

    // Flying by hand with the autopilot off: arrows for pitch and bank,
    // Page Up/Down for power, Home/End for the mixture (richer, leaner).
    // With the MFD map's pointer out (RANGE push) the arrows move it
    // instead, as the joystick would. Not while a dialog or text field
    // has focus.
    document.addEventListener('keydown', (e) => {
      if (!operating || e.target.matches('input, select, textarea')
        || document.querySelector('.modal:not([hidden])')) return;
      const pan = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (pan && G.state.pan) {
        e.preventDefault();
        G.pan(...pan);
        redraw(true);
        return;
      }
      const input = { ArrowUp: { pitch: -0.5 }, ArrowDown: { pitch: 0.5 }, ArrowLeft: { roll: -3 },
        ArrowRight: { roll: 3 }, PageUp: { power: 0.05 }, PageDown: { power: -0.05 },
        Home: { mixture: 0.02 }, End: { mixture: -0.02 } }[e.key];
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
      for (const g of gauges) {
        SB.draw[g.id](g.ctx, G.state, G);
        g.texture.needsUpdate = true;
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
      // Audio panel annunciators: lit while their key is on.
      for (const l of leds) l.led.visible = l.parent.visible && G.gma.lit(l.key);
      for (const g of gauges) {
        const m = Array.isArray(g.parent.material) ? g.parent.material[0] : g.parent.material;
        g.plane.visible = g.parent.visible;
        g.plane.material.opacity = m.opacity;
      }
      // The overlay fades out after a turn.
      if (fadeFrom) {
        const o = 1 - (now - fadeFrom) / 300;
        overlay.material.opacity = Math.max(0, o);
        if (o <= 0) { overlay.visible = false; fadeFrom = 0; }
      }
      hover();
      if (!operating && !drag) {
        if (overlay.visible && !fadeFrom) hideOverlay(false);
        renderer.domElement.style.cursor = '';
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
      controlAt, softkeyAt, screens, gauges, overlay, leds,
    };
  }

  return { attach, KNOBS, KEYS };
})();
