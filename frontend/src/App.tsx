import { useState } from "react";

import type { LiveState, SystemStatus } from "./api/liveState";
import type { Mode } from "./api/types";
import { useLive } from "./api/useLive";
import { ActionsPanel } from "./features/ActionsPanel";
import { BodyPanel } from "./features/BodyPanel";
import { CrewStrip, useRoleLabel } from "./features/CrewStrip";
import { DetailSection } from "./features/DetailSection";
import { AlertCard, ModelPanel } from "./features/ModelPanel";
import { RadiationPanel } from "./features/RadiationPanel";
import { ReportDialog, type Screen } from "./features/ReportDialog";
import { SYSTEM_SIGNALS, systemKey } from "./features/signals";
import { ModelAnalysis } from "./features/ModelAnalysis";
import { StatusColumn } from "./features/StatusColumn";
import { targetStatus, type Target } from "./features/statusSummary";
import { StatusChip } from "./features/StatusChip";
import { SystemPanel } from "./features/SystemPanel";
import { I18nProvider, useI18n } from "./i18n/i18n";

const MARS_MAX_DELAY_MIN = 22;

export const DEFAULT_CREW_ID = "commander";

type Detail = Target | "actions";

/** Order of the detail column: the model first, then each system, then what to do. */
const DETAILS: Detail[] = ["model", "cardiovascular", "neurological", "immune", "environment", "radiation", "actions"];

async function changeMode(crewId: string, mode: Mode): Promise<void> {
  const response = await fetch(`/api/crew/${encodeURIComponent(crewId)}/mode`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) throw new Error(`Mode change failed with status ${response.status}`);
}

interface DashboardProps {
  state: LiveState;
  crewId: string;
  onCrew: (id: string) => void;
}

export function Dashboard({ state, crewId, onCrew }: DashboardProps) {
  const { t, language, setLanguage } = useI18n();
  const roleLabel = useRoleLabel();
  const member = state.crew.find((m) => m.id === crewId);
  const memberNumber = Math.max(state.crew.findIndex((m) => m.id === crewId), 0) + 1;
  const role = roleLabel(member?.role ?? crewId);
  const [focused, setFocused] = useState<Target | null>(null);
  const [opened, setOpened] = useState<Partial<Record<Detail, boolean>>>({});
  const [reporting, setReporting] = useState(false);
  const { evaluation, radiation, readings, clock } = state;
  const emergencies = (evaluation?.alerts ?? []).filter((a) => a.level === "emergency");
  const time = clock?.at ? new Date(clock.at).toISOString().slice(11, 16) : null;

  const storm = radiation?.storm_active ?? false;
  const statusOf = (detail: Detail): SystemStatus | null =>
    detail === "actions" ? null : targetStatus(detail, evaluation, radiation);
  // A section with an alert opens by itself until the person opens or closes it by hand.
  const isOpen = (detail: Detail) => opened[detail] ?? (detail === "model" || (statusOf(detail) ?? "ok") !== "ok");
  const toggle = (detail: Detail) => setOpened((current) => ({ ...current, [detail]: !isOpen(detail) }));

  const focus = (target: Target) => {
    setFocused(target);
    setOpened((current) => ({ ...current, [target]: true }));
    window.requestAnimationFrame(() =>
      document.getElementById(`panel-${target}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  };

  const titleOf = (detail: Detail): string => {
    if (detail === "model") return t("model.title");
    if (detail === "actions") return t("actions.title");
    if (detail === "radiation") return t("radiation.title");
    return t(systemKey(detail));
  };

  const chipOf = (detail: Detail) => {
    const status = statusOf(detail);
    if (!status) return null;
    if (detail === "radiation" && radiation && !storm) {
      return <StatusChip status="ok" label={t("radiation.withinLimit")} />;
    }
    return <StatusChip status={status} />;
  };

  const contentOf = (detail: Detail) => {
    if (detail === "model") return <ModelPanel evaluation={evaluation} forecast={state.forecast} />;
    if (detail === "radiation") return <RadiationPanel radiation={radiation} />;
    if (detail === "actions") return <ActionsPanel evaluation={evaluation} />;
    return (
      <SystemPanel
        signals={SYSTEM_SIGNALS[detail]}
        readings={readings}
        evaluation={evaluation}
        heartRateHistory={state.heartRateHistory}
      />
    );
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>ALLINKAY</h1>
          <p>
            {clock?.mission_day ? t("app.subtitle", { role, day: clock.mission_day }) : t("app.subtitleNoDay", { role })}
            {time && ` · ${t("app.lastReading", { time })}`}
          </p>
        </div>
        <div className="top-right">
          <span className="pill">{t("pill.earth", { delay: MARS_MAX_DELAY_MIN })}</span>
          <span className="pill">{t("pill.simulated")}</span>
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
        screen={(focused ?? "overall") as Screen}
        missionDay={clock?.mission_day ?? null}
        mode={evaluation?.mode ?? "ship"}
        crewId={crewId}
      />
      {emergencies.map((alert, i) => (
        <AlertCard key={`emergency-${i}`} alert={alert} />
      ))}
      <div className="layout">
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
          focused={focused}
          onFocus={focus}
          onMode={(mode) => {
            changeMode(crewId, mode).catch((error: unknown) => console.error(error));
          }}
        />
        <div className="details" role="group" aria-label={t("details.title")}>
          <ModelAnalysis evaluation={evaluation} radiation={radiation} onOpen={() => focus("model")} />
          {DETAILS.map((detail) => (
            <DetailSection
              key={detail}
              id={detail}
              title={titleOf(detail)}
              status={chipOf(detail)}
              open={isOpen(detail)}
              onToggle={() => toggle(detail)}
            >
              {contentOf(detail)}
            </DetailSection>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveDashboard() {
  const [crewId, setCrewId] = useState(DEFAULT_CREW_ID);
  const state = useLive(crewId);
  return <Dashboard state={state} crewId={crewId} onCrew={setCrewId} />;
}

export function App() {
  return (
    <I18nProvider>
      <LiveDashboard />
    </I18nProvider>
  );
}
