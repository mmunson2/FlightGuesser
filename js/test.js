// Practice tests (test.html): the multiple-choice tests in
// i18n/tests.en.js, taken like a paper exam. Every question is on one page;
// nothing is marked until the test is submitted, then each shows the right
// choice, the player's, and the explanation and source of the question it
// was written from (`from`). Choices are shuffled per sitting.
(function () {
  const t = (key, vars = {}) => (I18N[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });

  const $ = (id) => document.getElementById(id);
  const BANK = Object.fromEntries(CATEGORIES.flatMap((c) => c.questions).map((q) => [q.id, q]));
  const TESTS = window.PRACTICE_TESTS;
  const SCORES_KEY = 'flightguesser.tests';
  const startForm = $('start-form'), testForm = $('test');
  let test = null, sitting = [], submitted = false;

  const scores = () => {
    try { return JSON.parse(localStorage.getItem(SCORES_KEY)) ?? {}; } catch { return {}; }
  };
  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderStart() {
    const last = scores();
    $('start-go').disabled = !TESTS.length;
    $('start-tests').textContent = TESTS.length ? '' : t('tests.none');
    if (!TESTS.length) return;
    const picked = startForm.elements.test?.value ?? TESTS[0].id;
    $('start-tests').replaceChildren(...TESTS.map((tst, i) => {
      const label = document.createElement('label');
      label.className = 'choice';
      const input = Object.assign(document.createElement('input'),
        { type: 'radio', name: 'test', value: tst.id, checked: tst.id === picked });
      const span = document.createElement('span');
      span.textContent = t('tests.name', { n: i + 1 })
        + (tst.id in last ? ' · ' + t('tests.last', { pct: last[tst.id] }) : '');
      label.append(input, span);
      return label;
    }));
  }
  function show(screen) {
    if (screen === 'start') renderStart();
    startForm.hidden = screen !== 'start';
    testForm.hidden = screen !== 'test';
    window.scrollTo(0, 0);
  }

  function begin(id) {
    test = TESTS.find((tst) => tst.id === id);
    submitted = false;
    sitting = test.items.map((item) => ({ item, from: BANK[item.from],
      choices: shuffled([item.correct, ...item.close, ...(item.wrong ?? [])]) }));
    $('test-title').textContent = t('tests.heading', { n: TESTS.indexOf(test) + 1, count: sitting.length });
    $('test-score').hidden = $('test-topics').hidden = $('test-retake').hidden = true;
    $('test-submit').hidden = false;
    $('test-list').replaceChildren(...sitting.map((s, i) => {
      const li = document.createElement('li');
      const prompt = document.createElement('p');
      prompt.className = 'test-prompt';
      prompt.textContent = t('done.number', { n: i + 1 }) + ' ' + s.item.prompt;
      const options = document.createElement('div');
      options.className = 'test-options';
      options.append(...s.choices.map((text, j) => {
        const label = document.createElement('label');
        label.className = 'test-option';
        const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'q' + i, value: j });
        const span = document.createElement('span');
        span.textContent = String.fromCharCode(65 + j) + '. ' + text;
        label.append(input, span);
        return label;
      }));
      li.append(prompt, options);
      s.li = li;
      return li;
    }));
    updateSubmit();
    show('test');
  }

  const chosen = (i) => testForm.elements['q' + i].value;
  function updateSubmit() {
    const left = sitting.filter((_, i) => chosen(i) === '').length;
    $('test-submit').textContent = left ? t('tests.unanswered', { n: left }) : t('tests.submit');
  }

  function mark() {
    submitted = true;
    sitting.forEach((s, i) => {
      const pick = chosen(i) === '' ? null : s.choices[Number(chosen(i))];
      s.right = pick === s.item.correct;
      s.li.className = s.right ? 'right' : 'wrong';
      s.li.querySelectorAll('.test-option').forEach((label, j) => {
        label.querySelector('input').disabled = true;
        if (s.choices[j] === s.item.correct) label.classList.add('correct');
        else if (s.choices[j] === pick) label.classList.add('picked');
      });
      const notes = [];
      if (!pick) notes.push(Object.assign(document.createElement('p'),
        { className: 'test-blank', textContent: t('tests.blank') }));
      const from = s.from;
      const explain = [from.type === 'text' ? from.answer : '', from.explain ?? ''].filter(Boolean).join(' ');
      if (explain) notes.push(Object.assign(document.createElement('p'), { className: 'quiz-explain', textContent: explain }));
      const src = SOURCES[from.source];
      const link = Object.assign(document.createElement('a'), { className: 'quiz-source', target: '_blank', rel: 'noopener',
        textContent: t('quiz.source', { title: src.title }) });
      const href = from.url ?? src.url;
      if (href) link.href = href;
      const focus = Object.assign(document.createElement('button'), { type: 'button', className: 'test-focus' });
      const showFocus = () => {
        const on = FOCUS.has(from.id);
        focus.textContent = t(on ? 'quiz.unfocus' : 'quiz.focus');
        focus.title = t(on ? 'quiz.unfocusTip' : 'quiz.focusTip');
        focus.setAttribute('aria-pressed', on);
      };
      focus.addEventListener('click', () => { FOCUS.toggle(from.id); showFocus(); });
      showFocus();
      const foot = document.createElement('div');
      foot.className = 'test-foot';
      foot.append(link, focus);
      s.li.append(...notes, foot);
    });
    const right = sitting.filter((s) => s.right).length, total = sitting.length;
    const pct = Math.round((100 * right) / total);
    $('test-score').textContent = t('tests.score', { right, total, pct });
    const topics = [...new Set(sitting.map((s) => s.from.topic))];
    $('test-topics').replaceChildren(...topics.map((topic) => {
      const of = sitting.filter((s) => s.from.topic === topic);
      return Object.assign(document.createElement('li'), { textContent: t('done.topic', {
        topic: t('quiz.topic.' + topic), right: of.filter((s) => s.right).length, total: of.length }) });
    }));
    $('test-score').hidden = $('test-topics').hidden = false;
    $('test-submit').hidden = true;
    $('test-retake').hidden = false;
    try { localStorage.setItem(SCORES_KEY, JSON.stringify({ ...scores(), [test.id]: pct })); } catch { /* private mode */ }
    window.scrollTo(0, 0);
  }

  renderStart();
  startForm.addEventListener('submit', (e) => { e.preventDefault(); begin(startForm.elements.test.value); });
  testForm.addEventListener('change', () => { if (!submitted) updateSubmit(); });
  testForm.addEventListener('submit', (e) => { e.preventDefault(); if (!submitted) mark(); });
  $('test-retake').addEventListener('click', () => begin(test.id));
  $('test-quit').addEventListener('click', () => show('start'));

  // For tools/check.py. Not used by the page itself.
  window.TEST_DEBUG = { bank: BANK, sitting: () => sitting };
})();
