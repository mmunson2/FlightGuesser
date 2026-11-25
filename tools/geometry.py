"""Geometry audit of the built model (data/scenedata.js).

    make geometry                    both reports
    make geometry ARGS=overlaps      parts whose solids run into each other
    make geometry ARGS=hidden        parts a click can't reach

overlaps: for every pair of target parts whose boxes meet, points on part
A's surface (vertices and triangle centres) are tested for being inside
part B by casting rays along x, y and z through B's triangles and counting
crossings (inside if at least two of the three are odd). Only B's closed
pieces (connected components with few boundary edges) are containers, so
open FlightGear skins don't flag everything near them. Points within
MIN_DEPTH of B's surface count as touching. Reported: the share of A's
points inside B and the deepest one's distance to B's surface. Moving parts inside a cylinder bore don't
count: the bore is outside the cylinder's solid.

hidden: renders part ids in headless Chrome (no lighting, double-sided,
context parts left out: clicks pass through them, as in the viewer, where
the first target along the ray wins) from close cameras in 26 directions
around each part, as a player zooming in on it would see it, plus orbits
round the camera presets (cockpit, panel) for the everything-shown pass.
Two passes:
with everything shown, and with only the part's system shown (the side
panel's checkboxes). A part no camera sees with its system alone needs a
right-click hide of a sibling to be clicked; one not seen with everything
shown needs another system unticked. The report names what covers it.
"""

import base64
import json
import sys

import numpy as np

from browser import app
from paths import SCENEDATA

DIRS = [(x, y, z) for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1) if (x, y, z) != (0, 0, 0)]
SIZE = 96
FAINT = 40
MIN_SHARE, MIN_POINTS = 0.01, 8
MIN_DEPTH = 0.002          # m: closer to B's skin counts as touching
OPEN_EDGES = 0.02
# Overlaps that are meant: (A, B) -> why. Listed apart from the rest.
EXPECTED = {
    **{(a, "wheel_fairings"): "the wheel pants enclose the wheels, brakes and gear"
       for a in ("brakes", "nose_wheel", "main_wheels", "main_gear_legs", "nose_gear_strut", "brake_lines")},
    ("exhaust_risers", "cylinders"): "the risers start in the exhaust ports",
    ("engine_mount", "accessory_case"): "the mount bolts to the engine",
    ("engine_mount", "engine_fuel_pump"): "the mount bolts to the engine",
    ("main_gear_legs", "main_wheels"): "the axle",
    ("brake_lines", "main_gear_legs"): "the line runs along the leg",
    ("tie_down_rings", "fuselage"): "the rings are bolted through the skin",
    ("tie_down_rings", "wing_struts"): "FlightGear: the wing rings sit at the strut fitting",
    ("nose_gear_strut", "nose_gear_torque_links"): "the links' collars clamp the strut",
    ("elevator_cables", "elevator_bellcranks"): "the cables attach to the bellcrank arms",
    ("trim_tab_actuator", "elevator"): "the actuator's push rod runs through the elevator to the tab",
    ("nose_gear_strut", "nose_gear_fittings"): "the upper fitting and the clamp hold the strut",
    ("fuel_quantity_senders", "fuel_tanks"): "the sender's float is in the fuel bay",
    ("fuel_caps", "fuel_tanks"): "the filler necks go into the fuel bays",
    ("cowling", "induction_air_filter"): "the filter sits in the cowl's chin inlet",
    ("engine_fuel_lines", "induction_air_duct"): "CAD: the servo's fuel line passes the inlet adaptor",
    ("cowling", "oil_filler_cap"): "FlightGear: the cap sits in the cowling's opening",
    # The CAD engine (GrabCAD) as modelled:
    ("lifters", "camshaft"): "CAD: the lifter discs sit on the cam lobes",
    ("pushrods", "camshaft"): "CAD: the pushrods end on the cam",
    ("pushrods", "crankcase"): "CAD: the pushrods run into the crankcase to the lifters",
    ("alternator", "crankcase"): "CAD: the alternator bracket bolts to the crankcase",
    ("rocker_arms", "cylinders"): "CAD: the rockers sit in the heads",
    ("camshaft", "accessory_case"): "CAD: the camshaft's end",
    ("magnetos", "accessory_case"): "CAD: the magneto drives",
    ("accessory_case", "magnetos"): "CAD: the magneto drives",
    ("crankcase", "alternator"): "CAD: the alternator bracket",
}          # a container may have this share of boundary edges


