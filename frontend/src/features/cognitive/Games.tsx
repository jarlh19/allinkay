import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import {
  TRIALS,
  craftPoints,
  makePattern,
  makeSpatialTrial,
  median,
  randomInt,
  shuffle,
  targetTurns,
  type NavigationTrial,
  type Pattern,
  type RecognitionTrial,
  type TestId,
} from "./engine";

export type Metrics = Record<string, number>;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** The live counters above every test. */
function Counters({ trial, total, level, correct, answered, times }: {
  trial: number; total: number; level: number; correct: number; answered: number; times: number[];
}) {
  const { t } = useI18n();
  const mid = median(times);
  return (
    <dl className="mind-counters">
      <div><dt>{t("tests.trial")}</dt><dd>{Math.min(trial, total)} / {total}</dd></div>
      <div><dt>{t("tests.level")}</dt><dd>{level}</dd></div>
      <div><dt>{t("tests.accuracy")}</dt><dd>{answered ? `${Math.round((100 * correct) / answered)}%` : "–"}</dd></div>
      <div><dt>{t("tests.median")}</dt><dd>{mid === null ? "–" : `${Math.round(mid)} ms`}</dd></div>
    </dl>
  );
}

/** Digits 1 to 4 pick an answer, as in the prototype. */
function useDigitKeys(onDigit: (index: number) => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (/^Digit[1-4]$/.test(event.code)) onDigit(Number(event.code.slice(-1)) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDigit, active]);
}

// ---------------------------------------------------------------- Reaction Alert

type ReactionPhase = "ready" | "waiting" | "go" | "result" | "early";

function ReactionAlert({ onDone }: { onDone: (m: Metrics) => void }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<ReactionPhase>("ready");
  const [times, setTimes] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const signalAt = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = useCallback(() => {
    if (phase === "ready") {
      setPhase("waiting");
      timer.current = window.setTimeout(() => {
        setPhase("go");
        // The clock starts when the green signal is painted.
        requestAnimationFrame(() => {
          signalAt.current = performance.now();
        });
      }, randomInt(1700, 4600));
    } else if (phase === "waiting") {
      window.clearTimeout(timer.current);
      setFalseStarts((n) => n + 1);
      setPhase("early");
      timer.current = window.setTimeout(() => setPhase("ready"), 750);
    } else if (phase === "go" && signalAt.current > 0) {
      const ms = round1(performance.now() - signalAt.current);
      signalAt.current = 0;
      const next = [...times, ms];
      setTimes(next);
      setLast(ms);
      setPhase("result");
      timer.current = window.setTimeout(() => {
        if (next.length >= TRIALS.reaction) {
          onDone({ median_reaction_ms: Math.round((median(next) as number) * 100) / 100, valid_trials: next.length, false_starts: falseStarts });
        } else setPhase("ready");
      }, 600);
    }
  }, [phase, times, falseStarts, onDone]);

  // Space works too, except on a focused button, which already turns Space into a click.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || (event.target as HTMLElement | null)?.tagName === "BUTTON") return;
      event.preventDefault();
      press();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const message: Record<ReactionPhase, string> = {
    ready: t("tests.r.begin"),
    waiting: t("tests.r.wait"),
    go: t("tests.r.now"),
    result: last === null ? "" : `${last} ms`,
    early: t("tests.r.early"),
  };
  return (
    <>
      <Counters trial={times.length + 1} total={TRIALS.reaction} level={1} correct={times.length} answered={times.length} times={times} />
      <div className="mind-arena">
        <p className="mind-small">{t("tests.r.trial", { n: Math.min(times.length + 1, TRIALS.reaction), total: TRIALS.reaction })}</p>
        <button type="button" className={`mind-signal ${phase}`} onClick={press} aria-label={t("tests.r.signal")} />
        <p className="mind-message" aria-live="polite">{message[phase]}</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Memory Matrix

function MemoryMatrix({ onDone }: { onDone: (m: Metrics) => void }) {
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  const [length, setLength] = useState(3);
  const [sequence, setSequence] = useState<number[]>(() => shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3));
  const [phase, setPhase] = useState<"show" | "answer" | "feedback">("show");
  const [lit, setLit] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [correct, setCorrect] = useState(0);
  const [longest, setLongest] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // Each round lights its tiles one by one, then waits for the answer.
  useEffect(() => {
    let at = 550;
    sequence.forEach((tile) => {
      later(at, () => setLit(tile));
      later(at + 540, () => setLit(null));
      at += 800;
    });
    later(at, () => setPhase("answer"));
    const pending = timers.current;
    return () => pending.splice(0).forEach((id) => window.clearTimeout(id));
  }, [sequence]);

  const tap = (tile: number) => {
    if (phase !== "answer") return;
    const next = [...picked, tile];
    setPicked(next);
    const wrong = tile !== sequence[next.length - 1];
    if (!wrong && next.length < sequence.length) return;
    const ok = !wrong;
    const nextCorrect = correct + Number(ok);
    const nextLongest = ok ? Math.max(longest, sequence.length) : longest;
    const nextLength = Math.max(3, Math.min(9, length + (ok ? 1 : -1)));
    setCorrect(nextCorrect);
    setLongest(nextLongest);
    setResult(ok);
    setPhase("feedback");
    later(850, () => {
      if (round + 1 >= TRIALS.memory) {
        onDone({ correct_rounds: nextCorrect, total_rounds: TRIALS.memory, accuracy_pct: round1((100 * nextCorrect) / TRIALS.memory), max_correct_sequence: nextLongest, final_level: nextLength });
        return;
      }
      setRound(round + 1);
      setLength(nextLength);
      setPhase("show");
      setPicked([]);
      setResult(null);
      setSequence(shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, nextLength));
    });
  };

  const message = phase === "show" ? t("tests.m.watch") : phase === "answer" ? t("tests.m.repeat") : t(result ? "tests.correct" : "tests.incorrect");
  return (
    <>
      <Counters trial={round + 1} total={TRIALS.memory} level={length} correct={correct} answered={round + (phase === "feedback" ? 1 : 0)} times={[]} />
      <div className="mind-arena">
        <p className="mind-small">{t("tests.m.round", { n: round + 1, total: TRIALS.memory, k: sequence.length })}</p>
        <div className="mind-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`mind-tile${lit === i ? " lit" : ""}${picked.includes(i) && phase !== "show" ? " picked" : ""}`}
              aria-label={t("tests.m.tile", { n: i + 1 })}
              disabled={phase !== "answer"}
              onClick={() => tap(i)}
            />
          ))}
        </div>
        <p className="mind-message" aria-live="polite">{message}</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- choices shared by Pattern Solver and Spatial Navigator

