import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n/i18n";
import { ReportDialog } from "./ReportDialog";

function renderDialog() {
  return render(
    <I18nProvider initial="en">
      <ReportDialog open onClose={() => undefined} screen="model" missionDay={96} mode="field" crewId="engineer" />
    </I18nProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReportDialog", () => {
  it("sends the report with its context and shows the reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reference: "#12", destination: "github" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();

    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "The chart froze" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => expect(screen.getByText("Thanks! Report sent (#12).")).toBeInTheDocument());
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ what_happened: "The chart froze", screen: "model", mission_day: 96, language: "en", crew: "engineer", mode: "field" });
  });

  it("explains the rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderDialog();

    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Again" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => expect(screen.getByText(/Too many reports/)).toBeInTheDocument());
  });
});
