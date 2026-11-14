import { afterEach, describe, expect, it, vi } from "vitest";

import { startingLanguage } from "./i18n";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("startingLanguage", () => {
  it("follows a Spanish browser the first time", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-PE");

    expect(startingLanguage()).toBe("es");
  });

  it("keeps the language chosen before over the browser's", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-PE");
    window.localStorage.setItem("allinkay.language", "en");

    expect(startingLanguage()).toBe("en");
  });

  it("uses English for any other browser language", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("pt-BR");

    expect(startingLanguage()).toBe("en");
  });
});
