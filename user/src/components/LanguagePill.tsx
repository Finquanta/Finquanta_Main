"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLanguage, LANGUAGE_OPTIONS } from "@/hooks/context/LanguageContext";

/**
 * The marketing nav's language control: a small "EN ⌄" pill that opens the
 * full list. It replaces a native <select> whose flag emoji rendered as
 * letters on Windows, and it drives the same setLanguage.
 */
export default function LanguagePill() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("nav", "language")}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-fq-ink/10 bg-white px-3 text-xs font-semibold text-fq-ink transition-colors hover:bg-fq-card-alt"
      >
        {language.toUpperCase()}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <ul className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-fq-ink/10 bg-white py-1 shadow-lg">
          {LANGUAGE_OPTIONS.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                lang={option.code}
                aria-current={option.code === language ? "true" : undefined}
                onClick={() => {
                  setLanguage(option.code);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-fq-ink hover:bg-fq-card-alt"
              >
                {option.label}
                {option.code === language && <Check className="h-4 w-4 text-[#1E9E2A]" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
