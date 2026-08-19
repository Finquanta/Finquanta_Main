'use client';

import Link from 'next/link';
import { useLanguage } from '@/hooks/context/LanguageContext';
import ComparisonTable from '@/components/pricing/ComparisonTable';


/**
 * Corporate is not being sold yet — the paid plans only just launched, and it
 * is revisited around November 2026. The button asks a question rather than
 * starting a sale, which is also why it is still worth having: what people ask
 * for over the next few months is the cheapest input into what the tier should
 * contain.
 *
 * It previously had no click handler at all, so the marketing site advertised
 * Corporate with a button that did nothing.
 */
const CORPORATE_ENQUIRY =
  'mailto:jeeordahnoh@gmail.com' +
  '?subject=' + encodeURIComponent('Finquanta — Inquiry about the Corporate plan') +
  '&body=' + encodeURIComponent(
    'I would like to know more about the Corporate plan.' + String.fromCharCode(10) + String.fromCharCode(10) +
    'What we are looking for:' + String.fromCharCode(10)
  );

export default function Pricing() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold mb-2">{t('pricing', 'pTitle')}</h1>
          <p className="text-sm text-gray-500">{t('pricing', 'pIntro')}</p>
          {/* The free tier is a real choice, so it goes where the other two
              go — to the thing that starts it. Signup, not checkout: there is
              nothing to pay for. */}
          <Link href="/signup" className="mt-4 inline-block bg-[#4CAF50] text-white px-8 py-2 rounded-full font-medium hover:bg-[#43a047]">
            {t('pricing', 'pFree')}
          </Link>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

          {/* Entrepreneur */}
          <div className="border-2 border-blue-400 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">{t('pricing', 'pEntrepreneur')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pEntDesc')}</p>
            <p className="text-2xl font-bold mb-1">$49.99/MO</p>
            <p className="text-xs text-gray-500">{t('pricing', 'pEntYear')}</p>
            {/* Billing is per seat, so a team of four pays four times this.
                Said here rather than in the FAQ, because finding out later is
                the kind of surprise that loses trust. */}
            <p className="text-xs font-semibold text-gray-700 mb-6">{t('pricing', 'pPerSeat')}</p>
            {/* Signup, not checkout. Buying needs a signed-in user AND a
                business — the server reads the seat count off the business to
                work out the quantity — so a visitor has to have an account
                before Stripe can be handed anything. `plan` is carried through
                so the dashboard can open on the plan they picked; the PRICE is
                never carried, because the server decides what things cost. */}
            <Link href="/signup?plan=entrepreneur">
              <button className="bg-blue-500 text-white px-8 py-2 rounded-full font-bold hover:bg-blue-600 mb-6">
                {t('pricing', 'pBuyNow')}
              </button>
            </Link>
            <div className="mt-auto">
              <div className="flex flex-col items-center text-xs text-gray-500">
                <span>{t('pricing', 'pUsers3')}</span>
                <Link href="/demo" className="underline">{t('pricing', 'pRequestDemo')}</Link>
              </div>
            </div>
          </div>

          {/* Business - highlighted */}
          <div className="border-2 border-red-500 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">{t('pricing', 'pBusiness')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pBizDesc')}</p>
            <p className="text-2xl font-bold mb-1">$99.99/MO</p>
            <p className="text-xs text-gray-500">{t('pricing', 'pBizYear')}</p>
            <p className="text-xs font-semibold text-gray-700 mb-6">{t('pricing', 'pPerSeat')}</p>
            <Link href="/signup?plan=business">
              <button className="bg-red-500 text-white px-8 py-2 rounded-full font-bold hover:bg-red-600 mb-2">
                {t('pricing', 'pBuyNow')}
              </button>
            </Link>
            <p className="text-xs text-gray-500 mb-6">{t('pricing', 'pRecSmall')}</p>
            <div className="mt-auto">
              <div className="flex flex-col items-center text-xs text-gray-500">
                <span>{t('pricing', 'pUsers5')}</span>
                <Link href="/demo" className="underline">{t('pricing', 'pRequestDemo')}</Link>
              </div>
            </div>
          </div>

          {/* Corporate */}
          <div className="border-2 border-gray-300 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">{t('pricing', 'pCorporate')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pCorpDesc')}</p>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pCorpDesc2')}</p>
            {/* This button had no click handler at all — the marketing site
                advertised Corporate with something that did nothing.
                Corporate is not being sold yet (revisited around Nov 2026), so
                it asks a question rather than starting a sale. */}
            <a
              href={CORPORATE_ENQUIRY}
              className="border-2 border-gray-400 text-gray-600 px-8 py-2 rounded-full font-bold hover:bg-gray-100 mb-2 inline-block"
            >
              {t('pricing', 'pContactSales')}
            </a>
            <p className="text-xs text-gray-500">{t('pricing', 'pRecCorp')}</p>
          </div>

        </div>

        {/* The comparison now sits directly under the prices rather than behind
            a link. Someone weighing three tiers is already deciding; sending
            them to another page to see what the tiers actually contain is a
            step that loses people. */}
        <div className="mt-16">
          <h2 className="text-center text-lg font-bold mb-2">{t('pricing', 'pCompareTitle')}</h2>
          <p className="text-center text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
            {t('pricing', 'pCompareIntro')}
          </p>
          <ComparisonTable />
        </div>

      </div>
    </main>
  );
}
