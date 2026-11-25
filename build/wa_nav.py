"""Washington State's airports, VORs, frequencies and airspace from the
FAA's NASR and ADDS data, for the mock G1000's database: data/wa-nav.js.

    .venv/bin/python build/wa_nav.py <nasr_dir> data/wa-nav.js [<airspace.geojson>]

<nasr_dir> holds the 28-day subscription's CSV zips for NASR_DATE
(APT, FRQ and NAV; tools/fetch_data.sh downloads them). The GeoJSON is
the FAA ADDS Class Airspace layer cut to the state's box (fetch_data.sh
too). The data is the FAA's, public domain. A new cycle: change NASR_DATE
here and in tools/fetch_data.sh, then `make fetch nav`.

Kept: open, public-use land airports (no heliports, seaplane bases or
private fields) with their runways and the frequencies a VFR pilot uses
(CTAF, UNICOM, tower, ground, clearance, ATIS, ASOS/AWOS, approach); the
operational VORs (VOR/DME and VORTAC); the state's center, flight service
and weather outlets (Nearest Frequencies); and Class B, C and D airspace.
VHF only: UHF military frequencies are dropped. The output is
deterministic.
"""

import csv
import io
import json
import sys
import zipfile
from pathlib import Path

NASR_DATE = "29_Oct_2026"
STATE = "WA"

# FRQ.csv FREQ_USE -> the mock's kinds, in the order the page lists them.
FREQ_KINDS = [
    ("ATIS", "ATIS"), ("ASOS", "ASOS"), ("AWOS", "AWOS"), ("CD", "CLEARANCE"), ("GND", "GROUND"), ("LCL", "TOWER"),
    ("CTAF", "CTAF"), ("UNICOM", "UNICOM"), ("APCH", "APPROACH"),
]


def table(nasr, kind, name):
    """Rows of one CSV inside <nasr>/<NASR_DATE>_<kind>_CSV.zip."""
    with zipfile.ZipFile(Path(nasr) / f"{NASR_DATE}_{kind}_CSV.zip") as z:
        return list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding="latin-1")))


def num(v, nd=None):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if nd == 0:
        return int(round(f))
    return round(f, nd) if nd is not None else f


def freq_kind(use):
    for prefix, kind in FREQ_KINDS:
        if use.startswith(prefix):
            return kind
    return None


def load(nasr):
    base = [r for r in table(nasr, "APT", "APT_BASE.csv")
            if r["STATE_CODE"] == STATE and r["SITE_TYPE_CODE"] == "A"
            and r["FACILITY_USE_CODE"] == "PU" and r["ARPT_STATUS"] == "O"]
    lids = {r["ARPT_ID"] for r in base}

    ends = {}
    for r in table(nasr, "APT", "APT_RWY_END.csv"):
        if r["ARPT_ID"] in lids:
            ends.setdefault((r["ARPT_ID"], r["RWY_ID"]), []).append({
                "id": r["RWY_END_ID"], "true": num(r["TRUE_ALIGNMENT"], 0),
                "rightTraffic": r["RIGHT_HAND_TRAFFIC_PAT_FLAG"] == "Y"})
    runways = {}
    for r in table(nasr, "APT", "APT_RWY.csv"):
        if r["ARPT_ID"] in lids:
            runways.setdefault(r["ARPT_ID"], []).append({
                "id": r["RWY_ID"], "len": num(r["RWY_LEN"], 0), "wid": num(r["RWY_WIDTH"], 0),
                "surface": r["SURFACE_TYPE_CODE"], "lights": r["RWY_LGT_CODE"],
                "ends": sorted(ends.get((r["ARPT_ID"], r["RWY_ID"]), []), key=lambda e: e["id"])})

    freqs = {}
    for r in table(nasr, "FRQ", "FRQ.csv"):
        lid, kind, f = r["SERVICED_FACILITY"], freq_kind(r["FREQ_USE"]), num(r["FREQ"].split("/")[0])
        # A field's ASOS or AWOS, by the station's type.
        if r["FACILITY_TYPE"] == "ASOS_AWOS":
            kind = "ASOS" if r["SERVICED_SITE_TYPE"].startswith("ASOS") else "AWOS"
        if lid not in lids or not kind or f is None or not 118 <= f < 137:
            continue
        entry = {"kind": kind, "freq": round(f, 3), "note": r["SECTORIZATION"].strip()}
        if entry not in freqs.setdefault(lid, []):
            freqs[lid].append(entry)
    order = {k: i for i, (_, k) in enumerate(FREQ_KINDS)}

    airports = []
    for r in base:
        lid = r["ARPT_ID"]
        mv = num(r["MAG_VARN"])
        airports.append({
            "id": r["ICAO_ID"] or lid, "lid": lid, "name": r["ARPT_NAME"], "city": r["CITY"],
            "lat": num(r["LAT_DECIMAL"], 5), "lon": num(r["LONG_DECIMAL"], 5),
            "elev": num(r["ELEV"], 0), "tpa": num(r["TPA"], 0),
            "magVar": None if mv is None else (mv if r["MAG_HEMIS"] == "E" else -mv),
            "magVarYear": num(r["MAG_VARN_YEAR"], 0),
            "towered": r["TWR_TYPE_CODE"].startswith("ATCT"), "fuel": r["FUEL_TYPES"],
            "runways": sorted(runways.get(lid, []), key=lambda w: (-(w["len"] or 0), w["id"])),
            "freqs": sorted(freqs.get(lid, []), key=lambda e: (order[e["kind"]], e["freq"], e["note"])),
        })
    airports.sort(key=lambda a: a["id"])

    vors = []
    for r in table(nasr, "NAV", "NAV_BASE.csv"):
        if r["STATE_CODE"] != STATE or r["NAV_TYPE"] not in ("VOR/DME", "VORTAC") \
                or not r["NAV_STATUS"].startswith("OPERATIONAL"):
            continue
        mv = num(r["MAG_VARN"])
        vors.append({
            "id": r["NAV_ID"], "name": r["NAME"], "kind": r["NAV_TYPE"], "freq": num(r["FREQ"], 2),
            "lat": num(r["LAT_DECIMAL"], 5), "lon": num(r["LONG_DECIMAL"], 5), "elev": num(r["ELEV"], 0),
            "magVar": None if mv is None else (mv if r["MAG_VARN_HEMIS"] == "E" else -mv),
            "magVarYear": num(r["MAG_VARN_YEAR"], 0),
        })
    vors.sort(key=lambda v: v["id"])

    clash = {a["id"] for a in airports} & {v["id"] for v in vors}
    if clash:
        raise SystemExit(f"airport and VOR identifiers clash: {sorted(clash)}")
    return airports, vors


