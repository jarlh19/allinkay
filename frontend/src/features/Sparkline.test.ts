import { describe, expect, it } from "vitest";

import { sparkPoints } from "./Sparkline";

describe("sparkPoints", () => {
  it("spreads the values left to right and places the lowest at the bottom and the highest at the top", () => {
    const points = sparkPoints([60, 80, 70], 100, 20, 0);

    expect(points).toEqual([
      [0, 20],
      [50, 0],
      [100, 10],
    ]);
  });

  it("keeps the padding free on every side", () => {
    const points = sparkPoints([1, 2], 100, 20, 3);

    expect(points[0]).toEqual([3, 17]);
    expect(points[1]).toEqual([97, 3]);
  });

  it("draws a flat series in the middle and a single value in the centre", () => {
    expect(sparkPoints([5, 5, 5], 100, 20).map(([, y]) => y)).toEqual([10, 10, 10]);
    expect(sparkPoints([7], 100, 20)).toEqual([[50, 10]]);
    expect(sparkPoints([], 100, 20)).toEqual([]);
  });
});
