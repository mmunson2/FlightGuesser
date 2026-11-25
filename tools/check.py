"""Check the questions, the names and the model against each other, in the
real page (headless Chrome), and the mock G1000's logic (G1000_CHECKS).

    make check                # errors and warnings; exits 1 on any error
    make check ARGS=--gaps    # also list parts without aliases

Errors: page errors on load; a question whose answer, `also`, `show` or
`focus` names no part or system, or whose `view` is no camera preset; a text question whose own answer fails its keys, or whose `tests`
don't pass or fail as listed; an unknown `source` or `topic`; duplicate
question ids; a target part with no `part.<id>` name; an i18n key the page
uses but en.js lacks; two parts sharing a typed name or alias (the typed
answer would be ambiguous).
Warnings: i18n part/alias keys for parts that don't exist.
"""

import re
import sys

from browser import PHONE, app
from paths import INDEX_HTML, ROOT

CHECKS = r"""() => {
  const D = window.FLIGHT_DEBUG, errors = [], warnings = [], info = [];
  const parts = SCENE_DATA.parts;
  const targets = [...new Set(parts.filter((p) => p.kind === 'target').map((p) => p.id))];
  const systems = new Set(parts.map((p) => p.system));
  const groups = Object.keys(SCENE_DATA.groups);
  const exists = (id) => targets.includes(id) || groups.includes(id);
  const named = [...targets, ...groups];

  // Text questions: keys well formed, the model answer passes its own
  // grader, and the optional `tests` pass or fail as they say.
  function checkText(q, where) {
    if (typeof q.answer !== 'string') errors.push(`${where}: text answer must be the model answer`);
    if (!Array.isArray(q.keys) || !q.keys.length || q.keys.some((k) => !Array.isArray(k) || !k.length
        || k.some((w) => typeof w !== 'string' || !D.GRADE.tokens(w).length)))
      { errors.push(`${where}: keys must be non-empty lists of words`); return; }
    if (q.need && q.need > q.keys.length) errors.push(`${where}: need ${q.need} > ${q.keys.length} keys`);
    if (q.show && !exists(q.show)) errors.push(`${where}: no target part "${q.show}" to show`);
    if (typeof q.answer === 'string' && !D.GRADE.grade(q, q.answer).right)
      errors.push(`${where}: its own answer doesn't pass: ${JSON.stringify(D.GRADE.grade(q, q.answer))}`);
    for (const text of q.tests?.pass ?? [])
      if (!D.GRADE.grade(q, text).right) errors.push(`${where}: test should pass: "${text}"`);
    for (const text of q.tests?.fail ?? [])
      if (D.GRADE.grade(q, text).right) errors.push(`${where}: test should fail: "${text}"`);
  }

  // Questions.
  const seen = new Map();
  for (const cat of CATEGORIES) {
    for (const s of cat.named ?? []) if (!systems.has(s)) errors.push(`category ${cat.id}: named "${s}" is not a system`);
    for (const q of cat.questions) {
      const where = `${cat.id}/${q.id}`;
      if (seen.has(q.id)) errors.push(`${where}: id also used in ${seen.get(q.id)}`);
      seen.set(q.id, cat.id);
      if (q.type === 'text') {
        checkText(q, where);
      } else {
        const answers = q.answers ?? [q.answer];
        for (const id of [...answers, ...(q.also ?? [])])
          if (!exists(id)) errors.push(`${where}: no target part "${id}"`);
      }
      if (q.answer && q.answers) errors.push(`${where}: has both answer and answers`);
      for (const s of [].concat(q.focus ?? []))
        if (!systems.has(s)) errors.push(`${where}: focus "${s}" is not a system`);
      if (q.view && !SCENE_DATA.views[q.view]) errors.push(`${where}: no view "${q.view}"`);
      if (!SOURCES[q.source]) errors.push(`${where}: unknown source "${q.source}"`);
      if (!I18N['quiz.topic.' + q.topic]) errors.push(`${where}: no quiz.topic.${q.topic} in en.js`);
      if (!q.prompt || (!q.explain && q.type !== 'text')) errors.push(`${where}: missing prompt or explain`);
      if (q.type && !['text', 'name'].includes(q.type)) errors.push(`${where}: unknown type "${q.type}"`);
      if (q.url && !/^https:\/\//.test(q.url)) warnings.push(`${where}: url isn't https: ${q.url}`);
    }
  }

  // Names and aliases.
  for (const id of named) if (!I18N['part.' + id]) errors.push(`part "${id}" has no part.${id} in en.js`);
  for (const key of Object.keys(I18N)) {
    const m = key.match(/^(part|alias)\.(.+)$/);
    if (m && !exists(m[2])) warnings.push(`en.js: ${key} names no part`);
  }
  const owner = new Map();
  for (const id of named) {
    const names = [I18N['part.' + id] ?? id, ...(I18N['alias.' + id]?.split('|') ?? [])];
    for (const name of names) {
      const key = D.nameKey(name);
      if (!key) errors.push(`"${name}" (${id}) types as nothing`);
      if (owner.has(key) && owner.get(key).id !== id)
        errors.push(`"${name}" (${id}) and "${owner.get(key).name}" (${owner.get(key).id}) type the same`);
      owner.set(key, { id, name });
      if (!D.nameMatches(name, id)) errors.push(`typing "${name}" doesn't name ${id}`);
    }
  }

  // Keys the page builds from data.
  const need = [
    ...SCENE_DATA.systems.map((s) => 'system.' + s),
    ...['aircraft', 'diagram'].map((s) => 'scene.' + s),
    ...Object.keys(SCENE_DATA.views).map((v) => 'view.' + v),
    ...CATEGORIES.flatMap((c) => ['category.' + c.id, 'category.' + c.id + '.tip']),
    ...D.askable.map(D.namePromptKey),
  ];
  for (const key of new Set(need)) if (!(key in I18N)) errors.push(`no ${key} in en.js`);

  // Coverage, for --gaps.
  const noAlias = named.filter((id) => !I18N['alias.' + id]);
  info.push(`${noAlias.length} parts without aliases: ${noAlias.join(', ')}`);
  info.push(`parts "name it" asks: ${D.askable.length}`);
  const counts = CATEGORIES.map((c) => `${c.id} ${c.questions.length}`).join(', ')
    + `; rote ${CATEGORIES.flatMap((c) => c.questions).filter((q) => q.rote).length}`;
  const summary = `${targets.length} target parts, ${parts.length} meshes; questions: ${counts}`;
  return { errors, warnings, info, summary };
}"""


