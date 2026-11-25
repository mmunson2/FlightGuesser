"""Minimal glTF reader (.glb, or .gltf with its .bin): world-space triangle
meshes per node. Copied from EMTGuesser's build/glb.py, plus .gltf."""
import json
import struct
from pathlib import Path

import numpy as np

CTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16,
          5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def _accessor(gl, binc, i):
    a = gl["accessors"][i]
    bv = gl["bufferViews"][a["bufferView"]]
    dt = np.dtype(CTYPES[a["componentType"]])
    n = NCOMP[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0)
    if stride and stride != dt.itemsize * n:
        raw = np.frombuffer(binc, np.uint8, count=stride * a["count"], offset=off)
        raw = raw.reshape(a["count"], stride)[:, :dt.itemsize * n]
        return np.ascontiguousarray(raw).view(dt).reshape(a["count"], n)
    return np.frombuffer(binc, dt, count=a["count"] * n, offset=off).reshape(a["count"], n)


def _local(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    s = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    m = np.eye(4)
    m[:3, :3] = r * s
    m[:3, 3] = t
    return m


def load(path, uvs=False, materials=False):
    """Return list of (node_name, verts Nx3 float64, faces Mx3 int64) in world
    space; with uvs=True, each also has its TEXCOORD_0 (Nx2) or None; with
    materials=True, then its material index (or None)."""
    with open(path, "rb") as f:
        data = f.read()
    if str(path).endswith(".gltf"):
        gl = json.loads(data)
        with open(Path(path).parent / gl["buffers"][0]["uri"], "rb") as f:
            binc = f.read()
        data = b""
    else:
        magic, _, _ = struct.unpack_from("<4sII", data, 0)
        assert magic == b"glTF", path
    off = 12
    if data:
        gl, binc = None, b""
    while data and off < len(data):
        ln, typ = struct.unpack_from("<II", data, off)
        chunk = data[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A:
            gl = json.loads(chunk)
        elif typ == 0x004E4942:
            binc = chunk
        off += 8 + ln
    out = []

    def walk(ni, parent):
        node = gl["nodes"][ni]
        m = parent @ _local(node)
        if "mesh" in node:
            for prim in gl["meshes"][node["mesh"]]["primitives"]:
                if prim.get("mode", 4) != 4:
                    continue
                v = _accessor(gl, binc, prim["attributes"]["POSITION"]).astype(np.float64)
                f = (_accessor(gl, binc, prim["indices"]).reshape(-1, 3).astype(np.int64)
                     if "indices" in prim else np.arange(len(v)).reshape(-1, 3))
                v = v @ m[:3, :3].T + m[:3, 3]
                entry = (node.get("name", f"node{ni}"), v, f)
                if uvs:
                    a = prim["attributes"].get("TEXCOORD_0")
                    entry += (None if a is None else _accessor(gl, binc, a).astype(np.float64),)
                if materials:
                    entry += (prim.get("material"),)
                out.append(entry)
        for c in node.get("children", []):
            walk(c, m)

    scene = gl["scenes"][gl.get("scene", 0)]
    for ni in scene["nodes"]:
        walk(ni, np.eye(4))
    return out
