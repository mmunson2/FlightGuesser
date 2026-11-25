"""The engine: GrabCAD's "Aircraft Engine IO-360-L2A Flat Type" (a generic
flat four, personal use), tessellated from its STEP assembly by
build/step_mesh.py into <engine_dir>/engine.npz, placed under the C172S's
cowling as the `engine` system.

STEP frame (mm): z forward (propeller end), x down, y to the left wing.
The engine is scaled to fit the cowling, its crankshaft on the spinner's
axis and its propeller flange at the spinner's back. Instances are welded
on a grid (`CELL`) to cut the triangle count: the magnetos alone are 400k
triangles as modelled.
"""

import re
from pathlib import Path

import numpy as np

# STEP part name (without the instance #n) -> part id. Unlisted parts are
# drawn as context.
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
    r"body|body_2": "crankcase",
    r"bottom_safe": "oil_sump",
    r"Magneto_teardown": "magnetos",
    r"cable_magneto2?": "ignition_harness",
    r"alternator": "alternator",
    r"fuel_pump": "engine_fuel_pump",
    r"fuel_control_valve": "fuel_injection",
    r"gearcover": "accessory_case",
}
# The airplane has its own propeller; the exhaust is drawn from the
# maintenance manual (build/extras.py).
DROP = re.compile(r"Propeller|Exhaust_Muffeler")
PARTS = list(dict.fromkeys(TABLE.values()))
# Colours of a typical Lycoming installation (the CAD model's are arbitrary).
COLORS = {
    "cylinders": 0x4a4d52, "pistons": 0xa8acb0, "connecting_rods": 0x8d9197, "crankshaft": 0x9a9ea3,
    "camshaft": 0x8f8a80, "pushrods": 0xb0b3b6, "lifters": 0xa0a3a6, "rocker_arms": 0x7d8086,
    "valves": 0xb7b2a8, "valve_springs": 0x6f7377, "crankcase": 0x8c8f93, "oil_sump": 0x7d8084,
    "magnetos": 0x2b2d30, "ignition_harness": 0xd9d9d0, "alternator": 0xb8bcc0,
    "engine_fuel_pump": 0x5c5f63, "fuel_injection": 0xc8642a, "accessory_case": 0x7a7d80,
    "engine_context": 0x6c7077,
}
# Weld cell in mm, per part id (default CELL).
CELL = 3.5
CELLS = {"magnetos": 5.0, "ignition_harness": 5.0, "fuel_injection": 5.0, "cylinders": 5.0}

# Placement: the crankshaft axis (STEP x, y) and the propeller flange
# (STEP z) map to these scene points; SCALE shrinks the model to fit the
# cowling (it is 0.71 m tall with its exhaust, the cowling 0.98 m).
CRANK_XY = (-31.0, -14.0)
FLANGE_Z = 952.0
SPINNER = (0.0, -0.1, 1.66)
SCALE = 0.0008


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


def to_scene(v):
    """STEP mm -> scene metres (y up, nose +z, left wing +x)."""
    x, y, z = v[:, 0] - CRANK_XY[0], v[:, 1] - CRANK_XY[1], v[:, 2] - FLANGE_Z
    return np.column_stack([y, -x, z]) * SCALE + np.array(SPINNER)


def load(engine_dir):
    """-> list of part dicts {id, system, kind, verts, tris}, as aircraft.load."""
    z = np.load(Path(engine_dir) / "engine.npz")
    merged, seen = {}, set()
    for inst in sorted({k.split("/")[0] for k in z}):
        name = inst.split("#")[0]
        if DROP.fullmatch(name):
            continue
        v, f = z[inst + "/pos"].astype(np.float64), z[inst + "/idx"].astype(np.int64)
        # The assembly places a few valves and springs twice.
        sig = (name, tuple(np.round(v.min(0))), tuple(np.round(v.max(0))))
        if sig in seen:
            continue
        seen.add(sig)
        pid = next((p for rx, p in TABLE.items() if re.fullmatch(rx, name)), "engine_context")
        merged.setdefault(pid, []).append((v, f))
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
        parts.append({"id": pid, "system": "engine", "kind": "context" if pid == "engine_context" else "target",
                      "ask": pid != "engine_context",
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
