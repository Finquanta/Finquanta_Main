"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, FileText, CheckSquare, Link2, Pencil, Trash2, Menu, Share2, List,
  ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen,
  Network, Archive, ArchiveRestore, Database, Settings, Eye,
} from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import DashboardShell from "@/components/user_dashboard/DashboardShell";
import CompanyOverviewCard from "@/components/user_dashboard/brain/CompanyOverviewCard";
import CategorySidebar from "@/components/user_dashboard/brain/CategorySidebar";
import AddNodeModal from "@/components/user_dashboard/brain/AddNodeModal";
import NodeDetailPanel from "@/components/user_dashboard/brain/NodeDetailPanel";
import PinCard from "@/components/user_dashboard/brain/PinCard";
import BrainGraph, { GraphFilters, GraphMode, GraphSettings } from "@/components/user_dashboard/brain/BrainGraph";
import BrainTree from "@/components/user_dashboard/brain/BrainTree";
import GraphPanel from "@/components/user_dashboard/brain/GraphPanel";
import GraphFilterMenu from "@/components/user_dashboard/brain/GraphFilterMenu";
import BrainSettingsModal from "@/components/user_dashboard/brain/BrainSettingsModal";
import {
  BrainCategory, BrainGraph as GraphData, BrainNode, BrainNodeDetail, BrainOverview, BrainPin,
  NodeType, PIN_KEYS, PinKey,
  getBrainOverview, listBrainNodes, getBrainNode, getBrainPins, getBrainGraph, searchBrain,
  createBrainCategory, updateBrainCategory, removeBrainCategory, flattenCategories,
  archiveBrainNode, unarchiveBrainNode, deleteBrainNode,
  ResolvedEntity, readEntityRef, resolveBrainEntities,
  BrainSettings, getBrainSettings, GuidedCategory,
} from "@/lib/api/brain";
import AdvisorPanel from "@/components/user_dashboard/brain/AdvisorPanel";

const TYPE_ICON: Record<NodeType, typeof FileText> = {
  note: FileText, task: CheckSquare, link: Link2, pin: Link2, entity_ref: Database,
};

/**
 * Company Brain — the business's own knowledge base.
 *
 * Half of it is what the user wrote (notes, tasks, links, and the connections
 * between them); the other half is truth the platform already knows, pinned in
 * as live figures. That combination is the whole point of the tab.
 *
 * Three views over the same data: Categories (the folder-style day-to-day
 * view), Graph (the force-directed field, 2D or 3D), and Tree (the org chart,
 * CEO at the root). Archived nodes are absent from all three until you open the
 * Archive, which is the point of archiving rather than deleting.
 */
