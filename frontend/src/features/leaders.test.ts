import { describe, expect, it } from "vitest";

import { ELBOW, leaderPath } from "./leaders";

const stage = { left: 100, top: 50 };
const canvas = { left: 400, top: 60 };

describe("leaderPath", () => {
  it("leaves a ring on the left from its right edge and ends on the spot of the body", () => {
    const ring = { left: 110, top: 80, right: 300, bottom: 140 };

    const { points, tip } = leaderPath(ring, "left", stage, canvas, { x: 40, y: 30 });

    // Ring edge at x 300 and middle height 110, both relative to the stage at (100, 50).
    expect(points).toBe(`200,60 ${200 + ELBOW},60 340,40`);
    expect(tip).toEqual({ x: 340, y: 40 });
  });

  it("leaves a ring on the right from its left edge, turning towards the body", () => {
    const ring = { left: 700, top: 200, right: 900, bottom: 260 };

    const { points } = leaderPath(ring, "right", stage, canvas, { x: 250, y: 300 });

    expect(points).toBe(`600,180 ${600 - ELBOW},180 550,310`);
  });
});
