"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The label beside a collapsed sidebar's icon-only link, shown on hover and on
 * keyboard focus.
 *
 * Rendered into <body> at a fixed position rather than inside the sidebar. The
 * sidebars scroll, and a scroll container clips anything positioned inside it,
 * so a tooltip living in the sidebar would be cut off at its edge. It lines up
 * with the sidebar's right edge (the nearest [data-nav-rail]) and closes when
 * anything scrolls, so it can't drift away from its link.
 *
 * The link keeps its own screen-reader label, so this is hidden from assistive
 * technology rather than read twice. When `show` is false it renders nothing
 * extra, so an expanded sidebar is untouched.
 */
export default function NavTooltip({
  label,
  show,
  lgOnly = true,
  children,
}: {
  label: string;
  show: boolean;
  /** The app sidebar only collapses at lg+; below that it is a drawer with labels. */
  lgOnly?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  if (!show) return <>{children}</>;

  const open = () => {
    const el = ref.current;
    if (!el) return;
    if (lgOnly && !window.matchMedia("(min-width: 1024px)").matches) return;
    const box = el.getBoundingClientRect();
    const rail = el.closest("[data-nav-rail]")?.getBoundingClientRect();
    setPos({ top: box.top + box.height / 2, left: (rail?.right ?? box.right) + 8 });
  };

  return (
    <span
      ref={ref}
      className="relative block"
      onMouseEnter={open}
      onMouseLeave={() => setPos(null)}
      onFocus={open}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos &&
        createPortal(
          <span
            aria-hidden="true"
            className="pointer-events-none fixed z-[10000] -translate-y-1/2 whitespace-nowrap rounded-md bg-fq-ink px-2 py-1 text-xs font-medium text-white shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}
