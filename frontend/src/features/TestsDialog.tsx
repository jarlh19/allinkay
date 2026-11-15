import { useEffect, useRef } from "react";

import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";

/**
 * The cognitive tests the team's biomedical engineer is building (Python prototypes today), each
 * next to the test of NASA's Cognition battery it resembles (Basner et al., 2015).
 */
export const COGNITIVE_TESTS = ["reaction", "memory", "patterns", "spatial"] as const;
export type CognitiveTest = (typeof COGNITIVE_TESTS)[number];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TestsDialog({ open, onClose }: Props) {
  const { t } = useI18n();
  const close = useRef<HTMLButtonElement>(null);

  // Focus moves into the window only when it opens, not when the live screen re-renders it.
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

  if (!open) return null;

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog panel tests-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tests-title"
        aria-describedby="tests-intro"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="tests-title">{t("tests.title")}</h2>
        <p id="tests-intro" className="tests-intro">
          {t("tests.intro")}
        </p>
        <ul className="tests-grid">
          {COGNITIVE_TESTS.map((test) => (
            <li key={test} className="test-card">
              <h3>
                {t(`tests.${test}` as MessageKey)}
                <span className="test-status">{t("tests.status")}</span>
              </h3>
              <p>{t(`tests.${test}What` as MessageKey)}</p>
              <p className="test-nasa">
                {t("tests.nasaLabel")}: <strong>{t(`tests.${test}Nasa` as MessageKey)}</strong>
              </p>
            </li>
          ))}
        </ul>
        <p className="note">{t("tests.privacy")}</p>
        <p className="note">{t("tests.source")}</p>
        <div className="form-actions">
          <button ref={close} type="button" className="lang" onClick={onClose}>
            {t("actions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
