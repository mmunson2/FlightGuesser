"""The viewer's background: the sky of Poly Haven's "Kloofendal 48d Partly
Cloudy (Pure Sky)" panorama (CC0,
https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky, its
tonemapped JPG), equirectangular, over generated terrain: a blurred
patchwork of field greens fading into the horizon haze, as seen from the
air (the panorama's own lower half mirrors the sky like water). The
horizon is lowered by DROP (the sky stretched, the ground squeezed): the
viewer's outside camera looks down about 13 degrees, and the sky should
fill the top half of the view. -> a JPEG data URI, deterministic.
"""

import base64
import io

import numpy as np

SKY_FILE = "sky/kloofendal_48d_partly_cloudy_puresky.jpg"   # under the data directory (tools/fetch_data.sh)
SIZE = (4096, 2048)
DROP = 15.0                                 # degrees the horizon is lowered
ROLL = 0.0                                  # of the width: turns the panorama (what is behind the outside view)
HAZE = 0.10                                 # of the ground's height: haze from the horizon down into the fields
GREENS = [(96, 128, 72), (78, 112, 58), (110, 132, 80), (70, 100, 56), (120, 128, 84)]
FIELDS = 26                                 # patchwork cells across the width
BLUR = 20                                   # px


def terrain(w, h, haze_rgb):
    """Ground rows (h of them, the horizon at the top) -> an RGB array."""
    from PIL import Image, ImageFilter
    rng = np.random.default_rng(172)
    cols, rows = FIELDS, max(2, FIELDS * h // w)
    cells = np.array(GREENS, float)[rng.integers(0, len(GREENS), (rows, cols))]
    cells[:, -1] = cells[:, 0]                       # wraps round the panorama
    patch = Image.fromarray(cells.astype(np.uint8)).resize((w, h), Image.NEAREST)
    patch = np.asarray(patch.filter(ImageFilter.GaussianBlur(BLUR)), float)
    t = np.linspace(0, 1, h)[:, None, None]
    patch = patch * (1.0 - 0.25 * t)                 # darker toward the nadir
    haze = np.clip(1 - t / HAZE, 0, 1) ** 1.5        # hazier toward the horizon
    return patch * (1 - haze) + np.array(haze_rgb, float) * haze


def sky_uri(path):
    from PIL import Image
    im = Image.open(path).convert("RGB").resize(SIZE, Image.LANCZOS)
    w, h = im.size
    shift = round(w * ROLL) % w
    if shift:
        im = Image.fromarray(np.roll(np.asarray(im), shift, axis=1))
    horizon = h // 2 + round(h * DROP / 180)
    sky = im.crop((0, 0, w, h // 2)).resize((w, horizon), Image.LANCZOS)
    haze_rgb = np.asarray(sky, float)[-4:].reshape(-1, 3).mean(0)
    out = np.zeros((h, w, 3))
    out[:horizon] = np.asarray(sky, float)
    out[horizon:] = terrain(w, h - horizon, haze_rgb)
    buf = io.BytesIO()
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(buf, "JPEG", quality=82, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
