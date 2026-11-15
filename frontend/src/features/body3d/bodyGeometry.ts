import { Box3, BufferGeometry, type BufferAttribute } from "three";

import { ZONES, zoneShares, type Zone } from "./zones";

/**
 * The skin from the anatomy model, ready for the scene: its own copy of the positions and indices,
 * smooth normals and a bounding box. The model already stands upright, faces +z and has its soles
 * at y = 0, with 1 unit = the person's height.
 */
export function skinGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", source.getAttribute("position").clone());
  if (source.index) geometry.setIndex(source.index.clone());
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/**
 * Each vertex's share of every zone (ZONES order) and the zone it mostly belongs to, from the
 * head, arm, leg and torso shares the anatomy model baked into the skin's vertex colours.
 */
export function zoneData(
  geometry: BufferGeometry,
  baked: BufferAttribute,
  chestFrom: number,
): { weights: Float32Array; dominant: Zone[] } {
  const positions = geometry.getAttribute("position");
  const box = geometry.boundingBox ?? new Box3().setFromBufferAttribute(positions as BufferAttribute);
  const height = box.max.y - box.min.y;
  const weights = new Float32Array(positions.count * ZONES.length);
  const dominant: Zone[] = [];
  for (let v = 0; v < positions.count; v++) {
    const shares = zoneShares(
      { head: baked.getX(v), arms: baked.getY(v), legs: baked.getZ(v), torso: baked.getW(v) },
      (positions.getY(v) - box.min.y) / height,
      chestFrom,
    );
    weights.set(shares, v * ZONES.length);
    let best = 0;
    shares.forEach((share, i) => {
      if (share > (shares[best] ?? 0)) best = i;
    });
    dominant.push(ZONES[best] ?? "legs");
  }
  return { weights, dominant };
}
