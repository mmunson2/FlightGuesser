"""The Cessna 172S with the G1000: FlightGear's c172p model (exterior, the
C172SP interior and panel, and the FG1000 GDU displays) as quiz parts.

Each source file's objects are matched by name (`TABLE`) to a part id; a
part's system comes from `SYSTEMS`. Objects that match nothing are drawn as
context (seen, not asked about); `SKIP` drops hidden helpers, light cones,
duplicate glass and equipment a C172S with the G1000 doesn't have.

Frames: .ac files are y up, x aft, z left. Offsets in FlightGear's XML (and
the GDU glTF files) are in FlightGear's body frame: x aft, y right, z up.
The scene is y up with the nose towards +z and the left wing towards +x.
"""

import re
from pathlib import Path

import numpy as np

import ac3d
import gltf

# Part id -> system. Order sets the side panel's order of systems.
SYSTEMS = {
    "airframe": ["fuselage", "left_wing", "right_wing", "wing_struts", "horizontal_stabilizer", "vertical_stabilizer",
                 "doors", "baggage_door", "windows", "tie_down_rings"],
    "flight_controls": ["left_aileron", "right_aileron", "flaps", "elevator", "elevator_trim_tab", "rudder", "rudder_cables",
                        "control_wheels", "rudder_pedals", "elevator_trim_wheel", "elevator_trim_indicator",
                        "flap_switch"],
    "powerplant": ["propeller", "spinner", "cowling", "exhaust", "oil_access_door", "oil_filler_cap",
                   "throttle", "mixture", "ignition_switch"],
    "fuel": ["fuel_caps", "fuel_vent", "fuel_selector", "fuel_pump_switch"],
    "landing_gear": ["nose_wheel", "nose_gear_strut", "nose_gear_torque_links", "main_wheels", "main_gear_legs", "brakes",
                     "wheel_fairings", "parking_brake"],
    "lights": ["beacon", "left_nav_light", "right_nav_light", "tail_nav_light", "landing_light", "taxi_light",
               "beacon_switch", "landing_light_switch", "taxi_light_switch", "nav_light_switch",
               "strobe_switch", "panel_dimmers", "dome_lights", "courtesy_lights"],
    "antennas": ["com_antennas", "transponder_antenna", "marker_antenna", "elt_antenna", "nav_antenna",
                 "adf_antenna"],
    "pitot_static": ["pitot_tube", "pitot_heat_switch", "alternate_static_source"],
    "electrical": ["master_switch_bat", "master_switch_alt", "avionics_switch", "standby_battery_switch",
                   "cabin_power_switch", "circuit_breakers", "elt_remote_switch"],
    "instruments": ["standby_airspeed_indicator", "standby_attitude_indicator", "standby_altimeter",
                    "magnetic_compass", "hobbs_meter"],
    # Each G1000 key and knob is its own part: these are what the quiz asks
    # (ASK_SYSTEMS). Knobs and keys on both displays are one part each.
    "g1000": ["pfd", "mfd", "softkeys", "nav_frequency_knob", "nav_volume_knob", "nav_transfer_key",
              "com_frequency_knob", "com_volume_knob", "com_transfer_key", "hdg_knob", "alt_knob",
              "crs_baro_knob", "fms_knob", "range_knob", "direct_to_key", "fpl_key", "clr_key", "ent_key",
              "menu_key", "proc_key"],
    "autopilot": ["ap_key", "fd_key", "hdg_key", "alt_key", "nav_key", "vnv_key", "apr_key", "bc_key",
                  "vs_key", "flc_key", "nose_up_key", "nose_dn_key"],
    "audio_panel": ["com1_mic_key", "com2_mic_key", "com3_mic_key", "com1_key", "com2_key", "com3_key",
                    "com12_key", "pa_key", "tel_key", "spkr_key", "mkr_mute_key", "hi_sens_key", "dme_key",
                    "adf_key", "nav1_key", "nav2_key", "aux_key", "man_sq_key", "play_key", "pilot_key",
                    "coplt_key", "audio_volume_knob"],
    "cabin": ["heat_and_air", "instrument_panel", "pedestal", "front_seats", "rear_seat", "cabin_floor",
              "cabin_interior", "sun_visors", "cabin_air_vents", "overhead_console", "hand_microphone"],
}
SYSTEM_OF = {pid: sys for sys, ids in SYSTEMS.items() for pid in ids}

# Objects that hold several parts, split by triangle: object name -> [(part,
# test on its (m,3,3) scene-space corners)]; the rest keeps the name's part
# (part None drops the triangles).
# FlightGear's fuselage carries the wing struts and their fairings (every
# triangle reaching past 0.6 m from the centreline; the cabin is ~1.1 m
# wide). Its centre wing pieces span both wings and the cabin roof: what's
# outboard of the cabin (0.55 m) is the wing on that side.
def _outboard(c, side, w=0.55):
    return side * c[:, :, 0].mean(1) > w


def _inlet_photo(c):
    """The forward-facing faces just inside the cooling inlets, which carry
    a photo of an engine (the model now has one)."""
    cen = c.mean(1)
    n = np.cross(c[:, 1] - c[:, 0], c[:, 2] - c[:, 0])
    n /= np.linalg.norm(n, axis=1)[:, None] + 1e-12
    return ((np.abs(cen[:, 0]) > 0.12) & (np.abs(cen[:, 0]) < 0.45) & (cen[:, 1] > -0.17) & (cen[:, 1] < 0.06)
            & (cen[:, 2] > 1.5) & (cen[:, 2] < 1.6) & (np.abs(n[:, 2]) > 0.6))


