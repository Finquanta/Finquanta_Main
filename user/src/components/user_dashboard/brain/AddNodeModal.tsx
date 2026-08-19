"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, CheckSquare, Link2, X, Search, Trash2, Building2, Archive, ArchiveRestore, Database,
  Lightbulb,
} from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  BrainCategory, BrainNode, BrainNodeDetail, NodeType, flattenCategories,
  createBrainNode, updateBrainNode, deleteBrainNode, searchBrain, connectBrainNodes,
  archiveBrainNode, unarchiveBrainNode,
  EntityCandidate, attachEntityToBrain, readEntityRef, searchBrainEntities,
} from "@/lib/api/brain";
import { ENTITY_ICON } from "./EntityRefCard";

/** What the connection picker can point at: another note, or a department. */
type ConnectTarget =
  | { kind: "node"; id: string; title: string }
  | { kind: "category"; id: string; title: string };

/**
 * The universal creation entry point (spec §4.1).
 *
 * Two columns: what the node *is* on the left, where it *connects* on the
 * right. That right-hand column is what makes this different from a plain
 * note form — a node is created already wired into the Brain, or deliberately
 * left floating.
 *
 * One component serves create and edit, matching the house convention: `editing`
 * null means create. Double-clicking a node elsewhere opens this pre-filled.
 */

const TYPE_ICON: Record<NodeType, typeof FileText> = {
  note: FileText, task: CheckSquare, link: Link2, pin: Link2, entity_ref: Database,
  // Present to satisfy the Record. `insight` is never offered as a choice in
  // this modal — the platform writes those, a person cannot.
  insight: Lightbulb,
};

