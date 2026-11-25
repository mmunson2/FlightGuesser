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
      // NAV ID (volume knob push): the Morse identifier is on.
      if (s.vol.navId[i]) text(ctx, 'ID', 350, y, { size: 16 });
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
      // Squelch off (volume knob push).
      if (s.vol.sqOff[i]) text(ctx, 'SQ', 930, y, { size: 14, align: 'center', color: C.white });
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
      const { brg: trueBrg, dist } = G.bearingDist(s, m), brg = G.toMag(trueBrg);
      text(ctx, `BRG ${pad3(brg)}°   DIS ${dist.toFixed(1)}NM`, x + 20, y + 138, { size: 20 });
    }
    const on = win.stage === 'activate';
    box(ctx, x + w / 2 - 80, y + 166, 160, 36, { fill: on ? C.cyan : C.black, stroke: C.cyan });
    text(ctx, 'ACTIVATE?', x + w / 2, y + 185, { size: 20, align: 'center', color: on ? C.black : C.cyan });
  }

  // One flight plan data field for a row (js/g1000-fms.js rows()): DTK,
  // DIS and ETE are the leg's; CUM the plan's so far; ETA and FUEL (left
  // on arrival) from the airplane along the route, at the present ground
  // speed and fuel flow, for the active waypoint and those after it.
  const hhmm = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  function fplField(fd, r, s, G) {
    const gs = Math.max(G.tas(), 30);
    switch (fd) {
      case 'DTK': return r.dtk == null ? '' : pad3(r.dtk) + '°';
      case 'DIS': return r.dis == null ? '' : r.dis.toFixed(1);
      case 'CUM': return r.dis == null ? '' : r.cum.toFixed(0);
      case 'ETE': return r.dis == null ? '' : hhmm(r.dis / gs);
      case 'ETA': {
        if (r.toGo == null) return '__:__';
        const d = new Date(s.t * 1000 + (r.toGo / gs) * 3600000 + Date.UTC(2026, 0, 1, 17, 0, 0));
        return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      }
      case 'FUEL': return r.toGo == null ? '___' : (s.fuel - G.fuelFlow() * (r.toGo / gs)).toFixed(1);
    }
    return '';
  }

  function fplWindow(ctx, s, G, win, x, y, w, h) {
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.95)', stroke: C.white });
    text(ctx, 'ACTIVE FLIGHT PLAN', x + w / 2, y + 20, { size: 20, align: 'center', color: C.cyan });
    const cols = [x + 40, x + w * 0.45, x + w * 0.7, x + w - 12];
    // The three data columns (Change Fields).
    const fields = [s.fms.fields.f1, s.fms.fields.f2, s.fms.fields.f3];
    fields.forEach((fd, k) => text(ctx, fd, cols[k + 1], y + 48, { size: 15, align: 'right', color: C.grey }));
    if (s.fms.insertAfter) text(ctx, 'INSERT AFTER', x + 10, y + 48, { size: 12, color: C.grey });
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
      const c = r.active ? C.magenta : C.white;
      fields.forEach((fd, k) => text(ctx, fplField(fd, r, s, G), cols[k + 1], ry, { size: 20, align: 'right', color: c }));
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
    else if (win.type === 'tmr') timerWindow(ctx, s, G, win, x, 500, w, 276);
    else if (win.type === 'alerts') alertsWindow(ctx, s, G, win, x, 548, w, 228);
    else fplWindow(ctx, s, G, win, x, y, w, h);
  }

  // ---- The MENU key's windows (js/g1000-menu.js) ----
  // PFD: the lower right, over any FMS window; MFD: the map's right half.
  function pageMenuWindow(ctx, s, G, display) {
    const m = s.pageMenu[display];
    if (!m) return;
    // As tall as the options need, up to the space there is; the PFD's
    // sits on the softkey bar's boxes, the MFD's hangs from the top.
    const rowH = 27, head = 78, foot = m.confirm ? 96 : 44;
    // (The PFD's stops below the baro box.)
    const pfd = display === 'pfd', maxH = pfd ? 280 : 560;
    // A setup window: room for its longest group (PFD: from the baro box down).
    const h = m.type === 'map' ? (pfd ? 286 : 420) : Math.min(maxH, head - rowH / 2 + Math.max(2, m.items.length) * rowH + foot);
    const [x, y, w] = pfd ? [640, 776 - h, 378] : [590, 106, 428];
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.97)', stroke: C.white });
    if (m.type === 'map') return mapSetup(ctx, s, G, m, x, y, w, h);
    text(ctx, 'PAGE MENU', x + w / 2, y + 20, { size: 20, align: 'center', color: C.cyan });
    text(ctx, 'OPTIONS', x + 14, y + 50, { size: 15, color: C.grey });
    if (!m.items.length) {
      text(ctx, 'No options with this page', x + w / 2, y + head + 4, { size: 19, align: 'center' });
    }
    const top = y + head;
    const n = Math.floor((h - head - foot + rowH / 2) / rowH);
    // Keep the cursor in view.
    const first = Math.max(0, Math.min(m.cursor - n + 1, m.items.length - n));
    m.items.slice(first, first + n).forEach((it, k) => {
      const i = first + k, ry = top + k * rowH, sel = i === m.cursor;
      if (sel) box(ctx, x + 8, ry - 13, w - 16, 26, { fill: it.run ? C.cyan : C.grey, stroke: null });
      text(ctx, it.label, x + 18, ry, { size: 19, color: sel ? C.black : it.run ? C.white : '#5b6068' });
    });
    if (first > 0) text(ctx, '▲', x + w - 18, top - 4, { size: 14, align: 'center', color: C.grey });
    if (first + n < m.items.length) text(ctx, '▼', x + w - 18, top + (n - 1) * rowH + 4, { size: 14, align: 'center', color: C.grey });
    if (m.confirm) {
      box(ctx, x + 10, y + h - 82, w - 20, 72, { fill: C.black, stroke: C.cyan });
      text(ctx, m.confirm.text, x + w / 2, y + h - 62, { size: 18, align: 'center' });
      box(ctx, x + w / 2 - 50, y + h - 46, 100, 28, { fill: C.cyan, stroke: null });
      text(ctx, 'OK', x + w / 2, y + h - 31, { size: 18, align: 'center', color: C.black });
      text(ctx, 'CLR: cancel', x + w - 20, y + h - 31, { size: 14, align: 'right', color: C.grey });
    } else {
      text(ctx, 'Press the FMS CRSR knob to return to base page', x + w / 2, y + h - 20,
        { size: 14, align: 'center', color: C.grey });
    }
  }
  // A setup window (Map Setup, PFD Map Setup, Change Fields): the GROUP
  // line, then the group's settings.
  function mapSetup(ctx, s, G, m, x, y, w, h) {
    const view = G.menus.setupView(m), rowH = h < 400 ? 24 : 32;
    text(ctx, view.title, x + w / 2, y + 20, { size: 20, align: 'center', color: C.cyan });
    const fmt = (v) => (typeof v === 'number' ? `${v}NM` : v);
    const line = (label, value, ry, sel) => {
      text(ctx, label, x + 18, ry, { size: 18, color: C.grey });
      ctx.font = font(19);
      const tw = ctx.measureText(value).width;
      if (sel) box(ctx, x + w - 20 - tw - 8, ry - 13, tw + 16, 26, { fill: C.cyan, stroke: null });
      text(ctx, value, x + w - 20, ry, { size: 19, align: 'right', color: sel ? C.black : C.cyan });
    };
    line('GROUP', view.group, y + 60, m.cursor === -1);
    ctx.strokeStyle = C.grey; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 10, y + 80); ctx.lineTo(x + w - 10, y + 80); ctx.stroke();
    view.rows.forEach((r, i) => line(r.label, fmt(r.value), y + 100 + i * rowH, m.cursor === i));
    text(ctx, 'Large knob: setting · small knob: change · CLR: done', x + w / 2, y + h - 16, { size: 14, align: 'center', color: C.grey });
  }

  // The PFD's Timer/References window (js/g1000-timer.js): the timer, the
  // V-speeds, the minimums. Each field the cursor can take is drawn by
  // `field`, which boxes it cyan under the cursor.
  const hms = (sec) => [sec / 3600, (sec / 60) % 60, sec % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
  function timerWindow(ctx, s, G, win, x, y, w, h) {
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.95)', stroke: C.white });
    text(ctx, 'TIMER / REFERENCES', x + w / 2, y + 20, { size: 19, align: 'center', color: C.cyan });
    const r = s.ref, t = r.timer, F = G1000_TIMER.FIELDS;
    let n = 0;
    // The next cursor stop's value at (fx, fy), right-aligned.
    const field = (str, fx, fy, color = C.cyan) => {
      const sel = win.cursor === n++;
      ctx.font = font(19);
      const tw = ctx.measureText(str).width;
      if (sel) box(ctx, fx - tw - 4, fy - 13, tw + 8, 26, { fill: C.cyan, stroke: null });
      text(ctx, str, fx, fy, { size: 19, align: 'right', color: sel ? C.black : color });
    };
    const rowY = (i) => y + 54 + i * 29;
    text(ctx, 'TIMER', x + 12, rowY(0), { size: 16, color: C.grey });
    field(hms(t.secs), x + 180, rowY(0), t.expired && !blinkOn(s, s.t + 1) ? C.yellow : C.white);
    field(t.dir, x + 236, rowY(0));
    field(G.timer.action(), x + w - 12, rowY(0));
    text(ctx, 'REFERENCES', x + 12, rowY(1), { size: 15, color: C.grey });
    G1000_TIMER.VSPEEDS.forEach((v, i) => {
      const ref = r.v[v.key];
      text(ctx, v.name, x + 30, rowY(2 + i), { size: 18 });
      field(`${ref.kt}KT`, x + 210, rowY(2 + i));
      field(ref.on ? 'ON' : 'OFF', x + w - 12, rowY(2 + i), ref.on ? C.cyan : C.grey);
    });
    text(ctx, 'MINIMUMS', x + 12, rowY(6), { size: 16, color: C.grey });
    field(r.mins.mode, x + 210, rowY(6), r.mins.mode === 'OFF' ? C.grey : C.cyan);
    field(`${r.mins.ft}FT`, x + w - 12, rowY(6));
    console.assert(n === F.length, 'timer window fields');
    text(ctx, 'Large knob: field · small knob: change · ENT: timer', x + w / 2, y + h - 16,
      { size: 14, align: 'center', color: C.grey });
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
  // Magnetic variation as charts write it ("16°E"), with its epoch year.
  const magVarText = (w) => (w.magVar == null ? 'unknown'
    : `${Math.abs(w.magVar)}°${w.magVar >= 0 ? 'E' : 'W'}${w.magVarYear ? ` (${w.magVarYear})` : ''}`);

  // Airport Information (data/wa-nav.js, FAA NASR): details on the left,
  // frequencies on the right, runways along the bottom.
  function airportInfo(ctx, s, G) {
    pageBackground(ctx);
    const a = G.fms.byId[s.mfd.wpt.airport];
    const x = PAGE.x + 30, y = PAGE.y + 64;
    identLine(ctx, s, G, 'WPT:0', a.id, x, y);
    if (a.lid !== a.id) text(ctx, `(${a.lid})`, x + 110, y + 2, { size: 18, color: C.grey });
    const { brg: trueBrg, dist } = G.bearingDist(s, a), brg = G.toMag(trueBrg);
    const pairs = [
      ['NAME', a.name], ['CITY', a.city], ['ELEV', `${a.elev}FT`],
      // NASR gives the pattern altitude above the field.
      ['TPA', a.tpa != null ? `${a.elev + a.tpa}FT MSL (${a.tpa} AGL)` : 'not published'],
      ['TYPE', a.towered ? 'Towered' : 'Non-towered'], ['FUEL', a.fuel || 'none'], ['MAG VAR', magVarText(a)],
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
    const { brg: trueBrg, dist } = G.bearingDist(s, v), brg = G.toMag(trueBrg);
    rowsOf(ctx, [
      ['NAME', v.name], ['FREQUENCY', v.freq.toFixed(2), C.green], ['POSITION', latLon(v.lat, v.lon)],
      ['FROM P.POS', `${pad3(brg)}°  ${dist.toFixed(1)}NM`],
      // The radial the airplane is on: the bearing from the station.
      ['RADIAL', `${pad3(G.toMag(trueBrg + 180, v.magVar))}° FROM`], ['MAG VAR', magVarText(v) + ' declared'],
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
    const st = s.mfd.stats, hours = Math.max(s.t - st.tripT0, 1) / 3600;
    const hms = (sec) => [sec / 3600, (sec / 60) % 60, sec % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
    rowsOf(ctx, [
      ['FLIGHT TIMER', hms(s.t - st.t0)], ['ODOMETER', st.odo.toFixed(1) + 'NM'],
      ['TRIP ODOMETER', st.trip.toFixed(1) + 'NM'], ['TRIP AVG GS', Math.round(st.trip / hours) + 'KT'],
      ['TRIP MAX GS', Math.round(st.maxGs) + 'KT'],
      // The PFD's Tmr/Ref window sets these; shown here too.
      ['GENERIC TIMER', `${hms(s.ref.timer.secs)} ${s.ref.timer.dir}${s.ref.timer.running ? '' : ' (stopped)'}`],
      ['MINIMUMS', s.ref.mins.mode === 'OFF' ? 'OFF' : `BARO ${s.ref.mins.ft}FT`, C.cyan],
    ], PAGE.x + 30, PAGE.y + 70);
    hint(ctx, 'MENU: reset the statistics. Set the timer and minimums with the PFD Tmr/Ref softkey.');
  }

  // AUX - System Setup: here only the airspace alert settings.
  function systemSetup(ctx, s, G) {
    pageBackground(ctx);
    const x = PAGE.x + 30, set = s.alertSet, cur = s.mfd.cursor;
    text(ctx, 'AIRSPACE ALERTS', x, PAGE.y + 64, { size: 17, color: C.cyan });
    const rows = [['ALTITUDE BUFFER', `${set.buffer}FT`], ['CLASS B/TMA', set.B ? 'ON' : 'OFF'],
      ['CLASS C/TCA', set.C ? 'ON' : 'OFF'], ['CLASS D', set.D ? 'ON' : 'OFF']];
    rows.forEach(([k, v], i) => {
      const ry = PAGE.y + 110 + i * 40, sel = cur === i;
      text(ctx, k, x, ry, { size: 18, color: C.grey });
      ctx.font = font(21);
      const tw = ctx.measureText(v).width;
      if (sel) box(ctx, x + 330 - tw - 6, ry - 15, tw + 12, 30, { fill: C.cyan, stroke: null });
      text(ctx, v, x + 330, ry, { size: 21, align: 'right', color: sel ? C.black : C.cyan });
    });
    // The Flight ID: sent with the transponder's replies (ADS-B).
    const fy = PAGE.y + 110 + rows.length * 40 + 70;
    text(ctx, 'TRANSPONDER', x, fy - 44, { size: 17, color: C.cyan });
    text(ctx, 'FLIGHT ID', x, fy, { size: 18, color: C.grey });
    if (cur === 'ident') identField(ctx, s.mfd.entry, x + 200, fy, G, true, G.pages.matchers['AUX:3']);
    else {
      ctx.font = font(21);
      const tw = ctx.measureText(s.xpdr.flightId).width;
      if (cur === rows.length) box(ctx, x + 330 - tw - 6, fy - 15, tw + 12, 30, { fill: C.cyan, stroke: null });
      text(ctx, s.xpdr.flightId, x + 330, fy, { size: 21, align: 'right', color: cur === rows.length ? C.black : C.cyan });
    }
    hint(ctx, cur == null ? 'Push FMS for the cursor. Other setup items are not in the mock.'
      : cur === 'ident' ? 'Small knob: character · large knob: position · ENT: done'
        : cur === rows.length ? 'ENT: edit the Flight ID' : 'Large knob: item · small knob: change · CLR or push FMS: done');
  }

  // The Flight Plan Catalog: stored plans on the left, the waypoints of
  // the one under the cursor (or the first) on the right.
  function catalog(ctx, s, G) {
    pageBackground(ctx);
    const rows = G.pages.catalogRows(), cur = s.mfd.cursor;
    const x = PAGE.x + 30, top = PAGE.y + 60, rowH = 36;
    text(ctx, 'FLIGHT PLAN', x, top - 4, { size: 15, color: C.grey });
    text(ctx, 'DIS', x + 400, top - 4, { size: 15, align: 'right', color: C.grey });
    if (!rows.length) text(ctx, 'No stored flight plans', x, top + 34, { size: 20, color: C.grey });
    rows.slice(0, 13).forEach((r, i) => {
      const ry = top + 34 + i * rowH, sel = cur === i;
      if (sel) box(ctx, x - 6, ry - 15, 300, 30, { fill: C.cyan, stroke: null });
      text(ctx, `${r.num}  ${r.from} / ${r.to}`, x, ry, { size: 21, color: sel ? C.black : C.white });
      text(ctx, r.dist.toFixed(0) + 'NM', x + 400, ry, { size: 20, align: 'right' });
    });
    const shown = rows[cur ?? 0];
    if (shown) {
      const wx = PAGE.x + 500;
      text(ctx, `PLAN ${shown.num}`, wx, top - 4, { size: 15, color: C.cyan });
      shown.wpts.slice(0, 13).forEach((id, i) => text(ctx, id, wx, top + 34 + i * rowH, { size: 20 }));
    }
    hint(ctx, cur == null ? 'Push FMS for the cursor · MENU: page options'
      : 'ENT or MENU: activate, invert or delete the plan');
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

  // Nearest Frequencies: center, flight service and weather, a section
  // each, one row per frequency.
  // Who answers an outlet: the center or flight service station's name.
  const VIA = { ZSE: 'SEATTLE CENTER', SEA: 'SEATTLE RADIO' };
  function nearestFreqPage(ctx, s, G) {
    pageBackground(ctx);
    const rows = G.pages.nearestFreqs(), cur = s.mfd.cursor;
    const x = PAGE.x + 30, rowH = 31;
    let y = PAGE.y + 60, last = null;
    const TITLE = { ARTCC: 'ARTCC', FSS: 'FSS', WX: 'WEATHER' };
    rows.forEach((r, i) => {
      if (r.kind !== last) {
        if (last) y += 10;
        text(ctx, TITLE[r.kind], x, y, { size: 15, color: C.cyan });
        text(ctx, 'BRG', x + 420, y, { size: 14, align: 'right', color: C.grey });
        text(ctx, 'DIS', x + 520, y, { size: 14, align: 'right', color: C.grey });
        y += rowH;
        last = r.kind;
      }
      const sel = cur === i;
      // Center and FSS: who answers, and the outlet; weather: the station.
      const who = r.kind === 'WX' ? `${r.w.id}  ${r.w.via}` : `${VIA[r.w.via] ?? r.w.via}`;
      text(ctx, who, x, y, { size: 18 });
      text(ctx, r.kind === 'WX' ? '' : r.w.name, x + 200, y, { size: 14, color: C.grey });
      text(ctx, pad3(r.brg) + '°', x + 420, y, { size: 18, align: 'right' });
      text(ctx, r.dist.toFixed(1) + 'NM', x + 520, y, { size: 18, align: 'right' });
      if (sel) box(ctx, x + 545, y - 14, 96, 28, { fill: C.cyan, stroke: null });
      text(ctx, r.freq.toFixed(3), x + 550, y, { size: 19, color: sel ? C.black : C.green });
      y += rowH;
    });
    hint(ctx, cur == null ? 'Push FMS for the cursor' : 'ENT: frequency to COM standby');
  }

  // Nearest Airspaces: name, class, where the airplane stands, the
  // shelf's floor and ceiling.
  const altText = (ft, agl) => (ft === 0 ? 'SFC' : `${ft}${agl ? 'AGL' : ''}`);
  function nearestAirspacePage(ctx, s, G) {
    pageBackground(ctx);
    const list = G.pages.nearestAirspaces(), cur = s.mfd.cursor;
    const x = PAGE.x + 30, top = PAGE.y + 60, rowH = 46;
    text(ctx, 'AIRSPACE', x, top - 4, { size: 15, color: C.grey });
    text(ctx, 'STATUS', x + 470, top - 4, { size: 15, color: C.grey });
    text(ctx, 'ALT', x + 790, top - 4, { size: 15, align: 'right', color: C.grey });
    if (!list.length) text(ctx, 'No airspace within 50NM', x, top + 34, { size: 20, color: C.grey });
    const color = { B: '#3a8bff', C: C.magenta, D: '#3a8bff' };
    list.forEach((a, i) => {
      const ry = top + 34 + i * rowH;
      if (ry > PAGE.y + PAGE.h - 90) return;
      if (cur === i) box(ctx, x - 6, ry - 19, PAGE.w - 48, 38, { fill: '#123a4a', stroke: C.cyan });
      box(ctx, x, ry - 12, 24, 24, { fill: C.black, stroke: color[a.cls] });
      text(ctx, a.cls, x + 12, ry + 1, { size: 16, align: 'center', color: color[a.cls] });
      text(ctx, a.name.replace(/ CLASS [BCD]\d*$/, '').slice(0, 34), x + 36, ry, { size: 18 });
      const stColor = a.rank === 0 || a.rank === 2 || a.rank === 3 ? C.yellow : C.white;
      text(ctx, a.status ?? `${a.dist.toFixed(1)}NM`, x + 470, ry, { size: 18, color: stColor });
      text(ctx, `${altText(a.lo, a.loAgl)}-${a.hi}FT`, x + 790, ry, { size: 17, align: 'right' });
    });
    hint(ctx, 'Class B, C and D (FAA ADDS). Floor and ceiling of the nearest shelf, MSL.');
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
      'AUX:1': utility, 'AUX:3': systemSetup, 'FPL:1': catalog, 'NRST:0': (c, st, g) => nearestList(c, st, g, false), 'NRST:3': (c, st, g) => nearestList(c, st, g, true),
      'NRST:5': nearestFreqPage, 'NRST:6': nearestAirspacePage,
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
        || (menu === 'engine' && label === s.eisPage)
        // A softkey's window open on the PFD.
        || (menu === 'pfd' && !!s.fms.win.pfd && ({ 'Tmr/Ref': 'tmr', Nearest: 'nrst' })[label] === s.fms.win.pfd.type)
        || (menu === 'pfd' && label === 'OBS' && !!s.fms.obs)
        || (menu === 'map-layout' && label === s.pfdMap.layout);
      if (label === 'Alerts' && display === 'pfd') return alertsKey(ctx, s, G, i * w, y, w);
      if (on) box(ctx, i * w + 3, y + 3, w - 6, 28, { fill: C.cyan, stroke: null });
      text(ctx, label, i * w + w / 2, y + 17, { size: label.length > 7 ? 15 : 18, align: 'center',
        color: on ? C.black : live.includes(i) ? C.white : '#5b6068' });
    });
  }
  // The PFD's ALERTS softkey: the most urgent unacknowledged level,
  // flashing (WARNING red, CAUTION amber, ADVISORY white, each on black);
  // lit while the Alerts window is open.
  const LEVEL_KEY = { warning: ['WARNING', C.red], caution: ['CAUTION', C.yellow], advisory: ['ADVISORY', C.white] };
  function alertsKey(ctx, s, G, x, y, w) {
    const lv = G.alerts.pending();
    if (lv) {
      const [label, color] = LEVEL_KEY[lv], lit = Math.floor(s.t * 2) % 2 === 0;
      box(ctx, x + 3, y + 3, w - 6, 28, { fill: lit ? color : C.black, stroke: null });
      text(ctx, label, x + w / 2, y + 17, { size: 14, align: 'center', color: lit ? C.black : color });
      return;
    }
    const open = s.fms.win.pfd?.type === 'alerts';
    if (open) box(ctx, x + 3, y + 3, w - 6, 28, { fill: C.cyan, stroke: null });
    text(ctx, 'Alerts', x + w / 2, y + 17, { size: 18, align: 'center', color: open ? C.black : C.white });
  }

  // The annunciation window, right of the VSI: warnings (red) above
  // cautions (amber). Unacknowledged ones flash (reverse video).
  function annunciationWindow(ctx, s) {
    const cas = s.alerts.cas;
    if (!cas.length) return;
    const x = 912, w = 108, y0 = 128, rowH = 26;
    box(ctx, x, y0 - 4, w, cas.length * rowH + 8, { fill: C.black, stroke: C.grey });
    cas.forEach((c, i) => {
      const color = c.level === 'warning' ? C.red : C.yellow, y = y0 + i * rowH + rowH / 2;
      const flash = !c.acked && Math.floor(s.t * 2) % 2 === 0;
      if (flash) box(ctx, x + 3, y - 11, w - 6, 22, { fill: color, stroke: null });
      text(ctx, c.text, x + w / 2, y + 1, { size: c.text.length > 10 ? 13 : 15, align: 'center', color: flash ? C.black : color });
    });
  }

  // The PFD's Alerts window: the messages, newest first.
  function alertsWindow(ctx, s, G, win, x, y, w, h) {
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.95)', stroke: C.white });
    text(ctx, 'ALERTS', x + w / 2, y + 20, { size: 20, align: 'center', color: C.cyan });
    const msgs = s.alerts.messages;
    if (!msgs.length) text(ctx, 'No messages', x + w / 2, y + 70, { size: 18, align: 'center', color: C.grey });
    const rowH = 58, n = Math.floor((h - 60) / rowH);
    msgs.slice(win.first, win.first + n).forEach((m, k) => {
      const ry = y + 52 + k * rowH;
      text(ctx, m.title, x + 12, ry, { size: 17, color: C.white });
      text(ctx, m.text, x + 12, ry + 20, { size: 14, color: C.white, bold: false });
      text(ctx, m.about.replace(/ CLASS ([BCD])\d*$/, ' ($1)').slice(0, 40), x + 12, ry + 38, { size: 13, color: C.grey });
    });
    if (win.first + n < msgs.length) text(ctx, '▼', x + w - 16, y + h - 14, { size: 14, color: C.grey });
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
    // V-speed references that are on (Tmr/Ref): a cyan tag outside the
    // tape's right edge at the speed, when it is on the tape.
    for (const v of G1000_TIMER.VSPEEDS) {
      const ref = s.ref.v[v.key], y = yOf(ref.kt);
      if (!ref.on || y < top + 10 || y > bot - 10) continue;
      box(ctx, x + w + 2, y - 11, 22, 22, { fill: C.black, stroke: C.cyan });
      text(ctx, v.tag, x + w + 13, y + 1, { size: 16, align: 'center', color: C.cyan });
    }
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
    // Minimums bug (Tmr/Ref, BARO): a bar across the tape's left half,
    // cyan, yellow once below.
    const mins = s.ref.mins, minColor = mins.below ? C.yellow : C.cyan;
    if (mins.mode === 'BARO') {
      const ym = yOf(mins.ft);
      ctx.fillStyle = minColor;
      ctx.beginPath(); ctx.moveTo(x, ym - 9); ctx.lineTo(x + 14, ym); ctx.lineTo(x, ym + 9); ctx.fill();
      ctx.fillRect(x, ym - 2, 46, 4);
    }
    ctx.restore();
    // The minimums box, left of the baro setting.
    if (mins.mode === 'BARO') {
      box(ctx, x - 150, bot, 146, 30, { fill: C.black, stroke: C.grey });
      text(ctx, 'BARO MIN', x - 143, bot + 15, { size: 13, color: minColor });
      text(ctx, `${mins.ft}FT`, x - 8, bot + 15, { size: 16, align: 'right', color: minColor });
    }
    // Readout.
    ctx.fillStyle = C.black;
    ctx.strokeStyle = C.white;
    ctx.beginPath();
    ctx.moveTo(x - 10, cy); ctx.lineTo(x + 4, cy - 24); ctx.lineTo(x + w - 2, cy - 24);
    ctx.lineTo(x + w - 2, cy + 24); ctx.lineTo(x + 4, cy + 24); ctx.closePath();
    ctx.fill(); ctx.stroke();
    text(ctx, String(Math.round(alt / 10) * 10), x + w - 8, cy + 1, { size: 30, align: 'right' });
    // ALT Units, Meters: the metric altitude under the readout, and the
    // selected altitude's beside its box.
    const M = s.altUnits.meters, FT_M = 0.3048;
    if (M) {
      box(ctx, x + 4, cy + 26, w - 6, 24, { fill: C.black, stroke: C.grey });
      text(ctx, `${Math.round(alt * FT_M)}M`, x + w - 8, cy + 38, { size: 18, align: 'right' });
    }
    // Selected altitude box above, baro setting below.
    const al = s.alt;
    const flash = !blinkOn(s, al.flashUntil);
    const sel = al.phase === 'deviate' ? C.yellow : C.cyan;
    box(ctx, x, top - 36, w, 36, { fill: flash ? sel : C.black, stroke: C.grey });
    text(ctx, String(s.altSel), x + w / 2, top - 17, { size: 26, align: 'center', color: flash ? C.black : sel });
    if (M) {
      box(ctx, x - 84, top + 2, 82, 28, { fill: C.black, stroke: C.grey });
      text(ctx, `${Math.round(s.altSel * FT_M)}M`, x - 6, top + 16, { size: 17, align: 'right', color: C.cyan });
    }
    box(ctx, x, bot, w, 30, { fill: C.black, stroke: C.grey });
    // In inches, or hectopascals (ALT Units, HPA).
    const baroText = s.altUnits.baro === 'HPA' ? `${Math.round(s.baro * G.HPA)}HPA` : `${s.baro.toFixed(2)}IN`;
    text(ctx, s.baro === 29.92 ? 'STD BARO' : baroText, x + w / 2, bot + 15,
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
    // Under the strip: PTRM (red, pitch trim failure) and MAXSPD (amber,
    // flashing: overspeed protection is pitching up).
    const below = [];
    if (s.sys.failed.trim) below.push(['PTRM', C.red, true]);
    if (a.maxspd) below.push(['MAXSPD', C.yellow, blinkOn(s, s.t + 1)]);
    below.forEach(([str, color, show], i) => {
      const bx = x0 + w / 2 - (below.length * 110) / 2 + i * 110;
      box(ctx, bx + 5, 108, 100, 28, { fill: C.black, stroke: color });
      if (show) text(ctx, str, bx + 55, 123, { size: 19, align: 'center', color });
    });
  }

  function hsi(ctx, s, G) {
    const cx = 512, cy = 690, R = 125;
    const nav = G.navSolution();
    const srcColor = s.cdi === 'GPS' ? C.magenta : C.green;
    // HSI Map (Map/HSI, Layout): a heading-up map inside the rose, own ship
    // at its centre and the rose's edge at the map's range.
    const hsiMap = s.pfdMap.layout === 'HSI Map';
    if (hsiMap) {
      drawMap(ctx, s, G, { ox: cx, oy: cy, ringR: R, circle: R + 4, fill: '#0a1a10', range: G.RANGES[s.pfdMap.range], small: true, set: s.pfdMapSet });
    }
    ctx.save();
    ctx.translate(cx, cy);
    if (!hsiMap) {
      ctx.fillStyle = 'rgba(12, 14, 18, 0.85)';
      ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.fill();
    }
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
    ctx.rotate(rad(-G.magHeading()));
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
    text(ctx, pad3(G.magHeading()) + '°', 0, -R - 45, { size: 26, align: 'center' });
    // Small airplane in the middle.
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.moveTo(-20, -4); ctx.lineTo(20, -4);
    ctx.moveTo(-9, 18); ctx.lineTo(9, 18); ctx.stroke();
    // Source label, and with no signal a red X over the CDI.
    text(ctx, s.cdi, -46, -26, { size: 17, align: 'center', color: srcColor });
    // GPS: the CDI scale (ENR 2 NM, TERM 1 NM full scale).
    if (nav?.scale) text(ctx, nav.scale, 46, -26, { size: 17, align: 'center', color: srcColor });
    // OBS mode: sequencing suspended on the active waypoint.
    if (nav?.obs) text(ctx, 'OBS', 46, 30, { size: 17, align: 'center', color: srcColor });
    if (hsiMap) text(ctx, G.RANGES[s.pfdMap.range] + 'NM', 0, R - 46, { size: 14, align: 'center', color: C.grey });
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
    // R: replying to an interrogation (a radar sweep every 4.8 s, made up).
    if (x.mode !== 'STBY' && s.t % 4.8 < 0.6) text(ctx, 'R', W - 84, y + 19, { size: 18, color: C.green });
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
    annunciationWindow(ctx, s);
    hsi(ctx, s, G);
    if (s.pfdMap.layout === 'Inset Map') insetMap(ctx, s, G);
    bottomBoxes(ctx, s);
    radios(ctx, s, G);
    navStatus(ctx, s, G);
    fma(ctx, s, G);
    fmsWindow(ctx, s, G, 'pfd');
    pageMenuWindow(ctx, s, G, 'pfd');
    softkeys(ctx, s, G, 'pfd');
    noteBar(ctx, s);
    last.pfd = { t: s.t, ias: s.ias, trend: last.pfd?.trend };
  }

  // ---- MFD: engine strip (EIS) on the left, the navigation map ----
  // color: the value's colour (red or amber when out of limits).
  function gaugeBar(ctx, label, value, lo, hi, zones, x, y, w, fmt, color = C.white) {
    text(ctx, label, x, y, { size: 16, color: color === C.white ? C.white : color });
    text(ctx, fmt(value), x + w, y, { size: 18, align: 'right', color });
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
    // The numbers come from js/g1000-systems.js.
    const sys = s.sys, rpm = Math.round(sys.rpm);
    // POH limits: red outside them, amber on a discharging battery.
    const voltColor = (v) => (v < 24.5 || v > 32 ? C.red : C.white);
    const ampColor = (v) => (v < -1.5 ? C.yellow : C.white);
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
      const vz = [[20, 24.5, C.red], [24.5, 32, C.green], [32, 34, C.red]];
      gaugeBar(ctx, 'VOLTS M', sys.voltsM, 20, 34, vz, x, 140, w, (v) => v.toFixed(1), voltColor(sys.voltsM));
      gaugeBar(ctx, 'VOLTS E', sys.voltsE, 20, 34, vz, x, 200, w, (v) => v.toFixed(1), voltColor(sys.voltsE));
      gaugeBar(ctx, 'AMPS M', sys.ampsM, -60, 60, [[-60, 60, C.green]], x, 260, w, (v) => v.toFixed(0), ampColor(sys.ampsM));
      gaugeBar(ctx, 'AMPS S', sys.ampsS, -10, 10, [[-10, 10, C.green]], x, 320, w, (v) => v.toFixed(1), sys.ampsS < 0 ? C.yellow : C.white);
      gaugeBar(ctx, 'OIL PSI', sys.oilPsi, 0, 115, [[0, 20, C.red], [20, 50, C.yellow], [50, 90, C.green], [90, 115, C.red]], x, 380, w, (v) => v.toFixed(0), sys.oilPsi <= 20 ? C.red : C.white);
      gaugeBar(ctx, 'OIL °F', sys.oilF, 75, 250, [[75, 100, C.yellow], [100, 245, C.green], [245, 250, C.red]], x, 440, w, (v) => v.toFixed(0), sys.oilF >= 245 ? C.red : C.white);
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
    gaugeBar(ctx, 'OIL PRES', sys.oilPsi, 0, 115, [[0, 20, C.red], [20, 50, C.yellow], [50, 90, C.green], [90, 115, C.red]], x, 320, w, (v) => v.toFixed(0), sys.oilPsi <= 20 ? C.red : C.white);
    gaugeBar(ctx, 'OIL TEMP', sys.oilF, 75, 250, [[75, 100, C.yellow], [100, 245, C.green], [245, 250, C.red]], x, 370, w, (v) => v.toFixed(0), sys.oilF >= 245 ? C.red : C.white);
    gaugeBar(ctx, 'EGT', sys.running ? 1350 : 1000, 1000, 1600, [[1000, 1600, '#555']], x, 420, w, () => '');
    gaugeBar(ctx, 'VAC', sys.vac, 3, 7, [[3, 4.5, '#555'], [4.5, 5.5, C.green], [5.5, 7, '#555']], x, 470, w, (v) => v.toFixed(1), sys.vac < 3.5 ? C.yellow : C.white);
    // Fuel: the POH's red 0-5 gal (1.5 gal unusable at 0), amber 5-8.
    const fz = [[0, 5, C.red], [5, 8, C.yellow], [8, 30, C.green]];
    const fc = (g) => (g < 5 ? C.yellow : C.white);
    gaugeBar(ctx, 'FUEL QTY L', s.fuelL, 0, 30, fz, x, 530, w, (v) => v.toFixed(0), fc(s.fuelL));
    gaugeBar(ctx, 'FUEL QTY R', s.fuelR, 0, 30, fz, x, 580, w, (v) => v.toFixed(0), fc(s.fuelR));
    // Bus volts and battery amps at the bottom (POH: M BUS E, M BATT S).
    const pair = (label, a, b, y, ca, cb, d) => {
      text(ctx, label, x + w / 2, y, { size: 13, align: 'center', color: C.grey });
      text(ctx, a.toFixed(d), x, y, { size: 16, color: ca });
      text(ctx, b.toFixed(d), x + w, y, { size: 16, align: 'right', color: cb });
    };
    pair('M  VOLTS  E', sys.voltsM, sys.voltsE, 630, voltColor(sys.voltsM), voltColor(sys.voltsE), 1);
    pair('M  AMPS  S', sys.ampsM, sys.ampsS, 656, ampColor(sys.ampsM), sys.ampsS < 0 ? C.yellow : C.white, 1);
  }

  // ---- Moving maps: the MFD's Navigation Map, the PFD's inset and HSI
  // maps. One drawing, by a view: the area (a rectangle, or a circle for
  // the HSI map), where own ship sits, the range and the orientation. What
  // shows follows Map Setup (s.mapSet) on all three. ----
  // Airspace: Class B blue, C magenta, D blue dashed, as on the charts.
  const AIRSPACE = { B: { color: '#3a8bff', dash: [] }, C: { color: C.magenta, dash: [] }, D: { color: '#3a8bff', dash: [10, 7] } };
  function drawMap(ctx, s, G, v) {
    // v.set: the map's settings (the MFD's Map Setup, or the PFD's).
    const { range } = v, set = v.set, small = v.small;
    // A map setting that is a range: the symbol shows at that map range or
    // less ('Off': never).
    const shows = (val) => val !== 'Off' && range <= val;
    const up = v.northUp ? 0 : s.hdg;
    const { ox, oy, ringR } = v, ppn = ringR / range;
    ctx.save();
    ctx.beginPath();
    if (v.circle) ctx.arc(ox, oy, v.circle, 0, Math.PI * 2); else ctx.rect(v.x0, v.y0, v.w, v.h);
    ctx.clip();
    if (v.fill) { ctx.fillStyle = v.fill; ctx.fill(); }
    const toXY = (p) => {
      const { brg, dist } = G.bearingDist(s, p);
      const a = rad(brg - up);
      return [ox + Math.sin(a) * dist * ppn, oy - Math.cos(a) * dist * ppn];
    };
    // Airspace first, under everything: each shelf's outline.
    const cls = { B: shows(set.clsB), C: shows(set.clsC), D: shows(set.clsD) };
    for (const a of G.AIRSPACE) {
      if (!cls[a.cls]) continue;
      // Skip shelves wholly far away (their first point beyond 3 ranges
      // and 60 NM: no Washington shelf is wider).
      if (G.bearingDist(s, { lat: a.pts[0][0], lon: a.pts[0][1] }).dist > Math.max(3 * range, 60)) continue;
      const st = AIRSPACE[a.cls];
      ctx.strokeStyle = st.color;
      ctx.lineWidth = small ? 1.5 : 2.5;
      ctx.setLineDash(st.dash);
      ctx.beginPath();
      a.pts.forEach(([lat, lon], k) => { const [px, py] = toXY({ lat, lon }); ctx[k ? 'lineTo' : 'moveTo'](px, py); });
      ctx.closePath(); ctx.stroke();
    }
    ctx.setLineDash([]);
    if (set.ring === 'On' && !v.circle) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(ox, oy, ringR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // The flight plan: legs white, the active leg (or Direct-To) magenta;
    // in OBS, the selected course through the waypoint and on past it.
    const f = s.fms.fpl, l = G.fms.leg(), showFpl = shows(set.fpl);
    ctx.lineWidth = small ? 2 : 3;
    ctx.strokeStyle = C.white;
    for (let i = 1; showFpl && i < f.wpts.length; i++) {
      if (!f.dto && i === f.active) continue;
      const [ax, ay] = toXY(G.fms.byId[f.wpts[i - 1]]), [bx, by] = toXY(G.fms.byId[f.wpts[i]]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    if (l && showFpl) {
      const [ax, ay] = toXY(l.from), [bx, by] = toXY(l.beyond ?? l.to);
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = small ? 3 : 5;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    // Selected VOR course line from the station.
    const nav = G.navSolution();
    if (nav && nav.source !== 'GPS') {
      const [sx, sy] = toXY(nav.station);
      const a = rad(nav.courseTrue - up);
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - Math.sin(a) * 2000, sy + Math.cos(a) * 2000);
      ctx.lineTo(sx + Math.sin(a) * 2000, sy - Math.cos(a) * 2000); ctx.stroke();
    }
    // Airports: towered cyan, non-towered magenta, each size shown up to
    // its Map Setup range, identifiers up to APT Text's; smaller rings
    // beyond 25 NM.
    const labels = shows(set.aptText), ring = (range > 25 ? 6 : 9) * (small ? 0.75 : 1);
    const sized = { L: shows(set.aptL), M: shows(set.aptM), S: shows(set.aptS) };
    const far = (px, py) => Math.hypot(px - ox, py - oy) > 1500;
    for (const ap of G.AIRPORTS) {
      if (!sized[G.airportSize(ap)]) continue;
      const [px, py] = toXY(ap);
      if (far(px, py)) continue;
      ctx.strokeStyle = ap.towered ? C.cyan : C.magenta;
      ctx.lineWidth = small ? 2 : 3;
      ctx.beginPath(); ctx.arc(px, py, ring, 0, Math.PI * 2); ctx.stroke();
      if (labels) text(ctx, ap.id, px + 12, py - 11, { size: small ? 14 : 18 });
    }
    for (const n of shows(set.vor) ? G.NAVAIDS : []) {
      const [px, py] = toXY(n), r = small ? 8 : 11;
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = rad(60 * k);
        ctx[k ? 'lineTo' : 'moveTo'](px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.stroke();
      if (shows(set.vorText)) text(ctx, small ? n.id : `${n.id} ${n.freq.toFixed(1)}`, px + r + 4, py + 14, { size: small ? 13 : 16, color: C.cyan });
    }
    // Track vector: a dashed line to where the airplane will be after the
    // set time, at the present track (the heading: no wind) and speed.
    if (set.track !== 'Off') {
      const [n, unit] = set.track.split(' '), secs = +n * (unit === 'MIN' ? 60 : 1);
      const len = (G.tas() * secs / 3600) * ppn, a = rad(s.hdg - up);
      ctx.strokeStyle = C.white; ctx.lineWidth = small ? 2 : 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(a) * len, oy - Math.cos(a) * len); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Own ship, pointing along the heading (straight up unless north up).
    // The HSI map leaves it to the HSI's own airplane symbol.
    if (!v.circle) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(rad(s.hdg - up));
      ctx.scale(small ? 0.7 : 1, small ? 0.7 : 1);
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(14, 12); ctx.lineTo(0, 5); ctx.lineTo(-14, 12);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function navMap(ctx, s, G) {
    const x0 = 200, y0 = 106, w = W - 200, h = H - 34 - 106;
    box(ctx, x0, y0, w, h, { fill: '#0a1a10', stroke: null });
    const range = G.RANGES[s.range], northUp = s.mapSet.orient === 'North Up';
    // Heading or track up (the same here: no wind): own ship two thirds
    // down, the range ring above it. North up: own ship in the middle.
    const ox = x0 + w / 2, oy = y0 + h * (northUp ? 0.5 : 0.66), ringR = h * (northUp ? 0.42 : 0.5);
    drawMap(ctx, s, G, { x0, y0, w, h, ox, oy, ringR, range, northUp, set: s.mapSet });
    if (s.mapSet.ring === 'On') text(ctx, `${range}NM`, ox + ringR * 0.72, oy - ringR * 0.72, { size: 18, color: C.grey });
    // The orientation, top left.
    text(ctx, { 'Heading Up': 'HDG UP', 'Track Up': 'TRK UP', 'North Up': 'NORTH UP' }[s.mapSet.orient], x0 + 10, y0 + 18, { size: 16, color: C.grey });
    text(ctx, 'Mock map: not for navigation', x0 + 10, y0 + h - 60, { size: 13, color: C.grey });
  }

  // The PFD's inset map (Map/HSI, Layout, Inset Map): lower left, heading
  // up, its own range (the PFD's RANGE knob).
  const INSET = { x0: 4, y0: 545, w: 300, h: 228 };
  function insetMap(ctx, s, G) {
    const { x0, y0, w, h } = INSET, range = G.RANGES[s.pfdMap.range];
    box(ctx, x0, y0, w, h, { fill: '#0a1a10', stroke: C.grey });
    // Its own Map Setup (the PFD's Page Menu): north up puts own ship in the middle.
    const set = s.pfdMapSet, northUp = set.orient === 'North Up';
    const ox = x0 + w / 2, oy = y0 + h * (northUp ? 0.5 : 0.72);
    drawMap(ctx, s, G, { x0, y0, w, h, ox, oy, ringR: h * (northUp ? 0.42 : 0.6), range, small: true, northUp, set });
    text(ctx, `${range}NM`, x0 + w - 8, y0 + 14, { size: 14, align: 'right', color: C.grey });
    text(ctx, { 'Heading Up': 'HDG UP', 'Track Up': 'TRK UP', 'North Up': 'NORTH UP' }[set.orient], x0 + 8, y0 + 14, { size: 13, color: C.grey });
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
      ['TRK', `${pad3(G.magHeading())}°`], ['ETE', ete]];
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
    pageMenuWindow(ctx, s, G, 'mfd');
    pageGroups(ctx, s, G);
    softkeys(ctx, s, G, 'mfd');
    noteBar(ctx, s);
  }

  return { W, H, drawPFD, drawMFD };
})();