function Choices({ labels, onPick, locked }: { labels: string[]; onPick: (i: number) => void; locked: boolean }) {
  useDigitKeys(onPick, !locked);
  return (
    <div className="mind-choices">
      {labels.map((label, i) => (
        <button key={i} type="button" className="mind-choice" disabled={locked} onClick={() => onPick(i)}>
          <span aria-hidden="true">{i + 1}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

interface Adaptive {
  trial: number;
  level: number;
  streak: number;
  correct: number;
  times: number[];
}

/** Shared bookkeeping: response time, accuracy and the adaptive level. */
function useAdaptive(maxLevel: number, streakToLevelUp: number) {
  const [state, setState] = useState<Adaptive>({ trial: 0, level: 1, streak: 0, correct: 0, times: [] });
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const shownAt = useRef(0);
  // The response clock starts when the first trial is on screen.
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  const answer = (ok: boolean): Adaptive => {
    const rt = round1(performance.now() - shownAt.current);
    const streak = ok ? state.streak + 1 : 0;
    let level = state.level;
    let nextStreak = streak;
    if (!ok) level = Math.max(1, level - 1);
    else if (streak >= streakToLevelUp) {
      level = Math.min(maxLevel, level + 1);
      nextStreak = 0;
    }
    const next = { trial: state.trial + 1, level, streak: nextStreak, correct: state.correct + Number(ok), times: [...state.times, rt] };
    setFeedback(ok);
    return next;
  };
  const advance = (next: Adaptive) => {
    setState(next);
    setFeedback(null);
    shownAt.current = performance.now();
  };
  return { state, feedback, answer, advance };
}

// ---------------------------------------------------------------- Pattern Solver

function PatternSolver({ onDone }: { onDone: (m: Metrics) => void }) {
  const { t } = useI18n();
  const { state, feedback, answer, advance } = useAdaptive(3, 2);
  const [pattern, setPattern] = useState<Pattern>(() => makePattern(1));
  const pick = useCallback((i: number) => {
    if (feedback !== null) return;
    const next = answer(pattern.options[i] === pattern.answer);
    window.setTimeout(() => {
      if (next.trial >= TRIALS.pattern) {
        onDone({ correct: next.correct, total: TRIALS.pattern, accuracy_pct: next.correct * 10, median_response_ms: round1(median(next.times) as number), final_level: next.level });
        return;
      }
      setPattern(makePattern(next.level as 1 | 2 | 3));
      advance(next);
    }, 500);
  }, [feedback, answer, pattern, onDone, advance]);
  return (
    <>
      <Counters trial={state.trial + 1} total={TRIALS.pattern} level={state.level} correct={state.correct} answered={state.trial} times={state.times} />
      <div className="mind-arena">
        <p className="mind-small">{t("tests.p.prompt")}</p>
        <p className="mind-sequence">{[...pattern.sequence, "?"].join("  ·  ")}</p>
        <Choices labels={pattern.options.map(String)} onPick={pick} locked={feedback !== null} />
        <p className="mind-message" aria-live="polite">{feedback === null ? "" : t(feedback ? "tests.correct" : "tests.incorrect")}</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Spatial Navigator

function Craft({ turns, mirrored = false, label }: { turns: number; mirrored?: boolean; label: string }) {
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={label} className="mind-craft">
      <polygon points={craftPoints(turns, mirrored)} className="hull" />
      <polygon points={craftPoints(turns, mirrored, "mark")} className="mark" />
      <circle cx="80" cy="80" r="3" className="pivot" />
    </svg>
  );
}

function SpatialNavigator({ onDone }: { onDone: (m: Metrics) => void }) {
  const { t } = useI18n();
  const { state, feedback, answer, advance } = useAdaptive(4, 3);
  const [trial, setTrial] = useState<RecognitionTrial | NavigationTrial>(() => makeSpatialTrial(0, 1));
  // Correct and total answers per kind of trial.
  const [byMode, setByMode] = useState<Record<"recognition" | "navigation", { correct: number; total: number }>>({
    recognition: { correct: 0, total: 0 },
    navigation: { correct: 0, total: 0 },
  });
  const labels = (trial.options as readonly string[]).map((o) => t(`tests.s.${o}` as MessageKey));
  const pick = useCallback((i: number) => {
    if (feedback !== null) return;
    const ok = trial.mode === "recognition" ? trial.options[i] === trial.transform : trial.options[i] === trial.answer;
    const next = answer(ok);
    const counts = { ...byMode, [trial.mode]: { correct: byMode[trial.mode].correct + Number(ok), total: byMode[trial.mode].total + 1 } };
    setByMode(counts);
    window.setTimeout(() => {
      if (next.trial >= TRIALS.spatial) {
        const pct = ({ correct, total }: { correct: number; total: number }) => round1((100 * correct) / Math.max(1, total));
        onDone({
          correct: next.correct, total: TRIALS.spatial, accuracy_pct: round1((100 * next.correct) / TRIALS.spatial),
          median_response_ms: round1(median(next.times) as number),
          recognition_accuracy_pct: pct(counts.recognition), navigation_accuracy_pct: pct(counts.navigation), final_level: next.level,
        });
        return;
      }
      setTrial(makeSpatialTrial(next.trial, next.level));
      advance(next);
    }, 500);
  }, [feedback, trial, answer, byMode, onDone, advance]);

  let picture: ReactNode;
  if (trial.mode === "recognition") {
    picture = (
      <>
        <p className="mind-small">{t("tests.s.identify")}</p>
        <div className="mind-crafts">
          <figure><Craft turns={trial.start} label={t("tests.s.reference")} /><figcaption>{t("tests.s.reference")}</figcaption></figure>
          <figure><Craft turns={targetTurns(trial)} mirrored={trial.transform === "mirrored"} label={t("tests.s.target")} /><figcaption>{t("tests.s.target")}</figcaption></figure>
        </div>
      </>
    );
  } else {
    const startDir = t(`tests.s.${["north", "east", "south", "west"][trial.start]}` as MessageKey);
    picture = (
      <>
        <p className="mind-small">{t("tests.s.where")}</p>
        <div className="mind-crafts">
          <figure><Craft turns={trial.start} label={t("tests.s.start", { dir: startDir })} /><figcaption>{t("tests.s.start", { dir: startDir })}</figcaption></figure>
        </div>
        <ol className="mind-route">
          {trial.steps.map((s, i) => (
            <li key={i}>{t("tests.s.step", { deg: Math.abs(s) * 90, dir: t(s > 0 ? "tests.s.clockwise" : "tests.s.counterclockwise") })}</li>
          ))}
        </ol>
      </>
    );
  }
  return (
    <>
      <Counters trial={state.trial + 1} total={TRIALS.spatial} level={state.level} correct={state.correct} answered={state.trial} times={state.times} />
      <div className="mind-arena">
        {picture}
        <Choices labels={labels} onPick={pick} locked={feedback !== null} />
        <p className="mind-message" aria-live="polite">{feedback === null ? "" : t(feedback ? "tests.correct" : "tests.incorrect")}</p>
      </div>
    </>
  );
}

export function Game({ test, onDone }: { test: TestId; onDone: (m: Metrics) => void }) {
  if (test === "reaction") return <ReactionAlert onDone={onDone} />;
  if (test === "memory") return <MemoryMatrix onDone={onDone} />;
  if (test === "pattern") return <PatternSolver onDone={onDone} />;
  return <SpatialNavigator onDone={onDone} />;
}