export default function AddNodeModal({
  isOpen, isDark, categories, editing, defaultCategoryId, defaultConnectTo,
  summaryThreshold = null, onClose, onSaved,
}: {
  isOpen: boolean;
  isDark: boolean;
  categories: BrainCategory[];
  /** Chars needed before a note gets auto-summarized, or null when summaries
   *  are off for this workspace (then no countdown is shown at all). */
  summaryThreshold?: number | null;
  /** null = create a new node. */
  editing: BrainNodeDetail | null;
  /** Pre-select a category (the one currently open). */
  defaultCategoryId?: string | null;
  /** Pre-select a connection target — used by "+" on an existing node. */
  defaultConnectTo?: BrainNode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();

  const [type, setType] = useState<NodeType>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [taskStatus, setTaskStatus] = useState("open");
  const [dueDate, setDueDate] = useState("");

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unassigned, setUnassigned] = useState(false);

  const [connectQuery, setConnectQuery] = useState("");
  const [connectResults, setConnectResults] = useState<ConnectTarget[]>([]);
  /** A node can be wired to as many notes and departments as you like. */
  const [connections, setConnections] = useState<ConnectTarget[]>([]);
  const [searching, setSearching] = useState(false);

  /** The ledger record this node points at, when it's a reference. */
  const [entity, setEntity] = useState<EntityCandidate | null>(null);
  const [entityQuery, setEntityQuery] = useState("");
  const [entityResults, setEntityResults] = useState<EntityCandidate[]>([]);
  const [entitySearching, setEntitySearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);
  const entitySeq = useRef(0);

  // Reset the form every time the modal opens, so a create never inherits the
  // last edit's content and vice versa.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setContent(editing.content ?? "");
      setUrl(String(editing.payload?.url ?? ""));
      setTaskStatus(String(editing.payload?.status ?? "open"));
      setDueDate(String(editing.payload?.dueDate ?? ""));
      setCategoryId(editing.categoryId);
      setUnassigned(editing.categoryId === null);
    } else {
      setType("note");
      setTitle("");
      setContent("");
      setUrl("");
      setTaskStatus("open");
      setDueDate("");
      setCategoryId(defaultCategoryId ?? null);
      setUnassigned(defaultCategoryId === null || defaultCategoryId === undefined);
    }
    // An existing reference reopens with its target already chosen, so the
    // picker shows what it points at rather than an empty search box.
    const ref = editing ? readEntityRef(editing) : null;
    setEntity(
      ref ? { ...ref, title: editing!.title, subtitle: null, status: null, date: null, amount: null } : null
    );
    setEntityQuery("");
    setEntityResults([]);

    setConnections(
      defaultConnectTo ? [{ kind: "node", id: defaultConnectTo.id, title: defaultConnectTo.title }] : []
    );
    setConnectQuery("");
    setConnectResults([]);
  }, [isOpen, editing, defaultCategoryId, defaultConnectTo]);

  // Debounced record search. Same sequence-guard as the connection picker, so
  // a slow response can't overwrite the results of a newer keystroke.
  useEffect(() => {
    const q = entityQuery.trim();
    if (q.length < 2) { setEntityResults([]); return; }

    const seq = ++entitySeq.current;
    setEntitySearching(true);
    const timer = setTimeout(() => {
      searchBrainEntities(q, "all", 8)
        .then((rows) => { if (seq === entitySeq.current) setEntityResults(rows); })
        .catch(() => { if (seq === entitySeq.current) setEntityResults([]); })
        .finally(() => { if (seq === entitySeq.current) setEntitySearching(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [entityQuery]);

  // Debounced connection search across both notes and departments. Departments
  // are matched locally against the tree we already hold, so only the note half
  // costs a request. The sequence guard drops responses that come back after a
  // newer keystroke has already been issued.
  useEffect(() => {
    const q = connectQuery.trim();
    if (q.length < 2) { setConnectResults([]); return; }

    const needle = q.toLowerCase();
    const deptMatches: ConnectTarget[] = flattenCategories(categories)
      .filter((c) => c.name.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((c) => ({ kind: "category", id: c.id, title: c.name }));

    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchBrain(q, 8)
        .then((rows) => {
          if (seq !== searchSeq.current) return;
          const noteMatches: ConnectTarget[] = rows
            .filter((r) => r.id !== editing?.id)
            .map((r) => ({ kind: "node", id: r.id, title: r.title }));
          setConnectResults([...deptMatches, ...noteMatches]);
        })
        .catch(() => { if (seq === searchSeq.current) setConnectResults(deptMatches); })
        .finally(() => { if (seq === searchSeq.current) setSearching(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [connectQuery, editing?.id, categories]);

  const flat = useMemo(() => flattenCategories(categories), [categories]);
  const topLevel = useMemo(() => categories.filter((c) => !c.parentCategoryId), [categories]);

  const payload = () => {
    if (type === "link") return { url: url.trim() };
    if (type === "task") return { status: taskStatus, dueDate: dueDate || null };
    // Only the pointer is stored. No name, no amount, no status — those are
    // read live every time the node is opened, so they cannot go stale.
    if (type === "entity_ref" && entity) {
      return { entityType: entity.entityType, entityId: entity.entityId };
    }
    return {};
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError(t("dashboard", "brainErrTitleRequired")); return; }
    if (type === "link" && !url.trim()) { setError(t("dashboard", "brainErrUrlRequired")); return; }
    if (type === "entity_ref" && !entity) { setError(t("dashboard", "brainErrRecordRequired")); return; }

    setSaving(true);
    setError(null);
    try {
      const resolvedCategory = unassigned ? null : categoryId;

      // Creating a reference goes through attach, which refuses records from
      // another workspace and returns the existing node if this record is
      // already in the Brain rather than adding a second dot for it.
      if (!editing && type === "entity_ref" && entity) {
        await attachEntityToBrain({
          entityType: entity.entityType,
          entityId: entity.entityId,
          title: title.trim(),
          content,
          categoryId: resolvedCategory,
          connections: connections.map((c) =>
            c.kind === "node" ? { nodeId: c.id } : { categoryId: c.id }
          ),
        });
        onSaved();
        onClose();
        return;
      }

      if (editing) {
        await updateBrainNode(editing.id, {
          title: title.trim(), content, type, categoryId: resolvedCategory, payload: payload(),
        });
        // On edit these are additions, not a replacement — existing links stay
        // put and are removed from the node's own panel instead. Sequential
        // rather than parallel so a failure can't leave a half-applied set.
        for (const c of connections) {
          await connectBrainNodes(
            editing.id,
            c.kind === "node" ? { toNodeId: c.id } : { toCategoryId: c.id }
          );
        }
      } else {
        await createBrainNode({
          title: title.trim(), content, type, categoryId: resolvedCategory,
          payload: payload(),
          connections: connections.map((c) =>
            c.kind === "node" ? { nodeId: c.id } : { categoryId: c.id }
          ),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard", "brainErrSaveNode"));
    } finally {
      setSaving(false);
    }
  };

  /** Archiving from the modal saves nothing else — it's a status change on the
   *  stored node, not on the half-typed form around it. */
  const toggleArchive = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.status === "archived") await unarchiveBrainNode(editing.id);
      else await archiveBrainNode(editing.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard", "brainErrArchiveNode"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    if (!window.confirm(t("dashboard", "brainConfirmDeleteNode"))) return;
    setSaving(true);
    try {
      await deleteBrainNode(editing.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard", "brainErrDeleteNode"));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`;
  const border = isDark ? "border-gray-700" : "border-gray-200";

  const TYPES: { key: NodeType; label: string }[] = [
    { key: "note", label: t("dashboard", "brainTypeNote") },
    { key: "task", label: t("dashboard", "brainTypeTask") },
    { key: "link", label: t("dashboard", "brainTypeLink") },
    { key: "entity_ref", label: t("dashboard", "brainTypeRecord") },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${border}`}>
          <h2 className="text-lg font-bold">
            {editing ? t("dashboard", "brainEditNode") : t("dashboard", "brainAddNode")}
          </h2>
          <button onClick={onClose} className={sub} aria-label={t("dashboard", "invCancel")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={save}>
          <div className="grid md:grid-cols-[1fr_280px]">
            {/* Left — what the node is */}
            <div className="p-6 space-y-3">
              <div className="flex gap-2">
                {TYPES.map((tp) => {
                  const Icon = TYPE_ICON[tp.key];
                  const active = type === tp.key;
                  return (
                    <button
                      key={tp.key} type="button" onClick={() => setType(tp.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        active ? "bg-blue-500 border-blue-500 text-white font-semibold" : `${border} ${sub}`
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />{tp.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainNodeTitle")}</label>
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
              </div>

              {type === "link" && (
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainNodeUrl")}</label>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={field} />
                </div>
              )}

              {/* Record picker. Choosing one stores only its id — the name,
                  amount and status shown on the node are read live afterwards. */}
              {type === "entity_ref" && (
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainRecordLabel")}</label>
                  {entity ? (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${border}`}>
                      {(() => {
                        const Icon = ENTITY_ICON[entity.entityType];
                        return <Icon className={`h-4 w-4 flex-shrink-0 ${sub}`} />;
                      })()}
                      <span className="flex-1 min-w-0 truncate">{entity.title}</span>
                      <span className={`text-[10px] uppercase tracking-wide flex-shrink-0 ${sub}`}>
                        {t("dashboard", `brainEntity_${entity.entityType}`)}
                      </span>
                      <button type="button" onClick={() => { setEntity(null); setEntityQuery(""); }}
                        className={sub} aria-label={t("dashboard", "invCancel")}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${sub}`} />
                        <input
                          value={entityQuery} onChange={(e) => setEntityQuery(e.target.value)}
                          placeholder={t("dashboard", "brainRecordSearch")}
                          className={`${field} pl-8`}
                        />
                      </div>
                      {entitySearching && <p className={`text-xs mt-1 ${sub}`}>{t("dashboard", "brainSearching")}</p>}
                      {entityResults.length > 0 && (
                        <div className={`mt-1 rounded-lg border overflow-hidden max-h-[200px] overflow-y-auto ${border}`}>
                          {entityResults.map((r) => {
                            const Icon = ENTITY_ICON[r.entityType];
                            return (
                              <button
                                key={`${r.entityType}:${r.entityId}`} type="button"
                                onClick={() => {
                                  setEntity(r);
                                  // The title is a label for the graph and search.
                                  // Prefill it, but the user can rename it freely —
                                  // it never affects the record it points at.
                                  if (!title.trim()) setTitle(r.title);
                                  setEntityQuery("");
                                  setEntityResults([]);
                                }}
                                className={`w-full flex items-center gap-2 text-left px-2 py-1.5 text-sm ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                              >
                                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${sub}`} />
                                <span className="flex-1 min-w-0 truncate">
                                  {r.title}
                                  {r.subtitle && <span className={sub}> · {r.subtitle}</span>}
                                </span>
                                <span className={`text-[10px] uppercase tracking-wide flex-shrink-0 ${sub}`}>
                                  {t("dashboard", `brainEntity_${r.entityType}`)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  <p className={`text-[11px] mt-1.5 ${sub}`}>{t("dashboard", "brainRecordHint")}</p>
                </div>
              )}

              {type === "task" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainTaskStatus")}</label>
                    <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} className={field}>
                      <option value="open">{t("dashboard", "brainTaskOpen")}</option>
                      <option value="in_progress">{t("dashboard", "brainTaskInProgress")}</option>
                      <option value="done">{t("dashboard", "brainTaskDone")}</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainTaskDue")}</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainNodeBody")}</label>
                <textarea
                  value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder={t("dashboard", "brainNodeBodyHint")}
                  className={`${field} min-h-[180px] font-mono text-[13px] leading-relaxed`}
                />
                <p className={`text-[11px] mt-1 ${sub}`}>{t("dashboard", "brainWikiLinkHint")}</p>

                {/* Live countdown to the summarization threshold. Only shown
                    when summaries are actually enabled — otherwise it promises
                    something that won't happen. The threshold comes from the
                    server so it can't drift from the value that's enforced. */}
                {/* Guarded on the type, not on `!== null`: Vercel and Render
                    deploy independently, so a frontend running ahead of the
                    backend gets `undefined` here and would render "NaN
                    characters until…". No threshold means no hint. */}
                {typeof summaryThreshold === "number" && type !== "link" && (
                  <p className={`text-[11px] mt-1 ${
                    content.trim().length >= summaryThreshold ? "text-amber-500" : sub
                  }`}>
                    {content.trim().length >= summaryThreshold
                      ? t("dashboard", "brainWillSummarize")
                      : `${summaryThreshold - content.trim().length} ${t("dashboard", "brainCharsUntilSummary")}`}
                  </p>
                )}
              </div>
            </div>

            {/* Right — where it connects */}
            <div className={`p-6 space-y-4 border-t md:border-t-0 md:border-l ${border}`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${sub}`}>
                  {t("dashboard", "brainDepartment")}
                </p>
                <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
                  {topLevel.map((cat) => (
                    <button
                      key={cat.id} type="button"
                      onClick={() => { setCategoryId(cat.id); setUnassigned(false); }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left ${
                        !unassigned && categoryId === cat.id
                          ? (isDark ? "bg-gray-700 font-semibold" : "bg-orange-50 font-semibold text-orange-700")
                          : `${text} ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>

                {/* Subcategory refinement, only once a department is chosen. */}
                {!unassigned && categoryId && (() => {
                  const parent = topLevel.find(
                    (c) => c.id === categoryId || c.children.some((ch) => ch.id === categoryId)
                  );
                  if (!parent || parent.children.length === 0) return null;
                  return (
                    <select
                      value={flat.find((c) => c.id === categoryId)?.parentCategoryId ? categoryId : ""}
                      onChange={(e) => setCategoryId(e.target.value || parent.id)}
                      className={`${field} mt-2`}
                    >
                      <option value="">{t("dashboard", "brainNoSubcategory")}</option>
                      {parent.children.map((ch) => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <label className={`flex items-center gap-2 text-sm cursor-pointer ${text}`}>
                <input
                  type="checkbox" checked={unassigned}
                  onChange={(e) => { setUnassigned(e.target.checked); if (e.target.checked) setCategoryId(null); }}
                  className="h-4 w-4 rounded"
                />
                {t("dashboard", "brainLeaveUnassigned")}
              </label>

              {/* Available when editing too: on create this wires the new node
                  up, on edit it adds another connection. Targets can be a note
                  or a department — a Finance note can point at Marketing
                  without leaving Finance. */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${sub}`}>
                  {t("dashboard", editing ? "brainAddConnection" : "brainConnectTo")}
                </p>

                {/* Chosen connections stay listed while the search stays open,
                    so several can be added in one pass. */}
                {connections.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2">
                    {connections.map((c) => (
                      <div key={`${c.kind}:${c.id}`}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm ${border}`}>
                        {c.kind === "category"
                          ? <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                          : <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${sub}`} />}
                        <span className="flex-1 truncate">{c.title}</span>
                        <button
                          type="button"
                          onClick={() => setConnections((prev) => prev.filter((p) => !(p.kind === c.kind && p.id === c.id)))}
                          className={sub} aria-label={t("dashboard", "invCancel")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${sub}`} />
                  <input
                    value={connectQuery} onChange={(e) => setConnectQuery(e.target.value)}
                    placeholder={t("dashboard", "brainConnectSearch")}
                    className={`${field} pl-8`}
                  />
                </div>
                {searching && <p className={`text-xs mt-1 ${sub}`}>{t("dashboard", "brainSearching")}</p>}
                {connectResults.length > 0 && (
                  <div className={`mt-1 rounded-lg border overflow-hidden ${border}`}>
                    {connectResults
                      // Anything already chosen drops out of the results.
                      .filter((r) => !connections.some((c) => c.kind === r.kind && c.id === r.id))
                      .map((r) => (
                        <button
                          key={`${r.kind}:${r.id}`} type="button"
                          onClick={() => { setConnections((prev) => [...prev, r]); setConnectQuery(""); }}
                          className={`w-full flex items-center gap-2 text-left px-2 py-1.5 text-sm ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                        >
                          {r.kind === "category"
                            ? <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                            : <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${sub}`} />}
                          <span className="flex-1 truncate">{r.title}</span>
                          {r.kind === "category" && (
                            <span className={`text-[10px] uppercase ${sub}`}>{t("dashboard", "brainGraphCategory")}</span>
                          )}
                        </button>
                      ))}
                  </div>
                )}
                <p className={`text-[11px] mt-1.5 ${sub}`}>
                  {t("dashboard", editing ? "brainAddConnectionHint" : "brainConnectHint")}
                </p>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm px-6">{error}</p>}

          <div className={`flex items-center gap-2 px-6 py-4 border-t ${border}`}>
            {editing && (
              <div className="flex items-center gap-4 mr-auto">
                <button type="button" onClick={remove} disabled={saving}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />{t("dashboard", "brainDelete")}
                </button>
                {/* The reversible option sits next to the permanent one, so the
                    choice between them is visible at the moment it's made. */}
                <button type="button" onClick={toggleArchive} disabled={saving}
                  className={`flex items-center gap-1.5 text-sm ${sub} hover:text-amber-500`}>
                  {editing.status === "archived"
                    ? <><ArchiveRestore className="h-4 w-4" />{t("dashboard", "brainUnarchive")}</>
                    : <><Archive className="h-4 w-4" />{t("dashboard", "brainArchive")}</>}
                </button>
              </div>
            )}
            <button type="button" onClick={onClose}
              className={`${editing ? "" : "ml-auto"} px-4 py-2 rounded-lg text-sm font-semibold border ${border}`}>
              {t("dashboard", "invCancel")}
            </button>
            <button type="submit" disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg text-sm">
              {saving ? t("dashboard", "brainSaving") : editing ? t("dashboard", "brainSaveChanges") : t("dashboard", "brainCreate")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
