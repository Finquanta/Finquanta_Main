"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import HeroSection from "@/components/pages/home/HeroSection";
import BrainSection from "@/components/pages/home/BrainSection";
import CompareSection from "@/components/pages/home/CompareSection";
import PricingSection from "@/components/pages/home/PricingSection";
import NewsletterSection from "@/components/pages/home/NewsletterSection";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { clearSession, SIGNED_OUT_PARAM } from "@/lib/auth";

/**
 * The marketing homepage, in the order the product is sold: the hero with a
 * live view of the dashboard, Company Brain with Finna and the Finna Council,
 * how Finquanta compares, pricing, then the newsletter. Kept short on purpose —
 * the detail lives in the product and on /pricing.
 */
export default function Home() {
  const { t } = useLanguage();
  const router = useRouter();
  const [showCTA, setShowCTA] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Already logged in? Skip the marketing homepage and go straight to the
  // dashboard. The session is "saved" via the access token in localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Just logged out from another address (app.): this address keeps its own
    // storage, so clear it here too rather than trusting a leftover token.
    const url = new URL(window.location.href);
    if (url.searchParams.has(SIGNED_OUT_PARAM)) {
      clearSession();
      url.searchParams.delete(SIGNED_OUT_PARAM);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      return;
    }
    if (localStorage.getItem("accessToken")) {
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const handleScroll = () => {
      if (dismissed) return;
      if (window.scrollY > window.innerHeight * 1.5) setShowCTA(true);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dismissed]);

  const handleDismiss = () => {
    setShowCTA(false);
    setDismissed(true);
  };

  // Don't flash the marketing page while we bounce a logged-in user to /dashboard.
  if (redirecting) return null;

  return (
    <div
      className="bg-fq-bg text-fq-ink"
      // The layout clears the floating nav with padding on a white page. Pulling
      // this back up by the same amount lets the hero's own background, dot grid
      // included, run underneath the nav instead of a white strip. HeroSection
      // adds the clearance back inside itself.
      style={{ marginTop: "calc(-4.75rem - var(--maintenance-h, 0px))" }}
    >
      <HeroSection />
      <BrainSection />
      <CompareSection />
      <PricingSection />
      <NewsletterSection />

      {showCTA && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-fq-dark/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-cta-title"
        >
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <button
              onClick={handleDismiss}
              aria-label={t("home", "close")}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-fq-slate hover:bg-fq-card-alt hover:text-fq-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <h2 id="home-cta-title" className="text-xl font-semibold text-fq-ink">{t("cta", "title")}</h2>
            <p className="mb-6 mt-2 text-sm text-fq-slate">{t("cta", "description")}</p>
            <Link
              href="/signup"
              onClick={handleDismiss}
              className="inline-flex h-11 items-center rounded-full bg-fq-green px-6 text-sm font-semibold text-fq-dark hover:bg-fq-green/90"
            >
              {t("cta", "button")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
