import { describe, expect, it } from "vitest";

import { ZONE_SYSTEM, ZONES, zoneShares } from "./zones";

const CHEST_FROM = 0.72;
const share = (shares: number[], zone: (typeof ZONES)[number]) => shares[ZONES.indexOf(zone)] ?? 0;
const only = (part: "head" | "arms" | "legs" | "torso") => ({ head: 0, arms: 0, legs: 0, torso: 0, [part]: 1 });

describe("zoneShares", () => {
  it("keeps the head, arms and legs that the anatomy model baked into the skin", () => {
    expect(share(zoneShares(only("head"), 0.95, CHEST_FROM), "head")).toBeCloseTo(1);
    expect(share(zoneShares(only("arms"), 0.6, CHEST_FROM), "arms")).toBeCloseTo(1);
    expect(share(zoneShares(only("legs"), 0.3, CHEST_FROM), "legs")).toBeCloseTo(1);
  });

  it("splits the torso into chest above the breastbone's end and abdomen below it", () => {
    expect(share(zoneShares(only("torso"), 0.8, CHEST_FROM), "chest")).toBeCloseTo(1);
    expect(share(zoneShares(only("torso"), 0.6, CHEST_FROM), "abdomen")).toBeCloseTo(1);
    const border = zoneShares(only("torso"), CHEST_FROM, CHEST_FROM);
    expect(share(border, "chest")).toBeCloseTo(0.5);
    expect(share(border, "abdomen")).toBeCloseTo(0.5);
  });

  it("changes smoothly across the border and always adds up to one", () => {
    const mixed = { head: 0, arms: 0.3, legs: 0, torso: 0.7 };
    let previous = share(zoneShares(mixed, CHEST_FROM - 0.02, CHEST_FROM), "chest");
    for (let h = CHEST_FROM - 0.02; h <= CHEST_FROM + 0.02; h += 0.001) {
      const shares = zoneShares(mixed, h, CHEST_FROM);
      expect(shares.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1);
      expect(share(shares, "arms")).toBeCloseTo(0.3);
      expect(share(shares, "chest")).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(share(shares, "chest") - previous).toBeLessThan(0.1);
      previous = share(shares, "chest");
    }
  });

  it("still adds up to one when the baked shares do not", () => {
    const shares = zoneShares({ head: 0, arms: 1, legs: 1, torso: 0 }, 0.5, CHEST_FROM);
    expect(share(shares, "arms")).toBeCloseTo(0.5);
    expect(shares.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1);
  });

  it("gives every zone a system", () => {
    expect(ZONES.every((zone) => ZONE_SYSTEM[zone] !== undefined)).toBe(true);
    expect(ZONE_SYSTEM.head).toBe("neurological");
    expect(ZONE_SYSTEM.chest).toBe("cardiovascular");
    expect(ZONE_SYSTEM.abdomen).toBe("immune");
  });
});
