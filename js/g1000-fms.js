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
// selected row. CLR on a waypoint offers to remove it; MENU offers to
// activate the leg to it.
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
    const byId = Object.fromEntries(waypoints.map((w) => [w.id, w]));
    const sorted = waypoints.slice().sort((a, b) => a.id.localeCompare(b.id));
    // The first waypoint whose identifier starts with what was typed.
    const match = (typed) => (typed ? sorted.find((w) => w.id.startsWith(typed)) ?? null : null);

    const fresh = () => ({
      // wpts: identifiers in order. active: index of the waypoint flown TO
      // (the leg from wpts[active - 1]), null with no active leg. dto: a
      // Direct-To in force: { from: {lat, lon}, to: id, index: its place
      // in the plan or null }.
      fpl: { wpts: [], active: null, dto: null },
      // The open window on each display: null, a Direct-To window
      // { type: 'dto', ident, pos, stage: 'ident' | 'activate' }, or the
      // flight plan { type: 'fpl', cursor, entry: {ident, pos} | null,
      // prompt: {text, action} | null }.
      win: { pfd: null, mfd: null },
    });
    const F = () => state.fms;

    // ---- The active leg and the GPS course ----
    function leg() {
      const f = F().fpl;
      if (f.dto) return { from: f.dto.from, to: byId[f.dto.to], fromId: null, direct: true };
      if (f.active == null || f.active < 1 || f.active >= f.wpts.length) return null;
      return { from: byId[f.wpts[f.active - 1]], to: byId[f.wpts[f.active]], fromId: f.wpts[f.active - 1], direct: false };
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
      if (!l) return null;
      const p = legPosition(l);
      const scale = scaleName();
      const to = bearingDist(state, l.to);
      // Desired track and bearing shown magnetic, by the variation where
      // the airplane is.
      return {
        source: 'GPS', station: l.to, course: toMagAt(p.dtk, state), courseTrue: p.dtk,
        toFrom: p.remaining > 0 ? 'TO' : 'FROM',
        dev: clamp(-p.xtk / SCALE[scale], -1, 1), xtk: p.xtk, dist: to.dist, bearingTo: toMagAt(to.brg, state),
        capturable: Math.abs(p.xtk) < SCALE[scale], scale, remaining: p.remaining, leg: l,
      };
    }

    // ---- Sequencing: on reaching the TO waypoint, the next leg ----
    function step() {
      const f = F().fpl, l = leg();
      if (!l) return;
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
    }
    function activateLeg(i) {
      const f = F().fpl;
      f.dto = null;
      f.active = i;
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
        case 'menu':
          if (win?.type !== 'fpl' || win.cursor == null) return false;
          if (win.cursor >= 1 && win.cursor < F().fpl.wpts.length) {
            const i = win.cursor;
            win.prompt = { text: `Activate leg to ${F().fpl.wpts[i]}?`, action: () => activateLeg(i) };
          } else note('Pick a waypoint after the first to activate the leg to it');
          return true;
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
        insert(win.cursor, m.id);
        win.cursor++;
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
      if (!win) {
        note(display === 'mfd' ? 'MFD page groups: not in the mock yet (try FPL or D→)'
          : 'FMS knob: open FPL or D→ first');
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
    // cumulative distance, and whether it is flown to now.
    function rows() {
      const f = F().fpl;
      let cum = 0;
      return f.wpts.map((id, i) => {
        const w = byId[id];
        let dtk = null, dis = null;
        if (i > 0) {
          const prev = byId[f.wpts[i - 1]];
          ({ brg: dtk, dist: dis } = bearingDist(prev, w));
          dtk = toMagAt(dtk, prev);
        }
        cum += dis ?? 0;
        const active = f.dto ? f.dto.index === i : f.active === i;
        return { id, name: w.name, dtk, dis, cum, active };
      });
    }

    return { fresh, press, turn, push, step, navSolution, leg, rows, match, byId, SCALE, directTo, insert, remove,
      activateLeg, editChar, moveCursor };
  }

  return { create, CHARS };
})();
