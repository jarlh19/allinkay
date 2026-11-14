import { overallStatus } from "../api/liveState";
import type { Alert, Evaluation } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { signalKey } from "./signals";
import { StatusChip } from "./StatusChip";

const MAX_ROWS = 7;
const SCALE = 3;

export function AlertCard({ alert }: { alert: Alert }) {
  const { t } = useI18n();
  const names = alert.signals.map((s) => t(signalKey(s)).toLowerCase());
  const title =
    alert.kind === "combined_pattern"
      ? t("alert.combined_pattern", { signals: names.join(", ") })
      : alert.kind === "solar_storm"
        ? t("alert.solar_storm")
        : t("alert.outside_normal", { signal: t(signalKey(alert.signals[0] ?? "")) });
  const action = t(alert.action as Parameters<typeof t>[0]);
  return (
    <div className={`alert${alert.level === "emergency" ? " crit" : ""}`} role="status">
      <span className="icon">{alert.level === "emergency" ? "✕" : "!"}</span>
      <div>
        <strong>{title}</strong>
        <p>{action}</p>
        <p>
          {t("alert.source")}:{" "}
          <a href={alert.reference.url} target="_blank" rel="noreferrer noopener">
            {alert.reference.title}
          </a>
          . {t("alert.notDiagnosis")}
        </p>
      </div>
    </div>
  );
}

export function ModelPanel({ evaluation, focused }: { evaluation: Evaluation | null; focused: boolean }) {
  const { t } = useI18n();
  const deviations = [...(evaluation?.deviations ?? [])]
    .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score))
    .slice(0, MAX_ROWS);
  const alerts = evaluation?.alerts ?? [];
  const pattern = alerts.find((a) => a.kind === "combined_pattern");
  const early = alerts.filter((a) => a.kind === "outside_normal").slice(0, 3);
  const shown = pattern ? [pattern] : early;

  return (
    <section className={`panel span2${focused ? " focus" : ""}`} id="panel-model">
      <h2>
        {t("model.title")} <StatusChip status={overallStatus(evaluation)} />
      </h2>
      <p className="note" style={{ marginBottom: 10 }}>
        {t("model.deviation")}
      </p>
      {deviations.map((d) => {
        const width = (Math.min(Math.abs(d.z_score), SCALE) / SCALE) * 50;
        const left = d.z_score < 0 ? 50 - width : 50;
        const warn = d.confirmed;
        return (
          <div className="dev" key={d.signal}>
            <span>{t(signalKey(d.signal))}</span>
            <span className="track">
              <i className={warn ? "warn" : ""} style={{ left: `${left}%`, width: `${width}%` }} />
            </span>
            <span className={`z${warn ? " warn" : ""}`}>
              {d.z_score > 0 ? "+" : "−"}
              {Math.abs(d.z_score).toFixed(1)}
            </span>
          </div>
        );
      })}
      <div className="scale">
        <span />
        <span>
          <span>{t("model.less")}</span>
          <span>{t("model.normal")}</span>
          <span>{t("model.more")}</span>
        </span>
        <span />
      </div>
      {evaluation?.mode === "field" && <p className="note">{t("model.fieldNote")}</p>}
      {shown.map((alert) => (
        <AlertCard key={`${alert.kind}-${alert.signals.join("-")}`} alert={alert} />
      ))}
      {alerts.length === 0 && <p className="note">{t("model.none")}</p>}
      <p className="source">{t("model.footer")}</p>
    </section>
  );
}
