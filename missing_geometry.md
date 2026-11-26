# Missing geometry

Parts of a G1000 C172S that the model lacks or fuses into another part
(2026-11-25). "MM p" is a PDF page in
`~/Projects/datasets/schematics/cessna-172-mm.pdf`, given as the section
start and its figure pages. "PC" is Lycoming's PC-IO-360-L2A parts catalog.

No usable free 3D model was found. The CC-BY Cessna 172s on Sketchfab are
low-poly shells, the detailed ones on CGTrader cost $30–89, and there is no
free CAD file for the REM38E spark plug. The plan is to keep drawing parts
from MM and PC figures and placing them by station (`build/extras.py`).

## Done (2026-11-25)

- Split out of FlightGear's meshes: `wing_struts` (and the inboard wing
  to `left_wing`/`right_wing`) from `fuselage`, `nose_gear_torque_links`,
  `rudder_cables` (only FlightGear's stubs at the tail).
- Drawn in `build/extras.py`: `fuel_tanks`, `fuel_quantity_senders`,
  `static_wicks`, `oat_probe`, the induction air system
  (`induction_air_filter`, `induction_air_box`, `induction_air_duct`,
  `alternate_air_door`), the oil filler tube (in `oil_filler_cap`), and
  the nose gear mounting (`nose_gear_fittings`, `shimmy_damper`,
  `nose_steering_tubes`; the strut meets the firewall since the gear moved
  to the POH's arms),
  and the flight control runs (`control_column`, `aileron_cables`,
  `aileron_bellcranks`, `elevator_cables`, `elevator_bellcranks`,
  `rudder_cables` extended to the rudder bar, `elevator_trim_cables`,
  `trim_tab_actuator`), `starter_ring_gear`, the fuel return line and
  each tank's aft supply line (in `fuel_lines`), the power receptacle (in
  `power_junction_box`), the heat shroud's inlet hose.
- FlightGear corrections (`geometry_audit.md`): the landing light lens is
  its own glass part (`landing_light_lens`), the cowling's nose strut arch
  is closed and a slot cut in the belly, the ADF antenna is dropped.

- The instrument panel's face (FlightGear's `panel_1_glass`, which the
  build had skipped as glass), and concave polygons ear-clipped in
  `build/ac3d.py` instead of fanned: the fan covered the standby
  instruments' holes and z-fought around the STBY BATT switch and the
  Hobbs meter.

- Added the same day (second pass): the flap drive (`flap_motor`,
  `flap_drive_pulleys`, `flap_cables`, `flap_follow_up`, `flap_tracks`),
  the units behind the panel (`pfd_unit`, `mfd_unit`, `audio_panel_unit`,
  `avionics_fans`; the standby battery and GEA 71 moved to clear them),
  and the cabin heat and ventilation (`heater_hose`, `cabin_heat_valve`,
  `cabin_heat_plenum`, `defroster_ducts`, `cabin_air_door`,
  `fresh_air_ducts`). Sources and confidence are in `geometry_audit.md`.
- Added the same day (third pass): the GDL 69A XM datalink (`datalink`)
  and its antenna (`xm_antenna`); the student's airplane has XM.

## Still missing

"Arm" is the POH equipment list's station (Fig. 6-9, poh pp. 197–202), in
inches aft of the firewall's front face.

### Visible on preflight (high priority)

| Part | Arm | Source |
|---|---|---|
| GPS/COM antennas on the cabin roof (FlightGear's are the old shape) | 61.2 | MM 34-50 GIA 63 p727; the NAV/COM fig (p334) is pre-G1000 |
| Engine cooling baffles and seals | | PC "Intercylinder Cooling Baffles" pp 24–25; Cessna's cowl baffles are probably only in the IPC (not found) |
| Spark plugs | | PC "Cylinder Related Parts and Spark Plugs"; MM 74 p894 (figs 895, 900–903) |
| Alternator belt | | PC "Alternator Assembly and Belt" |
| Crankcase breather and drain lines | −13.8 (breather insulation) | MM 71 p868 (figs 869–872); PC "Breather Fitting" |
| Refueling steps and handle on the cowling | 16.3 | poh 201; check whether FlightGear's fuselage already has them |

### Hidden mechanisms (medium)

| Part | Arm | Source |
|---|---|---|
| GFC 700 servos: pitch and pitch trim (tailcone), roll (right wing, panel 620AB) | 150.6, 150.6, 54.2 | poh 197; MM 22-10-00 Fig. 201 pp 314–316 (the KAP 140's servos; same mounts assumed) |
| Standby instrument cases behind the panel (airspeed, attitude, altimeter) | 16.2, 14.0, 14.0 | poh 200; their depth needs the instruments' data sheets |
| Vacuum system: filter, regulator, transducer, lines to the standby attitude indicator | 2.0, 2.0, 10.3 | poh 201; MM 37-10 Fig. 202 p709 |
| Pitot and static lines, static drain, lines to the GDC 74A | | MM 34-10 p688 (figs 690–697) |
| Engine sensors: fuel flow transducer, tach sensor, CHT/EGT probes, oil pressure and temperature senders | −22.6, −8.0, −12.0, −12.9, −8.5 | poh 202; MM 77/79 p921, p946, p951, p917, p885 |
| Power distribution module: alternator control unit, master and starter contactors, ammeter transducer (inside today's junction box) | −2.5, −2.0 | poh 197; MM 24 p379 (figs 381–382) |
| ELT transmitter (tailcone) | 135.5 | poh 198; MM 25 p448 (fig 450) |
| Elevator downspring | | MM 27-30 p494 (figs 503–506) |
| Wiring harnesses behind the panel and circuit breaker panel | | Wiring diagram manual (not found) |

### Cabin (low)

| Part | Arm | Source |
|---|---|---|
| Seat belts, shoulder harnesses, AmSafe airbags | 50.3, 87.8 | poh 198; MM 25 p404 (405–411), p412 |
| Hand fire extinguisher | 44.0 | poh 199; MM 26 p468 (469–472) |
| CO detector | | MM p458 |
| Cargo tie-down rings, baggage net, stowed tow bar | 95.0, 95.0, 124.0 | poh 198; MM p428 (429–434) |
| Control wheel map light; flood, glareshield and pedestal lights | 21.5 | poh 200; MM 33 p652–665 |

