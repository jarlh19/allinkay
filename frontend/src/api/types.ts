export type System = "cardiovascular" | "neurological" | "immune" | "environment" | "radiation";
export type Frequency = "live" | "daily" | "exam";
export type Mode = "ship" | "field";

export interface Reading {
  signal: string;
  value: number;
  unit: string;
  system: System;
  frequency: Frequency;
  taken_at: string;
  source: string;
}

export interface Deviation {
  signal: string;
  system: System;
  value: number;
  unit: string;
  baseline_mean: number;
  normal_low: number;
  normal_high: number;
  baseline_source: string;
  z_score: number;
  outside_normal: boolean;
  confirmed: boolean;
}

export interface Evidence {
  signal: string;
  value: number;
  unit: string;
  normal_low: number;
  normal_high: number;
  z_score: number;
  direction: "above" | "below";
}

export interface Alert {
  kind: "outside_normal" | "combined_pattern" | "solar_storm";
  level: "attention" | "emergency";
  systems: System[];
  signals: string[];
  action: string;
  reference: { id: string; title: string; url: string };
  evidence: Evidence[];
}

export interface Evaluation {
  type: "evaluation";
  mode: Mode;
  mitigation: string;
  deviations: Deviation[];
  alerts: Alert[];
}

export interface Radiation {
  type: "radiation";
  dose_rate_msv_per_day: number;
  accumulated_msv: number;
  career_limit_msv: number;
  career_fraction: number;
  days_to_limit: number | null;
  event_limit_msv: number;
  storm_active: boolean;
  storm_dose_msv: number;
  organs_at_risk: { organ: string; timeframe: string }[];
}

export interface Clock {
  type: "clock";
  at: string | null;
  mission_day: number | null;
}

export type LiveEvent =
  | { type: "snapshot"; readings: Reading[] }
  | { type: "readings"; at: string; readings: Reading[] }
  | Evaluation
  | Radiation
  | Clock;
