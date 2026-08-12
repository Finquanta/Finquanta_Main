import { PoolClient } from 'pg';
import { Database } from '../../infrastructure/database';
import { BrainEntitiesService, EntityRef, ResolvedEntity, readEntityRef } from './brain.entities';

/**
 * Company Brain — the business's knowledge graph.
 *
 * Three tables: categories (the 8 departments + user-made ones), nodes (notes,
 * tasks, links, pinned data views) and edges (the relationships between nodes).
 *
 * Category membership is deliberately NOT an edge. It lives on
 * `brain_nodes.category_id`, the same way Groups keeps assignment on the source
 * record rather than in a join table — one place to write, nothing to drift when
 * a category is renamed or archived. Edges are reserved for the relationships a
 * user (or later, the Council) actually draws between two pieces of knowledge.
 *
 * Everything here is deterministic code. No AI call is made on any path in this
 * file; the `summary` column exists for a later stage and stays null until then.
 */

/**
 * `entity_ref` is a pointer at a real record in the ledger — an invoice, a
 * customer, a journal entry, a group. It stores the id and nothing else; the
 * figures are resolved live on read. See brain.entities.ts for why it is a
 * pointer rather than a copy.
 */
/**
 * Where a node came from (spec §11), so the UI can show provenance — e.g. a
 * note the guided advisor drafted rather than one the user wrote by hand.
 * 'council' is reserved for the Finna Council (spec 07).
 */
export const NODE_SOURCES = ['manual', 'council', 'system'] as const;
export type NodeSource = (typeof NODE_SOURCES)[number];

