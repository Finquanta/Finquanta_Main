"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Maximize2, Rotate3d } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { BrainGraph as GraphData, GraphEdge, GraphNode } from "@/lib/api/brain";

/**
 * The graph view — the Brain as a field of connected dots, in 2D or 3D.
 *
 * Hand-rolled force simulation on a canvas, deliberately: no graph library is
 * in this project, and adding one means regenerating the pnpm lockfile that
 * Vercel installs with --frozen-lockfile. It's ~250 lines of physics, it gives
 * exact control over the density the spec asks for, and it means 3D costs a z
 * axis and a projection rather than a WebGL dependency.
 *
 * Repulsion is bucketed into a uniform grid rather than compared all-pairs, so
 * this stays smooth as a real business's Brain grows into the hundreds of nodes.
 *
 * 2D and 3D run the SAME simulation and the SAME draw pass. The only difference
 * is `project()`: in 2D it applies pan/zoom, in 3D it rotates around the cloud's
 * centre and divides by depth. Every interaction — hover, select, drag, add —
 * works off the projected screen position, so it behaves identically in both.
 */

export type GraphMode = "2d" | "3d";

export interface GraphSettings {
  showLabels: boolean;
  nodeSize: number;
  linkThickness: number;
  showArrows: boolean;
}

export interface GraphFilters {
  note: boolean;
  task: boolean;
  link: boolean;
  pin: boolean;
  /** Nodes pointing at a real ledger record. */
  entity_ref: boolean;
  /** The platform's own observations about the numbers. */
  insight: boolean;
  category: boolean;
  orphan: boolean;
}

interface Body {
  id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number;
  color: string | null;
  label: string;
  kind: GraphNode["kind"];
  refId: string;
  categoryId: string | null;
  isCategory: boolean;
  fixed: boolean;
  /** Last projected position, written each frame and read by hit-testing. */
  sx: number; sy: number; scale: number;
}

/** An edge resolved to the two bodies it joins. */
interface Link {
  a: Body;
  b: Body;
  kind: GraphEdge["kind"];
  createdBy: string;
}

// Tuned for the "dense quiet field" look rather than a tidy diagram.
const REPULSION = 2600;
const CUTOFF = 190;
const SPRING = 0.0075;
const REST_LENGTH = 52;
const CENTER_PULL = 0.0007;
const DAMPING = 0.85;
/** Never fully settles — the graph keeps a slow drift so it feels alive. */
const MIN_ALPHA = 0.035;
/** Camera focal length for the 3D projection. Larger = flatter perspective. */
const FOCAL = 1200;
/** How far z is seeded when the cloud first enters 3D. */
const Z_SPREAD = 170;

