"use client";

import { Bot, Gauge, KeyRound, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";

/**
 * Four things the product actually does, each traceable to code: TOTP two-factor
 * (server/src/modules/auth/twofa.service.ts), Cloudflare Turnstile on sign-up and
 * log-in (infrastructure/turnstile.ts), @fastify/rate-limit and the security
 * headers set in server.ts. Add a card here only when there is code behind it.
 */
export default function SecuritySection() {
  const { t } = useLanguage();

  const cards = [
    { icon: KeyRound, title: t("home", "sec2faTitle"), body: t("home", "sec2faBody") },
    { icon: Bot, title: t("home", "secBotTitle"), body: t("home", "secBotBody") },
    { icon: Gauge, title: t("home", "secRateTitle"), body: t("home", "secRateBody") },
    { icon: ShieldCheck, title: t("home", "secHeadersTitle"), body: t("home", "secHeadersBody") },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-[#1E9E2A]">{t("home", "secEyebrow")}</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-5xl">{t("home", "secTitle")}</h2>
        <p className="mt-4 text-base leading-relaxed text-fq-slate sm:text-lg">{t("home", "secSub")}</p>
      </div>
      <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.title} className="rounded-2xl border border-fq-ink/10 bg-white p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fq-ink text-fq-green">
              <card.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-semibold text-fq-ink">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fq-slate">{card.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
