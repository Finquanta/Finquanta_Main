"use client";
import React from 'react';
import Image from 'next/image';
import { useLanguage } from '@/hooks/context/LanguageContext';

const AiFocusSection = () => {
  const { t } = useLanguage();

  const featuresData = [
    { imagePath: "/images/maturity010.png", title: t("features", "maturity"), description: t("features", "maturityDesc") },
    { imagePath: "/images/nature.png", title: t("features", "nature"), description: t("features", "natureDesc") },
    { imagePath: "/images/niche.png", title: t("features", "niche"), description: t("features", "nicheDesc") },
    { imagePath: "/images/financial_health.png", title: t("features", "financialHealth"), description: t("features", "financialHealthDesc") },
  ];

  return (
    <section className="w-full pt-32 pb-20 bg-white px-4 sm:px-6 lg:px-8">
      <div className="relative py-12 mb-32 flex items-center justify-center overflow-hidden w-full">
        <Image src="/images/image_69.png" alt="Financial AI Technology Background" fill className="absolute object-cover z-0" priority />
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium text-white relative z-10 text-center px-4">
          {t("features", "banner")}
        </h2>
      </div>
      <div id="features" className="w-full px-4 sm:px-6 lg:px-8 pt-32">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-8 text-center">
          {t("features", "title")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16 w-full max-w-[1200px] mx-auto">
          {featuresData.map((feature, index) => (
            <div key={index} className="bg-[#00a907] text-white p-7 rounded-xl flex flex-col items-center text-center shadow-md">
              <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
              <div className="p-3 mb-4 inline-block flex items-center justify-center h-[100px]">
                <Image src={feature.imagePath} alt={`${feature.title} icon`} height={200} width={200} style={{ width: 'auto', height: '100px', objectFit: 'contain' }} quality={100} />
              </div>
              <p className="text-base sm:text-lg">{feature.description}</p>
            </div>
          ))}
        </div>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-center mb-8 mt-4">
          {t("features", "tagline")}
        </h3>
      </div>
    </section>
  );
};

export default AiFocusSection;