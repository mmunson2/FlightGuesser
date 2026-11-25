# Geometry audit

This file records where each mechanical part sits compared with its source,
and how far the position can be trusted. The audit was done on 2026-11-25,
and its findings were fixed the same day.

**Units and references.**
- FS is in inches aft of the firewall's front face. That face is the POH
  datum. In scene coordinates, FS = (0.785 − z)/0.0254.
- WS is |x|/0.0254.
- Page numbers are 1-based PDF pages: `mm` is cessna-172-mm.pdf and `poh`
  is c172s-poh-gfc700-2007.pdf.

**The strongest station source is the POH equipment list** (Fig. 6-9,
poh pp. 197–202). It gives an arm (an FS) for most equipment. Two of its
arms look like copy errors:
- GDC 74A: listed at 11.4, the same as the GEA 71. The MM puts the GDC 74A
  in the tailcone.
- GTX 33: listed at 134.0, the same as the GRS 77.

**The model's frame checks out.** The c172p doors span FS 24.1–65.3. The
MM puts the rear door post at FS 65.33 (mm 112).

**Confidence levels.**
- High: a station or dimension is printed in the source.
- Med: the topology comes from a figure, and the position is read from the
  drawing's proportions.
- Low: an estimate.

## Fixed on 2026-11-25

| Part | Was | Now | Source | Conf. |
|---|---|---|---|---|
| Aileron direct cables | Went up the front door posts | Aft under the floor, outboard at the rear door posts, up the posts and out along the rear spar | mm 480 (Fig. 201, details J/G/H/K) | Med |
| Landing gear (FlightGear) | Main wheels FS 51.7, nose wheel −13.0 | 58.1 and −6.7 (`GEAR_AFT` 0.16 m) | poh 199: 58.2 and −6.8 | High |
| Wing span (FlightGear) | Tips at WS 222 | WS 216.5; the flap/aileron break moves from WS 103 to 100.8 | 36 ft 1 in span; mm 113 puts the break at WS 100 | High |
| Tailcone avionics | Shelf at FS 142–157 | GIAs and GTX at FS 107–120 above baggage area 2; fan at the left end at 109; GRS 77 and GDC 74A side by side at 128–136 | poh 197, 200; mm 335 | High (FS), Med (layout) |
| Engine axis | Crankshaft 1.9 in below the spinner's axis | On the axis; the engine is squeezed above the axis and stretched below it, within its outline | FlightGear spinner | High |
| `firewall` part | Included the aft cabin bulkhead at FS 113 | That bulkhead goes to `cabin_interior` | — | High |
| Aileron push rod and bellcrank | Rod 10 in short of the aileron; bellcrank at mid-wing on the spar line | Bellcrank on the bottom skin at FS 66; rod reaches the aileron's leading edge | mm 482 | High (rod), Med (FS) |
| Standby battery | FS 2–6.5, outboard | Behind the PFD, FS 10.4–14 | mm 367–368; poh 197 (arm 11.2) | High |
| Fuel bays | WS 23.62–71.62 | WS 31.38–65.125 | mm 182 text; drain spots | Med-High |
| Rudder cables | Up to 12 in outboard | Beside the centreline (±3 in); pulleys at FS 50, 108, 142 | mm 489 | Med |
| Control column | Cross tube at shaft height | U arms drop to a cross tube with the cable drum | mm 481, 495 | Med |
| Elevator aft bellcrank | 3.5 in low, off the hinge line | On the elevators' hinge axis, with a lateral pivot | mm 496 | Med-High |
| Pulleys | One at every belly bend | At each figure's bulkheads; trim climbs to mid-height at FS 178 and turns on horizontal pulleys at the stabilizer | mm 489–503 | Med (topology), Low (FS) |
| Forward elevator bellcrank | FS 19 | FS 23 | mm 495 | Low |
| Trim chains | One strand | Two at the wheel; a sprocket at the actuator | mm 504, 509 | Med |
| Transponder antenna (FlightGear) | FS 50 | FS 86 | poh 200 (arm 86.3) | Med-High |
| ADF antenna (FlightGear) | Kept | Dropped: the student's airplane has no ADF | poh; the student | High |
| Nose strut opening (FlightGear) | An arch in the cowling, ahead of the moved strut | The arch is closed flush, and an oval slot is cut in the belly where the strut and torque links cross it | follows the gear move | Med |
| Power junction box | Inboard | Directly above the battery at the firewall's outboard edge, with the external power receptacle | mm 352, 361, 376 | Med |
| GMU 44 | WS 115, FS 46.7 | WS 122, FS 52.7 | poh 200; mm 123 | Med (FS), Low (WS) |
| OAT probe | FS 46.5 | FS 41.5 | poh 199 (GTP 59) | Med |
| Fuel lines | One per tank; no return line | Two per tank (aft line down the rear post); return line with check valve; outlets at the bay; pump drain | mm 538–539; poh 244 | Med |
| Forward fuel lines, reservoir vent | A vertical drop at the door post's foot (FS 23), which put the upper end on the windshield | Follow the raked forward door post from its foot up to the front spar (FS ~34) | mm 538 (Fig. 201); FlightGear door edge | Med |
| Fuel reservoir and shutoff valve | Flat box; valve on the centreline | About 2:1:1; valve toward the copilot's pedals | mm 543, 550–551 | Low-Med |
| Nose gear mounting | Strut extended up to a fitting 17 cm ahead of the firewall | Strut top in an upper fitting on the firewall, clamp below; shimmy damper on the right, along the strut | mm 622 | Med |
| Engine mount | 4 straight legs and a ring | Triangulated, with dynafocal cups | mm 862–864 | Med (topology), Low (points) |
| Alternate air door | On top of the filter box | On the box's aft wall beside the duct | mm 866 | Med |
| Oil cooler | Half size, flat | Vertical core, 7 × 7 × 2.5 in, on the left rear baffle | mm 943 | Low-Med |
| Muffler | 19.4 × 5 in; no shroud inlet | 13 × 6 in; inlet hose from the left front baffle | mm 934–935 | Low |
| Starter ring gear | Missing (a gap between the crankshaft flange and the prop) | Added, held to FlightGear's spinner radius | mm 959 | Low (size) |
| Static wicks | Each pair 12 cm apart | Rudder: near the top and low. Elevators: spread along the outer half | mm 347 | Low-Med |
| Stall horn | A trumpet into the cabin | A small reed horn inside the wing root, out of sight | mm 513; the student | High |
| Static port | FS 14 | FS 20, just ahead of the door post | mm 692 | Low |

