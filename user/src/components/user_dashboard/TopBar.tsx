'use client';
 
import React, { useState } from 'react';
import Image from 'next/image';
import { Search, Bell, ChevronDown, ArrowRight, Menu, Globe } from 'lucide-react';
import { useLanguage } from '@/hooks/context/LanguageContext';
 
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
];
 
interface TopBarProps {
  onMenuClick?: () => void;
}
 
export default function TopBar({ onMenuClick }: TopBarProps) {
  const { language, setLanguage, t } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
 
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
 
  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
      {/* Left Side - Hamburger + User Info */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Hamburger Menu - Mobile Only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 text-gray-700" />
        </button>
 
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src="/images/user-avatar.png"
              alt="User profile"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-medium text-gray-900">{t('dashboard', 'title')}</span>
            <span className="text-[10px] sm:text-xs text-gray-500">{t('dashboard', 'bankAccount')}</span>
          </div>
          <ChevronDown className="hidden sm:block h-4 w-4 text-gray-400" />
        </div>
      </div>
 
      {/* Right Side - Search, Language, Notifications, Actions */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Search - Hidden on mobile */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('dashboard', 'search')}
            className="w-48 lg:w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
 
        {/* Search Icon - Mobile Only */}
        <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Search className="h-5 w-5 text-gray-400" />
        </button>
 
        {/* Language Switcher */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center space-x-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Globe className="h-5 w-5 text-gray-400" />
            <span className="hidden sm:block text-sm text-gray-600">{currentLang.label}</span>
            <ChevronDown className="hidden sm:block h-3 w-3 text-gray-400" />
          </button>
 
          {langOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    language === lang.code ? 'font-semibold text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
 
        {/* Notifications */}
        <div className="relative">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            <div className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></div>
          </button>
        </div>
 
        {/* Dark Mode Toggle */}
        <div className="hidden sm:flex items-center">
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none">
            <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out translate-x-6" />
          </div>
        </div>
 
        {/* Right Arrow */}
        <button className="hidden sm:block p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowRight className="h-5 w-5 text-gray-400 hover:text-gray-600" />
        </button>
      </div>
    </header>
  );
}
