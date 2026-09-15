"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mail, Plus, X } from "lucide-react";
import { SOCIAL_LINKS, CONTACT_EMAIL } from "@/components/SocialIcons";
import { useLanguage } from "@/hooks/context/LanguageContext";

// A touch smaller on phones, where the column sits over the content.
const circleClass =
  "flex h-9 w-9 items-center justify-center rounded-full border border-fq-ink/10 bg-white text-fq-ink shadow-sm transition-colors hover:bg-fq-ink hover:text-white md:h-10 md:w-10";
const iconClass = "h-4 w-4 md:h-[18px] md:w-[18px]";

/**
 * The fixed column on the right edge of the marketing site, with Finna's bubble
 * fixed directly beneath (ChatbotWidget's landing spot, which can't be dragged)
 * so they read as one column.
 *
 * md and up: Back to Top, then Instagram, X, LinkedIn and email, always shown.
 * Phones: four always-visible icons covered the content (the comparison table's
 * marks among it), so the user chose one button that fans them out above Back
 * to Top. Tapping outside, a link or Escape folds them away again.
 *
 * Back to Top only appears once the page has scrolled. On phones the column is
 * nudged 2px in so its centre still lines up with the bubble's.
 */
export default function SocialSidebar() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toTop = () => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div ref={rootRef} className="fixed bottom-[80px] right-[26px] z-40 flex flex-col items-center gap-2 md:right-6">
      {scrolled && (
        <button
          type="button"
          onClick={toTop}
          aria-label={t("nav", "backToTop")}
          title={t("nav", "backToTop")}
          className={`${circleClass} order-2 md:order-1 md:mb-2`}
        >
          <ArrowUp className={iconClass} aria-hidden="true" />
        </button>
      )}

      <div
        id="social-links"
        className={`${open ? "flex" : "hidden"} order-1 mb-1 flex-col items-center gap-2 md:order-2 md:mb-0 md:flex`}
      >
        {SOCIAL_LINKS.map(({ name, href, Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            title={name}
            onClick={() => setOpen(false)}
            className={circleClass}
          >
            <Icon className={iconClass} />
          </a>
        ))}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          aria-label={t("nav", "emailUs")}
          title={t("nav", "emailUs")}
          onClick={() => setOpen(false)}
          className={circleClass}
        >
          <Mail className={iconClass} aria-hidden="true" />
        </a>
      </div>

      {/* Phones only: folds the social links away so they don't cover the page. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="social-links"
        aria-label={open ? t("nav", "closeMenu") : t("nav", "socialLinks")}
        title={t("nav", "socialLinks")}
        className={`${circleClass} order-3 md:hidden`}
      >
        {open ? <X className={iconClass} aria-hidden="true" /> : <Plus className={iconClass} aria-hidden="true" />}
      </button>

      <span aria-hidden="true" className="order-4 mt-1 hidden h-6 w-px bg-fq-ink/20 md:block" />
    </div>
  );
}
