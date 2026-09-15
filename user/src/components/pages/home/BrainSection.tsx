"use client";

import Image from "next/image";
import { Bot, Building2, Crosshair, HeartPulse, Sprout, Users } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";

type Vote = "support" | "conditional" | "oppose";

/**
 * The centre of the homepage: what Company Brain runs on, and the two ways
 * people use it — Finna and the Finna Council.
 *
 * The four signals are the product's real inputs, not a slogan. Financial
 * health is the Health Score computed from the ledger; industry, niche and
 * maturity stage are business profile fields that the Health Score, the
 * Council's context and the Brain's pins all read (server/src/modules/health,
 * council/council.context.ts, brain/brain.pins.ts). The Council's four members
 * are the ones defined in council.service.ts.
 *
 * The Finna conversation and the Council votes are illustrations, and say so.
 */
export default function BrainSection() {
  const { t } = useLanguage();

  const signals = [
    { icon: HeartPulse, title: t("home", "signalHealthTitle"), body: t("home", "signalHealthBody") },
    { icon: Crosshair, title: t("home", "signalNicheTitle"), body: t("home", "signalNicheBody") },
    { icon: Building2, title: t("home", "signalIndustryTitle"), body: t("home", "signalIndustryBody") },
    { icon: Sprout, title: t("home", "signalMaturityTitle"), body: t("home", "signalMaturityBody") },
  ];

  const votes: { name: string; vote: Vote }[] = [
    { name: t("home", "advisorCfo"), vote: "conditional" },
    { name: t("home", "advisorAdvisor"), vote: "support" },
    { name: t("home", "advisorCeo"), vote: "support" },
    { name: t("home", "advisorAnalyst"), vote: "oppose" },
  ];
  const voteChip: Record<Vote, { label: string; className: string }> = {
    support: { label: t("home", "voteSupport"), className: "bg-emerald-400/15 text-emerald-300" },
    conditional: { label: t("home", "voteConditional"), className: "bg-amber-400/15 text-amber-300" },
    oppose: { label: t("home", "voteOppose"), className: "bg-rose-400/15 text-rose-300" },
  };

  const signalCard = (signal: (typeof signals)[number]) => (
    <li key={signal.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fq-green/15 text-fq-green">
          <signal.icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="font-semibold">{signal.title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{signal.body}</p>
    </li>
  );

  return (
    <section id="brain" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-fq-ink px-6 py-14 text-white sm:px-12 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-96 w-[760px] max-w-[160%] -translate-x-1/2 -translate-y-1/3 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(58,213,66,0.22), rgba(58,213,66,0))" }}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-fq-green">{t("home", "brainEyebrow")}</p>
          <h2 className="mt-3 text-4xl font-medium tracking-[-0.035em] [text-wrap:balance] sm:text-6xl">{t("home", "brainTitle")}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">{t("home", "brainSub")}</p>
        </div>

        {/* The four signals around the brain. */}
        <div className="relative mt-14 flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-8">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">{signals.slice(0, 2).map(signalCard)}</ul>

          <div aria-hidden="true" className="order-first flex justify-center py-4 lg:order-none lg:py-0">
            <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
              <span className="absolute inset-0 rounded-full border border-fq-green/30 animate-pulse-ring motion-reduce:hidden" />
              <span className="absolute inset-3 rounded-full border border-fq-green/20" />
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(closest-side, rgba(58,213,66,0.35), rgba(58,213,66,0))" }}
              />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-fq-green shadow-[0_0_70px_rgba(58,213,66,0.45)]">
                <Image src="/favicon.svg" width={48} height={50} alt="" className="h-12 w-auto brightness-0" />
              </div>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">{signals.slice(2).map(signalCard)}</ul>
        </div>

        <div className="relative mt-10 grid gap-4 lg:grid-cols-2">
          {/* Finna */}
          <article className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <header className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fq-green text-fq-dark">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xl font-semibold">Finna</h3>
                <p className="text-sm text-white/55">{t("home", "finnaRole")}</p>
              </div>
            </header>
            <p className="mt-4 text-sm leading-relaxed text-white/65">{t("home", "finnaBody")}</p>
            <figure className="mt-6 flex flex-1 flex-col justify-start gap-3 rounded-2xl bg-black/30 p-4">
              <figcaption className="text-[11px] font-medium uppercase tracking-wider text-white/40">{t("home", "exampleLabel")}</figcaption>
              <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-md bg-white/10 px-4 py-2 text-sm">{t("home", "finnaExampleQ")}</p>
              <p className="flex w-fit max-w-[85%] items-start gap-2 rounded-2xl rounded-es-md bg-fq-green/15 px-4 py-2 text-sm text-white/90">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-fq-green" aria-hidden="true" />
                {t("home", "finnaExampleA")}
              </p>
            </figure>
          </article>

          {/* Finna Council */}
          <article className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <header className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-fq-ink">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                  {t("home", "councilName")}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">{t("home", "planTag")}</span>
                </h3>
                <p className="text-sm text-white/55">{t("home", "councilRole")}</p>
              </div>
            </header>
            <p className="mt-4 text-sm leading-relaxed text-white/65">{t("home", "councilBody")}</p>
            <figure className="mt-6 flex-1 rounded-2xl bg-black/30 p-4">
              <figcaption className="text-[11px] font-medium uppercase tracking-wider text-white/40">{t("home", "exampleLabel")}</figcaption>
              <p className="mt-3 text-sm font-medium text-white/90">{t("home", "councilExampleQ")}</p>
              <ul className="mt-2 divide-y divide-white/5">
                {votes.map((member) => (
                  <li key={member.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-white/75">{member.name}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${voteChip[member.vote].className}`}>
                      {voteChip[member.vote].label}
                    </span>
                  </li>
                ))}
              </ul>
            </figure>
          </article>
        </div>
      </div>
    </section>
  );
}