def static_keys():
    """i18n keys named literally in the pages and their scripts."""
    html = "".join((ROOT / name).read_text() for name in ("index.html", "cards.html", "test.html"))
    js = "".join((ROOT / "js" / name).read_text() for name in ("viewer.js", "cards.js", "test.js"))
    keys = set(re.findall(r'data-t(?:-[a-z-]+)?="([^"]+)"', html))
    keys |= set(re.findall(r"\bt\('([^'{}+]+)'[,)]", js))
    return keys


def choose(page, name, value):
    page.click(f'input[name={name}][value="{value}"] + span')


def play(page):
    """Smoke test through the UI: a few questions in every category with
    any (name questions answered by typing the part's name, from the panel
    view), and none can start empty; the diagram view shows the diagram and
    is locked during a quiz. Page errors land in page.errors; returns
    problems the UI shows."""
    problems = []
    # Stop drawing: Playwright waits for animation frames before each click,
    # and every frame is a slow software render.
    page.evaluate("FLIGHT_DEBUG.renderer.setAnimationLoop(null)")
    problems += play_diagram(page)
    page.click("#new-quiz")
    cats = page.evaluate("CATEGORIES.map((c) => c.id)") + ["rote", "focused"]
    for cat in cats:
        choose(page, "category", cat)
        if page.is_disabled("#start-go"):
            continue
        choose(page, "count", 0)
        page.click("#start-go")
        if not page.is_disabled('input[name=scene][value="diagram"]'):
            problems.append(f"{cat}: the diagram toggle isn't locked during a quiz")
        for _ in range(6):
            prompt = page.inner_text("#quiz-prompt")
            q = page.evaluate("(({ type, answer }) => ({ type, answer }))(FLIGHT_DEBUG.question())")
            if q["type"] == "name":
                page.fill("#quiz-guess", page.evaluate("(id) => I18N['part.' + id]", q["answer"]))
                page.press("#quiz-guess", "Enter")
                if "Correct" not in page.inner_text("#quiz-verdict"):
                    problems.append(f"{cat}: typing the name of {q['answer']} graded {page.inner_text('#quiz-verdict')!r}")
            else:
                page.click("#quiz-reveal")
            if not prompt or not page.inner_text("#quiz-verdict"):
                problems.append(f"{cat}: empty prompt or verdict")
            if page.inner_text("#quiz-next") == "Finish":
                break
            page.click("#quiz-next")
        page.click("#quiz-quit")
        page.click("#new-quiz")
    for cat in page.evaluate("CATEGORIES.filter((c) => !c.questions.length && !c.named).map((c) => c.id)"):
        choose(page, "category", cat)
        if not page.is_disabled("#start-go"):
            problems.append(f"{cat}: an empty category can start")
    problems += play_focused(page, "g1000")
    return problems


def play_diagram(page):
    """The KPAE diagram: shown and fitted by the toggle, the 3D view's
    camera buttons and systems hidden meanwhile, and back again."""
    problems = []
    page.click("#start-explore")
    page.click('input[name=scene][value="diagram"] + span')
    page.wait_for_function("DIAGRAM.state().loaded")
    page.evaluate("DIAGRAM.fit()")
    st = page.evaluate("DIAGRAM.state()")
    if page.is_hidden("#diagram") or not st["scale"] or page.is_visible("#views"):
        problems.append(f"diagram: not shown, fitted, or the camera buttons still show ({st})")
    page.click('input[name=scene][value="aircraft"] + span')
    if page.is_visible("#diagram") or page.is_hidden("#views"):
        problems.append("diagram: switching back to the aircraft didn't hide it")
    return problems


