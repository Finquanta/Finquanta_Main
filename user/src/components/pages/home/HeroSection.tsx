"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import DashboardPreview from "./DashboardPreview";

/**
 * "Meet your [Company Brain]." renders the bracketed words in the muted tone. Each line
 * is one whole translated sentence and translators move the brackets, so no
 * sentence is ever assembled from separately translated pieces.
 */
export function TwoTone({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).filter(Boolean).map((part, i) =>
        part.startsWith("[") ? (
          <span key={i} className="text-fq-slate/40">{part.slice(1, -1)}</span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/**
 * A green dot grid that drifts one cell on a loop (so the loop point can't be
 * seen) under a fade that stays put, and a glow breathing behind the headline.
 * Transform and opacity only, hidden from assistive technology, and still for
 * anyone who asks for reduced motion.
 */
function HeroBackdrop() {
  const fade = "radial-gradient(ellipse 70% 60% at 50% 32%, black 25%, transparent 78%)";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ WebkitMaskImage: fade, maskImage: fade }}>
        <div
          className="absolute -inset-6 animate-dot-drift motion-reduce:animate-none"
          style={{
            backgroundImage: "radial-gradient(rgba(58,213,66,0.38) 1.2px, transparent 1.7px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <div className="absolute left-1/2 top-16 h-[440px] w-[880px] max-w-[150%] -translate-x-1/2">
        <div
          className="h-full w-full rounded-full animate-glow-breathe motion-reduce:animate-none"
          style={{ background: "radial-gradient(closest-side, rgba(58,213,66,0.22), rgba(58,213,66,0))" }}
        />
      </div>
    </div>
  );
}

export default function HeroSection() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");

  // Whatever they typed goes straight into sign-up as a pre-filled email.
  const goToSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    router.push(value ? `/signup?email=${encodeURIComponent(value)}` : "/signup");
  };

  return (
    <section
      className="relative isolate overflow-hidden"
      // Clears the floating nav and the maintenance banner; the homepage pulls
      // itself up under the nav so this backdrop can sit behind it.
      style={{ paddingTop: "calc(4.75rem + var(--maintenance-h, 0px))" }}
    >
      <HeroBackdrop />
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-fq-ink/10 bg-white/70 px-3 py-1 text-xs font-medium text-fq-slate backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-fq-green" aria-hidden="true" />
          {t("home", "heroPill")}
        </p>

        <h1 className="mx-auto mt-6 max-w-4xl text-[2.25rem] font-medium leading-[1.04] tracking-[-0.035em] text-fq-ink [text-wrap:balance] sm:text-6xl lg:text-7xl">
          <span className="block"><TwoTone text={t("home", "heroLine1")} /></span>
          <span className="block"><TwoTone text={t("home", "heroLine2")} /></span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fq-slate [text-wrap:pretty] sm:text-lg">
          {t("home", "heroSub")}
        </p>

        <form
          onSubmit={goToSignup}
          className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row sm:rounded-full sm:border sm:border-fq-ink/10 sm:bg-white sm:p-1.5 sm:shadow-sm"
        >
          <label htmlFor="hero-email" className="sr-only">{t("hero", "emailPlaceholder")}</label>
          <input
            id="hero-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("hero", "emailPlaceholder")}
            className="h-12 w-full rounded-full border border-fq-ink/10 bg-white px-5 text-sm text-fq-ink placeholder:text-fq-slate/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-fq-green sm:h-10 sm:border-0 sm:bg-transparent sm:px-4"
          />
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-fq-green px-6 text-sm font-semibold text-fq-dark transition-colors hover:bg-fq-green/90 sm:h-10"
          >
            {t("nav", "getStarted")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <Link
          href="/demo"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-fq-ink/70 underline-offset-4 hover:text-fq-ink hover:underline"
        >
          {t("hero", "tryDemoLink")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>

        {/* The dashboard itself, live: its layout and the real Health Score card,
            filled with sample data. See DashboardPreview. */}
        <figure className="relative mx-auto mt-14 max-w-5xl">
          <div className="rounded-2xl border border-fq-ink/10 bg-white p-2 shadow-[0_40px_90px_-30px_rgba(15,18,16,0.35)]">
            <div className="flex gap-1.5 px-2 pb-2 pt-1" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-fq-ink/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-fq-ink/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-fq-ink/10" />
            </div>
            <DashboardPreview />
          </div>
          <figcaption className="sr-only">{t("home", "previewLabel")}</figcaption>
        </figure>
      </div>
    </section>
  );
}
