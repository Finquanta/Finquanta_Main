"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/hooks/context/LanguageContext";

export default function SocialSidebar() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  const isDashboard =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/profile-settings") ||
    pathname?.startsWith("/bookkeeping") ||
    pathname?.startsWith("/inbox") ||
    pathname?.startsWith("/payroll") ||
    pathname?.startsWith("/documents") ||
    pathname?.startsWith("/statistics") ||
    pathname?.startsWith("/business-plan");

  useEffect(() => {
    if (isDashboard) { setVisible(false); return; }
    const handleScroll = () => {
      // Explicit anchor rather than a class-name guess. This used to select
      // ".relative.py-12", which happened to match one div in AiFocusSection —
      // so the rail's visibility was coupled to an unrelated component's
      // Tailwind string and would have broken silently on restyling it.
      const banner = document.querySelector("[data-social-anchor]");
      if (banner) {
        setVisible(banner.getBoundingClientRect().bottom < 0);
      } else {
        setVisible(true);
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname, isDashboard]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  if (!visible || isDashboard) return null;

  return (
    // Right-hand side, sitting ABOVE Finna's bubble rather than on top of it.
    // The bubble rests at right:16 / bottom:96 and is 48px tall (ChatbotWidget
    // BUBBLE_DEFAULT / BUBBLE_SIZE), so it occupies 96-144px from the bottom;
    // bottom-40 (160px) clears that with room to spare. The bubble is also
    // draggable and remembers where it was put, so someone can still park it
    // over this rail on purpose — only the resting positions are guaranteed
    // not to collide.
    <div className="fixed right-4 bottom-40 z-50 flex flex-col items-center gap-2">
      {/* Social controls. There is deliberately no chat trigger here:
          ChatbotWidget renders its own bubble, and a second launcher for the
          same panel is just two buttons doing one job. */}
      {open ? (
        <div className="flex flex-col items-center bg-black rounded-full py-3 px-2 gap-3"
          style={{ animation: "slideUp 0.3s ease forwards", transformOrigin: "bottom" }}>
          <a href="mailto:info@finquanta.com" aria-label="Email" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </a>
          <a href="https://x.com/finquanta" target="_blank" rel="noopener noreferrer" aria-label="X" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="black"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>
          </a>
          <a href="https://www.linkedin.com/company/finquanta/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="black"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
          <a href="https://www.instagram.com/finquanta" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="black"/></svg>
          </a>
          <button onClick={() => setOpen(false)} aria-label={t("community", "socialClose")} className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} aria-label={t("community", "socialOpen")} className="bg-black rounded-full w-12 h-12 flex items-center justify-center hover:opacity-80">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      )}

      <button onClick={scrollToTop} aria-label={t("community", "socialBackToTop")} className="bg-black rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </button>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}