'use client';

import { Hourglass } from 'lucide-react';
import { useLanguage } from '@/hooks/context/LanguageContext';

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
 * THESE VALUES MIRROR `server/src/modules/billing/plans.ts` AND MUST MATCH IT.
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
  entrepreneur?: Cell;
  business?: Cell;
  /**
   * Designed but not built. Rendered amber rather than green, because a tick a
   * customer cannot use is worse than an honest "coming soon".
   */
  soon?: boolean;
}

const ROWS: Row[] = [
  { key: 'pfSecCore', section: true },
  { key: 'pfBookkeeping', free: true, entrepreneur: true, business: true },
  { key: 'pfAccounting', free: true, entrepreneur: true, business: true },
  { key: 'pfPlan', free: true, entrepreneur: true, business: true },
  { key: 'pfProposal', free: true, entrepreneur: true, business: true },
  { key: 'pfMultiCurrency', free: true, entrepreneur: true, business: true },

  { key: 'pfSecBrain', section: true },
  // Split into its real gates. As one row it either overpromised (Freemium
  // does get notes) or undersold (the graph genuinely is paid).
  { key: 'pfBrainNotes', free: true, entrepreneur: true, business: true },
  { key: 'pfBrainGraph', free: false, entrepreneur: true, business: true },
  { key: 'pfBrainBacklinks', free: false, entrepreneur: true, business: true },
  { key: 'pfBrainAuto', free: false, entrepreneur: true, business: true },
  { key: 'pfCouncil', free: false, entrepreneur: true, business: true },

  { key: 'pfSecLimits', section: true },
  // Numbers, not ticks — the tiers mostly differ by how much, not whether.
  { key: 'pfSeats', free: '1', entrepreneur: 'pfPerSeatCell', business: 'pfPerSeatCell' },
  { key: 'pfFinnaMsgs', free: '50', entrepreneur: '500', business: '2,000' },
  { key: 'pfCouncilSessions', free: '—', entrepreneur: '10', business: '30' },
  { key: 'pfGroups', free: '3', entrepreneur: 'pfUnlimited', business: 'pfUnlimited' },
  // No "workspaces" row. There is no workspace: `businesses` is a flat table
  // and the UI simply calls a business row a workspace, so the old row was
  // advertising a limit on a thing that does not exist as its own object. The
  // `businesses` limit stays in plans.ts, unenforced, until it means something.

  { key: 'pfSecSoon', section: true },
  { key: 'pfBank', free: false, entrepreneur: true, business: true, soon: true },
  { key: 'pfDocImport', free: false, entrepreneur: true, business: true, soon: true },
  { key: 'pfForecasting', free: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfTaxes', free: false, entrepreneur: true, business: true, soon: true },
  { key: 'pfPayroll', free: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfStatements', free: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfAdmin', free: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfAudits', free: false, entrepreneur: false, business: true, soon: true },
  { key: 'pfContracts', free: false, entrepreneur: false, business: true, soon: true },
];

/**
 * Green tick, amber hourglass, red cross.
 *
 * Amber only where the feature is planned FOR THAT TIER — a tier that was never
 * getting it stays a red cross, so amber always reads as "you will get this"
 * rather than blurring into "maybe".
 *
 * A drawn icon, not the hourglass emoji: emoji render as full-colour glyphs
 * from the system font, so they ignore the text colour and look nothing like
 * the flat ticks beside them.
 */
function Mark({ on, soon }: { on: boolean; soon?: boolean }) {
  if (on && soon) {
    return (
      <span
        aria-label="coming soon"
        title="In development"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white"
      >
        <Hourglass className="h-3 w-3" strokeWidth={2.5} />
      </span>
    );
  }
  return on ? (
    <span aria-label="included" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">✓</span>
  ) : (
    <span aria-label="not included" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">✕</span>
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
    return <span className="text-sm font-semibold text-gray-800">{text}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm text-center">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('pricing', 'pFeatures')}</th>
            <th className="px-4 py-3 font-semibold text-gray-700">{t('pricing', 'pFree')}</th>
            <th className="px-4 py-3 font-semibold text-gray-700">{t('pricing', 'pEntrepreneur')}</th>
            <th className="px-4 py-3 font-semibold text-gray-700">{t('pricing', 'pBusiness')}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) =>
            row.section ? (
              // Section bands, like the reference charts — they break a long
              // list into things you can actually scan.
              <tr key={row.key} className="bg-gray-200/70">
                <td colSpan={4} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                  {t('pricing', row.key)}
                </td>
              </tr>
            ) : (
              <tr key={row.key} className={row.soon ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 text-left text-gray-700">{t('pricing', row.key)}</td>
                <td className="px-4 py-3">{renderCell(row.free, row.soon)}</td>
                <td className="px-4 py-3">{renderCell(row.entrepreneur, row.soon)}</td>
                <td className="px-4 py-3">{renderCell(row.business, row.soon)}</td>
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* Without this the amber is just an unexplained third colour. */}
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-white">
          <Hourglass className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
        {t('pricing', 'pfComingSoon')}
      </p>
    </div>
  );
}
