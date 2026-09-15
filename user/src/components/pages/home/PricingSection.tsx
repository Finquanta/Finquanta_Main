"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Hourglass } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { CORPORATE_ENQUIRY, PRICING, formatPrice, type PlanDisplay } from "@/lib/pricing";

type PaidKey = "starter" | "entrepreneur" | "business";

/**
 * Freemium as a slim banner, the three self-serve tiers as cards with the middle
 * one raised and dark, and Corporate as a wide banner — five tiers without
 * squeezing five cards into one row.
 *
 * Every price and allowance comes from lib/pricing.ts, which a test holds to the
 * server's plan catalogue. The "coming soon" lines are the ones ComparisonTable
 * marks amber for that tier.
 */
export default function PricingSection({
  showCompareLink = true,
  titleAs: Title = "h2",
}: {
  /** Off on /pricing, where the full comparison is already on the page. */
  showCompareLink?: boolean;
  /** h1 when this is the page's main heading. */
  titleAs?: "h1" | "h2";
}) {
  const { t, language } = useLanguage();
  const [yearly, setYearly] = useState(false);

  const number = (n: number) => new Intl.NumberFormat(language).format(n);
  const withCount = (key: string, n: number) => t("home", key).replace("{n}", number(n));

  const allowances = (plan: PlanDisplay): string[] => {
    const lines: string[] = [];
    if (plan.finnaMessagesPerMonth !== null) lines.push(withCount("bMessages", plan.finnaMessagesPerMonth));
    if (plan.councilSessionsPerMonth) lines.push(withCount("bCouncil", plan.councilSessionsPerMonth));
    if (plan.scansPerMonth !== null) lines.push(withCount("bScans", plan.scansPerMonth));
    lines.push(plan.exportsPerMonth === null ? t("home", "bExportsUnlimited") : withCount("bExports", plan.exportsPerMonth));
    lines.push(plan.groups === null ? t("home", "bGroupsUnlimited") : withCount("bGroups", plan.groups));
    return lines;
  };

  const cards: { key: PaidKey; name: string; description: string; extra: string; soon: string; featured?: boolean }[] = [
    { key: "starter", name: "Starter", description: t("home", "planStarterDesc"), extra: t("home", "bBrainGraph"), soon: t("home", "soonBank") },
    { key: "entrepreneur", name: "Entrepreneur", description: t("home", "planEntDesc"), extra: t("home", "bBrainAi"), soon: t("home", "soonForecast"), featured: true },
    { key: "business", name: "Business", description: t("home", "planBizDesc"), extra: t("home", "bBrainAi"), soon: t("home", "soonStatements") },
  ];

  const freeBody = t("home", "freeBody")
    .replace("{messages}", number(PRICING.freemium.finnaMessagesPerMonth ?? 0))
    .replace("{scans}", number(PRICING.freemium.scansPerMonth ?? 0));

  const toggleClass = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${on ? "bg-fq-ink text-white" : "text-fq-slate hover:text-fq-ink"}`;

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-[#1E9E2A]">{t("home", "pricingEyebrow")}</p>
        <Title className="mt-3 text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-5xl">{t("home", "pricingTitle")}</Title>
        <p className="mt-4 text-base leading-relaxed text-fq-slate sm:text-lg">{t("home", "pricingSub")}</p>
      </div>

      <div className="mt-8 flex justify-center">
        <div role="group" aria-label={t("home", "pricingEyebrow")} className="inline-flex items-center rounded-full border border-fq-ink/10 bg-white p-1">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className={toggleClass(!yearly)}>
            {t("home", "billMonthly")}
          </button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className={toggleClass(yearly)}>
            {t("home", "billYearly")}
            <span className="ml-2 rounded-full bg-fq-green px-2 py-0.5 text-[11px] font-semibold text-fq-dark">{t("home", "billSave")}</span>
          </button>
        </div>
      </div>

      {/* Freemium */}
      <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-fq-ink/10 bg-white p-5 sm:flex-row sm:items-center">
        <p className="flex items-baseline gap-3">
          <span className="font-semibold text-fq-ink">Freemium</span>
          <span className="text-2xl font-medium text-fq-ink">${PRICING.freemium.monthly}</span>
        </p>
        <p className="text-sm text-fq-slate sm:flex-1 sm:px-4">{freeBody}</p>
        <Link
          href="/signup"
          className="inline-flex h-10 items-center justify-center rounded-full border border-fq-ink/15 px-5 text-sm font-semibold text-fq-ink transition-colors hover:bg-fq-card-alt"
        >
          {t("home", "freeCta")}
        </Link>
      </div>

      {/* Starter / Entrepreneur / Business */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-center">
        {cards.map((card) => {
          const plan = PRICING[card.key];
          const dark = !!card.featured;
          return (
            <article
              key={card.key}
              className={`relative flex flex-col rounded-3xl p-7 ${dark ? "bg-fq-ink text-white shadow-[0_40px_80px_-30px_rgba(15,18,16,0.55)] lg:py-10" : "border border-fq-ink/10 bg-white text-fq-ink"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{card.name}</h3>
                {dark && (
                  <span className="rounded-full bg-fq-green px-2.5 py-1 text-xs font-semibold text-fq-dark">{t("home", "recommended")}</span>
                )}
              </div>
              <p className={`mt-2 text-sm leading-relaxed lg:min-h-[4.5rem] ${dark ? "text-white/60" : "text-fq-slate"}`}>{card.description}</p>
              <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
                <span className="text-4xl font-medium tracking-tight">{formatPrice(yearly ? plan.annual : plan.monthly)}</span>
                <span className={`text-sm ${dark ? "text-white/50" : "text-fq-slate"}`}>{t("home", yearly ? "perSeatYear" : "perSeatMonth")}</span>
              </p>
              {/* Sign-up, not checkout: buying needs an account and a workspace.
                  The plan rides along so the dashboard opens on it; the price
                  never does, because the server decides what things cost. */}
              <Link
                href={`/signup?plan=${card.key}`}
                className={`mt-6 inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${dark ? "bg-fq-green text-fq-dark hover:bg-fq-green/90" : "bg-fq-ink text-white hover:bg-fq-ink/90"}`}
              >
                {t("nav", "getStarted")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <ul className="mt-7 space-y-3 text-sm">
                {[...allowances(plan), card.extra].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-fq-green" : "text-[#1E9E2A]"}`} aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
                <li className={`flex gap-2.5 ${dark ? "text-white/60" : "text-fq-slate"}`}>
                  <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <span>
                    {card.soon}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${dark ? "bg-white/10 text-white/70" : "bg-amber-50 text-amber-700"}`}>
                      {t("home", "soonTag")}
                    </span>
                  </span>
                </li>
              </ul>
            </article>
          );
        })}
      </div>

      {/* Corporate */}
      <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-fq-card-alt p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-fq-ink">Corporate</p>
          <p className="mt-1 max-w-2xl text-sm text-fq-slate">{t("home", "corpBody")}</p>
        </div>
        <a
          href={CORPORATE_ENQUIRY}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-fq-ink/15 bg-white px-5 text-sm font-semibold text-fq-ink transition-colors hover:bg-fq-bg"
        >
          {t("home", "contactSales")}
        </a>
      </div>

      {showCompareLink && (
        <p className="mt-8 text-center">
          <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-fq-ink underline-offset-4 hover:underline">
            {t("home", "compareAll")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      )}
    </section>
  );
}
