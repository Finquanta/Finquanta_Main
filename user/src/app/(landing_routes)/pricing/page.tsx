'use client';

import ComparisonTable from '@/components/pricing/ComparisonTable';
import PricingSection from '@/components/pages/home/PricingSection';
import { useLanguage } from '@/hooks/context/LanguageContext';

/**
 * /pricing: the same plan cards as the homepage, then the full feature
 * comparison. Sharing PricingSection keeps the two pages from drifting — the
 * cards used to be a separate hand-built set here, in a different style, with
 * their own copy of every price.
 */
export default function Pricing() {
  const { t } = useLanguage();

  return (
    <div
      className="min-h-screen bg-fq-bg text-fq-ink"
      // The layout clears the floating nav with padding on a white page; pull
      // back up by that amount so the page background runs under the nav, and
      // add the clearance back inside.
      style={{
        marginTop: 'calc(-4.75rem - var(--maintenance-h, 0px))',
        paddingTop: 'calc(4.75rem + var(--maintenance-h, 0px))',
      }}
    >
      <PricingSection showCompareLink={false} titleAs="h1" />

      {/* The comparison sits directly under the prices rather than behind a
          link: someone weighing tiers is already deciding. */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-4xl">{t('home', 'compareFeaturesTitle')}</h2>
          <p className="mt-4 text-base leading-relaxed text-fq-slate">{t('home', 'compareFeaturesSub')}</p>
        </div>
        <div className="mt-10">
          <ComparisonTable />
        </div>
      </section>
    </div>
  );
}
