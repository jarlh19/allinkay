import { fireEvent, render, screen, within } from "@testing-library/react";
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

const detailOf = (target: string) => ({ title: `Detail of ${target}`, status: null, content: <p>{`${target} readings`}</p> });

function renderView(onDetail = vi.fn()) {
  render(
    <I18nProvider initial="en">
      <MissionView
        state={state}
        crewId="commander"
        onCrew={() => undefined}
        detailOf={detailOf}
        onDetail={onDetail}
        onPanel={() => undefined}
        notices={null}
      />
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

  it("keeps the view and shows a system's detail beside the hologram when its bubble is selected", () => {
    const onDetail = renderView();
    const bubble = document.querySelector<HTMLElement>('.gauge.bubble[data-target="immune"]') as HTMLElement;

    fireEvent.click(bubble);

    expect(document.querySelectorAll(".gauge.bubble")).toHaveLength(6);
    expect(bubble).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Detail of immune")).toBeInTheDocument();
    expect(screen.getByText("immune readings")).toBeInTheDocument();
    // The trend makes room for the detail and comes back when it closes.
    expect(screen.queryByText("last 3 readings")).not.toBeInTheDocument();
    expect(onDetail).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close the detail" }));

    expect(screen.queryByText("Detail of immune")).not.toBeInTheDocument();
    expect(screen.getByText("last 3 readings")).toBeInTheDocument();
  });

  it("opens the selected system in the full panel from its link", () => {
    const onDetail = renderView();
    fireEvent.click(document.querySelector<HTMLElement>('.gauge.bubble[data-target="radiation"]') as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "Open in the full panel" }));

    expect(onDetail).toHaveBeenCalledWith("radiation");
  });
});
