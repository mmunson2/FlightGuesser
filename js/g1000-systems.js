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
// from the exhaust, a pitch trim fault. Both tanks dry stops the engine.
window.G1000_SYSTEMS = (function () {
  const FAILURES = ['alternator', 'overvolt', 'oil', 'vacuum', 'leakL', 'co', 'trim'];
  // Main battery: usable charge, amp-hours; the load with the alternator
  // off, amps. About 35 minutes to the 20 V where the standby battery
  // takes the essential bus (made up; the POH says only "a short time").
  const BATT_AH = 9, LOAD_A = 15;
  // The ACU trips the alternator this long after an overvoltage (s).
  const ACU_TRIP_S = 3;

  function create({ state }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const S = () => state.sys;
    const fresh = () => ({
      running: true, rpm: 2140, oilPsi: 60, oilF: 190, vac: 5.0,
      voltsM: 28.0, voltsE: 28.0, ampsM: 1.0, ampsS: 0.2, batt: BATT_AH, stbyBatt: 1, acuTripped: false,
      coPpm: 0, overvoltFor: 0,
      // How long each delayed annunciation's condition has held (s).
      held: { fuelL: 0, fuelR: 0, stby: 0 },
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

    function step(dt, gph) {
      const s = S(), f = s.failed;
      burn(dt, gph);
      // Both tanks dry: the engine stops.
      s.running = state.fuel > 0.01;
      s.rpm = s.running ? 700 + 1800 * state.power : 0;
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
      const alt = s.running && !f.alternator && !s.acuTripped;
      // The main battery's voltage falls from 24 V as it empties.
      const battV = 20 + (4 * s.batt) / BATT_AH;
      if (alt && f.overvolt) { s.voltsM = 32.6; s.ampsM = 25; }
      else if (alt && s.rpm >= 1000) { s.voltsM = 28.0; s.ampsM = s.batt < BATT_AH ? 8 : 1.0; s.batt = Math.min(BATT_AH, s.batt + (8 / 3600) * dt); }
      else if (alt) { s.voltsM = 24.2; s.ampsM = -3; s.batt = Math.max(0, s.batt - (3 / 3600) * dt); }
      else { s.ampsM = -LOAD_A; s.batt = Math.max(0, s.batt - (LOAD_A / 3600) * dt); s.voltsM = battV; }
      // Below 20 V on the main bus, the standby battery (ARM) feeds the
      // essential bus: it discharges, and the essential bus is its volts.
      if (s.voltsM <= 20.05) {
        s.ampsS = -3.5;
        s.stbyBatt = Math.max(0, s.stbyBatt - dt / 1800);
        s.voltsE = 22 + 2 * s.stbyBatt;
      } else {
        s.ampsS = alt && s.rpm >= 1000 ? 0.2 : 0;
        s.voltsE = s.voltsM;
      }
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

    return { fresh, step, annunciations, fail, FAILURES };
  }

  return { create, FAILURES };
})();
