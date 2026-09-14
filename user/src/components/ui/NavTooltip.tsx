"use client";

/**
 * The label beside a collapsed sidebar's icon-only link, shown on hover and on
 * keyboard focus. CSS only — no tooltip library is installed, and this needs no
 * positioning logic because it always opens to the right of the sidebar.
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
  if (!show) return <>{children}</>;
  return (
    <span className="group/tip relative block">
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-full top-1/2 z-50 ml-5 -translate-y-1/2 whitespace-nowrap rounded-md bg-fq-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 motion-reduce:transition-none ${lgOnly ? "hidden lg:block" : "block"}`}
      >
        {label}
      </span>
    </span>
  );
}