def load_parts():
    text = SCENEDATA.read_text()
    data = json.loads(text[text.index("{"):text.rstrip().rstrip(";").rindex("}") + 1])
    lo, scale = np.array(data["min"]), np.array(data["scale"])
    parts = []
    for p in data["parts"]:
        verts, tris, n = [], [], 0
        for q in p["pieces"]:
            v = np.frombuffer(base64.b64decode(q["positions"]), "<u2").reshape(-1, 3) * scale + lo
            f = np.frombuffer(base64.b64decode(q["indices"]), "<u4" if q.get("index32") else "<u2").reshape(-1, 3)
            verts.append(v)
            tris.append(f.astype(np.int64) + n)
            n += len(v)
        parts.append({"id": p["id"], "system": p["system"], "kind": p["kind"],
                      "verts": np.vstack(verts), "tris": np.vstack(tris)})
    return parts


def components(tris, n):
    lab = np.arange(n)
    while True:
        m = lab[tris].min(1)
        new = lab.copy()
        for j in range(3):
            np.minimum.at(new, tris[:, j], m)
        new = new[new]
        if (new == lab).all():
            return lab[tris[:, 0]]
        lab = new


def closed_tris(verts, tris):
    """Triangles of the closed (watertight-ish) components of a mesh."""
    # Weld coincident vertices first: pieces often repeat them per face.
    key = np.round(verts / 1e-4).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    t = inv.ravel()[tris]
    comp = components(t, t.max() + 1)
    keep = np.zeros(len(t), bool)
    for c in np.unique(comp):
        sel = comp == c
        tt = t[sel]
        e = np.sort(np.vstack([tt[:, [0, 1]], tt[:, [1, 2]], tt[:, [2, 0]]]), axis=1)
        _, counts = np.unique(e, axis=0, return_counts=True)
        if len(tt) >= 4 and (counts == 1).sum() <= OPEN_EDGES * len(counts):
            keep |= sel
    return tris[keep]


def surface_distance(tri, pts):
    """Distance from each point to the nearest triangle (exact)."""
    out = np.full(len(pts), np.inf)
    a, b, c = tri[:, 0], tri[:, 1], tri[:, 2]
    ab, ac = b - a, c - a
    for i, p in enumerate(pts):
        ap = p - a
        d1, d2 = (ab * ap).sum(1), (ac * ap).sum(1)
        n = np.cross(ab, ac)
        nn = (n * n).sum(1) + 1e-30
        # Projection onto the plane, clamped by falling back to edges.
        t = (ap * n).sum(1) / nn
        q = p - t[:, None] * n
        v0, v1, v2 = b - a, c - a, q - a
        d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
        d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
        den = d00 * d11 - d01 * d01 + 1e-30
        v = (d11 * d20 - d01 * d21) / den
        w = (d00 * d21 - d01 * d20) / den
        inside = (v >= 0) & (w >= 0) & (v + w <= 1)
        best = np.where(inside, np.abs(t) * np.sqrt(nn), np.inf)
        for s, e in ((a, b), (b, c), (c, a)):
            se = e - s
            u = np.clip(((p - s) * se).sum(1) / ((se * se).sum(1) + 1e-30), 0, 1)
            best = np.minimum(best, np.linalg.norm(s + u[:, None] * se - p, axis=1))
        out[i] = best.min()
    return out


def crossings(tri, pts, axis, cell=0.02):
    """Odd/even count of triangle crossings on rays from pts along +axis."""
    a, b = [(1, 2), (0, 2), (0, 1)][axis]
    t2 = tri[:, :, [a, b]]
    lo, hi = t2.min(1), t2.max(1)
    out = np.zeros(len(pts), bool)
    keys = np.floor(pts[:, [a, b]] / cell).astype(np.int64)
    for key in np.unique(keys, axis=0):
        sel = np.where((keys == key).all(1))[0]
        c0, c1 = key * cell, (key + 1) * cell
        cand = np.where((lo[:, 0] <= c1[0]) & (hi[:, 0] >= c0[0]) & (lo[:, 1] <= c1[1]) & (hi[:, 1] >= c0[1]))[0]
        if not len(cand):
            continue
        T = tri[cand]
        P = pts[sel]
        p, q, r = T[:, 0], T[:, 1], T[:, 2]
        u, v = P[:, a][:, None], P[:, b][:, None]
        d = (q[:, b] - r[:, b]) * (p[:, a] - r[:, a]) + (r[:, a] - q[:, a]) * (p[:, b] - r[:, b])
        ok = np.abs(d) > 1e-14
        d = np.where(ok, d, 1)
        l1 = ((q[:, b] - r[:, b]) * (u - r[:, a]) + (r[:, a] - q[:, a]) * (v - r[:, b])) / d
        l2 = ((r[:, b] - p[:, b]) * (u - r[:, a]) + (p[:, a] - r[:, a]) * (v - r[:, b])) / d
        l3 = 1 - l1 - l2
        inside = ok & (l1 >= 0) & (l2 >= 0) & (l3 >= 0)
        h = l1 * p[:, axis] + l2 * q[:, axis] + l3 * r[:, axis]
        out[sel] = ((inside & (h > P[:, axis][:, None])).sum(1) % 2).astype(bool)
    return out


