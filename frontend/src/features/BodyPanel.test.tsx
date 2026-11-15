import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Evaluation } from "../api/types";
import { I18nProvider } from "../i18n/i18n";
import { BodyPanel } from "./BodyPanel";

describe("BodyPanel leader lines", () => {
  it("keeps the leader lines hidden while the body is the 2D figure", () => {
    const { container } = render(
      <I18nProvider>
        <BodyPanel evaluation={null} radiation={null} focused={null} onFocus={() => undefined} onMode={() => undefined} />
      </I18nProvider>,
    );

    const stage = container.querySelector(".body-stage");
    const leaders = container.querySelector("svg.leaders");
    // The test browser has no WebGL, so no 3D frame ever reports where the rings point to.
    expect(stage).not.toHaveAttribute("data-leaders");
    expect(leaders).toHaveAttribute("aria-hidden", "true");
    // One leader per ring, each naming the ring it starts from.
    const targets = [...container.querySelectorAll<SVGGElement>("svg.leaders g[data-target]")].map((g) => g.dataset.target);
    const rings = [...container.querySelectorAll<HTMLElement>(".gauge[data-target]")].map((ring) => ring.dataset.target);
    expect(targets.sort()).toEqual(rings.sort());
    expect(rings).toHaveLength(6);
  });
});

describe("BodyPanel outline legend", () => {
  const evaluation = (mode: "ship" | "field"): Evaluation => ({
    type: "evaluation",
    mode,
    mitigation: "mitigation.ship_routines",
    deviations: [],
    alerts: [],
  });
  const legend = (mode: "ship" | "field") => {
    const { container, unmount } = render(
      <I18nProvider>
        <BodyPanel evaluation={evaluation(mode)} radiation={null} focused={null} onFocus={() => undefined} onMode={() => undefined} />
      </I18nProvider>,
    );
    const text = container.querySelector("p.legend")?.textContent ?? "";
    unmount();
    return text;
  };

  it("says the outline is the skin in the ship and NASA's spacesuit in the field", () => {
    expect(legend("ship")).toContain("the skin");
    expect(legend("field")).toContain("NASA's Z2 spacesuit");
  });
});
