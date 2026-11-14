import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dashboard } from "./App";
import { initialState, type LiveState } from "./api/liveState";
import { I18nProvider } from "./i18n/i18n";

const state: LiveState = {
  ...initialState,
  connected: true,
  clock: { type: "clock", at: "2026-11-17T06:00:00+00:00", mission_day: 93 },
  readings: {
    sleep_hours: {
      signal: "sleep_hours",
      value: 5.2,
      unit: "h",
      system: "neurological",
      frequency: "daily",
      taken_at: "2026-11-17T06:00:00+00:00",
      source: "simulator",
    },
  },
  evaluation: {
    type: "evaluation",
    mode: "ship",
    mitigation: "mitigation.ship_routines",
    deviations: [
      {
        signal: "sleep_hours",
        system: "neurological",
        value: 5.2,
        unit: "h",
        baseline_mean: 7.4,
        normal_low: 6.8,
        normal_high: 8.0,
        baseline_source: "pre-flight (synthetic)",
        z_score: -5.5,
        outside_normal: true,
        confirmed: true,
      },
    ],
    alerts: [
      {
        kind: "outside_normal",
        level: "attention",
        systems: ["neurological"],
        signals: ["sleep_hours"],
        action: "action.sleep_and_workload",
        reference: { id: "nasa-risk-sleep", title: "NASA: Risk from Inadequate Sleep", url: "https://www.nasa.gov/" },
        evidence: [],
      },
    ],
  },
};

function renderDashboard() {
  return render(
    <I18nProvider initial="en">
      <Dashboard state={state} />
    </I18nProvider>,
  );
}

describe("Dashboard", () => {
  it("shows the mission day, the reading and that it is outside the normal", () => {
    renderDashboard();

    expect(screen.getByText(/Mission day 93/)).toBeInTheDocument();
    expect(screen.getByText("5.2")).toBeInTheDocument();
    expect(screen.getByText("Outside your normal (6.8–8.0)")).toBeInTheDocument();
  });

  it("switches to Spanish", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Español" }));

    expect(screen.getByText(/Misión, día 93/)).toBeInTheDocument();
    expect(screen.getAllByText("Sueño de anoche").length).toBeGreaterThan(0);
  });

  it("warns when the connection is lost", () => {
    render(
      <I18nProvider initial="en">
        <Dashboard state={{ ...state, connected: false }} />
      </I18nProvider>,
    );

    expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
  });
});
