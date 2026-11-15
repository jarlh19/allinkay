import type { Forecast } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { Sparkline } from "./Sparkline";
import { SystemIcon } from "./SystemIcon";

interface Props {
  heartRateHistory: number[];
  sleep: Forecast | null;
}

/**
 * The latest values of the two series the panel keeps: the heart rate (last readings) and the
 * hours slept (last nights). Nothing is drawn for a series that has no values yet.
 */
export function TrendCard({ heartRateHistory, sleep }: Props) {
  const { t } = useI18n();
  const nights = sleep?.history ?? [];
  const lastBeat = heartRateHistory[heartRateHistory.length - 1];
  const lastNight = nights[nights.length - 1];
  return (
    <section className="panel trend-card" aria-labelledby="trend-title">
      <h2 id="trend-title">{t("trend.title")}</h2>
      {heartRateHistory.length === 0 && nights.length === 0 ? (
        <p className="note">{t("summary.waiting")}</p>
      ) : (
        <ul className="trend-list">
          {heartRateHistory.length > 0 && (
            <li>
              <SystemIcon target="cardiovascular" />
              <span className="trend-text">
                <span className="trend-name">{t("signal.heart_rate")}</span>
                <span className="trend-note">{t("trend.readings", { n: heartRateHistory.length })}</span>
              </span>
              <Sparkline values={heartRateHistory} tone="pulse" />
              <span className="trend-value">
                {Math.round(lastBeat ?? 0)} <small>{t("unit.bpm")}</small>
              </span>
            </li>
          )}
          {nights.length > 0 && (
            <li>
              <SystemIcon target="neurological" />
              <span className="trend-text">
                <span className="trend-name">{t("signal.sleep_hours")}</span>
                <span className="trend-note">{t("trend.nights", { n: nights.length })}</span>
              </span>
              <Sparkline values={nights} tone="sleep" />
              <span className="trend-value">
                {(lastNight ?? 0).toFixed(1)} <small>h</small>
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
