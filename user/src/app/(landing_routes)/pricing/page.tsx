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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">

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

        {/*
          One shape, four times.
          These were four hand-built cards with slightly different spacing —
          one had mb-6 on its button where another had mb-2, one had no
          "recommended" line, Corporate had no price row at all — so nothing
          lined up across the row. Rendering them from a single description
          makes the alignment structural rather than something to keep matching
          by hand, and every slot is always present even when it is empty.
        */}
        {/*
          SUBGRID, so the rows are genuinely shared rather than approximately
          equal.

          These cards were first four hand-built blocks, then one shape with
          min-heights. Both drifted for the same reason: a min-height only holds
          while the content FITS. One longer description — or one longer
          translation, in any of ten locales — and that card's price, button and
          footer all slide down while its neighbours stay put.

          Each card now spans the same eight parent rows and inherits their
          heights, so every title, price, button and footer sits on one line by
          construction. Nothing to keep in sync, and it survives copy changes.
        */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8"
          style={{ gridTemplateRows: 'repeat(8, auto)' }}
        >
          {[
            {
              key: 'starter',
              name: t('pricing', 'pStarter'),
              desc: t('pricing', 'pStarterDesc'),
              price: '$19.99',
              yearly: t('pricing', 'pStarterYear'),
              border: 'border-yellow-400',
              button: 'bg-yellow-400 text-white hover:bg-yellow-500',
              recommended: t('pricing', 'pRecStarter'),
              users: '',
            },
            {
              key: 'entrepreneur',
              name: t('pricing', 'pEntrepreneur'),
              desc: t('pricing', 'pEntDesc'),
              price: '$49.99',
              yearly: t('pricing', 'pEntYear'),
              border: 'border-blue-400',
              button: 'bg-blue-500 text-white hover:bg-blue-600',
              recommended: t('pricing', 'pRecEnt'),
              users: t('pricing', 'pUsers3'),
            },
            {
              key: 'business',
              name: t('pricing', 'pBusiness'),
              desc: t('pricing', 'pBizDesc'),
              price: '$99.99',
              yearly: t('pricing', 'pBizYear'),
              border: 'border-red-500',
              button: 'bg-red-500 text-white hover:bg-red-600',
              recommended: t('pricing', 'pRecSmall'),
              users: t('pricing', 'pUsers5'),
            },
            {
              key: 'corporate',
              name: t('pricing', 'pCorporate'),
              desc: t('pricing', 'pCorpDesc'),
              // Priced by conversation, so the price row carries a word rather
              // than a figure — the row still exists, so the buttons below it
              // stay on the same line as the others.
              price: t('pricing', 'pContactSales'),
              yearly: t('pricing', 'pCorpDesc2'),
              border: 'border-gray-300',
              button: 'border-2 border-gray-400 text-gray-600 hover:bg-gray-100',
              recommended: t('pricing', 'pRecCorp'),
              users: '',
              enquiry: true,
            },
          ].map((plan) => (
            <div
              key={plan.key}
              className={`border-2 ${plan.border} rounded-xl p-5 text-center grid gap-0`}
              style={{ gridRow: 'span 8', gridTemplateRows: 'subgrid' }}
            >
              {/* 1 */} <h2 className="text-base font-bold tracking-wide self-start">{plan.name}</h2>
              {/* 2 */} <p className="text-[13px] leading-snug text-gray-600 self-start pt-2">{plan.desc}</p>

              {/* 3 — "/MO" is not decoration: it is the difference between a
                       price and a number. Corporate is the exception, since its
                       row carries a word. */}
              <p className={`font-bold self-end pt-3 ${plan.enquiry ? 'text-base' : 'text-2xl'}`}>
                {plan.price}{plan.enquiry ? '' : '/MO'}
              </p>

              {/* 4 */} <p className="text-[11px] leading-snug text-gray-500 self-start pt-0.5">{plan.yearly}</p>

              {/* 5 — billing is per seat, so a team of four pays four times
                       this. Said here rather than in the FAQ: finding out later
                       is the kind of surprise that loses trust. */}
              <p className="text-[11px] font-semibold text-gray-700 self-start pt-0.5">
                {plan.enquiry ? '' : t('pricing', 'pPerSeat')}
              </p>

              {/* 6 — every button carries border-2 (transparent on the solid
                       ones) so the bordered Corporate one is not taller. */}
              <div className="self-end pt-3.5">
                {plan.enquiry ? (
                  <a
                    href={CORPORATE_ENQUIRY}
                    className={`${plan.button} block w-full px-4 py-1.5 rounded-full font-bold text-sm text-center`}
                  >
                    {t('pricing', 'pContactSales')}
                  </a>
                ) : (
                  /* Signup, not checkout. Buying needs a signed-in user AND a
                     workspace — the server reads the seat count off it to work
                     out the quantity — so a visitor needs an account before
                     Stripe can be handed anything. `plan` is carried so the
                     dashboard opens on the one they picked; the PRICE never is,
                     because the server decides what things cost. */
                  <Link href={`/signup?plan=${plan.key}`} className="block">
                    <button className={`${plan.button} block w-full px-4 py-1.5 rounded-full font-bold text-sm border-2 border-transparent`}>
                      {t('pricing', 'pBuyNow')}
                    </button>
                  </Link>
                )}
              </div>

              {/* 7 */} <p className="text-[11px] leading-snug text-gray-500 self-start pt-2">{plan.recommended}</p>

              {/* 8 */}
              <div className="self-end pt-3 flex flex-col items-center text-[11px] text-gray-500 gap-0.5">
                {plan.users ? <span>{plan.users}</span> : null}
                <Link href="/demo" className="underline">{t('pricing', 'pRequestDemo')}</Link>
              </div>
            </div>
          ))}
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
