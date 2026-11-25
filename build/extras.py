"""Parts neither source model has, drawn from Cessna's Model 172
Maintenance Manual (1996 and on, which covers the 172S; `MM` below, a
third-party copy cached by tools/page.py) and placed by its stations.

Fuselage stations (FS, inches) start at the firewall (FS 0.00) and run
aft; wing stations (WS) are inches from the centreline (MM 6-15-00). In
the scene, z = FIREWALL_Z - FS * 0.0254 and |x| = WS * 0.0254: the c172p
door posts fall within a few centimetres of the MM's FS 65.33.

The shapes are simple solids (tubes, boxes, cylinders) following the MM's
drawings; sizes the MM doesn't give are estimates (to_verify.md).

- Firewall (MM 6-20-00 "Firewall looking forward"): a plate filling the
  cowling's aft opening.
- Engine mount (MM 71-20-00 Fig. 202): tubes bolted to the firewall at
  four points, carrying the engine.
- Main battery (MM 24-30-00 Fig. 201; 24-00-00: "installed in the
  front-left side of the firewall", "below the power junction box"):
  tray, battery, cover, vent line; the power junction box above it.
- Standby battery (MM 24-30-10 Fig. 201): on a bracket behind the
  instrument panel's upper left.
- Exhaust (MM 78-10-00 Fig. 201): two risers from each side's cylinders
  into the ends of a transverse muffler under the engine, the heat shroud
  around it (cabin heat), and the tailpipe into the c172p exhaust stack.
  It replaces the CAD engine's own exhaust.
- Brakes (MM 32-42-00 Fig. 201): a master cylinder on each of the pilot's
  rudder pedals, lines under the floor and out through the fuselage skin,
  down the aft edge of each main gear leg to the wheel cylinder.
- Fuel strainer (MM 28-20-00 Fig. 206; 12-10-00 service points): on the
  forward lower left of the firewall, its drain through the cowling.
- Fuel tank sump drains (MM 28-20-00 Fig. 202; 12-10-00: five per tank):
  under each wing between WS 23.62 and 71.62.
- Static port (MM 34-11-00 Fig. 202; 12-10-00): on the left side of the
  fuselage ahead of the door.
"""

import numpy as np

IN = 0.0254
# The firewall's front face in scene z: the cowling's aft edge.
FIREWALL_Z = 0.785


def fs(station):
    return FIREWALL_Z - station * IN


COLORS = {
    "firewall": 0xb9bcbf, "engine_mount": 0x2e3033, "battery": 0x2a2b2e, "power_junction_box": 0x80868c,
    "standby_battery": 0x3a3c40, "exhaust_risers": 0x4f3d30, "muffler": 0x5e544a, "heat_shroud": 0xaab0b5,
    "brake_master_cylinders": 0xa2a6ab, "brake_lines": 0x9aa0a6, "fuel_strainer": 0xb0b4b8,
    "fuel_sump_drains": 0xc4c8cc, "static_port": 0xc4c8cc,
    # Pieces within a part.
    "tray": 0x8c8f93, "cover": 0x404247, "vent": 0xd8d8d0, "hose": 0x1e1f21,
}

# Engine mount: firewall bolts -> the engine's rear mounts.
MOUNT_FW = [(0.25, 0.06), (-0.25, 0.06), (0.25, -0.45), (-0.25, -0.45)]
MOUNT_ENG = [(0.15, 0.02), (-0.15, 0.02), (0.15, -0.19), (-0.15, -0.19)]
MOUNT_ENG_Z = 1.06
MOUNT_R = 0.011
# Main battery (x, y ranges; depth forward of the firewall), outboard of
# the mount's left legs; the junction box above and inboard of it.
BATTERY_X, BATTERY_Y, BATTERY_DEPTH = (0.21, 0.43), (-0.33, -0.14), 0.16
JUNCTION_BOX = ((0.04, 0.20), (-0.04, 0.08), 0.07)
# Standby battery: (x, y, z) ranges behind the panel's upper left.
STANDBY_BATTERY = ((0.24, 0.40), (0.04, 0.11), (0.63, 0.72))
# Exhaust: the CAD cylinders' exhaust ports (measured from its own pipes),
# the muffler's axis (x from -L to L at y, z) and radii.
PORTS = {1: [(0.34, -0.166, 1.233), (0.34, -0.166, 1.364)],
         -1: [(-0.34, -0.162, 1.324), (-0.34, -0.163, 1.450)]}
