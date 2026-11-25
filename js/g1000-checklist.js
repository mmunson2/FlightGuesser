// The mock G1000's Checklist page (used by js/g1000.js): the POH's
// checklists (js/g1000-checklists.js) on the MFD, in place of the map.
//
// The Checklist softkey opens it; Exit closes it, and Emergency jumps to
// the emergency group. The large FMS knob moves the cursor through the
// GROUP and CHECKLIST fields, then down the items, then "Go to Next
// Checklist?". On GROUP or CHECKLIST the small knob picks another. ENT on
// an item checks it (green) and moves on; on GROUP or CHECKLIST it goes
// to the first item; on "Go to Next Checklist?" it opens the next one.
// CLR unchecks the item under the cursor. Headings and notes in a list
// are shown but the cursor passes over them. When every item is checked
// the list says CHECKLIST FINISHED.
window.G1000_CHECKLIST = (function () {
  function create({ state, lists }) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const C = () => state.chk;
    // cursor: 'group', 'list', an item index, or 'next'. checked: per
    // checklist ('group/list'), the items checked.
    const fresh = () => ({ open: false, group: 0, list: 0, cursor: 'group', checked: {} });

    const group = () => lists[C().group];
    const list = () => group()?.lists[C().list];
    const key = () => `${C().group}/${C().list}`;
    // The items the cursor stops on: those with a response.
    const stops = () => (list()?.items ?? []).map((it, i) => (it.length > 1 ? i : null)).filter((i) => i != null);
    const checked = () => (C().checked[key()] ??= []);
    const finished = () => stops().every((i) => checked()[i]);

    function open() { C().open = true; }
    function close() { C().open = false; }
    const isOpen = () => !!C().open && !!lists.length;
    function emergency() {
      const g = lists.findIndex((x) => /emergency/i.test(x.group));
      Object.assign(C(), { open: true, group: Math.max(0, g), list: 0, cursor: 'list' });
    }
    function goList(g, l) {
      Object.assign(C(), { group: g, list: l });
    }
    // The cursor's places in order.
    const places = () => ['group', 'list', ...stops(), 'next'];

    function turn(part, steps) {
      const c = C();
      if (part === 'outer') {
        const p = places(), i = p.indexOf(c.cursor);
        c.cursor = p[clamp((i < 0 ? 0 : i) + steps, 0, p.length - 1)];
        return;
      }
      if (c.cursor === 'group') {
        goList((((c.group + steps) % lists.length) + lists.length) % lists.length, 0);
      } else if (c.cursor === 'list') {
        const n = group().lists.length;
        goList(c.group, (((c.list + steps) % n) + n) % n);
      } else {
        // On the items the small knob moves too.
        turn('outer', steps);
      }
    }
    function next() {
      const c = C();
      if (c.list + 1 < group().lists.length) goList(c.group, c.list + 1);
      else goList((c.group + 1) % lists.length, 0);
      c.cursor = stops()[0] ?? 'next';
    }
    // ENT and CLR; true when handled.
    function press(key) {
      const c = C();
      if (key === 'clr') {
        if (typeof c.cursor === 'number') checked()[c.cursor] = false;
        return true;
      }
      if (c.cursor === 'next') { next(); return true; }
      if (c.cursor === 'group' || c.cursor === 'list') { c.cursor = stops()[0] ?? 'next'; return true; }
      checked()[c.cursor] = true;
      const s = stops(), i = s.indexOf(c.cursor);
      c.cursor = s[i + 1] ?? 'next';
      return true;
    }

    return { fresh, open, close, isOpen, emergency, turn, press, group, list, checked, finished, stops, lists };
  }

  return { create };
})();
