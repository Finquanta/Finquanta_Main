"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

import en from "@/locales/en.json";

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

/**
 * ONE LANGUAGE AT A TIME, not ten.
 *
 * Every locale used to be a static `import` at the top of this file. This is a
 * "use client" module wrapping the entire app, so all ten JSON files were
 * bundled into the client JavaScript of every page — 822 KB of translations
 * downloaded and parsed by every visitor in order to read one of them. That is
 * roughly 750 KB of pure waste on first load, and it is worst exactly where it
 * hurts most: a cold visit to a marketing page on a phone.
 *
 * English stays static because `t()` falls back to it for any key a translator
 * has not reached yet, so it must always be in memory. Every other language is
 * fetched on demand, as its own chunk, only if somebody actually selects it.
 *
 * The loaders are written as explicit literal `import()` calls rather than
 * built from a template string, because bundlers can only split what they can
 * see statically — `import(\`@/locales/${lang}.json\`)` would defeat the whole
 * change by pulling the directory back into one chunk.
 */
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  nl: () => import("@/locales/nl.json"),
  de: () => import("@/locales/de.json"),
  fr: () => import("@/locales/fr.json"),
  es: () => import("@/locales/es.json"),
  pt: () => import("@/locales/pt.json"),
  ar: () => import("@/locales/ar.json"),
  zh: () => import("@/locales/zh.json"),
  ja: () => import("@/locales/ja.json"),
  ru: () => import("@/locales/ru.json"),
};

/** Loaded dictionaries, English seeded. Cached so a re-pick costs no fetch. */
const loaded: Record<string, Dict> = { en: en as Dict };

/** The languages the picker offers — derived, so adding a loader is enough. */
export const AVAILABLE_LANGUAGES = ["en", ...Object.keys(LOADERS)];

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
  /**
   * Bumped when a dictionary finishes loading.
   *
   * `loaded` is a module-level cache, so mutating it does not re-render on its
   * own — React has no idea it changed. This counter is what tells the tree to
   * paint again once the strings are actually in hand.
   */
  const [, setLoadedTick] = useState(0);

  /** Pull a language's dictionary in, unless it is already cached or English. */
  const ensureLoaded = (lang: string) => {
    if (loaded[lang] || !LOADERS[lang]) return;
    LOADERS[lang]()
      .then((mod) => {
        loaded[lang] = mod.default as Dict;
        setLoadedTick((n) => n + 1);
      })
      // A chunk that will not load must not take the page down with it: `t()`
      // already falls back to English, so the app stays fully usable in the
      // wrong language rather than breaking in the right one.
      .catch(() => { /* stays on the English fallback */ });
  };

  useEffect(() => {
    const savedLanguage = localStorage.getItem("finquanta_language");
    if (savedLanguage && (savedLanguage === "en" || LOADERS[savedLanguage])) {
      setLanguageState(savedLanguage);
      ensureLoaded(savedLanguage);
    }
    setHydrated(true);
  }, []);

  const setLanguage = (lang: string) => {
    // Started before the state change so the fetch and the re-render overlap.
    ensureLoaded(lang);
    setLanguageState(lang);
    localStorage.setItem("finquanta_language", lang);
  };

  /**
   * Falls back to English before showing anything, so a key a translator hasn't
   * reached yet reads as English rather than as `section.key`. The raw key is
   * the last resort and means the key genuinely doesn't exist anywhere.
   *
   * The same fallback covers the moment before a lazily-loaded dictionary
   * arrives. That window is not new: the pre-hydration render below already
   * forced English, so a non-English visitor saw English on first paint
   * regardless — the strings simply swap in a beat later now.
   */
  const t = (section: string, key: string): string => {
    const lang = hydrated ? language : "en";
    return (
      loaded[lang]?.[section]?.[key] ||
      loaded.en?.[section]?.[key] ||
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
