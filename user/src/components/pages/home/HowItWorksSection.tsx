"use client";

import Image from "next/image";
import { useLanguage } from "@/hooks/context/LanguageContext";

export default function HowItWorksSection() {
  const { t } = useLanguage();

  const steps = [
    { title: t("home", "step1Title"), body: t("home", "step1Body") },
    { title: t("home", "step2Title"), body: t("home", "step2Body") },
    { title: t("home", "step3Title"), body: t("home", "step3Body") },
  ];

  return (
    <section className="border-y border-fq-ink/5 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-[#1E9E2A]">{t("home", "stepsEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-5xl">{t("home", "stepsTitle")}</h2>
          <p className="mt-4 text-base leading-relaxed text-fq-slate sm:text-lg">{t("home", "stepsSub")}</p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl rounded-3xl border border-fq-ink/10 bg-fq-bg p-2">
          <Image
            src="/images/home/groups.webp"
            alt={t("home", "groupsShotAlt")}
            width={2000}
            height={975}
            sizes="(min-width: 1024px) 880px, 100vw"
            className="h-auto w-full rounded-2xl"
          />
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="border-t border-fq-ink/10 pt-6">
              <span className="font-mono text-sm font-semibold text-[#1E9E2A]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-lg font-semibold text-fq-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fq-slate">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
