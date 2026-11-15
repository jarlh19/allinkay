import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Body3D, supportsWebGL } from "./Body3D";

const statuses = { head: "ok", chest: "ok", abdomen: "ok", radiation: "ok", environment: "ok" } as const;

describe("Body3D", () => {
  it("shows the 2D figure when the browser cannot draw 3D", () => {
    expect(supportsWebGL()).toBe(false); // the test browser has no WebGL

    render(
      <Body3D statuses={statuses} label="The body" onPick={() => undefined}>
        <svg role="img" aria-label="2D body" />
      </Body3D>,
    );

    expect(screen.getByRole("img", { name: "2D body" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "The body" })).not.toBeInTheDocument();
  });
});
