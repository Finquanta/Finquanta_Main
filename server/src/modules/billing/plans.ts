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

/**
 * Every plan, CHEAPEST FIRST — the order is the ranking.
 *
 * `indexOf` on this array decides what counts as an upgrade or a downgrade, so
 * inserting a tier in the wrong position would silently invert those: an
 * upgrade would bill as a downgrade and a downgrade would charge immediately.
 * Starter sits between Freemium and Entrepreneur.
 */
export const PLAN_KEYS = ['freemium', 'starter', 'entrepreneur', 'business', 'corporate'] as const;
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
  /**
   * VESTIGIAL — do not gate anything on this, and do not trust its value.
   *
   * It reads as "more than one workspace per account", which is true for every
   * account regardless of tier: workspaces are not rationed by plan. Each one
   * carries its own subscription and is billed by its own seats, so a second
   * workspace is a second purchase that starts on Freemium — not a perk to
   * unlock. The per-tier values below are leftovers from when this was a real
   * distinction and are kept only because the client still reads the shape.
   */
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
  /**
   * Workspaces allowed. `null` on every tier — workspaces are not capped.
   *
   * A workspace is the thing a plan is bought FOR, not something a plan doles
   * out: anyone may open another, it starts on Freemium, and it is billed by
   * its own seats if it is ever upgraded. This was briefly a real cap, to stop
   * people farming free trials by making workspaces; the trial is now claimed
   * against the user row instead, which fixes that without refusing business.
   */
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
      businesses: null,
    },
  },

  /**
   * For freelancers, sole traders and brand-new businesses — one person doing
   * their own books rather than a team.
   *
   * The line against Entrepreneur is the AI, not the bookkeeping. Everything
   * that records money is here in full, because a freelancer's invoices are
   * not worth less than a company's. What is smaller is Finna's allowance, and
   * the Council is absent entirely: a Council session costs real money to run,
   * and at $19.99 there is no room for it.
   *
   * The Brain graph is included deliberately. It is the thing people show other
   * people, and putting the most visible part of the product two tiers up makes
   * the cheap plan feel like a demo.
   */
  starter: {
    key: 'starter',
    name: 'Starter',
    monthly: 19.99,
    // Ten months for the price of twelve, matching the other tiers.
    annual: 199.99,
    contactSales: false,
    features: {
      ...NOTHING,
      brainGraph: true,
    },
    limits: {
      // Four times Freemium, well short of Entrepreneur's 500. Enough for daily
      // use by one person, not enough to run a team's questions through.
      finnaMessagesPerMonth: 200,
      // Council starts at Entrepreneur. Each session costs us real money, and
      // this tier does not carry it.
      councilSessionsPerMonth: 0,
      groups: 10,
      importsPerMonth: 20,
      businesses: null,
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
      // Vestigial, like the flag itself — nothing reads it. Anyone on any tier
      // may open another workspace; it starts on Freemium and is billed by its
      // own seats if they upgrade it.
      multipleBusinesses: false,
      // Forecasting is advertised as coming soon at this tier, so the flag has
      // to say so too. Nothing is gated by it yet — the feature does not exist —
      // but the day it ships, entitlements and the pricing page must already
      // agree, rather than the page promising what the server refuses.
      forecasting: true,
    },
    limits: {
      finnaMessagesPerMonth: 500,
      // Smaller allowance than Business rather than the same one: a Council
      // session costs real money (~2c each, see council.service), so the tier
      // difference is how many, not whether.
      councilSessionsPerMonth: 10,
      groups: null,
      importsPerMonth: 50,
      /**
       * One, like every self-serve tier.
       *
       * A plan buys a workspace; it does not buy a number of them. A second
       * workspace is a second purchase, carrying its own subscription and
       * charged by its own seats. It was briefly 3 to give a workspaces row on
       * the comparison table something to say — the row is gone, and with it
       * the only reason this was ever a number at all.
       */
      businesses: null,
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
      businesses: null,
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
export const SELF_SERVE_PLANS: PlanKey[] = ['freemium', 'starter', 'entrepreneur', 'business'];