export const NODE_TYPES = ['note', 'task', 'link', 'pin', 'entity_ref'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/**
 * `relates_to` is a user-drawn connection, `links_to` is generated from a
 * [[wiki link]] in a note's body. The rest are declared now because the Council
 * and the insight writer will emit them, and widening a CHECK later is worse
 * than allowing them from the start.
 */
export const RELATIONSHIP_TYPES = [
  'relates_to', 'links_to', 'led_to', 'contradicts', 'depends_on', 'caused_by', 'mentions',
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface BrainCategory {
  id: string;
  name: string;
  role: string | null;
  slug: string | null;
  color: string;
  icon: string | null;
  parentCategoryId: string | null;
  isDefault: boolean;
  sortOrder: number;
  status: 'active' | 'archived';
  /** Nodes filed directly in this category. */
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
  archivedAt: string | null;
  /** null = follows the member's Brain level; 'owners_admins' = restricted. */
  accessOverride: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shortest note worth paying to summarize — below this a note is already about
 * as short as its own summary would be.
 *
 * Lives here rather than in brain.enrich.ts so it can be returned to the client
 * on the settings payload: the Add Node modal counts down to it live, and a
 * second hardcoded copy in the frontend would drift the moment this changes.
 */
export const MIN_SUMMARY_CHARS = 100;

/** Per-business controls for the background enrichment in spec §7. */
export interface BrainSettings {
  /** Costs an AI call per changed note. Off until deliberately enabled. */
  autoSummarize: boolean;
  /** Pure Postgres similarity — no vendor, no cost, so on by default. */
  autoLink: boolean;
  dailySummaryCap: number;
  /** Read-only echo of MIN_SUMMARY_CHARS, so the client never hardcodes it. */
  minSummaryChars: number;
}

export const NODE_STATUSES = ['active', 'archived'] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

/** What a read should include. 'all' is only ever asked for explicitly. */
export type StatusFilter = NodeStatus | 'all';

export interface BrainEdge {
  id: string;
  fromNodeId: string;
  /** Exactly one of these is set. */
  toNodeId: string | null;
  toCategoryId: string | null;
  relationshipType: RelationshipType;
  createdBy: 'user' | 'system' | 'ai_suggested';
  createdAt: string;
}

/** A node plus the nodes on either end of its edges. */
export interface BrainNodeDetail extends BrainNode {
  categoryName: string | null;
  links: LinkedNode[];
  backlinks: LinkedNode[];
  /** Set only on entity_ref nodes: the referenced record, read live. */
  entity?: ResolvedEntity | null;
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
  createdBy: 'user' | 'system' | 'ai_suggested';
  categoryId: string | null;
}

export interface NodeInput {
  categoryId?: string | null;
  type?: NodeType;
  title: string;
  content?: string | null;
  payload?: Record<string, unknown> | null;
  /** Provenance (spec §11). Defaults to 'manual' — a person typed it. */
  source?: NodeSource;
}

/**
 * One dot in the graph. Categories appear as nodes too (spec §3.3), so ids are
 * namespaced — `n:<uuid>` for a real node, `c:<uuid>` for a category hub — and
 * `refId` carries the underlying row id for opening or filtering.
 */
export interface GraphNode {
  id: string;
  refId: string;
  label: string;
  kind: NodeType | 'category';
  /** Root department, for colour and filtering. null = unassigned. */
  categoryId: string | null;
  color: string | null;
  /** How many edges touch it — drives dot size and brightness. */
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

/**
 * The default structure every business starts with, in org-chart order: the CEO
 * at the top, down through the functions that win and serve customers, then
 * Finance and the functions that build and run things. `slug` is the stable key
 * — the live data pins look categories up by it, so renaming a category in the
 * UI never breaks its pin.
 */
const DEFAULT_CATEGORIES: {
  slug: string; name: string; role: string; color: string; children: string[];
}[] = [
  {
    slug: 'ceo', name: 'CEO', role: 'Makes the big decisions.', color: '#8b5cf6',
    children: ['Vision & Strategy', 'Goals & OKRs', 'Board & Investors', 'Company Decisions'],
  },
  {
    slug: 'marketing', name: 'Marketing', role: 'Suggests what to do, and learns from your feedback.', color: '#f97316',
    children: ['Social Media', 'Outreach', 'SEO/AEO', 'Advertising', 'Branding'],
  },
  {
    slug: 'sales', name: 'Sales', role: 'Converts leads, working hand-in-hand with Marketing.', color: '#ec4899',
    children: ['Pipeline & Leads', 'Outreach', 'Deals & Contracts', 'Customer Relationships'],
  },
  {
    slug: 'support', name: 'Support', role: 'Helps customers instantly.', color: '#14b8a6',
    children: ['Tickets & Issues', 'FAQs & Playbooks', 'Customer Feedback', 'Escalations'],
  },
  {
    slug: 'finance', name: 'Finance', role: 'Manages cash flow, invoices, and profit.', color: '#10b981',
    children: ['Accounting', 'Bookkeeping', 'Fundraising', 'Financial Planning'],
  },
  {
    slug: 'engineering', name: 'Engineering', role: 'Builds everything.', color: '#3b82f6',
    children: ['Product', 'Engineering', 'Infrastructure'],
  },
  {
    slug: 'operations', name: 'Operations', role: 'Keeps the business running.', color: '#f59e0b',
    children: ['Workflow & Automation', 'Vendors & Suppliers', 'Tools & Systems'],
  },
  {
    slug: 'compliance', name: 'Compliance & Legal', role: 'Keeps the business protected and above board.', color: '#ef4444',
    children: ['Contracts & Agreements', 'Licenses & Permits', 'Regulations & Requirements', 'Legal Notes'],
  },
];

/** The categories that render a live data pin, and which pin. See brain.pins.ts. */
export const PINNED_SLUGS = ['ceo', 'finance', 'sales', 'marketing', 'operations', 'engineering'] as const;

const kebab = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

/** Pull [[Wiki Links]] out of a note body. Nested brackets are not supported. */
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

export class BrainRepository {
  private entities: BrainEntitiesService;
  /** False when pg_trgm couldn't be installed; similarity falls back to FTS. */
  private trigramReady = false;

  constructor(private database: Database) {
    this.entities = new BrainEntitiesService(database);
  }

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL,
        name VARCHAR(120) NOT NULL,
        role TEXT,
        slug VARCHAR(60),
        color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
        icon VARCHAR(40),
        parent_category_id UUID REFERENCES brain_categories(id) ON DELETE CASCADE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL,
        category_id UUID REFERENCES brain_categories(id) ON DELETE SET NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'note',
        title VARCHAR(300) NOT NULL,
        content TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        summary TEXT,
        source VARCHAR(20) NOT NULL DEFAULT 'manual',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL,
        from_node_id UUID NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
        to_node_id UUID NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
        relationship_type VARCHAR(24) NOT NULL DEFAULT 'relates_to',
        created_by VARCHAR(16) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Archiving a node. Deleting is permanent and the user has to be sure;
    // archiving is the reversible middle ground — the note leaves every view
    // (lists, search, graph, tree, counts) but keeps its edges, so unarchiving
    // restores it fully wired rather than as a stranded orphan.
    await this.database.query(
      `ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`
    );
    await this.database.query(
      `ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE`
    );

    // Provenance (spec §11). Additive as well as being in CREATE TABLE above:
    // `brain_nodes` already exists on every deployed environment, so the
    // CREATE is a no-op there and the column would never appear — every
    // createNode INSERT would fail on a missing column.
    await this.database.query(
      `ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual'`
    );

    // Background enrichment (spec §7) and access control (§10).
    //
    // `content_hash` is what makes re-runs idempotent: enrichment only fires
    // when a note's text actually changed, never on a schedule and never on an
    // unchanged save. `access_override` restricts one node regardless of the
    // member's default Brain level.
    await this.database.query(
      `ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMP WITH TIME ZONE`
    );
    await this.database.query(
      `ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS content_hash TEXT`
    );
    await this.database.query(
      `ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS access_override VARCHAR(24)`
    );

    // Per-business enrichment settings. Auto-summarize defaults to FALSE so no
    // business spends a single AI call until someone deliberately turns it on;
    // auto-link defaults to TRUE because it costs nothing at all.
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_settings (
        business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
        auto_summarize BOOLEAN NOT NULL DEFAULT FALSE,
        auto_link BOOLEAN NOT NULL DEFAULT TRUE,
        daily_summary_cap INTEGER NOT NULL DEFAULT 50,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // A suggested link the user removed must stay removed. Without this the
    // next save would helpfully put it back, which is exactly the "putting
    // words in the user's notes" failure the spec warns against.
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_link_dismissals (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        from_node_id UUID NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
        to_node_id UUID NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (from_node_id, to_node_id)
      );
    `);

    // Brain access is deliberately SEPARATE from the financial role: a
    // Bookkeeper may need the books without seeing the CEO's decisions.
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS brain_access (
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level VARCHAR(16) NOT NULL DEFAULT 'editor',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (business_id, user_id)
      );
    `);

    // Trigram similarity powers auto-linking without an embeddings vendor.
    // CREATE EXTENSION needs privileges the app role may not have, so a failure
    // here is survivable: findSimilar falls back to full-text ranking, which is
    // already indexed above.
    try {
      await this.database.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await this.database.query(`
        CREATE INDEX IF NOT EXISTS idx_brain_nodes_trgm ON brain_nodes
          USING GIN ((coalesce(title, '') || ' ' || coalesce(content, '')) gin_trgm_ops)
      `);
      this.trigramReady = true;
    } catch {
      this.trigramReady = false;
    }

    // An edge can point at another node OR at a department. Departments live in
    // their own table, so the target is one column or the other and never both:
    // to_node_id is relaxed to nullable, to_category_id is added beside it, and
    // a CHECK keeps exactly one of them set.
    await this.database.query(
      `ALTER TABLE brain_edges ADD COLUMN IF NOT EXISTS to_category_id UUID
         REFERENCES brain_categories(id) ON DELETE CASCADE`
    );
    await this.database.query(`ALTER TABLE brain_edges ALTER COLUMN to_node_id DROP NOT NULL`);
    await this.database.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'brain_edges_one_target'
        ) THEN
          ALTER TABLE brain_edges ADD CONSTRAINT brain_edges_one_target
            CHECK (num_nonnulls(to_node_id, to_category_id) = 1);
        END IF;
      END $$;
    `);

    // Indexes. The partial unique index on (business_id, slug) is what makes
    // seeding the defaults idempotent — a second boot, or two dashboard loads
    // racing each other, can't produce two "Finance" categories.
    await this.database.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_categories_slug
         ON brain_categories(business_id, slug) WHERE slug IS NOT NULL`
    );
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_categories_business ON brain_categories(business_id, sort_order)`
    );
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_nodes_category ON brain_nodes(business_id, category_id)`
    );
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_nodes_type ON brain_nodes(business_id, type)`
    );
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_nodes_title ON brain_nodes(business_id, lower(title))`
    );
    // Every list, count and graph read filters on status, so it leads the index.
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_nodes_status ON brain_nodes(business_id, status)`
    );
    // Full-text over title + body, for search across every node type.
    await this.database.query(`
      CREATE INDEX IF NOT EXISTS idx_brain_nodes_fts ON brain_nodes
        USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')))
    `);
    // One edge per (from, to, kind): re-saving a note whose body still contains
    // the same [[link]] must update, not accumulate. Two partial indexes rather
    // than one, because a NULL target column never collides in a plain unique
    // index — node targets and category targets each need their own.
    // The original index had no predicate, and CREATE ... IF NOT EXISTS would
    // keep that old definition forever. Drop it by name and build the two
    // predicated ones; both DROP and CREATE are no-ops on later boots.
    await this.database.query(`DROP INDEX IF EXISTS idx_brain_edges_unique`);
    await this.database.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_edges_node_target
         ON brain_edges(from_node_id, to_node_id, relationship_type)
         WHERE to_node_id IS NOT NULL`
    );
    await this.database.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_edges_cat_target
         ON brain_edges(from_node_id, to_category_id, relationship_type)
         WHERE to_category_id IS NOT NULL`
    );
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_edges_to ON brain_edges(to_node_id)`
    );
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_brain_edges_business ON brain_edges(business_id)`
    );

    // The engineering department shipped as "Development/Engineering", which is
    // a mouthful in a sidebar and unreadable as a graph label. Rename the ones
    // already seeded — but only where the name is still the original default,
    // so a business that renamed it themselves keeps their own wording.
    await this.database.query(
      `UPDATE brain_categories SET name = 'Engineering', updated_at = NOW()
        WHERE slug = 'engineering' AND is_default = TRUE AND name = 'Development/Engineering'`
    );

    // business_id is declared NOT NULL but needs the FK to cascade, or deleting
    // a workspace strands every note in it — invisible, since all reads scope by
    // business_id, but it keeps the user's own writing forever. Same guard the
    // groups table uses: ADD CONSTRAINT has no IF NOT EXISTS, so check the
    // catalogue to keep this idempotent across boots.
    for (const table of ['brain_categories', 'brain_nodes', 'brain_edges']) {
      await this.database.query(
        `DELETE FROM ${table} WHERE business_id NOT IN (SELECT id FROM businesses)`
      );
      await this.database.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${table}_business_id_fkey'
          ) THEN
            ALTER TABLE ${table}
              ADD CONSTRAINT ${table}_business_id_fkey
              FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);
    }
  }

  /**
   * Seed the 8 default departments and their subcategories for a business.
   *
   * Called lazily on the first read rather than as a boot-time backfill, so
   * businesses that existed before the Brain shipped get theirs when they first
   * open the tab — no migration script, and no work for businesses that never
   * use the feature. ON CONFLICT DO NOTHING against the (business_id, slug)
   * unique index makes it safe to call on every request.
   */
  async ensureDefaults(businessId: string): Promise<void> {
    await this.database.transaction(async (client) => {
      for (const [index, cat] of DEFAULT_CATEGORIES.entries()) {
        const parent = await client.query(
          `INSERT INTO brain_categories (business_id, name, role, slug, color, is_default, sort_order)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6)
           ON CONFLICT (business_id, slug) WHERE slug IS NOT NULL DO NOTHING
           RETURNING id`,
          [businessId, cat.name, cat.role, cat.slug, cat.color, index]
        );

        // No row back means it already existed — look it up so the children can
        // still be seeded (a boot that failed halfway must be able to finish).
        let parentId: string | undefined = parent.rows[0]?.id;
        if (!parentId) {
          const existing = await client.query(
            `SELECT id FROM brain_categories WHERE business_id = $1 AND slug = $2`,
            [businessId, cat.slug]
          );
          parentId = existing.rows[0]?.id;
        }
        if (!parentId) continue;

        for (const [childIndex, childName] of cat.children.entries()) {
          await client.query(
            `INSERT INTO brain_categories
               (business_id, name, slug, color, parent_category_id, is_default, sort_order)
             VALUES ($1, $2, $3, $4, $5, TRUE, $6)
             ON CONFLICT (business_id, slug) WHERE slug IS NOT NULL DO NOTHING`,
            [businessId, childName, `${cat.slug}.${kebab(childName)}`, cat.color, parentId, childIndex]
          );
        }
      }
    });
  }

  private mapCategory(row: any): BrainCategory {
    return {
      id: row.id,
      name: row.name,
      role: row.role ?? null,
      slug: row.slug ?? null,
      color: row.color,
      icon: row.icon ?? null,
      parentCategoryId: row.parent_category_id ?? null,
      isDefault: row.is_default === true,
      sortOrder: Number(row.sort_order) || 0,
      status: row.status,
      nodeCount: Number(row.node_count) || 0,
      totalCount: Number(row.node_count) || 0,
      children: [],
    };
  }

  private mapNode(row: any): BrainNode {
    return {
      id: row.id,
      categoryId: row.category_id ?? null,
      type: row.type,
      title: row.title,
      content: row.content ?? null,
      payload: row.payload ?? {},
      summary: row.summary ?? null,
      source: row.source,
      status: row.status ?? 'active',
      archivedAt: row.archived_at ?? null,
      accessOverride: row.access_override ?? null,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * The whole category tree with live node counts, plus the count of nodes that
   * belong to no category at all. One grouped query, not one per category.
   */
  async getOverview(
    businessId: string, includeArchived = false, restrict?: string
  ): Promise<{
    categories: BrainCategory[];
    unassignedCount: number;
    totalNodes: number;
    /** Archived nodes, so the sidebar can offer the Archive without a second read. */
    archivedCount: number;
    /** The ACTIVE workspace's name. Unlike the onboarding profile — which is
     *  keyed by user, not business — this changes when you switch workspace. */
    businessName: string | null;
  }> {
    // The join filters archived NODES out of the per-category counts; the
    // `includeArchived` flag is about archived CATEGORIES and is separate.
    // Every count the sidebar shows is a count of what you can actually see.
    const result = await this.database.query(
      `SELECT c.id, c.name, c.role, c.slug, c.color, c.icon, c.parent_category_id,
              c.is_default, c.sort_order, c.status,
              COUNT(n.id) AS node_count
         FROM brain_categories c
         LEFT JOIN brain_nodes n
           ON n.category_id = c.id AND n.status = 'active' AND ${restrict || 'TRUE'}
        WHERE c.business_id = $1
          AND ($2::boolean OR c.status = 'active')
        GROUP BY c.id
        ORDER BY c.sort_order, c.name`,
      [businessId, includeArchived]
    );

    const all: BrainCategory[] = result.rows.map((r: any) => this.mapCategory(r));
    const byId = new Map<string, BrainCategory>(all.map((c) => [c.id, c] as const));

    const roots: BrainCategory[] = [];
    for (const cat of all) {
      const parent = cat.parentCategoryId ? byId.get(cat.parentCategoryId) : undefined;
      if (parent) {
        parent.children.push(cat);
        parent.totalCount += cat.nodeCount;
      } else {
        roots.push(cat);
      }
    }

    const [counts, business] = await Promise.all([
      this.database.query(
        `SELECT COUNT(*) FILTER (WHERE category_id IS NULL AND status = 'active') AS unassigned,
                COUNT(*) FILTER (WHERE status = 'active')   AS total,
                COUNT(*) FILTER (WHERE status = 'archived') AS archived
           FROM brain_nodes n WHERE business_id = $1 AND ${restrict || 'TRUE'}`,
        [businessId]
      ),
      this.database.query(`SELECT name FROM businesses WHERE id = $1`, [businessId]),
    ]);

    return {
      categories: roots,
      unassignedCount: Number(counts.rows[0]?.unassigned) || 0,
      totalNodes: Number(counts.rows[0]?.total) || 0,
      archivedCount: Number(counts.rows[0]?.archived) || 0,
      businessName: business.rows[0]?.name ?? null,
    };
  }

  async createCategory(
    businessId: string,
    input: { name: string; role?: string | null; color?: string; icon?: string | null; parentCategoryId?: string | null }
  ): Promise<BrainCategory | null> {
    // Two levels only. A subcategory can't itself have children — the spec is
    // explicit that arbitrary nesting is not worth the UI complexity.
    if (input.parentCategoryId) {
      const parent = await this.database.query(
        `SELECT parent_category_id FROM brain_categories WHERE id = $1 AND business_id = $2`,
        [input.parentCategoryId, businessId]
      );
      if (parent.rows.length === 0) return null;
      if (parent.rows[0].parent_category_id) return null;
    }

    const next = await this.database.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM brain_categories
        WHERE business_id = $1 AND parent_category_id IS NOT DISTINCT FROM $2`,
      [businessId, input.parentCategoryId ?? null]
    );

    const result = await this.database.query(
      `INSERT INTO brain_categories (business_id, name, role, color, icon, parent_category_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *, 0 AS node_count`,
      [
        businessId, input.name, input.role ?? null, input.color ?? '#3b82f6',
        input.icon ?? null, input.parentCategoryId ?? null, Number(next.rows[0]?.n) || 0,
      ]
    );
    return this.mapCategory(result.rows[0]);
  }

  async updateCategory(
    businessId: string,
    id: string,
    input: { name?: string; role?: string | null; color?: string; icon?: string | null; status?: 'active' | 'archived'; parentCategoryId?: string | null }
  ): Promise<BrainCategory | null> {
    const sets: string[] = [];
    const values: any[] = [];
    const push = (col: string, value: any) => { values.push(value); sets.push(`${col} = $${values.length}`); };

    if (input.name !== undefined) push('name', input.name);
    if (input.role !== undefined) push('role', input.role);
    if (input.color !== undefined) push('color', input.color);
    if (input.icon !== undefined) push('icon', input.icon);
    if (input.status !== undefined) push('status', input.status);
    if (input.parentCategoryId !== undefined) push('parent_category_id', input.parentCategoryId);
    if (sets.length === 0) return this.getCategory(businessId, id);

    values.push(id, businessId);
    const result = await this.database.query(
      `UPDATE brain_categories SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length - 1} AND business_id = $${values.length}
        RETURNING *, 0 AS node_count`,
      values
    );
    return result.rows[0] ? this.mapCategory(result.rows[0]) : null;
  }

  async getCategory(businessId: string, id: string): Promise<BrainCategory | null> {
    const result = await this.database.query(
      `SELECT *, (SELECT COUNT(*) FROM brain_nodes n WHERE n.category_id = c.id) AS node_count
         FROM brain_categories c WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    return result.rows[0] ? this.mapCategory(result.rows[0]) : null;
  }

  /**
   * Removing a category archives it and re-homes its content to Unassigned —
   * it never destroys anything the user wrote. Subcategories go with the parent.
   */
  async archiveCategory(businessId: string, id: string): Promise<boolean> {
    return this.database.transaction(async (client) => {
      const found = await client.query(
        `SELECT id FROM brain_categories WHERE id = $1 AND business_id = $2`,
        [id, businessId]
      );
      if (found.rows.length === 0) return false;

      const ids = await client.query(
        `SELECT id FROM brain_categories
          WHERE business_id = $1 AND (id = $2 OR parent_category_id = $2)`,
        [businessId, id]
      );
      const all = ids.rows.map((r: any) => r.id);

      await client.query(
        `UPDATE brain_nodes SET category_id = NULL, updated_at = NOW()
          WHERE business_id = $1 AND category_id = ANY($2::uuid[])`,
        [businessId, all]
      );
      await client.query(
        `UPDATE brain_categories SET status = 'archived', updated_at = NOW()
          WHERE business_id = $1 AND id = ANY($2::uuid[])`,
        [businessId, all]
      );
      return true;
    });
  }

  /** Persist a new display order. Ids not belonging to the business are ignored. */
  async reorderCategories(businessId: string, ids: string[]): Promise<void> {
    await this.database.transaction(async (client) => {
      for (const [index, id] of ids.entries()) {
        await client.query(
          `UPDATE brain_categories SET sort_order = $1, updated_at = NOW()
            WHERE id = $2 AND business_id = $3`,
          [index, id, businessId]
        );
      }
    });
  }

  async listNodes(
    businessId: string,
    filter: {
      categoryId?: string | null; includeSubcategories?: boolean; type?: NodeType; q?: string;
      /** Defaults to 'active' — archived nodes are opt-in on every read. */
      status?: StatusFilter;
      /** SQL visibility fragment from BrainAccessService.visibilityClause(). */
      restrict?: string;
    } = {}
  ): Promise<BrainNode[]> {
    const where: string[] = ['n.business_id = $1'];
    const values: any[] = [businessId];

    // Access filter (spec §10). Generated by BrainAccessService from the
    // caller's level — never from request input — so it carries no injection
    // surface. Omitted means unrestricted, which is what internal callers
    // (enrichment, pins) want.
    if (filter.restrict) where.push(filter.restrict);

    const status = filter.status ?? 'active';
    if (status !== 'all') {
      values.push(status);
      where.push(`n.status = $${values.length}`);
    }

    if (filter.categoryId === null) {
      where.push('n.category_id IS NULL');
    } else if (filter.categoryId) {
      values.push(filter.categoryId);
      where.push(
        filter.includeSubcategories
          ? `(n.category_id = $${values.length} OR n.category_id IN (
               SELECT id FROM brain_categories WHERE parent_category_id = $${values.length}))`
          : `n.category_id = $${values.length}`
      );
    }
    if (filter.type) {
      values.push(filter.type);
      where.push(`n.type = $${values.length}`);
    }
    if (filter.q?.trim()) {
      values.push(`%${filter.q.trim()}%`, filter.q.trim());
      where.push(
        `(n.title ILIKE $${values.length - 1}
          OR to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content, ''))
             @@ websearch_to_tsquery('english', $${values.length}))`
      );
    }

    const result = await this.database.query(
      `SELECT n.* FROM brain_nodes n
        WHERE ${where.join(' AND ')}
        ORDER BY n.updated_at DESC
        LIMIT 500`,
      values
    );
    return result.rows.map((r: any) => this.mapNode(r));
  }

  /**
   * Search every node type by title and body.
   *
   * ILIKE on the title carries the connection picker (it has to match halfway
   * through a word as the user types, which full-text stemming will not do);
   * the tsquery half searches note bodies through the GIN index.
   * websearch_to_tsquery is used rather than to_tsquery because it never throws
   * on whatever the user happens to type.
   */
  async search(
    businessId: string, q: string, limit = 20, status: StatusFilter = 'active',
    restrict?: string
  ): Promise<BrainNode[]> {
    const term = q.trim();
    if (!term) return [];
    const result = await this.database.query(
      `SELECT * FROM brain_nodes n
        WHERE business_id = $1
          AND ${restrict || 'TRUE'}
          AND ($5 = 'all' OR status = $5)
          AND (title ILIKE $2
               OR to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
                  @@ websearch_to_tsquery('english', $3))
        ORDER BY (title ILIKE $2) DESC, updated_at DESC
        LIMIT $4`,
      [businessId, `%${term}%`, term, Math.min(Math.max(limit, 1), 100), status]
    );
    return result.rows.map((r: any) => this.mapNode(r));
  }

  async getNode(
    businessId: string, id: string, restrict?: string
  ): Promise<BrainNodeDetail | null> {
    // A restricted node returns null, which the route turns into a 404 — the
    // same answer as a node that doesn't exist. A 403 would confirm that
    // something is there, which is the leak §10 is trying to close.
    const result = await this.database.query(
      `SELECT n.*, c.name AS category_name
         FROM brain_nodes n
         LEFT JOIN brain_categories c ON c.id = n.category_id
        WHERE n.id = $1 AND n.business_id = $2 AND ${restrict || 'TRUE'}`,
      [id, businessId]
    );
    if (result.rows.length === 0) return null;

    const [links, categoryLinks, backlinks] = await Promise.all([
      // Restricted nodes are filtered out of BOTH directions. A note you can't
      // open must not show up as a link on a note you can — the title alone
      // ("Letting go of the CFO") is most of what §10 is protecting.
      this.database.query(
        `SELECT e.id AS edge_id, e.relationship_type, e.created_by,
                n.id AS node_id, n.title, n.type, n.category_id
           FROM brain_edges e JOIN brain_nodes n ON n.id = e.to_node_id
          WHERE e.from_node_id = $1 AND ${restrict || 'TRUE'} ORDER BY n.title`,
        [id]
      ),
      // Edges this node draws to a department rather than to another note.
      this.database.query(
        `SELECT e.id AS edge_id, e.relationship_type, e.created_by,
                c.id AS category_target_id, c.name AS title
           FROM brain_edges e JOIN brain_categories c ON c.id = e.to_category_id
          WHERE e.from_node_id = $1 ORDER BY c.name`,
        [id]
      ),
      this.database.query(
        `SELECT e.id AS edge_id, e.relationship_type, e.created_by,
                n.id AS node_id, n.title, n.type, n.category_id
           FROM brain_edges e JOIN brain_nodes n ON n.id = e.from_node_id
          WHERE e.to_node_id = $1 AND ${restrict || 'TRUE'} ORDER BY n.title`,
        [id]
      ),
    ]);

    const mapLink = (r: any): LinkedNode => ({
      edgeId: r.edge_id,
      nodeId: r.node_id ?? null,
      categoryTargetId: r.category_target_id ?? null,
      title: r.title,
      type: r.category_target_id ? 'category' : r.type,
      relationshipType: r.relationship_type,
      createdBy: r.created_by,
      categoryId: r.category_id ?? null,
    });

    const node = this.mapNode(result.rows[0]);

    // A reference node carries only a pointer, so the record it points at is
    // read here, at open time. `exists: false` comes back when the record has
    // been deleted — the node and everything the user wrote about it survive.
    const ref = node.type === 'entity_ref' ? readEntityRef(node.payload) : null;
    const entity = ref ? await this.entities.resolve(businessId, ref) : null;

    return {
      ...node,
      categoryName: result.rows[0].category_name ?? null,
      links: [...links.rows.map(mapLink), ...categoryLinks.rows.map(mapLink)],
      backlinks: backlinks.rows.map(mapLink),
      entity,
    };
  }

  /**
   * The whole Brain as a graph, in three queries.
   *
   * Two things are synthesized here rather than stored, both deliberately:
   * category hubs become nodes (so a department is something you can see and
   * click in the graph), and each node gets a `belongs_to` edge to its category.
   * Storing those as real edge rows would mean a second place to keep in sync
   * every time a note is refiled — `brain_nodes.category_id` stays the one
   * source of truth and the shape is rebuilt on read.
   *
   * Colour follows the ROOT department, not the subcategory, so a note filed
   * under Finance › Bookkeeping still reads as Finance green in the graph.
   */
  async getGraph(businessId: string, restrict?: string): Promise<BrainGraph> {
    const [nodeRows, edgeRows, categoryRows] = await Promise.all([
      this.database.query(
        `SELECT n.id, n.title, n.type, n.category_id,
                COALESCE(parent.id, c.id)       AS root_id,
                COALESCE(parent.color, c.color) AS root_color
           FROM brain_nodes n
           LEFT JOIN brain_categories c      ON c.id = n.category_id
           LEFT JOIN brain_categories parent ON parent.id = c.parent_category_id
          WHERE n.business_id = $1 AND n.status = 'active'
            AND ${restrict || 'TRUE'}`,
        [businessId]
      ),
      this.database.query(
        `SELECT id, from_node_id, to_node_id, to_category_id, relationship_type, created_by
           FROM brain_edges WHERE business_id = $1`,
        [businessId]
      ),
      this.database.query(
        `SELECT c.id, c.name, c.color, c.slug, c.parent_category_id,
                COUNT(n.id) AS node_count
           FROM brain_categories c
           LEFT JOIN brain_nodes n ON n.category_id = c.id AND n.status = 'active'
          WHERE c.business_id = $1 AND c.status = 'active'
          GROUP BY c.id
          ORDER BY c.sort_order`,
        [businessId]
      ),
    ]);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const degree = new Map<string, number>();
    const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);

    // Category hubs first, so a department with no notes still shows as a dot.
    const categoryIds = new Set<string>();
    for (const row of categoryRows.rows) {
      const id = `c:${row.id}`;
      categoryIds.add(row.id);
      nodes.push({
        id, refId: row.id, label: row.name, kind: 'category',
        categoryId: row.parent_category_id ?? row.id, color: row.color, degree: 0,
      });
      if (row.parent_category_id) {
        edges.push({
          id: `sub:${row.id}`, from: id, to: `c:${row.parent_category_id}`,
          kind: 'belongs_to', createdBy: 'system',
        });
        bump(id);
        bump(`c:${row.parent_category_id}`);
      }
    }

    // The org chart: CEO sits at the top and every other department hangs off
    // it, so the graph is one connected structure instead of eight islands.
    // Without a CEO category (archived or renamed away) the departments simply
    // stay unlinked rather than being forced under an arbitrary substitute.
    const topLevel = categoryRows.rows.filter((r: any) => !r.parent_category_id);
    const ceo = topLevel.find((r: any) => r.slug === 'ceo');
    if (ceo) {
      for (const dept of topLevel) {
        if (dept.id === ceo.id) continue;
        edges.push({
          id: `org:${dept.id}`, from: `c:${ceo.id}`, to: `c:${dept.id}`,
          kind: 'belongs_to', createdBy: 'system',
        });
        bump(`c:${ceo.id}`);
        bump(`c:${dept.id}`);
      }
    }

    for (const row of nodeRows.rows) {
      const id = `n:${row.id}`;
      nodes.push({
        id, refId: row.id, label: row.title, kind: row.type,
        categoryId: row.root_id ?? null, color: row.root_color ?? null, degree: 0,
      });
      // Only link to a category that actually came back as active — a node
      // whose category was archived is an orphan, which is honest and useful.
      if (row.category_id && categoryIds.has(row.category_id)) {
        edges.push({
          id: `bt:${row.id}`, from: id, to: `c:${row.category_id}`,
          kind: 'belongs_to', createdBy: 'system',
        });
        bump(id);
        bump(`c:${row.category_id}`);
      }
    }

    const present = new Set(nodes.map((n) => n.id));
    for (const row of edgeRows.rows) {
      const from = `n:${row.from_node_id}`;
      // A user-drawn edge points at another note or at a department hub.
      const to = row.to_category_id ? `c:${row.to_category_id}` : `n:${row.to_node_id}`;
      if (!present.has(from) || !present.has(to)) continue;
      edges.push({
        id: row.id, from, to, kind: row.relationship_type, createdBy: row.created_by,
      });
      bump(from);
      bump(to);
    }

    for (const node of nodes) node.degree = degree.get(node.id) ?? 0;

    // The panel lists departments, so counts roll subcategories up into their
    // parent — "Finance 18" means everything under Finance, not just what was
    // filed at the top level.
    const perDepartment = new Map<string, number>();
    for (const row of nodeRows.rows) {
      if (!row.root_id) continue;
      perDepartment.set(row.root_id, (perDepartment.get(row.root_id) ?? 0) + 1);
    }

    return {
      nodes,
      edges,
      categories: categoryRows.rows
        .filter((r: any) => !r.parent_category_id)
        .map((r: any) => ({
          id: r.id, name: r.name, color: r.color, slug: r.slug ?? null,
          count: perDepartment.get(r.id) ?? 0,
        })),
      unassignedCount: nodeRows.rows.filter((r: any) => !r.category_id).length,
    };
  }

  /**
   * `connectTo` is a list: a node can be wired to several notes and departments
   * at once, all inside the same transaction as the insert, so a new node never
   * lands half-connected.
   */
  async createNode(
    businessId: string,
    userId: string | null,
    input: NodeInput,
    connectTo?: { nodeId?: string | null; categoryId?: string | null }[] | null
  ): Promise<BrainNode> {
    return this.database.transaction(async (client) => {
      const categoryId = await this.resolveCategory(client, businessId, input.categoryId);

      const result = await client.query(
        `INSERT INTO brain_nodes (business_id, category_id, type, title, content, payload, created_by, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          businessId, categoryId, input.type ?? 'note', input.title,
          input.content ?? null, JSON.stringify(input.payload ?? {}), userId,
          input.source ?? 'manual',
        ]
      );
      const node = this.mapNode(result.rows[0]);

      for (const target of connectTo ?? []) {
        if (target?.nodeId) {
          await this.linkNodes(client, businessId, node.id, target.nodeId, 'relates_to', 'user');
        } else if (target?.categoryId) {
          // Connecting to a department is a real edge, separate from which
          // category the node is filed in — a Finance note can point at
          // Marketing without leaving Finance.
          const cat = await client.query(
            `SELECT id FROM brain_categories WHERE id = $1 AND business_id = $2`,
            [target.categoryId, businessId]
          );
          if (cat.rows.length > 0) {
            await client.query(
              `INSERT INTO brain_edges
                 (business_id, from_node_id, to_category_id, relationship_type, created_by)
               VALUES ($1, $2, $3, 'relates_to', 'user')
               ON CONFLICT (from_node_id, to_category_id, relationship_type)
                 WHERE to_category_id IS NOT NULL DO NOTHING`,
              [businessId, node.id, target.categoryId]
            );
          }
        }
      }
      await this.syncWikiLinks(client, businessId, node.id, input.content);
      return node;
    });
  }

  async updateNode(
    businessId: string, id: string,
    input: Partial<NodeInput> & { status?: NodeStatus; accessOverride?: string | null }
  ): Promise<BrainNode | null> {
    return this.database.transaction(async (client) => {
      const sets: string[] = [];
      const values: any[] = [];
      const push = (col: string, value: any) => { values.push(value); sets.push(`${col} = $${values.length}`); };

      if (input.title !== undefined) push('title', input.title);
      if (input.content !== undefined) push('content', input.content);
      if (input.type !== undefined) push('type', input.type);
      if (input.payload !== undefined) push('payload', JSON.stringify(input.payload ?? {}));
      if (input.categoryId !== undefined) {
        push('category_id', await this.resolveCategory(client, businessId, input.categoryId));
      }
      // archived_at moves with status so the Archive can be sorted by when
      // things were put away, and unarchiving leaves no stale timestamp behind.
      if (input.status !== undefined) {
        push('status', input.status);
        push('archived_at', input.status === 'archived' ? new Date() : null);
      }
      if (input.accessOverride !== undefined) push('access_override', input.accessOverride);
      if (sets.length === 0) {
        const current = await client.query(
          `SELECT * FROM brain_nodes WHERE id = $1 AND business_id = $2`, [id, businessId]
        );
        return current.rows[0] ? this.mapNode(current.rows[0]) : null;
      }

      values.push(id, businessId);
      const result = await client.query(
        `UPDATE brain_nodes SET ${sets.join(', ')}, updated_at = NOW()
          WHERE id = $${values.length - 1} AND business_id = $${values.length}
          RETURNING *`,
        values
      );
      if (result.rows.length === 0) return null;

      if (input.content !== undefined) {
        await this.syncWikiLinks(client, businessId, id, input.content);
      }
      return this.mapNode(result.rows[0]);
    });
  }

  /**
   * The existing reference node for a record, if there is one.
   *
   * Attaching the same invoice twice should take you to the note you already
   * wrote about it, not leave two dots on the graph pointing at one record.
   * Archived references count as found: the answer to "attach this again" is
   * to surface the one in the Archive, not to make a second.
   */
  async findEntityNode(businessId: string, ref: EntityRef): Promise<BrainNode | null> {
    const result = await this.database.query(
      `SELECT * FROM brain_nodes
        WHERE business_id = $1 AND type = 'entity_ref'
          AND payload->>'entityType' = $2 AND payload->>'entityId' = $3
        ORDER BY created_at
        LIMIT 1`,
      [businessId, ref.entityType, ref.entityId]
    );
    return result.rows[0] ? this.mapNode(result.rows[0]) : null;
  }

  async deleteNode(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM brain_nodes WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId]
    );
    return result.rows.length > 0;
  }

  /**
   * Connect a node to another node, or to a department. Exactly one of
   * `toNodeId` / `toCategoryId` is used; whichever is given must belong to the
   * same business, or an id could be guessed to link into another workspace.
   */
  async createEdge(
    businessId: string,
    fromNodeId: string,
    target: { toNodeId?: string | null; toCategoryId?: string | null },
    relationshipType: RelationshipType = 'relates_to'
  ): Promise<BrainEdge | null> {
    const toNodeId = target.toNodeId ?? null;
    const toCategoryId = target.toCategoryId ?? null;
    if ((toNodeId === null) === (toCategoryId === null)) return null;
    if (toNodeId === fromNodeId) return null;

    const ids = toNodeId ? [fromNodeId, toNodeId] : [fromNodeId];
    const owned = await this.database.query(
      `SELECT COUNT(*)::int AS n FROM brain_nodes WHERE business_id = $1 AND id = ANY($2::uuid[])`,
      [businessId, ids]
    );
    if (owned.rows[0]?.n !== ids.length) return null;

    if (toCategoryId) {
      const cat = await this.database.query(
        `SELECT id FROM brain_categories WHERE id = $1 AND business_id = $2`,
        [toCategoryId, businessId]
      );
      if (cat.rows.length === 0) return null;
    }

    const conflict = toNodeId
      ? 'ON CONFLICT (from_node_id, to_node_id, relationship_type) WHERE to_node_id IS NOT NULL'
      : 'ON CONFLICT (from_node_id, to_category_id, relationship_type) WHERE to_category_id IS NOT NULL';

    const result = await this.database.query(
      `INSERT INTO brain_edges
         (business_id, from_node_id, to_node_id, to_category_id, relationship_type, created_by)
       VALUES ($1, $2, $3, $4, $5, 'user')
       ${conflict} DO UPDATE SET relationship_type = EXCLUDED.relationship_type
       RETURNING *`,
      [businessId, fromNodeId, toNodeId, toCategoryId, relationshipType]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      fromNodeId: row.from_node_id,
      toNodeId: row.to_node_id ?? null,
      toCategoryId: row.to_category_id ?? null,
      relationshipType: row.relationship_type,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  /**
   * Removing a SUGGESTED link also records that the user said no, so the next
   * save doesn't put it straight back. A link the user drew themselves just
   * goes — there's nothing to remember, they can always draw it again.
   */
  async deleteEdge(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM brain_edges WHERE id = $1 AND business_id = $2
        RETURNING from_node_id, to_node_id, created_by`,
      [id, businessId]
    );
    const row = result.rows[0];
    if (!row) return false;

    if (row.created_by === 'ai_suggested' && row.to_node_id) {
      await this.database.query(
        `INSERT INTO brain_link_dismissals (business_id, from_node_id, to_node_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [businessId, row.from_node_id, row.to_node_id]
      );
    }
    return true;
  }

  // ---- Background enrichment (spec §7) -------------------------------------

  async getSettings(businessId: string): Promise<BrainSettings> {
    const r = await this.database.query(
      `SELECT auto_summarize, auto_link, daily_summary_cap
         FROM brain_settings WHERE business_id = $1`,
      [businessId]
    );
    const row = r.rows[0];
    return {
      autoSummarize: row?.auto_summarize === true,
      autoLink: row ? row.auto_link === true : true,
      dailySummaryCap: Number(row?.daily_summary_cap) || 50,
      minSummaryChars: MIN_SUMMARY_CHARS,
    };
  }

  async updateSettings(
    businessId: string, input: Partial<BrainSettings>
  ): Promise<BrainSettings> {
    const current = await this.getSettings(businessId);
    const next = { ...current, ...input };
    // The cap is clamped server-side: it's the last line of defence against a
    // runaway spend, so a client can't post dailySummaryCap: 999999.
    const cap = Math.max(0, Math.min(Number(next.dailySummaryCap) || 0, 500));
    await this.database.query(
      `INSERT INTO brain_settings (business_id, auto_summarize, auto_link, daily_summary_cap, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (business_id) DO UPDATE
         SET auto_summarize = EXCLUDED.auto_summarize,
             auto_link      = EXCLUDED.auto_link,
             daily_summary_cap = EXCLUDED.daily_summary_cap,
             updated_at = NOW()`,
      [businessId, next.autoSummarize, next.autoLink, cap]
    );
    return { ...next, dailySummaryCap: cap, minSummaryChars: MIN_SUMMARY_CHARS };
  }

  /**
   * Notes that read like this one, ranked.
   *
   * Trigram similarity when pg_trgm is available, full-text ranking when it
   * isn't. Both are pure Postgres — no embeddings vendor, no API key, and no
   * per-note cost, which is why auto-linking can be on by default while
   * summarization can't. It matches shared wording rather than shared meaning;
   * swapping in real embeddings later only replaces this one query.
   */
  async findSimilar(
    businessId: string, nodeId: string, text: string, limit = 5, threshold = 0.22
  ): Promise<{ id: string; score: number }[]> {
    const needle = text.trim().slice(0, 2000);
    if (needle.length < 20) return [];

    const sql = this.trigramReady
      ? `SELECT n.id,
                similarity(coalesce(n.title,'') || ' ' || coalesce(n.content,''), $3) AS score
           FROM brain_nodes n
          WHERE n.business_id = $1 AND n.id <> $2 AND n.status = 'active'
            AND similarity(coalesce(n.title,'') || ' ' || coalesce(n.content,''), $3) > $4
            AND NOT EXISTS (
              SELECT 1 FROM brain_link_dismissals d
               WHERE d.from_node_id = $2 AND d.to_node_id = n.id
            )
          ORDER BY score DESC
          LIMIT $5`
      : `SELECT n.id,
                ts_rank(
                  to_tsvector('english', coalesce(n.title,'') || ' ' || coalesce(n.content,'')),
                  websearch_to_tsquery('english', $3)
                ) AS score
           FROM brain_nodes n
          WHERE n.business_id = $1 AND n.id <> $2 AND n.status = 'active'
            AND to_tsvector('english', coalesce(n.title,'') || ' ' || coalesce(n.content,''))
                @@ websearch_to_tsquery('english', $3)
            AND NOT EXISTS (
              SELECT 1 FROM brain_link_dismissals d
               WHERE d.from_node_id = $2 AND d.to_node_id = n.id
            )
          ORDER BY score DESC
          LIMIT $5`;

    // websearch_to_tsquery chokes on very long input; the trigram path doesn't
    // care, so only the fallback gets trimmed to a keyword-ish string.
    const arg = this.trigramReady ? needle : needle.split(/\s+/).slice(0, 25).join(' ');

    try {
      const r = await this.database.query(
        sql,
        this.trigramReady
          ? [businessId, nodeId, arg, threshold, limit]
          : [businessId, nodeId, arg, limit]
      );
      return r.rows.map((row: any) => ({ id: row.id, score: Number(row.score) || 0 }));
    } catch {
      return [];
    }
  }

  /**
   * Reconcile this node's SUGGESTED links against a fresh set of matches.
   *
   * Only edges with `created_by = 'ai_suggested'` are touched. A link the user
   * drew stays put forever, and one the user removed is recorded as dismissed
   * by deleteEdge so it never comes back.
   */
  async applySuggestedLinks(
    businessId: string, nodeId: string, targetIds: string[]
  ): Promise<number> {
    return this.database.transaction(async (client) => {
      await client.query(
        `DELETE FROM brain_edges
          WHERE from_node_id = $1 AND created_by = 'ai_suggested'
            AND to_node_id IS NOT NULL
            AND NOT (to_node_id = ANY($2::uuid[]))`,
        [nodeId, targetIds]
      );
      let added = 0;
      for (const targetId of targetIds) {
        const r = await client.query(
          `INSERT INTO brain_edges (business_id, from_node_id, to_node_id, relationship_type, created_by)
           VALUES ($1, $2, $3, 'relates_to', 'ai_suggested')
           ON CONFLICT (from_node_id, to_node_id, relationship_type)
             WHERE to_node_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [businessId, nodeId, targetId]
        );
        if (r.rows.length > 0) added++;
      }
      return added;
    });
  }

  /**
   * The node plus the hash it was last enriched at, or null if it's gone or
   * archived. The caller compares hashes — that comparison is what keeps
   * enrichment idempotent and off unchanged content.
   */
  async getNodeForEnrichment(
    businessId: string, nodeId: string
  ): Promise<{ node: BrainNode; storedHash: string | null } | null> {
    const r = await this.database.query(
      `SELECT * FROM brain_nodes
        WHERE id = $1 AND business_id = $2 AND status = 'active'`,
      [nodeId, businessId]
    );
    const row = r.rows[0];
    return row ? { node: this.mapNode(row), storedHash: row.content_hash ?? null } : null;
  }

  async saveEnrichment(
    businessId: string, nodeId: string, hash: string, summary: string | null
  ): Promise<void> {
    // The hash is written even when no summary was produced, so a note that is
    // only auto-linked isn't reprocessed on every subsequent save.
    await this.database.query(
      `UPDATE brain_nodes
          SET content_hash = $3,
              summary = COALESCE($4, summary),
              summary_generated_at = CASE WHEN $4 IS NULL THEN summary_generated_at ELSE NOW() END
        WHERE id = $1 AND business_id = $2`,
      [nodeId, businessId, hash, summary]
    );
  }

  /** Validate a category belongs to this business; anything else becomes Unassigned. */
  private async resolveCategory(
    client: PoolClient, businessId: string, categoryId: string | null | undefined
  ): Promise<string | null> {
    if (!categoryId) return null;
    const found = await client.query(
      `SELECT id FROM brain_categories WHERE id = $1 AND business_id = $2`,
      [categoryId, businessId]
    );
    return found.rows[0]?.id ?? null;
  }

  private async linkNodes(
    client: PoolClient, businessId: string, fromNodeId: string, toNodeId: string,
    relationshipType: RelationshipType, createdBy: 'user' | 'system'
  ): Promise<void> {
    if (fromNodeId === toNodeId) return;
    const owned = await client.query(
      `SELECT COUNT(*)::int AS n FROM brain_nodes WHERE business_id = $1 AND id = ANY($2::uuid[])`,
      [businessId, [fromNodeId, toNodeId]]
    );
    if (owned.rows[0]?.n !== 2) return;
    await client.query(
      `INSERT INTO brain_edges (business_id, from_node_id, to_node_id, relationship_type, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (from_node_id, to_node_id, relationship_type)
         WHERE to_node_id IS NOT NULL DO NOTHING`,
      [businessId, fromNodeId, toNodeId, relationshipType, createdBy]
    );
  }

  /**
   * Reconcile the `links_to` edges out of a node against the [[wiki links]]
   * currently in its body: add what's new, drop what the user deleted.
   *
   * Only `links_to` edges are touched. A connection the user drew by hand is a
   * `relates_to` edge and survives every edit of the note's text — editing a
   * sentence must never silently unpick a link the user made deliberately.
   *
   * A [[link]] to a title that doesn't exist yet is simply skipped; it becomes a
   * real edge the next time either note is saved, once the target exists.
   */
  private async syncWikiLinks(
    client: PoolClient, businessId: string, nodeId: string, content: string | null | undefined
  ): Promise<void> {
    const titles = parseWikiLinks(content);

    let targetIds: string[] = [];
    if (titles.length > 0) {
      // Archived notes are not link targets: a [[link]] to something in the
      // Archive resolves to nothing until it's brought back, rather than
      // quietly re-attaching a note the user has deliberately put away.
      const found = await client.query(
        `SELECT id FROM brain_nodes
          WHERE business_id = $1 AND lower(title) = ANY($2::text[]) AND id <> $3
            AND status = 'active'`,
        [businessId, titles.map((t) => t.toLowerCase()), nodeId]
      );
      targetIds = found.rows.map((r: any) => r.id);
    }

    // `to_node_id IS NOT NULL` matters: a department edge has a null target
    // here, and NULL = ANY(...) is NULL, so without the guard the NOT would
    // never be true for it — harmless today, but it makes the intent explicit
    // that this only ever reconciles node-to-node wiki links.
    await client.query(
      `DELETE FROM brain_edges
        WHERE from_node_id = $1 AND relationship_type = 'links_to'
          AND to_node_id IS NOT NULL
          AND NOT (to_node_id = ANY($2::uuid[]))`,
      [nodeId, targetIds]
    );

    for (const targetId of targetIds) {
      await this.linkNodes(client, businessId, nodeId, targetId, 'links_to', 'system');
    }
  }
}
