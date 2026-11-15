import { useState } from "react";

import type { LiveState } from "../api/liveState";
import type { Mode } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { ActionsPanel } from "./ActionsPanel";
import { BodyPanel } from "./BodyPanel";
import { CrewStrip } from "./CrewStrip";
import { ModelAnalysis } from "./ModelAnalysis";
import { AlertCard, ModelPanel } from "./ModelPanel";
import { RadiationPanel } from "./RadiationPanel";
import { ReportDialog, type Screen } from "./ReportDialog";
import { SYSTEM_SIGNALS, systemKey } from "./signals";
import { StatusChip } from "./StatusChip";
import { StatusColumn } from "./StatusColumn";
import { targetStatus, type Target } from "./statusSummary";
import { SystemPanel } from "./SystemPanel";
import { TrendCard } from "./TrendCard";

/** Longest one-way delay of a message between Mars and Earth, in minutes. */
const MARS_MAX_DELAY_MIN = 22;

interface Props {
  state: LiveState;
  crewId: string;
  onCrew: (id: string) => void;
  onMode: (mode: Mode) => void;
}

/**
 * The app's screen, laid out like the team's "Mission Health" design: the hologram in the middle
 * with each system as a bubble around it, who is watched and their overall state on the left, and
 * the trend, the model's analysis and the actions on the right. Selecting a bubble or a part of the
 * body shows that system's detail beside the hologram.
 */
export function MissionView({ state, crewId, onCrew, onMode }: Props) {
  const { t, language, setLanguage } = useI18n();
  const [selected, setSelected] = useState<Target | null>(null);
  const [reporting, setReporting] = useState(false);
  const { evaluation, radiation, clock, readings } = state;
  const member = state.crew.find((m) => m.id === crewId);
  const memberNumber = Math.max(state.crew.findIndex((m) => m.id === crewId), 0) + 1;
  const mode = evaluation?.mode ?? member?.mode ?? "ship";
  const emergencies = (evaluation?.alerts ?? []).filter((a) => a.level === "emergency");
  const time = clock?.at ? new Date(clock.at).toISOString().slice(11, 16) : null;
  const select = (target: Target) => setSelected((current) => (current === target ? null : target));

  const titleOf = (target: Target): string => {
    if (target === "model") return t("model.title");
    if (target === "radiation") return t("radiation.title");
    return t(systemKey(target));
  };
  const chipOf = (target: Target) => {
    const status = targetStatus(target, evaluation, radiation);
    if (target === "radiation" && radiation && status === "ok") {
      return <StatusChip status="ok" label={t("radiation.withinLimit")} />;
    }
    return <StatusChip status={status} />;
  };
  const contentOf = (target: Target) => {
    if (target === "model") return <ModelPanel evaluation={evaluation} forecast={state.forecast} />;
    if (target === "radiation") return <RadiationPanel radiation={radiation} />;
    return (
      <SystemPanel
        signals={SYSTEM_SIGNALS[target]}
        readings={readings}
        evaluation={evaluation}
        heartRateHistory={state.heartRateHistory}
      />
    );
  };

  return (
    <div className="app mission">
      <header className="top mission-top">
        <div className="mission-brand">
          <h1>
            MISSION <b>HEALTH</b>
          </h1>
          <p>
            ALLINKAY · {t("mission.subtitle")}
            {time && ` · ${t("app.lastReading", { time })}`}
          </p>
        </div>
        <div className="top-right">
          {clock?.mission_day ? <span className="mission-day">{t("mission.day", { day: clock.mission_day })}</span> : null}
          <span className="mission-place">{t(mode === "field" ? "mode.field" : "mode.ship")}</span>
          <span className="pill">{t("pill.earth", { delay: MARS_MAX_DELAY_MIN })}</span>
          <span className="pill">{t("pill.simulated")}</span>
          <a
            className="lang site-link"
            href="/site/"
            target="_blank"
            rel="noopener"
            aria-label={`${t("site.open")} ${t("site.newTab")}`}
          >
            {t("site.open")}
            <span aria-hidden="true">&nbsp;↗</span>
          </a>
          <button type="button" className="lang" onClick={() => setReporting(true)}>
            {t("report.open")}
          </button>
          <button type="button" className="lang" onClick={() => setLanguage(language === "en" ? "es" : "en")}>
            {t("lang.switch")}
          </button>
        </div>
      </header>
      <CrewStrip members={state.crew} selected={crewId} onSelect={onCrew} />
      {!state.connected && <div className="offline">{t("offline")}</div>}
      <ReportDialog
        key={reporting ? "open" : "closed"}
        open={reporting}
        onClose={() => setReporting(false)}
        screen={(selected ?? "overall") as Screen}
        missionDay={clock?.mission_day ?? null}
        mode={mode}
        crewId={crewId}
      />
      {emergencies.map((alert, i) => (
        <AlertCard key={`emergency-${i}`} alert={alert} />
      ))}
      <div className="mission-grid">
        <StatusColumn
          evaluation={evaluation}
          radiation={radiation}
          member={member}
          memberNumber={memberNumber}
          connected={state.connected}
        />
        <BodyPanel
          evaluation={evaluation}
          radiation={radiation}
          heartRate={readings.heart_rate?.value ?? null}
          focused={selected}
          onFocus={select}
          onMode={onMode}
        />
        <div className="mission-side">
          {selected ? (
            <section className="panel mission-detail" id={`panel-${selected}`} aria-labelledby="mission-detail-title">
              <h2 id="mission-detail-title">
                <span>{titleOf(selected)}</span>
                <span className="mission-detail-head">
                  {chipOf(selected)}
                  <button type="button" className="close" aria-label={t("mission.closeDetail")} onClick={() => setSelected(null)}>
                    ✕
                  </button>
                </span>
              </h2>
              {contentOf(selected)}
            </section>
          ) : (
            <>
              <TrendCard heartRateHistory={state.heartRateHistory} sleep={state.forecast} />
              <ModelAnalysis evaluation={evaluation} radiation={radiation} onOpen={() => setSelected("model")} />
            </>
          )}
          <section className="panel actions-card" aria-labelledby="actions-title">
            <h2 id="actions-title">{t("actions.title")}</h2>
            <ActionsPanel evaluation={evaluation} />
          </section>
        </div>
      </div>
    </div>
  );
}
