'use client';

import { Check, Hourglass, X } from 'lucide-react';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { PRICING, limitCell, type PlanDisplay } from '@/lib/pricing';

/**
 * The feature comparison grid.
 *
 * Lives under the plan cards on /pricing, where people are already deciding.
 * The old standalone /pricing-comparison page now redirects here.
 *
 * Rows carry a translation key rather than a label: the table is rendered from
 * this list, so a literal string here is a string no language can reach.
 *
 * ---------------------------------------------------------------------------
 * THE ALLOWANCE ROWS READ `lib/pricing.ts`, which mirrors
 * `server/src/modules/billing/plans.ts` and is held to it by pricing.test.ts.
 * THE TICKS AND CROSSES BELOW ARE STILL TYPED OUT HERE, and must match plans.ts.
 *
 * The server is what actually gates a feature and counts an allowance; this is
 * only what the page claims. They have already drifted twice — Council and
 * Company Brain both needed correcting in two places on the same day — so if
 * you change a tier here, change plans.ts in the same commit. A page promising
 * something entitlements refuses is a support ticket with extra steps.
 * ---------------------------------------------------------------------------
 */

type Cell = boolean | string;

interface Row {
  key: string;
  /** A section heading rather than a feature. */
  section?: boolean;
  free?: Cell;
  starter?: Cell;
  entrepreneur?: Cell;
  business?: Cell;
  /**
   * Designed but not built. Rendered amber rather than green, because a tick a
   * customer cannot use is worse than an honest "coming soon".
   */
  soon?: boolean;
}

/** A row of numbers read from the plan catalogue, so the table cannot advertise a limit the server doesn't enforce. */
const limitRow = (key: string, pick: (plan: PlanDisplay) => number | null): Row => ({
  key,
  free: limitCell(pick(PRICING.freemium)),
  starter: limitCell(pick(PRICING.starter)),
  entrepreneur: limitCell(pick(PRICING.entrepreneur)),
  business: limitCell(pick(PRICING.business)),
});

