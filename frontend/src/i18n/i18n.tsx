import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { format, MESSAGES, type Language, type MessageKey } from "./messages";

interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

/**
 * The app always opens in English, its main language and the one NASA Space Apps judges read (D-024).
 * Spanish is one click away and lasts for the visit; it is not remembered for the next opening.
 */
export function startingLanguage(): Language {
  return "en";
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  const [language, setState] = useState<Language>(initial ?? startingLanguage);

  useEffect(() => {
    // Tells assistive technology and the browser which language the page is in.
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => setState(next), []);

  const value = useMemo<I18n>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => format(MESSAGES[language][key], params),
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
