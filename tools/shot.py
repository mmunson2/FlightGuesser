"""Screenshot the app in headless Chrome.

    make shot ARGS="out.png"                                   # the aircraft, explore mode
    make shot ARGS="out.png --view cockpit --select pfd"
    make shot ARGS="out.png --diagram"                         # the KPAE diagram
    make shot ARGS="out.png --frame hdg_knob --dir aft"
    make shot ARGS="out.png --start"                           # the start screen
    make shot ARGS="out.png --phone --js 'document.querySelector(\\"#start-go\\").click()'"

--phone opens index.html as a phone, which lands on the notecards
(cards.html); only --js applies there, with D = window.CARDS_DEBUG.

--view picks a camera preset (outside, cockpit, panel: SCENE_DATA views);
--frame points the camera at a part (or group) and zooms to fit it, seen
from --dir (front: ahead of the nose, aft: from behind, left, right, top).
--js runs after the rest, with D = window.FLIGHT_DEBUG (see the end of
js/viewer.js). Page errors are printed; the exit code is 1 if there were any.
Write screenshots to the session scratchpad, not the repo.
"""

import argparse
import sys

from browser import PHONE, app
from paths import INDEX_HTML

DIRS = {"front": (0, 0.25, 1), "aft": (0, 0.25, -1), "left": (1, 0.2, 0), "right": (-1, 0.2, 0),
        "top": (0, 1, 0.001)}

SETUP = r"""([o, dirs]) => {
  const D = window.FLIGHT_DEBUG, THREE = D.THREE;
  if (!o.start) D.explore();
  if (o.diagram) D.showDiagram(true);
  if (o.view) D.goView(o.view);
  if (o.solo) D.solo(o.solo.split(','));
  if (o.hide) D.hide(o.hide.split(','));
  if (o.select) D.select(o.select);
  if (o.frame) {
    const list = D.meshesOf(o.frame);
    if (!list.length) throw new Error('no part ' + o.frame);
    const box = new THREE.Box3();
    list.forEach((m) => box.expandByObject(m));
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dir = new THREE.Vector3(...dirs[o.dir]).normalize();
    const dist = Math.max(0.15, size) / (2 * Math.tan(THREE.MathUtils.degToRad(D.camera.fov / 2))) * o.zoom;
    D.controls.target.copy(centre);
    D.camera.position.copy(centre).addScaledVector(dir, dist);
    D.controls.update();
  }
  if (o.js) new Function('D', o.js)(D);
}"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out")
    ap.add_argument("--diagram", action="store_true", help="show the KPAE diagram")
    ap.add_argument("--view", help="camera preset: outside, cockpit, panel")
    ap.add_argument("--solo", help="comma-separated systems to show alone")
    ap.add_argument("--hide", help="comma-separated part ids to hide")
    ap.add_argument("--select", help="part id to highlight and name in the header")
    ap.add_argument("--frame", help="part id to centre and fit in view")
    ap.add_argument("--dir", choices=DIRS, default="front", help="side to frame from")
    ap.add_argument("--zoom", type=float, default=1.0, help="distance factor for --frame: <1 is closer")
    ap.add_argument("--start", action="store_true", help="keep the start screen open")
    ap.add_argument("--js", help="JavaScript to run last (D = window.FLIGHT_DEBUG)")
    ap.add_argument("--size", default="1400x900")
    ap.add_argument("--wait", type=int, default=600, help="ms to wait before the shot")
    ap.add_argument("--phone", action="store_true", help="as a phone: the notecards page")
    o = ap.parse_args()
    if o.phone:
        return phone_shot(o)
    w, h = map(int, o.size.split("x"))
    with app(w, h) as page:
        page.evaluate(SETUP, [vars(o), DIRS])
        page.wait_for_timeout(o.wait)
        page.screenshot(path=o.out)
        errors = page.errors
    for e in errors:
        print(e)
    print(f"-> {o.out}")
    return 1 if errors else 0


def phone_shot(o):
    with app(400, 300) as desktop:
        context = desktop.context.browser.new_context(**PHONE)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"page error: {e}"))
        page.goto(INDEX_HTML.as_uri())
        page.wait_for_function("window.CARDS_DEBUG")
        if o.js:
            page.evaluate("(js) => new Function('D', js)(window.CARDS_DEBUG)", o.js)
        page.wait_for_timeout(o.wait)
        page.screenshot(path=o.out)
    for e in errors:
        print(e)
    print(f"-> {o.out}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
