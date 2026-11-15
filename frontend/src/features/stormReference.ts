import type { StormReference } from "../api/types";

const HOUR_MS = 3_600_000;

/** Dates and times stay in UTC, as NASA DONKI records them. */
export function referenceParams(reference: StormReference) {
  const peak = reference.flare_peak_at;
  const hours = (Date.parse(reference.particles_at) - Date.parse(peak)) / HOUR_MS;
  return {
    source: reference.source,
    flare: reference.flare_class,
    date: peak.slice(0, 10),
    time: peak.slice(11, 16),
    hours: hours.toFixed(1),
    instrument: reference.instrument,
  };
}
