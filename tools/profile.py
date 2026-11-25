"""Where the app spends its time: a CPU profile of loading index.html and
of a few seconds of steady frames, in headless Chrome.

    make profile                         # load + 3 s idle in explore mode
    make profile ARGS="--view panel --operate --secs 5 --top 30"

Prints load time, scene counts (meshes, draw calls, triangles, textures)
and the functions with the most self time, by file. Headless Chrome draws
with SwiftShader (software WebGL), so GPU-bound work shows up as CPU time
in three.min.js; the JS numbers are what to compare across changes.
"""

import argparse
import sys
from collections import defaultdict
from pathlib import Path

from playwright.sync_api import sync_playwright

from paths import INDEX_HTML


def summarize(profile, top, title):
    nodes = {n["id"]: n for n in profile["nodes"]}
    dt = defaultdict(float)
    samples, deltas = profile.get("samples", []), profile.get("timeDeltas", [])
    for sid, d in zip(samples, deltas):
        dt[sid] += d / 1000.0
    total = sum(dt.values())
    by_fn, by_file = defaultdict(float), defaultdict(float)
    for nid, ms in dt.items():
        cf = nodes[nid]["callFrame"]
        url = Path(cf["url"]).name if cf["url"] else ""
        name = cf["functionName"] or "(anonymous)"
        if not url:
            key = name  # (program), (garbage collector), (idle)
        else:
            key = f"{name}  {url}:{cf['lineNumber'] + 1}"
        by_fn[key] += ms
        by_file[url or name] += ms
    busy = total - by_file.get("(idle)", 0)
    print(f"\n== {title}: {total:.0f} ms sampled, {busy:.0f} ms busy")
    print("-- by file")
    for k, v in sorted(by_file.items(), key=lambda kv: -kv[1])[:12]:
        if k != "(idle)":
            print(f"  {v:8.1f} ms  {100 * v / max(busy, 1):5.1f}%  {k}")
    print("-- by function (self time)")
    for k, v in sorted(by_fn.items(), key=lambda kv: -kv[1])[:top]:
        if k != "(idle)":
            print(f"  {v:8.1f} ms  {100 * v / max(busy, 1):5.1f}%  {k}")


STATS = r"""() => {
  const D = window.FLIGHT_DEBUG, r = D.renderer;
  let tris = 0, verts = 0, mats = 0;
  for (const m of D.meshes()) {
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    verts += g.attributes.position.count;
    mats += Array.isArray(m.material) ? m.material.length : 1;
  }
  return { meshes: D.meshes().length, materials: mats, tris, verts,
    calls: r.info.render.calls, frameTris: r.info.render.triangles,
    textures: r.info.memory.textures, geometries: r.info.memory.geometries,
    programs: r.info.programs.length, pixelRatio: r.getPixelRatio(),
    heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1e6 : null };
}"""

FPS = r"""(ms) => new Promise((done) => {
  const info = window.FLIGHT_DEBUG.renderer.info.render, f0 = info.frame, t0 = performance.now();
  setTimeout(() => done((info.frame - f0) * 1000 / (performance.now() - t0)), ms);
})"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--view", default="outside", help="camera preset for the steady-state part")
    ap.add_argument("--operate", action="store_true", help="turn Operate mode on")
    ap.add_argument("--secs", type=float, default=3.0, help="seconds of steady frames to profile")
    ap.add_argument("--top", type=int, default=25)
    ap.add_argument("--size", default="1400x900")
    ap.add_argument("--gpu", action="store_true", help="hardware WebGL (Metal) instead of SwiftShader")
    ap.add_argument("--dpr", type=float, default=1, help="device pixel ratio (2 for a Retina screen)")
    o = ap.parse_args()
    w, h = map(int, o.size.split("x"))
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True,
                                    args=(["--use-angle=metal", "--enable-gpu"] if o.gpu else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]) + [
                                          "--enable-precise-memory-info"])
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=o.dpr)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        cdp = page.context.new_cdp_session(page)
        cdp.send("Profiler.enable")
        cdp.send("Profiler.setSamplingInterval", {"interval": 200})
        cdp.send("Profiler.start")
        page.goto(INDEX_HTML.as_uri())
        page.wait_for_function("window.FLIGHT_DEBUG", timeout=120000)
        load_ms = page.evaluate("performance.now()")
        page.wait_for_timeout(300)
        load = cdp.send("Profiler.stop")["profile"]
        res = page.evaluate("""() => performance.getEntriesByType('resource')
          .map((e) => [e.name.split('/').pop(), Math.round(e.duration), e.decodedBodySize])""")

        page.evaluate("([v, op]) => { const D = window.FLIGHT_DEBUG; D.explore(); D.goView(v);"
                      " if (op) D.setOperate(true); }", [o.view, o.operate])
        page.wait_for_timeout(1500)  # past the frames a call asks for
        cdp.send("Profiler.start")
        fps = page.evaluate(FPS, int(o.secs * 1000))
        steady = cdp.send("Profiler.stop")["profile"]
        stats = page.evaluate(STATS)
        browser.close()

    print(f"load: FLIGHT_DEBUG ready at {load_ms:.0f} ms")
    for name, ms, size in sorted(res, key=lambda r: -r[2])[:8]:
        print(f"  {size / 1e6:6.2f} MB  {ms:5d} ms  {name}")
    print("scene:", ", ".join(f"{k} {v:.0f}" if isinstance(v, (int, float)) else f"{k} {v}"
                              for k, v in stats.items()))
    print(f"steady: {fps:.1f} frames drawn per second{'' if o.gpu else ' (software WebGL)'} in view '{o.view}'{' operating' if o.operate else ''}")
    summarize(load, o.top, "load")
    summarize(steady, o.top, f"steady {o.secs:.0f} s")
    for e in errors:
        print("page error:", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