def _window_fan(c):
    """The door window frames are a strip plus a fan of large triangles from
    one corner that fills the window with paint: drop the fan (every
    triangle using the most shared corner)."""
    key = np.round(c.reshape(-1, 3), 4)
    pts, counts = np.unique(key, axis=0, return_counts=True)
    hub = pts[counts.argmax()]
    return (np.abs(np.round(c, 4) - hub).max(2) < 1e-6).any(1)


# Faces of an object that lie on another object's faces (same plane) z-fight:
# object -> the objects whose faces win. One wholly on the winners' faces is
# dropped; one only partly on them goes to a piece drawn `behind` (the
# viewer gives it a depth offset), since dropping it would leave a hole.
# FlightGear's centre wing repeats the retracted flaps' surfaces (it
# animates the flaps away), its own and the leading edge's faces, and a few
# of the fuselage's at the root.
COPLANAR_DROP = {"wing_center": ["wing_center", "flaps", "fuselage", "wing_leading_edge_center",
                                 "wing_1Ledge", "wing_1Redge", "wing_left", "wing_right"],
                 "wing_left": ["flaps", "leftaileron"], "wing_right": ["flaps", "rightaileron"],
                 "wing_leading_edge_center": ["wing_leading_edge_center", "wing_center"],
                 "wing_1Ledge": ["wing_leading_edge_center"], "wing_1Redge": ["wing_leading_edge_center"],
                 "elevatorleft": ["elevatorleft"], "elevatorright": ["elevatorright"], "rudder_1": ["rudder_1"]}
# The same between parts that can be hidden apart (a surface and the fixed
# part it tucks under): every overlapping face goes `behind`, none dropped,
# so hiding either part leaves no hole in the other. The stabilizer's skin
# runs back over the elevator: the elevator's ribbed skin wins there.
COPLANAR_UNDER = {"hstab": ["elevatorleft", "elevatorright"], "elevatorright": ["elevatortrim"],
                  "rudder_1": ["vstab.001"], "ruddercableports": ["ruddercableportshole"]}


# Objects whose polygons double back on themselves, which no triangulation
# of them as written draws right: (file, object) -> the object's vertex
# indices as one outline, holes bridged in. The flap indicator's frame is a
# rectangle with an L-shaped window (the lever's slot and the placard);
# as written it covered the scale with a black triangle.
OUTLINES = {("Flaps/flaps.ac", "rect"): [0, 1, 2, 4, 5, 7, 9, 11, 13, 4, 2, 3]}


def redraw_outline(o, ring):
    """Replace an ac3d.Obj's triangles with the polygon `ring` (vertex
    indices) ear-clipped, keeping each vertex's uv and the material."""
    uv_of = {}
    for t, uv in zip(o.tris, o.uvs):
        for v, c in zip(t, uv):
            uv_of.setdefault(int(v), tuple(c))
    tris = [[ring[k] for k in t] for t in ac3d.triangulate(o.verts[ring])]
    o.tris = np.array(tris, dtype=np.int64)
    o.uvs = np.array([[uv_of[v] for v in t] for t in tris])
    o.mats = [o.mats[0]] * len(tris)


def coplanar_holding(a, b, tol=0.003):
    """Mask of triangles in a that hold, in their plane, any sample point
    (centroid, corners pulled 2% in) of a coplanar triangle of b."""
    nb = np.cross(b[:, 1] - b[:, 0], b[:, 2] - b[:, 0])
    nb /= np.linalg.norm(nb, axis=1)[:, None] + 1e-12
    cb = b.mean(1)
    pts = np.concatenate([cb] + [cb + 0.98 * (b[:, j] - cb) for j in range(3)])
    npts = np.concatenate([nb] * 4)
    out = np.zeros(len(a), bool)
    for k, (p0, p1, p2) in enumerate(a):
        n = np.cross(p1 - p0, p2 - p0)
        if np.linalg.norm(n) < 1e-12:
            continue
        n /= np.linalg.norm(n)
        v2 = pts - p0
        near = (np.abs(v2 @ n) < tol) & (np.abs(npts @ n) > 0.995)
        if not near.any():
            continue
        v0, v1 = p2 - p0, p1 - p0
        d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-14:
            continue
        d20, d21 = v2[near] @ v0, v2[near] @ v1
        v = (d11 * d20 - d01 * d21) / den
        w = (d00 * d21 - d01 * d20) / den
        out[k] = ((v >= -1e-4) & (w >= -1e-4) & (v + w <= 1 + 1e-4)).any()
    return out


