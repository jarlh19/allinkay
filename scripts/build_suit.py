"""Build frontend/public/models/suit.glb from NASA's Extravehicular Mobility Unit model.

When a crew member works in the field, the hologram wears a spacesuit: the suit's outline takes
the place of the skin, and the brain, heart and airways stay visible inside it. The suit is NASA's
3D model of the Extravehicular Mobility Unit (credit NASA/Michael D. Carbajal), from NASA 3D
Resources, which NASA offers free to download and use under its media usage guidelines.

Input: "Extravehicular Mobility Unit.glb" from https://science.nasa.gov/3d-resources/extravehicular-mobility-unit/
(Draco compressed) and the panel's own frontend/public/models/anatomy.glb. The NASA file is not
stored in this repository.

What it does:
- Decodes every part of the suit and applies the model's own node transform.
- Drops the parts that lie exactly on top of another part: the file carries six such copies, and in
  a glowing hologram each copy doubles the glare.
- Turns it to face +z like the body, scales it so the helmet sits around the body's head, lines
  it up with the head and the lower legs and puts the boot soles at y = 0 (1 unit = the person's height).
- Merges the parts into one mesh and simplifies it to a size a browser loads quickly.
- Bakes on every vertex the head, arm, leg and torso shares of the nearest skin vertex
  (vertex colour COLOR_0), so a click on the suit and the alert colours follow the same zones.
- Stores the height where the chest ends, measured on the suit's own height, in the scene's extras.

Requirements (not part of the app): numpy, scipy, trimesh, fast-simplification and DracoPy.
Usage: python scripts/build_suit.py "<path to Extravehicular Mobility Unit.glb>"
"""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import DracoPy
import numpy as np
import trimesh
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_anatomy import merge, simplify, write_glb  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ANATOMY = ROOT / "frontend" / "public" / "models" / "anatomy.glb"
OUTPUT = ROOT / "frontend" / "public" / "models" / "suit.glb"
CREDIT = "Extravehicular Mobility Unit 3D model: NASA/Michael D. Carbajal, NASA 3D Resources"
TRIANGLES = 36000
# Height on the body (soles 0, top of the head 1) where the head's centre sits.
HEAD_FROM = 0.88


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    length = struct.unpack("<I", data[12:16])[0]
    document = json.loads(data[20 : 20 + length])
    start = 20 + length
    blob_length = struct.unpack("<I", data[start : start + 4])[0]
    return document, data[start + 8 : start + 8 + blob_length]


def accessor(document: dict, blob: bytes, index: int) -> np.ndarray:
    item = document["accessors"][index]
    view = document["bufferViews"][item["bufferView"]]
    width = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[item["type"]]
    kind = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[item["componentType"]]
    offset = view.get("byteOffset", 0) + item.get("byteOffset", 0)
    values = np.frombuffer(blob, dtype=kind, count=item["count"] * width, offset=offset)
    return values.reshape(item["count"], width) if width > 1 else values


def rotation(quaternion: list[float]) -> np.ndarray:
    x, y, z, w = quaternion
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )


def copies(points: np.ndarray, other: np.ndarray) -> bool:
    """Whether nearly all of a part's points lie on another part (within a millimetre on a 2 m suit)."""
    sample = points[:: max(1, len(points) // 2000)]
    distance, _ = cKDTree(other).query(sample)
    return bool((distance < 1e-3).mean() >= 0.95)


def load_suit(path: Path) -> trimesh.Trimesh:
    document, blob = read_glb(path)
    node = document["nodes"][0]
    turn = rotation(node.get("rotation", [0, 0, 0, 1]))
    move = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    size = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    parts = []
    for primitive in document["meshes"][node["mesh"]]["primitives"]:
        draco = primitive["extensions"]["KHR_draco_mesh_compression"]
        view = document["bufferViews"][draco["bufferView"]]
        start = view.get("byteOffset", 0)
        decoded = DracoPy.decode(blob[start : start + view["byteLength"]])
        points = np.asarray(decoded.points, dtype=np.float64).reshape(-1, 3) * size @ turn.T + move
        if any(copies(points, kept.vertices) for kept in parts):
            continue
        parts.append(trimesh.Trimesh(points, np.asarray(decoded.faces).reshape(-1, 3), process=False))
    mesh = merge(parts)
    # The model faces -z; the panel's body faces +z.
    v = mesh.vertices
    return trimesh.Trimesh(np.column_stack([-v[:, 0], v[:, 1], -v[:, 2]]), mesh.faces, process=False)


def load_skin() -> tuple[np.ndarray, np.ndarray]:
    document, blob = read_glb(ANATOMY)
    node = next(n for n in document["nodes"] if n.get("name") == "skin")
    primitive = document["meshes"][node["mesh"]]["primitives"][0]
    points = accessor(document, blob, primitive["attributes"]["POSITION"]).astype(np.float64)
    points = points + np.array(node.get("translation", [0, 0, 0]))
    shares = accessor(document, blob, primitive["attributes"]["COLOR_0"]).astype(np.float32)
    return points, shares


def main(source: Path) -> None:
    skin, shares = load_skin()
    head = skin[skin[:, 1] > HEAD_FROM]
    head_centre = (head.min(axis=0) + head.max(axis=0)) / 2

    suit = load_suit(source)
    v = suit.vertices
    low, high = v.min(axis=0), v.max(axis=0)
    helmet = v[v[:, 1] > high[1] - 0.13 * (high[1] - low[1])]
    helmet_centre = (helmet.min(axis=0) + helmet.max(axis=0)) / 2
    scale = (head_centre[1] - 0.0) / (helmet_centre[1] - low[1])
    # Side to side the helmet centres the suit on the head; front to back the lower legs do, because
    # the backpack and the bent arms would pull any whole-suit centre off the body.
    def legs_centre(points: np.ndarray, top: float) -> np.ndarray:
        floor = points[:, 1].min()
        band = points[(points[:, 1] > floor + 0.15 * top) & (points[:, 1] < floor + 0.35 * top)]
        return np.median(band, axis=0)

    body_legs = legs_centre(skin, 1.0)
    suit_legs = legs_centre(v, high[1] - low[1])
    points = (v - [helmet_centre[0], low[1], suit_legs[2]]) * scale + [head_centre[0], 0.0, body_legs[2]]
    suit = simplify(trimesh.Trimesh(points, suit.faces, process=False), TRIANGLES)

    _, nearest = cKDTree(skin).query(suit.vertices)
    colors = shares[nearest]
    height = float(suit.vertices[:, 1].max())
    body_extras = read_glb(ANATOMY)[0]["scenes"][0].get("extras", {})
    # The chest ends at the same height on the body; the panel measures it on the suit's own height.
    chest_from = float(body_extras.get("chestFrom", 0.7224)) / height
    extras = {"credit": CREDIT, "chestFrom": round(chest_from, 4)}
    parts = [{"name": "suit", "positions": suit.vertices, "faces": suit.faces, "colors": colors, "translation": [0, 0, 0]}]
    write_glb(parts, extras, OUTPUT, generator="allinkay scripts/build_suit.py", credit=CREDIT)
    print(f"suit: {len(suit.faces)} triangles, height {height:.3f}, scale {scale:.4f}")
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
