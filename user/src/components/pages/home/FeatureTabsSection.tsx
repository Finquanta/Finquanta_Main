"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Brain, Camera, FileSpreadsheet, HeartPulse, Mail, Users, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";

type Tab = "bookkeeping" | "brain";
const TABS: Tab[] = ["bookkeeping", "brain"];

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Which plans have it, when that isn't all of them. */
  tag?: string;
}

export default function FeatureTabsSection() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("bookkeeping");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ bookkeeping: null, brain: null });

  // The nav's "Company Brain" link lands on this tab: from another page through
  // #brain in the URL, and from this page through an event, because the hash
  // may already be #brain and setting it again would not fire hashchange.
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#brain") setTab("brain");
    };
    const fromEvent = (e: Event) => setTab((e as CustomEvent<Tab>).detail);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("fq:feature-tab", fromEvent);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("fq:feature-tab", fromEvent);
    };
  }, []);

  const panels: Record<Tab, { label: string; features: Feature[]; image: string; alt: string }> = {
    bookkeeping: {
      label: t("home", "tabBookkeeping"),
      features: [
        { icon: Camera, title: t("home", "fScanTitle"), body: t("home", "fScanBody") },
        { icon: FileSpreadsheet, title: t("home", "fImportTitle"), body: t("home", "fImportBody") },
        { icon: Mail, title: t("home", "fEmailTitle"), body: t("home", "fEmailBody") },
      ],
      image: "/images/home/books.webp",
      alt: t("home", "booksShotAlt"),
    },
    brain: {
      label: t("home", "tabBrain"),
      features: [
        { icon: Brain, title: t("home", "fBrainTitle"), body: t("home", "fBrainBody") },
        { icon: Users, title: t("home", "fCouncilTitle"), body: t("home", "fCouncilBody"), tag: t("home", "fCouncilTag") },
        { icon: HeartPulse, title: t("home", "fHealthTitle"), body: t("home", "fHealthBody") },
      ],
      image: "/images/home/health.webp",
      alt: t("home", "healthShotAlt"),
    },
  };
  const panel = panels[tab];

  // Arrow keys move between tabs, as the ARIA tabs pattern expects.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <span id="brain" className="block scroll-mt-24" aria-hidden="true" />
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-[#1E9E2A]">{t("home", "featuresEyebrow")}</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-5xl">{t("home", "featuresTitle")}</h2>
        <p className="mt-4 text-base leading-relaxed text-fq-slate sm:text-lg">{t("home", "featuresSub")}</p>
      </div>

      <div
        role="tablist"
        aria-label={t("home", "featuresEyebrow")}
        className="mx-auto mt-10 flex w-fit rounded-full border border-fq-ink/10 bg-white p-1"
      >
        {TABS.map((key) => (
          <button
            key={key}
            ref={(el) => { tabRefs.current[key] = el; }}
            id={`feature-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls="feature-panel"
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={onKeyDown}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${tab === key ? "bg-fq-ink text-white" : "text-fq-slate hover:text-fq-ink"}`}
          >
            {panels[key].label}
          </button>
        ))}
      </div>

      <div
        id="feature-panel"
        role="tabpanel"
        aria-labelledby={`feature-tab-${tab}`}
        className="mt-10 grid items-center gap-6 lg:grid-cols-2"
      >
        <ul className="grid gap-3">
          {panel.features.map((feature) => (
            <li key={feature.title} className="flex gap-4 rounded-2xl border border-fq-ink/10 bg-white p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fq-green/15 text-[#1E9E2A]">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="flex flex-wrap items-center gap-2 font-semibold text-fq-ink">
                  {feature.title}
                  {feature.tag && (
                    <span className="rounded-full bg-fq-card-alt px-2 py-0.5 text-[11px] font-medium text-fq-slate">{feature.tag}</span>
                  )}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-fq-slate">{feature.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="rounded-3xl border border-fq-ink/10 bg-white p-2 shadow-[0_30px_70px_-35px_rgba(15,18,16,0.3)]">
          <Image
            key={panel.image}
            src={panel.image}
            alt={panel.alt}
            width={1600}
            height={1000}
            sizes="(min-width: 1024px) 560px, 100vw"
            className="h-auto w-full rounded-2xl"
          />
        </div>
      </div>
    </section>
  );
}
