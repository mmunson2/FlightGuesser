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
- Fuel system under the floor (MM 28-20-00 Figs. 201, 204, 206; POH Fig.
  7-6): a supply line from each wing root down the front door post to the
  selector valve under the pedestal, the reservoir under the copilot's
  footwell (access panels 230BT/CT) with its drain and vent, the electric
  auxiliary fuel pump, the shutoff valve, and the line through the
  firewall to the strainer; the vent line across the cabin top. One supply
  line per side (the MM shows a forward and an aft outlet on each tank).
- Stall warning (MM 27-32-00 Fig. 201: "the scoop assembly is installed on
  the leading edge of the left wing at WS 91"): scoop, tube and horn at
  the upper left door post.
- G1000 units (MM 23-10-00 Fig. 202 and 34-13-00 Fig. 201: "on the
  avionics shelf in the tailcone"; 77-40-00 Fig. 201; 34-22-00 Fig. 201):
  the two GIA 63 integrated avionics units, the GTX 33 transponder, the
  GRS 77 AHRS and GDC 74A air data computer on the shelf above them, and
  the tailcone fan; the GEA 71 engine/airframe unit forward of the panel
  under the MFD; the GMU 44 magnetometer inside the left wing, reached
  through access plate 520HB underneath. Unit sizes are estimates.
- Engine accessories (MM 79-20-00 Fig. 201: oil cooler "secured to rear of
  engine baffles", on the left; MM 80-10-00: starter "at the front
  (propeller end) lower left side of the engine"; MM 37-10-00 Fig. 201:
  vacuum pump on the accessory housing; Lycoming IPC PC-IO-360-L2A Fig. 20:
  spin-on oil filter pointing aft from the accessory housing).
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
    "fuel_reservoir": 0xb4b8bc, "fuel_selector_valve": 0x9c8a5c, "fuel_shutoff_valve": 0xa08c5a,
    "aux_fuel_pump": 0x3c3f44, "fuel_lines": 0x6fa0c8, "stall_warning": 0xd0d2d4,
    "integrated_avionics_units": 0x26282b, "transponder": 0x303236, "ahrs": 0x2c2e31,
    "air_data_computer": 0x34363a, "engine_airframe_unit": 0x2a2c2f, "magnetometer": 0x3a3d41,
    "avionics_shelf": 0xa6aaae, "oil_cooler": 0x2f3133, "starter": 0x3a3c3f, "vacuum_pump": 0x4a4d52,
    "oil_filter": 0x1f4f9a,
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
MUFFLER_Y, MUFFLER_Z, MUFFLER_L, MUFFLER_R = -0.40, 1.41, 0.23, 0.064   # forward of the servo
SHROUD_L, SHROUD_R = 0.17, 0.074
RISER_R = 0.019
STACK_TOP = (-0.199, -0.475, 1.362)     # the c172p Exhaust object's upper end
# Brakes: master cylinders forward of the pilot's pedals (the outboard
# pedal works the left brake); lines run under the floor at FLOOR_Y.
PEDAL_X = {1: 0.328, -1: 0.153}
CYL_Y, CYL_Z, CYL_R = (-0.66, -0.52), 0.64, 0.02
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
# Fuel under the floor. The cabin floor is at y -0.67, the belly about
# -0.79; the door posts at |x| 0.495, z 0.19. Reservoir (x, y, z ranges)
# under the copilot's footwell; selector valve under the pedestal (the
# handle, fuel_selector, is at x 0, z 0.17-0.32); pump and shutoff valve
# between the reservoir and the firewall.
POST_X, POST_Z = 0.495, 0.19
UNDER_FLOOR = -0.735
RESERVOIR = ((-0.25, -0.09), (-0.765, -0.705), (0.46, 0.62))    # under the carpet, above the belly
SELECTOR_VALVE = (0.0, UNDER_FLOOR, 0.25)
AUX_PUMP = ((-0.21, -0.07), UNDER_FLOOR, 0.705, 0.032)       # x range, y, z, radius
SHUTOFF_VALVE = (0.0, UNDER_FLOOR, 0.75)
WING_OUTLET = (0.56, 0.42, 0.10)                             # |x|, y, z: tank outlet at the root
VENT_LINE = (0.50, -0.05)                                    # y, z: across the cabin top
FUEL_LINE_R, VENT_R = 0.006, 0.004
# Stall warning: the scoop's wing station; the horn at the upper left door post.
STALL_WS = 91.0
STALL_HORN = (0.47, 0.28, 0.20)
# Tailcone avionics shelf, MM FS 142-157, centred on the fuselage.
SHELF_FS = (142.0, 157.0)
RACK_Y = (-0.555, -0.355)                                    # the GIA 63s and GTX 33 stand on edge
RACK_UNITS = [("integrated_avionics_units", 0.025, 0.093), ("integrated_avionics_units", -0.045, 0.022),
              ("transponder", -0.088, -0.047)]               # x ranges (2.65 in and 1.65 in wide)
AHRS = ((-0.05, 0.05), (-0.345, -0.26), 0.17)                # x, y, depth from the shelf's aft end
AIR_DATA = ((-0.05, 0.05), (-0.345, -0.27), 0.14)            # from its forward end
FAN = (-0.17, -0.42, 0.045)                                  # x, y, radius, on the forward bulkhead
# GEA 71 under the MFD (x -0.28 to -0.02 at the panel, z 0.35), lying flat.
GEA = ((-0.23, -0.07), (-0.125, -0.06), (0.40, 0.64))       # behind the standby instruments
# GMU 44: wing station and chord fraction (access plate 520HB; estimate).
GMU_WS, GMU_CHORD = 115.0, 0.38
# Engine accessories (scene coordinates beside the CAD engine), each at
# the clear spot nearest where the sources put it (tools/geometry.py
# overlaps finds collisions).
OIL_COOLER = ((0.17, 0.31), (0.05, 0.17), (1.065, 1.10))     # clear of the injector lines
STARTER = (0.17, -0.19, (1.52, 1.66), 0.045)
VACUUM_PUMP = (-0.055, -0.085, (0.93, 1.01), 0.042)
OIL_FILTER = (-0.025, 0.02, (0.90, 1.01), 0.046)


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
    shroud = [tube([sa, sb], SHROUD_R, 20),                   # an open sleeve round the muffler
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


def fuel_system(parts):
    """-> (reservoir, selector valve, aux pump, shutoff valve, lines)."""
    (x0, x1), (y0, y1), (z0, z1) = RESERVOIR
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    stack = (x1 - 0.03, y1, z0 + 0.04)
    reservoir = [box((x0, y0, z0), (x1, y1, z1)),
                 cylinder((stack[0], y1, stack[2]), (stack[0], y1 + 0.02, stack[2]), 0.018, 12),
                 ("tray", cylinder((cx, y0, z1 - 0.03), (cx, y0 - 0.012, z1 - 0.03), 0.008, 8))]
    sx, sy, sz = SELECTOR_VALVE
    valve = [box((sx - 0.03, sy - 0.025, sz - 0.03), (sx + 0.03, sy + 0.025, sz + 0.03)),
             tube([(sx, sy + 0.025, sz), (sx, -0.64, sz)], 0.006, 8)]          # shaft to the handle
    (px0, px1), py, pz, pr = AUX_PUMP
    pump = [cylinder((px0, py, pz), (px1, py, pz), pr, 16)]
    vx, vy, vz = SHUTOFF_VALVE
    shutoff = [box((vx - 0.025, vy - 0.025, vz - 0.02), (vx + 0.025, vy + 0.025, vz + 0.02))]
    lines = []
    for side in (1, -1):
        wx, wy, wz = WING_OUTLET
        top = (side * POST_X, 0.30, POST_Z)
        lines.append(tube([(side * wx, wy, wz), (side * POST_X, wy - 0.04, POST_Z), top,
                           (side * POST_X, UNDER_FLOOR, POST_Z), (side * 0.12, UNDER_FLOOR, sz),
                           (side * 0.03, sy, sz)], FUEL_LINE_R, 8))
    lines.append(tube([(sx, sy, sz + 0.03), (sx, sy, sz + 0.12), (x1 - 0.02, UNDER_FLOOR, z0 - 0.05),
                       (x1 - 0.02, UNDER_FLOOR, z0)], FUEL_LINE_R, 8))           # selector -> reservoir
    lines.append(tube([(cx, UNDER_FLOOR, z1), (cx, UNDER_FLOOR, pz - pr)], FUEL_LINE_R, 8))  # -> pump
    lines.append(tube([(px1, py, pz), (vx - 0.025, vy, vz)], FUEL_LINE_R, 8))          # -> shutoff
    sx_, sy_, sz_ = STRAINER
    lx = sx_ - STRAINER_R - 0.008
    lines.append(tube([(vx + 0.025, vy, vz), (lx, -0.62, FIREWALL_Z), (lx, sy_ + 0.03, sz_),
                       (sx_ - STRAINER_R, sy_ + 0.03, sz_)],
                      FUEL_LINE_R, 8))                                           # through the firewall
    vy_, vz_ = VENT_LINE
    lines.append(tube([(POST_X + 0.06, vy_ - 0.06, vz_), (POST_X, vy_, vz_), (-POST_X, vy_, vz_),
                       (-POST_X - 0.06, vy_ - 0.06, vz_)], VENT_R, 6))
    lines.append(tube([(stack[0], y1 + 0.02, stack[2]), (stack[0], y1 + 0.03, stack[2] - 0.05),
                       (-POST_X, y1 + 0.03, POST_Z - 0.03), (-POST_X, 0.30, POST_Z - 0.03),
                       (-POST_X, vy_, vz_)], VENT_R, 6))                         # reservoir vent
    return reservoir, valve, pump, shutoff, lines


def wing_skin(parts, side):
    pid = "left_wing" if side > 0 else "right_wing"
    wing = np.vstack([tris_of(parts, pid), tris_of(parts, "fuselage")])
    return wing[(wing[:, :, 1] > 0.25).all(1)]


def leading_edge(wing, x):
    return next(z for z in np.arange(0.6, -1.5, -0.002) if len(hits(wing, x, z)))


def stall_warning(parts):
    wing = wing_skin(parts, 1)
    x = STALL_WS * IN
    le = leading_edge(wing, x)
    y = hits(wing, x, le - 0.015)
    y = y.min() + 0.35 * (y.max() - y.min())
    hx, hy, hz = STALL_HORN
    return [box((x - 0.035, y - 0.014, le - 0.02), (x + 0.035, y + 0.014, le + 0.012)),
            ("hose", tube([(x, y, le - 0.02), (x - 0.05, y, le - 0.06), (0.62, y, le - 0.06),
                           (hx + 0.03, hy + 0.05, hz), (hx, hy, hz)], 0.007, 8)),
            cylinder((hx, hy, hz), (hx - 0.04, hy - 0.01, hz), 0.012, 12),
            cylinder((hx - 0.04, hy - 0.01, hz), (hx - 0.05, hy - 0.012, hz), 0.03, 16)]


def avionics(parts):
    """-> {part id: pieces} for the G1000 units."""
    out = {k: [] for k in ("integrated_avionics_units", "transponder", "ahrs", "air_data_computer",
                           "avionics_shelf", "engine_airframe_unit", "magnetometer")}
    za, zb = fs(SHELF_FS[1]), fs(SHELF_FS[0])        # aft, forward
    y0, y1 = RACK_Y
    for pid, x0, x1 in RACK_UNITS:
        out[pid].append(box((x0, y0, za + 0.02), (x1, y1, zb - 0.03)))
    out["avionics_shelf"] += [box((-0.11, y0 - 0.006, za), (0.11, y0, zb)),
                              box((-0.11, y1 + 0.004, za), (0.11, y1 + 0.01, zb))]
    (x0, x1), (ay0, ay1), d = AHRS
    out["ahrs"].append(box((x0, ay0, za + 0.01), (x1, ay1, za + 0.01 + d)))
    (x0, x1), (ay0, ay1), d = AIR_DATA
    out["air_data_computer"].append(box((x0, ay0, zb - 0.01 - d), (x1, ay1, zb - 0.01)))
    fx, fy, fr = FAN
    out["avionics_shelf"] += [cylinder((fx, fy, zb), (fx, fy, zb - 0.05), fr, 20),
                              ("tray", box((fx - fr - 0.01, fy - fr - 0.01, zb - 0.055),
                                           (fx + fr + 0.01, fy + fr + 0.01, zb - 0.05)))]
    (x0, x1), (gy0, gy1), (z0, z1) = GEA
    out["engine_airframe_unit"] += [box((x0, gy0, z0), (x1, gy1, z1)),
                                    ("tray", box((x0 - 0.01, gy0 - 0.006, z0), (x1 + 0.01, gy0, z1 + 0.02)))]
    wing = wing_skin(parts, 1)
    x = GMU_WS * IN
    le = leading_edge(wing, x)
    te = next(z for z in np.arange(-1.6, 0.6, 0.002) if len(hits(wing, x, z)))
    z = le - GMU_CHORD * (le - te)
    y = hits(wing, x, z).min()
    out["magnetometer"] += [cylinder((x, y + 0.012, z), (x, y + 0.06, z), 0.04, 20),
                            ("tray", cylinder((x, y + 0.002, z), (x, y - 0.002, z), 0.055, 20))]
    return out


def engine_accessories():
    """-> (oil cooler, starter, vacuum pump, oil filter)."""
    (x0, x1), (y0, y1), (z0, z1) = OIL_COOLER
    cooler = [box((x0, y0, z0), (x1, y1, z1)),
              ("hose", tube([(x0 + 0.03, y0, (z0 + z1) / 2), (x0 + 0.02, y0 - 0.06, z0 - 0.02),
                             (0.07, -0.10, 1.03)], 0.011, 10)),
              ("hose", tube([(x0 + 0.08, y0, (z0 + z1) / 2), (x0 + 0.07, y0 - 0.08, z0 - 0.03),
                             (0.08, -0.12, 1.02)], 0.011, 10))]
    x, y, (za, zb), r = STARTER
    starter = [cylinder((x, y, za), (x, y, zb), r, 20),
               cylinder((x, y + r, za + 0.03), (x, y + r + 0.03, za + 0.03), 0.018, 12)]     # solenoid
    x, y, (za, zb), r = VACUUM_PUMP
    vacuum = [cylinder((x, y, za), (x, y, zb), r, 20),
              ("hose", tube([(x, y + r, za + 0.02), (x, y + r + 0.05, za - 0.03), (x, 0.02, FIREWALL_Z + 0.01)],
                            0.009, 8))]
    x, y, (za, zb), r = OIL_FILTER
    oil_filter = [cylinder((x, y, za), (x, y, zb - 0.02), r, 20),
                  ("tray", box((x - 0.03, y - 0.03, zb - 0.02), (x + 0.03, y + 0.03, zb)))]
    return cooler, starter, vacuum, oil_filter


def load(parts):
    """-> parts to add to the aircraft and engine's."""
    risers, muffler, shroud = exhaust()
    cylinders, lines = brakes(parts)
    reservoir, valve, pump, shutoff, fuel_lines = fuel_system(parts)
    fuel = [part("fuel_reservoir", "fuel", reservoir), part("fuel_selector_valve", "fuel", valve),
            part("aux_fuel_pump", "fuel", pump), part("fuel_shutoff_valve", "fuel", shutoff),
            part("fuel_lines", "fuel", fuel_lines)]
    stall = part("stall_warning", "flight_controls", stall_warning(parts))
    units = [part(pid, "avionics", pieces) for pid, pieces in avionics(parts).items()]
    cooler, starter, vacuum, oil_filter = engine_accessories()
    engine_parts = [part("oil_cooler", "engine", cooler, ask=True), part("starter", "engine", starter, ask=True),
                    part("vacuum_pump", "engine", vacuum, ask=True),
                    part("oil_filter", "engine", oil_filter, ask=True)]
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
            part("static_port", "pitot_static", static_port(parts)),
            *fuel, stall, *units, *engine_parts]
