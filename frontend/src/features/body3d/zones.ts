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

// Proportions measured on the base mesh, as fractions of its height (feet at 0, top at 1).
const HEAD_FROM = 0.86;
const SHOULDERS_FROM = 0.8;
const CHEST_FROM = 0.66;
const ABDOMEN_FROM = 0.5;
const TORSO_HALF_WIDTH = 0.1;

/**
 * The zone of a point of the body, from its height (0 at the feet, 1 at the top of the head)
 * and its distance to the body's midline, both as fractions of the body height.
 */
export function zoneOf(height: number, sideways: number): Zone {
  if (height >= HEAD_FROM) return "head";
  if (height >= SHOULDERS_FROM) return "chest";
  if (sideways > TORSO_HALF_WIDTH) return "arms";
  if (height >= CHEST_FROM) return "chest";
  if (height >= ABDOMEN_FROM) return "abdomen";
  return "legs";
}

/** Half-width of the soft band where one zone's colour fades into the next. */
const BLEND = 0.01;

/** 0 below `edge`, 1 above it, with a smooth (Hermite) ramp across the band. */
function ramp(value: number, edge: number): number {
  const t = Math.min(Math.max((value - (edge - BLEND)) / (2 * BLEND), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * How much each zone (in ZONES order) a point belongs to, as a continuous function of its
 * height and its distance to the midline. Inside a zone it is all that zone; across a border it
 * fades smoothly, so the colours follow the body's lines instead of the mesh's triangles.
 */
export function zoneWeights(height: number, sideways: number): number[] {
  const head = ramp(height, HEAD_FROM);
  const body = 1 - head;
  // Below the shoulders, whatever lies outside the torso is an arm.
  const arm = ramp(sideways, TORSO_HALF_WIDTH) * (1 - ramp(height, SHOULDERS_FROM));
  const torso = body * (1 - arm);
  const chest = ramp(height, CHEST_FROM);
  const abdomen = ramp(height, ABDOMEN_FROM) - chest;
  const legs = 1 - ramp(height, ABDOMEN_FROM);
  const weights: Record<Zone, number> = {
    head,
    chest: torso * chest,
    abdomen: torso * abdomen,
    arms: body * arm,
    legs: torso * legs,
  };
  return ZONES.map((zone) => weights[zone]);
}
