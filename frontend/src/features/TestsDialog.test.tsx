import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CrewMemberSummary } from "../api/types";
import { I18nProvider } from "../i18n/i18n";
import { loadSessions } from "./cognitive/engine";
import { StatusColumn } from "./StatusColumn";

const commander: CrewMemberSummary = { id: "commander", role: "commander", mode: "ship", status: "normal", alerts: 0 };

function renderColumn() {
  return render(
    <I18nProvider initial="en">
      <StatusColumn evaluation={null} radiation={null} member={commander} memberNumber={1} connected />
    </I18nProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("Cognitive tests", () => {
  it("opens from the overall status with the four tests, their NASA counterparts and a start button each", () => {
    renderColumn();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cognitive tests" }));

    const dialog = screen.getByRole("dialog", { name: /Cognitive tests/ });
    expect(dialog).toHaveTextContent("For: Commander");
    const cards = within(dialog).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "Reaction Alert",
      "Memory Matrix",
      "Pattern Solver",
      "Spatial Navigator",
    ]);
    expect(within(dialog).getAllByRole("button", { name: "Start" })).toHaveLength(4);
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

  it("runs Pattern Solver to the end and keeps the result on this device for that crew member", () => {
    vi.useFakeTimers();
    renderColumn();
    fireEvent.click(screen.getByRole("button", { name: "Cognitive tests" }));
    const cards = screen.getAllByRole("listitem");
    fireEvent.click(within(cards[2] as HTMLElement).getByRole("button", { name: "Start" }));
    expect(screen.getByText("Which number comes next?")).toBeInTheDocument();

    for (let i = 0; i < 10; i++) {
      const choices = document.querySelectorAll<HTMLButtonElement>(".mind-choice");
      expect(choices).toHaveLength(4);
      fireEvent.click(choices[0] as HTMLButtonElement);
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }

    expect(screen.getByText("Test complete")).toBeInTheDocument();
    expect(screen.getByText("Saved on this device for Commander.")).toBeInTheDocument();
    const saved = loadSessions();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ user_id: "commander", test_id: "pattern", source: "allinkay-app" });
    expect(saved[0]?.metrics.total).toBe(10);
  });

  it("counts a click before the green signal as a false start in Reaction Alert", () => {
    vi.useFakeTimers();
    renderColumn();
    fireEvent.click(screen.getByRole("button", { name: "Cognitive tests" }));
    fireEvent.click(within(screen.getAllByRole("listitem")[0] as HTMLElement).getByRole("button", { name: "Start" }));
    const signal = screen.getByRole("button", { name: "Reaction signal" });

    fireEvent.click(signal); // begin: the signal now waits before turning green
    expect(screen.getByText("Wait for green")).toBeInTheDocument();
    fireEvent.click(signal); // too early

    expect(screen.getByText("Too early. Try again.")).toBeInTheDocument();
  });
});