## Still open

- **Cable diameter.** Cables are drawn at 0.2 in; the real ones are 1/8 in,
  and 3/32 in for trim (mm 485, 511). They're left thick so they can be seen.
- **Main gear leg fairing.** The bump on FlightGear's fuselage at the gear
  leg didn't move with the leg.
- **Fuel volume.** FlightGear's wing is thin and short in chord, so the
  drawn bays hold about 15 gal each, not 28.
- **Fuel selector valve.** It sits straight under its handle. The manual's
  floor plate (230FT) may put it 3–5 in further forward. Low confidence.
- **Engine.** It is a generic CAD flat four: 21 in tall where the L2A is
  24.84. Which pad the vacuum pump uses isn't settled. The oil filler tube
  dog-legs to FlightGear's dipstick.
- **Wing struts.** The upper attach is at WS ~90; the MM's plates are at
  ~95. Med confidence.

## Checked and within ~2 in

| Part | Source | Conf. |
|---|---|---|
| Engine width 33.4 and length 29.8 | Lycoming 60297-12 p. 2-10 | High |
| Stall scoop at WS 91 | mm 513 (WS 91.25) | High |
| Fuel senders, landing/taxi lights, courtesy lights | poh arms | High |
| GEA 71 under the MFD | mm 926–927; arm 11.4 | High |
| Brake master cylinders | mm 640–642 | Med-High |
| Pitot tube, WS 60 | poh arm 28.0; mm 123 | Med-High |
| Fuel tank centroid | poh 191: FS 48.0 | Med-High |
| Wing sump drains | mm 540 | Med |
| Reservoir, strainer, quick drains | mm 542–551, 177 | Med |
| Main battery side and layout; starter, alternator, oil filter | mm 361, 958–959; PC 54 | Med |
| Exhaust risers and tailpipe; induction run; steering tubes | mm 934, 865, 619 | Med |
| Trim actuator in the right stabilizer | mm 502–504 | Med |
| Marker, ELT and COM antennas; beacon | poh arms | Med |
