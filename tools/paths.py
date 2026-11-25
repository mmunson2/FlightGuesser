"""Where things are, for the tools. The Makefile has the same layout."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("FLIGHT_DATA", Path.home() / "Projects" / "datasets"))
C172P = DATA / "c172p"
KPAE = DATA / "kpae"
# Source pages fetched by tools/page.py, as text.
PAGES = DATA / "pages"
INDEX_HTML = ROOT / "index.html"
SCENEDATA = ROOT / "data" / "scenedata.js"
