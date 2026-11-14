import type {
  Clock,
  CrewMemberSummary,
  Evaluation,
  Forecast,
  LiveEvent,
  Radiation,
  Reading,
  System,
} from "./types";

export const HISTORY_LENGTH = 24;

export interface LiveState {
  readings: Record<string, Reading>;
  heartRateHistory: number[];
  evaluation: Evaluation | null;
  radiation: Radiation | null;
  clock: Clock | null;
  forecast: Forecast | null;
  crew: CrewMemberSummary[];
  connected: boolean;
}

export const initialState: LiveState = {
  readings: {},
  heartRateHistory: [],
  evaluation: null,
  radiation: null,
  clock: null,
  forecast: null,
  crew: [],
  connected: false,
};

export type Action =
  | { kind: "event"; event: LiveEvent }
  | { kind: "connection"; connected: boolean }
  /** Another crew member was selected: forget the previous one's data, keep the crew list. */
  | { kind: "reset" };

function withReadings(state: LiveState, readings: Reading[]): LiveState {
  const next = { ...state.readings };
  let history = state.heartRateHistory;
  for (const reading of readings) {
    next[reading.signal] = reading;
    if (reading.signal === "heart_rate") {
      history = [...history, reading.value].slice(-HISTORY_LENGTH);
    }
  }
  return { ...state, readings: next, heartRateHistory: history };
}

export function reduce(state: LiveState, action: Action): LiveState {
  if (action.kind === "connection") {
    return { ...state, connected: action.connected };
  }
  if (action.kind === "reset") {
    return { ...initialState, crew: state.crew };
  }
  const event = action.event;
  switch (event.type) {
    case "snapshot":
    case "readings":
      return withReadings(state, event.readings);
    case "evaluation":
      return { ...state, evaluation: event };
    case "radiation":
      return { ...state, radiation: event };
    case "clock":
      return { ...state, clock: event };
    case "forecast":
      return { ...state, forecast: event };
    case "crew":
      return { ...state, crew: event.members };
    default:
      // A page left open while the server is updated can get messages it does not know yet;
      // ignoring them keeps the panel running instead of losing its whole state.
      return state;
  }
}

export type SystemStatus = "ok" | "warn" | "crit";

export function systemStatus(evaluation: Evaluation | null, system: System): SystemStatus {
  if (!evaluation) return "ok";
  const touching = evaluation.alerts.filter((alert) => alert.systems.includes(system));
  if (touching.some((alert) => alert.level === "emergency")) return "crit";
  if (touching.length > 0) return "warn";
  return "ok";
}

export function overallStatus(evaluation: Evaluation | null): SystemStatus {
  if (!evaluation || evaluation.alerts.length === 0) return "ok";
  return evaluation.alerts.some((alert) => alert.level === "emergency") ? "crit" : "warn";
}
