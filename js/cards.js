// Notecards (cards.html): every bank's typed questions without the 3D
// scenes, for phones, which index.html sends here. Same questions, grader
// (js/grade.js) and result layout as the viewer's text questions.
(function () {
  const t = (key, vars = {}) => (I18N[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-t-title]').forEach((el) => { el.title = t(el.dataset.tTitle); });
  document.querySelectorAll('[data-t-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.tPlaceholder); });
  document.querySelectorAll('[data-t-aria-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAriaLabel)); });

  const $ = (id) => document.getElementById(id);
  const q$ = (id) => $('quiz-' + id);
  // Typed questions only, and not those about a highlighted part (`show`).
  const POOL = CATEGORIES.flatMap((c) => c.questions).filter((q) => q.type === 'text' && !q.show);
  const COUNTS = [10, 20, 50, 0];
  const startForm = $('start-form'), quizEl = $('quiz'), doneEl = $('done');
  const guessInput = q$('guess'), submitBtn = q$('submit');
  let deck = [], history = [], question = null, asked = 0, answered = false;

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Which questions: all of them, the ones to learn by heart (`rote`), or
  // those added with the focus button (js/focus.js), which is off while
  // none of the pool is focused.
  const WHICH = {
    all: () => POOL,
    rote: () => POOL.filter((q) => q.rote),
    focused: () => POOL.filter((q) => FOCUS.has(q.id)),
  };
  const choice = (name, value, text, checked, disabled = false, tip = '') => {
    const label = document.createElement('label');
    label.className = 'choice';
    label.title = tip;
    const input = Object.assign(document.createElement('input'), { type: 'radio', name, value, checked, disabled });
    const span = document.createElement('span');
    span.textContent = text;
    label.append(input, span);
    return label;
  };
  let which = 'all';
  const pool = () => WHICH[which]();
  function renderStart() {
    if (!pool().length) which = 'all';
    $('start-which').replaceChildren(...Object.entries(WHICH).map(([id, of]) => choice('which', id,
      t('cards.which.' + id, { n: of().length }), id === which, !of().length,
      id === 'all' ? '' : t('cards.which.' + id + '.tip'))));
    const available = pool().length;
    $('start-go').disabled = !available;
    $('start-which').hidden = !POOL.length;
    const chosen = Number(startForm.elements.count?.value ?? COUNTS[0]);
    const counts = COUNTS.filter((n) => n < available);
    const pick = counts.includes(chosen) ? chosen : 0;
    $('start-counts').replaceChildren(...counts.map((n) =>
      choice('count', n, n ? String(n) : t('start.countAll', { n: available }), n === pick)));
    if (!POOL.length) $('start-counts').textContent = t('cards.none');
  }
  renderStart();
  startForm.addEventListener('change', (e) => {
    if (e.target.name === 'which') { which = e.target.value; renderStart(); }
  });

  function show(screen) {
    if (screen === 'start') renderStart();
    startForm.hidden = screen !== 'start';
    quizEl.hidden = screen !== 'quiz';
    doneEl.hidden = screen !== 'done';
  }
  startForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const count = Number(startForm.elements.count.value);
    deck = shuffled(pool()).slice(0, count || pool().length);
    history = [];
    asked = 0;
    show('quiz');
    nextQuestion();
  });

  function nextQuestion() {
    question = deck.pop();
    asked++;
    answered = false;
    q$('progress').textContent = t('quiz.progress', { n: asked, total: asked + deck.length });
    q$('topic').textContent = t('quiz.topic.' + question.topic);
    q$('prompt').textContent = question.prompt;
    showFocus();
    q$('result').hidden = q$('override').hidden = true;
    guessInput.value = '';
    guessInput.disabled = false;
    submitBtn.disabled = true;
    submitBtn.hidden = q$('reveal').hidden = false;
    q$('next').hidden = true;
    guessInput.focus();
  }

  // guess: the typed text, or null when they gave up. Each idea in `keys`
  // shows as found or missing, then the model answer; "I was right"
  // overrules a wrong verdict.
  function finish(guess) {
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
    q$('explain').textContent = question.explain ?? '';
    q$('explain').hidden = !question.explain;
    const src = SOURCES[question.source];
    q$('source').textContent = t('quiz.source', { title: src.title });
    // A printed source (the POH) has no link.
    const href = question.url ?? src.url;
    if (href) q$('source').href = href; else q$('source').removeAttribute('href');
    q$('override').hidden = !result || right;
    q$('result').hidden = false;
    q$('reveal').hidden = submitBtn.hidden = true;
    guessInput.disabled = true;
    q$('next').textContent = t(deck.length ? 'quiz.next' : 'quiz.finish');
    q$('next').hidden = false;
    q$('next').focus();
  }

  function submit() {
    if (!answered && guessInput.value.trim()) finish(guessInput.value);
  }
  submitBtn.addEventListener('click', submit);
  q$('guess-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  guessInput.addEventListener('input', () => { submitBtn.disabled = !guessInput.value.trim(); });
  q$('reveal').addEventListener('click', () => { if (!answered) finish(null); });
  q$('override').addEventListener('click', () => {
    Object.assign(history[history.length - 1], { right: true, overruled: true });
    q$('verdict').className = 'quiz-verdict right';
    q$('verdict').textContent = t('quiz.textOverruled');
    q$('override').hidden = true;
    q$('next').focus();
  });
  function showFocus() {
    const on = FOCUS.has(question.id);
    q$('focus').textContent = t(on ? 'quiz.unfocus' : 'quiz.focus');
    q$('focus').title = t(on ? 'quiz.unfocusTip' : 'quiz.focusTip');
    q$('focus').setAttribute('aria-pressed', on);
  }
  q$('focus').addEventListener('click', () => { FOCUS.toggle(question.id); showFocus(); });
  q$('next').addEventListener('click', () => (deck.length ? nextQuestion() : finishQuiz()));
  q$('quit').addEventListener('click', () => show('start'));
  $('done-again').addEventListener('click', () => show('start'));

  function finishQuiz() {
    const right = history.filter((h) => h.right).length, total = history.length;
    $('done-score').textContent = t('done.score', { right, total, pct: Math.round((100 * right) / total) });
    const topics = [...new Set(history.map((h) => h.question.topic))];
    $('done-topics').replaceChildren(...topics.map((topic) => {
      const of = history.filter((h) => h.question.topic === topic);
      const li = document.createElement('li');
      li.textContent = t('done.topic', {
        topic: t('quiz.topic.' + topic), right: of.filter((h) => h.right).length, total: of.length });
      return li;
    }));
    $('done-list').replaceChildren(...history.map((h, i) => {
      const li = document.createElement('li');
      li.className = h.right ? 'right' : 'wrong';
      const prompt = document.createElement('p');
      prompt.className = 'done-prompt';
      prompt.textContent = t('done.number', { n: i + 1 }) + ' ' + h.question.prompt;
      const detail = document.createElement('p');
      detail.className = 'done-detail';
      detail.textContent = t(h.overruled ? 'done.overruled' : h.right ? 'done.rightText'
        : h.given ? 'done.wrong' : 'done.revealed', { given: h.given, answer: h.answer });
      li.append(prompt, detail);
      return li;
    }));
    show('done');
    $('done-again').focus();
  }

  // For tools/check.py. Not used by the page itself.
  window.CARDS_DEBUG = { pool: POOL, question: () => question };
})();
