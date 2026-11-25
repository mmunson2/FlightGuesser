// The mock G1000's aural alerts, with Web Audio tones and the browser's
// speech: the autopilot disconnect tone, the altitude alerter's chime
// (1,000 ft before the selected altitude, and on straying 200 ft from it
// once there), a warning chime repeating until the warning is
// acknowledged (ALERTS softkey), a single chime for a new caution, and
// "Minimums" when the baro minimums are reached.
//
// detect(memory, state) works out what is due (pure apart from its
// memory, so tools/check.py tests it); create() plays it, when on.
// Browsers only allow sound after a click or key, which operating the
// panel always is.
window.G1000_AUDIO = (function () {
  // Seconds between a warning's chimes while it is unacknowledged.
  const WARN_REPEAT = 2;
  const freshMemory = () => ({ apOffAt: null, altFlash: null, cautions: [], below: false, lastWarn: -99, t: null });

  // The sounds now due: 'apDisconnect', 'altitude', 'warning', 'caution',
  // 'minimums'. The first call only learns the state.
  function detect(mem, s) {
    const out = [];
    const first = mem.t == null || s.t < mem.t;
    const cas = s.alerts?.cas ?? [];
    const cautions = cas.filter((c) => c.level === 'caution' && !c.acked).map((c) => c.id);
    if (!first) {
      if (s.afcs.apOffAt !== mem.apOffAt && s.afcs.apOffAt > 0) out.push('apDisconnect');
      // The alerter's flash starts with each alert.
      if (s.alt.flashUntil !== mem.altFlash && (s.alt.phase === 'approach' || s.alt.phase === 'deviate')) out.push('altitude');
      if (cas.some((c) => c.level === 'warning' && !c.acked) && s.t - mem.lastWarn >= WARN_REPEAT) {
        out.push('warning');
        mem.lastWarn = s.t;
      }
      if (cautions.some((id) => !mem.cautions.includes(id))) out.push('caution');
      if (s.ref?.mins.below && !mem.below) out.push('minimums');
    }
    Object.assign(mem, { apOffAt: s.afcs.apOffAt, altFlash: s.alt.flashUntil, cautions, below: !!s.ref?.mins.below, t: s.t });
    return out;
  }

  function create() {
    const mem = freshMemory();
    let ctx = null, on = true;
    // A tone: a list of [frequency (Hz), seconds] played one after another.
    function tones(seq, gain = 0.15) {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      let t = ctx.currentTime + 0.02;
      for (const [f, d] of seq) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.01);
        g.gain.setValueAtTime(gain, t + d - 0.02);
        g.gain.linearRampToValueAtTime(0, t + d);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + d);
        t += d;
      }
    }
    function say(words) {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(words);
      u.rate = 1.05;
      speechSynthesis.speak(u);
    }
    const SOUNDS = {
      // A falling two-tone, about 1.5 s.
      apDisconnect: () => tones([[1300, 0.25], [900, 0.25], [1300, 0.25], [900, 0.25], [1300, 0.25], [900, 0.25]], 0.12),
      altitude: () => tones([[1000, 0.12], [0, 0.05], [1000, 0.12], [0, 0.05], [1000, 0.12]]),
      warning: () => tones([[1600, 0.15], [1200, 0.15], [1600, 0.15], [1200, 0.15]]),
      caution: () => tones([[800, 0.35]]),
      minimums: () => say('Minimums'),
    };
    return {
      // Called every frame: plays what has come due (nothing while off).
      update(s) {
        const due = detect(mem, s);
        if (on) due.forEach((k) => SOUNDS[k]());
        return due;
      },
      get on() { return on; },
      set on(v) { on = !!v; if (!on && window.speechSynthesis) speechSynthesis.cancel(); },
      play: (k) => SOUNDS[k]?.(),
    };
  }

  return { create, detect, freshMemory };
})();