def play_focused(page, cat):
    """Focus one question, then the Focused category must ask just it."""
    problems = []
    page.evaluate("localStorage.removeItem('flightguesser.focused')")
    choose(page, "category", cat)
    page.click("#start-go")
    prompt = page.inner_text("#quiz-prompt")
    page.click("#quiz-focus")
    if page.get_attribute("#quiz-focus", "aria-pressed") != "true":
        problems.append("focus: button didn't toggle on")
    page.click("#quiz-quit")
    page.click("#new-quiz")
    choose(page, "category", "focused")
    page.click("#start-go")
    if page.inner_text("#quiz-prompt") != prompt or page.text_content("#quiz-progress") != "Question 1 of 1":
        problems.append(f"focus: Focused asked {page.inner_text('#quiz-prompt')!r}, not {prompt!r}")
    page.click("#quiz-focus")
    page.click("#quiz-quit")
    page.click("#new-quiz")
    if not page.is_disabled("#start-go"):
        problems.append("focus: Focused can start with nothing focused")
    return problems


def play_cards(browser):
    """index.html on a phone: it must go to the notecards (cards.html)
    without fetching the 3D scenes, which offer only typed questions that
    need no highlighted part, and play through them."""
    problems = []
    context = browser.new_context(**PHONE)
    page = context.new_page()
    fetched = []
    page.on("request", lambda r: fetched.append(r.url))
    page.on("pageerror", lambda e: problems.append(f"cards: page error: {e}"))
    page.goto(INDEX_HTML.as_uri())
    page.wait_for_url("**/cards.html")
    page.wait_for_function("window.CARDS_DEBUG")
    heavy = [u for u in fetched if u.endswith(("scenedata.js", "textures.js", "three.min.js", "viewer.js", ".png"))]
    if heavy:
        problems.append(f"cards: a phone still fetched {heavy}")
    bad = page.evaluate("CARDS_DEBUG.pool.filter((q) => q.type !== 'text' || q.show).map((q) => q.id)")
    n = page.evaluate("CARDS_DEBUG.pool.length")
    if bad:
        problems.append(f"cards: pool holds questions that need the aircraft: {bad}")
    if not n:
        if not page.is_disabled("#start-go") or "No notecards" not in page.inner_text("#start-counts"):
            problems.append("cards: with no notecards, the start screen doesn't say so")
        context.close()
        return problems
    # Ten cards (or all, if fewer) are enough to exercise the page.
    n = min(n, 10)
    if n == 10:
        page.click('input[name=count][value="10"] + span')
    page.click("#start-go")
    for i in range(n):
        if i == 0:
            page.fill("#quiz-guess", page.evaluate("CARDS_DEBUG.question().answer"))
            page.press("#quiz-guess", "Enter")
            if "Correct" not in page.inner_text("#quiz-verdict"):
                problems.append(f"cards: model answer graded {page.inner_text('#quiz-verdict')!r}")
        else:
            page.click("#quiz-reveal")
            if page.is_visible("#quiz-keys"):
                problems.append("cards: a revealed answer still shows the last answer's keywords")
        if page.evaluate("document.documentElement.scrollWidth > innerWidth"):
            problems.append("cards: the page scrolls sideways on a phone")
        page.click("#quiz-next")
    if f"1 of {n}" not in page.inner_text("#done-score"):
        problems.append(f"cards: done screen says {page.inner_text('#done-score')!r}")
    page.click("#done-again")
    if not page.is_disabled('input[name=which][value="focused"]'):
        problems.append("cards: Focused can be picked with nothing focused")
    context.close()
    return problems