def load_comms(nasr):
    """The Nearest Frequencies page's outlets in the state: ARTCC remote
    sites (RCAG; their VHF low-altitude frequencies), flight service
    outlets (RCO) and weather stations (ASOS/AWOS), each with a position."""
    sites = {}
    for r in table(nasr, "FRQ", "FRQ.csv"):
        kind = {"RCAG": "ARTCC", "RCO": "FSS", "ASOS_AWOS": "WX"}.get(r["FACILITY_TYPE"])
        f = num(r["FREQ"].split("/")[0])
        if not kind or r["SERVICED_STATE"] != STATE or f is None or not 118 <= f < 137 or f == 121.5:
            continue
        if kind == "ARTCC" and "LOW" not in r["SECTORIZATION"]:
            continue
        key = (kind, r["FACILITY"])
        site = sites.setdefault(key, {
            "kind": kind, "id": r["FACILITY"], "name": r["FAC_NAME"] or r["SERVICED_CITY"] or r["FACILITY"],
            # Who answers: the ARTCC or FSS (ZSE, SEA); a station's type.
            "via": r["ARTCC_OR_FSS_ID"] if kind != "WX" else r["SERVICED_SITE_TYPE"],
            "lat": num(r["LAT_DECIMAL"], 5), "lon": num(r["LONG_DECIMAL"], 5), "freqs": []})
        if round(f, 3) not in site["freqs"]:
            site["freqs"].append(round(f, 3))
    for s in sites.values():
        s["freqs"].sort()
    return sorted(sites.values(), key=lambda s: (s["kind"], s["id"]))


# Airspace shapes are simplified to this tolerance (degrees, about 40 m).
SIMPLIFY = 0.0004


def simplify(pts, tol=SIMPLIFY):
    """Douglas-Peucker on a ring of (lon, lat), in degrees."""
    if len(pts) < 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5
        best, at = 0.0, None
        for i in range(a + 1, b):
            x, y = pts[i]
            d = abs(dy * (x - x1) - dx * (y - y1)) / norm if norm else ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
            if d > best:
                best, at = d, i
        if at is not None and best > tol:
            keep[at] = True
            stack += [(a, at), (at, b)]
    return [p for p, k in zip(pts, keep) if k]


def alt_limit(val, code):
    """A floor or ceiling: feet, or 0 for the surface. Ceilings are MSL."""
    return 0 if code == "SFC" and not val else int(val)


def load_airspace(geojson):
    """Class B, C and D airspace over the state and its US neighbours, from
    the FAA's ADDS Class Airspace layer (tools/fetch_data.sh): one entry per
    shelf, with its floor and ceiling. Canadian airspace is left out."""
    with open(geojson, encoding="utf-8") as f:
        features = json.load(f)["features"]
    out = []
    for feat in features:
        p, g = feat["properties"], feat["geometry"]
        if p["CLASS"] not in ("B", "C", "D") or p["STATE"] not in ("WA", "OR", "ID") or not g:
            continue
        rings = [g["coordinates"][0]] if g["type"] == "Polygon" else [poly[0] for poly in g["coordinates"]]
        for ring in rings:
            pts = simplify([(x, y) for x, y in ring])
            out.append({
                "cls": p["CLASS"], "name": " ".join(p["NAME"].split()), "id": p["IDENT"] or "",
                "lo": alt_limit(p["LOWER_VAL"], p["LOWER_CODE"]), "loAgl": p["LOWER_CODE"] == "SFC" and bool(p["LOWER_VAL"]),
                "hi": alt_limit(p["UPPER_VAL"], p["UPPER_CODE"]),
                "pts": [[round(y, 4), round(x, 4)] for x, y in pts],
            })
    out.sort(key=lambda a: (a["cls"], a["name"], a["lo"], a["hi"], a["pts"][0]))
    return out


def main(nasr, out, airspace=None):
    airports, vors = load(nasr)
    comms = load_comms(nasr)
    spaces = load_airspace(airspace) if airspace else []
    data = {"source": f"FAA NASR, effective {NASR_DATE.replace('_', ' ')}", "state": STATE,
            "airports": airports, "vors": vors, "comms": comms, "airspace": spaces}
    with open(out, "w", newline="\n") as f:
        f.write("// Generated by build/wa_nav.py from FAA NASR and ADDS data - do not edit by hand.\n")
        f.write("window.WA_NAV = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print(f"{out}: {len(airports)} airports, {sum(len(a['runways']) for a in airports)} runways, "
          f"{sum(len(a['freqs']) for a in airports)} frequencies, {len(vors)} VORs, "
          f"{len(comms)} comm outlets, {len(spaces)} airspace shelves "
          f"({sum(len(a['pts']) for a in spaces)} points)")


if __name__ == "__main__":
    main(*sys.argv[1:4])
