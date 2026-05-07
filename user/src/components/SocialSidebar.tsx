"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function SocialSidebar() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  const isDashboard = pathname?.startsWith("/dashboard") ||
                    pathname?.startsWith("/profile-settings") || 
                      pathname?.startsWith("/bookkeeping") ||
                      pathname?.startsWith("/inbox") ||
                      pathname?.startsWith("/payroll") ||
                      pathname?.startsWith("/documents") ||
                      pathname?.startsWith("/statistics") ||
                      pathname?.startsWith("/settings") ||
                      pathname?.startsWith("/business-plan");

  useEffect(() => {
    if (isDashboard) {
      setVisible(false);
      return;
    }

    const handleScroll = () => {
      const banner = document.querySelector(".relative.py-12");
      if (banner) {
        const bannerBottom = banner.getBoundingClientRect().bottom;
        setVisible(bannerBottom < 0);
      } else {
        setVisible(true);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname, isDashboard]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible || isDashboard) return null;

  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col items-center gap-2">
      {open ? (
        <div className="flex flex-col items-center bg-black rounded-full py-3 px-2 gap-3">
          <a href="mailto:info@finquanta.com" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </a>
          <a href="https://x.com/finquanta" target="_blank" rel="noopener noreferrer" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="black"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>
          </a>
          <a href="https://www.linkedin.com/company/finquanta/" target="_blank" rel="noopener noreferrer" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="black"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
          <a href="https://www.instagram.com/finquanta" target="_blank" rel="noopener noreferrer" className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="black"/></svg>
          </a>
          <button onClick={() => setOpen(false)} className="bg-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="bg-black rounded-full w-12 h-12 flex items-center justify-center hover:opacity-80">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      )}
      <button onClick={scrollToTop} className="bg-black rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80 mt-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </button>
    </div>
  );
}