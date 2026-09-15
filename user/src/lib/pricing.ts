/**
 * What the marketing pages show about each plan: its price and the allowances
 * a buyer compares.
 *
 * ---------------------------------------------------------------------------
 * MIRRORS `server/src/modules/billing/plans.ts`. The server is what charges and
 * what gates; this is only what the pages promise.
 *
 * Prices used to be typed out separately on /pricing and in the comparison
 * table, and the homepage would have been a third copy. Everything that shows a
 * price or an allowance now reads from here, and `pricing.test.ts` imports the
 * server's catalogue and fails if the two disagree — so a price change cannot
 * land in one place and not the other.
 *
 * Not covered: the "Or $199.99/year" lines, which are whole translated
 * sentences in the locale files.
 * ---------------------------------------------------------------------------
 */

export type PlanDisplayKey = "freemium" | "starter" | "entrepreneur" | "business" | "corporate";

export interface PlanDisplay {
  key: PlanDisplayKey;
  /** Per seat, per month. */
  monthly: number;
  /** Per seat, per year — ten months of the monthly price. */
  annual: number;
  /** Priced by conversation rather than on the page. */
  contactSales: boolean;
  /** `null` is unlimited, as on the server. */
  finnaMessagesPerMonth: number | null;
  councilSessionsPerMonth: number | null;
  groups: number | null;
  scansPerMonth: number | null;
  exportsPerMonth: number | null;
}

export const PRICING: Record<PlanDisplayKey, PlanDisplay> = {
  freemium: {
    key: "freemium",
    monthly: 0,
    annual: 0,
    contactSales: false,
    finnaMessagesPerMonth: 50,
    councilSessionsPerMonth: 0,
    groups: 3,
    scansPerMonth: 5,
    exportsPerMonth: 1,
  },
  starter: {
    key: "starter",
    monthly: 19.99,
    annual: 199.99,
    contactSales: false,
    finnaMessagesPerMonth: 200,
    councilSessionsPerMonth: 0,
    groups: 10,
    scansPerMonth: 25,
    exportsPerMonth: 5,
  },
  entrepreneur: {
    key: "entrepreneur",
    monthly: 49.99,
    annual: 499.95,
    contactSales: false,
    finnaMessagesPerMonth: 500,
    councilSessionsPerMonth: 10,
    groups: null,
    scansPerMonth: 100,
    exportsPerMonth: 10,
  },
  business: {
    key: "business",
    monthly: 99.99,
    annual: 999.95,
    contactSales: false,
    finnaMessagesPerMonth: 2000,
    councilSessionsPerMonth: 30,
    groups: null,
    scansPerMonth: 500,
    exportsPerMonth: null,
  },
  corporate: {
    key: "corporate",
    monthly: 0,
    annual: 0,
    contactSales: true,
    finnaMessagesPerMonth: null,
    councilSessionsPerMonth: null,
    groups: null,
    scansPerMonth: null,
    exportsPerMonth: null,
  },
};

/**
 * Corporate is not being sold yet — the paid plans only just launched, and it
 * is revisited around November 2026. The button asks a question rather than
 * starting a sale, which is also why it is still worth having: what people ask
 * for over the next few months is the cheapest input into what the tier should
 * contain. Shared by /pricing and the homepage.
 */
export const CORPORATE_ENQUIRY =
  "mailto:jeeordahnoh@gmail.com" +
  "?subject=" + encodeURIComponent("Finquanta — Inquiry about the Corporate plan") +
  "&body=" + encodeURIComponent(
    "I would like to know more about the Corporate plan." + String.fromCharCode(10) + String.fromCharCode(10) +
    "What we are looking for:" + String.fromCharCode(10)
  );

/** "$19.99". Dollars, two decimals, as every price on the site is written. */
export const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

/**
 * A limit as the comparison table writes it: digits with a thousands separator,
 * an em dash for none, or the `pfUnlimited` translation key for no limit.
 */
export const limitCell = (limit: number | null) =>
  limit === null ? "pfUnlimited" : limit === 0 ? "—" : limit.toLocaleString("en-US");
