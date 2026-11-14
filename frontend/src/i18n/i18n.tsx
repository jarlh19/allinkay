import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { format, MESSAGES, type Language, type MessageKey } from "./messages";

const STORAGE_KEY = "allinkay.language";

interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

function savedLanguage(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  const [language, setState] = useState<Language>(initial ?? savedLanguage);

  const setLanguage = useCallback((next: Language) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the choice still applies to this visit.
    }
  }, []);

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
