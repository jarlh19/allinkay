import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Forecast } from "../api/types";
import { I18nProvider } from "../i18n/i18n";
import { ForecastChart } from "./ForecastChart";

const forecast: Forecast = {
  type: "forecast",
  signal: "sleep_hours",
  unit: "h",
  history: [7.4, 7.0, 6.2, 5.6, 5.2],
  points: [
    { step: 1, value: 4.8, low: 4.5, high: 5.1 },
    { step: 2, value: 4.4, low: 4.0, high: 4.8 },
    { step: 3, value: 4.0, low: 3.5, high: 4.5 },
  ],
  trend_per_night: -0.4,
  normal_low: 6.8,
  normal_high: 8.0,
  method: "holt-linear-exponential-smoothing",
};

describe("ForecastChart", () => {
  it("summarizes the forecast for the last night", () => {
    render(
      <I18nProvider initial="en">
        <ForecastChart forecast={forecast} />
      </I18nProvider>,
    );

    expect(screen.getByRole("img", { name: /forecast/i })).toBeInTheDocument();
    expect(screen.getByText(/in 3 nights you would sleep about 4.0 h \(likely 3.5–4.5 h\)/)).toBeInTheDocument();
  });

  it("waits until there is enough data", () => {
    render(
      <I18nProvider initial="es">
        <ForecastChart forecast={null} />
      </I18nProvider>,
    );

    expect(screen.getByText(/después de tres noches/)).toBeInTheDocument();
  });
});
