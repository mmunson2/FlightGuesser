"""The engine: GrabCAD's "Aircraft Engine IO-360-L2A Flat Type" (a generic
flat four, personal use), tessellated from its STEP assembly by
build/step_mesh.py into <engine_dir>/engine.npz, placed under the C172S's
cowling as the `engine` system.

STEP frame (mm): z forward (propeller end), x down, y to the left wing.
The engine is scaled to fit the cowling, its crankshaft on the spinner's
axis and its propeller flange at the spinner's back. Instances are welded
on a grid (`CELL`) to cut the triangle count: the magnetos alone are 400k
triangles as modelled.

Some STEP solids fuse several real parts: the crankcase carries the fuel
distribution valve (spider), the four injector lines and the line feeding
the spider; the "fuel_control_valve" is the servo plus its lines; the sump
carries the intake pipes. `SPLITS` moves their faces (by each face's
scene-space box and size) into their own parts.
"""

import re
from pathlib import Path

import numpy as np

# STEP part name (without the instance #n) -> part id. An unlisted part
# fails the build (DROP leaves one out).
TABLE = {
    r"cylinder": "cylinders",
    r"piston head|piston pin|piston_pin2": "pistons",
    r"piston_rod|piston_Rod_pod": "connecting_rods",
    r"crankshaft": "crankshaft",
    r"camshaft": "camshaft",
    r"push_rods_1": "pushrods",
    r"push_rods_circle": "lifters",
    r"push_rods_2": "rocker_arms",
    r"engine valve": "valves",
    r"rocker arm spring": "valve_springs",
    r"body|body_2|big_bant": "crankcase",        # big_bant: a flat plate at its front
    r"bottom_safe": "oil_sump",
    r"Magneto_teardown": "magnetos",
    r"cable_magneto2?": "ignition_harness",
    r"alternator": "alternator",
    r"fuel_pump": "engine_fuel_pump",
    r"fuel_control_valve": "fuel_servo",
    r"gearcover|bant": "accessory_case",         # bant: the gasket behind it
}


def within(lo, hi):
    """A face whose box lies inside the box (lo, hi), scene metres."""
    lo, hi = np.array(lo), np.array(hi)
    return lambda f: (f["lo"] >= lo).all() and (f["hi"] <= hi).all()


def faces(*ids):
    """Faces by their STEP index (step_mesh's `face`, TopExp order)."""
    ids = set(ids)
    return lambda f: f["index"] in ids


# STEP name -> [(part id, test on a face)], first match wins; other faces
# stay with the TABLE part. The faces were picked by surveying each solid's
# faces (type, size, box) with OpenCascade: the injector lines are the four
# long B-spline tubes from the spider to the cylinders (two faces each);
# the spider is the finned block on top of the crankcase where they meet;
# its feed line runs forward to a fitting that the servo's line reaches.
SPIDER_BOX = ((-0.015, 0.094, 1.405), (0.046, 0.132, 1.48))
FEED_FITTING_BOX = ((-0.019, 0.094, 1.185), (0.016, 0.132, 1.25))
SPLITS = {
    "body": [("flow_divider", within(*SPIDER_BOX)),
             ("injector_lines", faces(0, 1, 17, 19, 411, 439, 500, 503)),
             ("engine_fuel_lines", faces(22, 403)),
             ("engine_fuel_lines", within(*FEED_FITTING_BOX))],
    "fuel_control_valve": [("engine_fuel_lines", faces(1, 2, 542, 544, 545))],
    "bottom_safe": [("intake_pipes", lambda f: f["lo"][0] >= 0.155 or f["hi"][0] <= -0.155)],
}
# The airplane has its own propeller; the exhaust is drawn from the
# maintenance manual (build/extras.py).
DROP = re.compile(r"Propeller|Exhaust_Muffeler")
PARTS = list(dict.fromkeys([*TABLE.values(), *(pid for rules in SPLITS.values() for pid, _ in rules)]))
# Colours of a typical Lycoming installation (the CAD model's are arbitrary).
COLORS = {
    "cylinders": 0x4a4d52, "pistons": 0xa8acb0, "connecting_rods": 0x8d9197, "crankshaft": 0x9a9ea3,
    "camshaft": 0x8f8a80, "pushrods": 0xb0b3b6, "lifters": 0xa0a3a6, "rocker_arms": 0x7d8086,
    "valves": 0xb7b2a8, "valve_springs": 0x6f7377, "crankcase": 0x8c8f93, "oil_sump": 0x7d8084,
    "magnetos": 0x2b2d30, "ignition_harness": 0xd9d9d0, "alternator": 0xb8bcc0,
    "engine_fuel_pump": 0x5c5f63, "fuel_servo": 0xa3a7ab, "accessory_case": 0x7a7d80,
    "flow_divider": 0xc9b27a, "injector_lines": 0xc8642a, "engine_fuel_lines": 0x8c4a24,
    "intake_pipes": 0x9a9ea2,
}
# Weld cell in mm, per part id (default CELL).
CELL = 3.5
CELLS = {"magnetos": 5.0, "ignition_harness": 5.0, "fuel_servo": 5.0, "cylinders": 5.0,
         "flow_divider": 1.0, "injector_lines": 2.0, "engine_fuel_lines": 3.0}

