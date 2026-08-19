"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { GraphFilters } from "./BrainGraph";

/**
 * What the graph draws, as a dropdown in the toolbar.
 *
 * These used to be a row of pills in the right panel, which meant they were
 * only reachable with the panel open and sat a long way from the canvas they
 * change. They belong beside Add to Brain: they are about what you're looking
 * at, not about a department.
 *
 * The trigger shows a count whenever anything is switched off, so a hidden node
 * type can't be mistaken for an empty Brain.
 */
export default function GraphFilterMenu({
  isDark, filters, onFilters,
}: {
  isDark: boolean;
  filters: GraphFilters;
  onFilters: (f: GraphFilters) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on an outside click or Escape — a menu that traps you is worse than
  // the pills it replaced.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ITEMS: { key: keyof GraphFilters; label: string }[] = [
    { key: "note", label: t("dashboard", "brainTypeNote") },
    { key: "task", label: t("dashboard", "brainTypeTask") },
    { key: "link", label: t("dashboard", "brainTypeLink") },
    { key: "entity_ref", label: t("dashboard", "brainTypeRecord") },
    { key: "insight", label: t("dashboard", "brainTypeInsight") },
    { key: "category", label: t("dashboard", "brainGraphCategories") },
    { key: "orphan", label: t("dashboard", "brainGraphOrphans") },
  ];

  const hidden = ITEMS.filter((i) => !filters[i.key]).length;

  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";
  const hover = isDark ? "hover:bg-gray-700" : "hover:bg-gray-100";
  const panel = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${border} ${
          hidden > 0 ? "text-blue-500" : sub
        } ${hover}`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("dashboard", "brainGraphFilters")}</span>
        {hidden > 0 && (
          <span className="px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-semibold tabular-nums">
            {hidden}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute left-0 top-full mt-1 z-30 w-52 rounded-xl border shadow-lg p-1.5 ${panel}`}>
          {ITEMS.map((f) => (
            <label
              key={f.key}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm cursor-pointer ${text} ${hover}`}
            >
              <input
                type="checkbox"
                checked={filters[f.key]}
                onChange={() => onFilters({ ...filters, [f.key]: !filters[f.key] })}
                className="h-4 w-4 rounded accent-blue-500"
              />
              {f.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
