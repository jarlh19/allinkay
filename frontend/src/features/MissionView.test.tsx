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

function renderView(onMode = vi.fn()) {
  render(
    <I18nProvider initial="en">
      <MissionView state={state} crewId="commander" onCrew={() => undefined} onMode={onMode} />
    </I18nProvider>,
  );
  return onMode;
}

const bubble = (target: string) =>
  document.querySelector<HTMLElement>(`.gauge.bubble[data-target="${target}"]`) as HTMLElement;

describe("MissionView", () => {
  it("links to the project website in a new tab, keeping the live app open", () => {
    renderView();

    const link = screen.getByRole("link", { name: /Project website/ });
    expect(link).toHaveAttribute("href", "/site/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link).toHaveAccessibleName("Project website (opens in a new tab)");
  });

  it("shows the six systems as bubbles, with the live heart rate in the cardiovascular one", () => {
    renderView();

    expect(document.querySelectorAll(".gauge.bubble")).toHaveLength(6);
    expect(within(bubble("cardiovascular")).getByText(/72 bpm/)).toBeInTheDocument();
    expect(screen.getByText("DAY 93")).toBeInTheDocument();
    expect(screen.getByText("Simulated data")).toBeInTheDocument();
    expect(screen.getByText(/Earth link: up to 22 min/)).toBeInTheDocument();
    expect(screen.getByText(/The outline of the body is the skin/)).toBeInTheDocument();
  });

  it("draws only the series that exist and says how many values each has", () => {
    renderView();

    expect(screen.getByText("last 3 readings")).toBeInTheDocument();
    // No sleep forecast yet, so no sleep row.
    expect(screen.queryByText(/nights/)).not.toBeInTheDocument();
  });

  it("shows a system's detail beside the hologram when its bubble is selected, and closes it", () => {
    renderView();

    fireEvent.click(bubble("cardiovascular"));

    expect(document.querySelectorAll(".gauge.bubble")).toHaveLength(6);
    expect(bubble("cardiovascular")).toHaveAttribute("aria-current", "true");
    const detail = screen.getByRole("region", { name: /^Cardiovascular/ });
    expect(within(detail).getByText("Heart rate")).toBeInTheDocument();
    // The trend makes room for the detail and comes back when it closes.
    expect(screen.queryByText("last 3 readings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close the detail" }));

    expect(screen.queryByRole("region", { name: /^Cardiovascular/ })).not.toBeInTheDocument();
    expect(screen.getByText("last 3 readings")).toBeInTheDocument();
  });

  it("switches between the ship and the field", () => {
    const onMode = renderView();

    fireEvent.click(screen.getByRole("button", { name: "In the field" }));

    expect(onMode).toHaveBeenCalledWith("field");
    expect(screen.getByRole("button", { name: "In the ship" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the actions and the problem report at hand", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: /^Action guide/ }));
    expect(screen.getByText("Health emergency")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
