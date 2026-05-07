"use client";
import Link from 'next/link';
import { useLanguage } from '@/hooks/context/LanguageContext';

export default function TermsOfService() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">{t("legal", "termsTitle")}</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: March 20th, 2026</p>
        <p className="text-sm text-gray-700 mb-6">{t("legal", "termsIntro")}</p>

        <h2 className="font-bold mb-2">1. Description of the Service</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta is a software platform designed to assist businesses in managing financial operations through automation and analytics. The platform may include features such as automated bookkeeping, financial dashboards and reporting, AI-powered financial analysis, forecasting tools, and workflow automation.</p>
        <h2 className="font-bold mb-2">2. Eligibility</h2>
        <p className="text-sm text-gray-700 mb-6">You may use the Finquanta platform only if you are at least 18 years old, have the legal authority to enter into agreements, and are authorized to act on behalf of your business if using the platform for a company.</p>
        <h2 className="font-bold mb-2">3. User Accounts</h2>
        <p className="text-sm text-gray-700 mb-6">Users must create an account to access certain features of the platform. You are responsible for maintaining the confidentiality of your account credentials and restricting unauthorized access to your account.</p>
        <h2 className="font-bold mb-2">4. Acceptable Use</h2>
        <p className="text-sm text-gray-700 mb-6">Users agree not to misuse the platform. Prohibited activities include engaging in illegal activity, attempting to bypass system security, interfering with platform operations, or attempting to reverse-engineer software or AI systems.</p>
        <h2 className="font-bold mb-2">5. AI-Generated Outputs</h2>
        <p className="text-sm text-gray-700 mb-6">AI-generated outputs are provided for informational purposes only and users remain responsible for verifying financial information and making final business decisions.</p>
        <h2 className="font-bold mb-2">6. Intellectual Property</h2>
        <p className="text-sm text-gray-700 mb-6">All software, interfaces, design elements, and AI systems used by Finquanta are the intellectual property of Finquanta. Users are granted a limited, non-exclusive license to access and use the platform.</p>
        <h2 className="font-bold mb-2">7. Fees and Billing</h2>
        <p className="text-sm text-gray-700 mb-6">Certain features of the platform may require payment. Pricing will be clearly disclosed and billing cycles will be explained prior to payment.</p>
        <h2 className="font-bold mb-2">8. Service Availability</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta strives to maintain reliable platform availability, but access may occasionally be interrupted due to maintenance, technical issues, or external service disruptions.</p>
        <h2 className="font-bold mb-2">9. Limitation of Liability</h2>
        <p className="text-sm text-gray-700 mb-6">To the maximum extent permitted by law, Finquanta is not liable for business losses, financial decisions made using platform insights, inaccuracies in AI outputs, or system outages.</p>
        <h2 className="font-bold mb-2">10. Termination</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta may suspend or terminate accounts that violate these Terms of Service. Users may terminate their accounts at any time.</p>
        <h2 className="font-bold mb-2">11. Changes to the Terms</h2>
        <p className="text-sm text-gray-700 mb-6">Finquanta may update these Terms of Service from time to time. Continued use of the platform constitutes acceptance of the updated terms.</p>
        <h2 className="font-bold mb-2">12. Contact Information</h2>
        <p className="text-sm text-gray-700 mb-10">If you have questions, contact us <a href="mailto:info@finquanta.com" className="underline">here</a> and our team will be happy to help.</p>

        <div className="flex justify-center">
          <Link href="/" className="bg-[#4CAF50] text-white px-8 py-3 rounded-lg font-medium hover:bg-[#45a049]">
            {t("legal", "returnHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}