def coplanar_inside(a, b, same=False, tol=0.003, whole=True):
    """Mask of triangles in a (m,3,3) lying wholly on triangles of b in the
    same plane: the centroid and each corner (pulled 2% towards it) on some
    coplanar triangle of b. With same (b is a), only earlier ones count, so
    one of a duplicate pair stays."""
    na = np.cross(a[:, 1] - a[:, 0], a[:, 2] - a[:, 0])
    na /= np.linalg.norm(na, axis=1)[:, None] + 1e-12
    nb = np.cross(b[:, 1] - b[:, 0], b[:, 2] - b[:, 0])
    nb /= np.linalg.norm(nb, axis=1)[:, None] + 1e-12
    v0, v1 = b[:, 2] - b[:, 0], b[:, 1] - b[:, 0]
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    den = d00 * d11 - d01 * d01
    ok_b = np.abs(den) > 1e-14

    def on(p, near):
        v2 = p - b[:, 0]
        near = near & (np.abs((v2 * nb).sum(1)) < tol)
        if not near.any():
            return False
        d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
        with np.errstate(divide="ignore", invalid="ignore"):
            v = (d11 * d20 - d01 * d21) / den
            w = (d00 * d21 - d01 * d20) / den
        return bool((near & (v >= -1e-4) & (w >= -1e-4) & (v + w <= 1 + 1e-4)).any())
    out = np.zeros(len(a), bool)
    for k, tri in enumerate(a):
        near = ok_b & (np.abs((nb * na[k]).sum(1)) > 0.995)
        if same:
            near[k:] = False
        c = tri.mean(0)
        pts = (c, *(c + 0.98 * (tri - c)))
        if whole == "any":
            out[k] = any(on(p, near) for p in pts)
        else:
            out[k] = all(on(p, near) for p in (pts if whole else (c,)))
    return out


# Circular holes cut in the wing skin over each fuel filler neck (FlightGear
# leaves one triangle open on the left and none on the right): object whose
# outline gives the hole -> parts whose upper skin is cut.
HOLES = {r"fuelport(port|starboard)": ("left_wing", "right_wing", "fuselage")}
CUT_HOLES = []                       # (x, z, radius, y_min) of the holes cut by the last load(), for extras.py
HOLE_SIDES = 48                      # the hole is a regular polygon this fine
HOLE_WIDEN = 0.02                    # m added to the filler neck's diameter


