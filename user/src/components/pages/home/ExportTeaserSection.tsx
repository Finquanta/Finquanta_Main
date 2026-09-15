"use client";

import { ArrowRight, FileSpreadsheet, FileText, Sheet, Type } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useSectionLink } from "@/hooks/useSectionLink";

/** Books Export: the file types the export route writes (server/src/modules/exports). */
export default function ExportTeaserSection() {
  const { t } = useLanguage();
  const goTo = useSectionLink();

  const formats = [
    { ext: "xlsx", name: "Excel", icon: FileSpreadsheet },
    { ext: "csv", name: "CSV", icon: Sheet },
    { ext: "pdf", name: "PDF", icon: FileText },
    { ext: "txt", name: t("home", "formatTxt"), icon: Type },
  ];

  return (
    <section className="px-4 sm:px-6">
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[2rem] bg-fq-ink px-6 py-14 text-white sm:px-12 sm:py-16 md:grid-cols-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(58,213,66,0.24), rgba(58,213,66,0))" }}
        />
        <div className="relative">
          <p className="text-sm font-semibold text-fq-green">{t("home", "exportEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-5xl">{t("home", "exportTitle")}</h2>
          <p className="mt-4 leading-relaxed text-white/70">{t("home", "exportBody")}</p>
          <p className="mt-4 text-sm text-white/50">{t("home", "exportNote")}</p>
          <button
            type="button"
            onClick={() => goTo("pricing")}
            className="mt-8 inline-flex h-11 items-center gap-1.5 rounded-full bg-fq-green px-5 text-sm font-semibold text-fq-dark transition-colors hover:bg-fq-green/90"
          >
            {t("home", "exportCta")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ul className="relative grid grid-cols-2 gap-3">
          {formats.map((format) => (
            <li key={format.ext} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <format.icon className="h-6 w-6 text-fq-green" aria-hidden="true" />
              <p className="mt-8 font-mono text-2xl font-semibold">.{format.ext}</p>
              <p className="mt-1 text-sm text-white/50">{format.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
