/**
 * ALLINKAY MIND: the four cognitive tests designed by the team's biomedical engineer (her browser
 * prototype, ported here). Pure logic: task generation, scoring and the comparison of a result with
 * the same crew member's earlier sessions. Results stay on this device; nothing is sent anywhere.
 */

export const TESTS = ["reaction", "memory", "pattern", "spatial"] as const;
export type TestId = (typeof TESTS)[number];

/** Trials per session, as in the prototype. */
export const TRIALS: Record<TestId, number> = { reaction: 10, memory: 9, pattern: 10, spatial: 16 };

/** The headline figure of each test once it ends. */
export const METRIC: Record<TestId, { field: string; unit: "ms" | "%"; lowerIsBetter: boolean }> = {
  reaction: { field: "median_reaction_ms", unit: "ms", lowerIsBetter: true },
  memory: { field: "accuracy_pct", unit: "%", lowerIsBetter: false },
  pattern: { field: "accuracy_pct", unit: "%", lowerIsBetter: false },
  spatial: { field: "accuracy_pct", unit: "%", lowerIsBetter: false },
};

export type Rng = () => number;

export const randomInt = (min: number, max: number, rng: Rng = Math.random): number =>
  Math.floor(rng() * (max - min + 1)) + min;
export const choose = <T,>(items: readonly T[], rng: Rng = Math.random): T => items[randomInt(0, items.length - 1, rng)] as T;
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i, rng);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return ((sorted[(sorted.length - 1) >> 1] as number) + (sorted[sorted.length >> 1] as number)) / 2;
}

// ---------------------------------------------------------------- Pattern Solver

export type PatternKind =
  | "add" | "subtract" | "multiply"
  | "growing" | "alternating" | "squares" | "divide"
  | "fibonacci" | "multiply_add" | "interleave" | "cubes";

const PATTERN_KINDS: Record<1 | 2 | 3, PatternKind[]> = {
  1: ["add", "subtract", "multiply"],
  2: ["growing", "alternating", "squares", "divide"],
  3: ["fibonacci", "multiply_add", "interleave", "cubes"],
};

export interface Pattern {
  kind: PatternKind;
  sequence: number[];
  answer: number;
  options: number[];
  level: number;
}

/** A number sequence with one missing next term, and four shuffled options that include the answer. */
export function makePattern(level: 1 | 2 | 3, rng: Rng = Math.random, kind?: PatternKind): Pattern {
  const r = (a: number, b: number) => randomInt(a, b, rng);
  const k = kind ?? choose(PATTERN_KINDS[level], rng);
  let sequence: number[] = [];
  let answer = 0;
  switch (k) {
    case "add": { const a = r(2, 22), d = r(2, 12); sequence = [0, 1, 2, 3, 4].map((i) => a + i * d); answer = a + 5 * d; break; }
    case "subtract": { const a = r(40, 90), d = r(2, 7); sequence = [0, 1, 2, 3, 4].map((i) => a - i * d); answer = a - 5 * d; break; }
    case "multiply": { const a = r(1, 4), m = choose([2, 3], rng); sequence = [0, 1, 2, 3, 4].map((i) => a * m ** i); answer = a * m ** 5; break; }
    case "growing": { const a = r(1, 12), d = r(1, 4), m = r(1, 4); sequence = [a]; for (let i = 0; i < 5; i++) sequence.push((sequence.at(-1) as number) + d + i * m); answer = sequence.pop() as number; break; }
    case "alternating": { const a = r(2, 12), b = r(15, 35), d = r(2, 7); sequence = [a, b, a + d, b + d, a + 2 * d]; answer = b + 2 * d; break; }
    case "squares": { const a = r(1, 5); sequence = [0, 1, 2, 3, 4].map((i) => (a + i) ** 2); answer = (a + 5) ** 2; break; }
    case "divide": { const m = choose([2, 3], rng), a = r(1, 5); sequence = [0, 1, 2, 3, 4].map((i) => a * m ** (5 - i)); answer = a; break; }
    case "fibonacci": { const a = r(1, 7), b = r(2, 9); sequence = [a, b]; while (sequence.length < 6) sequence.push((sequence.at(-1) as number) + (sequence.at(-2) as number)); answer = sequence.pop() as number; break; }
    case "multiply_add": { const a = r(1, 4), m = choose([2, 3], rng), d = r(1, 4); sequence = [a]; while (sequence.length < 6) sequence.push((sequence.at(-1) as number) * m + d); answer = sequence.pop() as number; break; }
    case "interleave": { const a = r(1, 9), b = r(18, 32), d = r(2, 6), m = r(3, 7); sequence = [a, b, a + d, b + m, a + 2 * d]; answer = b + 2 * m; break; }
    case "cubes": { const a = r(1, 3); sequence = [0, 1, 2, 3, 4].map((i) => (a + i) ** 3); answer = (a + 5) ** 3; break; }
  }
  const options = new Set([answer]);
  for (const offset of shuffle([-15, -12, -10, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15], rng)) {
    if (answer + offset >= 0) options.add(answer + offset);
    if (options.size >= 4) break;
  }
  return { kind: k, sequence, answer, options: shuffle([...options].slice(0, 4), rng), level };
}