def _clip(poly, a, b, keep_left):
    """Sutherland-Hodgman: the part of a convex polygon (rows: x, y, z, then
    uv and colour, interpolated) left (or right) of the line a->b in x, z."""
    def side(p):
        return (b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    out = []
    for k in range(len(poly)):
        p, q = poly[k], poly[(k + 1) % len(poly)]
        sp, sq = side(p), side(q)
        if not keep_left:
            sp, sq = -sp, -sq
        if sp >= 0:
            out.append(p)
        if (sp >= 0) != (sq >= 0):
            out.append(p + (q - p) * (sp / (sp - sq)))
    return out


def hole_collar(skin, centre, r, y_min, outer=0.06, n=48, rings=4):
    """An annulus from the hole's edge out to `outer`, lying on the upper
    skin (drawn `behind`, so the skin wins where it exists): it fills
    FlightGear's missing triangle beside the left filler. -> corner arrays."""
    cx, cz = centre
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    radii = np.linspace(r, outer, rings + 1)
    grid = np.zeros((rings + 1, n, 3))
    for i, rr in enumerate(radii):
        for k, t in enumerate(a):
            x, z = cx + rr * np.cos(t), cz + rr * np.sin(t)
            h = hits(skin, x, z)
            h = h[h > y_min]
            grid[i, k] = (x, h.max() - COLLAR_DROP if len(h) else np.nan, z)
    # Where the skin is missing, take the height across the ring.
    for i in range(rings + 1):
        y = grid[i, :, 1]
        if np.isnan(y).all():
            y[:] = np.nanmean(grid[:, :, 1])
        bad = np.isnan(y)
        y[bad] = np.interp(np.where(bad)[0], np.where(~bad)[0], y[~bad], period=n)
    tris = []
    for i in range(rings):
        for k in range(n):
            p, q = grid[i, k], grid[i, (k + 1) % n]
            P, Q = grid[i + 1, k], grid[i + 1, (k + 1) % n]
            tris += [(p, P, Q), (p, Q, q)]
    return np.array(tris)


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


SKIN_RGB = (0.93, 0.93, 0.93)
COLLAR_DROP = 0.0                   # m under the skin (level: the `behind` offset keeps the skin in front)


def cut_hole(c, uv, rgb, centre, r, y_min):
    """Cuts a round hole (a HOLE_SIDES polygon of radius r round centre x,
    z, seen from above) out of the triangles above y_min: each triangle that
    crosses it is clipped edge by edge, the pieces outside fanned into
    triangles, uvs and colours interpolated."""
    if not len(c):
        return c, uv, rgb
    cx, cz = centre
    t = np.linspace(0, 2 * np.pi, HOLE_SIDES, endpoint=False)
    ring = np.column_stack([cx + r * np.cos(t), cz + r * np.sin(t)])      # counter-clockwise in x, z
    p = c[:, :, [0, 2]] - (cx, cz)
    q = np.roll(p, -1, 1)
    e = q - p
    s = np.clip(-(p * e).sum(2) / np.maximum((e * e).sum(2), 1e-18), 0, 1)
    edge = np.linalg.norm(p + s[..., None] * e, axis=2).min(1)
    cross = p[:, :, 0] * q[:, :, 1] - p[:, :, 1] * q[:, :, 0]
    centre_in = (cross >= 0).all(1) | (cross <= 0).all(1)
    hit = (c[:, :, 1].min(1) > y_min) & ((edge < r) | centre_in)
    if not hit.any():
        return c, uv, rgb
    keep_c, keep_uv, keep_rgb = [c[~hit]], [None if uv is None else uv[~hit]], [rgb[~hit]]
    nu = 0 if uv is None else 2
    for k in np.where(hit)[0]:
        rows = [np.concatenate([c[k][j], uv[k][j] if nu else [], rgb[k][j]]) for j in range(3)]
        rest, pieces = rows, []
        for j in range(HOLE_SIDES):
            a, b = ring[j], ring[(j + 1) % HOLE_SIDES]
            outside = _clip(rest, a, b, keep_left=False)
            if len(outside) >= 3:
                pieces.append(outside)
            rest = _clip(rest, a, b, keep_left=True)
            if len(rest) < 3:
                break
        for poly in pieces:
            poly = np.array(poly)
            fan = np.array([[poly[0], poly[i], poly[i + 1]] for i in range(1, len(poly) - 1)])
            if not len(fan):
                continue
            keep_c.append(fan[:, :, :3])
            keep_uv.append(fan[:, :, 3:3 + nu] if nu else None)
            keep_rgb.append(fan[:, :, 3 + nu:])
    return (np.concatenate(keep_c), None if uv is None else np.concatenate(keep_uv),
            np.concatenate(keep_rgb))


# Upward faces whose material colour is replaced: the viewer's sky and sun
# light clips the elevator's pale top to plain white, hiding the ribbed
# metal its texture shares with its underside. A darker colour keeps it
# under the clip.
TOP_RGB = {name: (0.5, 0.5, 0.5) for name in ("elevatorleft", "elevatorright", "elevatortrim")}


def _top_rgb(name, c, rgb):
    if name not in TOP_RGB:
        return rgb
    n = np.cross(c[:, 1] - c[:, 0], c[:, 2] - c[:, 0])
    up = n[:, 1] / (np.linalg.norm(n, axis=1) + 1e-12) > 0.3
    rgb = rgb.copy()
    rgb[up] = TOP_RGB[name]
    return rgb


SPLIT_OBJECTS = {
    **{name: [(None, _window_fan)] for name in ("windowframeleftext", "windowframerightext",
                                                "windowframeleftint-fg1000", "windowframerightint-fg1000")},
    "fuselage": [(None, _inlet_photo), ("wing_struts", lambda c: np.abs(c[:, :, 0]).max(1) > 0.6)],
    **{name: [("left_wing", lambda c: _outboard(c, 1)), ("right_wing", lambda c: _outboard(c, -1))]
       for name in ("wing_center", "wing_leading_edge_center")},
}
# Systems whose parts the "name it" quiz asks: the rest of the airplane is
# there to explore, too obvious to a student pilot to drill.
ASK_SYSTEMS = {"g1000", "autopilot", "audio_panel"}
# Organs-style groups: a group id answers a question like a part.
GROUPS = {
    "ailerons": ["left_aileron", "right_aileron"],
    "wings": ["left_wing", "right_wing"],
    "nav_lights": ["left_nav_light", "right_nav_light", "tail_nav_light"],
    "master_switch": ["master_switch_bat", "master_switch_alt"],
    "empennage": ["horizontal_stabilizer", "vertical_stabilizer", "elevator", "elevator_trim_tab", "rudder"],
}

C172 = "repo/Models/"
GDU = "fgdata/GDU104X/"
# (source file under <c172p_dir>, kind, FlightGear offset (x aft, y right,
# z up) in metres, glTF scale in FlightGear axes, {object regex: part id}).
# The GDU knobs and keys are the same on the PFD and the MFD, so each
# names both.
GDU_TABLE = {
    r"SoftKey\..*": "softkeys",
    r"Nav(Inner|Outer)": "nav_frequency_knob",
    r"VolNAV": "nav_volume_knob",
    r"AsSwitchNav": "nav_transfer_key",
    r"Com(Inner|Outer)": "com_frequency_knob",
    r"VolCom": "com_volume_knob",
    r"AsSwitchCOM": "com_transfer_key",
    r"HDG": "hdg_knob",
    r"Alt(Inner|Outer)": "alt_knob",
    r"CRS|BARO": "crs_baro_knob",
    r"Fms(Inner|Outer)": "fms_knob",
    r"PAN.*": "range_knob",
    r"DidectTo": "direct_to_key",
    r"FPL": "fpl_key",
    r"CLR": "clr_key",
    r"ENT": "ent_key",
    r"MENU": "menu_key",
    r"PROC": "proc_key",
}
# The autopilot (GFC 700) keys, read from the PFD bezel's texture
# (GDU-1044B.png; `tools/labels.py OUT gdu1 'AP\..*'`): left column AP,
# HDG, NAV, APR, VS, FLC; right FD, ALT, VNV, BC, NOSE UP, NOSE DN. The MFD's
# copies of those keys are part of the `mfd` (clicking one names the MFD).
PFD_AP_KEYS = {
    r"AP\.L0": "ap_key", r"AP\.L1": "hdg_key", r"AP\.L2": "nav_key", r"AP\.L3": "apr_key",
    r"AP\.L4": "vs_key", r"AP\.L5": "flc_key", r"AP\.R0": "fd_key", r"AP\.R1": "alt_key",
    r"AP\.R2": "vnv_key", r"AP\.R3": "bc_key", r"AP\.R4": "nose_up_key", r"AP\.R5": "nose_dn_key",
}
# The GMA 1347 audio panel keys in c172sp-interior.ac, read from
# panel-fg1000.png (`tools/labels.py OUT interior 'AP\.[LR]\d+'`). Each
# key's annunciator (AP.L0.0 and so on) goes with it.
AUDIO_KEYS = {
    "L0": "com1_mic_key", "L1": "com2_mic_key", "L2": "com3_mic_key", "L3": "com12_key", "L4": "pa_key",
    "L5": "mkr_mute_key", "L6": "dme_key", "L7": "adf_key", "L8": "aux_key", "L9": "man_sq_key",
    "L10": "pilot_key", "R0": "com1_key", "R1": "com2_key", "R2": "com3_key", "R3": "tel_key",
    "R4": "spkr_key", "R5": "hi_sens_key", "R6": "nav1_key", "R7": "nav2_key", "R8": "play_key",
    "R9": "coplt_key",
}
SOURCES = [
    (C172 + "c172-common.ac", "ac", None, None, {
        r"fuselage|wing_center|wing_leading_edge_center|wing_1C"
        r"|airvent|airventhole|vent|venthole|handle|windowframe(left|right)ext":
            "fuselage",
        r"wing_left|wing_leading_edge_left|wing_1Ledge|wing_0": "left_wing",
        r"wing_right|wing_leading_edge_right|wing_1Redge": "right_wing",
        r"hstab": "horizontal_stabilizer",
        r"vstab\.001": "vertical_stabilizer",
        r"leftdoor|rightdoor|leftdoorhandle|rightdoorhandle|charniere[34]": "doors",
        r"baggagedoorexterior|baggagedoorhandle": "baggage_door",
        r"glas|leftwindow|rightwindow": "windows",
        r"TieDown(Left|Right|Tail)": "tie_down_rings",
        r"leftaileron": "left_aileron",
        r"rightaileron": "right_aileron",
        r"flaps": "flaps",
        r"elevatorleft|elevatorright": "elevator",
        r"elevatortrim": "elevator_trim_tab",
        r"rudder_1": "rudder",
        r"ruddercable.*": "rudder_cables",
        r"Propeller": "propeller",
        r"Spinner": "spinner",
        r"fuselage_cowling|fuselage_cowling_top|oilcompartment(hole)?|radi_box": "cowling",
        r"Exhaust|fuselageexhausthole": "exhaust",
        r"oildoor": "oil_access_door",
        r"OilCap": "oil_filler_cap",
        r"FuelCapPort|FuelCapStarboard|fuelportport|fuelportstarboard|fuelportstar(board|port)hole"
        r"|fuelcompartment": "fuel_caps",
        r"fuelvent": "fuel_vent",
        r"NoseWheel": "nose_wheel",
        r"NoseWheelStrut|Axle": "nose_gear_strut",
        r"TopLink|BottomLink": "nose_gear_torque_links",
        r"LeftWheel|RightWheel": "main_wheels",
        r"LeftWheelStrut|RightWheelStrut": "main_gear_legs",
        r"LeftWheelBrake|RightWheelBrake": "brakes",
        r"fairing[123]": "wheel_fairings",
        r"Beacon|BeaconMount|BeaconOff": "beacon",
        r"LeftNavLight": "left_nav_light",
        r"RightNavLight": "right_nav_light",
        r"RearNavLight": "tail_nav_light",
        r"lightlanding|landinglightcover": "landing_light",
        r"lighttaxi": "taxi_light",
        r"VHFAntenna": "com_antennas",
        r"TransponderAntenna": "transponder_antenna",
        r"MarkerAntenna": "marker_antenna",
        r"ELTAntenna": "elt_antenna",
        r"Antenna_VOR": "nav_antenna",
        r"Antenna_ADF": "adf_antenna",
        r"PitotTube": "pitot_tube",
        r"Panel_0|Panel_1|gloveboxdoor|gloveboxlock": "instrument_panel",   # with the glareshield
        r"SeatMounts\.[01]": "front_seats",
        r"SeatMounts\.2": "rear_seat",
        r"carpethole": "cabin_floor",
        r"wingventhole": "cabin_air_vents",
        r"courtesyoff": "courtesy_lights",
    }),
    (C172 + "Interior/Panel/c172sp-panel/c172sp-interior.ac", "ac", None, None, {
        r"Throttle(Mount)?-fg1000": "throttle",
        r"Mixture(Mount)?-fg1000": "mixture",
        r"ParkingBrake-fg1000": "parking_brake",
        r"CabinHeat-fg1000|CabinAir-fg1000|CabinAirMounts-fg1000": "heat_and_air",
        r"TrimWheel-fg1000": "elevator_trim_wheel",
        r"ElevatorTrimPos-fg1000": "elevator_trim_indicator",
        r"FuelSelector(Face|Panel|Both|Left|Right|Off)-fg1000": "fuel_selector",
        r"MasterSwitch-fg1000": "master_switch_bat",
        r"GenSwitch-fg1000": "master_switch_alt",
        r"AvionicsSwitch2?-fg1000": "avionics_switch",
        r"toggle-beacon": "beacon_switch",
        r"toggle-land": "landing_light_switch",
        r"toggle-taxi": "taxi_light_switch",
        r"toggle-nav": "nav_light_switch",
        r"toggle-strobe": "strobe_switch",
        r"toggle-pitot": "pitot_heat_switch",
        r"toggle-fuel": "fuel_pump_switch",
        r"toggle-stbybatt": "standby_battery_switch",
        r"toggle-cabin-pwr": "cabin_power_switch",
        r".*_breaker-fg1000|BreakersBase-fg1000": "circuit_breakers",
        # panel_1_glass is the panel's face around the instruments (FlightGear
        # gives it the interior panel lightmap), not glass.
        r"Panel|panel|panel_1_1-fg1000|panel_1_glass|bolts-fg1000|switchbase|togglebase": "instrument_panel",
        r"Pedestal-fg1000": "pedestal",
        r"pilotseat_(left|right)-fg1000": "front_seats",
        r"backseat_left-fg1000": "rear_seat",
        r"carpet-fg1000": "cabin_floor",
        r"chassis-fg1000|wing_1[LR]-fg1000|LeftBag-fg1000": "cabin_interior",
        r"Firewall-fg1000": "firewall",          # its cabin side; extras.py adds the engine side
        r"visor.*-fg1000": "sun_visors",
        r"AirVent_(left|right)-fg1000": "cabin_air_vents",
        r"dome_light_(pilot|copilot)|knob[LR]|panel-dome": "dome_lights",
        r"CeilingSpeakerFG1000": "overhead_console",
        r"mike(_chord|_mount)?-fg1000": "hand_microphone",
        r"doorint_(left|right)-fg1000|doorhandleint_(left|right)-fg1000|doorintstrap(left|right)-fg1000"
        r"|windlocket(bak)?_(left|right)-fg1000|windowframe(left|right)int-fg1000": "doors",
        r"baggagedoorinterior-fg1000": "baggage_door",
        r"AltStaticAir-fg1000": "alternate_static_source",
        r"knob-(stbyind|swcb|pedestal|avionics)": "panel_dimmers",
        **{rf"AP\.{k}(\.\d+)?": v for k, v in AUDIO_KEYS.items()},
        r"AltInner|AltOuter|VolNAV": "audio_volume_knob",
    }),
    (C172 + "Interior/Panel/Instruments/asi/asi-fg1000.ac", "ac", None, None, {r".*": "standby_airspeed_indicator"}),
    (C172 + "Interior/Panel/Instruments/AI/AI-fg1000.ac", "ac", None, None, {r".*": "standby_attitude_indicator"}),
    (C172 + "Interior/Panel/Instruments/alt/alt-fg1000.ac", "ac", None, None, {r".*": "standby_altimeter"}),
    (C172 + "Interior/Panel/Instruments/mag-compass/mag-compass.ac", "ac", None, None,
     {r".*": "magnetic_compass"}),
    (C172 + "Interior/Panel/Instruments/hobbs/hobbs-fg1000.ac", "ac", None, None, {r".*": "hobbs_meter"}),
    (C172 + "Interior/Panel/Instruments/magneto-switch/magneto-switch-fg1000.ac", "ac", None, None,
     {r"magsw|key|start": "ignition_switch"}),
    (C172 + "Interior/FE-ELT/elt-fg1000.ac", "ac", None, None, {r".*": "elt_remote_switch"}),
    (C172 + "Interior/Panel/Flaps/flaps.ac", "ac", None, None, {r".*": "flap_switch"}),
    (C172 + "Interior/Yoke/yoke-fg1000.ac", "ac", None, None, {r".*Yoke.*": "control_wheels"}),
    (C172 + "Interior/Pedals/pedals.ac", "ac", (-0.56, -0.24, -0.61), None, {r".*": "rudder_pedals"}),
    (C172 + "Interior/Pedals/pedals.ac", "ac", (-0.56, 0.24, -0.61), None, {r".*": "rudder_pedals"}),
    (GDU + "Model/GDU-104X.1.gltf", "gltf", (-0.357, -0.2, 0.05), (1, 0.9, 1), {**GDU_TABLE, **PFD_AP_KEYS, r"Panel|Screen\d|Cover|Lamp\d|screw\..*": "pfd"}),
    (GDU + "Model/GDU-104X.2.gltf", "gltf", (-0.357, 0.15, 0.05), (1, 0.9, 1),
     {**GDU_TABLE, r"Panel|Screen\d|Cover|Lamp\d|screw\..*|AP\..*": "mfd"}),
]
# Never drawn: click hot spots, view blockers, the blurred propeller disc,
# light cones and lit-state copies, inner copies of the glass, the compass
# deviation card (placed off the panel), rudder trim (not on a C172S), and
# the interior's own magneto switch (the magneto file's is used).
# Objects that move in Operate mode, kept in a piece of their own so the
# viewer can find them: (file, object) -> the piece's `moves` name. The
# ignition key turns (js/g1000-switches.js); the switch's face stays. The
# throttle, mixture and the cabin heat and air knobs slide in and out of
# their mounts (heat and air share a part, so each is a piece).
MOVING = {("magneto-switch/magneto-switch-fg1000.ac", r"key|start"): "key",
          ("c172sp-panel/c172sp-interior.ac", r"Throttle-fg1000|Mixture-fg1000"): "lever",
          ("c172sp-panel/c172sp-interior.ac", r"CabinHeat-fg1000"): "heat",
          ("c172sp-panel/c172sp-interior.ac", r"CabinAir-fg1000"): "air"}

# Skipped in one file only: the magnetic compass's glass (an opaque sheet
# here; js/g1000-panel.js draws the live card in its window).
SKIP_IN = {"mag-compass/mag-compass.ac": r"Glass"}
SKIP = re.compile(r".*[Hh]ot[Ss]pot.*|sun_and_view_blocker|panel_blocker|Propeller\.Fast|PropellerCowlPlugs"
                  r"|landinglight|taxilight|BeaconOffX|courtesyon-[lr]|dome_lighton_.*|radiator"
                  r"|glas_.*|.*window_interior|glass_pan.*|magsw|testlamp|click-S"
                  r"|RudderTrim.*|Deviation-Card")


def ac_to_scene(v):
    return np.column_stack([v[:, 2], v[:, 1], -v[:, 0]])


def fg_to_scene(v):
    return np.column_stack([-v[:, 1], v[:, 2], -v[:, 0]])


# The G1000 bezels' texture (the glTFs name a generic FG1000.png): the
# GDU 1044B's on both displays. fgdata's other bezel (GDU-104X.png) has a
# YD key, which the C172S's GFC 700 doesn't. Material 1 is the screen,
# drawn dark (the displays aren't simulated).
GDU_TEXTURES = {"GDU-104X.1.gltf": GDU + "Textures/GDU-1044B.png", "GDU-104X.2.gltf": GDU + "Textures/GDU-1044B.png"}
SCREEN_RGB = (0.04, 0.05, 0.06)
GLASS_RGB = (0.75, 0.85, 0.95)


# Textures replaced by our own edits (tools/placards.py), by the .ac's
# texture name: the flap indicator without the 172P's AVOID SLIPS WITH
# FLAPS EXTENDED placard (FlightGear's model is a 172P fitted as a 172S).
TEXTURE_OVERRIDES = {"flaps.png": Path(__file__).resolve().parent / "placards" / "flaps.png"}


def _texture(c172p, ac_path, name, cache={}):
    """An .ac texture name -> its file (TEXTURE_OVERRIDES, next to the .ac,
    else anywhere in the c172p data by file name), or None."""
    if not name:
        return None
    if Path(name).name in TEXTURE_OVERRIDES:
        return TEXTURE_OVERRIDES[Path(name).name]
    here = ac_path.parent / name
    if here.is_file():
        return here
    if c172p not in cache:
        cache[c172p] = {}
        for f in sorted(Path(c172p).rglob("*.png")):
            cache[c172p].setdefault(f.name, f)
    return cache[c172p].get(Path(name).name)


def piece(cpos, cuv, crgb, tex):
    """Triangle corners (m,3,3) positions, (m,3,2) uvs or None, (m,3,3)
    colours -> {tex, verts, tris, uv, rgb}, corners welded where all three
    agree."""
    m = len(cpos)
    pos = cpos.reshape(-1, 3)
    uv = None if cuv is None else cuv.reshape(-1, 2)
    rgb = crgb.reshape(-1, 3)
    key = [np.round(pos, 5), np.round(rgb, 3)] + ([] if uv is None else [np.round(uv, 5)])
    _, first, inv = np.unique(np.hstack(key), axis=0, return_index=True, return_inverse=True)
    order = np.argsort(first)           # keep first-seen order: deterministic
    rank = np.empty_like(order)
    rank[order] = np.arange(len(order))
    keep = first[order]
    return {"tex": tex, "verts": pos[keep], "tris": rank[inv.ravel()].reshape(m, 3),
            "uv": None if uv is None else uv[keep], "rgb": rgb[keep]}


def load(c172p):
    """-> parts: a list of dicts {id, system,
    kind, glass, ask, pieces} (one per part id, objects merged by texture;
    see piece()). Every drawn object must match a part (or SKIP)."""
    merged, unmatched, holes = {}, [], []
    for rel, kind, offset, scale, table in SOURCES:
        path = Path(c172p) / rel
        # (name, corner positions, corner uvs or None, corner rgb, texture)
        objs = []
        if kind == "ac":
            mats, aobjs = ac3d.read(path)
            for o in aobjs:
                if not len(o.tris):
                    continue
                ring = next((r for (f, n), r in OUTLINES.items() if rel.endswith(f) and n == o.name), None)
                if ring is not None:
                    redraw_outline(o, ring)
                rgb = np.array([mats[i].rgb if i < len(mats) else (0.7, 0.7, 0.7) for i in o.mats], dtype=np.float64)
                tex = _texture(c172p, path, o.texture)
                uvs = o.uvs if tex is not None and o.uvs is not None and len(o.uvs) == len(o.tris) else None
                objs.append((o.name, ac_to_scene(o.verts)[o.tris], uvs, np.repeat(rgb[:, None, :], 3, 1), tex))
        else:
            bezel = Path(c172p) / GDU_TEXTURES[Path(rel).name]
            for name, v, f, uv, mat in gltf.load(path, uvs=True, materials=True):
                v = fg_to_scene(v * np.array(scale))
                screen = mat == 1
                cuv = None if uv is None or screen else np.stack([uv[:, 0], 1 - uv[:, 1]], 1)[f]
                rgb = np.full((len(f), 3, 3), SCREEN_RGB if screen else 1.0)
                objs.append((name, v[f], cuv, rgb, None if cuv is None else bezel))
        if offset is not None:
            shift = fg_to_scene(np.array([offset], dtype=np.float64))[0]
            objs = [(name, c + shift, uv, rgb, tex) for name, c, uv, rgb, tex in objs]
        objs = [(name, c, uv, _top_rgb(name, c, rgb), tex) for name, c, uv, rgb, tex in objs]
        corners = {name: c for name, c, *_ in objs}
        for name, c in corners.items():
            for rx, pids in HOLES.items():
                if re.fullmatch(rx, name):
                    lo, hi = c.reshape(-1, 3).min(0), c.reshape(-1, 3).max(0)
                    holes.append(((lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2, (hi[0] - lo[0] + HOLE_WIDEN) / 2, lo[1], pids))
        layered = []                  # (name, corners, uvs, rgb, texture, behind)
        for name, c, uv, rgb, tex in objs:
            if name not in COPLANAR_DROP and name not in COPLANAR_UNDER:
                layered.append((name, c, uv, rgb, tex, False))
                continue
            drop, under = np.zeros(len(c), bool), np.zeros(len(c), bool)
            for other in COPLANAR_DROP.get(name, []):
                if other in corners:
                    drop |= coplanar_inside(c, corners[other], same=other == name)
                    under |= coplanar_inside(c, corners[other], same=other == name, whole=False)
            for other in COPLANAR_UNDER.get(name, []):
                if other in corners:
                    under |= coplanar_inside(c, corners[other], whole="any") | coplanar_holding(c, corners[other])
            under &= ~drop
            for m, behind in ((~drop & ~under, False), (under, True)):
                if m.any():
                    layered.append((name, c[m], None if uv is None else uv[m], rgb[m], tex, behind))
        split = []
        for name, c, uv, rgb, tex, behind in layered:
            rest = np.ones(len(c), bool)
            for pid, test in SPLIT_OBJECTS.get(name, []):
                m = rest & test(c)
                rest &= ~m
                if m.any() and pid:
                    merged.setdefault(pid, {}).setdefault((tex, behind, None), []).append(
                        (c[m], None if uv is None else uv[m], rgb[m]))
            split.append((name, c[rest], None if uv is None else uv[rest], rgb[rest], tex, behind))
        for name, c, uv, rgb, tex, behind in split:
            if (SKIP.fullmatch(name) and not (name == "magsw" and "magneto" in rel)
                    or any(rel.endswith(f) and re.fullmatch(rx, name) for f, rx in SKIP_IN.items())):
                continue
            pid = next((p for rx, p in table.items() if re.fullmatch(rx, name)), None)
            if pid is None:
                unmatched.append(name)
                continue
            if pid == "windows":
                uv, tex, rgb = None, None, np.full_like(rgb, GLASS_RGB)
            moves = next((m for (f, rx), m in MOVING.items() if rel.endswith(f) and re.fullmatch(rx, name)), None)
            merged.setdefault(pid, {}).setdefault((tex, behind, moves), []).append((c, uv, rgb))
    CUT_HOLES[:] = [(cx, cz, r, y_min) for cx, cz, r, y_min, _ in holes]
    for cx, cz, r, y_min, pids in holes:
        for pid in pids:
            by_key = merged.get(pid, {})
            skin = [c for chunks in by_key.values() for c, _, _ in chunks]
            if not skin:
                continue
            skin = np.concatenate(skin)
            near = np.hypot(skin.mean(1)[:, 0] - cx, skin.mean(1)[:, 2] - cz) < 1.5
            if not len(hits(skin[near], cx + r * 1.5, cz)):
                continue                      # this part has no skin here
            collar = hole_collar(skin[near], (cx, cz), r, y_min)
            by_key.setdefault((None, True, None), []).append((collar, None, np.full_like(collar, SKIN_RGB)))
            for key, chunks in by_key.items():
                for i, (c, uv, rgb) in enumerate(chunks):
                    chunks[i] = cut_hole(c, uv, rgb, (cx, cz), r, y_min)
    parts = []
    for pid, by_tex in merged.items():
        pieces = []
        for (tex, behind, moves), chunks in by_tex.items():
            cuv = None if tex is None else np.vstack([u if u is not None else np.zeros((len(c), 3, 2))
                                                      for c, u, _ in chunks])
            pieces.append(piece(np.vstack([c for c, _, _ in chunks]), cuv, np.vstack([r for _, _, r in chunks]),
                                None if tex is None else str(tex)))
            if behind:
                pieces[-1]["behind"] = True
            if moves:
                pieces[-1]["moves"] = moves
        parts.append({"id": pid, "system": SYSTEM_OF.get(pid, "cabin"),
                      "kind": "target",
                      "glass": pid == "windows", "ask": SYSTEM_OF.get(pid) in ASK_SYSTEMS, "pieces": pieces})
    missing = set(SYSTEM_OF) - set(merged)
    if missing:
        raise SystemExit(f"parts with no objects: {sorted(missing)}")
    # Context lets clicks through, so an unmatched object can't be picked:
    # give every drawn object a part (or SKIP it).
    if unmatched:
        raise SystemExit(f"objects with no part (add them to SOURCES or SKIP): {sorted(set(unmatched))}")
    return parts


if __name__ == "__main__":
    import sys
    parts = load(sys.argv[1])
    for p in sorted(parts, key=lambda p: p["system"]):
        v = np.vstack([q["verts"] for q in p["pieces"]])
        lo, hi = v.min(0), v.max(0)
        texs = ",".join(Path(q["tex"]).stem if q["tex"] else "-" for q in p["pieces"])
        print(f"{p['system']:16} {p['id']:28} {len(v):6} verts  {np.round(lo, 2)} {np.round(hi, 2)}  {texs}")
