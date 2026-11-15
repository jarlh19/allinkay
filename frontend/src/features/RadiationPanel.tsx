import type { Radiation } from "../api/types";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { StatusChip } from "./StatusChip";
import { referenceParams } from "./stormReference";

export function RadiationPanel({ radiation }: { radiation: Radiation | null }) {
  const { t } = useI18n();
  if (!radiation) {
    return <p className="note">{t("loading")}</p>;
  }
  const storm = radiation.storm_active;
  const percent = Math.min(radiation.career_fraction * 100, 100);

  return (
    <div>
      <div className="cols3">
        <div>
          <div className="row">
            <span className="name">
              {t("radiation.today")} <em className="freq live">{t("freq.live")}</em>
            </span>
            <span className={`value${storm ? " warn" : ""}`}>
              {radiation.dose_rate_msv_per_day.toFixed(2)}
              <small>mSv</small>
            </span>
          </div>
          <div className="row">
            <span className="name">
              {t("radiation.accumulated")} <em className="freq live">{t("freq.live")}</em>
            </span>
            <span className="value">
              {radiation.accumulated_msv.toFixed(0)}
              <small>mSv</small>
            </span>
            <div className={`bar${percent > 80 ? " warn" : ""}`}>
              <span style={{ width: `${percent}%` }} />
            </div>
            {radiation.days_to_limit !== null && (
              <span className="note">
                {t("radiation.limitNote", {
                  limit: radiation.career_limit_msv,
                  days: radiation.days_to_limit,
                })}
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="name">{t("radiation.storm")}</p>
          <p style={{ margin: "10px 0" }}>
            <StatusChip
              status={storm ? "crit" : "ok"}
              label={storm ? t("radiation.stormActive", { dose: radiation.storm_dose_msv }) : t("radiation.stormNone")}
            />
          </p>
          <p className="note">{t("radiation.eventLimit", { limit: radiation.event_limit_msv })}</p>
          {radiation.storm_reference && (
            <p className="note">{t("radiation.reference", referenceParams(radiation.storm_reference))}</p>
          )}
        </div>
        <div>
          <p className="name" style={{ marginBottom: 10 }}>
            {t("radiation.organs")}
          </p>
          <ul className="organs">
            {radiation.organs_at_risk.map((o) => (
              <li key={o.organ}>
                {t(`organ.${o.organ}` as MessageKey)}
                <span>{t(`timeframe.${o.timeframe}` as MessageKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="source">
        {t("radiation.footer", { career: radiation.career_limit_msv, event: radiation.event_limit_msv })}
      </p>
    </div>
  );
}
