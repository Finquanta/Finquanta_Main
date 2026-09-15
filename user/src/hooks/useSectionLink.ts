"use client";

import { useRouter } from "next/navigation";

/** The floating nav's height plus breathing room, so a heading doesn't land under it. */
const NAV_CLEARANCE = 96;

/**
 * Go to a homepage section: scroll to it when it's on this page, otherwise open
 * the homepage at it. The marketing nav, mobile menu and footer render on every
 * marketing page, and most of those pages don't have the sections.
 */
export function useSectionLink() {
  const router = useRouter();
  return (id: string) => {
    const target = document.getElementById(id);
    if (!target) {
      router.push(`/home#${id}`);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - NAV_CLEARANCE,
      behavior: reduce ? "auto" : "smooth",
    });
  };
}
