// Draws the mock G1000's PFD and MFD (js/g1000.js state) onto canvases,
// which js/g1000-panel.js puts on the 3D screens. The layout follows the
// real displays' arrangement (radios on top, tapes either side of the
// attitude, HSI below, softkey labels along the bottom) but is drawn
// simply: a study aid, not a replica.
window.G1000_DISPLAY = (function () {
  // The model's screens are 1.2:1 (a 4:3 display, squashed 0.9 tall).
  const W = 1024, H = 852;
  const C = {
    cyan: '#21d2ff', magenta: '#ff40ff', green: '#2ee05b', white: '#f2f2f2', grey: '#8a8f98',
    yellow: '#ffd21f', red: '#ff3030', black: '#000', panel: '#1c1f24', box: '#0b0c0e',
    sky: '#1f64c8', ground: '#6e4b22',
  };
  const FONT = '"DejaVu Sans", "Segoe UI", Arial, sans-serif';
  const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px ${FONT}`;
  const rad = (d) => (d * Math.PI) / 180;
  const wrap360 = (a) => ((a % 360) + 360) % 360;
  const pad3 = (n) => String(Math.round(wrap360(n)) || 360).padStart(3, '0');
  // Blinks at 2 Hz while `until` is ahead.
  const blinkOn = (s, until) => !(s.t < until && Math.floor(s.t * 4) % 2 === 0);

  function text(ctx, str, x, y, { size = 26, color = C.white, align = 'left', base = 'middle', bold = true } = {}) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillText(str, x, y);
  }
  function box(ctx, x, y, w, h, { fill = C.box, stroke = C.grey, lw = 2 } = {}) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); }
  }

  // ---- Shared: the radio bars and the softkey labels ----
  function radios(ctx, s, G) {
    box(ctx, 0, 0, W, 70, { fill: C.panel, stroke: null });
    const navLabel = (i) => {
      const st = G.NAVAIDS.find((n) => Math.abs(n.freq - s.nav[i].act) < 0.001);
      return st ? st.id : '';
    };
    // NAV, top left: standby (outside, by the NAV knob) then active. The
    // active frequency is green when it is the CDI source.
    for (let i = 0; i < 2; i++) {
      const y = 20 + i * 32, n = s.nav[i];
      text(ctx, 'NAV' + (i + 1), 8, y, { size: 22 });
      const vol = s.vol.show && s.vol.show.kind === 'nav' && s.vol.show.i === i && s.t < s.vol.show.until;
      const tuning = s.navTune === i;
      if (tuning) box(ctx, 74, y - 14, 98, 28, { fill: 'transparent', stroke: C.cyan });
      text(ctx, vol ? `${s.vol.nav[i]}%` : n.stby.toFixed(2), 80, y, { size: 24, color: tuning ? C.cyan : C.white });
      text(ctx, '↔', 182, y, { size: 22, color: tuning ? C.cyan : C.grey });
      const src = s.cdi === 'VOR' + (i + 1);
      text(ctx, n.act.toFixed(2), 210, y, { size: 24, color: src ? C.green : C.white });
      text(ctx, navLabel(i), 300, y, { size: 18, color: C.grey });
    }
    // COM, top right: active (inside) then standby (outside, by the knob).
    for (let i = 0; i < 2; i++) {
      const y = 20 + i * 32, c = s.com[i];
      const tuning = s.comTune === i;
      text(ctx, c.act.toFixed(3), 660, y, { size: 24, color: tuning ? C.green : C.white });
      text(ctx, '↔', 778, y, { size: 22, color: tuning ? C.cyan : C.grey });
      const vol = s.vol.show && s.vol.show.kind === 'com' && s.vol.show.i === i && s.t < s.vol.show.until;
      if (tuning) box(ctx, 802, y - 14, 112, 28, { fill: 'transparent', stroke: C.cyan });
      text(ctx, vol ? `${s.vol.com[i]}%` : c.stby.toFixed(3), 808, y, { size: 24, color: tuning ? C.cyan : C.white });
      text(ctx, 'COM' + (i + 1), 1016, y, { size: 22, align: 'right' });
    }
  }

  // The PFD's navigation status, top centre between the radios: the
  // active leg, then distance and desired track to its waypoint.
  function navStatus(ctx, s, G) {
    const l = G.fms.leg();
    if (!l) return;
    const nav = G.navSolution('GPS');
    const from = l.direct ? 'D→' : l.fromId + ' →';
    text(ctx, `${from} ${l.to.id}`, 495, 20, { size: 21, align: 'center', color: C.magenta });
    text(ctx, `DIS ${nav.dist.toFixed(1)}NM  DTK ${pad3(nav.course)}°`, 495, 52, { size: 18, align: 'center' });
  }

  // ---- FMS windows (js/g1000-fms.js): Direct-To and the flight plan ----
  // An identifier being typed: the characters so far, the cursor's
  // character in a cyan box, the rest completed from the database.
  function identField(ctx, e, x, y, G, active, match = G.fms.match) {
    const m = match(e.ident);
    const shown = (m ? m.id : e.ident).padEnd(5, '_').slice(0, 6);
    ctx.font = font(26);
    const cw = 22;
    for (let i = 0; i < shown.length; i++) {
      const cursor = active && i === e.pos;
      if (cursor) box(ctx, x + i * cw - 2, y - 16, cw, 32, { fill: C.cyan, stroke: null });
      // Typed characters white; the completion cyan.
      const color = cursor ? C.black : i < e.ident.length ? C.white : C.cyan;
      text(ctx, shown[i], x + i * cw + cw / 2 - 2, y + 1, { size: 26, align: 'center', color });
    }
    return m;
  }

  function dtoWindow(ctx, s, G, win, x, y, w, h) {
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.95)', stroke: C.white });
    text(ctx, 'DIRECT TO', x + w / 2, y + 22, { size: 22, align: 'center', color: C.cyan });
    const m = identField(ctx, win, x + 20, y + 66, G, win.stage === 'ident');
    text(ctx, m ? m.name : 'No match', x + 20, y + 104, { size: 18, color: m ? C.white : C.yellow });
    if (m) {
      const { brg, dist } = G.bearingDist(s, m);
      text(ctx, `BRG ${pad3(brg)}°   DIS ${dist.toFixed(1)}NM`, x + 20, y + 138, { size: 20 });
    }
    const on = win.stage === 'activate';
    box(ctx, x + w / 2 - 80, y + 166, 160, 36, { fill: on ? C.cyan : C.black, stroke: C.cyan });
    text(ctx, 'ACTIVATE?', x + w / 2, y + 185, { size: 20, align: 'center', color: on ? C.black : C.cyan });
  }

  function fplWindow(ctx, s, G, win, x, y, w, h) {
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.95)', stroke: C.white });
    text(ctx, 'ACTIVE FLIGHT PLAN', x + w / 2, y + 20, { size: 20, align: 'center', color: C.cyan });
    const cols = [x + 40, x + w * 0.45, x + w * 0.7, x + w - 12];
    text(ctx, 'DTK', cols[1], y + 48, { size: 15, align: 'right', color: C.grey });
    text(ctx, 'DIS', cols[2], y + 48, { size: 15, align: 'right', color: C.grey });
    text(ctx, 'CUM', cols[3], y + 48, { size: 15, align: 'right', color: C.grey });
    const rows = G.fms.rows();
    const rowH = 30, top = y + 76;
    const maxRows = Math.floor((h - 90 - (win.prompt ? 40 : 0)) / rowH);
    // Keep the cursor in view.
    const first = Math.max(0, Math.min((win.cursor ?? 0) - maxRows + 2, rows.length + 1 - maxRows));
    const all = [...rows, null];
    for (let k = 0; k < maxRows && first + k < all.length; k++) {
      const i = first + k, r = all[i], ry = top + k * rowH;
      const sel = win.cursor === i;
      if (sel && !win.entry) box(ctx, x + 34, ry - 14, 84, 28, { fill: C.cyan, stroke: null });
      if (sel && win.entry) {
        // The new waypoint goes in above this row.
        identField(ctx, win.entry, x + 34, ry, G, true);
        continue;
      }
      if (!r) { text(ctx, '_____', cols[0], ry, { size: 22, color: sel ? C.black : C.cyan }); continue; }
      const color = sel ? C.black : r.active ? C.magenta : C.white;
      if (r.active) text(ctx, s.fms.fpl.dto ? 'D→' : '➔', x + 6, ry, { size: 15, color: C.magenta });
      text(ctx, r.id, cols[0], ry, { size: 22, color });
      if (r.dtk != null) {
        const c = r.active ? C.magenta : C.white;
        text(ctx, pad3(r.dtk) + '°', cols[1], ry, { size: 20, align: 'right', color: c });
        text(ctx, r.dis.toFixed(1), cols[2], ry, { size: 20, align: 'right', color: c });
        text(ctx, r.cum.toFixed(0), cols[3], ry, { size: 20, align: 'right', color: c });
      }
    }
    if (win.prompt) {
      box(ctx, x + 10, y + h - 46, w - 20, 36, { fill: C.cyan, stroke: null });
      text(ctx, win.prompt.text + '  ENT / CLR', x + w / 2, y + h - 27, { size: 18, align: 'center', color: C.black });
    } else if (win.cursor == null) {
      text(ctx, 'Push FMS for the cursor', x + w / 2, y + h - 20, { size: 15, align: 'center', color: C.grey });
    }
  }

  function fmsWindow(ctx, s, G, display) {
    const win = s.fms.win[display];
    if (!win) return;
    // PFD: the lower right corner, beside the HSI and under the CRS box.
    // MFD: the map's right half.
    // (Above the MFD's page group indicator.)
    const [x, y, w, h] = display === 'pfd' ? [660, 548, 358, 228] : [600, 106, 418, H - 34 - 160];
    if (win.type === 'dto') dtoWindow(ctx, s, G, win, x, y, w, Math.min(h, 228));
    else if (win.type === 'nrst') pfdNearest(ctx, s, G, win, x, y, w, h);
    else fplWindow(ctx, s, G, win, x, y, w, h);
  }

  // The PFD's Nearest Airports window: identifier, bearing, distance.
  function pfdNearest(ctx, s, G, win, x, y, w, h) {
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.95)', stroke: C.white });
    text(ctx, 'NEAREST AIRPORTS', x + w / 2, y + 20, { size: 20, align: 'center', color: C.cyan });
    const list = G.pages.nearestAirports();
    const rowH = 30, n = Math.floor((h - 70) / rowH);
    const first = Math.max(0, Math.min((win.cursor ?? 0) - n + 1, list.length - n));
    list.slice(first, first + n).forEach((r, k) => {
      const i = first + k, ry = y + 52 + k * rowH, sel = win.cursor === i;
      if (sel) box(ctx, x + 10, ry - 14, 76, 28, { fill: C.cyan, stroke: null });
      text(ctx, r.w.id, x + 14, ry, { size: 21, color: sel ? C.black : C.white });
      text(ctx, pad3(r.brg) + '°', x + 170, ry, { size: 20, align: 'right' });
      text(ctx, r.dist.toFixed(1) + 'NM', x + 270, ry, { size: 20, align: 'right' });
      text(ctx, r.w.towered ? 'TWR' : '', x + w - 12, ry, { size: 15, align: 'right', color: C.grey });
    });
    text(ctx, win.cursor == null ? 'Push FMS for the cursor' : 'D→ goes direct to the selection',
      x + w / 2, y + h - 16, { size: 15, align: 'center', color: C.grey });
  }

  // ---- MFD pages (js/g1000-pages.js) ----
  // The content area right of the EIS and below the nav data bar.
  const PAGE = { x: 200, y: 106, w: W - 200, h: H - 34 - 106 };
  const latLon = (lat, lon) => {
    const f = (v, pos, neg, dw) => {
      const a = Math.abs(v), d = Math.floor(a);
      return `${v >= 0 ? pos : neg}${String(d).padStart(dw, '0')}°${((a - d) * 60).toFixed(2).padStart(5, '0')}'`;
    };
    return `${f(lat, 'N', 'S', 2)}  ${f(lon, 'E', 'W', 3)}`;
  };
  // A label and a value in two columns, from the top of the page down.
  function rowsOf(ctx, pairs, x, y, gap = 40) {
    pairs.forEach(([k, v, color = C.white], i) => {
      text(ctx, k, x, y + i * gap, { size: 18, color: C.grey });
      text(ctx, v, x + 230, y + i * gap, { size: 22, color });
    });
  }
  function pageBackground(ctx) {
    box(ctx, PAGE.x, PAGE.y, PAGE.w, PAGE.h, { fill: '#05070a', stroke: null });
  }
  function identLine(ctx, s, G, page, ident, x, y) {
    const p = s.mfd;
    if (p.cursor === 'ident') return identField(ctx, p.entry, x, y, G, true, G.pages.matchers[page]);
    text(ctx, ident, x, y, { size: 28 });
    return null;
  }
  const hint = (ctx, str) => text(ctx, str, PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h - 70,
    { size: 15, align: 'center', color: C.grey });

  // Runway edge lights as the Chart Supplement writes them.
  const LIGHTS = { HIGH: 'HIRL', MED: 'MIRL', LOW: 'LIRL', NSTD: 'NSTD LGTS' };

  // Airport Information (data/wa-nav.js, FAA NASR): details on the left,
  // frequencies on the right, runways along the bottom.
  function airportInfo(ctx, s, G) {
    pageBackground(ctx);
    const a = G.fms.byId[s.mfd.wpt.airport];
    const x = PAGE.x + 30, y = PAGE.y + 64;
    identLine(ctx, s, G, 'WPT:0', a.id, x, y);
    if (a.lid !== a.id) text(ctx, `(${a.lid})`, x + 110, y + 2, { size: 18, color: C.grey });
    const { brg, dist } = G.bearingDist(s, a);
    const pairs = [
      ['NAME', a.name], ['CITY', a.city], ['ELEV', `${a.elev}FT`],
      // NASR gives the pattern altitude above the field.
      ['TPA', a.tpa != null ? `${a.elev + a.tpa}FT MSL (${a.tpa} AGL)` : 'not published'],
      ['TYPE', a.towered ? 'Towered' : 'Non-towered'], ['FUEL', a.fuel || 'none'],
      ['POSITION', latLon(a.lat, a.lon)], ['FROM P.POS', `${pad3(brg)}°  ${dist.toFixed(1)}NM`],
    ];
    pairs.forEach(([k, v], i) => {
      text(ctx, k, x, y + 50 + i * 33, { size: 16, color: C.grey });
      text(ctx, v, x + 125, y + 50 + i * 33, { size: 19 });
    });

    // Frequencies: kind, MHz, and which runway a tower frequency serves.
    const fx = PAGE.x + 520;
    text(ctx, 'FREQUENCIES', fx, y, { size: 16, color: C.cyan });
    a.freqs.slice(0, 9).forEach((f, i) => {
      const fy = y + 32 + i * 30;
      text(ctx, f.kind, fx, fy, { size: 15, color: C.grey });
      text(ctx, f.freq.toFixed(3), fx + 118, fy, { size: 19, color: C.green });
      if (f.note) text(ctx, f.note.replace(/^RWY /, ''), fx + 205, fy, { size: 14, color: C.grey });
    });
    if (!a.freqs.length) text(ctx, 'none listed', fx, y + 32, { size: 16, color: C.grey });

    // Runways, longest first: length × width, surface, lights, and the
    // ends with right-hand traffic.
    const ry = y + 50 + pairs.length * 33 + 10;
    text(ctx, 'RUNWAYS', x, ry, { size: 16, color: C.cyan });
    a.runways.slice(0, 4).forEach((r, i) => {
      const yy = ry + 30 + i * 30;
      const rp = r.ends.filter((e) => e.rightTraffic).map((e) => e.id);
      text(ctx, r.id, x, yy, { size: 20 });
      text(ctx, `${r.len} × ${r.wid}FT  ${r.surface}  ${LIGHTS[r.lights] ?? ''}`, x + 125, yy, { size: 18 });
      if (rp.length) text(ctx, `RP ${rp.join(', ')}`, x + 520, yy, { size: 17, color: C.yellow });
    });
    hint(ctx, `${G.WA_SOURCE}: Washington public-use airports. Not for navigation.`);
  }

  function vorInfo(ctx, s, G) {
    pageBackground(ctx);
    const v = G.fms.byId[s.mfd.wpt.vor];
    const x = PAGE.x + 30, y = PAGE.y + 70;
    identLine(ctx, s, G, 'WPT:3', v.id, x, y);
    const { brg, dist } = G.bearingDist(s, v);
    rowsOf(ctx, [
      ['NAME', v.name], ['FREQUENCY', v.freq.toFixed(2), C.green], ['POSITION', latLon(v.lat, v.lon)],
      ['FROM P.POS', `${pad3(brg)}°  ${dist.toFixed(1)}NM`],
      // The radial the airplane is on: the bearing from the station.
      ['RADIAL', `${pad3(brg + 180)}° FROM`],
    ], x, y + 60);
    hint(ctx, 'Push FMS to pick another station. Nearest VOR (NRST) loads frequencies.');
  }

  function tripPlanning(ctx, s, G) {
    pageBackground(ctx);
    const x = PAGE.x + 30, y = PAGE.y + 70;
    text(ctx, 'P.POS  →', x, y, { size: 24 });
    identLine(ctx, s, G, 'AUX:0', s.mfd.tripTo, x + 130, y);
    const t = G.pages.trip();
    const hhmm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
    const eta = new Date(s.t * 1000 + t.hours * 3600000 + Date.UTC(2026, 0, 1, 17, 0, 0));
    rowsOf(ctx, [
      ['DTK', pad3(t.dtk) + '°', C.magenta], ['DIS', t.dist.toFixed(1) + 'NM'], ['ETE', hhmm(t.hours)],
      ['ETA', `${String(eta.getUTCHours()).padStart(2, '0')}:${String(eta.getUTCMinutes()).padStart(2, '0')}`],
      ['FUEL FLOW', t.ff.toFixed(1) + ' GPH'], ['FUEL REQ', t.required.toFixed(1) + ' GAL'],
      ['FUEL ON BOARD', t.onboard.toFixed(1) + ' GAL'],
      ['FUEL AT ARRIVAL', t.after.toFixed(1) + ' GAL', t.after < 8 ? C.yellow : C.white],
    ], x, y + 55, 38);
    hint(ctx, 'At the present ground speed and fuel flow (mock numbers), no wind. Push FMS to pick a waypoint.');
  }

  function utility(ctx, s, G) {
    pageBackground(ctx);
    const st = s.mfd.stats, hours = Math.max(s.t - st.t0, 1) / 3600;
    const hms = (sec) => [sec / 3600, (sec / 60) % 60, sec % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
    rowsOf(ctx, [
      ['FLIGHT TIMER', hms(s.t - st.t0)], ['ODOMETER', st.odo.toFixed(1) + 'NM'],
      ['AVG GS', Math.round(st.odo / hours) + 'KT'], ['MAX GS', Math.round(st.maxGs) + 'KT'],
    ], PAGE.x + 30, PAGE.y + 70);
    hint(ctx, 'Since Reset flight. The generic timer and minimums are not in the mock.');
  }

  // Nearest Airports / VOR: a list with the cursor.
  function nearestList(ctx, s, G, vor) {
    pageBackground(ctx);
    const list = vor ? G.pages.nearestVors() : G.pages.nearestAirports();
    const x = PAGE.x + 30, top = PAGE.y + 60, rowH = 40, cur = s.mfd.cursor;
    text(ctx, 'BRG', x + 220, top - 4, { size: 15, align: 'right', color: C.grey });
    text(ctx, 'DIS', x + 340, top - 4, { size: 15, align: 'right', color: C.grey });
    text(ctx, vor ? 'FREQ' : 'LONGEST RWY', x + 380, top - 4, { size: 15, color: C.grey });
    list.slice(0, 15).forEach((r, i) => {
      const ry = top + 34 + i * rowH;
      if (ry > PAGE.y + PAGE.h - 90) return;
      const sel = cur === i;
      if (sel) box(ctx, x - 6, ry - 15, 90, 30, { fill: C.cyan, stroke: null });
      text(ctx, r.w.id, x, ry, { size: 22, color: sel ? C.black : C.white });
      text(ctx, pad3(r.brg) + '°', x + 220, ry, { size: 21, align: 'right' });
      text(ctx, r.dist.toFixed(1) + 'NM', x + 340, ry, { size: 21, align: 'right' });
      if (vor) {
        text(ctx, r.w.freq.toFixed(2), x + 380, ry, { size: 21, color: C.green });
        text(ctx, r.w.name, x + 480, ry, { size: 16, color: C.grey });
      } else {
        // Longest runway and its surface, then the name.
        const rw = r.w.runways[0];
        text(ctx, rw ? `${rw.len}FT ${rw.surface}` : '', x + 380, ry, { size: 17 });
        text(ctx, r.w.name.slice(0, 24), x + 560, ry, { size: 15, color: C.grey });
      }
    });
    hint(ctx, cur == null ? 'Push FMS for the cursor'
      : vor ? 'ENT: frequency to NAV standby · D→: direct to it' : 'ENT: airport information · D→: direct to it');
  }

  function placeholder(ctx, s, G) {
    pageBackground(ctx);
    text(ctx, G.pages.pageName(), PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h / 2 - 20, { size: 26, align: 'center' });
    text(ctx, 'Not in the mock yet', PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h / 2 + 20, { size: 20, align: 'center', color: C.grey });
  }

  // Bottom right: the page groups, the shown one cyan, with a box per page
  // in it (the shown page filled).
  function pageGroups(ctx, s, G) {
    const p = s.mfd, groups = G.pages.GROUPS;
    const x0 = 560, y = H - 34 - 44, w = W - x0 - 6;
    box(ctx, x0, y - 4, w, 46, { fill: C.black, stroke: C.grey });
    const cell = w / groups.length;
    groups.forEach((g, i) => {
      const cx = x0 + cell * i + cell / 2, on = i === p.group;
      text(ctx, g.id, cx, y + 10, { size: 17, align: 'center', color: on ? C.cyan : C.grey });
      if (!on) return;
      const n = g.pages.length, bw = 12, gap = 5, bx = x0 + w / 2 - (n * (bw + gap)) / 2;
      for (let k = 0; k < n; k++) {
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + k * (bw + gap), y + 24, bw, 10);
        if (k === p.last[p.group]) { ctx.fillStyle = C.cyan; ctx.fillRect(bx + k * (bw + gap), y + 24, bw, 10); }
      }
    });
  }

  function mfdPage(ctx, s, G) {
    const key = G.pages.pageKey();
    const draw = {
      'MAP:0': navMap, 'FPL:0': navMap, 'WPT:0': airportInfo, 'WPT:3': vorInfo, 'AUX:0': tripPlanning,
      'AUX:1': utility, 'NRST:0': (c, st, g) => nearestList(c, st, g, false), 'NRST:3': (c, st, g) => nearestList(c, st, g, true),
    }[key] ?? placeholder;
    draw(ctx, s, G);
    const g = G.pages.GROUPS[s.mfd.group];
    // The title on a dark strip, over anything the map drew there.
    box(ctx, PAGE.x + PAGE.w / 2 - 230, PAGE.y + 2, 460, 32, { fill: C.black, stroke: null });
    text(ctx, `${g.id} - ${G.pages.pageName().toUpperCase()}`, PAGE.x + PAGE.w / 2, PAGE.y + 18,
      { size: 18, align: 'center', color: C.cyan });
  }

  function softkeys(ctx, s, G, display) {
    const menu = G.menu(display);
    const labels = G.MENUS[menu], live = G.LIVE[menu];
    const w = W / 12, y = H - 34;
    box(ctx, 0, y, W, 34, { fill: C.black, stroke: null });
    labels.forEach((label, i) => {
      if (!label) return;
      ctx.strokeStyle = '#3b3f46';
      ctx.lineWidth = 2;
      ctx.strokeRect(i * w + 3, y + 3, w - 6, 28);
      // The selected option of a menu shows lit (cyan).
      const on = (menu === 'xpdr' && ({ Standby: 'STBY', On: 'ON', Alt: 'ALT' })[label] === s.xpdr.mode)
        || (menu === 'engine' && label === s.eisPage);
      if (on) box(ctx, i * w + 3, y + 3, w - 6, 28, { fill: C.cyan, stroke: null });
      text(ctx, label, i * w + w / 2, y + 17, { size: label.length > 7 ? 15 : 18, align: 'center',
        color: on ? C.black : live.includes(i) ? C.white : '#5b6068' });
    });
  }

  function noteBar(ctx, s) {
    if (!s.note || s.t > s.note.until) return;
    ctx.font = font(20);
    const w = ctx.measureText(s.note.text).width + 30;
    box(ctx, (W - w) / 2, H - 80, w, 36, { fill: '#2a2d33', stroke: C.yellow });
    text(ctx, s.note.text, W / 2, H - 62, { size: 20, align: 'center', color: C.yellow });
  }

  // ---- PFD ----
  const ATT = { x: 512, y: 300, ppd: 9 };  // centre, pixels per degree of pitch

  function attitude(ctx, s) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 70, W, H - 104);
    ctx.clip();
    ctx.translate(ATT.x, ATT.y);
    ctx.rotate(rad(-s.roll));
    const off = s.pitch * ATT.ppd;
    ctx.fillStyle = C.sky;
    ctx.fillRect(-1500, -1500 + off, 3000, 1500);
    ctx.fillStyle = C.ground;
    ctx.fillRect(-1500, off, 3000, 1500);
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-1500, off); ctx.lineTo(1500, off); ctx.stroke();
    // Pitch ladder, clipped to a window round the centre.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-150, -170, 300, 300);
    ctx.clip();
    for (let p = -30; p <= 30; p += 2.5) {
      if (p === 0) continue;
      const y = off - p * ATT.ppd;
      const half = p % 10 === 0 ? 70 : p % 5 === 0 ? 38 : 16;
      ctx.beginPath(); ctx.moveTo(-half, y); ctx.lineTo(half, y); ctx.stroke();
      if (p % 10 === 0) {
        text(ctx, String(Math.abs(p)), -half - 8, y, { size: 18, align: 'right' });
        text(ctx, String(Math.abs(p)), half + 8, y, { size: 18 });
      }
    }
    ctx.restore();
    ctx.restore();

    // Roll scale: fixed arc with ticks, the pointer turns with the bank.
    ctx.save();
    ctx.translate(ATT.x, ATT.y);
    const R = 190;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R, rad(-150), rad(-30)); ctx.stroke();
    for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
      const len = Math.abs(a) === 30 || Math.abs(a) === 60 ? 22 : 12;
      ctx.save(); ctx.rotate(rad(a));
      ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(0, -R - len); ctx.stroke();
      ctx.restore();
    }
    // Zero: a fixed white triangle above the arc.
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(-12, -R - 20); ctx.lineTo(12, -R - 20); ctx.fill();
    // Roll pointer and the slip/skid bar under it (centred: no slip here).
    ctx.rotate(rad(-s.roll));
    ctx.beginPath(); ctx.moveTo(0, -R + 2); ctx.lineTo(-12, -R + 22); ctx.lineTo(12, -R + 22); ctx.fill();
    ctx.fillRect(-14, -R + 26, 28, 6);
    ctx.restore();
  }

  // The yellow airplane symbol, and the magenta single-cue command bars.
  function aircraftSymbol(ctx, s) {
    const a = s.afcs;
    ctx.save();
    ctx.translate(ATT.x, ATT.y);
    if (a.fd && a.cmd) {
      ctx.save();
      ctx.translate(0, -(a.cmd.pitch - s.pitch) * ATT.ppd);
      ctx.rotate(rad(-(a.cmd.roll - s.roll)));
      ctx.fillStyle = C.magenta;
      ctx.strokeStyle = C.black;
      ctx.lineWidth = 1.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(side * 130, 42); ctx.lineTo(side * 130, 30); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = C.yellow;
    ctx.strokeStyle = C.black;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(side * 110, 40); ctx.lineTo(side * 60, 40); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // Values that need the last frame's (speed trend).
  const last = { pfd: null };

  function airspeedTape(ctx, s, G) {
    const x = 150, w = 100, top = 120, bot = 460, cy = ATT.y, ppk = 4.2;
    box(ctx, x, top, w, bot - top, { fill: 'rgba(20, 22, 26, 0.55)', stroke: null });
    ctx.save();
    ctx.beginPath(); ctx.rect(x, top, w, bot - top); ctx.clip();
    const yOf = (kt) => cy - (kt - s.ias) * ppk;
    // Coloured bands on the right edge: white flap range inside, then
    // green, yellow, and red from Vne up. Red below the white arc.
    const band = (from, to, color, inset, wid) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + w - inset - wid, yOf(to), wid, yOf(from) - yOf(to));
    };
    const sp = G.SPEEDS;
    band(20, sp.white[0], C.red, 0, 8);
    band(sp.white[0], sp.white[1], C.white, 0, 8);
    band(sp.green[0], sp.green[1], C.green, 8, 8);
    band(sp.yellow[0], sp.yellow[1], C.yellow, 8, 8);
    band(sp.vne, 250, C.red, 0, 16);
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 2;
    for (let kt = Math.max(20, Math.floor((s.ias - 60) / 5) * 5); kt <= s.ias + 60; kt += 5) {
      const y = yOf(kt);
      ctx.beginPath(); ctx.moveTo(x + w - 16, y); ctx.lineTo(x + w - (kt % 10 ? 28 : 36), y); ctx.stroke();
      if (kt % 10 === 0) text(ctx, String(kt), x + w - 42, y, { size: 22, align: 'right' });
    }
    // Speed trend: where the speed will be in 6 seconds, if it is changing.
    if (last.pfd) {
      const dt = s.t - last.pfd.t;
      if (dt > 0) last.pfd.trend = 0.8 * (last.pfd.trend ?? 0) + 0.2 * ((s.ias - last.pfd.ias) / dt) * 6;
      const tr = last.pfd.trend ?? 0;
      if (Math.abs(tr) > 1) {
        ctx.fillStyle = C.magenta;
        ctx.fillRect(x + w - 6, Math.min(cy, yOf(s.ias + tr)), 5, Math.abs(tr * ppk));
      }
    }
    ctx.restore();
    // Readout.
    const color = s.ias >= sp.vne ? C.red : s.ias >= sp.yellow[0] ? C.yellow : C.white;
    ctx.fillStyle = C.black;
    ctx.strokeStyle = C.white;
    ctx.beginPath();
    ctx.moveTo(x + 4, cy - 24); ctx.lineTo(x + w - 18, cy - 24); ctx.lineTo(x + w - 4, cy);
    ctx.lineTo(x + w - 18, cy + 24); ctx.lineTo(x + 4, cy + 24); ctx.closePath();
    ctx.fill(); ctx.stroke();
    text(ctx, String(Math.round(s.ias)), x + w - 22, cy + 1, { size: 32, align: 'right', color });
    // FLC reference speed, above the tape.
    if (s.afcs.vert === 'FLC') text(ctx, `${s.afcs.ref.ias}KT`, x + w / 2, top - 16, { size: 22, align: 'center', color: C.cyan });
    box(ctx, x, bot, w, 30, { fill: C.black, stroke: C.grey });
    text(ctx, `TAS ${Math.round(G.tas())}KT`, x + w / 2, bot + 15, { size: 17, align: 'center' });
  }

  function altitudeTape(ctx, s, G) {
    const x = 720, w = 110, top = 120, bot = 460, cy = ATT.y, ppf = 0.62;
    const alt = G.indicatedAlt();
    box(ctx, x, top, w, bot - top, { fill: 'rgba(20, 22, 26, 0.55)', stroke: null });
    ctx.save();
    ctx.beginPath(); ctx.rect(x, top, w, bot - top); ctx.clip();
    const yOf = (ft) => cy - (ft - alt) * ppf;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 2;
    for (let ft = Math.floor((alt - 340) / 20) * 20; ft <= alt + 340; ft += 20) {
      const y = yOf(ft);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (ft % 100 ? 10 : 20), y); ctx.stroke();
      if (ft % 100 === 0) text(ctx, String(ft), x + 26, y, { size: 20 });
    }
    // Selected altitude bug, cyan, on the tape's left edge.
    const yb = Math.min(bot - 8, Math.max(top + 8, yOf(s.altSel)));
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x, yb - 16, 9, 32);
    ctx.restore();
    // Readout.
    ctx.fillStyle = C.black;
    ctx.strokeStyle = C.white;
    ctx.beginPath();
    ctx.moveTo(x - 10, cy); ctx.lineTo(x + 4, cy - 24); ctx.lineTo(x + w - 2, cy - 24);
    ctx.lineTo(x + w - 2, cy + 24); ctx.lineTo(x + 4, cy + 24); ctx.closePath();
    ctx.fill(); ctx.stroke();
    text(ctx, String(Math.round(alt / 10) * 10), x + w - 8, cy + 1, { size: 30, align: 'right' });
    // Selected altitude box above, baro setting below.
    const al = s.alt;
    const flash = !blinkOn(s, al.flashUntil);
    const sel = al.phase === 'deviate' ? C.yellow : C.cyan;
    box(ctx, x, top - 36, w, 36, { fill: flash ? sel : C.black, stroke: C.grey });
    text(ctx, String(s.altSel), x + w / 2, top - 17, { size: 26, align: 'center', color: flash ? C.black : sel });
    box(ctx, x, bot, w, 30, { fill: C.black, stroke: C.grey });
    text(ctx, s.baro === 29.92 ? 'STD BARO' : `${s.baro.toFixed(2)}IN`, x + w / 2, bot + 15,
      { size: 19, align: 'center', color: C.cyan });
  }

  function vsi(ctx, s) {
    const x = 832, w = 54, cy = ATT.y, ppf = 0.075;
    ctx.fillStyle = 'rgba(20, 22, 26, 0.55)';
    ctx.beginPath();
    ctx.moveTo(x, cy - 170); ctx.lineTo(x + w, cy - 170); ctx.lineTo(x + w, cy + 170); ctx.lineTo(x, cy + 170);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 2;
    for (let f = -2000; f <= 2000; f += 500) {
      const y = cy - f * ppf;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (f % 1000 ? 8 : 16), y); ctx.stroke();
      if (f && f % 1000 === 0) text(ctx, String(Math.abs(f / 1000)), x + 22, y, { size: 18 });
    }
    // VS reference bug in VS mode.
    if (s.afcs.vert === 'VS') {
      ctx.fillStyle = C.cyan;
      ctx.fillRect(x, cy - s.afcs.ref.vs * ppf - 6, 10, 12);
      text(ctx, `${s.afcs.ref.vs}FPM`, x + 4, cy - 184, { size: 16, color: C.cyan });
    }
    const vs = Math.max(-2000, Math.min(2000, s.vs));
    const y = cy - vs * ppf;
    ctx.fillStyle = C.black;
    ctx.strokeStyle = C.white;
    ctx.beginPath();
    ctx.moveTo(x + 2, y); ctx.lineTo(x + 14, y - 14); ctx.lineTo(x + 76, y - 14); ctx.lineTo(x + 76, y + 14);
    ctx.lineTo(x + 14, y + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (Math.abs(s.vs) >= 100) text(ctx, String(Math.round(s.vs / 50) * 50), x + 72, y + 1, { size: 17, align: 'right' });
  }

  // The GFC 700's mode annunciations, top centre: lateral left (armed
  // white, active green), AP in the middle, vertical right.
  function fma(ctx, s, G) {
    const a = s.afcs, y = 88, x0 = 255, w = 460;
    box(ctx, x0, 70, w, 36, { fill: C.panel, stroke: null });
    // A mode that just changed flashes (reverse video) for 10 seconds.
    const flashing = (slot) => a.changed[slot] !== undefined && s.t - a.changed[slot] < 10 && !blinkOn(s, a.changed[slot] + 10);
    const slot = (str, x, color, key, align = 'center') => {
      if (!str) return;
      if (flashing(key)) {
        ctx.font = font(21);
        const tw = ctx.measureText(str).width + 10;
        const left = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw + 5 : x - 5;
        box(ctx, left, y - 15, tw, 30, { fill: color, stroke: null });
        text(ctx, str, x, y + 1, { size: 21, align, color: C.black });
      } else text(ctx, str, x, y + 1, { size: 21, align, color });
    };
    const latName = (m) => (m === 'NAV' || m === 'APR') ? G.navModeName(m) : m;
    slot(latName(a.lat), x0 + 45, C.green, 'lat');
    slot(latName(a.latArmed), x0 + 125, C.white, 'latArmed');
    if (a.ap) text(ctx, 'AP', x0 + 200, y + 1, { size: 21, align: 'center', color: C.green });
    else if (s.t - a.apOffAt < 5 && blinkOn(s, a.apOffAt + 5)) {
      text(ctx, 'AP', x0 + 200, y + 1, { size: 21, align: 'center', color: C.yellow });
    }
    const vref = a.vert === 'VS' ? `${a.ref.vs}FPM` : a.vert === 'FLC' ? `${a.ref.ias}KT`
      : a.vert === 'ALT' ? `${a.ref.alt}FT` : '';
    slot(a.vert, x0 + 275, C.green, 'vert');
    if (vref) text(ctx, vref, x0 + 308, y + 1, { size: 19, color: C.green });
    slot(a.vertArmed, x0 + w - 8, C.white, 'vertArmed', 'right');
  }

  function hsi(ctx, s, G) {
    const cx = 512, cy = 690, R = 125;
    const nav = G.navSolution();
    const srcColor = s.cdi === 'GPS' ? C.magenta : C.green;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(12, 14, 18, 0.85)';
    ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.fill();
    // Turn rate indicator: a fixed arc above the rose with standard rate
    // marks (18° in 6 s) and a magenta 6-second heading trend.
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R + 14, rad(-90 - 30), rad(-90 + 30)); ctx.stroke();
    for (const a of [-18, -9, 9, 18]) {
      ctx.save(); ctx.rotate(rad(a));
      ctx.beginPath(); ctx.moveTo(0, -R - 14); ctx.lineTo(0, -R - (Math.abs(a) === 18 ? 28 : 22)); ctx.stroke();
      ctx.restore();
    }
    const turn = (1091 * Math.tan(rad(s.roll))) / Math.max(G.tas(), 40) * 6;
    if (Math.abs(turn) > 0.5) {
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 6;
      const t = Math.max(-24, Math.min(24, turn));
      ctx.beginPath(); ctx.arc(0, 0, R + 14, rad(-90), rad(-90 + t), t < 0); ctx.stroke();
    }

    // The rose turns with the heading.
    ctx.save();
    ctx.rotate(rad(-s.hdg));
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 2;
    for (let d = 0; d < 360; d += 5) {
      ctx.save(); ctx.rotate(rad(d));
      ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(0, -R + (d % 10 ? 10 : 18)); ctx.stroke();
      if (d % 30 === 0) {
        const lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10);
        text(ctx, lbl, 0, -R + 34, { size: 22, align: 'center' });
      }
      ctx.restore();
    }
    // Heading bug.
    ctx.save(); ctx.rotate(rad(s.hdgBug));
    ctx.fillStyle = C.cyan;
    ctx.beginPath();
    ctx.moveTo(-14, -R); ctx.lineTo(-14, -R + 12); ctx.lineTo(-6, -R + 12); ctx.lineTo(0, -R + 5);
    ctx.lineTo(6, -R + 12); ctx.lineTo(14, -R + 12); ctx.lineTo(14, -R); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Course pointer and CDI: VOR green on the selected course, GPS
    // magenta on the active leg's desired track (none with no leg).
    const crs = s.cdi === 'GPS' ? nav?.course : s.crs[s.cdi === 'VOR1' ? 0 : 1];
    if (crs != null) {
      ctx.save(); ctx.rotate(rad(crs));
      ctx.strokeStyle = srcColor;
      ctx.fillStyle = srcColor;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, -R + 40); ctx.lineTo(0, -60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -R + 26); ctx.lineTo(-14, -R + 52); ctx.lineTo(14, -R + 52); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(0, R - 30); ctx.stroke();
      // Dots: two each side, the second at full scale.
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 2;
      for (const k of [-2, -1, 1, 2]) { ctx.beginPath(); ctx.arc(k * 34, 0, 7, 0, Math.PI * 2); ctx.stroke(); }
      if (nav) {
        ctx.strokeStyle = srcColor;
        ctx.lineWidth = 6;
        const dx = nav.dev * 68;
        ctx.beginPath(); ctx.moveTo(dx, -56); ctx.lineTo(dx, 56); ctx.stroke();
        // TO/FROM: a triangle pointing along or against the course.
        ctx.fillStyle = srcColor;
        const dir = nav.toFrom === 'TO' ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(dx + 26, dir * 34); ctx.lineTo(dx + 16, dir * 18); ctx.lineTo(dx + 36, dir * 18); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    // Lubber line and heading readout box.
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.moveTo(0, -R + 2); ctx.lineTo(-10, -R - 12); ctx.lineTo(10, -R - 12); ctx.fill();
    box(ctx, -38, -R - 64, 76, 36, { fill: C.black, stroke: C.white });
    text(ctx, pad3(s.hdg) + '°', 0, -R - 45, { size: 26, align: 'center' });
    // Small airplane in the middle.
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.moveTo(-20, -4); ctx.lineTo(20, -4);
    ctx.moveTo(-9, 18); ctx.lineTo(9, 18); ctx.stroke();
    // Source label, and with no signal a red X over the CDI.
    text(ctx, s.cdi, -46, -26, { size: 17, align: 'center', color: srcColor });
    // GPS: the CDI scale (ENR 2 NM, TERM 1 NM full scale).
    if (nav?.scale) text(ctx, nav.scale, 46, -26, { size: 17, align: 'center', color: srcColor });
    if (s.cdi !== 'GPS' && !nav) {
      ctx.strokeStyle = C.red; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-60, -40); ctx.lineTo(60, 40); ctx.moveTo(60, -40); ctx.lineTo(-60, 40); ctx.stroke();
    }
    ctx.restore();

    // Selected heading and course boxes either side of the rose's top.
    box(ctx, cx - 290, cy - R - 64, 150, 36, { fill: C.black, stroke: C.grey });
    text(ctx, 'HDG', cx - 280, cy - R - 45, { size: 20 });
    text(ctx, pad3(s.hdgBug) + '°', cx - 148, cy - R - 45, { size: 24, align: 'right', color: C.cyan });
    box(ctx, cx + 140, cy - R - 64, 150, 36, { fill: C.black, stroke: C.grey });
    text(ctx, 'CRS', cx + 150, cy - R - 45, { size: 20 });
    const crsText = crs != null ? pad3(crs) + '°' : '---°';
    text(ctx, crsText, cx + 282, cy - R - 45, { size: 24, align: 'right', color: srcColor });
    // VOR: distance to the station (a DME stand-in) under the course box;
    // GPS shows its distance in the navigation status bar instead.
    if (nav && nav.source !== 'GPS' && !s.fms.win.pfd) text(ctx, `${nav.station.id} ${nav.dist.toFixed(1)}NM`, cx + 140, cy - R - 10, { size: 18, color: srcColor });
  }

  function bottomBoxes(ctx, s) {
    const y = H - 34 - 40;
    // Outside air temperature, standard lapse from 15 °C.
    const oat = Math.round(15 - 2 * s.trueAlt / 1000);
    box(ctx, 0, y, 150, 38, { fill: C.black, stroke: C.grey });
    text(ctx, `OAT ${oat}°C`, 10, y + 19, { size: 20 });
    // Transponder: code, mode, ident.
    const x = s.xpdr;
    box(ctx, W - 280, y, 280, 38, { fill: C.black, stroke: C.grey });
    const ident = s.t < x.identUntil;
    const code = x.entry !== null ? (x.entry + '____').slice(0, 4) : x.code;
    const modeColor = x.mode === 'STBY' ? C.white : C.green;
    text(ctx, 'XPDR', W - 270, y + 19, { size: 20 });
    text(ctx, code, W - 200, y + 19, { size: 22, color: x.entry !== null ? C.cyan : modeColor });
    text(ctx, ident ? 'IDNT' : x.mode, W - 130, y + 19, { size: 22, color: modeColor });
    const d = new Date(s.t * 1000 + Date.UTC(2026, 0, 1, 17, 0, 0));
    text(ctx, `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`, W - 10, y + 19, { size: 18, align: 'right', color: C.grey });
  }

  function drawPFD(ctx, s, G) {
    ctx.clearRect(0, 0, W, H);
    attitude(ctx, s);
    aircraftSymbol(ctx, s);
    airspeedTape(ctx, s, G);
    altitudeTape(ctx, s, G);
    vsi(ctx, s);
    hsi(ctx, s, G);
    bottomBoxes(ctx, s);
    radios(ctx, s, G);
    navStatus(ctx, s, G);
    fma(ctx, s, G);
    fmsWindow(ctx, s, G, 'pfd');
    softkeys(ctx, s, G, 'pfd');
    noteBar(ctx, s);
    last.pfd = { t: s.t, ias: s.ias, trend: last.pfd?.trend };
  }

  // ---- MFD: engine strip (EIS) on the left, the navigation map ----
  function gaugeBar(ctx, label, value, lo, hi, zones, x, y, w, fmt) {
    text(ctx, label, x, y, { size: 16 });
    text(ctx, fmt(value), x + w, y, { size: 18, align: 'right' });
    const by = y + 14, bw = w;
    for (const [a, b, color] of zones) {
      ctx.fillStyle = color;
      ctx.fillRect(x + ((a - lo) / (hi - lo)) * bw, by, ((b - a) / (hi - lo)) * bw, 6);
    }
    const px = x + Math.max(0, Math.min(1, (value - lo) / (hi - lo))) * bw;
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.moveTo(px, by + 4); ctx.lineTo(px - 7, by - 9); ctx.lineTo(px + 7, by - 9); ctx.fill();
  }

  function eis(ctx, s, G) {
    box(ctx, 0, 70, 200, H - 104, { fill: C.panel, stroke: null });
    // Plausible engine numbers from power and altitude.
    const rpm = Math.round(700 + 1800 * s.power);
    const ff = +G.fuelFlow().toFixed(1);
    const x = 12, w = 176;
    if (s.eisPage === 'Lean') {
      text(ctx, 'LEAN', x, 100, { size: 18, color: C.cyan });
      gaugeBar(ctx, 'FFLOW GPH', ff, 0, 20, [[0, 20, C.green]], x, 140, w, (v) => v.toFixed(1));
      for (let c = 1; c <= 4; c++) {
        const egt = 1300 + 80 * s.power + c * 12;
        ctx.fillStyle = C.white;
        const h = (egt - 1000) / 600 * 220;
        ctx.fillRect(x + (c - 1) * 44 + 8, 420 - h, 26, h);
        text(ctx, String(c), x + (c - 1) * 44 + 21, 438, { size: 16, align: 'center' });
      }
      text(ctx, 'EGT °F (mock)', x, 470, { size: 16, color: C.grey });
      return;
    }
    if (s.eisPage === 'System') {
      text(ctx, 'SYSTEM', x, 100, { size: 18, color: C.cyan });
      gaugeBar(ctx, 'VOLTS M', 28.0, 20, 32, [[20, 24, C.red], [24, 32, C.green]], x, 140, w, (v) => v.toFixed(1));
      gaugeBar(ctx, 'VOLTS E', 28.0, 20, 32, [[20, 24, C.red], [24, 32, C.green]], x, 200, w, (v) => v.toFixed(1));
      gaugeBar(ctx, 'AMPS M', 5, -60, 60, [[-60, 60, C.green]], x, 260, w, (v) => v.toFixed(0));
      gaugeBar(ctx, 'AMPS S', 0, -10, 10, [[-10, 10, C.green]], x, 320, w, (v) => v.toFixed(0));
      return;
    }
    // ENGINE page: RPM as an arc, then bars.
    ctx.save();
    ctx.translate(100, 170);
    ctx.lineWidth = 10;
    const arc = (a, b, color) => {
      const ang = (v) => rad(150 + (v / 2800) * 240);
      ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(0, 0, 62, ang(a), ang(b)); ctx.stroke();
    };
    arc(0, 2100, '#555');
    arc(2100, 2700, C.green);
    arc(2700, 2800, C.red);
    const ang = rad(150 + (rpm / 2800) * 240);
    ctx.strokeStyle = C.white; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * 60, Math.sin(ang) * 60); ctx.stroke();
    ctx.restore();
    text(ctx, 'RPM', 100, 230, { size: 16, align: 'center' });
    text(ctx, String(Math.round(rpm / 10) * 10), 100, 208, { size: 24, align: 'center' });
    gaugeBar(ctx, 'FFLOW GPH', ff, 0, 20, [[0, 20, C.green]], x, 270, w, (v) => v.toFixed(1));
    gaugeBar(ctx, 'OIL PRES', 60, 0, 115, [[0, 20, C.red], [20, 50, C.yellow], [50, 90, C.green], [90, 115, C.red]], x, 320, w, (v) => v.toFixed(0));
    gaugeBar(ctx, 'OIL TEMP', 190, 75, 245, [[75, 100, C.yellow], [100, 245, C.green]], x, 370, w, (v) => v.toFixed(0));
    gaugeBar(ctx, 'EGT', 1350, 1000, 1600, [[1000, 1600, '#555']], x, 420, w, () => '');
    gaugeBar(ctx, 'VAC', 5.0, 3, 7, [[3, 4.5, '#555'], [4.5, 5.5, C.green], [5.5, 7, '#555']], x, 470, w, (v) => v.toFixed(1));
    gaugeBar(ctx, 'FUEL QTY L', s.fuel / 2, 0, 30, [[0, 5, C.red], [5, 8, C.yellow], [8, 30, C.green]], x, 530, w, (v) => v.toFixed(0));
    gaugeBar(ctx, 'FUEL QTY R', s.fuel / 2, 0, 30, [[0, 5, C.red], [5, 8, C.yellow], [8, 30, C.green]], x, 580, w, (v) => v.toFixed(0));
    text(ctx, 'ENG 1,234.5 HRS', x, 640, { size: 15, color: C.grey });
  }

  function navMap(ctx, s, G) {
    const x0 = 200, y0 = 106, w = W - 200, h = H - 34 - 106;
    box(ctx, x0, y0, w, h, { fill: '#0a1a10', stroke: null });
    const range = G.RANGES[s.range];
    // Heading up: own ship two thirds down, the range ring above it.
    const ox = x0 + w / 2, oy = y0 + h * 0.66, ringR = h * 0.5;
    const ppn = ringR / range;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    const toXY = (p) => {
      const { brg, dist } = G.bearingDist(s, p);
      const a = rad(brg - s.hdg);
      return [ox + Math.sin(a) * dist * ppn, oy - Math.cos(a) * dist * ppn];
    };
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.arc(ox, oy, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, `${range}NM`, ox + ringR * 0.72, oy - ringR * 0.72, { size: 18, color: C.grey });
    // The flight plan: legs white, the active leg (or Direct-To) magenta.
    const f = s.fms.fpl, l = G.fms.leg();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.white;
    for (let i = 1; i < f.wpts.length; i++) {
      if (!f.dto && i === f.active) continue;
      const [ax, ay] = toXY(G.fms.byId[f.wpts[i - 1]]), [bx, by] = toXY(G.fms.byId[f.wpts[i]]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    if (l) {
      const [ax, ay] = toXY(l.from), [bx, by] = toXY(l.to);
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    // Selected VOR course line from the station.
    const nav = G.navSolution();
    if (nav && nav.source !== 'GPS') {
      const [sx, sy] = toXY(nav.station);
      const a = rad(nav.course - s.hdg);
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - Math.sin(a) * 2000, sy + Math.cos(a) * 2000);
      ctx.lineTo(sx + Math.sin(a) * 2000, sy - Math.cos(a) * 2000); ctx.stroke();
    }
    // Airports: towered cyan, non-towered magenta. With the whole state in
    // the database, identifiers show only at 15 NM range or less
    // (declutter), and smaller rings beyond 25 NM.
    const labels = range <= 15, ring = range > 25 ? 6 : 9;
    for (const ap of G.AIRPORTS) {
      const [px, py] = toXY(ap);
      if (px < x0 - 40 || px > x0 + w + 40 || py < y0 - 40 || py > y0 + h + 40) continue;
      ctx.strokeStyle = ap.towered ? C.cyan : C.magenta;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, ring, 0, Math.PI * 2); ctx.stroke();
      if (labels) text(ctx, ap.id, px + 14, py - 12, { size: 18 });
    }
    for (const n of G.NAVAIDS) {
      const [px, py] = toXY(n);
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = rad(60 * k);
        ctx[k ? 'lineTo' : 'moveTo'](px + Math.cos(a) * 11, py + Math.sin(a) * 11);
      }
      ctx.closePath(); ctx.stroke();
      text(ctx, `${n.id} ${n.freq.toFixed(1)}`, px + 15, py + 16, { size: 16, color: C.cyan });
    }
    // Own ship.
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.moveTo(ox, oy - 18); ctx.lineTo(ox + 14, oy + 12); ctx.lineTo(ox, oy + 5); ctx.lineTo(ox - 14, oy + 12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // Heading-up compass arc label and page title.
    text(ctx, 'HDG UP', x0 + 10, y0 + 18, { size: 16, color: C.grey });
    text(ctx, 'Mock map: not for navigation', x0 + 10, y0 + h - 60, { size: 13, color: C.grey });
  }

  function navDataBar(ctx, s, G) {
    box(ctx, 200, 70, W - 200, 36, { fill: C.panel, stroke: null });
    // DTK and ETE (to the active waypoint, at the present ground speed)
    // come from the GPS leg; blank without one.
    const nav = G.navSolution('GPS');
    let ete = '__:__';
    if (nav) {
      const mins = (nav.dist / Math.max(G.tas(), 30)) * 60;
      ete = `${Math.floor(mins)}:${String(Math.floor((mins % 1) * 60)).padStart(2, '0')}`;
    }
    const fields = [['GS', `${Math.round(G.tas())}KT`], ['DTK', nav ? pad3(nav.course) + '°' : '___°'],
      ['TRK', `${pad3(s.hdg)}°`], ['ETE', ete]];
    fields.forEach(([k, v], i) => {
      const x = 220 + i * 200;
      text(ctx, k, x, 88, { size: 18 });
      text(ctx, v, x + 50, 88, { size: 20, color: C.magenta });
    });
  }

  function drawMFD(ctx, s, G) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    mfdPage(ctx, s, G);
    eis(ctx, s, G);
    navDataBar(ctx, s, G);
    radios(ctx, s, G);
    fmsWindow(ctx, s, G, 'mfd');
    pageGroups(ctx, s, G);
    softkeys(ctx, s, G, 'mfd');
    noteBar(ctx, s);
  }

  return { W, H, drawPFD, drawMFD };
})();
