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

  // Help (which key does what, what the mock leaves out, disclaimers) is
  // never drawn: the real displays have none. Each frame's lines are kept
  // per display for a separate help UI (help(display)); js/g1000.js keeps
  // the latest one-off note in state.note the same way.
  const helpLines = { pfd: [], mfd: [] };
  let helpFor = 'mfd';
  const hint = (ctx, str) => { helpLines[helpFor].push(str); };

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
    // The active frequency is green on the COM the audio panel transmits on
    // (COM MIC).
    for (let i = 0; i < 2; i++) {
      const y = 20 + i * 32, c = s.com[i];
      const tuning = s.comTune === i, tx = G.gma.transmitting() === i + 1;
      text(ctx, c.act.toFixed(3), 660, y, { size: 24, color: tx ? C.green : C.white });
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
    // (No solution with LOI: dashes.)
    text(ctx, nav ? `DIS ${nav.dist.toFixed(1)}NM  DTK ${pad3(nav.course)}°` : 'DIS __._NM  DTK ___°', 495, 52, { size: 18, align: 'center' });
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
    const gs = Math.max(G.gs(), 30);
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
    const rows = G.fms.rows();
    // The plan's first and last waypoints.
    if (rows.length) text(ctx, `${rows[0].id} / ${rows[rows.length - 1].id}`, x + w / 2, y + 44, { size: 17, align: 'center' });
    const cols = [x + 40, x + w * 0.45, x + w * 0.7, x + w - 12];
    // The three data columns (Change Fields).
    const fields = [s.fms.fields.f1, s.fms.fields.f2, s.fms.fields.f3];
    fields.forEach((fd, k) => text(ctx, fd, cols[k + 1], y + 68, { size: 15, align: 'right', color: C.grey }));
    if (s.fms.insertAfter) text(ctx, 'INSERT AFTER', x + 10, y + 68, { size: 12, color: C.grey });
    const rowH = 30, top = y + 94;
    const maxRows = Math.floor((h - 108 - (win.prompt ? 40 : 0)) / rowH);
    // Keep the cursor in view.
    const first = Math.max(0, Math.min((win.cursor ?? 0) - maxRows + 2, rows.length + 1 - maxRows));
    const all = [...rows, null];
    // The active leg: a magenta bracket from the FROM row down to the TO
    // row (an arrow into it); a Direct-To, D→ on the TO row.
    const at = rows.findIndex((r) => r.active);
    if (at >= 0 && !s.fms.fpl.dto) {
      const yRow = (i) => top + (i - first) * rowH;
      const yTo = yRow(at), yFrom = Math.max(top - 12, yRow(at - 1));
      if (at - first >= 0 && at - first < maxRows) {
        ctx.strokeStyle = C.magenta; ctx.fillStyle = C.magenta; ctx.lineWidth = 3;
        ctx.beginPath();
        if (at > 0) { ctx.moveTo(x + 26, yFrom); ctx.lineTo(x + 12, yFrom); ctx.lineTo(x + 12, yTo); } else ctx.moveTo(x + 12, yTo);
        ctx.lineTo(x + 24, yTo); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 34, yTo); ctx.lineTo(x + 24, yTo - 7); ctx.lineTo(x + 24, yTo + 7); ctx.fill();
      }
    }
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
      if (r.active && s.fms.fpl.dto) text(ctx, 'D→', x + 6, ry, { size: 15, color: C.magenta });
      text(ctx, r.id, cols[0], ry, { size: 22, color });
      const c = r.active ? C.magenta : C.white;
      fields.forEach((fd, k) => text(ctx, fplField(fd, r, s, G), cols[k + 1], ry, { size: 20, align: 'right', color: c }));
    }
    if (win.prompt) {
      box(ctx, x + 10, y + h - 46, w - 20, 36, { fill: C.cyan, stroke: null });
      text(ctx, win.prompt.text, x + w / 2, y + h - 27, { size: 18, align: 'center', color: C.black });
    } else if (win.cursor == null) {
      hint(ctx, 'Push FMS for the cursor');
    }
  }

  function fmsWindow(ctx, s, G, display) {
    const win = s.fms.win[display];
    if (!win) return;
    // PFD: the lower right corner, beside the HSI and under the CRS box.
    // MFD: the map's right half.
    // (Above the MFD's page group indicator.)
    const [x, y, w, h] = display === 'pfd' ? [660, 548, 358, 228] : [600, PAGE.y, 418, H - 34 - 54 - PAGE.y];
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
    const h = m.type === 'cpa' ? 220 : m.type === 'map' ? (pfd ? 286 : 420) : Math.min(maxH, head - rowH / 2 + Math.max(2, m.items.length) * rowH + foot);
    const [x, y, w] = pfd ? [640, 776 - h, 378] : [590, PAGE.y, 428];
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.97)', stroke: C.white });
    if (m.type === 'map') return mapSetup(ctx, s, G, m, x, y, w, h);
    if (m.type === 'cpa') return cpaWindow(ctx, s, G, m, x, y, w, h);
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
      hint(ctx, 'ENT: OK · CLR: cancel');
    } else {
      text(ctx, 'Press the FMS CRSR knob to return to base page', x + w / 2, y + h - 20,
        { size: 14, align: 'center', color: C.grey });
    }
  }
  // Closest Point of FPL: the reference waypoint being typed, then the
  // point's bearing and distance from it.
  function cpaWindow(ctx, s, G, m, x, y, w, h) {
    text(ctx, 'CLOSEST POINT OF FPL', x + w / 2, y + 20, { size: 19, align: 'center', color: C.cyan });
    text(ctx, 'REFERENCE WAYPOINT', x + 18, y + 54, { size: 15, color: C.grey });
    identField(ctx, m.entry, x + 18, y + 88, G, !m.result);
    const r = m.result;
    if (r && r.lat != null) {
      text(ctx, `BRG ${pad3(r.brg)}°  DIS ${r.dist.toFixed(1)}NM`, x + 18, y + 128, { size: 19 });
      text(ctx, `on the leg ${s.fms.fpl.wpts[r.after]} → ${s.fms.fpl.wpts[r.after + 1]}`, x + 18, y + 156, { size: 16, color: C.grey });
      hint(ctx, 'ENT: save as a user waypoint · CLR: back');
    } else {
      hint(ctx, 'Small knob: character · ENT: find the point');
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
    hint(ctx, 'Large knob: setting · small knob: change · CLR: done');
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
    hint(ctx, 'Large knob: field · small knob: change · ENT: timer');
  }

  // The PFD's Nearest Airports window: identifier, bearing, distance.
  function pfdNearest(ctx, s, G, win, x, y, w, h) {
    box(ctx, x, y, w, h, { fill: 'rgba(8, 9, 11, 0.95)', stroke: C.white });
    text(ctx, 'NEAREST AIRPORTS', x + w / 2, y + 20, { size: 20, align: 'center', color: C.cyan });
    const list = G.pages.nearestAirports();
    // Two lines each: identifier, bearing, distance; then the frequency
    // and the longest runway.
    const rowH = 56, n = Math.floor((h - 50) / rowH);
    const first = Math.max(0, Math.min((win.cursor ?? 0) - n + 1, list.length - n));
    list.slice(first, first + n).forEach((r, k) => {
      const i = first + k, ry = y + 50 + k * rowH, sel = win.cursor === i;
      const selId = sel && win.field !== 'freq', selF = sel && win.field === 'freq';
      if (selId) box(ctx, x + 10, ry - 14, 76, 28, { fill: C.cyan, stroke: null });
      text(ctx, r.w.id, x + 14, ry, { size: 21, color: selId ? C.black : C.white });
      text(ctx, pad3(r.brg) + '°', x + 170, ry, { size: 20, align: 'right' });
      text(ctx, r.dist.toFixed(1) + 'NM', x + 270, ry, { size: 20, align: 'right' });
      const f = G.pages.airportFreq(r.w), fy = ry + 24;
      if (f) {
        text(ctx, f.kind, x + 14, fy, { size: 15, color: C.grey });
        const ft = f.freq.toFixed(3);
        ctx.font = font(19);
        const tw = ctx.measureText(ft).width;
        if (selF) box(ctx, x + 72, fy - 13, tw + 12, 26, { fill: C.cyan, stroke: null });
        text(ctx, ft, x + 78, fy, { size: 19, color: selF ? C.black : C.cyan });
      }
      const rwy = Math.max(0, ...(r.w.runways ?? []).map((rw) => rw.len ?? 0));
      if (rwy) text(ctx, `${rwy}FT`, x + w - 12, fy, { size: 16, align: 'right', color: C.grey });
    });
    hint(ctx, win.cursor == null ? 'Push FMS for the cursor'
      : win.field === 'freq' ? 'ENT: to COM standby' : 'D→ goes direct to the selection');
  }

  // ---- MFD pages (js/g1000-pages.js) ----
  // The content area right of the EIS and below the nav data bar.
  // (The navigation data fields are in the top bar, between the radios.)
  const PAGE = { x: 200, y: 70, w: W - 200, h: H - 34 - 70 };
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
      ['CLASS C/TCA', set.C ? 'ON' : 'OFF'], ['CLASS D', set.D ? 'ON' : 'OFF'],
      ['GPS CDI', s.cdiScale === 'AUTO' ? 'AUTO' : `${s.cdiScale}NM`]];
    rows.forEach(([k, v], i) => {
      // The CDI row under its own heading.
      const ry = PAGE.y + 110 + i * 40 + (i >= 4 ? 50 : 0), sel = cur === i;
      if (i === 4) text(ctx, 'NAVIGATION', x, ry - 44, { size: 17, color: C.cyan });
      text(ctx, k, x, ry, { size: 18, color: C.grey });
      ctx.font = font(21);
      const tw = ctx.measureText(v).width;
      if (sel) box(ctx, x + 330 - tw - 6, ry - 15, tw + 12, 30, { fill: C.cyan, stroke: null });
      text(ctx, v, x + 330, ry, { size: 21, align: 'right', color: sel ? C.black : C.cyan });
    });
    // The Flight ID: sent with the transponder's replies (ADS-B).
    const fy = PAGE.y + 110 + rows.length * 40 + 120;
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

  // WPT - User WPT Information: the waypoint, where it is, what it was
  // made from (reference waypoint, radial, distance).
  function userWptPage(ctx, s, G) {
    pageBackground(ctx);
    const u = G.pages.shownUser(), x = PAGE.x + 30, y = PAGE.y + 70, cur = s.mfd.cursor;
    if (!u) {
      text(ctx, 'No user waypoints', x, y, { size: 22, color: C.grey });
      hint(ctx, 'MENU: create one here · ENT on the map pointer (RANGE push) makes one there');
      return;
    }
    const entry = cur === 'ident' ? s.mfd.entryFor : null;
    const field = (str, fx, fy, row) => {
      ctx.font = font(22);
      const tw = ctx.measureText(str).width, sel = cur === row;
      if (sel) box(ctx, fx - 4, fy - 15, tw + 8, 30, { fill: C.cyan, stroke: null });
      text(ctx, str, fx, fy, { size: 22, color: sel ? C.black : C.cyan });
    };
    if (entry === 'name') identField(ctx, s.mfd.entry, x, y, G, true, G.pages.matchers['WPT:4']);
    else field(u.id, x, y, 0);
    text(ctx, `${s.fms.user.indexOf(u) + 1} of ${s.fms.user.length}`, x + 200, y, { size: 15, color: C.grey });
    const { brg, dist } = G.bearingDist(s, u);
    rowsOf(ctx, [['COMMENT', u.name], ['POSITION', latLon(u.lat, u.lon)], ['FROM P.POS', `${pad3(G.toMag(brg))}°  ${dist.toFixed(1)}NM`]], x, y + 50);
    const ry = y + 200;
    text(ctx, 'REFERENCE WAYPOINT', x, ry, { size: 16, color: C.cyan });
    const r = u.ref;
    text(ctx, 'WPT', x, ry + 40, { size: 18, color: C.grey });
    if (entry === 'ref') identField(ctx, s.mfd.entry, x + 230, ry + 40, G, true, G.pages.matchers['WPT:4']);
    else field(r ? r.id : '_____', x + 230, ry + 40, 1);
    text(ctx, 'RADIAL', x, ry + 80, { size: 18, color: C.grey });
    field(r ? `${pad3(r.radial)}°` : '___°', x + 230, ry + 80, 2);
    text(ctx, 'DISTANCE', x, ry + 120, { size: 18, color: C.grey });
    field(r ? `${r.dist.toFixed(1)}NM` : '__._NM', x + 230, ry + 120, 3);
    hint(ctx, cur == null ? 'Push FMS for the cursor · MENU: create or delete · D→: direct to it'
      : cur === 'ident' ? 'Small knob: character · large knob: position · ENT: done'
        : ['Small knob: next waypoint · ENT: rename', 'ENT: pick the reference waypoint', 'Small knob: radial', 'Small knob: distance'][cur]);
  }

  // Nearest User WPTs.
  function nearestUserPage(ctx, s, G) {
    pageBackground(ctx);
    const list = G.pages.nearestUser(), x = PAGE.x + 30, top = PAGE.y + 60, rowH = 40, cur = s.mfd.cursor;
    text(ctx, 'BRG', x + 220, top - 4, { size: 15, align: 'right', color: C.grey });
    text(ctx, 'DIS', x + 340, top - 4, { size: 15, align: 'right', color: C.grey });
    if (!list.length) text(ctx, 'No user waypoints within 200NM', x, top + 34, { size: 20, color: C.grey });
    list.slice(0, 14).forEach((r, i) => {
      const ry = top + 34 + i * rowH, sel = cur === i;
      if (sel) box(ctx, x - 6, ry - 15, 100, 30, { fill: C.cyan, stroke: null });
      text(ctx, r.w.id, x, ry, { size: 22, color: sel ? C.black : C.white });
      text(ctx, pad3(r.brg) + '°', x + 220, ry, { size: 21, align: 'right' });
      text(ctx, r.dist.toFixed(1) + 'NM', x + 340, ry, { size: 21, align: 'right' });
      text(ctx, r.w.name.slice(0, 30), x + 380, ry, { size: 15, color: C.grey });
    });
    hint(ctx, cur == null ? 'Push FMS for the cursor' : 'ENT: its information page · D→: direct to it');
  }

  // AUX - GPS Status: the sky (north up, the rings 0° and 45° elevation),
  // signal bars, and the solution.
  function gpsStatusPage(ctx, s, G) {
    pageBackground(ctx);
    const g = G.pages.gpsStatus(), cx = PAGE.x + 200, cy = PAGE.y + 230, R = 150;
    ctx.strokeStyle = C.grey; ctx.lineWidth = 2;
    for (const r of [R, R / 2]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    text(ctx, 'N', cx, cy - R - 14, { size: 16, align: 'center', color: C.grey });
    for (const sat of g.sats) {
      const r = (1 - sat.el / 90) * R, a = rad(sat.az);
      const px = cx + Math.sin(a) * r, py = cy - Math.cos(a) * r;
      ctx.fillStyle = sat.used ? C.cyan : '#3b3f46';
      ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill();
      text(ctx, String(sat.prn), px, py + 1, { size: 12, align: 'center', color: C.black });
    }
    // The solution, right of the sky.
    const x = PAGE.x + 420, lost = g.solution === 'LOI';
    rowsOf(ctx, [['GPS SOLUTION', g.solution, lost ? C.yellow : C.green], ['EPU', g.epu != null ? `${g.epu.toFixed(2)}NM` : '_.__NM'],
      ['HFOM', g.hfom != null ? `${g.hfom}FT` : '___FT'], ['VFOM', g.vfom != null ? `${g.vfom}FT` : '___FT'],
      ['SBAS', lost ? 'INACTIVE' : 'WAAS ACTIVE'], ...latLon(s.lat, s.lon).split('  ').map((v, i) => [i ? 'LON' : 'LAT', v])], x, PAGE.y + 90, 36);
    // Signal bars along the bottom: cyan when used, grey tracked only.
    const by = PAGE.y + PAGE.h - 110, bw = 38;
    g.sats.forEach((sat, i) => {
      const bx = PAGE.x + 30 + i * (bw + 16), h = (sat.sig / 55) * 90;
      ctx.fillStyle = sat.used ? C.cyan : '#5b6068';
      ctx.fillRect(bx, by - h, bw, h);
      text(ctx, String(sat.prn), bx + bw / 2, by + 14, { size: 13, align: 'center', color: C.grey });
    });
    hint(ctx, 'Made-up constellation, for the look of the page');
  }

  // A string cut at a word to fit `room` pixels in `f`, with an ellipsis.
  function fit(ctx, str, room, f) {
    ctx.font = f;
    if (ctx.measureText(str).width <= room) return str;
    let cut = str;
    while (cut.length > 4 && ctx.measureText(cut + '…').width > room) cut = cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : -1);
    return cut + '…';
  }
  // The Checklist page: GROUP and CHECKLIST, the items (checked green),
  // and "Go to Next Checklist?".
  function checklistPage(ctx, s, G) {
    pageBackground(ctx);
    const ck = G.checklist, c = s.chk, g = ck.group(), l = ck.list();
    const x = PAGE.x + 20, w = PAGE.w - 40;
    const field = (label, value, fy, sel) => {
      text(ctx, label, x, fy, { size: 15, color: C.grey });
      if (sel) box(ctx, x + 110, fy - 14, w - 110, 28, { fill: C.cyan, stroke: null });
      text(ctx, value, x + 118, fy, { size: 19, color: sel ? C.black : C.cyan });
    };
    field('GROUP', g.group, PAGE.y + 50, c.cursor === 'group');
    field('CHECKLIST', l.name, PAGE.y + 82, c.cursor === 'list');
    ctx.strokeStyle = C.grey; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, PAGE.y + 100); ctx.lineTo(x + w, PAGE.y + 100); ctx.stroke();
    const rowH = 27, top = PAGE.y + 120, n = Math.floor((PAGE.h - 220) / rowH);
    const at = typeof c.cursor === 'number' ? c.cursor : c.cursor === 'next' ? l.items.length : 0;
    const first = Math.max(0, Math.min(at - n + 3, l.items.length + 1 - n));
    const done = ck.checked();
    for (let k = 0; k < n && first + k <= l.items.length; k++) {
      const i = first + k, ry = top + k * rowH;
      if (i === l.items.length) {
        const sel = c.cursor === 'next';
        if (sel) box(ctx, x + 2, ry - 13, w - 4, 26, { fill: C.cyan, stroke: null });
        text(ctx, ck.finished() ? '* CHECKLIST FINISHED *   Go to Next Checklist?' : 'Go to Next Checklist?', x + w / 2, ry,
          { size: 17, align: 'center', color: sel ? C.black : ck.finished() ? C.green : C.white });
        break;
      }
      const it = l.items[i], sel = c.cursor === i, ok = done[i];
      // A heading or note: one line, cut to fit.
      if (it.length === 1) { text(ctx, fit(ctx, it[0], w - 20, font(15, false)), x + 8, ry, { size: 15, color: C.yellow, bold: false }); continue; }
      if (sel) box(ctx, x + 2, ry - 13, w - 4, 26, { fill: '#123a4a', stroke: C.cyan });
      const color = ok ? C.green : C.white;
      // The box, ticked when checked.
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x + 8, ry - 8, 16, 16);
      if (ok) { ctx.beginPath(); ctx.moveTo(x + 11, ry); ctx.lineTo(x + 15, ry + 5); ctx.lineTo(x + 22, ry - 5); ctx.stroke(); }
      // The response in full; the challenge cut to the room left.
      ctx.font = font(16, false);
      const resp = it[1], room = w - 50 - ctx.measureText(resp).width - 20;
      text(ctx, fit(ctx, it[0], room, font(16, false)), x + 34, ry, { size: 16, color, bold: false });
      text(ctx, resp, x + w - 8, ry, { size: 16, align: 'right', color, bold: false });
    }
    hint(ctx, 'Large knob: cursor · small knob: group, checklist · ENT: check · CLR: uncheck');
    hint(ctx, 'From the C172S POH (2007). Not for flight.');
  }

  function placeholder(ctx, s, G) {
    pageBackground(ctx);
    text(ctx, G.pages.pageName(), PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h / 2 - 20, { size: 26, align: 'center' });
    hint(ctx, 'Not in the mock yet');
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
    // The Checklist page stands in for whatever page was showing.
    if (G.checklist.isOpen()) {
      checklistPage(ctx, s, G);
      box(ctx, PAGE.x + PAGE.w / 2 - 230, PAGE.y + 2, 460, 32, { fill: C.black, stroke: null });
      text(ctx, 'CHECKLIST', PAGE.x + PAGE.w / 2, PAGE.y + 18, { size: 18, align: 'center', color: C.cyan });
      return;
    }
    const key = G.pages.pageKey();
    const draw = {
      'MAP:0': navMap, 'FPL:0': navMap, 'WPT:0': airportInfo, 'WPT:3': vorInfo, 'WPT:4': userWptPage, 'AUX:0': tripPlanning,
      'AUX:1': utility, 'AUX:2': gpsStatusPage, 'AUX:3': systemSetup, 'FPL:1': catalog, 'NRST:0': (c, st, g) => nearestList(c, st, g, false), 'NRST:3': (c, st, g) => nearestList(c, st, g, true),
      'NRST:4': nearestUserPage, 'NRST:5': nearestFreqPage, 'NRST:6': nearestAirspacePage,
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
    const labels = G.labels(display), live = G.live(display);
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
        || (menu === 'map-layout' && label === s.pfdMap.layout)
        || (menu === 'wind' && label === (s.windShow === 'Off' ? 'Off' : 'Option ' + s.windShow))
        || (menu === 'pfd-opt' && ((label === 'Bearing 1' && s.brg[0]) || (label === 'Bearing 2' && s.brg[1]) || (label === 'DME' && s.dme.on)))
        || (menu === 'lean' && label === 'Assist' && s.sys.lean.assist)
        || ((menu === 'lean' || menu === 'system') && label === s.eisPage);
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
    const rowH = 44, n = Math.floor((h - 60) / rowH);
    msgs.slice(win.first, win.first + n).forEach((m, k) => {
      const ry = y + 52 + k * rowH;
      text(ctx, m.title, x + 12, ry, { size: 17, color: C.white });
      text(ctx, m.text, x + 12, ry + 20, { size: 14, color: C.white, bold: false });
      if (m.about) hint(ctx, `${m.title}: ${m.about}`);
    });
    if (win.first + n < msgs.length) text(ctx, '▼', x + w - 16, y + h - 14, { size: 14, color: C.grey });
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

    // Roll scale: the arc and its ticks turn with the horizon; the roll
    // pointer is slaved to the airplane symbol (POH 7-17), fixed at the top.
    ctx.save();
    ctx.translate(ATT.x, ATT.y);
    const R = 190;
    ctx.save();
    ctx.rotate(rad(-s.roll));
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R, rad(-150), rad(-30)); ctx.stroke();
    for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
      const len = Math.abs(a) === 30 || Math.abs(a) === 60 ? 22 : 12;
      ctx.save(); ctx.rotate(rad(a));
      ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(0, -R - len); ctx.stroke();
      ctx.restore();
    }
    // Zero: a white triangle above the arc, turning with it.
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(-12, -R - 20); ctx.lineTo(12, -R - 20); ctx.fill();
    ctx.restore();
    // Roll pointer, and the slip/skid trapezoid under it (centred: the
    // mock flies coordinated).
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.moveTo(0, -R + 2); ctx.lineTo(-12, -R + 22); ctx.lineTo(12, -R + 22); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, -R + 25); ctx.lineTo(12, -R + 25); ctx.lineTo(16, -R + 32); ctx.lineTo(-16, -R + 32); ctx.fill();
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
    // FLC: a cyan bug on the tape's right edge at the reference speed
    // (at the tape's end when the speed is off it).
    if (s.afcs.vert === 'FLC') {
      const yb = Math.min(bot - 8, Math.max(top + 8, yOf(s.afcs.ref.ias)));
      ctx.fillStyle = C.cyan;
      ctx.fillRect(x + w - 9, yb - 16, 9, 32);
    }
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
    // Below 20 KIAS the readout shows dashes.
    text(ctx, s.ias < 20 ? '---' : String(Math.round(s.ias)), x + w - 22, cy + 1, { size: 32, align: 'right', color });
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
    // Altitude trend: a magenta line from the pointer to where the
    // altitude will be in 6 seconds at the present vertical speed.
    const trend = s.vs / 10;
    if (Math.abs(trend) > 10) {
      ctx.fillStyle = C.magenta;
      ctx.fillRect(x + 1, Math.min(cy, yOf(alt + trend)), 5, Math.abs(trend * ppf));
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
    // The last two digits roll in 20 ft steps.
    text(ctx, String(Math.round(alt / 20) * 20), x + w - 8, cy + 1, { size: 30, align: 'right' });
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
    text(ctx, s.baroStd ? 'STD BARO' : baroText, x + w / 2, bot + 15,
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
    // The notch on the right edge at 0 ft/min (POH 7-20).
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.moveTo(x + w, cy - 9); ctx.lineTo(x + w - 12, cy); ctx.lineTo(x + w, cy + 9); ctx.fill();
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
    // A mode lost for lack of guidance flashes yellow in its slot, then
    // the default mode shows in green.
    const lost = a.lost && s.t - a.lost.at < 10 ? a.lost : null;
    if (lost?.axis === 'lat') {
      if (Math.floor(s.t * 2) % 2 === 0) text(ctx, latName(lost.mode), x0 + 45, y + 1, { size: 21, align: 'center', color: C.yellow });
    } else slot(latName(a.lat), x0 + 45, C.green, 'lat');
    slot(latName(a.latArmed), x0 + 125, C.white, 'latArmed');
    // CWS held: CWS in white where AP shows.
    if (a.ap && a.cws) text(ctx, 'CWS', x0 + 200, y + 1, { size: 21, align: 'center', color: C.white });
    else if (a.ap) text(ctx, 'AP', x0 + 200, y + 1, { size: 21, align: 'center', color: C.green });
    else if (a.apAbnormal) {
      // Not the pilot's disconnect: red and white until acknowledged.
      text(ctx, 'AP', x0 + 200, y + 1, { size: 21, align: 'center', color: Math.floor(s.t * 2) % 2 ? C.white : C.red });
    } else if (s.t - a.apOffAt < 5 && blinkOn(s, a.apOffAt + 5)) {
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
      // Right of the roll pointer, which stays at top centre.
      const bx = ATT.x + 22 + i * 110;
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
    // Bearing pointers (PFD Opt, Bearing 1 and 2), cyan, under the
    // course pointer: BRG1 a single line, BRG2 a double one.
    [0, 1].forEach((i) => {
      const b = G.bearingTo(s.brg[i]);
      if (!b) return;
      ctx.save(); ctx.rotate(rad(b.brg));
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
      const offs = i ? [-4, 4] : [0];
      ctx.beginPath();
      for (const o of offs) { ctx.moveTo(o, -R + 22); ctx.lineTo(o, -R + 62); ctx.moveTo(o, R - 52); ctx.lineTo(o, R - 6); }
      // Head at the station's end, tail feathers at the other.
      ctx.moveTo(-12, -R + 36); ctx.lineTo(0, -R + 14); ctx.lineTo(12, -R + 36);
      ctx.moveTo(-12, R - 8); ctx.lineTo(0, R - 22); ctx.lineTo(12, R - 8);
      ctx.stroke();
      ctx.restore();
    });
    // Current track: a magenta diamond on the rose (off the lubber line
    // by the drift).
    ctx.save(); ctx.rotate(rad(G.toMag(G.track())));
    ctx.fillStyle = C.magenta;
    ctx.beginPath(); ctx.moveTo(0, -R + 2); ctx.lineTo(6, -R + 10); ctx.lineTo(0, -R + 18); ctx.lineTo(-6, -R + 10); ctx.closePath(); ctx.fill();
    ctx.restore();
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
    // Fixed reference marks every 45° round the card (the POH).
    ctx.strokeStyle = C.white; ctx.lineWidth = 3;
    for (let a = 45; a < 360; a += 45) {
      ctx.save(); ctx.rotate(rad(a));
      ctx.beginPath(); ctx.moveTo(0, -R - 5); ctx.lineTo(0, -R - 17); ctx.stroke();
      ctx.restore();
    }
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
    // No VOR signal: no flag (POH 4-16); the missing deviation bar is the
    // warning.
    // GPS integrity lost: LOI, amber, and no deviation.
    if (s.cdi === 'GPS' && s.sys.failed.gps) text(ctx, 'LOI', 0, 40, { size: 22, align: 'center', color: C.yellow });
    // GPS past full scale: the cross-track error.
    else if (s.cdi === 'GPS' && nav && Math.abs(nav.xtk) > nav.full) {
      text(ctx, `XTK ${Math.abs(nav.xtk).toFixed(2)}NM`, 0, 40, { size: 18, align: 'center', color: srcColor });
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
  }

  // ---- Beside the HSI: the wind, DME and bearing windows ----
  // Left of the rose (right of any inset map), and BRG2 right of it.
  const SIDE = { x: 306, w: 78 };
  function sideBox(ctx, y, h, x = SIDE.x) {
    box(ctx, x, y, SIDE.w, h, { fill: C.black, stroke: C.grey });
  }
  // PFD Opt, Wind: Option 1 head/tailwind and crosswind components with
  // arrows; Option 2 an arrow (relative to the nose) and the speed;
  // Option 3 the arrow, direction (magnetic) and speed. No wind data on
  // the ground (under 30 kt).
  function windWindow(ctx, s, G) {
    if (s.windShow === 'Off') return;
    const y = 548, h = 64, x = SIDE.x, w = SIDE.w;
    sideBox(ctx, y, h);
    if (G.tas() < 30) { text(ctx, 'NO WIND', x + w / 2, y + 22, { size: 13, align: 'center' }); text(ctx, 'DATA', x + w / 2, y + 42, { size: 13, align: 'center' }); return; }
    const wi = G.windInfo(), calm = wi.spd < 1;
    const arrow = (ax, ay, len, ang) => {
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(rad(ang));
      ctx.strokeStyle = C.white; ctx.fillStyle = C.white; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -len / 2); ctx.lineTo(0, len / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, len / 2 + 2); ctx.lineTo(-5, len / 2 - 7); ctx.lineTo(5, len / 2 - 7); ctx.fill();
      ctx.restore();
    };
    if (s.windShow === '1') {
      // Arrows the way each component blows: down for a headwind.
      if (!calm) arrow(x + 14, y + 22, 20, wi.head >= 0 ? 0 : 180);
      text(ctx, String(Math.round(Math.abs(wi.head))), x + 28, y + 22, { size: 18 });
      if (!calm) arrow(x + 14, y + 46, 20, wi.cross >= 0 ? 90 : -90);
      text(ctx, String(Math.round(Math.abs(wi.cross))), x + 28, y + 46, { size: 18 });
      return;
    }
    // The arrow points the way the wind blows, the nose being up.
    if (!calm) arrow(x + 18, y + h / 2, 34, wi.rel);
    if (s.windShow === '2') text(ctx, `${Math.round(wi.spd)}KT`, x + w - 6, y + h / 2, { size: 17, align: 'right' });
    else {
      text(ctx, calm ? 'CALM' : `${pad3(wi.dir)}°`, x + w - 6, y + 20, { size: 16, align: 'right' });
      text(ctx, `${Math.round(wi.spd)}KT`, x + w - 6, y + 44, { size: 16, align: 'right' });
    }
  }
  // PFD Opt, DME: its tuning, frequency and slant range.
  function dmeWindow(ctx, s, G) {
    if (!s.dme.on) return;
    const y = 618, x = SIDE.x, d = G.dmeInfo();
    sideBox(ctx, y, 82);
    text(ctx, 'DME', x + 5, y + 14, { size: 12, color: C.grey });
    text(ctx, s.dme.src, x + SIDE.w - 5, y + 14, { size: 12, align: 'right', color: C.green });
    text(ctx, d.freq.toFixed(2), x + 6, y + 38, { size: 17, color: C.green });
    text(ctx, d.dist != null ? `${d.dist.toFixed(1)}NM` : '-.--NM', x + 6, y + 62, { size: 17 });
  }
  // A bearing pointer's information: distance, the station, the source.
  function bearingWindows(ctx, s, G) {
    [0, 1].forEach((i) => {
      const src = s.brg[i];
      if (!src) return;
      const x = i ? 642 : SIDE.x, y = 710, b = G.bearingTo(src);
      sideBox(ctx, y, 66, x);
      text(ctx, b ? `${b.dist.toFixed(1)}NM` : '', x + 6, y + 14, { size: 15 });
      text(ctx, b ? b.id : 'NO DATA', x + 6, y + 34, { size: 15, color: C.cyan });
      text(ctx, src, x + 6, y + 54, { size: 14, color: C.cyan });
      text(ctx, i ? '═' : '─', x + SIDE.w - 8, y + 54, { size: 16, align: 'right', color: C.cyan });
    });
  }

  function bottomBoxes(ctx, s, G) {
    const y = H - 34 - 40;
    // Outside air temperature (G.oat: the standard lapse and the day's
    // deviation). (Reversionary mode shows it in the engine strip instead.)
    const oat = Math.round(G.oat());
    if (!s.reversion) {
      box(ctx, 0, y, 150, 38, { fill: C.black, stroke: C.grey });
      text(ctx, `OAT ${oat}°C`, 10, y + 19, { size: 20 });
    }
    // Transponder: code, mode, ident.
    const x = s.xpdr;
    box(ctx, W - 400, y, 250, 38, { fill: C.black, stroke: C.grey });
    const ident = s.t < x.identUntil;
    const code = x.entry !== null ? (x.entry + '____').slice(0, 4) : x.code;
    const modeColor = x.mode === 'STBY' ? C.white : C.green;
    text(ctx, 'XPDR', W - 390, y + 19, { size: 20 });
    text(ctx, code, W - 320, y + 19, { size: 22, color: x.entry !== null ? C.cyan : modeColor });
    text(ctx, ident ? 'IDNT' : x.mode, W - 250, y + 19, { size: 22, color: modeColor });
    // R: replying to an interrogation (a radar sweep every 4.8 s, made up).
    if (x.mode !== 'STBY' && s.t % 4.8 < 0.6) text(ctx, 'R', W - 196, y + 19, { size: 18, color: C.green });
    const d = new Date(s.t * 1000 + Date.UTC(2026, 0, 1, 17, 0, 0));
    // The time of day, in its own box right of the transponder.
    box(ctx, W - 148, y, 148, 38, { fill: C.black, stroke: C.grey });
    const two = (n) => String(n).padStart(2, '0');
    text(ctx, `UTC ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`, W - 74, y + 19, { size: 18, align: 'center' });
  }

  // Reversionary mode (DISPLAY BACKUP): the PFD with the engine strip down
  // its left side, on both displays. The PFD is drawn whole off screen,
  // then its middle (between the radios and the softkeys) put right of the
  // strip: all but its left 140 px (empty but for the OAT box, which moves
  // to the strip, and part of any inset map), squeezed 7% across.
  let revCanvas = null;
  function reversionary(ctx, s, G) {
    revCanvas ??= Object.assign(document.createElement('canvas'), { width: W, height: H });
    const off = revCanvas.getContext('2d');
    drawPFD(off, s, G, true);
    const top = 70, bottom = H - 34, strip = 200;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(revCanvas, 0, 0, W, top, 0, 0, W, top);
    const crop = 140;
    ctx.drawImage(revCanvas, crop, top, W - crop, bottom - top, strip, top, W - strip, bottom - top);
    ctx.drawImage(revCanvas, 0, bottom, W, H - bottom, 0, bottom, W, H - bottom);
    eis(ctx, s, G);
    text(ctx, `OAT ${Math.round(G.oat())}°C`, 12, 688, { size: 18 });
    text(ctx, 'REVERSIONARY', strip / 2, bottom - 14, { size: 13, align: 'center', color: C.yellow });
  }

  function drawPFD(ctx, s, G, whole = false) {
    helpFor = 'pfd'; helpLines.pfd = [];
    if (s.reversion && !whole) return reversionary(ctx, s, G);
    ctx.clearRect(0, 0, W, H);
    attitude(ctx, s);
    aircraftSymbol(ctx, s);
    airspeedTape(ctx, s, G);
    altitudeTape(ctx, s, G);
    vsi(ctx, s);
    annunciationWindow(ctx, s);
    hsi(ctx, s, G);
    if (s.pfdMap.layout === 'Inset Map') insetMap(ctx, s, G);
    windWindow(ctx, s, G);
    dmeWindow(ctx, s, G);
    bearingWindows(ctx, s, G);
    bottomBoxes(ctx, s, G);
    radios(ctx, s, G);
    navStatus(ctx, s, G);
    fma(ctx, s, G);
    fmsWindow(ctx, s, G, 'pfd');
    pageMenuWindow(ctx, s, G, 'pfd');
    softkeys(ctx, s, G, 'pfd');
    last.pfd = { t: s.t, ias: s.ias, trend: last.pfd?.trend };
  }

  // ---- MFD: engine strip (EIS) on the left, the navigation map ----
  // The C172S POH, section 7 ("Engine Instruments", "Fuel Indicating
  // System", "Electrical System Monitoring"), describes the strip: the
  // tachometer at the top and the bus volts and battery amps at the bottom
  // of every page; between them the ENGINE page's indicators (pointers
  // only, no numbers), the LEAN page's cylinders, or the SYSTEM page's
  // numbers. Ranges and bands are the POH's.
  const EIS = { x: 12, w: 176 };
  // Flashes at 1 Hz (an exceedance's label and value).
  const flash1 = (s) => Math.floor(s.t * 2) % 2 === 0;

  // A horizontal indicator: its label, a scale with coloured bands and
  // ticks, and a white pointer above it (an inverted triangle, `mark` in
  // it: the EGT's hottest cylinder). color: the label's and pointer's
  // (red or amber outside the limits).
  function indicator(ctx, { label, value, lo, hi, zones = [], ticks = [], y, color = C.white, mark }) {
    const { x, w } = EIS, by = y + 24;
    const px = (v) => x + Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * w;
    text(ctx, label, x + w / 2, y, { size: 15, align: 'center', color });
    ctx.fillStyle = '#4a4e55';
    ctx.fillRect(x, by, w, 6);
    for (const [a, b, c] of zones) { ctx.fillStyle = c; ctx.fillRect(px(a), by, Math.max(2, px(b) - px(a)), 6); }
    ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
    for (const t of ticks) { ctx.beginPath(); ctx.moveTo(px(t), by + 6); ctx.lineTo(px(t), by + 11); ctx.stroke(); }
    if (value == null) return;
    const p = px(value), big = mark != null;
    ctx.fillStyle = color === C.white ? C.white : color;
    ctx.beginPath(); ctx.moveTo(p, by + 2); ctx.lineTo(p - (big ? 9 : 7), by - (big ? 17 : 12)); ctx.lineTo(p + (big ? 9 : 7), by - (big ? 17 : 12)); ctx.fill();
    if (big) text(ctx, String(mark), p, by - 11, { size: 11, align: 'center', color: C.black });
  }

  // FUEL QTY GAL: one scale, the left tank's pointer above it (L) and the
  // right's below (R). Red line at 0 (1.5 gal unusable left), yellow 0-5,
  // green 5-24: the sensors read no higher than 24 gal, so a fuller tank
  // still shows 24. Under 5 gal a pointer and the label turn amber; at
  // empty, flashing red.
  const FUEL_SENSOR_MAX = 24;
  function fuelQty(ctx, s, y) {
    const { x, w } = EIS, lo = 0, hi = 25, by = y + 30;
    const px = (v) => x + 6 + (Math.max(lo, Math.min(FUEL_SENSOR_MAX, v)) / hi) * (w - 12);
    const colorOf = (g) => (g <= 0.05 ? (flash1(s) ? C.red : C.black) : g < 5 ? C.yellow : C.white);
    const worst = Math.min(s.fuelL, s.fuelR);
    const labelColor = worst <= 0.05 ? (flash1(s) ? C.red : C.white) : worst < 5 ? C.yellow : C.white;
    text(ctx, 'FUEL QTY GAL', x + w / 2, y, { size: 15, align: 'center', color: labelColor });
    ctx.fillStyle = '#4a4e55'; ctx.fillRect(px(0), by, px(FUEL_SENSOR_MAX) - px(0), 6);
    ctx.fillStyle = C.yellow; ctx.fillRect(px(0), by, px(5) - px(0), 6);
    ctx.fillStyle = C.green; ctx.fillRect(px(5), by, px(FUEL_SENSOR_MAX) - px(5), 6);
    ctx.fillStyle = C.red; ctx.fillRect(px(0) - 2, by - 4, 4, 14);
    [['0', 0], ['10', 10], ['20', 20], ['F', FUEL_SENSOR_MAX]].forEach(([t, v]) => text(ctx, t, px(v), by + 34, { size: 12, align: 'center', color: C.grey }));
    // L above, pointing down; R below, pointing up.
    [[s.fuelL, 'L', -1], [s.fuelR, 'R', 1]].forEach(([g, tag, side]) => {
      const p = px(g), tip = side < 0 ? by - 1 : by + 7, base = tip + side * 17;
      ctx.fillStyle = colorOf(g);
      ctx.beginPath(); ctx.moveTo(p, tip); ctx.lineTo(p - 9, base); ctx.lineTo(p + 9, base); ctx.fill();
      text(ctx, tag, p, base - side * 6, { size: 10, align: 'center', color: C.black });
    });
  }

  // The tachometer, on every page: 0-3000 RPM round a dial, green from
  // 2100 to the altitude's top of the normal range (2500 to 5,000 ft, 2600
  // to 10,000 ft, 2700 above), red 2700-3000. From 2780 RPM the pointer,
  // value and label turn red, and the value and label flash.
  function tach(ctx, s) {
    const rpm = s.sys.rpm, alt = s.trueAlt;
    const greenTop = alt < 5000 ? 2500 : alt < 10000 ? 2600 : 2700;
    const over = rpm >= 2780, on = !over || flash1(s);
    ctx.save();
    ctx.translate(100, 160);
    const ang = (v) => rad(150 + (Math.max(0, Math.min(3000, v)) / 3000) * 240);
    const arc = (a, b, color, lw = 10) => {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, 62, ang(a), ang(b)); ctx.stroke();
    };
    arc(0, 3000, '#4a4e55');
    arc(2100, greenTop, C.green);
    arc(2700, 3000, C.red);
    ctx.strokeStyle = over ? C.red : C.white; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang(rpm)) * 60, Math.sin(ang(rpm)) * 60); ctx.stroke();
    ctx.restore();
    if (on) {
      text(ctx, String(Math.round(rpm / 10) * 10), 100, 200, { size: 24, align: 'center', color: over ? C.red : C.white });
      text(ctx, 'RPM', 100, 224, { size: 16, align: 'center', color: over ? C.red : C.white });
    }
  }

  // The bottom of every page: bus volts (M BUS E: main under M, essential
  // under E) and battery amps (M BATT S: main, standby). VOLTS and the
  // value turn red outside 24.5-32.0 V. Amps: a discharging standby
  // battery amber, the main one amber below -1.5 A.
  function busBatt(ctx, s) {
    const { x, w } = EIS, sys = s.sys, y = 712;
    const vBad = (v) => v < 24.5 || v > 32;
    const signed = (a) => (a >= 0 ? '+' : '') + a.toFixed(1);
    const row = (ty, l, m, r, cl, cm, cr, size) => {
      text(ctx, l, x, ty, { size, color: cl });
      text(ctx, m, x + w / 2, ty, { size: 13, align: 'center', color: cm });
      text(ctx, r, x + w, ty, { size, align: 'right', color: cr });
    };
    row(y, 'M', 'BUS', 'E', C.white, C.white, C.white, 14);
    row(y + 22, sys.voltsM.toFixed(1), 'VOLTS', sys.voltsE.toFixed(1), vBad(sys.voltsM) ? C.red : C.white,
      vBad(sys.voltsM) || vBad(sys.voltsE) ? C.red : C.white, vBad(sys.voltsE) ? C.red : C.white, 17);
    row(y + 50, 'M', 'BATT', 'S', C.white, C.white, C.white, 14);
    row(y + 72, signed(sys.ampsM), 'AMPS', signed(sys.ampsS), sys.ampsM < -1.5 ? C.yellow : C.white, C.white,
      sys.ampsS < 0 ? C.yellow : C.white, 17);
  }

  // A number and its label on one line (the LEAN and SYSTEM pages).
  function readout(ctx, label, value, y, color = C.white) {
    text(ctx, label, EIS.x, y, { size: 15, color });
    text(ctx, value, EIS.x + EIS.w, y, { size: 18, align: 'right', color });
  }
  // Out of limits: oil pressure 0-20 or 115-120 PSI red, oil temperature
  // red (and flashing) from 245 °F.
  const oilPsiColor = (p) => (p <= 20 || p >= 115 ? C.red : C.white);
  const oilTempColor = (s, f) => (f >= 245 ? (flash1(s) ? C.red : C.black) : C.white);

  function eis(ctx, s, G) {
    box(ctx, 0, 70, 200, H - 104, { fill: C.panel, stroke: null });
    // The numbers come from js/g1000-systems.js.
    const sys = s.sys, { x, w } = EIS;
    const ff = G.fuelFlow();
    const hottest = sys.egt.indexOf(Math.max(...sys.egt));
    tach(ctx, s);
    busBatt(ctx, s);
    if (s.eisPage === 'Lean') {
      // EGT (bars, 1250-1650 °F) and CHT (a bar across, 100-500 °F) for
      // the four cylinders. The one shown (the hottest, or Cyl Slct's for a
      // while) is cyan, with its EGT and CHT below. Lean assist: PEAK °F,
      // the shown cylinder's EGT less its peak (0 at peak, negative either
      // side); the first to peak gets a hollow bar at its peak.
      const L = sys.lean, c = G.systems.leanCyl();
      const hotCht = sys.cht.indexOf(Math.max(...sys.cht));
      readout(ctx, 'FFLOW GPH', ff.toFixed(1), 260);
      const base = 460, top = 300, span = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * (base - top);
      for (let k = 0; k < 4; k++) {
        const cx = x + k * 44 + 8, sel = k === c, peaked = L.assist && L.peaked === k;
        ctx.fillStyle = sel ? C.cyan : C.white;
        const h = span(sys.egt[k], 1250, 1650);
        ctx.fillRect(cx, base - h, 26, h);
        if (peaked) {
          const hp = Math.max(h + 6, span(L.max[k], 1250, 1650));
          ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, base - hp, 24, hp - h);
        }
        const ch = span(sys.cht[k], 100, 500);
        ctx.fillStyle = sys.cht[k] >= 500 ? C.red : k === hotCht ? C.cyan : C.green;
        ctx.fillRect(cx - 3, base - ch - 2, 32, 4);
        text(ctx, String(k + 1), cx + 13, base + 14, { size: 15, align: 'center', color: sel ? C.cyan : C.white });
      }
      readout(ctx, `EGT ${c + 1} °F`, String(Math.round(sys.egt[c])), 500, C.cyan);
      readout(ctx, `CHT ${c + 1} °F`, String(Math.round(sys.cht[c])), 526, sys.cht[c] >= 500 ? C.red : C.cyan);
      if (L.assist) {
        const peak = L.max[c];
        readout(ctx, 'PEAK °F', L.peaked == null ? '---' : String(Math.round(sys.egt[c] - peak)), 552);
      }
      fuelQty(ctx, s, 600);
      return;
    }
    if (s.eisPage === 'System') {
      // The numbers behind the ENGINE page's indicators, the fuel
      // totalizer (Rst Fuel, Dec Fuel, Inc Fuel, Rst Used) and engine
      // hours.
      readout(ctx, 'FFLOW GPH', ff.toFixed(1), 262);
      readout(ctx, 'OIL PSI', sys.oilPsi.toFixed(0), 288, oilPsiColor(sys.oilPsi));
      readout(ctx, 'OIL °F', sys.oilF.toFixed(0), 314, oilTempColor(s, sys.oilF));
      readout(ctx, 'EGT °F', Math.round(sys.egt[hottest]).toString(), 340);
      readout(ctx, 'VAC IN HG', sys.vac.toFixed(1), 366);
      fuelQty(ctx, s, 400);
      readout(ctx, 'GAL USED', sys.tot.used.toFixed(1), 494);
      readout(ctx, 'GAL REM', sys.tot.rem.toFixed(1), 520);
      readout(ctx, 'ENG HRS', sys.engHrs.toFixed(1), 560);
      return;
    }
    // ENGINE page: pointers only (the SYSTEM page has the numbers).
    const even = (lo, hi, step) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
    indicator(ctx, { label: 'FFLOW GPH', value: ff, lo: 0, hi: 20, zones: [[0, 12, C.green]], ticks: even(0, 20, 2), y: 256 });
    indicator(ctx, { label: 'OIL PRES', value: sys.oilPsi, lo: 0, hi: 120, y: 306, color: oilPsiColor(sys.oilPsi),
      zones: [[0, 20, C.red], [50, 90, C.green], [115, 120, C.red]] });
    indicator(ctx, { label: 'OIL TEMP', value: sys.oilF, lo: 75, hi: 250, y: 356, color: oilTempColor(s, sys.oilF),
      zones: [[100, 245, C.green], [245, 250, C.red]] });
    indicator(ctx, { label: 'EGT', value: sys.egt[hottest], lo: 1250, hi: 1650, ticks: even(1250, 1650, 50), y: 408, mark: hottest + 1 });
    indicator(ctx, { label: 'VAC', value: sys.vac, lo: 3, hi: 7, zones: [[4.5, 5.5, C.green]], y: 460 });
    fuelQty(ctx, s, 512);
  }

  // ---- Moving maps: the MFD's Navigation Map, the PFD's inset and HSI
  // maps. One drawing, by a view: the area (a rectangle, or a circle for
  // the HSI map), where own ship sits, the range and the orientation. What
  // shows follows Map Setup (s.mapSet) on all three. ----
  // Airspace: Class B blue, C magenta, D blue dashed, as on the charts.
  const AIRSPACE = { B: { color: '#3a8bff', dash: [] }, C: { color: C.magenta, dash: [] }, D: { color: '#3a8bff', dash: [10, 7] } };
  // An airport's longest hard-surfaced (asphalt or concrete) runway, or
  // null for a soft field.
  const HARD = /ASPH|CONC|BIT|PEM/;
  const longestHard = (ap) => (ap.runways ?? []).filter((r) => HARD.test(r.surface ?? ''))
    .sort((a, b) => (b.len ?? 0) - (a.len ?? 0))[0] ?? null;

  function drawMap(ctx, s, G, v) {
    // v.set: the map's settings (the MFD's Map Setup, or the PFD's).
    // v.up: the true bearing that is up (north, track or heading); v.center:
    // what (ox, oy) is (own ship, or the pan pointer).
    const { range } = v, set = v.set, small = v.small;
    // A map setting that is a range: the symbol shows at that map range or
    // less ('Off': never).
    const shows = (val) => val !== 'Off' && range <= val;
    const up = v.up ?? s.hdg, center = v.center ?? s;
    const { ox, oy, ringR } = v, ppn = ringR / range;
    ctx.save();
    ctx.beginPath();
    if (v.circle) ctx.arc(ox, oy, v.circle, 0, Math.PI * 2); else ctx.rect(v.x0, v.y0, v.w, v.h);
    ctx.clip();
    if (v.fill) { ctx.fillStyle = v.fill; ctx.fill(); }
    const toXY = (p) => {
      const { brg, dist } = G.bearingDist(center, p);
      const a = rad(brg - up);
      return [ox + Math.sin(a) * dist * ppn, oy - Math.cos(a) * dist * ppn];
    };
    // Airspace first, under everything: each shelf's outline.
    const cls = { B: shows(set.clsB), C: shows(set.clsC), D: shows(set.clsD) };
    for (const a of G.AIRSPACE) {
      if (!cls[a.cls]) continue;
      // Skip shelves wholly far away (their first point beyond 3 ranges
      // and 60 NM: no Washington shelf is wider).
      if (G.bearingDist(center, { lat: a.pts[0][0], lon: a.pts[0][1] }).dist > Math.max(3 * range, 60)) continue;
      const st = AIRSPACE[a.cls];
      ctx.strokeStyle = st.color;
      ctx.lineWidth = small ? 1.5 : 2.5;
      ctx.setLineDash(st.dash);
      ctx.beginPath();
      a.pts.forEach(([lat, lon], k) => { const [px, py] = toXY({ lat, lon }); ctx[k ? 'lineTo' : 'moveTo'](px, py); });
      ctx.closePath(); ctx.stroke();
    }
    ctx.setLineDash([]);
    if (set.ring === 'On' && !v.circle && !v.center) {
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
      // A hard-surfaced runway: a line through the ring along the longest
      // one; a soft field is a plain ring. Fuel: four notches outside.
      const rw = longestHard(ap);
      if (rw) {
        const a = rad((rw.ends[0]?.true ?? 0) - up);
        ctx.beginPath();
        ctx.moveTo(px - Math.sin(a) * (ring + 3), py + Math.cos(a) * (ring + 3));
        ctx.lineTo(px + Math.sin(a) * (ring + 3), py - Math.cos(a) * (ring + 3)); ctx.stroke();
      }
      if (ap.fuel) {
        for (let k = 0; k < 4; k++) {
          const a = rad(45 + 90 * k);
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(a) * ring, py + Math.sin(a) * ring);
          ctx.lineTo(px + Math.cos(a) * (ring + 5), py + Math.sin(a) * (ring + 5)); ctx.stroke();
        }
      }
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
    // User waypoints: a small cyan square, shown with the small airports.
    for (const u of shows(set.aptS) ? s.fms.user : []) {
      const [px, py] = toXY(u), r = small ? 4 : 6;
      if (far(px, py)) continue;
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
      ctx.strokeRect(px - r, py - r, 2 * r, 2 * r);
      if (labels) text(ctx, u.id, px + r + 4, py - 10, { size: small ? 13 : 16, color: C.cyan });
    }
    // Own ship: where the map is centred, or (panned) wherever it is.
    const [sx, sy] = v.center ? toXY(s) : [ox, oy];
    // Track vector: a dashed line to where the airplane will be after the
    // set time, at the present track and ground speed.
    if (set.track !== 'Off') {
      const [n, unit] = set.track.split(' '), secs = +n * (unit === 'MIN' ? 60 : 1);
      const len = (G.gs() * secs / 3600) * ppn, a = rad(G.track() - up);
      ctx.strokeStyle = C.white; ctx.lineWidth = small ? 2 : 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.sin(a) * len, sy - Math.cos(a) * len); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Own ship, pointing along the heading (straight up unless north up).
    // The HSI map leaves it to the HSI's own airplane symbol.
    if (!v.circle) {
      ctx.save();
      ctx.translate(sx, sy);
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
    const { x: x0, y: y0, w, h } = PAGE;
    box(ctx, x0, y0, w, h, { fill: '#0a1a10', stroke: null });
    const range = G.RANGES[s.range], northUp = s.mapSet.orient === 'North Up', pan = s.pan;
    // Heading or track up: own ship two thirds down, the range ring above
    // it. North up, or panned: the middle (the pointer, panned).
    const mid = northUp || pan;
    const ox = x0 + w / 2, oy = y0 + h * (mid ? 0.5 : 0.66), ringR = h * (mid ? 0.42 : 0.5);
    drawMap(ctx, s, G, { x0, y0, w, h, ox, oy, ringR, range, up: G.mapUp('mfd'), center: pan ?? null, set: s.mapSet });
    if (s.mapSet.ring === 'On' && !pan) text(ctx, `${range}NM`, ox + ringR * 0.72, oy - ringR * 0.72, { size: 18, color: C.grey });
    // The orientation, top left.
    text(ctx, { 'Heading Up': 'HDG UP', 'Track Up': 'TRK UP', 'North Up': 'NORTH UP' }[s.mapSet.orient], x0 + 10, y0 + 18, { size: 16, color: C.grey });
    if (pan) panInfo(ctx, s, G, { x0, y0, w, h, ox, oy, ppn: ringR / range });
    else hint(ctx, 'Mock map: not for navigation');
  }
  // The pan pointer (an arrow at the map's middle), the measuring line
  // from where measuring started, and a box at the top: what the pointer
  // is on, its bearing and distance from own ship (or from the measure's
  // start), and its position.
  function panInfo(ctx, s, G, { x0, y0, w, ox, oy, ppn }) {
    const p = s.pan, up = G.mapUp('mfd'), at = G.panTarget();
    if (p.measure) {
      const { brg, dist } = G.bearingDist(p, p.measure), a = rad(brg - up);
      ctx.strokeStyle = C.white; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(a) * dist * ppn, oy - Math.cos(a) * dist * ppn); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox + Math.sin(a) * dist * ppn, oy - Math.cos(a) * dist * ppn, 5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = C.white; ctx.strokeStyle = C.black; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 6, oy + 18); ctx.lineTo(ox + 10, oy + 12); ctx.lineTo(ox + 18, oy + 20);
    ctx.lineTo(ox + 20, oy + 18); ctx.lineTo(ox + 12, oy + 10); ctx.lineTo(ox + 18, oy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    const from = p.measure ?? s, { brg, dist } = G.bearingDist(from, p);
    const bx = x0 + w - 330, by = y0 + 40;
    box(ctx, bx, by, 320, 96, { fill: 'rgba(8, 9, 11, 0.9)', stroke: C.grey });
    text(ctx, at ? `${at.id}  ${(at.name ?? '').slice(0, 18)}` : p.measure ? 'MEASURING' : 'PAN', bx + 12, by + 18, { size: 18, color: at ? C.cyan : C.white });
    text(ctx, `${p.measure ? 'FROM START' : 'FROM P.POS'}  ${pad3(G.toMag(brg))}°  ${dist.toFixed(1)}NM`, bx + 12, by + 48, { size: 17 });
    text(ctx, latLon(p.lat, p.lon), bx + 12, by + 76, { size: 15, color: C.grey });
    hint(ctx, 'Arrow keys: move the pointer · ENT: user waypoint here · D→ · CLR or RANGE push: done');
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
    drawMap(ctx, s, G, { x0, y0, w, h, ox, oy, ringR: h * (northUp ? 0.42 : 0.6), range, small: true, up: G.mapUp('pfd'), set });
    text(ctx, `${range}NM`, x0 + w - 8, y0 + 14, { size: 14, align: 'right', color: C.grey });
    text(ctx, { 'Heading Up': 'HDG UP', 'Track Up': 'TRK UP', 'North Up': 'NORTH UP' }[set.orient], x0 + 8, y0 + 14, { size: 13, color: C.grey });
  }

  // The MFD's navigation data, in the top bar between the NAV and COM
  // radios: GS and DTK above, TRK and ETE below.
  function navDataBar(ctx, s, G) {
    // DTK and ETE (to the active waypoint, at the present ground speed)
    // come from the GPS leg; blank without one.
    const nav = G.navSolution('GPS');
    let ete = '__:__';
    if (nav) {
      const mins = (nav.dist / Math.max(G.gs(), 30)) * 60;
      ete = `${Math.floor(mins)}:${String(Math.floor((mins % 1) * 60)).padStart(2, '0')}`;
    }
    // Ground speed and track: the wind's effect included.
    const fields = [['GS', `${Math.round(G.gs())}KT`], ['DTK', nav ? pad3(nav.course) + '°' : '___°'],
      ['TRK', `${pad3(G.toMag(G.track()))}°`], ['ETE', ete]];
    fields.forEach(([k, v], i) => {
      const x = 400 + (i % 2) * 135, y = 20 + Math.floor(i / 2) * 32;
      text(ctx, k, x, y, { size: 16 });
      text(ctx, v, x + 42, y, { size: 19, color: C.magenta });
    });
  }

  function drawMFD(ctx, s, G) {
    helpFor = 'mfd'; helpLines.mfd = [];
    if (s.reversion) return reversionary(ctx, s, G);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    mfdPage(ctx, s, G);
    eis(ctx, s, G);
    radios(ctx, s, G);
    navDataBar(ctx, s, G);
    fmsWindow(ctx, s, G, 'mfd');
    pageMenuWindow(ctx, s, G, 'mfd');
    pageGroups(ctx, s, G);
    softkeys(ctx, s, G, 'mfd');
  }

  return { W, H, drawPFD, drawMFD, help: (display) => helpLines[display] };
})();