MUFFLER_Y, MUFFLER_Z, MUFFLER_L, MUFFLER_R = -0.40, 1.36, 0.23, 0.064
SHROUD_L, SHROUD_R = 0.17, 0.074
RISER_R = 0.019
STACK_TOP = (-0.199, -0.475, 1.362)     # the c172p Exhaust object's upper end
# Brakes: master cylinders forward of the pilot's pedals (the outboard
# pedal works the left brake); lines run under the floor at FLOOR_Y.
PEDAL_X = {1: 0.328, -1: 0.153}
CYL_Y, CYL_Z, CYL_R = (-0.70, -0.56), 0.64, 0.02
FLOOR_Y = -0.775
BRAKE_LINE_R = 0.004
# Fuel strainer: bowl centre and radius; its drain runs down to the cowling.
STRAINER = (0.14, -0.50, FIREWALL_Z + 0.07)
STRAINER_R = 0.035
# Fuel tank sump drains, MM 28-20-00 Fig. 202 detail A (right wing seen
# from below; left typical): (WS, inches aft of the front spar).
SUMP_DRAINS = [(32.8, 23.3), (55.7, 23.3), (63.4, 16.6), (63.4, 3.3), (37.6, 3.3)]
FRONT_SPAR = 0.24                        # m aft of the leading edge (estimate)
# Static port: FS and height on the left side.
STATIC_PORT = (14.0, -0.15)


def rgb_of(c, n):
    return np.tile([(c >> 16) / 255, (c >> 8 & 255) / 255, (c & 255) / 255], (n, 1))


def tube(points, r, sides=10, caps=False):
    """Tube along a polyline -> (verts, tris)."""
    p = np.asarray(points, dtype=np.float64)
    seg = np.diff(p, axis=0)
    seg /= np.linalg.norm(seg, axis=1)[:, None]
    tang = np.vstack([seg[:1], seg[:-1] + seg[1:], seg[-1:]])
    tang /= np.linalg.norm(tang, axis=1)[:, None]
    a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    verts, n = [], np.array([0.0, 1.0, 0.0])
    for c, t in zip(p, tang):
        n = n - t * (n @ t)             # carried along the tube: no twist
        if np.linalg.norm(n) < 1e-6:
            n = np.array([1.0, 0.0, 0.0]) - t * t[0]
        n /= np.linalg.norm(n)
        u = np.cross(t, n)
        verts.append(c + r * (np.cos(a)[:, None] * u + np.sin(a)[:, None] * n))
    tris = []
    for i in range(len(p) - 1):
        for j in range(sides):
            a0, a1 = i * sides + j, i * sides + (j + 1) % sides
            tris += [(a0, a1, a1 + sides), (a0, a1 + sides, a0 + sides)]
    verts = np.vstack(verts)
    if caps:
        k = len(verts)
        verts = np.vstack([verts, p[:1], p[-1:]])
        last = (len(p) - 1) * sides
        tris += [(k, (j + 1) % sides, j) for j in range(sides)]
        tris += [(k + 1, last + j, last + (j + 1) % sides) for j in range(sides)]
    return verts, np.array(tris)


def cylinder(a, b, r, sides=16):
    return tube([a, b], r, sides, caps=True)


def box(lo, hi):
    lo, hi = np.asarray(lo, dtype=np.float64), np.asarray(hi, dtype=np.float64)
    v = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
    q = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return v, np.array([t for a, b, c, d in q for t in ((a, b, c), (a, c, d))])


