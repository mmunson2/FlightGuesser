// The mock G1000's alerts (used by js/g1000.js): the annunciation window
// (CAS: the POH's warnings and cautions, from js/g1000-systems.js), the
// system messages, and the PFD's ALERTS softkey and Alerts window.
//
// Annunciations: red warnings, amber cautions, in the window at the PFD's
// right edge. A new one flashes, and the ALERTS softkey becomes a
// flashing WARNING or CAUTION; pressing it acknowledges that level (the
// annunciation then stays steady while its condition holds).
//
// Messages, each there while its condition holds (worded after Garmin's
// message list):
//   INSIDE ARSPC     Inside airspace.
//   ARSPC AHEAD      Airspace ahead -- less than 10 minutes.
//   ARSPC NEAR       Airspace near and ahead. / Airspace near -- less than 2 nm.
//   WPT ARRIVAL      Arriving at waypoint -[id]   (10 s or less to go)
//   TIMER EXPIRD     Timer has expired.
//   DATABASE EXPIRE  Navigation database has expired.
// A new message turns the softkey into a flashing ADVISORY; pressing it
// acknowledges and opens the Alerts window listing them. Pressed again
// (or CLR), the window closes. The FMS knob scrolls it. Airspace is
// checked once a second for the classes on in AUX - System Setup
// (js/g1000-pages.js nearestAirspaces, with the altitude buffer).
window.G1000_ALERTS = (function () {
  const MSGS = {
    inside: { title: 'INSIDE ARSPC', text: 'Inside airspace.' },
    ahead: { title: 'ARSPC AHEAD', text: 'Airspace ahead -- less than 10 minutes.' },
    nearAhead: { title: 'ARSPC NEAR', text: 'Airspace near and ahead.' },
    near: { title: 'ARSPC NEAR', text: 'Airspace near -- less than 2 nm.' },
    wpt: { title: 'WPT ARRIVAL', text: 'Arriving at waypoint' },
    timer: { title: 'TIMER EXPIRD', text: 'Timer has expired.' },
    database: { title: 'DATABASE EXPIRE', text: 'Navigation database has expired.' },
    // The GPS's loss of integrity (the 'gps' failure).
    loi: { title: 'LOI', text: 'GPS integrity lost. Crosscheck with other NAVS.' },
  };
  const LEVELS = ['warning', 'caution'];

  // annunciations(): the systems' warnings and cautions now
  // (js/g1000-systems.js). gpsNav(): the GPS solution or null. gs(): ground
  // speed, kt. dbExpires: when the navigation database runs out (ms).
  function create({ state, pages, annunciations, gpsNav, gs, dbExpires, now = () => Date.now() }) {
    const A = () => state.alerts;
    const fresh = () => ({
      // Annunciations showing: { id, text, level, acked, t }.
      cas: [],
      // Messages showing: { id, title, text, about, t }.
      messages: [],
      // A message nobody has acknowledged yet: ADVISORY flashes.
      unseen: false,
      // Seconds until the next airspace check, and its last findings.
      wait: 0, airspace: {},
    });
    // AUX - System Setup's airspace alert settings.
    const freshSet = () => ({ buffer: 200, B: true, C: true, D: true });

    // The airspace conditions now: id -> the airspace it is about. One of
    // each kind, for the nearest airspace that has it.
    function airspaceConditions() {
      const set = state.alertSet, found = {};
      for (const a of pages.nearestAirspaces(25)) {
        if (!set[a.cls]) continue;
        const id = { INSIDE: 'inside', 'NEAR, AHEAD': 'nearAhead', 'AHEAD <10MIN': 'ahead', 'WITHIN 2NM': 'near' }[a.status];
        if (id && !found[id]) found[id] = a.name;
      }
      return found;
    }
    // Every message's condition now: id -> what it is about ('' if nothing).
    function conditions() {
      const found = { ...A().airspace };
      const nav = gpsNav();
      // WPT ARRIVAL: 10 seconds or less to the active waypoint (not in OBS).
      if (nav && !nav.obs && nav.remaining >= 0 && (nav.remaining / Math.max(gs(), 30)) * 3600 <= 10) found.wpt = nav.leg.to.id;
      if (state.ref.timer.expired) found.timer = '';
      if (dbExpires != null && now() >= dbExpires) found.database = '';
      if (state.sys.failed.gps) found.loi = '';
      return found;
    }

    function step(dt) {
      const al = A();
      // Annunciations: every step. Ones that go out are dropped; new ones
      // come in unacknowledged (flashing).
      const on = annunciations();
      al.cas = al.cas.filter((c) => on.some((o) => o.id === c.id));
      for (const o of on) if (!al.cas.some((c) => c.id === o.id)) al.cas.push({ ...o, acked: false, t: state.t });
      al.cas.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
      // Messages: airspace once a second, the rest every step.
      al.wait -= dt;
      if (al.wait <= 0) { al.wait = 1; al.airspace = airspaceConditions(); }
      const now = conditions();
      al.messages = al.messages.filter((m) => m.id in now);
      for (const [id, about] of Object.entries(now)) {
        const m = al.messages.find((x) => x.id === id);
        // WPT ARRIVAL names the waypoint: "Arriving at waypoint -[KAWO]".
        const shown = id === 'wpt' ? `${MSGS[id].text} -[${about}]` : MSGS[id].text;
        if (m) { m.about = about; m.text = shown; continue; }
        al.messages.unshift({ id, ...MSGS[id], text: shown, about, t: state.t });
        al.unseen = true;
      }
    }

    // What the ALERTS softkey shows: the most urgent unacknowledged level
    // ('warning', 'caution', 'advisory'), or null.
    function pending() {
      const al = A();
      for (const lv of LEVELS) if (al.cas.some((c) => c.level === lv && !c.acked)) return lv;
      return al.unseen ? 'advisory' : null;
    }
    // The ALERTS softkey: acknowledges the most urgent level; with nothing
    // to acknowledge, opens or closes the Alerts window.
    function softkey() {
      const w = state.fms.win, al = A(), lv = pending();
      if (lv === 'warning' || lv === 'caution') { al.cas.forEach((c) => { if (c.level === lv) c.acked = true; }); return; }
      if (lv === 'advisory') { al.unseen = false; w.pfd = { type: 'alerts', first: 0 }; return; }
      w.pfd = w.pfd?.type === 'alerts' ? null : { type: 'alerts', first: 0 };
    }
    // FMS knob and CLR in the window; true when handled.
    function input(kind, steps) {
      const win = state.fms.win.pfd;
      if (win?.type !== 'alerts') return false;
      if (kind === 'turn') win.first = Math.max(0, Math.min(win.first + steps, A().messages.length - 1));
      else if (kind === 'clr' || kind === 'push') state.fms.win.pfd = null;
      else if (kind !== 'ent') return false;
      return true;
    }

    return { fresh, freshSet, step, softkey, input, pending, MSGS };
  }

  return { create };
})();