export default function CompanyBrainPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [overview, setOverview] = useState<BrainOverview | null>(null);
  const [nodes, setNodes] = useState<BrainNode[]>([]);
  const [pins, setPins] = useState<BrainPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** undefined = all notes, null = Unassigned, string = a category id. */
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  /** Orthogonal to selectedId: the Archive is its own place, not a category. */
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  /** Live state of every referenced record on screen, keyed `type:id`. */
  const [entityStates, setEntityStates] = useState<Record<string, ResolvedEntity>>({});

  const [openNode, setOpenNode] = useState<BrainNodeDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Drives the Add Node modal's countdown to the summarization threshold. */
  const [brainSettings, setBrainSettings] = useState<BrainSettings | null>(null);
  const [editingNode, setEditingNode] = useState<BrainNodeDetail | null>(null);
  const [connectTo, setConnectTo] = useState<BrainNode | null>(null);

  // Graph and tree views. Both draw the same payload, so they share the panel,
  // the department filters and the loaded graph.
  const [view, setView] = useState<"categories" | "graph" | "tree">("categories");
  const [graphMode, setGraphMode] = useState<GraphMode>("2d");
  const [showCrossLinks, setShowCrossLinks] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [focusCategoryId, setFocusCategoryId] = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [graphSettings, setGraphSettings] = useState<GraphSettings>({
    showLabels: false, nodeSize: 100, linkThickness: 100, showArrows: false,
  });
  const [graphFilters, setGraphFilters] = useState<GraphFilters>({
    note: true, task: true, link: true, pin: true, entity_ref: true, category: true, orphan: true,
  });

  const flatCategories = useMemo(
    () => (overview ? flattenCategories(overview.categories) : []),
    [overview]
  );
  const selectedCategory: BrainCategory | undefined = useMemo(
    () => (typeof selectedId === "string" ? flatCategories.find((c) => c.id === selectedId) : undefined),
    [flatCategories, selectedId]
  );

  const loadOverview = useCallback(() => {
    return getBrainOverview()
      .then(setOverview)
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard", "brainErrOverview")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNodes = useCallback(() => {
    setNodesLoading(true);
    const q = query.trim();
    // The search box searches the whole Brain, not just the open category —
    // finding a note you can't remember filing is the point of searching. In
    // the Archive it searches the Archive, for the same reason.
    const status = showArchived ? "archived" : "active";
    const request = q.length >= 2
      ? searchBrain(q, 100, status)
      : listBrainNodes(
          showArchived
            ? { status: "archived" }
            : { categoryId: selectedId === undefined ? undefined : selectedId }
        );

    return request
      .then(setNodes)
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard", "brainErrNodes")))
      .finally(() => setNodesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, query, showArchived]);

  useEffect(() => {
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview]);


  // Debounced, so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => { loadNodes(); }, query.trim() ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadNodes, query]);

  // Pins are fetched once for every department that has one, then matched to
  // whichever category is open — the whole set is a single request.
  useEffect(() => {
    getBrainPins([...PIN_KEYS]).then(setPins).catch(() => setPins([]));
  }, []);

  // Enrichment settings, for the Add Node countdown. Re-read whenever the
  // settings modal closes so toggling summaries updates the hint immediately.
  const loadBrainSettings = useCallback(() => {
    getBrainSettings().then(setBrainSettings).catch(() => setBrainSettings(null));
  }, []);
  useEffect(() => { loadBrainSettings(); }, [loadBrainSettings]);

  /**
   * Resolve the reference nodes on screen, in one request for the whole page.
   *
   * Without this a card for a deleted invoice would look perfectly healthy
   * until you opened it — the stored title is a label and knows nothing about
   * whether the record still exists.
   */
  useEffect(() => {
    const refs = nodes.flatMap((n) => {
      const ref = readEntityRef(n);
      return ref ? [ref] : [];
    });
    if (refs.length === 0) { setEntityStates({}); return; }

    let cancelled = false;
    resolveBrainEntities(refs)
      .then((rows) => {
        if (cancelled) return;
        setEntityStates(
          Object.fromEntries(rows.map((r) => [`${r.entityType}:${r.entityId}`, r]))
        );
      })
      .catch(() => { if (!cancelled) setEntityStates({}); });
    return () => { cancelled = true; };
  }, [nodes]);

  const loadGraph = useCallback(() => {
    setGraphLoading(true);
    return getBrainGraph()
      .then(setGraph)
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard", "brainErrGraph")))
      .finally(() => setGraphLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCanvas = view === "graph" || view === "tree";

  // Fetched on the first switch to either canvas, then kept fresh by refreshAll.
  useEffect(() => {
    if (isCanvas && !graph) loadGraph();
  }, [isCanvas, graph, loadGraph]);

  const refreshAll = () => {
    loadOverview();
    loadNodes();
    if (isCanvas) loadGraph();
    else setGraph(null); // force a rebuild next time a canvas is opened
  };

  // Switching workspace has to rebuild the whole tab. The Brain is entirely
  // business-scoped, so without this every category, note, pin and graph stayed
  // on screen from the previous workspace until a manual page reload — which
  // reads as "the Brain didn't change". Same event the Dashboard listens for.
  useEffect(() => {
    const handler = () => {
      setSelectedId(undefined);
      setShowArchived(false);
      setOpenNode(null);
      setQuery("");
      setFocusCategoryId(null);
      setHiddenCategories(new Set());
      setGraph(null);
      setError(null);
      loadOverview();
      loadNodes();
      getBrainPins([...PIN_KEYS]).then(setPins).catch(() => setPins([]));
      if (isCanvas) loadGraph();
    };
    window.addEventListener("finna:businessChanged", handler);
    return () => window.removeEventListener("finna:businessChanged", handler);
  }, [loadOverview, loadNodes, loadGraph, isCanvas]);

  const openDetail = async (id: string) => {
    try {
      setOpenNode(await getBrainNode(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrNodes"));
    }
  };

  /**
   * ?node=<id> — where "Add to Company Brain" lands you, with the new
   * reference already open so the next thing you do is write down why it
   * matters.
   *
   * Read straight off `window.location` rather than through useSearchParams:
   * that hook forces the whole page under a Suspense boundary at build time,
   * and this only ever needs to run once after mount. The param is stripped
   * afterwards so a refresh doesn't reopen a panel the user closed.
   */
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("node");
    if (!wanted) return;
    window.history.replaceState(null, "", window.location.pathname);
    setView("categories");
    setShowArchived(false);
    openDetail(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = (connect?: BrainNode | null) => {
    setEditingNode(null);
    setConnectTo(connect ?? null);
    setModalOpen(true);
  };

  const startEdit = async (id: string) => {
    try {
      setEditingNode(await getBrainNode(id));
      setConnectTo(null);
      setModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrNodes"));
    }
  };

  const addCategory = async () => {
    const name = window.prompt(t("dashboard", "brainNewCategoryPrompt"));
    if (!name?.trim()) return;
    try {
      await createBrainCategory({ name: name.trim() });
      loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrCategory"));
    }
  };

  const renameCategory = async (cat: BrainCategory) => {
    const name = window.prompt(t("dashboard", "brainRenamePrompt"), cat.name);
    if (name === null) return;
    const role = window.prompt(t("dashboard", "brainRolePrompt"), cat.role ?? "");
    try {
      await updateBrainCategory(cat.id, {
        name: name.trim() || cat.name,
        role: role === null ? undefined : role,
      });
      loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrCategory"));
    }
  };

  /**
   * Remove a department or subcategory. Archives rather than deletes: the
   * category disappears from the tree and the graph, and everything filed in it
   * (and in its subcategories) moves to Unassigned rather than being destroyed.
   */
  const archiveCategoryById = async (id: string, name: string) => {
    if (!window.confirm(`${name} — ${t("dashboard", "brainConfirmArchiveCategory")}`)) return;
    try {
      await removeBrainCategory(id);
      if (selectedId === id) setSelectedId(undefined);
      if (focusCategoryId === id) setFocusCategoryId(null);
      refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrCategory"));
    }
  };

  const archiveCategory = (cat: BrainCategory) => archiveCategoryById(cat.id, cat.name);

  /**
   * Archive, restore and delete a node from wherever it's listed.
   *
   * Archiving takes no confirmation — it's reversible and the note keeps all
   * its connections. Deleting does, because it drops the node and every edge
   * touching it for good.
   */
  const setNodeArchived = async (id: string, archived: boolean) => {
    try {
      if (archived) await archiveBrainNode(id);
      else await unarchiveBrainNode(id);
      if (openNode?.id === id) setOpenNode(null);
      refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrArchiveNode"));
    }
  };

  const removeNode = async (id: string) => {
    if (!window.confirm(t("dashboard", "brainConfirmDeleteNode"))) return;
    try {
      await deleteBrainNode(id);
      if (openNode?.id === id) setOpenNode(null);
      refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrDeleteNode"));
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";

  /**
   * What this member may do (spec §10). The server enforces all of it; this
   * only decides whether to render controls that would be refused anyway.
   * Defaults to writable so the UI never locks up if the field is missing.
   */
  const canWrite = overview?.access?.canWrite ?? true;
  const isOwnerAdmin = overview?.access?.level === "editor";

  const activePin = selectedCategory?.slug
    ? pins.find((p) => p.key === (selectedCategory.slug as PinKey))
    : undefined;

  /**
   * Only Marketing and Sales get the advisor (§6b). Matched on slug, not name,
   * so a user who renames the category to "Growth" keeps the advisor.
   * Subcategories don't get their own — the advice belongs to the department.
   */
  const guidedCategory: GuidedCategory | null =
    selectedCategory && !selectedCategory.parentCategoryId &&
    (selectedCategory.slug === "marketing" || selectedCategory.slug === "sales")
      ? selectedCategory.slug
      : null;

  const headerTitle = showArchived
    ? t("dashboard", "brainArchived")
    : query.trim().length >= 2
      ? t("dashboard", "brainSearchResults")
      : selectedId === undefined
        ? t("dashboard", "brainAllNotes")
        : selectedId === null
          ? t("dashboard", "brainUnassigned")
          : selectedCategory?.name ?? "";

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <h1 className={`text-xl font-bold ${text}`}>{t("dashboard", "brainTitle")}</h1>
            <Link href="/dashboard" className="text-sm text-blue-500 hover:underline">← {t("dashboard", "title")}</Link>
          </div>
          <p className={`text-sm mb-3 ${sub}`}>{t("dashboard", "brainDesc")}</p>

          {/* The overview is the business's identity card — useful, but it eats
              vertical space the graph wants. Collapsible, open by default. */}
          <button
            onClick={() => setOverviewOpen((v) => !v)}
            className={`flex items-center gap-1.5 mb-2 text-xs font-medium ${sub} hover:text-blue-500`}
          >
            {overviewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {t("dashboard", overviewOpen ? "brainHideCompanyInfo" : "brainShowCompanyInfo")}
          </button>
          {overviewOpen && (
            <CompanyOverviewCard isDark={isDark} businessName={overview?.businessName ?? null} />
          )}

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {/* The "+" is fixed at the top of the tab and always visible, whichever
              view the user is in — adding to the Brain is what the tab is for. */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button onClick={() => setNavOpen((v) => !v)}
              className={`lg:hidden p-2 rounded-lg border ${border} ${sub}`} aria-label={t("dashboard", "brainCategories")}>
              <Menu className="h-4 w-4" />
            </button>
            <button onClick={() => startCreate()}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold pl-3 pr-4 py-2 rounded-full text-sm shadow-sm">
              <Plus className="h-4 w-4" />{t("dashboard", "brainAddNode")}
            </button>

            {/* Categories is the day-to-day view, the graph is the zoom-out,
                and the tree is the one you show somebody else. */}
            <div className={`flex rounded-lg border overflow-hidden ${border}`}>
              {([
                { key: "graph" as const, icon: Share2, label: t("dashboard", "brainViewGraph") },
                { key: "tree" as const, icon: Network, label: t("dashboard", "brainViewTree") },
                { key: "categories" as const, icon: List, label: t("dashboard", "brainViewCategories") },
              ]).map((v) => {
                const Icon = v.icon;
                const active = view === v.key;
                return (
                  <button key={v.key} onClick={() => setView(v.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-blue-500 text-white" : `${sub} ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`
                    }`}>
                    <Icon className="h-3.5 w-3.5" />{v.label}
                  </button>
                );
              })}
            </div>

            {/* Collapsing the panel gives the canvas the full width, which is
                what you want once the filters are set the way you like them. */}
            {/* Filters sit with the thing they change, not behind the panel —
                and directly after the view switch, since which view you're in
                decides whether they apply at all. Graph only: the tree renders
                a hierarchy and ignores them. */}
            {view === "graph" && graph && (
              <GraphFilterMenu isDark={isDark} filters={graphFilters} onFilters={setGraphFilters} />
            )}

            {/* 2D/3D is a property of the canvas, so it lives on the canvas
                toolbar next to the panel toggle rather than inside the panel
                it used to be buried at the bottom of. */}
            {view === "graph" && (
              <div className={`flex rounded-lg border overflow-hidden ${border}`}>
                {(["2d", "3d"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setGraphMode(m)}
                    title={t("dashboard", m === "3d" ? "brainGraph3dHint" : "brainGraph2dHint")}
                    className={`px-3 py-2 text-sm font-semibold transition-colors ${
                      graphMode === m
                        ? "bg-blue-500 text-white"
                        : `${sub} ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {isCanvas && (
              <button
                onClick={() => setPanelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${border} ${sub} ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                title={t("dashboard", panelOpen ? "brainHidePanel" : "brainShowPanel")}
              >
                {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">
                  {t("dashboard", panelOpen ? "brainHidePanel" : "brainShowPanel")}
                </span>
              </button>
            )}

            <button
              onClick={() => setSettingsOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${border} ${sub} ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              title={t("dashboard", "brainSettings")}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("dashboard", "brainSettings")}</span>
            </button>

            {overview && (
              <div className="flex items-center gap-3 ml-auto">
                {!canWrite && (
                  <span className={`flex items-center gap-1 text-xs ${sub}`} title={t("dashboard", "brainReadOnly")}>
                    <Eye className="h-3.5 w-3.5" />{t("dashboard", "brainReadOnly")}
                  </span>
                )}
                <p className={`text-xs ${sub}`}>
                  {overview.totalNodes} {t("dashboard", "brainNodesTotal")}
                </p>
              </div>
            )}
          </div>

          {loading ? (
            <p className={`text-sm ${sub}`}>{t("dashboard", "brainLoading")}</p>
          ) : isCanvas ? (
            <div className={`grid gap-5 items-start ${panelOpen ? "lg:grid-cols-[1fr_260px]" : "grid-cols-1"}`}>
              <div
                className={`rounded-xl border overflow-hidden ${card}`}
                style={{ height: "min(70vh, 640px)" }}
              >
                {graphLoading && !graph ? (
                  <div className="h-full flex items-center justify-center">
                    <p className={`text-sm ${sub}`}>{t("dashboard", "brainLoading")}</p>
                  </div>
                ) : graph ? (
                  view === "tree" ? (
                    <BrainTree
                      isDark={isDark}
                      graph={graph}
                      hiddenCategories={hiddenCategories}
                      showCrossLinks={showCrossLinks}
                      onOpenNode={(refId) => { setView("categories"); openDetail(refId); }}
                      onEditNode={startEdit}
                    />
                  ) : (
                    <BrainGraph
                      isDark={isDark}
                      graph={graph}
                      mode={graphMode}
                      settings={graphSettings}
                      filters={graphFilters}
                      hiddenCategories={hiddenCategories}
                      focusCategoryId={focusCategoryId}
                      onOpenNode={(refId) => { setView("categories"); openDetail(refId); }}
                      onEditNode={startEdit}
                      onAddNode={(refId) => {
                        // The modal shows the target's title, so pull the real
                        // label off the graph rather than passing a bare id.
                        if (!refId) { startCreate(null); return; }
                        const g = graph?.nodes.find((n) => n.kind !== "category" && n.refId === refId);
                        startCreate(g ? ({ id: refId, title: g.label } as BrainNode) : null);
                      }}
                    />
                  )
                ) : null}
              </div>

              {graph && panelOpen && (
                <GraphPanel
                  isDark={isDark}
                  graph={graph}
                  view={view === "tree" ? "tree" : "graph"}
                  showCrossLinks={showCrossLinks}
                  onShowCrossLinks={setShowCrossLinks}
                  settings={graphSettings}
                  onSettings={setGraphSettings}
                  hiddenCategories={hiddenCategories}
                  onToggleCategory={(id) => setHiddenCategories((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                  focusCategoryId={focusCategoryId}
                  onFocusCategory={setFocusCategoryId}
                  onRenameCategory={async (id, name) => {
                    try {
                      await updateBrainCategory(id, { name });
                      await Promise.all([loadOverview(), loadGraph()]);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t("dashboard", "brainErrCategory"));
                    }
                  }}
                  onAddCategory={async (name) => {
                    try {
                      await createBrainCategory({ name });
                      await Promise.all([loadOverview(), loadGraph()]);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t("dashboard", "brainErrCategory"));
                    }
                  }}
                  onRecolorCategory={async (id, color) => {
                    try {
                      await updateBrainCategory(id, { color });
                      await Promise.all([loadOverview(), loadGraph()]);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t("dashboard", "brainErrCategory"));
                    }
                  }}
                  onRemoveCategory={archiveCategoryById}
                />
              )}
            </div>
          ) : (
            <div className="grid lg:grid-cols-[220px_1fr] gap-5 items-start">
              <div className={`rounded-xl border p-3 ${card} ${navOpen ? "block" : "hidden lg:block"}`}>
                <CategorySidebar
                  isDark={isDark}
                  categories={overview?.categories ?? []}
                  unassignedCount={overview?.unassignedCount ?? 0}
                  archivedCount={overview?.archivedCount ?? 0}
                  archived={showArchived}
                  onSelectArchived={() => {
                    setShowArchived(true);
                    setOpenNode(null);
                    setQuery("");
                    setNavOpen(false);
                  }}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setShowArchived(false);
                    setOpenNode(null);
                    setNavOpen(false);
                  }}
                  onAddCategory={addCategory}
                  query={query}
                  onQueryChange={setQuery}
                  onAddSubcategory={async (parentId, name) => {
                    try {
                      await createBrainCategory({ name, parentCategoryId: parentId });
                      refreshAll();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t("dashboard", "brainErrCategory"));
                    }
                  }}
                  onRemoveCategory={archiveCategoryById}
                />
              </div>

              <div className="min-w-0">
                {openNode ? (
                  <NodeDetailPanel
                    isDark={isDark}
                    node={openNode}
                    canRestrict={isOwnerAdmin}
                    onClose={() => setOpenNode(null)}
                    onEdit={() => startEdit(openNode.id)}
                    onAddConnected={() => startCreate(openNode)}
                    onChanged={() => { openDetail(openNode.id); refreshAll(); }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h2 className={`text-base font-bold ${text}`}>{headerTitle}</h2>
                        {showArchived ? (
                          <p className={`text-sm ${sub}`}>{t("dashboard", "brainArchiveHint")}</p>
                        ) : selectedCategory?.role ? (
                          <p className={`text-sm ${sub}`}>{selectedCategory.role}</p>
                        ) : null}
                      </div>
                      {selectedCategory && !showArchived && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => renameCategory(selectedCategory)} className={`${sub} hover:text-blue-500`}
                            title={t("dashboard", "brainRenameCategory")}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => archiveCategory(selectedCategory)} className={`${sub} hover:text-red-500`}
                            title={t("dashboard", "brainRemoveCategory")}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {activePin && !showArchived && <PinCard isDark={isDark} pin={activePin} />}

                    {/* Marketing and Sales are guided categories (§6b): Finna
                        advises here instead of the category being a silent
                        notebook. Hidden in the Archive, which is a record, not
                        a place to take new advice. */}
                    {guidedCategory && !showArchived && (
                      <AdvisorPanel
                        isDark={isDark}
                        category={guidedCategory}
                        onNoteSaved={refreshAll}
                      />
                    )}

                    {nodesLoading ? (
                      <p className={`text-sm ${sub}`}>{t("dashboard", "brainLoading")}</p>
                    ) : nodes.length === 0 ? (
                      <div className={`rounded-xl border p-8 text-center ${card}`}>
                        <p className={`text-sm ${sub}`}>
                          {query.trim().length >= 2
                            ? t("dashboard", "brainNoMatch")
                            : showArchived
                              ? t("dashboard", "brainNoArchived")
                              : t("dashboard", "brainEmptyCategory")}
                        </p>
                        {query.trim().length < 2 && !showArchived && (
                          <button onClick={() => startCreate()} className="mt-3 text-sm font-semibold text-blue-500 hover:underline">
                            {t("dashboard", "brainAddFirstNote")}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {nodes.map((n) => {
                          const Icon = TYPE_ICON[n.type];
                          const cat = flatCategories.find((c) => c.id === n.categoryId);
                          const archived = n.status === "archived";
                          const ref = readEntityRef(n);
                          const resolved = ref
                            ? entityStates[`${ref.entityType}:${ref.entityId}`]
                            : undefined;
                          const dangling = resolved !== undefined && !resolved.exists;
                          return (
                            // A div rather than a button: the card carries its
                            // own action buttons, and a button inside a button
                            // is invalid markup that browsers resolve by
                            // dropping one of them.
                            <div
                              key={n.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => openDetail(n.id)}
                              onDoubleClick={() => startEdit(n.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") openDetail(n.id); }}
                              className={`group text-left rounded-xl border p-4 transition-colors cursor-pointer ${card} ${isDark ? "hover:border-gray-500" : "hover:border-gray-400"}`}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${sub}`} />
                                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: cat?.color ?? (isDark ? "#4b5563" : "#d1d5db") }} />
                                <span className={`text-[11px] uppercase tracking-wide truncate ${sub}`}>
                                  {cat?.name ?? t("dashboard", "brainUnassigned")}
                                </span>

                                <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setNodeArchived(n.id, !archived); }}
                                    className={`p-1 rounded ${sub} hover:text-amber-500 opacity-0 group-hover:opacity-100 focus:opacity-100`}
                                    title={t("dashboard", archived ? "brainUnarchive" : "brainArchive")}
                                  >
                                    {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEdit(n.id); }}
                                    className={`p-1 rounded ${sub} hover:text-blue-500 opacity-0 group-hover:opacity-100 focus:opacity-100`}
                                    title={t("dashboard", "brainEditNode")}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  {/* Deleting is offered on the card only in the
                                      Archive — everywhere else archiving is the
                                      one-click action and delete lives behind
                                      the edit modal. */}
                                  {archived && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeNode(n.id); }}
                                      className={`p-1 rounded ${sub} hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100`}
                                      title={t("dashboard", "brainDelete")}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className={`text-sm font-semibold mb-1 break-words ${text}`}>{n.title}</p>
                              {/* The record behind this reference is gone. Said
                                  on the card, not just once it's opened. */}
                              {dangling && (
                                <p className="text-xs text-amber-500 mb-1">
                                  {t("dashboard", "brainRefMissing")}
                                </p>
                              )}
                              {n.content && (
                                <p className={`text-xs line-clamp-2 break-words ${sub}`}>{n.content}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <BrainSettingsModal
        isOpen={settingsOpen}
        isDark={isDark}
        canManageAccess={isOwnerAdmin}
        onClose={() => { setSettingsOpen(false); loadBrainSettings(); refreshAll(); }}
      />

      <AddNodeModal
        isOpen={modalOpen}
        isDark={isDark}
        categories={overview?.categories ?? []}
        editing={editingNode}
        defaultCategoryId={typeof selectedId === "string" ? selectedId : null}
        defaultConnectTo={connectTo}
        summaryThreshold={
          brainSettings?.autoSummarize ? brainSettings.minSummaryChars : null
        }
        onClose={() => { setModalOpen(false); setEditingNode(null); setConnectTo(null); }}
        onSaved={() => {
          refreshAll();
          // Keep the detail panel honest after an edit or a delete.
          if (openNode) {
            getBrainNode(openNode.id).then(setOpenNode).catch(() => setOpenNode(null));
          }
        }}
      />
    </DashboardShell>
  );
}
