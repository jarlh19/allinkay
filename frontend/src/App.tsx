import { useState } from "react";

import type { LiveState } from "./api/liveState";
import type { Mode } from "./api/types";
import { useLive } from "./api/useLive";
import { MissionView } from "./features/MissionView";
import { I18nProvider } from "./i18n/i18n";

export const DEFAULT_CREW_ID = "commander";

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

/** The whole screen for one crew member: the mission view, fed by their live state. */
export function Dashboard({ state, crewId, onCrew }: DashboardProps) {
  return (
    <MissionView
      state={state}
      crewId={crewId}
      onCrew={onCrew}
      onMode={(mode) => {
        changeMode(crewId, mode).catch((error: unknown) => console.error(error));
      }}
    />
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
