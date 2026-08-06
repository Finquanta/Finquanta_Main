'use client';

import React from 'react';
import { useLanguage } from '@/hooks/context/LanguageContext';

export default function InboxPage() {
  const { t } = useLanguage();
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">{t("dashboard","inbTitle")}</h1>
      <div className="space-y-4">
        <p className="text-gray-600">{t("dashboard","inbWelcome")}</p>
        <div className="grid gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <h2 className="font-semibold mb-2">{t("dashboard","inbNoMessages")}</h2>
            <p className="text-sm text-gray-500">{t("dashboard","inbEmptyHint")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
