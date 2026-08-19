import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import {
  BrainRepository, NODE_STATUSES, NODE_TYPES, NodeStatus, NodeType,
  RELATIONSHIP_TYPES, RelationshipType, StatusFilter,
} from './brain.repository';
import { BrainPinsService, PIN_KEYS, PinKey } from './brain.pins';
import { EntitlementsService } from '../billing/entitlements.service';
import { requireFeature } from '../billing/require-feature';
import {
  BrainEntitiesService, ENTITY_TYPES, EntityRef, EntityType, isEntityType,
} from './brain.entities';
import { BrainEnrichService } from './brain.enrich';
import {
  ACCESS_LEVELS, BrainAccessService, canRead, canWrite, isAccessLevel, isNodeOverride,
} from './brain.access';
import {
  BrainAdvisorService, GUIDED_CATEGORIES, isGuidedCategory, isThreadStatus,
} from './brain.advisor';

/**
 * Company Brain — categories, nodes, edges and live data pins.
 *
 * Every route is scoped to the active business via withBusiness, so a user only
 * ever reads and writes their own workspace's Brain. Nothing here calls the AI
 * API; the whole module is deterministic.
 */
export async function brainRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new BrainRepository(options.database);
  const pins = new BrainPinsService(options.database);
  const entities = new BrainEntitiesService(options.database);
  const enrich = new BrainEnrichService(options.database);
  const accessService = new BrainAccessService(options.database);
  const advisor = new BrainAdvisorService(options.database);
  const pre = [authenticate, withBusiness(options.database)];
  const entitlements = new EntitlementsService(options.database);

  /**
   * Resolve the caller's Brain access once per request.
   *
   * Every read passes `restrict` into the query, and every write checks
   * `canWrite` first — so enforcement lives here rather than being remembered
   * separately at each of the twenty-odd handlers below.
   */
  const accessFor = async (request: AuthenticatedRequest) =>
    accessService.resolve(request.businessId!, request.user!.id);

  const restrictFor = async (request: AuthenticatedRequest) =>
    accessService.visibilityClause(await accessFor(request));

  /**
   * Write guard, as a preHandler rather than a check inside each handler.
   *
   * There are a dozen write routes below; a per-handler check is one `if` away
   * from being forgotten on the next one added. Attaching it to the route
   * definition makes "this route writes" and "this route is guarded" the same
   * statement. Runs after withBusiness, which is what sets businessId.
   */
  const requireWrite = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Same shape as authenticate/withBusiness: take the Fastify type and cast
    // inside, so this composes into a preHandler array without fighting it.
    const req = request as AuthenticatedRequest;
    if (!req.businessId || !req.user?.id) return; // earlier handlers already replied
    const access = await accessService.resolve(req.businessId, req.user.id);
    if (!canWrite(access)) {
      await reply.status(403).send({
        success: false,
        error: 'You have read-only access to this Company Brain.',
      });
    }
  };
  const writePre = [...pre, requireWrite];

  const isNodeType = (v: unknown): v is NodeType => NODE_TYPES.includes(v as NodeType);
  const isRelationship = (v: unknown): v is RelationshipType =>
    RELATIONSHIP_TYPES.includes(v as RelationshipType);
  const isStatus = (v: unknown): v is NodeStatus => NODE_STATUSES.includes(v as NodeStatus);
  /** Anything unrecognised falls back to 'active' rather than erroring. */
  const asStatusFilter = (v: unknown): StatusFilter =>
    v === 'all' || isStatus(v) ? v : 'active';

  /**
   * The category tree with live counts. Seeds the 8 default departments on
   * first visit, so a business that existed before the Brain shipped gets its
   * structure without a migration.
   */
  fastify.get('/v1/brain/overview', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;
      const access = await accessFor(request);
      if (!canRead(access)) {
        return reply.status(403).send({ success: false, error: 'You do not have access to this Company Brain.' });
      }
      await repo.ensureDefaults(businessId);
      const { includeArchived } = request.query as { includeArchived?: string };
      return reply.send({
        success: true,
        data: {
          ...await repo.getOverview(
            businessId, includeArchived === 'true', accessService.visibilityClause(access)
          ),
          // The client needs this to decide whether to render edit controls at
          // all; the server still refuses the writes regardless.
          access: { level: access.level, canWrite: canWrite(access) },
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your Company Brain.' });
    }
  }) as any);

  fastify.post('/v1/brain/categories', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        name?: string; role?: string | null; color?: string; icon?: string | null; parentCategoryId?: string | null;
      }) || {};
      const name = (body.name ?? '').trim();
      if (!name) return reply.status(400).send({ success: false, error: 'A category name is required.' });
      if (name.length > 120) return reply.status(400).send({ success: false, error: 'That category name is too long.' });

      const created = await repo.createCategory(request.businessId!, {
        name, role: body.role, color: body.color, icon: body.icon, parentCategoryId: body.parentCategoryId,
      });
      // createCategory returns null when the parent is missing or is itself a
      // subcategory — the Brain is two levels deep by design.
      if (!created) {
        return reply.status(400).send({
          success: false,
          error: 'Categories can only be nested one level deep.',
        });
      }
      return reply.status(201).send({ success: true, data: created });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not create that category.' });
    }
  }) as any);

  fastify.patch('/v1/brain/categories/:id', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as {
        name?: string; role?: string | null; color?: string; icon?: string | null; status?: string;
      }) || {};
      if (body.status && body.status !== 'active' && body.status !== 'archived') {
        return reply.status(400).send({ success: false, error: 'status must be active or archived' });
      }
      if (body.name !== undefined && !body.name.trim()) {
        return reply.status(400).send({ success: false, error: 'A category name is required.' });
      }
      const updated = await repo.updateCategory(request.businessId!, id, {
        name: body.name?.trim(), role: body.role, color: body.color, icon: body.icon,
        status: body.status as 'active' | 'archived' | undefined,
      });
      if (!updated) return reply.status(404).send({ success: false, error: 'Category not found' });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update that category.' });
    }
  }) as any);

  /** Archives the category and re-homes its notes to Unassigned. Nothing is destroyed. */
  fastify.delete('/v1/brain/categories/:id', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.archiveCategory(request.businessId!, id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Category not found' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not remove that category.' });
    }
  }) as any);

  fastify.post('/v1/brain/categories/reorder', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { ids?: unknown }) || {};
      if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) {
        return reply.status(400).send({ success: false, error: 'ids must be an array of category ids' });
      }
      await repo.reorderCategories(request.businessId!, body.ids as string[]);
      return reply.send({ success: true, data: { ids: body.ids } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not reorder your categories.' });
    }
  }) as any);

  /**
   * Nodes in a category. Pass categoryId=unassigned for the floating ones, and
   * status=archived for the Archive (the default is active only).
   */
  fastify.get('/v1/brain/nodes', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const q = request.query as {
        categoryId?: string; type?: string; q?: string; includeSubcategories?: string; status?: string;
      };
      const categoryId = q.categoryId === 'unassigned' ? null : q.categoryId || undefined;
      if (q.type && !isNodeType(q.type)) {
        return reply.status(400).send({ success: false, error: `type must be one of: ${NODE_TYPES.join(', ')}` });
      }
      return reply.send({
        success: true,
        data: await repo.listNodes(request.businessId!, {
          categoryId,
          includeSubcategories: q.includeSubcategories !== 'false',
          type: q.type as NodeType | undefined,
          q: q.q,
          status: asStatusFilter(q.status),
          restrict: await restrictFor(request),
        }),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load those notes.' });
    }
  }) as any);

  /** Full-text search across every node type. Powers the connection picker too. */
  fastify.get('/v1/brain/search', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { q, limit, status } = request.query as { q?: string; limit?: string; status?: string };
      const results = await repo.search(
        request.businessId!, q ?? '', Number(limit) || 20, asStatusFilter(status),
        await restrictFor(request)
      );
      return reply.send({ success: true, data: results });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not search your Brain.' });
    }
  }) as any);

  /**
   * The whole Brain as nodes and edges, for the graph view. One request — the
   * graph renders the entire Brain at once, so paginating it would just mean
   * drawing an incomplete picture.
   */
  // Graph view is paid (spec 06 §9). Freemium keeps the category tree, notes
  // and search — everything except the visualisation.
  fastify.get('/v1/brain/graph', { preHandler: [...pre, requireFeature(options.database, 'brainGraph')] }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;
      await repo.ensureDefaults(businessId);
      return reply.send({
        success: true,
        data: await repo.getGraph(businessId, await restrictFor(request)),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your graph.' });
    }
  }) as any);

  /** A node with everything it links to and everything that links back to it. */
  fastify.get('/v1/brain/nodes/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const node = await repo.getNode(request.businessId!, id, await restrictFor(request));
      // 404 rather than 403: a restricted node must be indistinguishable from
      // one that doesn't exist.
      if (!node) return reply.status(404).send({ success: false, error: 'Note not found' });

      // The backlinks panel is paid (spec 06 §9). Stripped from the payload
      // rather than refused: the note itself is free to read, and 402-ing the
      // whole node because one panel is premium would lock a freemium user out
      // of their own writing. `backlinksLocked` lets the client show the panel
      // as a locked upsell instead of silently omitting it.
      if (!(await entitlements.can(request.businessId!, 'brainBacklinks'))) {
        return reply.send({
          success: true,
          data: { ...node, backlinks: [], backlinksLocked: true },
        });
      }
      return reply.send({ success: true, data: node });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not open that note.' });
    }
  }) as any);

  fastify.post('/v1/brain/nodes', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        title?: string; content?: string | null; type?: string; source?: string;
        categoryId?: string | null; payload?: Record<string, unknown> | null;
        connectToNodeId?: string | null; connectToCategoryId?: string | null;
        connections?: { nodeId?: string | null; categoryId?: string | null }[];
      }) || {};
      const title = (body.title ?? '').trim();
      if (!title) return reply.status(400).send({ success: false, error: 'A title is required.' });
      if (title.length > 300) return reply.status(400).send({ success: false, error: 'That title is too long.' });
      if (body.type && !isNodeType(body.type)) {
        return reply.status(400).send({ success: false, error: `type must be one of: ${NODE_TYPES.join(', ')}` });
      }

      const created = await repo.createNode(
        request.businessId!,
        request.user?.id ?? null,
        {
          title,
          content: body.content ?? null,
          type: (body.type as NodeType) ?? 'note',
          // 'unassigned' and null both mean the floating bucket.
          categoryId: body.categoryId === 'unassigned' ? null : body.categoryId ?? null,
          payload: body.payload ?? {},
          // 'council' is never accepted from a client — only the Council's own
          // server-side code may claim it, so provenance can't be spoofed.
          source: body.source === 'system' ? 'system' : 'manual',
        },
        // `connections` is the list form; the singular fields stay accepted so
        // an older client (or the graph's "+" on a node) still works.
        [
          ...(Array.isArray(body.connections) ? body.connections : []),
          ...(body.connectToNodeId ? [{ nodeId: body.connectToNodeId }] : []),
          ...(body.connectToCategoryId ? [{ categoryId: body.connectToCategoryId }] : []),
        ]
      );
      // Queued, not awaited: enrichment runs 8s after the user stops editing
      // and must never make saving a note slower or able to fail.
      enrich.schedule(request.businessId!, created.id);
      return reply.status(201).send({ success: true, data: created });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that note.' });
    }
  }) as any);

  fastify.patch('/v1/brain/nodes/:id', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as {
        title?: string; content?: string | null; type?: string; status?: string;
        categoryId?: string | null; payload?: Record<string, unknown> | null;
        accessOverride?: unknown;
      }) || {};
      // Restricting a node is an Owner/Admin act — otherwise any editor could
      // hide a note from the people who run the business.
      if (body.accessOverride !== undefined) {
        const access = await accessFor(request);
        if (!access.privileged) {
          return reply.status(403).send({
            success: false, error: 'Only an owner or admin can restrict a note.',
          });
        }
        if (body.accessOverride !== null && !isNodeOverride(body.accessOverride)) {
          return reply.status(400).send({
            success: false, error: 'accessOverride must be null or owners_admins',
          });
        }
      }
      if (body.title !== undefined && !body.title.trim()) {
        return reply.status(400).send({ success: false, error: 'A title is required.' });
      }
      if (body.type && !isNodeType(body.type)) {
        return reply.status(400).send({ success: false, error: `type must be one of: ${NODE_TYPES.join(', ')}` });
      }
      // Archiving and unarchiving are this same PATCH with { status } — one
      // write path for every change to a node, rather than a verb endpoint.
      if (body.status !== undefined && !isStatus(body.status)) {
        return reply.status(400).send({ success: false, error: `status must be one of: ${NODE_STATUSES.join(', ')}` });
      }

      const updated = await repo.updateNode(request.businessId!, id, {
        title: body.title?.trim(),
        content: body.content,
        type: body.type as NodeType | undefined,
        status: body.status as NodeStatus | undefined,
        categoryId: body.categoryId === undefined
          ? undefined
          : body.categoryId === 'unassigned' ? null : body.categoryId,
        payload: body.payload ?? undefined,
        accessOverride: body.accessOverride as string | null | undefined,
      });
      if (!updated) return reply.status(404).send({ success: false, error: 'Note not found' });
      // Archiving cancels pending work; any other edit reschedules it.
      if (updated.status === 'archived') enrich.cancel(updated.id);
      else enrich.schedule(request.businessId!, updated.id);
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that note.' });
    }
  }) as any);

  fastify.delete('/v1/brain/nodes/:id', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.deleteNode(request.businessId!, id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Note not found' });
      enrich.cancel(id);
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not delete that note.' });
    }
  }) as any);

  fastify.post('/v1/brain/edges', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        fromNodeId?: string; toNodeId?: string; toCategoryId?: string; relationshipType?: string;
      }) || {};
      if (!body.fromNodeId) {
        return reply.status(400).send({ success: false, error: 'fromNodeId is required' });
      }
      // An edge points at a note or at a department — one target, never both.
      if (!body.toNodeId === !body.toCategoryId) {
        return reply.status(400).send({
          success: false, error: 'Provide exactly one of toNodeId or toCategoryId',
        });
      }
      if (body.relationshipType && !isRelationship(body.relationshipType)) {
        return reply.status(400).send({
          success: false, error: `relationshipType must be one of: ${RELATIONSHIP_TYPES.join(', ')}`,
        });
      }
      const edge = await repo.createEdge(
        request.businessId!, body.fromNodeId,
        { toNodeId: body.toNodeId ?? null, toCategoryId: body.toCategoryId ?? null },
        (body.relationshipType as RelationshipType) ?? 'relates_to'
      );
      // Null means an end isn't in this business, or both ends are the same node.
      if (!edge) return reply.status(400).send({ success: false, error: 'Those two cannot be connected.' });
      return reply.status(201).send({ success: true, data: edge });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not connect those notes.' });
    }
  }) as any);

  fastify.delete('/v1/brain/edges/:id', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.deleteEdge(request.businessId!, id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Connection not found' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not remove that connection.' });
    }
  }) as any);

  /**
   * Records the user can attach to the Brain — invoices, customers, ledger
   * entries and groups, searched together. Powers the reference picker.
   */
  fastify.get('/v1/brain/entities/search', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { q, type, limit } = request.query as { q?: string; type?: string; limit?: string };
      if (type && type !== 'all' && !isEntityType(type)) {
        return reply.status(400).send({
          success: false, error: `type must be all or one of: ${ENTITY_TYPES.join(', ')}`,
        });
      }
      return reply.send({
        success: true,
        data: await entities.search(
          request.businessId!, q ?? '', (type as EntityType | 'all') ?? 'all', Number(limit) || 8
        ),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not search your records.' });
    }
  }) as any);

  /**
   * Resolve references against live data. A list of reference nodes calls this
   * once for the whole page rather than once per card.
   */
  fastify.post('/v1/brain/entities/resolve', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { refs?: unknown }) || {};
      if (!Array.isArray(body.refs)) {
        return reply.status(400).send({ success: false, error: 'refs must be an array' });
      }
      // Malformed entries are dropped rather than failing the whole batch —
      // one bad payload shouldn't blank every card on the page.
      const refs: EntityRef[] = body.refs.flatMap((r: any) =>
        r && isEntityType(r.entityType) && typeof r.entityId === 'string'
          ? [{ entityType: r.entityType, entityId: r.entityId }]
          : []
      );
      return reply.send({ success: true, data: await entities.resolveMany(request.businessId!, refs) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not read those records.' });
    }
  }) as any);

  /**
   * Attach a record to the Brain — the "Add to Company Brain" button.
   *
   * Separate from POST /nodes because the title is looked up from the record
   * rather than typed, and because attaching the same record twice should open
   * what's already there instead of making a duplicate.
   */
  fastify.post('/v1/brain/entities/attach', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        entityType?: string; entityId?: string; categoryId?: string | null;
        title?: string; content?: string | null;
        connections?: { nodeId?: string | null; categoryId?: string | null }[];
      }) || {};
      if (!isEntityType(body.entityType) || !body.entityId) {
        return reply.status(400).send({
          success: false, error: `entityType must be one of: ${ENTITY_TYPES.join(', ')}, with an entityId`,
        });
      }
      const businessId = request.businessId!;
      const ref: EntityRef = { entityType: body.entityType, entityId: body.entityId };

      // The record has to exist in THIS workspace, or an id from elsewhere
      // could be attached and would resolve to nothing forever.
      const resolved = await entities.resolve(businessId, ref);
      if (!resolved.exists) {
        return reply.status(404).send({ success: false, error: 'That record no longer exists.' });
      }

      const existing = await repo.findEntityNode(businessId, ref);
      if (existing) return reply.send({ success: true, data: existing, alreadyExisted: true });

      const created = await repo.createNode(
        businessId,
        request.user?.id ?? null,
        {
          title: (body.title ?? '').trim() || resolved.title || 'Record',
          content: body.content ?? null,
          type: 'entity_ref',
          categoryId: body.categoryId === 'unassigned' ? null : body.categoryId ?? null,
          payload: { entityType: ref.entityType, entityId: ref.entityId },
        },
        Array.isArray(body.connections) ? body.connections : []
      );
      return reply.status(201).send({ success: true, data: created });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not add that record to your Brain.' });
    }
  }) as any);

  /**
   * Who can see the Brain, and at what level (spec §10).
   *
   * Only Owners and Admins may read or change this — the access list itself
   * names every member, which isn't something a Viewer needs.
   */
  fastify.get('/v1/brain/access', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const access = await accessFor(request);
      if (!access.privileged) {
        return reply.status(403).send({ success: false, error: 'Only an owner or admin can manage Brain access.' });
      }
      return reply.send({
        success: true,
        data: {
          members: await accessService.list(request.businessId!),
          levels: ACCESS_LEVELS,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load Brain access.' });
    }
  }) as any);

  fastify.patch('/v1/brain/access/:userId', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const access = await accessFor(request);
      if (!access.privileged) {
        return reply.status(403).send({ success: false, error: 'Only an owner or admin can manage Brain access.' });
      }
      const { userId } = request.params as { userId: string };
      const body = (request.body as { level?: unknown }) || {};

      // null clears the explicit level and falls back to the role default.
      const level = body.level === null ? null : body.level;
      if (level !== null && !isAccessLevel(level)) {
        return reply.status(400).send({
          success: false, error: `level must be null or one of: ${ACCESS_LEVELS.join(', ')}`,
        });
      }
      // Locking yourself out of your own Brain is never the intent.
      if (userId === request.user!.id) {
        return reply.status(400).send({ success: false, error: 'You cannot change your own Brain access.' });
      }

      const ok = await accessService.setLevel(request.businessId!, userId, level);
      if (!ok) return reply.status(404).send({ success: false, error: 'That person is not a member of this business.' });
      return reply.send({ success: true, data: { userId, level } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update Brain access.' });
    }
  }) as any);

  /**
   * Guided-category advisor context (spec §6b).
   *
   * Everything the Marketing/Sales advisor needs to be briefed, in one request:
   * the answers so far, what's still unanswered, how specific the brief is, the
   * notes already in the category, and the live pin. Deterministic — the AI call
   * happens in the Next.js chat route, using this as context.
   */
  fastify.get('/v1/brain/advisor/context', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { category, threadId } = request.query as { category?: string; threadId?: string };
      if (!isGuidedCategory(category)) {
        return reply.status(400).send({
          success: false,
          error: `category must be one of: ${GUIDED_CATEGORIES.join(', ')}`,
        });
      }
      return reply.send({
        success: true,
        data: await advisor.getContext(
          request.businessId!, category, await restrictFor(request), threadId ?? null
        ),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load the advisor.' });
    }
  }) as any);

  /**
   * Saved advisor conversations (§6b).
   *
   * One business can be advertising several things at once — a trading platform
   * and an NFT drop are different budgets and different stages — so each subject
   * gets its own resumable thread rather than one endless chat.
   */
  fastify.get('/v1/brain/advisor/threads', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { category, status } = request.query as { category?: string; status?: string };
      if (!isGuidedCategory(category)) {
        return reply.status(400).send({
          success: false,
          error: `category must be one of: ${GUIDED_CATEGORIES.join(', ')}`,
        });
      }
      return reply.send({
        success: true,
        data: await advisor.listThreads(
          request.businessId!, category, isThreadStatus(status) ? status : 'active'
        ),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your conversations.' });
    }
  }) as any);

  fastify.post('/v1/brain/advisor/threads', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        category?: unknown; title?: unknown;
        stage?: string | null; budget?: string | null; situation?: string | null;
      }) || {};
      if (!isGuidedCategory(body.category)) {
        return reply.status(400).send({
          success: false,
          error: `category must be one of: ${GUIDED_CATEGORIES.join(', ')}`,
        });
      }
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return reply.status(400).send({ success: false, error: 'A name is required.' });

      return reply.status(201).send({
        success: true,
        data: await advisor.createThread(request.businessId!, body.category, {
          title, stage: body.stage, budget: body.budget, situation: body.situation,
        }),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not start that conversation.' });
    }
  }) as any);

  /** The full transcript, for resuming a conversation. */
  fastify.get('/v1/brain/advisor/threads/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const thread = await advisor.getThread(request.businessId!, id);
      if (!thread) return reply.status(404).send({ success: false, error: 'Conversation not found.' });
      return reply.send({ success: true, data: thread });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load that conversation.' });
    }
  }) as any);

  fastify.patch('/v1/brain/advisor/threads/:id', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as {
        title?: string; stage?: string | null; budget?: string | null;
        situation?: string | null; status?: string;
      }) || {};
      if (body.status !== undefined && !isThreadStatus(body.status)) {
        return reply.status(400).send({ success: false, error: 'status must be active or archived.' });
      }
      const updated = await advisor.updateThread(request.businessId!, id, {
        ...body, status: isThreadStatus(body.status) ? body.status : undefined,
      });
      if (!updated) return reply.status(404).send({ success: false, error: 'Conversation not found.' });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that conversation.' });
    }
  }) as any);

  /** Append the latest exchange, so the thread can be left and picked back up. */
  fastify.post('/v1/brain/advisor/threads/:id/messages', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as { messages?: unknown }) || {};
      if (!Array.isArray(body.messages)) {
        return reply.status(400).send({ success: false, error: 'messages must be an array.' });
      }
      await advisor.appendMessages(request.businessId!, id, body.messages as any);
      return reply.send({ success: true, data: { ok: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that message.' });
    }
  }) as any);

  /**
   * Save the whole conversation into the Brain as one node, so the reasoning
   * is readable months later. Deterministic formatting of the stored
   * transcript — no AI call, so this costs nothing.
   */
  fastify.post('/v1/brain/advisor/threads/:id/save-note', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const saved = await advisor.saveThreadAsNote(request.businessId!, id, request.user?.id ?? null);
      if (!saved) return reply.status(404).send({ success: false, error: 'Conversation not found.' });
      return reply.status(201).send({ success: true, data: saved });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save that to your Brain.' });
    }
  }) as any);

  fastify.delete('/v1/brain/advisor/threads/:id', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const gone = await advisor.deleteThread(request.businessId!, id);
      if (!gone) return reply.status(404).send({ success: false, error: 'Conversation not found.' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not delete that conversation.' });
    }
  }) as any);

  /** Save one or more profiling answers. Merges, so a partial save never wipes. */
  fastify.patch('/v1/brain/advisor/profile', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { category?: unknown; answers?: unknown }) || {};
      if (!isGuidedCategory(body.category)) {
        return reply.status(400).send({
          success: false,
          error: `category must be one of: ${GUIDED_CATEGORIES.join(', ')}`,
        });
      }
      if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
        return reply.status(400).send({ success: false, error: 'answers must be an object.' });
      }
      return reply.send({
        success: true,
        data: await advisor.saveAnswers(
          request.businessId!,
          body.category,
          body.answers as Record<string, string>,
          request.user?.id ?? null
        ),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save your answers.' });
    }
  }) as any);

  /** Enrichment settings for this workspace (spec §7.1). */
  fastify.get('/v1/brain/settings', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.getSettings(request.businessId!) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your Brain settings.' });
    }
  }) as any);

  fastify.patch('/v1/brain/settings', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as {
        autoSummarize?: unknown; autoLink?: unknown; dailySummaryCap?: unknown;
      }) || {};
      const patch: Record<string, unknown> = {};
      if (typeof body.autoSummarize === 'boolean') patch.autoSummarize = body.autoSummarize;
      if (typeof body.autoLink === 'boolean') patch.autoLink = body.autoLink;
      if (typeof body.dailySummaryCap === 'number') patch.dailySummaryCap = body.dailySummaryCap;

      return reply.send({
        success: true,
        data: await repo.updateSettings(request.businessId!, patch),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not save your Brain settings.' });
    }
  }) as any);

  /**
   * Run enrichment for one note immediately, skipping the 8s debounce.
   *
   * This is the "Find related notes" button — it lets a user (and a tester)
   * see the result now instead of waiting. It obeys exactly the same settings
   * and caps as the background pass, so it cannot be used to bypass them.
   */
  fastify.post('/v1/brain/nodes/:id/enrich', { preHandler: writePre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send({ success: true, data: await enrich.run(request.businessId!, id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not process that note.' });
    }
  }) as any);

  /** Live financial figures for the categories that map to real modules. */
  fastify.get('/v1/brain/pins', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { keys } = request.query as { keys?: string };
      const requested = (keys ? keys.split(',') : [...PIN_KEYS])
        .map((k) => k.trim())
        .filter((k): k is PinKey => PIN_KEYS.includes(k as PinKey));

      return reply.send({
        success: true,
        data: await pins.resolve(request.businessId!, requested),
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load your live figures.' });
    }
  }) as any);
}
