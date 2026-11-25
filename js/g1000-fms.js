// The mock G1000's flight planning (used by js/g1000.js): the active
// flight plan, Direct-To, waypoint entry with the FMS knob, leg
// sequencing, and the GPS course the CDI and the autopilot's GPS NAV mode
// follow.
//
// Entry works as on the real unit, simplified: in a Direct-To or flight
// plan window the small (inner) FMS knob picks the character under the
// cursor, the large (outer) knob moves the cursor, and the identifier
// completes from the database as you type. ENT accepts; CLR backs out.
// In the flight plan, push FMS for the cursor, turn the large knob to move
// it between rows, and the small knob to insert a waypoint before the
// selected row. CLR on a waypoint offers to remove it. MENU (the Page
// Menu, js/g1000-menu.js) activates the leg to it, inverts, deletes or
// stores the plan, and the Flight Plan Catalog's menu loads a stored one.
//
// User waypoints (state.fms.user) join the database: made at the present
// position, at the MFD map's pointer, by radial and distance from another
// waypoint (WPT - User WPT Information), or as the Closest Point of the
// flight plan to a waypoint. Parallel Track offsets the plan's legs to
// one side. With the GPS's integrity lost (the 'gps' failure, LOI) there
// is no GPS course.
window.G1000_FMS = (function () {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  // CDI full scale (NM): enroute, and terminal within 31 NM of the
  // departure or destination airport.
  const SCALE = { ENR: 2.0, TERM: 1.0 };
  const TERM_RADIUS = 31;
  // A leg is done when the waypoint is this close ahead, or passed.
  const ARRIVE_NM = 0.1;

  // magVarAt(lat, lon): local magnetic variation (js/g1000.js). Courses
  // are worked out true and shown magnetic.
  function create({ state, note, bearingDist, waypoints, magVarAt }) {
    const toMagAt = (t, p) => ((t - magVarAt(p.lat, p.lon)) % 360 + 360) % 360;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const rad = (d) => (d * Math.PI) / 180;
    const base = Object.fromEntries(waypoints.map((w) => [w.id, w]));
    // By identifier: the database's, then the user waypoints.
    const byId = new Proxy(base, { get: (t, k) => t[k] ?? state.fms?.user.find((u) => u.id === k) });
    const sorted = waypoints.slice().sort((a, b) => a.id.localeCompare(b.id));
    // The first waypoint whose identifier starts with what was typed.
    const match = (typed) => (typed ? [...sorted, ...F().user].sort((a, b) => a.id.localeCompare(b.id))
      .find((w) => w.id.startsWith(typed)) ?? null : null);

    const fresh = () => ({
      // wpts: identifiers in order. active: index of the waypoint flown TO
      // (the leg from wpts[active - 1]), null with no active leg. dto: a
      // Direct-To in force: { from: {lat, lon}, to: id, index: its place
      // in the plan or null }.
      fpl: { wpts: [], active: null, dto: null },
      // The Flight Plan Catalog: stored plans, { wpts } each. Two local
      // examples to start with; the real unit keeps what was stored.
      catalog: [{ wpts: ['KPAE', 'KAWO', 'KBVS'] }, { wpts: ['KBFI', 'KPAE', 'KBLI'] }],
      // The open window on each display: null, a Direct-To window
      // { type: 'dto', ident, pos, stage: 'ident' | 'activate' }, or the
      // flight plan { type: 'fpl', cursor, entry: {ident, pos} | null,
      // prompt: {text, action} | null }.
      win: { pfd: null, mfd: null },
      // OBS mode: null, or { crs } (magnetic), the selected course
      // through the active waypoint.
      obs: null,
      // The flight plan's options (its Page Menu): a new waypoint goes in
      // after the selected one instead of before; the three data columns.
      insertAfter: false, fields: freshFields(),
      // User waypoints: { id, lat, lon, type: 'user', name, ref } (ref: the
      // reference waypoint, radial (magnetic) and distance it was made by).
      user: [],
      // Parallel Track (its setup window): side, offset (NM), on or off.
      ptk: { side: 'Right', dist: 2, on: 'Off' },
    });
    const F = () => state.fms;
    const freshFields = () => ({ f1: 'DTK', f2: 'DIS', f3: 'CUM' });

    // The point `dist` NM from p along true bearing brg (great circle).
    function project(p, brg, dist) {
      const d = dist / 3440.065, b = rad(brg), p1 = rad(p.lat), l1 = rad(p.lon);
      const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
      const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
      return { lat: (p2 * 180) / Math.PI, lon: (l2 * 180) / Math.PI };
    }

    // ---- The active leg and the GPS course ----
    // In OBS mode the leg is the selected course through the active
    // waypoint: from a point 100 NM before it to one 100 NM past (`beyond`,
    // for the map). The course is magnetic by the variation at the waypoint.
    function leg() {
      const f = F().fpl, obs = F().obs;
      let l = null;
      if (f.dto) l = { from: f.dto.from, to: byId[f.dto.to], fromId: null, direct: true };
      else if (f.active != null && f.active >= 1 && f.active < f.wpts.length) {
        l = { from: byId[f.wpts[f.active - 1]], to: byId[f.wpts[f.active]], fromId: f.wpts[f.active - 1], direct: false };
      }
      if (l && obs) {
        const crsTrue = obs.crs + magVarAt(l.to.lat, l.to.lon);
        return { ...l, from: project(l.to, crsTrue + 180, 100), beyond: project(l.to, crsTrue, 100), obs: true };
      }
      // Parallel Track: the plan's leg moved sideways (not a Direct-To).
      const p = F().ptk;
      if (l && !l.direct && p.on === 'On') {
        const side = bearingDist(l.from, l.to).brg + (p.side === 'Right' ? 90 : -90);
        return { ...l, from: project(l.from, side, p.dist), to: { ...l.to, ...project(l.to, side, p.dist) }, ptk: true };
      }
      return l;
    }
    // OBS: sequencing suspended, the course to and past the active
    // waypoint picked with the CRS knob. Starts on the leg's own course.
    function toggleObs() {
      const f = F();
      if (f.obs) { f.obs = null; return true; }
      const nav = navSolution();
      if (!nav) return false;
      f.obs = { crs: Math.round(nav.course) % 360 };
      return true;
    }
    // TERM within 31 NM of the plan's first or last airport (or a
    // Direct-To airport), else ENR.
    function scaleName() {
      const f = F().fpl;
      const ends = [f.wpts[0], f.wpts[f.wpts.length - 1], f.dto?.to].map((id) => byId[id])
        .filter((w) => w && w.type === 'airport');
      return ends.some((w) => bearingDist(state, w).dist <= TERM_RADIUS) ? 'TERM' : 'ENR';
    }
    // Where the airplane is on the leg: desired track, cross-track (NM,
    // + = right of course), distance still to go along it.
    function legPosition(l) {
      const { brg: dtk, dist: len } = bearingDist(l.from, l.to);
      const { brg, dist } = bearingDist(l.from, state);
      const off = rad(brg - dtk);
      const along = len < 0.01 ? 0 : dist * Math.cos(off);
      return { dtk, xtk: len < 0.01 ? 0 : dist * Math.sin(off), remaining: len - along };
    }
    // The GPS solution in the same shape as a VOR's (see navSolution in
    // js/g1000.js), or null with no active leg.
    function navSolution() {
      const l = leg();
      // LOI: the position can't be trusted, so no course or deviation.
      if (!l || state.sys?.failed.gps) return null;
      const p = legPosition(l);
      const scale = scaleName();
      const to = bearingDist(state, l.to);
      // Desired track and bearing shown magnetic, by the variation where
      // the airplane is.
      // OBS: the course is the one selected (by the waypoint's variation).
      const course = F().obs ? F().obs.crs : toMagAt(p.dtk, state);
      return {
        source: 'GPS', station: l.to, course, courseTrue: p.dtk, obs: !!F().obs,
        toFrom: p.remaining > 0 ? 'TO' : 'FROM',
        dev: clamp(-p.xtk / SCALE[scale], -1, 1), xtk: p.xtk, dist: to.dist, bearingTo: toMagAt(to.brg, state),
        capturable: Math.abs(p.xtk) < SCALE[scale], scale, remaining: p.remaining, leg: l,
      };
    }

    // ---- Sequencing: on reaching the TO waypoint, the next leg ----
    function step() {
      const f = F().fpl, l = leg();
      // No leg; or OBS, which holds the waypoint until it is cancelled.
      if (!l) { F().obs = null; return; }
      if (F().obs) return;
      const p = legPosition(l);
      if (p.remaining > ARRIVE_NM) return;
      if (f.dto) {
        // A Direct-To to a plan waypoint goes on with the plan after it.
        if (f.dto.index != null && f.dto.index + 1 < f.wpts.length) {
          f.active = f.dto.index + 1;
          f.dto = null;
          note(`Next: ${f.wpts[f.active - 1]} → ${f.wpts[f.active]}`);
        }
      } else if (f.active + 1 < f.wpts.length) {
        f.active++;
        note(`Next: ${f.wpts[f.active - 1]} → ${f.wpts[f.active]}`);
      }
    }

    // ---- Editing the plan ----
    function insert(i, id) {
      const f = F().fpl;
      f.wpts.splice(i, 0, id);
      if (f.active != null && i <= f.active) f.active++;
      if (f.dto && f.dto.index != null && i <= f.dto.index) f.dto.index++;
      // The first leg comes alive once there are two waypoints.
      if (f.active == null && !f.dto && f.wpts.length >= 2) f.active = 1;
    }
    function remove(i) {
      const f = F().fpl;
      f.wpts.splice(i, 1);
      if (f.active != null) {
        if (i < f.active) f.active--;
        if (f.active >= f.wpts.length) f.active = f.wpts.length - 1;
        if (f.wpts.length < 2 || f.active < 1) f.active = f.wpts.length >= 2 ? 1 : null;
      }
      if (f.dto && f.dto.index != null) {
        if (f.dto.index === i) f.dto.index = null;
        else if (f.dto.index > i) f.dto.index--;
      }
    }
    function directTo(id) {
      const f = F().fpl;
      const index = f.wpts.indexOf(id);
      f.dto = { from: { lat: state.lat, lon: state.lon }, to: id, index: index < 0 ? null : index };
      F().obs = null;
    }
    function activateLeg(i) {
      const f = F().fpl;
      f.dto = null;
      f.active = i;
      F().obs = null;
    }
    // A Direct-To to a plan waypoint keeps its place when the plan
    // changes; one to a waypoint outside it carries on.
    const replanDto = (f, index) => { if (f.dto) f.dto.index = index; };
    // Cancel Direct-To NAV: back to the plan's leg to the same waypoint,
    // or its first leg, or no leg at all.
    function cancelDirect() {
      const f = F().fpl, i = f.dto?.index;
      f.dto = null;
      f.active = f.wpts.length < 2 ? null : i != null && i >= 1 ? i : 1;
    }
    // The whole plan reversed, flown from its first leg.
    function invertPlan() {
      const f = F().fpl, n = f.wpts.length;
      f.wpts.reverse();
      replanDto(f, f.dto?.index != null ? n - 1 - f.dto.index : null);
      if (!f.dto) f.active = n >= 2 ? 1 : null;
    }
    function deletePlan() {
      const f = F().fpl;
      f.wpts = [];
      f.active = null;
      replanDto(f, null);
    }
    // A copy into the catalog's first free place; its index, or null when
    // full (99 plans).
    function storePlan() {
      const cat = F().catalog;
      if (cat.length >= 99) { note('Flight plan catalog full'); return null; }
      cat.push({ wpts: F().fpl.wpts.slice() });
      return cat.length - 1;
    }
    // A stored plan becomes the active one, from its first leg.
    function activatePlan(wpts) {
      const f = F().fpl;
      f.wpts = wpts.slice();
      f.dto = null;
      F().obs = null;
      f.active = f.wpts.length >= 2 ? 1 : null;
    }
    const deleteAllStored = () => { F().catalog = []; };

    // ---- User waypoints ----
    // The next free USRnnn name.
    function userName() {
      for (let n = 1; ; n++) {
        const id = 'USR' + String(n).padStart(3, '0');
        if (!byId[id]) return id;
      }
    }
    // A new user waypoint at { lat, lon } (id: a name or the next USRnnn);
    // it, or null when the 1,000 are taken or the name is in use.
    function addUser({ lat, lon, id = userName(), ref = null, name = 'USER WAYPOINT' }) {
      if (F().user.length >= 1000) { note('User waypoint memory full'); return null; }
      if (byId[id]) { note(`${id} is already a waypoint`); return null; }
      const w = { id, lat, lon, type: 'user', name, ref };
      F().user.push(w);
      return w;
    }
    // Where a plan or a Direct-To uses a waypoint (so it can't go).
    const inUse = (id) => F().fpl.wpts.includes(id) || F().fpl.dto?.to === id || F().catalog.some((p) => p.wpts.includes(id));
    function removeUser(id) {
      if (inUse(id)) { note(`${id} is in a flight plan: remove it there first`); return false; }
      F().user = F().user.filter((u) => u.id !== id);
      return true;
    }
    // From a reference: radial (magnetic, by the variation there) and distance.
    function placeUser(w, refId, radial, dist) {
      const r = byId[refId];
      if (!r) return;
      Object.assign(w, project(r, radial + magVarAt(r.lat, r.lon), dist), { ref: { id: refId, radial, dist } });
    }

    // ---- Closest Point of FPL ----
    // The point on the plan's legs nearest a waypoint: { lat, lon, dist
    // (NM from it), brg (magnetic, from it), after (the index of the
    // leg's first waypoint) } or null with fewer than two waypoints. Flat
    // geometry around the reference waypoint: plenty for a plan's legs.
    function closestPoint(refId) {
      const r = byId[refId], f = F().fpl;
      if (!r || f.wpts.length < 2) return null;
      const k = Math.cos(rad(r.lat));
      const xy = (p) => [(p.lon - r.lon) * k, p.lat - r.lat];
      let best = null;
      for (let i = 1; i < f.wpts.length; i++) {
        const a = byId[f.wpts[i - 1]], b = byId[f.wpts[i]];
        const [ax, ay] = xy(a), [bx, by] = xy(b), dx = bx - ax, dy = by - ay;
        const t = clamp(-(ax * dx + ay * dy) / (dx * dx + dy * dy || 1), 0, 1);
        const p = { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) };
        const { brg, dist } = bearingDist(r, p);
        if (!best || dist < best.dist) best = { ...p, dist, brg: toMagAt(brg, r), after: i - 1 };
      }
      return best;
    }

    // ---- Character entry, shared by both windows ----
    function editChar(e, steps) {
      const cur = e.ident[e.pos];
      const at = cur ? CHARS.indexOf(cur) : steps > 0 ? -1 : 0;
      const ch = CHARS[(((at + steps) % CHARS.length) + CHARS.length) % CHARS.length];
      // Characters after the cursor go: the completion fills them in.
      e.ident = e.ident.slice(0, e.pos) + ch;
    }
    const moveCursor = (e, steps) => { e.pos = clamp(e.pos + steps, 0, Math.min(e.ident.length, 5)); };

    // ---- Keys: return true when the FMS handled them ----
    // opts.dtoDefault: what the page on show offers for D→ (js/g1000-pages.js).
    function press(key, display, opts = {}) {
      const w = F().win;
      const win = w[display];
      switch (key) {
        case 'direct_to': {
          if (win?.type === 'dto') { w[display] = null; return true; }
          // Defaults to the page's selection, the waypoint under the FPL
          // cursor, or the one flown to.
          const f = F().fpl;
          const fromCursor = win?.type === 'fpl' && win.cursor != null ? f.wpts[win.cursor] : null;
          const def = opts.dtoDefault ?? fromCursor ?? leg()?.to.id ?? '';
          w[display] = { type: 'dto', ident: def, pos: 0, stage: 'ident' };
          return true;
        }
        case 'fpl':
          w[display] = win?.type === 'fpl' ? null : { type: 'fpl', cursor: null, entry: null, prompt: null };
          return true;
        case 'ent': return win ? ent(win, display) : false;
        case 'clr': return win ? clr(win, display) : false;
        case 'proc':
          note('PROC: procedures are not in the mock yet');
          return true;
      }
      return false;
    }
    function ent(win, display) {
      const w = F().win;
      if (win.type === 'dto') {
        const m = match(win.ident);
        if (!m) { note('No waypoint matches ' + (win.ident || '(blank)')); return true; }
        if (win.stage === 'ident') { win.ident = m.id; win.stage = 'activate'; return true; }
        directTo(m.id);
        w[display] = null;
        return true;
      }
      if (win.prompt) { win.prompt.action(); win.prompt = null; return true; }
      if (win.entry) {
        const m = match(win.entry.ident);
        if (!m) { note('No waypoint matches ' + win.entry.ident); return true; }
        // Before the selected row, or after it (Insert After); the cursor
        // then sits after the new waypoint, or on it.
        const n = F().fpl.wpts.length;
        if (F().insertAfter && win.cursor < n) { insert(win.cursor + 1, m.id); win.cursor++; }
        else { insert(win.cursor, m.id); win.cursor++; }
        win.entry = null;
        return true;
      }
      return true;
    }
    function clr(win, display) {
      const w = F().win;
      if (win.type === 'dto') {
        if (win.stage === 'activate') win.stage = 'ident'; else w[display] = null;
        return true;
      }
      if (win.prompt) { win.prompt = null; return true; }
      if (win.entry) { win.entry = null; return true; }
      const f = F().fpl;
      if (win.cursor != null && win.cursor < f.wpts.length) {
        const i = win.cursor;
        win.prompt = { text: `Remove ${f.wpts[i]}?`, action: () => remove(i) };
        return true;
      }
      w[display] = null;
      return true;
    }

    // ---- The FMS knob ----
    function turn(part, steps, display) {
      const win = F().win[display];
      // (The MFD's pages take the knob before this; on the PFD it needs a
      // window.)
      if (!win) {
        note('FMS knob: open FPL, D→ or a softkey window first');
        return;
      }
      if (win.type === 'dto') {
        win.stage = 'ident';
        if (part === 'inner') editChar(win, steps); else moveCursor(win, steps);
        return;
      }
      if (win.prompt) return;
      if (win.cursor == null) { note('Push the FMS knob for the cursor'); return; }
      if (win.entry) {
        if (part === 'inner') editChar(win.entry, steps); else moveCursor(win.entry, steps);
        return;
      }
      if (part === 'outer') {
        win.cursor = clamp(win.cursor + steps, 0, F().fpl.wpts.length);
      } else {
        // The small knob opens a new waypoint before the selected row.
        win.entry = { ident: '', pos: 0 };
        editChar(win.entry, steps);
      }
    }
    function push(display) {
      const win = F().win[display];
      if (win?.type !== 'fpl') {
        note(display === 'mfd' ? 'MFD cursor: open FPL first' : 'FMS push: open FPL first');
        return;
      }
      const f = F().fpl;
      win.entry = win.prompt = null;
      win.cursor = win.cursor != null ? null : (f.dto?.index ?? f.active ?? f.wpts.length);
    }

    // The plan as rows for the display: id, desired track (magnetic, by
    // the variation at the leg's start) and distance of the leg to it,
    // cumulative distance, whether it is flown to now, and toGo: the
    // distance from the airplane along the route (the active waypoint and
    // those after it; null before), for ETE, ETA and fuel.
    function rows() {
      const f = F().fpl;
      let cum = 0;
      const out = f.wpts.map((id, i) => {
        const w = byId[id];
        let dtk = null, dis = null;
        if (i > 0) {
          const prev = byId[f.wpts[i - 1]];
          ({ brg: dtk, dist: dis } = bearingDist(prev, w));
          dtk = toMagAt(dtk, prev);
        }
        cum += dis ?? 0;
        const active = f.dto ? f.dto.index === i : f.active === i;
        return { id, name: w.name, dtk, dis, cum, active, toGo: null };
      });
      const at = out.findIndex((r) => r.active);
      if (at >= 0) {
        out[at].toGo = bearingDist(state, byId[out[at].id]).dist;
        for (let i = at + 1; i < out.length; i++) out[i].toGo = out[i - 1].toGo + out[i].dis;
      }
      return out;
    }

    return { fresh, press, turn, push, step, navSolution, leg, rows, match, byId, SCALE, directTo, insert, remove,
      toggleObs, project, freshFields, activateLeg, cancelDirect, invertPlan, deletePlan, storePlan, activatePlan, deleteAllStored, editChar, moveCursor,
      addUser, removeUser, placeUser, userName, inUse, closestPoint };
  }

  return { create, CHARS };
})();
