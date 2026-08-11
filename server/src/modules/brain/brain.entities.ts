import { Database } from '../../infrastructure/database';
import { GroupsRepository } from '../groups/groups.repository';
import { PinMetric } from './brain.pins';

/**
 * Entity references — the hinge between the ledger and the Brain.
 *
 * The ledger holds what happened: invoices, customers, journal entries, groups.
 * The Brain holds why it happened. An `entity_ref` node is how a user ties one
 * to the other — "here is the note about losing Acme" wired to the actual Acme
 * customer record.
 *
 * The node stores ONLY a pointer (`payload.entityType` + `payload.entityId`).
 * Nothing is copied. Everything below is read live at the moment the node is
 * opened, which is the whole design:
 *
 *   - an invoice that gets paid shows as paid, with no sync step
 *   - a customer that gets renamed resolves to the new name
 *   - a record that gets DELETED resolves to `exists: false`, and the user's
 *     note survives — a snapshot would have sat there claiming $12,000 was
 *     still owed by a customer who no longer exists
 *
 * A stored copy could only ever be right at the instant it was made. A pointer
 * is right every time it's read, or honest about being broken.
 *
 * No AI call is made on any path in this file.
 */

export const ENTITY_TYPES = ['customer', 'invoice', 'entry', 'group'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityRef {
  entityType: EntityType;
  entityId: string;
}

export interface ResolvedEntity extends EntityRef {
  /** False when the underlying record has been deleted. */
  exists: boolean;
  /** The record's CURRENT name/number/description. Null when it's gone. */
  title: string | null;
  /** Raw status token (invoice, group). The client maps known ones. */
  status: string | null;
  /** ISO date the record carries, where it has one. */
  date: string | null;
  /** Live figures, same `{key, value, format}` shape the pins use. */
  metrics: PinMetric[];
  /** Client route to the real record. Null when there's nothing to open. */
  href: string | null;
}

/** A candidate the user can attach, returned by the picker's search. */
export interface EntityCandidate extends EntityRef {
  title: string;
  subtitle: string | null;
  status: string | null;
  date: string | null;
  amount: number | null;
}

export const isEntityType = (v: unknown): v is EntityType =>
  ENTITY_TYPES.includes(v as EntityType);

/**
 * Pull a well-formed reference out of a node's payload, or null.
 * Anything malformed is treated as "not a reference" rather than throwing —
 * a node whose payload got mangled should degrade, not break the panel.
 */
export function readEntityRef(payload: unknown): EntityRef | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const entityType = p.entityType;
  const entityId = p.entityId;
  if (!isEntityType(entityType)) return null;
  if (typeof entityId !== 'string' || entityId.length === 0) return null;
  return { entityType, entityId };
}

const money = (v: unknown): number => Number.parseFloat(String(v ?? '0')) || 0;
const iso = (d: unknown): string | null =>
  d instanceof Date ? d.toISOString().slice(0, 10) : (d as string) ?? null;

export class BrainEntitiesService {
  private groups: GroupsRepository;

  constructor(private database: Database) {
    this.groups = new GroupsRepository(database);
  }

  /** Resolve one reference against live data. */
  async resolve(businessId: string, ref: EntityRef): Promise<ResolvedEntity> {
    const missing: ResolvedEntity = {
      ...ref, exists: false, title: null, status: null, date: null, metrics: [], href: null,
    };
    // Every lookup is scoped by business_id, so a reference carrying an id from
    // another workspace resolves to "gone" rather than leaking that record.
    switch (ref.entityType) {
      case 'customer': return (await this.customer(businessId, ref.entityId)) ?? missing;
      case 'invoice': return (await this.invoice(businessId, ref.entityId)) ?? missing;
      case 'entry': return (await this.entry(businessId, ref.entityId)) ?? missing;
      case 'group': return (await this.group(businessId, ref.entityId)) ?? missing;
      default: return missing;
    }
  }

