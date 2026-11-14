import type { System } from "../api/types";
import type { MessageKey } from "../i18n/messages";

export const SYSTEM_SIGNALS: Record<Exclude<System, "radiation">, string[]> = {
  cardiovascular: ["heart_rate", "systolic_bp", "diastolic_bp", "spo2"],
  neurological: ["sleep_hours", "mood", "reaction_time"],
  immune: ["body_temperature", "white_blood_cells", "glucose", "symptoms"],
  environment: ["cabin_temperature", "cabin_co2", "cabin_pressure", "cabin_ppo2"],
};

const DECIMALS: Record<string, number> = {
  sleep_hours: 1,
  body_temperature: 1,
  white_blood_cells: 1,
  cabin_temperature: 1,
  cabin_co2: 1,
  cabin_pressure: 1,
  cabin_ppo2: 1,
  dose_today: 2,
};

export function formatValue(signal: string, value: number): string {
  return value.toFixed(DECIMALS[signal] ?? 0);
}

export function signalKey(signal: string): MessageKey {
  return `signal.${signal}` as MessageKey;
}

export function systemKey(system: System): MessageKey {
  return `system.${system}` as MessageKey;
}

const UNIT_LABELS: Record<string, string> = { "10^3/µL": "×10³/µL", count: "", "1-5": "/5" };

export function formatUnit(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}
