import { describe, expect, it } from "vitest";

import { HISTORY_LENGTH, initialState, overallStatus, reduce, systemStatus } from "./liveState";
import type { Alert, Evaluation, Reading } from "./types";

const reading = (signal: string, value: number): Reading => ({
  signal,
  value,
  unit: "bpm",
  system: "cardiovascular",
  frequency: "live",
  taken_at: "2026-11-14T00:00:00+00:00",
  source: "simulator",
});

const alert = (level: Alert["level"], systems: Alert["systems"]): Alert => ({
  kind: level === "emergency" ? "solar_storm" : "outside_normal",
  level,
  systems,
  signals: [],
  action: "action.sleep_and_workload",
  reference: { id: "r", title: "NASA", url: "https://www.nasa.gov/" },
  evidence: [],
});

const evaluation = (alerts: Alert[]): Evaluation => ({
  type: "evaluation",
  mode: "ship",
  mitigation: "mitigation.ship_routines",
  deviations: [],
  alerts,
});

describe("reduce", () => {
  it("keeps the latest reading of each signal", () => {
    let state = reduce(initialState, { kind: "event", event: { type: "snapshot", readings: [reading("heart_rate", 70)] } });
    state = reduce(state, { kind: "event", event: { type: "readings", at: "x", readings: [reading("heart_rate", 75)] } });

    expect(state.readings.heart_rate?.value).toBe(75);
    expect(state.heartRateHistory).toEqual([70, 75]);
  });

  it("caps the heart rate history", () => {
    let state = initialState;
    for (let i = 0; i < HISTORY_LENGTH + 5; i += 1) {
      state = reduce(state, { kind: "event", event: { type: "readings", at: "x", readings: [reading("heart_rate", i)] } });
    }

    expect(state.heartRateHistory).toHaveLength(HISTORY_LENGTH);
    expect(state.heartRateHistory.at(-1)).toBe(HISTORY_LENGTH + 4);
  });

  it("tracks the connection", () => {
    expect(reduce(initialState, { kind: "connection", connected: true }).connected).toBe(true);
  });
});

describe("status", () => {
  it("is ok without alerts, warn with attention and crit with an emergency", () => {
    expect(systemStatus(null, "immune")).toBe("ok");
    expect(systemStatus(evaluation([alert("attention", ["immune"])]), "immune")).toBe("warn");
    expect(systemStatus(evaluation([alert("attention", ["immune"])]), "cardiovascular")).toBe("ok");
    expect(systemStatus(evaluation([alert("emergency", ["radiation"])]), "radiation")).toBe("crit");
    expect(overallStatus(evaluation([alert("attention", ["immune"]), alert("emergency", ["radiation"])]))).toBe("crit");
  });
});
