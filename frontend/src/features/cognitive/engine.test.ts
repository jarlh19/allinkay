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
  type PatternKind,
  type SessionRecord,
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

const session = (test: SessionRecord["test_id"], value: number, day: number, user = "commander"): SessionRecord => ({
  schema_version: "1.0",
  module: "allinkay_mind",
  app_version: "2.0.0",
  mode: "adaptive",
  source: "allinkay-app",
  user_id: user,
  test_id: test,
  timestamp_utc: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`,
  metrics: test === "reaction" ? { median_reaction_ms: value } : { accuracy_pct: value },
});

describe("Personal comparison", () => {
  it("waits for three earlier sessions before it compares", () => {
    const report = reportFor("reaction", "commander", [session("reaction", 300, 1), session("reaction", 310, 2), session("reaction", 305, 3)]);
    expect(report?.status).toBe("pending");
    expect(report?.sessions).toBe(3);
  });

  it("asks for a review when reaction time is 20% slower than the person's own median", () => {
    const sessions = [300, 310, 305, 380].map((ms, i) => session("reaction", ms, i + 1));
    const report = reportFor("reaction", "commander", sessions);
    expect(report?.baseline).toBe(305);
    expect(report?.status).toBe("review");
    expect(reportFor("reaction", "commander", [...sessions.slice(0, 3), session("reaction", 290, 4)])?.status).toBe("steady");
  });

  it("asks for a review when accuracy drops by 20% or more, and only counts that person", () => {
    const sessions = [90, 80, 85, 60].map((pct, i) => session("memory", pct, i + 1));
    expect(reportFor("memory", "commander", sessions)?.status).toBe("review");
    expect(reportFor("memory", "engineer", sessions)).toBeNull();
    expect(median([1, 5, 3])).toBe(3);
  });

  it("keeps sessions in local storage and survives storage that fails", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage;
    expect(saveSession(session("pattern", 70, 1), storage)).toBe(true);
    expect(loadSessions(storage)).toHaveLength(1);

    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    } as unknown as Storage;
    expect(loadSessions(broken)).toEqual([]);
    expect(saveSession(session("pattern", 70, 1), broken)).toBe(false);
  });
});