// ---------------------------------------------------------------- Spatial Navigator

export const TRANSFORMS = ["clockwise", "counterclockwise", "mirrored", "unchanged"] as const;
export type Transform = (typeof TRANSFORMS)[number];
export const DIRECTIONS = ["north", "east", "south", "west"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** An asymmetric craft, so a mirror image never looks like a rotation. */
const HULL: [number, number][] = [[-14, -65], [16, -36], [29, 3], [17, 38], [38, 52], [-16, 38], [-36, 15], [-23, -34]];
const MARK: [number, number][] = [[9, -28], [19, -18], [9, -8], [-1, -18]];

/** SVG points of the craft turned by quarter turns (positive = clockwise on screen), optionally mirrored. */
export function craftPoints(quarterTurns: number, mirrored = false, shape: "hull" | "mark" = "hull"): string {
  const turns = ((quarterTurns % 4) + 4) % 4;
  return (shape === "hull" ? HULL : MARK)
    .map(([x0, y0]) => {
      let x = mirrored ? -x0 : x0;
      let y = y0;
      for (let i = 0; i < turns; i++) [x, y] = [-y, x];
      return `${x + 80},${y + 80}`;
    })
    .join(" ");
}

export interface RecognitionTrial {
  mode: "recognition";
  start: number;
  transform: Transform;
  options: Transform[];
}
export interface NavigationTrial {
  mode: "navigation";
  start: number;
  steps: number[];
  answer: Direction;
  options: Direction[];
}

/** Trials alternate: recognise how the craft changed, then follow a route of turns. */
export function makeSpatialTrial(index: number, level: number, rng: Rng = Math.random): RecognitionTrial | NavigationTrial {
  const start = randomInt(0, 3, rng);
  if (index % 2 === 0) {
    const pool: readonly Transform[] = level === 1 ? ["clockwise", "counterclockwise"] : TRANSFORMS;
    return { mode: "recognition", start, transform: choose(pool, rng), options: shuffle(TRANSFORMS, rng) };
  }
  const steps = level === 1 ? [choose([-1, 1], rng)] : Array.from({ length: level }, () => choose([-2, -1, 1, 2], rng));
  const final = (((start + steps.reduce((a, b) => a + b, 0)) % 4) + 4) % 4;
  return { mode: "navigation", start, steps, answer: DIRECTIONS[final] as Direction, options: shuffle(DIRECTIONS, rng) };
}

/** Quarter turns of the target craft for a recognition trial. */
export const targetTurns = (trial: RecognitionTrial): number =>
  trial.start + (trial.transform === "clockwise" ? 1 : trial.transform === "counterclockwise" ? -1 : 0);

// ---------------------------------------------------------------- Sessions and the personal comparison

/** One answered trial. A false start in Reaction Alert counts as an error and carries no time. */
export interface Trial {
  correct?: boolean;
  false_start?: boolean;
  response_ms?: number;
  level?: number;
  sequence_length?: number;
  mode?: "recognition" | "navigation";
  rule?: string;
}

export interface SessionRecord {
  schema_version: "1.0";
  module: "allinkay_mind";
  app_version: string;
  mode: "adaptive";
  source: "allinkay-app";
  user_id: string;
  test_id: TestId;
  timestamp_utc: string;
  metrics: Record<string, number>;
  trials: Trial[];
}

export const APP_VERSION = "3.0.0";
const STORE = "allinkay_mind_sessions_v1";

/** Saved sessions on this device. Storage can be unavailable (private mode): then nothing is kept. */
export function loadSessions(storage: Storage | undefined = globalThis.localStorage): SessionRecord[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORE) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SessionRecord[]).filter((s) => s?.module === "allinkay_mind") : [];
  } catch {
    return [];
  }
}

