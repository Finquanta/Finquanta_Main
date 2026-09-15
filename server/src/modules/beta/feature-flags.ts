import { FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { AuthenticatedRequest } from '../shared/authenticate';

/**
 * Beta feature switches: each new feature has a stage.
 *
 *   off  — nobody sees it
 *   beta — beta workspaces see it: on the real site, workspaces made beta; on
 *          beta.finquanta.ai, every workspace (they are all test copies)
 *   all  — everyone
 *
 * The list of features lives in code (a feature exists because it was built);
 * the stage lives in the database, set from the admin Beta tab, so a feature
 * graduates without a deploy.
 */

export type FeatureStage = 'off' | 'beta' | 'all';
export const FEATURE_STAGES: readonly FeatureStage[] = ['off', 'beta', 'all'];

export interface BetaFeature {
  key: string;
  name: string;
  description: string;
  /** Stage a feature starts at the first time it is seen. */
  initialStage: FeatureStage;
}

export const BETA_FEATURES: readonly BetaFeature[] = [
  {
    key: 'books_history',
    name: 'Books History',
    description: 'Every change to the books, with undo and go back to a date.',
    initialStage: 'beta',
  },
];

export const isFeatureKey = (key: string): boolean => BETA_FEATURES.some((f) => f.key === key);

export async function ensureFeatureFlagsSchema(database: Database): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS beta_features (
      key TEXT PRIMARY KEY,
      stage VARCHAR(10) NOT NULL CHECK (stage IN ('off', 'beta', 'all')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by UUID
    )
  `);
  for (const feature of BETA_FEATURES) {
    await database.query(
      'INSERT INTO beta_features (key, stage) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [feature.key, feature.initialStage]
    );
  }
}

export interface FeatureRow extends BetaFeature {
  stage: FeatureStage;
  updatedAt: string | null;
}

export async function listFeatures(database: Database): Promise<FeatureRow[]> {
  const result = await database.query('SELECT key, stage, updated_at FROM beta_features');
  const stored = new Map<string, any>(result.rows.map((r: any) => [String(r.key), r]));
  return BETA_FEATURES.map((feature) => {
    const row = stored.get(feature.key);
    return {
      ...feature,
      stage: (row?.stage as FeatureStage) ?? feature.initialStage,
      updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  });
}

export async function setFeatureStage(
  database: Database,
  key: string,
  stage: FeatureStage,
  actorId: string
): Promise<void> {
  await database.query(
    `INSERT INTO beta_features (key, stage, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET stage = EXCLUDED.stage, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [key, stage, actorId]
  );
}

/** Which features the workspace can use right now. */
export async function visibleFeatures(database: Database, businessId: string): Promise<string[]> {
  const onBetaSite = process.env.BETA_SITE === 'true';
  const [features, business] = await Promise.all([
    listFeatures(database),
    database.query('SELECT beta_enabled FROM businesses WHERE id = $1', [businessId]),
  ]);
  const inBeta = onBetaSite || business.rows[0]?.beta_enabled === true;
  return features.filter((f) => f.stage === 'all' || (f.stage === 'beta' && inBeta)).map((f) => f.key);
}

/**
 * preHandler, after `withBusiness`: the route exists only for workspaces that
 * can see the feature. Answers 404 — never 403, which the client treats as a
 * dead session.
 */
export function requireBetaFeature(database: Database, key: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as AuthenticatedRequest).businessId;
    if (!businessId || !(await visibleFeatures(database, businessId)).includes(key)) {
      return reply.status(404).send({ success: false, error: 'Not found' });
    }
  };
}
