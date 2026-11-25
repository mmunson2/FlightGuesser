#!/bin/sh
# Download the source data the build reads into $1 (default
# ~/Projects/datasets), skipping files already there:
#   c172p/repo/...    FlightGear c172p (GPL 2.0): the model files the build
#                     uses, not the whole 1.5 GB repo
#   c172p/fgdata/...  FlightGear fgdata's FG1000 GDU displays (GPL 2.0)
#   kpae/*.pdf        the FAA airport diagram, for the cycle
#                     build/airport.py names (DIAGRAM_PDF)
#   ...Textures/*.png the G1000 and panel textures, for tools/labels.py
# A new FAA cycle: change DIAGRAM_PDF in build/airport.py and CYCLE here,
# then `make fetch model`.
set -eu
DATA=${1:-$HOME/Projects/datasets}
CYCLE=2611
C172=https://raw.githubusercontent.com/c172p-team/c172p/master
FG=https://gitlab.com/flightgear/fgdata/-/raw/next/Aircraft/Instruments-3d/FG1000/GDU104X

get() {  # url path
  [ -s "$2" ] && return
  mkdir -p "$(dirname "$2")"
  echo "fetch $1"
  curl -sfL -A "Mozilla/5.0 (FlightGuesser build)" "$1" -o "$2.part" && mv "$2.part" "$2"
}

for f in LICENSE README.md Models/c172-common.ac \
    Models/Interior/Panel/c172sp-panel/c172sp-interior.ac Models/Interior/Panel/c172sp-panel/c172sp.xml \
    Models/Interior/Panel/Instruments/asi/asi-fg1000.ac Models/Interior/Panel/Instruments/AI/AI-fg1000.ac \
    Models/Interior/Panel/Instruments/alt/alt-fg1000.ac Models/Interior/Panel/Instruments/mag-compass/mag-compass.ac \
    Models/Interior/Panel/Instruments/hobbs/hobbs-fg1000.ac \
    Models/Interior/Panel/Instruments/magneto-switch/magneto-switch-fg1000.ac \
    Models/Interior/FE-ELT/elt-fg1000.ac Models/Interior/Panel/Flaps/flaps.ac \
    Models/Interior/Yoke/yoke-fg1000.ac Models/Interior/Pedals/pedals.ac \
    Models/Interior/Panel/c172sp-panel/panel-fg1000.png \
    Models/fuselage.png Models/interior.png Models/panel.png Models/panel_parts.png Models/tail.png \
    Models/wing.png Models/prop.png Models/lights.png Models/glass-alpha.png \
    Models/Interior/Panel/c172sp-panel/interior-fg1000.png \
    Models/Interior/Panel/Instruments/asi/asi.png Models/Interior/Panel/Instruments/AI/AI.png \
    Models/Interior/Panel/Instruments/alt/alt.png Models/Interior/Panel/Instruments/hobbs/hobbs.png \
    Models/Interior/Panel/Instruments/mag-compass/mag-compass.png \
    Models/Interior/Panel/Instruments/magneto-switch/magneto-switch.png \
    Models/Interior/Panel/Instruments/gear/breakers-switches.png \
    Models/Interior/Panel/Flaps/flaps.png Models/Interior/Yoke/yoke-fg1000.png Models/Interior/Yoke/yoke.png \
    Models/Interior/Pedals/pedal.png; do
  get "$C172/$f" "$DATA/c172p/repo/$f"
done
for f in GDU-1044B.1.xml GDU-1040.2.xml Model/GDU-104X.1.gltf Model/GDU-104X.1.bin \
    Model/GDU-104X.2.gltf Model/GDU-104X.2.bin Textures/GDU-1044B.png Textures/GDU-104X.png; do
  get "$FG/$f" "$DATA/c172p/fgdata/GDU104X/$f"
done
get "https://aeronav.faa.gov/d-tpp/$CYCLE/00142AD.PDF" "$DATA/kpae/00142AD_$CYCLE.pdf"
echo "source data in $DATA is complete"
