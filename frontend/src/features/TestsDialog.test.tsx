import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n/i18n";
import { StatusColumn } from "./StatusColumn";

function renderColumn() {
  return render(
    <I18nProvider initial="en">
      <StatusColumn evaluation={null} radiation={null} member={undefined} memberNumber={1} connected />
    </I18nProvider>,
  );
}

describe("Cognitive tests", () => {
  it("opens from the overall status with the four tests and their NASA counterparts", () => {
    renderColumn();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cognitive tests" }));

    const dialog = screen.getByRole("dialog", { name: "Cognitive tests" });
    const cards = within(dialog).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "Reaction timeIn development",
      "MemoryIn development",
      "PatternsIn development",
      "Spatial orientationIn development",
    ]);
    expect(dialog).toHaveTextContent("Psychomotor Vigilance Test");
    expect(dialog).toHaveTextContent("Line Orientation Test");
    expect(dialog).toHaveTextContent("Basner et al. (2015)");
  });

  it("closes with Escape and gives the focus back to its button", () => {
    renderColumn();
    const opener = screen.getByRole("button", { name: "Cognitive tests" });
    fireEvent.click(opener);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
