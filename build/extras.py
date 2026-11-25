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
- Fuel tanks (MM 28-20-00: "a wet wing fuel storage system ... two integral
  fuel tanks (one in each wing)"; Fig. 202 detail A: each bay runs from WS
  23.62 to WS 71.62 between the front and rear spars; 28-21-00 Fig. 201):
  a block filling the wing between the skins there. The fuel level sender
  (Fig. 203: on a rib, its float arm in the bay) is on the bay's inboard
  rib; the rear spar's place is an estimate. The filler opening is cut
  through the bay's top, as through the wing skin (aircraft.CUT_HOLES).
- Static wicks (MM 23-60-00 Fig. 201: "on the trailing edges of the
  ailerons, rudder and the elevators"): two at the outboard end of each
  aileron and elevator and two at the top of the rudder, pointing aft.
  Their length is an estimate.
- Outside air temperature probe (MM 34-12-00: "mounted on the upper cabin
  roof line at FS 46.46"; Fig. 201): a short stem on the roof. The MM
  describes the non-G1000 probe; the G1000's feeds the GDC 74A.
- Oil filler tube (POH 7: "located at the right rear of the engine case";
  MM 12-14-02 Fig. 301; Lycoming PC Fig. 14 "Oil Level Gage"): from the
  crankcase's right rear up to FlightGear's dipstick, sheathing it to just
  under the cap. Added to the `oil_filler_cap` part.
- Induction air (MM 71-60-00: "Ram air to the engine goes into the
  induction air box through the induction filter in the forward part of
  the lower engine cowl. From the induction air box, the air is pointed to
  the inlet of the fuel/air control unit"; Fig. 201): the filter in
  FlightGear's chin inlet (where its "radiator" plate was), the filter box
  behind it with the spring-loaded alternate air door (Detail B) on top,
  and the duct under the muffler to the induction air elbow, which turns
  up into the inlet adaptor under the fuel servo, with its drain line.
  Sizes are estimates; the door's side of the box is a guess.
- Nose gear mounting (MM 32-20-00 Fig. 202: "upper nose gear fitting";
  removal: "the bolt from the top of the strut", "the strut clamp with the
  bottom strut fitting on the firewall"): FlightGear's strut ends ~17 cm
  ahead of the firewall with nothing holding it, so its barrel is carried
  up into an upper fitting, and a clamp below it, both braced back to
  plates on the firewall. The shimmy damper runs from the steering collar
  up to a bracket under the bottom fitting; the two spring-loaded
  steering tubes run from the collar aft through the firewall to the
  rudder bars. Fitting and tube sizes and the bar ends are estimates.
- Belly fuel drains (POH 7, Fuel Drain Valves: "each wing tank sump, the
  fuel reservoir tank sump, the fuel selector valve drain and the fuel
  strainer sump"; POH 4: "Fuel Strainer Quick Drain Valve (located on
  bottom of fuselage)"; MM 12-10-00 Fig. 1: "fuel selector and fuel
  reservoir drains" on the belly just aft of the firewall): a line from
  the reservoir's sump, the selector valve and the strainer bowl down
  through the skin to a quick drain valve, each its own part.
- Flight control cables (MM 27-10-00 Fig. 201 ailerons, 27-20-00 Fig. 201
  rudder, 27-30-00 Fig. 201 elevator, 27-31-00 Fig. 201 trim): the
  control column (a T behind the panel joining both yoke shafts, down to
  the floor); the aileron direct cables from the column base along the
  floor, up each front door post and out the wing's rear spar to the
  bellcrank at the aileron, and the carry-thru cable joining the two
  bellcranks across the cabin top; the elevator push-pull tube from the
  column to the forward bellcrank under the floor, the up and down cables
  aft along the belly and up the tailcone to the aft bellcrank at the
  elevator; the rudder cables from the rudder bar aft to FlightGear's
  stubs at the tail; the trim wheel's chain and cables aft to the
  actuator in the right stabilizer and its push rod to the tab. Pulleys
  sit where a run bends. The routes follow the figures; stations are
  estimates (no pulley stations are given).
- Engine accessories (MM 79-20-00 Fig. 201: oil cooler "secured to rear of
  engine baffles", on the left; MM 80-10-00: starter "at the front
  (propeller end) lower left side of the engine"; MM 37-10-00 Fig. 201:
  vacuum pump on the accessory housing; Lycoming IPC PC-IO-360-L2A Fig. 20:
  spin-on oil filter pointing aft from the accessory housing).
"""

import numpy as np

import aircraft
from engine import FIT, ref_to_scene as E

IN = 0.0254
# The firewall's front face in scene z: the cowling's aft edge.
FIREWALL_Z = 0.785


def fs(station):
    return FIREWALL_Z - station * IN


COLORS = {
    "firewall": 0xb9bcbf, "engine_mount": 0x2e3033, "battery": 0x2a2b2e, "power_junction_box": 0x80868c,
    "standby_battery": 0x3a3c40, "exhaust_risers": 0x4f3d30, "muffler": 0x5e544a, "heat_shroud": 0xaab0b5,
    "brake_master_cylinders": 0xa2a6ab, "brake_lines": 0x9aa0a6, "fuel_strainer": 0xb0b4b8,
    "fuel_sump_drains": 0xc4c8cc, "fuel_reservoir_drain": 0xc4c8cc, "fuel_selector_drain": 0xc4c8cc,
    "fuel_strainer_drain": 0xc4c8cc, "static_port": 0xc4c8cc,
    "fuel_reservoir": 0xb4b8bc, "fuel_selector_valve": 0x9c8a5c, "fuel_shutoff_valve": 0xa08c5a,
    "aux_fuel_pump": 0x3c3f44, "fuel_lines": 0x6fa0c8, "stall_warning": 0xd0d2d4,
    "integrated_avionics_units": 0x26282b, "transponder": 0x303236, "ahrs": 0x2c2e31,
    "air_data_computer": 0x34363a, "engine_airframe_unit": 0x2a2c2f, "magnetometer": 0x3a3d41,
    "avionics_shelf": 0xa6aaae, "oil_cooler": 0x2f3133, "starter": 0x3a3c3f, "vacuum_pump": 0x4a4d52,
    "oil_filter": 0x1f4f9a, "control_column": 0x4a4d52, "aileron_cables": 0xb8bcc0,
    "aileron_bellcranks": 0x8a8f96, "elevator_cables": 0xb8bcc0, "elevator_bellcranks": 0x8a8f96,
    "rudder_cables": 0xb8bcc0, "elevator_trim_cables": 0xb8bcc0, "trim_tab_actuator": 0x5c5f63,
    "pulley": 0x2f3133, "nose_gear_fittings": 0x6d7176, "shimmy_damper": 0x3a3c40,
    "nose_steering_tubes": 0x9a9ea3, "nose_gear_strut": 0xc4c8cc, "induction_air_filter": 0xd9c58f, "induction_air_box": 0x55585d,
    "induction_air_duct": 0x2c2d30, "alternate_air_door": 0x7d8187, "oil_filler_cap": 0x8c8f93, "fuel_tanks": 0x7fb2e0, "fuel_quantity_senders": 0x8a8f96,
    "static_wicks": 0x2b2b2b, "oat_probe": 0xc8ccd0,
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
BATTERY_X, BATTERY_Y, BATTERY_DEPTH = (0.255, 0.475), (-0.33, -0.14), 0.16    # clear of the harness
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
# Fuel bays (MM 28-20-00 Fig. 202): WS range; chord from the front spar to
# the rear spar (inches aft of the front spar: estimate, past the aftmost
# drain at 23.3); the skins' inset.
BAY_WS, BAY_CHORD, BAY_INSET = (23.62, 71.62), 26.0, 0.015
TANK_HOLE_MORE = 0.01                    # m: the bay's opening is wider than the skin's, hidden under it
SENDER = (0.45, 0.012)
# Static wicks: length, radius; spacing of each pair along the edge (m).
WICK_L, WICK_R, WICK_GAP = 0.13, 0.0035, 0.12
# OAT probe: FS, height of the stem above the roof, radius.
OAT_PROBE = (46.46, 0.05, 0.008)                   # chord fraction of the bay, float arm radius
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
GEA = ((-0.23, -0.07), (-0.055, 0.01), (0.40, 0.64))       # behind the standby instruments, above the column
# GMU 44: wing station and chord fraction (access plate 520HB; estimate).
GMU_WS, GMU_CHORD = 115.0, 0.38
# Induction air: the filter face (x half-width, y range, z of its front
# and depth) in the chin inlet; the filter box behind it (back face z);
# the duct's height under the muffler and radius.
FILTER = (0.10, (-0.55, -0.44), 1.605, 0.03)
AIR_BOX_Z = 1.47
DUCT_Y, DUCT_R = -0.555, 0.04
ALT_DOOR = (0.07, 0.05)                  # width (x), length (z), on the box's top
# Nose gear: FlightGear's strut axis (scene z = a * y + b, x = 0, fitted to
# its slices), the y of the extended barrel's top, the fittings' y and
# the steering collar's y; the steering tubes' ends at the rudder bars.
STRUT_AXIS = (-0.296, 0.767)
STRUT_TOP_Y, STRUT_R = -0.575, 0.026
UPPER_FITTING_Y, LOWER_FITTING_Y, COLLAR_Y = -0.59, -0.662, -0.775
RUDDER_BAR = (0.15, -0.655, 0.575)
# Flight controls: the yoke shafts' forward ends (x, y, z) and the
# column's T behind the panel; the cable radius; the depth under the
# cabin floor; aileron bellcrank WS-ish x and the cables' chord spot (z
# along the rear spar); the aft elevator bellcrank; the trim actuator.
YOKE_ENDS = [(0.221, -0.097, 0.456), (-0.239, -0.097, 0.456)]
COLUMN_Z, COLUMN_FOOT_Y = 0.58, -0.70
CABLE_R, PULLEY_R = 0.0025, 0.022             # fits between the belly skin and the floor
UNDER_FLOOR_Y = -0.785
AILERON_BELLCRANK_X, REAR_SPAR_Z = 2.78, -0.752     # just aft of the fuel bay, ahead of the flap
DOOR_POST = (0.47, 0.19)                  # |x|, z of the front door posts
ELEVATOR_BELLCRANK = (0.0, -0.52, -4.86)
TRIM_ACTUATOR = (-0.50, -0.415, (-4.70, -4.54))     # in the stabilizer, ahead of the elevator
TAIL_ZS = [-0.5, -1.3, -2.1, -2.9, -3.7, -4.3]
# Oil filler tube: its foot on the crankcase's right rear (REF_SCALE
# frame) and its top just under FlightGear's dipstick cap.
FILLER_FOOT, FILLER_TOP_Y, FILLER_R = (-0.115, -0.10, 1.095), 0.09, 0.013
# Engine-relative spots (the mount's engine end, the exhaust ports and
# muffler, the accessories) are in engine.py's REF_SCALE frame and go
# through E() (engine.ref_to_scene), so they follow the engine's FIT.
# Engine accessories (scene coordinates beside the CAD engine), each at
# the clear spot nearest where the sources put it (tools/geometry.py
# overlaps finds collisions).
OIL_COOLER = ((0.17, 0.27), (0.065, 0.14), (1.065, 1.10))    # above the injector lines, under the cowling
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
    en = [E((x, y, MOUNT_ENG_Z)) for x, y in MOUNT_ENG]
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
        inlet = E((side * MUFFLER_L, MUFFLER_Y, MUFFLER_Z))
        for k, port in enumerate(ports):
            port = E(port)
            end = inlet + (0, 0.018 * (1 if k else -1), 0.025 * (1 if k else -1))
            path = [port, port + (0, -0.07, 0), port + (side * -0.01, -0.15, 0),
                    end + (side * 0.06, 0.02, 0), end + (side * 0.01, 0, 0)]
            risers.append(tube(path, RISER_R, 12))
    _, my, mz = E((0, MUFFLER_Y, MUFFLER_Z))
    ml, sl = MUFFLER_L * FIT[0], SHROUD_L * FIT[0]
    muffler = [cylinder((-ml, my, mz), (ml, my, mz), MUFFLER_R, 20),
               tube([(STACK_TOP[0], my - MUFFLER_R + 0.02, STACK_TOP[2]),
                     (STACK_TOP[0], STACK_TOP[1] - 0.01, STACK_TOP[2])], RISER_R, 12)]
    shroud = [tube([(-sl, my, mz), (sl, my, mz)], SHROUD_R, 20),   # an open sleeve round the muffler
              # The outlet to the cabin heat duct, on the aft side.
              tube([(0.05, my, mz - SHROUD_R + 0.01), (0.05, my, mz - SHROUD_R - 0.03)], 0.025, 12)]
    return risers, muffler, shroud


def brakes(parts):
    """-> (master cylinders, brake lines)."""
    legs, calipers = verts_of(parts, "main_gear_legs"), verts_of(parts, "brakes")
    cylinders, lines = [], []
    for side, px in PEDAL_X.items():
        cylinders.append(cylinder((px, CYL_Y[0], CYL_Z), (px, CYL_Y[1], CYL_Z), CYL_R))
        under = low_y(parts, px, CYL_Z - 0.10, FLOOR_Y, 0.006)
        cylinders.append(("hose", tube([(px, CYL_Y[0], CYL_Z), (px, under + 0.02, CYL_Z - 0.03),
                                        (px, under, CYL_Z - 0.10)], 0.006, 8)))
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
        # Under the floor, kept above the belly skin where it curves up.
        run = [(px, low_y(parts, px, z, FLOOR_Y, BRAKE_LINE_R), z)
               for z in np.linspace(CYL_Z - 0.10, top[2], 8)]
        x = top[0] - side * 0.08
        path = [*run, (x, low_y(parts, x, top[2], FLOOR_Y, BRAKE_LINE_R), top[2]), *down]
        lines.append(tube(path, BRAKE_LINE_R, 6))
    return cylinders, lines


def quick_drain(parts, x, y, z):
    """A drain line from (x, y, z) straight down through the belly or cowl
    skin to a quick drain valve -> pieces."""
    skin = np.vstack([tris_of(parts, "fuselage"), tris_of(parts, "cowling")])
    h = hits(skin, x, z)
    bottom = h[h < y].max() - 0.012
    return [tube([(x, y, z), (x, bottom, z)], 0.005, 8),
            cylinder((x, bottom + 0.006, z), (x, bottom - 0.012, z), 0.011, 12)]


def fuel_strainer(parts):
    """-> (strainer, its drain)."""
    x, y, z = STRAINER
    return ([cylinder((x, y + 0.045, z), (x, y - 0.045, z), STRAINER_R),
             ("tray", box((x - 0.05, y + 0.045, FIREWALL_Z), (x + 0.05, y + 0.06, z + 0.04)))],
            quick_drain(parts, x, y - 0.045, z))


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
                 cylinder((stack[0], y1, stack[2]), (stack[0], y1 + 0.02, stack[2]), 0.018, 12)]
    reservoir_drain = quick_drain(parts, cx, y0, z1 - 0.03)
    sx, sy, sz = SELECTOR_VALVE
    selector_drain = quick_drain(parts, sx + 0.015, sy - 0.025, sz - 0.015)
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
    return reservoir, valve, pump, shutoff, lines, reservoir_drain, selector_drain


def wing_skin(parts, side):
    pid = "left_wing" if side > 0 else "right_wing"
    wing = np.vstack([tris_of(parts, pid), tris_of(parts, "fuselage")])
    return wing[(wing[:, :, 1] > 0.25).all(1)]


def leading_edge(wing, x):
    return next(z for z in np.arange(0.6, -1.5, -0.002) if len(hits(wing, x, z)))


def skin_block(wing, xs, zs, inset):
    """A solid between a wing's skins over the grid xs * zs (scene x, z),
    inset from both skins -> (verts, tris)."""
    nx, nz = len(xs), len(zs)
    top, bot = np.zeros((nx, nz)), np.zeros((nx, nz))
    for i, x in enumerate(xs):
        for j, z in enumerate(zs):
            y = hits(wing, x, z)
            top[i, j], bot[i, j] = y.max() - inset, y.min() + inset
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    v = np.vstack([np.column_stack([X.ravel(), top.ravel(), Z.ravel()]),
                   np.column_stack([X.ravel(), bot.ravel(), Z.ravel()])])
    k = nx * nz

    def at(i, j, b=0):
        return b * k + i * nz + j
    tris = []
    for i in range(nx - 1):
        for j in range(nz - 1):
            a, b, c, d = at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)
            tris += [(a, d, c), (a, c, b), (a + k, b + k, c + k), (a + k, c + k, d + k)]
    ring = [(i, 0) for i in range(nx)] + [(nx - 1, j) for j in range(1, nz)] \
        + [(i, nz - 1) for i in range(nx - 2, -1, -1)] + [(0, j) for j in range(nz - 2, 0, -1)]
    for (i0, j0), (i1, j1) in zip(ring, ring[1:] + ring[:1]):
        a, b = at(i0, j0), at(i1, j1)
        tris += [(a, b, b + k), (a, b + k, a + k)]
    return v, np.array(tris)


def fuel_tanks(parts):
    """-> (tanks, senders): each wing's fuel bay and its fuel level sender."""
    tanks, senders = [], []
    for side in (1, -1):
        wing = wing_skin(parts, side)
        w0, w1 = BAY_WS
        front = leading_edge(wing, side * w0 * IN) - FRONT_SPAR
        rear = front - BAY_CHORD * IN
        xs = side * np.linspace(w0, w1, 9) * IN
        zs = np.linspace(front, rear, 7)
        v, f = skin_block(wing, xs, zs, BAY_INSET)
        # The filler opening, cut through the bay's top as through the skin.
        c = v[f]
        for cx, cz, r, y_min in aircraft.CUT_HOLES:
            if cx * side > 0:
                c, _, _ = aircraft.cut_hole(c, None, np.zeros_like(c), (cx, cz), r + TANK_HOLE_MORE, y_min - 0.05)
        tanks.append((c.reshape(-1, 3), np.arange(len(c) * 3).reshape(-1, 3)))
        x, z = side * (w0 * IN + 0.01), front - SENDER[0] * (front - rear)
        y = hits(wing, x, z)
        mid = (y.min() + y.max()) / 2
        senders.append(cylinder((x - side * 0.005, mid, z), (x + side * 0.035, mid, z), 0.03, 16))
        senders.append(tube([(x + side * 0.035, mid, z), (x + side * 0.08, mid - 0.02, z),
                             (x + side * 0.20, y.min() + 0.02, z)], SENDER[1] / 2, 6))
        senders.append(cylinder((x + side * 0.20, y.min() + 0.02, z), (x + side * 0.27, y.min() + 0.02, z),
                                SENDER[1], 10))
    return tanks, senders


def section(tris, axis, at):
    """Points where the triangles' edges cross the plane coordinate[axis] = at."""
    out = []
    for a, b in ((0, 1), (1, 2), (2, 0)):
        p, q = tris[:, a], tris[:, b]
        da, db = p[:, axis] - at, q[:, axis] - at
        m = (da * db < 0)
        f = (da[m] / (da[m] - db[m]))[:, None]
        out.append(p[m] + f * (q[m] - p[m]))
    return np.vstack(out)


def static_wicks(parts):
    """Two wicks at the outboard (or top) trailing edge of each aileron,
    elevator half and the rudder."""
    out = []
    surfaces = [("left_aileron", 0, 1), ("right_aileron", 0, -1), ("elevator", 0, 1), ("elevator", 0, -1),
                ("rudder", 1, 1)]
    for pid, axis, side in surfaces:
        t = tris_of(parts, pid)
        if axis == 0:
            t = t[(t[:, :, 0] * side >= 0).all(1)]
        sign = side if axis == 0 else 1
        end = (t[:, :, axis] * sign).max() * sign
        for k in (1, 2):
            p = section(t, axis, end - sign * (0.04 + (k - 1) * WICK_GAP))
            p = p[np.argmin(p[:, 2])]                    # the trailing edge there
            base = p + (0, 0, 0.01)
            tip = p + (side * 0.02 if axis == 0 else 0, 0, -WICK_L)
            out.append(tube([base, tip], WICK_R, 6))
    return out


def oat_probe(parts):
    station, h, r = OAT_PROBE
    z = fs(station)
    roof = hits(tris_of(parts, "fuselage"), 0.0, z).max()
    return [cylinder((0.0, roof - 0.005, z), (0.0, roof + h, z), r, 12),
            cylinder((0.0, roof - 0.002, z), (0.0, roof + 0.006, z), 0.016, 12)]


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
    (x0, y0, z0), (x1, y1, z1) = E((x0, y0, z0)), E((x1, y1, z1))
    hose_ends = [E((0.07, -0.10, 1.03)), E((0.08, -0.12, 1.02))]
    cooler = [box((x0, y0, z0), (x1, y1, z1)),
              ("hose", tube([(x0 + 0.03, y0, (z0 + z1) / 2), (x0 + 0.02, y0 - 0.06, z0 - 0.02), hose_ends[0]],
                            0.011, 10)),
              ("hose", tube([(x0 + 0.08, y0, (z0 + z1) / 2), (x0 + 0.07, y0 - 0.08, z0 - 0.03), hose_ends[1]],
                            0.011, 10))]
    x, y, (za, zb), r = STARTER
    (x, y, za), zb = E((x, y, za)), E((x, y, zb))[2]
    starter = [cylinder((x, y, za), (x, y, zb), r, 20),
               cylinder((x, y + r, za + 0.03), (x, y + r + 0.03, za + 0.03), 0.018, 12)]     # solenoid
    x, y, (za, zb), r = VACUUM_PUMP
    (x, y, za), zb = E((x, y, za)), E((x, y, zb))[2]
    vacuum = [cylinder((x, y, za), (x, y, zb), r, 20),
              ("hose", tube([(x, y + r, za + 0.02), (x - 0.06, y + r + 0.02, za - 0.03), (x - 0.07, 0.02, FIREWALL_Z + 0.01)],
                            0.009, 8))]
    x, y, (za, zb), r = OIL_FILTER
    (x, y, za), zb = E((x, y, za)), E((x, y, zb))[2]
    oil_filter = [cylinder((x, y, za), (x, y, zb - 0.02), r, 20),
                  ("tray", box((x - 0.03, y - 0.03, zb - 0.02), (x + 0.03, y + 0.03, zb)))]
    return cooler, starter, vacuum, oil_filter


def oil_filler_tube(parts):
    stick = verts_of(parts, "oil_filler_cap")
    foot = stick[np.argmin(stick[:, 1])]
    top = (foot[0] - 0.01, FILLER_TOP_Y, foot[2])
    a = E(FILLER_FOOT)
    return [tube([a, a + (-0.04, 0.0, -0.03), (foot[0], foot[1] - 0.01, foot[2]), top], FILLER_R, 10)]


def induction(parts):
    """-> (filter, filter box, duct with elbow, adaptor and drain line,
    alternate air door)."""
    w, (y0, y1), zf, d = FILTER
    frame = 0.012
    filt = [box((-w, y0, zf - d), (w, y1, zf)),
            ("induction_air_box", box((-w - frame, y0 - frame, zf - d - 0.005), (-w, y1 + frame, zf + 0.004))),
            ("induction_air_box", box((w, y0 - frame, zf - d - 0.005), (w + frame, y1 + frame, zf + 0.004)))]
    zb = zf - d - 0.005
    air_box = [box((-w - frame, y0 - frame, AIR_BOX_Z), (w + frame, y1 + frame, zb))]
    servo = verts_of(parts, "fuel_servo")
    throat = servo[servo[:, 1] < servo[:, 1].min() + 0.01]
    ax, az = throat[:, 0].mean(), throat[:, 2].mean()
    ay = servo[:, 1].min()
    duct = [tube([(0.0, DUCT_Y, AIR_BOX_Z), (0.0, DUCT_Y, az + 0.08), (ax, DUCT_Y + 0.01, az + 0.02),
                  (ax, ay - 0.06, az), (ax, ay - 0.012, az)], DUCT_R, 16),
            cylinder((ax, ay - 0.012, az), (ax, ay, az), DUCT_R + 0.012, 16),       # inlet adaptor flange
            tube([(ax + DUCT_R * 0.7, DUCT_Y - 0.02, az + 0.05), (ax + 0.05, DUCT_Y - 0.08, az + 0.03)],
                 0.005, 6)]                                                          # drain line
    dw, dl = ALT_DOOR
    door = [box((-dw / 2, y1 + frame, AIR_BOX_Z + 0.01), (dw / 2, y1 + frame + 0.006, AIR_BOX_Z + 0.01 + dl))]
    return filt, air_box, duct, door


def nose_gear():
    """-> (strut barrel extension, fittings, shimmy damper, steering tubes)."""
    a, b = STRUT_AXIS

    def axis(y, x=0.0):
        return np.array([x, y, a * y + b])
    top = axis(STRUT_TOP_Y)
    barrel = [cylinder(axis(-0.665), top, STRUT_R, 16)]
    fittings = []
    for y, plate in ((UPPER_FITTING_Y, (-0.62, -0.53)), (LOWER_FITTING_Y, (-0.71, -0.645))):
        c = axis(y)
        fittings.append(cylinder(c + (0, -0.015, 0.0045), c + (0, 0.015, -0.0045), 0.044, 16))   # collar / clamp
        fittings.append(box((-0.11, plate[0], FIREWALL_Z), (0.11, plate[1], FIREWALL_Z + 0.01)))   # plate
        for side in (1, -1):
            for dy in (-0.012, 0.012):
                fittings.append(tube([c + (side * 0.04, dy, -0.01), (side * 0.085, (plate[0] + plate[1]) / 2 + dy,
                                                                     FIREWALL_Z + 0.01)], 0.009, 8))
    collar = axis(COLLAR_Y)
    low = axis(LOWER_FITTING_Y)
    dx = 0.078                                   # outboard of the torque links' collar
    damper = [cylinder(collar + (dx, 0.0, 0.0), collar + (dx, 0.07, -0.021), 0.017, 12),
              tube([collar + (dx, 0.07, -0.021), low + (dx, -0.012, 0.0)], 0.006, 8),
              tube([low + (dx, -0.012, 0.0), low + (0.046, -0.012, 0.0)], 0.006, 8),          # bracket
              tube([collar + (dx - 0.017, 0.0, 0.0), collar + (0.047, 0.0, 0.0)], 0.007, 8)]  # to the collar
    bx, by, bz = RUDDER_BAR
    tubes = []
    for side in (1, -1):
        start = collar + (side * 0.05, -0.012, 0.0)
        fw = (side * 0.11, -0.735, FIREWALL_Z + 0.03)
        tubes.append(tube([start, fw, (side * 0.12, -0.73, FIREWALL_Z - 0.03), (side * bx, by, bz)], 0.008, 8))
        tubes.append(cylinder(fw, (side * 0.115, -0.733, FIREWALL_Z), 0.016, 10))   # fire sleeve at the firewall
    return barrel, fittings, damper, tubes


def pulley_at(prev, at, nxt):
    """A pulley at a bend: a disc whose axis is normal to the bend."""
    a, b = np.asarray(at) - prev, np.asarray(nxt) - at
    n = np.cross(a, b)
    if np.linalg.norm(n) < 1e-9:
        return None
    n = n / np.linalg.norm(n)
    return ("pulley", cylinder(np.asarray(at) - n * 0.006, np.asarray(at) + n * 0.006, PULLEY_R, 14))


def cable(points, pulleys=True):
    pts = [np.asarray(p, dtype=np.float64) for p in points]
    out = [tube(pts, CABLE_R, 6)]
    if pulleys:
        out += [q for q in (pulley_at(pts[i - 1], pts[i], pts[i + 1]) for i in range(1, len(pts) - 1)) if q]
    return out


def low_y(parts, x, z, want, margin=PULLEY_R):
    """A height for a cable or line near the belly: `want`, kept `margin`
    (a pulley's radius) above the skin and below the cabin floor."""
    skin = hits(np.vstack([tris_of(parts, "fuselage"), tris_of(parts, "cowling")]), x, z)
    skin = skin[skin < -0.55]
    lo = skin.min() + margin + 0.006 if len(skin) else -np.inf
    floor = hits(tris_of(parts, "cabin_floor"), x, z)
    hi = floor.min() - margin - 0.004 if len(floor) else np.inf
    return (lo + hi) / 2 if lo > hi else float(np.clip(want, lo, hi))


def belly(parts, z, dy):
    """A point dy above the fuselage's bottom on the centreline at z."""
    h = hits(tris_of(parts, "fuselage"), 0.0, z)
    return h.min() + dy


def wing_mid_y(parts, x, z):
    side = 1 if x > 0 else -1
    y = hits(wing_skin(parts, side), x, z)
    return (y.min() + y.max()) / 2


def flight_controls(parts):
    """-> {part id: pieces} for the column, cables, bellcranks and trim."""
    out = {k: [] for k in ("control_column", "aileron_cables", "aileron_bellcranks", "elevator_cables",
                           "elevator_bellcranks", "rudder_cables", "elevator_trim_cables", "trim_tab_actuator")}
    # The column: each yoke shaft carried to the T, the T, the column down.
    (lx, ly, _), (rx, _, _) = YOKE_ENDS
    for x, y, z in YOKE_ENDS:
        out["control_column"].append(tube([(x, y, z), (x, y, COLUMN_Z)], 0.012, 10))
    out["control_column"].append(tube([(lx, ly, COLUMN_Z), (rx, ly, COLUMN_Z)], 0.018, 12))
    foot = np.array([0.0, COLUMN_FOOT_Y, COLUMN_Z])
    out["control_column"].append(tube([(0.0, ly, COLUMN_Z), foot], 0.02, 12))
    # Ailerons: a direct cable each side and the carry-thru between the bellcranks.
    px, pz = DOOR_POST
    bell = {}
    for side in (1, -1):
        bx = side * AILERON_BELLCRANK_X
        by = wing_mid_y(parts, bx, REAR_SPAR_Z)
        bell[side] = np.array([bx, by, REAR_SPAR_Z])
        root = wing_mid_y(parts, side * 0.555, REAR_SPAR_Z)
        post_top = (side * px, 0.36, pz)
        cz = COLUMN_Z - 0.05
        out["aileron_cables"] += cable([foot + (side * 0.03, -0.02, 0.0),
                                        (side * 0.06, low_y(parts, side * 0.06, cz, UNDER_FLOOR_Y), cz),
                                        (side * (px - 0.02), low_y(parts, side * (px - 0.02), pz, UNDER_FLOOR_Y), pz), post_top,
                                        (side * 0.53, wing_mid_y(parts, side * 0.53, -0.10), -0.10),   # aft of the vents
                                        (side * 0.555, root, REAR_SPAR_Z), bell[side] - (side * 0.04, 0, 0)])
        # Bellcrank (a plate on a pivot) and the push rod to the aileron.
        out["aileron_bellcranks"] += [box(bell[side] - (0.05, 0.008, 0.06), bell[side] + (0.05, 0.008, 0.02)),
                                      cylinder(bell[side] - (0, 0.02, 0), bell[side] + (0, 0.02, 0), 0.008, 10),
                                      tube([bell[side] + (side * 0.04, 0, -0.05), (bx + side * 0.04, by, -0.87)],
                                           0.006, 8)]
    l, r = bell[1], bell[-1]
    top = 0.44
    out["aileron_cables"] += cable([l - (0.04, -0.01, 0.0), (0.555, wing_mid_y(parts, 0.555, REAR_SPAR_Z) + 0.01, REAR_SPAR_Z),
                                    (0.4, top, REAR_SPAR_Z), (-0.4, top, REAR_SPAR_Z),
                                    (-0.555, wing_mid_y(parts, -0.555, REAR_SPAR_Z) + 0.01, REAR_SPAR_Z),
                                    r + (0.04, 0.01, 0.0)])
    # Elevator: push-pull tube, forward bellcrank, up and down cables, aft bellcrank.
    fb = np.array([0.0, UNDER_FLOOR_Y, COLUMN_Z - 0.28])
    out["elevator_bellcranks"] += [tube([foot + (0, -0.02, 0), fb + (0, 0.0, 0.03)], 0.009, 8),
                                   box(fb - (0.06, 0.006, 0.03), fb + (0.06, 0.006, 0.03)),
                                   cylinder(fb - (0, 0.025, 0), fb + (0, 0.025, 0), 0.008, 10)]
    ex, ey, ez = ELEVATOR_BELLCRANK
    ab = np.array([ex, ey, ez])
    out["elevator_bellcranks"] += [box(ab - (0.006, 0.06, 0.03), ab + (0.006, 0.05, 0.03)),
                                   cylinder(ab - (0.03, 0, 0), ab + (0.03, 0, 0), 0.008, 10),
                                   tube([ab + (0, 0.05, 0), (0.0, -0.43, ez - 0.07)], 0.007, 8)]
    for k, (dx, dy) in enumerate(((0.03, 0.04), (-0.03, 0.065))):
        run = [fb + (dx * 2, 0, 0)] + [(dx, low_y(parts, dx, z, belly(parts, z, dy)), z) for z in TAIL_ZS] + \
              [ab + (0, 0.04 if k else -0.05, 0.02)]
        out["elevator_cables"] += cable(run)
    # Rudder: from each end of the rudder bar aft to FlightGear's stubs.
    for side in (1, -1):
        stub = (side * 0.09, -0.535, -4.68)
        run = [(side * 0.30, -0.69, 0.55), (side * 0.30, low_y(parts, side * 0.30, 0.42, UNDER_FLOOR_Y), 0.42)]
        for z in TAIL_ZS:
            h = hits(tris_of(parts, "fuselage"), 0.0, z).min()
            y = h + 0.11
            half = abs(hits(tris_of(parts, "fuselage")[:, :, [1, 0, 2]], y, z)).max()
            x = side * min(0.30, half - 0.04)
            run.append((x, low_y(parts, x, z, y), z))
        run.append(stub)
        out["rudder_cables"] += cable(run)
    # Trim: chain down the pedestal, cables aft, the actuator and its rod.
    wx, wz = 0.042, 0.41
    out["elevator_trim_cables"].append(tube([(wx, -0.42, wz), (wx, -0.70, wz)], 0.004, 6))   # chain
    tx, ty, (tz0, tz1) = TRIM_ACTUATOR
    for k, dx in enumerate((0.08, 0.12)):
        run = [(wx, -0.70, wz), (dx, low_y(parts, dx, wz - 0.06, UNDER_FLOOR_Y), wz - 0.06)] + \
              [(dx * 0.6, low_y(parts, dx * 0.6, z, belly(parts, z, 0.09 + 0.012 * k)), z) for z in TAIL_ZS] + \
              [(-0.05, ty - 0.02 * k, tz1 + 0.02), (tx + 0.03, ty, tz1 - 0.02)]
        out["elevator_trim_cables"] += cable(run)
    out["trim_tab_actuator"] += [cylinder((tx, ty, tz1), (tx, ty, tz0), 0.014, 12),
                                 tube([(tx, ty, tz0), (tx, -0.434, -5.27)], 0.004, 6)]
    return out


def load(parts):
    """-> parts to add to the aircraft and engine's."""
    risers, muffler, shroud = exhaust()
    cylinders, lines = brakes(parts)
    reservoir, valve, pump, shutoff, fuel_lines, reservoir_drain, selector_drain = fuel_system(parts)
    strainer, strainer_drain = fuel_strainer(parts)
    fuel = [part("fuel_reservoir", "fuel", reservoir), part("fuel_selector_valve", "fuel", valve),
            part("aux_fuel_pump", "fuel", pump), part("fuel_shutoff_valve", "fuel", shutoff),
            part("fuel_lines", "fuel", fuel_lines), part("fuel_reservoir_drain", "fuel", reservoir_drain),
            part("fuel_selector_drain", "fuel", selector_drain), part("fuel_strainer_drain", "fuel", strainer_drain)]
    tanks, senders = fuel_tanks(parts)
    fuel += [part("fuel_tanks", "fuel", tanks), part("fuel_quantity_senders", "fuel", senders)]
    wicks = part("static_wicks", "airframe", static_wicks(parts))
    oat = part("oat_probe", "pitot_static", oat_probe(parts))
    stall = part("stall_warning", "flight_controls", stall_warning(parts))
    units = [part(pid, "avionics", pieces) for pid, pieces in avionics(parts).items()]
    controls = [part(pid, "flight_controls", pieces) for pid, pieces in flight_controls(parts).items()]
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
            *(part(pid, "landing_gear", pieces) for pid, pieces in
              zip(("nose_gear_strut", "nose_gear_fittings", "shimmy_damper", "nose_steering_tubes"), nose_gear())),
            *(part(pid, "engine", pieces, ask=True) for pid, pieces in
              zip(("induction_air_filter", "induction_air_box", "induction_air_duct", "alternate_air_door"),
                  induction(parts))),
            part("oil_filler_cap", "powerplant", oil_filler_tube(parts)),
            part("power_junction_box", "engine", junction_box()),
            part("fuel_strainer", "fuel", strainer),
            part("standby_battery", "electrical", standby_battery()),
            part("brake_master_cylinders", "landing_gear", cylinders),
            part("brake_lines", "landing_gear", lines),
            part("fuel_sump_drains", "fuel", sump_drains(parts)),
            part("static_port", "pitot_static", static_port(parts)),
            *fuel, stall, wicks, oat, *units, *controls, *engine_parts]
