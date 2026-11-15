import { describe, expect, it } from "vitest";

import { ZONE_SYSTEM, ZONES, zoneOf, zoneWeights } from "./zones";

describe("zoneWeights", () => {
  const share = (weights: number[], zone: (typeof ZONES)[number]) => weights[ZONES.indexOf(zone)] ?? 0;

  it("is all one zone well inside it", () => {
    expect(share(zoneWeights(0.95, 0), "head")).toBeCloseTo(1);
    expect(share(zoneWeights(0.2, 0.05), "legs")).toBeCloseTo(1);
  });

  it("is shared half and half right on a border, so the colour fades across it", () => {
    const hip = zoneWeights(0.5, 0.05);

    expect(share(hip, "abdomen")).toBeCloseTo(0.5);
    expect(share(hip, "legs")).toBeCloseTo(0.5);
  });

  it("changes smoothly and always adds up to one", () => {
    let previous = share(zoneWeights(0.48, 0.05), "abdomen");
    for (let h = 0.481; h <= 0.52; h += 0.001) {
      const weights = zoneWeights(h, 0.05);
      expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1);
      expect(share(weights, "abdomen")).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(share(weights, "abdomen") - previous).toBeLessThan(0.1);
      previous = share(weights, "abdomen");
    }
    expect(share(zoneWeights(0.7, 0.18), "arms")).toBeCloseTo(1);
  });
});

describe("zoneOf", () => {
  it("places the head, chest, abdomen and legs along the midline", () => {
    expect(zoneOf(0.95, 0)).toBe("head");
    expect(zoneOf(0.75, 0.05)).toBe("chest");
    expect(zoneOf(0.58, 0.05)).toBe("abdomen");
    expect(zoneOf(0.2, 0.05)).toBe("legs");
  });

  it("keeps the shoulders with the chest but the hanging arms apart", () => {
    expect(zoneOf(0.82, 0.12)).toBe("chest");
    expect(zoneOf(0.7, 0.18)).toBe("arms");
    expect(zoneOf(0.48, 0.29)).toBe("arms");
  });

  it("gives every zone a system", () => {
    expect(ZONES.every((zone) => ZONE_SYSTEM[zone] !== undefined)).toBe(true);
    expect(ZONE_SYSTEM.head).toBe("neurological");
    expect(ZONE_SYSTEM.chest).toBe("cardiovascular");
    expect(ZONE_SYSTEM.abdomen).toBe("immune");
  });
});
