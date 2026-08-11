"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Maximize2, Inbox } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { BrainGraph as GraphData, GraphNode } from "@/lib/api/brain";

/**
 * Tree view — the Brain as an org chart (spec §8.5b).
 *
 * The CEO sits at the root, the other departments hang off it, subcategories
 * hang off those, and individual notes sit at the bottom of their branch. It is
 * the same data as the graph, laid out for legibility instead of density: this
 * is the view you turn to your screen to show somebody what the business knows.
 *
 * Built from the graph payload rather than a second endpoint. The hierarchy is
 * already in there — `belongs_to` edges carry note→category, subcategory→parent
 * and CEO→department — so re-deriving it here keeps one source of truth and one
 * request. SVG rather than canvas, because this view is mostly text and text in
 * canvas is a whole layout engine you don't get for free.
 */

/** Box metrics. LEVEL_Y is generous so the connector elbows stay readable. */
const NODE_W = 170;
const NODE_H = 38;
const GAP_X = 14;
const LEVEL_Y = 82;
const PADDING = 60;

interface TreeNode {
  id: string;
  refId: string;
  label: string;
  kind: GraphNode["kind"];
  color: string | null;
  children: TreeNode[];
  /** Everything below it, so a collapsed branch can still say how much it hides. */
  descendants: number;
  x: number;
  y: number;
  depth: number;
}

