"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Inbox, Plus, Search, Trash2, Check, X, Archive } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { BrainCategory } from "@/lib/api/brain";

/**
 * The category tree — the default way to browse the Brain day to day.
 *
 * Departments in org-chart order with their live node counts, subcategories
 * folded away until opened, and an Unassigned section pinned at the bottom so
 * floating notes are always visible rather than quietly piling up.
 */
export default function CategorySidebar({
  isDark, categories, unassignedCount, archivedCount, archived, onSelectArchived,
  selectedId, onSelect, onAddCategory, query, onQueryChange,
  onAddSubcategory, onRemoveCategory,
}: {
  isDark: boolean;
  categories: BrainCategory[];
  unassignedCount: number;
  /** Nodes in the Archive. The row stays visible at zero so it's discoverable. */
  archivedCount: number;
  archived: boolean;
  onSelectArchived: () => void;
  /** null = Unassigned, undefined = everything. */
  selectedId: string | null | undefined;
  onSelect: (id: string | null | undefined) => void;
  onAddCategory: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  /** Create a subcategory under a department. */
  onAddSubcategory: (parentId: string, name: string) => Promise<void> | void;
  /** Archive a category or subcategory; its notes move to Unassigned. */
  onRemoveCategory: (id: string, name: string) => Promise<void> | void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Which department is currently showing its "new subcategory" input.
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [newSub, setNewSub] = useState("");
  const [busy, setBusy] = useState(false);

  const commitSub = async (parentId: string) => {
    const name = newSub.trim();
    if (!name) { setAddingUnder(null); return; }
    setBusy(true);
    try { await onAddSubcategory(parentId, name); } finally {
      setBusy(false); setAddingUnder(null); setNewSub("");
    }
  };

  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const hover = isDark ? "hover:bg-gray-700" : "hover:bg-gray-100";
  const activeRow = isDark ? "bg-gray-700" : "bg-orange-50";

  // Opening the Archive takes the highlight off every category row — you are
  // looking at the Archive, not at Finance-with-the-Archive-open.
  const rowClass = (active: boolean) =>
    `w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
      active && !archived
        ? `${activeRow} font-semibold ${isDark ? "text-orange-400" : "text-orange-600"}`
        : `${text} ${hover}`
    }`;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative mb-2">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${sub}`} />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("dashboard", "brainSearchPlaceholder")}
          className={`w-full text-sm rounded-lg pl-8 pr-3 py-2 border outline-none ${input}`}
        />
      </div>

      <button onClick={() => onSelect(undefined)} className={rowClass(selectedId === undefined)}>
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: isDark ? "#6b7280" : "#9ca3af" }} />
        <span className="flex-1 truncate">{t("dashboard", "brainAllNotes")}</span>
      </button>

      {categories.map((cat) => {
        const open = expanded[cat.id] ?? false;
        return (
          <div key={cat.id}>
            <div className="flex items-center">
              {/* Always expandable, even with no subcategories yet — the "add
                  subcategory" control lives inside, so hiding the chevron on an
                  empty department would make it unreachable. */}
              <button
                onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !open }))}
                className={`p-0.5 rounded ${sub} ${hover}`}
                aria-label={open ? t("dashboard", "brainCollapse") : t("dashboard", "brainExpand")}
              >
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <div className="flex-1 min-w-0 flex items-center gap-0.5 group/dept">
                <button onClick={() => onSelect(cat.id)} className={rowClass(selectedId === cat.id)} title={cat.role ?? undefined}>
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <span className="flex-1 truncate">{cat.name}</span>
                  <span className={`text-xs tabular-nums ${sub}`}>{cat.totalCount}</span>
                </button>
                {/* Departments are removable too, not just subcategories. This
                    archives — the notes inside move to Unassigned. */}
                <button
                  onClick={() => onRemoveCategory(cat.id, cat.name)}
                  className={`p-1 rounded ${sub} hover:text-red-500 opacity-0 group-hover/dept:opacity-100 focus:opacity-100`}
                  title={t("dashboard", "brainRemoveCategory")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {open && (
              <div className="ml-[26px] mt-0.5 flex flex-col gap-0.5">
                {cat.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-0.5 group/sub">
                    <button onClick={() => onSelect(child.id)} className={rowClass(selectedId === child.id)}>
                      <span className="flex-1 truncate">{child.name}</span>
                      <span className={`text-xs tabular-nums ${sub}`}>{child.nodeCount}</span>
                    </button>
                    <button
                      onClick={() => onRemoveCategory(child.id, child.name)}
                      className={`p-1 rounded ${sub} hover:text-red-500 opacity-0 group-hover/sub:opacity-100 focus:opacity-100`}
                      title={t("dashboard", "brainRemoveCategory")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {addingUnder === cat.id ? (
                  <div className="flex items-center gap-1 py-0.5">
                    <input
                      autoFocus value={newSub} disabled={busy}
                      onChange={(e) => setNewSub(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitSub(cat.id);
                        if (e.key === "Escape") { setAddingUnder(null); setNewSub(""); }
                      }}
                      placeholder={t("dashboard", "brainNewSubcategory")}
                      className={`flex-1 min-w-0 text-sm rounded px-1.5 py-1 border outline-none ${input}`}
                    />
                    <button onClick={() => commitSub(cat.id)} disabled={busy}
                      className="p-1 text-green-500 hover:text-green-600" title={t("dashboard", "brainSaveChanges")}>
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { setAddingUnder(null); setNewSub(""); }} className={`p-1 ${sub}`}
                      title={t("dashboard", "invCancel")}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingUnder(cat.id); setNewSub(""); }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${sub} ${hover}`}
                  >
                    <Plus className="h-3 w-3" />
                    {t("dashboard", "brainNewSubcategory")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned sits below every department, always visible — the spec is
          explicit that floating notes must never silently accumulate unseen. */}
      <div className={`mt-2 pt-2 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
        <button onClick={() => onSelect(null)} className={rowClass(selectedId === null)}>
          <Inbox className={`h-3.5 w-3.5 flex-shrink-0 ${selectedId === null && !archived ? "" : sub}`} />
          <span className="flex-1 truncate">{t("dashboard", "brainUnassigned")}</span>
          <span className={`text-xs tabular-nums ${sub}`}>{unassignedCount}</span>
        </button>

        {/* The Archive. Nothing here counts toward any department's total —
            archived notes are out of every view until they're brought back. */}
        <button
          onClick={onSelectArchived}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
            archived
              ? `${activeRow} font-semibold ${isDark ? "text-orange-400" : "text-orange-600"}`
              : `${text} ${hover}`
          }`}
        >
          <Archive className={`h-3.5 w-3.5 flex-shrink-0 ${archived ? "" : sub}`} />
          <span className="flex-1 truncate">{t("dashboard", "brainArchived")}</span>
          <span className={`text-xs tabular-nums ${sub}`}>{archivedCount}</span>
        </button>

        <button onClick={onAddCategory} className={`w-full flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg text-sm ${sub} ${hover}`}>
          <Plus className="h-3.5 w-3.5" />
          {t("dashboard", "brainNewCategory")}
        </button>
      </div>
    </div>
  );
}
