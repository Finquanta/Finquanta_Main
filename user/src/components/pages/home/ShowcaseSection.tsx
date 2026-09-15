"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";

/** The Health Score's four ratios: liquidity, profitability, debt and cash flow. */
const HEALTH_RATIOS = 4;

function Banner({ title, body, stat, statLabel, tone, cta }: {
  title: string;
  body: string;
  stat: string;
  statLabel: string;
  tone: "green" | "dark";
  cta: string;
}) {
  const green = tone === "green";
  return (
    <div className={`flex flex-col rounded-3xl p-7 sm:p-8 ${green ? "bg-gradient-to-br from-[#3AD542] to-[#1E9E2A] text-fq-dark" : "bg-fq-ink text-white"}`}>
      <h3 className="text-2xl font-medium tracking-[-0.02em]">{title}</h3>
      <p className={`mt-3 text-sm leading-relaxed ${green ? "text-fq-dark/75" : "text-white/65"}`}>{body}</p>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
        <p className="flex items-baseline gap-3">
          <span className="text-5xl font-medium tracking-tight">{stat}</span>
          <span className={`max-w-[11rem] text-sm leading-snug ${green ? "text-fq-dark/75" : "text-white/60"}`}>{statLabel}</span>
        </p>
        <Link
          href="/demo"
          className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${green ? "bg-fq-dark text-white hover:bg-fq-dark/85" : "bg-fq-green text-fq-dark hover:bg-fq-green/90"}`}
        >
          {cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * A wide product screenshot with two stat banners beneath it. The screenshot is
 * cropped to where the invoice list ends, so it runs full width rather than
 * sitting beside the banners in a column of empty space.
 */
export default function ShowcaseSection() {
  const { t } = useLanguage();
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="rounded-3xl border border-fq-ink/10 bg-white p-2 shadow-[0_30px_70px_-40px_rgba(15,18,16,0.3)]">
        <Image
          src="/images/home/invoices.webp"
          alt={t("home", "invoicesShotAlt")}
          width={2000}
          height={800}
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="h-auto w-full rounded-2xl"
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Banner
          tone="green"
          title={t("home", "showDashTitle")}
          body={t("home", "showDashBody")}
          stat={String(HEALTH_RATIOS)}
          statLabel={t("home", "showDashStat")}
          cta={t("nav", "tryTheDemo")}
        />
        <Banner
          tone="dark"
          title={t("home", "showInvTitle")}
          body={t("home", "showInvBody")}
          stat="0"
          statLabel={t("home", "showInvStat")}
          cta={t("nav", "tryTheDemo")}
        />
      </div>
    </section>
  );
}
