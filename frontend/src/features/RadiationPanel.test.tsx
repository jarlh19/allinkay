import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Radiation } from "../api/types";
import { I18nProvider } from "../i18n/i18n";
import { RadiationPanel } from "./RadiationPanel";

const radiation = (overrides: Partial<Radiation>): Radiation => ({
  type: "radiation",
  dose_rate_msv_per_day: 1.8,
  accumulated_msv: 256,
  career_limit_msv: 600,
  career_fraction: 0.427,
  days_to_limit: 191,
  event_limit_msv: 250,
  storm_active: false,
  storm_dose_msv: 0,
  organs_at_risk: [],
  storm_reference: null,
  ...overrides,
});

// As the backend sends it from the NASA DONKI files in data/donki.
const march2012 = {
  source: "NASA DONKI",
  sep_id: "2012-03-07T04:05:00-SEP-001",
  particles_at: "2012-03-07T04:05:00+00:00",
  instrument: "GOES13: SEM/EPS >100 MeV",
  flare_class: "X5.4",
  flare_peak_at: "2012-03-07T00:24:00+00:00",
  alert_at: "2012-03-07T04:42:00+00:00",
};

function renderPanel(value: Radiation, language: "en" | "es" = "en") {
  return render(
    <I18nProvider initial={language}>
      <RadiationPanel radiation={value} />
    </I18nProvider>,
  );
}

describe("RadiationPanel", () => {
  it("names the real event the demo storm refers to, in UTC", () => {
    renderPanel(radiation({ storm_reference: march2012 }));

    expect(
      screen.getByText(
        "Reference event (NASA DONKI): solar flare X5.4 on 2012-03-07 at 00:24 UTC; protons reached Earth orbit 3.7 h later (GOES13: SEM/EPS >100 MeV). The demo storm is synthetic in size.",
      ),
    ).toBeInTheDocument();
  });

  it("says the same in Spanish", () => {
    renderPanel(radiation({ storm_reference: march2012 }), "es");

    expect(screen.getByText(/erupción solar X5\.4 el 2012-03-07 a las 00:24 UTC/)).toBeInTheDocument();
  });

  it("shows no reference when there is no scripted storm", () => {
    renderPanel(radiation({}));

    expect(screen.queryByText(/Reference event/)).not.toBeInTheDocument();
  });
});
