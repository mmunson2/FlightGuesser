"""Read AC3D (.ac) files, FlightGear's model format, into triangle meshes.

An .ac file is a tree of OBJECTs, each with a name, an optional `loc`
(translation) and `rot` (3x3 matrix, rows) relative to its parent, its own
vertices and SURFaces (polygons, or lines, which are skipped), then `kids`
children. `read(path)` returns every named object with vertices in the
file's frame (AC3D is y-up) and its polygons fanned into triangles.
"""

from dataclasses import dataclass, field

import numpy as np


@dataclass
class Material:
    name: str
    rgb: tuple
    trans: float


@dataclass
class Obj:
    name: str
    path: str                     # parent names joined with '/', for debugging
    verts: np.ndarray             # (n, 3) float64, file frame
    tris: np.ndarray              # (m, 3) int
    mats: list = field(default_factory=list)  # material index per triangle
    uvs: np.ndarray = None        # (m, 3, 2) texture coordinates per triangle corner
    texture: str = ""             # the object's texture file, if any


def _tokens(path):
    # Strings are quoted and may hold spaces ("name "Panel 1""); keep them whole.
    for line in open(path, encoding="latin-1"):
        yield line.rstrip("\n")


def triangulate(pts):
    """A polygon's corners (n, 3) -> corner index triples. A convex polygon
    is fanned from its first corner; a concave one is ear-clipped, since a
    fan covers its notches. Exporters write a face with holes (the panel's
    instrument cutouts) as one concave polygon, the holes bridged into the
    outline by a doubled edge."""
    n = len(pts)
    fan = [(0, k, k + 1) for k in range(1, n - 1)]
    if n == 3:
        return fan
    normal = np.zeros(3)                  # Newell's normal
    for k in range(n):
        a, b = pts[k], pts[(k + 1) % n]
        normal += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
    axis = int(np.argmax(np.abs(normal)))
    if normal[axis] == 0:
        return fan
    p2 = pts[:, [d for d in range(3) if d != axis]]
    if normal[axis] < 0:                  # make the polygon counter-clockwise in 2D
        p2 = p2[:, ::-1]
    scale = np.ptp(p2, axis=0).max() or 1.0
    eps = 1e-9 * scale * scale

    def cross(a, b, c):
        return (p2[b, 0] - p2[a, 0]) * (p2[c, 1] - p2[a, 1]) - (p2[b, 1] - p2[a, 1]) * (p2[c, 0] - p2[a, 0])

    if all(cross(k, (k + 1) % n, (k + 2) % n) >= -eps for k in range(n)):
        return fan
    ring, out = list(range(n)), []

    def inside(q, a, b, c):
        if any(np.array_equal(p2[q], p2[v]) for v in (a, b, c)):
            return False
        return cross(a, b, q) > eps and cross(b, c, q) > eps and cross(c, a, q) > eps

    while len(ring) > 3:
        m = len(ring)
        for k in range(m):
            a, b, c = ring[k - 1], ring[k], ring[(k + 1) % m]
            if cross(a, b, c) > eps and not any(inside(q, a, b, c) for q in ring if q not in (a, b, c)):
                out.append((a, b, c))
                del ring[k]
                break
        else:
            # Only flat corners left to clip: drop a straight-through one
            # (not a bridge's out-and-back spike), else give up and fan.
            for k in range(m):
                a, b, c = ring[k - 1], ring[k], ring[(k + 1) % m]
                if abs(cross(a, b, c)) <= eps and np.dot(p2[b] - p2[a], p2[c] - p2[b]) >= 0:
                    del ring[k]
                    break
            else:
                out += [(ring[0], ring[k], ring[k + 1]) for k in range(1, len(ring) - 1)]
                return out
    out.append(tuple(ring))
    return out


def read(path):
    """-> (materials, objects)"""
    lines = list(_tokens(path))
    if not lines[0].startswith("AC3D"):
        raise ValueError(f"{path}: not an AC3D file")
    materials = []
    i = 1
    while i < len(lines) and lines[i].startswith("MATERIAL"):
        parts = lines[i].split()
        name = lines[i].split('"')[1]
        rgb = tuple(float(v) for v in parts[parts.index("rgb") + 1:parts.index("rgb") + 4])
        trans = float(parts[parts.index("trans") + 1]) if "trans" in parts else 0.0
        materials.append(Material(name, rgb, trans))
        i += 1
    objects = []

    def parse(i, parent_m, parent_t, parent_path):
        assert lines[i].startswith("OBJECT"), lines[i]
        i += 1
        name, loc, rot, texture = "", np.zeros(3), np.eye(3), ""
        verts, tris, mats, uvs = [], [], [], []
        kids = 0
        while True:
            line = lines[i]
            key = line.split(" ", 1)[0]
            if key == "name":
                name = line.split('"')[1] if '"' in line else line.split()[1]
                i += 1
            elif key == "loc":
                loc = np.array([float(v) for v in line.split()[1:4]])
                i += 1
            elif key == "texture":
                texture = line.split('"')[1]
                i += 1
            elif key == "rot":
                rot = np.array([float(v) for v in line.split()[1:10]]).reshape(3, 3)
                i += 1
            elif key == "numvert":
                n = int(line.split()[1])
                verts = np.array([[float(v) for v in lines[i + 1 + k].split()[:3]] for k in range(n)]
                                 ) if n else np.zeros((0, 3))
                i += 1 + n
            elif key == "numsurf":
                i += 1
                for _ in range(int(line.split()[1])):
                    flags = int(lines[i].split()[1], 0)
                    i += 1
                    mat = 0
                    while not lines[i].startswith("refs"):
                        if lines[i].startswith("mat"):
                            mat = int(lines[i].split()[1])
                        i += 1
                    nref = int(lines[i].split()[1])
                    rows = [lines[i + 1 + k].split() for k in range(nref)]
                    refs = [int(r[0]) for r in rows]
                    uv = [(float(r[1]), float(r[2])) if len(r) >= 3 else (0.0, 0.0) for r in rows]
                    i += 1 + nref
                    if flags & 0xF == 0 and nref >= 3:  # polygon (1, 2: lines)
                        for a, b, c in triangulate(np.asarray(verts)[refs]):
                            tris.append((refs[a], refs[b], refs[c]))
                            uvs.append((uv[a], uv[b], uv[c]))
                            mats.append(mat)
            elif key == "kids":
                kids = int(line.split()[1])
                i += 1
                break
            else:  # data, texture, texrep, texoff, crease, url, subdiv, hidden, locked, folded
                if key == "data":
                    i += 2  # the next line is the data itself
                else:
                    i += 1
        # Child coordinates: v_parent = rot^T-free AC convention: v' = v @ rot + loc
        m = rot @ parent_m
        t = loc @ parent_m + parent_t
        path = f"{parent_path}/{name}" if parent_path else name
        if len(verts) and tris:
            objects.append(Obj(name, path, np.asarray(verts) @ m + t,
                               np.array(tris, dtype=np.int64), mats, np.array(uvs), texture))
        for _ in range(kids):
            i = parse(i, m, t, path)
        return i

    i = parse(i, np.eye(3), np.zeros(3), "")
    return materials, objects