def overlaps(parts):
    targets = [p for p in parts if p["kind"] == "target"]
    for p in targets:
        p["lo"], p["hi"] = p["verts"].min(0), p["verts"].max(0)
        tri = p["verts"][p["tris"]]
        pts = np.vstack([p["verts"], tri.mean(1)])
        p["pts"] = pts[np.random.default_rng(0).permutation(len(pts))[:4000]]
        p["solid"] = p["verts"][closed_tris(p["verts"], p["tris"])]
    rows = []
    for b in targets:
        tri = b["solid"]
        if not len(tri):
            continue
        blo, bhi = tri.min((0, 1)), tri.max((0, 1))
        for a in targets:
            if a is b or (a["hi"] < b["lo"]).any() or (a["lo"] > b["hi"]).any():
                continue
            pts = a["pts"][((a["pts"] > blo) & (a["pts"] < bhi)).all(1)]
            if len(pts) < MIN_POINTS:
                continue
            votes = sum(crossings(tri, pts, k).astype(int) for k in range(3))
            inside = pts[votes >= 2]
            if len(inside) < MIN_POINTS:
                continue
            dist = surface_distance(tri, inside[:400])
            deep = (dist > MIN_DEPTH).mean() * len(inside)      # points clear of B's skin
            share = deep / len(a["pts"])
            if deep >= MIN_POINTS and share >= MIN_SHARE:
                rows.append((share, a["id"], b["id"], int(deep), dist.max()))
    bad = [r for r in rows if (r[1], r[2]) not in EXPECTED]
    print(f"\n{len(bad)} overlaps (part A's surface inside closed part B):")
    print(f"  {'A':28} {'inside B':28} {'share':>6} {'points':>6} {'depth cm':>8}")
    for share, a, b, n, depth in sorted(bad, reverse=True):
        print(f"  {a:28} {b:28} {share:6.0%} {n:6} {depth * 100:8.1f}")
    meant = sorted((r for r in rows if (r[1], r[2]) in EXPECTED), reverse=True)
    print(f"{len(meant)} expected: " + "; ".join(f"{a} in {b} ({EXPECTED[a, b]})" for _, a, b, *_ in meant))
    print("Target parts with no closed piece (never containers):",
          ", ".join(sorted(p["id"] for p in targets if not len(p["solid"]))))


