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
- Engine mount (MM 71-20-00 Figs. 201, 202): a triangulated tube frame
  bolted to the firewall at four points, with a dynafocal cup and rubber
  shock mount at each of the engine's four mounts. The firewall points are
  estimates.
- Main battery (MM 24-30-00 Fig. 201; 24-00-00: "installed in the
  front-left side of the firewall", "below the power junction box"):
  tray, battery, cover, vent line; the power junction box directly above
  it at the firewall's outboard edge, with the external power receptacle.
- Standby battery (MM 24-30-10 Fig. 201): on a bracket behind the
  Primary Flight Display (POH arm 11.2).
- Exhaust (MM 78-10-00 Fig. 201): two risers from each side's cylinders
  into the ends of a transverse muffler under the engine, the heat shroud
  around it (cabin heat) with its inlet hose from the left front baffle,
  and the tailpipe into the c172p exhaust stack.
  It replaces the CAD engine's own exhaust.
- Brakes (MM 32-42-00 Fig. 201): a master cylinder on each of the pilot's
  rudder pedals, lines under the floor and out through the fuselage skin,
  down the aft edge of each main gear leg to the wheel cylinder.
- Fuel strainer (MM 28-20-00 Fig. 206; 12-10-00 service points): on the
  forward lower left of the firewall, its drain through the cowling.
- Fuel tank sump drains (MM 28-20-00 Fig. 202; 12-10-00: five per tank):
  under each wing within the bay.
- Static port (MM 34-11-00 Fig. 202; 12-10-00): on the left side of the
  fuselage ahead of the door.
- Fuel system under the floor (MM 28-20-00 Figs. 201, 204, 206; POH Fig.
  7-6): two supply lines from each tank's outlets at the bay's inboard
  rib, the forward one down the front door post (following its rake,
  `post_z`: from the front spar at the top to its foot) and the aft one down the
  rear door post and forward under the floor, to the selector valve under
  the pedestal; the reservoir under the copilot's footwell (access panels
  230BT/CT) with its drain and vent, the electric auxiliary fuel pump with
  its drain line, the shutoff valve by the copilot's pedals, and the line
  through the firewall to the strainer; the return line from the fuel
  servo to the reservoir with its check valve; the vent line across the
  cabin top.
