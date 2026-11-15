import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initialState, type LiveState } from "../api/liveState";
import { I18nProvider } from "../i18n/i18n";
import { MissionView } from "./MissionView";

const state: LiveState = {
  ...initialState,
  connected: true,
  crew: [{ id: "commander", role: "commander", mode: "ship", status: "normal", alerts: 0 }],
  clock: { type: "clock", at: "2026-11-17T06:00:00+00:00", mission_day: 93 },
  heartRateHistory: [64, 70, 72],
  readings: {
    heart_rate: {
      signal: "heart_rate",
      value: 72.4,
      unit: "bpm",
      system: "cardiovascular",
      frequency: "live",
      taken_at: "2026-11-17T06:00:00+00:00",
      source: "simulator",
    },
  },
};

function renderView(onDetail = vi.fn()) {
  render(
    <I18nProvider initial="en">
      <MissionView state={state} crewId="commander" onCrew={() => undefined} onDetail={onDetail} onPanel={() => undefined} notices={null} />
    </I18nProvider>,
  );
  return onDetail;
}

describe("MissionView", () => {
  it("shows the six systems as bubbles, with the live heart rate in the cardiovascular one", () => {
    renderView();

    const bubbles = document.querySelectorAll(".gauge.bubble");
    expect(bubbles).toHaveLength(6);
    const heart = document.querySelector<HTMLElement>('.gauge.bubble[data-target="cardiovascular"]');
    expect(heart).not.toBeNull();
    expect(within(heart as HTMLElement).getByText(/72 bpm/)).toBeInTheDocument();
    expect(screen.getByText("DAY 93")).toBeInTheDocument();
    expect(screen.getByText("Simulated data")).toBeInTheDocument();
  });

  it("draws only the series that exist and says how many values each has", () => {
    renderView();

    expect(screen.getByText("last 3 readings")).toBeInTheDocument();
    // No sleep forecast yet, so no sleep row.
    expect(screen.queryByText(/nights/)).not.toBeInTheDocument();
  });

  it("opens a system's detail from its bubble", () => {
    const onDetail = renderView();

    document.querySelector<HTMLElement>('.gauge.bubble[data-target="immune"]')?.click();

    expect(onDetail).toHaveBeenCalledWith("immune");
  });
});
