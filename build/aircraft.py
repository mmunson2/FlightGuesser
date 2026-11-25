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
    "airframe": ["fuselage", "left_wing", "right_wing", "horizontal_stabilizer", "vertical_stabilizer",
                 "doors", "baggage_door", "windows", "tie_down_rings"],
    "flight_controls": ["left_aileron", "right_aileron", "flaps", "elevator", "elevator_trim_tab", "rudder",
                        "control_wheels", "rudder_pedals", "elevator_trim_wheel", "elevator_trim_indicator",
                        "flap_switch"],
    "powerplant": ["propeller", "spinner", "cowling", "exhaust", "oil_access_door", "oil_filler_cap",
                   "throttle", "mixture", "ignition_switch"],
    "fuel": ["fuel_caps", "fuel_vent", "fuel_selector", "fuel_pump_switch"],
    "landing_gear": ["nose_wheel", "nose_gear_strut", "main_wheels", "main_gear_legs", "brakes",
                     "wheel_fairings", "parking_brake"],
    "lights": ["beacon", "left_nav_light", "right_nav_light", "tail_nav_light", "landing_light", "taxi_light",
               "beacon_switch", "landing_light_switch", "taxi_light_switch", "nav_light_switch",
               "strobe_switch", "panel_dimmers"],
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
    "cabin": ["heat_and_air"],
}
SYSTEM_OF = {pid: sys for sys, ids in SYSTEMS.items() for pid in ids}
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
# texture has another unit's layout (with YD, which a 172 lacks), so its
# keys are drawn as context.
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
        r"fuselage|Panel_0|Panel_1|gloveboxdoor|gloveboxlock|wing_center|wing_leading_edge_center|wing_1C":
            "fuselage",
        r"wing_left|wing_leading_edge_left|wing_1Ledge|wing_0": "left_wing",
        r"wing_right|wing_leading_edge_right|wing_1Redge": "right_wing",
        r"hstab": "horizontal_stabilizer",
        r"vstab\.001": "vertical_stabilizer",
        r"leftdoor|rightdoor|leftdoorhandle|rightdoorhandle": "doors",
        r"baggagedoorexterior|baggagedoorhandle": "baggage_door",
        r"glas|leftwindow|rightwindow": "windows",
        r"TieDown(Left|Right|Tail)": "tie_down_rings",
        r"leftaileron": "left_aileron",
        r"rightaileron": "right_aileron",
        r"flaps": "flaps",
        r"elevatorleft|elevatorright": "elevator",
        r"elevatortrim": "elevator_trim_tab",
        r"rudder_1": "rudder",
        r"Propeller": "propeller",
        r"Spinner": "spinner",
        r"fuselage_cowling|fuselage_cowling_top": "cowling",
        r"Exhaust": "exhaust",
        r"oildoor": "oil_access_door",
        r"OilCap": "oil_filler_cap",
        r"FuelCapPort|FuelCapStarboard|fuelportport|fuelportstarboard": "fuel_caps",
        r"fuelvent": "fuel_vent",
        r"NoseWheel": "nose_wheel",
        r"NoseWheelStrut|TopLink|BottomLink|Axle": "nose_gear_strut",
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
    }),
    (C172 + "Interior/Panel/c172sp-panel/c172sp-interior.ac", "ac", None, None, {
        r"Throttle-fg1000": "throttle",
        r"Mixture-fg1000": "mixture",
        r"ParkingBrake-fg1000": "parking_brake",
        r"CabinHeat-fg1000|CabinAir-fg1000": "heat_and_air",
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
        r".*_breaker-fg1000": "circuit_breakers",
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
    (GDU + "Model/GDU-104X.2.gltf", "gltf", (-0.357, 0.15, 0.05), (1, 0.9, 1), {**GDU_TABLE, r"Panel|Screen\d|Cover|Lamp\d|screw\..*": "mfd"}),
]
# Never drawn: click hot spots, view blockers, the blurred propeller disc,
# light cones and lit-state copies, inner copies of the glass, the compass
# deviation card (placed off the panel), rudder trim (not on a C172S), and
# the interior's own magneto switch (the magneto file's is used).
SKIP = re.compile(r".*[Hh]ot[Ss]pot.*|sun_and_view_blocker|panel_blocker|Propeller\.Fast|PropellerCowlPlugs"
                  r"|landinglight|taxilight|BeaconOffX|courtesyon-[lr]|dome_lighton_.*|radiator"
                  r"|glas_.*|.*window_interior|panel_1_glass|glass_pan.*|magsw|testlamp|click-S"
                  r"|RudderTrim.*|legend|Deviation-Card")


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


def _texture(c172p, ac_path, name, cache={}):
    """An .ac texture name -> its file (next to the .ac, else anywhere in
    the c172p data by file name), or None."""
    if not name:
        return None
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
    """-> (parts, unmatched) where parts is a list of dicts {id, system,
    kind, glass, ask, pieces} (one per part id, objects merged by texture;
    see piece()) and unmatched the object names drawn as context."""
    merged, unmatched = {}, []
    for rel, kind, offset, scale, table in SOURCES:
        path = Path(c172p) / rel
        # (name, corner positions, corner uvs or None, corner rgb, texture)
        objs = []
        if kind == "ac":
            mats, aobjs = ac3d.read(path)
            for o in aobjs:
                if not len(o.tris):
                    continue
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
        for name, c, uv, rgb, tex in objs:
            if SKIP.fullmatch(name) and not (name == "magsw" and "magneto" in rel):
                continue
            pid = next((p for rx, p in table.items() if re.fullmatch(rx, name)), None)
            if pid is None:
                unmatched.append(name)
                pid = "context"
            if pid == "windows":
                uv, tex, rgb = None, None, np.full_like(rgb, GLASS_RGB)
            merged.setdefault(pid, {}).setdefault(tex, []).append((c, uv, rgb))
    parts = []
    for pid, by_tex in merged.items():
        pieces = []
        for tex, chunks in by_tex.items():
            cuv = None if tex is None else np.vstack([u if u is not None else np.zeros((len(c), 3, 2))
                                                      for c, u, _ in chunks])
            pieces.append(piece(np.vstack([c for c, _, _ in chunks]), cuv, np.vstack([r for _, _, r in chunks]),
                                None if tex is None else str(tex)))
        parts.append({"id": pid, "system": SYSTEM_OF.get(pid, "cabin"),
                      "kind": "context" if pid == "context" else "target",
                      "glass": pid == "windows", "ask": SYSTEM_OF.get(pid) in ASK_SYSTEMS, "pieces": pieces})
    missing = set(SYSTEM_OF) - set(merged)
    if missing:
        raise SystemExit(f"parts with no objects: {sorted(missing)}")
    return parts, unmatched


if __name__ == "__main__":
    import sys
    parts, unmatched = load(sys.argv[1])
    for p in sorted(parts, key=lambda p: p["system"]):
        v = np.vstack([q["verts"] for q in p["pieces"]])
        lo, hi = v.min(0), v.max(0)
        texs = ",".join(Path(q["tex"]).stem if q["tex"] else "-" for q in p["pieces"])
        print(f"{p['system']:16} {p['id']:28} {len(v):6} verts  {np.round(lo, 2)} {np.round(hi, 2)}  {texs}")
    print("context:", " ".join(sorted(set(unmatched))))
