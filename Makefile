# Every build and dev command, with the source data paths filled in.
# `make help` lists them. Source data lives outside the repo in $(DATA)
# (see tools/fetch_data.sh); override with `make model DATA=/elsewhere`.
# tools/paths.py holds the same layout for the Python tools.

DATA ?= $(HOME)/Projects/datasets
C172P := $(DATA)/c172p
KPAE := $(DATA)/kpae
NASR := $(DATA)/nasr
ENGINE := $(DATA)/engine
STEP := $(ENGINE)/raw/H-O-4-AIR-ENGINE-MODEL-L/STP-H-O-4-AIR-ENGINE-MODEL-L.STEP
PY := .venv/bin/python
export FLIGHT_DATA := $(DATA)

.PHONY: help setup fetch model nav check shot geometry clean-venv

help:  ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-16s %s\n", $$1, $$2}'

setup: .venv/.ok  ## Python venv for the build and tools
.venv/.ok: build/requirements.txt
	test -x $(PY) || python3 -m venv .venv
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q -r build/requirements.txt
	touch $@

fetch:  ## Download whatever source data is missing from $(DATA)
	tools/fetch_data.sh "$(DATA)"

model: setup $(ENGINE)/engine.npz  ## Rebuild data/scenedata.js and the KPAE diagram (data/kpae-diagram.png, .pdf)
	$(PY) build/build_model.py "$(C172P)" "$(KPAE)" "$(ENGINE)" data/scenedata.js

nav: setup  ## Rebuild data/wa-nav.js (Washington airports, VORs, frequencies, airspace; FAA NASR/ADDS) for the G1000
	$(PY) build/wa_nav.py "$(NASR)" data/wa-nav.js "$(DATA)/airspace/wa-class-airspace.geojson"

# The engine's STEP file tessellated (slow, so cached next to it).
$(ENGINE)/engine.npz: $(STEP) build/step_mesh.py
	$(PY) build/step_mesh.py "$(STEP)" $@

check: setup  ## Validate questions, names and the model in headless Chrome
	$(PY) tools/check.py $(ARGS)

shot: setup  ## Screenshot the app: make shot ARGS="out.png --view panel"
	$(PY) tools/shot.py $(ARGS)

geometry: setup  ## Report overlapping parts and parts a click can't reach: ARGS=overlaps|hidden
	$(PY) tools/geometry.py $(ARGS)

clean-venv:  ## Delete .venv
	rm -rf .venv
