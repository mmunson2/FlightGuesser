// A mock of the C172S's G1000 NXi and GFC 700 autopilot, for study: the
// state behind the keys and knobs, and a simple airplane for them to fly.
// No three.js here: js/g1000-display.js draws the screens from `state`,
// js/g1000-panel.js turns clicks on the 3D panel into press/turn/push.
//
// What it models: COM and NAV radios (tuning, transfer, volume), the
// heading bug, course, baro, selected altitude and its alerter, the CDI
// source, the transponder, the PFD's softkey menus, and the GFC 700's mode
// logic (FD/AP, ROL PIT HDG ALT VS FLC NAV APR, ALTS capture, NOSE UP/DN).
// What it doesn't: flight plans, VNAV, GPS approaches, LOC/GS, the MFD's
// pages beyond the map, failures, wind, magnetic variation (headings are
// true). The airplane is a few lines of kinematics, not a flight model.
// Behaviour follows the G1000 NXi and GFC 700 pilot's guides as remembered;
// to_verify.md lists what to check against the real guides.
window.G1000 = (function () {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wrap360 = (a) => ((a % 360) + 360) % 360;
  // Signed a - b in degrees, -180..180.
  const diff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
  const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

  // A few stations and airports around Paine Field (KPAE), the app's
  // airport. Positions are approximate: for the mock, not for navigation.
  const NAVAIDS = [
    { id: 'PAE', name: 'PAINE', freq: 110.6, lat: 47.9198, lon: -122.2777 },
    { id: 'SEA', name: 'SEATTLE', freq: 116.8, lat: 47.4353, lon: -122.3097 },
  ];
  const AIRPORTS = [
    { id: 'KPAE', lat: 47.9063, lon: -122.2816, towered: true },
    { id: 'KAWO', lat: 48.1608, lon: -122.1590, towered: false },
    { id: 'S43', lat: 47.9082, lon: -122.1031, towered: false },
    { id: 'KBFI', lat: 47.5300, lon: -122.3020, towered: true },
    { id: 'KSEA', lat: 47.4490, lon: -122.3093, towered: true },
    { id: 'KRNT', lat: 47.4931, lon: -122.2157, towered: true },
  ];

  // Great-circle bearing (deg true) and distance (NM) from a to b.
  function bearingDist(a, b) {
    const p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return { brg: wrap360(deg(Math.atan2(y, x))), dist: 2 * 3440.065 * Math.asin(Math.sqrt(h)) };
  }

  // The altimeter setting at the airplane: indicated altitude is right
  // only when the Kollsman (BARO) setting matches it.
  const ACTUAL_BARO = 30.12;

  // C172S airspeed indicator markings (POH section 2), KIAS.
  const SPEEDS = { white: [40, 85], green: [48, 129], yellow: [129, 163], vne: 163 };

  const ROOT_PFD = ['', 'Map/HSI', 'TFC Map', 'PFD Opt', 'OBS', 'CDI', 'ADF/DME', 'XPDR', 'Ident', 'Tmr/Ref', 'Nearest', 'Alerts'];
  const MENUS = {
    pfd: ROOT_PFD,
    'pfd-opt': ['SVT', '', 'Wind', 'DME', 'Bearing 1', '', 'Bearing 2', '', 'ALT Units', 'STD Baro', 'Back', 'Alerts'],
    xpdr: ['', '', 'Standby', 'On', 'Alt', '', 'VFR', 'Code', 'Ident', '', 'Back', 'Alerts'],
    'xpdr-code': ['0', '1', '2', '3', '4', '5', '6', '7', 'Ident', 'BKSP', 'Back', 'Alerts'],
    mfd: ['Engine', '', 'Map Opt', '', '', '', '', '', '', 'Detail', 'Charts', 'Checklist'],
    engine: ['Engine', 'Lean', 'System', '', '', '', '', '', '', '', 'Back', ''],
  };
  // The softkeys that do something in the mock; the rest draw grey.
  const LIVE = {
    pfd: [3, 5, 7, 8], 'pfd-opt': [9, 10], xpdr: [2, 3, 4, 6, 7, 8, 10],
    'xpdr-code': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], mfd: [0], engine: [0, 1, 2, 10],
  };

  // Map ranges (NM), as the RANGE knob steps them.
  const RANGES = [1, 1.5, 2.5, 4, 5, 7.5, 10, 15, 25, 40, 50, 75, 100];

  const state = {};
  function reset() {
    Object.assign(state, {
      t: 0,
      // The airplane: 3,500 ft over Everett, northbound, cruise power.
      lat: 47.80, lon: -122.27, trueAlt: 3500, hdg: 340, ias: 110, pitch: 2.0, roll: 0, power: 0.8,
      vs: 0,
      // Pilot input with the autopilot off (arrow keys): attitude targets.
      manual: { pitch: 2.0, roll: 0 },
      baro: ACTUAL_BARO,
      com: [{ act: 132.950, stby: 120.200 }, { act: 128.650, stby: 121.900 }], comTune: 0,
      nav: [{ act: 110.60, stby: 116.80 }, { act: 116.80, stby: 110.60 }], navTune: 0,
      // A volume change shows in place of the standby frequency briefly.
      vol: { com: [80, 80], nav: [60, 60], show: null },
      hdgBug: 340, crs: [340, 340], altSel: 5500,
      cdi: 'GPS',
      xpdr: { code: '1200', mode: 'ALT', identUntil: 0, entry: null },
      afcs: { ap: false, fd: false, lat: null, latArmed: null, vert: null, vertArmed: null,
              ref: { pitch: 0, roll: 0, vs: 0, ias: 0, alt: 0 }, changed: {}, apOffAt: -99 },
      // Selected altitude alerter: 'approach' (within 1,000 ft), 'reached'
      // (within 200 ft), 'deviate' (off by more than 200 ft once reached).
      alt: { phase: 'far', flashUntil: 0 },
      menus: { pfd: ['pfd'], mfd: ['mfd'] },
      mfdPage: 'map', eisPage: 'Engine', range: 6,
      // A line of text for the last thing the mock can't do yet.
      note: null,
    });
    state.afcs.ref.alt = state.trueAlt;
  }
  reset();

  const indicatedAlt = () => state.trueAlt + (state.baro - ACTUAL_BARO) * 1000;
  const tas = () => state.ias * (1 + 0.02 * state.trueAlt / 1000);
  const note = (text) => { state.note = { text, until: state.t + 4 }; };

  // ---- Navigation: the active CDI source's deviation ----
  function tunedStation(i) {
    return NAVAIDS.find((n) => Math.abs(n.freq - state.nav[i].act) < 0.001) ?? null;
  }
  // { source, station, course, toFrom, dev (needle, -1..1 of full scale,
  // + = needle right), xtk (NM, + = right of course), dist } or null when
  // the source has no signal.
  function navSolution(src = state.cdi) {
    if (src === 'GPS') return null;
    const i = src === 'VOR1' ? 0 : 1;
    const st = tunedStation(i);
    if (!st) return null;
    const { brg, dist } = bearingDist(st, state);
    if (dist > 60) return null;
    const crs = state.crs[i];
    const from = Math.abs(diff(brg, crs)) <= 90;
    const off = from ? diff(brg, crs) : -diff(brg, wrap360(crs + 180));
    return { source: src, station: st, course: crs, toFrom: from ? 'FROM' : 'TO',
             dev: clamp(-off / 10, -1, 1), offDeg: off, xtk: dist * Math.sin(rad(off)), dist,
             bearingTo: wrap360(brg + 180) };
  }

  // ---- The GFC 700 ----
  const LAT_DEFAULT = 'ROL', VERT_DEFAULT = 'PIT';
  function setMode(axis, mode) {
    const a = state.afcs;
    if (a[axis] === mode) return;
    a[axis] = mode;
    a.changed[axis] = state.t;
    const r = a.ref;
    if (mode === 'ROL') r.roll = Math.abs(state.roll) < 6 ? 0 : clamp(state.roll, -22, 22);
    if (mode === 'PIT') r.pitch = clamp(state.pitch, -10, 15);
    if (mode === 'VS') r.vs = clamp(Math.round(state.vs / 100) * 100, -1500, 1500);
    if (mode === 'FLC') r.ias = clamp(Math.round(state.ias), 55, 120);
    if (mode === 'ALT') r.alt = Math.round(state.trueAlt / 10) * 10;
  }
  function arm(axis, mode) {
    const a = state.afcs;
    if (a[axis + 'Armed'] === mode) return;
    a[axis + 'Armed'] = mode;
    a.changed[axis + 'Armed'] = state.t;
  }
  // The flight director comes on in the default modes, or in `lat`/`vert`.
  function fdOn() {
    const a = state.afcs;
    if (a.fd) return;
    a.fd = true;
    setMode('lat', LAT_DEFAULT);
    setMode('vert', VERT_DEFAULT);
  }
  function fdOff() {
    const a = state.afcs;
    a.fd = false;
    a.lat = a.vert = a.latArmed = a.vertArmed = null;
  }
  function apDisconnect() {
    state.afcs.ap = false;
    state.afcs.apOffAt = state.t;
    state.manual.pitch = state.pitch;
    state.manual.roll = state.roll;
  }
  // A mode key: on in that mode (FD too if it was off); pressed again, back
  // to the axis's default.
  function modeKey(axis, mode, available = true) {
    if (!available) return;
    const a = state.afcs;
    if (!a.fd) fdOn();
    const armedKey = axis + 'Armed';
    if (a[axis] === mode || a[armedKey] === mode) {
      if (a[armedKey] === mode) arm(axis, null);
      else setMode(axis, axis === 'lat' ? LAT_DEFAULT : VERT_DEFAULT);
      return;
    }
    setMode(axis, mode);
  }
  function navKey(mode) {
    const nav = navSolution();
    if (!nav) {
      note(state.cdi === 'GPS' ? 'No GPS flight plan in the mock: use CDI for VOR1/VOR2'
        : 'No VOR signal on ' + state.cdi);
      return;
    }
    const a = state.afcs;
    if (!a.fd) fdOn();
    if (a.lat === mode || a.latArmed === mode) {
      if (a.latArmed === mode) arm('lat', null); else setMode('lat', LAT_DEFAULT);
      return;
    }
    // Captured straight away when near the course, else armed (white)
    // while HDG or ROL flies the intercept.
    if (Math.abs(nav.offDeg) < 7) setMode('lat', mode); else arm('lat', mode);
  }
  const navModeName = (mode) => {
    const src = state.cdi === 'GPS' ? 'GPS' : 'VOR';
    return mode === 'APR' ? (src === 'VOR' ? 'VAPP' : 'GPS') : src;
  };

  // ---- Keys, knobs and softkeys ----
  function press(key, display = 'pfd') {
    const a = state.afcs;
    switch (key) {
      case 'ap':
        if (a.ap) apDisconnect();
        else { fdOn(); a.ap = true; }
        return;
      case 'fd':
        // The FD can't go off while the AP flies.
        if (a.ap) return;
        if (a.fd) fdOff(); else fdOn();
        return;
      case 'hdg': return modeKey('lat', 'HDG');
      case 'nav': return navKey('NAV');
      case 'apr': return navKey('APR');
      case 'bc': return note('BC needs a localizer: not in the mock');
      case 'vnv': return note('VNV needs a flight plan: not in the mock');
      case 'alt': return modeKey('vert', 'ALT');
      case 'vs': return modeKey('vert', 'VS');
      case 'flc': return modeKey('vert', 'FLC');
      case 'nose_up': case 'nose_dn': return nose(key === 'nose_up' ? 1 : -1);
      case 'com_transfer': {
        const c = state.com[state.comTune];
        [c.act, c.stby] = [c.stby, c.act];
        return;
      }
      case 'nav_transfer': {
        const n = state.nav[state.navTune];
        [n.act, n.stby] = [n.stby, n.act];
        return;
      }
      case 'clr':
        if (state.menus[display].length > 1) state.menus[display].pop();
        return;
      case 'direct_to': case 'fpl': case 'proc': case 'menu': case 'ent':
        return note(key.replace('_', ' ').toUpperCase() + ': not in the mock yet');
      default:
        if (key.startsWith('softkey:')) return softkey(display, Number(key.slice(8)));
    }
  }
  function nose(dir) {
    const a = state.afcs, r = a.ref;
    if (!a.fd) return;
    if (a.vert === 'PIT') r.pitch = clamp(r.pitch + 0.5 * dir, -10, 15);
    else if (a.vert === 'VS') r.vs = clamp(r.vs + 100 * dir, -1500, 1500);
    // FLC: nose up is slower.
    else if (a.vert === 'FLC') r.ias = clamp(r.ias - dir, 55, 120);
  }

  function softkey(display, i) {
    const stack = state.menus[display];
    const menu = stack[stack.length - 1];
    const label = MENUS[menu][i];
    if (!label) return;
    if (!LIVE[menu].includes(i)) return note(label + ': not in the mock yet');
    const x = state.xpdr;
    switch (menu + ':' + label) {
      case 'pfd:PFD Opt': stack.push('pfd-opt'); return;
      case 'pfd:CDI': {
        const order = ['GPS', 'VOR1', 'VOR2'];
        state.cdi = order[(order.indexOf(state.cdi) + 1) % 3];
        // A NAV mode on the old source drops back to ROL.
        if (['NAV', 'APR'].includes(state.afcs.lat)) setMode('lat', LAT_DEFAULT);
        if (['NAV', 'APR'].includes(state.afcs.latArmed)) arm('lat', null);
        return;
      }
      case 'pfd:XPDR': stack.push('xpdr'); return;
      case 'pfd:Ident': case 'xpdr:Ident': case 'xpdr-code:Ident':
        x.identUntil = state.t + 18;
        if (menu !== 'pfd') stack.splice(1);
        return;
      case 'pfd-opt:STD Baro': state.baro = 29.92; return;
      case 'xpdr:Standby': x.mode = 'STBY'; return;
      case 'xpdr:On': x.mode = 'ON'; return;
      case 'xpdr:Alt': x.mode = 'ALT'; return;
      case 'xpdr:VFR': x.code = '1200'; return;
      case 'xpdr:Code': x.entry = ''; stack.push('xpdr-code'); return;
      case 'xpdr-code:BKSP': x.entry = x.entry.slice(0, -1); return;
      case 'pfd-opt:Back': case 'xpdr:Back': case 'engine:Back':
        stack.pop(); return;
      case 'xpdr-code:Back': x.entry = null; stack.pop(); return;
      case 'mfd:Engine': stack.push('engine'); return;
      case 'engine:Engine': case 'engine:Lean': case 'engine:System':
        state.eisPage = label; return;
    }
    if (menu === 'xpdr-code' && /^[0-7]$/.test(label)) {
      x.entry += label;
      // Four digits entered: the code takes effect, back to the XPDR menu.
      if (x.entry.length === 4) { x.code = x.entry; x.entry = null; stack.pop(); }
    }
  }

  // knob: com, nav, hdg, alt, crs_baro, fms, range, com_volume,
  // nav_volume. part: 'inner' or 'outer' (one-piece knobs ignore it).
  // steps: + clockwise.
  function turn(knob, part, steps) {
    switch (knob) {
      case 'com': {
        const c = state.com[state.comTune];
        if (part === 'outer') c.stby = 118 + wrapInt(Math.floor(c.stby) - 118 + steps, 19) + (c.stby % 1);
        // 25 kHz spacing.
        else c.stby = Math.floor(c.stby) + wrapInt(Math.round((c.stby % 1) * 40) + steps, 40) / 40;
        c.stby = +c.stby.toFixed(3);
        return;
      }
      case 'nav': {
        const n = state.nav[state.navTune];
        if (part === 'outer') n.stby = 108 + wrapInt(Math.floor(n.stby) - 108 + steps, 10) + (n.stby % 1);
        // 50 kHz spacing.
        else n.stby = Math.floor(n.stby) + wrapInt(Math.round((n.stby % 1) * 20) + steps, 20) / 20;
        n.stby = +n.stby.toFixed(2);
        return;
      }
      case 'hdg': state.hdgBug = wrap360(state.hdgBug + steps); return;
      case 'alt':
        state.altSel = clamp(state.altSel + steps * (part === 'outer' ? 1000 : 100), -1000, 20000);
        return;
      case 'crs_baro':
        if (part === 'outer') {
          state.baro = clamp(+(state.baro + steps * 0.01).toFixed(2), 27.0, 31.0);
        } else if (state.cdi !== 'GPS') {
          const i = state.cdi === 'VOR1' ? 0 : 1;
          state.crs[i] = wrap360(state.crs[i] + steps);
        }
        return;
      case 'range': state.range = clamp(state.range - steps, 0, RANGES.length - 1); return;
      case 'com_volume': case 'nav_volume': {
        const kind = knob === 'com_volume' ? 'com' : 'nav';
        const i = kind === 'com' ? state.comTune : state.navTune;
        state.vol[kind][i] = clamp(state.vol[kind][i] + steps * 5, 0, 100);
        state.vol.show = { kind, i, until: state.t + 2 };
        return;
      }
      case 'fms': return note('FMS knob: no pages to scroll in the mock yet');
    }
  }
  const wrapInt = (v, n) => ((v % n) + n) % n;

  // Pushing a knob.
  function push(knob) {
    switch (knob) {
      // Push: tune the other radio (the cyan box moves).
      case 'com': state.comTune = 1 - state.comTune; return;
      case 'nav': state.navTune = 1 - state.navTune; return;
      // HDG SYNC: the bug to the current heading.
      case 'hdg': state.hdgBug = Math.round(state.hdg); return;
      // CRS CTR: the course to center the needle with a TO flag.
      case 'crs_baro': {
        const nav = navSolution();
        if (nav) state.crs[state.cdi === 'VOR1' ? 0 : 1] = Math.round(nav.bearingTo);
        return;
      }
      case 'com_volume': return note('COM squelch: not in the mock');
      case 'nav_volume': return note('NAV ID: not in the mock');
      case 'range': return note('Map pan: not in the mock yet');
      case 'fms': return note('FMS cursor: not in the mock yet');
    }
  }

  // ---- The airplane ----
  // Attitude moves toward a target at the autopilot's rates; the rest is
  // kinematics: path angle = pitch - angle of attack, speed settles where
  // power, drag and the climb balance.
  function step(dt) {
    const a = state.afcs;
    state.t += dt;
    const nav = navSolution();
    const T = tas();
    const alpha = 2 + (110 - state.ias) * 0.12;
    const pathFor = (vs) => deg(Math.asin(clamp(vs / (T * 101.27), -0.5, 0.5)));

    // Lateral: a bank to fly.
    let rollCmd = state.roll;
    if (a.lat === 'ROL') rollCmd = a.ref.roll;
    if (a.lat === 'HDG') rollCmd = clamp(diff(state.hdgBug, state.hdg) * 1.2, -22, 22);
    if ((a.lat === 'NAV' || a.lat === 'APR') && nav) {
      // Intercept angle grows with the distance off course, up to 45°.
      const track = wrap360(nav.course - clamp(nav.xtk * 40, -45, 45));
      rollCmd = clamp(diff(track, state.hdg) * 1.2, -22, 22);
    } else if ((a.lat === 'NAV' || a.lat === 'APR') && !nav) {
      setMode('lat', LAT_DEFAULT);
    }
    if (a.latArmed && nav && Math.abs(nav.offDeg) < 7) {
      setMode('lat', a.latArmed);
      arm('lat', null);
    }

    // Vertical: ALTS arms in PIT, VS and FLC when the selected altitude
    // is ahead; it captures with a lead that grows with the climb rate.
    const altErr = state.altSel - state.trueAlt;
    if (a.fd && ['PIT', 'VS', 'FLC'].includes(a.vert)) {
      const toward = Math.sign(altErr) === Math.sign(state.vs) || Math.abs(state.vs) < 50;
      arm('vert', toward && Math.abs(altErr) > 50 ? 'ALTS' : null);
      if (a.vertArmed === 'ALTS' && Math.abs(altErr) < Math.max(50, Math.abs(state.vs) / 5)) {
        arm('vert', null);
        setMode('vert', 'ALTS');
      }
    } else if (a.vert === 'ALT' || a.vert === 'ALTS') {
      arm('vert', null);
    }
    if (a.vert === 'ALTS' && Math.abs(altErr) < 10 && Math.abs(state.vs) < 150) {
      setMode('vert', 'ALT');
      a.ref.alt = state.altSel;
    }
    let pitchCmd = state.pitch;
    if (a.vert === 'PIT') pitchCmd = a.ref.pitch;
    if (a.vert === 'VS') pitchCmd = pathFor(a.ref.vs) + alpha;
    if (a.vert === 'ALT' || a.vert === 'ALTS') {
      const target = a.vert === 'ALTS' ? state.altSel : a.ref.alt;
      pitchCmd = pathFor(clamp((target - state.trueAlt) * 4, -700, 700)) + alpha;
    }
    if (a.vert === 'FLC') {
      // The path angle power allows at the reference speed, plus a pull
      // toward the speed.
      const veq = 50 + 75 * state.power;
      const sinG = clamp((0.045 * (veq - a.ref.ias) + 0.25 * (state.ias - a.ref.ias)) / 19, -0.3, 0.3);
      pitchCmd = deg(Math.asin(sinG)) + alpha;
    }
    pitchCmd = clamp(pitchCmd, -10, 15);
    a.cmd = { roll: rollCmd, pitch: pitchCmd };

    const toward = (v, target, rate) => v + clamp(target - v, -rate * dt, rate * dt);
    if (a.ap) {
      state.roll = toward(state.roll, rollCmd, 5);
      state.pitch = toward(state.pitch, pitchCmd, 2);
    } else {
      state.roll = toward(state.roll, state.manual.roll, 8);
      state.pitch = toward(state.pitch, state.manual.pitch, 3);
    }

    const gamma = state.pitch - alpha;
    const veq = 50 + 75 * state.power;
    state.ias = clamp(state.ias + (0.045 * (veq - state.ias) - 19 * Math.sin(rad(gamma))) * dt, 35, 170);
    state.vs = T * 101.27 * Math.sin(rad(gamma));
    state.trueAlt += (state.vs / 60) * dt;
    const turnRate = (1091 * Math.tan(rad(state.roll))) / Math.max(T, 40);
    state.hdg = wrap360(state.hdg + turnRate * dt);
    const nm = (T / 3600) * dt;
    state.lat += (nm / 60) * Math.cos(rad(state.hdg));
    state.lon += (nm / 60) * Math.sin(rad(state.hdg)) / Math.cos(rad(state.lat));

    alerter();
  }

  // The selected altitude box: flashes when 1,000 ft out and again at 200
  // ft; turns yellow if the airplane then strays more than 200 ft.
  function alerter() {
    const al = state.alt, d = Math.abs(state.altSel - indicatedAlt());
    let next;
    if (d <= 200) next = 'reached';
    else if (al.phase === 'reached' || al.phase === 'deviate') next = 'deviate';
    else next = d <= 1000 ? 'approach' : 'far';
    if (next !== al.phase) {
      if (next !== 'far') al.flashUntil = state.t + 5;
      al.phase = next;
    }
  }
  // A new selected altitude starts the alerter over.
  let lastSel = state.altSel;
  function watchSel() {
    if (state.altSel !== lastSel) {
      lastSel = state.altSel;
      state.alt.phase = Math.abs(state.altSel - indicatedAlt()) <= 200 ? 'reached'
        : Math.abs(state.altSel - indicatedAlt()) <= 1000 ? 'approach' : 'far';
    }
  }

  // Pilot input with the autopilot off. Grabbing the controls with the
  // AP on would disconnect it in a real airplane; here the keys just wait.
  function fly({ pitch = 0, roll = 0, power = 0 }) {
    state.power = clamp(state.power + power, 0, 1);
    if (state.afcs.ap) return;
    state.manual.pitch = clamp(state.manual.pitch + pitch, -10, 15);
    state.manual.roll = clamp(state.manual.roll + roll, -30, 30);
  }

  return {
    state, reset, NAVAIDS, AIRPORTS, SPEEDS, MENUS, LIVE, RANGES,
    press, turn, push, fly, bearingDist, navSolution, indicatedAlt, tas, navModeName,
    tick(dt) {
      // Big gaps (a background tab) are skipped, small steps keep it stable.
      dt = Math.min(dt, 0.5);
      watchSel();
      for (let left = dt; left > 1e-6; left -= 0.05) step(Math.min(0.05, left));
    },
    menu: (display) => state.menus[display][state.menus[display].length - 1],
  };
})();
