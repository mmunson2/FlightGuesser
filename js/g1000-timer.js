// The mock G1000's Timer/References window (used by js/g1000.js): the
// PFD's Tmr/Ref softkey opens it in the PFD's lower right.
//
// It holds the generic timer (counting up, or down from a set time), the
// V-speed references (Vglide, Vr, Vx, Vy), which show as bugs on the
// airspeed tape when on, and the barometric minimums, which put a bug on
// the altitude tape and a BARO MIN box under it.
//
// The large FMS knob moves the cursor from field to field, the small knob
// changes the field under it, and ENT does what the timer's START?, STOP?
// or RESET? says. MENU (js/g1000-menu.js) turns all the references on or
// off, or restores their speeds. CLR or the Tmr/Ref softkey closes it.
window.G1000_TIMER = (function () {
  // C172S POH: rotate 55, best angle 62, best rate 74, best glide 68 KIAS.
  const VSPEEDS = [
    { key: 'glide', name: 'Vglide', tag: 'G', kt: 68 },
    { key: 'r', name: 'Vr', tag: 'R', kt: 55 },
    { key: 'x', name: 'Vx', tag: 'X', kt: 62 },
    { key: 'y', name: 'Vy', tag: 'Y', kt: 74 },
  ];
  // The cursor's stops, in order. A V-speed has two: its speed and ON/OFF.
  const FIELDS = [
    { id: 'time' }, { id: 'dir' }, { id: 'action' },
    ...VSPEEDS.flatMap((v) => [{ id: 'kt', v: v.key }, { id: 'on', v: v.key }]),
    { id: 'minMode' }, { id: 'minFt' },
  ];
  const MIN_MODES = ['OFF', 'BARO'];

  function create({ state, note, indicatedAlt }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const R = () => state.ref;
    const fresh = () => ({
      // The timer: seconds shown, UP or DN, running or not, and the time
      // a count down was set to (RESET goes back to it).
      timer: { secs: 0, dir: 'UP', running: false, set: 0, expired: false },
      v: Object.fromEntries(VSPEEDS.map((v) => [v.key, { kt: v.kt, on: false }])),
      // Minimums: OFF or BARO, and the altitude (ft, indicated).
      mins: { mode: 'OFF', ft: 1000, below: false },
    });
    const win = () => (state.fms.win.pfd?.type === 'tmr' ? state.fms.win.pfd : null);

    // The timer's action as the window shows it.
    function action() {
      const t = R().timer;
      if (t.running) return 'STOP?';
      return t.secs !== (t.dir === 'DN' ? t.set : 0) ? 'RESET?' : 'START?';
    }

    function toggle() {
      const w = state.fms.win;
      // The cursor starts on UP/DN, as the timer is the usual reason.
      w.pfd = w.pfd?.type === 'tmr' ? null : { type: 'tmr', cursor: 1 };
    }

    // Small knob on a field.
    function change(f, steps) {
      const r = R(), t = r.timer;
      switch (f.id) {
        case 'time':
          // Set while stopped: whole minutes (a count down's start).
          if (t.running) { note('Stop the timer to set it'); return; }
          t.secs = clamp(Math.floor(t.secs / 60) * 60 + steps * 60, 0, 99 * 3600);
          if (t.dir === 'DN') t.set = t.secs;
          return;
        case 'dir':
          t.dir = t.dir === 'UP' ? 'DN' : 'UP';
          if (t.dir === 'DN' && !t.running) t.set = t.secs;
          return;
        case 'action': return;
        case 'kt': r.v[f.v].kt = clamp(r.v[f.v].kt + steps, 20, 163); return;
        case 'on': r.v[f.v].on = !r.v[f.v].on; return;
        case 'minMode': {
          const i = MIN_MODES.indexOf(r.mins.mode);
          r.mins.mode = MIN_MODES[(((i + steps) % MIN_MODES.length) + MIN_MODES.length) % MIN_MODES.length];
          return;
        }
        case 'minFt': r.mins.ft = clamp(r.mins.ft + steps * 10, 0, 16000); return;
      }
    }
    function ent() {
      const t = R().timer, a = action();
      if (a === 'STOP?') t.running = false;
      else if (a === 'START?') { t.running = true; t.expired = false; }
      else { t.secs = t.dir === 'DN' ? t.set : 0; t.expired = false; }
    }

    // FMS knob and keys in the window; true when handled. kind: 'turn'
    // (arg: part, steps), 'push', 'ent', 'clr'.
    function input(kind, part, steps) {
      const w = win();
      if (!w) return false;
      if (kind === 'turn') {
        if (part === 'outer') w.cursor = clamp(w.cursor + steps, 0, FIELDS.length - 1);
        else change(FIELDS[w.cursor], steps);
      } else if (kind === 'ent') {
        // ENT anywhere runs the timer's action, then the cursor sits on it.
        w.cursor = 2;
        ent();
      } else if (kind === 'clr' || kind === 'push') {
        state.fms.win.pfd = null;
      } else return false;
      return true;
    }

    // Every step: the timer, and the minimums alert (below the minimums
    // once above them).
    function step(dt) {
      const r = R(), t = r.timer;
      if (t.running) {
        if (t.dir === 'UP' || t.expired) t.secs += dt;
        else {
          t.secs -= dt;
          // Zero on a count down: it says so and counts up from there.
          if (t.secs <= 0) { t.secs = -t.secs; t.expired = true; note('Timer expired'); }
        }
      }
      const m = r.mins;
      const below = m.mode === 'BARO' && indicatedAlt() <= m.ft;
      if (below && !m.below) note('MINIMUMS');
      m.below = below;
    }

    // The Page Menu's options for this window (js/g1000-menu.js).
    function menuOptions(opt) {
      const v = R().v;
      return [
        opt('All References On', () => Object.values(v).forEach((x) => { x.on = true; })),
        opt('All References Off', () => Object.values(v).forEach((x) => { x.on = false; })),
        opt('Restore Defaults', () => VSPEEDS.forEach((s) => { v[s.key] = { kt: s.kt, on: false }; }),
          'Restore V-speed defaults?'),
      ];
    }

    return { fresh, toggle, input, step, action, menuOptions, isOpen: () => !!win() };
  }

  return { create, VSPEEDS, FIELDS };
})();
