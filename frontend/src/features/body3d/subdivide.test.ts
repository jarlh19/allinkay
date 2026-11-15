import { describe, expect, it } from "vitest";

import { loopSubdivide, type TriangleMesh } from "./subdivide";

function octahedron(): TriangleMesh {
  const positions = new Float32Array([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1]);
  const indices = new Uint32Array([
    0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5,
  ]);
  return { positions, indices };
}

function radii(mesh: TriangleMesh): number[] {
  const out: number[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    out.push(Math.hypot(mesh.positions[i] ?? 0, mesh.positions[i + 1] ?? 0, mesh.positions[i + 2] ?? 0));
  }
  return out;
}

describe("loopSubdivide", () => {
  it("turns every triangle into four and adds one vertex per edge", () => {
    const result = loopSubdivide(octahedron());

    expect(result.positions.length / 3).toBe(6 + 12);
    expect(result.indices.length / 3).toBe(8 * 4);
    expect(Math.max(...result.indices)).toBeLessThan(18);
  });

  it("rounds a coarse shape: every vertex ends up closer to the same distance from the centre", () => {
    const before = radii({ positions: new Float32Array([1, 0, 0, 0.5, 0.5, 0]), indices: new Uint32Array() });
    const after = radii(loopSubdivide(octahedron()));

    expect(Math.max(...before) / Math.min(...before)).toBeCloseTo(Math.SQRT2, 3);
    expect(Math.max(...after) / Math.min(...after)).toBeLessThan(1.2);
    expect(Math.max(...after)).toBeCloseTo(0.625, 5);
  });

  it("keeps an open border in its plane and pulls its corners inwards", () => {
    const triangle: TriangleMesh = {
      positions: new Float32Array([0, 0, 0, 4, 0, 0, 0, 4, 0]),
      indices: new Uint32Array([0, 1, 2]),
    };

    const result = loopSubdivide(triangle);

    for (let i = 2; i < result.positions.length; i += 3) expect(result.positions[i]).toBe(0);
    // The corner (4, 0) moves to 3/4 of itself plus 1/8 of each border neighbour: (3, 0.5).
    expect([result.positions[3], result.positions[4]]).toEqual([3, 0.5]);
    expect(result.indices.length / 3).toBe(4);
  });
});
