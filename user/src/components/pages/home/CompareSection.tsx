"use client";

import Image from "next/image";
import { Check, X } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";

type Cell = boolean | "personal" | "household";

/**
 * Finquanta beside the tools people compare it with.
 *
 * Every mark in this table is a claim about someone else's product, so each is
 * kept to what that company's own website or app listing says. Checked
 * September 2026 — re-check before changing a row, and update the note under
 * the table with the new date:
 * - QuickBooks does bookkeeping and invoicing, and Intuit Assist answers
 *   questions about your books. It has no health score built from your books;
 *   its "Business Health Check" is a separate questionnaire.
 * - Xero does bookkeeping and invoicing, and JAX answers questions about your
 *   financial data.
 * - Wave does bookkeeping and invoicing, with no AI assistant.
 * - Tendi is an AI money coach for personal finances (an iPhone app). It has a
 *   Financial Health Index for households and no business bookkeeping.
 * Nobody else has a Company Brain or a council of advisors that votes.
 */
const COMPETITORS = ["QuickBooks", "Xero", "Wave", "Tendi"];

const ROWS: { key: string; cells: [Cell, Cell, Cell, Cell, Cell] }[] = [
  { key: "rowBrain", cells: [true, false, false, false, false] },
  { key: "rowFinna", cells: [true, true, true, false, "personal"] },
  { key: "rowCouncil", cells: [true, false, false, false, false] },
  { key: "rowHealth", cells: [true, false, false, false, "household"] },
  { key: "rowBooks", cells: [true, true, true, true, false] },
];

export default function CompareSection() {
  const { t } = useLanguage();

  const renderCell = (cell: Cell, ours: boolean) => {
    if (cell === true) {
      return (
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${ours ? "bg-fq-green text-fq-dark" : "bg-fq-green/15 text-[#1E9E2A]"}`}>
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
          <span className="sr-only">{t("home", "compareIncluded")}</span>
        </span>
      );
    }
    if (cell === false) {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fq-card-alt text-fq-slate/60">
          <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          <span className="sr-only">{t("home", "compareNotIncluded")}</span>
        </span>
      );
    }
    return (
      <span className="text-xs font-medium leading-snug text-fq-slate">
        {t("home", cell === "personal" ? "cellPersonal" : "cellHousehold")}
      </span>
    );
  };

  return (
    <section id="compare" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-[#1E9E2A]">{t("home", "compareEyebrow")}</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-5xl">{t("home", "compareTitle")}</h2>
        <p className="mt-4 text-base leading-relaxed text-fq-slate sm:text-lg">{t("home", "compareSub")}</p>
      </div>

      <div className="mt-10 overflow-hidden rounded-3xl border border-fq-ink/10 bg-white shadow-[0_30px_70px_-45px_rgba(15,18,16,0.35)]">
        {/* `relative` is load-bearing: without a positioned scroll box, the
            sticky first column's overflow widened a phone's layout to ~706px,
            pushing the fixed Finna bubble and Back to Top off the screen. */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">{t("home", "compareTitle")}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-[34%] bg-white px-6 py-5 text-left">
                  <span className="sr-only">{t("pricing", "pFeatures")}</span>
                </th>
                <th scope="col" className="bg-fq-ink px-4 py-5 text-center">
                  {/* The full company logo, turned white for the dark column. */}
                  <Image
                    src="/images/finquanta_logo.svg"
                    width={112}
                    height={28}
                    alt="Finquanta"
                    className="mx-auto h-6 w-auto brightness-0 invert"
                  />
                </th>
                {COMPETITORS.map((name) => (
                  <th key={name} scope="col" className="px-4 py-5 text-center font-semibold text-fq-slate">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className="border-t border-fq-ink/[0.06]">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-6 py-4 text-left font-medium leading-snug text-fq-ink">
                    {t("home", row.key)}
                  </th>
                  {row.cells.map((cell, column) => (
                    <td key={column} className={`px-4 py-4 text-center ${column === 0 ? "bg-fq-ink" : ""}`}>
                      {renderCell(cell, column === 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-fq-slate">{t("home", "compareNote")}</p>
    </section>
  );
}