  /** Resolve a batch, for a list of reference nodes. Order is preserved. */
  async resolveMany(businessId: string, refs: EntityRef[]): Promise<ResolvedEntity[]> {
    return Promise.all(refs.slice(0, 100).map((r) => this.resolve(businessId, r)));
  }

  /**
   * What the customer is worth and what's outstanding — the two things you
   * actually want beside a note about a client relationship.
   */
  private async customer(businessId: string, id: string): Promise<ResolvedEntity | null> {
    const row = await this.database.query(
      `SELECT c.id, c.name, c.email, c.created_at,
              COALESCE(SUM(i.total) FILTER (WHERE i.status = 'paid'), 0) AS paid_total,
              COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('sent','viewed','overdue')), 0) AS open_total,
              COUNT(i.id) FILTER (WHERE i.status IN ('sent','viewed','overdue'))::int AS open_count
         FROM customers c
         LEFT JOIN invoices i
           ON i.customer_id = c.id AND i.business_id = c.business_id AND i.deleted_at IS NULL
        WHERE c.id = $1 AND c.business_id = $2
        GROUP BY c.id`,
      [id, businessId]
    );
    const r = row.rows[0];
    if (!r) return null;

    return {
      entityType: 'customer',
      entityId: id,
      exists: true,
      title: r.name,
      status: null,
      date: iso(r.created_at),
      metrics: [
        { key: 'refRevenueToDate', value: money(r.paid_total), format: 'money' },
        { key: 'refOpenInvoiceValue', value: money(r.open_total), format: 'money' },
        { key: 'refOpenInvoices', value: Number(r.open_count) || 0, format: 'number' },
      ],
      // There is no per-customer route yet, so this opens the customer list.
      href: '/customers',
    };
  }

  private async invoice(businessId: string, id: string): Promise<ResolvedEntity | null> {
    const row = await this.database.query(
      `SELECT i.id, i.number, i.status, i.issue_date, i.due_date, i.total, i.currency,
              c.name AS customer_name
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.id = $1 AND i.business_id = $2 AND i.deleted_at IS NULL`,
      [id, businessId]
    );
    const r = row.rows[0];
    if (!r) return null;

    return {
      entityType: 'invoice',
      entityId: id,
      exists: true,
      title: r.customer_name ? `${r.number} — ${r.customer_name}` : r.number,
      status: r.status ?? null,
      date: iso(r.issue_date),
      metrics: [{ key: 'refInvoiceTotal', value: money(r.total), format: 'money' }],
      href: `/invoices/${id}`,
    };
  }

  /**
   * A ledger entry. Its amount is the sum of the debit side — in double entry
   * the two sides are equal by construction, so either one is "the amount".
   */
  private async entry(businessId: string, id: string): Promise<ResolvedEntity | null> {
    const row = await this.database.query(
      `SELECT e.id, e.date, e.description, e.source_type,
              COALESCE(SUM(l.debit), 0) AS amount
         FROM journal_entries e
         LEFT JOIN journal_lines l ON l.entry_id = e.id
        WHERE e.id = $1 AND e.business_id = $2
        GROUP BY e.id`,
      [id, businessId]
    );
    const r = row.rows[0];
    if (!r) return null;

    return {
      entityType: 'entry',
      entityId: id,
      exists: true,
      title: r.description,
      status: r.source_type ?? null,
      date: iso(r.date),
      metrics: [{ key: 'refEntryAmount', value: money(r.amount), format: 'money' }],
      href: '/bookkeeping',
    };
  }

