'use client';

import Link from 'next/link';
import { useLanguage } from '@/hooks/context/LanguageContext';

/**
 * Feature rows carry a translation key rather than a label: the table is
 * rendered from this list, so a literal string here is a string no language
 * can reach.
 */
const ROWS: { key: string; free: boolean; entrepreneur: boolean; business: boolean }[] = [
  { key: 'pfBookkeeping', free: true, entrepreneur: true, business: true },
  { key: 'pfPlan', free: true, entrepreneur: true, business: true },
  { key: 'pfProposal', free: true, entrepreneur: true, business: true },
  { key: 'pfAccounting', free: false, entrepreneur: true, business: true },
  { key: 'pfTaxes', free: false, entrepreneur: true, business: true },
  { key: 'pfAP', free: false, entrepreneur: true, business: true },
  { key: 'pfAR', free: false, entrepreneur: true, business: true },
  { key: 'pfCorrespondence', free: false, entrepreneur: true, business: true },
  { key: 'pfPayroll', free: false, entrepreneur: false, business: true },
  { key: 'pfStatements', free: false, entrepreneur: false, business: true },
  { key: 'pfAdmin', free: false, entrepreneur: false, business: true },
  { key: 'pfAudits', free: false, entrepreneur: false, business: true },
  { key: 'pfContracts', free: false, entrepreneur: false, business: true },
];

export default function PricingComparison() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">

        <h1 className="text-lg font-bold mb-3">{t('pricing', 'pCompareTitle')}</h1>
        <p className="text-sm text-gray-600 mb-8">{t('pricing', 'pCompareIntro')}</p>

        <div className="overflow-x-auto mb-8">
          <table className="w-full border border-gray-300 text-sm text-center">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-3 text-left">{t('pricing', 'pFeatures')}</th>
                <th className="border border-gray-300 px-4 py-3">{t('pricing', 'pFree')}</th>
                <th className="border border-gray-300 px-4 py-3">{t('pricing', 'pEntrepreneur')}</th>
                <th className="border border-gray-300 px-4 py-3">{t('pricing', 'pBusiness')}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-4 py-3 text-left">{t('pricing', row.key)}</td>
                  <td className="border border-gray-300 px-4 py-3">{row.free ? '✓' : ''}</td>
                  <td className="border border-gray-300 px-4 py-3">{row.entrepreneur ? '✓' : ''}</td>
                  <td className="border border-gray-300 px-4 py-3">{row.business ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-sm text-gray-600">
          {t('pricing', 'pSeePricing')}{' '}
          <Link href="/pricing" className="underline">{t('pricing', 'pHere')}</Link>.
        </p>

      </div>
    </main>
  );
}
