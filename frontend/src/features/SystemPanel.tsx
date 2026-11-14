import { systemStatus } from "../api/liveState";
import type { Deviation, Evaluation, Reading, System } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { formatUnit, formatValue, signalKey, systemKey } from "./signals";
import { StatusChip } from "./StatusChip";

/** Baselines built from open NASA data say so in their source. */
const OSDR_SOURCE = "NASA OSDR";

interface Props {
  system: System;
  signals: string[];
  readings: Record<string, Reading>;
  evaluation: Evaluation | null;
  heartRateHistory: number[];
  focused: boolean;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 300},${30 - ((v - min) / span) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 300 34" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="#6fa3d8" strokeWidth="2" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export function SystemPanel({ system, signals, readings, evaluation, heartRateHistory, focused }: Props) {
  const { t } = useI18n();
  const deviations = new Map<string, Deviation>(
    (evaluation?.deviations ?? []).map((d) => [d.signal, d]),
  );

  return (
    <section className={`panel${focused ? " focus" : ""}`} id={`panel-${system}`}>
      <h2>
        {t(systemKey(system))} <StatusChip status={systemStatus(evaluation, system)} />
      </h2>
      {signals.map((signal) => {
        const reading = readings[signal];
        const deviation = deviations.get(signal);
        const flagged = deviation?.confirmed ?? false;
        return (
          <div className="row" key={signal}>
            <span className="name">
              {t(signalKey(signal))}
              {reading && (
                <em className={`freq${reading.frequency === "live" ? " live" : ""}`}>
                  {t(`freq.${reading.frequency}`)}
                </em>
              )}
            </span>
            <span className={`value${flagged ? " warn" : ""}`}>
              {reading ? formatValue(signal, reading.value) : "–"}
              {reading && formatUnit(reading.unit) && <small>{formatUnit(reading.unit)}</small>}
            </span>
            {deviation && flagged && (
              <span className="note warn">
                {t("row.outside", {
                  low: formatValue(signal, deviation.normal_low),
                  high: formatValue(signal, deviation.normal_high),
                })}
              </span>
            )}
            {deviation?.repeat_requested && <span className="note warn">{t("row.repeat")}</span>}
            {deviation?.baseline_source.startsWith(OSDR_SOURCE) && (
              <span className="note">{t("row.wbcSource")}</span>
            )}
            {signal === "heart_rate" && heartRateHistory.length > 1 && (
              <div className="trend">
                <Sparkline values={heartRateHistory} />
                <span>{t("row.last24")}</span>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