HIDDEN_JS = r"""([dirs, size]) => {
  const D = window.FLIGHT_DEBUG, THREE = D.THREE, meshes = D.meshes();
  const scene = meshes[0].parent;
  const rt = new THREE.WebGLRenderTarget(size, size);
  const saved = new Map();
  meshes.forEach((m, i) => {
    saved.set(m, [m.material, m.visible]);
    m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHex(i + 1), side: THREE.DoubleSide });
  });
  const others = scene.children.filter((o) => !saved.has(o));
  const othersVis = others.map((o) => o.visible);
  others.forEach((o) => { o.visible = false; });
  const bg = scene.background;
  scene.background = new THREE.Color(0);
  const buf = new Uint8Array(size * size * 4);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.005, 50);
  const pickable = meshes.filter((m) => m.userData.part.kind === 'target');
  const index = new Map(meshes.map((m, i) => [m, i + 1]));
  // Pixels of `m` (and the ids covering the rest of its outline when
  // `cover` is given) seen from close cameras all round it, with `show`.
  function look(m, show, cover) {
    meshes.forEach((x) => { x.visible = show.has(x); });
    const box = new THREE.Box3().expandByObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.01);
    const dist = Math.max(r / Math.sin(THREE.MathUtils.degToRad(13)), 0.12);
    const id = index.get(m);
    let seen = 0;
    const by = new Map();
    for (const d of dirs) {
      const dir = new THREE.Vector3(...d).normalize();
      cam.position.copy(c).addScaledVector(dir, dist);
      cam.up.set(0, 1, 0);
      if (Math.abs(dir.y) > 0.99) cam.up.set(0, 0, 1);
      cam.lookAt(c);
      cam.updateMatrixWorld();
      D.renderer.setRenderTarget(rt);
      D.renderer.render(scene, cam);
      D.renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      let mask = null;
      if (cover) {
        const vis = new Map(meshes.map((x) => [x, x.visible]));
        meshes.forEach((x) => { x.visible = x === m; });
        const own = new Uint8Array(buf.length);
        const keep = buf.slice();
        D.renderer.render(scene, cam);
        D.renderer.readRenderTargetPixels(rt, 0, 0, size, size, own);
        meshes.forEach((x) => { x.visible = vis.get(x); });
        mask = own;
        buf.set(keep);
      }
      for (let k = 0; k < buf.length; k += 4) {
        const v = (buf[k] << 16) | (buf[k + 1] << 8) | buf[k + 2];
        if (v === id) seen++;
        else if (mask && ((mask[k] << 16) | (mask[k + 1] << 8) | mask[k + 2]) === id && v) {
          const name = meshes[v - 1] && meshes[v - 1].userData.part.id;
          if (name) by.set(name, (by.get(name) || 0) + 1);
        }
      }
    }
    D.renderer.setRenderTarget(null);
    return { seen, by: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4) };
  }
  const all = new Set(pickable);
  // Orbits round the camera presets' targets (the cockpit and panel views),
  // as OrbitControls moves the camera, at the preset's distance and half it.
  const orbit = new Map();
  meshes.forEach((x) => { x.visible = all.has(x); });
  const big = new THREE.WebGLRenderTarget(2 * size, 2 * size);
  const bigBuf = new Uint8Array(4 * size * size * 4);
  for (const v of Object.values(window.SCENE_DATA.views)) {
    if (v.solo) continue;
    const t = new THREE.Vector3(...v.target), d0 = new THREE.Vector3(...v.position).distanceTo(t);
    for (const f of [0.5, 1]) for (const d of [...dirs, [0, 0, 0]]) {
      const dir = d[0] || d[1] || d[2] ? new THREE.Vector3(...d).normalize()
        : new THREE.Vector3(...v.position).sub(t).normalize();
      cam.position.copy(t).addScaledVector(dir, d0 * f);
      cam.up.set(0, 1, 0);
      if (Math.abs(dir.y) > 0.99) cam.up.set(0, 0, 1);
      cam.lookAt(t);
      cam.updateMatrixWorld();
      D.renderer.setRenderTarget(big);
      D.renderer.render(scene, cam);
      D.renderer.readRenderTargetPixels(big, 0, 0, 2 * size, 2 * size, bigBuf);
      for (let k = 0; k < bigBuf.length; k += 4) {
        const v2 = (bigBuf[k] << 16) | (bigBuf[k + 1] << 8) | bigBuf[k + 2];
        if (v2) orbit.set(v2, (orbit.get(v2) || 0) + 1);
      }
    }
  }
  D.renderer.setRenderTarget(null);
  const rows = pickable.map((m) => {
    const sys = m.userData.part.system;
    const mine = new Set(pickable.filter((x) => x.userData.part.system === sys));
    const inAll = look(m, all).seen + (orbit.get(index.get(m)) || 0);
    const s = look(m, mine);
    const row = { id: m.userData.part.id, system: sys, all: inAll, system_px: s.seen };
    if (!s.seen) row.covers = look(m, mine, true).by;
    else if (!inAll) row.covers = look(m, all, true).by;
    return row;
  });
  meshes.forEach((m) => { const [mat, vis] = saved.get(m); m.material = mat; m.visible = vis; });
  others.forEach((o, i) => { o.visible = othersVis[i]; });
  scene.background = bg;
  return rows;
}"""


def hidden(parts):
    with app(600, 600) as page:
        page.evaluate("window.FLIGHT_DEBUG.explore()")
        page.evaluate("FLIGHT_DEBUG.renderer.setAnimationLoop(null)")
        rows = page.evaluate(HIDDEN_JS, [DIRS, SIZE])
        if page.errors:
            print("\n".join(page.errors))
    cov = lambda r: ", ".join(f"{k} {v}" for k, v in r.get("covers", []))
    never = [r for r in rows if not r["system_px"]]
    print(f"\n{len(never)} parts no close camera sees with their own system shown alone "
          "(a sibling must be hidden to click them); covered by (pixels):")
    for r in never:
        print(f"  {r['id']:28} {r['system']:16} {cov(r)}")
    faint = sorted((r["system_px"], r["id"]) for r in rows if 0 < r["system_px"] < FAINT)
    if faint:
        print(f"Barely visible with their system alone (< {FAINT} px over {len(DIRS)} close views):",
              ", ".join(f"{pid} ({n})" for n, pid in faint))
    blocked = [r for r in rows if r["system_px"] and not r["all"]]
    print(f"\n{len(blocked)} parts covered from every side with everything shown "
          "(reached by unticking another system); covered by:")
    for r in blocked:
        print(f"  {r['id']:28} {r['system']:16} {cov(r)}")


def main(args):
    parts = load_parts()
    what = set(args) or {"overlaps", "hidden"}
    if "overlaps" in what:
        overlaps(parts)
    if "hidden" in what:
        hidden(parts)


if __name__ == "__main__":
    main(sys.argv[1:])
