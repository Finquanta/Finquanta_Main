import { apiFetch } from './client';
import type { HealthScore } from './health';

/**
 * Company Brain — the business's knowledge base.
 *
 * Mirrors server/src/modules/brain. Categories organize the Brain, nodes are
 * the things in it (notes, tasks, links, pinned data views) and edges are the
 * connections between nodes. Nothing here costs an AI call.
 */

/** `entity_ref` points at a real ledger record and stores no figures of its own. */
export const NODE_TYPES = ['note', 'task', 'link', 'pin', 'entity_ref'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const ENTITY_TYPES = ['customer', 'invoice', 'entry', 'group'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  'relates_to', 'links_to', 'led_to', 'contradicts', 'depends_on', 'caused_by', 'mentions',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/** Archived nodes keep their connections but leave every view until restored. */
export type NodeStatus = 'active' | 'archived';
export type StatusFilter = NodeStatus | 'all';

export interface BrainCategory {
  id: string;
  name: string;
  role: string | null;
  /** Stable key for the 8 defaults ('finance', 'ceo'…). null when user-created. */
  slug: string | null;
  color: string;
  icon: string | null;
  parentCategoryId: string | null;
  isDefault: boolean;
  sortOrder: number;
  status: 'active' | 'archived';
  /** Nodes filed directly here. */
  nodeCount: number;
  /** Direct nodes plus everything in its subcategories. */
  totalCount: number;
  children: BrainCategory[];
}

export interface BrainNode {
  id: string;
  categoryId: string | null;
  type: NodeType;
  title: string;
  content: string | null;
  payload: Record<string, unknown>;
  summary: string | null;
  source: 'manual' | 'council' | 'system';
  status: NodeStatus;
  /** When it was archived, or null while it's active. */
  archivedAt: string | null;
  /** 'owners_admins' hides this node from everyone else entirely (spec §10). */
  accessOverride: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedNode {
  edgeId: string;
  /** The node at the other end, or null when the target is a department. */
  nodeId: string | null;
  /** Set when this edge points at a department rather than a node. */
  categoryTargetId?: string | null;
  title: string;
  type: NodeType | 'category';
  relationshipType: RelationshipType;
  /** 'system' means it came from a [[wiki link]] rather than the connection picker. */
  createdBy: 'user' | 'system' | 'ai_suggested';
  categoryId: string | null;
}

export interface BrainNodeDetail extends BrainNode {
  categoryName: string | null;
  /** Nodes this one points at. */
  links: LinkedNode[];
  /** Nodes that point at this one. */
  backlinks: LinkedNode[];
  /** Only on entity_ref nodes: the referenced record, resolved live on open. */
  entity?: ResolvedEntity | null;
}

// ---- Entity references ----------------------------------------------------

/**
 * A pointer at a ledger record. The Brain never copies the record — this is an
 * id, and everything shown beside it is read live, so it cannot go stale. When
 * the record is deleted the reference resolves with `exists: false` and the
 * user's note survives.
 */
export interface EntityRef {
  entityType: EntityType;
  entityId: string;
}

export interface ResolvedEntity extends EntityRef {
  exists: boolean;
  /** The record's current name, read live. Null when it's gone. */
  title: string | null;
  /** Raw status token; render known ones via `brainRefStatus_<status>`. */
  status: string | null;
  date: string | null;
  /** Live figures, labelled with `brainPin_<key>` like the department pins. */
  metrics: PinMetric[];
  href: string | null;
}

/** A record offered by the picker. */
export interface EntityCandidate extends EntityRef {
  title: string;
  subtitle: string | null;
  status: string | null;
  date: string | null;
  amount: number | null;
}

/** Brain access is separate from the financial role (spec §10). */
export const ACCESS_LEVELS = ['editor', 'commenter', 'viewer', 'none'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export interface BrainSettings {
  /** Costs an AI call per changed note — off until deliberately enabled. */
  autoSummarize: boolean;
  /** Postgres similarity only, so it's free and on by default. */
  autoLink: boolean;
  dailySummaryCap: number;
}

export interface BrainAccessMember {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  level: AccessLevel;
  /** False when the level is inherited from the member's role rather than set. */
  explicit: boolean;
}

export interface BrainOverview {
  categories: BrainCategory[];
  unassignedCount: number;
  /** Active nodes only — archived ones are counted separately. */
  totalNodes: number;
  archivedCount: number;
  /** What this member may do. The server enforces it regardless. */
  access?: { level: AccessLevel; canWrite: boolean };
  /** The ACTIVE workspace's name — changes when you switch workspace, unlike
   *  the onboarding profile, which is stored per user rather than per business. */
  businessName: string | null;
}

export interface NodeInput {
  title: string;
  content?: string | null;
  type?: NodeType;
  /** null or 'unassigned' both leave the node floating. */
  categoryId?: string | null;
  payload?: Record<string, unknown> | null;
  /** Draws a `relates_to` edge to this node on create. */
  connectToNodeId?: string | null;
  /** Draws a `relates_to` edge to this department on create. */
  connectToCategoryId?: string | null;
  /** Several connections at once — each entry targets a node or a department. */
  connections?: { nodeId?: string | null; categoryId?: string | null }[];
}

// ---- Graph ----------------------------------------------------------------

/**
 * One dot in the graph. Categories are nodes too, so ids are namespaced:
 * `n:<uuid>` for a real node, `c:<uuid>` for a department hub. `refId` is the
 * underlying row id — what you open or filter by when it's clicked.
 */
export interface GraphNode {
  id: string;
  refId: string;
  label: string;
  kind: NodeType | 'category';
  /** Root department, for colour and filtering. null = unassigned. */
  categoryId: string | null;
  color: string | null;
  /** Edges touching it — drives dot size and brightness. */
  degree: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: RelationshipType | 'belongs_to';
  createdBy: string;
}

export interface BrainGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: { id: string; name: string; color: string; slug: string | null; count: number }[];
  unassignedCount: number;
}

export const getBrainGraph = () => apiFetch<BrainGraph>('/v1/brain/graph');

// ---- Live data pins -------------------------------------------------------

export const PIN_KEYS = ['ceo', 'finance', 'sales', 'marketing', 'operations', 'engineering'] as const;
export type PinKey = (typeof PIN_KEYS)[number];

export interface PinMetric {
  /** Translation key for the label; render via t("dashboard", `brainPin_${key}`). */
  key: string;
  value: number | null;
  format: 'money' | 'number' | 'percent' | 'ratio';
}

export interface BrainPin {
  key: PinKey;
  /** False when there's nothing to show — e.g. no matching Business Group yet. */
  available: boolean;
  metrics: PinMetric[];
  health?: HealthScore;
  noteKey?: string;
}

// ---- Categories -----------------------------------------------------------

/** The category tree with live counts. Seeds the 8 defaults on first call. */
export const getBrainOverview = () => apiFetch<BrainOverview>('/v1/brain/overview');

export const createBrainCategory = (data: {
  name: string; role?: string | null; color?: string; icon?: string | null; parentCategoryId?: string | null;
}) => apiFetch<BrainCategory>('/v1/brain/categories', { method: 'POST', body: JSON.stringify(data) });

export const updateBrainCategory = (id: string, data: {
  name?: string; role?: string | null; color?: string; icon?: string | null; status?: 'active' | 'archived';
}) => apiFetch<BrainCategory>(`/v1/brain/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

/** Archives the category; its notes move to Unassigned rather than being deleted. */
export const removeBrainCategory = (id: string) =>
  apiFetch<{ id: string }>(`/v1/brain/categories/${id}`, { method: 'DELETE' });

export const reorderBrainCategories = (ids: string[]) =>
  apiFetch<{ ids: string[] }>('/v1/brain/categories/reorder', { method: 'POST', body: JSON.stringify({ ids }) });

// ---- Nodes ----------------------------------------------------------------

/** Pass categoryId 'unassigned' for the floating bucket, or omit for everything. */
export const listBrainNodes = (opts: {
  categoryId?: string | null; type?: NodeType; q?: string; includeSubcategories?: boolean;
  /** Server default is 'active'; pass 'archived' for the Archive. */
  status?: StatusFilter;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.categoryId !== undefined && opts.categoryId !== null) qs.set('categoryId', opts.categoryId);
  if (opts.categoryId === null) qs.set('categoryId', 'unassigned');
  if (opts.type) qs.set('type', opts.type);
  if (opts.q) qs.set('q', opts.q);
  if (opts.includeSubcategories === false) qs.set('includeSubcategories', 'false');
  if (opts.status) qs.set('status', opts.status);
  const q = qs.toString();
  return apiFetch<BrainNode[]>(`/v1/brain/nodes${q ? `?${q}` : ''}`);
};

export const getBrainNode = (id: string) => apiFetch<BrainNodeDetail>(`/v1/brain/nodes/${id}`);

export const createBrainNode = (data: NodeInput) =>
  apiFetch<BrainNode>('/v1/brain/nodes', { method: 'POST', body: JSON.stringify(data) });

export const updateBrainNode = (id: string, data: Partial<NodeInput> & { status?: NodeStatus }) =>
  apiFetch<BrainNode>(`/v1/brain/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

/**
 * Put a node in the Archive. It keeps its connections and comes back intact —
 * unlike deleteBrainNode, which drops the node and every edge touching it.
 */
export const archiveBrainNode = (id: string) => updateBrainNode(id, { status: 'archived' });

export const unarchiveBrainNode = (id: string) => updateBrainNode(id, { status: 'active' });

export const deleteBrainNode = (id: string) =>
  apiFetch<{ id: string }>(`/v1/brain/nodes/${id}`, { method: 'DELETE' });

/** Powers the connection picker as well as the search box. Archived notes are
 *  excluded unless asked for, so you can't wire a new note to something filed away. */
export const searchBrain = (q: string, limit = 20, status?: StatusFilter) =>
  apiFetch<BrainNode[]>(
    `/v1/brain/search?q=${encodeURIComponent(q)}&limit=${limit}${status ? `&status=${status}` : ''}`
  );

// ---- Edges ----------------------------------------------------------------

/** Connect a node to another note, or to a department — exactly one target. */
export const connectBrainNodes = (
  fromNodeId: string,
  target: { toNodeId?: string | null; toCategoryId?: string | null },
  relationshipType: RelationshipType = 'relates_to'
) => apiFetch<{ id: string }>('/v1/brain/edges', {
  method: 'POST',
  body: JSON.stringify({ fromNodeId, ...target, relationshipType }),
});

export const disconnectBrainNodes = (edgeId: string) =>
  apiFetch<{ id: string }>(`/v1/brain/edges/${edgeId}`, { method: 'DELETE' });

// ---- Pins -----------------------------------------------------------------

export const getBrainPins = (keys?: PinKey[]) =>
  apiFetch<BrainPin[]>(`/v1/brain/pins${keys?.length ? `?keys=${keys.join(',')}` : ''}`);

// ---- Enrichment settings + access (spec §7.1, §10) ------------------------

export const getBrainSettings = () => apiFetch<BrainSettings>('/v1/brain/settings');

export const updateBrainSettings = (data: Partial<BrainSettings>) =>
  apiFetch<BrainSettings>('/v1/brain/settings', { method: 'PATCH', body: JSON.stringify(data) });

/**
 * Run auto-linking (and summarization, if enabled) for one note right now,
 * skipping the 8s debounce. Obeys the same settings and caps as the background
 * pass, so it can't be used to get around them.
 */
export const enrichBrainNode = (id: string) =>
  apiFetch<{ linked: number; summarized: boolean; skipped: string | null }>(
    `/v1/brain/nodes/${id}/enrich`, { method: 'POST' }
  );

/** Owners and admins only. */
export const getBrainAccess = () =>
  apiFetch<{ members: BrainAccessMember[]; levels: AccessLevel[] }>('/v1/brain/access');

/** Pass null to clear the explicit level and fall back to the role default. */
export const setBrainAccess = (userId: string, level: AccessLevel | null) =>
  apiFetch<{ userId: string; level: AccessLevel | null }>(`/v1/brain/access/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ level }),
  });

/** Restrict a node to owners and admins, or clear the restriction with null. */
export const setNodeRestriction = (id: string, accessOverride: 'owners_admins' | null) =>
  apiFetch<BrainNode>(`/v1/brain/nodes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ accessOverride }),
  });

// ---- Entity references ----------------------------------------------------

/** Search invoices, customers, ledger entries and groups together. */
export const searchBrainEntities = (q: string, type: EntityType | 'all' = 'all', limit = 8) =>
  apiFetch<EntityCandidate[]>(
    `/v1/brain/entities/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`
  );

/** Resolve a page of references in one request rather than one per card. */
export const resolveBrainEntities = (refs: EntityRef[]) =>
  apiFetch<ResolvedEntity[]>('/v1/brain/entities/resolve', {
    method: 'POST',
    body: JSON.stringify({ refs }),
  });

/**
 * The "Add to Company Brain" action. Attaching a record that's already in the
 * Brain returns the existing node rather than creating a duplicate.
 */
export const attachEntityToBrain = (data: {
  entityType: EntityType;
  entityId: string;
  categoryId?: string | null;
  title?: string;
  content?: string | null;
  connections?: { nodeId?: string | null; categoryId?: string | null }[];
}) => apiFetch<BrainNode>('/v1/brain/entities/attach', {
  method: 'POST',
  body: JSON.stringify(data),
});

/** Pull the pointer out of a node's payload, or null if it isn't a reference. */
export function readEntityRef(node: Pick<BrainNode, 'type' | 'payload'>): EntityRef | null {
  if (node.type !== 'entity_ref') return null;
  const entityType = node.payload?.entityType;
  const entityId = node.payload?.entityId;
  if (typeof entityType !== 'string' || typeof entityId !== 'string') return null;
  if (!ENTITY_TYPES.includes(entityType as EntityType)) return null;
  return { entityType: entityType as EntityType, entityId };
}

// ---- Helpers --------------------------------------------------------------

/** Pull [[Wiki Links]] out of a note body, for highlighting them in the UI. */
export function parseWikiLinks(content: string | null | undefined): string[] {
  if (!content) return [];
  const found = new Map<string, string>();
  const re = /\[\[([^[\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const title = (m[1] ?? '').trim();
    if (title) found.set(title.toLowerCase(), title);
  }
  return [...found.values()];
}

/** Walk the category tree depth-first — the sidebar and pickers both need this. */
export function flattenCategories(categories: BrainCategory[]): BrainCategory[] {
  const out: BrainCategory[] = [];
  const walk = (list: BrainCategory[]) => {
    for (const c of list) {
      out.push(c);
      if (c.children.length) walk(c.children);
    }
  };
  walk(categories);
  return out;
}

export const formatPinValue = (m: PinMetric): string => {
  if (m.value === null) return '—';
  if (m.format === 'money') {
    return `$${m.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (m.format === 'percent') return `${m.value.toFixed(1)}%`;
  if (m.format === 'ratio') return `${m.value.toFixed(2)}×`;
  return m.value.toLocaleString();
};
