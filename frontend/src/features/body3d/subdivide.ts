/**
 * Loop subdivision of an indexed triangle mesh (Loop, 1987): every triangle becomes four and
 * every vertex moves towards its neighbours, so a coarse body turns into a smooth one.
 * Open borders follow the boundary rules, so holes keep their outline.
 */
export interface TriangleMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

interface Edge {
  point: number;
  opposite: number[];
}

export function loopSubdivide({ positions, indices }: TriangleMesh): TriangleMesh {
  const vertexCount = positions.length / 3;
  const key = (a: number, b: number) => (a < b ? a * vertexCount + b : b * vertexCount + a);
  const edges = new Map<number, Edge>();
  const neighbours: Set<number>[] = Array.from({ length: vertexCount }, () => new Set<number>());

  for (let f = 0; f < indices.length; f += 3) {
    const tri = [indices[f] ?? 0, indices[f + 1] ?? 0, indices[f + 2] ?? 0];
    for (let i = 0; i < 3; i++) {
      const a = tri[i] ?? 0;
      const b = tri[(i + 1) % 3] ?? 0;
      const c = tri[(i + 2) % 3] ?? 0;
      neighbours[a]?.add(b);
      neighbours[b]?.add(a);
      const k = key(a, b);
      const edge = edges.get(k) ?? { point: -1, opposite: [] };
      edge.opposite.push(c);
      edges.set(k, edge);
    }
  }

  const out = new Float32Array((vertexCount + edges.size) * 3);
  const at = (v: number, axis: number) => positions[v * 3 + axis] ?? 0;

  // Vertices on a border (an edge used by a single triangle) follow the boundary rule.
  const borderNeighbours: number[][] = Array.from({ length: vertexCount }, () => []);
  for (const [k, edge] of edges) {
    if (edge.opposite.length !== 1) continue;
    const a = Math.floor(k / vertexCount);
    const b = k % vertexCount;
    borderNeighbours[a]?.push(b);
    borderNeighbours[b]?.push(a);
  }

  for (let v = 0; v < vertexCount; v++) {
    const border = borderNeighbours[v] ?? [];
    for (let axis = 0; axis < 3; axis++) {
      let value: number;
      if (border.length === 2) {
        value = 0.75 * at(v, axis) + 0.125 * (at(border[0] ?? v, axis) + at(border[1] ?? v, axis));
      } else if (border.length > 0) {
        value = at(v, axis); // a corner where borders meet stays put
      } else {
        const ring = [...(neighbours[v] ?? [])];
        const n = ring.length;
        const beta = n > 3 ? 3 / (8 * n) : 3 / 16;
        value = (1 - n * beta) * at(v, axis) + beta * ring.reduce((sum, u) => sum + at(u, axis), 0);
      }
      out[v * 3 + axis] = value;
    }
  }

  let next = vertexCount;
  for (const [k, edge] of edges) {
    const a = Math.floor(k / vertexCount);
    const b = k % vertexCount;
    const [c, d] = edge.opposite;
    for (let axis = 0; axis < 3; axis++) {
      out[next * 3 + axis] =
        edge.opposite.length === 2 && c !== undefined && d !== undefined
          ? 0.375 * (at(a, axis) + at(b, axis)) + 0.125 * (at(c, axis) + at(d, axis))
          : 0.5 * (at(a, axis) + at(b, axis));
    }
    edge.point = next++;
  }

  const faces = new Uint32Array(indices.length * 4);
  const mid = (a: number, b: number) => edges.get(key(a, b))?.point ?? a;
  let w = 0;
  for (let f = 0; f < indices.length; f += 3) {
    const a = indices[f] ?? 0;
    const b = indices[f + 1] ?? 0;
    const c = indices[f + 2] ?? 0;
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    faces.set([a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca], w);
    w += 12;
  }
  return { positions: out, indices: faces };
}
