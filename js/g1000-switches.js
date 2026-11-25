// The panel's switches in Operate mode: the MASTER rocker (ALT, BAT), the
// AVIONICS rocker (BUS 1, BUS 2), STBY BATT (ARM, OFF, TEST) and the
// light, pitot heat, fuel pump and cabin power toggles, and the ELT's
// remote rocker (ARM, ON). The last three don't do anything yet: they are
// there to practise procedures. The ignition key turns too (OFF, R, L,
// BOTH, START at 0, 30, 60, 90 and 120° clockwise, magneto-switch-fg1000.xml),
// but it is worked as a knob (js/g1000-panel.js KNOBS); only its piece
// tagged `moves: key` (build/aircraft.py MOVING) turns. Their positions live in state.sys.sw
// (js/g1000-systems.js, which also wires them to the buses); this moves
// the 3D levers to match and turns clicks into flips. js/g1000-panel.js
// routes Operate-mode clicks and scrolls on these parts here.
//
// Pivots and angles are FlightGear's (c172sp.xml's rotate animations),
// its frame turned into the scene's: each lever turns about the scene's x
// axis through its pivot, 0° being the model as drawn. The toggles are
// 0° off and -50° on; STBY BATT -15° TEST, -45° OFF, -75° ARM. The rockers
// are -37° on as FlightGear has them, but -20° off: as drawn (0°) the top
// stands far prouder than a real rocker's. The AVIONICS part holds both
// rockers: BUS 1 is the half on the pilot's left (scene x over AVN_SPLIT).
// The ELT's part is its whole panel: its rocker is the vertices in
// ELT_ROCKER, turning -20° from ARM to ON (elt-fg1000.xml).
window.G1000_SWITCHES = (function () {
  const AVN_SPLIT = 0.3545;
  const ELT_ROCKER = [[-0.3159, 0.1063, 0.3587], [-0.3000, 0.1265, 0.3665]];
  const inBox = ([lo, hi]) => (x, y, z) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2];           // the gap between the halves (BUS 1 0.355-0.366, BUS 2 0.342-0.354)
  const STBY_ANGLE = { test: -15, off: -45, arm: -75 };
  const MAG_ANGLE = { off: 0, r: 30, l: 60, both: 90, start: 120 };
  const STBY_LABEL = { test: 'TEST', off: 'OFF', arm: 'ARM' };
  const toggle = (on) => (on ? -50 : 0), rocker = (on) => (on ? -37 : -20);
  const SWITCHES = [
    { pid: 'master_switch_alt', key: 'alt', pivot: [0.408923, -0.031452, 0.359913], angle: rocker },
    { pid: 'master_switch_bat', key: 'bat', pivot: [0.396892, -0.031252, 0.359472], angle: rocker },
    { pid: 'avionics_switch', key: 'avn1', pivot: [0.364747, -0.032032, 0.359867], angle: rocker, only: (x) => x > AVN_SPLIT },
    { pid: 'avionics_switch', key: 'avn2', pivot: [0.35254, -0.032032, 0.359861], angle: rocker, only: (x) => x <= AVN_SPLIT },
    { pid: 'standby_battery_switch', key: 'stby', pivot: [0.385037, 0.020864, 0.364392], angle: (v) => STBY_ANGLE[v] },
    { pid: 'beacon_switch', key: 'beacon', pivot: [0.337479, -0.085697, 0.364302], angle: toggle },
    { pid: 'landing_light_switch', key: 'land', pivot: [0.314728, -0.08547, 0.364242], angle: toggle },
    { pid: 'nav_light_switch', key: 'nav', pivot: [0.29112, -0.085555, 0.363882], angle: toggle },
    { pid: 'strobe_switch', key: 'strobe', pivot: [0.268024, -0.085536, 0.364034], angle: toggle },
    { pid: 'taxi_light_switch', key: 'taxi', pivot: [0.268018, -0.126519, 0.363815], angle: toggle },
    { pid: 'pitot_heat_switch', key: 'pitot', pivot: [0.314722, -0.126435, 0.364022], angle: toggle },
    { pid: 'fuel_pump_switch', key: 'fuelPump', pivot: [0.337472, -0.126653, 0.364096], angle: toggle },
    { pid: 'cabin_power_switch', key: 'cabinPwr', pivot: [0.291114, -0.126543, 0.363664], angle: toggle },
    { pid: 'ignition_switch', key: 'mags', pivot: [0.427319, -0.225186, 0.357935], axis: [0, 0, 1],
      angle: (v) => MAG_ANGLE[v], piece: 'key', knob: true },
    { pid: 'elt_remote_switch', key: 'elt', pivot: [-0.307917, 0.115113, 0.360932], angle: (on) => (on ? -20 : 0),
      only: inBox(ELT_ROCKER) },
  ];
  const NAMES = { alt: 'MASTER ALT', bat: 'MASTER BAT', avn1: 'AVIONICS BUS 1', avn2: 'AVIONICS BUS 2',
                  stby: 'STBY BATT', beacon: 'BEACON', land: 'LAND', nav: 'NAV', strobe: 'STROBE',
                  taxi: 'TAXI', pitot: 'PITOT HEAT', fuelPump: 'FUEL PUMP', cabinPwr: 'CABIN PWR 12V', elt: 'ELT' };
  // Push-pull controls: a `piece` of a part (build/aircraft.py MOVING)
  // sliding along the scene's z, `travel` metres, at a position 0-1 (get,
  // set). `dir` +1: 1 is pushed in (the throttle and mixture, drawn pulled
  // right out: idle, idle cutoff, the knob 11 cm from its mount, 1.5 cm
  // when fully in). `dir` -1: 1 is pulled out (CABIN HT and CABIN AIR,
  // drawn pushed in, closed; 6 cm of pull, made up). Heat and air do
  // nothing yet (procedure practice).
  const LEVERS = [
    { id: 'throttle', pid: 'throttle', piece: 'lever', dir: 1, travel: 0.081, name: 'THROTTLE',
      get: (s) => s.power, set: (G, v) => G.fly({ power: v - G.state.power }),
      label: (v) => (v <= 0.001 ? 'IDLE' : Math.round(v * 100) + '%') },
    { id: 'mixture', pid: 'mixture', piece: 'lever', dir: 1, travel: 0.083, name: 'MIXTURE',
      get: (s) => s.mixture, set: (G, v) => G.fly({ mixture: v - G.state.mixture }),
      label: (v) => (v <= 0.001 ? 'IDLE CUTOFF' : Math.round(v * 100) + '%') },
    { id: 'cabinHeat', pid: 'heat_and_air', piece: 'heat', dir: -1, travel: 0.06, name: 'CABIN HEAT',
      get: (s) => s.sys.sw.cabinHeat, set: (G, v) => G.systems.setSwitch('cabinHeat', v),
      label: (v) => (v <= 0.001 ? 'OFF' : Math.round(v * 100) + '% out') },
    { id: 'cabinAir', pid: 'heat_and_air', piece: 'air', dir: -1, travel: 0.06, name: 'CABIN AIR',
      get: (s) => s.sys.sw.cabinAir, set: (G, v) => G.systems.setSwitch('cabinAir', v),
      label: (v) => (v <= 0.001 ? 'OFF' : Math.round(v * 100) + '% out') },
  ];
  const LEVER_PARTS = new Set(LEVERS.map((l) => l.pid));
  const leverById = (id) => LEVERS.find((l) => l.id === id);
  const leverLabel = (id, state) => { const l = leverById(id); return l.name + ' · ' + l.label(l.get(state)); };
  // Push (dir +1) or pull a control by `by` of its travel, clamped.
  function moveLever(G, id, by) {
    const l = leverById(id), v = l.get(G.state);
    const next = Math.min(1, Math.max(0, v + by));
    if (next !== v) l.set(G, next);
    return next !== v;
  }

  // Parts clicked as switches (the ignition key is a knob).
  const PARTS = new Set(SWITCHES.filter((s) => !s.knob).map((s) => s.pid));
  // The STBY BATT test lamp, right of the switch; the ELT's red lamp,
  // above its rocker (elt-fg1000.ac eltlamp), which flashes while the ELT
  // is ON (transmitting).
  const TEST_LAMP = [0.356, 0.021, 0.3628];
  const ELT_LAMP = [-0.308, 0.1315, 0.3627], ELT_FLASH_MS = 1000, ELT_LIT_MS = 600;

  function attach({ THREE, scene, meshById }) {
    // Each switch's vertices, as drawn, to turn from.
    const levers = SWITCHES.filter((s) => meshById[s.pid]).map((s) => {
      const mesh = meshById[s.pid], g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal;
      const idx = [];
      const range = s.piece && mesh.userData.moving.find((m) => m.moves === s.piece);
      if (range) for (let i = range.first; i < range.first + range.count; i++) idx.push(i);
      else for (let i = 0; i < pos.count; i++) if (!s.only || s.only(pos.getX(i), pos.getY(i), pos.getZ(i))) idx.push(i);
      return { ...s, mesh, idx, pos, nrm, from: idx.map((i) => [pos.getX(i), pos.getY(i), pos.getZ(i)]),
               nfrom: nrm && idx.map((i) => [nrm.getX(i), nrm.getY(i), nrm.getZ(i)]), shown: null };
    });

    const slides = LEVERS.filter((l) => meshById[l.pid]).map((l) => {
      const mesh = meshById[l.pid], pos = mesh.geometry.attributes.position;
      const range = mesh.userData.moving.find((m) => m.moves === l.piece);
      const idx = [];
      if (range) for (let i = range.first; i < range.first + range.count; i++) idx.push(i);
      let x = 0, y = 0;
      idx.forEach((i) => { x += pos.getX(i); y += pos.getY(i); });
      return { ...l, mesh, pos, idx, from: idx.map((i) => pos.getZ(i)), shown: null,
               cx: x / idx.length, cy: y / idx.length };
    });

    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.0021, 24),
      new THREE.MeshBasicMaterial({ color: 0x5dff7a, toneMapped: false }));
    lamp.rotation.y = Math.PI;
    lamp.position.set(...TEST_LAMP);
    lamp.renderOrder = 1;
    lamp.visible = false;
    scene.add(lamp);
    const eltLamp = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 24),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
    eltLamp.rotation.y = Math.PI;
    eltLamp.position.set(...ELT_LAMP);
    eltLamp.renderOrder = 1;
    eltLamp.visible = false;
    scene.add(eltLamp);

    // Move the levers to the switches' positions (only those that moved),
    // and the throttle and mixture to theirs.
    function update(state, lampOn) {
      const sys = state.sys;
      for (const l of slides) {
        const dz = (Math.round(l.get(state) * 1000) / 1000) * l.travel * l.dir;
        if (dz === l.shown) continue;
        l.shown = dz;
        l.idx.forEach((i, k) => l.pos.setZ(i, l.from[k] + dz));
        l.pos.needsUpdate = true;
        l.mesh.geometry.computeBoundingSphere();
        l.mesh.geometry.computeBoundingBox();
      }
      const dirty = new Set();
      for (const l of levers) {
        const deg = l.angle(sys.sw[l.key]);
        if (deg === l.shown) continue;
        l.shown = deg;
        // About the switch's axis (FlightGear's, in the scene: its +y, the
        // toggles' and rockers', is the scene's -x).
        const rot = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(...(l.axis || [-1, 0, 0])), (deg * Math.PI) / 180));
        const pivot = new THREE.Vector3(...l.pivot), v = new THREE.Vector3();
        l.idx.forEach((i, k) => {
          v.set(...l.from[k]).sub(pivot).applyMatrix3(rot).add(pivot);
          l.pos.setXYZ(i, v.x, v.y, v.z);
          if (l.nrm) {
            v.set(...l.nfrom[k]).applyMatrix3(rot);
            l.nrm.setXYZ(i, v.x, v.y, v.z);
          }
        });
        dirty.add(l);
      }
      for (const l of dirty) {
        l.pos.needsUpdate = true;
        if (l.nrm) l.nrm.needsUpdate = true;
        l.mesh.geometry.computeBoundingSphere();
        l.mesh.geometry.computeBoundingBox();
      }
      lamp.visible = lampOn && meshById.standby_battery_switch?.visible !== false;
      eltLamp.visible = sys.sw.elt && meshById.elt_remote_switch?.visible !== false
        && performance.now() % ELT_FLASH_MS < ELT_LIT_MS;
    }

    // The switch a hit on a part is: the avionics rocker's half by where;
    // on the ELT's panel, only its rocker (a little slack around it).
    const switchAt = (pid, point) => SWITCHES.find((s) => s.pid === pid && (!s.only
      || (s.key === 'elt' ? inBox([ELT_ROCKER[0].map((v) => v - 0.002), ELT_ROCKER[1].map((v) => v + 0.002)])
        : s.only)(point.x, point.y, point.z)));
    const label = (s, v) => NAMES[s.key] + ' · ' + (s.key === 'stby' ? STBY_LABEL[v] : s.key === 'elt' ? (v ? 'ON' : 'ARM')
      : v ? 'ON' : 'OFF');

    // A click flips it (STBY BATT between ARM and OFF; scroll down for
    // TEST). Returns the header text.
    function click(G, pid, point) {
      const s = switchAt(pid, point), sys = G.state.sys;
      if (!s) return null;
      const v = sys.sw[s.key];
      const next = s.key === 'stby' ? (v === 'arm' ? 'off' : 'arm') : !v;
      G.systems.setSwitch(s.key, next);
      return label(s, sys.sw[s.key]) + (s.key === 'stby' && next === 'off' ? ' (scroll down: TEST)' : '');
    }
    // A scroll moves it a notch: up (dir 1) or down (-1).
    function scroll(G, pid, point, dir) {
      const s = switchAt(pid, point), sys = G.state.sys;
      if (!s) return null;
      const v = sys.sw[s.key];
      let next;
      if (s.key === 'stby') {
        const order = ['test', 'off', 'arm'];
        next = order[Math.max(0, Math.min(2, order.indexOf(v) + dir))];
      } else next = dir > 0;
      if (next !== v) G.systems.setSwitch(s.key, next);
      return label(s, sys.sw[s.key]);
    }

    // Which push-pull control a hit on a part is: the nearest knob.
    function leverAt(pid, point) {
      let best = null, bestD = Infinity;
      for (const l of slides) {
        if (l.pid !== pid) continue;
        const d = Math.hypot(point.x - l.cx, point.y - l.cy);
        if (d < bestD) { best = l; bestD = d; }
      }
      return best?.id ?? null;
    }
    // Where a control's knob is now, and where it would be at 0 and at 1
    // (for dragging along it on screen).
    function leverAxis(id, state) {
      const l = slides.find((s) => s.id === id);
      if (!l) return null;
      let zMin = Infinity;
      l.idx.forEach((i) => { zMin = Math.min(zMin, l.pos.getZ(i)); });
      const v = l.get(state), at = (w) => new THREE.Vector3(l.cx, l.cy, zMin + (w - v) * l.travel * l.dir);
      return { zero: at(0), one: at(1), value: v };
    }

    return { update, click, scroll, lamp, leverAt, leverAxis };
  }

  // Whether a hit on a part is on one of its switches (the ELT's panel
  // is more than its rocker).
  const isSwitch = (pid, point) => SWITCHES.some((s) => s.pid === pid
    && (s.key !== 'elt' || inBox([ELT_ROCKER[0].map((v) => v - 0.002), ELT_ROCKER[1].map((v) => v + 0.002)])(point.x, point.y, point.z)));

  return { attach, PARTS, SWITCHES, isSwitch, LEVER_PARTS, LEVERS, leverById, leverLabel, moveLever };
})();
