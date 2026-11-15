import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { Game, type Metrics } from "./cognitive/Games";
import {
  APP_VERSION,
  METRIC,
  TESTS,
  loadSessions,
  reportFor,
  saveSession,
  type TestId,
  type TestReport,
} from "./cognitive/engine";

/** The cognitive tests (ALLINKAY MIND), each next to the test of NASA's Cognition battery it resembles. */
export const COGNITIVE_TESTS = TESTS;
export type CognitiveTest = TestId;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Who takes the test: results are kept and compared per crew member. */
  crewId: string;
  crewName: string;
}

type View = { kind: "list" } | { kind: "game"; test: TestId; run: number } | { kind: "done"; test: TestId; metrics: Metrics; saved: boolean };

function formatValue(test: TestId, value: number): string {
  return METRIC[test].unit === "ms" ? `${Math.round(value)} ms` : `${Math.round(value)}%`;
}

export function TestsDialog({ open, onClose, crewId, crewName }: Props) {
  const { t } = useI18n();
  const close = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [sessions, setSessions] = useState(loadSessions);

  // The window mounts when it opens, so it starts on the list with fresh sessions; focus moves in once.
  useEffect(() => {
    if (open) close.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const finish = useCallback(
    (test: TestId, metrics: Metrics) => {
      const saved = saveSession({
        schema_version: "1.0",
        module: "allinkay_mind",
        app_version: APP_VERSION,
        mode: "adaptive",
        source: "allinkay-app",
        user_id: crewId,
        test_id: test,
        timestamp_utc: new Date().toISOString(),
        metrics,
      });
      setSessions(loadSessions());
      setView({ kind: "done", test, metrics, saved });
    },
    [crewId],
  );

  if (!open) return null;

  const comparison = (test: TestId, report: TestReport | null): string => {
    if (!report) return t("tests.never");
    if (report.status === "pending") return t("tests.pending", { n: Math.max(1, 4 - report.sessions) });
    const base = formatValue(test, report.baseline as number);
    if (report.status === "review") return t("tests.review", { c: Math.round(Math.abs(report.changePct ?? 0)), b: base });
    return t("tests.steady", { b: base });
  };

  let body;
  if (view.kind === "list") {
    body = (
      <>
        <p id="tests-intro" className="tests-intro">
          {t("tests.intro")}
        </p>
        <ul className="tests-grid">
          {TESTS.map((test) => {
            const report = reportFor(test, crewId, sessions);
            return (
              <li key={test} className="test-card">
                <h3>{t(`tests.${test}Game` as MessageKey)}</h3>
                <p>{t(`tests.${test}What` as MessageKey)}</p>
                <p className="test-nasa">
                  {t("tests.nasaLabel")}: <strong>{t(`tests.${test}Nasa` as MessageKey)}</strong>
                </p>
                <p className={`test-last${report?.status === "review" ? " warn" : ""}`}>
                  {report ? `${t("tests.latest", { v: formatValue(test, report.latest) })} · ` : ""}
                  {comparison(test, report)}
                </p>
                <button type="button" className="tests-start" onClick={() => setView({ kind: "game", test, run: Date.now() })}>
                  {t("tests.start")}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="note">{t("tests.privacy")}</p>
        <p className="note">{t("tests.source")}</p>
      </>
    );
  } else if (view.kind === "game") {
    body = (
      <section className="mind" aria-labelledby="mind-title">
        <p className="mind-domain">{t(`tests.${view.test}` as MessageKey)}</p>
        <h3 id="mind-title">{t(`tests.${view.test}Game` as MessageKey)}</h3>
        <p className="mind-how">{t(`tests.${view.test}How` as MessageKey)}</p>
        <Game key={view.run} test={view.test} onDone={(metrics) => finish(view.test, metrics)} />
      </section>
    );
  } else {
    const report = reportFor(view.test, crewId, sessions);
    const key = METRIC[view.test].field;
    body = (
      <section className="mind mind-done" aria-live="polite">
        <p className="mind-domain">{t("tests.done")}</p>
        <h3>{t(`tests.${view.test}Game` as MessageKey)}</h3>
        <p className="mind-score">{formatValue(view.test, view.metrics[key] ?? 0)}</p>
        {view.test === "reaction" && <p className="mind-how">{t("tests.falseStarts", { n: view.metrics.false_starts ?? 0 })}</p>}
        <p className={`mind-compare${report?.status === "review" ? " warn" : ""}`}>{comparison(view.test, report)}</p>
        <p className="note">{view.saved ? t("tests.saved", { name: crewName }) : t("tests.notSaved")}</p>
        <div className="form-actions">
          <button type="button" className="lang" onClick={() => setView({ kind: "game", test: view.test, run: Date.now() })}>
            {t("tests.repeat")}
          </button>
          <button type="button" className="lang" onClick={() => setView({ kind: "list" })}>
            {t("tests.back")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog panel tests-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tests-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="tests-title">
          {t("tests.title")}
          <span className="tests-for">{t("tests.for", { name: crewName })}</span>
        </h2>
        {view.kind === "game" && (
          <button type="button" className="tests-back" onClick={() => setView({ kind: "list" })}>
            ← {t("tests.back")}
          </button>
        )}
        {body}
        <div className="form-actions">
          <button ref={close} type="button" className="lang" onClick={onClose}>
            {t("actions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
