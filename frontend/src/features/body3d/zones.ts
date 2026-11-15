import type { System } from "../../api/types";

/** Parts of the 3D body that light up with the system they stand for. */
export type Zone = "head" | "chest" | "abdomen" | "arms" | "legs";

export const ZONES: readonly Zone[] = ["head", "chest", "abdomen", "arms", "legs"];

/** The system each zone shows. Arms and legs carry the skin, which radiation reaches first. */
export const ZONE_SYSTEM: Record<Zone, System> = {
  head: "neurological",
  chest: "cardiovascular",
  abdomen: "immune",
  arms: "radiation",
  legs: "radiation",
};

/**
 * What each skin vertex carries from the anatomy model: how much it belongs to the head, an arm,
 * a leg or the torso, taken from the nearest bone and softened across the borders.
 */
export interface BakedZones {
  head: number;
  arms: number;
  legs: number;
  torso: number;
}

/** Half-width of the band, as a fraction of the body height, where the chest fades into the abdomen. */
const BLEND = 0.012;

/** 0 below `edge`, 1 above it, with a smooth (Hermite) ramp across the band. */
function ramp(value: number, edge: number): number {
  const t = Math.min(Math.max((value - (edge - BLEND)) / (2 * BLEND), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * How much a skin vertex belongs to each zone, in ZONES order. The torso is split into chest and
 * abdomen at `chestFrom`, the height (0 at the soles, 1 at the top of the head) where the
 * breastbone ends; the shares always add up to one.
 */
export function zoneShares(baked: BakedZones, height: number, chestFrom: number): number[] {
  const total = baked.head + baked.arms + baked.legs + baked.torso || 1;
  const torso = baked.torso / total;
  const chest = ramp(height, chestFrom);
  const shares: Record<Zone, number> = {
    head: baked.head / total,
    chest: torso * chest,
    abdomen: torso * (1 - chest),
    arms: baked.arms / total,
    legs: baked.legs / total,
  };
  return ZONES.map((zone) => shares[zone]);
}
