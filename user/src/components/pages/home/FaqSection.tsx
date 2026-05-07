"use client";
import React from 'react';
import { useLanguage } from '@/hooks/context/LanguageContext';

const FaqSection = () => {
  const { t } = useLanguage();

  const faqData = [
    { id: "item-1", question: t("faq", "q1"), answer: t("faq", "a1") },
    { id: "item-2", question: t("faq", "q2"), answer: t("faq", "a2") },
    { id: "item-3", question: t("faq", "q3"), answer: t("faq", "a3") },
  ];

  return (
    <section id="faq" className="container py-20 bg-white">
      <div className="mx-auto pb-4 sm:px-6 lg:px-36">
        <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold mb-12 text-center">
          {t("faq", "title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 sm:px-6 lg:px-10 w-full max-w-full">
          {faqData.map((item) => (
            <div key={item.id} className="bg-[#33B736] p-6 sm:p-8 rounded-lg text-white text-center flex flex-col h-full">
              <h3 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4">{item.question}</h3>
              <p className="text-sm sm:text-base">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;