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
// Planning, Utility, Active Flight Plan, Flight Plan Catalog, Nearest
// Airports, Nearest VOR, Nearest Frequencies and Nearest Airspaces, and
// System Setup's airspace alert settings. MENU on a page is js/g1000-menu.js.
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
  const LIVE = new Set(['MAP:0', 'WPT:0', 'WPT:3', 'AUX:0', 'AUX:1', 'AUX:3', 'FPL:0', 'FPL:1', 'NRST:0', 'NRST:3', 'NRST:5', 'NRST:6']);
  const FPL_PAGE = 'FPL:0';

  // toMag(true bearing): magnetic, by the local variation.
  // openMenu(): the Page Menu (ENT on a stored flight plan opens it).
  // comms, airspace: the Nearest Frequencies and Airspaces data (data/wa-nav.js).
  function create({ state, note, bearingDist, waypoints, fms, tas, fuelFlow, toMag, openMenu, comms, airspace, indicatedAlt }) {
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
      // Utility: flight timer (from t0), odometer, and the trip's distance,
      // time (from tripT0) and top ground speed; the Page Menu resets them.
      stats: { t0: 0, odo: 0, trip: 0, tripT0: 0, maxGs: 0 },
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
    // ---- Nearest Frequencies: center, flight service and weather ----
    // Rows, one per frequency: the nearest two center (RCAG) and flight
    // service (RCO) outlets with each of their frequencies, then the
    // nearest three weather stations. Each with bearing and distance.
    const COMMS = comms ?? [];
    function nearestFreqs() {
      const near = (kind, n) => nearest(COMMS.filter((c) => c.kind === kind), n);
      const rows = [];
      for (const [kind, n] of [['ARTCC', 2], ['FSS', 2], ['WX', 3]]) {
        for (const r of near(kind, n)) for (const freq of r.w.freqs) rows.push({ kind, freq, ...r });
      }
      return rows;
    }

    // ---- Nearest Airspaces ----
    // Class B, C and D shelves grouped by airspace, each with how it
    // stands: INSIDE (within a shelf, between its floor and ceiling),
    // ABOVE or BELOW (over or under the shelf the airplane is within),
    // AHEAD (the track enters a shelf at this altitude within 10 minutes),
    // or just its distance; and the floor and ceiling of the shelf that
    // matters (the one around or nearest the airplane). Flat geometry
    // around the airplane, in NM: plenty for 50 NM.
    const AIRSPACE = airspace ?? [];
    function nearestAirspaces(maxDist = 50) {
      const k = Math.cos((state.lat * Math.PI) / 180);
      const xy = ([lat, lon]) => [(lon - state.lon) * 60 * k, (lat - state.lat) * 60];
      const inside = (p, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      const edgeDist = (poly) => {
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
          const t = clamp(((0 - ax) * dx + (0 - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
          best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
        }
        return best;
      };
      // The altitude buffer (AUX - System Setup) widens each shelf's floor
      // and ceiling, as the real unit's alerts do.
      const buf = state.alertSet?.buffer ?? 0;
      const alt = indicatedAlt(), h = (state.hdg * Math.PI) / 180, reach = (tas() / 60) * 10;
      const ahead = [];
      for (let d = 0.5; d <= reach; d += 0.5) ahead.push([Math.sin(h) * d, Math.cos(h) * d]);
      const groups = new Map();
      for (const a of AIRSPACE) {
        const poly = a.pts.map(xy);
        // A quick cut: every Washington shelf is under 60 NM across.
        if (Math.hypot(...poly[0]) > maxDist + 60) continue;
        const within = inside([0, 0], poly), dist = within ? 0 : edgeDist(poly);
        if (dist > maxDist) continue;
        const band = alt >= a.lo - buf && alt <= a.hi + buf;
        // near: within 2 NM of a shelf at this altitude.
        const near = !within && band && dist < 2;
        let rank, status;
        if (within && band) { rank = 0; status = 'INSIDE'; }
        else if (within) { rank = 1; status = alt > a.hi ? 'ABOVE' : 'BELOW'; }
        else if (band && ahead.some((p) => inside(p, poly))) { rank = 2; status = near ? 'NEAR, AHEAD' : 'AHEAD <10MIN'; }
        else if (near) { rank = 3; status = 'WITHIN 2NM'; }
        else { rank = 4; status = null; }
        const g = groups.get(a.name);
        if (!g || rank < g.rank || (rank === g.rank && dist < g.dist)) {
          groups.set(a.name, { name: a.name, cls: a.cls, rank, status, near: near || !!g?.near, dist: Math.min(dist, g?.dist ?? Infinity), lo: a.lo, hi: a.hi, loAgl: a.loAgl });
        } else { g.dist = Math.min(g.dist, dist); g.near = g.near || near; }
      }
      return [...groups.values()].sort((a, b) => a.rank - b.rank || a.dist - b.dist).slice(0, 12);
    }

    // The rows a list page's cursor moves over.
    const LISTS = {
      'FPL:1': () => state.fms.catalog, 'NRST:0': nearestAirports, 'NRST:3': nearestVors,
      'NRST:5': nearestFreqs, 'NRST:6': nearestAirspaces,
    };
    const listLength = (key) => LISTS[key]().length;
    // The Flight Plan Catalog as rows: number, first and last waypoint,
    // total distance.
    const byId = Object.fromEntries(waypoints.map((w) => [w.id, w]));
    function catalogRows() {
      return state.fms.catalog.map((plan, i) => {
        let dist = 0;
        for (let k = 1; k < plan.wpts.length; k++) dist += bearingDist(byId[plan.wpts[k - 1]], byId[plan.wpts[k]]).dist;
        return { num: String(i + 1).padStart(2, '0'), from: plan.wpts[0] ?? '', to: plan.wpts[plan.wpts.length - 1] ?? '', dist, wpts: plan.wpts };
      });
    }
    // The first identifier of the right kind starting with what was typed.
    const matchIn = (list) => (typed) => (typed
      ? list.slice().sort((a, b) => a.id.localeCompare(b.id)).find((w) => w.id.startsWith(typed)) ?? null : null);
    const matchers = { 'WPT:0': matchIn(airports), 'WPT:3': matchIn(vors), 'AUX:0': matchIn(waypoints),
      // A Flight ID is whatever was typed.
      'AUX:3': (typed) => (typed ? { id: typed } : null) };

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

    // ---- AUX - System Setup: the airspace alert settings, Flight ID ----
    // Rows: the altitude buffer, each class's alerts on or off, and the
    // Flight ID. With the cursor out, the large knob picks the row, the
    // small knob changes it; ENT on the Flight ID edits it like an
    // identifier (small knob: character, large knob: position, ENT).
    const SETUP_ROWS = ['buffer', 'B', 'C', 'D', 'flightId'];
    function setupChange(row, steps) {
      const set = state.alertSet, k = SETUP_ROWS[row];
      if (k === 'flightId') note('Press ENT to edit the Flight ID');
      else if (k === 'buffer') set.buffer = clamp(set.buffer + steps * 50, 0, 1000);
      else set[k] = !set[k];
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
      if (key === 'AUX:3') {
        if (part === 'outer') p.cursor = clamp(p.cursor + steps, 0, SETUP_ROWS.length - 1);
        else setupChange(p.cursor, steps);
        return;
      }
      p.cursor = clamp(p.cursor + steps, 0, Math.max(0, listLength(key) - 1));
    }
    function push() {
      const p = P(), key = pageKey();
      if (p.cursor != null) { p.cursor = p.entry = null; return; }
      if (key === 'WPT:0' || key === 'WPT:3' || key === 'AUX:0') {
        const now = key === 'WPT:0' ? p.wpt.airport : key === 'WPT:3' ? p.wpt.vor : p.tripTo;
        p.cursor = 'ident';
        p.entry = { ident: now, pos: 0 };
      } else if (['NRST:0', 'NRST:3', 'NRST:5', 'NRST:6'].includes(key)) {
        if (listLength(key)) p.cursor = 0; else note('Nothing near enough to list');
      } else if (key === 'AUX:3') {
        p.cursor = 0;
      } else if (key === 'FPL:1') {
        if (state.fms.catalog.length) p.cursor = 0; else note('No stored flight plans: store one from the FPL page menu');
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
        if (page === 'AUX:3') state.xpdr.flightId = m.id;
        p.cursor = p.entry = null;
        return true;
      }
      if (page === 'AUX:3') {
        if (SETUP_ROWS[p.cursor] === 'flightId') { p.cursor = 'ident'; p.entry = { ident: state.xpdr.flightId, pos: 0 }; }
      } else if (page === 'FPL:1') {
        // ENT on a stored plan: the Page Menu, to activate or delete it.
        openMenu();
      } else if (page === 'NRST:0') {
        // ENT on a nearest airport: its information page.
        p.wpt.airport = nearestAirports()[p.cursor].w.id;
        goPage(1, 0);
      } else if (page === 'NRST:5') {
        // ENT on a frequency: into the tuned COM's standby.
        const r = nearestFreqs()[p.cursor];
        state.com[state.comTune].stby = r.freq;
        note(`${r.freq.toFixed(3)} (${r.w.name}) to COM${state.comTune + 1} standby`);
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
      st.trip += (gs / 3600) * dt;
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
      pfdNearest, pfdInput, step, trip, nearestAirports, nearestVors, nearestFreqs, nearestAirspaces, catalogRows, matchers,
      cursorOn: () => P().cursor != null,
      isFplPage: () => pageKey() === FPL_PAGE,
    };
  }

  return { create, GROUPS, LIVE };
})();
