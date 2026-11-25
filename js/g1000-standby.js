// The standby instruments' faces, drawn live from the mock G1000's
// simulation (js/g1000.js state) onto canvases that js/g1000-panel.js lays
// over the 3D gauges: airspeed, attitude and altimeter. Drawn simply, to
// show what each does, not as replicas.
//
// Airspeed: the needle on the POH's arcs (white 40-85 flaps, green 48-129,
// yellow 129-163, red line 163 KIAS). Attitude: vacuum-driven, so with
// vacuum below the POH's level the red GYRO flag shows and the ball
// drifts off (don't use it). Altimeter: three hands (100, 1,000 and
// 10,000 ft) and its own Kollsman setting, separate from the PFD's.
window.G1000_STANDBY = (function () {
  const S = 512, R = S / 2;
  const rad = (d) => (d * Math.PI) / 180;
  const FONT = '"DejaVu Sans", "Segoe UI", Arial, sans-serif';
  const C = { face: '#111214', white: '#f2f2f2', grey: '#9aa0a8', green: '#2ec45b', yellow: '#ffd21f', red: '#ff3030',
    sky: '#2f7fd6', ground: '#7a5226', orange: '#ff8a1f' };

  function text(ctx, str, x, y, size, color = C.white, align = 'center') {
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }
  function face(ctx) {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = C.face;
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.fill();
  }
  // A tapered needle from the centre, `len` long, at angle a (0 = up,
  // clockwise), with a counterweight tail.
  function needle(ctx, a, len, width, color = C.white, tail = 0.18) {
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(rad(a));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-width / 2, len * tail); ctx.lineTo(-width / 2, -len * 0.75);
    ctx.lineTo(0, -len); ctx.lineTo(width / 2, -len * 0.75); ctx.lineTo(width / 2, len * tail);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const hub = (ctx) => { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(R, R, 22, 0, Math.PI * 2); ctx.fill(); };

  // ---- Airspeed: 30 to 200 KIAS round the dial ----
  const ASI_LO = 30, ASI_HI = 200;
  const asiAngle = (kt) => -160 + ((Math.max(ASI_LO, Math.min(ASI_HI, kt)) - ASI_LO) / (ASI_HI - ASI_LO)) * 320;
  function airspeed(ctx, s, G) {
    face(ctx);
    const sp = G.SPEEDS;
    const arc = (from, to, r, w, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(R, R, r, rad(asiAngle(from) - 90), rad(asiAngle(to) - 90)); ctx.stroke();
    };
    arc(sp.white[0], sp.white[1], R - 52, 16, C.white);
    arc(sp.green[0], sp.green[1], R - 34, 16, C.green);
    arc(sp.yellow[0], sp.yellow[1], R - 34, 16, C.yellow);
    // Red line at Vne.
    ctx.save(); ctx.translate(R, R); ctx.rotate(rad(asiAngle(sp.vne)));
    ctx.fillStyle = C.red; ctx.fillRect(-4, -R + 18, 8, 44); ctx.restore();
    for (let kt = 40; kt <= ASI_HI; kt += 10) {
      ctx.save(); ctx.translate(R, R); ctx.rotate(rad(asiAngle(kt)));
      ctx.fillStyle = C.white; ctx.fillRect(-2, -R + 14, 4, kt % 20 ? 18 : 30);
      ctx.restore();
      if (kt % 20 === 0) {
        const a = rad(asiAngle(kt) - 90);
        text(ctx, String(kt), R + Math.cos(a) * (R - 92), R + Math.sin(a) * (R - 92), 40);
      }
    }
    text(ctx, 'AIRSPEED', R, R + 70, 26, C.grey);
    text(ctx, 'KNOTS', R, R + 100, 26, C.grey);
    needle(ctx, asiAngle(s.ias), R - 40, 18);
    hub(ctx);
  }

  // ---- Attitude: the ball pitches and rolls behind a fixed airplane ----
  // What the gyro shows: the airplane's attitude, or, short of vacuum,
  // a slow drift away from it.
  const gyro = { pitch: 0, roll: 0, t: null };
  function attitude(ctx, s) {
    const lowVac = s.sys.vac < 3.5;
    const dt = gyro.t == null ? 0 : Math.max(0, Math.min(1, s.t - gyro.t));
    gyro.t = s.t;
    if (!lowVac) { gyro.pitch = s.pitch; gyro.roll = s.roll; }
    else { gyro.roll += 1.5 * dt; gyro.pitch -= 0.4 * dt; }
    // Short of vacuum it can't keep up: it settles 25° off, nose low.
    if (lowVac) { gyro.roll = Math.min(gyro.roll, s.roll + 25); gyro.pitch = Math.max(gyro.pitch, s.pitch - 8); }

    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    // The ball: sky over ground, pitch lines, and the roll pointer on its
    // rim, all turning with the bank.
    const ppd = 6.5;
    ctx.translate(R, R);
    ctx.rotate(rad(-gyro.roll));
    const off = gyro.pitch * ppd;
    ctx.fillStyle = C.sky; ctx.fillRect(-S, -S + off, 2 * S, S);
    ctx.fillStyle = C.ground; ctx.fillRect(-S, off, 2 * S, S);
    ctx.strokeStyle = C.white; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-S, off); ctx.lineTo(S, off); ctx.stroke();
    ctx.lineWidth = 4;
    for (const p of [-20, -10, 10, 20]) {
      const y = off - p * ppd, half = Math.abs(p) === 10 ? 60 : 90;
      ctx.beginPath(); ctx.moveTo(-half, y); ctx.lineTo(half, y); ctx.stroke();
    }
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.moveTo(0, -R + 40); ctx.lineTo(-16, -R + 70); ctx.lineTo(16, -R + 70); ctx.fill();
    ctx.restore();
    // The case: the bank scale (10, 20, 30, 60, 90) fixed round the top.
    ctx.save(); ctx.translate(R, R);
    ctx.fillStyle = 'rgba(17, 18, 20, 0.9)';
    ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, Math.PI * 2); ctx.arc(0, 0, R - 38, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.fillStyle = C.white;
    for (const a of [-90, -60, -30, -20, -10, 10, 20, 30, 60, 90]) {
      ctx.save(); ctx.rotate(rad(a));
      ctx.fillRect(-3, -R + 4, 6, Math.abs(a) === 30 || Math.abs(a) >= 60 ? 34 : 22);
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(0, -R + 38); ctx.lineTo(-14, -R + 6); ctx.lineTo(14, -R + 6); ctx.fill();
    // The miniature airplane, fixed.
    ctx.fillStyle = C.orange;
    ctx.fillRect(-130, -5, 90, 10); ctx.fillRect(40, -5, 90, 10);
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (lowVac) {
      ctx.fillStyle = C.red; ctx.fillRect(R + 60, R + 120, 120, 50);
      text(ctx, 'GYRO', R + 120, R + 146, 30, C.white);
    }
  }

  // ---- Altimeter: three hands and the Kollsman window ----
  function altimeter(ctx, s, G) {
    face(ctx);
    for (let k = 0; k < 50; k++) {
      ctx.save(); ctx.translate(R, R); ctx.rotate(rad(k * 7.2));
      ctx.fillStyle = C.white; ctx.fillRect(-2, -R + 14, 4, k % 5 ? 16 : 30);
      ctx.restore();
    }
    for (let n = 0; n < 10; n++) {
      const a = rad(n * 36 - 90);
      text(ctx, String(n), R + Math.cos(a) * (R - 78), R + Math.sin(a) * (R - 78), 50);
    }
    // The Kollsman window at three o'clock: the standby's own setting.
    ctx.fillStyle = '#000'; ctx.fillRect(R + 80, R - 24, 120, 48);
    ctx.strokeStyle = C.grey; ctx.lineWidth = 3; ctx.strokeRect(R + 80, R - 24, 120, 48);
    text(ctx, s.stbyBaro.toFixed(2), R + 140, R + 1, 32);
    text(ctx, 'ALT', R, R - 120, 26, C.grey);
    const alt = G.standbyAlt();
    // 10,000 ft: a thin hand with a triangle; 1,000: short and wide; 100: long.
    needle(ctx, (alt / 100000) * 360, R - 30, 6, C.white, 0.05);
    needle(ctx, (alt / 10000) * 360, R - 130, 26);
    needle(ctx, (alt / 1000) * 360, R - 40, 14);
    hub(ctx);
  }

  // ---- Magnetic compass: the card seen through its window ----
  // A pendulous card floating in fluid: it lies square to the apparent
  // gravity (gravity less the airplane's acceleration) and points along
  // the part of the earth's field in that plane. The field dips steeply
  // in Washington, so tilting the card swings it:
  // - turning (the card banks with the airplane): it lags turning through
  //   north and leads through south, true on east and west (UNOS);
  // - speeding up on east or west it shows a turn north, slowing a turn
  //   south (ANDS); no error on north or south;
  // - the fluid damps it, but it overshoots and swings before settling.
  // Read from behind the card, the headings run the "wrong" way: those to
  // the right of the lubber line are lower. No deviation (the card under
  // it lists the corrections).
  const DIP = 69;                                // ° (Washington, about 47.8 N)
  const G_MS2 = 9.81, KT = 0.5144;
  function compassTarget(hdgTrue, magVar, rollDeg, accelMs2) {
    const dip = rad(DIP), v = rad(magVar), psi = rad(hdgTrue);
    const B = [Math.cos(dip) * Math.cos(v), Math.cos(dip) * Math.sin(v), Math.sin(dip)];   // north, east, down
    const f = [Math.cos(psi), Math.sin(psi), 0], r = [-Math.sin(psi), Math.cos(psi), 0];
    const lat = G_MS2 * Math.tan(rad(rollDeg));   // a coordinated turn's sideways acceleration
    const d = [0, 1, 2].map((k) => (k === 2 ? G_MS2 : 0) - accelMs2 * f[k] - lat * r[k]);
    const n = Math.hypot(...d);
    d.forEach((_, k) => { d[k] /= n; });
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const flat = (a) => { const t = dot(a, d); return a.map((x, k) => x - t * d[k]); };
    const N = flat(B), F = flat(f);
    const cross = [N[1] * F[2] - N[2] * F[1], N[2] * F[0] - N[0] * F[2], N[0] * F[1] - N[1] * F[0]];
    return (Math.atan2(dot(cross, d), dot(N, F)) * 180 / Math.PI + 360) % 360;
  }

  const CW = 512, CH = 248;                        // the window: 31 x 15 mm
  const CARD_R = 0.021, WIN_HALF = 0.0155;         // m: the card's radius, half the window
  const card = { hdg: null, rate: 0, t: null, ias: null, accel: 0 };
  const wrap180 = (a) => ((a + 540) % 360) - 180;
  function compass(ctx, s) {
    const dt = card.t == null ? 0 : Math.max(0, Math.min(0.5, s.t - card.t));
    card.t = s.t;
    if (card.ias != null && dt > 0) {
      const a = ((s.ias - card.ias) * KT) / dt;
      card.accel += (a - card.accel) * Math.min(1, dt * 3);
    }
    card.ias = s.ias;
    const target = compassTarget(s.hdg, s.magVar, s.roll, card.accel);
    if (card.hdg == null) card.hdg = target;
    // Damped swing toward the target, in small steps.
    const W = 2.2, Z = 0.35;
    for (let left = dt; left > 1e-6; left -= 0.02) {
      const h = Math.min(0.02, left);
      card.rate += (W * W * wrap180(target - card.hdg) - 2 * Z * W * card.rate) * h;
      card.hdg = (card.hdg + card.rate * h + 360) % 360;
    }

    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = '#0d0d0e';
    ctx.fillRect(0, 0, CW, CH);
    // The card curves away: a mark θ round from the lubber line is
    // R sin θ across, squeezed by cos θ.
    const px = CW / 2 / WIN_HALF, maxT = Math.asin(WIN_HALF / CARD_R) * 180 / Math.PI + 4;
    const top = 26;
    for (let m = 0; m < 360; m += 5) {
      const th = -wrap180(m - card.hdg);          // higher headings to the left
      if (Math.abs(th) > maxT) continue;
      const x = CW / 2 + Math.sin(rad(th)) * CARD_R * px, sq = Math.cos(rad(th));
      const long = m % 10 === 0;
      ctx.fillStyle = C.white;
      ctx.fillRect(x - 2.5 * sq, top, 5 * sq, long ? 58 : 34);
      if (m % 30 === 0) {
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[m] || String(m / 10);
        ctx.save();
        ctx.translate(x, top + 120);
        ctx.scale(sq, 1);
        text(ctx, label, 0, 0, m % 90 ? 74 : 88);
        ctx.restore();
      }
    }
    // The lubber line, on the glass.
    ctx.fillStyle = C.orange;
    ctx.fillRect(CW / 2 - 3, 0, 6, CH);
    // The bowl darkens toward the edges.
    const shade = ctx.createLinearGradient(0, 0, CW, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.75)'); shade.addColorStop(0.18, 'rgba(0,0,0,0)');
    shade.addColorStop(0.82, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, CW, CH);
  }

  return { SIZE: S, draw: { standby_airspeed_indicator: airspeed, standby_attitude_indicator: attitude, standby_altimeter: altimeter,
                            magnetic_compass: compass },
           compass: { target: compassTarget, card, WIDTH: CW, HEIGHT: CH } };
})();
