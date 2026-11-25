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
remember the pilot's guides. Softkey labels and the radio boxes' layout
were checked against the NXi in MSFS 2020. Check the rest against
Garmin's *G1000 NXi Pilot's Guide for the Cessna 172* (190-02520-xx) and
the GFC 700 AFMS:

- **GFC 700 logic**:
  - The FD comes on in ROL and PIT. ROL holds the bank if it is over 6°,
    and levels the wings if it is less.
  - The FD can't be turned off while the AP is engaged.
  - Pressing an active mode key returns to ROL or PIT.
  - A mode change flashes for 10 seconds.
  - AP disconnect flashes a yellow "AP" for about 5 seconds.
- **NOSE UP/DN steps**: 0.5° in PIT, 100 fpm in VS, 1 kt in FLC (where
  nose up means slower). In ALT the keys do nothing in the mock.
- **Limits in the mock**: bank 22° in HDG and NAV, pitch −10° to +15°,
  VS ±1,500 fpm, FLC 55–120 KIAS. All are guesses.
- **ALTS**:
  - Arms in PIT, VS and FLC when the selected altitude is ahead.
  - The capture lead is |VS| ÷ 5 ft.
  - The real GFC 700 shows ALTS green during the capture, then ALT. Check
    those annunciations.
- **Altitude alerter**:
  - The box flashes 5 seconds at 1,000 ft out and again at 200 ft.
  - It turns yellow when off by more than 200 ft after reaching the
    altitude.
  - The aural alert isn't modelled.
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
  - CLR on a waypoint asks "Remove?". MENU on a waypoint asks to activate
    the leg to it. The real unit goes through a page menu for this; the
    mock asks directly.
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
    Planning, Utility, Active Flight Plan, Nearest Airports, Nearest VOR.
    The other pages are placeholders.
  - Airport Information has no runways, frequencies or elevation: the
    mock's database doesn't hold them.
  - ENT on Nearest Airports opens that airport's information page.
  - ENT on Nearest VOR loads the frequency into the tuned NAV's standby.
  - Check both ENT behaviours against the real unit, which may go through
    a frequency field.
- **PFD Nearest softkey**: opens a Nearest Airports window. Push FMS for
  the cursor; D→ offers the selection.
- **Fuel**: 48 gal usable at start, burning at a made-up fuel flow (from
  power and altitude, not the POH). Trip Planning assumes no wind.
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
    ATIS, approach), and the 16 operational VORs.
  - Positions are surveyed, so the mock is accurate as of that cycle. It
    goes out of date every 28 days; rebuild with `make fetch nav`.
  - Left out: private fields, heliports and seaplane bases, NDBs,
    intersections, AWOS/ASOS frequencies (not in FRQ.csv), and airports
    over the state line.
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
  - The EIS numbers and the airplane's kinematics are made up.
  - There is no wind.

## The engine model

The engine is a generic four-cylinder CAD model, not a true IO-360. The 15
engine questions (`en-*`) use PHAK chapter 7 and the POH (8-quart sump,
engine-driven fuel pump failure). Things to check against a real engine:

- The parts I named from the model's shapes: oil sump (with the intake
  tubes running through it), fuel injection lines, accessory case.
- The colours are typical, not your airplane's.

## Parts drawn from the maintenance manual

The firewall, engine mount, exhaust (risers, muffler, heat shroud),
batteries, brake master cylinders and lines, fuel system, sump drains,
static port, stall warning, G1000 units and engine accessories follow the Cessna Model 172 Maintenance Manual's drawings
(`build/extras.py` cites each figure). The manual gives where things go,
not most sizes, so check against your airplane:

- **Static port**: the manual and POH say left side of the fuselage, ahead
  of the door (the POH checks it at the nose). Its height is my guess.
- **Fuel strainer**: on the front lower left of the firewall, its drain
  through the bottom of the cowling. The POH says "bottom of fuselage".
- **Wing sump drains**: five per tank, placed from the manual's
  under-wing drawing (between wing stations 23.62 and 71.62). The front
  spar position is an estimate.
- **Main battery** sizes, the **power junction box** above it, and the
  **standby battery** behind the panel's upper left.
- **Engine mount** tube layout: the manual shows four firewall bolts only.
- **Brake lines**: the manual shows them under the floor and out the
  skin to each gear leg; the exact routing is simplified.
- **Fuel system under the floor** (MM 28-20-00 Figs. 201, 204, 206): the
  reservoir under the copilot's footwell, the selector valve under the
  pedestal, the auxiliary pump and shutoff valve between the reservoir and
  the firewall. Sizes and exact spots are estimates; the supply lines are
  drawn one per tank down the front door posts (the manual shows two
  outlets per tank).
- **G1000 units**: the tailcone shelf (GIA 63 ×2, GTX 33, GRS 77, GDC 74A,
  fan) is drawn at FS 142–157 from the manual's picture; the station is my
  estimate. Unit sizes are estimates. The GEA 71 sits under the MFD,
  forward of the panel. The GMU 44 magnetometer is in the left wing above
  access plate 520HB; its wing station (115) is read off the access panel
  drawing.
- **Stall warning**: the scoop at WS 91 on the left wing's leading edge
  (the manual's number); the horn at the upper left door post.
- **Engine accessories**: oil cooler on the left rear baffle, starter at the
  front lower left (both from the manual's text), oil filter and vacuum pump
  on the accessory housing. Each sits at the nearest spot clear of the CAD
  engine's own parts, so the starter is farther out than a real one and the
  cooler sits a little high and aft. The filter and pump positions on the
  housing are my reading of Lycoming's parts catalog, not measured.
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
