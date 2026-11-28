"""Draw the glareshield placards FlightGear's panel texture (panelglass.png)
has only at a few pixels per letter: the registration plate and the
winterization kit placard. Writes build/placards/*.png, which are committed
(the build doesn't need these fonts); build/extras.py lays them over the
old ones. Rerun after changing the text:

    .venv/Scripts/python.exe tools/placards.py

The wording is what panelglass.png shows; its part number is illegible
and left out. The registration matches the fuselage's (4X-CHV).

Also writes flaps.png: FlightGear's flap indicator texture without the
172P's AVOID SLIPS WITH FLAPS EXTENDED placard, which a 172S doesn't have
(build/aircraft.py TEXTURE_OVERRIDES uses it), and wing.png without the
black half-discs painted on each wing root's leading edge for the fresh-air
inlets, which build/extras.py models in 3D.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from paths import C172P

OUT = Path(__file__).resolve().parent.parent / "build" / "placards"
FONT_DIRS = [Path("C:/Windows/Fonts"), Path("/Library/Fonts"), Path("/System/Library/Fonts/Supplemental"),
             Path("/usr/share/fonts/truetype/msttcorefonts")]
PANEL = (35, 35, 35)            # the panel's paint around them (panelglass.png)
SS = 4                          # drawn this many times larger, then reduced: smooth edges


def font(names, size):
    for d in FONT_DIRS:
        for n in names:
            if (d / n).is_file():
                return ImageFont.truetype(str(d / n), size * SS)
    raise SystemExit(f"none of the fonts {names} found")


def fit(draw, lines, f, box_w):
    """The largest font size (from f's) at which every line fits box_w."""
    return max(draw.textlength(t, font=f) for t in lines) <= box_w


def registration(w=512, h=193):
    im = Image.new("RGB", (w * SS, h * SS), PANEL)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * SS - 1, h * SS - 1), radius=6 * SS, fill=(226, 214, 168),
                        outline=(160, 148, 110), width=3 * SS)
    f = font(["arial.ttf", "Arial.ttf"], 104)
    d.text((w * SS / 2, h * SS / 2), "4X-CHV", font=f, fill=(70, 70, 66), anchor="mm")
    return im.resize((w, h), Image.LANCZOS)


WINTERIZATION = ["WINTERIZATION KIT (RIGHT AND LEFT NOSE-", "CAP COVER AND OIL COOLER COVER PLATE)",
                 "MUST BE REMOVED WHEN THE OUTSIDE AIR", "TEMPERATURE IS ABOVE 20°F"]


def winterization(w=1024, h=269):
    im = Image.new("RGB", (w * SS, h * SS), PANEL)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * SS - 1, h * SS - 1), radius=18 * SS, fill=(12, 12, 12))
    d.rounded_rectangle((7 * SS, 7 * SS, (w - 8) * SS, (h - 8) * SS), radius=14 * SS, outline=(240, 240, 240),
                        width=9 * SS)
    margin, size = 40, 60
    names = ["ARIALNB.TTF", "Arial Narrow Bold.ttf", "arialbd.ttf", "Arial Bold.ttf"]
    while not fit(d, WINTERIZATION, font(names, size), (w - 2 * margin) * SS):
        size -= 1
    f = font(names, size)
    top, step = 34, (h - 2 * 34) / len(WINTERIZATION)
    for k, t in enumerate(WINTERIZATION):
        d.text((margin * SS, (top + step * (k + 0.5)) * SS), t, font=f, fill=(240, 240, 240), anchor="lm")
    return im.resize((w, h), Image.LANCZOS)


# The placard's box in flaps.png (256 x 256), and a plain stretch of the
# frame (right of the slot) tiled over it.
SLIPS_BOX = (30, 217, 158, 253)
FRAME_PATCH = (125, 20, 175, 190)


def flaps_172s():
    im = Image.open(C172P / "repo/Models/Interior/Panel/Flaps/flaps.png").convert("RGBA")
    x0, y0, x1, y1 = SLIPS_BOX
    patch = im.crop(FRAME_PATCH)
    for x in range(x0, x1, patch.width):
        im.paste(patch.crop((0, 0, min(patch.width, x1 - x), y1 - y0)), (x, y0))
    return im


# The painted inlets' boxes in wing.png (2048 x 2048), with a 3 px margin;
# each is covered by the plain skin INLET_SHIFT px above it.
INLET_BOXES = [(327, 895, 339, 915), (327, 1133, 339, 1153)]
INLET_SHIFT = 24


def wing_172s():
    im = Image.open(C172P / "repo/Models/wing.png").convert("RGBA")
    for x0, y0, x1, y1 in INLET_BOXES:
        im.paste(im.crop((x0, y0 - INLET_SHIFT, x1, y1 - INLET_SHIFT)), (x0, y0))
    return im


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, im in (("placard-registration", registration()), ("placard-winterization", winterization()),
                     ("flaps", flaps_172s()), ("wing", wing_172s())):
        im.save(OUT / f"{name}.png", optimize=True)
        print(OUT / f"{name}.png", im.size)
