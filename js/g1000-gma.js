// The mock G1000's audio panel, the GMA 1347D between the displays (used
// by js/g1000.js): which radios the pilot hears and transmits on, the
// speaker, marker beacon audio, the intercom. js/g1000-panel.js lights the
// green annunciator over each key that is on (lit()). The mock makes no
// sound, so the panel only keeps the selections and shows them; the COM
// selected to transmit (MIC) is the PFD's green COM frequency.
//
// Keys, as remembered from the GMA 1347D pilot's guide:
//   COM1 MIC, COM2 MIC   transmit on that COM (one at a time); its receive
//                        comes on with it and stays on while it transmits.
//   COM1, COM2           receive that COM (the transmitting one can't go off).
//   COM 1/2              split: the pilot on COM1, the copilot on COM2.
//   COM3 MIC, COM3, TEL  not installed in the C172S: nothing happens.
//   PA                   the mic to the cabin speaker instead of a radio.
//   SPKR                 radio audio on the cabin speaker too.
//   MKR MUTE             silences the marker beacon tones.
//   HI SENS              marker beacon receiver high sensitivity.
//   NAV1, NAV2, DME, ADF, AUX   receive those (station identifiers).
//   MAN SQ               manual intercom squelch: the large knob sets it.
//   PLAY                 replays the last COM message (lit while playing).
//   PILOT, COPLT         intercom isolation: PILOT lit, the pilot hears
//                        only the radios; COPLT lit, the copilot is cut
//                        off from the pilot; both, the crew talk together
//                        apart from the passengers (CREW).
// The volume knob: small knob intercom volume (push: pilot or passengers),
// large knob the squelch (with MAN SQ on).
window.G1000_GMA = (function () {
  // Part id (js/g1000-panel.js) -> key name here.
  const KEYS = ['com1_mic', 'com2_mic', 'com3_mic', 'com1', 'com2', 'com3', 'com12', 'tel', 'pa', 'spkr',
    'mkr_mute', 'hi_sens', 'dme', 'nav1', 'adf', 'nav2', 'aux', 'play', 'man_sq', 'pilot', 'coplt'];
  const RX = ['com1', 'com2', 'nav1', 'nav2', 'dme', 'adf', 'aux'];
  const PLAY_SECONDS = 4;

  function create({ state, note }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const A = () => state.gma;
    // Power-up: COM1 transmitting and received, the rest off.
    const fresh = () => ({
      mic: 1, pa: false, split: false,
      rx: Object.fromEntries(RX.map((k) => [k, k === 'com1'])),
      spkr: false, mkrMute: false, hiSens: false, manSq: false, playUntil: 0,
      iso: { pilot: false, coplt: false },
      // Intercom volume (pilot, passengers), squelch; the small knob sets
      // `vol.which`.
      vol: { pilot: 70, pass: 70, sq: 40, which: 'pilot' },
    });

    function press(key) {
      const a = A();
      switch (key) {
        case 'com1_mic': case 'com2_mic': {
          const n = key === 'com1_mic' ? 1 : 2;
          a.mic = n; a.pa = false; a.split = false;
          a.rx['com' + n] = true;
          return;
        }
        case 'com1': case 'com2': {
          const n = key === 'com1' ? 1 : 2;
          if (a.mic === n && !a.pa && a.rx[key]) return note(`COM${n} is transmitting: its receive stays on`);
          a.rx[key] = !a.rx[key];
          return;
        }
        case 'com3_mic': case 'com3': return note('COM3 isn\'t installed in the C172S');
        case 'tel': return note('TEL: no telephone installed in the C172S');
        // Split COM: pilot transmits and hears COM1, copilot COM2.
        case 'com12':
          a.split = !a.split;
          if (a.split) { a.mic = 1; a.pa = false; a.rx.com1 = a.rx.com2 = true; }
          return;
        case 'pa': a.pa = !a.pa; if (a.pa) a.split = false; return;
        case 'spkr': a.spkr = !a.spkr; return;
        case 'mkr_mute': a.mkrMute = !a.mkrMute; return;
        case 'hi_sens': a.hiSens = !a.hiSens; return;
        case 'man_sq': a.manSq = !a.manSq; return;
        case 'play':
          if (state.t < a.playUntil) { a.playUntil = 0; return; }
          a.playUntil = state.t + PLAY_SECONDS;
          return note('PLAY: replaying the last COM message (no sound in the mock)');
        case 'pilot': case 'coplt': a.iso[key] = !a.iso[key]; return;
        default:
          if (RX.includes(key)) a.rx[key] = !a.rx[key];
      }
    }
    // The volume knob: small (inner) the intercom volume, large (outer) the
    // squelch, which only works with MAN SQ on.
    function turn(part, steps) {
      const a = A(), v = a.vol;
      if (part === 'outer') {
        if (!a.manSq) return note('Squelch: press MAN SQ first (automatic squelch now)');
        v.sq = clamp(v.sq + steps * 5, 0, 100);
        v.show = { what: 'SQ', until: state.t + 2 };
      } else {
        v[v.which] = clamp(v[v.which] + steps * 5, 0, 100);
        v.show = { what: v.which === 'pilot' ? 'PILOT VOL' : 'PASS VOL', until: state.t + 2 };
      }
      const val = part === 'outer' ? v.sq : v[v.which];
      note(`${v.show.what} ${val}%`);
    }
    function push() {
      const v = A().vol;
      v.which = v.which === 'pilot' ? 'pass' : 'pilot';
      note(`Volume knob: ${v.which === 'pilot' ? 'pilot' : 'passenger'} intercom volume`);
    }

    // Is the key's annunciator lit?
    function lit(key) {
      const a = A();
      switch (key) {
        case 'com1_mic': return a.mic === 1 && !a.pa;
        case 'com2_mic': return a.mic === 2 && !a.pa;
        case 'com12': return a.split;
        case 'pa': return a.pa;
        case 'spkr': return a.spkr;
        case 'mkr_mute': return a.mkrMute;
        case 'hi_sens': return a.hiSens;
        case 'man_sq': return a.manSq;
        case 'play': return state.t < a.playUntil;
        case 'pilot': case 'coplt': return a.iso[key];
        default: return !!a.rx[key];
      }
    }
    // The COM transmitting (1 or 2), or null on PA.
    const transmitting = () => (A().pa ? null : A().mic);

    return { fresh, press, turn, push, lit, transmitting, KEYS };
  }

  return { create, KEYS };
})();