  /**
   * A Business Group, with the same year-to-date figures the department pins
   * show — so a note about Marketing spend sits beside what Marketing spent.
   */
  private async group(businessId: string, id: string): Promise<ResolvedEntity | null> {
    const row = await this.database.query(
      `SELECT id, name, type, status FROM groups WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    const r = row.rows[0];
    if (!r) return null;

    const report = await this.groups.getGroupReport(
      businessId, `${new Date().getFullYear()}-01-01`, new Date().toISOString().slice(0, 10)
    );
    const line = report.find((x) => x.groupId === id);

    return {
      entityType: 'group',
      entityId: id,
      exists: true,
      title: r.name,
      status: r.status ?? null,
      date: null,
      metrics: line
        ? [
            { key: 'groupNet', value: line.net, format: 'money' },
            { key: 'groupSpend', value: line.outflow, format: 'money' },
            { key: 'groupInflow', value: line.inflow, format: 'money' },
            { key: 'groupEntries', value: line.entries, format: 'number' },
          ]
        : [],
      href: '/groups',
    };
  }

  /**
   * Find records to attach. One query per type so the picker can offer a mixed
   * list, capped tight — this runs on every keystroke behind a debounce.
   */
  async search(
    businessId: string, q: string, type: EntityType | 'all' = 'all', limit = 8
  ): Promise<EntityCandidate[]> {
    const term = q.trim();
    if (!term) return [];
    const like = `%${term}%`;
    const cap = Math.min(Math.max(limit, 1), 25);
    const want = (t: EntityType) => type === 'all' || type === t;

    const [customers, invoices, entries, groups] = await Promise.all([
      want('customer')
        ? this.database.query(
            `SELECT id, name, email FROM customers
              WHERE business_id = $1 AND name ILIKE $2
              ORDER BY name LIMIT $3`,
            [businessId, like, cap]
          )
        : null,
      want('invoice')
        ? this.database.query(
            `SELECT i.id, i.number, i.status, i.issue_date, i.total, c.name AS customer_name
               FROM invoices i
               LEFT JOIN customers c ON c.id = i.customer_id
              WHERE i.business_id = $1 AND i.deleted_at IS NULL
                AND (i.number ILIKE $2 OR c.name ILIKE $2)
              ORDER BY i.issue_date DESC LIMIT $3`,
            [businessId, like, cap]
          )
        : null,
      want('entry')
        ? this.database.query(
            `SELECT e.id, e.date, e.description, COALESCE(SUM(l.debit), 0) AS amount
               FROM journal_entries e
               LEFT JOIN journal_lines l ON l.entry_id = e.id
              WHERE e.business_id = $1 AND e.description ILIKE $2
              GROUP BY e.id
              ORDER BY e.date DESC LIMIT $3`,
            [businessId, like, cap]
          )
        : null,
      want('group')
        ? this.database.query(
            `SELECT id, name, type FROM groups
              WHERE business_id = $1 AND name ILIKE $2 AND status = 'active'
              ORDER BY name LIMIT $3`,
            [businessId, like, cap]
          )
        : null,
    ]);

    const out: EntityCandidate[] = [];
    for (const r of customers?.rows ?? []) {
      out.push({
        entityType: 'customer', entityId: r.id, title: r.name,
        subtitle: r.email ?? null, status: null, date: null, amount: null,
      });
    }
    for (const r of invoices?.rows ?? []) {
      out.push({
        entityType: 'invoice', entityId: r.id,
        title: r.number, subtitle: r.customer_name ?? null,
        status: r.status ?? null, date: iso(r.issue_date), amount: money(r.total),
      });
    }
    for (const r of entries?.rows ?? []) {
      out.push({
        entityType: 'entry', entityId: r.id, title: r.description,
        subtitle: null, status: null, date: iso(r.date), amount: money(r.amount),
      });
    }
    for (const r of groups?.rows ?? []) {
      out.push({
        entityType: 'group', entityId: r.id, title: r.name,
        subtitle: r.type ?? null, status: null, date: null, amount: null,
      });
    }
    return out;
  }

  /**
   * A sensible default title for a new reference node.
   *
   * The node needs a stored title because that's what the graph labels, the
   * tree prints and search matches — those all run over thousands of rows and
   * can't resolve live. It's a label, not a figure: the numbers are never
   * stored, and the detail panel always shows the record's current name.
   */
  async defaultTitle(businessId: string, ref: EntityRef): Promise<string | null> {
    const resolved = await this.resolve(businessId, ref);
    return resolved.exists ? resolved.title : null;
  }
}
