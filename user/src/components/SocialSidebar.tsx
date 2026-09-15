"use client";

import { SOCIAL_LINKS } from "@/components/SocialIcons";

/**
 * Instagram, X and LinkedIn in a column on the right edge of the marketing
 * site, with Finna's bubble docked directly beneath it — ChatbotWidget's landing
 * resting spot — so the two read as one fixed column.
 *
 * The short line joining them only shows while the bubble is docked. Drag Finna
 * elsewhere and ChatbotWidget sets data-finna-docked="0" on <html>, which hides
 * it. The icons themselves never move.
 *
 * md and up only: on a phone the column would sit on top of the content, and
 * the same three links are in the footer.
 */
export default function SocialSidebar() {
  return (
    <div className="fixed bottom-[80px] right-6 z-40 hidden flex-col items-center gap-2 md:flex">
      {SOCIAL_LINKS.map(({ name, href, Icon }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={name}
          title={name}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-fq-ink/10 bg-white text-fq-ink shadow-sm transition-colors hover:bg-fq-ink hover:text-white"
        >
          <Icon className="h-[18px] w-[18px]" />
        </a>
      ))}
      <span aria-hidden="true" className="mt-1 h-6 w-px bg-fq-ink/20 [html[data-finna-docked='0']_&]:hidden" />
    </div>
  );
}
