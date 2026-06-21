"use client";

import { useState, useEffect } from "react";
import AiFocusSection from "@/components/pages/home/AiFocusSection";
import FaqSection from "@/components/pages/home/FaqSection";
import HeroSection from "@/components/pages/home/HeroSection";
import MobilePromoSection from "@/components/pages/home/MobilePromoSection";
import NewsletterSection from "@/components/pages/home/NewsletterSection";
import SocialConnectSection from "@/components/pages/home/SocialConnectSection";
import Link from "next/link";
import { useLanguage } from "@/hooks/context/LanguageContext"; // ← ADD THIS

export default function Home() {
  const { t } = useLanguage(); // ← ADD THIS
  const [showCTA, setShowCTA] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (dismissed) return;
      const scrollY = window.scrollY;
      const triggerPoint = window.innerHeight * 1.5;
      if (scrollY > triggerPoint) {
        setShowCTA(true);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dismissed]);

  const handleDismiss = () => {
    setShowCTA(false);
    setDismissed(true);
  };

  return (
    <main>
      <HeroSection />
      <AiFocusSection />
      <MobilePromoSection />
      <FaqSection />
      <NewsletterSection />
      <SocialConnectSection />

      {/* CTA Popup */}
      {showCTA && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center relative">
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              x
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {t('cta', 'title')}       {/* ← WAS: "Start saving today!" */}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {t('cta', 'description')} {/* ← WAS: "Experience the future..." */}
            </p>
            <Link
              href="/signup"
              onClick={handleDismiss}
              className="inline-block bg-green-500 hover:bg-green-600 text-white font-medium px-6 py-3 rounded-lg text-sm"
            >
              {t('cta', 'button')}      {/* ← WAS: "Sign up now" */}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}