"""Washington State's airports and VORs from the FAA's NASR data, for the
mock G1000's database: data/wa-nav.js.

    .venv/bin/python build/wa_nav.py <nasr_dir> data/wa-nav.js

<nasr_dir> holds the 28-day subscription's CSV zips for NASR_DATE
(APT, FRQ and NAV; tools/fetch_data.sh downloads them). The data is the
FAA's, public domain. A new cycle: change NASR_DATE here and in
tools/fetch_data.sh, then `make fetch nav`.

Kept: open, public-use land airports (no heliports, seaplane bases or
private fields) with their runways and the frequencies a VFR pilot uses
(CTAF, UNICOM, tower, ground, clearance, ATIS, approach), and the
operational VORs (VOR/DME and VORTAC). VHF only: UHF military
frequencies are dropped. The output is deterministic.
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
    ("ATIS", "ATIS"), ("CD", "CLEARANCE"), ("GND", "GROUND"), ("LCL", "TOWER"),
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
        })
    vors.sort(key=lambda v: v["id"])

    clash = {a["id"] for a in airports} & {v["id"] for v in vors}
    if clash:
        raise SystemExit(f"airport and VOR identifiers clash: {sorted(clash)}")
    return airports, vors


def main(nasr, out):
    airports, vors = load(nasr)
    data = {"source": f"FAA NASR, effective {NASR_DATE.replace('_', ' ')}", "state": STATE,
            "airports": airports, "vors": vors}
    with open(out, "w", newline="\n") as f:
        f.write("// Generated by build/wa_nav.py from FAA NASR data - do not edit by hand.\n")
        f.write("window.WA_NAV = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print(f"{out}: {len(airports)} airports, {sum(len(a['runways']) for a in airports)} runways, "
          f"{sum(len(a['freqs']) for a in airports)} frequencies, {len(vors)} VORs")


if __name__ == "__main__":
    main(*sys.argv[1:3])
