import { useState } from "react";

import type { LiveState } from "./api/liveState";
import type { Mode, System } from "./api/types";
import { useLive } from "./api/useLive";
import { ActionsPanel } from "./features/ActionsPanel";
import { BodyPanel } from "./features/BodyPanel";
import { AlertCard, ModelPanel } from "./features/ModelPanel";
import { RadiationPanel } from "./features/RadiationPanel";
import { ReportDialog, type Screen } from "./features/ReportDialog";
import { SYSTEM_SIGNALS } from "./features/signals";
import { SystemPanel } from "./features/SystemPanel";
import { I18nProvider, useI18n } from "./i18n/i18n";

const MARS_MAX_DELAY_MIN = 22;

async function changeMode(mode: Mode): Promise<void> {
  const response = await fetch("/api/mode", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) throw new Error(`Mode change failed with status ${response.status}`);
}

export function Dashboard({ state }: { state: LiveState }) {
  const { t, language, setLanguage } = useI18n();
  const [focused, setFocused] = useState<System | "model" | null>(null);
  const [reporting, setReporting] = useState(false);
  const { evaluation, radiation, readings, clock } = state;
  const emergencies = (evaluation?.alerts ?? []).filter((a) => a.level === "emergency");
  const time = clock?.at ? new Date(clock.at).toISOString().slice(11, 16) : null;

  const focus = (target: System | "model") => {
    setFocused(target);
    document.getElementById(`panel-${target}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>ALLINKAY</h1>
          <p>
            {clock?.mission_day ? t("app.subtitle", { day: clock.mission_day }) : t("app.subtitleNoDay")}
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
      {!state.connected && <div className="offline">{t("offline")}</div>}
      <ReportDialog
        key={reporting ? "open" : "closed"}
        open={reporting}
        onClose={() => setReporting(false)}
        screen={(focused ?? "overall") as Screen}
        missionDay={clock?.mission_day ?? null}
        mode={evaluation?.mode ?? "ship"}
      />
      {emergencies.map((alert, i) => (
        <AlertCard key={`emergency-${i}`} alert={alert} />
      ))}
      <div className="grid">
        <BodyPanel
          evaluation={evaluation}
          stormActive={radiation?.storm_active ?? false}
          focused={focused}
          onFocus={focus}
          onMode={(mode) => {
            changeMode(mode).catch((error: unknown) => console.error(error));
          }}
        />
        {(Object.keys(SYSTEM_SIGNALS) as (keyof typeof SYSTEM_SIGNALS)[]).map((system) => (
          <SystemPanel
            key={system}
            system={system}
            signals={SYSTEM_SIGNALS[system]}
            readings={readings}
            evaluation={evaluation}
            heartRateHistory={state.heartRateHistory}
            focused={focused === system}
          />
        ))}
        <ModelPanel evaluation={evaluation} forecast={state.forecast} focused={focused === "model"} />
        <RadiationPanel radiation={radiation} focused={focused === "radiation"} />
        <ActionsPanel evaluation={evaluation} />
      </div>
    </div>
  );
}

function LiveDashboard() {
  const state = useLive();
  return <Dashboard state={state} />;
}

export function App() {
  return (
    <I18nProvider>
      <LiveDashboard />
    </I18nProvider>
  );
}