G1000_CHECKS = r"""() => {
  // The mock G1000 (js/g1000.js), driven through its own API with the
  // simulation stepped by hand. Each scenario starts from a reset.
  const G = window.G1000, s = G.state, errors = [];
  const expect = (ok, what) => { if (!ok) errors.push('g1000: ' + what); };
  const run = (secs, until = () => false) => {
    for (let t = 0; t < secs; t += 0.5) { G.tick(0.5); if (until()) return true; }
    return false;
  };
  const a = () => s.afcs;
  const angle = (x, y) => Math.abs(((((x - y) % 360) + 540) % 360) - 180);

  // AP on: FD comes on in ROL and PIT; the FD can't go off under the AP;
  // AP off leaves the FD.
  G.reset();
  G.press('ap');
  expect(a().ap && a().fd && a().lat === 'ROL' && a().vert === 'PIT', `AP on: ${a().lat}/${a().vert}`);
  G.press('fd');
  expect(a().fd, 'FD went off with the AP on');
  G.press('ap');
  expect(!a().ap && a().fd, 'AP off should leave the FD on');

  // HDG: turns to the bug; pressed again, back to ROL.
  G.reset();
  G.press('hdg'); G.press('ap');
  G.turn('hdg', '', 60);
  // (The bug is magnetic, so the magnetic heading must reach it.)
  expect(run(90, () => angle(G.magHeading(), s.hdgBug) < 1 && Math.abs(s.roll) < 1),
    `HDG: magnetic heading ${G.magHeading().toFixed(1)} vs bug ${s.hdgBug}`);
  G.press('hdg');
  expect(a().lat === 'ROL', 'HDG pressed again should give ROL');

  // VS climb with ALTS armed, captured, then ALT at the selected altitude.
  G.reset();
  G.press('ap'); G.press('vs');
  for (let i = 0; i < 5; i++) G.press('nose_up');
  expect(a().vert === 'VS' && a().ref.vs === 500, `VS ref ${a().ref.vs} after 5 NOSE UP`);
  G.turn('alt', 'outer', -1);  // 5,500 -> 4,500
  run(2);
  expect(a().vertArmed === 'ALTS', `ALTS not armed in a climb toward ${s.altSel}: ${a().vertArmed}`);
  expect(run(300, () => a().vert === 'ALT'), `no ALT capture: ${a().vert} at ${s.trueAlt.toFixed(0)} ft`);
  run(30);
  expect(Math.abs(s.trueAlt - 4500) < 30, `holding ${s.trueAlt.toFixed(0)} ft, selected 4,500`);

  // VOR: CDI to VOR1 (PAE), CRS push centres the needle with a TO flag.
  G.reset();
  G.press('softkey:5', 'pfd');
  expect(s.cdi === 'VOR1', `CDI softkey gave ${s.cdi}`);
  G.push('crs_baro');
  let nav = G.navSolution();
  expect(nav && Math.abs(nav.dev) < 0.05 && nav.toFrom === 'TO', `CRS push: ${JSON.stringify(nav && { dev: nav.dev, tf: nav.toFrom })}`);

  // NAV: armed off course, captured on the intercept, then tracks it.
  G.turn('crs_baro', 'inner', 20);
  nav = G.navSolution();
  G.press('nav');
  expect(a().latArmed === 'NAV' && a().lat === 'ROL', `NAV should arm 20° off course: ${a().lat}/${a().latArmed}`);
  s.hdgBug = Math.round((nav.course - 45 * Math.sign(nav.xtk) + 360) % 360);
  G.press('hdg'); G.press('ap');
  expect(run(900, () => a().lat === 'NAV'), `NAV never captured (off ${G.navSolution()?.offDeg.toFixed(1)}°)`);
  run(240);
  nav = G.navSolution();
  expect(nav && Math.abs(nav.dev) < 0.25, `NAV tracking: needle at ${nav && nav.dev.toFixed(2)} of full scale`);

  // Radios: transfer swaps; outer knobs wrap at the band's ends.
  G.reset();
  const stby = s.com[0].stby;
  G.press('com_transfer');
  expect(s.com[0].act === stby, 'COM transfer');
  s.nav[0].stby = 117.95;
  G.turn('nav', 'outer', 1);
  expect(s.nav[0].stby === 108.95, `NAV outer wrap: ${s.nav[0].stby}`);
  G.turn('nav', 'inner', 1);
  expect(s.nav[0].stby === 108.0, `NAV inner wrap: ${s.nav[0].stby}`);

  // Flight plans, entered with the FMS knob as a pilot would: the small
  // knob picks each character from blank, the large knob moves on.
  const CHARS = G1000_FMS.CHARS, f = () => s.fms.fpl;
  const type = (id) => [...id].forEach((c, i) => {
    if (i) G.turn('fms', 'outer', 1, 'pfd');
    G.turn('fms', 'inner', CHARS.indexOf(c) + 1, 'pfd');
  });
  const leg = () => G.fms.leg();

  // Direct-To: KAW completes to KAWO; ENT, ENT activates from here.
  G.reset();
  G.press('direct_to', 'pfd');
  type('KAW');
  expect(G.fms.match(s.fms.win.pfd.ident)?.id === 'KAWO', `D→ typing KAW matched ${s.fms.win.pfd.ident}`);
  G.press('ent', 'pfd'); G.press('ent', 'pfd');
  expect(!s.fms.win.pfd && leg()?.to.id === 'KAWO' && leg().direct, `D→ KAWO not active: ${JSON.stringify(f())}`);
  nav = G.navSolution();
  expect(nav && nav.source === 'GPS' && Math.abs(nav.dev) < 0.05 && nav.scale === 'TERM',
    `D→ GPS solution: ${JSON.stringify(nav && { dev: nav.dev, scale: nav.scale })}`);

  // GPS NAV captures at once on the Direct-To and flies it to KAWO.
  G.press('nav'); G.press('ap');
  expect(a().lat === 'NAV', `GPS NAV should capture on a fresh D→: ${a().lat}/${a().latArmed}`);
  let worst = 0;
  const arrived = run(1200, () => {
    if (s.t > 60) worst = Math.max(worst, Math.abs(G.navSolution().xtk));
    return G.navSolution().dist < 0.3;
  });
  expect(arrived && worst < 0.3, `D→ KAWO: arrived ${arrived}, worst cross-track ${worst.toFixed(2)} NM`);

  // FPL: build KPAE KAWO KBVS; the first leg goes active by itself.
  G.reset();
  G.press('fpl', 'pfd'); G.push('fms', 'pfd');
  for (const id of ['KPAE', 'KAWO', 'KBVS']) { type(id); G.press('ent', 'pfd'); }
  expect(f().wpts.join() === 'KPAE,KAWO,KBVS' && f().active === 1, `FPL built: ${JSON.stringify(f())}`);
  // Insert KPWT before KAWO (row 1): the active leg still ends at KAWO.
  G.turn('fms', 'outer', -2, 'pfd');
  type('KPW'); G.press('ent', 'pfd');
  expect(f().wpts.join() === 'KPAE,KPWT,KAWO,KBVS' && leg().to.id === 'KAWO', `FPL insert: ${JSON.stringify(f())}`);
  // CLR on KPWT asks, ENT removes it.
  G.turn('fms', 'outer', -1, 'pfd');
  G.press('clr', 'pfd');
  expect(s.fms.win.pfd.prompt?.text === 'Remove KPWT?', `CLR prompt: ${s.fms.win.pfd.prompt?.text}`);
  G.press('ent', 'pfd');
  expect(f().wpts.join() === 'KPAE,KAWO,KBVS' && leg().to.id === 'KAWO', `FPL remove: ${JSON.stringify(f())}`);
  // MENU on KBVS: the Page Menu starts on Activate Leg, which asks first.
  G.turn('fms', 'outer', 1, 'pfd');
  G.press('menu', 'pfd');
  const pm = () => s.pageMenu.pfd;
  expect(pm()?.items[pm().cursor].label === 'Activate Leg', `Page Menu opened on ${pm()?.items[pm().cursor]?.label}`);
  G.press('ent', 'pfd');
  expect(pm()?.confirm?.text === 'Activate leg to KBVS?', `Activate Leg asks: ${pm()?.confirm?.text}`);
  G.press('ent', 'pfd');
  expect(!pm() && f().active === 2 && leg().fromId === 'KAWO', `MENU activate leg: ${JSON.stringify(f())}`);

  // Sequencing: D→ KAWO (in the plan), then on to KBVS by itself.
  G.fms.directTo('KAWO');
  G.press('nav'); G.press('ap');
  expect(run(1500, () => !f().dto && f().active === 2), `no sequencing past KAWO: ${JSON.stringify(f())}`);
  expect(leg()?.fromId === 'KAWO' && leg().to.id === 'KBVS', `after KAWO the leg is ${leg()?.fromId} → ${leg()?.to.id}`);

  // The Washington database (data/wa-nav.js, FAA NASR): well formed, and
  // Paine as the Chart Supplement has it.
  const pae = G.fms.byId.KPAE;
  expect(pae && pae.elev === 607 && pae.towered && pae.runways[0].id === '16R/34L' && pae.runways[0].len === 9010,
    `KPAE: ${JSON.stringify(pae && { elev: pae.elev, rwy: pae.runways[0] })}`);
  expect(pae?.freqs.some((f) => f.kind === 'TOWER' && f.freq === 132.95)
    && pae.freqs.some((f) => f.kind === 'ATIS' && f.freq === 128.65), 'KPAE tower or ATIS frequency missing');
  expect(G.AIRPORTS.length > 100 && G.AIRPORTS.every((x) => x.runways.length && x.lat > 45 && x.lat < 49.1
    && x.lon > -125 && x.lon < -116.9), 'an airport without runways, or outside Washington');
  expect(G.AIRPORTS.every((x) => x.freqs.every((f) => f.freq >= 118 && f.freq < 137)), 'a non-VHF COM frequency');
  expect(G.NAVAIDS.length > 10 && G.NAVAIDS.every((v) => v.freq >= 108 && v.freq < 118), 'a VOR outside 108-118 MHz');
  expect(new Set(G.WAYPOINTS.map((w) => w.id)).size === G.WAYPOINTS.length, 'duplicate waypoint identifiers');

  // Magnetic: local variation near Paine from current (2010+) figures;
  // the airplane starts on 340° magnetic; HDG SYNC takes the magnetic
  // heading.
  G.reset();
  expect(s.magVar > 14.5 && s.magVar < 17, `local variation at the start ${s.magVar.toFixed(2)}°E, expected about 16`);
  expect(Math.abs(G.magHeading() - 340) < 0.01, `starting magnetic heading ${G.magHeading().toFixed(2)}`);
  G.push('hdg');
  expect(s.hdgBug === 340, `HDG SYNC gave ${s.hdgBug}`);
  // VOR radials use the station's declared variation (PAE: 20°E, 1990).
  // Due south of the station (true bearing from it 180°), the airplane is
  // on the 160 radial, and CRS push gives 340 TO.
  const paeVor = G.fms.byId.PAE;
  s.lat = paeVor.lat - 0.2; s.lon = paeVor.lon;
  G.press('softkey:5', 'pfd');
  G.push('crs_baro');
  nav = G.navSolution();
  expect(paeVor.magVar === 20 && Math.abs(nav.radial - 160) < 0.5 && s.crs[0] === 340 && nav.toFrom === 'TO',
    `PAE radial ${nav.radial.toFixed(1)} (expected 160), CRS ${s.crs[0]}`);
  // GPS to the same point shows magnetic by the local variation instead:
  // the station's 4° older variation is the difference.
  G.fms.directTo('PAE');
  const gps = G.navSolution('GPS');
  expect(Math.abs(angle(gps.course, 360 - s.magVar)) < 0.5 && Math.abs(angle(gps.course, s.crs[0]) - (20 - s.magVar)) < 0.5,
    `GPS DTK ${gps.course.toFixed(1)} vs VOR course ${s.crs[0]} (local var ${s.magVar.toFixed(1)})`);

  // MFD pages: the large FMS knob steps groups, the small one pages.
  G.reset();
  const P = G.pages, mt = (part, n) => G.turn('fms', part, n, 'mfd');
  mt('outer', 4);
  expect(P.pageKey() === 'NRST:0', `outer +4 from MAP gave ${P.pageKey()}`);
  mt('outer', 1);
  expect(P.pageKey() === 'MAP:0', `groups wrap: ${P.pageKey()}`);
  mt('inner', 1);
  expect(P.pageKey() === 'MAP:1', `inner +1 gave ${P.pageKey()}`);
  mt('outer', 1); mt('outer', -1);
  expect(P.pageKey() === 'MAP:1', `a group keeps its last page: ${P.pageKey()}`);

  // NRST airports: cursor on the nearest, D→ offers it, ENT ENT flies it.
  mt('outer', 4);
  expect(P.pageKey() === 'NRST:0', `back to Nearest Airports (its last page): ${P.pageKey()}`);
  const near = P.nearestAirports();
  expect(near.every((r, i) => !i || near[i - 1].dist <= r.dist), 'Nearest Airports not sorted by distance');
  G.push('fms', 'mfd');
  G.press('direct_to', 'mfd');
  expect(s.fms.win.mfd?.ident === near[0].w.id, `D→ from NRST offered ${s.fms.win.mfd?.ident}, nearest is ${near[0].w.id}`);
  G.press('ent', 'mfd'); G.press('ent', 'mfd');
  expect(leg()?.to.id === near[0].w.id, `D→ from NRST: leg to ${leg()?.to.id}`);

  // NRST VOR: ENT puts the selected station's frequency in NAV standby.
  // (With the cursor out the knobs move it, so CLR first.)
  expect(P.cursorOn(), 'the NRST cursor should stay out after D→');
  mt('inner', 1);
  expect(s.mfd.cursor === 1 && P.pageKey() === 'NRST:0', `inner knob with the cursor out: row ${s.mfd.cursor}, ${P.pageKey()}`);
  G.press('clr', 'mfd');
  mt('inner', 3);
  expect(P.pageKey() === 'NRST:3', `Nearest VOR: ${P.pageKey()}`);
  s.nav[0].stby = 108.0;
  G.push('fms', 'mfd'); G.press('ent', 'mfd');
  expect(s.nav[0].stby === P.nearestVors()[0].w.freq, `NRST VOR ENT: NAV1 standby ${s.nav[0].stby}`);
  G.press('clr', 'mfd');
  expect(!P.cursorOn(), 'CLR should hide the page cursor');

  // WPT Airport Information: push FMS, type over KPAE to KBL(I), ENT.
  const over = (e, id) => [...id].forEach((c, i) => {
    if (i) mt('outer', 1);
    const cur = e().ident[e().pos];
    mt('inner', CHARS.indexOf(c) - (cur ? CHARS.indexOf(cur) : -1));
  });
  mt('outer', -3); mt('inner', -P.GROUPS[1].pages.length);
  expect(P.pageKey() === 'WPT:0', `Airport Information: ${P.pageKey()}`);
  G.push('fms', 'mfd');
  over(() => s.mfd.entry, 'KBL');
  G.press('ent', 'mfd');
  expect(s.mfd.wpt.airport === 'KBLI' && !P.cursorOn(), `WPT entry: ${s.mfd.wpt.airport}`);

  // The MFD's FPL key: to the flight plan page and back.
  G.press('fpl', 'mfd');
  expect(P.pageKey() === 'FPL:0' && s.fms.win.mfd?.type === 'fpl', `FPL key: ${P.pageKey()}`);
  G.press('fpl', 'mfd');
  expect(P.pageKey() === 'WPT:0' && !s.fms.win.mfd, `FPL key again: ${P.pageKey()}`);

  // PFD Nearest softkey: the window, its cursor, D→ to the second nearest.
  G.reset();
  G.press('softkey:10', 'pfd');
  expect(s.fms.win.pfd?.type === 'nrst', 'Nearest softkey opened no window');
  G.push('fms', 'pfd'); G.turn('fms', 'inner', 1, 'pfd');
  G.press('direct_to', 'pfd');
  expect(s.fms.win.pfd?.ident === P.nearestAirports()[1].w.id, `PFD NRST D→ offered ${s.fms.win.pfd?.ident}`);

  // Fuel burns at the fuel flow; Trip Planning's fuel required agrees.
  G.reset();
  const ff = G.fuelFlow(), fuel0 = s.fuel;
  run(600);
  expect(Math.abs(fuel0 - s.fuel - ff / 6) < 0.3, `600 s at ${ff.toFixed(1)} GPH burned ${(fuel0 - s.fuel).toFixed(2)} gal`);
  const tp = P.trip();
  expect(Math.abs(tp.required - tp.ff * tp.hours) < 1e-9 && tp.after === tp.onboard - tp.required, 'Trip Planning fuel');

  // Page Menu: pick an option by its label with the large FMS knob.
  const menuTo = (label, d) => {
    const m = s.pageMenu[d], i = m.items.findIndex((it) => it.label === label);
    G.turn('fms', 'outer', i - m.cursor, d);
    expect(m.items[m.cursor]?.label === label, `Page Menu: no ${label} (${m.items.map((it) => it.label)})`);
  };
  // Active FPL: invert, store, delete; Flight Plan Catalog: activate.
  G.reset();
  G.fms.activatePlan(['KPAE', 'KAWO', 'KBVS']);
  G.press('fpl', 'mfd');
  G.press('menu', 'mfd');
  expect(s.pageMenu.mfd?.items[s.pageMenu.mfd.cursor].label === 'Invert Flight Plan',
    `FPL menu with no cursor should start on Invert: ${s.pageMenu.mfd?.items[s.pageMenu.mfd.cursor]?.label}`);
  G.press('ent', 'mfd'); G.press('ent', 'mfd');
  expect(f().wpts.join() === 'KBVS,KAWO,KPAE' && f().active === 1, `Invert: ${JSON.stringify(f())}`);
  // A grey option says why and leaves the menu open.
  G.press('menu', 'mfd'); menuTo('Parallel Track', 'mfd'); G.press('ent', 'mfd');
  expect(s.pageMenu.mfd && /not in the mock/.test(s.note?.text), `grey option: ${s.note?.text}`);
  const stored = s.fms.catalog.length;
  menuTo('Store Flight Plan', 'mfd'); G.press('ent', 'mfd');
  expect(s.fms.catalog.length === stored + 1 && s.fms.catalog[stored].wpts.join() === 'KBVS,KAWO,KPAE' && !s.pageMenu.mfd,
    `Store: ${JSON.stringify(s.fms.catalog)}`);
  // Delete asks; CLR backs out to the menu, a second CLR closes it.
  G.press('menu', 'mfd'); menuTo('Delete Flight Plan', 'mfd'); G.press('ent', 'mfd'); G.press('clr', 'mfd');
  expect(f().wpts.length === 3 && s.pageMenu.mfd && !s.pageMenu.mfd.confirm, 'CLR on the Delete question');
  G.press('ent', 'mfd'); G.press('ent', 'mfd');
  expect(f().wpts.length === 0 && f().active === null && !s.pageMenu.mfd, `Delete: ${JSON.stringify(f())}`);
  // The catalog (FPL's second page): cursor on the stored plan, ENT gives
  // its menu, Invert & Activate flies it reversed.
  G.press('fpl', 'mfd');
  mt('outer', 3 - s.mfd.group); mt('inner', 1 - s.mfd.last[3]);
  expect(P.pageKey() === 'FPL:1', `Flight Plan Catalog: ${P.pageKey()}`);
  G.push('fms', 'mfd'); mt('inner', stored);
  G.press('ent', 'mfd');
  expect(s.pageMenu.mfd?.items[0].label === 'Activate Flight Plan', 'ENT on a stored plan should open its menu');
  menuTo('Invert & Activate FPL', 'mfd'); G.press('ent', 'mfd'); G.press('ent', 'mfd');
  expect(f().wpts.join() === 'KPAE,KAWO,KBVS' && leg()?.to.id === 'KAWO', `Invert & Activate: ${JSON.stringify(f())}`);
  expect(s.fms.catalog.every((p) => p.wpts.every((id) => G.fms.byId[id])), 'a stored plan with an unknown waypoint');

  // D→ window's menu cancels the Direct-To, back to the plan's leg.
  G.fms.directTo('KBVS');
  G.press('direct_to', 'pfd'); G.press('menu', 'pfd');
  expect(s.pageMenu.pfd?.items[0].label === 'Cancel Direct-To NAV', 'D→ menu');
  G.press('ent', 'pfd');
  expect(!f().dto && leg()?.to.id === 'KBVS' && leg().fromId === 'KAWO', `Cancel D→: ${JSON.stringify(f())}`);
  G.press('direct_to', 'pfd');
  // A page with no options says so; MENU again closes it.
  G.press('menu', 'pfd');
  expect(s.pageMenu.pfd?.items.length === 0, 'the PFD with no window should have no options');
  G.press('menu', 'pfd');
  expect(!s.pageMenu.pfd, 'MENU should close the Page Menu');

  // Utility: Reset Trip Statistics keeps the odometer and flight timer.
  G.reset();
  mt('outer', 2); mt('inner', 1);
  run(60);
  G.press('menu', 'mfd'); menuTo('Reset Trip Statistics', 'mfd'); G.press('ent', 'mfd'); G.press('ent', 'mfd');
  const st = s.mfd.stats;
  expect(st.trip === 0 && st.maxGs === 0 && st.odo > 1 && st.t0 === 0, `trip reset: ${JSON.stringify(st)}`);

  // Map Settings: Map Setup, North Up, small airports off at every range.
  mt('outer', -2);
  G.press('menu', 'mfd');
  expect(s.pageMenu.mfd?.items[0].label === 'Map Settings', 'Navigation Map menu');
  G.press('ent', 'mfd');
  expect(s.pageMenu.mfd?.type === 'map', 'Map Settings should open Map Setup');
  mt('outer', 1); mt('inner', 2);
  expect(s.mapSet.orient === 'North Up', `orientation ${s.mapSet.orient}`);
  mt('outer', -1); mt('inner', 1); mt('outer', 4); mt('inner', -99);
  expect(s.mapSet.aptS === 'Off', `Small APT ${s.mapSet.aptS}`);
  G.push('fms', 'mfd');
  expect(!s.pageMenu.mfd && P.pageKey() === 'MAP:0', 'push FMS should close Map Setup');
  expect(G.airportSize(G.fms.byId.KPAE) === 'L', 'Paine (9,010 ft) should be a large airport');

  // Transponder: XPDR, Code, four digits, back on the XPDR menu.
  G.reset();
  G.press('softkey:7', 'pfd'); G.press('softkey:7', 'pfd');
  for (const d of [7, 7, 0, 0]) G.press('softkey:' + d, 'pfd');
  expect(s.xpdr.code === '7700' && G.menu('pfd') === 'xpdr', `XPDR code ${s.xpdr.code}, menu ${G.menu('pfd')}`);

  G.reset();
  return errors;
}"""


