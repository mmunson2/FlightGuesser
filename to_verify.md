# To verify

Questions were written from `notecards_to_make.md` and checked against the
FAA sources and the POH copy cited in `i18n/questions.en.js`. This file
lists what needs a human check: where the notes and the sources disagree
(the questions follow the source), where only the school's notes back a
fact (source `school`), and the POH copy itself.

## Check against your airplane's POH

The POH used is a **2007 original-issue C172S NAV III with GFC 700
(172SPHBUS-00)**, a Civil Air Patrol copy. Verified by the user
(2026-11-24): V-speeds, short-field and balked-landing numbers, GFC 700
limits, KOEL lights (strobes required, beacon not), brakes (one master
cylinder on each of the pilot's pedals), and the GFC 700 keys on the PFD's
left edge. Still open:

- The glide distance of about 1.5 NM per 1,000 ft (`am-glide-ratio`). This
  POH's maximum glide chart is an image.

## The G1000 mock (js/g1000.js)

The live PFD/MFD and Operate mode follow the G1000 NXi and GFC 700 as I
remember the pilot's guides.

**No help on the screens** (2026-11-27): the displays show only what the
real unit would. Key hints, "not in the mock" notes and disclaimers are
not drawn. Where this file says a note or a hint shows, it is now kept
as data for a separate help UI: one-off notes in `state.note`, and each
frame's page and window hints in `G1000_DISPLAY.help('pfd' | 'mfd')`.
That includes the MINIMUMS note, why a greyed menu option doesn't work,
and the airspace name under an alert message. Softkey labels and the radio boxes' layout
were checked against the NXi in MSFS 2020. Check the rest against
Garmin's *G1000 NXi Pilot's Guide for the Cessna 172* (190-02520-xx) and
the GFC 700 AFMS:

- **GFC 700 logic**:
  - The FD comes on in ROL and PIT. ROL holds the bank if it is over 6°,
    and levels the wings if it is less.
  - The FD can't be turned off while the AP is engaged.
  - Pressing an active mode key returns to ROL or PIT.
  - A mode change flashes for 10 seconds.
  - AP disconnect with the AP key flashes a yellow "AP" for about 5
    seconds. An abnormal disconnect (PTRM, avionics bus 2 off) flashes AP
    red and white until acknowledged. With no AP DISC switch in the mock,
    the next AP key press acknowledges it (it doesn't engage on that press).
  - Losing a NAV mode for lack of guidance (no VOR signal, CDI source
    changed) flashes the lost mode in yellow in its slot for 10 seconds,
    then ROL shows in green.
- **NOSE UP/DN steps**: 0.5° in PIT, 100 fpm in VS, 1 kt in FLC (where
  nose up means slower), 10 ft in ALT (the reference moves).
- **Limits in the mock**: bank 22° in HDG and NAV, pitch −10° to +15°,
  VS ±1,500 fpm, FLC 55–120 KIAS. All are guesses.
- **ALTS**:
  - Arms in PIT, VS and FLC when the selected altitude is ahead.
  - The capture lead is |VS| ÷ 5 ft.
  - ALTS and ALT fly indicated (baro-corrected) altitude: changing BARO
    in ALT climbs or descends to keep the readout on the reference.
  - Changing the selected altitude during ALTS capture reverts to PIT,
    and ALTS arms again for the new altitude.
  - The selected altitude goes from −1,000 to 50,000 ft.
  - The real GFC 700 shows ALTS green during the capture, then ALT. Check
    those annunciations.
- **Altitude alerter**:
  - The box flashes 5 seconds at 1,000 ft out and again at 200 ft.
  - It turns yellow when off by more than 200 ft after reaching the
    altitude.
  - Its aural alert isn't modelled (the mock makes no sound).
- **NAV capture**:
  - Arms when off course by 7° or more.
  - Intercepts at up to 45°.
  - VOR full scale is 10°, at 2 dots.
- **Flight plans and Direct-To** (js/g1000-fms.js):
  - Entry: the small FMS knob picks the character under the cursor, the
    large knob moves the cursor, and the identifier completes from the
    database.
  - Direct-To takes ENT to accept the identifier, then ENT on ACTIVATE?.
    It defaults to the active waypoint.
  - In the FPL, push FMS for the cursor. The small knob inserts a
    waypoint before the selected row.
  - CLR on a waypoint asks "Remove?". Activate Leg is in the Page Menu
    (below).
  - The first leg becomes active by itself once the plan has two
    waypoints. Check what the real unit does.
  - A Direct-To to a waypoint in the plan continues with the plan after
    it.
  - Legs sequence when the waypoint is passed. There's no turn
    anticipation.
- **MFD page groups** (js/g1000-pages.js):
  - With no cursor out, the large FMS knob picks the group (MAP, WPT,
    AUX, FPL, NRST) and the small knob the page.
  - Each group returns to its last page.
  - The FPL key toggles the Active Flight Plan page and back.
  - Page names follow the NXi's MFD in MSFS 2020.
  - Working: Navigation Map, Airport Information, VOR Information, Trip
    Planning, Utility, Active Flight Plan, Flight Plan Catalog, Nearest
    Airports, Nearest VOR, Nearest Frequencies, Nearest Airspaces, and
    System Setup's airspace alert settings.
    The other pages are placeholders.
  - ENT on Nearest Airports opens that airport's information page.
  - ENT on Nearest VOR loads the frequency into the tuned NAV's standby.
  - Check both ENT behaviours against the real unit, which may go through
    a frequency field.
- **Page Menu (MENU key)** (js/g1000-menu.js):
  - MENU opens a PAGE MENU window of the page's or window's options.
    Either FMS knob moves the cursor (the guide may say the large knob
    only). ENT picks an option. CLR, MENU or an FMS push closes it.
  - The cursor starts on the first option that works. Options that are
    greyed out can be highlighted, and ENT says why they don't work.
    Check whether the real cursor skips them.
  - Options that change or delete something ask first (ENT: OK, CLR:
    back). The question wording is mine.
  - A page with no options shows "No options with this page". That
    includes the PFD with no window open and every page not listed below.
    Check the real menus of Airport Information, Trip Planning and
    Nearest.
  - Active Flight Plan (both displays): Activate Leg, Invert Flight Plan,
    Delete Flight Plan, Store Flight Plan, Insert Before/After, Change
    Fields, Closest Point of FPL and Parallel Track work. Select
    Departure/Arrival/Approach are grey. The real list is longer
    (airways), and its order is from memory.
  - Invert flies the reversed plan from its first leg. Delete keeps a
    Direct-To to a waypoint outside the plan.
  - Direct-To window: Cancel Direct-To NAV. It goes back to the plan's
    leg to the same waypoint, or else the first leg.
  - Navigation Map: Map Settings works. Measure Bearing/Distance and
    Show Chart are grey.
  - Utility: Reset Trip Statistics, Reset Odometer, Reset Flight Timer
    and Reset All. The page now shows the odometer and the trip figures
    (odometer, average and maximum ground speed) separately. Check the
    names.
  - Flight Plan Catalog (FPL group, second page): push FMS for the
    cursor. ENT or MENU on a plan gives Activate Flight Plan, Invert &
    Activate FPL, Delete Flight Plan and Delete All. On the real unit, ENT
    opens the stored plan to view or edit it. The catalog starts with
    two example plans (KPAE–KAWO–KBVS and KBFI–KPAE–KBLI). A real unit
    keeps whatever was stored.
- **Map Setup** (Navigation Map, MENU, Map Settings):
  - The large knob moves between the GROUP line and the settings. The
    small knob changes the value straight away. The real unit opens a
    list and takes ENT.
  - Groups: Map (Orientation: Heading/Track/North Up; Nav Range Ring),
    Aviation (Active FPL, Large/Medium/Small APT, VOR) and Airspace
    (Class B/TMA, Class C/TCA, Class D). Each range setting is the
    largest map range at which that symbol shows. Airspace defaults: B
    and C 100 NM, D 25 NM.
  - The settings apply to all three maps: the MFD map, the PFD inset and
    the HSI map. The real PFD maps have their own settings.
  - Airspace colours: B blue, C magenta, D blue dashed, as on the
    sectional. Check against the G1000's own symbols.
  - Track Up differs from Heading Up by the wind's drift.
  - Airport size goes by the longest runway: large from 8,100 ft, medium
    from 5,000 ft. Check the thresholds and whether hard surface counts.
  - The defaults (100 NM, small airports 50 NM) are scaled to the mock's
    100 NM maximum. The real ones are larger.
- **Tmr/Ref softkey** (js/g1000-timer.js): a window in the PFD's lower
  right.
  - Generic timer: UP or DN, START?/STOP?/RESET? on ENT. The small knob
    sets the time in whole minutes while the timer is stopped. A count
    down shows "Timer expired" at zero and then counts up. Check the real
    expiry behaviour and how the time is entered (the real unit may
    take hours, minutes and seconds separately).
  - The cursor opens on UP/DN. ENT from any field runs the timer's action.
  - References, each ON/OFF with an adjustable speed: Vglide 68, Vr 55,
    Vx 62, Vy 74 KIAS (this POH). When on, each shows as a cyan G, R, X
    or Y tag beside the airspeed tape. Check the real defaults, which
    Garmin sets per airplane, and how tags show when the speed is off
    the tape.
  - Minimums: OFF or BARO (no radar altimeter in a 172), in 10 ft
    steps. BARO puts a bug on the altitude tape and a BARO MIN box left
    of the baro setting. Both turn yellow below minimums, with a
    "MINIMUMS" note once on the way down. The aural alert and the
    100 ft-above cue aren't modelled. TEMP COMP isn't in the mock.
  - Page Menu: All References On, All References Off, Restore Defaults.
    Check the names.
  - The Tmr/Ref and Nearest softkeys light up while their window is
    open.
- **OBS softkey** (GPS only):
  - Needs an active leg or Direct-To.
  - Suspends sequencing on the active waypoint. The CRS knob then sets
    a course to and through it, starting from the leg's own DTK.
  - CRS push points the course straight at the waypoint.
  - The HSI shows "OBS" under the scale. The map draws the OBS course
    through the waypoint and 100 NM past it.
  - Turning OBS off returns to the plan's leg and sequences if the
    waypoint is already behind. The real unit may build the course
    differently. Check the "SUSP" annunciation too, which isn't drawn.
  - Direct-To, Activate Leg and loading a plan cancel OBS.
  - With a VOR CDI, the softkey says to use CRS.
- **Map/HSI softkey** → Layout → Map Off / Inset Map / HSI Map:
  - The inset sits in the PFD's lower left, heading up.
  - The HSI map is a heading-up map inside the rose, with the rose's
    edge at the range.
  - Both use the PFD's own RANGE knob, starting at 5 NM.
  - The real Map/HSI menu has more (Detail, Traffic, weather overlays).
- **Nearest Frequencies** (NRST group, page 6):
  - ARTCC: the two nearest center outlets, each frequency a row, under
    "SEATTLE CENTER".
  - FSS: the two nearest RCOs ("SEATTLE RADIO").
  - Weather: the three nearest ASOS/AWOS.
  - Each row shows bearing and distance to the outlet. ENT loads the
    selected frequency into the tuned COM's standby.
  - The real page lists one frequency per outlet in a different layout.
    Check it.
- **Nearest Airspaces** (NRST group, page 7):
  - Up to 12 Class B/C/D airspaces within 50 NM, one row per airspace
    (shelves grouped).
  - Status: INSIDE (within a shelf and between its floor and ceiling),
    ABOVE/BELOW (over or under the shelf you're inside laterally),
    AHEAD <10MIN (the straight-ahead track enters a shelf at the
    present altitude within 10 minutes), or else the distance.
  - ALT is the relevant shelf's floor and ceiling.
  - Also WITHIN 2NM and NEAR, AHEAD. The real page's wording may
    differ (e.g. "Ahead < 10 min").
  - Statuses use the altitude buffer from System Setup (below).
- **Airspace alerts** (js/g1000-alerts.js):
  - Checked once a second for the classes turned on in System Setup.
  - Messages, worded from memory of Garmin's list:
    - INSIDE ARSPC: "Inside airspace."
    - ARSPC AHEAD: "Airspace ahead -- less than 10 minutes."
    - ARSPC NEAR: "Airspace near and ahead."
    - ARSPC NEAR: "Airspace near -- less than 2 nm."
  - A message stays while its condition holds, one of each kind, for the
    nearest airspace with it. The mock adds the airspace's name under
    the message; the real one doesn't name it.
  - A new message turns the ALERTS softkey into a flashing ADVISORY
    (white and black). Pressing it acknowledges the message and opens
    the Alerts window in the PFD's lower right. Pressing ALERTS again
    or CLR closes the window.
  - Check: the advisory colours, whether the real unit also sounds a
    tone, and the exact "ahead" and "near" rules (here, the track
    straight ahead for 10 minutes at the present speed, and 2 NM
    laterally at an altitude inside the buffered band).
  - The airplane starts at 3,500 ft north of Seattle, so an advisory may
    flash right away.
- **Annunciations** (js/g1000-systems.js, js/g1000-alerts.js). These
  follow this POH: section 7, "G1000 annunciator panel", and the
  electrical, oil, vacuum, fuel and CO pages.
  - The eight annunciations, in the window right of the VSI:
    - OIL PRESSURE: red, at 20 PSI or less.
    - LOW VOLTS: red, main bus under 24.5 V.
    - HIGH VOLTS: red, a bus over 32.0 V.
    - CO LVL HIGH: red, 50 PPM or more.
    - LOW FUEL L and LOW FUEL R: amber, under 5 gal for more than 60 s.
    - LOW VACUUM: amber, under 3.5 inHg.
    - STBY BATT: amber, standby battery discharging over 0.5 A for 10 s.
  - A new one flashes. The ALERTS softkey becomes a flashing WARNING (red)
    or CAUTION (amber) until pressed. Each press acknowledges one level,
    warnings first, then ADVISORY for messages.
  - The POH's tones (CO, low fuel) aren't modelled. Check the flashing
    and the exact softkey behaviour against the CRG.
  - Reaching them:
    - LOW VOLTS comes on by itself below 1,000 RPM (the POH's note).
    - LOW FUEL comes on as the tanks burn down.
    - Both tanks dry stops the engine: no thrust, oil pressure or
      alternator.
    - The rest need a failure from the Failures list in Operate mode:
      alternator, overvoltage, oil loss, vacuum pump, left tank leak, CO
      leak, pitch trim. Choosing a failure again fixes it. Reset flight
      fixes everything.
  - The systems model, made up but in the POH's direction:
    - Alternator off: the main battery runs the bus from 24 V down to
      20 V in about 35 minutes (the POH says only "a short time"). Then
      the standby battery takes the essential bus, giving STBY BATT.
    - Overvoltage: 32.6 V for 3 s, then the ACU trips the alternator
      (HIGH VOLTS, then LOW VOLTS).
    - Oil loss: pressure falls to 5 PSI as oil temperature rises.
    - CO builds to 120 PPM over about 40 s.
    - The left leak drains 20 gal/h. The fuel selector is BOTH.
  - The EIS reads these. Since the audit (2026-11-27) its layout follows
    this POH's section 7 ("Engine Instruments", "Fuel Indicating
    System", "Electrical System Monitoring"); see **EIS** below.
  - PTRM (pitch trim fault): red, under the autopilot mode strip. The AP
    disconnects and won't engage again, as the POH's procedure says.
  - MAXSPD: amber, flashing, under the strip. With the AP engaged, the
    nose comes up to hold Vne − 5 (158 KIAS). Check where the real one
    shows and the speed it protects.
- **Standby instruments** (js/g1000-standby.js): live faces drawn over
  the 3D airspeed, attitude and altimeter, following the simulation (and
  so the autopilot).
  - They cover the model's own fixed needles.
  - The dial layouts are mine, not the real instruments'. The airspeed
    arcs are the POH's.
  - The attitude indicator is vacuum-driven: below 3.5 inHg the red GYRO
    flag shows, as the POH says, and the ball drifts up to 25° of bank
    and 8° of pitch off. The drift is made up.
  - The altimeter has its own Kollsman setting, 30.12 from the start.
    STD BARO on the PFD doesn't change it.
  - Its knob works in Operate mode (scroll or drag, 0.01 inHg a click).
    Only the knob responds, not the dial.
  - The magnetic compass: the card in its window (ticks every 5°, N E S
    W and 3, 6, 12... every 30°), read from behind, so headings to the
    right of the lubber line are lower. The card is physics, not rules:
    it lies square to the apparent gravity and points along the earth's
    field (dip 69° for Washington, from memory) in that plane. That gives
    about 34° of lag turning through north and lead through south at 15°
    of bank (UNOS), and about 15° toward north accelerating at 2 kt/s on
    east or west (ANDS). Its swing (2.2 rad/s, damping 0.35) is made up;
    check it doesn't swing more than a real one. No deviation is modelled;
    the deviation card under it is FlightGear's (its numbers are theirs).
- **Panel switches** (js/g1000-switches.js, js/g1000-systems.js), flipped
  by clicking in Operate mode:
  - MASTER ALT/BAT interlocked as a split rocker (ALT on pulls BAT on,
    BAT off takes ALT off). ALT off: no alternator, the battery carries the
    load. BAT and ALT off: the main bus is dead.
  - STBY BATT: a click goes ARM ↔ OFF; scrolling down from OFF goes to
    TEST, which springs back to OFF after 1.5 s and lights the green test
    lamp if the standby battery is over half charged (threshold made up).
    In OFF the standby battery doesn't take the essential bus.
  - Which unit is on which bus is from the breaker panel's rows: PFD on
    the essential bus or avionics bus 1; MFD, audio panel and autopilot on
    avionics bus 2 (turning it off disconnects the AP). Check: with BUS 2
    off, does the real PFD revert or stay as it is? Here it stays.
  - Loads on the main bus (amps, made up): base 10, beacon 1.5, landing
    7, taxi 7, nav 2, strobe 2, pitot heat 9. They only show with the
    alternator off (the battery drains faster).
  - Rocker angles: FlightGear's on (-37°), but off at -20° (FlightGear's
    0° sticks out too far). The lights don't light the exterior lights.
  - FUEL PUMP, CABIN PWR 12V and the ELT's remote rocker (ARM/ON) flip
    but do nothing yet: procedure practice only. All start off / ARM.
    ELT ON flashes its red lamp (0.6 s lit every second; check the real
    rate).
  - The ignition key turns like a G1000 knob (scroll or drag): OFF, R,
    L, BOTH, START. OFF stops the engine; back on, it runs again at once
    (the windmilling propeller; no starter model). One magneto drops the
    RPM: R 70, L 55 (made up, inside the POH's 150 max and 50 between).
    START springs back to BOTH after 1.5 s.
  - Throttle and mixture: drag along the shaft (toward the panel pushes
    in) or scroll (up: in, 5% a notch); Page Up/Down and Home/End still
    work. Travel about 8 cm, knob 1.5 cm off the panel fully in (made up
    from the model, which draws them pulled right out). No mixture vernier
    lock button: it slides freely.
  - CABIN HT and CABIN AIR pull out the same way (drawn pushed in, closed;
    6 cm of pull, made up). They do nothing yet: procedure practice.
- **PFD Opt → ALT Units** (Meters, IN, HPA):
  - Meters adds metric boxes under the altitude readout and beside the
    selected altitude. The real overlay may sit elsewhere.
  - HPA shows the baro in hectopascals, and the BARO knob then steps
    1 hPa.
- **Transponder**:
  - A green R beside the mode while replying. The mock simulates a radar
    sweep every 4.8 s.
  - The Flight ID (N172SP to start) is set on AUX - System Setup: ENT on
    it, then the FMS knob as for an identifier. Up to 6 characters in
    the mock. The real unit sets it in configuration or on the XPDR
    menu, depending on the installation. Check yours.
- **Volume knob pushes**:
  - COM pushes turn the automatic squelch off, showing "SQ" by the COM
    label.
  - NAV pushes turn the Morse identifier on, showing "ID" by the station.
  - Both act on the radio being tuned. With no audio, the annunciation
    is all they do. Check where the real unit shows these.
- **More setup windows** (generalised from Map Setup):
  - Map Setup gains Track Vector (Off, 30 s – 20 min: a dashed line to
    where the airplane will be), APT Text and VOR Text (the range up to
    which identifiers show).
  - PFD Map Settings: the PFD's Page Menu with the inset or HSI map on.
    The PFD maps have their own copy, with text decluttering sooner (APT
    7.5 NM, VOR 25 NM). The inset can be north up; the HSI map is always
    heading up.
- **Flight plan Page Menu**:
  - Insert After / Insert Before: where the small knob's new waypoint
    goes relative to the selected one. Before by default. Check the
    real default. "INSERT AFTER" shows in the window when on.
  - Change Fields: the three data columns, from DTK, DIS, CUM, ETE,
    ETA and FUEL.
    - ETE is the leg's time at the present ground speed.
    - ETA and FUEL (left on arrival) run from the airplane along the
      route, for the active waypoint onward.
  - Restore Defaults: DTK/DIS/CUM and Insert Before.
- **Utility** also shows the generic timer and minimums from Tmr/Ref
  (read-only).
- **Messages** (Alerts window), besides the airspace ones above:
  - WPT ARRIVAL "Arriving at waypoint": 10 seconds or less to the active
    waypoint, not in OBS.
  - TIMER EXPIRD "Timer has expired.": a count-down timer reached zero.
    It replaces the mock's old note.
  - DATABASE EXPIRE "Navigation database has expired.": from 28 days
    after the NASR cycle (29 Oct 2026, so from 26 Nov 2026), by the
    computer's real date. Rebuild with `make fetch nav` for a new cycle.
  - Hardware-fault messages are left out on purpose.
- **AUX - System Setup** (AUX page 4): only the Airspace Alerts box.
  Altitude buffer 0–1,000 ft in 50 ft steps (default 200), and Class
  B/TMA, C/TCA and D alerts on or off (all on). Push FMS for the cursor,
  large knob for the item, small knob to change it. Check the real
  defaults and step size. The rest of the page isn't modelled.
- **PFD Nearest softkey**: opens a Nearest Airports window. Push FMS for
  the cursor; D→ offers the selection.
- **Fuel**: 48 gal usable at start, burning at a made-up fuel flow (from
  power, altitude and the mixture, not the POH). Trip Planning uses the
  present ground speed, wind included.
- **GPS CDI scale**: ENR 2.0 NM full scale; TERM 1.0 NM within 31 NM of
  the plan's departure or destination airport. The 0.3 NM approach scale
  isn't modelled.
- **GPS NAV**: captures within full-scale deflection, else arms.
- **Volume**: turning a volume knob shows a percentage in place of the
  standby frequency for 2 seconds.
- **Database** (data/wa-nav.js, built by build/wa_nav.py from FAA NASR,
  cycle effective 29 Oct 2026):
  - Covers Washington's 117 open public-use land airports, their
    runways, VHF frequencies (CTAF, UNICOM, tower, ground, clearance,
    ATIS, ASOS/AWOS, approach), and the 16 operational VORs.
  - Also the state's center outlets (RCAG, low-altitude frequencies
    only), flight service outlets (RCO) and ASOS/AWOS stations, all from
    FRQ.csv, for Nearest Frequencies.
  - Positions are surveyed, so the mock is accurate as of that cycle. It
    goes out of date every 28 days; rebuild with `make fetch nav`.
  - Left out: private fields, heliports and seaplane bases, NDBs,
    intersections, and airports over the state line.
- **Airspace** (FAA ADDS Class Airspace layer, downloaded 25 Nov 2026,
  cut to Washington's box):
  - Class B, C and D shelves in WA, OR and ID. Canadian airspace is
    left out.
  - Outlines are simplified to about 40 m.
  - Floors and ceilings are MSL. A shelf whose floor is the surface shows
    SFC. A few Canadian-style AGL floors are kept as numbers.
  - "VANCOUVER CLASS C" is Vancouver's airspace over Point Roberts, WA.
  - TPA is AGL in NASR. The page shows field elevation + TPA as MSL.
    Many towered fields publish none.
- **Magnetic**: everything the pilot sees or sets is magnetic: heading,
  bug, HDG mode, DTK, TRK, and the bearings on every page.
  - Local variation is an inverse-distance mean of the four nearest
    airports with NASR variation from 2010 or later. About 16.3°E at the
    start; 14°E at Spokane.
  - 74 of the 117 airports still carry 1985 figures, about 20°E. Those
    are stale and not used.
  - VOR radials and courses use the station's declared variation:
    PAE 20°E (1990), SEA 19°E (2000), and so on.
  - So a VOR course and a GPS DTK to the same point differ by a few
    degrees, as in a real airplane. Check this against a VOR receiver
    check or the Chart Supplement.
  - Not modelled: the variation's yearly drift, and the compass's own
    errors.
- **Simplified**:
  - The airplane's kinematics and the systems model's rates are made up.
    The annunciation thresholds are the POH's.
  - The wind is one steady vector at every altitude (the Wind list in
    Operate mode), with no gusts or shear.

### Section 2 additions (written from memory of the pilot's guide)

- **Wind**:
  - Ground speed and track include the wind: GS and TRK on the MFD, the
    track vector, Trip Planning, ETE/ETA, the Utility odometer, and the
    airspace "ahead" check. A magenta diamond on the HSI rose marks the
    track.
  - GPS and VOR NAV steer by track, so they crab into a crosswind.
  - The PFD's wind window (PFD Opt, Wind): Option 1 is head/tail and
    crosswind components with arrows; Option 2 is an arrow relative to the
    nose plus speed; Option 3 is the arrow plus direction (magnetic) and
    speed. Check the layouts, and whether Option 3's direction is
    magnetic or true.
  - "NO WIND DATA" under 30 kt TAS is a guess at the real threshold.
  - The window sits left of the HSI, at x 306, so it clears the inset
    map. The real position differs.
- **Bearing 1/2** (PFD Opt):
  - Each press cycles Off, NAV, GPS, Off. ADF is skipped.
  - The pointers are cyan, BRG1 a single line and BRG2 a double. Their
    info windows (distance, ident, source) sit at the HSI's lower left
    and right.
  - With nothing received a window shows NO DATA. The VOR range is the
    mock's flat 60 NM.
- **DME** (PFD Opt):
  - The window shows its tuning, frequency and slant range.
  - Only VOR/DME and VORTAC stations (NASR's kind) give a distance.
  - The ADF/DME softkey cycles the DME tuning between NAV1, NAV2 and HOLD.
    On the real unit it opens a tuning window.
- **Map pan and Measure**:
  - Pushing RANGE on the MFD's Navigation Map or FPL page brings out a
    pointer. With it out, the arrow keys move it an eighth of the range
    per press, standing in for the joystick. The map centres on the
    pointer.
  - ENT on empty map makes a user waypoint; on a waypoint it names it.
  - D→ offers the waypoint under the pointer.
  - CLR stops measuring, then puts the pointer away.
  - Measure Bearing/Distance (Page Menu) measures from where the pointer
    was when you picked it.
  - The PFD inset map can't be panned.
- **Parallel Track** (FPL Page Menu): a setup window with Direction,
  Distance (1–50 NM) and On/Off.
  - It offsets the active leg sideways. A Direct-To or OBS isn't offset,
    and the option is grey with one.
  - Corners aren't joined. The real unit's transition legs aren't
    modelled.
- **Closest Point of FPL** (FPL Page Menu): type a reference waypoint,
  and ENT shows the bearing and distance from it to the plan's closest
  point. ENT again saves that point as a user waypoint.
  - Check whether the real unit names it after the reference, and
    whether it inserts it in the plan. The mock only saves it.
- **User waypoints**:
  - Names default to USR001, USR002 and so on.
  - Made with WPT – User WPT Information's Page Menu (at the present
    position), at the map pointer, or as a closest point.
  - On the page, the large knob moves between name, REF WPT, radial and
    distance. The small knob steps 1° or 1 NM. ENT renames, or picks the
    reference.
  - One in a flight plan, Direct-To or stored plan can't be deleted or
    renamed.
  - Shown on maps as small cyan squares, with the small airports.
  - Nearest User WPTs lists those within 200 NM.
- **GPS Status (AUX)**: the constellation is made up: twelve satellites
  plus two WAAS. EPU 0.02 NM, HFOM 25 ft and VFOM 33 ft are typical
  values, not computed.
- **LOI** (Failures, "GPS integrity"):
  - There is no GPS course: the CDI shows LOI in amber, and GPS NAV drops
    to ROL.
  - An LOI message appears, and GPS Status shows LOI with three
    satellites.
  - Dead reckoning (the NXi's DR mode) isn't modelled.
- **Mixture, Lean page, totalizer**:
  - The mixture's keys are Home (richer) and End (leaner). The mock
    starts leaned for best power at 3,500 ft.
  - Full rich at sea level is 1.35 × the peak-EGT mixture, richer with
    altitude.
  - EGT falls 500 °F per unit rich of peak and 700 lean of it. Cylinder 2
    runs leanest and peaks first. CHT tracks EGT.
  - Leaning below 0.55 × peak stops the engine. All of these numbers are
    made up.
  - Lean softkeys: Cyl Slct shows the next cylinder's numbers for 10 s
    (the POH says "a short time"; made up), then the page goes back to
    the hottest. Assist marks the first cylinder to peak with a hollow
    bar and shows PEAK °F (now minus its peak, negative either side).
  - The System page's CALC FUEL shows GAL USED and GAL REM. Its softkeys
    are Rst Fuel (53 gal, full usable), Dec Fuel and Inc Fuel (1 gal),
    and Rst Used.
  - The totalizer counts from the fuel flow alone, so a leaked tank
    shows as a difference from TANKS. Check the softkey names and steps
    against the NXi.
- **Checklists** (MFD Checklist softkey):
  - The lists are transcribed from the POH (2007), sections 3 and 4,
    amplified procedures excluded. Every emergency and abnormal list is
    in one Emergency group.
  - Check the wording against the airplane's own POH, especially:
    - two-line responses joined with " / ";
    - degree signs restored where the PDF text garbled them;
    - shortened WARNING/NOTE boxes.
  - ENT checks an item and moves on. CLR unchecks. The Emergency softkey
    jumps to the group; Exit closes.
  - The real NXi's checklist editor and its own Cessna checklist content
    may differ.
- **No sound**: the mock makes none, so there are no aural alerts.
- **Audio panel** (GMA 1347D, js/g1000-gma.js): the keys work and a green
  triangle lights over each key that is on. The mock makes no sound, so
  this is the selection logic only. Behaviour from memory:
  - Power-up: COM1 MIC and COM1 on, everything else off. Check what the
    real unit restores.
  - COM1/COM2 MIC: one transmits at a time. Its receive comes on with it,
    and the other COM's receive stays as it was. The PFD's green COM
    frequency follows the MIC selection; it used to follow the COM knob's
    tuning.
  - The transmitting COM's receive key does nothing (a note says why).
  - COM 1/2 (split) sets COM1 MIC with both COMs received. PA lights
    instead of the COM MIC keys.
  - COM3 MIC, COM3 and TEL: not installed in the C172S, so they do
    nothing. Check that's true of the airplane.
  - PILOT and COPLT each toggle their own isolation (both lit = CREW).
    The real unit's ICS modes may cycle differently.
  - PLAY lights for 4 s. Pressing it again stops it.
  - Volume knob: small knob is intercom volume (push to switch pilot or
    passengers); large knob is squelch, which works only with MAN SQ on.
    Check which half is which.
- **Display backup (reversionary mode)**: the red DISPLAY BACKUP button
  under the audio panel toggles it.
  - Both displays show the PFD with the engine strip (EIS) down the left
    side. The PFD's left 140 px are cropped and the rest squeezed 7%; the
    OAT moves into the strip. The real layout is arranged, not squeezed.
  - The MFD's keys and knobs work the PFD. Check what the real MFD bezel
    does in reversion.
  - The PFD's first softkey becomes Engine, giving the Engine, Lean and
    System pages. Pressing the button again restores both displays and
    the PFD's own softkeys.
  - Not modelled: automatic reversion when a display fails, and the MFD's
    pages (map, checklist) while reverted.
  - The button's geometry is merged into the volume knob's part in the
    model: in the quiz it is named as that knob. In Operate mode, a click
    below the knob is the button.

### EIS audit (2026-11-27, against this POH's section 7)

The EIS was first drawn from memory with one generic bar per value
(label, number, bar, pointer). That gave two fuel gauges, numbers on the
ENGINE page, and several wrong bands. Now, from the POH:

- **Every page**: the tachometer at the top (0–3,000 RPM; green 2100 to
  2500 below 5,000 ft, 2600 to 10,000 ft, 2700 above; red 2700–3000;
  pointer, value and label red from 2780, value and label flashing). At
  the bottom, M BUS E (main and essential volts, VOLTS between them) and
  M BATT S (main and standby battery amps, AMPS between them).
- **ENGINE page**: pointers only. FFLOW GPH 0–20 with 2 GPH ticks, green
  0–12. OIL PRES 0–120, red 0–20, green 50–90, red 115–120 (nothing
  between the bands; there was a made-up yellow). OIL TEMP 75–250, green
  100–245, red 245–250 (no yellow below 100). EGT 1250–1650 with 50 °F
  ticks, the hottest cylinder's number in the pointer. VAC, green
  4.5–5.5.
- **FUEL QTY GAL**: one scale, the L pointer above it and the R pointer
  below. Red line at 0 (1.5 gal unusable left), yellow 0–5, green 5–24.
  The sensors read no higher than about 24 gal, so a fuller tank shows
  24. Under 5 gal the pointer and label turn amber; at empty, flashing
  red. Also on the LEAN and SYSTEM pages.
- **LEAN page**: FFLOW GPH as a number, EGT and CHT for the four
  cylinders, the hottest in cyan, its EGT °F and CHT °F, and PEAK °F with
  Assist. CHT is red from 500 °F.
- **SYSTEM page**: the numbers behind the ENGINE page (FFLOW GPH, OIL
  PSI, OIL °F, EGT °F, VAC), FUEL QTY GAL, GAL USED, GAL REM and ENG HRS.
  ENG HRS starts at 1847.3 (made up) and counts while the engine runs.
- **Back to ENGINE**: from LEAN or SYSTEM, the page and softkeys return
  to ENGINE on an exceedance: 2780 RPM or more, oil pressure 20 PSI or
  less or 115 or more, or oil over 245 °F. A stopped engine counts (no
  oil pressure).

Still to check against the real unit (the POH doesn't say):

- The fuel scale's numerals (0, 10, 20, F here) and where F sits.
- Which numbers the SYSTEM page lists, and their order. The POH puts ENG
  HRS on the ENGINE page's list; here it is on SYSTEM.
- How the LEAN page draws CHT. Here it's a bar across each cylinder, on
  its own 100–500 °F scale.
- The System page softkeys. This POH (2007) says GAL REM, then
  adjustment softkeys, and RST USED. The mock keeps Rst Fuel, Dec Fuel,
  Inc Fuel and Rst Used (the NXi's, from memory).
- The POH shows the EIS on the PFD during engine starts. The mock always
  shows it on the MFD.

PFD items added in the audit, from the same section:

- Reference marks every 45° round the HSI's compass card.
- An altitude trend vector: a magenta line on the altitude tape's left
  edge, to where the altitude will be in 6 seconds.
- Not added: the red pitch chevrons that point back to level flight
  past the pitch limits. The mock's airplane doesn't reach those
  attitudes.

### Accuracy fixes (2026-11-27, branch g1000-inaccuracies)

From an audit of the mock against this POH and the pilot's guides.
From the POH:

- Roll scale: the roll pointer is slaved to the airplane symbol (fixed
  at top centre); the arc, its ticks and its zero mark turn with the
  horizon. The slip/skid marker is a white trapezoid under the pointer
  (always centred: the mock flies coordinated).
- HSI: no red X when the VOR has no signal; the deviation bar simply
  isn't drawn.
- LEAN page: the hottest CHT's bar is cyan, apart from the EGT cylinder
  selection.

From memory (check):

- STD BARO shows only after the STD Baro softkey; a 29.92 dialled with
  the knob reads 29.92IN, and turning the knob ends STD BARO.
- CLR no longer goes back a softkey level (only Back does).
- The airspeed readout shows dashes below 20 KIAS.
- The altitude readout's last two digits move in 20 ft steps.
- The time is in its own box right of the transponder, as UTC hh:mm:ss.
  Check the label (LCL/UTC) and whether the NXi shows seconds.
- WPT ARRIVAL's text names the waypoint: "Arriving at waypoint -[KAWO]".
- PTRM and MAXSPD boxes moved right of centre, off the now-fixed roll
  pointer. Where the real ones show is still open (see MAXSPD above).

### Small additions (2026-11-27, branch g1000-quick-features)

From the POH: the VSI's notch on its right edge at 0 ft/min.

From memory (check):

- FLC puts a cyan bug on the airspeed tape at the reference speed (at
  the tape's end when off it), as well as the speed above the tape.
- GPS past full scale: "XTK n.nnNM" in the HSI under the airplane, in
  magenta. Check the colour and place.
- Flight plan window: the origin / destination line under the title;
  the active leg as a magenta bracket from the FROM waypoint to the TO
  waypoint, ending in an arrow. A Direct-To still shows D→.
- XPDR code by the FMS knobs (with the Code softkeys out): the small knob
  sets the first two digits, the large knob the last two (each pair
  00–77), ENT sends it. A digit softkey after that starts over.
- PFD Nearest Airports: two lines per airport. The second has the
  frequency (TWR if towered, else CTAF, else UNICOM) and the longest
  runway. The cursor stops on the identifier (D→ offers it) and then the
  frequency (ENT puts it in the tuned COM's standby). Check which
  frequency the real window lists and what else is on the row.
- AUX - System Setup, NAVIGATION, GPS CDI: AUTO, 2.0, 1.0 or 0.3 NM. A
  selected scale is used when it is tighter than the flight phase's
  (ENR 2.0, TERM 1.0); the HSI still shows ENR or TERM. Check what the
  HSI shows with a selected scale.

## The engine model

The engine is a generic four-cylinder CAD model, not a true IO-360. The 15
engine questions (`en-*`) use PHAK chapter 7 and the POH (8-quart sump,
engine-driven fuel pump failure). Things to check against a real engine:

- The parts I named from the model's shapes: oil sump (with the intake
  tubes running through it), fuel injection lines, accessory case.
- The colours are typical, not your airplane's.

## Parts drawn from the maintenance manual

The firewall, engine mount, exhaust (risers, muffler, heat shroud),
batteries, brake master cylinders and lines, fuel system and tanks, sump
drains, static port, static wicks, OAT probe, stall warning, G1000 units and engine accessories follow the Cessna Model 172 Maintenance Manual's drawings
(`build/extras.py` cites each figure). The manual gives where things go,
not most sizes, so check against your airplane:

- **Static port**: the manual and POH say left side of the fuselage, ahead
  of the door (the POH checks it at the nose). Drawn at FS 20, just ahead
  of the forward door post; the station and height are my guesses.
- **Fuel strainer**: on the front lower left of the firewall, its drain
  through the bottom of the cowling. The POH says "bottom of fuselage".
- **Wing sump drains**: five per tank, placed from the manual's
  under-wing drawing, inside the fuel bay. The front spar position is an
  estimate.
- **Main battery** sizes, the **power junction box** directly above it at
  the firewall's outboard edge (with the external power receptacle), and
  the **standby battery** behind the PFD (POH arm 11.2, 2026-11-25).
- **Engine mount**: a triangulated frame with a dynafocal cup at each
  engine mount (MM 71-20-00 Figs. 201, 202). The four firewall bolt spots
  are estimates.
- **Brake lines**: the manual shows them under the floor and out the
  skin to each gear leg; the exact routing is simplified.
- **Fuel system under the floor** (MM 28-20-00 Figs. 201, 204, 206): the
  reservoir under the copilot's footwell, the selector valve under the
  pedestal, the auxiliary pump and shutoff valve between the reservoir and
  the firewall. Since 2026-11-25: two supply lines per tank (the forward
  outlet down the front door post (following the post's rake up to the
  front spar; until 2026-11-25 it ran up the windshield's edge), the aft one down the rear door post and
  forward under the floor); the return line from the fuel servo to the
  reservoir with its check valve (POH Fig. 7-6); the shutoff valve by the
  copilot's pedals; a taller, longer reservoir. Sizes and exact spots are
  estimates. The selector valve sits straight under its handle; the
  manual's floor plate (230FT) may put it 3–5 in further forward.
- **G1000 units** (moved 2026-11-25 to the POH equipment list's arms,
  Fig. 6-9): the GIA 63s and GTX 33 on edge at FS 107–120 (GIA arm
  113.3), above baggage area 2; the fan in a plenum at the rack's left end
  (arm 109.0); the GRS 77 and GDC 74A side by side aft of the rack, at FS
  128–136 (GRS arm 134.0; the list gives the GDC 74A 11.4, which looks
  copied from the GEA 71). Unit sizes are estimates. The GEA 71 sits under
  the MFD, forward of the panel. The GMU 44 magnetometer is in the left
  wing at WS 122 (access plate 520HB) and FS 52.7 (POH arm).
- **Stall warning**: the scoop at WS 91 on the left wing's leading edge
  (the manual's number); the reed horn inside the wing root above the
  left door post, out of sight (the student, 2026-11-25: no horn shows in
  the 172S cockpit; the manual installs it "into the wing through the
  upper door post shield").
- **Engine accessories**: oil cooler on the left rear baffle (a vertical
  core about 7 × 7 × 2.5 in, since 2026-11-25), starter at the front lower
  left (both from the manual's text), oil filter and vacuum pump on the
  accessory housing, and the starter ring gear behind the spinner (held to
  FlightGear's spinner size, smaller than a real one). The filter and pump
  positions on the housing are my reading of Lycoming's parts catalog, not
  measured; which pad the vacuum pump uses isn't settled.
- **Engine on the propeller axis** (2026-11-25): the crankshaft was 1.9 in
  below FlightGear's spinner. It is now on the spinner's axis. The cowling
  has no room to raise the whole engine, so the CAD engine is squeezed
  above the crankshaft and stretched below it within its old outline.
- **Fuel tanks** (2026-11-25): each wing's fuel bay fills the wing between
  the skins from WS 31.38 to 65.125 (the manual's text; its drawing's 23.62
  and 71.62 are the skin panel's ends), from the front spar to a rear spar
  26 in aft of it (my estimate). FlightGear's wing is thinner and shorter
  in chord than a real one, so the drawn bay holds about 15 gal, not 28. One **fuel quantity
  sender** per tank, drawn on the bay's inboard rib; the manual's sender
  drawing is the non-G1000 one, so check the count and spot.
- **Static wicks**: two at the outboard end of each aileron (close
  together) and each elevator half (the inner one about 19 in in), and two
  on the rudder (near its top and low), as the manual's drawing shows.
  Their length (13 cm) is an estimate.
- **OAT probe**: on the cabin roof at FS 41.5, the POH arm for the G1000's
  GTP 59 probe (the manual's FS 46.46 is the older probe's). Drawn on the
  centreline; check the spot.
- **Wing struts, nose gear torque links, rudder cables** are FlightGear's
  shapes, now separate parts (they were part of the fuselage, nose strut
  and rudder). The rudder cables are only the stubs at the tail.
- **FlightGear corrections** (2026-11-25, `geometry_audit.md`): the landing
  gear moved 6.3 in aft to the POH's wheel arms (main 58.2, nose −6.8);
  the cowling's old strut opening is closed and a new one cut in the belly
  where the strut now passes. The wings are 5 in shorter per side, to the
  172S's 36 ft 1 in span. The transponder antenna moved aft to its POH
  arm (FS 86.3). FlightGear's belly ADF antenna is dropped (the POH lists
  the ADF as optional; the student's airplane has none, 2026-11-25).
- **Engine size and the dipstick** (2026-11-25): the CAD engine was ~11%
  short of the IO-360-L2A (Lycoming: 29.81 in long, 33.37 wide; the older
  notes had read the IO-360-B1C's row). It is now stretched to those, its
  propeller flange still at the spinner, so its back end sits 6 cm
  closer to the firewall. FlightGear's dipstick stays where FlightGear
  put it, now level with the magnetos, with a filler tube drawn from the
  crankcase's right rear. Check the dipstick against your airplane:
  right side, near the back of the engine, under the oil door. To fit
  the longer engine, the battery moved 4.5 cm outboard and the oil
  cooler sits lower (it had poked 2 cm through the cowling).
- **Induction air** (MM 71-60-00 Fig. 201): the filter in the chin inlet
  under the spinner, the filter box behind it, and the duct under the
  muffler to the elbow under the fuel servo. The alternate air door is
  on the filter box's aft wall beside the duct (the manual's Detail A).
  Sizes are estimates.
- **Nose gear mounting** (MM 32-20-00 Fig. 202): with the gear at the
  POH's arms, the strut's top meets the firewall in an upper fitting, with
  the clamp and bottom fitting below it. The shimmy damper is on the
  strut's right side (the manual's drawing), from the steering collar's
  arm up to a lug; the steering tubes run from the collar through the
  firewall to the rudder bars. Sizes and the bar ends are estimates.
- **Belly fuel drains**: the fuel reservoir, selector valve and strainer
  quick drains are separate parts now, each straight below its
  component. The POH names all three. The manual shows the reservoir and
  selector drains together just aft of the firewall, so check their exact
  spots. New question `ap-belly-drains` asks for the reservoir and
  selector drains; `ap-strainer-drain` now asks for the strainer's drain.
- **Flight control cables** (MM chapter 27, each system's Fig. 201): the
  routes follow the manual's drawings, but it gives no pulley stations,
  so the pulleys sit at the bulkheads each drawing shows. The control
  column is a U whose arms drop from the wheel shafts to a cross tube with
  the aileron cable drum. Aileron cables run down from the drum, aft under
  the floor, outboard and up the rear door posts (2026-11-25; they had
  gone up the front posts), and out the rear spar to the bellcranks on
  the bottom wing skin, whose push rods reach the ailerons; the carry-thru
  runs across the cabin top. Elevator cables run under the floor and up
  the tailcone to the aft bellcrank on the elevators' hinge line. Trim
  cables climb to mid-height at the FS 178 bulkhead and cross to the
  actuator in the right stabilizer. Rudder cables run beside the
  centreline to FlightGear's stubs at the tail. Cables are drawn about
  twice their real 1/8 in so they can be seen.
- **Behind the panel** (2026-11-25): the PFD and MFD housings and the
  audio panel's rack use Garmin's published sizes; the three cooling fans'
  spots come from a manual drawing of an older panel. The standby battery
  moved an inch forward to clear the PFD housing, and the GEA 71 now lies
  just below the MFD housing.
- **Flaps** (2026-11-25): the motor is in the right wing (the manual's
  schematic and access panel 610GB), at about WS 76, with the drive
  pulleys at about WS 63; both stations are read off the manual's access
  panel drawing. The cables cross the cabin top above the headliner. The
  follow-up cable's route from the headliner to the flap lever is my
  guess (down the right forward door post).
- **XM antenna** (2026-11-25): the POH gives its arm (43.5) and "top of the
  cabin", not its side or size. It's drawn on the centreline just aft of
  the OAT probe: where is the white teardrop on your airplane's roof?
- **Cabin heat and air** (2026-11-25): the shutoff valve on the engine
  side of the firewall, the plenum behind the panel, floor outlets at its
  ends, defroster outlets under the glareshield, the fresh air door on the
  right side ahead of the door, and ducts from each wing root to a
  mid-torso outlet and a rear overhead outlet. The manual shows what
  connects to what, not where: check the outlets' spots in your airplane
  (where are the floor heat outlets, the defroster slots, and the vents
  for the front and rear seats?).
- **Engine fuel parts from the CAD model**: the fuel manifold (spider) on
  top, the four injector lines, the servo under the engine and the lines
  between them were fused into the crankcase and servo solids; they are
  now separate parts, split by their CAD faces. Their routing is the CAD
  designer's, not a real IO-360's.

## Notecard errors, corrected in the questions

- **Sea and land breeze** (`wx-sea-breeze`): the notes have the directions
  backwards. A sea breeze blows onshore, from sea to land, by day. A land
  breeze blows offshore at night (PHAK ch. 12).
- **Taxiway centerline lights** are green, not yellow. The yellow is the
  painted centerline (AIM 2-1-10).
- **Location sign**: black background with a yellow letter and a yellow
  border. The notes say "outlined in black".
- **Complex airplane**: retractable gear, flaps, and a *controllable*-pitch
  propeller (61.1). The notes say "fixed pitch" and leave out flaps.
- **High performance**: an engine of *more than* 200 hp (61.31(f)). The
  notes say both "200 HP+" and "201".
- **Category** for pilot certification is *airplane*, not "aircraft".
- **Va and steep turns**: 90 KIAS is Va only at 1,900 lb; at 2,550 lb it is
  105. The POH's steep turn entry speed is 95 KIAS.
- **VFR cruising altitudes**: the notes swap the ranges in the sub-bullets.
  0–179° magnetic course is odd + 500; 180–359° is even + 500.
- **"Class G in mountainous terrain, 5 SM"** isn't in 91.155. 5 SM applies
  at or above 10,000 ft MSL (and more than 1,200 ft AGL) in Class E and G.
- **Victor airways** start at 1,200 ft AGL, not at the surface.
- **First class medical for private privileges** lasts 60 months only if
  you were under 40 at the exam; at 40 or over it is 24 months.
- **Night currency** requires the same *type* only if that aircraft needs a
  type rating.
- **Displaced threshold**: the area before it can be used for taxi,
  takeoff, and the landing rollout from the other direction. It can't be
  used for touchdown. The notes say "not for landing".
- **"Stowaway"** should be stopway.
- **Blood donation** is *hypemic* hypoxia, not stagnant (PHAK ch. 17).
- **NTSB serious injury**: hospitalization of more than 48 hours, starting
  within 7 days. Fractures count except simple fractures of fingers, toes or
  nose.
- **PIREP decode**: `/TM 1800` is the time (1800Z). The notes fold it into
  the location.
- **TAF decode**: the notes' walk-through of the KMEM TAF misreads several
  groups. The valid period is the 12th 1800Z to the 13th 2400Z, not
  "16:00–midnight". I only made a card for the header. Want a corrected,
  group-by-group card?

## From the school's notes only (source `school`)

These facts have no FAA or POH source. Verified by the user: 9 gal/hr for
diversions, 2,150 RPM before clearing turns, 10 kt maximum tailwind, 6-quart
oil minimum, and the school acronyms. Confirm the rest:

- Cruise above 2,200 RPM.
- 1,500 RPM slow-flight entry.
- 1,000 ft separation.
- 1,800–1,900 RPM, 90 kt, 500 fpm cruise descent.
- Enrich the mixture for maneuvers except steep turns.
- Never pick even altitudes for maneuvers.
- Wind shear under an inversion when the wind 2,000–4,000 ft AGL is 25 kt
  or more.
- The lifted index at about 18,000 ft.
- Runways over 8,069 ft drawn without the circle on the sectional.
- Paine's night airspace is in the Chart Supplement.

## Not made into cards (yet)

- Winds aloft (FB) decoding shortcuts. The notes have a TODO for these.
- The VFR minimums study matrix. The individual minimums are cards.
- Overwater flight requirements.
- The MEF calculation steps (round up, +100, +200). The notes' method
  needs checking against the Aeronautical Chart User's Guide.
- "Fog when the spread is less than 5°". I found no FAA wording for it.
- The squall definition (16–22 kt).
- Personal-statement items such as "schedule planes on my own" and RemNote.