def hull(pts):
    """2D convex hull (monotone chain), counter-clockwise."""
    pts = sorted(map(tuple, np.round(pts, 6)))

    def turn(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and turn(out[-2], out[-1], p) <= 0:
                out.pop()
            out.append(p)
        return out[:-1]
    return np.array(half(pts) + half(pts[::-1]))


def part(pid, system, pieces, ask=False):
    """pieces: meshes (verts, tris) in the part's colour, or (colour key,
    mesh) pairs."""
    verts, tris, rgb, n = [], [], [], 0
    for m in pieces:
        key, (v, f) = m if isinstance(m[0], str) else (pid, m)
        verts.append(v)
        tris.append(f + n)
        rgb.append(rgb_of(COLORS[key], len(v)))
        n += len(v)
    return {"id": pid, "system": system, "kind": "target", "glass": False, "ask": ask,
            "pieces": [{"tex": None, "verts": np.vstack(verts), "tris": np.vstack(tris), "uv": None,
                        "rgb": np.vstack(rgb)}]}


def verts_of(parts, pid):
    return np.vstack([q["verts"] for p in parts if p["id"] == pid for q in p["pieces"]])


def firewall(parts):
    cowl = verts_of(parts, "cowling")
    ring = hull(cowl[cowl[:, 2] < FIREWALL_Z + 0.15][:, :2])
    mid = ring.mean(0)
    ring = mid + (ring - mid) * 0.98
    v = np.vstack([[*mid, FIREWALL_Z], np.column_stack([ring, np.full(len(ring), FIREWALL_Z)])])
    k = len(ring)
    return v, np.array([(0, 1 + i, 1 + (i + 1) % k) for i in range(k)])


def engine_mount():
    fw = [(x, y, FIREWALL_Z) for x, y in MOUNT_FW]
    en = [(x, y, MOUNT_ENG_Z) for x, y in MOUNT_ENG]
    tubes = [tube([fw[i], en[i]], MOUNT_R) for i in range(4)]
    tubes.append(tube([en[0], en[1], en[3], en[2], en[0]], MOUNT_R))   # the ring the engine bolts to
    return tubes


def main_battery():
    (x0, x1), (y0, y1), d = BATTERY_X, BATTERY_Y, BATTERY_DEPTH
    z0, z1 = FIREWALL_Z + 0.005, FIREWALL_Z + 0.005 + d
    vent_x = x1 - 0.03
    return [("tray", box((x0 - 0.01, y0 - 0.012, FIREWALL_Z), (x1 + 0.01, y0, z1 + 0.01))),
            box((x0, y0, z0), (x1, y1 - 0.015, z1)),
            ("cover", box((x0 - 0.005, y1 - 0.015, z0 - 0.005), (x1 + 0.005, y1, z1 + 0.005))),
            ("vent", tube([(vent_x, y1 - 0.03, z1 - 0.02), (vent_x, y1 + 0.02, z1 - 0.02),
                           (vent_x, y1 + 0.02, z0 + 0.01), (vent_x, y0 - 0.08, z0 + 0.01)], 0.008, 8))]


def junction_box():
    (x0, x1), (y0, y1), d = JUNCTION_BOX
    return [box((x0, y0, FIREWALL_Z), (x1, y1, FIREWALL_Z + d))]


def standby_battery():
    (x0, x1), (y0, y1), (z0, z1) = STANDBY_BATTERY
    return [box((x0, y0, z0), (x1, y1, z1)),
            ("tray", box((x0 - 0.01, y1, z0 - 0.01), (x1 + 0.01, y1 + 0.008, z1 + 0.01)))]


def exhaust():
    """-> (risers, muffler with tailpipe, heat shroud)."""
    risers = []
    for side, ports in PORTS.items():
        inlet = np.array([side * MUFFLER_L, MUFFLER_Y, MUFFLER_Z])
        for k, port in enumerate(ports):
            port = np.array(port)
            end = inlet + (0, 0.018 * (1 if k else -1), 0.025 * (1 if k else -1))
            path = [port, port + (0, -0.07, 0), port + (side * -0.01, -0.15, 0),
                    end + (side * 0.06, 0.02, 0), end + (side * 0.01, 0, 0)]
            risers.append(tube(path, RISER_R, 12))
    a, b = (-MUFFLER_L, MUFFLER_Y, MUFFLER_Z), (MUFFLER_L, MUFFLER_Y, MUFFLER_Z)
    muffler = [cylinder(a, b, MUFFLER_R, 20),
               tube([(STACK_TOP[0], MUFFLER_Y - MUFFLER_R + 0.02, STACK_TOP[2]),
                     (STACK_TOP[0], STACK_TOP[1] - 0.01, STACK_TOP[2])], RISER_R, 12)]
    sa, sb = (-SHROUD_L, MUFFLER_Y, MUFFLER_Z), (SHROUD_L, MUFFLER_Y, MUFFLER_Z)
    shroud = [cylinder(sa, sb, SHROUD_R, 20),
              # The outlet to the cabin heat duct, on the aft side.
              tube([(0.05, MUFFLER_Y, MUFFLER_Z - SHROUD_R + 0.01), (0.05, MUFFLER_Y, MUFFLER_Z - SHROUD_R - 0.03)],
                   0.025, 12)]
    return risers, muffler, shroud


def brakes(parts):
    """-> (master cylinders, brake lines)."""
    legs, calipers = verts_of(parts, "main_gear_legs"), verts_of(parts, "brakes")
    cylinders, lines = [], []
    for side, px in PEDAL_X.items():
        cylinders.append(cylinder((px, CYL_Y[0], CYL_Z), (px, CYL_Y[1], CYL_Z), CYL_R))
        cylinders.append(("hose", tube([(px, CYL_Y[0], CYL_Z), (px, FLOOR_Y + 0.02, CYL_Z - 0.03),
                                        (px, FLOOR_Y, CYL_Z - 0.10)], 0.006, 8)))
        leg = legs[legs[:, 0] * side > 0]
        cal = calipers[calipers[:, 0] * side > 0]
        x = np.abs(leg[:, 0])
        edges = np.linspace(x.min(), x.max(), 9)
        down = []
        for lo, hi in zip(edges[:-1], edges[1:]):
            s = leg[(x >= lo) & (x <= hi)]
            if len(s):
                down.append((s[:, 0].mean(), s[:, 1].mean(), s[:, 2].min() - BRAKE_LINE_R))
        c = cal.mean(0)
        down.append((c[0], cal[:, 1].max(), c[2]))
        top = down[0]
        path = [(px, FLOOR_Y, CYL_Z - 0.10), (px, FLOOR_Y, top[2]), (top[0] - side * 0.08, FLOOR_Y, top[2]), *down]
        lines.append(tube(path, BRAKE_LINE_R, 6))
    return cylinders, lines


def fuel_strainer(parts):
    cowl = verts_of(parts, "cowling")
    x, y, z = STRAINER
    near = cowl[(np.abs(cowl[:, 0] - x) < 0.06) & (np.abs(cowl[:, 2] - z) < 0.06)]
    bottom = near[:, 1].min() - 0.015
    return [cylinder((x, y + 0.045, z), (x, y - 0.045, z), STRAINER_R),
            ("tray", box((x - 0.05, y + 0.045, FIREWALL_Z), (x + 0.05, y + 0.06, z + 0.04))),
            tube([(x, y - 0.045, z), (x, bottom, z)], 0.006, 8),
            cylinder((x, bottom + 0.005, z), (x, bottom - 0.01, z), 0.011)]


def tris_of(parts, pid):
    return np.vstack([q["verts"][q["tris"]] for p in parts if p["id"] == pid for q in p["pieces"]])


def hits(tris, x, z):
    """Heights (y) where a vertical line at (x, z) crosses the triangles."""
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    d = (b[:, 2] - c[:, 2]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (a[:, 2] - c[:, 2])
    ok = np.abs(d) > 1e-12
    d = np.where(ok, d, 1)
    l1 = ((b[:, 2] - c[:, 2]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (z - c[:, 2])) / d
    l2 = ((c[:, 2] - a[:, 2]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (z - c[:, 2])) / d
    l3 = 1 - l1 - l2
    inside = ok & (l1 >= 0) & (l2 >= 0) & (l3 >= 0)
    return (l1 * a[:, 1] + l2 * b[:, 1] + l3 * c[:, 1])[inside]


def sump_drains(parts):
    out = []
    for pid, side in (("left_wing", 1), ("right_wing", -1)):
        # The wing skins are partly in the fuselage part (wing_center and so on).
        wing = np.vstack([tris_of(parts, pid), tris_of(parts, "fuselage")])
        wing = wing[(wing[:, :, 1] > 0.25).all(1)]
        for ws, aft in SUMP_DRAINS:
            x = side * ws * IN
            le = next(z for z in np.arange(0.6, -1.5, -0.005) if len(hits(wing, x, z)))
            z = le - FRONT_SPAR - aft * IN
            y = hits(wing, x, z).min()
            out.append(cylinder((x, y + 0.01, z), (x, y - 0.018, z), 0.011, 12))
    return out


def static_port(parts):
    station, y = STATIC_PORT
    z = fs(station)
    # A ray along x: the triangles as (z, x, y) so hits() returns x.
    x = hits(tris_of(parts, "fuselage")[:, :, [2, 0, 1]], z, y).max()
    return [cylinder((x - 0.01, y, z), (x + 0.004, y, z), 0.016, 16)]


def load(parts):
    """-> parts to add to the aircraft and engine's."""
    risers, muffler, shroud = exhaust()
    cylinders, lines = brakes(parts)
    return [part("firewall", "engine", [firewall(parts)]),
            part("engine_mount", "engine", engine_mount(), ask=True),
            part("exhaust_risers", "engine", risers, ask=True),
            part("muffler", "engine", muffler, ask=True),
            part("heat_shroud", "engine", shroud, ask=True),
            part("battery", "engine", main_battery()),
            part("power_junction_box", "engine", junction_box()),
            part("fuel_strainer", "fuel", fuel_strainer(parts)),
            part("standby_battery", "electrical", standby_battery()),
            part("brake_master_cylinders", "landing_gear", cylinders),
            part("brake_lines", "landing_gear", lines),
            part("fuel_sump_drains", "fuel", sump_drains(parts)),
            part("static_port", "pitot_static", static_port(parts))]
