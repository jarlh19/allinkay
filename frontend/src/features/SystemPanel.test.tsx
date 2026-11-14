import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Deviation, Evaluation } from "../api/types";
import { I18nProvider } from "../i18n/i18n";
import { SystemPanel } from "./SystemPanel";

const wbc = (overrides: Partial<Deviation>): Deviation => ({
  signal: "white_blood_cells",
  system: "immune",
  value: 3.2,
  unit: "10^3/µL",
  baseline_mean: 5.97,
  normal_low: 4.86,
  normal_high: 7.08,
  baseline_source: "pre-flight (synthetic); spread: EFLM Biological Variation Database",
  z_score: -3.7,
  outside_normal: true,
  confirmed: false,
  repeat_requested: false,
  ...overrides,
});

function renderImmune(deviation: Deviation) {
  const evaluation: Evaluation = {
    type: "evaluation",
    mode: "ship",
    mitigation: "mitigation.ship_routines",
    deviations: [deviation],
    alerts: [],
  };
  return render(
    <I18nProvider initial="en">
      <SystemPanel
        system="immune"
        signals={["white_blood_cells"]}
        readings={{}}
        evaluation={evaluation}
        heartRateHistory={[]}
        focused={false}
      />
    </I18nProvider>,
  );
}

describe("SystemPanel", () => {
  it("asks to repeat an unusual exam before it counts", () => {
    renderImmune(wbc({ repeat_requested: true }));

    expect(screen.getByText(/repeat this exam tomorrow/)).toBeInTheDocument();
    expect(screen.queryByText(/Outside your normal/)).not.toBeInTheDocument();
  });

  it("credits NASA data only for a normal that comes from it", () => {
    const { unmount } = renderImmune(wbc({}));
    expect(screen.queryByText(/real NASA data/)).not.toBeInTheDocument();
    unmount();

    renderImmune(wbc({ baseline_source: "NASA OSDR OSD-569 (C001, pre-flight L-92, L-44, L-3)" }));
    expect(screen.getByText(/real NASA data/)).toBeInTheDocument();
  });
});
