"""The KPAE airport diagram (FAA AL-142) rendered to a PNG for the viewer's
2D diagram view.

    .venv/bin/python build/airport.py <kpae_dir> out.png

A new FAA cycle (every 28 days): change CYCLE in tools/fetch_data.sh and
DIAGRAM_PDF here, then `make fetch model`.
"""

import sys
from pathlib import Path

DIAGRAM_PDF = "00142AD_2611.pdf"
RENDER_SCALE = 6  # pixels per PDF point: sharp when zoomed in


def diagram_png(kpae, out):
    """Render the diagram's page to an 8-bit grey PNG at `out`."""
    import pypdfium2
    page = pypdfium2.PdfDocument(str(Path(kpae) / DIAGRAM_PDF))[0]
    page.render(scale=RENDER_SCALE, grayscale=True).to_pil().save(out, optimize=True)


if __name__ == "__main__":
    diagram_png(*sys.argv[1:3])