- Stall warning (MM 27-32-00 Fig. 201: "the scoop assembly is installed on
  the leading edge of the left wing at WS 91"): the scoop, and the tube
  inside the wing to the reed horn in the wing root above the door post
  ("put the tube and stall warning horn into the wing through the upper
  door post shield"); nothing shows in the cabin.
- G1000 units (MM 23-10-00 Fig. 202 and 34-13-00 Fig. 201: "on the
  avionics shelf in the tailcone"; 77-40-00 Fig. 201; 34-22-00 Fig. 201):
  the two GIA 63 integrated avionics units and the GTX 33 transponder on
  edge, the tailcone fan in a plenum at the rack's left end, and the GRS
  77 AHRS and GDC 74A air data computer side by side aft of the rack, all
  above baggage area 2 at the POH Fig. 6-9 arms; the GEA 71
  engine/airframe unit forward of the panel under the MFD; the GMU 44
  magnetometer inside the left wing, reached through access plate 520HB
  underneath, at its POH arm. Unit sizes are estimates.
- Fuel tanks (MM 28-20-00: "a wet wing fuel storage system ... two integral
  fuel tanks (one in each wing)"; 12-14-01: each bay runs "from WS 31.38 to
  WS 65.125" between the front and rear spars (Fig. 202 detail A's WS
  23.62 and 71.62 mark the lower skin panel's ends); 28-21-00 Fig. 201):
  a block filling the wing between the skins there. The fuel level sender
  (Fig. 203: on a rib, its float arm in the bay) is on the bay's inboard
  rib; the rear spar's place is an estimate. The filler opening is cut
  through the bay's top, as through the wing skin (aircraft.CUT_HOLES).
- Static wicks (MM 23-60-00 Fig. 201: "on the trailing edges of the
  ailerons, rudder and the elevators"): two at the outboard end of each
  aileron and elevator half (the inner one well inboard on the elevator),
  and two on the rudder, one near its top and one low, pointing aft.
  Their length is an estimate.
- Outside air temperature probe (MM 34-12-00 Fig. 201: on the upper cabin
  roof line; POH Fig. 6-9: the G1000's GTP 59 at arm 41.5, where the MM's
  FS 46.46 is the older probe's): a short stem on the roof.
- Oil filler tube (POH 7: "located at the right rear of the engine case";
  MM 12-14-02 Fig. 301; Lycoming PC Fig. 14 "Oil Level Gage"): from the
  crankcase's right rear up to FlightGear's dipstick, sheathing it to just
  under the cap. Added to the `oil_filler_cap` part.
- Induction air (MM 71-60-00: "Ram air to the engine goes into the
  induction air box through the induction filter in the forward part of
  the lower engine cowl. From the induction air box, the air is pointed to
  the inlet of the fuel/air control unit"; Fig. 201): the filter in
  FlightGear's chin inlet (where its "radiator" plate was), the filter box
  behind it with the spring-loaded alternate air door on its aft wall
  beside the duct (Detail A),
  and the duct under the muffler to the induction air elbow, which turns
  up into the inlet adaptor under the fuel servo, with its drain line.
  Sizes are estimates.
- Nose gear mounting (MM 32-20-00 Fig. 202: "upper nose gear fitting";
  removal: "the bolt from the top of the strut", "the strut clamp with the
  bottom strut fitting on the firewall"): FlightGear's strut, moved aft to
  the POH's nose wheel arm (aircraft.GEAR_AFT), ends at the firewall. Its
  top goes into an upper fitting on the firewall, with the clamp and
  bottom fitting below it. The shimmy damper is on the strut's right side
  (Fig. 202, F and G), from the steering collar's arm up to a lug under
  the clamp. The two spring-loaded steering tubes run from the collar aft
  through the firewall to the rudder bars. Fitting and tube sizes and the
  bar ends are estimates.
- Belly fuel drains (POH 7, Fuel Drain Valves: "each wing tank sump, the
  fuel reservoir tank sump, the fuel selector valve drain and the fuel
  strainer sump"; POH 4: "Fuel Strainer Quick Drain Valve (located on
  bottom of fuselage)"; MM 12-10-00 Fig. 1: "fuel selector and fuel
  reservoir drains" on the belly just aft of the firewall): a line from
  the reservoir's sump, the selector valve and the strainer bowl down
  through the skin to a quick drain valve, each its own part.
- Flight control cables (MM 27-10-00 Fig. 201 ailerons, 27-20-00 Fig. 201
  rudder, 27-30-00 Fig. 201 elevator, 27-31-00 Fig. 201 trim): the
  control column (a U behind the panel whose arms drop from both yoke
  shafts to a cross tube with the aileron cable drum, then the stem to the
  floor); the aileron direct cables from the drum aft under the floor,
  outboard at the rear door posts (FS 65.33), up each post and out the
  wing's rear spar to the bellcrank on the bottom wing skin (Fig. 203),
  whose push rod reaches the aileron, and the carry-thru cable joining the
  two bellcranks across the cabin top; the elevator push-pull tube from
  the column to the forward bellcrank under the floor, the up and down
  cables aft along the belly and up the tailcone to the aft bellcrank on
  the elevators' hinge axis (Fig. 202); the rudder cables from arms near
  the rudder bars' inboard ends aft beside the centreline to FlightGear's
  stubs at the tail; the trim wheel's two chains, the cables aft, up to
  mid-height at the FS 178 bulkhead and across on horizontal pulleys to
  the actuator in the right stabilizer, and its push rod to the tab.
  Pulleys sit at the bulkheads each figure shows (the MM gives no pulley
  stations).
- Engine accessories (MM 79-20-00 Fig. 201: oil cooler "secured to rear of
  engine baffles", on the left; MM 80-10-00: starter "at the front
  (propeller end) lower left side of the engine"; MM 37-10-00 Fig. 201:
  vacuum pump on the accessory housing; Lycoming IPC PC-IO-360-L2A Fig. 20:
  spin-on oil filter pointing aft from the accessory housing).
- Behind the instrument panel (MM 34-60-10 Fig. 201, 23-50-00 Fig. 201,
  21-21-00 Fig. 202): the PFD's and MFD's GDU 1040 housings (11.80 x 7.70
  in bezel, 3.77 in deep with the connector, from Garmin part listings;
  POH arm 16.4), the GMA 1347's rack (1.325 x 6.30 in, 7.79 in deep: the
  GMA 1347D installation manual; POH arm 16.3), and the three avionics
  cooling fans (one under each display, the deck skin fan under the
  glareshield on the right). The housings' inset from the bezel and the
  fans' sizes and spots are estimates.
- Flaps (MM 27-50-00 Figs. 201, 202; 27-51-00 Fig. 201; access panels
  6-20-02 Fig. 3 and Table 3): a drive pulley in each wing just aft of the
  rear spar (panels 510EB/610EB "flap controls", WS ~63 read from the
  bottom view) with its push-pull rod aft to the flap's bracket; the motor
  and transmission in the right wing (panel 610GB "flap actuator", WS ~76),
  outboard of the pulley, its actuating tube and jack screw inboard to the
  pulley (the schematic, "view looking down"), the motor beside the jack
  screw (Detail D); the direct and retract cables from pulley to pulley
  across the cabin top, a turnbuckle in each; the follow-up control from a
  bellcrank on the direct cable above the headliner to the flap lever
  (its route between them is not drawn: here down the right forward door
  post); the flap supports with rollers at each flap's ends (Details F, H).
- Cabin heat and ventilation (MM 21-20-00 Fig. 201, 21-40-00 Fig. 201; POH
  Fig. 7-8): the heater hose from the heat shroud's outlet to the shutoff
  valve on the firewall's forward face, worked by the CABIN HT knob's
  cable (straight through the panel and firewall, 21-40-00); the plenum on
  the cabin side behind it with a floor outlet at each end and two hoses
  up to the adjustable defroster outlets under the glareshield; the
  ventilating air door on the right side between the firewall and the
  forward door post with its duct into the plenum and the CABIN AIR
  cable; each wing root's second inlet with its ducts down the forward
  door post to the mid-torso outlet and aft along the cabin top to the
  rear seat's overhead outlet (FlightGear has the leading-edge scoop and
  the upper vent at FS 23.69). Duct routes, the plenum's size and the
  outlets' spots are read from the figures: estimates.
"""

from pathlib import Path

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
    "datalink": 0x2e3034, "xm_antenna": 0xf2f2f0,
    "avionics_shelf": 0xa6aaae, "oil_cooler": 0x2f3133, "starter": 0x3a3c3f, "vacuum_pump": 0x4a4d52,
    "oil_filter": 0x1f4f9a, "starter_ring_gear": 0x6a6d72, "control_column": 0x4a4d52, "aileron_cables": 0xb8bcc0,
    "aileron_bellcranks": 0x8a8f96, "elevator_cables": 0xb8bcc0, "elevator_bellcranks": 0x8a8f96,
    "rudder_cables": 0xb8bcc0, "elevator_trim_cables": 0xb8bcc0, "trim_tab_actuator": 0x5c5f63,
    "pulley": 0x2f3133, "nose_gear_fittings": 0x6d7176, "shimmy_damper": 0x3a3c40,
    "nose_steering_tubes": 0x9a9ea3, "nose_gear_strut": 0xc4c8cc, "induction_air_filter": 0xd9c58f, "induction_air_box": 0x55585d,
    "induction_air_duct": 0x2c2d30, "alternate_air_door": 0x7d8187, "oil_filler_cap": 0x8c8f93, "fuel_tanks": 0x7fb2e0, "fuel_quantity_senders": 0x8a8f96,
    "static_wicks": 0x2b2b2b, "oat_probe": 0xc8ccd0,
    "pfd_unit": 0x2a2c2f, "mfd_unit": 0x2a2c2f, "audio_panel_unit": 0x303236, "avionics_fans": 0x1f2022,
    "flap_motor": 0x4a4d52, "flap_drive_pulleys": 0x8a8f96, "flap_cables": 0xb8bcc0, "flap_follow_up": 0x2b2c2e,
    "flap_tracks": 0x9aa0a6, "cabin_heat_valve": 0xa6aaae, "heater_hose": 0x3b3c3e, "cabin_heat_plenum": 0x8f9398,
    "defroster_ducts": 0x3b3c3e, "cabin_air_door": 0x9ea2a7, "fresh_air_ducts": 0x3b3c3e,
    # Pieces within a part.
    "tray": 0x8c8f93, "cover": 0x404247, "vent": 0xd8d8d0, "hose": 0x1e1f21,
}

# Engine mount: firewall bolts -> the engine's rear mounts.
MOUNT_FW = [(0.25, 0.06), (-0.25, 0.06), (0.25, -0.45), (-0.25, -0.45)]
MOUNT_ENG = [(0.15, 0.02), (-0.15, 0.02), (0.15, -0.19), (-0.15, -0.19)]
MOUNT_ENG_Z = 1.06
MOUNT_R = 0.011
# Main battery (x, y ranges; depth forward of the firewall), outboard of
# the mount's left legs; the junction box directly above it at the
# firewall's outboard edge (MM 24-30-00 Fig. 201), the external power
# receptacle on its outboard face.
BATTERY_X, BATTERY_Y, BATTERY_DEPTH = (0.255, 0.475), (-0.33, -0.14), 0.16    # clear of the harness
JUNCTION_BOX = ((0.33, 0.47), (-0.10, 0.06), 0.07)
# Standby battery: (x, y, z) ranges behind the PFD (MM 24-30-10: "installed
# behind the Primary Flight Display"; POH Fig. 6-9 arm 11.2), aft of the
# PFD's housing.
STANDBY_BATTERY = ((0.10, 0.27), (0.04, 0.13), (0.46, 0.55))
# Exhaust: the CAD cylinders' exhaust ports (measured from its own pipes),
# the muffler's axis (x from -L to L at y, z) and radii.
PORTS = {1: [(0.34, -0.166, 1.233), (0.34, -0.166, 1.364)],
         -1: [(-0.34, -0.162, 1.324), (-0.34, -0.163, 1.450)]}
MUFFLER_Y, MUFFLER_Z, MUFFLER_L, MUFFLER_R = -0.40, 1.41, 0.154, 0.076  # 13 x 6 in (MM Fig. 201: L/D 2-2.5)
SHROUD_L, SHROUD_R = 0.11, 0.086
SHROUD_INLET = (0.33, -0.13, 1.58)        # REF_SCALE: the left front baffle (MM 78-10-00: the shroud's inlet)
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
BAY_WS, BAY_CHORD, BAY_INSET = (31.38, 65.125), 26.0, 0.015
TANK_HOLE_MORE = 0.01                    # m: the bay's opening is wider than the skin's, hidden under it
SENDER = (0.45, 0.012)
# Static wicks: length, radius; each pair's distances in from the
# surface's outboard end (or the rudder's top), MM 23-60-00 Fig. 201.
WICK_L, WICK_R = 0.13, 0.0035
WICK_SPOTS = {"left_aileron": (0.04, 0.16), "right_aileron": (0.04, 0.16), "elevator": (0.04, 0.49),
              "rudder": (0.15, 1.20)}
# OAT probe: FS (POH Fig. 6-9: the GTP 59's arm, 41.5; the MM's FS 46.46 is
# the non-G1000 probe's), height of the stem above the roof, radius.
OAT_PROBE = (41.5, 0.05, 0.008)
# Static port: FS and height on the left side, just ahead of the forward
# door post (MM 34-11-00 Fig. 202; no station given).
STATIC_PORT = (20.0, -0.15)
# Fuel under the floor. The cabin floor is at y -0.67, the belly about
# -0.79; the door posts at |x| 0.495, z 0.19. Reservoir (x, y, z ranges)
# under the copilot's footwell; selector valve under the pedestal (the
# handle, fuel_selector, is at x 0, z 0.17-0.32); pump and shutoff valve
# between the reservoir and the firewall.
POST_X, POST_Z = 0.495, 0.19
# The forward door post is raked: its foot is at POST_Z, and it leans aft
# to meet the wing's front spar at the top (FlightGear's door edge: z 0.16
# at y -0.55, -0.06 at y 0.35). post_z(y) is the post's z at height y.
POST_RAKE = ((-0.60, 0.19), (0.38, -0.03))


def post_z(y):
    (y0, z0), (y1, z1) = POST_RAKE
    return z0 + (np.clip(y, y0, y1) - y0) * (z1 - z0) / (y1 - y0)


# FlightGear's forward door post trim is a hollow about 4 cm square: (x,
# [(y, z)]) down its middle, found by casting rays from the seats. Its top
# opens aft (z -0.09) into the door frame and the wing root, the only way
# in that the cabin can't see. The fresh air duct, the forward fuel line
# and (right side) the flap follow-up cable share it, side by side in z.
POST_HOLLOW = (0.50, [(0.38, -0.09), (0.34, -0.07), (0.31, -0.04), (0.26, -0.019), (0.20, 0.006), (0.14, 0.035),
                      (0.08, 0.06)])


def post_hollow(side, dx=0.0, dz=0.0, below=None):
    x, pts = POST_HOLLOW
    return [(side * (x + dx), y, z + dz) for y, z in pts if below is None or y > below]


UNDER_FLOOR = -0.735
RESERVOIR = ((-0.26, -0.16), (-0.775, -0.705), (0.42, 0.62))    # under the carpet, above the belly (Fig. 204: about 2:1:1)
SELECTOR_VALVE = (0.0, UNDER_FLOOR, 0.25)
AUX_PUMP = ((-0.21, -0.09), UNDER_FLOOR, 0.705, 0.032)       # x range, y, z, radius
SHUTOFF_VALVE = (-0.05, UNDER_FLOOR, 0.75)                  # by the copilot's pedals (MM 28-20-00: its rigging)
# Each tank's two outlets at the bay's inboard rib (Fig. 201): the forward
# one's line runs down the front door post, the aft one's down the rear
# door post (FS: inside the post's trim, which the MM puts at FS 65.33) and
# forward under the floor at AFT_LINE_X.
OUTLET_FS, AFT_POST_FS, AFT_LINE_X = (35.5, 58.0), 64.5, 0.24
VENT_LINE = (0.495, -0.14)                                   # y, z: across the cabin top, aft of the windshield's view
FUEL_LINE_R, VENT_R = 0.006, 0.004
# Stall warning: the scoop's wing station; the horn at the upper left door post.
STALL_WS = 91.0
STALL_HORN = (0.60, 0.0)                           # |x|, z: inside the left wing root, above the door post
# Tailcone avionics shelf, centred on the fuselage above baggage area 2
# (FS 108-142, 10.25 in tall: its floor is at y -0.49; the rack sits an
# inch into that height to clear the tailcone's sloping top), at the POH Fig. 6-9
# arms: GIA 63W 113.3, aft avionics fan 109.0, GRS 77 134.0 (the list's
# GDC 74A arm, 11.4, is the GEA 71's; MM 34-13-00 puts it on the shelf).
# MM 23-10-00 Fig. 202: the GIAs and the GTX stand on edge side by side
# (GTX on the right), the fan in a plenum at the rack's left end; the GRS 77
# and GDC 74A side by side aft of the rack (ADC on the left).
SHELF_FS = (106.0, 141.0)
RACK_FS = (107.0, 120.0)
RACK_Y = (-0.255, -0.055)                                    # GIA: 7.9 in tall, 13 in long; clear of the sloping roof
RACK_UNITS = [("integrated_avionics_units", 0.025, 0.093), ("integrated_avionics_units", -0.045, 0.022),
              ("transponder", -0.088, -0.047)]               # x ranges (2.65 in and 1.65 in wide)
AHRS = ((-0.10, -0.005), (-0.255, -0.195), (128.0, 136.0))   # x, y, FS ranges
AIR_DATA = ((0.005, 0.09), (-0.255, -0.20), (128.0, 135.0))
FAN = (0.15, -0.155, 0.04, 109.0)                            # x, y, radius, FS of its face
# GDL 69A XM datalink (POH Fig. 6-9 34-11-S: arm 112.8, 1.9 lb): on edge in
# the rack, outboard of the GTX (MM 34-54-00 Fig. 201). Garmin's GDL 69/69A
# installation manual: 1.05 in wide, 6.15 in high, 7.20 in deep, 1.86 lb.
DATALINK = ((-0.092 - 1.05 * 0.0254, -0.092), 6.15, 7.20, 112.8)   # x range, height, depth (in), FS of its centre
# Its antenna, a Comant CI 420-10 (POH Fig. 6-9: arm 43.5) on the cabin top
# (POH p. 7-74; the side isn't given: on the centreline). The datasheet
# shows a four-screw teardrop but gives no size: length, width, height in
# inches are those of the common GA teardrop, an estimate. Its nose sits
# 0.6 in aft of the arm, clear of the OAT probe (its middle within an inch of the arm).
XM_ANTENNA = (43.5 + 0.6, 4.6, 3.0, 0.8)
# GEA 71 under the MFD (x -0.28 to -0.02 at the panel, z 0.35), lying flat
# below the MFD's housing, inboard of the copilot's column arm.
GEA = ((-0.215, -0.06), (-0.115, -0.05), (0.40, 0.62))     # behind the standby instruments, above the column
# GMU 44: wing station (access plate 520HB, MM 6-20-00 Fig. 3) and FS (POH
# Fig. 6-9 arm 52.7).
GMU_WS, GMU_FS = 122.0, 52.7
# Induction air: the filter face (x half-width, y range, z of its front
# and depth) in the chin inlet; the filter box behind it (back face z);
# the duct's height under the muffler and radius.
FILTER = (0.10, (-0.55, -0.44), 1.605, 0.03)
AIR_BOX_Z = 1.47
DUCT_Y, DUCT_R = -0.555, 0.04
ALT_DOOR = (0.06, 0.05)                  # width (x), height (y), on the box's aft wall beside the duct (MM Fig. 201 detail A)
# Nose gear: FlightGear's strut axis (scene z = a * y + b, x = 0, fitted to
# its slices and moved aft with it), the y of the barrel's top, of the
# upper fitting, the clamp and the steering collar.
STRUT_AXIS = (-0.296, 0.607)
STRUT_TOP_Y, STRUT_R = -0.63, 0.026
UPPER_FITTING_Y, LOWER_FITTING_Y, COLLAR_Y = -0.65, -0.705, -0.745
RUDDER_BAR = (0.15, -0.655, 0.575)
# Flight controls: the yoke shafts' forward ends (x, y, z); the column
# (Fig. 202: a U whose arms drop from the shafts to a cross tube with the
# aileron cable drum, then the stem to the pivot at the floor); the cable
# radius (the real cables are 1/8 in and 3/32 in: drawn thicker to be
# seen); the depth under the cabin floor; the aileron bellcrank's WS-ish x
# and FS (on the bottom wing skin aft of the rear spar, Fig. 203), the rear
# spar's z (the cables' chord spot); the aft elevator bellcrank (on the
# elevators' hinge axis, Fig. 202 detail B); the trim actuator. The MM
# gives no pulley stations: each run's pulleys sit at the bulkheads its
# figure shows (MM 6-15-00 Fig. 1), lateral offsets keep the runs apart
# under the floor.
YOKE_ENDS = [(0.221, -0.097, 0.456), (-0.239, -0.097, 0.456)]
COLUMN_Z, COLUMN_FOOT_Y, COLUMN_CROSS_Y = 0.58, -0.70, -0.40
CABLE_R, PULLEY_R = 0.0025, 0.022             # fits between the belly skin and the floor
UNDER_FLOOR_Y = -0.785
AILERON_BELLCRANK_X, AILERON_BELLCRANK_FS, REAR_SPAR_Z = 2.78, 66.0, -0.752
REAR_POST = (0.47, -0.89)                 # |x|, z inside the rear door posts (MM FS 65.33)
AILERON_RUN_X, RUDDER_RUN_X, ELEVATOR_RUN_X, TRIM_RUN_X = 0.12, 0.075, 0.03, (0.19, 0.21)
ELEVATOR_BELLCRANK = (0.0, -0.43, -4.90)
FWD_ELEVATOR_BELLCRANK_FS = 23.0
# Pulley stations (FS) and heights above the belly: elevator (27-30-00
# Fig. 201: F, a lateral pair aft of the forward bellcrank; B, C, D),
# rudder (27-20-00 Fig. 201: K, H), trim (27-31-00 Fig. 201: N at bracket
# M, C at bulkhead B, E at bulkhead D at mid-height, G at the stabilizer
# with horizontal pulleys).
ELEVATOR_PULLEYS = [(35.0, None), (108.0, None), (160.0, None), (205.81, None)]
RUDDER_PULLEYS = [50.0, 108.0, 142.0]
TRIM_PULLEYS = [(25.0, None), (100.0, None), (178.0, -0.44), (206.0, -0.43)]
TRIM_ACTUATOR = (-0.50, -0.415, (-4.70, -4.54))     # in the stabilizer, ahead of the elevator
# Oil filler tube: its foot on the crankcase's right rear (REF_SCALE
# frame) and its top just under FlightGear's dipstick cap.
FILLER_FOOT, FILLER_TOP_Y, FILLER_R = (-0.115, -0.10, 1.095), 0.09, 0.013
# Engine-relative spots (the mount's engine end, the exhaust ports and
# muffler, the accessories) are in engine.py's REF_SCALE frame and go
# through E() (engine.ref_to_scene), so they follow the engine's FIT.
# Engine accessories (scene coordinates beside the CAD engine), each at
# the clear spot nearest where the sources put it (tools/geometry.py
# overlaps finds collisions).
OIL_COOLER = ((0.24, 0.42), (-0.076, 0.10), (0.93, 0.99))  # scene: a vertical core on the left rear baffle (MM 79-20-00 Fig. 201), 7 x 7 x 2.5 in
STARTER = (0.17, -0.19, (1.52, 1.66), 0.045)
VACUUM_PUMP = (-0.055, -0.085, (0.93, 1.01), 0.042)
OIL_FILTER = (-0.025, 0.02, (0.90, 1.01), 0.046)
# Starter ring gear on its support, between the crankshaft's flange and
# FlightGear's spinner (scene z range; radius held to the spinner's, which
# is smaller than a real 172's).
RING_GEAR = ((1.678, 1.725), 0.118, 0.06)                   # z range, ring radius, hub radius
# Behind the instrument panel (its face is at z PANEL_FACE). The GDU 1040s
# (11.80 x 7.70 in bezel, 3.77 in deep with the connector: Garmin part
# listings; POH Fig. 6-9 arm 16.4) behind FlightGear's PFD and MFD bezels,
# their housings inset HOUSING_INSET from the bezel (an estimate). The GMA
# 1347 (Garmin GMA 1347D installation manual: rack 1.325 x 6.30 in, 7.79 in
# deep behind the panel with its connectors; POH arm 16.3) between them.
PANEL_FACE = 0.364                     # m: aft of the audio panel's keys
GDU_DEPTH, HOUSING_INSET = 3.77 * IN, 0.012
GDU_BEZELS = {"pfd_unit": (0.066, 0.334), "mfd_unit": (-0.285, -0.016)}    # x ranges; y from BEZEL_Y
BEZEL_Y = (-0.046, 0.149)
GMA_RACK = ((0.004, 0.038), (-0.028, 0.132), 7.79 * IN)              # x, y ranges, depth
# Avionics cooling fans (MM 21-21-00 Fig. 202, G1000): one under each
# display blowing up into it, and the deck skin fan under the glareshield
# on the right. (x, y, z) of each fan's centre, radius, thickness (sizes
# and spots read from the figure: estimates).
PANEL_FANS = [((0.29, -0.07, 0.42), 0.025), ((-0.03, -0.07, 0.42), 0.025), ((-0.30, 0.155, 0.48), 0.04)]
FAN_T = 0.025
# Flaps (MM 27-50-00 Figs. 201, 202; access panels 6-20-02 Fig. 3, read
# by WS from the bottom view): a drive pulley in each wing just aft of the
# rear spar (panel 610EB/510EB "flap controls", WS ~63), a push-pull rod
# aft to the flap's bracket; the motor and transmission in the right wing
# outboard of its pulley (panel 610GB "flap actuator", WS ~76), its
# actuating tube (jack screw) inboard to the pulley; the direct and
# retract cables from pulley to pulley across the cabin top, with a
# turnbuckle in each; the flap supports with their rollers at each flap's
# inboard and outboard ends (Fig. 202 details F, H).
FLAP_PULLEY = (63.0, -0.83, 0.055)                   # WS, z, radius
FLAP_CABLE_Z = (-0.82, -0.87)                        # across the cabin top (clear of the aileron carry-thru)
FLAP_CABLE_Y, FLAP_CABLE_DY = 0.425, 0.01           # in the hidden gap over the headliner (pulleys too)
FLAP_MOTOR_WS = 76.0
FLAP_TRACK_X = (0.56, 2.50)
# Flap follow-up control (MM 27-51-00 Fig. 201): a sheathed cable from a
# bellcrank clamped to the direct cable above the headliner to the flap
# lever's switch arm behind the panel; its route between them (here down
# the right forward door post) is not drawn in the MM.
FOLLOW_UP_X = -0.12
FLAP_LEVER_BACK = (-0.175, -0.22, 0.40)
# Cabin heat (MM 21-40-00 Fig. 201; POH Fig. 7-8): the heat shroud's outlet
# hose to the shutoff valve riveted to the firewall's forward face, the
# plenum on the cabin side behind it, floor outlets at its two ends, two
# hoses up to the adjustable defroster outlets at the windshield's foot;
# fresh air from the right-hand ventilating door (21-20-00 Fig. 201 detail
# C: "on the right side of the fuselage, between the firewall and the
# forward door post") into the plenum. The CABIN HT and CABIN AIR knobs'
# cables run straight forward from the panel (21-40-00: "through hole in
# instrument panel and through hole in firewall"). Sizes are estimates.
HEAT_VALVE = ((-0.15, -0.05), (-0.53, -0.45), 0.06)           # x, y ranges, depth forward of the firewall
PLENUM = ((-0.28, 0.28), (-0.50, -0.40), (0.668, 0.705))       # above the brake master cylinders
FLOOR_OUTLET = (0.42, -0.60, 0.67)                    # outboard of the rudder pedals
DEFROST_X, DEFROST_Z = 0.17, 0.56
HEAT_KNOB, AIR_KNOB = (-0.263, -0.203, 0.46), (-0.263, -0.242, 0.46)
AIR_DOOR = ((-0.48, -0.42), (0.57, 0.67))                     # y, z ranges on the right side skin
DUCT_R = 0.022
# Fresh air from the wing roots (21-20-00 Fig. 201; POH Fig. 7-8): the
# leading-edge scoop feeds FlightGear's upper vent at FS 23.69 (detail B);
# a second inlet in each wing root feeds a duct down the forward door post
# to the mid-torso outlet and one aft above the headliner to the rear
# seat's overhead outlet (detail A). The inlet's and outlets' spots are
# read from the figures: estimates. The ducts keep inside FlightGear's
# trim: down the door post's hollow (POST_HOLLOW), and in the 5 cm gap over
# the headliner (ROOF_DUCT_X stays inboard of the roof's curve,
# ROOF_DUCT_GAP above the headliner), so they are thinner than Cessna's.
ROOT_INLET = (0.57, 0.47, 0.045)
POST_DUCT_R, ROOF_DUCT_R = 0.011, 0.02
ROOF_DUCT_X, ROOF_DUCT_GAP = 0.30, 0.025
REAR_OUTLET_Z = -1.05


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


# Placards drawn sharp (tools/placards.py) over panelglass.png's own,
# which have a few pixels per letter: (image, the old one's pixel box
# x0, y0, x1, y1 in the 2048 x 512 texture, widened a pixel or two so
# its blurred edge is covered).
PLACARD_DIR = Path(__file__).resolve().parent / "placards"
PLACARDS = [("placard-registration.png", (124.5, 55.5, 179.5, 77.5)),
            ("placard-winterization.png", (83.5, 110.5, 222.5, 148.5))]
PLACARD_LIFT = 0.0004                  # m off the panel face, towards the cabin


def placards(parts):
    """The placards as a piece of instrument_panel: quads on the panel face,
    found by mapping their texture boxes through the face's uvs."""
    panel = next(p for p in parts if p["id"] == "instrument_panel")
    face = next(q for q in panel["pieces"] if q["tex"] is not None and Path(q["tex"]).stem == "panelglass")
    uv, tris, verts = face["uv"], face["tris"], face["verts"]
    tw, th = 2048, 512

    def at(px, py):
        """Texture pixel -> (point on the face, its normal towards the cabin)."""
        u, v = px / tw, 1 - py / th            # AC3D's v runs up the image
        for t in tris:
            a, b, c = uv[t]
            m = np.array([b - a, c - a]).T
            if abs(np.linalg.det(m)) < 1e-12:
                continue
            s, r = np.linalg.solve(m, np.array([u, v]) - a)
            if s >= -1e-6 and r >= -1e-6 and s + r <= 1 + 1e-6:
                p0, p1, p2 = verts[t]
                n = np.cross(p1 - p0, p2 - p0)
                n /= np.linalg.norm(n)
                return p0 + s * (p1 - p0) + r * (p2 - p0), (n if n[2] < 0 else -n)   # the cabin is -z
        raise SystemExit(f"placard pixel {px}, {py} is off the panel face")

    pieces = []
    nu, nv = 12, 4                     # a grid following the face, which curves up into the glareshield
    for name, (x0, y0, x1, y1) in PLACARDS:
        verts_, uvs = [], []
        for j in range(nv + 1):
            for i in range(nu + 1):
                fu, fv = i / nu, j / nv                       # image u right, v up
                p, n = at(x0 + fu * (x1 - x0), y1 - fv * (y1 - y0))
                verts_.append(p + PLACARD_LIFT * n)
                uvs.append((fu, fv))
        quads = [(j * (nu + 1) + i, j * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i)
                 for j in range(nv) for i in range(nu)]
        tris_ = [t for a, b, c, d in quads for t in ((a, b, c), (a, c, d))]
        pieces.append({"tex": str(PLACARD_DIR / name), "verts": np.array(verts_), "tris": np.array(tris_),
                       "uv": np.array(uvs), "rgb": np.ones((len(verts_), 3))})
    return {"id": "instrument_panel", "system": panel["system"], "kind": panel["kind"],
            "glass": False, "ask": panel["ask"], "pieces": pieces}


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
    # Diagonals: each side's upper firewall fitting to its lower engine
    # mount, and the lower bay cross-braced (MM 71-20-00 Fig. 202).
    tubes += [tube([fw[0], en[2]], MOUNT_R), tube([fw[1], en[3]], MOUNT_R),
              tube([fw[2], en[3]], MOUNT_R), tube([fw[3], en[2]], MOUNT_R)]
    tubes.append(tube([en[0], en[1], en[3], en[2], en[0]], MOUNT_R))   # the ring the engine bolts to
    # A dynafocal cup with its rubber shock mount at each engine point,
    # angled toward the engine's centre of gravity (Fig. 201).
    cg = E((0.0, -0.08, 1.30))
    for p in en:
        u = (cg - p) / np.linalg.norm(cg - p)
        tubes.append(cylinder(p - u * 0.01, p + u * 0.035, 0.03, 16))
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
    ym, zm = (y0 + y1) / 2, FIREWALL_Z + d / 2
    return [box((x0, y0, FIREWALL_Z), (x1, y1, FIREWALL_Z + d)),
            ("tray", cylinder((x1, ym, zm), (x1 + 0.025, ym, zm), 0.022, 16))]      # external power receptacle


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
              tube([(0.05, my, mz - SHROUD_R + 0.01), (0.05, my, mz - SHROUD_R - 0.03)], 0.025, 12),
              # The inlet hose from the left front baffle.
              ("hose", tube([(sl * 0.6, my + SHROUD_R - 0.01, mz), (sl * 0.8, my + SHROUD_R + 0.04, mz + 0.05),
                             E((0.30, -0.26, 1.48)), E(SHROUD_INLET)], 0.022, 12))]          # outboard of the starter
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
    skin = np.vstack([tris_of(parts, "fuselage"), tris_of(parts, "cowling")])
    pump = [cylinder((px0, py, pz), (px1, py, pz), pr, 16),
            ("hose", tube([((px0 + px1) / 2, py - pr, pz),
                           ((px0 + px1) / 2, hits(skin, (px0 + px1) / 2, pz).min() - 0.005, pz)], 0.004, 6))]  # drain
    vx, vy, vz = SHUTOFF_VALVE
    shutoff = [box((vx - 0.025, vy - 0.025, vz - 0.02), (vx + 0.025, vy + 0.025, vz + 0.02))]
    lines = []
    for side in (1, -1):
        wing = wing_skin(parts, side)
        ox = side * (BAY_WS[0] * IN - 0.01)
        fwd, aft = [(ox, hits(wing, ox, fs(st)).min() + 0.02, fs(st)) for st in OUTLET_FS]
        # Down the forward door post, following its rake.
        # Inboard inside the wing, just above its bottom skin, until within
        # the fuselage's side, then down the post (no corner out in the air):
        # in its hollow (POST_HOLLOW) behind the fresh air duct, below it
        # in the trim.
        def root(z):
            y = hits(wing, side * 0.55, z).min() + 0.03
            return [(side * 0.55, y, z), (side * POST_X, y, z)]
        zt = POST_HOLLOW[1][0][1] - 0.01
        post = post_hollow(side, 0.008, -0.016) + [(side * 0.508, y, post_z(y)) for y in (0.0, -0.40)]
        lines.append(tube([fwd, *root(zt), *post, (side * POST_X, UNDER_FLOOR, POST_Z), (side * 0.12, UNDER_FLOOR, sz),
                           (side * 0.03, sy, sz)], FUEL_LINE_R, 8))
        az, lx_ = fs(AFT_POST_FS), side * AFT_LINE_X
        lines.append(tube([aft, *root(az), (side * POST_X, 0.28, az), (side * POST_X, -0.56, az),   # in from the skin's
                           (side * 0.46, low_y(parts, side * 0.46, az, UNDER_FLOOR, 0.01), az),           # turn under the floor
                           (lx_, low_y(parts, lx_, az, UNDER_FLOOR, 0.01), az),
                           (lx_, low_y(parts, lx_, sz - 0.10, UNDER_FLOOR, 0.01), sz - 0.10),
                           (side * 0.03, sy - 0.012, sz - 0.03)], FUEL_LINE_R, 8))
    lines.append(tube([(sx, sy, sz + 0.03), (sx, sy, sz + 0.12), (x1 - 0.02, UNDER_FLOOR, z0 - 0.05),
                       (x1 - 0.02, UNDER_FLOOR, z0)], FUEL_LINE_R, 8))           # selector -> reservoir
    lines.append(tube([(cx, UNDER_FLOOR, z1), (cx, UNDER_FLOOR, pz - pr)], FUEL_LINE_R, 8))  # -> pump
    lines.append(tube([(px1, py, pz), (vx - 0.025, vy, vz)], FUEL_LINE_R, 8))          # -> shutoff
    sx_, sy_, sz_ = STRAINER
    lx = sx_ - STRAINER_R - 0.008
    lines.append(tube([(vx + 0.025, vy, vz), (lx, -0.62, FIREWALL_Z), (lx, sy_ + 0.03, sz_),
                       (sx_ - STRAINER_R, sy_ + 0.03, sz_)],
                      FUEL_LINE_R, 8))                                           # through the firewall
    # The return line from the fuel servo through the firewall to the
    # reservoir, with its check valve (POH Fig. 7-6; MM Fig. 206 sheet 2).
    servo = verts_of(parts, "fuel_servo")
    s0 = servo[np.argmin(servo[:, 2])]
    rx = x1 - 0.02
    lines += [tube([s0, (s0[0], s0[1] - 0.04, s0[2] - 0.06), (rx, -0.64, FIREWALL_Z + 0.02),
                    (rx, -0.645, FIREWALL_Z - 0.06), (rx, y1 + 0.01, z1 - 0.03)], FUEL_LINE_R * 0.8, 8),
              cylinder((rx, -0.645, FIREWALL_Z - 0.03), (rx, -0.6455, FIREWALL_Z - 0.075), 0.012, 12)]
    vy_, vz_ = VENT_LINE
    lines.append(tube([(POST_X + 0.06, vy_ - 0.06, vz_), (POST_X, vy_, vz_), (-POST_X, vy_, vz_),
                       (-POST_X - 0.06, vy_ - 0.06, vz_)], VENT_R, 6))
    lines.append(tube([(stack[0], y1 + 0.02, stack[2]), (stack[0], y1 + 0.012, stack[2] - 0.05),
                       (-0.47, y1 + 0.012, POST_Z - 0.03), (-0.50, -0.60, post_z(-0.60) - 0.012),
                       *[(-0.508, y, post_z(y) - 0.012) for y in (-0.40, 0.0)],
                       *post_hollow(-1, dz=-0.025)[::-1],
                       (-POST_X, vy_, vz_)], VENT_R, 6))                         # reservoir vent: under the carpet, up the right post
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
            # Over the filler's hole only one skin is hit: fill from neighbours.
            top[i, j], bot[i, j] = (y.max() - inset, y.min() + inset) if len(y) >= 2 else (np.nan, np.nan)
    for a in (top, bot):
        while np.isnan(a).any():
            for i, j in zip(*np.where(np.isnan(a))):
                near = [a[p, q] for p, q in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1))
                        if 0 <= p < nx and 0 <= q < nz and not np.isnan(a[p, q])]
                if near:
                    a[i, j] = np.mean(near)
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
        for d in WICK_SPOTS[pid]:
            p = section(t, axis, end - sign * d)
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
    # The reed horn sits in the wing root behind the upper door post shield
    # (MM 27-32-00: "put the tube and stall warning horn into the wing
    # through the upper door post shield"); nothing shows in the cabin.
    hx, hz = STALL_HORN
    hy = wing_mid_y(parts, hx, hz)
    return [box((x - 0.035, y - 0.014, le - 0.02), (x + 0.035, y + 0.014, le + 0.012)),
            ("hose", tube([(x, y, le - 0.02), (x - 0.05, y, le - 0.06), (hx + 0.08, hy, le - 0.06),
                           (hx + 0.05, hy, hz), (hx + 0.03, hy, hz)], 0.007, 8)),
            cylinder((hx + 0.03, hy, hz), (hx - 0.02, hy, hz), 0.012, 12),
            cylinder((hx - 0.02, hy, hz), (hx - 0.035, hy, hz), 0.022, 16)]


def teardrop(nose, y, length, width, height, n=24):
    """A teardrop antenna on a skin at height y: its round nose (centre x,
    z) forward, tapering aft; rings drawn in, rising to a flat top."""
    r = width / 2
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    # Outline: the nose circle, pulled out aft into a point (hull of circle + tip).
    ring = hull(np.vstack([np.c_[r * np.cos(a), r * np.sin(a)], [[0.0, -(length - r)]]]))
    rings = [(y + height * t, 1 - 0.45 * t ** 2) for t in np.linspace(0, 1, 5)]
    verts, tris, m = [], [], len(ring)
    for k, (ry, sc) in enumerate(rings):
        cz = -(length - r) * 0.35 * (1 - sc)                     # shrink toward the body's middle
        verts += [(nose[0] + px * sc, ry, nose[1] + cz + pz * sc) for px, pz in ring]
        if k:
            b0, b1 = (k - 1) * m, k * m
            for i in range(m):
                j = (i + 1) % m
                tris += [(b0 + i, b0 + j, b1 + j), (b0 + i, b1 + j, b1 + i)]
    top = len(verts)
    verts.append((nose[0], rings[-1][0], np.mean([v[2] for v in verts[-m:]])))
    tris += [((len(rings) - 1) * m + i, (len(rings) - 1) * m + (i + 1) % m, top) for i in range(m)]
    return np.array(verts, dtype=np.float64), np.array(tris)[:, ::-1]      # outward faces


def avionics(parts):
    """-> {part id: pieces} for the G1000 units."""
    out = {k: [] for k in ("integrated_avionics_units", "transponder", "ahrs", "air_data_computer",
                           "avionics_shelf", "engine_airframe_unit", "magnetometer", "datalink")}
    za, zb = fs(SHELF_FS[1]), fs(SHELF_FS[0])        # aft, forward
    ra, rb = fs(RACK_FS[1]), fs(RACK_FS[0])
    y0, y1 = RACK_Y
    for pid, x0, x1 in RACK_UNITS:
        out[pid].append(box((x0, y0, ra), (x1, y1, rb)))
    (dx0, dx1), dh, dd, dfs = DATALINK
    out["datalink"].append(box((dx0, y0, fs(dfs) - dd * IN / 2), (dx1, y0 + dh * IN, fs(dfs) + dd * IN / 2)))
    out["avionics_shelf"] += [box((-0.13, y0 - 0.006, za), (0.20, y0, zb)),
                              box((-0.125, y1 + 0.004, ra), (0.11, y1 + 0.01, rb))]      # the rack's top
    for pid, ((x0, x1), (ay0, ay1), (f0, f1)) in (("ahrs", AHRS), ("air_data_computer", AIR_DATA)):
        out[pid].append(box((x0, ay0, fs(f1)), (x1, ay1, fs(f0))))
    fx, fy, fr, ffs = FAN
    fz = fs(ffs)
    out["avionics_shelf"] += [("tray", box((0.1, y0, rb - 0.12), (0.20, y1 - 0.02, fz - 0.005))),   # plenum
                              cylinder((fx, fy, fz + 0.04), (fx, fy, fz - 0.005), fr, 20)]
    (x0, x1), (gy0, gy1), (z0, z1) = GEA
    out["engine_airframe_unit"] += [box((x0, gy0, z0), (x1, gy1, z1)),
                                    ("tray", box((x0 - 0.01, gy0 - 0.006, z0), (x1 + 0.01, gy0, z1 + 0.02)))]
    wing = wing_skin(parts, 1)
    x = GMU_WS * IN
    z = fs(GMU_FS)
    y = hits(wing, x, z).min()
    out["magnetometer"] += [cylinder((x, y + 0.012, z), (x, y + 0.06, z), 0.04, 20),
                            ("tray", cylinder((x, y + 0.002, z), (x, y - 0.002, z), 0.055, 20))]
    return out


def engine_accessories():
    """-> (oil cooler, starter, vacuum pump, oil filter)."""
    (x0, x1), (y0, y1), (z0, z1) = OIL_COOLER
    hose_ends = [E((0.07, -0.10, 1.03)), E((0.08, -0.12, 1.02))]
    cooler = [box((x0, y0, z0), (x1, y1, z1)),
              # Hoses from its inboard face to the accessory housing, clear of the battery.
              ("hose", tube([(x0, y0 + 0.03, (z0 + z1) / 2), (x0 - 0.06, y0 + 0.01, (z0 + z1) / 2 + 0.02),
                             hose_ends[0]], 0.011, 10)),
              ("hose", tube([(x0, y0 + 0.07, (z0 + z1) / 2), (x0 - 0.07, y0 + 0.04, (z0 + z1) / 2 + 0.03),
                             hose_ends[1]], 0.011, 10))]
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


def ring_gear():
    from engine import AXIS_Y
    (z0, z1), r, hub = RING_GEAR
    return [cylinder((0.0, AXIS_Y, z0), (0.0, AXIS_Y, z1), hub, 20),
            cylinder((0.0, AXIS_Y, z1 - 0.022), (0.0, AXIS_Y, z1 - 0.004), r, 40)]


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
    yd = (y0 + y1) / 2 - dl / 2
    door = [box((DUCT_R + 0.015, yd, AIR_BOX_Z - 0.006), (DUCT_R + 0.015 + dw, yd + dl, AIR_BOX_Z))]
    return filt, air_box, duct, door


def nose_gear():
    """-> (strut barrel top, fittings, shimmy damper, steering tubes)."""
    a, b = STRUT_AXIS

    def axis(y, x=0.0):
        return np.array([x, y, a * y + b])
    barrel = [cylinder(axis(-0.67), axis(STRUT_TOP_Y), STRUT_R, 16)]
    up, low = axis(UPPER_FITTING_Y), axis(LOWER_FITTING_Y)
    fittings = [box((-0.05, up[1] - 0.03, FIREWALL_Z), (0.05, up[1] + 0.03, up[2] + 0.035)),     # upper fitting
                box((-0.09, up[1] - 0.04, FIREWALL_Z), (0.09, up[1] + 0.04, FIREWALL_Z + 0.008)),  # its plate
                cylinder(low + (0, -0.012, 0.0036), low + (0, 0.012, -0.0036), 0.044, 16),        # clamp
                box((-0.06, low[1] - 0.012, FIREWALL_Z), (0.06, low[1] + 0.012, low[2] - 0.02))]  # bottom fitting
    collar = axis(COLLAR_Y)
    dx = -0.078                                  # the right side, outboard of the torque links' collar
    lug = axis(LOWER_FITTING_Y - 0.02)
    damper = [cylinder(collar + (dx, 0.0, 0.0), collar + (dx, 0.03, -0.009), 0.016, 12),
              tube([collar + (dx, 0.03, -0.009), lug + (dx, 0.0, 0.0)], 0.006, 8),
              tube([lug + (dx, 0.0, 0.0), lug + (-0.03, 0.0, 0.0)], 0.006, 8),                  # lug on the barrel
              tube([collar + (dx + 0.016, 0.0, 0.0), collar + (-0.047, 0.0, 0.0)], 0.007, 8)]   # the collar's arm
    bx, by, bz = RUDDER_BAR
    tubes = []
    for side in (1, -1):
        start = collar + (side * 0.05, -0.006, 0.0)
        fw = (side * 0.11, -0.735, FIREWALL_Z + 0.02)
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
    # The column: each yoke shaft forward to the U's arm, the arms down to
    # the cross tube and its drum, the stem down to the pivot.
    (lx, ly, _), (rx, _, _) = YOKE_ENDS
    cy = COLUMN_CROSS_Y
    for x, y, z in YOKE_ENDS:
        out["control_column"].append(tube([(x, y, z), (x, y, COLUMN_Z), (x, cy, COLUMN_Z)], 0.012, 10))
    out["control_column"] += [tube([(lx, cy, COLUMN_Z), (rx, cy, COLUMN_Z)], 0.018, 12),
                              cylinder((-0.035, cy, COLUMN_Z), (0.035, cy, COLUMN_Z), 0.05, 20),     # cable drum
                              tube([(0.0, cy, COLUMN_Z), (0.0, COLUMN_FOOT_Y, COLUMN_Z)], 0.02, 12)]
    foot = np.array([0.0, COLUMN_FOOT_Y, COLUMN_Z])

    def under(x, station, dy=None):
        """A run's point at FS `station`: under the cabin floor, or dy above the belly."""
        z = fs(station)
        return (x, low_y(parts, x, z, UNDER_FLOOR_Y if dy is None else belly(parts, z, dy)), z)
    # Ailerons: from the drum down to the floor, aft beside the centreline,
    # outboard at the rear door posts (Fig. 201 detail J), up each post and
    # out the rear spar to the bellcrank; the carry-thru joins the two
    # bellcranks across the cabin top.
    px, pz = REAR_POST
    bz = fs(AILERON_BELLCRANK_FS)
    bell = {}
    for side in (1, -1):
        bx = side * AILERON_BELLCRANK_X
        by = hits(wing_skin(parts, side), bx, bz).min() + 0.02
        piv = np.array([bx, by, bz])
        bell[side] = piv
        root = wing_mid_y(parts, side * 0.555, REAR_SPAR_Z)
        ax = side * AILERON_RUN_X
        post_station = (FIREWALL_Z - pz) / IN
        out["aileron_cables"] += cable([(side * 0.045, cy - 0.03, COLUMN_Z),
                                        under(side * 0.045, (FIREWALL_Z - COLUMN_Z) / IN + 2),
                                        under(ax, (FIREWALL_Z - COLUMN_Z) / IN + 6),
                                        under(ax, post_station), under(side * (px - 0.02), post_station),
                                        (side * px, 0.36, pz), (side * 0.555, root, REAR_SPAR_Z),
                                        (bx - side * 0.15, by, REAR_SPAR_Z), piv + (-side * 0.03, 0, 0.06)])
        # Bellcrank: a plate on a vertical pivot bolt through the bottom skin,
        # and the push rod aft to the aileron's leading edge.
        le = section(tris_of(parts, "left_aileron" if side > 0 else "right_aileron"), 0, bx)
        out["aileron_bellcranks"] += [box(piv - (0.045, 0.004, 0.035), piv + (0.045, 0.004, 0.07)),
                                      cylinder(piv - (0, 0.022, 0), piv + (0, 0.075, 0), 0.006, 10),
                                      tube([piv + (side * 0.03, 0, -0.03),
                                            (bx + side * 0.03, (le[:, 1].min() + le[:, 1].max()) / 2, le[:, 2].max())],
                                           0.006, 8)]
    l, r = bell[1], bell[-1]
    top = 0.44
    out["aileron_cables"] += cable([l + (-0.03, 0.012, 0.06), (l[0] - 0.15, l[1] + 0.012, REAR_SPAR_Z),
                                    (0.555, wing_mid_y(parts, 0.555, REAR_SPAR_Z) + 0.01, REAR_SPAR_Z),
                                    (0.4, top, REAR_SPAR_Z), (-0.4, top, REAR_SPAR_Z),
                                    (-0.555, wing_mid_y(parts, -0.555, REAR_SPAR_Z) + 0.01, REAR_SPAR_Z),
                                    (r[0] + 0.15, r[1] + 0.012, REAR_SPAR_Z), r + (0.03, 0.012, 0.06)])
    # Elevator: push-pull tube, forward bellcrank (a plate on a vertical
    # pivot), the up and down cables over their pulleys, the aft bellcrank
    # (a vertical plate on a lateral pivot through the elevators' tubes).
    fb = np.array(under(0.0, FWD_ELEVATOR_BELLCRANK_FS))
    out["elevator_bellcranks"] += [tube([foot + (0, -0.02, 0), fb + (0, 0.0, 0.03)], 0.009, 8),
                                   box(fb - (0.06, 0.006, 0.03), fb + (0.06, 0.006, 0.03)),
                                   cylinder(fb - (0, 0.025, 0), fb + (0, 0.025, 0), 0.008, 10)]
    ab = np.array(ELEVATOR_BELLCRANK)
    out["elevator_bellcranks"] += [box(ab - (0.006, 0.06, 0.03), ab + (0.006, 0.05, 0.03)),
                                   cylinder(ab - (0.10, 0, 0), ab + (0.10, 0, 0), 0.008, 10)]
    for k, (dx, dy) in enumerate(((ELEVATOR_RUN_X, 0.04), (-ELEVATOR_RUN_X, 0.065))):
        run = [fb + (dx * 2, 0, 0)] + [under(dx, st, dy if st > 60 else None) for st, _ in ELEVATOR_PULLEYS] + \
              [ab + (0, 0.045 if k else -0.055, 0.02)]
        out["elevator_cables"] += cable(run)
    # Rudder: from the arms at the rudder bars' inboard ends aft beside the
    # centreline to FlightGear's stubs at the rudder's bellcrank.
    for side in (1, -1):
        x = side * RUDDER_RUN_X
        run = [(side * 0.04, -0.61, 0.57), under(x, 12.0)] + \
              [under(x, st, None if st < 70 else 0.10) for st in RUDDER_PULLEYS] + [(side * 0.09, -0.535, -4.68)]
        out["rudder_cables"] += cable(run)
    # Trim: the forward and rear chains down the pedestal from the wheel,
    # the cables aft, up to mid-height at the FS 178 bulkhead, across on
    # horizontal pulleys at the stabilizer to the actuator in the right
    # stabilizer; its chain, and its push rod to the tab.
    wx, wz = 0.042, 0.41
    for dz in (-0.012, 0.012):
        out["elevator_trim_cables"].append(tube([(wx, -0.42, wz + dz), (wx, -0.70, wz + dz)], 0.004, 6))
    tx, ty, (tz0, tz1) = TRIM_ACTUATOR
    for k, dx in enumerate(TRIM_RUN_X):
        run = [(wx, -0.70, wz)]
        for st, y in TRIM_PULLEYS:
            z = fs(st)
            xs = dx if st < 120 else dx * 0.5
            run.append((xs, y + 0.012 * k, z) if y is not None else under(xs, st, None if st < 60 else 0.09 + 0.012 * k))
        run += [(tx + 0.03, ty - 0.012 * k, tz1 + 0.02)]
        out["elevator_trim_cables"] += cable(run)
    out["trim_tab_actuator"] += [cylinder((tx, ty, tz1), (tx, ty, tz0), 0.014, 12),
                                 cylinder((tx + 0.02, ty, tz1 + 0.025), (tx - 0.02, ty, tz1 + 0.025), 0.016, 12),  # sprocket
                                 tube([(tx, ty, tz0), (tx, -0.434, -5.27)], 0.004, 6)]
    return out


def panel_avionics():
    """-> {part id: pieces}: the display units' and the audio panel's
    housings behind the panel, and the cooling fans."""
    out = {k: [] for k in ("pfd_unit", "mfd_unit", "audio_panel_unit", "avionics_fans")}
    y0, y1 = BEZEL_Y
    i = HOUSING_INSET
    for pid, (x0, x1) in GDU_BEZELS.items():
        out[pid] += [box((x0 + i, y0 + i, PANEL_FACE), (x1 - i, y1 - i, PANEL_FACE + GDU_DEPTH - 0.02)),
                     ("tray", box((x0 + 0.05, y0 + 0.04, PANEL_FACE + GDU_DEPTH - 0.02),
                                  (x0 + 0.12, y0 + 0.07, PANEL_FACE + GDU_DEPTH)))]        # connector
    (x0, x1), (gy0, gy1), d = GMA_RACK
    out["audio_panel_unit"] += [box((x0, gy0, PANEL_FACE), (x1, gy1, PANEL_FACE + d - 0.02)),
                                ("tray", box((x0 + 0.004, gy0 + 0.03, PANEL_FACE + d - 0.02),
                                             (x1 - 0.004, gy1 - 0.03, PANEL_FACE + d)))]
    for (x, y, z), r in PANEL_FANS:
        out["avionics_fans"] += [box((x - r - 0.004, y - FAN_T / 2, z - r - 0.004), (x + r + 0.004, y + FAN_T / 2, z + r + 0.004)),
                                 ("hose", cylinder((x, y - FAN_T / 2 - 0.001, z), (x, y + FAN_T / 2 + 0.001, z), r * 0.9, 16))]
    return out


def flaps(parts):
    """-> {part id: pieces} for the flap drive."""
    out = {k: [] for k in ("flap_motor", "flap_drive_pulleys", "flap_cables", "flap_follow_up", "flap_tracks")}
    ws, pz, pr = FLAP_PULLEY
    flap = tris_of(parts, "flaps")
    tangents = {}
    for side in (1, -1):
        px = side * ws * IN
        py = wing_mid_y(parts, px, pz)
        c = np.array([px, py, pz])
        # The drive pulley: a disc on a vertical bolt, with its arm.
        out["flap_drive_pulleys"] += [cylinder(c - (0, 0.008, 0), c + (0, 0.008, 0), pr, 20),
                                      cylinder(c - (0, 0.03, 0), c + (0, 0.03, 0), 0.006, 8)]
        # The push-pull rod from the pulley's aft edge to the flap's bracket.
        le = section(flap, 0, px + side * 0.02)
        le = le[le[:, 0] * side > 0]
        top = le[le[:, 2].argmax()]
        out["flap_drive_pulleys"].append(tube([c + (side * 0.02, 0.012, -pr * 0.8),
                                               (top[0], top[1] + 0.012, top[2] - 0.03)], 0.006, 8))
        out["flap_drive_pulleys"].append(box((top[0] - 0.015, top[1], top[2] - 0.06), (top[0] + 0.015, top[1] + 0.02, top[2] - 0.01)))
        tangents[side] = [c + (0, 0, pr), c - (0, 0, pr)]
        # The flap supports: a track plate on each end of the flap, a roller on the flap.
        for tx in FLAP_TRACK_X:
            x = side * tx
            s = section(flap, 0, x)
            s = s[s[:, 0] * side > 0]
            f = s[s[:, 2].argmax()]
            wy = hits(wing_skin(parts, side), x, -0.85)
            out["flap_tracks"] += [box((x - 0.003, wy.min() - 0.03, f[2] + 0.005), (x + 0.003, wy.max() - 0.012, FLAP_CABLE_Z[1] - 0.012)),
                                   ("hose", cylinder((x - side * 0.004, f[1] + 0.02, f[2] - 0.03),
                                                     (x - side * 0.016, f[1] + 0.02, f[2] - 0.03), 0.013, 12))]
    # Motor, transmission and actuating tube in the right wing.
    c = np.array([-ws * IN, wing_mid_y(parts, -ws * IN, pz), pz])
    tx = -FLAP_MOTOR_WS * IN
    arm = c + (-pr * 0.7, 0, pr * 0.7)
    ty = arm[1]
    out["flap_motor"] += [tube([arm, (tx, ty, arm[2])], 0.011, 10),                        # actuating tube and jack screw
                          box((tx - 0.035, ty - 0.035, arm[2] - 0.065), (tx + 0.02, ty + 0.035, arm[2] + 0.025)),   # transmission
                          cylinder((tx - 0.03, ty, arm[2] - 0.08), (tx + 0.10, ty, arm[2] - 0.08), 0.034, 16),     # motor
                          tube([(tx + 0.02, ty, arm[2] + 0.02), (arm[0] - 0.04, ty, arm[2] + 0.02)], 0.004, 6)]   # limit switch support
    # Direct and retract cables, pulley to pulley across the cabin top.
    for k, cz in enumerate(FLAP_CABLE_Z):
        run = []
        for side in (1, -1):
            t = tangents[side][k]
            pts = [t, (side * (ws * IN - 0.12), t[1], cz), (side * 0.555, wing_mid_y(parts, side * 0.555, cz) + 0.012 * k, cz),
                   (side * 0.40, FLAP_CABLE_Y - FLAP_CABLE_DY * k, cz)]
            run = pts if side > 0 else run + pts[::-1]
        out["flap_cables"] += cable(run)
        for tx_ in (0.15, -0.15):
            out["flap_cables"].append(("tray", cylinder((tx_ - 0.03, FLAP_CABLE_Y - FLAP_CABLE_DY * k, cz),
                                                        (tx_ + 0.03, FLAP_CABLE_Y - FLAP_CABLE_DY * k, cz), 0.006, 8)))  # turnbuckle
    # Follow-up control: the bellcrank on the cabin top, clamped to the
    # direct cable, and the sheathed cable to the flap lever.
    b = np.array([FOLLOW_UP_X, FLAP_CABLE_Y + 0.02, FLAP_CABLE_Z[0] + 0.03])
    # Forward over the headliner, then down the right door post's hollow.
    liner = tris_of(parts, "cabin_interior")
    roof = [(-0.38, hits(liner, -0.38, z).max() + 0.02, z) for z in (-0.70, -0.50, -0.30, -0.18)]
    out["flap_follow_up"] += [box(b - (0.03, 0.004, 0.02), b + (0.03, 0.004, 0.02)),
                              tube([b + (0, 0, 0.02), *roof, (-0.50, 0.44, -0.10), *post_hollow(-1, -0.008, -0.016),
                                    *[(-0.508, y, post_z(y) + 0.03) for y in (0.0, -0.28)],
                                    (-0.51, -0.28, 0.40), (-0.25, -0.24, 0.41), FLAP_LEVER_BACK], 0.005, 8)]  # behind the kick panel and the panel
    return out


def cabin_heat(parts):
    """-> {part id: pieces} for the cabin heat and ventilating air system."""
    out = {k: [] for k in ("cabin_heat_valve", "heater_hose", "cabin_heat_plenum", "defroster_ducts",
                           "cabin_air_door", "fresh_air_ducts")}
    (x0, x1), (y0, y1), d = HEAT_VALVE
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    z0 = FIREWALL_Z + 0.002
    out["cabin_heat_valve"] += [box((x0, y0, z0), (x1, y1, z0 + d)),
                                cylinder((xm, ym, z0 + d - 0.005), (xm, ym, z0 + d + 0.03), 0.03, 16),   # inlet
                                ("tray", box((x1, y1 - 0.03, z0 + 0.02), (x1 + 0.03, y1 - 0.02, z0 + 0.045))),  # control arm
                                ("hose", tube([HEAT_KNOB, (-0.24, -0.30, 0.62), (-0.10, -0.40, FIREWALL_Z - 0.06),
                                               (x1 + 0.02, y1 - 0.025, FIREWALL_Z - 0.01),
                                               (x1 + 0.02, y1 - 0.025, z0 + 0.03)], 0.004, 6))]
    _, my, mz = E((0, MUFFLER_Y, MUFFLER_Z))
    out["heater_hose"].append(tube([(0.05, my, mz - SHROUD_R - 0.03), (0.0, -0.47, 1.15), (xm, -0.50, 0.95),
                                    (xm, ym, z0 + d + 0.02)], 0.026, 12))
    (px0, px1), (py0, py1), (pz0, pz1) = PLENUM
    pm, pzm = (py0 + py1) / 2, (pz0 + pz1) / 2
    out["cabin_heat_plenum"].append(box((px0, py0, pz0), (px1, py1, pz1)))
    fx, fy, fz = FLOOR_OUTLET
    for side in (1, -1):
        out["cabin_heat_plenum"] += [tube([(side * (px1 - 0.03), py0 + 0.01, pzm), (side * fx, fy + 0.05, fz + 0.01),
                                           (side * fx, fy + 0.01, fz)], DUCT_R, 12),
                                     box((side * fx - 0.05, fy - 0.025, fz - 0.06), (side * fx + 0.05, fy + 0.02, fz + 0.02))]
        x = side * DEFROST_X
        deck = hits(tris_of(parts, "instrument_panel"), x, DEFROST_Z).min()
        out["defroster_ducts"] += [tube([(x, py1 - 0.01, pzm), (x, py1 + 0.05, 0.685), (x, 0.08, 0.685),
                                         (x, deck - 0.04, DEFROST_Z + 0.02), (x, deck - 0.03, DEFROST_Z)], DUCT_R, 12),
                                   ("tray", box((x - 0.06, deck - 0.03, DEFROST_Z - 0.025), (x + 0.06, deck - 0.002, DEFROST_Z + 0.025)))]
    (dy0, dy1), (dz0, dz1) = AIR_DOOR
    skin = -0.528
    out["cabin_air_door"] += [box((skin - 0.004, dy0, dz0), (skin + 0.004, dy1, dz1)),
                              ("tray", box((skin + 0.004, dy0 - 0.01, dz0 - 0.01), (skin + 0.04, dy1 + 0.01, dz1 + 0.01))),  # inlet
                              ("hose", tube([AIR_KNOB, (-0.30, -0.33, 0.58), (-0.47, -0.41, 0.60), (skin + 0.045, -0.42, 0.60)],
                                            0.004, 6))]
    out["fresh_air_ducts"].append(tube([(skin + 0.04, (dy0 + dy1) / 2, (dz0 + dz1) / 2), (-0.40, pm, (dz0 + dz1) / 2),
                                        (px0 + 0.01, pm, pzm)], DUCT_R, 12))
    liner = tris_of(parts, "cabin_interior")
    roof = [(z, hits(liner, ROOF_DUCT_X, z).max() + ROOF_DUCT_GAP) for z in np.arange(-0.20, REAR_OUTLET_Z, -0.05)]
    roof.append((REAR_OUTLET_Z, hits(liner, ROOF_DUCT_X, REAR_OUTLET_Z).max() + ROOF_DUCT_GAP))
    for side in (1, -1):
        inlet = np.array([side * ROOT_INLET[0], ROOT_INLET[1], ROOT_INLET[2]])
        post = post_hollow(side, dz=0.008)
        (px, oy, oz), (ry, rz) = post[-1], (roof[-1][1], REAR_OUTLET_Z)
        out["fresh_air_ducts"] += [("cabin_air_door", box(inlet - (0.025, 0.02, 0.025), inlet + (0.025, 0.02, 0.025))),
                                   tube([inlet + (0, -0.01, -0.02), (side * 0.55, 0.45, -0.10), (side * 0.50, 0.40, -0.10)]
                                        + post, POST_DUCT_R, 10),
                                   ("cabin_air_door", cylinder((px, oy, oz), (side * 0.455, oy, oz), 0.018, 16)),
                                   tube([inlet + (0, 0, -0.02), (side * 0.55, 0.48, -0.14), (side * 0.42, 0.487, -0.20)]
                                        + [(side * ROOF_DUCT_X, y, z) for z, y in roof], ROOF_DUCT_R, 12),
                                   ("cabin_air_door", cylinder((side * ROOF_DUCT_X, ry, rz),
                                                               (side * ROOF_DUCT_X, ry - ROOF_DUCT_GAP - 0.01, rz), 0.03, 16))]
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
    afs, al, aw, ah = XM_ANTENNA
    az = fs(afs)
    roof = hits(tris_of(parts, "fuselage"), 0.0, az).max()
    units.append(part("xm_antenna", "antennas", [teardrop((0.0, az), roof - 0.002, al * IN, aw * IN, ah * IN)]))
    controls = [part(pid, "flight_controls", pieces) for pid, pieces in flight_controls(parts).items()]
    controls += [part(pid, "flight_controls", pieces) for pid, pieces in flaps(parts).items()]
    units += [part(pid, "avionics", pieces) for pid, pieces in panel_avionics().items()]
    heat = [part(pid, "cabin", pieces) for pid, pieces in cabin_heat(parts).items()]
    cooler, starter, vacuum, oil_filter = engine_accessories()
    engine_parts = [part("oil_cooler", "engine", cooler, ask=True), part("starter", "engine", starter, ask=True),
                    part("vacuum_pump", "engine", vacuum, ask=True),
                    part("oil_filter", "engine", oil_filter, ask=True),
                    part("starter_ring_gear", "engine", ring_gear(), ask=True)]
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
            *fuel, stall, wicks, oat, *units, *controls, *heat, *engine_parts, placards(parts)]
