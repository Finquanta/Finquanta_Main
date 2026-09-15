"use client";

import { useLanguage, LANGUAGE_OPTIONS } from "@/hooks/context/LanguageContext";
import { PRICING } from "@/lib/pricing";

/** How many file types Books Export writes: xlsx, csv, pdf and txt. */
const EXPORT_FORMATS = 4;
/** Typed, imported from a spreadsheet, captured from a photo, or forwarded by email. */
const WAYS_IN = 4;

/**
 * The reference design frames the problem with four statistics. There are no
 * sourced statistics to put here, so every card is a fact about the product
 * instead, and the ones that can be counted are read from the code that makes
 * them true.
 */
export default function FactsSection() {
  const { t } = useLanguage();

  const facts = [
    { value: String(WAYS_IN), label: t("home", "factWays") },
    { value: String(LANGUAGE_OPTIONS.length), label: t("home", "factLanguages") },
    { value: String(EXPORT_FORMATS), label: t("home", "factExports") },
    { value: `$${PRICING.freemium.monthly}`, label: t("home", "factFree") },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-5xl">{t("home", "factsTitle")}</h2>
        <p className="mt-4 text-base leading-relaxed text-fq-slate sm:text-lg">{t("home", "factsSub")}</p>
      </div>
      <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <li key={fact.label} className="rounded-2xl bg-fq-card-alt p-6">
            <p className="text-5xl font-medium tracking-tight text-fq-ink">{fact.value}</p>
            <p className="mt-4 text-sm leading-relaxed text-fq-slate">{fact.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
