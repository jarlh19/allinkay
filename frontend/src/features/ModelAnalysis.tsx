import type { Evaluation, Radiation } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { alertTitle } from "./ModelPanel";
import { signalKey } from "./signals";
import { StatusChip } from "./StatusChip";
import { targetStatus } from "./statusSummary";

const MAX_LINES = 3;

/** A short reading of what the model sees now: confirmed changes and exams to repeat. */
export function ModelAnalysis({
  evaluation,
  radiation,
  onOpen,
}: {
  evaluation: Evaluation | null;
  radiation: Radiation | null;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const alerts = evaluation?.alerts ?? [];
  const repeats = (evaluation?.deviations ?? []).filter((d) => d.repeat_requested);

  return (
    <section className="panel analysis-card" aria-labelledby="analysis-title">
      <h2 id="analysis-title">
        {t("analysis.title")} <StatusChip status={targetStatus("model", evaluation, radiation)} />
      </h2>
      {alerts.length === 0 ? (
        <p className="analysis-line">{t("analysis.none")}</p>
      ) : (
        <ul className="analysis-list">
          {alerts.slice(0, MAX_LINES).map((alert) => (
            <li key={`${alert.kind}-${alert.signals.join("-")}`} className={alert.level === "emergency" ? "crit" : "warn"}>
              {alertTitle(alert, t)}
            </li>
          ))}
        </ul>
      )}
      {repeats.length > 0 && (
        <p className="analysis-line warn">
          {t("analysis.repeat", { signals: repeats.map((d) => t(signalKey(d.signal))).join(", ") })}
        </p>
      )}
      <button type="button" className="link" onClick={onOpen}>
        {t("analysis.details")}
      </button>
    </section>
  );
}
