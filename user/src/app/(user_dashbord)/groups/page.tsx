"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus, Trash2, Archive, TrendingUp, TrendingDown, Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import DashboardShell from "@/components/user_dashboard/DashboardShell";
import {
  GROUP_COLORS, Group, GroupItem, GroupReportRow,
  archiveGroup, assignToGroup, createGroup, deleteGroup, getGroupItems, getGroupReport, getGroups, updateGroup,
} from "@/lib/api/groups";

/**
 * Business Groups (cost & profit centers). Manage groups and see, per group,
 * whether that area of the business made or lost money. Groups are reporting
 * metadata only — they never change the books.
 */
export default function GroupsPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [groups, setGroups] = useState<Group[]>([]);
  const [report, setReport] = useState<GroupReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-group form
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Rename + drill-in
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  // Edited alongside the name: a group's colour was only choosable at
  // creation, so changing it meant deleting the group and rebuilding it.
  const [editColor, setEditColor] = useState<string>(GROUP_COLORS[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<GroupItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getGroups(), getGroupReport()])
      .then(([g, r]) => { setGroups(g); setReport(r); })
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard","errLoadGroups")))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    try {
      await createGroup({ name: name.trim(), color });
      setName("");
      setColor(GROUP_COLORS[0]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard","errCreateGroup"));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (g: GroupReportRow) => {
    if (!g.groupId) return;
    if (!window.confirm(`Archive "${g.name}"? It stops showing here but its entries stay grouped — you can't currently un-archive from the UI.`)) return;
    try { await archiveGroup(g.groupId); if (expandedId === g.groupId) setExpandedId(null); load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("dashboard","errArchiveGroup")); }
  };

  const remove = async (g: GroupReportRow) => {
    if (!g.groupId) return;
    if (!window.confirm(`Delete "${g.name}"? Its ${g.entries} ${g.entries === 1 ? "entry" : "entries"} stay on your books and move back to Unassigned. This can't be undone.`)) return;
    try { await deleteGroup(g.groupId); if (expandedId === g.groupId) setExpandedId(null); load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("dashboard","errDeleteGroup")); }
  };

  const startRename = (g: GroupReportRow) => {
    setEditingId(g.groupId);
    setEditName(g.name);
    setEditColor(g.color ?? GROUP_COLORS[0]);
  };
  const saveRename = async () => {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    try { await updateGroup(editingId, { name: editName.trim(), color: editColor }); setEditingId(null); load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("dashboard","errRenameGroup")); }
  };

  const toggleExpand = async (groupId: string | null) => {
    const key = groupId ?? "unassigned";
    if (expandedId === key) { setExpandedId(null); return; }
    setExpandedId(key);
    setItemsLoading(true); setItems([]);
    try { setItems(await getGroupItems(key)); }
    catch { setItems([]); }
    finally { setItemsLoading(false); }
  };

  /** Move an entry/invoice to another group (or out), then refresh. */
  const moveItem = async (item: GroupItem, newGroupId: string) => {
    try {
      await assignToGroup(item.kind, item.id, newGroupId || null);
      // Refresh the open bucket and the headline totals.
      if (expandedId) setItems(await getGroupItems(expandedId));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move that item.");
    }
  };

  const card = `rounded-2xl border ${isDark ? "bg-[#1e1e2e] border-gray-700" : "bg-white border-gray-200"}`;
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const field = `rounded-lg px-3 py-2 text-sm border outline-none ${isDark ? "bg-gray-800 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-300 text-gray-800"}`;

  const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Real groups sit above the Unassigned bucket regardless of net.
  const rows = useMemo(() => {
    const real = report.filter((r) => r.groupId);
    const unassigned = report.find((r) => !r.groupId);
    return unassigned ? [...real, unassigned] : real;
  }, [report]);

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 max-w-4xl">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="h-5 w-5 text-blue-500" />
          <h1 className={`text-xl font-bold ${text}`}>{t("dashboard","grpTitle")}</h1>
        </div>
        <p className={`text-sm mb-6 ${sub}`}>{t("dashboard","grpDesc")}</p>

        {/* Create — name + a color. */}
        <div className={`${card} p-4 mb-6`}>
          <label className={`text-xs font-semibold ${sub}`}>{t("dashboard","grpNew")}</label>
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            <input
              className={`${field} flex-1 min-w-[160px]`}
              placeholder={t("dashboard","grpPlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            />
            <div className="flex items-center gap-1">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform"
                  style={{ backgroundColor: c, borderColor: color === c ? (isDark ? "#fff" : "#000") : "transparent", transform: color === c ? "scale(1.1)" : "none" }}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
            <button
              onClick={add}
              disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {/* Overview */}
        {loading ? (
          <p className={`text-sm ${sub}`}>{t("dashboard","loading")}</p>
        ) : rows.length === 0 ? (
          <div className={`${card} p-8 text-center`}>
            <p className={`text-sm ${sub}`}>{t("dashboard","grpEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const key = r.groupId ?? "unassigned";
              const open = expandedId === key;
              const renaming = editingId && editingId === r.groupId;
              return (
              <div key={key} className={`${card} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.color ?? (isDark ? "#4b5563" : "#d1d5db") }} />
                    {renaming ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input autoFocus className={`${field} py-1 flex-1`} value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditingId(null); }} />
                        {/* Same palette the create form offers, so a group's
                            colour can be changed without rebuilding it. */}
                        <div className="flex items-center gap-1 shrink-0">
                          {GROUP_COLORS.map((sw) => (
                            <button
                              key={sw}
                              type="button"
                              onClick={() => setEditColor(sw)}
                              className="h-4 w-4 rounded-full border-2 transition-transform"
                              style={{
                                backgroundColor: sw,
                                borderColor: editColor === sw ? (isDark ? "#fff" : "#000") : "transparent",
                                transform: editColor === sw ? "scale(1.15)" : "none",
                              }}
                              aria-label={`color ${sw}`}
                            />
                          ))}
                        </div>
                        <button onClick={saveRename} className="p-1 text-emerald-500" title={t("dashboard","grpSave")}><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditingId(null)} className={`p-1 ${sub}`} title="Cancel"><X className="h-4 w-4" /></button>
                      </div>
                    ) : r.groupId ? (
                      <>
                        {/* Click the name (or the pencil) to rename. */}
                        <button onClick={() => startRename(r)} className={`font-semibold truncate ${text} hover:text-blue-500 text-left`} title={t("dashboard","grpRenameHint")}>
                          {r.name}
                        </button>
                        <span className={`text-xs ${sub} shrink-0`}>· {r.entries} {r.entries === 1 ? "entry" : "entries"}</span>
                        <button onClick={() => startRename(r)} className={`p-0.5 ${sub} hover:text-blue-500 shrink-0`} title={t("dashboard","grpRename")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Unassigned isn't a real group — it can't be renamed or deleted. */}
                        <span className={`font-semibold truncate ${sub} italic`}>{r.name}</span>
                        <span className={`text-xs ${sub} shrink-0`}>· {r.entries} {r.entries === 1 ? "entry" : "entries"} with no group</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-bold" style={{ color: r.net > 0 ? "#10b981" : r.net < 0 ? "#ef4444" : (isDark ? "#9ca3af" : "#6b7280") }}>
                      {money(r.net)}
                    </span>
                    {r.groupId && (
                      <button onClick={() => archive(r)} className={`p-1 rounded ${sub} hover:text-amber-500`} title={t("dashboard","grpArchive")}>
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    {r.groupId && (
                      <button onClick={() => remove(r)} className={`p-1 rounded ${sub} hover:text-red-500`} title={t("dashboard","grpDelete")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => toggleExpand(r.groupId)} className={`p-1 ${sub}`} title={t("dashboard","grpSeeInside")}>
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-500">
                    <TrendingUp className="h-3.5 w-3.5" /> In {money(r.inflow)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <TrendingDown className="h-3.5 w-3.5" /> Out {money(r.outflow)}
                  </span>
                </div>

                {/* What's inside — with a per-item "move to group" control. */}
                {open && (
                  <div className={`mt-3 pt-3 border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                    {itemsLoading ? (
                      <p className={`text-xs ${sub}`}>{t("dashboard","loading")}</p>
                    ) : items.length === 0 ? (
                      <p className={`text-xs ${sub}`}>{t("dashboard","grpNothingInside")}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((it) => (
                          <div key={`${it.kind}-${it.id}`} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className={`text-xs ${text} truncate`}>{it.description}</span>
                              <span className={`text-[11px] ml-2 ${sub}`}>{it.date}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-semibold" style={{ color: it.signedAmount < 0 ? "#ef4444" : "#10b981" }}>
                                {it.signedAmount < 0 ? "-" : "+"}${Math.abs(it.signedAmount).toFixed(2)}
                              </span>
                              <select
                                className={`${field} py-1 text-xs`}
                                value={it.groupId ?? ""}
                                onChange={(e) => moveItem(it, e.target.value)}
                                title={t("dashboard","grpMoveTo")}
                              >
                                <option value="">{t("dashboard","grpUnassignedRow")}</option>
                                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
