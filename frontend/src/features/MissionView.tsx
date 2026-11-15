import { useState, type ReactNode } from "react";

import type { LiveState } from "../api/liveState";
import { useI18n } from "../i18n/i18n";
import { BodyPanel } from "./BodyPanel";
import { CrewStrip } from "./CrewStrip";
import { ModelAnalysis } from "./ModelAnalysis";
import { StatusColumn } from "./StatusColumn";
import type { Target } from "./statusSummary";
import { TrendCard } from "./TrendCard";

/** What the mission view shows for a selected system: the same detail as the panel's section. */
export interface MissionDetail {
  title: string;
  status: ReactNode;
  content: ReactNode;
}

interface Props {
  state: LiveState;
  crewId: string;
  onCrew: (id: string) => void;
  /** The detail of a system, shown beside the hologram when its bubble is selected. */
  detailOf: (target: Target) => MissionDetail;
  /** Opens a system's section in the full panel view. */
  onDetail: (target: Target) => void;
  onPanel: () => void;
  /** Connection and emergency notices, which must show in every view. */
  notices: ReactNode;
}

/**
 * The mission view: the same live data as the panel, laid out like the team's "Mission Health"
 * design, with the hologram in the middle and each system as a bubble around it. Selecting a
 * bubble or a part of the body keeps the view and shows that system's detail beside the hologram.
 */
export function MissionView({ state, crewId, onCrew, detailOf, onDetail, onPanel, notices }: Props) {
  const { t, language, setLanguage } = useI18n();
  const [selected, setSelected] = useState<Target | null>(null);
  const select = (target: Target) => setSelected((current) => (current === target ? null : target));
  const detail = selected ? detailOf(selected) : null;
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
          focused={selected}
          onFocus={select}
          onMode={() => undefined}
        />
        <div className="mission-side">
          {selected && detail ? (
            <section className="panel mission-detail" aria-labelledby="mission-detail-title">
              <h2 id="mission-detail-title">
                <span>{detail.title}</span>
                <span className="mission-detail-head">
                  {detail.status}
                  <button type="button" className="close" aria-label={t("mission.closeDetail")} onClick={() => setSelected(null)}>
                    ✕
                  </button>
                </span>
              </h2>
              {detail.content}
              <button type="button" className="link" onClick={() => onDetail(selected)}>
                {t("mission.openPanel")}
              </button>
            </section>
          ) : (
            <>
              <TrendCard heartRateHistory={state.heartRateHistory} sleep={state.forecast} />
              <ModelAnalysis evaluation={evaluation} radiation={radiation} onOpen={() => setSelected("model")} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
