import { Database } from '../../infrastructure/database';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { DashboardRepository } from '../dashboard/dashboard.repository';
import { BusinessProfile } from './profile.types';

/**
 * Section 9: picking a primary financial goal during signup creates a real goal
 * in the Goals module, so a brand-new user lands on a dashboard that already has
 * something on it instead of an empty shell.
 */

/** The four choices offered at signup. Kept in step with the onboarding UI. */
export const PRIMARY_GOALS = [
  'Grow revenue',
  'Reduce expenses',
  'Improve cash flow',
  'Get organized',
] as const;

export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

/**
 * The top of each revenue band, used as the starting target.
 *
 * The bands are read as ANNUAL revenue — which is what their size implies, and
 * what the onboarding question now says — so the goals created here run for the
 * year.
 *
 * These are a sensible opening number, NOT a calculated recommendation: the user
 * has logged no financial data at signup, so there is nothing to compute from.
 * Every auto-created goal is editable like any other.
 */
const ANNUAL_BAND_TOP: Record<string, number> = {
  'Pre-revenue': 1_000,
  'Under $10k': 10_000,
  '$10k–$50k': 50_000,
  '$50k–$250k': 250_000,
  '$250k–$1M': 1_000_000,
  '$1M–$5M': 5_000_000,
  '$5M+': 10_000_000,
};
const DEFAULT_BAND_TOP = 10_000;

interface GoalTemplate {
  name: string;
  color: string;
  /** Starting target, as a share of the top of their annual revenue band. */
  shareOfBand: number;
}

const GOAL_TEMPLATES: Record<PrimaryGoal, GoalTemplate> = {
  // Reach the top of the revenue band you're in now.
  'Grow revenue': { name: 'Grow Revenue', color: '#10b981', shareOfBand: 1 },
  // Trim a fifth of a year's revenue out of your outgoings.
  'Reduce expenses': { name: 'Cut Expenses', color: '#f59e0b', shareOfBand: 0.2 },
  // Put roughly three months of revenue aside as a cushion.
  'Improve cash flow': { name: 'Build a Cash Buffer', color: '#3b82f6', shareOfBand: 0.25 },
  // Get a year's worth of money actually recorded.
  'Get organized': { name: 'Track Every Dollar', color: '#8b5cf6', shareOfBand: 1 },
};

function targetFor(goal: PrimaryGoal, revenueRange?: string): number {
  const band = ANNUAL_BAND_TOP[revenueRange ?? ''] ?? DEFAULT_BAND_TOP;
  const raw = band * GOAL_TEMPLATES[goal].shareOfBand;
  // Round to something a person would actually type.
  return Math.max(100, Math.round(raw / 100) * 100);
}

/**
 * Create the goal that matches the user's chosen primary goal.
 *
 * Idempotent by name: re-saving the profile, or changing the answer and saving
 * again, never produces a duplicate. Silently does nothing if the user has no
 * business yet or skipped the question — this runs inside the onboarding save,
 * so it must never be the reason that save fails.
 */
export async function ensureGoalForPrimaryGoal(
  database: Database,
  userId: string,
  profile: BusinessProfile
): Promise<void> {
  const choice = profile.primaryGoal as PrimaryGoal | undefined;
  if (!choice || !GOAL_TEMPLATES[choice]) return;

  const businesses = new BusinessesRepository(database);
  const businessId = await businesses.getDefaultBusinessId(userId);
  if (!businessId) return;

  const template = GOAL_TEMPLATES[choice];

  const existing = await database.query(
    'SELECT 1 FROM user_goals WHERE business_id = $1::uuid AND name = $2 LIMIT 1',
    [businessId, template.name]
  );
  if (existing.rows.length > 0) return;

  const dashboard = new DashboardRepository(database);
  await dashboard.createGoal(businessId, userId, {
    name: template.name,
    current: 0,
    target: targetFor(choice, profile.revenueRange),
    color: template.color,
    period: 'This year',
  });
}
