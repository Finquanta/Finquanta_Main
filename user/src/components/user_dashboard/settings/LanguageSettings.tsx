'use client';

import React, { useState } from 'react';
import { LanguageSettings as LanguageSettingsType } from './types';
import { Globe, Clock, Calendar, DollarSign, Ruler } from 'lucide-react';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';

interface LanguageSettingsProps {
  settings: LanguageSettingsType;
  onSettingsChange: (settings: LanguageSettingsType) => void;
}

const languages = [
  { code: 'en-US', name: 'English (United States)', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French (France)', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German (Germany)', flag: '🇩🇪' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', flag: '🇸🇦' }
];

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' }
];

const timeZones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)', offset: 'UTC+0' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)', offset: 'UTC+1' },
  { value: 'Europe/Moscow', label: 'Moscow Time (MSK)', offset: 'UTC+3' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)', offset: 'UTC+4' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)', offset: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', offset: 'UTC+9' }
];

const dateFormats = [
  { value: 'MM/DD/YYYY', label: '12/31/2024', example: '12/31/2024' },
  { value: 'DD/MM/YYYY', label: '31/12/2024', example: '31/12/2024' },
  { value: 'YYYY-MM-DD', label: '2024-12-31', example: '2024-12-31' },
  { value: 'DD MMM YYYY', label: '31 Dec 2024', example: '31 Dec 2024' },
  { value: 'MMMM DD, YYYY', label: 'December 31, 2024', example: 'December 31, 2024' }
];

export default function LanguageSettings({ settings, onSettingsChange }: LanguageSettingsProps) {
  const [customTimeZone, setCustomTimeZone] = useState('');
  const { language, setLanguage } = useLanguage();

  const handleTimeZoneChange = (timezone: string) => {
    onSettingsChange({
      ...settings,
      timeZone: timezone
    });
  };

  return (
    <div className="bg-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b263b] mb-2 flex items-center gap-2">
          <Globe className="w-6 h-6 text-[#150578]" />
          Language & Region
        </h2>
        <p className="text-sm text-[#778da9]">
          Configure your preferred language, timezone, and regional settings
        </p>
      </div>

      <div className="space-y-8">
        {/* Language Selection */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Display Language</h3>
          <div className="space-y-3">
           <select
  value={language}
  onChange={(e) => {
    setLanguage(e.target.value);
    onSettingsChange({ ...settings, language: e.target.value });
  }}
  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
>
  <option value="en">🇬🇧 English</option>
  <option value="es">🇪🇸 Spanish</option>
  <option value="fr">🇫🇷 French</option>
  <option value="pt">🇵🇹 Portuguese</option>
  <option value="ar">🇸🇦 Arabic</option>
  <option value="zh">🇨🇳 Chinese</option>
  <option value="ja">🇯🇵 Japanese</option>
  <option value="ru">🇷🇺 Russian</option>
  <option value="nl">🇳🇱 Dutch</option>
  <option value="de">🇩🇪 German</option>
</select>
          </div>
        </div>

        {/* Time Zone */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#150578]" />
            Time Zone
          </h3>
          <div className="space-y-3">
            <select
              value={settings.timeZone}
              onChange={(e) => handleTimeZoneChange(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
            >
              <option value="">Select timezone</option>
              {timeZones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
            <p className="text-xs text-[#778da9] mt-1">
              Current time: {new Date().toLocaleString('en-US', { timeZone: settings.timeZone })}
            </p>
          </div>
        </div>

        {/* Date & Time Format */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#150578]" />
              Date Format
            </h3>
            <div className="space-y-3">
              <select
                value={settings.dateFormat}
                onChange={(e) => {
                  onSettingsChange({
                    ...settings,
                    dateFormat: e.target.value
                  });
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
              >
                {dateFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label} ({format.example})
                  </option>
                ))}
              </select>
              <p className="text-sm text-[#778da9] mt-1">
                Today: {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                }).replace(/\//g, '/')}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Time Format</h3>
            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="timeFormat"
                    value="12h"
                    checked={settings.timeFormat === '12h'}
                    onChange={() => {
                      onSettingsChange({
                        ...settings,
                        timeFormat: '12h'
                      });
                    }}
                    className="text-[#150578]"
                  />
                  <span className="text-sm">12-hour (AM/PM)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="timeFormat"
                    value="24h"
                    checked={settings.timeFormat === '24h'}
                    onChange={() => {
                      onSettingsChange({
                        ...settings,
                        timeFormat: '24h'
                      });
                    }}
                    className="text-[#150578]"
                  />
                  <span className="text-sm">24-hour</span>
                </label>
              </div>
              <p className="text-sm text-[#778da9] mt-1">
                Current time: {new Date().toLocaleTimeString('en-US', {
                  hour12: settings.timeFormat === '12h',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Currency Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#150578]" />
              Currency
            </h3>
            <div className="space-y-3">
              <select
                value={settings.currency}
                onChange={(e) => {
                  onSettingsChange({
                    ...settings,
                    currency: e.target.value
                  });
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-[#778da9] mt-1">
                Example: {currencies.find(c => c.code === settings.currency)?.symbol}1,234.56
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
              <Ruler className="w-5 h-5 text-[#150578]" />
              Measurement System
            </h3>
            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="measurement"
                    value="metric"
                    checked={settings.measurementSystem === 'metric'}
                    onChange={() => {
                      onSettingsChange({
                        ...settings,
                        measurementSystem: 'metric'
                      });
                    }}
                    className="text-[#150578]"
                  />
                  <span className="text-sm">Metric (kg, cm, L)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="measurement"
                    value="imperial"
                    checked={settings.measurementSystem === 'imperial'}
                    onChange={() => {
                      onSettingsChange({
                        ...settings,
                        measurementSystem: 'imperial'
                      });
                    }}
                    className="text-[#150578]"
                  />
                  <span className="text-sm">Imperial (lbs, ft, gal)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Number Format */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Number Format</h3>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="numberFormat"
                  value="en-US"
                  checked={settings.numberFormat === 'en-US'}
                  onChange={() => {
                    onSettingsChange({
                      ...settings,
                      numberFormat: 'en-US'
                    });
                  }}
                  className="text-[#150578]"
                />
                <span className="text-sm">English (1,234.56)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="numberFormat"
                  value="de-DE"
                  checked={settings.numberFormat === 'de-DE'}
                  onChange={() => {
                    onSettingsChange({
                      ...settings,
                      numberFormat: 'de-DE'
                    });
                  }}
                  className="text-[#150578]"
                />
                <span className="text-sm">German (1.234,56)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="numberFormat"
                  value="fr-FR"
                  checked={settings.numberFormat === 'fr-FR'}
                  onChange={() => {
                    onSettingsChange({
                      ...settings,
                      numberFormat: 'fr-FR'
                    });
                  }}
                  className="text-[#150578]"
                />
                <span className="text-sm">French (1 234,56)</span>
              </label>
            </div>
            <p className="text-sm text-[#778da9] mt-1">
              Example: {1234.56.toLocaleString(settings.numberFormat)}
            </p>
          </div>
        </div>

        {/* Region Settings */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">Regional Preferences</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-[#778da9] mb-3">
              These settings help customize your experience based on your location and preferences.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#1b263b]">Week starts on:</span>
                <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent">
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}