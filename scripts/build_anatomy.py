"""Build frontend/public/models/anatomy.glb from the BodyParts3D atlas.

The 3D body in the panel is a hologram of the atlas body: the skin, and inside it the skeleton,
the brain, the heart and the airways. All of it comes from BodyParts3D, by the Database Center
for Life Science (Japan), under CC BY 4.0 ("BodyParts3D, © The Database Center for Life Science
licensed under CC Attribution 4.0 International"). Because every part comes from the same body,
the skeleton and the organs sit exactly inside the skin.

Input: the PART-OF polygon meshes, from https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
(partof_BP3D_4.0_obj_99.zip, unzipped). The atlas is not stored in this repository.

What it does:
- Picks the parts of each group by their English name, read from each OBJ header.
- Turns the atlas frame (mm, z up, the person facing -y) into the panel's frame: y up, facing +z,
  soles at y = 0 and 1 unit = the person's height.
- Merges each group into one mesh and simplifies it to a size a browser loads quickly.
- Flattens the front of the pelvis, as on a mannequin: the atlas body is anatomically complete,
  and a neutral figure suits a health panel shown to anyone.
- Bakes, on every vertex of the skin, how much it belongs to the head, an arm, a leg or the torso,
  from the nearest bone, so a click on the body and the alert colours follow the real limbs.
- Stores where each ring of the panel points to (brain, heart, upper chest, abdomen, elbow) and the
  height where the chest ends, in the scene's extras.

Requirements (not part of the app): numpy, scipy, trimesh, fast-simplification.
Usage: python scripts/build_anatomy.py <unzipped partof_BP3D_4.0_obj_99 folder>
"""

from __future__ import annotations

import json
import re
import struct
import sys
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh
from scipy.sparse import coo_matrix
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "public" / "models" / "anatomy.glb"
CREDIT = (
    "BodyParts3D, © The Database Center for Life Science licensed under "
    "CC Attribution 4.0 International"
)

NOT_BONE = re.compile(
    r"artery|vein|nerve|muscle|ligament|gland|duct|canal|canaliculus|\bsac\b|lake|tarsal plate|disk"
)
HEAD_BONE = re.compile(
    r"frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|ethmoid|zygomatic|maxilla"
    r"|nasal bone|lacrimal bone|palatine bone|vomer|mandible"
)
ARM_BONE = re.compile(
    r"humerus|radius$|ulna$|metacarpal|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid"
    r"|capitate|hamate|phalanx of .*(finger|thumb)"
)
LEG_BONE = re.compile(
    r"femur|tibia$|fibula$|patella|metatarsal|talus|calcaneus|cuboid|cuneiform|navicular"
    r"|phalanx of .*toe"
)
OTHER_BONE = re.compile(
    r"vertebra$|^atlas$|^axis$|rib$|costal cartilage|sternum|manubrium|xiphoid|sacrum|hip bone"
    r"|clavicle|scapula|hyoid bone"
)
BRAIN = re.compile(
    r"white matter of .* cerebral hemisphere|gyrus|occipital lobe|lobule|insula|cerebellum|^pons$"
    r"|medulla oblongata|midbrain|hypothalamus|hippocampus"
)
HEART = re.compile(
    r"^wall of (left|right) atrium$|^cavity of (left|right) ventricle$|coronary"
    r"|interventricular branch|cardiac vein|^ascending aorta$|^pulmonary trunk$"
)
AIRWAYS = re.compile(r"^trachea$|main bronchus|bronchial tree")

# Triangles kept per group: enough to read as anatomy, small enough to load in a moment.
BUDGET = {"skin": 40000, "skeleton": 70000, "brain": 14000, "heart": 7000, "lungs": 9000}
# Soft borders between the zones of the skin: rounds of averaging with the neighbours.
ZONE_SMOOTHING = 6


def header(path: Path) -> dict[str, str]:
    fields: dict[str, str] = {}
    with path.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            if not line.startswith("#"):
                break
            match = re.match(r"#\s*([^:]+?)\s*:\s*(.*)", line.strip())
            if match:
                fields[match.group(1)] = match.group(2)
    return fields


def bone_kind(name: str) -> str | None:
    if NOT_BONE.search(name):
        return None
    for kind, pattern in (("head", HEAD_BONE), ("arm", ARM_BONE), ("leg", LEG_BONE)):
        if pattern.search(name):
            return kind
    return "torso" if OTHER_BONE.search(name) else None


