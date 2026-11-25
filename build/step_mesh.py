"""Tessellate a STEP assembly into named triangle meshes.

Needs OpenCascade (pip install cadquery-ocp), which the main venv doesn't
have, so it runs from its own venv and writes a .npz the build reads:

  python step_mesh.py in.STEP out.npz [deflection_mm]

Each leaf part instance becomes `<name>#<n>/pos` (float32 N×3, mm, world
frame) and `<name>#<n>/idx` (uint32 M×3).
"""
import sys

import numpy as np
from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDF import TDF_Label
from OCP.collections import Sequence_TDF_Label as TDF_LabelSequence
from OCP.TDataStd import TDataStd_Name
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.XCAFDoc import XCAFDoc_DocumentTool


def name_of(label):
    attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), attr):
        return attr.Get().ToExtString()
    return "unnamed"


def triangles(shape):
    pos, idx, base = [], [], 0
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = TopoDS.Face(exp.Current())
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is not None:
            trsf = loc.Transformation()
            n = tri.NbNodes()
            for i in range(1, n + 1):
                p = tri.Node(i).Transformed(trsf)
                pos.append((p.X(), p.Y(), p.Z()))
            flip = face.Orientation() == TopAbs_REVERSED
            for i in range(1, tri.NbTriangles() + 1):
                a, b, c = tri.Triangle(i).Get()
                idx.append((base + a - 1, base + c - 1, base + b - 1) if flip
                           else (base + a - 1, base + b - 1, base + c - 1))
            base += n
        exp.Next()
    return np.array(pos, np.float32).reshape(-1, 3), np.array(idx, np.uint32).reshape(-1, 3)


def main(src, out, deflection=0.6):
    doc = TDocStd_Document(TCollection_ExtendedString("doc"))
    reader = STEPCAFControl_Reader()
    reader.SetNameMode(True)
    if reader.ReadFile(src) != IFSelect_RetDone or not reader.Transfer(doc):
        sys.exit(f"cannot read {src}")
    tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    roots = TDF_LabelSequence()
    tool.GetFreeShapes(roots)

    meshes, counts = {}, {}

    def walk(label, loc):
        if tool.IsReference_s(label):
            ref = TDF_Label()
            tool.GetReferredShape_s(label, ref)
            walk(ref, loc.Multiplied(tool.GetLocation_s(label)))
            return
        if tool.IsAssembly_s(label):
            kids = TDF_LabelSequence()
            tool.GetComponents_s(label, kids)
            for i in range(1, kids.Length() + 1):
                walk(kids.Value(i), loc)
            return
        shape = tool.GetShape_s(label).Moved(loc)
        BRepMesh_IncrementalMesh(shape, deflection, False, 0.5, True)
        pos, idx = triangles(shape)
        if not len(idx):
            return
        name = name_of(label)
        n = counts.get(name, 0)
        counts[name] = n + 1
        meshes[f"{name}#{n}/pos"] = pos
        meshes[f"{name}#{n}/idx"] = idx
        print(f"{name}#{n}: {len(idx)} tris", flush=True)

    for i in range(1, roots.Length() + 1):
        walk(roots.Value(i), TopLoc_Location())
    np.savez_compressed(out, **meshes)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], *(float(a) for a in sys.argv[3:4]))