TEST_CHECKS = r"""() => {
  const errors = [], seen = new Map();
  for (const test of PRACTICE_TESTS) {
    test.items.forEach((item, i) => {
      const where = `tests/${test.id} #${i + 1}`;
      if (!TEST_DEBUG.bank[item.from]) errors.push(`${where}: no question "${item.from}"`);
      if (seen.has(item.from)) errors.push(`${where}: "${item.from}" is also tested in ${seen.get(item.from)}`);
      seen.set(item.from, where);
      const choices = [item.correct, ...(item.close ?? []), ...(item.wrong ?? [])];
      if (!item.prompt || choices.some((c) => typeof c !== 'string' || !c.trim()))
        errors.push(`${where}: needs a prompt and non-empty choices`);
      if (choices.length !== 3 || (item.close ?? []).length < 1)
        errors.push(`${where}: needs 1 correct and 2 other choices (at least 1 close), 3 in all`);
      if (new Set(choices).size !== choices.length) errors.push(`${where}: repeated choice`);
    });
  }
  return errors;
}"""


def play_tests(browser):
    """test.html on a phone: every item well formed and its `from` question
    real and tested once; with tests, one answered right scores 100%, and a
    retake left blank scores 0 and says so; with none, it says so."""
    problems = []
    context = browser.new_context(**PHONE)
    page = context.new_page()
    page.on("pageerror", lambda e: problems.append(f"tests: page error: {e}"))
    page.goto((ROOT / "test.html").as_uri())
    page.wait_for_function("window.TEST_DEBUG")
    problems += page.evaluate(TEST_CHECKS)
    if not page.evaluate("PRACTICE_TESTS.length"):
        if not page.is_disabled("#start-go") or "No practice" not in page.inner_text("#start-tests"):
            problems.append("tests: with no tests, the start screen doesn't say so")
        context.close()
        return problems
    page.evaluate("localStorage.removeItem('flightguesser.tests')")
    page.click("#start-go")
    picks = page.evaluate("TEST_DEBUG.sitting().map((s) => s.choices.indexOf(s.item.correct))")
    for i, j in enumerate(picks):
        page.click(f'input[name=q{i}][value="{j}"] + span')
    page.click("#test-submit")
    if "(100%)" not in page.inner_text("#test-score"):
        problems.append(f"tests: all right scored {page.inner_text('#test-score')!r}")
    if page.evaluate("document.documentElement.scrollWidth > innerWidth"):
        problems.append("tests: the page scrolls sideways on a phone")
    page.click("#test-retake")
    page.click("#test-submit")
    if "(0%)" not in page.inner_text("#test-score") or page.locator(".test-blank").count() != len(picks):
        problems.append(f"tests: blank retake scored {page.inner_text('#test-score')!r}")
    page.click("#test-quit")
    if "last score 0%" not in page.inner_text("#start-tests"):
        problems.append("tests: start screen doesn't show the last score")
    context.close()
    return problems


def main(gaps):
    # Small, since headless Chrome renders every frame in software.
    with app(800, 600) as page:
        page.wait_for_timeout(500)
        result = page.evaluate(CHECKS)
        result["errors"] += page.evaluate(G1000_CHECKS)
        en = page.evaluate("Object.keys(I18N)")
        problems = play(page) + play_cards(page.context.browser) + play_tests(page.context.browser)
        errors = page.errors + result["errors"] + problems
    errors += [f"no {key} in en.js (used in a page or its script)"
               for key in sorted(static_keys() - set(en))]
    for label, rows in (("ERROR", errors), ("warning", result["warnings"])):
        for row in rows:
            print(f"{label}: {row}")
    if gaps:
        print("\n".join(result["info"]))
    print(f"{result['summary']}. {len(errors)} errors, {len(result['warnings'])} warnings.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main("--gaps" in sys.argv[1:]))
