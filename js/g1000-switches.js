// The panel's switches in Operate mode: the MASTER rocker (ALT, BAT), the
// AVIONICS rocker (BUS 1, BUS 2), STBY BATT (ARM, OFF, TEST) and the
// light, pitot heat, fuel pump and cabin power toggles, and the ELT's
// remote rocker (ARM, ON). The last three don't do anything yet: they are
// there to practise procedures. Their positions live in state.sys.sw
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
    { pid: 'elt_remote_switch', key: 'elt', pivot: [-0.307917, 0.115113, 0.360932], angle: (on) => (on ? -20 : 0),
      only: inBox(ELT_ROCKER) },
  ];
  const NAMES = { alt: 'MASTER ALT', bat: 'MASTER BAT', avn1: 'AVIONICS BUS 1', avn2: 'AVIONICS BUS 2',
                  stby: 'STBY BATT', beacon: 'BEACON', land: 'LAND', nav: 'NAV', strobe: 'STROBE',
                  taxi: 'TAXI', pitot: 'PITOT HEAT', fuelPump: 'FUEL PUMP', cabinPwr: 'CABIN PWR 12V', elt: 'ELT' };
  const PARTS = new Set(SWITCHES.map((s) => s.pid));
  // The STBY BATT test lamp, right of the switch.
  const TEST_LAMP = [0.356, 0.021, 0.3628];

  function attach({ THREE, scene, meshById }) {
    // Each switch's vertices, as drawn, to turn from.
    const levers = SWITCHES.filter((s) => meshById[s.pid]).map((s) => {
      const mesh = meshById[s.pid], g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal;
      const idx = [];
      for (let i = 0; i < pos.count; i++) if (!s.only || s.only(pos.getX(i), pos.getY(i), pos.getZ(i))) idx.push(i);
      return { ...s, mesh, idx, pos, nrm, from: idx.map((i) => [pos.getX(i), pos.getY(i), pos.getZ(i)]),
               nfrom: nrm && idx.map((i) => [nrm.getX(i), nrm.getY(i), nrm.getZ(i)]), shown: null };
    });

    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.0021, 24),
      new THREE.MeshBasicMaterial({ color: 0x5dff7a, toneMapped: false }));
    lamp.rotation.y = Math.PI;
    lamp.position.set(...TEST_LAMP);
    lamp.renderOrder = 1;
    lamp.visible = false;
    scene.add(lamp);

    // Move the levers to the switches' positions (only those that moved).
    function update(sys, lampOn) {
      const dirty = new Set();
      for (const l of levers) {
        const deg = l.angle(sys.sw[l.key]);
        if (deg === l.shown) continue;
        l.shown = deg;
        // FlightGear turns about its +y, the scene's -x: about +x by -deg.
        const a = (-deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        const [px, py, pz] = l.pivot;
        l.idx.forEach((i, k) => {
          const [x, y, z] = l.from[k];
          const dy = y - py, dz = z - pz;
          l.pos.setXYZ(i, x, py + dy * c - dz * s, pz + dy * s + dz * c);
          if (l.nrm) {
            const [nx, ny, nz] = l.nfrom[k];
            l.nrm.setXYZ(i, nx, ny * c - nz * s, ny * s + nz * c);
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

    return { update, click, scroll, lamp };
  }

  // Whether a hit on a part is on one of its switches (the ELT's panel
  // is more than its rocker).
  const isSwitch = (pid, point) => SWITCHES.some((s) => s.pid === pid
    && (s.key !== 'elt' || inBox([ELT_ROCKER[0].map((v) => v - 0.002), ELT_ROCKER[1].map((v) => v + 0.002)])(point.x, point.y, point.z)));

  return { attach, PARTS, SWITCHES, isSwitch };
})();
