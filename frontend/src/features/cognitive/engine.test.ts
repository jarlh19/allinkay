import { describe, expect, it } from "vitest";

import {
  DIRECTIONS,
  craftPoints,
  loadSessions,
  makePattern,
  makeSpatialTrial,
  median,
  reportFor,
  saveSession,
  targetTurns,
  REVIEW,
  type PatternKind,
  type SessionRecord,
  type Trial,
} from "./engine";

const KINDS: [PatternKind, 1 | 2 | 3][] = [
  ["add", 1], ["subtract", 1], ["multiply", 1],
  ["growing", 2], ["alternating", 2], ["squares", 2], ["divide", 2],
  ["fibonacci", 3], ["multiply_add", 3], ["interleave", 3], ["cubes", 3],
];

describe("Pattern Solver", () => {
  it.each(KINDS)("%s: four different, non-negative options that include the answer", (kind, level) => {
    for (let i = 0; i < 40; i++) {
      const p = makePattern(level, Math.random, kind);
      expect(p.options).toHaveLength(4);
      expect(new Set(p.options).size).toBe(4);
      expect(p.options).toContain(p.answer);
      expect(p.options.every((o) => o >= 0)).toBe(true);
    }
  });

  it("continues each rule with the right next term", () => {
    const add = makePattern(1, Math.random, "add");
    const d = (add.sequence[1] as number) - (add.sequence[0] as number);
    expect(add.answer).toBe((add.sequence.at(-1) as number) + d);

    const fib = makePattern(3, Math.random, "fibonacci");
    expect(fib.answer).toBe((fib.sequence.at(-1) as number) + (fib.sequence.at(-2) as number));

    const squares = makePattern(2, Math.random, "squares");
    expect(Math.sqrt(squares.answer)).toBe(Math.sqrt(squares.sequence.at(-1) as number) + 1);
  });
});

describe("Spatial Navigator", () => {
  it("turns the craft clockwise in quarter turns and back to the start after four", () => {
    expect(craftPoints(4)).toBe(craftPoints(0));
    expect(craftPoints(-1)).toBe(craftPoints(3));
    // The nose points up at rest; one clockwise quarter turn points it right (x grows).
    const nose = (points: string) => Number(points.split(" ")[0]?.split(",")[0]);
    expect(nose(craftPoints(1))).toBeGreaterThan(nose(craftPoints(0)));
  });

  it("alternates recognition and navigation, and the route's answer is where the turns end", () => {
    for (let i = 0; i < 40; i++) {
      const recognition = makeSpatialTrial(0, 1);
      expect(recognition.mode).toBe("recognition");
      if (recognition.mode === "recognition") {
        expect(["clockwise", "counterclockwise"]).toContain(recognition.transform);
        expect(targetTurns(recognition)).toBe(recognition.start + (recognition.transform === "clockwise" ? 1 : -1));
      }
      const navigation = makeSpatialTrial(1, 3);
      expect(navigation.mode).toBe("navigation");
      if (navigation.mode === "navigation") {
        expect(navigation.steps).toHaveLength(3);
        const end = (((navigation.start + navigation.steps.reduce((a, b) => a + b, 0)) % 4) + 4) % 4;
        expect(navigation.answer).toBe(DIRECTIONS[end]);
        expect([...navigation.options].sort()).toEqual([...DIRECTIONS].sort());
      }
    }
  });
});

const session = (test: SessionRecord["test_id"], trials: Trial[], day: number, user = "commander"): SessionRecord => ({
  schema_version: "1.0",
  module: "allinkay_mind",
  app_version: "3.0.0",
  mode: "adaptive",
  source: "allinkay-app",
  user_id: user,
  test_id: test,
  timestamp_utc: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`,
  metrics: {},
  trials,
});
const right = (ms: number, level = 1): Trial => ({ correct: true, response_ms: ms, level });
const wrong = (ms: number, level = 1): Trial => ({ correct: false, response_ms: ms, level });
const reaction = (ms: number[]) => ms.map((m) => ({ ...right(m), level: 1 }));

describe("Personal comparison (speed and accuracy, read together)", () => {
  it("waits for three earlier sessions at the same level before it reads anything", () => {
    const sessions = [1, 2, 3].map((day) => session("reaction", reaction([300, 310, 305]), day));
    const report = reportFor("reaction", "commander", sessions);
    expect(report?.joint).toBe("pending");
    expect(report?.sessions).toBe(3);
  });

  it("flags correct answers 20% slower than the person's own baseline", () => {
    const sessions = [
      ...[1, 2, 3].map((day) => session("reaction", reaction([300, 310, 305]), day)),
      session("reaction", reaction([380, 385, 390]), 4),
    ];
    const report = reportFor("reaction", "commander", sessions);
    expect(report?.speed.status).toBe("slower");
    expect(report?.accuracy.status).toBe("within");
    expect(report?.joint).toBe("slower");
    expect(REVIEW).toContain(report?.joint);
  });

  it("never calls faster answers an improvement when errors went up", () => {
    const sessions = [
      ...[1, 2, 3].map((day) => session("pattern", [right(2000), right(2100), right(1900), right(2000)], day)),
      session("pattern", [right(1400), right(1500), wrong(900), right(1450)], 4),
    ];
    const report = reportFor("pattern", "commander", sessions);
    expect(report?.speed.status).toBe("faster");
    expect(report?.joint).toBe("fasterMoreErrors");
    expect(report?.profile).toMatchObject({ attempts: 4, errors: 1, medianIncorrectMs: 900 });
  });

  it("reads an accuracy drop of 20 points or more, and compares only the same level", () => {
    const steady = [right(3000, 3), right(3100, 3), right(2900, 3), right(3000, 3)];
    const memory = (trials: Trial[]) => trials.map((t) => ({ ...t, sequence_length: t.level }));
    const sessions = [
      ...[1, 2, 3].map((day) => session("memory", memory(steady), day)),
      session("memory", memory([right(3000, 3), wrong(1200, 3), wrong(1500, 3), right(3050, 3), right(5000, 7)]), 4),
    ];
    const report = reportFor("memory", "commander", sessions);
    expect(report?.accuracy.status).toBe("accuracyDown");
    expect(report?.accuracy.matchedKeys).toEqual(["length:3"]);
    expect(report?.joint).toBe("accuracyDecrease");
    expect(reportFor("memory", "engineer", sessions)).toBeNull();
  });

  it("counts a false start as an error in accuracy, never as a time", () => {
    const sessions = [
      ...[1, 2, 3].map((day) => session("reaction", reaction([300, 300, 300]), day)),
      session("reaction", [...reaction([300, 300]), { false_start: true }], 4),
    ];
    const report = reportFor("reaction", "commander", sessions);
    expect(report?.profile).toMatchObject({ attempts: 3, errors: 1, falseStarts: 1 });
    expect(report?.speed.latest).toBe(300);
    expect(report?.accuracy.change).toBeCloseTo(-33.3, 1);
    expect(median([1, 5, 3])).toBe(3);
  });

  it("keeps sessions in local storage and survives storage that fails", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage;
    expect(saveSession(session("pattern", [right(1000)], 1), storage)).toBe(true);
    expect(loadSessions(storage)).toHaveLength(1);

    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    } as unknown as Storage;
    expect(loadSessions(broken)).toEqual([]);
    expect(saveSession(session("pattern", [right(1000)], 1), broken)).toBe(false);
  });
});
