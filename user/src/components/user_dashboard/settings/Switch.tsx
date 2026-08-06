'use client';

import React from 'react';
import ToggleOffIcon from '@/components/icons/ToggleOffIcon';
import ToggleOnIcon from '@/components/icons/ToggleOnIcon';
import { useLanguage } from '@/hooks/context/LanguageContext';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Switch({ checked, onChange }: SwitchProps) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      className="focus:outline-none"
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
    >
      {checked ? (
        <ToggleOnIcon width={40} height={40} />
      ) : (
        <ToggleOffIcon width={40} height={40} />
      )}
      <span className="sr-only">{t("dashboard","spToggleSetting")}</span>
    </button>
  );
}