export function saveSession(record: SessionRecord, storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    storage?.setItem(STORE, JSON.stringify([...loadSessions(storage), record]));
    return storage !== undefined;
  } catch {
    return false;
  }
}

/** Exploratory thresholds of the prototype: 20% slower or faster, 20 percentage points of accuracy. */
export const SPEED_CHANGE_PCT = 20;
export const ACCURACY_CHANGE_PP = 20;

type Measure = "speed" | "accuracy";

/** Trials are only compared with trials of the same task type and difficulty. */
export function stratum(test: TestId, trial: Trial): string | null {
  if (test === "reaction") return "standard";
  if (test === "memory") return Number.isInteger(trial.sequence_length) ? `length:${trial.sequence_length}` : null;
  if (!Number.isInteger(trial.level)) return null;
  if (test === "spatial") return trial.mode ? `${trial.mode}:level:${trial.level}` : null;
  return `level:${trial.level}`;
}

/** Values per stratum: correct-response times for speed, 0 or 100 per attempt for accuracy. */
function grouped(test: TestId, record: SessionRecord, measure: Measure): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const trial of record.trials ?? []) {
    if (!trial) continue;
    if (trial.false_start && measure === "speed") continue;
    const key = stratum(test, trial);
    if (!key) continue;
    let value: number;
    if (measure === "speed") {
      // Speed counts correct answers only, so fast guessing never looks like an improvement.
      if (trial.correct !== true) continue;
      value = Number(trial.response_ms);
      if (!Number.isFinite(value) || value <= 0) continue;
    } else {
      if (typeof trial.correct !== "boolean" && !trial.false_start) continue;
      value = trial.false_start ? 0 : trial.correct ? 100 : 0;
    }
    out.set(key, [...(out.get(key) ?? []), value]);
  }
  return out;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export type MeasureStatus = "pending" | "within" | "slower" | "faster" | "accuracyDown" | "accuracyUp";

export interface MeasureResult {
  status: MeasureStatus;
  latest: number | null;
  baseline: number | null;
  /** Percent for speed, percentage points for accuracy. */
  change: number | null;
  matchedTrials: number;
  matchedKeys: string[];
}

/** The latest session against the earlier ones, stratum by stratum, weighted by the latest trials. */
function compareMeasure(test: TestId, current: SessionRecord, prior: SessionRecord[], measure: Measure): MeasureResult {
  const now = grouped(test, current, measure);
  const history = prior.map((p) => grouped(test, p, measure));
  const matched: { key: string; count: number; now: number; baseline: number }[] = [];
  for (const [key, values] of now) {
    const earlier = history.filter((h) => h.has(key)).map((h) => median(h.get(key) as number[]) as number);
    if (earlier.length < 3) continue;
    matched.push({ key, count: values.length, now: measure === "speed" ? (median(values) as number) : mean(values), baseline: median(earlier) as number });
  }
  if (matched.length === 0) return { status: "pending", latest: null, baseline: null, change: null, matchedTrials: 0, matchedKeys: [] };
  const n = matched.reduce((a, m) => a + m.count, 0);
  const latest = matched.reduce((a, m) => a + m.now * m.count, 0) / n;
  const baseline = matched.reduce((a, m) => a + m.baseline * m.count, 0) / n;
  const change = measure === "speed" ? (baseline > 0 ? (100 * (latest - baseline)) / baseline : null) : latest - baseline;
  let status: MeasureStatus = "within";
  if (change !== null) {
    if (measure === "speed") {
      if (change >= SPEED_CHANGE_PCT) status = "slower";
      if (change <= -SPEED_CHANGE_PCT) status = "faster";
    } else {
      if (change <= -ACCURACY_CHANGE_PP) status = "accuracyDown";
      if (change >= ACCURACY_CHANGE_PP) status = "accuracyUp";
    }
  }
  return { status, latest, baseline, change, matchedTrials: n, matchedKeys: matched.map((m) => m.key) };
}