const ROWS: Row[] = [
  { key: 'pfSecCore', section: true },
  { key: 'pfBookkeeping', free: true, starter: true, entrepreneur: true, business: true },
  { key: 'pfAccounting', free: true, starter: true, entrepreneur: true, business: true },
  { key: 'pfPlan', free: true, starter: true, entrepreneur: true, business: true },
  { key: 'pfProposal', free: true, starter: true, entrepreneur: true, business: true },
  { key: 'pfMultiCurrency', free: true, starter: true, entrepreneur: true, business: true },

  { key: 'pfSecBrain', section: true },
  // Split into its real gates. As one row it either overpromised (Freemium
  // does get notes) or undersold (the graph genuinely is paid).
  { key: 'pfBrainNotes', free: true, starter: true, entrepreneur: true, business: true },
  { key: 'pfBrainGraph', free: false, starter: true, entrepreneur: true, business: true },
  { key: 'pfBrainBacklinks', free: false, starter: false, entrepreneur: true, business: true },
  { key: 'pfBrainAuto', free: false, starter: false, entrepreneur: true, business: true },
  { key: 'pfCouncil', free: false, starter: false, entrepreneur: true, business: true },

  { key: 'pfSecLimits', section: true },
  // Numbers, not ticks — the tiers mostly differ by how much, not whether.
  { key: 'pfSeats', free: '1', starter: 'pfPerSeatCell', entrepreneur: 'pfPerSeatCell', business: 'pfPerSeatCell' },
  limitRow('pfFinnaMsgs', (p) => p.finnaMessagesPerMonth),
  limitRow('pfCouncilSessions', (p) => p.councilSessionsPerMonth),
  limitRow('pfGroups', (p) => p.groups),
  limitRow('pfScans', (p) => p.scansPerMonth),
  // Books Export.
  limitRow('pfExports', (p) => p.exportsPerMonth),
  /**
   * NO WORKSPACES ROW, deliberately.
   *
   * A plan covers one workspace, and a second workspace is bought — it carries
   * its own subscription and is charged by ITS seats, like the first. So there
   * is no "workspaces included" number to advertise: the honest answer is the
   * same on every tier, and a column of 1s reads as a limit being imposed
   * rather than a unit of purchase being described.
   *
   * Per-seat pricing is already stated on the cards and in the pfSeats row
   * above, which is where this belongs.
   */

  { key: 'pfSecSoon', section: true },
  /**
   * Every tier answers every row — a cross, never a blank. An empty cell reads
   * as an oversight; a cross is an answer.
   *
   * Starter gets bank feeds: they are what turn bookkeeping from typing into
   * checking, and they are worth paying to move off Freemium for. The rest of
   * this section stays crossed for Starter, which is where the line between it
   * and Entrepreneur actually falls.
   *
   * DOCUMENT IMPORT USED TO SIT ON THAT LINE TOO, and deliberately no longer
   * does. Freemium now gets 5 scans a month (see pfScans above, and
   * scansPerMonth in server/src/modules/billing/plans.ts). The trade was made
   * knowingly: watching a photograph fill in your own books once sells the
   * feature far better than a row on this table describing it, and the cap is
   * small enough that it stays a taste rather than a free tier. It has also
   * shipped, so it is no longer marked `soon`.
   *
   * The tiers are drawn to sell, not to describe a persona — "for freelancers"
   * is how Starter is MARKETED, and nothing here should be reasoned about as
   * though the plan were technically limited to one person.
   */
  { key: 'pfBank', free: false, starter: true, entrepreneur: true, business: true, soon: true },
  { key: 'pfDocImport', free: true, starter: true, entrepreneur: true, business: true },
  { key: 'pfForecasting', free: false, starter: false, entrepreneur: true, business: true, soon: true },
  { key: 'pfTaxes', free: false, starter: false, entrepreneur: true, business: true, soon: true },
  { key: 'pfPayroll', free: false, starter: false, entrepreneur: true, business: true, soon: true },
  { key: 'pfStatements', free: false, starter: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfAdmin', free: false, starter: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfAudits', free: false, starter: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfContracts', free: false, starter: false, entrepreneur: false, business: true, soon: true },
];

/** Plan names are brand names, the same in every language — as on the plan cards above the table. */
const PLAN_COLUMNS = ['Freemium', 'Starter', 'Entrepreneur', 'Business'];

/**
 * Tick, hourglass, cross.
 *
 * Amber only where the feature is planned FOR THAT TIER — a tier that was never
 * getting it stays a cross, so amber always reads as "you will get this" rather
 * than blurring into "maybe".
 *
 * Drawn icons, not emoji: emoji render as full-colour glyphs from the system
 * font, so they ignore the text colour and look nothing like the marks beside
 * them.
 */
function Mark({ on, soon }: { on: boolean; soon?: boolean }) {
  if (on && soon) {
    return (
      <span
        aria-label="coming soon"
        title="In development"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600"
      >
        <Hourglass className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  return on ? (
    <span aria-label="included" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-fq-green/15 text-[#1E9E2A]">
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  ) : (
    <span aria-label="not included" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-fq-card-alt text-fq-slate/60">
      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

export default function ComparisonTable() {
  const { t } = useLanguage();

  /** A cell is either a tick/cross or a value; values may be translation keys. */
  const renderCell = (value: Cell | undefined, soon?: boolean) => {
    if (typeof value === 'boolean') return <Mark on={value} soon={soon} />;
    if (!value) return null;
    // Bare punctuation and digits are the same in every language; only real
    // words go through the translator.
    const text = /^[\d.,—-]+$/.test(value) ? value : t('pricing', value);
    return <span className="text-sm font-semibold text-fq-ink">{text}</span>;
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-fq-ink/10 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-fq-card-alt">
              <th scope="col" className="sticky left-0 z-10 bg-fq-card-alt px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-fq-slate">
                {t('pricing', 'pFeatures')}
              </th>
              {PLAN_COLUMNS.map((name) => (
                <th key={name} scope="col" className="px-4 py-4 text-center font-semibold text-fq-ink">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) =>
              row.section ? (
                // Section bands break a long list into things you can scan.
                <tr key={row.key}>
                  <td colSpan={5} className="bg-fq-bg px-5 pb-2 pt-6 text-left text-[11px] font-semibold uppercase tracking-wider text-fq-slate">
                    {t('pricing', row.key)}
                  </td>
                </tr>
              ) : (
                <tr key={row.key} className={`border-t border-fq-ink/[0.06] ${row.soon ? 'bg-amber-50/40' : ''}`}>
                  <th scope="row" className={`sticky left-0 z-10 px-5 py-3.5 text-left font-normal text-fq-ink/80 ${row.soon ? 'bg-[#FFFCF3]' : 'bg-white'}`}>
                    {t('pricing', row.key)}
                  </th>
                  <td className="px-4 py-3.5 text-center">{renderCell(row.free, row.soon)}</td>
                  <td className="px-4 py-3.5 text-center">{renderCell(row.starter, row.soon)}</td>
                  <td className="px-4 py-3.5 text-center">{renderCell(row.entrepreneur, row.soon)}</td>
                  <td className="px-4 py-3.5 text-center">{renderCell(row.business, row.soon)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Without this the amber is just an unexplained third colour. */}
      <p className="flex items-center justify-center gap-2 border-t border-fq-ink/[0.06] px-5 py-4 text-xs text-fq-slate">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Hourglass className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
        {t('pricing', 'pfComingSoon')}
      </p>
    </div>
  );
}
