"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

import ar from "@/locales/ar.json";
import de from "@/locales/de.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import ja from "@/locales/ja.json";
import nl from "@/locales/nl.json";
import pt from "@/locales/pt.json";
import ru from "@/locales/ru.json";
import zh from "@/locales/zh.json";

/**
 * Translations live in src/locales/<lang>.json, one file per language.
 *
 * They used to be five object literals in this file — `translations`, plus
 * `dashboardExtra`, `dashboardPeriods`, `onboardingStrings` and `settingsExtra`
 * merged over it at module load. That layout hid real problems: a key could sit
 * in one object and be silently overridden by another, a section could exist in
 * an "extra" but appear missing when you searched the main object, and adding a
 * string meant editing ten inline blocks in a 600-line file. Every JSON here is
 * the fully merged result, so what you read is what `t()` returns.
 *
 * Flat JSON is also what a translation service or a native reviewer expects, so
 * languages can now go out and come back without touching any code.
 */
type Dict = Record<string, Record<string, string>>;

const translations: Record<string, Dict> = {
  en: en as Dict,
  nl: nl as Dict,
  de: de as Dict,
  fr: fr as Dict,
  es: es as Dict,
  pt: pt as Dict,
  ar: ar as Dict,
  zh: zh as Dict,
  ja: ja as Dict,
  ru: ru as Dict,
};

/** The languages the picker offers — derived, so adding a JSON file is enough. */
export const AVAILABLE_LANGUAGES = Object.keys(translations);

/**
 * Native names for the picker. Endonyms on purpose: a language is listed the
 * way its own speakers write it, so these are never translated and never run
 * through `t`.
 *
 * Lives here rather than in the components because four separate pickers had
 * each grown their own copy of this list — adding a locale meant remembering
 * all four, and missing one silently dropped the language from that menu.
 */
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  pt: "Português",
  ar: "العربية",
  zh: "中文",
  ja: "日本語",
  ru: "Русский",
};

/**
 * Derived from the locale files, so a new JSON appears in every picker at once.
 * A locale with no endonym above falls back to its uppercased code rather than
 * vanishing from the menu.
 */
export const LANGUAGE_OPTIONS: { code: string; label: string }[] =
  AVAILABLE_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code] ?? code.toUpperCase(),
  }));

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (section: string, key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("finquanta_language");
    if (savedLanguage && translations[savedLanguage]) {
      setLanguageState(savedLanguage);
    }
    setHydrated(true);
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem("finquanta_language", lang);
  };

  /**
   * Falls back to English before showing anything, so a key a translator hasn't
   * reached yet reads as English rather than as `section.key`. The raw key is
   * the last resort and means the key genuinely doesn't exist anywhere.
   */
  const t = (section: string, key: string): string => {
    const lang = hydrated ? language : "en";
    return (
      translations[lang]?.[section]?.[key] ||
      translations.en?.[section]?.[key] ||
      `${section}.${key}`
    );
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
