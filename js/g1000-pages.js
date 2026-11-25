// The mock G1000's MFD page groups and the PFD's Nearest window (used by
// js/g1000.js). On the MFD, with no cursor showing, the large (outer) FMS
// knob picks the page group (MAP, WPT, AUX, FPL, NRST) and the small
// (inner) knob the page within it; each group remembers its last page.
// Pushing FMS on a page that has one shows the cursor: on an identifier
// it opens entry (small knob: character, large knob: cursor, ENT
// accepts), in a list it selects a row. CLR hides the cursor. D→ goes
// direct to the selected airport or station.
//
// The VFR pages work: Navigation Map, Airport and VOR Information, Trip
// Planning, Utility, Active Flight Plan, Nearest Airports and Nearest VOR.
// The rest show their name and a "not in the mock" placeholder.
window.G1000_PAGES = (function () {
  const GROUPS = [
    { id: 'MAP', pages: ['Navigation Map', 'Traffic Map', 'Weather Data Link', 'TAWS-B'] },
    { id: 'WPT', pages: ['Airport Information', 'Intersection Information', 'NDB Information', 'VOR Information', 'User WPT Information'] },
    { id: 'AUX', pages: ['Trip Planning', 'Utility', 'GPS Status', 'System Setup'] },
    { id: 'FPL', pages: ['Active Flight Plan', 'Flight Plan Catalog'] },
    { id: 'NRST', pages: ['Nearest Airports', 'Nearest Intersections', 'Nearest NDB', 'Nearest VOR', 'Nearest User WPTs', 'Nearest Frequencies', 'Nearest Airspaces'] },
  ];
  // Page keys the mock draws: group id + ':' + page index.
  const LIVE = new Set(['MAP:0', 'WPT:0', 'WPT:3', 'AUX:0', 'AUX:1', 'FPL:0', 'NRST:0', 'NRST:3']);
  const FPL_PAGE = 'FPL:0';

  // toMag(true bearing): magnetic, by the local variation.
  function create({ state, note, bearingDist, waypoints, fms, tas, fuelFlow, toMag }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const airports = waypoints.filter((w) => w.type === 'airport');
    const vors = waypoints.filter((w) => w.type === 'vor');
    const P = () => state.mfd;

    const fresh = () => ({
      group: 0, last: GROUPS.map(() => 0),
      // cursor: null (knobs change pages), 'ident' (entry open: entry
      // holds it), or a row number in a list.
      cursor: null, entry: null,
      wpt: { airport: 'KPAE', vor: 'PAE' }, tripTo: 'KAWO',
      // Utility: odometer and ground speed statistics since reset.
      stats: { odo: 0, maxGs: 0, t0: 0 },
    });

    const pageKey = () => GROUPS[P().group].id + ':' + P().last[P().group];
    const pageName = () => GROUPS[P().group].pages[P().last[P().group]];

    // Nearest first, with (magnetic) bearing and distance from the airplane.
    const nearest = (list, n = 15) => list.map((w) => {
      const { brg, dist } = bearingDist(state, w);
      return { w, brg: toMag(brg), dist };
    }).sort((a, b) => a.dist - b.dist).slice(0, n);
    const nearestAirports = () => nearest(airports);
    const nearestVors = () => nearest(vors);
    // The first identifier of the right kind starting with what was typed.
    const matchIn = (list) => (typed) => (typed
      ? list.slice().sort((a, b) => a.id.localeCompare(b.id)).find((w) => w.id.startsWith(typed)) ?? null : null);
    const matchers = { 'WPT:0': matchIn(airports), 'WPT:3': matchIn(vors), 'AUX:0': matchIn(waypoints) };

    // The FPL page is the flight plan window over the map (js/g1000-fms.js
    // owns it); other pages close it. A Direct-To window stays.
    function sync() {
      const w = state.fms.win;
      if (pageKey() === FPL_PAGE && !w.mfd) w.mfd = { type: 'fpl', cursor: null, entry: null, prompt: null };
      if (pageKey() !== FPL_PAGE && w.mfd?.type === 'fpl') w.mfd = null;
    }
    function goPage(group, page) {
      const p = P();
      p.group = (group + GROUPS.length) % GROUPS.length;
      if (page != null) p.last[p.group] = (page + GROUPS[p.group].pages.length) % GROUPS[p.group].pages.length;
      p.cursor = p.entry = null;
      sync();
    }
    // The FPL key: to the Active Flight Plan page, and back to where it
    // came from.
    let beforeFpl = null;
    function fplKey() {
      const p = P();
      if (pageKey() === FPL_PAGE) {
        const [g, i] = beforeFpl ?? [0, 0];
        goPage(g, i);
      } else {
        beforeFpl = [p.group, p.last[p.group]];
        goPage(3, 0);
      }
    }

    // What D→ should offer from this page: the shown or selected waypoint.
    function selectedIdent(display) {
      if (display === 'pfd') {
        const win = state.fms.win.pfd;
        return win?.type === 'nrst' && win.cursor != null ? nearestAirports()[win.cursor]?.w.id ?? null : null;
      }
      const p = P(), key = pageKey();
      if (key === 'WPT:0') return p.wpt.airport;
      if (key === 'WPT:3') return p.wpt.vor;
      if (key === 'AUX:0') return p.tripTo;
      if (key === 'NRST:0' && p.cursor != null) return nearestAirports()[p.cursor]?.w.id ?? null;
      if (key === 'NRST:3' && p.cursor != null) return nearestVors()[p.cursor]?.w.id ?? null;
      return null;
    }

    // ---- MFD input (when no FMS window has it) ----
    function turn(part, steps) {
      const p = P(), key = pageKey();
      if (p.cursor == null) {
        // Pages: large knob the group, small knob the page.
        if (part === 'outer') goPage(p.group + steps, null);
        else goPage(p.group, p.last[p.group] + steps);
        return;
      }
      if (p.cursor === 'ident') {
        if (part === 'inner') fms.editChar(p.entry, steps); else fms.moveCursor(p.entry, steps);
        return;
      }
      const rows = key === 'NRST:0' ? nearestAirports() : nearestVors();
      p.cursor = clamp(p.cursor + steps, 0, rows.length - 1);
    }
    function push() {
      const p = P(), key = pageKey();
      if (p.cursor != null) { p.cursor = p.entry = null; return; }
      if (key === 'WPT:0' || key === 'WPT:3' || key === 'AUX:0') {
        const now = key === 'WPT:0' ? p.wpt.airport : key === 'WPT:3' ? p.wpt.vor : p.tripTo;
        p.cursor = 'ident';
        p.entry = { ident: now, pos: 0 };
      } else if (key === 'NRST:0' || key === 'NRST:3') {
        p.cursor = 0;
      } else {
        note(`${pageName()}: no cursor on this page in the mock`);
      }
    }
    // ENT and CLR on the MFD's pages; true when handled.
    function press(key) {
      const p = P(), page = pageKey();
      if (key === 'clr') {
        if (p.cursor == null) return false;
        p.cursor = p.entry = null;
        return true;
      }
      if (key !== 'ent' || p.cursor == null) return false;
      if (p.cursor === 'ident') {
        const m = matchers[page](p.entry.ident);
        if (!m) { note('No match for ' + (p.entry.ident || '(blank)')); return true; }
        if (page === 'WPT:0') p.wpt.airport = m.id;
        if (page === 'WPT:3') p.wpt.vor = m.id;
        if (page === 'AUX:0') p.tripTo = m.id;
        p.cursor = p.entry = null;
        return true;
      }
      if (page === 'NRST:0') {
        // ENT on a nearest airport: its information page.
        p.wpt.airport = nearestAirports()[p.cursor].w.id;
        goPage(1, 0);
      } else if (page === 'NRST:3') {
        // ENT on a nearest VOR: its frequency into the NAV standby.
        const v = nearestVors()[p.cursor].w;
        state.nav[state.navTune].stby = v.freq;
        note(`${v.freq.toFixed(2)} (${v.id}) to NAV${state.navTune + 1} standby`);
      }
      return true;
    }

    // ---- The PFD's Nearest Airports window ----
    function pfdNearest() {
      const w = state.fms.win;
      w.pfd = w.pfd?.type === 'nrst' ? null : { type: 'nrst', cursor: null };
    }
    // FMS knob and keys in that window; true when handled.
    function pfdInput(kind, arg) {
      const win = state.fms.win.pfd;
      if (win?.type !== 'nrst') return false;
      if (kind === 'push') win.cursor = win.cursor == null ? 0 : null;
      else if (kind === 'turn') {
        if (win.cursor == null) note('Push the FMS knob for the cursor');
        else win.cursor = clamp(win.cursor + arg, 0, nearestAirports().length - 1);
      } else if (kind === 'clr') {
        if (win.cursor != null) win.cursor = null; else state.fms.win.pfd = null;
      } else if (kind !== 'ent') return false;
      return true;
    }

    // ---- Every step: the Utility page's statistics ----
    function step(dt) {
      const st = P().stats, gs = tas();
      st.odo += (gs / 3600) * dt;
      st.maxGs = Math.max(st.maxGs, gs);
    }

    // Trip Planning from the present position to the chosen waypoint.
    function trip() {
      const to = waypoints.find((w) => w.id === P().tripTo);
      const { brg, dist } = bearingDist(state, to);
      const hours = dist / Math.max(tas(), 30);
      const ff = fuelFlow();
      return { to, dtk: toMag(brg), dist, hours, ff, required: ff * hours, onboard: state.fuel, after: state.fuel - ff * hours };
    }

    return {
      GROUPS, LIVE, fresh, sync, goPage, fplKey, pageKey, pageName, selectedIdent, turn, push, press,
      pfdNearest, pfdInput, step, trip, nearestAirports, nearestVors, matchers,
      cursorOn: () => P().cursor != null,
      isFplPage: () => pageKey() === FPL_PAGE,
    };
  }

  return { create, GROUPS, LIVE };
})();
