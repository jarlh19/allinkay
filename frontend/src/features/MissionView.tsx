import type { ReactNode } from "react";

import type { LiveState } from "../api/liveState";
import { useI18n } from "../i18n/i18n";
import { BodyPanel } from "./BodyPanel";
import { CrewStrip } from "./CrewStrip";
import { ModelAnalysis } from "./ModelAnalysis";
import { StatusColumn } from "./StatusColumn";
import type { Target } from "./statusSummary";
import { TrendCard } from "./TrendCard";

interface Props {
  state: LiveState;
  crewId: string;
  onCrew: (id: string) => void;
  /** Opens a system's detail, which lives in the panel view. */
  onDetail: (target: Target) => void;
  onPanel: () => void;
  /** Connection and emergency notices, which must show in every view. */
  notices: ReactNode;
}

/**
 * The mission view: the same live data as the panel, laid out like the team's "Mission Health"
 * design, with the hologram in the middle and each system as a bubble around it.
 */
export function MissionView({ state, crewId, onCrew, onDetail, onPanel, notices }: Props) {
  const { t, language, setLanguage } = useI18n();
  const { evaluation, radiation, clock } = state;
  const member = state.crew.find((m) => m.id === crewId);
  const memberNumber = Math.max(state.crew.findIndex((m) => m.id === crewId), 0) + 1;
  const mode = evaluation?.mode ?? member?.mode ?? "ship";

  return (
    <div className="app mission">
      <header className="top mission-top">
        <div className="mission-brand">
          <h1>
            MISSION <b>HEALTH</b>
          </h1>
          <p>ALLINKAY · {t("mission.subtitle")}</p>
        </div>
        <div className="top-right">
          {clock?.mission_day ? <span className="mission-day">{t("mission.day", { day: clock.mission_day })}</span> : null}
          <span className="mission-place">{t(mode === "field" ? "mode.field" : "mode.ship")}</span>
          <span className="pill">{t("pill.simulated")}</span>
          <button type="button" className="lang" onClick={onPanel}>
            {t("view.panel")}
          </button>
          <button type="button" className="lang" onClick={() => setLanguage(language === "en" ? "es" : "en")}>
            {t("lang.switch")}
          </button>
        </div>
      </header>
      <CrewStrip members={state.crew} selected={crewId} onSelect={onCrew} />
      {notices}
      <div className="mission-grid">
        <StatusColumn
          evaluation={evaluation}
          radiation={radiation}
          member={member}
          memberNumber={memberNumber}
          connected={state.connected}
        />
        <BodyPanel
          variant="mission"
          evaluation={evaluation}
          radiation={radiation}
          heartRate={state.readings.heart_rate?.value ?? null}
          focused={null}
          onFocus={onDetail}
          onMode={() => undefined}
        />
        <div className="mission-side">
          <TrendCard heartRateHistory={state.heartRateHistory} sleep={state.forecast} />
          <ModelAnalysis evaluation={evaluation} radiation={radiation} onOpen={() => onDetail("model")} />
        </div>
      </div>
    </div>
  );
}
