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

## Visible on preflight (high priority)

| Part | Source |
|---|---|
| GPS/COM antennas on the cabin roof | MM 34-50 GIA 63 p727. The NAV/COM fig (p334) shows the pre-G1000 panel, so find the G1000 antenna figure |
| Engine cooling baffles and seals | PC "Intercylinder Cooling Baffles" pp 24–25; Cessna's cowl baffles are probably only in the IPC (not found) |
| Spark plugs | PC "Cylinder Related Parts and Spark Plugs"; MM 74 p894 (figs 895, 900–903) |
| Alternator belt | PC "Alternator Assembly and Belt" |
| Pitot and static lines, static drain | MM 34-10 p688 (figs 690–697) |
| Vacuum system: regulator valve, gyro filter, lines, transducer | MM 34-20 Fig 202 p709 (checked: G1000 version) |
| Crankcase breather and drain lines | MM 71 p868 (figs 869–872); PC "Breather Fitting" |

## Hidden mechanisms (medium)

| Part | Source |
|---|---|
| Elevator downspring | MM 27-30 p494 (figs 503–506) |
| Flap motor, actuator, bellcranks, push-pull rods; follow-up | MM 27-50 p517 (figs 518–520), p525 (526–530) |
| Cabin heat valve, heater and defrost ducts; fresh air | MM 21 p305 (306–310), p296 (297–303) |
| CHT/EGT probes, oil pressure and temp senders, tach sensor, fuel flow transducer | MM 77/79 p921, p946, p951, p917, p885 |
| Alternator control unit | MM 24 p379 (figs 381–382) |
| ELT transmitter (tailcone) | MM 25 p448 (fig 450) |

## Cabin (low)

| Part | Source |
|---|---|
| Seat belts, shoulder harnesses, AmSafe airbags | MM 25 p404 (405–411), p412 |
| Hand fire extinguisher | MM 26 p468 (469–472) |
| CO detector | MM p458 |
| Cargo tie-downs | MM p428 (429–434) |
| Flood, glareshield, pedestal and control-wheel map lights | MM 33 p652–665 |
