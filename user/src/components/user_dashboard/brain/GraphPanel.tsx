"use client";

import { useState } from "react";
import {
  Inbox, Eye, EyeOff, Pencil, Plus, Check, X, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { BrainGraph as GraphData } from "@/lib/api/brain";
import { GraphSettings } from "./BrainGraph";

/**
 * Swatches offered for a department. Same family as GROUP_COLORS so the Brain
 * and the Groups module stay visually consistent, plus a few extra so eight
 * departments can all differ.
 */
const CATEGORY_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16", "#06b6d4", "#a855f7",
];

/**
 * The graph's right-hand panel (spec §8.3): what's in the graph, what's shown,
 * and how it's drawn.
 *
 * Clicking a department highlights that cluster and dims the rest — a way to
 * focus on one area without leaving the graph. Counts are live and roll
 * subcategories up into their parent.
 */
export default function GraphPanel({
  isDark, graph, view, showCrossLinks, onShowCrossLinks,
  settings, onSettings,
  hiddenCategories, onToggleCategory, focusCategoryId, onFocusCategory,
  onRenameCategory, onAddCategory, onRecolorCategory, onRemoveCategory,
}: {
  isDark: boolean;
  graph: GraphData;
  /** The panel serves both canvases; a few controls only apply to one of them. */
  view: "graph" | "tree";
  showCrossLinks: boolean;
  onShowCrossLinks: (v: boolean) => void;
  settings: GraphSettings;
  onSettings: (s: GraphSettings) => void;
  hiddenCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  focusCategoryId: string | null;
  onFocusCategory: (id: string | null) => void;
  onRenameCategory: (id: string, name: string) => Promise<void> | void;
  onAddCategory: (name: string) => Promise<void> | void;
  onRecolorCategory: (id: string, color: string) => Promise<void> | void;
  /** Archives the department; its notes move to Unassigned. */
  onRemoveCategory: (id: string, name: string) => Promise<void> | void;
}) {
  const { t } = useLanguage();

  // Renaming and adding happen inline here rather than behind a browser prompt,
  // so departments can be managed without leaving the graph.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  /** Which department has its colour swatches open. */
  const [coloringId, setColoringId] = useState<string | null>(null);
  /** Size and thickness are set-once-and-forget, so they start folded away. */
  const [displayOpen, setDisplayOpen] = useState(false);

  const commitRename = async (id: string) => {
    const name = draft.trim();
    if (!name) { setRenamingId(null); return; }
    setBusy(true);
    try { await onRenameCategory(id, name); } finally { setBusy(false); setRenamingId(null); }
  };

  const commitAdd = async () => {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    setBusy(true);
    try { await onAddCategory(name); } finally { setBusy(false); setAdding(false); setNewName(""); }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";
  const hover = isDark ? "hover:bg-gray-700" : "hover:bg-gray-100";

  // Split so the collapsible header can reuse the type styling without
  // fighting `mb-2` — two margin utilities in one class string resolve by
  // stylesheet order, not by which one you wrote last.
  const headingType = `text-[11px] font-semibold uppercase tracking-wide ${sub}`;
  const heading = `${headingType} mb-2`;

  /** The one switch people reach for constantly, so it sits at the very top. */
  const mainToggle = (label: string, on: boolean, set: (v: boolean) => void) => (
    <button
      onClick={() => set(!on)}
      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg border text-sm ${border} ${text} ${hover}`}
    >
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? "bg-blue-500" : isDark ? "bg-gray-600" : "bg-gray-300"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${on ? "translate-x-[19px]" : "translate-x-[3px]"}`} />
      </span>
    </button>
  );

  const slider = (
    label: string, value: number, min: number, max: number, set: (n: number) => void
  ) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs ${text}`}>{label}</span>
        <span className={`text-[11px] tabular-nums ${sub}`}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full h-1 accent-blue-500 cursor-pointer"
      />
    </div>
  );

  return (
    <div className={`rounded-xl border p-4 space-y-5 ${card}`}>
      {/* The main switch for whichever canvas is open, above everything else. */}
      {view === "graph"
        ? mainToggle(
            t("dashboard", "brainGraphNodeNames"),
            settings.showLabels,
            (v) => onSettings({ ...settings, showLabels: v })
          )
        : mainToggle(t("dashboard", "brainTreeCrossLinks"), showCrossLinks, onShowCrossLinks)}

      {/* Sits with the switch above it: both are about how the canvas is drawn,
          where Departments below is about what's in it. Size, thickness and
          arrows are set-once-and-forget, so they stay folded away. */}
      {view === "graph" && (
        <div>
          <button
            onClick={() => setDisplayOpen((v) => !v)}
            className={`w-full flex items-center gap-1.5 ${headingType} hover:text-blue-500`}
          >
            {displayOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {t("dashboard", "brainGraphDisplay")}
          </button>

          {displayOpen && (
            <div className="space-y-3 mt-3">
              {slider(t("dashboard", "brainGraphNodeSize"), settings.nodeSize, 50, 250,
                (n) => onSettings({ ...settings, nodeSize: n }))}
              {slider(t("dashboard", "brainGraphLinkThickness"), settings.linkThickness, 20, 300,
                (n) => onSettings({ ...settings, linkThickness: n }))}

              <label className={`flex items-center gap-2 text-sm cursor-pointer ${text}`}>
                <input
                  type="checkbox" checked={settings.showArrows}
                  onChange={(e) => onSettings({ ...settings, showArrows: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                {t("dashboard", "brainGraphArrows")}
              </label>
            </div>
          )}
        </div>
      )}

      <div className={`border-t pt-4 ${border}`}>
        <p className={heading}>{t("dashboard", "brainGraphDepartments")}</p>
        <div className="flex flex-col gap-0.5">
          {graph.categories.map((c) => {
            const hidden = hiddenCategories.has(c.id);
            const focused = focusCategoryId === c.id;

            if (renamingId === c.id) {
              return (
                <div key={c.id} className="flex items-center gap-1 px-1 py-0.5">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <input
                    autoFocus value={draft} disabled={busy}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(c.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className={`flex-1 min-w-0 text-sm rounded px-1.5 py-1 border outline-none ${
                      isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                  <button onClick={() => commitRename(c.id)} disabled={busy}
                    className="p-1 text-green-500 hover:text-green-600" title={t("dashboard", "brainSaveChanges")}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setRenamingId(null)} className={`p-1 ${sub}`} title={t("dashboard", "invCancel")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div key={c.id}>
              <div className="flex items-center gap-0.5 group">
                {/* The swatch is the colour control: click it to recolour every
                    node in this department. */}
                <button
                  onClick={() => setColoringId(coloringId === c.id ? null : c.id)}
                  className="p-1 rounded flex-shrink-0"
                  title={t("dashboard", "brainCategoryColor")}
                >
                  <span className="block h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c.color }} />
                </button>
                <button
                  onClick={() => onFocusCategory(focused ? null : c.id)}
                  className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left ${
                    focused ? (isDark ? "bg-gray-700 font-semibold" : "bg-orange-50 font-semibold") : `${text} ${hover}`
                  } ${hidden ? "opacity-40" : ""}`}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className={`text-xs tabular-nums ${sub}`}>{c.count}</span>
                </button>
                <button
                  onClick={() => { setRenamingId(c.id); setDraft(c.name); }}
                  className={`p-1 rounded ${sub} ${hover} opacity-0 group-hover:opacity-100 focus:opacity-100`}
                  title={t("dashboard", "brainRenameCategory")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onToggleCategory(c.id)}
                  className={`p-1 rounded ${sub} ${hover}`}
                  title={hidden ? t("dashboard", "brainGraphShow") : t("dashboard", "brainGraphHide")}
                >
                  {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => onRemoveCategory(c.id, c.name)}
                  className={`p-1 rounded ${sub} hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100`}
                  title={t("dashboard", "brainRemoveCategory")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {coloringId === c.id && (
                <div className={`flex flex-wrap gap-1.5 px-2 py-2 mt-0.5 rounded-lg border ${border}`}>
                  {CATEGORY_COLORS.map((hex) => (
                    <button
                      key={hex}
                      onClick={async () => { await onRecolorCategory(c.id, hex); setColoringId(null); }}
                      className={`h-5 w-5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 ${
                        c.color.toLowerCase() === hex.toLowerCase() ? "ring-2 ring-offset-1 ring-blue-500" : ""
                      }`}
                      style={{ background: hex }}
                      aria-label={hex}
                    />
                  ))}
                </div>
              )}
              </div>
            );
          })}

          {adding ? (
            <div className="flex items-center gap-1 px-1 py-0.5 mt-1">
              <input
                autoFocus value={newName} disabled={busy}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAdd();
                  if (e.key === "Escape") { setAdding(false); setNewName(""); }
                }}
                placeholder={t("dashboard", "brainNewCategoryPrompt")}
                className={`flex-1 min-w-0 text-sm rounded px-1.5 py-1 border outline-none ${
                  isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
                }`}
              />
              <button onClick={commitAdd} disabled={busy}
                className="p-1 text-green-500 hover:text-green-600" title={t("dashboard", "brainSaveChanges")}>
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setAdding(false); setNewName(""); }} className={`p-1 ${sub}`} title={t("dashboard", "invCancel")}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg text-sm ${sub} ${hover}`}>
              <Plus className="h-3.5 w-3.5" />
              {t("dashboard", "brainAddDepartment")}
            </button>
          )}

          <div className={`flex items-center gap-2 px-2 py-1.5 mt-1 border-t pt-2 ${border}`}>
            <Inbox className={`h-3.5 w-3.5 flex-shrink-0 ${sub}`} />
            <span className={`flex-1 truncate text-sm ${text}`}>{t("dashboard", "brainUnassigned")}</span>
            <span className={`text-xs tabular-nums ${sub}`}>{graph.unassignedCount}</span>
          </div>
        </div>
      </div>

      {view === "tree" && (
        <p className={`text-[10px] border-t pt-4 ${border} ${sub}`}>
          {t("dashboard", "brainTreeHint")}
        </p>
      )}
    </div>
  );
}