export default function BrainTree({
  isDark, graph, hiddenCategories, showCrossLinks, onOpenNode, onEditNode,
}: {
  isDark: boolean;
  graph: GraphData;
  /** Departments switched off in the panel drop out of the tree too. */
  hiddenCategories: Set<string>;
  showCrossLinks: boolean;
  onOpenNode: (refId: string) => void;
  onEditNode: (refId: string) => void;
}) {
  const { t } = useLanguage();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const drag = useRef<{ on: boolean; sx: number; sy: number }>({ on: false, sx: 0, sy: 0 });
  /** Fit runs once per fresh tree shape, not on every collapse. */
  const fitted = useRef<string>("");

  const neutral = isDark ? "#6b7280" : "#9ca3af";
  // Pulled out as a string: `t` is a fresh function on every render, so having
  // it in the dependency list below would rebuild the whole tree on every pan
  // frame. A string compares by value and stays stable.
  const unassignedLabel = t("dashboard", "brainUnassigned");

  /**
   * Rebuild the hierarchy from the graph's synthesized `belongs_to` edges.
   *
   * Their direction differs by kind, which is why each id prefix is handled
   * separately rather than assuming from→to always points at the parent:
   * `bt:` and `sub:` run child→parent, `org:` runs CEO→department.
   */
  const roots = useMemo<TreeNode[]>(() => {
    const visible = graph.nodes.filter((n) =>
      !(n.categoryId && hiddenCategories.has(n.categoryId))
    );
    const byId = new Map<string, TreeNode>();
    for (const n of visible) {
      byId.set(n.id, {
        id: n.id, refId: n.refId, label: n.label, kind: n.kind, color: n.color,
        children: [], descendants: 0, x: 0, y: 0, depth: 0,
      });
    }

    const parentOf = new Map<string, string>();
    for (const e of graph.edges) {
      if (e.kind !== "belongs_to") continue;
      if (e.id.startsWith("org:")) parentOf.set(e.to, e.from);
      else parentOf.set(e.from, e.to);
    }

    const orphans: TreeNode[] = [];
    const tops: TreeNode[] = [];
    for (const n of visible) {
      const self = byId.get(n.id)!;
      const parent = parentOf.get(n.id);
      const parentNode = parent ? byId.get(parent) : undefined;
      if (parentNode) parentNode.children.push(self);
      else if (n.kind === "category") tops.push(self);
      else orphans.push(self);
    }

    // Unassigned notes get their own branch at the bottom rather than floating
    // beside the CEO as if they were departments.
    if (orphans.length > 0) {
      tops.push({
        id: "unassigned", refId: "", label: unassignedLabel,
        kind: "category", color: null, children: orphans, descendants: 0,
        x: 0, y: 0, depth: 0,
      });
    }

    const countDown = (n: TreeNode, depth: number): number => {
      n.depth = depth;
      // Departments before notes at every level, each half alphabetical, so the
      // shape is stable between reloads instead of following row order.
      n.children.sort((a, b) =>
        a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === "category" ? -1 : 1
      );
      n.descendants = n.children.reduce((sum, c) => sum + 1 + countDown(c, depth + 1), 0);
      return n.descendants;
    };
    for (const r of tops) countDown(r, 0);

    // CEO first (it is the root of the org chart), Unassigned always last.
    const ceoId = graph.categories.find((c) => c.slug === "ceo")?.id;
    return tops.sort((a, b) => {
      if (a.id === "unassigned") return 1;
      if (b.id === "unassigned") return -1;
      if (ceoId && a.id === `c:${ceoId}`) return -1;
      if (ceoId && b.id === `c:${ceoId}`) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [graph, hiddenCategories, unassignedLabel]);

  /** Walk the visible tree assigning x/y. Classic tidy layout: leaves take the
   *  next slot along, parents centre over their children. */
  const laid = useMemo(() => {
    let cursor = 0;
    const flat: TreeNode[] = [];

    const place = (n: TreeNode) => {
      flat.push(n);
      const kids = collapsed.has(n.id) ? [] : n.children;
      n.y = n.depth * LEVEL_Y;
      if (kids.length === 0) {
        n.x = cursor + NODE_W / 2;
        cursor += NODE_W + GAP_X;
        return;
      }
      for (const k of kids) place(k);
      n.x = (kids[0]!.x + kids[kids.length - 1]!.x) / 2;
    };

    for (const r of roots) {
      place(r);
      cursor += NODE_W; // breathing room between top-level branches
    }

    const width = Math.max(cursor, NODE_W);
    const height = (flat.reduce((m, n) => Math.max(m, n.depth), 0) + 1) * LEVEL_Y;
    const shown = new Set(flat.map((n) => n.id));
    return { flat, width, height, shown };
  }, [roots, collapsed]);

  /** Links that reach across branches — the part a pure hierarchy can't show. */
  const crossLinks = useMemo(() => {
    if (!showCrossLinks) return [];
    const byId = new Map(laid.flat.map((n) => [n.id, n] as const));
    return graph.edges
      .filter((e) => e.kind !== "belongs_to")
      .map((e) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        return a && b ? { id: e.id, a, b } : null;
      })
      .filter((l): l is { id: string; a: TreeNode; b: TreeNode } => l !== null);
  }, [graph.edges, laid.flat, showCrossLinks]);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const k = Math.min(
      (rect.width - PADDING) / Math.max(laid.width, 1),
      (rect.height - PADDING) / Math.max(laid.height, 1),
      1.4
    );
    const scale = Math.max(0.05, k);
    setView({
      x: (rect.width - laid.width * scale) / 2,
      y: PADDING / 2,
      k: scale,
    });
  }, [laid.width, laid.height]);

  // Fit when the tree's shape changes — a new note or a hidden department, not
  // a collapse (collapsing while the camera jumps is disorienting).
  useEffect(() => {
    const key = `${roots.length}:${graph.nodes.length}:${hiddenCategories.size}`;
    if (fitted.current === key) return;
    fitted.current = key;
    fit();
  }, [roots.length, graph.nodes.length, hiddenCategories.size, fit]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const collapseAll = () =>
    setCollapsed(new Set(laid.flat.filter((n) => n.kind === "category" && n.depth > 0).map((n) => n.id)));

  const onWheel = (e: React.WheelEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setView((v) => {
      const k = Math.min(3, Math.max(0.08, v.k * Math.exp(-e.deltaY * 0.0015)));
      return { k, x: sx - ((sx - v.x) / v.k) * k, y: sy - ((sy - v.y) / v.k) * k };
    });
  };

  const card = isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const line = isDark ? "#4b5563" : "#cbd5e1";

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden rounded-xl"
      style={{ background: isDark ? "#0f1117" : "#fafafa" }}
      onWheel={onWheel}
      onMouseDown={(e) => { drag.current = { on: true, sx: e.clientX, sy: e.clientY }; }}
      onMouseMove={(e) => {
        if (!drag.current.on) return;
        const dx = e.clientX - drag.current.sx;
        const dy = e.clientY - drag.current.sy;
        drag.current.sx = e.clientX;
        drag.current.sy = e.clientY;
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }}
      onMouseUp={() => { drag.current.on = false; }}
      onMouseLeave={() => { drag.current.on = false; }}
    >
      <svg className="w-full h-full cursor-grab active:cursor-grabbing block">
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {/* Cross-branch connections sit underneath, curved and faint so they
              read as "also related to" rather than as part of the hierarchy. */}
          {crossLinks.map((l) => {
            const mx = (l.a.x + l.b.x) / 2;
            const my = Math.max(l.a.y, l.b.y) + NODE_H + 26;
            return (
              <path
                key={l.id}
                d={`M ${l.a.x} ${l.a.y + NODE_H} Q ${mx} ${my} ${l.b.x} ${l.b.y + NODE_H}`}
                fill="none"
                stroke={isDark ? "#7c3aed" : "#8b5cf6"}
                strokeWidth={1.2}
                strokeDasharray="4 4"
                opacity={0.5}
              />
            );
          })}

          {/* Parent→child elbows. */}
          {laid.flat.map((n) => {
            if (collapsed.has(n.id)) return null;
            const midY = n.y + NODE_H + (LEVEL_Y - NODE_H) / 2;
            return n.children.map((c) => (
              <path
                key={`${n.id}->${c.id}`}
                d={`M ${n.x} ${n.y + NODE_H} L ${n.x} ${midY} L ${c.x} ${midY} L ${c.x} ${c.y}`}
                fill="none"
                stroke={line}
                strokeWidth={1.4}
              />
            ));
          })}

          {laid.flat.map((n) => {
            const isCategory = n.kind === "category";
            const color = n.color ?? neutral;
            const isCollapsed = collapsed.has(n.id);
            const hasKids = n.children.length > 0;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x - NODE_W / 2},${n.y})`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCategory) { if (hasKids) toggle(n.id); return; }
                  onOpenNode(n.refId);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!isCategory) onEditNode(n.refId);
                }}
              >
                <rect
                  width={NODE_W} height={NODE_H} rx={8}
                  fill={isDark ? "#1f2937" : "#ffffff"}
                  stroke={isCategory ? color : isDark ? "#374151" : "#e5e7eb"}
                  strokeWidth={isCategory ? 1.8 : 1}
                />
                {/* Colour bar rather than a dot: at a fitted-out zoom the dot
                    disappears but the bar still tells you which department. */}
                <rect width={4} height={NODE_H} rx={2} fill={color} opacity={isCategory ? 1 : 0.7} />
                <text
                  x={hasKids ? 24 : 14} y={NODE_H / 2 + 4}
                  fontSize={isCategory ? 12.5 : 11.5}
                  fontWeight={isCategory ? 600 : 400}
                  fill={isDark ? "#e5e7eb" : "#111827"}
                >
                  {n.label.length > (isCategory ? 18 : 20)
                    ? `${n.label.slice(0, isCategory ? 17 : 19)}…`
                    : n.label}
                </text>
                {hasKids && (
                  <>
                    <path
                      d={isCollapsed ? "M 12 15 L 18 19 L 12 23 Z" : "M 11 17 L 19 17 L 15 23 Z"}
                      fill={isDark ? "#9ca3af" : "#6b7280"}
                    />
                    <text
                      x={NODE_W - 8} y={NODE_H / 2 + 4} textAnchor="end"
                      fontSize={10} fill={isDark ? "#9ca3af" : "#6b7280"}
                    >
                      {isCollapsed ? n.descendants : n.children.length}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1.5">
        <button
          onClick={() => (collapsed.size > 0 ? setCollapsed(new Set()) : collapseAll())}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm ${card}`}
        >
          {collapsed.size > 0
            ? <><ChevronDown className="h-3 w-3" />{t("dashboard", "brainTreeExpandAll")}</>
            : <><ChevronRight className="h-3 w-3" />{t("dashboard", "brainTreeCollapseAll")}</>}
        </button>
        <button onClick={fit}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm ${card}`}>
          <Maximize2 className="h-3 w-3" />{t("dashboard", "brainTreeFit")}
        </button>
      </div>

      {laid.flat.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className={`text-sm ${sub}`}>{t("dashboard", "brainGraphEmpty")}</p>
        </div>
      )}

      {laid.flat.some((n) => n.id === "unassigned") && (
        <div className={`absolute left-3 bottom-3 z-10 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] shadow-sm ${card}`}>
          <Inbox className="h-3 w-3" />{t("dashboard", "brainTreeUnassignedHint")}
        </div>
      )}
    </div>
  );
}
