'use client';

import { useCallback, useEffect, useState } from 'react';
import { MigrationResult, clearPendingDemo, hasPendingDemo, migratePendingDemo } from '@/lib/demo/migrate';
import { getMe } from '@/lib/api/me';
import { useLanguage } from '@/hooks/context/LanguageContext';

/**
 * Runs on the first dashboard a freshly signed-up user lands on: if they came
 * from the Try-It Demo, everything they built there is replayed into their real
 * account and reported here. Renders nothing when there's nothing pending, which
 * is the overwhelmingly common case.
 *
 * The stash lives in localStorage, which outlives the tab and the visitor, so
 * this resolves who is actually signed in and hands that to the migration —
 * which replays only if the stash names that same account. Without it, a demo
 * someone abandoned at the signup form would post itself into the books of
 * whoever next signed in on this browser.
 *
 * Fixed rather than inline: the dashboard pages don't share one container (some
 * use DashboardShell, some don't), and a fixed toast lands correctly on all of
 * them without touching each page's layout.
 */
/**
 * Where the migration result waits out the page reload that follows it. Session
 * scoped, so it can't outlive the tab and resurface later.
 */
const RESULT_KEY = 'finquanta_demo_migration_result';

export default function DemoMigrationBanner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const run = useCallback(async () => {
    // A result parked by the run that happened just before the reload below.
    const carried = window.sessionStorage.getItem(RESULT_KEY);
    if (carried) {
      window.sessionStorage.removeItem(RESULT_KEY);
      try { setResult(JSON.parse(carried) as MigrationResult); } catch { /* ignore */ }
      setStatus('done');
      return;
    }

    // Cheap local check first, so the common no-stash case costs no request.
    if (!hasPendingDemo()) return;
    setStatus('running');
    try {
      const me = await getMe();
      const r = await migratePendingDemo(me.id);

      // The dashboard fetched its data before any of this landed, and nothing
      // tells it to look again — which is why the books stayed empty until a
      // tab switch forced a refetch. Reload so every card reads the finished
      // account, and carry the result across so the summary still gets shown.
      // The veil stays up because we never leave 'running'.
      if (r && !r.allFailed) {
        window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(r));
        window.location.reload();
        return;
      }
      setResult(r);
    } catch {
      setResult(null);
    }
    setStatus('done');
  }, []);

  useEffect(() => { void run(); }, [run]);

  if (status === 'idle' || dismissed) return null;

  if (status === 'running') {
    // A full-screen veil, not just a toast. The replay is one network round trip
    // per record, so the dashboard underneath renders empty and then fills in
    // piecemeal — which reads as "my data is missing" at exactly the moment the
    // user is looking for it. Cover it until we know what actually landed.
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <span className="h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-gray-900">{t("demo","dMigLoading")}</p>
          <p className="text-xs text-gray-600 max-w-xs">{t("demo","dMigLoadingBody")}</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Nothing landed. The stash is still there, so this is recoverable — say so
  // rather than reporting a success that didn't happen.
  if (result.allFailed) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">{t("demo","dMigFailTitle")}</p>
          <p className="text-xs text-amber-800 mt-0.5">{t("demo","dMigFailBody")}</p>
          {/* The actual reason. Guessing "check your connection" sent people
              chasing their wifi when the real answer was a server response. */}
          {result.firstError && (
            <p className="text-xs text-amber-700 mt-1 font-mono break-words">{result.firstError}</p>
          )}
          <button
            onClick={() => { setResult(null); setStatus('idle'); void run(); }}
            className="mt-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg"
          >{t("demo","dMigRetry")}</button>
        </div>
        <button
          onClick={() => { clearPendingDemo(); setDismissed(true); }}
          className="text-amber-700 hover:text-amber-900 text-lg leading-none px-1"
          aria-label={t("demo","dMigDiscard")}
        >
          ×
        </button>
      </div>
    );
  }

  // Same dictionary the signup prompt uses, so "3 entries and 1 invoice" reads
  // identically before and after the handoff.
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${t('demo', n === 1 ? one : many)}`;
  if (result.transactions) parts.push(plural(result.transactions, 'tgEntry', 'tgEntries'));
  if (result.invoices) parts.push(plural(result.invoices, 'tgInvoice', 'tgInvoices'));
  if (result.customers) parts.push(plural(result.customers, 'tgCustomer', 'tgCustomers'));
  if (result.groups) parts.push(plural(result.groups, 'tgGroup', 'tgGroups'));
  if (result.loans) parts.push(plural(result.loans, 'tgLoan', 'tgLoans'));
  if (result.entries) parts.push(plural(result.entries, 'tgLedgerEntry', 'tgLedgerEntries'));

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-lg flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-green-900">{t("demo","dMigOkTitle")}</p>
        {parts.length > 0 && (
          <p className="text-xs text-green-800 mt-0.5">
            {t("demo","dMigCarried").split("{list}").join(parts.join(', '))}
          </p>
        )}
        {result.invoices > 0 && (
          <p className="text-xs text-green-800 mt-1">{t("demo","dMigDrafts")}</p>
        )}
        {result.failed > 0 && (
          <>
            <p className="text-xs text-amber-700 mt-1">
              {result.failed === 1
                ? t("demo","dMigSkippedOne")
                : t("demo","dMigSkippedMany").split("{n}").join(String(result.failed))}
            </p>
            {/* Say WHICH failure it was. Reporting a skipped item without the
                reason leaves the user with no way to tell what they lost. */}
            {result.firstError && (
              <p className="text-xs text-amber-700 mt-0.5 font-mono break-words">{result.firstError}</p>
            )}
          </>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="text-green-700 hover:text-green-900 text-lg leading-none px-1" aria-label={t("demo","dMigDismiss")}>
        ×
      </button>
    </div>
  );
}
