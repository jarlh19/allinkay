import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider, startingLanguage, useI18n } from "./i18n";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("startingLanguage", () => {
  it("opens in English with a Spanish browser", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-PE");

    expect(startingLanguage()).toBe("en");
  });

  it("opens in English even if Spanish was chosen on an earlier visit", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-PE");
    window.localStorage.setItem("allinkay.language", "es");

    expect(startingLanguage()).toBe("en");
  });
});

function Switch() {
  const { language, setLanguage } = useI18n();
  return (
    <button type="button" onClick={() => setLanguage("es")}>
      {language}
    </button>
  );
}

describe("I18nProvider", () => {
  it("switches to Spanish for this visit without carrying it to the next opening", () => {
    const first = render(
      <I18nProvider>
        <Switch />
      </I18nProvider>,
    );
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button")).toHaveTextContent("es");
    expect(document.documentElement.lang).toBe("es");
    first.unmount();

    render(
      <I18nProvider>
        <Switch />
      </I18nProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("en");
  });
});
