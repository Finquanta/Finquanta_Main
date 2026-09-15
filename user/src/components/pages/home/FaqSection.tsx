"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { PRICING, formatPrice } from "@/lib/pricing";

export default function FaqSection() {
  const { t } = useLanguage();

  // The starting price is read from the plan catalogue. The old answer had
  // "$49.99" typed into all ten translations, and went stale the day Starter
  // launched at $19.99.
  const items = [1, 2, 3, 4, 5, 6].map((n) => ({
    question: t("home", `faq${n}Q`),
    answer: t("home", `faq${n}A`).replace("{price}", formatPrice(PRICING.starter.monthly)),
  }));

  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <h2 className="text-center text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-5xl">{t("faq", "title")}</h2>
      <p className="mt-4 text-center text-base text-fq-slate sm:text-lg">{t("home", "faqSub")}</p>
      <Accordion type="single" collapsible className="mt-10 overflow-hidden rounded-2xl border border-fq-ink/10 bg-white">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i + 1}`} className="border-b border-fq-ink/10 px-5 last:border-b-0">
            <AccordionTrigger className="py-5 text-left text-base font-medium text-fq-ink hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-[15px] leading-relaxed text-fq-slate">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
