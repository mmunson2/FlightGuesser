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


def wait(page, js, timeout=5000):
    """True once js is truthy, False if it isn't within the timeout."""
    try:
        page.wait_for_function(js, timeout=timeout)
        return True
    except Exception:
        return False


def play_camera(browser):
    """The camera (js/camera.js) in its own page, drawing: first person
    moves on W and looks on a drag without selecting; a click still
    selects; Operate puts the head in the seat, where keys don't move it,
    and pointing at a yoke hides the yokes until the pointer leaves."""
    problems = []
    # Wide enough for the side-by-side layout, so the whole canvas is on screen.
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.on("pageerror", lambda e: problems.append(f"camera: page error: {e}"))
    page.goto(INDEX_HTML.as_uri())
    page.wait_for_function("window.FLIGHT_DEBUG", timeout=60000)
    page.evaluate("localStorage.removeItem('flightguesser.camera')")
    page.click("#start-explore")
    pos = "FLIGHT_DEBUG.camera.position.toArray()"
    quat = "FLIGHT_DEBUG.camera.quaternion.toArray()"
    if page.evaluate("FLIGHT_DEBUG.rig.mode") != "fly":
        problems.append("camera: first person isn't the default")
    page.evaluate("FLIGHT_DEBUG.goView('cockpit')")
    a = page.evaluate(pos)
    # Software rendering: frames are slow, so wait for one rather than a time.
    page.mouse.move(600, 400)
    page.keyboard.down("KeyW")
    try:
        page.wait_for_function(f"(a) => {pos}.some((v, i) => v !== a[i])", arg=a, timeout=5000)
    except Exception:
        pass
    page.keyboard.up("KeyW")
    if page.evaluate(pos) == a:
        problems.append("camera: W didn't move the first person camera")
    q = page.evaluate(quat)
    page.mouse.down()
    page.mouse.move(680, 380, steps=8)
    page.mouse.up()
    if page.evaluate(quat) == q or page.is_visible("#hide-selected"):
        problems.append("camera: a drag didn't look around, or it selected a part")
    page.evaluate("FLIGHT_DEBUG.goView('panel')")
    page.mouse.click(600, 330)
    if page.is_hidden("#hide-selected"):
        problems.append("camera: a click in first person didn't select a part")
    page.click('input[name=cam-mode][value="orbit"] + span')
    if page.evaluate("FLIGHT_DEBUG.rig.mode") != "orbit" or not page.evaluate("FLIGHT_DEBUG.controls.enabled"):
        problems.append("camera: the Orbit toggle didn't switch to orbit")
    page.click("#operate")
    seat = page.evaluate(pos)
    page.keyboard.down("KeyW")
    page.wait_for_timeout(300)
    page.keyboard.up("KeyW")
    if page.evaluate("FLIGHT_DEBUG.rig.mode") != "seat" or page.evaluate(pos) != seat or page.is_visible("#cam-mode"):
        problems.append("camera: Operate didn't seat the pilot, or W moved them, or the mode toggle shows")
    # A whole pixel on the yokes (a vertex on their outline can miss by a
    # fraction of one).
    at = page.evaluate("""() => {
      const D = FLIGHT_DEBUG, y = D.meshById().control_wheels;
      D.camera.updateMatrixWorld();   // the seat may not have been drawn yet
      const r = D.renderer.domElement.getBoundingClientRect(), ray = new D.THREE.Raycaster();
      for (let py = Math.ceil(r.top) + 5; py < r.bottom; py += 10) {
        for (let px = Math.ceil(r.left) + 5; px < r.right; px += 10) {
          ray.setFromCamera({ x: ((px - r.left) / r.width) * 2 - 1, y: -((py - r.top) / r.height) * 2 + 1 }, D.camera);
          if (ray.intersectObject(y, false).length) return [px, py];
        }
      }
      return null;
    }""")
    shown = "FLIGHT_DEBUG.meshById().control_wheels.visible"
    if not at:
        problems.append("camera: no yoke in view from the seat")
    else:
        page.mouse.move(*at)
        hidden = wait(page, f"!{shown}")
        page.mouse.move(5, 5)
        if not hidden or not wait(page, shown):
            problems.append("camera: pointing at a yoke didn't hide the yokes, or they didn't come back")
    page.click("#operate")
    if page.evaluate("FLIGHT_DEBUG.rig.mode") != "orbit":
        problems.append("camera: leaving Operate didn't go back to the camera mode before it")
    page.close()
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
  G.press('menu', 'mfd'); menuTo('Select Approach', 'mfd'); G.press('ent', 'mfd');
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

  // Tmr/Ref: a 2-minute count down, set and started with the knobs and
  // ENT; it expires and counts up. Then Vy on, and BARO minimums.
  G.reset();
  const pt = (part, n) => G.turn('fms', part, n, 'pfd'), r = s.ref;
  G.press('softkey:9', 'pfd');
  expect(s.fms.win.pfd?.type === 'tmr', 'Tmr/Ref softkey opened no window');
  pt('inner', 1);
  expect(r.timer.dir === 'DN', `timer direction ${r.timer.dir}`);
  pt('outer', -1); pt('inner', 2);
  expect(r.timer.secs === 120 && G.timer.action() === 'START?', `timer set ${r.timer.secs} s, ${G.timer.action()}`);
  G.press('ent', 'pfd');
  run(60);
  expect(r.timer.running && Math.abs(r.timer.secs - 60) < 1 && G.timer.action() === 'STOP?', `count down at ${r.timer.secs}`);
  run(70);
  expect(r.timer.expired && Math.abs(r.timer.secs - 10) < 1, `after expiry ${r.timer.secs} s, expired ${r.timer.expired}`);
  G.press('ent', 'pfd');
  expect(!r.timer.running && G.timer.action() === 'RESET?', `stopped: ${G.timer.action()}`);
  G.press('ent', 'pfd');
  expect(r.timer.secs === 120 && G.timer.action() === 'START?', `reset to ${r.timer.secs}`);
  // Vy: the large knob to its ON/OFF (Vglide, Vr, Vx before it).
  pt('outer', 8); pt('inner', 1);
  expect(r.v.y.on && !r.v.x.on, `Vy on: ${JSON.stringify(r.v)}`);
  // The Page Menu: All References On.
  G.press('menu', 'pfd');
  expect(s.pageMenu.pfd?.items[0].label === 'All References On', 'Tmr/Ref menu');
  G.press('ent', 'pfd');
  expect(Object.values(r.v).every((v) => v.on), 'All References On');
  // BARO minimums at 3,400 ft: an alert on descending through them.
  pt('outer', 1); pt('inner', 1); pt('outer', 1); pt('inner', 240);
  expect(r.mins.mode === 'BARO' && r.mins.ft === 3400, `minimums ${r.mins.mode} ${r.mins.ft}`);
  run(2);
  expect(!r.mins.below, 'below minimums at 3,500 ft');
  s.manual.pitch = -3;
  expect(run(120, () => r.mins.below) && s.note?.text === 'MINIMUMS', `no MINIMUMS alert: ${s.note?.text}`);
  G.press('clr', 'pfd');
  expect(!s.fms.win.pfd, 'CLR should close Tmr/Ref');

  // OBS: starts on the leg's course; CRS picks another through KAWO; the
  // CDI follows it; no sequencing past the waypoint until OBS is off.
  G.reset();
  G.fms.activatePlan(['KPAE', 'KAWO', 'KBVS']);
  const dtk0 = G.navSolution().course;
  G.press('softkey:4', 'pfd');
  expect(s.fms.obs && s.fms.obs.crs === Math.round(dtk0) % 360, `OBS on: ${JSON.stringify(s.fms.obs)} vs DTK ${dtk0}`);
  G.turn('crs_baro', 'inner', 40);
  const kawo = G.fms.byId.KAWO, obsTrue = s.fms.obs.crs + G.magVarAt(kawo.lat, kawo.lon);
  Object.assign(s, G.fms.project(kawo, obsTrue + 180, 5));
  nav = G.navSolution();
  expect(nav.obs && nav.course === s.fms.obs.crs && Math.abs(nav.dev) < 0.05 && nav.toFrom === 'TO',
    `OBS on course 5 NM before: ${JSON.stringify({ c: nav.course, dev: nav.dev, tf: nav.toFrom })}`);
  Object.assign(s, G.fms.project(kawo, obsTrue, 5));
  run(2);
  nav = G.navSolution();
  expect(nav.toFrom === 'FROM' && leg().to.id === 'KAWO', `OBS past KAWO: ${nav.toFrom}, leg to ${leg().to.id}`);
  G.push('crs_baro');
  expect(Math.abs(angle(s.fms.obs.crs, G.navSolution().bearingTo)) < 1, 'CRS push in OBS should point the course at the waypoint');
  G.press('softkey:4', 'pfd');
  run(1);
  expect(!s.fms.obs && leg().to.id === 'KBVS', `OBS off past KAWO should sequence: leg to ${leg()?.to.id}`);
  s.cdi = 'VOR1';
  G.press('softkey:4', 'pfd');
  expect(!s.fms.obs, 'OBS mode with a VOR source');

  // PFD maps: Map/HSI, Layout, Inset Map; the PFD's RANGE knob is its own.
  G.reset();
  G.press('softkey:1', 'pfd'); G.press('softkey:1', 'pfd');
  expect(G.menu('pfd') === 'map-layout', `Map/HSI, Layout: ${G.menu('pfd')}`);
  G.press('softkey:2', 'pfd');
  expect(s.pfdMap.layout === 'Inset Map', `layout ${s.pfdMap.layout}`);
  const mfdRange = s.range, pfdRange = s.pfdMap.range;
  G.turn('range', '', 1, 'pfd');
  expect(s.pfdMap.range === pfdRange - 1 && s.range === mfdRange, 'PFD RANGE should zoom the PFD map only');
  G.press('softkey:3', 'pfd');
  expect(s.pfdMap.layout === 'HSI Map', `layout ${s.pfdMap.layout}`);
  expect(s.mapSet.clsB !== undefined && s.mapSet.clsD === 25, 'Map Setup airspace settings');

  // Airspace: Paine's Class D (SFC-3,100), and inside it at 1,500 ft.
  const paeD = G.AIRSPACE.filter((x) => x.name === 'EVERETT CLASS D');
  expect(paeD.length && paeD[0].cls === 'D' && paeD[0].lo === 0 && paeD[0].hi === 3100,
    `Everett Class D: ${JSON.stringify(paeD.map((x) => [x.lo, x.hi]))}`);
  Object.assign(s, { lat: G.fms.byId.KPAE.lat, lon: G.fms.byId.KPAE.lon, trueAlt: 1500 });
  let spaces = P.nearestAirspaces();
  expect(spaces[0]?.name === 'EVERETT CLASS D' && spaces[0].status === 'INSIDE', `over KPAE at 1,500: ${spaces[0]?.name} ${spaces[0]?.status}`);
  s.trueAlt = 4000;
  spaces = P.nearestAirspaces();
  expect(spaces.find((x) => x.name === 'EVERETT CLASS D')?.status === 'ABOVE', 'over KPAE at 4,000 should be above its Class D');
  // Heading for Paine from 8 NM south at 2,000 ft: AHEAD within 10 minutes.
  Object.assign(s, G.fms.project(G.fms.byId.KPAE, 180, 8), { trueAlt: 2000, hdg: 0 });
  spaces = P.nearestAirspaces();
  expect(spaces.find((x) => x.name === 'EVERETT CLASS D')?.status === 'AHEAD <10MIN', `toward KPAE: ${JSON.stringify(spaces.find((x) => x.name === 'EVERETT CLASS D'))}`);

  // Airspace alerts: inside Paine's Class D gives INSIDE ARSPC and a
  // flashing ADVISORY; the softkey acknowledges and opens the window.
  G.reset();
  // (s.alerts is replaced by each reset, so look it up every time.)
  const al = s.alerts, msg = (id) => s.alerts.messages.find((m) => m.id === id);
  const at = (p, extra) => { Object.assign(s, p, extra); run(1.5); };
  at({ lat: G.fms.byId.KPAE.lat, lon: G.fms.byId.KPAE.lon }, { trueAlt: 1500 });
  expect(msg('inside')?.about === 'EVERETT CLASS D' && al.unseen, `inside KPAE D: ${JSON.stringify(al)}`);
  G.press('softkey:11', 'pfd');
  expect(!al.unseen && s.fms.win.pfd?.type === 'alerts', 'ALERTS softkey should acknowledge and open the window');
  G.press('softkey:11', 'pfd');
  expect(!s.fms.win.pfd, 'ALERTS softkey again should close the window');
  // The 200 ft buffer: 3,250 ft is inside a 3,100 ft ceiling; with no
  // buffer it is above, and the message goes.
  at({}, { trueAlt: 3250 });
  expect(msg('inside'), 'within the altitude buffer above the Class D should still be inside');
  mt('outer', 2); mt('inner', 3 - s.mfd.last[2]);
  expect(P.pageKey() === 'AUX:3', `System Setup: ${P.pageKey()}`);
  G.push('fms', 'mfd'); mt('inner', -4);
  expect(s.alertSet.buffer === 0, `buffer ${s.alertSet.buffer}`);
  run(1.5);
  expect(!msg('inside'), 'with no buffer, 3,250 ft is above the Class D');
  // Class D alerts off: nothing for Paine even inside it.
  mt('outer', 3); mt('inner', 1);
  expect(!s.alertSet.D, 'Class D alerts off');
  at({}, { trueAlt: 1500 });
  expect(!msg('inside'), 'Class D alerts off should silence INSIDE ARSPC');
  mt('inner', 1);
  // Heading for Paine from 8 NM south at 2,000 ft: ARSPC AHEAD.
  at(G.fms.project(G.fms.byId.KPAE, 180, 8), { trueAlt: 2000, hdg: 0, roll: 0, manual: { pitch: 2, roll: 0 } });
  expect(msg('ahead')?.about === 'EVERETT CLASS D' && !msg('inside'), `toward KPAE: ${JSON.stringify(al.messages)}`);

  // Annunciations (POH section 7): none at the start; each failure gives
  // its own, at the POH's thresholds.
  const cas = () => s.alerts.cas.map((c) => c.id).join();
  const fresh = (fn) => { G.reset(); if (fn) fn(); };
  fresh(); run(2);
  expect(cas() === '' && G.alerts.pending() !== 'warning', `annunciations at the start: ${cas()}`);
  // LOW VOLTS below 1,000 RPM (POH note), out again at cruise power.
  s.power = 0.1; run(2);
  expect(cas() === 'lowVolts' && s.sys.rpm < 1000 && G.alerts.pending() === 'warning', `idle: ${cas()} at ${s.sys.rpm} RPM`);
  G.press('softkey:11', 'pfd');
  expect(s.alerts.cas[0].acked && G.alerts.pending() !== 'warning', 'the WARNING softkey should acknowledge');
  s.power = 0.8; run(2);
  expect(cas() === '', `back at cruise power: ${cas()}`);
  // Alternator: LOW VOLTS at once (battery 24 V), discharge on M BATT;
  // about 35 minutes later the standby battery takes over: STBY BATT.
  fresh(() => G.fail('alternator')); run(2);
  expect(cas() === 'lowVolts' && s.sys.ampsM < 0, `alternator failed: ${cas()}, ${s.sys.ampsM} A`);
  expect(run(3000, () => cas().includes('stby')) && s.sys.voltsM <= 20.1 && s.sys.ampsS < -0.5,
    `no STBY BATT: ${cas()}, ${s.sys.voltsM.toFixed(1)} V`);
  // Overvoltage: HIGH VOLTS, then the ACU trips the alternator: LOW VOLTS.
  fresh(() => G.fail('overvolt')); run(1);
  expect(cas() === 'highVolts', `overvoltage: ${cas()}`);
  run(4);
  expect(cas() === 'lowVolts' && s.sys.acuTripped, `after the ACU trip: ${cas()}`);
  // Oil pressure 20 PSI or less; low vacuum; CO 50 PPM or more.
  fresh(() => G.fail('oil'));
  expect(run(60, () => cas().includes('oil')) && s.sys.oilPsi <= 20, `oil: ${s.sys.oilPsi.toFixed(0)} PSI`);
  fresh(() => G.fail('vacuum'));
  expect(run(10, () => cas() === 'vac'), `vacuum: ${cas()} at ${s.sys.vac.toFixed(1)}`);
  fresh(() => G.fail('co'));
  expect(run(40, () => cas() === 'co') && s.sys.coPpm >= 50, `CO: ${cas()}`);
  // LOW FUEL L: under 5 gal for more than 60 seconds, the left tank only.
  fresh(() => { s.fuelL = 5.3; G.fail('leakL'); });
  run(50);
  expect(s.fuelL < 5 && !cas().includes('fuelL'), `LOW FUEL L too early: ${s.fuelL.toFixed(2)} gal`);
  run(70);
  expect(cas() === 'fuelL', `left leak: ${cas()}`);
  // Cautions acknowledge after warnings: WARNING, then CAUTION.
  G.fail('oil', true);
  run(40);
  expect(G.alerts.pending() === 'warning', `pending ${G.alerts.pending()}`);
  G.press('softkey:11', 'pfd');
  expect(G.alerts.pending() === 'caution', `after WARNING: ${G.alerts.pending()}`);
  G.press('softkey:11', 'pfd');
  expect(s.alerts.cas.every((c) => c.acked), 'after CAUTION all acknowledged');
  // Both tanks dry: the engine stops; no fuel flow, oil pressure gone.
  fresh(() => { s.fuelL = s.fuelR = 0.002; });
  run(30);
  expect(!s.sys.running && G.fuelFlow() === 0 && cas().includes('oil') && cas().includes('lowVolts'), `fuel exhaustion: ${cas()}`);
  // PTRM: the autopilot disconnects and won't engage again.
  fresh(() => G.press('ap'));
  G.fail('trim'); run(1);
  G.press('ap');
  expect(!a().ap, 'PTRM: the autopilot should be off and stay off');
  // MAXSPD: the autopilot diving in PIT holds the speed under Vne.
  fresh(() => { G.press('ap'); s.power = 1; for (let i = 0; i < 30; i++) G.press('nose_dn'); });
  let fastest = 0, maxspd = false;
  run(120, () => { fastest = Math.max(fastest, s.ias); maxspd ||= a().maxspd; return false; });
  expect(maxspd && fastest < G.SPEEDS.vne + 3, `overspeed: MAXSPD ${maxspd}, fastest ${fastest.toFixed(0)} KIAS`);

  // Messages: WPT ARRIVAL within 10 seconds of the waypoint, TIMER EXPIRD,
  // and the database's 28-day expiry.
  fresh(() => G.fms.directTo('KAWO'));
  Object.assign(s, G.fms.project(G.fms.byId.KAWO, G.navSolution('GPS').courseTrue + 180, 0.25));
  run(1);
  expect(msg('wpt')?.about === 'KAWO' && msg('wpt').title === 'WPT ARRIVAL', `WPT ARRIVAL: ${JSON.stringify(s.alerts.messages)}`);
  s.ref.timer.expired = true; run(1);
  expect(msg('timer')?.title === 'TIMER EXPIRD', 'TIMER EXPIRD message');
  expect(G.DB_EXPIRES === Date.UTC(2026, 10, 26), `database expiry ${new Date(G.DB_EXPIRES).toISOString()}`);

  // Standby instruments: the altimeter keeps its own setting (STD BARO on
  // the PFD leaves it), and each face draws without error.
  G.reset();
  G.press('softkey:3', 'pfd'); G.press('softkey:9', 'pfd');
  expect(s.baro === 29.92 && Math.abs(G.standbyAlt() - s.trueAlt) < 1, `standby altimeter ${G.standbyAlt()} vs ${s.trueAlt}`);
  for (const [id, draw] of Object.entries(G1000_STANDBY.draw)) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = G1000_STANDBY.SIZE;
    try { draw(cv.getContext('2d'), s, G); } catch (e) { errors.push(`g1000: standby ${id}: ${e}`); }
  }

  // The standby altimeter's knob: its own setting, 100 ft per 0.10 inHg.
  G.reset();
  G.turn('stby_baro', 'outer', -20);
  expect(s.stbyBaro === 29.92 && Math.abs(G.standbyAlt() - (s.trueAlt - 200)) < 1 && s.baro === 30.12,
    `standby knob: ${s.stbyBaro}, ${G.standbyAlt().toFixed(0)} ft`);

  // ALT Units: PFD Opt, ALT Units; Meters on; HPA, and the knob in hPa.
  G.press('softkey:3', 'pfd'); G.press('softkey:8', 'pfd');
  expect(G.menu('pfd') === 'alt-units', `ALT Units menu: ${G.menu('pfd')}`);
  G.press('softkey:5', 'pfd'); G.press('softkey:8', 'pfd');
  expect(s.altUnits.meters && s.altUnits.baro === 'HPA', `ALT units ${JSON.stringify(s.altUnits)}`);
  G.turn('crs_baro', 'outer', 1);
  expect(Math.round(s.baro * G.HPA) === 1021, `hPa step: ${(s.baro * G.HPA).toFixed(1)}`);

  // Volume knob pushes: COM squelch off, NAV ident on (the radio tuned).
  G.push('com_volume'); G.push('nav_volume');
  expect(s.vol.sqOff[0] && !s.vol.sqOff[1] && s.vol.navId[0], `squelch/ID: ${JSON.stringify(s.vol)}`);

  // Flight ID (System Setup): ENT on it, type N12, ENT.
  mt('outer', 2 - s.mfd.group); mt('inner', 3 - s.mfd.last[2]);
  G.push('fms', 'mfd'); mt('outer', 4); G.press('ent', 'mfd');
  expect(s.mfd.cursor === 'ident', `Flight ID entry: ${s.mfd.cursor}`);
  over(() => s.mfd.entry, 'N12');
  G.press('ent', 'mfd');
  expect(s.xpdr.flightId === 'N12', `Flight ID ${s.xpdr.flightId}`);

  // PFD Map Settings: the PFD's own (orientation, text), not the MFD's.
  G.reset();
  s.pfdMap.layout = 'Inset Map';
  G.press('menu', 'pfd');
  expect(s.pageMenu.pfd?.items[0]?.label === 'PFD Map Settings', 'PFD Page Menu with the inset map');
  G.press('ent', 'pfd');
  G.turn('fms', 'outer', 1, 'pfd'); G.turn('fms', 'inner', 2, 'pfd');
  expect(s.pfdMapSet.orient === 'North Up' && s.mapSet.orient === 'Heading Up', `PFD map ${s.pfdMapSet.orient}, MFD ${s.mapSet.orient}`);
  G.turn('fms', 'outer', 2, 'pfd'); G.turn('fms', 'inner', 2, 'pfd');
  expect(s.pfdMapSet.track === '60 SEC', `track vector ${s.pfdMapSet.track}`);
  G.press('clr', 'pfd');

  // FPL: Insert After puts the new waypoint after the selected one; Change
  // Fields picks the columns; the rows carry the distance to go.
  G.fms.activatePlan(['KPAE', 'KAWO']);
  G.press('fpl', 'pfd'); G.push('fms', 'pfd');
  G.turn('fms', 'outer', -9, 'pfd');
  G.press('menu', 'pfd');
  const fmenu = () => s.pageMenu.pfd;
  G.turn('fms', 'outer', fmenu().items.findIndex((it) => it.label === 'Insert After') - fmenu().cursor, 'pfd');
  G.press('ent', 'pfd');
  expect(s.fms.insertAfter, 'Insert After');
  type('KBV'); G.press('ent', 'pfd');
  expect(f().wpts.join() === 'KPAE,KBVS,KAWO', `insert after KPAE: ${f().wpts}`);
  G.press('menu', 'pfd');
  G.turn('fms', 'outer', fmenu().items.findIndex((it) => it.label === 'Change Fields') - fmenu().cursor, 'pfd');
  G.press('ent', 'pfd');
  G.turn('fms', 'outer', 1, 'pfd'); G.turn('fms', 'inner', 3, 'pfd');
  expect(s.fms.fields.f1 === 'ETE', `field 1 ${s.fms.fields.f1}`);
  G.press('clr', 'pfd');
  const fr0 = G.fms.rows();
  // (KBVS went in before the active waypoint: the leg is still to KAWO.)
  expect(fr0[0].toGo == null && fr0[1].toGo == null && fr0[2].active
    && Math.abs(fr0[2].toGo - G.bearingDist(s, G.fms.byId.KAWO).dist) < 0.01, `rows toGo: ${fr0.map((r) => r.toGo)}`);

  // Every screen draws: each MFD page, each PFD window and map layout,
  // with metres, hPa and the new fields on.
  const cv = document.createElement('canvas');
  cv.width = G1000_DISPLAY.W; cv.height = G1000_DISPLAY.H;
  const cx2 = cv.getContext('2d');
  const drawAll = (what) => {
    try { G1000_DISPLAY.drawPFD(cx2, s, G); G1000_DISPLAY.drawMFD(cx2, s, G); }
    catch (e) { errors.push(`g1000: drawing ${what}: ${e}`); }
  };
  Object.assign(s.altUnits, { meters: true, baro: 'HPA' });
  Object.assign(s.fms.fields, { f1: 'ETE', f2: 'ETA', f3: 'FUEL' });
  s.mapSet.track = '2 MIN';
  P.GROUPS.forEach((g, gi) => g.pages.forEach((_, pi) => { P.goPage(gi, pi); drawAll(`${g.id}:${pi}`); }));
  for (const layout of ['Inset Map', 'HSI Map']) { s.pfdMap.layout = layout; drawAll(layout); }
  for (const k of ['softkey:9', 'softkey:10', 'softkey:11']) { G.press(k, 'pfd'); drawAll(k); }

  // Nearest Frequencies: sections in order, nearest first; ENT tunes COM.
  G.reset();
  const fr = P.nearestFreqs();
  expect(fr.length && fr[0].kind === 'ARTCC' && fr.some((r) => r.kind === 'FSS') && fr[fr.length - 1].kind === 'WX',
    `Nearest Frequencies sections: ${fr.map((r) => r.kind)}`);
  expect(fr.every((r) => r.freq >= 118 && r.freq < 137), 'a non-VHF frequency on Nearest Frequencies');
  mt('outer', 4); mt('inner', 5);
  expect(P.pageKey() === 'NRST:5', `Nearest Frequencies page: ${P.pageKey()}`);
  G.push('fms', 'mfd'); mt('inner', 2); G.press('ent', 'mfd');
  expect(s.com[0].stby === fr[2].freq, `NRST FREQ ENT: COM1 standby ${s.com[0].stby}, row ${fr[2].freq}`);

  // Transponder: XPDR, Code, four digits, back on the XPDR menu.
  G.reset();
  G.press('softkey:7', 'pfd'); G.press('softkey:7', 'pfd');
  for (const d of [7, 7, 0, 0]) G.press('softkey:' + d, 'pfd');
  expect(s.xpdr.code === '7700' && G.menu('pfd') === 'xpdr', `XPDR code ${s.xpdr.code}, menu ${G.menu('pfd')}`);

  // ---- Section 2: wind, bearings, DME, pan, FPL geometry, user
  // waypoints, GPS status, lean and totalizer, checklists, aural alerts ----
  {
  const sk = (d, ...keys) => keys.forEach((k) => G.press('softkey:' + k, d));
  const angle2 = (x, y) => ((((x - y) % 360) + 540) % 360) - 180;

  // Wind from the west on a northbound airplane: drift right, a crosswind
  // from the left; the ground speed under the TAS.
  G.reset();
  G.setWind(270, 20);
  const lon0 = s.lon;
  run(60);
  const drift = angle2(G.track(), s.hdg);
  expect(drift > 7 && drift < 13 && s.lon > lon0 + 0.002, `wind drift ${drift.toFixed(1)}°, GS ${G.gs().toFixed(0)}, TAS ${G.tas().toFixed(0)}`);
  G.setWind(s.hdg, 20);
  expect(Math.abs(G.gs() - (G.tas() - 20)) < 0.01 && Math.abs(angle2(G.track(), s.hdg)) < 0.01, `headwind GS ${G.gs().toFixed(1)}`);
  G.setWind(270, 20);
  const wi = G.windInfo();
  expect(wi.cross < -15 && Math.abs(wi.rel + 70) < 25, `wind window: cross ${wi.cross.toFixed(1)}, rel ${wi.rel.toFixed(0)}`);
  sk('pfd', 3, 2, 3);
  expect(s.windShow === '2' && G.menu('pfd') === 'wind', `Wind Option 2: ${s.windShow} ${G.menu('pfd')}`);
  sk('pfd', 5, 10, 10);
  expect(s.windShow === 'Off' && G.menu('pfd') === 'pfd', `Wind Off and back: ${s.windShow} ${G.menu('pfd')}`);
  // GPS NAV in a 25 kt crosswind: crabbed, on course.
  G.reset();
  G.setWind(270, 25);
  G.fms.directTo('KBVS');
  G.press('nav'); G.press('ap');
  run(400);
  nav = G.navSolution();
  expect(a().lat === 'GPS' || a().lat === 'NAV', `NAV mode ${a().lat}`);
  expect(nav && Math.abs(nav.xtk) < 0.3 && Math.abs(angle2(s.hdg, G.track())) > 8, `crosswind NAV: xtk ${nav?.xtk.toFixed(2)}, crab ${angle2(s.hdg, G.track()).toFixed(1)}`);

  // Bearing 1: NAV1 (PAE), GPS, off; DME on NAV1 (PAE is a VOR/DME),
  // ADF/DME tunes it NAV2 then HOLD.
  G.reset();
  sk('pfd', 3, 4);
  const pae = G.NAVAIDS.find((n) => n.id === 'PAE'), bp = G.bearingTo(s.brg[0]);
  expect(s.brg[0] === 'NAV1' && bp?.id === 'PAE' && Math.abs(angle2(bp.brg, G.toMag(G.bearingDist(s, pae).brg))) < 0.01, `Bearing 1: ${s.brg[0]} ${JSON.stringify(bp)}`);
  sk('pfd', 4);
  expect(s.brg[0] === 'GPS' && G.bearingTo('GPS') === null, `Bearing 1 GPS with no leg: ${s.brg[0]}`);
  sk('pfd', 4, 6);
  expect(s.brg[0] === null && s.brg[1] === 'NAV2', `Bearing 1 off, 2 NAV2: ${s.brg}`);
  sk('pfd', 3);
  const dm = G.dmeInfo(), flat = G.bearingDist(s, pae).dist;
  expect(s.dme.on && dm.id === 'PAE' && dm.dist >= flat && dm.dist - flat < 0.3, `DME: ${JSON.stringify(dm)} vs ${flat.toFixed(2)}`);
  sk('pfd', 10, 6, 6);
  expect(s.dme.src === 'HOLD' && s.dme.hold === s.nav[1].act, `DME tuning ${s.dme.src} ${s.dme.hold}`);

  // Map pan: RANGE push on the Navigation Map; the arrows move it a range
  // ahead; ENT there makes USR001; measuring; CLR, CLR.
  G.reset();
  G.push('range', 'mfd');
  expect(s.pan && Math.abs(s.pan.lat - s.lat) < 1e-9, 'RANGE push: pan pointer at own ship');
  G.pan(0, 8);
  const pd = G.bearingDist(s, s.pan);
  expect(Math.abs(pd.dist - G.RANGES[s.range]) < 0.05 && Math.abs(angle2(pd.brg, s.hdg)) < 1, `pan ${pd.dist.toFixed(2)} NM at ${pd.brg.toFixed(0)}`);
  G.press('ent', 'mfd');
  expect(s.fms.user[0]?.id === 'USR001' && Math.abs(s.fms.user[0].lat - s.pan.lat) < 1e-9, `ENT at the pointer: ${JSON.stringify(s.fms.user)}`);
  G.press('direct_to', 'mfd');
  expect(s.fms.win.mfd?.ident === 'USR001', `D→ at the pointer offers ${s.fms.win.mfd?.ident}`);
  G.press('direct_to', 'mfd');
  G.press('menu', 'mfd'); menuTo('Measure Bearing/Distance', 'mfd'); G.press('ent', 'mfd');
  G.pan(8, 0);
  expect(s.pan.measure && Math.abs(G.bearingDist(s.pan.measure, s.pan).dist - G.RANGES[s.range]) < 0.05, 'measuring from where the pointer was');
  drawAll('pan and measure');
  G.press('clr', 'mfd');
  expect(s.pan && !s.pan.measure, 'CLR stops measuring');
  G.press('clr', 'mfd');
  expect(!s.pan, 'CLR again puts the pointer away');

  // Parallel Track: 2 NM right moves the course, so the airplane is 2 NM
  // further left of it; Closest Point of FPL to KAWO, saved.
  G.reset();
  G.fms.activatePlan(['KPAE', 'KBVS']);
  const x0 = G.navSolution().xtk;
  G.press('fpl', 'mfd'); G.press('menu', 'mfd'); menuTo('Parallel Track', 'mfd'); G.press('ent', 'mfd');
  expect(s.pageMenu.mfd?.setup === 'ptk', 'Parallel Track window');
  mt('outer', 3); mt('inner', 1); G.press('ent', 'mfd');
  expect(G.fms.leg().ptk && Math.abs(G.navSolution().xtk - (x0 - 2)) < 0.05, `parallel track xtk ${G.navSolution().xtk.toFixed(2)} from ${x0.toFixed(2)}`);
  s.fms.ptk.on = 'Off';
  const awo = G.fms.byId.KAWO, cp = G.fms.closestPoint('KAWO');
  expect(cp && cp.dist < Math.min(G.bearingDist(awo, G.fms.byId.KPAE).dist, G.bearingDist(awo, G.fms.byId.KBVS).dist), `closest point ${JSON.stringify(cp)}`);
  G.press('menu', 'mfd'); menuTo('Closest Point of FPL', 'mfd'); G.press('ent', 'mfd');
  s.pageMenu.mfd.entry.ident = 'KAWO';
  G.press('ent', 'mfd');
  expect(Math.abs(s.pageMenu.mfd?.result?.dist - cp.dist) < 1e-6, 'Closest Point window result');
  drawAll('closest point');
  G.press('ent', 'mfd');
  const cpw = s.fms.user[0];
  expect(cpw && Math.abs(G.bearingDist(awo, cpw).dist - cp.dist) < 0.01 && !s.pageMenu.mfd, `closest point saved: ${JSON.stringify(cpw)}`);
  // A user waypoint in a plan can't be deleted.
  G.fms.directTo(cpw.id);
  expect(!G.fms.removeUser(cpw.id) && s.fms.user.length === 1, 'deleting a user waypoint in use');

  // User WPT Information: create at P.POS, rename, place by radial and
  // distance from KPAE; Nearest User WPTs lists it.
  G.reset();
  P.goPage(1, 4);
  G.press('menu', 'mfd'); menuTo('Create New User WPT', 'mfd'); G.press('ent', 'mfd');
  expect(s.fms.user.length === 1 && P.shownUser().id === 'USR001', 'Create New User WPT');
  G.push('fms', 'mfd'); G.press('ent', 'mfd');
  s.mfd.entry.ident = 'HOME'; G.press('ent', 'mfd');
  expect(P.shownUser().id === 'HOME' && G.fms.byId.HOME === P.shownUser() && G.fms.match('HOM')?.id === 'HOME', `rename: ${P.shownUser().id}`);
  mt('outer', 1); G.press('ent', 'mfd');
  s.mfd.entry.ident = 'KPAE'; G.press('ent', 'mfd');
  mt('outer', 1); mt('inner', 90); mt('outer', 1); mt('inner', 10);
  const home = P.shownUser(), hb = G.bearingDist(G.fms.byId.KPAE, home);
  expect(home.ref?.id === 'KPAE' && Math.abs(hb.dist - 10) < 0.01 && Math.abs(angle2(G.toMag(hb.brg, G.magVarAt(G.fms.byId.KPAE.lat, G.fms.byId.KPAE.lon)), 90)) < 0.5,
    `radial/distance: ${JSON.stringify(home.ref)} -> ${hb.brg.toFixed(1)}° ${hb.dist.toFixed(2)}NM`);
  G.press('clr', 'mfd');
  G.press('direct_to', 'mfd');
  expect(s.fms.win.mfd?.ident === 'HOME', `D→ from User WPT offers ${s.fms.win.mfd?.ident}`);
  G.press('direct_to', 'mfd');
  expect(P.nearestUser()[0]?.w.id === 'HOME', 'Nearest User WPTs');
  P.goPage(4, 4); drawAll('Nearest User WPTs'); P.goPage(1, 4); drawAll('User WPT');

  // LOI: no GPS course, GPS NAV back to ROL, the message, the status page.
  G.reset();
  G.fms.directTo('KBVS');
  G.press('nav'); G.press('ap');
  G.fail('gps', true);
  run(2);
  expect(G.navSolution() === null && a().lat === 'ROL' && s.alerts.messages.some((m) => m.id === 'loi') && P.gpsStatus().solution === 'LOI',
    `LOI: nav ${!!G.navSolution()}, ${a().lat}, ${s.alerts.messages.map((m) => m.id)}`);
  P.goPage(2, 2); drawAll('GPS Status with LOI');
  G.fail('gps', false);
  expect(P.gpsStatus().sats.every((x) => x.used), 'GPS Status: all used');

  // Lean: Assist finds the first cylinder to peak as the mixture comes
  // back; fuel flow falls with it; too lean stops the engine.
  G.reset();
  sk('mfd', 0, 1);
  expect(G.menu('mfd') === 'lean' && s.eisPage === 'Lean', `Lean page: ${G.menu('mfd')}`);
  sk('mfd', 4);
  const ff0 = G.fuelFlow();
  for (let i = 0; i < 40 && s.sys.lean.peaked == null; i++) { G.fly({ mixture: -0.01 }); run(5); }
  expect(s.sys.lean.peaked === 1 && G.fuelFlow() < ff0, `lean assist: peaked ${s.sys.lean.peaked}, FF ${G.fuelFlow().toFixed(1)} from ${ff0.toFixed(1)}`);
  drawAll('lean assist');
  s.mixture = 0.2; run(2);
  expect(!s.sys.running, 'too lean: the engine stops');
  s.mixture = 1; run(2);
  expect(s.sys.running, 'enriched: it runs again');
  // Totalizer: System page softkeys, and what was burnt.
  sk('mfd', 2);
  expect(G.menu('mfd') === 'system', `System softkeys: ${G.menu('mfd')}`);
  sk('mfd', 3);
  expect(s.sys.tot.rem === 53, `Rst Fuel: ${s.sys.tot.rem}`);
  sk('mfd', 4, 4, 6);
  const used0 = s.sys.tot.used, ffT = G.fuelFlow();
  run(360);
  expect(s.sys.tot.used === s.sys.tot.used && Math.abs(s.sys.tot.used - ffT / 10) < 0.2 && Math.abs(s.sys.tot.rem - (51 - s.sys.tot.used)) < 1e-6 && used0 === 0,
    `totalizer: used ${s.sys.tot.used.toFixed(2)}, rem ${s.sys.tot.rem.toFixed(2)}`);
  drawAll('system page');
  sk('mfd', 10);
  expect(G.menu('mfd') === 'mfd' && s.eisPage === 'Engine', `EIS Back: ${G.menu('mfd')} ${s.eisPage}`);

  // Checklist: open, ENT to the first item, ENT checks it; Emergency;
  // Exit.
  G.reset();
  sk('mfd', 11);
  expect(G.checklist.isOpen() && G.menu('mfd') === 'checklist', 'Checklist open');
  G.press('ent', 'mfd');
  const first = G.checklist.stops()[0];
  expect(s.chk.cursor === first, `ENT on GROUP to the first item: ${s.chk.cursor}`);
  G.press('ent', 'mfd');
  expect(G.checklist.checked()[first] && s.chk.cursor === G.checklist.stops()[1], 'ENT checks and moves on');
  mt('outer', -1); G.press('clr', 'mfd');
  expect(!G.checklist.checked()[first], 'CLR unchecks');
  drawAll('checklist');
  sk('mfd', 11);
  expect(/emergency/i.test(G.checklist.group().group) && s.chk.cursor === 'list', 'Emergency softkey');
  mt('inner', 3);
  expect(s.chk.list === 3, `small knob on CHECKLIST: ${s.chk.list}`);
  for (let i = 0; i < 60 && s.chk.cursor !== 'next'; i++) G.press('ent', 'mfd');
  expect(G.checklist.finished(), 'every item checked');
  drawAll('checklist finished');
  G.press('ent', 'mfd');
  expect(s.chk.list === 4, `Go to Next Checklist: ${s.chk.list}`);
  sk('mfd', 10);
  expect(!G.checklist.isOpen() && G.menu('mfd') === 'mfd', 'Checklist Exit');
  expect(G1000_CHECKLISTS.every((g) => g.lists.every((l) => l.name && l.items.length && l.items.every((it) => Array.isArray(it) && it.length >= 1 && it.length <= 2 && it.every((x) => typeof x === 'string' && x.trim())))),
    'checklist data: [challenge, response] or [note] strings');

  // Every new window and option draws.
  G.reset();
  G.setWind(225, 35);
  for (const w of ['1', '2', '3']) { s.windShow = w; drawAll('wind ' + w); }
  s.brg = ['NAV1', 'GPS']; s.dme.on = true; s.dme.src = 'HOLD'; s.dme.hold = 108.0;
  G.fms.activatePlan(['KPAE', 'KBVS']); s.fms.ptk.on = 'On';
  s.pfdMap.layout = 'Inset Map'; s.pfdMapSet.orient = 'Track Up'; s.mapSet.orient = 'Track Up';
  drawAll('bearings, DME, parallel track, track up');
  G.fail('gps', true); drawAll('LOI');
  }

  // Audio panel: COM1 transmitting and received at power-up; COM2 MIC
  // moves the transmitter (and the PFD's green), keeping COM1's receive;
  // the transmitting COM's receive can't go off; toggles light; the
  // volume knob.
  {
    G.reset();
    const gm = G.gma, ga = s.gma, on = (...ks) => ks.every((k) => gm.lit(k)), off = (...ks) => ks.every((k) => !gm.lit(k));
    expect(on('com1_mic', 'com1') && off('com2_mic', 'com2', 'spkr', 'nav1', 'pilot', 'coplt'), 'GMA power-up: COM1 MIC and COM1 only');
    G.press('gma:com2_mic');
    expect(on('com2_mic', 'com2', 'com1') && off('com1_mic') && gm.transmitting() === 2, 'COM2 MIC');
    G.press('gma:com2');
    expect(on('com2') && /transmitting/.test(s.note?.text), 'the transmitting COM stays received');
    G.press('gma:com1');
    expect(off('com1'), 'COM1 receive off');
    for (const k of ['spkr', 'mkr_mute', 'hi_sens', 'nav1', 'nav2', 'dme', 'adf', 'aux', 'man_sq', 'pilot', 'coplt']) {
      G.press('gma:' + k);
      expect(gm.lit(k), `GMA ${k} on`);
      G.press('gma:' + k);
      expect(!gm.lit(k), `GMA ${k} off again`);
    }
    G.press('gma:pa');
    expect(on('pa') && off('com1_mic', 'com2_mic') && gm.transmitting() === null, 'PA: no COM transmitting');
    G.press('gma:com12');
    expect(on('com12', 'com1_mic', 'com1', 'com2') && off('pa'), 'COM 1/2 split');
    G.press('gma:com3_mic');
    expect(gm.transmitting() === 1 && /COM3/.test(s.note?.text), 'COM3 not installed');
    G.press('gma:play');
    expect(on('play'), 'PLAY lit');
    run(5);
    expect(off('play'), 'PLAY goes out when done');
    G.turn('gma_vol', 'outer', 2);
    expect(ga.vol.sq === 40 && /MAN SQ/.test(s.note?.text), 'squelch needs MAN SQ');
    G.press('gma:man_sq'); G.turn('gma_vol', 'outer', 2); G.turn('gma_vol', 'inner', -3);
    G.push('gma_vol'); G.turn('gma_vol', 'inner', 1);
    expect(ga.vol.sq === 50 && ga.vol.pilot === 55 && ga.vol.pass === 75, `GMA volumes ${JSON.stringify(ga.vol)}`);
    // The 3D panel: a key per part, and an annunciator lit with its key.
    const av = window.FLIGHT_DEBUG?.avionics, PK = G1000_PANEL.KEYS;
    expect(G1000_GMA.KEYS.every((k) => PK[k + '_key'] === 'gma:' + k), 'every audio panel key wired');
    if (av?.leds) {
      expect(av.leds.length === G1000_GMA.KEYS.length, `audio annunciators: ${av.leds.length}`);
      av.tick();
      expect(av.leds.every((l) => l.led.visible === gm.lit(l.key)), 'annunciators follow the keys');
    }
    drawAll('audio panel');
  }

  // DISPLAY BACKUP: both displays reverted; the MFD's keys work the PFD;
  // Engine on the PFD's softkeys reaches the EIS pages; pressed again,
  // back to normal with the PFD's own menu.
  {
    G.reset();
    G.press('display_backup', 'pfd');
    expect(s.reversion && G.labels('mfd')[0] === 'Engine' && G.menu('mfd') === 'pfd', `reverted: ${G.labels('mfd')}`);
    drawAll('reversionary');
    G.press('softkey:5', 'mfd');
    expect(s.cdi === 'VOR1', `MFD softkey works the PFD's CDI: ${s.cdi}`);
    G.press('softkey:0', 'mfd'); G.press('softkey:1', 'mfd');
    expect(G.menu('pfd') === 'lean' && s.eisPage === 'Lean', `reverted Engine, Lean: ${G.menu('pfd')} ${s.eisPage}`);
    drawAll('reversionary lean');
    G.turn('hdg', '', 10, 'mfd');
    expect(s.hdgBug === 350, `MFD HDG knob in reversion: ${s.hdgBug}`);
    G.press('display_backup', 'mfd');
    expect(!s.reversion && G.menu('pfd') === 'pfd' && G.labels('pfd')[0] === '' && s.eisPage === 'Engine', `back to normal: ${G.menu('pfd')}`);
  }

  // Panel switches (js/g1000-systems.js): the MASTER interlock, buses and
  // displays, STBY BATT, avionics bus 2 and the autopilot.
  {
    G.reset();
    const sys = () => s.sys, sw = () => s.sys.sw, Y = G.systems;
    Y.setSwitch('bat', false);
    expect(!sw().alt, 'MASTER BAT off should take ALT off');
    Y.setSwitch('alt', true);
    expect(sw().bat, 'MASTER ALT on should turn BAT on');
    Y.setSwitch('bat', false);
    run(1);
    expect(sys().voltsM === 0 && !Y.buses().main, `master off: main bus ${sys().voltsM} V`);
    expect(Y.powered('pfd') && !Y.powered('mfd'), 'master off, STBY BATT ARM: PFD on the essential bus, MFD dark');
    Y.setSwitch('stby', 'off');
    run(1);
    expect(!Y.powered('pfd'), 'master off, STBY BATT OFF: the PFD should be dark');
    Y.setSwitch('stby', 'test');
    expect(Y.testLamp(), 'STBY BATT TEST should light the lamp (battery charged)');
    run(2);
    expect(sw().stby === 'off', `TEST should spring back to OFF: ${sw().stby}`);

    G.reset();
    G.press('ap');
    Y.setSwitch('avn2', false);
    run(1);
    expect(!a().ap, 'AVIONICS BUS 2 off should disconnect the autopilot');
    G.press('ap');
    expect(!a().ap, 'the autopilot should not engage with BUS 2 off');
  }

  // The ignition switch: one magneto drops the RPM, OFF stops the engine,
  // START springs back to BOTH.
  {
    G.reset();
    run(1);
    const both = s.sys.rpm;
    G.turn('mags', '', -1);
    run(1);
    expect(s.sys.sw.mags === 'l' && s.sys.rpm < both && both - s.sys.rpm <= 150, `L: ${s.sys.rpm} vs ${both}`);
    G.turn('mags', '', -2);
    run(1);
    expect(s.sys.sw.mags === 'off' && !s.sys.running, `OFF should stop the engine: ${s.sys.sw.mags}`);
    G.turn('mags', '', 4);
    expect(s.sys.sw.mags === 'start', `turned to START: ${s.sys.sw.mags}`);
    run(2);
    expect(s.sys.sw.mags === 'both' && s.sys.running, `START should spring back to BOTH, running: ${s.sys.sw.mags}`);
  }

  // The magnetic compass (js/g1000-standby.js): no error level, UNOS
  // turning through north and south, ANDS on east and west.
  {
    const T = G1000_STANDBY.compass.target, off = (x, y) => angle(x, y);
    expect(off(T(0, 0, 0, 0), 0) < 0.5 && off(T(90, 0, 0, 0), 90) < 0.5, 'compass level should read the heading');
    expect(off(T(0, 0, 15, 0), 330) < 10, `right turn through N should lag (show W): ${T(0, 0, 15, 0)}`);
    expect(off(T(180, 0, 15, 0), 210) < 10, `right turn through S should lead: ${T(180, 0, 15, 0)}`);
    expect(off(T(90, 0, 15, 0), 90) < 0.5, 'no turning error on E');
    expect(T(90, 0, 0, 1) < 90 && T(270, 0, 0, 1) > 270, 'accelerating on E or W should show a turn north');
    expect(T(90, 0, 0, -1) > 90 && T(270, 0, 0, -1) < 270, 'decelerating on E or W should show a turn south');
  }

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
        problems = (play(page) + play_camera(page.context.browser) + play_cards(page.context.browser)
                    + play_tests(page.context.browser))
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