export interface ResponseProfile {
  attempts: number;
  errors: number;
  falseStarts: number;
  accuracyPct: number | null;
  medianCorrectMs: number | null;
  medianIncorrectMs: number | null;
}

/** Errors and the times of right and wrong answers in one session, kept apart. */
export function responseProfile(record: SessionRecord): ResponseProfile {
  const correct: number[] = [];
  const incorrect: number[] = [];
  let attempts = 0;
  let errors = 0;
  let falseStarts = 0;
  for (const trial of record.trials ?? []) {
    if (!trial) continue;
    if (trial.false_start) {
      attempts++;
      errors++;
      falseStarts++;
      continue;
    }
    if (typeof trial.correct !== "boolean") continue;
    attempts++;
    if (!trial.correct) errors++;
    const ms = Number(trial.response_ms);
    if (Number.isFinite(ms) && ms > 0) (trial.correct ? correct : incorrect).push(ms);
  }
  return {
    attempts, errors, falseStarts,
    accuracyPct: attempts ? (100 * (attempts - errors)) / attempts : null,
    medianCorrectMs: median(correct), medianIncorrectMs: median(incorrect),
  };
}

export type JointStatus =
  | "pending" | "bothWorse" | "fasterMoreErrors" | "accuracyDecrease" | "moreAccurateSlower" | "slower"
  | "moreErrors" | "bothImproved" | "fasterSameAccuracy" | "moreAccurateSameSpeed" | "within";

/** Speed and accuracy read together: faster is never an improvement when accuracy falls. */
export function jointReading(speed: MeasureResult, accuracy: MeasureResult): JointStatus {
  const sd = speed.change;
  const ad = accuracy.change;
  if (sd === null || ad === null || !Number.isFinite(sd) || !Number.isFinite(ad)) return "pending";
  const faster = sd <= -SPEED_CHANGE_PCT;
  const slower = sd >= SPEED_CHANGE_PCT;
  const accuracyLower = ad < -0.001;
  const accuracyHigher = ad >= ACCURACY_CHANGE_PP;
  if (slower && accuracyLower) return "bothWorse";
  if (faster && accuracyLower) return "fasterMoreErrors";
  if (ad <= -ACCURACY_CHANGE_PP) return "accuracyDecrease";
  if (slower && accuracyHigher) return "moreAccurateSlower";
  if (slower) return "slower";
  if (accuracyLower) return "moreErrors";
  if (faster && accuracyHigher) return "bothImproved";
  if (faster) return "fasterSameAccuracy";
  if (accuracyHigher) return "moreAccurateSameSpeed";
  return "within";
}

/** Readings that ask for a repeat of the test. */
export const REVIEW: readonly JointStatus[] = ["bothWorse", "fasterMoreErrors", "accuracyDecrease", "slower", "moreErrors"];

export interface TestReport {
  sessions: number;
  latest: SessionRecord;
  speed: MeasureResult;
  accuracy: MeasureResult;
  joint: JointStatus;
  profile: ResponseProfile;
  /** Speed per session over the matched strata, oldest first, for a sparkline. */
  speedTrend: number[];
}

/**
 * The latest session of a person against up to ten earlier ones of the same version and source.
 * Each stratum needs three earlier sessions; otherwise the reading waits for a baseline.
 */
export function reportFor(test: TestId, userId: string, sessions: readonly SessionRecord[]): TestReport | null {
  const own = sessions
    .filter((s) => s.user_id === userId && s.test_id === test && s.mode === "adaptive")
    .sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));
  const latest = own.at(-1);
  if (!latest) return null;
  const prior = own.slice(0, -1).filter((s) => s.app_version === latest.app_version && s.source === latest.source).slice(-10);
  const speed = compareMeasure(test, latest, prior, "speed");
  const accuracy = compareMeasure(test, latest, prior, "accuracy");
  const speedTrend = speed.matchedKeys.length
    ? [...prior, latest]
        .map((row) => {
          const group = grouped(test, row, "speed");
          return median(speed.matchedKeys.flatMap((k) => group.get(k) ?? []));
        })
        .filter((v): v is number => v !== null)
    : [];
  return { sessions: own.length, latest, speed, accuracy, joint: jointReading(speed, accuracy), profile: responseProfile(latest), speedTrend };
}
