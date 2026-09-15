"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { SOCIAL_LINKS } from "@/components/SocialIcons";

/** Each half of the marquee repeats the three profiles this many times, so a wide screen never shows the end. */
const REPEATS = 4;

/**
 * The dark closing band with the social marquee.
 *
 * The marquee is the tailwind `scroll` keyframe, which moves the list by half its
 * width: it renders two identical halves, and the second is hidden from screen
 * readers and the tab order so every profile is announced once.
 */
export default function ClosingCtaSection() {
  const { t } = useLanguage();
  const half = Array.from({ length: REPEATS }, () => SOCIAL_LINKS).flat();
  const edgeFade = "linear-gradient(to right, transparent, black 12%, black 88%, transparent)";

  return (
    // Little top padding: the newsletter (and the blog preview, when there are
    // posts) above already end with their own bottom space.
    <section className="px-4 pb-20 pt-2 sm:px-6 sm:pb-28 sm:pt-4">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-fq-ink px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-80 w-[720px] max-w-[160%] -translate-x-1/2 -translate-y-1/3">
          <div
            className="h-full w-full rounded-full animate-glow-breathe motion-reduce:animate-none"
            style={{ background: "radial-gradient(closest-side, rgba(58,213,66,0.3), rgba(58,213,66,0))" }}
          />
        </div>

        <h2 className="relative text-4xl font-medium tracking-[-0.035em] sm:text-6xl">{t("auth", "shellTagline")}</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">{t("home", "ctaBody")}</p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-fq-green px-6 text-sm font-semibold text-fq-dark transition-colors hover:bg-fq-green/90"
          >
            {t("nav", "getStarted")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t("nav", "tryTheDemo")}
          </Link>
        </div>

        <p className="relative mt-14 text-xs font-medium uppercase tracking-[0.2em] text-white/40">{t("home", "ctaFollow")}</p>
        <div className="relative mt-5 overflow-hidden" style={{ WebkitMaskImage: edgeFade, maskImage: edgeFade }}>
          <ul className="flex w-max animate-scroll gap-4 [--animation-duration:32s] hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[0, 1].map((copy) =>
              half.map(({ name, href, Icon }, i) => (
                <li key={`${copy}-${i}`} aria-hidden={copy === 1 ? true : undefined}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={copy === 1 ? -1 : undefined}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {name}
                  </a>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
