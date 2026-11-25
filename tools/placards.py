"""Draw the glareshield placards FlightGear's panel texture (panelglass.png)
has only at a few pixels per letter: the registration plate and the
winterization kit placard. Writes build/placards/*.png, which are committed
(the build doesn't need these fonts); build/extras.py lays them over the
old ones. Rerun after changing the text:

    .venv/Scripts/python.exe tools/placards.py

The wording is what panelglass.png shows; its part number is illegible
and left out. The registration matches the fuselage's (4X-CHV).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, im in (("placard-registration", registration()), ("placard-winterization", winterization())):
        im.save(OUT / f"{name}.png", optimize=True)
        print(OUT / f"{name}.png", im.size)
