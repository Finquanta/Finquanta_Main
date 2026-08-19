/**
 * The plan catalogue — spec 08 §1.
 *
 * One place defining every tier, what it costs, what it unlocks and what it
 * caps. Everything else reads from here: the entitlements service, the admin
 * panel, projected MRR, and the pricing page.
 *
 * NO STRIPE YET. These prices exist so the product can show them and so revenue
 * can be projected from assigned plans; when billing lands, each entry maps to a
 * Stripe Price and Stripe becomes the source of truth for what is actually
 * charged. Until then nothing here moves money.
 */

export const PLAN_KEYS = ['freemium', 'entrepreneur', 'business', 'corporate'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const isPlanKey = (v: unknown): v is PlanKey => PLAN_KEYS.includes(v as PlanKey);

/**
 * What a plan unlocks. Deliberately a flat set of booleans rather than a tier
 * comparison scattered through the code: a route asks "may this business use
 * the graph", not "is this business at least Entrepreneur". Moving a feature
 * between tiers then means editing this file and nothing else.
 */
export interface PlanFeatures {
  /** Company Brain graph view — spec 06 §9, paid only. */
  brainGraph: boolean;
  /** Backlinks panel — spec 06 §9, paid only. */
  brainBacklinks: boolean;
  /** Auto-summarisation and AI auto-linking — spec 06 §7.1, paid only. */
  brainAutoAI: boolean;
  /** Finna Council — spec 07 §5, Business and above. */
  council: boolean;
  /** Cash-flow forecasting and scenario projections. */
  forecasting: boolean;
  /** More than one workspace per account. */
  multipleBusinesses: boolean;
  /** Portfolio view across businesses. */
  portfolio: boolean;
}

/**
 * Numeric limits. `null` means unlimited.
 *
 * These are MONTHLY, per spec 08, and are about what a customer has bought.
 * They sit alongside the existing DAILY ceilings in ai-usage and council, which
 * are a different thing entirely — those protect a small prepaid Anthropic
 * balance from a runaway, and apply no matter what anyone has paid for. A
 * request has to satisfy both.
 */
export interface PlanLimits {
  finnaMessagesPerMonth: number | null;
  councilSessionsPerMonth: number | null;
  groups: number | null;
  importsPerMonth: number | null;
  businesses: number | null;
}

export interface Plan {
  key: PlanKey;
  name: string;
  /** Per seat, per month, in whole currency units. */
  monthly: number;
  /** Per seat, per year. Ten months of the monthly price. */
  annual: number;
  /** Corporate is priced by conversation, not by the pricing page. */
  contactSales: boolean;
  features: PlanFeatures;
  limits: PlanLimits;
}

const NOTHING: PlanFeatures = {
  brainGraph: false,
  brainBacklinks: false,
  brainAutoAI: false,
  council: false,
  forecasting: false,
  multipleBusinesses: false,
  portfolio: false,
};

export const PLANS: Record<PlanKey, Plan> = {
  freemium: {
    key: 'freemium',
    name: 'Freemium',
    monthly: 0,
    annual: 0,
    contactSales: false,
    // The Brain itself is free — categories, notes, tasks, links and live data
    // pins. Spec 06 §9 is explicit that this is core product, not an upsell:
    // it is where a new user's understanding of their own business starts.
    features: { ...NOTHING },
    limits: {
      finnaMessagesPerMonth: 50,
      councilSessionsPerMonth: 0,
      groups: 3,
      importsPerMonth: 3,
      businesses: 1,
    },
  },

  entrepreneur: {
    key: 'entrepreneur',
    name: 'Entrepreneur',
    monthly: 49.99,
    annual: 499.95,
    contactSales: false,
    features: {
      ...NOTHING,
      brainGraph: true,
      brainBacklinks: true,
      brainAutoAI: true,
      // Council starts here, not at Business. Spec 07 §5 put it higher, but the
      // pricing page sells it at this tier and the two must not disagree — a
      // page promising something the server 402s is a support ticket.
      council: true,
    },
    limits: {
      finnaMessagesPerMonth: 500,
      // Smaller allowance than Business rather than the same one: a Council
      // session costs real money (~2c each, see council.service), so the tier
      // difference is how many, not whether.
      councilSessionsPerMonth: 10,
      groups: null,
      importsPerMonth: 50,
      businesses: 1,
    },
  },

  business: {
    key: 'business',
    name: 'Business',
    monthly: 99.99,
    annual: 999.95,
    contactSales: false,
    features: {
      ...NOTHING,
      brainGraph: true,
      brainBacklinks: true,
      brainAutoAI: true,
      council: true,
      forecasting: true,
      multipleBusinesses: true,
    },
    limits: {
      finnaMessagesPerMonth: 2000,
      councilSessionsPerMonth: 30,
      groups: null,
      importsPerMonth: null,
      businesses: 5,
    },
  },

  corporate: {
    key: 'corporate',
    name: 'Corporate',
    monthly: 0,
    annual: 0,
    contactSales: true,
    features: {
      brainGraph: true,
      brainBacklinks: true,
      brainAutoAI: true,
      council: true,
      forecasting: true,
      multipleBusinesses: true,
      portfolio: true,
    },
    limits: {
      finnaMessagesPerMonth: null,
      councilSessionsPerMonth: null,
      groups: null,
      importsPerMonth: null,
      businesses: null,
    },
  },
};

/**
 * What a trial gives you, and what a grandfathered account keeps.
 *
 * Business rather than Corporate: Corporate is a bespoke arrangement with
 * add-ons and custom Council members, not something to hand out automatically.
 * Business is "the whole product as sold", which is what both a trial and the
 * grandfather window are meant to represent.
 */
export const TRIAL_PLAN: PlanKey = 'business';

/** Trial lengths in days — spec 08 §4.1, tied to email verification. */
export const TRIAL_DAYS_UNVERIFIED = 7;
export const TRIAL_DAYS_VERIFIED = 14;

/** How long existing accounts keep what they already had, agreed with the user. */
export const GRANDFATHER_MONTHS = 6;

/** Plans a customer can buy without talking to anyone. */
export const SELF_SERVE_PLANS: PlanKey[] = ['freemium', 'entrepreneur', 'business'];
