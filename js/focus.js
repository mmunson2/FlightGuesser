// Focused questions: the ids of questions the player marked to review,
// kept in localStorage so the viewer and the notecards share one list.
// Generated "name it" questions are kept as `name-<part id>`.
window.FOCUS = (() => {
  const KEY = 'flightguesser.focused';
  function load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY)) ?? []); } catch { return new Set(); }
  }
  return {
    has: (id) => load().has(id),
    ids: () => [...load()],
    // Adds or removes the id; returns whether it is now focused.
    toggle(id) {
      const ids = load();
      if (!ids.delete(id)) ids.add(id);
      try { localStorage.setItem(KEY, JSON.stringify([...ids])); } catch { /* private mode */ }
      return ids.has(id);
    },
  };
})();
