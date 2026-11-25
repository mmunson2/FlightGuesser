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
  expect(run(90, () => angle(s.hdg, s.hdgBug) < 1 && Math.abs(s.roll) < 1), `HDG: heading ${s.hdg.toFixed(1)} vs bug ${s.hdgBug}`);
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