def load(path: Path) -> trimesh.Trimesh:
    mesh = trimesh.load(path, process=False, force="mesh")
    # Atlas (mm, z up, facing -y) to panel (y up, facing +z): x stays, y = z, z = -y.
    v = np.asarray(mesh.vertices, dtype=np.float64)
    return trimesh.Trimesh(np.column_stack([v[:, 0], v[:, 2], -v[:, 1]]), mesh.faces, process=False)


def merge(meshes: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    mesh = trimesh.util.concatenate(meshes)
    mesh.merge_vertices()
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    return mesh


def simplify(mesh: trimesh.Trimesh, triangles: int) -> trimesh.Trimesh:
    if len(mesh.faces) <= triangles:
        return mesh
    reduction = 1 - triangles / len(mesh.faces)
    points, faces = fast_simplification.simplify(
        mesh.vertices.astype(np.float32), mesh.faces.astype(np.int64), target_reduction=reduction
    )
    out = trimesh.Trimesh(points, faces, process=False)
    out.update_faces(out.nondegenerate_faces())
    out.remove_unreferenced_vertices()
    return out


def neutral_front(points: np.ndarray) -> np.ndarray:
    """Caps the front of the pelvis with a smooth slope (panel units: 1 = the person's height)."""
    out = points.copy()
    x, y, z = out[:, 0], out[:, 1], out[:, 2]
    region = (np.abs(x) < 0.05) & (y > 0.425) & (y < 0.515)
    # From the lower belly (z 0.046 at y 0.51) down to the fork of the legs (z 0.02 at y 0.43).
    cap = 0.046 - 0.325 * (0.51 - y)
    out[:, 2] = np.where(region & (z > cap), cap, z)
    return out


def zone_weights(skin: trimesh.Trimesh, bones: dict[str, np.ndarray]) -> np.ndarray:
    """Head, arm, leg and torso shares of each skin vertex, from the nearest bone, softened."""
    kinds = ["head", "arm", "leg", "torso"]
    points = np.concatenate([bones[k] for k in kinds])
    labels = np.concatenate([np.full(len(bones[k]), i) for i, k in enumerate(kinds)])
    _, nearest = cKDTree(points).query(skin.vertices)
    weights = np.zeros((len(skin.vertices), 4), dtype=np.float64)
    weights[np.arange(len(skin.vertices)), labels[nearest]] = 1.0
    edges = skin.edges_unique
    n = len(skin.vertices)
    rows = np.r_[edges[:, 0], edges[:, 1]]
    cols = np.r_[edges[:, 1], edges[:, 0]]
    adjacency = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n)).tocsr()
    degree = np.asarray(adjacency.sum(axis=1)).ravel()
    degree[degree == 0] = 1
    for _ in range(ZONE_SMOOTHING):
        weights = 0.5 * weights + 0.5 * (adjacency @ weights) / degree[:, None]
    return (weights / weights.sum(axis=1, keepdims=True)).astype(np.float32)


def write_glb(parts: list[dict], extras: dict, path: Path) -> None:
    """A minimal glTF 2.0 binary: one node per part, positions, indices and an optional COLOR_0."""
    blob = bytearray()
    views: list[dict] = []
    accessors: list[dict] = []
    meshes: list[dict] = []
    nodes: list[dict] = []

    def add(data: np.ndarray, component: int, kind: str, target: int, bounds: bool = False) -> int:
        while len(blob) % 4:
            blob.append(0)
        views.append(
            {"buffer": 0, "byteOffset": len(blob), "byteLength": data.nbytes, "target": target}
        )
        blob.extend(data.tobytes())
        accessor = {
            "bufferView": len(views) - 1,
            "componentType": component,
            "count": len(data),
            "type": kind,
        }
        if bounds:
            accessor["min"] = data.min(axis=0).tolist()
            accessor["max"] = data.max(axis=0).tolist()
        accessors.append(accessor)
        return len(accessors) - 1

    for part in parts:
        positions = np.ascontiguousarray(part["positions"], dtype=np.float32)
        faces = np.ascontiguousarray(part["faces"])
        if len(positions) < 65536:
            index = add(faces.astype(np.uint16).ravel(), 5123, "SCALAR", 34963)
        else:
            index = add(faces.astype(np.uint32).ravel(), 5125, "SCALAR", 34963)
        attributes = {"POSITION": add(positions, 5126, "VEC3", 34962, bounds=True)}
        if part.get("colors") is not None:
            colors = np.ascontiguousarray(part["colors"], dtype=np.float32)
            attributes["COLOR_0"] = add(colors, 5126, "VEC4", 34962)
        primitive = {"attributes": attributes, "indices": index}
        meshes.append({"name": part["name"], "primitives": [primitive]})
        nodes.append(
            {"name": part["name"], "mesh": len(meshes) - 1, "translation": part["translation"]}
        )
    while len(blob) % 4:
        blob.append(0)
    document = {
        "asset": {
            "version": "2.0",
            "generator": "allinkay scripts/build_anatomy.py",
            "copyright": CREDIT,
        },
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes))), "extras": extras}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(blob)}],
    }
    text = json.dumps(document, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(blob)
    with path.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(text), 0x4E4F534A))
        f.write(text)
        f.write(struct.pack("<II", len(blob), 0x004E4942))
        f.write(bytes(blob))


