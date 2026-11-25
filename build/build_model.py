"""Build data/scenedata.js, the C172S (build/aircraft.py) as quiz parts,
and next to it the KPAE diagram (build/airport.py) as kpae-diagram.png and
the FAA's PDF as kpae-diagram.pdf.

    .venv/bin/python build/build_model.py <c172p_dir> <kpae_dir> <engine_dir> data/scenedata.js

Each part's vertices are quantised to uint16 within the scene's bounds and
stored base64 with its triangle indices, as in EMTGuesser's bodydata.js.
The output is deterministic: unchanged inputs give byte-identical files.
"""

import base64
import io
import json
import shutil
import sys
from pathlib import Path

import numpy as np

import aircraft
import airport
import engine
import sky
import extras

ATTRIBUTION = (
    "Cessna 172 model from the FlightGear c172p project (c172p-team, GPL 2.0) and FG1000 displays from "
    "FlightGear fgdata (GPL 2.0); engine from GrabCAD's \"Aircraft Engine IO-360-L2A Flat Type\"")

# Camera presets: where the camera sits and what it looks at, in metres.
# The first is where the viewer opens.
VIEWS = {
    "outside": {"position": [7.5, 3.0, 9.0], "target": [0, 0, -1.2]},
    "cockpit": {"position": [0.2, 0.2, -0.75], "target": [0.05, -0.08, 0.36]},
    "panel": {"position": [0.03, 0.05, -0.42], "target": [0.03, 0.04, 0.36]},
    # The engine is under the cowling: its button shows it alone.
    "engine": {"position": [1.1, 0.45, 2.2], "target": [0, -0.12, 1.3], "solo": ["engine"]},
}


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


# Textures: longest side in pixels (the panel and G1000 bezels keep enough
# to read their key labels), JPEG unless the texture has transparency.
TEX_SIZE = 1024
TEX_SIZE_LABELS = 2048
LABEL_TEXTURES = {"panel-fg1000", "GDU-1044B", "GDU-104X"}


def texture_uri(path):
    """A texture file -> a data URI, scaled down, deterministic."""
    from PIL import Image
    im = Image.open(path)
    im.load()
    size = TEX_SIZE_LABELS if Path(path).stem in LABEL_TEXTURES else TEX_SIZE
    alpha = im.mode in ("RGBA", "LA", "P") and im.convert("RGBA").getextrema()[3][0] < 255
    im = im.convert("RGBA" if alpha else "RGB")
    if max(im.size) > size:
        k = size / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    buf = io.BytesIO()
    if alpha:
        im.save(buf, "PNG", optimize=True)
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    im.save(buf, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def pack(parts):
    """-> (parts as JSON, bounds, texture names in order). Each part's
    pieces (one per texture) carry uint16 positions over the scene's
    bounds, indices, uint8 vertex colours and, when textured, uint16 uvs
    over the piece's own uv bounds."""
    allv = [q["verts"] for p in parts for q in p["pieces"]]
    lo = np.min([v.min(0) for v in allv], axis=0)
    hi = np.max([v.max(0) for v in allv], axis=0)
    scale = (hi - lo) / 65535
    textures, out = [], []
    for p in parts:
        pieces = []
        for q in p["pieces"]:
            big = len(q["verts"]) > 65535
            e = {"positions": b64(np.round((q["verts"] - lo) / scale).astype("<u2")),
                 "indices": b64(q["tris"].astype("<u4" if big else "<u2")),
                 "colors": b64(np.round(np.clip(q["rgb"], 0, 1) * 255).astype("u1"))}
            if big:
                e["index32"] = True
            if q.get("behind"):
                e["behind"] = True             # a coplanar duplicate: drawn with a depth offset
            if q.get("moves"):
                e["moves"] = q["moves"]        # a moving piece (aircraft.MOVING)
            if q["tex"] is not None:
                name = Path(q["tex"]).stem
                if name not in textures:
                    textures.append(name)
                    TEX_FILES[name] = q["tex"]
                ulo, uhi = q["uv"].min(0), q["uv"].max(0)
                us = np.where(uhi > ulo, (uhi - ulo) / 65535, 1.0)
                e.update(tex=textures.index(name), uv=b64(np.round((q["uv"] - ulo) / us).astype("<u2")),
                         uvMin=[float(f"{v:.9g}") for v in ulo], uvScale=[float(f"{v:.9g}") for v in us])
            pieces.append(e)
        entry = {"id": p["id"], "system": p["system"], "kind": p["kind"], "pieces": pieces}
        if p.get("glass"):
            entry["glass"] = True
        if p.get("ask"):
            entry["ask"] = True
        out.append(entry)
    return out, {"min": [round(float(v), 6) for v in lo], "scale": [float(f"{v:.9g}") for v in scale]}, textures


TEX_FILES = {}


def merge(parts):
    """One part per id: a later part with the same id (an extra drawing the
    rest of an object a model only half has, such as the firewall) adds its
    pieces to the first and gives it its system and `ask`."""
    out = {}
    for p in parts:
        if p["id"] in out:
            q = out[p["id"]]
            q["pieces"] = q["pieces"] + p["pieces"]
            q.update(system=p["system"], ask=p["ask"], kind=p["kind"])
        else:
            out[p["id"]] = dict(p)
    return list(out.values())


def main(c172p, kpae, engine_dir, out):
    plane = aircraft.load(c172p)
    plane += engine.load(engine_dir)
    plane = merge(plane + extras.load(plane))
    parts, box, textures = pack(plane)
    data = {"attribution": ATTRIBUTION, **box, "views": VIEWS, "systems": [*aircraft.SYSTEMS, "avionics", "engine"],
            "parts": parts, "groups": aircraft.GROUPS, "textures": textures}
    with open(out, "w") as f:
        f.write("// Generated by build/build_model.py - do not edit by hand.\n")
        f.write("window.SCENE_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
    # Textures as data URIs: a file:// page can't put image files in WebGL.
    with open(Path(out).parent / "textures.js", "w") as f:
        f.write("// Generated by build/build_model.py - do not edit by hand.\n")
        f.write("window.SCENE_TEXTURES = " + json.dumps([texture_uri(TEX_FILES[n]) for n in textures]) + ";\n")
        f.write("window.SCENE_SKY = " + json.dumps(sky.sky_uri(Path(c172p).parent / sky.SKY_FILE)) + ";\n")
    # The airport diagram: a PNG for the 2D view, and the FAA's PDF.
    airport.diagram_png(kpae, Path(out).parent / "kpae-diagram.png")
    shutil.copyfile(Path(kpae) / airport.DIAGRAM_PDF, Path(out).parent / "kpae-diagram.pdf")
    nv = sum(len(q["verts"]) for p in plane for q in p["pieces"])
    print(f"{out}: {len(plane)} parts, {nv} vertices, {len(textures)} textures")


if __name__ == "__main__":
    main(*sys.argv[1:5])
