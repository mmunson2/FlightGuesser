// The mock G1000's MENU key (used by js/g1000.js): the Page Menu, and the
// Map Setup window it leads to.
//
// MENU opens a Page Menu window over whatever has the display: the
// options of the page or window on show (the MFD's page, or on either
// display an open flight plan or Direct-To window). Either FMS knob moves
// the cursor through the options; ENT picks one; CLR, MENU or a push of
// the FMS knob closes the window. Options the mock can't do yet, or that
// need something first (a waypoint under the cursor, a flight plan), draw
// grey, and ENT on one says why. Some options ask first ("Delete flight
// plan?"): ENT does it, CLR backs out. A page with nothing to offer shows
// "No options with this page".
//
// Some options open a setup window: Map Settings (the Navigation Map's,
// state.mapSet), PFD Map Settings (the PFD's Page Menu with its map on,
// state.pfdMapSet: the inset and HSI maps) and the flight plan's Change
// Fields (state.fms.fields). The large knob moves between the GROUP line
// and the settings, the small knob changes the one under the cursor;
// ENT, CLR, MENU or a push of the FMS knob puts it away.
window.G1000_MENU = (function () {
  // Map Setup's groups. A setting's values: what the small knob steps
  // through. Ranges are the map range up to which a symbol shows.
  function mapGroups(ranges) {
    const range = ['Off', ...ranges];
    return [
      { name: 'Map', rows: [
        { key: 'orient', label: 'Orientation', values: ['Heading Up', 'Track Up', 'North Up'] },
        { key: 'ring', label: 'Nav Range Ring', values: ['On', 'Off'] },
        // Where the airplane will be in this long, at the present track and
        // ground speed.
        { key: 'track', label: 'Track Vector', values: TRACK_VECTOR },
      ] },
      { name: 'Aviation', rows: [
        { key: 'fpl', label: 'Active FPL', values: range },
        { key: 'aptL', label: 'Large APT', values: range },
        { key: 'aptM', label: 'Medium APT', values: range },
        { key: 'aptS', label: 'Small APT', values: range },
        { key: 'vor', label: 'VOR', values: range },
        // Identifiers: up to this map range.
        { key: 'aptText', label: 'APT Text', values: range },
        { key: 'vorText', label: 'VOR Text', values: range },
      ] },
      { name: 'Airspace', rows: [
        { key: 'clsB', label: 'Class B/TMA', values: range },
        { key: 'clsC', label: 'Class C/TCA', values: range },
        { key: 'clsD', label: 'Class D', values: range },
      ] },
    ];
  }
  const TRACK_VECTOR = ['Off', '30 SEC', '60 SEC', '2 MIN', '5 MIN', '10 MIN', '20 MIN'];
  const MAP_DEFAULTS = {
    orient: 'Heading Up', ring: 'On', track: 'Off', fpl: 100, aptL: 100, aptM: 100, aptS: 50, vor: 100,
    aptText: 15, vorText: 100, clsB: 100, clsC: 100, clsD: 25,
  };
  // The PFD's small maps declutter sooner.
  const PFD_MAP_DEFAULTS = { ...MAP_DEFAULTS, aptText: 7.5, vorText: 25 };
  // The flight plan's three data columns (Change Fields), and the choices.
  const FPL_FIELDS = ['DTK', 'DIS', 'CUM', 'ETE', 'ETA', 'FUEL'];

  function create({ state, fms, pages, timer, note, ranges }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const GROUPS = mapGroups(ranges);
    // The setup windows: title, groups, and where their settings live.
    const SETUPS = {
      map: { title: 'MAP SETUP', groups: GROUPS, target: () => state.mapSet },
      pfdMap: { title: 'PFD MAP SETUP', groups: GROUPS, target: () => state.pfdMapSet },
      fields: { title: 'CHANGE FIELDS', target: () => state.fms.fields, groups: [{ name: 'Flight Plan', rows: [
        { key: 'f1', label: 'Field 1', values: FPL_FIELDS }, { key: 'f2', label: 'Field 2', values: FPL_FIELDS },
        { key: 'f3', label: 'Field 3', values: FPL_FIELDS }] }] },
    };
    const fresh = () => ({ pfd: null, mfd: null });
    const freshMap = () => ({ ...MAP_DEFAULTS });
    const freshPfdMap = () => ({ ...PFD_MAP_DEFAULTS });
    const M = () => state.pageMenu;

    // An option: label, and either run (ENT does it) or why (grey; ENT
    // says this). confirm: a question ENT must answer first.
    const opt = (label, run, confirm) => ({ label, run, confirm });
    const grey = (label, why = 'not in the mock yet') => ({ label, why });

    // ---- The options of what is on show ----
    function fplOptions(win, display) {
      const f = state.fms.fpl, n = f.wpts.length, c = win.cursor, after = state.fms.insertAfter;
      const at = c != null && c < n ? f.wpts[c] : null;
      const none = 'the flight plan is empty';
      return [
        c == null ? grey('Activate Leg', 'push FMS and pick the leg\'s waypoint first')
          : c >= 1 && c < n ? opt('Activate Leg', () => fms.activateLeg(c), `Activate leg to ${at}?`)
            : grey('Activate Leg', 'pick a waypoint after the first'),
        n >= 2 ? opt('Invert Flight Plan', () => fms.invertPlan(), 'Invert active flight plan?')
          : grey('Invert Flight Plan', 'needs two waypoints'),
        n ? opt('Delete Flight Plan', () => fms.deletePlan(), 'Delete all waypoints in flight plan?') : grey('Delete Flight Plan', none),
        // Where the small knob's new waypoint goes: before or after the
        // selected one. The option offers the other way.
        opt(after ? 'Insert Before' : 'Insert After', () => { state.fms.insertAfter = !after; }),
        opt('Change Fields', () => openSetup(display, 'fields')),
        opt('Restore Defaults', () => { state.fms.fields = fms.freshFields(); state.fms.insertAfter = false; }, 'Restore flight plan defaults?'),
        n ? opt('Store Flight Plan', () => {
          const i = fms.storePlan();
          if (i != null) note(`Stored as flight plan ${String(i + 1).padStart(2, '0')}`);
        }) : grey('Store Flight Plan', none),
        grey('Closest Point of FPL'),
        grey('Parallel Track'),
        grey('Select Departure', 'procedures are not in the mock yet'),
        grey('Select Arrival', 'procedures are not in the mock yet'),
        grey('Select Approach', 'procedures are not in the mock yet'),
      ];
    }
    function catalogOptions() {
      const cat = state.fms.catalog, i = state.mfd.cursor;
      const pick = 'push FMS and pick a flight plan first';
      const plan = typeof i === 'number' ? cat[i] : null;
      const num = plan ? String(i + 1).padStart(2, '0') : '';
      if (!plan) return [grey('Activate Flight Plan', pick), grey('Invert & Activate FPL', pick),
        grey('Delete Flight Plan', pick), cat.length ? opt('Delete All', () => fms.deleteAllStored(), 'Delete all flight plans?') : grey('Delete All', 'the catalog is empty')];
      return [
        opt('Activate Flight Plan', () => fms.activatePlan(plan.wpts), `Activate flight plan ${num}?`),
        opt('Invert & Activate FPL', () => fms.activatePlan(plan.wpts.slice().reverse()), `Invert and activate flight plan ${num}?`),
        opt('Delete Flight Plan', () => {
          cat.splice(i, 1);
          state.mfd.cursor = cat.length ? clamp(i, 0, cat.length - 1) : null;
        }, `Delete flight plan ${num}?`),
        opt('Delete All', () => { fms.deleteAllStored(); state.mfd.cursor = null; }, 'Delete all flight plans?'),
      ];
    }
    function utilityOptions() {
      const st = state.mfd.stats;
      return [
        opt('Reset Trip Statistics', () => Object.assign(st, { trip: 0, tripT0: state.t, maxGs: 0 }), 'Reset trip statistics?'),
        opt('Reset Odometer', () => { st.odo = 0; }, 'Reset odometer?'),
        opt('Reset Flight Timer', () => { st.t0 = state.t; }, 'Reset flight timer?'),
        opt('Reset All', () => Object.assign(st, { odo: 0, trip: 0, tripT0: state.t, maxGs: 0, t0: state.t }),
          'Reset all statistics?'),
      ];
    }
    function optionsFor(display) {
      const win = state.fms.win[display];
      if (win?.type === 'dto') {
        return [state.fms.fpl.dto ? opt('Cancel Direct-To NAV', () => fms.cancelDirect())
          : grey('Cancel Direct-To NAV', 'no Direct-To in force')];
      }
      if (win?.type === 'fpl') return fplOptions(win, display);
      if (win?.type === 'tmr') return timer.menuOptions(opt);
      // The PFD with nothing open: its map's settings, when it shows one.
      if (display === 'pfd') {
        return state.pfdMap.layout === 'Map Off' ? [] : [opt('PFD Map Settings', () => openSetup('pfd', 'pfdMap'))];
      }
      switch (pages.pageKey()) {
        case 'MAP:0': return [
          opt('Map Settings', () => openSetup('mfd', 'map')),
          grey('Measure Bearing/Distance'),
          grey('Show Chart', 'charts are not in the mock'),
        ];
        case 'AUX:1': return utilityOptions();
        case 'FPL:1': return catalogOptions();
        default: return [];
      }
    }

    // ---- Opening and closing ----
    function open(display) {
      const items = optionsFor(display);
      // The cursor starts on the first option that does something.
      const first = Math.max(0, items.findIndex((it) => it.run));
      M()[display] = { type: 'menu', items, cursor: first, confirm: null };
    }
    function openSetup(display, setup) {
      // The cursor starts on GROUP (row -1).
      M()[display] = { type: 'map', setup, group: 0, cursor: -1 };
    }
    const close = (display) => { M()[display] = null; };
    const isOpen = (display) => M()[display] != null;

    function pick(display) {
      const m = M()[display], it = m.items[m.cursor];
      if (!it) { close(display); return; }
      if (!it.run) { note(`${it.label}: ${it.why}`); return; }
      if (it.confirm) { m.confirm = { text: it.confirm, run: it.run }; return; }
      close(display);
      it.run();
    }

    // ---- Input while a window of this module is open; true if handled ----
    // MENU opens the Page Menu when nothing of this module is open.
    function press(key, display) {
      const m = M()[display];
      if (!m) {
        if (key !== 'menu') return false;
        open(display);
        return true;
      }
      if (m.type === 'map') {
        // ENT, CLR and MENU all put Map Setup away.
        if (key === 'ent' || key === 'clr' || key === 'menu') { close(display); return true; }
        close(display);
        return false;
      }
      if (m.confirm) {
        if (key === 'ent') { const { run } = m.confirm; close(display); run(); return true; }
        if (key === 'clr') { m.confirm = null; return true; }
      }
      if (key === 'ent') { pick(display); return true; }
      if (key === 'clr' || key === 'menu') { close(display); return true; }
      // Any other key (FPL, D→, PROC) puts the menu away and does its job.
      close(display);
      return false;
    }
    function turn(part, steps, display) {
      const m = M()[display];
      if (!m) return false;
      if (m.type === 'map') {
        const S = SETUPS[m.setup], groups = S.groups, rows = groups[m.group].rows, set = S.target();
        if (part === 'outer') m.cursor = clamp(m.cursor + steps, -1, rows.length - 1);
        else if (m.cursor === -1) {
          m.group = (((m.group + steps) % groups.length) + groups.length) % groups.length;
        } else {
          const row = rows[m.cursor], v = row.values;
          const i = v.indexOf(set[row.key]);
          set[row.key] = v[clamp(i + steps, 0, v.length - 1)];
        }
        return true;
      }
      if (m.confirm) return true;
      if (m.items.length) m.cursor = clamp(m.cursor + steps, 0, m.items.length - 1);
      return true;
    }
    function push(display) {
      if (!M()[display]) return false;
      close(display);
      return true;
    }

    // A setup window for the display: its title, group and rows.
    function setupView(m) {
      const S = SETUPS[m.setup], g = S.groups[m.group], set = S.target();
      return { title: S.title, group: g.name, rows: g.rows.map((r) => ({ label: r.label, value: set[r.key] })) };
    }

    return { fresh, freshMap, freshPfdMap, open, close, isOpen, press, turn, push, optionsFor, GROUPS, setupView };
  }

  return { create, MAP_DEFAULTS, FPL_FIELDS };
})();
