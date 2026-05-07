"use client";
import Link from 'next/link';
import { useLanguage } from '@/hooks/context/LanguageContext';

export default function PrivacyNotice() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">{t("legal", "privacyTitle")}</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: March 20th, 2026</p>
        <p className="text-sm text-gray-700 mb-6">{t("legal", "privacyIntro")}</p>

        <h2 className="font-bold mb-2">1. Overview</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta provides an AI-powered financial platform designed to help solopreneurs, startup founders, small businesses, and growing companies automate financial operations and gain deeper financial insights.</p>
        <h2 className="font-bold mb-2">2. Information We Collect</h2>
        <p className="text-sm text-gray-700 mb-6">We collect information including business name and details, company financial data, transaction records, uploaded documents and receipts, banking integration credentials, and contact information.</p>
        <h2 className="font-bold mb-2">3. Financial and Business Data</h2>
        <p className="text-sm text-gray-700 mb-6">The platform may process financial data such as revenue and expense records, transaction histories, invoices and payments, financial reports, and banking integrations.</p>
        <h2 className="font-bold mb-2">4. Automatically Collected Information</h2>
        <p className="text-sm text-gray-700 mb-6">When users access the platform, certain technical data may be collected automatically including device type, browser type, IP address, cookies, and session information.</p>
        <h2 className="font-bold mb-2">5. How We Use Information</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta uses collected data to deliver automated bookkeeping services, generate financial insights, operate AI-driven analysis systems, improve platform functionality, and respond to user support requests.</p>
        <h2 className="font-bold mb-2">6. AI and Data Processing</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta uses AI and machine learning to categorize transactions, identify financial trends, detect anomalies, and generate operational recommendations.</p>
        <h2 className="font-bold mb-2">7. Data Security</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta implements encryption of data in transit and at rest, access controls, audit logging, and secure cloud infrastructure.</p>
        <h2 className="font-bold mb-2">8. Data Sharing</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta does not sell or rent user financial data. We may share limited information with trusted third party service providers who assist in operating the platform.</p>
        <h2 className="font-bold mb-2">9. Data Ownership</h2>
        <p className="text-sm text-gray-700 mb-6">Users retain ownership of the financial and business data they provide to the platform.</p>
        <h2 className="font-bold mb-2">10. User Rights</h2>
        <p className="text-sm text-gray-700 mb-6">Users may request to access, update, export, or delete their account data through account settings or support channels.</p>
        <h2 className="font-bold mb-2">11. Data Retention</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta retains data only as long as necessary to operate the platform and comply with legal obligations.</p>
        <h2 className="font-bold mb-2">12. Changes to This Privacy Notice</h2>
        <p className="text-sm text-gray-700 mb-10">This Privacy Notice may be updated over time. If you have questions, contact us <a href="mailto:info@finquanta.com" className="underline">here</a>.</p>

        <div className="flex justify-center">
          <Link href="/" className="bg-[#4CAF50] text-white px-8 py-3 rounded-lg font-medium hover:bg-[#45a049]">
            {t("legal", "returnHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}