# Placement: the crankshaft axis (STEP x, y) and the propeller flange
# (STEP z) map to these scene points. REF_SCALE is the frame the SPLITS
# boxes and extras.py's engine-relative spots were measured in; FIT
# stretches it (scene x, y, z, about the flange) to Lycoming's IO-360-L2A
# dimensions (operator's manual 60297-12, Dimensions table, the "-B1B,
# -B1D, -L2A" row: 24.84 high, 33.37 wide, 29.81 long, inches). At
# REF_SCALE the CAD engine is 31.05 in wide (rocker covers) and 27.33 in
# long (crankshaft flange to the magnetos). Its height isn't comparable
# (the L2A's 24.84 in includes the servo under the sump, which the CAD
# model lays out differently) and the FlightGear cowling's top leaves no
# room (a 1.08 stretch puts the crankcase 2.4 cm through it), so y stays.
CRANK_XY = (-31.0, -14.0)
FLANGE_Z = 952.0
SPINNER = (0.0, -0.1, 1.66)
REF_SCALE = 0.0008
FIT = np.array([33.37 / 31.05, 1.0, 29.81 / 27.33])


def weld(v, f, cell):
    key = np.floor(v / cell).astype(np.int64)
    _, inv, counts = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    inv = inv.ravel()
    sums = np.zeros((len(counts), 3))
    np.add.at(sums, inv, v)
    verts = sums / counts[:, None]
    tris = inv[f]
    ok = (tris[:, 0] != tris[:, 1]) & (tris[:, 1] != tris[:, 2]) & (tris[:, 0] != tris[:, 2])
    tris = np.unique(tris[ok], axis=0)
    used, tris = np.unique(tris, return_inverse=True)
    return verts[used], tris.reshape(-1, 3)


def to_ref(v):
    """STEP mm -> scene metres at REF_SCALE (y up, nose +z, left wing +x)."""
    x, y, z = v[:, 0] - CRANK_XY[0], v[:, 1] - CRANK_XY[1], v[:, 2] - FLANGE_Z
    return np.column_stack([y, -x, z]) * REF_SCALE + np.array(SPINNER)


def ref_to_scene(p):
    """A point (or points) in the REF_SCALE frame -> the scene, at FIT."""
    return np.array(SPINNER) + (np.asarray(p, dtype=np.float64) - SPINNER) * FIT


def to_scene(v):
    return ref_to_scene(to_ref(v))


def split(name, v, f, owner, pid):
    """-> {part id: triangles} for one STEP instance (SPLITS)."""
    rules = SPLITS.get(name)
    if not rules:
        return {pid: f}
    s = to_ref(v)                      # the SPLITS boxes are in this frame
    tri = s[f]
    to = np.full(len(f), -1)
    for k in np.unique(owner):
        sel = owner == k
        p = tri[sel].reshape(-1, 3)
        face = {"index": int(k), "lo": p.min(0), "hi": p.max(0)}
        to[sel] = next((i for i, (_, test) in enumerate(rules) if test(face)), -1)
    out = {}
    for i in np.unique(to):
        out.setdefault(pid if i < 0 else rules[i][0], []).append(f[to == i])
    return {k: np.vstack(t) for k, t in out.items()}


def load(engine_dir):
    """-> list of part dicts {id, system, kind, verts, tris}, as aircraft.load."""
    z = np.load(Path(engine_dir) / "engine.npz")
    merged, seen = {}, set()
    for inst in sorted({k.split("/")[0] for k in z}):
        name = inst.split("#")[0]
        if DROP.fullmatch(name):
            continue
        v, f = z[inst + "/pos"].astype(np.float64), z[inst + "/idx"].astype(np.int64)
        owner = z[inst + "/face"]
        # The assembly places a few valves and springs twice.
        sig = (name, tuple(np.round(v.min(0))), tuple(np.round(v.max(0))))
        if sig in seen:
            continue
        seen.add(sig)
        pid = next((p for rx, p in TABLE.items() if re.fullmatch(rx, name)), None)
        if pid is None:
            # Context can't be clicked: every STEP part needs a TABLE entry.
            raise SystemExit(f"engine part {name!r} has no TABLE entry")
        for sub, tris in split(name, v, f, owner, pid).items():
            merged.setdefault(sub, []).append((v, tris))
    parts = []
    for pid, pieces in merged.items():
        verts, tris, n = [], [], 0
        for v, f in pieces:
            verts.append(v)
            tris.append(f + n)
            n += len(v)
        v, f = weld(np.vstack(verts), np.vstack(tris), CELLS.get(pid, CELL))
        c = COLORS[pid]
        rgb = np.tile([(c >> 16) / 255, (c >> 8 & 255) / 255, (c & 255) / 255], (len(v), 1))
        parts.append({"id": pid, "system": "engine", "kind": "target", "ask": True,
                      "pieces": [{"tex": None, "verts": to_scene(v), "tris": f, "uv": None, "rgb": rgb}]})
    missing = set(PARTS) - set(merged)
    if missing:
        raise SystemExit(f"engine parts with no objects: {sorted(missing)}")
    return parts


if __name__ == "__main__":
    import sys
    for p in load(sys.argv[1]):
        q = p["pieces"][0]
        lo, hi = q["verts"].min(0), q["verts"].max(0)
        print(f"{p['id']:20} {len(q['tris']):7} tris  {np.round(lo, 3)} {np.round(hi, 3)}")