export default function BrainGraph({
  isDark, graph, mode, settings, filters, hiddenCategories, focusCategoryId,
  onOpenNode, onEditNode, onAddNode,
}: {
  isDark: boolean;
  graph: GraphData;
  mode: GraphMode;
  settings: GraphSettings;
  filters: GraphFilters;
  hiddenCategories: Set<string>;
  /** Set from the right panel — highlights one department, dims the rest. */
  focusCategoryId: string | null;
  onOpenNode: (refId: string) => void;
  onEditNode: (refId: string) => void;
  /** connectTo is the node id to pre-wire the new node to, or null. */
  onAddNode: (connectToRefId: string | null) => void;
}) {
  const { t } = useLanguage();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bodiesRef = useRef<Body[]>([]);
  const byIdRef = useRef<Map<string, Body>>(new Map());
  const linksRef = useRef<Link[]>([]);
  const viewRef = useRef({ x: 0, y: 0, k: 1 });
  /** 3D camera: orbit angles, screen-space pan, and zoom. */
  const camRef = useRef({ rotX: -0.35, rotY: 0.6, panX: 0, panY: 0, zoom: 1 });
  const modeRef = useRef<GraphMode>(mode);
  const alphaRef = useRef(1);
  const rafRef = useRef(0);
  const dragRef = useRef<{ mode: "none" | "node" | "pan" | "orbit"; body?: Body; sx: number; sy: number }>({
    mode: "none", sx: 0, sy: 0,
  });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const [hover, setHover] = useState<{ body: Body; sx: number; sy: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const neutral = isDark ? "#6b7280" : "#9ca3af";

  /** Nodes and edges that survive the current filters. */
  const visible = useMemo(() => {
    const keep = (n: GraphNode) => {
      // Hiding a department has to take its hub and subcategory hubs with it,
      // not just the notes filed under it — otherwise switching it off leaves
      // the cluster sitting there and only the user's own note disappears.
      // A category node carries its ROOT department in categoryId, so this one
      // check covers both a department and its subcategories.
      if (n.kind === "category") {
        if (!filters.category) return false;
        return !(n.categoryId && hiddenCategories.has(n.categoryId));
      }
      if (n.categoryId === null) {
        if (!filters.orphan) return false;
      } else if (hiddenCategories.has(n.categoryId)) {
        return false;
      }
      if (n.kind === "note") return filters.note;
      if (n.kind === "task") return filters.task;
      if (n.kind === "link") return filters.link;
      if (n.kind === "pin") return filters.pin;
      if (n.kind === "entity_ref") return filters.entity_ref;
      if (n.kind === "insight") return filters.insight;
      return true;
    };
    const nodes = graph.nodes.filter(keep);
    const ids = new Set(nodes.map((n) => n.id));
    // An edge with an end removed by a filter goes with it.
    const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    return { nodes, edges };
  }, [graph, filters, hiddenCategories]);

  /** Direct neighbours of the selected node, for the highlight-and-dim pass. */
  const neighbours = useMemo(() => {
    if (!selected) return null;
    const set = new Set<string>([selected]);
    for (const e of visible.edges) {
      if (e.from === selected) set.add(e.to);
      else if (e.to === selected) set.add(e.from);
    }
    return set;
  }, [selected, visible.edges]);

  // Build (or rebuild) the simulation bodies, keeping positions of nodes that
  // survived so adding a note doesn't reshuffle the whole graph.
  useEffect(() => {
    const previous = byIdRef.current;
    const { w, h } = sizeRef.current;
    const cx = w / 2 || 400;
    const cy = h / 2 || 300;

    const bodies: Body[] = visible.nodes.map((n, i) => {
      const old = previous.get(n.id);
      const angle = (i / Math.max(visible.nodes.length, 1)) * Math.PI * 2;
      const isCategory = n.kind === "category";
      const spread = isCategory ? 120 : 260;
      return {
        id: n.id,
        x: old?.x ?? cx + Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
        y: old?.y ?? cy + Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
        z: old?.z ?? 0,
        vx: 0, vy: 0, vz: 0,
        r: isCategory
          ? 4.5 + Math.sqrt(n.degree) * 1.5
          : 2.2 + Math.sqrt(n.degree) * 1.3,
        color: n.color,
        label: n.label,
        kind: n.kind,
        refId: n.refId,
        categoryId: n.categoryId,
        isCategory,
        fixed: false,
        sx: 0, sy: 0, scale: 1,
      };
    });

    const map = new Map(bodies.map((b) => [b.id, b] as const));
    bodiesRef.current = bodies;
    byIdRef.current = map;
    linksRef.current = visible.edges
      .map((e) => {
        const a = map.get(e.from);
        const b = map.get(e.to);
        return a && b ? { a, b, kind: e.kind, createdBy: e.createdBy } : null;
      })
      .filter((l): l is Link => l !== null);

    alphaRef.current = 1;
  }, [visible]);

  // Entering 3D on a flat cloud gives every body a z, or the first frames look
  // like 2D seen at an angle. Leaving 3D flattens, so coming back is stable.
  useEffect(() => {
    modeRef.current = mode;
    const bodies = bodiesRef.current;
    if (mode === "3d") {
      const flat = bodies.every((b) => b.z === 0);
      if (flat) {
        for (const b of bodies) {
          b.z = (Math.random() - 0.5) * Z_SPREAD * (b.isCategory ? 1.6 : 1);
        }
      }
    } else {
      for (const b of bodies) { b.z = 0; b.vz = 0; }
    }
    alphaRef.current = 1;
    setHover(null);
  }, [mode]);

  /** One physics step. Identical in both modes except that 2D pins z to zero. */
  const tick = useCallback(() => {
    const bodies = bodiesRef.current;
    const links = linksRef.current;
    const alpha = alphaRef.current;
    const spatial = modeRef.current === "3d";
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;

    // Bucket into a uniform grid so repulsion is local, not all-pairs. The z
    // term is only in the key when it can vary — in 2D every body shares z=0.
    const cell = CUTOFF;
    const grid = new Map<string, Body[]>();
    for (const b of bodies) {
      const key = spatial
        ? `${Math.floor(b.x / cell)},${Math.floor(b.y / cell)},${Math.floor(b.z / cell)}`
        : `${Math.floor(b.x / cell)},${Math.floor(b.y / cell)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(b); else grid.set(key, [b]);
    }

    for (const b of bodies) {
      const gx = Math.floor(b.x / cell);
      const gy = Math.floor(b.y / cell);
      const gz = Math.floor(b.z / cell);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = spatial ? -1 : 0; oz <= (spatial ? 1 : 0); oz++) {
            const bucket = grid.get(
              spatial ? `${gx + ox},${gy + oy},${gz + oz}` : `${gx + ox},${gy + oy}`
            );
            if (!bucket) continue;
            for (const other of bucket) {
              if (other === b) continue;
              let dx = b.x - other.x;
              let dy = b.y - other.y;
              let dz = spatial ? b.z - other.z : 0;
              let d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > CUTOFF * CUTOFF) continue;
              if (d2 < 0.01) {
                dx = Math.random() - 0.5;
                dy = Math.random() - 0.5;
                dz = spatial ? Math.random() - 0.5 : 0;
                d2 = 0.01;
              }
              const d = Math.sqrt(d2);
              // Hubs push harder, which is what opens space between clusters.
              const strength = (REPULSION * (b.isCategory || other.isCategory ? 2.4 : 1)) / d2;
              b.vx += (dx / d) * strength * alpha * 0.02;
              b.vy += (dy / d) * strength * alpha * 0.02;
              if (spatial) b.vz += (dz / d) * strength * alpha * 0.02;
            }
          }
        }
      }
    }

    for (const l of links) {
      const dx = l.b.x - l.a.x;
      const dy = l.b.y - l.a.y;
      const dz = spatial ? l.b.z - l.a.z : 0;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      // belongs_to holds a note close to its department; a cross-category link
      // is longer, so those threads visibly reach between clusters.
      const rest = l.kind === "belongs_to" ? REST_LENGTH : REST_LENGTH * 2.6;
      const force = (d - rest) * SPRING * alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      const fz = (dz / d) * force;
      l.a.vx += fx; l.a.vy += fy;
      l.b.vx -= fx; l.b.vy -= fy;
      if (spatial) { l.a.vz += fz; l.b.vz -= fz; }
    }

    for (const b of bodies) {
      if (b.fixed) { b.vx = 0; b.vy = 0; b.vz = 0; continue; }
      const pull = b.isCategory ? 2.2 : 1;
      b.vx += (cx - b.x) * CENTER_PULL * alpha * pull;
      b.vy += (cy - b.y) * CENTER_PULL * alpha * pull;
      b.vx *= DAMPING;
      b.vy *= DAMPING;
      b.x += b.vx;
      b.y += b.vy;
      if (spatial) {
        b.vz += (0 - b.z) * CENTER_PULL * alpha * pull;
        b.vz *= DAMPING;
        b.z += b.vz;
      }
    }

    alphaRef.current = Math.max(MIN_ALPHA, alpha * 0.994);
  }, []);

  /**
   * World → screen. The single place the two modes differ.
   *
   * `scale` comes back alongside so radii, line widths and label offsets can be
   * expressed in world units and drawn in screen units without a canvas
   * transform — which is what lets depth-sorted 3D and flat 2D share a draw pass.
   */
  const project = useCallback((b: Body) => {
    const { w, h } = sizeRef.current;
    if (modeRef.current === "2d") {
      const v = viewRef.current;
      return { sx: b.x * v.k + v.x, sy: b.y * v.k + v.y, scale: v.k, depth: 0 };
    }
    const cam = camRef.current;
    const ox = b.x - w / 2;
    const oy = b.y - h / 2;
    const cosY = Math.cos(cam.rotY), sinY = Math.sin(cam.rotY);
    const cosX = Math.cos(cam.rotX), sinX = Math.sin(cam.rotX);
    const rx = ox * cosY + b.z * sinY;
    const rz1 = -ox * sinY + b.z * cosY;
    const ry = oy * cosX - rz1 * sinX;
    const rz = oy * sinX + rz1 * cosX;
    // Perspective divide, clamped so a node level with the camera can't blow up.
    const f = Math.max(0.15, Math.min(3, FOCAL / (FOCAL + rz)));
    const k = f * cam.zoom;
    return {
      sx: rx * k + w / 2 + cam.panX,
      sy: ry * k + h / 2 + cam.panY,
      scale: k,
      depth: rz,
    };
  }, []);

  /** Draw one frame. */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { w, h, dpr } = sizeRef.current;
    const is3d = modeRef.current === "3d";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? "#0f1117" : "#fafafa";
    ctx.fillRect(0, 0, w, h);

    // Project once per frame; everything below reads the cached screen position,
    // including hit-testing on the next mouse event.
    const bodies = bodiesRef.current;
    for (const b of bodies) {
      const p = project(b);
      b.sx = p.sx;
      b.sy = p.sy;
      b.scale = p.scale;
    }

    const dimmed = (b: Body) => {
      if (neighbours) return !neighbours.has(b.id);
      if (focusCategoryId) return b.categoryId !== focusCategoryId;
      return false;
    };

    // In 3D, distance reads as haze: further back is smaller (from the divide)
    // and fainter (here), which is most of what sells depth on a flat screen.
    const depthAlpha = (b: Body) =>
      is3d ? Math.min(1, Math.max(0.28, (b.scale / Math.max(camRef.current.zoom, 0.01)) ** 2.2)) : 1;

    const nodeScale = settings.nodeSize / 100;

    // Edges first, underneath the dots. Thin and faint, never labelled.
    for (const l of linksRef.current) {
      const faded = dimmed(l.a) && dimmed(l.b);
      const auto = l.createdBy !== "user";
      const depth = Math.min(depthAlpha(l.a), depthAlpha(l.b));
      const base = faded ? 0.05 : auto ? 0.16 : 0.3;
      const alpha = base * (is3d ? depth : 1);
      ctx.strokeStyle = isDark
        ? `rgba(148,163,184,${alpha})`
        : `rgba(100,116,139,${alpha * 1.06})`;
      ctx.lineWidth = (settings.linkThickness / 100) * (auto ? 0.8 : 1.4)
        * ((l.a.scale + l.b.scale) / 2);
      if (auto) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(l.a.sx, l.a.sy);
      ctx.lineTo(l.b.sx, l.b.sy);
      ctx.stroke();
      ctx.setLineDash([]);

      if (settings.showArrows && !faded) {
        const dx = l.b.sx - l.a.sx;
        const dy = l.b.sy - l.a.sy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const rb = l.b.r * nodeScale * l.b.scale;
        const tipX = l.b.sx - (dx / d) * (rb + 2);
        const tipY = l.b.sy - (dy / d) * (rb + 2);
        const angle = Math.atan2(dy, dx);
        const size = 5 * l.b.scale;
        ctx.fillStyle = isDark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.5)";
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - size * Math.cos(angle - 0.4), tipY - size * Math.sin(angle - 0.4));
        ctx.lineTo(tipX - size * Math.cos(angle + 0.4), tipY - size * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      }
    }

    // Painter's algorithm in 3D: furthest first (smallest projected scale), so
    // near dots land on top. 2D keeps insertion order, as it drew before.
    const order = is3d ? [...bodies].sort((a, b) => a.scale - b.scale) : bodies;

    for (const b of order) {
      const faded = dimmed(b);
      const r = Math.max(b.r * nodeScale * b.scale, 0.4);
      // Unassigned nodes stay neutral and dim — the graph should look mostly
      // quiet, with colour picking out what belongs somewhere.
      const base = b.color ?? neutral;
      const own = faded ? 0.12 : b.isCategory ? 1 : b.color ? 0.85 : 0.5;
      ctx.globalAlpha = own * depthAlpha(b);
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(b.sx, b.sy, r, 0, Math.PI * 2);
      ctx.fill();

      if (b.id === selected && !faded) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isDark ? "#fff" : "#111";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.sx, b.sy, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // The node-names toggle is absolute: off means no text anywhere, including
    // department and subcategory hubs. Revealing hub labels by zoom regardless
    // made "off" look broken, since the biggest labels were the ones left on.
    if (settings.showLabels) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const b of order) {
        if (dimmed(b)) continue;
        const size = is3d ? Math.max(7, 11 * (b.scale / Math.max(camRef.current.zoom, 0.01))) : 11;
        ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`;
        ctx.globalAlpha = depthAlpha(b);
        ctx.fillStyle = isDark ? "rgba(226,232,240,0.9)" : "rgba(30,41,59,0.9)";
        const label = b.label.length > 28 ? `${b.label.slice(0, 27)}…` : b.label;
        ctx.fillText(label, b.sx, b.sy + b.r * nodeScale * b.scale + 3);
      }
      ctx.globalAlpha = 1;
    }
  }, [isDark, neighbours, focusCategoryId, selected, settings, neutral, project]);

  // The animation loop.
  useEffect(() => {
    const loop = () => {
      tick();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, draw]);

  // Keep the canvas backing store matched to its CSS size and DPR.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  /** Hit-test against the projected positions written by the last frame. */
  const hit = (sx: number, sy: number): Body | undefined => {
    const nodeScale = settings.nodeSize / 100;
    const bodies = bodiesRef.current;
    // In 3D the nearest body wins, so test front-to-back (largest projected
    // scale first); in 2D reverse draw order, so the dot on top is the one you
    // grab. Both orders match what was actually painted last at that pixel.
    const order = modeRef.current === "3d"
      ? [...bodies].sort((a, b) => b.scale - a.scale)
      : [...bodies].reverse();
    for (const b of order) {
      const r = Math.max(b.r * nodeScale * b.scale, 5);
      const dx = sx - b.sx;
      const dy = sy - b.sy;
      if (dx * dx + dy * dy <= r * r) return b;
    }
    return undefined;
  };

  const localPoint = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const { sx, sy } = localPoint(e);
    const body = hit(sx, sy);
    if (body) {
      body.fixed = true;
      dragRef.current = { mode: "node", body, sx, sy };
      return;
    }
    // In 3D an empty-space drag orbits the camera; hold shift to pan instead.
    // In 2D it pans, exactly as before.
    dragRef.current = {
      mode: modeRef.current === "3d" && !e.shiftKey ? "orbit" : "pan",
      sx, sy,
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { sx, sy } = localPoint(e);
    const drag = dragRef.current;

    if (drag.mode === "node" && drag.body) {
      const b = drag.body;
      const dx = sx - drag.sx;
      const dy = sy - drag.sy;
      drag.sx = sx;
      drag.sy = sy;
      if (modeRef.current === "2d") {
        b.x += dx / viewRef.current.k;
        b.y += dy / viewRef.current.k;
      } else {
        // Move the node in the camera's own plane at its current depth, then
        // rotate that offset back into world space — dragging a dot in 3D
        // should track the cursor rather than slide along an axis.
        const cam = camRef.current;
        const k = Math.max(b.scale, 0.01);
        const mx = dx / k;
        const my = dy / k;
        const cosX = Math.cos(cam.rotX), sinX = Math.sin(cam.rotX);
        const cosY = Math.cos(cam.rotY), sinY = Math.sin(cam.rotY);
        const wy = my * cosX;
        const rz1 = -my * sinX;
        b.x += mx * cosY - rz1 * sinY;
        b.y += wy;
        b.z += mx * sinY + rz1 * cosY;
      }
      alphaRef.current = Math.max(alphaRef.current, 0.35);
      return;
    }
    if (drag.mode === "orbit") {
      const cam = camRef.current;
      cam.rotY += (sx - drag.sx) * 0.006;
      // Stop just short of the poles, where the scene flips over.
      cam.rotX = Math.max(-1.45, Math.min(1.45, cam.rotX + (sy - drag.sy) * 0.006));
      drag.sx = sx;
      drag.sy = sy;
      setHover(null);
      return;
    }
    if (drag.mode === "pan") {
      if (modeRef.current === "2d") {
        const v = viewRef.current;
        v.x += sx - drag.sx;
        v.y += sy - drag.sy;
      } else {
        const cam = camRef.current;
        cam.panX += sx - drag.sx;
        cam.panY += sy - drag.sy;
      }
      drag.sx = sx;
      drag.sy = sy;
      setHover(null);
      return;
    }

    const body = hit(sx, sy);
    setHover(body ? { body, sx, sy } : null);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    // Release the node back to the simulation so the layout settles around it.
    if (drag.mode === "node" && drag.body) drag.body.fixed = false;
    dragRef.current = { mode: "none", sx: 0, sy: 0 };
  };

  const onClick = (e: React.MouseEvent) => {
    const { sx, sy } = localPoint(e);
    const body = hit(sx, sy);
    setSelected(body ? body.id : null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { sx, sy } = localPoint(e);
    const body = hit(sx, sy);
    if (!body) { onAddNode(null); return; }
    if (body.isCategory) return;
    onEditNode(body.refId);
  };

  const onWheel = (e: React.WheelEvent) => {
    const { sx, sy } = localPoint(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    if (modeRef.current === "2d") {
      const v = viewRef.current;
      const k = Math.min(6, Math.max(0.15, v.k * factor));
      // Zoom toward the cursor rather than the origin.
      v.x = sx - ((sx - v.x) / v.k) * k;
      v.y = sy - ((sy - v.y) / v.k) * k;
      v.k = k;
      return;
    }
    const cam = camRef.current;
    const { w, h } = sizeRef.current;
    const zoom = Math.min(6, Math.max(0.15, cam.zoom * factor));
    // Same cursor-anchored zoom, applied to the projected centre.
    const ax = sx - w / 2 - cam.panX;
    const ay = sy - h / 2 - cam.panY;
    cam.panX -= ax * (zoom / cam.zoom - 1);
    cam.panY -= ay * (zoom / cam.zoom - 1);
    cam.zoom = zoom;
  };

  const resetView = () => {
    viewRef.current = { x: 0, y: 0, k: 1 };
    camRef.current = { rotX: -0.35, rotY: 0.6, panX: 0, panY: 0, zoom: 1 };
    alphaRef.current = 1;
  };

  const hoverCard = hover && dragRef.current.mode === "none" ? hover : null;
  const cardBg = isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden rounded-xl">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => { endDrag(); setHover(null); }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
      />

      {/* Hover preview — type, title, and the two actions, without opening it. */}
      {hoverCard && (
        <div
          className={`absolute pointer-events-none rounded-lg border shadow-lg px-3 py-2 max-w-[240px] z-10 ${cardBg}`}
          style={{
            left: Math.min(hoverCard.sx + 14, Math.max(sizeRef.current.w - 250, 0)),
            top: Math.min(hoverCard.sy + 14, Math.max(sizeRef.current.h - 90, 0)),
          }}
        >
          <p className={`text-[10px] uppercase tracking-wide ${sub}`}>
            {hoverCard.body.isCategory
              ? t("dashboard", "brainGraphCategory")
              : hoverCard.body.kind === "entity_ref"
                // Generated keys don't survive an underscore, so the one
                // multi-word type names its key explicitly.
                ? t("dashboard", "brainTypeRecord")
                : t("dashboard", `brainType${hoverCard.body.kind.charAt(0).toUpperCase()}${hoverCard.body.kind.slice(1)}`)}
          </p>
          <p className="text-sm font-semibold leading-snug break-words">{hoverCard.body.label}</p>
          {!hoverCard.body.isCategory && (
            <p className={`text-[10px] mt-1 ${sub}`}>{t("dashboard", "brainGraphHint")}</p>
          )}
        </div>
      )}

      {/* Actions for the selected node, anchored bottom-left so they never sit
          under the cursor while you're tracing connections. */}
      {selected && (() => {
        const body = byIdRef.current.get(selected);
        if (!body || body.isCategory) return null;
        return (
          <div className={`absolute left-3 bottom-3 z-10 flex items-center gap-2 rounded-lg border shadow-lg px-3 py-2 ${cardBg}`}>
            <span className="text-sm font-semibold max-w-[180px] truncate">{body.label}</span>
            <button onClick={() => onOpenNode(body.refId)}
              className="text-xs font-semibold text-blue-500 hover:underline">
              {t("dashboard", "brainGraphOpen")}
            </button>
            <button onClick={() => onAddNode(body.refId)}
              className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:underline">
              <Plus className="h-3 w-3" />{t("dashboard", "brainGraphConnect")}
            </button>
          </div>
        );
      })()}

      {mode === "3d" && (
        <div className={`absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] shadow-sm pointer-events-none ${cardBg}`}>
          <Rotate3d className="h-3 w-3" />{t("dashboard", "brainGraph3dHint")}
        </div>
      )}

      <button onClick={resetView}
        className={`absolute right-3 bottom-3 z-10 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm ${cardBg}`}>
        <Maximize2 className="h-3 w-3" />{t("dashboard", "brainGraphReset")}
      </button>

      {bodiesRef.current.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className={`text-sm ${sub}`}>{t("dashboard", "brainGraphEmpty")}</p>
        </div>
      )}
    </div>
  );
}