def main(folder: Path) -> None:
    groups: dict[str, list[trimesh.Trimesh]] = {k: [] for k in BUDGET}
    bones: dict[str, list[np.ndarray]] = {"head": [], "arm": [], "leg": [], "torso": []}
    named: dict[str, trimesh.Trimesh] = {}
    for path in sorted(folder.glob("*.obj")):
        name = header(path).get("English name", "").lower()
        kind = bone_kind(name)
        group = (
            "skin"
            if name == "skin"
            else "skeleton"
            if kind
            else "brain"
            if BRAIN.search(name)
            else "heart"
            if HEART.search(name)
            else "lungs"
            if AIRWAYS.search(name)
            else None
        )
        if group is None:
            continue
        mesh = load(path)
        groups[group].append(mesh)
        if kind:
            bones[kind].append(np.asarray(mesh.vertices))
        named[name] = mesh

    skin_raw = merge(groups["skin"])
    low, high = skin_raw.bounds
    height = high[1] - low[1]
    centre = np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2])

    def normalise(points: np.ndarray) -> np.ndarray:
        return (np.asarray(points) - centre) / height

    parts = []
    report = {}
    for group, budget in BUDGET.items():
        mesh = simplify(merge(groups[group]), budget)
        positions = normalise(mesh.vertices)
        middle = (positions.min(axis=0) + positions.max(axis=0)) / 2
        colors = None
        if group == "skin":
            middle = np.zeros(3)
            positions = neutral_front(positions)
            colors = zone_weights(
                trimesh.Trimesh(positions, mesh.faces, process=False),
                {k: normalise(np.concatenate(v)) for k, v in bones.items()},
            )
        parts.append(
            {
                "name": group,
                "positions": positions - middle,
                "faces": mesh.faces,
                "translation": middle.tolist(),
                "colors": colors,
            }
        )
        report[group] = {"pieces": len(groups[group]), "triangles": len(mesh.faces)}

    def spot(name: str, pick: str = "centre") -> list[float]:
        points = normalise(named[name].vertices)
        if pick == "lowest":
            return points[points[:, 1].argmin()].round(4).tolist()
        return ((points.min(axis=0) + points.max(axis=0)) / 2).round(4).tolist()

    brain = next(p["translation"] for p in parts if p["name"] == "brain")
    heart = next(p["translation"] for p in parts if p["name"] == "heart")
    chest_from = float(normalise(named["xiphoid process"].vertices)[:, 1].min())
    crest = float(normalise(named["left hip bone"].vertices)[:, 1].max())
    skin = next(p for p in parts if p["name"] == "skin")["positions"]

    def under_skin(x: float, y: float) -> list[float]:
        """A spot just under the front of the skin, at a height and a side offset."""
        band = skin[(np.abs(skin[:, 1] - y) < 0.01) & (np.abs(skin[:, 0] - x) < 0.03)]
        return [round(x, 4), round(y, 4), round(float(band[:, 2].max()) - 0.02, 4)]

    extras = {
        "credit": CREDIT,
        # Where the chest turns into the abdomen, for the zones of the skin.
        "chestFrom": round(chest_from, 4),
        # The person's left is the viewer's right (+x), facing +z. "Your normal" points to the
        # middle of the trunk, between the heart (on the viewer's right) and the abdomen, so the
        # lines on the left run from top to bottom without crossing.
        "anchors": {
            "neurological": np.round(brain, 4).tolist(),
            "cardiovascular": np.round(heart, 4).tolist(),
            "model": under_skin(-0.015, chest_from - 0.005),
            "immune": under_skin(-0.015, crest + 0.01),
            "radiation": spot("left humerus", "lowest"),
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    write_glb(parts, extras, OUTPUT)
    report["bytes"] = OUTPUT.stat().st_size
    report["extras"] = extras
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
