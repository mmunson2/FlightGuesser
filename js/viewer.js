// The whole app: the 3D C172S (data/scenedata.js), hiding, the quiz, the
// start and done screens, and the 2D KPAE diagram. Adapted from
// EMTGuesser's viewer.
(function () {
  // t('quiz.wrong', { part: 'Rudder' }) fills {part} placeholders.
  const t = (key, vars = {}) => (I18N[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-t-title]').forEach((el) => { el.title = t(el.dataset.tTitle); });
  document.querySelectorAll('[data-t-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.tPlaceholder); });
  document.querySelectorAll('[data-t-aria-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAriaLabel)); });
  document.querySelectorAll('[data-t-alt]').forEach((el) => { el.alt = t(el.dataset.tAlt); });

  const SYSTEM_COLORS = {
    airframe: 0xd7dbe0, flight_controls: 0x3f6fb5, powerplant: 0x9a6b4a, fuel: 0xe0b030,
    landing_gear: 0x59606a, lights: 0xd85a5a, antennas: 0xa7adb5, pitot_static: 0x4fae6f,
    electrical: 0x3fa7a7, instruments: 0xb48ad8, g1000: 0x3b4250, autopilot: 0x4a5566,
    audio_panel: 0x44505c, cabin: 0x8c7a66, avionics: 0x5a6b8c, engine: 0x9fb3c8,
  };
  const HIGHLIGHT = 0x36c2ff, RIGHT = 0x3fcf7f, WRONG = 0xff5555, MISSED = 0xffb340;

  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x505060, 1.0));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(1, 2, 3);
  scene.add(sun);
  // From aft, so the panel and cabin aren't in shadow.
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-0.5, 1, -3);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  function decode(b64, Type) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Type(bytes.buffer);
  }

  // Dequantise uint16 positions back into metres. Each part is one mesh
  // with a material per piece (per texture: the FlightGear livery, panel
  // and G1000 bezel art); vertex colours carry the model's own material
  // colours. Textures are data URIs (data/textures.js): a file:// page
  // can't load image files into WebGL.
  const { min, scale } = SCENE_DATA;
  const loader = new THREE.TextureLoader();
  const textures = (window.SCENE_TEXTURES ?? []).map((uri) => {
    const tex = loader.load(uri);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  });
  const meshes = [];
  for (const part of SCENE_DATA.parts) {
    const pos = [], col = [], uvs = [], idx = [], groups = [], mats = [], moving = [];
    let base = 0;
    const opacity = part.glass ? 0.25 : 1;
    part.pieces.forEach((piece, i) => {
      const q = decode(piece.positions, Uint16Array);
      for (let k = 0; k < q.length; k++) pos.push(min[k % 3] + q[k] * scale[k % 3]);
      decode(piece.colors, Uint8Array).forEach((c) => col.push(c / 255));
      const n = q.length / 3;
      if (piece.uv) {
        const u = decode(piece.uv, Uint16Array);
        for (let k = 0; k < u.length; k++) uvs.push(piece.uvMin[k % 2] + u[k] * piece.uvScale[k % 2]);
      } else {
        for (let k = 0; k < n; k++) uvs.push(0, 0);
      }
      const ind = decode(piece.indices, piece.index32 ? Uint32Array : Uint16Array);
      groups.push([idx.length, ind.length, i]);
      // A piece that moves (the ignition key): its vertices, for whatever
      // moves it (js/g1000-switches.js).
      if (piece.moves) moving.push({ moves: piece.moves, first: base, count: n });
      ind.forEach((v) => idx.push(v + base));
      base += n;
      // A `behind` piece lies on another surface (FlightGear's centre wing
      // repeats the flaps): a depth offset keeps it from z-fighting.
      mats.push(new THREE.MeshStandardMaterial({
        vertexColors: true, map: piece.tex === undefined ? null : textures[piece.tex],
        roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
        ...(piece.behind ? { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 } : {}),
      }));
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(base > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    groups.forEach(([start, count, m]) => geom.addGroup(start, count, m));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, mats);
    mesh.userData = { part, baseOpacity: opacity, maps: mats.map((m) => m.map), moving };
    setOpacity(mesh, opacity);
    mesh.renderOrder = part.glass ? 2 : 0;
    scene.add(mesh);
    meshes.push(mesh);
  }
  // Highlights tint and light a part (a tint alone wouldn't show on the
  // G1000's black keys); null puts it back. `blank` drops its texture, so a
  // name-it question doesn't show the key's label.
  function paint(mesh, color, blank = false) {
    mesh.material.forEach((m, i) => {
      m.color.setHex(color ?? 0xffffff);
      m.emissive.setHex(color ?? 0x000000).multiplyScalar(color == null ? 1 : 0.45);
      const map = blank ? null : mesh.userData.maps[i];
      if (m.map !== map) { m.map = map; m.needsUpdate = true; }
    });
  }
  const meshById = Object.fromEntries(meshes.map((m) => [m.userData.part.id, m]));
  // The mock G1000 (js/g1000-panel.js): live screens, and in Operate mode
  // the keys and knobs work. A pressed key lights for a moment, a turning
  // knob while it turns.
  const avionics = G1000_PANEL.attach({
    THREE, scene, camera, renderer, controls, meshes, meshById, highlight: HIGHLIGHT,
  });
  // Parts made of several (GROUPS in build/aircraft.py): both ailerons, the
  // three nav lights. A group id works wherever a part id does in a question.
  const GROUPS = SCENE_DATA.groups;
  const groupOf = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, ids]) => ids.map((id) => [id, g])));
  const meshesOf = (id) => (GROUPS[id] ?? [id]).map((pid) => meshById[pid]).filter(Boolean);
  // Camera presets (VIEWS in build/build_model.py).
  function goView(name) {
    const v = SCENE_DATA.views[name];
    camera.position.set(...v.position);
    controls.target.set(...v.target);
    controls.update();
  }

  // Hiding. Right click hides the part under the cursor; the Hide button and
  // Delete hide the selected one. Every hide is one undoable action holding
  // the meshes it hid: a single part or a whole system (unticking it in the
  // side panel). A system's box is ticked while any of its parts shows, and
  // half-ticked when only some of them do.
  const hideBtn = document.getElementById('hide-selected');
  const undoBtn = document.getElementById('undo');
  const unhideAllBtn = document.getElementById('unhide-all');
  const submitBtn = document.getElementById('quiz-submit');
  const actions = [];
  const boxes = {};
  hideBtn.addEventListener('click', () => hide(selection));

  function sync() {
    for (const m of meshes) m.visible = !m.userData.hidden;
    for (const [sys, box] of Object.entries(boxes)) {
      const own = meshes.filter((m) => m.userData.part.system === sys);
      const shown = own.filter((m) => m.visible).length;
      box.checked = shown > 0;
      box.indeterminate = shown > 0 && shown < own.length;
    }
    if (selection.some((m) => !m.visible)) setSelection(selection.filter((m) => m.visible));
    undoBtn.disabled = unhideAllBtn.disabled = actions.length === 0;
  }
  function hide(list) {
    const fresh = list.filter((m) => !m.userData.hidden);
    if (!fresh.length) return;
    fresh.forEach((m) => { m.userData.hidden = true; });
    actions.push(fresh);
    sync();
  }
  function unhide(list) {
    list.forEach((m) => { m.userData.hidden = false; });
    // Forget them in past actions so undo doesn't replay a stale hide.
    for (let i = actions.length - 1; i >= 0; i--) {
      actions[i] = actions[i].filter((m) => m.userData.hidden);
      if (!actions[i].length) actions.splice(i, 1);
    }
    sync();
  }
  function undo() {
    if (actions.length) unhide(actions.pop());
  }
  function unhideAll() {
    unhide(meshes);
  }

  // Context parts (the cabin's seats and carpet) count under their system's box.
  const systemOfMesh = (m) => m.userData.part.system;
  const panel = document.getElementById('systems');
  // Each row: the checkbox shows or hides the system; clicking its name
  // shows only that system (one undoable hide of everything else).
  for (const sys of SCENE_DATA.systems) {
    const own = () => meshes.filter((m) => systemOfMesh(m) === sys);
    const label = t('system.' + sys);
    const row = document.createElement('div');
    row.className = 'system';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.setAttribute('aria-label', t('systems.toggle', { system: label }));
    box.addEventListener('change', () => { if (box.checked) unhide(own()); else hide(own()); });
    boxes[sys] = box;
    const solo = document.createElement('button');
    solo.type = 'button';
    solo.title = t('systems.solo', { system: label });
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = '#' + SYSTEM_COLORS[sys].toString(16).padStart(6, '0');
    const name = document.createElement('span');
    name.textContent = label;
    solo.append(swatch, name);
    solo.addEventListener('click', () => {
      unhide(own().filter((m) => m.userData.hidden));
      hide(meshes.filter((m) => systemOfMesh(m) !== sys));
    });
    row.append(box, solo);
    panel.append(row);
  }

  undoBtn.addEventListener('click', undo);
  unhideAllBtn.addEventListener('click', unhideAll);

  // Operate mode: clicks, drags and scrolling work the G1000, and no part
  // can be selected. Reset puts the flight back.
  const operateBtn = document.getElementById('operate');
  const resetBtn = document.getElementById('g1000-reset');
  function setOperate(on) {
    avionics.setOperate(on);
    operateBtn.classList.toggle('on', on);
    operateBtn.setAttribute('aria-pressed', on);
    resetBtn.hidden = !on;
    failSel.hidden = !on;
    windSel.hidden = !on;
    if (on) select(null);
    else picked.textContent = selection.length ? picked.textContent : t('viewer.none');
  }
  operateBtn.addEventListener('click', () => {
    setOperate(!avionics.operating);
    if (avionics.operating) {
      goView('panel');
      picked.textContent = t('operate.hint');
    }
  });
  // Failures (js/g1000-systems.js): choosing one fails that system, or
  // fixes it if it has failed (ticked); the last entry fixes everything.
  const failSel = document.getElementById('g1000-fail');
  function failOptions() {
    const failed = G1000.state.sys.failed;
    failSel.replaceChildren(new Option(t('tools.fail'), ''),
      ...G1000.FAILURES.map((id) => new Option(`${failed[id] ? '✓ ' : ''}${t('fail.' + id)}`, id)),
      new Option(t('tools.failClear'), '*'));
  }
  failSel.addEventListener('change', () => {
    const id = failSel.value;
    if (id === '*') G1000.FAILURES.forEach((f) => G1000.fail(f, false));
    else if (id) G1000.fail(id);
    failOptions();
  });
  failOptions();
  // Wind (js/g1000.js setWind): a few winds to see drift, crab and the
  // PFD's wind window; the one in force ticked.
  const windSel = document.getElementById('g1000-wind');
  const WINDS = [[0, 0], [270, 10], [270, 25], [180, 15], [360, 20], [90, 12], [225, 35]];
  function windOptions() {
    const w = G1000.state.wind, now = (d, v) => (w.spd === v && (v === 0 || w.dir === d % 360) ? '✓ ' : '');
    windSel.replaceChildren(new Option(t('tools.wind'), ''),
      ...WINDS.map(([d, v], i) => new Option(now(d, v) + (v ? `${String(d).padStart(3, '0')}° / ${v} kt` : t('tools.windCalm')), String(i))));
  }
  windSel.addEventListener('change', () => {
    if (windSel.value) G1000.setWind(...WINDS[+windSel.value]);
    windOptions();
  });
  windOptions();
  resetBtn.addEventListener('click', () => { avionics.reset(); failOptions(); windOptions(); });
  avionics.onTurn((said) => { picked.textContent = said; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !controlsEl.hidden) { closeControls(); return; }
    if (e.target.matches('input, select, textarea') || !startEl.hidden || !doneEl.hidden
      || !controlsEl.hidden) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Enter' && quizOn && !answered && selection.length) {
      e.preventDefault();
      submit();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
      // Mac keyboards send Backspace for the key labelled "delete".
      e.preventDefault();
      hide(selection);
    }
  });

  // Click to pick (only targets: context and glass let clicks through).
  const ray = new THREE.Raycaster();
  const picked = document.getElementById('picked');
  const partName = (mesh) => t('part.' + mesh.userData.part.id);
  // In the header, a part of a group says which: "Left aileron (ailerons)".
  const pickedName = (mesh) => {
    const g = groupOf[mesh.userData.part.id];
    return g ? t('viewer.inGroup', { part: partName(mesh), group: t('part.' + g) }) : partName(mesh);
  };
  let selection = [], downAt = null;

  function setSelection(list) {
    selection.forEach((m) => paint(m, marked.includes(m) ? m.userData.mark : null, m.userData.blank));
    selection = list;
    selection.forEach((m) => paint(m, HIGHLIGHT, m.userData.blank));
    picked.textContent = selection.length ? selection.map(pickedName).join(', ')
      : quizOn ? t('quiz.title', { category: t('category.' + settings.category) }) : t('viewer.none');
    hideBtn.hidden = !selection.length;
    submitBtn.disabled = !selection.length;
  }
  function select(mesh) {
    setSelection(mesh ? [mesh] : []);
  }
  function toggle(mesh) {
    if (!mesh) return;
    setSelection(selection.includes(mesh) ? selection.filter((m) => m !== mesh) : [...selection, mesh]);
  }

  function meshAt(e, accept) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1,
                        y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = ray.intersectObjects(meshes.filter((m) => m.visible && accept(m.userData.part)), false)[0];
    return hit ? hit.object : null;
  }

  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    // Ignore drags: they rotate (left) or pan (right) the camera.
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
    if (e.button === 2) {
      const mesh = meshAt(e, (p) => !p.glass);
      if (mesh) hide([mesh]);
    } else if (e.button === 0) {
      // Operating, a click on a G1000 or autopilot control works it.
      const said = !quizOn && avionics.click(e);
      if (said) { picked.textContent = said; return; }
      if (!quizOn && avionics.operating) return;
      const mesh = meshAt(e, (p) => p.kind === 'target');
      // Once an answer is in, the marks stay put until Next; and a name
      // question can't be picked at all, since picking shows the name.
      if (quizOn && (answered || question.type === 'name')) return;
      if (quizOn && question.answers) toggle(mesh); else select(mesh);
    }
  });
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Quiz: show a clue, the player selects the part(s) it describes and
  // submits. Questions live in i18n/questions.en.js.
  const quizEl = document.getElementById('quiz');
  const q$ = (id) => document.getElementById('quiz-' + id);
  let quizOn = false, deck = [], question = null, answered = false, asked = 0;
  // Chosen on the start screen: category id and number of questions (0 = all).
  const settings = { category: CATEGORIES[0].id, count: 10 };
  // Two categories drawn from all the others: Focused asks the questions
  // the player added with the focus button (js/focus.js), Memorize those
  // marked `rote` (numbers, limits, lists to learn by heart).
  const allQuestions = () => CATEGORIES.flatMap((c) => c.questions);
  const FOCUSED = { id: 'focused', named: false,
    get questions() { return allQuestions().filter((q) => FOCUS.has(q.id)); } };
  const ROTE = { id: 'rote', named: false, questions: allQuestions().filter((q) => q.rote) };
  const MIXES = [ROTE, FOCUSED];
  const category = () => [...CATEGORIES, ...MIXES].find((c) => c.id === settings.category);
  // One entry per answered question, for the overview at the end.
  let history = [], marked = [];

  function mark(mesh, color, blank = false) {
    mesh.userData.mark = color;
    mesh.userData.blank = blank;
    paint(mesh, color, blank);
    marked.push(mesh);
  }
  function clearMarks() {
    marked.forEach((m) => { m.userData.blank = false; paint(m, null); });
    marked = [];
    xray(false);
  }
  // While an answer shows, fade everything else so a buried answer is
  // visible. Not for the panel's keys and knobs, on the surface already:
  // fading the panel would show the engine through it.
  const onPanel = (m) => m.userData.part.ask && m.userData.part.system !== 'engine';
  function xray(on) {
    if (marked.length && marked.every(onPanel)) on = false;
    for (const m of meshes) {
      setOpacity(m, on && !marked.includes(m) ? Math.min(0.12, m.userData.baseOpacity) : m.userData.baseOpacity);
    }
  }
  function setOpacity(mesh, opacity) {
    for (const m of mesh.material) {
      m.transparent = opacity < 1;
      m.opacity = opacity;
      m.depthWrite = opacity === 1;
      m.needsUpdate = true;
    }
  }
  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Two kinds of question in a category with `named` parts (`ask` in
  // build/aircraft.py: the G1000, autopilot and audio panel keys and knobs),
  // half and half while both last: clues from i18n/questions.en.js ("find
  // it": pick the part) and generated "name it" questions. A category
  // without `named` asks only its own questions.
  const answerIds = (q) => q.answers ?? [q.answer];
  const guessInput = q$('guess');
  const askable = SCENE_DATA.parts.filter((p) => p.ask).map((p) => p.id);
  function questionPool() {
    const clues = shuffled(category().questions);
    if (category() === FOCUSED) return shuffled([...clues, ...FOCUS.ids()
      .filter((id) => id.startsWith('name-') && meshById[id.slice(5)])
      .map((id) => nameQuestion(id.slice(5)))]);
    if (!category().named) return clues;
    const named = shuffled(askable.filter((id) => category().named.includes(systemOf[id])).map(nameQuestion));
    const mixed = [];
    for (let i = 0; i < Math.max(clues.length, named.length); i++) mixed.push(clues[i], named[i]);
    return mixed.filter(Boolean);
  }
  // Engine parts are asked with the rest of the airplane hidden.
  const nameQuestion = (id) => ({ id: 'name-' + id, type: 'name', answer: id, topic: 'name',
    ...(systemOf[id] === 'engine' && { focus: 'engine', view: 'engine' }) });
  function buildDeck() {
    const pool = questionPool();
    return shuffled(settings.count ? pool.slice(0, settings.count) : pool);
  }

  // "Name the selected autopilot key.": by the part's system.
  const systemOf = Object.fromEntries(SCENE_DATA.parts.map((p) => [p.id, p.system]));
  const namePromptKey = (pid) => 'quiz.namePrompt.' + (systemOf[pid] ?? 'part');
  const namePrompt = (pid) => t(namePromptKey(pid));

  // Each question starts from the whole airplane: anything hidden comes
  // back, as with Unhide all.
  function nextQuestion() {
    clearMarks();
    question = deck.pop();
    unhideAll();
    asked++;
    answered = false;
    q$('progress').textContent = t('quiz.progress', { n: asked, total: asked + deck.length });
    const naming = question.type === 'name', typing = naming || question.type === 'text';
    // One undoable hide, so Undo or Unhide all brings the rest back.
    const focus = [].concat(question.focus ?? []);
    if (focus.length) hide(meshes.filter((m) => !focus.includes(m.userData.part.system)));
    const shown = naming ? question.answer : question.show;
    if (shown) {
      meshesOf(shown).forEach((m) => mark(m, HIGHLIGHT, naming));
      xray(true);
    }
    // Panel keys are asked from the panel view unless the question says.
    const view = question.view ?? (question.type === 'name' ? 'panel' : null);
    if (view) goView(view);
    q$('topic').textContent = t('quiz.topic.' + question.topic);
    q$('prompt').textContent = questionText(question);
    showFocus();
    q$('hint').hidden = !question.answers;
    q$('guess-form').hidden = !typing;
    q$('override').hidden = q$('keys').hidden = q$('answer').hidden = true;
    guessInput.placeholder = t(question.type === 'text' ? 'quiz.textPlaceholder' : 'quiz.guessPlaceholder');
    guessInput.value = '';
    guessInput.disabled = false;
    submitBtn.disabled = true;
    q$('result').hidden = true;
    q$('reveal').hidden = false;
    submitBtn.hidden = false;
    q$('next').hidden = true;
    if (typing) guessInput.focus();
  }
  function showFocus() {
    const on = FOCUS.has(question.id);
    q$('focus').textContent = t(on ? 'quiz.unfocus' : 'quiz.focus');
    q$('focus').title = t(on ? 'quiz.unfocusTip' : 'quiz.focusTip');
    q$('focus').setAttribute('aria-pressed', on);
  }
  q$('focus').addEventListener('click', () => { FOCUS.toggle(question.id); showFocus(); });
  // Generated name questions have no prompt of their own; written ones do.
  const questionText = (q) => q.prompt ?? namePrompt(q.answer);

  // A question has one `answer`, or several `answers` (all must be picked)
  // plus `also`: parts that are fine to pick but not required.
  // An answer that is a group is picked by picking any of its parts.
  const names = (list) => list.map(partName).join(', ');
  const idNames = (ids) => ids.map((id) => t('part.' + id)).join(', ');

  // chosen: the meshes the player picked, or null when they gave up.
  function finish(chosen) {
    answered = true;
    const ids = answerIds(question);
    const required = ids.map(meshesOf);
    const allowed = new Set([...required.flat(), ...(question.also ?? []).flatMap(meshesOf)]);
    const picks = chosen ?? [];
    const wrong = picks.filter((m) => !allowed.has(m));
    const missed = ids.filter((id, i) => !required[i].some((m) => picks.includes(m)));
    const right = picks.length > 0 && !wrong.length && !missed.length;
    history.push({ question, right, given: chosen && names(picks), answer: idNames(ids) });

    unhide(required.flat().filter((m) => m.userData.hidden));
    // A group found shows whole; one missed shows whole in orange.
    required.forEach((list, i) => list.forEach((m) =>
      mark(m, chosen && missed.includes(ids[i]) ? MISSED : RIGHT)));
    picks.filter((m) => allowed.has(m)).forEach((m) => mark(m, RIGHT));
    wrong.forEach((m) => mark(m, WRONG));
    xray(true);

    const verdict = q$('verdict');
    verdict.className = 'quiz-verdict ' + (right ? 'right' : 'wrong');
    if (!question.answers) {
      const target = idNames(ids);
      verdict.textContent = right ? t('quiz.correct', { part: target })
        : chosen ? t('quiz.wrong', { clicked: partName(picks[0]), part: target })
        : t('quiz.revealed', { part: target });
    } else if (right) {
      verdict.textContent = t('quiz.allCorrect', { parts: idNames(ids) });
    } else if (!chosen) {
      verdict.textContent = t('quiz.revealedMany', { parts: idNames(ids) });
    } else {
      verdict.textContent = [
        missed.length ? t('quiz.missed', { parts: idNames(missed) }) : '',
        wrong.length ? t('quiz.notAnswer', { parts: names(wrong) }) : '',
      ].join(' ').trim();
    }
    showResult(question);
  }

  // Explanation, source and buttons once an answer is in. `about` is the
  // question whose explanation to show, or null for none. Explanations follow
  // on from their clue, so a borrowed one (`withClue`) shows the clue first.
  function showResult(about, withClue = false) {
    q$('clue').textContent = withClue && about ? about.prompt : '';
    q$('clue').hidden = !(withClue && about);
    q$('explain').textContent = about?.explain ?? '';
    q$('explain').hidden = !about?.explain;
    q$('source').hidden = !about;
    if (about) {
      const src = SOURCES[about.source];
      q$('source').textContent = t('quiz.source', { title: src.title });
      // A printed source has no link.
      const href = about.url ?? src.url;
      if (href) q$('source').href = href; else q$('source').removeAttribute('href');
    }
    q$('result').hidden = false;
    q$('reveal').hidden = true;
    submitBtn.hidden = true;
    guessInput.disabled = true;
    q$('next').textContent = t(deck.length ? 'quiz.next' : 'quiz.finish');
    q$('next').hidden = false;
    q$('next').focus();
  }

  // Name questions: guess is the typed text, or null when they gave up. The
  // explanation borrows a single-answer clue about the same part, if there is one.
  function finishName(guess) {
    answered = true;
    const target = t('part.' + question.answer);
    const right = guess !== null && nameMatches(guess, question.answer);
    history.push({ question, right, given: guess && guess.trim(), answer: target });
    clearMarks();
    meshesOf(question.answer).forEach((m) => mark(m, right || guess === null ? RIGHT : WRONG));
    xray(true);
    const verdict = q$('verdict');
    verdict.className = 'quiz-verdict ' + (right ? 'right' : 'wrong');
    verdict.textContent = right ? t('quiz.correct', { part: target })
      : guess !== null ? t('quiz.nameWrong', { guess: guess.trim(), part: target })
      : t('quiz.revealed', { part: target });
    if (question.prompt) { showResult(question); return; }
    // (Focused and Memorize borrow from every category.)
    const bank = MIXES.includes(category()) ? allQuestions() : category().questions;
    const related = shuffled(bank.filter((q) => q.answer === question.answer && q.type !== 'name'))[0];
    showResult(related ?? null, true);
  }

  // Text questions (js/grade.js): guess is the typed text, or null when they
  // gave up. Each idea in `keys` shows as found or missing, then the model
  // answer. A wrong verdict can be overruled with "I was right", since
  // keyword matching misses answers worded another way.
  function finishText(guess) {
    answered = true;
    const result = guess === null ? null : GRADE.grade(question, guess);
    const right = !!result?.right;
    history.push({ question, right, given: guess && guess.trim(), answer: question.answer });
    const verdict = q$('verdict');
    verdict.className = 'quiz-verdict ' + (right ? 'right' : 'wrong');
    verdict.textContent = !result ? t('quiz.textRevealed')
      : right ? t('quiz.textCorrect')
      : result.forbidden.length ? t('quiz.textForbidden', { words: result.forbidden.join(', ') })
      : t('quiz.textMissing', { n: result.missed.length });
    q$('keys').replaceChildren(...(result ? question.keys.map((idea, i) => {
      const li = document.createElement('li');
      li.className = result.hit.includes(i) ? 'right' : 'wrong';
      li.textContent = (result.hit.includes(i) ? '✓ ' : '✗ ') + idea[0];
      return li;
    }) : []));
    q$('keys').hidden = !result;
    q$('answer').textContent = t('quiz.textAnswer', { answer: question.answer });
    q$('answer').hidden = false;
    q$('override').hidden = !result || right;
    showResult(question);
  }
  q$('override').addEventListener('click', () => {
    history[history.length - 1].right = true;
    history[history.length - 1].overruled = true;
    q$('verdict').className = 'quiz-verdict right';
    q$('verdict').textContent = t('quiz.textOverruled');
    q$('override').hidden = true;
    q$('next').focus();
  });

  // Typed answers: case, accents, punctuation, word order, "the"/"of" and
  // plural -s don't matter, and the display name or any `alias.<id>` counts.
  // "Left" and "right" count only for names that have one (left aileron):
  // "left flaps" is the flaps. Small typos pass only when no other part is
  // as close a match.
  // (Not "a": taxiway A, class A airspace.)
  const STOP = new Set(['the', 'of', 'an', 'and']);
  const SIDE = /\b(left|right)\b/;
  function nameKey(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w))
      .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w))
      .sort().join(' ');
  }
  const sideless = (key) => key.split(' ').filter((w) => !SIDE.test(w)).join(' ');
  // The guess's key as compared with one of a part's name keys.
  const asFor = (key, name) => (SIDE.test(name) ? key : sideless(key));
  const namedIds = [...SCENE_DATA.parts.filter((p) => p.kind === 'target').map((p) => p.id),
    ...Object.keys(GROUPS)];
  const nameKeys = Object.fromEntries(namedIds.map((id) => {
    const aliases = I18N['alias.' + id] ? I18N['alias.' + id].split('|') : [];
    return [id, [t('part.' + id), ...aliases].map(nameKey)];
  }));
  const distance = GRADE.distance;
  // Part ids whose name the key is exactly, preferring a name with its side.
  function exactly(key, ids) {
    const sided = ids.filter((id) => nameKeys[id].includes(key));
    return sided.length ? sided : ids.filter((id) => nameKeys[id].includes(sideless(key)));
  }
  function nameMatches(guess, id) {
    const key = nameKey(guess);
    if (!key) return false;
    const exact = exactly(key, Object.keys(nameKeys));
    if (exact.length) return exact.includes(id);
    // Short names ("NAV1 key") must be exact: one letter off is another key.
    const best = (pid) => Math.min(...nameKeys[pid].map((k) => (k.length < 5 ? Infinity : distance(asFor(key, k), k))));
    const own = best(id);
    const allowed = key.length >= 10 ? 2 : key.length >= 5 ? 1 : 0;
    return own <= allowed && Object.keys(nameKeys).every((pid) => pid === id || best(pid) > own);
  }

  function submit() {
    if (!quizOn || answered) return;
    if (question.type === 'name' || question.type === 'text') {
      if (guessInput.value.trim()) (question.type === 'name' ? finishName : finishText)(guessInput.value);
      return;
    }
    if (!selection.length) return;
    const choice = selection;
    setSelection([]);
    finish(choice);
  }

  function setQuiz(on) {
    quizOn = on;
    quizEl.hidden = !on;
    newQuizBtn.hidden = on;
    // Clicks are the quiz's while it runs.
    if (on) setOperate(false);
    operateBtn.hidden = on;
    select(null);
    clearMarks();
    unhideAll();
    if (on) showDiagram(false);
    lockScene(on);
    if (on) {
      history = [];
      deck = buildDeck();
      asked = 0;
      nextQuestion();
    }
  }

  // Start screen: pick a category and length. Explore
  // closes it with the quiz off; "New quiz" brings it back.
  const startEl = document.getElementById('start');
  const startForm = document.getElementById('start-form');
  const doneEl = document.getElementById('done');
  const newQuizBtn = document.getElementById('new-quiz');
  const COUNTS = [5, 10, 20, 0];
  const choice = (name, value, text, checked, tip) => {
    const label = document.createElement('label');
    label.className = 'choice';
    if (tip) label.title = tip;
    const input = Object.assign(document.createElement('input'), { type: 'radio', name, value, checked });
    const span = document.createElement('span');
    span.textContent = text;
    label.append(input, span);
    return label;
  };
  document.getElementById('start-categories').append(...[...CATEGORIES, ...MIXES].map((c) =>
    choice('category', c.id, t('category.' + c.id), c.id === settings.category, t('category.' + c.id + '.tip'))));
  // Count options depend on how many questions the category has.
  function renderCounts() {
    const available = questionPool().length;
    const chosen = Number(startForm.elements.count?.value ?? settings.count);
    const counts = COUNTS.filter((n) => n < available);
    const box = document.getElementById('start-counts');
    box.replaceChildren(...counts.map((n) =>
      choice('count', n, n ? String(n) : t('start.countAll', { n: available }), false)));
    const pick = counts.includes(chosen) ? chosen : 0;
    if (available) box.querySelector(`input[value="${pick}"]`).checked = true;
    document.getElementById('start-go').disabled = !available;
  }
  // Aircraft/diagram toggle, top right of the stage, with the camera
  // presets. The diagram is a 2D picture over the stage; the quiz is on the
  // aircraft, so the toggle is locked while one runs.
  const sceneToggle = document.getElementById('scene-toggle');
  const viewsEl = document.getElementById('views');
  const diagramEl = document.getElementById('diagram');
  sceneToggle.append(...['aircraft', 'diagram'].map((id) => choice('scene', id, t('scene.' + id), id === 'aircraft')));
  sceneToggle.addEventListener('change', (e) => showDiagram(e.target.value === 'diagram'));
  viewsEl.append(...Object.keys(SCENE_DATA.views).map((name) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: t('view.' + name) });
    // A view with `solo` (the engine, under the cowling) shows those
    // systems alone, as one undoable hide.
    b.addEventListener('click', () => {
      const solo = SCENE_DATA.views[name].solo;
      if (solo) {
        unhide(meshes.filter((m) => m.userData.hidden && solo.includes(systemOfMesh(m))));
        hide(meshes.filter((m) => !solo.includes(systemOfMesh(m))));
      }
      goView(name);
    });
    return b;
  }));
  function showDiagram(on) {
    sceneToggle.querySelector(`input[value="${on ? 'diagram' : 'aircraft'}"]`).checked = true;
    diagramEl.hidden = !on;
    viewsEl.hidden = on;
    document.body.classList.toggle('diagram-on', on);
    if (on) DIAGRAM.show();
  }
  function lockScene(locked) {
    sceneToggle.querySelectorAll('input').forEach((input) => { input.disabled = locked; });
    sceneToggle.title = locked ? t('scene.locked') : '';
  }
  startForm.addEventListener('change', (e) => {
    if (e.target.name === 'category') settings.category = e.target.value;
    if (e.target.name !== 'count') renderCounts();
  });
  function showStart() {
    setQuiz(false);
    doneEl.hidden = true;
    newQuizBtn.hidden = true;
    renderCounts();
    startEl.hidden = false;
    document.getElementById('start-go').focus();
  }
  startForm.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.assign(settings, {
      category: startForm.elements.category.value,
      count: Number(startForm.elements.count.value),
    });
    startEl.hidden = true;
    setQuiz(true);
  });
  function explore() {
    startEl.hidden = doneEl.hidden = true;
    setQuiz(false);
  }
  document.getElementById('start-explore').addEventListener('click', explore);
  document.getElementById('done-explore').addEventListener('click', explore);
  document.getElementById('done-again').addEventListener('click', showStart);
  newQuizBtn.addEventListener('click', showStart);
  q$('quit').addEventListener('click', explore);

  // Controls popup: opened from the header, closed by its button, Escape or
  // a click on the backdrop. Focus goes back to where it was.
  const controlsEl = document.getElementById('controls');
  let controlsReturn = null;
  function closeControls() {
    controlsEl.hidden = true;
    controlsReturn?.focus();
  }
  document.getElementById('controls-open').addEventListener('click', () => {
    controlsReturn = document.activeElement;
    controlsEl.hidden = false;
    document.getElementById('controls-close').focus();
  });
  document.getElementById('controls-close').addEventListener('click', closeControls);
  controlsEl.addEventListener('click', (e) => { if (e.target === controlsEl) closeControls(); });

  function finishQuiz() {
    const right = history.filter((h) => h.right).length, total = history.length;
    const pct = total ? Math.round((100 * right) / total) : 0;
    document.getElementById('done-title').textContent = t('done.title');
    document.getElementById('done-score').textContent = t('done.score', { right, total, pct });
    // Per-topic tally, then every question with the player's answer.
    const topics = [...new Set(history.map((h) => h.question.topic))];
    document.getElementById('done-topics').replaceChildren(...topics.map((topic) => {
      const of = history.filter((h) => h.question.topic === topic);
      const li = document.createElement('li');
      li.textContent = t('done.topic', {
        topic: t('quiz.topic.' + topic), right: of.filter((h) => h.right).length, total: of.length });
      return li;
    }));
    document.getElementById('done-list').replaceChildren(...history.map((h, i) => {
      const li = document.createElement('li');
      li.className = h.right ? 'right' : 'wrong';
      const prompt = document.createElement('p');
      prompt.className = 'done-prompt';
      prompt.textContent = t('done.number', { n: i + 1 }) + ' ' + questionText(h.question);
      const detail = document.createElement('p');
      detail.className = 'done-detail';
      detail.textContent = h.overruled ? t('done.overruled', { given: h.given, answer: h.answer })
        : h.right && h.question.type === 'text' ? t('done.rightText', { given: h.given, answer: h.answer })
        : h.right ? t('done.right', { answer: h.answer })
        : h.given ? t('done.wrong', { given: h.given, answer: h.answer })
        : t('done.revealed', { answer: h.answer });
      li.append(prompt, detail);
      return li;
    }));
    setQuiz(false);
    newQuizBtn.hidden = true;
    doneEl.hidden = false;
    document.getElementById('done-again').focus();
  }

  q$('reveal').addEventListener('click', () => {
    if (answered) return;
    select(null);
    if (question.type === 'name') finishName(null);
    else if (question.type === 'text') finishText(null);
    else finish(null);
  });
  submitBtn.addEventListener('click', submit);
  q$('guess-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  guessInput.addEventListener('input', () => {
    submitBtn.disabled = !guessInput.value.trim();
  });
  q$('next').addEventListener('click', () => (deck.length ? nextQuestion() : finishQuiz()));

  function resize() {
    const { clientWidth: w, clientHeight: h } = stage;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  goView(Object.keys(SCENE_DATA.views)[0]);
  renderer.setAnimationLoop(() => { controls.update(); avionics.tick(); renderer.render(scene, camera); });
  showStart();

  // For tools/check.py and tools/shot.py, which drive the page headless.
  // Not used by the app itself.
  window.FLIGHT_DEBUG = {
    THREE, renderer, camera, controls, nameKey, nameMatches, GRADE, namePromptKey, settings,
    meshes: () => meshes, meshById: () => meshById, meshesOf, GROUPS, askable,
    showDiagram, goView, explore, question: () => question, avionics, setOperate,
    select: (id) => setSelection(meshesOf(id)),
    solo: (systems) => {
      unhideAll();
      hide(meshes.filter((m) => !systems.includes(m.userData.part.system)));
    },
    hide: (ids) => hide(ids.flatMap(meshesOf)),
  };
})();
