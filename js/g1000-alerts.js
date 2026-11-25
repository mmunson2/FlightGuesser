// The mock G1000's alerts (used by js/g1000.js): system messages, so far
// the airspace alerts, and the PFD's ALERTS softkey and Alerts window.
//
// Once a second the airspace around the airplane is checked
// (js/g1000-pages.js nearestAirspaces, with the altitude buffer) for the
// classes turned on in AUX - System Setup. Each condition is a message,
// there while the condition holds:
//   INSIDE ARSPC  Inside airspace.
//   ARSPC AHEAD   Airspace ahead -- less than 10 minutes.
//   ARSPC NEAR    Airspace near and ahead.
//   ARSPC NEAR    Airspace near -- less than 2 nm.
// A new message turns the ALERTS softkey into a flashing ADVISORY until
// it is pressed, which acknowledges it and opens the Alerts window; the
// softkey (or CLR) closes the window again. The FMS knob scrolls it.
window.G1000_ALERTS = (function () {
  const AIRSPACE_MSGS = {
    inside: { title: 'INSIDE ARSPC', text: 'Inside airspace.' },
    ahead: { title: 'ARSPC AHEAD', text: 'Airspace ahead -- less than 10 minutes.' },
    nearAhead: { title: 'ARSPC NEAR', text: 'Airspace near and ahead.' },
    near: { title: 'ARSPC NEAR', text: 'Airspace near -- less than 2 nm.' },
  };

  function create({ state, pages }) {
    const A = () => state.alerts;
    const fresh = () => ({
      // Messages showing: { id, title, text, about (the airspace), t }.
      messages: [],
      // A message nobody has acknowledged yet: the softkey flashes.
      unseen: false,
      // Seconds until the next airspace check.
      wait: 0,
    });
    // AUX - System Setup's airspace alert settings.
    const freshSet = () => ({ buffer: 200, B: true, C: true, D: true });

    // The airspace conditions now: id -> the airspace it is about. One of
    // each kind, for the nearest airspace that has it; INSIDE outranks the
    // rest for the same airspace.
    function airspaceConditions() {
      const set = state.alertSet, found = {};
      for (const a of pages.nearestAirspaces(25)) {
        if (!set[a.cls]) continue;
        let id = null;
        if (a.status === 'INSIDE') id = 'inside';
        else if (a.status === 'NEAR, AHEAD') id = 'nearAhead';
        else if (a.status === 'AHEAD <10MIN') id = 'ahead';
        else if (a.status === 'WITHIN 2NM') id = 'near';
        if (id && !found[id]) found[id] = a.name;
      }
      return found;
    }

    function step(dt) {
      const al = A();
      al.wait -= dt;
      if (al.wait > 0) return;
      al.wait = 1;
      const now = airspaceConditions();
      // Cleared conditions go; new ones come in at the top.
      al.messages = al.messages.filter((m) => now[m.id]);
      for (const [id, about] of Object.entries(now)) {
        const m = al.messages.find((x) => x.id === id);
        if (m) { m.about = about; continue; }
        al.messages.unshift({ id, ...AIRSPACE_MSGS[id], about, t: state.t });
        al.unseen = true;
      }
    }

    // The ALERTS softkey: acknowledges, and opens or closes the window.
    function softkey() {
      const w = state.fms.win, al = A();
      if (al.unseen) { al.unseen = false; w.pfd = { type: 'alerts', first: 0 }; return; }
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

    return { fresh, freshSet, step, softkey, input, MSGS: AIRSPACE_MSGS };
  }

  return { create };
})();
