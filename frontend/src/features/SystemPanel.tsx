import type { Deviation, Evaluation, Reading } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { formatUnit, formatValue, signalKey } from "./signals";

/** Baselines built from open NASA data say so in their source, with the study. */
const OSDR_SOURCE = "NASA OSDR";
const OSDR_STUDY = /OSD-\d+/;

function nasaStudy(source: string | undefined): string | null {
  if (!source?.startsWith(OSDR_SOURCE)) return null;
  return OSDR_STUDY.exec(source)?.[0] ?? null;
}

interface Props {
  signals: string[];
  readings: Record<string, Reading>;
  evaluation: Evaluation | null;
  heartRateHistory: number[];
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

export function SystemPanel({ signals, readings, evaluation, heartRateHistory }: Props) {
  const { t } = useI18n();
  const deviations = new Map<string, Deviation>(
    (evaluation?.deviations ?? []).map((d) => [d.signal, d]),
  );

  return (
    <div className="detail-rows">
      {signals.map((signal) => {
        const reading = readings[signal];
        const deviation = deviations.get(signal);
        const flagged = deviation?.confirmed ?? false;
        const study = nasaStudy(deviation?.baseline_source);
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
            {study && <span className="note">{t("row.nasaSource", { study })}</span>}
            {signal === "heart_rate" && heartRateHistory.length > 1 && (
              <div className="trend">
                <Sparkline values={heartRateHistory} />
                <span>{t("row.last24")}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
