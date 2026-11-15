import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dashboard } from "./App";
import { initialState, type LiveState } from "./api/liveState";
import { I18nProvider } from "./i18n/i18n";

const state: LiveState = {
  ...initialState,
  connected: true,
  crew: [
    { id: "commander", role: "commander", mode: "ship", status: "attention", alerts: 1 },
    { id: "engineer", role: "engineer", mode: "field", status: "normal", alerts: 0 },
  ],
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
        repeat_requested: false,
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

function renderDashboard(onCrew: (id: string) => void = () => undefined) {
  return render(
    <I18nProvider initial="en">
      <Dashboard state={state} crewId="commander" onCrew={onCrew} />
    </I18nProvider>,
  );
}

describe("Dashboard", () => {
  it("shows the mission day, the reading and that it is outside the normal", () => {
    renderDashboard();

    expect(screen.getByText(/Commander · Mission day 93/)).toBeInTheDocument();
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
        <Dashboard state={{ ...state, connected: false }} crewId="commander" onCrew={() => undefined} />
      </I18nProvider>,
    );

    expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
  });

  it("lists the crew with where each one is and switches to another member", () => {
    const onCrew = vi.fn();
    renderDashboard(onCrew);

    const crew = screen.getByRole("navigation", { name: "Crew" });
    const engineer = within(crew).getByRole("button", { name: /Flight engineer/ });
    expect(within(crew).getByRole("button", { name: /Commander/ })).toHaveAttribute("aria-pressed", "true");
    expect(engineer).toHaveTextContent("In the field");

    fireEvent.click(engineer);

    expect(onCrew).toHaveBeenCalledWith("engineer");
  });

  it("opens by itself the details of a system with an alert and keeps the rest folded", () => {
    renderDashboard();

    expect(screen.getByRole("button", { name: /^Neurological/, expanded: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cardiovascular/, expanded: false })).toBeInTheDocument();
  });

  it("opens a system's details from its ring around the body and folds them again", () => {
    renderDashboard();
    const body = screen.getByRole("region", { name: "Your body" });

    fireEvent.click(within(body).getByRole("button", { name: /^Cardiovascular/ }));

    const header = screen.getByRole("button", { name: /^Cardiovascular/, expanded: true });
    expect(screen.getByRole("region", { name: /^Cardiovascular/ })).toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.queryByRole("region", { name: /^Cardiovascular/ })).not.toBeInTheDocument();
  });

  it("shows who is watched and how many signals are in their normal", () => {
    renderDashboard();

    const card = screen.getByRole("region", { name: "Commander" });
    expect(within(card).getByText(/Crew member 1/)).toBeInTheDocument();
    expect(within(card).getByText("Monitoring active")).toBeInTheDocument();
    const overall = screen.getByRole("region", { name: /^Overall status/ });
    expect(within(overall).getByText("0%")).toBeInTheDocument();
    expect(within(overall).getByText("0 of 1 signals in your normal right now")).toBeInTheDocument();
  });

  it("sums up the model's confirmed changes", () => {
    renderDashboard();

    const analysis = screen.getByRole("region", { name: /^Model analysis/ });
    expect(within(analysis).getByText(/Sleep last night: outside your normal/i)).toBeInTheDocument();
  });

  it("does not call a dose past the career limit within the limit", () => {
    const pastLimit: LiveState = {
      ...state,
      radiation: {
        type: "radiation",
        dose_rate_msv_per_day: 1.8,
        accumulated_msv: 601.2,
        career_limit_msv: 600,
        career_fraction: 1.002,
        days_to_limit: 0,
        event_limit_msv: 250,
        storm_active: false,
        storm_dose_msv: 0,
        organs_at_risk: [],
      },
      evaluation: {
        type: "evaluation",
        mode: "ship",
        mitigation: "mitigation.ship_routines",
        deviations: [],
        alerts: [
          {
            kind: "career_limit",
            level: "emergency",
            systems: ["radiation"],
            signals: ["dose_today"],
            action: "action.career_limit",
            reference: { id: "nasa-std-3001-radiation", title: "NASA-STD-3001", url: "https://www.nasa.gov/" },
            evidence: [
              { signal: "dose_today", value: 601.2, unit: "mSv", normal_low: 0, normal_high: 600, z_score: 0, direction: "above" },
            ],
          },
        ],
      },
    };
    render(
      <I18nProvider initial="en">
        <Dashboard state={pastLimit} crewId="commander" onCrew={() => undefined} />
      </I18nProvider>,
    );

    expect(screen.getAllByText("Career radiation limit reached (600 mSv)").length).toBeGreaterThan(0);
    const header = screen.getByRole("button", { name: /^Radiation/, expanded: true });
    expect(header).not.toHaveTextContent("Within limit");
    expect(header).toHaveTextContent("Emergency");
  });
  it("switches to the mission view and back, and keeps its own address", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Mission view" }));

    expect(window.location.hash).toBe("#mission");
    expect(document.querySelectorAll(".gauge.bubble")).toHaveLength(6);
    // The attention from the sleep alert still reads in the mission view.
    expect(screen.getByText("Sleep last night: outside your normal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Panel view" }));

    expect(window.location.hash).toBe("");
    expect(document.querySelectorAll(".gauge.bubble")).toHaveLength(0);
  });

  it("opens a system's section in the panel when its bubble is clicked", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Mission view" }));

    fireEvent.click(document.querySelector<HTMLElement>('.gauge.bubble[data-target="neurological"]') as HTMLElement);

    expect(document.querySelectorAll(".gauge.bubble")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /^Neurological/, expanded: true })).toBeInTheDocument();
  });
});
