"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Mail } from "lucide-react";
import { SOCIAL_LINKS, CONTACT_EMAIL } from "@/components/SocialIcons";
import { useLanguage } from "@/hooks/context/LanguageContext";

const circleClass =
  "flex h-10 w-10 items-center justify-center rounded-full border border-fq-ink/10 bg-white text-fq-ink shadow-sm transition-colors hover:bg-fq-ink hover:text-white";

/**
 * The fixed column on the right edge of the marketing site: Back to Top, then
 * Instagram, X, LinkedIn and email, with Finna's bubble fixed directly beneath
 * (ChatbotWidget's landing spot, which can't be dragged) so they read as one
 * column.
 *
 * Back to Top only appears once the page has scrolled, and shows at every
 * width — on a phone it sits just above Finna. The social and email links are
 * md and up only: on a phone they would sit on top of the content, and the
 * footer has them.
 */
export default function SocialSidebar() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div className="fixed bottom-[80px] right-6 z-40 flex flex-col items-center gap-2">
      {scrolled && (
        <button
          type="button"
          onClick={toTop}
          aria-label={t("nav", "backToTop")}
          title={t("nav", "backToTop")}
          className={`${circleClass} md:mb-2`}
        >
          <ArrowUp className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      )}
      <div className="hidden flex-col items-center gap-2 md:flex">
        {SOCIAL_LINKS.map(({ name, href, Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            title={name}
            className={circleClass}
          >
            <Icon className="h-[18px] w-[18px]" />
          </a>
        ))}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          aria-label={t("nav", "emailUs")}
          title={t("nav", "emailUs")}
          className={circleClass}
        >
          <Mail className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
        <span aria-hidden="true" className="mt-1 h-6 w-px bg-fq-ink/20" />
      </div>
    </div>
  );
}
