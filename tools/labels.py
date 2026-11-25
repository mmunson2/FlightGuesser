"""Show what each object's texture says: crop the texture under every
object whose name matches, and lay the crops out in one labelled image.
For identifying keys and knobs (the G1000 bezels, the audio panel) whose
object names don't say what they are.

    .venv/bin/python tools/labels.py OUT.png gdu1 'AP\\..*|SoftKey.*'
    .venv/bin/python tools/labels.py OUT.png interior 'AP\\..*|Alt.*|VolNAV'

Sources: gdu1 (PFD, GDU-1044B texture), gdu2 (MFD, GDU-104X texture),
interior (c172sp-interior.ac, panel-fg1000.png). Write OUT to the scratchpad.
"""

import re
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent / "build"))
import ac3d  # noqa: E402
import gltf  # noqa: E402
from paths import C172P  # noqa: E402

GDU = C172P / "fgdata/GDU104X"
INTERIOR = C172P / "repo/Models/Interior/Panel/c172sp-panel"
SOURCES = {
    "gdu1": ("gltf", GDU / "Model/GDU-104X.1.gltf", GDU / "Textures/GDU-1044B.png"),
    "gdu2": ("gltf", GDU / "Model/GDU-104X.2.gltf", GDU / "Textures/GDU-104X.png"),
    "interior": ("ac", INTERIOR / "c172sp-interior.ac", INTERIOR / "panel-fg1000.png"),
}


def uv_sets(kind, model, pattern):
    if kind == "gltf":
        for name, _, faces, uv in gltf.load(model, uvs=True):
            if uv is not None and re.fullmatch(pattern, name):
                yield name, uv[faces.ravel()], False
    else:
        for o in ac3d.read(model)[1]:
            if re.fullmatch(pattern, o.name) and len(o.uvs):
                yield o.name, o.uvs.reshape(-1, 2), True


def main(out, source, pattern):
    kind, model, texture = SOURCES[source]
    tex = Image.open(texture).convert("RGB")
    w, h = tex.size
    tiles = []
    for name, uv, flip in sorted(uv_sets(kind, model, pattern)):
        # glTF v runs down the image; AC3D's (like OpenGL's) runs up.
        u, v = uv[:, 0], uv[:, 1]
        y = (1 - v) * h if flip else v * h
        box = (int(u.min() * w) - 2, int(y.min()) - 2, int(u.max() * w) + 2, int(y.max()) + 2)
        crop = tex.crop(box)
        crop = crop.resize((max(1, crop.width * 3), max(1, crop.height * 3)))
        tiles.append((name, crop))
    if not tiles:
        sys.exit("no objects match")
    cell_w = max(160, max(c.width for _, c in tiles)) + 10
    cell_h = max(c.height for _, c in tiles) + 24
    cols = max(1, 1400 // cell_w)
    rows = -(-len(tiles) // cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    for i, (name, crop) in enumerate(tiles):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        draw.text((x + 4, y + 4), name, fill="black")
        sheet.paste(crop, (x + 4, y + 20))
    sheet.save(out)
    print(f"{len(tiles)} objects -> {out}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
