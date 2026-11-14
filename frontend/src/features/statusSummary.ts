import { overallStatus, systemStatus, type SystemStatus } from "../api/liveState";
import type { Evaluation, Radiation, System } from "../api/types";

/** What can be chosen on the screen: the model or one of the systems. */
export type Target = System | "model";

/** Signals inside the person's normal right now, for one system or for all of them. */
export function inNormal(evaluation: Evaluation | null, target: Target = "model"): { n: number; total: number } {
  const deviations = (evaluation?.deviations ?? []).filter((d) => target === "model" || d.system === target);
  return { n: deviations.filter((d) => !d.outside_normal).length, total: deviations.length };
}

export function targetStatus(target: Target, evaluation: Evaluation | null, radiation: Radiation | null): SystemStatus {
  if (target === "model") return radiation?.storm_active ? "crit" : overallStatus(evaluation);
  if (target === "radiation" && radiation?.storm_active) return "crit";
  return systemStatus(evaluation, target);
}

/** What a ring shows: the share of signals in the normal, or for radiation the dose used. */
export function targetShare(target: Target, evaluation: Evaluation | null, radiation: Radiation | null): number {
  if (target === "radiation" && radiation) return Math.min(radiation.career_fraction, 1);
  const { n, total } = inNormal(evaluation, target);
  return total === 0 ? 0 : n / total;
}
