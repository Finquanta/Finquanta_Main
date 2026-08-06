'use client';

import Link from 'next/link';
import { useLanguage } from '@/hooks/context/LanguageContext';

export default function Pricing() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold mb-2">{t('pricing', 'pTitle')}</h1>
          <p className="text-sm text-gray-500">{t('pricing', 'pIntro')}</p>
          <div className="mt-4 inline-block bg-[#4CAF50] text-white px-8 py-2 rounded-full font-medium">
            {t('pricing', 'pFree')}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

          {/* Entrepreneur */}
          <div className="border-2 border-blue-400 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">{t('pricing', 'pEntrepreneur')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pEntDesc')}</p>
            <p className="text-2xl font-bold mb-1">$49.99/MO</p>
            <p className="text-xs text-gray-500 mb-6">{t('pricing', 'pEntYear')}</p>
            <Link href="/payment?plan=entrepreneur&price=49.99">
              <button className="bg-blue-500 text-white px-8 py-2 rounded-full font-bold hover:bg-blue-600 mb-6">
                {t('pricing', 'pBuyNow')}
              </button>
            </Link>
            <div className="mt-auto">
              <div className="flex flex-col items-center text-xs text-gray-500">
                <span>{t('pricing', 'pUsers3')}</span>
                <a href="#" className="underline">{t('pricing', 'pRequestDemo')}</a>
              </div>
            </div>
          </div>

          {/* Business - highlighted */}
          <div className="border-2 border-red-500 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">{t('pricing', 'pBusiness')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pBizDesc')}</p>
            <p className="text-2xl font-bold mb-1">$99.99/MO</p>
            <p className="text-xs text-gray-500 mb-6">{t('pricing', 'pBizYear')}</p>
            <Link href="/payment?plan=business&price=99.99">
              <button className="bg-red-500 text-white px-8 py-2 rounded-full font-bold hover:bg-red-600 mb-2">
                {t('pricing', 'pBuyNow')}
              </button>
            </Link>
            <p className="text-xs text-gray-500 mb-6">{t('pricing', 'pRecSmall')}</p>
            <div className="mt-auto">
              <div className="flex flex-col items-center text-xs text-gray-500">
                <span>{t('pricing', 'pUsers5')}</span>
                <a href="#" className="underline">{t('pricing', 'pRequestDemo')}</a>
              </div>
            </div>
          </div>

          {/* Corporate */}
          <div className="border-2 border-gray-300 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">{t('pricing', 'pCorporate')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pCorpDesc')}</p>
            <p className="text-sm text-gray-600 mb-4">{t('pricing', 'pCorpDesc2')}</p>
            <button className="border-2 border-gray-400 text-gray-600 px-8 py-2 rounded-full font-bold hover:bg-gray-100 mb-2">
              {t('pricing', 'pContactSales')}
            </button>
            <p className="text-xs text-gray-500">{t('pricing', 'pRecCorp')}</p>
          </div>

        </div>

        {/* Feature comparison */}
        <p className="text-center text-sm text-gray-600 mt-10">
          {t('pricing', 'pSeeCompare')}{' '}
          <Link href="/pricing-comparison" className="underline">{t('pricing', 'pHere')}</Link>.
        </p>

      </div>
    </main>
  );
}
