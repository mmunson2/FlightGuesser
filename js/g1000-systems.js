// The airplane's systems behind the mock G1000's engine display and its
// annunciations (used by js/g1000.js): engine, oil, vacuum, the
// electrical system, the fuel tanks and the cabin's CO level. A few lines
// each, enough for the numbers to move the right way and the POH's
// annunciations to come on when they should.
//
// The C172S POH (section 7, "G1000 annunciator panel") lists the
// annunciations, shown at the PFD's right edge beside the VSI:
//   OIL PRESSURE (red)  oil pressure 0 to 20 PSI
//   LOW VOLTS    (red)  main bus below 24.5 V (can come on below 1,000 RPM)
//   HIGH VOLTS   (red)  main or essential bus above 32.0 V
//   CO LVL HIGH  (red)  cabin CO 50 PPM or more
//   LOW FUEL L/R (amber) under 5 gal indicated for more than 60 seconds
//   LOW VACUUM   (amber) vacuum below 3.5 inHg
//   STBY BATT    (amber) standby battery discharging over 0.5 A for 10 s
// The GFC 700 adds PTRM (pitch trim failure) in its own status box.
//
// Failures (the Failures list in Operate mode) make them happen:
// alternator, overvoltage, oil loss, vacuum pump, a left tank leak, CO
// from the exhaust, a pitch trim fault, and the GPS's loss of integrity
// (LOI; js/g1000-fms.js drops the GPS course). Both tanks dry, or a
// mixture leaned far past peak, stops the engine.
//
// The mixture (state.mixture, 0 idle cutoff to 1 full rich) and the four
// cylinders' EGT and CHT, for the EIS's Lean page, and the fuel totalizer
// (fuel remaining as the pilot set it, less what the fuel flow says was
// burnt: it knows nothing of the tanks, so a leak shows as a mismatch).
//
// The panel's switches (state.sys.sw; js/g1000-switches.js flips them):
// - MASTER, a split rocker: ALT can't be on with BAT off (turning ALT on
//   turns BAT on, BAT off turns ALT off). ALT off: no alternator. BAT off:
//   the battery is cut off; with no alternator either the main bus is dead.
// - STBY BATT: ARM lets the standby battery take the essential bus when
//   the main bus fails; OFF doesn't. TEST (spring-loaded, back to OFF)
//   lights the test lamp if the standby battery is charged.
// - AVIONICS BUS 1 and BUS 2 (from the main bus). The PFD runs on the
//   essential bus or avionics bus 1, the MFD and the autopilot on avionics
//   bus 2 (the breaker panel's rows).
// - Lights and pitot heat: load on the main bus (their amps made up).
// - The ignition switch (sw.mags): OFF, R, L, BOTH, START. OFF stops the
//   engine (back on, it runs again: the windmilling propeller turns it).
//   One magneto alone drops the RPM (R 70, L 55: made up, inside the POH's
//   150 and 50). START springs back to BOTH.
// - The pump, cabin power and ELT do nothing yet (procedure practice).
window.G1000_SYSTEMS = (function () {
  const FAILURES = ['alternator', 'overvolt', 'oil', 'vacuum', 'leakL', 'co', 'trim', 'gps'];
  // Richness: the fuel-air ratio over the one that gives peak EGT (1).
  // Full rich gives 1.35 at sea level, richer as the air thins.
  const richAt = (alt) => 1.35 * (1 + alt / 25000);
  // Best power: about 100 °F rich of peak.
  const BEST_POWER = 1.15;
  // Each cylinder's share of the mixture (cylinder 2 runs leanest and
  // peaks first) and its peak EGT, °F.
  const CYL_RICH = [1.0, 0.97, 1.02, 0.99], CYL_PEAK = [1440, 1475, 1420, 1455];
  // The fuel the totalizer starts with, and full usable fuel (gal).
  const FULL_USABLE = 53;
  // Main battery: usable charge, amp-hours; the load with the alternator
  // off, amps. About 35 minutes to the 20 V where the standby battery
  // takes the essential bus (made up; the POH says only "a short time").
  const BATT_AH = 9, LOAD_A = 10;
  // What each switch adds to the main bus, amps (made up).
  const SWITCH_A = { beacon: 1.5, land: 7, taxi: 7, nav: 2, strobe: 2, pitot: 9 };
  // Switch positions in flight, where the mock starts.
  const SWITCHES = { bat: true, alt: true, avn1: true, avn2: true, stby: 'arm',
                     beacon: true, land: false, taxi: false, nav: true, strobe: true, pitot: false,
                     // Not wired to anything yet (procedure practice): ELT on = transmitting.
                     fuelPump: false, cabinPwr: false, elt: false, mags: 'both',
                     // Push-pull, 0 in (closed) to 1 out: nothing yet.
                     cabinHeat: 0, cabinAir: 0 };
  const MAGS = ['off', 'r', 'l', 'both', 'start'];
  const MAG_DROP = { r: 70, l: 55 };
  // TEST springs back to OFF after this long (s), standing for a held press.
  const TEST_S = 1.5;
  // The test lamp lights with the standby battery over this charge (0-1).
  const STBY_OK = 0.5;
  // The ACU trips the alternator this long after an overvoltage (s).
  const ACU_TRIP_S = 3;

  function create({ state }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const S = () => state.sys;
    const fresh = () => ({
      running: true, rpm: 2140, oilPsi: 60, oilF: 190, vac: 5.0,
      voltsM: 28.0, voltsE: 28.0, ampsM: 1.0, ampsS: 0.2, batt: BATT_AH, stbyBatt: 1, acuTripped: false,
      coPpm: 0, overvoltFor: 0,
      egt: [0, 0, 0, 0], cht: [0, 0, 0, 0],
      // Lean assist: on, the hottest EGT seen per cylinder since it came
      // on, and the first cylinder to pass its peak. cyl: the cylinder
      // Cyl Slct shows (0-3).
      lean: { assist: false, max: [0, 0, 0, 0], peaked: null, cyl: 0 },
      // The totalizer: fuel remaining as set (the 48 gal the mock starts
      // with), fuel used (gal).
      tot: { rem: 48, used: 0 },
      // How long each delayed annunciation's condition has held (s).
      held: { fuelL: 0, fuelR: 0, stby: 0 },
      sw: { ...SWITCHES }, testFor: 0, startFor: 0,
      failed: Object.fromEntries(FAILURES.map((f) => [f, false])),
    });

    // Usable fuel in each tank (gal); state.fuel is their sum.
    function burn(dt, gph) {
      let need = (gph / 3600) * dt;
      // Fuel selector BOTH: each tank feeds half, the other the rest if dry.
      const half = need / 2;
      const fromL = Math.min(state.fuelL, half), fromR = Math.min(state.fuelR, half);
      state.fuelL -= fromL; state.fuelR -= fromR; need -= fromL + fromR;
      const more = Math.min(state.fuelL + state.fuelR, need);
      if (more > 0) { const l = Math.min(state.fuelL, more); state.fuelL -= l; state.fuelR -= more - l; }
      // A left tank leak: 20 gal an hour overboard.
      if (S().failed.leakL) state.fuelL = Math.max(0, state.fuelL - (20 / 3600) * dt);
      state.fuel = state.fuelL + state.fuelR;
    }

    // ---- The mixture ----
    const richness = () => state.mixture * richAt(state.trueAlt);
    // What the mixture does to the engine: power (1 at best power and
    // richer, falling off lean of peak) and fuel flow (in proportion to
    // the fuel, 1 at best power).
    function mixtureEffect() {
      const r = richness();
      return { r, power: r >= 1 ? 1 : Math.max(0, 1 - 1.2 * (1 - r) ** 2), fuel: r / BEST_POWER };
    }
    // The mixture for best power at an altitude (where the mock starts).
    const bestPowerMixture = (alt) => BEST_POWER / richAt(alt);

    // EGT: highest at the cylinder's peak, falling 500 °F per unit of
    // richness rich of it and 700 lean of it; hotter with power. CHT
    // follows it, coolest well rich or well lean.
    function temps(dt) {
      const s = S(), r = richness();
      for (let c = 0; c < 4; c++) {
        const rc = r * CYL_RICH[c], peak = CYL_PEAK[c] + 100 * (state.power - 0.75);
        const egt = !s.running ? 100 : peak - (rc >= 1 ? 500 * (rc - 1) : 700 * (1 - rc));
        // A few seconds' lag, as the probes have.
        s.egt[c] += clamp(egt - s.egt[c], -40 * dt, 40 * dt);
        if (!s.egt[c] || Math.abs(s.egt[c] - egt) > 600) s.egt[c] = egt;
        s.cht[c] = s.running ? 200 + 0.2 * (s.egt[c] - 600) - 20 * Math.abs(rc - 1.05) : 100;
      }
      // Lean assist: each cylinder's hottest; the first to fall 5 °F
      // below it, having been leaned, has peaked.
      const L = s.lean;
      if (!L.assist) return;
      s.egt.forEach((e, c) => { L.max[c] = Math.max(L.max[c], e); });
      if (L.peaked == null) {
        const c = s.egt.findIndex((e, k) => e < L.max[k] - 5 && r * CYL_RICH[k] < 1);
        if (c >= 0) L.peaked = c;
      }
    }

    function step(dt, gph) {
      const s = S(), f = s.failed;
      burn(dt, gph);
      // The totalizer counts what the fuel flow says.
      s.tot.used += (gph / 3600) * dt;
      s.tot.rem = Math.max(0, s.tot.rem - (gph / 3600) * dt);
      // Both tanks dry, idle cutoff, or leaned far past peak: the engine
      // stops (and runs again with fuel and mixture: no starter here).
      s.running = state.fuel > 0.01 && richness() >= 0.55 && s.sw.mags !== 'off';
      s.rpm = s.running ? 700 + 1800 * state.power * mixtureEffect().power - (MAG_DROP[s.sw.mags] || 0) : 0;
      // START springs back to BOTH.
      if (s.sw.mags === 'start' && (s.startFor -= dt) <= 0) s.sw.mags = 'both';
      temps(dt);
      // Oil: pressure with RPM; lost oil drains it away and heats it up.
      const oilTarget = !s.running ? 0 : f.oil ? 5 : clamp(25 + 0.017 * s.rpm, 25, 75);
      s.oilPsi += clamp(oilTarget - s.oilPsi, -2 * dt, 4 * dt);
      s.oilF += clamp((f.oil && s.running ? 245 : 190) - s.oilF, -0.5 * dt, 1 * dt);
      // Vacuum: engine-driven, regulated to 5.0 from idle up.
      const vacTarget = !s.running || f.vacuum ? 0 : s.rpm < 1000 ? 4.6 : 5.0;
      s.vac += clamp(vacTarget - s.vac, -1 * dt, 1 * dt);

      // Electrical. The alternator needs the engine, about 1,000 RPM for
      // full output, and the ACU not to have tripped it.
      if (f.overvolt && !s.acuTripped) {
        s.overvoltFor += dt;
        if (s.overvoltFor > ACU_TRIP_S) s.acuTripped = true;
      }
      const sw = s.sw;
      const alt = s.running && !f.alternator && !s.acuTripped && sw.alt;
      // The main battery's voltage falls from 24 V as it empties; with BAT
      // off it is out of the circuit (M BATT reads 0).
      const battV = 20 + (4 * s.batt) / BATT_AH;
      const load = LOAD_A + Object.entries(SWITCH_A).reduce((a, [k, amps]) => a + (sw[k] ? amps : 0), 0);
      const charge = (amps) => { if (sw.bat) s.batt = clamp(s.batt + (amps / 3600) * dt, 0, BATT_AH); };
      if (alt && f.overvolt) { s.voltsM = 32.6; s.ampsM = sw.bat ? 25 : 0; }
      else if (alt && s.rpm >= 1000) { s.voltsM = 28.0; s.ampsM = !sw.bat ? 0 : s.batt < BATT_AH ? 8 : 1.0; charge(8); }
      else if (alt) { s.voltsM = 24.2; s.ampsM = sw.bat ? -3 : 0; charge(-3); }
      else if (sw.bat) { s.ampsM = -load; charge(-load); s.voltsM = battV; }
      else { s.ampsM = 0; s.voltsM = 0; }
      // Below 20 V on the main bus, the standby battery (ARM) feeds the
      // essential bus: it discharges, and the essential bus is its volts.
      if (s.voltsM <= 20.05 && sw.stby === 'arm' && s.stbyBatt > 0) {
        s.ampsS = -3.5;
        s.stbyBatt = Math.max(0, s.stbyBatt - dt / 1800);
        s.voltsE = 22 + 2 * s.stbyBatt;
      } else {
        s.ampsS = alt && s.rpm >= 1000 && sw.stby === 'arm' ? 0.2 : 0;
        s.voltsE = s.voltsM;
      }
      // TEST springs back to OFF.
      if (sw.stby === 'test' && (s.testFor -= dt) <= 0) sw.stby = 'off';
      // Cabin CO: an exhaust leak (with the cabin heat on) builds it up.
      s.coPpm += clamp((f.co ? 120 : 0) - s.coPpm, -4 * dt, 3 * dt);

      // Delayed annunciations: LOW FUEL after 60 s, STBY BATT after 10 s.
      const hold = (k, cond) => { s.held[k] = cond ? s.held[k] + dt : 0; };
      hold('fuelL', state.fuelL < 5);
      hold('fuelR', state.fuelR < 5);
      hold('stby', s.ampsS < -0.5);
    }

    // The annunciations on now: [{ id, text, level: 'warning' | 'caution' }],
    // warnings first, in the POH's order.
    function annunciations() {
      const s = S(), out = [];
      const add = (cond, id, text, level) => { if (cond) out.push({ id, text, level }); };
      add(s.oilPsi <= 20, 'oil', 'OIL PRESSURE', 'warning');
      add(s.voltsM < 24.5, 'lowVolts', 'LOW VOLTS', 'warning');
      add(s.voltsM > 32 || s.voltsE > 32, 'highVolts', 'HIGH VOLTS', 'warning');
      add(s.coPpm >= 50, 'co', 'CO LVL HIGH', 'warning');
      add(s.held.fuelL > 60, 'fuelL', 'LOW FUEL L', 'caution');
      add(s.held.fuelR > 60, 'fuelR', 'LOW FUEL R', 'caution');
      add(s.vac < 3.5, 'vac', 'LOW VACUUM', 'caution');
      add(s.held.stby > 10, 'stby', 'STBY BATT', 'caution');
      return out;
    }

    function fail(id, on = !S().failed[id]) {
      const s = S();
      s.failed[id] = on;
      // Clearing an overvoltage is the ACU reset too (ALT FIELD in).
      if (id === 'overvolt' && !on) { s.acuTripped = false; s.overvoltFor = 0; }
    }

    // Lean assist on (its peak search starts over) or off.
    function assist(on = !S().lean.assist) {
      Object.assign(S().lean, { assist: on, max: S().egt.slice(), peaked: null });
    }
    // The totalizer's softkeys.
    function totalizer(what) {
      const t = S().tot;
      if (what === 'Rst Fuel') t.rem = FULL_USABLE;
      if (what === 'Dec Fuel') t.rem = Math.max(0, Math.round(t.rem) - 1);
      if (what === 'Inc Fuel') t.rem = Math.min(FULL_USABLE, Math.round(t.rem) + 1);
      if (what === 'Rst Used') t.used = 0;
    }

    // Flip a switch: a key of SWITCHES to true or false, or 'stby' to
    // 'arm', 'off' or 'test'.
    function setSwitch(key, value) {
      const sw = S().sw;
      sw[key] = value;
      if (key === 'alt' && value) sw.bat = true;
      if (key === 'bat' && !value) sw.alt = false;
      if (key === 'stby' && value === 'test') S().testFor = TEST_S;
    }
    // The ignition switch a notch clockwise (+) or back (-).
    function turnMags(steps) {
      const s = S(), i = MAGS.indexOf(s.sw.mags);
      const next = MAGS[Math.max(0, Math.min(MAGS.length - 1, i + Math.sign(steps)))];
      if (next === 'start') s.startFor = TEST_S;
      s.sw.mags = next;
    }
    // Which buses have power: main, essential, avionics 1 and 2.
    function buses() {
      const s = S(), main = s.voltsM > 20.05;
      return { main, ess: s.voltsE > 20.05, avn1: main && s.sw.avn1, avn2: main && s.sw.avn2 };
    }
    // Whether a display has power.
    function powered(display) {
      const b = buses();
      return display === 'pfd' ? b.ess || b.avn1 : b.avn2;
    }
    // The lamp runs off the standby battery itself.
    const testLamp = () => S().sw.stby === 'test' && S().stbyBatt > STBY_OK;

    return { fresh, step, annunciations, fail, FAILURES, mixtureEffect, bestPowerMixture, richness, assist, totalizer,
             setSwitch, buses, powered, testLamp, turnMags, MAGS };
  }

  return { create, FAILURES, FULL_USABLE };
})();
