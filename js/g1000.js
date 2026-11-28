// A mock of the C172S's G1000 NXi and GFC 700 autopilot, for study: the
// state behind the keys and knobs, and a simple airplane for them to fly.
// No three.js here: js/g1000-display.js draws the screens from `state`,
// js/g1000-panel.js turns clicks on the 3D panel into press/turn/push.
//
// What it models: COM and NAV radios (tuning, transfer, volume), the
// heading bug, course, baro, selected altitude and its alerter, the CDI
// source, the transponder, the PFD's softkey menus, and the GFC 700's mode
// logic (FD/AP, ROL PIT HDG ALT VS FLC NAV APR, ALTS capture, NOSE UP/DN),
// the PFD's inset and HSI maps (Map/HSI, Layout), through js/g1000-fms.js
// the flight plan, Direct-To, GPS legs and OBS mode, through
// js/g1000-pages.js the MFD's page groups (with Nearest Frequencies and
// Airspaces) and the PFD's Nearest window, through js/g1000-menu.js the
// MENU key's Page Menus and Map Setup, and through js/g1000-timer.js the
// Timer/References window, through js/g1000-systems.js the engine,
// electrical, fuel, vacuum and CO systems (and their failures), and
// through js/g1000-alerts.js the POH's annunciations, the messages and
// the Alerts window, the wind (state.wind: ground speed and track, the
// PFD's wind window), bearing pointers and DME, map pan and measure, user
// waypoints, GPS status (and loss of integrity), lean assist and the fuel
// totalizer, checklists (js/g1000-checklist.js) and the audio panel's
// selections (js/g1000-gma.js), and reversionary mode (the audio panel's
// DISPLAY BACKUP button: both displays show the PFD with the engine strip;
// see `reversion`). What it doesn't:
// VNAV, procedures and GPS approaches, LOC/GS, ADF, sound (no aural
// alerts), hardware-fault messages, the MFD's IFR pages. Headings, bugs, courses and bearings are magnetic (see
// magVarAt); the simulation underneath is true. The airplane is a few
// lines of kinematics, not a flight model.
// Behaviour follows the G1000 NXi and GFC 700 pilot's guides as remembered;
// to_verify.md lists what to check against the real guides.
window.G1000 = (function () {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wrap360 = (a) => ((a % 360) + 360) % 360;
  // Signed a - b in degrees, -180..180.
  const diff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
  const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

  // The database: Washington State's public-use airports (with runways and
  // frequencies) and VORs, from the FAA's NASR data (data/wa-nav.js, built
  // by build/wa_nav.py). Not for navigation: the cycle goes out of date.
  const NAVAIDS = WA_NAV.vors;
  // Class B, C and D shelves (ADDS), and the center, flight service and
  // weather outlets (Nearest Frequencies).
  const AIRSPACE = WA_NAV.airspace, COMMS = WA_NAV.comms;
  const AIRPORTS = WA_NAV.airports;
  // The flight plan's database: every airport and station above.
  const WAYPOINTS = [
    ...AIRPORTS.map((a) => ({ ...a, type: 'airport' })),
    ...NAVAIDS.map((n) => ({ ...n, type: 'vor' })),
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
  // Hectopascals in an inch of mercury.
  const HPA = 33.8639;

  // C172S airspeed indicator markings (POH section 2), KIAS.
  const SPEEDS = { white: [40, 85], green: [48, 129], yellow: [129, 163], vne: 163 };

  const ROOT_PFD = ['', 'Map/HSI', 'TFC Map', 'PFD Opt', 'OBS', 'CDI', 'ADF/DME', 'XPDR', 'Ident', 'Tmr/Ref', 'Nearest', 'Alerts'];
  const MENUS = {
    pfd: ROOT_PFD,
    'map-hsi': ['', 'Layout', '', '', '', '', '', '', '', '', 'Back', 'Alerts'],
    'map-layout': ['', 'Map Off', 'Inset Map', 'HSI Map', '', '', '', '', '', '', 'Back', 'Alerts'],
    'pfd-opt': ['SVT', '', 'Wind', 'DME', 'Bearing 1', '', 'Bearing 2', '', 'ALT Units', 'STD Baro', 'Back', 'Alerts'],
    // The wind window: three layouts, or none.
    wind: ['', '', 'Option 1', 'Option 2', 'Option 3', 'Off', '', '', '', '', 'Back', 'Alerts'],
    'alt-units': ['', '', '', '', '', 'Meters', '', 'IN', 'HPA', '', 'Back', 'Alerts'],
    xpdr: ['', '', 'Standby', 'On', 'Alt', '', 'VFR', 'Code', 'Ident', '', 'Back', 'Alerts'],
    'xpdr-code': ['0', '1', '2', '3', '4', '5', '6', '7', 'Ident', 'BKSP', 'Back', 'Alerts'],
    // The MFD's top row: by page (MFD_ROOTS); this is the Navigation Map's.
    mfd: ['Engine', '', 'Map Opt', '', '', '', '', '', '', 'Detail', 'Charts', 'Checklist'],
    // Map Opt: the map's overlays (none of their data is in the mock).
    'map-opt': ['Traffic', 'Inset', '', 'Topo', 'Terrain', 'Airways', '', 'NEXRAD', 'METAR', 'Legend', 'Back', ''],
    // The flight plan page's View: narrow (three data columns) or wide.
    'fpl-view': ['', '', '', '', 'Narrow', 'Wide', '', '', '', '', 'Back', ''],
    engine: ['Engine', 'Lean', 'System', '', '', '', '', '', '', '', 'Back', ''],
    // The EIS's Lean page: the cylinder shown, lean assist.
    lean: ['Engine', 'Lean', 'System', 'Cyl Slct', 'Assist', '', '', '', '', '', 'Back', ''],
    // The System page: the fuel totalizer's remaining fuel (set by the
    // pilot) and its fuel used.
    system: ['Engine', 'Lean', 'System', 'Rst Fuel', 'Dec Fuel', 'Inc Fuel', 'Rst Used', '', '', '', 'Back', ''],
    // The Checklist page (js/g1000-checklist.js).
    checklist: ['Engine', '', '', '', '', '', '', '', '', '', 'Exit', 'Emergency'],
  };
  // The softkeys that do something in the mock; the rest draw grey.
  const LIVE = {
    pfd: [1, 3, 4, 5, 6, 7, 8, 9, 10], 'pfd-opt': [2, 3, 4, 6, 8, 9, 10], wind: [2, 3, 4, 5, 10], 'alt-units': [5, 7, 8, 10], 'map-hsi': [1, 10], 'map-layout': [1, 2, 3, 10], xpdr: [2, 3, 4, 6, 7, 8, 10],
    'xpdr-code': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], mfd: [0, 2, 9, 11], 'map-opt': [10], 'fpl-view': [4, 5, 10], engine: [0, 1, 2, 10], lean: [0, 1, 2, 3, 4, 10],
    system: [0, 1, 2, 3, 4, 5, 6, 10], checklist: [0, 10, 11],
  };

  // The MFD's top softkey row on each page: the map pages' (Map Opt,
  // Detail), the flight plan's, Nearest Airports', Airport Information's,
  // and the rest (Engine and Checklist only). [labels, live].
  const MFD_ROOTS = {
    map: [MENUS.mfd, LIVE.mfd],
    fpl: [['Engine', '', 'Map Opt', 'New WPT', 'View', 'VNV Prof', 'Cncl VNV', 'VNV Direct', 'ATK Ofst', 'ACT Leg', 'Charts', 'Checklist'], [0, 2, 4, 9, 11]],
    nrstApt: [['Engine', '', 'Map Opt', '', '', 'APT', 'RNWY', 'FREQ', 'APR', 'LD APR', 'Charts', 'Checklist'], [0, 2, 11]],
    aptInfo: [['Engine', '', 'Map Opt', '', '', 'Info-1', 'DP', 'STAR', 'APR', 'WX', 'Charts', 'Checklist'], [0, 2, 11]],
    withMap: [['Engine', '', 'Map Opt', '', '', '', '', '', '', '', 'Charts', 'Checklist'], [0, 2, 11]],
    plain: [['Engine', '', '', '', '', '', '', '', '', '', '', 'Checklist'], [0, 11]],
  };
  const MFD_ROOT_OF = { 'MAP:0': 'map', 'FPL:0': 'fpl', 'NRST:0': 'nrstApt', 'WPT:0': 'aptInfo',
    'WPT:3': 'withMap', 'WPT:4': 'withMap', 'NRST:3': 'withMap', 'NRST:4': 'withMap' };
  // Detail (declutter) levels: All, then -1 to -3.
  const DCLTR = ['Detail All', 'Detail-1', 'Detail-2', 'Detail-3'];

  // Map symbol sizes (Map Setup shows each up to its own range): by the
  // longest runway, large from 8,100 ft, medium from 5,000 ft.
  const airportSize = (ap) => { const len = ap.runways[0]?.len ?? 0; return len >= 8100 ? 'L' : len >= 5000 ? 'M' : 'S'; };

  // Map ranges (NM), as the RANGE knob steps them.
  const RANGES = [1, 1.5, 2.5, 4, 5, 7.5, 10, 15, 25, 40, 50, 75, 100];

  // ---- Magnetic variation ----
  // The simulation runs in true (positions, the airplane's heading); what
  // the pilot sees and sets is magnetic: heading, bug, DTK, TRK, bearings.
  // Local variation (degrees, east +) is an inverse-distance mean of the
  // four nearest airports whose NASR variation is from 2010 or later:
  // older figures are stale (Washington's has fallen about 4° since 1985).
  // VORs use their own declared variation (js navSolution), as the real
  // stations are aligned to it.
  const VAR_POINTS = AIRPORTS.filter((a) => a.magVar != null && a.magVarYear >= 2010);
  function magVarAt(lat, lon) {
    const k = Math.cos(rad(lat));
    const near = VAR_POINTS.map((p) => ({ v: p.magVar, d: Math.hypot(p.lat - lat, (p.lon - lon) * k) }))
      .sort((a, b) => a.d - b.d).slice(0, 4);
    if (near[0].d < 1e-6) return near[0].v;
    const w = near.map((n) => 1 / n.d);
    return near.reduce((sum, n, i) => sum + n.v * w[i], 0) / w.reduce((a, b) => a + b, 0);
  }
  // True to magnetic with the local variation (or `v`), and back.
  const toMag = (t, v = state.magVar) => wrap360(t - v);
  const toTrue = (m, v = state.magVar) => wrap360(m + v);

  const state = {};
  // Flight planning (js/g1000-fms.js) keeps its part of the state in
  // state.fms.
  const fms = G1000_FMS.create({
    state, bearingDist, waypoints: WAYPOINTS, note: (text) => note(text), magVarAt,
  });
  // The MFD's page groups and the PFD's Nearest window
  // (js/g1000-pages.js), in state.mfd.
  const pages = G1000_PAGES.create({
    state, bearingDist, waypoints: WAYPOINTS, fms, note: (text) => note(text),
    gs: () => gs(), track: () => track(), fuelFlow: () => fuelFlow(), toMag: (t) => toMag(t),
    openMenu: () => menus.open('mfd'), comms: COMMS, airspace: AIRSPACE, indicatedAlt: () => indicatedAlt(),
  });
  // The MENU key's Page Menu and Map Setup windows (js/g1000-menu.js), in
  // state.pageMenu; the map's settings in state.mapSet.
  // Messages, the airspace alerts and the Alerts window
  // (js/g1000-alerts.js), in state.alerts; their settings in state.alertSet.
  // The airplane's systems: engine, oil, vacuum, electrical, fuel tanks,
  // CO (js/g1000-systems.js), in state.sys; failures in state.sys.failed.
  const systems = G1000_SYSTEMS.create({ state });
  // The navigation database runs out 28 days after its cycle starts.
  const cycle = /effective (\d+) (\w+) (\d{4})/.exec(WA_NAV.source);
  const DB_EXPIRES = cycle ? Date.parse(`${cycle[1]} ${cycle[2]} ${cycle[3]} 00:00 UTC`) + 28 * 86400000 : null;
  const alerts = G1000_ALERTS.create({
    state, pages, annunciations: () => systems.annunciations(), gpsNav: () => fms.navSolution(),
    gs: () => gs(), dbExpires: DB_EXPIRES,
  });
  // The PFD's Timer/References window (js/g1000-timer.js), in state.ref.
  const timer = G1000_TIMER.create({ state, note: (text) => note(text), indicatedAlt: () => indicatedAlt() });
  const menus = G1000_MENU.create({ state, fms, pages, timer, note: (text) => note(text), ranges: RANGES });
  // The audio panel (js/g1000-gma.js), in state.gma.
  const gma = G1000_GMA.create({ state, note: (text) => note(text) });
  // The MFD's Checklist page (js/g1000-checklist.js), in state.chk.
  const checklist = G1000_CHECKLIST.create({ state, lists: window.G1000_CHECKLISTS ?? [] });
  function reset() {
    Object.assign(state, {
      t: 0,
      // The airplane: 3,500 ft over Everett, northbound, cruise power.
      lat: 47.80, lon: -122.27, trueAlt: 3500, hdg: 340, ias: 110, pitch: 2.0, roll: 0, power: 0.8,
      vs: 0,
      // Leaned for best power at 3,500 ft (0 idle cutoff, 1 full rich).
      mixture: systems.bestPowerMixture(3500),
      // The wind: from (true), knots. Calm unless set (the Wind list in
      // Operate mode, or setWind). windShow: the PFD's wind window
      // (PFD Opt, Wind): 'Off', or layout '1', '2' or '3'.
      wind: { dir: 0, spd: 0 }, windShow: 'Off',
      // The day's temperature: °C above (+) or below ISA (the
      // Temperature list in Operate mode, or setIsaDev).
      isaDev: 0,
      // The HSI's bearing pointers (PFD Opt, Bearing 1 and 2): null, a NAV
      // radio ('NAV1', 'NAV2') or 'GPS'.
      brg: [null, null],
      // The DME window (PFD Opt, DME) and its tuning (ADF/DME): NAV1, NAV2,
      // or HOLD on the frequency it had (hold).
      dme: { on: false, src: 'NAV1', hold: null },
      // The MFD map's pan pointer (RANGE knob push): null, or { lat, lon,
      // measure: the start of a bearing/distance measurement or null }.
      pan: null,
      // Pilot input with the autopilot off (arrow keys): attitude targets.
      manual: { pitch: 2.0, roll: 0 },
      baro: ACTUAL_BARO,
      // STD Baro (the PFD Opt softkey): shows STD BARO until the BARO knob
      // turns. A 29.92 dialled by hand reads 29.92IN.
      baroStd: false,
      // The standby altimeter's own Kollsman setting (set before flight).
      stbyBaro: ACTUAL_BARO,
      com: [{ act: 132.950, stby: 120.200 }, { act: 128.650, stby: 121.900 }], comTune: 0,
      nav: [{ act: 110.60, stby: 116.80 }, { act: 116.80, stby: 110.60 }], navTune: 0,
      // A volume change shows in place of the standby frequency briefly.
      // sqOff: COM squelch turned off; navId: NAV Morse identifier on.
      vol: { com: [80, 80], nav: [60, 60], show: null, sqOff: [false, false], navId: [false, false] },
      // PFD Opt, ALT Units: the metric overlay, and the baro unit (IN, HPA).
      altUnits: { meters: false, baro: 'IN' },
      hdgBug: 340, crs: [340, 340], altSel: 5500,
      cdi: 'GPS',
      // The GPS CDI's full scale (AUX - System Setup): 'AUTO' (by flight
      // phase), or '2.0', '1.0', '0.3' NM, used when tighter than AUTO's.
      cdiScale: 'AUTO',
      // flightId: sent with the transponder's replies (AUX - System Setup).
      // entry: a code being entered (Code softkey), by the digit softkeys
      // or, knob true, by the FMS knobs.
      xpdr: { code: '1200', mode: 'ALT', identUntil: 0, entry: null, knob: false, flightId: 'N172SP' },
      afcs: { ap: false, fd: false, lat: null, latArmed: null, vert: null, vertArmed: null,
              ref: { pitch: 0, roll: 0, vs: 0, ias: 0, alt: 0 }, changed: {}, apOffAt: -99,
              // apAbnormal: the last disconnect wasn't the pilot's (AP red and
              // white until acknowledged). lost: a mode the FD dropped for lack
              // of guidance, flashing yellow in its slot ({ axis, mode, at }).
              apAbnormal: false, lost: null,
              // CWS (the yoke's Control Wheel Steering button) held: the
              // servos let go and the pilot flies; let go, the references
              // sync to the attitude then.
              cws: false },
      // Selected altitude alerter: 'approach' (within 1,000 ft), 'reached'
      // (within 200 ft), 'deviate' (off by more than 200 ft once reached).
      alt: { phase: 'far', flashUntil: 0 },
      menus: { pfd: ['pfd'], mfd: ['mfd'] },
      mfd: pages.fresh(), eisPage: 'Engine', range: 6,
      // The Navigation Map's Detail level (0 all, 1-3 less).
      dcltr: 0,
      // The PFD's map (Map/HSI, Layout): 'Map Off', 'Inset Map' or 'HSI Map',
      // and its range (an index into RANGES).
      pfdMap: { layout: 'Map Off', range: 4 }, pfdMapSet: menus.freshPfdMap(),
      // Usable fuel on board, gallons (both tanks).
      fuel: 48, fuelL: 24, fuelR: 24, sys: systems.fresh(),
      // A line of text for the last thing the mock can't do yet.
      note: null,
      // Reversionary mode (DISPLAY BACKUP): both displays show the PFD
      // with the EIS strip, and the MFD's keys and knobs work the PFD.
      reversion: false,
      fms: fms.fresh(),
      pageMenu: menus.fresh(), mapSet: menus.freshMap(), ref: timer.fresh(),
      alerts: alerts.fresh(), alertSet: alerts.freshSet(), chk: checklist.fresh(), gma: gma.fresh(),
    });
    state.afcs.ref.alt = state.trueAlt;
    // Northbound means 340° magnetic: the true heading carries the
    // variation. (Bug and courses above are magnetic.)
    state.magVar = magVarAt(state.lat, state.lon);
    state.hdg = toTrue(340);
  }
  reset();

  const indicatedAlt = () => state.trueAlt + (state.baro - ACTUAL_BARO) * 1000;
  // The standby altimeter, by its own setting.
  const standbyAlt = () => state.trueAlt + (state.stbyBaro - ACTUAL_BARO) * 1000;
  // Outside air temperature (°C): the standard lapse from 15 °C, plus the
  // day's deviation from it.
  const oat = () => 15 - 2 * state.trueAlt / 1000 + state.isaDev;
  // Density altitude: about 120 ft for each °C above standard.
  const densityAlt = () => state.trueAlt + 120 * state.isaDev;
  // TAS: about 2% more than IAS per 1,000 ft of density altitude.
  const tas = () => state.ias * (1 + 0.02 * densityAlt() / 1000);
  // Fuel flow (GPH): made up from power and altitude, not the POH's tables.
  // None with the engine stopped.
  // Leaner or richer than best power scales it (js/g1000-systems.js).
  const fuelFlow = () => (state.sys.running
    ? (2 + 9 * state.power * (1 - state.trueAlt / 30000)) * systems.mixtureEffect().fuel : 0);
  // The power the engine makes: none once it has stopped, less lean of
  // peak.
  const power = () => (state.sys.running ? state.power * systems.mixtureEffect().power : 0);

  // ---- Wind: ground speed and track ----
  // The airplane's velocity over the ground: its TAS along the heading
  // plus the wind's (which blows toward wind.dir + 180). Track is true.
  function groundVector() {
    const T = tas(), w = state.wind, h = rad(state.hdg), to = rad(w.dir + 180);
    const n = T * Math.cos(h) + w.spd * Math.cos(to), e = T * Math.sin(h) + w.spd * Math.sin(to);
    return { gs: Math.hypot(n, e), trk: wrap360(deg(Math.atan2(e, n))) };
  }
  const gs = () => groundVector().gs;
  const track = () => groundVector().trk;
  // The wind as the PFD shows it: from (magnetic), speed, its head (+)
  // and cross (+ from the right) components, and where it comes from
  // relative to the nose (degrees, + right).
  function windInfo() {
    const w = state.wind, rel = diff(w.dir, state.hdg);
    return { dir: toMag(w.dir), spd: w.spd, head: w.spd * Math.cos(rad(rel)), cross: w.spd * Math.sin(rad(rel)), rel };
  }

  // ---- Bearing pointers and DME ----
  // A bearing pointer's target: { id, brg (magnetic), dist } or null (no
  // station tuned or received, no GPS waypoint).
  function bearingTo(src) {
    if (!src) return null;
    if (src === 'GPS') {
      const l = fms.leg(), nav = fms.navSolution();
      return l && nav ? { id: l.to.id, brg: nav.bearingTo, dist: nav.dist } : null;
    }
    const st = tunedStation(src === 'NAV1' ? 0 : 1);
    if (!st) return null;
    const { brg, dist } = bearingDist(state, st);
    return dist > 60 ? null : { id: st.id, brg: toMag(brg), dist };
  }
  // The DME: slant range to the VOR/DME or VORTAC on the radio it is
  // tuned by (or the frequency it holds). { freq, id, dist }, or { freq }
  // with no DME received.
  function dmeInfo() {
    const d = state.dme, freq = d.src === 'HOLD' ? d.hold : state.nav[d.src === 'NAV1' ? 0 : 1].act;
    const st = NAVAIDS.find((n) => Math.abs(n.freq - freq) < 0.001 && /DME|TAC/.test(n.kind));
    if (!st) return { freq };
    const dist = bearingDist(state, st).dist, up = (state.trueAlt - (st.elev ?? 0)) / 6076;
    return dist > 100 ? { freq } : { freq, id: st.id, dist: Math.hypot(dist, up) };
  }

  // ---- The MFD map's pan pointer ----
  // Which way is up on a map: north, the track or the heading (true).
  function mapUp(display = 'mfd') {
    const orient = (display === 'pfd' ? state.pfdMapSet : state.mapSet).orient;
    return orient === 'North Up' ? 0 : orient === 'Track Up' ? track() : state.hdg;
  }
  // Pan: the pointer moves an eighth of the map range per step, in the
  // map's own directions (dx right, dy up).
  function pan(dx, dy) {
    const p = state.pan;
    if (!p) return;
    const d = (RANGES[state.range] / 8) * Math.hypot(dx, dy);
    if (!d) return;
    Object.assign(p, fms.project(p, mapUp() + deg(Math.atan2(dx, dy)), d));
  }
  // The waypoint under the pointer: the nearest within a twentieth of the
  // range (0.3 NM at least), or null.
  function panTarget() {
    const p = state.pan;
    if (!p) return null;
    const reach = Math.max(0.3, RANGES[state.range] / 20);
    let best = null;
    for (const w of [...WAYPOINTS, ...state.fms.user]) {
      if (Math.abs(w.lat - p.lat) > 1 || Math.abs(w.lon - p.lon) > 1.5) continue;
      const d = bearingDist(p, w).dist;
      if (d < reach && (!best || d < best.d)) best = { w, d };
    }
    return best?.w ?? null;
  }
  const panPage = () => ['MAP:0', 'FPL:0'].includes(pages.pageKey());
  // A one-off help note (why a key did nothing, what the mock leaves out).
  // Not drawn on the displays, which the real unit wouldn't show: kept
  // for a separate help UI.
  const note = (text) => { state.note = { text, until: state.t + 4 }; };

  // ---- Navigation: the active CDI source's deviation ----
  function tunedStation(i) {
    return NAVAIDS.find((n) => Math.abs(n.freq - state.nav[i].act) < 0.001) ?? null;
  }
  // { source, station, course (magnetic, as shown), courseTrue (for the
  // autopilot and the map), toFrom, dev (needle, -1..1 of full scale,
  // + = needle right), xtk (NM, + = right of course), dist, bearingTo
  // (magnetic), capturable (close enough for NAV to capture) } or null
  // when the source has no signal (GPS: no active leg).
  function navSolution(src = state.cdi) {
    if (src === 'GPS') return fms.navSolution();
    const i = src === 'VOR1' ? 0 : 1;
    const st = tunedStation(i);
    if (!st) return null;
    const { brg, dist } = bearingDist(st, state);
    if (dist > 60) return null;
    // Radials and the selected course are magnetic by the station's own
    // declared variation, which can differ from the local one by degrees.
    const radial = toMag(brg, st.magVar);
    const crs = state.crs[i];
    const from = Math.abs(diff(radial, crs)) <= 90;
    const off = from ? diff(radial, crs) : -diff(radial, wrap360(crs + 180));
    return { source: src, station: st, course: crs, courseTrue: toTrue(crs, st.magVar), toFrom: from ? 'FROM' : 'TO',
             dev: clamp(-off / 10, -1, 1), offDeg: off, xtk: dist * Math.sin(rad(off)), dist,
             bearingTo: wrap360(radial + 180), radial, capturable: Math.abs(off) < 7 };
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
    // The GFC 700 holds indicated (baro-corrected) altitude.
    if (mode === 'ALT') r.alt = Math.round(indicatedAlt() / 10) * 10;
  }
  // GA (the throttle's Go-Around button): wings level, a fixed pitch up.
  const GA_PITCH = 7;
  // The references to the attitude now (CWS released): bank in ROL,
  // pitch in PIT, the vertical speed, airspeed or altitude in VS, FLC, ALT.
  function syncRefs() {
    const a = state.afcs, r = a.ref;
    if (a.lat === 'ROL') r.roll = clamp(state.roll, -22, 22);
    if (a.vert === 'PIT') r.pitch = clamp(state.pitch, -10, 15);
    if (a.vert === 'VS') r.vs = clamp(Math.round(state.vs / 100) * 100, -1500, 1500);
    if (a.vert === 'FLC') r.ias = clamp(Math.round(state.ias), 55, 120);
    if (a.vert === 'ALT') r.alt = Math.round(indicatedAlt() / 10) * 10;
  }
  // CWS held (on) or let go.
  function cws(on) {
    const a = state.afcs;
    if (a.cws === on) return;
    a.cws = on;
    // Held: the pilot holds the attitude the airplane has.
    if (on) { state.manual.pitch = state.pitch; state.manual.roll = state.roll; } else if (a.fd) syncRefs();
  }
  // A reversion for lack of guidance (no VOR signal, CDI source changed):
  // the lost mode flashes yellow for 10 seconds, then the default shows.
  function lose(axis) {
    const a = state.afcs;
    if (a[axis]) a.lost = { axis, mode: a[axis], at: state.t };
    setMode(axis, axis === 'lat' ? LAT_DEFAULT : VERT_DEFAULT);
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
  // abnormal: not the pilot's (a trim fault, power loss): AP flashes red
  // and white until acknowledged; the pilot's disconnect flashes yellow.
  function apDisconnect(abnormal = false) {
    state.afcs.ap = false;
    state.afcs.apOffAt = state.t;
    state.afcs.apAbnormal = abnormal;
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
    if (mode === 'APR' && state.cdi === 'GPS') return note('GPS approaches: not in the mock yet');
    const nav = navSolution();
    if (!nav) {
      note(state.cdi === 'GPS' ? 'No active GPS leg: make one with FPL or D→'
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
    if (nav.capturable) setMode('lat', mode); else arm('lat', mode);
  }
  const navModeName = (mode) => {
    const src = state.cdi === 'GPS' ? 'GPS' : 'VOR';
    return mode === 'APR' ? (src === 'VOR' ? 'VAPP' : 'GPS') : src;
  };

  // ---- Keys, knobs and softkeys ----
  // Keys for whatever has the display: an open Page Menu or Map Setup
  // first (MENU opens the Page Menu); the MFD's FPL key changes page;
  // the PFD's Nearest window and the MFD's page cursors take ENT and CLR;
  // the rest (D→, FPL, PROC, and ENT/CLR/MENU in an FMS window) go to
  // js/g1000-fms.js, D→ offering what the page shows. True when handled.
  function windowKey(key, display) {
    if (['ent', 'clr', 'menu', 'fpl', 'direct_to', 'proc'].includes(key) && menus.press(key, display)) return true;
    // The MFD map's pointer: CLR stops measuring, then puts it away; ENT
    // makes a user waypoint where it points (or names what is there); D→
    // offers what it points at.
    const mw = state.fms.win.mfd;
    if (display === 'mfd' && state.pan && !mw?.entry && mw?.type !== 'dto') {
      if (key === 'clr') { if (state.pan.measure) state.pan.measure = null; else state.pan = null; return true; }
      if (key === 'ent') {
        const at = panTarget();
        if (at) { note(`${at.id}: ${at.name ?? ''}`); return true; }
        const w = fms.addUser({ lat: state.pan.lat, lon: state.pan.lon });
        if (w) note(`User waypoint ${w.id} created at the pointer`);
        return true;
      }
      if (key === 'direct_to') return fms.press(key, display, { dtoDefault: panTarget()?.id ?? null });
    }
    // The Checklist page takes ENT and CLR.
    if (display === 'mfd' && !mw && checklist.isOpen() && (key === 'ent' || key === 'clr')) return checklist.press(key);
    const win = state.fms.win[display];
    if (display === 'mfd' && key === 'fpl' && win?.type !== 'dto') { pages.fplKey(); return true; }
    if (display === 'pfd' && win?.type === 'nrst' && (key === 'ent' || key === 'clr')) return pages.pfdInput(key);
    if (display === 'pfd' && win?.type === 'tmr' && (key === 'ent' || key === 'clr')) return timer.input(key);
    if (display === 'pfd' && win?.type === 'alerts' && (key === 'ent' || key === 'clr')) return alerts.input(key);
    if (display === 'mfd' && !win && pages.press(key)) return true;
    const handled = fms.press(key, display, { dtoDefault: pages.selectedIdent(display) });
    pages.sync();
    // The pointer belongs to the map pages.
    if (state.pan && !panPage()) state.pan = null;
    return handled;
  }
  // In reversionary mode both displays are the PFD: the MFD's bezel works
  // it too.
  const pfdIfReverted = (display) => (state.reversion ? 'pfd' : display);
  // DISPLAY BACKUP: into reversionary mode, or back out (the PFD's own
  // softkeys back at the top: the engine menus belong to the MFD then).
  function displayBackup() {
    state.reversion = !state.reversion;
    if (!state.reversion && ['engine', 'lean', 'system'].includes(menu('pfd'))) state.menus.pfd = ['pfd'];
    if (!state.reversion) state.eisPage = 'Engine';
  }
  // The softkey labels a menu shows, and which of them do something: the
  // PFD's top menu gains Engine (the EIS pages) in reversionary mode.
  const mfdRoot = () => MFD_ROOTS[MFD_ROOT_OF[pages.pageKey()] ?? 'plain'];
  function labelsOf(m) {
    if (m === 'pfd' && state.reversion) return ['Engine', ...MENUS.pfd.slice(1)];
    if (m === 'mfd') return mfdRoot()[0].map((l) => (l === 'Detail' ? DCLTR[state.dcltr] : l));
    return MENUS[m];
  }
  const liveOf = (m) => (m === 'pfd' && state.reversion ? [0, ...LIVE.pfd] : m === 'mfd' ? mfdRoot()[1] : LIVE[m]);
  // The MFD's page-specific softkeys (Map Opt, View) go back to the top row
  // when the page changes.
  const PAGE_MENUS = { 'map-opt': () => mfdRoot()[0].includes('Map Opt'), 'fpl-view': () => pages.pageKey() === 'FPL:0' };
  function syncMfdMenus() {
    const st = state.menus.mfd, top = st[st.length - 1];
    if (PAGE_MENUS[top] && !PAGE_MENUS[top]()) state.menus.mfd = ['mfd'];
  }
  const menu = (display) => {
    const d = pfdIfReverted(display);
    return state.menus[d][state.menus[d].length - 1];
  };

  function press(key, display = 'pfd') {
    const a = state.afcs;
    // The audio panel's keys ('gma:com1_mic' and so on), and its DISPLAY
    // BACKUP button.
    if (key.startsWith('gma:')) return gma.press(key.slice(4));
    if (key === 'display_backup') return displayBackup();
    display = pfdIfReverted(display);
    // Code entry by the FMS knobs: ENT sends it.
    if (key === 'ent' && display === 'pfd' && xpdrKnobEntry()) {
      const x = state.xpdr;
      if (x.entry.length === 4) { x.code = x.entry; x.entry = null; x.knob = false; state.menus.pfd.pop(); }
      return;
    }
    if (windowKey(key, display)) return;
    switch (key) {
      case 'ap':
        if (a.ap) apDisconnect();
        // No attitude or air data: no autopilot or flight director.
        else if (!afcsSensors()) { a.apAbnormal = false; return; }
        // An abnormal disconnect's flashing AP: this press acknowledges it
        // (the real AP DISC switch isn't modelled).
        else if (a.apAbnormal) a.apAbnormal = false;
        // PTRM: the POH says not to engage the autopilot again.
        else if (state.sys.failed.trim) note('PTRM: pitch trim failure. Do not engage the autopilot');
        else if (systems.buses().avn2) { fdOn(); a.ap = true; }
        return;
      case 'fd':
        // The FD can't go off while the AP flies.
        if (a.ap) return;
        if (!a.fd && !afcsSensors()) return;
        if (a.fd) fdOff(); else fdOn();
        return;
      // The yoke's A/P TRIM DISC: disconnects the autopilot (and
      // acknowledges an abnormal disconnect).
      case 'ap_disc':
        if (a.ap) apDisconnect();
        else a.apAbnormal = false;
        return;
      // Manual electric trim (the yoke's split switch): disconnects the
      // autopilot; hand flying, it trims the pitch.
      case 'trim_up': case 'trim_dn': {
        if (state.sys.failed.trim) return;
        if (a.ap) { apDisconnect(); return; }
        const d = key === 'trim_up' ? 0.3 : -0.3;
        state.manual.pitch = clamp(state.manual.pitch + d, -10, 15);
        return;
      }
      // The throttle's Go-Around button: the autopilot off, the flight
      // director in GA (wings level, pitch up), ALTS armed for the
      // selected altitude (step()).
      case 'ga':
        if (!afcsSensors()) return;
        if (a.ap) apDisconnect();
        a.fd = true;
        setMode('lat', 'GA');
        setMode('vert', 'GA');
        arm('lat', null);
        return;
      case 'hdg': return modeKey('lat', 'HDG');
      case 'nav': return navKey('NAV');
      case 'apr': return navKey('APR');
      case 'bc': return note('BC needs a localizer: not in the mock');
      case 'vnv': return note('VNV: vertical navigation is not in the mock yet');
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
      // CLR clears windows and cursors (above); it doesn't change the
      // softkeys (BACK does).
      case 'clr': return;
      case 'ent':
        return note('ENT: nothing to do here in the mock (open FPL or D→)');
      default:
        if (key.startsWith('softkey:')) return softkey(display, Number(key.slice(8)));
    }
  }
  // Keys that do something else when held, and for how long (s): COM
  // transfer puts 121.5 in the tuned COM's active frequency; CLR on the
  // MFD goes back to the Navigation Map.
  const HOLD = { com_transfer: 2, clr: 1 };
  function hold(key, display = 'pfd') {
    display = pfdIfReverted(display);
    if (key === 'com_transfer') { state.com[state.comTune].act = 121.5; return; }
    if (key === 'clr' && display === 'mfd') {
      state.fms.win.mfd = null;
      menus.close('mfd');
      state.pan = null;
      if (checklist.isOpen()) checklist.close();
      state.menus.mfd = ['mfd'];
      pages.goPage(0, 0);
      return;
    }
    // Held anywhere else: as a press.
    press(key, display);
  }
  // The GFC 700 needs the AHRS and the air data computer.
  const afcsSensors = () => !state.sys.failed.adc && !state.sys.failed.ahrs;
  function nose(dir) {
    const a = state.afcs, r = a.ref;
    if (!a.fd) return;
    if (a.vert === 'PIT') r.pitch = clamp(r.pitch + 0.5 * dir, -10, 15);
    else if (a.vert === 'VS') r.vs = clamp(r.vs + 100 * dir, -1500, 1500);
    // FLC: nose up is slower.
    else if (a.vert === 'FLC') r.ias = clamp(r.ias - dir, 55, 120);
    // ALT: the reference 10 ft a press.
    else if (a.vert === 'ALT') r.alt += 10 * dir;
  }
  // The XPDR Code softkeys are out with no PFD window open: the FMS knobs
  // enter the code too.
  const xpdrKnobEntry = () => menu('pfd') === 'xpdr-code' && !state.fms.win.pfd && state.xpdr.entry !== null;
  // Small knob: the first two digits; large knob: the last two (each pair
  // 00-77, octal). ENT sends the code.
  function xpdrKnob(part, steps) {
    const x = state.xpdr;
    if (!x.knob) { x.entry = x.code; x.knob = true; }
    const pairs = [x.entry.slice(0, 2), x.entry.slice(2, 4)].map((p) => parseInt(p.padEnd(2, '0'), 8));
    const i = part === 'inner' ? 0 : 1;
    pairs[i] = wrapInt(pairs[i] + steps, 64);
    x.entry = pairs.map((p) => p.toString(8).padStart(2, '0')).join('');
  }

  function softkey(display, i) {
    const stack = state.menus[display];
    const menu = stack[stack.length - 1];
    const label = labelsOf(menu)[i];
    if (!label) return;
    // ALERTS, the last softkey on every PFD menu.
    if (label === 'Alerts' && display === 'pfd') return alerts.softkey();
    if (!liveOf(menu).includes(i)) return note(label + ': not in the mock yet');
    const x = state.xpdr;
    switch (menu + ':' + label) {
      case 'pfd:PFD Opt': stack.push('pfd-opt'); return;
      case 'pfd:Map/HSI': stack.push('map-hsi'); return;
      case 'map-hsi:Layout': stack.push('map-layout'); return;
      // The PFD's map: none, an inset at the lower left, or inside the HSI.
      case 'map-layout:Map Off': case 'map-layout:Inset Map': case 'map-layout:HSI Map':
        state.pfdMap.layout = label;
        return;
      case 'pfd:Nearest': pages.pfdNearest(); return;
      case 'pfd:Tmr/Ref': timer.toggle(); return;
      case 'pfd:OBS':
        if (state.cdi !== 'GPS') return note('OBS: set the course with CRS (OBS mode is for GPS)');
        if (!fms.toggleObs()) note('OBS needs an active GPS waypoint: make one with FPL or D→');
        return;
      case 'pfd:CDI': {
        const order = ['GPS', 'VOR1', 'VOR2'];
        state.cdi = order[(order.indexOf(state.cdi) + 1) % 3];
        // A NAV mode on the old source drops back to ROL.
        if (['NAV', 'APR'].includes(state.afcs.lat)) lose('lat');
        if (['NAV', 'APR'].includes(state.afcs.latArmed)) arm('lat', null);
        return;
      }
      case 'pfd:XPDR': stack.push('xpdr'); return;
      case 'pfd:Ident': case 'xpdr:Ident': case 'xpdr-code:Ident':
        x.identUntil = state.t + 18;
        if (menu !== 'pfd') stack.splice(1);
        return;
      case 'pfd-opt:STD Baro': state.baro = 29.92; state.baroStd = true; return;
      case 'pfd-opt:Wind': stack.push('wind'); return;
      case 'wind:Option 1': case 'wind:Option 2': case 'wind:Option 3': state.windShow = label.slice(-1); return;
      case 'wind:Off': state.windShow = 'Off'; return;
      case 'wind:Back': stack.pop(); return;
      // Each press: off, NAV (1 or 2), GPS, off. (ADF isn't in the mock.)
      case 'pfd-opt:Bearing 1': case 'pfd-opt:Bearing 2': {
        const i = label.endsWith('1') ? 0 : 1, order = [null, 'NAV' + (i + 1), 'GPS'];
        state.brg[i] = order[(order.indexOf(state.brg[i]) + 1) % order.length];
        return;
      }
      case 'pfd-opt:DME': state.dme.on = !state.dme.on; return;
      // ADF/DME: here only the DME's tuning, each press the next of NAV1,
      // NAV2 and HOLD (on the frequency it had).
      case 'pfd:ADF/DME': {
        const d = state.dme, order = ['NAV1', 'NAV2', 'HOLD'];
        const next = order[(order.indexOf(d.src) + 1) % 3];
        if (next === 'HOLD') d.hold = dmeInfo().freq;
        d.src = next;
        note(`DME tuning: ${next}${next === 'HOLD' ? ' ' + d.hold.toFixed(2) : ''}`);
        return;
      }
      case 'pfd-opt:ALT Units': stack.push('alt-units'); return;
      // A metric readout beside the altitude; the baro in inches or hPa.
      case 'alt-units:Meters': state.altUnits.meters = !state.altUnits.meters; return;
      case 'alt-units:IN': case 'alt-units:HPA': state.altUnits.baro = label; return;
      case 'xpdr:Standby': x.mode = 'STBY'; return;
      case 'xpdr:On': x.mode = 'ON'; return;
      case 'xpdr:Alt': x.mode = 'ALT'; return;
      case 'xpdr:VFR': x.code = '1200'; return;
      case 'xpdr:Code': x.entry = ''; x.knob = false; stack.push('xpdr-code'); return;
      case 'xpdr-code:BKSP': x.entry = x.entry.slice(0, -1); return;
      case 'pfd-opt:Back': case 'xpdr:Back': case 'engine:Back': case 'map-hsi:Back': case 'map-layout:Back': case 'alt-units:Back':
        stack.pop(); return;
      case 'xpdr-code:Back': x.entry = null; x.knob = false; stack.pop(); return;
      case 'mfd:Engine': case 'pfd:Engine': stack.push('engine'); return;
      case 'mfd:Map Opt': stack.push('map-opt'); return;
      case 'map-opt:Back': case 'fpl-view:Back': stack.pop(); return;
      case 'mfd:Detail All': case 'mfd:Detail-1': case 'mfd:Detail-2': case 'mfd:Detail-3':
        state.dcltr = (state.dcltr + 1) % DCLTR.length; return;
      case 'mfd:View': stack.push('fpl-view'); return;
      case 'fpl-view:Narrow': case 'fpl-view:Wide': state.fms.view = label; return;
      // ACT Leg: the leg to the waypoint under the cursor, asked first.
      case 'mfd:ACT Leg': {
        const win = state.fms.win.mfd, f = state.fms.fpl, c = win?.cursor;
        if (win?.type !== 'fpl' || c == null || c < 1 || c >= f.wpts.length) return note('ACT Leg: push FMS and pick a waypoint after the first');
        win.prompt = { text: `Activate leg to ${f.wpts[c]}?`, action: () => fms.activateLeg(c) };
        return;
      }
      case 'mfd:Checklist': checklist.open(); stack.push('checklist'); return;
      case 'checklist:Exit': checklist.close(); stack.pop(); return;
      case 'checklist:Emergency': checklist.emergency(); return;
      case 'checklist:Engine': checklist.close(); stack[stack.length - 1] = 'engine'; return;
      // The EIS pages; Lean and System bring their own softkeys.
      case 'engine:Engine': case 'engine:Lean': case 'engine:System':
      case 'lean:Engine': case 'lean:Lean': case 'lean:System':
      case 'system:Engine': case 'system:Lean': case 'system:System':
        state.eisPage = label;
        stack[stack.length - 1] = { Engine: 'engine', Lean: 'lean', System: 'system' }[label];
        return;
      case 'lean:Cyl Slct': systems.cylSlct(); return;
      case 'lean:Assist': systems.assist(); return;
      case 'system:Rst Fuel': case 'system:Dec Fuel': case 'system:Inc Fuel': case 'system:Rst Used':
        systems.totalizer(label); return;
      case 'lean:Back': case 'system:Back': state.eisPage = 'Engine'; stack.pop(); return;
    }
    if (menu === 'xpdr-code' && /^[0-7]$/.test(label)) {
      // A digit softkey after knob entry starts the code over.
      if (x.knob) { x.entry = ''; x.knob = false; }
      x.entry += label;
      // Four digits entered: the code takes effect, back to the XPDR menu.
      if (x.entry.length === 4) { x.code = x.entry; x.entry = null; stack.pop(); }
    }
  }

  // knob: com, nav, hdg, alt, crs_baro, fms, range, com_volume,
  // nav_volume. part: 'inner' or 'outer' (one-piece knobs ignore it).
  // steps: + clockwise.
  function turn(knob, part, steps, display = 'pfd') {
    display = pfdIfReverted(display);
    switch (knob) {
      // The ignition switch (js/g1000-systems.js turnMags).
      case 'mags': systems.turnMags(steps); return;
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
        state.altSel = clamp(state.altSel + steps * (part === 'outer' ? 1000 : 100), -1000, 50000);
        // Changed during capture: back to PIT, ALTS armed again (step()).
        if (state.afcs.vert === 'ALTS') setMode('vert', VERT_DEFAULT);
        return;
      case 'crs_baro':
        if (part === 'outer') state.baroStd = false;
        if (part === 'outer' && state.altUnits.baro === 'HPA') {
          // In hPa: whole hectopascals.
          state.baro = clamp((Math.round(state.baro * HPA) + steps) / HPA, 27.0, 31.0);
        } else if (part === 'outer') {
          state.baro = clamp(+(state.baro + steps * 0.01).toFixed(2), 27.0, 31.0);
        } else if (state.cdi !== 'GPS') {
          const i = state.cdi === 'VOR1' ? 0 : 1;
          state.crs[i] = wrap360(state.crs[i] + steps);
        } else if (state.fms.obs) {
          // OBS: the course through the active waypoint.
          state.fms.obs.crs = wrap360(state.fms.obs.crs + steps);
        }
        return;
      // Each display's RANGE knob zooms its own map.
      // The standby altimeter's knob: its own Kollsman setting.
      case 'stby_baro': state.stbyBaro = clamp(+(state.stbyBaro + steps * 0.01).toFixed(2), 28.0, 31.0); return;
      // The audio panel's volume knob: small knob volume, large squelch.
      case 'gma_vol': return gma.turn(part, steps);
      case 'range': {
        const m = display === 'pfd' ? state.pfdMap : state;
        m.range = clamp(m.range - steps, 0, RANGES.length - 1);
        return;
      }
      case 'com_volume': case 'nav_volume': {
        const kind = knob === 'com_volume' ? 'com' : 'nav';
        const i = kind === 'com' ? state.comTune : state.navTune;
        state.vol[kind][i] = clamp(state.vol[kind][i] + steps * 5, 0, 100);
        state.vol.show = { kind, i, until: state.t + 2 };
        return;
      }
      case 'fms': {
        // An open Page Menu or Map Setup; the PFD's Nearest window; on the MFD with no FMS cursor out, the
        // pages; else the open FMS window.
        if (menus.turn(part, steps, display)) return;
        if (display === 'pfd' && xpdrKnobEntry()) return xpdrKnob(part, steps);
        if (display === 'mfd' && checklist.isOpen() && !state.fms.win.mfd) return checklist.turn(part, steps);
        const win = state.fms.win[display];
        if (display === 'pfd' && win?.type === 'nrst') return pages.pfdInput('turn', steps);
        if (display === 'pfd' && win?.type === 'tmr') return timer.input('turn', part, steps);
        if (display === 'pfd' && win?.type === 'alerts') return alerts.input('turn', steps);
        if (display === 'mfd' && (!win || (win.type === 'fpl' && win.cursor == null))) return pages.turn(part, steps);
        return fms.turn(part, steps, display);
      }
    }
  }
  const wrapInt = (v, n) => ((v % n) + n) % n;

  // Pushing a knob.
  function push(knob, display = 'pfd') {
    display = pfdIfReverted(display);
    switch (knob) {
      // Push: tune the other radio (the cyan box moves).
      case 'com': state.comTune = 1 - state.comTune; return;
      case 'nav': state.navTune = 1 - state.navTune; return;
      // HDG SYNC: the bug to the current heading.
      case 'hdg': state.hdgBug = Math.round(toMag(state.hdg)) % 360; return;
      // CRS CTR: the course to center the needle with a TO flag.
      case 'crs_baro': {
        const nav = navSolution();
        if (nav && state.cdi === 'GPS') { if (state.fms.obs) state.fms.obs.crs = Math.round(nav.bearingTo) % 360; }
        else if (nav) state.crs[state.cdi === 'VOR1' ? 0 : 1] = Math.round(nav.bearingTo);
        return;
      }
      // Volume knob pushes: COM automatic squelch off (on again), and the
      // NAV radio's Morse identifier on (off again), for the radio tuned.
      case 'com_volume': state.vol.sqOff[state.comTune] = !state.vol.sqOff[state.comTune]; return;
      case 'nav_volume': state.vol.navId[state.navTune] = !state.vol.navId[state.navTune]; return;
      case 'stby_baro': return;
      case 'gma_vol': return gma.push();
      // RANGE push: the MFD map's pan pointer, from own ship; again, back.
      case 'range':
        if (display === 'pfd') return note('PFD map pan: not in the mock (pan the MFD map)');
        if (state.pan) { state.pan = null; return; }
        if (!panPage()) return note('Map pan: on the Navigation Map or the flight plan page');
        state.pan = { lat: state.lat, lon: state.lon, measure: null };
        return;
      case 'fms': {
        if (menus.push(display)) return;
        if (display === 'mfd' && checklist.isOpen() && !state.fms.win.mfd) return;
        const win = state.fms.win[display];
        if (display === 'pfd' && win?.type === 'nrst') return pages.pfdInput('push');
        if (display === 'pfd' && win?.type === 'tmr') return timer.input('push');
        if (display === 'pfd' && win?.type === 'alerts') return alerts.input('push');
        if (display === 'mfd' && !win) return pages.push();
        return fms.push(display);
      }
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
    if (a.lat === 'GA') rollCmd = 0;
    // The bug is magnetic; the airplane's heading is true.
    if (a.lat === 'HDG') rollCmd = clamp(diff(toTrue(state.hdgBug), state.hdg) * 1.2, -22, 22);
    if ((a.lat === 'NAV' || a.lat === 'APR') && nav) {
      // Intercept angle grows with the distance off course, up to 45°.
      // Steered by the track, so a crosswind is crabbed into.
      const want = wrap360(nav.courseTrue - clamp(nav.xtk * 40, -45, 45));
      rollCmd = clamp(diff(want, track()) * 1.2, -22, 22);
    } else if ((a.lat === 'NAV' || a.lat === 'APR') && !nav) {
      lose('lat');
    }
    if (a.latArmed && nav && nav.capturable) {
      setMode('lat', a.latArmed);
      arm('lat', null);
    }

    // Vertical: ALTS arms in PIT, VS and FLC when the selected altitude
    // is ahead; it captures with a lead that grows with the climb rate.
    // Indicated altitude: the GFC 700 flies the baro-corrected altitude.
    const iAlt = indicatedAlt();
    const altErr = state.altSel - iAlt;
    if (a.fd && ['PIT', 'VS', 'FLC', 'GA'].includes(a.vert)) {
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
    if (a.vert === 'GA') pitchCmd = GA_PITCH;
    if (a.vert === 'VS') pitchCmd = pathFor(a.ref.vs) + alpha;
    if (a.vert === 'ALT' || a.vert === 'ALTS') {
      const target = a.vert === 'ALTS' ? state.altSel : a.ref.alt;
      pitchCmd = pathFor(clamp((target - iAlt) * 4, -700, 700)) + alpha;
    }
    if (a.vert === 'FLC') {
      // The path angle power allows at the reference speed, plus a pull
      // toward the speed.
      const veq = 50 + 75 * power();
      const sinG = clamp((0.045 * (veq - a.ref.ias) + 0.25 * (state.ias - a.ref.ias)) / 19, -0.3, 0.3);
      pitchCmd = deg(Math.asin(sinG)) + alpha;
    }
    // Overspeed protection (MAXSPD): with the autopilot flying a vertical
    // mode, the nose comes up to keep the speed under Vne.
    a.maxspd = a.ap && state.ias > SPEEDS.vne - 5;
    if (a.maxspd) pitchCmd = Math.max(pitchCmd, state.pitch + (state.ias - (SPEEDS.vne - 5)) * 0.4);
    pitchCmd = clamp(pitchCmd, -10, 15);
    a.cmd = { roll: rollCmd, pitch: pitchCmd };

    const toward = (v, target, rate) => v + clamp(target - v, -rate * dt, rate * dt);
    // (CWS held: the pilot flies.)
    if (a.ap && !a.cws) {
      state.roll = toward(state.roll, rollCmd, 5);
      state.pitch = toward(state.pitch, pitchCmd, 2);
    } else {
      state.roll = toward(state.roll, state.manual.roll, 8);
      state.pitch = toward(state.pitch, state.manual.pitch, 3);
    }

    const gamma = state.pitch - alpha;
    // Engine stopped: no thrust, so only a descent keeps the speed up.
    const veq = state.sys.running ? 50 + 75 * state.power : 0;
    state.ias = clamp(state.ias + (0.045 * (veq - state.ias) - 19 * Math.sin(rad(gamma))) * dt, 35, 170);
    state.vs = T * 101.27 * Math.sin(rad(gamma));
    state.trueAlt += (state.vs / 60) * dt;
    const turnRate = (1091 * Math.tan(rad(state.roll))) / Math.max(T, 40);
    state.hdg = wrap360(state.hdg + turnRate * dt);
    // Over the ground: the wind's drift added.
    const g = groundVector(), nm = (g.gs / 3600) * dt;
    state.lat += (nm / 60) * Math.cos(rad(g.trk));
    state.lon += (nm / 60) * Math.sin(rad(g.trk)) / Math.cos(rad(state.lat));
    state.magVar = magVarAt(state.lat, state.lon);

    fms.step();
    pages.step(dt);
    timer.step(dt);
    alerts.step(dt);
    systems.step(dt, fuelFlow());
    // An engine exceedance brings the EIS back to its ENGINE page (and the
    // softkeys to the ENGINE menu).
    if (state.eisPage !== 'Engine' && systems.exceedance()) {
      state.eisPage = 'Engine';
      for (const st of Object.values(state.menus)) if (['lean', 'system'].includes(st[st.length - 1])) st[st.length - 1] = 'engine';
    }
    // A pitch trim fault disconnects the autopilot (PTRM).
    if (state.sys.failed.trim && a.ap) apDisconnect(true);
    // The autopilot runs on avionics bus 2.
    if (a.ap && !systems.buses().avn2) apDisconnect(true);
    // An AHRS or ADC failure: the autopilot disconnects, the flight
    // director goes away.
    if (!afcsSensors()) { if (a.ap) apDisconnect(true); if (a.fd) fdOff(); }
    if (a.lost && (state.t - a.lost.at >= 10 || !a.fd)) a.lost = null;
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
  function fly({ pitch = 0, roll = 0, power = 0, mixture = 0 }) {
    state.power = clamp(state.power + power, 0, 1);
    state.mixture = clamp(state.mixture + mixture, 0, 1);
    if (state.afcs.ap && !state.afcs.cws) return;
    state.manual.pitch = clamp(state.manual.pitch + pitch, -10, 15);
    state.manual.roll = clamp(state.manual.roll + roll, -30, 30);
  }

  return {
    state, reset, NAVAIDS, AIRPORTS, WAYPOINTS, AIRSPACE, COMMS, WA_SOURCE: WA_NAV.source, magVarAt, toMag, toTrue,
    // The airplane's magnetic heading, as the HSI shows it.
    magHeading: () => toMag(state.hdg), HPA, SPEEDS, MENUS, LIVE, RANGES, fms, pages, menus, timer, alerts, systems, airportSize, fuelFlow,
    FAILURES: G1000_SYSTEMS.FAILURES, fail: (id, on) => systems.fail(id, on), DB_EXPIRES,
    ...Object.fromEntries(Object.entries({ press, turn, push, hold }).map(([k, fn]) => [k, (...args) => { const r = fn(...args); syncMfdMenus(); return r; }])),
    fly, HOLD, cws, bearingDist, navSolution, indicatedAlt, standbyAlt, tas, gs, track, navModeName,
    windInfo, bearingTo, dmeInfo, oat, densityAlt, mapUp, pan, panTarget, checklist, gma,
    // Sets the wind: from (true), knots.
    setWind: (dir, spd) => { state.wind = { dir: wrap360(dir), spd: Math.max(0, spd) }; },
    // The day's temperature, °C from ISA.
    setIsaDev: (dev) => { state.isaDev = dev; },
    tick(dt) {
      // Big gaps (a background tab) are skipped, small steps keep it stable.
      dt = Math.min(dt, 0.5);
      watchSel();
      for (let left = dt; left > 1e-6; left -= 0.05) step(Math.min(0.05, left));
    },
    // The menu a display's softkeys show (the PFD's, on both, reverted),
    // its labels and live softkeys.
    menu, labels: (display) => labelsOf(menu(display)), live: (display) => liveOf(menu(display)),
  };
})();
