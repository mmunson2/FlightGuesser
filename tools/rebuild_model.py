"""Rebuild data/scenedata.js without the engine's STEP file.

    .venv/Scripts/python.exe tools/rebuild_model.py [REF]

`make model` needs the GrabCAD engine (a manual, personal-use download)
tessellated into engine.npz. Where that isn't available, this takes the
engine's STEP parts (engine.PARTS) from data/scenedata.js as committed
at REF (default HEAD; in a merge, the side whose engine.py is newer),
decoded from its packed positions, and rebuilds everything else from the
source data (tools/fetch_data.sh). Positions repack exactly as long as the
scene's bounds don't change. Run from the repo root.
"""

import base64
import json
import subprocess
import sys

import numpy as np

from paths import C172P, KPAE, ROOT, SCENEDATA

sys.path.insert(0, str(ROOT / "build"))
import build_model  # noqa: E402
import engine  # noqa: E402


def committed_engine(ref="HEAD"):
    text = subprocess.run(["git", "show", f"{ref}:data/scenedata.js"], cwd=ROOT, check=True,
                          capture_output=True, text=True).stdout
    old = json.loads(text.split("=", 1)[1].rstrip().rstrip(";"))
    lo, scale = np.array(old["min"]), np.array(old["scale"])

    def dec(s, t):
        return np.frombuffer(base64.b64decode(s), dtype=t)

    parts = []
    for p in old["parts"]:
        if p["system"] != "engine" or p["id"] not in engine.PARTS:
            continue
        pieces = [{"tex": None, "uv": None,
                   "verts": dec(e["positions"], "<u2").reshape(-1, 3) * scale + lo,
                   "tris": dec(e["indices"], "<u4" if e.get("index32") else "<u2").reshape(-1, 3).astype(np.int64),
                   "rgb": dec(e["colors"], "u1").reshape(-1, 3) / 255} for e in p["pieces"]]
        parts.append({"id": p["id"], "system": "engine", "kind": p["kind"], "ask": p.get("ask", False),
                      "pieces": pieces})
    missing = set(engine.PARTS) - {p["id"] for p in parts}
    if missing:
        raise SystemExit(f"committed scenedata.js lacks engine parts {sorted(missing)}")
    return parts


if __name__ == "__main__":
    parts = committed_engine(sys.argv[1] if len(sys.argv) > 1 else "HEAD")
    engine.load = lambda _dir: parts
    build_model.main(str(C172P), str(KPAE), "unused", str(SCENEDATA))
